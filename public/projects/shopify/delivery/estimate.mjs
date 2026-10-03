import { addBusinessDays, isBusinessDay, nextBusinessDay, zonedInstant, zonedParts } from './calendar.mjs';

export function findZone(rules, country) {
  return rules.zones.find((zone) => zone.countries.includes(country)) || null;
}

/**
 * Dispatch and arrival dates for an order placed at `now`.
 * Dates are calendar days in the warehouse time zone, formatted YYYY-MM-DD.
 */
export function estimateDelivery({ now, country, personalised, rules }) {
  const zone = findZone(rules, country);
  if (!zone) return { country, shipsTo: false };

  const { timeZone, cutoffHour, cutoffMinute = 0, holidays, productionDays } = rules;
  const local = zonedParts(now, timeZone);
  const beforeCutoff = local.hour * 60 + local.minute < cutoffHour * 60 + cutoffMinute;

  const handoverDay = isBusinessDay(local.date, holidays) && beforeCutoff ? local.date : nextBusinessDay(local.date, holidays);
  const dispatch = personalised ? addBusinessDays(handoverDay, productionDays, holidays) : handoverDay;

  return {
    country,
    shipsTo: true,
    zone: zone.id,
    personalised,
    shipsToday: !personalised && handoverDay === local.date,
    now: now.toISOString(),
    cutoff: zonedInstant(handoverDay, cutoffHour, cutoffMinute, timeZone).toISOString(),
    dispatch,
    arrives: {
      from: addBusinessDays(dispatch, zone.transitDays[0]),
      to: addBusinessDays(dispatch, zone.transitDays[1]),
    },
  };
}
