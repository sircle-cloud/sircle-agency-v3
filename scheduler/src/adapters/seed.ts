/**
 * Demo-seed: één tenant, één host, twee afspraaktypes en werktijden ma–vr
 * 09:00–17:00 (Europe/Amsterdam). Hiermee draait de app hier out-of-the-box
 * met de MockCalendar (geen Nylas-keys nodig).
 */
import type {
  AvailabilityRule,
  BlockedDate,
  Booking,
  EventType,
  Tenant,
  User,
} from '../core/types';

export interface SeedData {
  tenants: Tenant[];
  users: User[];
  eventTypes: EventType[];
  rules: AvailabilityRule[];
  blocked: BlockedDate[];
  bookings: Booking[];
  /** Map van `${tenantId}:${userId}` → connectionRef (null = geen agenda gekoppeld). */
  connections: Record<string, string | null>;
}

export function buildSeed(): SeedData {
  const tenant: Tenant = {
    id: 't_sircle',
    slug: 'sircle',
    name: 'SIRCLE Solutions',
    timezone: 'Europe/Amsterdam',
    branding: { primaryColor: '#3F6F45', logoUrl: '' },
  };

  const host: User = {
    id: 'u_koen',
    tenantId: tenant.id,
    email: 'koen@sircle.example',
    name: 'Koen',
  };

  const eventTypes: EventType[] = [
    {
      id: 'et_intake',
      tenantId: tenant.id,
      hostUserId: host.id,
      slug: 'intake',
      name: 'Kennismaking (30 min)',
      description: 'Vrijblijvend kennismakingsgesprek.',
      durationMin: 30,
      slotGranularityMin: 30,
      bufferBeforeMin: 0,
      bufferAfterMin: 10,
      minNoticeMin: 120,
      locationType: 'video',
    },
    {
      id: 'et_advies',
      tenantId: tenant.id,
      hostUserId: host.id,
      slug: 'adviesgesprek',
      name: 'Adviesgesprek (60 min)',
      description: 'Verdiepend adviesgesprek.',
      durationMin: 60,
      slotGranularityMin: 30,
      bufferBeforeMin: 0,
      bufferAfterMin: 15,
      minNoticeMin: 240,
      locationType: 'video',
    },
  ];

  // Werktijden ma–vr 09:00–17:00.
  const rules: AvailabilityRule[] = [1, 2, 3, 4, 5].map((weekday) => ({
    id: `ar_${weekday}`,
    tenantId: tenant.id,
    userId: host.id,
    weekday,
    startMinutes: 9 * 60,
    endMinutes: 17 * 60,
    timezone: 'Europe/Amsterdam',
  }));

  return {
    tenants: [tenant],
    users: [host],
    eventTypes,
    rules,
    blocked: [],
    bookings: [],
    // Geen echte agenda in de demo → null. In prod: de Nylas grant-ref.
    connections: { [`${tenant.id}:${host.id}`]: null },
  };
}
