import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bell, Database, Lock, Save, SlidersHorizontal, Store, TriangleAlert, Undo2, UserRound, Users } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useAccess } from "../../app/access";
import { blockNavigation, navigate, setQuery, type Route } from "../../app/router";
import { now } from "../../data/clock";
import { useWorkspace } from "../../data/store";
import type { Period, Settings } from "../../data/types";
import { useI18n, useLocaleState, type Key } from "../../i18n";
import { useReduced } from "../../motion/MotionPreference";
import { duration, ease, fadeUp, spring, stagger } from "../../motion/tokens";
import { Avatar } from "../../ui/Avatar";
import { Badge } from "../../ui/Badge";
import { Panel } from "../../ui/Blocks";
import { Button, cx } from "../../ui/Button";
import { Field, Input, NativeSelect } from "../../ui/Form";
import { Dialog } from "../../ui/Overlay";
import { Segmented } from "../../ui/Segmented";
import { Switch } from "../../ui/Switch";
import { RolesMatrix, TeamPanel } from "./TeamPanel";
import "./settings.css";

const tabs = ["profile", "workspace", "notifications", "team", "interface"] as const;
type Tab = (typeof tabs)[number];
const tabIcons = { profile: UserRound, workspace: Store, notifications: Bell, team: Users, interface: SlidersHorizontal };

