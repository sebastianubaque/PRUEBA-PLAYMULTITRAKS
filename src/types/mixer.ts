export interface AudioTrack {
  name: string;
  audio: HTMLAudioElement;
  audioContext: AudioContext;
  source: MediaElementAudioSourceNode;
  gainNode: GainNode;
  pannerNode: StereoPannerNode;
  analyser?: AnalyserNode;
  volume: number;
  pan: number;
  url: string;
  muted: boolean;
}

export interface SavedTrack {
  name: string;
  volume: number;
  pan: number;
  url: string;
  muted: boolean;
}

export interface ClickBeat {
  time: number;
  number: number;
  percentage: number;
  isStrong: boolean;
}

export interface BeatMarker {
  time: number;
  number: number;
  percentage: number;
}

export interface UserMarker {
  time: number;
  name: string;
  beatNumber: number;
  percentage: number;
  color: string;
}

export interface Project {
  name: string;
  files: File[];
  tracks: SavedTrack[];
  beatMarkers: BeatMarker[];
  beatLabels: string[];
  clickBeats: ClickBeat[];
  userMarkers: UserMarker[];
  bpm: number;
  zoomLevel: number;
  countBeats: number;
}

// For localStorage (without File objects)
export interface SavedProject {
  name: string;
  tracks: SavedTrack[];
  beatMarkers: BeatMarker[];
  beatLabels: string[];
  clickBeats: ClickBeat[];
  userMarkers: UserMarker[];
  bpm: number;
  zoomLevel: number;
  countBeats: number;
}

export interface SavedMixerState {
  projects: SavedProject[];
  customMarkerTypes: Record<string, string>;
  masterVolume: number;
}

export interface ActiveLoop {
  startTime: number;
  endTime: number;
  startPercentage: number;
  endPercentage: number;
}

export const MARKER_TYPES: Record<string, string> = {
  'Intro 1': '#FF6B6B',
  'Intro 2': '#FF8787',
  'Intro 3': '#FFA5A5',
  'Intro 4': '#FFC2C2',
  'Intro 5': '#FFE0E0',
  'Verso 1': '#9B59B6',
  'Verso 2': '#A569BD',
  'Verso 3': '#AF7AC5',
  'Verso 4': '#BB8FCE',
  'Verso 5': '#C39BD3',
  'Precoro 1': '#4ECDC4',
  'Precoro 2': '#5DD6CE',
  'Precoro 3': '#6CDFD8',
  'Precoro 4': '#7BE8E2',
  'Precoro 5': '#8AF1EC',
  'Coro 1': '#45B7D1',
  'Coro 2': '#5AC1D6',
  'Coro 3': '#6FCBDB',
  'Coro 4': '#84D5E0',
  'Coro 5': '#99DFE5',
  'Puente 1': '#E67E22',
  'Puente 2': '#EB984E',
  'Puente 3': '#F0B27A',
  'Puente 4': '#F5CBA7',
  'Puente 5': '#FAE5D3',
  'Instrumental': '#95E1D3',
  'Interludio': '#F38181',
  'Corte': '#AA4465',
  'Solo': '#FDCB6E',
  'Batería': '#6C5CE7',
  'Baja Intensidad': '#74B9FF',
  'Final': '#FF7675',
  'Toda la Banda': '#2ECC71',
  'Solo Voces': '#E91E63',
  'Solo Piano': '#3498DB',
  'Solo Guitarra': '#F39C12'
};
