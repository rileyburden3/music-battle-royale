import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { query } from '../db/index.js';
import { calculateBracket, getBracketData } from '../services/bracket.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// POST /api/battles - create a new battle
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { title, genre } = req.body;
  if (!title?.trim()) return res.status(400).json({ success: false, error: 'Battle title required' });

  try {
    let inviteCode = generateInviteCode();
    // ensure uniqueness
    let attempt = 0;
    while (attempt < 5) {
      const existing = await query('SELECT id FROM battles WHERE invite_code = $1', [inviteCode]);
      if (!existing.rows[0]) break;
      inviteCode = generateInviteCode();
      attempt++;
    }

    const battle = await query(
      `INSERT INTO battles (title, creator_id, genre, invite_code, status)
       VALUES ($1, $2, $3, $4, 'lobby') RETURNING *`,
      [title.trim(), req.user!.id, genre || null, inviteCode]
    );

    // Add creator as accepted participant
    await query(
      `INSERT INTO battle_participants (battle_id, user_id, status, joined_at)
       VALUES ($1, $2, 'accepted', NOW())`,
      [battle.rows[0].id, req.user!.id]
    );

    res.status(201).json({ success: true, data: battle.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to create battle' });
  }
});

// GET /api/battles - get user's battles
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT b.*, u.username as creator_username, u.display_name as creator_name, u.emblem as creator_emblem,
        (SELECT COUNT(*) FROM battle_participants WHERE battle_id = b.id AND status = 'accepted') as participant_count,
        bp.songs_submitted as my_songs_submitted,
        bp.rankings_submitted as my_rankings_submitted
       FROM battles b
       JOIN users u ON u.id = b.creator_id
       JOIN battle_participants bp ON bp.battle_id = b.id AND bp.user_id = $1
       WHERE bp.status != 'declined'
       ORDER BY b.created_at DESC LIMIT 20`,
      [req.user!.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch battles' });
  }
});

// GET /api/battles/:id - get battle details
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const battle = await query(
      `SELECT b.*, u.username as creator_username, u.display_name as creator_name, u.emblem as creator_emblem
       FROM battles b JOIN users u ON u.id = b.creator_id WHERE b.id = $1`,
      [req.params.id]
    );
    if (!battle.rows[0]) return res.status(404).json({ success: false, error: 'Battle not found' });

    const participants = await query(
      `SELECT bp.*, u.username, u.display_name, u.emblem, u.avatar_url
       FROM battle_participants bp JOIN users u ON u.id = bp.user_id
       WHERE bp.battle_id = $1 ORDER BY bp.joined_at ASC`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...battle.rows[0], participants: participants.rows } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch battle' });
  }
});

// POST /api/battles/join/:code - join battle via invite code
router.post('/join/:code', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const battle = await query(
      "SELECT * FROM battles WHERE invite_code = $1 AND status = 'lobby'",
      [req.params.code.toUpperCase()]
    );
    if (!battle.rows[0]) return res.status(404).json({ success: false, error: 'Battle not found or already in progress' });

    const b = battle.rows[0];

    // Check participant count (max 4)
    const participants = await query(
      "SELECT COUNT(*) as count FROM battle_participants WHERE battle_id = $1 AND status = 'accepted'",
      [b.id]
    );
    if (parseInt(participants.rows[0].count) >= 4) {
      return res.status(400).json({ success: false, error: 'Battle is full (4 players max)' });
    }

    // Check if already in battle
    const existing = await query(
      'SELECT * FROM battle_participants WHERE battle_id = $1 AND user_id = $2',
      [b.id, req.user!.id]
    );
    if (existing.rows[0]) {
      if (existing.rows[0].status === 'declined') {
        await query("UPDATE battle_participants SET status = 'accepted', joined_at = NOW() WHERE id = $1", [existing.rows[0].id]);
      }
      return res.json({ success: true, data: b, message: 'Already in battle' });
    }

    await query(
      `INSERT INTO battle_participants (battle_id, user_id, status, joined_at)
       VALUES ($1, $2, 'accepted', NOW())`,
      [b.id, req.user!.id]
    );

    // Create notification for creator
    await query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, 'friend_accepted', '⚔️ Fighter Joined!', $2, $3)`,
      [b.creator_id, `${req.user!.display_name} joined your battle: ${b.title}`, JSON.stringify({ battle_id: b.id })]
    );

    res.json({ success: true, data: b });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to join battle' });
  }
});

