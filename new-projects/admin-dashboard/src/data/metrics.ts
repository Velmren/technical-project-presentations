import { DAY, TODAY, addDays, dayMs, isoDay } from "./clock";
import type { Category, Database, Period } from "./types";

type Daily = {
  revenue: Map<string, number>;
  orders: Map<string, number>;
  customers: Map<string, number>;
  categories: Map<string, Map<Category, number>>;
};

const cache = new WeakMap<Database, Daily>();
const add = <K,>(map: Map<K, number>, key: K, value: number) => map.set(key, (map.get(key) ?? 0) + value);

/** Per-day totals, computed once per version of the data and shared by every chart. */
export function daily(db: Database): Daily {
  const cached = cache.get(db);
  if (cached) return cached;
  const revenue = new Map<string, number>();
  const orders = new Map<string, number>();
  const customers = new Map<string, number>();
  const categories = new Map<string, Map<Category, number>>();
  const category = new Map(db.products.map((p) => [p.id, p.category]));
  for (const payment of db.payments) {
    if (payment.status !== "Paid") continue;
    add(revenue, payment.date.slice(0, 10), payment.type === "Charge" ? payment.amount : -payment.amount);
  }
  const firstOrder = new Map<string, string>();
  for (const order of db.orders) {
    const day = order.date.slice(0, 10);
    add(orders, day, 1);
    const seen = firstOrder.get(order.userId);
    if (!seen || day < seen) firstOrder.set(order.userId, day);
    if (order.status === "Cancelled") continue;
    let byCategory = categories.get(day);
    if (!byCategory) categories.set(day, (byCategory = new Map()));
    for (const item of order.items) add(byCategory, category.get(item.productId)!, item.quantity * item.unitPrice);
  }
  for (const day of firstOrder.values()) add(customers, day, 1);
  const result = { revenue, orders, customers, categories };
  cache.set(db, result);
  return result;
}

export type Metric = "revenue" | "orders" | "customers";

export function periodDays(period: Period, offset = 0) {
  const end = addDays(TODAY, -offset * period);
  return Array.from({ length: period }, (_, i) => addDays(end, i - period + 1));
}

function sum(map: Map<string, number>, days: string[]) {
  let total = 0;
  for (const day of days) total += map.get(day) ?? 0;
  return total;
}

export function totals(db: Database, period: Period, offset = 0) {
  const d = daily(db);
  const days = periodDays(period, offset);
  const revenue = sum(d.revenue, days);
  const orders = sum(d.orders, days);
  const customers = sum(d.customers, days);
  return { revenue, orders, customers, aov: orders ? revenue / orders : 0, days };
}

export type SeriesPoint = { key: string; start: string; value: number; previous: number; unit: "day" | "week" | "month" };

/**
 * Chart buckets: days for 7 and 30 days, weeks for 90 days, months for 12 months.
 * "previous" is the same position in the preceding period.
 */
export function series(db: Database, period: Period, metric: Metric, smooth = false): SeriesPoint[] {
  const map = daily(db)[metric];
  const days = periodDays(period);
  const previousDays = periodDays(period, 1);
  const unit = period <= 30 ? "day" : period === 90 ? "week" : "month";
  const size = unit === "day" ? 1 : unit === "week" ? 7 : 0;
  if (unit !== "month") {
    const points: SeriesPoint[] = [];
    for (let i = days.length % size ? -(size - (days.length % size)) : 0, n = 0; i < days.length; i += size, n++) {
      const slice = days.slice(Math.max(0, i), i + size);
      const previous = previousDays.slice(Math.max(0, i), i + size);
      if (smooth && unit === "day") {
        const window = (day: string) => Array.from({ length: 7 }, (_, k) => addDays(day, -k));
        points.push({ key: slice[0], start: slice[0], value: sum(map, window(slice[0])) / 7, previous: sum(map, window(previous[0])) / 7, unit });
      } else points.push({ key: slice[0], start: slice[0], value: sum(map, slice), previous: sum(map, previous), unit });
    }
    return points;
  }
  const months: SeriesPoint[] = [];
  for (let m = 11; m >= 0; m--) {
    const end = new Date(dayMs(TODAY));
    const monthStart = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - m, 1));
    const next = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
    const inMonth: string[] = [];
    for (let t = monthStart.getTime(); t < next.getTime() && t <= dayMs(TODAY); t += DAY) inMonth.push(isoDay(t));
    const lastYear = inMonth.map((day) => addDays(day, -365));
    months.push({ key: isoDay(monthStart.getTime()), start: isoDay(monthStart.getTime()), value: sum(map, inMonth), previous: sum(map, lastYear), unit });
  }
  return months;
}

