import { motion } from "motion/react";
import { Ban, CheckCircle2, Copy, FileSearch, Mail, MessageSquare, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import { useAccess } from "../../app/access";
import { formatRoute, navigate } from "../../app/router";
import { TODAY } from "../../data/clock";
import { useToasts, useWorkspace } from "../../data/store";
import type { User } from "../../data/types";
import { useI18n, type Key } from "../../i18n";
import { Counter } from "../../motion/Counter";
import { useReduced } from "../../motion/MotionPreference";
import { duration, ease, spring, staggerDelay } from "../../motion/tokens";
import { Avatar } from "../../ui/Avatar";
import { Badge, type Tone } from "../../ui/Badge";
import { EmptyState } from "../../ui/Blocks";
import { Button } from "../../ui/Button";
import { Dialog, Drawer } from "../../ui/Overlay";
import { OrderStatus } from "../orders/status";
import { segmentOf, type Segment } from "./query";

const segmentTone: Record<Segment, Tone> = { vip: "violet", returning: "accent", new: "positive", dormant: "warning", prospect: "neutral", one: "neutral" };

export function SegmentBadge({ segment, suspended }: { segment: Segment; suspended?: boolean }) {
  const { t } = useI18n();
  if (suspended) return <Badge tone="danger">{t("customers.suspended")}</Badge>;
  return <Badge tone={segmentTone[segment]}>{t(`customers.segments.${segment}` as Key)}</Badge>;
}

export function CustomerDrawer({ userId, onClose }: { userId?: string; onClose: () => void }) {
  const { t } = useI18n();
  const { indexes } = useWorkspace();
  const user = userId ? indexes.users.get(userId) : undefined;
  const valid = user && user.role === "Customer";
  return (
    <Drawer
      open={!!userId}
      onClose={onClose}
      label={valid ? user.name : t("shell.notFound", { id: userId ?? "" })}
      header={
        valid ? (
          <div className="cd-head">
            <Avatar name={user.name} tone={user.avatar} size={44} />
            <div>
              <h2 className="cd-head__name">{user.name}</h2>
              <p className="cd-head__meta">{user.email}</p>
            </div>
          </div>
        ) : (
          <h2 className="od-head__title">{userId}</h2>
        )
      }
    >
      {valid ? <CustomerDetail user={user} /> : <EmptyState icon={<FileSearch />} title={t("shell.notFound", { id: userId ?? "" })} text={t("shell.notFoundHint")} />}
    </Drawer>
  );
}

function CustomerDetail({ user }: { user: User }) {
  const { t, tx, money, number, fullDate, relative, inline, locale } = useI18n();
  const { db, indexes, dispatch } = useWorkspace();
  const { notify } = useToasts();
  const access = useAccess();
  const reduced = useReduced();
  const [confirm, setConfirm] = useState(false);
  const stats = indexes.customer(user.id);
  const orders = indexes.ordersByUser.get(user.id) ?? [];
  const conversations = db.conversations.filter((c) => c.userId === user.id);
  const segment = segmentOf(stats);
  const region = new Intl.DisplayNames([locale], { type: "region" }).of(user.country);
  const suspended = user.status === "Suspended";

  // Spend per month over the last year, from the same orders as the totals.
  const months = useMemo(() => {
    const buckets = Array.from({ length: 12 }, (_, i) => {
      const start = new Date(Date.UTC(Number(TODAY.slice(0, 4)), Number(TODAY.slice(5, 7)) - 12 + i, 1));
      return { key: start.toISOString().slice(0, 7), label: start.toISOString(), value: 0 };
    });
    for (const order of orders) {
      if (order.status === "Cancelled") continue;
      const bucket = buckets.find((b) => b.key === order.date.slice(0, 7));
      if (bucket) bucket.value += indexes.paid(order);
    }
    return buckets;
  }, [orders, indexes]);
  const peak = Math.max(1, ...months.map((m) => m.value));

  const container = { hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : 0.045, delayChildren: reduced ? 0 : 0.08 } } };
  const block = { hidden: reduced ? { opacity: 0 } : { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: duration.slow, ease: ease.out } } };
  const tiles = [
    { key: "orders", value: stats.orders, format: (v: number) => number(Math.round(v)) },
    { key: "spent", value: stats.spent, format: (v: number) => money(Math.round(v)) },
    { key: "aov", value: stats.orders ? stats.spent / stats.orders : 0, format: (v: number) => money(Math.round(v)) },
  ];

  return (
    <motion.div className="cd" variants={container} initial="hidden" animate="show">
      <motion.div className="cd-tags" variants={block}>
        <SegmentBadge segment={segment} suspended={suspended} />
        <span className="cd-tags__text">
          {region} · {t("customers.detail.since", { date: fullDate(user.joined) })}
        </span>
      </motion.div>

      <motion.section className="cd-stats" variants={block}>
        {tiles.map((tile, i) => (
          <div key={tile.key} className="cd-stat">
            <span>{t(`customers.detail.stats.${tile.key}` as Key)}</span>
            <strong className="num">
              <Counter value={tile.value} format={tile.format} delay={0.1 + i * 0.06} />
            </strong>
          </div>
        ))}
        <div className="cd-stat">
          <span>{t("customers.detail.stats.last")}</span>
          <strong>{stats.last ? relative(stats.last) : t("customers.never")}</strong>
        </div>
      </motion.section>

      <motion.section className="od-block" variants={block}>
        <h3 className="od-label">{t("customers.detail.spendByMonth")}</h3>
        {months.every((m) => !m.value) && <p className="od-muted cd-quiet">{t("customers.detail.quietYear")}</p>}
        <div className="minibars" role="img" aria-label={t("customers.detail.spendByMonth")}>
          {months.map((month, i) => (
            <div key={month.key} className="minibars__col" title={`${new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(month.label))}: ${money(Math.round(month.value))}`}>
              <motion.span className={month.value ? "minibars__bar" : "minibars__bar is-empty"} initial={reduced ? false : { scaleY: 0 }} animate={{ scaleY: month.value ? Math.max(0.06, month.value / peak) : 0.04 }} transition={{ ...spring.layout, delay: reduced ? 0 : 0.2 + staggerDelay(i, 0.025) }} />
              <small>{new Intl.DateTimeFormat(locale, { month: "narrow", timeZone: "UTC" }).format(new Date(month.label))}</small>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section className="od-block" variants={block}>
        <h3 className="od-label">
          {t("customers.detail.orders")} <span className="od-label__count num">{number(orders.length)}</span>
        </h3>
        {orders.length ? (
          <ul className="cd-orders">
            {orders.slice(0, 8).map((order) => (
              <li key={order.id}>
                <a
                  href={formatRoute("orders", order.id)}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(formatRoute("orders", order.id));
                  }}
                >
                  <ShoppingBag />
                  <span className="cd-orders__id num">{order.id}</span>
                  <span className="cd-orders__date">{inline(order.date)}</span>
                  <OrderStatus order={order} />
                  <span className="num cd-orders__total">{money(order.total)}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="od-muted">{t("customers.detail.noOrders")}</p>
        )}
        {orders.length > 8 && (
          <Button variant="ghost" size="sm" onClick={() => navigate(formatRoute("orders", undefined, { q: user.email, placed: "any" }))}>
            {t("customers.detail.allOrders", { count: orders.length })}
          </Button>
        )}
      </motion.section>

      <motion.section className="od-block" variants={block}>
        <h3 className="od-label">{t("customers.detail.conversations")}</h3>
        {conversations.length ? (
          <ul className="od-related">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <a
                  href={formatRoute("messages", conversation.id)}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(formatRoute("messages", conversation.id));
                  }}
                >
                  <MessageSquare />
                  <span>{tx(conversation.subject)}</span>
                  {conversation.unread && <i className="od-related__dot" />}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="od-muted">{t("customers.detail.noConversations")}</p>
        )}
      </motion.section>

      <motion.section className="od-block" variants={block}>
        <h3 className="od-label">{t("customers.detail.contact")}</h3>
        <dl className="cd-facts">
          <div>
            <dt>{t("customers.detail.email")}</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>{t("customers.detail.city")}</dt>
            <dd>
              {user.region.split(",")[0]}, {region}
            </dd>
          </div>
          <div>
            <dt>{t("customers.detail.marketing")}</dt>
            <dd>{user.marketing ? t("customers.detail.subscribed") : t("customers.detail.notSubscribed")}</dd>
          </div>
          <div>
            <dt>{t("customers.detail.firstOrder")}</dt>
            <dd>{stats.first ? fullDate(stats.first) : t("customers.never")}</dd>
          </div>
        </dl>
      </motion.section>

      <motion.footer className="od-actions" variants={block}>
        <Button
          variant="ghost"
          size="sm"
          icon={<Copy />}
          onClick={() =>
            navigator.clipboard?.writeText(user.email).then(
              () => notify({ key: "customers.detail.emailCopied" }, "info"),
              () => notify({ key: "errors.generic" }, "error"),
            )
          }
        >
          {t("customers.detail.copyEmail")}
        </Button>
        <Button variant="ghost" size="sm" icon={<Mail />} disabled={!conversations.length} onClick={() => conversations[0] && navigate(formatRoute("messages", conversations[0].id))}>
          {t("customers.detail.openConversation")}
        </Button>
        <Button variant={suspended ? "secondary" : "danger"} size="sm" icon={suspended ? <CheckCircle2 /> : <Ban />} disabled={!access.can("customers.manage")} title={access.can("customers.manage") ? undefined : access.deniedHint} onClick={() => setConfirm(true)}>
          {suspended ? t("customers.detail.unblock") : t("customers.detail.block")}
        </Button>
      </motion.footer>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        tone={suspended ? "default" : "danger"}
        icon={suspended ? <CheckCircle2 /> : <Ban />}
        title={suspended ? t("customers.unblock.title", { name: user.name }) : t("customers.block.title", { name: user.name })}
        actions={
          <>
            <Button onClick={() => setConfirm(false)} data-autofocus>
              {t("common.cancel")}
            </Button>
            <Button
              variant={suspended ? "primary" : "danger"}
              onClick={() => {
                const result = dispatch({ type: "user.update", id: user.id, patch: { status: suspended ? "Active" : "Suspended" } });
                if (result.ok) setConfirm(false);
              }}
            >
              {suspended ? t("customers.detail.unblock") : t("customers.detail.block")}
            </Button>
          </>
        }
      >
        <p>{suspended ? t("customers.unblock.text") : t("customers.block.text", { open: orders.filter((o) => o.status === "Processing" || o.status === "Ready").length })}</p>
      </Dialog>
    </motion.div>
  );
}
