import { useEffect, useRef, useState } from 'react';
import { AudioTrack } from '@/types/mixer';

interface ChannelProps {
  track: AudioTrack;
  index: number;
  isClickOrGuide: boolean;
  onVolumeChange: (index: number, volume: number) => void;
  onPanChange: (index: number, pan: number) => void;
  onMuteToggle: (index: number) => void;
  onSoloToggle: (index: number) => void;
}

export function Channel({
  track,
  index,
  isClickOrGuide,
  onVolumeChange,
  onPanChange,
  onMuteToggle,
  onSoloToggle,
}: ChannelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [isSoloed, setIsSoloed] = useState(false);

  const getLevelDisplay = (value: number) => {
    return value === 0 ? '-∞' : Math.round((value - 75) * 0.8);
  };

  const getPanDisplay = (value: number) => {
    if (value < 0) return `L${Math.abs(value)}`;
    if (value > 0) return `R${value}`;
    return 'C';
  };

  // Audio meter visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !track.analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const analyser = track.analyser;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      analyser.getByteFrequencyData(dataArray);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, 0, width, height);
      
      const barWidth = width / bufferLength;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height;
        
        const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
        gradient.addColorStop(0, '#3b82f6');
        gradient.addColorStop(1, '#22c55e');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
        
        x += barWidth;
      }
      
      animationRef.current = requestAnimationFrame(draw);
    };
    
    draw();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [track.analyser]);

  const handleSolo = () => {
    setIsSoloed(!isSoloed);
    onSoloToggle(index);
  };

  const bgColor = isClickOrGuide ? 'bg-channel-click' : 'bg-channel-normal';
  const borderColor = isClickOrGuide ? 'border-channel-click-border' : 'border-channel-normal-border';

  return (
    <div className={`channel p-3 rounded-xl shadow-lg border transition-all hover:shadow-xl ${bgColor} ${borderColor}`}>
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center gap-2 w-16">
          <h3 
            className="channel-name text-xs font-bold truncate w-full text-center text-foreground" 
            title={track.name}
          >
            {track.name}
          </h3>
          <canvas 
            ref={canvasRef}
            className="audio-meter-canvas w-14 h-12 rounded bg-gray-900" 
            width={56} 
            height={48}
          />
          <span className="level-display text-xs font-mono opacity-70 text-foreground">
            {getLevelDisplay(track.volume)}dB
          </span>
        </div>
        
        <div className="flex items-center gap-2 flex-1">
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs opacity-50">🔊</span>
            <input 
              type="range" 
              className="channel-fader h-20 w-2" 
              min={0} 
              max={100} 
              value={track.volume}
              onChange={(e) => onVolumeChange(index, parseInt(e.target.value))}
              style={{ writingMode: 'vertical-lr', WebkitAppearance: 'slider-vertical' } as React.CSSProperties}
            />
            <span className="text-xs opacity-50">🔇</span>
          </div>
          
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs opacity-50">L</span>
            <input 
              type="range" 
              className="pan-slider h-20 w-2" 
              min={-100} 
              max={100} 
              value={track.pan}
              onChange={(e) => onPanChange(index, parseInt(e.target.value))}
              style={{ writingMode: 'vertical-lr', WebkitAppearance: 'slider-vertical' } as React.CSSProperties}
            />
            <span className="pan-display text-xs font-mono text-foreground">
              {getPanDisplay(track.pan)}
            </span>
          </div>
          
          <div className="flex flex-col items-center gap-1">
            <div className="h-20 w-3 rounded-full overflow-hidden flex items-end bg-gray-900">
              <div 
                className="level-meter w-full bg-green-500 rounded-full transition-all duration-100" 
                style={{ height: `${track.volume}%` }}
              />
            </div>
            <span className="text-xs opacity-50">📊</span>
          </div>
        </div>
        
        <div className="flex flex-col gap-1">
          <button 
            className={`solo-btn w-12 h-8 rounded text-xs font-bold transition-all hover:scale-105 bg-primary text-primary-foreground ${isSoloed ? 'ring-2 ring-yellow-400' : ''}`}
            onClick={handleSolo}
          >
            S
          </button>
          <button 
            className={`mute-btn w-12 h-8 rounded text-xs font-bold transition-all hover:scale-105 bg-secondary text-secondary-foreground ${track.muted ? 'ring-2 ring-red-400' : ''}`}
            onClick={() => onMuteToggle(index)}
          >
            M
          </button>
        </div>
      </div>
    </div>
  );
}
