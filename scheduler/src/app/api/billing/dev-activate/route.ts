import { NextResponse } from 'next/server';
import { getSession } from '@/auth/session';
import { getBillingService } from '@/config';

/**
 * DEV-ONLY: activeert een plan zonder betaling. Alleen bruikbaar wanneer er GEEN
 * Stripe-key is (mock-billing). In productie (met STRIPE_SECRET_KEY) is deze
 * route uitgeschakeld — dan loopt alles via echte Stripe Checkout + webhook.
 */
export async function GET(req: Request) {
  if (process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'disabled_in_production' }, { status: 404 });
  }
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL('/admin/login', req.url));

  const url = new URL(req.url);
  const planId = url.searchParams.get('planId') ?? '';
  const next = url.searchParams.get('next') ?? '/admin/billing?status=success';

  const plan = getBillingService().getPlan(planId);
  if (!plan) return NextResponse.redirect(new URL('/admin/billing?status=error', req.url));

  await getBillingService().applySubscription({
    tenantId: session.tenantId,
    plan: planId,
    status: 'active',
  });
  return NextResponse.redirect(next.startsWith('http') ? next : new URL(next, req.url));
}
