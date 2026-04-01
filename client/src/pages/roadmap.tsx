import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Mic,
  Volume2,
  FileUp,
  Users,
  Video,
  BarChart3,
  User,
  CreditCard,
  Library,
  TrendingUp,
  Briefcase,
  Theater,
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
  Car,
  Hand,
  Lock,
  Save,
  Trophy,
  Clock,
  Search,
  Eye,
  Accessibility,
  Sparkles,
  Timer,
  Map,
  Plus,
  Flame,
  Send,
  X,
  Zap,
  Star,
  Rocket,
  Bug,
  MoreHorizontal,
  EyeOff,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type RoadmapTab = "roadmap" | "whats-new" | "ideas";

type Status = "live" | "in-progress" | "coming-soon";

interface RoadmapItem {
  title: string;
  description: string;
  icon: typeof Mic;
  status: Status;
}

const roadmapItems: RoadmapItem[] = [
  { title: "Solo Rehearsal", description: "Run scenes with your scene partner reading every other part.", icon: Mic, status: "live" },
  { title: "Voices", description: "Six realistic ElevenLabs voices with emotion detection and SSML prosody.", icon: Volume2, status: "live" },
  { title: "Script Import", description: "Paste text, upload PDF/TXT, or snap a photo. Built-in OCR for scanned scripts.", icon: FileUp, status: "live" },
  { title: "Smart Parsing", description: "Automatic character detection, stage directions, scene breaks, and action line context.", icon: Layers, status: "live" },
  { title: "Three-Line Reader", description: "Previous, current, and next lines with visual cues for your turns.", icon: BookOpen, status: "live" },
  { title: "Speech Recognition", description: "Hands-free line delivery with automatic word matching and silence detection.", icon: Mic, status: "live" },
  { title: "Performance Feedback", description: "Word accuracy tracking, skip detection, and color-coded results after each run.", icon: BarChart3, status: "live" },
  { title: "Rehearsal History", description: "Track every run with accuracy grades, trends, and performance comparisons over time.", icon: Clock, status: "live" },
  { title: "Line Memorization", description: "Four progressive levels: Full, Partial, Cue, and Memory.", icon: Brain, status: "live" },
  { title: "LINE Voice Command", description: "Say \"line\" during your turn to get a whispered hint of your next words.", icon: Hand, status: "live" },
  { title: "Hands-Free Mode", description: "Audio-only rehearsal with auto-play, auto-restart, and screen wake lock.", icon: Car, status: "live" },
  { title: "Self-Tape Recording", description: "Record with front camera and watermark. Audio-only mode when camera is off.", icon: Video, status: "live" },
  { title: "Audition Mode", description: "Dark translucent UI with glassmorphic styling when camera is active.", icon: Camera, status: "live" },
  { title: "Context Peek", description: "View stage directions and action lines preceding any line of dialogue.", icon: Eye, status: "live" },
  { title: "Jump to Line", description: "Search and jump to any line or scene in your script instantly.", icon: Search, status: "live" },
  { title: "Scene Transitions", description: "Visual scene cards with descriptions when advancing between scenes.", icon: Sparkles, status: "live" },
  { title: "Achievements and Streaks", description: "Earn milestones for consistency, line counts, and daily practice goals.", icon: Trophy, status: "live" },
  { title: "Countdown Timer", description: "Professional 3-2-1 countdown before recording begins.", icon: Timer, status: "live" },
  { title: "Multiplayer Table Read", description: "Real-time remote rehearsals with WebSocket rooms, host controls, and role selection.", icon: Users, status: "live" },
  { title: "Video Calls", description: "Peer-to-peer WebRTC video and audio during table reads with speaker highlighting.", icon: Wifi, status: "live" },
  { title: "Accounts and Auth", description: "Email, password, and Google Sign-In with secure sessions and password recovery.", icon: Lock, status: "live" },
  { title: "Actor Profiles", description: "Onboarding wizard with headshot, stage name, physical attributes, and union status.", icon: User, status: "live" },
  { title: "Cloud Script Library", description: "Save scripts to your account and pick up where you left off.", icon: Save, status: "live" },
  { title: "Pro Subscription", description: "$9/mo or $79/yr for watermark-free recordings, saved scripts, and history.", icon: CreditCard, status: "live" },
  { title: "Feature Board", description: "Vote on features and suggest new ideas to shape the product.", icon: Lightbulb, status: "live" },
  { title: "Keyboard Shortcuts", description: "Space, arrows, R to repeat, Escape to stop. Full keyboard control.", icon: Keyboard, status: "live" },
  { title: "Bookmarks", description: "Mark and return to specific lines during rehearsal.", icon: Bookmark, status: "live" },
  { title: "Accessibility", description: "Screen reader support, keyboard navigation, WCAG AA contrast, and skip-to-content.", icon: Accessibility, status: "live" },
  { title: "PWA Ready", description: "Install as an app on any device. Offline support with service worker.", icon: Smartphone, status: "live" },
  { title: "Dark and Light Mode", description: "System-aware theme with Liquid Glass design throughout.", icon: Globe, status: "live" },
  { title: "Scene Library", description: "Browse and rehearse from a curated collection of monologues and scenes.", icon: Library, status: "coming-soon" },
  { title: "Performance Analytics", description: "Detailed charts tracking accuracy, pace, and growth trends over time.", icon: TrendingUp, status: "coming-soon" },
  { title: "Services Directory", description: "Find acting coaches, readers, and industry professionals.", icon: Briefcase, status: "coming-soon" },
  { title: "Casting Board", description: "Discover open casting calls and submit self-tapes directly.", icon: Theater, status: "coming-soon" },
];

