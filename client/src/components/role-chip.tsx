import { useState } from "react";
import { User, Volume2, Check, Play, Loader2 } from "lucide-react";
import type { Role, VoicePreset } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ttsEngine } from "@/lib/tts-engine";

interface RoleChipProps {
  role: Role;
  isUserRole?: boolean;
  showPresetPicker?: boolean;
  onPresetChange?: (preset: VoicePreset) => void;
}

const presetLabels: Record<VoicePreset, string> = {
  natural: "Natural",
  deadpan: "Deadpan",
  theatrical: "Theatrical",
};

const presetDescriptions: Record<VoicePreset, string> = {
  natural: "Conversational",
  deadpan: "Understated",
  theatrical: "Dramatic",
};

const presetSamples: Record<VoicePreset, string> = {
  natural: "To be, or not to be, that is the question.",
  deadpan: "I suppose that's one way to look at it.",
  theatrical: "Once more unto the breach, dear friends!",
};

export function RoleChip({ role, isUserRole, showPresetPicker, onPresetChange }: RoleChipProps) {
  const [previewingPreset, setPreviewingPreset] = useState<VoicePreset | null>(null);
  const chipContent = (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition-colors",
        isUserRole 
          ? "bg-foreground text-background"
          : "bg-muted/60 text-muted-foreground",
        showPresetPicker && !isUserRole && "cursor-pointer hover:bg-muted"
      )}
      data-testid={`chip-role-${role.id}`}
    >
      {isUserRole ? (
        <User className="h-3 w-3" />
      ) : (
        <Volume2 className="h-3 w-3" />
      )}
      {role.name}
      {!isUserRole && showPresetPicker && (
        <span className="text-[9px] opacity-60">
          {presetLabels[role.voicePreset]}
        </span>
      )}
    </div>
  );

  if (!showPresetPicker || isUserRole) {
    return chipContent;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {chipContent}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48 rounded-lg p-1.5">
        <DropdownMenuLabel className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide px-2 py-1">
          Voice for {role.name}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1" />
        {(["natural", "deadpan", "theatrical"] as VoicePreset[]).map((preset) => {
          const isSelected = preset === role.voicePreset;
          return (
            <DropdownMenuItem
              key={preset}
              onClick={() => onPresetChange?.(preset)}
              className={cn(
                "flex items-center gap-2.5 p-2 rounded-md cursor-pointer",
                isSelected && "bg-muted"
              )}
              data-testid={`menu-preset-${preset}`}
            >
              <div className={cn(
                "w-4 h-4 rounded-full flex items-center justify-center",
                isSelected ? "bg-foreground text-background" : "bg-muted/80"
              )}>
                {isSelected && <Check className="h-2.5 w-2.5" />}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {presetLabels[preset]}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {presetDescriptions[preset]}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (previewingPreset === preset) {
                    ttsEngine.stop();
                    setPreviewingPreset(null);
                    return;
                  }
                  setPreviewingPreset(preset);
                  ttsEngine.stop();
                  const ok = ttsEngine.speak(
                    presetSamples[preset],
                    { rate: 1, pitch: 0, volume: 1, breakMs: 0 },
                    () => setPreviewingPreset(null),
                    { preset, emotion: "neutral" }
                  );
                  if (!ok) setPreviewingPreset(null);
                }}
                className="p-1 rounded-full hover:bg-muted/80 transition-colors shrink-0"
                data-testid={`button-preview-${preset}`}
              >
                {previewingPreset === preset ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : (
                  <Play className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
