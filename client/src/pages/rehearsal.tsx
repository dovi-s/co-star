import { useState, useCallback, useEffect, useRef } from "react";
import { trackFeature } from "@/hooks/use-analytics";
import { Header } from "@/components/header";
import { ThreeLineReader } from "@/components/three-line-reader";
import { TransportBar } from "@/components/transport-bar";
import { SettingsDrawer } from "@/components/settings-drawer";
import { PracticeToolbar } from "@/components/practice-toolbar";
import { CountdownOverlay } from "@/components/countdown-overlay";
import { VideoBackground } from "@/components/video-background";
import { useSession } from "@/hooks/use-session";
import { useSessionContext } from "@/context/session-context";
import { useUserStats } from "@/hooks/use-user-stats";
import { useAuth } from "@/hooks/use-auth";
import { useCamera } from "@/hooks/use-camera";
import { useTheme } from "@/lib/theme-provider";
import { useToast } from "@/hooks/use-toast";
import { ttsEngine, calculateProsody, detectEmotion, getConversationalTiming, addBreathingPauses, type SpeakResult } from "@/lib/tts-engine";
import { speechRecognition, type SpeechRecognitionState } from "@/lib/speech-recognition";
import { matchWords } from "@/lib/word-matcher";
import { drawWatermark } from "@/lib/watermark";
import type { VoicePreset, MemorizationMode } from "@shared/schema";
import { Check, Mic, TrendingUp, Target, RefreshCcw, Star, Download, Hand, FileText, Headphones, X, Volume2, Play, Pause, RotateCcw, Users, ArrowRight, Sparkles, ChevronLeft, ChevronRight, Loader2, Trophy, Info, Zap, Clock, Flame, Share2, Crown, User, WifiOff, CloudUpload } from "lucide-react";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AIStateIndicator, type AIState } from "@/components/ai-state-indicator";
import { triggerHaptic } from "@/hooks/use-haptics";
import { saveResumePosition, getResumePosition, clearResumePosition } from "@/lib/recent-scripts";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { Mascot } from "@/components/mascot";

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
  onNavigate?: (page: string) => void;
}

