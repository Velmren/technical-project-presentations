import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apply, type Action, type LoggedAction } from "./actions";
import { now } from "./clock";
import { SEED } from "./seed";
import { buildIndexes, type Indexes } from "./indexes";
import type { Database, Result, Text } from "./types";

const storageKey = "orbit-workspace-v5";
export const CURRENT_USER = "USR-001";

type Saved = { version: 5; seed: number; actions: LoggedAction[] };

function readLog(): { actions: LoggedAction[]; blocked: boolean } {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { actions: [], blocked: false };
    const saved = JSON.parse(raw) as Partial<Saved>;
    if (saved.version !== 5 || saved.seed !== SEED || !Array.isArray(saved.actions)) return { actions: [], blocked: false };
    const actions = saved.actions.filter((a): a is LoggedAction => typeof a === "object" && a !== null && typeof a.type === "string" && typeof a.uid === "string" && typeof a.at === "string");
    return { actions, blocked: false };
  } catch {
    return { actions: [], blocked: true };
  }
}

function writeLog(actions: LoggedAction[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ version: 5, seed: SEED, actions } satisfies Saved));
    return true;
  } catch {
    return false;
  }
}

function replay(base: Database, actions: LoggedAction[]) {
  let db = base;
  const kept: LoggedAction[] = [];
  for (const action of actions) {
    try {
      const outcome = apply(db, action);
      if (outcome.result.ok) {
        db = outcome.db;
        kept.push(action);
      }
    } catch {
      /* A malformed saved action is skipped; the rest of the log still applies. */
    }
  }
  return { db, kept, dropped: actions.length - kept.length };
}

export function nextId(db: Database, prefix: "TSK" | "MSG" | "REF" | "PAY" | "USR") {
  const ids =
    prefix === "TSK" ? db.tasks.map((t) => t.id) :
    prefix === "MSG" ? db.conversations.flatMap((c) => c.messages.map((m) => m.id)) :
    // Team members use short numbers; customers start at USR-10001.
    prefix === "USR" ? db.users.filter((u) => u.role !== "Customer").map((u) => u.id) :
    db.payments.map((p) => p.id);
  const max = ids.reduce((highest, id) => (id.startsWith(prefix + "-") ? Math.max(highest, Number(id.slice(prefix.length + 1)) || 0) : highest), 0);
  const width = prefix === "TSK" || prefix === "USR" ? 3 : prefix === "MSG" ? 5 : 4;
  return `${prefix}-${String(max + 1).padStart(width, "0")}`;
}

export type Toast = { id: number; text: Text; kind: "success" | "error" | "info"; undo?: string };

type StoreValue = {
  ready: boolean;
  db: Database | null;
  indexes: Indexes | null;
  storage: "saved" | "session";
  /** How many changes this browser has recorded on top of the generated data. */
  actions: number;
  recovered: boolean;
  dispatch: (action: Action, options?: { silent?: boolean }) => Result;
  undo: (uid: string) => void;
  reset: () => void;
};

type ToastValue = { toasts: Toast[]; notify: (text: Text, kind?: Toast["kind"], undo?: string) => void; dismiss: (id: number) => void };

const StoreContext = createContext<StoreValue | null>(null);
const ToastContext = createContext<ToastValue | null>(null);

async function loadBase(): Promise<Database> {
  try {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    return await new Promise<Database>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<Database>) => {
        resolve(event.data);
        worker.terminate();
      };
      worker.onerror = (error) => {
        worker.terminate();
        reject(error);
      };
    });
  } catch {
    const { generateWorkspace } = await import("./generate");
    return generateWorkspace();
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ db: Database | null; log: LoggedAction[] }>({ db: null, log: [] });
  const [storage, setStorage] = useState<"saved" | "session">("saved");
  const [recovered, setRecovered] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const base = useRef<Database | null>(null);
  const live = useRef(state);
  live.current = state;
  const counter = useRef(0);
  const toastCounter = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const saved = readLog();
    if (saved.blocked) setStorage("session");
    loadBase().then((generated) => {
      if (cancelled) return;
      base.current = generated;
      const restored = replay(generated, saved.actions);
      if (restored.dropped) {
        setRecovered(true);
        writeLog(restored.kept);
      }
      setState({ db: restored.db, log: restored.kept });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const notify = useCallback<ToastValue["notify"]>((text, kind = "success", undo) => {
    const id = ++toastCounter.current;
    setToasts((list) => [...list.slice(-2), { id, text, kind, undo }]);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);

  const commit = useCallback((db: Database, log: LoggedAction[]) => {
    live.current = { db, log };
    setState(live.current);
    setStorage(writeLog(log) ? "saved" : "session");
  }, []);

  const dispatch = useCallback<StoreValue["dispatch"]>(
    (action, options) => {
      const current = live.current;
      if (!current.db) return { ok: false, error: { key: "errors.generic" } };
      const logged = { ...action, uid: `${Date.now().toString(36)}${(++counter.current).toString(36)}`, at: now(), actor: CURRENT_USER } as LoggedAction;
      let outcome;
      try {
        outcome = apply(current.db, logged);
      } catch {
        outcome = { db: current.db, result: { ok: false as const, error: { key: "errors.generic" } } };
      }
      if (!outcome.result.ok) {
        if (!options?.silent) notify(outcome.result.error, "error");
        return outcome.result;
      }
      if (outcome.db !== current.db) commit(outcome.db, [...current.log, logged]);
      if (outcome.result.message && !options?.silent) notify(outcome.result.message, "success", outcome.undoable ? logged.uid : undefined);
      return outcome.result;
    },
    [commit, notify],
  );

  const undo = useCallback(
    (uid: string) => {
      if (!base.current) return;
      const remaining = live.current.log.filter((action) => action.uid !== uid);
      const restored = replay(base.current, remaining);
      commit(restored.db, restored.kept);
      notify({ key: "common.undone" }, "info");
    },
    [commit, notify],
  );

  const reset = useCallback(() => {
    if (!base.current) return;
    commit(base.current, []);
    notify({ key: "toast.reset" }, "info");
  }, [commit, notify]);

  const indexes = useMemo(() => (state.db ? buildIndexes(state.db) : null), [state.db]);
  const value = useMemo<StoreValue>(
    () => ({ ready: !!state.db, db: state.db, indexes, storage, actions: state.log.length, recovered, dispatch, undo, reset }),
    [state.db, state.log.length, indexes, storage, recovered, dispatch, undo, reset],
  );
  const toastValue = useMemo(() => ({ toasts, notify, dismiss }), [toasts, notify, dismiss]);

  return (
    <StoreContext.Provider value={value}>
      <ToastContext.Provider value={toastValue}>{children}</ToastContext.Provider>
    </StoreContext.Provider>
  );
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside StoreProvider.");
  return store;
}

/** For components that only render once the workspace has loaded. */
export function useWorkspace() {
  const store = useStore();
  if (!store.db || !store.indexes) throw new Error("The workspace is not loaded yet.");
  return { ...store, db: store.db, indexes: store.indexes };
}

export function useToasts() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToasts must be used inside StoreProvider.");
  return value;
}
