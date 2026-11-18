/*
 * Restauracje: Burgerownia Bułeczka. A module for games/restauracje.js (the contract is described there).
 * A guest orders a set: a burger, a drink and (from FRIES_AT shifts) fries.
 *   Grill: put the patty on, flip it and take it off when the needle is in the frame (both sides count).
 *   Składanie: drop the layers on the bun from the bottom up, in the order of the ticket, as straight as you can.
 *   Napoje: hold a tap to pour up to the line; lower the fries into the oil and lift them when golden.
 * The three stations can be done in any order, so the drink can be poured while the patty sizzles.
 * Ingredients unlock with shifts played (ING[].at). Layer sizes are in units of the burger width.
 */
(function () {
  'use strict';
  if (!window.NG || !NG.restauracje) return;
  var H = NG.restauracje.H, INK = H.INK, MUTED = H.MUTED, GOLD = H.GOLD, GREEN = H.GREEN, REDUCED = H.REDUCED;
  var clamp = H.clamp, rnd = H.rnd, rint = H.rint, pick = H.pick, lerp = H.lerp, shuffle = H.shuffle, mix = H.mix;
  var rr = H.rr, ink = H.ink, circle = H.circle, flame = H.flame, txt = H.txt;

  var GRILL_S = 11, ZONE = 0.1, POUR_S = 1.9, FRY_S = 9, FRY_C = 0.6, FRY_Z = 0.13, FRIES_AT = 3, MAX_STACK = 8;
  var DONE = [{ n: 'lekko', c: 0.3, f: 1 }, { n: 'średnio', c: 0.55, f: 2 }, { n: 'mocno', c: 0.8, f: 3 }];
  var ING = [
    { k: 'salata', n: 'sałata', at: 0 }, { k: 'ser', n: 'ser', at: 0 }, { k: 'pomidor', n: 'pomidor', at: 0 },
    { k: 'ketchup', n: 'ketchup', at: 1 }, { k: 'ogorek', n: 'ogórek', at: 2 }, { k: 'frytki', n: 'frytki', at: FRIES_AT, side: true },
    { k: 'cebula', n: 'cebula', at: 4 }, { k: 'musztarda', n: 'musztarda', at: 5 }, { k: 'bekon', n: 'bekon', at: 6 }, { k: 'jajko', n: 'jajko', at: 8 }
  ];
  var NAME = { kotlet: 'kotlet' }; ING.forEach(function (i) { NAME[i.k] = i.n; });
  var TH = { kotlet: 0.17, ser: 0.06, salata: 0.08, pomidor: 0.085, ogorek: 0.065, cebula: 0.065, bekon: 0.075, jajko: 0.1, ketchup: 0.05, musztarda: 0.05 };
  var BUN_B = 0.16, BUN_T = 0.3;
  var DRINKS = [{ k: 'pom', n: 'sok pomarańczowy', c: '#f6a21e' }, { k: 'mal', n: 'sok malinowy', c: '#e0457b' }, { k: 'cyt', n: 'lemoniada', c: '#f1dc45' }];
  var DRINKB = {}; DRINKS.forEach(function (d) { DRINKB[d.k] = d; });
  var LINES = [0.55, 0.85];   // small and large drink
  function layersFor(shifts) { return ING.filter(function (i) { return !i.side && shifts >= i.at; }); }

  var PATTY = [[0, '#ec98a2'], [0.3, '#b9714f'], [0.55, '#8a4f2c'], [0.8, '#5e3620'], [1, '#33201a']];
  function pattyCol(b) {
    b = clamp(b, 0, 1);
    for (var i = 1; i < PATTY.length; i++) if (b <= PATTY[i][0]) return mix(PATTY[i - 1][1], PATTY[i][1], (b - PATTY[i - 1][0]) / (PATTY[i][0] - PATTY[i - 1][0]));
    return PATTY[PATTY.length - 1][1];
  }
  function friesCol(c) { return c <= FRY_C ? mix('#fff3c4', '#f5b92a', c / FRY_C) : mix('#f5b92a', '#7a4a22', (c - FRY_C) / (1 - FRY_C)); }
  function zoneScore(v, c, z) { var d = Math.abs(v - c); return d <= z ? 1 : clamp(1 - (d - z) / 0.3, 0.1, 1); }

  // =====================================================================
  // Drawing: the burger from the side. A layer sits on y (its bottom), centred on x, burger width w.
  // =====================================================================
  function drawLayer(g, k, x, y, w, cook) {
    var h = (TH[k] || 0.08) * w, lw = Math.max(1, w * 0.022), i;
    if (k === 'kotlet') {
      rr(g, x - w * 0.5, y - h, w, h, h * 0.45); g.fillStyle = pattyCol(cook == null ? 0.55 : cook); g.fill(); ink(g, lw);
      g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = lw; g.beginPath(); g.moveTo(x - w * 0.36, y - h * 0.62); g.lineTo(x + w * 0.2, y - h * 0.62); g.stroke();
    } else if (k === 'ser') {
      g.beginPath(); g.moveTo(x - w * 0.53, y - h); g.lineTo(x + w * 0.53, y - h); g.lineTo(x + w * 0.53, y); g.lineTo(x + w * 0.4, y + h * 1.5); g.lineTo(x + w * 0.2, y); g.lineTo(x - w * 0.53, y); g.closePath();
      g.fillStyle = '#ffd23f'; g.fill(); ink(g, lw);
    } else if (k === 'salata') {
      g.beginPath(); g.moveTo(x - w * 0.56, y - h);
      g.lineTo(x + w * 0.56, y - h);
      for (i = 0; i < 7; i++) { var x1 = x + w * 0.56 - (i + 1) * w * 0.16, xm = x + w * 0.56 - (i + 0.5) * w * 0.16; g.quadraticCurveTo(xm, y + h * 0.75, x1, y - h * 0.25); }
      g.closePath(); g.fillStyle = '#6cc04a'; g.fill(); ink(g, lw);
    } else if (k === 'pomidor') {
      [-0.26, 0.26].forEach(function (d) {
        rr(g, x + (d - 0.24) * w, y - h, w * 0.48, h, h * 0.5); g.fillStyle = '#e2533f'; g.fill(); ink(g, lw);
        rr(g, x + (d - 0.17) * w, y - h * 0.68, w * 0.34, h * 0.36, h * 0.18); g.fillStyle = '#f58d77'; g.fill();
      });
    } else if (k === 'ogorek') {
      [-0.32, 0, 0.32].forEach(function (d) {
        g.beginPath(); g.ellipse(x + d * w, y - h / 2, w * 0.15, h / 2, 0, 0, 7); g.fillStyle = '#3e9d4b'; g.fill(); ink(g, lw);
        g.beginPath(); g.ellipse(x + d * w, y - h / 2, w * 0.1, h * 0.26, 0, 0, 7); g.fillStyle = '#b6e08a'; g.fill();
      });
    } else if (k === 'cebula') {
      [-0.3, 0, 0.3].forEach(function (d) {
        g.beginPath(); g.ellipse(x + d * w, y - h / 2, w * 0.16, h / 2, 0, 0, 7); g.fillStyle = '#b565c9'; g.fill(); ink(g, lw);
        g.beginPath(); g.ellipse(x + d * w, y - h / 2, w * 0.1, h * 0.24, 0, 0, 7); g.fillStyle = '#f7e9fb'; g.fill();
      });
    } else if (k === 'bekon' || k === 'ketchup' || k === 'musztarda') {
      var th = k === 'bekon' ? h * 0.62 : h * 0.55, n = k === 'bekon' ? 5 : 7, a = h * 0.22, span = w * (k === 'bekon' ? 1.04 : 0.84);
      g.beginPath();
      for (i = 0; i <= n * 4; i++) { var px = x - span / 2 + span * i / (n * 4), py = y - h / 2 + Math.sin(i / 4 * Math.PI * 2) * a; g[i ? 'lineTo' : 'moveTo'](px, py); }
      g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = INK; g.lineWidth = th + lw * 2; g.stroke();
      g.strokeStyle = k === 'bekon' ? '#c8432d' : k === 'ketchup' ? '#d9412e' : '#f2c21d'; g.lineWidth = th; g.stroke();
      if (k === 'bekon') { g.strokeStyle = '#f7b5a6'; g.lineWidth = th * 0.3; g.stroke(); }
    } else if (k === 'jajko') {
      rr(g, x - w * 0.5, y - h * 0.5, w, h * 0.5, h * 0.25); g.fillStyle = '#fff'; g.fill(); ink(g, lw);
      g.beginPath(); g.arc(x + w * 0.04, y - h * 0.48, w * 0.14, Math.PI, 0); g.closePath(); g.fillStyle = '#ffc93c'; g.fill(); ink(g, lw);
    }
  }
  function bunBottom(g, x, y, w) {
    var h = BUN_B * w;
    g.beginPath(); g.moveTo(x - w * 0.5, y - h); g.lineTo(x + w * 0.5, y - h); g.lineTo(x + w * 0.5, y - h * 0.5); g.quadraticCurveTo(x + w * 0.5, y, x + w * 0.38, y); g.lineTo(x - w * 0.38, y); g.quadraticCurveTo(x - w * 0.5, y, x - w * 0.5, y - h * 0.5); g.closePath();
    g.fillStyle = '#e9a13f'; g.fill(); ink(g, Math.max(1, w * 0.022));
  }
  function bunTop(g, x, y, w) {
    var h = BUN_T * w;
    g.beginPath(); g.moveTo(x - w * 0.52, y); g.bezierCurveTo(x - w * 0.52, y - h * 1.32, x + w * 0.52, y - h * 1.32, x + w * 0.52, y); g.closePath();
    g.fillStyle = '#e9a13f'; g.fill(); ink(g, Math.max(1, w * 0.022));
    [[-0.26, 0.55, 0.3], [0, 0.78, -0.2], [0.24, 0.58, 0.5], [-0.1, 0.42, -0.5], [0.12, 0.36, 0.2]].forEach(function (p) { g.beginPath(); g.ellipse(x + p[0] * w, y - h * p[1], w * 0.035, w * 0.018, p[2], 0, 7); g.fillStyle = '#fff6d8'; g.fill(); });
  }
  function stackUnits(keys, gap) { var u = BUN_B + BUN_T + gap * (keys.length + 1); keys.forEach(function (k) { u += TH[k] || 0.08; }); return u; }
  // layers: [{ k, dx, cook, t0 }]; opt: gap (units), top (draw the top bun), topT0, mark (index to point at), now
  function drawStack(g, x, y, w, layers, opt) {
    opt = opt || {};
    var gap = (opt.gap || 0) * w, yy = y, now = opt.now || 0, fall = function (t0) { if (t0 == null || REDUCED) return 0; var a = (now - t0) / 0.22; return a >= 1 ? 0 : (1 - a * a) * w * 0.9; };
    bunBottom(g, x, yy, w); yy -= BUN_B * w + gap;
    layers.forEach(function (l, i) {
      var lx = x + (l.dx || 0) * w, ly = yy - fall(l.t0);
      drawLayer(g, l.k, lx, ly, w, l.cook);
      if (opt.mark === i) { g.beginPath(); g.moveTo(x - w * 0.62, yy - TH[l.k] * w / 2); g.lineTo(x - w * 0.82, yy - TH[l.k] * w / 2 - w * 0.09); g.lineTo(x - w * 0.82, yy - TH[l.k] * w / 2 + w * 0.09); g.closePath(); g.fillStyle = GOLD; g.fill(); ink(g, Math.max(1, w * 0.02)); }
      yy -= (TH[l.k] || 0.08) * w + gap;
    });
    if (opt.top) bunTop(g, x + (opt.topDx || 0) * w, yy - fall(opt.topT0), w);
    return yy;
  }
  function drawCup(g, x, y, w, col, fill, line) {
    var h = w * 1.35, tw = w * 0.5, bw = w * 0.36;
    function body() { g.beginPath(); g.moveTo(x - tw, y - h); g.lineTo(x + tw, y - h); g.lineTo(x + bw, y); g.lineTo(x - bw, y); g.closePath(); }
    body(); g.fillStyle = 'rgba(255,255,255,.9)'; g.fill();
    if (col && fill > 0) { g.save(); body(); g.clip(); g.fillStyle = col; g.fillRect(x - tw, y - h * clamp(fill, 0, 1), tw * 2, h); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x - tw, y - h * clamp(fill, 0, 1), tw * 2, Math.max(1.5, h * 0.04)); g.restore(); }
    body(); ink(g, Math.max(1.2, w * 0.05));
    if (line != null) {
      var ly = y - h * line, lw2 = lerp(bw, tw, line);
      g.setLineDash([Math.max(2, w * 0.1), Math.max(2, w * 0.08)]); g.beginPath(); g.moveTo(x - lw2, ly); g.lineTo(x + lw2, ly); g.strokeStyle = INK; g.lineWidth = Math.max(1, w * 0.045); g.stroke(); g.setLineDash([]);
      g.beginPath(); g.moveTo(x + lw2 + w * 0.06, ly); g.lineTo(x + lw2 + w * 0.26, ly - w * 0.1); g.lineTo(x + lw2 + w * 0.26, ly + w * 0.1); g.closePath(); g.fillStyle = '#e2533f'; g.fill();
    }
  }
  function drawFriesBox(g, x, y, w, cook) {
    var col = friesCol(cook == null ? FRY_C : cook), lw = Math.max(1, w * 0.05);
    [-0.3, -0.12, 0.06, 0.24, -0.2, 0.15].forEach(function (d, i) { rr(g, x + d * w - w * 0.06, y - w * (1.25 - (i % 3) * 0.1), w * 0.13, w * 0.8, w * 0.04); g.fillStyle = col; g.fill(); ink(g, lw * 0.7); });
    g.beginPath(); g.moveTo(x - w * 0.42, y - w * 0.72); g.quadraticCurveTo(x, y - w * 0.56, x + w * 0.42, y - w * 0.72); g.lineTo(x + w * 0.32, y); g.lineTo(x - w * 0.32, y); g.closePath();
    g.fillStyle = '#e2533f'; g.fill(); ink(g, lw);
    rr(g, x - w * 0.12, y - w * 0.46, w * 0.24, w * 0.24, w * 0.05); g.fillStyle = '#ffd95a'; g.fill();
  }
  // patty from above (the grill)
  function drawPattyTop(g, x, y, r, v) {
    circle(g, x, y, r); g.fillStyle = pattyCol(v); g.fill(); ink(g, Math.max(2, r * 0.07));
    g.save(); circle(g, x, y, r * 0.93); g.clip();
    if (v > 0.12) { g.strokeStyle = 'rgba(40,20,10,' + clamp(v * 0.7, 0, 0.6) + ')'; g.lineWidth = r * 0.09; for (var i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(x - r, y + i * r * 0.36 - r * 0.2); g.lineTo(x + r, y + i * r * 0.36 + r * 0.2); g.stroke(); } }
    g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(x - r * 0.3, y - r * 0.4, r * 0.35, r * 0.16, -0.5, 0, 7); g.fill();
    g.restore();
  }
  function flamesBadge(g, x, y, fs, n) {
    var bw = fs * 6.4, bh = fs * 2.5;
    rr(g, x, y, bw, bh, bh / 2); g.fillStyle = '#fff'; g.fill(); ink(g, Math.max(1, fs * 0.22));
    for (var i = 0; i < 3; i++) flame(g, x + bh * 0.5 + i * fs * 1.9, y + bh * 0.5, fs * 0.82, i < n);
  }

  // the order as a picture: the burger (with small gaps so every layer can be read), the drink and the fries
  function drawOrder(g, o, w, h) {
    var pad = Math.max(4, h * 0.06), keys = o.layers, gap = 0.035, units = stackUnits(keys, gap);
    var bw = Math.min(w * 0.36, (h - pad * 2 - h * 0.1) / units), bx = pad + w * 0.21, by = h - pad - h * 0.04;
    drawStack(g, bx, by, bw, keys.map(function (k) { return { k: k, cook: DONE[o.done].c }; }), { gap: gap, top: true });
    var fs = Math.min(h * 0.075, w * 0.03);
    flamesBadge(g, w * 0.5, h - fs * 2.5 - 2, fs, DONE[o.done].f);
    var cw = Math.min(w * 0.15, h * 0.3), cx = w * 0.6, cy = h * 0.74;
    drawCup(g, cx, cy, cw, DRINKB[o.drink].c, LINES[o.size], null);
    if (o.fries) drawFriesBox(g, w * 0.84, cy, cw * 0.95);
  }

  // =====================================================================
  // Orders, items, scoring
  // =====================================================================
  function burgerOrder(shifts) {
    var ings = layersFor(shifts).map(function (i) { return i.k; });
    var nx = shifts < 1 ? 2 : shifts < 3 ? rint(2, 3) : shifts < 6 ? rint(2, 4) : rint(3, 4);
    var newest = layersFor(shifts).sort(function (a, b) { return b.at - a.at; })[0];
    var extra = shuffle(ings.slice()).slice(0, Math.min(nx, ings.length));
    if (newest && newest.at > 0 && shifts - newest.at < 3 && extra.indexOf(newest.k) < 0 && Math.random() < 0.45) extra[0] = newest.k;
    var layers = shifts < 2 ? ['kotlet'].concat(extra) : (function () { var a = extra.slice(); a.splice(rint(0, Math.min(1, a.length)), 0, 'kotlet'); return a; })();
    if (shifts >= 2 && Math.random() < (shifts >= 5 ? 0.45 : 0.25)) layers.splice(rint(2, layers.length), 0, 'kotlet');
    return { layers: layers, done: shifts < 1 ? 1 : rint(0, 2), drink: pick(DRINKS).k, size: shifts < 1 ? 1 : rint(0, 1), fries: shifts >= FRIES_AT && Math.random() < 0.6 };
  }
  function pattyCount(o) { return o.layers.filter(function (k) { return k === 'kotlet'; }).length; }
  function newBurger(o) {
    var p = []; for (var i = 0; i < pattyCount(o); i++) p.push({ s: [0, 0], face: 0, st: 'raw', flipT: 1 });
    return { patties: p, stack: [], stackDone: false, topT0: null, drink: { k: null, fill: 0 }, fries: { st: 'raw', cook: 0 }, sideDone: false, spill: false };
  }
  function grillDone(it) { return it.patties.every(function (p) { return p.st === 'off'; }); }
  function pattyCook(p) { return (p.s[0] + p.s[1]) / 2; }
  function freePatties(it) { return it.patties.filter(function (p) { return p.st === 'off'; }).length - it.stack.filter(function (l) { return l.k === 'kotlet'; }).length; }
  function stackMatch(o, it) { var n = Math.max(o.layers.length, it.stack.length), ok = 0; for (var i = 0; i < n; i++) if (it.stack[i] && it.stack[i].k === o.layers[i]) ok++; return n ? ok / n : 0; }
  function lean(it) { if (!it.stack.length) return 1; var s = 0; it.stack.forEach(function (l) { s += Math.abs(l.dx); }); return s / it.stack.length; }

  function burgerScore(o, it) {
    var c = DONE[o.done].c, gs = 0, raw = 0, st = BURGER.stations;
    it.patties.forEach(function (p) { if (p.s[0] + p.s[1] <= 0) raw++; gs += (zoneScore(p.s[0], c, ZONE) + zoneScore(p.s[1], c, ZONE)) / 2 * (p.s[0] + p.s[1] > 0 ? 1 : 0); });
    gs = it.patties.length ? gs / it.patties.length : 1;
    var avgCook = 0; it.patties.forEach(function (p) { avgCook += pattyCook(p); }); avgCook /= Math.max(1, it.patties.length);
    var match = stackMatch(o, it), straight = 1 - clamp((lean(it) - 0.05) / 0.22, 0, 1);
    var stack = it.stack.length ? 0.72 * match + 0.28 * straight : 0;
    var d = it.drink, line = LINES[o.size], ds = !d.k || d.fill < 0.05 ? 0 : d.k !== o.drink ? 0.25 : 1 - clamp((Math.abs(d.fill - line) - 0.06) / 0.3, 0, 0.8);
    var fs = o.fries ? (it.fries.cook > 0.02 ? zoneScore(it.fries.cook, FRY_C, FRY_Z) : 0) : 1;
    var side = o.fries ? (ds + fs) / 2 : ds;
    return [
      { k: 'grill', n: 'Grill', icon: st[0].icon, v: gs, tip: raw ? 'Usmaż kotlet na grillu.' : avgCook < c ? 'Potrzymaj kotlet na grillu dłużej, z obu stron.' : 'Zdejmij kotlet z grilla trochę wcześniej.' },
      { k: 'stack', n: 'Składanie', icon: st[1].icon, v: stack, tip: match < 1 ? 'Układaj warstwy od dołu, w tej samej kolejności co na karteczce.' : 'Upuszczaj składniki na sam środek bułki.' },
      { k: 'side', n: o.fries ? 'Napój i frytki' : 'Napój', icon: st[2].icon, v: side, tip: d.k && d.k !== o.drink ? 'Nalej napój w tym kolorze, co na karteczce.' : ds < 0.82 ? 'Nalewaj napój równo do kreski.' : 'Wyjmij frytki, gdy będą złote.' }
    ];
  }

  // =====================================================================
  // The module
  // =====================================================================
  var BURGER = {
    id: 'burger', name: 'Burgerownia', sign: 'Burgerownia Bułeczka', signCol: '#2f6cb5', req: { id: 'pizzeria', shifts: 3 },
    wall: '#e5f0ff', wall2: '#d3e4fb', trim: '#3f86d8', counter: '#3f86d8', counter2: '#2f6cb5', floor1: '#f4f6fa', floor2: '#dfe5ee', curtain: '#f2b51d', cloth: '#ffd95a',
    stat: 'burgers', madeLabel: 'Zrobione', fastS: 130, okS: 200,
    hi: ['Dzień dobry! Poproszę taki zestaw:', 'Cześć! Mam ochotę na taki zestaw:', 'Poproszę taki zestaw, dziękuję!', 'Mniam! Chcę taki zestaw:'],
    bye: {
      3: ['Pyszny! Dziękuję!', 'Najlepszy burger na świecie!', 'Mniam, mniam! Super!'],
      2: ['Smaczny! Dziękuję!', 'Bardzo dobry, dzięki!', 'Mniam! Dziękuję!'],
      1: ['Dziękuję! Zjem ze smakiem.', 'Dzięki! Zjem całego!', 'Dziękuję bardzo!']
    },
    tx: { make: 'Zrób zestaw w kuchni.', serve: 'Podaj zestaw', first: 'Najpierw zrób zestaw.' },
    hereIcon: '<path d="M3 12 a9 8 0 0 1 18 0 z" fill="#e9a13f" stroke="#1d2f6f" stroke-width="2" stroke-linejoin="round"/><rect x="3" y="13" width="18" height="4" rx="2" fill="#8a4f2c" stroke="#1d2f6f" stroke-width="1.6"/><rect x="4" y="18" width="16" height="4" rx="2" fill="#e9a13f" stroke="#1d2f6f" stroke-width="1.6"/>',
    podajIcon: '<ellipse cx="20" cy="31" rx="17" ry="5" fill="#c9d6ea" stroke="#1d2f6f" stroke-width="2.5"/><path d="M8 20 a9 8 0 0 1 18 0 z" fill="#e9a13f" stroke="#1d2f6f" stroke-width="2.2" stroke-linejoin="round"/><rect x="8" y="21" width="18" height="4" rx="2" fill="#8a4f2c" stroke="#1d2f6f" stroke-width="1.8"/><rect x="9" y="26" width="16" height="4" rx="2" fill="#e9a13f" stroke="#1d2f6f" stroke-width="1.8"/><path d="M29 17 h7 l-1.4 13 h-4.2 z" fill="#f6a21e" stroke="#1d2f6f" stroke-width="2" stroke-linejoin="round"/>',
    stations: [
      { k: 'grill', n: 'Grill', icon: '<rect x="4" y="12" width="32" height="22" rx="5" fill="#4a5568" stroke="#1d2f6f" stroke-width="2.5"/><path d="M9 17 h22 M9 23 h22 M9 29 h22" stroke="#1d2f6f" stroke-width="1.6"/><ellipse cx="20" cy="23" rx="9" ry="7" fill="#8a4f2c" stroke="#1d2f6f" stroke-width="2"/><path d="M14 9 q-2 -3 0 -6 M20 9 q-2 -3 0 -6 M26 9 q-2 -3 0 -6" fill="none" stroke="#9aa6c0" stroke-width="2" stroke-linecap="round"/>' },
      { k: 'skladanie', n: 'Składanie', icon: '<path d="M6 17 a14 12 0 0 1 28 0 z" fill="#e9a13f" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/><path d="M5 20 h30" stroke="#6cc04a" stroke-width="4" stroke-linecap="round"/><rect x="6" y="23" width="28" height="6" rx="3" fill="#8a4f2c" stroke="#1d2f6f" stroke-width="2"/><rect x="7" y="30" width="26" height="6" rx="3" fill="#e9a13f" stroke="#1d2f6f" stroke-width="2.2"/>' },
      { k: 'napoje', n: 'Napoje', icon: '<path d="M9 13 h16 l-2 23 h-12 z" fill="#fff" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/><path d="M10.5 22 h13 l-1.2 12.5 h-10.6 z" fill="#f6a21e"/><path d="M19 13 l4 -10" stroke="#e2533f" stroke-width="3" stroke-linecap="round"/><rect x="28" y="20" width="3" height="15" rx="1" fill="#f5b92a" stroke="#1d2f6f" stroke-width="1.2"/><rect x="32" y="17" width="3" height="18" rx="1" fill="#f5b92a" stroke="#1d2f6f" stroke-width="1.2"/>' }
    ],
    newOrder: burgerOrder, newItem: newBurger, drawOrder: drawOrder, score: burgerScore,
    where: function (it) { return !grillDone(it) ? 'grill' : !it.stackDone ? 'skladanie' : !it.sideDone ? 'napoje' : 'podaj'; },
    at: function (it, k) { return k === 'grill' ? !grillDone(it) : k === 'skladanie' ? !it.stackDone : k === 'napoje' ? !it.sideDone : false; },
    ready: function (it) { return grillDone(it) && it.stackDone && it.sideDone; },
    whereText: { grill: 'Kotlet czeka na grillu.', skladanie: 'Burger czeka na składanie.', napoje: 'Brakuje jeszcze napoju.', podaj: 'Zestaw czeka na podanie.' },
    started: function (it) { return it.patties.some(function (p) { return p.st !== 'raw'; }) || it.stack.length > 0 || it.drink.fill > 0; },
    back: function (it) { it.sideDone = false; return { k: 'napoje' }; }, backLabel: '← Napoje',
    init: function (S) { S.btool = null; },
    onTicket: function (S) { S.btool = null; },
    onServe: function (o, it, ctx) { ctx.sticker('burger'); if (it.stack.length >= 4 && stackMatch(o, it) === 1 && lean(it) < 0.06) ctx.sticker('tower'); },
    badge: function (it, o) {
      var c = DONE[o.done].c, g = it.patties.filter(function (p) { return p.st === 'grill'; });
      if (g.some(function (p) { return Math.abs(p.s[p.face] - c) <= ZONE; })) return 'Grill!';
      if (it.fries.st === 'oil' && Math.abs(it.fries.cook - FRY_C) <= FRY_Z) return 'Frytki!';
      if (g.length) return 'Grill'; if (it.fries.st === 'oil') return 'Frytki';
      return BURGER.ready(it) ? 'Gotowy' : null;
    },
    unlockN: ING.length, unlockWord: 'Nowy składnik',
    unlocked: function (shifts) { return ING.filter(function (i) { return shifts >= i.at; }).length; },
    nextUnlock: function (shifts) { var t = ING.filter(function (x) { return x.at > shifts; })[0]; return t ? t.at - shifts : 0; },
    newUnlocks: function (shifts) { return ING.filter(function (t) { return t.at === shifts; }).map(function (t) { return t.n; }); },
    unlockRow: function (g, w, h, shifts) {
      var n = ING.length;
      ING.forEach(function (t, i) {
        var x = (i + 0.5) * w / n, ok = shifts >= t.at, s = Math.min(w / n * 0.72, h * 0.8);
        g.save(); g.globalAlpha = ok ? 1 : 0.22;
        if (t.side) drawFriesBox(g, x, h * 0.92, s * 0.62); else { g.translate(x, h / 2); g.scale(1, 2.2); drawLayer(g, t.k, 0, TH[t.k] * s / 2, s); }
        g.restore();
        if (!ok) { rr(g, x - 5, h / 2 - 2, 10, 8, 2); g.fillStyle = MUTED; g.fill(); g.beginPath(); g.arc(x, h / 2 - 2, 3.5, Math.PI, 0); g.strokeStyle = MUTED; g.lineWidth = 2; g.stroke(); }
      });
    },
    board: function (g, x, y, s) { drawStack(g, x, y + s * 0.8, s * 1.8, [{ k: 'kotlet' }, { k: 'salata' }], { top: true }); },
    card: function (g, w, h) {
      var p = H.shopCard(g, w, h, { wall: '#e5f0ff', sign: 'Burgerownia Bułeczka', signCol: '#2f6cb5', awning: '#f2b51d', door: '#7d8fb0' });
      drawStack(g, p.x, p.y + p.s * 0.95, p.s * 1.9, [{ k: 'kotlet' }, { k: 'ser' }, { k: 'salata' }, { k: 'pomidor' }], { top: true });
    },
    // the set on a tray
    drawServe: function (g, it, x, y, R) {
      g.save(); g.lineWidth = 1;
      g.beginPath(); g.ellipse(x, y + R * 0.08, R * 1.2, R * 0.5, 0, 0, 7); g.fillStyle = 'rgba(29,47,111,.15)'; g.fill();
      g.beginPath(); g.ellipse(x, y, R * 1.18, R * 0.48, 0, 0, 7); g.fillStyle = '#c9d6ea'; g.fill(); ink(g, Math.max(1.2, R * 0.045));
      g.beginPath(); g.ellipse(x, y, R * 1.02, R * 0.38, 0, 0, 7); g.strokeStyle = '#aebbd4'; g.lineWidth = Math.max(1, R * 0.03); g.stroke();
      var fr = it.fries.cook > 0.02;
      if (fr) drawFriesBox(g, x + R * 0.3, y - R * 0.04, R * 0.6, it.fries.cook);
      if (it.drink.k && it.drink.fill > 0.02) drawCup(g, x + R * 0.8, y + R * 0.14, R * 0.5, DRINKB[it.drink.k].c, it.drink.fill, null);
      var cooks = it.patties.map(pattyCook), ci = 0;
      drawStack(g, x - R * 0.4, y + R * 0.24, R * 1.12, it.stack.map(function (l) { return { k: l.k, dx: l.dx * 0.6, cook: l.k === 'kotlet' ? cooks[ci++] : null }; }), { top: true });
      g.restore();
    },
    update: function (dt, S) {
      S.tickets.forEach(function (t) {
        var it = t.item, c = DONE[t.order.done].c, cur = t === S.ticket;
        it.patties.forEach(function (p) {
          if (p.flipT < 1) p.flipT = Math.min(1, p.flipT + dt / 0.3);
          if (p.st !== 'grill') return;
          var was = p.s[p.face]; p.s[p.face] = Math.min(1, was + dt / GRILL_S);
          if (was < c - ZONE && p.s[p.face] >= c - ZONE) { S.sfx('tick'); S.flash('grill'); if (S.view !== 'grill' || !cur) S.say(p.face ? 'Kotlet gotowy!' : 'Czas przewrócić kotlet!'); }
        });
        if (it.fries.st === 'oil') {
          var wf = it.fries.cook; it.fries.cook = Math.min(1, wf + dt / FRY_S);
          if (wf < FRY_C - FRY_Z && it.fries.cook >= FRY_C - FRY_Z) { S.sfx('tick'); S.flash('napoje'); if (S.view !== 'napoje' || !cur) S.say('Frytki są złote!'); }
        }
      });
      // pouring while a tap is held
      var it2 = S.item, d = S.drag;
      if (it2 && S.view === 'napoje' && d && d.pour) {
        var was2 = it2.drink.fill; it2.drink.fill = Math.min(1, was2 + dt / POUR_S);
        if (S.T - (S.lastPour || 0) > 0.16) { S.lastPour = S.T; S.sfx('water'); }
        if (was2 < 1 && it2.drink.fill >= 1) { S.say('Ups, pełno!'); S.sfx('splash'); }
      }
    },
    hud: function (S) {
      var b = {};
      S.tickets.forEach(function (t) {
        var it = t.item, c = DONE[t.order.done].c;
        if (it.patties.some(function (p) { return p.st === 'grill' && Math.abs(p.s[p.face] - c) <= ZONE; })) b.grill = '!';
        if (it.fries.st === 'oil' && Math.abs(it.fries.cook - FRY_C) <= FRY_Z) b.napoje = '!';
      });
      return b;
    }
  };

  function noItem(S) { return [{ id: 'goLada', label: '← Do lady', main: true, on: function () { S.go('lada'); } }]; }
  function nextBtn(S, pulse) {
    var w = BURGER.where(S.item);
    return { id: 'next' + w, label: (w === 'podaj' ? 'Podaj' : 'Idź: ' + S.stationName(w)) + ' →', main: true, pulse: !!pulse, on: function () { S.go(w); } };
  }
  function gauge(g, x, y, w, h, val, c, z, col, hot) {
    rr(g, x, y, w, h, h / 2); g.fillStyle = '#fff'; g.fill();
    g.save(); rr(g, x, y, w, h, h / 2); g.clip();
    for (var s = 0; s < 30; s++) { g.fillStyle = col(s / 30); g.fillRect(x + w * s / 30, y, w / 30 + 1, h); }
    g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(x + w * val, y, w * (1 - val), h);
    g.restore(); rr(g, x, y, w, h, h / 2); ink(g, 2.5);
    rr(g, x + w * (c - z), y - 5, w * z * 2, h + 10, 7); g.strokeStyle = hot ? GREEN : GOLD; g.lineWidth = 4.5; g.stroke();
    var nx = x + w * val; g.beginPath(); g.moveTo(nx, y - 3); g.lineTo(nx - 8, y - 15); g.lineTo(nx + 8, y - 15); g.closePath(); g.fillStyle = INK; g.fill();
    g.beginPath(); g.moveTo(nx, y - 4); g.lineTo(nx, y + h + 4); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
  }

  // ----- station: Grill -----
  BURGER.grill = {
    layout: function (S) {
      var W = S.W, H2 = S.H, L = S.L = {};
      var wide = W > H2 * 1.35;
      L.gw = wide ? Math.min(W * 0.5, (H2 - 96) / 0.62, 760) : Math.min(W * 0.92, (H2 - 150) / 0.9, 520);
      L.gh = L.gw * 0.62; L.pr = L.gw * 0.19; L.sr = L.pr * 0.8;
      L.cx = W / 2;
      if (wide) { L.gy = (H2 - L.gh - 60) / 2 + 8; L.tray = { x: L.cx - L.gw / 2 - L.sr - 26, y: L.gy + L.gh / 2 }; L.plate = { x: L.cx + L.gw / 2 + L.sr + 26, y: L.gy + L.gh / 2 }; }
      else { var tot = L.sr * 2 + 30 + L.gh + 60; L.gy = Math.max(L.sr * 2 + 34, (H2 - tot) / 2 + L.sr * 2 + 30); L.tray = { x: W * 0.27, y: L.gy - L.sr - 22 }; L.plate = { x: W * 0.73, y: L.gy - L.sr - 22 }; }
      var one = !S.item || S.item.patties.length < 2;   // a single patty lies in the middle
      L.slots = one ? [{ x: L.cx, y: L.gy + L.gh / 2 }] : [{ x: L.cx - L.gw * 0.24, y: L.gy + L.gh / 2 }, { x: L.cx + L.gw * 0.24, y: L.gy + L.gh / 2 }];
      L.wide = wide;
      L.sayY = wide ? 8 : Math.max(4, L.gy - L.sr * 2 - 70);
    },
    draw: function (g, S) {
      var L = S.L, W = S.W, H2 = S.H, it = S.item, o = S.ticket && S.ticket.order, T = S.T;
      H.kitchenBg(g, W, H2, S.u, H2 * 0.9);
      // the grill
      var x0 = L.cx - L.gw / 2;
      rr(g, x0 + 4, L.gy + 8, L.gw, L.gh, 22); g.fillStyle = 'rgba(29,47,111,.15)'; g.fill();
      rr(g, x0, L.gy, L.gw, L.gh, 22); g.fillStyle = '#5a6475'; g.fill(); ink(g, 4);
      rr(g, x0 + 12, L.gy + 12, L.gw - 24, L.gh - 24, 14); g.fillStyle = '#2f3542'; g.fill();
      g.save(); rr(g, x0 + 12, L.gy + 12, L.gw - 24, L.gh - 24, 14); g.clip();
      var hot = it && it.patties.some(function (p) { return p.st === 'grill'; });
      g.fillStyle = hot ? 'rgba(243,154,42,' + (REDUCED ? 0.22 : 0.18 + 0.08 * Math.sin(T * 5)) + ')' : 'rgba(243,154,42,.06)'; g.fillRect(x0, L.gy, L.gw, L.gh);
      g.strokeStyle = '#8f99ab'; g.lineWidth = 4; for (var y = L.gy + 26; y < L.gy + L.gh - 12; y += 20) { g.beginPath(); g.moveTo(x0 + 12, y); g.lineTo(x0 + L.gw - 12, y); g.stroke(); }
      g.restore();
      // tray with raw patties, plate for the done ones
      [[L.tray, '#e8eef8', 'surowe'], [L.plate, '#fff', 'gotowe']].forEach(function (p) {
        circle(g, p[0].x, p[0].y, L.sr * 1.18); g.fillStyle = p[1]; g.fill(); ink(g, 3);
        circle(g, p[0].x, p[0].y, L.sr * 0.98); g.strokeStyle = '#d4def0'; g.lineWidth = 2; g.stroke();
        if (L.wide) txt(g, p[2], p[0].x, p[0].y + L.sr * 1.18 + 13, 18, MUTED);
      });
      if (!it) { g.fillStyle = 'rgba(255,247,234,.55)'; g.fillRect(0, 0, W, H2); return; }
      var c = DONE[o.done].c, raws = 0, offs = 0;
      it.patties.forEach(function (p, i) {
        if (p.st === 'raw') { drawPattyTop(g, L.tray.x + (raws - 0.5 * (it.patties.length > 1 ? 1 : 0)) * L.sr * 0.5, L.tray.y - raws * 4, L.sr * 0.8, 0); raws++; }
        else if (p.st === 'off') { drawPattyTop(g, L.plate.x + (offs - 0.5 * (it.patties.length > 1 ? 1 : 0)) * L.sr * 0.5, L.plate.y - offs * 4, L.sr * 0.8, p.s[1]); offs++; }
        else {
          var sl = L.slots[i], k = REDUCED ? 1 : Math.abs(Math.cos(Math.PI * p.flipT)), lift = REDUCED ? 0 : Math.sin(Math.PI * p.flipT) * L.pr * 0.5;
          g.save(); g.translate(sl.x, sl.y - lift); g.scale(1, Math.max(0.08, k)); drawPattyTop(g, 0, 0, L.pr, p.flipT < 0.5 ? p.s[p.face] : p.s[1 - p.face]); g.restore();
          if (!REDUCED && Math.random() < 0.12) S.steam(sl.x + rnd(-L.pr, L.pr) * 0.6, sl.y - L.pr * 0.4);
        }
      });
      // a gauge under each slot
      var gy = L.gy + L.gh + 24, gh = Math.max(18, Math.min(26, H2 * 0.05));
      it.patties.forEach(function (p, i) {
        var sl = L.slots[i], gw = L.pr * 2.1, gx = sl.x - gw / 2, v = p.s[p.face], inZ = p.st === 'grill' && Math.abs(v - c) <= ZONE;
        g.globalAlpha = p.st === 'grill' ? 1 : 0.45;
        gauge(g, gx, gy, gw, gh, p.st === 'raw' ? 0 : v, c, ZONE, pattyCol, inZ);
        g.globalAlpha = 1;
        txt(g, p.st === 'off' ? 'gotowy' : p.st === 'raw' ? 'połóż kotlet' : inZ ? (p.face ? 'Zdejmij!' : 'Przewróć!') : 'strona ' + (p.face + 1) + ' z 2', sl.x, gy + gh + 17, 20, inZ ? GREEN : MUTED);
      });
    },
    act: function (S, i) {
      var it = S.item, p = it.patties[i], c = DONE[S.ticket.order.done].c;
      if (!p) return;
      if (p.st === 'raw') { p.st = 'grill'; p.face = 0; p.flipT = 1; S.sfx('place'); S.say('Ssss…'); return; }
      if (p.st !== 'grill') return;
      var d = p.s[p.face] - c, good = Math.abs(d) <= ZONE;
      if (p.face === 0) { p.face = 1; p.flipT = 0; S.sfx('whoosh'); S.say(good ? 'Idealnie! Teraz druga strona.' : d < 0 ? 'Trochę za wcześnie. Druga strona!' : 'Mocno przypieczony. Druga strona!'); }
      else { p.st = 'off'; S.sfx('pop'); S.say(good ? 'Idealny kotlet!' : d < 0 ? 'Trochę blady, ale zjadliwy!' : 'Mocno przypieczony!'); }
      if (good) { S.sfx('star'); S.sparkle(S.L.slots[i].x, S.L.slots[i].y); }
    },
    down: function (S, x, y) {
      var it = S.item, L = S.L; if (!it) return;
      for (var i = 0; i < it.patties.length; i++) if (Math.hypot(x - L.slots[i].x, y - L.slots[i].y) < L.pr * 1.15) { this.act(S, i); return; }
      if (Math.hypot(x - L.tray.x, y - L.tray.y) < L.sr * 1.4) { var r = this.firstRaw(it); if (r >= 0) this.act(S, r); }
    },
    firstRaw: function (it) { for (var i = 0; i < it.patties.length; i++) if (it.patties[i].st === 'raw') return i; return -1; },
    // the patty that needs attention first
    due: function (S) {
      var it = S.item, c = DONE[S.ticket.order.done].c, best = -1, bv = -9;
      it.patties.forEach(function (p, i) { if (p.st === 'grill' && p.s[p.face] - c > bv) { bv = p.s[p.face] - c; best = i; } });
      return best;
    },
    hint: function (S) {
      var it = S.item; if (!it) return 'Najpierw przyjmij zamówienie przy ladzie.';
      if (grillDone(it)) return 'Kotlety gotowe! Teraz składanie.';
      if (this.firstRaw(it) >= 0) return 'Połóż kotlet na grillu: dotknij go.';
      return 'Dotknij kotleta, gdy wskazówka będzie w ramce: przewróć, potem zdejmij. W tym czasie możesz nalać napój.';
    },
    buttons: function (S) {
      var it = S.item, me = this; if (!it) return noItem(S);
      if (grillDone(it)) return [nextBtn(S, true)];
      var r = this.firstRaw(it), b = [];
      if (r >= 0) b.push({ id: 'put', label: 'Połóż kotlet', main: this.due(S) < 0, pulse: this.due(S) < 0, on: function () { me.act(S, r); } });
      var dq = this.due(S);
      if (dq >= 0) { var p = it.patties[dq], inZ = Math.abs(p.s[p.face] - DONE[S.ticket.order.done].c) <= ZONE; b.push({ id: 'act' + p.face, label: p.face ? 'Zdejmij!' : 'Przewróć!', main: true, pulse: inZ, on: function () { me.act(S, dq); } }); }
      return b;
    }
  };

  // ----- station: Składanie -----
  function binList(S) { return [{ k: 'kotlet' }].concat(layersFor(S.shifts).map(function (i) { return { k: i.k }; })); }
  BURGER.skladanie = {
    layout: function (S) {
      var W = S.W, H2 = S.H, L = S.L = {}, bins = binList(S), n = bins.length;
      if (W > H2 * 1.2) {
        var cols = n > 8 ? 3 : 2, rows = Math.ceil(n / cols), b = Math.max(54, Math.min(116, (H2 - 20) / rows - 12, W * 0.3 / cols - 12)), gap = b + 12;
        var gx = W - 20 - (cols * gap - 12) / 2;
        bins.forEach(function (bn, i) { var r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, n - r * cols); bn.x = gx + (c - (inRow - 1) / 2) * gap; bn.y = H2 / 2 + (r - (rows - 1) / 2) * gap; bn.s = b; });
        var left = W - 20 - cols * gap - 10;
        L.pat = { x: 14, y: 14, w: Math.min(left * 0.34, 300), h: H2 - 28 };
        L.cx = L.pat.x + L.pat.w + (left - L.pat.x - L.pat.w) / 2; L.by = H2 * 0.88;
        L.bw = Math.min((H2 * 0.88 - 20) / 1.75, (left - L.pat.w) * 0.42);
      } else {
        var cols2 = Math.min(n, W > 560 ? n : 5), rows2 = Math.ceil(n / cols2), b2 = Math.max(50, Math.min(96, W / cols2 - 8)), binsH = rows2 * (b2 + 8) + 4;
        bins.forEach(function (bn, i) { var r = Math.floor(i / cols2), c = i % cols2, inRow = Math.min(cols2, n - r * cols2); bn.x = W / 2 + (c - (inRow - 1) / 2) * (b2 + 6); bn.y = H2 - binsH + r * (b2 + 8) + b2 / 2 + 2; bn.s = b2; });
        var ah = H2 - binsH - 10;
        L.pat = { x: 8, y: 8, w: W * 0.33, h: ah - 8 };
        L.cx = L.pat.x + L.pat.w + (W - L.pat.x - L.pat.w) / 2; L.by = ah - 12;
        L.bw = Math.min((ah - 30) / 1.75, (W - L.pat.w) * 0.5);
      }
      L.bins = bins; L.sayY = 6;
    },
    stackTop: function (S) { var L = S.L, y = L.by - BUN_B * L.bw; S.item.stack.forEach(function (l) { y -= TH[l.k] * L.bw; }); return y; },
    draw: function (g, S) {
      var L = S.L, W = S.W, H2 = S.H, it = S.item, o = S.ticket && S.ticket.order, T = S.T, i;
      g.fillStyle = '#f4efe6'; g.fillRect(0, 0, W, H2);
      g.strokeStyle = 'rgba(160,150,170,.25)'; g.lineWidth = 2;
      for (i = 0; i < 9; i++) { g.beginPath(); var y0 = (i * 97) % H2; g.moveTo(0, y0); g.bezierCurveTo(W * 0.3, y0 + 40, W * 0.6, y0 - 50, W, y0 + 20); g.stroke(); }
      // the pattern card
      var P = L.pat;
      rr(g, P.x + 3, P.y + 5, P.w, P.h, 14); g.fillStyle = 'rgba(29,47,111,.14)'; g.fill();
      rr(g, P.x, P.y, P.w, P.h, 14); g.fillStyle = '#fffdf5'; g.fill(); ink(g, 3);
      txt(g, 'Wzór', P.x + P.w / 2, P.y + 17, 22, MUTED);
      if (o) {
        var gap = 0.05, units = stackUnits(o.layers, gap), pw = Math.min(P.w * 0.62, (P.h - 50) / units);
        var next = -1; if (it && !it.stackDone) { next = it.stack.length; for (i = 0; i < it.stack.length; i++) if (it.stack[i].k !== o.layers[i]) next = -1; if (next >= o.layers.length) next = -1; }
        drawStack(g, P.x + P.w * 0.56, P.y + 28 + (P.h - 28 + units * pw) / 2, pw, o.layers.map(function (k) { return { k: k, cook: DONE[o.done].c }; }), { gap: gap, top: true, mark: next });
      }
      // the board with the burger
      var bw = L.bw;
      rr(g, L.cx - bw * 0.85, L.by - bw * 0.02, bw * 1.7, bw * 0.13, bw * 0.05); g.fillStyle = '#c99257'; g.fill(); ink(g, 3);
      if (it) {
        var cooks = it.patties.filter(function (p) { return p.st === 'off'; }).map(pattyCook), ci = 0;
        var top = drawStack(g, L.cx, L.by, bw, it.stack.map(function (l) { return { k: l.k, dx: l.dx, t0: l.t0, cook: l.k === 'kotlet' ? cooks[ci++] : null }; }), { top: it.stackDone, topT0: it.topT0, now: T });
        if (!it.stackDone && S.btool && !S.drag) {   // where the next layer will land
          g.setLineDash([8, 7]); g.strokeStyle = 'rgba(29,47,111,.35)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(L.cx, top - 8); g.lineTo(L.cx, Math.max(20, top - bw * 0.7)); g.stroke(); g.setLineDash([]);
        }
      } else bunBottom(g, L.cx, L.by, bw);
      // bins
      var free = it ? freePatties(it) : 0;
      L.bins.forEach(function (bn) {
        var s = bn.s, sel = S.btool === bn.k, x = bn.x, y = bn.y - (sel && !REDUCED ? 3 : 0);
        rr(g, x - s / 2, y - s / 2 + 4, s, s, s * 0.22); g.fillStyle = 'rgba(29,47,111,.18)'; g.fill();
        rr(g, x - s / 2, y - s / 2, s, s, s * 0.22); g.fillStyle = sel ? '#fff4d6' : '#fff'; g.fill(); ink(g, sel ? 4 : 2.5);
        if (sel) { rr(g, x - s / 2 + 4, y - s / 2 + 4, s - 8, s - 8, s * 0.18); g.strokeStyle = GOLD; g.lineWidth = 3; g.stroke(); }
        // the layers are thin from the side, so the bin shows them twice as tall
        var lw = s * 0.7, ky = bn.k === 'kotlet' ? 1.3 : 2;
        g.save(); g.translate(x, y - s * 0.08); g.scale(1, ky);
        drawLayer(g, bn.k, 0, TH[bn.k] * lw / 2, lw, bn.k === 'kotlet' && it && it.patties.length ? Math.max.apply(null, it.patties.map(pattyCook)) : null);
        g.restore();
        txt(g, NAME[bn.k], x, y + s * 0.34, Math.max(13, s * 0.2), MUTED);
        if (bn.k === 'kotlet' && it) {
          var bw2 = s * 0.42, bh = s * 0.3, bx = x + s / 2 - bw2 + s * 0.08, by = y - s / 2 - bh * 0.45;
          rr(g, bx, by, bw2, bh, bh / 2); g.fillStyle = free > 0 ? '#c8f0c0' : '#fff'; g.fill(); ink(g, 2);
          txt(g, String(Math.max(0, free)), bx + bw2 / 2, by + bh / 2 + 1, bh * 0.82, free > 0 ? GREEN : INK);
          if (free <= 0) { rr(g, x - s / 2, y - s / 2, s, s, s * 0.22); g.fillStyle = 'rgba(255,255,255,.5)'; g.fill(); }
        }
      });
      // a layer in the hand
      if (S.drag && S.drag.k && S.drag.moved) drawLayer(g, S.drag.k, S.drag.x, S.drag.y - 14 * S.u, bw * 0.9);
      if (!it) { g.fillStyle = 'rgba(244,239,230,.55)'; g.fillRect(0, 0, W, H2); }
    },
    hitBin: function (S, x, y) { var r = null; S.L.bins.forEach(function (bn) { if (Math.abs(x - bn.x) < bn.s / 2 + 4 && Math.abs(y - bn.y) < bn.s / 2 + 4) r = bn; }); return r; },
    overBoard: function (S, x, y) { var L = S.L; return Math.abs(x - L.cx) < L.bw * 0.95 && y < L.by + L.bw * 0.15 && y > L.by - L.bw * 1.9; },
    drop: function (S, k, x) {
      var it = S.item, L = S.L, dx = (x - L.cx) / L.bw;
      if (k === 'kotlet' && freePatties(it) <= 0) { S.sfx('tap'); S.say(grillDone(it) ? 'Nie ma już kotletów.' : 'Kotlet jeszcze się smaży!'); return; }
      if (it.stack.length >= MAX_STACK) { S.say('Burger jest już bardzo wysoki!'); return; }
      if (Math.abs(dx) > 0.62) { S.sfx('error'); S.say('Ups, obok! Spróbuj jeszcze raz.'); return; }
      dx = clamp(dx, -0.36, 0.36);
      it.stack.push({ k: k, dx: dx, t0: S.T });
      S.sfx(Math.abs(dx) < 0.06 ? 'star' : 'place'); S.pop(L.cx + dx * L.bw, this.stackTop(S));
      var o = S.ticket.order;
      if (it.stack.length === o.layers.length && stackMatch(o, it) === 1) S.say('Wszystko jest! Bułka na górę!');
      else if (Math.abs(dx) < 0.06) S.say('Prosto!');
    },
    down: function (S, x, y) {
      var it = S.item; if (!it || it.stackDone) return;
      var bn = this.hitBin(S, x, y);
      if (bn) { if (S.btool !== bn.k) { S.btool = bn.k; S.sfx('tap'); } S.drag = { bin: true, k: bn.k, x: x, y: y, x0: x, y0: y, moved: false }; return; }
      if (this.overBoard(S, x, y)) S.drag = { board: true, x: x, y: y, x0: x, y0: y, moved: false };
    },
    move: function (S, x, y) { var d = S.drag; if (!d) return; d.x = x; d.y = y; if (!d.moved && Math.hypot(x - d.x0, y - d.y0) > 10) d.moved = true; },
    up: function (S, x, y) {
      var d = S.drag; S.drag = null; if (!d) return;
      if (d.bin) { if (d.moved && this.overBoard(S, x, y)) this.drop(S, d.k, x); return; }
      if (d.board && !d.moved) { if (S.btool) this.drop(S, S.btool, x); else S.say('Najpierw wybierz składnik.'); }
    },
    hint: function (S) {
      var it = S.item; if (!it) return 'Najpierw przyjmij zamówienie przy ladzie.';
      if (it.stackDone) return 'Burger złożony!';
      if (!S.btool) return 'Układaj od dołu jak na wzorze: wybierz składnik i dotknij nad bułką.';
      return it.stack.length >= S.ticket.order.layers.length ? 'Na koniec bułka na górę.' : 'Dotknij nad bułką, tam gdzie ma spaść. Celuj w środek!';
    },
    buttons: function (S) {
      var it = S.item; if (!it) return noItem(S);
      if (it.stackDone) return [{ id: 'fix', label: '↺ Popraw', on: function () { it.stackDone = false; S.sfx('pop'); } }, nextBtn(S, true)];
      var o = S.ticket.order;
      return [
        { id: 'undo', label: '↺ Zdejmij', disabled: !it.stack.length, on: function () { it.stack.pop(); S.sfx('pop'); } },
        { id: 'bun', label: 'Bułka na górę', main: true, disabled: !it.stack.length, pulse: it.stack.length >= o.layers.length, on: function () { it.stackDone = true; it.topT0 = S.T; S.sfx('place'); S.sparkle(S.L.cx, S.L.by - S.L.bw); } }
      ];
    }
  };

  // ----- station: Napoje (and the fryer) -----
  BURGER.napoje = {
    layout: function (S) {
      var W = S.W, H2 = S.H, L = S.L = {};
      L.dw = Math.min(W * 0.56, 520); L.dx = Math.max(8, W * 0.3 - L.dw / 2 + (W > 900 ? W * 0.08 : 0)); if (W < 520) L.dx = 6;
      L.dw = Math.min(L.dw, W * 0.58);
      L.dh = Math.min(H2 * 0.34, L.dw * 0.42); L.dy = Math.max(10, H2 * 0.07);
      L.taps = [0, 1, 2].map(function (i) { return L.dx + L.dw * (i + 0.5) / 3; });
      L.cw = Math.min(L.dw / 3 * 0.74, (H2 * 0.9 - L.dy - L.dh - 34) / 1.35);
      L.cupY = H2 * 0.9;
      // fryer
      L.fw = Math.min(W - L.dx - L.dw - 20, 300, H2 * 0.62); L.fx = L.dx + L.dw + (W - L.dx - L.dw) / 2; L.fh = L.fw * 0.78; L.fy = H2 * 0.9 - L.fh;
      L.sayY = 6;
      if (S.bcup == null) S.bcup = 1;
    },
    enter: function (S) { var it = S.item; if (it && it.drink.k) S.bcup = DRINKS.indexOf(DRINKB[it.drink.k]); else if (it) S.bcup = DRINKS.indexOf(DRINKB[S.ticket.order.drink]) === 1 ? 0 : 1; },
    draw: function (g, S) {
      var L = S.L, W = S.W, H2 = S.H, it = S.item, o = S.ticket && S.ticket.order, T = S.T;
      H.kitchenBg(g, W, H2, S.u, H2 * 0.9);
      // dispenser
      rr(g, L.dx, L.dy, L.dw, L.dh, 16); g.fillStyle = '#7d8fb0'; g.fill(); ink(g, 4);
      rr(g, L.dx + 8, L.dy + 8, L.dw - 16, L.dh * 0.3, 8); g.fillStyle = '#9fb0cf'; g.fill();
      var pouring = S.drag && S.drag.pour ? S.bcup : -1;
      L.taps.forEach(function (tx, i) {
        var r = Math.min(L.dw / 3 * 0.3, L.dh * 0.3), cy = L.dy + L.dh * 0.58;
        circle(g, tx, cy, r); g.fillStyle = DRINKS[i].c; g.fill(); ink(g, 3);
        circle(g, tx - r * 0.3, cy - r * 0.3, r * 0.22); g.fillStyle = 'rgba(255,255,255,.6)'; g.fill();
        rr(g, tx - r * 0.28, L.dy + L.dh - 3, r * 0.56, r * 0.55, 3); g.fillStyle = '#4a5568'; g.fill(); ink(g, 2.5);
        if (pouring === i && it && it.drink.fill < 1) { g.fillStyle = DRINKS[i].c; g.fillRect(tx - r * 0.13, L.dy + L.dh + r * 0.5, r * 0.26, L.cupY - (L.dy + L.dh + r * 0.5) - 4); }
      });
      // the cup under a tap
      var d = it ? it.drink : null, cx = L.taps[S.bcup == null ? 1 : S.bcup];
      rr(g, L.dx, L.cupY - 2, L.dw, 10, 4); g.fillStyle = '#c9d6ea'; g.fill(); ink(g, 2.5);
      drawCup(g, cx, L.cupY - 3, L.cw, d && d.k ? DRINKB[d.k].c : null, d ? d.fill : 0, o ? LINES[o.size] : null);
      // fryer
      var fx = L.fx - L.fw / 2, fy = L.fy, fw = L.fw, fh = L.fh, fr = it ? it.fries : { st: 'raw', cook: 0 }, want = !!(o && o.fries);
      rr(g, fx, fy, fw, fh, 14); g.fillStyle = '#9aa6c0'; g.fill(); ink(g, 4);
      rr(g, fx + fw * 0.1, fy + fh * 0.16, fw * 0.8, fh * 0.6, 8); g.fillStyle = '#f7c948'; g.fill(); ink(g, 3);
      var inOil = fr.st === 'oil', by = inOil ? fy + fh * 0.24 : fy - fh * 0.34, bx = L.fx - fw * 0.3, bw = fw * 0.6, bh = fh * 0.44;
      if (want || fr.cook > 0) {
        var col = friesCol(fr.cook);
        g.save(); rr(g, bx, by, bw, bh, 6); g.clip();
        for (var i = 0; i < 9; i++) { g.save(); g.translate(bx + bw * (0.1 + i * 0.1), by + bh * 0.5); g.rotate((i % 3 - 1) * 0.35); rr(g, -bw * 0.04, -bh * 0.42, bw * 0.08, bh * 0.84, 2); g.fillStyle = col; g.fill(); ink(g, 1.5); g.restore(); }
        g.restore();
        g.strokeStyle = INK; g.lineWidth = 2; for (var q = 1; q < 6; q++) { g.beginPath(); g.moveTo(bx + bw * q / 6, by); g.lineTo(bx + bw * q / 6, by + bh); g.stroke(); }
        rr(g, bx, by, bw, bh, 6); ink(g, 3);
        g.beginPath(); g.moveTo(bx + bw, by + 6); g.lineTo(bx + bw + fw * 0.2, by - 4); g.strokeStyle = INK; g.lineWidth = 7; g.lineCap = 'round'; g.stroke(); g.strokeStyle = '#e2533f'; g.lineWidth = 3.5; g.stroke();
        if (inOil) { g.fillStyle = 'rgba(247,201,72,.55)'; g.fillRect(fx + fw * 0.1 + 2, fy + fh * 0.3, fw * 0.8 - 4, fh * 0.46 - 2); if (!REDUCED) for (var b = 0; b < 5; b++) { circle(g, fx + fw * (0.2 + 0.15 * b) + Math.sin(T * 3 + b) * 4, fy + fh * (0.36 + 0.06 * Math.sin(T * 6 + b * 2)), 3 + (b % 2) * 2); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill(); } }
        var gw = Math.min(fw * 1.05, W - L.dx - L.dw - 16), gy = Math.max(26, Math.min(fy - fh * 0.34 - 62, fy - 80)), inZ = inOil && Math.abs(fr.cook - FRY_C) <= FRY_Z;
        if (gy < 26) gy = 26;
        gauge(g, L.fx - gw / 2, gy, gw, 20, fr.cook, FRY_C, FRY_Z, friesCol, inZ);
        txt(g, inZ ? 'Wyjmij!' : fr.st === 'raw' ? 'frytki' : fr.st === 'oil' ? 'smażą się…' : 'gotowe', L.fx, fy + fh + 15, 20, inZ ? GREEN : MUTED);
      } else {
        rr(g, fx + fw * 0.06, fy + fh * 0.1, fw * 0.88, fh * 0.7, 8); g.fillStyle = '#b8c2d6'; g.fill(); ink(g, 3);
        txt(g, 'bez frytek', L.fx, fy + fh * 0.45, Math.min(24, fw * 0.14), MUTED);
      }
      if (!it) { g.fillStyle = 'rgba(255,247,234,.55)'; g.fillRect(0, 0, W, H2); }
    },
    fry: function (S) {
      var it = S.item, f = it.fries;
      if (f.st === 'oil') { f.st = 'out'; S.sfx('whoosh'); var inZ = Math.abs(f.cook - FRY_C) <= FRY_Z; S.say(inZ ? 'Złote frytki!' : f.cook < FRY_C ? 'Trochę blade. Możesz dosmażyć.' : 'Mocno przysmażone!'); if (inZ) { S.sfx('star'); S.sparkle(S.L.fx, S.L.fy); } }
      else if (f.cook < 1) { f.st = 'oil'; S.sfx('splash'); }
    },
    down: function (S, x, y) {
      var it = S.item, L = S.L; if (!it || it.sideDone) return;
      if (x > L.dx && x < L.dx + L.dw && y < L.cupY + 16) {
        var i = clamp(Math.floor((x - L.dx) / (L.dw / 3)), 0, 2), d = it.drink;
        if (d.k && d.k !== DRINKS[i].k && d.fill > 0.02) { S.sfx('tap'); S.say('W kubku jest inny napój. Najpierw wylej.'); return; }
        S.bcup = i; d.k = DRINKS[i].k; S.drag = { pour: true };
        return;
      }
      if (Math.abs(x - L.fx) < L.fw * 0.7 && y > L.fy - L.fh * 0.5 && S.ticket.order.fries) this.fry(S);
    },
    up: function (S) {
      var it = S.item, d = S.drag; S.drag = null; if (!d || !d.pour || !it) return;
      var o = S.ticket.order, e = Math.abs(it.drink.fill - LINES[o.size]);
      if (it.drink.k === o.drink && e <= 0.06) { S.sfx('star'); S.say('Równo do kreski!'); S.sparkle(S.L.taps[S.bcup], S.L.cupY - S.L.cw); }
    },
    hint: function (S) {
      var it = S.item; if (!it) return 'Najpierw przyjmij zamówienie przy ladzie.';
      if (it.sideDone) return 'Napój gotowy!';
      var o = S.ticket.order;
      if (it.drink.fill < 0.05) return 'Przytrzymaj kran w kolorze z karteczki. Puść przy kresce!';
      if (o.fries && it.fries.st === 'raw') return 'Wrzuć frytki do oleju: dotknij frytkownicy.';
      if (o.fries && it.fries.st === 'oil') return 'Wyjmij frytki, gdy wskazówka będzie w ramce.';
      return 'Gotowe? Połóż wszystko na tacę.';
    },
    buttons: function (S) {
      var it = S.item, me = this; if (!it) return noItem(S);
      if (it.sideDone) return [{ id: 'fix', label: '↺ Popraw', on: function () { it.sideDone = false; S.sfx('pop'); } }, nextBtn(S, true)];
      var o = S.ticket.order, f = it.fries, b = [];
      if (it.drink.fill > 0.02) b.push({ id: 'spill', label: '↺ Wylej', on: function () { it.drink.fill = 0; it.drink.k = null; S.sfx('splash'); } });
      if (o.fries) b.push({ id: 'fry' + f.st, label: f.st === 'oil' ? 'Wyjmij frytki' : f.st === 'out' ? 'Dosmaż' : 'Wrzuć frytki', disabled: f.st !== 'oil' && f.cook >= 1, pulse: f.st === 'oil' && Math.abs(f.cook - FRY_C) <= FRY_Z, on: function () { me.fry(S); } });
      var ok = it.drink.fill > 0.05 && (!o.fries || f.st === 'out');
      b.push({ id: 'tray', label: 'Na tacę →', main: true, pulse: ok, disabled: f.st === 'oil', on: function () { it.sideDone = true; S.sfx('place'); S.go(BURGER.where(it)); } });
      return b;
    }
  };

  NG.restauracje.add(BURGER);
})();
