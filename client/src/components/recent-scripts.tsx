import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Clock, FileText, Users2, Trash2, Pencil, Check, X } from "lucide-react";
import type { RecentScript } from "@/lib/recent-scripts";
import { deleteRecentScript, updateRecentScript } from "@/lib/recent-scripts";

interface RecentScriptsProps {
  scripts: RecentScript[];
  onSelect: (script: RecentScript) => void;
  onChanged: () => void;
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
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function RecentScripts({ scripts, onSelect, onChanged }: RecentScriptsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<RecentScript | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (scripts.length === 0) return null;

  const startEdit = (script: RecentScript) => {
    setEditingId(script.id);
    setEditName(script.name);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const confirmEdit = () => {
    if (editingId && editName.trim()) {
      updateRecentScript(editingId, { name: editName.trim() });
      onChanged();
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteRecentScript(deleteTarget.id);
      onChanged();
      setDeleteTarget(null);
    }
  };

  return (
    <div data-testid="recent-scripts-section">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Recent
        </h2>
      </div>

      <div className="space-y-2">
        {scripts.map((script) => (
          <div
            key={script.id}
            className="group glass-surface rounded-md p-3 cursor-pointer"
            onClick={() => {
              if (editingId !== script.id) onSelect(script);
            }}
            data-testid={`card-recent-script-${script.id}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {editingId === script.id ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
                      data-testid="button-confirm-edit"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground"
                      onClick={cancelEdit}
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
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                    <Users2 className="h-3 w-3" />
                    {script.roleCount} {script.roleCount === 1 ? "role" : "roles"}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                    <FileText className="h-3 w-3" />
                    {script.lineCount} {script.lineCount === 1 ? "line" : "lines"}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                    <Clock className="h-3 w-3" />
                    {timeAgo(script.lastUsed)}
                  </span>
                </div>
                {script.lastRole && (
                  <p className="text-[11px] text-muted-foreground/50 mt-1">
                    Last played as {script.lastRole}
                  </p>
                )}
              </div>

              {editingId !== script.id && (
                <div
                  className="flex items-center gap-0.5 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                    onClick={() => startEdit(script)}
                    title="Rename"
                    data-testid={`button-edit-script-${script.id}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                    onClick={() => setDeleteTarget(script)}
                    title="Delete"
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from recent</AlertDialogTitle>
            <AlertDialogDescription>
              Remove "{deleteTarget?.name}" from your recent scripts? This only removes the history entry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} data-testid="button-confirm-delete">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
