import { NextResponse } from 'next/server';
import { getBillingService } from '@/config';
import { isStripeWebhookConfigured, verifyStripeSignature } from '@/auth/stripe-webhook';
import type { StripeWebhookEvent } from '@/core/billing';

/**
 * POST — geverifieerde Stripe-webhook: activeert/annuleert het tenant-abonnement
 * op basis van checkout.session.completed / customer.subscription.deleted.
 */
export async function POST(req: Request) {
  if (!isStripeWebhookConfigured()) {
    return NextResponse.json(
      { error: 'not_configured', message: 'STRIPE_WEBHOOK_SECRET ontbreekt (zie .env.example).' },
      { status: 501 },
    );
  }

  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get('stripe-signature'))) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let evt: StripeWebhookEvent;
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  const result = await getBillingService().handleWebhookEvent(evt);
  return NextResponse.json(result, { status: 200 });
}
