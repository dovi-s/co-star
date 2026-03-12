import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  ArrowUpDown,
  PartyPopper,
  ArrowRight,
  Undo2,
  AlertCircle,
  Pause,
  Play,
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
    currentPriceId?: string | null;
    isPaused?: boolean;
    pausedUntil?: string | null;
  } | null;
  tier: string;
  isPro?: boolean;
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
  const [pollCount, setPollCount] = useState(0);
  const maxPolls = 10;

  const { data: subData, isLoading: subLoading, error: subError } = useQuery<SubscriptionData>({
    queryKey: ["/api/stripe/subscription"],
    queryFn: async () => {
      const res = await fetch("/api/stripe/subscription", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load subscription");
      return res.json();
    },
    enabled: isAuthenticated,
    retry: 1,
    refetchInterval: checkoutSuccess && !shownSuccess && pollCount < maxPolls ? 2000 : false,
  });

  useEffect(() => {
    if (checkoutSuccess && !shownSuccess && subData) {
      if (subData.tier === "pro" || (subData as any).isPro) {
        setShownSuccess(true);
        const isTrialing = subData.subscription?.isTrialing;
        toast({
          title: isTrialing ? "Your guest pass is active" : "Welcome to Co-star Pro",
          description: isTrialing
            ? "Enjoy 7 days of unlimited rehearsals. You won't be charged until your guest pass ends."
            : "Your subscription is active. Enjoy unlimited rehearsals.",
        });
      } else {
        setPollCount((c) => c + 1);
        if (pollCount >= maxPolls) {
          setShownSuccess(true);
          toast({
            title: "Payment received",
            description: "Your subscription is being activated. It may take a moment to reflect.",
          });
        }
      }
    }
  }, [checkoutSuccess, shownSuccess, subData, toast, pollCount]);

  const isAwaitingActivation = checkoutSuccess && !shownSuccess && pollCount < maxPolls;

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
        {isLoading || isAwaitingActivation ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            {isAwaitingActivation && (
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">Activating your subscription...</p>
                <p className="text-xs text-muted-foreground">This usually takes just a moment.</p>
              </div>
            )}
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
        ) : checkoutSuccess && shownSuccess && isPro ? (
          <CheckoutConfirmation
            subscription={subData?.subscription ?? null}
            onContinue={onBack}
          />
        ) : isPro && subData?.subscription ? (
          <ActiveSubscription
            subscription={subData.subscription}
            onManage={() => portalMutation.mutate()}
            isManaging={portalMutation.isPending}
            monthlyPrice={monthlyPrice}
            yearlyPrice={yearlyPrice}
            monthlyAmount={monthlyAmount}
            yearlyAmount={yearlyAmount}
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
          <FreeUserUpgrade
            isAuthenticated={isAuthenticated}
            billingPeriod={billingPeriod}
            setBillingPeriod={setBillingPeriod}
            monthlyAmount={monthlyAmount}
            yearlyAmount={yearlyAmount}
            yearlyMonthly={yearlyMonthly}
            savingsPercent={savingsPercent}
            selectedPrice={selectedPrice}
            checkoutMutation={checkoutMutation}
          />
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

function CheckoutConfirmation({
  subscription,
  onContinue,
}: {
  subscription: SubscriptionData["subscription"];
  onContinue: () => void;
}) {
  const isTrialing = subscription?.isTrialing === true;
  const trialDaysLeft = subscription?.trialDaysLeft ?? 7;

  const trialEndDate = subscription?.trialEnd
    ? new Date(typeof subscription.trialEnd === "number" && (subscription.trialEnd as any) < 1e12 ? (subscription.trialEnd as any) * 1000 : subscription.trialEnd)
    : null;
  const trialEndFormatted = trialEndDate
    ? trialEndDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="text-center space-y-6 py-8" data-testid="checkout-confirmation">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
        <PartyPopper className="w-8 h-8 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold" data-testid="text-confirmation-title">
          {isTrialing ? "Your guest pass is active!" : "Welcome to Co-star Pro!"}
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          {isTrialing
            ? `You have ${trialDaysLeft} days to explore every Pro feature — completely free.${trialEndFormatted ? ` You won't be charged until ${trialEndFormatted}.` : " You won't be charged until your guest pass ends."}`
            : "Your subscription is active. You now have full access to unlimited rehearsals and every Pro feature."}
        </p>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-5 space-y-3 text-left max-w-sm mx-auto">
        <p className="text-xs font-semibold text-primary uppercase tracking-wider">What's unlocked</p>
        <ul className="space-y-2.5">
          {proFeatures.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3 text-sm">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-3.5 h-3.5 text-primary" />
              </div>
              {label}
            </li>
          ))}
        </ul>
      </div>

      <Button
        size="lg"
        className="w-full max-w-sm"
        onClick={onContinue}
        data-testid="button-start-rehearsing"
      >
        Start rehearsing
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}

