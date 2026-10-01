import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { can, canOpen, type Capability } from "../data/permissions";
import type { TeamRole } from "../data/types";
import { useI18n, type Key } from "../i18n";
import type { SectionId } from "./router";

type Access = {
  role: TeamRole;
  preview: boolean;
  setRole: (role: TeamRole) => void;
  can: (capability: Capability) => boolean;
  canOpen: (section: SectionId) => boolean;
  /** Tooltip for a control the current role can't use. */
  deniedHint: string;
};

const AccessContext = createContext<Access | null>(null);
const key = "orbit-view-as";

/**
 * "View as": the owner can look at the workspace with another role's rights.
 * Sections and actions that role can't use disappear or become unavailable.
 */
export function AccessProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [role, setRoleState] = useState<TeamRole>(() => {
    try {
      const saved = sessionStorage.getItem(key);
      return saved === "Manager" || saved === "Support" || saved === "Fulfilment" || saved === "Finance" ? saved : "Owner";
    } catch {
      return "Owner";
    }
  });
  const setRole = useCallback((next: TeamRole) => {
    setRoleState(next);
    try {
      sessionStorage.setItem(key, next);
    } catch {
      /* The preview still works until the tab closes. */
    }
  }, []);
  const value = useMemo<Access>(
    () => ({
      role,
      preview: role !== "Owner",
      setRole,
      can: (capability) => can(role, capability),
      canOpen: (section) => canOpen(role, section),
      deniedHint: t("access.denied", { role: t(`team.roles.${role}` as Key) }),
    }),
    [role, setRole, t],
  );
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const value = useContext(AccessContext);
  if (!value) throw new Error("useAccess must be used inside AccessProvider.");
  return value;
}
