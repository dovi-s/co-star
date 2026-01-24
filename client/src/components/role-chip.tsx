import { Badge } from "@/components/ui/badge";
import { User, Volume2, Sparkles, Check } from "lucide-react";
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
  natural: "Conversational and relaxed",
  deadpan: "Flat and understated",
  theatrical: "Dramatic and expressive",
};

export function RoleChip({ role, isUserRole, showPresetPicker, onPresetChange }: RoleChipProps) {
  const chipContent = (
    <Badge
      variant={isUserRole ? "default" : "secondary"}
      className={cn(
        "gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg",
        showPresetPicker && !isUserRole && "cursor-pointer"
      )}
      data-testid={`chip-role-${role.id}`}
    >
      {isUserRole ? (
        <User className="h-3.5 w-3.5" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
      {role.name}
      {!isUserRole && showPresetPicker && (
        <span className="text-[10px] opacity-70 uppercase tracking-wide ml-0.5">
          {presetLabels[role.voicePreset]}
        </span>
      )}
    </Badge>
  );

  if (!showPresetPicker || isUserRole) {
    return chipContent;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {chipContent}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52 rounded-xl p-2">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-semibold uppercase tracking-wider px-2">
          Voice Style for {role.name}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-2" />
        {(["natural", "deadpan", "theatrical"] as VoicePreset[]).map((preset) => {
          const isSelected = preset === role.voicePreset;
          return (
            <DropdownMenuItem
              key={preset}
              onClick={() => onPresetChange?.(preset)}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg cursor-pointer",
                isSelected && "bg-primary/10"
              )}
              data-testid={`menu-preset-${preset}`}
            >
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center mt-0.5 shrink-0",
                isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                {isSelected && <Check className="h-3 w-3" />}
              </div>
              <div className="flex-1">
                <div className={cn(
                  "font-medium",
                  isSelected && "text-primary"
                )}>
                  {presetLabels[preset]}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {presetDescriptions[preset]}
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
