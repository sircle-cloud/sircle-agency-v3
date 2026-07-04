import { describe, it, expect } from 'vitest';
import { OnboardingService } from '@/core/onboarding';
import { BookingService } from '@/core/booking';
import { MemoryRepository } from '@/adapters/repo/memory';
import { MockCalendar } from '@/adapters/calendar/mock';
import { ConsoleMailer } from '@/adapters/mail/console';
import { ValidationError } from '@/core/errors';

let n = 0;
const id = () => `o_${++n}`;

function build() {
  const repo = new MemoryRepository();
  const onboarding = new OnboardingService(repo, id);
  const booking = new BookingService(repo, new MockCalendar(), new ConsoleMailer(), id);
  return { repo, onboarding, booking };
}

const VALID = {
  orgName: 'Praktijk Vermeer',
  slug: 'praktijk-vermeer',
  adminName: 'Anna Vermeer',
  adminEmail: 'anna@vermeer.nl',
  passwordHash: 'hash:demo',
};

describe('OnboardingService', () => {
  it('maakt een tenant + admin met werkende defaults', async () => {
    const { repo, onboarding, booking } = build();
    const { tenant, user } = await onboarding.registerTenant(VALID);

    expect(tenant.slug).toBe('praktijk-vermeer');
    // Admin is te vinden op e-mail (voor login) en heeft de tenant.
    const found = await repo.getUserByEmail('anna@vermeer.nl');
    expect(found?.id).toBe(user.id);

    // Default beschikbaarheid (ma–vr) + starter-afspraaktype werken meteen:
    const { slots } = await booking.listAvailableSlots({
      tenantSlug: 'praktijk-vermeer',
      eventTypeSlug: 'kennismaking',
      fromUtc: '2026-07-06T00:00:00.000Z',
      toUtc: '2026-07-07T00:00:00.000Z',
      nowUtc: '2026-07-01T00:00:00.000Z',
    });
    expect(slots.length).toBeGreaterThan(0);
  });

  it('weigert een dubbele URL-naam', async () => {
    const { onboarding } = build();
    await onboarding.registerTenant(VALID);
    await expect(
      onboarding.registerTenant({ ...VALID, adminEmail: 'ander@vermeer.nl' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('weigert een dubbel e-mailadres', async () => {
    const { onboarding } = build();
    await onboarding.registerTenant(VALID);
    await expect(
      onboarding.registerTenant({ ...VALID, slug: 'andere-praktijk' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('weigert een gereserveerde of ongeldige slug', async () => {
    const { onboarding } = build();
    await expect(onboarding.registerTenant({ ...VALID, slug: 'admin' })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      onboarding.registerTenant({ ...VALID, slug: 'Ongeldig!' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
