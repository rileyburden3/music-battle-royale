import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { createProfile, updateMe, getEmblems, getGenres, checkUsername } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { auth } from '../services/firebase';

const steps = ['fighter', 'emblem', 'genres'];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { appUser, setAppUser, setProfileComplete } = useAuthStore();
  // Only treat as editing if they have a real (non-auto-generated) username
  const isEditing = !!(appUser?.username && !appUser.username.startsWith('user_'));

  const [step, setStep] = useState(0);
  const [username, setUsername] = useState(isEditing ? (appUser?.username ?? '') : '');
  const [displayName, setDisplayName] = useState(isEditing ? (appUser?.display_name ?? '') : '');
  const [phone, setPhone] = useState((appUser as any)?.phone_number ?? '');
  const firebaseEmail = auth.currentUser?.email ?? '';
  const [emblem, setEmblem] = useState(appUser?.emblem ?? '🎵');
  const [selectedGenres, setSelectedGenres] = useState<string[]>(appUser?.genre_preferences ?? []);
  const [emblems, setEmblems] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [usernameOk, setUsernameOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);

  useEffect(() => {
    Promise.all([getEmblems(), getGenres()]).then(([e, g]) => {
      setEmblems(e.data.data);
      setGenres(g.data.data);
    });
  }, []);

  useEffect(() => {
    if (!username || username.length < 3) { setUsernameOk(null); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) { setUsernameOk(false); return; }
    // If it's still their current username, no need to check availability
    if (username === appUser?.username) { setUsernameOk(true); return; }
    setUsernameOk(null);
    setCheckingUsername(true);
    const t = setTimeout(async () => {
      try {
        const res = await checkUsername(username);
        setUsernameOk(res.data.data.available);
      } finally {
        setCheckingUsername(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [username]);

  const toggleGenre = (g: string) => {
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : prev.length < 5 ? [...prev, g] : prev
    );
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      if (isEditing) {
        // Update existing profile
        const res = await updateMe({ username, display_name: displayName, emblem, genre_preferences: selectedGenres, phone_number: phone || null });
        setAppUser(res.data.data);
        toast.success('Profile updated! ✓');
      } else {
        // Create new profile
        const res = await createProfile({ username, display_name: displayName, emblem, genre_preferences: selectedGenres });
        setAppUser(res.data.data);
        setProfileComplete(true);
        toast.success('Fighter profile created! 🔥');
      }
      navigate('/home');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const canNext = () => {
    if (step === 0) return username.length >= 3 && displayName.length >= 2 && usernameOk === true;
    if (step === 1) return !!emblem;
    if (step === 2) return selectedGenres.length >= 1;
    return false;
  };

  const stepTitles = ['Create Your Fighter', 'Choose Your Emblem', 'Pick Your Genres'];
  const stepSubs = ['Your identity in the arena', 'Represent your style', 'Up to 5 genres'];

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col px-6 py-8">
      <div className="scanline-overlay" />
      <div className="max-w-sm mx-auto w-full flex flex-col flex-1 z-10">
        {/* Cancel button (edit mode only) */}
        {isEditing && (
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-1 text-gray-500 hover:text-white mb-4 text-sm transition-colors"
          >
            <ArrowLeft size={15} />
            Cancel
          </button>
        )}

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {steps.map((_, i) => (
            <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-300 ${i <= step ? 'bg-neon-cyan' : 'bg-dark-500'}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex-1"
          >
            <h2 className="pixel-text text-neon-cyan text-xs mb-1">{stepTitles[step]}</h2>
            <p className="text-gray-400 text-sm mb-6">{stepSubs[step]}</p>

            {step === 0 && (
              <div className="space-y-4">
                {/* Email — always locked, comes from Firebase */}
                <div>
                  <label htmlFor="email-locked" className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">Email Address</label>
                  <div className="relative">
                    <input
                      id="email-locked"
                      type="email"
                      value={firebaseEmail}
                      readOnly
                      aria-label="Email address — locked, set at sign-up"
                      title="Email can't be changed here — it was set when you signed up"
                      className="input-field pr-10 opacity-60 cursor-not-allowed"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs">🔒</span>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1">Used to find you — can't be changed here</p>
                </div>

                {/* Username */}
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">
                    Username <span className="normal-case text-gray-600 ml-1">· your unique @tag</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="your_tag"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      maxLength={20}
                      className={`input-field pr-10 ${usernameOk === true ? 'border-neon-green' : usernameOk === false ? 'border-neon-red' : ''}`}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {checkingUsername && <div className="w-4 h-4 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />}
                      {!checkingUsername && usernameOk === true && <Check size={16} className="text-neon-green" />}
                      {!checkingUsername && usernameOk === false && <span className="text-neon-red text-xs">✗</span>}
                    </div>
                  </div>
                  {usernameOk === false && username.length >= 3 && (
                    <p className="text-neon-red text-xs mt-1">
                      {!/^[a-z0-9_]+$/.test(username) ? 'Only letters, numbers, underscore' : 'Username taken'}
                    </p>
                  )}
                </div>

                {/* Display name */}
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">
                    Your Name <span className="normal-case text-gray-600 ml-1">· shown to other fighters</span>
                  </label>
                  <input
                    type="text"
                    placeholder="First Last"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={50}
                    className="input-field"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">
                    Phone Number <span className="normal-case text-gray-600 ml-1">· optional, helps friends find you</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={20}
                    className="input-field"
                  />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="grid grid-cols-4 gap-3">
                {emblems.map((e) => (
                  <button
                    key={e}
                    onClick={() => setEmblem(e)}
                    className={`h-16 rounded-xl text-3xl flex items-center justify-center transition-all border-2 ${
                      emblem === e
                        ? 'border-neon-cyan bg-neon-cyan/10 shadow-neon-cyan scale-110'
                        : 'border-dark-500 bg-dark-700 hover:border-dark-400'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <div>
                <p className="text-xs text-gray-500 mb-3">{selectedGenres.length}/5 selected</p>
                <div className="flex flex-wrap gap-2">
                  {genres.map((g) => {
                    const active = selectedGenres.includes(g);
                    return (
                      <button
                        key={g}
                        onClick={() => toggleGenre(g)}
                        className={`px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all ${
                          active
                            ? 'border-neon-magenta bg-neon-magenta/10 text-neon-magenta shadow-neon-magenta'
                            : 'border-dark-400 text-gray-400 hover:border-dark-300'
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Nav buttons */}
        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="btn-ghost flex-1">Back</button>
          )}
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(step + 1)} disabled={!canNext()} className="btn-primary flex-1">
              Next →
            </button>
          ) : (
            <button onClick={handleFinish} disabled={!canNext() || loading} className="btn-primary flex-1 font-black">
              {loading ? 'CREATING...' : 'ENTER ARENA 🥊'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
