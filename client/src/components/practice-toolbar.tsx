import { useState } from "react";
import type { MemorizationMode } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Lightbulb, Brain, Mic, MicOff, Video, VideoOff, Circle, Settings2 } from "lucide-react";

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

const modeIcons: Record<MemorizationMode, React.ReactNode> = {
  off: <Eye className="h-3.5 w-3.5" />,
  partial: <Lightbulb className="h-3.5 w-3.5" />,
  cue: <EyeOff className="h-3.5 w-3.5" />,
  full: <Brain className="h-3.5 w-3.5" />,
};

const modeLabels: Record<MemorizationMode, string> = {
  off: "Full",
  partial: "Partial",
  cue: "Cue",
  full: "Memory",
};

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
  const [expanded, setExpanded] = useState(false);

  if (isRecording) {
    return (
      <div className="flex items-center justify-center gap-3 py-1" data-testid="practice-toolbar">
        <Button
          variant="destructive"
          size="sm"
          onClick={onRecordToggle}
          className="gap-1.5 text-[11px] px-3 min-h-[44px] animate-pulse"
          title="Stop recording"
          data-testid="button-record-toggle"
        >
          <Circle className="h-3 w-3 fill-current" />
          <span className="font-mono text-[11px]">{formatTime(recordingTime)}</span>
        </Button>
      </div>
    );
  }

  if (!expanded) {
    return (
      <div className="flex items-center justify-center gap-2 py-1" data-testid="practice-toolbar">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(true)}
          className={cn(
            "gap-1.5 text-[11px] px-2.5 min-h-[44px]",
            cameraEnabled ? "text-white/50" : "text-muted-foreground/60"
          )}
          title="Practice tools"
          data-testid="button-expand-toolbar"
        >
          <Settings2 className="h-3.5 w-3.5" />
          <span className="text-[11px]">{modeLabels[memorizationMode]}</span>
          {!micEnabled && <MicOff className="h-3 w-3 opacity-60" />}
          {cameraEnabled && <Video className="h-3 w-3 opacity-60" />}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 py-1 animate-in fade-in slide-in-from-bottom-1 duration-200" data-testid="practice-toolbar">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={cn(
            "flex items-center rounded-lg p-0.5 gap-0.5",
            cameraEnabled ? "bg-white/10" : "bg-muted/50"
          )}>
            {modes.map((m) => (
              <Button
                key={m.value}
                variant={memorizationMode === m.value ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onMemorizationChange(m.value)}
                className={cn(
                  "gap-1 text-[11px] px-2 min-h-[44px] min-w-[44px]",
                  memorizationMode === m.value && "shadow-sm",
                  cameraEnabled && memorizationMode !== m.value && "text-white/60",
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

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant={micEnabled ? "secondary" : "ghost"}
            size="sm"
            onClick={onMicToggle}
            className={cn(
              "gap-1 text-[11px] px-2 min-h-[44px] min-w-[44px]",
              cameraEnabled && micEnabled && "shadow-sm bg-white/20 text-white",
              cameraEnabled && !micEnabled && "text-white/60"
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
              "gap-1 text-[11px] px-2 min-h-[44px] min-w-[44px]",
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
            variant="ghost"
            size="sm"
            onClick={onRecordToggle}
            className={cn(
              "gap-1 text-[11px] px-2 min-h-[44px] min-w-[44px]",
              cameraEnabled && "text-white/60"
            )}
            title={cameraEnabled ? "Record video with audio" : "Record audio only"}
            data-testid="button-record-toggle"
          >
            <Circle className="h-3 w-3" />
            <span className="hidden sm:inline">Record</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setExpanded(false)}
            className={cn(
              "min-h-[44px] min-w-[44px]",
              cameraEnabled ? "text-white/40" : "text-muted-foreground/50"
            )}
            title="Collapse toolbar"
            data-testid="button-collapse-toolbar"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
