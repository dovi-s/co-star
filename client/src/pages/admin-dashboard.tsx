import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ChevronLeft,
  Loader2,
  Users,
  Eye,
  BarChart3,
  DollarSign,
  TrendingUp,
  Smartphone,
  Monitor,
  Tablet,
  Globe,
  Crown,
  Lightbulb,
  Clock,
  BookOpen,
  Activity,
  RefreshCw,
  Search,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ArrowLeft,
  MousePointerClick,
  Zap,
  ExternalLink,
  MailOpen,
  Bug,
  Settings,
  CreditCard,
  Filter,
  Hash,
  TrendingDown,
  Target,
  Layers,
  RotateCcw,
  UserPlus,
  Trash2,
  Ban,
  ShieldCheck,
  MoreVertical,
  Pause,
  LogOut,
  Heart,
  MessageCircle,
  Power,
  Plug,
  Unplug,
  TestTube2,
  EyeOff,
  Save,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Tab = "overview" | "users" | "traffic" | "usage" | "features" | "revenue" | "feedback" | "errors" | "integrations";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "traffic", label: "Traffic", icon: Eye },
  { id: "usage", label: "Usage", icon: Activity },
  { id: "features", label: "Features", icon: MousePointerClick },
  { id: "revenue", label: "Revenue", icon: DollarSign },
  { id: "feedback", label: "Messages", icon: MessageSquare },
  { id: "errors", label: "Errors", icon: AlertTriangle },
  { id: "integrations", label: "Integrations", icon: Settings },
];

interface AnalyticsData {
  users: {
    total: number;
    today: number;
    last7d: number;
    last30d: number;
    tierBreakdown: { tier: string; count: string }[];
    signupsByDay: { date: string; count: string }[];
    recentUsers: {
      id: string;
      email: string | null;
      firstName: string | null;
      lastName: string | null;
      subscriptionTier: string | null;
      createdAt: string;
      onboardingComplete: string | null;
    }[];
  };
  pageviews: {
    total: number;
    today: number;
    last7d: number;
    uniqueToday: number;
    unique7d: number;
    unique30d: number;
    topPages: { path: string; views: string; unique_visitors: string }[];
    byDay: { date: string; views: string; visitors: string }[];
    deviceBreakdown: { device: string; count: string }[];
    browserBreakdown: { browser: string; count: string }[];
    topReferrers: { referrer: string; count: string }[];
  };
  usage: {
    totalScripts: number;
    totalRuns: number;
    totalRecentScripts: number;
    scripts30d: number;
    runs30d: number;
    avgAccuracy: number;
    avgDuration: number;
    runsByDay: { date: string; count: string; avg_accuracy: string }[];
  };
  featureRequests: {
    total: number;
    top: { title: string; category: string; status: string; vote_count: number; created_at: string }[];
  };
  messages: {
    newCount: number;
  };
  revenue: {
    mrr: number;
    totalSubscriptions: number;
    activeSubscriptions: number;
  };
  churn: {
    total: number;
    canceled: number;
    paused: number;
    stayed: number;
    reasonBreakdown: { reason: string; count: string }[];
    recent: {
      id: string;
      reason: string;
      comment: string | null;
      outcome: string;
      created_at: string;
      email: string | null;
      first_name: string | null;
      last_name: string | null;
    }[];
  };
}

