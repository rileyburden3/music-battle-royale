import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Copy, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { createBattle, inviteFriends, searchUsers } from '../services/api';

const GENRES = ['Hip-Hop', 'Pop', 'R&B', 'Rock', 'Electronic', 'Jazz', 'Latin', 'Country', 'Indie', 'Metal', 'Reggae', 'Soul', 'Mixed'];

interface SearchUser {
  id: string;
  username: string;
  display_name: string;
  emblem: string;
  email?: string;
}

// ── Single invite slot with typeahead ──────────────────────────────────────
function FriendSearchSlot({
  index,
  selected,
  onSelect,
  onClear,
}: {
  index: number;
  selected: SearchUser | null;
  onSelect: (u: SearchUser) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchUsers(q);
        setResults(res.data.data);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  if (selected) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 bg-dark-700 rounded-lg border border-neon-cyan/40">
        <span className="text-xl flex-shrink-0">{selected.emblem}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{selected.display_name}</p>
          <p className="text-xs text-gray-500 truncate">@{selected.username}</p>
        </div>
        <button onClick={onClear} className="text-gray-500 hover:text-neon-red p-1 transition-colors flex-shrink-0">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        placeholder={`Search fighter ${index + 2} by name, email or phone...`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); (e.target as HTMLInputElement).blur(); } }}
        className="input-field text-sm"
      />
      {searching && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
      )}
      {open && results.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-dark-700 border border-dark-500 rounded-lg overflow-hidden shadow-xl">
          {results.map((user) => (
            <button
              key={user.id}
              onMouseDown={() => { onSelect(user); setQ(''); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-dark-600 text-left transition-colors border-b border-dark-600 last:border-0"
            >
              <span className="text-xl flex-shrink-0">{user.emblem}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user.display_name}</p>
                <p className="text-xs text-gray-500 truncate">
                  @{user.username}{user.email ? ` · ${user.email}` : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && results.length === 0 && !searching && q.length >= 2 && (
        <div className="absolute z-20 w-full mt-1 bg-dark-700 border border-dark-500 rounded-lg p-3 text-center text-gray-500 text-sm shadow-xl">
          No fighters found
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export function CreateBattlePage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<(SearchUser | null)[]>([null, null, null]);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ id: string; invite_code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) { toast.error('Give your battle a name!'); return; }
    setLoading(true);
    try {
      const res = await createBattle({ title: title.trim(), genre: genre || undefined });
      const battle = res.data.data;
      setCreated(battle);

      const validFriends = selectedFriends.filter(Boolean) as SearchUser[];
      if (validFriends.length > 0) {
        try {
          const invRes = await inviteFriends(battle.id, validFriends.map((f) => f.username));
          const results = invRes.data.data as Array<{ username: string; status: string }>;
          const notFound = results.filter((r) => r.status === 'not_found').map((r) => r.username);
          if (notFound.length > 0) toast.error(`Not found: ${notFound.join(', ')}`);
        } catch {
          toast.error('Could not send some invites');
        }
      }

      toast.success('Battle created! 🔥');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create battle');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (!created) return;
    navigator.clipboard.writeText(created.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Invite code copied!');
  };

  if (created) {
    return (
      <div className="page-container flex flex-col items-center justify-center min-h-screen">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-sm w-full"
        >
          <div className="text-6xl mb-4 animate-bounce-in">🔥</div>
          <h1 className="pixel-text text-neon-cyan text-sm mb-2">BATTLE CREATED!</h1>
          <p className="text-gray-400 text-sm mb-6">Share this code with your crew</p>

          <div className="card-glow mb-6">
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Invite Code</p>
            <div className="flex items-center justify-between gap-3">
              <span className="pixel-text text-neon-amber text-2xl tracking-widest flex-1 text-center">
                {created.invite_code}
              </span>
              <button onClick={copyCode} className="btn-secondary py-2 px-3 min-h-0 h-10">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <button onClick={() => navigate(`/battle/${created.id}`)} className="btn-primary w-full font-black">
              ENTER BATTLE LOBBY ⚔️
            </button>
            <button onClick={() => navigate('/home')} className="btn-ghost w-full">
              Back to Home
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white p-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="pixel-text text-neon-cyan text-xs">NEW BATTLE</h1>
      </div>

      <div className="space-y-6">
        {/* Title */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Battle Name *</label>
          <input
            type="text"
            placeholder="e.g. Friday Night Bangers"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            className="input-field text-base"
          />
        </div>

        {/* Genre */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Genre (optional)</label>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((g) => (
              <button
                key={g}
                onClick={() => setGenre(genre === g ? '' : g)}
                className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                  genre === g
                    ? 'border-neon-cyan text-neon-cyan bg-neon-cyan/10'
                    : 'border-dark-400 text-gray-400 hover:border-dark-300'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Invite friends */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">
            Invite Friends (optional, up to 3)
          </label>
          <p className="text-xs text-gray-600 mb-3">Search by name, email, or phone — or share the invite code after</p>
          <div className="space-y-2">
            {selectedFriends.map((sel, i) => (
              <FriendSearchSlot
                key={i}
                index={i}
                selected={sel}
                onSelect={(u) => {
                  const next = [...selectedFriends];
                  next[i] = u;
                  setSelectedFriends(next);
                }}
                onClear={() => {
                  const next = [...selectedFriends];
                  next[i] = null;
                  setSelectedFriends(next);
                }}
              />
            ))}
          </div>
        </div>

        {/* Info card */}
        <div className="card bg-dark-600 border-dark-400">
          <p className="text-xs text-gray-400 font-semibold mb-2">⚔️ Battle Rules</p>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>• 4 players max (you + 3 friends)</li>
            <li>• Each player submits 2 songs (8 total)</li>
            <li>• Rank songs 1-10 — your own songs don't count</li>
            <li>• Single-elimination bracket: 8→4→2→1</li>
            <li>• 1st: +30pts · 2nd: +25pts · 3rd: +10pts</li>
          </ul>
        </div>

        <button
          onClick={handleCreate}
          disabled={loading || !title.trim()}
          className="btn-primary w-full text-base font-black"
        >
          {loading ? 'CREATING...' : 'CREATE BATTLE 🔥'}
        </button>
      </div>
    </div>
  );
}
