import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { query } from '../db/index.js';

const router = Router();

// GET /api/notifications - get my notifications (stale action-required ones filtered out)
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT n.* FROM notifications n
       WHERE n.user_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM battles b
         JOIN battle_participants bp ON bp.battle_id = b.id AND bp.user_id = $1
         WHERE b.id::text = n.data->>'battle_id'
         AND (
           (n.type = 'submit_songs'   AND (b.status != 'submitting' OR bp.songs_submitted    = true))
           OR (n.type = 'voting_live' AND (b.status != 'voting'     OR bp.rankings_submitted = true))
           OR (n.type = 'friend_accepted' AND n.title LIKE '%Invite%' AND bp.status = 'accepted')
         )
       )
       ORDER BY n.created_at DESC LIMIT 50`,
      [req.user!.id]
    );
    const unread = result.rows.filter((n: { read: boolean }) => !n.read).length;
    res.json({ success: true, data: result.rows, unread });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

// PUT /api/notifications/read-all - mark all as read
router.put('/read-all', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await query('UPDATE notifications SET read = true WHERE user_id = $1', [req.user!.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update notifications' });
  }
});

// PUT /api/notifications/:id/read - mark one as read
router.put('/:id/read', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await query('UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update notification' });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete notification' });
  }
});

export default router;
