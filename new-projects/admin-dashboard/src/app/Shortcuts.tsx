import { useEffect, useRef } from "react";
import { useI18n, type Key } from "../i18n";
import { Kbd } from "../ui/Badge";
import { Dialog } from "../ui/Overlay";
import { formatRoute, navigate } from "./router";
import { sections } from "./sections";
import { isMac } from "./Sidebar";

const typing = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
};

/** Global keys: Ctrl/⌘ K for the command menu, ? for help, g then a letter to jump. */
export function useHotkeys({ onPalette, onHelp }: { onPalette: () => void; onHelp: () => void }) {
  const pendingG = useRef(0);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onPalette();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || typing(event.target) || document.body.classList.contains("o-modal-open")) return;
      if (event.key === "?") {
        event.preventDefault();
        onHelp();
        return;
      }
      if (event.key === "/") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("orbit:focus-search"));
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "g") {
        pendingG.current = Date.now();
        return;
      }
      if (Date.now() - pendingG.current < 1200) {
        const target = sections.find((section) => section.key === key);
        pendingG.current = 0;
        if (target) {
          event.preventDefault();
          navigate(formatRoute(target.id));
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onPalette, onHelp]);
}

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const mod = isMac ? "⌘" : "Ctrl";
  const rows: { group: Key; items: [string[], string][] }[] = [
    {
      group: "shortcuts.groups.general",
      items: [
        [[mod, "K"], t("shortcuts.palette")],
        [["/"], t("shortcuts.search")],
        [["?"], t("shortcuts.help")],
        [["Esc"], t("shortcuts.close")],
        [[mod, "Z"], t("shortcuts.undo")],
      ],
    },
    { group: "shortcuts.groups.navigation", items: sections.map((section) => [["G", section.key.toUpperCase()], t(`nav.${section.id}` as Key)]) },
    {
      group: "shortcuts.groups.lists",
      items: [
        [["J"], t("shortcuts.next")],
        [["K"], t("shortcuts.previous")],
        [["X"], t("shortcuts.select")],
        [["Shift", "X"], t("shortcuts.range")],
        [["Enter"], t("shortcuts.open")],
      ],
    },
  ];
  return (
    <Dialog open={open} onClose={onClose} title={t("shortcuts.title")} wide className="shortcuts">
      <p className="shortcuts__intro">{t("shortcuts.subtitle")}</p>
      <div className="shortcuts__grid">
        {rows.map((row) => (
          <section key={row.group}>
            <h3>{t(row.group)}</h3>
            <dl>
              {row.items.map(([keys, label]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {keys.map((key, i) => (
                      <span key={key + i}>
                        {i > 0 && keys[0] === "G" && <span className="shortcuts__then">{t("shortcuts.then")}</span>}
                        <Kbd>{key}</Kbd>
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
