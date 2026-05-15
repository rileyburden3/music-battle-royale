import { Play, Pause, Music, ExternalLink } from 'lucide-react';
import { useState, useRef } from 'react';
import { clsx } from 'clsx';

interface SongCardProps {
  song: {
    id?: string;
    title: string;
    artist: string;
    album?: string;
    album_art_url?: string;
    preview_url?: string;
    duration_ms?: number;
    spotify_id?: string;
    itunes_id?: string;
    apple_music_url?: string;
  };
  showStreamingLinks?: boolean;
  hidePreview?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  actions?: React.ReactNode;
  className?: string;
  compact?: boolean;
  rank?: number;
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function StreamingLinks({ title, artist, appleUrl }: { title: string; artist: string; appleUrl?: string }) {
  const query = encodeURIComponent(`${title} ${artist}`);
  return (
    <div className="flex gap-2 mt-2 px-1">
      <a href={`https://open.spotify.com/search/${query}`} target="_blank" rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex-1 text-center text-[10px] font-bold py-1 rounded-lg bg-green-600/20 text-green-400 border border-green-600/30 hover:bg-green-600/30 transition-all">
        Spotify
      </a>
      <a href={appleUrl || `https://music.apple.com/search?term=${query}`} target="_blank" rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex-1 text-center text-[10px] font-bold py-1 rounded-lg bg-pink-600/20 text-pink-400 border border-pink-600/30 hover:bg-pink-600/30 transition-all">
        Apple
      </a>
      <a href={`https://www.youtube.com/results?search_query=${query}`} target="_blank" rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex-1 text-center text-[10px] font-bold py-1 rounded-lg bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30 transition-all">
        YouTube
      </a>
    </div>
  );
}

export function SongCard({ song, selected, onSelect, actions, className, compact, rank, showStreamingLinks, hidePreview }: SongCardProps) {
  const [playing, setPlaying] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!song.preview_url) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      if (!audioRef.current) audioRef.current = new Audio(song.preview_url);
      audioRef.current.volume = 0.6;
      audioRef.current.play();
      setPlaying(true);
      audioRef.current.onended = () => setPlaying(false);
    }
  };

  return (
    <div
      onClick={onSelect}
      className={clsx(
        'rounded-xl border transition-all duration-200',
        compact ? 'p-2' : 'p-3',
        onSelect && 'cursor-pointer hover:border-neon-cyan/50',
        selected
          ? 'bg-neon-cyan/10 border-neon-cyan shadow-neon-cyan'
          : 'bg-dark-700 border-dark-500',
        className
      )}
    >
    <div className="flex items-center gap-3">
      {/* Rank number */}
      {rank != null && (
        <div className="w-6 text-center">
          <span className={clsx(
            'font-bold text-sm',
            rank === 1 ? 'text-neon-amber' : rank === 2 ? 'text-gray-400' : rank === 3 ? 'text-orange-600' : 'text-gray-600'
          )}>
            {rank === 1 ? '👑' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
          </span>
        </div>
      )}

      {/* Album art */}
      <div className={clsx('rounded-lg overflow-hidden flex-shrink-0 bg-dark-600', compact ? 'w-10 h-10' : 'w-12 h-12')}>
        {song.album_art_url ? (
          <img src={song.album_art_url} alt={song.album} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music size={compact ? 16 : 20} className="text-gray-600" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={clsx('font-semibold text-white truncate', compact ? 'text-sm' : 'text-base')}>
          {song.title}
        </p>
        <p className={clsx('text-gray-400 truncate', compact ? 'text-xs' : 'text-sm')}>
          {song.artist}
        </p>
        {!compact && song.duration_ms && (
          <p className="text-xs text-gray-600">{formatDuration(song.duration_ms)}</p>
        )}
      </div>

      {/* Preview button */}
      {song.preview_url && !compact && !hidePreview && (
        <button
          onClick={togglePreview}
          className={clsx(
            'w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0 transition-all',
            playing
              ? 'border-neon-cyan text-neon-cyan bg-neon-cyan/10'
              : 'border-dark-400 text-gray-400 hover:border-neon-cyan hover:text-neon-cyan'
          )}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
      )}

      {/* Listen button */}
      {showStreamingLinks && !compact && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowLinks(!showLinks); }}
          className={clsx(
            'w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0 transition-all',
            showLinks
              ? 'border-neon-magenta text-neon-magenta bg-neon-magenta/10'
              : 'border-dark-400 text-gray-400 hover:border-neon-magenta hover:text-neon-magenta'
          )}
        >
          <ExternalLink size={14} />
        </button>
      )}

      {/* Custom actions */}
      {actions && <div className="flex-shrink-0">{actions}</div>}
    </div>

    {/* Streaming links panel */}
    {showStreamingLinks && showLinks && (
      <StreamingLinks title={song.title} artist={song.artist} appleUrl={song.apple_music_url} />
    )}
    </div>
  );
}
