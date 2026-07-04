/** Minimale, geldige iCalendar (RFC 5545) generator voor de bevestigingsmail. */
import type { Booking, EventType, Tenant, User } from '../core/types';
import { DateTime } from 'luxon';

function toIcsUtc(iso: string): string {
  return DateTime.fromISO(iso, { zone: 'utc' }).toFormat("yyyyLLdd'T'HHmmss'Z'");
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function buildIcs(params: {
  booking: Booking;
  eventType: EventType;
  tenant: Tenant;
  host: User;
}): string {
  const { booking, eventType, tenant, host } = params;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SIRCLE Scheduler//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${booking.id}@sircle-scheduler`,
    `DTSTAMP:${toIcsUtc(booking.createdAt)}`,
    `DTSTART:${toIcsUtc(booking.startUtc)}`,
    `DTEND:${toIcsUtc(booking.endUtc)}`,
    `SUMMARY:${escapeText(`${eventType.name} — ${tenant.name}`)}`,
    `DESCRIPTION:${escapeText(eventType.description ?? '')}`,
    `ORGANIZER;CN=${escapeText(host.name)}:mailto:${host.email}`,
    `ATTENDEE;CN=${escapeText(booking.guestName)};RSVP=TRUE:mailto:${booking.guestEmail}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  // RFC 5545 wil CRLF-line-endings.
  return lines.join('\r\n');
}
