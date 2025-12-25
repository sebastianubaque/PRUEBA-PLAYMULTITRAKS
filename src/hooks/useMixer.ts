import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  AudioTrack, 
  Project, 
  ClickBeat, 
  BeatMarker, 
  UserMarker, 
  ActiveLoop,
  SavedTrack,
  SavedProject,
  SavedMixerState
} from '@/types/mixer';

const STORAGE_KEY = 'mixer_state';

function loadFromStorage(): SavedMixerState | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading from localStorage:', e);
  }
  return null;
}

function saveToStorage(state: SavedMixerState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Error saving to localStorage:', e);
  }
}

export function useMixer() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectIndex, setCurrentProjectIndex] = useState(-1);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [countBeats, setCountBeats] = useState(4);
  const [clickBeats, setClickBeats] = useState<ClickBeat[]>([]);
  const [beatMarkers, setBeatMarkers] = useState<BeatMarker[]>([]);
  const [userMarkers, setUserMarkers] = useState<UserMarker[]>([]);
  const [activeLoop, setActiveLoop] = useState<ActiveLoop | null>(null);
  const [masterVolume, setMasterVolume] = useState(75);
  const [customMarkerTypes, setCustomMarkerTypes] = useState<Record<string, string>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  
  const animationFrameRef = useRef<number | null>(null);
  const audioTracksRef = useRef<AudioTrack[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef(0);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const loopJumpInProgressRef = useRef(false);
  const isMountedRef = useRef(true);

  // Track hook mount status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Keep ref in sync with state
  audioTracksRef.current = audioTracks;

  // Loop between markers
  const setLoop = useCallback((startMarker: UserMarker | null, endMarker: UserMarker | null) => {
    if (startMarker && endMarker) {
      setActiveLoop({
        startTime: startMarker.time,
        endTime: endMarker.time,
        startPercentage: startMarker.percentage,
        endPercentage: endMarker.percentage
      });
    } else {
      setActiveLoop(null);
    }
  }, []);

  const clearLoop = useCallback(() => {
    setActiveLoop(null);
  }, []);

  // Check loop boundaries during playback - optimized for seamless transition
  const checkLoopBoundary = useCallback(() => {
    if (!activeLoop || audioTracksRef.current.length === 0) {
      loopJumpInProgressRef.current = false;
      return;
    }

    if (loopJumpInProgressRef.current) return;

    const currentTime = audioTracksRef.current[0]?.audio?.currentTime || 0;
    // Pre-seek slightly before the loop end to eliminate lag
    const loopBuffer = 0.05; // 50ms buffer before loop end

    if (currentTime >= activeLoop.endTime - loopBuffer) {
      loopJumpInProgressRef.current = true;
      const targetTime = activeLoop.startTime;

      const waitForSeekReady = (audio: HTMLAudioElement, timeoutMs = 4000) =>
        new Promise<void>((resolve) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            resolve();
          };

          const timeout = window.setTimeout(finish, timeoutMs);
          const cleanupAndFinish = () => {
            window.clearTimeout(timeout);
            finish();
          };

          audio.addEventListener('seeked', cleanupAndFinish, { once: true });
          audio.addEventListener('canplay', cleanupAndFinish, { once: true });
          audio.addEventListener('error', cleanupAndFinish, { once: true });
        });

      audioTracksRef.current.forEach(track => {
        const audioAny = track.audio as any;
        if (typeof audioAny.fastSeek === 'function') {
          audioAny.fastSeek(targetTime);
        } else {
          track.audio.currentTime = targetTime;
        }
      });

      const audios = audioTracksRef.current.map((t) => t.audio);
      Promise.all(audios.map((a) => waitForSeekReady(a))).finally(() => {
        if (!isMountedRef.current) return;
        // Ensure playback continues (some browsers briefly pause on seek)
        audioTracksRef.current.forEach(track => {
          if (track.audio.paused) {
            track.audio.play().catch(() => {});
          }
        });
        loopJumpInProgressRef.current = false;
      });
    }
  }, [activeLoop]);

  // Optimized progress update using refs (no state updates)
  const updateProgress = useCallback(() => {
    if (audioTracksRef.current.length > 0 && audioTracksRef.current[0]?.audio) {
      const audio = audioTracksRef.current[0].audio;
      currentTimeRef.current = audio.currentTime;
      durationRef.current = audio.duration || 0;
      progressRef.current = durationRef.current > 0 ? (audio.currentTime / audio.duration) * 100 : 0;
      
      // Check loop
      checkLoopBoundary();
    }
  }, [checkLoopBoundary]);

  // Load saved state on mount
  useEffect(() => {
    const saved = loadFromStorage();
    if (saved) {
      setCustomMarkerTypes(saved.customMarkerTypes || {});
      setMasterVolume(saved.masterVolume || 75);
      // Projects need files to be re-uploaded, but we keep the metadata
      if (saved.projects && saved.projects.length > 0) {
        const restoredProjects: Project[] = saved.projects.map(p => ({
          ...p,
          files: [] // Files need to be re-uploaded
        }));
        setProjects(restoredProjects);
      }
    }
    setIsInitialized(true);
  }, []);

  // Debounced save to localStorage
  const debouncedSave = useCallback(() => {
    if (!isInitialized) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      const savedProjects: SavedProject[] = projects.map(p => ({
        name: p.name,
        tracks: p.tracks || [],
        beatMarkers: p.beatMarkers || [],
        beatLabels: p.beatLabels || [],
        clickBeats: p.clickBeats || [],
        userMarkers: p.userMarkers || [],
        bpm: p.bpm || 120,
        zoomLevel: p.zoomLevel || 1,
        countBeats: p.countBeats || 4
      }));
      
      saveToStorage({
        projects: savedProjects,
        customMarkerTypes,
        masterVolume
      });
    }, 500);
  }, [projects, customMarkerTypes, masterVolume, isInitialized]);

  // Auto-save when state changes
  useEffect(() => {
    debouncedSave();
  }, [projects, customMarkerTypes, masterVolume, debouncedSave]);

  const getMasterVolume = useCallback(() => masterVolume, [masterVolume]);

  const updateAudioVolume = useCallback((track: AudioTrack) => {
    if (track.gainNode) {
      const masterVol = masterVolume / 100;
      const trackVol = track.volume / 100;
      track.gainNode.gain.value = trackVol * masterVol;
    }
  }, [masterVolume]);

  const updateAudioPan = useCallback((track: AudioTrack) => {
    if (track.pannerNode) {
      track.pannerNode.pan.value = track.pan / 100;
    }
  }, []);

  const stopAllAudio = useCallback(() => {
    setIsPlaying(false);
    setIsPaused(false);
    
    audioTracksRef.current.forEach(track => {
      if (track.audio) {
        track.audio.pause();
        track.audio.currentTime = 0;
      }
    });
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const playAll = useCallback(() => {
    if (audioTracksRef.current.length === 0) return;

    setIsPlaying(true);
    setIsPaused(false);

    // Resume each AudioContext once (projects now share a single context)
    const contextsToResume = new Set<AudioContext>();
    audioTracksRef.current.forEach(track => contextsToResume.add(track.audioContext));
    contextsToResume.forEach(ctx => ctx.resume());

    audioTracksRef.current.forEach(track => {
      track.audio.play();
    });
  }, []);

  const pauseAll = useCallback(() => {
    if (audioTracksRef.current.length === 0) return;
    
    if (isPlaying && !isPaused) {
      setIsPaused(true);
      setIsPlaying(false);
      audioTracksRef.current.forEach(track => {
        track.audio.pause();
      });
    } else if (isPaused) {
      setIsPaused(false);
      setIsPlaying(true);
      audioTracksRef.current.forEach(track => {
        track.audio.play();
      });
    }
  }, [isPlaying, isPaused]);

  const stopAll = useCallback(() => {
    setIsPlaying(false);
    setIsPaused(false);
    audioTracksRef.current.forEach(track => {
      track.audio.pause();
      track.audio.currentTime = 0;
    });
  }, []);

  const saveCurrentProjectState = useCallback(() => {
    if (currentProjectIndex === -1 || currentProjectIndex >= projects.length) return;
    
    setProjects(prev => {
      const newProjects = [...prev];
      newProjects[currentProjectIndex] = {
        ...newProjects[currentProjectIndex],
        beatMarkers,
        clickBeats,
        userMarkers,
        zoomLevel,
        countBeats,
        tracks: audioTracksRef.current.map(track => ({
          name: track.name,
          volume: track.volume,
          pan: track.pan,
          url: track.url,
          muted: track.muted
        }))
      };
      return newProjects;
    });
  }, [currentProjectIndex, projects.length, beatMarkers, clickBeats, userMarkers, zoomLevel, countBeats]);

  const detectClickAccents = useCallback(async (clickTrack: AudioTrack) => {
    const duration = clickTrack.audio.duration || 0;
    if (duration === 0) return;
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const response = await fetch(clickTrack.audio.src);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      
      const accents: { time: number; percentage: number; amplitude: number }[] = [];
      const threshold = 0.3;
      const minDistance = sampleRate * 0.3;
      
      let lastPeakIndex = -minDistance;
      
      for (let i = 0; i < channelData.length; i++) {
        const amplitude = Math.abs(channelData[i]);
        
        if (amplitude > threshold && (i - lastPeakIndex) > minDistance) {
          const time = i / sampleRate;
          accents.push({
            time: time,
            percentage: (time / duration) * 100,
            amplitude: amplitude
          });
          lastPeakIndex = i;
        }
      }
      
      const newBeatMarkers = accents.map((accent, index) => ({
        time: accent.time,
        number: index + 1,
        percentage: accent.percentage
      }));
      
      const newClickBeats = accents.map((accent, index) => ({
        time: accent.time,
        number: index + 1,
        percentage: accent.percentage,
        isStrong: index % 4 === 0
      }));
      
      setBeatMarkers(newBeatMarkers);
      setClickBeats(newClickBeats);
      
      audioContext.close();
      
      return { beatMarkers: newBeatMarkers, clickBeats: newClickBeats };
    } catch (err) {
      console.error('Error detectando acentos:', err);
    }
  }, []);

  const loadProject = useCallback(async (index: number) => {
    if (index < 0 || index >= projects.length) return;
    
    stopAllAudio();
    
    setCurrentProjectIndex(index);
    const project = projects[index];
    
    setBeatMarkers(project.beatMarkers || []);
    setClickBeats(project.clickBeats || []);
    setUserMarkers(project.userMarkers || []);
    setZoomLevel(project.zoomLevel || 1);
    setCountBeats(project.countBeats || 4);
    
    // Clean up old audio tracks (close each AudioContext once)
    const contextsToClose = new Set<AudioContext>();
    audioTracksRef.current.forEach(track => {
      if (track.audio) {
        track.audio.pause();
        track.audio.src = '';
      }
      if (track.audioContext) {
        contextsToClose.add(track.audioContext);
      }
    });
    contextsToClose.forEach(ctx => {
      if (ctx.state !== 'closed') {
        ctx.close();
      }
    });
    
    const newTracks: AudioTrack[] = [];
    
    // Check if we have files to load (fresh upload) or need to re-upload
    if (project.files && project.files.length > 0) {
      // Use a single shared AudioContext for the whole project (much lower overhead)
      const sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      for (const file of project.files) {
        const audio = new Audio();
        const url = URL.createObjectURL(file);
        audio.src = url;
        audio.volume = 0.75;
        audio.preload = 'auto';

        await new Promise<void>(resolve => {
          audio.addEventListener('canplaythrough', () => resolve(), { once: true });
          audio.load();
        });

        const source = sharedAudioContext.createMediaElementSource(audio);
        const gainNode = sharedAudioContext.createGain();

        // Restore saved volume/mute state if available
        const savedTrack = project.tracks?.find(t => t.name === file.name.replace(/\.(mp3|MP3|wav|WAV)$/, ''));
        const volume = savedTrack?.volume ?? 75;
        const pan = savedTrack?.pan ?? 0;
        const muted = savedTrack?.muted ?? false;

        gainNode.gain.value = muted ? 0 : volume / 100;
        const pannerNode = sharedAudioContext.createStereoPanner();
        pannerNode.pan.value = pan / 100;
        const analyser = sharedAudioContext.createAnalyser();
        analyser.fftSize = 64;

        source.connect(gainNode);
        gainNode.connect(analyser);
        gainNode.connect(pannerNode);
        pannerNode.connect(sharedAudioContext.destination);

        const trackName = file.name.replace(/\.(mp3|MP3|wav|WAV)$/, '');

        newTracks.push({
          name: trackName,
          audio,
          audioContext: sharedAudioContext,
          source,
          gainNode,
          pannerNode,
          analyser,
          volume,
          pan,
          url,
          muted,
        });
      }

      // Save initial track state
      setProjects(prev => {
        const newProjects = [...prev];
        newProjects[index] = {
          ...newProjects[index],
          tracks: newTracks.map(track => ({
            name: track.name,
            volume: track.volume,
            pan: track.pan,
            url: track.url,
            muted: track.muted,
          })),
        };
        return newProjects;
      });
    }
    
    setAudioTracks(newTracks);
  }, [projects, stopAllAudio]);

  const addProject = useCallback((files: File[]) => {
    const projectsByFolder: Record<string, File[]> = {};
    
    files.forEach(file => {
      if (file.webkitRelativePath) {
        const folderPath = file.webkitRelativePath.split('/');
        const folderName = folderPath[0];
        
        if (!projectsByFolder[folderName]) {
          projectsByFolder[folderName] = [];
        }
        projectsByFolder[folderName].push(file);
      }
    });
    
    const newProjects: Project[] = [];
    
    Object.keys(projectsByFolder).forEach(folderName => {
      const projectFiles = projectsByFolder[folderName];
      const audioFiles = projectFiles.filter(file => {
        const fileName = file.name.toLowerCase();
        return fileName.endsWith('.mp3') || 
               fileName.endsWith('.wav') || 
               file.type === 'audio/mpeg' || 
               file.type === 'audio/wav' || 
               file.type === 'audio/wave' || 
               file.type === 'audio/x-wav';
      });
      
      if (audioFiles.length > 0) {
        // Check if project already exists (from localStorage)
        const existingIndex = projects.findIndex(p => p.name === folderName);
        
        if (existingIndex >= 0) {
          // Update existing project with new files
          setProjects(prev => {
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              files: audioFiles
            };
            return updated;
          });
        } else {
          newProjects.push({
            name: folderName,
            files: audioFiles,
            tracks: [],
            beatMarkers: [],
            beatLabels: [],
            clickBeats: [],
            userMarkers: [],
            bpm: 120,
            zoomLevel: 1,
            countBeats: 4
          });
        }
      }
    });
    
    if (newProjects.length > 0) {
      setProjects(prev => [...prev, ...newProjects]);
      return newProjects.length;
    }
    
    // Return count of updated projects
    return Object.keys(projectsByFolder).length;
  }, [projects]);

  const deleteProject = useCallback((index: number) => {
    if (index < 0 || index >= projects.length) return;
    
    setProjects(prev => prev.filter((_, i) => i !== index));
    
    if (currentProjectIndex === index) {
      stopAllAudio();
      setAudioTracks([]);
      
      if (projects.length > 1) {
        const newIndex = Math.min(index, projects.length - 2);
        setTimeout(() => loadProject(newIndex), 0);
      } else {
        setCurrentProjectIndex(-1);
      }
    } else if (currentProjectIndex > index) {
      setCurrentProjectIndex(prev => prev - 1);
    }
  }, [projects, currentProjectIndex, stopAllAudio, loadProject]);

  const updateTrackVolume = useCallback((index: number, volume: number) => {
    setAudioTracks(prev => {
      const newTracks = [...prev];
      if (newTracks[index]) {
        newTracks[index].volume = volume;
        if (!newTracks[index].muted && newTracks[index].gainNode) {
          const masterVol = masterVolume / 100;
          newTracks[index].gainNode.gain.value = (volume / 100) * masterVol;
        }
      }
      return newTracks;
    });
  }, [masterVolume]);

  const updateTrackPan = useCallback((index: number, pan: number) => {
    setAudioTracks(prev => {
      const newTracks = [...prev];
      if (newTracks[index]) {
        newTracks[index].pan = pan;
        if (newTracks[index].pannerNode) {
          newTracks[index].pannerNode.pan.value = pan / 100;
        }
      }
      return newTracks;
    });
  }, []);

  const toggleMute = useCallback((index: number) => {
    setAudioTracks(prev => {
      const newTracks = [...prev];
      if (newTracks[index]) {
        newTracks[index].muted = !newTracks[index].muted;
        if (newTracks[index].gainNode) {
          if (newTracks[index].muted) {
            newTracks[index].gainNode.gain.value = 0;
          } else {
            const masterVol = masterVolume / 100;
            newTracks[index].gainNode.gain.value = (newTracks[index].volume / 100) * masterVol;
          }
        }
      }
      return newTracks;
    });
  }, [masterVolume]);

  const toggleSolo = useCallback((index: number) => {
    setAudioTracks(prev => {
      const track = prev[index];
      const isSoloed = prev.some((t, i) => i === index && !t.muted && prev.filter((_, j) => j !== index).every(other => other.gainNode?.gain.value === 0));
      
      if (isSoloed) {
        // Unsolo - restore all volumes
        return prev.map(t => {
          if (t.gainNode && !t.muted) {
            t.gainNode.gain.value = (t.volume / 100) * (masterVolume / 100);
          }
          return t;
        });
      } else {
        // Solo this track
        return prev.map((t, i) => {
          if (t.gainNode) {
            if (i === index) {
              if (!t.muted) {
                t.gainNode.gain.value = (t.volume / 100) * (masterVolume / 100);
              }
            } else {
              t.gainNode.gain.value = 0;
            }
          }
          return t;
        });
      }
    });
  }, [masterVolume]);

  const seekTo = useCallback((percentage: number) => {
    if (audioTracksRef.current.length === 0) return;
    
    const duration = audioTracksRef.current[0].audio.duration || 0;
    const newTime = duration * percentage;
    
    audioTracksRef.current.forEach(track => {
      track.audio.currentTime = newTime;
    });
  }, []);

  const automateClick = useCallback(async () => {
    if (audioTracksRef.current.length === 0) return null;
    
    audioTracksRef.current.forEach((track, index) => {
      const trackName = track.name.toLowerCase();
      
      if (trackName.includes('click') || trackName.includes('guia') || trackName.includes('guía')) {
        track.pannerNode.pan.value = -1;
        track.pan = -100;
      } else {
        track.pannerNode.pan.value = 1;
        track.pan = 100;
      }
    });
    
    setAudioTracks([...audioTracksRef.current]);
    
    const clickTrack = audioTracksRef.current.find(track => {
      const name = track.name.toLowerCase();
      return name.includes('click');
    });
    
    if (clickTrack) {
      return await detectClickAccents(clickTrack);
    }
    
    return null;
  }, [detectClickAccents]);

  const addUserMarker = useCallback((marker: UserMarker) => {
    setUserMarkers(prev => [...prev, marker]);
  }, []);

  const removeUserMarker = useCallback((index: number) => {
    setUserMarkers(prev => prev.filter((_, i) => i !== index));
  }, []);

  const addCustomMarkerType = useCallback((name: string, color: string) => {
    setCustomMarkerTypes(prev => ({ ...prev, [name]: color }));
  }, []);

  // Export projects to file
  const exportProjects = useCallback(() => {
    const savedProjects: SavedProject[] = projects.map(p => ({
      name: p.name,
      tracks: p.tracks || [],
      beatMarkers: p.beatMarkers || [],
      beatLabels: p.beatLabels || [],
      clickBeats: p.clickBeats || [],
      userMarkers: p.userMarkers || [],
      bpm: p.bpm || 120,
      zoomLevel: p.zoomLevel || 1,
      countBeats: p.countBeats || 4
    }));
    
    const data: SavedMixerState = {
      projects: savedProjects,
      customMarkerTypes,
      masterVolume
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mixer-projects.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [projects, customMarkerTypes, masterVolume]);

  // Import projects from file
  const importProjects = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data: SavedMixerState = JSON.parse(e.target?.result as string);
        if (data.projects) {
          const restoredProjects: Project[] = data.projects.map(p => ({
            ...p,
            files: []
          }));
          setProjects(restoredProjects);
        }
        if (data.customMarkerTypes) {
          setCustomMarkerTypes(data.customMarkerTypes);
        }
        if (data.masterVolume !== undefined) {
          setMasterVolume(data.masterVolume);
        }
      } catch (err) {
        console.error('Error importing projects:', err);
      }
    };
    reader.readAsText(file);
  }, []);

  return {
    // State
    projects,
    currentProjectIndex,
    audioTracks,
    isPlaying,
    isPaused,
    zoomLevel,
    countBeats,
    clickBeats,
    beatMarkers,
    userMarkers,
    activeLoop,
    masterVolume,
    customMarkerTypes,
    audioTracksRef,
    animationFrameRef,
    progressRef,
    currentTimeRef,
    durationRef,
    
    // Setters
    setZoomLevel,
    setCountBeats,
    setActiveLoop,
    setMasterVolume,
    setIsPlaying,
    setIsPaused,
    
    // Actions
    getMasterVolume,
    updateAudioVolume,
    updateAudioPan,
    updateProgress,
    stopAllAudio,
    playAll,
    pauseAll,
    stopAll,
    saveCurrentProjectState,
    detectClickAccents,
    loadProject,
    addProject,
    deleteProject,
    updateTrackVolume,
    updateTrackPan,
    toggleMute,
    toggleSolo,
    seekTo,
    automateClick,
    addUserMarker,
    removeUserMarker,
    addCustomMarkerType,
    setLoop,
    clearLoop,
    exportProjects,
    importProjects,
  };
}
