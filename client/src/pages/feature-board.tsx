import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Plus,
  MessageSquare,
  Flame,
  Clock,
  X,
  Send,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const categoryLabels: Record<string, string> = {
  general: "General",
  rehearsal: "Rehearsal",
  voices: "Voices",
  scripts: "Scripts",
  recording: "Recording",
  multiplayer: "Multiplayer",
  ui: "Design",
};

const categoryOptions = Object.entries(categoryLabels);

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function VoteButton({
  item,
  direction,
}: {
  item: FeatureRequestItem;
  direction: "up" | "down";
}) {
  const voteMutation = useMutation({
    mutationFn: async (value: number) => {
      const res = await apiRequest("POST", `/api/features/${item.id}/vote`, { value });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/features"] });
    },
  });

  const handleVote = () => {
    const targetValue = direction === "up" ? 1 : -1;
    const newValue = item.userVote === targetValue ? 0 : targetValue;
    voteMutation.mutate(newValue);
  };

  const isActive =
    (direction === "up" && item.userVote === 1) ||
    (direction === "down" && item.userVote === -1);

  const Icon = direction === "up" ? ChevronUp : ChevronDown;

  return (
    <button
      onClick={handleVote}
      disabled={voteMutation.isPending}
      className={cn(
        "p-1 rounded-md transition-colors",
        isActive
          ? "text-primary bg-primary/10"
          : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50"
      )}
      data-testid={`button-vote-${direction}-${item.id}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function RequestCard({ item }: { item: FeatureRequestItem }) {
  const category = item.category || "general";

  return (
    <div
      className="glass-surface rounded-lg p-4 animate-fade-in-up transition-shadow duration-200 hover:shadow-md"
      data-testid={`card-feature-${item.id}`}
    >
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-0 shrink-0">
          <VoteButton item={item} direction="up" />
          <span
            className={cn(
              "text-sm font-semibold tabular-nums min-w-[24px] text-center",
              (item.voteCount || 0) > 0 ? "text-primary" : "text-muted-foreground"
            )}
            data-testid={`text-vote-count-${item.id}`}
          >
            {item.voteCount || 0}
          </span>
          <VoteButton item={item} direction="down" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-sm font-medium text-foreground leading-snug">
              {item.title}
            </h2>
            {item.status === "planned" && (
              <Badge className="shrink-0 bg-primary/10 text-primary border-transparent text-[10px]">
                Planned
              </Badge>
            )}
            {item.status === "shipped" && (
              <Badge className="shrink-0 bg-green-600/10 text-green-600 border-transparent text-[10px]">
                Shipped
              </Badge>
            )}
          </div>
          {item.description && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
              {item.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-border/50 text-muted-foreground"
            >
              {categoryLabels[category] || category}
            </Badge>
            <span className="text-[11px] text-muted-foreground/60">
              {item.authorName}
            </span>
            <span className="text-[11px] text-muted-foreground/60">
              {timeAgo(item.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewRequestForm({ onClose }: { onClose: () => void }) {
  const { isAuthenticated } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [authorName, setAuthorName] = useState("");

  const submitMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = { title, description, category };
      if (!isAuthenticated && authorName.trim()) {
        body.authorName = authorName.trim();
      }
      const res = await apiRequest("POST", "/api/features", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/features"] });
      onClose();
    },
  });

  return (
    <div className="glass-surface rounded-lg p-4 animate-fade-in-up space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">New request</h2>
        <button
          onClick={onClose}
          className="text-muted-foreground p-1 rounded-md hover:bg-muted/50"
          data-testid="button-close-new-request"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <input
        type="text"
        placeholder="What would make Co-star Studio better?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full bg-transparent border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
        data-testid="input-feature-title"
        autoFocus
      />

      {!isAuthenticated && (
        <input
          type="text"
          placeholder="Your name (optional)"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          className="w-full bg-transparent border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
          data-testid="input-feature-author"
        />
      )}

      <Textarea
        placeholder="Add more detail (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="min-h-[80px] resize-none text-sm"
        data-testid="input-feature-description"
      />

      <div className="flex flex-wrap gap-1.5">
        {categoryOptions.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setCategory(value)}
            className={cn(
              "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border",
              category === value
                ? "bg-primary/10 border-primary/30 text-primary"
                : "border-border/50 text-muted-foreground hover:border-border"
            )}
            data-testid={`button-category-${value}`}
          >
            {label}
          </button>
        ))}
      </div>

      <Button
        onClick={() => submitMutation.mutate()}
        disabled={title.trim().length < 3 || submitMutation.isPending}
        className="w-full"
        data-testid="button-submit-feature"
      >
        <Send className="h-3.5 w-3.5 mr-1.5" />
        {submitMutation.isPending ? "Posting..." : "Post request"}
      </Button>
    </div>
  );
}

export function FeatureBoardPage({ onBack }: { onBack: () => void }) {
  const [sort, setSort] = useState<SortMode>("top");
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery<{ requests: FeatureRequestItem[] }>({
    queryKey: ["/api/features", `?sort=${sort}`],
  });

  const requests = data?.requests || [];

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
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-sm text-foreground">Feature Board</h1>
          <p className="text-[11px] text-muted-foreground">
            {requests.length} {requests.length === 1 ? "request" : "requests"}
          </p>
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
      </header>

      <main className="flex-1 px-4 py-5">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSort("top")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                sort === "top"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
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
                sort === "newest"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid="button-sort-newest"
            >
              <Clock className="h-3.5 w-3.5" />
              Newest
            </button>
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
              <h2 className="text-sm font-semibold text-foreground mb-1">
                No requests yet
              </h2>
              <p className="text-xs text-muted-foreground max-w-[240px] mb-4">
                Be the first to suggest a feature. What would make Co-star Studio better for you?
              </p>
              <Button
                size="sm"
                onClick={() => setShowForm(true)}
                data-testid="button-first-request"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Post a request
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((item) => (
                <RequestCard key={item.id} item={item} />
              ))}
            </div>
          )}

        </div>
      </main>

      <footer className="px-5 py-6 text-center border-t border-border/40 safe-bottom">
        <div className="flex items-center justify-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/60" />
          <p className="text-[11px] text-muted-foreground/60">
            Requests help shape what we build next
          </p>
        </div>
      </footer>
    </div>
  );
}
