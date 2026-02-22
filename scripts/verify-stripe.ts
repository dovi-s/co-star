import { getUncachableStripeClient, getStripePublishableKey } from '../server/stripeClient';

async function verify() {
  const stripe = await getUncachableStripeClient();
  const pubKey = await getStripePublishableKey();
  
  console.log('=== STRIPE CONNECTION INFO ===');
  console.log('Publishable key starts with:', pubKey.substring(0, 12) + '...');
  console.log('Mode:', pubKey.startsWith('pk_test_') ? 'TEST/SANDBOX' : pubKey.startsWith('pk_live_') ? 'LIVE' : 'UNKNOWN');
  
  console.log('\n=== PRODUCTS IN STRIPE ===');
  const products = await stripe.products.list({ active: true, expand: ['data.default_price'] });
  if (products.data.length === 0) {
    console.log('NO PRODUCTS FOUND');
  }
  for (const p of products.data) {
    console.log(`\nProduct: ${p.name}`);
    console.log(`  ID: ${p.id}`);
    console.log(`  Active: ${p.active}`);
    console.log(`  Description: ${p.description}`);
    console.log(`  Default price: ${typeof p.default_price === 'object' && p.default_price ? '$' + ((p.default_price as any).unit_amount / 100) + '/' + (p.default_price as any).recurring?.interval : 'none'}`);
    console.log(`  Tax code: ${p.tax_code}`);
    console.log(`  Statement descriptor: ${p.statement_descriptor}`);
    console.log(`  URL: ${p.url}`);
    console.log(`  Features: ${p.marketing_features?.map(f => f.name).join(', ') || 'none'}`);
    console.log(`  Metadata:`, JSON.stringify(p.metadata));
  }

  console.log('\n=== PRICES IN STRIPE ===');
  const prices = await stripe.prices.list({ active: true });
  for (const p of prices.data) {
    console.log(`  ${p.nickname || p.id}: $${(p.unit_amount || 0) / 100}/${p.recurring?.interval} (product: ${p.product})`);
    console.log(`    Tax behavior: ${p.tax_behavior}, metadata:`, JSON.stringify(p.metadata));
  }

  console.log('\n=== CUSTOMERS IN STRIPE ===');
  const customers = await stripe.customers.list({ limit: 10 });
  console.log(`Total customers: ${customers.data.length}`);
  for (const c of customers.data) {
    console.log(`  ${c.email} (${c.id})`);
  }

  console.log('\n=== SUBSCRIPTIONS IN STRIPE ===');
  const subs = await stripe.subscriptions.list({ limit: 10 });
  console.log(`Total subscriptions: ${subs.data.length}`);
  for (const s of subs.data) {
    console.log(`  ${s.id}: ${s.status} (customer: ${s.customer})`);
  }

  console.log('\n=== PAYMENT LINKS ===');
  const links = await stripe.paymentLinks.list({ limit: 10 });
  for (const l of links.data) {
    console.log(`  ${l.url} (active: ${l.active})`);
  }
}

verify().catch(console.error);
