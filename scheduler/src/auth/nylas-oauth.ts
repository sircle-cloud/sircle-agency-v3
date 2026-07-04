/**
 * Nylas v3 hosted-auth (OAuth) helpers. Dit is de flow die de agenda-sync
 * "live" maakt: de host autoriseert zijn Google-/Outlook-agenda, Nylas geeft een
 * `grant_id` terug, en die slaan we op als CalendarConnection (§8).
 *
 * Vereist (zie .env.example):
 *   NYLAS_CLIENT_ID       (Nylas application-id)
 *   NYLAS_API_KEY         (dient als client_secret bij token-exchange)
 *   NYLAS_API_URI         (default EU: https://api.eu.nylas.com)
 *
 * Docs: https://developer.nylas.com/docs/v3/auth/hosted-oauth-apikey/
 */
function apiUri(): string {
  return process.env.NYLAS_API_URI ?? 'https://api.eu.nylas.com';
}

export function isNylasOAuthConfigured(): boolean {
  return Boolean(process.env.NYLAS_CLIENT_ID && process.env.NYLAS_API_KEY);
}

/** Bouw de autorisatie-URL waar de host naartoe wordt gestuurd. */
export function buildAuthUrl(params: {
  redirectUri: string;
  state: string;
  provider?: 'google' | 'microsoft' | 'icloud';
  loginHint?: string;
}): string {
  const u = new URL(`${apiUri()}/v3/connect/auth`);
  u.searchParams.set('client_id', process.env.NYLAS_CLIENT_ID!);
  u.searchParams.set('redirect_uri', params.redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('access_type', 'offline');
  u.searchParams.set('state', params.state);
  if (params.provider) u.searchParams.set('provider', params.provider);
  if (params.loginHint) u.searchParams.set('login_hint', params.loginHint);
  return u.toString();
}

/** Wissel de OAuth-code in voor een grant. Geeft grantId + e-mail terug. */
export async function exchangeCodeForGrant(params: {
  code: string;
  redirectUri: string;
}): Promise<{ grantId: string; email: string }> {
  const res = await fetch(`${apiUri()}/v3/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.NYLAS_CLIENT_ID,
      client_secret: process.env.NYLAS_API_KEY,
      code: params.code,
      redirect_uri: params.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Nylas token-exchange ${res.status}: ${t}`);
  }
  const data = await res.json();
  return { grantId: data.grant_id, email: data.email };
}

/** Zet grant + e-mail om naar het connectionRef-formaat dat NylasCalendar verwacht. */
export function toConnectionRef(grantId: string, email: string): string {
  return `${grantId}|${email}|primary`;
}
