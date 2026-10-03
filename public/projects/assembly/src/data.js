// Demo data of the quarter: houses, layouts and the flats on sale. Everything is fictional
// and derived from one place, so the figures on the page cannot disagree with each other.

// Construction schedule: quarters counted from Q4 2026. The scroll through the first screen
// runs along this axis, and each house closes on its own quarter.
export const SCHEDULE = {startYear: 2026, startQuarter: 4, quarters: 8};

// due: quarter of handover on the schedule axis; ready: share built today; lit: share of the scroll at which
// the frames show the house finished with its windows lit.
export const HOUSES = {
  club: {id: 'club', no: 3, floors: 6, total: 40, ceiling: 3.4, due: 5, ready: 0.24, lit: 0.52},
  clinker: {id: 'clinker', no: 2, floors: 9, total: 128, ceiling: 3.1, due: 7, ready: 0.12, lit: 0.76},
  tower: {id: 'tower', no: 1, floors: 21, total: 144, ceiling: 3.1, due: 8, ready: 0.09, lit: 0.97},
};
export const HOUSE_ORDER = ['club', 'clinker', 'tower'];

// Quarter index (1 is Q4 2026) to {q, year}.
export function quarter(index) {
  const n = SCHEDULE.startQuarter - 1 + index - 1;
  return {q: (n % 4) + 1, year: SCHEDULE.startYear + Math.floor(n / 4)};
}

// Layouts in metres, as rows of rooms from the window wall (top) to the entrance wall (bottom).
// k: living, bed, study, hall, bath, wc, ward. side: window on the left or right end wall.
// stack: rooms one above another inside a column. terrace / balcony: depth beyond the window wall.
const r = (k, w, extra) => ({k, w, ...extra});
export const PLANS = {
  K1: {w: 7.0, rows: [{h: 3.6, rooms: [r('living', 4.2), r('bed', 2.8)]}, {h: 1.9, rooms: [r('bath', 2.2), r('hall', 3.4), r('ward', 1.4)]}]},
  K2: {w: 7.7, balcony: 1.2, rows: [{h: 3.9, rooms: [r('living', 4.7), r('bed', 3.0)]}, {h: 2.1, rooms: [r('bath', 2.4), r('hall', 3.5), r('ward', 1.8)]}]},
  K3: {w: 9.8, rows: [{h: 3.9, rooms: [r('bed', 2.9), r('living', 4.0), r('bed', 2.9)]}, {h: 2.1, rooms: [r('bath', 1.8), r('hall', 6.1), r('ward', 1.9)]}]},
  K4: {w: 9.0, balcony: 1.2, rows: [{h: 4.4, rooms: [r('living', 5.2), r('bed', 3.8)]}, {h: 3.1, rooms: [r('bed', 3.6, {side: 'l'}), r('hall', 2.6), r(null, 2.8, {stack: [{k: 'bath', h: 1.7}, {k: 'ward', h: 1.4}]})]}]},
  K5: {w: 12.0, rows: [{h: 4.2, rooms: [r('bed', 3.0), r('living', 5.4), r('bed', 3.6)]}, {h: 2.8, rooms: [r('study', 3.2, {side: 'l'}), r('hall', 4.8), r(null, 2.0, {stack: [{k: 'bath', h: 1.6}, {k: 'wc', h: 1.2}]}), r('ward', 2.0)]}]},
  K6: {w: 12.0, balcony: 1.2, rows: [{h: 4.6, rooms: [r('bed', 3.2), r('living', 5.6), r('bed', 3.2)]}, {h: 3.4, rooms: [r('bed', 3.6, {side: 'l'}), r('hall', 4.4), r(null, 2.0, {stack: [{k: 'bath', h: 1.9}, {k: 'wc', h: 1.5}]}), r('ward', 2.0)]}]},
  T1: {w: 7.8, rows: [{h: 3.8, rooms: [r('bed', 3.0), r('living', 4.8)]}, {h: 2.2, rooms: [r('ward', 2.0), r('hall', 3.4), r('bath', 2.4)]}]},
  T2: {w: 10.0, rows: [{h: 4.2, rooms: [r('bed', 3.0), r('living', 4.2), r('bed', 2.8)]}, {h: 2.2, rooms: [r('bath', 2.0), r('hall', 5.8), r('ward', 2.2)]}]},
  T3: {w: 9.8, rows: [{h: 4.8, rooms: [r('living', 5.8), r('bed', 4.0)]}, {h: 3.2, rooms: [r('bed', 3.8, {side: 'l'}), r('hall', 3.0), r(null, 3.0, {stack: [{k: 'bath', h: 1.8}, {k: 'ward', h: 1.4}]})]}]},
  T4: {w: 12.0, rows: [{h: 4.6, rooms: [r('bed', 3.2), r('living', 5.6), r('bed', 3.2)]}, {h: 3.6, rooms: [r('study', 3.4, {side: 'l'}), r('hall', 4.4), r(null, 2.2, {stack: [{k: 'bath', h: 2.0}, {k: 'wc', h: 1.6}]}), r('ward', 2.0)]}]},
  T5: {w: 13.0, rows: [{h: 4.8, rooms: [r('bed', 3.4), r('living', 6.0), r('bed', 3.6)]}, {h: 1.5, rooms: [r('hall', 13.0)]}, {h: 3.3, rooms: [r('bed', 3.6, {side: 'l'}), r('bath', 2.4), r('hall', 2.4), r('ward', 1.8), r('study', 2.8, {side: 'r'})]}]},
  T6: {w: 16.0, terrace: 2.4, rows: [{h: 5.4, rooms: [r('bed', 4.2), r('living', 7.4), r('bed', 4.4)]}, {h: 1.6, rooms: [r('hall', 16.0)]}, {h: 3.25, rooms: [r('bed', 4.2, {side: 'l'}), r('bath', 2.8), r('wc', 1.6), r('hall', 2.6), r('ward', 2.0), r('bed', 2.8, {side: 'r'})]}]},
  C1: {w: 9.6, rows: [{h: 4.3, rooms: [r('bed', 3.0), r('living', 3.9), r('bed', 2.7)]}, {h: 2.2, rooms: [r('bath', 2.0), r('hall', 5.4), r('ward', 2.2)]}]},
  C2: {w: 10.0, rows: [{h: 4.9, rooms: [r('living', 6.0), r('bed', 4.0)]}, {h: 3.2, rooms: [r('bed', 4.0, {side: 'l'}), r('hall', 3.0), r(null, 3.0, {stack: [{k: 'bath', h: 1.8}, {k: 'ward', h: 1.4}]})]}]},
  C3: {w: 12.6, rows: [{h: 4.8, rooms: [r('bed', 3.3), r('living', 6.0), r('bed', 3.3)]}, {h: 3.5, rooms: [r('study', 3.6, {side: 'l'}), r('hall', 4.6), r(null, 2.2, {stack: [{k: 'bath', h: 2.0}, {k: 'wc', h: 1.5}]}), r('ward', 2.2)]}]},
  C4: {w: 14.0, terrace: 2.4, rows: [{h: 5.2, rooms: [r('bed', 3.8), r('living', 6.4), r('bed', 3.8)]}, {h: 1.5, rooms: [r('hall', 14.0)]}, {h: 3.15, rooms: [r('bed', 3.8, {side: 'l'}), r('bath', 2.6), r('hall', 2.4), r('ward', 2.0), r('study', 3.2, {side: 'r'})]}]},
};

