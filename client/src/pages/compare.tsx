import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  Check,
  X,
  Minus,
  Crown,
  Mic,
  Smartphone,
  Users,
  PenLine,
  Headphones,
  Video,
  MessageCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Support = true | false | "partial";

interface Feature {
  name: string;
  description: string;
}

interface Competitor {
  name: string;
  price: string;
  platform: string;
  features: Record<string, Support>;
}

const features: Feature[] = [
  { name: "AI Voices", description: "Natural text-to-speech for scene partners" },
  { name: "Emotion Detection", description: "Reads tone from script context and stage directions" },
  { name: "Cue Mode", description: "AI listens and waits for your lines" },
  { name: "Script Upload", description: "Import scripts from files" },
  { name: "PDF Support", description: "Parse formatted PDF scripts" },
  { name: "OCR / Photo Scan", description: "Snap a photo of a printed script page" },
  { name: "Smart Parsing", description: "Auto-detect characters, directions, scene breaks" },
  { name: "Multiplayer", description: "Rehearse with other actors in real time" },
  { name: "Video Calls", description: "See and hear scene partners remotely" },
  { name: "Self-Tape Recording", description: "Record performance with camera overlay" },
  { name: "Teleprompter", description: "Scrolling text or guided line display" },
  { name: "Performance Feedback", description: "Accuracy tracking and run scoring" },
  { name: "Memorization Modes", description: "Progressive line hiding to build recall" },
  { name: "Keyboard Shortcuts", description: "Full desktop keyboard control" },
  { name: "Dark Mode", description: "Full dark theme support" },
  { name: "PWA / Offline", description: "Install as app, works without internet" },
  { name: "Cross-Platform", description: "Works on iOS, Android, and desktop" },
  { name: "Free Tier", description: "Full features without paying" },
];

