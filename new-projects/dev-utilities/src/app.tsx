// Base styles load first so tool styles can build on them.
import "./theme.css";
import "./shell.css";
import { useState, useEffect, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Braces,
  Palette,
  Fingerprint,
  Binary,
  Info,
  Sun,
  Moon,
  MonitorCog,
  X,
} from "lucide-react";
import { JsonWorkspace } from "./json/JsonWorkspace";
import { ColorWorkspace } from "./color/ColorWorkspace";
import { HashWorkspace } from "./hash/HashWorkspace";
import { Base64Workspace } from "./base64/Base64Workspace";
import { storageEnabled } from "./shared";
import { I18nProvider, useI18n } from "./i18n";
import { Menu } from "./ui/Menu";
import { ToolBoundary } from "./ui/ToolBoundary";
import {
  STORAGE_PREFIX,
  isPrefsKey,
  migrateLegacyConsent,
  ownedStorageKeys,
  readPrefs,
  resolveTheme,
  writePrefs,
  type ThemePref,
} from "./prefs";

migrateLegacyConsent();

type Tool = "json" | "color" | "hash" | "base64";
const tools = [
  { id: "json", icon: Braces },
  { id: "color", icon: Palette },
  { id: "hash", icon: Fingerprint },
  { id: "base64", icon: Binary },
] as const;
const toolFromHash = (): Tool =>
  (tools.find((t) => t.id === location.hash.slice(1))?.id as Tool) || "json";

