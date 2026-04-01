import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Sparkles, Wrench, Zap, Star, Rocket, Bug } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChangelogEntry {
  id: string;
  title: string;
  description: string;
  category: string;
  version: string | null;
  publishedAt: string;
}

const categoryConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  feature: { icon: Sparkles, color: "text-blue-500 bg-blue-500/10", label: "New Feature" },
  improvement: { icon: Zap, color: "text-green-500 bg-green-500/10", label: "Improvement" },
  fix: { icon: Bug, color: "text-orange-500 bg-orange-500/10", label: "Bug Fix" },
  milestone: { icon: Star, color: "text-amber-500 bg-amber-500/10", label: "Milestone" },
  launch: { icon: Rocket, color: "text-purple-500 bg-purple-500/10", label: "Launch" },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function WhatsNewPage({ onBack }: { onBack: () => void }) {
  const { data: entries = [], isLoading } = useQuery<ChangelogEntry[]>({
    queryKey: ["/api/changelog"],
  });

  return (
    <div className="min-h-screen bg-background" data-testid="whats-new-page">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-lg mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground" data-testid="whats-new-back">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-semibold text-foreground">What's New</h1>
            <p className="text-[11px] text-muted-foreground">Latest updates and improvements</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-lg border border-border/50 p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-full mb-1" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <Sparkles className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No updates yet. Check back soon!</p>
          </div>
        ) : (
          entries.map(entry => {
            const cat = categoryConfig[entry.category] || categoryConfig.improvement;
            const CatIcon = cat.icon;
            return (
              <div key={entry.id} className="rounded-lg border border-border/50 bg-card p-4" data-testid={`changelog-entry-${entry.id}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn("w-6 h-6 rounded flex items-center justify-center", cat.color)}>
                    <CatIcon className="w-3.5 h-3.5" />
                  </div>
                  <span className={cn("text-[10px] font-medium uppercase tracking-wide", cat.color.split(" ")[0])}>{cat.label}</span>
                  {entry.version && (
                    <span className="text-[10px] text-muted-foreground ml-auto">v{entry.version}</span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">{entry.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{entry.description}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-2">{formatDate(entry.publishedAt)}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
