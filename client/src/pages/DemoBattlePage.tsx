import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Play, Pause } from 'lucide-react';
import { getDemoSongs } from '../services/api';
import toast from 'react-hot-toast';
import { RatingSlider } from '../components/shared/RatingSlider';
import { FightAnimation } from '../components/animations/FightAnimation';
import { clsx } from 'clsx';

interface Song {
  id: string;
  title: string;
  artist: string;
  album_art_url?: string;
  preview_url?: string;
}

type SongWithScore = Song & { score: number };

interface DemoMatch {
  id: string;
  round: number;
  match_number: number;
  song1: SongWithScore;
  song2: SongWithScore;
  winner: SongWithScore;
  loser: SongWithScore;
}

const SCORE_LABELS: Record<number, { label: string; emoji: string; color: string }> = {
  0: { label: 'NOT RATED', emoji: '❓', color: '#6b7280' },
  1: { label: 'TRASH', emoji: '🗑️', color: '#dc2626' },
  2: { label: 'WEAK', emoji: '💀', color: '#ef4444' },
  3: { label: 'MEH', emoji: '😑', color: '#f97316' },
  4: { label: 'BASIC', emoji: '👎', color: '#fb923c' },
  5: { label: 'AVERAGE', emoji: '🤷', color: '#facc15' },
  6: { label: 'DECENT', emoji: '👍', color: '#fde047' },
  7: { label: 'SOLID', emoji: '🔥', color: '#4ade80' },
  8: { label: 'BANGER', emoji: '⚡', color: '#34d399' },
  9: { label: 'HEAT', emoji: '👑', color: '#00ffff' },
  10: { label: 'GOAT TIER', emoji: '🏆', color: '#ffb800' },
};

const ROUND_LABELS: Record<number, string> = { 1: 'ROUND 1', 2: 'SEMI-FINAL', 3: '⚔️ CHAMPIONSHIP' };

// ── Build a standard 8-team bracket from best-first sorted songs ───────────
function makeDemoMatch(
  id: string, round: number, matchNum: number,
  s1: SongWithScore, s2: SongWithScore,
): DemoMatch {
  const winner = s1.score >= s2.score ? s1 : s2;
  const loser  = s1.score >= s2.score ? s2 : s1;
  return { id, round, match_number: matchNum, song1: s1, song2: s2, winner, loser };
}

function computeDemoBracket(sorted: SongWithScore[]): DemoMatch[] {
  // Standard 8-team seeding: 1v8, 4v5, 2v7, 3v6
  const r1 = [
    makeDemoMatch('r1m1', 1, 1, sorted[0], sorted[7]),
    makeDemoMatch('r1m2', 1, 2, sorted[3], sorted[4]),
    makeDemoMatch('r1m3', 1, 3, sorted[1], sorted[6]),
    makeDemoMatch('r1m4', 1, 4, sorted[2], sorted[5]),
  ];
  const r2 = [
    makeDemoMatch('r2m1', 2, 1, r1[0].winner, r1[1].winner),
    makeDemoMatch('r2m2', 2, 2, r1[2].winner, r1[3].winner),
  ];
  const r3 = [makeDemoMatch('r3m1', 3, 1, r2[0].winner, r2[1].winner)];
  return [...r1, ...r2, ...r3];
}

