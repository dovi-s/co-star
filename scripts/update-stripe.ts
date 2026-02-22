import { getUncachableStripeClient } from '../server/stripeClient';

async function updateStripeProducts() {
  try {
    const stripe = await getUncachableStripeClient();
    
    const product = await stripe.products.update('prod_U1m4p9OgFSRYhG', {
      default_price: 'price_1T3iWeEEKSsq7SkUunVhnXen',
      marketing_features: [
        { name: 'Professional ElevenLabs voices with emotion detection' },
        { name: 'Unlimited scripts and scenes' },
        { name: 'Performance tracking and accuracy insights' },
        { name: 'Hands-free rehearsal mode' },
        { name: 'Multiplayer table reads with video' },
        { name: 'Smart script parsing with photo and PDF OCR' },
      ],
    });
    console.log('Product updated:', product.id, product.name);
    console.log('Default price:', product.default_price);
    console.log('Marketing features:', product.marketing_features?.length);

    const monthly = await stripe.prices.update('price_1T3iWeEEKSsq7SkUunVhnXen', {
      nickname: 'Pro Monthly',
    });
    console.log('Monthly price updated:', monthly.id, monthly.nickname);

    const yearly = await stripe.prices.update('price_1T3iWfEEKSsq7SkUoFPXv4Q9', {
      nickname: 'Pro Annual',
    });
    console.log('Yearly price updated:', yearly.id, yearly.nickname);

    const products = await stripe.products.list({ active: true });
    console.log('\nAll active products:');
    for (const p of products.data) {
      console.log(`  - ${p.name} (${p.id}): ${p.description}`);
      console.log(`    Default price: ${p.default_price}`);
      console.log(`    Features: ${p.marketing_features?.map(f => f.name).join(', ')}`);
    }

    const prices = await stripe.prices.list({ active: true });
    console.log('\nAll active prices:');
    for (const p of prices.data) {
      console.log(`  - ${p.nickname || p.id}: $${(p.unit_amount || 0) / 100}/${p.recurring?.interval} (${p.id})`);
    }

  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

updateStripeProducts();
