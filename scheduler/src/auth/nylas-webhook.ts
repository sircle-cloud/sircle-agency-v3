/**
 * Verificatie van inkomende Nylas-webhooks. Nylas ondertekent elke webhook met
 * HMAC-SHA256 (hex) van de rauwe body, met je webhook-secret. Altijd verifiëren
 * vóór verwerken — anders kan iedereen events injecteren (§4).
 *
 * Docs: https://developer.nylas.com/docs/v3/notifications/webhook-security/
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export function isWebhookConfigured(): boolean {
  return Boolean(process.env.NYLAS_WEBHOOK_SECRET);
}

export function verifyNylasSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.NYLAS_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