// POST /api/battles/:id/accept - accept a battle invitation (invited → accepted)
router.post('/:id/accept', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `UPDATE battle_participants
       SET status = 'accepted', joined_at = NOW()
       WHERE battle_id = $1 AND user_id = $2 AND status = 'invited'
       RETURNING *`,
      [req.params.id, req.user!.id]
    );
    // Idempotent — if already accepted, still succeed
    if (!result.rows[0]) {
      const existing = await query(
        `SELECT * FROM battle_participants WHERE battle_id = $1 AND user_id = $2`,
        [req.params.id, req.user!.id]
      );
      if (!existing.rows[0]) {
        return res.status(403).json({ success: false, error: 'You were not invited to this battle' });
      }
    }

    // Clear the battle invite notification — they've joined
    await query(
      `DELETE FROM notifications WHERE user_id = $1 AND type = 'friend_accepted' AND (data->>'battle_id') = $2`,
      [req.user!.id, req.params.id]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to accept invitation' });
  }
});

// POST /api/battles/:id/invite - invite friends by username
router.post('/:id/invite', requireAuth, async (req: AuthRequest, res: Response) => {
  const { usernames } = req.body; // array of usernames
  if (!Array.isArray(usernames) || usernames.length === 0) {
    return res.status(400).json({ success: false, error: 'Provide usernames to invite' });
  }
  if (usernames.length > 3) {
    return res.status(400).json({ success: false, error: 'Max 3 friends per battle' });
  }

  try {
    const battle = await query('SELECT * FROM battles WHERE id = $1 AND creator_id = $2', [req.params.id, req.user!.id]);
    if (!battle.rows[0]) return res.status(403).json({ success: false, error: 'Not authorized' });

    const results = [];
    for (const username of usernames) {
      const user = await query('SELECT id, display_name FROM users WHERE username = $1', [username.toLowerCase()]);
      if (!user.rows[0]) { results.push({ username, status: 'not_found' }); continue; }

      const existing = await query('SELECT id FROM battle_participants WHERE battle_id = $1 AND user_id = $2', [req.params.id, user.rows[0].id]);
      if (existing.rows[0]) { results.push({ username, status: 'already_invited' }); continue; }

      await query(
        `INSERT INTO battle_participants (battle_id, user_id, status)
         VALUES ($1, $2, 'invited')`,
        [req.params.id, user.rows[0].id]
      );

      // Notify invited user
      await query(
        `INSERT INTO notifications (user_id, type, title, body, data)
         VALUES ($1, 'friend_accepted', '🥊 Battle Invite!', $2, $3)`,
        [user.rows[0].id, `${req.user!.display_name} invited you to: ${battle.rows[0].title}`, JSON.stringify({ battle_id: req.params.id, invite_code: battle.rows[0].invite_code })]
      );

      results.push({ username, status: 'invited' });
    }

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to invite users' });
  }
});

// POST /api/battles/:id/start-submissions - move to submitting phase
router.post('/:id/start-submissions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const battle = await query("SELECT * FROM battles WHERE id = $1 AND creator_id = $2 AND status = 'lobby'", [req.params.id, req.user!.id]);
    if (!battle.rows[0]) return res.status(403).json({ success: false, error: 'Not authorized or battle not in lobby' });

    const participants = await query(
      "SELECT COUNT(*) as count FROM battle_participants WHERE battle_id = $1 AND status = 'accepted'",
      [req.params.id]
    );
    const count = parseInt(participants.rows[0].count);
    if (count < 2) return res.status(400).json({ success: false, error: 'Need at least 2 players to start' });

    await query("UPDATE battles SET status = 'submitting' WHERE id = $1", [req.params.id]);

    // Randomly assign song quotas — always sums to 8
    // 4 players: 2 each | 3 players: 3+3+2 | 2 players: 4+4
    const shuffled = await query(
      "SELECT user_id FROM battle_participants WHERE battle_id = $1 AND status = 'accepted' ORDER BY RANDOM()",
      [req.params.id]
    );
    const pCount = shuffled.rows.length;
    const base = Math.floor(8 / pCount);
    const extra = 8 % pCount;
    for (let i = 0; i < shuffled.rows.length; i++) {
      const quota = i < extra ? base + 1 : base;
      await query(
        'UPDATE battle_participants SET songs_quota = $1 WHERE battle_id = $2 AND user_id = $3',
        [quota, req.params.id, shuffled.rows[i].user_id]
      );
    }

    // Notify all participants
    const parts = await query(
      "SELECT user_id FROM battle_participants WHERE battle_id = $1 AND status = 'accepted'",
      [req.params.id]
    );
    for (const p of parts.rows) {
      await query(
        `INSERT INTO notifications (user_id, type, title, body, data)
         VALUES ($1, 'submit_songs', '🎵 Submit Your Songs!', $2, $3)`,
        [p.user_id, `Battle "${battle.rows[0].title}" is ready. Submit your songs now!`, JSON.stringify({ battle_id: req.params.id })]
      );
    }

    res.json({ success: true, message: 'Battle started' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to start battle' });
  }
});

