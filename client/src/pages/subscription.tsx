import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  Check,
  Loader2,
  Crown,
  Mic,
  BookOpen,
  BarChart3,
  Headphones,
  Users,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SubscriptionData {
  subscription: {
    id: string;
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  tier: "free" | "pro";
}

interface StripeProduct {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: {
    id: string;
    unit_amount: number;
    currency: string;
    recurring: { interval: string };
  }[];
}

const proFeatures = [
  { icon: Sparkles, label: "Unlimited script rehearsals" },
  { icon: BookOpen, label: "Cloud script library" },
  { icon: Mic, label: "Watermark-free recordings" },
  { icon: BarChart3, label: "Performance tracking over time" },
  { icon: Headphones, label: "Hands-free rehearsal mode" },
  { icon: Users, label: "Priority support" },
];

const freeFeatures = [
  "3 script rehearsals per month",
  "All voice presets",
  "Performance feedback",
  "Multiplayer table reads",
  "Dark and light mode",
  "Keyboard shortcuts",
];

export function SubscriptionPage({ onBack }: { onBack: () => void }) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [billingPeriod, setBillingPeriod] = useState<"month" | "year">("month");

  const { data: subData, isLoading: subLoading } = useQuery<SubscriptionData>({
    queryKey: ["/api/stripe/subscription"],
    queryFn: async () => {
      const res = await fetch("/api/stripe/subscription", { credentials: "include" });
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: productsData, isLoading: productsLoading } = useQuery<{ products: StripeProduct[] }>({
    queryKey: ["/api/stripe/products"],
    queryFn: async () => {
      const res = await fetch("/api/stripe/products");
      return res.json();
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await apiRequest("POST", "/api/stripe/checkout", { priceId });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({ title: "Could not start checkout", description: error.message, variant: "destructive" });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/portal", {});
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({ title: "Could not open billing portal", description: error.message, variant: "destructive" });
    },
  });

  const isPro = subData?.tier === "pro";
  const proProduct = productsData?.products?.find(
    (p) => p.metadata?.tier === "pro" || p.name.toLowerCase().includes("pro")
  );

  const monthlyPrice = proProduct?.prices.find((p) => p.recurring?.interval === "month");
  const yearlyPrice = proProduct?.prices.find((p) => p.recurring?.interval === "year");
  const selectedPrice = billingPeriod === "month" ? monthlyPrice : yearlyPrice;

  const monthlyAmount = monthlyPrice ? monthlyPrice.unit_amount / 100 : 9;
  const yearlyAmount = yearlyPrice ? yearlyPrice.unit_amount / 100 : 79;
  const yearlyMonthly = Math.round((yearlyAmount / 12) * 100) / 100;
  const savingsPercent = Math.round((1 - yearlyMonthly / monthlyAmount) * 100);

  const isLoading = subLoading || productsLoading;

  return (
    <div className="min-h-screen bg-background">
      <header className="glass-surface sticky top-0 z-40 border-b border-border/40">
        <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-back"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-sm font-semibold">Subscription</h1>
          <div className="w-12" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : isPro ? (
          <ActiveSubscription
            subscription={subData!.subscription!}
            onManage={() => portalMutation.mutate()}
            isManaging={portalMutation.isPending}
          />
        ) : (
          <>
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                <Crown className="w-3.5 h-3.5" />
                Co-star Pro
              </div>
              <h2 className="text-xl font-semibold">Upgrade your rehearsals</h2>
              <p className="text-sm text-muted-foreground">
                Professional tools for serious actors
              </p>
            </div>

            <BillingToggle
              period={billingPeriod}
              onChange={setBillingPeriod}
              savingsPercent={savingsPercent}
            />

            <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-5 space-y-5">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold" data-testid="text-price">
                  ${billingPeriod === "month" ? monthlyAmount : yearlyAmount}
                </span>
                <span className="text-sm text-muted-foreground">
                  /{billingPeriod === "month" ? "mo" : "yr"}
                </span>
                {billingPeriod === "year" && (
                  <span className="ml-2 text-xs text-primary font-medium">
                    ${yearlyMonthly}/mo effective
                  </span>
                )}
              </div>

              <ul className="space-y-3">
                {proFeatures.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    {label}
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                size="lg"
                onClick={() => {
                  if (!isAuthenticated) {
                    window.location.href = "/api/login";
                    return;
                  }
                  if (selectedPrice) {
                    checkoutMutation.mutate(selectedPrice.id);
                  }
                }}
                disabled={checkoutMutation.isPending || !selectedPrice}
                data-testid="button-subscribe"
              >
                {checkoutMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {isAuthenticated ? "Subscribe to Pro" : "Sign in to subscribe"}
              </Button>
            </div>

            <div className="rounded-xl border border-border/40 p-5 space-y-4">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold">Free plan</h3>
                <span className="text-xs text-muted-foreground">Current</span>
              </div>
              <ul className="space-y-2">
                {freeFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-3.5 h-3.5 text-muted-foreground/60" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function BillingToggle({
  period,
  onChange,
  savingsPercent,
}: {
  period: "month" | "year";
  onChange: (p: "month" | "year") => void;
  savingsPercent: number;
}) {
  return (
    <div className="flex items-center justify-center gap-1 p-1 rounded-lg bg-muted/50">
      <button
        className={cn(
          "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all",
          period === "month"
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => onChange("month")}
        data-testid="button-monthly"
      >
        Monthly
      </button>
      <button
        className={cn(
          "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all relative",
          period === "year"
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => onChange("year")}
        data-testid="button-annual"
      >
        Annual
        {savingsPercent > 0 && (
          <span className="absolute -top-2 -right-1 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
            -{savingsPercent}%
          </span>
        )}
      </button>
    </div>
  );
}

function ActiveSubscription({
  subscription,
  onManage,
  isManaging,
}: {
  subscription: SubscriptionData["subscription"] & {};
  onManage: () => void;
  isManaging: boolean;
}) {
  const periodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Crown className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Co-star Pro</h2>
        <p className="text-sm text-muted-foreground">
          {subscription.cancelAtPeriodEnd
            ? `Access until ${periodEnd}`
            : `Renews ${periodEnd}`}
        </p>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium">Status</span>
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              subscription.cancelAtPeriodEnd
                ? "bg-amber-500/10 text-amber-600"
                : "bg-green-500/10 text-green-600"
            )}
            data-testid="text-subscription-status"
          >
            {subscription.cancelAtPeriodEnd ? "Canceling" : "Active"}
          </span>
        </div>

        <ul className="space-y-3 mb-5">
          {proFeatures.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              {label}
            </li>
          ))}
        </ul>

        <Button
          variant="outline"
          className="w-full"
          onClick={onManage}
          disabled={isManaging}
          data-testid="button-manage-subscription"
        >
          {isManaging ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <ExternalLink className="w-4 h-4 mr-2" />
          )}
          Manage subscription
        </Button>
      </div>
    </div>
  );
}
