import { useState, useCallback, useEffect, useRef } from "react";
import { Header } from "@/components/header";
import { ThreeLineReader } from "@/components/three-line-reader";
import { TransportBar } from "@/components/transport-bar";
import { SettingsDrawer } from "@/components/settings-drawer";
import { useSession } from "@/hooks/use-session";
import { ttsEngine, calculateProsody, detectEmotion } from "@/lib/tts-engine";
import type { VoicePreset } from "@shared/schema";

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
    toggleBookmark,
    updateRolePreset,
    createSession,
    clearSession,
    isLoading,
    error,
  } = useSession();

  const [fontSize, setFontSize] = useState(1);
  const [showDirections, setShowDirections] = useState(true);
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
    if (session?.ambientEnabled && !ambientRef.current) {
      try {
        const ctx = new AudioContext();
        const gain = ctx.createGain();
        gain.gain.value = 0.02;
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
        filter.frequency.value = 200;

        noise.connect(filter);
        filter.connect(gain);
        noise.start();

        ambientRef.current = ctx;
        ambientGainRef.current = gain;
      } catch {
      }
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

    ttsEngine.speak(line.text, prosody, () => {
      if (isPlayingRef.current) {
        const next = getNextLine();
        if (next) {
          nextLine();
        } else {
          setPlaying(false);
        }
      }
    });
  }, [getCurrentLine, getNextLine, getRoleById, isUserLine, nextLine, setPlaying, session]);

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
    nextLine();
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
    <div className="min-h-screen flex flex-col bg-background" data-testid="rehearsal-page">
      <Header
        sessionName={session.name}
        userRole={userRole ?? null}
        showReaderMenu
        fontSize={fontSize}
        showDirections={showDirections}
        scenes={session.scenes}
        currentSceneIndex={session.currentSceneIndex}
        onFontSizeChange={setFontSize}
        onToggleDirections={() => setShowDirections(!showDirections)}
        onJumpToLine={handleJumpToLine}
      />

      <main className="flex-1 flex flex-col justify-center px-4 py-6">
        <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full">
          <ThreeLineReader
            previousLine={previousLine}
            currentLine={currentLine}
            nextLine={nextLineData}
            isUserLine={currentIsUserLine}
            isPlaying={session.isPlaying}
            showDirections={showDirections}
            fontSize={fontSize}
            onToggleBookmark={toggleBookmark}
            getRoleById={getRoleById}
          />
        </div>
      </main>

      <footer className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t">
        <div className="px-4 py-4 max-w-md mx-auto">
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
