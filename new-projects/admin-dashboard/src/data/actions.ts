import type { Database, Event, EventArea, EventKind, Order, OrderStatus, Payment, Product, Result, Settings, Task, Text, User } from "./types";

// Every change is an action. The log of actions is what gets saved, and replaying
// it over the generated base restores the workspace exactly (see store.tsx).
export type Action =
  | { type: "order.advance"; id: string; to: "Ready" | "Shipped" | "Delivered" }
  | { type: "order.bulkAdvance"; ids: string[]; to: "Ready" | "Shipped" }
  | { type: "order.cancel"; id: string; refundId?: string }
  | { type: "order.refund"; id: string; amount: number; reason: NonNullable<Payment["reason"]>; refundId: string }
  | { type: "payment.capture"; orderId: string }
  | { type: "payment.retry"; orderId: string; paymentId: string }
  | { type: "user.update"; id: string; patch: Partial<Pick<User, "name" | "email" | "role" | "status" | "region">> }
  | { type: "user.invite"; user: User }
  | { type: "user.revoke"; id: string }
  | { type: "product.update"; id: string; patch: Partial<Pick<Product, "name" | "description" | "price" | "stock" | "status" | "category" | "reorderPoint">> }
  | { type: "task.create"; task: Task }
  | { type: "task.update"; id: string; patch: Partial<Omit<Task, "id" | "created">> }
  | { type: "message.send"; conversationId: string; messageId: string; text: string }
  | { type: "conversation.read"; id: string }
  | { type: "conversation.archive"; id: string; value: boolean }
  | { type: "settings.save"; settings: Settings }
  | { type: "notifications.read"; ids: string[] };

export type LoggedAction = Action & { uid: string; at: string; actor: string };
export type Outcome = { db: Database; result: Result; undoable?: boolean };

const round2 = (value: number) => Math.round(value * 100) / 100;
const fail = (db: Database, key: string, params?: Record<string, string | number>): Outcome => ({ db, result: { ok: false, error: { key, params } } });

export function chargesOf(db: Database, orderId: string) {
  return db.payments.filter((payment) => payment.orderId === orderId);
}

export function netPaid(payments: Payment[]) {
  return round2(payments.reduce((sum, p) => (p.status !== "Paid" ? sum : p.type === "Charge" ? sum + p.amount : sum - p.amount), 0));
}

export type PaymentState = "Paid" | "Pending" | "Failed" | "Refunded" | "Partial" | "Unpaid";
export function paymentState(order: Order, payments: Payment[]): PaymentState {
  const refunded = payments.some((p) => p.type === "Refund");
  const paid = netPaid(payments);
  if (refunded) return paid <= 0.009 ? "Refunded" : "Partial";
  if (paid >= order.total - 0.009) return "Paid";
  if (payments.some((p) => p.type === "Charge" && p.status === "Pending")) return "Pending";
  if (payments.some((p) => p.type === "Charge" && p.status === "Failed")) return "Failed";
  return "Unpaid";
}

function withEvent(db: Database, action: LoggedAction, kind: EventKind, area: EventArea, params: Record<string, string | number>, targetId?: string): Database {
  const event: Event = { id: `EVT-U${action.uid}`, at: action.at, kind, area, actorId: action.actor, targetId, params };
  return { ...db, events: [event, ...db.events] };
}

function replaceOrder(db: Database, order: Order) {
  return db.orders.map((entry) => (entry.id === order.id ? order : entry));
}

function trackingFrom(uid: string) {
  let hash = 0;
  for (const char of uid) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `NLX${String(100000000 + (hash % 900000000))}`;
}

const nextStep: Partial<Record<OrderStatus, OrderStatus>> = { Processing: "Ready", Ready: "Shipped", Shipped: "Delivered" };

