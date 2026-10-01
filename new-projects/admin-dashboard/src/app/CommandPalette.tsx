import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ArrowRight, CornerDownLeft, CreditCard, Gauge, Keyboard, Languages, Orbit, PackageCheck, Rows3, Search, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../data/store";
import type { Database } from "../data/types";
import { useI18n, type Key } from "../i18n";
import { useReduced } from "../motion/MotionPreference";
import { duration, ease, spring } from "../motion/tokens";
import { Avatar } from "../ui/Avatar";
import { Kbd } from "../ui/Badge";
import { ProductThumb } from "../ui/Blocks";
import { cx } from "../ui/Button";
import { formatRoute, navigate } from "./router";
import { sections } from "./sections";
import { normalize } from "../lib/text";

type Item = { id: string; group: string; label: string; hint?: string; icon?: ReactNode; run: () => void };

const recentKey = "orbit-recent";
type Recent = { kind: "order" | "customer" | "product"; id: string };

export function rememberRecent(entry: Recent) {
  try {
    const list: Recent[] = JSON.parse(localStorage.getItem(recentKey) ?? "[]");
    const next = [entry, ...list.filter((item) => !(item.kind === entry.kind && item.id === entry.id))].slice(0, 5);
    localStorage.setItem(recentKey, JSON.stringify(next));
  } catch {
    /* Recent items are a convenience; the menu works without them. */
  }
}

function readRecent(): Recent[] {
  try {
    return JSON.parse(localStorage.getItem(recentKey) ?? "[]");
  } catch {
    return [];
  }
}


function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const index = normalize(text).indexOf(normalize(query));
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}

export function CommandPalette({ open, onClose, onShortcuts }: { open: boolean; onClose: () => void; onShortcuts: () => void }) {
  return createPortal(<AnimatePresence>{open && <PaletteSurface onClose={onClose} onShortcuts={onShortcuts} />}</AnimatePresence>, document.body);
}

