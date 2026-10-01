import { motion } from "motion/react";
import { Eye, Lock, RotateCcw, ServerCrash } from "lucide-react";
import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "../data/store";
import { OverviewScreen } from "../features/overview/OverviewScreen";
import { useI18n, useLocaleState, type Key } from "../i18n";
import { useReduced } from "../motion/MotionPreference";
import { duration, ease } from "../motion/tokens";
import { EmptyState, Skeleton } from "../ui/Blocks";
import { Button, cx } from "../ui/Button";
import { Toasts } from "../ui/Toasts";
import { AccessProvider, useAccess } from "./access";
import { CommandPalette } from "./CommandPalette";
import type { Route, SectionId } from "./router";
import { ShortcutsDialog, useHotkeys } from "./Shortcuts";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

// Overview ships with the shell; every other section is its own chunk, warmed up once the workspace is idle.
const loaders = {
  orders: () => import("../features/orders/OrdersScreen").then((m) => ({ default: m.OrdersScreen })),
  customers: () => import("../features/customers/CustomersScreen").then((m) => ({ default: m.CustomersScreen })),
  products: () => import("../features/products/ProductsScreen").then((m) => ({ default: m.ProductsScreen })),
  payments: () => import("../features/payments/PaymentsScreen").then((m) => ({ default: m.PaymentsScreen })),
  analytics: () => import("../features/analytics/AnalyticsScreen").then((m) => ({ default: m.AnalyticsScreen })),
  tasks: () => import("../features/tasks/TasksScreen").then((m) => ({ default: m.TasksScreen })),
  messages: () => import("../features/messages/MessagesScreen").then((m) => ({ default: m.MessagesScreen })),
  settings: () => import("../features/settings/SettingsScreen").then((m) => ({ default: m.SettingsScreen })),
} satisfies Record<Exclude<SectionId, "overview">, () => Promise<{ default: (props: { route: Route }) => ReactNode }>>;
type Screen = (props: { route: Route }) => ReactNode;
type LazyId = keyof typeof loaders;
const screens = Object.fromEntries(Object.entries(loaders).map(([id, load]) => [id, lazy(load)])) as Record<LazyId, ReturnType<typeof lazy<Screen>>>;
// Sections that have finished loading render directly, so switching to them never flashes the skeleton.
const loaded: Partial<Record<LazyId, Screen>> = {};
const warm = () =>
  (Object.keys(loaders) as LazyId[]).forEach((id) =>
    loaders[id]()
      .then((module) => (loaded[id] = module.default))
      .catch(() => undefined),
  );

class SectionBoundary extends Component<{ children: ReactNode; fallback: (retry: () => void) => ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback(() => this.setState({ failed: false })) : this.props.children;
  }
}

export function Workspace({ route }: { route: Route }) {
  return (
    <AccessProvider>
      <WorkspaceShell route={route} />
    </AccessProvider>
  );
}

