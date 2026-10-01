import { animate, motion, useInView, useMotionValue, useMotionValueEvent, useTransform } from "motion/react";
import { ArrowRight, ArrowUpRight, Check, ClipboardList, CreditCard, Gauge, House, Package, RotateCcw, Truck, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Wordmark } from "../../app/BrandMark";
import { formatRoute, navigate } from "../../app/router";
import { sections } from "../../app/sections";
import { useStore } from "../../data/store";
import type { Order, TimelineEntry } from "../../data/types";
import { useI18n, type Key } from "../../i18n";
import { Counter } from "../../motion/Counter";
import { useReduced } from "../../motion/MotionPreference";
import { ease, spring } from "../../motion/tokens";
import { Avatar } from "../../ui/Avatar";
import { Kbd } from "../../ui/Badge";
import { ProductThumb } from "../../ui/Blocks";
import { Button, cx } from "../../ui/Button";
import { useNarrow } from "../../ui/Overlay";
import { runQuery } from "../orders/query";

function useReveal() {
  const reduced = useReduced();
  return (delay = 0) => ({
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.3 },
    transition: { duration: 0.7, ease: ease.out, delay },
  });
}

function SectionHead({ id, eyebrow, title, text }: { id: string; eyebrow: string; title: string; text?: string }) {
  const reveal = useReveal();
  return (
    <motion.header className="lsection__head" {...reveal()}>
      <p className="lsection__eyebrow">{eyebrow}</p>
      <h2 className="lsection__title" id={`${id}-title`}>
        {title}
      </h2>
      {text && <p className="lsection__text">{text}</p>}
    </motion.header>
  );
}

export function HowItWorks() {
  const { t, money } = useI18n();
  const { db, indexes } = useStore();
  const reveal = useReveal();
  // On phones the steps stack, so the progress line grows downwards instead of across.
  const vertical = useNarrow("(max-width: 720px)");
  const order = useMemo<Order | undefined>(() => db?.orders.find((o) => o.status === "Delivered" && o.shippingMethod !== "Pickup" && o.items.length > 1 && o.timeline.length === 5), [db]);
  const customer = order && indexes ? indexes.users.get(order.userId) : undefined;
  const steps = order?.timeline ?? [];
  return (
    <section className="lsection how" id="l-how" aria-labelledby="l-how-title">
      <div className="lwrap">
        <SectionHead id="l-how" eyebrow={t("landing.how.eyebrow")} title={t("landing.how.title")} text={t("landing.how.text")} />
        <motion.div className="how__card" {...reveal(0.1)}>
          {order && customer ? (
            <>
              <div className="how__order">
                <div>
                  <p className="how__id num">{order.id}</p>
                  <p className="how__who">
                    <Avatar name={customer.name} tone={customer.avatar} size={22} />
                    {customer.name} · {order.city}
                  </p>
                </div>
                <div className="how__thumbs">
                  {order.items.map((item) => (
                    <ProductThumb key={item.productId} product={indexes?.products.get(item.productId)} size={40} />
                  ))}
                </div>
                <p className="how__total num">{money(order.total)}</p>
              </div>
              <Journey key={vertical ? "y" : "x"} steps={steps} vertical={vertical} />
              <div className="how__foot">
                <p>{t("landing.how.caption", { order: order.id })}</p>
                <Button variant="ghost" size="sm" iconEnd={<ArrowUpRight />} onClick={() => navigate(formatRoute("orders", order.id))}>
                  {t("landing.how.open")}
                </Button>
              </div>
            </>
          ) : (
            <div className="how__placeholder" />
          )}
        </motion.div>
      </div>
    </section>
  );
}

const stepIcons: Partial<Record<TimelineEntry["status"], LucideIcon>> = { Placed: ClipboardList, Paid: CreditCard, Ready: Package, Shipped: Truck, Delivered: House };

/**
 * The order travels along the line from step to step. The pace follows the real gaps in its history: payment comes
 * minutes after the order, packing takes hours and delivery takes days. Each leg speeds up and settles, then the
 * order pauses briefly at the step it has reached. A reached step keeps its own icon and gets a check mark on top.
 */
