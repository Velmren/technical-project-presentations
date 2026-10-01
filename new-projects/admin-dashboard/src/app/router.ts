import { useEffect, useState } from "react";

export const sectionIds = ["overview", "orders", "customers", "products", "payments", "analytics", "tasks", "messages", "settings"] as const;
export type SectionId = (typeof sectionIds)[number];
export type Route = { section: SectionId | "home"; id?: string; query: URLSearchParams };

// Links from the previous version used "#users"; they still open the right place.
const aliases: Record<string, SectionId> = { users: "customers" };

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, "");
  const [path, search = ""] = raw.split("?");
  const [first = "", id] = path.split("/").map(decodeURIComponent);
  const name = aliases[first] ?? first;
  const section = (sectionIds as readonly string[]).includes(name) ? (name as SectionId) : "home";
  return { section, id: section === "home" ? undefined : id || undefined, query: new URLSearchParams(search) };
}

export function formatRoute(section: SectionId | "home", id?: string, query?: URLSearchParams | Record<string, string | undefined>) {
  if (section === "home") return "#/";
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(Object.entries(query ?? {}).filter((entry): entry is [string, string] => !!entry[1]));
  const search = params.toString();
  return `#/${section}${id ? "/" + encodeURIComponent(id) : ""}${search ? "?" + search : ""}`;
}

export function navigate(to: string, options: { replace?: boolean } = {}) {
  if (location.hash === to) return;
  // Asking before the hash changes keeps the history free of entries the user never visited.
  if (blocker && parseHash(to).section !== parseHash(location.hash).section && blocker(to)) return;
  if (options.replace) {
    history.replaceState(history.state, "", to);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else location.hash = to;
}

/**
 * A screen with unsaved changes can hold navigation to another section.
 * The blocker gets the target and returns true to stay; it then asks the user and calls navigate() itself.
 * Links, the back button and navigate() all pass through the same hashchange check.
 */
type Blocker = (to: string) => boolean;
let blocker: Blocker | undefined;
let settled = typeof location === "undefined" ? "" : location.hash;

export function blockNavigation(next?: Blocker) {
  blocker = next;
}

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", (event) => {
    const to = location.hash;
    if (blocker && parseHash(to).section !== parseHash(settled).section && blocker(to)) {
      event.stopImmediatePropagation();
      history.replaceState(history.state, "", settled || "#/");
      return;
    }
    settled = to;
  });
}

export function useRoute() {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const update = () => setRoute(parseHash(location.hash));
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return route;
}

/** Updates query parameters of the current route without adding history entries. */
export function setQuery(route: Route, patch: Record<string, string | undefined>) {
  const query = new URLSearchParams(route.query);
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === "") query.delete(key);
    else query.set(key, value);
  }
  navigate(formatRoute(route.section, route.id, query), { replace: true });
}
