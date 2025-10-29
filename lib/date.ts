export function toLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toUtcDateKey(date: Date = new Date()): string {
  return date.toISOString().split("T")[0];
}

// Returns a YYYY-MM-DD key that represents the user's LOCAL calendar day,
// encoded as a stable UTC key by shifting by the timezone offset before
// extracting the UTC date. This keeps DB keys consistent while honoring local midnight.
export function toLocalDayUtcKey(date: Date = new Date()): string {
  const tzOffsetMinutes = date.getTimezoneOffset();
  const shifted = new Date(date.getTime() - tzOffsetMinutes * 60_000);
  return shifted.toISOString().split("T")[0];
}
