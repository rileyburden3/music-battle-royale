export interface User {
  id: string;
  firebase_uid: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  emblem: string; // emoji or code
  genre_preferences: string[];
  total_points: number;
  battles_won: number;
  battles_played: number;
  created_at: Date;
  updated_at: Date;
}

export interface Battle {
  id: string;
  title: string;
  creator_id: string;
  status: BattleStatus;
  genre?: string;
  song_count: number; // always 8
  current_round: number; // 1, 2, or 3
  invite_code: string;
  created_at: Date;
  updated_at: Date;
  voting_deadline?: Date;
  completed_at?: Date;
}

export type BattleStatus =
  | 'lobby'         // waiting for players & song submission
  | 'submitting'    // players submitting songs
  | 'voting'        // players ranking songs
  | 'calculating'   // bracket being computed
  | 'bracket'       // showing round results
  | 'completed';    // final results ready

export interface BattleParticipant {
  id: string;
  battle_id: string;
  user_id: string;
  status: 'invited' | 'accepted' | 'declined';
  songs_submitted: boolean;
  rankings_submitted: boolean;
  joined_at?: Date;
}

export interface Song {
  id: string;
  battle_id: string;
  submitted_by: string; // user_id - hidden during voting
  title: string;
  artist: string;
  album?: string;
  album_art_url?: string;
  spotify_id?: string;
  youtube_id?: string;
  preview_url?: string;
  duration_ms?: number;
  created_at: Date;
}

export interface Ranking {
  id: string;
  battle_id: string;
  song_id: string;
  ranked_by: string; // user_id
  score: number; // 1-10
  round: number;
  created_at: Date;
}

export interface BracketMatch {
  id: string;
  battle_id: string;
  round: number; // 1, 2, 3
  match_number: number;
  song1_id: string;
  song2_id: string;
  winner_id?: string;
  song1_avg_score?: number;
  song2_avg_score?: number;
  completed: boolean;
}

export interface LeaderboardEntry {
  id: string;
  user_id: string;
  period: 'weekly' | 'monthly' | 'all_time';
  points: number;
  rank: number;
  battles_won: number;
  songs_in_top3: number;
  updated_at: Date;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  read: boolean;
  created_at: Date;
}

export type NotificationType =
  | 'friend_accepted'
  | 'submit_songs'
  | 'voting_live'
  | 'battle_complete';

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: Array<{ url: string; width: number; height: number }>;
  };
  preview_url?: string;
  duration_ms: number;
  external_urls: { spotify: string };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
