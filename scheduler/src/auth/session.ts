/**
 * Lichte, stateless sessies: een HMAC-ondertekend token in een httpOnly-cookie.
 * Geen externe auth-library nodig voor Fase 2. In productie kan dit later
 * vervangen worden door Auth.js/Clerk (§8) — de rest van de app praat alleen
 * met getSession()/setSession(), dus dat is een geïsoleerde swap.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE = 'sircle_session';
const MAX_AGE_SEC = 60 * 60 * 8; // 8 uur

export interface SessionPayload {
  userId: string;
  tenantId: string;
  exp: number; // unix seconds
}

function secret(): string {
  return process.env.SESSION_SECRET ?? 'dev-insecure-secret-change-me';
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

function sign(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('base64url');
}

export function encodeSession(payload: SessionPayload): string {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Lees de huidige sessie uit de cookie (server-side). */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return decodeSession(store.get(COOKIE)?.value);
}

/** Zet de sessie-cookie (na login). `nowSec` injecteerbaar voor tests. */
export async function setSession(
  userId: string,
  tenantId: string,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<void> {
  const token = encodeSession({ userId, tenantId, exp: nowSec + MAX_AGE_SEC });
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SEC,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

/** CSRF-state voor de OAuth-flow: onderteken een waarde en verifieer 'm terug. */
export function signState(value: string): string {
  return `${b64url(value)}.${sign(b64url(value))}`;
}

export function verifyState(state: string | undefined | null, expected: string): boolean {
  if (!state) return false;
  const [body, sig] = state.split('.');
  if (!body || !sig) return false;
  const good = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(good);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return Buffer.from(body, 'base64url').toString() === expected;
}
