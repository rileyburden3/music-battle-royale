/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        neon: {
          cyan: '#00ffff',
          amber: '#ffb800',
          magenta: '#ff00ff',
          green: '#39ff14',
          red: '#ff0040',
        },
        dark: {
          900: '#0a0a0f',
          800: '#111118',
          700: '#1a1a25',
          600: '#22222f',
          500: '#2d2d3d',
          400: '#3a3a4d',
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neon-cyan': '0 0 10px #00ffff, 0 0 20px #00ffff40, 0 0 40px #00ffff20',
        'neon-amber': '0 0 10px #ffb800, 0 0 20px #ffb80040, 0 0 40px #ffb80020',
        'neon-magenta': '0 0 10px #ff00ff, 0 0 20px #ff00ff40, 0 0 40px #ff00ff20',
        'neon-red': '0 0 10px #ff0040, 0 0 20px #ff004040',
      },
      animation: {
        'pulse-neon': 'pulse-neon 2s ease-in-out infinite',
        'glitch': 'glitch 0.3s ease-in-out',
        'shake': 'shake 0.5s ease-in-out',
        'ko-flash': 'ko-flash 0.8s ease-in-out',
        'slide-in-left': 'slide-in-left 0.4s ease-out',
        'slide-in-right': 'slide-in-right 0.4s ease-out',
        'bounce-in': 'bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'float': 'float 3s ease-in-out infinite',
        'scanline': 'scanline 2s linear infinite',
      },
      keyframes: {
        'pulse-neon': {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.8', filter: 'brightness(1.3)' },
        },
        'glitch': {
          '0%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-3px, 3px)' },
          '40%': { transform: 'translate(3px, -3px)' },
          '60%': { transform: 'translate(-3px, -3px)' },
          '80%': { transform: 'translate(3px, 3px)' },
          '100%': { transform: 'translate(0)' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-5px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(5px)' },
        },
        'ko-flash': {
          '0%': { background: 'transparent' },
          '20%': { background: 'rgba(255, 0, 64, 0.8)' },
          '40%': { background: 'transparent' },
          '60%': { background: 'rgba(255, 0, 64, 0.4)' },
          '100%': { background: 'transparent' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'bounce-in': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'scanline': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
      },
    },
  },
  plugins: [],
};