export function AdminDashboard({ onBack }: { onBack: () => void }) {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<AnalyticsData>({
    queryKey: ["/api/admin/analytics"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });

  if (selectedUserId) {
    return <UserDetailView userId={selectedUserId} onBack={() => setSelectedUserId(null)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="glass-surface sticky top-0 z-40 border-b border-border/40 safe-top">
        <div className="flex items-center justify-between px-4 h-14 max-w-6xl mx-auto">
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="button-admin-back">
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-sm font-semibold">Admin Panel</h1>
          <button onClick={() => { queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] }); refetch(); }} className="text-muted-foreground hover:text-foreground transition-colors" data-testid="button-admin-refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <nav className="border-b border-border/30 overflow-x-auto">
        <div className="flex max-w-6xl mx-auto px-2">
          {TABS.map((t) => {
            const badgeCount = t.id === "feedback" ? data?.messages?.newCount || 0 : 0;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "px-3 py-3 text-[11px] font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5",
                  tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                data-testid={`tab-${t.id}`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
                {badgeCount > 0 && (
                  <span className="min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center" data-testid="badge-new-messages">
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : isError ? (
          <div className="text-center py-20 text-muted-foreground"><p className="text-sm">Could not load analytics. Make sure you are signed in as admin.</p></div>
        ) : data ? (
          <>
            <div key={tab} className="animate-crossfade">
            {tab === "overview" && <OverviewTab data={data} onViewUser={setSelectedUserId} />}
            {tab === "users" && <UsersTab data={data} onViewUser={setSelectedUserId} />}
            {tab === "traffic" && <TrafficTab data={data} />}
            {tab === "usage" && <UsageTab data={data} />}
            {tab === "features" && <FeaturesTab />}
            {tab === "revenue" && <RevenueTab data={data} />}
            {tab === "feedback" && <FeedbackTab />}
            {tab === "errors" && <ErrorsTab />}
            {tab === "integrations" && <IntegrationsTab />}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = "primary", testId }: {
  icon: any; label: string; value: string | number; sub?: string; color?: string; testId?: string;
}) {
  const colorClasses: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    green: "bg-green-500/10 text-green-600 dark:text-green-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    red: "bg-red-500/10 text-red-600 dark:text-red-400",
    purple: "bg-primary/10 text-primary",
  };
  return (
    <div className="rounded-xl border border-border/40 p-4 space-y-2" data-testid={testId}>
      <div className="flex items-center gap-2">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", colorClasses[color])}><Icon className="w-4 h-4" /></div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function MiniBar({ value, max, color = "bg-primary" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden flex-1">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function SparklineChart({ data, height = 48, color }: { data: number[]; height?: number; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 200;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });
  const fillPoints = `${points.join(" L")} L${w},${height} L0,${height} Z`;
  const strokeColor = color || "hsl(var(--primary))";
  const fillColor = color ? color.replace(")", " / 0.08)").replace("hsl(", "hsl(") : "hsl(var(--primary) / 0.08)";
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }}>
      <path d={`M${fillPoints}`} fill={fillColor} />
      <polyline points={points.join(" ")} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold">{children}</h2>
      {action}
    </div>
  );
}

function formatDate(d: string) { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
function formatTime(d: string) { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function formatTimeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-border/40 p-4", className)}>{children}</div>;
}

function tierBadgeClass(tier: string | null | undefined) {
  switch (tier) {
    case "pro": return "bg-primary/10 text-primary";
    case "comp": return "bg-emerald-500/10 text-emerald-600";
    case "internal": return "bg-blue-500/10 text-blue-600";
    default: return "bg-muted text-muted-foreground";
  }
}

function tierLabel(tier: string | null | undefined) {
  switch (tier) {
    case "pro": return "pro";
    case "comp": return "comp";
    case "internal": return "internal";
    default: return "free";
  }
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Icon className="w-8 h-8 mx-auto mb-2 opacity-40" />
      <p className="text-xs">{message}</p>
    </div>
  );
}

function OverviewTab({ data, onViewUser }: { data: AnalyticsData; onViewUser: (id: string) => void }) {
  const proCount = Number(data.users.tierBreakdown.find((t) => t.tier === "pro")?.count || 0);
  const conversionRate = data.users.total > 0 ? ((proCount / data.users.total) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total Users" value={data.users.total} sub={`+${data.users.today} today, +${data.users.last7d} this week`} testId="stat-total-users" />
        <StatCard icon={Eye} label="Visitors (30d)" value={data.pageviews.unique30d} sub={`${data.pageviews.uniqueToday} today`} color="blue" testId="stat-visitors" />
        <StatCard icon={DollarSign} label="MRR" value={`$${data.revenue.mrr}`} sub={`${data.revenue.activeSubscriptions} active subs`} color="green" testId="stat-mrr" />
        <StatCard icon={Activity} label="Rehearsals" value={data.usage.totalRuns} sub={`${data.usage.runs30d} this month`} color="purple" testId="stat-runs" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Crown} label="Pro Users" value={proCount} sub={`${conversionRate}% conversion`} color="amber" />
        <StatCard icon={BookOpen} label="Scripts" value={data.usage.totalScripts} sub={`${data.usage.scripts30d} this month`} color="blue" />
        <StatCard icon={Target} label="Avg Accuracy" value={data.usage.avgAccuracy > 0 ? `${Number(data.usage.avgAccuracy).toFixed(0)}%` : "-"} color="green" />
        <StatCard icon={Lightbulb} label="Feature Requests" value={data.featureRequests.total} color="amber" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <SectionTitle>Signups (30 days)</SectionTitle>
          <SparklineChart data={data.users.signupsByDay.map((d) => Number(d.count))} />
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
            {data.users.signupsByDay.length > 0 && (<><span>{formatDate(data.users.signupsByDay[0].date)}</span><span>{formatDate(data.users.signupsByDay[data.users.signupsByDay.length - 1].date)}</span></>)}
          </div>
        </Card>
        <Card>
          <SectionTitle>Pageviews (30 days)</SectionTitle>
          <SparklineChart data={data.pageviews.byDay.map((d) => Number(d.views))} />
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
            {data.pageviews.byDay.length > 0 && (<><span>{formatDate(data.pageviews.byDay[0].date)}</span><span>{formatDate(data.pageviews.byDay[data.pageviews.byDay.length - 1].date)}</span></>)}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle>Latest Signups</SectionTitle>
        <div className="space-y-2">
          {data.users.recentUsers.slice(0, 8).map((u) => (
            <button key={u.id} onClick={() => onViewUser(u.id)} className="flex items-center gap-3 w-full text-left py-1.5 hover:bg-muted/30 rounded-lg px-2 -mx-2 transition-colors" data-testid={`user-row-${u.id}`}>
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                {(u.firstName?.[0] || u.email?.[0] || "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">{[u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Anonymous"}</span>
                <span className="text-[10px] text-muted-foreground ml-2">{u.email}</span>
              </div>
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                tierBadgeClass(u.subscriptionTier)
              )}>{tierLabel(u.subscriptionTier)}</span>
              <span className="text-[10px] text-muted-foreground">{formatTimeAgo(u.createdAt)}</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function UsersTab({ data, onViewUser }: { data: AnalyticsData; onViewUser: (id: string) => void }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newTier, setNewTier] = useState("free");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const invalidateUsers = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
  };

  const resetOnboardingMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/reset-onboarding`, {});
      if (!res.ok) throw new Error("Failed to reset onboarding");
      return res.json();
    },
    onSuccess: () => {
      invalidateUsers();
      toast({ title: "Onboarding reset", description: "User will see onboarding on next visit" });
    },
    onError: () => {
      toast({ title: "Failed to reset onboarding", variant: "destructive" });
    },
  });

  const blockMutation = useMutation({
    mutationFn: async ({ userId, blocked }: { userId: string; blocked: boolean }) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/block`, { blocked });
      if (!res.ok) throw new Error("Failed to update block status");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      invalidateUsers();
      toast({ title: variables.blocked ? "User blocked" : "User unblocked" });
    },
    onError: () => {
      toast({ title: "Failed to update block status", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${userId}`, {});
      if (!res.ok) throw new Error("Failed to delete user");
      return res.json();
    },
    onSuccess: () => {
      setConfirmDeleteId(null);
      invalidateUsers();
      toast({ title: "User deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete user", variant: "destructive" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { email: string; firstName: string; lastName: string; password: string; tier: string }) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create user");
      }
      return res.json();
    },
    onSuccess: () => {
      setShowAddUser(false);
      setNewEmail("");
      setNewFirstName("");
      setNewLastName("");
      setNewPassword("");
      setNewTier("free");
      invalidateUsers();
      toast({ title: "User created and synced with Stripe" });
    },
  });

  const { data: usersData, isLoading } = useQuery<{ users: any[]; total: number }>({
    queryKey: ["/api/admin/users", { search, tier: tierFilter, page }],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (search) params.set("search", search);
      if (tierFilter) params.set("tier", tierFilter);
      const res = await fetch(`/api/admin/users?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total Users" value={data.users.total} testId="stat-users-total" />
        <StatCard icon={TrendingUp} label="Today" value={data.users.today} color="green" />
        <StatCard icon={TrendingUp} label="This Week" value={data.users.last7d} color="blue" />
        <StatCard icon={TrendingUp} label="This Month" value={data.users.last30d} color="purple" />
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users by name, email, stage name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border/50 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            data-testid="input-user-search"
          />
        </div>
        <select
          value={tierFilter}
          onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm rounded-lg border border-border/50 bg-background"
          data-testid="select-tier-filter"
        >
          <option value="">All tiers</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="comp">Comp</option>
          <option value="internal">Internal</option>
        </select>
        <Button size="sm" onClick={() => setShowAddUser(!showAddUser)} data-testid="button-add-user">
          <UserPlus className="w-4 h-4 mr-1" />
          Add User
        </Button>
      </div>

      {showAddUser && (
        <Card>
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Create New User</h2>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="First name"
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-border/50 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                data-testid="input-new-first-name"
              />
              <input
                type="text"
                placeholder="Last name"
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-border/50 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                data-testid="input-new-last-name"
              />
            </div>
            <input
              type="email"
              placeholder="Email (required)"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border/50 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              data-testid="input-new-email"
            />
            <input
              type="password"
              placeholder="Temporary password (optional)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border/50 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              data-testid="input-new-password"
            />
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Subscription tier</p>
              <select
                value={newTier}
                onChange={(e) => setNewTier(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border/50 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                data-testid="select-new-tier"
              >
                <option value="free">Free</option>
                <option value="pro">Pro (paid)</option>
                <option value="comp">Comp (complimentary Pro)</option>
                <option value="internal">Internal (team)</option>
              </select>
            </div>
            {createUserMutation.error && (
              <p className="text-xs text-red-500">{(createUserMutation.error as Error).message}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowAddUser(false)} data-testid="button-cancel-add-user">Cancel</Button>
              <Button
                size="sm"
                disabled={!newEmail.trim() || createUserMutation.isPending}
                onClick={() => createUserMutation.mutate({ email: newEmail, firstName: newFirstName, lastName: newLastName, password: newPassword, tier: newTier })}
                data-testid="button-confirm-add-user"
              >
                {createUserMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Create User
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 text-left">
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">User</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Tier</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Onboarded</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Joined</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(usersData?.users || []).map((u: any) => {
                    const isBlocked = u.blocked === "true";
                    const isDeleting = confirmDeleteId === u.id;
                    return (
                    <tr key={u.id} className={cn("border-t border-border/20 hover:bg-muted/20 cursor-pointer", isBlocked && "opacity-50")} onClick={() => onViewUser(u.id)}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                            {(u.first_name?.[0] || u.email?.[0] || "?").toUpperCase()}
                          </div>
                          <span className="font-medium truncate max-w-[120px]">{[u.first_name, u.last_name].filter(Boolean).join(" ") || "Anonymous"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs truncate max-w-[160px]">{u.email || "-"}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                          tierBadgeClass(u.subscription_tier)
                        )}>{tierLabel(u.subscription_tier)}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {isBlocked ? (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500">Blocked</span>
                        ) : (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {u.onboarding_complete === "true" ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); resetOnboardingMutation.mutate(u.id); }}
                            className="group flex items-center gap-1 hover:text-amber-600 transition-colors"
                            title="Reset onboarding for this user"
                            data-testid={`button-reset-onboarding-${u.id}`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 group-hover:hidden" />
                            <RotateCcw className="w-3.5 h-3.5 hidden group-hover:block text-amber-600" />
                          </button>
                        ) : (
                          <span title="Not yet onboarded">
                            <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatTime(u.created_at)}</td>
                      <td className="px-4 py-2.5">
                        {isDeleting ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[10px] text-red-500 mr-1">Delete?</span>
                            <button
                              onClick={() => deleteMutation.mutate(u.id)}
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                              data-testid={`button-confirm-delete-${u.id}`}
                            >
                              {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes"}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                              data-testid={`button-cancel-delete-${u.id}`}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="p-1 rounded hover:bg-muted transition-colors"
                                  data-testid={`button-actions-${u.id}`}
                                >
                                  <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-[140px]">
                                <DropdownMenuItem
                                  onClick={() => blockMutation.mutate({ userId: u.id, blocked: !isBlocked })}
                                  data-testid={`button-block-${u.id}`}
                                >
                                  {isBlocked ? <ShieldCheck className="w-3.5 h-3.5 mr-2 text-green-500" /> : <Ban className="w-3.5 h-3.5 mr-2 text-amber-500" />}
                                  {isBlocked ? "Unblock User" : "Block User"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => resetOnboardingMutation.mutate(u.id)}
                                  data-testid={`button-menu-reset-onboarding-${u.id}`}
                                >
                                  <RotateCcw className="w-3.5 h-3.5 mr-2 text-amber-600" />
                                  Reset Onboarding
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setConfirmDeleteId(u.id)}
                                  className="text-red-500 focus:text-red-500"
                                  data-testid={`button-delete-${u.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                                  Delete User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {usersData && usersData.total > 50 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/20">
                <span className="text-xs text-muted-foreground">{usersData.total} total users</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)} data-testid="button-prev-page">Prev</Button>
                  <Button size="sm" variant="outline" disabled={page * 50 >= usersData.total} onClick={() => setPage(page + 1)} data-testid="button-next-page">Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function UserDetailView({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [grantAmount, setGrantAmount] = useState("3");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/users", userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  const planMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/plan`, body);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update plan");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  const u = data.user;
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || "Anonymous";

  return (
    <div className="min-h-screen bg-background">
      <header className="glass-surface sticky top-0 z-40 border-b border-border/40 safe-top">
        <div className="flex items-center justify-between px-4 h-14 max-w-6xl mx-auto">
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="button-user-back">
            <ArrowLeft className="w-4 h-4" /> Users
          </button>
          <h1 className="text-sm font-semibold">{name}</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg font-semibold">
              {name[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 space-y-1">
              <h2 className="text-lg font-semibold">{name}</h2>
              <p className="text-sm text-muted-foreground">{u.email || "No email"}</p>
              {u.stageName && <p className="text-xs text-muted-foreground">Stage name: {u.stageName}</p>}
              <div className="flex flex-wrap gap-2 mt-2">
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full",
                  tierBadgeClass(u.subscriptionTier)
                )}>{tierLabel(u.subscriptionTier)}</span>
                {u.onboardingComplete === "true" && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">Onboarded</span>}
                {u.location && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{u.location}</span>}
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground space-y-1">
              <p>Joined {formatTime(u.createdAt)}</p>
              {u.stripeCustomerId && <p className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> Stripe linked</p>}
            </div>
          </div>

          {(u.pronouns || u.ageRange || u.height || u.eyeColor || u.hairColor || u.unionStatus) && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4 pt-4 border-t border-border/30">
              {u.pronouns && <div className="text-xs"><span className="text-muted-foreground">Pronouns:</span> {u.pronouns}</div>}
              {u.ageRange && <div className="text-xs"><span className="text-muted-foreground">Age range:</span> {u.ageRange}</div>}
              {u.height && <div className="text-xs"><span className="text-muted-foreground">Height:</span> {u.height}</div>}
              {u.eyeColor && <div className="text-xs"><span className="text-muted-foreground">Eyes:</span> {u.eyeColor}</div>}
              {u.hairColor && <div className="text-xs"><span className="text-muted-foreground">Hair:</span> {u.hairColor}</div>}
              {u.unionStatus && <div className="text-xs"><span className="text-muted-foreground">Union:</span> {u.unionStatus}</div>}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle>Plan and Usage Controls</SectionTitle>
          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Current Tier</p>
                <span className={cn("text-xs font-medium px-2 py-1 rounded-full",
                  tierBadgeClass(u.subscriptionTier)
                )}>{tierLabel(u.subscriptionTier)}</span>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Script Usage</p>
                <span className="text-xs font-medium">
                  {["pro", "comp", "internal"].includes(u.subscriptionTier)
                    ? "unlimited"
                    : `${u.scriptUsageCount || 0} / ${3 + (u.scriptUsageLimitBonus || 0)}`}
                </span>
              </div>
              {u.scriptUsageResetAt && (
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Usage Resets</p>
                  <span className="text-xs text-muted-foreground">{formatTime(u.scriptUsageResetAt)}</span>
                </div>
              )}
              {u.subscriptionExpiresAt && (
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Subscription Expires</p>
                  <span className="text-xs text-muted-foreground">{formatTime(u.subscriptionExpiresAt)}</span>
                </div>
              )}
              {u.stripeSubscriptionId && (
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Stripe Sub</p>
                  <span className="text-xs font-mono text-muted-foreground">{u.stripeSubscriptionId.slice(0, 20)}...</span>
                </div>
              )}
            </div>

            <div className="border-t border-border/30 pt-3 flex flex-wrap gap-2 items-end">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Change tier</p>
                <div className="flex gap-1">
                  {(["free", "pro", "comp", "internal"] as const).map((t) => (
                    <Button
                      key={t}
                      size="sm"
                      variant={u.subscriptionTier === t ? "default" : "outline"}
                      disabled={planMutation.isPending || u.subscriptionTier === t}
                      onClick={() => planMutation.mutate({ action: "change_tier", tier: t })}
                      data-testid={`button-tier-${t}`}
                      className="text-xs capitalize"
                    >
                      {planMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                      {t}
                    </Button>
                  ))}
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                disabled={planMutation.isPending || (u.scriptUsageCount || 0) === 0}
                onClick={() => planMutation.mutate({ action: "reset_usage" })}
                data-testid="button-reset-usage"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Reset Usage Counter
              </Button>

              <div className="flex items-end gap-1">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground">Raise limit by</p>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={grantAmount}
                    onChange={(e) => setGrantAmount(e.target.value)}
                    className="w-16 px-2 py-1.5 text-xs rounded border border-border/50 bg-background"
                    data-testid="input-grant-amount"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={planMutation.isPending}
                  onClick={() => planMutation.mutate({ action: "grant_usage", amount: Number(grantAmount) || 3 })}
                  data-testid="button-grant-usage"
                >
                  Grant
                </Button>
              </div>
            </div>

            {planMutation.error && (
              <p className="text-xs text-red-500">{(planMutation.error as Error).message}</p>
            )}
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <SectionTitle>Pages Visited</SectionTitle>
            {data.pageviews.length > 0 ? (
              <div className="space-y-1.5">
                {data.pageviews.map((p: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-xs flex-1 truncate">{p.path}</span>
                    <span className="text-xs font-medium">{p.views}</span>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon={Eye} message="No pageviews recorded" />}
          </Card>

          <Card>
            <SectionTitle>Feature Usage</SectionTitle>
            {data.events.length > 0 ? (
              <div className="space-y-1.5">
                {data.events.map((e: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-xs flex-1 truncate">{e.event}{e.label ? `: ${e.label}` : ""}</span>
                    <span className="text-[10px] text-muted-foreground">{e.category}</span>
                    <span className="text-xs font-medium">{e.count}x</span>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon={MousePointerClick} message="No events recorded" />}
          </Card>

          <Card>
            <SectionTitle>Rehearsal Runs</SectionTitle>
            {data.runs.length > 0 ? (
              <div className="space-y-2">
                {data.runs.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-2 text-sm border-b border-border/20 pb-2 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{r.script_name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatTimeAgo(r.created_at)}</p>
                    </div>
                    <span className="text-xs font-medium">{Number(r.accuracy).toFixed(0)}%</span>
                    <span className="text-[10px] text-muted-foreground">{r.lines_correct}/{r.lines_total} lines</span>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon={Activity} message="No rehearsal runs" />}
          </Card>

          <Card>
            <SectionTitle>Scripts</SectionTitle>
            {data.scripts.length > 0 && (
              <div className="space-y-1.5 mb-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Library (Pro)</p>
                {data.scripts.map((s: any) => (
                  <div key={s.id} className="flex items-center gap-2 text-sm">
                    <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="flex-1 truncate text-xs">{s.name}</span>
                    <span className="text-[10px] text-muted-foreground">{formatTimeAgo(s.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
            {(data.recentScripts || []).length > 0 ? (
              <div className="space-y-1.5">
                {data.scripts.length > 0 && <Separator className="my-2" />}
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Recent</p>
                {(data.recentScripts || []).map((s: any) => (
                  <div key={s.id} className="flex items-center gap-2 text-sm">
                    <BookOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate text-xs">{s.name}</span>
                    <span className="text-[10px] text-muted-foreground">{formatTimeAgo(s.created_at)}</span>
                  </div>
                ))}
              </div>
            ) : data.scripts.length === 0 ? <EmptyState icon={BookOpen} message="No scripts" /> : null}
          </Card>
        </div>

        {data.errors.length > 0 && (
          <Card>
            <SectionTitle>Recent Errors</SectionTitle>
            <div className="space-y-2">
              {data.errors.map((e: any) => (
                <div key={e.id} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">{e.message}</p>
                    <p className="text-[10px] text-muted-foreground">{e.path} - {formatTimeAgo(e.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}

function TrafficTab({ data }: { data: AnalyticsData }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Eye} label="Total Pageviews" value={data.pageviews.total} testId="stat-pageviews-total" />
        <StatCard icon={Eye} label="Today" value={data.pageviews.today} sub={`${data.pageviews.uniqueToday} unique`} color="blue" />
        <StatCard icon={Users} label="Unique (7d)" value={data.pageviews.unique7d} color="green" />
        <StatCard icon={Users} label="Unique (30d)" value={data.pageviews.unique30d} color="purple" />
      </div>

      <Card>
        <SectionTitle>Traffic Trend (30 days)</SectionTitle>
        <SparklineChart data={data.pageviews.byDay.map((d) => Number(d.views))} height={64} />
        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
          {data.pageviews.byDay.length > 0 && (<><span>{formatDate(data.pageviews.byDay[0].date)}</span><span>{formatDate(data.pageviews.byDay[data.pageviews.byDay.length - 1].date)}</span></>)}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <SectionTitle>Top Pages</SectionTitle>
          <div className="space-y-1.5">
            {data.pageviews.topPages.map((p) => {
              const maxViews = Math.max(...data.pageviews.topPages.map((x) => Number(x.views)), 1);
              return (
                <div key={p.path} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate font-mono text-xs">{p.path || "/"}</span>
                  <MiniBar value={Number(p.views)} max={maxViews} />
                  <span className="w-10 text-right text-xs font-medium">{p.views}</span>
                  <span className="w-10 text-right text-[10px] text-muted-foreground">{p.unique_visitors}u</span>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionTitle>Referrers</SectionTitle>
            {data.pageviews.topReferrers.length > 0 ? (
              <div className="space-y-1.5">
                {data.pageviews.topReferrers.map((r) => (
                  <div key={r.referrer} className="flex items-center gap-2 text-sm">
                    <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate text-xs">{r.referrer}</span>
                    <span className="text-xs font-medium">{r.count}</span>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon={Globe} message="No referrer data yet" />}
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <SectionTitle>Devices</SectionTitle>
              <div className="space-y-2">
                {data.pageviews.deviceBreakdown.map((d) => {
                  const DeviceIcon = d.device === "mobile" ? Smartphone : d.device === "tablet" ? Tablet : Monitor;
                  const total = data.pageviews.deviceBreakdown.reduce((s, x) => s + Number(x.count), 0);
                  const pct = total > 0 ? ((Number(d.count) / total) * 100).toFixed(0) : "0";
                  return (
                    <div key={d.device} className="flex items-center gap-2 text-sm">
                      <DeviceIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="capitalize flex-1 text-xs">{d.device}</span>
                      <span className="text-[10px] text-muted-foreground">{pct}%</span>
                      <span className="font-medium text-xs w-8 text-right">{d.count}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card>
              <SectionTitle>Browsers</SectionTitle>
              <div className="space-y-2">
                {data.pageviews.browserBreakdown.map((b) => (
                  <div key={b.browser} className="flex items-center gap-2 text-sm">
                    <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="capitalize flex-1 text-xs">{b.browser}</span>
                    <span className="font-medium text-xs">{b.count}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsageTab({ data }: { data: AnalyticsData }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={BookOpen} label="Total Scripts" value={data.usage.totalScripts} sub={`${data.usage.scripts30d} this month`} testId="stat-scripts" />
        <StatCard icon={Activity} label="Total Runs" value={data.usage.totalRuns} sub={`${data.usage.runs30d} this month`} color="blue" />
        <StatCard icon={BarChart3} label="Avg Accuracy" value={data.usage.avgAccuracy > 0 ? `${Number(data.usage.avgAccuracy).toFixed(0)}%` : "-"} color="green" />
        <StatCard icon={Clock} label="Avg Duration" value={data.usage.avgDuration > 0 ? `${Math.round(data.usage.avgDuration / 60)}m` : "-"} color="purple" />
      </div>

      <Card>
        <SectionTitle>Rehearsals (30 days)</SectionTitle>
        <SparklineChart data={data.usage.runsByDay.map((d) => Number(d.count))} height={64} />
        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
          {data.usage.runsByDay.length > 0 && (<><span>{formatDate(data.usage.runsByDay[0].date)}</span><span>{formatDate(data.usage.runsByDay[data.usage.runsByDay.length - 1].date)}</span></>)}
        </div>
      </Card>

      <Card>
        <SectionTitle>Top Feature Requests</SectionTitle>
        {data.featureRequests.top.length > 0 ? (
          <div className="space-y-2">
            {data.featureRequests.top.map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="flex-1 text-xs truncate">{f.title}</span>
                <span className={cn("text-[10px] px-1.5 rounded", f.status === "open" ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground")}>{f.status}</span>
                <span className="text-xs font-medium">{f.vote_count} votes</span>
              </div>
            ))}
          </div>
        ) : <EmptyState icon={Lightbulb} message="No feature requests yet" />}
      </Card>
    </div>
  );
}

function FeaturesTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/events"],
    queryFn: async () => {
      const res = await fetch("/api/admin/events?days=30", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  const totalEvents = data.topEvents?.reduce((s: number, e: any) => s + Number(e.count), 0) || 0;
  const totalSessions = new Set(data.topEvents?.map((e: any) => e.unique_sessions) || []).size;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard icon={MousePointerClick} label="Total Events (30d)" value={totalEvents} color="blue" />
        <StatCard icon={Zap} label="Feature Types" value={data.featureUsage?.length || 0} color="purple" />
        <StatCard icon={Target} label="Click Events" value={data.clickEvents?.length || 0} color="green" />
      </div>

      <Card>
        <SectionTitle>Events Trend (30 days)</SectionTitle>
        {data.eventsByDay?.length > 1 ? (
          <SparklineChart data={data.eventsByDay.map((d: any) => Number(d.count))} height={64} />
        ) : <EmptyState icon={BarChart3} message="Not enough data yet. Events will appear as users interact with the app." />}
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <SectionTitle>Feature Usage</SectionTitle>
          {data.featureUsage?.length > 0 ? (
            <div className="space-y-2">
              {data.featureUsage.map((f: any, i: number) => {
                const maxCount = Math.max(...data.featureUsage.map((x: any) => Number(x.count)), 1);
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Zap className="w-3 h-3 text-primary shrink-0" />
                      <span className="flex-1 text-xs truncate">{f.event}{f.label ? ` (${f.label})` : ""}</span>
                      <span className="text-[10px] text-muted-foreground">{f.unique_users}u</span>
                      <span className="text-xs font-medium w-8 text-right">{f.count}</span>
                    </div>
                    <MiniBar value={Number(f.count)} max={maxCount} />
                  </div>
                );
              })}
            </div>
          ) : <EmptyState icon={Zap} message="No feature usage data yet. Add tracking to see which features are popular." />}
        </Card>

        <Card>
          <SectionTitle>Click Map</SectionTitle>
          {data.clickEvents?.length > 0 ? (
            <div className="space-y-2">
              {data.clickEvents.map((c: any, i: number) => {
                const maxClicks = Math.max(...data.clickEvents.map((x: any) => Number(x.clicks)), 1);
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <MousePointerClick className="w-3 h-3 text-blue-500 shrink-0" />
                      <span className="flex-1 text-xs truncate">{c.label || "unknown"}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{c.path}</span>
                      <span className="text-xs font-medium w-8 text-right">{c.clicks}</span>
                    </div>
                    <MiniBar value={Number(c.clicks)} max={maxClicks} color="bg-blue-500" />
                  </div>
                );
              })}
            </div>
          ) : <EmptyState icon={MousePointerClick} message="No click data yet. Clicks will be tracked automatically." />}
        </Card>
      </div>

      <Card>
        <SectionTitle>All Events</SectionTitle>
        {data.topEvents?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="pb-2 text-xs font-medium text-muted-foreground">Event</th>
                  <th className="pb-2 text-xs font-medium text-muted-foreground">Category</th>
                  <th className="pb-2 text-xs font-medium text-muted-foreground text-right">Count</th>
                  <th className="pb-2 text-xs font-medium text-muted-foreground text-right">Sessions</th>
                  <th className="pb-2 text-xs font-medium text-muted-foreground text-right">Users</th>
                </tr>
              </thead>
              <tbody>
                {data.topEvents.map((e: any, i: number) => (
                  <tr key={i} className="border-t border-border/20">
                    <td className="py-2 text-xs font-medium">{e.event}</td>
                    <td className="py-2"><span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{e.category}</span></td>
                    <td className="py-2 text-xs text-right font-medium">{e.count}</td>
                    <td className="py-2 text-xs text-right text-muted-foreground">{e.unique_sessions}</td>
                    <td className="py-2 text-xs text-right text-muted-foreground">{e.unique_users || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={BarChart3} message="No events recorded yet" />}
      </Card>
    </div>
  );
}

function RevenueTab({ data }: { data: AnalyticsData }) {
  const freeCount = Number(data.users.tierBreakdown.find((t) => t.tier === "free")?.count || 0);
  const proCount = Number(data.users.tierBreakdown.find((t) => t.tier === "pro")?.count || 0);
  const conversionRate = data.users.total > 0 ? ((proCount / data.users.total) * 100).toFixed(1) : "0";
  const arr = data.revenue.mrr * 12;
  const arpu = data.users.total > 0 ? (data.revenue.mrr / data.users.total).toFixed(2) : "0";
  const arppu = proCount > 0 ? (data.revenue.mrr / proCount).toFixed(2) : "0";

  const { data: stripeData } = useQuery<any>({
    queryKey: ["/api/admin/stripe"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stripe", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={DollarSign} label="MRR" value={`$${data.revenue.mrr}`} sub={`$${arr} ARR`} color="green" testId="stat-revenue-mrr" />
        <StatCard icon={Crown} label="Pro Subscribers" value={data.revenue.activeSubscriptions} color="primary" />
        <StatCard icon={TrendingUp} label="Conversion" value={`${conversionRate}%`} sub={`${proCount} of ${data.users.total}`} color="blue" />
        <StatCard icon={DollarSign} label="ARPU" value={`$${arpu}`} sub={`$${arppu} per paying user`} color="purple" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <SectionTitle>Subscription Funnel</SectionTitle>
          <div className="space-y-4 mt-2">
            <FunnelStep label="Total Users" value={data.users.total} pct={100} color="bg-blue-500" />
            <FunnelStep label="Onboarded" value={data.users.recentUsers.filter((u) => u.onboardingComplete === "true").length} pct={data.users.total > 0 ? (data.users.recentUsers.filter((u) => u.onboardingComplete === "true").length / data.users.total) * 100 : 0} color="bg-primary" />
            <FunnelStep label="Free" value={freeCount} pct={data.users.total > 0 ? (freeCount / data.users.total) * 100 : 0} color="bg-muted-foreground/50" />
            <FunnelStep label="Pro" value={proCount} pct={data.users.total > 0 ? (proCount / data.users.total) * 100 : 0} color="bg-green-500" />
          </div>
        </Card>

        <Card>
          <SectionTitle>Revenue Summary</SectionTitle>
          <div className="space-y-3 mt-2">
            {[
              { label: "Monthly recurring", value: `$${data.revenue.mrr}` },
              { label: "Annual run rate", value: `$${arr}` },
              { label: "Active subscriptions", value: data.revenue.activeSubscriptions },
              { label: "Total subscriptions (all-time)", value: data.revenue.totalSubscriptions },
              { label: "Avg revenue per user", value: `$${arpu}/mo` },
              { label: "Avg revenue per paying user", value: `$${arppu}/mo` },
              { label: "Free tier users", value: freeCount },
              { label: "Lifetime value (est.)", value: `$${(Number(arppu) * 6).toFixed(0)}` },
            ].map((item) => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-semibold">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {stripeData?.subscribers?.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/30">
            <SectionTitle>Stripe Customers</SectionTitle>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 text-left">
                  <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Customer</th>
                  <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Tier</th>
                  <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Stripe ID</th>
                  <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Joined</th>
                </tr>
              </thead>
              <tbody>
                {stripeData.subscribers.map((s: any) => (
                  <tr key={s.id} className="border-t border-border/20">
                    <td className="px-4 py-2 text-xs font-medium">{[s.first_name, s.last_name].filter(Boolean).join(" ") || "Anonymous"}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{s.email || "-"}</td>
                    <td className="px-4 py-2"><span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", tierBadgeClass(s.subscription_tier))}>{tierLabel(s.subscription_tier)}</span></td>
                    <td className="px-4 py-2 text-[10px] font-mono text-muted-foreground">{s.stripe_customer_id}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{formatTime(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {stripeData?.payments?.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/30">
            <SectionTitle>Recent Payments</SectionTitle>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 text-left">
                  <th className="px-4 py-2 text-xs font-medium text-muted-foreground">ID</th>
                  <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {stripeData.payments.map((p: any) => (
                  <tr key={p.id} className="border-t border-border/20">
                    <td className="px-4 py-2 text-[10px] font-mono text-muted-foreground">{p.id}</td>
                    <td className="px-4 py-2 text-xs font-medium">${(Number(p.amount) / 100).toFixed(2)} {p.currency?.toUpperCase()}</td>
                    <td className="px-4 py-2"><span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", p.status === "succeeded" ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600")}>{p.status}</span></td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{p.created ? formatTime(new Date(Number(p.created) * 1000).toISOString()) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {data.churn?.total > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={LogOut} label="Cancel Intents" value={data.churn.total} color="red" testId="stat-churn-total" />
            <StatCard icon={XCircle} label="Canceled" value={data.churn.canceled} color="red" />
            <StatCard icon={Pause} label="Paused" value={data.churn.paused} sub="chose to pause" color="amber" />
            <StatCard icon={Heart} label="Retained" value={data.churn.stayed} sub={data.churn.total > 0 ? `${((data.churn.stayed / data.churn.total) * 100).toFixed(0)}% save rate` : ""} color="green" testId="stat-churn-retained" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <SectionTitle>Cancel Reasons</SectionTitle>
              <div className="space-y-3 mt-2">
                {data.churn.reasonBreakdown.map((r) => {
                  const pct = data.churn.total > 0 ? (Number(r.count) / data.churn.total) * 100 : 0;
                  const reasonLabels: Record<string, string> = {
                    too_expensive: "Too expensive",
                    not_using: "Not using enough",
                    missing_features: "Missing features",
                    found_alternative: "Found alternative",
                    other: "Other",
                  };
                  return (
                    <div key={r.reason} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{reasonLabels[r.reason] || r.reason}</span>
                        <span className="font-medium">{r.count} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-destructive/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {data.churn.reasonBreakdown.length === 0 && (
                  <p className="text-sm text-muted-foreground">No cancel reasons recorded yet</p>
                )}
              </div>
            </Card>

            <Card>
              <SectionTitle>Retention Outcomes</SectionTitle>
              <div className="space-y-4 mt-2">
                {[
                  { label: "Stayed (kept plan)", value: data.churn.stayed, color: "bg-green-500" },
                  { label: "Paused (1 month)", value: data.churn.paused, color: "bg-amber-500" },
                  { label: "Canceled", value: data.churn.canceled, color: "bg-destructive" },
                ].map((item) => {
                  const pct = data.churn.total > 0 ? (item.value / data.churn.total) * 100 : 0;
                  return (
                    <div key={item.label} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-medium">{item.value} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", item.color)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/30">
              <SectionTitle>Recent Cancel Feedback</SectionTitle>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 text-left">
                    <th className="px-4 py-2 text-xs font-medium text-muted-foreground">User</th>
                    <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Reason</th>
                    <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Comment</th>
                    <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Outcome</th>
                    <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.churn.recent.map((f) => (
                    <tr key={f.id} className="border-t border-border/20">
                      <td className="px-4 py-2 text-xs font-medium">{[f.first_name, f.last_name].filter(Boolean).join(" ") || f.email || "Unknown"}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{f.reason.replace(/_/g, " ")}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground max-w-[200px] truncate">{f.comment || "—"}</td>
                      <td className="px-4 py-2">
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                          f.outcome === "stayed" ? "bg-green-500/10 text-green-600" :
                          f.outcome === "paused" ? "bg-amber-500/10 text-amber-600" :
                          "bg-red-500/10 text-red-600"
                        )}>
                          {f.outcome}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{formatTime(f.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function FeedbackTab() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/feedback", { status: statusFilter, type: typeFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/admin/feedback?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  const invalidateFeedback = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/feedback"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: string; status?: string; adminNotes?: string }) => {
      await apiRequest("PATCH", `/api/admin/feedback/${id}`, { status, adminNotes });
    },
    onSuccess: invalidateFeedback,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/feedback/${id}`, {});
    },
    onSuccess: invalidateFeedback,
  });

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const statusCounts = data?.statusCounts || [];
  const newCount = Number(statusCounts.find((s: any) => s.status === "new")?.count || 0);
  const reviewingCount = Number(statusCounts.find((s: any) => s.status === "reviewing")?.count || 0);
  const resolvedCount = Number(statusCounts.find((s: any) => s.status === "resolved")?.count || 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={MailOpen} label="New" value={newCount} color="red" />
        <StatCard icon={Clock} label="Reviewing" value={reviewingCount} color="amber" />
        <StatCard icon={CheckCircle2} label="Resolved" value={resolvedCount} color="green" />
      </div>

      <div className="flex gap-2">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-border/50 bg-background" data-testid="select-feedback-status">
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="reviewing">Reviewing</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-border/50 bg-background" data-testid="select-feedback-type">
          <option value="">All types</option>
          <option value="bug">Bug Report</option>
          <option value="feedback">General</option>
          <option value="sales">Sales Inquiry</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (data?.messages || []).length === 0 ? (
        <EmptyState icon={MessageSquare} message="No bug reports yet" />
      ) : (
        <div className="space-y-3">
          {data.messages.map((msg: any) => (
            <Card key={msg.id} className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                    msg.type === "bug" ? "bg-red-500/10 text-red-600" : msg.type === "feature" ? "bg-primary/10 text-primary" : "bg-blue-500/10 text-blue-600"
                  )}>{msg.type}</span>
                  <span className="text-xs font-medium">{msg.user_name || msg.user_email || "Anonymous"}</span>
                  <span className="text-[10px] text-muted-foreground">{formatTimeAgo(msg.created_at)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <select
                    value={msg.status}
                    onChange={(e) => updateMutation.mutate({ id: msg.id, status: e.target.value })}
                    className="text-[10px] px-1.5 py-0.5 rounded border border-border/50 bg-background"
                    data-testid={`select-status-${msg.id}`}
                  >
                    <option value="new">New</option>
                    <option value="reviewing">Reviewing</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                  {confirmDeleteId === msg.id ? (
                    <>
                      <button
                        onClick={() => { deleteMutation.mutate(msg.id); setConfirmDeleteId(null); }}
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                        data-testid={`button-confirm-delete-feedback-${msg.id}`}
                      >
                        {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                        data-testid={`button-cancel-delete-feedback-${msg.id}`}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(msg.id)}
                      className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                      title="Delete message"
                      data-testid={`button-delete-feedback-${msg.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">{msg.message}</p>
              {(msg.contact_email || msg.device || msg.browser || msg.path) && (
                <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                  {msg.contact_email && (
                    <a href={`mailto:${msg.contact_email}`} className="text-primary hover:underline font-medium">{msg.contact_email}</a>
                  )}
                  {msg.device && <span>{msg.device}</span>}
                  {msg.browser && <span>{msg.browser}</span>}
                  {msg.path && <span className="font-mono">{msg.path}</span>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ErrorsTab() {
  const [showResolved, setShowResolved] = useState(false);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/admin/errors", { resolved: showResolved }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/errors?resolved=${showResolved}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await apiRequest("PATCH", `/api/admin/errors/${id}`, { resolved: "true" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/errors"] });
    },
  });

  const bulkResolveMutation = useMutation({
    mutationFn: async ({ message }: { message: string }) => {
      await apiRequest("POST", "/api/admin/errors/resolve-bulk", { message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/errors"] });
    },
  });

  const unresolvedCount = Number(data?.counts?.find((c: any) => c.resolved === "false")?.count || 0);
  const resolvedCount = Number(data?.counts?.find((c: any) => c.resolved === "true")?.count || 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={AlertTriangle} label="Unresolved" value={unresolvedCount} color="red" />
        <StatCard icon={CheckCircle2} label="Resolved" value={resolvedCount} color="green" />
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant={showResolved ? "outline" : "default"} onClick={() => setShowResolved(false)} data-testid="button-show-unresolved">Unresolved</Button>
        <Button size="sm" variant={showResolved ? "default" : "outline"} onClick={() => setShowResolved(true)} data-testid="button-show-resolved">Resolved</Button>
        {!showResolved && unresolvedCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto text-red-500 border-red-500/30 hover:bg-red-500/10"
            onClick={() => bulkResolveMutation.mutate({ message: "" })}
            disabled={bulkResolveMutation.isPending}
            data-testid="button-resolve-all-errors"
          >
            {bulkResolveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
            Resolve All
          </Button>
        )}
      </div>

      {!showResolved && data?.topErrors?.length > 0 && (
        <Card>
          <SectionTitle>Most Frequent Errors</SectionTitle>
          <div className="space-y-2">
            {data.topErrors.slice(0, 8).map((e: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Bug className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span className="flex-1 text-xs truncate">{e.message}</span>
                <span className="text-xs font-medium text-red-600">{e.count}x</span>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => bulkResolveMutation.mutate({ message: e.message })} data-testid={`button-resolve-bulk-${i}`}>
                  Resolve all
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (data?.errors || []).length === 0 ? (
        <EmptyState icon={CheckCircle2} message={showResolved ? "No resolved errors" : "No unresolved errors. Looking good."} />
      ) : (
        <div className="space-y-2">
          {data.errors.map((err: any) => (
            <Card key={err.id} className="space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400 truncate">{err.message}</p>
                  <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                    <span>{formatTimeAgo(err.created_at)}</span>
                    {err.source && <span className="font-mono">{err.source}</span>}
                    {err.path && <span className="font-mono">{err.path}</span>}
                    {err.device && <span>{err.device}</span>}
                    {err.browser && <span>{err.browser}</span>}
                  </div>
                </div>
                {!showResolved && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0" onClick={() => resolveMutation.mutate({ id: err.id })} data-testid={`button-resolve-${err.id}`}>
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Resolve
                  </Button>
                )}
              </div>
              {err.stack && (
                <details className="text-[10px]">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Stack trace</summary>
                  <pre className="mt-1 p-2 bg-muted/50 rounded text-[10px] overflow-x-auto whitespace-pre-wrap font-mono">{err.stack}</pre>
                </details>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function IntegrationStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    connected: "bg-green-500/10 text-green-600",
    configured: "bg-amber-500/10 text-amber-600",
    error: "bg-red-500/10 text-red-600",
    planned: "bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium capitalize", styles[status] || styles.planned)}>
      {status}
    </span>
  );
}

function IntegrationConfigPanel({ integration, onClose, onSaved }: {
  integration: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of integration.configFields) {
      const existing = integration.configValues?.[f.key] || "";
      init[f.key] = existing.includes("•") ? "" : existing;
    }
    return init;
  });
  const [enabled, setEnabled] = useState(integration.enabled ?? false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const config: Record<string, string> = {};
      for (const f of integration.configFields) {
        if (formValues[f.key] || !integration.configValues?.[f.key]?.includes("•")) {
          config[f.key] = formValues[f.key];
        }
      }
      await apiRequest("PUT", `/api/admin/integrations/${integration.id}/config`, { config, enabled });
    },
    onSuccess: () => {
      toast({ title: "Configuration saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/integrations"] });
      onSaved();
    },
    onError: (e: any) => toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/admin/integrations/${integration.id}`);
    },
    onSuccess: () => {
      toast({ title: `${integration.name} disconnected` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/integrations"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Failed to disconnect", description: e.message, variant: "destructive" }),
  });

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const resp = await apiRequest("POST", `/api/admin/integrations/${integration.id}/test`);
      const result = await resp.json();
      setTestResult(result);
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message });
    }
    setTesting(false);
  }, [integration.id]);

  const isStripe = integration.id === "stripe";

  return (
    <div className="border border-border/40 rounded-lg overflow-hidden" data-testid={`config-panel-${integration.id}`}>
      <div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-b border-border/30">
        <div className="flex items-center gap-2">
          <span className="text-lg">{integration.icon}</span>
          <span className="text-sm font-semibold">{integration.name}</span>
          <IntegrationStatusBadge status={integration.status} />
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} data-testid={`button-close-config-${integration.id}`}>
          <XCircle className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-4 py-4 space-y-4">
        <p className="text-xs text-muted-foreground">{integration.description}</p>

        {integration.configFields.length > 0 ? (
          <div className="space-y-3">
            {integration.configFields.map((field: any) => (
              <div key={field.key} className="space-y-1">
                <label className="text-xs font-medium text-foreground flex items-center gap-1">
                  {field.label}
                  {field.required && <span className="text-destructive">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={field.secret && !showSecrets[field.key] ? "password" : "text"}
                    value={formValues[field.key] || ""}
                    onChange={(e) => setFormValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={integration.configValues?.[field.key]?.includes("•") ? integration.configValues[field.key] : field.placeholder}
                    className="w-full h-8 px-3 text-xs rounded-md border border-border bg-background font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                    data-testid={`input-${integration.id}-${field.key}`}
                  />
                  {field.secret && (
                    <button
                      type="button"
                      onClick={() => setShowSecrets(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSecrets[field.key] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : isStripe ? (
          <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/5 border border-green-500/20">
            <Plug className="h-4 w-4 text-green-500" />
            <span className="text-xs text-green-700 dark:text-green-400">Managed via Replit integration. No additional configuration needed.</span>
          </div>
        ) : null}

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              className={cn(
                "relative w-8 h-[18px] rounded-full transition-colors",
                enabled ? "bg-green-500" : "bg-muted-foreground/30"
              )}
              onClick={() => !isStripe && setEnabled(!enabled)}
            >
              <div className={cn(
                "absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform",
                enabled ? "translate-x-[16px]" : "translate-x-[2px]"
              )} />
            </div>
            <span className="text-xs text-muted-foreground">{enabled ? "Enabled" : "Disabled"}</span>
          </label>
        </div>

        {testResult && (
          <div className={cn(
            "flex items-start gap-2 p-3 rounded-md text-xs",
            testResult.ok ? "bg-green-500/5 border border-green-500/20 text-green-700 dark:text-green-400" : "bg-destructive/5 border border-destructive/20 text-destructive"
          )} data-testid={`test-result-${integration.id}`}>
            {testResult.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
            <span>{testResult.message}</span>
          </div>
        )}

        {integration.configuredAt && (
          <p className="text-[10px] text-muted-foreground">
            Last configured: {new Date(integration.configuredAt).toLocaleDateString()} {new Date(integration.configuredAt).toLocaleTimeString()}
          </p>
        )}

        <Separator />

        <div className="flex items-center gap-2">
          {!isStripe && (
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid={`button-save-${integration.id}`}>
              {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              Save
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleTest} disabled={testing} data-testid={`button-test-${integration.id}`}>
            {testing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <TestTube2 className="h-3 w-3 mr-1" />}
            Test Connection
          </Button>
          {!isStripe && integration.hasConfig && (
            <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending} data-testid={`button-disconnect-${integration.id}`}>
              {disconnectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Unplug className="h-3 w-3 mr-1" />}
              Disconnect
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function IntegrationsTab() {
  const [openConfigId, setOpenConfigId] = useState<string | null>(null);
  const { data, isLoading } = useQuery<{ integrations: any[] }>({
    queryKey: ["/api/admin/integrations"],
    queryFn: async () => {
      const res = await fetch("/api/admin/integrations", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const integrations = data?.integrations || [];
  const connected = integrations.filter(i => i.status === "connected");
  const configured = integrations.filter(i => i.status === "configured");
  const planned = integrations.filter(i => i.status === "planned");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Plug} label="Connected" value={connected.length} color="green" testId="stat-integrations-connected" />
        <StatCard icon={Settings} label="Configured" value={configured.length} color="amber" />
        <StatCard icon={Layers} label="Available" value={planned.length} color="blue" />
      </div>

      {openConfigId && (() => {
        const int = integrations.find(i => i.id === openConfigId);
        if (!int) return null;
        return (
          <IntegrationConfigPanel
            integration={int}
            onClose={() => setOpenConfigId(null)}
            onSaved={() => setOpenConfigId(null)}
          />
        );
      })()}

      <Card>
        <SectionTitle>External Integrations</SectionTitle>
        <p className="text-xs text-muted-foreground mb-4">Connect third-party services to extend analytics, monitoring, and support.</p>
        <div className="space-y-2">
          {integrations.map((int) => (
            <button
              key={int.id}
              onClick={() => setOpenConfigId(openConfigId === int.id ? null : int.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                openConfigId === int.id ? "border-primary/40 bg-primary/[0.03]" : "border-border/30 hover:border-border/60 hover:bg-muted/20"
              )}
              data-testid={`integration-card-${int.id}`}
            >
              <span className="text-xl shrink-0">{int.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{int.name}</p>
                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider", {
                    "bg-muted text-muted-foreground": int.category === "analytics",
                    "bg-blue-500/10 text-blue-600": int.category === "monitoring",
                    "bg-green-500/10 text-green-600": int.category === "payments",
                    "bg-purple-500/10 text-purple-600": int.category === "support",
                  })}>{int.category}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{int.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {int.enabled && int.status === "connected" && (
                  <Power className="h-3 w-3 text-green-500" />
                )}
                <IntegrationStatusBadge status={int.status} />
                <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", openConfigId === int.id && "rotate-90")} />
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Built-in Analytics</SectionTitle>
        <p className="text-xs text-muted-foreground mb-3">Active and tracking data automatically. No configuration needed.</p>
        <div className="space-y-2">
          {[
            { name: "Pageview Tracking", description: "Automatic tracking of all page visits with device, browser, and referrer data", icon: Eye },
            { name: "Event Tracking", description: "Custom event tracking for clicks, feature usage, and user interactions", icon: MousePointerClick },
            { name: "Error Logging", description: "Client-side JavaScript error capture with stack traces", icon: Bug },
            { name: "Messages", description: "Centralized inbox for support, sales, and feedback", icon: MessageSquare },
            { name: "User Profiles", description: "Detailed profiles with activity history, scripts, and rehearsal data", icon: Users },
          ].map((item) => (
            <div key={item.name} className="flex items-center gap-3 p-2.5 rounded-md">
              <div className="w-7 h-7 rounded-md bg-green-500/10 flex items-center justify-center shrink-0">
                <item.icon className="w-3.5 h-3.5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-[10px] text-muted-foreground">{item.description}</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function FunnelStep({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</p>
    </div>
  );
}
