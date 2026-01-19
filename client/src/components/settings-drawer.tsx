import { useState } from "react";
import { FileText, Music, Volume2, VolumeX, Layers, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
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
          className="w-full py-3 flex items-center justify-center gap-2 text-sm text-muted-foreground hover-elevate transition-colors"
          data-testid="button-settings-drawer"
        >
          <ChevronUp className="h-4 w-4" />
          Settings
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="p-4 pb-2">
            <SheetTitle className="text-left flex items-center gap-2">
              Settings
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-auto custom-scrollbar px-4 pb-8">
            <div className="space-y-6">
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  {ambientEnabled ? (
                    <Volume2 className="h-5 w-5 text-primary" />
                  ) : (
                    <VolumeX className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <Label htmlFor="ambient" className="font-medium">
                      Ambient Sound
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Subtle room tone during rehearsal
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

              <Separator />

              {scenes.length > 1 && (
                <>
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Layers className="h-4 w-4" />
                      Scenes ({scenes.length})
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
                            "text-left p-3 rounded-lg border transition-all hover-elevate",
                            index === currentSceneIndex
                              ? "border-primary bg-primary/5"
                              : "border-border bg-card"
                          )}
                          data-testid={`button-scene-${index}`}
                        >
                          <div className="font-medium text-sm">{scene.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {scene.lines.length} lines
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              <div className="space-y-3">
                <Label className="text-sm font-medium">Cast</Label>
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

              <Separator />

              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setShowImport(!showImport)}
                  data-testid="button-new-script"
                >
                  <FileText className="h-4 w-4" />
                  {showImport ? "Hide Import" : "Import New Script"}
                </Button>

                {showImport && (
                  <Card>
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
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                    data-testid="button-clear-session"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Session
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear Session?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove your current script and all progress. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-clear">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        onClearSession();
                        setIsOpen(false);
                      }}
                      className="bg-destructive hover:bg-destructive/90"
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
      </SheetContent>
    </Sheet>
  );
}
