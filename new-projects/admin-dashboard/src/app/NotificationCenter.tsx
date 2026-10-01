import { AnimatePresence, motion } from "motion/react";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { queues } from "../data/attention";
import { useStore } from "../data/store";
import { useI18n } from "../i18n";
import { useReduced } from "../motion/MotionPreference";
import { duration, ease, foldAway, spring, staggerDelay } from "../motion/tokens";
import { Button, cx } from "../ui/Button";
import { Popover } from "../ui/Popover";
import { Segmented } from "../ui/Segmented";
import { eventIcon, eventLink, eventText } from "./events";
import { formatRoute, navigate } from "./router";

export function NotificationCenter() {
  const { t, tx, relative } = useI18n();
  const { db, indexes, dispatch } = useStore();
  const reduced = useReduced();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const button = useRef<HTMLButtonElement>(null);
  const read = useMemo(() => new Set(db?.readNotifications ?? []), [db?.readNotifications]);
  const prefs = db?.settings.notifications;
  const items = useMemo(
    () =>
      (db?.events ?? []).filter((event) => {
        if (!event.notify) return false;
        if (prefs && !prefs.orders && (event.area === "order" || event.area === "payment" || event.area === "product")) return false;
        if (prefs && !prefs.tasks && event.area === "task") return false;
        if (prefs && !prefs.messages && event.area === "message") return false;
        return true;
      }),
    [db?.events, prefs],
  );
  const unread = items.filter((event) => !read.has(event.id));
  const shown = (filter === "unread" ? unread : items).slice(0, 30);
  const count = db && indexes ? Math.min(queues(db, indexes).unreadNotifications, unread.length) : 0;

  return (
    <div className="notif">
      <Button
        ref={button}
        variant="ghost"
        iconOnly
        className="notif__button"
        aria-label={count ? `${t("shell.notifications")}: ${t("notifications.count", { count })}` : t("shell.notifications")}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        icon={<Bell />}
      >
        <AnimatePresence>
          {count > 0 && (
            <motion.span key="dot" className="notif__badge num" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring.pop}>
              {count}
            </motion.span>
          )}
        </AnimatePresence>
      </Button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={button} label={t("notifications.title")} className="notif__panel">
        <header className="notif__head">
          <h2>{t("notifications.title")}</h2>
          <Button variant="ghost" size="sm" icon={<CheckCheck />} disabled={!unread.length} onClick={() => dispatch({ type: "notifications.read", ids: unread.map((e) => e.id) }, { silent: true })}>
            {t("notifications.markAll")}
          </Button>
        </header>
        <Segmented
          size="sm"
          label={t("notifications.title")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: t("notifications.all") },
            { value: "unread", label: t("notifications.unread"), count: unread.length },
          ]}
        />
        <motion.div key={filter} className="notif__list" role="list" initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: duration.fast, ease: ease.out }}>
          <AnimatePresence initial={false}>
            {shown.map((event, index) => {
              const { icon: Icon, tone } = eventIcon(event);
              const isUnread = !read.has(event.id);
              return (
                <motion.button
                  key={event.id}
                  role="listitem"
                  type="button"
                  className={cx("notif__item", isUnread && "is-unread")}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: open ? staggerDelay(index, 0.025) : 0 } }}
                  exit={reduced ? { opacity: 0, transition: { duration: duration.fast } } : foldAway}
                  onClick={() => {
                    if (isUnread) dispatch({ type: "notifications.read", ids: [event.id] }, { silent: true });
                    setOpen(false);
                    if (db && indexes) navigate(eventLink(event, indexes));
                  }}
                >
                  <span className={`event-icon event-icon--${tone}`}>
                    <Icon />
                  </span>
                  <span className="notif__text">
                    <span>{db ? eventText(event, db, t, tx) : ""}</span>
                    <time dateTime={event.at}>{relative(event.at)}</time>
                  </span>
                  {isUnread && <i className="notif__dot" aria-label={t("notifications.unread")} />}
                </motion.button>
              );
            })}
          </AnimatePresence>
          {!shown.length && (
            <div className="notif__empty">
              <BellOff />
              <strong>{t("notifications.emptyTitle")}</strong>
              <p>{t("notifications.emptyText")}</p>
            </div>
          )}
        </motion.div>
        <footer className="notif__foot">
          <a
            href={formatRoute("settings", undefined, { tab: "notifications" })}
            onClick={(event) => {
              event.preventDefault();
              setOpen(false);
              navigate(formatRoute("settings", undefined, { tab: "notifications" }));
            }}
          >
            {t("notifications.settings")}
          </a>
        </footer>
      </Popover>
    </div>
  );
}