const statusConfig: Record<Status, { label: string; className: string }> = {
  "live": { label: "Live", className: "bg-green-600 text-white border-transparent" },
  "in-progress": { label: "In Progress", className: "bg-primary text-primary-foreground border-transparent" },
  "coming-soon": { label: "Coming Soon", className: "bg-muted text-muted-foreground border-transparent" },
};

const statusGroups: { status: Status; title: string }[] = [
  { status: "live", title: "Live Now" },
  { status: "in-progress", title: "In Progress" },
  { status: "coming-soon", title: "Coming Soon" },
];

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

interface FeatureRequestItem {
  id: string;
  userId: string;
  authorName: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string | null;
  voteCount: number | null;
  createdAt: string;
  userVote: number;
}

type SortMode = "top" | "newest";

const featureCategoryLabels: Record<string, string> = {
  general: "General",
  rehearsal: "Rehearsal",
  voices: "Voices",
  scripts: "Scripts",
  recording: "Recording",
  multiplayer: "Table Read",
  ux: "UX",
  other: "Other",
};

const featureStatusLabels: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  planned: { label: "Planned", className: "bg-primary/10 text-primary border-primary/20" },
  "in-progress": { label: "In Progress", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  shipped: { label: "Shipped!", className: "bg-green-500/10 text-green-600 border-green-500/20" },
  declined: { label: "Declined", className: "bg-muted text-muted-foreground border-border" },
};

