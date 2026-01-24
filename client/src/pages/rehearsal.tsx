import { useState, useCallback, useEffect, useRef } from "react";
import { Header } from "@/components/header";
import { ThreeLineReader } from "@/components/three-line-reader";
import { TransportBar } from "@/components/transport-bar";
import { SettingsDrawer } from "@/components/settings-drawer";
import { MemorizationToggle } from "@/components/memorization-toggle";
import { useSession } from "@/hooks/use-session";
import { useUserStats } from "@/hooks/use-user-stats";
import { ttsEngine, calculateProsody, detectEmotion, type SpeakResult } from "@/lib/tts-engine";
import { speechRecognition, type SpeechRecognitionState } from "@/lib/speech-recognition";
import { matchWords } from "@/lib/word-matcher";
import type { VoicePreset, MemorizationMode } from "@shared/schema";
import { Check, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

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
    createSession,
    clearSession,
    clearUserRole,
    isLoading,
    error,
  } = useSession();

  const { stats, recordRehearsal } = useUserStats();
  const [fontSize, setFontSize] = useState(1);
  const [showDirections, setShowDirections] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [listeningState, setListeningState] = useState<SpeechRecognitionState>("idle");
  const [userTranscript, setUserTranscript] = useState("");
  const [isUserTurn, setIsUserTurn] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingWordIndex, setSpeakingWordIndex] = useState(-1);
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
  const totalLines = getTotalLines();
  const userRole = session?.userRoleId ? getRoleById(session.userRoleId) : null;
  const currentIsUserLine = isUserLine(currentLine);

  useEffect(() => {
    isPlayingRef.current = session?.isPlaying ?? false;
  }, [session?.isPlaying]);

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
      if (line && waitingForUserRef.current && result.transcript.length > 0) {
        const match = matchWords(line.text, result.transcript);
        console.log("[Rehearsal] Word match:", match.matchedCount, "/", match.totalWords, `(${Math.round(match.percentMatched)}%)`);
        
        // Auto-advance when user has matched enough words (60%+ or completed short lines)
        if (match.isComplete) {
          console.log("[Rehearsal] Line complete, advancing");
          speechRecognition.stop();
          waitingForUserRef.current = false;
          
          if (autoAdvanceTimeoutRef.current) {
            clearTimeout(autoAdvanceTimeoutRef.current);
            autoAdvanceTimeoutRef.current = null;
          }
          
          // Quick pause then advance
          autoAdvanceTimeoutRef.current = setTimeout(() => {
            if (isPlayingRef.current) {
              advanceAfterUserLine();
            }
          }, 400);
          return;
        }
      }
      
      // On final result, only auto-advance if we have a decent match (50%+)
      // Otherwise let user keep speaking or tap Next manually
      if (result.isFinal && waitingForUserRef.current) {
        const match = line ? matchWords(line.text, result.transcript) : null;
        if (match && match.percentMatched >= 50) {
          console.log("[Rehearsal] Got final speech result with decent match, advancing");
          waitingForUserRef.current = false;
          
          if (autoAdvanceTimeoutRef.current) {
            clearTimeout(autoAdvanceTimeoutRef.current);
            autoAdvanceTimeoutRef.current = null;
          }
          
          autoAdvanceTimeoutRef.current = setTimeout(() => {
            if (isPlayingRef.current) {
              advanceAfterUserLine();
            }
          }, 600);
        } else {
          console.log("[Rehearsal] Final result but low match, waiting for more speech or manual advance");
        }
      }
    });

    speechRecognition.onEnd(() => {
      console.log("[Rehearsal] Speech ended, waiting:", waitingForUserRef.current, "playing:", isPlayingRef.current);
      // Speech recognition ended - only advance if user has made some progress
      // Otherwise they can tap Next manually or try speaking again
      if (waitingForUserRef.current && isPlayingRef.current) {
        // Don't auto-advance on speech end - let user control the pace
        // They can tap Next when ready or speak again to resume listening
        console.log("[Rehearsal] Speech ended, waiting for user to tap Next or speak again");
        // Note: We're NOT auto-advancing here anymore - better user experience
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

  useEffect(() => {
    if (session?.ambientEnabled && !ambientRef.current) {
      try {
        const ctx = new AudioContext();
        const gain = ctx.createGain();
        gain.gain.value = 0.015;
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
    incrementLinesRehearsed();
    recordRehearsal(1, 0);
    setUserTranscript("");
    setIsUserTurn(false);
    waitingForUserRef.current = false;
    
    const next = getNextLine();
    if (next) {
      nextLine();
    } else {
      setPlaying(false);
      incrementRunsCompleted();
      recordRehearsal(0, 1);
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 3000);
    }
  }, [getNextLine, incrementLinesRehearsed, incrementRunsCompleted, nextLine, recordRehearsal, setPlaying]);

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
        console.log("[Rehearsal] TTS complete:", result);
        clearWordTimer();
        
        // Always try to advance regardless of result (success or error)
        if (isPlayingRef.current) {
          incrementLinesRehearsed();
          
          // Brief conversational pause before next line
          setTimeout(() => {
            if (!isPlayingRef.current) {
              console.log("[Rehearsal] Stopped during pause");
              speakingLineRef.current = null;
              return;
            }
            
            speakingLineRef.current = null;
            
            const next = getNextLine();
            if (next) {
              console.log("[Rehearsal] Advancing to next line");
              nextLine();
            } else {
              console.log("[Rehearsal] Scene complete");
              setPlaying(false);
              incrementRunsCompleted();
              setShowCelebration(true);
              setTimeout(() => setShowCelebration(false), 3000);
            }
          }, 200);
        } else {
          speakingLineRef.current = null;
        }
      }, {
        characterName: role?.name || "Character",
        characterIndex: roleIndex >= 0 ? roleIndex : 0,
        emotion,
        preset,
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
  }, [getCurrentLine, getNextLine, getRoleById, isUserLine, nextLine, setPlaying, session, incrementLinesRehearsed, incrementRunsCompleted, startListeningForUser]);

  useEffect(() => {
    if (session?.isPlaying && currentLine) {
      if (currentIsUserLine) {
        ttsEngine.stop();
        if (!waitingForUserRef.current) {
          speakingLineRef.current = `${session.currentSceneIndex}-${session.currentLineIndex}`;
          startListeningForUser();
        }
      } else {
        speechRecognition.abort();
        waitingForUserRef.current = false;
        setIsUserTurn(false);
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
    setIsSpeaking(false);
    setSpeakingWordIndex(-1);
    
    if (currentIsUserLine) {
      incrementLinesRehearsed();
      recordRehearsal(1, 0);
    }
    setUserTranscript("");
    
    const next = getNextLine();
    if (next) {
      nextLine();
    } else if (session?.isPlaying) {
      setPlaying(false);
      incrementRunsCompleted();
      recordRehearsal(0, 1);
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 3000);
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
    
    if (sceneIndex !== undefined) {
      goToScene(sceneIndex);
    }
    goToLine(lineIndex);
  };

  const handleRolePresetChange = (roleId: string, preset: VoicePreset) => {
    updateRolePreset({ roleId, voicePreset: preset });
  };

  const handleNewScript = (name: string, rawScript: string) => {
    ttsEngine.stop();
    speechRecognition.abort();
    setPlaying(false);
    createSession(name, rawScript);
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
    <div className="min-h-screen flex flex-col bg-background curtain-enter" data-testid="rehearsal-page">
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
      />

      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border shadow-xl rounded-xl p-8 text-center pointer-events-auto max-w-sm mx-4 animate-scale-in">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-5 animate-bounce-in">
                <Check className="h-8 w-8" />
              </div>
              <div className="absolute -top-2 -left-2 w-3 h-3 rounded-full bg-primary/60 animate-ping" />
              <div className="absolute -top-1 -right-3 w-2 h-2 rounded-full bg-primary/40 animate-ping" style={{ animationDelay: "200ms" }} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Scene Complete</h3>
            <p className="text-muted-foreground mb-4">
              Run {session.runsCompleted + 1} finished
            </p>
            <div className="flex items-center justify-center gap-4 text-sm">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold text-foreground">{session.linesRehearsed}</span>
                <span className="text-xs text-muted-foreground">lines</span>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold text-foreground">{session.runsCompleted + 1}</span>
                <span className="text-xs text-muted-foreground">runs</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col justify-center px-4 py-6 animate-fade-in">
        <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full">
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
          />
          
          {showUserTurnIndicator && (
            <div className="flex flex-col items-center mt-6 animate-fade-in" data-testid="user-turn-indicator">
              <div className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full border",
                isListening 
                  ? "bg-primary/10 border-primary/20" 
                  : "bg-foreground/5 border-foreground/10"
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

      <footer className="sticky bottom-0 glass border-t safe-bottom z-40">
        <div className="px-4 py-2">
          <MemorizationToggle 
            mode={session.memorizationMode || "off"}
            onChange={handleMemorizationChange}
          />
        </div>
        
        <div className="px-4 py-5 max-w-md mx-auto">
          <TransportBar
            isPlaying={session.isPlaying}
            canGoBack={canGoBack}
            canGoNext={canGoNext}
            currentLine={session.currentLineIndex}
            totalLines={totalLines}
            onBack={handleBack}
            onPlayPause={handlePlayPause}
            onNext={handleNext}
            onRepeat={handleRepeat}
          />
        </div>

        <SettingsDrawer
          roles={session.roles}
          scenes={session.scenes}
          currentSceneIndex={session.currentSceneIndex}
          userRoleId={session.userRoleId}
          ambientEnabled={session.ambientEnabled}
          onAmbientToggle={setAmbient}
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
