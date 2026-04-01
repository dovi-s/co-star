import Stripe from "stripe";

let stripeClient: Stripe | null = null;

function getStripeSecretKey(): string {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return secretKey;
}

export async function getUncachableStripeClient() {
  if (!stripeClient) {
    stripeClient = new Stripe(getStripeSecretKey(), {
      apiVersion: "2025-11-17.clover" as any,
    });
  }

  return stripeClient;
}

export async function getStripePublishableKey() {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    throw new Error("STRIPE_PUBLISHABLE_KEY is not configured");
  }
  return publishableKey;
}

export async function getStripeSecretKeyValue() {
  return getStripeSecretKey();
}
