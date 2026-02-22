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
  Camera,
  Brain,
  Keyboard,
  BookOpen,
  Layers,
  Bookmark,
  Globe,
  Smartphone,
  Wifi,
  Lightbulb,
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
  { title: "Solo Rehearsal", description: "Run scenes with co-star reading every other part.", icon: Mic, status: "live" },
  { title: "Voices", description: "Six realistic ElevenLabs voices with emotion detection and SSML prosody.", icon: Volume2, status: "live" },
  { title: "Script Import", description: "Paste text, upload PDF/TXT, or snap a photo. Built-in OCR for scanned scripts.", icon: FileUp, status: "live" },
  { title: "Smart Parsing", description: "Automatic character detection, stage directions, scene breaks, and action line context.", icon: Layers, status: "live" },
  { title: "Three-Line Reader", description: "Previous, current, and next lines with visual cues for your turns.", icon: BookOpen, status: "live" },
  { title: "Performance Feedback", description: "Word accuracy tracking, skip detection, and color-coded results after each run.", icon: BarChart3, status: "live" },
  { title: "Line Memorization", description: "Four progressive levels: Full, Partial, Cue, and Memory.", icon: Brain, status: "live" },
  { title: "Self-Tape Recording", description: "Record with front camera and watermark. Audio-only mode when camera is off.", icon: Video, status: "live" },
  { title: "Audition Mode", description: "Dark translucent UI with glassmorphic styling when camera is active.", icon: Camera, status: "live" },
  { title: "Multiplayer Table Read", description: "Real-time remote rehearsals with WebSocket rooms, host controls, and role selection.", icon: Users, status: "live" },
  { title: "Video Calls", description: "Peer-to-peer WebRTC video and audio during table reads with speaker highlighting.", icon: Wifi, status: "live" },
  { title: "Keyboard Shortcuts", description: "Space, arrows, R to repeat, Escape to stop. Full keyboard control.", icon: Keyboard, status: "live" },
  { title: "Bookmarks", description: "Mark and return to specific lines during rehearsal.", icon: Bookmark, status: "live" },
  { title: "PWA Ready", description: "Install as an app on any device. Offline support with service worker.", icon: Smartphone, status: "live" },
  { title: "Dark and Light Mode", description: "System-aware theme with Liquid Glass design throughout.", icon: Globe, status: "live" },
  { title: "Actor Profiles", description: "Set your headshot, name, and preferences.", icon: User, status: "in-progress" },
  { title: "Accounts and Auth", description: "Sign up with Google, Apple, or email. Sync across devices.", icon: User, status: "in-progress" },
  { title: "Cloud Script Library", description: "Save and organize scripts that persist between sessions.", icon: Cloud, status: "in-progress" },
  { title: "Pro Subscription", description: "$9/mo or $69/yr for watermark-free recordings, saved scripts, and history.", icon: CreditCard, status: "in-progress" },
  { title: "Scene Library", description: "Browse and rehearse from a curated collection of monologues and scenes.", icon: Library, status: "coming-soon" },
  { title: "Performance Analytics", description: "Track your accuracy, pace, and growth over time with detailed charts.", icon: TrendingUp, status: "coming-soon" },
  { title: "Services Directory", description: "Find acting coaches, readers, and industry professionals.", icon: Briefcase, status: "coming-soon" },
  { title: "Casting Board", description: "Discover open casting calls and submit self-tapes directly.", icon: Theater, status: "coming-soon" },
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

export function RoadmapPage({ onBack, onNavigate }: { onBack: () => void; onNavigate?: (page: string) => void }) {
  let animIndex = 0;

  const liveCount = items.filter(i => i.status === "live").length;
  const inProgressCount = items.filter(i => i.status === "in-progress").length;
  const totalCount = items.length;
  const completedPercent = Math.round((liveCount / totalCount) * 100);

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
          <div className="mb-8 animate-fade-in-up" data-testid="roadmap-progress">
            <div className="glass-surface rounded-md p-4">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm font-semibold text-foreground">Overall progress</span>
                <span className="text-xs text-muted-foreground">{completedPercent}% shipped</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden mb-3">
                <div
                  className="h-full rounded-full bg-green-600 transition-all duration-500"
                  style={{ width: `${completedPercent}%` }}
                  data-testid="progress-bar-shipped"
                />
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5" data-testid="stat-live">
                  <span className="w-2 h-2 rounded-full bg-green-600" />
                  <span>{liveCount} live</span>
                </div>
                <div className="flex items-center gap-1.5" data-testid="stat-in-progress">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span>{inProgressCount} in progress</span>
                </div>
                <div className="flex items-center gap-1.5" data-testid="stat-coming-soon">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                  <span>{totalCount - liveCount - inProgressCount} planned</span>
                </div>
              </div>
            </div>
          </div>

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
                          <div className={cn(
                            "flex items-center justify-center w-9 h-9 rounded-md shrink-0",
                            item.status === "live" ? "bg-green-600/10 text-green-600" :
                            item.status === "in-progress" ? "bg-primary/10 text-primary" :
                            "bg-muted text-muted-foreground"
                          )}>
                            <item.icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-foreground">{item.title}</span>
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
        <p className="text-xs text-muted-foreground mb-3">
          Vote on what we build next, or suggest something new.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate?.("feature-board")}
          data-testid="button-feature-board"
        >
          <Lightbulb className="h-3.5 w-3.5 mr-1.5" />
          Open Feature Board
        </Button>
      </footer>
    </div>
  );
}
