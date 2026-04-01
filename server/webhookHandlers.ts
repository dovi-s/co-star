import type Stripe from "stripe";
import { getUncachableStripeClient } from "./stripeClient";
import { db } from "./db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const stripe = await getUncachableStripeClient();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }

    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    await this.handleEvent(event);
  }

  private static async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        return;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await this.handleSubscriptionEvent(event.data.object as Stripe.Subscription, event.type);
        return;
      case "customer.deleted":
        await this.handleCustomerDeleted(event.data.object as Stripe.Customer);
        return;
      default:
        return;
    }
  }

  private static async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    const customerId =
      typeof session.customer === "string" ? session.customer : session.customer?.id;
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;

    if (!userId || !customerId) {
      return;
    }

    const updates: Record<string, unknown> = {
      stripeCustomerId: customerId,
      updatedAt: new Date(),
    };

    if (subscriptionId) {
      updates.stripeSubscriptionId = subscriptionId;
      updates.subscriptionTier = "pro";
    }

    await db.update(users).set(updates).where(eq(users.id, userId));
  }

  private static async handleSubscriptionEvent(
    subscription: any,
    eventType: string,
  ): Promise<void> {
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id;

    if (!customerId) {
      return;
    }

    const [user] = await db
      .select({ id: users.id, subscriptionTier: users.subscriptionTier })
      .from(users)
      .where(eq(users.stripeCustomerId, customerId));

    if (!user) {
      return;
    }

    const activeStatuses = new Set(["active", "trialing", "past_due"]);
    const shouldDowngrade =
      eventType === "customer.subscription.deleted" ||
      !activeStatuses.has(subscription.status);

    if (shouldDowngrade) {
      await db
        .update(users)
        .set({
          subscriptionTier: "free",
          stripeSubscriptionId: null,
          subscriptionExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
      return;
    }

    await db
      .update(users)
      .set({
        subscriptionTier: "pro",
        stripeSubscriptionId: subscription.id,
        subscriptionExpiresAt: subscription.cancel_at_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
  }

  private static async handleCustomerDeleted(customer: Stripe.Customer): Promise<void> {
    const [user] = await db
      .select({ id: users.id, subscriptionTier: users.subscriptionTier })
      .from(users)
      .where(eq(users.stripeCustomerId, customer.id));

    if (!user) {
      return;
    }

    const updates: Record<string, unknown> = {
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      updatedAt: new Date(),
    };

    if (user.subscriptionTier === "pro") {
      updates.subscriptionTier = "free";
      updates.subscriptionExpiresAt = null;
    }

    await db.update(users).set(updates).where(eq(users.id, user.id));
  }
}
