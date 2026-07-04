/**
 * OnboardingService — self-service registratie van een nieuwe tenant
 * (organisatie) met zijn eerste admin. Zet meteen zinvolle defaults klaar
 * (werktijden ma–vr 09:00–17:00 + een starter-afspraaktype), zodat een nieuwe
 * klant direct een werkende boekingspagina heeft.
 *
 * Blijft crypto-vrij: het wachtwoord komt al gehasht binnen (de action hasht),
 * zodat de domeinlaag niets van scrypt hoeft te weten.
 */
import type { BookingRepository } from '../ports/index';
import type { Tenant, User } from './types';
import { ValidationError } from './errors';

export interface RegisterTenantInput {
  orgName: string;
  slug: string;
  adminName: string;
  adminEmail: string;
  passwordHash: string;
  timezone?: string;
}

export interface RegisterTenantResult {
  tenant: Tenant;
  user: User;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVED_SLUGS = new Set(['admin', 'api', 'manage', 'signup', 'embed', 'login']);

export class OnboardingService {
  constructor(
    private repo: BookingRepository,
    private idGen: () => string,
  ) {}

  async registerTenant(input: RegisterTenantInput): Promise<RegisterTenantResult> {
    const orgName = input.orgName?.trim();
    const adminName = input.adminName?.trim();
    const email = input.adminEmail?.trim().toLowerCase();
    const slug = input.slug?.trim().toLowerCase();
    const timezone = input.timezone?.trim() || 'Europe/Amsterdam';

    if (!orgName) throw new ValidationError('Organisatienaam is verplicht.');
    if (!adminName) throw new ValidationError('Naam is verplicht.');
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new ValidationError('Geldig e-mailadres is verplicht.');
    }
    if (!slug || !SLUG_RE.test(slug) || RESERVED_SLUGS.has(slug)) {
      throw new ValidationError(
        'Kies een geldige, vrije URL-naam (kleine letters, cijfers, koppeltekens).',
      );
    }

    if (await this.repo.getTenantBySlug(slug)) {
      throw new ValidationError('Deze URL-naam is al in gebruik.');
    }
    if (await this.repo.getUserByEmail(email)) {
      throw new ValidationError('Er bestaat al een account met dit e-mailadres.');
    }

    const tenant: Tenant = {
      id: this.idGen(),
      slug,
      name: orgName,
      timezone,
      branding: { primaryColor: '#3F6F45' },
    };
    await this.repo.createTenant(tenant);

    const user: User = {
      id: this.idGen(),
      tenantId: tenant.id,
      email,
      name: adminName,
      passwordHash: input.passwordHash,
    };
    await this.repo.createUser(user);

    // Default beschikbaarheid: ma–vr 09:00–17:00.
    await this.repo.replaceAvailability(
      tenant.id,
      user.id,
      [1, 2, 3, 4, 5].map((weekday) => ({
        id: this.idGen(),
        tenantId: tenant.id,
        userId: user.id,
        weekday,
        startMinutes: 9 * 60,
        endMinutes: 17 * 60,
        timezone,
      })),
    );

    // Starter-afspraaktype zodat de boekingspagina meteen werkt.
    await this.repo.saveEventType({
      id: this.idGen(),
      tenantId: tenant.id,
      hostUserId: user.id,
      slug: 'kennismaking',
      name: 'Kennismaking (30 min)',
      description: 'Vrijblijvend kennismakingsgesprek.',
      durationMin: 30,
      slotGranularityMin: 30,
      bufferBeforeMin: 0,
      bufferAfterMin: 10,
      minNoticeMin: 120,
      locationType: 'video',
    });

    return { tenant, user };
  }
}
