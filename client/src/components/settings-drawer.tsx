import { useState } from "react";
import { FileText, Volume2, VolumeX, Layers, ChevronUp, Trash2, Settings, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RoleChip } from "@/components/role-chip";
import { ScriptImport } from "@/components/script-import";
import type { Role, Scene, VoicePreset } from "@shared/schema";
import { cn } from "@/lib/utils";

interface SettingsDrawerProps {
  roles: Role[];
  scenes: Scene[];
  currentSceneIndex: number;
  userRoleId: string | null;
  ambientEnabled: boolean;
  playbackSpeed: number;
  onAmbientToggle: (enabled: boolean) => void;
  onPlaybackSpeedChange: (speed: number) => void;
  onSceneChange: (index: number) => void;
  onRolePresetChange: (roleId: string, preset: VoicePreset) => void;
  onNewScript: (name: string, rawScript: string) => void;
  onClearSession: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export function SettingsDrawer({
  roles,
  scenes,
  currentSceneIndex,
  userRoleId,
  ambientEnabled,
  playbackSpeed,
  onAmbientToggle,
  onPlaybackSpeedChange,
  onSceneChange,
  onRolePresetChange,
  onNewScript,
  onClearSession,
  isLoading,
  error,
}: SettingsDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showImport, setShowImport] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full gap-2"
          data-testid="button-settings-drawer"
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Settings</span>
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl p-0">
        <div className="flex flex-col h-full">
          <div className="flex justify-center py-2.5">
            <div className="w-8 h-0.5 rounded-full bg-border" />
          </div>
          
          <SheetHeader className="px-5 pb-4">
            <SheetTitle className="text-left text-base font-semibold">Settings</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-auto px-5 pb-10">
            <div className="space-y-6">
              {/* Ambient Sound Toggle */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center",
                    ambientEnabled ? "bg-foreground text-background" : "bg-muted/60 text-muted-foreground"
                  )}>
                    {ambientEnabled ? (
                      <Volume2 className="h-4 w-4" />
                    ) : (
                      <VolumeX className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <label htmlFor="ambient" className="text-sm font-medium cursor-pointer">
                      Ambient Sound
                    </label>
                    <p className="text-[11px] text-muted-foreground/60">
                      Subtle background hum for focus
                    </p>
                  </div>
                </div>
                <Switch
                  id="ambient"
                  checked={ambientEnabled}
                  onCheckedChange={onAmbientToggle}
                  data-testid="switch-ambient"
                />
              </div>

              {/* Playback Speed */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-muted/60 text-muted-foreground">
                    <Gauge className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium">
                      Pace
                    </label>
                    <p className="text-[11px] text-muted-foreground/60">
                      {playbackSpeed < 0.9 ? "Slower" : playbackSpeed > 1.1 ? "Faster" : "Normal"} ({playbackSpeed.toFixed(1)}x)
                    </p>
                  </div>
                </div>
                <Slider
                  value={[playbackSpeed]}
                  onValueChange={([value]) => onPlaybackSpeedChange(value)}
                  min={0.5}
                  max={1.5}
                  step={0.1}
                  className="w-full"
                  data-testid="slider-playback-speed"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground/50">
                  <span>0.5x</span>
                  <span>1.0x</span>
                  <span>1.5x</span>
                </div>
              </div>

              {/* Scenes */}
              {scenes.length > 1 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <Layers className="h-3.5 w-3.5" />
                    Scenes
                  </div>
                  <div className="grid gap-1.5">
                    {scenes.map((scene, index) => (
                      <Button
                        key={scene.id}
                        onClick={() => {
                          onSceneChange(index);
                          setIsOpen(false);
                        }}
                        variant={index === currentSceneIndex ? "default" : "ghost"}
                        className="w-full h-auto py-2.5 px-3 justify-start text-left"
                        data-testid={`button-scene-${index}`}
                      >
                        <div className="flex flex-col items-start gap-0.5 min-w-0">
                          <div className="text-sm font-medium truncate max-w-full">{scene.name}</div>
                          <div className="text-[10px] opacity-70">
                            {scene.lines.length} lines
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Voice Presets */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Voice Presets
                </div>
                <p className="text-[11px] text-muted-foreground/60">
                  Tap to change voice style
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {roles.map((role) => (
                    <RoleChip
                      key={role.id}
                      role={role}
                      isUserRole={role.id === userRoleId}
                      showPresetPicker={role.id !== userRoleId}
                      onPresetChange={(preset) => onRolePresetChange(role.id, preset)}
                    />
                  ))}
                </div>
              </div>

              <div className="border-t border-border/40 pt-6 space-y-2">
                {/* Import New Script */}
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full gap-2"
                  onClick={() => setShowImport(!showImport)}
                  data-testid="button-new-script"
                >
                  <FileText className="h-4 w-4" />
                  {showImport ? "Hide" : "New Script"}
                </Button>

                {showImport && (
                  <Card className="rounded-lg overflow-hidden">
                    <CardContent className="pt-4">
                      <ScriptImport
                        onImport={(name, script) => {
                          onNewScript(name, script);
                          setShowImport(false);
                          setIsOpen(false);
                        }}
                        isLoading={isLoading}
                        error={error}
                      />
                    </CardContent>
                  </Card>
                )}

                {/* Clear Session */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="lg"
                      className="w-full gap-2"
                      data-testid="button-clear-session"
                    >
                      <Trash2 className="h-4 w-4" />
                      Clear Session
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-lg">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear Session?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove your current script and all progress.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-lg" data-testid="button-cancel-clear">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          onClearSession();
                          setIsOpen(false);
                        }}
                        data-testid="button-confirm-clear"
                      >
                        Clear
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
