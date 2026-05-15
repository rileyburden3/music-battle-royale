import { useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellOff, Swords, Music, Zap, Trophy, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '../hooks/useNotifications';
import { clsx } from 'clsx';

const NOTIF_CONFIG = {
  friend_accepted: { icon: Swords, color: 'text-neon-cyan border-neon-cyan/30 bg-neon-cyan/5' },
  submit_songs:    { icon: Music,  color: 'text-neon-amber border-neon-amber/30 bg-neon-amber/5' },
  voting_live:     { icon: Zap,   color: 'text-neon-magenta border-neon-magenta/30 bg-neon-magenta/5' },
  battle_complete: { icon: Trophy, color: 'text-green-500 border-green-500/30 bg-green-500/5' },
};

export function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, unread, markAllAsRead, markOneRead } = useNotifications();
  const inFlightRef = useRef<Set<string>>(new Set());

  const handleClick = async (notif: typeof notifications[0]) => {
    if (inFlightRef.current.has(notif.id)) return;
    inFlightRef.current.add(notif.id);
    try {
    await markOneRead(notif.id);
    if (notif.data?.battle_id) {
      // Always go through the lobby — it checks current battle state and redirects correctly.
      // Only battle_complete goes straight to results since the battle is definitively done.
      const route = notif.type === 'battle_complete'
        ? `/battle/${notif.data.battle_id}/results`
        : `/battle/${notif.data.battle_id}`;
      navigate(route);
    }
    } finally {
      inFlightRef.current.delete(notif.id);
    }
  };

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-neon-cyan" />
          <h1 className="pixel-text text-neon-cyan text-xs">ALERTS</h1>
          {unread > 0 && (
            <span className="badge bg-neon-red text-white text-[10px]">{unread}</span>
          )}
        </div>
        {unread > 0 && (
          <button onClick={markAllAsRead} className="text-xs text-gray-500 hover:text-neon-cyan flex items-center gap-1 transition-colors">
            <CheckCheck size={12} /> Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card text-center py-16"
        >
          <BellOff size={40} className="mx-auto mb-3 text-gray-600" />
          <p className="text-gray-500 font-semibold">No notifications</p>
          <p className="text-gray-600 text-sm mt-1">Battle alerts will show up here</p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif, i) => {
            const cfg = NOTIF_CONFIG[notif.type as keyof typeof NOTIF_CONFIG] || NOTIF_CONFIG.friend_accepted;
            const Icon = cfg.icon;
            return (
              <motion.button
                key={notif.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => handleClick(notif)}
                className={clsx(
                  'w-full text-left card border flex items-start gap-3 transition-all hover:brightness-110 active:scale-[0.98]',
                  cfg.color,
                  !notif.read && 'ring-1 ring-current/30'
                )}
              >
                <div className="mt-0.5">
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm">{notif.title}</p>
                  <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">{notif.body}</p>
                  <p className="text-gray-600 text-[10px] mt-1">
                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!notif.read && (
                  <div className="w-2 h-2 rounded-full bg-current flex-shrink-0 mt-1.5" />
                )}
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
