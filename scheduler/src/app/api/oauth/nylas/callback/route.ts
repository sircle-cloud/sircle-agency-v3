import { NextResponse } from 'next/server';
import { getSession, verifyState } from '@/auth/session';
import { exchangeCodeForGrant, toConnectionRef } from '@/auth/nylas-oauth';
import { getRepository } from '@/config';

/**
 * GET /api/oauth/nylas/callback?code=...&state=...
 * Nylas keert hier terug. We wisselen de code in voor een grant en slaan de
 * agenda-koppeling op bij de host — daarna is de twee-weg sync live.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL('/admin/login', req.url));

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!verifyState(state, `${session.tenantId}:${session.userId}`)) {
    return NextResponse.redirect(new URL('/admin?calendar=state_error', req.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL('/admin?calendar=cancelled', req.url));
  }

  try {
    const redirectUri = new URL('/api/oauth/nylas/callback', url.origin).toString();
    const { grantId, email } = await exchangeCodeForGrant({ code, redirectUri });
    await getRepository().saveCalendarConnection({
      tenantId: session.tenantId,
      userId: session.userId,
      provider: 'nylas',
      connectionRef: toConnectionRef(grantId, email),
    });
    return NextResponse.redirect(new URL('/admin?calendar=connected', req.url));
  } catch (err) {
    console.error('[oauth] Nylas callback mislukt:', err);
    return NextResponse.redirect(new URL('/admin?calendar=error', req.url));
  }
}
