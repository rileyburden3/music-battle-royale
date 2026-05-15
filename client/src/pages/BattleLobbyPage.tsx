import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Copy, Play, Users, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBattle, startSubmissions, startVoting, deleteBattle, acceptBattleInvite } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useBattleStore } from '../store/useBattleStore';

interface Participant {
  user_id: string;
  username: string;
  display_name: string;
  emblem: string;
  status: string;
  songs_submitted: boolean;
  rankings_submitted: boolean;
}

export function BattleLobbyPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuthStore();
  const { setCurrentBattle } = useBattleStore();
  const autoAcceptedRef = useRef(false);
  const [battle, setBattle] = useState<{
    id: string; title: string; creator_id: string; status: string;
    invite_code: string; genre?: string; participants: Participant[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!id) return;
    try {
      const res = await getBattle(id);
      const b = res.data.data;
      setBattle(b);
      setCurrentBattle(b);

      // Auto-navigate based on status
      const me = b.participants?.find((p: { user_id: string; status: string }) => p.user_id === appUser?.id);

      // Auto-accept if arrived via invite link
      if (me?.status === 'invited' && !autoAcceptedRef.current) {
        autoAcceptedRef.current = true;
        try {
          await acceptBattleInvite(id!);
          const updated = await getBattle(id!);
          const ub = updated.data.data;
          setBattle(ub);
          setCurrentBattle(ub);
          // Run redirect logic against the freshly accepted battle state
          const updatedMe = ub.participants?.find((p: { user_id: string }) => p.user_id === appUser?.id);
          if (ub.status === 'voting' && !updatedMe?.rankings_submitted) {
            navigate(`/battle/${id}/vote`);
          } else if (ub.status === 'submitting' && !updatedMe?.songs_submitted) {
            navigate(`/battle/${id}/submit`);
          } else if (ub.status === 'completed') {
            navigate(`/battle/${id}/results`);
          }
          setLoading(false);
          return;
        } catch { /* fall through to normal display */ }
      }

      if (b.status === 'voting' && !me?.rankings_submitted) {
        navigate(`/battle/${id}/vote`);
      } else if (b.status === 'completed') {
        navigate(`/battle/${id}/results`);
      }
    } catch {
      toast.error('Failed to load battle');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 8000);
    return () => clearInterval(interval);
  }, [id, appUser?.id]); // appUser?.id (not appUser) avoids re-running on every points update

  if (loading || !battle) {
    return (
      <div className="page-container flex items-center justify-center">
        <div className="text-neon-cyan animate-pulse-neon pixel-text text-xs">LOADING...</div>
      </div>
    );
  }

  const isCreator = battle.creator_id === appUser?.id;
  const accepted = battle.participants.filter((p) => p.status === 'accepted');
  const allSubmitted = accepted.every((p) => p.songs_submitted);
  const myParticipant = accepted.find((p) => p.user_id === appUser?.id);
  const iHaveSubmitted = myParticipant?.songs_submitted ?? false;

  const handleStartSubmissions = async () => {
    try {
      await startSubmissions(id!);
      toast.success('Song submission started!');
      navigate(`/battle/${id}/submit`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to start');
    }
  };

  const handleStartVoting = async () => {
    try {
      await startVoting(id!);
      navigate(`/battle/${id}/vote`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to start voting');
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(battle.invite_code);
    toast.success('Invite code copied!');
  };

  const handleDeleteBattle = async () => {
    if (!window.confirm(`Delete "${battle.title}"? This can't be undone.`)) return;
    try {
      await deleteBattle(id!);
      toast.success('Battle deleted');
      navigate('/home');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete battle');
    }
  };

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/home')} className="text-gray-400 hover:text-white p-1">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-black text-white text-lg">{battle.title}</h1>
          <div className="flex items-center gap-2">
            {battle.genre && <span className="text-xs text-gray-500">{battle.genre}</span>}
            <span className="badge border border-dark-400 text-gray-500 text-[10px]">{battle.status.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Invite code — only shown while battle is still in lobby */}
      {battle.status === 'lobby' && (
        <div className="card-glow mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Invite Code</p>
              <p className="pixel-text text-neon-amber text-lg tracking-widest">{battle.invite_code}</p>
            </div>
            <button onClick={copyCode} className="btn-secondary py-2 px-3 min-h-0 h-10 gap-2">
              <Copy size={14} />
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Players */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Users size={14} className="text-gray-500" />
          <span className="text-xs text-gray-500 uppercase tracking-wide">{accepted.length} fighter{accepted.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="space-y-2">
          {accepted.map((p, i) => (
            <motion.div
              key={p.user_id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="card flex items-center gap-3"
            >
              <span className="text-2xl">{p.emblem}</span>
              <div className="flex-1">
                <p className="font-bold text-white text-sm">{p.display_name}</p>
                <p className="text-xs text-gray-500">@{p.username}</p>
              </div>
              {p.user_id === battle.creator_id && (
                <span className="badge bg-neon-amber/10 text-neon-amber border border-neon-amber/30 text-[10px]">HOST</span>
              )}
              {battle.status === 'submitting' && (
                <span className={`badge text-[10px] ${p.songs_submitted ? 'text-green-500 border border-green-500/30' : 'text-gray-600 border border-dark-400'}`}>
                  {p.songs_submitted ? '✓ Submitted' : '⏳ Pending'}
                </span>
              )}
            </motion.div>
          ))}
          {/* Empty slots */}
          {Array.from({ length: 4 - accepted.length }).map((_, i) => (
            <div key={i} className="card border-dashed border-dark-400 text-center py-3 text-gray-600 text-sm">
              Waiting for fighter {accepted.length + i + 1}...
            </div>
          ))}
        </div>
      </div>

      {/* Creator controls */}
      {isCreator && battle.status === 'lobby' && (
        <div className="space-y-3">
          <button
            onClick={handleStartSubmissions}
            disabled={accepted.length < 2}
            className="btn-primary w-full font-black gap-2"
          >
            <Play size={16} />
            START BATTLE {accepted.length < 2 ? '(need 2+ fighters)' : '🔥'}
          </button>
          <button
            onClick={handleDeleteBattle}
            className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-red-400 border border-dark-500 hover:border-red-500/30 rounded-lg py-3 px-4 transition-all text-sm font-semibold"
          >
            <Trash2 size={14} />
            Delete Battle
          </button>
        </div>
      )}

      {battle.status === 'submitting' && (
        <div className="space-y-3">
          {!iHaveSubmitted ? (
            <button onClick={() => navigate(`/battle/${id}/submit`)} className="btn-primary w-full font-black">
              SUBMIT MY SONGS 🎵
            </button>
          ) : (
            <div className="card border-green-500/30 text-center py-4">
              <p className="text-green-400 font-bold">✓ Songs submitted!</p>
              <p className="text-gray-500 text-sm mt-1">
                {allSubmitted
                  ? 'All songs in! Starting voting...'
                  : `Waiting for others... (${accepted.filter(p => p.songs_submitted).length}/${accepted.length} done)`}
              </p>
            </div>
          )}
          {allSubmitted && iHaveSubmitted && (
            <button onClick={handleStartVoting} className="btn-primary w-full font-black">
              START VOTING ⚡
            </button>
          )}
        </div>
      )}

      {!isCreator && battle.status === 'lobby' && (
        <p className="text-center text-gray-500 text-sm">Waiting for host to start...</p>
      )}
    </div>
  );
}
