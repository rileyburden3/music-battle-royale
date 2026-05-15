import { NavLink, useLocation } from 'react-router-dom';
import { Swords, Trophy, Bell, User } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';

export function BottomNav() {
  const location = useLocation();
  const { unread } = useNotifications();

  const links = [
    { to: '/home', icon: Swords, label: 'Battles' },
    { to: '/leaderboard', icon: Trophy, label: 'Ranks' },
    { to: '/notifications', icon: Bell, label: 'Alerts', badge: unread },
    { to: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 bg-dark-800 border-t border-dark-500 safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {links.map(({ to, icon: Icon, label, badge }) => {
          const active = location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className="flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all duration-150 min-w-[56px]"
            >
              <div className="relative">
                <Icon
                  size={22}
                  className={active ? 'text-neon-cyan drop-shadow-[0_0_6px_#00ffff]' : 'text-gray-500'}
                />
                {badge != null && badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-neon-red text-white text-[9px] font-bold min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span className={`text-[9px] font-semibold ${active ? 'text-neon-cyan' : 'text-gray-500'}`}>
                {label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
