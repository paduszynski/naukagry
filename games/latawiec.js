/*
 * Latawiec: a kite flies over a meadow, the world scrolls right to left.
 * Hold anywhere = the kite rises, release = it sinks (smooth, floaty physics, no flapping).
 * Collect gold stars (in-game points), avoid birds, storm clouds and tree tops. Wind gusts push the kite.
 * One rainbow cloud per flight gives a few seconds of invulnerability.
 * Kite designs unlocked by player level and bought once for 150 ★; sky themes free when unlocked.
 * Logical coordinates: 1 unit = S css px, so a portrait phone is ~400 units wide whatever its size.
 */
(function () {
  'use strict';
  if (!window.NG) return;

  var INK = '#1d2f6f', PURPLE = '#7a4fc4';
  var FONT = '"Patrick Hand", "Comic Sans MS", cursive';
  var PRICE = 100, KITE_PRICE = 150;
  var KX = 120;                       // kite x (logical)
  var LIFT = 950, SINK = 520, DRAG = 2.6, RAINBOW_TIME = 5;

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

  NG.register('latawiec', {
    mount: function (el, ctx) {
      var save = ctx.load({ best: 0, bestScore: 0, flights: 0, owned: {}, kite: 'klasyczny', sky: 'dzien' });
      if (!save.owned || typeof save.owned !== 'object') save.owned = {};
      function kiteOk(id) { var k = KITES.filter(function (x) { return x.id === id; })[0]; return k && (k.lvl <= 1 || (save.owned[id] && ctx.level() >= k.lvl)); }
      function skyOk(id) { var s = SKIES.filter(function (x) { return x.id === id; })[0]; return s && ctx.level() >= s.lvl; }
      if (!kiteOk(save.kite)) save.kite = 'klasyczny';
      if (!skyOk(save.sky)) save.sky = 'dzien';

      var cv = document.createElement('canvas');
      el.appendChild(cv);
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

      var state = 'idle';     // idle | run | pause | crash | over
      var clock = 0, holding = false, pointers = {};
      var R = null;
      var K = { y: 0, vy: 0, ang: 0, hist: [] };   // kite (also used in idle)
      var bg = { far: 0, near: 0, ground: 0, clouds: [], dots: [], decor: [] };
      var panel = null, hangar = null;

      function seedBackground() {
        bg.clouds = []; bg.dots = []; bg.decor = [];
        for (var c = 0; c < 5; c++) bg.clouds.push({ x: rnd(0, LW + 200), y: rnd(60, LH * 0.6), s: rnd(0.6, 1.1) });
        for (var d = 0; d < 50; d++) bg.dots.push({ x: rnd(0, 1), y: rnd(0, 1), p: rnd(0, 6) });
        for (var f = 0; f < 22; f++) bg.decor.push({ x: rnd(0, LW + 200), y: Math.random(), c: (Math.random() * 4) | 0 });
        K.y = LH * 0.42; K.vy = 0; K.hist = [];
      }

      function newRun() {
        R = {
          t: 0, v: 160, dist: 0, stars: 0, obs: [], items: [], pops: [], gap: 420,
          rbT: rnd(22, 42), rbDone: false, rainbow: 0, crashT: 0, spin: 0,
          wind: { next: rnd(12, 16), phase: 'idle', t: 0, dir: 1, force: 0, dur: 2 }, gust: 0, lines: []
        };
        K.y = LH * 0.42; K.vy = 0;
      }

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
      function starsAt(list) { list.forEach(function (p) { R.items.push({ type: 'star', x: p[0], y: p[1], rot: rnd(-0.3, 0.3) }); }); }
      function spawn() {
        var t = R.t, v = R.v, x = LW + 80;
        var gap = v * rnd(1.2, 1.9) + 70 + (t < 15 ? v * 0.8 : 0);
        var top = 70, mid = (top + GY) / 2;
        if (!R.rbDone && t >= R.rbT) {
          R.rbDone = true;
          R.items.push({ type: 'rainbow', x: x + 30, y: rnd(LH * 0.3, GY - 180) });
          R.gap = v * 1.3 + 120; return;
        }
        var pool = ['tree', 'tree', 'stars'];
        if (t > 8) pool.push('cloud', 'cloud');
        if (t > 20) pool.push('bird', 'bird');
        if (t > 45) pool.push('gate', 'tree2', 'bird');
        var k = pool[(Math.random() * pool.length) | 0];
        var hmax = Math.min(330, 170 + t * 2.2);
        if (k === 'tree' || k === 'tree2' || k === 'gate') {
          var r = rnd(36, 48), cy = GY - rnd(120, hmax);
          if (k === 'gate') cy = GY - rnd(120, 170);
          R.obs.push({ type: 'tree', x: x, cy: cy, r: r, c: (Math.random() * 3) | 0 });
          if (k === 'tree2') {
            var cy2 = GY - rnd(120, hmax);
            R.obs.push({ type: 'tree', x: x + 95, cy: cy2, r: rnd(34, 44), c: (Math.random() * 3) | 0 });
            starsAt([[x + 47, Math.min(cy, cy2) - r - 70]]); gap += 95;
          } else if (k === 'gate') {
            var cyc = rnd(top + 40, top + 90);
            R.obs.push({ type: 'cloud', x: x - 60, y: cyc, w: 130, h: 64, ph: rnd(0, 6) });
            var gm = (cyc + 20 + cy - r) / 2;
            starsAt([[x - 40, gm + 10], [x, gm], [x + 40, gm + 10]]);
          } else if (Math.random() < 0.7) {
            var sy = cy - r - 65;
            starsAt([[x - 40, sy + 14], [x, sy], [x + 40, sy + 14]]);
          }
        } else if (k === 'cloud') {
          var cyy = rnd(top + 20, top + Math.min(LH * 0.32, 60 + t * 2.5)), w = rnd(115, 150);
          R.obs.push({ type: 'cloud', x: x, y: cyy, w: w, h: w * 0.48, ph: rnd(0, 6) });
          if (Math.random() < 0.7) starsAt([[x + w * 0.2, cyy + 95], [x + w * 0.5, cyy + 105], [x + w * 0.8, cyy + 95]]);
        } else if (k === 'bird') {
          var by = rnd(LH * 0.22, GY - 170);
          R.obs.push({ type: 'bird', x: x, y: by, by: by, ph: rnd(0, 6), c: (Math.random() * 3) | 0 });
          if (t > 50 && Math.random() < 0.5) {
            var by2 = by + (by < mid ? 110 : -110);
            R.obs.push({ type: 'bird', x: x + 70, y: by2, by: by2, ph: rnd(0, 6), c: (Math.random() * 3) | 0 });
          }
          gap += v * 0.3;
        } else {
          var c0 = rnd(LH * 0.25, GY - 160);
          for (var i = 0; i < 5; i++) starsAt([[x + i * 40, c0 + Math.sin(i * 0.9) * 40]]);
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
        else if (state !== 'pause') {
          updateBg(40 * dt, dt);
          // idle: hover around the middle with a gentle breeze
          var target = LH * 0.42 + Math.sin(clock * 0.9) * 22;
          K.vy += ((target - K.y) * 6 - K.vy * 3) * dt; K.y += K.vy * dt;
          K.ang += (clamp(K.vy / 300, -0.4, 0.4) + Math.sin(clock * 1.7) * 0.06 - K.ang) * Math.min(1, dt * 5);
        }
        K.hist.unshift({ t: clock, y: K.y });
        while (K.hist.length > 2 && clock - K.hist[K.hist.length - 1].t > 1.2) K.hist.pop();
      }

      function updateWind(dt) {
        var w = R.wind;
        w.t += dt;
        if (w.phase === 'idle' && R.t > w.next) { w.phase = 'warn'; w.t = 0; w.dir = Math.random() < 0.5 ? -1 : 1; w.force = rnd(380, 560 + Math.min(200, R.t * 1.5)); w.dur = rnd(1.6, 2.4); }
        else if (w.phase === 'warn' && w.t > 1) { w.phase = 'blow'; w.t = 0; }
        else if (w.phase === 'blow' && w.t > w.dur) { w.phase = 'idle'; w.t = 0; w.next = R.t + rnd(8, 14); }
        R.gust = w.phase === 'blow' ? w.dir * w.force * Math.sin(Math.PI * w.t / w.dur) : 0;
        var rate = w.phase === 'warn' ? 12 : w.phase === 'blow' ? 30 : 0;
        if (rate && Math.random() < rate * dt) {
          R.lines.push({ x: LW + rnd(0, 60), y: rnd(40, GY - 20), len: rnd(60, 120), spd: rnd(600, 900), dir: w.dir, a: w.phase === 'warn' ? 0.45 : 0.85 });
        }
        R.lines.forEach(function (l) { l.x -= l.spd * dt; l.y += l.dir * l.spd * 0.18 * dt; });
        R.lines = R.lines.filter(function (l) { return l.x + l.len > -20; });
      }

      function updateRun(dt) {
        var r = R;
        r.t += dt;
        var t = r.t;
        r.v = Math.min(380, 160 + (t < 60 ? 1.0 * t : 60 + 1.6 * (t - 60)));
        var dx = r.v * dt;
        r.dist += dx;
        updateBg(dx, dt);
        updateWind(dt);
        kitePhysics(dt, r.gust);
        K.ang += (clamp(K.vy / 420, -0.45, 0.45) - K.ang) * Math.min(1, dt * 6);
        if (r.rainbow > 0) r.rainbow -= dt;
        r.gap -= dx;
        if (r.gap <= 0) spawn();
        r.obs.forEach(function (o) {
          o.x -= dx;
          if (o.type === 'bird') { o.x -= 55 * dt; o.ph += dt * 9; o.y = o.by + Math.sin(o.ph * 0.25) * 16; }
          else if (o.type === 'cloud') o.ph += dt;
        });
        r.obs = r.obs.filter(function (o) { return o.x > -200; });
        r.items.forEach(function (it) { it.x -= dx; });
        r.items = r.items.filter(function (it) { return it.x > -60 && !it.got; });
        r.pops.forEach(function (p) { p.t += dt; p.x -= dx * 0.5; });
        r.pops = r.pops.filter(function (p) { return p.t < 0.9; });
        // collisions
        var kx = KX, ky = K.y, kr = 12;
        if (r.rainbow <= 0) {
          for (var i = 0; i < r.obs.length; i++) {
            var o = r.obs[i], hit = false;
            if (o.type === 'tree') {
              var dxx = kx - o.x, dyy = ky - o.cy, rr2 = o.r * 0.78 + kr;
              hit = dxx * dxx + dyy * dyy < rr2 * rr2;
              if (!hit && ky > o.cy) hit = Math.abs(kx - o.x) < 8 + kr * 0.6;
            } else if (o.type === 'cloud') {
              var ex = (kx - (o.x + o.w / 2)) / (o.w * 0.36 + kr), ey = (ky - (o.y - o.h * 0.4)) / (o.h * 0.36 + kr);
              hit = ex * ex + ey * ey < 1;
            } else if (o.type === 'bird') {
              var bx = kx - o.x, byy = ky - o.y;
              hit = bx * bx + byy * byy < (13 + kr) * (13 + kr);
            }
            if (hit) { crash(); return; }
          }
        }
        r.items.forEach(function (it) {
          var d2 = (it.x - kx) * (it.x - kx) + (it.y - ky) * (it.y - ky);
          if (it.type === 'star' && d2 < 32 * 32) {
            it.got = true; r.stars++;
            r.pops.push({ x: it.x, y: it.y - 14, t: 0, text: '+5', col: '#c98a00' });
          } else if (it.type === 'rainbow' && d2 < 50 * 50) {
            it.got = true; r.rainbow = RAINBOW_TIME;
            r.pops.push({ x: it.x, y: it.y - 40, t: 0, text: 'Tęcza!', col: PURPLE });
          }
        });
      }

      function crash() { state = 'crash'; R.crashT = 0; K.vy = -120; holding = false; pointers = {}; }
      function updateCrash(dt) {
        var r = R;
        r.crashT += dt;
        r.spin += dt * 9;
        K.vy += 900 * dt; K.y = Math.min(GY - 10, K.y + K.vy * dt);
        K.ang = r.spin;
        r.pops.forEach(function (p) { p.t += dt; });
        if (r.crashT > 1.3) finishRun();
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
        showPanel({
          big: sc + ' pkt',
          title: rec ? 'Nowy rekord!' : 'Koniec lotu',
          lines: [
            m + ' m i ' + R.stars + ' ' + pl(R.stars, 'gwiazdka', 'gwiazdki', 'gwiazdek') + ' z nieba',
            { text: 'Rekord: ' + save.best + ' m · ' + save.bestScore + ' pkt', muted: true }
          ],
          button: 'Leć znowu'
        });
      }

      // ---------- panels ----------
      function closePanel() { if (panel) { panel.close(); panel = null; } }
      function showPanel(o) {
        closePanel();
        panel = ctx.panel({
          big: o.big, title: o.title, lines: o.lines, price: PRICE, note: 'lot', button: o.button,
          onPlay: function () { closePanel(); startRun(); },
          secondary: [
            { label: 'Latawce', onClick: function () { closePanel(); openHangar(function () { showPanel(o); }); } },
            { label: 'Wróć do gier', onClick: function () { closePanel(); ctx.exit(); } }
          ]
        });
      }
      function startPanel() {
        state = 'idle';
        var lines = ['Trzymaj palec: latawiec leci w górę. Puść: opada.', 'Zbieraj gwiazdki. Uważaj na ptaki, burzowe chmury i drzewa.'];
        if (save.best > 0) lines.push({ text: 'Rekord: ' + save.best + ' m · ' + save.bestScore + ' pkt', muted: true });
        showPanel({ title: 'Latawiec', lines: lines, button: 'Leć' });
      }
      function startRun() { newRun(); holding = false; pointers = {}; state = 'run'; }

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

      function drawTree(o, th) {
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
        if (save.sky !== 'noc') {
          g.fillStyle = '#e2533f';
          [[-0.4, 0.2], [0.3, -0.25], [0.5, 0.3]].forEach(function (p) { g.beginPath(); g.arc(x + p[0] * r, cy + p[1] * r, 3.2, 0, Math.PI * 2); g.fill(); });
        }
      }

      function drawStorm(o) {
        var x = o.x, y = o.y, w = o.w, h = o.h;
        var flash = (o.ph % 2.4) < 0.18;
        // rain
        g.strokeStyle = 'rgba(80,120,200,.55)'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath();
        for (var i = 0; i < 5; i++) { var rx = x + w * (0.2 + i * 0.15), ry = y + 6 + ((o.ph * 60 + i * 13) % 26); g.moveTo(rx, ry); g.lineTo(rx - 3, ry + 8); }
        g.stroke();
        cloudShape(g, x, y, w, h);
        g.fillStyle = flash ? '#9aa3c0' : '#6f7896'; g.fill(); outline(g, 2.2);
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
        var x = o.x, y = o.y, flap = Math.sin(o.ph);
        var body = ['#6b7fc4', '#8a5cd0', '#4f9fd6'][o.c];
        g.save(); g.translate(x, y);
        // back wing
        g.beginPath(); g.moveTo(2, -2); g.quadraticCurveTo(8, -14 - flap * 8, 16, -16 - flap * 12); g.quadraticCurveTo(12, -4, 6, 2); g.closePath();
        g.fillStyle = body; g.fill(); outline(g, 1.6);
        g.beginPath(); g.ellipse(0, 0, 15, 11, 0, 0, Math.PI * 2); g.fillStyle = body; g.fill(); outline(g, 2);
        g.beginPath(); g.ellipse(2, 4, 9, 5, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.45)'; g.fill();
        // tail
        g.beginPath(); g.moveTo(13, -2); g.lineTo(24, -8); g.lineTo(22, 2); g.lineTo(13, 4); g.closePath(); g.fillStyle = body; g.fill(); outline(g, 1.6);
        // beak + eye
        g.beginPath(); g.moveTo(-14, -3); g.lineTo(-23, 0); g.lineTo(-14, 3); g.closePath(); g.fillStyle = '#f5a623'; g.fill(); outline(g, 1.4);
        g.beginPath(); g.arc(-7, -3, 2.4, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
        g.beginPath(); g.moveTo(-10, -8); g.lineTo(-4, -6); outline(g, 1.6);
        // front wing
        g.beginPath(); g.moveTo(-2, -1); g.quadraticCurveTo(2, -14 - flap * 10, 12, -18 - flap * 14); g.quadraticCurveTo(10, -2, 4, 4); g.closePath();
        g.fillStyle = body; g.fill(); outline(g, 1.8);
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

      function text(s, x, y, size, col, align, lw, stroke) {
        g.font = size + 'px ' + FONT; g.textAlign = align || 'left'; g.textBaseline = 'middle';
        g.lineJoin = 'round'; g.lineWidth = lw || size * 0.24; g.strokeStyle = stroke || '#fff'; g.strokeText(s, x, y);
        g.fillStyle = col; g.fillText(s, x, y);
      }

      function draw() {
        g.setTransform(DPR * S, 0, 0, DPR * S, 0, 0);
        var th = THEME[save.sky], night = save.sky === 'noc';
        g.fillStyle = skyGradient(g, th, GY); g.fillRect(0, 0, LW + 2, GY + 2);
        // sun / moon / night dots
        if (night) {
          bg.dots.forEach(function (d) {
            var a = 0.35 + 0.35 * Math.sin(clock * 2 + d.p);
            g.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')'; g.beginPath(); g.arc(d.x * LW, d.y * GY * 0.8, 1.4, 0, Math.PI * 2); g.fill();
          });
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
        hills(bg.far, GY - 70, 24, 0.007, th.far);
        hills(bg.near + 400, GY - 22, 14, 0.013, th.near);
        // meadow
        var mg = g.createLinearGradient(0, GY, 0, LH);
        mg.addColorStop(0, th.grass); mg.addColorStop(1, th.grass2);
        g.fillStyle = mg; g.fillRect(0, GY, LW + 2, LH - GY + 2);
        g.beginPath(); g.moveTo(0, GY); g.lineTo(LW + 2, GY); g.lineWidth = 2; g.strokeStyle = 'rgba(29,47,111,.3)'; g.stroke();
        bg.decor.forEach(function (d) {
          var y = GY + 12 + d.y * Math.max(4, LH - GY - 20);
          g.fillStyle = ['#fff', '#ffd6ec', '#f5c330', '#ff8a8a'][d.c];
          for (var i = 0; i < 5; i++) { var a = i * 1.2566; g.beginPath(); g.arc(d.x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2, 2.2, 0, Math.PI * 2); g.fill(); }
          g.beginPath(); g.arc(d.x, y, 1.8, 0, Math.PI * 2); g.fillStyle = '#e3a008'; g.fill();
        });

        if (R) {
          R.obs.forEach(function (o) { if (o.type === 'tree') drawTree(o, th); });
          R.items.forEach(function (it) {
            if (it.type === 'star') drawStar(g, it.x, it.y + Math.sin(clock * 3 + it.x * 0.05) * 3, 12, it.rot + Math.sin(clock * 2 + it.x) * 0.15, night);
            else drawRainbowCloud(it);
          });
          R.obs.forEach(function (o) { if (o.type === 'bird') drawBird(o); else if (o.type === 'cloud') drawStorm(o); });
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
        drawKiteAt(g, save.kite, KX, ky, K.ang, tail, clock, 1.15);
        g.restore();

        if (R) {
          R.pops.forEach(function (p) { g.globalAlpha = 1 - p.t / 0.9; text(p.text, p.x, p.y - p.t * 40, 26, p.col, 'center'); g.globalAlpha = 1; });
        }
        // HUD
        if (R && state !== 'idle') {
          text(meters() + ' m', 14, 26, 32, INK);
          drawStar(g, 26, 62, 11, 0, false);
          text('' + R.stars, 44, 63, 28, '#b07800');
          if (rb) {
            var wv = 90;
            rr(g, LW - 14 - wv, 16, wv, 16, 8); g.fillStyle = '#fff'; g.fill(); outline(g, 2);
            var gr = g.createLinearGradient(LW - 14 - wv, 0, LW - 14, 0);
            ['#e2533f', '#f08a24', '#f5c330', '#3fae5f', '#3f86d8', '#8a5cd0'].forEach(function (cc, ii) { gr.addColorStop(ii / 5, cc); });
            rr(g, LW - 12 - wv, 18, Math.max(4, (wv - 4) * R.rainbow / RAINBOW_TIME), 12, 6); g.fillStyle = gr; g.fill();
          }
          if (R.t < 4.5 && state === 'run') {
            g.globalAlpha = clamp((4.5 - R.t) / 0.6, 0, 1);
            text('Trzymaj palec: w górę!', LW / 2, LH * 0.2, 32, INK, 'center');
            text('Puść: w dół.', LW / 2, LH * 0.2 + 36, 26, INK, 'center');
            g.globalAlpha = 1;
          }
          if (R.wind.phase === 'warn' || (R.wind.phase === 'blow' && R.wind.t < 0.8)) {
            text(R.wind.dir < 0 ? 'Wiatr w górę!' : 'Wiatr w dół!', LW / 2, 100, 28, PURPLE, 'center');
          }
        }
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
      startPanel();
      if (window.NG_DEBUG) window.NG_DEBUG.latawiec = { run: function () { return R; }, state: function () { return state; }, kite: function () { return K; }, hold: function (v) { holding = v; } };

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
          if (hangar) { hangar.remove(); hangar = null; }
          cv.remove();
        }
      };
    }
  });
})();
