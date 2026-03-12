import { useState, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  BookOpen,
  Mic,
  BarChart3,
  Headphones,
  Users,
  Pause,
  Loader2,
  Heart,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CancelRetentionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodEnd: string | null;
}

const cancelReasons = [
  { id: "too_expensive", label: "Too expensive" },
  { id: "not_using", label: "Not using it enough" },
  { id: "missing_features", label: "Missing features I need" },
  { id: "found_alternative", label: "Found an alternative" },
  { id: "other", label: "Other" },
] as const;

type CancelReason = typeof cancelReasons[number]["id"];

const lostFeatures = [
  { icon: Sparkles, label: "Unlimited script rehearsals", fallback: "Limited to 3 per day" },
  { icon: BookOpen, label: "Cloud script library", fallback: "Scripts stay on-device only" },
  { icon: Mic, label: "Watermark-free recordings", fallback: "Recordings will have watermark" },
  { icon: BarChart3, label: "Performance tracking over time", fallback: "No historical analytics" },
  { icon: Headphones, label: "Hands-free rehearsal mode", fallback: "Manual controls only" },
  { icon: Users, label: "Priority support", fallback: "Standard support" },
];

type Step = "features" | "feedback" | "confirming" | "done";

export function CancelRetentionSheet({ open, onOpenChange, periodEnd }: CancelRetentionSheetProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("features");
  const [reason, setReason] = useState<CancelReason | "">("");
  const [comment, setComment] = useState("");
  const [isPausing, setIsPausing] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [outcome, setOutcome] = useState<"paused" | "canceled" | "stayed" | null>(null);
  const [resumeDate, setResumeDate] = useState<string | null>(null);
  const abortRef = useRef(false);

  const isProcessing = isPausing || isCanceling;

  const resetState = () => {
    abortRef.current = true;
    setStep("features");
    setReason("");
    setComment("");
    setIsPausing(false);
    setIsCanceling(false);
    setOutcome(null);
    setResumeDate(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isProcessing) return;
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  };

  const handleKeepPlan = async () => {
    if (reason) {
      try {
        await apiRequest("POST", "/api/stripe/cancel-feedback", { reason, comment: comment || null, outcome: "stayed" });
      } catch {}
    }
    setOutcome("stayed");
    handleOpenChange(false);
  };

  const handlePause = async () => {
    setIsPausing(true);
    abortRef.current = false;
    try {
      if (reason) {
        await apiRequest("POST", "/api/stripe/cancel-feedback", { reason, comment: comment || null, outcome: "paused" });
      }
      const res = await apiRequest("POST", "/api/stripe/pause", {});
      if (abortRef.current) return;
      const data = await res.json();
      setIsPausing(false);
      setResumeDate(data.resumesAt);
      setOutcome("paused");
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["/api/stripe/subscription"] });
    } catch (err: any) {
      if (abortRef.current) return;
      setIsPausing(false);
      const message = err?.message?.includes("already used your pause")
        ? "You've already paused once in the last 6 months. This option isn't available right now."
        : "Could not pause your plan. Please try again.";
      toast({ title: "Pause unavailable", description: message, variant: "destructive" });
    }
  };

  const handleCancel = async () => {
    setIsCanceling(true);
    abortRef.current = false;
    try {
      if (reason) {
        await apiRequest("POST", "/api/stripe/cancel-feedback", { reason, comment: comment || null, outcome: "canceled" });
      }
      await apiRequest("POST", "/api/stripe/cancel", {});
      if (abortRef.current) return;
      setIsCanceling(false);
      setOutcome("canceled");
      setStep("done");
      const prev = queryClient.getQueryData<any>(["/api/stripe/subscription"]);
      if (prev?.subscription) {
        queryClient.setQueryData(["/api/stripe/subscription"], {
          ...prev,
          subscription: { ...prev.subscription, cancelAtPeriodEnd: true },
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/stripe/subscription"] });
    } catch {
      if (abortRef.current) return;
      setIsCanceling(false);
      toast({ title: "Something went wrong", description: "Could not cancel your plan. Please try again.", variant: "destructive" });
    }
  };

  const formattedPeriodEnd = periodEnd
    ? new Date(periodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  const formattedResumeDate = resumeDate
    ? new Date(resumeDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto pb-safe">
        {step === "features" && (
          <div className="space-y-5 pb-4">
            <SheetHeader className="text-center">
              <SheetTitle className="text-lg">Before you go</SheetTitle>
              <SheetDescription className="text-sm">
                Here's what you'll lose with your Pro plan
              </SheetDescription>
            </SheetHeader>

            <ul className="space-y-3">
              {lostFeatures.map(({ icon: Icon, label, fallback }) => (
                <li key={label} className="flex items-center gap-3 rounded-xl border border-border/40 p-3">
                  <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4.5 h-4.5 text-destructive/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-through opacity-60">{label}</p>
                    <p className="text-xs text-muted-foreground">{fallback}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="space-y-2 pt-1">
              <Button
                className="w-full"
                size="lg"
                onClick={() => handleKeepPlan()}
                data-testid="button-keep-plan"
              >
                Keep my Pro plan
              </Button>
              <button
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                onClick={() => setStep("feedback")}
                data-testid="button-continue-cancel"
              >
                Continue to cancel
              </button>
            </div>
          </div>
        )}

        {step === "feedback" && (
          <div className="space-y-5 pb-4">
            <SheetHeader className="text-center">
              <SheetTitle className="text-lg">Help us improve</SheetTitle>
              <SheetDescription className="text-sm">
                What's the main reason you're considering leaving?
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-2">
              {cancelReasons.map(({ id, label }) => (
                <button
                  key={id}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl border text-sm transition-all",
                    reason === id
                      ? "border-primary bg-primary/[0.06] text-foreground font-medium"
                      : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                  onClick={() => setReason(id)}
                  data-testid={`button-reason-${id}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {reason && (
              <Textarea
                placeholder="Anything else you'd like to share? (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[72px] resize-none text-sm"
                data-testid="textarea-cancel-comment"
              />
            )}

            <div className="space-y-2 pt-1">
              <Button
                variant="outline"
                className="w-full gap-2"
                size="lg"
                onClick={handlePause}
                disabled={isPausing || isCanceling}
                data-testid="button-pause-subscription"
              >
                {isPausing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Pause className="w-4 h-4" />
                )}
                Pause for 1 month instead
              </Button>

              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setStep("confirming")}
                disabled={isPausing || isCanceling}
                data-testid="button-continue-to-confirm-cancel"
              >
                Cancel subscription
              </Button>
            </div>

            <button
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              onClick={() => setStep("features")}
            >
              Go back
            </button>
          </div>
        )}

        {step === "confirming" && (
          <div className="space-y-5 pb-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <Heart className="w-7 h-7 text-destructive/60" />
            </div>
            <SheetHeader className="text-center">
              <SheetTitle className="text-lg">Are you sure?</SheetTitle>
              <SheetDescription className="text-sm">
                {formattedPeriodEnd ? (
                  <>You'll keep full Pro access until <span className="font-medium text-foreground">{formattedPeriodEnd}</span>. After that, you'll switch to the free plan. You can reactivate anytime before then.</>
                ) : (
                  <>Your plan will be canceled at the end of your current billing period. You can reactivate anytime before then.</>
                )}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-2">
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleCancel}
                disabled={isCanceling}
                data-testid="button-confirm-cancel"
              >
                {isCanceling ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Yes, cancel my plan
              </Button>
              <button
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2 disabled:opacity-40 disabled:pointer-events-none"
                onClick={() => {
                  handleKeepPlan();
                }}
                disabled={isCanceling}
                data-testid="button-changed-mind"
              >
                I changed my mind
              </button>
            </div>
          </div>
        )}

        {step === "done" && outcome === "paused" && (
          <div className="space-y-5 pb-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Pause className="w-7 h-7 text-primary" />
            </div>
            <SheetHeader className="text-center">
              <SheetTitle className="text-lg">Plan paused</SheetTitle>
              <SheetDescription className="text-sm">
                Your Pro plan is paused. It will automatically resume on{" "}
                <span className="font-medium text-foreground">{formattedResumeDate}</span>.
                You'll keep full access until then.
              </SheetDescription>
            </SheetHeader>
            <Button
              className="w-full"
              onClick={() => handleOpenChange(false)}
              data-testid="button-done-pause"
            >
              Got it
            </Button>
          </div>
        )}

        {step === "done" && outcome === "canceled" && (
          <div className="space-y-5 pb-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7 text-muted-foreground" />
            </div>
            <SheetHeader className="text-center">
              <SheetTitle className="text-lg">Plan canceled</SheetTitle>
              <SheetDescription className="text-sm">
                {formattedPeriodEnd ? (
                  <>You'll have full Pro access until <span className="font-medium text-foreground">{formattedPeriodEnd}</span>. You can reactivate anytime from your subscription page.</>
                ) : (
                  <>Your cancellation will take effect at the end of your billing period. You can reactivate anytime.</>
                )}
              </SheetDescription>
            </SheetHeader>
            <Button
              className="w-full"
              onClick={() => handleOpenChange(false)}
              data-testid="button-done-cancel"
            >
              Got it
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
