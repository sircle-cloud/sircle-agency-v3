/**
 * Slot-engine: bereken vrije slots uit beschikbaarheidsregels, buffers, minimale
 * aankondiging, geblokkeerde dagen, bezet-intervallen (uit de agenda) en
 * bestaande boekingen. Pure functie — geen I/O — dus volledig unit-testbaar.
 */
import type {
  AvailabilityRule,
  BlockedDate,
  Booking,
  BusyInterval,
  EventType,
  Slot,
} from './types';
import {
  addMinutesIso,
  dateInBlockedRange,
  datesInRange,
  intervalsOverlap,
  localWallClockToUtc,
  weekdayInZone,
} from './time';

export interface ComputeSlotsInput {
  eventType: EventType;
  rules: AvailabilityRule[];
  blocked: BlockedDate[];
  busy: BusyInterval[];
  bookings: Booking[];
  fromUtc: string; // begin van het zoekvenster
  toUtc: string; // einde van het zoekvenster
  nowUtc: string; // "nu", expliciet meegegeven (testbaar, geen verborgen Date.now)
}

/**
 * Retourneert de beschikbare slots, oplopend gesorteerd. Een slot is beschikbaar
 * als het (a) volledig binnen een beschikbaarheidsvenster valt, (b) minstens
 * `minNoticeMin` in de toekomst ligt, (c) niet op een geblokkeerde dag valt, en
 * (d) — inclusief buffers — niet overlapt met bezet-tijd of bestaande boekingen.
 */
export function computeSlots(input: ComputeSlotsInput): Slot[] {
  const { eventType, rules, blocked, busy, bookings, fromUtc, toUtc, nowUtc } = input;
  const duration = eventType.durationMin;
  const granularity = eventType.slotGranularityMin ?? duration;
  const bufBefore = eventType.bufferBeforeMin;
  const bufAfter = eventType.bufferAfterMin;

  // Actieve boekingen tellen als bezet.
  const busyBlocks: BusyInterval[] = [
    ...busy,
    ...bookings
      .filter((b) => b.status === 'confirmed')
      .map((b) => ({ startUtc: b.startUtc, endUtc: b.endUtc })),
  ];

  const earliestStartUtc = addMinutesIso(nowUtc, eventType.minNoticeMin);
  const slots: Slot[] = [];

  for (const date of datesInRange(fromUtc, toUtc, tzOf(rules, eventType))) {
    const rulesForDay = rules.filter(
      (r) => r.weekday === weekdayInZone(date, r.timezone),
    );
    if (rulesForDay.length === 0) continue;

    const isBlocked = blocked.some((b) => dateInBlockedRange(date, b.dateFrom, b.dateTo));
    if (isBlocked) continue;

    for (const rule of rulesForDay) {
      // Loop door het venster in granulariteit-stappen.
      for (
        let startMin = rule.startMinutes;
        startMin + duration <= rule.endMinutes;
        startMin += granularity
      ) {
        const slotStartUtc = localWallClockToUtc(date, startMin, rule.timezone);
        const slotEndUtc = addMinutesIso(slotStartUtc, duration);

        // Buiten het gevraagde zoekvenster? Overslaan.
        if (slotStartUtc < fromUtc || slotStartUtc >= toUtc) continue;

        // Minimale aankondiging.
        if (slotStartUtc < earliestStartUtc) continue;

        // Overlap-check inclusief buffers rond de kandidaat.
        const guardStartUtc = addMinutesIso(slotStartUtc, -bufBefore);
        const guardEndUtc = addMinutesIso(slotEndUtc, bufAfter);
        const conflict = busyBlocks.some((b) =>
          intervalsOverlap(guardStartUtc, guardEndUtc, b.startUtc, b.endUtc),
        );
        if (conflict) continue;

        slots.push({ startUtc: slotStartUtc, endUtc: slotEndUtc });
      }
    }
  }

  // Dedup (overlappende regels kunnen hetzelfde slot opleveren) + sorteer.
  const seen = new Set<string>();
  return slots
    .filter((s) => {
      if (seen.has(s.startUtc)) return false;
      seen.add(s.startUtc);
      return true;
    })
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc));
}

/** Bepaal de tijdzone om de datumreeks in te itereren (regel > event-type default). */
function tzOf(rules: AvailabilityRule[], eventType: EventType): string {
  return rules[0]?.timezone ?? 'UTC';
}

/**
 * Is een specifiek slot beschikbaar? Gebruikt vlak vóór het bevestigen van een
 * boeking als "free/busy-check op het laatste moment" (§4/§7) tegen races.
 */
export function isSlotAvailable(
  input: Omit<ComputeSlotsInput, 'fromUtc' | 'toUtc'> & { startUtc: string },
): boolean {
  const slotEndUtc = addMinutesIso(input.startUtc, input.eventType.durationMin);
  const slots = computeSlots({
    ...input,
    fromUtc: input.startUtc,
    toUtc: slotEndUtc,
  });
  return slots.some((s) => s.startUtc === input.startUtc);
}
