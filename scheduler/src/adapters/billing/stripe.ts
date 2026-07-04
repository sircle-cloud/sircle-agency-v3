/**
 * StripeBilling — echte Stripe Checkout via de REST API (geen SDK, blijft lean).
 * Maakt een subscription-checkout met een inline recurring prijs (geen vooraf
 * aangemaakte price-id's nodig). Metadata draagt tenantId + planId zodat de
 * webhook de juiste tenant kan bijwerken.
 *
 * Docs: https://stripe.com/docs/api/checkout/sessions/create
 */
import type { BillingProvider } from '../../ports/index';
import type { Tenant } from '../../core/types';

export interface StripeConfig {
  secretKey: string;
}

export class StripeBilling implements BillingProvider {
  constructor(private config: StripeConfig) {}

  async createCheckoutSession(params: {
    tenant: Tenant;
    planId: string;
    planName: string;
    priceEurCents: number;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
  }): Promise<{ url: string }> {
    const form = new URLSearchParams();
    form.set('mode', 'subscription');
    form.set('success_url', params.successUrl);
    form.set('cancel_url', params.cancelUrl);
    if (params.customerEmail) form.set('customer_email', params.customerEmail);
    form.set('line_items[0][quantity]', '1');
    form.set('line_items[0][price_data][currency]', 'eur');
    form.set('line_items[0][price_data][product_data][name]', `SIRCLE Planner — ${params.planName}`);
    form.set('line_items[0][price_data][unit_amount]', String(params.priceEurCents));
    form.set('line_items[0][price_data][recurring][interval]', 'month');
    form.set('metadata[tenantId]', params.tenant.id);
    form.set('metadata[planId]', params.planId);
    // Ook op de subscription, zodat subscription.deleted de tenant kent.
    form.set('subscription_data[metadata][tenantId]', params.tenant.id);
    form.set('subscription_data[metadata][planId]', params.planId);

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Stripe checkout ${res.status}: ${t}`);
    }
    const data = await res.json();
    return { url: data.url };
  }
}
