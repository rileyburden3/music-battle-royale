import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Swords, Clock, CheckCircle, Zap } from 'lucide-react';
import { getBattles } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useBattleStore } from '../store/useBattleStore';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  lobby:       { label: 'LOBBY',      color: 'text-gray-400 border-gray-600',         icon: Clock },
  submitting:  { label: 'SUBMIT',     color: 'text-neon-amber border-neon-amber',      icon: Zap },
  voting:      { label: 'VOTING',     color: 'text-neon-cyan border-neon-cyan',        icon: Swords },
  calculating: { label: 'CALC...',    color: 'text-neon-magenta border-neon-magenta',  icon: Zap },
  bracket:     { label: 'BRACKET',   color: 'text-neon-cyan border-neon-cyan',        icon: Swords },
  completed:   { label: 'DONE',      color: 'text-green-500 border-green-500',        icon: CheckCircle },
};

export function HomePage() {
  const navigate = useNavigate();
  const { appUser } = useAuthStore();
  const { battles, setBattles } = useBattleStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () =>
      getBattles()
        .then((res) => setBattles(res.data.data || []))
        .catch(() => toast.error('Failed to load battles'))
        .finally(() => setLoading(false));

    load();
    const interval = setInterval(load, 15000); // refresh every 15s so status stays current
    return () => clearInterval(interval);
  }, []);

  const getBattleAction = (battle: typeof battles[0]) => {
    switch (battle.status) {
      case 'submitting':
        return (battle as any).my_songs_submitted
          ? { label: 'View Lobby', path: `/battle/${battle.id}` }
          : { label: 'Submit Songs 🎵', path: `/battle/${battle.id}/submit` };
      case 'voting':
        return (battle as any).my_rankings_submitted
          ? { label: 'View Lobby', path: `/battle/${battle.id}` }
          : { label: 'Vote Now ⚡', path: `/battle/${battle.id}/vote` };
      case 'bracket':
      case 'completed':  return { label: 'View Results 👑', path: `/battle/${battle.id}/results` };
      default:           return { label: 'View Battle', path: `/battle/${battle.id}` };
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-gray-500 text-xs">Welcome back,</p>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <span>{appUser?.emblem}</span>
            <span>{appUser?.display_name}</span>
          </h1>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Points</p>
          <p className="neon-text-amber font-black text-lg">{appUser?.total_points || 0}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => navigate('/battle/create')}
          className="btn-primary flex-col gap-1 py-4 h-auto font-black text-sm"
        >
          <Plus size={20} />
          NEW BATTLE
        </button>
        <button
          onClick={() => navigate('/battle/join')}
          className="btn-secondary flex-col gap-1 py-4 h-auto font-bold text-sm"
        >
          <Swords size={20} />
          JOIN BATTLE
        </button>
      </div>

      {/* Battle list */}
      <div>
        <h2 className="section-title">Your Battles</h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse h-20 bg-dark-700" />
            ))}
          </div>
        ) : battles.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card text-center py-12"
          >
            <div className="text-5xl mb-4">🥊</div>
            <p className="text-white font-bold mb-1">No battles yet!</p>
            <p className="text-gray-500 text-sm mb-4">Create a battle and invite your crew</p>
            <button onClick={() => navigate('/battle/create')} className="btn-primary mx-auto">
              Start Your First Battle
            </button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {battles.map((battle, i) => {
              const cfg = STATUS_CONFIG[battle.status] || STATUS_CONFIG.lobby;
              const StatusIcon = cfg.icon;
              const action = getBattleAction(battle);
              return (
                <motion.div
                  key={battle.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="card hover:border-dark-400 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`badge border ${cfg.color} text-[10px]`}>
                          <StatusIcon size={10} />
                          {cfg.label}
                        </span>
                        {battle.genre && (
                          <span className="badge border border-dark-400 text-gray-500 text-[10px]">{battle.genre}</span>
                        )}
                      </div>
                      <p className="font-bold text-white truncate">{battle.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {battle.participant_count || 1} fighter{(battle.participant_count || 1) !== 1 ? 's' : ''} · {formatDistanceToNow(new Date(battle.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(action.path)}
                      className="text-xs font-bold px-3 py-2 rounded-lg bg-dark-600 hover:bg-dark-500 text-neon-cyan border border-neon-cyan/30 hover:border-neon-cyan whitespace-nowrap transition-all"
                    >
                      {action.label}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
