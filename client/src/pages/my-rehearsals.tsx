import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useProAccess } from "@/hooks/use-pro-access";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChevronLeft,
  Crown,
  FileText,
  Trash2,
  Play,
  Clock,
  Loader2,
  BarChart3,
  TrendingUp,
  Target,
  Film,
  Download,
  HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SavedScript, PerformanceRun, Recording } from "@shared/models/auth";

type Tab = "recordings" | "scripts" | "stats";

type ScriptSummary = Pick<SavedScript, "id" | "name" | "userRoleId" | "lastPosition" | "lastScene" | "createdAt" | "updatedAt">;

interface RecordingsResponse {
  recordings: Recording[];
  storageUsed: number;
  storageLimit: number;
}

function formatDate(date: string | Date | null | undefined) {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function gradeFromAccuracy(accuracy: number): { label: string; color: string } {
  if (accuracy >= 95) return { label: "Perfect", color: "text-green-600" };
  if (accuracy >= 85) return { label: "Great", color: "text-blue-600" };
  if (accuracy >= 70) return { label: "Good", color: "text-foreground" };
  return { label: "Learning", color: "text-amber-600" };
}

export function MyRehearsalsPage({
  onBack,
  onLoadScript,
  onNavigate,
}: {
  onBack: () => void;
  onLoadScript: (script: SavedScript) => void;
  onNavigate?: (page: string) => void;
}) {
  const { isAuthenticated, user } = useAuth();
  const { isPro } = useProAccess();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("recordings");
  const [deleteTarget, setDeleteTarget] = useState<{ type: "recording" | "script"; id: string; name: string } | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const { data: recordingsData, isLoading: loadingRecordings } = useQuery<RecordingsResponse>({
    queryKey: ["/api/recordings"],
    enabled: isAuthenticated && isPro,
  });

  const { data: scripts, isLoading: loadingScripts } = useQuery<ScriptSummary[]>({
    queryKey: ["/api/scripts"],
    enabled: isAuthenticated && isPro,
  });

  const { data: runs, isLoading: loadingRuns } = useQuery<PerformanceRun[]>({
    queryKey: ["/api/performance"],
    enabled: isAuthenticated && isPro,
  });

  const deleteRecordingMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/recordings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
      setDeleteTarget(null);
      toast({ title: "Recording deleted" });
    },
  });

  const deleteScriptMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/scripts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scripts"] });
      setDeleteTarget(null);
    },
  });

  const loadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("GET", `/api/scripts/${id}`);
      return res.json() as Promise<SavedScript>;
    },
    onSuccess: (script) => {
      onLoadScript(script);
    },
  });

  if (isAuthenticated && !isPro) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center gap-3 px-4 py-3 sticky top-0 z-50 glass-surface safe-top rounded-none">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">My Rehearsals</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
          <Film className="h-12 w-12 text-muted-foreground/50" />
          <div>
            <h2 className="text-lg font-semibold">Pro Feature</h2>
            <p className="text-sm text-muted-foreground mt-1">Save recordings to the cloud, track scripts, and view performance stats. Upgrade to unlock your full rehearsal library.</p>
          </div>
          <Button onClick={() => onNavigate?.("subscription")} data-testid="button-upgrade-rehearsals">
            <Crown className="h-4 w-4 mr-2" />
            Upgrade to Pro
          </Button>
        </div>
      </div>
    );
  }

  const recordings = recordingsData?.recordings ?? [];
  const storageUsed = recordingsData?.storageUsed ?? 0;
  const storageLimit = recordingsData?.storageLimit ?? 2147483648;
  const storagePercent = Math.min(100, (storageUsed / storageLimit) * 100);

  const avgAccuracy = runs && runs.length > 0
    ? Math.round(runs.reduce((sum, r) => sum + (r.accuracy ?? 0), 0) / runs.length)
    : 0;
  const totalRuns = runs?.length ?? 0;
  const bestAccuracy = runs && runs.length > 0
    ? Math.round(Math.max(...runs.map(r => r.accuracy ?? 0)))
    : 0;
  const recentTrend = (() => {
    if (!runs || runs.length < 2) return null;
    const recent5 = runs.slice(0, Math.min(5, runs.length));
    const older5 = runs.slice(Math.min(5, runs.length), Math.min(10, runs.length));
    if (older5.length === 0) return null;
    const recentAvg = recent5.reduce((s, r) => s + (r.accuracy ?? 0), 0) / recent5.length;
    const olderAvg = older5.reduce((s, r) => s + (r.accuracy ?? 0), 0) / older5.length;
    return Math.round(recentAvg - olderAvg);
  })();

  const recordingsByScript = recordings.reduce<Record<string, Recording[]>>((acc, rec) => {
    const key = rec.scriptName || "Untitled";
    if (!acc[key]) acc[key] = [];
    acc[key].push(rec);
    return acc;
  }, {});

  const handleDownloadRecording = (recording: Recording) => {
    const url = `/api/recordings/${recording.id}/stream`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${recording.scriptName || "recording"}.${recording.mimeType?.includes("mp4") ? "mp4" : "webm"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "recordings", label: "Recordings" },
    { key: "scripts", label: "Scripts" },
    { key: "stats", label: "Stats" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 glass-surface safe-top rounded-none">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" aria-label="Go back" onClick={onBack} data-testid="button-back" className="shrink-0 -ml-1">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-sm text-foreground">My Rehearsals</h1>
        </div>

        {isPro && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <HardDrive className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">
                {formatFileSize(storageUsed)} / {formatFileSize(storageLimit)}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  storagePercent > 90 ? "bg-destructive" : storagePercent > 70 ? "bg-amber-500" : "bg-primary"
                )}
                style={{ width: `${storagePercent}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 py-2.5 text-xs font-medium transition-colors relative",
                activeTab === tab.key
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
              data-testid={`tab-${tab.key}`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 px-5 py-6">
        <div className="max-w-2xl mx-auto">

          {activeTab === "recordings" && (
            <>
              {loadingRecordings && (
                <div className="space-y-3" data-testid="skeleton-recordings">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="glass-surface rounded-lg p-4 animate-pulse" style={{ animationDelay: `${i * 80}ms` }}>
                      <div className="h-4 bg-muted/40 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-muted/30 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              )}

              {!loadingRecordings && recordings.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in-up" data-testid="empty-recordings">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
                    <Film className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-1.5">No recordings yet</h3>
                  <p className="text-sm text-muted-foreground max-w-[260px] mb-5 leading-relaxed">
                    Record a rehearsal and tap "Save to Library" to keep it here. Rewatch anytime to refine your performance.
                  </p>
                  <Button onClick={onBack} data-testid="button-start-recording">
                    Start Rehearsing
                  </Button>
                </div>
              )}

              {recordings.length > 0 && (
                <div className="space-y-5">
                  {Object.entries(recordingsByScript).map(([scriptName, recs]) => (
                    <div key={scriptName} className="animate-fade-in-up">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{scriptName}</h3>
                      <div className="space-y-2">
                        {recs.map((rec) => (
                          <div
                            key={rec.id}
                            className="glass-surface rounded-lg overflow-hidden"
                            data-testid={`card-recording-${rec.id}`}
                          >
                            {playingId === rec.id ? (
                              <div className="relative bg-black">
                                <video
                                  src={`/api/recordings/${rec.id}/stream`}
                                  controls
                                  autoPlay
                                  className="w-full max-h-[300px]"
                                  onEnded={() => setPlayingId(null)}
                                  data-testid={`video-player-${rec.id}`}
                                />
                                <button
                                  onClick={() => setPlayingId(null)}
                                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs"
                                  data-testid={`button-close-player-${rec.id}`}
                                >
                                  ✕
                                </button>
                              </div>
                            ) : null}
                            <div className="p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[11px] text-muted-foreground">{formatDate(rec.createdAt)}</span>
                                    {rec.durationSeconds && (
                                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                        <Clock className="h-2.5 w-2.5" />
                                        {formatDuration(rec.durationSeconds)}
                                      </span>
                                    )}
                                    <span className="text-[11px] text-muted-foreground">{formatFileSize(rec.fileSize)}</span>
                                  </div>
                                  {rec.accuracy != null && (
                                    <div className="mt-1">
                                      <span className={cn("text-xs font-medium", gradeFromAccuracy(rec.accuracy).color)}>
                                        {Math.round(rec.accuracy)}% — {gradeFromAccuracy(rec.accuracy).label}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Play recording"
                                    onClick={() => setPlayingId(playingId === rec.id ? null : rec.id)}
                                    data-testid={`button-play-recording-${rec.id}`}
                                  >
                                    <Play className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Download recording"
                                    onClick={() => handleDownloadRecording(rec)}
                                    data-testid={`button-download-recording-${rec.id}`}
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Delete recording"
                                    className="text-muted-foreground hover:text-destructive"
                                    onClick={() => setDeleteTarget({ type: "recording", id: rec.id, name: scriptName })}
                                    data-testid={`button-delete-recording-${rec.id}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "scripts" && (
            <>
              {loadingScripts && (
                <div className="space-y-3" data-testid="skeleton-scripts">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="glass-surface rounded-lg p-4 animate-pulse" style={{ animationDelay: `${i * 80}ms` }}>
                      <div className="h-4 bg-muted/40 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-muted/30 rounded w-1/3" />
                    </div>
                  ))}
                </div>
              )}

              {!loadingScripts && (!scripts || scripts.length === 0) && (
                <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in-up" data-testid="empty-scripts">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
                    <FileText className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-1.5">No saved scripts yet</h3>
                  <p className="text-sm text-muted-foreground max-w-[260px] mb-5 leading-relaxed">
                    Your saved scripts will appear here. Rehearse a script to get started.
                  </p>
                  <Button onClick={onBack} data-testid="button-import-first-script">
                    Start Rehearsing
                  </Button>
                </div>
              )}

              {scripts && scripts.length > 0 && (
                <div className="space-y-3">
                  {scripts.map((script, i) => (
                    <div
                      key={script.id}
                      className="glass-surface-heavy rounded-xl p-4 animate-fade-in-up border border-border/60"
                      style={{ animationDelay: `${i * 60}ms` }}
                      data-testid={`card-script-${script.id}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <button
                          className="flex-1 text-left min-w-0"
                          onClick={() => loadMutation.mutate(script.id)}
                          disabled={loadMutation.isPending}
                          data-testid={`button-load-script-${script.id}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <p className="text-sm font-semibold text-foreground truncate">{script.name}</p>
                          </div>
                          <div className="flex items-center gap-2 pl-6">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">{formatDate(script.updatedAt)}</span>
                          </div>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" aria-label="Play script" onClick={() => loadMutation.mutate(script.id)} disabled={loadMutation.isPending} data-testid={`button-play-script-${script.id}`}>
                            {loadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Delete script" className="text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget({ type: "script", id: script.id, name: script.name })} data-testid={`button-delete-script-${script.id}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "stats" && (
            <>
              {loadingRuns && (
                <div data-testid="skeleton-stats">
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="glass-surface rounded-lg p-3 text-center animate-pulse" style={{ animationDelay: `${i * 80}ms` }}>
                        <div className="h-4 w-4 bg-muted/30 rounded mx-auto mb-1" />
                        <div className="h-6 w-10 bg-muted/40 rounded mx-auto mb-1" />
                        <div className="h-3 w-12 bg-muted/30 rounded mx-auto" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!loadingRuns && totalRuns === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in-up" data-testid="empty-stats">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
                    <BarChart3 className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-1.5">Your stage awaits</h3>
                  <p className="text-sm text-muted-foreground max-w-[260px] mb-5 leading-relaxed">
                    Once you finish your first rehearsal, your accuracy and progress will show up here.
                  </p>
                  <Button onClick={onBack} data-testid="button-start-first-rehearsal">
                    Start Rehearsing
                  </Button>
                </div>
              )}

              {totalRuns > 0 && (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-6 animate-fade-in-up" data-testid="stats-summary">
                    <div className="glass-surface rounded-lg p-3 text-center">
                      <Target className="h-4 w-4 text-primary mx-auto mb-1" />
                      <p className="text-lg font-semibold text-foreground">{avgAccuracy}%</p>
                      <p className="text-[11px] text-muted-foreground">Average</p>
                    </div>
                    <div className="glass-surface rounded-lg p-3 text-center">
                      <TrendingUp className="h-4 w-4 text-green-600 mx-auto mb-1" />
                      <p className="text-lg font-semibold text-foreground">{bestAccuracy}%</p>
                      <p className="text-[11px] text-muted-foreground">Best</p>
                    </div>
                    <div className="glass-surface rounded-lg p-3 text-center">
                      <BarChart3 className="h-4 w-4 text-amber-600 mx-auto mb-1" />
                      <p className="text-lg font-semibold text-foreground">{totalRuns}</p>
                      <p className="text-[11px] text-muted-foreground">Runs</p>
                    </div>
                  </div>

                  {recentTrend !== null && (
                    <div className="glass-surface rounded-lg p-3 mb-6 animate-fade-in-up" style={{ animationDelay: "80ms" }} data-testid="trend-indicator">
                      <div className="flex items-center gap-2">
                        <TrendingUp className={cn("h-4 w-4", recentTrend >= 0 ? "text-green-600" : "text-amber-600")} />
                        <p className="text-xs text-muted-foreground">
                          {recentTrend >= 0 ? `Up ${recentTrend}%` : `Down ${Math.abs(recentTrend)}%`} compared to your earlier runs
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {runs!.map((run, i) => {
                      const grade = gradeFromAccuracy(run.accuracy ?? 0);
                      return (
                        <div
                          key={run.id}
                          className="glass-surface rounded-lg p-3 animate-fade-in-up"
                          style={{ animationDelay: `${(i + 2) * 60}ms` }}
                          data-testid={`card-run-${run.id}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">{run.scriptName}</p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[11px] text-muted-foreground">{formatDate(run.createdAt)}</span>
                                {run.durationSeconds && (
                                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <Clock className="h-2.5 w-2.5" />
                                    {formatDuration(run.durationSeconds)}
                                  </span>
                                )}
                                {run.memorizationMode && run.memorizationMode !== "off" && (
                                  <span className="text-[11px] text-muted-foreground uppercase">{run.memorizationMode}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={cn("text-sm font-semibold", grade.color)}>{Math.round(run.accuracy ?? 0)}%</p>
                              <p className={cn("text-[11px]", grade.color)}>{grade.label}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type === "recording" ? "recording" : "script"}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "recording"
                ? `Remove this recording of "${deleteTarget.name}"? This can't be undone.`
                : `Remove "${deleteTarget?.name}" from your saved scripts? This can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteTarget) return;
                if (deleteTarget.type === "recording") {
                  deleteRecordingMutation.mutate(deleteTarget.id);
                } else {
                  deleteScriptMutation.mutate(deleteTarget.id);
                }
              }}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
