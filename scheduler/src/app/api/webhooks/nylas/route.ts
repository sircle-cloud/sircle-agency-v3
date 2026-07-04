import { NextResponse } from 'next/server';
import { getSyncService } from '@/config';
import { isWebhookConfigured, verifyNylasSignature } from '@/auth/nylas-webhook';
import type { NylasWebhookEvent } from '@/core/sync';

/**
 * GET  — Nylas verificatie-handshake: echo de `challenge` query-param terug.
 * POST — geverifieerde webhook: valideer HMAC en dispatch naar de SyncService.
 *
 * Docs: https://developer.nylas.com/docs/v3/notifications/
 */
export async function GET(req: Request) {
  const challenge = new URL(req.url).searchParams.get('challenge');
  if (challenge) {
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  if (!isWebhookConfigured()) {
    return NextResponse.json(
      { error: 'not_configured', message: 'NYLAS_WEBHOOK_SECRET ontbreekt (zie .env.example).' },
      { status: 501 },
    );
  }

  // Rauwe body nodig voor de HMAC-check (geparste JSON zou de handtekening breken).
  const raw = await req.text();
  const signature = req.headers.get('x-nylas-signature');
  if (!verifyNylasSignature(raw, signature)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let evt: NylasWebhookEvent;
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  const result = await getSyncService().handleWebhookEvent(evt);
  // Altijd 200 na een geldige handtekening, zodat Nylas niet blijft herproberen.
  return NextResponse.json(result, { status: 200 });
}
