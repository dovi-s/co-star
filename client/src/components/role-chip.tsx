import { Badge } from "@/components/ui/badge";
import { User, Bot, Sparkles } from "lucide-react";
import type { Role, VoicePreset } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

export function RoleChip({ role, isUserRole, showPresetPicker, onPresetChange }: RoleChipProps) {
  const chipContent = (
    <Badge
      variant={isUserRole ? "default" : "secondary"}
      className="gap-1.5 px-3 py-1.5 text-sm font-medium cursor-pointer"
      data-testid={`chip-role-${role.id}`}
    >
      {isUserRole ? (
        <User className="h-3.5 w-3.5" />
      ) : (
        <Bot className="h-3.5 w-3.5" />
      )}
      {role.name}
      {!isUserRole && (
        <span className="text-xs opacity-70 ml-1">
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
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Voice Preset
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(["natural", "deadpan", "theatrical"] as VoicePreset[]).map((preset) => (
          <DropdownMenuItem
            key={preset}
            onClick={() => onPresetChange?.(preset)}
            className="gap-2"
            data-testid={`menu-preset-${preset}`}
          >
            {preset === role.voicePreset && (
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            )}
            <span className={preset === role.voicePreset ? "font-medium" : ""}>
              {presetLabels[preset]}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
