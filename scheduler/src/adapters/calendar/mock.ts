/**
 * MockCalendar — voor lokale ontwikkeling en tests zonder Nylas-keys. Houdt
 * een in-memory lijst van "externe" events bij en kan optioneel vaste bezet-tijd
 * simuleren, zodat de free/busy-flow demonstreerbaar is.
 */
import type { CalendarProvider } from '../../ports/index';
import type { BusyInterval } from '../../core/types';
import { intervalsOverlap } from '../../core/time';

interface StoredEvent {
  connectionRef: string;
  externalEventId: string;
  startUtc: string;
  endUtc: string;
  syncTag: string;
}

export class MockCalendar implements CalendarProvider {
  private events: StoredEvent[] = [];
  private counter = 0;

  /** Optioneel: vooraf ingestelde bezet-blokken per connectionRef (bv. externe afspraken). */
  constructor(private preexistingBusy: Record<string, BusyInterval[]> = {}) {}

  async getBusy(params: {
    connectionRef: string;
    fromUtc: string;
    toUtc: string;
  }): Promise<BusyInterval[]> {
    const fromOwn = this.events
      .filter((e) => e.connectionRef === params.connectionRef)
      .map((e) => ({ startUtc: e.startUtc, endUtc: e.endUtc }));
    const preset = this.preexistingBusy[params.connectionRef] ?? [];
    return [...preset, ...fromOwn].filter((b) =>
      intervalsOverlap(b.startUtc, b.endUtc, params.fromUtc, params.toUtc),
    );
  }

  async createEvent(params: {
    connectionRef: string;
    booking: { startUtc: string; endUtc: string };
    syncTag: string;
  }): Promise<{ externalEventId: string }> {
    const externalEventId = `mock-evt-${++this.counter}`;
    this.events.push({
      connectionRef: params.connectionRef,
      externalEventId,
      startUtc: params.booking.startUtc,
      endUtc: params.booking.endUtc,
      syncTag: params.syncTag,
    });
    return { externalEventId };
  }

  async deleteEvent(params: { connectionRef: string; externalEventId: string }): Promise<void> {
    this.events = this.events.filter((e) => e.externalEventId !== params.externalEventId);
  }
}