function Journey({ steps, vertical }: { steps: TimelineEntry[]; vertical: boolean }) {
  const { t, inline } = useI18n();
  const { indexes } = useStore();
  const reduced = useReduced();
  const list = useRef<HTMLOListElement>(null);
  const inView = useInView(list, { once: true, amount: 0.6 });
  const last = Math.max(1, steps.length - 1);
  const progress = useMotionValue(reduced ? 1 : 0);
  const [reached, setReached] = useState(reduced ? steps.length : 0);
  useMotionValueEvent(progress, "change", (value) => {
    const count = Math.min(steps.length, Math.floor(value * last + 0.001) + 1);
    setReached((current) => Math.max(current, count));
  });
  const runner = useTransform(progress, (value) => `${value * 100}%`);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      progress.set(1);
      setReached(steps.length);
      return;
    }
    setReached(1);
    const gaps = steps.slice(1).map((step, index) => Math.log1p(Math.max(0, Date.parse(step.at) - Date.parse(steps[index].at)) / 60_000));
    const total = gaps.reduce((sum, gap) => sum + gap, 0) || 1;
    const values = [0, 0];
    const at = [0, 0.35];
    const eases: (readonly [number, number, number, number] | "linear")[] = ["linear"];
    gaps.forEach((gap, index) => {
      const leg = 0.35 + (gap / total) * 1.5;
      const stop = (index + 1) / last;
      values.push(stop);
      at.push(at[at.length - 1] + leg);
      eases.push([0.5, 0, 0.2, 1] as const);
      if (index < gaps.length - 1) {
        values.push(stop);
        at.push(at[at.length - 1] + 0.16);
        eases.push("linear");
      }
    });
    const duration = at[at.length - 1];
    const control = animate(progress, values, { duration, times: at.map((time) => time / duration), ease: eases });
    return () => control.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduced]);

  return (
    <ol className="how__steps" ref={list}>
      <span className="how__rail" aria-hidden="true">
        <motion.span className="how__fill" style={vertical ? { scaleY: progress } : { scaleX: progress }} />
        <motion.span className="how__runner" style={vertical ? { y: runner } : { x: runner }}>
          <i />
        </motion.span>
      </span>
      {steps.map((entry, index) => {
        const Icon = stepIcons[entry.status] ?? ClipboardList;
        const done = index < reached;
        return (
          <li key={entry.status} className={cx("how__step", done && "is-done")}>
            <motion.span className="how__dot" aria-hidden="true" animate={done && !reduced ? { scale: [1, 1.12, 1] } : { scale: 1 }} transition={{ duration: 0.34, ease: ease.out }}>
              <Icon />
              <motion.span className="how__check" initial={false} animate={done ? { scale: 1, opacity: 1 } : { scale: 0.4, opacity: 0 }} transition={reduced ? { duration: 0 } : spring.pop}>
                <Check />
              </motion.span>
            </motion.span>
            <strong>{t(`status.timeline.${entry.status}` as Key)}</strong>
            <small>{inline(entry.at)}</small>
            {entry.by && <small className="how__by">{indexes?.users.get(entry.by)?.name}</small>}
          </li>
        );
      })}
    </ol>
  );
}

// The same nine sections, icons and order as the sidebar.
const featureList = sections.map((section) => ({ key: section.id, icon: section.icon, section: section.id }));

