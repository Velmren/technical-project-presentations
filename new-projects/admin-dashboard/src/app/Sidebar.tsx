import { LayoutGroup, motion } from "motion/react";
import { ChevronsUpDown, Search } from "lucide-react";
import { useRef, useState } from "react";
import { queues } from "../data/attention";
import { useStore } from "../data/store";
import { useI18n, type Key } from "../i18n";
import { spring } from "../motion/tokens";
import { Avatar } from "../ui/Avatar";
import { Kbd } from "../ui/Badge";
import { cx } from "../ui/Button";
import { Wordmark } from "./BrandMark";
import { useAccess } from "./access";
import { ProfileMenu } from "./ProfileMenu";
import { formatRoute, navigate, type SectionId } from "./router";
import { sections } from "./sections";

const groups = [
  { id: "main", label: null },
  { id: "store", label: "nav.groups.store" },
  { id: "team", label: "nav.groups.team" },
  { id: "insights", label: "nav.groups.insights" },
  { id: "system", label: null },
] as const;

export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function Sidebar({ active, onSearch, onNavigate, onShortcuts }: { active: SectionId | "home"; onSearch: () => void; onNavigate?: () => void; onShortcuts: () => void }) {
  const { t, number } = useI18n();
  const { db, indexes } = useStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const access = useAccess();
  const profileButton = useRef<HTMLButtonElement>(null);
  const work = db && indexes ? queues(db, indexes) : null;
  const counts: Partial<Record<SectionId, { value: number; label: string; tone: "accent" | "muted" }>> = work
    ? {
        orders: { value: work.toPack.length, label: t("nav.toPack", { count: work.toPack.length }), tone: "muted" },
        messages: { value: work.unread, label: t("nav.unread", { count: work.unread }), tone: "accent" },
      }
    : {};
  const monthOrders = db ? db.orders.filter((o) => o.date >= "2026-09-01").length : 0;

  return (
    <div className="shell-sidebar__inner">
      <a className="shell-brand" href="#/" aria-label={t("profile.productPage")}>
        <Wordmark />
      </a>
      <button type="button" className="shell-search" onClick={onSearch}>
        <Search />
        <span>{t("shell.search")}</span>
        <span className="shell-search__keys">
          <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      <nav className="shell-nav" aria-label={t("nav.label")}>
        <LayoutGroup id="nav">
          {groups.map((group) => (
            <div className={cx("shell-nav__group", group.id === "system" && "is-system")} key={group.id}>
              {group.label && <p className="shell-nav__label">{t(group.label)}</p>}
              {sections
                .filter((section) => section.group === group.id && access.canOpen(section.id))
                .map((section) => {
                  const selected = active === section.id;
                  const count = counts[section.id];
                  return (
                    <a
                      key={section.id}
                      href={formatRoute(section.id)}
                      className={cx("shell-nav__item", selected && "is-active")}
                      aria-current={selected ? "page" : undefined}
                      onClick={(event) => {
                        event.preventDefault();
                        navigate(formatRoute(section.id));
                        onNavigate?.();
                      }}
                    >
                      {selected && <motion.span className="shell-nav__indicator" layoutId="nav-indicator" transition={spring.indicator} />}
                      <section.icon />
                      <span className="shell-nav__text">{t(`nav.${section.id}` as Key)}</span>
                      {count && count.value > 0 && (
                        <motion.span key={count.value} className={cx("shell-nav__count num", count.tone === "accent" && "is-accent")} title={count.label} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.pop}>
                          {number(count.value)}
                        </motion.span>
                      )}
                    </a>
                  );
                })}
            </div>
          ))}
        </LayoutGroup>
      </nav>
      <div className="shell-sidebar__footer">
        <div className="shell-plan">
          <div className="shell-plan__row">
            <strong>{db?.settings.workspaceName ?? t("brand.workspace")}</strong>
            <span>{t("brand.plan")}</span>
          </div>
          <div className="shell-plan__meter" aria-hidden="true">
            <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: Math.min(1, monthOrders / 5000) }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }} />
          </div>
          <p className="shell-plan__usage">{t("brand.usage", { count: monthOrders, limit: 5000 })}</p>
        </div>
        <div className="shell-profile-wrap">
          <button ref={profileButton} type="button" className="shell-profile" aria-haspopup="menu" aria-expanded={profileOpen} aria-label={t("shell.profile")} onClick={() => setProfileOpen((open) => !open)}>
            <Avatar name={db?.settings.profileName ?? "Alex Morgan"} tone={0} size={34} />
            <span className="shell-profile__text">
              <strong>{db?.settings.profileName ?? "Alex Morgan"}</strong>
              <small>{access.preview ? t("access.viewingAs", { role: t(`team.roles.${access.role}` as Key) }) : t("profile.role")}</small>
            </span>
            <ChevronsUpDown />
          </button>
          <ProfileMenu open={profileOpen} onClose={() => setProfileOpen(false)} anchor={profileButton} onShortcuts={onShortcuts} />
        </div>
        <a className="shell-credit" href="https://velmren.com/" target="_blank" rel="noopener">
          VELMREN
        </a>
      </div>
    </div>
  );
}