function advance(db: Database, action: LoggedAction, id: string, to: "Ready" | "Shipped" | "Delivered"): Outcome {
  const order = db.orders.find((entry) => entry.id === id);
  if (!order) return fail(db, "errors.notFound");
  if (order.status === to) return fail(db, "errors.alreadyStatus", { order: order.id, status: `@status.order.${order.status}` });
  const pickupCollected = order.shippingMethod === "Pickup" && order.status === "Ready" && to === "Delivered";
  if (nextStep[order.status] !== to && !pickupCollected) return fail(db, "errors.wrongStep", { order: order.id, from: `@status.order.${order.status}`, to: `@status.order.${to}` });
  const payments = chargesOf(db, order.id);
  if (to !== "Delivered" && netPaid(payments) < order.total - 0.009) return fail(db, "errors.notPaid", { order: order.id, amount: round2(order.total - netPaid(payments)) });
  const updated: Order = {
    ...order,
    status: to,
    tracking: to === "Shipped" ? trackingFrom(action.uid) : order.tracking,
    timeline: [...order.timeline, { status: to, at: action.at, by: action.actor }],
  };
  const next = withEvent({ ...db, orders: replaceOrder(db, updated) }, action, "order.status", "order", { order: order.id, status: to }, order.id);
  const toastKey = to === "Ready" ? "toast.packed" : to === "Shipped" ? "toast.shipped" : pickupCollected ? "toast.collected" : "toast.delivered";
  return { db: next, result: { ok: true, message: { key: toastKey, params: { order: order.id } } }, undoable: true };
}

