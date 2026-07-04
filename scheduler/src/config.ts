/**
 * Composition root. Kiest de adapters op basis van env-variabelen en bouwt de
 * BookingService. Dit is de enige plek waar concrete adapters aan de domeinlaag
 * worden gekoppeld — de rest van de app kent alleen de ports. Van sync-provider
 * of database wisselen = hier één regel; geen herbouw (§6).
 *
 *   DB_DRIVER       = "memory" (default) | "prisma"
 *   CALENDAR_DRIVER = "mock"   (default) | "nylas"
 *   MAIL_DRIVER     = "console"(default) | "resend"
 *
 * Zonder env draait alles in dev-modus: in-memory DB + mock-agenda +
 * console-mail. Perfect om lokaal end-to-end te verifiëren zonder externe keys.
 * Deze module is server-only (importeert nooit in de client-bundle).
 */
import { PrismaClient } from '@prisma/client';
import { BookingService } from './core/booking';
import { AdminService } from './core/admin';
import { SyncService } from './core/sync';
import { ReminderService } from './core/reminders';
import { GuestBookingService } from './core/guest';
import { OnboardingService } from './core/onboarding';
import type { BookingRepository, CalendarProvider, Mailer } from './ports/index';
import { MemoryRepository } from './adapters/repo/memory';
import { PrismaRepository } from './adapters/repo/prisma';
import { MockCalendar } from './adapters/calendar/mock';
import { NylasCalendar } from './adapters/calendar/nylas';
import { ConsoleMailer } from './adapters/mail/console';
import { ResendMailer } from './adapters/mail/resend';

// Singletons overleven Next.js hot-reload via globalThis (dev-persistentie).
const g = globalThis as unknown as {
  __sircleRepo?: BookingRepository;
  __sircleCalendar?: CalendarProvider;
  __sircleMailer?: Mailer;
  __sirclePrisma?: PrismaClient;
};

function repository(): BookingRepository {
  if (g.__sircleRepo) return g.__sircleRepo;
  if ((process.env.DB_DRIVER ?? 'memory') === 'prisma') {
    // Eén gedeelde PrismaClient (voorkomt connection-pool-uitputting bij hot-reload).
    if (!g.__sirclePrisma) g.__sirclePrisma = new PrismaClient();
    g.__sircleRepo = new PrismaRepository(g.__sirclePrisma);
  } else {
    g.__sircleRepo = new MemoryRepository();
  }
  return g.__sircleRepo;
}

function calendar(): CalendarProvider {
  if (g.__sircleCalendar) return g.__sircleCalendar;
  if ((process.env.CALENDAR_DRIVER ?? 'mock') === 'nylas') {
    const apiKey = requireEnv('NYLAS_API_KEY');
    g.__sircleCalendar = new NylasCalendar({ apiKey, apiUri: process.env.NYLAS_API_URI });
  } else {
    g.__sircleCalendar = new MockCalendar();
  }
  return g.__sircleCalendar;
}

function mailer(): Mailer {
  if (g.__sircleMailer) return g.__sircleMailer;
  if ((process.env.MAIL_DRIVER ?? 'console') === 'resend') {
    g.__sircleMailer = new ResendMailer({
      apiKey: requireEnv('RESEND_API_KEY'),
      from: requireEnv('RESEND_FROM'),
    });
  } else {
    g.__sircleMailer = new ConsoleMailer();
  }
  return g.__sircleMailer;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Ontbrekende env-variabele: ${name} (zie .env.example).`);
  return v;
}

function idGen(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Math.random().toString(36).slice(2)}`;
}

export function getBookingService(): BookingService {
  return new BookingService(repository(), calendar(), mailer(), idGen);
}

export function getAdminService(): AdminService {
  return new AdminService(repository(), calendar(), idGen);
}

export function getSyncService(): SyncService {
  return new SyncService(repository(), calendar());
}

export function getReminderService(): ReminderService {
  return new ReminderService(repository(), mailer());
}

export function getGuestService(): GuestBookingService {
  return new GuestBookingService(repository(), calendar(), mailer());
}

export function getOnboardingService(): OnboardingService {
  return new OnboardingService(repository(), idGen);
}

export function getRepository(): BookingRepository {
  return repository();
}
