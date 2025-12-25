import { useState } from 'react';
import { MARKER_TYPES, ClickBeat, UserMarker } from '@/types/mixer';

interface MarkerSelectorProps {
  beat: ClickBeat;
  customMarkerTypes: Record<string, string>;
  onAddMarker: (marker: UserMarker) => void;
  onAddCustomType: (name: string, color: string) => void;
  onClose: () => void;
}

export function MarkerSelector({
  beat,
  customMarkerTypes,
  onAddMarker,
  onAddCustomType,
  onClose,
}: MarkerSelectorProps) {
  const [customName, setCustomName] = useState('');
  const [customColor, setCustomColor] = useState('#10b981');

  const allMarkerTypes = { ...MARKER_TYPES, ...customMarkerTypes };

  const handleSelectMarker = (name: string, color: string) => {
    onAddMarker({
      time: beat.time,
      name,
      beatNumber: beat.number,
      percentage: beat.percentage,
      color
    });
    onClose();
  };

  const handleAddCustom = () => {
    if (customName.trim()) {
      onAddCustomType(customName, customColor);
      onAddMarker({
        time: beat.time,
        name: customName,
        beatNumber: beat.number,
        percentage: beat.percentage,
        color: customColor
      });
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-[10000] flex items-center justify-center p-5"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card rounded-2xl p-8 max-w-[600px] w-full max-h-[80vh] overflow-y-auto shadow-2xl">
        <h2 className="text-2xl font-bold mb-6 text-center text-foreground">
          Seleccionar Marcador - Beat {beat.number}
        </h2>
        
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 mb-6">
          {Object.entries(allMarkerTypes).map(([name, color]) => (
            <button
              key={name}
              onClick={() => handleSelectMarker(name, color)}
              className="p-3 rounded-lg text-white font-bold text-sm transition-all hover:scale-105 shadow-md hover:shadow-lg"
              style={{ backgroundColor: color }}
            >
              {name}
            </button>
          ))}
        </div>
        
        <div className="mt-6 pt-6 border-t-2 border-primary/40">
          <h3 className="text-lg font-bold mb-4 text-foreground">
            Crear Marcador Personalizado
          </h3>
          
          <div className="flex gap-3 mb-3">
            <input
              type="text"
              placeholder="Nombre del marcador"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="flex-1 p-3 rounded-lg border-2 border-primary bg-background text-foreground text-sm"
            />
            <input
              type="color"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="w-15 h-11 border-none rounded-lg cursor-pointer"
            />
            <button
              onClick={handleAddCustom}
              className="px-5 py-3 rounded-lg bg-secondary text-secondary-foreground font-bold text-lg"
            >
              ✓
            </button>
          </div>
        </div>
        
        <button
          onClick={onClose}
          className="w-full p-3 mt-6 rounded-lg bg-primary text-primary-foreground font-bold text-base"
        >
          ✕ Cerrar
        </button>
      </div>
    </div>
  );
}
