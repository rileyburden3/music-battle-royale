import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Music, Play, Pause } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBattleSongs, submitRankings, getMyRankings } from '../services/api';
import { useBattleStore } from '../store/useBattleStore';
import { clsx } from 'clsx';
import { RatingSlider } from '../components/shared/RatingSlider';

interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  album_art_url?: string;
  preview_url?: string;
  duration_ms?: number;
}

const SCORE_LABELS: Record<number, { label: string; color: string; cssColor: string; emoji: string }> = {
  0:  { label: 'NOT RATED', color: 'text-gray-500',   cssColor: '#6b7280', emoji: '❓' },
  1:  { label: 'TRASH',     color: 'text-red-600',    cssColor: '#dc2626', emoji: '🗑️' },
  2:  { label: 'WEAK',      color: 'text-red-500',    cssColor: '#ef4444', emoji: '💀' },
  3:  { label: 'MEH',       color: 'text-orange-500', cssColor: '#f97316', emoji: '😑' },
  4:  { label: 'BASIC',     color: 'text-orange-400', cssColor: '#fb923c', emoji: '👎' },
  5:  { label: 'AVERAGE',   color: 'text-yellow-400', cssColor: '#facc15', emoji: '🤷' },
  6:  { label: 'DECENT',    color: 'text-yellow-300', cssColor: '#fde047', emoji: '👍' },
  7:  { label: 'SOLID',     color: 'text-lime-400',   cssColor: '#a3e635', emoji: '🔥' },
  8:  { label: 'BANGER',    color: 'text-green-400',  cssColor: '#4ade80', emoji: '⚡' },
  9:  { label: 'HEAT',      color: 'text-neon-cyan',  cssColor: '#00ffff', emoji: '👑' },
  10: { label: 'GOAT TIER', color: 'text-neon-amber', cssColor: '#ffb800', emoji: '🏆' },
};