export function apply(db: Database, action: LoggedAction): Outcome {
  switch (action.type) {
    case "order.advance":
      return advance(db, action, action.id, action.to);

    case "order.bulkAdvance": {
      let current = db;
      let done = 0;
      for (const id of action.ids) {
        const outcome = advance(current, { ...action, type: "order.advance", id, to: action.to }, id, action.to);
        if (outcome.result.ok) {
          current = outcome.db;
          done++;
        }
      }
      if (!done) return fail(db, "errors.generic");
      // One batch entry in the activity feed instead of a line per order.
      current = withEvent({ ...current, events: current.events.slice(done) }, action, "order.batch", "order", { count: done, status: action.to });
      return { db: current, result: { ok: true, message: { key: action.to === "Ready" ? "toast.bulkPacked" : "toast.bulkShipped", params: { count: done } } }, undoable: true };
    }

    case "order.cancel": {
      const order = db.orders.find((entry) => entry.id === action.id);
      if (!order) return fail(db, "errors.notFound");
      if (order.status === "Cancelled") return fail(db, "errors.alreadyStatus", { order: order.id, status: "@status.order.Cancelled" });
      if (order.status !== "Processing" && order.status !== "Ready") return fail(db, "errors.cancelShipped", { order: order.id });
      const returned = new Map<string, number>();
      for (const item of order.items) returned.set(item.productId, (returned.get(item.productId) ?? 0) + item.quantity);
      const products = db.products.map((product) => (returned.has(product.id) ? { ...product, stock: product.stock + returned.get(product.id)! } : product));
      const payments = chargesOf(db, order.id);
      const paid = netPaid(payments);
      const charge = payments.find((p) => p.type === "Charge" && p.status === "Paid");
      const refund: Payment | null = action.refundId && paid > 0 && charge ? { id: action.refundId, orderId: order.id, date: action.at, amount: paid, type: "Refund", status: "Paid", method: charge.method, last4: charge.last4, reason: "Cancelled" } : null;
      // An unpaid pending transfer or declined card is closed together with the order.
      const closed = db.payments.map((p) => (p.orderId === order.id && p.type === "Charge" && p.status === "Pending" ? { ...p, status: "Failed" as const } : p));
      const updated: Order = { ...order, status: "Cancelled", timeline: [...order.timeline, { status: "Cancelled", at: action.at, by: action.actor }, ...(refund ? [{ status: "Refunded" as const, at: action.at, by: action.actor }] : [])] };
      const next = withEvent({ ...db, orders: replaceOrder(db, updated), products, payments: refund ? [refund, ...closed] : closed }, action, "order.cancelled", "order", { order: order.id }, order.id);
      return { db: next, result: { ok: true, message: refund ? { key: "toast.cancelledRefund", params: { order: order.id, amount: refund.amount } } : { key: "toast.cancelled", params: { order: order.id } } }, undoable: true };
    }

    case "order.refund": {
      const order = db.orders.find((entry) => entry.id === action.id);
      if (!order) return fail(db, "errors.notFound");
      const payments = chargesOf(db, order.id);
      const available = netPaid(payments);
      if (available <= 0.009) return fail(db, "errors.nothingToRefund", { order: order.id });
      if (!(action.amount > 0)) return fail(db, "orders.refund.invalid");
      if (action.amount > available + 0.009) return fail(db, "errors.refundTooMuch", { amount: available });
      const charge = payments.find((p) => p.type === "Charge" && p.status === "Paid")!;
      const refund: Payment = { id: action.refundId, orderId: order.id, date: action.at, amount: round2(action.amount), type: "Refund", status: "Paid", method: charge.method, last4: charge.last4, reason: action.reason };
      const updated: Order = { ...order, timeline: [...order.timeline, { status: "Refunded", at: action.at, by: action.actor }] };
      const next = withEvent({ ...db, orders: replaceOrder(db, updated), payments: [refund, ...db.payments] }, action, "payment.refunded", "payment", { order: order.id, amount: refund.amount }, order.id);
      return { db: next, result: { ok: true, message: { key: "toast.refunded", params: { order: order.id, amount: refund.amount } } }, undoable: true };
    }

    case "payment.capture": {
      const order = db.orders.find((entry) => entry.id === action.orderId);
      if (!order) return fail(db, "errors.notFound");
      if (order.status === "Cancelled") return fail(db, "errors.captureCancelled", { order: order.id });
      const pending = db.payments.find((p) => p.orderId === order.id && p.type === "Charge" && p.status === "Pending");
      if (!pending) return fail(db, "errors.alreadyPaid", { order: order.id });
      const payments = db.payments.map((p) => (p.id === pending.id ? { ...p, status: "Paid" as const, date: action.at } : p));
      const updated: Order = { ...order, timeline: [...order.timeline, { status: "Paid", at: action.at, by: action.actor }] };
      const next = withEvent({ ...db, payments, orders: replaceOrder(db, updated) }, action, "payment.captured", "payment", { order: order.id, amount: pending.amount }, order.id);
      return { db: next, result: { ok: true, message: { key: "toast.captured", params: { order: order.id } } }, undoable: true };
    }

    case "payment.retry": {
      const order = db.orders.find((entry) => entry.id === action.orderId);
      if (!order) return fail(db, "errors.notFound");
      if (order.status === "Cancelled") return fail(db, "errors.captureCancelled", { order: order.id });
      const payments = chargesOf(db, order.id);
      if (netPaid(payments) >= order.total - 0.009) return fail(db, "errors.alreadyPaid", { order: order.id });
      const failed = payments.find((p) => p.type === "Charge" && p.status === "Failed");
      const charge: Payment = { id: action.paymentId, orderId: order.id, date: action.at, amount: order.total, type: "Charge", status: "Paid", method: failed?.method ?? "Card", last4: failed?.last4 };
      const updated: Order = { ...order, timeline: [...order.timeline, { status: "Paid", at: action.at, by: action.actor }] };
      const next = withEvent({ ...db, payments: [charge, ...db.payments], orders: replaceOrder(db, updated) }, action, "payment.captured", "payment", { order: order.id, amount: charge.amount }, order.id);
      return { db: next, result: { ok: true, message: { key: "toast.retried", params: { order: order.id } } }, undoable: true };
    }

    case "user.update": {
      const user = db.users.find((entry) => entry.id === action.id);
      if (!user) return fail(db, "errors.notFound");
      const updated = { ...user, ...action.patch };
      const next = withEvent({ ...db, users: db.users.map((entry) => (entry.id === user.id ? updated : entry)) }, action, "user.updated", "user", { user: updated.name }, user.id);
      const message: Text =
        action.patch.role && action.patch.role !== user.role ? { key: "toast.roleChanged", params: { user: updated.name, role: `@team.roles.${action.patch.role}` } } :
        action.patch.status === "Suspended" ? { key: "toast.accessPaused", params: { user: updated.name } } :
        action.patch.status === "Active" && user.status === "Suspended" ? { key: "toast.accessRestored", params: { user: updated.name } } :
        { key: "toast.userSaved", params: { user: updated.name } };
      return { db: next, result: { ok: true, message }, undoable: true };
    }

    case "user.invite": {
      const email = action.user.email.toLowerCase();
      if (db.users.some((entry) => entry.email.toLowerCase() === email)) return fail(db, "errors.emailTaken");
      const next = withEvent({ ...db, users: [...db.users, action.user] }, action, "user.invited", "user", { user: action.user.name }, action.user.id);
      return { db: next, result: { ok: true, message: { key: "toast.invited", params: { email: action.user.email } } }, undoable: true };
    }

    case "user.revoke": {
      const user = db.users.find((entry) => entry.id === action.id);
      if (!user || user.status !== "Invited") return fail(db, "errors.notFound");
      return { db: { ...db, users: db.users.filter((entry) => entry.id !== user.id) }, result: { ok: true, message: { key: "toast.inviteRevoked", params: { email: user.email } } }, undoable: true };
    }

    case "product.update": {
      const product = db.products.find((entry) => entry.id === action.id);
      if (!product) return fail(db, "errors.notFound");
      const updated = { ...product, ...action.patch };
      const next = withEvent({ ...db, products: db.products.map((entry) => (entry.id === product.id ? updated : entry)) }, action, "product.updated", "product", { product: updated.name }, product.id);
      return { db: next, result: { ok: true, message: { key: "toast.productSaved", params: { product: updated.name } } }, undoable: true };
    }

    case "task.create": {
      if (db.tasks.some((task) => task.id === action.task.id)) return fail(db, "errors.generic");
      const next = withEvent({ ...db, tasks: [action.task, ...db.tasks] }, action, "task.created", "task", { task: action.task.id }, action.task.id);
      return { db: next, result: { ok: true, message: { key: "toast.taskCreated", params: { title: plain(action.task.title) } } }, undoable: true };
    }

    case "task.update": {
      const task = db.tasks.find((entry) => entry.id === action.id);
      if (!task) return fail(db, "errors.notFound");
      const updated = { ...task, ...action.patch };
      const done = task.status !== "Done" && updated.status === "Done";
      const next = withEvent({ ...db, tasks: db.tasks.map((entry) => (entry.id === task.id ? updated : entry)) }, action, done ? "task.done" : "task.updated", "task", { task: task.id }, task.id);
      return { db: next, result: { ok: true, message: action.patch.status && action.patch.status !== task.status ? { key: "toast.taskMoved", params: { status: `@tasks.status.${action.patch.status === "In progress" ? "progress" : action.patch.status.toLowerCase()}` } } : { key: "toast.taskUpdated" } }, undoable: true };
    }

    case "message.send": {
      const conversation = db.conversations.find((entry) => entry.id === action.conversationId);
      if (!conversation) return fail(db, "errors.notFound");
      const customer = db.users.find((user) => user.id === conversation.userId)?.name ?? "";
      const message = { id: action.messageId, text: action.text.trim(), date: action.at, from: "Team" as const, authorId: action.actor };
      const conversations = db.conversations.map((entry) => (entry.id === conversation.id ? { ...entry, unread: false, archived: false, messages: [...entry.messages, message] } : entry));
      const next = withEvent({ ...db, conversations }, action, "message.sent", "message", { customer }, conversation.id);
      return { db: next, result: { ok: true, message: { key: "toast.messageSent", params: { customer } } }, undoable: true };
    }

    case "conversation.read": {
      const conversation = db.conversations.find((entry) => entry.id === action.id);
      if (!conversation) return fail(db, "errors.notFound");
      if (!conversation.unread) return { db, result: { ok: true } };
      return { db: { ...db, conversations: db.conversations.map((entry) => (entry.id === action.id ? { ...entry, unread: false } : entry)) }, result: { ok: true } };
    }

    case "conversation.archive": {
      const conversation = db.conversations.find((entry) => entry.id === action.id);
      if (!conversation) return fail(db, "errors.notFound");
      const customer = db.users.find((user) => user.id === conversation.userId)?.name ?? "";
      const conversations = db.conversations.map((entry) => (entry.id === action.id ? { ...entry, archived: action.value, unread: action.value ? false : entry.unread } : entry));
      const next = action.value ? withEvent({ ...db, conversations }, action, "conversation.archived", "message", { customer }, conversation.id) : { ...db, conversations };
      return { db: next, result: { ok: true, message: { key: action.value ? "toast.archived" : "toast.restored" } }, undoable: true };
    }

    case "settings.save": {
      const settings = { ...action.settings, notifications: { ...action.settings.notifications } };
      const users = db.users.map((user) => (user.id === "USR-001" ? { ...user, name: settings.profileName, email: settings.profileEmail } : user));
      const next = withEvent({ ...db, settings, users }, action, "settings.saved", "settings", {});
      return { db: next, result: { ok: true, message: { key: "toast.settingsSaved" } }, undoable: true };
    }

    case "notifications.read": {
      const read = new Set(db.readNotifications);
      action.ids.forEach((id) => read.add(id));
      return { db: { ...db, readNotifications: [...read] }, result: { ok: true } };
    }
  }
}

function plain(text: Text) {
  return typeof text === "string" ? text : text.key;
}