const competitors: Competitor[] = [
  {
    name: "co-star",
    price: "Free / $9 mo",
    platform: "Web, PWA",
    features: {
      "AI Voices": true,
      "Emotion Detection": true,
      "Cue Mode": true,
      "Script Upload": true,
      "PDF Support": true,
      "OCR / Photo Scan": true,
      "Smart Parsing": true,
      "Multiplayer": true,
      "Video Calls": true,
      "Self-Tape Recording": true,
      "Teleprompter": "partial",
      "Performance Feedback": true,
      "Memorization Modes": true,
      "Keyboard Shortcuts": true,
      "Dark Mode": true,
      "PWA / Offline": true,
      "Cross-Platform": true,
      "Free Tier": true,
    },
  },
  {
    name: "ScenePartner",
    price: "~$15 mo",
    platform: "Web",
    features: {
      "AI Voices": true,
      "Emotion Detection": false,
      "Cue Mode": true,
      "Script Upload": true,
      "PDF Support": true,
      "OCR / Photo Scan": false,
      "Smart Parsing": "partial",
      "Multiplayer": false,
      "Video Calls": false,
      "Self-Tape Recording": true,
      "Teleprompter": false,
      "Performance Feedback": false,
      "Memorization Modes": false,
      "Keyboard Shortcuts": false,
      "Dark Mode": false,
      "PWA / Offline": false,
      "Cross-Platform": true,
      "Free Tier": "partial",
    },
  },
  {
    name: "ActingPal",
    price: "$10 mo",
    platform: "iOS, Android",
    features: {
      "AI Voices": true,
      "Emotion Detection": false,
      "Cue Mode": true,
      "Script Upload": true,
      "PDF Support": "partial",
      "OCR / Photo Scan": false,
      "Smart Parsing": true,
      "Multiplayer": false,
      "Video Calls": false,
      "Self-Tape Recording": true,
      "Teleprompter": true,
      "Performance Feedback": false,
      "Memorization Modes": true,
      "Keyboard Shortcuts": false,
      "Dark Mode": false,
      "PWA / Offline": false,
      "Cross-Platform": true,
      "Free Tier": "partial",
    },
  },
  {
    name: "coldRead",
    price: "$11 mo",
    platform: "iOS",
    features: {
      "AI Voices": false,
      "Emotion Detection": false,
      "Cue Mode": true,
      "Script Upload": false,
      "PDF Support": false,
      "OCR / Photo Scan": false,
      "Smart Parsing": false,
      "Multiplayer": false,
      "Video Calls": false,
      "Self-Tape Recording": true,
      "Teleprompter": true,
      "Performance Feedback": false,
      "Memorization Modes": false,
      "Keyboard Shortcuts": false,
      "Dark Mode": false,
      "PWA / Offline": true,
      "Cross-Platform": false,
      "Free Tier": "partial",
    },
  },
  {
    name: "WeAudition",
    price: "$15 mo + fees",
    platform: "iOS, Web",
    features: {
      "AI Voices": false,
      "Emotion Detection": false,
      "Cue Mode": false,
      "Script Upload": true,
      "PDF Support": true,
      "OCR / Photo Scan": false,
      "Smart Parsing": false,
      "Multiplayer": true,
      "Video Calls": true,
      "Self-Tape Recording": true,
      "Teleprompter": false,
      "Performance Feedback": false,
      "Memorization Modes": false,
      "Keyboard Shortcuts": false,
      "Dark Mode": false,
      "PWA / Offline": false,
      "Cross-Platform": "partial",
      "Free Tier": false,
    },
  },
  {
    name: "Rehearsal Pro",
    price: "$19.99",
    platform: "iOS, Android",
    features: {
      "AI Voices": false,
      "Emotion Detection": false,
      "Cue Mode": false,
      "Script Upload": true,
      "PDF Support": true,
      "OCR / Photo Scan": "partial",
      "Smart Parsing": "partial",
      "Multiplayer": false,
      "Video Calls": false,
      "Self-Tape Recording": true,
      "Teleprompter": true,
      "Performance Feedback": false,
      "Memorization Modes": true,
      "Keyboard Shortcuts": false,
      "Dark Mode": false,
      "PWA / Offline": false,
      "Cross-Platform": true,
      "Free Tier": false,
    },
  },
  {
    name: "RehearseNow",
    price: "$15 mo",
    platform: "Web",
    features: {
      "AI Voices": true,
      "Emotion Detection": false,
      "Cue Mode": true,
      "Script Upload": true,
      "PDF Support": true,
      "OCR / Photo Scan": false,
      "Smart Parsing": "partial",
      "Multiplayer": false,
      "Video Calls": false,
      "Self-Tape Recording": false,
      "Teleprompter": false,
      "Performance Feedback": false,
      "Memorization Modes": false,
      "Keyboard Shortcuts": false,
      "Dark Mode": false,
      "PWA / Offline": false,
      "Cross-Platform": true,
      "Free Tier": false,
    },
  },
  {
    name: "LineLearner",
    price: "Free / $5 mo",
    platform: "iOS, Android",
    features: {
      "AI Voices": true,
      "Emotion Detection": false,
      "Cue Mode": "partial",
      "Script Upload": true,
      "PDF Support": false,
      "OCR / Photo Scan": false,
      "Smart Parsing": "partial",
      "Multiplayer": false,
      "Video Calls": false,
      "Self-Tape Recording": false,
      "Teleprompter": false,
      "Performance Feedback": false,
      "Memorization Modes": true,
      "Keyboard Shortcuts": false,
      "Dark Mode": true,
      "PWA / Offline": false,
      "Cross-Platform": true,
      "Free Tier": true,
    },
  },
];

interface Workaround {
  icon: typeof Mic;
  name: string;
  description: string;
  drawbacks: string[];
}

