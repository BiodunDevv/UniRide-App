type NullableNumber = number | null | undefined;
type NullableString = string | null | undefined;

type FareArgs = {
  rideFare?: NullableNumber;
  bookingTotalFare?: NullableNumber;
  seatsRequested?: NullableNumber;
  farePerSeat?: boolean;
};

export function resolveSeatCount(
  seatsRequested: NullableNumber,
  fallbackSeats = 1,
): number {
  const seats = Number(seatsRequested || 0);
  return seats > 0 ? seats : fallbackSeats;
}

export function resolveTotalFare({
  rideFare,
  bookingTotalFare,
  seatsRequested,
  farePerSeat = true,
}: FareArgs): number {
  const bookingFare = Number(bookingTotalFare || 0);
  if (bookingFare > 0) return bookingFare;

  const baseFare = Number(rideFare || 0);
  const seats = resolveSeatCount(seatsRequested, 1);
  return farePerSeat ? baseFare * seats : baseFare;
}

export function resolvePerSeatFare({
  rideFare,
  bookingTotalFare,
  seatsRequested,
  farePerSeat = true,
}: FareArgs): number {
  const seats = resolveSeatCount(seatsRequested, 1);
  const baseFare = Number(rideFare || 0);

  if (farePerSeat && baseFare > 0) {
    return baseFare;
  }

  const totalFare = resolveTotalFare({
    rideFare,
    bookingTotalFare,
    seatsRequested: seats,
    farePerSeat,
  });

  return seats > 0 ? totalFare / seats : totalFare;
}

export function normalizePhone(...candidates: NullableString[]): string | null {
  for (const value of candidates) {
    const phone = value?.trim?.();
    if (phone) return phone;
  }
  return null;
}
