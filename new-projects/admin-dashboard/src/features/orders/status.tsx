import type { PaymentState } from "../../data/actions";
import type { Order } from "../../data/types";
import { useI18n, type Key } from "../../i18n";
import { Badge, type Tone } from "../../ui/Badge";

const orderTone: Record<Order["status"], Tone> = { Processing: "warning", Ready: "accent", Shipped: "violet", Delivered: "positive", Cancelled: "neutral" };
const paymentTone: Record<PaymentState, Tone> = { Paid: "positive", Pending: "warning", Failed: "danger", Refunded: "neutral", Partial: "warning", Unpaid: "neutral" };

export function orderStatusKey(order: Order): Key {
  if (order.shippingMethod === "Pickup" && order.status === "Ready") return "status.order.ReadyPickup";
  if (order.shippingMethod === "Pickup" && order.status === "Delivered") return "status.order.DeliveredPickup";
  return `status.order.${order.status}` as Key;
}

export function OrderStatus({ order }: { order: Order }) {
  const { t } = useI18n();
  return <Badge tone={orderTone[order.status]}>{t(orderStatusKey(order))}</Badge>;
}

export function PaymentStatus({ state }: { state: PaymentState }) {
  const { t } = useI18n();
  return (
    <Badge tone={paymentTone[state]} dot={false} className="badge-payment">
      {t(`status.payment.${state}` as Key)}
    </Badge>
  );
}
