import { NextResponse } from 'next/server';
import { getSession, signState } from '@/auth/session';
import { buildAuthUrl, isNylasOAuthConfigured } from '@/auth/nylas-oauth';

/**
 * GET /api/oauth/nylas/start?provider=google
 * Start de Nylas hosted-auth: alleen voor ingelogde admins. Stuurt door naar
 * Nylas, dat na autorisatie terugkeert op /api/oauth/nylas/callback.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL('/admin/login', req.url));

  if (!isNylasOAuthConfigured()) {
    return NextResponse.json(
      {
        error: 'nylas_not_configured',
        message:
          'Nylas OAuth is niet geconfigureerd. Zet NYLAS_CLIENT_ID en NYLAS_API_KEY (zie .env.example).',
      },
      { status: 501 },
    );
  }

  const url = new URL(req.url);
  const provider = (url.searchParams.get('provider') as 'google' | 'microsoft' | 'icloud') || undefined;
  const redirectUri = new URL('/api/oauth/nylas/callback', url.origin).toString();
  const state = signState(`${session.tenantId}:${session.userId}`);

  return NextResponse.redirect(buildAuthUrl({ redirectUri, state, provider }));
}
