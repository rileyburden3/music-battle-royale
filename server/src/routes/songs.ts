import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { query } from '../db/index.js';
import axios from 'axios';

const router = Router();

// GET /api/songs/search?q=... - search iTunes
router.get('/search', requireAuth, async (req: AuthRequest, res: Response) => {
  const q = req.query.q as string;
  if (!q?.trim()) return res.status(400).json({ success: false, error: 'Query required' });

  try {
    const response = await axios.get('https://itunes.apple.com/search', {
      params: { term: q.trim(), entity: 'song', media: 'music', limit: 12 },
      timeout: 5000,
    });
    const formatted = response.data.results.map((t: {
      trackId: number; trackName: string; artistName: string;
      collectionName: string; artworkUrl100: string;
      previewUrl?: string; trackTimeMillis: number; trackViewUrl: string;
    }) => ({
      itunes_id: String(t.trackId),
      title: t.trackName,
      artist: t.artistName,
      album: t.collectionName,
      album_art_url: t.artworkUrl100?.replace('100x100', '500x500'),
      preview_url: t.previewUrl,
      duration_ms: t.trackTimeMillis,
      apple_music_url: t.trackViewUrl,
    }));
    res.json({ success: true, data: formatted });
  } catch (err) {
    console.error('iTunes search error:', err);
    res.json({ success: true, data: [], message: 'Search unavailable. Enter song details manually.' });
  }
});

// GET /api/songs/battle/:battleId - get songs in a battle (anonymized during voting)
router.get('/battle/:battleId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const battle = await query('SELECT status FROM battles WHERE id = $1', [req.params.battleId]);
    if (!battle.rows[0]) return res.status(404).json({ success: false, error: 'Battle not found' });

    const isCompleted = battle.rows[0].status === 'completed';

    // During voting, hide submitter info
    const select = isCompleted
      ? `s.*, u.username as submitter_username, u.display_name as submitter_name, u.emblem as submitter_emblem`
      : `s.id, s.battle_id, s.title, s.artist, s.album, s.album_art_url, s.preview_url, s.duration_ms, s.created_at,
         CASE WHEN s.submitted_by = $2 THEN s.submitted_by ELSE NULL END as submitted_by`;

    const queryParams = isCompleted ? [req.params.battleId] : [req.params.battleId, req.user!.id];
    const joinClause = isCompleted ? 'LEFT JOIN users u ON u.id = s.submitted_by' : '';

    const songs = await query(
      `SELECT ${select} FROM songs s ${joinClause} WHERE s.battle_id = $1 ORDER BY ${isCompleted ? 's.created_at ASC' : 'RANDOM()'}`,
      queryParams
    );

    res.json({ success: true, data: songs.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch songs' });
  }
});

