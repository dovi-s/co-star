import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { FileText, Volume2, VolumeX, Layers, ChevronUp, ChevronDown, Trash2, Settings, Gauge, Timer, Hand, Headphones, Car, Music, RotateCcw, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  readerDelay: number;
  tapMode: boolean;
  readerVolume: number;
  onAmbientToggle: (enabled: boolean) => void;
  onPlaybackSpeedChange: (speed: number) => void;
  onReaderDelayChange: (delay: number) => void;
  onTapModeChange: (enabled: boolean) => void;
  onReaderVolumeChange: (volume: number) => void;
  earbudsOnly?: boolean;
  onEarbudsOnlyChange?: (enabled: boolean) => void;
  cameraEnabled?: boolean;
  onSceneChange: (index: number) => void;
  onRolePresetChange: (roleId: string, preset: VoicePreset) => void;
  onNewScript: (name: string, rawScript: string) => void;
  onClearSession: () => void;
  isLoading?: boolean;
  error?: string | null;
  onHandsFreeMode?: () => void;
}

const DEFAULTS = {
  playbackSpeed: 1.0,
  readerDelay: 0,
  tapMode: false,
  readerVolume: 0.8,
  ambientEnabled: false,
  earbudsOnly: false,
};

function SectionHeader({ icon: Icon, label }: { icon: typeof Gauge; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-1" data-testid={`section-header-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}

export function SettingsDrawer({
  roles,
  scenes,
  currentSceneIndex,
  userRoleId,
  ambientEnabled,
  playbackSpeed,
  readerDelay,
  tapMode,
  readerVolume,
  onAmbientToggle,
  onPlaybackSpeedChange,
  onReaderDelayChange,
  onTapModeChange,
  onReaderVolumeChange,
  earbudsOnly = false,
  onEarbudsOnlyChange,
  cameraEnabled = false,
  onSceneChange,
  onRolePresetChange,
  onNewScript,
  onClearSession,
  isLoading,
  error,
  onHandsFreeMode,
}: SettingsDrawerProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleResetDefaults = () => {
    onPlaybackSpeedChange(DEFAULTS.playbackSpeed);
    onReaderDelayChange(DEFAULTS.readerDelay);
    onTapModeChange(DEFAULTS.tapMode);
    onReaderVolumeChange(DEFAULTS.readerVolume);
    onAmbientToggle(DEFAULTS.ambientEnabled);
    if (onEarbudsOnlyChange) {
      onEarbudsOnlyChange(DEFAULTS.earbudsOnly);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full gap-2",
            cameraEnabled && "text-white/90 hover:text-white hover:bg-white/10"
          )}
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

              <div className="space-y-4" data-testid="section-essentials">
                <SectionHeader icon={Gauge} label="Essentials" />

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-muted/60 text-muted-foreground">
                      <Gauge className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium">
                        Pace
                      </label>
                      <p className="text-[11px] text-muted-foreground">
                        How fast the reader speaks your cue lines
                      </p>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                      {playbackSpeed.toFixed(1)}x
                    </span>
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
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Slower</span>
                    <span>Normal</span>
                    <span>Faster</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-muted/60 text-muted-foreground">
                      <Volume2 className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium">
                        Reader Volume
                      </label>
                      <p className="text-[11px] text-muted-foreground">
                        Volume level for the scene partner's voice
                      </p>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                      {readerVolume === 0 ? "Muted" : `${Math.round(readerVolume * 100)}%`}
                    </span>
                  </div>
                  <Slider
                    value={[readerVolume]}
                    onValueChange={([value]) => onReaderVolumeChange(value)}
                    min={0}
                    max={1}
                    step={0.05}
                    className="w-full"
                    data-testid="slider-reader-volume"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center",
                      tapMode ? "bg-foreground text-background" : "bg-muted/60 text-muted-foreground"
                    )}>
                      <Hand className="h-4 w-4" />
                    </div>
                    <div>
                      <label htmlFor="tapMode" className="text-sm font-medium cursor-pointer">
                        Tap to Advance
                      </label>
                      <p className="text-[11px] text-muted-foreground">
                        Tap or press space to move to your next line
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="tapMode"
                    checked={tapMode}
                    onCheckedChange={onTapModeChange}
                    data-testid="switch-tap-mode"
                  />
                </div>
              </div>

              <Separator />

              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between gap-2 text-muted-foreground"
                    data-testid="button-advanced-toggle"
                  >
                    <div className="flex items-center gap-2">
                      <Settings className="h-3.5 w-3.5" />
                      <span className="text-xs font-semibold uppercase tracking-wider">Advanced</span>
                    </div>
                    {advancedOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-6 pt-4">

                  <div className="space-y-4" data-testid="section-timing">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-muted/60 text-muted-foreground">
                          <Timer className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <label className="text-sm font-medium">
                            Reader Delay
                          </label>
                          <p className="text-[11px] text-muted-foreground">
                            Pause before the reader speaks each cue line
                          </p>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground tabular-nums">
                          {readerDelay === 0 ? "None" : `${readerDelay.toFixed(1)}s`}
                        </span>
                      </div>
                      <Slider
                        value={[readerDelay]}
                        onValueChange={([value]) => onReaderDelayChange(value)}
                        min={0}
                        max={3}
                        step={0.5}
                        className="w-full"
                        data-testid="slider-reader-delay"
                      />
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>0s</span>
                        <span>1.5s</span>
                        <span>3s</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4" data-testid="section-audio-advanced">
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center",
                          ambientEnabled ? "bg-foreground text-background" : "bg-muted/60 text-muted-foreground"
                        )}>
                          {ambientEnabled ? (
                            <Music className="h-4 w-4" />
                          ) : (
                            <VolumeX className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <label htmlFor="ambient" className="text-sm font-medium cursor-pointer">
                            Ambient Sound
                          </label>
                          <p className="text-[11px] text-muted-foreground">
                            Subtle background hum to help you focus
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

                    {cameraEnabled && onEarbudsOnlyChange && (
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-9 h-9 rounded-lg flex items-center justify-center",
                            earbudsOnly ? "bg-foreground text-background" : "bg-muted/60 text-muted-foreground"
                          )}>
                            <Headphones className="h-4 w-4" />
                          </div>
                          <div>
                            <label htmlFor="earbudsOnly" className="text-sm font-medium cursor-pointer">
                              Earbuds Only
                            </label>
                            <p className="text-[11px] text-muted-foreground">
                              Play the reader's voice through earbuds only, keeping it out of your recording
                            </p>
                          </div>
                        </div>
                        <Switch
                          id="earbudsOnly"
                          checked={earbudsOnly}
                          onCheckedChange={onEarbudsOnlyChange}
                          data-testid="switch-earbuds-only"
                        />
                      </div>
                    )}
                  </div>

                  {onHandsFreeMode && (
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        setTimeout(onHandsFreeMode, 300);
                      }}
                      className="w-full flex items-center gap-3 py-3 px-1 rounded-lg hover-elevate transition-colors"
                      data-testid="button-hands-free-mode"
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-muted/60 text-muted-foreground">
                        <Car className="h-4 w-4" />
                      </div>
                      <div className="text-left flex items-center gap-2">
                        <div>
                          <span className="text-sm font-medium">Hands-Free Mode</span>
                          <p className="text-[11px] text-muted-foreground">
                            Audio-only rehearsal — no screen needed
                          </p>
                        </div>
                        {!(!!user?.subscriptionTier && ["pro", "comp", "internal"].includes(user.subscriptionTier)) && (
                          <span className="text-[10px] font-semibold text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded shrink-0">Pro</span>
                        )}
                      </div>
                    </button>
                  )}

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Voice Presets
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Choose a distinct voice style for each character
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
                </CollapsibleContent>
              </Collapsible>

              {scenes.length > 1 && (
                <>
                  <Separator />

                  <div className="space-y-3" data-testid="section-script">
                    <SectionHeader icon={Layers} label="Script" />

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
                            <div className="text-[11px] opacity-70">
                              {scene.lines.length} lines
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div className="space-y-2">
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

                <Button
                  variant="ghost"
                  size="lg"
                  className="w-full gap-2 text-muted-foreground"
                  onClick={handleResetDefaults}
                  data-testid="button-reset-defaults"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset to Defaults
                </Button>

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

              <div className="pt-6 pb-4">
                <Button
                  variant="ghost"
                  size="lg"
                  className="w-full text-muted-foreground"
                  onClick={() => setIsOpen(false)}
                  data-testid="button-close-settings"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