function FreeUserUpgrade({
  isAuthenticated,
  billingPeriod,
  setBillingPeriod,
  monthlyAmount,
  yearlyAmount,
  yearlyMonthly,
  savingsPercent,
  selectedPrice,
  checkoutMutation,
}: {
  isAuthenticated: boolean;
  billingPeriod: "month" | "year";
  setBillingPeriod: (p: "month" | "year") => void;
  monthlyAmount: number;
  yearlyAmount: number;
  yearlyMonthly: number;
  savingsPercent: number;
  selectedPrice?: { id: string };
  checkoutMutation: { mutate: (id: string) => void; isPending: boolean };
}) {
  const hasTrialHistory = false;

  return (
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
          {!isAuthenticated
            ? "Sign in to get started"
            : "Start your guest pass"}
        </Button>
        <p className="text-[11px] text-muted-foreground text-center">
          No charge until your guest pass ends. Cancel anytime.
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
  );
}

function ActiveSubscription({
  subscription,
  onManage,
  isManaging,
  monthlyPrice,
  yearlyPrice,
  monthlyAmount,
  yearlyAmount,
}: {
  subscription: SubscriptionData["subscription"] & {};
  onManage: () => void;
  isManaging: boolean;
  monthlyPrice?: { id: string; unit_amount: number; currency: string; recurring: { interval: string } };
  yearlyPrice?: { id: string; unit_amount: number; currency: string; recurring: { interval: string } };
  monthlyAmount: number;
  yearlyAmount: number;
}) {
  const { toast } = useToast();
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
  const [switchConfirmOpen, setSwitchConfirmOpen] = useState(false);
  const isTrialing = subscription.isTrialing === true;

  const reactivateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/reactivate", {});
      return res.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["/api/stripe/subscription"] });
      const previous = queryClient.getQueryData<SubscriptionData>(["/api/stripe/subscription"]);
      if (previous?.subscription) {
        queryClient.setQueryData<SubscriptionData>(["/api/stripe/subscription"], {
          ...previous,
          subscription: { ...previous.subscription, cancelAtPeriodEnd: false },
        });
      }
      return { previous };
    },
    onSuccess: () => {
      toast({ title: "Welcome back!", description: "Your plan is active again. No interruption to your access." });
      queryClient.invalidateQueries({ queryKey: ["/api/stripe/subscription"] });
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/stripe/subscription"], context.previous);
      }
      toast({ title: "Could not reactivate", description: error.message, variant: "destructive" });
    },
  });

  const unpauseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/unpause", {});
      return res.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["/api/stripe/subscription"] });
      const previous = queryClient.getQueryData<SubscriptionData>(["/api/stripe/subscription"]);
      if (previous?.subscription) {
        queryClient.setQueryData<SubscriptionData>(["/api/stripe/subscription"], {
          ...previous,
          subscription: { ...previous.subscription, isPaused: false, pausedUntil: null },
        });
      }
      return { previous };
    },
    onSuccess: () => {
      toast({ title: "Billing resumed", description: "Your plan is fully active again." });
      queryClient.invalidateQueries({ queryKey: ["/api/stripe/subscription"] });
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/stripe/subscription"], context.previous);
      }
      toast({ title: "Could not resume", description: error.message, variant: "destructive" });
    },
  });

  const currentPriceId = subscription.currentPriceId;
  const isMonthly = currentPriceId === monthlyPrice?.id;
  const isYearly = currentPriceId === yearlyPrice?.id;
  const canSwitch = (isMonthly && yearlyPrice) || (isYearly && monthlyPrice);
  const switchTargetLabel = isMonthly ? "annual" : "monthly";
  const switchTargetPrice = isMonthly ? yearlyPrice : monthlyPrice;
  const switchTargetAmount = isMonthly ? yearlyAmount : monthlyAmount;
  const switchTargetInterval = isMonthly ? "year" : "month";

  const switchPlanMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await apiRequest("POST", "/api/stripe/switch-plan", { priceId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Plan updated", description: `Switched to ${switchTargetLabel} billing.` });
      setSwitchConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/stripe/subscription"] });
    },
    onError: (error: Error) => {
      toast({ title: "Could not switch plan", description: error.message, variant: "destructive" });
    },
  });
  const trialDaysLeft = subscription.trialDaysLeft ?? 0;

  const formatDate = (val: string | number | null | undefined): string | null => {
    if (!val) return null;
    const d = new Date(typeof val === "number" && val < 1e12 ? val * 1000 : val);
    return isNaN(d.getTime()) ? null : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  const periodEndDate = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
  const periodEnd = formatDate(subscription.currentPeriodEnd);
  const trialEndFormatted = formatDate(subscription.trialEnd);
  const pausedUntilFormatted = formatDate(subscription.pausedUntil);
  const isPaused = subscription.isPaused === true;

  const statusLabel = subscription.cancelAtPeriodEnd
    ? "Canceling"
    : isPaused
    ? "Paused"
    : isTrialing
    ? "Guest pass"
    : "Active";

  const statusColor = subscription.cancelAtPeriodEnd
    ? "bg-amber-500/10 text-amber-600"
    : isPaused
    ? "bg-orange-500/10 text-orange-600"
    : isTrialing
    ? "bg-blue-500/10 text-blue-600"
    : "bg-green-500/10 text-green-600";

  return (
    <div className="space-y-6">
      {subscription.cancelAtPeriodEnd && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4 space-y-3" data-testid="banner-cancellation-pending">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Cancellation scheduled</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {periodEnd
                  ? `Your Pro plan will end on ${periodEnd}. You'll keep full access until then.`
                  : "Your Pro plan will end at the end of your billing period. You'll keep full access until then."}
              </p>
            </div>
          </div>
          <Button
            className="w-full"
            size="sm"
            onClick={() => reactivateMutation.mutate()}
            disabled={reactivateMutation.isPending}
            data-testid="button-reactivate-plan"
          >
            {reactivateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Undo2 className="w-4 h-4 mr-2" />
            )}
            Keep my plan
          </Button>
        </div>
      )}

      {isPaused && !subscription.cancelAtPeriodEnd && (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/[0.06] p-4 space-y-3" data-testid="banner-paused">
          <div className="flex items-start gap-3">
            <Pause className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Plan paused</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pausedUntilFormatted
                  ? `Your billing is paused. It will automatically resume on ${pausedUntilFormatted}.`
                  : "Your billing is paused. It will automatically resume soon."}
                {" "}You still have full Pro access.
              </p>
            </div>
          </div>
          <Button
            className="w-full"
            size="sm"
            onClick={() => unpauseMutation.mutate()}
            disabled={unpauseMutation.isPending}
            data-testid="button-unpause-plan"
          >
            {unpauseMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Resume billing
          </Button>
        </div>
      )}

      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Crown className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold" data-testid="text-plan-title">Co-star Pro</h2>
        {(isMonthly || isYearly) && !isTrialing && (
          <span className="inline-block text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full" data-testid="text-current-plan-interval">
            {isMonthly ? `$${monthlyAmount}/month` : `$${yearlyAmount}/year`}
          </span>
        )}
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
          <p className="text-sm text-muted-foreground" data-testid="text-billing-info">
            {subscription.cancelAtPeriodEnd
              ? `Active until ${periodEnd || "end of billing period"}`
              : isPaused
              ? `Paused · Resumes ${pausedUntilFormatted || "soon"}`
              : periodEnd
              ? `Renews ${periodEnd}`
              : "Active subscription"}
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
          {canSwitch && !subscription.cancelAtPeriodEnd && (
            <>
              {!switchConfirmOpen ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setSwitchConfirmOpen(true)}
                  data-testid="button-switch-plan"
                >
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  Switch to {switchTargetLabel}
                  {isMonthly && (
                    <span className="ml-1 text-xs text-primary font-medium">Save {Math.round((1 - (yearlyAmount / 12) / monthlyAmount) * 100)}%</span>
                  )}
                </Button>
              ) : (
                <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-4 space-y-3">
                  <p className="text-sm font-medium">Switch to {switchTargetLabel} billing?</p>
                  <p className="text-xs text-muted-foreground">
                    {isMonthly
                      ? `You'll be charged $${yearlyAmount}/${switchTargetInterval} instead of $${monthlyAmount}/month. A prorated credit for your current billing period will be applied.`
                      : `You'll be charged $${monthlyAmount}/${switchTargetInterval} instead of $${yearlyAmount}/year. A prorated credit for your remaining annual period will be applied.`
                    }
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => switchTargetPrice && switchPlanMutation.mutate(switchTargetPrice.id)}
                      disabled={switchPlanMutation.isPending}
                      data-testid="button-confirm-switch"
                    >
                      {switchPlanMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : null}
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1"
                      onClick={() => setSwitchConfirmOpen(false)}
                      disabled={switchPlanMutation.isPending}
                      data-testid="button-cancel-switch"
                    >
                      Never mind
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

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
      />
    </div>
  );
}
