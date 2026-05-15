import { create } from 'zustand';

interface Battle {
  id: string;
  title: string;
  creator_id: string;
  status: string;
  genre?: string;
  invite_code: string;
  participants?: Participant[];
  participant_count?: number;
  created_at: string;
  voting_deadline?: string;
}

interface Participant {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  emblem: string;
  status: string;
  songs_submitted: boolean;
  rankings_submitted: boolean;
}

interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  album_art_url?: string;
  spotify_id?: string;
  preview_url?: string;
  duration_ms?: number;
  submitted_by?: string;
}

interface BattleState {
  battles: Battle[];
  currentBattle: Battle | null;
  currentSongs: Song[];
  myRankings: Record<string, number>;
  setBattles: (battles: Battle[]) => void;
  setCurrentBattle: (battle: Battle | null) => void;
  setCurrentSongs: (songs: Song[]) => void;
  setMyRankings: (rankings: Record<string, number>) => void;
  updateRanking: (songId: string, score: number) => void;
  clearBattle: () => void;
}

export const useBattleStore = create<BattleState>((set) => ({
  battles: [],
  currentBattle: null,
  currentSongs: [],
  myRankings: {},
  setBattles: (battles) => set({ battles }),
  setCurrentBattle: (battle) => set({ currentBattle: battle }),
  setCurrentSongs: (songs) => set({ currentSongs: songs }),
  setMyRankings: (rankings) => set({ myRankings: rankings }),
  updateRanking: (songId, score) =>
    set((state) => ({ myRankings: { ...state.myRankings, [songId]: score } })),
  clearBattle: () => set({ currentBattle: null, currentSongs: [], myRankings: {} }),
}));
