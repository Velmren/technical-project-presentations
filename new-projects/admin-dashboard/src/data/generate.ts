import { ANCHOR, DAY, HISTORY_START, TODAY, addDays, dayMs, isoDay } from "./clock";
import { countries, fulfilmentTeam, productSeeds, supportTeam, teamSeeds } from "./catalog";
import { createRandom, type Random } from "./random";
import { SEED } from "./seed";
import type {
  Conversation,
  Database,
  Event,
  Message,
  Order,
  OrderItem,
  Payment,
  PaymentMethod,
  Product,
  Settings,
  Task,
  TimelineEntry,
  User,
} from "./types";

const anchorMs = Date.parse(ANCHOR);
const round2 = (value: number) => Math.round(value * 100) / 100;
const iso = (ms: number) => new Date(ms).toISOString();
const startOfDay = (ms: number) => Math.floor(ms / DAY) * DAY;
const byDateDesc = <T extends { date: string }>(a: T, b: T) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

export const defaultSettings: Settings = {
  profileName: "Alex Morgan",
  profileEmail: "alex@northline.example",
  workspaceName: "Northline Objects",
  timezone: "Europe/Dublin",
  notifications: { orders: true, tasks: true, messages: true },
  compact: false,
  reducedMotion: false,
  motion: "system",
  defaultPeriod: 30,
};

// Orders cluster around lunch and the evening; night hours are quiet.
const hourWeights = [2, 1, 1, 1, 1, 2, 4, 7, 9, 10, 11, 12, 12, 11, 9, 8, 8, 9, 11, 13, 13, 11, 7, 4];
const hours = hourWeights.map((_, hour) => hour);
const weekdayFactor = [1.06, 1.14, 1.05, 1.0, 1.02, 0.93, 0.8]; // Sunday..Saturday

function seasonFactor(day: string) {
  if (day >= "2025-11-27" && day <= "2025-12-01") return 2.6; // Black Friday weekend
  if (day >= "2025-11-17" && day < "2025-11-27") return 1.3;
  if (day >= "2025-12-02" && day <= "2025-12-19") return 1.6;
  if (day >= "2025-12-20" && day <= "2025-12-31") return 0.85;
  const month = day.slice(5, 7);
  if (month === "01") return 0.8;
  if (month === "02") return 0.9;
  if (month === "08") return 0.86;
  if (day >= "2026-09-01") return 1.08;
  return 1;
}

function promoFor(day: string, isNew: boolean, random: Random): [string, number] | null {
  if (day >= "2025-11-27" && day <= "2025-12-01" && random.chance(0.52)) return ["BLACKFRIDAY25", 0.25];
  if (day >= "2026-09-15" && random.chance(0.12)) return ["AUTUMN15", 0.15];
  if (day >= "2026-04-01" && day <= "2026-04-30" && random.chance(0.09)) return ["SPRING10", 0.1];
  if (isNew && random.chance(0.13)) return ["WELCOME10", 0.1];
  return null;
}

// Warehouse works 07:00-16:00 UTC (08:00-17:00 in Dublin), Monday to Saturday.
function nextWorkSlot(ms: number) {
  let t = ms;
  for (let guard = 0; guard < 10; guard++) {
    const date = new Date(t);
    const hour = date.getUTCHours();
    if (date.getUTCDay() === 0) {
      t = startOfDay(t) + DAY + 7 * 3_600_000;
      continue;
    }
    if (hour < 7) return startOfDay(t) + 7 * 3_600_000;
    if (hour >= 16) {
      t = startOfDay(t) + DAY + 7 * 3_600_000;
      continue;
    }
    return t;
  }
  return t;
}

// Support answers 07:00-19:00 UTC (08:00-20:00 in Dublin), every day. A night message waits for the morning shift.
function supportHours(ms: number) {
  const hour = new Date(ms).getUTCHours();
  if (hour < 7) return startOfDay(ms) + 7 * 3_600_000 + (ms % 3_600_000);
  if (hour >= 19) return startOfDay(ms) + DAY + 7 * 3_600_000 + (ms % 3_600_000);
  return ms;
}

