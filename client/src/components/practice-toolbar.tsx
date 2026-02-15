import type { MemorizationMode } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Lightbulb, Brain, Mic, MicOff, Video, VideoOff, Circle } from "lucide-react";

interface PracticeToolbarProps {
  memorizationMode: MemorizationMode;
  onMemorizationChange: (mode: MemorizationMode) => void;
  micEnabled: boolean;
  onMicToggle: () => void;
  cameraEnabled: boolean;
  onCameraToggle: () => void;
  isRecording: boolean;
  onRecordToggle: () => void;
  recordingTime?: number;
}

const modes: { value: MemorizationMode; label: string; icon: React.ReactNode; description: string }[] = [
  { value: "off", label: "Full", icon: <Eye className="h-3.5 w-3.5" />, description: "See all lines" },
  { value: "partial", label: "Partial", icon: <Lightbulb className="h-3.5 w-3.5" />, description: "Half hidden" },
  { value: "cue", label: "Cue", icon: <EyeOff className="h-3.5 w-3.5" />, description: "First words only" },
  { value: "full", label: "Memory", icon: <Brain className="h-3.5 w-3.5" />, description: "No help" },
];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function PracticeToolbar({ 
  memorizationMode, 
  onMemorizationChange,
  micEnabled,
  onMicToggle,
  cameraEnabled,
  onCameraToggle,
  isRecording,
  onRecordToggle,
  recordingTime = 0,
}: PracticeToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-2 py-1" data-testid="practice-toolbar">
      <div className="flex items-center gap-1">
        <span className={cn(
          "text-xs mr-1 hidden sm:inline",
          cameraEnabled ? "text-white/60" : "text-muted-foreground"
        )}>Practice:</span>
        <div className={cn(
          "flex items-center rounded-lg p-1",
          cameraEnabled ? "bg-white/10" : "bg-muted/50"
        )}>
          {modes.map((m) => (
            <Button
              key={m.value}
              variant={memorizationMode === m.value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onMemorizationChange(m.value)}
              className={cn(
                "gap-1.5 text-xs h-7 px-2",
                memorizationMode === m.value && "shadow-sm",
                cameraEnabled && memorizationMode !== m.value && "text-white/70 hover:text-white hover:bg-white/10",
                cameraEnabled && memorizationMode === m.value && "bg-white/20 text-white"
              )}
              title={m.description}
              data-testid={`button-mode-${m.value}`}
            >
              {m.icon}
              <span className="hidden sm:inline">{m.label}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={micEnabled ? "secondary" : "ghost"}
          size="sm"
          onClick={onMicToggle}
          className={cn(
            "gap-1.5 text-xs h-7 px-2",
            cameraEnabled && micEnabled && "shadow-sm bg-white/20 text-white",
            cameraEnabled && !micEnabled && "text-white/70"
          )}
          title={micEnabled ? "Turn microphone off" : "Turn microphone on"}
          data-testid="button-mic-toggle"
        >
          {micEnabled ? (
            <Mic className="h-3.5 w-3.5" />
          ) : (
            <MicOff className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">Mic</span>
        </Button>

        <Button
          variant={cameraEnabled ? "secondary" : "ghost"}
          size="sm"
          onClick={onCameraToggle}
          className={cn(
            "gap-1.5 text-xs h-7 px-2",
            cameraEnabled && "shadow-sm bg-white/20 text-white"
          )}
          title={cameraEnabled ? "Turn camera off" : "Turn camera on"}
          data-testid="button-camera-toggle"
        >
          {cameraEnabled ? (
            <Video className="h-3.5 w-3.5" />
          ) : (
            <VideoOff className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">Camera</span>
        </Button>

        <Button
          variant={isRecording ? "destructive" : "ghost"}
          size="sm"
          onClick={onRecordToggle}
          className={cn(
            "gap-1.5 text-xs h-7 px-2 min-w-[70px]",
            isRecording && "animate-pulse",
            cameraEnabled && "text-white/70 hover:text-white hover:bg-white/10"
          )}
          title={isRecording ? "Stop recording" : cameraEnabled ? "Record video and audio" : "Record audio only"}
          data-testid="button-record-toggle"
        >
          <Circle 
            className={cn(
              "h-3 w-3",
              isRecording ? "fill-current" : ""
            )} 
          />
          {isRecording ? (
            <span className="font-mono text-xs">{formatTime(recordingTime)}</span>
          ) : (
            <span className="hidden sm:inline">Record</span>
          )}
        </Button>
      </div>
    </div>
  );
}