// POST /api/battles/:id/start-voting - move to voting phase (any participant can trigger)
router.post('/:id/start-voting', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // Any accepted participant can trigger — idempotent via AND status = 'submitting'
    const participantCheck = await query(
      "SELECT 1 FROM battle_participants WHERE battle_id = $1 AND user_id = $2 AND status = 'accepted'",
      [req.params.id, req.user!.id]
    );
    if (!participantCheck.rows[0]) return res.status(403).json({ success: false, error: 'Not a participant' });

    const battle = await query("SELECT * FROM battles WHERE id = $1 AND status = 'submitting'", [req.params.id]);
    if (!battle.rows[0]) return res.status(400).json({ success: false, error: 'Battle is not in submission phase' });

    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h to vote
    await query(
      "UPDATE battles SET status = 'voting', voting_deadline = $2 WHERE id = $1",
      [req.params.id, deadline]
    );

    // Notify all participants
    const parts = await query(
      "SELECT user_id FROM battle_participants WHERE battle_id = $1 AND status = 'accepted'",
      [req.params.id]
    );
    for (const p of parts.rows) {
      await query(
        `INSERT INTO notifications (user_id, type, title, body, data)
         VALUES ($1, 'voting_live', '⚡ Voting is LIVE!', $2, $3)`,
        [p.user_id, `Battle "${battle.rows[0].title}" is now open for voting. Rank the songs!`, JSON.stringify({ battle_id: req.params.id })]
      );
    }

    // Clear all "submit songs" notifications for this battle — submission phase is over
    await query(
      `DELETE FROM notifications WHERE type = 'submit_songs' AND (data->>'battle_id') = $1`,
      [req.params.id]
    );

    res.json({ success: true, message: 'Voting started' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to start voting' });
  }
});

// POST /api/battles/:id/calculate - trigger bracket calculation
router.post('/:id/calculate', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const battle = await query("SELECT * FROM battles WHERE id = $1 AND creator_id = $2 AND status = 'voting'", [req.params.id, req.user!.id]);
    if (!battle.rows[0]) return res.status(403).json({ success: false, error: 'Not authorized' });

    await query("UPDATE battles SET status = 'calculating' WHERE id = $1", [req.params.id]);
    const champion = await calculateBracket(req.params.id);

    const championSong = await query('SELECT * FROM songs WHERE id = $1', [champion]);
    const championUser = await query('SELECT username, display_name, emblem FROM users WHERE id = $1', [championSong.rows[0]?.submitted_by]);

    // Notify all
    const parts = await query(
      "SELECT user_id FROM battle_participants WHERE battle_id = $1 AND status = 'accepted'",
      [req.params.id]
    );
    for (const p of parts.rows) {
      await query(
        `INSERT INTO notifications (user_id, type, title, body, data)
         VALUES ($1, 'battle_complete', '🏆 Battle Complete!', $2, $3)`,
        [p.user_id, `"${battle.rows[0].title}" is over! Champion: ${championSong.rows[0]?.title} by ${championUser.rows[0]?.display_name}`, JSON.stringify({ battle_id: req.params.id })]
      );
    }

    res.json({ success: true, data: { champion_song_id: champion } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to calculate bracket' });
  }
});

// GET /api/battles/:id/bracket - get bracket data
router.get('/:id/bracket', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = await getBracketData(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch bracket' });
  }
});

// GET /api/battles/:id/results - final results with song submitter revealed
router.get('/:id/results', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const battle = await query("SELECT * FROM battles WHERE id = $1 AND status = 'completed'", [req.params.id]);
    if (!battle.rows[0]) return res.status(404).json({ success: false, error: 'Results not available yet' });

    const songs = await query(
      `SELECT s.*, u.username as submitter_username, u.display_name as submitter_name, u.emblem as submitter_emblem,
        COALESCE(AVG(CASE WHEN r.ranked_by != s.submitted_by THEN r.score END), 0) as avg_score,
        COUNT(CASE WHEN r.ranked_by != s.submitted_by THEN 1 END) as vote_count,
        COUNT(DISTINCT bm.id) as battles_won
       FROM songs s
       LEFT JOIN users u ON u.id = s.submitted_by
       LEFT JOIN rankings r ON r.song_id = s.id AND r.battle_id = s.battle_id
       LEFT JOIN bracket_matches bm ON bm.winner_id = s.id AND bm.round = 3
       WHERE s.battle_id = $1
       GROUP BY s.id, u.username, u.display_name, u.emblem
       ORDER BY avg_score DESC, battles_won DESC`,
      [req.params.id]
    );

    const bracket = await getBracketData(req.params.id);

    res.json({ success: true, data: { battle: battle.rows[0], songs: songs.rows, bracket } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch results' });
  }
});

// DELETE /api/battles/:id - delete battle (creator only)
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query("DELETE FROM battles WHERE id = $1 AND creator_id = $2 RETURNING id", [req.params.id, req.user!.id]);
    if (!result.rows[0]) return res.status(403).json({ success: false, error: 'Not authorized' });
    res.json({ success: true, message: 'Battle deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete battle' });
  }
});

export default router;
