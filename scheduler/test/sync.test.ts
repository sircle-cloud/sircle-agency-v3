import { describe, it, expect } from 'vitest';
import { SyncService } from '@/core/sync';
import { BookingService } from '@/core/booking';
import { MemoryRepository } from '@/adapters/repo/memory';
import { MockCalendar } from '@/adapters/calendar/mock';
import { ConsoleMailer } from '@/adapters/mail/console';
import { buildSeed } from '@/adapters/seed';

let n = 0;
const id = () => `s_${++n}`;

const WINDOW = {
  fromUtc: '2026-07-06T00:00:00.000Z',
  toUtc: '2026-07-07T00:00:00.000Z',
  nowUtc: '2026-07-01T00:00:00.000Z',
};
const CONN = 'grant_koen|koen@sircle.example|primary';

/** Bouw een repo waarin de host een gekoppelde agenda heeft. */
async function buildWithConnection(preexistingBusy: Record<string, { startUtc: string; endUtc: string }[]> = {}) {
  const seed = buildSeed();
  seed.connections['t_sircle:u_koen'] = CONN;
  const repo = new MemoryRepository(seed);
  const calendar = new MockCalendar(preexistingBusy);
  const sync = new SyncService(repo, calendar);
  const booking = new BookingService(repo, calendar, new ConsoleMailer(), id);
  return { repo, calendar, sync, booking };
}

describe('SyncService.reconcileHost', () => {
  it('meldt geen conflict voor onze eigen boeking (eigen event valt exact samen)', async () => {
    const { sync, booking } = await buildWithConnection();
    const { slots } = await booking.listAvailableSlots({
      tenantSlug: 'sircle',
      eventTypeSlug: 'intake',
      ...WINDOW,
    });
    await booking.createBooking({
      tenantSlug: 'sircle',
      eventTypeSlug: 'intake',
      guestName: 'Gast',
      guestEmail: 'gast@example.com',
      guestTimezone: 'Europe/Amsterdam',
      startUtc: slots[0].startUtc,
      nowUtc: WINDOW.nowUtc,
    });
    const res = await sync.reconcileHost({
      tenantId: 't_sircle',
      hostUserId: 'u_koen',
      fromUtc: WINDOW.fromUtc,
      toUtc: WINDOW.toUtc,
    });
    expect(res.checked).toBe(1);
    expect(res.conflicts.length).toBe(0);
  });

  it('detecteert een conflict als de host er extern iets overheen plant', async () => {
    const { sync, booking, calendar } = await buildWithConnection();
    // 1) Boek 07:00–07:30 terwijl de agenda nog vrij is.
    await booking.createBooking({
      tenantSlug: 'sircle',
      eventTypeSlug: 'intake',
      guestName: 'Gast',
      guestEmail: 'gast@example.com',
      guestTimezone: 'Europe/Amsterdam',
      startUtc: '2026-07-06T07:00:00.000Z',
      nowUtc: WINDOW.nowUtc,
    });
    // 2) Host plant er later extern iets overheen (06:45–07:20).
    calendar.simulateExternalBusy(CONN, {
      startUtc: '2026-07-06T06:45:00.000Z',
      endUtc: '2026-07-06T07:20:00.000Z',
    });
    const res = await sync.reconcileHost({
      tenantId: 't_sircle',
      hostUserId: 'u_koen',
      fromUtc: WINDOW.fromUtc,
      toUtc: WINDOW.toUtc,
    });
    expect(res.conflicts.length).toBe(1);
    expect(res.conflicts[0].booking.startUtc).toBe('2026-07-06T07:00:00.000Z');
  });

  it('geeft niets terug als er geen actieve agenda-koppeling is', async () => {
    const repo = new MemoryRepository(); // seed: connection = null
    const sync = new SyncService(repo, new MockCalendar());
    const res = await sync.reconcileHost({
      tenantId: 't_sircle',
      hostUserId: 'u_koen',
      fromUtc: WINDOW.fromUtc,
      toUtc: WINDOW.toUtc,
    });
    expect(res).toEqual({ checked: 0, conflicts: [] });
  });
});

describe('SyncService.handleWebhookEvent', () => {
  it('deactiveert de koppeling bij grant.expired', async () => {
    const { sync, repo } = await buildWithConnection();
    const before = await repo.getCalendarConnection('t_sircle', 'u_koen');
    expect(before?.status).toBe('active');

    const res = await sync.handleWebhookEvent({
      type: 'grant.expired',
      data: { object: { grant_id: 'grant_koen' } },
    });
    expect(res.handled).toBe(true);
    expect(res.action).toBe('connection_deactivated');

    const after = await repo.getCalendarConnection('t_sircle', 'u_koen');
    expect(after?.status).toBe('inactive');
  });

  it('bevestigt een event.* webhook zonder te falen', async () => {
    const { sync } = await buildWithConnection();
    const res = await sync.handleWebhookEvent({
      type: 'event.created',
      data: { object: { grant_id: 'grant_koen' } },
    });
    expect(res.handled).toBe(true);
    expect(res.action).toBe('acknowledged');
  });
});
