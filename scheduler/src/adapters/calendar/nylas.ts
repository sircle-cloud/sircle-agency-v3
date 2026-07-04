/**
 * NylasCalendar — echte twee-weg agenda-sync via de Nylas v3 API (Google,
 * Microsoft/Outlook, iCloud in één API). Standaard op de EU-regio (Ierland),
 * conform §6 (AVG/dataresidentie).
 *
 * `connectionRef` codeert de gekoppelde agenda als: `grantId|email|calendarId`
 * (calendarId optioneel, default "primary"). De grant-id ontstaat uit de
 * OAuth-hosted-auth-flow van Nylas; die flow hoort in de auth-laag, niet hier.
 *
 * Docs: https://developer.nylas.com/docs/v3/calendar/  (free/busy, events)
 */
import type { CalendarProvider } from '../../ports/index';
import type { Booking, BusyInterval, EventType, User } from '../../core/types';
import { DateTime } from 'luxon';

function toUnix(iso: string): number {
  return Math.floor(DateTime.fromISO(iso, { zone: 'utc' }).toSeconds());
}

function parseRef(ref: string): { grantId: string; email: string; calendarId: string } {
  const [grantId, email, calendarId] = ref.split('|');
  return { grantId, email: email ?? '', calendarId: calendarId || 'primary' };
}

export interface NylasConfig {
  apiKey: string;
  /** EU (Ierland) is default; zet op 'https://api.us.nylas.com' voor de VS-regio. */
  apiUri?: string;
}

export class NylasCalendar implements CalendarProvider {
  private base: string;

  constructor(private config: NylasConfig) {
    this.base = config.apiUri ?? 'https://api.eu.nylas.com';
  }

  private async request(path: string, init: RequestInit): Promise<any> {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Nylas ${init.method ?? 'GET'} ${path} → ${res.status}: ${body}`);
    }
    return res.status === 204 ? null : res.json();
  }

  async getBusy(params: {
    connectionRef: string;
    fromUtc: string;
    toUtc: string;
  }): Promise<BusyInterval[]> {
    const { grantId, email } = parseRef(params.connectionRef);
    const data = await this.request(`/v3/grants/${grantId}/calendars/free-busy`, {
      method: 'POST',
      body: JSON.stringify({
        start_time: toUnix(params.fromUtc),
        end_time: toUnix(params.toUtc),
        emails: [email],
      }),
    });
    // Antwoord: { data: [ { email, time_slots: [ { start_time, end_time, status } ] } ] }
    const slots: BusyInterval[] = [];
    for (const entry of data?.data ?? []) {
      for (const ts of entry?.time_slots ?? []) {
        if (ts.status && ts.status !== 'busy') continue;
        slots.push({
          startUtc: DateTime.fromSeconds(ts.start_time, { zone: 'utc' }).toISO()!,
          endUtc: DateTime.fromSeconds(ts.end_time, { zone: 'utc' }).toISO()!,
        });
      }
    }
    return slots;
  }

  async createEvent(params: {
    connectionRef: string;
    booking: Booking;
    eventType: EventType;
    host: User;
    syncTag: string;
  }): Promise<{ externalEventId: string }> {
    const { grantId, calendarId } = parseRef(params.connectionRef);
    const data = await this.request(
      `/v3/grants/${grantId}/events?calendar_id=${encodeURIComponent(calendarId)}`,
      {
        method: 'POST',
        body: JSON.stringify({
          title: `${params.eventType.name} — ${params.booking.guestName}`,
          description: params.eventType.description ?? '',
          when: {
            start_time: toUnix(params.booking.startUtc),
            end_time: toUnix(params.booking.endUtc),
          },
          participants: [{ email: params.booking.guestEmail, name: params.booking.guestName }],
          // Verborgen sync-tag tegen echo-loops (§4): teruglezen uit metadata bij inbound sync.
          metadata: { sircle_sync_tag: params.syncTag },
        }),
      },
    );
    return { externalEventId: data?.data?.id ?? data?.id };
  }

  async deleteEvent(params: { connectionRef: string; externalEventId: string }): Promise<void> {
    const { grantId, calendarId } = parseRef(params.connectionRef);
    await this.request(
      `/v3/grants/${grantId}/events/${params.externalEventId}?calendar_id=${encodeURIComponent(calendarId)}`,
      { method: 'DELETE' },
    );
  }
}
