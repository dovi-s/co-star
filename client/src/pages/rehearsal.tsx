import { useState, useCallback, useEffect, useRef } from "react";
import { Header } from "@/components/header";
import { ThreeLineReader } from "@/components/three-line-reader";
import { TransportBar } from "@/components/transport-bar";
import { SettingsDrawer } from "@/components/settings-drawer";
import { PracticeToolbar } from "@/components/practice-toolbar";
import { VideoBackground, type OverlayData } from "@/components/video-background";
import { useSession } from "@/hooks/use-session";
import { useUserStats } from "@/hooks/use-user-stats";
import { useCamera } from "@/hooks/use-camera";
import { useToast } from "@/hooks/use-toast";
import { ttsEngine, calculateProsody, detectEmotion, type SpeakResult } from "@/lib/tts-engine";
import { speechRecognition, type SpeechRecognitionState } from "@/lib/speech-recognition";
import { matchWords } from "@/lib/word-matcher";
import type { VoicePreset, MemorizationMode } from "@shared/schema";
import { Check, Mic, TrendingUp, Target, RefreshCcw, Star, Download } from "lucide-react";
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingWordIndex, setSpeakingWordIndex] = useState(-1);
  
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
  const speakingLineRef = useRef<string | null>(null);
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentLine = getCurrentLine();
  const previousLine = getPreviousLine();
  const nextLineData = getNextLine();
  const totalLines = getTotalScriptLines(); // Total lines across ALL scenes
  const globalLineNumber = getGlobalLineNumber(); // Current position in entire script
  const userRole = session?.userRoleId ? getRoleById(session.userRoleId) : null;
  const currentIsUserLine = isUserLine(currentLine);

  useEffect(() => {
    isPlayingRef.current = session?.isPlaying ?? false;
  }, [session?.isPlaying]);

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
      console.log("[Rehearsal] Speech result:", result.isFinal ? "FINAL" : "interim", result.transcript.substring(0, 30));
      setUserTranscript(result.transcript);
      
      // Check word matching against current line
      const line = getCurrentLine();
      if (line && result.transcript.length > 0 && waitingForUserRef.current) {
        const match = matchWords(line.text, result.transcript);
        console.log("[Rehearsal] Word match:", match.matchedCount, "/", match.totalWords, 
          `(${Math.round(match.percentMatched)}%)`);
        
        // Track best accuracy for this line
        currentLineAccuracyRef.current = Math.max(currentLineAccuracyRef.current, match.percentMatched);
        
        // Auto-advance when user has matched 80%+ of the words
        if (match.percentMatched >= 80) {
          console.log("[Rehearsal] 80%+ match, advancing now!");
          speechRecognition.stop();
          waitingForUserRef.current = false;
          
          if (autoAdvanceTimeoutRef.current) {
            clearTimeout(autoAdvanceTimeoutRef.current);
            autoAdvanceTimeoutRef.current = null;
          }
          
          // Quick pause then advance (150ms for snappy response)
          autoAdvanceTimeoutRef.current = setTimeout(() => {
            if (isPlayingRef.current) {
              advanceAfterUserLine();
            }
          }, 150);
          return;
        }
      }
      
      // On final result, auto-advance if we have at least some progress (35%+)
      if (result.isFinal && waitingForUserRef.current && line) {
        const match = matchWords(line.text, result.transcript);
        if (match.percentMatched >= 35) {
          console.log("[Rehearsal] Final result with", Math.round(match.percentMatched), "% match, advancing");
          waitingForUserRef.current = false;
          
          if (autoAdvanceTimeoutRef.current) {
            clearTimeout(autoAdvanceTimeoutRef.current);
            autoAdvanceTimeoutRef.current = null;
          }
          
          // Quick transition (200ms for snappy response)
          autoAdvanceTimeoutRef.current = setTimeout(() => {
            if (isPlayingRef.current) {
              advanceAfterUserLine();
            }
          }, 200);
        } else {
          console.log("[Rehearsal] Low match on final result, waiting for manual advance");
        }
      }
    });

    speechRecognition.onEnd(() => {
      console.log("[Rehearsal] Speech ended, waiting:", waitingForUserRef.current, "playing:", isPlayingRef.current);
      // Speech recognition ended - auto-restart if still user's turn
      if (waitingForUserRef.current && isPlayingRef.current) {
        console.log("[Rehearsal] Speech ended but still user's turn, auto-restarting...");
        // Brief delay then restart listening
        setTimeout(() => {
          if (waitingForUserRef.current && isPlayingRef.current && !speechRecognition.listening) {
            console.log("[Rehearsal] Restarting speech recognition");
            speechRecognition.start();
          }
        }, 300);
      }
    });

    speechRecognition.onError((error) => {
      console.log("[Rehearsal] Speech error:", error);
      if (error === "not-allowed") {
        setMicBlocked(true);
      }
      // On error, still try to advance if we're waiting
      if (waitingForUserRef.current && isPlayingRef.current) {
        waitingForUserRef.current = false;
        setTimeout(() => {
          if (isPlayingRef.current) {
            advanceAfterUserLine();
          }
        }, 500);
      }
    });

    return () => {
      speechRecognition.abort();
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
    };
  }, []);

  // Backup watcher: if word match hits 70%+, force advancement
  // This catches cases where the speech callback didn't trigger properly
  const advancedForLineRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentLine || !currentIsUserLine || !session?.isPlaying || !userTranscript) {
      return;
    }
    
    // Don't re-advance for the same line
    if (advancedForLineRef.current === currentLine.id) {
      return;
    }
    
    const match = matchWords(currentLine.text, userTranscript);
    if (match.percentMatched >= 80 && waitingForUserRef.current) {
      console.log("[Rehearsal] Backup watcher: 80%+ match detected, forcing advancement");
      advancedForLineRef.current = currentLine.id;
      waitingForUserRef.current = false;
      speechRecognition.stop();
      
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
      
      autoAdvanceTimeoutRef.current = setTimeout(() => {
        if (isPlayingRef.current) {
          advanceAfterUserLine();
        }
      }, 400);
    }
  }, [currentLine, currentIsUserLine, session?.isPlaying, userTranscript]);

  // Reset the advanced-for-line tracker when line changes
  useEffect(() => {
    if (currentLine?.id !== advancedForLineRef.current) {
      advancedForLineRef.current = null;
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
          handlePlayPause();
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
            ttsEngine.stop();
            speechRecognition.abort();
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
  }, [incrementRunsCompleted, recordRehearsal, setPlaying, session?.scenes, session?.currentSceneIndex, session?.userRoleId]);

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
    
    // Record line performance - only count as skipped if very low/no accuracy
    // A "skipped" line is one where the user didn't really attempt to speak it
    if (line) {
      const wasSkipped = accuracy < 20;
      recordLinePerformance({
        lineId: line.id,
        accuracy,
        usedHint: false,
        skipped: wasSkipped,
      });
    }
    
    // Reset for next line
    currentLineAccuracyRef.current = 0;
    
    incrementLinesRehearsed();
    recordRehearsal(1, 0);
    setUserTranscript("");
    setIsUserTurn(false);
    waitingForUserRef.current = false;
    
    const next = getNextLine();
    if (next) {
      nextLine();
    } else {
      // Complete the run
      completeRun();
    }
  }, [getCurrentLine, getNextLine, incrementLinesRehearsed, nextLine, recordRehearsal, completeRun, recordLinePerformance]);

  const startListeningForUser = useCallback(() => {
    console.log("[Rehearsal] Starting user turn, mic available:", speechRecognition.available, "blocked:", micBlocked);
    
    waitingForUserRef.current = true;
    setIsUserTurn(true);
    setUserTranscript("");
    
    // Clear any pending timeouts
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    
    // Only try speech recognition if available and not blocked
    if (speechRecognition.available && !micBlocked) {
      // Small delay to let audio finish and avoid overlap
      setTimeout(() => {
        if (isPlayingRef.current && waitingForUserRef.current) {
          speechRecognition.start();
        }
      }, 200);
      
      // Safety timeout: if no result after 60 seconds, advance anyway
      autoAdvanceTimeoutRef.current = setTimeout(() => {
        if (isPlayingRef.current && waitingForUserRef.current) {
          console.log("[Rehearsal] User turn safety timeout, advancing");
          speechRecognition.abort();
          waitingForUserRef.current = false;
          advanceAfterUserLine();
        }
      }, 60000);
    } else {
      // Fallback: auto-advance after 5 seconds if no speech recognition
      autoAdvanceTimeoutRef.current = setTimeout(() => {
        if (isPlayingRef.current && waitingForUserRef.current) {
          console.log("[Rehearsal] No mic fallback, advancing");
          waitingForUserRef.current = false;
          advanceAfterUserLine();
        }
      }, 5000);
    }
  }, [micBlocked, advanceAfterUserLine]);

  const speakLine = useCallback(() => {
    const line = getCurrentLine();
    if (!line || !session) {
      console.log("[Rehearsal] No line or session to speak");
      return;
    }

    const lineKey = `${session.currentSceneIndex}-${session.currentLineIndex}`;
    
    // Prevent speaking same line twice
    if (speakingLineRef.current === lineKey) {
      console.log("[Rehearsal] Already speaking this line:", lineKey);
      return;
    }
    speakingLineRef.current = lineKey;

    // Clear any pending speak timeout
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }

    const isUser = isUserLine(line);
    if (isUser) {
      console.log("[Rehearsal] User's line, starting listening");
      startListeningForUser();
      return;
    }

    const role = getRoleById(line.roleId);
    const roleIndex = session.roles.findIndex(r => r.id === line.roleId);
    const emotion = line.emotionHint || detectEmotion(line.text, line.direction);
    const preset = role?.voicePreset || "natural";
    const prosody = calculateProsody(emotion, preset);

    console.log("[Rehearsal] Speaking AI line:", role?.name, "index:", roleIndex, "emotion:", emotion);

    // Helper to clear word timer
    const clearWordTimer = () => {
      if (wordTimerRef.current) {
        clearInterval(wordTimerRef.current);
        wordTimerRef.current = null;
      }
      setIsSpeaking(false);
      setSpeakingWordIndex(-1);
    };

    // Very brief pause before speaking (natural flow)
    speakTimeoutRef.current = setTimeout(() => {
      if (!isPlayingRef.current) {
        console.log("[Rehearsal] Not playing anymore, skipping TTS");
        speakingLineRef.current = null;
        return;
      }
      
      ttsEngine.speak(line.text, prosody, (result: SpeakResult) => {
        console.log("[Rehearsal] TTS complete:", result, "for line:", lineKey);
        clearWordTimer();
        
        // Only advance if still playing AND this is still the current line we started
        // This prevents race conditions where callback fires after line already changed
        if (isPlayingRef.current && speakingLineRef.current === lineKey) {
          // Count this line as rehearsed
          incrementLinesRehearsed();
          
          // Brief conversational pause before next line
          setTimeout(() => {
            if (!isPlayingRef.current) {
              console.log("[Rehearsal] Stopped during pause");
              speakingLineRef.current = null;
              return;
            }
            
            // Double-check we're still on the same line (prevents double-advance)
            if (speakingLineRef.current !== lineKey) {
              console.log("[Rehearsal] Line already changed, skipping advance");
              return;
            }
            
            speakingLineRef.current = null;
            
            const next = getNextLine();
            if (next) {
              console.log("[Rehearsal] Advancing to next line");
              nextLine();
            } else {
              console.log("[Rehearsal] Scene complete");
              completeRun();
            }
          }, 200);
        } else {
          console.log("[Rehearsal] TTS callback ignored - state changed");
          speakingLineRef.current = null;
        }
      }, {
        characterName: role?.name || "Character",
        characterIndex: roleIndex >= 0 ? roleIndex : 0,
        emotion,
        preset,
        playbackSpeed: session.playbackSpeed ?? 1.0,
        onStart: (duration: number, wordCount: number) => {
          // Set up word-by-word highlighting timer
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
        },
      });
    }, 100);
  }, [getCurrentLine, getNextLine, getRoleById, isUserLine, nextLine, setPlaying, session, incrementLinesRehearsed, startListeningForUser, completeRun]);

  useEffect(() => {
    const lineKey = session ? `${session.currentSceneIndex}-${session.currentLineIndex}` : null;
    
    if (session?.isPlaying && currentLine) {
      // Check if we're already handling this exact line
      // This prevents double-triggering when state updates rapidly
      if (speakingLineRef.current === lineKey) {
        console.log("[Rehearsal] Effect: Already handling line", lineKey);
        return;
      }
      
      if (currentIsUserLine) {
        ttsEngine.stop();
        if (!waitingForUserRef.current) {
          console.log("[Rehearsal] Effect: Starting user turn for", lineKey);
          speakingLineRef.current = lineKey;
          startListeningForUser();
        }
      } else {
        speechRecognition.abort();
        waitingForUserRef.current = false;
        setIsUserTurn(false);
        console.log("[Rehearsal] Effect: Speaking AI line", lineKey);
        speakLine();
      }
    } else {
      ttsEngine.stop();
      speechRecognition.abort();
      waitingForUserRef.current = false;
      setIsUserTurn(false);
      speakingLineRef.current = null;
      if (speakTimeoutRef.current) {
        clearTimeout(speakTimeoutRef.current);
        speakTimeoutRef.current = null;
      }
    }
  }, [session?.isPlaying, session?.currentLineIndex, session?.currentSceneIndex]);

  const handlePlayPause = () => {
    if (session?.isPlaying) {
      ttsEngine.stop();
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
      setIsSpeaking(false);
      setSpeakingWordIndex(-1);
      setPlaying(false);
    } else {
      speakingLineRef.current = null;
      // Only reset performance if starting from the beginning
      if (session?.currentLineIndex === 0) {
        resetRunPerformance();
      }
      setPlaying(true);
    }
  };

  const handleNext = () => {
    ttsEngine.stop();
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
    // Clear any pending auto-advance timeout to prevent double-recording
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    setIsSpeaking(false);
    setSpeakingWordIndex(-1);
    
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
    ttsEngine.stop();
    speechRecognition.abort();
    waitingForUserRef.current = false;
    setIsUserTurn(false);
    setUserTranscript("");
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
    setIsSpeaking(false);
    setSpeakingWordIndex(-1);
    prevLine();
  };

  const handleRepeat = () => {
    ttsEngine.stop();
    speechRecognition.abort();
    waitingForUserRef.current = false;
    setIsUserTurn(false);
    setUserTranscript("");
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
    setIsSpeaking(false);
    setSpeakingWordIndex(-1);
    
    goToLine(0);
    setPlaying(false);
  };

  const handleJumpToLine = (lineIndex: number, sceneIndex?: number) => {
    ttsEngine.stop();
    speechRecognition.abort();
    waitingForUserRef.current = false;
    setIsUserTurn(false);
    setUserTranscript("");
    speakingLineRef.current = null;
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    
    if (sceneIndex !== undefined) {
      goToScene(sceneIndex);
    }
    goToLine(lineIndex);
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
      {camera.isEnabled && (
        <VideoBackground
          stream={camera.stream}
          videoRef={camera.videoRef}
          canvasRef={camera.canvasRef}
          isRecording={camera.isRecording}
          overlayData={camera.isRecording ? {
            currentLine: currentLine ? {
              text: currentLine.text,
              roleName: currentLine.roleName,
              direction: currentLine.direction,
              isUserLine: currentIsUserLine,
            } : undefined,
            previousLine: previousLine ? {
              text: previousLine.text,
              roleName: previousLine.roleName,
            } : undefined,
            nextLine: nextLineData ? {
              text: nextLineData.text,
              roleName: nextLineData.roleName,
            } : undefined,
          } : undefined}
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
                <Button
                  variant="outline"
                  className="w-full mb-2"
                  onClick={() => camera.downloadRecording(`castmate-${session.name || 'rehearsal'}`)}
                  data-testid="button-download-recording"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Recording
                </Button>
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

      <main className={cn(
        "flex-1 flex flex-col justify-center px-4 py-6 animate-fade-in relative z-10",
        camera.isEnabled && "text-white"
      )}>
        {/* Subtle gradient accent at top - hide when camera is on */}
        {!camera.isEnabled && (
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/[0.04] to-transparent pointer-events-none" />
        )}
        <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full relative">
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
            onRestartListening={() => {
              if (!speechRecognition.listening && waitingForUserRef.current) {
                speechRecognition.start();
              }
            }}
            onLineClick={(line) => {
              const lineIndex = currentScene?.lines?.findIndex(l => l.id === line.id) ?? -1;
              if (lineIndex !== -1 && lineIndex !== session.currentLineIndex) {
                if (session.isPlaying) {
                  ttsEngine.stop();
                  speechRecognition.stop();
                }
                updateSession({ currentLineIndex: lineIndex, isPlaying: false });
              }
            }}
          />
          
          {showUserTurnIndicator && (
            <div className="flex flex-col items-center mt-6 animate-fade-in" data-testid="user-turn-indicator">
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
            cameraEnabled={camera.isEnabled}
            onCameraToggle={camera.toggleCamera}
            isRecording={camera.isRecording}
            onRecordToggle={camera.toggleRecording}
            recordingTime={camera.recordingTime}
          />
        </div>
        
        <div className="px-4 py-5 max-w-md mx-auto">
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
          />
        </div>

        <SettingsDrawer
          roles={session.roles}
          scenes={session.scenes}
          currentSceneIndex={session.currentSceneIndex}
          userRoleId={session.userRoleId}
          ambientEnabled={session.ambientEnabled}
          playbackSpeed={session.playbackSpeed ?? 1.0}
          onAmbientToggle={setAmbient}
          onPlaybackSpeedChange={(speed) => updateSession({ playbackSpeed: speed })}
          onSceneChange={goToScene}
          onRolePresetChange={handleRolePresetChange}
          onNewScript={handleNewScript}
          onClearSession={handleClearSession}
          isLoading={isLoading}
          error={error}
        />
      </footer>
    </div>
  );
}
