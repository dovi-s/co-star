import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  Check,
  X,
  Minus,
  Crown,
  ArrowRight,
  GraduationCap,
  Building2,
  Mail,
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
  { name: "Voices", description: "Natural text-to-speech for scene partners" },
  { name: "Emotion Detection", description: "Reads tone from script context and stage directions" },
  { name: "Cue Mode", description: "Listens and waits for your lines" },
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
    name: "Co-star Studio",
    price: "Free / $9 mo / $79 yr",
    platform: "Web, PWA",
    features: {
      "Voices": true,
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
      "Voices": true,
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
      "Voices": true,
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
      "Voices": false,
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
      "Voices": false,
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
      "Voices": false,
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
      "Voices": true,
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
      "Voices": true,
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
  method: string;
  reality: string;
}

const workarounds: Workaround[] = [
  {
    method: "Ask a friend to read with you",
    reality: "They're busy, they're bored by take three, and they can't do accents",
  },
  {
    method: "Record the other lines yourself",
    reality: "Twenty minutes of setup for each scene, and the timing never feels right",
  },
  {
    method: "Stare at your phone in Notes",
    reality: "No cue recognition, no scene awareness, constant app-switching to Voice Memos",
  },
  {
    method: "Find a reader on Reddit or Discord",
    reality: "Unreliable, inconsistent quality, and you're sharing unreleased sides with strangers",
  },
  {
    method: "Prop up two devices for a self-tape",
    reality: "Awkward eye-line, can't see the script and the camera at the same time",
  },
  {
    method: "Write lines out by hand",
    reality: "Great for memorization, but it doesn't train delivery, timing, or performance",
  },
];

function SupportIcon({ value }: { value: Support }) {
  if (value === true) return <Check className="h-3.5 w-3.5 text-green-500" />;
  if (value === "partial") return <Minus className="h-3.5 w-3.5 text-amber-500" />;
  return <X className="h-3.5 w-3.5 text-muted-foreground" />;
}

const freeTierFeatures = [
  "3 rehearsals per day",
  "All voice presets",
  "Performance feedback",
  "Multiplayer table reads",
  "Dark and light mode",
  "Keyboard shortcuts",
];

const proTierFeatures = [
  "Unlimited script rehearsals",
  "Cloud script library",
  "Watermark-free recordings",
  "Performance tracking over time",
  "Hands-free rehearsal mode",
  "Priority support",
];

export function ComparePage({ onBack }: { onBack: () => void }) {
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
        <h1 className="font-semibold text-sm text-foreground">Compare & Pricing</h1>
      </header>
      <main className="flex-1 px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <section className="mb-12 animate-fade-in-up">
            <h2 className="text-lg font-semibold text-foreground mb-1" data-testid="text-section-workarounds">Sound familiar?</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Actors have always pieced together workarounds to rehearse. Most still do.
            </p>

            <div className="glass-surface rounded-lg overflow-hidden" data-testid="list-workarounds">
              {workarounds.map((w, i) => (
                <div
                  key={w.method}
                  className={cn(
                    "px-4 py-3",
                    i < workarounds.length - 1 && "border-b border-border/20"
                  )}
                  data-testid={`card-workaround-${i}`}
                >
                  <p className="text-xs font-medium text-foreground mb-0.5" data-testid={`text-workaround-name-${i}`}>{w.method}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{w.reality}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 glass-surface rounded-lg p-4 flex items-start gap-3" data-testid="card-workaround-summary">
              <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-foreground leading-relaxed">
                <span className="font-semibold">Co-star Studio replaces all of this.</span>
                <span className="text-muted-foreground"> Paste your script, pick your role, and start rehearsing with a scene partner who listens, responds, and reads with emotion. No setup. No scheduling. No second device.</span>
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-lg font-semibold text-foreground mb-1 animate-fade-in-up" data-testid="text-section-comparison">How we stack up</h2>
            <p className="text-sm text-muted-foreground mb-5 animate-fade-in-up" style={{ animationDelay: "50ms" }}>
              Most apps do one thing well. Co-star Studio does all of them.
            </p>

            <div className="glass-surface rounded-lg overflow-hidden animate-fade-in-up" style={{ animationDelay: "100ms" }} data-testid="comparison-table">
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
                            comp.name === "Co-star Studio" ? "text-primary" : "text-foreground"
                          )}
                          data-testid={`text-competitor-${comp.name.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            {comp.name === "Co-star Studio" && (
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
                            comp.name === "Co-star Studio" && "bg-primary/[0.03]"
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
                  <X className="h-3 w-3 text-muted-foreground" />
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
              Start with a 7-day guest pass. Keep what works for you.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                className="glass-surface rounded-lg p-5 animate-fade-in-up"
                style={{ animationDelay: "300ms" }}
                data-testid="card-pricing-free"
              >
                <div className="mb-1">
                  <span className="text-base font-semibold text-foreground">Free</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">Get started and rehearse for free.</p>
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
                className="glass-surface rounded-lg p-5 ring-2 ring-primary animate-fade-in-up"
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
                <p className="text-xs text-muted-foreground mb-1">
                  <span className="text-foreground font-semibold text-lg">$9</span><span className="text-muted-foreground">/mo</span>
                  <span className="mx-1.5 text-muted-foreground"> or </span>
                  <span className="text-foreground font-semibold text-lg">$79</span><span className="text-muted-foreground">/yr</span>
                  <span className="text-green-600 ml-1 text-[11px]">(save 27%)</span>
                </p>
                <p className="text-[11px] text-primary font-medium mb-4">Try free for 7 days</p>
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

            <div className="mt-6 space-y-4">
              <p className="text-xs text-muted-foreground text-center">Need something bigger?</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  className="glass-surface rounded-lg p-5 space-y-4 animate-fade-in-up"
                  style={{ animationDelay: "500ms" }}
                  data-testid="card-pricing-education"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <GraduationCap className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold" data-testid="text-education-title">Education</h3>
                      <p className="text-[11px] text-muted-foreground" data-testid="text-education-description">Drama programs, universities, language courses</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[
                      "Bulk seats for students and faculty",
                      "Shared script library for classes",
                      "Usage analytics per student",
                      "Academic pricing available",
                    ].map((f) => (
                      <div key={f} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                        <span className="text-xs text-muted-foreground">{f}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.location.href = "mailto:hello@co-star.app?subject=Education%20Plan%20Inquiry"}
                    data-testid="button-contact-education"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Contact us
                  </Button>
                </div>

                <div
                  className="glass-surface rounded-lg p-5 space-y-4 animate-fade-in-up"
                  style={{ animationDelay: "600ms" }}
                  data-testid="card-pricing-teams"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold" data-testid="text-teams-title">Teams</h3>
                      <p className="text-[11px] text-muted-foreground" data-testid="text-teams-description">Sales, corporate training, medical programs</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[
                      "Team management and seat allocation",
                      "Custom script templates",
                      "Team-wide performance analytics",
                      "Priority onboarding and support",
                    ].map((f) => (
                      <div key={f} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                        <span className="text-xs text-muted-foreground">{f}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.location.href = "mailto:hello@co-star.app?subject=Teams%20Plan%20Inquiry"}
                    data-testid="button-contact-teams"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Contact us
                  </Button>
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
