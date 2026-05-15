import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { onAuthChange } from './services/firebase';
import { initUser } from './services/api';
import { useAuthStore } from './store/useAuthStore';
import { BottomNav } from './components/shared/BottomNav';
import { LoadingScreen } from './components/shared/LoadingScreen';

// Pages
import { LandingPage } from './pages/LandingPage';
import { SignupPage } from './pages/SignupPage';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { HomePage } from './pages/HomePage';
import { CreateBattlePage } from './pages/CreateBattlePage';
import { JoinBattlePage } from './pages/JoinBattlePage';
import { BattleLobbyPage } from './pages/BattleLobbyPage';
import { SongSubmissionPage } from './pages/SongSubmissionPage';
import { VotingPage } from './pages/VotingPage';
import { ResultsPage } from './pages/ResultsPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { DemoBattlePage } from './pages/DemoBattlePage';

const NO_NAV_ROUTES = ['/', '/login', '/signup', '/onboarding', '/demo'];

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { firebaseUser, isLoading, profileComplete } = useAuthStore();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;
  if (!firebaseUser) return <Navigate to="/" state={{ from: location }} replace />;
  if (!profileComplete && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const { firebaseUser, isLoading, profileComplete } = useAuthStore();
  if (isLoading) return <LoadingScreen />;
  if (firebaseUser) return <Navigate to={profileComplete ? '/home' : '/onboarding'} replace />;
  return <>{children}</>;
}

export function App() {
  const { setFirebaseUser, setAppUser, setLoading, isLoading } = useAuthStore();
  const location = useLocation();
  const showNav = !NO_NAV_ROUTES.some((r) => location.pathname === r);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const res = await initUser();
          setAppUser(res.data.data);
        } catch {
          // user might need to complete profile
        }
      } else {
        setAppUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-[#060608] flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-dark-900 relative shadow-2xl shadow-black/60">
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* Public routes */}
          <Route path="/" element={<RequireGuest><LandingPage /></RequireGuest>} />
          <Route path="/login" element={<RequireGuest><LoginPage /></RequireGuest>} />
          <Route path="/signup" element={<RequireGuest><SignupPage /></RequireGuest>} />
          <Route path="/demo" element={<DemoBattlePage />} />

          {/* Onboarding (auth required, profile incomplete) */}
          <Route path="/onboarding" element={<OnboardingPage />} />

          {/* Protected routes */}
          <Route path="/home" element={<RequireAuth><HomePage /></RequireAuth>} />
          <Route path="/battle/create" element={<RequireAuth><CreateBattlePage /></RequireAuth>} />
          <Route path="/battle/join" element={<RequireAuth><JoinBattlePage /></RequireAuth>} />
          <Route path="/battle/:id" element={<RequireAuth><BattleLobbyPage /></RequireAuth>} />
          <Route path="/battle/:id/submit" element={<RequireAuth><SongSubmissionPage /></RequireAuth>} />
          <Route path="/battle/:id/vote" element={<RequireAuth><VotingPage /></RequireAuth>} />
          <Route path="/battle/:id/results" element={<RequireAuth><ResultsPage /></RequireAuth>} />
          <Route path="/leaderboard" element={<RequireAuth><LeaderboardPage /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>

      {showNav && <BottomNav />}
      </div>
    </div>
  );
}
