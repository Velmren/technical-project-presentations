import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Archive, ArchiveRestore, ArrowLeft, ArrowUpRight, ClipboardPlus, Inbox, MessagesSquare, SendHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAccess } from "../../app/access";
import { formatRoute, navigate, setQuery, type Route } from "../../app/router";
import { nextId, useWorkspace } from "../../data/store";
import type { Conversation } from "../../data/types";
import { useI18n, type Key } from "../../i18n";
import { normalize } from "../../lib/text";
import { useReduced } from "../../motion/MotionPreference";
import { duration, ease, fadeUp, foldAway, spring, stagger, staggerDelay } from "../../motion/tokens";
import { Avatar } from "../../ui/Avatar";
import { EmptyState, ProductThumb } from "../../ui/Blocks";
import { Button, cx } from "../../ui/Button";
import { SearchField } from "../../ui/Form";
import { useNarrow } from "../../ui/Overlay";
import { Segmented } from "../../ui/Segmented";
import { OrderStatus } from "../orders/status";
import { NewTaskDialog } from "../tasks/NewTaskDialog";
import "./messages.css";

const views = ["open", "unread", "archived"] as const;
type View = (typeof views)[number];
const inView = (c: Conversation, view: View) => (view === "archived" ? c.archived : view === "unread" ? c.unread && !c.archived : !c.archived);

