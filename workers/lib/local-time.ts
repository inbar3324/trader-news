// Convert a wall-clock date+time in an IANA timezone (e.g. "America/New_York")
// to a UTC Date. Handles DST via Intl.DateTimeFormat — no extra dependency.
//
// Edge cases (DST spring-forward gap & fall-back overlap) are not handled
// specially — caller should avoid 02:00-03:00 local times on transition days.
// For our use (08:30 / 10:00 ET releases) this is safe.

export function localToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(guess));
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)!.value, 10);

  let shownHour = get("hour");
  if (shownHour === 24) shownHour = 0;
  const shownMin = shownHour * 60 + get("minute");
  const desiredMin = hour * 60 + minute;

  // Day-shift between guess and timezone-local
  const guessDate = new Date(guess);
  const shownY = get("year");
  const shownM = get("month");
  const shownD = get("day");
  const dayDeltaMs =
    Date.UTC(shownY, shownM - 1, shownD) -
    Date.UTC(guessDate.getUTCFullYear(), guessDate.getUTCMonth(), guessDate.getUTCDate());

  const offsetMin = shownMin - desiredMin + dayDeltaMs / 60_000;
  return new Date(guess - offsetMin * 60_000);
}