function WorkspaceShell({ route }: { route: Route }) {
  const { t } = useI18n();
  const { ready, db, storage, recovered } = useStore();
  const { setTimezone } = useLocaleState();
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [menu, setMenu] = useState(false);
  const section = (route.section === "home" ? "overview" : route.section) as SectionId;
  const mainRef = useRef<HTMLElement>(null);
  const previousSection = useRef(section);

  const openPalette = useCallback(() => setPalette((open) => !open), []);
  const openHelp = useCallback(() => setHelp(true), []);
  useHotkeys({ onPalette: openPalette, onHelp: openHelp });

  useEffect(() => {
    if (!ready) return;
    const id = typeof requestIdleCallback === "function" ? requestIdleCallback(warm, { timeout: 2500 }) : window.setTimeout(warm, 1200);
    return () => (typeof cancelIdleCallback === "function" ? cancelIdleCallback(id) : clearTimeout(id));
  }, [ready]);

  useEffect(() => {
    if (db) setTimezone(db.settings.timezone);
  }, [db?.settings.timezone, setTimezone, db]);

  // A new section starts at the top and takes focus for screen readers; opening a record keeps the list in place.
  useEffect(() => {
    if (previousSection.current === section) return;
    previousSection.current = section;
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
    setMenu(false);
  }, [section]);

  useEffect(() => {
    document.title = `${t(`nav.${section}` as Key)} · ORBIT`;
  }, [section, t]);

  return (
    <div className="shell" data-density={db?.settings.compact ? "compact" : "comfortable"}>
      <a className="skip-link-v5" href="#main">
        {t("nav.skip")}
      </a>
      <aside className={cx("shell-sidebar", menu && "is-open")} aria-label={t("nav.label")}>
        <Sidebar active={section} onSearch={() => setPalette(true)} onNavigate={() => setMenu(false)} onShortcuts={openHelp} />
      </aside>
      <div className={cx("shell-scrim", menu && "is-visible")} onClick={() => setMenu(false)} aria-hidden="true" />
      <div className="shell-main" inert={menu ? true : undefined}>
        <Topbar route={route} menuOpen={menu} onMenu={() => setMenu(true)} onSearch={() => setPalette(true)} onHelp={openHelp} />
        {storage === "session" && <p className="shell-notice">{t("shell.sessionOnly")}</p>}
        {recovered && <p className="shell-notice">{t("shell.recovered")}</p>}
        <PreviewBanner />
        <main id="main" ref={mainRef} tabIndex={-1} className="shell-content">
          {ready ? (
            <SectionBoundary
              key={section}
              fallback={(retry) => (
                <EmptyState icon={<ServerCrash />} title={t("shell.sectionError")} text={t("shell.sectionErrorHint")} action={<Button icon={<RotateCcw />} onClick={retry}>{t("common.retry")}</Button>} />
              )}
            >
              <SectionView key={section} section={section} route={route} />
            </SectionBoundary>
          ) : (
            <WorkspaceSkeleton />
          )}
        </main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} onShortcuts={openHelp} />
      <ShortcutsDialog open={help} onClose={() => setHelp(false)} />
      <Toasts />
    </div>
  );
}

function PreviewBanner() {
  const { t } = useI18n();
  const access = useAccess();
  if (!access.preview) return null;
  return (
    <div className="preview-banner" role="status">
      <Eye />
      <span>{t("access.banner", { role: t(`team.roles.${access.role}` as Key) })}</span>
      <Button size="sm" variant="ghost" onClick={() => access.setRole("Owner")}>
        {t("access.exit")}
      </Button>
    </div>
  );
}

function SectionView({ section, route }: { section: SectionId; route: Route }) {
  const reduced = useReduced();
  const access = useAccess();
  const { t } = useI18n();
  if (!access.canOpen(section))
    return (
      <EmptyState
        icon={<Lock />}
        title={t("access.noSection", { role: t(`team.roles.${access.role}` as Key) })}
        text={t("access.noSectionHint")}
        action={<Button onClick={() => access.setRole("Owner")}>{t("access.exit")}</Button>}
      />
    );
  return (
    <motion.div
      className="section"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.base, ease: ease.out }}
    >
      {section === "overview" ? <OverviewScreen /> : <LazySection section={section} route={route} />}
    </motion.div>
  );
}

function LazySection({ section, route }: { section: Exclude<SectionId, "overview">; route: Route }) {
  // Chosen once per visit: switching paths mid-visit would remount the screen and drop unsaved input.
  const [Ready] = useState(() => loaded[section]);
  if (Ready) return <Ready route={route} />;
  const Screen = screens[section];
  return (
    <Suspense fallback={<WorkspaceSkeleton compact />}>
      <Screen route={route} />
    </Suspense>
  );
}

/** Mirrors the Overview layout, so the page doesn't jump when the data arrives. */
export function WorkspaceSkeleton({ compact }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="skeleton-page" role="status" aria-label={t("common.loading")}>
      <div className="skeleton-page__head">
        <Skeleton width={260} height={26} />
        <Skeleton width={380} height={14} />
      </div>
      {!compact && (
        <div className="skeleton-page__kpis">
          {Array.from({ length: 4 }, (_, i) => (
            <div className="skeleton-card" key={i}>
              <Skeleton width={96} height={12} />
              <Skeleton width={140} height={28} />
              <Skeleton width="100%" height={36} />
            </div>
          ))}
        </div>
      )}
      <div className="skeleton-page__grid">
        <div className="skeleton-card is-tall">
          <Skeleton width={160} height={14} />
          <Skeleton width="100%" height={220} radius={10} />
        </div>
        <div className="skeleton-card is-tall">
          <Skeleton width={140} height={14} />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} width="100%" height={18} />
          ))}
        </div>
      </div>
    </div>
  );
}
