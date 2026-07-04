import { notFound } from 'next/navigation';
import { getRepository } from '@/config';
import BookingWidget from './BookingWidget';

/** Publieke boekingspagina voor een afspraaktype van een tenant. */
export default async function BookingPage(props: {
  params: Promise<{ tenant: string; eventType: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  const { tenant: tenantSlug, eventType: eventTypeSlug } = await props.params;
  const { embed } = await props.searchParams;

  const repo = getRepository();
  const tenant = await repo.getTenantBySlug(tenantSlug);
  if (!tenant) notFound();
  const eventType = await repo.getEventType(tenant.id, eventTypeSlug);
  if (!eventType) notFound();

  const isEmbed = embed === '1';

  return (
    <>
      {!isEmbed && (
        <div className="brandbar" style={{ background: tenant.branding?.primaryColor ?? undefined }}>
          <div className="name">{tenant.name}</div>
          <div className="sub">Plan een afspraak</div>
        </div>
      )}
      <div className="container" style={isEmbed ? { padding: '1rem' } : undefined}>
        <div className="card">
          <h1>{eventType.name}</h1>
          {eventType.description && <p className="muted">{eventType.description}</p>}
          <BookingWidget
            tenantSlug={tenantSlug}
            eventTypeSlug={eventTypeSlug}
            durationMin={eventType.durationMin}
          />
        </div>
      </div>
    </>
  );
}
