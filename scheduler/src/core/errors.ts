/** Domeinfouten met stabiele codes, zodat de API-laag nette statuscodes kan geven. */

export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

/** Het gekozen slot is niet (meer) beschikbaar — bv. dubbel-boek-race (§4). */
export class SlotUnavailableError extends DomainError {
  constructor(message = 'Dit tijdslot is niet meer beschikbaar.') {
    super('slot_unavailable', message);
  }
}

/** Validatiefout in de boekingsaanvraag. */
export class ValidationError extends DomainError {
  constructor(message: string) {
    super('validation_error', message);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Niet gevonden.') {
    super('not_found', message);
  }
}
