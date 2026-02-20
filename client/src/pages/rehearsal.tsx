import { useState, useCallback, useEffect, useRef } from "react";
import { Header } from "@/components/header";
import { ThreeLineReader } from "@/components/three-line-reader";
import { TransportBar } from "@/components/transport-bar";
import { SettingsDrawer } from "@/components/settings-drawer";
import { PracticeToolbar } from "@/components/practice-toolbar";
import { CountdownOverlay } from "@/components/countdown-overlay";
import { VideoBackground } from "@/components/video-background";
import { useSession } from "@/hooks/use-session";
import { useUserStats } from "@/hooks/use-user-stats";
import { useCamera } from "@/hooks/use-camera";
import { useToast } from "@/hooks/use-toast";
import { ttsEngine, calculateProsody, detectEmotion, getConversationalTiming, addBreathingPauses, type SpeakResult } from "@/lib/tts-engine";
import { speechRecognition, type SpeechRecognitionState } from "@/lib/speech-recognition";
import { matchWords } from "@/lib/word-matcher";
import { drawWatermark } from "@/lib/watermark";
import type { VoicePreset, MemorizationMode } from "@shared/schema";
import { Check, Mic, TrendingUp, Target, RefreshCcw, Star, Download, Hand } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Performance tracking for the current run
interface LinePerformance {
  lineId: string;
  accuracy: number;
  usedHint: boolean;
  skipped: boolean;
}

interface RunPerformance {
  linePerformances: LinePerformance[];
  startTime: number;
}

interface RehearsalPageProps {
  onBack: () => void;
}

