import { useState } from "react";
import { FileText, Music, Volume2, VolumeX, Layers, ChevronUp, Trash2, Sparkles, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
          className="w-full py-3 flex items-center justify-center gap-2 text-sm text-muted-foreground transition-all duration-200 hover:text-foreground hover:bg-muted/50"
          data-testid="button-settings-drawer"
        >
          <Settings2 className="h-4 w-4" />
          <span className="font-medium">Settings</span>
          <ChevronUp className="h-4 w-4" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0 animate-slide-up">
        <div className="flex flex-col h-full">
          <div className="flex justify-center py-3">
            <div className="w-10 h-1 rounded-full bg-border" />
          </div>
          
          <SheetHeader className="px-5 pb-4">
            <SheetTitle className="text-left text-xl font-bold">Settings</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-auto custom-scrollbar px-5 pb-10">
            <div className="space-y-6">
              <div 
                className={cn(
                  "flex items-center justify-between p-4 rounded-2xl border transition-all duration-200",
                  ambientEnabled ? "bg-amber-500/5 border-amber-500/20" : "bg-card/60 border-border/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200",
                    ambientEnabled ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md" : "bg-muted/60 text-muted-foreground"
                  )}>
                    {ambientEnabled ? (
                      <Volume2 className="h-4.5 w-4.5" />
                    ) : (
                      <VolumeX className="h-4.5 w-4.5" />
                    )}
                  </div>
                  <div>
                    <Label htmlFor="ambient" className="font-medium text-sm cursor-pointer">
                      Ambient Sound
                    </Label>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      Subtle room tone for immersion
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

              {scenes.length > 1 && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    <Layers className="h-4 w-4" />
                    Scenes
                  </Label>
                  <div className="grid gap-2">
                    {scenes.map((scene, index) => (
                      <button
                        key={scene.id}
                        onClick={() => {
                          onSceneChange(index);
                          setIsOpen(false);
                        }}
                        className={cn(
                          "text-left p-4 rounded-xl border transition-all duration-200",
                          index === currentSceneIndex
                            ? "border-amber-500/30 bg-amber-500/5 shadow-sm"
                            : "border-border/50 bg-card/60 hover:border-amber-500/30"
                        )}
                        data-testid={`button-scene-${index}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">{scene.name}</div>
                            <div className="text-[11px] text-muted-foreground/70 mt-0.5">
                              {scene.lines.length} line{scene.lines.length !== 1 ? "s" : ""}
                            </div>
                          </div>
                          {index === currentSceneIndex && (
                            <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full bg-amber-500/15">
                              Current
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="h-4 w-4" />
                  Cast Voices
                </Label>
                <p className="text-xs text-muted-foreground -mt-1">
                  Tap a character to change their voice style
                </p>
                <div className="flex flex-wrap gap-2">
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

              <Separator className="my-6" />

              <div className="space-y-3">
                <button
                  className="w-full h-12 gap-2 rounded-xl font-medium text-sm flex items-center justify-center border border-border/50 bg-card/60 hover:border-amber-500/30 hover:bg-card transition-all duration-200"
                  onClick={() => setShowImport(!showImport)}
                  data-testid="button-new-script"
                >
                  <FileText className="h-4.5 w-4.5 text-muted-foreground" />
                  {showImport ? "Hide Import" : "Import New Script"}
                </button>

                {showImport && (
                  <Card className="animate-scale-in rounded-2xl overflow-hidden">
                    <CardContent className="pt-5">
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
              </div>

              <div className="pt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full h-12 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl gap-2"
                      data-testid="button-clear-session"
                    >
                      <Trash2 className="h-5 w-5" />
                      Clear Session
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear Session?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove your current script and all progress. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl" data-testid="button-cancel-clear">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          onClearSession();
                          setIsOpen(false);
                        }}
                        className="bg-destructive hover:bg-destructive/90 rounded-xl"
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