function courierPickup(packedMs: number) {
  // The courier collects at 15:00 UTC. Parcels packed later leave on the next working day.
  const day = startOfDay(packedMs);
  const cutoff = day + 14 * 3_600_000;
  let pickup = packedMs <= cutoff ? day + 15 * 3_600_000 : day + DAY + 15 * 3_600_000;
  if (new Date(pickup).getUTCDay() === 0) pickup += DAY;
  return pickup;
}

function deliveryAt(shippedMs: number, transitDays: number, random: Random) {
  let t = startOfDay(shippedMs) + (transitDays + random.int(0, 1)) * DAY + random.int(9, 17) * 3_600_000 + random.int(0, 59) * 60_000;
  if (new Date(t).getUTCDay() === 0) t += DAY;
  return t;
}

type CustomerState = { user: User; city: string; loyal: boolean; transit: number };

export function generateWorkspace(): Database {
  const random = createRandom(SEED);
  const team: User[] = teamSeeds.map((seed, index) => ({
    ...seed,
    country: seed.region.slice(-2),
    avatar: index % 8,
  }));
  const products: Product[] = productSeeds.map(({ popularity: _p, launched: _l, retired: _r, priceBefore: _b, ...rest }) => ({
    ...rest,
    description: { key: `product.desc.${rest.id}` },
  }));

  const customers: CustomerState[] = [];
  const returningPool: number[] = [];
  const emails = new Set(team.map((user) => user.email));
  let customerCounter = 10001;

  const createCustomer = (joined: string): CustomerState => {
    const country = random.weighted(countries, countries.map((c) => c.weight));
    const first = random.pick(country.first);
    const last = random.pick(country.last);
    const city = random.weighted(country.cities.map(([name]) => name), country.cities.map(([, weight]) => weight));
    const handle = (first + "." + last).toLowerCase().replace(/[^a-z.]/g, "");
    const domains = ["example.com", "example.net", "example.org", "mail.example"];
    let email = `${handle}@${random.pick(domains)}`;
    for (let n = 2; emails.has(email); n++) email = `${handle}${n}@${random.pick(domains)}`;
    emails.add(email);
    const user: User = {
      id: `USR-${customerCounter++}`,
      name: `${first} ${last}`,
      email,
      role: "Customer",
      status: random.chance(0.003) ? "Suspended" : "Active",
      joined,
      region: `${city}, ${country.code}`,
      country: country.code,
      avatar: random.int(0, 7),
      marketing: random.chance(0.58),
    };
    const state = { user, city, loyal: random.chance(0.22), transit: country.days };
    customers.push(state);
    return state;
  };

  const orders: Order[] = [];
  const payments: Payment[] = [];
  let orderCounter = 10001;
  let paymentCounter = 40001;
  let refundCounter = 7001;
  const startMs = dayMs(HISTORY_START);
  const totalDays = Math.round((dayMs(TODAY) - startMs) / DAY) + 1;

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
    const dayStart = startMs + dayIndex * DAY;
    const day = isoDay(dayStart);
    const progress = dayIndex / (totalDays - 1);
    const lambda = (15 + 22 * Math.pow(progress, 1.15)) * weekdayFactor[new Date(dayStart).getUTCDay()] * seasonFactor(day);
    const count = random.poisson(lambda);

    // Accounts created without a purchase: newsletter sign-ups and saved carts.
    const signups = random.poisson(lambda * 0.12);
    for (let s = 0; s < signups; s++) createCustomer(day);

    const eligible = productSeeds.filter((p) => p.status !== "Draft" && p.launched <= day && (!p.retired || p.retired > day));
    const returningShare = 0.24 + 0.26 * progress;
    const times = Array.from({ length: count }, () => dayStart + random.weighted(hours, hourWeights) * 3_600_000 + random.int(0, 3599) * 1000).sort((a, b) => a - b);

    for (const placedMs of times) {
      if (placedMs > anchorMs) continue;
      const returning = customers.length > 40 && returningPool.length > 0 && random.chance(returningShare);
      let customer: CustomerState;
      let isNew = false;
      if (returning) customer = customers[random.pick(returningPool)];
      else {
        const joined = random.chance(0.3) ? addDays(day, -random.int(1, 45)) : day;
        customer = createCustomer(joined < HISTORY_START ? HISTORY_START : joined);
        isNew = true;
        const index = customers.length - 1;
        returningPool.push(index);
        if (customer.loyal) returningPool.push(index, index, index, index);
      }
      if (customer.user.status === "Suspended") continue;

      const lines = random.weighted([1, 2, 3], [70, 24, 6]);
      const items: OrderItem[] = [];
      for (let l = 0; l < lines; l++) {
        const seed = random.weighted(eligible, eligible.map((p) => p.popularity));
        if (items.some((item) => item.productId === seed.id)) continue;
        const price = seed.priceBefore && day < seed.priceBefore.until ? seed.priceBefore.price : seed.price;
        items.push({ productId: seed.id, quantity: random.weighted([1, 2, 3], [92, 7, 1]), unitPrice: price });
      }
      const subtotal = round2(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
      const promo = promoFor(day, isNew, random);
      const discount = promo ? round2(subtotal * promo[1]) : 0;
      const local = customer.user.country === "IE" || customer.user.country === "GB";
      const pickup = customer.city === "Dublin" && random.chance(0.22);
      const shippingMethod = pickup ? "Pickup" : random.chance(0.14) ? "Express" : "Standard";
      const shipping = shippingMethod === "Pickup" ? 0 : shippingMethod === "Express" ? (local ? 9.9 : 14.9) : subtotal - discount >= 100 ? 0 : local ? 6.9 : 9.9;
      const total = round2(subtotal - discount + shipping);
      const channel = pickup && random.chance(0.4) ? "Showroom" : random.chance(0.33) ? "App" : "Web";
      const id = `NL-${orderCounter++}`;
      const placed = iso(placedMs);
      const timeline: TimelineEntry[] = [{ status: "Placed", at: placed }];
      const method: PaymentMethod = random.weighted<PaymentMethod>(["Card", "Wallet", "Transfer"], [68, 22, 10]);
      const last4 = method === "Transfer" ? undefined : String(random.int(1000, 9999));
      const ageHours = (anchorMs - placedMs) / 3_600_000;

      let paidMs: number | null = method === "Transfer" ? placedMs + random.int(5, 60) * 3_600_000 : placedMs + random.int(20, 180) * 1000;
      const failedAttempt = method !== "Transfer" && random.chance(ageHours < 40 ? 0.08 : 0.03);
      if (failedAttempt) {
        payments.push({ id: `PAY-${paymentCounter++}`, orderId: id, date: iso(placedMs + 60_000), amount: total, type: "Charge", status: "Failed", method, last4 });
        // Most customers retry with another card; a few recent ones haven't yet.
        paidMs = ageHours < 40 && random.chance(0.8) ? null : placedMs + random.int(10, 240) * 60_000;
      }
      if (paidMs !== null && paidMs > anchorMs) paidMs = null;
      if (!(failedAttempt && paidMs === null)) {
        payments.push({ id: `PAY-${paymentCounter++}`, orderId: id, date: iso(paidMs ?? placedMs + 90_000), amount: total, type: "Charge", status: paidMs !== null ? "Paid" : "Pending", method, last4 });
      }

      let status: Order["status"] = "Processing";
      let tracking: string | undefined;
      const cancelled = random.chance(0.021);
      if (paidMs !== null) {
        timeline.push({ status: "Paid", at: iso(paidMs) });
        const packer = random.pick(fulfilmentTeam);
        const cancelMs = placedMs + random.int(1, 26) * 3_600_000;
        const packedMs = nextWorkSlot(paidMs + random.int(40, 600) * 60_000);
        if (cancelled && cancelMs < packedMs && cancelMs <= anchorMs) {
          status = "Cancelled";
          timeline.push({ status: "Cancelled", at: iso(cancelMs), by: random.pick(supportTeam) });
          payments.push({ id: `REF-${refundCounter++}`, orderId: id, date: iso(cancelMs + 20 * 60_000), amount: total, type: "Refund", status: "Paid", method, last4, reason: "Cancelled" });
        } else if (packedMs <= anchorMs) {
          status = "Ready";
          timeline.push({ status: "Ready", at: iso(packedMs), by: packer });
          const shippedMs = shippingMethod === "Pickup" ? null : courierPickup(packedMs);
          if (shippedMs !== null && shippedMs <= anchorMs) {
            status = "Shipped";
            tracking = `NLX${String(random.int(100000000, 999999999))}`;
            timeline.push({ status: "Shipped", at: iso(shippedMs), by: packer });
            const deliveredMs = deliveryAt(shippedMs, shippingMethod === "Express" ? Math.max(1, customer.transit - 1) : customer.transit, random);
            if (deliveredMs <= anchorMs) {
              status = "Delivered";
              timeline.push({ status: "Delivered", at: iso(deliveredMs) });
            }
          } else if (shippedMs === null) {
            const collectedMs = packedMs + random.int(4, 80) * 3_600_000;
            if (collectedMs <= anchorMs) {
              status = "Delivered";
              timeline.push({ status: "Delivered", at: iso(collectedMs) });
            }
          }
        }
      } else if (cancelled && ageHours > 20) {
        status = "Cancelled";
        timeline.push({ status: "Cancelled", at: iso(placedMs + random.int(18, 30) * 3_600_000), by: random.pick(supportTeam) });
      }

      // Returns arrive a few days after delivery and are refunded by support or finance.
      const delivered = timeline.find((entry) => entry.status === "Delivered");
      if (delivered && random.chance(0.034)) {
        const refundMs = startOfDay(Date.parse(delivered.at)) + random.int(3, 18) * DAY + random.int(8, 15) * 3_600_000 + random.int(0, 59) * 60_000;
        if (refundMs <= anchorMs) {
          const damaged = random.chance(0.22);
          const item = random.pick(items);
          const amount = damaged ? round2(item.unitPrice * 0.3) : round2(Math.min(total, item.unitPrice * item.quantity * (1 - (promo?.[1] ?? 0))));
          const by = random.pick(["USR-004", "USR-010", "USR-013"]);
          payments.push({ id: `REF-${refundCounter++}`, orderId: id, date: iso(refundMs), amount, type: "Refund", status: "Paid", method, last4, reason: damaged ? "Damaged" : "Return" });
          timeline.push({ status: "Refunded", at: iso(refundMs), by });
        }
      }

      const noteRoll = random.next();
      const note =
        noteRoll < 0.035 ? { key: "order.note.gift" } :
        noteRoll < 0.06 ? { key: "order.note.reception" } :
        noteRoll < 0.075 ? { key: "order.note.call" } :
        noteRoll < 0.085 ? { key: "order.note.neighbour" } : undefined;

      orders.push({
        id,
        userId: customer.user.id,
        date: placed,
        status,
        items,
        subtotal,
        discount,
        promo: promo?.[0],
        shipping,
        total,
        channel,
        shippingMethod,
        city: customer.city,
        country: customer.user.country,
        tracking,
        timeline,
        note,
      });
    }
  }

  const users: User[] = [...team, ...customers.map((state) => state.user)];
  orders.reverse();
  payments.sort(byDateDesc);
  const byId = new Map(users.map((user) => [user.id, user]));
  const tasks = generateTasks(random, orders, payments, products, byId);
  const conversations = generateConversations(random, orders, byId, products);
  const events = generateEvents(orders, payments, products, tasks, conversations, byId);
  const readNotifications = events.filter((event) => event.notify && Date.parse(event.at) < anchorMs - 20 * 3_600_000).map((event) => event.id);

  return { version: 5, users, products, orders, payments, tasks, conversations, events, readNotifications, settings: { ...defaultSettings, notifications: { ...defaultSettings.notifications } } };
}