export function RehearsalPage({ onBack }: RehearsalPageProps) {
  const {
    session,
    getCurrentLine,
    getPreviousLine,
    getNextLine,
    getTotalLines,
    getTotalScriptLines,
    getGlobalLineNumber,
    getRoleById,
    isUserLine,
    nextLine,
    prevLine,
    goToLine,
    goToScene,
    setPlaying,
    setAmbient,
    setMemorizationMode,
    incrementLinesRehearsed,
    incrementRunsCompleted,
    toggleBookmark,
    updateRolePreset,
    updateSession,
    createSession,
    clearSession,
    clearUserRole,
    isLoading,
    error,
  } = useSession();

  const { stats, recordRehearsal } = useUserStats();
  const camera = useCamera();
  const { toast } = useToast();
  const [fontSize, setFontSize] = useState(1);
  const [showDirections, setShowDirections] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [sceneCompleted, setSceneCompleted] = useState(false);
  const [listeningState, setListeningState] = useState<SpeechRecognitionState>("idle");
  const [userTranscript, setUserTranscript] = useState("");
  const [isUserTurn, setIsUserTurn] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [micEnabled, setMicEnabled] = useState(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    return !isMobile;
  });
  const [tapMode, setTapMode] = useState(() => {
    try { return localStorage.getItem("costar-tap-mode") === "true"; } catch { return false; }
  });
  const tapModeRef = useRef(tapMode);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingWordIndex, setSpeakingWordIndex] = useState(-1);
  const [showCountdown, setShowCountdown] = useState(false);
  const pendingPlayFromLineRef = useRef<number | null>(null);
  
  // Performance tracking - use ref to avoid closure issues
  const runPerformanceRef = useRef<RunPerformance>({
    linePerformances: [],
    startTime: Date.now(),
  });
  const [completedRunStats, setCompletedRunStats] = useState<{
    averageAccuracy: number;
    perfectLines: number;
    totalUserLines: number; // Lines where user spoke
    expectedUserLines: number; // Total user lines in scene
    hintsUsed: number;
    skippedLines: number;
    duration: number;
  } | null>(null);
  const currentLineAccuracyRef = useRef<number>(0);
  const isPlayingRef = useRef(false);
  const ambientRef = useRef<AudioContext | null>(null);
  const ambientGainRef = useRef<GainNode | null>(null);
  const waitingForUserRef = useRef(false);
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userToAiDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakingLineRef = useRef<string | null>(null);
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const matchGraceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matchReachedRef = useRef(false);
  const getCurrentLineRef = useRef(getCurrentLine);
  const advanceAfterUserLineRef = useRef<() => void>(() => {});
  const speakLineRef = useRef<() => void>(() => {});
  const startListeningForUserRef = useRef<() => void>(() => {});
  const stopAllPlaybackRef = useRef<() => void>(() => {});

  const currentLine = getCurrentLine();
  const previousLine = getPreviousLine();
  const nextLineData = getNextLine();
  const totalLines = getTotalScriptLines(); // Total lines across ALL scenes
  const globalLineNumber = getGlobalLineNumber(); // Current position in entire script
  const userRole = session?.userRoleId ? getRoleById(session.userRoleId) : null;
  const currentIsUserLine = isUserLine(currentLine);

  const handleTapModeChange = useCallback((enabled: boolean) => {
    setTapMode(enabled);
    tapModeRef.current = enabled;
    try { localStorage.setItem("costar-tap-mode", String(enabled)); } catch {}
  }, []);

  const requestMicPermission = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      console.log('[Rehearsal] getUserMedia not available');
      setMicEnabled(true);
      return true;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMicPermissionGranted(true);
      setMicBlocked(false);
      setMicEnabled(true);
      console.log('[Rehearsal] Mic permission granted');
      return true;
    } catch (err) {
      console.error('[Rehearsal] Mic permission denied:', err);
      setMicBlocked(true);
      setMicEnabled(false);
      toast({
        title: "Microphone Blocked",
        description: "Please allow microphone access in your browser settings to use voice recognition.",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  const tapAdvance = useCallback(() => {
    if (!tapModeRef.current || !waitingForUserRef.current || !isPlayingRef.current) return;
    speechRecognition.abort();
    waitingForUserRef.current = false;
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    currentLineAccuracyRef.current = 100;
    advanceAfterUserLineRef.current();
  }, []);

  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then(result => {
        if (result.state === 'granted') {
          setMicPermissionGranted(true);
          setMicEnabled(true);
        } else if (result.state === 'denied') {
          setMicBlocked(true);
        }
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    isPlayingRef.current = session?.isPlaying ?? false;
  }, [session?.isPlaying]);

  useEffect(() => {
    getCurrentLineRef.current = getCurrentLine;
  }, [getCurrentLine]);

  useEffect(() => {
    if (camera.error) {
      toast({
        title: "Camera Issue",
        description: camera.error,
        variant: "destructive",
      });
    }
  }, [camera.error, toast]);

  useEffect(() => {
    speechRecognition.onStateChange((state) => {
      console.log("[Rehearsal] Speech state:", state);
      setListeningState(state);
    });

    speechRecognition.onResult((result) => {
      setUserTranscript(result.transcript);
      
      const line = getCurrentLineRef.current();
      if (!line || result.transcript.length === 0 || !waitingForUserRef.current) return;
      
      const match = matchWords(line.text, result.transcript);
      currentLineAccuracyRef.current = Math.max(currentLineAccuracyRef.current, match.percentMatched);
      
      if (match.percentMatched >= 80 && !matchReachedRef.current) {
        if (matchGraceTimeoutRef.current) {
          clearTimeout(matchGraceTimeoutRef.current);
        }
        
        const doAdvance = () => {
          speechRecognition.stop();
          waitingForUserRef.current = false;
          matchReachedRef.current = false;
          if (autoAdvanceTimeoutRef.current) {
            clearTimeout(autoAdvanceTimeoutRef.current);
            autoAdvanceTimeoutRef.current = null;
          }
          autoAdvanceTimeoutRef.current = setTimeout(() => {
            if (isPlayingRef.current) advanceAfterUserLineRef.current();
          }, 20);
        };
        
        if (result.isFinal) {
          matchReachedRef.current = true;
          const graceMs = match.percentMatched >= 95 ? 40 : 100;
          matchGraceTimeoutRef.current = setTimeout(() => {
            if (isPlayingRef.current && waitingForUserRef.current) doAdvance();
          }, graceMs);
        } else {
          const interimGraceMs = match.percentMatched >= 95 ? 150 : 300;
          matchGraceTimeoutRef.current = setTimeout(() => {
            if (isPlayingRef.current && waitingForUserRef.current && !matchReachedRef.current) {
              matchReachedRef.current = true;
              doAdvance();
            }
          }, interimGraceMs);
        }
      }
    });

    speechRecognition.onEnd(() => {
      console.log("[Rehearsal] Speech ended, waiting:", waitingForUserRef.current, "playing:", isPlayingRef.current);
      if (waitingForUserRef.current && isPlayingRef.current) {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const restartDelay = isMobile ? 400 : 150;
        console.log("[Rehearsal] Speech ended but still user's turn, auto-restarting in", restartDelay, "ms");
        setTimeout(() => {
          if (waitingForUserRef.current && isPlayingRef.current && !speechRecognition.listening) {
            console.log("[Rehearsal] Restarting speech recognition");
            speechRecognition.start();
          }
        }, restartDelay);
      }
    });

    speechRecognition.onError((error) => {
      console.log("[Rehearsal] Speech error:", error);
      if (error === "not-allowed") {
        setMicBlocked(true);
        if (waitingForUserRef.current && isPlayingRef.current) {
          waitingForUserRef.current = false;
          setTimeout(() => {
            if (isPlayingRef.current) {
              advanceAfterUserLineRef.current();
            }
          }, 3000);
        }
      }
    });

    return () => {
      speechRecognition.abort();
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
      if (matchGraceTimeoutRef.current) {
        clearTimeout(matchGraceTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    matchReachedRef.current = false;
    if (matchGraceTimeoutRef.current) {
      clearTimeout(matchGraceTimeoutRef.current);
      matchGraceTimeoutRef.current = null;
    }
  }, [currentLine?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          if (tapModeRef.current && waitingForUserRef.current && isPlayingRef.current) {
            tapAdvance();
          } else {
            handlePlayPause();
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          handleNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handleBack();
          break;
        case "KeyR":
          e.preventDefault();
          handleRepeat();
          break;
        case "Escape":
          e.preventDefault();
          if (session?.isPlaying) {
            stopAllPlayback();
            setPlaying(false);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [session?.isPlaying, currentIsUserLine]);

  // Record a line performance (helper)
  const recordLinePerformance = useCallback((linePerf: LinePerformance) => {
    runPerformanceRef.current.linePerformances.push(linePerf);
  }, []);

  // Centralized run completion handler
  const completeRun = useCallback(() => {
    if (camera.isRecording) {
      camera.stopRecording();
    }
    
    // Calculate stats from the ref (always current)
    const allPerfs = runPerformanceRef.current.linePerformances;
    const totalUserLines = allPerfs.length;
    const avgAccuracy = totalUserLines > 0 
      ? allPerfs.reduce((sum, p) => sum + p.accuracy, 0) / totalUserLines 
      : 0;
    const perfectLines = allPerfs.filter(p => p.accuracy >= 95).length;
    const hintsUsed = allPerfs.filter(p => p.usedHint).length;
    const skippedLines = allPerfs.filter(p => p.skipped).length;
    const duration = Math.round((Date.now() - runPerformanceRef.current.startTime) / 1000);
    
    // Count how many lines the user SHOULD have spoken in this scene
    const currentScene = session?.scenes?.[session?.currentSceneIndex ?? 0];
    const expectedUserLines = currentScene?.lines?.filter(
      (line) => line.roleId === session?.userRoleId
    ).length ?? 0;
    
    console.log("[Performance] Run complete. Spoken:", totalUserLines, "/", expectedUserLines, "Avg accuracy:", avgAccuracy);
    console.log("[Performance] Line accuracies:", allPerfs.map(p => Math.round(p.accuracy)));
    
    // Set completed stats
    setCompletedRunStats({
      averageAccuracy: avgAccuracy,
      perfectLines,
      totalUserLines,
      expectedUserLines,
      hintsUsed,
      skippedLines,
      duration,
    });
    
    setPlaying(false);
    incrementRunsCompleted();
    recordRehearsal(0, 1);
    setShowCelebration(true);
    setSceneCompleted(true);
  }, [camera.isRecording, camera.stopRecording, incrementRunsCompleted, recordRehearsal, setPlaying, session?.scenes, session?.currentSceneIndex, session?.userRoleId]);

  // Reset run performance for a new run
  const resetRunPerformance = useCallback(() => {
    runPerformanceRef.current = {
      linePerformances: [],
      startTime: Date.now(),
    };
    currentLineAccuracyRef.current = 0;
  }, []);

  useEffect(() => {
    if (session?.ambientEnabled && !ambientRef.current) {
      try {
        const ctx = new AudioContext();
        const gain = ctx.createGain();
        gain.gain.value = 0.04;
        gain.connect(ctx.destination);

        const bufferSize = 2 * ctx.sampleRate;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 180;

        noise.connect(filter);
        filter.connect(gain);
        noise.start();

        ambientRef.current = ctx;
        ambientGainRef.current = gain;
      } catch {}
    } else if (!session?.ambientEnabled && ambientRef.current) {
      ambientRef.current.close();
      ambientRef.current = null;
      ambientGainRef.current = null;
    }

    return () => {
      if (ambientRef.current) {
        ambientRef.current.close();
        ambientRef.current = null;
      }
    };
  }, [session?.ambientEnabled]);

  const advanceAfterUserLine = useCallback(() => {
    const line = getCurrentLine();
    const accuracy = currentLineAccuracyRef.current;
    
    console.log("[Performance] Recording line:", line?.id, "accuracy:", accuracy);
    
    if (line) {
      const wasSkipped = accuracy < 20;
      recordLinePerformance({
        lineId: line.id,
        accuracy,
        usedHint: false,
        skipped: wasSkipped,
      });
    }
    
    currentLineAccuracyRef.current = 0;
    
    incrementLinesRehearsed();
    recordRehearsal(1, 0);
    setUserTranscript("");
    setIsUserTurn(false);
    waitingForUserRef.current = false;
    
    const next = getNextLine();
    if (next) {
      const userEmotion = line ? detectEmotion(line.text, line.direction) : "neutral";
      const nextEmotion = next.emotionHint || detectEmotion(next.text, next.direction);
      const timing = getConversationalTiming(nextEmotion, line?.text, userEmotion);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const minPause = isIOS ? 350 : 30;
      const pauseMs = isUserLine(next) ? minPause : Math.max(timing.userToAiPauseMs, minPause);
      
      console.log("[Rehearsal] User-to-next pause:", pauseMs + "ms", "nextEmotion:", nextEmotion);
      
      if (userToAiDelayRef.current) {
        clearTimeout(userToAiDelayRef.current);
      }
      userToAiDelayRef.current = setTimeout(() => {
        userToAiDelayRef.current = null;
        if (isPlayingRef.current) {
          nextLine();
        }
      }, pauseMs);
    } else {
      completeRun();
    }
  }, [getCurrentLine, getNextLine, incrementLinesRehearsed, nextLine, recordRehearsal, completeRun, recordLinePerformance, isUserLine]);

  useEffect(() => {
    advanceAfterUserLineRef.current = advanceAfterUserLine;
  }, [advanceAfterUserLine]);

  const startListeningForUser = useCallback(() => {
    console.log("[Rehearsal] Starting user turn, mic available:", speechRecognition.available, "blocked:", micBlocked, "tapMode:", tapModeRef.current);
    
    waitingForUserRef.current = true;
    matchReachedRef.current = false;
    setIsUserTurn(true);
    setUserTranscript("");
    speechRecognition.resetAccumulated();
    
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    if (matchGraceTimeoutRef.current) {
      clearTimeout(matchGraceTimeoutRef.current);
      matchGraceTimeoutRef.current = null;
    }
    
    if (tapModeRef.current) {
      console.log("[Rehearsal] Tap mode active, waiting for tap/spacebar to advance");
      return;
    }
    
    if (speechRecognition.available && !micBlocked && micEnabled) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isAndroid = /Android/i.test(navigator.userAgent);
      const micDelay = isIOS ? 500 : (isAndroid ? 400 : 50);
      console.log("[Rehearsal] Mic delay:", micDelay, "ms, iOS:", isIOS, "Android:", isAndroid);
      setTimeout(() => {
        if (isPlayingRef.current && waitingForUserRef.current) {
          speechRecognition.start();
        }
      }, micDelay);
      
      // Safety timeout: if no result after 60 seconds, advance anyway
      autoAdvanceTimeoutRef.current = setTimeout(() => {
        if (isPlayingRef.current && waitingForUserRef.current) {
          console.log("[Rehearsal] User turn safety timeout, advancing");
          speechRecognition.abort();
          waitingForUserRef.current = false;
          advanceAfterUserLineRef.current();
        }
      }, 60000);
    } else {
      // Fallback: auto-advance after 5 seconds if no speech recognition
      autoAdvanceTimeoutRef.current = setTimeout(() => {
        if (isPlayingRef.current && waitingForUserRef.current) {
          console.log("[Rehearsal] No mic fallback, advancing");
          waitingForUserRef.current = false;
          advanceAfterUserLineRef.current();
        }
      }, 5000);
    }
  }, [micBlocked, micEnabled]);

  const prefetchNextAILine = useCallback(() => {
    if (!session) return;
    const scene = session.scenes[session.currentSceneIndex];
    if (!scene) return;
    
    const startIdx = session.currentLineIndex + 1;
    for (let i = startIdx; i < Math.min(startIdx + 3, scene.lines.length); i++) {
      const line = scene.lines[i];
      if (!line || line.roleId === session.userRoleId) continue;
      
      const role = getRoleById(line.roleId);
      const roleIndex = session.roles.findIndex(r => r.id === line.roleId);
      const emotion = line.emotionHint || detectEmotion(line.text, line.direction);
      const preset = role?.voicePreset || "natural";
      
      ttsEngine.prefetch(line.text, {
        characterName: role?.name || "Character",
        characterIndex: roleIndex >= 0 ? roleIndex : 0,
        emotion,
        preset,
        direction: line.direction || "",
        playbackSpeed: session.playbackSpeed ?? 1.0,
      });
      break;
    }
  }, [session, getRoleById]);

  const stopAllPlayback = useCallback(() => {
    ttsEngine.stop();
    ttsEngine.clearPrefetchCache();
    speechRecognition.abort();
    waitingForUserRef.current = false;
    setIsUserTurn(false);
    speakingLineRef.current = null;
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }
    if (wordTimerRef.current) {
      clearInterval(wordTimerRef.current);
      wordTimerRef.current = null;
    }
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    if (userToAiDelayRef.current) {
      clearTimeout(userToAiDelayRef.current);
      userToAiDelayRef.current = null;
    }
    setIsSpeaking(false);
    setSpeakingWordIndex(-1);
  }, []);

  const speakLine = useCallback(() => {
    const line = getCurrentLine();
    if (!line || !session) {
      console.log("[Rehearsal] No line or session to speak");
      return;
    }

    const lineKey = `${session.currentSceneIndex}-${session.currentLineIndex}`;
    
    if (speakingLineRef.current === lineKey) {
      console.log("[Rehearsal] Already speaking this line:", lineKey);
      return;
    }

    ttsEngine.stop();
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }
    if (wordTimerRef.current) {
      clearInterval(wordTimerRef.current);
      wordTimerRef.current = null;
    }
    setIsSpeaking(false);
    setSpeakingWordIndex(-1);

    speakingLineRef.current = lineKey;

    const isUser = isUserLine(line);
    if (isUser) {
      console.log("[Rehearsal] User's line, starting listening");
      startListeningForUser();
      prefetchNextAILine();
      return;
    }

    const role = getRoleById(line.roleId);
    const roleIndex = session.roles.findIndex(r => r.id === line.roleId);
    const emotion = line.emotionHint || detectEmotion(line.text, line.direction);
    const preset = role?.voicePreset || "natural";
    const prosody = calculateProsody(emotion, preset);

    const prev = getPreviousLine();
    const prevEmotion = prev ? (prev.emotionHint || detectEmotion(prev.text, prev.direction)) : undefined;
    const timing = getConversationalTiming(emotion, prev?.text, prevEmotion);

    console.log("[Rehearsal] Speaking AI line:", role?.name, "emotion:", emotion, "timing:", timing.aiToAiPauseMs + "ms");

    const clearWordTimer = () => {
      if (wordTimerRef.current) {
        clearInterval(wordTimerRef.current);
        wordTimerRef.current = null;
      }
      setIsSpeaking(false);
      setSpeakingWordIndex(-1);
    };

    const ttsText = addBreathingPauses(line.text);

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const speakDelay = isIOS ? 200 : (isAndroid ? 150 : 30);
    
    speakTimeoutRef.current = setTimeout(() => {
      speakTimeoutRef.current = null;
      if (!isPlayingRef.current) {
        console.log("[Rehearsal] Not playing anymore, skipping TTS");
        speakingLineRef.current = null;
        return;
      }
      if (speakingLineRef.current !== lineKey) {
        console.log("[Rehearsal] Line changed before speak, skipping");
        return;
      }
      
      ttsEngine.speak(ttsText, prosody, (result: SpeakResult) => {
        console.log("[Rehearsal] TTS complete:", result, "for line:", lineKey);
        clearWordTimer();
        
        if (isPlayingRef.current && speakingLineRef.current === lineKey) {
          incrementLinesRehearsed();
          
          const next = getNextLine();
          const nextIsUser = next ? isUserLine(next) : false;
          const nextEmotion = next ? (next.emotionHint || detectEmotion(next.text, next.direction)) : undefined;
          const nextTiming = next ? getConversationalTiming(nextEmotion || "neutral", line.text, emotion) : null;
          const pauseMs = nextIsUser
            ? (nextTiming?.aiToUserPauseMs ?? 30)
            : (nextTiming?.aiToAiPauseMs ?? 400);
          
          setTimeout(() => {
            if (!isPlayingRef.current) {
              speakingLineRef.current = null;
              return;
            }
            if (speakingLineRef.current !== lineKey) {
              return;
            }
            
            speakingLineRef.current = null;
            
            if (next) {
              nextLine();
            } else {
              completeRun();
            }
          }, pauseMs);
        } else {
          speakingLineRef.current = null;
        }
      }, {
        characterName: role?.name || "Character",
        characterIndex: roleIndex >= 0 ? roleIndex : 0,
        emotion,
        preset,
        direction: line.direction || "",
        playbackSpeed: session.playbackSpeed ?? 1.0,
        onStart: (duration: number, wordCount: number) => {
          if (wordCount > 0 && duration > 0) {
            const msPerWord = (duration * 1000) / wordCount;
            let currentWord = 0;
            
            setIsSpeaking(true);
            setSpeakingWordIndex(0);
            
            wordTimerRef.current = setInterval(() => {
              currentWord++;
              if (currentWord < wordCount) {
                setSpeakingWordIndex(currentWord);
              } else {
                clearWordTimer();
              }
            }, msPerWord);
          }
          prefetchNextAILine();
        },
      });
    }, speakDelay);
  }, [getCurrentLine, getNextLine, getRoleById, isUserLine, nextLine, setPlaying, session, incrementLinesRehearsed, startListeningForUser, completeRun, prefetchNextAILine]);

  useEffect(() => { speakLineRef.current = speakLine; }, [speakLine]);
  useEffect(() => { startListeningForUserRef.current = startListeningForUser; }, [startListeningForUser]);
  useEffect(() => { stopAllPlaybackRef.current = stopAllPlayback; }, [stopAllPlayback]);

  useEffect(() => {
    const lineKey = session ? `${session.currentSceneIndex}-${session.currentLineIndex}` : null;
    
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }
    
    if (session?.isPlaying && currentLine) {
      if (speakingLineRef.current === lineKey) {
        return;
      }
      
      ttsEngine.stop();
      if (wordTimerRef.current) {
        clearInterval(wordTimerRef.current);
        wordTimerRef.current = null;
      }
      setIsSpeaking(false);
      setSpeakingWordIndex(-1);
      
      if (currentIsUserLine) {
        speechRecognition.abort();
        if (!waitingForUserRef.current) {
          speakingLineRef.current = lineKey;
          startListeningForUserRef.current();
        }
      } else {
        speechRecognition.abort();
        waitingForUserRef.current = false;
        setIsUserTurn(false);
        const delay = session.readerDelay ?? 0;
        if (delay > 0) {
          speakTimeoutRef.current = setTimeout(() => {
            speakTimeoutRef.current = null;
            if (!isPlayingRef.current) return;
            speakLineRef.current();
          }, delay * 1000);
        } else {
          speakLineRef.current();
        }
      }
    } else {
      stopAllPlaybackRef.current();
    }
  }, [session?.isPlaying, session?.currentLineIndex, session?.currentSceneIndex]);

  const startPlayback = useCallback(() => {
    speakingLineRef.current = null;
    if (session?.currentLineIndex === 0) {
      resetRunPerformance();
    }
    setPlaying(true);
  }, [session?.currentLineIndex, resetRunPerformance, setPlaying]);

  const handlePlayPause = async () => {
    if (session?.isPlaying) {
      stopAllPlayback();
      setPlaying(false);
    } else {
      ttsEngine.unlockAudio();
      if (!micPermissionGranted && !micBlocked) {
        await requestMicPermission();
      }
      setShowCountdown(true);
    }
  };

  const handleCountdownComplete = useCallback(() => {
    setShowCountdown(false);
    const pendingLine = pendingPlayFromLineRef.current;
    pendingPlayFromLineRef.current = null;
    if (pendingLine !== null) {
      goToLine(pendingLine);
      setTimeout(() => setPlaying(true), 50);
    } else {
      startPlayback();
    }
  }, [startPlayback, goToLine, setPlaying]);

  const handleCountdownCancel = useCallback(() => {
    setShowCountdown(false);
    pendingPlayFromLineRef.current = null;
  }, []);

  const handlePlayFromLine = useCallback(async (lineIndex: number) => {
    if (session?.isPlaying) {
      stopAllPlayback();
      setPlaying(false);
    }
    ttsEngine.unlockAudio();
    if (!micPermissionGranted && !micBlocked) {
      await requestMicPermission();
    }
    pendingPlayFromLineRef.current = lineIndex;
    setShowCountdown(true);
  }, [session?.isPlaying, setPlaying, stopAllPlayback, micPermissionGranted, micBlocked, requestMicPermission]);

  const handleNext = () => {
    stopAllPlayback();
    
    // Record line performance if user line
    if (currentIsUserLine) {
      const line = getCurrentLine();
      if (line) {
        const accuracy = currentLineAccuracyRef.current;
        const wasSkipped = accuracy < 20; // Same threshold as advanceAfterUserLine
        console.log("[Performance] handleNext recording line:", line.id, "accuracy:", accuracy, "skipped:", wasSkipped);
        recordLinePerformance({
          lineId: line.id,
          accuracy,
          usedHint: false,
          skipped: wasSkipped,
        });
        currentLineAccuracyRef.current = 0;
      }
      incrementLinesRehearsed();
      recordRehearsal(1, 0);
    }
    setUserTranscript("");
    
    const next = getNextLine();
    if (next) {
      nextLine();
    } else if (session?.isPlaying) {
      // Complete the run
      completeRun();
    }
  };

  const handleBack = () => {
    stopAllPlayback();
    setUserTranscript("");
    prevLine();
  };

  const handleRepeat = () => {
    stopAllPlayback();
    setUserTranscript("");
    goToLine(0);
    setPlaying(false);
  };

  const handleJumpToLine = (lineIndex: number, sceneIndex?: number) => {
    stopAllPlayback();
    setUserTranscript("");
    const targetScene = sceneIndex !== undefined ? sceneIndex : session?.currentSceneIndex ?? 0;
    goToLine(targetScene, lineIndex);
  };

  const handleRolePresetChange = (roleId: string, preset: VoicePreset) => {
    updateRolePreset({ roleId, voicePreset: preset });
  };

  const handleNewScript = async (name: string, rawScript: string) => {
    ttsEngine.stop();
    speechRecognition.abort();
    setPlaying(false);
    await createSession(name, rawScript);
  };

  const handleBackToHome = useCallback(() => {
    try {
      ttsEngine.stop();
    } catch {}
    try {
      speechRecognition.abort();
    } catch {}
    clearUserRole();
    onBack();
  }, [clearUserRole, onBack]);

  const handleClearSession = () => {
    ttsEngine.stop();
    speechRecognition.abort();
    clearSession();
    onBack();
  };

  const handleMemorizationChange = (mode: MemorizationMode) => {
    setMemorizationMode(mode);
  };

  const handleTryAgain = () => {
    setShowCelebration(false);
    setSceneCompleted(false);
    setCompletedRunStats(null);
    // Reset to beginning
    goToLine(0);
    // Reset performance tracking
    resetRunPerformance();
    // Start playing
    setTimeout(() => {
      speakingLineRef.current = null;
      setPlaying(true);
    }, 300);
  };

  const handleDismissCelebration = () => {
    setShowCelebration(false);
    // Keep sceneCompleted true so sticky bar shows
  };

  // Generate performance feedback message
  const getPerformanceFeedback = () => {
    if (!completedRunStats) {
      return { 
        type: "good" as const, 
        message: "Run complete", 
        detail: "Ready for another take."
      };
    }
    
    const { averageAccuracy, perfectLines, totalUserLines, expectedUserLines, skippedLines } = completedRunStats;
    
    // No lines spoken at all
    if (totalUserLines === 0) {
      if (expectedUserLines === 0) {
        return { 
          type: "good" as const, 
          message: "Scene complete", 
          detail: "No speaking lines in this scene."
        };
      }
      return { 
        type: "learning" as const, 
        message: "Listen mode", 
        detail: `Speak your ${expectedUserLines} lines next time.`
      };
    }
    
    // Compare spoken lines to expected
    const spokenRatio = expectedUserLines > 0 ? totalUserLines / expectedUserLines : 1;
    
    // Perfect run - high accuracy AND spoke all lines
    if (averageAccuracy >= 95 && spokenRatio >= 0.9 && skippedLines === 0) {
      return { 
        type: "perfect" as const, 
        message: "Flawless delivery", 
        detail: perfectLines === totalUserLines 
          ? `All ${perfectLines} lines perfect.`
          : `${perfectLines}/${totalUserLines} lines perfect.`
      };
    }
    
    // Great run - good accuracy
    if (averageAccuracy >= 80) {
      return { 
        type: "great" as const, 
        message: "Strong run", 
        detail: `${Math.round(averageAccuracy)}% accuracy. ${perfectLines}/${totalUserLines} perfect.`
      };
    }
    
    // Good progress
    if (averageAccuracy >= 60) {
      return { 
        type: "good" as const, 
        message: "Solid progress", 
        detail: `${Math.round(averageAccuracy)}% accuracy. Keep at it.`
      };
    }
    
    // Needs work - low accuracy or many skipped
    if (skippedLines > totalUserLines / 2) {
      return { 
        type: "learning" as const, 
        message: "Getting there", 
        detail: `${skippedLines} lines skipped. Take your time.`
      };
    }
    
    return { 
      type: "learning" as const, 
      message: "Keep practicing", 
      detail: `${Math.round(averageAccuracy)}% accuracy. You'll get it.`
    };
  };

  const screenRecordingFrameRef = useRef<number | null>(null);
  useEffect(() => {
    const canvas = camera.screenCanvasRef.current;
    if (!canvas) {
      if (screenRecordingFrameRef.current) {
        cancelAnimationFrame(screenRecordingFrameRef.current);
        screenRecordingFrameRef.current = null;
      }
      return;
    }
    if (!camera.isRecording) {
      if (screenRecordingFrameRef.current) {
        cancelAnimationFrame(screenRecordingFrameRef.current);
        screenRecordingFrameRef.current = null;
      }
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const hasCameraFeed = camera.isEnabled && camera.videoRef.current;

    const safeRoundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      if (c.roundRect) {
        c.roundRect(x, y, w, h, r);
      } else {
        c.moveTo(x + r, y);
        c.lineTo(x + w - r, y);
        c.arcTo(x + w, y, x + w, y + r, r);
        c.lineTo(x + w, y + h - r);
        c.arcTo(x + w, y + h, x + w - r, y + h, r);
        c.lineTo(x + r, y + h);
        c.arcTo(x, y + h, x, y + h - r, r);
        c.lineTo(x, y + r);
        c.arcTo(x, y, x + r, y, r);
        c.closePath();
      }
    };

    const drawScreenFrame = () => {
      const w = 1920;
      const h = 1080;
      canvas.width = w;
      canvas.height = h;

      if (hasCameraFeed) {
        const video = camera.videoRef.current!;
        if (video.videoWidth && video.videoHeight) {
          const videoAspect = video.videoWidth / video.videoHeight;
          const canvasAspect = w / h;
          let dw: number, dh: number, dx: number, dy: number;
          if (canvasAspect > videoAspect) {
            dw = w; dh = w / videoAspect;
            dx = 0; dy = (h - dh) / 2;
          } else {
            dh = h; dw = h * videoAspect;
            dx = (w - dw) / 2; dy = 0;
          }
          ctx.save();
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, w - dx - dw, dy, dw, dh);
          ctx.restore();
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(0, 0, w, h);
        } else {
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, w, h);
        }
      } else {
        const isDark = document.documentElement.classList.contains('dark');
        ctx.fillStyle = isDark ? '#0E1218' : '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
      }

      const onCamera = hasCameraFeed;
      const fgColor = onCamera ? '#FFFFFF' : (document.documentElement.classList.contains('dark') ? '#E6EDF3' : '#0F172A');
      const mutedColor = onCamera ? 'rgba(255,255,255,0.4)' : (document.documentElement.classList.contains('dark') ? 'rgba(230,237,243,0.4)' : 'rgba(15,23,42,0.4)');
      const userBg = onCamera ? 'rgba(255,255,255,0.9)' : (document.documentElement.classList.contains('dark') ? '#E6EDF3' : '#0F172A');
      const userFg = onCamera ? '#000' : (document.documentElement.classList.contains('dark') ? '#0E1218' : '#FFFFFF');
      const aiBg = onCamera ? 'rgba(0,0,0,0.7)' : (document.documentElement.classList.contains('dark') ? '#1a1f28' : '#f8fafc');
      const aiBorder = onCamera ? 'rgba(255,255,255,0.2)' : (document.documentElement.classList.contains('dark') ? 'rgba(230,237,243,0.15)' : 'rgba(15,23,42,0.1)');
      const primaryColor = 'hsl(217, 91%, 60%)';

      const prev = previousLine;
      const curr = currentLine;
      const next = nextLineData;
      const isUser = currentIsUserLine;

      const centerY = h / 2;
      const boxW = Math.min(w - 120, 1050);
      const boxX = (w - boxW) / 2;
      const padding = 30;

      const wrapText = (text: string, maxWidth: number, font: string): string[] => {
        ctx.font = font;
        const words = text.split(' ');
        const lines: string[] = [];
        let line = '';
        for (const word of words) {
          const test = line ? `${line} ${word}` : word;
          if (ctx.measureText(test).width > maxWidth) {
            if (line) lines.push(line);
            line = word;
          } else {
            line = test;
          }
        }
        if (line) lines.push(line);
        return lines.length ? lines : [''];
      };

      const drawLineBox = (
        line: { text: string; roleName: string; direction?: string },
        y: number,
        isCurr: boolean,
        isUserLine: boolean,
      ): number => {
        const textFont = isCurr ? '500 30px Inter, system-ui, sans-serif' : '500 25px Inter, system-ui, sans-serif';
        const wrappedLines = wrapText(line.text, boxW - padding * 2, textFont);
        const lineH = isCurr ? 44 : 38;
        const roleH = 42;
        const boxH = roleH + wrappedLines.length * lineH + padding * 2;

        if (isCurr && isUserLine) {
          ctx.fillStyle = userBg;
          ctx.beginPath();
          safeRoundRect(ctx, boxX, y, boxW, boxH, 12);
          ctx.fill();
        } else if (isCurr) {
          ctx.fillStyle = aiBg;
          ctx.strokeStyle = aiBorder;
          ctx.lineWidth = 1;
          ctx.beginPath();
          safeRoundRect(ctx, boxX, y, boxW, boxH, 12);
          ctx.fill();
          ctx.stroke();
        }

        let textY = y + padding;

        ctx.font = 'bold 16px Inter, system-ui, sans-serif';
        const roleBg = isCurr && isUserLine ? 'rgba(255,255,255,0.2)' : (isCurr ? primaryColor : 'transparent');
        const roleFg = isCurr && isUserLine ? userFg : (isCurr ? '#fff' : mutedColor);
        const roleW = ctx.measureText(line.roleName.toUpperCase()).width + 20;
        if (isCurr) {
          ctx.fillStyle = roleBg;
          ctx.beginPath();
          safeRoundRect(ctx, boxX + padding, textY, roleW, 28, 6);
          ctx.fill();
        }
        ctx.fillStyle = roleFg;
        ctx.fillText(line.roleName.toUpperCase(), boxX + padding + 10, textY + 20);

        if (line.direction && isCurr) {
          ctx.font = 'italic 16px Inter, system-ui, sans-serif';
          ctx.fillStyle = isCurr && isUserLine ? `${userFg}aa` : mutedColor;
          ctx.fillText(`(${line.direction})`, boxX + padding + roleW + 12, textY + 20);
        }

        textY += roleH;

        ctx.font = textFont;
        ctx.fillStyle = isCurr && isUserLine ? userFg : (isCurr ? fgColor : mutedColor);
        for (const wl of wrappedLines) {
          ctx.fillText(wl, boxX + padding, textY + (isCurr ? 26 : 22));
          textY += lineH;
        }

        return boxH;
      };

      let currH = 0;
      if (curr) {
        const tempFont = '500 30px Inter, system-ui, sans-serif';
        const wrappedCurr = wrapText(curr.text, boxW - padding * 2, tempFont);
        currH = 42 + wrappedCurr.length * 44 + padding * 2;
      }

      const gap = 18;
      let prevH = 0;
      if (prev) {
        const tempFont = '500 25px Inter, system-ui, sans-serif';
        const wrappedPrev = wrapText(prev.text, boxW - padding * 2, tempFont);
        prevH = 42 + wrappedPrev.length * 38 + padding * 2;
      }

      const startY = centerY - currH / 2;

      if (prev) {
        ctx.globalAlpha = 0.35;
        drawLineBox(prev, startY - gap - prevH, false, false);
        ctx.globalAlpha = 1;
      }

      if (curr) {
        drawLineBox(curr, startY, true, isUser);
      }

      if (next) {
        ctx.globalAlpha = 0.35;
        drawLineBox(next, startY + currH + gap, false, false);
        ctx.globalAlpha = 1;
      }

      const scene = session?.scenes?.[session?.currentSceneIndex ?? 0];
      if (scene) {
        ctx.font = '500 18px Inter, system-ui, sans-serif';
        ctx.fillStyle = mutedColor;
        ctx.fillText(scene.name || '', boxX, h - 45);
      }

      drawWatermark(ctx, w, h);

      screenRecordingFrameRef.current = requestAnimationFrame(drawScreenFrame);
    };

    screenRecordingFrameRef.current = requestAnimationFrame(drawScreenFrame);

    return () => {
      if (screenRecordingFrameRef.current) {
        cancelAnimationFrame(screenRecordingFrameRef.current);
        screenRecordingFrameRef.current = null;
      }
    };
  }, [camera.isRecording, camera.isEnabled, camera.videoRef, currentLine, previousLine, nextLineData, currentIsUserLine, session?.scenes, session?.currentSceneIndex]);

  if (!session) {
    onBack();
    return null;
  }

  const canGoBack = session.currentLineIndex > 0 || session.currentSceneIndex > 0;
  const currentScene = session.scenes[session.currentSceneIndex];
  const canGoNext = currentScene && (
    session.currentLineIndex < currentScene.lines.length - 1 ||
    session.currentSceneIndex < session.scenes.length - 1
  );

  const isListening = listeningState === "listening" && currentIsUserLine;
  const showUserTurnIndicator = currentIsUserLine && session.isPlaying;

  return (
    <div className={cn(
      "min-h-screen flex flex-col",
      camera.isEnabled ? "bg-transparent" : "bg-background"
    )} data-testid="rehearsal-page">
      <canvas
        ref={camera.screenCanvasRef}
        className="hidden"
        width={1280}
        height={720}
      />
      {camera.isEnabled && (
        <VideoBackground
          stream={camera.stream}
          videoRef={camera.videoRef}
          canvasRef={camera.canvasRef}
          isRecording={camera.isRecording}
        />
      )}
      
      <Header
        sessionName={session.name}
        userRole={userRole ?? null}
        showReaderMenu
        fontSize={fontSize}
        showDirections={showDirections}
        scenes={session.scenes}
        currentSceneIndex={session.currentSceneIndex}
        streak={stats.currentStreak}
        dailyGoal={stats.dailyGoal}
        todayLines={stats.todayLines}
        onBack={handleBackToHome}
        onFontSizeChange={setFontSize}
        onToggleDirections={() => setShowDirections(!showDirections)}
        onJumpToLine={handleJumpToLine}
        cameraMode={camera.isEnabled}
        onToast={(msg) => toast({ description: msg })}
      />

      {showCelebration && (() => {
        const feedback = getPerformanceFeedback();
        
        // Deterministic confetti particles for perfect runs (seeded by position)
        const confettiParticles = feedback?.type === "perfect" 
          ? Array.from({ length: 12 }, (_, i) => ({
              id: i,
              left: 5 + (i * 8) + (i % 3) * 2,
              delay: i * 0.08,
              duration: 2.5 + (i % 3) * 0.3,
            }))
          : [];
        
        return (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md animate-fade-in"
            onClick={handleDismissCelebration}
          >
            {/* Confetti for perfect runs */}
            {feedback?.type === "perfect" && (
              <div className="confetti-container">
                {confettiParticles.map(p => (
                  <div
                    key={p.id}
                    className="confetti-particle bg-yellow-400 dark:bg-yellow-500"
                    style={{
                      left: `${p.left}%`,
                      animationDelay: `${p.delay}s`,
                      animationDuration: `${p.duration}s`,
                      opacity: 0.7,
                    }}
                  />
                ))}
              </div>
            )}
            
            <div 
              className="bg-card border shadow-2xl rounded-2xl p-6 text-center max-w-xs mx-4 animate-scale-in relative"
              onClick={(e) => e.stopPropagation()}
              data-testid="celebration-modal"
            >
              {/* Compact icon + title row */}
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                  feedback?.type === "perfect" ? "bg-yellow-500 text-yellow-950" :
                  feedback?.type === "great" ? "bg-green-500 text-white" :
                  "bg-foreground text-background"
                )}>
                  {feedback?.type === "perfect" ? (
                    <Star className="h-5 w-5 fill-current" />
                  ) : (
                    <Check className="h-5 w-5" />
                  )}
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold leading-tight">Scene Complete</h3>
                  {feedback && (
                    <p className={cn(
                      "text-sm",
                      feedback.type === "perfect" ? "text-yellow-600 dark:text-yellow-400" :
                      feedback.type === "great" ? "text-green-600 dark:text-green-400" :
                      "text-muted-foreground"
                    )}>
                      {feedback.message}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Performance detail */}
              {feedback && feedback.detail && (
                <p className="text-xs text-muted-foreground mb-4 px-2">
                  {feedback.detail}
                </p>
              )}
              
              {/* Stats row - always show if we have expected lines */}
              {completedRunStats && completedRunStats.expectedUserLines > 0 && (
                <div className="flex items-center justify-center gap-6 py-3 px-4 bg-muted/30 rounded-lg mb-4">
                  {completedRunStats.totalUserLines > 0 ? (
                    <>
                      <div className="text-center">
                        <span className="text-xl font-bold text-foreground">{Math.round(completedRunStats.averageAccuracy)}%</span>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">accuracy</p>
                      </div>
                      <div className="w-px h-6 bg-border" />
                      <div className="text-center">
                        <span className="text-xl font-bold text-foreground">{completedRunStats.perfectLines}/{completedRunStats.totalUserLines}</span>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">perfect</p>
                      </div>
                      {completedRunStats.totalUserLines < completedRunStats.expectedUserLines && (
                        <>
                          <div className="w-px h-6 bg-border" />
                          <div className="text-center">
                            <span className="text-xl font-bold text-foreground">{completedRunStats.totalUserLines}/{completedRunStats.expectedUserLines}</span>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">spoken</p>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="text-center">
                      <span className="text-xl font-bold text-foreground">0/{completedRunStats.expectedUserLines}</span>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">lines spoken</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Download recording if available */}
              {camera.hasRecording && (
                <div className="mb-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => camera.downloadRecording(`costar-${session.name || 'rehearsal'}`)}
                    data-testid="button-download-recording"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Recording
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-1.5">
                    {camera.isEnabled ? "Camera + script recording with audio" : "Script view with audio"}
                  </p>
                </div>
              )}
              
              {/* Primary action */}
              <Button
                className="w-full"
                onClick={handleTryAgain}
                data-testid="button-try-again"
              >
                <RefreshCcw className="h-4 w-4 mr-2" />
                Run Again
              </Button>
              
              {/* Subtle dismiss link */}
              <button
                onClick={handleDismissCelebration}
                className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-dismiss-celebration"
              >
                or review your lines
              </button>
            </div>
          </div>
        );
      })()}

      {camera.showDiscardPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border shadow-2xl rounded-xl p-5 text-center max-w-xs mx-4" data-testid="discard-prompt">
            <h3 className="text-base font-semibold mb-1">Stop recording?</h3>
            <p className="text-sm text-muted-foreground mb-4">Keep the recording or discard it.</p>
            <div className="flex flex-col gap-2">
              <Button
                className="w-full"
                onClick={() => {
                  camera.confirmStopAndDownload();
                }}
                data-testid="button-keep-recording"
              >
                <Download className="h-4 w-4 mr-2" />
                Keep recording
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  camera.confirmStopAndDiscard();
                }}
                data-testid="button-discard-recording"
              >
                Discard
              </Button>
              <button
                onClick={() => camera.cancelStopRecording()}
                className="mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-cancel-stop"
              >
                continue recording
              </button>
            </div>
          </div>
        </div>
      )}

      <main className={cn(
        "flex-1 flex flex-col justify-center px-4 py-6 animate-fade-in relative z-10",
        camera.isEnabled && "text-white"
      )}>
        {/* Subtle gradient accent at top - hide when camera is on */}
        {!camera.isEnabled && (
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/[0.04] to-transparent pointer-events-none" />
        )}
        <div className="flex-1 flex flex-col justify-center max-w-2xl lg:max-w-3xl mx-auto w-full relative">
          <ThreeLineReader
            previousLine={previousLine}
            currentLine={currentLine}
            nextLine={nextLineData}
            isUserLine={currentIsUserLine}
            isPlaying={session.isPlaying}
            showDirections={showDirections}
            fontSize={fontSize}
            memorizationMode={session.memorizationMode || "off"}
            onToggleBookmark={toggleBookmark}
            getRoleById={getRoleById}
            userTranscript={userTranscript}
            isListening={listeningState === "listening"}
            isSpeaking={isSpeaking}
            speakingWordIndex={speakingWordIndex}
            currentScene={currentScene}
            isFirstLineOfScene={session.currentLineIndex === 0}
            cameraMode={camera.isEnabled}
            tapMode={tapMode}
            onTapAdvance={tapAdvance}
            onRestartListening={() => {
              if (!speechRecognition.listening && waitingForUserRef.current) {
                speechRecognition.start();
              }
            }}
            onLineClick={(line) => {
              const lineIndex = currentScene?.lines?.findIndex(l => l.id === line.id) ?? -1;
              if (lineIndex !== -1 && lineIndex !== session.currentLineIndex) {
                if (session.isPlaying) {
                  stopAllPlayback();
                  setPlaying(false);
                }
                updateSession({ currentLineIndex: lineIndex, isPlaying: false });
              }
            }}
            onPlayFromHere={(line) => {
              const lineIndex = currentScene?.lines?.findIndex(l => l.id === line.id) ?? -1;
              if (lineIndex !== -1) {
                handlePlayFromLine(lineIndex);
              }
            }}
          />
          
          {showUserTurnIndicator && (
            <div className="flex flex-col items-center mt-6 animate-fade-in" data-testid="user-turn-indicator">
              {tapMode ? (
                <button
                  onClick={tapAdvance}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full border bg-foreground/5 border-foreground/10 animate-breathe active:scale-[0.97] transition-transform"
                  data-testid="button-tap-advance-main"
                >
                  <Hand className="h-4 w-4 text-foreground/70" />
                  <span className="text-sm text-foreground font-medium">Tap when ready</span>
                </button>
              ) : (
                <>
                  <div className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full border relative",
                    isListening 
                      ? "bg-primary/10 border-primary/20 pulse-ring text-primary" 
                      : "bg-foreground/5 border-foreground/10 animate-breathe"
                  )}>
                    {isListening ? (
                      <>
                        <div className="relative">
                          <Mic className="h-4 w-4 text-primary" />
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        </div>
                        <span className="text-sm text-primary font-medium">Listening...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4 text-foreground/70" />
                        <span className="text-sm text-foreground font-medium">Your line</span>
                      </>
                    )}
                  </div>
                  {userTranscript && (
                    <p className="mt-3 text-sm text-muted-foreground/80 max-w-xs text-center transition-opacity duration-300">
                      {userTranscript}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Sticky "Run Again" bar when scene completed but modal dismissed */}
      {sceneCompleted && !showCelebration && (
        <div className="fixed bottom-24 left-0 right-0 z-30 flex justify-center px-4 animate-fade-in">
          <button
            onClick={handleTryAgain}
            className="flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-full shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform"
            data-testid="button-sticky-run-again"
          >
            <RefreshCcw className="h-4 w-4" />
            <span className="text-sm font-medium">Run Again</span>
          </button>
        </div>
      )}

      <footer className={cn(
        "sticky bottom-0 border-t safe-bottom z-40",
        camera.isEnabled 
          ? "bg-black/60 backdrop-blur-xl border-white/10" 
          : "glass"
      )}>
        <div className="px-4 py-2">
          <PracticeToolbar
            memorizationMode={session.memorizationMode || "off"}
            onMemorizationChange={handleMemorizationChange}
            micEnabled={micEnabled}
            onMicToggle={async () => {
              if (micEnabled) {
                speechRecognition.abort();
                setMicEnabled(false);
              } else {
                if (micPermissionGranted) {
                  setMicEnabled(true);
                } else {
                  await requestMicPermission();
                }
              }
            }}
            cameraEnabled={camera.isEnabled}
            onCameraToggle={camera.toggleCamera}
            isRecording={camera.isRecording}
            onRecordToggle={camera.toggleRecording}
            recordingTime={camera.recordingTime}
          />
        </div>
        
        <div className="px-4 py-5 max-w-md lg:max-w-lg mx-auto">
          <TransportBar
            isPlaying={session.isPlaying}
            canGoBack={canGoBack}
            canGoNext={canGoNext}
            currentLine={globalLineNumber}
            totalLines={totalLines}
            onBack={handleBack}
            onPlayPause={handlePlayPause}
            onNext={handleNext}
            onRepeat={handleRepeat}
            cameraMode={camera.isEnabled}
            isSpeaking={isSpeaking}
            isListening={listeningState === "listening"}
          />
        </div>

        <SettingsDrawer
          roles={session.roles}
          scenes={session.scenes}
          currentSceneIndex={session.currentSceneIndex}
          userRoleId={session.userRoleId}
          ambientEnabled={session.ambientEnabled}
          playbackSpeed={session.playbackSpeed ?? 1.0}
          readerDelay={session.readerDelay ?? 0}
          tapMode={tapMode}
          earbudsOnly={camera.earbudsOnly}
          onEarbudsOnlyChange={camera.toggleEarbudsOnly}
          cameraEnabled={camera.isEnabled}
          onAmbientToggle={setAmbient}
          onPlaybackSpeedChange={(speed) => updateSession({ playbackSpeed: speed })}
          onReaderDelayChange={(delay) => updateSession({ readerDelay: delay })}
          onTapModeChange={handleTapModeChange}
          onSceneChange={goToScene}
          onRolePresetChange={handleRolePresetChange}
          onNewScript={handleNewScript}
          onClearSession={handleClearSession}
          isLoading={isLoading}
          error={error}
        />
      </footer>
      {showCountdown && (
        <CountdownOverlay
          onComplete={handleCountdownComplete}
          onCancel={() => {
            setShowCountdown(false);
            pendingPlayFromLineRef.current = null;
          }}
          cameraMode={camera.isEnabled}
        />
      )}
    </div>
  );
}
