import { describe, it, expect } from 'vitest';
import { BillingService } from '@/core/billing';
import { MemoryRepository } from '@/adapters/repo/memory';
import { MockBilling } from '@/adapters/billing/mock';

function build() {
  const repo = new MemoryRepository();
  const service = new BillingService(repo, new MockBilling());
  return { repo, service };
}

describe('BillingService', () => {
  it('kent de flat-rate plannen', () => {
    const { service } = build();
    const ids = service.getPlans().map((p) => p.id);
    expect(ids).toEqual(['solo', 'praktijk', 'whitelabel']);
    expect(service.getPlan('praktijk')?.priceEurCents).toBe(4900);
  });

  it('maakt een checkout-URL voor een bestaand plan', async () => {
    const { service } = build();
    const { url } = await service.createCheckout({
      tenantId: 't_sircle',
      planId: 'solo',
      successUrl: 'http://x/success',
      cancelUrl: 'http://x/cancel',
    });
    expect(url).toContain('planId=solo');
  });

  it('weigert een onbekend plan', async () => {
    const { service } = build();
    await expect(
      service.createCheckout({
        tenantId: 't_sircle',
        planId: 'bestaat-niet',
        successUrl: 'http://x/s',
        cancelUrl: 'http://x/c',
      }),
    ).rejects.toThrow();
  });

  it('activeert het abonnement via de checkout.session.completed webhook', async () => {
    const { repo, service } = build();
    const res = await service.handleWebhookEvent({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { tenantId: 't_sircle', planId: 'praktijk' },
          customer: 'cus_123',
          subscription: 'sub_123',
        },
      },
    });
    expect(res.handled).toBe(true);
    const tenant = await repo.getTenantById('t_sircle');
    expect(tenant?.plan).toBe('praktijk');
    expect(tenant?.subscriptionStatus).toBe('active');
    expect(tenant?.stripeCustomerId).toBe('cus_123');
  });

  it('zet terug naar free bij een geannuleerd abonnement', async () => {
    const { repo, service } = build();
    await service.applySubscription({ tenantId: 't_sircle', plan: 'praktijk', status: 'active' });
    await service.handleWebhookEvent({
      type: 'customer.subscription.deleted',
      data: { object: { metadata: { tenantId: 't_sircle' } } },
    });
    const tenant = await repo.getTenantById('t_sircle');
    expect(tenant?.plan).toBe('free');
    expect(tenant?.subscriptionStatus).toBe('canceled');
  });
});
