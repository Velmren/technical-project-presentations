// Domain model of the Northline Objects workspace.
// Generated records carry translation keys; records edited by people carry plain text.

export type Text = string | { key: string; params?: Record<string, string | number> };

export type TeamRole = "Owner" | "Manager" | "Support" | "Fulfilment" | "Finance";
export type Role = TeamRole | "Customer";
export type UserStatus = "Active" | "Invited" | "Suspended";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  joined: string; // ISO date
  region: string; // "City, CC"
  country: string; // ISO country code
  avatar: number; // palette index 0..7
  title?: Text; // team members only
  marketing?: boolean; // customers only
};

export type Category = "Lighting" | "Audio" | "Desk" | "Power" | "Carry";
export type ProductArt = "lamp" | "speaker" | "headphones" | "keyboard" | "stand" | "dock";

export type Product = {
  id: string;
  sku: string;
  name: string;
  category: Category;
  description: Text;
  price: number;
  cost: number;
  stock: number;
  reorderPoint: number;
  status: "Active" | "Draft" | "Archived";
  art: ProductArt;
  image?: string;
};

export type OrderStatus = "Processing" | "Ready" | "Shipped" | "Delivered" | "Cancelled";
export type Channel = "Web" | "App" | "Showroom";
export type ShippingMethod = "Standard" | "Express" | "Pickup";

export type OrderItem = { productId: string; quantity: number; unitPrice: number };
export type TimelineEntry = { status: OrderStatus | "Placed" | "Paid" | "Refunded"; at: string; by?: string };

export type Order = {
  id: string;
  userId: string;
  date: string; // ISO timestamp of placement
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  promo?: string;
  shipping: number;
  total: number;
  channel: Channel;
  shippingMethod: ShippingMethod;
  city: string;
  country: string;
  tracking?: string;
  timeline: TimelineEntry[];
  note?: Text;
};

export type PaymentMethod = "Card" | "Wallet" | "Transfer";
export type Payment = {
  id: string;
  orderId: string;
  date: string; // ISO timestamp
  amount: number;
  type: "Charge" | "Refund";
  status: "Paid" | "Pending" | "Failed";
  method: PaymentMethod;
  last4?: string;
  reason?: "Return" | "Damaged" | "Cancelled" | "Goodwill";
};

export type TaskStatus = "Backlog" | "In progress" | "Done";
export type Priority = "Low" | "Medium" | "High";
export type Task = {
  id: string;
  title: Text;
  description: Text;
  assigneeId: string;
  due: string; // ISO date
  created: string; // ISO timestamp
  status: TaskStatus;
  priority: Priority;
  orderId?: string;
  productId?: string;
};

export type Message = { id: string; text: Text; date: string; from: "Customer" | "Team"; authorId?: string };
export type Conversation = {
  id: string;
  userId: string;
  subject: Text;
  orderId?: string;
  unread: boolean;
  archived: boolean;
  messages: Message[];
};

export type EventKind =
  | "order.placed"
  | "order.large"
  | "order.status"
  | "order.batch"
  | "order.cancelled"
  | "payment.failed"
  | "payment.captured"
  | "payment.refunded"
  | "stock.low"
  | "stock.out"
  | "product.updated"
  | "task.created"
  | "task.done"
  | "task.updated"
  | "task.assigned"
  | "message.received"
  | "message.sent"
  | "conversation.archived"
  | "user.updated"
  | "user.invited"
  | "settings.saved";

export type EventArea = "order" | "payment" | "product" | "task" | "message" | "user" | "settings";
export type Event = {
  id: string;
  at: string;
  kind: EventKind;
  area: EventArea;
  actorId?: string;
  targetId?: string;
  params: Record<string, string | number>;
  notify?: boolean; // shown in the notification centre of the workspace owner
};

export type MotionPreference = "system" | "reduced" | "full";
export type Settings = {
  profileName: string;
  profileEmail: string;
  workspaceName: string;
  timezone: string;
  notifications: { orders: boolean; tasks: boolean; messages: boolean };
  compact: boolean;
  reducedMotion: boolean;
  motion: MotionPreference;
  defaultPeriod: Period;
};

export type Period = 7 | 30 | 90 | 365;

export type Database = {
  version: 5;
  users: User[];
  products: Product[];
  orders: Order[];
  payments: Payment[];
  tasks: Task[];
  conversations: Conversation[];
  events: Event[];
  readNotifications: string[];
  settings: Settings;
};

export type Result = { ok: true; message?: Text } | { ok: false; error: Text };
