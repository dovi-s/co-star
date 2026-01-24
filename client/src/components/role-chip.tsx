import { User, Volume2, Check } from "lucide-react";
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
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors",
        isUserRole 
          ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm"
          : "bg-muted/60 text-muted-foreground border border-border/40",
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
        <span className="text-[9px] opacity-60 uppercase tracking-wide ml-0.5">
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
                isSelected && "bg-amber-500/10"
              )}
              data-testid={`menu-preset-${preset}`}
            >
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center mt-0.5 shrink-0",
                isSelected ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white" : "bg-muted/60"
              )}>
                {isSelected && <Check className="h-3 w-3" />}
              </div>
              <div className="flex-1">
                <div className={cn(
                  "font-medium text-sm",
                  isSelected && "text-amber-700 dark:text-amber-300"
                )}>
                  {presetLabels[preset]}
                </div>
                <div className="text-[11px] text-muted-foreground/70 mt-0.5">
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
