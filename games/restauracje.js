/*
 * Restauracje: a hub of little restaurants where animals (the pets from Zwierzątko, NG.petArt) come to eat.
 * The hub is a RESTAURANTS table; each restaurant is a module object with its own kitchen stations, orders,
 * tickets and scoring. The shared engine does the rest: the paid shift (50 ★, 5 guests), the dining room with
 * the counter (Lada) and serving (Podaj), the queue, the ticket rail, hearts, tips (refunded ★), the summary,
 * stats, stickers and saving.
 * Pizzeria: take the order at the counter, spread sauce and cheese and put toppings on (Dodatki), bake in the
 * oven until the needle is in the frame (Piec), swipe to cut (Krojenie), serve (Podaj). No fail state and no
 * timer that punishes: a slow pizza only misses a small bonus.
 * Economy: a shift costs 50 ★; every guest tips 2–6 ★ (ctx.refund), a perfect shift returns 30 ★.
 * Toppings unlock with shifts played (see TOPS[].at), orders grow slowly (pizzaOrder).
 * Coordinates: canvas css px; scenes scale with u = min(W/420, H/520).
 */
(function () {
  'use strict';
  if (!window.NG) return;

  var INK = '#1d2f6f', MUTED = '#5a6690', GOLD = '#e3a008', GREEN = '#2a8a56';
  var FONT = '"Patrick Hand","Comic Sans MS",cursive';
  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var SHIFT_PRICE = 50, SHIFT_N = 5, MAX_IN = 2, NEXT_GAP = 16;
  var TIP_MIN = 2, TIP_MAX = 6, FAST_S = 100, OK_S = 160;

  // ---------- helpers ----------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pl(n, one, few, many) { if (n === 1) return one; var d = n % 10, h = n % 100; return d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many; }
  function hexRgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(a, b, t) {
    var A = hexRgb(a), B = hexRgb(b); t = clamp(t, 0, 1);
    return 'rgb(' + Math.round(lerp(A[0], B[0], t)) + ',' + Math.round(lerp(A[1], B[1], t)) + ',' + Math.round(lerp(A[2], B[2], t)) + ')';
  }
  function rr(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function ink(g, w) { g.lineWidth = w; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
  function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); }
  function heartPath(g, x, y, r) {
    g.beginPath(); g.moveTo(x, y + r * 0.9);
    g.bezierCurveTo(x - r * 1.7, y - r * 0.15, x - r * 0.75, y - r * 1.35, x, y - r * 0.45);
    g.bezierCurveTo(x + r * 0.75, y - r * 1.35, x + r * 1.7, y - r * 0.15, x, y + r * 0.9); g.closePath();
  }
  function starPath(g, x, y, r) {
    g.beginPath();
    for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * q, y + Math.sin(a) * q); }
    g.closePath();
  }
  function flame(g, x, y, s, on) {
    g.beginPath(); g.moveTo(x, y - s);
    g.bezierCurveTo(x + s * 0.9, y - s * 0.2, x + s * 0.75, y + s * 0.75, x, y + s * 0.75);
    g.bezierCurveTo(x - s * 0.75, y + s * 0.75, x - s * 0.9, y - s * 0.2, x, y - s); g.closePath();
    g.fillStyle = on ? '#f39a2a' : '#e6e9f2'; g.fill(); ink(g, Math.max(1, s * 0.18));
    if (on) { g.beginPath(); g.ellipse(x, y + s * 0.3, s * 0.32, s * 0.38, 0, 0, 7); g.fillStyle = '#ffd85a'; g.fill(); }
  }
  function coin(g, x, y, r) {
    circle(g, x, y, r); g.fillStyle = '#f5c330'; g.fill(); ink(g, Math.max(1, r * 0.2));
    starPath(g, x, y, r * 0.55); g.fillStyle = '#fff3b8'; g.fill();
  }
  function txt(g, s, x, y, size, col, align, base) {
    g.font = Math.round(size) + 'px ' + FONT; g.fillStyle = col || INK; g.textAlign = align || 'center'; g.textBaseline = base || 'middle'; g.fillText(s, x, y);
  }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function smallCanvas(w, h) { var dpr = Math.min(3, window.devicePixelRatio || 1), c = document.createElement('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.width = w + 'px'; c.style.height = h + 'px'; var g = c.getContext('2d'); g.scale(dpr, dpr); return { c: c, g: g }; }

  // =====================================================================
  // Guests (animals from Zwierzątko). [name, feminine]
  // =====================================================================
  var GUESTS = {
    jez: [['Jeżyk Kolczyk', 0], ['Jeżynka Igiełka', 1]],
    lis: [['Lisek Rudek', 0], ['Liska Kita', 1]],
    fenek: [['Fenek Uszatek', 0], ['Fenka Sara', 1]],
    wiew: [['Wiewiórka Basia', 1], ['Wiewiór Orzeszek', 0]],
    borsuk: [['Borsuk Borys', 0], ['Borsuczka Bunia', 1]],
    chomik: [['Chomik Pucek', 0], ['Chomiczka Pyzia', 1]],
    swinka: [['Świnka Fasolka', 1], ['Świnka Kiki', 1]],
    krolik: [['Królik Tuptuś', 0], ['Króliczka Śnieżka', 1]],
    kotsz: [['Kot Mruczek', 0], ['Kotka Szarotka', 1]],
    kotr: [['Kotek Płomyk', 0], ['Kotka Iskra', 1]],
    kotp: [['Kotka Wydma', 1], ['Kot Piasek', 0]]
  };
  var SPECIES = Object.keys(GUESTS);
  var SAY_HI = ['Dzień dobry! Poproszę taką:', 'Cześć! Mam ochotę na taką:', 'Poproszę taką, dziękuję!', 'Mniam! Chcę taką:'];
  var SAY_BYE = {
    3: ['Pyszna! Dziękuję!', 'Najlepsza na świecie!', 'Mniam, mniam! Super!'],
    2: ['Smaczna! Dziękuję!', 'Bardzo dobra, dzięki!', 'Mniam! Dziękuję!'],
    1: ['Dziękuję! Zjem ze smakiem.', 'Dzięki! Zjem całą!', 'Dziękuję bardzo!']
  };
  function petArt() { return NG.petArt && NG.petArt.draw ? NG.petArt : null; }

  // =====================================================================
  // Pizzeria: drawing
  // =====================================================================
  var INNER = 0.84, GRID = 16, LAYER = 320, TOP_R = 0.13, BAKE_S = 10, ZONE = 0.09;
  var SAUCE = '#d9412e';
  // at: shifts played before this topping appears
  var TOPS = [
    { k: 'salami', n: 'salami', at: 0 },
    { k: 'grzyby', n: 'pieczarki', at: 0 },
    { k: 'oliwki', n: 'oliwki', at: 1 },
    { k: 'papryka', n: 'papryka', at: 2 },
    { k: 'szynka', n: 'szynka', at: 3 },
    { k: 'ananas', n: 'ananas', at: 4 },
    { k: 'kukurydza', n: 'kukurydza', at: 6 },
    { k: 'bazylia', n: 'bazylia', at: 8 }
  ];
  var TOPB = {}; TOPS.forEach(function (t) { TOPB[t.k] = t; });
  var DONE = [{ n: 'lekko', c: 0.3, f: 1 }, { n: 'średnio', c: 0.55, f: 2 }, { n: 'mocno', c: 0.8, f: 3 }];
  var CRUST = [[0, '#f5ddb0'], [0.3, '#efc57e'], [0.55, '#de9f52'], [0.8, '#b8733a'], [1, '#8d5126']];
  function crustCol(b) {
    b = clamp(b, 0, 1);
    for (var i = 1; i < CRUST.length; i++) if (b <= CRUST[i][0]) return mix(CRUST[i - 1][1], CRUST[i][1], (b - CRUST[i - 1][0]) / (CRUST[i][0] - CRUST[i - 1][0]));
    return CRUST[CRUST.length - 1][1];
  }
  function unlockedTops(shifts) { return TOPS.filter(function (t) { return shifts >= t.at; }); }

  // one topping piece at (0,0), radius s
  function drawTop(g, k, s) {
    var lw = Math.max(1, s * 0.15);
    if (k === 'salami') {
      circle(g, 0, 0, s); g.fillStyle = '#d8433b'; g.fill(); ink(g, lw);
      g.fillStyle = '#f7b5a6';[[-0.35, -0.3], [0.38, -0.1], [-0.05, 0.42], [0.1, -0.5]].forEach(function (p) { circle(g, p[0] * s, p[1] * s, s * 0.13); g.fill(); });
    } else if (k === 'grzyby') {
      g.beginPath(); g.moveTo(-s, 0.05 * s); g.bezierCurveTo(-s, -0.95 * s, s, -0.95 * s, s, 0.05 * s);
      g.lineTo(0.38 * s, 0.05 * s); g.lineTo(0.42 * s, 0.85 * s); g.lineTo(-0.42 * s, 0.85 * s); g.lineTo(-0.38 * s, 0.05 * s); g.closePath();
      g.fillStyle = '#f3e4c8'; g.fill(); ink(g, lw);
      g.beginPath(); g.moveTo(-0.7 * s, -0.05 * s); g.quadraticCurveTo(0, -0.55 * s, 0.7 * s, -0.05 * s); g.strokeStyle = '#c4a072'; g.lineWidth = lw * 0.8; g.stroke();
    } else if (k === 'oliwki') {
      g.beginPath(); g.arc(0, 0, 0.78 * s, 0, 7); g.arc(0, 0, 0.32 * s, 0, 7, true); g.fillStyle = '#3d3350'; g.fill('evenodd');
      circle(g, 0, 0, 0.78 * s); ink(g, lw); circle(g, 0, 0, 0.32 * s); ink(g, lw * 0.8);
      g.beginPath(); g.arc(0, 0, 0.55 * s, -2.6, -1.9); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = lw; g.stroke();
    } else if (k === 'papryka') {
      g.beginPath(); g.arc(0, 0.75 * s, 1.0 * s, Math.PI * 1.18, Math.PI * 1.82);
      g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 0.62 * s; g.stroke();
      g.strokeStyle = '#3fa64c'; g.lineWidth = 0.62 * s - lw * 2; g.stroke();
      g.beginPath(); g.arc(0, 0.75 * s, 1.08 * s, Math.PI * 1.3, Math.PI * 1.6); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = lw * 0.8; g.stroke();
    } else if (k === 'szynka') {
      rr(g, -0.85 * s, -0.68 * s, 1.7 * s, 1.36 * s, 0.4 * s); g.fillStyle = '#f39cab'; g.fill(); ink(g, lw);
      rr(g, -0.58 * s, -0.42 * s, 1.16 * s, 0.84 * s, 0.25 * s); g.fillStyle = '#f7b9c3'; g.fill();
    } else if (k === 'ananas') {
      g.beginPath(); g.moveTo(-0.95 * s, 0.6 * s); g.quadraticCurveTo(0, 0.85 * s, 0.95 * s, 0.6 * s); g.lineTo(0, -0.85 * s); g.closePath();
      g.fillStyle = '#f9d94a'; g.fill(); ink(g, lw);
      g.beginPath(); g.moveTo(-0.75 * s, 0.35 * s); g.quadraticCurveTo(0, 0.55 * s, 0.75 * s, 0.35 * s); g.strokeStyle = '#e6a62a'; g.lineWidth = lw; g.stroke();
    } else if (k === 'kukurydza') {
      [[-0.42, 0.25], [0.42, 0.25], [0, -0.38]].forEach(function (p) {
        rr(g, p[0] * s - 0.4 * s, p[1] * s - 0.36 * s, 0.8 * s, 0.72 * s, 0.28 * s); g.fillStyle = '#ffd23f'; g.fill(); ink(g, lw * 0.85);
        circle(g, p[0] * s - 0.12 * s, p[1] * s - 0.1 * s, 0.1 * s); g.fillStyle = '#fff3b0'; g.fill();
      });
    } else if (k === 'bazylia') {
      g.beginPath(); g.moveTo(-s, 0.1 * s); g.bezierCurveTo(-0.4 * s, -0.85 * s, 0.6 * s, -0.7 * s, s, -0.05 * s);
      g.bezierCurveTo(0.5 * s, 0.7 * s, -0.5 * s, 0.75 * s, -s, 0.1 * s); g.closePath();
      g.fillStyle = '#3e9d4b'; g.fill(); ink(g, lw);
      g.beginPath(); g.moveTo(-0.85 * s, 0.08 * s); g.quadraticCurveTo(0, -0.05 * s, 0.85 * s, -0.04 * s); g.strokeStyle = '#8fd06b'; g.lineWidth = lw * 0.8; g.stroke();
    }
  }
  function drawSauceIcon(g, x, y, s) {
    g.beginPath(); g.ellipse(x, y + s * 0.15, s, s * 0.75, 0, 0, 7); g.fillStyle = '#f3e6cf'; g.fill(); ink(g, Math.max(1, s * 0.12));
    g.beginPath(); g.ellipse(x, y + s * 0.05, s * 0.72, s * 0.48, 0, 0, 7); g.fillStyle = SAUCE; g.fill();
    // ladle
    g.beginPath(); g.moveTo(x + s * 0.2, y); g.lineTo(x + s * 0.95, y - s * 1.0); g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = s * 0.22; g.stroke();
    g.strokeStyle = '#c9d6ea'; g.lineWidth = s * 0.11; g.stroke();
  }
  function drawCheeseIcon(g, x, y, s) {
    g.beginPath(); g.ellipse(x, y + s * 0.15, s, s * 0.75, 0, 0, 7); g.fillStyle = '#f3e6cf'; g.fill(); ink(g, Math.max(1, s * 0.12));
    var sh = [[-0.45, 0, 0.3], [0.1, -0.15, -0.5], [0.45, 0.1, 0.9], [-0.15, 0.25, 1.4], [0.25, 0.32, 0.1], [-0.5, 0.3, -0.9], [0, -0.35, 1.1]];
    sh.forEach(function (p, i) { g.save(); g.translate(x + p[0] * s, y + p[1] * s); g.rotate(p[2]); rr(g, -s * 0.22, -s * 0.07, s * 0.44, s * 0.14, s * 0.07); g.fillStyle = i % 2 ? '#ffe38a' : '#f9cc39'; g.fill(); g.restore(); });
  }

  // the ordered pizza as a picture (tickets, the speech bubble)
  function drawOrderPizza(g, o, x, y, R) {
    var b = DONE[o.done].c;
    circle(g, x, y, R); g.fillStyle = crustCol(b); g.fill(); ink(g, Math.max(1.5, R * 0.05));
    circle(g, x, y, R * INNER); g.fillStyle = SAUCE; g.fill();
    g.beginPath();
    for (var i = 0; i <= 24; i++) { var a = i / 24 * Math.PI * 2, q = R * (0.7 + (i % 2) * 0.05); g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * q, y + Math.sin(a) * q); }
    g.closePath(); g.fillStyle = mix('#ffd95a', '#e2a24a', b * 0.6); g.fill();
    var list = []; o.tops.forEach(function (t) { for (var j = 0; j < t.n; j++) list.push(t.k); });
    // interleave kinds, sunflower layout
    list.sort(function (a, c) { return 0; });
    var n = list.length, mixed = [], buckets = {};
    list.forEach(function (k) { (buckets[k] = buckets[k] || []).push(k); });
    var keys = Object.keys(buckets); while (mixed.length < n) keys.forEach(function (k) { if (buckets[k].length) mixed.push(buckets[k].pop()); });
    var pr = R * (n > 9 ? 0.14 : 0.17);
    mixed.forEach(function (k, i) {
      var rr2 = R * 0.58 * Math.sqrt((i + 0.6) / n), a = i * 2.39996 + 0.4;
      g.save(); g.translate(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); g.rotate(a); drawTop(g, k, pr); g.restore();
    });
    var cuts = o.slices / 2;
    g.strokeStyle = 'rgba(29,47,111,.75)'; g.lineWidth = Math.max(1, R * 0.035);
    for (var c = 0; c < cuts; c++) { var ca = c * Math.PI / cuts + Math.PI / 2; g.beginPath(); g.moveTo(x - Math.cos(ca) * R, y - Math.sin(ca) * R); g.lineTo(x + Math.cos(ca) * R, y + Math.sin(ca) * R); g.stroke(); }
  }
  // the order as a picture: pizza + topping counts + doneness flames + slice count. Box (0,0,w,h).
  function drawOrder(g, o, w, h, opt) {
    opt = opt || {};
    var pad = Math.max(4, h * 0.06), R = Math.min(h / 2 - pad - h * 0.04, w * 0.27);
    var px = pad + R + 2, py = h / 2 - h * 0.04;
    drawOrderPizza(g, o, px, py, R);
    // flames badge (bottom-left of the pizza)
    var fs = R * 0.2, bw = fs * 6.4, bh = fs * 2.5, bx = px - R * 0.95, by = py + R * 0.62;
    rr(g, bx, by, bw, bh, bh / 2); g.fillStyle = '#fff'; g.fill(); ink(g, Math.max(1, fs * 0.22));
    for (var i = 0; i < 3; i++) flame(g, bx + bh * 0.5 + i * fs * 1.9, by + bh * 0.5, fs * 0.82, i < DONE[o.done].f);
    // slices badge (bottom-right)
    var sr = R * 0.36, sx = px + R * 0.78, sy = py + R * 0.74;
    circle(g, sx, sy, sr); g.fillStyle = '#fff'; g.fill(); ink(g, Math.max(1, sr * 0.12));
    txt(g, String(o.slices), sx, sy + sr * 0.06, sr * 1.45, INK);
    // topping rows
    var x0 = px + R + pad * 1.6, cw = w - x0 - pad, n = o.tops.length, rowH = Math.min((h - pad * 2) / Math.max(2, n), h * 0.36);
    var y0 = h / 2 - rowH * n / 2;
    o.tops.forEach(function (t, j) {
      var cy = y0 + rowH * (j + 0.5), ir = Math.min(rowH * 0.36, cw * 0.2);
      var have = opt.have ? opt.have[t.k] || 0 : -1;
      g.save(); g.translate(x0 + ir + 1, cy); drawTop(g, t.k, ir); g.restore();
      var col = have === t.n ? GREEN : have > t.n ? '#c4521f' : INK;
      txt(g, '×' + t.n, x0 + ir * 2 + 3, cy + 1, Math.min(rowH * 0.62, cw * 0.36), col, 'left');
      if (have === t.n) { g.beginPath(); g.moveTo(x0 + cw - ir * 0.9, cy); g.lineTo(x0 + cw - ir * 0.45, cy + ir * 0.5); g.lineTo(x0 + cw + ir * 0.15, cy - ir * 0.6); g.strokeStyle = GREEN; g.lineWidth = Math.max(2, ir * 0.35); g.lineCap = 'round'; g.stroke(); }
    });
  }

  // ---------- the pizza being made ----------
  function newPizza() {
    function layer() { var c = document.createElement('canvas'); c.width = c.height = LAYER; return c; }
    return { stage: 'top', sauce: layer(), cheese: layer(), sg: new Uint8Array(GRID * GRID), cg: new Uint8Array(GRID * GRID), tops: [], bake: 0, baked: null, cuts: [], cutT: [], insT: 0, seed: Math.random() * 100, spots: null };
  }
  var INNER_CELLS = (function () { var a = []; for (var i = 0; i < GRID; i++) for (var j = 0; j < GRID; j++) { var x = (i + 0.5) / GRID * 2 - 1, y = (j + 0.5) / GRID * 2 - 1; if (Math.hypot(x, y) <= INNER - 0.04) a.push(j * GRID + i); } return a; })();
  function markGrid(grid, x, y, r) {
    for (var i = 0; i < GRID; i++) for (var j = 0; j < GRID; j++) {
      var cx = (i + 0.5) / GRID * 2 - 1, cy = (j + 0.5) / GRID * 2 - 1;
      if (Math.hypot(cx - x, cy - y) <= r) grid[j * GRID + i] = 1;
    }
  }
  function coverage(grid) { var n = 0; INNER_CELLS.forEach(function (k) { if (grid[k]) n++; }); return n / INNER_CELLS.length; }
  function dabSauce(it, x, y) {
    var g = it.sauce.getContext('2d'), h = LAYER / 2;
    g.save(); circle(g, h, h, INNER * h); g.clip();
    g.fillStyle = SAUCE; circle(g, h + x * h, h + y * h, 0.2 * h * rnd(0.9, 1.1)); g.fill();
    g.fillStyle = 'rgba(150,25,15,.28)'; for (var i = 0; i < 3; i++) { circle(g, h + (x + rnd(-0.15, 0.15)) * h, h + (y + rnd(-0.15, 0.15)) * h, rnd(1, 2.5)); g.fill(); }
    g.restore();
    markGrid(it.sg, x, y, 0.2);
  }
  function dabCheese(it, x, y) {
    var g = it.cheese.getContext('2d'), h = LAYER / 2;
    g.save(); circle(g, h, h, (INNER - 0.03) * h); g.clip();
    for (var i = 0; i < 9; i++) {
      var a = rnd(0, 7), d = Math.sqrt(Math.random()) * 0.19;
      g.save(); g.translate(h + (x + Math.cos(a) * d) * h, h + (y + Math.sin(a) * d) * h); g.rotate(rnd(0, 7));
      rr(g, -0.055 * h, -0.02 * h, 0.11 * h, 0.04 * h, 0.02 * h); g.fillStyle = pick(['#ffd64d', '#ffe58a', '#f7c531', '#fff0b0']); g.fill();
      g.restore();
    }
    g.restore();
    markGrid(it.cg, x, y, 0.17);
  }
  function drawPizza(g, it, R, bakeOverride) {
    var b = bakeOverride != null ? bakeOverride : it.bake;
    circle(g, 0, 0, R); g.fillStyle = crustCol(b); g.fill();
    circle(g, 0, 0, R * INNER); g.fillStyle = mix('#fbe9c6', '#e8c286', b); g.fill();
    g.drawImage(it.sauce, -R, -R, 2 * R, 2 * R);
    g.drawImage(it.cheese, -R, -R, 2 * R, 2 * R);
    var now = performance.now() / 1000;
    it.tops.forEach(function (p) {
      var age = now - (p.t0 || 0), k = REDUCED || age > 0.35 ? 1 : 1 + Math.sin(Math.min(1, age / 0.35) * Math.PI) * 0.35;
      g.save(); g.translate(p.x * R, p.y * R); g.rotate(p.rot); g.scale(k, k); drawTop(g, p.k, TOP_R * R * p.s); g.restore();
    });
    if (b > 0.04) {
      g.save(); circle(g, 0, 0, R); g.clip();
      g.globalCompositeOperation = 'multiply'; g.fillStyle = mix('#ffffff', '#c98d55', b * 0.75); g.fillRect(-R, -R, 2 * R, 2 * R);
      g.globalCompositeOperation = 'source-over';
      if (b > 0.3) {
        if (!it.spots) { it.spots = []; for (var i = 0; i < 14; i++) { var a = rnd(0, 7), d = Math.sqrt(Math.random()) * 0.72; it.spots.push([Math.cos(a) * d, Math.sin(a) * d, rnd(0.025, 0.05)]); } }
        g.globalAlpha = clamp((b - 0.3) * 1.5, 0, 0.75); g.fillStyle = '#b5682a';
        it.spots.forEach(function (s) { g.beginPath(); g.ellipse(s[0] * R, s[1] * R, s[2] * R, s[2] * R * 0.75, s[0] * 3, 0, 7); g.fill(); });
        g.globalAlpha = 1;
      }
      g.restore();
    }
    circle(g, 0, 0, R); ink(g, Math.max(2, R * 0.025));
    circle(g, 0, 0, R * INNER); g.strokeStyle = 'rgba(160,100,40,.35)'; g.lineWidth = Math.max(1, R * 0.015); g.stroke();
  }
  // cut pizza: wedges pulled apart by gap px
  function drawCutPizza(g, it, R, gap, bake) {
    if (!it.cuts.length) { drawPizza(g, it, R, bake); return; }
    var angs = [];
    it.cuts.forEach(function (a) { angs.push(a, a + Math.PI); });
    angs.sort(function (a, b) { return a - b; });
    for (var i = 0; i < angs.length; i++) {
      var a0 = angs[i], a1 = i + 1 < angs.length ? angs[i + 1] : angs[0] + Math.PI * 2, m = (a0 + a1) / 2;
      g.save(); g.translate(Math.cos(m) * gap, Math.sin(m) * gap);
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R + 2, a0, a1); g.closePath(); g.save(); g.clip();
      drawPizza(g, it, R, bake); g.restore();
      g.beginPath(); g.moveTo(Math.cos(a0) * R, Math.sin(a0) * R); g.lineTo(0, 0); g.lineTo(Math.cos(a1) * R, Math.sin(a1) * R);
      g.strokeStyle = 'rgba(29,47,111,.55)'; g.lineWidth = Math.max(1, R * 0.012); g.stroke();
      g.restore();
    }
  }
  function cutEvenness(cuts) {
    var n = cuts.length; if (n <= 1) return 1;
    var a = cuts.map(function (x) { return ((x % Math.PI) + Math.PI) % Math.PI; }).sort(function (p, q) { return p - q; }), ideal = Math.PI / n, err = 0;
    for (var i = 0; i < n; i++) { var gp = i + 1 < n ? a[i + 1] - a[i] : a[0] + Math.PI - a[i]; err = Math.max(err, Math.abs(gp - ideal) / ideal); }
    return clamp(1 - err * 1.6, 0, 1);
  }
  function countTops(it) { var h = {}; it.tops.forEach(function (p) { h[p.k] = (h[p.k] || 0) + 1; }); return h; }

  function pizzaOrder(shifts) {
    var tops = unlockedTops(shifts).map(function (t) { return t.k; });
    var maxK = shifts < 2 ? 1 : shifts < 5 ? 2 : 3;
    var nk = shifts < 2 ? 1 : rint(1, maxK);
    if (shifts >= 4 && Math.random() < 0.5) nk = maxK;
    nk = Math.min(nk, tops.length);
    var kinds = shuffle(tops.slice()).slice(0, nk);
    var newest = unlockedTops(shifts).sort(function (a, b) { return b.at - a.at; })[0];
    if (newest && newest.at > 0 && kinds.indexOf(newest.k) < 0 && Math.random() < 0.45) kinds[0] = newest.k;
    var list = kinds.map(function (k) {
      var n = shifts < 1 ? rint(3, 4) : nk === 1 ? rint(3, 6) : nk === 2 ? rint(2, 4) : rint(2, 3);
      return { k: k, n: n };
    });
    return { tops: list, done: shifts < 1 ? 1 : rint(0, 2), slices: shifts < 1 ? 4 : shifts < 3 ? pick([4, 6]) : pick([4, 6, 8]) };
  }

  // scores 0..1 for the three kitchen parts
  function pizzaScore(o, it) {
    var sS = clamp((coverage(it.sg) - 0.25) / 0.45, 0, 1), sC = clamp((coverage(it.cg) - 0.25) / 0.45, 0, 1);
    var want = {}, have = countTops(it), kinds = 0, wrong = 0, k;
    o.tops.forEach(function (t) { want[t.k] = t.n; var d = Math.abs((have[t.k] || 0) - t.n); kinds += d === 0 ? 1 : d === 1 ? 0.6 : d === 2 ? 0.3 : 0; });
    kinds /= Math.max(1, o.tops.length);
    for (k in have) if (!want[k]) wrong += have[k];
    var pts = it.tops, spread = 1;
    if (pts.length >= 2) {
      var mx = 0, my = 0; pts.forEach(function (p) { mx += p.x; my += p.y; }); mx /= pts.length; my /= pts.length;
      var s1 = clamp(1 - (Math.hypot(mx, my) - 0.12) / 0.4, 0, 1), close = 0, outer = 0;
      pts.forEach(function (p, i) {
        var m = 9; pts.forEach(function (q, j) { if (i !== j) m = Math.min(m, Math.hypot(p.x - q.x, p.y - q.y)); });
        if (m < 0.16) close++;
        if (Math.hypot(p.x, p.y) > 0.9) outer++;
      });
      spread = clamp(0.5 * s1 + 0.5 * (1 - close / pts.length) - 0.5 * outer / pts.length, 0, 1);
    } else if (!pts.length) spread = 0;
    var top = clamp(0.15 * sS + 0.15 * sC + 0.5 * kinds + 0.2 * spread - 0.12 * wrong, 0, 1);
    var b = it.baked == null ? it.bake : it.baked, d = Math.abs(b - DONE[o.done].c);
    var bake = d <= ZONE ? 1 : clamp(1 - (d - ZONE) / 0.3, 0.1, 1);
    var n = it.cuts.length, slices = n ? n * 2 : 1, even = cutEvenness(it.cuts);
    var cut = slices === o.slices ? 0.55 + 0.45 * even : Math.abs(slices - o.slices) === 2 ? 0.35 + 0.15 * even : n ? 0.2 : 0.1;
    return [{ k: 'top', v: top }, { k: 'bake', v: bake }, { k: 'cut', v: cut }];
  }

  // ---------- kitchen backgrounds ----------
  function tiles(g, W, H, top, col1, col2, sz) {
    g.fillStyle = col1; g.fillRect(0, top, W, H - top);
    g.strokeStyle = col2; g.lineWidth = 1.5;
    for (var x = (W / 2) % sz; x < W; x += sz) { g.beginPath(); g.moveTo(x, top); g.lineTo(x, H); g.stroke(); }
    for (var y = top + sz; y < H; y += sz) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  }
  function kitchenBg(g, W, H, u, fy) {
    fy = fy == null ? H * 0.86 : fy;
    tiles(g, W, H, 0, '#fff7ea', '#f1e2c8', 46 * u);
    g.fillStyle = '#e9d4b4'; g.fillRect(0, fy, W, H - fy);
    g.fillStyle = 'rgba(29,47,111,.08)'; g.fillRect(0, fy, W, 4);
  }

  // ---------- Pizzeria module ----------
  var PIZZERIA = {
    id: 'pizzeria', name: 'Pizzeria', sign: 'Pizzeria Okruszek', noun: ['pizzę', 'pizze', 'pizz'],
    wall: '#fbe3c4', wall2: '#f6d3a8', trim: '#e07a4f', counter: '#d4553b', counter2: '#b8432d', floor1: '#f3d6ad', floor2: '#e8c393',
    stations: [
      { k: 'dodatki', n: 'Dodatki', icon: '<circle cx="20" cy="21" r="15" fill="#efc57e" stroke="#1d2f6f" stroke-width="2.5"/><circle cx="20" cy="21" r="11" fill="#d9412e"/><circle cx="15" cy="17" r="3.5" fill="#f3e4c8" stroke="#1d2f6f" stroke-width="1.5"/><circle cx="25" cy="19" r="3.5" fill="#a8322a" stroke="#1d2f6f" stroke-width="1.5"/><circle cx="19" cy="26" r="3.5" fill="#a8322a" stroke="#1d2f6f" stroke-width="1.5"/>' },
      { k: 'piec', n: 'Piec', icon: '<path d="M5 34 v-12 a15 13 0 0 1 30 0 v12 z" fill="#d4553b" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/><path d="M12 34 v-7 a8 7 0 0 1 16 0 v7 z" fill="#3a1f1a"/><path d="M20 33 q-5 -3 -1 -9 q1 3 3 3 q2 3 -2 6z" fill="#f39a2a"/>' },
      { k: 'krojenie', n: 'Krojenie', icon: '<circle cx="17" cy="23" r="11" fill="#c9d6ea" stroke="#1d2f6f" stroke-width="2.5"/><circle cx="17" cy="23" r="3" fill="#1d2f6f"/><path d="M24 16 l10 -10" stroke="#1d2f6f" stroke-width="7" stroke-linecap="round"/><path d="M24 16 l10 -10" stroke="#f2b51d" stroke-width="3.5" stroke-linecap="round"/>' }
    ],
    unlocks: function (shifts) { return unlockedTops(shifts).length; },
    newOrder: pizzaOrder,
    newItem: newPizza,
    drawOrder: drawOrder,
    score: pizzaScore,
    where: function (it) { return it.stage === 'top' ? 'dodatki' : it.stage === 'oven' || it.stage === 'baked' ? 'piec' : it.stage === 'cut' ? 'krojenie' : 'podaj'; },
    ready: function (it) { return it.stage === 'plate'; },
    whereText: { dodatki: 'Pizza czeka przy dodatkach.', piec: 'Pizza jest w piecu.', krojenie: 'Pizza czeka na krojenie.', podaj: 'Pizza czeka na podanie.' },
    // the finished pizza on the counter
    drawServe: function (g, it, x, y, R) {
      g.save(); g.translate(x, y); g.scale(1, 0.5);
      circle(g, 0, R * 0.12, R * 1.18); g.fillStyle = 'rgba(29,47,111,.15)'; g.fill();
      circle(g, 0, 0, R * 1.16); g.fillStyle = '#fff'; g.fill(); ink(g, 2.5);
      circle(g, 0, 0, R * 0.98); g.strokeStyle = '#d4def0'; g.lineWidth = 2; g.stroke();
      drawCutPizza(g, it, R * 0.92, R * 0.035);
      g.restore();
    },
    // gentle per-frame work (the oven bakes while you are elsewhere)
    update: function (dt, S) {
      var it = S.item; if (!it) return;
      if (it.stage === 'oven') {
        it.insT = Math.min(1, it.insT + dt / 0.45);
        if (it.insT >= 1) {
          var was = it.bake;
          it.bake = Math.min(1, it.bake + dt / BAKE_S);
          var c = DONE[S.ticket.order.done].c;
          if (was < c - ZONE && it.bake >= c - ZONE) { S.sfx('tick'); S.flash('piec'); }
        }
      }
      for (var i = it.cutT.length - 1; i >= 0; i--) { it.cutT[i].t += dt; if (it.cutT[i].t > 0.45) it.cutT.splice(i, 1); }
    },
    hud: function (S) {   // tab badges
      var it = S.item, o = S.ticket && S.ticket.order, b = {};
      if (it && it.stage === 'oven' && o) { var c = DONE[o.done].c; b.piec = Math.abs(it.bake - c) <= ZONE ? '!' : Math.round(it.bake * 100) + '%'; }
      return b;
    }
  };

  // ----- station: Dodatki -----
  PIZZERIA.dodatki = {
    layout: function (S) {
      var W = S.W, H = S.H, u = S.u, L = S.L = {}, tops = unlockedTops(S.shifts);
      var bins = [{ k: 'sauce' }, { k: 'cheese' }].concat(tops.map(function (t) { return { k: t.k }; }));
      var n = bins.length;
      if (W > H * 1.2) {
        // pizza in the middle, bins in two groups (rows of two) on its sides
        var per = Math.ceil(n / 2), cols = per > 3 ? 2 : 1, rows = Math.ceil(per / cols);
        L.R = Math.min(H * 0.42, W * 0.24);
        L.cx = W / 2; L.cy = H * 0.5;
        var side = W / 2 - L.R - 40, b = Math.max(56, Math.min(124, (H - 30) / rows - 26, side / cols - 16)), gap = b + 24;
        bins.forEach(function (bn, i) {
          var left = i < per, j = left ? i : i - per, cnt = left ? per : n - per, r = Math.floor(j / cols), c = j % cols;
          var inRow = Math.min(cols, cnt - r * cols), rowsHere = Math.ceil(cnt / cols);
          var gw = cols * gap, gx = left ? L.cx - L.R - 40 - Math.min(side, gw + 30) / 2 : L.cx + L.R + 40 + Math.min(side, gw + 30) / 2;
          bn.x = gx + (c - (inRow - 1) / 2) * gap; bn.y = H / 2 + (r - (rowsHere - 1) / 2) * gap; bn.s = b;
        });
      } else {
        var cols2 = Math.min(n, W > 560 ? n : 5), rows2 = Math.ceil(n / cols2);
        var b2 = Math.max(56, Math.min(104, W / cols2 - 10));
        var binsH = rows2 * (b2 + 10) + 6;
        L.R = Math.max(90, Math.min(W * 0.43, (H - binsH - 30) / 2));
        if (H - binsH - L.R * 2 - 30 < 0) { b2 = Math.max(52, (H - L.R * 2 - 36) / rows2 - 10); binsH = rows2 * (b2 + 10) + 6; }
        L.cx = W / 2; L.cy = 14 + L.R + Math.max(0, (H - binsH - L.R * 2 - 28) / 2);
        bins.forEach(function (bn, i) {
          var r = Math.floor(i / cols2), c = i % cols2, inRow = Math.min(cols2, n - r * cols2);
          bn.x = W / 2 + (c - (inRow - 1) / 2) * (b2 + 8); bn.y = H - binsH + r * (b2 + 10) + b2 / 2 + 2; bn.s = b2;
        });
      }
      L.bins = bins;
      if (!S.tool || (S.tool !== 'sauce' && S.tool !== 'cheese' && !tops.some(function (t) { return t.k === S.tool; }))) S.tool = 'sauce';
    },
    enter: function (S) {
      var it = S.item; if (!it || it.stage !== 'top') return;
      if (coverage(it.sg) < 0.6) S.tool = 'sauce'; else if (coverage(it.cg) < 0.6) S.tool = 'cheese';
      else { var have = countTops(it), need = S.ticket.order.tops.filter(function (t) { return (have[t.k] || 0) < t.n; })[0]; if (need) S.tool = need.k; }
    },
    draw: function (g, S) {
      var L = S.L, u = S.u, W = S.W, H = S.H, it = S.item, T = S.T;
      // marble worktop + wooden peel
      g.fillStyle = '#f4efe6'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(160,150,170,.25)'; g.lineWidth = 2;
      for (var i = 0; i < 9; i++) { g.beginPath(); var y0 = (i * 97) % H; g.moveTo(0, y0); g.bezierCurveTo(W * 0.3, y0 + 40, W * 0.6, y0 - 50, W, y0 + 20); g.stroke(); }
      var R = L.R;
      g.save(); g.translate(L.cx, L.cy);
      circle(g, 4, 8, R * 1.1); g.fillStyle = 'rgba(29,47,111,.12)'; g.fill();
      circle(g, 0, 0, R * 1.1); g.fillStyle = '#d9a466'; g.fill(); ink(g, 3);
      g.strokeStyle = 'rgba(140,90,40,.3)'; g.lineWidth = 2; for (var k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(-R * 0.9, k * R * 0.28); g.quadraticCurveTo(0, k * R * 0.28 + 8, R * 0.9, k * R * 0.28); g.stroke(); }
      if (it && it.stage === 'top') drawPizza(g, it, R);
      else if (!it) { circle(g, 0, 0, R * 0.92); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill(); }
      g.restore();
      // bins
      var have = it ? countTops(it) : {}, o = S.ticket && S.ticket.order, want = {};
      if (o) o.tops.forEach(function (t) { want[t.k] = t.n; });
      L.bins.forEach(function (bn) {
        var s = bn.s, sel = S.tool === bn.k, x = bn.x, y = bn.y - (sel && !REDUCED ? 3 : 0);
        rr(g, x - s / 2, y - s / 2 + 4, s, s, s * 0.22); g.fillStyle = 'rgba(29,47,111,.18)'; g.fill();
        rr(g, x - s / 2, y - s / 2, s, s, s * 0.22); g.fillStyle = sel ? '#fff4d6' : '#fff'; g.fill(); ink(g, sel ? 4 : 2.5);
        if (sel) { rr(g, x - s / 2 + 4, y - s / 2 + 4, s - 8, s - 8, s * 0.18); g.strokeStyle = GOLD; g.lineWidth = 3; g.stroke(); }
        var inOrder = bn.k === 'sauce' || bn.k === 'cheese' || want[bn.k];
        if (bn.k === 'sauce') drawSauceIcon(g, x, y + s * 0.02, s * 0.3);
        else if (bn.k === 'cheese') drawCheeseIcon(g, x, y + s * 0.02, s * 0.3);
        else {
          g.beginPath(); g.ellipse(x, y + s * 0.12, s * 0.36, s * 0.24, 0, 0, 7); g.fillStyle = '#e8eef8'; g.fill(); ink(g, 2);
          [[-0.15, 0.06, 0.4], [0.15, 0.08, -0.6], [0, -0.06, 1.2], [-0.02, 0.16, 2]].forEach(function (p) { g.save(); g.translate(x + p[0] * s, y + p[1] * s); g.rotate(p[2]); drawTop(g, bn.k, s * 0.15); g.restore(); });
        }
        if (!inOrder && o) { rr(g, x - s / 2, y - s / 2, s, s, s * 0.22); g.fillStyle = 'rgba(255,255,255,.45)'; g.fill(); }
        // progress badge
        var bw = s * 0.62, bh = s * 0.3, bx = x + s / 2 - bw + s * 0.08, by = y - s / 2 - bh * 0.45;
        if (it && it.stage === 'top' && o) {
          var label = null, ok = false;
          if (bn.k === 'sauce' || bn.k === 'cheese') { var cv = coverage(bn.k === 'sauce' ? it.sg : it.cg); ok = cv >= 0.7; label = ok ? '✓' : Math.round(Math.min(cv / 0.7, 0.99) * 100) + '%'; }
          else if (want[bn.k]) { var hv = have[bn.k] || 0; ok = hv === want[bn.k]; label = hv + '/' + want[bn.k]; }
          else if (have[bn.k]) label = String(have[bn.k]);
          if (label) {
            rr(g, bx, by, bw, bh, bh / 2); g.fillStyle = ok ? '#c8f0c0' : have[bn.k] > want[bn.k] ? '#ffd9c6' : '#fff'; g.fill(); ink(g, 2);
            txt(g, label, bx + bw / 2, by + bh / 2 + 1, bh * 0.82, ok ? GREEN : INK);
          }
        }
      });
      // a dragged piece
      if (S.drag && S.drag.k && S.drag.moved) { g.save(); g.translate(S.drag.x, S.drag.y - 18 * u); g.scale(1.15, 1.15); drawTop(g, S.drag.k, TOP_R * R); g.restore(); }
      if (!it) { g.fillStyle = 'rgba(244,239,230,.55)'; g.fillRect(0, 0, W, H); }
    },
    toLocal: function (S, x, y) { return { x: (x - S.L.cx) / S.L.R, y: (y - S.L.cy) / S.L.R }; },
    hitBin: function (S, x, y) { var r = null; S.L.bins.forEach(function (bn) { if (Math.abs(x - bn.x) < bn.s / 2 + 4 && Math.abs(y - bn.y) < bn.s / 2 + 4) r = bn; }); return r; },
    place: function (S, k, p) {
      var it = S.item, d = Math.hypot(p.x, p.y);
      if (d > 0.97) return false;
      if (d > 0.9) { p.x *= 0.9 / d; p.y *= 0.9 / d; }
      if (it.tops.length >= 30) return false;
      it.tops.push({ k: k, x: p.x, y: p.y, rot: rnd(-0.6, 0.6) + (k === 'papryka' || k === 'bazylia' ? rnd(0, 6) : 0), s: rnd(0.92, 1.08), t0: performance.now() / 1000 });
      S.sfx('pop'); S.pop(S.L.cx + p.x * S.L.R, S.L.cy + p.y * S.L.R);
      var o = S.ticket.order, want = 0; o.tops.forEach(function (t) { if (t.k === k) want = t.n; });
      if (want && countTops(it)[k] === want) { S.sfx('star'); S.say('Gotowe: ' + TOPB[k].n + '!'); }
      return true;
    },
    paint: function (S, a, b) {
      var it = S.item, tool = S.tool, dist = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.max(1, Math.ceil(dist / 0.06));
      for (var i = 1; i <= steps; i++) {
        var x = lerp(a.x, b.x, i / steps), y = lerp(a.y, b.y, i / steps);
        if (Math.hypot(x, y) > INNER + 0.1) continue;
        if (tool === 'sauce') dabSauce(it, x, y); else dabCheese(it, x, y);
      }
      var now = S.T; if (now - (S.lastPaint || 0) > 0.12) { S.lastPaint = now; S.sfx('paint'); }
      if (tool === 'cheese' && !REDUCED && Math.random() < 0.5) S.crumb(S.L.cx + b.x * S.L.R, S.L.cy + b.y * S.L.R, '#ffd64d');
      var cv = coverage(tool === 'sauce' ? it.sg : it.cg);
      if (cv >= 0.7 && !S['done_' + tool]) { S['done_' + tool] = true; S.sfx('star'); S.say(tool === 'sauce' ? 'Sos gotowy!' : 'Ser gotowy!'); }
    },
    down: function (S, x, y) {
      var it = S.item; if (!it || it.stage !== 'top') return;
      var bn = this.hitBin(S, x, y);
      if (bn) { if (S.tool !== bn.k) { S.tool = bn.k; S.sfx('tap'); } S.drag = { bin: true, k: bn.k === 'sauce' || bn.k === 'cheese' ? null : bn.k, x: x, y: y, x0: x, y0: y, moved: false }; return; }
      var p = this.toLocal(S, x, y);
      if (Math.hypot(p.x, p.y) > 1.02) return;
      // grab a placed piece (to move it or throw it away)
      var hit = -1;
      for (var i = it.tops.length - 1; i >= 0; i--) if (Math.hypot(it.tops[i].x - p.x, it.tops[i].y - p.y) < TOP_R * 1.1) { hit = i; break; }
      if (S.tool === 'sauce' || S.tool === 'cheese') {
        if (hit >= 0) { S.drag = { piece: hit, x: x, y: y, x0: x, y0: y, moved: false, paintFrom: p }; return; }
        S.drag = { paint: true, last: p }; this.paint(S, p, p); return;
      }
      S.drag = { piece: hit, x: x, y: y, x0: x, y0: y, moved: false, at: p };
    },
    move: function (S, x, y) {
      var d = S.drag; if (!d) return;
      if (d.paint) { var p = this.toLocal(S, x, y); this.paint(S, d.last, p); d.last = p; return; }
      d.x = x; d.y = y;
      if (!d.moved && Math.hypot(x - d.x0, y - d.y0) > 10) {
        d.moved = true;
        if (d.paintFrom) { d.piece = -1; d.paint = true; d.last = d.paintFrom; this.paint(S, d.last, this.toLocal(S, x, y)); return; }
        if (d.piece >= 0) { var pc = S.item.tops.splice(d.piece, 1)[0]; d.k = pc.k; d.lifted = pc; }
      }
    },
    up: function (S, x, y) {
      var d = S.drag; S.drag = null; if (!d || d.paint) return;
      var it = S.item, p = this.toLocal(S, x, y - (d.moved ? 18 * S.u : 0));
      if (d.bin) { if (d.moved && d.k) this.place(S, d.k, p); return; }
      if (d.moved && d.lifted) {
        if (Math.hypot(p.x, p.y) <= 0.97) { var dd = Math.hypot(p.x, p.y); if (dd > 0.9) { p.x *= 0.9 / dd; p.y *= 0.9 / dd; } d.lifted.x = p.x; d.lifted.y = p.y; it.tops.push(d.lifted); S.sfx('place'); }
        else { S.sfx('whoosh'); S.say('Wyrzucone!'); }
        return;
      }
      if (!d.moved && S.tool !== 'sauce' && S.tool !== 'cheese') this.place(S, S.tool, this.toLocal(S, x, y));
    },
    hint: function (S) {
      var it = S.item; if (!it) return 'Najpierw przyjmij zamówienie przy ladzie.';
      if (it.stage !== 'top') return PIZZERIA.whereText[PIZZERIA.where(it)];
      if (coverage(it.sg) < 0.7) return S.tool === 'sauce' ? 'Rozsmaruj sos palcem po pizzy.' : 'Wybierz sos i rozsmaruj go.';
      if (coverage(it.cg) < 0.7) return S.tool === 'cheese' ? 'Posyp pizzę serem: pomaluj palcem.' : 'Wybierz ser i posyp pizzę.';
      if (!this.complete(S)) return 'Połóż dodatki jak na karteczce.';
      return 'Wszystko jest! Do pieca!';
    },
    complete: function (S) { var have = countTops(S.item); return S.ticket.order.tops.every(function (t) { return have[t.k] === t.n; }); },
    buttons: function (S) {
      var it = S.item;
      if (!it) return [{ id: 'goLada', label: '← Do lady', main: true, on: function () { S.go('lada'); } }];
      if (it.stage !== 'top') { var w = PIZZERIA.where(it); return [{ id: 'goWhere', label: 'Idź: ' + S.stationName(w) + ' →', main: true, on: function () { S.go(w); } }]; }
      var ready = coverage(it.sg) >= 0.5 && coverage(it.cg) >= 0.5 && this.complete(S);
      return [
        { id: 'clear', label: '↺ Od nowa', on: function () { S.replaceItem(); S.sfx('whoosh'); S.done_sauce = S.done_cheese = false; S.tool = 'sauce'; } },
        { id: 'oven', label: 'Do pieca →', main: true, pulse: ready, on: function () { it.stage = 'oven'; it.insT = 0; S.sfx('whoosh'); S.go('piec'); } }
      ];
    }
  };

  // ----- station: Piec -----
  PIZZERIA.piec = {
    layout: function (S) {
      var W = S.W, H = S.H, L = S.L = {};
      L.cx = W / 2; L.gy = 30; L.gh = Math.max(40, Math.min(56, H * 0.1));
      L.fy = H - Math.max(18, H * 0.06);                                    // floor line
      var top = L.gy + L.gh + 58;                                           // below the gauge and its label
      L.ow = Math.min(W * 0.86, 640, (L.fy - top) / 0.62); L.oh = L.ow * 0.68;
      L.oy = L.fy - L.oh;
      L.mx = L.cx; L.my = L.oy + L.oh * 0.84; L.mw = L.ow * 0.52; L.mh = L.oh * 0.42;
      L.pr = L.mw * 0.36;
    },
    draw: function (g, S) {
      var L = S.L, u = S.u, W = S.W, H = S.H, it = S.item, T = S.T, o = S.ticket && S.ticket.order;
      kitchenBg(g, W, H, u, L.fy);
      var x0 = L.cx - L.ow / 2, y0 = L.oy, ow = L.ow, oh = L.oh;
      // oven body
      g.save();
      function body() { g.beginPath(); g.moveTo(x0, y0 + oh); g.lineTo(x0, y0 + oh * 0.48); g.bezierCurveTo(x0, y0 - oh * 0.12, x0 + ow, y0 - oh * 0.12, x0 + ow, y0 + oh * 0.48); g.lineTo(x0 + ow, y0 + oh); g.closePath(); }
      body(); g.fillStyle = '#d4553b'; g.fill(); g.save(); g.clip();
      g.strokeStyle = '#b13f2a'; g.lineWidth = 2.5; var bh = oh / 9;
      for (var r = 0; r < 10; r++) { var yy = y0 + r * bh; g.beginPath(); g.moveTo(x0, yy); g.lineTo(x0 + ow, yy); g.stroke(); for (var c = (r % 2) * bh; c < ow; c += bh * 2) { g.beginPath(); g.moveTo(x0 + c, yy); g.lineTo(x0 + c, yy + bh); g.stroke(); } }
      g.restore(); body(); ink(g, 4);
      // chimney
      rr(g, L.cx + ow * 0.18, y0 - oh * 0.14, ow * 0.12, oh * 0.16, 4); g.fillStyle = '#9b3a29'; g.fill(); ink(g, 3);
      // mouth
      var mx = L.mx, my = L.my, mw = L.mw, mh = L.mh;
      g.beginPath(); g.moveTo(mx - mw / 2, my); g.lineTo(mx - mw / 2, my - mh * 0.45); g.bezierCurveTo(mx - mw / 2, my - mh * 1.2, mx + mw / 2, my - mh * 1.2, mx + mw / 2, my - mh * 0.45); g.lineTo(mx + mw / 2, my); g.closePath();
      var hot = it && it.stage === 'oven';
      var fl = REDUCED ? 0.5 : 0.5 + 0.5 * Math.sin(T * 7) * Math.sin(T * 3.1);
      var grd = g.createRadialGradient(mx, my - mh * 0.2, 4, mx, my - mh * 0.2, mw * 0.6);
      grd.addColorStop(0, hot ? 'rgb(255,' + Math.round(170 + 40 * fl) + ',80)' : '#7a3a22'); grd.addColorStop(1, '#3a1f1a');
      g.fillStyle = grd; g.fill(); ink(g, 4);
      // fire logs at the back
      g.save(); g.beginPath(); g.moveTo(mx - mw / 2, my); g.lineTo(mx - mw / 2, my - mh * 0.45); g.bezierCurveTo(mx - mw / 2, my - mh * 1.2, mx + mw / 2, my - mh * 1.2, mx + mw / 2, my - mh * 0.45); g.lineTo(mx + mw / 2, my); g.closePath(); g.clip();
      for (var f = 0; f < 3; f++) {
        var fx = mx - mw * 0.28 + f * mw * 0.12, fh = mh * (0.35 + 0.12 * Math.sin(T * 6 + f * 2)) * (hot ? 1 : 0.45);
        g.beginPath(); g.moveTo(fx - mw * 0.06, my - mh * 0.15); g.quadraticCurveTo(fx, my - mh * 0.15 - fh * 1.5, fx + mw * 0.06, my - mh * 0.15); g.closePath();
        g.fillStyle = f === 1 ? '#ffd85a' : '#f39a2a'; g.fill();
      }
      // pizza inside
      if (it && it.stage === 'oven') {
        var e = it.insT, py = lerp(H + L.pr, my - mh * 0.12, 1 - Math.pow(1 - e, 3));
        g.save(); g.translate(mx + mw * 0.08, py); g.scale(1, 0.42); drawPizza(g, it, L.pr); g.restore();
      }
      g.restore();
      // oven floor lip
      rr(g, mx - mw * 0.62, my - 4, mw * 1.24, 14 * u + 6, 6); g.fillStyle = '#8a3a28'; g.fill(); ink(g, 3);
      g.restore();
      // pizza on the peel in front (baked)
      if (it && it.stage === 'baked') {
        // pulled out on the peel, held up in front of the oven
        var pr2 = L.pr * 1.25, py2 = my - mh * 0.25;
        g.save(); g.translate(mx, py2);
        rr(g, -pr2 * 0.16, pr2 * 0.4, pr2 * 0.32, H, 6); g.fillStyle = '#c99257'; g.fill(); ink(g, 2.5);
        g.scale(1, 0.62); circle(g, 0, 0, pr2 * 1.12); g.fillStyle = '#d9a466'; g.fill(); ink(g, 3);
        drawPizza(g, it, pr2); g.restore();
      }
      // gauge
      if (o) {
        var gw = Math.min(W - 40, Math.max(L.ow, 300)), gx = L.cx - gw / 2, gy = L.gy, gh = L.gh, c = DONE[o.done].c;
        rr(g, gx, gy, gw, gh, gh / 2); g.fillStyle = '#fff'; g.fill();
        g.save(); rr(g, gx, gy, gw, gh, gh / 2); g.clip();
        for (var s = 0; s < 40; s++) { g.fillStyle = crustCol(s / 40); g.fillRect(gx + gw * s / 40, gy, gw / 40 + 1, gh); }
        var val = it ? (it.stage === 'oven' || it.stage === 'baked' || it.baked != null ? it.bake : 0) : 0;
        g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(gx + gw * val, gy, gw * (1 - val), gh);
        g.restore();
        rr(g, gx, gy, gw, gh, gh / 2); ink(g, 3);
        // target frame + its label (flames and the word) under the gauge
        var zx = gx + gw * (c - ZONE), zw = gw * ZONE * 2, inZone = Math.abs(val - c) <= ZONE && it && it.stage === 'oven';
        var pz = inZone && !REDUCED ? 1 + Math.sin(T * 10) * 0.06 : 1;
        g.save(); g.translate(zx + zw / 2, gy + gh / 2); g.scale(pz, pz);
        rr(g, -zw / 2, -gh / 2 - 7, zw, gh + 14, 10); g.strokeStyle = inZone ? GREEN : GOLD; g.lineWidth = 6; g.stroke();
        g.restore();
        var nf = DONE[o.done].f, fsz = Math.min(24, gh * 0.42), lab = DONE[o.done].n;
        g.font = Math.round(fsz) + 'px ' + FONT;
        var lw2 = nf * fsz * 0.9 + g.measureText(lab).width + 26, lx = clamp(zx + zw / 2 - lw2 / 2, 4, W - lw2 - 4), ly = gy + gh + 10;
        rr(g, lx, ly, lw2, fsz + 14, (fsz + 14) / 2); g.fillStyle = inZone ? '#c8f0c0' : '#fff'; g.fill(); ink(g, 2.5);
        for (var q = 0; q < nf; q++) flame(g, lx + 12 + fsz * 0.4 + q * fsz * 0.9, ly + (fsz + 14) / 2, fsz * 0.38, true);
        txt(g, lab, lx + 14 + nf * fsz * 0.9, ly + (fsz + 14) / 2 + 1, fsz, INK, 'left');
        // needle (from above)
        var nx = gx + gw * val;
        g.beginPath(); g.moveTo(nx, gy - 3); g.lineTo(nx - 11, gy - 19); g.lineTo(nx + 11, gy - 19); g.closePath(); g.fillStyle = INK; g.fill();
        g.beginPath(); g.moveTo(nx, gy - 4); g.lineTo(nx, gy + gh + 4); g.strokeStyle = INK; g.lineWidth = 4; g.stroke();
        if (inZone) txt(g, 'Teraz!', clamp(nx + 16, 4, W - 80), gy - 13, 24, GREEN, 'left');
      }
      // steam from the chimney
      if (hot && !REDUCED && Math.random() < 0.25) S.steam(L.cx + ow * 0.24, y0 - oh * 0.14);
      if (hot && !REDUCED && it.bake > 0.4 && Math.random() < 0.1) S.steam(mx + rnd(-mw * 0.2, mw * 0.2), my - mh * 0.9);
    },
    takeOut: function (S) {
      var it = S.item; it.stage = 'baked'; it.baked = it.bake; S.sfx('whoosh');
      var c = DONE[S.ticket.order.done].c, d = it.bake - c;
      S.say(Math.abs(d) <= ZONE ? 'Idealnie upieczona!' : d < 0 ? 'Trochę blada, ale zjadliwa!' : 'Mocno przypieczona!');
      if (Math.abs(d) <= ZONE) { S.sfx('star'); S.sparkle(S.L.mx, S.L.my); }
    },
    down: function (S, x, y) {
      var it = S.item, L = S.L; if (!it) return;
      var onOven = Math.abs(x - L.cx) < L.ow / 2 && y > L.oy - 20 && y < L.oy + L.oh + 20;
      if (it.stage === 'oven' && it.insT >= 1 && onOven) this.takeOut(S);
      else if (it.stage === 'top' && onOven) { it.stage = 'oven'; it.insT = 0; S.sfx('whoosh'); }
    },
    hint: function (S) {
      var it = S.item; if (!it) return 'Najpierw przyjmij zamówienie przy ladzie.';
      if (it.stage === 'top') return 'Najpierw połóż dodatki. Albo włóż pizzę od razu.';
      if (it.stage === 'oven') return 'Wyjmij pizzę, gdy wskazówka będzie w ramce.';
      if (it.stage === 'baked') return 'Upieczona! Teraz krojenie.';
      return PIZZERIA.whereText[PIZZERIA.where(it)];
    },
    buttons: function (S) {
      var it = S.item, me = this;
      if (!it) return [{ id: 'goLada', label: '← Do lady', main: true, on: function () { S.go('lada'); } }];
      if (it.stage === 'top') return [{ id: 'goTop', label: '← Dodatki', on: function () { S.go('dodatki'); } }, { id: 'in', label: 'Włóż pizzę', main: true, on: function () { it.stage = 'oven'; it.insT = 0; S.sfx('whoosh'); } }];
      if (it.stage === 'oven') { var c = DONE[S.ticket.order.done].c; return [{ id: 'out', label: 'Wyjmij!', main: true, pulse: Math.abs(it.bake - c) <= ZONE, disabled: it.insT < 1, on: function () { me.takeOut(S); } }]; }
      if (it.stage === 'baked') return [{ id: 'cut', label: 'Do krojenia →', main: true, pulse: true, on: function () { it.stage = 'cut'; S.go('krojenie'); } }];
      var w = PIZZERIA.where(it); return [{ id: 'goWhere', label: 'Idź: ' + S.stationName(w) + ' →', main: true, on: function () { S.go(w); } }];
    }
  };

  // ----- station: Krojenie -----
  PIZZERIA.krojenie = {
    layout: function (S) {
      var W = S.W, H = S.H, L = S.L = {};
      L.R = Math.min(W * 0.4, H * 0.4, 280); L.cx = W / 2; L.cy = H / 2 + 4;
    },
    enter: function (S) { if (S.item && S.item.stage === 'baked') S.item.stage = 'cut'; },
    draw: function (g, S) {
      var L = S.L, W = S.W, H = S.H, u = S.u, it = S.item, T = S.T, o = S.ticket && S.ticket.order;
      kitchenBg(g, W, H, u);
      var R = L.R;
      g.save(); g.translate(L.cx, L.cy);
      circle(g, 5, 9, R * 1.14); g.fillStyle = 'rgba(29,47,111,.12)'; g.fill();
      circle(g, 0, 0, R * 1.14); g.fillStyle = '#c99257'; g.fill(); ink(g, 3);
      circle(g, 0, 0, R * 1.06); g.strokeStyle = 'rgba(120,70,30,.35)'; g.lineWidth = 3; g.stroke();
      // handle
      rr(g, R * 1.08, -R * 0.12, R * 0.34, R * 0.24, R * 0.1); g.fillStyle = '#c99257'; g.fill(); ink(g, 3);
      circle(g, R * 1.3, 0, R * 0.05); g.fillStyle = '#8a5a33'; g.fill();
      if (it && it.stage === 'cut') {
        var good = o && it.cuts.length * 2 === o.slices;
        drawCutPizza(g, it, R, it.cuts.length ? (good ? 6 : 2.5) : 0);
        // guides
        if (o && S.guides && it.cuts.length * 2 < o.slices + 1) {
          g.setLineDash([10, 9]); g.strokeStyle = 'rgba(29,47,111,.45)'; g.lineWidth = 3;
          var n = o.slices / 2;
          for (var i = 0; i < n; i++) { var a = i * Math.PI / n + Math.PI / 2, had = it.cuts.some(function (c) { return angDiff(c, a) < 0.05; }); if (had) continue; g.beginPath(); g.moveTo(-Math.cos(a) * R * 1.08, -Math.sin(a) * R * 1.08); g.lineTo(Math.cos(a) * R * 1.08, Math.sin(a) * R * 1.08); g.stroke(); }
          g.setLineDash([]);
        }
        // cutter animations
        it.cutT.forEach(function (c) {
          var k = clamp(c.t / 0.35, 0, 1), px = lerp(-R * 1.1, R * 1.1, k), wx = Math.cos(c.a) * px, wy = Math.sin(c.a) * px;
          circle(g, wx, wy, R * 0.12); g.fillStyle = '#e1e8f4'; g.fill(); ink(g, 3);
          circle(g, wx, wy, R * 0.035); g.fillStyle = INK; g.fill();
        });
      } else if (!it || it.stage === 'top' || it.stage === 'oven') {
        circle(g, 0, 0, R * 0.9); g.setLineDash([12, 10]); g.strokeStyle = 'rgba(29,47,111,.3)'; g.lineWidth = 3; g.stroke(); g.setLineDash([]);
      }
      g.restore();
      // the swipe trail
      if (S.drag && S.drag.cut) {
        g.beginPath(); g.moveTo(S.drag.x0, S.drag.y0); g.lineTo(S.drag.x, S.drag.y); g.strokeStyle = 'rgba(227,160,8,.75)'; g.lineWidth = 7; g.lineCap = 'round'; g.stroke();
      }
      // slice counter
      if (it && it.stage === 'cut' && o) {
        var n2 = it.cuts.length ? it.cuts.length * 2 : 1, good2 = n2 === o.slices, bs = Math.max(48, Math.min(76, H * 0.13));
        var bx = W > H * 1.2 ? L.cx + R * 1.5 + bs : W - bs * 0.75 - 8, by = W > H * 1.2 ? L.cy : bs * 0.7 + 6;
        circle(g, bx, by, bs * 0.62); g.fillStyle = good2 ? '#c8f0c0' : '#fff'; g.fill(); ink(g, 3);
        txt(g, String(n2), bx, by + 2, bs * 0.8, good2 ? GREEN : INK);
        txt(g, 'kawałki', bx, by + bs * 0.62 + 14, 20, MUTED);
      }
    },
    down: function (S, x, y) { var it = S.item; if (!it || it.stage !== 'cut') return; S.drag = { cut: true, x0: x, y0: y, x: x, y: y }; },
    move: function (S, x, y) { if (S.drag && S.drag.cut) { S.drag.x = x; S.drag.y = y; } },
    up: function (S, x, y) {
      var d = S.drag; S.drag = null; if (!d || !d.cut) return;
      var it = S.item, L = S.L, R = L.R, dx = x - d.x0, dy = y - d.y0, len = Math.hypot(dx, dy);
      if (len < R * 0.3) return;
      var dist = Math.abs((L.cx - d.x0) * dy - (L.cy - d.y0) * dx) / len;
      var t = ((L.cx - d.x0) * dx + (L.cy - d.y0) * dy) / (len * len);
      if (len < R * 0.75 || dist > R * 0.42 || t < -0.2 || t > 1.2) { S.sfx('tap'); S.say('Przeciągnij przez cały środek!'); return; }
      var a = Math.atan2(dy, dx); a = ((a % Math.PI) + Math.PI) % Math.PI;
      var o = S.ticket.order, snapped = false;
      if (S.guides) {
        var n = o.slices / 2, best = null;
        for (var i = 0; i < n; i++) { var ga = (i * Math.PI / n + Math.PI / 2) % Math.PI; if (angDiff(ga, a) < 0.26 && (best == null || angDiff(ga, a) < angDiff(best, a))) best = ga; }
        if (best != null) { a = best; snapped = true; }
      }
      if (!snapped) a = Math.round(a / (Math.PI / 60)) * (Math.PI / 60);
      if (it.cuts.some(function (c) { return angDiff(c, a) < 0.14; })) { S.sfx('tap'); S.say('Tu już jest cięcie.'); return; }
      if (it.cuts.length >= 6) { S.say('Wystarczy krojenia!'); return; }
      it.cuts.push(a); it.cutT.push({ a: a, t: 0 }); S.sfx('whoosh');
      var n2 = it.cuts.length * 2;
      if (n2 === o.slices) { S.sfx('star'); S.say(n2 + ' kawałków. Super!'); S.sparkle(L.cx, L.cy); }
      else if (n2 > o.slices) S.say(n2 + ' kawałków. Trochę za dużo.');
    },
    hint: function (S) {
      var it = S.item; if (!it) return 'Najpierw przyjmij zamówienie przy ladzie.';
      if (it.stage === 'top' || it.stage === 'oven') return 'Najpierw upiecz pizzę.';
      if (it.stage !== 'cut') return PIZZERIA.whereText[PIZZERIA.where(it)];
      var o = S.ticket.order, n = it.cuts.length * 2;
      if (n === o.slices) return 'Pokrojona! Podaj gościowi.';
      return 'Przeciągnij palcem przez środek pizzy. Potrzeba ' + o.slices + ' kawałków.';
    },
    buttons: function (S) {
      var it = S.item;
      if (!it) return [{ id: 'goLada', label: '← Do lady', main: true, on: function () { S.go('lada'); } }];
      if (it.stage === 'top' || it.stage === 'oven') { var w = PIZZERIA.where(it); return [{ id: 'goWhere', label: 'Idź: ' + S.stationName(w) + ' →', main: true, on: function () { S.go(w); } }]; }
      if (it.stage === 'baked') return [{ id: 'take', label: 'Połóż na desce', main: true, on: function () { it.stage = 'cut'; } }];
      var o = S.ticket.order;
      return [
        { id: 'guides', label: S.guides ? 'Linie: tak' : 'Linie: nie', on: function () { S.guides = !S.guides; S.sfx('tap'); } },
        { id: 'undo', label: '↺ Sklej', disabled: !it.cuts.length, on: function () { it.cuts = []; S.sfx('pop'); } },
        { id: 'serve', label: 'Podaj →', main: true, pulse: it.cuts.length * 2 === o.slices, on: function () { it.stage = 'plate'; S.sfx('whoosh'); S.go('podaj'); } }
      ];
    }
  };
  function angDiff(a, b) { var d = Math.abs(((a - b) % Math.PI + Math.PI) % Math.PI); return Math.min(d, Math.PI - d); }

  // hub card picture
  PIZZERIA.card = function (g, w, h, T) {
    g.fillStyle = '#bfe3ff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#8fd06b'; g.fillRect(0, h * 0.86, w, h * 0.14);
    var x0 = w * 0.14, x1 = w * 0.86, y0 = h * 0.22, y1 = h * 0.88;
    rr(g, x0, y0, x1 - x0, y1 - y0, 6); g.fillStyle = '#fbe3c4'; g.fill(); ink(g, 3);
    // sign
    rr(g, x0 + 10, h * 0.06, x1 - x0 - 20, h * 0.15, 10); g.fillStyle = '#fff'; g.fill(); ink(g, 3);
    txt(g, 'Pizzeria Okruszek', w / 2, h * 0.137, h * 0.11, '#c8432d');
    // awning
    var n = 8, aw = (x1 - x0 + 16) / n;
    for (var i = 0; i < n; i++) {
      g.beginPath(); g.moveTo(x0 - 8 + i * aw, y0 + 4); g.lineTo(x0 - 8 + (i + 1) * aw, y0 + 4); g.lineTo(x0 - 8 + (i + 1) * aw, y0 + h * 0.12); g.arc(x0 - 8 + (i + 0.5) * aw, y0 + h * 0.12, aw / 2, 0, Math.PI); g.closePath();
      g.fillStyle = i % 2 ? '#fff' : '#e2533f'; g.fill(); ink(g, 2);
    }
    // door
    rr(g, w * 0.6, h * 0.48, w * 0.15, y1 - h * 0.48, 6); g.fillStyle = '#b5713c'; g.fill(); ink(g, 2.5);
    rr(g, w * 0.62, h * 0.52, w * 0.11, h * 0.14, 4); g.fillStyle = '#d6efff'; g.fill(); ink(g, 2);
    // window with a pizza
    rr(g, w * 0.2, h * 0.46, w * 0.34, h * 0.3, 6); g.fillStyle = '#d6efff'; g.fill(); ink(g, 2.5);
    var fake = { tops: [{ k: 'salami', n: 4 }, { k: 'grzyby', n: 2 }], done: 1, slices: 6 };
    drawOrderPizza(g, fake, w * 0.37, h * 0.62, h * 0.12);
  };

  // =====================================================================
  // Burgerownia (coming soon): only a picture for now
  // =====================================================================
  var BURGER = {
    id: 'burger', name: 'Burgerownia', soon: true,
    card: function (g, w, h) {
      g.fillStyle = '#bfe3ff'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#8fd06b'; g.fillRect(0, h * 0.86, w, h * 0.14);
      var x0 = w * 0.14, x1 = w * 0.86, y0 = h * 0.22, y1 = h * 0.88;
      rr(g, x0, y0, x1 - x0, y1 - y0, 6); g.fillStyle = '#e5f0ff'; g.fill(); ink(g, 3);
      rr(g, x0 + 10, h * 0.06, x1 - x0 - 20, h * 0.15, 10); g.fillStyle = '#fff'; g.fill(); ink(g, 3);
      txt(g, 'Burgerownia', w / 2, h * 0.137, h * 0.11, '#3f86d8');
      var n = 8, aw = (x1 - x0 + 16) / n;
      for (var i = 0; i < n; i++) {
        g.beginPath(); g.moveTo(x0 - 8 + i * aw, y0 + 4); g.lineTo(x0 - 8 + (i + 1) * aw, y0 + 4); g.lineTo(x0 - 8 + (i + 1) * aw, y0 + h * 0.12); g.arc(x0 - 8 + (i + 0.5) * aw, y0 + h * 0.12, aw / 2, 0, Math.PI); g.closePath();
        g.fillStyle = i % 2 ? '#fff' : '#f2b51d'; g.fill(); ink(g, 2);
      }
      rr(g, w * 0.6, h * 0.48, w * 0.15, y1 - h * 0.48, 6); g.fillStyle = '#7d8fb0'; g.fill(); ink(g, 2.5);
      // burger
      var bx = w * 0.37, by = h * 0.62, s = h * 0.13;
      g.beginPath(); g.moveTo(bx - s * 1.2, by); g.bezierCurveTo(bx - s * 1.2, by - s * 1.3, bx + s * 1.2, by - s * 1.3, bx + s * 1.2, by); g.closePath(); g.fillStyle = '#e9a13f'; g.fill(); ink(g, 2.5);
      rr(g, bx - s * 1.3, by, s * 2.6, s * 0.25, 4); g.fillStyle = '#5cbc4b'; g.fill(); ink(g, 2);
      rr(g, bx - s * 1.2, by + s * 0.25, s * 2.4, s * 0.4, 6); g.fillStyle = '#7a4326'; g.fill(); ink(g, 2);
      rr(g, bx - s * 1.2, by + s * 0.65, s * 2.4, s * 0.4, 8); g.fillStyle = '#e9a13f'; g.fill(); ink(g, 2.5);
      [[-0.5, -0.6], [0.1, -0.8], [0.6, -0.5]].forEach(function (p) { g.beginPath(); g.ellipse(bx + p[0] * s, by + p[1] * s, s * 0.1, s * 0.05, 0.3, 0, 7); g.fillStyle = '#fff6d8'; g.fill(); });
    }
  };

  // next restaurants go here
  var RESTAURANTS = [PIZZERIA, BURGER];

  // =====================================================================
  // Tile picture
  // =====================================================================
  var PIC = '<ellipse cx="60" cy="60" rx="40" ry="8" fill="#d9a466" stroke="#1d2f6f" stroke-width="2"/>' +
    '<circle cx="60" cy="44" r="24" fill="#efc57e" stroke="#1d2f6f" stroke-width="2.5"/><circle cx="60" cy="44" r="19" fill="#d9412e"/>' +
    '<path d="M44 44 q2 -14 16 -17 q14 3 16 17 q-3 12 -16 14 q-13 -2 -16 -14z" fill="#ffd95a"/>' +
    '<circle cx="47" cy="37" r="3.6" fill="#d8433b" stroke="#1d2f6f" stroke-width="1.4"/><circle cx="74" cy="38" r="3.6" fill="#d8433b" stroke="#1d2f6f" stroke-width="1.4"/><circle cx="69" cy="54" r="3.2" fill="#d8433b" stroke="#1d2f6f" stroke-width="1.4"/>' +
    '<circle cx="54" cy="43" r="2.4" fill="#1d2f6f"/><circle cx="66" cy="43" r="2.4" fill="#1d2f6f"/><circle cx="54.8" cy="42.2" r=".8" fill="#fff"/><circle cx="66.8" cy="42.2" r=".8" fill="#fff"/>' +
    '<path d="M55 49 q5 5 10 0" fill="none" stroke="#1d2f6f" stroke-width="2" stroke-linecap="round"/><circle cx="50" cy="48" r="2.4" fill="#f39cab" opacity=".8"/><circle cx="70" cy="48" r="2.4" fill="#f39cab" opacity=".8"/>' +
    '<path d="M47 22 q-6 -8 3 -11 q3 -7 10 -4 q7 -3 10 4 q9 3 3 11 z" fill="#fff" stroke="#1d2f6f" stroke-width="2" stroke-linejoin="round"/><rect x="48" y="20" width="24" height="6" rx="2" fill="#fff" stroke="#1d2f6f" stroke-width="2"/>' +
    '<path d="M94 30 q-3 -5 0 -9 M100 32 q-3 -6 0 -11" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".9"/>' +
    '<path d="M86 50 l18 -6 l-4 16 z" fill="#ffd95a" stroke="#1d2f6f" stroke-width="2" stroke-linejoin="round"/><path d="M86 50 l18 -6" stroke="#efc57e" stroke-width="3"/><circle cx="96" cy="51" r="2" fill="#d8433b"/>' +
    '<path d="M14 26 l2 5 l5 .5 l-4 3.5 l1 5 l-4 -2.5 l-4 2.5 l1 -5 l-4 -3.5 l5 -.5 z" fill="#f2b51d"/>';

  // =====================================================================
  // CSS
  // =====================================================================
  var CSS = [
    '.rs{display:flex;flex-direction:column;font-family:' + FONT + ';color:' + INK + ';background:#fde8d4;overflow:hidden}',
    '.rs button{font:inherit;color:inherit;cursor:pointer}',
    '.rs-hub{position:absolute;inset:0;overflow:auto;background:linear-gradient(#fde8d4,#fff4e6 70%);padding:14px max(14px,env(safe-area-inset-left,0px)) 40px}',
    '.rs-hub-in{max-width:1800px;margin:0 auto;display:flex;flex-direction:column;gap:16px}',
    '.rs-hd{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}',
    '.rs-hd h2{margin:0;font-weight:400;font-size:2.2rem;line-height:1}',
    '.rs-hd p{margin:0;color:' + MUTED + ';font-size:1.15rem}',
    '.rs-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,420px));gap:18px;justify-content:center}',
    '.rs-card{position:relative;background:#fff;border:3px solid ' + INK + ';border-radius:20px;padding:0;overflow:hidden;text-align:left;display:flex;flex-direction:column;box-shadow:0 5px 0 rgba(29,47,111,.22);transition:transform .12s}',
    '.rs-card:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(29,47,111,.22)}',
    '.rs-card .pic{flex:none;position:relative;width:100%;aspect-ratio:16/10;border-bottom:3px solid ' + INK + '}',
    '.rs-card .pic canvas{position:absolute;inset:0;width:100%;height:100%;display:block}',
    '.rs-card .bd{flex:1;padding:10px 14px 14px;display:flex;flex-direction:column;gap:4px}',
    '.rs-card .nm{font-size:1.7rem;line-height:1}',
    '.rs-card .ln{font-size:1.1rem;color:' + MUTED + '}',
    '.rs-card .ln b{font-weight:400;color:' + GOLD + '}',
    '.rs-card .go{align-self:flex-start;margin-top:6px;font-size:1.35rem;padding:6px 18px;border-radius:14px;border:3px solid ' + INK + ';background:' + GOLD + ';color:#2a1d00;box-shadow:0 3px 0 ' + INK + '}',
    '.rs-card .tops{display:block;height:34px;width:100%;margin-top:2px}',
    '.rs-card.soon{filter:grayscale(.85);opacity:.8;cursor:default}',
    '.rs-card.soon:active{transform:none}',
    '.rs-card .soonb{position:absolute;top:12px;right:-34px;transform:rotate(30deg);background:#7a4fc4;color:#fff;font-size:1.25rem;padding:2px 44px;border:2px solid ' + INK + '}',
    '.rs-book{background:#fff;border:3px solid ' + INK + ';border-radius:20px;padding:10px 14px 14px;box-shadow:0 4px 0 rgba(29,47,111,.18)}',
    '.rs-book h3{margin:0 0 8px;font-weight:400;font-size:1.5rem}',
    '.rs-book h3 small{color:' + MUTED + ';font-size:1.05rem;margin-left:8px}',
    '.rs-guests{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px}',
    '.rs-g{display:flex;flex-direction:column;align-items:center;gap:2px;border:2px dashed #d4def0;border-radius:14px;padding:4px 2px 6px;text-align:center}',
    '.rs-g.got{border:2px solid ' + INK + ';background:#fffbea}',
    '.rs-g canvas{width:84px;height:62px}',
    '.rs-g:not(.got) canvas{filter:brightness(0);opacity:.16}',
    '.rs-g small{font-size:.95rem;line-height:1.05}',
    '.rs-g:not(.got) small{color:#aab3cc}',
    // shift
    '.rs-shift{position:absolute;inset:0;display:flex;flex-direction:column}',
    '.rs-rail{flex:none;display:flex;align-items:stretch;gap:10px;padding:6px 10px 8px;background:#8a5a33;border-bottom:3px solid ' + INK + ';position:relative;min-height:96px}',
    '.rs-rail::before{content:"";position:absolute;left:0;right:0;top:12px;height:5px;background:#c9d6ea;border-top:2px solid ' + INK + ';border-bottom:2px solid ' + INK + '}',
    '.rs-tix{flex:1;display:flex;gap:10px;align-items:flex-start;min-width:0;overflow:hidden;position:relative}',
    '.rs-tk{flex:none;position:relative;background:#fffdf5;border:2px solid ' + INK + ';border-radius:4px 4px 10px 10px;box-shadow:0 3px 0 rgba(0,0,0,.25);transform:rotate(-1.5deg);animation:rspin .45s cubic-bezier(.2,1.6,.4,1)}',
    '.rs-tk:nth-child(2n){transform:rotate(1.5deg)}',
    '.rs-tk::before{content:"";position:absolute;left:50%;top:-6px;width:14px;height:12px;margin-left:-7px;background:#f2b51d;border:2px solid ' + INK + ';border-radius:3px}',
    '.rs-tk.cur{border-color:' + GOLD + ';box-shadow:0 0 0 3px ' + GOLD + ',0 3px 0 rgba(0,0,0,.25)}',
    '.rs-tk canvas{display:block}',
    '.rs-tk .nm{position:absolute;left:6px;top:2px;font-size:.85rem;color:' + MUTED + ';white-space:nowrap}',
    '.rs-empty{color:#f8e2c4;font-size:1.15rem;align-self:center;padding-top:10px}',
    '.rs-info{flex:none;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:6px;color:#fff;padding-top:12px}',
    '.rs-dots{display:flex;gap:4px}',
    '.rs-dots i{width:16px;height:16px;border-radius:50%;border:2px solid #fff;background:transparent}',
    '.rs-dots i.on{background:#ffd85a;border-color:#ffd85a}',
    '.rs-jarl{font-size:1.25rem;background:#fff;color:' + INK + ';border:2px solid ' + INK + ';border-radius:12px;padding:0 10px;white-space:nowrap}',
    '.rs-jarl b{font-weight:400;color:' + GOLD + '}',
    '.rs-main{flex:1;position:relative;min-height:0;overflow:hidden}',
    '.rs-main > canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}',
    '.rs-act{flex:none;display:flex;align-items:center;justify-content:center;gap:10px;padding:6px 10px;background:#fff;border-top:3px solid ' + INK + ';min-height:62px}',
    '.rs-hint{flex:0 1 auto;min-width:0;font-size:1.2rem;line-height:1.1;max-width:46ch}',
    '.rs-btns{flex:none;display:flex;gap:8px;align-items:center}',
    '.rs-b{min-height:48px;padding:4px 14px;border-radius:14px;border:3px solid ' + INK + ';background:#fff;font-size:1.15rem;box-shadow:0 3px 0 ' + INK + ';white-space:nowrap}',
    '.rs-b.main{background:' + GOLD + ';color:#2a1d00;font-size:1.4rem;padding:4px 20px}',
    '.rs-b:active{transform:translateY(3px);box-shadow:0 0 0 ' + INK + '}',
    '.rs-b[disabled]{opacity:.45;box-shadow:none}',
    '.rs-b.pulse{animation:rspulse 1.1s ease-in-out infinite}',
    '.rs-tabs{flex:none;display:flex;justify-content:center;gap:6px;padding:6px 8px calc(6px + env(safe-area-inset-bottom,0px));background:#f6e2c8;border-top:3px solid ' + INK + '}',
    '.rs-tab{flex:1 1 0;max-width:200px;min-width:0;min-height:62px;border:3px solid ' + INK + ';border-radius:16px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;padding:2px;position:relative;box-shadow:0 3px 0 rgba(29,47,111,.3)}',
    '.rs-tab svg{width:34px;height:34px}',
    '.rs-tab span{font-size:1.02rem;line-height:1}',
    '.rs-tab.on{background:#fff4d6;border-color:' + GOLD + ';box-shadow:0 0 0 3px ' + GOLD + ' inset}',
    '.rs-tab .bd{position:absolute;top:-9px;right:-6px;min-width:26px;height:26px;border-radius:13px;background:#e2533f;color:#fff;border:2px solid ' + INK + ';font-size:.95rem;line-height:22px;padding:0 5px;display:none}',
    '.rs-tab .bd.on{display:block;animation:rsbob 1s ease-in-out infinite}',
    '.rs-tab .bd.soft{background:#fff;color:' + INK + ';animation:none}',
    '.rs-tab .here{position:absolute;top:-8px;left:-6px;width:24px;height:24px;display:none}',
    '.rs-tab .here.on{display:block}',
    '.rs-score{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;padding:10px;background:rgba(29,47,111,.3);overflow:auto}',
    '.rs-sc{background:#fff;border:3px solid ' + INK + ';border-radius:22px;padding:14px 18px;width:100%;max-width:420px;display:flex;flex-direction:column;gap:8px;align-items:center;box-shadow:0 6px 0 rgba(29,47,111,.25);animation:rspin .4s cubic-bezier(.2,1.5,.4,1);margin:auto}',
    '.rs-sc h3{margin:0;font-weight:400;font-size:1.6rem;line-height:1;text-align:center}',
    '.rs-hearts{display:flex;gap:10px}',
    '.rs-hearts svg{width:52px;height:48px}',
    '.rs-hearts svg.on{animation:rspin .5s cubic-bezier(.2,1.8,.4,1) both}',
    '.rs-rows{display:grid;grid-template-columns:auto 1fr auto;gap:4px 10px;align-items:center;width:100%}',
    '.rs-rows svg.ic{width:34px;height:34px}',
    '.rs-rows span{font-size:1.2rem}',
    '.rs-rows .st{display:flex;gap:2px}',
    '.rs-rows .st svg{width:24px;height:24px}',
    '.rs-tip{display:flex;align-items:center;gap:10px;font-size:1.6rem}',
    '.rs-tip b{font-weight:400;color:' + GOLD + '}',
    '.rs-tip small{display:block;font-size:1rem;color:' + MUTED + '}',
    '@keyframes rspin{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}',
    '@keyframes rspulse{50%{transform:scale(1.07)}}',
    '@keyframes rsbob{50%{transform:translateY(-3px)}}',
    '@media (max-width:520px){.rs-act{flex-wrap:wrap;gap:4px 8px;padding:4px 8px}.rs-hint{flex-basis:100%;text-align:center;font-size:1.05rem}.rs-b{min-height:44px;font-size:1.05rem;padding:2px 10px}.rs-b.main{font-size:1.25rem;padding:2px 14px}.rs-tab span{font-size:.9rem}.rs-tab svg{width:30px;height:30px}.rs-tab{min-height:56px;border-radius:14px}.rs-tabs{gap:4px;padding:5px 5px calc(5px + env(safe-area-inset-bottom,0px))}.rs-rail{gap:6px;padding:6px 6px 8px;min-height:90px}.rs-tix{gap:6px}.rs-dots i{width:12px;height:12px}.rs-jarl{font-size:1.05rem;padding:0 6px}}',
    '@media (prefers-reduced-motion:reduce){.rs *{animation:none!important;transition:none!important}}'
  ].join('\n');

  var SVG_HEART = function (on) { return '<svg viewBox="0 0 52 48" class="' + (on ? 'on' : '') + '"><path d="M26 44 C2 30 2 10 14 6 C20 4 24 8 26 12 C28 8 32 4 38 6 C50 10 50 30 26 44Z" fill="' + (on ? '#e2533f' : '#eef1f8') + '" stroke="#1d2f6f" stroke-width="3" stroke-linejoin="round"/>' + (on ? '<path d="M12 16 q2 -5 7 -5" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>' : '') + '</svg>'; };
  var SVG_STAR = function (on) { return '<svg viewBox="0 0 24 24"><path d="M12 2 l2.9 6.2 6.8.8 -5 4.6 1.4 6.7 -6.1-3.4 -6.1 3.4 1.4-6.7 -5-4.6 6.8-.8z" fill="' + (on ? '#f2b51d' : '#eef1f8') + '" stroke="#1d2f6f" stroke-width="1.8" stroke-linejoin="round"/></svg>'; };
  var SVG_CLOCK = '<circle cx="20" cy="21" r="14" fill="#fff" stroke="#1d2f6f" stroke-width="2.5"/><path d="M20 12 v9 l6 4" stroke="#1d2f6f" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
  var SVG_LADA = '<path d="M5 33 h30" stroke="#1d2f6f" stroke-width="3" stroke-linecap="round"/><path d="M9 30 a11 11 0 0 1 22 0 z" fill="#f2b51d" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/><circle cx="20" cy="16" r="2.6" fill="#1d2f6f"/><path d="M14 25 q1 -5 5 -6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>';
  var SVG_PODAJ = '<ellipse cx="20" cy="27" rx="16" ry="6" fill="#fff" stroke="#1d2f6f" stroke-width="2.5"/><path d="M12 24 l8 -14 l8 14 z" fill="#ffd95a" stroke="#1d2f6f" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 24 h16" stroke="#efc57e" stroke-width="3"/><circle cx="20" cy="18" r="2" fill="#d8433b"/>';
  var SVG_HERE = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#efc57e" stroke="#1d2f6f" stroke-width="2"/><circle cx="12" cy="12" r="7" fill="#d9412e"/><circle cx="9" cy="10" r="2" fill="#ffd95a"/><circle cx="14" cy="14" r="2" fill="#ffd95a"/></svg>';
  function svg(inner) { return '<svg viewBox="0 0 40 40" aria-hidden="true">' + inner + '</svg>'; }

  // =====================================================================
  // Game
  // =====================================================================
  function freshR() { return { shifts: 0, pizzas: 0, perfect: 0, best: 0, open: null }; }
  function migrate(s) {
    s = s && typeof s === 'object' ? s : {};
    var o = { v: 1, seenHelp: !!s.seenHelp, guests: {}, r: {} };
    if (s.guests && typeof s.guests === 'object') SPECIES.forEach(function (k) { var n = +s.guests[k]; if (n > 0) o.guests[k] = Math.floor(n); });
    RESTAURANTS.forEach(function (R) {
      var src = s.r && typeof s.r === 'object' && s.r[R.id] && typeof s.r[R.id] === 'object' ? s.r[R.id] : {}, d = freshR();
      ['shifts', 'pizzas', 'perfect', 'best'].forEach(function (k) { var v = +src[k]; d[k] = isFinite(v) && v > 0 ? Math.floor(v) : 0; });
      var op = src.open;
      if (op && typeof op === 'object' && +op.done >= 0 && +op.done < SHIFT_N) d.open = { done: Math.floor(+op.done), hearts: Math.max(0, Math.floor(+op.hearts || 0)), tips: clamp(Math.floor(+op.tips || 0), 0, SHIFT_N * TIP_MAX) };
      o.r[R.id] = d;
    });
    return o;
  }

  NG.register('restauracje', {
    meta: { name: 'Restauracje', price: '50 ★ za zmianę', bg: '#fde8d4', pic: PIC, music: 'play' },
    medals: [
      { id: 'p10', stat: 'pizzas', at: 10, tier: 1, text: '10 pizz' },
      { id: 'p50', stat: 'pizzas', at: 50, tier: 2, text: '50 pizz' },
      { id: 'p150', stat: 'pizzas', at: 150, tier: 3, text: '150 pizz' }
    ],
    quests: [
      { id: 'pizzas', stat: 'pizzas', n: [3, 5], text: 'Upiecz {n} {pizza} w Restauracjach', forms: ['pizzę', 'pizze', 'pizz'] },
      { id: 'perfect', stat: 'perfect', n: [1, 2], text: 'Zrób {n} {pizza} na 3 serduszka', forms: ['pizzę', 'pizze', 'pizz'] }
    ],
    stickers: [
      { id: 'first', emoji: '🍕', name: 'Pierwsza pizza' },
      { id: 'perfect', emoji: '🌟', name: 'Idealna pizza' },
      { id: 'hearts', emoji: '💖', name: 'Same serduszka' },
      { id: 'pet', emoji: '🏡', name: 'Mój zwierzak w pizzerii' },
      { id: 'eight', emoji: '🔪', name: 'Osiem kawałków' },
      { id: 'tops', emoji: '🫒', name: 'Wszystkie dodatki' },
      { id: 'guests', emoji: '🐾', name: 'Wszyscy goście' }
    ],

    mount: function (root0, ctx) {
      var st = migrate(ctx.load({}));
      function save() { ctx.save(st); }
      save();

      var style = el('style'); style.textContent = CSS;
      var root = el('div', 'rs'); root.appendChild(style);
      root0.appendChild(root);

      var running = true, raf = 0, last = 0, T = 0, destroyed = false;
      var offs = [];
      function on(t, ev, fn, o) { t.addEventListener(ev, fn, o); offs.push(function () { t.removeEventListener(ev, fn, o); }); }

      // =================== hub ===================
      var hubEl = null;
      function showHub() {
        endShiftView();
        if (hubEl) hubEl.remove();
        hubEl = el('div', 'rs-hub');
        var inner = el('div', 'rs-hub-in'); hubEl.appendChild(inner);
        inner.appendChild(el('div', 'rs-hd', '<h2>Restauracje</h2><p>Gotuj dla zwierzaków. Za dobre jedzenie dostaniesz napiwki w ★.</p>'));
        var cards = el('div', 'rs-cards'); inner.appendChild(cards);
        RESTAURANTS.forEach(function (R) {
          var b = el('button', 'rs-card' + (R.soon ? ' soon' : '')); b.type = 'button';
          var pic = el('span', 'pic'), cv = document.createElement('canvas'); cv.width = 480; cv.height = 300; pic.appendChild(cv); b.appendChild(pic);
          var cg = cv.getContext('2d'); R.card(cg, 480, 300, 0);
          var bd = el('div', 'bd'); b.appendChild(bd);
          bd.appendChild(el('div', 'nm', R.name));
          if (R.soon) {
            bd.appendChild(el('div', 'ln', 'Wkrótce otworzymy!'));
            b.appendChild(el('div', 'soonb', 'Wkrótce!'));
            b.onclick = function () { ctx.sfx('tap'); ctx.toast('Burgerownia jeszcze się buduje!'); };
          } else {
            var d = st.r[R.id];
            bd.appendChild(el('div', 'ln', d.open ? 'Zmiana trwa: gość ' + (d.open.done + 1) + ' z ' + SHIFT_N : 'Zmiana: <b>' + SHIFT_PRICE + ' ★</b> · ' + SHIFT_N + ' gości'));
            bd.appendChild(el('div', 'ln', 'Upieczone: ' + d.pizzas + ' · zmiany: ' + d.shifts));
            if (R === PIZZERIA) {
              var tc = smallCanvas(300, 34); tc.c.className = 'tops'; tc.c.style.width = '100%'; bd.appendChild(tc.c);
              drawTopsRow(tc.g, 300, 34, d.shifts);
              var next = TOPS.filter(function (t) { return t.at > d.shifts; })[0];
              if (next) { var k = next.at - d.shifts; bd.appendChild(el('div', 'ln', 'Nowy dodatek za ' + k + ' ' + pl(k, 'zmianę', 'zmiany', 'zmian'))); }
            }
            bd.appendChild(el('span', 'go', d.open ? 'Dokończ zmianę' : 'Otwórz'));
            b.onclick = function () { ctx.sfx('open'); openRestaurant(R); };
          }
          cards.appendChild(b);
        });
        // guest book
        var book = el('div', 'rs-book'), got = SPECIES.filter(function (k) { return st.guests[k]; }).length;
        book.appendChild(el('h3', '', 'Goście<small>' + got + ' z ' + SPECIES.length + '</small>'));
        var gl = el('div', 'rs-guests'); book.appendChild(gl);
        SPECIES.forEach(function (sp) {
          var cell = el('div', 'rs-g' + (st.guests[sp] ? ' got' : ''));
          var pc = smallCanvas(84, 62); cell.appendChild(pc.c);
          drawPetFit(pc.g, { sp: sp, stage: 2, wear: {} }, 0, 0, 84, 62, { eye: 'happy', mouth: 'smile' });
          cell.appendChild(el('small', '', st.guests[sp] ? GUESTS[sp][0][0].split(' ')[0] + ' ×' + st.guests[sp] : '?'));
          gl.appendChild(cell);
        });
        inner.appendChild(book);
        root.appendChild(hubEl);
      }
      function drawTopsRow(g, w, h, shifts) {
        var n = TOPS.length, s = Math.min(h * 0.36, w / n / 2.4);
        TOPS.forEach(function (t, i) {
          var x = (i + 0.5) * w / n, y = h / 2, ok = shifts >= t.at;
          g.save(); g.globalAlpha = ok ? 1 : 0.22; g.translate(x, y); drawTop(g, t.k, s); g.restore();
          if (!ok) { rr(g, x - 5, y - 2, 10, 8, 2); g.fillStyle = MUTED; g.fill(); g.beginPath(); g.arc(x, y - 2, 3.5, Math.PI, 0); g.strokeStyle = MUTED; g.lineWidth = 2; g.stroke(); }
        });
      }
      function drawPetFit(g, pet, x, y, w, h, stt) {
        var A = petArt(); if (!A) { circle(g, x + w / 2, y + h / 2, h * 0.35); g.fillStyle = '#e9a46b'; g.fill(); ink(g, 2); return; }
        var G = A.geo(pet, 'stand'), bw = G.x1 - G.x0, bh = -G.top, s = Math.min((w - 6) / bw, (h - 6) / bh);
        g.save(); g.translate(x + w / 2 - (G.x0 + G.x1) / 2 * s, y + h - 3); g.scale(s, s);
        var o = { t: 0.5, pose: 'stand', eye: 'open', mouth: 'smile' }; for (var k in stt) o[k] = stt[k];
        A.draw(g, pet, o); g.restore();
      }

      function openRestaurant(R) {
        var d = st.r[R.id];
        if (d.open) {
          ctx.panel({ title: R.name, lines: ['Dokończ zmianę: zostało ' + (SHIFT_N - d.open.done) + ' ' + pl(SHIFT_N - d.open.done, 'gość', 'gości', 'gości') + '.'], button: 'Do pracy!', onPlay: function () { startShift(R); }, secondary: [{ label: 'Restauracje', onClick: function () {} }] });
          return;
        }
        ctx.panel({
          title: R.name, medals: true,
          lines: [SHIFT_N + ' gości na zmianę. Napiwki wracają do skarbonki: do ' + SHIFT_N * TIP_MAX + ' ★.'],
          price: SHIFT_PRICE, button: 'Otwórz zmianę', note: 'zmiana',
          onPlay: function () { d.open = { done: 0, hearts: 0, tips: 0 }; save(); startShift(R); },
          secondary: [{ label: 'Restauracje', onClick: function () {} }]
        });
      }

      // =================== shift ===================
      var S = null, shiftEl = null, cv = null, g = null, dpr = 1, ro = null;
      var railTix, railDots, railJar, hintEl, btnsEl, tabsEl, mainEl, scoreEl = null;
      var tabBtns = {};

      function endShiftView() {
        if (ro) { ro.disconnect(); ro = null; }
        if (shiftEl) { shiftEl.remove(); shiftEl = null; }
        S = null; cv = null; g = null; scoreEl = null;
      }

      function startShift(R) {
        if (hubEl) { hubEl.remove(); hubEl = null; }
        endShiftView();
        var d = st.r[R.id];
        if (!d.open) d.open = { done: 0, hearts: 0, tips: 0 };
        shiftEl = el('div', 'rs-shift'); root.appendChild(shiftEl);
        var rail = el('div', 'rs-rail'); shiftEl.appendChild(rail);
        railTix = el('div', 'rs-tix'); rail.appendChild(railTix);
        var info = el('div', 'rs-info'); rail.appendChild(info);
        railDots = el('div', 'rs-dots'); info.appendChild(railDots);
        railJar = el('div', 'rs-jarl'); info.appendChild(railJar);
        mainEl = el('div', 'rs-main'); shiftEl.appendChild(mainEl);
        cv = document.createElement('canvas'); mainEl.appendChild(cv); g = cv.getContext('2d');
        var act = el('div', 'rs-act'); shiftEl.appendChild(act);
        hintEl = el('div', 'rs-hint'); act.appendChild(hintEl);
        btnsEl = el('div', 'rs-btns'); act.appendChild(btnsEl);
        tabsEl = el('div', 'rs-tabs'); shiftEl.appendChild(tabsEl);

        var views = [{ k: 'lada', n: 'Lada', icon: SVG_LADA }].concat(R.stations).concat([{ k: 'podaj', n: 'Podaj', icon: SVG_PODAJ }]);
        tabBtns = {};
        views.forEach(function (v) {
          var b = el('button', 'rs-tab', svg(v.icon) + '<span>' + v.n + '</span><i class="bd"></i><i class="here">' + SVG_HERE + '</i>'); b.type = 'button';
          b.onclick = function () { if (S && S.view !== v.k) { ctx.sfx('swap'); S.go(v.k); } };
          tabsEl.appendChild(b); tabBtns[v.k] = b;
        });

        S = {
          R: R, d: d, shifts: d.shifts, view: 'lada', W: 1, H: 1, u: 1, T: 0, t: 0,
          done: d.open.done, hearts: d.open.hearts, tips: d.open.tips, spawned: d.open.done, spawnT: 0,
          custs: [], tickets: [], item: null, ticket: null, fx: [], tool: 'sauce', drag: null, guides: d.shifts < 3,
          petUsed: false, flashT: {}, sig: '', tsig: '', lastNow: 0, ended: false,
          sfx: function (n) { ctx.sfx(n); },
          go: go,
          stationName: function (k) { var v = views.filter(function (x) { return x.k === k; })[0]; return v ? v.n : k; },
          say: function (text) { S.fx = S.fx.filter(function (f) { return f.kind !== 'say'; }); S.fx.push({ kind: 'say', text: text, life: 1.8, max: 1.8 }); },
          pop: function (x, y) { if (REDUCED) return; for (var i = 0; i < 6; i++) { var a = rnd(0, 7); S.fx.push({ kind: 'dot', x: x, y: y, vx: Math.cos(a) * rnd(60, 140), vy: Math.sin(a) * rnd(60, 140), life: 0.4, max: 0.4, col: pick(['#ffd85a', '#fff', '#f39a2a']) }); } },
          crumb: function (x, y, col) { S.fx.push({ kind: 'dot', x: x + rnd(-10, 10), y: y - 20, vx: rnd(-20, 20), vy: rnd(40, 90), life: 0.3, max: 0.3, col: col }); },
          sparkle: function (x, y) { if (REDUCED) return; for (var i = 0; i < 10; i++) { var a = i / 10 * 7; S.fx.push({ kind: 'star', x: x, y: y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160 - 40, life: 0.8, max: 0.8 }); } },
          steam: function (x, y) { S.fx.push({ kind: 'steam', x: x + rnd(-6, 6), y: y, vx: rnd(-8, 8), vy: -rnd(30, 50), life: 1.6, max: 1.6, r: rnd(8, 14) }); },
          flash: function (k) { S.flashT[k] = 2; },
          replaceItem: function () { S.item = R.newItem(S.ticket.order); }
        };

        function layout() {
          if (!cv) return;
          var r = mainEl.getBoundingClientRect();
          S.W = Math.max(1, r.width); S.H = Math.max(1, r.height);
          dpr = Math.min(3, window.devicePixelRatio || 1);
          cv.width = Math.round(S.W * dpr); cv.height = Math.round(S.H * dpr);
          S.u = Math.min(S.W / 420, S.H / 470);
          var st2 = R[S.view]; if (st2 && st2.layout) st2.layout(S);
          renderRail(true);
        }
        ro = new ResizeObserver(layout); ro.observe(mainEl);
        on(cv, 'pointerdown', onDown); on(cv, 'pointermove', onMove); on(cv, 'pointerup', onUp); on(cv, 'pointercancel', onCancel);
        cv._rs = function () { return S; };   // test hook
        layout();
        go('lada', true);
        renderRail(true);
        start();
      }

      function go(k, quiet) {
        if (!S) return;
        S.view = k; S.drag = null;
        var st2 = S.R[k]; if (st2) { if (st2.layout) st2.layout(S); if (st2.enter) st2.enter(S); }
        Object.keys(tabBtns).forEach(function (t) { tabBtns[t].classList.toggle('on', t === k); });
        if (!quiet && k === 'podaj') callPickup();
        S.sig = ''; refresh();
      }

      // ---------- customers ----------
      var SPOT = { door: { x: -150, d: 0 }, queue: { x: -95, d: 0.3 }, order: { x: -80, d: 1 }, pickup: { x: 125, d: 1 }, t0: { x: -175, d: 0.5 }, t1: { x: 175, d: 0.5 } };
      function spawn() {
        S.spawned++; S.spawnT = 0;
        var pet = null, name, fem = false, vip = false;
        var A = petArt(), mine = A && A.pets ? A.pets() : [];
        if (mine.length && !S.petUsed && Math.random() < 0.3) {
          var p = pick(mine); S.petUsed = true; vip = true;
          pet = { sp: p.sp, stage: p.stage, wear: p.wear || {}, name: p.name }; name = p.name; fem = A.fem ? A.fem(pet) : /a$/.test(name);
        } else {
          var seen = S.custs.map(function (c) { return c.pet.sp; }).concat(S.usedSp || []);
          var pool = SPECIES.filter(function (k) { return seen.indexOf(k) < 0; });
          var fresh = pool.filter(function (k) { return !st.guests[k]; });
          var sp = fresh.length && Math.random() < 0.6 ? pick(fresh) : pick(pool.length ? pool : SPECIES);
          var nm = pick(GUESTS[sp]); name = nm[0]; fem = !!nm[1];
          pet = { sp: sp, stage: 2, wear: {}, name: name };
        }
        S.usedSp = (S.usedSp || []).concat([pet.sp]);
        var c = { id: S.spawned, pet: pet, name: name, fem: fem, vip: vip, x: SPOT.door.x, d: 0, spot: null, state: 'in', legs: 0, face: 1, walking: false, alpha: 0, hopT: 0, happy: 0, seed: Math.random() * 10, say: '', ticket: null };
        c.spot = S.custs.some(function (o) { return o.spot === 'order'; }) ? 'queue' : 'order';
        S.custs.push(c);
        S.sfx('open');
        if (S.view !== 'lada' && c.spot === 'order') S.flash('lada');
      }
      function freeTable() { var used = S.custs.map(function (c) { return c.spot; }); return used.indexOf('t0') < 0 ? 't0' : used.indexOf('t1') < 0 ? 't1' : 'queue'; }
      function atSpot(c) { var p = SPOT[c.spot]; return p && Math.abs(c.x - p.x) < 2 && Math.abs(c.d - p.d) < 0.02; }
      function takeOrder(c) {
        if (!c || c.state !== 'order' || !atSpot(c)) return;
        var t = { id: c.id, cust: c, order: c.preview || S.R.newOrder(S.shifts), at: S.t };
        c.ticket = t; c.state = 'wait'; c.spot = freeTable(); c.say = '';
        S.tickets.push(t);
        S.sfx('buy');
        if (!S.ticket) nextTicket();
        var q = S.custs.filter(function (o) { return o.spot === 'queue' && o.state === 'in'; })[0];
        if (q) q.spot = 'order';
        renderRail(true); S.sig = ''; refresh();
        S.say('Zamówienie przyjęte!');
      }
      function nextTicket() {
        S.ticket = S.tickets[0] || null;
        S.item = S.ticket ? S.R.newItem(S.ticket.order) : null;
        S.done_sauce = S.done_cheese = false;
        if (S.ticket && S.R.dodatki && S.R.dodatki.enter) S.R.dodatki.enter(S);
      }
      function callPickup() {
        var t = S.ticket; if (!t || !S.item || !S.R.ready(S.item)) return;
        var c = t.cust; if (c.spot !== 'pickup' && c.state === 'wait') { c.spot = 'pickup'; c.state = 'pickup'; }
      }
      function serve() {
        var t = S.ticket, c = t && t.cust; if (!c || c.state !== 'pickup' || !atSpot(c) || S.card) return;
        var parts = S.R.score(t.order, S.item), avg = 0;
        parts.forEach(function (p) { avg += p.v; }); avg /= parts.length;
        var secs = S.t - t.at, fast = secs <= FAST_S;
        parts.push({ k: 'time', v: fast ? 1 : secs <= OK_S ? 0.6 : 0.3 });
        var hearts = avg >= 0.82 ? 3 : avg >= 0.5 ? 2 : 1;
        var perfect = parts.slice(0, 3).every(function (p) { return p.v >= 0.82; });
        var tip = clamp(2 + Math.round(3 * avg) + (fast && hearts >= 2 ? 1 : 0) + (c.vip ? 1 : 0), TIP_MIN, TIP_MAX);   // the speed bonus only for a good pizza
        tip = Math.max(0, Math.min(tip, SHIFT_N * TIP_MAX - S.tips));
        S.done++; S.hearts += hearts; S.tips += tip;
        if (tip > 0) ctx.refund(tip, 'napiwek');
        var d = S.d; d.pizzas++; if (perfect) d.perfect++;
        d.open = S.done < SHIFT_N ? { done: S.done, hearts: S.hearts, tips: S.tips } : d.open;
        if (!c.vip) st.guests[c.pet.sp] = (st.guests[c.pet.sp] || 0) + 1;
        save();
        ctx.stat('pizzas', 1);
        if (perfect) { ctx.stat('perfect', 1); ctx.sticker('perfect'); }
        ctx.sticker('first');
        if (c.vip) ctx.sticker('pet');
        if (t.order.slices === 8 && S.item.cuts.length === 4) ctx.sticker('eight');
        if (SPECIES.every(function (k) { return st.guests[k]; })) ctx.sticker('guests');
        // reaction
        c.state = 'eat'; c.happy = 3; c.hopT = REDUCED ? 0 : 1.2; c.say = pick(SAY_BYE[hearts]);
        S.sfx(hearts === 3 ? 'win' : 'harvest');
        var pos = custPos(c);
        if (!REDUCED) for (var i = 0; i < hearts * 2 + 1; i++) S.fx.push({ kind: 'heart', x: pos.x + rnd(-30, 30) * S.u, y: pos.y - 90 * S.u, vx: rnd(-30, 30), vy: -rnd(50, 90), life: 1.6 + i * 0.1, max: 1.6 + i * 0.1 });
        S.served = S.item; S.item = null;
        later(function () { if (S) showScore(c, parts, hearts, tip); }, REDUCED ? 300 : 1100);
        renderRail(true); S.sig = ''; refresh();
      }
      var laterT = [];
      function later(fn, ms) { var id = setTimeout(function () { laterT = laterT.filter(function (x) { return x !== id; }); if (!destroyed) fn(); }, ms); laterT.push(id); }

      function showScore(c, parts, hearts, tip) {
        S.card = true;
        scoreEl = el('div', 'rs-score');
        var sc = el('div', 'rs-sc'); scoreEl.appendChild(sc);
        sc.appendChild(el('h3', '', c.name + (c.vip ? ' (twój zwierzak!)' : '')));
        var hs = el('div', 'rs-hearts'); for (var i = 0; i < 3; i++) { var w = el('span', '', SVG_HEART(i < hearts)); if (w.firstChild) w.firstChild.style.animationDelay = (0.15 + i * 0.25) + 's'; hs.appendChild(w); }
        sc.appendChild(hs);
        var rows = el('div', 'rs-rows'); sc.appendChild(rows);
        var ICONS = { top: S.R.stations[0].icon, bake: S.R.stations[1].icon, cut: S.R.stations[2].icon, time: SVG_CLOCK };
        var NAMES = { top: 'Dodatki', bake: 'Pieczenie', cut: 'Krojenie', time: 'Czas' };
        parts.forEach(function (p) {
          var n = p.v >= 0.82 ? 3 : p.v >= 0.5 ? 2 : 1;
          rows.appendChild(el('span', '', '<svg class="ic" viewBox="0 0 40 40">' + ICONS[p.k] + '</svg>'));
          rows.appendChild(el('span', '', NAMES[p.k]));
          rows.appendChild(el('span', 'st', SVG_STAR(n >= 1) + SVG_STAR(n >= 2) + SVG_STAR(n >= 3)));
        });
        var tipEl = el('div', 'rs-tip'), jar = smallCanvas(64, 70); tipEl.appendChild(jar.c);
        tipEl.appendChild(el('div', '', 'Napiwek: <b>+' + tip + ' ★</b><small>w słoiku: ' + S.tips + ' ★</small>'));
        sc.appendChild(tipEl);
        var b = el('button', 'rs-b main', S.done >= SHIFT_N ? 'Koniec zmiany' : 'Dalej'); b.type = 'button';
        b.onclick = function () { ctx.sfx('tap'); closeScore(c); };
        sc.appendChild(b);
        mainEl.appendChild(scoreEl);
        // coins dropping into the jar
        var shown = Math.max(0, S.tips - tip), drawJar = function () {
          var jg = jar.g; jg.clearRect(0, 0, 64, 70);
          rr(jg, 8, 14, 48, 52, 12); jg.fillStyle = 'rgba(214,239,255,.7)'; jg.fill(); ink(jg, 2.5);
          rr(jg, 14, 6, 36, 10, 3); jg.fillStyle = '#c99257'; jg.fill(); ink(jg, 2);
          var n = Math.min(shown, 30);
          for (var i = 0; i < n; i++) coin(jg, 16 + (i % 4) * 10.5 + (Math.floor(i / 4) % 2) * 4, 58 - Math.floor(i / 4) * 6, 5.5);
        };
        drawJar();
        for (var k = 0; k < tip; k++) later(function () { shown++; drawJar(); ctx.sfx('coin'); }, 500 + k * 220);
      }
      function closeScore(c) {
        if (scoreEl) { scoreEl.remove(); scoreEl = null; }
        S.card = false; S.served = null;
        c.state = 'out'; c.spot = 'door'; c.say = '';
        S.tickets = S.tickets.filter(function (t) { return t.cust !== c; });
        nextTicket();
        renderRail(true);
        if (S.done >= SHIFT_N) { endShift(); return; }
        go(S.custs.some(function (o) { return o.state === 'order'; }) || !S.ticket ? 'lada' : 'dodatki');
      }
      function endShift() {
        var R = S.R, d = S.d, before = R === PIZZERIA ? unlockedTops(d.shifts).length : 0;
        S.ended = true;
        d.shifts++; d.open = null; d.best = Math.max(d.best, S.hearts);
        save();
        ctx.stat('shifts', 1); ctx.stat('best', S.hearts, 'max');
        if (S.hearts >= SHIFT_N * 3) ctx.sticker('hearts');
        var lines = [SHIFT_N + ' ' + pl(SHIFT_N, 'gość', 'gości', 'gości') + ' najedzonych!', 'Napiwki: ' + S.tips + ' ★ (już w skarbonce)'];
        if (R === PIZZERIA) {
          var now = unlockedTops(d.shifts);
          if (now.length > before) lines.push({ text: 'Nowy dodatek: ' + now.filter(function (t) { return t.at === d.shifts; }).map(function (t) { return t.n; }).join(', ') + '!' });
          if (now.length === TOPS.length) ctx.sticker('tops');
        }
        ctx.sfx('win');
        var hearts = S.hearts;
        later(function () {
          ctx.panel({
            title: 'Koniec zmiany!', big: '❤ ' + hearts + ' / ' + SHIFT_N * 3, medals: true, lines: lines,
            price: SHIFT_PRICE, button: 'Następna zmiana', note: 'zmiana',
            onPlay: function () { st.r[R.id].open = { done: 0, hearts: 0, tips: 0 }; save(); startShift(R); },
            secondary: [{ label: 'Restauracje', onClick: function () { showHub(); } }]
          });
        }, 400);
      }

      function custPos(c) {
        var W = S.W, H = S.H, u = S.u, wallB = H * 0.5, ct = H * 0.79;
        return { x: W / 2 + c.x * u, y: lerp(wallB + 6 * u, ct + 2 * u, c.d), s: u * lerp(1.35, 2.2, c.d) };
      }
      function updateCusts(dt) {
        S.custs.forEach(function (c) {
          var p = SPOT[c.spot] || SPOT.door, dx = p.x - c.x, dd = (p.d - c.d) * 160, dist = Math.hypot(dx, dd);
          c.walking = dist > 1.5;
          if (c.walking) {
            var step = Math.min(dist, 120 * dt), m = step / dist;
            c.x += dx * m; c.d += (p.d - c.d) * m; c.legs += dt * 9;
            if (Math.abs(dx) > 0.5) c.face = dx > 0 ? 1 : -1;
          } else {
            c.x = p.x; c.d = p.d;
            c.face = c.spot === 't1' ? -1 : 1;
            if (c.spot === 'order' && c.state === 'in') { c.state = 'order'; c.say = pick(SAY_HI); S.sfx('open'); if (S.view !== 'lada') S.flash('lada'); S.sig = ''; }
            if (c.spot === 'pickup' && c.state === 'pickup' && !c.arrived) { c.arrived = true; S.sig = ''; }
          }
          c.alpha = c.state === 'out' ? clamp(c.d / 0.15, 0, 1) : Math.min(1, c.alpha + dt * 3);
          if (c.hopT > 0) c.hopT = Math.max(0, c.hopT - dt);
          if (c.happy > 0) c.happy = Math.max(0, c.happy - dt);
        });
        S.custs = S.custs.filter(function (c) { return !(c.state === 'out' && c.d <= 0.01 && Math.abs(c.x - SPOT.door.x) < 2); });
      }

      function update(dt) {
        if (!S || S.ended) return;
        S.t += dt; S.T = T;
        var present = S.custs.filter(function (c) { return c.state !== 'out'; }).length;
        S.spawnT += dt;
        if (S.spawned < SHIFT_N && present < MAX_IN && (present === 0 ? S.spawnT >= 1 : S.spawnT >= NEXT_GAP)) spawn();
        updateCusts(dt);
        if (S.R.update) S.R.update(dt, S);
        // pickup when the pizza is ready
        if (S.item && S.R.ready(S.item) && S.view === 'podaj') callPickup();
        for (var k in S.flashT) if (S.flashT[k] > 0) S.flashT[k] -= dt;
        S.fx.forEach(function (f) {
          f.life -= dt;
          if (f.vx != null) { f.x += f.vx * dt; f.y += f.vy * dt; }
          if (f.kind === 'dot') f.vy += 300 * dt;
          if (f.kind === 'star') { f.vx *= 0.94; f.vy *= 0.94; }
        });
        S.fx = S.fx.filter(function (f) { return f.life > 0; });
      }

      // ---------- dining room drawing ----------
      function drawScene(g2, serving) {
        var W = S.W, H = S.H, u = S.u, cx = W / 2, R = S.R, wallB = H * 0.5, ct = H * 0.79;
        // wall
        g2.fillStyle = R.wall; g2.fillRect(0, 0, W, wallB);
        g2.fillStyle = R.wall2; for (var x = (cx % (36 * u)) - 36 * u; x < W; x += 36 * u) g2.fillRect(x, 0, 14 * u, wallB);
        g2.fillStyle = R.trim; g2.fillRect(0, wallB - 34 * u, W, 34 * u);
        g2.fillStyle = 'rgba(29,47,111,.12)'; g2.fillRect(0, wallB - 34 * u, W, 3);
        // windows across the whole width (never behind the door)
        var doorX = cx + SPOT.door.x * u, ww = 96 * u, wh = 84 * u, wy = wallB - 34 * u - wh - 18 * u;
        for (var wx = cx + 60 * u; wx < W + ww; wx += 250 * u) drawWindow(g2, wx, wy, ww, wh, u);
        for (var wx2 = cx - 330 * u; wx2 > -ww; wx2 -= 250 * u) drawWindow(g2, wx2, wy, ww, wh, u);
        // sign
        var sw = Math.min(W - 24, 300 * u), sh = 44 * u;
        rr(g2, cx - sw / 2, 10 * u, sw, sh, 12 * u); g2.fillStyle = '#fff'; g2.fill(); ink(g2, 3);
        txt(g2, R.sign, cx, 10 * u + sh / 2 + 2, 30 * u, '#c8432d');
        // lamps
        [-120, 120].forEach(function (lx) {
          var X = cx + lx * u * 1.6; g2.beginPath(); g2.moveTo(X, 0); g2.lineTo(X, 70 * u); g2.strokeStyle = INK; g2.lineWidth = 2; g2.stroke();
          g2.beginPath(); g2.moveTo(X - 18 * u, 86 * u); g2.lineTo(X - 9 * u, 70 * u); g2.lineTo(X + 9 * u, 70 * u); g2.lineTo(X + 18 * u, 86 * u); g2.closePath(); g2.fillStyle = '#f2b51d'; g2.fill(); ink(g2, 2);
        });
        // door
        var dw = 62 * u, dh = 116 * u;
        rr(g2, doorX - dw / 2, wallB - dh, dw, dh, 8 * u); g2.fillStyle = '#b5713c'; g2.fill(); ink(g2, 3);
        rr(g2, doorX - dw / 2 + 9 * u, wallB - dh + 10 * u, dw - 18 * u, 40 * u, 5 * u); g2.fillStyle = '#d6efff'; g2.fill(); ink(g2, 2);
        circle(g2, doorX + dw / 2 - 11 * u, wallB - dh / 2, 4 * u); g2.fillStyle = GOLD; g2.fill(); ink(g2, 1.5);
        // floor
        g2.fillStyle = R.floor1; g2.fillRect(0, wallB, W, H - wallB);
        g2.fillStyle = R.floor2; var ts = 40 * u, rowH = 18 * u;
        for (var ry = 0, yy = wallB; yy < H; ry++, yy += rowH) for (var xx = ((ry % 2) * ts) - ts + (cx % (ts * 2)); xx < W; xx += ts * 2) g2.fillRect(xx, yy, ts, rowH);
        // tables
        ['t0', 't1'].forEach(function (k) {
          var p = custPos({ x: SPOT[k].x + (k === 't0' ? 52 : -52), d: SPOT[k].d });
          var s = p.s / 1.4;
          g2.beginPath(); g2.moveTo(p.x, p.y - 2); g2.lineTo(p.x, p.y - 34 * s); g2.strokeStyle = INK; g2.lineWidth = 4 * s; g2.stroke();
          g2.beginPath(); g2.ellipse(p.x, p.y, 16 * s, 4 * s, 0, 0, 7); g2.fillStyle = INK; g2.fill();
          g2.beginPath(); g2.ellipse(p.x, p.y - 36 * s, 30 * s, 9 * s, 0, 0, 7); g2.fillStyle = '#fff'; g2.fill(); ink(g2, 2.5);
          g2.beginPath(); g2.ellipse(p.x, p.y - 36 * s, 22 * s, 5.5 * s, 0, 0, 7); g2.fillStyle = '#f39cab'; g2.fill();
        });
        // customers, far ones first
        var list = S.custs.slice().sort(function (a, b) { return a.d - b.d; });
        list.forEach(function (c) { drawCust(g2, c); });
        // counter
        g2.fillStyle = R.counter; g2.fillRect(0, ct, W, H - ct);
        g2.fillStyle = R.counter2; for (var sx = (cx % (52 * u)) - 52 * u; sx < W; sx += 52 * u) g2.fillRect(sx, ct + 16 * u, 22 * u, H - ct);
        rr(g2, -10, ct - 6 * u, W + 20, 18 * u, 6 * u); g2.fillStyle = '#f6e7cf'; g2.fill(); ink(g2, 3);
        // till at the order spot
        var tx = cx + (SPOT.order.x + 105) * u, tw = 54 * u, th = 34 * u;
        rr(g2, tx - tw / 2, ct - 6 * u - th, tw, th, 6 * u); g2.fillStyle = '#7d8fb0'; g2.fill(); ink(g2, 2.5);
        rr(g2, tx - tw / 2 + 6 * u, ct - 6 * u - th + 6 * u, tw - 12 * u, 12 * u, 3 * u); g2.fillStyle = '#c8f0c0'; g2.fill();
        // bell on the counter
        var bx = cx + (SPOT.pickup.x + 66) * u, by = ct - 6 * u;
        g2.beginPath(); g2.arc(bx, by, 13 * u, Math.PI, 0); g2.closePath(); g2.fillStyle = GOLD; g2.fill(); ink(g2, 2);
        // the pizza waiting on the counter
        var it = S.item;
        if (it && R.ready(it)) R.drawServe(g2, it, cx + SPOT.pickup.x * u, ct + 2 * u, 56 * u);
        else if (S.served) R.drawServe(g2, S.served, cx + SPOT.pickup.x * u, ct + 2 * u, 56 * u);
        // speech bubbles
        S.custs.forEach(function (c) {
          if (c.say && c.state === 'eat') sayBubble(g2, c, c.say);
          else if (c.state === 'order' && atSpot(c) && !serving) orderBubble(g2, c);
          else if (c.state === 'wait' && atSpot(c) && c.ticket && S.ticket === c.ticket && !REDUCED && Math.sin(T * 1.3 + c.seed) > 0.85) {
            var p = custPos(c); heartPath(g2, p.x, p.y - 100 * p.s / 1.75, 7 * u); g2.fillStyle = '#e2533f'; g2.fill(); ink(g2, 1.5);
          }
        });
      }
      function drawWindow(g2, x, y, w, h, u) {
        rr(g2, x - w / 2, y, w, h, 8 * u); g2.fillStyle = '#d6efff'; g2.fill(); ink(g2, 3);
        g2.beginPath(); g2.moveTo(x, y); g2.lineTo(x, y + h); g2.moveTo(x - w / 2, y + h * 0.5); g2.lineTo(x + w / 2, y + h * 0.5); g2.strokeStyle = INK; g2.lineWidth = 2.5; g2.stroke();
        g2.beginPath(); g2.moveTo(x - w / 2 - 6 * u, y - 4 * u); g2.lineTo(x - w * 0.15, y - 4 * u); g2.quadraticCurveTo(x - w * 0.3, y + h * 0.45, x - w / 2 - 6 * u, y + h * 0.6); g2.closePath();
        g2.moveTo(x + w / 2 + 6 * u, y - 4 * u); g2.lineTo(x + w * 0.15, y - 4 * u); g2.quadraticCurveTo(x + w * 0.3, y + h * 0.45, x + w / 2 + 6 * u, y + h * 0.6); g2.closePath();
        g2.fillStyle = '#e2533f'; g2.fill(); ink(g2, 2);
      }
      function drawCust(g2, c) {
        var A = petArt(), p = custPos(c), s = p.s * (A ? A.size(c.pet) : 1);
        g2.save(); g2.globalAlpha = c.alpha;
        if (!A) { circle(g2, p.x, p.y - 30 * s, 26 * s); g2.fillStyle = '#e9a46b'; g2.fill(); ink(g2, 2); g2.restore(); return; }
        var G = A.geo(c.pet, 'stand');
        g2.fillStyle = 'rgba(29,47,111,.14)'; g2.beginPath(); g2.ellipse(p.x, p.y, (G.x1 - G.x0) * s * 0.42, 5 * s, 0, 0, 7); g2.fill();
        var lift = c.hopT > 0 ? Math.abs(Math.sin(c.hopT * 8)) * 16 * s : (c.walking && A.hops(c.pet) && !REDUCED ? Math.abs(Math.sin(c.legs * 0.55)) * 6 * s : 0);
        g2.translate(p.x - (G.x0 + G.x1) / 2 * s * c.face, p.y - lift); g2.scale(s * c.face, s);
        A.draw(g2, c.pet, { t: T, legs: c.walking ? c.legs : 0, pose: 'stand', eye: c.happy > 0 ? 'happy' : 'open', mouth: c.happy > 1.5 ? 'open' : 'smile', wag: c.happy > 0 ? 1 : 0.2, seed: c.seed });
        g2.restore();
        if (c.vip) { var topY = p.y - lift + G.top * s - 12 * S.u; g2.save(); starPath(g2, p.x, topY, 10 * S.u); g2.fillStyle = '#f2b51d'; g2.fill(); ink(g2, 2); g2.restore(); }
      }
      function bubble(g2, c, w, h) {
        var A = petArt(), p = custPos(c), G = A ? A.geo(c.pet, 'stand') : { top: -50 }, s = p.s * (A ? A.size(c.pet) : 1);
        var headY = p.y + G.top * s, W = S.W;
        var bx = clamp(p.x + 20 * S.u - w * 0.3, 8, W - w - 8), by = Math.max(6, headY - h - 18 * S.u);
        var tipX = clamp(p.x + 10 * S.u, bx + 20, bx + w - 20);
        g2.beginPath(); rr(g2, bx, by, w, h, 16); g2.fillStyle = '#fff'; g2.fill(); ink(g2, 3);
        g2.beginPath(); g2.moveTo(tipX - 12, by + h - 2); g2.lineTo(tipX, by + h + 16 * S.u); g2.lineTo(tipX + 10, by + h - 2); g2.closePath(); g2.fillStyle = '#fff'; g2.fill();
        g2.beginPath(); g2.moveTo(tipX - 12, by + h); g2.lineTo(tipX, by + h + 16 * S.u); g2.lineTo(tipX + 10, by + h); ink(g2, 3);
        return { x: bx, y: by };
      }
      function orderBubble(g2, c) {
        var u = S.u, w = Math.min(S.W - 16, 250 * u), h = 158 * u;
        var b = bubble(g2, c, w, h);
        txt(g2, c.name + (c.vip ? ' (twój zwierzak!)' : '') + ':', b.x + 12, b.y + 16 * u, 19 * u, c.vip ? '#7a4fc4' : MUTED, 'left');
        // the order is not taken yet, so show a preview
        if (!c.preview) c.preview = S.R.newOrder(S.shifts);
        g2.save(); g2.translate(b.x + 8, b.y + 28 * u); S.R.drawOrder(g2, c.preview, w - 16, h - 34 * u); g2.restore();
        c.bubble = { x: b.x, y: b.y, w: w, h: h };
      }
      function sayBubble(g2, c, text) {
        var u = S.u; g2.font = Math.round(22 * u) + 'px ' + FONT;
        var w = Math.min(S.W - 16, g2.measureText(text).width + 30), h = 40 * u;
        var b = bubble(g2, c, w, h);
        txt(g2, text, b.x + w / 2, b.y + h / 2 + 1, 22 * u, INK);
      }
      function drawFx(g2) {
        var u = S.u;
        S.fx.forEach(function (f) {
          var k = f.life / f.max;
          if (f.kind === 'dot') { g2.globalAlpha = k; circle(g2, f.x, f.y, 4); g2.fillStyle = f.col; g2.fill(); g2.globalAlpha = 1; }
          else if (f.kind === 'star') { g2.globalAlpha = k; starPath(g2, f.x, f.y, 8); g2.fillStyle = '#f2b51d'; g2.fill(); ink(g2, 1.5); g2.globalAlpha = 1; }
          else if (f.kind === 'heart') { g2.globalAlpha = Math.min(1, k * 2); heartPath(g2, f.x + Math.sin(f.life * 5) * 6, f.y, 10 * u); g2.fillStyle = '#e2533f'; g2.fill(); ink(g2, 2); g2.globalAlpha = 1; }
          else if (f.kind === 'steam') { g2.globalAlpha = k * 0.7; circle(g2, f.x, f.y, f.r * (1.6 - k)); g2.fillStyle = '#fff'; g2.fill(); g2.globalAlpha = 1; }
          else if (f.kind === 'say') {
            var a = Math.min(1, k * 3), fs = Math.round(24 * clamp(u, 0.9, 1.3));
            g2.globalAlpha = a; g2.font = fs + 'px ' + FONT;
            var w = g2.measureText(f.text).width + 28, h = fs + 16, x = S.W / 2 - w / 2, y = (S.view === 'piec' && S.L ? S.L.oy + 6 : 10) + (1 - Math.min(1, (f.max - f.life) * 6)) * 10;
            rr(g2, x, y, w, h, h / 2); g2.fillStyle = INK; g2.fill();
            txt(g2, f.text, S.W / 2, y + h / 2 + 1, fs, '#fff');
            g2.globalAlpha = 1;
          }
        });
      }

      function draw() {
        if (!S || !g) return;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, S.W, S.H);
        if (S.view === 'lada' || S.view === 'podaj') drawScene(g, S.view === 'podaj');
        else S.R[S.view].draw(g, S);
        drawFx(g);
      }

      // ---------- act bar, tabs, rail ----------
      function sceneButtons() {
        var orderC = S.custs.filter(function (c) { return c.state === 'order' && atSpot(c); })[0];
        if (S.view === 'lada') {
          if (orderC) return { hint: 'Dotknij gościa albo przycisku, żeby przyjąć zamówienie.', b: [{ id: 'take', label: 'Przyjmij zamówienie', main: true, pulse: true, on: function () { takeOrder(orderC); } }] };
          if (S.item) { var w = S.R.where(S.item); return { hint: 'Zrób pizzę w kuchni.', b: [{ id: 'kitchen', label: 'Do kuchni →', main: true, pulse: !S.item.tops.length, on: function () { go(w); } }] }; }
          return { hint: S.spawned < SHIFT_N ? 'Czekamy na gościa…' : 'Już prawie koniec zmiany!', b: [] };
        }
        // podaj
        var t = S.ticket, it = S.item;
        if (S.card) return { hint: '', b: [] };
        if (!t || !it) return { hint: orderC ? 'Ktoś czeka przy ladzie.' : 'Najpierw przyjmij zamówienie.', b: [{ id: 'goLada', label: '← Do lady', main: true, on: function () { go('lada'); } }] };
        if (!S.R.ready(it)) { var w2 = S.R.where(it); return { hint: 'Najpierw zrób pizzę. ' + S.R.whereText[w2], b: [{ id: 'goWhere', label: 'Idź: ' + S.stationName(w2) + ' →', main: true, on: function () { go(w2); } }] }; }
        var c = t.cust, here = c.state === 'pickup' && atSpot(c);
        return { hint: here ? 'Podaj pizzę: ' + c.name + '.' : c.name + ' już idzie…', b: [{ id: 'back', label: '← Krojenie', on: function () { it.stage = 'cut'; go('krojenie'); } }, { id: 'serve', label: 'Podaj!', main: true, pulse: here, disabled: !here, on: serve }] };
      }
      var curBtns = [];
      function refresh() {
        if (!S) return;
        var r = S.view === 'lada' || S.view === 'podaj' ? sceneButtons() : { hint: S.R[S.view].hint(S), b: S.R[S.view].buttons(S) };
        var sig = r.hint + '|' + r.b.map(function (b) { return b.id + b.label + !!b.disabled + !!b.pulse + !!b.main; }).join(',');
        curBtns = r.b;
        if (sig === S.sig) return;
        S.sig = sig;
        hintEl.textContent = r.hint;
        btnsEl.innerHTML = '';
        r.b.forEach(function (b, i) {
          var e = el('button', 'rs-b' + (b.main ? ' main' : '') + (b.pulse && !REDUCED ? ' pulse' : ''), b.label); e.type = 'button'; e.disabled = !!b.disabled; e.dataset.id = b.id;
          e.onclick = function () { var cb = curBtns.filter(function (x) { return x.id === b.id; })[0]; if (cb && !cb.disabled) { if (!b.main) ctx.sfx('tap'); cb.on(); S.sig = ''; refresh(); } };
          btnsEl.appendChild(e);
        });
      }
      function refreshTabs() {
        var badges = S.R.hud ? S.R.hud(S) : {};
        if (S.custs.some(function (c) { return c.state === 'order' && atSpot(c); })) badges.lada = '!';
        if (S.item && S.R.ready(S.item)) badges.podaj = '!';
        var where = S.item ? S.R.where(S.item) : null;
        var sig = JSON.stringify(badges) + where;
        if (sig === S.tsig) return; S.tsig = sig;
        Object.keys(tabBtns).forEach(function (k) {
          var b = tabBtns[k], bd = b.querySelector('.bd'), v = badges[k];
          bd.textContent = v || ''; bd.className = 'bd' + (v ? ' on' : '') + (v && v !== '!' ? ' soft' : '');
          b.querySelector('.here').className = 'here' + (where === k ? ' on' : '');
        });
      }
      var railSig = '';
      function renderRail(force) {
        if (!S || !railTix) return;
        var sig = S.tickets.map(function (t) { return t.id; }).join(',') + '|' + (S.ticket && S.ticket.id) + '|' + S.W + '|' + S.done + '|' + S.tips;
        if (!force && sig === railSig) return; railSig = sig;
        railTix.innerHTML = '';
        var narrow = S.W < 520, wide = S.W >= 1100, tw = narrow ? 150 : wide ? 230 : 190, th = narrow ? 80 : wide ? 114 : 96;
        if (!S.tickets.length) railTix.appendChild(el('div', 'rs-empty', 'Tu przypinamy zamówienia.'));
        S.tickets.forEach(function (t) {
          var tk = el('div', 'rs-tk' + (t === S.ticket ? ' cur' : '')), c = smallCanvas(tw, th);
          tk.appendChild(c.c); railTix.appendChild(tk);
          S.R.drawOrder(c.g, t.order, tw, th);
          // the guest's face in the corner
          var A = petArt();
          if (A) { c.g.save(); c.g.globalAlpha = 0.95; drawPetFitTk(c.g, t.cust.pet, tw - 34, 2, 32, 26); c.g.restore(); }
          tk.title = t.cust.name;
        });
        railDots.innerHTML = '';
        for (var i = 0; i < SHIFT_N; i++) railDots.appendChild(el('i', i < S.done ? 'on' : ''));
        railJar.innerHTML = '<b>★</b> ' + S.tips;
      }
      function drawPetFitTk(g2, pet, x, y, w, h) { drawPetFit(g2, pet, x, y, w, h, { eye: 'open' }); }

      // ---------- input ----------
      function pt(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
      function onDown(e) {
        if (!S || S.card) return;
        try { cv.setPointerCapture(e.pointerId); } catch (er) {}
        var p = pt(e);
        if (S.view === 'lada') {
          var hit = S.custs.filter(function (c) {
            if (c.state !== 'order' || !atSpot(c)) return false;
            var q = custPos(c);
            if (Math.abs(p.x - q.x) < 70 * S.u && p.y < q.y + 10 && p.y > q.y - 140 * S.u) return true;
            var b = c.bubble; return b && p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h;
          })[0];
          if (hit) takeOrder(hit);
          return;
        }
        if (S.view === 'podaj') {
          var t = S.ticket; if (t && t.cust.state === 'pickup' && atSpot(t.cust)) { var q2 = custPos(t.cust); if (Math.abs(p.x - (S.W / 2 + SPOT.pickup.x * S.u)) < 90 * S.u && p.y > q2.y - 150 * S.u) serve(); }
          return;
        }
        var stn = S.R[S.view]; if (stn.down) stn.down(S, p.x, p.y);
        S.sig = ''; refresh();
      }
      function onMove(e) { if (!S || !S.drag) return; var p = pt(e), stn = S.R[S.view]; if (stn && stn.move) stn.move(S, p.x, p.y); }
      function onUp(e) { if (!S) return; var p = pt(e), stn = S.R[S.view]; if (stn && stn.up && S.drag) stn.up(S, p.x, p.y); S.drag = null; S.sig = ''; refresh(); }
      function onCancel() { if (S) S.drag = null; }

      // ---------- loop ----------
      var tick = 0;
      function frame(now) {
        raf = 0; if (!running || destroyed) return;
        raf = requestAnimationFrame(frame);
        var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now; T += dt;
        if (!S || !cv) return;
        if (!S.card) update(dt); else { S.T = T; updateCusts(dt); S.fx.forEach(function (f) { f.life -= dt; if (f.vx != null) { f.x += f.vx * dt; f.y += f.vy * dt; } }); S.fx = S.fx.filter(function (f) { return f.life > 0; }); }
        draw();
        if ((tick++ % 6) === 0) { refresh(); refreshTabs(); renderRail(false); }
      }
      function start() { if (!raf && running && !destroyed) { last = 0; raf = requestAnimationFrame(frame); } }

      // ---------- boot ----------
      showHub();
      if (!st.seenHelp) {
        st.seenHelp = true; save();
        ctx.panel({ title: 'Restauracje', lines: ['Zwierzaki zamawiają przy ladzie.', 'Zrób jedzenie jak na karteczce: dodatki, piec, krojenie.', 'Za dobre jedzenie dostaniesz napiwek w ★.'], button: 'Zaczynamy!', closable: false });
      }

      return {
        pause: function () { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
        resume: function () { if (running || destroyed) return; running = true; start(); },
        destroy: function () {
          destroyed = true; running = false; if (raf) cancelAnimationFrame(raf); raf = 0;
          laterT.forEach(clearTimeout); laterT = [];
          offs.forEach(function (f) { f(); }); offs = [];
          endShiftView();
          root.remove();
        }
      };
    }
  });
})();