const workarounds: Workaround[] = [
  {
    icon: Mic,
    name: "Record and playback",
    description: "Record other characters' lines yourself, leave gaps, play it back and rehearse over it.",
    drawbacks: ["Setup time for every scene", "Unnatural timing", "No feedback on accuracy"],
  },
  {
    icon: Users,
    name: "Ask a friend or partner",
    description: "Rope someone into reading opposite you. The classic approach.",
    drawbacks: ["Scheduling conflicts", "They get bored fast", "No emotional range"],
  },
  {
    icon: MessageCircle,
    name: "Text a scene partner online",
    description: "Find someone on Reddit, Discord, or Facebook groups to run lines over video call.",
    drawbacks: ["Unreliable availability", "Quality varies wildly", "Privacy concerns with scripts"],
  },
  {
    icon: PenLine,
    name: "Write lines by hand",
    description: "Copy out the script longhand to engage deeper memory. A classic stage technique.",
    drawbacks: ["Time-intensive", "No performance practice", "Doesn't train delivery"],
  },
  {
    icon: Headphones,
    name: "Listen on repeat",
    description: "Record the full scene, listen on a loop during commutes or walks.",
    drawbacks: ["Passive learning", "Doesn't practice active recall", "No cue timing"],
  },
  {
    icon: Smartphone,
    name: "Voice memos and Notes app",
    description: "The most common workaround. Stare at the script in Notes, record lines in Voice Memos.",
    drawbacks: ["Constant app switching", "No cue recognition", "No formatting or scene awareness"],
  },
  {
    icon: Video,
    name: "Self-tape with two devices",
    description: "Prop your phone up to record, read cue lines from a laptop or tablet.",
    drawbacks: ["Awkward eye-line", "Can't see the script and camera at once", "Clunky setup"],
  },
  {
    icon: Clock,
    name: "Speed-through in your head",
    description: "Recite lines silently or at speed to drill memorization before adding performance layers.",
    drawbacks: ["No vocal practice", "Misses emotional beats", "Easy to skip trouble spots"],
  },
];

function SupportIcon({ value }: { value: Support }) {
  if (value === true) return <Check className="h-3.5 w-3.5 text-green-500" />;
  if (value === "partial") return <Minus className="h-3.5 w-3.5 text-amber-500" />;
  return <X className="h-3.5 w-3.5 text-muted-foreground/30" />;
}

const freeTierFeatures = [
  "All core features",
  "ElevenLabs AI voices",
  "Multiplayer table reads",
  "Self-tape recording (watermark)",
  "Performance feedback",
  "No account required",
];

const proTierFeatures = [
  "Everything in Free",
  "Watermark-free recordings",
  "Cloud script library",
  "Performance history",
  "Saved recordings",
  "Priority support",
];

