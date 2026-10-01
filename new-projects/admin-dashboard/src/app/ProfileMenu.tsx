import { Keyboard, LogOut, Orbit, SlidersHorizontal } from "lucide-react";
import type { RefObject } from "react";
import { useStore } from "../data/store";
import { useI18n } from "../i18n";
import { Kbd } from "../ui/Badge";
import { cx } from "../ui/Button";
import { Popover } from "../ui/Popover";
import { formatRoute, navigate } from "./router";

export function ProfileMenu({ open, onClose, anchor, onShortcuts }: { open: boolean; onClose: () => void; anchor: RefObject<HTMLButtonElement | null>; onShortcuts: () => void }) {
  const { t, locale, setLocale } = useI18n();
  const { db } = useStore();
  const go = (hash: string) => {
    onClose();
    navigate(hash);
  };
  return (
    <Popover open={open} onClose={onClose} anchor={anchor} placement="top-start" label={t("shell.profile")} role="menu" className="profile-menu">
      <div className="profile-menu__head">
        <strong>{db?.settings.profileName}</strong>
        <span>{db?.settings.profileEmail}</span>
      </div>
      <button type="button" role="menuitem" className="menu-item" onClick={() => go(formatRoute("settings"))}>
        <SlidersHorizontal />
        {t("profile.preferences")}
      </button>
      <div className="menu-item is-static" role="group" aria-label={t("profile.language")}>
        <span>{t("profile.language")}</span>
        <span className="lang-toggle">
          {(["ru", "en"] as const).map((code) => (
            <button key={code} type="button" role="menuitemradio" aria-checked={locale === code} className={cx(locale === code && "is-active")} onClick={() => setLocale(code)} lang={code}>
              {code.toUpperCase()}
            </button>
          ))}
        </span>
      </div>
      <button
        type="button"
        role="menuitem"
        className="menu-item"
        onClick={() => {
          onClose();
          onShortcuts();
        }}
      >
        <Keyboard />
        {t("profile.shortcuts")}
        <Kbd>?</Kbd>
      </button>
      <div className="menu-sep" role="separator" />
      <button type="button" role="menuitem" className="menu-item" onClick={() => go("#/")}>
        <Orbit />
        {t("profile.productPage")}
      </button>
      <button type="button" role="menuitem" className="menu-item" onClick={() => go("#/")}>
        <LogOut />
        {t("profile.signOut")}
      </button>
    </Popover>
  );
}
