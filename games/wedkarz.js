/*
 * Wędkarz: a fishing trip at a pond. A trip costs 50 ★ and lasts 90 s (the clock stops while a catch card
 * or the pond book is open). Tap or drag on the water to cast (far water = rarer fish), wait for the bobber
 * to dive and tap, then reel: hold to reel in, let go when the needle reaches the red part of the line bar.
 * Every catch goes into the pond book (Księga stawu). Aquarium fish that "escaped" into the pond can be
 * sent to the Akwarium game: their kind id is appended to localStorage 'naukagry.akwarium.inbox'.
 * No stars are paid back inside the game; the reward is the book, stickers, medals and aquarium fish.
 */
(function () {
  'use strict';

  var INK = '#1d2f6f', MUTED = '#5a6690', GOLD = '#e3a008', LVL = '#7a4fc4', RED = '#cf412d';
  var FONT = '"Patrick Hand","Comic Sans MS",cursive';
  var PRICE = 50, TRIP = 90;
  var INBOX = 'naukagry.akwarium.inbox';
  var SIL = 'rgba(29,47,111,.16)';

  // tier 1 zwykła, 2 rzadka, 3 bardzo rzadka; pg = page of the pond book; aq = kind id in Akwarium
  // w = how often it shows up, cm = size range, diff = how hard it pulls (0..1), sh = shadow size
  var KINDS = [
    { k: 'plotka', pl: 'płotka', pg: 'zw', tier: 1, w: 12, cm: [12, 25], diff: 0.12, sh: 0.7, body: '#c9d3dc', fin: '#e2533f', belly: '#f3f6f9', back: '#8ea3b8', b: 0.42, tail: 'fork', ring: '#e2533f' },
    { k: 'ukleja', pl: 'ukleja', pg: 'zw', tier: 1, w: 11, cm: [10, 18], diff: 0.1, sh: 0.6, body: '#dbe5ef', fin: '#bccbdd', belly: '#ffffff', back: '#7d97b8', b: 0.3, tail: 'fork' },
    { k: 'karas', pl: 'karaś', pg: 'zw', tier: 1, w: 11, cm: [12, 30], diff: 0.18, sh: 0.75, body: '#d9a441', fin: '#c0802a', belly: '#f3dc9a', b: 0.62, tail: 'fork', pat: 'scales' },
    { k: 'okon', pl: 'okoń', pg: 'zw', tier: 1, w: 10, cm: [15, 35], diff: 0.24, sh: 0.8, body: '#b9c94a', fin: '#f08a24', belly: '#eef0c0', b: 0.48, tail: 'fork', pat: 'bars', dorsal: 'spiky' },
    { k: 'leszcz', pl: 'leszcz', pg: 'zw', tier: 1, w: 7, cm: [25, 50], diff: 0.3, sh: 1.0, body: '#bfae84', fin: '#6d6450', belly: '#ece2c8', b: 0.72, tail: 'fork' },
    { k: 'lin', pl: 'lin', pg: 'zw', tier: 1, w: 6, cm: [20, 45], diff: 0.3, sh: 0.95, body: '#6f8f3a', fin: '#55702c', belly: '#c8d07a', b: 0.5, tail: 'round', ring: '#e2533f' },
    { k: 'karp', pl: 'karp', pg: 'rz', tier: 2, w: 4, cm: [35, 70], diff: 0.5, sh: 1.25, body: '#c99a4a', fin: '#9a6a2a', belly: '#efd6a0', b: 0.55, tail: 'fork', pat: 'scales', whisk: 1 },
    { k: 'szczupak', pl: 'szczupak', pg: 'rz', tier: 2, w: 3, cm: [45, 90], diff: 0.6, sh: 1.45, body: '#7fa04a', fin: '#b0803c', belly: '#e6ecc0', b: 0.27, tail: 'fork', pat: 'lspots' },
    { k: 'sum', pl: 'sum', pg: 'rz', tier: 3, w: 0.6, cm: [60, 120], diff: 0.72, sh: 1.6, body: '#5d6470', fin: '#4a505c', belly: '#c9ccd4', b: 0.36, tail: 'round', whisk: 2 },
    { k: 'koi', pl: 'karp koi', pg: 'rz', tier: 3, w: 0.6, cm: [40, 75], diff: 0.7, sh: 1.35, body: '#fbfaf5', fin: '#f3efe4', b: 0.52, tail: 'fork', pat: 'koi', whisk: 1 },
    { k: 'zlota', pl: 'złota rybka', pg: 'aq', tier: 2, w: 1.8, cm: [8, 15], diff: 0.28, sh: 0.55, body: '#f6982a', fin: '#fbc75e', belly: '#fbd38a', b: 0.62, tail: 'double', aq: 'zlota' },
    { k: 'gupik', pl: 'gupik', pg: 'aq', tier: 2, w: 1.5, cm: [3, 6], diff: 0.22, sh: 0.45, body: '#a8dcf2', fin: '#f47fb0', b: 0.5, tail: 'fan', pat: 'spots', aq: 'gupik' },
    { k: 'danio', pl: 'danio', pg: 'aq', tier: 2, w: 1.2, cm: [4, 6], diff: 0.3, sh: 0.45, body: '#f4e7b4', fin: '#f4e7b4', b: 0.4, tail: 'fork', pat: 'stripes', aq: 'danio' },
    { k: 'kirysek', pl: 'kirysek', pg: 'aq', tier: 2, w: 1.2, cm: [5, 8], diff: 0.28, sh: 0.5, body: '#cdb48c', fin: '#e2d2b0', belly: '#efe4cc', b: 0.52, tail: 'fork', pat: 'dots', whisk: 1, aq: 'kirysek' },
    { k: 'neonek', pl: 'neonek', pg: 'aq', tier: 3, w: 0.5, cm: [3, 4], diff: 0.35, sh: 0.42, body: '#d9e2ee', fin: '#e8eef6', b: 0.42, tail: 'fork', pat: 'neon', aq: 'neonek' },
    { k: 'skalar', pl: 'skalar', pg: 'aq', tier: 3, w: 0.4, cm: [10, 15], diff: 0.5, sh: 0.6, body: '#f3f1ea', fin: '#e8e2d2', b: 0.9, tail: 'fork', pat: 'bands', dorsal: 'tall', aq: 'skalar' },
    { k: 'bojownik', pl: 'bojownik', pg: 'aq', tier: 3, w: 0.4, cm: [6, 7], diff: 0.5, sh: 0.5, body: '#4466dd', fin: '#c440b4', b: 0.45, tail: 'flow', dorsal: 'flow', aq: 'bojownik' },
    { k: 'but', pl: 'stary but', pg: 'sm', tier: 0, junk: 1, w: 5, cm: [26, 34] },
    { k: 'puszka', pl: 'puszka', pg: 'sm', tier: 0, junk: 1, w: 3, cm: [10, 12] },
    { k: 'galaz', pl: 'gałąź', pg: 'sm', tier: 0, junk: 1, w: 3, cm: [40, 80] }
  ];
  var KB = {};
  KINDS.forEach(function (K) { KB[K.k] = K; });
  var FISH = KINDS.filter(function (K) { return !K.junk; });
  var JUNK = KINDS.filter(function (K) { return K.junk; });
  var PAGES = [
    { id: 'zw', name: 'Zwykłe ryby' },
    { id: 'rz', name: 'Rzadkie ryby' },
    { id: 'aq', name: 'Uciekinierzy z akwarium', note: 'Ktoś wpuścił je do stawu. Złów je i odeślij do akwarium!' },
    { id: 'sm', name: 'Śmieci ze stawu', note: 'Każdy wyłowiony śmieć to czystszy staw.' }
  ];
  var TIER = {
    0: { n: 'śmieć', c: '#8a5a33' },
    1: { n: 'zwykła', c: '#2a8a56' },
    2: { n: 'rzadka', c: '#3f86d8' },
    3: { n: 'bardzo rzadka', c: LVL }
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function plural(n, f1, f2, f5) { if (n === 1) return f1; var d = n % 10, h = n % 100; return d >= 2 && d <= 4 && (h < 12 || h > 14) ? f2 : f5; }
  function seeded(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function pick(list, wf) {
    var tot = 0, i;
    for (i = 0; i < list.length; i++) tot += wf(list[i]);
    var r = Math.random() * tot;
    for (i = 0; i < list.length; i++) { r -= wf(list[i]); if (r <= 0) return list[i]; }
    return list[list.length - 1];
  }
  // free places in the Akwarium tank (MAX_FISH 20 there), counting fish already waiting in the inbox
  function aquariumSpace() {
    var fish = 0, box = 0;
    try { var st = JSON.parse(localStorage.getItem('naukagry.akwarium')); if (st && Array.isArray(st.fish)) fish = st.fish.length; } catch (e) {}
    try { var arr = JSON.parse(localStorage.getItem(INBOX)); if (Array.isArray(arr)) box = arr.length; } catch (e) {}
    return Math.max(0, 20 - fish - box);
  }
  function sendToAquarium(k) {
    try {
      var arr = null;
      try { arr = JSON.parse(localStorage.getItem(INBOX)); } catch (e) { arr = null; }
      if (!Array.isArray(arr)) arr = [];
      arr.push(k);
      localStorage.setItem(INBOX, JSON.stringify(arr));
      return true;
    } catch (e) { return false; }
  }

  // ---------- drawing a catch (facing right, centred at 0,0, length len) ----------
  function shp(c, fn, fill, sil, lw) {
    c.beginPath(); fn();
    c.fillStyle = sil ? SIL : fill; c.fill();
    if (!sil) { c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); }
  }
  function bodyPath(c, a, b) {
    c.moveTo(a, 0);
    c.bezierCurveTo(a * 0.95, -b * 1.3, -a * 0.6, -b * 1.15, -a * 0.95, 0);
    c.bezierCurveTo(-a * 0.6, b * 1.15, a * 0.95, b * 1.3, a, 0);
  }
  function drawFishShape(c, K, len, ph, lw, sil) {
    var a = len / 2, b = a * K.b, tb = Math.min(b, a * 0.55), wag = Math.sin(ph) * 0.22;
    var fin = K.fin;
    // tail
    c.save(); c.translate(-a * 0.86, 0); c.rotate(wag);
    if (K.tail === 'round') {
      shp(c, function () { c.moveTo(0, -tb * 0.3); c.bezierCurveTo(-a * 0.45, -tb * 1.2, -a * 0.7, -tb * 0.7, -a * 0.62, 0); c.bezierCurveTo(-a * 0.7, tb * 0.7, -a * 0.45, tb * 1.2, 0, tb * 0.3); c.closePath(); }, fin, sil, lw);
    } else if (K.tail === 'double') {
      shp(c, function () { c.moveTo(0, 0); c.quadraticCurveTo(-a * 0.5, -tb * 0.5, -a * 0.8, -tb * 1.25); c.quadraticCurveTo(-a * 0.55, -tb * 0.15, -a * 0.75, 0); c.quadraticCurveTo(-a * 0.55, tb * 0.15, -a * 0.8, tb * 1.25); c.quadraticCurveTo(-a * 0.5, tb * 0.5, 0, 0); }, fin, sil, lw);
    } else if (K.tail === 'fan') {
      shp(c, function () { c.moveTo(0, 0); c.lineTo(-a * 0.8, -tb * 1.4); c.quadraticCurveTo(-a * 1.05, 0, -a * 0.8, tb * 1.4); c.closePath(); }, fin, sil, lw);
    } else if (K.tail === 'flow') {
      var tw = Math.sin(ph * 0.8) * tb * 0.2;
      shp(c, function () { c.moveTo(0, 0); c.bezierCurveTo(-a * 0.5, -tb * 2.4, -a * 1.3, -tb * 2.6 + tw, -a * 1.3, -tb * 0.8); c.quadraticCurveTo(-a * 1.1, 0, -a * 1.3, tb * 0.8); c.bezierCurveTo(-a * 1.3, tb * 2.6 - tw, -a * 0.5, tb * 2.4, 0, 0); }, fin, sil, lw);
    } else {
      shp(c, function () { c.moveTo(0, 0); c.lineTo(-a * 0.6, -tb * 1.15); c.quadraticCurveTo(-a * 0.32, 0, -a * 0.6, tb * 1.15); c.closePath(); }, fin, sil, lw);
    }
    c.restore();
    // dorsal and anal fins (behind the body)
    if (K.dorsal === 'tall') {
      shp(c, function () { c.moveTo(-a * 0.05, -b * 0.85); c.quadraticCurveTo(-a * 0.15, -b * 1.9, -a * 0.8, -b * 1.95); c.quadraticCurveTo(-a * 0.55, -b * 1.0, -a * 0.6, -b * 0.4); c.closePath(); }, fin, sil, lw);
      shp(c, function () { c.moveTo(-a * 0.05, b * 0.85); c.quadraticCurveTo(-a * 0.15, b * 1.9, -a * 0.8, b * 1.95); c.quadraticCurveTo(-a * 0.55, b * 1.0, -a * 0.6, b * 0.4); c.closePath(); }, fin, sil, lw);
    } else if (K.dorsal === 'flow') {
      shp(c, function () { c.moveTo(a * 0.1, -b * 0.85); c.bezierCurveTo(-a * 0.2, -b * 2.3, -a * 0.9, -b * 2.1, -a * 1.0, -b * 1.2); c.quadraticCurveTo(-a * 0.7, -b * 0.9, -a * 0.5, -b * 0.6); c.closePath(); }, fin, sil, lw);
      shp(c, function () { c.moveTo(a * 0.1, b * 0.8); c.bezierCurveTo(-a * 0.2, b * 2.5, -a * 0.9, b * 2.3, -a * 1.0, b * 1.3); c.quadraticCurveTo(-a * 0.7, b * 0.9, -a * 0.5, b * 0.6); c.closePath(); }, fin, sil, lw);
    } else if (K.dorsal === 'spiky') {
      shp(c, function () {
        c.moveTo(a * 0.32, -b * 0.82);
        var n = 5;
        for (var i = 0; i < n; i++) {
          var x0 = a * 0.32 - i * a * 0.13;
          c.lineTo(x0 - a * 0.05, -(b * 0.95 + tb * 0.75));
          c.lineTo(x0 - a * 0.13, -b * 0.95);
        }
        c.lineTo(-a * 0.36, -b * 0.75); c.closePath();
      }, fin, sil, lw);
      shp(c, function () { c.moveTo(-a * 0.25, b * 0.8); c.quadraticCurveTo(-a * 0.4, b + tb * 0.4, -a * 0.55, b + tb * 0.3); c.lineTo(-a * 0.55, b * 0.55); c.closePath(); }, fin, sil, lw);
    } else {
      shp(c, function () { c.moveTo(a * 0.15, -b * 0.88); c.quadraticCurveTo(-a * 0.05, -(b + tb * 0.6), -a * 0.35, -(b + tb * 0.5)); c.lineTo(-a * 0.42, -b * 0.7); c.closePath(); }, fin, sil, lw);
      shp(c, function () { c.moveTo(-a * 0.25, b * 0.8); c.quadraticCurveTo(-a * 0.4, b + tb * 0.35, -a * 0.55, b + tb * 0.25); c.lineTo(-a * 0.55, b * 0.55); c.closePath(); }, fin, sil, lw);
    }
    // body
    shp(c, function () { bodyPath(c, a, b); }, K.body, sil, lw);
    if (sil) return;
    c.save(); c.beginPath(); bodyPath(c, a, b); c.clip();
    if (K.back) { c.fillStyle = K.back; c.globalAlpha = 0.55; c.beginPath(); c.ellipse(0, -b * 1.05, a * 1.1, b * 0.55, 0, 0, 7); c.fill(); c.globalAlpha = 1; }
    if (K.belly) { c.fillStyle = K.belly; c.beginPath(); c.ellipse(a * 0.05, b * 0.95, a * 1.05, b * 0.6, 0, 0, 7); c.fill(); }
    var i, j;
    if (K.pat === 'scales') {
      c.strokeStyle = 'rgba(29,47,111,.22)'; c.lineWidth = lw * 0.7;
      var st = a * 0.17;
      for (i = 0; i < 9; i++) for (j = -3; j <= 3; j++) {
        var sx = a * 0.42 - i * st + (j % 2 ? st / 2 : 0), sy = j * st * 0.75;
        c.beginPath(); c.arc(sx, sy, st * 0.55, -Math.PI * 0.45, Math.PI * 0.45); c.stroke();
      }
    } else if (K.pat === 'bars') {
      c.fillStyle = 'rgba(45,60,20,.5)';
      [0.42, 0.18, -0.06, -0.3, -0.54].forEach(function (x) { c.beginPath(); c.moveTo(x * a - a * 0.05, -b * 1.2); c.lineTo(x * a + a * 0.05, -b * 1.2); c.lineTo(x * a + a * 0.02, b * 0.35); c.lineTo(x * a - a * 0.02, b * 0.35); c.closePath(); c.fill(); });
    } else if (K.pat === 'bands') {
      c.fillStyle = 'rgba(40,40,50,.8)';
      [0.42, 0.02, -0.42].forEach(function (x) { c.fillRect(x * a - a * 0.05, -b * 1.5, a * 0.1, b * 3); });
    } else if (K.pat === 'lspots') {
      c.fillStyle = '#e6ecc0';
      for (i = 0; i < 7; i++) for (j = -1; j <= 1; j++) { c.beginPath(); c.ellipse(a * 0.5 - i * a * 0.18 + (j ? a * 0.09 : 0), j * b * 0.45, a * 0.05, b * 0.12, 0, 0, 7); c.fill(); }
    } else if (K.pat === 'spots') {
      [[0.25, -0.3, '#f47fb0'], [-0.1, 0.1, '#f2b51d'], [-0.35, -0.35, '#f47fb0'], [0.05, -0.55, '#f2b51d'], [-0.5, 0.15, '#f47fb0']].forEach(function (p) { c.fillStyle = p[2]; c.beginPath(); c.arc(p[0] * a, p[1] * b, a * 0.07, 0, 7); c.fill(); });
    } else if (K.pat === 'dots') {
      c.fillStyle = 'rgba(80,60,30,.6)';
      [[0.3, -0.4], [0.05, -0.15], [-0.2, -0.45], [-0.15, 0.2], [-0.45, -0.1], [0.2, 0.15], [-0.6, 0.2]].forEach(function (p) { c.beginPath(); c.arc(p[0] * a, p[1] * b, a * 0.045, 0, 7); c.fill(); });
    } else if (K.pat === 'koi') {
      c.fillStyle = '#e2533f';
      c.beginPath(); c.ellipse(a * 0.45, -b * 0.4, a * 0.22, b * 0.5, 0.3, 0, 7); c.fill();
      c.beginPath(); c.ellipse(-a * 0.15, -b * 0.6, a * 0.28, b * 0.55, -0.2, 0, 7); c.fill();
      c.fillStyle = '#f39a2a';
      c.beginPath(); c.ellipse(-a * 0.55, b * 0.1, a * 0.16, b * 0.4, 0, 0, 7); c.fill();
    } else if (K.pat === 'stripes') {
      c.fillStyle = '#3a56b0';
      [-0.42, -0.08, 0.26].forEach(function (y) { c.fillRect(-a * 0.95, y * b - b * 0.08, a * 1.6, b * 0.16); });
    } else if (K.pat === 'neon') {
      c.fillStyle = '#2fc4f0'; c.fillRect(-a * 0.8, -b * 0.32, a * 1.55, b * 0.3);
      c.fillStyle = '#e8344a'; c.fillRect(-a * 0.9, b * 0.05, a * 0.85, b * 1.2);
    }
    c.restore();
    // outline only: a fill here would paint over the patterns, belly and back above
    c.beginPath(); bodyPath(c, a, b); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
    // gill line, pectoral fin
    c.strokeStyle = 'rgba(29,47,111,.45)'; c.lineWidth = lw * 0.8;
    c.beginPath(); c.moveTo(a * 0.48, -b * 0.5); c.quadraticCurveTo(a * 0.36, 0, a * 0.48, b * 0.5); c.stroke();
    shp(c, function () { c.ellipse(a * 0.22, b * 0.3, a * 0.16, Math.min(b, a * 0.5) * 0.22, 0.5, 0, 7); }, fin, false, lw * 0.8);
    // whiskers
    if (K.whisk) {
      var wl = K.whisk === 2 ? a * 0.7 : a * 0.3;
      c.strokeStyle = INK; c.lineWidth = lw * 0.8;
      c.beginPath(); c.moveTo(a * 0.92, b * 0.15); c.quadraticCurveTo(a * 0.95 + wl * 0.55, b * 0.3 + wl * 0.1, a * 0.88 + wl * 0.75, b * 0.2 + wl * 0.8); c.stroke();
      c.beginPath(); c.moveTo(a * 0.9, b * 0.1); c.quadraticCurveTo(a + wl * 0.6, b * 0.1, a + wl * 0.8, b * 0.1 + wl * 0.45); c.stroke();
    }
    // eye
    var er = clamp(a * 0.1, 1.8, Math.max(1.8, b * 0.32));
    var ex = a * 0.64, ey = -Math.min(b, a * 0.6) * 0.2;
    if (K.ring) { c.fillStyle = K.ring; c.beginPath(); c.arc(ex, ey, er * 1.35, 0, 7); c.fill(); }
    c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, ey, er, 0, 7); c.fill(); c.lineWidth = lw * 0.8; c.strokeStyle = INK; c.stroke();
    c.fillStyle = INK; c.beginPath(); c.arc(ex + er * 0.2, ey, er * 0.58, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(ex + er * 0.05, ey - er * 0.25, er * 0.22, 0, 7); c.fill();
    // smile
    c.strokeStyle = INK; c.lineWidth = lw * 0.8;
    c.beginPath(); c.arc(a * 0.83, b * 0.08, a * 0.07, Math.PI * 0.15, Math.PI * 0.75); c.stroke();
  }
  function drawJunk(c, K, len, lw, sil) {
    var s = len / 100;
    c.save(); c.scale(s, s); lw = lw / s;
    if (K.k === 'but') {
      shp(c, function () { c.moveTo(-34, -40); c.lineTo(2, -40); c.lineTo(4, -2); c.quadraticCurveTo(36, 0, 46, 14); c.lineTo(46, 24); c.lineTo(-38, 24); c.lineTo(-38, 8); c.closePath(); }, '#9a6a3a', sil, lw);
      if (!sil) {
        shp(c, function () { c.rect(-40, 22, 88, 9); }, '#5a3a20', false, lw);
        c.strokeStyle = INK; c.lineWidth = lw * 0.8;
        for (var i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-26 + i * 6, -30 + i * 7); c.lineTo(-6 + i * 4, -26 + i * 7); c.stroke(); }
        shp(c, function () { c.rect(-36, -46, 40, 8); }, '#b07a46', false, lw);
        c.fillStyle = '#7cc4e8'; c.beginPath(); c.moveTo(30, 34); c.quadraticCurveTo(26, 42, 30, 44); c.quadraticCurveTo(34, 42, 30, 34); c.fill();
      }
    } else if (K.k === 'puszka') {
      c.rotate(-0.35);
      shp(c, function () { c.rect(-20, -34, 40, 68); }, '#c8d0dc', sil, lw);
      if (!sil) {
        shp(c, function () { c.rect(-20, -18, 40, 34); }, '#e2533f', false, lw);
        c.strokeStyle = '#fff'; c.lineWidth = lw * 1.4; c.beginPath(); c.moveTo(-14, 0); c.quadraticCurveTo(-4, -10, 4, 0); c.quadraticCurveTo(10, 8, 16, -2); c.stroke();
        shp(c, function () { c.ellipse(0, -34, 20, 6, 0, 0, 7); }, '#dfe5ee', false, lw);
        shp(c, function () { c.ellipse(4, -35, 6, 2.5, 0, 0, 7); }, '#9aa6b8', false, lw * 0.7);
      }
    } else {
      c.lineCap = 'round';
      var br = function (w) {
        c.beginPath(); c.moveTo(-46, 12); c.quadraticCurveTo(0, -4, 46, -8);
        c.moveTo(-8, 3); c.quadraticCurveTo(6, -14, 18, -28);
        c.moveTo(16, -4); c.quadraticCurveTo(26, 8, 36, 18);
        c.lineWidth = w; c.stroke();
      };
      if (!sil) { c.strokeStyle = INK; br(11); }
      c.strokeStyle = sil ? SIL : '#8a5a33'; br(sil ? 9 : 6.5);
      if (!sil) {
        [[18, -30, -0.6], [38, 20, 0.7], [46, -10, 0.1], [-30, 6, -0.3]].forEach(function (p) {
          shp(c, function () { c.ellipse(p[0], p[1], 9, 4.5, p[2], 0, 7); }, '#3fae5f', false, lw);
        });
      }
    }
    c.restore();
  }
  // fits a catch into a box of w x h
  function catchLen(K, w, h) {
    if (K.junk) return Math.min(w * 0.6, h * 0.92);
    var tall = K.dorsal === 'tall' ? 4.0 : K.dorsal === 'flow' ? 4.6 : 1.0 + 2 * K.b + 0.2;
    var long = K.tail === 'flow' ? 2.6 : 2.0;
    return Math.min((w * 0.9) / (long / 2 * 1.3), (h * 0.9) / (tall / 2));
  }
  function drawCatch(c, K, x, y, len, ph, sil) {
    c.save(); c.translate(x, y);
    c.lineJoin = 'round'; c.lineCap = 'round';
    var lw = Math.max(1.3, len / 45);
    if (K.junk) drawJunk(c, K, len, lw, sil);
    else { c.translate(K.tail === 'flow' ? len * 0.15 : len * 0.08, 0); drawFishShape(c, K, len, ph || 0, lw, sil); }
    c.restore();
  }

  NG.register('wedkarz', {
    meta: {
      name: 'Wędkarz', price: '50 ★ za wyprawę', bg: '#d8eef2', music: 'water',
      pic: '<circle cx="18" cy="14" r="8" fill="#f2b51d"/>' +
        '<path d="M0 42 q30 -8 60 -2 t60 0 v32 h-120 z" fill="#5aa9dc" stroke="#1d2f6f" stroke-width="2"/>' +
        '<path d="M14 60 q8 -3 16 0 M74 64 q8 -3 16 0" fill="none" stroke="#bfe1f7" stroke-width="2" stroke-linecap="round"/>' +
        '<path d="M6 44 v-18 M11 44 v-24 M16 44 v-14" stroke="#2a8a56" stroke-width="2.5" stroke-linecap="round"/><rect x="9" y="16" width="4" height="9" rx="2" fill="#8a5a33"/>' +
        '<path d="M117 72 L88 6" stroke="#8a5a33" stroke-width="3.5" stroke-linecap="round"/><circle cx="108" cy="52" r="3.5" fill="#fff" stroke="#1d2f6f" stroke-width="1.5"/>' +
        '<path d="M88 6 Q72 18 64 50" fill="none" stroke="#1d2f6f" stroke-width="1"/>' +
        '<ellipse cx="64" cy="54" rx="10" ry="3" fill="none" stroke="#fff" stroke-width="1.5"/>' +
        '<circle cx="64" cy="51" r="4.5" fill="#fff" stroke="#1d2f6f" stroke-width="1.5"/><path d="M59.5 51 a4.5 4.5 0 0 1 9 0 z" fill="#e2533f" stroke="#1d2f6f" stroke-width="1.5"/>' +
        '<path d="M28 36 q10 -12 22 -4 q-10 9 -22 4 z M28 36 l-8 -5 l2 10 z" fill="#f6982a" stroke="#1d2f6f" stroke-width="2" stroke-linejoin="round"/><circle cx="44" cy="32" r="1.4" fill="#1d2f6f"/>' +
        '<circle cx="54" cy="40" r="1.5" fill="#bfe1f7"/><circle cx="24" cy="44" r="1.5" fill="#bfe1f7"/>'
    },
    medals: [
      { id: 'f10', stat: 'fish', at: 10, tier: 1, text: '10 ryb' },
      { id: 'f40', stat: 'fish', at: 40, tier: 2, text: '40 ryb' },
      { id: 'f120', stat: 'fish', at: 120, tier: 3, text: '120 ryb' }
    ],
    quests: [
      { id: 'fish', stat: 'fish', n: [3, 5], text: 'Złów {n} {ryby} w Wędkarzu', forms: ['rybę', 'ryby', 'ryb'] }
    ],
    stickers: [
      { id: 'first-fish', emoji: '🎣', name: 'Pierwsza ryba' },
      { id: 'first-rare', emoji: '✨', name: 'Pierwsza rzadka ryba' },
      { id: 'boot', emoji: '👢', name: 'Stary but' },
      { id: 'aquarium', emoji: '🐠', name: 'Rybka do akwarium' },
      { id: 'page', emoji: '📖', name: 'Pełna strona księgi' }
    ],

    mount: function (el, ctx) {
      var save = ctx.load({ book: {}, diff: 'easy', trips: 0, total: 0, aq: 0 });
      if (!save.book || typeof save.book !== 'object') save.book = {};
      if (save.diff !== 'hard') save.diff = 'easy';
      function persist() { ctx.save(save); }

      var reduce = false;
      try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

      var root = document.createElement('div');
      root.style.cssText = 'position:absolute;inset:0;overflow:hidden;touch-action:none';
      var css = document.createElement('style');
      css.textContent = [
        '.wk-bookbtn{position:absolute;top:8px;right:8px;z-index:4;min-height:44px;border:3px solid #1d2f6f;background:#fff;border-radius:14px;padding:3px 12px;font-size:1.15rem;box-shadow:0 3px 0 rgba(29,47,111,.25);display:flex;align-items:center;gap:6px}',
        '.wk-bookbtn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(29,47,111,.25)}',
        '.wk-card{gap:8px}',
        '.wk-card canvas{width:240px;height:120px;max-width:100%;align-self:center;border-radius:16px;background:linear-gradient(#d8f0fb,#a9d8f0)}',
        '.wk-card h2{font-size:2rem}',
        '.wk-name{font-size:1.8rem;line-height:1}',
        '.wk-chips{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}',
        '.wk-chip{border-radius:999px;padding:1px 10px;font-size:1rem;color:#fff}',
        '.wk-chip.new{background:#fff;color:#7a4fc4;border:2px solid #7a4fc4}',
        '.wk-card .ng-btn{white-space:nowrap}',
        '@media (max-width:400px){.wk-card .ng-btn:not(.sec){font-size:1.3rem;padding-left:12px;padding-right:12px}}',
        '.wk-book{position:absolute;inset:0;z-index:25;background:rgba(29,47,111,.35);display:flex;align-items:flex-end;justify-content:center}',
        '.wk-book-in{background:#fff;border:3px solid #1d2f6f;border-bottom:none;border-radius:22px 22px 0 0;width:100%;max-width:760px;max-height:92%;display:flex;flex-direction:column;animation:ngpop .3s ease}',
        '.wk-book-hd{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px 8px;border-bottom:2px solid #d4def0}',
        '.wk-book-hd h2{margin:0;font-weight:400;font-size:1.7rem;line-height:1}',
        '.wk-book-hd small{color:#5a6690;font-size:1rem;margin-left:6px}',
        '.wk-book-hd button{border:2px solid #1d2f6f;background:#fff;border-radius:12px;padding:4px 12px;font-size:1.15rem;min-height:44px}',
        '.wk-book-bd{overflow-y:auto;touch-action:pan-y;-webkit-overflow-scrolling:touch;padding:8px 14px calc(18px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:12px}',
        '.wk-sec h3{margin:0 0 2px;font-weight:400;font-size:1.3rem}',
        '.wk-sec h3 .ok{color:#2a8a56}',
        '.wk-sec p{margin:0 0 6px;color:#5a6690;font-size:1rem;line-height:1.15}',
        '.wk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(98px,1fr));gap:8px}',
        '.wk-cell{border:2px dashed #d4def0;border-radius:14px;padding:4px 2px 6px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:1px}',
        '.wk-cell.got{border:2px solid #1d2f6f;background:#f4faff}',
        '.wk-cell canvas{width:92px;height:52px}',
        '.wk-cell b{font-weight:400;font-size:1.05rem;line-height:1.05}',
        '.wk-cell small{font-size:.85rem;color:#5a6690;line-height:1.05}',
        '.wk-cell i{font-style:normal;font-size:.8rem;border-radius:999px;color:#fff;padding:0 7px;margin-top:2px}'
      ].join('\n');
      root.appendChild(css);
      var canvas = document.createElement('canvas');
      canvas.style.cssText = 'display:block;width:100%;height:100%';
      root.appendChild(canvas);
      var bookBtn = document.createElement('button');
      bookBtn.type = 'button'; bookBtn.className = 'wk-bookbtn';
      bookBtn.innerHTML = '<span aria-hidden="true">📖</span><span>Księga</span>';
      root.appendChild(bookBtn);
      el.appendChild(root);
      var g = canvas.getContext('2d');

      var W = 1, H = 1, dpr = 1, L = null, u = 1;
      var raf = 0, last = 0, paused = false, alive = true, T = 0;
      var phase = 'menu', phaseT = 0;
      var trip = null;                 // { left, fish, items: [], newKinds, aqSent, timeUp }
      var shadows = [], ripples = [], drops = [], clouds = [], laters = [];
      var bob = null;                  // { x, y, sx, sy, tx, ty, t, dur, dip, nib }
      var aim = null, target = null, junkK = null, waitT = 0, biteLeft = 0;
      var reel = null, holding = false, holdId = null, reelTick = 0, handleAng = 0;
      var flash = { text: '', t: 0, big: false };
      var panel = null, cardEl = null, bookEl = null, lastSummary = null, panelKind = 'start';

      // ---------- layout ----------
      function layout() {
        u = clamp(Math.min(W / 400, H / 700), 0.8, 1.7);
        var skyH = Math.round(H * 0.14) + 20;
        var waterTop = skyH + Math.max(14, H * 0.035);
        var pierTop = H - clamp(H * 0.2, 120, 200);
        var R = seeded(7 + Math.round(W / 50));
        var trees = [], pads = [], reeds = [];
        for (var x = -10; x < W + 30; x += rnd2(R, 34, 60) * u) trees.push({ x: x, r: rnd2(R, 14, 24) * u, c: R() < 0.5 ? '#5fae4a' : '#4f9a40' });
        var nP = Math.round(clamp(W / 120, 3, 8));
        for (var i = 0; i < nP; i++) {
          var side = i % 2 ? 1 : 0;
          pads.push({ x: side ? W - rnd2(R, 20, W * 0.22) : rnd2(R, 20, W * 0.22), y: lerp(waterTop + 24 * u, pierTop - 30 * u, R()), r: rnd2(R, 10, 16) * u, a: R() * 6, flower: R() < 0.35 });
        }
        [[0.02, 1], [0.06, 1.25], [0.1, 0.9], [0.9, 1.1], [0.95, 1.3], [0.985, 0.95]].forEach(function (p) { reeds.push({ x: p[0] * W, h: p[1] * 50 * u, ph: R() * 6 }); });
        L = { skyH: skyH, waterTop: waterTop, pierTop: pierTop, trees: trees, pads: pads, reeds: reeds,
          tip: { x: W * 0.5 + 14 * u, y: pierTop - 44 * u }, butt: { x: W * 0.5 + 78 * u, y: H + 14 },
          near: pierTop - 46 * u, far: waterTop + 22 * u };
        if (!clouds.length) for (var c = 0; c < 3; c++) clouds.push({ x: Math.random() * W, y: rnd(0.25, 0.7), s: rnd(0.8, 1.3), v: rnd(4, 9) });
      }
      function rnd2(R, a, b) { return a + R() * (b - a); }
      function resize() {
        var r = el.getBoundingClientRect();
        W = Math.max(1, r.width); H = Math.max(1, r.height);
        dpr = Math.min(3, window.devicePixelRatio || 1);
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        var oldL = L;
        layout();
        if (oldL) {
          // keep things inside the water after a resize
          shadows.forEach(function (s) { s.x = clamp(s.x, 10, W - 10); s.y = yOfDepth(s.d); s.tx = clamp(s.tx, 20, W - 20); s.ty = yOfDepth(s.home); });
          if (bob) { bob.x = clamp(bob.x, 20, W - 20); bob.y = clamp(bob.y, L.far, L.near); }
        }
        draw();
      }
      var ro = new ResizeObserver(resize);
      ro.observe(el);

      function depthOf(y) { return clamp((L.near - y) / (L.near - L.far), 0, 1); }
      function yOfDepth(d) { return lerp(L.near, L.far, clamp(d, 0, 1)); }
      function scaleAt(y) { return (1 - 0.42 * depthOf(y)) * u; }

      // ---------- fish shadows ----------
      function rollKind(d) {
        var hard = save.diff === 'hard';
        return pick(FISH, function (K) {
          var w = K.w;
          if (K.tier === 2) w *= 0.5 + 1.0 * d;
          if (K.tier === 3) w *= 0.3 + 1.4 * d;
          if (hard && K.tier >= 2) w *= 1.3;
          return w;
        });
      }
      function wantShadows() { return W > 700 ? 6 : 5; }
      function spawnShadow(fromEdge, K, at) {
        var d = Math.random();
        var s = {
          K: K || rollKind(d), d: d, home: d, x: 0, y: 0, ang: Math.random() * 6.28, ph: Math.random() * 6,
          tx: 0, ty: 0, retarget: 0, state: 'swim', alpha: fromEdge ? 0 : 1, sp: rnd(14, 24), fleeT: 0, glint: Math.random() * 3
        };
        if (at) { s.x = at.x; s.y = at.y; s.d = s.home = depthOf(at.y); }
        else if (fromEdge) { s.x = Math.random() < 0.5 ? -20 : W + 20; s.y = yOfDepth(d); }
        else { s.x = rnd(30, W - 30); s.y = yOfDepth(d); }
        s.ang = s.x < 0 ? 0 : s.x > W ? Math.PI : s.ang;
        newWander(s);
        shadows.push(s);
        return s;
      }
      function newWander(s) {
        s.tx = rnd(30, W - 30);
        s.ty = yOfDepth(clamp(s.home + rnd(-0.18, 0.18), 0.03, 0.97));
        s.retarget = rnd(4, 9);
      }
      function turnTo(s, ang, k) {
        var da = Math.atan2(Math.sin(ang - s.ang), Math.cos(ang - s.ang));
        s.ang += da * Math.min(1, k);
      }
      function stepShadows(dt) {
        for (var i = shadows.length - 1; i >= 0; i--) {
          var s = shadows[i];
          s.ph += dt * 5; s.glint += dt;
          if (s.alpha < 1) s.alpha = Math.min(1, s.alpha + dt * 0.8);
          var sc = scaleAt(s.y), speed = s.sp * sc, tx = s.tx, ty = s.ty;
          if (s.state === 'come' && bob) {
            tx = bob.x - Math.cos(s.ang) * 4 * sc; ty = bob.y + 3 * sc;
            var dd = Math.hypot(tx - s.x, ty - s.y);
            speed = Math.max(55 * u, dd / 2.2);
            if (dd < 5 * sc) { s.state = 'nibble'; s.x = tx; s.y = ty; }
          } else if (s.state === 'nibble' && bob) {
            tx = bob.x; ty = bob.y + 3 * sc; speed = 2 * sc;
          } else if (s.state === 'flee') {
            s.fleeT -= dt; speed = 80 * u;
            if (s.fleeT <= 0) { s.state = 'swim'; newWander(s); }
          } else {
            s.retarget -= dt;
            if (s.retarget <= 0 || Math.hypot(tx - s.x, ty - s.y) < 10) newWander(s);
          }
          if (s.state !== 'nibble') {
            turnTo(s, Math.atan2(ty - s.y, tx - s.x), dt * (s.state === 'come' ? 6 : 2));
            s.x += Math.cos(s.ang) * speed * dt;
            s.y += Math.sin(s.ang) * speed * dt * 0.7;
          } else {
            s.x += (tx - s.x) * Math.min(1, dt * 4); s.y += (ty - s.y) * Math.min(1, dt * 4);
          }
          if (s.state !== 'come' && s.state !== 'nibble') s.y = clamp(s.y, L.far, L.near);
          s.d = depthOf(s.y);
        }
        if (shadows.length < wantShadows() && !laters.some(function (l) { return l.tag === 'spawn'; })) later(rnd(1, 2.5), function () { if (shadows.length < wantShadows()) spawnShadow(true); }, 'spawn');
      }
      function later(t, fn, tag) { laters.push({ t: t, fn: fn, tag: tag }); }

      // ---------- effects ----------
      function ripple(x, y, max, life) { ripples.push({ x: x, y: y, r: 2, max: max, life: life || 1, t: 0 }); }
      function splash(x, y, n, sc) {
        ripple(x, y, 26 * sc, 1);
        ripple(x, y, 16 * sc, 0.8);
        if (reduce) return;
        for (var i = 0; i < n; i++) drops.push({ x: x, y: y, vx: rnd(-50, 50) * sc, vy: rnd(-120, -60) * sc, life: rnd(0.4, 0.7), t: 0, r: rnd(1.5, 3) * sc });
      }
      function say(text, big) { flash.text = text; flash.t = big ? 1.4 : 1.9; flash.big = !!big; }

      // ---------- trip flow ----------
      function startTrip() {
        trip = { left: TRIP, fish: 0, items: [], newKinds: 0, aqSent: 0, timeUp: false };
        bob = null; aim = null; target = null; reel = null; holding = false;
        setPhase('idle');
        say('Dotknij wody, żeby zarzucić!');
      }
      function setPhase(p) { phase = p; phaseT = 0; }
      function clampTarget(x, y) { return { x: clamp(x, 24, W - 24), y: clamp(y, L.far, L.near) }; }
      function cast(pt) {
        var t = clampTarget(pt.x, pt.y);
        var dist = Math.hypot(t.x - L.tip.x, t.y - L.tip.y);
        bob = { x: L.tip.x, y: L.tip.y, sx: L.tip.x, sy: L.tip.y, tx: t.x, ty: t.y, t: 0, dur: 0.45 + 0.35 * dist / H, dip: 0, nib: 0, arc: dist * 0.35 };
        ctx.sfx('whoosh');
        setPhase('cast');
      }
      function landed() {
        var sc = scaleAt(bob.y);
        splash(bob.x, bob.y, 6, sc);
        ctx.sfx('splash');
        setPhase('wait');
        target = null; junkK = null;
        if (Math.random() < 0.1) {
          junkK = pick(JUNK, function (K) { return K.w; });
          waitT = rnd(1.8, 3.2);
          return;
        }
        var best = null, bd = 125 * u;
        shadows.forEach(function (s) { var dd = Math.hypot(s.x - bob.x, s.y - bob.y); if (s.state === 'swim' && dd < bd) { bd = dd; best = s; } });
        if (best) { target = best; best.state = 'come'; }
        waitT = 1.2;
      }
      function startNibble() { setPhase('nibble'); waitT = rnd(0.7, 1.4); bob.nibAt = [0.25, waitT * 0.6]; }
      function startBite() {
        setPhase('bite');
        biteLeft = save.diff === 'hard' ? 1.1 : 1.7;
        var sc = scaleAt(bob.y);
        splash(bob.x, bob.y, 4, sc);
        ctx.sfx('water');
        ctx.sfx('pop');
      }
      function missBite() {
        if (target) { target.state = 'flee'; target.fleeT = 1.2; target.ang = Math.atan2(target.y - L.tip.y, target.x - L.tip.x) + rnd(-0.5, 0.5); }
        target = null; junkK = null;
        say('Uciekła! Spróbuj jeszcze raz.');
        startRetrieve();
      }
      function hook() {
        var K = target ? target.K : junkK;
        if (target) { shadows.splice(shadows.indexOf(target), 1); }
        target = null;
        var cm = Math.round(lerp(K.cm[0], K.cm[1], Math.pow(Math.random(), 1.4)));
        reel = { K: K, cm: cm, T: 0.3, prog: 0, red: 0, pull: 0, pullT: rnd(0.8, 1.6), x0: bob.x, y0: bob.y, x: bob.x, y: bob.y, wig: 0 };
        holding = false; bob = null;
        ctx.sfx('reel');
        setPhase('reel');
      }
      function startRetrieve() {
        if (!bob) { afterAttempt(); return; }
        bob.sx = bob.x; bob.sy = bob.y; bob.t = 0; bob.dip = 0;
        setPhase('retrieve');
      }
      function afterAttempt() {
        bob = null; reel = null; holding = false;
        if (trip && (trip.left <= 0 || trip.timeUp)) endTrip();
        else setPhase('idle');
      }
      function zoneOf(r) {
        var hi = (save.diff === 'hard' ? 0.72 : 0.8) - r.K.diff * 0.16, lo = 0.2;
        return { lo: lo, hi: hi };
      }
      function stepReel(dt) {
        var r = reel, K = r.K, d = K.junk ? 0 : K.diff, hard = save.diff === 'hard';
        var z = zoneOf(r);
        if (!K.junk) {
          r.pullT -= dt;
          if (r.pullT <= 0) {
            if (r.pull > 0) { r.pull = 0; r.pullT = rnd(1.3, 2.6) * (1.15 - d * 0.5) * (hard ? 1 : 1.25); }
            else { r.pull = 0.32 + d * 0.55; r.pullT = rnd(0.45, 0.85); splash(r.x, r.y, 3, scaleAt(r.y)); ctx.sfx('splash'); }
          }
        }
        r.T = clamp(r.T + ((holding ? 0.55 : -0.75) + r.pull) * dt, 0, 1);
        var zone = r.T > z.hi ? 'red' : r.T < z.lo ? 'low' : 'ok';
        r.zone = zone;
        var rate = hard ? 1 / (2.8 + d * 4.2) : 1 / (2.4 + d * 3.6);
        if (K.junk) rate = 1 / 3.2;
        if (holding) {
          if (zone === 'ok') r.prog += rate * dt;
          else if (zone === 'low') r.prog += rate * 0.4 * dt;
          else r.prog -= rate * 0.25 * dt;
          reelTick -= dt; handleAng += dt * (zone === 'red' ? 4 : 12);
          if (reelTick <= 0) { ctx.sfx('reel'); reelTick = 0.11; }
        } else r.prog -= (0.015 + d * 0.035) * dt;
        r.prog = Math.max(0, r.prog);
        if (zone === 'red') r.red += dt; else r.red = Math.max(0, r.red - dt * 0.6);
        var limit = hard ? 1.5 : 2.4;
        // fish position: from the bite spot to just under the rod tip
        r.wig += dt * (r.pull > 0 ? 11 : 5);
        var ex = L.tip.x, ey = L.near + 12 * u;
        var side = Math.sin(r.wig) * (r.pull > 0 ? 16 : 7) * u * (1 - r.prog * 0.6);
        r.x = lerp(r.x0, ex, r.prog) + side;
        r.y = lerp(r.y0, ey, r.prog);
        if (r.red > limit) { escapeReel(); return; }
        if (r.prog >= 1) { landCatch(); return; }
        // time is up: give the hooked fish ~10 s of no progress, then let it swim away and end the trip
        if (trip && trip.timeUp) {
          if (r.prog > (r.best || 0) + 0.02) { r.best = r.prog; r.stall = 0; }
          else r.stall = (r.stall || 0) + dt;
          if (r.stall > 10) escapeReel(true);
        }
      }
      function escapeReel(gentle) {
        var r = reel;
        ctx.sfx(gentle ? 'splash' : 'lose');
        if (!r.K.junk) { var s = spawnShadow(false, r.K, { x: r.x, y: clamp(r.y, L.far, L.near) }); s.state = 'flee'; s.fleeT = 1.4; s.ang = -Math.PI / 2 + rnd(-0.6, 0.6); }
        if (gentle) say(r.K.junk ? 'Odpadło. Koniec łowienia!' : 'Rybka odpłynęła. Koniec łowienia!');
        else say(r.K.junk ? 'Zaczepiło się i odpadło. Jeszcze raz!' : 'Za mocno! Uciekła, ale dalej pływa.');
        reel = null; holding = false;
        bob = { x: r.x, y: r.y, sx: r.x, sy: r.y, tx: 0, ty: 0, t: 0, dur: 0, dip: 0 };
        startRetrieve();
      }

      // ---------- catches ----------
      function landCatch() {
        var r = reel, K = r.K, sc = scaleAt(r.y);
        splash(r.x, r.y, 10, sc * 1.3);
        holding = false;
        var e = save.book[K.k];
        var isNew = !e || !e.n;
        if (!e) e = save.book[K.k] = { n: 0, best: 0 };
        e.n++; e.best = Math.max(e.best || 0, r.cm);
        save.total++;
        persist();
        trip.items.push(K.k);
        if (isNew) trip.newKinds++;
        if (K.junk) {
          ctx.sfx('splash');
          ctx.stat('junk', 1);
          if (K.k === 'but') ctx.sticker('boot');
        } else {
          trip.fish++;
          ctx.sfx(K.tier >= 2 ? 'win' : 'harvest');
          ctx.stat('fish', 1);
          ctx.sticker('first-fish');
          if (K.tier >= 2) { ctx.stat('rare', 1); ctx.sticker('first-rare'); }
          ctx.stat('best', r.cm, 'max');
        }
        if (isNew) checkPages();
        var c = { K: K, cm: r.cm, isNew: isNew };
        reel = null; bob = null;
        setPhase('card');
        later(0.35, function () { if (phase === 'card' && !cardEl) showCard(c); });
      }
      function pageFull(pg) {
        return KINDS.filter(function (K) { return K.pg === pg; }).every(function (K) { return save.book[K.k] && save.book[K.k].n > 0; });
      }
      function checkPages() {
        if (PAGES.some(function (p) { return pageFull(p.id); })) ctx.sticker('page');
      }
      function bookCount() { return KINDS.filter(function (K) { return save.book[K.k] && save.book[K.k].n > 0; }).length; }

      function el2(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
      function makeCanvas(cw, ch) {
        var cv = document.createElement('canvas');
        var r = Math.min(3, window.devicePixelRatio || 1);
        cv.width = Math.round(cw * r); cv.height = Math.round(ch * r);
        var c = cv.getContext('2d'); c.scale(r, r);
        return { cv: cv, c: c };
      }
      function showCard(c) {
        var K = c.K;
        var p = el2('div', 'ng-panel');
        var card = el2('div', 'ng-card wk-card');
        p.appendChild(card);
        card.appendChild(el2('h2', null, K.junk ? 'Ojej, śmieć!' : 'Złowione!'));
        var cc = makeCanvas(240, 120);
        drawCatch(cc.c, K, 120, 62, catchLen(K, 240, 120), 0.6, false);
        card.appendChild(cc.cv);
        card.appendChild(el2('div', 'wk-name', K.pl.charAt(0).toUpperCase() + K.pl.slice(1) + ' · ' + c.cm + ' cm'));
        var chips = el2('div', 'wk-chips');
        var ch = el2('span', 'wk-chip', TIER[K.tier].n); ch.style.background = TIER[K.tier].c; chips.appendChild(ch);
        if (c.isNew) chips.appendChild(el2('span', 'wk-chip new', 'Nowa w księdze!'));
        card.appendChild(chips);
        var done = function () { closeCard(); afterAttempt(); };
        var b1 = el2('button', 'ng-btn'); b1.type = 'button';
        var row = el2('div', 'ng-row');
        if (K.aq && !aquariumSpace()) {
          card.appendChild(el2('p', null, 'Ta rybka uciekła z akwarium, ale akwarium jest pełne.'));
          b1.textContent = 'Wypuść do stawu';
          b1.onclick = function () { ctx.sfx('splash'); done(); };
        } else if (K.aq) {
          card.appendChild(el2('p', null, 'Ta rybka uciekła z akwarium.'));
          b1.textContent = 'Wpuść do akwarium';
          b1.onclick = function () {
            if (sendToAquarium(K.aq)) {
              save.aq = (save.aq || 0) + 1; persist();
              trip.aqSent++;
              ctx.sfx('bubble');
              ctx.sticker('aquarium');
              ctx.toast('Płynie do akwarium!');
            }
            done();
          };
          var b2 = el2('button', 'ng-btn sec', 'Wypuść do stawu'); b2.type = 'button';
          b2.onclick = function () { ctx.sfx('splash'); done(); };
          row.appendChild(b2);
        } else if (K.junk) {
          card.appendChild(el2('p', null, K.k === 'but' ? 'Ktoś zgubił but w stawie!' : 'Staw jest teraz czystszy.'));
          b1.textContent = 'Do kosza';
          b1.onclick = function () { ctx.sfx('place'); done(); };
        } else {
          if (K.tier >= 2) card.appendChild(el2('p', null, K.tier === 3 ? 'Wow! To bardzo rzadka ryba!' : 'Rzadka ryba!'));
          b1.textContent = 'Wypuść i łów dalej';
          b1.onclick = function () { ctx.sfx('splash'); done(); };
        }
        card.insertBefore(b1, null);
        if (row.children.length) card.appendChild(row);
        if (trip && trip.left <= 0) card.appendChild(el2('p', 'muted', 'Czas minął. To ostatnia ryba.'));
        root.appendChild(p);
        cardEl = p;
      }
      function closeCard() { if (cardEl) { cardEl.remove(); cardEl = null; } }

      function endTrip() {
        if (!trip || phase === 'over') return;
        setPhase('over');
        bob = null; reel = null; holding = false;
        if (target) { target.state = 'swim'; target = null; }
        save.trips = (save.trips || 0) + 1;
        persist();
        ctx.stat('trips', 1);
        var counts = {}, order = [];
        trip.items.forEach(function (k) { if (!counts[k]) { counts[k] = 0; order.push(k); } counts[k]++; });
        lastSummary = {
          fish: trip.fish,
          list: order.map(function (k) { return KB[k].pl + (counts[k] > 1 ? ' ×' + counts[k] : ''); }).join(', '),
          newKinds: trip.newKinds, aqSent: trip.aqSent
        };
        if (trip.fish) ctx.sfx('win');
        trip = null;
        later(0.9, function () { if (phase === 'over') showPanel('end'); });
      }

      // ---------- panels ----------
      function diffButtons(kind) {
        return [
          { label: (save.diff === 'easy' ? '● ' : '') + 'Łatwo', onClick: function () { save.diff = 'easy'; persist(); ctx.sfx('click'); showPanel(kind); } },
          { label: (save.diff === 'hard' ? '● ' : '') + 'Trudniej', onClick: function () { save.diff = 'hard'; persist(); ctx.sfx('click'); showPanel(kind); } },
          { label: 'Księga stawu', onClick: function () { openBook(function () { showPanel(kind); }); } },
          { label: 'Wróć do gier', onClick: function () { ctx.exit(); } }
        ];
      }
      function showPanel(kind) {
        if (!alive) return;
        if (panel) { try { panel.close(); } catch (e) {} panel = null; }
        panelKind = kind;
        setPhase(kind === 'end' ? 'over' : 'menu');
        var diffLine = save.diff === 'hard' ? 'Trudniej: krótkie branie, węższy zielony pasek, więcej rzadkich ryb.' : 'Łatwo: długie branie i szeroki zielony pasek.';
        var bookLine = { text: 'Księga stawu: ' + bookCount() + ' / ' + KINDS.length, muted: true };
        var o = {
          price: PRICE, note: 'wyprawa', medals: true,
          onPlay: function () { panel = null; startTrip(); },
          secondary: diffButtons(kind)
        };
        if (kind === 'end' && lastSummary) {
          var s = lastSummary, lines = [];
          lines.push(s.list ? s.list : 'Tym razem nic. Następnym razem się uda!');
          if (s.newKinds) lines.push('Nowe w księdze: ' + s.newKinds);
          if (s.aqSent) lines.push('Do akwarium: ' + s.aqSent);
          lines.push({ text: diffLine, muted: true });
          lines.push(bookLine);
          o.title = 'Koniec wyprawy';
          o.big = s.fish + ' ' + plural(s.fish, 'ryba', 'ryby', 'ryb');
          o.lines = lines;
          o.button = 'Nowa wyprawa';
        } else {
          o.title = 'Wędkarz';
          o.lines = [
            'Zarzuć wędkę, poczekaj, aż spławik zanurkuje, i wyciągnij rybę!',
            'Wyprawa trwa ' + TRIP + ' sekund.',
            { text: diffLine, muted: true },
            bookLine
          ];
          o.button = 'Na ryby';
        }
        panel = ctx.panel(o);
      }

      // ---------- pond book ----------
      var bookCb = null, bookPrevPhase = null;
      function openBook(onClose) {
        if (bookEl) return;
        if (phase === 'reel' || phase === 'bite' || phase === 'cast') { say('Najpierw wyciągnij rybę!'); return; }
        bookCb = onClose || null;
        var w = el2('div', 'wk-book');
        var inn = el2('div', 'wk-book-in'); inn.setAttribute('role', 'dialog'); inn.setAttribute('aria-modal', 'true');
        w.appendChild(inn);
        var hd = el2('div', 'wk-book-hd');
        var h = el2('h2', null, 'Księga stawu');
        h.appendChild(el2('small', null, bookCount() + ' / ' + KINDS.length));
        var cb = el2('button', null, 'Zamknij'); cb.type = 'button';
        cb.onclick = closeBook;
        hd.appendChild(h); hd.appendChild(cb);
        inn.appendChild(hd);
        var bd = el2('div', 'wk-book-bd');
        PAGES.forEach(function (pg) {
          var sec = el2('section', 'wk-sec');
          var kinds = KINDS.filter(function (K) { return K.pg === pg.id; });
          var got = kinds.filter(function (K) { return save.book[K.k] && save.book[K.k].n > 0; }).length;
          var h3 = el2('h3', null, pg.name + ' · ' + got + '/' + kinds.length + ' ');
          if (got === kinds.length) h3.appendChild(el2('span', 'ok', '✓'));
          sec.appendChild(h3);
          if (pg.note) sec.appendChild(el2('p', null, pg.note));
          var grid = el2('div', 'wk-grid');
          kinds.forEach(function (K) {
            var e = save.book[K.k], has = e && e.n > 0;
            var cell = el2('div', 'wk-cell' + (has ? ' got' : ''));
            var cc = makeCanvas(92, 52);
            drawCatch(cc.c, K, 46, 27, catchLen(K, 92, 52), 0.6, !has);
            cell.appendChild(cc.cv);
            cell.appendChild(el2('b', null, has ? K.pl : '?'));
            if (has) {
              cell.appendChild(el2('small', null, '×' + e.n + ' · ' + e.best + ' cm'));
              if (K.aq) cell.appendChild(el2('small', null, 'z akwarium'));
            }
            var tg = el2('i', null, TIER[K.tier].n); tg.style.background = TIER[K.tier].c;
            cell.appendChild(tg);
            grid.appendChild(cell);
          });
          sec.appendChild(grid);
          bd.appendChild(sec);
        });
        inn.appendChild(bd);
        w.addEventListener('pointerdown', function (e) { if (e.target === w) closeBook(); });
        root.appendChild(w);
        bookEl = w;
        holding = false;
        ctx.sfx('open');
      }
      function closeBook() {
        if (!bookEl) return;
        bookEl.remove(); bookEl = null;
        ctx.sfx('close');
        var cb = bookCb; bookCb = null;
        if (cb) cb();
      }
      bookBtn.onclick = function () { openBook(null); };
      function onKey(e) {
        if (e.key === 'Escape' && bookEl) { closeBook(); return; }
        if ((e.key === ' ' || e.key === 'Enter') && phase === 'reel' && !e.repeat && document.activeElement === document.body) { holding = true; e.preventDefault(); }
      }
      function onKeyUp(e) { if (e.key === ' ' || e.key === 'Enter') holding = false; }
      document.addEventListener('keydown', onKey);
      document.addEventListener('keyup', onKeyUp);

      // ---------- input ----------
      function pos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
      function onDown(e) {
        if (bookEl || cardEl) return;
        var p = pos(e);
        if (phase === 'idle') {
          aim = clampTarget(p.x, p.y);
          try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
          setPhase('aim');
          ctx.sfx('tap');
        } else if (phase === 'wait' || phase === 'nibble') {
          say('Jeszcze nie! Czekaj, aż spławik zanurkuje.');
        } else if (phase === 'bite') {
          hook();
          holding = true; holdId = e.pointerId;
          try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
        } else if (phase === 'reel') {
          holding = true; holdId = e.pointerId;
          try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
        }
      }
      function onMove(e) {
        if (phase === 'aim') { var p = pos(e); aim = clampTarget(p.x, p.y); }
      }
      function onUp(e) {
        if (phase === 'aim' && aim) { var a = aim; aim = null; cast(a); }
        if (holdId === null || e.pointerId === holdId) { holding = false; holdId = null; }
      }
      function onCtx(e) { e.preventDefault(); }
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);
      canvas.addEventListener('contextmenu', onCtx);

      // ---------- step ----------
      function step(dt) {
        T += dt;
        clouds.forEach(function (c) { c.x += c.v * dt * u; if (c.x > W + 80 * u) c.x = -80 * u; });
        if (bookEl) return;
        if (flash.t > 0) flash.t -= dt;
        for (var i = ripples.length - 1; i >= 0; i--) { var r = ripples[i]; r.t += dt; r.r = lerp(2, r.max, r.t / r.life); if (r.t >= r.life) ripples.splice(i, 1); }
        for (i = drops.length - 1; i >= 0; i--) { var d = drops[i]; d.t += dt; d.vy += 300 * dt; d.x += d.vx * dt; d.y += d.vy * dt; if (d.t >= d.life) drops.splice(i, 1); }
        stepShadows(dt);
        for (i = laters.length - 1; i >= 0; i--) { var l = laters[i]; l.t -= dt; if (l.t <= 0) { laters.splice(i, 1); l.fn(); } }
        phaseT += dt;
        var running = trip && phase !== 'card' && phase !== 'over' && phase !== 'menu';
        if (running) {
          trip.left -= dt;
          if (trip.left <= 0 && !trip.timeUp) {
            trip.left = 0; trip.timeUp = true;
            say('Koniec czasu!', true);
            ctx.sfx('tick');
            if (phase === 'idle' || phase === 'aim') { aim = null; endTrip(); return; }
            if (phase === 'reel' && reel) { reel.best = reel.prog; reel.stall = 0; say('Koniec czasu! Trzymaj i wyciągnij rybkę.', true); }
            if (phase === 'cast' || phase === 'wait' || phase === 'nibble') {
              if (target) { target.state = 'swim'; target = null; }
              junkK = null;
              if (phase === 'cast') { bob.x = bob.tx; bob.y = bob.ty; }
              startRetrieve();
            }
          }
          if (trip.left < 0) trip.left = 0;
        }
        if (phase === 'cast') {
          bob.t += dt;
          var k = Math.min(1, bob.t / bob.dur);
          bob.x = lerp(bob.sx, bob.tx, k);
          bob.y = lerp(bob.sy, bob.ty, k) - bob.arc * 4 * k * (1 - k);
          if (k >= 1) landed();
        } else if (phase === 'wait') {
          if (junkK) { if (phaseT >= waitT) startNibble(); }
          else if (target) { if (target.state === 'nibble') startNibble(); else if (target.state !== 'come') target = null; }
          else if (phaseT >= waitT) {
            var best = null, bd = 1e9;
            shadows.forEach(function (s) { var dd = Math.hypot(s.x - bob.x, s.y - bob.y); if (s.state === 'swim' && s.alpha > 0.5 && dd < bd) { bd = dd; best = s; } });
            if (best) { target = best; best.state = 'come'; }
            else if (phaseT > waitT + 2.5) { junkK = pick(JUNK, function (K) { return K.w; }); waitT = phaseT + 0.8; }
          }
        } else if (phase === 'nibble') {
          var sc = scaleAt(bob.y);
          if (bob.nibAt && bob.nibAt.length && phaseT >= bob.nibAt[0]) { bob.nibAt.shift(); bob.nib = 1; ripple(bob.x, bob.y, 12 * sc, 0.6); ctx.sfx('bubble'); }
          if (phaseT >= waitT) startBite();
        } else if (phase === 'bite') {
          biteLeft -= dt;
          if (biteLeft <= 0) missBite();
        } else if (phase === 'reel') {
          stepReel(dt);
        } else if (phase === 'retrieve') {
          bob.t += dt;
          var q = Math.min(1, bob.t / 0.4);
          bob.x = lerp(bob.sx, L.tip.x, q); bob.y = lerp(bob.sy, L.tip.y + 26 * u, q) - 30 * u * q * (1 - q) * 4;
          if (q >= 1) afterAttempt();
        }
        if (bob) {
          if (bob.nib > 0) bob.nib = Math.max(0, bob.nib - dt * 4);
          var want = phase === 'bite' ? 1 : 0;
          bob.dip += (want - bob.dip) * Math.min(1, dt * 14);
        }
      }

      // ---------- drawing ----------
      function rr(x, y, w, h, r) {
        g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
      }
      function cloud(x, y, s) {
        g.fillStyle = '#fff'; g.strokeStyle = 'rgba(29,47,111,.35)'; g.lineWidth = 2;
        g.beginPath();
        g.arc(x, y, 12 * s, Math.PI * 0.5, Math.PI * 1.5);
        g.arc(x + 14 * s, y - 10 * s, 14 * s, Math.PI, Math.PI * 2);
        g.arc(x + 32 * s, y - 4 * s, 11 * s, Math.PI * 1.2, Math.PI * 0.5);
        g.closePath(); g.fill(); g.stroke();
      }
      function drawBackground() {
        var sg = g.createLinearGradient(0, 0, 0, L.waterTop);
        sg.addColorStop(0, '#bfe3ff'); sg.addColorStop(1, '#eef8ff');
        g.fillStyle = sg; g.fillRect(0, 0, W, L.waterTop + 4);
        // sun
        var sx = W * 0.68, sy = L.skyH * 0.5;
        g.fillStyle = 'rgba(242,181,29,.25)'; g.beginPath(); g.arc(sx, sy, 24 * u, 0, 7); g.fill();
        g.fillStyle = '#f2c23a'; g.strokeStyle = INK; g.lineWidth = 2;
        g.beginPath(); g.arc(sx, sy, 15 * u, 0, 7); g.fill(); g.stroke();
        clouds.forEach(function (c) { cloud(c.x, L.skyH * c.y, c.s * u); });
        // far shore: hills + trees
        g.fillStyle = '#8fd06b'; g.strokeStyle = INK; g.lineWidth = 2;
        g.beginPath(); g.moveTo(0, L.waterTop + 2);
        g.lineTo(0, L.skyH - 4);
        for (var x = 0; x <= W + 40; x += 40) g.quadraticCurveTo(x + 20, L.skyH - 12 - (x % 80 ? 4 : 0), x + 40, L.skyH - 4);
        g.lineTo(W, L.waterTop + 2); g.closePath(); g.fill(); g.stroke();
        L.trees.forEach(function (t) {
          g.fillStyle = '#8a5a33'; g.fillRect(t.x - 2, L.skyH - 8, 4, 8);
          g.fillStyle = t.c; g.beginPath(); g.arc(t.x, L.skyH - 8 - t.r * 0.7, t.r * 0.75, 0, 7); g.fill(); g.lineWidth = 1.5; g.stroke();
        });
        // water
        var wg = g.createLinearGradient(0, L.waterTop, 0, L.pierTop + 20);
        wg.addColorStop(0, '#9ed6ef'); wg.addColorStop(1, '#3f8fd0');
        g.fillStyle = wg; g.fillRect(0, L.waterTop, W, H - L.waterTop);
        g.strokeStyle = INK; g.lineWidth = 2;
        g.beginPath(); g.moveTo(0, L.waterTop);
        for (x = 0; x <= W; x += 30) g.quadraticCurveTo(x + 15, L.waterTop + 3, x + 30, L.waterTop);
        g.stroke();
        // moving glints
        g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.lineCap = 'round';
        for (var i = 0; i < 9; i++) {
          var gy = lerp(L.waterTop + 18, L.pierTop - 10, ((i * 0.37) % 1)), sc = scaleAt(gy);
          var gx = ((i * 97 + T * (8 + i)) % (W + 60)) - 30;
          g.beginPath(); g.moveTo(gx, gy); g.quadraticCurveTo(gx + 8 * sc, gy - 3 * sc, gx + 16 * sc, gy); g.stroke();
        }
        // lily pads
        L.pads.forEach(function (p) {
          g.fillStyle = '#5fbf5a'; g.strokeStyle = INK; g.lineWidth = 1.5;
          g.beginPath(); g.ellipse(p.x, p.y, p.r, p.r * 0.5, 0, p.a % 1 + 0.25, p.a % 1 + 0.25 + Math.PI * 1.8); g.lineTo(p.x, p.y); g.closePath(); g.fill(); g.stroke();
          if (p.flower) { g.fillStyle = '#f7b8d2'; g.beginPath(); g.arc(p.x + p.r * 0.2, p.y - p.r * 0.2, p.r * 0.32, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#f2d21d'; g.beginPath(); g.arc(p.x + p.r * 0.2, p.y - p.r * 0.2, p.r * 0.12, 0, 7); g.fill(); }
        });
      }
      function drawReeds() {
        L.reeds.forEach(function (r) {
          var by = L.pierTop + 18 * u, sw = Math.sin(T * 1.3 + r.ph) * 3 * u;
          g.strokeStyle = '#2a8a56'; g.lineWidth = 3 * u; g.lineCap = 'round';
          for (var k = -1; k <= 1; k++) {
            g.beginPath(); g.moveTo(r.x + k * 6 * u, by); g.quadraticCurveTo(r.x + k * 7 * u, by - r.h * 0.6, r.x + k * 9 * u + sw, by - r.h * (k ? 0.8 : 1)); g.stroke();
          }
          g.fillStyle = '#8a5a33'; g.strokeStyle = INK; g.lineWidth = 1.5;
          rr(r.x - 3 * u + sw * 0.8, by - r.h - 4 * u, 6 * u, 14 * u, 3 * u); g.fill(); g.stroke();
        });
      }
      function drawShadow(s) {
        var sc = scaleAt(s.y), len = 46 * s.K.sh * sc;
        g.save(); g.globalAlpha = s.alpha * (s.state === 'flee' ? 0.7 : 1);
        g.translate(s.x, s.y); g.scale(1, 0.62); g.rotate(s.ang);
        g.fillStyle = 'rgba(20,45,90,.36)';
        g.beginPath(); g.ellipse(0, 0, len / 2, len * 0.22, 0, 0, 7); g.fill();
        var wag = Math.sin(s.ph) * 0.4;
        g.save(); g.translate(-len * 0.45, 0); g.rotate(wag);
        g.beginPath(); g.moveTo(0, 0); g.lineTo(-len * 0.3, -len * 0.16); g.lineTo(-len * 0.3, len * 0.16); g.closePath(); g.fill();
        g.restore();
        g.restore();
        if (s.K.tier === 3 && s.alpha > 0.8) {
          var gl = (s.glint % 2.2);
          if (gl < 0.5) {
            var a = Math.sin(gl / 0.5 * Math.PI), r = 5 * u * a + 1;
            g.save(); g.translate(s.x + 6 * sc, s.y - 8 * sc); g.fillStyle = 'rgba(255,240,170,' + (0.9 * a) + ')';
            g.beginPath(); g.moveTo(0, -r * 1.6); g.lineTo(r * 0.35, -r * 0.35); g.lineTo(r * 1.6, 0); g.lineTo(r * 0.35, r * 0.35); g.lineTo(0, r * 1.6); g.lineTo(-r * 0.35, r * 0.35); g.lineTo(-r * 1.6, 0); g.lineTo(-r * 0.35, -r * 0.35); g.closePath(); g.fill();
            g.restore();
          }
        }
      }
      function drawRipples() {
        ripples.forEach(function (r) {
          var a = 1 - r.t / r.life;
          g.strokeStyle = 'rgba(255,255,255,' + (0.8 * a) + ')'; g.lineWidth = 2;
          g.beginPath(); g.ellipse(r.x, r.y, r.r, r.r * 0.38, 0, 0, 7); g.stroke();
        });
      }
      function drawBobber() {
        if (!bob) return;
        var sc = phase === 'cast' ? lerp(u, scaleAt(bob.ty), Math.min(1, bob.t / bob.dur)) : (phase === 'retrieve' || phase === 'idle') ? u : scaleAt(bob.y);
        var r = 7 * sc, inWater = phase === 'wait' || phase === 'nibble' || phase === 'bite';
        var bobY = bob.y + (inWater ? Math.sin(T * 2.4) * 1.2 * sc : 0) + bob.nib * r * 0.6 + bob.dip * r * 1.5;
        g.save();
        if (inWater) { g.beginPath(); g.rect(bob.x - r * 3, bob.y - r * 6, r * 6, r * 6 + r * 0.35); g.clip(); }
        g.strokeStyle = INK; g.lineWidth = 1.6;
        g.fillStyle = '#fff'; g.beginPath(); g.arc(bob.x, bobY, r, 0, 7); g.fill(); g.stroke();
        g.fillStyle = '#e2533f'; g.beginPath(); g.arc(bob.x, bobY, r, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(bob.x, bobY - r); g.lineTo(bob.x, bobY - r * 1.7); g.stroke();
        g.restore();
        if (inWater) { g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(bob.x, bob.y + r * 0.35, r * 1.5, r * 0.45, 0, 0, 7); g.stroke(); }
        if (phase === 'bite') {
          var pulse = 1 + Math.sin(T * 14) * 0.08, bx = bob.x, by = bob.y - 34 * sc - 10;
          g.save(); g.translate(bx, by); g.scale(pulse, pulse);
          g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 3;
          g.beginPath(); g.arc(0, 0, 18 * u, 0, 7); g.fill(); g.stroke();
          g.fillStyle = RED; g.font = Math.round(28 * u) + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText('!', 0, 1);
          g.restore();
        }
      }
      function drawLine() {
        var tip = L.tip;
        var end = reel ? { x: reel.x, y: reel.y } : bob ? { x: bob.x, y: bob.y - 7 * scaleAt(bob.y) * 1.7 } : { x: tip.x, y: tip.y + 26 * u };
        var sag = reel ? (1 - reel.T) * 30 * u : (phase === 'wait' || phase === 'nibble') ? 26 * u : phase === 'bite' ? 8 * u : 10 * u;
        g.strokeStyle = 'rgba(29,47,111,.85)'; g.lineWidth = reel ? 1.6 : 1.2;
        g.beginPath(); g.moveTo(tip.x, tip.y);
        g.quadraticCurveTo((tip.x + end.x) / 2, Math.max(tip.y, end.y) + sag - Math.abs(tip.y - end.y) * 0.3, end.x, end.y);
        g.stroke();
        if (!bob && !reel && phase !== 'menu' && phase !== 'over') {
          // bobber hanging from the rod tip
          var hb = { x: tip.x, y: tip.y + 26 * u, r: 7 * u };
          g.strokeStyle = INK; g.lineWidth = 1.6;
          g.fillStyle = '#fff'; g.beginPath(); g.arc(hb.x, hb.y + hb.r, hb.r, 0, 7); g.fill(); g.stroke();
          g.fillStyle = '#e2533f'; g.beginPath(); g.arc(hb.x, hb.y + hb.r, hb.r, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
        }
      }
      function drawHooked() {
        if (!reel) return;
        var r = reel, sc = scaleAt(r.y), K = r.K;
        var len = (K.junk ? 40 : 46 * K.sh) * sc * 1.1;
        g.save(); g.translate(r.x, r.y); g.scale(1, 0.62);
        g.rotate(Math.atan2(r.y0 - L.near, r.x0 - L.tip.x) * 0.3 + Math.sin(r.wig) * 0.5 + Math.PI / 2 * (K.junk ? 0 : 1) - Math.PI / 2);
        g.fillStyle = 'rgba(20,45,90,.42)';
        if (K.junk) { g.beginPath(); g.ellipse(0, 0, len * 0.45, len * 0.3, 0, 0, 7); g.fill(); }
        else {
          g.beginPath(); g.ellipse(0, 0, len / 2, len * 0.2, 0, 0, 7); g.fill();
          g.save(); g.translate(-len * 0.45, 0); g.rotate(Math.sin(r.wig * 2) * 0.6);
          g.beginPath(); g.moveTo(0, 0); g.lineTo(-len * 0.3, -len * 0.16); g.lineTo(-len * 0.3, len * 0.16); g.closePath(); g.fill();
          g.restore();
        }
        g.restore();
        if (Math.random() < (r.pull > 0 ? 0.35 : 0.06)) ripple(r.x + rnd(-6, 6) * sc, r.y, 10 * sc, 0.5);
      }
      function drawDrops() {
        g.fillStyle = 'rgba(230,246,255,.95)';
        drops.forEach(function (d) { g.beginPath(); g.arc(d.x, d.y, d.r, 0, 7); g.fill(); });
      }
      function drawBank() {
        var cx = W * 0.5, top = L.pierTop;
        // grassy banks
        g.fillStyle = '#8fd06b'; g.strokeStyle = INK; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(0, top + 12 * u); g.quadraticCurveTo(cx * 0.55, top + 4 * u, cx - 70 * u, top + 30 * u); g.lineTo(cx - 110 * u, H + 4); g.lineTo(0, H + 4); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(W, top + 12 * u); g.quadraticCurveTo(W - cx * 0.55, top + 4 * u, cx + 70 * u, top + 30 * u); g.lineTo(cx + 110 * u, H + 4); g.lineTo(W, H + 4); g.closePath(); g.fill(); g.stroke();
        drawReeds();
        // pier posts in the water
        g.fillStyle = '#8a5a33';
        [[-56, 0], [52, 0]].forEach(function (p) { rr(cx + p[0] * u - 5 * u, top - 4 * u, 10 * u, 20 * u, 3 * u); g.fill(); g.stroke(); });
        // planks
        var tl = cx - 62 * u, tr = cx + 62 * u, bl = cx - 100 * u, br = cx + 100 * u, py = top + 2 * u;
        g.fillStyle = '#d29a5f';
        g.beginPath(); g.moveTo(tl, py); g.lineTo(tr, py); g.lineTo(br, H + 4); g.lineTo(bl, H + 4); g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(90,58,32,.55)'; g.lineWidth = 1.5;
        for (var k = 1; k < 6; k++) {
          var t = k / 6, yy = lerp(py, H, t * t * 0.35 + t * 0.65);
          g.beginPath(); g.moveTo(lerp(tl, bl, (yy - py) / (H - py)), yy); g.lineTo(lerp(tr, br, (yy - py) / (H - py)), yy); g.stroke();
        }
        g.strokeStyle = INK; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(tl, py); g.lineTo(tr, py); g.stroke();
        // bucket
        var bx = cx - 58 * u, by = H - 46 * u, bw = 34 * u, bh = 30 * u;
        if (trip && trip.fish > 0) {
          // a tail sticking out of the bucket
          g.save(); g.translate(bx + bw * 0.62, by + 2 * u); g.rotate(0.35);
          g.fillStyle = '#f6982a'; g.strokeStyle = INK; g.lineWidth = 2;
          g.beginPath(); g.moveTo(-3 * u, 0); g.lineTo(-2 * u, -8 * u); g.lineTo(-9 * u, -17 * u); g.quadraticCurveTo(0, -13 * u, 9 * u, -17 * u); g.lineTo(2 * u, -8 * u); g.lineTo(3 * u, 0); g.closePath(); g.fill(); g.stroke();
          g.restore();
        }
        g.fillStyle = '#9fc3ea'; g.strokeStyle = INK; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + bw, by); g.lineTo(bx + bw * 0.86, by + bh); g.lineTo(bx + bw * 0.14, by + bh); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.ellipse(bx + bw / 2, by, bw / 2, 4 * u, 0, 0, 7); g.fillStyle = '#5a8fc8'; g.fill(); g.stroke();
        g.beginPath(); g.arc(bx + bw / 2, by, bw * 0.5, Math.PI * 1.1, Math.PI * 1.9); g.lineWidth = 1.5; g.stroke();
      }
      function drawRod() {
        var b = L.butt, t = L.tip;
        g.lineCap = 'round';
        g.strokeStyle = INK; g.lineWidth = 8 * u;
        g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(t.x, t.y); g.stroke();
        g.strokeStyle = '#a8703c'; g.lineWidth = 5 * u;
        g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(t.x, t.y); g.stroke();
        g.strokeStyle = '#3a2a1a'; g.lineWidth = 7 * u;
        var hx = lerp(b.x, t.x, 0.18), hy = lerp(b.y, t.y, 0.18);
        g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(hx, hy); g.stroke();
        // reel
        var rx = lerp(b.x, t.x, 0.28) - 12 * u, ry = lerp(b.y, t.y, 0.28);
        g.fillStyle = '#c9d6ea'; g.strokeStyle = INK; g.lineWidth = 2;
        g.beginPath(); g.arc(rx, ry, 10 * u, 0, 7); g.fill(); g.stroke();
        var ha = handleAng;
        g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + Math.cos(ha) * 12 * u, ry + Math.sin(ha) * 12 * u); g.lineWidth = 2.5; g.stroke();
        g.fillStyle = '#e2533f'; g.beginPath(); g.arc(rx + Math.cos(ha) * 12 * u, ry + Math.sin(ha) * 12 * u, 3.5 * u, 0, 7); g.fill(); g.lineWidth = 1.5; g.stroke();
        g.fillStyle = INK; g.beginPath(); g.arc(t.x, t.y, 2.2, 0, 7); g.fill();
      }
      function drawAim() {
        if (phase !== 'aim' || !aim) return;
        var t = L.tip, k, steps = 16, dist = Math.hypot(aim.x - t.x, aim.y - t.y), arc = dist * 0.35;
        g.fillStyle = 'rgba(255,255,255,.9)';
        for (k = 1; k < steps; k++) {
          var q = k / steps;
          var x = lerp(t.x, aim.x, q), y = lerp(t.y, aim.y, q) - arc * 4 * q * (1 - q);
          g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill();
        }
        var sc = scaleAt(aim.y), pr = 1 + Math.sin(T * 8) * 0.1;
        g.strokeStyle = '#fff'; g.lineWidth = 3;
        g.beginPath(); g.ellipse(aim.x, aim.y, 18 * sc * pr, 7 * sc * pr, 0, 0, 7); g.stroke();
        g.strokeStyle = INK; g.lineWidth = 1.5;
        g.beginPath(); g.ellipse(aim.x, aim.y, 18 * sc * pr, 7 * sc * pr, 0, 0, 7); g.stroke();
      }
      function pill(x, y, w, h) { rr(x, y, w, h, h / 2); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = INK; g.lineWidth = 2.5; g.stroke(); }
      function smallFish(x, y, s, col) {
        g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 1.6;
        g.beginPath(); g.ellipse(x, y, 9 * s, 5.5 * s, 0, 0, 7); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(x - 8 * s, y); g.lineTo(x - 14 * s, y - 5 * s); g.lineTo(x - 14 * s, y + 5 * s); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = INK; g.beginPath(); g.arc(x + 4.5 * s, y - 1.2 * s, 1.3 * s, 0, 7); g.fill();
      }
      function drawHud() {
        g.textBaseline = 'middle'; g.textAlign = 'left';
        if (trip) {
          var left = Math.max(0, Math.ceil(trip.left)), frac = trip.left / TRIP;
          var low = trip.left <= 10;
          pill(8, 10, 104, 40);
          g.fillStyle = '#e8f1ff'; g.beginPath(); g.arc(30, 30, 12, 0, 7); g.fill();
          g.fillStyle = low ? '#f08a24' : GOLD;
          g.beginPath(); g.moveTo(30, 30); g.arc(30, 30, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); g.closePath(); g.fill();
          g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.arc(30, 30, 12, 0, 7); g.stroke();
          g.fillStyle = INK; g.font = '24px ' + FONT;
          g.fillText(Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'), 48, 31);
          pill(118, 10, 74, 40);
          smallFish(140, 30, 1, '#f6982a');
          g.fillStyle = INK; g.fillText(String(trip.fish), 160, 31);
        }
      }
      function hintText() {
        if (!trip) return '';
        if (phase === 'idle') return save.total < 3 ? 'Dotknij wody, żeby zarzucić' : 'Daleko pływają rzadkie ryby';
        if (phase === 'aim') return 'Puść, żeby zarzucić';
        if (phase === 'wait') return 'Czekaj na branie…';
        if (phase === 'nibble') return 'Coś skubie… czekaj!';
        if (phase === 'bite') return 'TERAZ! Dotknij!';
        return '';
      }
      function drawHint() {
        var txt = hintText();
        if (!txt || phase === 'reel') return;
        var big = phase === 'bite';
        g.font = (big ? 30 : 22) * Math.min(1.2, u) + 'px ' + FONT;
        var w = g.measureText(txt).width + 30, h = big ? 46 : 38, x = W / 2 - w / 2, y = H - h - 10;
        rr(x, y, w, h, 16);
        g.fillStyle = big ? '#fff3c4' : 'rgba(255,255,255,.95)'; g.fill(); g.strokeStyle = INK; g.lineWidth = 2.5; g.stroke();
        g.fillStyle = big ? RED : INK; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(txt, W / 2, y + h / 2 + 1);
      }
      function drawFlash() {
        if (flash.t <= 0 || !flash.text) return;
        var a = Math.min(1, flash.t * 3);
        g.save(); g.globalAlpha = a;
        g.font = (flash.big ? 34 : 22) * Math.min(1.2, u) + 'px ' + FONT;
        var maxW = W - 40, words = flash.text.split(' '), lines = [], cur = '';
        words.forEach(function (wd) { var t = cur ? cur + ' ' + wd : wd; if (g.measureText(t).width > maxW - 30 && cur) { lines.push(cur); cur = wd; } else cur = t; });
        if (cur) lines.push(cur);
        var lh = flash.big ? 38 : 26, w = 0;
        lines.forEach(function (l) { w = Math.max(w, g.measureText(l).width); });
        w += 30;
        var h = lines.length * lh + 16, x = W / 2 - w / 2, y = L.waterTop + 22;
        rr(x, y, w, h, 16); g.fillStyle = INK; g.fill();
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
        lines.forEach(function (l, i) { g.fillText(l, W / 2, y + 8 + lh * i + lh / 2 + 1); });
        g.restore();
      }
      function drawReelUi() {
        if (phase !== 'reel' || !reel) return;
        var r = reel, z = zoneOf(r);
        var pad = 12, cw = Math.min(W - 2 * pad, 560), cx = (W - cw) / 2, chh = 112, cy = H - chh - 10;
        rr(cx, cy, cw, chh, 18); g.fillStyle = 'rgba(255,255,255,.97)'; g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
        var msg, col = INK;
        if (r.zone === 'red') { msg = 'Za mocno! Puść!'; col = RED; }
        else if (!holding) msg = 'Trzymaj palec, żeby kręcić';
        else if (r.zone === 'low') msg = 'Kręć dalej!';
        else msg = 'Dobrze! Kręć!';
        g.font = '23px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
        if (r.zone === 'red' && Math.floor(T * 6) % 2) col = '#f08a24';
        g.fillStyle = col; g.fillText(msg, W / 2, cy + 18);
        // tension bar
        var bx = cx + 14, bw = cw - 28, by = cy + 34, bh = 28;
        g.save(); rr(bx, by, bw, bh, 12); g.clip();
        g.fillStyle = '#f6dc7a'; g.fillRect(bx, by, bw * z.lo, bh);
        g.fillStyle = '#8fd06b'; g.fillRect(bx + bw * z.lo, by, bw * (z.hi - z.lo), bh);
        g.fillStyle = '#f39a8a'; g.fillRect(bx + bw * z.hi, by, bw * (1 - z.hi), bh);
        if (r.red > 0) { g.fillStyle = 'rgba(207,65,45,' + Math.min(0.5, r.red / 4) + ')'; g.fillRect(bx, by, bw, bh); }
        g.restore();
        rr(bx, by, bw, bh, 12); g.strokeStyle = INK; g.lineWidth = 2.5; g.stroke();
        var nx = bx + bw * r.T + (r.zone === 'red' ? Math.sin(T * 50) * 2 : 0);
        g.fillStyle = INK;
        g.beginPath(); g.moveTo(nx - 7, by - 7); g.lineTo(nx + 7, by - 7); g.lineTo(nx, by + 3); g.closePath(); g.fill();
        g.lineWidth = 4; g.beginPath(); g.moveTo(nx, by); g.lineTo(nx, by + bh); g.stroke();
        // progress track: fish swims from the left to the bucket on the right
        var ty = cy + 86, tx0 = cx + 26, tx1 = cx + cw - 40;
        g.strokeStyle = 'rgba(29,47,111,.3)'; g.lineWidth = 4; g.setLineDash([6, 6]);
        g.beginPath(); g.moveTo(tx0, ty); g.lineTo(tx1, ty); g.stroke(); g.setLineDash([]);
        g.strokeStyle = '#3f86d8'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(tx0, ty); g.lineTo(lerp(tx0, tx1, Math.min(1, r.prog)), ty); g.stroke();
        // bucket icon
        var kx = tx1 + 16;
        g.fillStyle = '#9fc3ea'; g.strokeStyle = INK; g.lineWidth = 2;
        g.beginPath(); g.moveTo(kx - 10, ty - 9); g.lineTo(kx + 10, ty - 9); g.lineTo(kx + 7, ty + 9); g.lineTo(kx - 7, ty + 9); g.closePath(); g.fill(); g.stroke();
        smallFish(lerp(tx0, tx1, Math.min(1, r.prog)), ty, 1.05, r.K.junk ? '#9aa6b8' : '#f6982a');
      }
      function draw() {
        if (!L) return;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.lineJoin = 'round'; g.lineCap = 'round';
        drawBackground();
        shadows.forEach(drawShadow);
        drawHooked();
        drawRipples();
        drawBank();
        drawRod();
        drawLine();
        drawBobber();
        drawDrops();
        drawAim();
        drawHud();
        drawReelUi();
        drawHint();
        drawFlash();
      }

      function loop(ts) {
        raf = requestAnimationFrame(loop);
        var t = ts / 1000;
        var dt = last ? Math.min(0.05, t - last) : 0;
        last = t;
        step(dt);
        draw();
      }

      resize();
      for (var i = 0; i < wantShadows(); i++) spawnShadow(false);
      showPanel('start');
      raf = requestAnimationFrame(loop);

      return {
        destroy: function () {
          alive = false;
          cancelAnimationFrame(raf); raf = 0;
          ro.disconnect();
          canvas.removeEventListener('pointerdown', onDown);
          canvas.removeEventListener('pointermove', onMove);
          canvas.removeEventListener('pointerup', onUp);
          canvas.removeEventListener('pointercancel', onUp);
          canvas.removeEventListener('contextmenu', onCtx);
          document.removeEventListener('keydown', onKey);
          document.removeEventListener('keyup', onKeyUp);
          if (panel) { try { panel.close(); } catch (e) {} panel = null; }
          closeCard();
          if (bookEl) { bookEl.remove(); bookEl = null; }
          laters = [];
          root.remove();
        },
        pause: function () { paused = true; holding = false; cancelAnimationFrame(raf); raf = 0; },
        resume: function () {
          if (!alive || !paused) return;
          paused = false; last = 0;
          raf = requestAnimationFrame(loop);
        }
      };
    }
  });
})();
