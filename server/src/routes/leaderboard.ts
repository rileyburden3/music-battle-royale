import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { query } from '../db/index.js';

const router = Router();

// GET /api/leaderboard?period=weekly|monthly|all_time
router.get('/', async (req, res: Response) => {
  const period = (req.query.period as string) || 'all_time';
  const validPeriods = ['weekly', 'monthly', 'all_time'];
  if (!validPeriods.includes(period)) {
    return res.status(400).json({ success: false, error: 'Invalid period' });
  }

  try {
    let result;
    if (period === 'all_time') {
      result = await query(
        `SELECT u.id, u.username, u.display_name, u.emblem, u.total_points, u.battles_won, u.battles_played,
          RANK() OVER (ORDER BY u.total_points DESC) as rank
         FROM users u
         WHERE u.battles_played > 0
         ORDER BY u.total_points DESC LIMIT 50`
      );
    } else {
      const since = period === 'weekly' ? '7 days' : '30 days';
      result = await query(
        `SELECT u.id, u.username, u.display_name, u.emblem,
          COALESCE(SUM(CASE WHEN s.rank_position = 1 THEN 30 WHEN s.rank_position = 2 THEN 25 WHEN s.rank_position = 3 THEN 10 ELSE 0 END), 0) as total_points,
          COUNT(DISTINCT CASE WHEN b.status = 'completed' THEN b.id END) as battles_played,
          RANK() OVER (ORDER BY COALESCE(SUM(CASE WHEN s.rank_position = 1 THEN 30 WHEN s.rank_position = 2 THEN 25 WHEN s.rank_position = 3 THEN 10 ELSE 0 END), 0) DESC) as rank
         FROM users u
         LEFT JOIN battle_participants bp ON bp.user_id = u.id AND bp.status = 'accepted'
         LEFT JOIN battles b ON b.id = bp.battle_id AND b.completed_at > NOW() - INTERVAL '${since}' AND b.status = 'completed'
         LEFT JOIN LATERAL (
           SELECT songs.id, songs.submitted_by,
             RANK() OVER (ORDER BY AVG(CASE WHEN r.ranked_by != songs.submitted_by THEN r.score END) DESC NULLS LAST) as rank_position
           FROM songs
           LEFT JOIN rankings r ON r.song_id = songs.id
           WHERE songs.battle_id = b.id
           GROUP BY songs.id
         ) s ON s.submitted_by = u.id
         WHERE b.id IS NOT NULL
         GROUP BY u.id
         ORDER BY points DESC LIMIT 50`
      );
    }

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
  }
});

// GET /api/leaderboard/me - get my position
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT u.id, u.username, u.display_name, u.emblem, u.total_points, u.battles_won, u.battles_played,
        (SELECT COUNT(*) + 1 FROM users u2 WHERE u2.total_points > u.total_points) as rank
       FROM users u WHERE u.id = $1`,
      [req.user!.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch rank' });
  }
});

// GET /api/leaderboard/songs - top songs across all battles
router.get('/songs', async (req, res: Response) => {
  try {
    const result = await query(
      `SELECT s.title, s.artist, s.album_art_url, s.spotify_id,
        AVG(CASE WHEN r.ranked_by != s.submitted_by THEN r.score END) as avg_score,
        COUNT(DISTINCT CASE WHEN r.ranked_by != s.submitted_by THEN r.ranked_by END) as total_votes,
        COUNT(DISTINCT bm.id) as battles_won
       FROM songs s
       LEFT JOIN rankings r ON r.song_id = s.id
       LEFT JOIN bracket_matches bm ON bm.winner_id = s.id AND bm.round = 3
       GROUP BY s.title, s.artist, s.album_art_url, s.spotify_id
       HAVING COUNT(DISTINCT r.ranked_by) >= 2
       ORDER BY avg_score DESC, battles_won DESC LIMIT 20`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch song leaderboard' });
  }
});

export default router;
