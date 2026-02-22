import { getUncachableStripeClient } from '../server/stripeClient';

async function checkAccount() {
  const stripe = await getUncachableStripeClient();
  
  const account = await stripe.accounts.retrieve();
  console.log('=== STRIPE ACCOUNT ===');
  console.log('Account ID:', account.id);
  console.log('Email:', account.email);
  console.log('Business name:', account.business_profile?.name);
  console.log('Country:', account.country);
  console.log('Type:', account.type);
  console.log('Details submitted:', account.details_submitted);
  console.log('Dashboard URL: https://dashboard.stripe.com/' + (account.id ? `test/products` : ''));
  console.log('\nDirect link to product catalog (test mode):');
  console.log(`https://dashboard.stripe.com/test/products`);
  console.log(`\nDirect link to this specific product:`);
  console.log(`https://dashboard.stripe.com/test/products/prod_U1m4p9OgFSRYhG`);
}

checkAccount().catch(console.error);
