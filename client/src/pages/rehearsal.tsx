import { useState, useCallback, useEffect, useRef } from "react";
import { Header } from "@/components/header";
import { ThreeLineReader } from "@/components/three-line-reader";
import { TransportBar } from "@/components/transport-bar";
import { SettingsDrawer } from "@/components/settings-drawer";
import { MemorizationToggle } from "@/components/memorization-toggle";
import { Confetti } from "@/components/confetti";
import { useSession } from "@/hooks/use-session";
import { useUserStats } from "@/hooks/use-user-stats";
import { ttsEngine, calculateProsody, detectEmotion, type SpeakResult } from "@/lib/tts-engine";
import type { VoicePreset, MemorizationMode } from "@shared/schema";
import { Sparkles, Check, Trophy, Star } from "lucide-react";
import { SpotMascot } from "@/components/spot-mascot";
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
    isLoading,
    error,
  } = useSession();

  const { stats, recordRehearsal } = useUserStats();
  const [fontSize, setFontSize] = useState(1);
  const [showDirections, setShowDirections] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const isPlayingRef = useRef(false);
  const ambientRef = useRef<AudioContext | null>(null);
  const ambientGainRef = useRef<GainNode | null>(null);

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

  const speakLine = useCallback(() => {
    const line = getCurrentLine();
    if (!line || !session) return;

    const isUser = isUserLine(line);
    if (isUser) {
      return;
    }

    const role = getRoleById(line.roleId);
    const emotion = line.emotionHint || detectEmotion(line.text, line.direction);
    const prosody = calculateProsody(emotion, role?.voicePreset || "natural");

    ttsEngine.speak(line.text, prosody, (result: SpeakResult) => {
      if (result === "success" && isPlayingRef.current) {
        incrementLinesRehearsed();
        const next = getNextLine();
        if (next) {
          nextLine();
        } else {
          setPlaying(false);
          incrementRunsCompleted();
          setShowCelebration(true);
          setTimeout(() => setShowCelebration(false), 3000);
        }
      }
    });
  }, [getCurrentLine, getNextLine, getRoleById, isUserLine, nextLine, setPlaying, session, incrementLinesRehearsed, incrementRunsCompleted]);

  useEffect(() => {
    if (session?.isPlaying && currentLine) {
      if (currentIsUserLine) {
        ttsEngine.stop();
      } else {
        speakLine();
      }
    } else {
      ttsEngine.stop();
    }
  }, [session?.isPlaying, session?.currentLineIndex, currentLine, currentIsUserLine, speakLine]);

  const handlePlayPause = () => {
    if (session?.isPlaying) {
      ttsEngine.stop();
      setPlaying(false);
    } else {
      setPlaying(true);
    }
  };

  const handleNext = () => {
    ttsEngine.stop();
    if (currentIsUserLine) {
      incrementLinesRehearsed();
      recordRehearsal(1, 0);
    }
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
    prevLine();
  };

  const handleRepeat = () => {
    ttsEngine.stop();
    if (session?.isPlaying && !currentIsUserLine) {
      speakLine();
    }
  };

  const handleJumpToLine = (lineIndex: number, sceneIndex?: number) => {
    ttsEngine.stop();
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
    setPlaying(false);
    createSession(name, rawScript);
  };

  const handleClearSession = () => {
    ttsEngine.stop();
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
        onBack={onBack}
        onFontSizeChange={setFontSize}
        onToggleDirections={() => setShowDirections(!showDirections)}
        onJumpToLine={handleJumpToLine}
      />

      <Confetti isActive={showCelebration} duration={4000} />
      
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none bg-background/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border shadow-2xl rounded-3xl p-8 text-center animate-scale-in pointer-events-auto max-w-sm mx-4">
            <div className="flex justify-center mb-4">
              <SpotMascot mood="celebrating" size="xl" />
            </div>
            <h3 className="text-2xl font-bold mb-1 flex items-center justify-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              Nailed it
              <Star className="h-5 w-5 text-amber-500" />
            </h3>
            <p className="text-lg font-semibold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent mb-3">
              Scene Complete
            </p>
            <p className="text-muted-foreground text-sm mb-4">
              Run #{session.runsCompleted + 1} is in the books
            </p>
            <div className="flex items-center justify-center gap-3 text-sm">
              <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-full px-3 py-1.5">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span className="font-bold text-amber-700 dark:text-amber-400">{session.linesRehearsed} lines</span>
              </div>
              <div className="flex items-center gap-1.5 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-full px-3 py-1.5">
                <Sparkles className="h-4 w-4 text-violet-500" />
                <span className="font-bold text-violet-700 dark:text-violet-400">{session.runsCompleted + 1} runs</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-5">
              You're getting better every time. Keep it up.
            </p>
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
          />
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
