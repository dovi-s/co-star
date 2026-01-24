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
  natural: "Conversational",
  deadpan: "Understated",
  theatrical: "Dramatic",
};

export function RoleChip({ role, isUserRole, showPresetPicker, onPresetChange }: RoleChipProps) {
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
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
