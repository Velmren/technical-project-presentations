import { BarChart3, CheckSquare, CreditCard, LayoutDashboard, MessageSquare, Package, Settings, ShoppingBag, Users, type LucideIcon } from "lucide-react";
import type { SectionId } from "./router";

export type SectionDef = { id: SectionId; icon: LucideIcon; group: "main" | "store" | "team" | "insights" | "system"; key: string };

// "key" is the second letter of the g-then-letter shortcut.
export const sections: SectionDef[] = [
  { id: "overview", icon: LayoutDashboard, group: "main", key: "h" },
  { id: "orders", icon: ShoppingBag, group: "store", key: "o" },
  { id: "customers", icon: Users, group: "store", key: "c" },
  { id: "products", icon: Package, group: "store", key: "p" },
  { id: "payments", icon: CreditCard, group: "store", key: "y" },
  { id: "tasks", icon: CheckSquare, group: "team", key: "t" },
  { id: "messages", icon: MessageSquare, group: "team", key: "m" },
  { id: "analytics", icon: BarChart3, group: "insights", key: "a" },
  { id: "settings", icon: Settings, group: "system", key: "s" },
];