export function ComparePage({ onBack }: { onBack: () => void }) {
  const costarFeatureCount = Object.values(competitors[0].features).filter(v => v === true).length;

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

      <main className="flex-1 px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <section className="mb-12 animate-fade-in-up">
            <h2 className="text-lg font-semibold text-foreground mb-1" data-testid="text-section-workarounds">How actors rehearse today</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Before dedicated apps, actors pieced together workarounds. Most still do.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {workarounds.map((w, i) => (
                <div
                  key={w.name}
                  className="glass-surface rounded-md p-4 animate-fade-in-up"
                  style={{ animationDelay: `${(i + 1) * 50}ms` }}
                  data-testid={`card-workaround-${i}`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <w.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs font-semibold text-foreground" data-testid={`text-workaround-name-${i}`}>{w.name}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">{w.description}</p>
                  <div className="space-y-1">
                    {w.drawbacks.map((d) => (
                      <div key={d} className="flex items-start gap-1.5">
                        <X className="h-3 w-3 text-muted-foreground/40 mt-0.5 shrink-0" />
                        <span className="text-[10px] text-muted-foreground/70 leading-tight">{d}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 glass-surface rounded-md p-4" data-testid="card-workaround-summary">
              <p className="text-xs text-muted-foreground leading-relaxed">
                These methods work, but they're fragmented, time-consuming, and none give you a realistic scene partner who listens and responds. That's what co-star was built for.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-lg font-semibold text-foreground mb-1 animate-fade-in-up" data-testid="text-section-comparison">How we stack up</h2>
            <p className="text-sm text-muted-foreground mb-1 animate-fade-in-up" style={{ animationDelay: "50ms" }}>
              {costarFeatureCount} of {features.length} features. No other app comes close.
            </p>
            <p className="text-[11px] text-muted-foreground/70 mb-5 animate-fade-in-up" style={{ animationDelay: "75ms" }}>
              Scroll right to see all {competitors.length} competitors.
            </p>

            <div className="glass-surface rounded-md overflow-hidden animate-fade-in-up" style={{ animationDelay: "100ms" }} data-testid="comparison-table">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border/40">
                      <th className="text-xs font-medium text-muted-foreground px-3 py-3 sticky left-0 bg-background/80 backdrop-blur-sm min-w-[130px] z-10">
                        Feature
                      </th>
                      {competitors.map((comp) => (
                        <th
                          key={comp.name}
                          className={cn(
                            "text-xs font-semibold px-3 py-3 text-center min-w-[75px]",
                            comp.name === "co-star" ? "text-primary" : "text-foreground"
                          )}
                          data-testid={`text-competitor-${comp.name.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            {comp.name === "co-star" && (
                              <Crown className="h-3 w-3 text-primary mb-0.5" />
                            )}
                            <span className="whitespace-nowrap">{comp.name}</span>
                            <span className="text-[9px] font-normal text-muted-foreground whitespace-nowrap">{comp.price}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {features.map((feature, i) => (
                      <tr
                        key={feature.name}
                        className={cn(
                          "border-b border-border/20 last:border-0",
                          i % 2 === 0 && "bg-muted/20"
                        )}
                        data-testid={`row-feature-${feature.name.toLowerCase().replace(/\s+\/\s+/g, "-").replace(/\s+/g, "-")}`}
                      >
                        <td className="px-3 py-2 sticky left-0 bg-inherit z-10">
                          <span className="text-[11px] font-medium text-foreground block">{feature.name}</span>
                          <span className="text-[9px] text-muted-foreground block leading-tight">{feature.description}</span>
                        </td>
                        {competitors.map((comp) => (
                          <td key={comp.name} className={cn(
                            "px-3 py-2 text-center",
                            comp.name === "co-star" && "bg-primary/[0.03]"
                          )}>
                            <SupportIcon value={comp.features[feature.name]} />
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="border-t border-border/40">
                      <td className="px-3 py-2 sticky left-0 bg-background/80 backdrop-blur-sm z-10">
                        <span className="text-[11px] font-medium text-muted-foreground">Platform</span>
                      </td>
                      {competitors.map((comp) => (
                        <td key={comp.name} className="px-3 py-2 text-center">
                          <span className="text-[9px] text-muted-foreground">{comp.platform}</span>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="px-3 py-2 border-t border-border/40 flex items-center gap-4 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Check className="h-3 w-3 text-green-500" />
                  <span>Full support</span>
                </div>
                <div className="flex items-center gap-1">
                  <Minus className="h-3 w-3 text-amber-500" />
                  <span>Partial</span>
                </div>
                <div className="flex items-center gap-1">
                  <X className="h-3 w-3 text-muted-foreground/30" />
                  <span>Not available</span>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-1 animate-fade-in-up" style={{ animationDelay: "200ms" }} data-testid="text-section-pricing">
              Pricing
            </h2>
            <p className="text-sm text-muted-foreground mb-6 animate-fade-in-up" style={{ animationDelay: "250ms" }}>
              Start free with every feature. Upgrade when you want persistence.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                className="glass-surface rounded-md p-5 animate-fade-in-up"
                style={{ animationDelay: "300ms" }}
                data-testid="card-pricing-free"
              >
                <div className="mb-1">
                  <span className="text-base font-semibold text-foreground">Free</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">No account needed. Jump right in.</p>
                <div className="space-y-2">
                  {freeTierFeatures.map((f) => (
                    <div key={f} className="flex items-center gap-2" data-testid={`text-free-feature-${f.toLowerCase().replace(/\s+/g, "-").slice(0, 30)}`}>
                      <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      <span className="text-xs text-muted-foreground">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div
                className="glass-surface rounded-md p-5 ring-2 ring-primary animate-fade-in-up"
                style={{ animationDelay: "400ms" }}
                data-testid="card-pricing-pro"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base font-semibold text-foreground">Pro</span>
                  <Badge variant="default" className="no-default-hover-elevate text-[10px]">
                    <Crown className="h-2.5 w-2.5 mr-1" />
                    Best value
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  <span className="text-foreground font-semibold">$9/mo</span> or <span className="text-foreground font-semibold">$69/year</span>
                  <span className="text-green-600 ml-1">(save 36%)</span>
                </p>
                <div className="space-y-2">
                  {proTierFeatures.map((f) => (
                    <div key={f} className="flex items-center gap-2" data-testid={`text-pro-feature-${f.toLowerCase().replace(/\s+/g, "-").slice(0, 30)}`}>
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-xs text-muted-foreground">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="px-5 py-6 pb-8 safe-bottom" />
    </div>
  );
}
