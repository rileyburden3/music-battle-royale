import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, Plus, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { searchSongs, submitSongs, getBattle, getBattleSongs } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { SongCard } from '../components/shared/SongCard';

interface Song {
  spotify_id?: string;
  itunes_id?: string;
  title: string;
  artist: string;
  album?: string;
  album_art_url?: string;
  preview_url?: string;
  duration_ms?: number;
}

const songKey = (s: Song) => s.itunes_id ?? s.spotify_id ?? `${s.title}::${s.artist}`;
const takenKey = (s: Song) => `${s.title.toLowerCase()}::${s.artist.toLowerCase()}`;

export function SongSubmissionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuthStore();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [selectedSongs, setSelectedSongs] = useState<Song[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [songsPerPlayer, setSongsPerPlayer] = useState(2);
  const [submitted, setSubmitted] = useState(false);
  const [takenSongs, setTakenSongs] = useState<Set<string>>(new Set()); // "title::artist" keys already claimed

  useEffect(() => {
    if (!id || !appUser) return;
    // Load quota and any songs already submitted by other players
    Promise.all([getBattle(id), getBattleSongs(id)]).then(([battleRes, songsRes]) => {
      const me = (battleRes.data.data.participants ?? []).find(
        (p: { user_id: string; status: string }) => p.user_id === appUser.id && p.status === 'accepted'
      );
      setSongsPerPlayer(me?.songs_quota || 2);
      // Build a set of "title::artist" keys for songs already submitted by others
      const existing: Song[] = songsRes.data.data || [];
      const othersKeys = new Set(
        existing
          .filter((s: Song & { submitted_by?: string }) => s.submitted_by !== null && s.submitted_by !== undefined && s.submitted_by !== appUser.id)
          .map((s: Song) => `${s.title.toLowerCase()}::${s.artist.toLowerCase()}`)
      );
      setTakenSongs(othersKeys);
    });
  }, [id, appUser]);

  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchSongs(query);
        setSearchResults(res.data.data || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const addSong = (song: Song) => {
    if (takenSongs.has(takenKey(song))) {
      toast.error(`"${song.title}" was already submitted by another player`);
      return;
    }
    if (selectedSongs.length >= songsPerPlayer) {
      toast.error(`You can only submit ${songsPerPlayer} songs`);
      return;
    }
    if (selectedSongs.some((s) => songKey(s) === songKey(song))) {
      toast.error('Already added');
      return;
    }
    setSelectedSongs((prev) => [...prev, song]);
    toast.success(`Added: ${song.title}`);
  };

  const removeSong = (idx: number) => {
    setSelectedSongs((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (selectedSongs.length === 0) { toast.error('Add at least 1 song'); return; }
    setSubmitting(true);
    try {
      const res = await submitSongs(id!, selectedSongs);
      toast.success('Songs submitted! 🔥');
      // If all players have now submitted, voting starts automatically — go straight there
      if (res.data.meta?.voting_started) {
        navigate(`/battle/${id}/vote`);
      } else {
        setSubmitted(true);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Poll for voting start while waiting on submitted screen
  useEffect(() => {
    if (!submitted || !id) return;
    let attempts = 0;
    const MAX_ATTEMPTS = 30; // 30 × 4s = 2 minutes before showing stale warning
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await getBattle(id);
        const status = res.data.data?.status;
        if (status === 'voting') navigate(`/battle/${id}/vote`);
        else if (status === 'completed') navigate(`/battle/${id}/results`);
      } catch { /* ignore network blip */ }
      if (attempts >= MAX_ATTEMPTS) clearInterval(interval);
    }, 4000);
    return () => clearInterval(interval);
  }, [submitted, id]);

  // Derive whether we've been waiting too long (> 2 min) without a status change
  const [waitingTooLong, setWaitingTooLong] = useState(false);
  useEffect(() => {
    if (!submitted) return;
    const timeout = setTimeout(() => setWaitingTooLong(true), 120000);
    return () => clearTimeout(timeout);
  }, [submitted]);

  if (submitted) {
    return (
      <div className="page-container flex flex-col items-center justify-center min-h-screen">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-sm w-full"
        >
          <div className="text-6xl mb-4">🎵</div>
          <h1 className="pixel-text text-neon-cyan text-sm mb-2">SONGS SUBMITTED!</h1>
          <p className="text-gray-400 text-sm mb-6">
            {waitingTooLong
              ? 'Taking longer than expected...'
              : 'Your tracks are in the arena. Waiting for all players...'}
          </p>
          {waitingTooLong ? (
            <button onClick={() => navigate(`/battle/${id}`)} className="btn-primary mx-auto mb-4">
              Go to Lobby
            </button>
          ) : (
            <div className="w-6 h-6 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          )}
          <div className="space-y-2 mb-6">
            {selectedSongs.map((song) => (
              <SongCard key={song.spotify_id} song={song} compact />
            ))}
          </div>
          <button onClick={() => navigate(`/battle/${id}`)} className="btn-ghost w-full font-black">
            BACK TO LOBBY ⚔️
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(`/battle/${id}`)} className="text-gray-400 hover:text-white p-1">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="pixel-text text-neon-cyan text-xs">SUBMIT SONGS</h1>
          <p className="text-gray-500 text-xs">{selectedSongs.length}/{songsPerPlayer} selected</p>
        </div>
      </div>

      {/* Selected songs */}
      {selectedSongs.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Your Picks</p>
          <div className="space-y-2">
            {selectedSongs.map((song, i) => (
              <SongCard
                key={i}
                song={song}
                compact
                actions={
                  <button onClick={() => removeSong(i)} className="text-gray-500 hover:text-neon-red p-1">
                    <X size={16} />
                  </button>
                }
              />
            ))}
          </div>
          {selectedSongs.length >= songsPerPlayer && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3"
            >
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary w-full font-black gap-2"
              >
                <Check size={16} />
                {submitting ? 'SUBMITTING...' : `LOCK IN MY SONGS 🔥`}
              </button>
            </motion.div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search songs, artists, albums..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input-field pl-10"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>

      {/* Search results */}
      <AnimatePresence>
        {searchResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            <p className="text-xs text-gray-500 uppercase tracking-wide">Results</p>
            {searchResults.map((song) => {
              const alreadyAdded = selectedSongs.some((s) => songKey(s) === songKey(song));
              const isTaken = takenSongs.has(takenKey(song));
              const isFull = selectedSongs.length >= songsPerPlayer;
              return (
                <SongCard
                  key={songKey(song)}
                  song={song}
                  actions={
                    isTaken ? (
                      <span className="text-[10px] font-bold text-red-400 border border-red-500/30 rounded-full px-2 py-1 whitespace-nowrap">
                        Taken
                      </span>
                    ) : (
                      <button
                        onClick={() => !alreadyAdded && !isFull && addSong(song)}
                        disabled={alreadyAdded || isFull}
                        className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
                          alreadyAdded
                            ? 'border-green-500 text-green-500'
                            : isFull
                            ? 'border-dark-400 text-gray-600 cursor-not-allowed'
                            : 'border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10'
                        }`}
                      >
                        {alreadyAdded ? <Check size={14} /> : <Plus size={14} />}
                      </button>
                    )
                  }
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {!query && selectedSongs.length < songsPerPlayer && (
        <div className="text-center py-10 text-gray-600">
          <div className="text-4xl mb-3">🎵</div>
          <p className="text-sm">Search for songs to add to your battle</p>
          <p className="text-xs mt-1">You need {songsPerPlayer - selectedSongs.length} more song{songsPerPlayer - selectedSongs.length !== 1 ? 's' : ''}</p>
        </div>
      )}

      {selectedSongs.length > 0 && selectedSongs.length < songsPerPlayer && (
        <div className="fixed bottom-20 left-0 right-0 px-4 max-w-md mx-auto">
          <div className="card border-neon-amber/30 text-center py-2">
            <p className="text-neon-amber text-xs font-semibold">
              Add {songsPerPlayer - selectedSongs.length} more song{songsPerPlayer - selectedSongs.length !== 1 ? 's' : ''} to submit
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
