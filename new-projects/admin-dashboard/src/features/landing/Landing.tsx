import "@fontsource-variable/caveat/index.css";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { ArrowRight, Check, Command, History, Link2, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Wordmark } from "../../app/BrandMark";
import { formatRoute, navigate } from "../../app/router";
import { useI18n, type Key } from "../../i18n";
import { useReduced } from "../../motion/MotionPreference";
import { duration, ease, spring } from "../../motion/tokens";
import { Button, cx } from "../../ui/Button";
import { Features, FooterBlock, HowItWorks, Pricing, Speed } from "./Sections";
import "./landing.css";

const open = () => navigate(formatRoute("overview"));

export function Landing() {
  const { t } = useI18n();
  useEffect(() => {
    document.title = `ORBIT · ${t("landing.hero.eyebrow")}`;
  }, [t]);
  return (
    <div className="landing">
      <a className="skip-link-v5" href="#landing-main">
        {t("nav.skip")}
      </a>
      <LandingNav />
      <main id="landing-main" tabIndex={-1}>
        <Hero />
        <Strip />
        <HowItWorks />
        <Features />
        <Speed />
        <Pricing />
        <FooterBlock />
      </main>
    </div>
  );
}

function LandingNav() {
  const { t, locale, setLocale } = useI18n();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => scrollY.on("change", (y) => setScrolled(y > 12)), [scrollY]);
  const reduced = useReduced();
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  return (
    <header className={cx("lnav", scrolled && "is-scrolled")}>
      <div className="lwrap lnav__inner">
        <a href="#/" className="lnav__brand" aria-label="ORBIT">
          <Wordmark />
        </a>
        <nav className="lnav__links" aria-label="ORBIT">
          {(["how", "features", "speed", "pricing"] as const).map((id) => (
            <button key={id} type="button" onClick={() => jump(`l-${id}`)}>
              {t(`landing.nav.${id}` as Key)}
            </button>
          ))}
        </nav>
        <div className="lnav__actions">
          <span className="lang-toggle" role="group" aria-label={t("profile.language")}>
            {(["ru", "en"] as const).map((code) => (
              <button key={code} type="button" aria-pressed={locale === code} className={cx(locale === code && "is-active")} onClick={() => setLocale(code)} lang={code}>
                {code.toUpperCase()}
              </button>
            ))}
          </span>
          <Button variant="ghost" size="sm" onClick={open} className="lnav__signin">
            {t("landing.nav.signIn")}
          </Button>
          <Button variant="primary" size="sm" onClick={open}>
            {t("landing.nav.start")}
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const { t, locale } = useI18n();
  const reduced = useReduced();
  const heroRef = useRef<HTMLElement>(null);
  // The laptop leans gently towards the pointer.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-1, 1], [-5, 5]), { stiffness: 120, damping: 20 });
  const rotateX = useSpring(useTransform(py, [-1, 1], [4, -4]), { stiffness: 120, damping: 20 });
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (reduced || event.pointerType !== "mouse") return;
    const rect = heroRef.current!.getBoundingClientRect();
    px.set(((event.clientX - rect.left) / rect.width) * 2 - 1);
    py.set(((event.clientY - rect.top) / rect.height) * 2 - 1);
  };
  const line = (delay: number) => ({
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: "105%" },
    animate: { opacity: 1, y: "0%" },
    transition: { duration: 0.8, ease: ease.out, delay },
  });
  const rise = (delay: number) => ({
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, ease: ease.out, delay },
  });

  return (
    <section className="hero" ref={heroRef} onPointerMove={onPointerMove} onPointerLeave={() => (px.set(0), py.set(0))}>
      <div className="hero__backdrop" aria-hidden="true">
        <svg className="hero__orbits" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          <g className="hero__orbit hero__orbit--a">
            <ellipse cx="820" cy="360" rx="520" ry="210" />
            <circle cx="1340" cy="360" r="3.5" className="hero__satellite" />
          </g>
          <g className="hero__orbit hero__orbit--b">
            <ellipse cx="820" cy="360" rx="380" ry="150" />
            <circle cx="440" cy="360" r="2.5" className="hero__satellite" />
          </g>
        </svg>
      </div>
      <div className="lwrap hero__inner">
        <div className="hero__copy">
          <motion.p className="hero__eyebrow" {...rise(0.05)}>
            {t("landing.hero.eyebrow")}
          </motion.p>
          <h1 className="hero__title">
            <span className="hero__line">
              <motion.span {...line(0.12)}>{t("landing.hero.titleLead")}</motion.span>
            </span>
            <span className="hero__line">
              <motion.span className="hero__accent" {...line(0.22)}>
                {t("landing.hero.titleAccent")}
              </motion.span>
            </span>
          </h1>
          <motion.p className="hero__text" {...rise(0.34)}>
            {t("landing.hero.text")}
          </motion.p>
          <motion.div className="hero__actions" {...rise(0.44)}>
            <Button variant="primary" size="lg" iconEnd={<ArrowRight />} onClick={open}>
              {t("landing.hero.primary")}
            </Button>
            <Button size="lg" onClick={() => document.getElementById("l-how")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" })}>
              {t("landing.hero.secondary")}
            </Button>
          </motion.div>
          <motion.ul className="hero__points" {...rise(0.54)}>
            {(["free", "card", "languages"] as const).map((key) => (
              <li key={key}>
                <Check />
                {t(`landing.hero.points.${key}` as Key)}
              </li>
            ))}
          </motion.ul>
        </div>
        <div className="hero__stage">
          <motion.div
            className="laptop-enter"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 70, rotateX: 26, rotateY: -26, scale: 0.92 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, rotateX: 7, rotateY: -14, scale: 1 }}
            transition={{ ...spring.panel, visualDuration: 0.9, delay: 0.2 }}
          >
          <motion.div className="laptop" style={reduced ? undefined : { rotateX, rotateY }}>
            <button type="button" className="laptop__screen" onClick={open} aria-label={t("landing.hero.primary")}>
              <img src={locale === "ru" ? "./workspace-preview-ru.webp" : "./workspace-preview.webp"} width={1440} height={900} alt={t("landing.hero.preview")} fetchPriority="high" />
            </button>
            <span className="laptop__base" aria-hidden="true" />
            <span className="laptop__shadow" aria-hidden="true" />
          </motion.div>
          </motion.div>
          <div className="hero__note" aria-hidden="true">
            <motion.span initial={{ opacity: 0, rotate: -10, y: 6 }} animate={{ opacity: 1, rotate: -7, y: 0 }} transition={{ duration: duration.slow, delay: reduced ? 0 : 1.05, ease: ease.out }}>
              {t("landing.hero.note")}
            </motion.span>
            <svg viewBox="0 0 100 90">
              <motion.path d="M78 6C84 40 66 60 22 66" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, delay: 1.2, ease: ease.out }} />
              <motion.path d="M22 66 36 52M22 66l18 8" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, delay: 1.8, ease: ease.out }} />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

function Strip() {
  const { t } = useI18n();
  const reduced = useReduced();
  const items = [
    { key: "linked", icon: Link2 },
    { key: "roles", icon: ShieldCheck },
    { key: "keyboard", icon: Command },
    { key: "log", icon: History },
  ] as const;
  return (
    <section className="strip" aria-label={t("landing.features.eyebrow")}>
      <div className="lwrap strip__grid">
        {items.map((item, index) => (
          <motion.div className="strip__item" key={item.key} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: duration.slow + 0.2, ease: ease.out, delay: 0.7 + index * 0.08 }}>
            <span className="strip__icon" aria-hidden="true">
              <item.icon />
            </span>
            <span>
              <strong>{t(`landing.strip.${item.key}.title` as Key)}</strong>
              <small>{t(`landing.strip.${item.key}.text` as Key)}</small>
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