export function Features() {
  const { t } = useI18n();
  const reveal = useReveal();
  return (
    <section className="lsection" id="l-features" aria-labelledby="l-features-title">
      <div className="lwrap">
        <SectionHead id="l-features" eyebrow={t("landing.features.eyebrow")} title={t("landing.features.title")} text={t("landing.features.text")} />
        <div className="features">
          {featureList.map((feature, index) => (
            <motion.a
              key={feature.key}
              href={formatRoute(feature.section)}
              className="feature"
              {...reveal(0.05 * index)}
              whileHover={{ y: -3 }}
              onClick={(event) => {
                event.preventDefault();
                navigate(formatRoute(feature.section));
              }}
            >
              <span className="feature__icon" data-motion={feature.key} aria-hidden="true">
                <feature.icon />
              </span>
              <h3>{t(`landing.features.${feature.key}.title` as Key)}</h3>
              <p>{t(`landing.features.${feature.key}.text` as Key)}</p>
              <ArrowRight className="feature__arrow" aria-hidden="true" />
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Speed() {
  const { t, number } = useI18n();
  const { db, indexes } = useStore();
  const reveal = useReveal();
  const [ms, setMs] = useState<number | null>(null);
  const [runs, setRuns] = useState(0);
  const reduced = useReduced();
  const ref = useRef<HTMLDivElement>(null);
  const customers = useMemo(() => db?.users.filter((u) => u.role === "Customer").length ?? 0, [db]);

  // Runs the same search the Orders screen runs, over every order, and reports the time.
  const measure = useCallback(() => {
    if (!db || !indexes) return;
    const samples: number[] = [];
    for (const q of ["berlin", "anna", "NL-2", "gmail"]) samples.push(runQuery(db, indexes, { view: "all", q, payment: "", channel: "", shipping: "", placed: "any", sort: "newest", page: 1, size: 25 }).ms);
    setMs(samples.reduce((a, b) => a + b, 0) / samples.length);
  }, [db, indexes]);

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!db) return;
    const timer = setTimeout(measure, 300);
    return () => clearTimeout(timer);
  }, [db, measure]);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), { threshold: 0.4 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="lsection" id="l-speed" aria-labelledby="l-speed-title">
      <div className="lwrap speed">
        <motion.div className="speed__copy" {...reveal()}>
          <p className="lsection__eyebrow">{t("landing.speed.eyebrow")}</p>
          <h2 className="lsection__title" id="l-speed-title">
            {t("landing.speed.title")}
          </h2>
          <p className="lsection__text">{t("landing.speed.text", { orders: db?.orders.length ?? 0, customers })}</p>
        </motion.div>
        <motion.div className="speed__meter" ref={ref} {...reveal(0.1)}>
          <Gauge className="speed__icon" aria-hidden="true" />
          <p className="speed__value num" aria-live="polite">
            {ms === null || !visible ? <span className="speed__pending">{t("landing.speed.measuring")}</span> : <Counter value={Math.max(0.1, Math.round(ms * 10) / 10)} format={(v) => t("landing.speed.result", { ms: number(Math.round(v * 10) / 10) })} />}
          </p>
          <p className="speed__label">{t("landing.speed.resultLabel", { orders: number(db?.orders.length ?? 0) })}</p>
          <p className="speed__note">{t("landing.speed.note")}</p>
          <Button size="sm" className="speed__again" icon={<motion.span key={runs} className="speed__again-icon" initial={reduced || !runs ? false : { rotate: -360 }} animate={{ rotate: 0 }} transition={{ duration: 0.5, ease: ease.out }}><RotateCcw /></motion.span>} onClick={() => (setRuns((n) => n + 1), measure())} disabled={!db}>
            {t("landing.speed.again")}
          </Button>
        </motion.div>
        <motion.div className="speed__keys" {...reveal(0.2)}>
          <h3>{t("landing.speed.keysTitle")}</h3>
          <p>{t("landing.speed.keysText")}</p>
          <div className="speed__keycaps" aria-hidden="true">
            {["Ctrl", "K", "G", "O", "J", "K", "X"].map((key, index) => (
              <motion.span key={index} initial={{ y: 0 }} whileInView={{ y: [0, 3, 0] }} viewport={{ once: true }} transition={{ duration: 0.35, delay: 0.6 + index * 0.12 }}>
                <Kbd>{key}</Kbd>
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function Pricing() {
  const { t, money } = useI18n();
  const reveal = useReveal();
  const plans = [
    { key: "start", price: 0 },
    { key: "growth", price: 49, current: true },
    { key: "scale", price: 149 },
  ] as const;
  return (
    <section className="lsection" id="l-pricing" aria-labelledby="l-pricing-title">
      <div className="lwrap">
        <SectionHead id="l-pricing" eyebrow={t("landing.pricing.eyebrow")} title={t("landing.pricing.title")} />
        <div className="plans">
          {plans.map((plan, index) => (
            <motion.article key={plan.key} className={cx("plan", "current" in plan && "is-current")} {...reveal(0.08 * index)}>
              {"current" in plan && <p className="plan__badge">{t("landing.pricing.current")}</p>}
              <h3>{t(`landing.pricing.${plan.key}.name` as Key)}</h3>
              <p className="plan__text">{t(`landing.pricing.${plan.key}.text` as Key)}</p>
              <p className="plan__price">
                <strong className="num">{money(plan.price)}</strong>
                <span>{t("landing.pricing.month")}</span>
              </p>
              <ul>
                {(["f1", "f2", "f3"] as const).map((f) => (
                  <li key={f}>
                    <Check />
                    {t(`landing.pricing.${plan.key}.${f}` as Key)}
                  </li>
                ))}
              </ul>
              <Button variant={"current" in plan ? "primary" : "secondary"} onClick={() => navigate(formatRoute("overview"))}>
                {plan.key === "start" ? t("landing.nav.start") : t("landing.pricing.choose", { plan: t(`landing.pricing.${plan.key}.name` as Key) })}
              </Button>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FooterBlock() {
  const { t } = useI18n();
  const reveal = useReveal();
  return (
    <>
      <section className="lsection lsection--cta">
        <motion.div className="lwrap cta" {...reveal()}>
          <div>
            <h2>{t("landing.cta.title")}</h2>
            <p>{t("landing.cta.text")}</p>
          </div>
          <Button variant="primary" size="lg" iconEnd={<ArrowRight />} onClick={() => navigate(formatRoute("overview"))}>
            {t("landing.cta.button")}
          </Button>
        </motion.div>
      </section>
      <footer className="lfooter">
        <div className="lwrap lfooter__inner">
          <Wordmark compact />
          <span>{t("landing.footer.tagline")}</span>
          <span className="lfooter__credit">
            {t("landing.footer.credit")}{" "}
            <a href="https://velmren.com/" target="_blank" rel="noopener">
              VELMREN
            </a>
          </span>
        </div>
      </footer>
    </>
  );
}
