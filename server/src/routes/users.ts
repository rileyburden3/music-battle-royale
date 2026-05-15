import { Router, Response } from 'express';
import { requireAuth, verifyFirebaseToken, AuthRequest } from '../middleware/auth.js';
import { query } from '../db/index.js';

const router = Router();

const EMBLEMS = ['🔥', '⚡', '👑', '💀', '🎵', '🎯', '🦁', '🐉', '🦊', '🌟', '💎', '🎸', '🥊', '⚔️', '🎤', '🦅'];
const GENRES = ['Hip-Hop', 'Pop', 'R&B', 'Rock', 'Electronic', 'Jazz', 'Latin', 'Country', 'Indie', 'Metal', 'Reggae', 'Soul'];

// GET /api/users/emblems - get available emblems
router.get('/emblems', (_req, res: Response) => {
  res.json({ success: true, data: EMBLEMS });
});

// GET /api/users/genres - get available genres
router.get('/genres', (_req, res: Response) => {
  res.json({ success: true, data: GENRES });
});

// POST /api/users/profile - create profile after firebase signup
router.post('/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  const { username, display_name, emblem, genre_preferences } = req.body;

  if (!username || !display_name) {
    return res.status(400).json({ success: false, error: 'Username and display name required' });
  }
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ success: false, error: 'Username: 3-20 chars, letters/numbers/underscore only' });
  }

  try {
    // Check username availability
    const existing = await query('SELECT id FROM users WHERE username = $1', [username.toLowerCase()]);
    if (existing.rows[0]) {
      return res.status(409).json({ success: false, error: 'Username already taken' });
    }

    const result = await query(
      `UPDATE users SET username = $1, display_name = $2, emblem = $3, genre_preferences = $4, updated_at = NOW()
       WHERE firebase_uid = $5 RETURNING *`,
      [username.toLowerCase(), display_name.trim(), emblem || '🎵', genre_preferences || [], req.user!.firebase_uid]
    );

    if (!result.rows[0]) {
      // Create new user record
      const newUser = await query(
        `INSERT INTO users (firebase_uid, username, display_name, emblem, genre_preferences)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.user!.firebase_uid, username.toLowerCase(), display_name.trim(), emblem || '🎵', genre_preferences || []]
      );
      return res.status(201).json({ success: true, data: newUser.rows[0] });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err: unknown) {
    console.error(err);
    const msg = err instanceof Error ? err.message : 'Failed to create profile';
    res.status(500).json({ success: false, error: msg });
  }
});

// GET /api/users/search?q= - search users by username, display name, email, or phone
router.get('/search', requireAuth, async (req: AuthRequest, res: Response) => {
  const q = ((req.query.q as string) || '').trim();
  if (q.length < 2) return res.json({ success: true, data: [] });
  try {
    // Try full search including email + phone_number (requires migration)
    const result = await query(
      `SELECT id, username, display_name, emblem, email, phone_number
       FROM users
       WHERE (
         username ILIKE $1 OR
         display_name ILIKE $1 OR
         email ILIKE $1 OR
         phone_number ILIKE $1
       ) AND id != $2
       LIMIT 8`,
      [`%${q}%`, req.user!.id]
    );
    res.json({ success: true, data: result.rows });
  } catch {
    // Fallback: email/phone columns may not exist yet — search by name only
    try {
      const result = await query(
        `SELECT id, username, display_name, emblem
         FROM users
         WHERE (username ILIKE $1 OR display_name ILIKE $1) AND id != $2
         LIMIT 8`,
        [`%${q}%`, req.user!.id]
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Search failed' });
    }
  }
});

// GET /api/users/me - current user profile
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM users WHERE id = $1',
      [req.user!.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

// PUT /api/users/me - update profile
router.put('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const { username, display_name, emblem, genre_preferences, phone_number } = req.body;
  try {
    // Validate + check uniqueness if username is being changed
    if (username) {
      if (!/^[a-z0-9_]{3,20}$/.test(username)) {
        return res.status(400).json({ success: false, error: 'Username: 3-20 chars, letters/numbers/underscore only' });
      }
      const taken = await query('SELECT id FROM users WHERE username = $1 AND id != $2', [username.toLowerCase(), req.user!.id]);
      if (taken.rows[0]) {
        return res.status(409).json({ success: false, error: 'Username already taken' });
      }
    }

    let result;
    try {
      // Full update including email + phone_number
      result = await query(
        `UPDATE users SET
           username = COALESCE($1, username),
           display_name = COALESCE($2, display_name),
           emblem = COALESCE($3, emblem),
           genre_preferences = COALESCE($4, genre_preferences),
           phone_number = COALESCE($5, phone_number),
           email = COALESCE($6, email),
           updated_at = NOW()
         WHERE id = $7 RETURNING *`,
        [username?.toLowerCase() || null, display_name, emblem, genre_preferences, phone_number || null, req.user!.email || null, req.user!.id]
      );
    } catch {
      // email/phone_number columns may not exist yet — update without them
      result = await query(
        `UPDATE users SET
           username = COALESCE($1, username),
           display_name = COALESCE($2, display_name),
           emblem = COALESCE($3, emblem),
           genre_preferences = COALESCE($4, genre_preferences),
           updated_at = NOW()
         WHERE id = $5 RETURNING *`,
        [username?.toLowerCase() || null, display_name, emblem, genre_preferences, req.user!.id]
      );
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update profile';
    res.status(500).json({ success: false, error: msg });
  }
});

// GET /api/users/:username - public profile
router.get('/:username', async (req, res: Response) => {
  try {
    const result = await query(
      `SELECT id, username, display_name, emblem, genre_preferences, total_points, battles_won, battles_played, created_at
       FROM users WHERE username = $1`,
      [req.params.username.toLowerCase()]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

// GET /api/users/check-username/:username
router.get('/check-username/:username', async (req, res: Response) => {
  const result = await query('SELECT id FROM users WHERE username = $1', [req.params.username.toLowerCase()]);
  res.json({ success: true, data: { available: !result.rows[0] } });
});

// POST /api/users/init - called after Firebase auth to ensure user row exists
router.post('/init', verifyFirebaseToken, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await query('SELECT * FROM users WHERE firebase_uid = $1', [req.user!.firebase_uid]);
    if (existing.rows[0]) {
      return res.json({ success: true, data: existing.rows[0], isNew: false });
    }
    // Create bare user - they still need to complete profile
    const newUser = await query(
      `INSERT INTO users (firebase_uid, username, display_name, emblem, email)
       VALUES ($1, $2, $3, '🎵', $4) RETURNING *`,
      [req.user!.firebase_uid, `user_${Date.now()}`, 'New Fighter', req.user!.email || null]
    );
    res.status(201).json({ success: true, data: newUser.rows[0], isNew: true });
  } catch (err) {
    console.error('Init error:', err);
    res.status(500).json({ success: false, error: 'Failed to initialize user' });
  }
});

export default router;
