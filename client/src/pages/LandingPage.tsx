import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'linear-gradient(#00ffff 1px, transparent 1px), linear-gradient(90deg, #00ffff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Scanline overlay */}
      <div className="scanline-overlay" />

      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="text-center z-10 max-w-sm w-full"
      >
        {/* Logo */}
        <motion.div
          animate={{ y: [-5, 5, -5] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="text-7xl mb-4"
        >
          🥊
        </motion.div>

        <h1 className="pixel-text text-neon-cyan text-xl mb-1 leading-relaxed">
          BATTLE
        </h1>
        <h1 className="pixel-text text-white text-xl mb-2 leading-relaxed">
          ROYALE
        </h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-neon-magenta text-xs mb-10 animate-pulse-neon"
        >
          ⚔️ Fight for your songs ⚔️
        </motion.p>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="grid grid-cols-3 gap-3 mb-10"
        >
          {[
            { emoji: '🎵', text: 'Submit Songs' },
            { emoji: '⚡', text: 'Rank & Vote' },
            { emoji: '👑', text: 'Crown Winner' },
          ].map((item) => (
            <div key={item.text} className="card text-center py-3">
              <div className="text-2xl mb-1">{item.emoji}</div>
              <p className="text-xs text-gray-400">{item.text}</p>
            </div>
          ))}
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex flex-col gap-3"
        >
          <button onClick={() => navigate('/signup')} className="btn-primary w-full text-base font-black tracking-wide">
            START FIGHTING 🔥
          </button>
          <button onClick={() => navigate('/login')} className="btn-secondary w-full text-base">
            I already have an account
          </button>
          <button onClick={() => navigate('/demo')} className="w-full text-sm font-bold text-neon-cyan border border-neon-cyan/40 rounded-xl py-3 hover:bg-neon-cyan/10 hover:border-neon-cyan transition-all">
            Try a demo battle first →
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
