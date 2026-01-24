import { useState } from "react";
import { FileText, Volume2, VolumeX, Layers, ChevronUp, Trash2, Settings2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { SpotMascot } from "@/components/spot-mascot";
import type { Role, Scene, VoicePreset } from "@shared/schema";
import { cn } from "@/lib/utils";

interface SettingsDrawerProps {
  roles: Role[];
  scenes: Scene[];
  currentSceneIndex: number;
  userRoleId: string | null;
  ambientEnabled: boolean;
  onAmbientToggle: (enabled: boolean) => void;
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
  onAmbientToggle,
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
        <button
          className="w-full py-3 flex items-center justify-center gap-2 text-xs text-muted-foreground/60 transition-all hover:text-muted-foreground hover:gap-3"
          data-testid="button-settings-drawer"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="font-medium">Settings</span>
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl p-0">
        <div className="flex flex-col h-full">
          <div className="flex justify-center py-2.5">
            <div className="w-8 h-0.5 rounded-full bg-border" />
          </div>
          
          <SheetHeader className="px-5 pb-4">
            <div className="flex items-center gap-3">
              <SpotMascot size="xs" mood="happy" />
              <SheetTitle className="text-left text-lg font-bold">Settings</SheetTitle>
            </div>
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
                      Room tone for immersion
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

              {/* Scenes */}
              {scenes.length > 1 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <Layers className="h-3.5 w-3.5" />
                    Scenes
                  </div>
                  <div className="grid gap-1.5">
                    {scenes.map((scene, index) => (
                      <button
                        key={scene.id}
                        onClick={() => {
                          onSceneChange(index);
                          setIsOpen(false);
                        }}
                        className={cn(
                          "text-left p-3 rounded-lg transition-colors",
                          index === currentSceneIndex
                            ? "bg-foreground text-background"
                            : "hover:bg-muted/50"
                        )}
                        data-testid={`button-scene-${index}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">{scene.name}</div>
                            <div className={cn(
                              "text-[10px]",
                              index === currentSceneIndex ? "text-background/70" : "text-muted-foreground/60"
                            )}>
                              {scene.lines.length} lines
                            </div>
                          </div>
                        </div>
                      </button>
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
                <button
                  className="w-full h-11 rounded-lg text-sm font-medium flex items-center justify-center gap-2 border border-border/50 hover:bg-muted/50 transition-colors"
                  onClick={() => setShowImport(!showImport)}
                  data-testid="button-new-script"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {showImport ? "Hide" : "New Script"}
                </button>

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
                      variant="ghost"
                      className="w-full h-11 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg gap-2"
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
                        className="bg-destructive hover:bg-destructive/90 rounded-lg"
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
