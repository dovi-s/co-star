import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";

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
  revenue: {
    mrr: number;
    totalSubscriptions: number;
    activeSubscriptions: number;
  };
}

type Tab = "overview" | "users" | "traffic" | "usage" | "revenue";

export function AdminDashboard({ onBack }: { onBack: () => void }) {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");

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

  return (
    <div className="min-h-screen bg-background">
      <header className="glass-surface sticky top-0 z-40 border-b border-border/40">
        <div className="flex items-center justify-between px-4 h-14 max-w-5xl mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-back"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-sm font-semibold">Analytics</h1>
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
              refetch();
            }}
            className="text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <nav className="border-b border-border/30 overflow-x-auto">
        <div className="flex max-w-5xl mx-auto px-4">
          {(["overview", "users", "traffic", "usage", "revenue"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-3 text-xs font-medium capitalize whitespace-nowrap border-b-2 transition-colors",
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              data-testid={`tab-${t}`}
            >
              {t}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-sm">Could not load analytics. Make sure you are signed in.</p>
          </div>
        ) : data ? (
          <>
            {tab === "overview" && <OverviewTab data={data} />}
            {tab === "users" && <UsersTab data={data} />}
            {tab === "traffic" && <TrafficTab data={data} />}
            {tab === "usage" && <UsageTab data={data} />}
            {tab === "revenue" && <RevenueTab data={data} />}
          </>
        ) : null}
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "primary",
  testId,
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  testId?: string;
}) {
  const colorClasses: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    green: "bg-green-500/10 text-green-600",
    amber: "bg-amber-500/10 text-amber-600",
    blue: "bg-blue-500/10 text-blue-600",
    purple: "bg-purple-500/10 text-purple-600",
  };

  return (
    <div className="rounded-xl border border-border/40 p-4 space-y-2" data-testid={testId}>
      <div className="flex items-center gap-2">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", colorClasses[color])}>
          <Icon className="w-4 h-4" />
        </div>
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

function SparklineChart({ data, height = 48 }: { data: number[]; height?: number }) {
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
  const pathD = `M${points.join(" L")}`;
  const fillPoints = `${points.join(" L")} L${w},${height} L0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }}>
      <path d={`M${fillPoints}`} fill="hsl(var(--primary) / 0.08)" />
      <polyline points={points.join(" ")} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold mb-3">{children}</h3>;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// === TABS ===

function OverviewTab({ data }: { data: AnalyticsData }) {
  const freeCount = data.users.tierBreakdown.find((t) => t.tier === "free");
  const proCount = data.users.tierBreakdown.find((t) => t.tier === "pro");
  const conversionRate = data.users.total > 0
    ? ((Number(proCount?.count || 0) / data.users.total) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total Users" value={data.users.total} sub={`+${data.users.last7d} this week`} testId="stat-total-users" />
        <StatCard icon={Eye} label="Visitors (30d)" value={data.pageviews.unique30d} sub={`${data.pageviews.uniqueToday} today`} color="blue" testId="stat-visitors" />
        <StatCard icon={DollarSign} label="MRR" value={`$${data.revenue.mrr}`} sub={`${data.revenue.activeSubscriptions} active`} color="green" testId="stat-mrr" />
        <StatCard icon={Activity} label="Rehearsals" value={data.usage.totalRuns} sub={`${data.usage.runs30d} this month`} color="purple" testId="stat-runs" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/40 p-4">
          <SectionTitle>Signups (30 days)</SectionTitle>
          <SparklineChart data={data.users.signupsByDay.map((d) => Number(d.count))} />
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
            {data.users.signupsByDay.length > 0 && (
              <>
                <span>{formatDate(data.users.signupsByDay[0].date)}</span>
                <span>{formatDate(data.users.signupsByDay[data.users.signupsByDay.length - 1].date)}</span>
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/40 p-4">
          <SectionTitle>Pageviews (30 days)</SectionTitle>
          <SparklineChart data={data.pageviews.byDay.map((d) => Number(d.views))} />
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
            {data.pageviews.byDay.length > 0 && (
              <>
                <span>{formatDate(data.pageviews.byDay[0].date)}</span>
                <span>{formatDate(data.pageviews.byDay[data.pageviews.byDay.length - 1].date)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/40 p-4">
          <SectionTitle>User Tiers</SectionTitle>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Free</span>
              <span className="font-medium">{freeCount?.count || 0}</span>
            </div>
            <MiniBar value={Number(freeCount?.count || 0)} max={data.users.total} color="bg-muted-foreground/40" />
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-primary">
                <Crown className="w-3 h-3" /> Pro
              </span>
              <span className="font-medium">{proCount?.count || 0}</span>
            </div>
            <MiniBar value={Number(proCount?.count || 0)} max={data.users.total} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">{conversionRate}% conversion rate</p>
        </div>

        <div className="rounded-xl border border-border/40 p-4">
          <SectionTitle>Devices (30d)</SectionTitle>
          <div className="space-y-2">
            {data.pageviews.deviceBreakdown.map((d) => {
              const DeviceIcon = d.device === "mobile" ? Smartphone : d.device === "tablet" ? Tablet : Monitor;
              const total = data.pageviews.deviceBreakdown.reduce((s, x) => s + Number(x.count), 0);
              const pct = total > 0 ? ((Number(d.count) / total) * 100).toFixed(0) : "0";
              return (
                <div key={d.device} className="flex items-center gap-2 text-sm">
                  <DeviceIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="capitalize flex-1">{d.device}</span>
                  <span className="text-xs text-muted-foreground">{pct}%</span>
                  <span className="font-medium w-12 text-right">{d.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border/40 p-4">
          <SectionTitle>Browsers (30d)</SectionTitle>
          <div className="space-y-2">
            {data.pageviews.browserBreakdown.map((b) => {
              const total = data.pageviews.browserBreakdown.reduce((s, x) => s + Number(x.count), 0);
              const pct = total > 0 ? ((Number(b.count) / total) * 100).toFixed(0) : "0";
              return (
                <div key={b.browser} className="flex items-center gap-2 text-sm">
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="capitalize flex-1">{b.browser}</span>
                  <span className="text-xs text-muted-foreground">{pct}%</span>
                  <span className="font-medium w-12 text-right">{b.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersTab({ data }: { data: AnalyticsData }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total Users" value={data.users.total} testId="stat-users-total" />
        <StatCard icon={TrendingUp} label="Today" value={data.users.today} color="green" />
        <StatCard icon={TrendingUp} label="This Week" value={data.users.last7d} color="blue" />
        <StatCard icon={TrendingUp} label="This Month" value={data.users.last30d} color="purple" />
      </div>

      <div className="rounded-xl border border-border/40 p-4">
        <SectionTitle>Signup Trend (30 days)</SectionTitle>
        <SparklineChart data={data.users.signupsByDay.map((d) => Number(d.count))} height={64} />
        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
          {data.users.signupsByDay.length > 0 && (
            <>
              <span>{formatDate(data.users.signupsByDay[0].date)}</span>
              <span>{formatDate(data.users.signupsByDay[data.users.signupsByDay.length - 1].date)}</span>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/30">
          <SectionTitle>Recent Users</SectionTitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 text-left">
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground">User</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Tier</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Onboarded</th>
                <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Joined</th>
              </tr>
            </thead>
            <tbody>
              {data.users.recentUsers.map((u) => (
                <tr key={u.id} className="border-t border-border/20 hover:bg-muted/20">
                  <td className="px-4 py-2.5">
                    <span className="font-medium">
                      {[u.firstName, u.lastName].filter(Boolean).join(" ") || "Anonymous"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{u.email || "-"}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                        u.subscriptionTier === "pro"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {u.subscriptionTier || "free"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {u.onboardingComplete === "true" ? (
                      <span className="text-green-600">Yes</span>
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatTime(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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

      <div className="rounded-xl border border-border/40 p-4">
        <SectionTitle>Traffic Trend (30 days)</SectionTitle>
        <SparklineChart data={data.pageviews.byDay.map((d) => Number(d.views))} height={64} />
        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
          {data.pageviews.byDay.length > 0 && (
            <>
              <span>{formatDate(data.pageviews.byDay[0].date)}</span>
              <span>{formatDate(data.pageviews.byDay[data.pageviews.byDay.length - 1].date)}</span>
            </>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/40 p-4">
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
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border/40 p-4">
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
            ) : (
              <p className="text-xs text-muted-foreground">No referrer data yet</p>
            )}
          </div>

          <div className="rounded-xl border border-border/40 p-4">
            <SectionTitle>Daily Breakdown</SectionTitle>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {[...data.pageviews.byDay].reverse().slice(0, 14).map((d) => (
                <div key={d.date} className="flex items-center gap-2 text-xs">
                  <span className="w-16 text-muted-foreground">{formatDate(d.date)}</span>
                  <MiniBar value={Number(d.views)} max={Math.max(...data.pageviews.byDay.map((x) => Number(x.views)), 1)} />
                  <span className="w-8 text-right font-medium">{d.views}</span>
                  <span className="w-8 text-right text-muted-foreground">{d.visitors}u</span>
                </div>
              ))}
            </div>
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
        <StatCard
          icon={BarChart3}
          label="Avg Accuracy"
          value={data.usage.avgAccuracy > 0 ? `${(data.usage.avgAccuracy * 100).toFixed(0)}%` : "-"}
          color="green"
        />
        <StatCard
          icon={Clock}
          label="Avg Duration"
          value={data.usage.avgDuration > 0 ? `${Math.round(data.usage.avgDuration / 60)}m` : "-"}
          color="purple"
        />
      </div>

      <div className="rounded-xl border border-border/40 p-4">
        <SectionTitle>Rehearsals (30 days)</SectionTitle>
        <SparklineChart data={data.usage.runsByDay.map((d) => Number(d.count))} height={64} />
        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
          {data.usage.runsByDay.length > 0 && (
            <>
              <span>{formatDate(data.usage.runsByDay[0].date)}</span>
              <span>{formatDate(data.usage.runsByDay[data.usage.runsByDay.length - 1].date)}</span>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/40 p-4">
        <SectionTitle>Top Feature Requests</SectionTitle>
        {data.featureRequests.top.length > 0 ? (
          <div className="space-y-2">
            {data.featureRequests.top.map((f, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Lightbulb className="w-3 h-3 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm">{f.title}</span>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground capitalize">{f.category}</span>
                    <span className={cn(
                      "text-[10px] px-1 rounded",
                      f.status === "open" ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
                    )}>
                      {f.status}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-medium">{f.vote_count} votes</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No feature requests yet</p>
        )}
      </div>
    </div>
  );
}

function RevenueTab({ data }: { data: AnalyticsData }) {
  const freeCount = Number(data.users.tierBreakdown.find((t) => t.tier === "free")?.count || 0);
  const proCount = Number(data.users.tierBreakdown.find((t) => t.tier === "pro")?.count || 0);
  const conversionRate = data.users.total > 0 ? ((proCount / data.users.total) * 100).toFixed(1) : "0";
  const arr = data.revenue.mrr * 12;
  const arpu = data.users.total > 0 ? (data.revenue.mrr / data.users.total).toFixed(2) : "0";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={DollarSign} label="MRR" value={`$${data.revenue.mrr}`} sub={`$${arr} ARR`} color="green" testId="stat-revenue-mrr" />
        <StatCard icon={Crown} label="Pro Subscribers" value={data.revenue.activeSubscriptions} color="primary" />
        <StatCard icon={TrendingUp} label="Conversion" value={`${conversionRate}%`} sub={`${proCount} of ${data.users.total}`} color="blue" />
        <StatCard icon={DollarSign} label="ARPU" value={`$${arpu}`} sub="per user per month" color="purple" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/40 p-5">
          <SectionTitle>Subscription Funnel</SectionTitle>
          <div className="space-y-4 mt-4">
            <FunnelStep label="Total Users" value={data.users.total} pct={100} color="bg-blue-500" />
            <FunnelStep label="Onboarded" value={data.users.recentUsers.filter((u) => u.onboardingComplete === "true").length} pct={data.users.total > 0 ? (data.users.recentUsers.filter((u) => u.onboardingComplete === "true").length / data.users.total) * 100 : 0} color="bg-primary" />
            <FunnelStep label="Free" value={freeCount} pct={data.users.total > 0 ? (freeCount / data.users.total) * 100 : 0} color="bg-muted-foreground/50" />
            <FunnelStep label="Pro" value={proCount} pct={data.users.total > 0 ? (proCount / data.users.total) * 100 : 0} color="bg-green-500" />
          </div>
        </div>

        <div className="rounded-xl border border-border/40 p-5">
          <SectionTitle>Revenue Summary</SectionTitle>
          <div className="space-y-4 mt-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Monthly recurring</span>
              <span className="font-semibold">${data.revenue.mrr}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Annual run rate</span>
              <span className="font-semibold">${arr}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Active subscriptions</span>
              <span className="font-semibold">{data.revenue.activeSubscriptions}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total subscriptions</span>
              <span className="font-semibold">{data.revenue.totalSubscriptions}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg revenue per user</span>
              <span className="font-semibold">${arpu}/mo</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Free tier users</span>
              <span className="font-semibold">{freeCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FunnelStep({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: number;
  pct: number;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</p>
    </div>
  );
}
