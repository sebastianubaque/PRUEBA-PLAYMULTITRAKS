import { useEffect, useRef } from 'react';
import { ClickBeat, UserMarker, ActiveLoop } from '@/types/mixer';

interface TimelineProps {
  clickBeats: ClickBeat[];
  userMarkers: UserMarker[];
  progressRef: React.MutableRefObject<number>;
  zoomLevel: number;
  duration: number;
  isPlaying: boolean;
  activeLoop: ActiveLoop | null;
  onSeek: (percentage: number) => void;
  onBeatClick: (beat: ClickBeat) => void;
  onMarkerClick: (marker: UserMarker, index: number) => void;
  onMarkerDelete: (index: number) => void;
  onUpdateProgress: () => void;
}

export function Timeline({
  clickBeats,
  userMarkers,
  progressRef,
  zoomLevel,
  duration,
  isPlaying,
  activeLoop,
  onSeek,
  onBeatClick,
  onMarkerClick,
  onMarkerDelete,
  onUpdateProgress,
}: TimelineProps) {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);

  // Use RAF for smooth progress updates without state changes
  useEffect(() => {
    const animate = () => {
      onUpdateProgress();
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${progressRef.current}%`;
      }
      if (isPlaying) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, progressRef, onUpdateProgress]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    onSeek(percentage);
  };

  return (
    <div className="overflow-x-auto mb-4">
      <div style={{ width: `${zoomLevel * 100}%` }}>
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">🎵 Línea de Tiempo</span>
          <span className="text-xs opacity-70 text-foreground">
            {clickBeats.length > 0 ? `${clickBeats.length} beats detectados` : ''}
          </span>
          {activeLoop && (
            <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
              🔁 Loop activo
            </span>
          )}
        </div>
        
        <div
          className="relative h-24 rounded-lg overflow-visible cursor-pointer bg-card"
          style={{ minWidth: '100%' }}
          onClick={handleClick}
        >
          {/* Loop region highlight */}
          {activeLoop && (
            <div
              className="absolute top-0 h-full opacity-30 bg-secondary"
              style={{
                left: `${activeLoop.startPercentage}%`,
                width: `${activeLoop.endPercentage - activeLoop.startPercentage}%`,
              }}
            />
          )}
          
          {/* Progress bar - using ref for smooth updates */}
          <div
            ref={progressBarRef}
            className="h-full bg-primary"
            style={{ width: '0%' }}
          />
          
          {/* Click beats - Solo beats fuertes (verdes) */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            {clickBeats.filter(beat => beat.isStrong).map((beat, index) => (
              <div
                key={index}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded cursor-pointer transition-transform hover:scale-125 pointer-events-auto z-10"
                style={{
                  left: `${beat.percentage}%`,
                  width: '12px',
                  height: '60%',
                  backgroundColor: 'hsl(var(--secondary))',
                  border: '2px solid hsl(var(--foreground) / 0.4)',
                }}
                title={`Beat ${beat.number} - Click para agregar marcador`}
                onClick={(e) => {
                  e.stopPropagation();
                  onBeatClick(beat);
                }}
              />
            ))}
          </div>
          
          {/* User markers */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            {userMarkers.map((marker, index) => (
              <div key={index}>
                {/* Marker line */}
                <div
                  className="absolute top-0 w-[3px] h-full"
                  style={{
                    left: `${marker.percentage}%`,
                    backgroundColor: marker.color,
                    boxShadow: `0 0 8px ${marker.color}cc`,
                  }}
                />
                {/* Marker label */}
                <div
                  className="absolute -top-6 -translate-x-1/2 text-[11px] font-bold text-white px-2 py-0.5 rounded whitespace-nowrap shadow-md"
                  style={{
                    left: `${marker.percentage}%`,
                    backgroundColor: marker.color,
                  }}
                >
                  {marker.name}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Markers list */}
        <div className="mt-3 flex gap-2 flex-wrap">
          {userMarkers.map((marker, index) => (
            <button
              key={index}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all hover:scale-105 text-white"
              style={{ backgroundColor: marker.color }}
              onClick={() => onMarkerClick(marker, index)}
            >
              📍 {marker.name}
              <span
                className="ml-2 opacity-70 cursor-pointer hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkerDelete(index);
                }}
              >
                ✕
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
