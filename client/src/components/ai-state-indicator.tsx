import { cn } from "@/lib/utils";
import { Volume2, Mic } from "lucide-react";

export type AIState = "idle" | "speaking" | "listening" | "thinking";

interface AIStateIndicatorProps {
  state: AIState;
  size?: "sm" | "md" | "lg";
  className?: string;
  showLabel?: boolean;
}

const sizeConfig = {
  sm: { container: "w-8 h-8", icon: "h-3.5 w-3.5", blob: "w-5 h-5" },
  md: { container: "w-10 h-10", icon: "h-4 w-4", blob: "w-6 h-6" },
  lg: { container: "w-12 h-12", icon: "h-5 w-5", blob: "w-7 h-7" },
};

const stateLabels: Record<AIState, string> = {
  idle: "",
  speaking: "Speaking",
  listening: "Your line",
  thinking: "Thinking",
};

export function AIStateIndicator({
  state,
  size = "md",
  className,
  showLabel = false,
}: AIStateIndicatorProps) {
  const config = sizeConfig[size];
  const isActive = state !== "idle";

  return (
    <div className={cn("flex items-center gap-2", className)} data-testid="ai-state-indicator" role="status" aria-label={stateLabels[state] || "AI idle"}>
      <div
        className={cn(
          "relative flex items-center justify-center rounded-full transition-all duration-300",
          config.container,
          state === "speaking" && "energy-ring speaking",
          state === "listening" && "gradient-ripple",
          state === "thinking" && "energy-ring thinking",
          isActive && "energy-halo"
        )}
      >
        <div
          className={cn(
            "circle-badge w-full h-full",
            "transition-all duration-300",
            state === "idle" && "bg-muted",
            state === "speaking" && "bg-primary/10",
            state === "listening" && "bg-success/10",
            state === "thinking" && "bg-accent/10"
          )}
        >
          {state === "speaking" && (
            <Volume2
              className={cn(config.icon, "text-primary transition-all duration-200")}
            />
          )}
          {state === "listening" && (
            <Mic
              className={cn(config.icon, "text-success transition-all duration-200")}
            />
          )}
          {state === "thinking" && (
            <div className={cn(config.blob, "thinking-dots transition-all duration-200")}>
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          )}
          {state === "idle" && (
            <Volume2
              className={cn(config.icon, "text-muted-foreground/50 transition-all duration-200")}
            />
          )}
        </div>
      </div>

      {showLabel && isActive && (
        <span
          className={cn(
            "text-xs font-medium animate-fade-in",
            state === "speaking" && "text-primary",
            state === "listening" && "text-success",
            state === "thinking" && "text-accent"
          )}
          data-testid="text-ai-state"
        >
          {stateLabels[state]}
        </span>
      )}
    </div>
  );
}

interface SpeakingEnergyBarsProps {
  className?: string;
  active?: boolean;
}

export function SpeakingEnergyBars({ className, active = true }: SpeakingEnergyBarsProps) {
  if (!active) return null;

  return (
    <div className={cn("speaking-energy", className)} data-testid="speaking-energy">
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

interface ThinkingEnergyDotsProps {
  className?: string;
}

export function ThinkingEnergyDots({ className }: ThinkingEnergyDotsProps) {
  return (
    <div className={cn("thinking-energy", className)} data-testid="thinking-energy">
      <span />
      <span />
      <span />
    </div>
  );
}
