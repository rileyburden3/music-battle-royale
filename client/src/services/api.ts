import axios from 'axios';
import { auth } from './firebase';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
});

// Attach Firebase token to every request
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.error || err.message || 'Something went wrong';
    return Promise.reject(new Error(msg));
  }
);

// ── Users ──────────────────────────────────────────────
export const initUser = () => api.post('/users/init');
export const getMe = () => api.get('/users/me');
export const updateMe = (data: object) => api.put('/users/me', data);
export const createProfile = (data: object) => api.post('/users/profile', data);
export const checkUsername = (username: string) => api.get(`/users/check-username/${username}`);
export const getEmblems = () => api.get('/users/emblems');
export const getGenres = () => api.get('/users/genres');
export const getUserProfile = (username: string) => api.get(`/users/${username}`);
export const searchUsers = (q: string) => api.get(`/users/search?q=${encodeURIComponent(q)}`);

// ── Battles ────────────────────────────────────────────
export const createBattle = (data: object) => api.post('/battles', data);
export const getBattles = () => api.get('/battles');
export const getBattle = (id: string) => api.get(`/battles/${id}`);
export const joinBattle = (code: string) => api.post(`/battles/join/${code}`);
export const inviteFriends = (id: string, usernames: string[]) => api.post(`/battles/${id}/invite`, { usernames });
export const startSubmissions = (id: string) => api.post(`/battles/${id}/start-submissions`);
export const startVoting = (id: string) => api.post(`/battles/${id}/start-voting`);
export const calculateResults = (id: string) => api.post(`/battles/${id}/calculate`);
export const getBracket = (id: string) => api.get(`/battles/${id}/bracket`);
export const getBattleResults = (id: string) => api.get(`/battles/${id}/results`);
export const deleteBattle = (id: string) => api.delete(`/battles/${id}`);
export const acceptBattleInvite = (id: string) => api.post(`/battles/${id}/accept`);

// ── Songs ──────────────────────────────────────────────
export const searchSongs = (q: string) => api.get(`/songs/search?q=${encodeURIComponent(q)}`);
export const getBattleSongs = (battleId: string) => api.get(`/songs/battle/${battleId}`);
export const submitSongs = (battleId: string, songs: object[]) => api.post(`/songs/battle/${battleId}`, { songs });
export const deleteSong = (id: string) => api.delete(`/songs/${id}`);
export const getDemoSongs = () => api.get('/songs/demo');

// ── Rankings ───────────────────────────────────────────
export const submitRankings = (battleId: string, rankings: object[]) =>
  api.post(`/rankings/battle/${battleId}`, { rankings });
export const getMyRankings = (battleId: string) => api.get(`/rankings/battle/${battleId}/my`);
export const getScores = (battleId: string) => api.get(`/rankings/battle/${battleId}/scores`);

// ── Leaderboard ────────────────────────────────────────
export const getLeaderboard = (period = 'all_time') => api.get(`/leaderboard?period=${period}`);
export const getMyRank = () => api.get('/leaderboard/me');
export const getSongLeaderboard = () => api.get('/leaderboard/songs');

// ── Notifications ──────────────────────────────────────
export const getNotifications = () => api.get('/notifications');
export const markAllRead = () => api.put('/notifications/read-all');
export const markRead = (id: string) => api.put(`/notifications/${id}/read`);
export const deleteNotification = (id: string) => api.delete(`/notifications/${id}`);

export default api;
