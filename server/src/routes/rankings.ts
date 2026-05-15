import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { query } from '../db/index.js';
import { calculateBracket } from '../services/bracket.js';

const router = Router();

// POST /api/rankings/battle/:battleId - submit rankings (1-10 per song)
router.post('/battle/:battleId', requireAuth, async (req: AuthRequest, res: Response) => {
  const { rankings, round = 1 } = req.body;
  // rankings: [{ song_id, score }]

  if (!Array.isArray(rankings) || rankings.length === 0) {
    return res.status(400).json({ success: false, error: 'Rankings array required' });
  }

  try {
    const battle = await query("SELECT * FROM battles WHERE id = $1 AND status = 'voting'", [req.params.battleId]);
    if (!battle.rows[0]) return res.status(400).json({ success: false, error: 'Battle is not in voting phase' });

    // Verify participant
    const participant = await query(
      "SELECT * FROM battle_participants WHERE battle_id = $1 AND user_id = $2 AND status = 'accepted'",
      [req.params.battleId, req.user!.id]
    );
    if (!participant.rows[0]) return res.status(403).json({ success: false, error: 'Not a participant' });
    if (participant.rows[0].rankings_submitted) return res.status(400).json({ success: false, error: 'Rankings already submitted' });

    // Only keep rankings for songs that actually exist in this battle (silently drop stale ones)
    const battleSongs = await query('SELECT id FROM songs WHERE battle_id = $1', [req.params.battleId]);
    const validIds = new Set(battleSongs.rows.map((s: { id: string }) => s.id));
    const validRankings = rankings.filter((r: { song_id: string; score: number }) => validIds.has(r.song_id));

    for (const r of validRankings) {
      if (r.score < 1 || r.score > 10) return res.status(400).json({ success: false, error: 'Scores must be 1-10' });
    }

    // Upsert rankings
    for (const r of validRankings) {
      await query(
        `INSERT INTO rankings (battle_id, song_id, ranked_by, score, round)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (battle_id, song_id, ranked_by, round) DO UPDATE SET score = $4`,
        [req.params.battleId, r.song_id, req.user!.id, r.score, round]
      );
    }

    // Mark rankings as submitted
    await query(
      'UPDATE battle_participants SET rankings_submitted = true WHERE battle_id = $1 AND user_id = $2',
      [req.params.battleId, req.user!.id]
    );

    // Clear the "voting is live" notification — action complete
    await query(
      `DELETE FROM notifications WHERE user_id = $1 AND type = 'voting_live' AND (data->>'battle_id') = $2`,
      [req.user!.id, req.params.battleId]
    );

    // Check if all participants have ranked
    const allRanked = await query(
      `SELECT COUNT(*) as total, SUM(CASE WHEN rankings_submitted THEN 1 ELSE 0 END) as ranked
       FROM battle_participants WHERE battle_id = $1 AND status = 'accepted'`,
      [req.params.battleId]
    );
    const { total, ranked } = allRanked.rows[0];

    const allDone = parseInt(ranked) >= parseInt(total);

    // Auto-calculate results when every participant has voted
    if (allDone) {
      try {
        await calculateBracket(req.params.battleId);
      } catch (calcErr) {
        console.error('Auto-calculate failed — reverting battle to voting so host can retry:', calcErr);
        // Revert to voting so the host can use "Force Calculate" rather than leaving
        // the battle permanently stuck in a broken completed state with no bracket data
        await query("UPDATE battles SET status = 'voting' WHERE id = $1", [req.params.battleId]);
      }
    }

    res.json({
      success: true,
      message: 'Rankings submitted!',
      meta: { all_ranked: allDone, ranked, total }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to submit rankings' });
  }
});

// GET /api/rankings/battle/:battleId/my - get my rankings for a battle
router.get('/battle/:battleId/my', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM rankings WHERE battle_id = $1 AND ranked_by = $2',
      [req.params.battleId, req.user!.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch rankings' });
  }
});

// GET /api/rankings/battle/:battleId/scores - get aggregate scores (after voting complete)
router.get('/battle/:battleId/scores', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const battle = await query("SELECT status FROM battles WHERE id = $1", [req.params.battleId]);
    if (!battle.rows[0]) return res.status(404).json({ success: false, error: 'Battle not found' });
    if (!['calculating', 'bracket', 'completed'].includes(battle.rows[0].status)) {
      return res.status(403).json({ success: false, error: 'Scores not available during voting' });
    }

    const scores = await query(
      `SELECT r.song_id, s.title, s.artist, s.album_art_url,
        AVG(CASE WHEN r.ranked_by != s.submitted_by THEN r.score END) as avg_score,
        COUNT(CASE WHEN r.ranked_by != s.submitted_by THEN 1 END) as vote_count
       FROM rankings r
       JOIN songs s ON s.id = r.song_id
       WHERE r.battle_id = $1
       GROUP BY r.song_id, s.title, s.artist, s.album_art_url
       ORDER BY avg_score DESC`,
      [req.params.battleId]
    );

    res.json({ success: true, data: scores.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch scores' });
  }
});

export default router;
