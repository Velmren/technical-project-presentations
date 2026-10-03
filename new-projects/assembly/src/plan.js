// Layout drawing: an SVG floor plan built from the room rows in data.js.
// Windows, doors and openings are derived from the geometry, so a new layout needs only its rooms.
import {PLANS, planHeight, planRooms} from './data.js';

const K = 40;        // pixels per metre inside the viewBox
const PAD = 0.45;    // margin around the outer wall, metres
const DOOR = 0.85;
const EPS = 1e-6;

const overlap = (a0, a1, b0, b1) => [Math.max(a0, b0), Math.min(a1, b1)];

function windows(plan, rooms, height) {
  const list = [];
  for (const room of rooms) {
    if (room.y < EPS) {
      if (plan.terrace) {
        list.push([room.x + 0.4, 0, room.x + room.w - 0.4, 0]);
      } else if (room.w >= 4.4) {
        const w = Math.min(1.8, (room.w - 1.6) / 2);
        for (const at of [0.27, 0.73]) list.push([room.x + room.w * at - w / 2, 0, room.x + room.w * at + w / 2, 0]);
      } else {
        const w = Math.min(1.8, room.w - 1.2);
        list.push([room.x + room.w / 2 - w / 2, 0, room.x + room.w / 2 + w / 2, 0]);
      }
    }
    if (room.side) {
      const x = room.side === 'l' ? 0 : plan.w;
      const w = Math.min(1.8, room.h - 1.0);
      list.push([x, room.y + room.h / 2 - w / 2, x, room.y + room.h / 2 + w / 2]);
    }
  }
  return list.filter((w) => w[1] <= height);
}

// Doors as {x, y, wall: 'h' | 'v', dir, width, leaf}. dir: which side the leaf opens to (+1 down or right).
function doors(plan, rooms, height) {
  const list = [];
  const halls = rooms.filter((room) => room.k === 'hall');
  const living = rooms.find((room) => room.k === 'living');
  const entry = halls.find((hall) => Math.abs(hall.y + hall.h - height) < EPS) || halls[0];
  list.push({x: entry.x + entry.w / 2, y: height, wall: 'h', width: 0.95, entrance: true});
  for (let i = 0; i < halls.length; i += 1) {
    for (let j = i + 1; j < halls.length; j += 1) {
      const a = halls[i];
      const b = halls[j];
      const [x0, x1] = overlap(a.x, a.x + a.w, b.x, b.x + b.w);
      if (Math.abs(a.y + a.h - b.y) < EPS && x1 - x0 > 1) list.push({x: (x0 + x1) / 2, y: b.y, wall: 'h', width: Math.min(1.6, x1 - x0 - 0.4)});
    }
  }
  const through = (room, other) => {
    const [x0, x1] = overlap(room.x, room.x + room.w, other.x, other.x + other.w);
    const [y0, y1] = overlap(room.y, room.y + room.h, other.y, other.y + other.h);
    if (x1 - x0 >= 0.95) {
      if (Math.abs(room.y + room.h - other.y) < EPS) return {x: (x0 + x1) / 2, y: other.y, wall: 'h', dir: -1, span: x1 - x0};
      if (Math.abs(other.y + other.h - room.y) < EPS) return {x: (x0 + x1) / 2, y: room.y, wall: 'h', dir: 1, span: x1 - x0};
    }
    if (y1 - y0 >= 0.95) {
      if (Math.abs(room.x + room.w - other.x) < EPS) return {x: other.x, y: (y0 + y1) / 2, wall: 'v', dir: -1, span: y1 - y0, y1};
      if (Math.abs(other.x + other.w - room.x) < EPS) return {x: room.x, y: (y0 + y1) / 2, wall: 'v', dir: 1, span: y1 - y0, y1};
    }
    return null;
  };
  for (const room of rooms) {
    if (room.k === 'hall') continue;
    let door = null;
    for (const hall of halls) door = door || through(room, hall);
    if (door && room.k === 'living') {
      list.push({...door, width: Math.min(1.6, door.span - 0.5), leaf: false});
      continue;
    }
    if (!door && living && room !== living) {
      door = through(room, living);
      // Next to the living room the door sits at the far end of the shared wall, by the hall.
      if (door && door.wall === 'v') door.y = door.y1 - 0.75;
    }
    if (!door) {
      const above = rooms.find((other) => other !== room && Math.abs(other.y + other.h - room.y) < EPS && overlap(room.x, room.x + room.w, other.x, other.x + other.w)[1] - overlap(room.x, room.x + room.w, other.x, other.x + other.w)[0] >= 0.95);
      if (above) door = through(room, above);
    }
    if (door) list.push({...door, width: DOOR, leaf: true});
  }
  return list;
}

/**
 * @param {string} id layout id from PLANS
 * @param {{labels?: (kind: string) => string, unit?: string, ink?: string, thin?: string, paper?: string, accent?: string, width?: number, title?: string}} opts
 *   labels: room names by kind (omit for a thumbnail); width: displayed width in CSS pixels, keeps the text size steady.
 */
