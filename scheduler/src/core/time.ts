/**
 * Tijdzone-veilige helpers. Alle DST-gevoelige logica loopt via Luxon met
 * expliciete IANA-zones. We rekenen nooit met vaste offsets (§4/§7).
 */
import { DateTime, Interval } from 'luxon';

/** Overlappen twee [start,end)-intervallen elkaar? Randen die raken tellen niet als overlap. */
export function intervalsOverlap(
  aStartUtc: string,
  aEndUtc: string,
  bStartUtc: string,
  bEndUtc: string,
): boolean {
  const aStart = DateTime.fromISO(aStartUtc, { zone: 'utc' });
  const aEnd = DateTime.fromISO(aEndUtc, { zone: 'utc' });
  const bStart = DateTime.fromISO(bStartUtc, { zone: 'utc' });
  const bEnd = DateTime.fromISO(bEndUtc, { zone: 'utc' });
  // Overlap als aStart < bEnd én bStart < aEnd.
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Zet een lokale wandklok-tijd (datum + minuten-vanaf-middernacht in een IANA-zone)
 * om naar een UTC ISO-string. Dit is DST-correct: 09:00 lokaal blijft 09:00
 * lokaal, ongeacht zomer-/wintertijd.
 */
export function localWallClockToUtc(
  isoDate: string, // YYYY-MM-DD
  minutesFromMidnight: number,
  timezone: string,
): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = DateTime.fromObject(
    {
      year: y,
      month: m,
      day: d,
      hour: Math.floor(minutesFromMidnight / 60),
      minute: minutesFromMidnight % 60,
    },
    { zone: timezone },
  );
  return dt.toUTC().toISO()!;
}

/** ISO-weekdag (1=ma..7=zo) van een datum in een bepaalde zone. */
export function weekdayInZone(isoDate: string, timezone: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return DateTime.fromObject({ year: y, month: m, day: d }, { zone: timezone }).weekday;
}

/** Lijst van datums (YYYY-MM-DD, in `timezone`) van `fromUtc` t/m `toUtc`. */
export function datesInRange(fromUtc: string, toUtc: string, timezone: string): string[] {
  const start = DateTime.fromISO(fromUtc, { zone: 'utc' }).setZone(timezone).startOf('day');
  const end = DateTime.fromISO(toUtc, { zone: 'utc' }).setZone(timezone).startOf('day');
  const out: string[] = [];
  let cur = start;
  // Harde bovengrens tegen oneindige loops bij foute input.
  let guard = 0;
  while (cur <= end && guard < 400) {
    out.push(cur.toISODate()!);
    cur = cur.plus({ days: 1 });
    guard++;
  }
  return out;
}

/** Ligt `isoDate` (YYYY-MM-DD) binnen [from,to] inclusief? */
export function dateInBlockedRange(isoDate: string, from: string, to: string): boolean {
  return isoDate >= from && isoDate <= to;
}

export function addMinutesIso(iso: string, minutes: number): string {
  return DateTime.fromISO(iso, { zone: 'utc' }).plus({ minutes }).toUTC().toISO()!;
}

export function nowUtcIso(): string {
  return DateTime.utc().toISO()!;
}

/** Formatteer een UTC-moment in de tijdzone van de kijker (voor e-mails/UI). */
export function formatInZone(iso: string, timezone: string, locale = 'nl'): string {
  return DateTime.fromISO(iso, { zone: 'utc' })
    .setZone(timezone)
    .setLocale(locale)
    .toFormat("cccc d LLLL yyyy 'om' HH:mm");
}

export { DateTime, Interval };
