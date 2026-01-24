import type { MemorizationMode } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Lightbulb, Brain } from "lucide-react";

interface MemorizationToggleProps {
  mode: MemorizationMode;
  onChange: (mode: MemorizationMode) => void;
}

const modes: { value: MemorizationMode; label: string; icon: React.ReactNode; description: string }[] = [
  { value: "off", label: "Full", icon: <Eye className="h-3.5 w-3.5" />, description: "See all lines" },
  { value: "partial", label: "Partial", icon: <Lightbulb className="h-3.5 w-3.5" />, description: "Half hidden" },
  { value: "cue", label: "Cue", icon: <EyeOff className="h-3.5 w-3.5" />, description: "First words only" },
  { value: "full", label: "Memory", icon: <Brain className="h-3.5 w-3.5" />, description: "No help" },
];

export function MemorizationToggle({ mode, onChange }: MemorizationToggleProps) {
  return (
    <div className="flex items-center justify-center gap-1 py-1" data-testid="memorization-toggle">
      <span className="text-xs text-muted-foreground mr-2 hidden sm:inline">Practice:</span>
      <div className="flex items-center bg-muted/50 rounded-lg p-1">
        {modes.map((m) => (
          <Button
            key={m.value}
            variant={mode === m.value ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onChange(m.value)}
            className={cn(
              "gap-1.5 text-xs",
              mode === m.value && "shadow-sm"
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
  );
}
