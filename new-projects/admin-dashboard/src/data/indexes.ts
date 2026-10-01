import { netPaid, paymentState, type PaymentState } from "./actions";
import type { Conversation, Database, Order, Payment, Product, Task, User } from "./types";

export type CustomerStats = { orders: number; spent: number; first?: string; last?: string };

export type Indexes = {
  users: Map<string, User>;
  orders: Map<string, Order>;
  products: Map<string, Product>;
  paymentsByOrder: Map<string, Payment[]>;
  ordersByUser: Map<string, Order[]>;
  tasksByOrder: Map<string, Task[]>;
  conversationsByOrder: Map<string, Conversation[]>;
  payment: (order: Order) => PaymentState;
  paid: (order: Order) => number;
  customer: (userId: string) => CustomerStats;
};

function group<T>(items: T[], key: (item: T) => string | undefined) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

// Rebuilt once per change of the database; every screen reads from the same maps.
export function buildIndexes(db: Database): Indexes {
  const paymentsByOrder = group(db.payments, (p) => p.orderId);
  const ordersByUser = group(db.orders, (o) => o.userId);
  const stats = new Map<string, CustomerStats>();
  const states = new Map<string, PaymentState>();
  return {
    users: new Map(db.users.map((u) => [u.id, u])),
    orders: new Map(db.orders.map((o) => [o.id, o])),
    products: new Map(db.products.map((p) => [p.id, p])),
    paymentsByOrder,
    ordersByUser,
    tasksByOrder: group(db.tasks, (t) => t.orderId),
    conversationsByOrder: group(db.conversations, (c) => c.orderId),
    payment(order) {
      let state = states.get(order.id);
      if (!state) {
        state = paymentState(order, paymentsByOrder.get(order.id) ?? []);
        states.set(order.id, state);
      }
      return state;
    },
    paid: (order) => netPaid(paymentsByOrder.get(order.id) ?? []),
    customer(userId) {
      let result = stats.get(userId);
      if (!result) {
        const orders = (ordersByUser.get(userId) ?? []).filter((o) => o.status !== "Cancelled");
        const spent = orders.reduce((sum, o) => sum + netPaid(paymentsByOrder.get(o.id) ?? []), 0);
        result = { orders: orders.length, spent: Math.round(spent * 100) / 100, first: orders.at(-1)?.date, last: orders[0]?.date };
        stats.set(userId, result);
      }
      return result;
    },
  };
}
