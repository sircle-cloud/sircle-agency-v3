/**
 * MockBilling — dev/tests zonder Stripe. Stuurt naar een dev-endpoint dat het
 * abonnement meteen activeert, zodat de upgrade-flow lokaal demonstreerbaar is.
 */
import type { BillingProvider } from '../../ports/index';
import type { Tenant } from '../../core/types';

export class MockBilling implements BillingProvider {
  async createCheckoutSession(params: {
    tenant: Tenant;
    planId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }> {
    const base = process.env.APP_URL ?? '';
    const url =
      `${base}/api/billing/dev-activate?planId=${encodeURIComponent(params.planId)}` +
      `&next=${encodeURIComponent(params.successUrl)}`;
    return { url };
  }
}
