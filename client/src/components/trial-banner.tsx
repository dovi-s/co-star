import { useQuery } from "@tanstack/react-query";
import { Crown, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

interface TrialStatus {
  isTrialing: boolean;
  expired?: boolean;
  daysLeft?: number;
  trialEndsAt?: string;
}

export function TrialBanner({ onUpgrade }: { onUpgrade?: () => void }) {
  const { isAuthenticated } = useAuth();
  const { data: trial } = useQuery<TrialStatus>({
    queryKey: ["/api/trial-status"],
    enabled: isAuthenticated,
    staleTime: 60000,
  });

  if (!trial?.isTrialing && !trial?.expired) return null;

  if (trial.expired) {
    return (
      <button
        onClick={onUpgrade}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs"
        data-testid="trial-expired-banner"
      >
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 text-left">Your Pro trial has ended. Upgrade to keep your features.</span>
        <span className="font-medium text-amber-600 dark:text-amber-300 shrink-0">Upgrade</span>
      </button>
    );
  }

  const daysLeft = trial.daysLeft || 0;
  const urgent = daysLeft <= 3;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
        urgent
          ? "bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400"
          : "bg-primary/5 border border-primary/10 text-primary"
      )}
      data-testid="trial-active-banner"
    >
      {urgent ? <Clock className="w-3.5 h-3.5 shrink-0" /> : <Sparkles className="w-3.5 h-3.5 shrink-0" />}
      <span className="flex-1">
        {urgent
          ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left on your Pro trial`
          : `You're on a 14-day Pro trial — ${daysLeft} days left`}
      </span>
      {onUpgrade && (
        <button
          onClick={onUpgrade}
          className="font-medium underline underline-offset-2 shrink-0"
          data-testid="trial-upgrade-link"
        >
          {urgent ? "Upgrade now" : "Keep Pro"}
        </button>
      )}
    </div>
  );
}
