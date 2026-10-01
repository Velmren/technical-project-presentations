import { AlertTriangle, Box, CheckCircle2, CreditCard, MessageSquare, Package, PackageCheck, Settings2, ShoppingBag, Truck, UserPlus, type LucideIcon } from "lucide-react";
import type { Indexes } from "../data/indexes";
import type { Database, Event } from "../data/types";
import type { Key, Translator } from "../i18n";
import { formatRoute, type SectionId } from "./router";

export function eventText(event: Event, db: Database, t: Translator["t"], tx: Translator["tx"]) {
  const params = { ...event.params };
  if (typeof params.status === "string" && event.kind === "order.status") params.status = t(`status.order.${params.status}` as Key);
  if (event.area === "task" && typeof event.params.task === "string") {
    const task = db.tasks.find((item) => item.id === event.params.task);
    params.title = task ? tx(task.title) : String(event.params.task);
  }
  const key = event.kind === "order.batch" ? `events.order.batch.${event.params.status ?? "Shipped"}` : `events.${event.kind}`;
  return t(key as Key, params);
}

export function eventIcon(event: Event): { icon: LucideIcon; tone: "accent" | "positive" | "warning" | "danger" | "violet" | "neutral" } {
  switch (event.kind) {
    case "order.large":
    case "order.placed":
      return { icon: ShoppingBag, tone: "accent" };
    case "order.batch":
      return event.params.status === "Ready" ? { icon: PackageCheck, tone: "accent" } : { icon: Truck, tone: "accent" };
    case "order.status":
      return { icon: event.params.status === "Shipped" ? Truck : PackageCheck, tone: "accent" };
    case "order.cancelled":
      return { icon: ShoppingBag, tone: "neutral" };
    case "payment.failed":
      return { icon: CreditCard, tone: "danger" };
    case "payment.captured":
      return { icon: CreditCard, tone: "positive" };
    case "payment.refunded":
      return { icon: CreditCard, tone: "warning" };
    case "stock.low":
    case "stock.out":
      return { icon: AlertTriangle, tone: "warning" };
    case "product.updated":
      return { icon: Box, tone: "neutral" };
    case "task.done":
      return { icon: CheckCircle2, tone: "positive" };
    case "task.created":
    case "task.updated":
    case "task.assigned":
      return { icon: Package, tone: "violet" };
    case "message.received":
    case "message.sent":
    case "conversation.archived":
      return { icon: MessageSquare, tone: "violet" };
    case "user.updated":
    case "user.invited":
      return { icon: UserPlus, tone: "neutral" };
    default:
      return { icon: Settings2, tone: "neutral" };
  }
}

/** Where an event leads: the record it is about, or its section. */
export function eventLink(event: Event, indexes: Indexes): string {
  const target = event.targetId;
  const section: Record<Event["area"], SectionId> = { order: "orders", payment: "orders", product: "products", task: "tasks", message: "messages", user: "customers", settings: "settings" };
  if (!target) return formatRoute(section[event.area]);
  if (event.area === "payment" && indexes.orders.has(target)) return formatRoute("orders", target);
  return formatRoute(section[event.area], target);
}
