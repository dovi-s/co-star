import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Check, X, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  "AI Voices",
  "Script Upload",
  "PDF Support",
  "OCR / Photo Scan",
  "Multiplayer Table Read",
  "Self-Tape Recording",
  "Performance Feedback",
  "Memorization Modes",
  "Free Tier",
] as const;

interface Competitor {
  name: string;
  features: Record<string, boolean>;
  highlighted?: boolean;
}

const competitors: Competitor[] = [
  {
    name: "co-star",
    highlighted: true,
    features: {
      "AI Voices": true,
      "Script Upload": true,
      "PDF Support": true,
      "OCR / Photo Scan": true,
      "Multiplayer Table Read": true,
      "Self-Tape Recording": true,
      "Performance Feedback": true,
      "Memorization Modes": true,
      "Free Tier": true,
    },
  },
  {
    name: "Rehearsal Pro",
    features: {
      "AI Voices": false,
      "Script Upload": true,
      "PDF Support": true,
      "OCR / Photo Scan": false,
      "Multiplayer Table Read": false,
      "Self-Tape Recording": true,
      "Performance Feedback": false,
      "Memorization Modes": true,
      "Free Tier": false,
    },
  },
  {
    name: "LineLearner",
    features: {
      "AI Voices": true,
      "Script Upload": true,
      "PDF Support": false,
      "OCR / Photo Scan": false,
      "Multiplayer Table Read": false,
      "Self-Tape Recording": false,
      "Performance Feedback": false,
      "Memorization Modes": true,
      "Free Tier": true,
    },
  },
];

const freeTierFeatures = [
  "All core features included",
  "Watermark on recordings",
  "No cloud persistence",
];

const proTierFeatures = [
  "Watermark-free recordings",
  "Saved scripts in the cloud",
  "Performance history & analytics",
  "Priority support",
];

export function ComparePage({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 sticky top-0 z-50 glass-surface safe-top rounded-none">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          data-testid="button-back"
          className="shrink-0 -ml-1"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-sm text-foreground">Compare & Pricing</h1>
      </header>

      <main className="flex-1 px-5 py-8">
        <div className="max-w-lg mx-auto">
          <h2 className="text-lg font-semibold text-foreground mb-1 animate-fade-in-up">How we compare</h2>
          <p className="text-sm text-muted-foreground mb-6 animate-fade-in-up" style={{ animationDelay: "50ms" }}>
            See how co-star stacks up against the competition.
          </p>

          <div className="space-y-4">
            {competitors.map((comp, i) => (
              <div
                key={comp.name}
                className={cn(
                  "glass-surface rounded-md p-4 animate-fade-in-up",
                  comp.highlighted && "ring-2 ring-primary",
                )}
                style={{ animationDelay: `${(i + 1) * 100}ms` }}
                data-testid={`card-competitor-${comp.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-foreground">{comp.name}</span>
                  {comp.highlighted && (
                    <Badge variant="default" className="no-default-hover-elevate">
                      <Crown className="h-3 w-3 mr-1" />
                      Best
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {features.map((feature) => {
                    const has = comp.features[feature];
                    return (
                      <div key={feature} className="flex items-center gap-2">
                        {has ? (
                          <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                        )}
                        <span className={cn("text-xs", has ? "text-foreground" : "text-muted-foreground/60")}>
                          {feature}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-lg font-semibold text-foreground mt-10 mb-1 animate-fade-in-up" style={{ animationDelay: "400ms" }}>
            Pricing
          </h2>
          <p className="text-sm text-muted-foreground mb-6 animate-fade-in-up" style={{ animationDelay: "450ms" }}>
            Start free, upgrade when you're ready.
          </p>

          <div className="space-y-4">
            <div
              className="glass-surface rounded-md p-5 animate-fade-in-up"
              style={{ animationDelay: "500ms" }}
              data-testid="card-pricing-free"
            >
              <div className="mb-3">
                <span className="text-sm font-semibold text-foreground">Free</span>
                <span className="text-xs text-muted-foreground ml-2">Free forever</span>
              </div>
              <div className="space-y-2">
                {freeTierFeatures.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span className="text-sm text-muted-foreground">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="glass-surface rounded-md p-5 ring-2 ring-primary animate-fade-in-up"
              style={{ animationDelay: "600ms" }}
              data-testid="card-pricing-pro"
            >
              <div className="mb-3">
                <span className="text-sm font-semibold text-foreground">Pro</span>
                <span className="text-xs text-muted-foreground ml-2">$9/mo or $69/year</span>
              </div>
              <div className="space-y-2">
                {proTierFeatures.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-sm text-muted-foreground">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="px-5 py-6 pb-8 safe-bottom" />
    </div>
  );
}