// POST /api/songs/battle/:battleId - submit songs to a battle
router.post('/battle/:battleId', requireAuth, async (req: AuthRequest, res: Response) => {
  const { songs } = req.body; // array of song objects

  if (!Array.isArray(songs) || songs.length === 0) {
    return res.status(400).json({ success: false, error: 'Songs array required' });
  }

  try {
    const battle = await query(
      "SELECT * FROM battles WHERE id = $1 AND status IN ('submitting', 'lobby')",
      [req.params.battleId]
    );
    if (!battle.rows[0]) return res.status(404).json({ success: false, error: 'Battle not accepting songs' });

    // Check user is a participant
    const participant = await query(
      "SELECT * FROM battle_participants WHERE battle_id = $1 AND user_id = $2 AND status = 'accepted'",
      [req.params.battleId, req.user!.id]
    );
    if (!participant.rows[0]) return res.status(403).json({ success: false, error: 'Not a participant in this battle' });

    // Use the pre-assigned random quota (set when host started submissions)
    const myQuota = participant.rows[0].songs_quota || 2;

    if (songs.length > myQuota) {
      return res.status(400).json({ success: false, error: `You can submit up to ${myQuota} songs` });
    }

    // Check if already submitted
    if (participant.rows[0].songs_submitted) {
      return res.status(400).json({ success: false, error: 'You already submitted songs' });
    }

    // Check that none of the songs being submitted are already taken by another player
    for (const song of songs) {
      if (!song.title || !song.artist) continue;
      const duplicate = await query(
        `SELECT id FROM songs
         WHERE battle_id = $1 AND submitted_by != $2
         AND LOWER(title) = LOWER($3) AND LOWER(artist) = LOWER($4)`,
        [req.params.battleId, req.user!.id, song.title, song.artist]
      );
      if (duplicate.rows[0]) {
        return res.status(400).json({
          success: false,
          error: `"${song.title}" by ${song.artist} has already been submitted by another player`,
        });
      }
    }

    // Delete any existing submissions (allow re-submit before voting)
    await query('DELETE FROM songs WHERE battle_id = $1 AND submitted_by = $2', [req.params.battleId, req.user!.id]);

    const inserted = [];
    for (const song of songs) {
      if (!song.title || !song.artist) continue;
      const s = await query(
        `INSERT INTO songs (battle_id, submitted_by, title, artist, album, album_art_url, spotify_id, youtube_id, preview_url, duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [req.params.battleId, req.user!.id, song.title, song.artist, song.album, song.album_art_url, song.spotify_id, song.youtube_id, song.preview_url, song.duration_ms]
      );
      inserted.push(s.rows[0]);
    }

    // Mark songs as submitted
    await query(
      'UPDATE battle_participants SET songs_submitted = true WHERE battle_id = $1 AND user_id = $2',
      [req.params.battleId, req.user!.id]
    );

    // Clear the "submit your songs" notification — action complete
    await query(
      `DELETE FROM notifications WHERE user_id = $1 AND type = 'submit_songs' AND (data->>'battle_id') = $2`,
      [req.user!.id, req.params.battleId]
    );

    // Check if all participants submitted - auto-advance to voting if so
    let allDone = false;
    try {
      const submissionCheck = await query(
        `SELECT COUNT(*) FILTER (WHERE status = 'accepted') as total,
                COUNT(*) FILTER (WHERE status = 'accepted' AND songs_submitted = true) as submitted
         FROM battle_participants WHERE battle_id = $1`,
        [req.params.battleId]
      );
      const total = parseInt(submissionCheck.rows[0].total);
      const submitted = parseInt(submissionCheck.rows[0].submitted);
      allDone = total > 0 && submitted >= total;

      if (allDone) {
        const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await query(
          "UPDATE battles SET status = 'voting', voting_deadline = $2 WHERE id = $1 AND status = 'submitting'",
          [req.params.battleId, deadline]
        );
        const parts = await query(
          "SELECT user_id FROM battle_participants WHERE battle_id = $1 AND status = 'accepted'",
          [req.params.battleId]
        );
        for (const p of parts.rows) {
          await query(
            `INSERT INTO notifications (user_id, type, title, body, data)
             VALUES ($1, 'voting_live', '⚡ Voting is LIVE!', $2, $3)`,
            [p.user_id, `Battle "${battle.rows[0].title}" is now open for voting. Rank the songs!`,
             JSON.stringify({ battle_id: req.params.battleId })]
          );
        }
        await query(
          `DELETE FROM notifications WHERE type = 'submit_songs' AND (data->>'battle_id') = $1`,
          [req.params.battleId]
        );
      }
    } catch (autoErr) {
      console.error('Auto-advance to voting failed (songs still saved):', autoErr);
    }

    res.json({
      success: true,
      data: inserted,
      meta: { all_submitted: allDone, voting_started: allDone }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to submit songs' });
  }
});

// DELETE /api/songs/:id - delete a song (own submissions only, before voting)
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const song = await query('SELECT s.*, b.status FROM songs s JOIN battles b ON b.id = s.battle_id WHERE s.id = $1', [req.params.id]);
    if (!song.rows[0]) return res.status(404).json({ success: false, error: 'Song not found' });
    if (song.rows[0].submitted_by !== req.user!.id) return res.status(403).json({ success: false, error: 'Not your song' });
    if (!['lobby', 'submitting'].includes(song.rows[0].status)) {
      return res.status(400).json({ success: false, error: 'Cannot remove songs after voting starts' });
    }

    await query('DELETE FROM songs WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Song removed' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete song' });
  }
});

// GET /api/songs/demo - get demo songs for cold start battle
router.get('/demo', async (_req, res: Response) => {
  try {
    const songs = await query('SELECT * FROM demo_songs LIMIT 8');
    res.json({ success: true, data: songs.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch demo songs' });
  }
});

export default router;