export function planSvg(id, opts = {}) {
  const plan = PLANS[id];
  const height = planHeight(plan);
  const rooms = planRooms(plan);
  const out = plan.terrace || plan.balcony || 0;
  const ink = opts.ink || '#eceef1';
  const thin = opts.thin || '#8d949e';
  const paper = opts.paper || '#1a1e25';
  const accent = opts.accent || '#d9603f';
  const W = (plan.w + PAD * 2) * K;
  const H = (height + out + PAD * 2) * K;
  const px = (v) => ((v + PAD) * K).toFixed(1);
  const py = (v) => ((v + out + PAD) * K).toFixed(1);
  const len = (v) => (v * K).toFixed(1);
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" role="img" aria-label="${opts.title || ''}">`];

  if (plan.terrace) {
    parts.push(`<rect x="${px(0)}" y="${py(-plan.terrace)}" width="${len(plan.w)}" height="${len(plan.terrace)}" fill="none" stroke="${thin}" stroke-width="2" stroke-dasharray="7 6"/>`);
  } else if (plan.balcony) {
    const room = rooms.find((item) => item.k === 'living');
    parts.push(`<rect x="${px(room.x + 0.5)}" y="${py(-plan.balcony)}" width="${len(room.w - 1)}" height="${len(plan.balcony)}" fill="none" stroke="${thin}" stroke-width="2"/>`);
  }
  for (const room of rooms) {
    parts.push(`<rect x="${px(room.x)}" y="${py(room.y)}" width="${len(room.w)}" height="${len(room.h)}" fill="${paper}" stroke="${thin}" stroke-width="3"/>`);
  }
  parts.push(`<rect x="${px(0)}" y="${py(0)}" width="${len(plan.w)}" height="${len(height)}" fill="none" stroke="${ink}" stroke-width="9"/>`);
  for (const [x1, y1, x2, y2] of windows(plan, rooms, height)) {
    parts.push(`<line x1="${px(x1)}" y1="${py(y1)}" x2="${px(x2)}" y2="${py(y2)}" stroke="${paper}" stroke-width="10"/>`);
    parts.push(`<line x1="${px(x1)}" y1="${py(y1)}" x2="${px(x2)}" y2="${py(y2)}" stroke="${accent}" stroke-width="3"/>`);
  }
  for (const door of doors(plan, rooms, height)) {
    const half = door.width / 2;
    const cut = door.entrance ? 11 : 5;
    const rad = len(door.width);
    if (door.entrance) {
      // The entrance is a gap in the outer wall with a marker outside it.
      const x = Number(px(door.x));
      const y = Number(py(door.y)) + 8;
      parts.push(`<line x1="${px(door.x - half)}" y1="${py(door.y)}" x2="${px(door.x + half)}" y2="${py(door.y)}" stroke="${paper}" stroke-width="${cut}"/>`);
      parts.push(`<path d="M${x} ${y} l7 9 h-14 z" fill="${accent}"/>`);
    } else if (door.wall === 'h') {
      parts.push(`<line x1="${px(door.x - half)}" y1="${py(door.y)}" x2="${px(door.x + half)}" y2="${py(door.y)}" stroke="${paper}" stroke-width="${cut}"/>`);
      if (door.leaf) parts.push(`<path d="M${px(door.x - half)} ${py(door.y)} v${door.dir * door.width * K} a${rad} ${rad} 0 0 ${door.dir > 0 ? 0 : 1} ${rad} ${-door.dir * door.width * K}" fill="none" stroke="${thin}" stroke-width="1.6"/>`);
    } else {
      parts.push(`<line x1="${px(door.x)}" y1="${py(door.y - half)}" x2="${px(door.x)}" y2="${py(door.y + half)}" stroke="${paper}" stroke-width="${cut}"/>`);
      if (door.leaf) parts.push(`<path d="M${px(door.x)} ${py(door.y - half)} h${door.dir * door.width * K} a${rad} ${rad} 0 0 ${door.dir > 0 ? 1 : 0} ${-door.dir * door.width * K} ${rad}" fill="none" stroke="${thin}" stroke-width="1.6"/>`);
    }
  }
  if (opts.labels) {
    const size = 13.5 * (W / (opts.width || W));
    const num = (v) => v.toFixed(1).replace('.', opts.decimal || ',');
    for (const room of rooms) {
      const cx = px(room.x + room.w / 2);
      const cy = (room.y + room.h / 2 + out + PAD) * K;
      const name = opts.labels(room.k);
      // Small service rooms carry the area only: a name there would sit on the door swing.
      const fits = room.h >= 1.9 && room.w >= 2.6 && name.length * size * 0.56 < room.w * K - 24;
      if (fits) {
        parts.push(`<text x="${cx}" y="${(cy - size * 0.2).toFixed(1)}" text-anchor="middle" font-size="${size.toFixed(1)}" fill="${ink}">${name}</text>`);
        parts.push(`<text x="${cx}" y="${(cy + size * 1.05).toFixed(1)}" text-anchor="middle" font-size="${(size * 0.94).toFixed(1)}" fill="${thin}">${num(room.w * room.h)}</text>`);
      } else {
        parts.push(`<text x="${cx}" y="${(cy + size * 0.36).toFixed(1)}" text-anchor="middle" font-size="${(size * 0.94).toFixed(1)}" fill="${thin}">${num(room.w * room.h)}</text>`);
      }
    }
    if (plan.terrace) {
      parts.push(`<text x="${px(plan.w / 2)}" y="${((plan.terrace / 2 + PAD) * K + size * 0.36).toFixed(1)}" text-anchor="middle" font-size="${size.toFixed(1)}" fill="${thin}">${opts.labels('terrace')}, ${num(plan.w * plan.terrace)}</text>`);
    }
  }
  parts.push('</svg>');
  return parts.join('');
}
