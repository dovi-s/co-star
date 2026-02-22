import { getUncachableStripeClient } from '../server/stripeClient';

async function seedProducts() {
  const stripe = await getUncachableStripeClient();

  // Check if Pro plan already exists
  const existing = await stripe.products.search({ query: "name:'co-star Pro'" });
  if (existing.data.length > 0) {
    console.log('co-star Pro already exists:', existing.data[0].id);
    const prices = await stripe.prices.list({ product: existing.data[0].id, active: true });
    for (const p of prices.data) {
      console.log(`  Price: ${p.id} - $${(p.unit_amount || 0) / 100}/${p.recurring?.interval}`);
    }
    return;
  }

  // Create co-star Pro product
  const product = await stripe.products.create({
    name: 'co-star Pro',
    description: 'Unlimited rehearsals with professional voices, script library, performance tracking, and more.',
    metadata: {
      tier: 'pro',
      features: 'unlimited_scripts,voice_engine,performance_tracking,script_library,priority_support',
    },
  });
  console.log('Created product:', product.id);

  // Monthly price - $9/mo
  const monthlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 900,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { display: 'monthly' },
  });
  console.log('Created monthly price:', monthlyPrice.id, '- $9/mo');

  // Annual price - $79/yr ($6.58/mo effective)
  const annualPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 7900,
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: { display: 'annual' },
  });
  console.log('Created annual price:', annualPrice.id, '- $79/yr');

  console.log('\nDone! Products will sync to database via webhook.');
}

seedProducts().catch(console.error);