export function RehearsalPage({ onBack, onNavigate }: RehearsalPageProps) {
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
    setUserRole,
    clearUserRole,
    isLoading,
    error,
  } = useSession();
  const { isAuthenticated, user } = useAuth();
  const { lastRawScript } = useSessionContext();

  const { stats, recordRehearsal, recordRunHistory, getLastRunForScript, didRehearsalToday } = useUserStats(user?.id);
  const camera = useCamera();
  const { setThemeColorOverride } = useTheme();
  const { toast } = useToast();
  const pwaInstall = usePwaInstall();
  const [pendingCloudUpload, setPendingCloudUpload] = useState(false);
  const [fontSize, setFontSize] = useState(1);
  const [showDirections, setShowDirections] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [sceneCompleted, setSceneCompleted] = useState(false);
  const [listeningState, setListeningState] = useState<SpeechRecognitionState>("idle");
  const [userTranscript, setUserTranscript] = useState("");
  const [isUserTurn, setIsUserTurn] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const micEnabledRef = useRef(true);
  const setMicEnabledSync = (val: boolean) => {
    setMicEnabled(val);
    micEnabledRef.current = val;
  };
  const [tapMode, setTapMode] = useState(() => {
    try { return localStorage.getItem("costar-tap-mode") === "true"; } catch { return false; }
  });
  const tapModeRef = useRef(tapMode);
  const [readerVolume, setReaderVolume] = useState(() => ttsEngine.masterVolume);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsGenerating, setTtsGenerating] = useState(false);
  const [speakingWordIndex, setSpeakingWordIndex] = useState(-1);
  const [showCountdown, setShowCountdown] = useState(false);
  const pendingPlayFromLineRef = useRef<number | null>(null);
  const [showReadyScreen, setShowReadyScreen] = useState(true);
  const [readyCountdown, setReadyCountdown] = useState(3);
  const [showTourTip, setShowTourTip] = useState<number>(0);
  const [lineHintShown, setLineHintShown] = useState(false);
  const userPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSeenTour = useRef(false);
  const [animatedAccuracy, setAnimatedAccuracy] = useState(0);
  const [celebrationRevealed, setCelebrationRevealed] = useState(false);
  const [resumePrompt, setResumePrompt] = useState<{ lineIndex: number; sceneIndex: number } | null>(null);
  const scriptFingerprintRef = useRef("");
  const [cameraFocus, setCameraFocus] = useState<'script' | 'face'>('script');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [runLimitReached, setRunLimitReached] = useState(false);
  const [runLimitResetsAt, setRunLimitResetsAt] = useState<string | null>(null);
  const [checkingRunLimit, setCheckingRunLimit] = useState(false);

  useEffect(() => {
    if (!runLimitReached) return;
    const recheckUsage = async () => {
      try {
        const dfp = await getDeviceFingerprint();
        const res = await fetch(`/api/script-usage?deviceFingerprint=${encodeURIComponent(dfp)}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.limitReached) {
          setRunLimitReached(false);
          setRunLimitResetsAt(null);
        }
      } catch {}
    };
    if (runLimitResetsAt) {
      const resetTime = new Date(runLimitResetsAt).getTime();
      if (Number.isNaN(resetTime)) {
        setRunLimitReached(false);
        setRunLimitResetsAt(null);
        return;
      }
      const now = Date.now();
      const delay = resetTime - now;
      if (delay <= 0) {
        recheckUsage();
        return;
      }
      const timer = setTimeout(recheckUsage, Math.min(delay, 2147483647));
      const poll = setInterval(recheckUsage, 60000);
      return () => { clearTimeout(timer); clearInterval(poll); };
    }
    const poll = setInterval(recheckUsage, 60000);
    return () => clearInterval(poll);
  }, [runLimitReached, runLimitResetsAt]);
  const [handsFreeMode, setHandsFreeMode] = useState(false);
  const handsFreeModeRef = useRef(false);
  const wakeLockRef = useRef<any>(null);
  
  useEffect(() => {
    handsFreeModeRef.current = handsFreeMode;
  }, [handsFreeMode]);

  useEffect(() => {
    if (handsFreeMode) {
      const requestWakeLock = async () => {
        try {
          if ('wakeLock' in navigator) {
            wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          }
        } catch {
        }
      };
      requestWakeLock();
      return () => {
        if (wakeLockRef.current) {
          wakeLockRef.current.release().catch(() => {});
          wakeLockRef.current = null;
        }
      };
    }
  }, [handsFreeMode]);

  useEffect(() => {
    if (!pendingCloudUpload || !camera.recordingBlob || camera.isUploading) return;
    const doUpload = async () => {
      const result = await camera.uploadRecording({
        scriptName: session?.name || "Untitled",
        durationSeconds: camera.recordingTime,
        accuracy: completedRunStats ? Math.round(completedRunStats.averageAccuracy) : undefined,
      });
      setPendingCloudUpload(false);
      if (result.success) {
        toast({ title: "Recording saved to your library" });
        camera.clearRecording();
      } else {
        toast({ title: "Upload failed", description: result.error, variant: "destructive" });
      }
    };
    doUpload();
  }, [pendingCloudUpload, camera.recordingBlob]);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  useEffect(() => {
    if (session) {
      try {
        const cacheData = {
          name: session.name,
          roles: session.roles,
          scenes: session.scenes,
          userRoleId: session.userRoleId,
          timestamp: Date.now(),
        };
        localStorage.setItem("costar-offline-script", JSON.stringify(cacheData));
      } catch {}
    }
  }, [session?.name, session?.roles, session?.scenes, session?.userRoleId]);

  useEffect(() => {
    if (!camera.isEnabled) setCameraFocus('script');
  }, [camera.isEnabled]);

  useEffect(() => {
    if (camera.isEnabled) {
      setThemeColorOverride("#000000");
    } else {
      setThemeColorOverride(null);
    }
    return () => setThemeColorOverride(null);
  }, [camera.isEnabled, setThemeColorOverride]);

  useEffect(() => {
    try {
      hasSeenTour.current = localStorage.getItem("costar-tour-seen") === "true";
      if (localStorage.getItem("costar-line-hint-seen") === "true") setLineHintShown(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (!session) return;
    const allText = session.scenes.flatMap(s => s.lines.map(l => l.text)).join("|");
    let hash = 0;
    for (let i = 0; i < allText.length; i++) {
      hash = ((hash << 5) - hash + allText.charCodeAt(i)) | 0;
    }
    const fp = session.name + ":" + hash;
    scriptFingerprintRef.current = fp;
    const saved = getResumePosition(fp);
    if (saved && (saved.lineIndex > 0 || saved.sceneIndex > 0)) {
      setResumePrompt({ lineIndex: saved.lineIndex, sceneIndex: saved.sceneIndex });
    }
    setShowReadyScreen(true);
    setReadyCountdown(3);
  }, [session?.name, session?.scenes]);

  useEffect(() => {
    if (!showReadyScreen) return;
    if (readyCountdown <= 0) {
      setShowReadyScreen(false);
      if (!hasSeenTour.current) {
        setShowTourTip(1);
        try { localStorage.setItem("costar-tour-seen", "true"); } catch {}
        hasSeenTour.current = true;
      }
      return;
    }
    const timer = setTimeout(() => setReadyCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [showReadyScreen, readyCountdown]);

  useEffect(() => {
    if (showTourTip > 0 && showTourTip <= 4) {
      const timer = setTimeout(() => setShowTourTip(0), 6000);
      return () => clearTimeout(timer);
    }
  }, [showTourTip]);

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
  const [previousRunAccuracy, setPreviousRunAccuracy] = useState<number | null>(null);
  const [savingScript, setSavingScript] = useState(false);
  const [scriptSaved, setScriptSaved] = useState(false);
  const currentLineAccuracyRef = useRef<number>(0);
  const isPlayingRef = useRef(false);
  const ambientRef = useRef<AudioContext | null>(null);
  const ambientGainRef = useRef<GainNode | null>(null);
  const waitingForUserRef = useRef(false);
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userToAiDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakingLineRef = useRef<string | null>(null);
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGapMsRef = useRef<number | null>(null);
  const avgGapMsRef = useRef<number>(300);
  const wordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const matchGraceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matchReachedRef = useRef(false);
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completeRunInFlightRef = useRef(false);
  const getCurrentLineRef = useRef(getCurrentLine);
  const advanceAfterUserLineRef = useRef<() => void>(() => {});
  const speakLineRef = useRef<() => void>(() => {});
  const startListeningForUserRef = useRef<() => void>(() => {});
  const stopAllPlaybackRef = useRef<() => void>(() => {});

  const hintPlayingRef = useRef(false);
  const hintUsedForLineRef = useRef(false);

  const applyRhythmAdaptation = useCallback((pauseMs: number, floor: number, ceiling: number): number => {
    const last = lastGapMsRef.current;
    const avg = avgGapMsRef.current;
    let adapted = pauseMs;
    if (last !== null) {
      if (last < avg) {
        adapted = Math.round(pauseMs * 1.08);
      } else if (last > avg) {
        adapted = Math.round(pauseMs * 0.92);
      }
    }
    adapted = Math.max(floor, Math.min(ceiling, adapted));
    lastGapMsRef.current = adapted;
    avgGapMsRef.current = avg * 0.85 + adapted * 0.15;
    return adapted;
  }, []);

  const currentLine = getCurrentLine();
  const previousLine = getPreviousLine();
  const nextLineData = getNextLine();
  const totalLines = getTotalScriptLines(); // Total lines across ALL scenes
  const globalLineNumber = getGlobalLineNumber(); // Current position in entire script
  const userRole = session?.userRoleId ? getRoleById(session.userRoleId) : null;
  const currentIsUserLine = isUserLine(currentLine);

  useEffect(() => {
    if (currentIsUserLine && session?.isPlaying && !lineHintShown && !tapMode) {
      userPauseTimerRef.current = setTimeout(() => {
        setLineHintShown(true);
        try { localStorage.setItem("costar-line-hint-seen", "true"); } catch {}
        toast({
          title: "Stuck on a line?",
          description: "Say \"LINE\" out loud to get a hint.",
        });
      }, 8000);
      return () => {
        if (userPauseTimerRef.current) clearTimeout(userPauseTimerRef.current);
      };
    }
  }, [currentIsUserLine, session?.isPlaying, lineHintShown, tapMode, toast]);

  const handleTapModeChange = useCallback((enabled: boolean) => {
    setTapMode(enabled);
    tapModeRef.current = enabled;
    try { localStorage.setItem("costar-tap-mode", String(enabled)); } catch {}
  }, []);

  const handleReaderVolumeChange = useCallback((vol: number) => {
    setReaderVolume(vol);
    ttsEngine.setMasterVolume(vol);
  }, []);

  const requestMicPermission = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicEnabledSync(true);
      return true;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMicPermissionGranted(true);
      setMicBlocked(false);
      setMicEnabledSync(true);
      return true;
    } catch (err) {
      console.error('[Rehearsal] Mic permission denied:', err);
      setMicBlocked(true);
      setMicEnabledSync(false);
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
          setMicEnabledSync(true);
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
      setListeningState(state);
    });

    speechRecognition.onResult((result) => {
      const transcript = result.transcript.trim();
      
      const line = getCurrentLineRef.current();
      if (!line || transcript.length === 0 || !waitingForUserRef.current) return;
      
      setUserTranscript(transcript);
      
      if (hintPlayingRef.current) return;

      const allWords = transcript.split(/\s+/);
      const lastWord = (allWords[allWords.length - 1] || "").toLowerCase().replace(/[^a-z]/g, "");
      const isLineWord = lastWord === "line" || lastWord === "lne" || lastWord === "lying";
      const isShortEnough = allWords.length <= 3;
      const notAlreadyMatching = currentLineAccuracyRef.current < 50;
      const isLineCommand = isLineWord && notAlreadyMatching && (result.isFinal || isShortEnough);
      if (isLineCommand && !hintPlayingRef.current) {
        const cleanTranscript = transcript.replace(/\b(line|lne|lying)[!?.]*\s*$/i, "").trim();
        const isJustLine = cleanTranscript.length === 0;
        if (isJustLine || matchWords(line.text, cleanTranscript).percentMatched < 40) {
          hintPlayingRef.current = true;
          hintUsedForLineRef.current = true;
          speechRecognition.pause();
          speechRecognition.resetAccumulated();
          setUserTranscript("");
          ttsEngine.speakHint(line.text, () => {
            hintPlayingRef.current = false;
            speechRecognition.resetAccumulated();
            if (waitingForUserRef.current && isPlayingRef.current) {
              setTimeout(() => {
                if (waitingForUserRef.current && isPlayingRef.current && !speechRecognition.listening) {
                  speechRecognition.softStart();
                }
              }, 300);
            }
          });
          return;
        }
      }
      
      const match = matchWords(line.text, result.transcript);
      currentLineAccuracyRef.current = Math.max(currentLineAccuracyRef.current, match.percentMatched);
      
      const expectedWordCount = line.text.split(/\s+/).filter((w: string) => w.length > 0).length;
      const spokenWordCount = result.transcript.split(/\s+/).filter((w: string) => w.length > 0).length;
      
      const lineEndsInterrupted = /[-\u2014\u2013]{1,3}\s*$/.test(line.text.trim());
      const matchThreshold = lineEndsInterrupted ? 65 : 80;
      const spokenRatioRequired = lineEndsInterrupted ? 0.45 : 0.60;
      
      const spokenEnough = expectedWordCount <= 4 || (spokenWordCount / expectedWordCount) >= spokenRatioRequired;
      
      if (match.percentMatched >= matchThreshold && spokenEnough && !matchReachedRef.current) {
        if (matchGraceTimeoutRef.current) {
          clearTimeout(matchGraceTimeoutRef.current);
        }
        
        const doAdvance = () => {
          speechRecognition.pause();
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
          const graceMs = match.percentMatched >= 95 ? 80 : 200;
          matchGraceTimeoutRef.current = setTimeout(() => {
            if (isPlayingRef.current && waitingForUserRef.current) doAdvance();
          }, graceMs);
        } else {
          const interimGraceMs = match.percentMatched >= 95 ? 350 : 600;
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
      if (waitingForUserRef.current && isPlayingRef.current) {
        if (hintPlayingRef.current) {
          return;
        }
        const isPWAMode = window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
        const restartDelay = isPWAMode ? 400 : speechRecognition.isMobileDevice ? 300 : 100;
        const attemptRestart = (attempt: number) => {
          if (!waitingForUserRef.current || !isPlayingRef.current) return;
          if (speechRecognition.listening) return;
          if (hintPlayingRef.current) return;
          speechRecognition.softStart();
          if (!speechRecognition.listening && attempt < (isPWAMode ? 8 : 5)) {
            const nextDelay = attempt < 3 ? 500 : 1000;
            setTimeout(() => attemptRestart(attempt + 1), nextDelay);
          }
        };
        
        setTimeout(() => attemptRestart(0), restartDelay);
      }
    });

    speechRecognition.onError((error) => {
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
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current);
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
          if (handsFreeModeRef.current) {
            exitHandsFreeMode();
          } else if (isPlayingRef.current) {
            stopAllPlayback();
            setPlaying(false);
          } else {
            handleBackToHome();
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
  const completeRun = useCallback(async () => {
    if (completeRunInFlightRef.current) return;
    completeRunInFlightRef.current = true;
    if (camera.isRecording) {
      await camera.stopRecording();
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
    
    const fp = scriptFingerprintRef.current;
    const prevRun = fp ? getLastRunForScript(fp) : null;
    setPreviousRunAccuracy(prevRun ? prevRun.accuracy : null);

    if (fp) {
      recordRunHistory({
        scriptFingerprint: fp,
        accuracy: avgAccuracy,
        linesSpoken: totalUserLines,
        duration,
      });
    }

    setPlaying(false);
    incrementRunsCompleted();
    recordRehearsal(0, 1);
    triggerHaptic(avgAccuracy >= 95 ? "achievement" : "success");

    setCelebrationRevealed(false);
    setAnimatedAccuracy(0);
    const targetAcc = Math.round(avgAccuracy);

    const revealDelay = 800;
    if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
    celebrationTimerRef.current = setTimeout(() => {
      celebrationTimerRef.current = null;
      setCelebrationRevealed(true);
      let frame = 0;
      const totalFrames = 50;
      const animateUp = () => {
        frame++;
        const progress = Math.min(frame / totalFrames, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setAnimatedAccuracy(Math.round(targetAcc * eased));
        if (frame < totalFrames) requestAnimationFrame(animateUp);
      };
      requestAnimationFrame(animateUp);

      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const playTone = (freq: number, start: number, dur: number, vol: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(vol, ctx.currentTime + start);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + dur);
        };
        const vol = avgAccuracy >= 95 ? 0.08 : 0.05;
        playTone(523.25, 0, 0.15, vol);
        playTone(659.25, 0.1, 0.15, vol);
        playTone(783.99, 0.2, 0.25, vol * 1.2);
        if (avgAccuracy >= 95) {
          playTone(1046.50, 0.35, 0.35, vol);
        }
      } catch {}
    }, revealDelay);

    if (handsFreeModeRef.current) {
      setSceneCompleted(true);
      setTimeout(async () => {
        if (!(await checkRunUsageAllowed())) {
          setShowCelebration(true);
          setHandsFreeMode(false);
          return;
        }
        completeRunInFlightRef.current = false;
        setSceneCompleted(false);
        setCompletedRunStats(null);
        goToLine(0);
        resetRunPerformance();
        setTimeout(() => {
          speakingLineRef.current = null;
          setPlaying(true);
        }, 1000);
      }, 3000);
    } else {
      setShowCelebration(true);
      setSceneCompleted(true);
      setTimeout(() => pwaInstall.triggerInstallPrompt(), 2000);
    }

    if (isAuthenticated && session?.name) {
      fetch("/api/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          scriptName: session.name,
          accuracy: avgAccuracy,
          linesTotal: totalUserLines,
          linesCorrect: perfectLines,
          linesSkipped: skippedLines,
          durationSeconds: duration,
          memorizationMode: session.memorizationMode ?? null,
        }),
      }).then((res) => {
        if (res.ok) {
          import("@/lib/queryClient").then(({ queryClient }) => {
            queryClient.invalidateQueries({ queryKey: ["/api/performance"] });
          }).catch(() => {});
        }
      }).catch((err) => console.warn("[Performance] Failed to save run:", err));
    }
  }, [camera.isRecording, camera.stopRecording, incrementRunsCompleted, recordRehearsal, setPlaying, session?.scenes, session?.currentSceneIndex, session?.userRoleId, isAuthenticated, session?.name, session?.memorizationMode]);

  // Reset run performance for a new run
  const resetRunPerformance = useCallback(() => {
    runPerformanceRef.current = {
      linePerformances: [],
      startTime: Date.now(),
    };
    currentLineAccuracyRef.current = 0;
    lastGapMsRef.current = null;
    avgGapMsRef.current = 300;
  }, []);

  useEffect(() => {
    if (session?.ambientEnabled && !ambientRef.current) {
      try {
        const ctx = new AudioContext();
        if (ctx.state === 'suspended') {
          const resumeOnGesture = () => {
            ctx.resume().catch(() => {});
            document.removeEventListener('touchstart', resumeOnGesture);
            document.removeEventListener('click', resumeOnGesture);
          };
          document.addEventListener('touchstart', resumeOnGesture, { once: true });
          document.addEventListener('click', resumeOnGesture, { once: true });
        }
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
    
    if (line) {
      const wasSkipped = accuracy < 20;
      recordLinePerformance({
        lineId: line.id,
        accuracy,
        usedHint: hintUsedForLineRef.current,
        skipped: wasSkipped,
      });
    }
    
    currentLineAccuracyRef.current = 0;
    hintUsedForLineRef.current = false;
    
    incrementLinesRehearsed();
    recordRehearsal(1, 0);
    triggerHaptic("tap");
    setUserTranscript("");
    setIsUserTurn(false);
    waitingForUserRef.current = false;
    
    const next = getNextLine();
    if (next) {
      const userEmotion = line ? detectEmotion(line.text, line.direction) : "neutral";
      const nextEmotion = next.emotionHint || detectEmotion(next.text, next.direction);
      const timing = getConversationalTiming(nextEmotion, line?.text, userEmotion, next.direction);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const minPause = isIOS ? 350 : 180;
      const rawPause = isUserLine(next) ? minPause : Math.max(timing.userToAiPauseMs, minPause);
      const pauseMs = applyRhythmAdaptation(rawPause, minPause, 500);
      
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
      return;
    }
    
    if (speechRecognition.available && !micBlocked && micEnabledRef.current) {
      const isPWA = window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      const micDelay = isPWA ? 350 : speechRecognition.isMobileDevice ? 250 : 0;
      setTimeout(() => {
        if (isPlayingRef.current && waitingForUserRef.current) {
          speechRecognition.softStart();
        }
      }, micDelay);
      
      autoAdvanceTimeoutRef.current = setTimeout(() => {
        if (isPlayingRef.current && waitingForUserRef.current) {
          speechRecognition.abort();
          waitingForUserRef.current = false;
          advanceAfterUserLineRef.current();
        }
      }, 60000);
    } else {
      if (!speechRecognition.available) {
        if (!tapModeRef.current) {
          setTapMode(true);
          tapModeRef.current = true;
          try { localStorage.setItem("costar-tap-mode", "true"); } catch {}
          const message = speechRecognition.isIOSPWANoSpeech
            ? "Voice recognition is not available in this app mode. Tap to advance through your lines."
            : "Tap mode enabled. Tap the screen to advance through your lines.";
          toast({
            title: "Voice recognition unavailable",
            description: message,
          });
          return;
        }
      }
      autoAdvanceTimeoutRef.current = setTimeout(() => {
        if (isPlayingRef.current && waitingForUserRef.current) {
          waitingForUserRef.current = false;
          advanceAfterUserLineRef.current();
        }
      }, 5000);
    }
  }, [micBlocked, toast]);

  const prefetchNextAILine = useCallback((maxLines: number = 2) => {
    if (!session) return;
    const scene = session.scenes[session.currentSceneIndex];
    if (!scene) return;
    
    const startIdx = session.currentLineIndex + 1;
    let prefetched = 0;
    for (let i = startIdx; i < Math.min(startIdx + 5, scene.lines.length); i++) {
      const line = scene.lines[i];
      if (!line || line.roleId === session.userRoleId) continue;
      
      const role = getRoleById(line.roleId);
      const roleIndex = session.roles.findIndex(r => r.id === line.roleId);
      const emotion = line.emotionHint || detectEmotion(line.text, line.direction);
      const preset = role?.voicePreset || "natural";
      
      const prevLine = i > 0 ? scene.lines[i - 1] : null;
      const nextLine = i + 1 < scene.lines.length ? scene.lines[i + 1] : null;
      ttsEngine.prefetch(line.text, {
        characterName: role?.name || "Character",
        characterIndex: roleIndex >= 0 ? roleIndex : 0,
        emotion,
        preset,
        direction: line.direction || "",
        playbackSpeed: session.playbackSpeed ?? 1.0,
        previousText: prevLine?.text || "",
        nextText: nextLine?.text || "",
      });
      prefetched++;
      if (prefetched >= maxLines) break;
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
    setTtsGenerating(false);
    setSpeakingWordIndex(-1);
  }, []);

  const speakLine = useCallback(() => {
    const line = getCurrentLine();
    if (!line || !session) {
      return;
    }

    const lineKey = `${session.currentSceneIndex}-${session.currentLineIndex}`;
    
    if (speakingLineRef.current === lineKey) {
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
    setTtsGenerating(false);
    setSpeakingWordIndex(-1);

    speakingLineRef.current = lineKey;

    const isUser = isUserLine(line);
    if (isUser) {
      setTtsGenerating(false);
      startListeningForUser();
      prefetchNextAILine();
      return;
    }

    prefetchNextAILine(1);

    const role = getRoleById(line.roleId);
    const roleIndex = session.roles.findIndex(r => r.id === line.roleId);
    const emotion = line.emotionHint || detectEmotion(line.text, line.direction);
    const preset = role?.voicePreset || "natural";
    const prosody = calculateProsody(emotion, preset);

    const prev = getPreviousLine();
    const prevEmotion = prev ? (prev.emotionHint || detectEmotion(prev.text, prev.direction)) : undefined;
    const timing = getConversationalTiming(emotion, prev?.text, prevEmotion, line.direction);

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
        speakingLineRef.current = null;
        return;
      }
      if (speakingLineRef.current !== lineKey) {
        return;
      }
      
      setTtsGenerating(true);
      ttsEngine.speak(ttsText, prosody, (result: SpeakResult) => {
        setTtsGenerating(false);
        clearWordTimer();
        
        if (isPlayingRef.current && speakingLineRef.current === lineKey) {
          const next = getNextLine();
          const nextIsUser = next ? isUserLine(next) : false;
          const nextEmotion = next ? (next.emotionHint || detectEmotion(next.text, next.direction)) : undefined;
          const nextTiming = next ? getConversationalTiming(nextEmotion || "neutral", line.text, emotion, next?.direction) : null;
          const rawPause = nextIsUser
            ? (nextTiming?.aiToUserPauseMs ?? 100)
            : (nextTiming?.aiToAiPauseMs ?? 400);
          const pauseMs = nextIsUser
            ? applyRhythmAdaptation(rawPause, 50, 300)
            : applyRhythmAdaptation(rawPause, 150, 1200);
          
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
        previousText: prev?.text || "",
        nextText: getNextLine()?.text || "",
        onStart: (duration: number, wordCount: number) => {
          setTtsGenerating(false);
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
  }, [getCurrentLine, getNextLine, getRoleById, isUserLine, nextLine, setPlaying, session, startListeningForUser, completeRun, prefetchNextAILine]);

  useEffect(() => { speakLineRef.current = speakLine; }, [speakLine]);
  useEffect(() => { startListeningForUserRef.current = startListeningForUser; }, [startListeningForUser]);
  useEffect(() => { stopAllPlaybackRef.current = stopAllPlayback; }, [stopAllPlayback]);

  useEffect(() => {
    const lineKey = session ? `${session.currentSceneIndex}-${session.currentLineIndex}` : null;
    
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }
    
    const line = getCurrentLine();
    const isUser = line ? isUserLine(line) : false;

    if (session?.isPlaying && line) {
      if (speakingLineRef.current === lineKey) {
        return;
      }
      
      ttsEngine.stop();
      if (wordTimerRef.current) {
        clearInterval(wordTimerRef.current);
        wordTimerRef.current = null;
      }
      setIsSpeaking(false);
      setTtsGenerating(false);
      setSpeakingWordIndex(-1);
      
      if (isUser) {
        speechRecognition.pause();
        if (!waitingForUserRef.current) {
          speakingLineRef.current = lineKey;
          startListeningForUserRef.current();
        }
      } else {
        speechRecognition.pause();
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
  }, [session?.isPlaying, session?.currentLineIndex, session?.currentSceneIndex, getCurrentLine, isUserLine]);

  const startPlayback = useCallback(() => {
    speakingLineRef.current = null;
    if (session?.currentLineIndex === 0) {
      resetRunPerformance();
    }
    trackFeature("rehearsal", "play");
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
        recordLinePerformance({
          lineId: line.id,
          accuracy,
          usedHint: hintUsedForLineRef.current,
          skipped: wasSkipped,
        });
        currentLineAccuracyRef.current = 0;
        hintUsedForLineRef.current = false;
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
    if (scriptFingerprintRef.current && session) {
      saveResumePosition(scriptFingerprintRef.current, {
        lineIndex: session.currentLineIndex ?? 0,
        sceneIndex: session.currentSceneIndex ?? 0,
        roleId: session.userRoleId,
        timestamp: Date.now(),
      });
    }
    if (didRehearsalToday && stats.currentStreak > 0 && !sessionStorage.getItem("costar-streak-toast-shown")) {
      sessionStorage.setItem("costar-streak-toast-shown", "1");
      toast({
        title: `${stats.currentStreak}-day streak`,
        description: "Come back tomorrow to keep it going.",
      });
    }
    try {
      ttsEngine.stop();
    } catch {}
    try {
      speechRecognition.abort();
    } catch {}
    clearUserRole();
    onBack();
  }, [clearUserRole, onBack, session, didRehearsalToday, stats.currentStreak, toast]);

  const handleClearSession = () => {
    ttsEngine.stop();
    speechRecognition.abort();
    clearSession();
    onBack();
  };

  const handleMemorizationChange = (mode: MemorizationMode) => {
    setMemorizationMode(mode);
  };

  const handleSaveScript = async () => {
    if (!session || savingScript) return;
    if (!(!!user?.subscriptionTier && ["pro", "comp", "internal"].includes(user.subscriptionTier))) {
      toast({ description: "Saving scripts is a Pro feature. Upgrade to unlock." });
      onNavigate?.("subscription");
      return;
    }
    setSavingScript(true);
    try {
      const res = await fetch("/api/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: session.name || "Untitled Script",
          rawScript: lastRawScript || "",
          rolesJson: session.roles,
          scenesJson: session.scenes,
          userRoleId: session.userRoleId ?? null,
          lastPosition: session.currentLineIndex ?? 0,
          lastScene: session.currentSceneIndex ?? 0,
        }),
      });
      if (res.ok) {
        setScriptSaved(true);
        toast({ description: "Script saved to your library" });
        try {
          const { queryClient } = await import("@/lib/queryClient");
          queryClient.invalidateQueries({ queryKey: ["/api/scripts"] });
        } catch {}
      } else {
        toast({ title: "Could not save script", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not save script", variant: "destructive" });
    } finally {
      setSavingScript(false);
    }
  };

  const enterHandsFreeMode = async () => {
    if (!session) return;
    if (!(!!user?.subscriptionTier && ["pro", "comp", "internal"].includes(user.subscriptionTier))) {
      toast({ description: "Hands-free mode is a Pro feature. Upgrade to unlock it." });
      onNavigate?.("subscription");
      return;
    }
    const currentScene = session.scenes[session.currentSceneIndex];
    if (!currentScene || currentScene.lines.length === 0) {
      toast({ description: "Load a script first to use hands-free mode" });
      return;
    }
    setHandsFreeMode(true);
    trackFeature("hands-free-mode", "enter");
    
    const wasTapMode = tapMode;
    if (tapMode && speechRecognition.available) {
      setTapMode(false);
      tapModeRef.current = false;
      try { localStorage.setItem("costar-tap-mode", "false"); } catch {}
    }
    
    if (!micEnabled && speechRecognition.available) {
      if (micPermissionGranted) {
        setMicEnabledSync(true);
      } else {
        await requestMicPermission();
      }
    }
    
    if (session.isPlaying && wasTapMode && currentIsUserLine && waitingForUserRef.current) {
      waitingForUserRef.current = false;
      speechRecognition.abort();
      speakingLineRef.current = null;
      setPlaying(false);
      setTimeout(() => {
        speakingLineRef.current = null;
        setPlaying(true);
      }, 300);
    } else if (!session.isPlaying) {
      setTimeout(() => {
        speakingLineRef.current = null;
        setPlaying(true);
      }, 600);
    }
  };

  const exitHandsFreeMode = () => {
    setHandsFreeMode(false);
  };

  const checkRunUsageAllowed = async (): Promise<boolean> => {
    const isPro = !!user?.subscriptionTier && ["pro", "comp", "internal"].includes(user.subscriptionTier);
    if (!isAuthenticated || isPro) return true;
    setCheckingRunLimit(true);
    try {
      const dfp = await getDeviceFingerprint();
      const res = await fetch("/api/script-usage/increment", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceFingerprint: dfp }),
      });
      if (!res.ok) {
        setCheckingRunLimit(false);
        return false;
      }
      const data = await res.json();
      try { sessionStorage.setItem("costar-usage", JSON.stringify(data)); } catch {}
      if (!data.allowed) {
        setRunLimitReached(true);
        setRunLimitResetsAt(data.resetsAt);
        setCheckingRunLimit(false);
        return false;
      }
    } catch {
      setCheckingRunLimit(false);
      return false;
    }
    setCheckingRunLimit(false);
    return true;
  };

  const handleTryAgain = async () => {
    if (!(await checkRunUsageAllowed())) return;
    completeRunInFlightRef.current = false;
    setRunLimitReached(false);
    setShowCelebration(false);
    setSceneCompleted(false);
    setCompletedRunStats(null);
    setPreviousRunAccuracy(null);
    goToLine(0);
    resetRunPerformance();
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

  const getNextStepSuggestions = () => {
    if (!session || !completedRunStats) return [];
    const suggestions: Array<{ id: string; label: string; detail: string; icon: typeof RefreshCcw; action: () => void; priority: number }> = [];

    const dismissAndReset = () => {
      completeRunInFlightRef.current = false;
      setShowCelebration(false);
      setSceneCompleted(false);
      setCompletedRunStats(null);
    };

    const hasMultipleScenes = session.scenes.length > 1;
    const isLastScene = session.currentSceneIndex === session.scenes.length - 1;
    const nextSceneIndex = session.currentSceneIndex + 1;

    if (hasMultipleScenes && !isLastScene) {
      suggestions.push({
        id: "next-scene",
        label: `Continue to Scene ${nextSceneIndex + 1}`,
        detail: `${session.scenes.length - nextSceneIndex} scenes remaining`,
        icon: ArrowRight,
        priority: 10,
        action: async () => {
          if (!(await checkRunUsageAllowed())) return;
          dismissAndReset();
          goToScene(nextSceneIndex);
          resetRunPerformance();
          setTimeout(() => { speakingLineRef.current = null; setPlaying(true); }, 300);
        },
      });
    }

    if (completedRunStats.averageAccuracy < 70 && completedRunStats.totalUserLines > 0) {
      suggestions.push({
        id: "slow-down",
        label: "Slow the pace down",
        detail: `${Math.round(completedRunStats.averageAccuracy)}% — try at 0.8x speed`,
        icon: Clock,
        priority: 9,
        action: async () => {
          if (!(await checkRunUsageAllowed())) return;
          dismissAndReset();
          updateSession({ playbackSpeed: 0.8 });
          goToLine(0);
          resetRunPerformance();
          setTimeout(() => { speakingLineRef.current = null; setPlaying(true); }, 300);
        },
      });
    } else if (completedRunStats.averageAccuracy < 90 && completedRunStats.totalUserLines > 0) {
      suggestions.push({
        id: "improve",
        label: "Improve your accuracy",
        detail: `${Math.round(completedRunStats.averageAccuracy)}% — aim for 90%+`,
        icon: Target,
        priority: 7,
        action: handleTryAgain,
      });
    }

    const currentMode = session.memorizationMode || "off";
    const modeProgression: MemorizationMode[] = ["off", "partial", "cue", "full"];
    const modeLabels: Record<string, string> = { partial: "Partial Hide", cue: "Cue Only", full: "Full Memorization" };
    const currentIdx = modeProgression.indexOf(currentMode);
    if (currentIdx < modeProgression.length - 1 && completedRunStats.averageAccuracy >= 80) {
      const nextMode = modeProgression[currentIdx + 1];
      suggestions.push({
        id: "next-mode",
        label: `Try ${modeLabels[nextMode]}`,
        detail: "Challenge yourself more",
        icon: Sparkles,
        priority: 6,
        action: async () => {
          if (!(await checkRunUsageAllowed())) return;
          dismissAndReset();
          setMemorizationMode(nextMode);
          goToLine(0);
          resetRunPerformance();
          setTimeout(() => { speakingLineRef.current = null; setPlaying(true); }, 300);
        },
      });
    }

    const otherRoles = session.roles.filter(r => r.id !== session.userRoleId);
    if (otherRoles.length > 0) {
      const suggestedRole = otherRoles[0];
      suggestions.push({
        id: "switch-role",
        label: `Try as ${suggestedRole.name}`,
        detail: "See it from another perspective",
        icon: Users,
        priority: 4,
        action: async () => { if (!(await checkRunUsageAllowed())) return; dismissAndReset(); setUserRole(suggestedRole.id); goToLine(0); resetRunPerformance(); },
      });
    }

    if (completedRunStats.averageAccuracy >= 95 && completedRunStats.totalUserLines > 0 && isLastScene) {
      suggestions.push({
        id: "retention",
        label: "Test your retention",
        detail: "Come back tomorrow to see what stuck",
        icon: Zap,
        priority: 3,
        action: () => { dismissAndReset(); handleBackToHome(); },
      });
    }

    suggestions.push({
      id: "new-script",
      label: "Try a new script",
      detail: "Start fresh with something new",
      icon: ArrowRight,
      priority: 1,
      action: () => { dismissAndReset(); handleBackToHome(); },
    });

    return suggestions.sort((a, b) => b.priority - a.priority).slice(0, 3);
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
        } else {
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, w, h);
        }
      } else {
        const isDark = document.documentElement.classList.contains('dark');
        ctx.fillStyle = isDark ? '#0E1218' : '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
      }

      if (!(!!user?.subscriptionTier && ["pro", "comp", "internal"].includes(user.subscriptionTier))) {
        drawWatermark(ctx, w, h);
      }

      screenRecordingFrameRef.current = requestAnimationFrame(drawScreenFrame);
    };

    screenRecordingFrameRef.current = requestAnimationFrame(drawScreenFrame);

    return () => {
      if (screenRecordingFrameRef.current) {
        cancelAnimationFrame(screenRecordingFrameRef.current);
        screenRecordingFrameRef.current = null;
      }
    };
  }, [camera.isRecording, camera.isEnabled, camera.videoRef]);

  useEffect(() => {
    if (!session && !isLoading) {
      onBack();
    }
  }, [session, isLoading, onBack]);

  if (!session) {
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

  const aiState: AIState = isSpeaking ? "speaking"
    : isListening ? "listening"
    : (ttsGenerating && session.isPlaying && !currentIsUserLine) ? "thinking"
    : "idle";

  return (
    <div className={cn(
      "h-[100dvh] flex flex-col overflow-hidden",
      camera.isEnabled ? "bg-transparent" : "bg-background"
    )} data-testid="rehearsal-page">
      <canvas
        ref={camera.screenCanvasRef}
        className="hidden"
        width={1280}
        height={720}
      />
      {camera.isEnabled && (
        <>
          <VideoBackground
            stream={camera.stream}
            videoRef={camera.videoRef}
            canvasRef={camera.canvasRef}
            isRecording={camera.isRecording}
            dimmed={cameraFocus === 'script'}
          />
          <button
            className="fixed inset-0 z-[5]"
            onClick={() => setCameraFocus(prev => prev === 'script' ? 'face' : 'script')}
            aria-label={cameraFocus === 'script' ? "Focus on face" : "Focus on script"}
            data-testid="button-toggle-camera-focus"
          />
          {cameraFocus === 'face' && (
            <button
              onClick={handleBackToHome}
              className="fixed top-4 left-4 z-[15] flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 text-white transition-colors safe-top"
              data-testid="button-camera-exit"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Exit</span>
            </button>
          )}
        </>
      )}
      
      <div className={cn(
        "shrink-0 transition-opacity duration-300",
        camera.isEnabled && cameraFocus === 'face' && "opacity-10 pointer-events-none"
      )}>
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
          onNavigate={onNavigate}
          onSaveScript={isAuthenticated ? handleSaveScript : undefined}
          savingScript={savingScript}
          scriptSaved={scriptSaved}
        />
      </div>

      {isOffline && session?.isPlaying && (
        <div
          className="fixed top-14 left-1/2 -translate-x-1/2 z-[45] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/80 backdrop-blur-sm border border-border/50 animate-fade-in"
          data-testid="indicator-offline-mode"
        >
          <WifiOff className="h-3 w-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground font-medium">Offline mode — using device voices</span>
        </div>
      )}

      {showReadyScreen && session && (() => {
        const sceneCount = session.scenes.length;
        const currentSceneLines = session.scenes[session.currentSceneIndex]?.lines || [];
        const userLines = currentSceneLines.filter(l => l.roleId === session.userRoleId).length;
        const modeLabel: Record<string, string> = { off: "Full Script", partial: "Partial Hide", cue: "Cue Only", full: "Memory" };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md animate-fade-in" data-testid="ready-screen">
            <div className="text-center max-w-xs mx-4 animate-scale-in">
              <Mascot mood="excited" size="sm" className="mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-1">Ready to rehearse</h3>
              <p className="text-sm text-muted-foreground mb-5">
                Playing as <span className="font-medium text-foreground">{userRole?.name || "—"}</span>
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mb-6">
                {sceneCount > 1 && <span>Scene {session.currentSceneIndex + 1}/{sceneCount}</span>}
                <span>{userLines} lines</span>
                <span>{modeLabel[session.memorizationMode || "off"]}</span>
              </div>

              {resumePrompt && (
                <div className="bg-muted/50 rounded-lg p-3 mb-4 text-left" data-testid="resume-prompt">
                  <p className="text-sm font-medium mb-2">Pick up where you left off?</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    {resumePrompt.sceneIndex > 0
                      ? `Scene ${resumePrompt.sceneIndex + 1}, Line ${resumePrompt.lineIndex + 1}`
                      : `Line ${resumePrompt.lineIndex + 1}`}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1"
                      onClick={() => {
                        goToLine(resumePrompt.sceneIndex, resumePrompt.lineIndex);
                        setResumePrompt(null);
                        setReadyCountdown(0);
                      }}
                      data-testid="button-resume"
                    >
                      Resume
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setResumePrompt(null);
                        if (scriptFingerprintRef.current) clearResumePosition(scriptFingerprintRef.current);
                      }}
                      data-testid="button-start-fresh"
                    >
                      Start Fresh
                    </Button>
                  </div>
                </div>
              )}

              {!resumePrompt && (
                <>
                  <div className="text-3xl font-bold text-primary tabular-nums mb-4">{readyCountdown}</div>
                  <Button
                    onClick={() => { setReadyCountdown(0); }}
                    className="w-full"
                    data-testid="button-start-now"
                  >
                    Start Now
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {showTourTip > 0 && showTourTip <= 4 && (
        <div className="fixed top-20 left-4 right-4 z-[55] flex justify-center animate-fade-in" data-testid="tour-tooltip">
          <div className="bg-foreground text-background rounded-xl px-4 py-3 max-w-xs shadow-lg">
            <div className="flex items-start gap-3">
              <Info className="h-4 w-4 shrink-0 mt-0.5 opacity-70" />
              <div>
                <p className="text-sm font-medium">
                  {showTourTip === 1 && "Your lines are highlighted"}
                  {showTourTip === 2 && "Tap any line to jump there"}
                  {showTourTip === 3 && "Say \"LINE\" for a hint"}
                  {showTourTip === 4 && "Space to play/pause"}
                </p>
                <p className="text-xs opacity-70 mt-0.5">
                  {showTourTip === 1 && "Lines with your character's name are yours to speak."}
                  {showTourTip === 2 && "Click or tap any line in the script to jump directly to it."}
                  {showTourTip === 3 && "If you forget a line, say \"LINE\" and your scene partner will give you a hint."}
                  {showTourTip === 4 && "Use the spacebar or the play button to pause and resume."}
                </p>
              </div>
              <button
                onClick={() => {
                  if (showTourTip < 4) setShowTourTip(showTourTip + 1);
                  else setShowTourTip(0);
                }}
                className="text-xs opacity-70 hover:opacity-100 shrink-0 mt-0.5"
                data-testid="button-tour-next"
              >
                {showTourTip < 4 ? "Next" : "Done"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCelebration && (() => {
        const feedback = getPerformanceFeedback();
        const isLastScene = session.scenes.length > 1 && session.currentSceneIndex === session.scenes.length - 1;
        const isScriptComplete = isLastScene;
        const streak = stats.currentStreak;
        
        const confettiColors = [
          "bg-yellow-400 dark:bg-yellow-500",
          "bg-primary/70 dark:bg-primary/60",
          "bg-green-400 dark:bg-green-500",
          "bg-orange-400 dark:bg-orange-500",
          "bg-pink-400 dark:bg-pink-500",
        ];
        const confettiParticles = (feedback?.type === "perfect" || isScriptComplete)
          ? Array.from({ length: isScriptComplete ? 28 : 18 }, (_, i) => ({
              id: i,
              left: 2 + Math.random() * 96,
              delay: i * 0.04 + Math.random() * 0.2,
              duration: 2.2 + Math.random() * 1.2,
              colorClass: confettiColors[i % confettiColors.length],
              size: 5 + Math.random() * 6,
            }))
          : [];
        
        return (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md animate-fade-in"
            onClick={handleDismissCelebration}
          >
            {(feedback?.type === "perfect" || isScriptComplete) && (
              <div className="confetti-container">
                {confettiParticles.map(p => (
                  <div
                    key={p.id}
                    className={cn("confetti-particle", p.colorClass)}
                    style={{
                      left: `${p.left}%`,
                      animationDelay: `${p.delay}s`,
                      animationDuration: `${p.duration}s`,
                      width: `${p.size}px`,
                      height: `${p.size}px`,
                      opacity: 0.8,
                    }}
                  />
                ))}
              </div>
            )}
            
            <div 
              className="bg-card border shadow-2xl rounded-2xl p-6 text-center max-w-sm mx-4 relative"
              onClick={(e) => e.stopPropagation()}
              data-testid="celebration-modal"
            >
              <div className={cn(
                "transition-all duration-500",
                celebrationRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
              )}>
                <Mascot
                  mood={
                    feedback?.type === "perfect" ? "celebrating" :
                    feedback?.type === "great" ? "cheering" :
                    feedback?.type === "good" ? "encouraging" :
                    "proud"
                  }
                  size="sm"
                  className="mx-auto mb-2 celebrate"
                />
                
                <h3 className="text-xl font-bold leading-tight mb-0.5">
                  {isScriptComplete ? "Script Complete" : "Scene Complete"}
                </h3>
                {isScriptComplete && (
                  <p className="text-xs text-muted-foreground mb-1">
                    All {session.scenes.length} scenes finished
                  </p>
                )}
                {feedback && (
                  <p className={cn(
                    "text-sm font-medium mb-1",
                    feedback.type === "perfect" ? "text-yellow-600 dark:text-yellow-400" :
                    feedback.type === "great" ? "text-green-600 dark:text-green-400" :
                    "text-muted-foreground"
                  )}>
                    {feedback.message}
                  </p>
                )}
                {feedback && feedback.detail && (
                  <p className="text-xs text-muted-foreground mb-4">
                    {feedback.detail}
                  </p>
                )}
              </div>

              {completedRunStats && completedRunStats.expectedUserLines > 0 && (
                <div className={cn(
                  "transition-all duration-700 delay-100",
                  celebrationRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                )}>
                  {completedRunStats.totalUserLines > 0 ? (
                    <div className="py-5 mb-4 bg-muted/30 rounded-xl">
                      <div className={cn(
                        "text-5xl font-black tabular-nums tracking-tight mb-1",
                        feedback?.type === "perfect" ? "text-yellow-500 dark:text-yellow-400" :
                        feedback?.type === "great" ? "text-green-500 dark:text-green-400" :
                        "text-foreground"
                      )} data-testid="text-accuracy">
                        {animatedAccuracy}%
                      </div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-medium">accuracy</p>
                      {previousRunAccuracy !== null && completedRunStats.totalUserLines > 0 && (() => {
                        const diff = Math.round(completedRunStats.averageAccuracy) - Math.round(previousRunAccuracy);
                        if (diff > 0) {
                          return (
                            <p className="text-xs font-medium text-green-600 dark:text-green-400 mt-1" data-testid="text-accuracy-trend">
                              <TrendingUp className="inline h-3 w-3 mr-1" />
                              Up {diff}% from last time
                            </p>
                          );
                        } else if (diff < 0) {
                          return (
                            <p className="text-xs font-medium text-muted-foreground mt-1" data-testid="text-accuracy-trend">
                              {Math.abs(diff)}% lower than last time
                            </p>
                          );
                        }
                        return (
                          <p className="text-xs font-medium text-muted-foreground mt-1" data-testid="text-accuracy-trend">
                            Same as last time
                          </p>
                        );
                      })()}
                      <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-border/50 mx-6">
                        <div className="text-center">
                          <span className="text-sm font-bold text-foreground">{completedRunStats.perfectLines}/{completedRunStats.totalUserLines}</span>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">perfect</p>
                        </div>
                        {completedRunStats.hintsUsed > 0 && (
                          <div className="text-center">
                            <span className="text-sm font-bold text-foreground">{completedRunStats.hintsUsed}</span>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">hints</p>
                          </div>
                        )}
                        {completedRunStats.duration > 0 && (
                          <div className="text-center">
                            <span className="text-sm font-bold text-foreground">
                              {completedRunStats.duration < 60
                                ? `${completedRunStats.duration}s`
                                : `${Math.floor(completedRunStats.duration / 60)}m ${completedRunStats.duration % 60}s`
                              }
                            </span>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">time</p>
                          </div>
                        )}
                        {completedRunStats.totalUserLines < completedRunStats.expectedUserLines && (
                          <div className="text-center">
                            <span className="text-sm font-bold text-foreground">{completedRunStats.totalUserLines}/{completedRunStats.expectedUserLines}</span>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">spoken</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 mb-4 bg-muted/30 rounded-xl">
                      <span className="text-3xl font-bold text-foreground">0/{completedRunStats.expectedUserLines}</span>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-widest mt-1">lines spoken</p>
                    </div>
                  )}
                </div>
              )}

              {streak > 0 && (
                <div className={cn(
                  "flex items-center justify-center gap-2 mb-4 py-2 px-4 rounded-full bg-orange-500/10 dark:bg-orange-500/15 mx-auto w-fit transition-all duration-700 delay-200",
                  celebrationRevealed ? "opacity-100 scale-100" : "opacity-0 scale-90"
                )} data-testid="celebration-streak-badge">
                  <Flame className={cn("h-4 w-4 text-orange-500", streak >= 3 && "animate-pulse")} />
                  <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{streak} day streak</span>
                  {streak >= 7 && <Trophy className="h-3.5 w-3.5 text-orange-500" />}
                </div>
              )}
              
              {completedRunStats && completedRunStats.totalUserLines > 0 && (
                <div className={cn(
                  "mb-3 transition-all duration-700 delay-250",
                  celebrationRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                )}>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      const accuracy = Math.round(completedRunStats.averageAccuracy);
                      const shareText = `I just rehearsed "${session.name}" as ${userRole?.name || "my role"} and hit ${accuracy}% accuracy on Co-star Studio 🎭 ${completedRunStats.perfectLines}/${completedRunStats.totalUserLines} lines perfect.`;
                      if (navigator.share) {
                        try {
                          await navigator.share({ title: "My Co-star Score", text: shareText, url: window.location.origin });
                        } catch {}
                      } else {
                        try {
                          await navigator.clipboard.writeText(shareText);
                          toast({ description: "Score copied to clipboard" });
                        } catch {
                          toast({ description: "Could not copy score", variant: "destructive" });
                        }
                      }
                    }}
                    data-testid="button-share-score"
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Your Score
                  </Button>
                </div>
              )}

              {completedRunStats && completedRunStats.totalUserLines > 0 && (!user || user.subscriptionTier === "free") && (
                <button
                  onClick={(e) => { e.stopPropagation(); onNavigate?.("subscription"); }}
                  className={cn(
                    "mb-3 w-full rounded-lg border border-primary/15 bg-primary/[0.04] px-4 py-3 text-left transition-all duration-700 delay-300",
                    celebrationRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                  )}
                  data-testid="pro-tip-card"
                >
                  <div className="flex items-start gap-2.5">
                    <Crown className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-foreground">Unlock unlimited rehearsals</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        {completedRunStats.averageAccuracy >= 85
                          ? "You're on a roll. Pro gives you unlimited takes, performance history, and saved recordings."
                          : "Pro gives you unlimited rehearsals, performance tracking, and saved recordings."}
                      </p>
                    </div>
                  </div>
                </button>
              )}

              {camera.hasRecording && (
                <div className="mb-3">
                  {camera.isUploading ? (
                    <div className="flex flex-col items-center gap-3 py-2">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <p className="text-sm font-medium">Saving to library...</p>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${camera.uploadProgress}%` }} />
                      </div>
                    </div>
                  ) : (
                    <>
                      {isAuthenticated && !!user?.subscriptionTier && ["pro", "comp", "internal"].includes(user.subscriptionTier) && (
                        <Button
                          className="w-full mb-2"
                          onClick={() => setPendingCloudUpload(true)}
                          data-testid="button-save-recording-library"
                        >
                          <CloudUpload className="h-4 w-4 mr-2" />
                          Save to Library
                        </Button>
                      )}
                      <Button
                        variant={!!user?.subscriptionTier && ["pro", "comp", "internal"].includes(user.subscriptionTier) ? "outline" : "default"}
                        className="w-full"
                        onClick={() => camera.downloadRecording(`costar-${session.name || 'rehearsal'}`)}
                        data-testid="button-download-recording"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Recording
                      </Button>
                    </>
                  )}
                  <p className="text-xs text-muted-foreground text-center mt-1.5">
                    {camera.isEnabled ? "Video recording with audio" : "Audio-only recording"}
                  </p>
                </div>
              )}
              
              {!isAuthenticated && (
                <div className="mb-3">
                  <button
                    onClick={() => onBack?.()}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/20 bg-primary/[0.06] transition-colors hover:bg-primary/[0.10]"
                    data-testid="button-signup-nudge"
                  >
                    <div className="shrink-0 w-8 h-8 rounded-full bg-primary/[0.12] flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">Save your progress</p>
                      <p className="text-xs text-muted-foreground">Create a free account to track your improvement</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-auto" />
                  </button>
                </div>
              )}
              {isAuthenticated && session && !scriptSaved && (
                <div className="mb-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleSaveScript}
                    disabled={savingScript}
                    data-testid="button-save-script"
                  >
                    {savingScript ? (
                      <span className="text-xs">Saving...</span>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Save Script
                        {!(!!user?.subscriptionTier && ["pro", "comp", "internal"].includes(user.subscriptionTier)) && (
                          <span className="ml-1.5 text-[10px] font-semibold text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded">Pro</span>
                        )}
                      </>
                    )}
                  </Button>
                </div>
              )}
              {scriptSaved && (
                <p className="text-xs text-green-600 mb-3">Script saved to your library</p>
              )}

              {(() => {
                const suggestions = getNextStepSuggestions();
                if (suggestions.length === 0) return null;
                return (
                  <div className={cn(
                    "mb-4 transition-all duration-700 delay-300",
                    celebrationRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
                  )} data-testid="next-steps-section">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">What's next</p>
                    <div className="flex flex-col gap-2">
                      {suggestions.map((s, idx) => (
                        <button
                          key={s.id}
                          onClick={s.action}
                          className={cn(
                            "flex items-center gap-3 w-full text-left px-3.5 py-3 rounded-xl border bg-card hover-elevate active-elevate-2 transition-all",
                            idx === 0 && "border-primary/20 bg-primary/[0.03]"
                          )}
                          data-testid={`button-next-step-${s.id}`}
                        >
                          <div className={cn(
                            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                            idx === 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                          )}>
                            <s.icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-tight truncate">{s.label}</p>
                            <p className="text-xs text-muted-foreground leading-tight truncate">{s.detail}</p>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {runLimitReached ? (
                <div className="space-y-2" data-testid="run-limit-reached">
                  <div className="rounded-lg border border-border/40 bg-muted/30 px-4 py-3 text-center">
                    <p className="text-sm font-medium text-foreground">Daily limit reached</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {runLimitResetsAt
                        ? `Resets ${new Date(runLimitResetsAt).toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`
                        : "Come back tomorrow for more rehearsals"}
                    </p>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => onNavigate?.("subscription")}
                    data-testid="button-upgrade-from-limit"
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade for Unlimited
                  </Button>
                </div>
              ) : (
                <Button
                  className="w-full"
                  onClick={handleTryAgain}
                  disabled={checkingRunLimit}
                  data-testid="button-try-again"
                >
                  {checkingRunLimit ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-4 w-4 mr-2" />
                  )}
                  Run Again
                </Button>
              )}
              
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

      {pwaInstall.showInstallCard && (
        <div className="fixed inset-x-0 bottom-0 z-[55] p-4 animate-in slide-in-from-bottom-4 fade-in duration-300" data-testid="pwa-install-prompt">
          <div className="bg-card border shadow-2xl rounded-xl p-4 max-w-sm mx-auto">
            <button
              onClick={pwaInstall.dismissInstallCard}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-dismiss-install"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <img src="/favicon.png" alt="Co-star" className="w-7 h-7 rounded-md" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold leading-tight" data-testid="text-install-title">
                  Add Co-star to your home screen
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug" data-testid="text-install-description">
                  Instant access to rehearsal, anytime
                </p>
              </div>
            </div>
            {pwaInstall.isIOS ? (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5" data-testid="ios-install-instructions">
                <Share2 className="h-4 w-4 shrink-0 text-primary" />
                <span>Tap <strong className="text-foreground">Share</strong> then <strong className="text-foreground">Add to Home Screen</strong></span>
              </div>
            ) : (
              <Button
                className="w-full mt-3"
                size="sm"
                onClick={pwaInstall.handleInstall}
                data-testid="button-install-app"
              >
                Install App
              </Button>
            )}
            <button
              onClick={pwaInstall.dismissInstallCard}
              className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
              data-testid="button-not-now-install"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {camera.showDiscardPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border shadow-2xl rounded-xl p-5 text-center max-w-xs mx-4" data-testid="discard-prompt">
            <h3 className="text-base font-semibold mb-1">Stop recording?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {!!user?.subscriptionTier && ["pro", "comp", "internal"].includes(user.subscriptionTier) ? "Save to your cloud library, download, or discard." : "Save the recording or discard it."}
            </p>
            {camera.isUploading ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm font-medium">Uploading to library...</p>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${camera.uploadProgress}%` }} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {!!user?.subscriptionTier && ["pro", "comp", "internal"].includes(user.subscriptionTier) && (
                  <Button
                    className="w-full"
                    onClick={() => {
                      setPendingCloudUpload(true);
                      camera.stopRecording();
                    }}
                    data-testid="button-save-cloud"
                  >
                    <CloudUpload className="h-4 w-4 mr-2" />
                    Save to Library
                  </Button>
                )}
                <Button
                  variant={!!user?.subscriptionTier && ["pro", "comp", "internal"].includes(user.subscriptionTier) ? "outline" : "default"}
                  className="w-full"
                  onClick={() => {
                    camera.confirmStopAndDownload();
                  }}
                  data-testid="button-keep-recording"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
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
            )}
          </div>
        </div>
      )}

      {handsFreeMode && (
        <div className="fixed inset-0 z-[70] bg-black flex flex-col items-center justify-center text-white" data-testid="hands-free-overlay">
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between safe-top">
            <button
              onClick={() => {
                exitHandsFreeMode();
                handleBackToHome();
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              data-testid="button-exit-to-home"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Exit</span>
            </button>
            <button
              onClick={exitHandsFreeMode}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              data-testid="button-exit-hands-free"
            >
              <X className="h-4 w-4" />
              <span className="text-sm font-medium">Script view</span>
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 max-w-sm">
            {sceneCompleted ? (
              <div className="text-center space-y-4 animate-fade-in">
                <div className="w-20 h-20 rounded-full flex items-center justify-center bg-white/10 mx-auto">
                  <Check className="h-8 w-8 text-white/70" />
                </div>
                <p className="text-lg text-white/60">Run complete</p>
                <p className="text-sm text-white/60">Restarting...</p>
              </div>
            ) : currentLine ? (
              <>
                <div className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300",
                  currentIsUserLine
                    ? isListening
                      ? "bg-primary/20 ring-2 ring-primary/50 pulse-ring"
                      : "bg-white/10"
                    : isSpeaking
                      ? "bg-white/10 ring-2 ring-white/20 animate-pulse"
                      : aiState === "thinking"
                        ? "bg-white/5 ring-1 ring-white/20"
                        : "bg-white/5"
                )}>
                  {currentIsUserLine ? (
                    <Mic className={cn(
                      "h-8 w-8",
                      isListening ? "text-primary" : "text-white/70"
                    )} />
                  ) : aiState === "thinking" ? (
                    <Loader2 className="h-8 w-8 text-white/60 animate-spin" />
                  ) : (
                    <Volume2 className={cn(
                      "h-8 w-8",
                      isSpeaking ? "text-white" : "text-white/40"
                    )} />
                  )}
                </div>

                <div className="text-center space-y-2">
                  <p className="text-sm uppercase tracking-widest text-white/40">
                    {currentIsUserLine ? "Your line" : aiState === "thinking" ? "Preparing..." : (
                      getRoleById(currentLine.roleId)?.name || "Scene partner"
                    )}
                  </p>
                  {currentIsUserLine && userTranscript && (
                    <p className="text-lg text-white/60 mt-2 max-w-xs">{userTranscript}</p>
                  )}
                </div>

                <div className="w-full max-w-xs">
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white/30 rounded-full transition-all duration-300"
                      style={{ width: `${totalLines > 0 ? (globalLineNumber / totalLines) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-white/60 text-center mt-2">
                    {globalLineNumber} of {totalLines}
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center space-y-3">
                <Headphones className="h-12 w-12 text-white/60 mx-auto" />
                <p className="text-white/50">Ready to rehearse</p>
              </div>
            )}
          </div>

          <div className="pb-8 safe-bottom flex flex-col items-center gap-4">
            <div className="flex items-center gap-6">
              <button
                onClick={() => {
                  stopAllPlayback();
                  handleTryAgain();
                }}
                className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                data-testid="button-hands-free-restart"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  if (session?.isPlaying) {
                    stopAllPlayback();
                    setPlaying(false);
                  } else {
                    ttsEngine.unlockAudio();
                    setPlaying(true);
                  }
                }}
                className="p-4 rounded-full bg-white/15 hover:bg-white/25 transition-colors"
                data-testid="button-hands-free-play-pause"
              >
                {session?.isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6 ml-0.5" />
                )}
              </button>
            </div>
            <p className="text-xs text-white/60">Hands-free mode</p>
          </div>
        </div>
      )}

      <main
        className={cn(
          "flex-1 min-h-0 flex flex-col justify-center content-inset py-6 animate-fade-in relative z-10 transition-opacity duration-300 overflow-y-auto overscroll-contain",
          camera.isEnabled && "text-white camera-text-shadow",
          camera.isEnabled && cameraFocus === 'face' && "opacity-10 pointer-events-none"
        )}
      >
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
                speechRecognition.softStart();
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
          
          {aiState === "thinking" && !handsFreeMode && (
            <div className="flex items-center justify-center mt-3 animate-fade-in" data-testid="tts-generating-indicator">
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full",
                camera.isEnabled
                  ? "bg-white/5"
                  : "bg-muted/30"
              )}>
                <Loader2 className={cn(
                  "h-3 w-3 animate-spin",
                  camera.isEnabled ? "text-white/60" : "text-muted-foreground/70"
                )} />
                <span className={cn(
                  "text-[10px]",
                  camera.isEnabled ? "text-white/55" : "text-muted-foreground/70"
                )}>
                  Preparing...
                </span>
              </div>
            </div>
          )}

          {showUserTurnIndicator && (
            <div className="flex flex-col items-center mt-4 animate-fade-in" data-testid="user-turn-indicator">
              {tapMode ? (
                <button
                  onClick={tapAdvance}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/5 border-foreground/10 active:scale-[0.97] transition-transform"
                  data-testid="button-tap-advance-main"
                >
                  <Hand className="h-3.5 w-3.5 text-foreground/50" />
                  <span className="text-xs text-foreground/60 font-medium">Tap when ready</span>
                </button>
              ) : (
                <>
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full relative",
                    isListening 
                      ? "bg-primary/8 text-primary/70" 
                      : "bg-foreground/3"
                  )}>
                    {isListening ? (
                      <>
                        <div className="relative">
                          <Mic className="h-3.5 w-3.5 text-primary/60" />
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                        </div>
                        <span className="text-xs text-primary/60 font-medium">Listening...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="h-3.5 w-3.5 text-foreground/40" />
                        <span className="text-xs text-foreground/50 font-medium">Your line</span>
                      </>
                    )}
                  </div>
                  {userTranscript && (
                    <p className="mt-2 text-xs text-muted-foreground/75 max-w-xs text-center transition-opacity duration-300">
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
            className="flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-full shadow-lg hover-elevate active:scale-[0.98] transition-transform"
            data-testid="button-sticky-run-again"
          >
            <RefreshCcw className="h-4 w-4" />
            <span className="text-sm font-medium">Run Again</span>
          </button>
        </div>
      )}

      <footer className={cn(
        "shrink-0 border-t safe-bottom z-40 transition-opacity duration-300",
        camera.isEnabled 
          ? "bg-black/60 backdrop-blur-xl border-white/10 camera-text-shadow" 
          : "glass",
        camera.isEnabled && cameraFocus === 'face' && "opacity-10 pointer-events-none"
      )}>
        <div className="content-inset py-2">
          <PracticeToolbar
            memorizationMode={session.memorizationMode || "off"}
            onMemorizationChange={handleMemorizationChange}
            micEnabled={micEnabled}
            onMicToggle={async () => {
              if (micEnabled) {
                speechRecognition.abort();
                setMicEnabledSync(false);
              } else {
                if (micPermissionGranted) {
                  setMicEnabledSync(true);
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
        
        <div className={cn(
          "content-inset pt-3 pb-4 max-w-md lg:max-w-lg mx-auto",
          camera.isEnabled ? "border-white/5" : "zone-separator-subtle"
        )}>
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
            ttsGenerating={ttsGenerating}
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
          readerVolume={readerVolume}
          earbudsOnly={camera.earbudsOnly}
          onEarbudsOnlyChange={camera.toggleEarbudsOnly}
          cameraEnabled={camera.isEnabled}
          onAmbientToggle={setAmbient}
          onPlaybackSpeedChange={(speed) => updateSession({ playbackSpeed: speed })}
          onReaderDelayChange={(delay) => updateSession({ readerDelay: delay })}
          onTapModeChange={handleTapModeChange}
          onReaderVolumeChange={handleReaderVolumeChange}
          onSceneChange={goToScene}
          onRolePresetChange={handleRolePresetChange}
          onNewScript={handleNewScript}
          onClearSession={handleClearSession}
          isLoading={isLoading}
          error={error}
          onHandsFreeMode={enterHandsFreeMode}
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
