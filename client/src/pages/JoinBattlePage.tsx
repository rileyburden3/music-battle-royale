import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { joinBattle } from '../services/api';

export function JoinBattlePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (code.trim().length < 4) { toast.error('Enter the 6-character invite code'); return; }
    setLoading(true);
    try {
      const res = await joinBattle(code.trim());
      const battle = res.data.data;
      toast.success('Joined the battle! ⚔️');
      navigate(`/battle/${battle.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to join battle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container flex flex-col">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate('/home')} className="text-gray-400 hover:text-white p-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="pixel-text text-neon-amber text-xs">JOIN BATTLE</h1>
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-col items-center gap-6 flex-1 justify-center"
      >
        <div className="text-6xl animate-float">⚔️</div>
        <div className="text-center">
          <h2 className="text-white font-black text-xl mb-1">Enter Invite Code</h2>
          <p className="text-gray-500 text-sm">Get the code from your friend</p>
        </div>

        <div className="w-full max-w-xs">
          <input
            type="text"
            placeholder="ABC123"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            className="input-field text-center text-2xl font-bold tracking-[0.3em] uppercase"
            style={{ fontFamily: '"Press Start 2P", monospace' }}
            maxLength={6}
          />
          <p className="text-xs text-gray-600 text-center mt-2">6-character code</p>
        </div>

        <button
          onClick={handleJoin}
          disabled={loading || code.length < 4}
          className="btn-primary w-full max-w-xs font-black"
        >
          {loading ? 'JOINING...' : 'ENTER ARENA ⚡'}
        </button>
      </motion.div>
    </div>
  );
}
