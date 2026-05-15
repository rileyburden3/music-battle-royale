import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBattleResults, calculateResults, getBattle, getMe } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { FightAnimation } from '../components/animations/FightAnimation';
import { SongCard } from '../components/shared/SongCard';
import { clsx } from 'clsx';

interface Song {
  id: string;
  title: string;
  artist: string;
  album_art_url?: string;
  preview_url?: string;
  avg_score?: number;
  battles_won?: number;
  submitter_name?: string;
  submitter_emblem?: string;
}

interface Match {
  id: string;
  round: number;
  match_number: number;
  song1_id: string;
  song2_id: string;
  winner_id: string;
  song1_avg_score: string;
  song2_avg_score: string;
  song1_title: string;
  song1_artist: string;
  song1_art?: string;
  song2_title: string;
  song2_artist: string;
  song2_art?: string;
  winner_title: string;
}

const ROUND_LABELS: Record<number, string> = { 1: 'ROUND 1', 2: 'SEMI-FINAL', 3: '⚔️ CHAMPIONSHIP' };

// ── Compact match card used in the 3-column bracket ───────────────────────
function BracketMatchCard({
  match, isFinal, isSelected, onSelect,
}: {
  match: Match; isFinal?: boolean; isSelected?: boolean; onSelect?: () => void;
}) {
  const s1wins = match.winner_id === match.song1_id;
  const s2wins = match.winner_id === match.song2_id;

  const Slot = ({ art, title, score, wins }: { art?: string; title: string; score: string; wins: boolean }) => (
    <div className={clsx('flex items-center gap-1 px-1.5 py-1', wins ? 'bg-dark-600' : 'opacity-40')}>
      <div className="w-5 h-5 rounded-sm overflow-hidden flex-shrink-0 bg-dark-700">
        {art
          ? <img src={art} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-[8px]">🎵</div>
        }
      </div>
      <span className={clsx('text-[9px] font-bold truncate flex-1 min-w-0', wins ? 'text-white' : 'text-gray-600')}>
        {title}
      </span>
      <span className={clsx('text-[9px] font-black flex-shrink-0 ml-0.5', wins ? 'text-neon-cyan' : 'text-gray-700')}>
        {parseFloat(score).toFixed(1)}
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
      <Slot art={match.song1_art} title={match.song1_title} score={match.song1_avg_score} wins={s1wins} />
      <div className="flex items-center bg-dark-900 px-1.5 py-0.5">
        <div className="h-px flex-1 bg-dark-700" />
        <span className="text-[6px] text-gray-700 font-black px-1">VS</span>
        <div className="h-px flex-1 bg-dark-700" />
      </div>
      <Slot art={match.song2_art} title={match.song2_title} score={match.song2_avg_score} wins={s2wins} />
    </button>
  );
}