function generateTasks(random: Random, orders: Order[], payments: Payment[], products: Product[], users: Map<string, User>): Task[] {
  const tasks: Task[] = [];
  let counter = 1;
  const add = (task: Omit<Task, "id">) => tasks.push({ ...task, id: `TSK-${String(counter++).padStart(3, "0")}` });
  const customerName = (order: Order) => users.get(order.userId)?.name ?? "";
  const byOrder = new Map<string, Payment[]>();
  for (const payment of payments) byOrder.set(payment.orderId, [...(byOrder.get(payment.orderId) ?? []), payment]);
  const has = (order: Order, status: Payment["status"]) => (byOrder.get(order.id) ?? []).some((p) => p.type === "Charge" && p.status === status);

  // Open work that follows directly from the current state of orders and stock.
  const open = orders.filter((order) => order.status === "Processing");
  const failed = open.filter((order) => has(order, "Failed") && !has(order, "Paid"));
  failed.slice(0, 4).forEach((order, index) =>
    add({ title: { key: "task.t.failedPayment", params: { order: order.id, customer: customerName(order) } }, description: { key: "task.d.failedPayment" }, assigneeId: supportTeam[index % supportTeam.length], due: TODAY, created: order.date, status: index === 0 ? "In progress" : "Backlog", priority: "High", orderId: order.id }),
  );
  const pending = open.filter((order) => has(order, "Pending"));
  pending.slice(-2).forEach((order) =>
    add({ title: { key: "task.t.transfer", params: { order: order.id } }, description: { key: "task.d.transfer" }, assigneeId: "USR-010", due: addDays(TODAY, 1), created: order.date, status: "Backlog", priority: "Medium", orderId: order.id }),
  );
  for (const product of products.filter((p) => p.status === "Active" && p.stock <= p.reorderPoint)) {
    add({ title: { key: product.stock === 0 ? "task.t.outOfStock" : "task.t.reorder", params: { product: product.name, stock: product.stock } }, description: { key: "task.d.reorder", params: { point: product.reorderPoint } }, assigneeId: "USR-002", due: product.stock === 0 ? TODAY : addDays(TODAY, 2), created: iso(anchorMs - random.int(2, 30) * 3_600_000), status: product.stock === 0 ? "In progress" : "Backlog", priority: product.stock === 0 ? "High" : "Medium", productId: product.id });
  }
  const express = open.filter((order) => order.shippingMethod === "Express" && has(order, "Paid"));
  if (express.length) add({ title: { key: "task.t.express", params: { count: express.length } }, description: { key: "task.d.express" }, assigneeId: "USR-007", due: TODAY, created: iso(dayMs(TODAY) + 7 * 3_600_000), status: "In progress", priority: "High" });
  const damaged = payments.filter((p) => p.reason === "Damaged").slice(0, 2);
  damaged.forEach((refund) => add({ title: { key: "task.t.damage", params: { order: refund.orderId } }, description: { key: "task.d.damage" }, assigneeId: "USR-013", due: addDays(refund.date.slice(0, 10), 3), created: refund.date, status: refund.date.slice(0, 10) > addDays(TODAY, -3) ? "Backlog" : "Done", priority: "Medium", orderId: refund.orderId }));

  const projects: [string, string, number, "Backlog" | "In progress", "Low" | "Medium" | "High"][] = [
    ["halo", "USR-003", 4, "In progress", "Medium"],
    ["blackFriday", "USR-011", 12, "Backlog", "High"],
    ["matGuide", "USR-003", 9, "Backlog", "Low"],
    ["onboardIsla", "USR-004", 2, "In progress", "Medium"],
    ["returnsCopy", "USR-004", 6, "Backlog", "Low"],
    ["backpackPreorder", "USR-011", 7, "Backlog", "Medium"],
    ["arcMini", "USR-003", 1, "In progress", "High"],
    ["vatReport", "USR-010", 3, "Backlog", "High"],
    ["carrierRates", "USR-002", 10, "Backlog", "Medium"],
    ["giftWrap", "USR-011", 16, "Backlog", "Low"],
  ];
  for (const [key, assigneeId, dueIn, status, priority] of projects) add({ title: { key: `task.t.${key}` }, description: { key: `task.d.${key}` }, assigneeId, due: addDays(TODAY, dueIn), created: iso(anchorMs - random.int(2, 20) * DAY), status, priority });

  // Completed routine work over the last twelve weeks.
  const routines: [string, string, number][] = [
    ["payouts", "USR-010", 7],
    ["stockCount", "USR-007", 7],
    ["returnsBatch", "USR-013", 3],
    ["inboxZero", "USR-005", 4],
    ["photoBatch", "USR-003", 14],
    ["newsletter", "USR-011", 14],
  ];
  for (const [key, assigneeId, every] of routines) {
    for (let offset = 84; offset > 0; offset -= every) {
      const due = addDays(TODAY, -offset + random.int(0, 1));
      add({ title: { key: `task.t.${key}` }, description: { key: `task.d.${key}` }, assigneeId, due, created: iso(dayMs(due) - random.int(2, 5) * DAY + 9 * 3_600_000), status: "Done", priority: random.weighted(["Low", "Medium", "High"], [3, 5, 2]) });
    }
  }
  for (const key of ["payouts", "stockCount"] as const) {
    add({ title: { key: `task.t.${key}` }, description: { key: `task.d.${key}` }, assigneeId: key === "payouts" ? "USR-010" : "USR-007", due: addDays(TODAY, key === "payouts" ? 3 : 4), created: iso(anchorMs - DAY), status: "Backlog", priority: "Medium" });
  }
  return tasks.sort((a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : 0));
}