// Which settings each tab owns, so a tab can show that it has unsaved edits.
const tabFields: Record<Tab, (keyof Settings)[]> = {
  profile: ["profileName", "profileEmail"],
  workspace: ["workspaceName", "timezone", "defaultPeriod"],
  notifications: ["notifications"],
  team: [],
  interface: ["compact", "motion"],
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const zones = [
  ["Europe/Dublin", "dublin"],
  ["Europe/London", "london"],
  ["Europe/Lisbon", "lisbon"],
  ["Europe/Berlin", "berlin"],
  ["Europe/Warsaw", "warsaw"],
  ["Europe/Helsinki", "helsinki"],
  ["America/New_York", "newYork"],
  ["Asia/Dubai", "dubai"],
] as const;
const periods: Period[] = [7, 30, 90, 365];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Errors = Partial<Record<"profileName" | "profileEmail" | "workspaceName", string>>;

export function SettingsScreen({ route }: { route: Route }) {
  const { t } = useI18n();
  const { db, dispatch } = useWorkspace();
  const reduced = useReduced();
  const tab: Tab = (tabs as readonly string[]).includes(route.query.get("tab") ?? "") ? (route.query.get("tab") as Tab) : "profile";
  const [draft, setDraft] = useState<Settings>(db.settings);
  const [errors, setErrors] = useState<Errors>({});
  const [leaving, setLeaving] = useState<string | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setDraft(db.settings);
    setErrors({});
  }, [db.settings]);

  const dirtyTabs = tabs.filter((name) => tabFields[name].some((field) => !same(draft[field], db.settings[field])));
  const dirty = dirtyTabs.length > 0;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // Leaving the section with unsaved edits asks first; closing the tab gets the browser's own prompt.
  useEffect(() => {
    blockNavigation((to) => {
      if (!dirtyRef.current) return false;
      setLeaving(to);
      return true;
    });
    return () => blockNavigation(undefined);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const hold = (event: BeforeUnloadEvent) => event.preventDefault();
    addEventListener("beforeunload", hold);
    return () => removeEventListener("beforeunload", hold);
  }, [dirty]);

  const update = (patch: Partial<Settings>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key as keyof Errors];
      return next;
    });
  };

  const validate = (value: Settings): Errors => {
    const found: Errors = {};
    const name = value.profileName.trim();
    if (name.length < 2 || name.length > 60) found.profileName = t("settings.errors.name");
    if (!emailPattern.test(value.profileEmail.trim())) found.profileEmail = t("settings.errors.email");
    const store = value.workspaceName.trim();
    if (store.length < 2 || store.length > 60) found.workspaceName = t("settings.errors.workspace");
    return found;
  };

  const save = () => {
    const found = validate(draft);
    setErrors(found);
    const failed = Object.keys(found) as (keyof Errors)[];
    if (failed.length) {
      // Show the tab with the first problem, so the message is never hidden behind another tab.
      const owner = tabs.find((name) => tabFields[name].includes(failed[0]));
      if (owner && owner !== tab) setQuery(route, { tab: owner === "profile" ? undefined : owner });
      return false;
    }
    const settings: Settings = {
      ...draft,
      profileName: draft.profileName.trim(),
      profileEmail: draft.profileEmail.trim(),
      workspaceName: draft.workspaceName.trim(),
      reducedMotion: draft.motion === "reduced",
    };
    return dispatch({ type: "settings.save", settings }).ok;
  };
  const discard = () => {
    setDraft(db.settings);
    setErrors({});
  };

  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (dirtyRef.current) saveRef.current();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const leave = (mode: "save" | "discard") => {
    const to = leaving;
    if (mode === "save" && !save()) {
      setLeaving(null);
      return;
    }
    if (mode === "discard") discard();
    setLeaving(null);
    blockNavigation(undefined);
    if (to) navigate(to);
  };

  const onTabKey = (event: KeyboardEvent, index: number) => {
    const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
    if (!delta && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + delta + tabs.length) % tabs.length;
    tabRefs.current[next]?.focus();
    setQuery(route, { tab: tabs[next] === "profile" ? undefined : tabs[next] });
  };

  return (
    <motion.div className="page settings-page" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : stagger.cards } } }}>
      <motion.header className="page-head" variants={fadeUp}>
        <div className="page-head__main">
          <h1 className="page-head__title">{t("settings.title")}</h1>
          <p className="page-head__subtitle">{t("settings.subtitle")}</p>
        </div>
      </motion.header>

      <motion.div className="settings" variants={fadeUp}>
        <nav className="settings__nav" role="tablist" aria-orientation="vertical" aria-label={t("settings.title")}>
          {tabs.map((name, index) => {
            const Icon = tabIcons[name];
            const active = name === tab;
            return (
              <button
                key={name}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`settings-tab-${name}`}
                aria-selected={active}
                aria-controls="settings-panel"
                tabIndex={active ? 0 : -1}
                className={cx("settings-tab", active && "is-active")}
                onClick={() => setQuery(route, { tab: name === "profile" ? undefined : name })}
                onKeyDown={(event) => onTabKey(event, index)}
              >
                {active && <motion.span className="settings-tab__bg" layoutId="settings-tab" transition={spring.indicator} />}
                <Icon />
                <span className="settings-tab__text">
                  <strong>{t(`settings.tabs.${name}` as Key)}</strong>
                  <small>{t(`settings.tabHints.${name}` as Key)}</small>
                </span>
                {dirtyTabs.includes(name) && <i className="settings-tab__dot" title={t("settings.save.dirty")} />}
              </button>
            );
          })}
        </nav>

        <div className="settings__panel" id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${tab}`}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              className="settings__stack"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } }}
              exit={{ opacity: 0, transition: { duration: duration.fast } }}
            >
              {tab === "profile" ? (
                <ProfilePanel draft={draft} errors={errors} update={update} />
              ) : tab === "workspace" ? (
                <WorkspacePanel draft={draft} errors={errors} update={update} />
              ) : tab === "notifications" ? (
                <NotificationsPanel draft={draft} update={update} />
              ) : tab === "team" ? (
                <>
                  <TeamPanel />
                  <RolesMatrix />
                </>
              ) : (
                <InterfacePanel draft={draft} update={update} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      <SaveBar dirty={dirty} onSave={save} onDiscard={discard} />

      <Dialog
        open={!!leaving}
        onClose={() => setLeaving(null)}
        wide
        icon={<TriangleAlert />}
        title={t("settings.leave.title")}
        actions={
          <>
            <Button variant="ghost" onClick={() => setLeaving(null)}>
              {t("settings.leave.stay")}
            </Button>
            <Button onClick={() => leave("discard")}>{t("settings.leave.discard")}</Button>
            <Button variant="primary" onClick={() => leave("save")} data-autofocus>
              {t("settings.leave.save")}
            </Button>
          </>
        }
      >
        <p>{t("settings.leave.text")}</p>
      </Dialog>
    </motion.div>
  );
}

type PanelProps = { draft: Settings; errors?: Errors; update: (patch: Partial<Settings>) => void };

function ProfilePanel({ draft, errors = {}, update }: PanelProps) {
  const { t, fullDate } = useI18n();
  const { indexes } = useWorkspace();
  const me = indexes.users.get("USR-001");
  return (
    <Panel animate={false} title={t("settings.tabs.profile")} subtitle={t("settings.profile.text")}>
      <div className="settings-body settings-profile">
        <div className="settings-profile__card">
          <Avatar name={draft.profileName.trim() || "?"} tone={0} size={64} />
          <div>
            {draft.profileName.trim() && <strong>{draft.profileName.trim()}</strong>}
            <span>{draft.profileEmail}</span>
            <span className="settings-profile__meta">
              <Badge tone="accent">{t("team.roles.Owner")}</Badge>
              {me && <small>{t("settings.profile.since", { date: fullDate(me.joined) })}</small>}
            </span>
          </div>
        </div>
        <div className="settings-grid">
          <Field label={t("settings.profile.name")} error={errors.profileName}>
            {(field) => <Input {...field} value={draft.profileName} maxLength={60} autoComplete="name" onChange={(event) => update({ profileName: event.target.value })} />}
          </Field>
          <Field label={t("settings.profile.email")} error={errors.profileEmail}>
            {(field) => <Input {...field} type="email" value={draft.profileEmail} autoComplete="email" onChange={(event) => update({ profileEmail: event.target.value })} />}
          </Field>
        </div>
      </div>
    </Panel>
  );
}

function WorkspacePanel({ draft, errors = {}, update }: PanelProps) {
  const { t, locale } = useI18n();
  const access = useAccess();
  const locked = !access.can("settings.workspace");
  const clock = (zone: string) => new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: zone }).format(new Date(now()));
  const offset = (zone: string) => new Intl.DateTimeFormat("en-GB", { timeZone: zone, timeZoneName: "shortOffset" }).formatToParts(new Date(now())).find((part) => part.type === "timeZoneName")?.value ?? "";
  return (
    <Panel animate={false} title={t("settings.tabs.workspace")} subtitle={t("settings.workspace.text")}>
      <div className="settings-body">
        {locked && (
          <p className="settings-lock">
            <Lock />
            {t("settings.workspace.locked")}
          </p>
        )}
        <div className="settings-grid">
          <Field label={t("settings.workspace.name")} error={errors.workspaceName} hint={t("settings.workspace.nameHint")}>
            {(field) => <Input {...field} value={draft.workspaceName} maxLength={60} disabled={locked} onChange={(event) => update({ workspaceName: event.target.value })} />}
          </Field>
          <Field label={t("settings.workspace.timezone")} hint={t("settings.workspace.timezoneHint", { time: clock(draft.timezone) })}>
            {(field) => (
              <NativeSelect
                {...field}
                value={draft.timezone}
                disabled={locked}
                onChange={(event) => update({ timezone: event.target.value })}
                options={zones.map(([zone, key]) => ({ value: zone, label: `${t(`settings.zones.${key}` as Key)} (${offset(zone)})` }))}
              />
            )}
          </Field>
        </div>
        <div className="settings-row">
          <div className="settings-row__text">
            <p className="settings-row__label">{t("settings.workspace.period")}</p>
            <p className="settings-row__hint">{t("settings.workspace.periodHint")}</p>
          </div>
          <Segmented<Period>
            label={t("settings.workspace.period")}
            value={draft.defaultPeriod}
            onChange={(value) => !locked && update({ defaultPeriod: value })}
            options={periods.map((value) => ({ value, label: t(`period.span.d${value}` as Key) }))}
          />
        </div>
        <div className="settings-row">
          <div className="settings-row__text">
            <p className="settings-row__label">{t("settings.workspace.currency")}</p>
            <p className="settings-row__hint">{t("settings.workspace.currencyHint")}</p>
          </div>
          <span className="settings-row__value">{t("settings.workspace.currencyValue")}</span>
        </div>
      </div>
    </Panel>
  );
}

function NotificationsPanel({ draft, update }: PanelProps) {
  const { t } = useI18n();
  const { db } = useWorkspace();
  const read = new Set(db.readNotifications);
  const waiting = { orders: 0, tasks: 0, messages: 0 };
  for (const event of db.events) {
    if (!event.notify || read.has(event.id)) continue;
    if (event.area === "task") waiting.tasks++;
    else if (event.area === "message") waiting.messages++;
    else if (event.area === "order" || event.area === "payment" || event.area === "product") waiting.orders++;
  }
  return (
    <Panel animate={false} title={t("settings.tabs.notifications")} subtitle={t("settings.notifications.text")}>
      <ul className="settings-body settings-list">
        {(["orders", "tasks", "messages"] as const).map((kind) => (
          <li key={kind} className="settings-row">
            <div className="settings-row__text">
              <p className="settings-row__label">{t(`settings.notifications.${kind}.label` as Key)}</p>
              <p className="settings-row__hint">{t(`settings.notifications.${kind}.text` as Key)}</p>
              <p className="settings-row__count">{t("settings.notifications.now", { count: waiting[kind] })}</p>
            </div>
            <Switch hideLabel label={t(`settings.notifications.${kind}.label` as Key)} checked={draft.notifications[kind]} onChange={(checked) => update({ notifications: { ...draft.notifications, [kind]: checked } })} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function InterfacePanel({ draft, update }: PanelProps) {
  const { t, number } = useI18n();
  const { locale, setLocale } = useLocaleState();
  const { storage, actions, reset } = useWorkspace();
  const system = useReducedMotion() ?? false;
  const [confirm, setConfirm] = useState(false);
  const motionHint = draft.motion === "system" ? (system ? "systemOn" : "systemOff") : draft.motion;
  return (
    <>
      <Panel animate={false} title={t("settings.tabs.interface")} subtitle={t("settings.interface.text")}>
        <div className="settings-body settings-list">
          <div className="settings-row">
            <div className="settings-row__text">
              <p className="settings-row__label">{t("settings.interface.language")}</p>
              <p className="settings-row__hint">{t("settings.interface.languageHint")}</p>
            </div>
            <Segmented
              label={t("settings.interface.language")}
              value={locale}
              onChange={setLocale}
              options={[
                { value: "ru", label: "Русский" },
                { value: "en", label: "English" },
              ]}
            />
          </div>
          <div className="settings-row">
            <div className="settings-row__text">
              <p className="settings-row__label">{t("settings.interface.density")}</p>
              <p className="settings-row__hint">{t("settings.interface.densityHint")}</p>
            </div>
            <Segmented
              label={t("settings.interface.density")}
              value={draft.compact ? "compact" : "comfortable"}
              onChange={(value) => update({ compact: value === "compact" })}
              options={(["comfortable", "compact"] as const).map((value) => ({ value, label: t(`settings.interface.densityOptions.${value}` as Key) }))}
            />
          </div>
          <div className="settings-row">
            <div className="settings-row__text">
              <p className="settings-row__label">{t("settings.interface.motion")}</p>
              <p className="settings-row__hint">{t(`settings.interface.motionHint.${motionHint}` as Key)}</p>
            </div>
            <Segmented
              label={t("settings.interface.motion")}
              value={draft.motion}
              onChange={(value) => update({ motion: value })}
              options={(["system", "reduced", "full"] as const).map((value) => ({ value, label: t(`settings.interface.motionOptions.${value}` as Key) }))}
            />
          </div>
        </div>
      </Panel>
      <Panel animate={false} title={t("settings.interface.data")}>
        <div className="settings-body">
          <div className="settings-row">
            <div className="settings-row__text">
              <p className="settings-row__hint settings-row__hint--icon">
                <Database />
                {storage === "saved" ? t("settings.interface.dataSaved", { count: number(actions) }) : t("settings.interface.dataSession")}
              </p>
            </div>
            <Button variant="danger" size="sm" icon={<Undo2 />} onClick={() => setConfirm(true)}>
              {t("settings.interface.reset")}
            </Button>
          </div>
        </div>
      </Panel>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        tone="danger"
        icon={<TriangleAlert />}
        title={t("settings.interface.resetTitle")}
        actions={
          <>
            <Button onClick={() => setConfirm(false)} data-autofocus>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirm(false);
                reset();
              }}
            >
              {t("settings.interface.resetConfirm")}
            </Button>
          </>
        }
      >
        <p>{t("settings.interface.resetText")}</p>
      </Dialog>
    </>
  );
}

function SaveBar({ dirty, onSave, onDiscard }: { dirty: boolean; onSave: () => boolean; onDiscard: () => void }) {
  const { t } = useI18n();
  const reduced = useReduced();
  return (
    <AnimatePresence>
      {dirty && (
        <motion.div
          className="bulk save-bar"
          role="region"
          aria-label={t("settings.save.dirty")}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.97, transition: { duration: duration.fast, ease: ease.in } }}
          transition={spring.pop}
        >
          <span className="save-bar__text" aria-live="polite">
            <i className="settings-tab__dot" aria-hidden="true" />
            {t("settings.save.dirty")}
          </span>
          <Button size="sm" variant="ghost" onClick={onDiscard}>
            {t("settings.save.discard")}
          </Button>
          <Button size="sm" variant="primary" icon={<Save />} onClick={onSave}>
            {t("settings.save.save")}
          </Button>
          <kbd className="ui-kbd save-bar__kbd">Ctrl S</kbd>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
