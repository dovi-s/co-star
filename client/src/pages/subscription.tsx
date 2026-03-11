import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CancelRetentionSheet } from "@/components/cancel-retention-sheet";
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
  GraduationCap,
  Building2,
  Mail,
  Gift,
  Calendar,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SubscriptionData {
  subscription: {
    id: string;
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    isTrialing?: boolean;
    trialEnd?: string | null;
    trialDaysLeft?: number | null;
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
  "3 rehearsals per day",
  "All voice presets",
  "Performance feedback",
  "Multiplayer table reads",
  "Dark and light mode",
  "Keyboard shortcuts",
];

export function SubscriptionPage({ onBack, checkoutSuccess }: { onBack: () => void; checkoutSuccess?: boolean }) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [billingPeriod, setBillingPeriod] = useState<"month" | "year">("month");
  const [shownSuccess, setShownSuccess] = useState(false);

  const { data: subData, isLoading: subLoading, error: subError } = useQuery<SubscriptionData>({
    queryKey: ["/api/stripe/subscription"],
    queryFn: async () => {
      const res = await fetch("/api/stripe/subscription", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load subscription");
      return res.json();
    },
    enabled: isAuthenticated,
    retry: 1,
  });

  useEffect(() => {
    if (checkoutSuccess && !shownSuccess && subData?.tier === "pro") {
      setShownSuccess(true);
      const isTrialing = subData.subscription?.isTrialing;
      toast({
        title: isTrialing ? "Your guest pass is active" : "Welcome to Co-star Pro",
        description: isTrialing
          ? "Enjoy 7 days of unlimited rehearsals. You won't be charged until your guest pass ends."
          : "Your subscription is active. Enjoy unlimited rehearsals.",
      });
    }
  }, [checkoutSuccess, shownSuccess, subData, toast]);

  const { data: productsData, isLoading: productsLoading, error: productsError } = useQuery<{ products: StripeProduct[] }>({
    queryKey: ["/api/stripe/products"],
    queryFn: async () => {
      const res = await fetch("/api/stripe/products");
      if (!res.ok) throw new Error("Failed to load products");
      return res.json();
    },
    retry: 1,
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

  const isPro = subData?.isPro || subData?.tier === "pro" || (!!subData?.tier && ["comp", "internal"].includes(subData.tier));
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
  const hasError = subError || productsError;

  return (
    <div className="min-h-screen bg-background">
      <header className="glass-surface sticky top-0 z-40 border-b border-border/40 safe-top">
        <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto">
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

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : hasError ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Unable to load subscription</h3>
              <p className="text-sm text-muted-foreground">Please try again in a moment.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()} data-testid="button-retry-subscription">
              Try again
            </Button>
          </div>
        ) : isPro && subData?.subscription ? (
          <ActiveSubscription
            subscription={subData.subscription}
            onManage={() => portalMutation.mutate()}
            isManaging={portalMutation.isPending}
          />
        ) : isPro ? (
          <div className="text-center space-y-4 py-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Crown className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold" data-testid="text-plan-title">Co-star Pro</h2>
            <p className="text-sm text-muted-foreground">Your Pro access is active. Enjoy unlimited rehearsals.</p>
            <div className="space-y-2 text-left max-w-xs mx-auto">
              {proFeatures.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4 h-4 text-primary shrink-0" />
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                <Gift className="w-3.5 h-3.5" />
                7-day guest pass
              </div>
              <h2 className="text-xl font-semibold" data-testid="text-subscription-headline">Unlock unlimited rehearsals — on us for a week</h2>
              <p className="text-sm text-muted-foreground">
                Try every Pro feature free. Cancel anytime, no questions asked.
              </p>
            </div>

            <BillingToggle
              period={billingPeriod}
              onChange={setBillingPeriod}
              savingsPercent={savingsPercent}
            />

            <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-5 space-y-5">
              <div className="text-center">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold" data-testid="text-price">
                    ${billingPeriod === "month" ? monthlyAmount : yearlyMonthly}
                  </span>
                  <span className="text-sm text-muted-foreground">/mo</span>
                </div>
                {billingPeriod === "year" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Billed as ${yearlyAmount}/year
                  </p>
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
                {isAuthenticated ? "Start your guest pass" : "Sign in to get your guest pass"}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                No charge until your trial ends. Cancel anytime.
              </p>
            </div>

            <TrialItinerary />

            <div className="rounded-xl border border-border/40 p-5 space-y-4">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold">Free plan</h3>
                <span className="text-xs text-muted-foreground">Current</span>
              </div>
              <ul className="space-y-2">
                {freeFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-3.5 h-3.5 text-muted-foreground" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

          </>
        )}

        <div className="pt-4 space-y-4">
          <p className="text-xs text-muted-foreground text-center">Need something bigger?</p>

          <div className="rounded-xl border border-border/40 p-5 space-y-4" data-testid="card-education-plan">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <GraduationCap className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold" data-testid="text-education-title">Education</h3>
                <p className="text-[11px] text-muted-foreground" data-testid="text-education-description">Drama programs, universities, language courses</p>
              </div>
            </div>
            <ul className="space-y-2">
              {[
                "Bulk seats for students and faculty",
                "Shared script library for classes",
                "Usage analytics per student",
                "Academic pricing available",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-3.5 h-3.5 text-primary/60" />
                  {f}
                </li>
              ))}
            </ul>
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

          <div className="rounded-xl border border-border/40 p-5 space-y-4" data-testid="card-teams-plan">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold" data-testid="text-teams-title">Teams</h3>
                <p className="text-[11px] text-muted-foreground" data-testid="text-teams-description">Sales, corporate training, medical programs</p>
              </div>
            </div>
            <ul className="space-y-2">
              {[
                "Team management and seat allocation",
                "Custom script templates",
                "Team-wide performance analytics",
                "Priority onboarding and support",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-3.5 h-3.5 text-primary/60" />
                  {f}
                </li>
              ))}
            </ul>
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
      </main>
    </div>
  );
}

const trialSteps = [
  { day: "Day 1", label: "Unlimited rehearsals unlocked", icon: Sparkles },
  { day: "Day 3", label: "Full performance history", icon: BarChart3 },
  { day: "Day 5", label: "All voice presets & hands-free mode", icon: Headphones },
  { day: "Day 7", label: "You decide — keep Pro or go back to free", icon: Shield },
];

function TrialItinerary() {
  return (
    <div className="rounded-xl border border-border/40 p-5 space-y-4" data-testid="card-trial-itinerary">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Your guest pass, day by day</h3>
      </div>
      <div className="relative space-y-0">
        {trialSteps.map(({ day, label, icon: Icon }, i) => (
          <div key={day} className="flex items-start gap-3 relative" data-testid={`trial-step-${i}`}>
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 z-10 relative">
                <Icon className="w-3.5 h-3.5 text-primary" />
              </div>
              {i < trialSteps.length - 1 && (
                <div className="w-px h-6 bg-border/60" />
              )}
            </div>
            <div className="pt-1.5 pb-4">
              <span className="text-[11px] font-semibold text-primary">{day}</span>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>
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
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
  const isTrialing = subscription.isTrialing === true;
  const trialDaysLeft = subscription.trialDaysLeft ?? 0;

  const rawEnd = subscription.currentPeriodEnd;
  const periodEndDate = rawEnd
    ? new Date(typeof rawEnd === "number" && rawEnd < 1e12 ? rawEnd * 1000 : rawEnd)
    : null;
  const periodEnd = periodEndDate
    ? periodEndDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const trialEndDate = subscription.trialEnd
    ? new Date(typeof subscription.trialEnd === "number" && (subscription.trialEnd as any) < 1e12 ? (subscription.trialEnd as any) * 1000 : subscription.trialEnd)
    : null;
  const trialEndFormatted = trialEndDate
    ? trialEndDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  const statusLabel = subscription.cancelAtPeriodEnd
    ? "Canceling"
    : isTrialing
    ? "Guest pass"
    : "Active";

  const statusColor = subscription.cancelAtPeriodEnd
    ? "bg-amber-500/10 text-amber-600"
    : isTrialing
    ? "bg-blue-500/10 text-blue-600"
    : "bg-green-500/10 text-green-600";

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Crown className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold" data-testid="text-plan-title">Co-star Pro</h2>
        {isTrialing ? (
          <p className="text-sm text-muted-foreground" data-testid="text-trial-info">
            {trialDaysLeft > 1
              ? `${trialDaysLeft} days left on your guest pass`
              : trialDaysLeft === 1
              ? "Last day of your guest pass"
              : "Your guest pass ends today"}
            {trialEndFormatted && ` · Billing starts ${trialEndFormatted}`}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {subscription.cancelAtPeriodEnd
              ? `Access until ${periodEnd}`
              : `Renews ${periodEnd}`}
          </p>
        )}
      </div>

      {isTrialing && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium">Guest pass active</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.max(5, ((7 - trialDaysLeft) / 7) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            You won't be charged until your guest pass ends. Cancel anytime before then.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium">Status</span>
          <span
            className={cn("text-xs font-medium px-2 py-0.5 rounded-full", statusColor)}
            data-testid="text-subscription-status"
          >
            {statusLabel}
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

        <div className="space-y-2">
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
            Manage billing
          </Button>

          {!subscription.cancelAtPeriodEnd && (
            <button
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
              onClick={() => setCancelSheetOpen(true)}
              data-testid="button-cancel-plan"
            >
              Cancel plan
            </button>
          )}
        </div>
      </div>

      <CancelRetentionSheet
        open={cancelSheetOpen}
        onOpenChange={setCancelSheetOpen}
        periodEnd={periodEndDate ? periodEndDate.toISOString() : null}
        onGoToPortal={onManage}
      />
    </div>
  );
}