type Topic = "delivery" | "address" | "product" | "return" | "damaged" | "invoice" | "gift";

function generateConversations(random: Random, orders: Order[], users: Map<string, User>, products: Product[]): Conversation[] {
  const conversations: Conversation[] = [];
  const recent = orders.filter((order) => Date.parse(order.date) > anchorMs - 62 * DAY);
  let messageCounter = 1;
  const productName = (order: Order) => products.find((p) => p.id === order.items[0].productId)?.name ?? "";
  const topics: Topic[] = ["delivery", "address", "product", "return", "damaged", "invoice", "gift"];
  const weights = [30, 8, 18, 14, 6, 12, 6];
  const picked = recent.filter(() => random.chance(0.085));

  let conversationCounter = 1;
  picked.forEach((order) => {
    const topic = random.weighted(topics, weights);
    const customer = users.get(order.userId)!;
    const first = customer.name.split(" ")[0];
    const orderMs = Date.parse(order.date);
    const startMs = Math.max(orderMs + 60_000, Math.min(orderMs + random.int(2, 72) * 3_600_000, anchorMs - random.int(8, 900) * 60_000));
    const ageHours = (anchorMs - startMs) / 3_600_000;
    const params = { order: order.id, first, product: productName(order), tracking: order.tracking ?? "", city: order.city };
    const agent = random.pick(supportTeam);
    const messages: Message[] = [];
    // A reply that would land after "now" hasn't been written yet, so the thread simply ends earlier.
    const push = (key: string, from: Message["from"], at: number) => {
      const when = from === "Team" ? supportHours(at) : at;
      if (when > anchorMs - 60_000) return 0;
      messages.push({ id: `MSG-${String(messageCounter++).padStart(5, "0")}`, text: { key: `msg.${topic}.${key}`, params }, date: iso(when), from, authorId: from === "Team" ? agent : undefined });
      return when;
    };

    const waiting = ageHours < 30 && random.chance(0.5);
    if (!push("q", "Customer", startMs)) return;
    const answered = !waiting || random.chance(0.35) ? push("a", "Team", startMs + random.int(12, 190) * 60_000) : 0;
    if (answered) {
      const followUp = random.chance(0.55) ? push("q2", "Customer", Math.max(startMs + random.int(4, 20) * 3_600_000, answered + random.int(20, 90) * 60_000)) : 0;
      if (followUp && !waiting) push("a2", "Team", followUp + random.int(15, 160) * 60_000);
    }
    const last = messages.at(-1)!;
    const unread = last.from === "Customer" && ageHours < 48;
    conversations.push({
      id: `CON-${String(conversationCounter++).padStart(4, "0")}`,
      userId: customer.id,
      subject: { key: `msg.${topic}.subject`, params },
      orderId: order.id,
      unread,
      archived: !unread && ageHours > 24 * 6 && random.chance(0.85),
      messages: messages.sort((a, b) => (a.date < b.date ? -1 : 1)),
    });
  });
  return conversations.sort((a, b) => (a.messages.at(-1)!.date < b.messages.at(-1)!.date ? 1 : -1));
}