// Rooms of a layout as rectangles: {k, x, y, w, h}.
export function planRooms(plan) {
  const rooms = [];
  let y = 0;
  for (const row of plan.rows) {
    let x = 0;
    for (const cell of row.rooms) {
      if (cell.stack) {
        let sy = y;
        for (const part of cell.stack) {
          rooms.push({k: part.k, x, y: sy, w: cell.w, h: part.h});
          sy += part.h;
        }
      } else {
        rooms.push({k: cell.k, x, y, w: cell.w, h: row.h, side: cell.side});
      }
      x += cell.w;
    }
    y += row.h;
  }
  return rooms;
}

export const planHeight = (plan) => plan.rows.reduce((sum, row) => sum + row.h, 0);
export const planArea = (plan) => Math.round(plan.w * planHeight(plan) * 10) / 10;

// What is on sale. ppm: thousand roubles per square metre on the second floor; count: flats of this layout listed.
const TYPES = [
  {plan: 'K1', house: 'clinker', ppm: 387, count: 14},
  {plan: 'K2', house: 'clinker', ppm: 392, count: 12},
  {plan: 'K3', house: 'clinker', ppm: 384, count: 14},
  {plan: 'K4', house: 'clinker', ppm: 388, count: 12},
  {plan: 'K5', house: 'clinker', ppm: 381, count: 8},
  {plan: 'K6', house: 'clinker', ppm: 386, count: 6},
  {plan: 'T1', house: 'tower', ppm: 452, count: 10},
  {plan: 'T2', house: 'tower', ppm: 446, count: 10},
  {plan: 'T3', house: 'tower', ppm: 455, count: 8},
  {plan: 'T4', house: 'tower', ppm: 449, count: 8},
  {plan: 'T5', house: 'tower', ppm: 462, count: 5},
  {plan: 'T6', house: 'tower', ppm: 598, count: 2},
  {plan: 'C1', house: 'club', ppm: 586, count: 6},
  {plan: 'C2', house: 'club', ppm: 592, count: 5},
  {plan: 'C3', house: 'club', ppm: 604, count: 4},
  {plan: 'C4', house: 'club', ppm: 668, count: 2},
];