export function RoadmapPage({ onBack, initialTab = "roadmap" }: { onBack: () => void; initialTab?: RoadmapTab }) {
  const [tab, setTab] = useState<RoadmapTab>(initialTab);

  const tabs: { id: RoadmapTab; label: string; icon: typeof Map }[] = [
    { id: "roadmap", label: "Roadmap", icon: Map },
    { id: "whats-new", label: "What's New", icon: Sparkles },
    { id: "ideas", label: "Ideas", icon: Lightbulb },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="roadmap-page">
      <header className="sticky top-0 z-50 glass-surface safe-top rounded-none">
        <div className="flex items-center gap-3 px-4 py-3">
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
          <h1 className="font-semibold text-sm text-foreground">Product</h1>
        </div>
        <div className="flex px-4 pb-1 gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors",
                tab === t.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              data-testid={`tab-${t.id}`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1">
        {tab === "roadmap" && <RoadmapContent />}
        {tab === "whats-new" && <WhatsNewContent />}
        {tab === "ideas" && <IdeasContent />}
      </main>
    </div>
  );
}

function RoadmapContent() {
  let animIndex = 0;
  const liveCount = roadmapItems.filter(i => i.status === "live").length;
  const inProgressCount = roadmapItems.filter(i => i.status === "in-progress").length;
  const totalCount = roadmapItems.length;
  const completedPercent = Math.round((liveCount / totalCount) * 100);

  return (
    <div className="px-5 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 animate-fade-in-up" data-testid="roadmap-progress">
          <div className="glass-surface rounded-lg p-4">
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

        {statusGroups.map((group) => {
          const groupItems = roadmapItems.filter((item) => item.status === group.status);
          if (groupItems.length === 0) return null;
          const config = statusConfig[group.status];

          return (
            <div key={group.status} className="mb-6 last:mb-0">
              <div className="flex items-center gap-2 mb-3 animate-fade-in-up" style={{ animationDelay: `${animIndex++ * 80}ms` }}>
                <h2 className="text-base font-semibold text-foreground">{group.title}</h2>
                <Badge className={cn("no-default-hover-elevate", config.className)}>
                  {groupItems.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {groupItems.map((item) => {
                  const delay = animIndex++ * 80;
                  return (
                    <div
                      key={item.title}
                      className="glass-surface rounded-lg p-3 animate-fade-in-up transition-shadow duration-200 hover:shadow-md"
                      style={{ animationDelay: `${delay}ms` }}
                      data-testid={`card-roadmap-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-md shrink-0",
                          item.status === "live" ? "bg-green-600/10 text-green-600" :
                          item.status === "in-progress" ? "bg-primary/10 text-primary" :
                          "bg-muted text-muted-foreground"
                        )}>
                          <item.icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-foreground">{item.title}</span>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
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
    </div>
  );
}

function WhatsNewContent() {
  const { data: entries = [], isLoading } = useQuery<ChangelogEntry[]>({
    queryKey: ["/api/changelog"],
  });

  return (
    <div className="px-5 py-6">
      <div className="max-w-2xl mx-auto space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-lg border border-border/50 p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-full mb-1" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <Sparkles className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No updates yet</p>
            <p className="text-xs text-muted-foreground">Check back soon for the latest improvements.</p>
          </div>
        ) : (
          entries.map((entry) => {
            const cat = categoryConfig[entry.category] || categoryConfig.feature;
            const CatIcon = cat.icon;
            return (
              <div key={entry.id} className="glass-surface rounded-lg p-4" data-testid={`changelog-entry-${entry.id}`}>
                <div className="flex items-start gap-3">
                  <div className={cn("w-8 h-8 rounded-md flex items-center justify-center shrink-0", cat.color)}>
                    <CatIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-medium text-foreground">{entry.title}</span>
                      {entry.version && (
                        <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">v{entry.version}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{entry.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", cat.color)}>{cat.label}</span>
                      <span className="text-[10px] text-muted-foreground">{formatDate(entry.publishedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function IdeasContent() {
  const [sort, setSort] = useState<SortMode>("top");
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery<{ requests: FeatureRequestItem[]; isAdmin?: boolean }>({
    queryKey: ["/api/features", `?sort=${sort}`],
  });

  const requests = data?.requests || [];
  const adminMode = data?.isAdmin || false;

  return (
    <div className="px-5 py-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSort("top")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                sort === "top" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              )}
              data-testid="button-sort-top"
            >
              <Flame className="h-3.5 w-3.5" />
              Top
            </button>
            <button
              onClick={() => setSort("newest")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                sort === "newest" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              )}
              data-testid="button-sort-newest"
            >
              <Clock className="h-3.5 w-3.5" />
              Newest
            </button>
          </div>
          <Button
            size="sm"
            onClick={() => setShowForm(true)}
            disabled={showForm}
            data-testid="button-new-request"
            className="shrink-0"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Request
          </Button>
        </div>

        {showForm && <NewRequestForm onClose={() => setShowForm(false)} />}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-surface rounded-lg p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-6 h-16 bg-muted rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-muted rounded" />
                    <div className="h-3 w-full bg-muted rounded" />
                    <div className="h-3 w-1/3 bg-muted rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lightbulb className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-sm font-semibold text-foreground mb-1">No requests yet</h2>
            <p className="text-xs text-muted-foreground max-w-[240px] mb-4">
              Be the first to suggest a feature. What would make Co-star Studio better for you?
            </p>
            <Button size="sm" onClick={() => setShowForm(true)} data-testid="button-first-request">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Post a request
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((item) => (
              <RequestCard key={item.id} item={item} isAdmin={adminMode} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RequestCard({ item, isAdmin }: { item: FeatureRequestItem; isAdmin: boolean }) {
  const { isAuthenticated } = useAuth();
  const statusConf = featureStatusLabels[item.status || "open"] || featureStatusLabels.open;

  const voteMutation = useMutation({
    mutationFn: async (direction: "up" | "down") => {
      const res = await apiRequest("POST", `/api/features/${item.id}/vote`, { direction });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/features"] }),
  });

  const adminMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const res = await apiRequest("PATCH", `/api/features/${item.id}`, updates);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/features"] }),
  });

  return (
    <div className="glass-surface rounded-lg p-3" data-testid={`card-feature-${item.id}`}>
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={() => isAuthenticated && voteMutation.mutate("up")}
            className={cn("p-1 rounded transition-colors", item.userVote > 0 ? "text-primary" : "text-muted-foreground hover:text-foreground")}
            disabled={!isAuthenticated}
            data-testid={`vote-up-${item.id}`}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold" data-testid={`vote-count-${item.id}`}>{item.voteCount || 0}</span>
          <button
            onClick={() => isAuthenticated && voteMutation.mutate("down")}
            className={cn("p-1 rounded transition-colors", item.userVote < 0 ? "text-destructive" : "text-muted-foreground hover:text-foreground")}
            disabled={!isAuthenticated}
            data-testid={`vote-down-${item.id}`}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">{item.title}</span>
            <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5 no-default-hover-elevate", statusConf.className)}>
              {statusConf.label}
            </Badge>
          </div>
          {item.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
            <span>{item.authorName}</span>
            <span>·</span>
            <span>{formatDate(item.createdAt)}</span>
            {item.category && (
              <>
                <span>·</span>
                <span>{featureCategoryLabels[item.category] || item.category}</span>
              </>
            )}
          </div>
        </div>
        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {["open", "planned", "in-progress", "shipped", "declined"].map(s => (
                <DropdownMenuItem key={s} onClick={() => adminMutation.mutate({ status: s })}>
                  {featureStatusLabels[s]?.label || s}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => adminMutation.mutate({ hidden: true })} className="text-muted-foreground">
                <EyeOff className="h-3.5 w-3.5 mr-2" />
                Hide
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => adminMutation.mutate({ deleted: true })} className="text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

function NewRequestForm({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/features", { title, description: description || undefined, category });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/features"] });
      onClose();
    },
  });

  return (
    <div className="glass-surface rounded-lg p-4 space-y-3" data-testid="new-request-form">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">New request</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <input
        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground"
        placeholder="Feature title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        data-testid="input-feature-title"
      />
      <Textarea
        placeholder="Describe the feature (optional)"
        value={description}
        onChange={e => setDescription(e.target.value)}
        className="min-h-[60px] text-sm"
        data-testid="input-feature-description"
      />
      <div className="flex gap-1.5 flex-wrap">
        {Object.entries(featureCategoryLabels).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setCategory(key)}
            className={cn(
              "px-2 py-1 rounded text-[11px] font-medium transition-colors",
              category === key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground bg-muted/50"
            )}
            data-testid={`category-${key}`}
          >
            {label}
          </button>
        ))}
      </div>
      <Button
        size="sm"
        className="w-full"
        onClick={() => submitMutation.mutate()}
        disabled={!title.trim() || submitMutation.isPending}
        data-testid="button-submit-request"
      >
        <Send className="h-3.5 w-3.5 mr-1.5" />
        {submitMutation.isPending ? "Posting..." : "Post request"}
      </Button>
    </div>
  );
}
