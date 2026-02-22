import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  Mic,
  Volume2,
  FileUp,
  Users,
  Video,
  BarChart3,
  User,
  Cloud,
  CreditCard,
  Library,
  TrendingUp,
  Briefcase,
  Theater,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "live" | "in-progress" | "coming-soon";

interface RoadmapItem {
  title: string;
  description: string;
  icon: typeof Mic;
  status: Status;
}

const items: RoadmapItem[] = [
  { title: "Solo Rehearsal", description: "Run scenes with AI reading every other part.", icon: Mic, status: "live" },
  { title: "AI Voices (ElevenLabs)", description: "Realistic character voices powered by ElevenLabs.", icon: Volume2, status: "live" },
  { title: "Script Upload & OCR", description: "Upload PDFs, photos, or paste text — we parse it all.", icon: FileUp, status: "live" },
  { title: "Multiplayer Table Read", description: "Read with friends or cast members in real time.", icon: Users, status: "live" },
  { title: "Self-Tape Recording", description: "Record your performance with picture-in-picture camera.", icon: Video, status: "live" },
  { title: "Performance Feedback", description: "Get AI-powered notes on delivery, pacing, and emotion.", icon: BarChart3, status: "live" },
  { title: "Actor Profiles", description: "Save your headshot, resume, and preferences.", icon: User, status: "in-progress" },
  { title: "Cloud Script Library", description: "Store and organize scripts across devices.", icon: Cloud, status: "in-progress" },
  { title: "Subscription System", description: "Pro tier with premium features and no watermarks.", icon: CreditCard, status: "in-progress" },
  { title: "Scene Library", description: "Browse and rehearse from a curated collection of scenes.", icon: Library, status: "coming-soon" },
  { title: "Performance Analytics", description: "Track progress over time with detailed metrics.", icon: TrendingUp, status: "coming-soon" },
  { title: "Services Directory", description: "Find coaches, readers, and industry professionals.", icon: Briefcase, status: "coming-soon" },
  { title: "Casting Board", description: "Discover open casting calls and submit self-tapes.", icon: Theater, status: "coming-soon" },
];

const statusConfig: Record<Status, { label: string; className: string }> = {
  "live": { label: "Live", className: "bg-green-600 text-white border-transparent" },
  "in-progress": { label: "In Progress", className: "bg-primary text-primary-foreground border-transparent" },
  "coming-soon": { label: "Coming Soon", className: "bg-muted text-muted-foreground border-transparent" },
};

const groups: { status: Status; title: string }[] = [
  { status: "live", title: "Live Now" },
  { status: "in-progress", title: "In Progress" },
  { status: "coming-soon", title: "Coming Soon" },
];

export function RoadmapPage({ onBack }: { onBack: () => void }) {
  let animIndex = 0;

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
        <h1 className="font-semibold text-sm text-foreground">Roadmap</h1>
      </header>

      <main className="flex-1 px-5 py-8">
        <div className="max-w-lg mx-auto">
          {groups.map((group) => {
            const groupItems = items.filter((item) => item.status === group.status);
            const config = statusConfig[group.status];

            return (
              <div key={group.status} className="mb-8 last:mb-0">
                <div className="flex items-center gap-2 mb-4 animate-fade-in-up" style={{ animationDelay: `${animIndex++ * 80}ms` }}>
                  <h2 className="text-lg font-semibold text-foreground">{group.title}</h2>
                  <Badge className={cn("no-default-hover-elevate", config.className)}>
                    {groupItems.length}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {groupItems.map((item) => {
                    const delay = animIndex++ * 80;
                    return (
                      <div
                        key={item.title}
                        className="glass-surface rounded-md p-4 animate-fade-in-up"
                        style={{ animationDelay: `${delay}ms` }}
                        data-testid={`card-roadmap-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 text-primary shrink-0">
                            <item.icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-foreground">{item.title}</span>
                              <Badge variant="secondary" className={cn("no-default-hover-elevate text-[10px]", config.className)}>
                                {config.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="px-5 py-8 text-center border-t border-border/40 safe-bottom">
        <div className="flex items-center justify-center gap-2 mb-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Have a feature request?</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Reach out at{" "}
          <a
            href="mailto:hello@co-star.app"
            className="text-primary underline"
            data-testid="link-support-email"
          >
            hello@co-star.app
          </a>
        </p>
      </footer>
    </div>
  );
}
