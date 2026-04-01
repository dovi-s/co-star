import { Crown, Sparkles, TrendingUp, Mic, BarChart3, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useProAccess } from "@/hooks/use-pro-access";
import { trackFeature } from "@/hooks/use-analytics";

interface UpgradePromptProps {
  context: "session_end" | "recording" | "analytics" | "library" | "general";
  linesRehearsed?: number;
  onUpgrade?: () => void;
  className?: string;
}

const contextMessages: Record<string, { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }> = {
  session_end: {
    title: "Great rehearsal!",
    subtitle: "Upgrade to Pro to save your progress and track improvement over time.",
    icon: TrendingUp,
  },
  recording: {
    title: "Record your takes",
    subtitle: "Save recordings and review your performances anytime.",
    icon: Mic,
  },
  analytics: {
    title: "Track your growth",
    subtitle: "See your accuracy, pacing, and improvement trends.",
    icon: BarChart3,
  },
  library: {
    title: "Cloud script library",
    subtitle: "Save unlimited scripts and access them anywhere.",
    icon: BookOpen,
  },
  general: {
    title: "Unlock the full experience",
    subtitle: "Unlimited rehearsals, recordings, analytics, and more.",
    icon: Sparkles,
  },
};

export function UpgradePrompt({ context, linesRehearsed, onUpgrade, className }: UpgradePromptProps) {
  const { isAuthenticated } = useAuth();
  const { isPro } = useProAccess();
  if (!isAuthenticated || isPro) return null;

  const msg = contextMessages[context] || contextMessages.general;
  const Icon = msg.icon;

  const handleClick = () => {
    trackFeature("upgrade_prompt", "clicked", { context, linesRehearsed });
    onUpgrade?.();
  };

  return (
    <div className={cn("rounded-lg border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-amber-600/5 p-4", className)} data-testid={`upgrade-prompt-${context}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/20 flex items-center justify-center shrink-0">
          <Icon className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground">{msg.title}</h4>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{msg.subtitle}</p>
          {linesRehearsed && linesRehearsed > 0 && context === "session_end" && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
              You rehearsed {linesRehearsed} lines today.
            </p>
          )}
        </div>
      </div>
      <Button
        onClick={handleClick}
        className="w-full mt-3 h-9 text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white border-0"
        data-testid={`upgrade-btn-${context}`}
      >
        <Crown className="w-3.5 h-3.5 mr-1.5" />
        Upgrade to Pro
      </Button>
    </div>
  );
}

export function UpgradeNudge({ context, onUpgrade, className }: { context: string; onUpgrade?: () => void; className?: string }) {
  const { isAuthenticated } = useAuth();
  const { isPro } = useProAccess();
  if (!isAuthenticated || isPro) return null;

  return (
    <button
      onClick={() => {
        trackFeature("upgrade_nudge", "clicked", { context });
        onUpgrade?.();
      }}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors",
        className
      )}
      data-testid={`upgrade-nudge-${context}`}
    >
      <Crown className="w-2.5 h-2.5" />
      Unlock with Pro
    </button>
  );
}