export function VotingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { myRankings, updateRanking } = useBattleStore();
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [dragStartX, setDragStartX] = useState<number | null>(null);

  // Stop audio when leaving the page
  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([getBattleSongs(id), getMyRankings(id)]).then(([songsRes, rankRes]) => {
      const loadedSongs = songsRes.data.data || [];
      setSongs(loadedSongs);
      // Reset all to 0 first, then apply saved rankings only for songs that still exist
      const existingIds = new Set(loadedSongs.map((s: { id: string }) => s.id));
      loadedSongs.forEach((s: { id: string }) => updateRanking(s.id, 0));
      const existing = rankRes.data.data || [];
      existing
        .filter((r: { song_id: string }) => existingIds.has(r.song_id))
        .forEach((r: { song_id: string; score: number }) => updateRanking(r.song_id, r.score));
    }).catch(() => toast.error('Failed to load songs'))
      .finally(() => setLoading(false));
  }, [id]);

  const currentSong = songs[currentIdx];
  const currentScore = currentSong ? (myRankings[currentSong.id] ?? 0) : 0;
  const allRanked = songs.length > 0 && songs.every((s) => (myRankings[s.id] ?? 0) > 0);
  const ranked = songs.filter((s) => (myRankings[s.id] ?? 0) > 0).length;

  const scoreInfo = SCORE_LABELS[currentScore] || SCORE_LABELS[0];

  const stopAudio = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };

  const togglePreview = () => {
    if (!currentSong?.preview_url) { toast('No preview available'); return; }
    if (playing) {
      stopAudio();
    } else {
      if (!audioRef.current || audioRef.current.src !== currentSong.preview_url) {
        audioRef.current = new Audio(currentSong.preview_url);
        audioRef.current.volume = 0.6;
        audioRef.current.onended = () => setPlaying(false);
      }
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const goNext = () => {
    stopAudio();
    if (currentIdx < songs.length - 1) setCurrentIdx(currentIdx + 1);
  };

  const goPrev = () => {
    stopAudio();
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  };

  // Swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('input[type="range"]')) return;
    setDragStartX(e.touches[0].clientX);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStartX == null) return;
    const diff = dragStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 60) diff > 0 ? goNext() : goPrev();
    setDragStartX(null);
  };

  const handleSubmit = async () => {
    if (!allRanked) { toast.error('Rank all songs first!'); return; }
    stopAudio();
    setSubmitting(true);
    try {
      const rankings = songs.map((s) => ({ song_id: s.id, score: myRankings[s.id] }));
      const res = await submitRankings(id!, rankings);
      toast.success('Rankings submitted! 🔥');
      // If everyone has now voted, go straight to results
      if (res.data.meta?.all_ranked) {
        navigate(`/battle/${id}/results`);
      } else {
        setSubmitted(true);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Poll for battle completion after submitting votes
  useEffect(() => {
    if (!submitted || !id) return;
    const interval = setInterval(async () => {
      try {
        const { getBattle } = await import('../services/api');
        const res = await getBattle(id);
        const status = res.data.data?.status;
        if (status === 'completed') navigate(`/battle/${id}/results`);
      } catch { /* ignore */ }
    }, 1500);
    return () => clearInterval(interval);
  }, [submitted, id]);

  if (loading) {
    return <div className="page-container flex items-center justify-center"><div className="pixel-text text-neon-cyan text-xs animate-pulse-neon">LOADING...</div></div>;
  }

  if (submitted) {
    return (
      <div className="page-container flex flex-col items-center justify-center min-h-screen">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
          <div className="text-6xl mb-4">⚡</div>
          <h1 className="pixel-text text-neon-cyan text-sm mb-2">VOTES LOCKED!</h1>
          <p className="text-gray-400 text-sm mb-6">Waiting for all fighters to vote...</p>
          <div className="w-6 h-6 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <button onClick={() => navigate(`/battle/${id}`)} className="btn-ghost font-black">BACK TO LOBBY</button>
        </motion.div>
      </div>
    );
  }

  if (!currentSong) return null;

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col overflow-y-auto">
      {/* Progress header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="pixel-text text-neon-cyan text-[10px]">RANK THE SONGS</span>
          <span className="text-xs text-gray-500">{ranked}/{songs.length}</span>
        </div>
        {/* Song progress indicators */}
        <div className="flex gap-1.5">
          {songs.map((s, i) => {
            const isRated = (myRankings[s.id] ?? 0) > 0;
            const isCurrent = i === currentIdx;
            return (
              <button
                key={s.id}
                onClick={() => { stopAudio(); setCurrentIdx(i); }}
                className={clsx(
                  'flex-1 rounded-full transition-all duration-200 flex items-center justify-center',
                  isCurrent ? 'h-6 bg-neon-cyan shadow-neon-cyan' : isRated ? 'h-6 bg-neon-cyan/30 border border-neon-cyan/50' : 'h-2 bg-dark-500',
                )}
              >
                {(isCurrent || isRated) && (
                  <span className="text-[9px] font-black text-dark-900">
                    {isRated ? '✓' : '•'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Song card - swipeable */}
      <div
        className="flex flex-col items-center px-4 pb-36"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSong.id}
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-sm"
          >
            {/* Album art */}
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden mb-3 bg-dark-700">
              {currentSong.album_art_url ? (
                <img src={currentSong.album_art_url} alt={currentSong.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music size={48} className="text-gray-600" />
                </div>
              )}
              {/* Play preview overlay */}
              <button
                onClick={togglePreview}
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
              >
                <div className={clsx(
                  'w-14 h-14 rounded-full border-4 flex items-center justify-center backdrop-blur-sm transition-all',
                  playing ? 'border-neon-cyan bg-neon-cyan/20' : 'border-white/60 bg-black/30'
                )}>
                  {playing
                    ? <Pause size={20} className="text-neon-cyan" />
                    : <Play size={20} className="text-white ml-1" />
                  }
                </div>
              </button>
              {/* Song number badge */}
              <div className="absolute top-2 left-2 bg-dark-900/80 backdrop-blur-sm px-2 py-1 rounded-lg">
                <span className="text-xs text-gray-400 font-bold">{currentIdx + 1} / {songs.length}</span>
              </div>
              {(myRankings[currentSong.id] ?? 0) > 0 && (
                <div className="absolute top-2 right-2 bg-dark-900/80 backdrop-blur-sm px-2 py-1 rounded-lg">
                  <span className={`text-xs font-black ${SCORE_LABELS[myRankings[currentSong.id]]?.color}`}>
                    {myRankings[currentSong.id]}/10
                  </span>
                </div>
              )}
            </div>

            {/* Song info */}
            <div className="text-center mb-3">
              <h2 className="text-lg font-black text-white leading-tight">{currentSong.title}</h2>
              <p className="text-gray-400 text-sm">{currentSong.artist}</p>
            </div>

            {/* Streaming links */}
            <div className="flex gap-2 mb-3">
              {[
                { label: 'Spotify', href: `https://open.spotify.com/search/${encodeURIComponent(currentSong.title + ' ' + currentSong.artist)}`, color: 'bg-green-600/20 text-green-400 border-green-600/30' },
                { label: 'Apple', href: `https://music.apple.com/search?term=${encodeURIComponent(currentSong.title + ' ' + currentSong.artist)}`, color: 'bg-pink-600/20 text-pink-400 border-pink-600/30' },
                { label: 'YouTube', href: `https://www.youtube.com/results?search_query=${encodeURIComponent(currentSong.title + ' ' + currentSong.artist)}`, color: 'bg-red-600/20 text-red-400 border-red-600/30' },
              ].map(({ label, href, color }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                  className={`flex-1 text-center text-[10px] font-bold py-1.5 rounded-lg border transition-all ${color}`}>
                  {label}
                </a>
              ))}
            </div>

            {/* Score display */}
            <div className="text-center mb-3">
              <motion.div
                key={currentScore}
                initial={{ scale: 1.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex items-center gap-2"
              >
                <span className="text-3xl">{scoreInfo.emoji}</span>
                <div className={`font-black ${scoreInfo.color} pixel-text`} style={{ fontSize: '12px' }}>
                  {scoreInfo.label}
                </div>
              </motion.div>
            </div>

            {/* Slider */}
            <RatingSlider
              value={currentScore}
              onChange={(v) => updateRanking(currentSong.id, v)}
              color={scoreInfo.cssColor}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Fixed bottom controls — always visible above the nav bar */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 z-40">
        {/* Navigation row */}
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={goPrev}
            disabled={currentIdx === 0}
            className="btn-ghost flex-1 gap-2 disabled:opacity-30 py-2 min-h-[44px]"
          >
            <ArrowLeft size={16} />
            Prev
          </button>

          {currentIdx < songs.length - 1 ? (
            <button onClick={goNext} className="btn-primary flex-1 gap-2 font-bold py-2 min-h-[44px]">
              Next
              <ArrowRight size={16} />
            </button>
          ) : allRanked ? (
            // All ranked on last song — nudge back to start so the fixed CTA is the clear action
            <button onClick={() => { stopAudio(); setCurrentIdx(0); }} className="btn-ghost flex-1 gap-2 py-2 min-h-[44px]">
              <ArrowLeft size={16} />
              Song 1
            </button>
          ) : (
            <button disabled className="btn-ghost flex-1 py-2 min-h-[44px] opacity-40 cursor-not-allowed">
              {`${ranked}/${songs.length} ranked`}
            </button>
          )}
        </div>

        {/* Full lock-in CTA once all ranked */}
        {allRanked && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary w-full font-black bg-neon-cyan shadow-neon-cyan"
            >
              {submitting ? 'SUBMITTING...' : 'LOCK IN ALL VOTES 🔥'}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
