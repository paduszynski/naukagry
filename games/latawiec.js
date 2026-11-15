/*
 * Latawiec: a kite flies over the land, the world scrolls right to left.
 * Hold anywhere = the kite rises, release = it sinks (smooth, floaty physics, no flapping).
 * Collect gold stars (in-game points), avoid birds, storm clouds and ground obstacles. Wind gusts push the kite.
 * One rainbow cloud per flight gives a few seconds of invulnerability.
 *
 * v2: stages instead of one endless flight. 5 worlds x 3 stages, each stage ends at a landmark
 * (windmill, clock tower, summit flag, lighthouse, castle) at a set distance. 3 hearts per stage,
 * rating 1-3 stars by the share of sky stars collected. Stage layouts are seeded, so a stage plays the same
 * every time. "Bez końca" (the old endless flight, one hit ends it) unlocks after the first world.
 * Kite designs unlocked by player level and bought once for 75 ★; sky themes (time of day) free when unlocked
 * and tint every world except "Noc z gwiazdami".
 * Logical coordinates: 1 unit = S css px, so a portrait phone is ~400 units wide whatever its size.
 */
(function () {
  'use strict';
  if (!window.NG) return;

  var INK = '#1d2f6f', PURPLE = '#7a4fc4', GOLD = '#e3a008';
  var FONT = '"Patrick Hand", "Comic Sans MS", cursive';
  var PRICE = 50, KITE_PRICE = 75;
  var KX = 120;                       // kite x (logical)
  var LIFT = 950, SINK = 520, DRAG = 2.6, RAINBOW_TIME = 5;
  var HEARTS = 3, HURT_TIME = 1.6;

  var KITES = [
    { id: 'klasyczny', name: 'Klasyczny', lvl: 1, info: 'czerwono-żółty romb' },
    { id: 'smok', name: 'Smok', lvl: 6, info: 'zielony, z długim ogonem' },
    { id: 'ryba', name: 'Ryba', lvl: 8, info: 'pływa po niebie' },
    { id: 'samolot', name: 'Samolot', lvl: 10, info: 'z kręcącym się śmigłem' }
  ];
  var SKIES = [
    { id: 'dzien', name: 'Dzień', lvl: 1 },
    { id: 'zachod', name: 'Zachód słońca', lvl: 10 },
    { id: 'noc', name: 'Noc', lvl: 15 }
  ];
  var THEME = {
    dzien:  { sky: ['#7cc4ff', '#bfe3ff', '#eaf7ff'], far: '#a9d98f', near: '#7fc65e', grass: '#6dba4c', grass2: '#4f9d39', crown: ['#4caf50', '#3d9a44', '#62bf55'], trunk: '#8a6142', cloud: 'rgba(255,255,255,.9)', hud: INK, body: '#e6f0ff' },
    zachod: { sky: ['#6a5bd0', '#ff8f7a', '#ffd59a'], far: '#b07ab8', near: '#8d64a8', grass: '#6f8f4f', grass2: '#56743c', crown: ['#4e7d4a', '#3f6b3e', '#5d8c52'], trunk: '#5e4636', cloud: 'rgba(255,226,214,.85)', hud: INK, body: '#ffd9c2' },
    noc:    { sky: ['#0f1a45', '#22336e', '#3c4f8f'], far: '#2b3f70', near: '#22355e', grass: '#2d5a48', grass2: '#22483a', crown: ['#2f6b4a', '#285e41', '#377a55'], trunk: '#4a3a33', cloud: 'rgba(190,205,240,.35)', hud: '#fff', body: '#1a2656' }
  };

  // ---------- worlds ----------
  // ground: the obstacle that grows from the ground; bird: the flying obstacle; len: stage lengths in metres
  var WORLDS = [
    { id: 'laka', name: 'Łąka', ground: 'tree', bird: 'bird', decor: 'flowers', goal: 'Doleć do wiatraka', len: [220, 300, 380],
      news: 'Zbieraj gwiazdki. Uważaj na ptaki, burzowe chmury i drzewa.' },
    { id: 'miasto', name: 'Miasteczko', ground: 'house', bird: 'bird', decor: 'stones', goal: 'Doleć do wieży z zegarem', len: [280, 360, 440],
      news: 'Nowość: domki z kominami. Złap balonik: to 3 gwiazdki!' },
    { id: 'gory', name: 'Góry', ground: 'peak', bird: 'eagle', decor: 'flowers', goal: 'Doleć do flagi na szczycie', len: [320, 400, 480],
      news: 'Nowość: skaliste szczyty i szybkie orły.' },
    { id: 'morze', name: 'Morze', ground: 'mast', bird: 'gull', decor: 'waves', goal: 'Doleć do latarni morskiej', len: [360, 440, 520],
      news: 'Nowość: żaglówki i mewy, które lecą falami.' },
    { id: 'noc', name: 'Noc z gwiazdami', ground: 'tree', bird: 'owl', decor: 'fireflies', goal: 'Doleć do zamku', len: [400, 480, 560],
      news: 'Nowość: sowy. Złap spadającą gwiazdę: to 5 gwiazdek!' }
  ];
  // landmark half width and height (logical units)
  var LM = { laka: { hw: 110, h: 240 }, miasto: { hw: 44, h: 268 }, gory: { hw: 135, h: 290 }, morze: { hw: 70, h: 236 }, noc: { hw: 92, h: 236 } };
  // world palettes for a day sky; Łąka uses the original THEME, Noc z gwiazdami has its own fixed night
  var WPAL = {
    miasto: { far: '#b7d39c', near: '#c6b6de', grass: '#d8c7a4', grass2: '#bca886', crown: ['#4caf50', '#3d9a44', '#62bf55'], trunk: '#8a6142',
      walls: ['#f6d58e', '#f4b0a6', '#a9d3f0', '#c9e6a8'], roof: '#d9573f', win: '#d6f0ff' },
    gory: { far: '#a3b3d1', near: '#8cc06a', grass: '#79b257', grass2: '#5c9440', crown: ['#4caf50', '#3d9a44', '#62bf55'], trunk: '#8a6142',
      rock: '#a7afc1', rock2: '#8a93aa' },
    morze: { far: '#9bd38f', near: '#86c9f2', grass: '#55a7e6', grass2: '#2f77c4', crown: ['#4caf50', '#3d9a44', '#62bf55'], trunk: '#8a6142',
      hull: ['#e2533f', '#3f86d8', '#f5c330'], sail: '#fffaf0' }
  };
  var NIGHT_WORLD = { sky: ['#0b0b33', '#241f66', '#463a8c'], far: '#2e3a75', near: '#252f66', grass: '#24464a', grass2: '#1a3438',
    crown: ['#2f6b4a', '#285e41', '#377a55'], trunk: '#4a3a33', cloud: 'rgba(190,205,240,.3)', hud: '#fff', body: '#14123f' };

  function stageKey(wi, si) { return WORLDS[wi].id + '-' + si; }
  function seeded(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash01(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function mix(a, b, t) {
    if (a.charAt(0) !== '#') return a;
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
    var gg = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
    var bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return '#' + ((1 << 24) + (r << 16) + (gg << 8) + bl).toString(16).slice(1);
  }
  var themeCache = {};
  function themeFor(wid, sky) {
    var key = wid + '/' + sky;
    if (themeCache[key]) return themeCache[key];
    var th;
    if (wid === 'noc') th = NIGHT_WORLD;
    else if (wid === 'laka' || !WPAL[wid]) th = THEME[sky];
    else {
      var base = THEME[sky], p = WPAL[wid], to = sky === 'zachod' ? '#7a4f8f' : '#101a44', amt = sky === 'dzien' ? 0 : sky === 'zachod' ? 0.28 : 0.55;
      th = { sky: base.sky, cloud: base.cloud, hud: base.hud, body: base.body };
      Object.keys(p).forEach(function (k) {
        th[k] = Array.isArray(p[k]) ? p[k].map(function (c) { return mix(c, to, amt); }) : mix(p[k], to, amt);
      });
    }
    themeCache[key] = th;
    return th;
  }

  function heartPath(g, x, y, r) {
    g.beginPath();
    g.moveTo(x, y + r * 0.9);
    g.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.9, y - r * 1.25, x, y - r * 0.45);
    g.bezierCurveTo(x + r * 0.9, y - r * 1.25, x + r * 1.5, y - r * 0.1, x, y + r * 0.9);
    g.closePath();
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pl(n, one, few, many) {
    if (n === 1) return one;
    var d = n % 10, h = n % 100;
    return (d >= 2 && d <= 4 && (h < 12 || h > 14)) ? few : many;
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function outline(g, w) { g.lineWidth = w || 2; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }

  function starPath(g, x, y, r, rot) {
    g.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + (rot || 0) + i * Math.PI / 5, q = i % 2 ? r * 0.47 : r;
      g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q);
    }
    g.closePath();
  }
  function drawStar(g, x, y, r, rot, glow) {
    if (glow) {
      var gl = g.createRadialGradient(x, y, r * 0.4, x, y, r * 2);
      gl.addColorStop(0, 'rgba(255,236,140,.75)'); gl.addColorStop(1, 'rgba(255,236,140,0)');
      g.beginPath(); g.arc(x, y, r * 2, 0, Math.PI * 2); g.fillStyle = gl; g.fill();
    }
    starPath(g, x, y, r, rot); g.fillStyle = '#f5c330'; g.fill(); outline(g, Math.max(1.2, r * 0.17));
    g.beginPath(); g.arc(x - r * 0.22, y - r * 0.2, r * 0.18, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.8)'; g.fill();
  }

  function cloudShape(g, x, y, w, h) {
    // fluffy cloud with flat-ish bottom, (x,y) = left of the bottom line
    g.beginPath();
    g.moveTo(x + w * 0.12, y);
    g.arc(x + w * 0.16, y - h * 0.32, h * 0.34, Math.PI * 0.55, Math.PI * 1.45);
    g.arc(x + w * 0.38, y - h * 0.62, h * 0.44, Math.PI * 1.05, Math.PI * 1.85);
    g.arc(x + w * 0.66, y - h * 0.58, h * 0.4, Math.PI * 1.15, Math.PI * 1.95);
    g.arc(x + w * 0.86, y - h * 0.3, h * 0.32, Math.PI * 1.45, Math.PI * 0.45);
    g.closePath();
  }

  // ---------- kites: drawn around (0,0); tail = array of {x,y} relative points trailing to the left ----------
  function tailLine(g, pts, x0, y0) {
    g.beginPath(); g.moveTo(x0, y0);
    for (var i = 0; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  }
  function bow(g, x, y, col) {
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - 5, y - 4); g.lineTo(x - 5, y + 4); g.closePath();
    g.moveTo(x, y); g.lineTo(x + 5, y - 4); g.lineTo(x + 5, y + 4); g.closePath();
    g.fillStyle = col; g.fill(); outline(g, 1.2);
  }
  var KITE_DRAW = {
    klasyczny: function (g, k) {
      var ax = -Math.sin(k.ang) * 28, ay = Math.cos(k.ang) * 28;
      tailLine(g, k.tail, ax, ay); outline(g, 1.6);
      var cols = ['#e2533f', '#3f86d8', '#f5c330', '#3fae5f'];
      for (var i = 2; i < k.tail.length; i += 3) bow(g, k.tail[i].x, k.tail[i].y, cols[(i / 3 | 0) % 4]);
      g.save(); g.rotate(k.ang);
      var T = [0, -27], Rt = [19, -4], B = [0, 30], L = [-19, -4], C = [0, -4];
      function tri(a, b, col) { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(C[0], C[1]); g.closePath(); g.fillStyle = col; g.fill(); }
      tri(T, Rt, '#e2533f'); tri(Rt, B, '#f5c330'); tri(B, L, '#e2533f'); tri(L, T, '#f5c330');
      g.beginPath(); g.moveTo(T[0], T[1]); g.lineTo(Rt[0], Rt[1]); g.lineTo(B[0], B[1]); g.lineTo(L[0], L[1]); g.closePath(); outline(g, 2.2);
      g.beginPath(); g.moveTo(0, -27); g.lineTo(0, 30); g.moveTo(-19, -4); g.lineTo(19, -4); outline(g, 1.4);
      g.beginPath(); g.arc(0, -4, 6, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); outline(g, 1.4);
      g.restore();
    },
    smok: function (g, k) {
      var n = k.tail.length;
      for (var i = n - 1; i >= 0; i--) {
        var p = k.tail[i], r = 11 - 7 * i / n;
        g.beginPath(); g.moveTo(p.x - r * 0.3, p.y - r + 1); g.lineTo(p.x + r * 0.2, p.y - r - 6); g.lineTo(p.x + r * 0.6, p.y - r + 2); g.closePath();
        g.fillStyle = '#f08a24'; g.fill(); outline(g, 1.2);
        g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fillStyle = i % 2 ? '#3fae5f' : '#5cc46a'; g.fill(); outline(g, 1.6);
        g.beginPath(); g.arc(p.x, p.y + r * 0.35, r * 0.5, 0.2, Math.PI - 0.2); g.strokeStyle = '#f5d76e'; g.lineWidth = 1.5; g.stroke();
      }
      if (n) { var e = k.tail[n - 1]; g.beginPath(); g.moveTo(e.x, e.y - 4); g.lineTo(e.x - 12, e.y - 8); g.lineTo(e.x - 8, e.y); g.lineTo(e.x - 12, e.y + 8); g.lineTo(e.x, e.y + 4); g.closePath(); g.fillStyle = '#e2533f'; g.fill(); outline(g, 1.4); }
      g.save(); g.rotate(k.ang);
      // horns + mane
      g.beginPath(); g.moveTo(-6, -14); g.lineTo(-12, -30); g.lineTo(-1, -17); g.moveTo(4, -16); g.lineTo(4, -32); g.lineTo(10, -16);
      g.fillStyle = '#f5c330'; g.fill(); outline(g, 1.6);
      g.beginPath(); g.moveTo(-14, -10); g.lineTo(-26, -14); g.lineTo(-18, -4); g.lineTo(-28, 0); g.lineTo(-16, 4); g.lineTo(-24, 12); g.lineTo(-10, 10); g.closePath();
      g.fillStyle = '#e2533f'; g.fill(); outline(g, 1.6);
      // head
      g.beginPath(); g.moveTo(-14, -6); g.quadraticCurveTo(-12, -20, 4, -19); g.quadraticCurveTo(16, -18, 20, -8); g.quadraticCurveTo(30, -6, 30, 2);
      g.quadraticCurveTo(30, 11, 18, 11); g.quadraticCurveTo(4, 18, -8, 12); g.quadraticCurveTo(-16, 6, -14, -6); g.closePath();
      g.fillStyle = '#5cc46a'; g.fill(); outline(g, 2.2);
      g.beginPath(); g.moveTo(14, 6); g.quadraticCurveTo(22, 9, 29, 5); outline(g, 1.6);
      g.beginPath(); g.arc(25, -2, 1.6, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
      g.beginPath(); g.arc(6, -7, 7, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); outline(g, 1.8);
      g.beginPath(); g.arc(8, -7, 3.4, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
      g.beginPath(); g.arc(9, -8.5, 1.2, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
      g.beginPath(); g.arc(-2, 4, 3, 0, Math.PI * 2); g.fillStyle = 'rgba(255,130,150,.5)'; g.fill();
      g.restore();
    },
    ryba: function (g, k) {
      var pts = [{ x: 0, y: 0 }].concat(k.tail.slice(0, 9)), n = pts.length, up = [], dn = [];
      for (var i = 0; i < n; i++) {
        var w = 17 * (1 - i / n) + 5, p = pts[i];
        up.push([p.x, p.y - w]); dn.push([p.x, p.y + w]);
      }
      var e = pts[n - 1];
      // tail fin
      g.beginPath(); g.moveTo(e.x + 2, e.y - 4); g.lineTo(e.x - 16, e.y - 16); g.quadraticCurveTo(e.x - 8, e.y, e.x - 16, e.y + 16); g.lineTo(e.x + 2, e.y + 4); g.closePath();
      g.fillStyle = '#e2533f'; g.fill(); outline(g, 1.8);
      // body
      g.beginPath(); g.moveTo(up[0][0] + 6, up[0][1] + 2);
      for (i = 1; i < n; i++) g.lineTo(up[i][0], up[i][1]);
      for (i = n - 1; i >= 1; i--) g.lineTo(dn[i][0], dn[i][1]);
      g.lineTo(dn[0][0] + 6, dn[0][1] - 2); g.quadraticCurveTo(20, 0, up[0][0] + 6, up[0][1] + 2); g.closePath();
      g.fillStyle = '#f08a24'; g.fill();
      g.save(); g.clip();
      g.strokeStyle = '#ffd08a'; g.lineWidth = 2;
      for (i = 2; i < n; i += 1) { var q = pts[i], ww = 17 * (1 - i / n) + 5; g.beginPath(); g.arc(q.x + 4, q.y, ww * 0.8, Math.PI * 0.65, Math.PI * 1.35); g.stroke(); }
      for (i = 2; i < n; i += 3) { var s2 = pts[i]; g.beginPath(); g.arc(s2.x, s2.y, 17 * (1 - i / n) + 6, 0, Math.PI * 2); g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,.75)'; g.stroke(); }
      g.restore();
      g.beginPath(); g.moveTo(up[0][0] + 6, up[0][1] + 2);
      for (i = 1; i < n; i++) g.lineTo(up[i][0], up[i][1]);
      for (i = n - 1; i >= 1; i--) g.lineTo(dn[i][0], dn[i][1]);
      g.lineTo(dn[0][0] + 6, dn[0][1] - 2); g.quadraticCurveTo(20, 0, up[0][0] + 6, up[0][1] + 2); g.closePath();
      outline(g, 2.2);
      g.save(); g.rotate(k.ang * 0.6);
      g.beginPath(); g.ellipse(17, 0, 4, 9, 0, 0, Math.PI * 2); g.fillStyle = '#fff4dc'; g.fill(); outline(g, 1.8);
      g.beginPath(); g.arc(5, -5, 6, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); outline(g, 1.8);
      g.beginPath(); g.arc(6.5, -5, 3, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
      g.beginPath(); g.arc(7.3, -6, 1, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
      g.restore();
    },
    samolot: function (g, k) {
      // streamer
      tailLine(g, k.tail, -24, 0);
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = INK; g.lineWidth = 8; g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = 5; g.stroke();
      g.setLineDash([6, 6]); g.strokeStyle = '#e2533f'; g.stroke(); g.setLineDash([]);
      g.save(); g.rotate(k.ang);
      // tail fin
      g.beginPath(); g.moveTo(-18, -2); g.lineTo(-27, -18); g.lineTo(-19, -18); g.lineTo(-8, -4); g.closePath(); g.fillStyle = '#e2533f'; g.fill(); outline(g, 1.8);
      // back wing
      g.beginPath(); g.ellipse(2, -3, 7, 13, 0.25, 0, Math.PI * 2); g.fillStyle = '#d9a514'; g.fill(); outline(g, 1.6);
      // body
      g.beginPath(); g.moveTo(-26, -1); g.quadraticCurveTo(-10, -12, 14, -10); g.quadraticCurveTo(24, -9, 25, 0); g.quadraticCurveTo(24, 9, 14, 9);
      g.quadraticCurveTo(-10, 10, -26, -1); g.closePath(); g.fillStyle = '#3f86d8'; g.fill(); outline(g, 2.2);
      g.beginPath(); g.moveTo(-20, 2); g.quadraticCurveTo(0, 7, 22, 4); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
      // window
      g.beginPath(); g.arc(9, -3, 4.2, 0, Math.PI * 2); g.fillStyle = '#d6f0ff'; g.fill(); outline(g, 1.6);
      // front wing
      g.beginPath(); g.ellipse(-1, 5, 7, 14, -0.35, 0, Math.PI * 2); g.fillStyle = '#f5c330'; g.fill(); outline(g, 1.8);
      // propeller
      g.beginPath(); g.arc(26, 0, 2.6, 0, Math.PI * 2); g.fillStyle = '#e2533f'; g.fill(); outline(g, 1.4);
      var pr = Math.abs(Math.sin(k.t * 30)) * 13 + 2;
      g.beginPath(); g.ellipse(28, 0, 2, pr, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(29,47,111,.55)'; g.fill();
      g.restore();
    }
  };

  // ---------- landmarks at the end of a stage: drawn around (x, gy) = centre on the ground ----------
  function drawLandmark(g, wid, x, gy, t, th, night) {
    var i, a;
    if (wid === 'laka') {
      // windmill on a hill
      g.beginPath(); g.ellipse(x, gy + 12, 112, 48, 0, Math.PI, 0); g.fillStyle = th.near; g.fill(); outline(g, 2);
      var by = gy - 30, ty = by - 128;
      g.beginPath(); g.moveTo(x - 27, by); g.lineTo(x - 17, ty); g.lineTo(x + 17, ty); g.lineTo(x + 27, by); g.closePath();
      g.fillStyle = night ? '#c9bfa6' : '#f3e3c3'; g.fill(); outline(g, 2.5);
      g.beginPath(); g.moveTo(x - 21, ty + 2); g.quadraticCurveTo(x, ty - 34, x + 21, ty + 2); g.closePath(); g.fillStyle = '#d9573f'; g.fill(); outline(g, 2.2);
      rr(g, x - 8, by - 26, 16, 26, 7); g.fillStyle = '#8a6142'; g.fill(); outline(g, 2);
      g.beginPath(); g.arc(x, ty + 40, 7, 0, Math.PI * 2); g.fillStyle = night ? '#ffe28a' : '#bfe3ff'; g.fill(); outline(g, 2);
      g.save(); g.translate(x, ty - 6);
      for (i = 0; i < 4; i++) {
        g.save(); g.rotate(t * 1.3 + i * Math.PI / 2);
        g.beginPath(); g.moveTo(0, 0); g.lineTo(72, 0); outline(g, 3);
        g.beginPath(); g.rect(14, 2, 56, 14); g.fillStyle = '#fffaf0'; g.fill(); outline(g, 2);
        g.beginPath(); g.moveTo(32, 2); g.lineTo(32, 16); g.moveTo(51, 2); g.lineTo(51, 16); outline(g, 1.2);
        g.restore();
      }
      g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.fillStyle = '#f5c330'; g.fill(); outline(g, 2);
      g.restore();
    } else if (wid === 'miasto') {
      // clock tower
      var tw = 30, top = gy - 196;
      g.beginPath(); g.rect(x - tw, top, tw * 2, gy - top + 4); g.fillStyle = night ? '#a99a88' : '#e9d3b0'; g.fill(); outline(g, 2.5);
      g.beginPath(); g.rect(x - tw - 6, top - 10, tw * 2 + 12, 12); g.fillStyle = '#c9a77c'; g.fill(); outline(g, 2);
      g.beginPath(); g.moveTo(x - tw - 4, top - 10); g.lineTo(x, top - 66); g.lineTo(x + tw + 4, top - 10); g.closePath(); g.fillStyle = '#3f86d8'; g.fill(); outline(g, 2.5);
      g.beginPath(); g.moveTo(x, top - 66); g.lineTo(x, top - 86); outline(g, 2);
      g.beginPath(); g.moveTo(x, top - 86); g.lineTo(x + 18 + Math.sin(t * 4) * 2, top - 80); g.lineTo(x, top - 74); g.closePath(); g.fillStyle = '#e2533f'; g.fill(); outline(g, 1.6);
      var cy = top + 36;
      g.beginPath(); g.arc(x, cy, 21, 0, Math.PI * 2); g.fillStyle = '#fffaf0'; g.fill(); outline(g, 2.5);
      for (i = 0; i < 12; i++) { a = i * Math.PI / 6; g.beginPath(); g.moveTo(x + Math.cos(a) * 16, cy + Math.sin(a) * 16); g.lineTo(x + Math.cos(a) * 19, cy + Math.sin(a) * 19); outline(g, 1.4); }
      g.beginPath(); g.moveTo(x, cy); g.lineTo(x + Math.cos(t * 0.5 - 1.57) * 10, cy + Math.sin(t * 0.5 - 1.57) * 10);
      g.moveTo(x, cy); g.lineTo(x + Math.cos(t * 3 - 1.57) * 15, cy + Math.sin(t * 3 - 1.57) * 15); outline(g, 2.2);
      for (i = 0; i < 3; i++) { rr(g, x - 9, top + 76 + i * 34, 18, 22, 8); g.fillStyle = night ? '#ffe28a' : '#d6f0ff'; g.fill(); outline(g, 1.8); }
      rr(g, x - 12, gy - 30, 24, 34, 11); g.fillStyle = '#8a6142'; g.fill(); outline(g, 2);
    } else if (wid === 'gory') {
      // big summit with a flag
      var ay = gy - 246;
      g.beginPath(); g.moveTo(x - 135, gy + 4); g.lineTo(x - 20, ay + 16); g.lineTo(x, ay); g.lineTo(x + 34, ay + 22); g.lineTo(x + 140, gy + 4); g.closePath();
      g.fillStyle = th.rock || '#a7afc1'; g.fill(); outline(g, 2.5);
      g.beginPath(); g.moveTo(x - 54, ay + 70); g.lineTo(x - 20, ay + 16); g.lineTo(x, ay); g.lineTo(x + 34, ay + 22); g.lineTo(x + 64, ay + 66);
      g.lineTo(x + 40, ay + 58); g.lineTo(x + 22, ay + 76); g.lineTo(x, ay + 56); g.lineTo(x - 22, ay + 80); g.closePath();
      g.fillStyle = night ? '#dfe6f5' : '#fff'; g.fill(); outline(g, 2);
      g.beginPath(); g.moveTo(x, ay); g.lineTo(x, ay - 44); outline(g, 2.5);
      var wv = Math.sin(t * 5) * 3;
      g.beginPath(); g.moveTo(x, ay - 44); g.quadraticCurveTo(x + 14, ay - 40 + wv, x + 30, ay - 38); g.lineTo(x + 30, ay - 22); g.quadraticCurveTo(x + 14, ay - 24 - wv, x, ay - 26); g.closePath();
      g.fillStyle = '#e2533f'; g.fill(); outline(g, 2);
      drawStar(g, x + 14, ay - 32, 5, 0, false);
    } else if (wid === 'morze') {
      // lighthouse on a rock
      g.beginPath(); g.ellipse(x, gy + 6, 70, 28, 0, Math.PI, 0); g.fillStyle = '#9a8f86'; g.fill(); outline(g, 2.2);
      var b0 = gy - 16, t0 = gy - 186;
      g.save();
      g.beginPath(); g.moveTo(x - 24, b0); g.lineTo(x - 15, t0); g.lineTo(x + 15, t0); g.lineTo(x + 24, b0); g.closePath();
      g.fillStyle = '#fffaf0'; g.fill(); g.clip();
      g.fillStyle = '#e2533f';
      for (i = 0; i < 4; i++) g.fillRect(x - 30, t0 + 10 + i * 44, 60, 22);
      g.restore();
      g.beginPath(); g.moveTo(x - 24, b0); g.lineTo(x - 15, t0); g.lineTo(x + 15, t0); g.lineTo(x + 24, b0); g.closePath(); outline(g, 2.5);
      g.beginPath(); g.rect(x - 22, t0 - 6, 44, 8); g.fillStyle = '#3d4a7a'; g.fill(); outline(g, 2);
      // light beam
      var ba = Math.sin(t * 1.2) * 0.9, lx = x, ly = t0 - 22;
      g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + Math.cos(ba - 0.12) * 170, ly + Math.sin(ba - 0.12) * 170); g.lineTo(lx + Math.cos(ba + 0.12) * 170, ly + Math.sin(ba + 0.12) * 170); g.closePath();
      g.fillStyle = night ? 'rgba(255,240,150,.35)' : 'rgba(255,240,150,.25)'; g.fill();
      rr(g, x - 13, t0 - 34, 26, 28, 4); g.fillStyle = '#ffe066'; g.fill(); outline(g, 2);
      g.beginPath(); g.moveTo(x - 16, t0 - 34); g.quadraticCurveTo(x, t0 - 56, x + 16, t0 - 34); g.closePath(); g.fillStyle = '#e2533f'; g.fill(); outline(g, 2);
      rr(g, x - 8, b0 - 26, 16, 24, 7); g.fillStyle = '#3f86d8'; g.fill(); outline(g, 1.8);
    } else {
      // castle
      var wt = gy - 74, win = night ? '#ffe28a' : '#d6f0ff', stone = night ? '#8d88b0' : '#d8d2e6';
      function tower(cx, w, h, roof) {
        g.beginPath(); g.rect(cx - w / 2, gy - h, w, h + 4); g.fillStyle = stone; g.fill(); outline(g, 2.2);
        g.beginPath(); g.moveTo(cx - w / 2 - 5, gy - h); g.lineTo(cx, gy - h - w * 1.25); g.lineTo(cx + w / 2 + 5, gy - h); g.closePath(); g.fillStyle = roof; g.fill(); outline(g, 2.2);
        var fy = gy - h - w * 1.25;
        g.beginPath(); g.moveTo(cx, fy); g.lineTo(cx, fy - 18); outline(g, 1.8);
        g.beginPath(); g.moveTo(cx, fy - 18); g.lineTo(cx + 14 + Math.sin(t * 5 + cx) * 2, fy - 13); g.lineTo(cx, fy - 8); g.closePath(); g.fillStyle = '#f5c330'; g.fill(); outline(g, 1.4);
        rr(g, cx - 5, gy - h + 18, 10, 16, 5); g.fillStyle = win; g.fill(); outline(g, 1.6);
      }
      g.beginPath(); g.moveTo(x - 80, gy + 4); g.lineTo(x - 80, wt);
      for (i = 0; i < 8; i++) { var cx0 = x - 80 + i * 20; g.lineTo(cx0, wt - 10); g.lineTo(cx0 + 10, wt - 10); g.lineTo(cx0 + 10, wt); g.lineTo(cx0 + 20, wt); }
      g.lineTo(x + 80, gy + 4); g.closePath(); g.fillStyle = stone; g.fill(); outline(g, 2.2);
      tower(x - 72, 34, 128, '#8a5cd0');
      tower(x + 72, 34, 128, '#8a5cd0');
      tower(x, 50, 160, '#3f86d8');
      g.beginPath(); g.moveTo(x - 16, gy + 4); g.lineTo(x - 16, gy - 22); g.quadraticCurveTo(x, gy - 40, x + 16, gy - 22); g.lineTo(x + 16, gy + 4); g.closePath();
      g.fillStyle = '#8a6142'; g.fill(); outline(g, 2);
      [[-40, -48], [40, -48]].forEach(function (p) { rr(g, x + p[0] - 5, gy + p[1], 10, 14, 5); g.fillStyle = win; g.fill(); outline(g, 1.6); });
    }
  }

  NG.register('latawiec', {
    meta: {
      name: 'Latawiec', price: '50 ★ za lot', bg: '#e6f0ff', music: 'sky',
      pic: '<path d="M50 6 l18 20 l-18 26 l-18 -26 z" fill="#e2533f" stroke="#1d2f6f" stroke-width="2"/><path d="M50 6 v46 M32 26 h36" stroke="#1d2f6f" stroke-width="2"/><path d="M50 52 q-8 6 0 10 q8 4 0 10" fill="none" stroke="#1d2f6f" stroke-width="2"/><path d="M96 14 l3 7 l7 1 l-5 5 l1 7 l-6 -3 l-6 3 l1 -7 l-5 -5 l7 -1 z" fill="#f2b51d"/><path d="M80 50 q4 -4 8 0 q4 -4 8 0" fill="none" stroke="#1d2f6f" stroke-width="2"/>'
    },
    medals: [
      { id: 'etapy3', stat: 'stages', at: 3, tier: 1, text: '3 etapy w Latawcu' },
      { id: 'etapy9', stat: 'stages', at: 9, tier: 2, text: '9 etapów w Latawcu' },
      { id: 'etapy15', stat: 'stages', at: 15, tier: 3, text: 'Wszystkie 15 etapów' }
    ],
    quests: [
      { id: 'stars', stat: 'stars', n: [20, 30], text: 'Zbierz {n} gwiazdek w Latawcu' },
      { id: 'stage', stat: 'stage', n: [1], text: 'Ukończ etap w Latawcu' }
    ],
    stickers: [
      { id: 'w-laka', emoji: '🌼', name: 'Łąka ukończona' },
      { id: 'w-miasto', emoji: '🏘️', name: 'Miasteczko ukończone' },
      { id: 'w-gory', emoji: '🏔️', name: 'Góry ukończone' },
      { id: 'w-morze', emoji: '⛵', name: 'Morze ukończone' },
      { id: 'w-noc', emoji: '🌙', name: 'Noc z gwiazdami ukończona' },
      { id: 'trzy', emoji: '🌟', name: 'Trzy gwiazdki w etapie' }
    ],
    mount: function (el, ctx) {
      var save = ctx.load({ best: 0, bestScore: 0, flights: 0, owned: {}, kite: 'klasyczny', sky: 'dzien', stages: {}, last: '' });
      if (!save.owned || typeof save.owned !== 'object') save.owned = {};
      if (!save.stages || typeof save.stages !== 'object' || Array.isArray(save.stages)) save.stages = {};
      function kiteOk(id) { var k = KITES.filter(function (x) { return x.id === id; })[0]; return k && (k.lvl <= 1 || (save.owned[id] && ctx.level() >= k.lvl)); }
      function skyOk(id) { var s = SKIES.filter(function (x) { return x.id === id; })[0]; return s && ctx.level() >= s.lvl; }
      if (!kiteOk(save.kite)) save.kite = 'klasyczny';
      if (!skyOk(save.sky)) save.sky = 'dzien';
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      function rating(wi, si) { return +save.stages[stageKey(wi, si)] || 0; }
      function worldDone(wi) { return rating(wi, 0) > 0 && rating(wi, 1) > 0 && rating(wi, 2) > 0; }
      function worldOpen(wi) { return wi === 0 || worldDone(wi - 1); }
      function stageOpen(wi, si) { return worldOpen(wi) && (si === 0 || rating(wi, si - 1) > 0); }
      function doneCount() { var n = 0; WORLDS.forEach(function (w, wi) { for (var si = 0; si < 3; si++) if (rating(wi, si) > 0) n++; }); return n; }
      function endlessOpen() { return worldDone(0) || save.best > 0; } // players from before the stages keep it
      function lastWorld() { var wi = 0; WORLDS.forEach(function (w, i) { if (save.last && save.last.indexOf(w.id + '-') === 0) wi = i; }); return wi; }

      var cv = document.createElement('canvas');
      el.appendChild(cv);
      var css = document.createElement('style');
      css.textContent =
        '.lw-card{max-height:100%;overflow-y:auto;gap:8px;padding:16px 14px}' +
        '.lw-world{display:flex;gap:10px;align-items:center;border:2px solid #d4def0;border-radius:16px;padding:8px;text-align:left}' +
        '.lw-world.off{background:#f3f5fa}' +
        '.lw-world canvas{flex:none;border:2px solid ' + INK + ';border-radius:12px}' +
        '.lw-world.off canvas{filter:grayscale(1) opacity(.55)}' +
        '.lw-wbody{flex:1;min-width:0}' +
        '.lw-wname{font-size:1.25rem;line-height:1.05;display:flex;justify-content:space-between;gap:6px}' +
        '.lw-wname small{color:' + GOLD + ';font-size:1.05rem;white-space:nowrap}' +
        '.lw-stages{display:flex;gap:6px;margin-top:4px}' +
        '.lw-st{flex:1;min-width:0;min-height:50px;border:3px solid ' + INK + ';border-radius:14px;background:#fff;box-shadow:0 3px 0 ' + INK + ';font:inherit;color:' + INK + ';display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;padding:3px 0}' +
        '.lw-st b{font-weight:400;font-size:1.35rem}' +
        '.lw-st i{font-style:normal;font-size:.95rem;letter-spacing:1px;color:' + GOLD + '}' +
        '.lw-st i .e{color:#c8d3ea}' +
        '.lw-st.next{background:#fff4d6}' +
        '.lw-st:active{transform:translateY(3px);box-shadow:0 0 0 ' + INK + '}' +
        '.lw-st[disabled]{background:#e6e9f2;color:#8a93aa;box-shadow:none;border-color:#b8c2d8}' +
        '.lw-sub{color:#6b7591;font-size:.95rem;margin-top:2px}';
      el.appendChild(css);
      var g = cv.getContext('2d');
      var W = 1, H = 1, DPR = 1, S = 1, LW = 400, LH = 700, GY = 600;

      function resize() {
        var r = el.getBoundingClientRect();
        W = Math.max(1, r.width); H = Math.max(1, r.height);
        DPR = Math.min(3, window.devicePixelRatio || 1);
        cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
        S = clamp(Math.min(W / 400, H / 700), 0.6, 2.6);
        LW = W / S; LH = H / S; GY = Math.round(LH * 0.87);
        if (!raf) draw();
      }

      var state = 'idle';     // idle | run | pause | crash | goal | over
      var clock = 0, holding = false, pointers = {};
      var R = null;
      var K = { y: 0, vy: 0, ang: 0, hist: [] };   // kite (also used in idle)
      var bg = { far: 0, near: 0, ground: 0, clouds: [], dots: [], decor: [] };
      var panel = null, hangar = null, picker = null;
      var curW = lastWorld();   // world drawn behind menus and in flight; endless flies over Łąka

      function seedBackground() {
        bg.clouds = []; bg.dots = []; bg.decor = [];
        for (var c = 0; c < 5; c++) bg.clouds.push({ x: rnd(0, LW + 200), y: rnd(60, LH * 0.6), s: rnd(0.6, 1.1) });
        for (var d = 0; d < 70; d++) bg.dots.push({ x: rnd(0, 1), y: rnd(0, 1), p: rnd(0, 6) });
        for (var f = 0; f < 22; f++) bg.decor.push({ x: rnd(0, LW + 200), y: Math.random(), c: (Math.random() * 4) | 0 });
        K.y = LH * 0.42; K.vy = 0; K.hist = [];
      }

      // stage = { wi, si } or null for the endless flight
      function newRun(stage) {
        R = {
          t: 0, v: 160, dist: 0, stars: 0, spawned: 0, obs: [], items: [], pops: [], gap: 420, confetti: [],
          rbT: rnd(22, 42), rbDone: false, rainbow: 0, crashT: 0, spin: 0, hurt: 0, hearts: stage ? HEARTS : 1,
          wind: { next: rnd(12, 16), phase: 'idle', t: 0, dir: 1, force: 0, dur: 2 }, gust: 0, lines: [],
          stage: stage, rng: Math.random, goalU: 0, goalT: 0, shoot: []
        };
        if (stage) {
          var w = WORLDS[stage.wi];
          R.rng = seeded(1000 + stage.wi * 37 + stage.si * 11);
          R.d = (stage.wi * 3 + stage.si) / 14;
          R.goalU = w.len[stage.si] * 40;
          R.rbD = R.goalU * (0.3 + R.rng() * 0.3);
          R.v0 = 150 + 30 * R.d; R.vmax = 210 + 110 * R.d;
          if (w.id === 'noc') R.shoot = [R.goalU * 0.28, R.goalU * 0.55, R.goalU * 0.8];
          curW = stage.wi;
        } else curW = 0;
        K.y = LH * 0.42; K.vy = 0;
      }
      function srnd(a, b) { return a + R.rng() * (b - a); }
      function spick(n) { return (R.rng() * n) | 0; }

      // ---------- input ----------
      function anyDown() { for (var k in pointers) return true; return false; }
      function onDown(e) {
        if (e.button > 0) return;
        e.preventDefault();
        if (state === 'pause') { state = 'run'; }
        pointers[e.pointerId] = 1; holding = true;
      }
      function onUp(e) { delete pointers[e.pointerId]; holding = anyDown() || keyDown; }
      var keyDown = false;
      function onKey(e) {
        if (e.code !== 'Space' && e.code !== 'ArrowUp') return;
        if (state !== 'run' && state !== 'pause') return;
        e.preventDefault();
        if (e.type === 'keydown') { if (state === 'pause') state = 'run'; keyDown = true; holding = true; }
        else { keyDown = false; holding = anyDown(); }
      }
      cv.addEventListener('pointerdown', onDown);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      window.addEventListener('keydown', onKey);
      window.addEventListener('keyup', onKey);

      // ---------- spawning ----------
      function starsAt(list) { list.forEach(function (p) { R.items.push({ type: 'star', x: p[0], y: p[1], rot: srnd(-0.3, 0.3) }); R.spawned++; }); }
      // ground obstacle of the current world; h0 = how high it reaches above the ground (like a tree crown centre)
      function groundAt(x, h0) {
        var kind = R.stage ? WORLDS[R.stage.wi].ground : 'tree', o;
        if (kind === 'tree') {
          var r = srnd(36, 48), cy = GY - h0;
          o = { type: 'ground', kind: 'tree', x: x, cy: cy, r: r, c: spick(3), top: cy - r, hw: r };
        } else if (kind === 'house') {
          var hw = srnd(28, 36), apex = GY - h0 - 34, roofH = 34, side = R.rng() < 0.5 ? -1 : 1;
          o = { type: 'ground', kind: 'house', x: x, w: hw, apex: apex, wall: apex + roofH, roofH: roofH, chx: side * hw * 0.5, c: spick(4), hw: hw + 8 };
          o.chTop = apex + roofH * (hw * 0.5 / (hw + 8)) - 14;
          o.top = Math.min(apex, o.chTop);
        } else if (kind === 'peak') {
          var ay = GY - h0 - 40;
          o = { type: 'ground', kind: 'peak', x: x, ay: ay, b: 58 + (GY - ay) * 0.28, top: ay };
          o.hw = o.b;
        } else {
          var my = GY - h0 - 40;
          o = { type: 'ground', kind: 'mast', x: x, ay: my, b: 36, top: my, c: spick(3), hw: 40 };
        }
        R.obs.push(o);
        return o;
      }
      function birdAt(x, y) {
        var kind = R.stage ? WORLDS[R.stage.wi].bird : 'bird';
        R.obs.push({ type: 'bird', kind: kind, x: x, y: y, by: y, ph: srnd(0, 6), c: spick(3) });
      }
      function spawn() {
        var st = R.stage, v = R.v, x = LW + 80 + Math.min(0, R.gap);
        // stage: an "equivalent time" drives which obstacles appear, from the stage difficulty and the progress
        var t = st ? R.d * 40 + (R.dist / R.goalU) * 25 : R.t;
        if (st && R.dist + x > R.goalU + LW * 0.62 - LM[WORLDS[st.wi].id].hw - 90) { R.gap = 80; return; }   // keep the landmark area clear
        var gap = v * srnd(1.2, 1.9) + 70 + (t < 15 ? v * 0.8 : 0);
        if (st) gap *= 1.12 - 0.12 * R.d;
        var top = 70, mid = (top + GY) / 2;
        if (!R.rbDone && (st ? R.dist >= R.rbD : t >= R.rbT)) {
          R.rbDone = true;
          R.items.push({ type: 'rainbow', x: x + 30, y: srnd(LH * 0.3, GY - 180) });
          R.gap = v * 1.3 + 120; return;
        }
        var pool = ['tree', 'tree', 'stars'];
        if (t > 8) pool.push('cloud', 'cloud');
        if (t > 20) pool.push('bird', 'bird');
        if (t > 45) pool.push('gate', 'tree2', 'bird');
        var k = pool[spick(pool.length)];
        var hmax = Math.min(330, 170 + t * 2.2);
        if (k === 'tree' || k === 'tree2' || k === 'gate') {
          var o = groundAt(x, k === 'gate' ? srnd(120, 170) : srnd(120, hmax));
          if (o.kind === 'peak') gap += o.b * 0.6;
          if (k === 'tree2') {
            var o2 = groundAt(x + 95 + (o.kind === 'peak' ? 40 : 0), srnd(120, hmax));
            starsAt([[(o.x + o2.x) / 2, Math.min(o.top, o2.top) - 70]]); gap += 95;
          } else if (k === 'gate') {
            var cyc = srnd(top + 40, top + 90);
            R.obs.push({ type: 'cloud', x: x - 60, y: cyc, w: 130, h: 64, ph: srnd(0, 6) });
            var gm = (cyc + 20 + o.top) / 2;
            starsAt([[x - 40, gm + 10], [x, gm], [x + 40, gm + 10]]);
          } else if (R.rng() < 0.7) {
            var sy = o.top - 65;
            starsAt([[x - 40, sy + 14], [x, sy], [x + 40, sy + 14]]);
          }
        } else if (k === 'cloud') {
          var cyy = srnd(top + 20, top + Math.min(LH * 0.32, 60 + t * 2.5)), w = srnd(115, 150);
          R.obs.push({ type: 'cloud', x: x, y: cyy, w: w, h: w * 0.48, ph: srnd(0, 6) });
          if (R.rng() < 0.7) starsAt([[x + w * 0.2, cyy + 95], [x + w * 0.5, cyy + 105], [x + w * 0.8, cyy + 95]]);
        } else if (k === 'bird') {
          var by = srnd(LH * 0.22, GY - 170);
          birdAt(x, by);
          if (t > 50 && R.rng() < 0.5) birdAt(x + 70, by + (by < mid ? 110 : -110));
          gap += v * 0.3;
        } else {
          var c0 = srnd(LH * 0.25, GY - 160);
          if (st && WORLDS[st.wi].id === 'miasto' && R.rng() < 0.45) {
            // a balloon worth 3 stars between two stars
            starsAt([[x, c0 + 30], [x + 160, c0 + 30]]);
            R.items.push({ type: 'balloon', x: x + 80, y: c0, by: c0, c: spick(4), ph: srnd(0, 6) }); R.spawned += 3;
          } else {
            for (var i = 0; i < 5; i++) starsAt([[x + i * 40, c0 + Math.sin(i * 0.9) * 40]]);
          }
          gap = Math.max(gap - 60, 240);
        }
        R.gap = gap;
      }

      // ---------- update ----------
      function updateBg(dx, dt) {
        bg.far += dx * 0.12; bg.near += dx * 0.3; bg.ground += dx;
        bg.clouds.forEach(function (c) { c.x -= dx * 0.2 + 6 * dt; if (c.x < -120) { c.x = LW + rnd(40, 200); c.y = rnd(60, LH * 0.6); } });
        bg.decor.forEach(function (d) { d.x -= dx; if (d.x < -20) { d.x = LW + rnd(10, 120); d.y = Math.random(); d.c = (Math.random() * 4) | 0; } });
      }

      function kitePhysics(dt, extra) {
        var acc = (holding && state === 'run' ? -LIFT : SINK) + (extra || 0);
        K.vy += acc * dt; K.vy -= K.vy * DRAG * dt;
        K.y += K.vy * dt;
        var top = 46, floor = GY - 34;
        if (K.y < top) { K.y = top; if (K.vy < 0) K.vy = 0; }
        if (K.y > floor) { K.y = floor; if (K.vy > 0) K.vy = 0; }
      }

      function update(dt) {
        clock += dt;
        if (state === 'run') updateRun(dt);
        else if (state === 'crash') updateCrash(dt);
        else if (state === 'goal') updateGoal(dt);
        else if (state !== 'pause') {
          updateBg(40 * dt, dt);
          // idle: hover around the middle with a gentle breeze
          var target = LH * 0.42 + Math.sin(clock * 0.9) * 22;
          K.vy += ((target - K.y) * 6 - K.vy * 3) * dt; K.y += K.vy * dt;
          K.ang += (clamp(K.vy / 300, -0.4, 0.4) + Math.sin(clock * 1.7) * 0.06 - K.ang) * Math.min(1, dt * 5);
        }
        if (R && R.confetti.length) {
          R.confetti.forEach(function (p) { p.vy += 380 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; });
          R.confetti = R.confetti.filter(function (p) { return p.y < LH + 20; });
        }
        K.hist.unshift({ t: clock, y: K.y });
        while (K.hist.length > 2 && clock - K.hist[K.hist.length - 1].t > 1.2) K.hist.pop();
      }

      function updateWind(dt) {
        var w = R.wind, st = R.stage;
        w.t += dt;
        if (w.phase === 'idle' && R.t > w.next) {
          w.phase = 'warn'; w.t = 0; w.dir = Math.random() < 0.5 ? -1 : 1; w.dur = rnd(1.6, 2.4);
          w.force = st ? rnd(340, 480) * (0.75 + 0.4 * R.d) : rnd(380, 560 + Math.min(200, R.t * 1.5));
        }
        else if (w.phase === 'warn' && w.t > 1) { w.phase = 'blow'; w.t = 0; ctx.sfx('whoosh'); }
        else if (w.phase === 'blow' && w.t > w.dur) { w.phase = 'idle'; w.t = 0; w.next = R.t + rnd(8, 14); }
        R.gust = w.phase === 'blow' ? w.dir * w.force * Math.sin(Math.PI * w.t / w.dur) : 0;
        var rate = w.phase === 'warn' ? 12 : w.phase === 'blow' ? 30 : 0;
        if (rate && Math.random() < rate * dt) {
          R.lines.push({ x: LW + rnd(0, 60), y: rnd(40, GY - 20), len: rnd(60, 120), spd: rnd(600, 900), dir: w.dir, a: w.phase === 'warn' ? 0.45 : 0.85 });
        }
        R.lines.forEach(function (l) { l.x -= l.spd * dt; l.y += l.dir * l.spd * 0.18 * dt; });
        R.lines = R.lines.filter(function (l) { return l.x + l.len > -20; });
      }

      function moveWorld(dx, dt) {
        var r = R;
        updateBg(dx, dt);
        r.obs.forEach(function (o) {
          o.x -= dx;
          if (o.type === 'bird') {
            var sp = o.kind === 'eagle' ? 95 : o.kind === 'gull' ? 45 : o.kind === 'owl' ? 25 : 55;
            o.x -= sp * dt; o.ph += dt * (o.kind === 'owl' ? 6 : o.kind === 'eagle' ? 7 : 9);
            o.y = o.by + Math.sin(o.ph * 0.25) * (o.kind === 'gull' ? 34 : o.kind === 'eagle' ? 24 : 16);
          }
          else if (o.type === 'cloud') o.ph += dt;
        });
        r.obs = r.obs.filter(function (o) { return o.x > -260; });
        r.items.forEach(function (it) {
          it.x -= dx;
          if (it.type === 'balloon') { it.ph += dt; it.y = it.by + Math.sin(it.ph * 1.6) * 10; }
          else if (it.type === 'shoot') { it.x -= 210 * dt; it.y += 80 * dt; }
        });
        r.items = r.items.filter(function (it) { return it.x > -60 && !it.got && it.y < GY; });
        r.pops.forEach(function (p) { p.t += dt; p.x -= dx * 0.5; });
        r.pops = r.pops.filter(function (p) { return p.t < 0.9; });
      }

      function hitGround(o, kx, ky, kr) {
        var adx = Math.abs(kx - o.x);
        if (o.kind === 'tree') {
          var dxx = kx - o.x, dyy = ky - o.cy, rr2 = o.r * 0.78 + kr;
          if (dxx * dxx + dyy * dyy < rr2 * rr2) return true;
          return ky > o.cy && adx < 8 + kr * 0.6;
        }
        if (o.kind === 'house') {
          if (adx < o.w + kr * 0.6 && ky > o.wall - kr * 0.6) return true;
          var rw = o.w + 8;
          if (adx < rw + kr * 0.5 && ky > o.apex + o.roofH * Math.min(1, adx / rw) - kr * 0.7) return true;
          return Math.abs(kx - (o.x + o.chx)) < 7 + kr * 0.6 && ky > o.chTop - kr * 0.6;
        }
        // peak / mast: a triangle with the apex at (x, ay) and half width b at the ground
        if (adx < o.b + kr * 0.4) return ky > o.ay + (GY - o.ay) * Math.min(1, adx / o.b) - kr * 0.75;
        return false;
      }

      function updateRun(dt) {
        var r = R;
        r.t += dt;
        var t = r.t;
        if (r.stage) r.v = Math.min(r.vmax, r.v0 + 0.5 * r.dist / 40);
        else r.v = Math.min(380, 160 + (t < 60 ? 1.0 * t : 60 + 1.6 * (t - 60)));
        var dx = r.v * dt;
        r.dist += dx;
        moveWorld(dx, dt);
        updateWind(dt);
        kitePhysics(dt, r.gust);
        K.ang += (clamp(K.vy / 420, -0.45, 0.45) - K.ang) * Math.min(1, dt * 6);
        if (r.rainbow > 0) r.rainbow -= dt;
        if (r.hurt > 0) r.hurt -= dt;
        r.gap -= dx;
        if (r.gap <= 0) spawn();
        if (r.shoot.length && r.dist >= r.shoot[0]) {
          r.shoot.shift();
          r.items.push({ type: 'shoot', x: LW + 30, y: srnd(70, LH * 0.3) }); r.spawned += 5;
        }
        if (r.stage && r.dist >= r.goalU) { reachGoal(); return; }
        // collisions
        var kx = KX, ky = K.y, kr = 12;
        if (r.rainbow <= 0 && r.hurt <= 0) {
          for (var i = 0; i < r.obs.length; i++) {
            var o = r.obs[i], hit = false;
            if (o.type === 'ground') hit = hitGround(o, kx, ky, kr);
            else if (o.type === 'cloud') {
              var ex = (kx - (o.x + o.w / 2)) / (o.w * 0.36 + kr), ey = (ky - (o.y - o.h * 0.4)) / (o.h * 0.36 + kr);
              hit = ex * ex + ey * ey < 1;
            } else if (o.type === 'bird') {
              var br = o.kind === 'eagle' ? 15 : 13, bx = kx - o.x, byy = ky - o.y;
              hit = bx * bx + byy * byy < (br + kr) * (br + kr);
            }
            if (hit) { hurt(o); if (state !== 'run') return; break; }
          }
        }
        r.items.forEach(function (it) {
          var d2 = (it.x - kx) * (it.x - kx) + (it.y - ky) * (it.y - ky);
          if (it.type === 'star' && d2 < 32 * 32) {
            it.got = true; r.stars++; ctx.sfx('coin');
            r.pops.push({ x: it.x, y: it.y - 14, t: 0, text: r.stage ? '+1' : '+5', col: '#c98a00' });
          } else if (it.type === 'balloon' && d2 < 40 * 40) {
            it.got = true; r.stars += 3; ctx.sfx('pop');
            r.pops.push({ x: it.x, y: it.y - 30, t: 0, text: '+3', col: '#c98a00' });
          } else if (it.type === 'shoot' && d2 < 42 * 42) {
            it.got = true; r.stars += 5; ctx.sfx('star');
            r.pops.push({ x: it.x, y: it.y - 20, t: 0, text: '+5', col: '#c98a00' });
          } else if (it.type === 'rainbow' && d2 < 50 * 50) {
            it.got = true; r.rainbow = RAINBOW_TIME; ctx.sfx('star');
            r.pops.push({ x: it.x, y: it.y - 40, t: 0, text: 'Tęcza!', col: PURPLE });
          }
        });
      }

      function hurt(o) {
        R.hearts--;
        ctx.sfx('hit');
        if (R.hearts <= 0) { crash(); return; }
        R.hurt = HURT_TIME;
        // bounce away from what was hit
        K.vy = (o.type === 'ground' || (o.type === 'bird' && o.y > K.y)) ? -320 : 260;
        R.pops.push({ x: KX + 10, y: K.y - 30, t: 0, text: 'Au!', col: '#cf412d' });
      }

      function crash() { state = 'crash'; R.crashT = 0; K.vy = -120; holding = false; pointers = {}; if (R.stage) recordStage(false); }
      function updateCrash(dt) {
        var r = R;
        r.crashT += dt;
        r.spin += dt * 9;
        K.vy += 900 * dt; K.y = Math.min(GY - 10, K.y + K.vy * dt);
        K.ang = r.spin;
        r.pops.forEach(function (p) { p.t += dt; });
        if (r.crashT > 1.3) { if (r.stage) finishStage(false); else finishRun(); }
      }

      // the landmark stands at goalU + 0.62 screen widths, so it is well in view when the goal is reached
      function lmX() { return LW * 0.62 + (R.goalU - R.dist); }
      function reachGoal() {
        state = 'goal'; R.goalT = 0; holding = false; pointers = {};
        recordStage(true);
        ctx.sfx('win');
        if (!reduced) {
          var cols = ['#e2533f', '#f5c330', '#3fae5f', '#3f86d8', '#8a5cd0', '#ff8ab0'];
          for (var i = 0; i < 46; i++) R.confetti.push({ x: KX + rnd(-20, 220), y: rnd(-30, LH * 0.3), vx: rnd(-60, 60), vy: rnd(-80, 120), r: rnd(0, 6), vr: rnd(-6, 6), c: cols[i % cols.length] });
        }
      }
      function updateGoal(dt) {
        var r = R;
        r.goalT += dt; r.t += dt;
        r.v = r.v < 6 ? 0 : r.v * (1 - dt * 2.2);
        var dx = r.v * dt;
        r.dist += dx;
        moveWorld(dx, dt);
        R.lines.forEach(function (l) { l.x -= l.spd * dt; });
        if (r.rainbow > 0) r.rainbow -= dt;
        if (r.hurt > 0) r.hurt -= dt;
        // the kite rises above the landmark and dances there
        var target = Math.min(LH * 0.4, GY - LM[WORLDS[r.stage.wi].id].h - 60) + Math.sin(clock * 3) * 10;
        K.vy += ((target - K.y) * 7 - K.vy * 3.5) * dt; K.y += K.vy * dt;
        K.ang += (clamp(K.vy / 300, -0.4, 0.4) + Math.sin(clock * 4) * 0.1 - K.ang) * Math.min(1, dt * 5);
        if (r.goalT > 2.4) finishStage(true);
      }

      function meters() { return Math.floor(R.dist / 40); }
      function score() { return meters() + R.stars * 5; }

      function finishRun() {
        state = 'over';
        var m = meters(), sc = score(), rec = m > save.best;
        save.best = Math.max(save.best, m);
        save.bestScore = Math.max(save.bestScore, sc);
        save.flights = (save.flights || 0) + 1;
        ctx.save(save);
        ctx.sfx(rec ? 'win' : 'lose');
        ctx.stat('stars', R.stars);
        ctx.stat('best', m, 'max');
        showEndless({
          big: sc + ' pkt',
          title: rec ? 'Nowy rekord!' : 'Koniec lotu',
          lines: [
            m + ' m i ' + R.stars + ' ' + pl(R.stars, 'gwiazdka', 'gwiazdki', 'gwiazdek') + ' z nieba',
            { text: 'Rekord: ' + save.best + ' m · ' + save.bestScore + ' pkt', muted: true }
          ],
          button: 'Leć znowu'
        });
      }

      function starLine(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }
      function rateOf(got, total) { return got >= total * 0.7 ? 3 : got >= total * 0.4 ? 2 : 1; }

      // saved the moment the goal is reached (or the kite crashes), so leaving during the animation keeps the result
      function recordStage(ok) {
        if (R.res) return R.res;
        var st = R.stage, wi = st.wi, si = st.si, w = WORLDS[wi], key = stageKey(wi, si);
        var got = R.stars, total = Math.max(1, R.spawned), rate = ok ? rateOf(got, total) : 0;
        var prev = rating(wi, si), wasDone = worldDone(wi), hadEndless = endlessOpen();
        if (rate > prev) save.stages[key] = rate;
        save.flights = (save.flights || 0) + 1;
        save.last = key;
        ctx.save(save);
        ctx.stat('stars', got);
        if (ok) {
          ctx.stat('stage', 1);
          ctx.stat('stages', doneCount(), 'max');
          if (rate === 3) ctx.sticker('trzy');
          if (!wasDone && worldDone(wi)) ctx.sticker('w-' + w.id);
        }
        R.res = { ok: ok, got: got, total: total, rate: rate, prev: prev, wasDone: wasDone, hadEndless: hadEndless };
        return R.res;
      }

      function finishStage(ok) {
        state = 'over';
        var st = R.stage, wi = st.wi, si = st.si, w = WORLDS[wi];
        var res = recordStage(ok);
        ok = res.ok;
        var got = res.got, total = res.total, rate = res.rate, prev = res.prev, wasDone = res.wasDone, hadEndless = res.hadEndless;
        if (!ok) ctx.sfx('lose');
        var lines = [], title, big, button, next = null;
        if (ok) {
          big = starLine(rate);
          title = (!wasDone && worldDone(wi)) ? w.name + ' ukończon' + (w.id === 'laka' ? 'a' : w.id === 'gory' ? 'e' : w.id === 'noc' ? 'a' : 'e') + '!' : 'Etap ukończony!';
          lines.push('Gwiazdki z nieba: ' + got + ' z ' + total);
          if (rate < 3) lines.push({ text: rate === 1 ? 'Zbierz więcej gwiazdek, a dostaniesz ★★☆.' : 'Ładnie! Na ★★★ zbierz jeszcze więcej gwiazdek.', muted: true });
          if (prev > 0) lines.push({ text: 'Najlepiej: ' + starLine(Math.max(prev, rate)), muted: true });
          if (!hadEndless && endlessOpen()) lines.push('Nowość: lot Bez końca!');
          if (!wasDone && worldDone(wi) && wi + 1 < WORLDS.length) lines.push('Nowy świat: ' + WORLDS[wi + 1].name + '!');
          if (si < 2) next = { wi: wi, si: si + 1 };
          else if (wi + 1 < WORLDS.length) next = { wi: wi + 1, si: 0 };
          button = next ? 'Następny etap' : 'Jeszcze raz';
        } else {
          title = 'Prawie!';
          lines.push('Latawiec doleciał do ' + Math.min(w.len[si], meters()) + ' z ' + w.len[si] + ' m.');
          lines.push({ text: 'Gwiazdki z nieba: ' + got + '. Spróbuj jeszcze raz!', muted: true });
          button = 'Spróbuj jeszcze raz';
        }
        var target = next || st;
        var sec = [];
        if (next) sec.push({ label: 'Jeszcze raz (' + PRICE + ' ★)', keepOpen: true, onClick: function () { payAndFly(st); } });
        sec.push({ label: 'Etapy', onClick: function () { closePanel(); showSelect(); } });
        sec.push({ label: 'Wróć do gier', onClick: function () { closePanel(); ctx.exit(); } });
        closePanel();
        panel = ctx.panel({
          big: big, title: title, lines: lines, price: PRICE, note: 'lot', button: button,
          onPlay: function () { panel = null; startStage(target); },
          secondary: sec
        });
      }
      function payAndFly(stage) {
        if (!ctx.spend(PRICE, 'lot')) { ctx.sfx('error'); ctx.toast('Za mało gwiazdek. Zbieraj je w nauce!'); return; }
        closePanel(); startStage(stage);
      }

      // ---------- panels ----------
      function closePanel() { if (panel) { panel.close(); panel = null; } }
      function closePicker() { if (picker) { picker.remove(); picker = null; } }
      function showEndless(o) {
        closePanel(); closePicker();
        panel = ctx.panel({
          big: o.big, title: o.title, lines: o.lines, price: PRICE, note: 'lot bez końca', button: o.button,
          onPlay: function () { panel = null; startEndless(); },
          secondary: [
            { label: 'Etapy', onClick: function () { closePanel(); showSelect(); } },
            { label: 'Wróć do gier', onClick: function () { closePanel(); ctx.exit(); } }
          ]
        });
      }
      function endlessPanel() {
        curW = 0;
        var lines = ['Leć jak najdalej! Jedno uderzenie kończy lot.'];
        if (save.best > 0) lines.push({ text: 'Rekord: ' + save.best + ' m · ' + save.bestScore + ' pkt', muted: true });
        showEndless({ title: 'Bez końca', lines: lines, button: 'Leć' });
      }
      function stagePanel(wi, si) {
        closePanel(); closePicker();
        curW = wi;
        var w = WORLDS[wi], lines = [w.goal + ': ' + w.len[si] + ' m.'];
        if (wi === 0 && si === 0) lines.push('Trzymaj palec: latawiec leci w górę. Puść: opada.');
        if (si === 0) lines.push(w.news);
        lines.push('Masz 3 serduszka. Uderzenie zabiera jedno.');
        if (rating(wi, si)) lines.push({ text: 'Najlepiej: ' + starLine(rating(wi, si)), muted: true });
        panel = ctx.panel({
          title: w.name + ' · etap ' + (si + 1), lines: lines, medals: true, price: PRICE, note: 'lot', button: 'Leć',
          onPlay: function () { panel = null; startStage({ wi: wi, si: si }); },
          secondary: [{ label: 'Etapy', onClick: function () { closePanel(); showSelect(); } }]
        });
      }
      function startStage(stage) { closePicker(); newRun(stage); holding = false; pointers = {}; state = 'run'; }
      function startEndless() { closePicker(); newRun(null); holding = false; pointers = {}; state = 'run'; }

      // ---------- stage select ----------
      function miniCanvas(w, h, fn) {
        var c = document.createElement('canvas'), d = Math.min(3, window.devicePixelRatio || 1);
        c.width = w * d; c.height = h * d; c.style.width = w + 'px'; c.style.height = h + 'px'; c.style.flex = 'none';
        var cg = c.getContext('2d'); cg.setTransform(d, 0, 0, d, 0, 0); fn(cg);
        return c;
      }
      function worldPic(wi, w, h) {
        var wid = WORLDS[wi].id, th = themeFor(wid, save.sky), night = wid === 'noc' || save.sky === 'noc';
        return miniCanvas(w, h, function (cg) {
          cg.fillStyle = skyGradient(cg, th, h); cg.fillRect(0, 0, w, h);
          if (night) { cg.fillStyle = '#fff'; [[8, 8], [20, 16], [34, 6], [12, 26], [46, 14]].forEach(function (p) { cg.fillRect(p[0], p[1], 1.6, 1.6); }); }
          var gy = h - 9;
          cg.fillStyle = th.far; cg.beginPath(); cg.ellipse(w * 0.25, gy + 4, w * 0.5, 12, 0, 0, Math.PI * 2); cg.fill();
          cg.fillStyle = th.grass; cg.fillRect(0, gy, w, h - gy);
          cg.save(); cg.translate(w * 0.66, gy); var sc = (h - 12) / (LM[wid].h + 50); cg.scale(sc, sc);
          drawLandmark(cg, wid, 0, 0, 0.6, th, night);
          cg.restore();
          cg.save(); cg.translate(w * 0.2, h * 0.32); cg.scale(0.42, 0.42);
          KITE_DRAW[save.kite](cg, { ang: -0.1, tail: fakeTail(5, tailSpec(save.kite)[1], 0), t: 0.4 });
          cg.restore();
        });
      }
      function showSelect() {
        closePanel(); closePicker();
        state = 'idle'; R = null; curW = lastWorld();
        var p = document.createElement('div'); p.className = 'ng-panel';
        var card = document.createElement('div'); card.className = 'ng-card lw-card';
        p.appendChild(card); el.appendChild(p); picker = p;
        var h = document.createElement('h2'); h.textContent = 'Latawiec'; card.appendChild(h);
        var info = document.createElement('p'); info.className = 'muted'; info.textContent = 'Wybierz etap. Lot kosztuje ' + PRICE + ' ★.'; card.appendChild(info);
        var focus = null;
        WORLDS.forEach(function (w, wi) {
          var open = worldOpen(wi), sum = rating(wi, 0) + rating(wi, 1) + rating(wi, 2);
          var row = document.createElement('div'); row.className = 'lw-world' + (open ? '' : ' off');
          row.appendChild(worldPic(wi, 66, 58));
          var body = document.createElement('div'); body.className = 'lw-wbody';
          var nm = document.createElement('div'); nm.className = 'lw-wname';
          nm.innerHTML = '<span>' + w.name + '</span>' + (open ? '<small>' + sum + '/9 ★</small>' : '');
          body.appendChild(nm);
          if (!open) {
            var sub = document.createElement('div'); sub.className = 'lw-sub'; sub.textContent = 'Najpierw ukończ: ' + WORLDS[wi - 1].name;
            body.appendChild(sub);
          } else {
            var sts = document.createElement('div'); sts.className = 'lw-stages';
            for (var si = 0; si < 3; si++) (function (si) {
              var b = document.createElement('button'); b.type = 'button'; b.className = 'lw-st';
              var ok = stageOpen(wi, si), r = rating(wi, si);
              b.setAttribute('aria-label', w.name + ', etap ' + (si + 1));
              if (!ok) { b.disabled = true; b.innerHTML = '<b>' + (si + 1) + '</b><i>🔒</i>'; }
              else {
                b.innerHTML = '<b>' + (si + 1) + '</b><i>' + '★★★'.slice(0, r) + '<span class="e">' + '★★★'.slice(0, 3 - r) + '</span></i>';
                if (!r && !focus) { b.classList.add('next'); focus = row; }
                b.onclick = function () { ctx.sfx('tap'); stagePanel(wi, si); };
              }
              sts.appendChild(b);
            })(si);
            body.appendChild(sts);
          }
          row.appendChild(body);
          card.appendChild(row);
        });
        // endless
        var er = document.createElement('div'); er.className = 'lw-world' + (endlessOpen() ? '' : ' off');
        er.appendChild(miniCanvas(66, 58, function (cg) {
          var th = themeFor('laka', save.sky);
          cg.fillStyle = skyGradient(cg, th, 58); cg.fillRect(0, 0, 66, 58);
          cg.fillStyle = th.grass; cg.fillRect(0, 49, 66, 9);
          cg.font = '34px ' + FONT; cg.textAlign = 'center'; cg.textBaseline = 'middle'; cg.lineWidth = 5; cg.strokeStyle = '#fff';
          cg.strokeText('∞', 33, 28); cg.fillStyle = PURPLE; cg.fillText('∞', 33, 28);
        }));
        var eb = document.createElement('div'); eb.className = 'lw-wbody';
        eb.innerHTML = '<div class="lw-wname"><span>Bez końca</span></div>';
        var esub = document.createElement('div'); esub.className = 'lw-sub';
        esub.textContent = endlessOpen() ? (save.best > 0 ? 'Rekord: ' + save.best + ' m · ' + save.bestScore + ' pkt' : 'Leć jak najdalej!') : 'Najpierw ukończ: Łąka';
        eb.appendChild(esub);
        er.appendChild(eb);
        var ebtn = document.createElement('button'); ebtn.type = 'button'; ebtn.className = 'ng-btn sec';
        ebtn.style.cssText = 'min-height:44px;flex:none';
        ebtn.textContent = 'Leć'; ebtn.disabled = !endlessOpen();
        ebtn.onclick = function () { ctx.sfx('tap'); endlessPanel(); };
        er.appendChild(ebtn);
        card.appendChild(er);
        var rowB = document.createElement('div'); rowB.className = 'ng-row';
        var kb = document.createElement('button'); kb.type = 'button'; kb.className = 'ng-btn sec'; kb.textContent = 'Latawce';
        kb.onclick = function () { ctx.sfx('open'); closePicker(); openHangar(showSelect); };
        var xb = document.createElement('button'); xb.type = 'button'; xb.className = 'ng-btn sec'; xb.textContent = 'Wróć do gier';
        xb.onclick = function () { closePicker(); ctx.exit(); };
        rowB.appendChild(kb); rowB.appendChild(xb);
        card.appendChild(rowB);
        if (focus) card.scrollTop = Math.max(0, focus.offsetTop - card.offsetTop - 70);
      }

      // ---------- hangar (kites + skies) ----------
      function fakeTail(n, sp, t) {
        var a = [];
        for (var i = 0; i < n; i++) a.push({ x: -8 - i * sp, y: 22 + i * 1.5 + Math.sin(t * 6 - i * 0.6) * (1 + i * 0.3) });
        return a;
      }
      function tailSpec(id) { return id === 'smok' ? [14, 7] : id === 'ryba' ? [9, 7] : id === 'samolot' ? [10, 7] : [12, 8]; }
      function tailFor(id, t, ky) {
        var spec = tailSpec(id), n = spec[0], sp = spec[1], out = [];
        var dropY = id === 'klasyczny' ? 28 : id === 'smok' ? 6 : 0;
        for (var i = 0; i < n; i++) {
          var age = (i + 1) * (id === 'smok' ? 0.026 : 0.035), y = ky;
          for (var j = 0; j < K.hist.length; j++) { if (clock - K.hist[j].t >= age) { y = K.hist[j].y; break; } y = K.hist[j].y; }
          out.push({ x: -8 - i * sp, y: (y - ky) + dropY + Math.sin(t * 7 - i * 0.6) * (1 + i * 0.35) + (id === 'klasyczny' ? i * 2 : 0) });
        }
        return out;
      }

      function drawKiteAt(cg, id, x, y, ang, tail, t, sc) {
        cg.save(); cg.translate(x, y); if (sc) cg.scale(sc, sc);
        KITE_DRAW[id](cg, { ang: ang, tail: tail, t: t });
        cg.restore();
      }

      function skyGradient(cg, th, h) {
        var gr = cg.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, th.sky[0]); gr.addColorStop(0.55, th.sky[1]); gr.addColorStop(1, th.sky[2]);
        return gr;
      }

      function openHangar(back) {
        var p = document.createElement('div');
        p.className = 'ng-panel';
        var card = document.createElement('div');
        card.className = 'ng-card';
        card.style.cssText = 'max-height:100%;overflow-y:auto;gap:8px;padding:16px 14px';
        p.appendChild(card);
        el.appendChild(p);
        hangar = p;
        var msg = null;

        function mini(w, h, fn) {
          var c = document.createElement('canvas'), d = Math.min(3, window.devicePixelRatio || 1);
          c.width = w * d; c.height = h * d; c.style.width = w + 'px'; c.style.height = h + 'px'; c.style.flex = 'none';
          var cg = c.getContext('2d'); cg.setTransform(d, 0, 0, d, 0, 0); fn(cg);
          return c;
        }
        function row(icon, name, info, btn, dim) {
          var r = document.createElement('div');
          r.style.cssText = 'display:flex;align-items:center;gap:10px;border:2px solid #d4def0;border-radius:14px;padding:6px 8px;text-align:left';
          if (dim) icon.style.filter = 'grayscale(1) opacity(.5)';
          r.appendChild(icon);
          var tx = document.createElement('div'); tx.style.cssText = 'flex:1;min-width:0;line-height:1.1';
          tx.innerHTML = '<div style="font-size:1.25rem">' + name + '</div><div class="muted" style="font-size:.95rem">' + info + '</div>';
          r.appendChild(tx);
          btn.type = 'button'; btn.style.cssText = 'min-height:44px;min-width:92px;font-size:1.15rem;padding:4px 10px';
          r.appendChild(btn);
          return r;
        }
        function head(text) { var h = document.createElement('p'); h.textContent = text; h.style.cssText = 'font-size:1.35rem;margin-top:4px;text-align:left'; return h; }

        function build() {
          var lvl = ctx.level();
          card.innerHTML = '';
          var h = document.createElement('h2'); h.textContent = 'Latawce'; card.appendChild(h);
          var th = THEME[save.sky];
          var pv = mini(220, 110, function (cg) {
            rr(cg, 0, 0, 220, 110, 16); cg.save(); cg.clip();
            cg.fillStyle = skyGradient(cg, th, 110); cg.fillRect(0, 0, 220, 110);
            cg.fillStyle = th.near; cg.beginPath(); cg.ellipse(60, 118, 120, 26, 0, 0, Math.PI * 2); cg.ellipse(190, 122, 90, 24, 0, 0, Math.PI * 2); cg.fill();
            cg.fillStyle = th.grass; cg.fillRect(0, 100, 220, 10);
            drawStar(cg, 186, 30, 9, 0.2, save.sky === 'noc');
            cg.restore();
            cg.save(); cg.beginPath(); cg.rect(0, 0, 220, 110); cg.clip();
            drawKiteAt(cg, save.kite, 128, 46, -0.1, fakeTail(tailSpec(save.kite)[0], tailSpec(save.kite)[1], 0.4), 0.4);
            cg.restore();
          });
          pv.style.cssText += ';align-self:center;border:2px solid ' + INK + ';border-radius:16px';
          card.appendChild(pv);
          var bal = document.createElement('p'); bal.className = 'muted';
          bal.textContent = 'Masz ' + ctx.balance() + ' ★ · poziom ' + lvl; card.appendChild(bal);
          if (msg) { var mp = document.createElement('p'); mp.textContent = msg.text; mp.style.color = msg.bad ? '#cf412d' : '#2a8a56'; card.appendChild(mp); msg = null; }

          card.appendChild(head('Latawiec'));
          KITES.forEach(function (it) {
            var locked = lvl < it.lvl, owned = it.lvl <= 1 || !!save.owned[it.id], sel = save.kite === it.id;
            var ic = mini(56, 56, function (cg) {
              cg.fillStyle = sel ? '#fff4d6' : '#eef4fc'; rr(cg, 1, 1, 54, 54, 12); cg.fill();
              rr(cg, 1, 1, 54, 54, 12); cg.save(); cg.clip();
              var sc = it.id === 'klasyczny' ? 0.72 : 0.62;
              cg.translate(it.id === 'klasyczny' ? 30 : 34, it.id === 'klasyczny' ? 24 : 28); cg.scale(sc, sc);
              KITE_DRAW[it.id](cg, { ang: 0, tail: fakeTail(Math.min(6, tailSpec(it.id)[0]), tailSpec(it.id)[1], 0), t: 0.4 });
              cg.restore();
            });
            var b = document.createElement('button');
            if (locked) { b.className = 'ng-btn sec'; b.disabled = true; b.textContent = 'poziom ' + it.lvl; }
            else if (!owned) {
              b.className = 'ng-btn'; b.textContent = KITE_PRICE + ' ★';
              b.onclick = function () {
                if (!ctx.spend(KITE_PRICE, 'latawiec ' + it.name)) { msg = { text: 'Za mało gwiazdek. Zbieraj je w nauce!', bad: true }; build(); return; }
                save.owned[it.id] = true; save.kite = it.id; ctx.save(save);
                msg = { text: 'Hura! Nowy latawiec: ' + it.name + '.' }; build();
              };
            } else {
              b.className = 'ng-btn sec'; b.textContent = sel ? 'Wybrany' : 'Wybierz'; b.disabled = sel;
              b.onclick = function () { save.kite = it.id; ctx.save(save); build(); };
            }
            card.appendChild(row(ic, it.name, locked ? 'od poziomu ' + it.lvl : it.info, b, locked));
          });

          card.appendChild(head('Niebo'));
          SKIES.forEach(function (sk) {
            var locked = lvl < sk.lvl, sel = save.sky === sk.id, t2 = THEME[sk.id];
            var ic = mini(56, 56, function (cg) {
              rr(cg, 1, 1, 54, 54, 12); cg.save(); cg.clip();
              cg.fillStyle = skyGradient(cg, t2, 56); cg.fillRect(0, 0, 56, 56);
              if (sk.id === 'noc') { cg.beginPath(); cg.arc(38, 16, 8, 0, Math.PI * 2); cg.fillStyle = '#fff6c9'; cg.fill(); cg.beginPath(); cg.arc(42, 13, 7, 0, Math.PI * 2); cg.fillStyle = t2.sky[0]; cg.fill(); }
              else { cg.beginPath(); cg.arc(sk.id === 'zachod' ? 28 : 38, sk.id === 'zachod' ? 42 : 16, sk.id === 'zachod' ? 11 : 8, 0, Math.PI * 2); cg.fillStyle = sk.id === 'zachod' ? '#ffb347' : '#ffd84a'; cg.fill(); }
              cg.fillStyle = t2.near; cg.beginPath(); cg.ellipse(20, 58, 34, 12, 0, 0, Math.PI * 2); cg.fill();
              cg.restore();
              rr(cg, 1, 1, 54, 54, 12); cg.lineWidth = sel ? 3 : 1.5; cg.strokeStyle = sel ? '#e3a008' : '#c8d3ea'; cg.stroke();
            });
            var b = document.createElement('button');
            if (locked) { b.className = 'ng-btn sec'; b.disabled = true; b.textContent = 'poziom ' + sk.lvl; }
            else { b.className = 'ng-btn sec'; b.textContent = sel ? 'Wybrane' : 'Wybierz'; b.disabled = sel; b.onclick = function () { save.sky = sk.id; ctx.save(save); build(); }; }
            card.appendChild(row(ic, sk.name, locked ? 'od poziomu ' + sk.lvl : 'za darmo', b, locked));
          });

          var done = document.createElement('button'); done.type = 'button'; done.className = 'ng-btn sec';
          done.textContent = 'Gotowe'; done.style.marginTop = '4px';
          done.onclick = function () { p.remove(); hangar = null; back(); };
          card.appendChild(done);
          if (!raf) draw();
        }
        build();
      }

      // ---------- draw ----------
      function hills(off, base, amp, k, col) {
        g.beginPath(); g.moveTo(-5, LH);
        for (var x = -5; x <= LW + 10; x += 8) {
          var wx = x + off;
          g.lineTo(x, base - amp * (0.6 * Math.sin(wx * k) + 0.4 * Math.sin(wx * k * 2.3 + 1.7)));
        }
        g.lineTo(LW + 10, LH); g.closePath();
        g.fillStyle = col; g.fill();
        g.lineWidth = 1.5; g.strokeStyle = 'rgba(29,47,111,.2)'; g.stroke();
      }
      function skyline(off, th, night) {
        // little town houses in the distance
        var step = 46, i0 = Math.floor(off / step) - 1;
        for (var i = i0; i * step - off < LW + step; i++) {
          var bx = i * step - off, hh = 34 + hash01(i) * 58, bw = 38, top = GY - 8 - hh;
          g.beginPath(); g.rect(bx, top, bw, hh + 10); g.fillStyle = th.near; g.fill();
          g.lineWidth = 1.5; g.strokeStyle = 'rgba(29,47,111,.22)'; g.stroke();
          if (hash01(i + 50) < 0.6) { g.beginPath(); g.moveTo(bx - 3, top); g.lineTo(bx + bw / 2, top - 16); g.lineTo(bx + bw + 3, top); g.closePath(); g.fillStyle = mix(th.near, '#7a4f8f', 0.25); g.fill(); g.stroke(); }
          g.fillStyle = night ? 'rgba(255,226,138,.85)' : 'rgba(255,255,255,.55)';
          for (var r = 0; r < 3 && top + 10 + r * 20 < GY - 14; r++) for (var c = 0; c < 2; c++) if (hash01(i * 7 + r * 3 + c) < 0.75) g.fillRect(bx + 7 + c * 16, top + 10 + r * 20, 8, 10);
        }
      }
      function mountains(off, th, night) {
        var step = 130, i0 = Math.floor(off / step) - 1;
        for (var i = i0; i * step - off < LW + step * 1.5; i++) {
          var px = i * step - off, hh = 130 + hash01(i) * 120, hw = 100 + hash01(i + 9) * 40, base = GY - 30;
          g.beginPath(); g.moveTo(px - hw, base + 40); g.lineTo(px, base - hh); g.lineTo(px + hw, base + 40); g.closePath();
          g.fillStyle = th.far; g.fill(); g.lineWidth = 1.5; g.strokeStyle = 'rgba(29,47,111,.22)'; g.stroke();
          var sf = 0.28;
          g.beginPath(); g.moveTo(px - hw * sf, base - hh + (hh + 40) * sf); g.lineTo(px, base - hh); g.lineTo(px + hw * sf, base - hh + (hh + 40) * sf);
          g.lineTo(px + hw * 0.1, base - hh + (hh + 40) * sf * 0.8); g.lineTo(px - hw * 0.08, base - hh + (hh + 40) * sf * 1.05); g.closePath();
          g.fillStyle = night ? 'rgba(220,228,245,.8)' : '#fff'; g.fill();
        }
      }

      function drawTree(o, th, night) {
        var x = o.x, cy = o.cy, r = o.r;
        g.beginPath(); g.moveTo(x - 7, GY + 4); g.lineTo(x - 5, cy + 6); g.lineTo(x + 5, cy + 6); g.lineTo(x + 7, GY + 4); g.closePath();
        g.fillStyle = th.trunk; g.fill(); outline(g, 2);
        g.beginPath(); g.moveTo(x, cy + r * 0.6); g.lineTo(x + 12, cy + r * 0.25); outline(g, 2);
        var col = th.crown[o.c];
        g.beginPath();
        g.arc(x, cy - r * 0.15, r * 0.72, 0, Math.PI * 2);
        g.moveTo(x - r * 0.3 + r * 0.55, cy + r * 0.15); g.arc(x - r * 0.3, cy + r * 0.15, r * 0.55, 0, Math.PI * 2);
        g.moveTo(x + r * 0.35 + r * 0.55, cy + r * 0.12); g.arc(x + r * 0.35, cy + r * 0.12, r * 0.55, 0, Math.PI * 2);
        g.fillStyle = col; g.fill(); outline(g, 2);
        g.beginPath(); g.arc(x - r * 0.25, cy - r * 0.35, r * 0.22, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.2)'; g.fill();
        if (!night) {
          g.fillStyle = '#e2533f';
          [[-0.4, 0.2], [0.3, -0.25], [0.5, 0.3]].forEach(function (p) { g.beginPath(); g.arc(x + p[0] * r, cy + p[1] * r, 3.2, 0, Math.PI * 2); g.fill(); });
        }
      }
      function drawHouse(o, th, night) {
        var x = o.x, w = o.w, rw = w + 8;
        // chimney (behind the roof) with smoke
        var cx = x + o.chx;
        g.beginPath(); g.rect(cx - 6, o.chTop, 12, o.wall - o.chTop); g.fillStyle = '#b5654a'; g.fill(); outline(g, 2);
        g.beginPath(); g.rect(cx - 8, o.chTop - 4, 16, 6); g.fillStyle = '#9a523b'; g.fill(); outline(g, 1.8);
        for (var i = 0; i < 3; i++) {
          var ph = (clock * 0.7 + i / 3) % 1;
          g.beginPath(); g.arc(cx + ph * 14, o.chTop - 10 - ph * 34, 5 + ph * 6, 0, Math.PI * 2);
          g.fillStyle = 'rgba(240,240,250,' + (0.7 * (1 - ph)).toFixed(2) + ')'; g.fill();
        }
        g.beginPath(); g.rect(x - w, o.wall, w * 2, GY - o.wall + 4); g.fillStyle = th.walls[o.c]; g.fill(); outline(g, 2.2);
        g.beginPath(); g.moveTo(x - rw, o.wall + 2); g.lineTo(x, o.apex); g.lineTo(x + rw, o.wall + 2); g.closePath(); g.fillStyle = th.roof; g.fill(); outline(g, 2.2);
        // windows in rows, a door at the bottom
        var win = night ? '#ffe28a' : th.win;
        for (var y = o.wall + 14; y < GY - 46; y += 34) {
          rr(g, x - w + 8, y, 14, 16, 3); g.fillStyle = win; g.fill(); outline(g, 1.6);
          rr(g, x + w - 22, y, 14, 16, 3); g.fillStyle = win; g.fill(); outline(g, 1.6);
        }
        rr(g, x - 8, GY - 26, 16, 30, 7); g.fillStyle = '#8a6142'; g.fill(); outline(g, 1.8);
      }
      function drawPeak(o, th, night) {
        var x = o.x, ay = o.ay, b = o.b, hgt = GY - ay;
        g.beginPath(); g.moveTo(x - b, GY + 4); g.lineTo(x - b * 0.12, ay + 6); g.lineTo(x, ay); g.lineTo(x + b * 0.1, ay + 8); g.lineTo(x + b, GY + 4); g.closePath();
        g.fillStyle = th.rock; g.fill(); outline(g, 2.4);
        g.beginPath(); g.moveTo(x + b * 0.1, ay + 8); g.lineTo(x + b * 0.5, GY - hgt * 0.45); g.lineTo(x + b * 0.35, GY); outline(g, 1.4);
        var s = 0.26;
        g.beginPath(); g.moveTo(x - b * s, ay + hgt * s); g.lineTo(x - b * 0.12, ay + 6); g.lineTo(x, ay); g.lineTo(x + b * 0.1, ay + 8); g.lineTo(x + b * s, ay + hgt * s);
        g.lineTo(x + b * 0.1, ay + hgt * s * 0.75); g.lineTo(x - b * 0.05, ay + hgt * s * 1.1); g.closePath();
        g.fillStyle = night ? '#dfe6f5' : '#fff'; g.fill(); outline(g, 1.8);
      }
      function drawMast(o, th) {
        var x = o.x, ay = o.ay, b = o.b, boom = GY - 20;
        // hull
        g.beginPath(); g.moveTo(x - 44, GY - 16); g.lineTo(x + 46, GY - 16); g.lineTo(x + 34, GY + 6); g.lineTo(x - 34, GY + 6); g.closePath();
        g.fillStyle = th.hull[o.c]; g.fill(); outline(g, 2.2);
        g.beginPath(); g.moveTo(x - 40, GY - 8); g.lineTo(x + 42, GY - 8); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.stroke();
        // sails
        g.beginPath(); g.moveTo(x + 3, ay + 6); g.lineTo(x + 3, boom); g.lineTo(x + b + 4, boom); g.closePath(); g.fillStyle = th.sail; g.fill(); outline(g, 2);
        g.beginPath(); g.moveTo(x - 3, ay + 16); g.lineTo(x - 3, boom); g.lineTo(x - b * 0.8, boom); g.closePath(); g.fillStyle = th.sail; g.fill(); outline(g, 2);
        g.beginPath(); g.moveTo(x + 3, ay + (boom - ay) * 0.55); g.lineTo(x + 3 + b * 0.45, ay + (boom - ay) * 0.55); g.strokeStyle = th.hull[o.c]; g.lineWidth = 4; g.stroke();
        g.beginPath(); g.moveTo(x, GY - 16); g.lineTo(x, ay - 4); outline(g, 3);
        g.beginPath(); g.moveTo(x, ay - 4); g.lineTo(x + 16 + Math.sin(clock * 6 + x) * 2, ay + 1); g.lineTo(x, ay + 6); g.closePath(); g.fillStyle = '#f5c330'; g.fill(); outline(g, 1.4);
      }

      function drawStorm(o, night) {
        var x = o.x, y = o.y, w = o.w, h = o.h;
        var flash = (o.ph % 2.4) < 0.18;
        // rain
        g.strokeStyle = 'rgba(80,120,200,.55)'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath();
        for (var i = 0; i < 5; i++) { var rx = x + w * (0.2 + i * 0.15), ry = y + 6 + ((o.ph * 60 + i * 13) % 26); g.moveTo(rx, ry); g.lineTo(rx - 3, ry + 8); }
        g.stroke();
        cloudShape(g, x, y, w, h);
        g.fillStyle = flash ? '#9aa3c0' : night ? '#5d6488' : '#6f7896'; g.fill(); outline(g, 2.2);
        g.beginPath(); g.ellipse(x + w * 0.45, y - h * 0.15, w * 0.32, h * 0.12, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(29,47,111,.18)'; g.fill();
        // grumpy face
        g.beginPath(); g.moveTo(x + w * 0.36, y - h * 0.5); g.lineTo(x + w * 0.44, y - h * 0.44); g.moveTo(x + w * 0.62, y - h * 0.5); g.lineTo(x + w * 0.54, y - h * 0.44); outline(g, 2);
        g.beginPath(); g.arc(x + w * 0.42, y - h * 0.38, 2.4, 0, Math.PI * 2); g.arc(x + w * 0.56, y - h * 0.38, 2.4, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
        g.beginPath(); g.moveTo(x + w * 0.44, y - h * 0.2); g.quadraticCurveTo(x + w * 0.49, y - h * 0.27, x + w * 0.54, y - h * 0.2); outline(g, 2);
        if ((o.ph % 2.4) < 0.35) {
          var lx = x + w * 0.65;
          g.beginPath(); g.moveTo(lx, y - 2); g.lineTo(lx - 9, y + 18); g.lineTo(lx - 1, y + 18); g.lineTo(lx - 8, y + 36); g.lineTo(lx + 10, y + 12); g.lineTo(lx + 2, y + 12); g.lineTo(lx + 8, y - 2); g.closePath();
          g.fillStyle = '#ffe066'; g.fill(); outline(g, 1.6);
        }
      }

      function drawBird(o) {
        var x = o.x, y = o.y, flap = Math.sin(o.ph), kind = o.kind || 'bird';
        if (kind === 'owl') { drawOwl(o); return; }
        var body = kind === 'eagle' ? '#8a5a33' : kind === 'gull' ? '#f4f6fb' : ['#6b7fc4', '#8a5cd0', '#4f9fd6'][o.c];
        var wing = kind === 'gull' ? '#b9c3d6' : body, beak = kind === 'eagle' ? '#f5c330' : '#f5a623';
        g.save(); g.translate(x, y);
        if (kind === 'eagle') g.scale(1.2, 1.2);
        // back wing
        g.beginPath(); g.moveTo(2, -2); g.quadraticCurveTo(8, -14 - flap * 8, 16, -16 - flap * 12); g.quadraticCurveTo(12, -4, 6, 2); g.closePath();
        g.fillStyle = wing; g.fill(); outline(g, 1.6);
        g.beginPath(); g.ellipse(0, 0, 15, 11, 0, 0, Math.PI * 2); g.fillStyle = body; g.fill(); outline(g, 2);
        if (kind === 'eagle') { g.beginPath(); g.ellipse(-8, -2, 8, 8, 0, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); outline(g, 1.6); }
        else { g.beginPath(); g.ellipse(2, 4, 9, 5, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.45)'; g.fill(); }
        // tail
        g.beginPath(); g.moveTo(13, -2); g.lineTo(24, -8); g.lineTo(22, 2); g.lineTo(13, 4); g.closePath(); g.fillStyle = kind === 'gull' ? '#fff' : body; g.fill(); outline(g, 1.6);
        // beak + eye
        if (kind === 'eagle') { g.beginPath(); g.moveTo(-14, -4); g.quadraticCurveTo(-24, -4, -22, 3); g.lineTo(-14, 2); g.closePath(); }
        else { g.beginPath(); g.moveTo(-14, -3); g.lineTo(-23, 0); g.lineTo(-14, 3); g.closePath(); }
        g.fillStyle = beak; g.fill(); outline(g, 1.4);
        g.beginPath(); g.arc(-7, -3, 2.4, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
        g.beginPath(); g.moveTo(-10, -8); g.lineTo(-4, -6); outline(g, 1.6);
        // front wing
        g.beginPath(); g.moveTo(-2, -1); g.quadraticCurveTo(2, -14 - flap * 10, 12, -18 - flap * 14); g.quadraticCurveTo(10, -2, 4, 4); g.closePath();
        g.fillStyle = wing; g.fill(); outline(g, 1.8);
        if (kind === 'gull') { g.beginPath(); g.moveTo(9, -15 - flap * 12); g.lineTo(12, -18 - flap * 14); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); }
        g.restore();
      }
      function drawOwl(o) {
        var x = o.x, y = o.y, flap = Math.sin(o.ph);
        g.save(); g.translate(x, y);
        g.fillStyle = '#9b7653';
        // wings
        g.beginPath(); g.moveTo(-8, -2); g.quadraticCurveTo(-24, -6 - flap * 12, -26, 6 - flap * 6); g.quadraticCurveTo(-16, 8, -8, 6); g.closePath(); g.fill(); outline(g, 1.6);
        g.beginPath(); g.moveTo(8, -2); g.quadraticCurveTo(24, -6 - flap * 12, 26, 6 - flap * 6); g.quadraticCurveTo(16, 8, 8, 6); g.closePath(); g.fillStyle = '#9b7653'; g.fill(); outline(g, 1.6);
        // body with ear tufts
        g.beginPath(); g.moveTo(-12, -8); g.lineTo(-13, -17); g.lineTo(-5, -12); g.lineTo(5, -12); g.lineTo(13, -17); g.lineTo(12, -8);
        g.quadraticCurveTo(15, 12, 0, 14); g.quadraticCurveTo(-15, 12, -12, -8); g.closePath(); g.fillStyle = '#b08a62'; g.fill(); outline(g, 2);
        g.beginPath(); g.ellipse(0, 6, 7, 6, 0, 0, Math.PI * 2); g.fillStyle = '#e8d3b0'; g.fill();
        g.beginPath(); g.arc(-5, -5, 5, 0, Math.PI * 2); g.arc(5, -5, 5, 0, Math.PI * 2); g.fillStyle = '#fff6c9'; g.fill(); outline(g, 1.4);
        g.beginPath(); g.arc(-5, -5, 2.3, 0, Math.PI * 2); g.arc(5, -5, 2.3, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
        g.beginPath(); g.moveTo(-2, -1); g.lineTo(0, 3); g.lineTo(2, -1); g.closePath(); g.fillStyle = '#f5a623'; g.fill(); outline(g, 1);
        g.restore();
      }

      function drawRainbowCloud(it) {
        var x = it.x, y = it.y + Math.sin(clock * 2) * 5;
        var cols = ['#e2533f', '#f08a24', '#f5c330', '#3fae5f', '#3f86d8', '#8a5cd0'];
        g.lineWidth = 5; g.lineCap = 'butt';
        for (var i = 0; i < cols.length; i++) { g.beginPath(); g.arc(x, y + 4, 44 - i * 5, Math.PI, 0); g.strokeStyle = cols[i]; g.stroke(); }
        cloudShape(g, x - 52, y + 20, 56, 34); g.fillStyle = '#fff'; g.fill(); outline(g, 2);
        cloudShape(g, x - 4, y + 20, 56, 34); g.fillStyle = '#fff'; g.fill(); outline(g, 2);
        for (var k = 0; k < 3; k++) { var a = clock * 2 + k * 2.1; starPath(g, x + Math.cos(a) * 54, y - 6 + Math.sin(a) * 26, 4, 0); g.fillStyle = '#fff6a8'; g.fill(); outline(g, 1); }
      }
      function drawBalloon(it) {
        var x = it.x, y = it.y, col = ['#e2533f', '#3f86d8', '#8a5cd0', '#3fae5f'][it.c];
        g.beginPath(); g.moveTo(x, y + 26); g.quadraticCurveTo(x - 6, y + 40, x + 2, y + 54); outline(g, 1.4);
        g.beginPath(); g.ellipse(x, y, 19, 24, 0, 0, Math.PI * 2); g.fillStyle = col; g.fill(); outline(g, 2.2);
        g.beginPath(); g.moveTo(x - 4, y + 23); g.lineTo(x + 4, y + 23); g.lineTo(x, y + 29); g.closePath(); g.fillStyle = col; g.fill(); outline(g, 1.4);
        g.beginPath(); g.ellipse(x - 7, y - 9, 4, 7, -0.4, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.55)'; g.fill();
        text('3', x + 1, y + 2, 22, '#fff', 'center', 4, INK);
      }
      function drawShoot(it) {
        var x = it.x, y = it.y;
        var gr = g.createLinearGradient(x, y, x + 90, y - 34);
        gr.addColorStop(0, 'rgba(255,240,160,.9)'); gr.addColorStop(1, 'rgba(255,240,160,0)');
        g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 90, y - 40); g.lineTo(x + 94, y - 28); g.lineTo(x, y + 6); g.closePath(); g.fillStyle = gr; g.fill();
        drawStar(g, x, y, 15, clock * 4, true);
      }

      function drawDecor(kind, th, night) {
        var depth = Math.max(4, LH - GY - 20);
        bg.decor.forEach(function (d) {
          var y = GY + 12 + d.y * depth;
          if (kind === 'waves') {
            g.beginPath(); g.arc(d.x, y, 6, Math.PI * 1.1, Math.PI * 1.9); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2; g.stroke();
          } else if (kind === 'stones') {
            g.beginPath(); g.ellipse(d.x, y, 6, 3, 0, 0, Math.PI * 2); g.fillStyle = ['#c2ae8d', '#b09c7b', '#cbb999', '#a8957a'][d.c]; g.fill();
          } else if (kind === 'fireflies') {
            var a = 0.4 + 0.5 * Math.sin(clock * 3 + d.x * 0.1 + d.c);
            var fy = GY - 20 - d.y * 60 + Math.sin(clock * 1.5 + d.c * 2) * 6;
            g.beginPath(); g.arc(d.x, fy, 5, 0, Math.PI * 2); g.fillStyle = 'rgba(255,240,140,' + (a * 0.3).toFixed(2) + ')'; g.fill();
            g.beginPath(); g.arc(d.x, fy, 1.8, 0, Math.PI * 2); g.fillStyle = 'rgba(255,245,170,' + a.toFixed(2) + ')'; g.fill();
          } else {
            g.fillStyle = night ? ['#d5dbef', '#c9b3d9', '#d9c98a', '#c99aa8'][d.c] : (curW === 2 ? ['#fff', '#fff', '#f5c330', '#c9b3ff'] : ['#fff', '#ffd6ec', '#f5c330', '#ff8a8a'])[d.c];
            for (var i = 0; i < 5; i++) { var a2 = i * 1.2566; g.beginPath(); g.arc(d.x + Math.cos(a2) * 3.2, y + Math.sin(a2) * 3.2, 2.2, 0, Math.PI * 2); g.fill(); }
            g.beginPath(); g.arc(d.x, y, 1.8, 0, Math.PI * 2); g.fillStyle = GOLD; g.fill();
          }
        });
      }

      function text(s, x, y, size, col, align, lw, stroke) {
        g.font = size + 'px ' + FONT; g.textAlign = align || 'left'; g.textBaseline = 'middle';
        g.lineJoin = 'round'; g.lineWidth = lw || size * 0.24; g.strokeStyle = stroke || '#fff'; g.strokeText(s, x, y);
        g.fillStyle = col; g.fillText(s, x, y);
      }

      function drawHud(rb) {
        var st = R.stage;
        if (st) {
          // progress to the landmark, hearts on the right
          var x0 = 16, x1 = LW - 118, y = 24, f = clamp(R.dist / R.goalU, 0, 1);
          rr(g, x0, y - 8, x1 - x0, 16, 8); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill(); outline(g, 2);
          if (f > 0.02) { rr(g, x0 + 2, y - 6, Math.max(12, (x1 - x0 - 4) * f), 12, 6); g.fillStyle = PURPLE; g.fill(); }
          // goal flag
          g.beginPath(); g.moveTo(x1 + 6, y + 10); g.lineTo(x1 + 6, y - 14); outline(g, 2);
          g.beginPath(); g.moveTo(x1 + 6, y - 14); g.lineTo(x1 + 20, y - 9); g.lineTo(x1 + 6, y - 4); g.closePath(); g.fillStyle = '#e2533f'; g.fill(); outline(g, 1.4);
          // tiny kite marker
          var mx = x0 + (x1 - x0) * f;
          g.beginPath(); g.moveTo(mx, y - 13); g.lineTo(mx + 8, y); g.lineTo(mx, y + 13); g.lineTo(mx - 8, y); g.closePath(); g.fillStyle = '#f5c330'; g.fill(); outline(g, 1.8);
          for (var i = 0; i < HEARTS; i++) {
            var hx = LW - 82 + i * 30, full = i < R.hearts;
            var pulse = (!full && i === R.hearts && R.hurt > 0) ? 1 + R.hurt * 0.25 : 1;
            heartPath(g, hx, y, 11 * pulse); g.fillStyle = full ? '#e2533f' : 'rgba(255,255,255,.7)'; g.fill(); outline(g, 2);
          }
          drawStar(g, 28, 60, 11, 0, false);
          text('' + R.stars, 46, 61, 28, '#b07800');
        } else {
          text(meters() + ' m', 14, 26, 32, INK);
          drawStar(g, 26, 62, 11, 0, false);
          text('' + R.stars, 44, 63, 28, '#b07800');
        }
        if (rb) {
          var wv = 90, ry = st ? 52 : 16;
          rr(g, LW - 14 - wv, ry, wv, 16, 8); g.fillStyle = '#fff'; g.fill(); outline(g, 2);
          var gr = g.createLinearGradient(LW - 14 - wv, 0, LW - 14, 0);
          ['#e2533f', '#f08a24', '#f5c330', '#3fae5f', '#3f86d8', '#8a5cd0'].forEach(function (cc, ii) { gr.addColorStop(ii / 5, cc); });
          rr(g, LW - 12 - wv, ry + 2, Math.max(4, (wv - 4) * R.rainbow / RAINBOW_TIME), 12, 6); g.fillStyle = gr; g.fill();
        }
        if (R.t < 4.5 && state === 'run') {
          g.globalAlpha = clamp((4.5 - R.t) / 0.6, 0, 1);
          if (st) {
            var w = WORLDS[st.wi];
            text(w.name + ' · etap ' + (st.si + 1), LW / 2, LH * 0.2, 34, PURPLE, 'center');
            text(w.goal + '!', LW / 2, LH * 0.2 + 38, 26, INK, 'center');
            if (st.wi === 0 && st.si === 0) text('Trzymaj palec: w górę. Puść: w dół.', LW / 2, LH * 0.2 + 72, 22, INK, 'center');
          } else {
            text('Trzymaj palec: w górę!', LW / 2, LH * 0.2, 32, INK, 'center');
            text('Puść: w dół.', LW / 2, LH * 0.2 + 36, 26, INK, 'center');
          }
          g.globalAlpha = 1;
        }
        if (state === 'run' && (R.wind.phase === 'warn' || (R.wind.phase === 'blow' && R.wind.t < 0.8))) {
          text(R.wind.dir < 0 ? 'Wiatr w górę!' : 'Wiatr w dół!', LW / 2, 104, 28, PURPLE, 'center');
        }
        if (state === 'goal') {
          var s = 1 + Math.sin(Math.min(1, R.goalT * 2) * Math.PI) * 0.15;
          text('Hura! Jesteś!', LW / 2, LH * 0.2, Math.round(44 * s), PURPLE, 'center', 9);
        }
      }

      function draw() {
        g.setTransform(DPR * S, 0, 0, DPR * S, 0, 0);
        var wid = WORLDS[curW].id, th = themeFor(wid, save.sky), night = wid === 'noc' || save.sky === 'noc';
        g.fillStyle = skyGradient(g, th, GY); g.fillRect(0, 0, LW + 2, GY + 2);
        // sun / moon / night dots
        if (night) {
          var nd = wid === 'noc' ? bg.dots.length : 50;
          for (var di = 0; di < nd; di++) {
            var d = bg.dots[di], al = 0.35 + 0.35 * Math.sin(clock * 2 + d.p);
            g.fillStyle = 'rgba(255,255,255,' + al.toFixed(2) + ')'; g.beginPath(); g.arc(d.x * LW, d.y * GY * 0.8, di % 9 === 0 ? 2.2 : 1.4, 0, Math.PI * 2); g.fill();
          }
          g.beginPath(); g.arc(LW * 0.78, LH * 0.14, 26, 0, Math.PI * 2); g.fillStyle = '#fff6c9'; g.fill();
          g.beginPath(); g.arc(LW * 0.78 + 11, LH * 0.14 - 7, 22, 0, Math.PI * 2); g.fillStyle = th.sky[0]; g.fill();
        } else if (save.sky === 'zachod') {
          g.beginPath(); g.arc(LW * 0.66, GY - 70, 60, 0, Math.PI * 2); g.fillStyle = 'rgba(255,220,150,.35)'; g.fill();
          g.beginPath(); g.arc(LW * 0.66, GY - 70, 42, 0, Math.PI * 2); g.fillStyle = '#ffb347'; g.fill();
        } else {
          g.beginPath(); g.arc(LW * 0.8, LH * 0.13, 36, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
          g.beginPath(); g.arc(LW * 0.8, LH * 0.13, 25, 0, Math.PI * 2); g.fillStyle = '#ffd84a'; g.fill();
          g.lineWidth = 2; g.strokeStyle = 'rgba(29,47,111,.25)'; g.stroke();
        }
        bg.clouds.forEach(function (c) {
          cloudShape(g, c.x, c.y, 120 * c.s, 50 * c.s); g.fillStyle = th.cloud; g.fill();
        });
        if (wid === 'gory') { mountains(bg.far, th, night); hills(bg.near + 400, GY - 22, 14, 0.013, th.near); }
        else if (wid === 'miasto') { hills(bg.far, GY - 70, 24, 0.007, th.far); skyline(bg.near, th, night); }
        else if (wid === 'morze') { hills(bg.far, GY - 30, 30, 0.006, th.far); hills(bg.near + 400, GY - 6, 6, 0.03, th.near); }
        else { hills(bg.far, GY - 70, 24, 0.007, th.far); hills(bg.near + 400, GY - 22, 14, 0.013, th.near); }
        // ground (meadow, street or sea)
        var mg = g.createLinearGradient(0, GY, 0, LH);
        mg.addColorStop(0, th.grass); mg.addColorStop(1, th.grass2);
        g.fillStyle = mg; g.fillRect(0, GY, LW + 2, LH - GY + 2);
        g.beginPath(); g.moveTo(0, GY); g.lineTo(LW + 2, GY); g.lineWidth = 2; g.strokeStyle = 'rgba(29,47,111,.3)'; g.stroke();
        drawDecor(WORLDS[curW].decor, th, night);

        if (R && R.stage) {
          var lx = lmX();
          if (lx - LM[wid].hw < LW + 20) drawLandmark(g, wid, lx, GY, clock, th, night);
        }
        if (R) {
          R.obs.forEach(function (o) {
            if (o.type !== 'ground') return;
            if (o.kind === 'tree') drawTree(o, th, night);
            else if (o.kind === 'house') drawHouse(o, th, night);
            else if (o.kind === 'peak') drawPeak(o, th, night);
            else drawMast(o, th);
          });
          R.items.forEach(function (it) {
            if (it.type === 'star') drawStar(g, it.x, it.y + Math.sin(clock * 3 + it.x * 0.05) * 3, 12, it.rot + Math.sin(clock * 2 + it.x) * 0.15, night);
            else if (it.type === 'balloon') drawBalloon(it);
            else if (it.type === 'shoot') drawShoot(it);
            else drawRainbowCloud(it);
          });
          R.obs.forEach(function (o) { if (o.type === 'bird') drawBird(o); else if (o.type === 'cloud') drawStorm(o, night); });
          // wind lines
          g.lineCap = 'round';
          R.lines.forEach(function (l) {
            g.beginPath(); g.moveTo(l.x, l.y); g.quadraticCurveTo(l.x + l.len * 0.5, l.y - l.dir * l.len * 0.18 - 5, l.x + l.len, l.y - l.dir * l.len * 0.18);
            g.strokeStyle = 'rgba(29,47,111,' + (l.a * (night ? 0.5 : 0.22)).toFixed(2) + ')'; g.lineWidth = 6; g.stroke();
            g.strokeStyle = night ? 'rgba(210,222,255,' + l.a + ')' : 'rgba(255,255,255,' + l.a + ')'; g.lineWidth = 3.2; g.stroke();
          });
        }

        // string from the kite to the bottom-left corner (the holder is off-screen)
        var ky = K.y;
        g.beginPath(); g.moveTo(KX, ky); g.quadraticCurveTo(KX * 0.55, ky + (LH - ky) * 0.75, -10, LH + 10);
        g.strokeStyle = night ? 'rgba(230,235,255,.8)' : 'rgba(29,47,111,.7)'; g.lineWidth = 1.4; g.stroke();
        // rainbow trail
        var tail = tailFor(save.kite, clock, ky);
        var rb = R && R.rainbow > 0;
        if (rb) {
          var cols = ['#e2533f', '#f08a24', '#f5c330', '#3fae5f', '#3f86d8', '#8a5cd0'];
          for (var c = 0; c < cols.length; c++) {
            g.beginPath(); g.moveTo(KX, ky - 10 + c * 4);
            for (var i = 0; i < 12; i++) {
              var age = (i + 1) * 0.05, yy = ky;
              for (var j = 0; j < K.hist.length; j++) { yy = K.hist[j].y; if (clock - K.hist[j].t >= age) break; }
              g.lineTo(KX - 14 - i * 14, yy - 10 + c * 4);
            }
            g.strokeStyle = cols[c]; g.globalAlpha = 0.75; g.lineWidth = 4; g.lineCap = 'round'; g.stroke(); g.globalAlpha = 1;
          }
          var hg = g.createRadialGradient(KX, ky, 8, KX, ky, 44);
          hg.addColorStop(0, 'rgba(255,250,200,.7)'); hg.addColorStop(1, 'rgba(255,250,200,0)');
          g.beginPath(); g.arc(KX, ky, 44, 0, Math.PI * 2); g.fillStyle = hg; g.fill();
        }
        g.save();
        if (rb && R.rainbow < 1.2 && Math.floor(R.rainbow * 8) % 2 === 0) g.globalAlpha = 0.5;
        if (R && R.hurt > 0 && Math.floor(R.hurt * 10) % 2 === 0) g.globalAlpha = 0.35;
        drawKiteAt(g, save.kite, KX, ky, K.ang, tail, clock, 1.15);
        g.restore();

        if (R) {
          R.pops.forEach(function (p) { g.globalAlpha = 1 - p.t / 0.9; text(p.text, p.x, p.y - p.t * 40, 26, p.col, 'center'); g.globalAlpha = 1; });
          R.confetti.forEach(function (p) { g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-4, -2.5, 8, 5); g.restore(); });
        }
        if (R && state !== 'idle') drawHud(rb);
        if (state === 'pause') {
          g.fillStyle = 'rgba(29,47,111,.35)'; g.fillRect(0, 0, LW + 2, LH + 2);
          text('Pauza', LW / 2, LH * 0.38, 56, INK, 'center', 10);
          text('Dotknij, żeby lecieć dalej', LW / 2, LH * 0.38 + 50, 28, INK, 'center');
        }
      }

      // ---------- loop ----------
      var raf = 0, last = 0, alive = true;
      function frame(ts) {
        raf = requestAnimationFrame(frame);
        var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
        last = ts;
        update(dt);
        draw();
      }
      function startLoop() { if (!raf && alive) { last = 0; raf = requestAnimationFrame(frame); } }
      function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

      var ro = new ResizeObserver(resize);
      ro.observe(el);
      resize();
      seedBackground();
      startLoop();
      showSelect();
      if (window.NG_DEBUG) window.NG_DEBUG.latawiec = {
        run: function () { return R; }, state: function () { return state; }, kite: function () { return K; }, hold: function (v) { holding = v; },
        save: function () { return save; }, jump: function (m) { if (R) R.dist = Math.max(R.dist, m * 40); }
      };

      return {
        pause: function () { if (state === 'run') state = 'pause'; holding = false; pointers = {}; stopLoop(); draw(); },
        resume: function () { startLoop(); },
        destroy: function () {
          alive = false;
          stopLoop();
          ro.disconnect();
          cv.removeEventListener('pointerdown', onDown);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onUp);
          window.removeEventListener('keydown', onKey);
          window.removeEventListener('keyup', onKey);
          closePanel();
          closePicker();
          if (hangar) { hangar.remove(); hangar = null; }
          cv.remove();
          css.remove();
        }
      };
    }
  });
})();
