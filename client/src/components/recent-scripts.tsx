import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ToastAction } from "@/components/ui/toast";
import { Clock, FileText, Users2, Trash2, Pencil, Check, X, Save, User } from "lucide-react";
import { Mascot } from "@/components/mascot";
import type { RecentScript } from "@/hooks/use-recent-scripts";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface RecentScriptsProps {
  scripts: RecentScript[];
  onSelect: (script: RecentScript) => void;
  onUpdate: (id: string, updates: Partial<Pick<RecentScript, "name" | "lastRole">>) => void;
  onDelete: (id: string) => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function RecentScripts({ scripts, onSelect, onUpdate, onDelete }: RecentScriptsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const deleteTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const handleDelete = useCallback((script: RecentScript) => {
    const scriptId = script.id;
    setPendingDeleteIds(prev => new Set(prev).add(scriptId));

    const timer = setTimeout(() => {
      deleteTimersRef.current.delete(scriptId);
      setPendingDeleteIds(prev => {
        const next = new Set(prev);
        next.delete(scriptId);
        return next;
      });
      onDelete(scriptId);
    }, 5000);

    deleteTimersRef.current.set(scriptId, timer);

    const { dismiss } = toast({
      description: `"${script.name}" removed`,
      action: (
        <ToastAction
          altText="Undo delete"
          data-testid="button-undo-delete"
          onClick={() => {
            const existingTimer = deleteTimersRef.current.get(scriptId);
            if (existingTimer) {
              clearTimeout(existingTimer);
              deleteTimersRef.current.delete(scriptId);
            }
            setPendingDeleteIds(prev => {
              const next = new Set(prev);
              next.delete(scriptId);
              return next;
            });
            dismiss();
          }}
        >
          Undo
        </ToastAction>
      ),
    });
  }, [onDelete, toast]);

  const handleSaveToLibrary = async (script: RecentScript) => {
    if (savingId || savedIds.has(script.id)) return;
    setSavingId(script.id);
    try {
      const res = await fetch("/api/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: script.name,
          rawScript: script.rawScript || "",
        }),
      });
      if (res.ok) {
        setSavedIds(prev => new Set(prev).add(script.id));
        toast({ description: "Script saved to your library" });
      } else {
        toast({ title: "Could not save script", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not save script", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  if (scripts.length === 0 && pendingDeleteIds.size === 0) {
    return (
      <div data-testid="empty-recent-scripts">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recent
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center py-10 text-center animate-fade-in-up glass-surface rounded-lg">
          <Mascot mood="waving" size="sm" className="mb-3" />
          <h3 className="text-sm font-semibold text-foreground mb-1">Ready when you are</h3>
          <p className="text-xs text-muted-foreground max-w-[240px] leading-relaxed">
            Paste a script above to get started. Your recent scripts will appear here.
          </p>
        </div>
      </div>
    );
  }

  const startEdit = (script: RecentScript) => {
    setEditingId(script.id);
    setEditName(script.name);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const confirmEdit = () => {
    if (editingId && editName.trim()) {
      onUpdate(editingId, { name: editName.trim() });
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const visibleScripts = scripts.filter(s => !pendingDeleteIds.has(s.id));

  return (
    <div data-testid="recent-scripts-section">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Recent
        </h2>
      </div>

      <div className="space-y-2">
        {visibleScripts.map((script) => (
          <div
            key={script.id}
            className="group glass-surface rounded-lg p-3 cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label={`Open script: ${script.name}`}
            onClick={() => {
              if (editingId !== script.id) onSelect(script);
            }}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && editingId !== script.id) {
                e.preventDefault();
                onSelect(script);
              }
            }}
            data-testid={`card-recent-script-${script.id}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {editingId === script.id ? (
                  <div className="flex items-center gap-1" role="group" aria-label="Edit script name" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <Input
                      ref={inputRef}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="text-sm"
                      data-testid="input-edit-script-name"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground"
                      onClick={confirmEdit}
                      aria-label="Confirm rename"
                      data-testid="button-confirm-edit"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground"
                      onClick={cancelEdit}
                      aria-label="Cancel rename"
                      data-testid="button-cancel-edit"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-foreground truncate" data-testid="text-script-name">
                    {script.name}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 no-default-active-elevate" data-testid={`badge-role-count-${script.id}`}>
                    <Users2 className="h-2.5 w-2.5 mr-0.5" />
                    {script.roleCount} {script.roleCount === 1 ? "role" : "roles"}
                  </Badge>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground" data-testid={`text-line-count-${script.id}`}>
                    <FileText className="h-3 w-3" />
                    {script.lineCount} {script.lineCount === 1 ? "line" : "lines"}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground" data-testid={`text-time-ago-${script.id}`}>
                    <Clock className="h-3 w-3" />
                    {timeAgo(script.lastUsed)}
                  </span>
                </div>
                {script.lastRole && (
                  <div className="flex items-center gap-1 mt-1.5" data-testid={`text-last-role-${script.id}`}>
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">
                      Last played as <span className="font-medium text-muted-foreground">{script.lastRole}</span>
                    </span>
                  </div>
                )}
              </div>

              {editingId !== script.id && (
                <div
                  className="flex items-center gap-0.5 shrink-0"
                  role="group"
                  aria-label="Script actions"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  {isAuthenticated && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={savedIds.has(script.id) ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}
                      onClick={() => handleSaveToLibrary(script)}
                      disabled={savingId === script.id || savedIds.has(script.id)}
                      title={savedIds.has(script.id) ? "Saved" : "Save to library"}
                      aria-label={savedIds.has(script.id) ? "Saved to library" : "Save to library"}
                      data-testid={`button-save-script-${script.id}`}
                    >
                      {savedIds.has(script.id) ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                    onClick={() => startEdit(script)}
                    title="Rename"
                    aria-label="Rename script"
                    data-testid={`button-edit-script-${script.id}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                    onClick={() => handleDelete(script)}
                    title="Delete"
                    aria-label="Delete script"
                    data-testid={`button-delete-script-${script.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
