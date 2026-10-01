/* Hatch: a success / failure moment for a web page, drawn on one canvas.
   One file, no libraries. An egg is rocked and cracks; it either hatches a chick with confetti or stays shut.

     <div id="slot"></div>
     <script src="hatch.js"></script>
     <script>var egg = Hatch.mount('#slot'); egg.success(); // or egg.fail()</script>

   Every frame is a pure function of the time since the event, so the motion is seekable and identical at any
   frame rate. Options: autoplay (alternate success and failure), manual (no timers, draw with renderAt). */
(function (global) {
  'use strict';

  var W = 1000, H = 625, FLOOR_Y = 468, ZOOM = 1.55, FLOOR = 0;        // world: x from the centre, y up from the floor is negative
  var A = 80, B = 104, SPLIT = -110, R = 80;                          // egg half width, half height, crack line, chick radius
  var C = { wall: '#ece2d0', floor: '#ddd0b8', edge: '#d0c1a5', shell: '#f5e9d3', shade: '#dcc59f', spot: '#cfae7c', hi: '#fffaf0', rim: '#c4a67a', ink: '#2c2420',
    chick: '#f6c744', chickShade: '#e2a52b', belly: '#fce59d', beak: '#ee7b2d', beakLow: '#cf5f1f', blush: '#ee8f6b', crack: '#5a4636', tint: '#59606c', dust: '#f7f1e4', shadow: '#4b3a2a' };
  var CONFETTI = ['#e4572e', '#1f8a8a', '#f2b632', '#3d4ba8', '#fffaf0'];
  var T = { success: 3.8, fail: 3.2, drop: 1.0, leave: 0.4 }, GRAV = 1500;

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function p01(x) { return clamp(x, 0, 1); }
  function inOut(x) { x = p01(x); return x * x * (3 - 2 * x); }
  function outCubic(x) { x = 1 - p01(x); return 1 - x * x * x; }
  function outBack(x, s) { x = p01(x) - 1; return 1 + (s + 1) * x * x * x + s * x * x; }
  function spring(t, freq, damp) { if (t <= 0) return 0; var w = freq * 6.2832; return 1 - Math.exp(-damp * t) * (Math.cos(w * t) + damp / w * Math.sin(w * t)); }
  function rng(seed) { var s = seed >>> 0; return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ---- shapes, drawn around the egg's own origin: the middle of its base ----
  function eggPath(ctx, dx, dy) {
    ctx.beginPath();
    for (var i = 0; i <= 72; i++) {
      var th = i / 72 * 6.2832, x = A * Math.sin(th) * (1 - 0.13 * Math.cos(th)) + dx, y = -B - B * Math.cos(th) + dy;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
  }
  var ZIG = (function () { var r = rng(7), pts = [], x; for (x = -A - 24; x <= A + 24; x += 17) pts.push([x, SPLIT + (pts.length % 2 ? 11 : -11) + (r() - .5) * 7]); return pts; })();
  function zigPath(ctx, upper) {
    ctx.beginPath(); ctx.moveTo(ZIG[0][0], upper ? -400 : 60);
    for (var i = 0; i < ZIG.length; i++) ctx.lineTo(ZIG[i][0], ZIG[i][1]);
    ctx.lineTo(ZIG[ZIG.length - 1][0], upper ? -400 : 60); ctx.closePath();
  }
  var SPOTS = [[-38, -168, 9, 6, .4], [30, -146, 7, 5, -.5], [-22, -82, 10, 6, .2], [36, -52, 8, 5, .7], [-44, -34, 6, 4, -.3], [8, -196, 6, 4, 0], [48, -108, 5, 3.5, .3]];

  // whole egg, or its upper (cap) or lower (cup) part along the zigzag
  function shell(ctx, part, tint) {
    ctx.save(); eggPath(ctx, 0, 0); ctx.clip();
    if (part) { zigPath(ctx, part === 'cap'); ctx.clip(); }
    ctx.fillStyle = C.shade; ctx.fillRect(-120, -260, 240, 280);
    eggPath(ctx, -15, -7); ctx.fillStyle = C.shell; ctx.fill();
    ctx.fillStyle = C.spot;
    for (var i = 0; i < SPOTS.length; i++) { var s = SPOTS[i]; ctx.beginPath(); ctx.ellipse(s[0], s[1], s[2], s[3], s[4], 0, 7); ctx.fill(); }
    ctx.fillStyle = C.hi; ctx.beginPath(); ctx.ellipse(-34, -166, 11, 20, .5, 0, 7); ctx.fill();
    if (tint > 0) { ctx.globalAlpha = tint; ctx.fillStyle = C.tint; ctx.fillRect(-120, -260, 240, 280); }
    ctx.restore();
    if (part) {
      ctx.save(); eggPath(ctx, 0, 0); ctx.clip(); ctx.beginPath();
      for (var j = 0; j < ZIG.length; j++) { if (j) ctx.lineTo(ZIG[j][0], ZIG[j][1]); else ctx.moveTo(ZIG[j][0], ZIG[j][1]); }
      ctx.lineJoin = 'round'; ctx.strokeStyle = C.rim; ctx.lineWidth = 6; ctx.stroke(); ctx.restore();
    }
  }

  var CRACKS = [
    [[-6, -96], [6, -118], [-4, -134], [10, -152], [0, -168]],
    [[-6, -96], [-24, -84], [-20, -66], [-38, -52]],
    [[10, -152], [30, -160], [38, -178]]
  ];
  // polyline grown from its start up to the share p of its length
  function crack(ctx, pts, p, thin) {
    if (p <= 0) return;
    var seg = [], total = 0, i;
    for (i = 1; i < pts.length; i++) { seg.push(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); total += seg[i - 1]; }
    var run = p * total;
    function trace() {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); var acc = 0;
      for (var k = 1; k < pts.length; k++) {
        if (acc + seg[k - 1] <= run) { ctx.lineTo(pts[k][0], pts[k][1]); acc += seg[k - 1]; }
        else { var f = (run - acc) / seg[k - 1]; ctx.lineTo(pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f); break; }
      }
    }
    ctx.save(); eggPath(ctx, 0, 0); ctx.clip(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (!thin) { ctx.strokeStyle = C.chick; ctx.lineWidth = 8; trace(); ctx.stroke(); }
    ctx.strokeStyle = C.crack; ctx.lineWidth = thin ? 2.4 : 3.2; trace(); ctx.stroke(); ctx.restore();
  }

  function chick(ctx, o) {
    var i, s;
    for (s = -1; s <= 1; s += 2) {                                                         // wings, behind the body
      ctx.save(); ctx.translate(s * (R - 10), 10); ctx.rotate(s * (0.3 + o.wing)); ctx.fillStyle = C.chickShade;
      ctx.beginPath(); ctx.ellipse(s * 12, 12, 17, 36, 0, 0, 7); ctx.fill(); ctx.restore();
    }
    ctx.fillStyle = C.chickShade; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.clip(); ctx.fillStyle = C.chick; ctx.beginPath(); ctx.arc(-9, -7, R, 0, 7); ctx.fill(); ctx.restore();
    ctx.fillStyle = C.belly; ctx.beginPath(); ctx.ellipse(0, 36, 46, 36, 0, 0, 7); ctx.fill();
    ctx.fillStyle = C.chick;                                                                 // tuft: three quills
    var tuft = [[-6, -26, -R - 30, -34, -R - 14, -18, -R - 12, -2], [2, 2, -R - 38, 18, -R - 32, 14, -R - 12, 8], [8, 26, -R - 26, 40, -R - 12, 24, -R - 6, 12]];
    for (i = 0; i < 3; i++) {
      var q = tuft[i]; ctx.beginPath(); ctx.moveTo(q[0], -R + 6); ctx.quadraticCurveTo(q[1], q[2], q[3], q[4]); ctx.quadraticCurveTo(q[5], q[6], q[7], -R + 4); ctx.fill();
    }
    ctx.globalAlpha *= .6; ctx.fillStyle = C.blush; ctx.beginPath(); ctx.ellipse(-47, 15, 12, 7, 0, 0, 7); ctx.ellipse(47, 15, 12, 7, 0, 0, 7); ctx.fill(); ctx.globalAlpha /= .6;
    ctx.fillStyle = C.ink; ctx.strokeStyle = C.ink; ctx.lineCap = 'round';
    for (s = -1; s <= 1; s += 2) {                                                         // eyes: open with a highlight, or closed in joy
      if (o.joy) { ctx.lineWidth = 5.5; ctx.beginPath(); ctx.arc(s * 28, 3, 11, 3.55, 5.87); ctx.stroke(); }
      else {
        var sy = 1 - o.blink * .92; ctx.save(); ctx.translate(s * 28, -4); ctx.scale(1, sy); ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, 7); ctx.fill();
        if (sy > .5) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-3, -3.4, 3.2, 0, 7); ctx.fill(); } ctx.restore();
      }
    }
    var open = o.beak;                                                                       // beak
    ctx.fillStyle = C.beakLow; ctx.beginPath(); ctx.moveTo(-11, 12 + open * 2); ctx.lineTo(11, 12 + open * 2); ctx.lineTo(0, 22 + open * 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.beak; ctx.beginPath(); ctx.moveTo(-14, 5); ctx.lineTo(14, 5); ctx.lineTo(0, 18 - open * 2); ctx.closePath(); ctx.fill();
  }

  // ---- confetti: closed-form flight with drag, so any time can be drawn without stepping ----
  function makeConfetti(seed, bursts) {
    var r = rng(seed), list = [], b, i;
    for (b = 0; b < bursts.length; b++) {
      var bu = bursts[b];
      for (i = 0; i < bu.n; i++) {
        var ang = (bu.angle + (r() - .5) * bu.spread) * Math.PI / 180, sp = bu.speed * (0.45 + r() * .75);
        list.push({ t0: bu.t + r() * bu.delay, x: bu.x + (r() - .5) * bu.jitter, y: bu.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, drag: 1.7 + r() * 1.5,
          floor: FLOOR + 12 + r() * 86, lie: .4 + r() * .5, rot: r() * 6.28, spin: (r() - .5) * 8, flip: r() * 6.28, flipSpeed: 5 + r() * 9, kind: (r() * 3) | 0, color: CONFETTI[(r() * CONFETTI.length) | 0], size: .8 + r() * .7 });
      }
    }
    return list;
  }
  var CONF = makeConfetti(11, [
    { t: 1.22, x: 0, y: -160, n: 78, angle: -90, spread: 120, speed: 520, delay: .1, jitter: 40 },
    { t: 1.3, x: -330, y: -30, n: 22, angle: -58, spread: 24, speed: 1000, delay: .08, jitter: 10 },
    { t: 1.3, x: 330, y: -30, n: 22, angle: -122, spread: 24, speed: 1000, delay: .08, jitter: 10 }
  ]);
  function flight(p, u, k) { var e = 1 - Math.exp(-k * u); return [p.x + p.vx * e / k, p.y + GRAV * u / k + (p.vy - GRAV / k) * e / k]; }
  function confettiAt(p, t) {
    var u = t - p.t0; if (u < 0) return null;
    var k = p.drag, pos = flight(p, u, k), landed = pos[1] >= p.floor;
    if (landed) { var lo = 0, hi = u, i; for (i = 0; i < 18; i++) { var m = (lo + hi) / 2; if (flight(p, m, k)[1] >= p.floor) hi = m; else lo = m; } u = hi; pos = flight(p, u, k); pos[1] = p.floor; }
    var live = Math.min(u, 2.4);
    return { x: pos[0], y: pos[1], rot: p.rot + p.spin * live, flat: landed ? p.lie : Math.cos(p.flip + p.flipSpeed * live), landed: landed };
  }
  function drawPiece(ctx, p, c) {
    var s = 11 * p.size; ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); ctx.scale(1, Math.max(.12, Math.abs(c.flat))); ctx.fillStyle = p.color;
    if (p.kind === 0) ctx.fillRect(-s, -s * .5, s * 2, s);
    else if (p.kind === 1) { ctx.beginPath(); ctx.arc(0, 0, s * .6, 0, 7); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(-s * .8, s * .6); ctx.lineTo(s * .8, s * .6); ctx.lineTo(0, -s * .8); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }

  // ---- the pose of the scene at time t after the event ----
  function pose(mode, t) {
    var s = { x: 0, y: 0, rot: 0, sx: 1, sy: 1, cr: [0, 0, 0], thin: false, tint: 0, cap: null, chick: null, dust: -1, shadow: 1, out: 0 }, u;
    if (mode === 'idle') {
      var b = Math.sin(t * 2.6), ph = t % 3.4;
      s.sy = 1 + .011 * b; s.sx = 1 - .008 * b; s.rot = ph < .9 ? Math.exp(-ph * 4.2) * Math.sin(ph * 17) * .05 : 0;
    } else if (mode === 'drop') {
      var fall = .52;
      if (t < fall) { var d = t / fall; s.y = -560 * (1 - d * d); s.sy = 1 + .05 * d; s.sx = 1 - .03 * d; s.shadow = .5 + .5 * d * d; }
      else {
        u = t - fall; s.y = -66 * Math.abs(Math.sin(u * 8.5)) * Math.exp(-u * 5.2) * (u < .7 ? 1 : 0);
        var sq = Math.exp(-u * 8) * Math.cos(u * 22); s.sy = 1 - .18 * Math.max(0, sq) + .06 * Math.min(0, sq); s.sx = 1 + .12 * Math.max(0, sq) - .04 * Math.min(0, sq);
        s.shadow = 1 + s.y / 260; s.dust = u < .6 ? u * .8 : -1;
      }
    } else if (mode === 'success') {
      if (t < .3) { u = inOut(t / .3); s.sy = 1 - .1 * u; s.sx = 1 + .075 * u; s.rot = -.055 * u; }
      else if (t < 1.2) {
        u = t - .3; var amp = .09 + .13 * (u / .9) * (u / .9), ang = Math.sin(u * 31) * amp * Math.min(1, u / .15), lean = Math.max(0, 1 - u * 5);
        s.rot = ang - .055 * Math.max(0, 1 - u * 4); s.sx = 1 + .075 * lean - Math.abs(ang) * .09; s.sy = 1 - .1 * lean + Math.abs(ang) * .06;
        s.cr = [p01((t - .52) / .28), p01((t - .78) / .26), p01((t - .98) / .2)];
      } else {
        u = t - 1.2; s.cr = [1, 1, 1];
        var q = Math.exp(-u * 9) * Math.cos(u * 26); s.sy = 1 + .08 * q; s.sx = 1 - .05 * q;
        s.cap = capAt(u);
        var rise = outBack(u / .5, 2.2), pop = Math.max(0, u - .5), wing = u > .3 ? Math.sin((u - .3) * 38) * Math.exp(-(u - .3) * .9) * .7 : -.2;
        s.chick = { y: -84 - 62 * rise - (u < .62 ? Math.sin(3.1416 * u / .62) * 34 : 0) + (u > .9 ? Math.sin((u - .9) * 5.6) * 6 : 0),
          scale: .6 + .4 * outBack(u / .34, 1.9), squash: Math.exp(-pop * 7) * Math.cos(pop * 24) * .1, joy: u > .12 && u < 1.9, blink: u > 1.9 ? blinkAt(u) : 0,
          wing: wing, beak: u > .3 && u < 1.1 ? .5 + .5 * Math.sin(u * 30) : 0 };
        if (t > 3.2) s.out = p01((t - 3.2) / .6);
      }
    } else {
      if (t < .25) { u = inOut(t / .25); s.sy = 1 - .06 * u; s.sx = 1 + .05 * u; }
      else if (t < 1.35) {
        u = t - .25; var env = Math.exp(-u * 1.35), pre = Math.max(0, 1 - u * 4);
        s.x = Math.sin(u * 27) * 17 * env; s.rot = Math.sin(u * 27 + .4) * .08 * env; s.sy = 1 - .06 * pre; s.sx = 1 + .05 * pre;
        s.cr[0] = p01((t - .55) / .4); s.thin = true; s.tint = .34 * inOut((t - .35) / .8);
      } else {
        u = t - 1.35; s.cr[0] = 1; s.thin = true; s.tint = .34;
        var sag = spring(u, 1.6, 5); s.sy = 1 - .13 * sag + .02 * Math.sin(u * 3); s.sx = 1 + .085 * sag; s.rot = .03 * sag;
        s.dust = u < 1.1 ? u : -1;
        if (t > 2.65) s.out = p01((t - 2.65) / .55);
      }
    }
    return s;
  }
  function blinkAt(u) { var ph = (u - 1.9) % 2.4; return ph < .16 ? Math.sin(ph / .16 * Math.PI) : 0; }
  // the cap flies up, turns once and bounces on the floor; position and angle of its middle
  function capAt(u) {
    var g = 2100, y = -159, vy = -430, left = u, hits = 0, floor = -40, rest = false;
    while (left > 0 && !rest) {
      var tHit = (-vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * (floor - y)))) / g;
      if (left < tHit) { y += vy * left + .5 * g * left * left; vy += g * left; left = 0; }
      else { left -= tHit; y = floor; vy = -(vy + g * tHit) * .36; if (++hits > 3 || Math.abs(vy) < 90) { vy = 0; rest = true; } }
    }
    return { x: -205 * (1 - Math.exp(-u * 3.2)) - 12 * Math.min(1, u / .6), y: y, rot: -6.2832 * outCubic(u / .95) - .08 * (1 - Math.exp(-u * 4)) + .22 * Math.exp(-u * 3) * Math.sin(u * 14) };
  }

  function dust(ctx, d) {
    var r = rng(5), i;
    for (i = 0; i < 9; i++) {
      var side = i % 2 ? 1 : -1, k = p01(d), e = outCubic(k);
      ctx.globalAlpha = .55 * (1 - k) * (1 - k); ctx.fillStyle = C.dust; ctx.beginPath();
      ctx.arc(side * (A * .55 + e * (50 + r() * 70)), -8 - e * (10 + r() * 36) - r() * 6, 8 + r() * 12 + e * 12, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // straw nest the egg sits in: strokes behind the egg and a low front rim over its base
  var NEST = (function () { var r = rng(3), back = [], front = [], i; for (i = 0; i < 46; i++) { var th = r() * 3.1416, rad = 86 + r() * 26; back.push([Math.cos(th) * rad, -Math.sin(th) * 22 * (rad / 100) + 2, (r() - .5) * 38, (r() - .5) * 10 - 4, r() < .5 ? '#d2b373' : '#b8935a']); }
    for (i = 0; i < 38; i++) { var t2 = r() * 3.1416, rad2 = 82 + r() * 30; front.push([Math.cos(t2) * rad2, Math.sin(t2) * 20 * (rad2 / 100) + 2, (r() - .5) * 42, (r() - .5) * 8, r() < .5 ? '#dcc084' : '#bf9a5c']); } return { back: back, front: front }; })();
  function straw(ctx, list, lw) {
    ctx.lineCap = 'round'; ctx.lineWidth = lw;
    for (var i = 0; i < list.length; i++) { var p = list[i]; ctx.strokeStyle = p[4]; ctx.beginPath(); ctx.moveTo(p[0] - p[2] / 2, p[1] - p[3] / 2); ctx.quadraticCurveTo(p[0], p[1] + 5, p[0] + p[2] / 2, p[1] + p[3] / 2); ctx.stroke(); }
  }
  function scene(ctx, mode, t, alpha, still) {
    var s = pose(mode, still ? (mode === 'success' ? 3.0 : mode === 'fail' ? 2.2 : 0) : t), a = alpha * (1 - s.out), i, back = [], front = [];
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    ctx.save(); ctx.globalAlpha = a * .18 * s.shadow; ctx.fillStyle = C.shadow; ctx.beginPath(); ctx.ellipse(s.x * .6, FLOOR + 5, 92 * s.shadow * (s.cap ? 1.15 : 1), 15 * s.shadow, 0, 0, 7); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(0, FLOOR); ctx.fillStyle = '#a8864b'; ctx.beginPath(); ctx.ellipse(0, 0, 108, 21, 0, 0, 7); ctx.fill(); straw(ctx, NEST.back, 5); ctx.restore();
    if (s.chick) for (i = 0; i < CONF.length; i++) { var c = confettiAt(CONF[i], still ? 9 : t); if (c) (c.landed ? front : back).push([CONF[i], c]); }
    for (i = 0; i < back.length; i++) drawPiece(ctx, back[i][0], back[i][1]);
    ctx.save(); ctx.translate(s.x, FLOOR + s.y - 10); ctx.rotate(s.rot); ctx.scale(s.sx, s.sy);
    if (s.chick) {
      var ch = s.chick; ctx.save(); ctx.translate(0, ch.y); ctx.scale(ch.scale * (1 - ch.squash), ch.scale * (1 + ch.squash)); chick(ctx, ch); ctx.restore();
      shell(ctx, 'cup', 0);
      ctx.save(); zigPath(ctx, false); ctx.clip(); crack(ctx, CRACKS[1], s.cr[1], false); ctx.restore();
    } else { shell(ctx, null, s.tint); for (i = 0; i < 3; i++) crack(ctx, CRACKS[i], s.cr[i], i === 0 && s.thin); }
    ctx.restore();
    if (s.cap) {
      ctx.save(); ctx.translate(s.cap.x, FLOOR + s.cap.y); ctx.rotate(s.cap.rot); ctx.translate(0, 159); shell(ctx, 'cap', 0);
      ctx.save(); zigPath(ctx, true); ctx.clip(); for (i = 0; i < 3; i++) crack(ctx, CRACKS[i], 1, false); ctx.restore(); ctx.restore();
    }
    ctx.save(); ctx.translate(0, FLOOR); straw(ctx, NEST.front, 6); ctx.restore();
    if (s.dust >= 0) dust(ctx, s.dust);
    for (i = 0; i < front.length; i++) drawPiece(ctx, front[i][0], front[i][1]);
    ctx.restore();
  }

  function mount(target, opts) {
    opts = opts || {};
    var host = typeof target === 'string' ? document.querySelector(target) : target;
    var canvas = document.createElement('canvas'); canvas.style.cssText = 'display:block;width:100%;height:100%';
    host.appendChild(canvas);
    var ctx = canvas.getContext('2d', { alpha: false });
    var still = !opts.manual && global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var epoch = performance.now() / 1000, cur = { mode: 'idle', t0: 0 }, prev = null, visible = true, raf = 0, timer = 0, painted = false, cw = 0, ch = 0, seq = 0;
    function now() { return performance.now() / 1000 - epoch; }
    function size() {
      var r = host.getBoundingClientRect(), dpr = Math.min(global.devicePixelRatio || 1, 2), w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
      if (w !== cw || h !== ch) { cw = canvas.width = w; ch = canvas.height = h; }
    }
    function frame(drawScenes) {
      size(); ctx.setTransform(cw / W, 0, 0, ch / H, 0, 0);
      ctx.fillStyle = C.wall; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = C.floor; ctx.fillRect(0, FLOOR_Y - 6, W, H); ctx.fillStyle = C.edge; ctx.fillRect(0, FLOOR_Y - 6, W, 3);
      ctx.translate(W / 2, FLOOR_Y); ctx.scale(ZOOM, ZOOM);
      drawScenes();
    }
    function draw(t) {
      frame(function () {
        if (prev) { var k = (t - prev.at) / T.leave; if (k < 1) scene(ctx, prev.mode, prev.base + (t - prev.at), 1 - inOut(k), still); else prev = null; }
        scene(ctx, cur.mode, t - cur.t0, 1, still);
      });
      if (!painted) { painted = true; try { if (parent !== window) parent.postMessage({ live: location.pathname }, location.origin); } catch (e) { /* cross-origin parent */ } }
    }
    function trigger(mode) {
      var t = now(); prev = { mode: cur.mode, base: t - cur.t0, at: t }; cur = { mode: mode, t0: t }; clearTimeout(timer);
      if (mode === 'success' || mode === 'fail') timer = setTimeout(function () { trigger('drop'); }, T[mode] * 1000);
      else if (mode === 'drop') timer = setTimeout(function () { trigger('idle'); }, T.drop * 1000);
      else if (opts.autoplay) timer = setTimeout(function () { trigger(seq++ % 2 ? 'fail' : 'success'); }, 2000);
    }
    function loop() { raf = 0; if (visible && !document.hidden) { draw(now()); raf = requestAnimationFrame(loop); } }
    function run() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop); }
    if (opts.manual) draw(0);
    else {
      new IntersectionObserver(function (e) { visible = e[0].isIntersecting; run(); }, { threshold: .05 }).observe(host);
      document.addEventListener('visibilitychange', run);
      if (global.ResizeObserver) new ResizeObserver(function () { if (!raf) draw(now()); }).observe(host);
      run(); if (opts.autoplay) timer = setTimeout(function () { trigger(seq++ % 2 ? 'fail' : 'success'); }, 1000);
    }
    return {
      success: function () { trigger('success'); }, fail: function () { trigger('fail'); }, reset: function () { trigger('drop'); },
      renderAt: function (mode, t) { frame(function () { scene(ctx, mode, t, 1, false); }); },
      destroy: function () { cancelAnimationFrame(raf); clearTimeout(timer); canvas.remove(); }
    };
  }
  global.Hatch = { mount: mount, durations: T };
})(window);
