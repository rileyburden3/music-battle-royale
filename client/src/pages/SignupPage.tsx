import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { signUp, signInWithGoogle, sendVerificationEmail, reloadCurrentUser, auth } from '../services/firebase';
import { initUser } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

export function SignupPage() {
  const navigate = useNavigate();
  const { setAppUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);

  const passwordsMatch = confirmPassword === '' || password === confirmPassword;
  const canSubmit = email && password.length >= 6 && password === confirmPassword;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      await signUp(email, password);
      await sendVerificationEmail();
      setVerificationSent(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    setCheckingVerification(true);
    try {
      await reloadCurrentUser();
      const user = auth.currentUser;
      if (user?.emailVerified) {
        const res = await initUser();
        setAppUser(res.data.data);
        toast.success('Email verified! Welcome to the arena 🔥');
        navigate('/onboarding');
      } else {
        toast.error('Not verified yet — check your inbox and click the link.');
      }
    } catch {
      toast.error('Could not check verification status');
    } finally {
      setCheckingVerification(false);
    }
  };

  const handleResend = async () => {
    try {
      await sendVerificationEmail();
      toast.success('Verification email resent!');
    } catch {
      toast.error('Failed to resend — try again in a moment');
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      const res = await initUser();
      setAppUser(res.data.data);
      if (res.data.isNew) navigate('/onboarding');
      else navigate('/home');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Verify email screen ────────────────────────────────────────────────────
  if (verificationSent) {
    return (
      <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center px-6">
        <div className="scanline-overlay" />
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-sm z-10 text-center"
        >
          <div className="text-6xl mb-4">📬</div>
          <h1 className="pixel-text text-neon-cyan text-xs mb-3">CHECK YOUR INBOX</h1>
          <p className="text-gray-400 text-sm mb-2">
            We sent a verification link to
          </p>
          <p className="text-white font-bold mb-6">{email}</p>

          <div className="card mb-6 text-left space-y-2 text-sm text-gray-400">
            <p>1. Open the email from Firebase / Battle Royale</p>
            <p>2. Click the verification link</p>
            <p>3. Come back here and tap the button below</p>
          </div>

          <button
            onClick={handleCheckVerification}
            disabled={checkingVerification}
            className="btn-primary w-full font-black mb-3 gap-2"
          >
            <CheckCircle size={16} />
            {checkingVerification ? 'CHECKING...' : "I'VE VERIFIED MY EMAIL ✓"}
          </button>

          <button onClick={handleResend} className="btn-ghost w-full text-sm">
            Resend verification email
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Signup form ────────────────────────────────────────────────────────────
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
          <div className="text-5xl mb-3">🥊</div>
          <h1 className="pixel-text text-neon-cyan text-sm">JOIN THE ARENA</h1>
          <p className="text-gray-400 text-sm mt-2">Create your fighter profile</p>
        </div>

        {/* Google sign-in */}
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

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input type="email" placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field pl-10" required />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="Password (6+ chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field pl-10 pr-10" required
            />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type={showConfirm ? 'text' : 'password'}
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`input-field pl-10 pr-10 ${
                !passwordsMatch ? 'border-neon-red focus:border-neon-red' :
                confirmPassword && passwordsMatch ? 'border-neon-green' : ''
              }`}
              required
            />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {!passwordsMatch && confirmPassword && (
            <p className="text-neon-red text-xs -mt-2">Passwords don't match</p>
          )}

          <button type="submit" disabled={loading || !canSubmit} className="btn-primary w-full font-black tracking-wide">
            {loading ? 'CREATING...' : 'CREATE ACCOUNT 🔥'}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-6">
          Already a fighter?{' '}
          <Link to="/login" className="text-neon-cyan hover:underline font-semibold">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
