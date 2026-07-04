import { getGuestService } from '@/config';
import { formatInZone } from '@/core/time';
import { DomainError } from '@/core/errors';
import ManageBooking from './ManageBooking';

export const dynamic = 'force-dynamic';

const STATUS_MSG: Record<string, { text: string; ok: boolean }> = {
  cancelled: { text: 'Je afspraak is geannuleerd.', ok: true },
  rescheduled: { text: 'Je afspraak is verzet.', ok: true },
  error: { text: 'Er ging iets mis. Probeer het opnieuw.', ok: false },
};

export default async function ManagePage(props: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<{ token?: string; status?: string }>;
}) {
  const { bookingId } = await props.params;
  const { token, status } = await props.searchParams;

  let data;
  try {
    data = await getGuestService().getManageable(bookingId, token);
  } catch (err) {
    const msg = err instanceof DomainError ? err.message : 'Er ging iets mis.';
    return (
      <>
        <div className="brandbar">
          <div className="name">Afspraak beheren</div>
        </div>
        <div className="container">
          <div className="card">
            <div className="notice error">{msg}</div>
          </div>
        </div>
      </>
    );
  }

  const { booking, tenant, eventType } = data;
  const banner = status ? STATUS_MSG[status] : undefined;

  return (
    <>
      <div className="brandbar" style={{ background: tenant.branding?.primaryColor ?? undefined }}>
        <div className="name">{tenant.name}</div>
        <div className="sub">Afspraak beheren</div>
      </div>
      <div className="container">
        <div className="card">
          {banner && <div className={`notice ${banner.ok ? 'success' : 'error'}`}>{banner.text}</div>}

          <h1>{eventType.name}</h1>
          <p className="muted">
            {formatInZone(booking.startUtc, booking.guestTimezone)} ({booking.guestTimezone})
          </p>
          <p>
            Naam: {booking.guestName}
            <br />
            Status:{' '}
            {booking.status === 'confirmed' ? (
              <strong>bevestigd</strong>
            ) : (
              <span className="tag">geannuleerd</span>
            )}
          </p>

          {booking.status === 'confirmed' ? (
            <ManageBooking
              bookingId={booking.id}
              token={token ?? ''}
              tenantSlug={tenant.slug}
              eventTypeSlug={eventType.slug}
              guestTimezone={booking.guestTimezone}
            />
          ) : (
            <p className="muted">Deze afspraak is geannuleerd.</p>
          )}
        </div>
      </div>
    </>
  );
}
