const DAY_MS = 86_400_000;
const formatters = new Map();

function formatter(timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(
      timeZone,
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
  }
  return formatters.get(timeZone);
}

/** Wall-clock date and time of an instant in a time zone. */
export function zonedParts(instant, timeZone) {
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );
  const date = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  return { date, hour: parts.hour, minute: parts.minute, second: parts.second };
}

/** Instant at which the wall clock in a time zone shows the given date and time. */
export function zonedInstant(date, hour, minute, timeZone) {
  const target = Date.parse(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`);
  let guess = target;
  // Two passes settle the offset, including across a daylight saving change.
  for (let pass = 0; pass < 2; pass += 1) {
    const shown = zonedParts(new Date(guess), timeZone);
    const shownAsUtc = Date.parse(
      `${shown.date}T${String(shown.hour).padStart(2, '0')}:${String(shown.minute).padStart(2, '0')}:00Z`
    );
    guess += target - shownAsUtc;
  }
  return new Date(guess);
}

export function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function isBusinessDay(date, holidays = []) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !holidays.includes(date);
}

export function nextBusinessDay(date, holidays = []) {
  let next = addDays(date, 1);
  while (!isBusinessDay(next, holidays)) next = addDays(next, 1);
  return next;
}

export function addBusinessDays(date, days, holidays = []) {
  let result = date;
  for (let step = 0; step < days; step += 1) result = nextBusinessDay(result, holidays);
  return result;
}
