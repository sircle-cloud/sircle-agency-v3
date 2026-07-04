/**
 * SyncService — de inbound-kant van de twee-weg sync + de reconciliatie-backstop
 * (§4 van het plan).
 *
 * Waarom een backstop? Webhooks zijn "lossy": ze kunnen gemist worden (downtime,
 * netwerk) en garanderen geen levering. Daarom draait er náást de webhooks een
 * periodieke reconciliatie die onze boekingen vergelijkt met de werkelijke
 * agenda van de host en conflicten detecteert (host heeft er handmatig iets
 * overheen gepland).
 *
 * Belangrijk architectuurpunt: omdat we Nylas (managed API) gebruiken, ligt de
 * ZWARE renewal-last (Google watch-channels ~1 week, Microsoft Graph
 * subscriptions ~3 dagen, §4) bij Nylas — níet bij ons. Onze webhook (Nylas → ons)
 * verloopt niet. Deze reconciliatie vangt dus vooral gemiste Nylas-webhooks en
 * eigen downtime op.
 */
import type { BookingRepository, CalendarProvider } from '../ports/index';
import type { Booking } from './types';
import { intervalsOverlap } from './time';

export interface Conflict {
  booking: Booking;
  reason: string;
}

export interface ReconcileResult {
  checked: number;
  conflicts: Conflict[];
}

/** Genormaliseerde Nylas-webhook-payload (subset die we gebruiken). */
export interface NylasWebhookEvent {
  type: string; // "event.created" | "event.updated" | "event.deleted" | "grant.expired" | ...
  data?: { object?: { grant_id?: string } & Record<string, unknown> } & Record<string, unknown>;
}

export interface WebhookResult {
  handled: boolean;
  action: string;
  detail?: string;
}

export class SyncService {
  constructor(
    private repo: BookingRepository,
    private calendar: CalendarProvider,
  ) {}

  /**
   * Vergelijk de bevestigde boekingen van een host met de werkelijke agenda-bezet-
   * tijd. Een boeking is "in conflict" als er bezet-tijd overheen ligt die niet
   * exact ons eigen event is (d.w.z. de host heeft er extern iets overheen gepland).
   */
  async reconcileHost(params: {
    tenantId: string;
    hostUserId: string;
    fromUtc: string;
    toUtc: string;
  }): Promise<ReconcileResult> {
    const conn = await this.repo.getCalendarConnection(params.tenantId, params.hostUserId);
    if (!conn || conn.status !== 'active') return { checked: 0, conflicts: [] };

    const [busy, bookings] = await Promise.all([
      this.calendar.getBusy({
        connectionRef: conn.connectionRef,
        fromUtc: params.fromUtc,
        toUtc: params.toUtc,
      }),
      this.repo.listBookings({
        tenantId: params.tenantId,
        hostUserId: params.hostUserId,
        fromUtc: params.fromUtc,
        toUtc: params.toUtc,
      }),
    ]);

    const conflicts: Conflict[] = [];
    for (const booking of bookings) {
      if (booking.status !== 'confirmed') continue;
      // Vreemde bezet-tijd = een blok dat de boeking overlapt maar niet exact
      // samenvalt met onze eigen booking-footprint (dat laatste is óns event).
      const foreign = busy.find(
        (b) =>
          intervalsOverlap(b.startUtc, b.endUtc, booking.startUtc, booking.endUtc) &&
          !(b.startUtc === booking.startUtc && b.endUtc === booking.endUtc),
      );
      if (foreign) {
        conflicts.push({
          booking,
          reason: `Agenda-conflict: er staat externe bezet-tijd (${foreign.startUtc}–${foreign.endUtc}) over deze afspraak.`,
        });
      }
    }
    return { checked: bookings.length, conflicts };
  }

  /** Verwerk één (geverifieerde) Nylas-webhook. */
  async handleWebhookEvent(evt: NylasWebhookEvent): Promise<WebhookResult> {
    const grantId = evt.data?.object?.grant_id;

    if (evt.type === 'grant.expired' || evt.type === 'grant.deleted') {
      if (!grantId) return { handled: false, action: 'ignored', detail: 'geen grant_id' };
      const conn = await this.repo.findConnectionByGrantId(grantId);
      if (!conn) return { handled: false, action: 'ignored', detail: 'onbekende grant' };
      await this.repo.updateConnectionStatus(conn.tenantId, conn.userId, 'inactive');
      return {
        handled: true,
        action: 'connection_deactivated',
        detail: `${conn.tenantId}/${conn.userId}`,
      };
    }

    if (evt.type.startsWith('event.')) {
      // Agenda gewijzigd. De beschikbaarheid leest bij elke aanvraag live de
      // free/busy, dus er is niets te persisten; we bevestigen enkel de ontvangst.
      // (In een DB-gecachte variant zou je hier een resync voor deze grant triggeren.)
      return { handled: true, action: 'acknowledged', detail: grantId ?? '' };
    }

    return { handled: false, action: 'ignored', detail: evt.type };
  }
}
