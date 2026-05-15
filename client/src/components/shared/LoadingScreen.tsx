import { motion } from 'framer-motion';

export function LoadingScreen({ message = 'LOADING...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-dark-900 flex flex-col items-center justify-center z-50">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="text-center"
      >
        <div className="text-5xl mb-6 animate-bounce-in">🥊</div>
        <p className="pixel-text text-neon-cyan text-xs animate-pulse-neon">{message}</p>
        <div className="flex gap-1 mt-6 justify-center">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 bg-neon-cyan rounded-full"
              animate={{ y: [-4, 4, -4] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