// ── Compact match card for the 3-column bracket ───────────────────────────
function DemoBracketCard({
  match, isFinal, isSelected, onSelect,
}: {
  match: DemoMatch; isFinal?: boolean; isSelected?: boolean; onSelect?: () => void;
}) {
  const Slot = ({ song, wins }: { song: SongWithScore; wins: boolean }) => (
    <div className={clsx('flex items-center gap-1 px-1.5 py-1', wins ? 'bg-dark-600' : 'opacity-40')}>
      <div className="w-5 h-5 rounded-sm overflow-hidden flex-shrink-0 bg-dark-700">
        {song.album_art_url
          ? <img src={song.album_art_url} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-[8px]">🎵</div>}
      </div>
      <span className={clsx('text-[9px] font-bold truncate flex-1 min-w-0', wins ? 'text-white' : 'text-gray-600')}>
        {song.title}
      </span>
      <span className={clsx('text-[9px] font-black flex-shrink-0 ml-0.5', wins ? 'text-neon-cyan' : 'text-gray-700')}>
        {song.score}/10
      </span>
    </div>
  );

  return (
    <button
      onClick={onSelect}
      className={clsx(
        'w-full rounded-lg overflow-hidden border text-left transition-colors',
        isSelected
          ? (isFinal ? 'border-neon-amber shadow-[0_0_6px_rgba(255,184,0,0.3)]' : 'border-neon-cyan shadow-[0_0_6px_rgba(0,255,255,0.2)]')
          : (isFinal ? 'border-neon-amber/30' : 'border-dark-500'),
      )}
    >
      <Slot song={match.song1} wins={match.winner.id === match.song1.id} />
      <div className="flex items-center bg-dark-900 px-1.5 py-0.5">
        <div className="h-px flex-1 bg-dark-700" />
        <span className="text-[6px] text-gray-700 font-black px-1">VS</span>
        <div className="h-px flex-1 bg-dark-700" />
      </div>
      <Slot song={match.song2} wins={match.winner.id === match.song2.id} />
    </button>
  );
}

type Phase = 'intro' | 'voting' | 'results';

export function DemoBattlePage() {
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [champion, setChampion] = useState<{ s1: Song; s2: Song } | null>(null);
  const [demoBracket, setDemoBracket] = useState<DemoMatch[]>([]);
  const [selectedDemoMatchId, setSelectedDemoMatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePreview = () => {
    if (!currentSong?.preview_url) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      if (audioRef.current) { audioRef.current.pause(); }
      audioRef.current = new Audio(currentSong.preview_url);
      audioRef.current.volume = 0.7;
      audioRef.current.play();
      setPlaying(true);
      audioRef.current.onended = () => setPlaying(false);
    }
  };

  // Stop audio when switching songs
  useEffect(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, [currentIdx]);

  // Stop audio when leaving the page
  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  useEffect(() => {
    getDemoSongs()
      .then((res) => {
        const data = res.data.data;
        if (data && data.length > 0) {
          setSongs(data);
          setScores(Object.fromEntries(data.map((s: Song) => [s.id, 0])));
        } else { throw new Error('empty'); }
      })
      .catch(() => {
        const fallback = [
          { id: '1', title: 'HUMBLE.', artist: 'Kendrick Lamar', album_art_url: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/ab/16/ef/ab16efe9-e7f1-66ec-021c-5592a23f0f9e/17UMGIM88793.rgb.jpg/500x500bb.jpg', preview_url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/30/3f/27/303f27c8-1997-8c57-66b3-b67e7c720779/mzaf_5598476068977070849.plus.aac.p.m4a' },
          { id: '2', title: 'Blinding Lights', artist: 'The Weeknd', album_art_url: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/a6/6e/bf/a66ebf79-5008-8948-b352-a790fc87446b/19UM1IM04638.rgb.jpg/500x500bb.jpg', preview_url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/17/b4/8f/17b48f9a-0b93-6bb8-fe1d-3a16623c2cfb/mzaf_9560252727299052414.plus.aac.p.m4a' },
          { id: '3', title: 'Bad Guy', artist: 'Billie Eilish', album_art_url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1a/37/d1/1a37d1b1-8508-54f2-f541-bf4e437dda76/19UMGIM05028.rgb.jpg/500x500bb.jpg', preview_url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/c3/87/1f/c3871f7e-3260-d615-1c66-5fdca2c3a48f/mzaf_10721331211699880949.plus.aac.p.m4a' },
          { id: '4', title: 'Levitating', artist: 'Dua Lipa', album_art_url: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/6c/11/d6/6c11d681-aa3a-d59e-4c2e-f77e181026ab/190295092665.jpg/500x500bb.jpg', preview_url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/59/dc/4d/59dc4dda-93ff-8f1c-c536-f005f6ea6af5/mzaf_3066686759813252385.plus.aac.p.m4a' },
          { id: '5', title: 'MONTERO', artist: 'Lil Nas X', album_art_url: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/8d/ef/37/8def37cf-f641-1bba-f312-61a9b8d19fbf/886449068029.jpg/500x500bb.jpg', preview_url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview124/v4/6e/cd/99/6ecd9966-bbe2-36b5-35f1-cd8ed6406906/mzaf_3486740843482888093.plus.aac.p.m4a' },
          { id: '6', title: 'Peaches', artist: 'Justin Bieber', album_art_url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e0/92/da/e092da2d-9f6d-11dc-7843-2021e95a2b61/21UMGIM17518.rgb.jpg/500x500bb.jpg', preview_url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/c9/6d/b1/c96db138-df15-d3d1-ef9d-98ef9d350960/mzaf_9411021956242812289.plus.aac.p.m4a' },
          { id: '7', title: 'drivers license', artist: 'Olivia Rodrigo', album_art_url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/02/ed/8c/02ed8cab-c089-2fdd-7ce6-ab334a9a4e19/21UMGIM26093.rgb.jpg/500x500bb.jpg', preview_url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/36/62/61/366261be-0996-d73d-de6f-03417867c800/mzaf_8201528327761821135.plus.aac.p.m4a' },
          { id: '8', title: 'Anti-Hero', artist: 'Taylor Swift', album_art_url: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/3d/01/f2/3d01f2e5-5a08-835f-3d30-d031720b2b80/22UM1IM07364.rgb.jpg/500x500bb.jpg', preview_url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/1d/56/2a/1d562a07-dc5f-a9c0-1f36-2051a8c14eb7/mzaf_7214829135431340590.plus.aac.p.m4a' },
        ];
        setSongs(fallback);
        setScores(Object.fromEntries(fallback.map((s) => [s.id, 0])));
      })
      .finally(() => setLoading(false));
  }, []);

  const currentSong = songs[currentIdx];
  const currentScore = currentSong ? (scores[currentSong.id] ?? 0) : 0;
  const allRanked = songs.length > 0 && songs.every((s) => (scores[s.id] ?? 0) > 0);
  const ranked = songs.filter((s) => (scores[s.id] ?? 0) > 0).length;
  const scoreInfo = SCORE_LABELS[currentScore];

  const computeResults = () => {
    if (songs.length < 8) {
      toast.error('Not enough songs loaded to calculate results');
      return;
    }
    const sorted = [...songs].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
    const bracket = computeDemoBracket(sorted.map(s => ({ ...s, score: scores[s.id] ?? 0 })));
    setChampion({ s1: sorted[0], s2: sorted[1] });
    setDemoBracket(bracket);
    setSelectedDemoMatchId('r3m1');
    setPhase('results');
    if (sorted[0]?.preview_url) {
      audioRef.current?.pause();
      audioRef.current = new Audio(sorted[0].preview_url);
      audioRef.current.volume = 0.5;
      audioRef.current.play().catch(() => {});
    }
  };

  // Derive fight preview for the bracket panel
  const selectedDemoMatch = demoBracket.find(m => m.id === selectedDemoMatchId) ?? null;
  const demoFightIsFinal = selectedDemoMatch?.round === 3;

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <p className="pixel-text text-neon-cyan text-xs animate-pulse-neon">LOADING...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900">
      <button onClick={() => navigate('/')} className="absolute top-6 left-4 text-gray-500 hover:text-white text-sm z-20">← Back</button>
      <AnimatePresence mode="wait">

        {/* ── INTRO ── */}
        {phase === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-screen px-6 text-center relative"
          >
            <div
              className="absolute inset-0 opacity-10"
              style={{ backgroundImage: 'linear-gradient(#00ffff 1px, transparent 1px), linear-gradient(90deg, #00ffff 1px, transparent 1px)', backgroundSize: '40px 40px' }}
            />
            <motion.div className="relative z-10 max-w-sm w-full">
              <motion.div
                animate={{ y: [-6, 6, -6] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="text-7xl mb-6"
              >
                🥊
              </motion.div>
              <h1 className="pixel-text text-neon-cyan text-sm mb-2 leading-relaxed">DEMO BATTLE</h1>
              <p className="text-gray-400 text-sm mb-1">8 banger tracks.</p>
              <p className="text-gray-400 text-sm mb-8">Only one can reign champion.</p>
              <div className="card mb-6 text-left">
                <p className="text-xs text-gray-500 font-bold mb-2 uppercase tracking-wide">How it works</p>
                <ul className="text-sm text-gray-400 space-y-1.5">
                  <li>⚡ Rate each song 1-10</li>
                  <li>👑 Highest score wins the crown</li>
                  <li>⚔️ Watch the Street Fighter battle</li>
                </ul>
              </div>
              <button onClick={() => setPhase('voting')} className="btn-primary w-full font-black text-base">
                LET'S GO 🔥
              </button>
              <button onClick={() => navigate('/signup')} className="btn-ghost w-full mt-3">
                Create a real battle instead →
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* ── VOTING ── */}
        {phase === 'voting' && currentSong && (
          <motion.div
            key="voting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col px-4 pt-4 pb-8 max-w-sm mx-auto"
          >
            {/* Header */}
            <div className="flex items-center mb-3">
              <div className="flex-1" />
              <span className="pixel-text text-neon-cyan text-[10px]">DEMO BATTLE</span>
              <div className="flex-1 flex justify-end">
                <span className="text-xs text-gray-500">{ranked}/{songs.length} ranked</span>
              </div>
            </div>

            {/* Progress indicators */}
            <div className="flex gap-1.5 mb-4">
              {songs.map((s, i) => {
                const isRated = (scores[s.id] ?? 0) > 0;
                const isCurrent = i === currentIdx;
                return (
                  <button
                    key={s.id}
                    onClick={() => setCurrentIdx(i)}
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

            {/* Album art */}
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden mb-4 bg-dark-700">
              {currentSong.album_art_url ? (
                <img
                  src={currentSong.album_art_url}
                  alt={currentSong.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    target.parentElement!.innerHTML = `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#1a1a2e,#16213e);gap:8px"><span style="font-size:4rem">🎵</span><span style="color:#9ca3af;font-size:0.75rem;text-align:center;padding:0 1rem">${currentSong.title}</span></div>`;
                  }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg,#1a1a2e,#16213e)' }}>
                  <span className="text-6xl">🎵</span>
                  <span className="text-gray-400 text-xs text-center px-4">{currentSong.title}</span>
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
              {scores[currentSong.id] != null && (
                <div className="absolute top-3 right-3 bg-dark-900/80 backdrop-blur-sm px-2 py-1 rounded-lg">
                  <span style={{ color: scoreInfo.color }} className="text-xs font-black">{scores[currentSong.id]}/10</span>
                </div>
              )}
              <div className="absolute top-3 left-3 bg-dark-900/80 backdrop-blur-sm px-2 py-1 rounded-lg">
                <span className="text-xs text-gray-400 font-bold">{currentIdx + 1} / {songs.length}</span>
              </div>
            </div>

            {/* Song info */}
            <div className="text-center mb-4">
              <h2 className="text-xl font-black">{currentSong.title}</h2>
              <p className="text-gray-400">{currentSong.artist}</p>
            </div>

            {/* Streaming links */}
            <div className="flex gap-2 mb-4">
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

            {/* Score label */}
            <div className="text-center mb-3">
              <motion.div key={currentScore} initial={{ scale: 1.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <span className="text-3xl">{scoreInfo.emoji}</span>
                <p className="pixel-text text-xs mt-1" style={{ color: scoreInfo.color }}>{scoreInfo.label}</p>
              </motion.div>
            </div>

            {/* Slider */}
            <RatingSlider
              value={currentScore}
              onChange={(v) => setScores((prev) => ({ ...prev, [currentSong.id]: v }))}
              color={scoreInfo.color}
            />

            {/* Nav */}
            <div className="flex gap-3 mt-auto">
              <button onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))} disabled={currentIdx === 0}
                className="btn-ghost flex-1 disabled:opacity-30">← Prev</button>
              {currentIdx < songs.length - 1 ? (
                <button onClick={() => setCurrentIdx(currentIdx + 1)} className="btn-primary flex-1 font-bold">Next →</button>
              ) : (
                <button onClick={() => setCurrentIdx(0)} className="btn-ghost flex-1 font-bold" disabled={allRanked}>
                  ← Back to #1
                </button>
              )}
            </div>

            {/* Sticky submit */}
            {allRanked && (
              <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="fixed bottom-0 left-0 right-0 p-4 bg-dark-900/95 backdrop-blur-sm border-t border-dark-600 z-10"
              >
                <button onClick={computeResults} className="btn-primary w-full font-black max-w-sm mx-auto block">
                  SEE RESULTS 🏆
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── RESULTS ── */}
        {phase === 'results' && champion && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-4 pt-6 pb-10 max-w-sm mx-auto"
          >
            <h1 className="pixel-text text-neon-amber text-xs text-center mb-4">BATTLE RESULTS</h1>

            {/* Champion card — matches ResultsPage style */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="card-glow mb-4 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-neon-amber/10 to-transparent" />
              <div className="relative z-10 flex items-center gap-3">
                {champion.s1.album_art_url && (
                  <img src={champion.s1.album_art_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="pixel-text text-neon-amber text-[9px] mb-0.5">👑 CHAMPION</p>
                  <p className="font-black text-white text-base leading-tight truncate">{champion.s1.title}</p>
                  <p className="text-gray-400 text-xs truncate">{champion.s1.artist}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-neon-cyan font-black text-lg">{scores[champion.s1.id]}/10</p>
                  <p className="text-gray-500 text-[10px]">your score</p>
                </div>
              </div>
            </motion.div>

            {/* Fight animation — championship match */}
            <div className="mb-5">
              <p className="pixel-text text-neon-amber text-[9px] text-center tracking-widest mb-2">⚔️ CHAMPIONSHIP</p>
              <FightAnimation
                song1={{ title: champion.s1.title, artist: champion.s1.artist, album_art_url: champion.s1.album_art_url, avg_score: scores[champion.s1.id] }}
                song2={{ title: champion.s2.title, artist: champion.s2.artist, album_art_url: champion.s2.album_art_url, avg_score: scores[champion.s2.id] }}
                winner="song1"
                autoPlay={true}
                isFinal={true}
              />
            </div>

            {/* Bracket */}
            <div className="mb-5">
              {/* Fight preview panel — updates on card tap */}
              {selectedDemoMatch && (
                <div className="mb-3 rounded-xl overflow-hidden border border-dark-500 bg-dark-800">
                  <div className={clsx(
                    'text-center py-1 border-b border-dark-700 pixel-text text-[7px] tracking-widest',
                    demoFightIsFinal ? 'text-neon-amber' : 'text-neon-cyan',
                  )}>
                    {ROUND_LABELS[selectedDemoMatch.round]}
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2">
                    {/* Winner */}
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <div className={clsx(
                        'w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-dark-700 border',
                        demoFightIsFinal ? 'border-neon-amber/50' : 'border-neon-cyan/40',
                      )}>
                        {selectedDemoMatch.winner.album_art_url
                          ? <img src={selectedDemoMatch.winner.album_art_url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center">🎵</div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-white truncate">{selectedDemoMatch.winner.title}</p>
                        <p className="text-[10px] text-gray-400 truncate">{selectedDemoMatch.winner.artist}</p>
                        <p className={clsx('text-[10px] font-black', demoFightIsFinal ? 'text-neon-amber' : 'text-neon-cyan')}>
                          {selectedDemoMatch.winner.score}/10
                        </p>
                      </div>
                    </div>
                    {/* VS */}
                    <div className="flex-shrink-0 flex flex-col items-center px-1">
                      <span className="text-sm leading-none">{demoFightIsFinal ? '👑' : '⚡'}</span>
                      <span className="pixel-text text-[6px] text-gray-600 mt-0.5">VS</span>
                    </div>
                    {/* Loser — same layout, dimmed */}
                    <div className="flex-1 min-w-0 flex items-center gap-2 opacity-35">
                      <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-dark-700 border border-dark-600">
                        {selectedDemoMatch.loser.album_art_url
                          ? <img src={selectedDemoMatch.loser.album_art_url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center">🎵</div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-gray-400 truncate">{selectedDemoMatch.loser.title}</p>
                        <p className="text-[10px] text-gray-500 truncate">{selectedDemoMatch.loser.artist}</p>
                        <p className="text-[10px] font-black text-gray-600">{selectedDemoMatch.loser.score}/10</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Column headers */}
              <div className="flex mb-1.5">
                <div className="flex-1 min-w-0 text-center pixel-text text-neon-cyan text-[6px] pb-1 border-b border-neon-cyan/20">R1</div>
                <div className="w-3 flex-shrink-0" />
                <div className="flex-1 min-w-0 text-center pixel-text text-neon-cyan text-[6px] pb-1 border-b border-neon-cyan/20">SEMIS</div>
                <div className="w-3 flex-shrink-0" />
                <div className="flex-1 min-w-0 text-center pixel-text text-neon-amber text-[6px] pb-1 border-b border-neon-amber/20">FINAL</div>
              </div>

              {/* 3-column bracket */}
              <div className="flex overflow-x-hidden" style={{ height: 290 }}>
                <div className="flex-1 min-w-0 flex flex-col justify-around">
                  {demoBracket.filter(m => m.round === 1).map(m => (
                    <DemoBracketCard key={m.id} match={m}
                      isSelected={selectedDemoMatchId === m.id}
                      onSelect={() => setSelectedDemoMatchId(m.id)} />
                  ))}
                </div>
                <div className="w-3 flex-shrink-0" />
                <div className="flex-1 min-w-0 flex flex-col justify-around">
                  {demoBracket.filter(m => m.round === 2).map(m => (
                    <DemoBracketCard key={m.id} match={m}
                      isSelected={selectedDemoMatchId === m.id}
                      onSelect={() => setSelectedDemoMatchId(m.id)} />
                  ))}
                </div>
                <div className="w-3 flex-shrink-0" />
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  {demoBracket.filter(m => m.round === 3).map(m => (
                    <DemoBracketCard key={m.id} match={m} isFinal
                      isSelected={selectedDemoMatchId === m.id}
                      onSelect={() => setSelectedDemoMatchId(m.id)} />
                  ))}
                </div>
              </div>

              <p className="text-center text-[9px] text-gray-700 mt-2">Tap any match to preview</p>
            </div>

            {/* Buttons */}
            <div className="space-y-3">
              <button
                onClick={() => {
                  setPhase('intro');
                  setScores({});
                  setCurrentIdx(0);
                  setDemoBracket([]);
                  setSelectedDemoMatchId(null);
                }}
                className="btn-secondary w-full"
              >
                Play Again 🔄
              </button>
              <button onClick={() => navigate('/signup')} className="btn-primary w-full font-black">
                BATTLE WITH FRIENDS 🔥
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
