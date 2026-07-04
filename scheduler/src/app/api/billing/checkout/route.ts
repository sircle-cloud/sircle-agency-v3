import { NextResponse } from 'next/server';
import { getSession } from '@/auth/session';
import { getBillingService } from '@/config';
import { DomainError } from '@/core/errors';

/**
 * GET /api/billing/checkout?plan=praktijk
 * Start een Stripe Checkout voor het gekozen plan (admin-only) en stuurt door.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL('/admin/login', req.url));

  const url = new URL(req.url);
  const planId = url.searchParams.get('plan') ?? '';
  const base = process.env.APP_URL ?? url.origin;

  try {
    const result = await getBillingService().createCheckout({
      tenantId: session.tenantId,
      planId,
      successUrl: `${base}/admin/billing?status=success`,
      cancelUrl: `${base}/admin/billing?status=cancelled`,
    });
    return NextResponse.redirect(result.url);
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.redirect(new URL('/admin/billing?status=error', req.url));
    }
    throw err;
  }
}
