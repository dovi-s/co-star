import { useMemo } from "react";
import { computeEffectiveTier, hasProAccess } from "@shared/models/auth";
import { useAuth } from "./use-auth";

export function useProAccess() {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user) {
      return { isPro: false, effectiveTier: "free" as string, isTrialActive: false };
    }

    const effectiveTier = computeEffectiveTier({
      subscriptionTier: user.subscriptionTier,
      trialStartedAt: user.trialStartedAt,
      trialEndsAt: user.trialEndsAt,
      stripeSubscriptionId: user.stripeSubscriptionId,
    });

    const isPro = hasProAccess(effectiveTier);

    let isTrialActive = false;
    if (user.trialEndsAt && !user.stripeSubscriptionId) {
      const now = new Date();
      const trialEnd = new Date(user.trialEndsAt);
      isTrialActive = now < trialEnd && (user.subscriptionTier === "free" || user.subscriptionTier === "pro");
    }

    return { isPro, effectiveTier, isTrialActive };
  }, [user]);
}
