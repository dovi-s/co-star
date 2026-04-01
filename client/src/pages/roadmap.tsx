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
  MoreHorizontal,
  EyeOff,
  Trash2,
  CheckCircle2,
  Circle,
  ChevronDown as ChevronDownIcon,
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

const upNext: RoadmapItem[] = [
  { title: "Scene Library", description: "Browse and rehearse from a curated collection of monologues and scenes.", icon: Library, status: "coming-soon" },
  { title: "Performance Analytics", description: "Detailed charts tracking accuracy, pace, and growth trends over time.", icon: TrendingUp, status: "coming-soon" },
  { title: "Services Directory", description: "Find acting coaches, readers, and industry professionals.", icon: Briefcase, status: "coming-soon" },
  { title: "Casting Board", description: "Discover open casting calls and submit self-tapes directly.", icon: Theater, status: "coming-soon" },
];

const shipped: { title: string; icon: typeof Mic }[] = [
  { title: "Solo Rehearsal", icon: Mic },
  { title: "ElevenLabs Voices", icon: Volume2 },
  { title: "Script Import", icon: FileUp },
  { title: "Smart Parsing", icon: Layers },
  { title: "Three-Line Reader", icon: BookOpen },
  { title: "Speech Recognition", icon: Mic },
  { title: "Performance Feedback", icon: BarChart3 },
  { title: "Rehearsal History", icon: Clock },
  { title: "Line Memorization", icon: Brain },
  { title: "LINE Voice Command", icon: Hand },
  { title: "Hands-Free Mode", icon: Car },
  { title: "Self-Tape Recording", icon: Video },
  { title: "Audition Mode", icon: Camera },
  { title: "Context Peek", icon: Eye },
  { title: "Jump to Line", icon: Search },
  { title: "Scene Transitions", icon: Sparkles },
  { title: "Achievements", icon: Trophy },
  { title: "Table Read", icon: Users },
  { title: "Video Calls", icon: Wifi },
  { title: "Actor Profiles", icon: User },
  { title: "Cloud Library", icon: Save },
  { title: "Pro Subscription", icon: CreditCard },
  { title: "Keyboard Shortcuts", icon: Keyboard },
  { title: "Bookmarks", icon: Bookmark },
  { title: "Accessibility", icon: Accessibility },
  { title: "PWA / Offline", icon: Smartphone },
  { title: "Dark / Light Mode", icon: Globe },
];

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
        {tab === "ideas" && <IdeasContent />}
      </main>
    </div>
  );
}

function RoadmapContent() {
  const [showShipped, setShowShipped] = useState(false);

  return (
    <div className="px-5 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="glass-surface rounded-lg p-4 mb-6 animate-fade-in-up" data-testid="roadmap-hero">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{shipped.length} features shipped</p>
              <p className="text-[11px] text-muted-foreground">{upNext.length} more on the way</p>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-foreground">Coming Next</h2>
            <Badge className="bg-primary/10 text-primary border-transparent no-default-hover-elevate text-[10px]">
              {upNext.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {upNext.map((item, i) => (
              <div
                key={item.title}
                className="glass-surface rounded-lg p-3 animate-fade-in-up"
                style={{ animationDelay: `${i * 60}ms` }}
                data-testid={`card-roadmap-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-md shrink-0 bg-primary/10 text-primary">
                    <item.icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{item.title}</span>
                      <Circle className="h-2.5 w-2.5 text-muted-foreground/40" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <button
            onClick={() => setShowShipped(!showShipped)}
            className="flex items-center gap-2 mb-3 group"
            data-testid="toggle-shipped"
          >
            <h2 className="text-sm font-semibold text-foreground">Already Shipped</h2>
            <Badge className="bg-green-600/10 text-green-600 border-transparent no-default-hover-elevate text-[10px]">
              {shipped.length}
            </Badge>
            <ChevronDownIcon className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
              showShipped && "rotate-180"
            )} />
          </button>

          {showShipped && (
            <div className="grid grid-cols-2 gap-1.5 animate-fade-in-up">
              {shipped.map((item) => (
                <div
                  key={item.title}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-muted/30"
                  data-testid={`shipped-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                  <span className="text-[11px] text-muted-foreground truncate">{item.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
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
