/*
 * Ogródek: a long-running garden. Seeds cost stars (ctx.spend), plants grow in real time (20 min to 3 days),
 * computed from saved timestamps so they grow while the app is closed. A plant only grows on days it was
 * watered (planting day counts). Every finished learning set today (Skarbonka.todayStats().sets) fills one
 * watering can; each can marks today as watered and gives every growing plant +3 h (pl.extra).
 * Guests (snails, weeds -> compost; butterflies -> collection; birds -> free seed) show up every few hours,
 * computed from timestamps. Decorations are bought with stars and dragged around. Harvest -> zielnik,
 * pantry and a small refund; animals at the gate order produce from the pantry for stars.
 * Free seeds from other games arrive through localStorage['naukagry.ogrodek.inbox'] = [{kind, n, from}].
 * Upgrades (Sklep -> Ulepszenia, UPS, st.up): rain barrel (extra water, one can per 6 h up to its size, used when
 * the learning cans are empty), bigger can, compost, up to 3 extra beds, beehive (chance of a double crop), stall.
 */
(function () {
  'use strict';

  var INK = '#1d2f6f', STAR = '#e3a008', LVL = '#7a4fc4', MUTED = '#5a6690';
  var FONT = '"Patrick Hand","Comic Sans MS",cursive';
  var HOUR = 3600e3;
  var INBOX = 'naukagry.ogrodek.inbox';
  var MAX_PLOTS = 12, MAX_PLOTS_UP = 15;   // 12 from levels, 3 more bought as upgrades
    var MAX_GUESTS = 4, GUEST_EVERY = 2 * HOUR;
  var ORDER_EVERY = 3 * HOUR, ORDER_AFTER = HOUR;
  var MAX_DECO = 12, MAX_SAME = 3;
  // economy: harvest refunds 30% of what the seed cost; an order pays 80% of the seed price per item grown from
  // bought seeds (30% for free seeds). Produce that goes to an order returns 110% of its seed cost in total.
  var HARVEST_BACK = 0.3, ORDER_PAY = 0.8, ORDER_PAY_FREE = 0.3;

  // ---------- upgrades (Sklep -> Ulepszenia): bought once per level with stars, kept forever ----------
  // v: the value at each level (index 0 = not bought yet), price[i]: the cost of level i+1, lv[i]: player level needed
  var RAIN = 6 * HOUR;   // the rain barrel collects one can of water every 6 hours, up to its size
  var UPS = [
    { k: 'tank', n: 'Beczka na deszczówkę', v: [0, 2, 3, 4, 6], price: [400, 750, 1250, 2000], lv: [1, 3, 6, 10],
      say: function (v) { return v ? 'Mieści ' + v + ' ' + plural(v, 'konewkę', 'konewki', 'konewek') + ' wody z deszczu' : 'Zbiera deszcz: konewka co 6 godzin'; },
      more: 'Woda z beczki podlewa, gdy konewka z nauki jest pusta.' },
    { k: 'can', n: 'Duża konewka', v: [3, 4, 5, 6], price: [500, 1000, 1600], lv: [2, 5, 9],
      say: function (v) { return 'Podlewanie: +' + v + ' godz. wzrostu'; } },
    { k: 'comp', n: 'Kompostownik', v: [2, 3, 4], price: [300, 700], lv: [1, 4],
      say: function (v) { return 'Kompost: +' + v + ' godz. wzrostu'; } },
    { k: 'plot', n: 'Nowa grządka', v: [0, 1, 2, 3], price: [750, 1250, 2000], lv: [2, 6, 12],
      say: function (v) { return v ? 'Dodatkowe grządki: ' + v : 'Jeszcze jedna grządka do sadzenia'; } },
    { k: 'bee', n: 'Ul z pszczołami', v: [0, 20, 35, 50], price: [600, 1100, 1750], lv: [3, 7, 12],
      say: function (v) { return v ? 'Szansa na podwójny plon: ' + v + '%' : 'Pszczoły czasem dają podwójny plon'; } },
    { k: 'stall', n: 'Stragan przy bramie', v: [3, 4, 5], price: [500, 1100], lv: [4, 8],
      say: function (v) { return 'Zamówienia naraz: ' + v; } }
  ];
  var UB = {}; UPS.forEach(function (U) { UB[U.k] = U; });

  // upgrade pictures (centre bottom at 0,0, about 80 units tall); fill: 0..1 water in the barrel
  function drawUp(g, k, fill) {
    function o(w) { g.lineWidth = w || 3; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
    function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    if (k === 'tank') {
      var bar = function () { g.beginPath(); g.moveTo(-26, -70); g.quadraticCurveTo(-34, -36, -26, -2); g.lineTo(26, -2); g.quadraticCurveTo(34, -36, 26, -70); g.closePath(); };
      bar(); g.fillStyle = '#b97a3e'; g.fill();
      if (fill > 0) { g.save(); bar(); g.clip(); g.fillStyle = '#6fb7ff'; g.fillRect(-40, -2 - 66 * fill, 80, 66 * fill); g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(-40, -2 - 66 * fill, 80, 3); g.restore(); }
      g.strokeStyle = 'rgba(29,47,111,.35)'; g.lineWidth = 2; [-13, 0, 13].forEach(function (x) { g.beginPath(); g.moveTo(x * 1.05, -69); g.quadraticCurveTo(x * 1.3, -36, x * 1.05, -3); g.stroke(); });
      bar(); o();
      [-60, -14].forEach(function (y) { g.beginPath(); g.moveTo(-29, y); g.quadraticCurveTo(0, y + 4, 29, y); g.lineWidth = 7; g.strokeStyle = INK; g.stroke(); g.lineWidth = 4; g.strokeStyle = '#8e9bb8'; g.stroke(); });
      g.beginPath(); g.ellipse(0, -70, 26, 6, 0, 0, Math.PI * 2); g.fillStyle = fill >= 0.98 ? '#6fb7ff' : '#7a4f28'; g.fill(); o(2.5);
      // a drip from the gutter
      g.beginPath(); g.moveTo(6, -92); g.quadraticCurveTo(12, -82, 6, -78); g.quadraticCurveTo(0, -82, 6, -92); g.fillStyle = '#6fb7ff'; g.fill(); o(2);
    } else if (k === 'can') {
      g.beginPath(); g.moveTo(14, -40); g.lineTo(44, -66); o(9); g.beginPath(); g.moveTo(14, -40); g.lineTo(44, -66); g.lineWidth = 5; g.strokeStyle = '#3f86d8'; g.stroke();
      g.beginPath(); g.ellipse(46, -68, 7, 4, -0.7, 0, Math.PI * 2); g.fillStyle = '#9fd4f5'; g.fill(); o(2.5);
      rr(-30, -58, 50, 56, 10); g.fillStyle = '#3f86d8'; g.fill(); o();
      g.beginPath(); g.arc(-6, -58, 18, Math.PI, 0); o(6); g.beginPath(); g.arc(-6, -58, 18, Math.PI, 0); g.lineWidth = 3; g.strokeStyle = '#3f86d8'; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.5)'; rr(-24, -50, 8, 36, 4); g.fill();
      g.fillStyle = '#fff'; g.font = '22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★', -4, -28);
    } else if (k === 'comp') {
      rr(-34, -54, 68, 52, 6); g.fillStyle = '#8a5a33'; g.fill(); o();
      g.strokeStyle = '#5e3b22'; g.lineWidth = 2.5; [-38, -22].forEach(function (y) { g.beginPath(); g.moveTo(-32, y); g.lineTo(32, y); g.stroke(); });
      [[-20, -60, '#5cbc4b'], [0, -66, '#8fd06b'], [18, -60, '#5cbc4b']].forEach(function (l) { g.beginPath(); g.ellipse(l[0], l[1], 10, 6, l[0] * 0.03, 0, Math.PI * 2); g.fillStyle = l[2]; g.fill(); o(2); });
      g.beginPath(); g.arc(-4, -58, 6, 0, Math.PI * 2); g.fillStyle = '#e2533f'; g.fill(); o(2);
    } else if (k === 'plot') {
      g.beginPath(); g.ellipse(0, -14, 40, 13, 0, 0, Math.PI * 2); g.fillStyle = '#8a5a33'; g.fill(); o();
      g.strokeStyle = '#6e4527'; g.lineWidth = 2; [-20, 0, 20].forEach(function (x) { g.beginPath(); g.moveTo(x - 8, -14); g.lineTo(x + 8, -14); g.stroke(); });
      g.beginPath(); g.moveTo(0, -24); g.quadraticCurveTo(-2, -40, 0, -48); o(4); g.beginPath(); g.moveTo(0, -24); g.quadraticCurveTo(-2, -40, 0, -48); g.lineWidth = 2; g.strokeStyle = '#5cbc4b'; g.stroke();
      [[-1, -0.5], [1, 0.5]].forEach(function (l) { g.beginPath(); g.ellipse(l[0] * 10, -46, 10, 5, l[1], 0, Math.PI * 2); g.fillStyle = '#8fd06b'; g.fill(); o(2); });
      g.beginPath(); g.arc(30, -56, 12, 0, Math.PI * 2); g.fillStyle = '#e3a008'; g.fill(); o(2.5);
      g.fillStyle = '#fff'; g.font = 'bold 20px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('+', 30, -55);
    } else if (k === 'bee') {
      g.beginPath(); g.moveTo(-28, -2); g.lineTo(28, -2); g.lineTo(26, -20); g.quadraticCurveTo(30, -36, 18, -50); g.quadraticCurveTo(8, -66, 0, -66); g.quadraticCurveTo(-8, -66, -18, -50); g.quadraticCurveTo(-30, -36, -26, -20); g.closePath();
      g.fillStyle = '#f5c330'; g.fill(); o();
      g.strokeStyle = '#c98a10'; g.lineWidth = 3; [-18, -34, -50].forEach(function (y) { g.beginPath(); g.moveTo(-26, y); g.lineTo(26, y); g.stroke(); });
      g.beginPath(); g.ellipse(0, -14, 7, 8, 0, 0, Math.PI * 2); g.fillStyle = '#5e3b22'; g.fill(); o(2);
      [[30, -62], [-34, -48]].forEach(function (b) {
        g.beginPath(); g.ellipse(b[0], b[1] - 7, 6, 4, 0.4, 0, Math.PI * 2); g.ellipse(b[0] + 5, b[1] - 6, 5, 3.5, -0.3, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill(); o(1.5);
        g.beginPath(); g.ellipse(b[0], b[1], 8, 6, 0, 0, Math.PI * 2); g.fillStyle = '#f5c330'; g.fill(); o(2);
        g.beginPath(); g.moveTo(b[0] - 2, b[1] - 5.5); g.lineTo(b[0] - 2, b[1] + 5.5); g.moveTo(b[0] + 3, b[1] - 5); g.lineTo(b[0] + 3, b[1] + 5); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
      });
    } else if (k === 'stall') {
      [-30, 30].forEach(function (x) { rr(x - 3, -66, 6, 64, 2); g.fillStyle = '#c98b4f'; g.fill(); o(2); });
      for (var i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-38 + i * 15.2, -62); g.lineTo(-38 + (i + 1) * 15.2, -62); g.lineTo(-38 + (i + 1) * 15.2, -50); g.quadraticCurveTo(-38 + (i + 0.5) * 15.2, -44, -38 + i * 15.2, -50); g.closePath(); g.fillStyle = i % 2 ? '#fff' : '#e2533f'; g.fill(); o(2); }
      g.beginPath(); g.moveTo(-40, -62); g.lineTo(0, -80); g.lineTo(40, -62); g.closePath(); g.fillStyle = '#e2533f'; g.fill(); o(2.5);
      rr(-36, -30, 72, 28, 4); g.fillStyle = '#e9b97a'; g.fill(); o();
      [[-20, '#e2402f'], [-4, '#f08a24'], [12, '#74c94e'], [26, '#8657c9']].forEach(function (f) { g.beginPath(); g.arc(f[0], -34, 6.5, 0, Math.PI * 2); g.fillStyle = f[1]; g.fill(); o(2); });
    }
  }
  var upCache = {};
  function upUrl(k, size) {
    var key = k + size;
    if (upCache[key]) return upCache[key];
    var d = Math.min(3, window.devicePixelRatio || 1), c = document.createElement('canvas'); c.width = Math.round(size * d); c.height = Math.round(size * d);
    var g = c.getContext('2d'); g.scale(d, d); g.translate(size / 2, size * 0.92); g.scale(size / 100, size / 100); drawUp(g, k, 0.7);
    return (upCache[key] = c.toDataURL());
  }
  function plural(n, one, few, many) {
    if (n === 1) return one;
    var d = n % 10, dd = n % 100;
    return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? few : many;
  }

  // ---------- catalogue ----------
  // h: hours of watered growth needed. type: drawing archetype.
  var PLANTS = [
    { k: 'rzezucha', n: 'rzeżucha', lv: 1, price: 15, h: 1 / 3, type: 'cress', fast: 1 },
    { k: 'szczypiorek', n: 'szczypiorek', lv: 1, price: 20, h: 1, type: 'chives', pc: '#c58ae0', fast: 1 },
    { k: 'rzodkiewka', n: 'rzodkiewka', lv: 1, price: 25, h: 2, type: 'root', shape: 'round', fc: '#e2405a', fast: 1 },
    { k: 'slonecznik', n: 'słonecznik', lv: 1, price: 5, pet: 1, h: 24, type: 'flower', head: 'sun', tall: 1, pc: '#f7c51e', cc: '#8a5428' },
    { k: 'marchewka', n: 'marchewka', lv: 2, price: 5, pet: 1, h: 24, type: 'root', shape: 'long', fc: '#f08a24' },
    { k: 'kwiatek', n: 'kwiatek', lv: 3, price: 35, h: 30, type: 'flower', head: 'round', tall: 0.55, pc: '#f47fb0', cc: '#f7d23a' },
    { k: 'salata', n: 'sałata', lv: 4, price: 5, pet: 1, h: 30, type: 'leafy' },
    { k: 'pomidor', n: 'pomidor', lv: 5, price: 45, h: 48, type: 'bush', fruit: 'round', fc: '#e2402f', fl: '#f7d23a' },
    { k: 'truskawka', n: 'truskawka', lv: 6, price: 45, h: 40, type: 'low', fc: '#e8344a' },
    { k: 'tulipan', n: 'tulipan', lv: 7, price: 40, h: 36, type: 'flower', head: 'cup', tall: 0.7, pc: '#ec4f7a' },
    { k: 'kukurydza', n: 'kukurydza', lv: 8, price: 50, h: 54, type: 'corn' },
    { k: 'groszek', n: 'groszek', lv: 9, price: 45, h: 42, type: 'bush', fruit: 'pod', fc: '#74c94e', fl: '#ffffff' },
    { k: 'winogrono', n: 'winogrono', lv: 10, price: 5, pet: 1, h: 60, type: 'vine', fruit: 'grapes', fc: '#8657c9', fl: '#c8e07a' },
    { k: 'dynia', n: 'dynia', lv: 11, price: 60, h: 60, type: 'pumpkin', fc: '#f08a24' },
    { k: 'papryka', n: 'papryka', lv: 12, price: 55, h: 48, type: 'bush', fruit: 'pepper', fc: '#f6c21b', fl: '#ffffff' },
    { k: 'lawenda', n: 'lawenda', lv: 13, price: 55, h: 42, type: 'spike', pc: '#9a72d8' },
    { k: 'ogorek', n: 'ogórek', lv: 14, price: 50, h: 44, type: 'vine', fruit: 'cucumber', fc: '#3f9a45', fl: '#f7d23a' },
    { k: 'mak', n: 'mak', lv: 15, price: 60, h: 48, type: 'flower', head: 'poppy', tall: 0.8, pc: '#e23a2f', cc: '#2a2333' },
    { k: 'baklazan', n: 'bakłażan', lv: 16, price: 60, h: 54, type: 'bush', fruit: 'eggplant', fc: '#6a3d9a', fl: '#c9a6f0' },
    { k: 'roza', n: 'róża', lv: 17, price: 70, h: 60, type: 'flower', head: 'rose', tall: 0.85, pc: '#e0315b', rare: 1 },
    { k: 'lilia', n: 'lilia', lv: 18, price: 70, h: 66, type: 'flower', head: 'lily', tall: 0.9, pc: '#fde3ef', cc: '#f08a24', rare: 1 },
    { k: 'storczyk', n: 'storczyk', lv: 19, price: 75, h: 72, type: 'orchid', pc: '#d77be0', rare: 1 },
    { k: 'teczowy', n: 'tęczowy kwiat', lv: 20, price: 75, h: 72, type: 'flower', head: 'rainbow', tall: 0.9, rare: 1 }
  ];
  var BY = {};
  PLANTS.forEach(function (p) { BY[p.k] = p; });
  var FROM = { trojki: 'z Grządkowych trójek', 'Grządkowe trójki': 'z Grządkowych trójek', rury: 'z Rur do ogródka', 'Rury do ogródka': 'z Rur do ogródka' };

  // ---------- dates ----------
  function dstr(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function today() { return dstr(new Date()); }
  var dayCache = {};
  function dayRange(s) {
    var r = dayCache[s];
    if (!r) { var p = s.split('-'); r = dayCache[s] = [new Date(+p[0], p[1] - 1, +p[2]).getTime(), new Date(+p[0], p[1] - 1, +p[2] + 1).getTime()]; }
    return r;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hexMix(a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
    var g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
    var bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }

  // ---------- plant drawing (units: plant max height ~100, base at 0,0, up is -y) ----------
  var G, U, D, LEAF, LEAF2, STEMC, TT;
  function path(fn, fill, noStroke) {
    G.beginPath(); fn();
    if (fill) { G.fillStyle = fill; G.fill(); }
    if (!noStroke) { G.lineWidth = U; G.strokeStyle = INK; G.stroke(); }
  }
  function circ(x, y, r, fill, ns) { path(function () { G.arc(x, y, r, 0, Math.PI * 2); }, fill, ns); }
  function ell(x, y, rx, ry, rot, fill, ns) { path(function () { G.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); }, fill, ns); }
  function shine(x, y, r) { G.beginPath(); G.arc(x, y, r, 0, Math.PI * 2); G.fillStyle = 'rgba(255,255,255,.55)'; G.fill(); }
  function leaf(x, y, ang, len, wid, fill) {
    G.save(); G.translate(x, y); G.rotate(ang);
    path(function () { G.moveTo(0, 0); G.quadraticCurveTo(len * 0.45, -wid, len, 0); G.quadraticCurveTo(len * 0.45, wid, 0, 0); }, fill);
    G.beginPath(); G.moveTo(len * 0.12, 0); G.lineTo(len * 0.78, 0);
    G.strokeStyle = 'rgba(255,255,255,.45)'; G.lineWidth = U * 0.8; G.stroke();
    G.restore();
  }
  function softLeaf(x, y, ang, len, wid, fill) {
    G.save(); G.translate(x, y); G.rotate(ang);
    G.beginPath(); G.moveTo(0, 0); G.quadraticCurveTo(len * 0.45, -wid, len, 0); G.quadraticCurveTo(len * 0.45, wid, 0, 0);
    G.fillStyle = fill; G.fill(); G.lineWidth = U * 0.7; G.strokeStyle = '#2f7a34'; G.stroke();
    G.restore();
  }
  function bead(x, y, r, fill, edge) { G.beginPath(); G.arc(x, y, r, 0, Math.PI * 2); G.fillStyle = fill; G.fill(); G.lineWidth = U * 0.7; G.strokeStyle = edge; G.stroke(); }
  function stem(x0, y0, cx, cy, x1, y1, w, col) {
    G.lineCap = 'round';
    G.beginPath(); G.moveTo(x0, y0); G.quadraticCurveTo(cx, cy, x1, y1);
    G.strokeStyle = INK; G.lineWidth = w + U * 2; G.stroke();
    G.strokeStyle = col || STEMC; G.lineWidth = w; G.stroke();
  }
  function qpt(x0, y0, cx, cy, x1, y1, t) { var a = 1 - t; return [a * a * x0 + 2 * a * t * cx + t * t * x1, a * a * y0 + 2 * a * t * cy + t * t * y1]; }
  function dl(ang) { return ang + D * 0.6 * (Math.cos(ang) >= 0 ? 1 : -1); }
  function star5(x, y, r, fill) {
    path(function () {
      for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; G.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      G.closePath();
    }, fill);
  }
  function smallFlower(x, y, r, fill) {
    for (var i = 0; i < 5; i++) { var a = i * Math.PI * 2 / 5; circ(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 0.55, fill); }
    circ(x, y, r * 0.4, '#f7d23a');
  }
  function face(x, y, s) {
    G.fillStyle = INK;
    G.beginPath(); G.arc(x - 3 * s, y - 1 * s, 1.3 * s, 0, 7); G.arc(x + 3 * s, y - 1 * s, 1.3 * s, 0, 7); G.fill();
    G.beginPath(); G.lineWidth = U; G.strokeStyle = INK;
    if (D > 0.3) G.arc(x, y + 4.5 * s, 2.6 * s, -Math.PI * 0.85, -Math.PI * 0.15);
    else G.arc(x, y + 1.2 * s, 2.6 * s, Math.PI * 0.15, Math.PI * 0.85);
    G.stroke();
    G.fillStyle = 'rgba(240,110,130,.45)';
    G.beginPath(); G.arc(x - 5 * s, y + 2 * s, 1.5 * s, 0, 7); G.arc(x + 5 * s, y + 2 * s, 1.5 * s, 0, 7); G.fill();
  }

  function seedStage(f) {
    ell(0, 0, 11, 4.5, 0, '#6e4527', true);
    G.save(); G.translate(0, -1.5 - f * 1.5); G.rotate(-0.3 + Math.sin(TT * 2) * 0.05 * f);
    ell(0, 0, 4.5, 3, 0, '#d9b07a');
    if (f > 0.6) { G.beginPath(); G.moveTo(-1, -2.5); G.lineTo(0.5, -0.5); G.lineTo(-0.5, 1); G.strokeStyle = INK; G.lineWidth = U * 0.8; G.stroke(); }
    G.restore();
  }
  function sprout(f) {
    var h = 8 + 16 * f, tx = D * h * 0.4, ty = -h * (1 - 0.2 * D);
    stem(0, 0, 0, -h * 0.5, tx, ty, 2.4);
    var L = 7 + 6 * f;
    leaf(tx, ty, dl(-Math.PI * 0.86), L, 4.5, LEAF);
    leaf(tx, ty, dl(-Math.PI * 0.14), L, 4.5, LEAF2);
  }

  function fruitAt(kind, x, y, s, col) {
    G.save(); G.translate(x, y); G.scale(s, s);
    if (kind === 'round') {
      circ(0, 7, 7, col); shine(-2.5, 4.5, 1.8);
      star5(0, 0.8, 3.2, '#3f9a3f');
    } else if (kind === 'pod') {
      ell(0, 9, 3.6, 9.5, 0.15, col);
      G.fillStyle = 'rgba(29,47,111,.18)'; [3, 8, 13].forEach(function (yy) { G.beginPath(); G.arc(0.2 + yy * 0.12, yy + 1, 1.8, 0, 7); G.fill(); });
    } else if (kind === 'pepper') {
      path(function () { G.moveTo(-6, 2); G.quadraticCurveTo(-8.5, 14, -2.5, 16); G.quadraticCurveTo(0, 13.5, 2.5, 16); G.quadraticCurveTo(8.5, 14, 6, 2); G.quadraticCurveTo(0, -1, -6, 2); }, col);
      shine(-3, 6, 1.6);
      path(function () { G.moveTo(-3, 2); G.lineTo(3, 2); G.lineTo(0, -3); G.closePath(); }, '#3f9a3f');
    } else if (kind === 'eggplant') {
      ell(0, 12, 6, 11, 0.12, col); shine(-2.5, 8, 1.6);
      star5(0, 2, 4, '#3f9a3f');
    } else if (kind === 'berry') {
      path(function () { G.moveTo(0, 13); G.quadraticCurveTo(-8, 6, -5.5, 1.5); G.quadraticCurveTo(0, -1, 5.5, 1.5); G.quadraticCurveTo(8, 6, 0, 13); }, col);
      G.fillStyle = '#ffe58a'; [[-2.5, 4], [2.5, 4], [0, 7], [-3, 8.5], [3, 8.5], [0, 10.5]].forEach(function (p) { G.beginPath(); G.arc(p[0], p[1], 0.8, 0, 7); G.fill(); });
      star5(0, 1, 3.4, '#3f9a3f');
    } else if (kind === 'cucumber') {
      ell(0, 11, 3.8, 11, 0.1, col);
      G.fillStyle = 'rgba(255,255,255,.5)'; [[-1, 5], [1.2, 9], [-1, 13], [1, 17]].forEach(function (p) { G.beginPath(); G.arc(p[0], p[1], 0.8, 0, 7); G.fill(); });
    } else if (kind === 'grapes') {
      var rows = [4, 3, 3, 2, 1], yy = 3;
      rows.forEach(function (n, ri) { for (var i = 0; i < n; i++) { var xx = (i - (n - 1) / 2) * 5.6; circ(xx, yy, 3.3, col); shine(xx - 1, yy - 1.2, 0.9); } yy += 4.6; void ri; });
      path(function () { G.moveTo(0, 0); G.lineTo(0, -3); }, null);
    }
    G.restore();
  }
  // green unripe fruit for the bud stage
  function unripe(kind, x, y, s) { fruitAt(kind, x, y, s * 0.55, kind === 'eggplant' ? '#9bd27a' : '#8fd06b'); }

  var TYPES = {
    root: function (P, p, sz, bud, ready) {
      var r = ready ? 1 : bud >= 0 ? 0.15 + bud * 0.55 : 0;
      var top = 0;
      if (r > 0) {
        if (P.shape === 'round') {
          var rr = 4 + 10 * r;
          ell(0, -rr * 0.55, rr, rr * 0.88, 0, P.fc); shine(-rr * 0.35, -rr * 0.85, rr * 0.18);
          path(function () { G.moveTo(-rr * 0.3, rr * 0.25); G.quadraticCurveTo(0, rr * 0.5, rr * 0.3, rr * 0.25); }, '#fff', true);
          top = -rr * 1.3;
        } else {
          var w = 3.5 + 5 * r, hh = 3 + 9 * r;
          path(function () { G.moveTo(-w, 1); G.lineTo(-w * 0.95, -hh + w * 0.6); G.quadraticCurveTo(0, -hh - w * 0.5, w * 0.95, -hh + w * 0.6); G.lineTo(w, 1); G.closePath(); }, P.fc);
          G.strokeStyle = 'rgba(29,47,111,.35)'; G.lineWidth = U * 0.8;
          for (var i = 1; i < 3; i++) { G.beginPath(); G.moveTo(-w * 0.7, -hh * i / 3); G.lineTo(-w * 0.15, -hh * i / 3 + 1); G.stroke(); }
          top = -hh;
        }
      }
      var n = 5, L = 18 + 26 * sz;
      for (var j = 0; j < n; j++) {
        var a = -Math.PI / 2 + (j - (n - 1) / 2) * 0.36, len = L * (j % 2 ? 0.82 : 1), col = j % 2 ? LEAF2 : LEAF;
        var sway = Math.sin(TT * 1.6 + j) * 0.04;
        if (P.shape === 'long') {
          var aa = dl(a) + sway, ex = Math.cos(aa) * len, ey = top + Math.sin(aa) * len;
          stem(0, top, ex * 0.5, top + (ey - top) * 0.5, ex, ey, 1.6, col);
          for (var t = 0.4; t < 1; t += 0.28) { var px = ex * t, py = top + (ey - top) * t; softLeaf(px, py, aa - 0.8, 6 * sz + 3, 2.8, col); softLeaf(px, py, aa + 0.8, 6 * sz + 3, 2.8, col); }
          softLeaf(ex, ey, aa, 6 * sz + 3, 3, col);
        } else leaf(0, top, dl(a) + sway, len, 6 + 3 * sz, col);
      }
    },
    flower: function (P, p, sz, bud, ready) {
      var Ht = (34 + 54 * (P.tall || 0.7)) * sz;
      var tx = D * Ht * 0.3, ty = -Ht * (1 - 0.2 * D), cx = D * Ht * 0.05, cy = -Ht * 0.55;
      stem(0, 0, cx, cy, tx, ty, 3);
      var big = P.head === 'sun' ? 1.35 : 1;
      var p1 = qpt(0, 0, cx, cy, tx, ty, 0.3), p2 = qpt(0, 0, cx, cy, tx, ty, 0.52);
      leaf(p1[0], p1[1], dl(-0.45) + Math.sin(TT * 1.5) * 0.05, (12 + 10 * sz) * big, 6 * big, LEAF);
      leaf(p2[0], p2[1], dl(-Math.PI + 0.5) + Math.sin(TT * 1.5 + 1) * 0.05, (11 + 9 * sz) * big, 5.5 * big, LEAF2);
      G.save(); G.translate(tx, ty); G.rotate(D * 0.9 + Math.sin(TT * 1.2) * 0.04);
      if (ready) flowerHead(P);
      else if (bud >= 0) {
        var s = 3.5 + 5 * bud;
        path(function () { G.moveTo(0, 2); G.quadraticCurveTo(-s, -s * 0.6, 0, -s * 1.8); G.quadraticCurveTo(s, -s * 0.6, 0, 2); }, bud > 0.45 ? hexMix('#7cc95a', P.pc || '#f47fb0', (bud - 0.45) * 1.6) : '#7cc95a');
        leaf(0, 1, -Math.PI * 0.75, s * 0.9, 2, LEAF2); leaf(0, 1, -Math.PI * 0.25, s * 0.9, 2, LEAF2);
      }
      G.restore();
    },
    spike: function (P, p, sz, bud, ready) {
      for (var b = 0; b < 4; b++) leaf(0, 0, dl(-Math.PI / 2 + (b - 1.5) * 0.55), 12 + 8 * sz, 2.6, b % 2 ? LEAF2 : '#7fae8a');
      for (var i = 0; i < 5; i++) {
        var a = (i - 2) * 0.16 + Math.sin(TT * 1.4 + i) * 0.03, Ht = (40 + 26 * sz) * (i % 2 ? 0.86 : 1);
        var tx = Math.sin(a) * Ht + D * Ht * 0.3, ty = -Math.cos(a) * Ht * (1 - 0.2 * D);
        stem(0, 0, tx * 0.3, ty * 0.5, tx, ty, 1.6, '#6f9a6a');
        if (bud >= 0 || ready) {
          var col = ready ? P.pc : hexMix('#a3b89b', P.pc, bud * 0.7), n = ready ? 7 : 3 + Math.floor(bud * 4);
          for (var j = 0; j < n; j++) {
            var t = 1 - j * 0.07, px = tx * 0.3 * 2 * (1 - t) * t + tx * t * t, py = ty * 0.5 * 2 * (1 - t) * t + ty * t * t;
            bead(px + (j % 2 ? 1.8 : -1.8), py, ready ? 2.5 : 1.8, col, ready ? '#5b3f9a' : '#6f8a68');
          }
        }
      }
    },
    leafy: function (P, p, sz, bud, ready) {
      var n = 7, L = 16 + 16 * sz;
      for (var i = 0; i < n; i++) {
        var a = -Math.PI + (i + 0.5) * Math.PI / n, col = i % 2 ? '#5fb34a' : '#7cc95a';
        leaf(0, -1, dl(a) + Math.sin(TT * 1.3 + i) * 0.03, L * (Math.abs(i - 3) === 3 ? 0.8 : 1), 9 + 5 * sz, D ? hexMix(col, '#b5a957', D * 0.45) : col);
      }
      if (bud >= 0 || ready) {
        var r = ready ? 1 : 0.4 + bud * 0.5;
        ell(0, -10 * r - 3, 12 * r + 2, 10 * r + 2, 0, D ? hexMix('#c3ea8e', '#d8cf8a', D * 0.45) : '#c3ea8e');
        G.strokeStyle = 'rgba(63,154,63,.7)'; G.lineWidth = U;
        G.beginPath(); G.arc(-3 * r, -10 * r - 3, 6 * r, -2.4, -0.6); G.stroke();
        G.beginPath(); G.arc(3 * r, -8 * r - 2, 5 * r, -2.2, -0.4); G.stroke();
        if (ready) { leaf(-2, -2, dl(-Math.PI * 0.8), 18, 9, '#93d66a'); leaf(2, -2, dl(-Math.PI * 0.2), 18, 9, '#93d66a'); }
      }
    },
    bush: function (P, p, sz, bud, ready) {
      var Ht = 60 * sz, tx = D * Ht * 0.25, ty = -Ht * (1 - 0.15 * D), cx = 3, cy = -Ht * 0.5;
      stem(0, 0, cx, cy, tx, ty, 3);
      var spots = [[0.28, 1], [0.45, -1], [0.62, 1], [0.8, -1], [0.95, 1]];
      var fruits = [];
      spots.forEach(function (s, i) {
        var pt = qpt(0, 0, cx, cy, tx, ty, s[0]), side = s[1], sw = Math.sin(TT * 1.4 + i) * 0.05;
        var bx = pt[0] + side * (8 + 6 * sz), by = pt[1] - 3;
        stem(pt[0], pt[1], pt[0] + side * 4, pt[1] - 4, bx, by, 1.8);
        leaf(bx, by, dl(side > 0 ? -0.35 : -Math.PI + 0.35) + sw, 10 + 7 * sz, 5, i % 2 ? LEAF2 : LEAF);
        if (i < 4) fruits.push([pt[0] + side * (5 + 4 * sz), pt[1] + 1]);
      });
      leaf(tx, ty, dl(-Math.PI / 2) + Math.sin(TT * 1.4) * 0.05, 9 + 4 * sz, 4.5, LEAF);
      var cnt = { round: 4, pod: 4, pepper: 3, eggplant: 2 }[P.fruit] || 3;
      var order = P.fruit === 'eggplant' ? [0, 2] : P.fruit === 'pepper' ? [0, 1, 2] : [0, 1, 2, 3];
      order.slice(0, cnt).forEach(function (fi) {
        var f = fruits[fi]; if (!f) return;
        if (ready) fruitAt(P.fruit, f[0], f[1], P.fruit === 'eggplant' ? 1.05 : 0.95, P.fc);
        else if (bud >= 0) { if (bud < 0.5) smallFlower(f[0], f[1] + 2, 2 + bud * 3, P.fl); else unripe(P.fruit, f[0], f[1], 0.6 + bud * 0.5); }
      });
    },
    low: function (P, p, sz, bud, ready) {
      var stalks = [-2.3, -1.6, -1.15, -0.5];
      stalks.forEach(function (a0, i) {
        var a = dl(a0 + (a0 < -1.57 ? 0 : 0)) + Math.sin(TT * 1.5 + i) * 0.04, L = 14 + 14 * sz;
        var ex = Math.cos(a) * L, ey = Math.sin(a) * L;
        stem(0, 0, ex * 0.4, ey * 0.7, ex, ey, 1.6);
        [-0.7, 0, 0.7].forEach(function (o, j) { ell(ex + Math.cos(a + o) * 4.5, ey + Math.sin(a + o) * 4.5, 5 + 2 * sz, 3.5 + 1.5 * sz, a + o, j === 1 ? LEAF : LEAF2); });
      });
      var spots = [[-15, -6], [13, -5], [2, -14]];
      spots.forEach(function (s) {
        if (ready) fruitAt('berry', s[0], s[1], 1, P.fc);
        else if (bud >= 0) { if (bud < 0.5) smallFlower(s[0], s[1] + 3, 3 + bud * 2, '#ffffff'); else unripe('berry', s[0], s[1] + 2, 1); }
      });
    },
    vine: function (P, p, sz, bud, ready) {
      var poleH = 74;
      path(function () { G.rect(-2, -poleH, 4, poleH + 2); }, '#c98b4f');
      var Ht = poleH * (0.25 + 0.75 * sz);
      G.lineCap = 'round';
      G.beginPath(); G.moveTo(0, 0);
      for (var y = 0; y <= Ht; y += 3) G.lineTo(Math.sin(y * 0.18) * 5 + D * y * 0.1, -y);
      G.strokeStyle = INK; G.lineWidth = 2.6 + U * 2; G.stroke(); G.strokeStyle = STEMC; G.lineWidth = 2.6; G.stroke();
      var n = Math.floor(2 + 5 * sz);
      for (var i = 0; i < n; i++) {
        var yy = Ht * (i + 0.6) / (n + 0.2), side = i % 2 ? -1 : 1, xx = Math.sin(yy * 0.18) * 5;
        var a = dl(side > 0 ? -0.25 : -Math.PI + 0.25) + Math.sin(TT * 1.3 + i) * 0.05;
        leaf(xx, -yy, a, 12 + 5 * sz, 7, i % 2 ? LEAF2 : LEAF);
      }
      var spots = P.fruit === 'grapes' ? [[11, 0.5], [-11, 0.78]] : [[10, 0.35], [-10, 0.6], [9, 0.85]];
      spots.forEach(function (s) {
        var yy = -Ht * s[1], xx = s[0];
        if (ready) fruitAt(P.fruit, xx, yy, 1, P.fc);
        else if (bud >= 0) { if (bud < 0.5) smallFlower(xx, yy + 2, 2.5 + bud * 2, P.fl); else unripe(P.fruit, xx, yy, 1); }
      });
    },
    corn: function (P, p, sz, bud, ready) {
      var Ht = 92 * sz, tx = D * Ht * 0.2, ty = -Ht * (1 - 0.12 * D);
      stem(0, 0, 0, -Ht * 0.5, tx, ty, 4.4, '#79b84d');
      [0.18, 0.34, 0.5, 0.66, 0.8].forEach(function (t, i) {
        var pt = qpt(0, 0, 0, -Ht * 0.5, tx, ty, t), side = i % 2 ? -1 : 1, L = (26 - i * 2) * (0.6 + 0.4 * sz);
        G.save(); G.translate(pt[0], pt[1]);
        var a = dl(side > 0 ? -0.55 : -Math.PI + 0.55) + Math.sin(TT * 1.3 + i) * 0.05;
        G.rotate(a);
        path(function () { G.moveTo(0, -1.5); G.quadraticCurveTo(L * 0.5, -6, L, 4 + D * 4); G.quadraticCurveTo(L * 0.5, -1, 0, 2); G.closePath(); }, i % 2 ? LEAF2 : LEAF);
        G.restore();
      });
      if (bud >= 0 || ready) {
        G.strokeStyle = '#c9a23a'; G.lineWidth = 1.4; G.lineCap = 'round';
        for (var j = -2; j <= 2; j++) { G.beginPath(); G.moveTo(tx, ty); G.quadraticCurveTo(tx + j * 3, ty - 6, tx + j * 4.5, ty - 4 + Math.abs(j) * 2); G.stroke(); }
        var cobs = ready ? [[0.45, 1], [0.6, -1]] : bud > 0.5 ? [[0.45, 1]] : [];
        cobs.forEach(function (c) {
          var pt = qpt(0, 0, 0, -Ht * 0.5, tx, ty, c[0]), s = ready ? 1 : 0.6;
          G.save(); G.translate(pt[0] + c[1] * 4, pt[1]); G.rotate(c[1] * 0.45); G.scale(s, s);
          ell(0, -9, 4.5, 10, 0, ready ? '#f7d23a' : '#cfe68a');
          if (ready) { G.fillStyle = 'rgba(200,140,20,.45)'; for (var yy = -16; yy < -2; yy += 3) for (var xx = -2.4; xx <= 2.4; xx += 2.4) { G.beginPath(); G.arc(xx, yy, 0.8, 0, 7); G.fill(); } }
          leaf(0, 1, -Math.PI / 2 - 0.35, 14, 3.5, '#8fcf62'); leaf(0, 1, -Math.PI / 2 + 0.35, 14, 3.5, '#6fb84f');
          G.restore();
        });
      }
    },
    pumpkin: function (P, p, sz, bud, ready) {
      G.lineCap = 'round';
      G.beginPath(); G.moveTo(-26 * sz, -2); G.quadraticCurveTo(0, -8, 26 * sz, -2);
      G.strokeStyle = INK; G.lineWidth = 2.4 + U * 2; G.stroke(); G.strokeStyle = STEMC; G.lineWidth = 2.4; G.stroke();
      var lv = [[-20, -12, -0.5], [18, -14, 0.4], [-2, -22, 0]];
      lv.forEach(function (l, i) {
        var s = 0.55 + 0.45 * sz, x = l[0] * s, y = l[1] * s * (1 - D * 0.3);
        stem(l[0] * s * 0.5, -2, l[0] * s * 0.6, y * 0.5, x, y + 6, 1.6);
        G.save(); G.translate(x, y); G.rotate(l[2] + D * (l[0] < 0 ? -0.4 : 0.4) + Math.sin(TT * 1.3 + i) * 0.04);
        var c = i === 2 ? LEAF : LEAF2;
        circ(-5 * s, 0, 7 * s, c); circ(5 * s, 0, 7 * s, c); circ(0, -4 * s, 7.5 * s, c);
        G.restore();
      });
      if (ready) {
        var x0 = 4, y0 = -11;
        ell(x0, y0, 19, 13, 0, P.fc);
        G.strokeStyle = 'rgba(29,47,111,.45)'; G.lineWidth = U;
        G.beginPath(); G.ellipse(x0, y0, 10, 13, 0, 0, 7); G.stroke();
        G.beginPath(); G.ellipse(x0, y0, 3.5, 13, 0, 0, 7); G.stroke();
        shine(x0 - 11, y0 - 5, 2.2);
        path(function () { G.moveTo(x0 - 1.5, y0 - 12); G.lineTo(x0 + 0.5, y0 - 18); G.lineTo(x0 + 3.5, y0 - 17); G.lineTo(x0 + 2, y0 - 12); G.closePath(); }, '#8a5a33');
      } else if (bud >= 0) {
        if (bud < 0.5) {
          G.save(); G.translate(10, -10); G.rotate(-0.4);
          path(function () { G.moveTo(-3, 0); G.lineTo(-6, -10); G.quadraticCurveTo(0, -13, 6, -10); G.lineTo(3, 0); G.closePath(); }, '#f7c51e');
          G.restore();
        } else ell(8, -6, 5 + bud * 6, 4 + bud * 4, 0, '#8fd06b');
      }
    },
    cress: function (P, p, sz, bud, ready) {
      // a dense tuft of pale stems, each with two little round leaves
      var rows = [[-1, 0.86, LEAF2], [1, 1, LEAF]];
      rows.forEach(function (rw, ri) {
        var n = ri ? 7 : 6;
        for (var i = 0; i < n; i++) {
          var x = ((i - (n - 1) / 2) * 6.2 + rw[0] * 1.6) * (0.65 + 0.35 * sz);
          var h = (12 + 22 * sz) * rw[1] * (0.85 + 0.3 * (((i * 37 + ri * 11) % 7) / 7));
          var sw = Math.sin(TT * 1.6 + i + ri) * 0.8, tx = x * 1.2 + D * h * 0.4 + sw, ty = -h * (1 - 0.25 * D);
          stem(x, 0, x, -h * 0.5, tx, ty, 1.3, '#dcefc4');
          var lr = ready ? 4.4 : 2.6 + 1.6 * Math.max(0, bud);
          ell(tx - lr * 0.85, ty - 0.5, lr, lr * 0.72, -0.4 - D * 0.5, rw[2]);
          ell(tx + lr * 0.85, ty - 0.5, lr, lr * 0.72, 0.4 + D * 0.5, rw[2]);
        }
      });
    },
    chives: function (P, p, sz, bud, ready) {
      // thin hollow blades; purple pom-pom flowers when ready
      var n = 7, tips = [];
      for (var i = 0; i < n; i++) {
        var a = (i - 3) * 0.12 + Math.sin(TT * 1.4 + i) * 0.025, Ht = (34 + 46 * sz) * (1 - Math.abs(i - 3) * 0.08);
        var tx = Math.sin(a) * Ht + D * Ht * 0.35, ty = -Math.cos(a) * Ht * (1 - 0.25 * D), bx = (i - 3) * 1.6;
        stem(bx, 0, bx + tx * 0.3, ty * 0.5, tx, ty, 2.6, i % 2 ? LEAF2 : LEAF);
        tips.push([tx, ty]);
      }
      if (bud >= 0 || ready) {
        [1, 3, 5].forEach(function (ti, j) {
          var tp = tips[ti];
          if (ready) {
            for (var k = 0; k < 9; k++) { var aa = k * Math.PI * 2 / 9; bead(tp[0] + Math.cos(aa) * 3.6, tp[1] - 4 + Math.sin(aa) * 3.6, 2.4, P.pc, '#7a4f9a'); }
            bead(tp[0], tp[1] - 4, 2.6, '#d9a8ee', '#7a4f9a');
          } else if (bud * 3 > j) path(function () { G.moveTo(tp[0], tp[1] + 1); G.quadraticCurveTo(tp[0] - 3.5, tp[1] - 3, tp[0], tp[1] - 8); G.quadraticCurveTo(tp[0] + 3.5, tp[1] - 3, tp[0], tp[1] + 1); }, hexMix('#9bd27a', P.pc, bud * 0.6));
        });
      }
    },
    orchid: function (P, p, sz, bud, ready) {
      ell(-9, -4, 14, 5.5, -0.35 - D * 0.2, LEAF); ell(9, -5, 14, 5.5, 0.35 + D * 0.2, LEAF2);
      var Ht = 70 * sz, ex = 20 * sz + D * 8, ey = -Ht * (1 - 0.18 * D);
      G.lineCap = 'round';
      G.beginPath(); G.moveTo(0, -4); G.quadraticCurveTo(-6, -Ht * 0.9, ex, ey);
      G.strokeStyle = INK; G.lineWidth = 1.8 + U * 2; G.stroke(); G.strokeStyle = '#6f9a4f'; G.lineWidth = 1.8; G.stroke();
      if (bud >= 0 || ready) {
        [0.62, 0.8, 0.97].forEach(function (t, i) {
          var pt = qpt(0, -4, -6, -Ht * 0.9, ex, ey, t);
          if (ready) {
            G.save(); G.translate(pt[0], pt[1] + 6); G.rotate(Math.sin(TT * 1.2 + i) * 0.06 + D * 0.5);
            for (var j = 0; j < 5; j++) { var a = -Math.PI / 2 + j * Math.PI * 2 / 5; ell(Math.cos(a) * 5, Math.sin(a) * 5, 5, 3.4, a, P.pc); }
            ell(0, 2.5, 3, 3.6, 0, '#a43aa8'); circ(0, 0, 1.6, '#f7d23a');
            G.restore();
          } else if (bud * 3 > i) circ(pt[0], pt[1] + 3, 2 + bud * 2, hexMix('#9bd27a', P.pc, bud * 0.8));
        });
      }
    }
  };
  var RAINBOW = ['#e2402f', '#f08a24', '#f7d23a', '#5fbf4a', '#3f86d8', '#5b4fc4', '#b45fd0'];
  function flowerHead(P) {
    var i, a;
    if (P.head === 'sun') {
      for (i = 0; i < 14; i++) { a = i * Math.PI * 2 / 14; ell(Math.cos(a) * 13, Math.sin(a) * 13, 4.5, 8, a + Math.PI / 2, i % 2 ? P.pc : '#fbd64a'); }
      circ(0, 0, 10, P.cc);
      G.fillStyle = 'rgba(255,220,150,.35)';
      for (i = 0; i < 12; i++) { a = i * 2.4; var r = 2 + (i % 4) * 2; G.beginPath(); G.arc(Math.cos(a) * r, Math.sin(a) * r, 0.9, 0, 7); G.fill(); }
      face(0, 0, 1.1);
    } else if (P.head === 'round') {
      for (i = 0; i < 5; i++) { a = -Math.PI / 2 + i * Math.PI * 2 / 5; circ(Math.cos(a) * 6.5, Math.sin(a) * 6.5, 5.6, P.pc); }
      circ(0, 0, 4.2, P.cc); shine(-1.4, -1.4, 1.2);
    } else if (P.head === 'cup') {
      ell(-4.5, -7, 5.2, 9, -0.3, hexMix(P.pc, '#000000', 0.08));
      ell(4.5, -7, 5.2, 9, 0.3, hexMix(P.pc, '#000000', 0.08));
      ell(0, -8, 4.6, 10, 0, P.pc); shine(-1.5, -12, 1.3);
    } else if (P.head === 'poppy') {
      [[-6, -4], [6, -4], [-5, 5], [5, 5]].forEach(function (q) { circ(q[0], q[1], 8, P.pc); });
      circ(0, 0, 4.2, P.cc);
      G.fillStyle = '#2a2333'; for (i = 0; i < 8; i++) { a = i * Math.PI / 4; G.beginPath(); G.arc(Math.cos(a) * 6, Math.sin(a) * 6, 0.9, 0, 7); G.fill(); }
    } else if (P.head === 'rose') {
      leaf(0, 3, Math.PI * 0.15, 8, 3, LEAF2); leaf(0, 3, Math.PI * 0.85, 8, 3, LEAF2);
      circ(0, -4, 11, P.pc);
      G.strokeStyle = 'rgba(120,10,40,.55)'; G.lineWidth = U;
      G.beginPath(); G.arc(0, -4, 7.5, 0.3, 2.9); G.stroke();
      G.beginPath(); G.arc(0, -5, 4.5, 2.6, 6.2); G.stroke();
      G.beginPath(); G.arc(0.5, -4.5, 2, 0, 3.6); G.stroke();
      shine(-5, -9, 1.5);
    } else if (P.head === 'lily') {
      for (i = 0; i < 6; i++) {
        G.save(); G.rotate(i * Math.PI / 3);
        path(function () { G.moveTo(0, 0); G.quadraticCurveTo(6, -8, 0, -17); G.quadraticCurveTo(-6, -8, 0, 0); }, P.pc);
        G.beginPath(); G.moveTo(0, -2); G.lineTo(0, -12); G.strokeStyle = 'rgba(230,90,140,.6)'; G.lineWidth = U; G.stroke();
        G.restore();
      }
      G.strokeStyle = '#6f9a4f'; G.lineWidth = U;
      for (i = 0; i < 5; i++) { a = -Math.PI / 2 + (i - 2) * 0.45; G.beginPath(); G.moveTo(0, 0); G.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); G.stroke(); circ(Math.cos(a) * 8, Math.sin(a) * 8, 1.4, P.cc, true); }
    } else if (P.head === 'rainbow') {
      for (i = 0; i < 7; i++) { a = -Math.PI / 2 + i * Math.PI * 2 / 7; ell(Math.cos(a) * 10, Math.sin(a) * 10, 5.5, 8.5, a + Math.PI / 2, RAINBOW[i]); }
      circ(0, 0, 7.5, '#fff3a8');
      face(0, 0, 0.9);
    }
  }

  // ctx g translated to the plant base. p: progress 0..1, k: px per unit, d: droop 0..1, t: seconds
  function drawPlant(g, P, p, k, d, t, sway) {
    G = g; D = d || 0; TT = t || 0;
    U = clamp(k * 1.7, 1.1, 2.4) / k;
    LEAF = hexMix('#5cbc4b', '#b5a957', D * 0.45);
    LEAF2 = hexMix('#3f9a3f', '#9c8f45', D * 0.45);
    STEMC = hexMix('#4f9f3f', '#9c8f45', D * 0.4);
    g.save(); g.scale(k, k); g.rotate(sway || 0); g.lineJoin = 'round';
    if (p < 0.15) seedStage(p / 0.15);
    else if (p < 0.4) sprout((p - 0.15) / 0.25);
    else {
      var sz = 0.5 + 0.5 * clamp((p - 0.4) / 0.6, 0, 1);
      var bud = p >= 0.7 ? clamp((p - 0.7) / 0.3, 0, 1) : -1;
      TYPES[P.type](P, p, sz, bud, p >= 1);
    }
    g.restore();
  }
  function stageOf(p) { return p >= 1 ? 4 : p >= 0.7 ? 3 : p >= 0.4 ? 2 : p >= 0.15 ? 1 : 0; }
  function stageName(P, s) {
    return ['nasionko', 'kiełek', 'listki', 'pąk', (P.type === 'cress' || P.type === 'chives') ? 'gotowe' : (P.type === 'flower' || P.type === 'spike' || P.type === 'orchid') ? 'kwiat' : (P.type === 'root' || P.type === 'leafy' || P.type === 'corn') ? 'warzywo' : 'owoc'][s];
  }

  // thumbnails (ready plant on a soil mound), cached as data URLs and canvases
  var thumbCache = {};
  function thumbCanvas(P, size, sil) {
    var key = P.k + ':' + size + ':' + (sil ? 1 : 0);
    if (thumbCache[key]) return thumbCache[key];
    var dpr = Math.min(3, window.devicePixelRatio || 1);
    var c = document.createElement('canvas'); c.width = Math.round(size * dpr); c.height = Math.round(size * dpr);
    var g = c.getContext('2d'); g.scale(dpr, dpr);
    g.save(); g.translate(size / 2, size * 0.86);
    g.beginPath(); g.ellipse(0, 0, size * 0.36, size * 0.1, 0, 0, 7); g.fillStyle = '#8a5a33'; g.fill();
    var k = size * 0.78 / 100;
    if (P.type === 'pumpkin' || P.type === 'leafy' || P.type === 'low' || P.type === 'cress') k = size * 1.1 / 100;
    drawPlant(g, P, 1, k, 0, 0.3, 0);
    g.restore();
    if (sil) { g.globalCompositeOperation = 'source-in'; g.fillStyle = '#c3cce0'; g.fillRect(0, 0, size, size); }
    thumbCache[key] = c;
    return c;
  }
  var urlCache = {};
  function thumbUrl(P, size, sil) {
    var key = P.k + ':' + size + ':' + (sil ? 1 : 0);
    if (!urlCache[key]) urlCache[key] = thumbCanvas(P, size, sil).toDataURL();
    return urlCache[key];
  }

  var CSS = [
    '.og{display:flex;flex-direction:column;font-family:var(--hand);color:#1d2f6f;background:#8fd06b}',
    '.og-cv{flex:1;position:relative;min-height:0}',
    '.og-cv canvas{position:absolute;inset:0}',
    '.og-bar{flex:none;display:flex;gap:6px;padding:8px 8px calc(8px + env(safe-area-inset-bottom,0px));background:#fff;border-top:3px solid #1d2f6f}',
    '.og-btn{flex:1;min-width:0;min-height:60px;border:3px solid #1d2f6f;border-radius:16px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;font-size:1.05rem;line-height:1;box-shadow:0 3px 0 #1d2f6f;position:relative;padding:4px 2px}',
    '.og-btn .lb{white-space:nowrap}',
    '.og-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #1d2f6f}',
    '.og-btn svg{width:34px;height:30px;display:block}',
    '.og-btn.full{background:#dff0ff;animation:ogglow 1.6s ease-in-out infinite}',
    '.og-btn.ready{background:#eaf7e2;animation:ogglowg 1.6s ease-in-out infinite}',
    '.og-btn.done{color:#5a6690}',
    '.og-btn .bdg{position:absolute;top:-8px;right:-6px;background:#cf412d;color:#fff;border:2px solid #1d2f6f;border-radius:999px;min-width:24px;height:24px;font-size:.95rem;line-height:20px;padding:0 5px}',
    '.og-btn .bdg.blue{background:#3f86d8}.og-btn .bdg.green{background:#2a8a56}.og-btn .bdg.grey{background:#8a93b0}',
    '.og-btn.bump{animation:ogbump .5s ease}',
    '@keyframes ogglow{50%{box-shadow:0 3px 0 #1d2f6f,0 0 0 5px rgba(63,134,216,.35)}}',
    '@keyframes ogglowg{50%{box-shadow:0 3px 0 #1d2f6f,0 0 0 5px rgba(42,138,86,.35)}}',
    '@keyframes ogbump{40%{transform:scale(1.15)}}',
    '@media (prefers-reduced-motion:reduce){.og-btn.full,.og-btn.ready,.og-btn.bump{animation:none}}',
    '.og-banner{position:absolute;left:12px;right:84px;top:8px;margin:0 auto;width:fit-content;background:#fff;border:2px solid #1d2f6f;border-radius:14px;padding:4px 12px;font-size:1.05rem;text-align:center;box-shadow:0 3px 0 rgba(29,47,111,.2);z-index:2}',
    '.og-banner.shift{left:84px}',
    '.og-chip{position:absolute;left:8px;top:6px;z-index:2;display:flex;align-items:center;gap:3px;background:#fff;border:2px solid #1d2f6f;border-radius:999px;padding:2px 10px 2px 4px;font-size:1.2rem;min-height:36px;color:#1d2f6f;box-shadow:0 2px 0 rgba(29,47,111,.2)}',
    '.og-chip svg{width:28px;height:28px;display:block}',
    '.og-info{position:absolute;left:10px;right:10px;bottom:10px;background:#fff;border:3px solid #1d2f6f;border-radius:18px;padding:10px 12px;display:flex;gap:12px;align-items:center;box-shadow:0 4px 0 rgba(29,47,111,.25);z-index:3;animation:ogup .2s ease}',
    '.og-info img{width:64px;height:64px;flex:none}',
    '.og-info b{font-weight:400;font-size:1.4rem;display:block;line-height:1.05}',
    '.og-info .st{color:#5a6690;font-size:1.05rem}',
    '.og-info .pb{height:12px;border:2px solid #2a8a56;border-radius:9px;margin:4px 0;overflow:hidden;background:#eaf7e2}',
    '.og-info .pb i{display:block;height:100%;background:#5cbc4b}',
    '.og-info .th{color:#3f86d8}',
    '.og-cbtn{display:flex;align-items:center;gap:4px;margin-top:6px;min-height:44px;border:2px solid #1d2f6f;border-radius:12px;background:#f6e7cf;font-size:1.1rem;padding:2px 10px 2px 4px;color:#1d2f6f;box-shadow:0 2px 0 #1d2f6f}',
    '.og-cbtn svg{width:28px;height:28px}',
    '@keyframes ogup{from{transform:translateY(20px);opacity:0}}',
    '.og-sheetw{position:absolute;inset:0;z-index:10;background:rgba(29,47,111,.35);opacity:0;transition:opacity .2s}',
    '.og-sheetw.on{opacity:1}',
    '.og-sheet{position:absolute;left:0;right:0;bottom:0;max-height:86%;display:flex;flex-direction:column;background:#fffdf5;border-top:3px solid #1d2f6f;border-radius:22px 22px 0 0;transform:translateY(100%);transition:transform .25s ease;padding-bottom:env(safe-area-inset-bottom,0px)}',
    '.og-sheetw.on .og-sheet{transform:none}',
    '.og-sh-h{display:flex;align-items:center;gap:8px;padding:10px 12px 6px 16px}',
    '.og-sh-h h3{margin:0;font-weight:400;font-size:1.8rem;flex:1;line-height:1}',
    '.og-sh-h .bal{font-size:1.2rem}.og-sh-h .bal span{color:#e3a008}',
    '.og-x{width:44px;height:44px;border:2px solid #1d2f6f;border-radius:12px;background:#fff;font-size:1.5rem;line-height:1}',
    '.og-tabs{display:flex;gap:6px;padding:0 12px 6px}',
    '.og-tab{flex:1;min-width:0;min-height:44px;border:2px solid #1d2f6f;border-radius:12px;background:#fff;font-size:1.2rem;color:#1d2f6f;padding:0 4px}',
    '.og-tab.on{background:#7a4fc4;color:#fff}',
    '.og-sh-b{overflow-y:auto;touch-action:pan-y;padding:4px 12px 16px;-webkit-overflow-scrolling:touch}',
    '.og-sec{font-size:1.25rem;color:#7a4fc4;margin:10px 4px 4px}',
    '.og-muted{color:#5a6690;font-size:1.05rem;margin:6px 4px;line-height:1.2}',
    '.og-row{display:flex;align-items:center;gap:10px;background:#fff;border:2px solid #d4def0;border-radius:14px;padding:6px 8px;margin:6px 0}',
    '.og-row img{width:56px;height:56px;flex:none}',
    '.og-row .tx{flex:1;min-width:0;line-height:1.1}',
    '.og-row .tx b{font-weight:400;font-size:1.3rem;display:block}',
    '.og-row .tx small{color:#5a6690;font-size:1rem}',
    '.og-up .dots{display:flex;gap:4px;margin:3px 0 2px}.og-up .dots i{width:14px;height:14px;border-radius:50%;border:2px solid #1d2f6f;background:#fff}.og-up .dots i.on{background:#e3a008}',
    '.og-up.top{background:#f3fbe9;border-color:#8fd06b}',
    '.og-sw{display:flex;width:fit-content;align-items:center;gap:6px;margin-top:5px;min-height:34px;border:2px solid #1d2f6f;border-radius:999px;background:#e6e9f2;color:#5a6690;font-size:1rem;padding:0 12px 0 4px}',
    '.og-sw::before{content:"";width:22px;height:22px;border-radius:50%;background:#fff;border:2px solid #1d2f6f}',
    '.og-sw.on{background:#8fd06b;color:#1d2f6f;flex-direction:row-reverse;padding:0 4px 0 12px}',
    '.og-up.off img{filter:grayscale(1);opacity:.6}',
    '.og-row.lock{opacity:.6}.og-row.lock img{filter:grayscale(1)}',
    '.og-row.gift{border-color:#8fd06b;background:#f3fbec}',
    '.og-row.fast{border-color:#9fc3ea}',
    '.og-buy{min-width:84px;min-height:46px;border:3px solid #1d2f6f;border-radius:14px;background:#e3a008;color:#2a1d00;font-size:1.25rem;box-shadow:0 3px 0 #1d2f6f}',
    '.og-buy.free{background:#8fd06b;color:#1d2f6f}',
    '.og-buy[disabled]{background:#e6e9f2;color:#5a6690;box-shadow:none}',
    '.og-buy:active{transform:translateY(2px);box-shadow:0 1px 0 #1d2f6f}',
    '.og-lockt{color:#7a4fc4;font-size:1.05rem;white-space:nowrap}',
    '.og-poor{color:#cf412d;font-size:1.05rem;margin:6px 4px}',
    '.og-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(98px,1fr));gap:8px}',
    '.og-card{background:#fff;border:2px solid #d4def0;border-radius:14px;padding:6px 4px 8px;text-align:center;line-height:1.05;position:relative}',
    '.og-card img{width:76px;height:76px;display:block;margin:0 auto}',
    '.og-card b{font-weight:400;font-size:1.1rem;display:block}',
    '.og-card small{color:#5a6690;font-size:.95rem}',
    '.og-card .cnt{position:absolute;top:4px;right:6px;color:#2a8a56;font-size:1.1rem}',
    '.og-card.have{border-color:#8fd06b}',
    '.og-card.rare.have{border-color:#e3a008;background:#fffbe8}',
    '.og-ord{background:#fff;border:2px solid #d4def0;border-radius:16px;padding:8px 10px;margin:8px 0}',
    '.og-ord.ok{border-color:#8fd06b;background:#f3fbec}',
    '.og-ord .top{display:flex;gap:10px;align-items:center}',
    '.og-ord .an{font-size:2.6rem;line-height:1;flex:none;width:52px;text-align:center}',
    '.og-ord .tx{flex:1;min-width:0;line-height:1.15;font-size:1.25rem}',
    '.og-ord .tx b{font-weight:400;color:#7a4fc4}',
    '.og-ord .its{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0}',
    '.og-ord .it{display:flex;align-items:center;gap:2px;font-size:1.15rem;border:2px solid #d4def0;border-radius:12px;padding:0 8px 0 2px;background:#fff}',
    '.og-ord .it img{width:40px;height:40px}',
    '.og-ord .it.ok{border-color:#8fd06b;color:#2a8a56}',
    '.og-ord .act{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap}',
    '.og-ord .rw{color:#b07800;font-size:1.15rem;margin-right:auto}',
    '.og-no{min-height:44px;border:2px solid #1d2f6f;border-radius:12px;background:#fff;font-size:1.05rem;padding:0 10px;color:#5a6690}'
  ].join('');

  function svgCan(full) {
    return '<svg viewBox="0 0 40 34" aria-hidden="true"><path d="M8 12 h18 v16 a3 3 0 0 1 -3 3 h-12 a3 3 0 0 1 -3 -3 z" fill="' + (full ? '#9fc3ea' : '#e6e9f2') + '" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/>' +
      (full ? '<path d="M9 19 h16 v8 a3 3 0 0 1 -3 3 h-10 a3 3 0 0 1 -3 -3 z" fill="#3f86d8"/>' : '') +
      '<path d="M26 16 l9 -7 l2 2 l-9 9" fill="#9fc3ea" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/><path d="M11 12 q6 -9 12 0" fill="none" stroke="#1d2f6f" stroke-width="2.5"/>' +
      (full ? '<path d="M37 14 v4 M34 16 v5" stroke="#3f86d8" stroke-width="2" stroke-linecap="round"/>' : '') + '</svg>';
  }
  var SVG_SEED = '<svg viewBox="0 0 40 34" aria-hidden="true"><path d="M8 6 h24 l-2 24 h-20 z" fill="#f6dfb0" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/><path d="M20 26 v-8 M20 20 q-5 -1 -6 -6 q5 0 6 6 M20 18 q5 -1 6 -6 q-5 0 -6 6" fill="#5cbc4b" stroke="#2a8a56" stroke-width="2"/></svg>';
  var SVG_BOOK = '<svg viewBox="0 0 40 34" aria-hidden="true"><path d="M5 6 q8 -3 15 2 q7 -5 15 -2 v22 q-8 -3 -15 2 q-7 -5 -15 -2 z" fill="#fff" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/><path d="M20 8 v22" stroke="#1d2f6f" stroke-width="2"/><circle cx="12" cy="15" r="3.5" fill="#f47fb0"/><path d="M12 19 v5" stroke="#2a8a56" stroke-width="2"/><path d="M26 22 q3 -8 6 -8 q-1 6 -6 8" fill="#5cbc4b"/></svg>';
  var SVG_BASKET = '<svg viewBox="0 0 40 34" aria-hidden="true"><path d="M11 15 q9 -14 18 0" fill="none" stroke="#1d2f6f" stroke-width="2.5"/><circle cx="15" cy="13" r="4.5" fill="#e2402f" stroke="#1d2f6f" stroke-width="2"/><circle cx="24" cy="12" r="4.5" fill="#f08a24" stroke="#1d2f6f" stroke-width="2"/><path d="M5 15 h30 l-4 15 h-22 z" fill="#e9b97a" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/><path d="M8 20 h24 M10 25 h20" stroke="#b8834a" stroke-width="2"/></svg>';
  var SVG_COMPOST = '<svg viewBox="0 0 30 30" aria-hidden="true"><path d="M7 11 q3 -7 6 -2 q3 -7 6 -1 q3 -5 5 2" fill="#5cbc4b" stroke="#1d2f6f" stroke-width="2"/><path d="M4 12 h22 l-2 14 h-18 z" fill="#8a5a33" stroke="#1d2f6f" stroke-width="2" stroke-linejoin="round"/><path d="M7 17 h16 M8 21 h14" stroke="#5e3b22" stroke-width="1.6"/></svg>';

  function hoursText(ms) {
    var m = Math.ceil(ms / 60000);
    if (m < 60) return 'ok. ' + Math.max(1, m) + ' min';
    var h = Math.round(ms / HOUR);
    if (h < 24) return 'ok. ' + h + ' godz.';
    var d = Math.floor(h / 24), r = h % 24;
    return 'ok. ' + d + (d === 1 ? ' dzień' : ' dni') + (r ? ' i ' + r + ' godz.' : '');
  }
  function growText(P) {
    var h = P.h;
    if (h < 1) return 'rośnie ' + Math.round(h * 60) + ' minut';
    if (h < 24) return 'rośnie ' + h + (h === 1 ? ' godzinę' : h < 5 ? ' godziny' : ' godzin');
    var d = h / 24;
    return 'rośnie ' + (d <= 1 ? '1 dzień' : (Math.round(d * 2) / 2).toString().replace('.', ',') + ' dnia');
  }

  // ---------- decorations (units ~px at scale 1, base centre 0,0, up is -y) ----------
  var DECOS = [
    { k: 'sciezka', n: 'kamienna ścieżka', price: 25, lv: 1, w: 100, h: 16 },
    { k: 'grzybek', n: 'grzybek', price: 30, lv: 1, w: 38, h: 36 },
    { k: 'krasnal', n: 'krasnal', price: 60, lv: 1, w: 34, h: 64 },
    { k: 'plotek', n: 'kolorowy płotek', price: 40, lv: 2, w: 86, h: 36 },
    { k: 'lawka', n: 'ławka', price: 50, lv: 2, w: 72, h: 42 },
    { k: 'latarenka', n: 'latarenka', price: 45, lv: 3, w: 30, h: 66 },
    { k: 'budka', n: 'budka dla ptaków', price: 70, lv: 3, w: 40, h: 96, note: 'częściej przylatują ptaszki' },
    { k: 'taczka', n: 'taczka z kwiatami', price: 80, lv: 4, w: 88, h: 46 },
    { k: 'oczko', n: 'oczko wodne', price: 120, lv: 5, w: 106, h: 32 },
    { k: 'strach', n: 'strach na wróble', price: 90, lv: 6, w: 60, h: 96 },
    { k: 'ul', n: 'ul z pszczołami', price: 100, lv: 7, w: 48, h: 54 },
    { k: 'fontanna', n: 'fontanna', price: 150, lv: 8, w: 66, h: 70 }
  ];
  var DB = {};
  DECOS.forEach(function (d) { DB[d.k] = d; });
  function dline(x0, y0, x1, y1, col, w) { G.beginPath(); G.moveTo(x0, y0); G.lineTo(x1, y1); G.strokeStyle = col || INK; G.lineWidth = w || U; G.lineCap = 'round'; G.stroke(); }
  function dots(list, col) { G.fillStyle = col; list.forEach(function (d) { G.beginPath(); G.arc(d[0], d[1], d[2], 0, 7); G.fill(); }); }
  var DECO_DRAW = {
    sciezka: function () {
      [[-40, -2, 10, 6], [-19, 1, 11, 6.5], [2, -3, 10, 6], [23, 0, 11, 6.5], [43, -3, 8, 5]].forEach(function (s, i) {
        ell(s[0], s[1] - 4, s[2], s[3], i % 2 ? 0.15 : -0.1, i % 2 ? '#c9ccd6' : '#dcdee6');
        G.beginPath(); G.ellipse(s[0] - s[2] * 0.3, s[1] - 4 - s[3] * 0.35, s[2] * 0.35, s[3] * 0.25, 0, 0, 7); G.fillStyle = 'rgba(255,255,255,.65)'; G.fill();
      });
    },
    grzybek: function () {
      path(function () { G.moveTo(-6, 0); G.quadraticCurveTo(-7, -10, -5, -16); G.lineTo(5, -16); G.quadraticCurveTo(7, -10, 6, 0); G.closePath(); }, '#fff6e0');
      path(function () { G.moveTo(-18, -14); G.quadraticCurveTo(-17, -35, 0, -35); G.quadraticCurveTo(17, -35, 18, -14); G.quadraticCurveTo(0, -10, -18, -14); G.closePath(); }, '#e2402f');
      dots([[-9, -22, 2.8], [3, -29, 2.4], [10, -19, 2.2], [-1, -18, 1.8], [-12, -16, 1.4]], '#fff');
    },
    krasnal: function () {
      ell(-6, -2, 6, 3, 0, '#6e4527'); ell(6, -2, 6, 3, 0, '#6e4527');
      path(function () { G.moveTo(-11, -3); G.lineTo(-8, -26); G.lineTo(8, -26); G.lineTo(11, -3); G.closePath(); }, '#3f86d8');
      path(function () { G.rect(-10.2, -10, 20.4, 3.5); }, '#6e4527');
      circ(0, -31, 8, '#f6d2b0');
      path(function () { G.moveTo(-8, -31); G.quadraticCurveTo(-8, -16, 0, -13); G.quadraticCurveTo(8, -16, 8, -31); G.quadraticCurveTo(0, -26, -8, -31); G.closePath(); }, '#ffffff');
      circ(0, -29.5, 2.6, '#f29a9a');
      dots([[-3, -33, 1.2], [3, -33, 1.2]], INK);
      path(function () { G.moveTo(-10, -36); G.quadraticCurveTo(-4, -50, 5, -63); G.quadraticCurveTo(6, -48, 10, -36); G.quadraticCurveTo(0, -39, -10, -36); G.closePath(); }, '#e2402f');
    },
    plotek: function () {
      path(function () { G.rect(-43, -25, 86, 4); G.rect(-43, -12, 86, 4); }, '#fff');
      for (var i = 0; i < 6; i++) {
        var x = -36 + i * 14.4;
        path(function () { G.moveTo(x - 5, 0); G.lineTo(x - 5, -28); G.lineTo(x, -34); G.lineTo(x + 5, -28); G.lineTo(x + 5, 0); G.closePath(); }, RAINBOW[i]);
      }
    },
    lawka: function () {
      path(function () { G.rect(-30, -14, 4, 14); G.rect(26, -14, 4, 14); G.rect(-28, -40, 4, 24); G.rect(24, -40, 4, 24); }, '#8a5a33');
      path(function () { G.rect(-35, -18, 70, 6); }, '#c98b4f');
      path(function () { G.rect(-33, -39, 66, 6); G.rect(-33, -30, 66, 6); }, '#d99a5a');
    },
    latarenka: function (t) {
      path(function () { G.rect(-1.5, -42, 3, 42); }, '#5a6690');
      var gl = G.createRadialGradient(0, -50, 2, 0, -50, 22);
      gl.addColorStop(0, 'rgba(255,226,122,.8)'); gl.addColorStop(1, 'rgba(255,226,122,0)');
      G.fillStyle = gl; G.beginPath(); G.arc(0, -50, 21 + Math.sin(t * 3) * 1.5, 0, 7); G.fill();
      path(function () { G.rect(-7, -58, 14, 16); }, '#ffe27a');
      path(function () { G.moveTo(-10, -58); G.lineTo(0, -66); G.lineTo(10, -58); G.closePath(); }, '#2a8a56');
      path(function () { G.rect(-8, -43, 16, 3); }, '#2a8a56');
    },
    budka: function () {
      path(function () { G.rect(-2.5, -56, 5, 56); }, '#8a5a33');
      path(function () { G.rect(-14, -82, 28, 28); }, '#f3c98a');
      path(function () { G.moveTo(-19, -80); G.lineTo(0, -96); G.lineTo(19, -80); G.closePath(); }, '#cf412d');
      circ(0, -70, 5, '#4a2f1d');
      path(function () { G.rect(-5, -61, 10, 2.5); }, '#8a5a33');
    },
    taczka: function () {
      [[-18, -36, '#f47fb0'], [-4, -40, '#ffd84a'], [10, -35, '#8fc3ff']].forEach(function (f) { stem(f[0], -24, f[0] + 1, -30, f[0], f[1], 1.6, '#4f9f3f'); smallFlower(f[0], f[1], 5, f[2]); });
      dline(-28, -24, -44, -16, INK, 4.5); dline(-28, -24, -44, -16, '#8a5a33', 2.5);
      path(function () { G.moveTo(-32, -26); G.lineTo(24, -26); G.lineTo(15, -9); G.lineTo(-23, -9); G.closePath(); }, '#5fb34a');
      dline(-15, -9, -17, 0, INK, 3);
      circ(21, -8, 8, '#5a6690'); circ(21, -8, 2.5, '#fff');
    },
    oczko: function (t) {
      for (var i = 0; i < 12; i++) { var a = i * Math.PI / 6; ell(Math.cos(a) * 46, -14 + Math.sin(a) * 14, 7, 4.5, a, i % 2 ? '#c9ccd6' : '#b8bcc8'); }
      ell(0, -14, 42, 11.5, 0, '#7ec8f0');
      G.strokeStyle = 'rgba(255,255,255,.75)'; G.lineWidth = U;
      G.beginPath(); G.ellipse(-14, -15, 8 + Math.sin(t * 2) * 2, 2.4, 0, 0, 7); G.stroke();
      ell(14, -12, 9, 4, 0.2, '#5cbc4b');
      smallFlower(16, -14, 4, '#f7a8c8');
    },
    strach: function (t) {
      G.save(); G.rotate(Math.sin(t * 1.2) * 0.025);
      path(function () { G.rect(-2.5, -78, 5, 78); }, '#8a5a33');
      path(function () { G.rect(-29, -62, 58, 5); }, '#8a5a33');
      [-1, 1].forEach(function (sd) { for (var j = -1; j <= 1; j++) dline(sd * 29, -60, sd * 35, -60 + j * 4, '#e8b93a', 2); });
      path(function () { G.rect(-28, -65, 12, 10); G.rect(16, -65, 12, 10); }, '#e2533f');
      path(function () { G.moveTo(-18, -66); G.lineTo(18, -66); G.lineTo(14, -32); G.lineTo(-14, -32); G.closePath(); }, '#e2533f');
      path(function () { G.rect(-9, -52, 8, 8); }, '#3f86d8');
      dline(-18, -46, 18, -46, 'rgba(255,255,255,.5)', 1.5); dline(4, -66, 4, -32, 'rgba(255,255,255,.5)', 1.5);
      circ(0, -74, 10, '#f3d58a');
      dots([[-3.5, -76, 1.4], [3.5, -76, 1.4]], INK);
      G.beginPath(); G.arc(0, -73, 4, 0.2 * Math.PI, 0.8 * Math.PI); G.strokeStyle = INK; G.lineWidth = U; G.stroke();
      ell(0, -83, 18, 4, 0, '#8a5a33');
      path(function () { G.rect(-9, -97, 18, 14); }, '#8a5a33');
      path(function () { G.rect(-9, -88, 18, 3.5); }, '#e2402f');
      G.restore();
    },
    ul: function (t) {
      path(function () { G.rect(-22, -6, 44, 6); }, '#8a5a33');
      path(function () { G.moveTo(-20, -6); G.quadraticCurveTo(-25, -52, 0, -52); G.quadraticCurveTo(25, -52, 20, -6); G.closePath(); }, '#f2c25a');
      G.strokeStyle = 'rgba(138,90,51,.65)'; G.lineWidth = U;
      [[-15, 20.5], [-25, 19.5], [-35, 16.5], [-44, 11]].forEach(function (b) { G.beginPath(); G.moveTo(-b[1], b[0]); G.quadraticCurveTo(0, b[0] + 4, b[1], b[0]); G.stroke(); });
      ell(0, -11, 6, 4.5, 0, '#4a2f1d');
      for (var i = 0; i < 2; i++) {
        var bx = Math.sin(t * 1.7 + i * 3) * 26, by = -40 + Math.cos(t * 2.3 + i) * 12;
        ell(bx - 1.5, by - 3.5, 2.6, 1.8, -0.4, 'rgba(255,255,255,.9)'); ell(bx + 1.5, by - 3.5, 2.6, 1.8, 0.4, 'rgba(255,255,255,.9)');
        ell(bx, by, 4, 2.8, 0, '#ffd84a');
        dline(bx - 0.5, by - 2.5, bx - 0.5, by + 2.5, INK, 1.4);
      }
    },
    fontanna: function (t) {
      path(function () { G.moveTo(-31, -16); G.lineTo(31, -16); G.lineTo(26, 0); G.lineTo(-26, 0); G.closePath(); }, '#dcdee6');
      ell(0, -16, 31, 6, 0, '#7ec8f0');
      path(function () { G.rect(-4, -46, 8, 30); }, '#c9ccd6');
      ell(0, -46, 17, 4.5, 0, '#dcdee6');
      G.lineCap = 'round';
      [-1, 1].forEach(function (sd) {
        G.beginPath(); G.moveTo(0, -52); G.quadraticCurveTo(sd * 14, -68, sd * 24, -19);
        G.strokeStyle = 'rgba(63,134,216,.55)'; G.lineWidth = 3.2; G.stroke();
        for (var k = 0; k < 3; k++) {
          var u = ((t * 0.9 + k / 3 + (sd > 0 ? 0.15 : 0)) % 1), a = 1 - u;
          var px = a * a * 0 + 2 * a * u * sd * 14 + u * u * sd * 24, py = a * a * -52 + 2 * a * u * -68 + u * u * -19;
          G.beginPath(); G.arc(px, py, 1.8, 0, 7); G.fillStyle = '#3f86d8'; G.fill();
        }
      });
      dline(0, -47, 0, -56, 'rgba(63,134,216,.7)', 3);
    }
  };
  function drawDeco(g, DC, s, t) {
    G = g; U = 2 / s; D = 0; TT = t;
    g.save(); g.scale(s, s); g.lineJoin = 'round';
    DECO_DRAW[DC.k](t);
    g.restore();
  }

  // ---------- butterflies and other garden guests ----------
  var BFLY = [
    { k: 'cytrynek', n: 'cytrynek', c: '#f7e04a', c2: '#f0a81e', w: 3 },
    { k: 'bielinek', n: 'bielinek', c: '#ffffff', c2: '#3a3a4a', w: 3 },
    { k: 'modraszek', n: 'modraszek', c: '#8fc3ff', c2: '#3f6fd8', w: 3 },
    { k: 'pawik', n: 'rusałka pawik', c: '#d0533a', c2: '#3f6fd8', eye: 1, w: 2 },
    { k: 'paz', n: 'paź królowej', c: '#f7d36a', c2: '#1d2f6f', stripes: 1, w: 1 },
    { k: 'admiral', n: 'admirał', c: '#2a2333', c2: '#e2402f', band: 1, w: 1 }
  ];
  var BFB = {};
  BFLY.forEach(function (b) { BFB[b.k] = b; });
  function drawBfly(g, B, x, y, s, t, flip, open) {
    G = g; U = 1.4 / s;
    var flap = open ? 1 : 0.3 + 0.7 * Math.abs(Math.sin(t * 8));
    g.save(); g.translate(x, y); g.scale(s * (flip ? -1 : 1), s); g.rotate(0.12); g.lineJoin = 'round';
    g.save(); g.scale(flap, 1);
    [-1, 1].forEach(function (sd) {
      g.save(); g.scale(sd, 1);
      ell(7.5, -4, 8, 6.4, -0.5, B.c);
      // forewing stripes / band: clipped to the wing, its outline stroked again over their ends, and painted before the hindwing so they stay off it
      if (B.stripes || B.band) {
        G.save(); G.beginPath(); G.ellipse(7.5, -4, 8, 6.4, -0.5, 0, 7); G.clip();
        if (B.stripes) { dline(3, -10, 6, 2, B.c2, 1.6); dline(8, -11, 11, 0, B.c2, 1.6); } else dline(4, -1, 13, -9, B.c2, 2.6);
        G.restore(); ell(7.5, -4, 8, 6.4, -0.5, null);
      }
      ell(6, 5.5, 5.4, 4.4, 0.5, B.c);
      if (B.eye) { circ(9, -5, 3, B.c2); circ(9, -5, 1.2, '#f7d23a', true); }
      else if (B.stripes) circ(7, 8, 1.4, '#3f86d8', true);
      else if (B.band) dots([[11.2, -7, 1]], '#fff');
      else dots([[11.2, -6.6, 1.7]], B.c2); // tip spot kept inside the wing outline
      g.restore();
    });
    g.restore();
    ell(0, 0.5, 1.8, 7, 0, INK, true);
    dline(0, -6, 3, -11, INK, U); dline(0, -6, -3, -11, INK, U);
    g.restore();
  }
  function drawSnail(g, x, y, s, t, flip) {
    G = g; U = 1.8 / s;
    var e = Math.sin(t * 2) * 0.8;
    g.save(); g.translate(x, y); g.scale(s * (flip ? -1 : 1), s); g.lineJoin = 'round';
    path(function () { G.moveTo(-14, 0); G.quadraticCurveTo(-4, -3, 8, -2); G.quadraticCurveTo(12, -4, 13, -10); G.quadraticCurveTo(16, -12, 17, -7); G.quadraticCurveTo(18, 0, 10, 0); G.closePath(); }, '#c9d68a');
    dline(13.5, -9, 12 + e, -17, INK, U); dline(15.5, -9, 18 + e, -16, INK, U);
    dots([[12 + e, -17, 1.6], [18 + e, -16, 1.6]], INK);
    circ(-2, -10, 9.5, '#e9a65a');
    G.beginPath();
    for (var a = 0; a < Math.PI * 4; a += 0.2) { var r = 7.5 * (1 - a / (Math.PI * 4.6)); G.lineTo(-2 + Math.cos(a) * r, -10 + Math.sin(a) * r); }
    G.strokeStyle = INK; G.lineWidth = U; G.stroke();
    g.restore();
  }
  function drawWeed(g, x, y, s, t) {
    G = g; U = 1.8 / s;
    g.save(); g.translate(x, y); g.scale(s, s); g.lineJoin = 'round';
    stem(0, 0, 3, -12, 2, -24, 1.6, '#6a9a3a');
    for (var i = 0; i < 5; i++) leaf(0, 0, -Math.PI / 2 + (i - 2) * 0.6 + Math.sin(t * 1.5 + i) * 0.05, 13 + (i % 2) * 4, 4, i % 2 ? '#4e7a2e' : '#6a9a3a');
    for (var j = 0; j < 8; j++) { var a = j * Math.PI / 4; ell(2 + Math.cos(a) * 3.2, -25 + Math.sin(a) * 3.2, 2.4, 1.3, a, '#ffd84a', true); }
    circ(2, -25, 2.6, '#f2b51d');
    g.restore();
  }
  function drawBird(g, x, y, s, t, flip) {
    G = g; U = 1.8 / s;
    var ph = (t * 0.9) % 3, hop = ph < 0.3 ? Math.sin(ph / 0.3 * Math.PI) * 4 : 0, peck = ph > 1.6 && ph < 2 ? 0.35 : 0;
    g.save(); g.translate(x, y - hop * s); g.scale(s * (flip ? -1 : 1), s); g.lineJoin = 'round';
    // outlined legs with little forward-pointing feet; the feet stay on y = 0 and the body sits 3 units higher so the legs show
    G.beginPath(); [[-2.5, -3.6], [2.4, 2.8]].forEach(function (l) { G.moveTo(l[0], -8); G.lineTo(l[1], -0.3); G.moveTo(l[1] - 0.8, 0.2); G.lineTo(l[1], -0.3); G.lineTo(l[1] + 2.2, 0.2); });
    G.lineCap = 'round'; G.lineJoin = 'round'; G.strokeStyle = INK; G.lineWidth = 1.3 + U; G.stroke(); G.strokeStyle = '#e9a04a'; G.lineWidth = 1.3; G.stroke();
    g.translate(0, -3);
    path(function () { G.moveTo(-8, -8); G.lineTo(-18, -13); G.lineTo(-16, -6); G.closePath(); }, '#8a5a33');
    ell(0, -9, 10, 7.5, 0, '#8a5a33');
    ell(4, -8, 6, 5.5, 0, '#f08a24', true);
    ell(-2, -10, 6, 3.8, -0.3, '#6e4527');
    G.save(); G.translate(6, -14); G.rotate(peck);
    circ(1, -3, 6, '#8a5a33');
    ell(3, -1, 3.5, 3, 0, '#f08a24', true);
    dots([[2.5, -4.5, 1.2]], INK);
    path(function () { G.moveTo(6.5, -3.5); G.lineTo(11, -2.5); G.lineTo(6.5, -1.5); G.closePath(); }, '#f2b51d');
    G.restore();
    g.restore();
  }

  // order customers and Polish forms for "chce …": [accusative singular, plural 2-4]
  var ANIMALS = [
    { e: '🦔', n: 'Pani Jeżowa' }, { e: '🐰', n: 'Pan Zając' }, { e: '🐿️', n: 'Pani Wiewiórka' }, { e: '🦆', n: 'Pani Kaczka' },
    { e: '🐭', n: 'Pani Myszka' }, { e: '🐻', n: 'Pan Miś' }, { e: '🐸', n: 'Pan Żabka' }, { e: '🦊', n: 'Pani Lisica' }
  ];
  var FORMS = {
    rzezucha: ['rzeżuchę', 'rzeżuchy'], szczypiorek: ['szczypiorek', 'szczypiorki'], rzodkiewka: ['rzodkiewkę', 'rzodkiewki'],
    slonecznik: ['słonecznik', 'słoneczniki'], marchewka: ['marchewkę', 'marchewki'], kwiatek: ['kwiatek', 'kwiatki'],
    salata: ['sałatę', 'sałaty'], pomidor: ['pomidora', 'pomidory'], truskawka: ['truskawkę', 'truskawki'], tulipan: ['tulipana', 'tulipany'],
    kukurydza: ['kukurydzę', 'kukurydze'], groszek: ['groszek', 'groszki'], winogrono: ['winogrono', 'winogrona'], dynia: ['dynię', 'dynie'],
    papryka: ['paprykę', 'papryki'], lawenda: ['lawendę', 'lawendy'], ogorek: ['ogórka', 'ogórki'], mak: ['mak', 'maki'], baklazan: ['bakłażana', 'bakłażany']
  };

  // thumbnails for decorations and butterflies
  var miscCache = {};
  function decoUrl(DC, size, sil) {
    var key = 'd:' + DC.k + ':' + size + ':' + (sil ? 1 : 0);
    if (miscCache[key]) return miscCache[key];
    var dpr = Math.min(3, window.devicePixelRatio || 1);
    var c = document.createElement('canvas'); c.width = Math.round(size * dpr); c.height = Math.round(size * dpr);
    var g = c.getContext('2d'); g.scale(dpr, dpr);
    var s = size * 0.82 / Math.max(DC.w, DC.h);
    g.translate(size / 2, size / 2 + DC.h * s / 2);
    drawDeco(g, DC, s, 0.4);
    if (sil) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#c3cce0'; g.fillRect(0, 0, c.width, c.height); }
    return (miscCache[key] = c.toDataURL());
  }
  function bflyCanvas(B, size, sil) {
    var key = 'b:' + B.k + ':' + size + ':' + (sil ? 1 : 0);
    if (miscCache[key]) return miscCache[key];
    var dpr = Math.min(3, window.devicePixelRatio || 1);
    var c = document.createElement('canvas'); c.width = Math.round(size * dpr); c.height = Math.round(size * dpr);
    var g = c.getContext('2d'); g.scale(dpr, dpr);
    drawBfly(g, B, size / 2, size / 2 + size * 0.04, size / 34, 0, false, true);
    if (sil) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#c3cce0'; g.fillRect(0, 0, c.width, c.height); }
    return (miscCache[key] = c);
  }
  function bflyUrl(B, size, sil) {
    var key = 'bu:' + B.k + ':' + size + ':' + (sil ? 1 : 0);
    return miscCache[key] || (miscCache[key] = bflyCanvas(B, size, sil).toDataURL());
  }

  function wpick(list, wf) {
    var tot = 0; list.forEach(function (x) { tot += wf(x); });
    var r = Math.random() * tot;
    for (var i = 0; i < list.length; i++) { r -= wf(list[i]); if (r <= 0) return list[i]; }
    return list[list.length - 1];
  }

  NG.register('ogrodek', {
    meta: { name: 'Ogródek', price: 'nasiona od 5 ★', bg: '#dff3d2', music: 'meadow' },
    medals: [
      { id: 'h10', stat: 'harvest', at: 10, tier: 1, text: '10 plonów' },
      { id: 'h50', stat: 'harvest', at: 50, tier: 2, text: '50 plonów' },
      { id: 'h150', stat: 'harvest', at: 150, tier: 3, text: '150 plonów' }
    ],
    quests: [
      { id: 'harvest', stat: 'harvest', n: [2, 3], text: 'Zbierz {n} {plony} w Ogródku', forms: ['plon', 'plony', 'plonów'] },
      { id: 'water', stat: 'water', n: [1], text: 'Podlej rośliny w Ogródku' }
    ],
    stickers: [
      { id: 'fast', emoji: '🌱', name: 'Pierwsza szybka roślinka' },
      { id: 'motyl', emoji: '🦋', name: 'Pierwszy złapany motyl' },
      { id: 'motyle', emoji: '🌈', name: 'Wszystkie motyle' },
      { id: 'order', emoji: '🧺', name: 'Pierwsze zamówienie' },
      { id: 'deco', emoji: '🍄', name: 'Pierwsza ozdoba' }
    ],
    mount: function (el, ctx) {
      var S = window.Skarbonka;
      var st = ctx.load({ v: 1, plots: [], pouch: {}, book: {}, wet: [], wateredDay: '', seenHelp: false });
      var lvl = ctx.level();
      migrate();
      function upLv(k) { return clamp(st.up[k] | 0, 0, UB[k].v.length - 1); }
      function upV(k) { return UB[k].v[st.off[k] ? 0 : upLv(k)]; }   // a bought upgrade can be switched off (st.off)
      function baseCount() { return Math.min(MAX_PLOTS, 4 + Math.floor(lvl / 5)); }
      function plotCount() { return Math.min(MAX_PLOTS_UP, baseCount() + upV('plot')); }
      function nextPlotLevel() { var n = baseCount(); return n >= MAX_PLOTS ? 0 : (n - 3) * 5; }
      function maxOrders() { return upV('stall'); }
      function canBoost() { return upV('can') * HOUR; }
      function compostBoost() { return upV('comp') * HOUR; }

      function isObj(o) { return o && typeof o === 'object' && !Array.isArray(o); }
      function migrate() {
        if (!Array.isArray(st.plots)) st.plots = [];
        if (!Array.isArray(st.wet)) st.wet = [];
        if (!isObj(st.pouch)) st.pouch = {};
        if (!isObj(st.book)) st.book = {};
        var td = today();
        if (!(st.v >= 2)) {
          // v1 -> v2: one watering per day becomes one can per finished learning set
          st.cans = { d: st.wateredDay === td ? td : '', used: st.wateredDay === td ? 1 : 0 };
          // earlier harvests count toward the new medals (set directly: no quest progress, no toasts)
          var total = 0; for (var k in st.book) total += +st.book[k] || 0;
          if (total && NG.meta && NG.meta._read) {
            try { var m = NG.meta._read(); m.stats.ogrodek = m.stats.ogrodek || {}; m.stats.ogrodek.harvest = Math.max(m.stats.ogrodek.harvest || 0, total); NG.meta._write(m); } catch (e) {}
          }
          st.newsV2 = !!st.seenHelp;
          st.v = 2;
        }
        if (!isObj(st.cans)) st.cans = { d: '', used: 0 };
        if (!(st.compost >= 0)) st.compost = 0;
        if (!isObj(st.pantry)) st.pantry = {};
        if (!isObj(st.bfly)) st.bfly = {};
        if (!Array.isArray(st.guests)) st.guests = [];
        if (!Array.isArray(st.orders)) st.orders = [];
        if (!Array.isArray(st.deco)) st.deco = [];
        st.deco = st.deco.filter(function (d) { return d && DB[d.k]; });
        st.guests = st.guests.filter(function (gs) { return gs && /^(snail|weed|butterfly|bird)$/.test(gs.k); });
        st.orders = st.orders.filter(function (o) { return o && isObj(o.items) && Object.keys(o.items).every(function (k) { return BY[k]; }); });
        if (typeof st.guestT !== 'number') st.guestT = 0;
        if (typeof st.orderT !== 'number') st.orderT = 0;
        if (!(st.nextId > 0)) st.nextId = 1;
        if (!isObj(st.up)) st.up = {};
        if (!isObj(st.off)) st.off = {};
        if (!isObj(st.tank)) st.tank = { n: 0, t: 0 };
        if (!(st.tank.n >= 0)) st.tank.n = 0;
      }

      // ---------- DOM ----------
      var root = document.createElement('div'); root.className = 'og';
      var style = document.createElement('style'); style.textContent = CSS; root.appendChild(style);
      var cvWrap = document.createElement('div'); cvWrap.className = 'og-cv'; root.appendChild(cvWrap);
      var cv = document.createElement('canvas'); cvWrap.appendChild(cv);
      var banner = document.createElement('div'); banner.className = 'og-banner'; banner.hidden = true; cvWrap.appendChild(banner);
      var chip = document.createElement('button'); chip.type = 'button'; chip.className = 'og-chip'; chip.hidden = true; chip.setAttribute('aria-label', 'Kompost'); cvWrap.appendChild(chip);
      var bar = document.createElement('div'); bar.className = 'og-bar'; root.appendChild(bar);
      function mkBtn(svg, label) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'og-btn';
        b.innerHTML = svg + '<span class="lb">' + label + '</span>';
        bar.appendChild(b); return b;
      }
      var bShop = mkBtn(SVG_SEED, 'Sklep'), bCan = mkBtn(svgCan(false), 'Konewka'), bOrders = mkBtn(SVG_BASKET, 'Zamówienia'), bBook = mkBtn(SVG_BOOK, 'Zielnik');
      el.appendChild(root);
      var g = cv.getContext('2d');
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      var W = 0, H = 0, dpr = 1, cells = [], skyH = 60, bgCache = null;
      var raf = 0, running = true, timers = [], lastDraw = 0, t0 = performance.now();
      var particles = [], flyers = [], labels = [], watering = null, info = null, infoTimer = 0, sheet = null, modal = null, droop = [], pops = {}, decoPop = {};
      var down = null, drag = null;

      function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
      function save() {
        // keep only watered days still relevant to planted plots
        var min = today();
        st.plots.forEach(function (pl) { if (pl) { var d = dstr(new Date(pl.t)); if (d < min) min = d; } });
        st.wet = st.wet.filter(function (d) { return d >= min; });
        ctx.save(st);
      }
      function toast(text) {
        ctx.toast(text);
        var ts = el.querySelectorAll('.ng-toast'), t = ts[ts.length - 1];
        // #stage > * gives every stage child inset:0; pin the toast to the top centre instead
        if (t) { t.style.cssText += ';inset:auto;top:14px;left:50%;right:auto;bottom:auto;white-space:normal;width:max-content;max-width:calc(100% - 24px);text-align:center'; }
      }
      function bump(b) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }

      // ---------- growth ----------
      // real time on watered days (planting day counts as watered) + boosts in pl.extra (cans, compost).
      // Fast plants (h <= 2) keep the planting day's water through the next day too, so one planted
      // late in the evening does not stall at midnight.
      function nextDay(d) { return dstr(new Date(dayRange(d)[1])); }
      function freeDays(pl) {
        var plantDay = dstr(new Date(pl.t)), P = BY[pl.k];
        return P && P.fast ? [plantDay, nextDay(plantDay)] : [plantDay];
      }
      function progress(pl, now) {
        var P = BY[pl.k]; if (!P) return 0;
        var plantDay = dstr(new Date(pl.t)), ms = 0, seen = {};
        var days = st.wet.concat(freeDays(pl));
        for (var i = 0; i < days.length; i++) {
          var d = days[i]; if (seen[d] || d < plantDay) continue; seen[d] = 1;
          var r = dayRange(d), s = Math.max(r[0], pl.t), e = Math.min(r[1], now);
          if (e > s) ms += e - s;
        }
        ms += pl.extra || 0;
        return ms / (P.h * HOUR);
      }
      function wateredToday(pl) { var td = today(); return st.wet.indexOf(td) >= 0 || freeDays(pl).indexOf(td) >= 0; }
      function thirsty(pl, now) { return pl && progress(pl, now) < 1 && !wateredToday(pl); }

      // ---------- watering cans: one per finished learning set today ----------
      function setsToday() {
        var n = 0;
        try { n = (S.todayStats && S.todayStats().sets) || 0; } catch (e) {}
        if (!n) { try { var s = S.get(); if (s && s.days && s.days.last === today()) n = 1; } catch (e) {} } // older wallet copies
        return n;
      }
      function cansUsed() { return st.cans.d === today() ? st.cans.used || 0 : 0; }
      function cansLeft() { return Math.max(0, setsToday() - cansUsed()); }
      function wetToday() { return st.wet.indexOf(today()) >= 0; }
      // rain barrel: one can every RAIN while not full (a full barrel doesn't bank rain)
      function tankCap() { return upV('tank'); }
      function tankFill(now) {
        var cap = tankCap(), T = st.tank, before = T.n;
        if (!cap) return false;
        if (T.n > cap) T.n = cap;
        if (!T.t || T.t > now) T.t = now;
        while (T.n < cap && now - T.t >= RAIN) { T.n++; T.t += RAIN; }
        if (T.n >= cap) T.t = now;
        return T.n !== before;
      }
      function waterLeft() { return cansLeft() + (tankCap() ? st.tank.n : 0); }

      // ---------- pantry and orders ----------
      function pantryN(k) { var p = st.pantry[k]; return p ? (p.b || 0) + (p.f || 0) : 0; }
      function unitPay(P, bought) { return Math.max(1, Math.round(P.price * (bought ? ORDER_PAY : ORDER_PAY_FREE))); }
      function orderValue(o) { var v = 0; for (var k in o.items) v += o.items[k] * unitPay(BY[k], true); return v; }
      function payFor(o) {
        var v = 0;
        for (var k in o.items) { var n = o.items[k], p = st.pantry[k] || {}, b = Math.min(p.b || 0, n); v += b * unitPay(BY[k], true) + (n - b) * unitPay(BY[k], false); }
        return v;
      }
      function canFill(o) { for (var k in o.items) if (pantryN(k) < o.items[k]) return false; return true; }
      function itemsText(o) {
        var parts = Object.keys(o.items).map(function (k) { var n = o.items[k], f = FORMS[k] || [BY[k].n, BY[k].n]; return n === 1 ? f[0] : n + ' ' + f[1]; });
        return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' i ' + parts[parts.length - 1] : parts[0];
      }
      function makeOrder() {
        var pool = PLANTS.filter(function (P) { return P.lv <= lvl && !P.rare && P.h <= 48 && FORMS[P.k]; });
        if (!pool.length) pool = [BY.rzezucha];
        // often ask for something the child already has or is growing, so orders feel doable
        var near = pool.filter(function (P) { return pantryN(P.k) > 0 || st.plots.some(function (pl) { return pl && pl.k === P.k; }); });
        function pick(excl) {
          var src = (near.length && Math.random() < 0.55 ? near : pool).filter(function (P) { return P.k !== excl; });
          if (!src.length) src = pool.filter(function (P) { return P.k !== excl; });
          return src.length ? src[Math.floor(Math.random() * src.length)] : null;
        }
        var used = st.orders.map(function (o) { return o.a; }), free = [];
        for (var a = 0; a < ANIMALS.length; a++) if (used.indexOf(a) < 0) free.push(a);
        var who = free.length ? free[Math.floor(Math.random() * free.length)] : Math.floor(Math.random() * ANIMALS.length);
        var items = {}, A = pick(), B = pool.length > 1 && Math.random() < 0.4 ? pick(A.k) : null;
        if (B) { items[A.k] = Math.random() < 0.4 ? 2 : 1; items[B.k] = 1; }
        else items[A.k] = 1 + Math.floor(Math.random() * 3);
        for (var k in items) if (BY[k].h > 24 && items[k] > 2) items[k] = 2;
        return { id: st.nextId++, a: who, items: items };
      }
      function spawnOrders(now) {
        var changed = false, guard = 0;
        if (!st.orderT) st.orderT = now; // the first order comes right away
        while (st.orders.length < maxOrders() && now >= st.orderT && guard++ < 10) { st.orders.push(makeOrder()); st.orderT += ORDER_EVERY; changed = true; }
        if (st.orders.length >= maxOrders() && st.orderT < now) st.orderT = now; // a full gate doesn't bank orders
        return changed;
      }
      function fillOrder(o) {
        if (!canFill(o)) return;
        var A = ANIMALS[o.a] || ANIMALS[0], pay = payFor(o);
        for (var k in o.items) {
          var n = o.items[k], p = st.pantry[k], b = Math.min(p.b || 0, n);
          p.b = (p.b || 0) - b; p.f = (p.f || 0) - (n - b);
          if (p.b <= 0 && p.f <= 0) delete st.pantry[k];
        }
        st.orders = st.orders.filter(function (x) { return x !== o; });
        st.orderT = Math.max(st.orderT, Date.now() + ORDER_AFTER);
        if (pay > 0) ctx.refund(pay, 'zamówienie: ' + A.n);
        save();
        ctx.sfx('coin');
        toast(A.n + ' dziękuje! +' + pay + ' ★');
        ctx.stat('orders', 1);
        ctx.sticker('order');
        updateBar();
      }
      function declineOrder(o) {
        st.orders = st.orders.filter(function (x) { return x !== o; });
        st.orderT = Math.max(st.orderT, Date.now() + ORDER_AFTER);
        save(); ctx.sfx('close'); updateBar();
      }

      // ---------- guests: snails, weeds, butterflies, birds ----------
      function hasDeco(k) { return st.deco.some(function (d) { return d.k === k; }); }
      function newGuest(kind) {
        if (!kind) {
          var w = { snail: 3, weed: 3, butterfly: 2.5, bird: hasDeco('budka') ? 3.5 : 1.5 };
          kind = wpick(Object.keys(w), function (k) { return w[k]; });
        }
        var n = plotCount(), c = Math.floor(Math.random() * n);
        // spread guests over the beds
        for (var tries = 0; tries < 6 && st.guests.some(function (x) { return x.c === c; }); tries++) c = Math.floor(Math.random() * n);
        var gs = { id: st.nextId++, k: kind, c: c, f: Math.random() };
        if (kind === 'butterfly') gs.sp = wpick(BFLY, function (b) { return b.w; }).k;
        return gs;
      }
      function spawnGuests(now) {
        if (!st.guestT) { st.guests.push(newGuest('snail')); st.guestT = now + GUEST_EVERY; return true; }
        var changed = false, guard = 0;
        while (now >= st.guestT && guard++ < 20) {
          if (st.guests.length >= MAX_GUESTS) { st.guestT = now + GUEST_EVERY * (0.75 + Math.random() * 0.5); break; }
          st.guests.push(newGuest()); changed = true;
          st.guestT += GUEST_EVERY * (0.75 + Math.random() * 0.5);
        }
        return changed;
      }
      function guestPos(gs, t) {
        var n = plotCount(), c = cells[gs.c < n ? gs.c : gs.c % n];
        if (!c) return null;
        var s = clamp(c.k * 0.8, 0.85, 1.45), f = gs.f, x, y, mv = reduced ? 0 : 1;
        if (gs.k === 'snail') { x = c.bx + c.bw * (0.2 + 0.6 * f) + Math.sin(t * 0.2 + f * 9) * c.bw * 0.1 * mv; y = c.by + c.bh + 2; }
        else if (gs.k === 'weed') { x = c.bx + c.bw * (f < 0.5 ? 0.15 : 0.85); y = c.by + c.bh * 0.66; }
        else if (gs.k === 'butterfly') { x = c.baseX + Math.sin(t * 0.55 + f * 6) * c.bw * 0.3 * mv; y = c.by - c.h * 0.22 + Math.cos(t * 0.8 + f * 5) * c.h * 0.08 * mv; }
        else { x = c.bx + c.bw * (0.22 + 0.56 * f); y = c.by + c.bh + 1; }
        return { x: x, y: y, s: s, cy: gs.k === 'butterfly' ? y : y - 10 * s };
      }
      function guestAt(x, y) {
        var t = (performance.now() - t0) / 1000;
        for (var i = st.guests.length - 1; i >= 0; i--) {
          var p = guestPos(st.guests[i], t);
          if (p && Math.hypot(x - p.x, y - p.cy) < 30 * Math.max(1, p.s * 0.9)) return st.guests[i];
        }
        return null;
      }
      function drawGuests(t) {
        st.guests.forEach(function (gs) {
          var p = guestPos(gs, t); if (!p) return;
          var tt = reduced ? 0.3 : t + gs.f * 10;
          if (gs.k === 'snail') drawSnail(g, p.x, p.y, p.s, tt, Math.cos(t * 0.2 + gs.f * 9) < 0);
          else if (gs.k === 'weed') drawWeed(g, p.x, p.y, p.s, tt);
          else if (gs.k === 'butterfly') drawBfly(g, BFB[gs.sp] || BFLY[0], p.x, p.y, p.s * 1.15, tt, Math.cos(t * 0.55 + gs.f * 6) < 0, reduced);
          else drawBird(g, p.x, p.y, p.s, tt, gs.f > 0.5);
        });
      }
      function tapGuest(gs) {
        var t = (performance.now() - t0) / 1000, p = guestPos(gs, t);
        st.guests = st.guests.filter(function (x) { return x !== gs; });
        var msg = '';
        if (gs.k === 'snail' || gs.k === 'weed') {
          st.compost++;
          msg = (gs.k === 'snail' ? 'Ślimak idzie na łąkę.' : 'Chwast wyrwany!') + ' +1 kompost';
          ctx.sfx('pop');
          if (p) for (var j = 0; j < 8; j++) particles.push({ x: p.x, y: p.cy, vx: (Math.random() - 0.5) * 140, vy: -80 - Math.random() * 80, life: 0.6, c: j % 2 ? '#8a5a33' : '#5cbc4b', r: 2.6 });
          bump(chip);
        } else if (gs.k === 'butterfly') {
          var B = BFB[gs.sp] || BFLY[0], first = !(st.bfly[B.k] > 0);
          st.bfly[B.k] = (st.bfly[B.k] || 0) + 1;
          msg = (first ? 'Nowy motyl: ' : 'Złapany motyl: ') + B.n + '!';
          ctx.sfx('pop');
          if (p) {
            var br = bBook.getBoundingClientRect(), cr = cvWrap.getBoundingClientRect();
            flyers.push({ img: bflyCanvas(B, 64, false), x0: p.x, y0: p.y, x1: br.left + br.width / 2 - cr.left, y1: Math.min(H - 10, br.top - cr.top), s: 56, start: performance.now(), btn: bBook });
          }
        } else {
          var seed = Math.random() < 0.6 ? 'rzezucha' : 'szczypiorek';
          st.pouch[seed] = (st.pouch[seed] || 0) + 1;
          msg = 'Ptaszek przyniósł nasionko: ' + BY[seed].n + '!';
          ctx.sfx('pop');
          bump(bShop);
        }
        save();
        toast(msg);
        ctx.stat('guests', 1);
        if (gs.k === 'butterfly') {
          ctx.stat('butterflies', 1);
          ctx.sticker('motyl');
          if (BFLY.every(function (b) { return st.bfly[b.k] > 0; })) ctx.sticker('motyle');
        }
        updateBar();
      }

      // ---------- decorations ----------
      function decoScale() { return clamp(Math.min(W, (H - skyH) * 0.75) / 380, 0.75, 1.5); }
      function decoPos(d) { return { x: d.x * W, y: skyH + 12 + d.y * Math.max(10, H - skyH - 16) }; }
      function decoHit(d, x, y) { var DC = DB[d.k], p = decoPos(d), s = decoScale(); return Math.abs(x - p.x) < DC.w * s / 2 + 8 && y < p.y + 10 && y > p.y - DC.h * s - 8; }
      function decoAt(x, y) {
        var sorted = st.deco.slice().sort(function (a, b) { return b.y - a.y; }); // front first
        for (var i = 0; i < sorted.length; i++) if (decoHit(sorted[i], x, y)) return sorted[i];
        return null;
      }
      function decoCount(k) { return st.deco.filter(function (d) { return d.k === k; }).length; }
      function buyDeco(DC) {
        if (st.deco.length >= MAX_DECO) { toast('W ogródku jest już dużo ozdób.'); return false; }
        if (!ctx.spend(DC.price, 'ozdoba: ' + DC.n)) { toast('Za mało gwiazdek'); return false; }
        var d = { id: st.nextId++, k: DC.k, x: 0.25 + Math.random() * 0.5, y: 0.9 + Math.random() * 0.08 };
        st.deco.push(d); save();
        decoPop[d.id] = performance.now();
        ctx.sfx('buy');
        closeSheet();
        toast('Przesuń ozdobę palcem, gdzie chcesz!');
        ctx.stat('deco', 1);
        ctx.sticker('deco');
        return true;
      }

      // ---------- layout ----------
      function layout() {
        var r = cvWrap.getBoundingClientRect();
        W = Math.max(1, r.width); H = Math.max(1, r.height);
        dpr = Math.min(3, window.devicePixelRatio || 1);
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        skyH = clamp(H * 0.12, 54, 100);
        var n = plotCount(), total = n < MAX_PLOTS_UP ? n + 1 : n;
        var cols = total <= 6 ? 2 : 3, rows = Math.ceil(total / cols);
        if (W > H * 1.1) { cols = Math.min(total, total <= 6 ? 3 : 4); rows = Math.ceil(total / cols); }
        var gy = skyH + 8, gw = W - 16, gh = H - gy - 6;
        var cw = gw / cols, ch = gh / rows;
        if (cw > ch * 1.5) cw = ch * 1.5;
        var ox = (W - cw * cols) / 2;
        cells = [];
        for (var i = 0; i < total; i++) {
          var c = i % cols, rr = Math.floor(i / cols);
          var x = ox + c * cw, y = gy + rr * ch;
          var bx = x + 6, bw = cw - 12, sy = y + ch * 0.64, bh = Math.min(ch * 0.3, bw * 0.55);
          cells.push({ x: x, y: y, w: cw, h: ch, bx: bx, by: sy, bw: bw, bh: bh, baseX: x + cw / 2, baseY: sy + bh * 0.4,
            k: Math.min(ch * 0.7, cw * 1.05) / 100, locked: i >= n });
        }
        buildBg();
        drawFrame(performance.now());
      }
      function buildBg() {
        bgCache = document.createElement('canvas'); bgCache.width = cv.width; bgCache.height = cv.height;
        var b = bgCache.getContext('2d'); b.scale(dpr, dpr);
        var sky = b.createLinearGradient(0, 0, 0, skyH);
        sky.addColorStop(0, '#bfe3ff'); sky.addColorStop(1, '#e9f6ff');
        b.fillStyle = sky; b.fillRect(0, 0, W, skyH + 2);
        // far hills
        b.fillStyle = '#b5e09a';
        b.beginPath(); b.moveTo(0, skyH);
        for (var x = 0; x <= W + 20; x += 20) b.lineTo(x, skyH - 10 - Math.sin(x / 70) * 8 - Math.sin(x / 23) * 3);
        b.lineTo(W, skyH); b.closePath(); b.fill();
        var gr = b.createLinearGradient(0, skyH, 0, H);
        gr.addColorStop(0, '#9edb78'); gr.addColorStop(1, '#7fc65c');
        b.fillStyle = gr; b.fillRect(0, skyH, W, H - skyH);
        // grass tufts (deterministic)
        b.strokeStyle = 'rgba(42,138,86,.35)'; b.lineWidth = 1.5; b.lineCap = 'round';
        var seed = 7; function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
        for (var i = 0; i < W * H / 1400; i++) {
          var tx = rnd() * W, ty = skyH + 10 + rnd() * (H - skyH - 10);
          b.beginPath(); b.moveTo(tx - 3, ty); b.lineTo(tx - 4, ty - 5); b.moveTo(tx, ty); b.lineTo(tx, ty - 7); b.moveTo(tx + 3, ty); b.lineTo(tx + 4, ty - 5); b.stroke();
        }
        for (i = 0; i < W / 30; i++) { var fx = rnd() * W, fy = skyH + 14 + rnd() * (H - skyH - 20); b.fillStyle = ['#fff', '#ffe27a', '#ffc0d8'][i % 3]; b.beginPath(); b.arc(fx, fy, 2.2, 0, 7); b.fill(); }
        // fence
        var fy0 = skyH - 22;
        b.fillStyle = '#fff'; b.strokeStyle = INK; b.lineWidth = 2;
        b.beginPath(); b.rect(-2, fy0 + 6, W + 4, 5); b.rect(-2, fy0 + 15, W + 4, 5); b.fill(); b.stroke();
        for (x = 6; x < W; x += 22) {
          b.beginPath(); b.moveTo(x, skyH + 2); b.lineTo(x, fy0 + 2); b.lineTo(x + 5, fy0 - 3); b.lineTo(x + 10, fy0 + 2); b.lineTo(x + 10, skyH + 2); b.closePath(); b.fill(); b.stroke();
        }
      }

      // ---------- drawing ----------
      function rrect(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
      function drawBed(c, wet) {
        rrect(c.bx, c.by, c.bw, c.bh, 12); g.fillStyle = '#c98b4f'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
        rrect(c.bx + 6, c.by + 5, c.bw - 12, c.bh - 11, 9); g.fillStyle = wet ? '#5e3b22' : '#8a5a33'; g.fill();
        g.strokeStyle = wet ? 'rgba(0,0,0,.18)' : 'rgba(0,0,0,.14)'; g.lineWidth = 2;
        for (var i = 1; i <= 2; i++) {
          var yy = c.by + 5 + (c.bh - 11) * i / 3;
          g.beginPath(); g.moveTo(c.bx + 14, yy); g.quadraticCurveTo(c.baseX, yy + 3, c.bx + c.bw - 14, yy); g.stroke();
        }
        if (wet) { g.fillStyle = 'rgba(160,210,255,.6)'; [[0.25, 0.35], [0.7, 0.6], [0.45, 0.75]].forEach(function (q) { g.beginPath(); g.ellipse(c.bx + c.bw * q[0], c.by + c.bh * q[1], 4, 1.6, 0, 0, 7); g.fill(); }); }
      }
      function drawCloud(x, y, s) {
        g.fillStyle = '#fff'; g.strokeStyle = 'rgba(29,47,111,.25)'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(x, y, 10 * s, Math.PI * 0.5, Math.PI * 1.5); g.arc(x + 12 * s, y - 8 * s, 12 * s, Math.PI, 0); g.arc(x + 26 * s, y - 2 * s, 9 * s, Math.PI * 1.3, Math.PI * 0.5); g.closePath(); g.fill(); g.stroke();
      }
      function drawSun(t) {
        var x = W - 38, y = skyH * 0.4, r = 14;
        g.save(); g.translate(x, y); g.rotate(t * 0.15);
        g.strokeStyle = '#f2b51d'; g.lineWidth = 3; g.lineCap = 'round';
        for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5; g.beginPath(); g.moveTo(Math.cos(a) * (r + 5), Math.sin(a) * (r + 5)); g.lineTo(Math.cos(a) * (r + 11), Math.sin(a) * (r + 11)); g.stroke(); }
        g.restore();
        g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = '#ffd84a'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
        g.fillStyle = INK; g.beginPath(); g.arc(x - 4.5, y - 2, 1.5, 0, 7); g.arc(x + 4.5, y - 2, 1.5, 0, 7); g.fill();
        g.beginPath(); g.arc(x, y + 1, 5, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
      }
      // the garden gate: animals with orders wait here
      var GATE_X = 14, GATE_W = 46;
      function gateHit(x, y) { return x < GATE_X + GATE_W + 44 && y > skyH - 52 && y < skyH + 8; }
      // the rain barrel (left of the sun) and the beehive (right of the gate) stand in the garden once bought
      function barrelAt() { var k = clamp(skyH / 100, 0.5, 0.85); return { x: W - 88 * Math.max(0.8, k), y: skyH + 4, k: k }; }
      function hiveAt() { var k = clamp(skyH / 100, 0.45, 0.7); return { x: GATE_X + GATE_W + 26, y: skyH + 3, k: k }; }
      function drawUpsInGarden(t) {
        if (tankCap()) { var b = barrelAt(); g.save(); g.translate(b.x, b.y); g.scale(b.k, b.k); drawUp(g, 'tank', st.tank.n / tankCap()); g.restore(); }
        if (upV('bee')) {
          var h = hiveAt(); g.save(); g.translate(h.x, h.y); g.scale(h.k, h.k);
          drawUp(g, 'bee', 0); g.restore();
        }
      }
      function barrelHit(x, y) { if (!tankCap()) return false; var b = barrelAt(); return Math.abs(x - b.x) < 34 * b.k + 8 && y < b.y + 6 && y > b.y - 96 * b.k; }
      function drawGate(t) {
        var x0 = GATE_X, w = GATE_W, top = skyH - 24, y1 = skyH + 2;
        g.save(); g.lineWidth = 2; g.strokeStyle = INK; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0, top + 4); g.quadraticCurveTo(x0 + w / 2, top - 12, x0 + w, top + 4); g.lineTo(x0 + w, y1); g.closePath();
        g.fillStyle = '#e9b97a'; g.fill(); g.stroke();
        g.strokeStyle = 'rgba(29,47,111,.45)'; g.lineWidth = 1.5;
        for (var i = 1; i < 4; i++) { var xx = x0 + w * i / 4; g.beginPath(); g.moveTo(xx, y1); g.lineTo(xx, top + 2 - (i === 2 ? 6 : 3)); g.stroke(); }
        g.beginPath(); g.moveTo(x0, top + 14); g.lineTo(x0 + w, top + 14); g.stroke();
        g.fillStyle = '#c98b4f'; g.strokeStyle = INK; g.lineWidth = 2;
        [x0 - 5, x0 + w - 1].forEach(function (px) { rrect(px, top - 2, 6, y1 - top + 2, 2); g.fill(); g.stroke(); });
        if (st.orders.length) {
          var A = ANIMALS[st.orders[0].a] || ANIMALS[0], bob = reduced ? 0 : Math.sin(t * 2.4) * 2;
          g.font = '26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
          g.fillText(A.e, x0 + w + 20, y1 + 2 + bob);
          var bxp = x0 + w + 32, byp = top - 6;
          g.beginPath(); g.arc(bxp, byp, 10, 0, 7); g.fillStyle = st.orders.some(canFill) ? '#2a8a56' : '#cf412d'; g.fill(); g.strokeStyle = INK; g.stroke();
          g.fillStyle = '#fff'; g.font = '15px ' + FONT; g.textBaseline = 'middle'; g.fillText(String(st.orders.length), bxp, byp + 1);
        }
        g.restore();
      }
      function drawDrop(x, y, s) {
        g.beginPath(); g.arc(x, y, 11 * s, 0, 7); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
        g.beginPath(); g.moveTo(x, y - 7 * s); g.quadraticCurveTo(x + 6 * s, y + 1 * s, x, y + 5 * s); g.quadraticCurveTo(x - 6 * s, y + 1 * s, x, y - 7 * s); g.fillStyle = '#3f86d8'; g.fill();
      }
      function sparkle(x, y, r, a) {
        g.save(); g.globalAlpha = a; g.fillStyle = '#ffd84a'; g.strokeStyle = INK; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill(); g.stroke();
        g.restore();
      }
      function drawCan(x, y, tilt) {
        g.save(); g.translate(x, y); g.rotate(tilt); g.lineWidth = 2.5; g.strokeStyle = INK; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(14, -6); g.lineTo(34, -20); g.lineTo(37, -16); g.lineTo(18, 2); g.closePath(); g.fillStyle = '#9fc3ea'; g.fill(); g.stroke();
        g.beginPath(); g.ellipse(36, -18, 4, 6, -0.9, 0, 7); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(-16, -14); g.lineTo(16, -14); g.lineTo(16, 14); g.quadraticCurveTo(16, 18, 12, 18); g.lineTo(-12, 18); g.quadraticCurveTo(-16, 18, -16, 14); g.closePath(); g.fillStyle = '#6fa8e8'; g.fill(); g.stroke();
        g.beginPath(); g.moveTo(-10, -14); g.quadraticCurveTo(0, -30, 10, -14); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(-11, -9, 4, 20);
        g.restore();
      }
      function drawLabel(l) {
        g.save(); g.globalAlpha = Math.min(1, l.life * 2);
        g.font = '18px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
        var w = g.measureText(l.text).width + 18, x = clamp(l.x, w / 2 + 4, W - w / 2 - 4);
        rrect(x - w / 2, l.y - 14, w, 28, 12); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
        g.fillStyle = INK; g.fillText(l.text, x, l.y + 1);
        g.restore();
      }

      function drawFrame(now) {
        if (!W) return;
        var t = (now - t0) / 1000, wall = Date.now(), td = today();
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, W, H);
        if (bgCache) g.drawImage(bgCache, 0, 0, W, H);
        drawSun(t);
        var cx1 = ((t * 6) % (W + 120)) - 60, cx2 = ((t * 4 + W * 0.55) % (W + 120)) - 60;
        drawCloud(cx1, skyH * 0.35, 0.8); drawCloud(cx2, skyH * 0.62, 0.6);
        drawGate(t);
        drawUpsInGarden(t);
        var wetT = st.wet.indexOf(td) >= 0, objs = [];
        // pass 1: beds; plants and decorations are drawn afterwards, sorted by depth
        cells.forEach(function (c, i) {
          if (c.locked) {
            g.save(); g.setLineDash([7, 6]); rrect(c.bx, c.by, c.bw, c.bh, 12); g.fillStyle = 'rgba(255,255,255,.25)'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = 'rgba(29,47,111,.45)'; g.stroke(); g.restore();
            var lx = c.baseX, ly = c.by + c.bh * 0.42;
            g.lineWidth = 2.5; g.strokeStyle = INK; g.fillStyle = '#e3a008';
            g.beginPath(); g.arc(lx, ly - 7, 6, Math.PI, 0); g.stroke();
            rrect(lx - 9, ly - 7, 18, 14, 3); g.fill(); g.stroke();
            g.fillStyle = 'rgba(29,47,111,.75)'; g.font = Math.round(clamp(c.bw / 8, 14, 18)) + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'top';
            g.fillText(nextPlotLevel() ? 'od poziomu ' + nextPlotLevel() : 'Ulepszenia', lx, ly + 10);
            return;
          }
          var pl = st.plots[i];
          drawBed(c, pl && (wetT || wateredToday(pl)));
          if (!pl) {
            var pulse = reduced ? 1 : 0.5 + 0.5 * Math.sin(t * 2.2 + i);
            var r = Math.min(c.bh * 0.28, 18);
            g.save(); g.globalAlpha = 0.8 + 0.2 * pulse;
            g.beginPath(); g.arc(c.baseX, c.by + c.bh * 0.48, r, 0, 7); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
            g.beginPath(); g.moveTo(c.baseX - r * 0.5, c.by + c.bh * 0.48); g.lineTo(c.baseX + r * 0.5, c.by + c.bh * 0.48); g.moveTo(c.baseX, c.by + c.bh * 0.48 - r * 0.5); g.lineTo(c.baseX, c.by + c.bh * 0.48 + r * 0.5); g.lineWidth = 3; g.stroke();
            g.restore();
            return;
          }
          var P = BY[pl.k]; if (!P) return;
          var p = Math.min(1, progress(pl, wall)), th = p < 1 && !wateredToday(pl);
          // seed sign for young plants
          if (p < 0.4) {
            var sx = c.bx + 16, sy2 = c.by + 6, ss = clamp(c.bw * 0.22, 22, 34);
            g.beginPath(); g.moveTo(sx, sy2 + 4); g.lineTo(sx, sy2 - ss * 0.5); g.strokeStyle = '#8a5a33'; g.lineWidth = 3; g.stroke();
            rrect(sx - ss / 2, sy2 - ss * 1.35, ss, ss, 5); g.fillStyle = '#fff8ea'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
            g.drawImage(thumbCanvas(P, 48, false), sx - ss / 2 + 2, sy2 - ss * 1.35 + 2, ss - 4, ss - 4);
          }
          if (p < 1) {
            var pw = c.bw * 0.5, px = c.baseX - pw / 2, py = c.by + c.bh - 11;
            rrect(px, py, pw, 7, 3.5); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill();
            if (p > 0.02) { rrect(px, py, Math.max(7, pw * p), 7, 3.5); g.fillStyle = th ? '#c9b25a' : '#5cbc4b'; g.fill(); }
            rrect(px, py, pw, 7, 3.5); g.lineWidth = 1.5; g.strokeStyle = INK; g.stroke();
          }
          objs.push({ y: c.baseY, f: function () {
            droop[i] = (droop[i] || 0) + ((th ? 1 : 0) - (droop[i] || 0)) * 0.06;
            if (Math.abs(droop[i] - (th ? 1 : 0)) < 0.01) droop[i] = th ? 1 : 0;
            var sway = reduced ? 0 : Math.sin(t * 1.3 + i * 1.7) * 0.035 * (1 - droop[i] * 0.7);
            var pop = pops[i] ? clamp(1 - (now - pops[i]) / 500, 0, 1) : 0;
            var bounce = p >= 1 ? 1 + (reduced ? 0 : Math.sin(t * 3 + i) * 0.025) : 1 + Math.sin(pop * Math.PI) * 0.15;
            g.save(); g.translate(c.baseX, c.baseY); g.scale(bounce, bounce);
            drawPlant(g, P, p, c.k, droop[i], reduced ? 0.3 : t + i, sway);
            g.restore();
            if (th) drawDrop(c.x + c.w - 22, c.y + 22 + (reduced ? 0 : Math.sin(t * 2.5 + i) * 3), clamp(c.w / 150, 0.8, 1.1));
            if (p >= 1) for (var s = 0; s < 3; s++) {
              var aa = t * 0.8 + s * 2.1 + i, rr2 = c.k * 42;
              sparkle(c.baseX + Math.cos(aa) * rr2, c.baseY - c.k * 45 + Math.sin(aa * 1.3) * c.k * 30, 4 + 2 * Math.sin(t * 4 + s), 0.5 + 0.5 * Math.sin(t * 3 + s * 2));
            }
          } });
        });
        var ds = decoScale();
        st.deco.forEach(function (d) {
          var pp = decoPos(d);
          objs.push({ y: pp.y, f: function () {
            var lifted = drag && drag.d === d && drag.moving, pop = decoPop[d.id] ? clamp(1 - (now - decoPop[d.id]) / 600, 0, 1) : 0;
            var sc = ds * (lifted ? 1.12 : 1 + Math.sin(pop * Math.PI) * 0.25);
            g.save(); g.translate(pp.x, pp.y);
            g.beginPath(); g.ellipse(0, 0, DB[d.k].w * sc * 0.42, 5 * sc, 0, 0, 7); g.fillStyle = 'rgba(29,47,111,' + (lifted ? 0.25 : 0.12) + ')'; g.fill();
            if (lifted) g.translate(0, -6);
            drawDeco(g, DB[d.k], sc, reduced ? 0.4 : t);
            g.restore();
          } });
        });
        objs.sort(function (a, b) { return a.y - b.y; }).forEach(function (o) { o.f(); });
        drawGuests(t);
        // watering can animation
        if (watering) {
          var wt = (now - watering.start) / watering.per, idx = Math.floor(wt);
          if (idx >= watering.list.length) { var wb = watering.boost / HOUR, wtank = watering.tank; watering = null; toast((wtank ? 'Woda z beczki! ' : 'Podlane! ') + 'Rośliny urosły o ' + wb + ' ' + plural(wb, 'godzinę', 'godziny', 'godzin') + '.'); }
          else {
            var cc = cells[watering.list[idx]], f = wt - idx;
            if (cc) {
              var x = cc.baseX - 30 + f * 20, y = cc.by - cc.h * 0.15;
              drawCan(x, y, 0.45);
              if (Math.random() < 0.9) particles.push({ x: x + 40, y: y - 12, vx: 30 + Math.random() * 30, vy: 20, life: 0.6, c: '#3f86d8', r: 2.2 });
            }
          }
        }
        // particles
        var dt = Math.min(0.05, (now - (drawFrame.last || now)) / 1000); drawFrame.last = now;
        particles = particles.filter(function (q) {
          q.life -= dt; if (q.life <= 0) return false;
          q.vy += 260 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
          if (q.k === 'star') sparkle(q.x, q.y, q.r, Math.min(1, q.life * 2));
          else { g.beginPath(); g.fillStyle = q.c; g.globalAlpha = Math.min(1, q.life * 3); g.arc(q.x, q.y, q.r, 0, 7); g.fill(); g.globalAlpha = 1; }
          return true;
        });
        labels = labels.filter(function (l) { l.life -= dt; if (l.life <= 0) return false; drawLabel(l); return true; });
        flyers = flyers.filter(function (f) {
          var u = (now - f.start) / 800; if (u >= 1) { bump(f.btn || bBook); return false; }
          var e = u * u * (3 - 2 * u), x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e - Math.sin(u * Math.PI) * 80;
          var s = f.s * (1 - u * 0.5);
          g.drawImage(f.img, x - s / 2, y - s / 2, s, s);
          return true;
        });
      }

      function frame(now) {
        raf = 0;
        if (!running) return;
        raf = requestAnimationFrame(frame);
        if (now - lastDraw < 30) return; // ~30 fps is plenty for a calm garden
        lastDraw = now;
        drawFrame(now);
      }
      function start() { if (!raf && running) raf = requestAnimationFrame(frame); }

      // ---------- UI state ----------
      function updateBar() {
        var n = waterLeft(), wet = wetToday();
        bCan.className = 'og-btn' + (n ? ' full' : wet ? ' done' : '');
        bCan.innerHTML = svgCan(n > 0) + '<span class="lb">' + (n ? 'Podlej' : wet ? 'Podlane ✓' : 'Konewka') + '</span>' + (n ? '<span class="bdg blue">' + n + '</span>' : '');
        var pouchN = 0; for (var k in st.pouch) pouchN += st.pouch[k] || 0;
        bShop.innerHTML = SVG_SEED + '<span class="lb">Sklep</span>' + (pouchN ? '<span class="bdg green">' + pouchN + '</span>' : '');
        var ready = st.orders.filter(canFill).length;
        bOrders.className = 'og-btn' + (ready ? ' ready' : '');
        bOrders.innerHTML = SVG_BASKET + '<span class="lb">Zamówienia</span>' + (st.orders.length ? '<span class="bdg ' + (ready ? 'green' : 'grey') + '">' + st.orders.length + '</span>' : '');
        chip.hidden = !(st.compost > 0);
        chip.innerHTML = SVG_COMPOST + '<span>' + st.compost + '</span>';
        banner.classList.toggle('shift', !chip.hidden);
        var now = Date.now(), anyThirsty = false;
        for (var i = 0; i < plotCount(); i++) if (thirsty(st.plots[i], now)) anyThirsty = true;
        if (anyThirsty && !wet) {
          banner.hidden = false;
          banner.textContent = n ? 'Rośliny chcą pić. Podlej je konewką!' : 'Rośliny chcą pić. Ukończ zestaw nauki, a konewka się napełni.';
        } else banner.hidden = true;
      }
      function tick() {
        var l = ctx.level();
        if (l !== lvl) { lvl = l; layout(); }
        var now = Date.now(), a = spawnGuests(now), b = spawnOrders(now), c = tankFill(now);
        if (a || b || c) save();
        if (b && sheet && sheet.kind === 'orders' && sheet.render) sheet.render();
        updateBar();
      }

      function closeInfo() { if (info) { info.remove(); info = null; } clearTimeout(infoTimer); }
      function showInfo(i) {
        closeInfo();
        var pl = st.plots[i]; if (!pl) return;
        var P = BY[pl.k], now = Date.now(), p = Math.min(1, progress(pl, now)), th = thirsty(pl, now);
        info = document.createElement('div'); info.className = 'og-info';
        var left = (1 - p) * P.h * HOUR;
        info.innerHTML = '<img alt="" src="' + thumbUrl(P, 96, false) + '"><div style="flex:1;min-width:0"><b>' + P.n + '</b>' +
          '<span class="st">Teraz: ' + stageName(P, stageOf(p)) + '</span><div class="pb"><i style="width:' + Math.round(p * 100) + '%"></i></div>' +
          (th ? '<span class="th">Chce pić! Podlej konewką, wtedy urośnie.</span>' : '<span class="st">Gotowe za ' + hoursText(left) + '</span>') +
          (st.compost > 0 && p < 1 ? '<button type="button" class="og-cbtn">' + SVG_COMPOST + 'Daj kompost: +' + (compostBoost() / HOUR) + ' godz. (masz ' + st.compost + ')</button>' : '') + '</div>';
        info.onclick = closeInfo;
        var cb = info.querySelector('.og-cbtn');
        if (cb) cb.onclick = function (e) { e.stopPropagation(); useCompost(i); };
        cvWrap.appendChild(info);
        infoTimer = later(closeInfo, cb ? 8000 : 5000);
      }
      function useCompost(i) {
        var pl = st.plots[i]; if (!pl || !(st.compost > 0)) return;
        st.compost--;
        pl.extra = (pl.extra || 0) + compostBoost();
        save();
        ctx.sfx('plant');
        pops[i] = performance.now();
        var c = cells[i];
        if (c) for (var j = 0; j < 10; j++) particles.push({ x: c.baseX, y: c.baseY, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 80, life: 0.6, c: j % 2 ? '#5e3b22' : '#8a5a33', r: 2.5 });
        updateBar();
        if (progress(pl, Date.now()) >= 1) { closeInfo(); toast('Kompost pomógł! Można zbierać: ' + BY[pl.k].n + '.'); }
        else showInfo(i);
      }

      // ---------- sheets ----------
      function closeSheet() {
        if (!sheet) return;
        var s = sheet; sheet = null; s.wrap.classList.remove('on');
        later(function () { s.wrap.remove(); }, 260);
      }
      function openSheet(title, showBal, kind) {
        closeSheet(); closeInfo();
        var wrap = document.createElement('div'); wrap.className = 'og-sheetw';
        var sh = document.createElement('div'); sh.className = 'og-sheet'; wrap.appendChild(sh);
        var hd = document.createElement('div'); hd.className = 'og-sh-h';
        hd.innerHTML = '<h3></h3>' + (showBal ? '<span class="bal"><span>★</span> <b style="font-weight:400"></b></span>' : '') + '<button type="button" class="og-x" aria-label="Zamknij">×</button>';
        hd.querySelector('h3').textContent = title;
        sh.appendChild(hd);
        var body = document.createElement('div'); body.className = 'og-sh-b'; sh.appendChild(body);
        wrap.addEventListener('pointerdown', function (e) { if (e.target === wrap) closeSheet(); });
        hd.querySelector('.og-x').onclick = closeSheet;
        root.appendChild(wrap);
        void wrap.offsetWidth; wrap.classList.add('on');
        sheet = { wrap: wrap, body: body, hd: hd, kind: kind || '' };
        ctx.sfx('open');
        return sheet;
      }
      function mkTabs(sh, list, cur, onPick) {
        var row = document.createElement('div'); row.className = 'og-tabs';
        list.forEach(function (t) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'og-tab' + (t[0] === cur ? ' on' : ''); b.textContent = t[1];
          b.onclick = function () { Array.prototype.forEach.call(row.children, function (x) { x.classList.toggle('on', x === b); }); ctx.sfx('tap'); onPick(t[0]); sh.body.scrollTop = 0; };
          row.appendChild(b);
        });
        sh.body.parentNode.insertBefore(row, sh.body);
      }
      function addEl(parent, tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; parent.appendChild(e); return e; }
      function firstEmpty() { for (var i = 0; i < plotCount(); i++) if (!st.plots[i]) return i; return -1; }

      function openShop(target, tab) {
        var sh = openSheet('Sklep', true, 'shop');
        tab = tab || (target < 0 ? 'deco' : 'seeds');
        mkTabs(sh, [['seeds', 'Nasiona'], ['deco', 'Ozdoby'], ['up', 'Ulepszenia']], tab, function (t) { tab = t; render(); });
        function render() {
          if (!sh.wrap.isConnected) return;
          var bal = ctx.balance(), body = sh.body;
          sh.hd.querySelector('.bal b').textContent = bal;
          body.innerHTML = '';
          if (tab === 'deco') { renderDeco(body, bal); return; }
          if (tab === 'up') { renderUps(body, bal); return; }
          if (target < 0) addEl(body, 'p', 'og-poor', 'Wszystkie grządki są zajęte. Zbierz plony albo poczekaj.');
          var cheapest = PLANTS.filter(function (P) { return P.lv <= lvl; }).reduce(function (m, P) { return Math.min(m, P.price); }, 1e9);
          if (bal < cheapest && !Object.keys(st.pouch).length) {
            var poor = addEl(body, 'p', 'og-poor');
            poor.innerHTML = 'Brakuje gwiazdek. Zdobądź je w <a href="/matma/">Matmie</a>, <a href="/angielski/">Angielskim</a> albo <a href="/polski/">Polskim</a>.';
          }
          var pouchKinds = PLANTS.filter(function (P) { return st.pouch[P.k] > 0; });
          if (pouchKinds.length) {
            addEl(body, 'div', 'og-sec', 'Twoje nasiona (za darmo)');
            pouchKinds.forEach(function (P) { body.appendChild(row(P, true, bal)); });
          }
          addEl(body, 'div', 'og-sec', 'Sklep z nasionami');
          PLANTS.forEach(function (P) { body.appendChild(row(P, false, bal)); });
        }
        function row(P, free, bal) {
          var locked = !free && P.lv > lvl;
          var r = document.createElement('div'); r.className = 'og-row' + (locked ? ' lock' : '') + (free ? ' gift' : P.fast ? ' fast' : '');
          r.innerHTML = '<img alt="" src="' + thumbUrl(P, 112, locked) + '"><div class="tx"><b></b><small></small></div>';
          r.querySelector('b').textContent = P.n + (free ? ' ×' + st.pouch[P.k] : '') + (P.rare ? ' ✦' : '') + (P.fast && !free ? ' ⚡' : '') + (P.pet ? ' ♥' : '');
          r.querySelector('small').textContent = growText(P) + (P.pet ? ' · przysmak zwierzątek' : '') + (st.book[P.k] ? ' · zebrane ' + st.book[P.k] + '×' : '');
          if (locked) {
            addEl(r, 'span', 'og-lockt', 'od poziomu ' + P.lv);
          } else {
            var b = addEl(r, 'button', 'og-buy' + (free ? ' free' : ''), free ? 'Posadź' : P.price + ' ★'); b.type = 'button';
            if ((!free && P.price > bal) || target < 0) b.disabled = true;
            b.onclick = function () {
              if (target < 0 || st.plots[target]) return;
              if (free) {
                if (!(st.pouch[P.k] > 0)) return;
                st.pouch[P.k]--; if (!st.pouch[P.k]) delete st.pouch[P.k];
                plant(target, P, 0);
              } else {
                if (!ctx.spend(P.price, 'nasiona: ' + P.n)) { render(); toast('Za mało gwiazdek'); return; }
                plant(target, P, P.price);
              }
              closeSheet();
            };
          }
          return r;
        }
        function renderUps(body, bal) {
          addEl(body, 'p', 'og-muted', 'Ulepszenia zostają na zawsze. Każde ma kilka poziomów.');
          UPS.forEach(function (U) {
            var L = upLv(U.k), top = L >= U.v.length - 1, need = top ? 0 : U.lv[L], locked = !top && need > lvl;
            var r = addEl(body, 'div', 'og-row og-up' + (locked ? ' lock' : '') + (top ? ' top' : ''));
            r.innerHTML = '<img alt="" src="' + upUrl(U.k, 112) + '"><div class="tx"><b></b><span class="dots"></span><small></small></div>';
            r.querySelector('b').textContent = U.n;
            var dots = r.querySelector('.dots');
            for (var i = 1; i < U.v.length; i++) addEl(dots, 'i', i <= L ? 'on' : '');
            var now = L ? U.say(U.v[L]) : '', next = top ? 'Najwyższy poziom!' : (L ? 'Dalej: ' : '') + U.say(U.v[L + 1]);
            r.querySelector('small').textContent = [now, next, !L && U.more ? U.more : ''].filter(Boolean).join(' · ');
            if (L) {
              var off = !!st.off[U.k], sw = addEl(r.querySelector('.tx'), 'button', 'og-sw' + (off ? '' : ' on'), off ? 'Wyłączone' : 'Włączone'); sw.type = 'button';
              sw.setAttribute('aria-pressed', off ? 'false' : 'true');
              sw.onclick = function () { toggleUp(U, render); };
              if (off) r.classList.add('off');
            }
            if (top) { addEl(r, 'span', 'og-lockt', '✓'); return; }
            if (locked) { addEl(r, 'span', 'og-lockt', 'od poziomu ' + need); return; }
            var price = U.price[L], b = addEl(r, 'button', 'og-buy', price + ' ★'); b.type = 'button';
            if (price > bal) b.disabled = true;
            b.onclick = function () { buyUp(U, L, render); };
          });
          addEl(body, 'p', 'og-muted', 'Gwiazdki zdobędziesz w Matmie, Angielskim i Polskim.');
        }
        function renderDeco(body, bal) {
          addEl(body, 'p', 'og-muted', 'Kup ozdobę i przesuń ją palcem po ogródku. Ozdoby: ' + st.deco.length + ' z ' + MAX_DECO + '.');
          DECOS.forEach(function (DC) {
            var locked = DC.lv > lvl, have = decoCount(DC.k);
            var r = addEl(body, 'div', 'og-row' + (locked ? ' lock' : ''));
            r.innerHTML = '<img alt="" src="' + decoUrl(DC, 112, locked) + '"><div class="tx"><b></b><small></small></div>';
            r.querySelector('b').textContent = DC.n;
            r.querySelector('small').textContent = [DC.note || '', have ? 'masz: ' + have : ''].filter(Boolean).join(' · ');
            if (locked) { addEl(r, 'span', 'og-lockt', 'od poziomu ' + DC.lv); return; }
            var b = addEl(r, 'button', 'og-buy', DC.price + ' ★'); b.type = 'button';
            if (DC.price > bal || st.deco.length >= MAX_DECO || have >= MAX_SAME) b.disabled = true;
            b.onclick = function () { if (!buyDeco(DC)) render(); };
          });
        }
        render();
      }
      function toggleUp(U, render) {
        var turnOff = !st.off[U.k];
        // switching off the extra beds would hide plants growing there: harvest them first
        if (turnOff && U.k === 'plot') {
          var base = baseCount();
          for (var i = base; i < plotCount(); i++) if (st.plots[i]) { toast('Na dodatkowej grządce coś rośnie. Najpierw zbierz plony.'); ctx.sfx('error'); return; }
        }
        if (turnOff) st.off[U.k] = true; else delete st.off[U.k];
        if (U.k === 'tank' && !turnOff) { st.tank.t = Date.now(); st.tank.n = Math.min(st.tank.n, tankCap()); }   // no rain banked while it was off
        save(); ctx.sfx(turnOff ? 'close' : 'open');
        if (U.k === 'plot') layout();
        if (U.k === 'stall' && !turnOff) spawnOrders(Date.now());
        toast(U.n + (turnOff ? ': wyłączone.' : ': włączone!'));
        updateBar(); render();
      }
      function buyUp(U, L, render) {
        if (upLv(U.k) !== L || L >= U.v.length - 1 || U.lv[L] > lvl) return;
        if (!ctx.spend(U.price[L], U.n)) { toast('Za mało gwiazdek.'); ctx.sfx('error'); render(); return; }
        if (U.k === 'tank' && st.off.tank) st.tank.t = Date.now();   // no rain banked while it was off
        st.up[U.k] = L + 1; delete st.off[U.k];
        if (U.k === 'tank') { if (L === 0) st.tank = { n: tankCap(), t: Date.now() }; else { st.tank.n = Math.min(tankCap(), st.tank.n + 1); tankFill(Date.now()); } }
        save(); ctx.sfx('buy'); ctx.stat('upgrades', 1);
        if (U.k === 'plot') layout();
        if (U.k === 'stall') spawnOrders(Date.now());
        toast({ tank: L ? 'Większa beczka! Mieści ' + tankCap() + ' ' + plural(tankCap(), 'konewkę', 'konewki', 'konewek') + '.' : 'Beczka stoi w ogródku i jest pełna wody!',
          can: 'Duża konewka: +' + upV('can') + ' godz. przy każdym podlaniu!', comp: 'Lepszy kompost: +' + upV('comp') + ' godz.!',
          plot: 'Nowa grządka! Posadź coś.', bee: 'Pszczoły zamieszkały w ogródku!', stall: 'Większy stragan: więcej zamówień!' }[U.k]);
        updateBar(); render();
      }
      function plant(i, P, paid) {
        st.plots[i] = { k: P.k, t: Date.now(), paid: paid };
        pops[i] = performance.now();
        var c = cells[i];
        if (c) for (var j = 0; j < 10; j++) particles.push({ x: c.baseX, y: c.baseY, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 80, life: 0.6, c: '#6e4527', r: 2.5 });
        save();
        ctx.sfx('plant');
        toast('Posadzone: ' + P.n + '!' + (P.fast ? ' Będzie gotowe za ' + hoursText(P.h * HOUR) + '.' : ''));
        updateBar();
      }

      function openBook(tab) {
        var sh = openSheet('Zielnik', false, 'book');
        tab = tab || 'plants';
        mkTabs(sh, [['plants', 'Rośliny'], ['pantry', 'Spiżarnia'], ['bfly', 'Motyle']], tab, function (t) { tab = t; render(); });
        function card(grid, img, name, sub, n, cls) {
          var cd = addEl(grid, 'div', 'og-card' + (cls || ''));
          cd.innerHTML = '<img alt="" src="' + img + '"><b></b><small></small>' + (n ? '<span class="cnt">×' + n + '</span>' : '');
          cd.querySelector('b').textContent = name; cd.querySelector('small').textContent = sub;
        }
        function render() {
          var body = sh.body; body.innerHTML = '';
          var grid;
          if (tab === 'plants') {
            var have = PLANTS.filter(function (P) { return st.book[P.k] > 0; }).length;
            addEl(body, 'div', 'og-sec', 'Zebrane rośliny: ' + have + ' z ' + PLANTS.length);
            grid = addEl(body, 'div', 'og-grid');
            PLANTS.forEach(function (P) {
              var n = st.book[P.k] || 0;
              card(grid, thumbUrl(P, 112, !n), n ? P.n : '???', n ? (P.rare ? 'rzadki okaz' : stageName(P, 4)) : P.lv > lvl ? 'poziom ' + P.lv : 'jeszcze nie', n, (n ? ' have' : '') + (P.rare ? ' rare' : ''));
            });
          } else if (tab === 'pantry') {
            var kinds = PLANTS.filter(function (P) { return pantryN(P.k) > 0; }), tot = 0;
            kinds.forEach(function (P) { tot += pantryN(P.k); });
            addEl(body, 'div', 'og-sec', 'W spiżarni: ' + tot);
            if (!kinds.length) addEl(body, 'p', 'og-muted', 'Pusto. Zebrane plony trafiają tutaj.');
            grid = addEl(body, 'div', 'og-grid');
            kinds.forEach(function (P) { card(grid, thumbUrl(P, 112, false), P.n, '', pantryN(P.k), ' have'); });
            addEl(body, 'p', 'og-muted', 'Plony ze spiżarni oddajesz zwierzątkom w zamówieniach.');
          } else {
            var got = BFLY.filter(function (B) { return st.bfly[B.k] > 0; }).length;
            addEl(body, 'div', 'og-sec', 'Złapane motyle: ' + got + ' z ' + BFLY.length);
            grid = addEl(body, 'div', 'og-grid');
            BFLY.forEach(function (B) { var n = st.bfly[B.k] || 0; card(grid, bflyUrl(B, 112, !n), n ? B.n : '???', n ? 'motyl' : 'jeszcze nie', n, n ? ' have' : ''); });
            addEl(body, 'p', 'og-muted', 'Motyle czasem przylatują do ogródka. Dotknij motyla, żeby go złapać.');
          }
        }
        render();
      }

      function openOrders() {
        var sh = openSheet('Zamówienia', false, 'orders');
        function render() {
          if (!sh.wrap.isConnected) return;
          var body = sh.body, now = Date.now(); body.innerHTML = '';
          if (!st.orders.length) addEl(body, 'p', 'og-muted', 'Na razie nikt nic nie chce.');
          st.orders.forEach(function (o) {
            var A = ANIMALS[o.a] || ANIMALS[0], ok = canFill(o);
            var cd = addEl(body, 'div', 'og-ord' + (ok ? ' ok' : ''));
            var top = addEl(cd, 'div', 'top');
            addEl(top, 'div', 'an', A.e);
            var tx = addEl(top, 'div', 'tx');
            addEl(tx, 'b', '', A.n); tx.appendChild(document.createTextNode(' chce ' + itemsText(o) + '.'));
            var its = addEl(cd, 'div', 'its');
            Object.keys(o.items).forEach(function (k) {
              var n = o.items[k], h = pantryN(k), it = addEl(its, 'span', 'it' + (h >= n ? ' ok' : ''));
              it.innerHTML = '<img alt="" src="' + thumbUrl(BY[k], 80, false) + '">';
              it.appendChild(document.createTextNode(Math.min(h, n) + '/' + n + (h >= n ? ' ✓' : '')));
            });
            var act = addEl(cd, 'div', 'act');
            addEl(act, 'span', 'rw', ok ? '' : 'nagroda: ' + orderValue(o) + ' ★');
            var no = addEl(act, 'button', 'og-no', 'Nie teraz'); no.type = 'button';
            no.onclick = function () { declineOrder(o); render(); };
            var b = addEl(act, 'button', 'og-buy', ok ? 'Oddaj +' + payFor(o) + ' ★' : 'Oddaj'); b.type = 'button';
            b.disabled = !ok;
            b.onclick = function () { fillOrder(o); render(); };
          });
          if (st.orders.length < maxOrders()) addEl(body, 'p', 'og-muted', ('Następne zamówienie za ' + hoursText(Math.max(60000, st.orderT - now)) + '.').replace('..', '.'));
          addEl(body, 'p', 'og-muted', 'Zebrane plony czekają w spiżarni. Oddaj je zwierzątkom, a dostaniesz gwiazdki.');
        }
        sh.render = render;
        render();
      }

      // ---------- modal (empty can) ----------
      function closeModal() { if (modal) { modal.remove(); modal = null; } }
      function emptyCanModal() {
        closeModal(); closeInfo();
        modal = document.createElement('div'); modal.className = 'ng-panel';
        modal.innerHTML = '<div class="ng-card"><div style="display:flex;justify-content:center">' + svgCan(false).replace('<svg', '<svg style="width:90px;height:76px"') + '</div>' +
          '<h2>Konewka jest pusta</h2><p>Ukończ zestaw w nauce, a konewka się napełni.</p>' +
          '<p class="muted">Każdy zestaw to jedna pełna konewka.' + (wetToday() ? ' Dziś już podlane, rośliny rosną.' : '') + '</p>' +
          '<p class="muted">' + (tankCap() ? 'Beczka na deszczówkę jest pusta. Następna konewka deszczu za ' + hoursText(Math.max(60000, st.tank.t + RAIN - Date.now())) + '.' : 'Beczka na deszczówkę (Sklep, Ulepszenia) zbiera wodę z deszczu.') + '</p>' +
          '<button type="button" class="ng-btn">Dobrze</button></div>';
        modal.querySelector('button.ng-btn').onclick = closeModal;
        modal.addEventListener('pointerdown', function (e) { if (e.target === modal) closeModal(); });
        root.appendChild(modal);
      }
      function useCan() {
        if (watering) return;
        tankFill(Date.now());
        if (!waterLeft()) { emptyCanModal(); return; }
        var now = Date.now(), list = [], growing = 0;
        for (var i = 0; i < plotCount(); i++) if (st.plots[i]) { list.push(i); if (progress(st.plots[i], now) < 1) growing++; }
        if (!list.length) { toast('Najpierw posadź nasionko.'); return; }
        if (!growing) { toast('Wszystko już urosło. Zbierz plony!'); return; }
        var td = today(), fromTank = !cansLeft();
        if (fromTank) { if (st.tank.n >= tankCap()) st.tank.t = now; st.tank.n--; }
        else { if (st.cans.d !== td) st.cans = { d: td, used: 0 }; st.cans.used++; }
        st.wateredDay = td;
        if (st.wet.indexOf(td) < 0) st.wet.push(td);
        var boost = canBoost();
        list.forEach(function (j) { var pl = st.plots[j]; if (progress(pl, now) < 1) pl.extra = (pl.extra || 0) + boost; });
        save();
        ctx.sfx('water');
        watering = { start: performance.now(), per: Math.min(550, 3500 / list.length), list: list, boost: boost, tank: fromTank };
        updateBar();
        ctx.stat('water', 1);
      }

      // ---------- harvest ----------
      function harvest(i) {
        var pl = st.plots[i], P = BY[pl.k], c = cells[i];
        st.plots[i] = null;
        var first = !st.book[P.k];
        st.book[P.k] = (st.book[P.k] || 0) + 1;
        var pt = st.pantry[P.k] = st.pantry[P.k] || { b: 0, f: 0 };
        if (pl.paid > 0) pt.b = (pt.b || 0) + 1; else pt.f = (pt.f || 0) + 1;
        var bee = upV('bee') && Math.random() * 100 < upV('bee');   // the bees helped: one more of the same, as a free-seed crop
        if (bee) { pt.f = (pt.f || 0) + 1; st.book[P.k]++; }
        var back = Math.round((pl.paid || 0) * HARVEST_BACK);
        if (back > 0) ctx.refund(back, 'zbiór: ' + P.n);
        save();
        ctx.sfx('harvest');
        for (var j = 0; j < 12; j++) particles.push({ x: c.baseX, y: c.baseY - c.k * 40, vx: (Math.random() - 0.5) * 220, vy: -120 - Math.random() * 120, life: 0.9, k: 'star', r: 5 });
        var br = bBook.getBoundingClientRect(), cr = cvWrap.getBoundingClientRect();
        flyers.push({ img: thumbCanvas(P, 96, false), x0: c.baseX, y0: c.baseY - c.k * 40, x1: br.left + br.width / 2 - cr.left, y1: Math.min(H - 10, br.top - cr.top), s: Math.max(60, c.k * 90), start: performance.now(), btn: bBook });
        var wanted = st.orders.some(function (o) { return o.items[P.k]; });
        toast((first ? 'Nowość w zielniku: ' : 'Zebrane: ') + P.n + '!' + (bee ? ' Pszczoły pomogły: podwójny plon!' : '') + (back ? ' +' + back + ' ★' : '') + (wanted ? ' Ktoś na to czeka przy bramie.' : ''));
        ctx.stat('harvest', 1);
        if (P.fast) ctx.sticker('fast');
        updateBar();
      }

      // ---------- input ----------
      function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
      function onDown(e) {
        var p = pos(e);
        down = { x: p.x, y: p.y, id: e.pointerId }; drag = null;
        if (!guestAt(p.x, p.y)) {
          var d = decoAt(p.x, p.y);
          if (d) { var dp = decoPos(d); drag = { d: d, ox: p.x - dp.x, oy: p.y - dp.y, moving: false }; }
        }
        try { cv.setPointerCapture(e.pointerId); } catch (er) {}
      }
      function onMove(e) {
        if (!drag || !down || down.id !== e.pointerId) return;
        var p = pos(e);
        if (!drag.moving && Math.hypot(p.x - down.x, p.y - down.y) > 8) { drag.moving = true; closeInfo(); }
        if (drag.moving) {
          var band = Math.max(10, H - skyH - 16);
          drag.d.x = clamp((p.x - drag.ox) / W, 0.03, 0.97);
          drag.d.y = clamp((p.y - drag.oy - skyH - 12) / band, 0, 1);
        }
      }
      function onUp(e) {
        if (!down || down.id !== e.pointerId) return;
        var p = pos(e), moved = Math.hypot(p.x - down.x, p.y - down.y);
        down = null;
        var dr = drag; drag = null;
        if (dr && dr.moving) { save(); ctx.sfx('place'); return; }
        if (moved > 14) return;
        if (info) closeInfo();
        if (Math.hypot(p.x - (W - 38), p.y - skyH * 0.4) < 30) { tapSun(); return; }
        var gs = guestAt(p.x, p.y);
        if (gs) { tapGuest(gs); return; }
        if (gateHit(p.x, p.y)) { openOrders(); return; }
        if (barrelHit(p.x, p.y)) {
          tankFill(Date.now()); var cap = tankCap(), n = st.tank.n;
          toast('Beczka: ' + n + ' z ' + cap + ' ' + plural(cap, 'konewki', 'konewek', 'konewek') + ' wody.' + (n < cap ? ' Następna za ' + hoursText(Math.max(60000, st.tank.t + RAIN - Date.now())) + '.' : ' Pełna!'));
          ctx.sfx('water'); return;
        }
        for (var i = 0; i < cells.length; i++) {
          var c = cells[i];
          if (p.x >= c.x && p.x < c.x + c.w && p.y >= c.y && p.y < c.y + c.h) { tapPlot(i); return; }
        }
        if (dr) { var dp = decoPos(dr.d); labels.push({ x: dp.x, y: dp.y - DB[dr.d.k].h * decoScale() - 18, text: DB[dr.d.k].n, life: 1.8 }); }
      }
      function onCancel() { down = null; if (drag && drag.moving) save(); drag = null; }
      // parent-only: 20 taps in a row on the sun = every plant grows one more day
      var sunTaps = 0, sunLast = 0;
      function tapSun() {
        var t = performance.now();
        sunTaps = t - sunLast < 1500 ? sunTaps + 1 : 1; sunLast = t;
        if (sunTaps < 20) return;
        sunTaps = 0;
        var any = false;
        st.plots.forEach(function (pl) { if (pl) { pl.extra = (pl.extra || 0) + 24 * HOUR; any = true; } });
        if (!any) return;
        save(); updateBar();
        toast('☀ Minął jeden dzień!');
      }
      function tapPlot(i) {
        var c = cells[i];
        if (c.locked) { if (nextPlotLevel()) toast('Nowa grządka na poziomie ' + nextPlotLevel() + '. Albo kup ją w Sklepie, w Ulepszeniach.'); openShop(-1, 'up'); return; }
        var pl = st.plots[i];
        if (!pl) { openShop(i, 'seeds'); return; }
        var p = progress(pl, Date.now());
        if (p >= 1) harvest(i); else showInfo(i);
      }
      cv.addEventListener('pointerdown', onDown);
      cv.addEventListener('pointermove', onMove);
      cv.addEventListener('pointerup', onUp);
      cv.addEventListener('pointercancel', onCancel);
      bShop.onclick = function () { openShop(firstEmpty()); };
      bCan.onclick = useCan;
      banner.onclick = useCan;
      bOrders.onclick = openOrders;
      bBook.onclick = function () { openBook(); };
      chip.onclick = function () { toast('Kompost: ' + st.compost + '. Dotknij rośliny i daj jej kompost.'); };

      // ---------- inbox from other games ----------
      function takeInbox() {
        var arr = null;
        try { arr = JSON.parse(localStorage.getItem(INBOX) || 'null'); localStorage.removeItem(INBOX); } catch (e) { return; }
        if (!Array.isArray(arr) || !arr.length) return;
        var groups = {}, order = [];
        arr.forEach(function (it) {
          if (!it || !BY[it.kind]) return;
          var n = Math.max(1, Math.min(99, Math.floor(+it.n) || 1));
          st.pouch[it.kind] = (st.pouch[it.kind] || 0) + n;
          var f = FROM[it.from] || '';
          if (!groups[f]) { groups[f] = {}; order.push(f); }
          groups[f][it.kind] = (groups[f][it.kind] || 0) + n;
        });
        if (!order.length) return;
        save();
        order.forEach(function (f, gi) {
          var parts = Object.keys(groups[f]).map(function (k) { return BY[k].n + ' ×' + groups[f][k]; });
          later(function () { toast('Nowe nasiona' + (f ? ' ' + f : '') + ': ' + parts.join(', ')); }, 400 + gi * 2300);
        });
        updateBar();
        later(function () { bump(bShop); }, 500);
      }

      // ---------- boot ----------
      var ro = new ResizeObserver(function () { layout(); });
      ro.observe(cvWrap);
      var offS = S.on(function () { if (running) tick(); });
      var iv = setInterval(function () { if (running) tick(); }, 20000);
      spawnGuests(Date.now()); spawnOrders(Date.now()); tankFill(Date.now()); save();
      layout();
      takeInbox();
      updateBar();
      start();
      if (!st.seenHelp) {
        st.seenHelp = true; st.newsV2 = false; st.newsUp = true; save();
        ctx.panel({ title: 'Ogródek', lines: ['Dotknij grządki i posadź nasionko.', 'Każdy zestaw w nauce to pełna konewka. Podlewaj, a rośliny urosną.', 'Zwierzątka przy bramie proszą o plony.', { text: 'Rzeżucha rośnie tylko 20 minut!', muted: true }], button: 'Do ogródka', closable: false });
      } else if (st.newsV2) {
        st.newsV2 = false; save();
        ctx.panel({ title: 'Nowości w ogródku!', lines: ['Każdy zestaw w nauce to pełna konewka.', 'Szybkie roślinki: rzeżucha, szczypiorek, rzodkiewka.', 'Goście, ozdoby i zamówienia od zwierzątek.'], button: 'Do ogródka', closable: false });
      } else if (!st.newsUp) {
        st.newsUp = true; save();
        ctx.panel({ title: 'Nowość: Ulepszenia!', lines: ['W Sklepie jest nowa zakładka Ulepszenia.', 'Beczka na deszczówkę, duża konewka, ul z pszczołami, nowe grządki i więcej.', { text: 'Ulepszenia zostają na zawsze.', muted: true }], button: 'Super!', closable: false });
      }

      return {
        pause: function () { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
        resume: function () { if (running) return; running = true; lastDraw = 0; drawFrame.last = 0; takeInbox(); tick(); start(); },
        destroy: function () {
          running = false; if (raf) cancelAnimationFrame(raf); raf = 0;
          timers.forEach(clearTimeout); clearTimeout(infoTimer); clearInterval(iv);
          ro.disconnect(); offS();
          cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove);
          cv.removeEventListener('pointerup', onUp); cv.removeEventListener('pointercancel', onCancel);
          closeModal();
          root.remove();
        }
      };
    }
  });
})();