function generateEvents(orders: Order[], payments: Payment[], products: Product[], tasks: Task[], conversations: Conversation[], users: Map<string, User>): Event[] {
  const events: Omit<Event, "id">[] = [];
  const since = iso(anchorMs - 8 * DAY);
  const recent = (at: string) => at >= since && at <= ANCHOR;
  const name = (id: string) => users.get(id)?.name ?? "";

  for (const order of orders) {
    if (!recent(order.date)) continue;
    if (order.total >= 360) events.push({ at: order.date, kind: "order.large", area: "order", targetId: order.id, params: { order: order.id, customer: name(order.userId), total: order.total }, notify: true });
    const cancel = order.timeline.find((entry) => entry.status === "Cancelled");
    if (cancel && recent(cancel.at)) events.push({ at: cancel.at, kind: "order.cancelled", area: "order", actorId: cancel.by, targetId: order.id, params: { order: order.id } });
  }
  // Packing and shipping batches: one entry per day and person, like the warehouse scanner reports them.
  for (const status of ["Ready", "Shipped"] as const) {
    const batches = new Map<string, { at: string; count: number; by: string }>();
    for (const order of orders) {
      const entry = order.timeline.find((item) => item.status === status);
      if (!entry || !recent(entry.at) || !entry.by) continue;
      const key = entry.at.slice(0, 10) + entry.by;
      const current = batches.get(key);
      batches.set(key, { at: current && current.at > entry.at ? current.at : entry.at, by: entry.by, count: (current?.count ?? 0) + 1 });
    }
    for (const batch of batches.values()) if (batch.count > 1) events.push({ at: batch.at, kind: "order.batch", area: "order", actorId: batch.by, params: { count: batch.count, status } });
  }

  const orderById = new Map(orders.map((order) => [order.id, order]));
  for (const payment of payments) {
    if (!recent(payment.date)) continue;
    const order = orderById.get(payment.orderId);
    if (payment.status === "Failed" && payment.type === "Charge") events.push({ at: payment.date, kind: "payment.failed", area: "payment", targetId: payment.orderId, params: { order: payment.orderId, amount: payment.amount, customer: order ? name(order.userId) : "" }, notify: true });
    if (payment.type === "Refund" && payment.reason !== "Cancelled") {
      const by = order?.timeline.find((entry) => entry.status === "Refunded")?.by;
      events.push({ at: payment.date, kind: "payment.refunded", area: "payment", actorId: by, targetId: payment.orderId, params: { order: payment.orderId, amount: payment.amount } });
    }
  }
  for (const product of products) {
    if (product.status !== "Active") continue;
    if (product.stock === 0) events.push({ at: "2026-09-26T15:12:00Z", kind: "stock.out", area: "product", targetId: product.id, params: { product: product.name }, notify: true });
    else if (product.stock <= product.reorderPoint) events.push({ at: iso(anchorMs - (product.stock + 3) * 3_600_000), kind: "stock.low", area: "product", targetId: product.id, params: { product: product.name, stock: product.stock }, notify: true });
  }
  for (const task of tasks) {
    if (task.status === "Done" && recent(task.due + "T15:30:00Z")) events.push({ at: task.due + "T15:30:00Z", kind: "task.done", area: "task", actorId: task.assigneeId, targetId: task.id, params: { task: task.id } });
    if (task.status !== "Done" && recent(task.created)) events.push({ at: task.created, kind: "task.created", area: "task", actorId: task.assigneeId === "USR-001" ? "USR-002" : "USR-001", targetId: task.id, params: { task: task.id, assignee: name(task.assigneeId) }, notify: task.assigneeId === "USR-001" });
  }
  for (const conversation of conversations) {
    const last = conversation.messages.at(-1)!;
    if (last.from === "Customer" && recent(last.date)) events.push({ at: last.date, kind: "message.received", area: "message", actorId: conversation.userId, targetId: conversation.id, params: { customer: name(conversation.userId), conversation: conversation.id }, notify: conversation.unread });
  }
  events.push({ at: "2026-09-25T09:04:00Z", kind: "user.invited", area: "user", actorId: "USR-001", targetId: "USR-006", params: { user: "Isla Reed" } });
  return events
    .filter((event) => event.at <= ANCHOR)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .map((event, index, list) => ({ ...event, id: `EVT-${String(list.length - index).padStart(5, "0")}` }));
}
