import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
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
  FileText,
  Trash2,
  Play,
  Clock,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SavedScript } from "@shared/models/auth";

type ScriptSummary = Pick<SavedScript, "id" | "name" | "userRoleId" | "lastPosition" | "lastScene" | "createdAt" | "updatedAt">;

export function LibraryPage({
  onBack,
  onLoadScript,
}: {
  onBack: () => void;
  onLoadScript: (script: SavedScript) => void;
}) {
  const { isAuthenticated } = useAuth();
  const [deleteTarget, setDeleteTarget] = useState<ScriptSummary | null>(null);

  const { data: scripts, isLoading } = useQuery<ScriptSummary[]>({
    queryKey: ["/api/scripts"],
    enabled: isAuthenticated,
  });

  const deleteMutation = useMutation({
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
        <h1 className="font-semibold text-sm text-foreground">Saved Scripts</h1>
      </header>

      <main className="flex-1 px-5 py-6">
        <div className="max-w-lg mx-auto">
          {isLoading && (
            <div className="space-y-3" data-testid="skeleton-library">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="glass-surface rounded-lg p-4 animate-pulse"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="h-4 w-36 bg-muted/60 rounded" />
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 bg-muted/60 rounded" />
                        <div className="h-3 w-16 bg-muted/60 rounded" />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="h-9 w-9 bg-muted/60 rounded" />
                      <div className="h-9 w-9 bg-muted/60 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && (!scripts || scripts.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in-up" data-testid="empty-library">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">No saved scripts yet</h3>
              <p className="text-xs text-muted-foreground max-w-[240px] mb-4 leading-relaxed">
                Import a script and tap save to build your personal library.
              </p>
              <Button
                size="sm"
                onClick={onBack}
                data-testid="button-import-first-script"
              >
                Import your first script
              </Button>
            </div>
          )}

          {scripts && scripts.length > 0 && (
            <div className="space-y-3">
              {scripts.map((script, i) => (
                <div
                  key={script.id}
                  className="glass-surface rounded-lg p-4 animate-fade-in-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                  data-testid={`card-script-${script.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      className="flex-1 text-left min-w-0"
                      onClick={() => loadMutation.mutate(script.id)}
                      disabled={loadMutation.isPending}
                      data-testid={`button-load-script-${script.id}`}
                    >
                      <p className="text-sm font-medium text-foreground truncate">
                        {script.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3 text-muted-foreground/60" />
                        <span className="text-[11px] text-muted-foreground">
                          {formatDate(script.updatedAt)}
                        </span>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Play script"
                        onClick={() => loadMutation.mutate(script.id)}
                        disabled={loadMutation.isPending}
                        data-testid={`button-play-script-${script.id}`}
                      >
                        {loadMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete script"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(script)}
                        data-testid={`button-delete-script-${script.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete script</AlertDialogTitle>
            <AlertDialogDescription>
              Remove "{deleteTarget?.name}" from your saved scripts? This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
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