export function categoryShares(db: Database, period: Period) {
  const byDay = daily(db).categories;
  const totalsByCategory = new Map<Category, number>();
  for (const day of periodDays(period)) {
    const entry = byDay.get(day);
    if (entry) for (const [category, value] of entry) add(totalsByCategory, category, value);
  }
  const gross = [...totalsByCategory.values()].reduce((a, b) => a + b, 0) || 1;
  return [...totalsByCategory.entries()].map(([category, value]) => ({ category, share: value / gross })).sort((a, b) => b.share - a.share);
}

export function dailyValues(db: Database, period: Period, metric: Metric) {
  const map = daily(db)[metric];
  return periodDays(period).map((day) => map.get(day) ?? 0);
}

export type ProductStats = { units30: number; revenue30: number; weekly: number[]; orders: string[] };
const productCache = new WeakMap<Database, Map<string, ProductStats>>();

/** Units and revenue per product: last 30 days, and 13 weekly buckets for the trend. */
export function productStats(db: Database) {
  const cached = productCache.get(db);
  if (cached) return cached;
  const result = new Map<string, ProductStats>(db.products.map((p) => [p.id, { units30: 0, revenue30: 0, weekly: new Array(13).fill(0), orders: [] }]));
  const since30 = addDays(TODAY, -29);
  const since91 = addDays(TODAY, -90);
  for (const order of db.orders) {
    const day = order.date.slice(0, 10);
    if (day < since91) break;
    if (order.status === "Cancelled") continue;
    const week = Math.min(12, Math.floor((dayMs(day) - dayMs(since91)) / (7 * DAY)));
    for (const item of order.items) {
      const stats = result.get(item.productId);
      if (!stats) continue;
      stats.weekly[week] += item.quantity;
      if (stats.orders.length < 6) stats.orders.push(order.id);
      if (day >= since30) {
        stats.units30 += item.quantity;
        stats.revenue30 += item.quantity * item.unitPrice;
      }
    }
  }
  productCache.set(db, result);
  return result;
}

export type Breakdown = { key: string; value: number; units?: number; orders?: number };
export type AnalyticsReport = {
  products: Breakdown[];
  countries: Breakdown[];
  channels: Breakdown[];
  heat: number[][];
  received: number;
  refunded: number;
  cancelled: number;
  orders: number;
  repeatOrders: number;
};
const analyticsCache = new WeakMap<Database, Map<string, AnalyticsReport>>();

/** Everything the Analytics section shows for one period, computed in a single pass over the orders. */
export function analytics(db: Database, period: Period, timezone: string): AnalyticsReport {
  let byDb = analyticsCache.get(db);
  if (!byDb) analyticsCache.set(db, (byDb = new Map()));
  const cacheKey = `${period}|${timezone}`;
  const cached = byDb.get(cacheKey);
  if (cached) return cached;
  const since = periodDays(period)[0];
  const products = new Map<string, Breakdown>();
  const countries = new Map<string, Breakdown>();
  const channels = new Map<string, Breakdown>();
  const heat = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  const parts = new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "numeric", hourCycle: "h23", timeZone: timezone });
  const weekdays: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const firstOrder = new Map<string, string>();
  for (let i = db.orders.length - 1; i >= 0; i--) {
    const o = db.orders[i];
    if (!firstOrder.has(o.userId)) firstOrder.set(o.userId, o.id);
  }
  let orders = 0;
  let cancelled = 0;
  let repeatOrders = 0;
  const bump = (map: Map<string, Breakdown>, key: string, value: number, units = 0) => {
    const entry = map.get(key) ?? { key, value: 0, units: 0, orders: 0 };
    entry.value += value;
    entry.units! += units;
    entry.orders! += 1;
    map.set(key, entry);
  };
  for (const order of db.orders) {
    if (order.date.slice(0, 10) < since) break;
    orders++;
    if (firstOrder.get(order.userId) !== order.id) repeatOrders++;
    const p = parts.formatToParts(new Date(order.date));
    const day = weekdays[p.find((x) => x.type === "weekday")!.value];
    const hour = Number(p.find((x) => x.type === "hour")!.value) % 24;
    heat[day][hour]++;
    if (order.status === "Cancelled") {
      cancelled++;
      continue;
    }
    const net = order.subtotal - order.discount;
    bump(countries, order.country, net);
    bump(channels, order.channel, net);
    for (const item of order.items) bump(products, item.productId, item.quantity * item.unitPrice * (net / (order.subtotal || 1)), item.quantity);
  }
  let received = 0;
  let refunded = 0;
  for (const payment of db.payments) {
    if (payment.date.slice(0, 10) < since) break;
    if (payment.status !== "Paid") continue;
    if (payment.type === "Charge") received += payment.amount;
    else refunded += payment.amount;
  }
  const sorted = (map: Map<string, Breakdown>) => [...map.values()].sort((a, b) => b.value - a.value);
  const report = { products: sorted(products), countries: sorted(countries), channels: sorted(channels), heat, received, refunded, cancelled, orders, repeatOrders };
  byDb.set(cacheKey, report);
  return report;
}
