/**
 * BillingService — abonnementen (facturatie) voor tenants. De plannen volgen de
 * prijszetting uit het plan (§5): flat-rate, geen per-seat. Praat via de
 * BillingProvider-port (Stripe in prod, mock in dev) en werkt de tenant bij op
 * basis van webhooks.
 */
import type { BillingProvider, BookingRepository } from '../ports/index';
import { NotFoundError, ValidationError } from './errors';

export interface Plan {
  id: string;
  name: string;
  priceEurCents: number;
  interval: 'month';
  features: string[];
}

/** Flat-rate plannen (EUR/maand). White-label is het agency/reseller-plan. */
export const PLANS: Plan[] = [
  {
    id: 'solo',
    name: 'Solo',
    priceEurCents: 1500,
    interval: 'month',
    features: ['1 host', 'Google/Outlook-sync', 'Herinneringen', 'EU-hosting'],
  },
  {
    id: 'praktijk',
    name: 'Praktijk',
    priceEurCents: 4900,
    interval: 'month',
    features: ['Tot 5 hosts', 'Round-robin', 'Verwerkersovereenkomst', 'Alle Solo-features'],
  },
  {
    id: 'whitelabel',
    name: 'White-label',
    priceEurCents: 9900,
    interval: 'month',
    features: ['Eigen merk/domein', 'Onbeperkt hosts', 'Prioriteitssupport', 'Alle Praktijk-features'],
  },
];

export interface StripeWebhookEvent {
  type: string;
  data?: {
    object?: {
      metadata?: { tenantId?: string; planId?: string };
      customer?: string;
      subscription?: string;
      status?: string;
    } & Record<string, unknown>;
  };
}

export class BillingService {
  constructor(
    private repo: BookingRepository,
    private billing: BillingProvider,
  ) {}

  getPlans(): Plan[] {
    return PLANS;
  }

  getPlan(planId: string): Plan | undefined {
    return PLANS.find((p) => p.id === planId);
  }

  /** Start een Stripe Checkout voor een plan; geeft de redirect-URL terug. */
  async createCheckout(params: {
    tenantId: string;
    planId: string;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
  }): Promise<{ url: string }> {
    const tenant = await this.repo.getTenantById(params.tenantId);
    if (!tenant) throw new NotFoundError('Onbekende organisatie.');
    const plan = this.getPlan(params.planId);
    if (!plan) throw new ValidationError('Onbekend plan.');

    return this.billing.createCheckoutSession({
      tenant,
      planId: plan.id,
      planName: plan.name,
      priceEurCents: plan.priceEurCents,
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
      customerEmail: params.customerEmail,
    });
  }

  async applySubscription(params: {
    tenantId: string;
    plan: string;
    status: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  }): Promise<void> {
    await this.repo.updateTenantBilling(params.tenantId, {
      plan: params.plan,
      subscriptionStatus: params.status,
      stripeCustomerId: params.stripeCustomerId,
      stripeSubscriptionId: params.stripeSubscriptionId,
    });
  }

  /** Verwerk een (geverifieerde) Stripe-webhook. */
  async handleWebhookEvent(evt: StripeWebhookEvent): Promise<{ handled: boolean; action: string }> {
    const obj = evt.data?.object;
    const tenantId = obj?.metadata?.tenantId;

    if (evt.type === 'checkout.session.completed') {
      const planId = obj?.metadata?.planId;
      if (!tenantId || !planId) return { handled: false, action: 'ignored' };
      await this.applySubscription({
        tenantId,
        plan: planId,
        status: 'active',
        stripeCustomerId: typeof obj?.customer === 'string' ? obj.customer : undefined,
        stripeSubscriptionId: typeof obj?.subscription === 'string' ? obj.subscription : undefined,
      });
      return { handled: true, action: 'subscription_activated' };
    }

    if (evt.type === 'customer.subscription.deleted') {
      if (!tenantId) return { handled: false, action: 'ignored' };
      await this.applySubscription({ tenantId, plan: 'free', status: 'canceled' });
      return { handled: true, action: 'subscription_canceled' };
    }

    return { handled: false, action: 'ignored' };
  }
}
