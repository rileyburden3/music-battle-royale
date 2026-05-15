import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { signIn, signInWithGoogle, resetPassword } from '../services/firebase';
import { initUser } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

export function LoginPage() {
  const navigate = useNavigate();
  const { setAppUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      const res = await initUser();
      setAppUser(res.data.data);
      const profileDone = res.data.data?.username && !res.data.data.username.startsWith('user_');
      navigate(profileDone ? '/home' : '/onboarding');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (msg.includes('invalid-credential') || msg.includes('wrong-password') || msg.includes('user-not-found')) {
        toast.error('Invalid email or password. If you signed up with Google, use the Google button above.');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      const res = await initUser();
      setAppUser(res.data.data);
      const profileDone = res.data.data?.username && !res.data.data.username.startsWith('user_');
      navigate(profileDone ? '/home' : '/onboarding');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error('Enter your email first'); return; }
    try {
      await resetPassword(email);
      toast.success('Password reset email sent!');
      setResetMode(false);
    } catch {
      toast.error('Failed to send reset email');
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center px-6">
      <div className="scanline-overlay" />
      <button onClick={() => navigate('/')} className="absolute top-6 left-4 text-gray-500 hover:text-white text-sm z-10">← Back</button>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-sm z-10"
      >
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚔️</div>
          <h1 className="pixel-text text-neon-amber text-sm">ENTER THE ARENA</h1>
          <p className="text-gray-400 text-sm mt-2">Welcome back, fighter</p>
        </div>

        {!resetMode ? (
          <>
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 border-2 border-dark-400 hover:border-neon-amber bg-dark-700 hover:bg-dark-600 text-white font-semibold py-3 px-6 rounded-lg transition-all min-h-[48px] mb-4 disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-dark-500" />
              <span className="text-gray-600 text-xs">or</span>
              <div className="flex-1 h-px bg-dark-500" />
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type="email" placeholder="Email" value={email}
                  onChange={(e) => setEmail(e.target.value)} className="input-field pl-10" required />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type={showPass ? 'text' : 'password'} placeholder="Password" value={password}
                  onChange={(e) => setPassword(e.target.value)} className="input-field pl-10 pr-10" required />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full font-black tracking-wide">
                {loading ? 'ENTERING...' : 'FIGHT! ⚡'}
              </button>
              <button type="button" onClick={() => setResetMode(true)}
                className="text-gray-500 text-sm hover:text-neon-cyan w-full text-center mt-1">
                Forgot password?
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <p className="text-gray-400 text-sm text-center">Enter your email to reset password</p>
            <input type="email" placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)} className="input-field" required />
            <button type="submit" className="btn-primary w-full">Send Reset Email</button>
            <button type="button" onClick={() => setResetMode(false)} className="btn-ghost w-full">Back to Login</button>
          </form>
        )}

        <p className="text-center text-gray-500 text-sm mt-6">
          New fighter?{' '}
          <Link to="/signup" className="text-neon-cyan hover:underline font-semibold">Create account</Link>
        </p>
      </motion.div>
    </div>
  );
}
