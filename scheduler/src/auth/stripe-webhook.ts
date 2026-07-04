/**
 * Verificatie van Stripe-webhooks. Stripe ondertekent met een `Stripe-Signature`
 * header: `t=<timestamp>,v1=<hex-hmac>`, waarbij de HMAC-SHA256 wordt berekend
 * over `${t}.${rawBody}` met je webhook-secret. Altijd verifiëren (§4-analoog).
 *
 * Docs: https://stripe.com/docs/webhooks/signatures
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export function isStripeWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  toleranceSec = 300,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const [k, v] = kv.split('=');
      return [k, v];
    }),
  );
  const t = parts['t'];
  const v1 = parts['v1'];
  if (!t || !v1) return false;

  // Replay-bescherming: tijdstempel binnen tolerantie.
  if (Math.abs(nowSec - Number(t)) > toleranceSec) return false;

  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`, 'utf8').digest('hex');
  const a = Buffer.from(v1);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
