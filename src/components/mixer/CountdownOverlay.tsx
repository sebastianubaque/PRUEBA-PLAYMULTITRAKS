import { useEffect, useState, useRef } from 'react';

interface CountdownOverlayProps {
  count: number;
  beatDuration: number;
  onComplete: () => void;
}

export function CountdownOverlay({ count, beatDuration, onComplete }: CountdownOverlayProps) {
  const [currentCount, setCurrentCount] = useState(count);
  const [scale, setScale] = useState(false);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    hasCompletedRef.current = false;
    setCurrentCount(count);
  }, [count]);

  useEffect(() => {
    if (hasCompletedRef.current || currentCount <= 0) {
      if (currentCount <= 0 && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        onComplete();
      }
      return;
    }

    setScale(true);
    const scaleTimeout = setTimeout(() => setScale(false), 100);

    const interval = setTimeout(() => {
      setCurrentCount(prev => prev - 1);
    }, beatDuration);

    return () => {
      clearTimeout(interval);
      clearTimeout(scaleTimeout);
    };
  }, [currentCount, beatDuration, onComplete]);

  if (currentCount <= 0) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] pointer-events-none">
      <div
        className={`text-[120px] font-bold text-secondary transition-transform duration-100 ${
          scale ? 'scale-125' : 'scale-100'
        }`}
        style={{ textShadow: '0 0 30px rgba(255, 255, 255, 0.8)' }}
      >
        {currentCount}
      </div>
    </div>
  );
}