export function MessagesScreen({ route }: { route: Route }) {
  const { t, tx, relative } = useI18n();
  const { db, indexes } = useWorkspace();
  const reduced = useReduced();
  const narrow = useNarrow("(max-width: 900px)");
  const view = (views as readonly string[]).includes(route.query.get("view") ?? "") ? (route.query.get("view") as View) : "open";
  const [search, setSearch] = useState("");
  const list = useMemo(() => {
    const q = normalize(search.trim());
    const found = db.conversations.filter((c) => {
      if (!inView(c, view)) return false;
      if (!q) return true;
      const customer = indexes.users.get(c.userId);
      return normalize(tx(c.subject)).includes(q) || (customer && normalize(customer.name).includes(q)) || (c.orderId ?? "").toLowerCase().includes(q);
    });
    // Latest activity first; reading a thread never reshuffles the list under the cursor.
    return found.sort((a, b) => (a.messages.at(-1)!.date < b.messages.at(-1)!.date ? 1 : -1));
  }, [db.conversations, view, search, indexes, tx]);
  const counts = Object.fromEntries(views.map((v) => [v, db.conversations.filter((c) => inView(c, v)).length])) as Record<View, number>;
  const selected = route.id ? db.conversations.find((c) => c.id === route.id) : undefined;
  const open = (id: string) => navigate(formatRoute("messages", id, route.query));
  const showList = !narrow || !route.id;
  const showThread = !narrow || !!route.id;

  return (
    <motion.div className="page messages-page" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : stagger.cards } } }}>
      {showList && (
        <motion.header className="page-head" variants={fadeUp}>
          <div className="page-head__main">
            <h1 className="page-head__title">{t("messages.title")}</h1>
            <p className="page-head__subtitle">{t("messages.subtitle", { unread: counts.unread, open: counts.open })}</p>
          </div>
        </motion.header>
      )}
      <motion.div className={cx("inbox", route.id && "has-thread")} variants={fadeUp}>
        {showList && (
          <section className="inbox__list" aria-label={t("messages.title")}>
            <div className="inbox__tools">
              <Segmented size="sm" label={t("messages.title")} value={view} onChange={(v) => setQuery(route, { view: v === "open" ? undefined : v })} options={views.map((v) => ({ value: v, label: t(`messages.views.${v}` as Key), count: counts[v] }))} />
              <SearchField value={search} onChange={setSearch} placeholder={t("messages.search")} />
            </div>
            <LayoutGroup id="inbox">
              <motion.ul key={`${view}|${search}`} className="inbox__items" initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: duration.fast, ease: ease.out }}>
                <AnimatePresence initial={false}>
                  {list.map((conversation, index) => {
                    const customer = indexes.users.get(conversation.userId);
                    const last = conversation.messages.at(-1)!;
                    const active = conversation.id === route.id;
                    return (
                      <motion.li
                        key={conversation.id}
                        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out, delay: staggerDelay(index, 0.02) } }}
                        exit={reduced ? { opacity: 0, transition: { duration: duration.fast } } : foldAway}
                      >
                        <a
                          href={formatRoute("messages", conversation.id, route.query)}
                          className={cx("thread-item", active && "is-active", conversation.unread && "is-unread")}
                          aria-current={active ? "true" : undefined}
                          onClick={(event) => {
                            event.preventDefault();
                            open(conversation.id);
                          }}
                        >
                          {active && <motion.span className="thread-item__bg" layoutId="inbox-active" transition={spring.indicator} />}
                          {customer && <Avatar name={customer.name} tone={customer.avatar} size={36} />}
                          <span className="thread-item__body">
                            <span className="thread-item__top">
                              <strong>{customer?.name}</strong>
                              <time dateTime={last.date}>{relative(last.date)}</time>
                            </span>
                            <span className="thread-item__subject">{tx(conversation.subject)}</span>
                            <span className="thread-item__preview">
                              {last.from === "Team" && <span className="thread-item__you">{t("messages.you")} </span>}
                              {tx(last.text)}
                            </span>
                          </span>
                          {conversation.unread && <i className="thread-item__dot" aria-label={t("messages.unread")} />}
                        </a>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </motion.ul>
            </LayoutGroup>
            {!list.length && <EmptyState compact icon={<Inbox />} title={t(`messages.empty.${view}` as Key)} text={search ? t("messages.empty.search") : undefined} />}
          </section>
        )}
        {showThread && (
          <section className="inbox__thread">
            <AnimatePresence mode="wait" initial={false}>
              {selected ? (
                <Thread key={selected.id} conversation={selected} narrow={narrow} onBack={() => navigate(formatRoute("messages", undefined, route.query))} />
              ) : route.id ? (
                <motion.div key="missing" className="thread-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <EmptyState icon={<MessagesSquare />} title={t("shell.notFound", { id: route.id })} text={t("shell.notFoundHint")} />
                </motion.div>
              ) : (
                <motion.div key="none" className="thread-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <EmptyState icon={<MessagesSquare />} title={t("messages.pick.title")} text={counts.unread ? t("messages.pick.text", { count: counts.unread }) : t("messages.pick.none")} />
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}
      </motion.div>
    </motion.div>
  );
}

// Drafts survive switching between conversations and sections until the page closes.
const drafts = new Map<string, string>();

function Thread({ conversation, narrow, onBack }: { conversation: Conversation; narrow: boolean; onBack: () => void }) {
  const { t, tx, money, time, fullDate, dayKey, dayLabel } = useI18n();
  const { db, indexes, dispatch } = useWorkspace();
  const access = useAccess();
  const reduced = useReduced();
  const [text, setText] = useState(() => drafts.get(conversation.id) ?? "");
  const [taskOpen, setTaskOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const settled = useRef(false);
  const customer = indexes.users.get(conversation.userId);
  const order = conversation.orderId ? indexes.orders.get(conversation.orderId) : undefined;
  const first = customer?.name.split(" ")[0] ?? "";
  const canReply = access.can("messages.reply");

  useEffect(() => {
    if (conversation.unread) dispatch({ type: "conversation.read", id: conversation.id }, { silent: true });
  }, [conversation.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Opening a thread lands on the latest message; a new reply glides into view.
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: reduced || !settled.current ? "auto" : "smooth" });
    settled.current = true;
  }, [conversation.messages.length, reduced]);
  useEffect(() => {
    drafts.set(conversation.id, text);
  }, [text, conversation.id]);

  const send = () => {
    const body = text.trim();
    if (!body) return;
    const result = dispatch({ type: "message.send", conversationId: conversation.id, messageId: nextId(db, "MSG"), text: body });
    if (result.ok) {
      setText("");
      drafts.delete(conversation.id);
    }
  };
  const quick = (["tracking", "packing", "refund", "thanks"] as const).map((key) => ({ key, label: t(`messages.quick.${key}.label` as Key), text: t(`messages.quick.${key}.text` as Key, { first }) }));

  let lastDay = "";
  return (
    <motion.div className="thread" initial={reduced ? { opacity: 0 } : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ duration: duration.base, ease: ease.out }}>
      <header className="thread__head">
        {narrow && <Button variant="ghost" iconOnly icon={<ArrowLeft />} aria-label={t("common.back")} onClick={onBack} />}
        {customer && (
          <a
            className="thread__who"
            href={formatRoute("customers", customer.id)}
            onClick={(event) => {
              event.preventDefault();
              navigate(formatRoute("customers", customer.id));
            }}
          >
            <Avatar name={customer.name} tone={customer.avatar} size={38} />
            <span>
              <strong>{customer.name}</strong>
              <small>{tx(conversation.subject)}</small>
            </span>
          </a>
        )}
        <div className="thread__actions">
          <Button variant="ghost" size="sm" icon={<ClipboardPlus />} aria-label={t("messages.task")} onClick={() => setTaskOpen(true)} disabled={!access.can("tasks.manage")}>
            {t("messages.task")}
          </Button>
          <Button variant="ghost" size="sm" icon={conversation.archived ? <ArchiveRestore /> : <Archive />} disabled={!canReply} title={canReply ? undefined : access.deniedHint} aria-label={conversation.archived ? t("messages.restore") : t("messages.archive")} onClick={() => dispatch({ type: "conversation.archive", id: conversation.id, value: !conversation.archived })}>
            {conversation.archived ? t("messages.restore") : t("messages.archive")}
          </Button>
        </div>
      </header>

      {order && (
        <a
          className="thread__order"
          href={formatRoute("orders", order.id)}
          onClick={(event) => {
            event.preventDefault();
            navigate(formatRoute("orders", order.id));
          }}
        >
          <span className="thread__thumbs">
            {order.items.slice(0, 3).map((item) => (
              <ProductThumb key={item.productId} product={indexes.products.get(item.productId)} size={34} />
            ))}
          </span>
          <span className="thread__order-text">
            <strong className="num">{order.id}</strong>
            <small>
              {money(order.total)} · {fullDate(order.date)}
            </small>
          </span>
          <OrderStatus order={order} />
          <ArrowUpRight className="thread__go" />
        </a>
      )}

      <div className="thread__messages" ref={scroller}>
        <AnimatePresence initial={false}>
          {conversation.messages.map((message) => {
            const day = dayKey(message.date);
            const separator = day !== lastDay;
            lastDay = day;
            const author = message.authorId ? indexes.users.get(message.authorId) : undefined;
            return (
              <motion.div key={message.id} className="bubble-wrap" initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring.pop}>
                {separator && <p className="thread__day">{dayLabel(message.date)}</p>}
                <div className={cx("bubble", message.from === "Team" ? "is-team" : "is-customer")}>
                  <p>{tx(message.text)}</p>
                  <span className="bubble__meta">
                    {message.from === "Team" ? author?.name ?? t("messages.team") : customer?.name} · <time dateTime={message.date}>{time(message.date)}</time>
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <footer className="composer">
        <div className="composer__quick" role="group" aria-label={t("messages.quickLabel")}>
          {quick.map((item) => (
            <button key={item.key} type="button" className="chip-button" disabled={!canReply || conversation.archived} onClick={() => setText((current) => (current.trim() ? `${current.trim()}\n\n${item.text}` : item.text))}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="composer__box">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                send();
              }
            }}
            placeholder={conversation.archived ? t("messages.archivedHint") : t("messages.placeholder")}
            aria-label={t("messages.placeholder")}
            disabled={!canReply || conversation.archived}
            rows={3}
          />
          <div className="composer__row">
            <span className="composer__hint">{t("messages.sendHint")}</span>
            <Button variant="primary" size="sm" iconEnd={<SendHorizontal />} disabled={!text.trim() || !canReply || conversation.archived} onClick={send}>
              {t("messages.send")}
            </Button>
          </div>
        </div>
      </footer>
      <NewTaskDialog open={taskOpen} onClose={() => setTaskOpen(false)} preset={{ title: t("messages.taskTitle", { customer: customer?.name ?? "" }), orderId: conversation.orderId ?? "", assigneeId: "USR-004" }} />
    </motion.div>
  );
}
