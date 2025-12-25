import { useRef, useState, useEffect, useCallback } from 'react';
import { useMixer } from '@/hooks/useMixer';
import { Channel } from './Channel';
import { Timeline } from './Timeline';
import { MasterChannel } from './MasterChannel';
import { ProjectTabs } from './ProjectTabs';
import { MarkerSelector } from './MarkerSelector';
import { CountdownOverlay } from './CountdownOverlay';
import { ClickBeat, UserMarker } from '@/types/mixer';
import { toast } from 'sonner';

export function Mixer() {
  const {
    projects,
    currentProjectIndex,
    audioTracks,
    isPlaying,
    isPaused,
    zoomLevel,
    countBeats,
    clickBeats,
    userMarkers,
    activeLoop,
    masterVolume,
    customMarkerTypes,
    audioTracksRef,
    progressRef,
    currentTimeRef,
    durationRef,
    setZoomLevel,
    setCountBeats,
    setMasterVolume,
    playAll,
    pauseAll,
    stopAll,
    saveCurrentProjectState,
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
    updateProgress,
    exportProjects,
    importProjects,
  } = useMixer();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const timeDisplayRef = useRef<HTMLDivElement>(null);
  const [selectedBeat, setSelectedBeat] = useState<ClickBeat | null>(null);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownCount, setCountdownCount] = useState(4);
  const [countdownBeatDuration, setCountdownBeatDuration] = useState(500);
  const [pendingMarker, setPendingMarker] = useState<UserMarker | null>(null);
  const [surroundingMarkers, setSurroundingMarkers] = useState<{ prev: UserMarker | null; next: UserMarker | null }>({ prev: null, next: null });
  const pendingJumpRef = useRef<{ marker: UserMarker; beatDuration: number } | null>(null);
  const waitForBeatTimeoutRef = useRef<number | null>(null);
  const countdownJumpTimeoutRef = useRef<number | null>(null);
  const countdownCutTimeoutRef = useRef<number | null>(null);
  const guidePreviewRef = useRef<HTMLAudioElement | null>(null);
  const originalGuideVolumeRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  // Track component mount status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importProjects(file);
      toast.success('Proyectos importados correctamente');
    }
    e.target.value = '';
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Update time display and detect surrounding markers
  useEffect(() => {
    let animFrame: number;
    
    const updateTimeDisplay = () => {
      if (timeDisplayRef.current && audioTracksRef.current.length > 0) {
        const current = currentTimeRef.current;
        const duration = durationRef.current;
        timeDisplayRef.current.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
        
        // Detect surrounding markers
        if (userMarkers.length >= 2) {
          const sortedMarkers = [...userMarkers].sort((a, b) => a.time - b.time);
          let prevMarker: UserMarker | null = null;
          let nextMarker: UserMarker | null = null;
          
          for (let i = 0; i < sortedMarkers.length; i++) {
            if (sortedMarkers[i].time <= current) {
              prevMarker = sortedMarkers[i];
            }
            if (sortedMarkers[i].time > current && !nextMarker) {
              nextMarker = sortedMarkers[i];
              break;
            }
          }
          
          setSurroundingMarkers(prev => {
            if (prev.prev?.time !== prevMarker?.time || prev.next?.time !== nextMarker?.time) {
              return { prev: prevMarker, next: nextMarker };
            }
            return prev;
          });
        }
      }
      if (isPlaying) {
        animFrame = requestAnimationFrame(updateTimeDisplay);
      }
    };
    
    if (isPlaying) {
      updateTimeDisplay();
    } else {
      // Also update when paused/stopped to show current position markers
      updateTimeDisplay();
    }
    
    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
    };
  }, [isPlaying, audioTracksRef, currentTimeRef, durationRef, userMarkers]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const count = addProject(files);
    if (count > 0 && currentProjectIndex === -1) {
      await loadProject(0);
    }
    
    e.target.value = '';
  };

  const handleAutomate = async () => {
    if (audioTracks.length === 0 || currentProjectIndex === -1) {
      toast.error('Por favor, carga archivos de audio primero');
      return;
    }
    
    toast.info('🤖 Automatizando mix...');
    
    const result = await automateClick();
    
    if (result) {
      toast.success('🎵 Detectando acentos del click...');
      setTimeout(() => {
        toast.success('✅ Automatización completada');
      }, 1000);
    } else {
      toast.warning('⚠️ No se encontró pista de Click');
    }
    
    saveCurrentProjectState();
  };

  const handleZoomIn = () => {
    if (zoomLevel < 4) {
      setZoomLevel(zoomLevel + 0.5);
      saveCurrentProjectState();
    }
  };

  const handleZoomOut = () => {
    if (zoomLevel > 0.5) {
      setZoomLevel(zoomLevel - 0.5);
      saveCurrentProjectState();
    }
  };

  const handleSeek = (percentage: number) => {
    seekTo(percentage);
  };

  const handleBeatClick = (beat: ClickBeat) => {
    setSelectedBeat(beat);
  };

  const handleMarkerClick = (marker: UserMarker, index: number) => {
    if (audioTracks.length === 0) return;
    
    if (clickBeats.length === 0) {
      toast.warning('⚠️ No hay beats detectados. Primero automatiza el mix.');
      return;
    }
    
    // If not playing, just seek to marker directly
    if (!isPlaying) {
      audioTracksRef.current.forEach(track => {
        track.audio.currentTime = marker.time;
      });
      toast.success(`📍 Posición: ${marker.name}`);
      return;
    }
    
    // Cancel any previous pending jump (without toast)
    cancelPendingJump({ silent: true });

    // Find the guide track
    const guideTrack = audioTracksRef.current.find(track => {
      const name = track.name.toLowerCase();
      return name.includes('guia') || name.includes('guía');
    });
    
    if (!guideTrack) {
      toast.warning('⚠️ No se encontró pista de guía');
      return;
    }
    
    const currentTime = currentTimeRef.current;
    
    // Find next STRONG beat after current time
    const strongBeats = clickBeats.filter(beat => beat.isStrong);
    const nextStrongBeat = strongBeats.find(beat => beat.time > currentTime);
    if (!nextStrongBeat) {
      toast.warning('⚠️ No hay más beats fuertes adelante');
      return;
    }
    
    // Calculate beat duration using ALL beats (including weak ones)
    const avgBeatDuration = clickBeats.length > 1 
      ? (clickBeats[clickBeats.length - 1].time - clickBeats[0].time) / (clickBeats.length - 1)
      : 0.5;
    
    // Calculate start time for guide preview (N beats before marker)
    const guidePreviewStart = marker.time - (countBeats * avgBeatDuration);
    if (guidePreviewStart < 0) {
      toast.warning(`⚠️ No hay suficientes beats antes del marcador`);
      return;
    }
    
    const timeUntilNextBeat = (nextStrongBeat.time - currentTime) * 1000;
    
    // Store pending jump info
    pendingJumpRef.current = { marker, beatDuration: avgBeatDuration * 1000 };
    setPendingMarker(marker);
    
    toast.info(`⏳ Esperando al próximo beat fuerte...`);

    // Wait until next strong beat, then start countdown with guide preview
    waitForBeatTimeoutRef.current = window.setTimeout(() => {
      waitForBeatTimeoutRef.current = null;
      if (!pendingJumpRef.current) return;

      const { marker: targetMarker, beatDuration } = pendingJumpRef.current;
      const jumpToken = targetMarker.time;

      // Mute the main guide track and save original volume
      originalGuideVolumeRef.current = guideTrack.gainNode.gain.value;
      guideTrack.gainNode.gain.value = 0;

      // Create guide preview audio (separate instance)
      if (guidePreviewRef.current) {
        guidePreviewRef.current.pause();
        guidePreviewRef.current = null;
      }

      const guidePreview = new Audio(guideTrack.url);
      guidePreview.currentTime = guidePreviewStart;
      guidePreview.volume = 0.9; // Loud enough to hear over the mix
      guidePreviewRef.current = guidePreview;

      // Play the guide preview
      guidePreview.play().catch(e => console.error('Error playing guide preview:', e));

      // Start countdown
      setCountdownCount(countBeats);
      setCountdownBeatDuration(beatDuration);
      setShowCountdown(true);

      // Jump when countdown finishes - optimized for zero lag
      const countdownDuration = beatDuration * countBeats;

      // Start seeking slightly before the countdown ends so tracks can buffer in advance,
      // but keep the guide preview running until BOTH:
      // 1) the countdown ended AND 2) the main tracks are actually playing again.
      const preBufferTime = 50; // ms before countdown ends to start seeking
      const jumpDelay = Math.max(0, countdownDuration - preBufferTime);

      let cutReached = false;
      let tracksReady = false;
      let completed = false;

      const tryCompleteJump = () => {
        if (completed) return;
        if (!cutReached || !tracksReady) return;
        if (!isMountedRef.current) return;
        if (!pendingJumpRef.current || pendingJumpRef.current.marker.time !== jumpToken) return;

        completed = true;

        // Stop guide preview
        if (guidePreviewRef.current) {
          guidePreviewRef.current.pause();
          guidePreviewRef.current = null;
        }

        // Restore main guide track volume
        if (originalGuideVolumeRef.current !== null) {
          guideTrack.gainNode.gain.value = originalGuideVolumeRef.current;
          originalGuideVolumeRef.current = null;
        }

        pendingJumpRef.current = null;
        setPendingMarker(null);
        toast.success(`✅ ${targetMarker.name}`);
      };

      // Mark countdown end
      countdownCutTimeoutRef.current = window.setTimeout(() => {
        countdownCutTimeoutRef.current = null;
        if (!pendingJumpRef.current || pendingJumpRef.current.marker.time !== jumpToken) return;
        cutReached = true;
        tryCompleteJump();
      }, countdownDuration);

      const waitForPlaybackAdvance = (audio: HTMLAudioElement, timeoutMs = 2500) =>
        new Promise<void>((resolve) => {
          let done = false;
          let last = audio.currentTime;
          const start = performance.now();

          const finish = () => {
            if (done) return;
            done = true;
            resolve();
          };

          const tick = () => {
            if (done) return;
            if (!isMountedRef.current) return finish();
            if (!pendingJumpRef.current || pendingJumpRef.current.marker.time !== jumpToken) return finish();

            const now = performance.now();
            const t = audio.currentTime;
            if (!audio.paused && t - last > 0.02) return finish();
            if (now - start >= timeoutMs) return finish();

            last = t;
            window.setTimeout(tick, 50);
          };

          tick();
        });

      countdownJumpTimeoutRef.current = window.setTimeout(() => {
        countdownJumpTimeoutRef.current = null;
        if (!pendingJumpRef.current || pendingJumpRef.current.marker.time !== jumpToken) return;

        // Prepare all audio elements by seeking first (while guide preview still plays)
        const targetTime = targetMarker.time;

        // Seek all tracks simultaneously to target position (use fastSeek if available)
        audioTracksRef.current.forEach(track => {
          const audioAny = track.audio as any;
          if (typeof audioAny.fastSeek === 'function') {
            audioAny.fastSeek(targetTime);
          } else {
            track.audio.currentTime = targetTime;
          }
        });

        const waitForSeekReady = (audio: HTMLAudioElement, timeoutMs = 6000) =>
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

        const audios = audioTracksRef.current.map((t) => t.audio);

        Promise.all(audios.map((a) => waitForSeekReady(a)))
          .then(() => {
            // Ensure playback continues (some browsers briefly pause on seek)
            audioTracksRef.current.forEach(track => {
              track.audio.play().catch(() => {});
            });

            // Wait until at least the guide track time starts advancing again (avoids 1s silent gaps)
            return waitForPlaybackAdvance(guideTrack.audio);
          })
          .finally(() => {
            if (!isMountedRef.current) return;
            if (!pendingJumpRef.current || pendingJumpRef.current.marker.time !== jumpToken) return;
            tracksReady = true;
            tryCompleteJump();
          });
      }, jumpDelay);
    }, timeUntilNextBeat);
  };
  
  // Cancel pending jump
  function cancelPendingJump(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;
    const hadPending = !!pendingJumpRef.current;

    if (waitForBeatTimeoutRef.current) {
      clearTimeout(waitForBeatTimeoutRef.current);
      waitForBeatTimeoutRef.current = null;
    }

    if (countdownJumpTimeoutRef.current) {
      clearTimeout(countdownJumpTimeoutRef.current);
      countdownJumpTimeoutRef.current = null;
    }

    if (countdownCutTimeoutRef.current) {
      clearTimeout(countdownCutTimeoutRef.current);
      countdownCutTimeoutRef.current = null;
    }

    if (hadPending) {
      // Stop guide preview
      if (guidePreviewRef.current) {
        guidePreviewRef.current.pause();
        guidePreviewRef.current = null;
      }

      // Restore main guide track volume
      if (originalGuideVolumeRef.current !== null) {
        const guideTrack = audioTracksRef.current.find(track => {
          const name = track.name.toLowerCase();
          return name.includes('guia') || name.includes('guía');
        });
        if (guideTrack) {
          guideTrack.gainNode.gain.value = originalGuideVolumeRef.current;
        }
        originalGuideVolumeRef.current = null;
      }

      pendingJumpRef.current = null;
      setPendingMarker(null);
      setShowCountdown(false);

      if (!silent) {
        toast.info('Salto cancelado');
      }
    }
  }

  const isClickOrGuide = (trackName: string) => {
    const name = trackName.toLowerCase();
    return name.includes('click') || name.includes('guia') || name.includes('guía');
  };

  const handleMasterVolumeChange = (volume: number) => {
    setMasterVolume(volume);
    audioTracksRef.current.forEach(track => {
      if (!track.muted && track.gainNode) {
        track.gainNode.gain.value = (track.volume / 100) * (volume / 100);
      }
    });
  };

  const currentProject = currentProjectIndex >= 0 ? projects[currentProjectIndex] : null;

  return (
    <div className="min-h-full p-8 bg-background">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 text-foreground">
          Mezclador de Multitracks Para Iglesias
        </h1>
        <p className="text-lg opacity-80 text-foreground">Aplicativo Creado por Sebas</p>
        <p className="text-lg opacity-80 text-foreground">
          Sube tus archivos MP3/WAV y controla cada pista individualmente
        </p>
      </header>

      <div className="max-w-6xl mx-auto">
        {/* Upload section */}
        <div className="text-center mb-8">
          <label
            htmlFor="audio-files"
            className="inline-block px-8 py-4 rounded-lg cursor-pointer font-semibold text-lg transition-all hover:scale-105 bg-primary text-primary-foreground"
          >
            📁 Agregar Proyecto
          </label>
          <input
            ref={fileInputRef}
            type="file"
            id="audio-files"
            // @ts-ignore
            webkitdirectory="true"
            directory="true"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <p className="mt-2 text-sm opacity-70 text-foreground">
            Selecciona carpetas con tus archivos MP3/WAV - puedes agregar múltiples proyectos
          </p>
          
          <div className="mt-4 flex gap-2 justify-center">
            <button
              onClick={exportProjects}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-105 bg-secondary text-secondary-foreground"
            >
              💾 Exportar Proyectos
            </button>
            <label className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all hover:scale-105 bg-secondary text-secondary-foreground">
              📂 Importar Proyectos
              <input
                ref={importInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportFile}
              />
            </label>
          </div>

          <ProjectTabs
            projects={projects}
            currentIndex={currentProjectIndex}
            onSelectProject={loadProject}
            onDeleteProject={deleteProject}
          />
        </div>

        {/* Mixer container */}
        {currentProject && audioTracks.length > 0 ? (
          <div>
            {/* Controls section */}
            <div className="mb-6">
              <div className="mb-4 p-4 rounded-lg bg-card">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-2xl font-bold text-foreground">{currentProject.name}</h2>
                  <div ref={timeDisplayRef} className="text-2xl font-mono text-foreground">
                    00:00 / 00:00
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg mb-4 bg-card">
                <div className="flex items-center gap-4 mb-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={playAll}
                      className="w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all hover:scale-110 bg-secondary"
                    >
                      ▶️
                    </button>
                    <button
                      onClick={pauseAll}
                      className="w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all hover:scale-110 bg-primary"
                    >
                      ⏸️
                    </button>
                    <button
                      onClick={stopAll}
                      className="w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all hover:scale-110 bg-primary"
                    >
                      ⏹️
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="font-semibold text-foreground">Zoom:</label>
                    <button
                      onClick={handleZoomOut}
                      className="w-10 h-10 rounded flex items-center justify-center font-bold transition-all hover:scale-110 bg-card text-foreground border-2 border-primary"
                    >
                      −
                    </button>
                    <span className="font-mono text-foreground">{Math.round(zoomLevel * 100)}%</span>
                    <button
                      onClick={handleZoomIn}
                      className="w-10 h-10 rounded flex items-center justify-center font-bold transition-all hover:scale-110 bg-card text-foreground border-2 border-primary"
                    >
                      +
                    </button>
                  </div>
                </div>

                <Timeline
                  clickBeats={clickBeats}
                  userMarkers={userMarkers}
                  progressRef={progressRef}
                  zoomLevel={zoomLevel}
                  duration={audioTracks[0]?.audio.duration || 0}
                  isPlaying={isPlaying}
                  activeLoop={activeLoop}
                  onSeek={handleSeek}
                  onBeatClick={handleBeatClick}
                  onMarkerClick={handleMarkerClick}
                  onMarkerDelete={removeUserMarker}
                  onUpdateProgress={updateProgress}
                />

                <div className="flex items-center gap-4 flex-wrap mt-4">
                  <div className="flex items-center gap-2">
                    <label className="font-semibold text-foreground">Tiempos de Conteo:</label>
                    <select
                      value={countBeats}
                      onChange={(e) => {
                        setCountBeats(parseInt(e.target.value));
                        saveCurrentProjectState();
                        toast.success(`✅ Tiempos de conteo: ${e.target.value}`);
                      }}
                      className="px-3 py-2 rounded-lg border-2 font-semibold cursor-pointer bg-card text-foreground border-primary"
                    >
                      <option value={4}>4 Tiempos</option>
                      <option value={8}>8 Tiempos</option>
                    </select>
                  </div>

                  <button
                    onClick={handleAutomate}
                    className="px-6 py-2 rounded-lg font-semibold transition-all hover:scale-105 bg-secondary text-secondary-foreground"
                  >
                    🤖 Automatizar Mix
                  </button>

                  <a
                    href="https://vocalremover.org/es/pitch"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-2 rounded-lg font-semibold transition-all hover:scale-105 bg-indigo-600 text-white flex items-center gap-2"
                    title="Cambiar tono y semitonos de todos los canales"
                  >
                    🔄 Cambiar tono
                  </a>

                  {clickBeats.length > 0 && (
                    <div className="font-mono text-sm opacity-70 text-foreground">
                      {clickBeats.length} acentos detectados
                    </div>
                  )}

                  {/* Pending jump indicator */}
                  {pendingMarker && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary animate-pulse">
                      <span className="font-semibold text-secondary-foreground">
                        ⏳ Saltando a: {pendingMarker.name}
                      </span>
                      <button
                        onClick={() => cancelPendingJump()}
                        className="px-2 py-1 rounded text-sm font-bold bg-destructive text-destructive-foreground hover:scale-105 transition-all"
                      >
                        ✕ Cancelar
                      </button>
                    </div>
                  )}

                  {/* Loop controls - only show when between two markers */}
                  {surroundingMarkers.prev && surroundingMarkers.next && (
                    <div className="flex items-center gap-2">
                      {!activeLoop ? (
                        <button
                          onClick={() => {
                            if (surroundingMarkers.prev && surroundingMarkers.next) {
                              setLoop(surroundingMarkers.prev, surroundingMarkers.next);
                              toast.success(`🔁 Loop: ${surroundingMarkers.prev.name} → ${surroundingMarkers.next.name}`);
                            }
                          }}
                          className="px-4 py-2 rounded-lg font-semibold transition-all hover:scale-105 bg-primary text-primary-foreground flex items-center gap-2"
                        >
                          🔁 Loop: {surroundingMarkers.prev.name} → {surroundingMarkers.next.name}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/20 border-2 border-primary">
                          <span className="font-semibold text-foreground">
                            🔁 Loop activo
                          </span>
                          <button
                            onClick={() => {
                              clearLoop();
                              toast.info('Loop desactivado');
                            }}
                            className="px-2 py-1 rounded text-sm font-bold bg-destructive text-destructive-foreground hover:scale-105 transition-all"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Channels */}
            <div className="flex gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 flex-1">
                {audioTracks.map((track, index) => (
                  <Channel
                    key={index}
                    track={track}
                    index={index}
                    isClickOrGuide={isClickOrGuide(track.name)}
                    onVolumeChange={(i, v) => {
                      updateTrackVolume(i, v);
                      saveCurrentProjectState();
                    }}
                    onPanChange={(i, p) => {
                      updateTrackPan(i, p);
                      saveCurrentProjectState();
                    }}
                    onMuteToggle={(i) => {
                      toggleMute(i);
                      saveCurrentProjectState();
                    }}
                    onSoloToggle={toggleSolo}
                  />
                ))}
              </div>

              <MasterChannel
                volume={masterVolume}
                onVolumeChange={handleMasterVolumeChange}
              />
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="text-center py-16 rounded-xl bg-card">
            <div className="text-6xl mb-4">🎵</div>
            <h2 className="text-2xl font-bold mb-2 text-foreground">No hay pistas cargadas</h2>
            <p className="text-lg opacity-70 text-foreground">Selecciona archivos MP3 o WAV para comenzar</p>
          </div>
        )}
      </div>

      {/* Marker selector modal */}
      {selectedBeat && (
        <MarkerSelector
          beat={selectedBeat}
          customMarkerTypes={customMarkerTypes}
          onAddMarker={(marker) => {
            addUserMarker(marker);
            saveCurrentProjectState();
          }}
          onAddCustomType={addCustomMarkerType}
          onClose={() => setSelectedBeat(null)}
        />
      )}

      {/* Countdown overlay */}
      {showCountdown && (
        <CountdownOverlay
          count={countdownCount}
          beatDuration={countdownBeatDuration}
          onComplete={() => setShowCountdown(false)}
        />
      )}
    </div>
  );
}
