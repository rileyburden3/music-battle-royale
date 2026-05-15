import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, Settings, Trophy, Swords, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { logOut } from '../services/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { getMe } from '../services/api';

export function ProfilePage() {
  const navigate = useNavigate();
  const { appUser, logout, setAppUser } = useAuthStore();

  // Always fetch fresh profile data when this page is viewed
  useEffect(() => {
    getMe().then((res) => setAppUser(res.data.data)).catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await logOut();
      logout();
      navigate('/');
    } catch {
      toast.error('Logout failed');
    }
  };

  if (!appUser) return null;

  const winRate = appUser.battles_played > 0
    ? Math.round((appUser.battles_won / appUser.battles_played) * 100)
    : 0;

  const statCards = [
    { label: 'Points', value: appUser.total_points, icon: Star, color: 'text-neon-amber' },
    { label: 'Battles', value: appUser.battles_played, icon: Swords, color: 'text-neon-cyan' },
    { label: 'Wins', value: appUser.battles_won, icon: Trophy, color: 'text-neon-magenta' },
    { label: 'Win Rate', value: `${winRate}%`, icon: Trophy, color: 'text-green-500' },
  ];

  return (
    <div className="page-container">
      {/* Profile header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        {/* Avatar / emblem */}
        <div className="relative inline-block mb-4">
          <div className="w-24 h-24 rounded-full bg-dark-700 border-4 border-neon-cyan shadow-neon-cyan flex items-center justify-center text-5xl">
            {appUser.emblem}
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-dark-900 rounded-full border-2 border-neon-amber flex items-center justify-center">
            <Trophy size={14} className="text-neon-amber" />
          </div>
        </div>
        <h1 className="text-2xl font-black text-white">{appUser.display_name}</h1>
        <p className="text-gray-500 text-sm">@{appUser.username}</p>

        {appUser.genre_preferences.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1 mt-3">
            {appUser.genre_preferences.map((g) => (
              <span key={g} className="badge border border-neon-magenta/30 text-neon-magenta bg-neon-magenta/5 text-[10px]">
                {g}
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.07 }}
              className="card text-center py-4"
            >
              <Icon size={18} className={`${stat.color} mx-auto mb-1`} />
              <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={() => navigate('/onboarding')}
          className="btn-secondary w-full gap-2"
        >
          <Settings size={16} />
          Edit Profile
        </button>

        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">About</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Fighter since</span>
              <span className="text-gray-300 font-medium">
                {appUser.created_at ? new Date(appUser.created_at).getFullYear() : new Date().getFullYear()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Avg score given</span>
              <span className="text-gray-300 font-medium">–</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-neon-red border border-dark-500 hover:border-neon-red/30 rounded-lg py-3 px-4 transition-all min-h-[48px] font-semibold"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