export function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { appUser, setAppUser } = useAuthStore();
  const [songs, setSongs] = useState<Song[]>([]);
  const [bracket, setBracket] = useState<Match[]>([]);
  const [battle, setBattle] = useState<{ title: string; status: string; creator_id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [view, setView] = useState<'bracket' | 'scores'>('bracket');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasPlayedRef = useRef(false);

  // Stop audio when leaving the page
  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  useEffect(() => {
    if (!id) return;
    getBattle(id).then((res) => {
      const b = res.data.data;
      setBattle(b);
      if (b.status === 'completed') {
        loadResults();
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));
  }, [id]);

  const loadResults = async () => {
    try {
      const res = await getBattleResults(id!);
      const data = res.data.data;
      const loadedSongs: Song[] = data.songs || [];
      setSongs(loadedSongs);
      const bracketData: Match[] = data.bracket || [];
      setBracket(bracketData);
      const finalMatch = bracketData.find(m => m.round === 3);
      if (finalMatch) setSelectedMatchId(finalMatch.id);
      // Auto-play champion's preview once (guard prevents double-play from StrictMode)
      const champion = loadedSongs[0];
      if (champion?.preview_url && !hasPlayedRef.current) {
        hasPlayedRef.current = true;
        audioRef.current?.pause();
        audioRef.current = new Audio(champion.preview_url);
        audioRef.current.volume = 0.5;
        audioRef.current.play().catch(() => {});
      }
      // Refresh profile so points/stats reflect this battle result
      getMe().then((r) => setAppUser(r.data.data)).catch(() => {});
    } catch {
      toast.error('Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      await calculateResults(id!);
      await loadResults();
      setView('bracket');
      toast.success('Results calculated! 🏆');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Calculation failed');
    } finally {
      setCalculating(false);
    }
  };

  const champion = songs[0];
  const selectedMatch = bracket.find(m => m.id === selectedMatchId) ?? null;

  const getMatchSong = (match: Match, slot: 'song1' | 'song2') => ({
    title: match[`${slot}_title`],
    artist: match[`${slot}_artist`],
    album_art_url: match[`${slot}_art`],
    avg_score: parseFloat(match[`${slot}_avg_score`]),
  });

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center">
        <div className="pixel-text text-neon-cyan text-xs animate-pulse-neon">LOADING RESULTS...</div>
      </div>
    );
  }

  if (battle?.status === 'voting') {
    return (
      <div className="page-container flex flex-col items-center justify-center min-h-screen">
        <div className="text-center max-w-sm w-full">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="pixel-text text-neon-amber text-xs mb-2">VOTING IN PROGRESS</h1>
          <p className="text-gray-400 text-sm mb-6">Waiting for all fighters to submit their votes...</p>
          {battle.creator_id === appUser?.id && (
            <button onClick={handleCalculate} disabled={calculating} className="btn-primary w-full font-black">
              {calculating ? 'CALCULATING...' : 'FORCE CALCULATE RESULTS ⚡'}
            </button>
          )}
          <button onClick={() => navigate('/home')} className="btn-ghost w-full mt-3">Back to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container !pb-16">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/home')} className="text-gray-400 hover:text-white p-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-black text-white truncate">{battle?.title || 'Battle Results'}</h1>
      </div>

      {/* Champion banner */}
      {champion && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="card-glow mb-3 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-neon-amber/10 to-transparent" />
          <div className="relative z-10 flex items-center gap-3">
            {champion.album_art_url && (
              <img src={champion.album_art_url} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="pixel-text text-neon-amber text-[9px] mb-1">👑 CHAMPION</p>
              <p className="font-black text-white text-xl leading-tight truncate">{champion.title}</p>
              <p className="text-gray-300 text-sm truncate">{champion.artist}</p>
            </div>
            {champion.submitter_name && (
              <div className="flex-shrink-0 flex flex-col items-center gap-1 pr-1">
                <div className="w-9 h-9 rounded-full bg-dark-600 border border-neon-amber/40 flex items-center justify-center text-lg leading-none">
                  {champion.submitter_emblem}
                </div>
                <p className="text-[9px] text-white text-center max-w-[64px] truncate">{champion.submitter_name}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-700 rounded-lg p-1 mb-4">
        {(['bracket', 'scores'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={clsx(
              'flex-1 py-2 rounded-md text-xs font-bold transition-all',
              view === v ? 'bg-neon-cyan text-dark-900' : 'text-gray-500 hover:text-white'
            )}
          >
            {v === 'bracket' ? '🏆 Bracket' : '📊 Scores'}
          </button>
        ))}
      </div>

      {/* ── Bracket tab — fight animation + 3-column bracket ── */}
      {view === 'bracket' && (
        <div className="pb-4">
          {/* Fight animation — remounts when a new match card is tapped */}
          {selectedMatch && (
            <div className="mb-3">
              <p className={clsx(
                'pixel-text text-[7px] text-center tracking-widest mb-2',
                selectedMatch.round === 3 ? 'text-neon-amber' : 'text-neon-cyan',
              )}>
                {ROUND_LABELS[selectedMatch.round]}
              </p>
              <FightAnimation
                key={selectedMatchId}
                song1={getMatchSong(selectedMatch, 'song1')}
                song2={getMatchSong(selectedMatch, 'song2')}
                winner={selectedMatch.winner_id === selectedMatch.song1_id ? 'song1' : 'song2'}
                autoPlay={true}
                isFinal={selectedMatch.round === 3}
              />
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

          <div className="flex overflow-x-hidden" style={{ height: 290 }}>
            <div className="flex-1 min-w-0 flex flex-col justify-around">
              {bracket.filter(m => m.round === 1).map(m => (
                <BracketMatchCard key={m.id} match={m}
                  isSelected={selectedMatchId === m.id}
                  onSelect={() => setSelectedMatchId(m.id)} />
              ))}
            </div>
            <div className="w-3 flex-shrink-0" />
            <div className="flex-1 min-w-0 flex flex-col justify-around">
              {bracket.filter(m => m.round === 2).map(m => (
                <BracketMatchCard key={m.id} match={m}
                  isSelected={selectedMatchId === m.id}
                  onSelect={() => setSelectedMatchId(m.id)} />
              ))}
            </div>
            <div className="w-3 flex-shrink-0" />
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              {bracket.filter(m => m.round === 3).map(m => (
                <BracketMatchCard key={m.id} match={m} isFinal
                  isSelected={selectedMatchId === m.id}
                  onSelect={() => setSelectedMatchId(m.id)} />
              ))}
            </div>
          </div>

          <p className="text-center text-[9px] text-gray-700 mt-2">Tap any match to preview</p>
        </div>
      )}

      {/* ── Scores tab ── */}
      {view === 'scores' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 mb-3">Final rankings by average score (excludes self-votes)</p>
          {songs.map((song, i) => {
            const pointsMap: Record<number, { pts: number; color: string; bg: string }> = {
              0: { pts: 30, color: 'text-neon-amber', bg: 'bg-neon-amber/15' },
              1: { pts: 25, color: 'text-gray-300',   bg: 'bg-gray-400/15'   },
              2: { pts: 10, color: 'text-orange-400', bg: 'bg-orange-500/15' },
            };
            const pts = pointsMap[i];
            return (
              <motion.div
                key={song.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <SongCard
                  song={song}
                  rank={i + 1}
                  showStreamingLinks
                  hidePreview
                  actions={
                    <div className="text-right flex flex-col items-end gap-0.5">
                      <p className={clsx('font-black text-lg leading-none', i === 0 ? 'text-neon-amber' : i === 1 ? 'text-gray-400' : 'text-gray-600')}>
                        {Number(song.avg_score || 0).toFixed(1)}
                      </p>
                      {pts && (
                        <span className={clsx('text-[9px] font-black px-1.5 py-0.5 rounded-full tracking-wide', pts.color, pts.bg)}>
                          +{pts.pts} PTS
                        </span>
                      )}
                      {(song.battles_won ?? 0) > 0 && (
                        <p className="text-[10px] text-neon-amber mt-0.5">🏆 {song.battles_won}x champ</p>
                      )}
                      {song.submitter_name && (
                        <p className="text-[10px] text-gray-600 mt-0.5">{song.submitter_emblem} {song.submitter_name}</p>
                      )}
                    </div>
                  }
                />
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
