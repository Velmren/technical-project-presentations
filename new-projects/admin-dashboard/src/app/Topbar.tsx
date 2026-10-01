import { ChevronRight, Keyboard, Menu, Search } from "lucide-react";
import { useStore } from "../data/store";
import { useI18n, type Key } from "../i18n";
import { Button } from "../ui/Button";
import { NotificationCenter } from "./NotificationCenter";
import { formatRoute, navigate, type Route } from "./router";

export function Topbar({ route, onMenu, onSearch, onHelp, menuOpen }: { route: Route; onMenu: () => void; onSearch: () => void; onHelp: () => void; menuOpen: boolean }) {
  const { t } = useI18n();
  const { db } = useStore();
  const section = route.section === "home" ? "overview" : route.section;
  return (
    <header className="shell-topbar">
      <Button variant="ghost" iconOnly icon={<Menu />} className="shell-topbar__menu" aria-label={t("nav.openMenu")} aria-expanded={menuOpen} onClick={onMenu} />
      <nav className="crumbs" aria-label={t("shell.breadcrumbs")}>
        <span className="crumbs__workspace">{db?.settings.workspaceName ?? t("brand.workspace")}</span>
        <ChevronRight className="crumbs__sep" aria-hidden="true" />
        {route.id ? (
          <a
            href={formatRoute(section)}
            onClick={(event) => {
              event.preventDefault();
              navigate(formatRoute(section, undefined, route.query));
            }}
          >
            {t(`nav.${section}` as Key)}
          </a>
        ) : (
          <span aria-current="page">{t(`nav.${section}` as Key)}</span>
        )}
        {route.id && (
          <>
            <ChevronRight className="crumbs__sep" aria-hidden="true" />
            <span aria-current="page" className="crumbs__id num">
              {route.id}
            </span>
          </>
        )}
      </nav>
      <div className="shell-topbar__actions">
        <Button variant="ghost" iconOnly icon={<Search />} className="shell-topbar__search" aria-label={t("shell.search")} onClick={onSearch} />
        <Button variant="ghost" iconOnly icon={<Keyboard />} className="shell-topbar__help" aria-label={t("shell.shortcuts")} onClick={onHelp} />
        <NotificationCenter />
      </div>
    </header>
  );
}
