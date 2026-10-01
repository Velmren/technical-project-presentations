import type { Route } from "../../app/router";
import { ANCHOR, DAY } from "../../data/clock";
import type { CustomerStats, Indexes } from "../../data/indexes";
import type { Database, User } from "../../data/types";
import { normalize } from "../../lib/text";

export const customerViews = ["all", "vip", "returning", "new", "dormant", "prospects"] as const;
export type CustomerView = (typeof customerViews)[number];
export const customerSorts = ["recent", "spent", "orders", "name", "joined"] as const;
export type Segment = "vip" | "returning" | "new" | "dormant" | "prospect" | "one";

const newSince = new Date(Date.parse(ANCHOR) - 30 * DAY).toISOString();
const dormantBefore = new Date(Date.parse(ANCHOR) - 120 * DAY).toISOString();

export function segmentOf(stats: CustomerStats): Segment {
  if (!stats.orders) return "prospect";
  if (stats.spent >= 800 || stats.orders >= 5) return "vip";
  if (stats.last && stats.last < dormantBefore) return "dormant";
  if (stats.first && stats.first >= newSince) return "new";
  if (stats.orders >= 2) return "returning";
  return "one";
}

export function inCustomerView(stats: CustomerStats, view: CustomerView) {
  switch (view) {
    case "all":
      return true;
    case "vip":
      return stats.spent >= 800 || stats.orders >= 5;
    case "returning":
      return stats.orders >= 2;
    case "new":
      return !!stats.first && stats.first >= newSince;
    case "dormant":
      return !!stats.last && stats.last < dormantBefore;
    case "prospects":
      return stats.orders === 0;
  }
}

export type CustomersQuery = { view: CustomerView; q: string; country: string; sort: (typeof customerSorts)[number]; page: number; size: number };

export function readCustomersQuery(route: Route): CustomersQuery {
  const get = (key: string) => route.query.get(key) ?? "";
  const size = Number(get("size"));
  return {
    view: (customerViews as readonly string[]).includes(get("view")) ? (get("view") as CustomerView) : "all",
    q: get("q"),
    country: get("country"),
    sort: (customerSorts as readonly string[]).includes(get("sort")) ? (get("sort") as CustomersQuery["sort"]) : "recent",
    page: Math.max(1, Number(get("page")) || 1),
    size: [25, 50, 100].includes(size) ? size : 25,
  };
}

export type CustomerRow = { user: User; stats: CustomerStats };

// Plain comparisons: ten thousand rows are sorted on every change of the list.
const desc = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);
const collator = new Intl.Collator("en");

export function runCustomersQuery(db: Database, indexes: Indexes, query: CustomersQuery) {
  const q = normalize(query.q.trim());
  const rows: CustomerRow[] = [];
  for (const user of db.users) {
    if (user.role !== "Customer") continue;
    if (query.country && user.country !== query.country) continue;
    if (q && !normalize(user.name).includes(q) && !user.email.includes(q) && !normalize(user.region).includes(q)) continue;
    const stats = indexes.customer(user.id);
    if (!inCustomerView(stats, query.view)) continue;
    rows.push({ user, stats });
  }
  const by = {
    recent: (a: CustomerRow, b: CustomerRow) => desc(a.stats.last ?? a.user.joined, b.stats.last ?? b.user.joined),
    spent: (a: CustomerRow, b: CustomerRow) => b.stats.spent - a.stats.spent,
    orders: (a: CustomerRow, b: CustomerRow) => b.stats.orders - a.stats.orders || b.stats.spent - a.stats.spent,
    name: (a: CustomerRow, b: CustomerRow) => collator.compare(a.user.name, b.user.name),
    joined: (a: CustomerRow, b: CustomerRow) => desc(a.user.joined, b.user.joined),
  }[query.sort];
  rows.sort(by);
  return rows;
}

export function customerCounts(db: Database, indexes: Indexes) {
  const counts: Record<CustomerView, number> = { all: 0, vip: 0, returning: 0, new: 0, dormant: 0, prospects: 0 };
  const countries = new Map<string, number>();
  for (const user of db.users) {
    if (user.role !== "Customer") continue;
    const stats = indexes.customer(user.id);
    for (const view of customerViews) if (inCustomerView(stats, view)) counts[view]++;
    countries.set(user.country, (countries.get(user.country) ?? 0) + 1);
  }
  return { counts, countries: [...countries.entries()].sort((a, b) => b[1] - a[1]) };
}
