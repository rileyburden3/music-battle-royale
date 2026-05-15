import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User as FirebaseUser } from 'firebase/auth';

interface AppUser {
  id: string;
  firebase_uid: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  emblem: string;
  genre_preferences: string[];
  total_points: number;
  battles_won: number;
  battles_played: number;
  created_at?: string;
}

interface AuthState {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  isLoading: boolean;
  profileComplete: boolean;
  setFirebaseUser: (user: FirebaseUser | null) => void;
  setAppUser: (user: AppUser | null) => void;
  setLoading: (loading: boolean) => void;
  setProfileComplete: (complete: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      firebaseUser: null,
      appUser: null,
      isLoading: true,
      profileComplete: false,
      setFirebaseUser: (user) => set({ firebaseUser: user }),
      setAppUser: (user) => set({
        appUser: user,
        profileComplete: !!(user?.username && !user.username.startsWith('user_')),
      }),
      setLoading: (loading) => set({ isLoading: loading }),
      setProfileComplete: (complete) => set({ profileComplete: complete }),
      logout: () => set({ firebaseUser: null, appUser: null, profileComplete: false }),
    }),
    {
      name: 'battle-royale-auth',
      partialize: (state) => ({ appUser: state.appUser, profileComplete: state.profileComplete }),
    }
  )
);
