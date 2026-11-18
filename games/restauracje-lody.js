/*
 * Restauracje: Lodziarnia Sopelek. A module for games/restauracje.js (the contract is described there).
 * Nothing is baked here; it is all about a steady hand.
 *   Gałki: rub the scoop in a tub until the ball fills the ring, let go; flavours go from the bottom up as on the ticket.
 *   Polewa: hold a bottle and let go when the needle is in the frame (skipped when the order has no sauce).
 *   Dekoracje: paint sprinkles with a finger, put cherries, wafers and blueberries on by count.
 * Time shows as melting: slow ice cream starts to drip, which only costs "Czas" stars.
 * Coordinates of an ice cream: origin = the middle of the rim of the cone or cup, unit = the scoop radius r.
 */
(function () {
  'use strict';
  if (!window.NG || !NG.restauracje) return;
  var H = NG.restauracje.H, INK = H.INK, MUTED = H.MUTED, GOLD = H.GOLD, GREEN = H.GREEN, REDUCED = H.REDUCED;
  var clamp = H.clamp, rnd = H.rnd, rint = H.rint, pick = H.pick, shuffle = H.shuffle, mix = H.mix;
  var rr = H.rr, ink = H.ink, circle = H.circle, txt = H.txt;

  var SCOOP_OK = 0.16, MAX_SCOOPS = 4, POUR_S = 1.7, SAUCE_C = 0.5, SAUCE_Z = 0.14, SPR_N = 22, SPR_MAX = 60;
  var FLAV = [
    { k: 'wan', n: 'wanilia', c: '#fff1c2', at: 0 }, { k: 'cze', n: 'czekolada', c: '#8f5e3c', at: 0 }, { k: 'tru', n: 'truskawka', c: '#f78fa8', at: 0 },
    { k: 'mie', n: 'mięta', c: '#9be3c3', at: 1 }, { k: 'cyt', n: 'cytryna', c: '#fbe45a', at: 2 }, { k: 'jag', n: 'jagoda', c: '#9a86e6', at: 4 },
    { k: 'kar', n: 'karmel', c: '#e6a85c', at: 6 }, { k: 'pis', n: 'pistacja', c: '#bcd67c', at: 8 }
  ];
  var SAUCE = [{ k: 'scz', n: 'polewa czekoladowa', s: 'czekolada', c: '#5a3620', at: 0 }, { k: 'str', n: 'polewa truskawkowa', s: 'truskawka', c: '#e0457b', at: 3 }, { k: 'ska', n: 'polewa karmelowa', s: 'karmel', c: '#d98a2b', at: 5 }];
  var EXTRA = [{ k: 'wis', n: 'wisienka', at: 0 }, { k: 'pos', n: 'posypka', at: 1 }, { k: 'waf', n: 'wafelek', at: 2 }, { k: 'bor', n: 'borówki', at: 3 }];
  var ALL = FLAV.concat(SAUCE).concat(EXTRA), BY = {}; ALL.forEach(function (x) { BY[x.k] = x; });
  var SPR_COL = ['#e2533f', '#3f86d8', '#f2b51d', '#3fae5f', '#b565c9', '#fff'];
  var VH = { rozek: 2.5, kubek: 1.35 };
  function open(list, shifts) { return list.filter(function (x) { return shifts >= x.at; }); }

  // =====================================================================
  // Drawing
  // =====================================================================
  // scoop circles, bottom first: [{ x, y, r }] in px for radius r
  function iceGeo(scoops, r) {
    var out = [];
    scoops.forEach(function (s, i) {
      var ri = r * clamp(s.size == null ? 1 : s.size, 0.5, 1.4);
      out.push({ x: i ? (i % 2 ? 0.1 : -0.1) * r : 0, y: i ? out[i - 1].y - out[i - 1].r * 0.62 - ri * 0.62 : -ri * 0.5, r: ri });
    });
    return out;
  }
  function drawVessel(g, v, r) {
    var lw = Math.max(1.2, r * 0.07);
    if (v === 'kubek') {
      g.beginPath(); g.moveTo(-r * 1.1, 0); g.lineTo(r * 1.1, 0); g.lineTo(r * 0.82, r * 1.35); g.lineTo(-r * 0.82, r * 1.35); g.closePath();
      g.fillStyle = '#bfe3ff'; g.fill(); g.save(); g.clip();
      g.fillStyle = '#fff'; for (var i = -3; i <= 3; i += 2) g.fillRect(i * r * 0.3 - r * 0.15, 0, r * 0.3, r * 1.4);
      g.restore();
      g.beginPath(); g.moveTo(-r * 1.1, 0); g.lineTo(r * 1.1, 0); g.lineTo(r * 0.82, r * 1.35); g.lineTo(-r * 0.82, r * 1.35); g.closePath(); ink(g, lw);
      rr(g, -r * 1.2, -r * 0.12, r * 2.4, r * 0.26, r * 0.1); g.fillStyle = '#7fc3f5'; g.fill(); ink(g, lw);
    } else {
      g.beginPath(); g.moveTo(-r * 0.9, 0); g.lineTo(r * 0.9, 0); g.lineTo(0, r * 2.5); g.closePath();
      g.fillStyle = '#e9b872'; g.fill(); g.save(); g.clip();
      g.strokeStyle = '#c98f45'; g.lineWidth = Math.max(1, r * 0.05);
      for (var k = -6; k <= 6; k++) { g.beginPath(); g.moveTo(k * r * 0.34, 0); g.lineTo(k * r * 0.34 + r * 1.4, r * 2.6); g.moveTo(k * r * 0.34, 0); g.lineTo(k * r * 0.34 - r * 1.4, r * 2.6); g.stroke(); }
      g.restore();
      g.beginPath(); g.moveTo(-r * 0.9, 0); g.lineTo(r * 0.9, 0); g.lineTo(0, r * 2.5); g.closePath(); ink(g, lw);
      rr(g, -r * 1.0, -r * 0.14, r * 2.0, r * 0.3, r * 0.12); g.fillStyle = '#f2c98a'; g.fill(); ink(g, lw);
    }
  }
  function drawScoop(g, x, y, r, col) {
    var lw = Math.max(1.2, r * 0.07);
    [0.12, 0.31, 0.5, 0.69, 0.88].forEach(function (a) { circle(g, x + Math.cos(a * Math.PI) * r * 0.88, y + Math.sin(a * Math.PI) * r * 0.74, r * 0.27); g.fillStyle = col; g.fill(); ink(g, lw); });
    circle(g, x, y, r); g.fillStyle = col; g.fill(); ink(g, lw);
    g.beginPath(); g.arc(x, y, r * 0.68, Math.PI * 1.12, Math.PI * 1.45); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = lw * 1.3; g.lineCap = 'round'; g.stroke();
  }
  function drawSauce(g, c, col, amt) {
    if (!(amt > 0.01)) return;
    var depth = c.r * (0.3 + 1.0 * clamp(amt, 0, 1)), n = 6, i, lw = Math.max(1, c.r * 0.06);
    g.save(); circle(g, c.x, c.y, c.r - lw * 0.6); g.clip();
    g.beginPath(); g.moveTo(c.x - c.r, c.y - c.r - 2); g.lineTo(c.x + c.r, c.y - c.r - 2); g.lineTo(c.x + c.r, c.y - c.r + depth * 0.7);
    for (i = 0; i < n; i++) { var x1 = c.x + c.r - (i + 1) * 2 * c.r / n, xm = c.x + c.r - (i + 0.5) * 2 * c.r / n; g.quadraticCurveTo(xm, c.y - c.r + depth * (i % 2 ? 0.75 : 1.3), x1, c.y - c.r + depth * 0.7); }
    g.closePath(); g.fillStyle = col; g.fill(); ink(g, lw);
    g.restore();
  }
  // one extra at (0,0); s = its size
  function drawExtra(g, k, s) {
    var lw = Math.max(1, s * 0.16), i;
    if (k === 'wis') {
      g.beginPath(); g.moveTo(0, -s * 0.8); g.quadraticCurveTo(s * 0.3, -s * 2, s * 1.1, -s * 2.1); g.strokeStyle = '#2a8a56'; g.lineWidth = lw * 1.2; g.lineCap = 'round'; g.stroke();
      circle(g, 0, 0, s); g.fillStyle = '#d8433b'; g.fill(); ink(g, lw);
      circle(g, -s * 0.35, -s * 0.35, s * 0.22); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
    } else if (k === 'waf') {
      rr(g, -s * 0.45, -s * 2.6, s * 0.9, s * 3.4, s * 0.2); g.fillStyle = '#e9b872'; g.fill(); ink(g, lw);
      g.strokeStyle = '#c98f45'; g.lineWidth = lw * 0.8; for (i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-s * 0.45, -s * 2.1 + i * s * 0.7); g.lineTo(s * 0.45, -s * 2.1 + i * s * 0.7); g.stroke(); }
    } else if (k === 'bor') {
      circle(g, 0, 0, s); g.fillStyle = '#4b5fc4'; g.fill(); ink(g, lw);
      circle(g, 0, -s * 0.15, s * 0.32); g.fillStyle = '#2f3f95'; g.fill();
    } else if (k === 'pos') {
      [[-0.7, -0.3, 0.4, 0], [0.5, -0.6, -0.5, 1], [0.1, 0.5, 1.1, 2], [-0.5, 0.7, -0.2, 3], [0.8, 0.4, 0.8, 4]].forEach(function (p) { sprinkle(g, p[0] * s, p[1] * s, s * 0.9, p[3], p[2]); });
    }
  }
  function sprinkle(g, x, y, r, c, a) {
    g.save(); g.translate(x, y); g.rotate(a); rr(g, -r * 0.5, -r * 0.17, r, r * 0.34, r * 0.17); g.fillStyle = SPR_COL[c % SPR_COL.length]; g.fill(); g.strokeStyle = INK; g.lineWidth = Math.max(0.6, r * 0.12); g.stroke(); g.restore();
  }
  var EX_S = { wis: 0.3, waf: 0.26, bor: 0.2 };
  /*
   * spec: { vessel, scoops: [{ k, size, t0 }], sauce: { k, amt }, sprinkles: [{ x, y, c, a }], extras: [{ k, x, y, rot }] }
   * opt: now (for the drop animation), melt 0..1, mark (index of the scoop to point at)
   */
  function drawIce(g, x, y, r, spec, opt) {
    opt = opt || {};
    var G = iceGeo(spec.scoops, r), top = G[G.length - 1];
    g.save(); g.translate(x, y);
    drawVessel(g, spec.vessel, r);
    if (opt.melt > 0 && G.length) {   // drips on the cone
      g.fillStyle = BY[spec.scoops[0].k].c;
      [[-0.5, 1], [0.35, 0.7], [0.62, 0.4]].forEach(function (d) { var len = r * 0.9 * opt.melt * d[1]; if (len < 2) return; rr(g, d[0] * r - r * 0.1, r * 0.05, r * 0.2, len, r * 0.1); g.fill(); ink(g, Math.max(1, r * 0.05)); });
    }
    G.forEach(function (c, i) {
      var s = spec.scoops[i], dy = 0;
      if (s.t0 != null && opt.now != null && !REDUCED) { var a = (opt.now - s.t0) / 0.25; if (a < 1) dy = -(1 - a * a) * r * 2.2; }
      drawScoop(g, c.x, c.y + dy, c.r, BY[s.k].c);
      if (opt.mark === i) { g.beginPath(); g.moveTo(c.x - c.r * 1.25, c.y); g.lineTo(c.x - c.r * 1.7, c.y - c.r * 0.32); g.lineTo(c.x - c.r * 1.7, c.y + c.r * 0.32); g.closePath(); g.fillStyle = GOLD; g.fill(); ink(g, Math.max(1, r * 0.06)); }
    });
    if (top && spec.sauce && spec.sauce.k) drawSauce(g, top, BY[spec.sauce.k].c, spec.sauce.amt);
    spec.sprinkles.forEach(function (p) { sprinkle(g, p.x * r, p.y * r, r * 0.2, p.c, p.a); });
    spec.extras.forEach(function (e) { g.save(); g.translate(e.x * r, e.y * r); if (e.rot) g.rotate(e.rot); drawExtra(g, e.k, EX_S[e.k] * r); g.restore(); });
    g.restore();
    return G;
  }
  // the ordered ice cream as a tidy picture
  function specOf(o) {
    var sp = { vessel: o.vessel, scoops: o.scoops.map(function (k) { return { k: k, size: 1 }; }), sauce: { k: o.sauce, amt: o.sauce ? SAUCE_C : 0 }, sprinkles: [], extras: [] };
    var G = iceGeo(sp.scoops, 1), top = G[G.length - 1], i;
    o.extras.forEach(function (e) {
      if (e.k === 'pos') for (i = 0; i < 14; i++) { var a = Math.PI + (i + 0.5) / 14 * Math.PI, d = 0.3 + 0.55 * ((i * 7) % 5) / 5; sp.sprinkles.push({ x: top.x + Math.cos(a) * d, y: top.y + Math.sin(a) * d, c: i, a: i * 1.3 }); }
      else if (e.k === 'wis') sp.extras.push({ k: 'wis', x: top.x, y: top.y - top.r * 0.98 });
      else if (e.k === 'waf') sp.extras.push({ k: 'waf', x: top.x + 0.62, y: top.y - 0.55, rot: 0.5 });
      else for (i = 0; i < e.n; i++) { var b = -Math.PI / 2 + (i - (e.n - 1) / 2) * 0.75; sp.extras.push({ k: 'bor', x: top.x + Math.cos(b) * 0.6, y: top.y + Math.sin(b) * 0.6 + 0.2 }); }
    });
    return sp;
  }
  function specIt(o, it) { return { vessel: o.vessel, scoops: it.scoops, sauce: it.sauce, sprinkles: it.sprinkles, extras: it.extras }; }
  // radius and origin so that the ice cream fits the box (x, y, w, h); returns { r, x, y }
  function fitIce(spec, x, y, w, h, maxScoops) {
    var n = Math.max(spec.scoops.length, maxScoops || 0), up = 0.5 + 1 + (n - 1) * 1.24 + 1.0, down = VH[spec.vessel];
    var r = Math.min(h / (up + down), w / 2.9);
    return { r: r, x: x + w / 2, y: y + (h - (up + down) * r) / 2 + up * r };
  }
  function drawOrder(g, o, w, h) {
    var pad = Math.max(4, h * 0.06), sp = specOf(o), f = fitIce(sp, pad, pad, w * 0.42, h - pad * 2);
    drawIce(g, f.x, f.y, f.r, sp);
    var rows = o.extras, n = rows.length, x0 = w * 0.5, cw = w - x0 - pad, rowH = Math.min((h - pad * 2) / Math.max(2, n), h * 0.36), y0 = h / 2 - rowH * n / 2;
    rows.forEach(function (e, j) {
      var cy = y0 + rowH * (j + 0.5), ir = Math.min(rowH * 0.3, cw * 0.16);
      g.save(); g.translate(x0 + ir + 2, cy + (e.k === 'waf' ? ir * 0.9 : e.k === 'wis' ? ir * 0.3 : 0)); if (e.k === 'waf') g.rotate(0.5); drawExtra(g, e.k, e.k === 'waf' ? ir * 0.5 : e.k === 'pos' ? ir * 1.1 : ir * 0.8); g.restore();
      if (e.k !== 'pos') txt(g, '×' + e.n, x0 + ir * 2 + 6, cy + 1, Math.min(rowH * 0.62, cw * 0.36), INK, 'left');
    });
  }

  // =====================================================================
  // Orders, items, scoring
  // =====================================================================
  function lodyOrder(shifts) {
    var fl = open(FLAV, shifts).map(function (x) { return x.k; }), sa = open(SAUCE, shifts), ex = open(EXTRA, shifts).map(function (x) { return x.k; });
    var n = shifts < 1 ? 1 : shifts < 3 ? rint(1, 2) : rint(2, 3);
    var scoops = shuffle(fl.slice()).slice(0, n);
    var newest = open(FLAV, shifts).sort(function (a, b) { return b.at - a.at; })[0];
    if (newest.at > 0 && shifts - newest.at < 3 && scoops.indexOf(newest.k) < 0 && Math.random() < 0.45) scoops[0] = newest.k;
    var extras = [];
    if (shifts < 1 || Math.random() < 0.55) extras.push({ k: 'wis', n: 1 });
    if (ex.indexOf('pos') >= 0 && Math.random() < 0.5) extras.push({ k: 'pos', n: 1 });
    if (ex.indexOf('waf') >= 0 && Math.random() < 0.4) extras.push({ k: 'waf', n: 1 });
    if (ex.indexOf('bor') >= 0 && Math.random() < 0.4) extras.push({ k: 'bor', n: rint(2, 4) });
    if (!extras.length) extras.push({ k: pick(ex), n: 1 });
    if (extras[0].k === 'bor' && extras[0].n === 1) extras[0].n = 3;
    return { vessel: shifts < 1 ? 'rozek' : pick(['rozek', 'rozek', 'kubek']), scoops: scoops, sauce: shifts < 1 ? 'scz' : Math.random() < 0.75 ? pick(sa).k : null, extras: extras.slice(0, 3) };
  }
  function newLody() { return { stage: 'scoop', scoops: [], sauce: { k: null, amt: 0 }, sprinkles: [], extras: [], born: null }; }
  function count(it, k) { return it.extras.filter(function (e) { return e.k === k; }).length; }
  function flavMatch(o, it) { var n = Math.max(o.scoops.length, it.scoops.length), ok = 0; for (var i = 0; i < n; i++) if (it.scoops[i] && it.scoops[i].k === o.scoops[i]) ok++; return n ? ok / n : 0; }
  function sizeScore(it) { if (!it.scoops.length) return 0; var s = 0; it.scoops.forEach(function (c) { s += 1 - clamp((Math.abs(c.size - 1) - SCOOP_OK) / 0.4, 0, 1); }); return s / it.scoops.length; }
  function decoDone(o, it) { return o.extras.every(function (e) { return e.k === 'pos' ? it.sprinkles.length >= SPR_N : count(it, e.k) === e.n; }); }

  function lodyScore(o, it) {
    var st = LODY.stations, match = flavMatch(o, it), size = sizeScore(it);
    var scoop = it.scoops.length ? 0.65 * match + 0.35 * size : 0;
    var d = Math.abs(it.sauce.amt - SAUCE_C), sauce;
    if (!o.sauce) sauce = it.sauce.amt > 0.05 ? 0.5 : 1;
    else sauce = it.sauce.amt < 0.05 ? 0 : it.sauce.k !== o.sauce ? 0.25 : d <= SAUCE_Z ? 1 : clamp(1 - (d - SAUCE_Z) / 0.3, 0.1, 1);
    var want = {}, parts = 0, wrong = 0;
    o.extras.forEach(function (e) {
      want[e.k] = 1;
      if (e.k === 'pos') parts += clamp(it.sprinkles.length / SPR_N, 0, 1);
      else { var df = Math.abs(count(it, e.k) - e.n); parts += df === 0 ? 1 : df === 1 ? 0.6 : df === 2 ? 0.3 : 0; }
    });
    parts /= Math.max(1, o.extras.length);
    it.extras.forEach(function (e) { if (!want[e.k]) wrong++; });
    if (!want.pos && it.sprinkles.length > 4) wrong += 2;
    var deco = clamp(parts - 0.12 * wrong, 0, 1);
    return [
      { k: 'scoop', n: 'Gałki', icon: st[0].icon, v: scoop, tip: match < 1 ? 'Nakładaj smaki od dołu, w tej samej kolejności co na karteczce.' : 'Puść łyżkę, gdy gałka wypełni kółko.' },
      { k: 'sauce', n: 'Polewa', icon: st[1].icon, v: sauce, tip: !o.sauce ? 'To zamówienie było bez polewy.' : it.sauce.k && it.sauce.k !== o.sauce ? 'Wybierz polewę w tym kolorze, co na karteczce.' : 'Puść butelkę, gdy wskazówka będzie w ramce.' },
      { k: 'deco', n: 'Dekoracje', icon: st[2].icon, v: deco, tip: wrong ? 'Kładź tylko dekoracje z karteczki.' : 'Policz dekoracje: ma być tyle, ile na karteczce.' }
    ];
  }

  // =====================================================================
  // The module
  // =====================================================================
  var LODY = {
    id: 'lody', name: 'Lodziarnia', loc: 'Lodziarni', sign: 'Lodziarnia Sopelek', signCol: '#d6457a', req: { id: 'burger', shifts: 3 },
    wall: '#ffe9f1', wall2: '#ffd6e4', trim: '#f58aa5', counter: '#6fc7b8', counter2: '#52ae9f', floor1: '#fff6e8', floor2: '#ffe7c7', curtain: '#7ccfc0', cloth: '#bfe3ff',
    stat: 'lody', madeLabel: 'Zrobione', fastS: 75, okS: 130,
    hi: ['Dzień dobry! Poproszę takie lody:', 'Cześć! Mam ochotę na takie lody:', 'Poproszę takie lody, dziękuję!', 'Mniam! Chcę takie lody:'],
    bye: {
      3: ['Pyszne! Dziękuję!', 'Najlepsze lody na świecie!', 'Mniam, mniam! Super!'],
      2: ['Smaczne! Dziękuję!', 'Bardzo dobre, dzięki!', 'Mniam! Dziękuję!'],
      1: ['Dziękuję! Zjem ze smakiem.', 'Dzięki! Zjem całe!', 'Dziękuję bardzo!']
    },
    tx: { make: 'Zrób lody w kuchni.', serve: 'Podaj lody', first: 'Najpierw zrób lody.' },
    hereIcon: '<path d="M6 11 h12 l-6 12 z" fill="#e9b872" stroke="#1d2f6f" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="8" r="6" fill="#f78fa8" stroke="#1d2f6f" stroke-width="2"/>',
    podajIcon: '<ellipse cx="20" cy="33" rx="15" ry="4.5" fill="#fff" stroke="#1d2f6f" stroke-width="2.5"/><path d="M12 17 h16 l-8 16 z" fill="#e9b872" stroke="#1d2f6f" stroke-width="2.2" stroke-linejoin="round"/><circle cx="20" cy="12" r="8" fill="#f78fa8" stroke="#1d2f6f" stroke-width="2.2"/><circle cx="20" cy="4" r="2.4" fill="#d8433b" stroke="#1d2f6f" stroke-width="1.2"/>',
    stations: [
      { k: 'galki', n: 'Gałki', icon: '<circle cx="15" cy="16" r="10" fill="#f78fa8" stroke="#1d2f6f" stroke-width="2.5"/><path d="M22 23 l12 11" stroke="#1d2f6f" stroke-width="7" stroke-linecap="round"/><path d="M22 23 l12 11" stroke="#c9d6ea" stroke-width="3.5" stroke-linecap="round"/><path d="M9 13 q2 -4 6 -4" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>' },
      { k: 'polewa', n: 'Polewa', icon: '<path d="M14 14 h12 l2 20 h-16 z" fill="#5a3620" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/><path d="M17 14 l2 -9 h2 l2 9 z" fill="#e2533f" stroke="#1d2f6f" stroke-width="2" stroke-linejoin="round"/><rect x="15" y="20" width="10" height="8" rx="2" fill="#fff"/>' },
      { k: 'dekoracje', n: 'Dekoracje', icon: '<path d="M20 18 q2 -10 11 -12" fill="none" stroke="#2a8a56" stroke-width="2.5" stroke-linecap="round"/><circle cx="20" cy="25" r="10" fill="#d8433b" stroke="#1d2f6f" stroke-width="2.5"/><circle cx="16" cy="21" r="2.5" fill="#fff" opacity=".75"/><rect x="4" y="8" width="7" height="3" rx="1.5" fill="#3f86d8" transform="rotate(30 7 9)"/><rect x="30" y="30" width="7" height="3" rx="1.5" fill="#f2b51d" transform="rotate(-30 33 31)"/>' }
    ],
    newOrder: lodyOrder, newItem: newLody, drawOrder: drawOrder, score: lodyScore,
    where: function (it) { return it.stage === 'scoop' ? 'galki' : it.stage === 'sauce' ? 'polewa' : it.stage === 'deco' ? 'dekoracje' : 'podaj'; },
    ready: function (it) { return it.stage === 'plate'; },
    whereText: { galki: 'Lody czekają na gałki.', polewa: 'Lody czekają na polewę.', dekoracje: 'Lody czekają na dekoracje.', podaj: 'Lody czekają na podanie.' },
    started: function (it) { return it.scoops.length > 0; },
    back: function (it) { it.stage = 'deco'; return { k: 'dekoracje' }; }, backLabel: '← Dekoracje',
    init: function (S) { S.ltool = 'wis'; },
    onServe: function (o, it, ctx) { ctx.sticker('lody'); if (o.scoops.length >= 3 && flavMatch(o, it) === 1) ctx.sticker('three'); },
    badge: function (it) { return it.stage === 'plate' ? 'Gotowe' : null; },
    unlockN: ALL.length, unlockWord: 'Nowość',
    unlocked: function (shifts) { return open(ALL, shifts).length; },
    nextUnlock: function (shifts) { var a = ALL.filter(function (x) { return x.at > shifts; }).map(function (x) { return x.at; }); return a.length ? Math.min.apply(null, a) - shifts : 0; },
    newUnlocks: function (shifts) { return ALL.filter(function (t) { return t.at === shifts; }).map(function (t) { return t.n; }); },
    unlockRow: function (g, w, h, shifts) {
      var n = ALL.length;
      ALL.forEach(function (t, i) {
        var x = (i + 0.5) * w / n, y = h / 2, s = Math.min(h * 0.3, w / n * 0.4), ok = shifts >= t.at;
        g.save(); g.globalAlpha = ok ? 1 : 0.22; g.translate(x, y);
        if (i < FLAV.length) { circle(g, 0, 0, s); g.fillStyle = t.c; g.fill(); ink(g, 1.5); }
        else if (i < FLAV.length + SAUCE.length) { g.beginPath(); g.moveTo(0, -s * 1.2); g.bezierCurveTo(s * 1.3, s * 0.3, s * 0.7, s * 1.1, 0, s * 1.1); g.bezierCurveTo(-s * 0.7, s * 1.1, -s * 1.3, s * 0.3, 0, -s * 1.2); g.fillStyle = t.c; g.fill(); ink(g, 1.5); }
        else { if (t.k === 'waf') { g.translate(0, s * 0.9); g.rotate(0.5); } drawExtra(g, t.k, t.k === 'waf' ? s * 0.5 : s * 0.8); }
        g.restore();
        if (!ok) { rr(g, x - 4, y - 1, 8, 7, 2); g.fillStyle = MUTED; g.fill(); g.beginPath(); g.arc(x, y - 1, 3, Math.PI, 0); g.strokeStyle = MUTED; g.lineWidth = 1.8; g.stroke(); }
      });
    },
    board: function (g, x, y, s) { drawIce(g, x, y + s * 0.1, s * 0.5, { vessel: 'rozek', scoops: [{ k: 'tru', size: 1 }, { k: 'wan', size: 1 }], sauce: { k: null, amt: 0 }, sprinkles: [], extras: [] }); },
    card: function (g, w, h) {
      var p = H.shopCard(g, w, h, { wall: '#ffe9f1', sign: 'Lodziarnia Sopelek', signCol: '#d6457a', awning: '#7ccfc0', door: '#f58aa5' });
      drawIce(g, p.x, p.y + p.s * 0.25, p.s * 0.42, specOf({ vessel: 'rozek', scoops: ['tru', 'wan'], sauce: 'scz', extras: [{ k: 'wis', n: 1 }] }));
    },
    // in a stand on the counter, or on a table
    drawServe: function (g, it, x, y, R, o) {
      var sp = specIt(o, it), r = R * 0.34, vh = VH[o.vessel] * r, base = y + R * 0.22;
      g.save(); g.lineWidth = 1;
      g.beginPath(); g.ellipse(x, base + R * 0.04, R * 0.62, R * 0.2, 0, 0, 7); g.fillStyle = 'rgba(29,47,111,.15)'; g.fill();
      g.beginPath(); g.ellipse(x, base, R * 0.6, R * 0.18, 0, 0, 7); g.fillStyle = '#fff'; g.fill(); ink(g, Math.max(1.2, R * 0.045));
      if (o.vessel === 'rozek') { rr(g, x - r * 0.62, base - vh * 0.5, r * 1.24, vh * 0.5, r * 0.2); g.fillStyle = '#c9d6ea'; g.fill(); ink(g, Math.max(1.2, R * 0.04)); }
      drawIce(g, x, base - vh - (o.vessel === 'rozek' ? r * 0.12 : 0), r, sp);
      if (o.vessel === 'rozek') { rr(g, x - r * 0.62, base - vh * 0.34, r * 1.24, vh * 0.34, r * 0.2); g.fillStyle = '#c9d6ea'; g.fill(); ink(g, Math.max(1.2, R * 0.04)); }
      g.restore();
    },
    update: function (dt, S) {
      var it = S.item, d = S.drag;
      if (it && S.view === 'polewa' && d && d.pour) {
        var was = it.sauce.amt; it.sauce.amt = Math.min(1, was + dt / POUR_S);
        if (S.T - (S.lastPour || 0) > 0.16) { S.lastPour = S.T; S.sfx('paint'); }
        if (was < 1 && it.sauce.amt >= 1) S.say('Ups, cała butelka!');
      }
    }
  };

  // ---------- shared station layout: the pattern card, the ice cream, the bins ----------
  function lay(S, bins, top) {
    var W = S.W, H2 = S.H, L = S.L = {}, n = bins.length, x0, x1, y1;
    top = top || 26;
    if (W > H2 * 1.2) {
      var cols = n > 4 ? 2 : 1, rows = Math.ceil(n / cols), b = Math.max(54, Math.min(124, (H2 - 20) / rows - 12, W * 0.28 / cols - 12)), gap = b + 12;
      var gx = W - 20 - (cols * gap - 12) / 2;
      bins.forEach(function (bn, i) { var r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, n - r * cols); bn.x = gx + (c - (inRow - 1) / 2) * gap; bn.y = H2 / 2 + (r - (rows - 1) / 2) * gap; bn.s = b; });
      var left = W - 20 - cols * gap - 10;
      L.pat = { x: 14, y: 14, w: Math.min(left * 0.3, 300), h: H2 - 28 };
      x0 = L.pat.x + L.pat.w + 10; x1 = left; y1 = H2 - 12;
    } else {
      var cols2 = Math.min(n, W > 560 ? n : 4), rows2 = Math.ceil(n / cols2), b2 = Math.max(50, Math.min(96, W / cols2 - 8)), binsH = rows2 * (b2 + 8) + 4;
      bins.forEach(function (bn, i) { var r = Math.floor(i / cols2), c = i % cols2, inRow = Math.min(cols2, n - r * cols2); bn.x = W / 2 + (c - (inRow - 1) / 2) * (b2 + 6); bn.y = H2 - binsH + r * (b2 + 8) + b2 / 2 + 2; bn.s = b2; });
      var ah = H2 - binsH - 8;
      L.pat = { x: 8, y: 8, w: W * 0.3, h: ah - 8 };
      x0 = L.pat.x + L.pat.w + 6; x1 = W - 6; y1 = ah;
    }
    L.bins = bins; L.x0 = x0; L.x1 = x1; L.y1 = y1; L.sayY = 6;
    var o = S.ticket ? S.ticket.order : { vessel: 'rozek' };
    var f = fitIce({ vessel: o.vessel, scoops: [] }, x0, top, x1 - x0, y1 - top - 16, 3);
    L.r = f.r; L.cx = f.x; L.oy = f.y; L.vessel = o.vessel;
    return L;
  }
  function drawBase(g, S) {
    var L = S.L, W = S.W, H2 = S.H, it = S.item, o = S.ticket && S.ticket.order, i;
    g.fillStyle = '#eef7fb'; g.fillRect(0, 0, W, H2);
    g.strokeStyle = 'rgba(120,170,200,.2)'; g.lineWidth = 2;
    for (i = 0; i < 9; i++) { g.beginPath(); var y0 = (i * 97) % H2; g.moveTo(0, y0); g.bezierCurveTo(W * 0.3, y0 + 40, W * 0.6, y0 - 50, W, y0 + 20); g.stroke(); }
    var P = L.pat;
    rr(g, P.x + 3, P.y + 5, P.w, P.h, 14); g.fillStyle = 'rgba(29,47,111,.14)'; g.fill();
    rr(g, P.x, P.y, P.w, P.h, 14); g.fillStyle = '#fffdf5'; g.fill(); ink(g, 3);
    txt(g, 'Wzór', P.x + P.w / 2, P.y + 17, 22, MUTED);
    if (o) {
      var sp = specOf(o), f = fitIce(sp, P.x + 6, P.y + 30, P.w - 12, P.h - 40), mark = -1;
      if (it && it.stage === 'scoop') { mark = it.scoops.length; for (i = 0; i < it.scoops.length; i++) if (it.scoops[i].k !== o.scoops[i]) mark = -1; if (mark >= o.scoops.length) mark = -1; }
      f.r = Math.min(f.r, L.r);
      drawIce(g, f.x + (mark >= 0 ? f.r * 0.3 : 0), f.y, f.r, sp, { mark: mark });
    }
    // the stand and the ice cream being made
    var vh = VH[L.vessel] * L.r;
    rr(g, L.cx - L.r * 1.5, L.oy + vh - 2, L.r * 3, L.r * 0.34, L.r * 0.12); g.fillStyle = '#c9d6ea'; g.fill(); ink(g, 3);
    if (L.vessel === 'rozek') { rr(g, L.cx - L.r * 0.5, L.oy + vh * 0.62, L.r, vh * 0.4, L.r * 0.12); g.fillStyle = '#aebbd4'; g.fill(); ink(g, 2.5); }
    var G = [];
    if (it && o) {
      var melt = it.born == null || it.stage === 'plate' ? 0 : clamp((S.t - it.born - LODY.fastS * 0.6) / (LODY.fastS * 0.6), 0, 1);
      G = drawIce(g, L.cx, L.oy, L.r, specIt(o, it), { now: S.T, melt: melt });
    } else { g.save(); g.translate(L.cx, L.oy); drawVessel(g, L.vessel, L.r); g.restore(); }
    if (L.vessel === 'rozek') { rr(g, L.cx - L.r * 0.5, L.oy + vh * 0.78, L.r, vh * 0.24, L.r * 0.12); g.fillStyle = '#aebbd4'; g.fill(); ink(g, 2.5); }
    return G;
  }
  function binBox(g, bn, sel, dim) {
    var s = bn.s, x = bn.x, y = bn.y - (sel && !REDUCED ? 3 : 0);
    rr(g, x - s / 2, y - s / 2 + 4, s, s, s * 0.22); g.fillStyle = 'rgba(29,47,111,.18)'; g.fill();
    rr(g, x - s / 2, y - s / 2, s, s, s * 0.22); g.fillStyle = sel ? '#fff4d6' : '#fff'; g.fill(); ink(g, sel ? 4 : 2.5);
    if (sel) { rr(g, x - s / 2 + 4, y - s / 2 + 4, s - 8, s - 8, s * 0.18); g.strokeStyle = GOLD; g.lineWidth = 3; g.stroke(); }
    return y;
  }
  function binDim(g, bn) { var s = bn.s; rr(g, bn.x - s / 2, bn.y - s / 2, s, s, s * 0.22); g.fillStyle = 'rgba(255,255,255,.5)'; g.fill(); }
  function binBadge(g, bn, label, ok, over) {
    var s = bn.s, bw = s * 0.62, bh = s * 0.3, bx = bn.x + s / 2 - bw + s * 0.08, by = bn.y - s / 2 - bh * 0.45;
    rr(g, bx, by, bw, bh, bh / 2); g.fillStyle = ok ? '#c8f0c0' : over ? '#ffd9c6' : '#fff'; g.fill(); ink(g, 2);
    txt(g, label, bx + bw / 2, by + bh / 2 + 1, bh * 0.82, ok ? GREEN : INK);
  }
  function hitBin(S, x, y) { var r = null; S.L.bins.forEach(function (bn) { if (Math.abs(x - bn.x) < bn.s / 2 + 4 && Math.abs(y - bn.y) < bn.s / 2 + 4) r = bn; }); return r; }
  function noItem(S) { return [{ id: 'goLada', label: '← Do lady', main: true, on: function () { S.go('lada'); } }]; }
  function goWhere(S) { var w = LODY.where(S.item); return [{ id: 'goWhere', label: (w === 'podaj' ? 'Podaj' : 'Idź: ' + S.stationName(w)) + ' →', main: true, on: function () { S.go(w); } }]; }
  function shade(S, g) { if (!S.item) { g.fillStyle = 'rgba(238,247,251,.55)'; g.fillRect(0, 0, S.W, S.H); } }
  // a point on the canvas in ice cream units; inside: is it on a scoop
  function icePt(S, x, y) { var L = S.L, p = { x: (x - L.cx) / L.r, y: (y - L.oy) / L.r }; p.on = iceGeo(S.item.scoops, 1).some(function (c) { return Math.hypot(p.x - c.x, p.y - c.y) < c.r * 1.12; }); return p; }

  // ----- station: Gałki -----
  LODY.galki = {
    layout: function (S) { lay(S, open(FLAV, S.shifts).map(function (f) { return { k: f.k }; })); },
    draw: function (g, S) {
      var L = S.L, it = S.item, d = S.drag;
      drawBase(g, S);
      L.bins.forEach(function (bn) {
        var s = bn.s, f = BY[bn.k], y = binBox(g, bn, d && d.scoop && d.k === bn.k);
        rr(g, bn.x - s * 0.36, y - s * 0.36, s * 0.72, s * 0.5, s * 0.14); g.fillStyle = f.c; g.fill(); ink(g, 2.5);
        g.beginPath(); g.moveTo(bn.x - s * 0.24, y - s * 0.16); g.quadraticCurveTo(bn.x - s * 0.05, y - s * 0.3, bn.x + s * 0.2, y - s * 0.2); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = Math.max(2, s * 0.05); g.lineCap = 'round'; g.stroke();
        txt(g, f.n, bn.x, y + s * 0.31, Math.max(13, s * 0.2), MUTED);
      });
      // the ball on the scoop grows towards the ring
      if (d && d.scoop) {
        var sz = Math.min(d.size, 1.5), ok = Math.abs(sz - 1) <= SCOOP_OK, by = d.y - L.r * 1.5;
        g.setLineDash([8, 6]); circle(g, d.x, by, L.r); g.strokeStyle = ok ? GREEN : INK; g.lineWidth = ok ? 5 : 3; g.stroke(); g.setLineDash([]);
        if (sz > 0.1) drawScoop(g, d.x, by, L.r * sz, BY[d.k].c);
        g.beginPath(); g.moveTo(d.x + L.r * 0.5, by + L.r * 0.6); g.lineTo(d.x + L.r * 1.5, by + L.r * 1.7); g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = L.r * 0.3; g.stroke(); g.strokeStyle = '#c9d6ea'; g.lineWidth = L.r * 0.16; g.stroke();
        if (ok) txt(g, 'Puść!', d.x, by - L.r - 14, 24, GREEN);
      }
      shade(S, g);
    },
    down: function (S, x, y) {
      var it = S.item; if (!it || it.stage !== 'scoop') return;
      var bn = hitBin(S, x, y); if (!bn) return;
      if (it.scoops.length >= MAX_SCOOPS) { S.say('Więcej gałek się nie zmieści!'); return; }
      S.drag = { scoop: true, k: bn.k, x: x, y: y, size: 0, unit: bn.s * 2.2 };
    },
    move: function (S, x, y) {
      var d = S.drag; if (!d || !d.scoop) return;
      d.size = Math.min(1.5, d.size + Math.hypot(x - d.x, y - d.y) / d.unit); d.x = x; d.y = y;
      if (S.T - (S.lastPaint || 0) > 0.14) { S.lastPaint = S.T; S.sfx('paint'); }
    },
    up: function (S) {
      var d = S.drag; S.drag = null; if (!d || !d.scoop) return;
      var it = S.item;
      if (d.size < 0.4) { S.sfx('tap'); S.say('Pocieraj łyżką w kuwecie, aż gałka urośnie.'); return; }
      it.scoops.push({ k: d.k, size: d.size, t0: S.T }); if (it.born == null) it.born = S.t;
      var e = d.size - 1, ok = Math.abs(e) <= SCOOP_OK;
      S.sfx(ok ? 'star' : 'place'); S.say(ok ? 'Idealna gałka!' : e < 0 ? 'Malutka gałka.' : 'Wielka gałka!');
      if (ok) S.sparkle(S.L.cx, S.L.oy - S.L.r * (0.5 + it.scoops.length));
    },
    hint: function (S) {
      var it = S.item; if (!it) return 'Najpierw przyjmij zamówienie przy ladzie.';
      if (it.stage !== 'scoop') return LODY.whereText[LODY.where(it)];
      var o = S.ticket.order;
      if (it.scoops.length >= o.scoops.length) return 'Gałki gotowe!';
      return 'Pocieraj palcem w kuwecie z dobrym smakiem. Puść, gdy gałka wypełni kółko.';
    },
    buttons: function (S) {
      var it = S.item; if (!it) return noItem(S);
      if (it.stage !== 'scoop') return goWhere(S);
      var o = S.ticket.order;
      return [
        { id: 'undo', label: '↺ Zdejmij gałkę', disabled: !it.scoops.length, on: function () { it.scoops.pop(); S.sfx('pop'); } },
        { id: 'next', label: (o.sauce ? 'Polewa' : 'Dekoracje') + ' →', main: true, disabled: !it.scoops.length, pulse: it.scoops.length >= o.scoops.length, on: function () { it.stage = o.sauce ? 'sauce' : 'deco'; S.sfx('whoosh'); S.go(LODY.where(it)); } }
      ];
    }
  };

  // ----- station: Polewa -----
  LODY.polewa = {
    layout: function (S) { lay(S, open(SAUCE, S.shifts).map(function (f) { return { k: f.k }; }), 64); },
    draw: function (g, S) {
      var L = S.L, it = S.item, d = S.drag, o = S.ticket && S.ticket.order;
      var G = drawBase(g, S), top = G[G.length - 1];
      L.bins.forEach(function (bn) {
        var s = bn.s, f = BY[bn.k], y = binBox(g, bn, it && it.sauce.k === bn.k && it.sauce.amt > 0.01);
        g.beginPath(); g.moveTo(bn.x - s * 0.16, y - s * 0.18); g.lineTo(bn.x + s * 0.16, y - s * 0.18); g.lineTo(bn.x + s * 0.2, y + s * 0.2); g.lineTo(bn.x - s * 0.2, y + s * 0.2); g.closePath(); g.fillStyle = f.c; g.fill(); ink(g, 2.5);
        g.beginPath(); g.moveTo(bn.x - s * 0.08, y - s * 0.18); g.lineTo(bn.x - s * 0.03, y - s * 0.38); g.lineTo(bn.x + s * 0.03, y - s * 0.38); g.lineTo(bn.x + s * 0.08, y - s * 0.18); g.closePath(); g.fillStyle = '#e2533f'; g.fill(); ink(g, 2);
        txt(g, f.s, bn.x, y + s * 0.34, Math.max(13, s * 0.19), MUTED);
        if (o && it && it.stage === 'sauce' && o.sauce !== bn.k) binDim(g, bn);
      });
      // the stream from above
      if (it && d && d.pour && top && it.sauce.amt < 1) {
        var sx = L.cx + top.x, sy = L.oy + top.y - top.r;
        g.fillStyle = BY[it.sauce.k].c; g.fillRect(sx - L.r * 0.07, 56, L.r * 0.14, Math.max(0, sy - 54));
      }
      // the amount gauge
      if (it && it.stage === 'sauce') {
        var gw = Math.min(L.x1 - L.x0 - 20, L.r * 5), gx = L.cx - gw / 2, gy = 22, gh = Math.max(16, Math.min(24, S.H * 0.045)), v = it.sauce.amt, inZ = Math.abs(v - SAUCE_C) <= SAUCE_Z && v > 0;
        var col = it.sauce.k ? BY[it.sauce.k].c : '#5a3620';
        rr(g, gx, gy, gw, gh, gh / 2); g.fillStyle = '#fff'; g.fill();
        g.save(); rr(g, gx, gy, gw, gh, gh / 2); g.clip(); g.fillStyle = col; g.fillRect(gx, gy, gw * v, gh); g.restore();
        rr(g, gx, gy, gw, gh, gh / 2); ink(g, 2.5);
        rr(g, gx + gw * (SAUCE_C - SAUCE_Z), gy - 5, gw * SAUCE_Z * 2, gh + 10, 7); g.strokeStyle = inZ ? GREEN : GOLD; g.lineWidth = 4.5; g.stroke();
        var nx = gx + gw * v; g.beginPath(); g.moveTo(nx, gy - 4); g.lineTo(nx, gy + gh + 4); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
        if (inZ && d && d.pour) txt(g, 'Puść!', Math.min(nx + 34, S.W - 30), gy + gh + 16, 22, GREEN);
        L.sayY = gy + gh + 30;
      }
      shade(S, g);
    },
    down: function (S, x, y) {
      var it = S.item; if (!it || it.stage !== 'sauce') return;
      var bn = hitBin(S, x, y); if (!bn) return;
      if (it.sauce.k && it.sauce.k !== bn.k && it.sauce.amt > 0.02) { S.sfx('tap'); S.say('Na lodach jest inna polewa. Najpierw zetrzyj.'); return; }
      it.sauce.k = bn.k; S.drag = { pour: true };
    },
    up: function (S) {
      var d = S.drag, it = S.item; S.drag = null; if (!d || !d.pour || !it) return;
      var o = S.ticket.order, dd = it.sauce.amt - SAUCE_C;
      if (it.sauce.k === o.sauce && Math.abs(dd) <= SAUCE_Z) { S.sfx('star'); S.say('W sam raz!'); S.sparkle(S.L.cx, S.L.oy - S.L.r * 2); }
      else if (dd < -SAUCE_Z) S.say('Jeszcze trochę: przytrzymaj butelkę.');
    },
    hint: function (S) {
      var it = S.item; if (!it) return 'Najpierw przyjmij zamówienie przy ladzie.';
      if (it.stage === 'scoop') return 'Najpierw nałóż gałki.';
      if (it.stage !== 'sauce') return S.ticket.order.sauce ? LODY.whereText[LODY.where(it)] : 'To zamówienie jest bez polewy.';
      return it.sauce.amt < 0.05 ? 'Przytrzymaj butelkę z dobrą polewą. Puść, gdy wskazówka będzie w ramce.' : 'Gotowe? Teraz dekoracje.';
    },
    buttons: function (S) {
      var it = S.item; if (!it) return noItem(S);
      if (it.stage !== 'sauce') return goWhere(S);
      return [
        { id: 'wipe', label: '↺ Zetrzyj', disabled: it.sauce.amt < 0.02, on: function () { it.sauce.amt = 0; it.sauce.k = null; S.sfx('pop'); } },
        { id: 'next', label: 'Dekoracje →', main: true, pulse: it.sauce.amt > 0.05, on: function () { it.stage = 'deco'; S.sfx('whoosh'); S.go('dekoracje'); } }
      ];
    }
  };

  // ----- station: Dekoracje -----
  LODY.dekoracje = {
    layout: function (S) { lay(S, open(EXTRA, S.shifts).map(function (f) { return { k: f.k }; })); },
    enter: function (S) {
      var it = S.item; if (!it || it.stage !== 'deco') return;
      var o = S.ticket.order, need = o.extras.filter(function (e) { return e.k === 'pos' ? it.sprinkles.length < SPR_N : count(it, e.k) < e.n; })[0];
      if (need) S.ltool = need.k;
    },
    draw: function (g, S) {
      var L = S.L, it = S.item, o = S.ticket && S.ticket.order, want = {};
      drawBase(g, S);
      if (o) o.extras.forEach(function (e) { want[e.k] = e.n; });
      L.bins.forEach(function (bn) {
        var s = bn.s, y = binBox(g, bn, S.ltool === bn.k);
        g.save(); g.translate(bn.x, y - s * 0.06 + (bn.k === 'waf' ? s * 0.22 : bn.k === 'wis' ? s * 0.08 : 0)); if (bn.k === 'waf') g.rotate(0.5); drawExtra(g, bn.k, bn.k === 'waf' ? s * 0.11 : bn.k === 'pos' ? s * 0.26 : s * 0.17); g.restore();
        txt(g, BY[bn.k].n, bn.x, y + s * 0.34, Math.max(13, s * 0.19), MUTED);
        if (o && !want[bn.k]) binDim(g, bn);
        if (it && it.stage === 'deco' && o) {
          if (bn.k === 'pos') { var n = it.sprinkles.length; if (want.pos) binBadge(g, bn, n >= SPR_N ? '✓' : Math.round(Math.min(n / SPR_N, 0.99) * 100) + '%', n >= SPR_N); else if (n) binBadge(g, bn, String(n), false, true); }
          else { var hv = count(it, bn.k); if (want[bn.k]) binBadge(g, bn, hv + '/' + want[bn.k], hv === want[bn.k], hv > want[bn.k]); else if (hv) binBadge(g, bn, String(hv), false, true); }
        }
      });
      var d = S.drag;
      if (d && d.k && d.moved) { g.save(); g.translate(d.x, d.y - 16 * S.u); drawExtra(g, d.k, EX_S[d.k] * L.r * 1.15); g.restore(); }
      shade(S, g);
    },
    place: function (S, k, x, y) {
      var it = S.item, p = icePt(S, x, y);
      if (!p.on) { S.sfx('tap'); S.say('Połóż na lodach.'); return; }
      if (it.extras.length >= 14) return;
      it.extras.push({ k: k, x: p.x, y: p.y, rot: k === 'waf' ? rnd(0.25, 0.6) * (p.x < 0 ? -1 : 1) : 0 });
      S.sfx('pop'); S.pop(x, y);
      var o = S.ticket.order, e = o.extras.filter(function (q) { return q.k === k; })[0];
      if (e && count(it, k) === e.n) { S.sfx('star'); S.say('Gotowe: ' + BY[k].n + '!'); }
    },
    sprinkle: function (S, x, y) {
      var it = S.item, p = icePt(S, x, y); if (!p.on || it.sprinkles.length >= SPR_MAX) return;
      it.sprinkles.push({ x: p.x + rnd(-0.12, 0.12), y: p.y + rnd(-0.12, 0.12), c: rint(0, 5), a: rnd(0, 3.1) });
      if (S.T - (S.lastPaint || 0) > 0.1) { S.lastPaint = S.T; S.sfx('paint'); }
      if (it.sprinkles.length === SPR_N) { S.sfx('star'); S.say('Gotowe: posypka!'); }
    },
    down: function (S, x, y) {
      var it = S.item; if (!it || it.stage !== 'deco') return;
      var bn = hitBin(S, x, y);
      if (bn) { if (S.ltool !== bn.k) { S.ltool = bn.k; S.sfx('tap'); } S.drag = { bin: true, k: bn.k === 'pos' ? null : bn.k, x: x, y: y, x0: x, y0: y, moved: false }; return; }
      if (S.ltool === 'pos') { S.drag = { paint: true, x: x, y: y }; this.sprinkle(S, x, y); return; }
      S.drag = { tap: true, x: x, y: y, x0: x, y0: y, moved: false };
    },
    move: function (S, x, y) {
      var d = S.drag; if (!d) return;
      if (d.paint) { if (Math.hypot(x - d.x, y - d.y) > S.L.r * 0.16) { d.x = x; d.y = y; this.sprinkle(S, x, y); } return; }
      d.x = x; d.y = y; if (!d.moved && Math.hypot(x - d.x0, y - d.y0) > 10) d.moved = true;
    },
    up: function (S, x, y) {
      var d = S.drag; S.drag = null; if (!d || d.paint) return;
      if (d.bin) { if (d.moved && d.k) this.place(S, d.k, x, y - 16 * S.u); return; }
      if (d.tap && !d.moved && S.ltool && S.ltool !== 'pos') this.place(S, S.ltool, x, y);
    },
    hint: function (S) {
      var it = S.item; if (!it) return 'Najpierw przyjmij zamówienie przy ladzie.';
      if (it.stage === 'scoop' || it.stage === 'sauce') return 'Najpierw gałki i polewa.';
      if (it.stage !== 'deco') return LODY.whereText[LODY.where(it)];
      if (decoDone(S.ticket.order, it)) return 'Wszystko jest! Podaj gościowi.';
      return S.ltool === 'pos' ? 'Posyp lody: przesuwaj po nich palcem.' : 'Połóż dekoracje jak na karteczce: dotknij lodów.';
    },
    buttons: function (S) {
      var it = S.item; if (!it) return noItem(S);
      if (it.stage !== 'deco') return goWhere(S);
      return [
        { id: 'clear', label: '↺ Zdejmij dekoracje', disabled: !it.extras.length && !it.sprinkles.length, on: function () { it.extras = []; it.sprinkles = []; S.sfx('whoosh'); } },
        { id: 'serve', label: 'Podaj →', main: true, pulse: decoDone(S.ticket.order, it), on: function () { it.stage = 'plate'; S.sfx('whoosh'); S.go('podaj'); } }
      ];
    }
  };

  NG.restauracje.add(LODY);
})();
