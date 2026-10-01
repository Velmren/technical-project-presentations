import type { Indexes } from "./indexes";
import type { Database, Order } from "./types";

export type Queues = {
  toPack: Order[];
  failed: Order[];
  transfers: Order[];
  packed: Order[];
  transit: Order[];
  lowStock: number;
  unread: number;
  unreadNotifications: number;
};

const cache = new WeakMap<Database, Queues>();

/** Work waiting for the team right now. Shared by the sidebar, Overview and the command menu. */
export function queues(db: Database, indexes: Indexes): Queues {
  const cached = cache.get(db);
  if (cached) return cached;
  const result: Queues = { toPack: [], failed: [], transfers: [], packed: [], transit: [], lowStock: 0, unread: 0, unreadNotifications: 0 };
  for (const order of db.orders) {
    if (order.status === "Processing") {
      const state = indexes.payment(order);
      if (state === "Paid") result.toPack.push(order);
      else if (state === "Pending") result.transfers.push(order);
      else if (state === "Failed") result.failed.push(order);
    } else if (order.status === "Ready") result.packed.push(order);
    else if (order.status === "Shipped") result.transit.push(order);
    else if (order.date < "2026-09-01") break; // orders are newest first; older ones are all settled
  }
  result.lowStock = db.products.filter((p) => p.status === "Active" && p.stock <= p.reorderPoint).length;
  result.unread = db.conversations.filter((c) => c.unread && !c.archived).length;
  const read = new Set(db.readNotifications);
  result.unreadNotifications = db.events.filter((e) => e.notify && !read.has(e.id)).length;
  cache.set(db, result);
  return result;
}
