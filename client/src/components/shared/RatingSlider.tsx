interface RatingSliderProps {
  value: number;
  onChange: (v: number) => void;
  color: string; // CSS color value (hex/rgb), used for thumb border, glow, and score text
}

export function RatingSlider({ value, onChange, color }: RatingSliderProps) {
  const percent = (value / 10) * 100;
  // Position thumb center accounting for thumb width (32px)
  const thumbOffset = `calc(${percent}% + ${(50 - percent) * 0.32}px - 16px)`;

  return (
    <div className="mb-2">
      {/* Track + thumb */}
      <div className="relative h-8 flex items-center">
        {/* Gradient track */}
        <div
          className="absolute w-full h-2 rounded-full"
          style={{ background: 'linear-gradient(to right, #ff0040, #ffb800, #39ff14, #00ffff)' }}
        />

        {/* Custom thumb */}
        <div
          className="absolute w-8 h-8 rounded-full flex items-center justify-center shadow-lg pointer-events-none transition-all duration-75 border-2"
          style={{
            left: thumbOffset,
            background: value === 0 ? '#374151' : '#0d0d0d',
            borderColor: value === 0 ? '#6b7280' : color,
            boxShadow: value === 0 ? 'none' : `0 0 10px ${color}66`,
          }}
        >
          <span
            className="text-xs font-black leading-none"
            style={{ color: value === 0 ? '#6b7280' : color }}
          >
            {value === 0 ? '?' : value}
          </span>
        </div>

        {/* Invisible native input */}
        <input
          type="range"
          min={0}
          max={10}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="absolute w-full opacity-0 cursor-pointer h-full z-10"
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between items-center px-1 mt-3">
        <span className="text-xs font-bold text-red-500">TRASH</span>
        <span className="text-xs font-bold text-neon-amber">GOAT</span>
      </div>
    </div>
  );
}
