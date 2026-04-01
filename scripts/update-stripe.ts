import { getUncachableStripeClient } from '../server/stripeClient';

async function setupStripeCatalog() {
  const stripe = await getUncachableStripeClient();
  const appUrl = process.env.APP_URL || 'http://localhost:5000';

  // 1. Update product with tax code, statement descriptor, and URL
  const product = await stripe.products.update('prod_U1m4p9OgFSRYhG', {
    tax_code: 'txcd_10103001', // SaaS - software as a service
    statement_descriptor: 'CO-STAR PRO',
    unit_label: 'subscription',
    url: appUrl,
    metadata: {
      tier: 'pro',
      features: 'unlimited_scripts,voice_engine,performance_tracking,script_library,priority_support,hands_free,multiplayer,ocr',
      app: 'co-star',
    },
  });
  console.log('✓ Product updated with tax code, statement descriptor, URL');

  // 2. Update prices with tax behavior and metadata
  await stripe.prices.update('price_1T3iWeEEKSsq7SkUunVhnXen', {
    tax_behavior: 'inclusive',
    metadata: { plan: 'pro', period: 'monthly' },
  });
  console.log('✓ Monthly price: tax behavior + metadata set');

  await stripe.prices.update('price_1T3iWfEEKSsq7SkUoFPXv4Q9', {
    tax_behavior: 'inclusive',
    metadata: { plan: 'pro', period: 'annual' },
  });
  console.log('✓ Annual price: tax behavior + metadata set');

  // 3. Create payment links for easy sharing
  const monthlyLink = await stripe.paymentLinks.create({
    line_items: [{ price: 'price_1T3iWeEEKSsq7SkUunVhnXen', quantity: 1 }],
    metadata: { plan: 'pro_monthly' },
    after_completion: { type: 'redirect', redirect: { url: `${appUrl}/?checkout=success` } },
  });
  console.log('✓ Monthly payment link:', monthlyLink.url);

  const annualLink = await stripe.paymentLinks.create({
    line_items: [{ price: 'price_1T3iWfEEKSsq7SkUoFPXv4Q9', quantity: 1 }],
    metadata: { plan: 'pro_annual' },
    after_completion: { type: 'redirect', redirect: { url: `${appUrl}/?checkout=success` } },
  });
  console.log('✓ Annual payment link:', annualLink.url);

  // 4. Configure customer portal
  try {
    const portalConfig = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: 'co-star - Manage your subscription',
        privacy_policy_url: `${appUrl}/?view=privacy`,
        terms_of_service_url: `${appUrl}/?view=terms`,
      },
      features: {
        subscription_cancel: {
          enabled: true,
          mode: 'at_period_end',
          cancellation_reason: {
            enabled: true,
            options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'other'],
          },
        },
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price'],
          proration_behavior: 'create_prorations',
          products: [{
            product: 'prod_U1m4p9OgFSRYhG',
            prices: ['price_1T3iWeEEKSsq7SkUunVhnXen', 'price_1T3iWfEEKSsq7SkUoFPXv4Q9'],
          }],
        },
        payment_method_update: { enabled: true },
        invoice_history: { enabled: true },
      },
    });
    console.log('✓ Customer portal configured:', portalConfig.id);
  } catch (e: any) {
    console.log('Portal config note:', e.message);
  }

  // 5. Print full catalog summary
  console.log('\n=== STRIPE PRODUCT CATALOG ===');
  const products = await stripe.products.list({ active: true, expand: ['data.default_price'] });
  for (const p of products.data) {
    console.log(`\nProduct: ${p.name} (${p.id})`);
    console.log(`  Description: ${p.description}`);
    console.log(`  Tax code: ${p.tax_code}`);
    console.log(`  Statement descriptor: ${p.statement_descriptor}`);
    console.log(`  URL: ${p.url}`);
    console.log(`  Default price: ${typeof p.default_price === 'object' ? `$${(p.default_price as any).unit_amount / 100}/${(p.default_price as any).recurring?.interval}` : p.default_price}`);
    console.log(`  Marketing features:`);
    for (const f of p.marketing_features || []) {
      console.log(`    - ${f.name}`);
    }
    console.log(`  Metadata:`, JSON.stringify(p.metadata));
  }

  const prices = await stripe.prices.list({ active: true, expand: ['data.product'] });
  console.log('\nPrices:');
  for (const p of prices.data) {
    const prodName = typeof p.product === 'object' ? (p.product as any).name : p.product;
    console.log(`  ${p.nickname || p.id}: $${(p.unit_amount || 0) / 100}/${p.recurring?.interval} → ${prodName}`);
    console.log(`    Tax behavior: ${p.tax_behavior}`);
    console.log(`    Metadata:`, JSON.stringify(p.metadata));
  }

  console.log('\nPayment Links:');
  console.log(`  Monthly: ${monthlyLink.url}`);
  console.log(`  Annual: ${annualLink.url}`);

  console.log('\n✓ Stripe catalog setup complete');
}

setupStripeCatalog().catch(console.error);
