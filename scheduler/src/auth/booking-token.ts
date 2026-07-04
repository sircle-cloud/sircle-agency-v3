/**
 * Beheer-token voor gasten: een HMAC-handtekening over het booking-id, zodat
 * alleen wie de (gemailde) link heeft een afspraak kan verzetten of annuleren —
 * zonder account. Los van de admin-sessie.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

function secret(): string {
  // Aparte secret mag; valt terug op de sessie-secret voor dev.
  return process.env.BOOKING_TOKEN_SECRET ?? process.env.SESSION_SECRET ?? 'dev-insecure-secret-change-me';
}

export function signBookingToken(bookingId: string): string {
  return createHmac('sha256', secret()).update(bookingId).digest('base64url');
}

export function verifyBookingToken(bookingId: string, token: string | undefined | null): boolean {
  if (!token) return false;
  const expected = signBookingToken(bookingId);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
