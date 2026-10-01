import type { Route } from "../../app/router";
import { TODAY, addDays } from "../../data/clock";
import type { Indexes } from "../../data/indexes";
import type { Database, Order } from "../../data/types";
import { normalize } from "../../lib/text";

export const views = ["all", "toPack", "awaiting", "packed", "transit", "delivered", "cancelled"] as const;
export type View = (typeof views)[number];
export const placedOptions = ["any", "today", "7", "30", "90"] as const;
export const sortOptions = ["newest", "oldest", "highest", "lowest"] as const;
export const pageSizes = [25, 50, 100] as const;

export type OrdersQuery = {
  view: View;
  q: string;
  payment: string;
  channel: string;
  shipping: string;
  placed: (typeof placedOptions)[number];
  sort: (typeof sortOptions)[number];
  page: number;
  size: number;
};

// Queues show everything waiting right now; history views default to the last 30 days.
const liveViews: View[] = ["toPack", "awaiting", "packed", "transit"];

export function readQuery(route: Route): OrdersQuery {
  const get = (key: string) => route.query.get(key) ?? "";
  const view = (views as readonly string[]).includes(get("view")) ? (get("view") as View) : "all";
  const placedRaw = get("placed");
  const placed = (placedOptions as readonly string[]).includes(placedRaw) ? (placedRaw as OrdersQuery["placed"]) : liveViews.includes(view) ? "any" : "30";
  const sort = (sortOptions as readonly string[]).includes(get("sort")) ? (get("sort") as OrdersQuery["sort"]) : "newest";
  const size = Number(get("size"));
  return {
    view,
    q: get("q"),
    payment: get("payment"),
    channel: get("channel"),
    shipping: get("shipping"),
    placed,
    sort,
    page: Math.max(1, Number(get("page")) || 1),
    size: (pageSizes as readonly number[]).includes(size) ? size : 25,
  };
}

export function inView(order: Order, view: View, indexes: Indexes) {
  switch (view) {
    case "all":
      return true;
    case "toPack":
      return order.status === "Processing" && indexes.payment(order) === "Paid";
    case "awaiting":
      return order.status === "Processing" && indexes.payment(order) !== "Paid";
    case "packed":
      return order.status === "Ready";
    case "transit":
      return order.status === "Shipped";
    case "delivered":
      return order.status === "Delivered";
    case "cancelled":
      return order.status === "Cancelled";
  }
}

function placedSince(placed: OrdersQuery["placed"]) {
  if (placed === "any") return "";
  if (placed === "today") return TODAY;
  // Whole calendar days, the same way Overview counts its periods, so the numbers match.
  return addDays(TODAY, -(Number(placed) - 1));
}


export type QueryResult = { rows: Order[]; ms: number; scanned: number };

/** Filters and sorts all orders. The timing is real and is shown on the product page. */
export function runQuery(db: Database, indexes: Indexes, query: OrdersQuery): QueryResult {
  const started = performance.now();
  const since = placedSince(query.placed);
  const q = normalize(query.q.trim());
  const digits = q.replace(/^nl-?/, "");
  const numeric = /^\d+$/.test(digits);
  const rows = db.orders.filter((order) => {
    if (since && order.date < since) return false;
    if (!inView(order, query.view, indexes)) return false;
    if (query.channel && order.channel !== query.channel) return false;
    if (query.shipping && order.shippingMethod !== query.shipping) return false;
    if (query.payment && indexes.payment(order) !== query.payment) return false;
    if (q) {
      if (numeric && order.id.includes(digits)) return true;
      const customer = indexes.users.get(order.userId);
      if (!customer) return false;
      return normalize(customer.name).includes(q) || customer.email.includes(q) || normalize(order.city).includes(q);
    }
    return true;
  });
  if (query.sort === "oldest") rows.reverse();
  else if (query.sort === "highest") rows.sort((a, b) => b.total - a.total);
  else if (query.sort === "lowest") rows.sort((a, b) => a.total - b.total);
  return { rows, ms: performance.now() - started, scanned: db.orders.length };
}

export function viewCounts(db: Database, indexes: Indexes, since: string): Record<View, number> {
  const counts: Record<View, number> = { all: 0, toPack: 0, awaiting: 0, packed: 0, transit: 0, delivered: 0, cancelled: 0 };
  for (const order of db.orders) {
    const recent = !since || order.date >= since;
    if (recent) counts.all++;
    if (order.status === "Processing") {
      if (indexes.payment(order) === "Paid") counts.toPack++;
      else counts.awaiting++;
    } else if (order.status === "Ready") counts.packed++;
    else if (order.status === "Shipped") counts.transit++;
    else if (recent && order.status === "Delivered") counts.delivered++;
    else if (recent && order.status === "Cancelled") counts.cancelled++;
  }
  return counts;
}

export { placedSince };
