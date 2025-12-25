interface MasterChannelProps {
  volume: number;
  onVolumeChange: (volume: number) => void;
}

export function MasterChannel({ volume, onVolumeChange }: MasterChannelProps) {
  const db = volume === 0 ? '-∞' : Math.round((volume - 75) * 0.8);

  return (
    <div className="p-4 rounded-2xl shadow-lg border-2 border-primary w-32 flex flex-col items-center bg-card">
      <h3 className="text-lg font-bold mb-2 text-foreground">MASTER</h3>
      <div className="text-xs font-mono opacity-70 mb-4 text-foreground">
        {db} dB
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-48 w-4 rounded-full overflow-hidden flex items-end bg-gray-900">
          <div
            className="w-full rounded-full transition-all duration-100 bg-green-500"
            style={{ height: `${volume}%` }}
          />
        </div>
        <input
          type="range"
          className="master-fader h-48"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => onVolumeChange(parseInt(e.target.value))}
          style={{ writingMode: 'vertical-lr', WebkitAppearance: 'slider-vertical' } as React.CSSProperties}
        />
      </div>
    </div>
  );
}
