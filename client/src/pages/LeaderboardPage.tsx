import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Music, User, ExternalLink } from 'lucide-react';
import { getLeaderboard, getMyRank, getSongLeaderboard } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { clsx } from 'clsx';

type Period = 'weekly' | 'monthly' | 'all_time';
type Tab = 'players' | 'songs';

interface Player {
  id: string;
  username: string;
  display_name: string;
  emblem: string;
  total_points: number;
  battles_won: number;
  battles_played: number;
  rank: number;
}

interface SongEntry {
  title: string;
  artist: string;
  album_art_url?: string;
  avg_score: number;
  total_votes: number;
  battles_won: number;
}

export function LeaderboardPage() {
  const { appUser } = useAuthStore();
  const [tab, setTab] = useState<Tab>('players');
  const [period, setPeriod] = useState<Period>('all_time');
  const [players, setPlayers] = useState<Player[]>([]);
  const [songs, setSongs] = useState<SongEntry[]>([]);
  const [myRank, setMyRank] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSongIdx, setExpandedSongIdx] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getLeaderboard(period),
      getSongLeaderboard(),
      getMyRank(),
    ]).then(([lbRes, songRes, myRes]) => {
      setPlayers(lbRes.data.data || []);
      setSongs(songRes.data.data || []);
      setMyRank(myRes.data.data || null);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [period]);

  const getRankStyle = (rank: number) => {
    if (rank === 1) return 'text-neon-amber';
    if (rank === 2) return 'text-gray-400';
    if (rank === 3) return 'text-orange-600';
    return 'text-gray-600';
  };

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return '👑';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div className="page-container">
      <div className="flex items-center gap-2 mb-6">
        <Trophy size={20} className="text-neon-amber" />
        <h1 className="pixel-text text-neon-amber text-xs">LEADERBOARD</h1>
      </div>

      {/* My rank card */}
      {myRank && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-glow mb-4 flex items-center gap-3"
        >
          <span className="text-2xl">{appUser?.emblem}</span>
          <div className="flex-1">
            <p className="font-bold text-white text-sm">{appUser?.display_name}</p>
            <p className="text-xs text-gray-500">@{appUser?.username}</p>
          </div>
          <div className="text-right">
            <p className={`font-black text-xl ${getRankStyle(myRank.rank)}`}>{getRankEmoji(myRank.rank)}</p>
            <p className="text-xs text-neon-cyan">{myRank.total_points} pts</p>
          </div>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-700 rounded-lg p-1 mb-4">
        <button
          onClick={() => setTab('players')}
          className={clsx('flex-1 py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1',
            tab === 'players' ? 'bg-neon-amber text-dark-900' : 'text-gray-500 hover:text-white')}
        >
          <User size={12} /> Players
        </button>
        <button
          onClick={() => setTab('songs')}
          className={clsx('flex-1 py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1',
            tab === 'songs' ? 'bg-neon-magenta text-dark-900' : 'text-gray-500 hover:text-white')}
        >
          <Music size={12} /> Songs
        </button>
      </div>

      {/* Period filter (players only) */}
      {tab === 'players' && (
        <>
          <div className="flex gap-1 mb-1">
            {(['weekly', 'monthly', 'all_time'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={clsx(
                  'flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                  period === p
                    ? 'border-neon-amber text-neon-amber bg-neon-amber/10'
                    : 'border-dark-500 text-gray-500 hover:border-dark-400'
                )}
              >
                {p === 'all_time' ? 'All Time' : p === 'weekly' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-700 mb-3 text-right">Player rankings only</p>
        </>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card animate-pulse h-16 bg-dark-700" />
          ))}
        </div>
      ) : tab === 'players' ? (
        <div className="space-y-2">
          {players.length === 0 ? (
            <div className="card text-center py-8 text-gray-500">
              <Trophy size={32} className="mx-auto mb-2 opacity-30" />
              <p>No rankings yet. Start battling!</p>
            </div>
          ) : (
            players.map((player, i) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={clsx(
                  'card flex items-center gap-3',
                  player.id === appUser?.id && 'border-neon-cyan/30 bg-neon-cyan/5'
                )}
              >
                <div className={clsx('w-8 text-center font-black', getRankStyle(player.rank))}>
                  {typeof player.rank === 'number' && player.rank <= 3 ? getRankEmoji(player.rank) : `#${player.rank}`}
                </div>
                <span className="text-xl">{player.emblem}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">{player.display_name}</p>
                  <p className="text-xs text-gray-500">@{player.username} · {player.battles_played} battles</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-neon-amber text-base">{player.total_points}</p>
                  <p className="text-xs text-gray-600">pts</p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {songs.length === 0 ? (
            <div className="card text-center py-8 text-gray-500">
              <Music size={32} className="mx-auto mb-2 opacity-30" />
              <p>No song rankings yet</p>
            </div>
          ) : (
            songs.map((song, i) => {
              const isExpanded = expandedSongIdx === i;
              const q = encodeURIComponent(`${song.title} ${song.artist}`);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="card"
                >
                  <div className="flex items-center gap-3">
                    <div className={clsx('w-8 text-center font-black', getRankStyle(i + 1))}>
                      {i < 3 ? getRankEmoji(i + 1) : `#${i + 1}`}
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-dark-600 overflow-hidden flex-shrink-0">
                      {song.album_art_url && <img src={song.album_art_url} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm truncate">{song.title}</p>
                      <p className="text-xs text-gray-500 truncate">{song.artist}</p>
                      <p className="text-xs text-gray-600">{song.total_votes} votes</p>
                    </div>
                    <div className="text-right mr-2">
                      <p className="font-black text-neon-cyan text-base">{Number(song.avg_score).toFixed(1)}</p>
                      <p className="text-xs text-gray-600">avg</p>
                      {song.battles_won > 0 && (
                        <p className="text-xs text-neon-amber">🏆 {song.battles_won}x</p>
                      )}
                    </div>
                    <button
                      onClick={() => setExpandedSongIdx(isExpanded ? null : i)}
                      className={clsx(
                        'w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 transition-all',
                        isExpanded
                          ? 'border-neon-magenta text-neon-magenta bg-neon-magenta/10'
                          : 'border-dark-400 text-gray-500 hover:border-neon-magenta hover:text-neon-magenta'
                      )}
                    >
                      <ExternalLink size={13} />
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="flex gap-2 mt-2">
                      <a href={`https://open.spotify.com/search/${q}`} target="_blank" rel="noopener noreferrer"
                        className="flex-1 text-center text-[10px] font-bold py-1.5 rounded-lg bg-green-600/20 text-green-400 border border-green-600/30">
                        Spotify
                      </a>
                      <a href={`https://music.apple.com/search?term=${q}`} target="_blank" rel="noopener noreferrer"
                        className="flex-1 text-center text-[10px] font-bold py-1.5 rounded-lg bg-pink-600/20 text-pink-400 border border-pink-600/30">
                        Apple
                      </a>
                      <a href={`https://www.youtube.com/results?search_query=${q}`} target="_blank" rel="noopener noreferrer"
                        className="flex-1 text-center text-[10px] font-bold py-1.5 rounded-lg bg-red-600/20 text-red-400 border border-red-600/30">
                        YouTube
                      </a>
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