function useTheme() {
  const [pref, setPref] = useState<ThemePref>(
    () => readPrefs().theme ?? "system",
  );
  useEffect(() => {
    const apply = () => {
      const theme = resolveTheme(pref);
      document.documentElement.dataset.theme = theme;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", theme === "dark" ? "#161616" : "#efefec");
    };
    apply();
    if (pref !== "system") return;
    const query = matchMedia("(prefers-color-scheme: dark)");
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [pref]);
  const choose = (next: ThemePref) => {
    writePrefs({ theme: next });
    setPref(next);
  };
  return [pref, choose] as const;
}

function App() {
  const { t, lang, setLang } = useI18n();
  const [tool, setTool] = useState<Tool>(toolFromHash);
  const [theme, setTheme] = useTheme();
  const [toast, setToast] = useState("");
  const [about, setAbout] = useState(false);
  const [persist, setPersist] = useState(storageEnabled);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 3600);
  }, []);
  const navigate = useCallback((id: Tool) => {
    setTool(id);
    history.replaceState(null, "", "#" + id);
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  }, []);

  useEffect(() => {
    document.title = t("app.title");
  }, [t]);

  function clearDrafts(disable: boolean) {
    try {
      ownedStorageKeys()
        .filter((k) => !isPrefsKey(k))
        .forEach((k) => localStorage.removeItem(k));
      if (!disable) localStorage.setItem(STORAGE_PREFIX + "enabled", "true");
      setPersist(!disable);
      window.dispatchEvent(new Event("du-storage"));
      notify(t(disable ? "app.storageOff" : "app.storageCleared"));
    } catch {
      notify(t("app.storageUnavailable"));
    }
  }
  function changeStorage(enabled: boolean) {
    if (!enabled) return clearDrafts(true);
    try {
      localStorage.setItem(STORAGE_PREFIX + "enabled", "true");
      setPersist(true);
      window.dispatchEvent(new Event("du-storage"));
      notify(t("app.storageOn"));
    } catch {
      notify(t("app.storageUnavailable"));
    }
  }

  useEffect(() => {
    const onHash = () => {
      setTool(toolFromHash());
      requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    };
    const shortcuts = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && /^[1-4]$/.test(e.key)) {
        e.preventDefault();
        navigate(tools[Number(e.key) - 1].id);
      }
    };
    const failed = () => notify(t("app.storageFull"));
    const syncStorage = () => setPersist(storageEnabled());
    window.addEventListener("hashchange", onHash);
    window.addEventListener("keydown", shortcuts);
    window.addEventListener("du-storage-error", failed);
    window.addEventListener("storage", syncStorage);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("keydown", shortcuts);
      window.removeEventListener("du-storage-error", failed);
      window.removeEventListener("storage", syncStorage);
    };
  }, [navigate, notify, t]);

  useEffect(() => {
    if (about && !dialog.current?.open) dialog.current?.showModal();
    if (!about && dialog.current?.open) dialog.current.close();
  }, [about]);

  const ThemeIcon =
    theme === "dark" ? Moon : theme === "light" ? Sun : MonitorCog;

  const failure = {
    title: t("app.failure.title"),
    body: t("app.failure.body"),
    retry: t("app.failure.retry"),
    reset: t("app.failure.reset"),
  };
  return (
    <>
      <a className="skip" href="#workspace-main">
        {t("app.skip")}
      </a>
      <div className="app" data-tool={tool}>
        <header className="topbar">
          <a
            className="brand"
            href="#json"
            onClick={(e) => {
              e.preventDefault();
              navigate("json");
            }}
          >
            <img src="./favicon.svg" alt="" width={18} height={18} />
            <span>{t("app.name")}</span>
          </a>
          <nav className="tool-tabs" aria-label={t("app.toolsLabel")}>
            {tools.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className="tool-tab"
                aria-current={tool === item.id ? "page" : undefined}
                title={`${t(`app.tools.${item.id}`)} (Alt+${i + 1})`}
                onClick={() => navigate(item.id)}
              >
                <item.icon size={16} strokeWidth={1.75} aria-hidden="true" />
                <span>{t(`app.tools.${item.id}`)}</span>
              </button>
            ))}
          </nav>
          <div className="topbar-end">
            <div
              className="lang-switch"
              role="group"
              aria-label={t("app.language")}
            >
              {(["ru", "en"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={lang === code}
                  lang={code}
                  aria-label={code === "ru" ? "Русский" : "English"}
                  onClick={() => setLang(code)}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
            <Menu
              label={`${t("app.theme")}: ${t(`app.themes.${theme}`)}`}
              className="icon-btn"
              kind="radio"
              align="end"
              trigger={<ThemeIcon size={16} strokeWidth={1.75} />}
              items={(["system", "light", "dark"] as const).map((id) => ({
                id,
                label: t(`app.themes.${id}`),
                checked: theme === id,
                onSelect: () => setTheme(id),
              }))}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label={t("app.about")}
              title={t("app.about")}
              onClick={() => setAbout(true)}
            >
              <Info size={16} strokeWidth={1.75} />
            </button>
          </div>
        </header>
        <main className="app-main" id="workspace-main" tabIndex={-1}>
          <section hidden={tool !== "json"} className="tool-host">
            <h1 className="sr-only">{t("json.heading")}</h1>
            <ToolBoundary
              storageKeys={(k) => k === "json" || k.startsWith("json.")}
              labels={failure}
            >
              <JsonWorkspace notify={notify} active={tool === "json"} />
            </ToolBoundary>
          </section>
          <section hidden={tool !== "color"} className="tool-host">
            <h1 className="sr-only">{t("color.heading")}</h1>
            <ToolBoundary
              storageKeys={(k) => k === "color-studio"}
              labels={failure}
            >
              <ColorWorkspace notify={notify} />
            </ToolBoundary>
          </section>
          <section hidden={tool !== "hash"} className="tool-host">
            <h1 className="sr-only">{t("hash.heading")}</h1>
            <ToolBoundary
              storageKeys={(k) => k.startsWith("hash.")}
              labels={failure}
            >
              <HashWorkspace notify={notify} />
            </ToolBoundary>
          </section>
          <section hidden={tool !== "base64"} className="tool-host">
            <h1 className="sr-only">{t("base64.heading")}</h1>
            <ToolBoundary
              storageKeys={(k) => k.startsWith("base64.")}
              labels={failure}
            >
              <Base64Workspace notify={notify} />
            </ToolBoundary>
          </section>
        </main>
      </div>
      <dialog
        className="about"
        ref={dialog}
        aria-labelledby="about-title"
        onCancel={(e) => {
          e.preventDefault();
          setAbout(false);
        }}
        onClick={(e) => {
          if (e.target === dialog.current) setAbout(false);
        }}
      >
        <div className="about-inner">
          <header className="about-head">
            <h2 id="about-title">{t("about.title")}</h2>
            <button
              type="button"
              className="icon-btn"
              aria-label={t("common.close")}
              onClick={() => setAbout(false)}
            >
              <X size={16} />
            </button>
          </header>
          <p className="about-lead">{t("about.lead")}</p>
          <section>
            <h3>{t("about.localTitle")}</h3>
            <p>{t("about.local")}</p>
          </section>
          <section>
            <h3>{t("about.storageTitle")}</h3>
            <label className="check-row">
              <input
                type="checkbox"
                checked={persist}
                onChange={(e) => changeStorage(e.target.checked)}
              />
              <span>{t("about.storageToggle")}</span>
            </label>
            <p className="about-hint">{t("about.storageHint")}</p>
            {persist && (
              <button
                type="button"
                className="btn"
                onClick={() => clearDrafts(false)}
              >
                {t("about.clear")}
              </button>
            )}
          </section>
          <section>
            <h3>{t("about.keysTitle")}</h3>
            <dl className="keys">
              <dt>
                <kbd>Alt</kbd> <kbd>1</kbd>-<kbd>4</kbd>
              </dt>
              <dd>{t("about.keys.tools")}</dd>
              <dt>
                <kbd>Ctrl</kbd> <kbd>Enter</kbd>
              </dt>
              <dd>{t("about.keys.run")}</dd>
              <dt>
                <kbd>Ctrl</kbd> <kbd>F</kbd>
              </dt>
              <dd>{t("about.keys.find")}</dd>
              <dt>
                <kbd>←</kbd> <kbd>→</kbd>
              </dt>
              <dd>{t("about.keys.split")}</dd>
            </dl>
          </section>
          <footer className="about-foot">
            <span>
              {/* The brand name in the credit line links to the main site. */}
              {t("about.credits")
                .split(/(VELMREN)/)
                .map((part, i) =>
                  part === "VELMREN" ? (
                    <a
                      key={i}
                      className="brand-link"
                      href="https://velmren.com/"
                    >
                      VELMREN
                    </a>
                  ) : (
                    part
                  ),
                )}
            </span>
            <span>{t("about.examples")}</span>
          </footer>
        </div>
      </dialog>
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <App />
  </I18nProvider>,
);
