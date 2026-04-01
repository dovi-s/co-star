import { Crown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProAccess } from "@/hooks/use-pro-access";

interface ProGateProps {
  feature: string;
  description: string;
  children: React.ReactNode;
  onUpgrade?: () => void;
  className?: string;
  compact?: boolean;
}

export function ProGate({ feature, description, children, onUpgrade, className, compact }: ProGateProps) {
  const { isPro } = useProAccess();

  if (isPro) return <>{children}</>;

  return (
    <div className={cn("relative group", className)}>
      <div className="pointer-events-none opacity-40 select-none blur-[1px]">
        {children}
      </div>
      <button
        onClick={onUpgrade}
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-lg transition-colors",
          onUpgrade && "cursor-pointer hover:bg-background/70"
        )}
        data-testid={`pro-gate-${feature}`}
      >
        <div className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/90 to-amber-600/90 text-white shadow-sm",
          compact ? "text-[10px]" : "text-xs"
        )}>
          <Crown className={cn(compact ? "w-3 h-3" : "w-3.5 h-3.5")} />
          <span className="font-semibold">Pro</span>
        </div>
        {!compact && (
          <p className="text-[11px] text-muted-foreground mt-2 text-center max-w-[200px] leading-tight">
            {description}
          </p>
        )}
      </button>
    </div>
  );
}

export function ProBadge({ className }: { className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-gradient-to-r from-amber-500/90 to-amber-600/90 text-white",
      className
    )}>
      <Crown className="w-2.5 h-2.5" />
      Pro
    </span>
  );
}

export function LockedFeatureCard({
  icon: Icon,
  title,
  description,
  onUpgrade,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onUpgrade?: () => void;
}) {
  return (
    <button
      onClick={onUpgrade}
      className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-border/60 bg-muted/30 hover:bg-muted/50 transition-colors text-left group"
      data-testid={`locked-feature-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="w-8 h-8 rounded-md bg-amber-500/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground">{title}</span>
          <ProBadge />
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{description}</p>
      </div>
      <Lock className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
    </button>
  );
}
