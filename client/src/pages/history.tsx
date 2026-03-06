import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  BarChart3,
  TrendingUp,
  Target,
  Clock,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PerformanceRun } from "@shared/models/auth";

function gradeFromAccuracy(accuracy: number): { label: string; color: string } {
  if (accuracy >= 95) return { label: "Perfect", color: "text-green-600" };
  if (accuracy >= 85) return { label: "Great", color: "text-blue-600" };
  if (accuracy >= 70) return { label: "Good", color: "text-foreground" };
  return { label: "Learning", color: "text-amber-600" };
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

export function HistoryPage({ onBack }: { onBack: () => void }) {
  const { isAuthenticated } = useAuth();

  const { data: runs, isLoading } = useQuery<PerformanceRun[]>({
    queryKey: ["/api/performance"],
    enabled: isAuthenticated,
  });

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 sticky top-0 z-50 glass-surface safe-top rounded-none">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Go back"
          onClick={onBack}
          data-testid="button-back"
          className="shrink-0 -ml-1"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-sm text-foreground">Performance History</h1>
      </header>

      <main className="flex-1 px-5 py-6">
        <div className="max-w-lg mx-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && totalRuns === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in-up" data-testid="empty-history">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">No runs yet</h3>
              <p className="text-xs text-muted-foreground max-w-[240px] mb-4 leading-relaxed">
                Complete your first rehearsal and your performance stats will appear here.
              </p>
              <Button
                size="sm"
                onClick={onBack}
                data-testid="button-start-first-rehearsal"
              >
                Start rehearsing
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
                          <p className="text-sm font-medium text-foreground truncate">
                            {run.scriptName}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[11px] text-muted-foreground">
                              {formatDate(run.createdAt)}
                            </span>
                            {run.durationSeconds && (
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Clock className="h-2.5 w-2.5" />
                                {formatDuration(run.durationSeconds)}
                              </span>
                            )}
                            {run.memorizationMode && run.memorizationMode !== "off" && (
                              <span className="text-[11px] text-muted-foreground/60 uppercase">
                                {run.memorizationMode}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn("text-sm font-semibold", grade.color)}>
                            {Math.round(run.accuracy ?? 0)}%
                          </p>
                          <p className={cn("text-[11px]", grade.color)}>
                            {grade.label}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
