import { getStripeSync } from './stripeClient';
import { db } from './db';
import { users } from '@shared/models/auth';
import { eq } from 'drizzle-orm';

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

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    try {
      const event = JSON.parse(payload.toString());
      const eventType = event?.type;
      const dataObject = event?.data?.object;
      if (!eventType || !dataObject) return;

      if (eventType === 'customer.subscription.deleted' || eventType === 'customer.subscription.updated') {
        const customerId = typeof dataObject.customer === 'string' ? dataObject.customer : dataObject.customer?.id;
        const status = dataObject.status;

        if (!customerId) return;

        if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired' || eventType === 'customer.subscription.deleted') {
          const [user] = await db.select({ id: users.id, subscriptionTier: users.subscriptionTier })
            .from(users)
            .where(eq(users.stripeCustomerId, customerId));

          if (user && user.subscriptionTier === 'pro') {
            await db.update(users).set({
              subscriptionTier: 'free',
              stripeSubscriptionId: null,
              subscriptionExpiresAt: null,
              updatedAt: new Date(),
            }).where(eq(users.id, user.id));
            console.log(`[Stripe Webhook] Downgraded user ${user.id} to free (${eventType}, status: ${status})`);
          }
        }
      }

      if (eventType === 'customer.deleted') {
        const customerId = dataObject.id;
        if (!customerId) return;

        const [user] = await db.select({ id: users.id, subscriptionTier: users.subscriptionTier })
          .from(users)
          .where(eq(users.stripeCustomerId, customerId));

        if (user) {
          const updates: any = {
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            updatedAt: new Date(),
          };
          if (user.subscriptionTier === 'pro') {
            updates.subscriptionTier = 'free';
            updates.subscriptionExpiresAt = null;
          }
          await db.update(users).set(updates).where(eq(users.id, user.id));
          console.log(`[Stripe Webhook] Cleared Stripe data for user ${user.id} (customer deleted)`);
        }
      }
    } catch (customErr: any) {
      console.error('[Stripe Webhook] Custom sync handler error:', customErr.message);
    }
  }
}
