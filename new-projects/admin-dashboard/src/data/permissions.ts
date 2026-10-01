import type { SectionId } from "../app/router";
import type { TeamRole } from "./types";

export const capabilities = [
  "orders.fulfil",
  "orders.cancel",
  "payments.view",
  "payments.manage",
  "customers.view",
  "customers.manage",
  "products.edit",
  "products.stock",
  "tasks.manage",
  "messages.reply",
  "analytics.view",
  "settings.workspace",
  "settings.team",
] as const;
export type Capability = (typeof capabilities)[number];

// The warehouse sees stock, finance sees money, support sees customers.
export const roleCapabilities: Record<TeamRole, readonly Capability[]> = {
  Owner: capabilities,
  Manager: ["orders.fulfil", "orders.cancel", "payments.view", "customers.view", "customers.manage", "products.edit", "products.stock", "tasks.manage", "messages.reply", "analytics.view", "settings.workspace"],
  Support: ["orders.cancel", "customers.view", "tasks.manage", "messages.reply"],
  Fulfilment: ["orders.fulfil", "products.stock", "tasks.manage"],
  Finance: ["payments.view", "payments.manage", "customers.view", "analytics.view", "tasks.manage"],
};

export const teamRoles: TeamRole[] = ["Owner", "Manager", "Support", "Fulfilment", "Finance"];

/** A section is visible when the role can do its main job there. */
export const sectionAccess: Partial<Record<SectionId, Capability>> = {
  customers: "customers.view",
  payments: "payments.view",
  messages: "messages.reply",
  analytics: "analytics.view",
  tasks: "tasks.manage",
};

export const can = (role: TeamRole, capability: Capability) => roleCapabilities[role].includes(capability);
export const canOpen = (role: TeamRole, section: SectionId) => {
  const needed = sectionAccess[section];
  return !needed || can(role, needed);
};