const FINISH = {clinker: ['none', 'whitebox'], tower: ['whitebox', 'turnkey', 'none'], club: ['turnkey', 'none']};
const FINISH_PPM = {none: 0, whitebox: 26, turnkey: 64};
const VIEW = {clinker: ['yard', 'city', 'yard', 'water'], tower: ['water', 'city', 'yard', 'water'], club: ['water', 'yard', 'water']};
const VIEW_K = {water: 1.04, yard: 1.012, city: 1};

export const roomsOf = (plan) => planRooms(plan).filter((room) => room.k === 'bed' || room.k === 'study').length;

function buildFlats() {
  const flats = [];
  let seed = 20261003;
  const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  for (const type of TYPES) {
    const plan = PLANS[type.plan];
    const house = HOUSES[type.house];
    const area = planArea(plan);
    const rooms = roomsOf(plan);
    // The crown of the tower and the roof terrace of the club house hold the top layouts only.
    const top = plan.terrace ? house.floors - (type.house === 'tower' ? 1 : 0) : null;
    const lo = 2;
    const hi = type.house === 'tower' ? 19 : house.floors - (type.house === 'club' ? 1 : 0);
    for (let i = 0; i < type.count; i += 1) {
      const floor = top || lo + Math.floor(((i + rnd() * 0.999) / type.count) * (hi - lo + 1));
      const finish = FINISH[type.house][Math.floor(rnd() * FINISH[type.house].length)];
      const views = VIEW[type.house];
      const view = plan.terrace ? 'water' : views[Math.floor(rnd() * views.length)];
      const ppm = (type.ppm * (1 + (floor - 2) * 0.005) + FINISH_PPM[finish]) * VIEW_K[view];
      const price = Math.round(area * ppm / 10) / 100;
      flats.push({type: type.plan, house: type.house, rooms, area, floor, finish, view, price, ppm: Math.round(price * 1000 / area)});
    }
  }
  // Flat numbers: house, floor, position on the floor.
  const taken = new Set();
  for (const flat of flats) {
    let n = 1;
    let id;
    do {
      id = `${HOUSES[flat.house].no}-${String(flat.floor).padStart(2, '0')}${String(n).padStart(2, '0')}`;
      n += 1;
    } while (taken.has(id));
    taken.add(id);
    flat.id = id;
  }
  // The cheapest flat of the quarter is the anchor of every "from" price on the page.
  const first = flats.filter((flat) => flat.type === 'K1').sort((a, b) => a.floor - b.floor)[0];
  first.finish = 'none';
  first.view = 'city';
  first.floor = 2;
  first.price = 14.9;
  first.ppm = Math.round(14900 / first.area);
  return flats.sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
}

export const FLATS = buildFlats();

export const range = (list, key) => [Math.min(...list.map((item) => item[key])), Math.max(...list.map((item) => item[key]))];

// Per house: flats on sale, the "from" price rounded down to a tenth of a million, area range of its layouts.
export function houseStats(id) {
  const list = FLATS.filter((flat) => flat.house === id);
  const areas = TYPES.filter((type) => type.house === id).map((type) => planArea(PLANS[type.plan]));
  const from = Math.floor(Math.min(...list.map((flat) => flat.price)) * 10) / 10;
  return {onSale: list.length, from, areaMin: Math.min(...areas), areaMax: Math.max(...areas)};
}

// Mortgage programmes. limit: the largest loan at this rate, in million roubles; the rest goes at the base rate.
export const PROGRAMS = [
  {id: 'family', rate: 6, limit: 12, minDown: 20},
  {id: 'base', rate: 17.4, minDown: 20},
  {id: 'installment', rate: 0, minDown: 30, untilDue: true},
];

export function annuity(sum, ratePercent, months) {
  if (sum <= 0) return 0;
  const m = ratePercent / 1200;
  return m === 0 ? sum / months : (sum * m) / (1 - (1 + m) ** -months);
}

// Months from now (October 2026) to the end of a schedule quarter: the term of the developer's instalment plan.
export const monthsUntil = (dueIndex) => dueIndex * 3;

// Price in million roubles, term in months. Returns the loan in millions and the monthly payment in thousands.
export function payment(price, downPercent, months, programId) {
  const program = PROGRAMS.find((item) => item.id === programId);
  const loan = price * (1 - downPercent / 100);
  const part = program.limit ? Math.min(loan, program.limit) : loan;
  const rest = loan - part;
  const base = PROGRAMS.find((item) => item.id === 'base').rate;
  return {loan, rest, monthly: (annuity(part, program.rate, months) + annuity(rest, base, months)) * 1000};
}