function PaletteSurface({ onClose, onShortcuts }: { onClose: () => void; onShortcuts: () => void }) {
  const { t, locale, setLocale, money, relative } = useI18n();
  const { db, dispatch } = useStore();
  const reduced = useReduced();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    opener.current = document.activeElement as HTMLElement | null;
    document.getElementById("root")?.setAttribute("inert", "");
    requestAnimationFrame(() => input.current?.focus());
    return () => {
      document.getElementById("root")?.removeAttribute("inert");
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    };
  }, []);

  const go = (hash: string, recent?: Recent) => {
    if (recent) rememberRecent(recent);
    onClose();
    navigate(hash);
  };

  const items = useMemo<Item[]>(() => build(db, query), [db, query, locale]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setActive(0), [query]);

  function build(data: Database | null, raw: string): Item[] {
    const q = normalize(raw.trim());
    const result: Item[] = [];
    const settings = data?.settings;
    const toggle = (patch: Partial<NonNullable<typeof settings>>) => settings && dispatch({ type: "settings.save", settings: { ...settings, ...patch } });
    const actions: Item[] = [
      { id: "a-pack", group: "actions", label: t("palette.actions.toPack"), icon: <PackageCheck />, run: () => go(formatRoute("orders", undefined, { view: "toPack" })) },
      { id: "a-failed", group: "actions", label: t("palette.actions.failed"), icon: <CreditCard />, run: () => go(formatRoute("orders", undefined, { view: "awaiting" })) },
      { id: "a-lang", group: "actions", label: t("palette.actions.language"), icon: <Languages />, run: () => { setLocale(locale === "ru" ? "en" : "ru"); onClose(); } },
      { id: "a-density", group: "actions", label: t("palette.actions.density"), icon: <Rows3 />, hint: settings?.compact ? "✓" : undefined, run: () => { toggle({ compact: !settings?.compact }); onClose(); } },
      { id: "a-motion", group: "actions", label: settings?.motion === "reduced" ? t("palette.actions.motionOn") : t("palette.actions.motion"), icon: <Gauge />, run: () => { toggle({ motion: settings?.motion === "reduced" ? "system" : "reduced", reducedMotion: settings?.motion !== "reduced" }); onClose(); } },
      { id: "a-keys", group: "actions", label: t("palette.actions.shortcuts"), icon: <Keyboard />, hint: "?", run: () => { onClose(); onShortcuts(); } },
      { id: "a-landing", group: "actions", label: t("palette.actions.landing"), icon: <Orbit />, run: () => go("#/") },
    ];
    const nav: Item[] = sections.map((section) => {
      const Icon: LucideIcon = section.icon;
      return { id: `s-${section.id}`, group: "goTo", label: t(`nav.${section.id}` as Key), icon: <Icon />, hint: `G ${section.key.toUpperCase()}`, run: () => go(formatRoute(section.id)) };
    });
    if (!q) {
      if (data) {
        for (const recent of readRecent()) {
          if (recent.kind === "order") {
            const order = data.orders.find((o) => o.id === recent.id);
            if (order) result.push({ id: `r-${order.id}`, group: "recent", label: order.id, hint: money(order.total), icon: <ArrowRight />, run: () => go(formatRoute("orders", order.id), recent) });
          }
        }
      }
      return [...result, ...nav, ...actions];
    }
    if (data) {
      const digits = q.replace(/^nl-?/, "");
      if (/^\d{2,}$/.test(digits)) {
        for (const order of data.orders) {
          if (order.id.slice(3).includes(digits)) {
            const customer = data.users.find((u) => u.id === order.userId);
            result.push({ id: `o-${order.id}`, group: "orders", label: order.id, hint: `${customer?.name ?? ""} · ${money(order.total)} · ${relative(order.date)}`, icon: <PackageCheck />, run: () => go(formatRoute("orders", order.id), { kind: "order", id: order.id }) });
            if (result.length >= 5) break;
          }
        }
      }
      if (q.length >= 2) {
        let customers = 0;
        for (const user of data.users) {
          if (user.role !== "Customer") continue;
          if (normalize(user.name).includes(q) || user.email.includes(q) || normalize(user.region).includes(q)) {
            result.push({ id: `c-${user.id}`, group: "customers", label: user.name, hint: `${user.region} · ${user.email}`, icon: <Avatar name={user.name} tone={user.avatar} size={22} />, run: () => go(formatRoute("customers", user.id), { kind: "customer", id: user.id }) });
            if (++customers >= 5) break;
          }
        }
        for (const product of data.products) {
          if (normalize(product.name).includes(q) || normalize(product.sku).includes(q)) result.push({ id: `p-${product.id}`, group: "products", label: product.name, hint: `${product.sku} · ${money(product.price)}`, icon: <ProductThumb product={product} size={22} />, run: () => go(formatRoute("products", product.id), { kind: "product", id: product.id }) });
        }
      }
    }
    return [...result, ...nav.filter((item) => normalize(item.label).includes(q)), ...actions.filter((item) => normalize(item.label).includes(q))];
  }

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (items.length ? (index + delta + items.length) % items.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      items[active]?.run();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "Tab") event.preventDefault();
  };

  let index = -1;
  const groups = ["recent", "orders", "customers", "products", "goTo", "actions"].map((group) => ({ group, entries: items.filter((item) => item.group === group) })).filter((g) => g.entries.length);

  return (
    <div className="ui-overlay" data-kind="palette">
      <motion.div className="ui-overlay__backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: duration.fast } }} />
      <motion.div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label={t("palette.title")}
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: -4, transition: { duration: duration.fast, ease: ease.in } }}
        transition={spring.pop}
        onKeyDown={onKeyDown}
      >
        <div className="palette__search">
          <Search />
          <input
            ref={input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("palette.placeholder")}
            aria-label={t("palette.placeholder")}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[active] ? `palette-${items[active].id}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          <Kbd>Esc</Kbd>
        </div>
        <div className="palette__list" id="palette-list" role="listbox" ref={list}>
          <LayoutGroup id="palette">
            {groups.map(({ group, entries }) => (
              <div key={group} className="palette__group" role="group" aria-label={t(`palette.groups.${group}` as Key)}>
                <p className="palette__group-label">{t(`palette.groups.${group}` as Key)}</p>
                {entries.map((item) => {
                  index++;
                  const current = index;
                  const selected = current === active;
                  return (
                    <div
                      key={item.id}
                      id={`palette-${item.id}`}
                      role="option"
                      aria-selected={selected}
                      data-index={current}
                      className={cx("palette__item", selected && "is-active")}
                      onPointerMove={() => active !== current && setActive(current)}
                      onClick={() => item.run()}
                    >
                      {selected && <motion.span className="palette__highlight" layoutId="palette-highlight" transition={spring.indicator} />}
                      <span className="palette__icon">{item.icon}</span>
                      <span className="palette__label">
                        <Highlight text={item.label} query={query.trim()} />
                      </span>
                      {item.hint && <span className="palette__hint">{item.hint}</span>}
                      {selected && <CornerDownLeft className="palette__enter" />}
                    </div>
                  );
                })}
              </div>
            ))}
          </LayoutGroup>
          {!items.length && (
            <div className="palette__empty">
              <strong>{t("palette.empty", { query: query.trim() })}</strong>
              <p>{t("palette.emptyHint")}</p>
            </div>
          )}
        </div>
        <footer className="palette__foot">
          <span>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> {t("palette.hint")}
          </span>
          <span>
            <Kbd>Enter</Kbd> {t("palette.open")}
          </span>
          <span>
            <Kbd>Esc</Kbd> {t("palette.closeHint")}
          </span>
        </footer>
      </motion.div>
    </div>
  );
}
