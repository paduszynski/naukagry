/*
 * Jeżyk w biegu: a hedgehog runs through a meadow. Tap = jump, tap again in the air = higher jump (roll).
 * Puddles, stones, logs, later low-flying bees (stay on the ground). Apples stick to the spines.
 * One mushroom per run gives a shield for one hit. Every 30 s the season changes.
 * Cosmetics (hats, scarf, glasses) unlocked by player level, bought once for 75 ★, chosen in the wardrobe.
 * Logical coordinates: 1 unit = S css px, so a portrait phone is ~400 units wide whatever its size.
 */
(function () {
  'use strict';
  if (!window.NG) return;

  var INK = '#1d2f6f', GOLD = '#e3a008', PURPLE = '#7a4fc4';
  var FONT = '"Patrick Hand", "Comic Sans MS", cursive';
  var PRICE = 50, ITEM_PRICE = 75, SEASON_LEN = 30;
  var HOG_SC = 1.3;                 // hedgehog drawing scale
  var GRAV = 2400, JUMP = 820, JUMP2 = 900;

  var SEASONS = [
    { name: 'Wiosna', sky1: '#9fd6ff', sky2: '#e8f7ff', far: '#b9e4a3', near: '#93d273', grass: '#79c457', grass2: '#5ea844', dirt: '#b07f52', dirt2: '#966843', sun: '#ffd84a' },
    { name: 'Lato',   sky1: '#6fbff8', sky2: '#d6f0ff', far: '#9fd884', near: '#6fbf4f', grass: '#5fb243', grass2: '#4a9a35', dirt: '#a06f45', dirt2: '#875b37', sun: '#ffc928' },
    { name: 'Jesień', sky1: '#f2b979', sky2: '#fff0d8', far: '#dcb56d', near: '#c9984a', grass: '#b9a54c', grass2: '#9c8a3a', dirt: '#8f5e36', dirt2: '#774c2b', sun: '#ff9a3c' },
    { name: 'Zima',   sky1: '#a9c3e3', sky2: '#f0f5fc', far: '#e4ecf7', near: '#d3e0f0', grass: '#f7faff', grass2: '#d6e2f2', dirt: '#a3afc4', dirt2: '#8e9ab0', sun: '#fff3c4' }
  ];
  var ITEMS = [
    { id: 'czapka',   name: 'Czapka',   slot: 'head', lvl: 2,  info: 'ciepła, z pomponem' },
    { id: 'szalik',   name: 'Szalik',   slot: 'neck', lvl: 4,  info: 'w paski, fruwa na wietrze' },
    { id: 'kokardka', name: 'Kokardka', slot: 'head', lvl: 6,  info: 'różowa, na czubek głowy' },
    { id: 'korona',   name: 'Korona',   slot: 'head', lvl: 8,  info: 'dla króla łąki' },
    { id: 'okulary',  name: 'Okulary',  slot: 'eyes', lvl: 10, info: 'przeciwsłoneczne' }
  ];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function hex(c) { var n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a, b, t) {
    if (t <= 0) return a; if (t >= 1) return b;
    var A = hex(a), B = hex(b);
    return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' + Math.round(A[1] + (B[1] - A[1]) * t) + ',' + Math.round(A[2] + (B[2] - A[2]) * t) + ')';
  }
  function pl(n, one, few, many) {
    if (n === 1) return one;
    var d = n % 10, h = n % 100;
    return (d >= 2 && d <= 4 && (h < 12 || h > 14)) ? few : many;
  }
  function seasonLabel(i) {
    var n = SEASONS[i % 4].name.toLowerCase();
    return i >= 4 ? n + ' (' + (Math.floor(i / 4) + 1) + '. rok)' : n;
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function outline(g, w) { g.lineWidth = w || 2; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }

  // ---------- drawing: the hedgehog (side view, facing right, feet at y=0) ----------
  var APPLE_SPOTS = [262, 236, 290, 212, 316, 249, 276, 224, 303, 196, 256, 284];

  function drawApple(g, x, y, r) {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = '#e2533f'; g.fill(); outline(g, Math.max(1, r * 0.28));
    g.beginPath(); g.arc(x - r * 0.35, y - r * 0.3, r * 0.28, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
    g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x + r * 0.9, y - r * 1.7, x + r * 1.2, y - r * 1.05);
    g.quadraticCurveTo(x + r * 0.5, y - r * 0.9, x, y - r); g.fillStyle = '#3fae5f'; g.fill();
  }

  // wearables, each drawn around its own origin
  var WEAR = {
    czapka: function (g) {
      g.beginPath(); g.moveTo(-11, 2); g.quadraticCurveTo(-12, -15, 0, -16); g.quadraticCurveTo(12, -15, 11, 2); g.closePath();
      g.fillStyle = '#e2533f'; g.fill(); outline(g);
      g.beginPath(); g.moveTo(-5, -1); g.lineTo(-4, -12); g.moveTo(1, -1); g.lineTo(1, -14); g.moveTo(6, -1); g.lineTo(5, -12);
      g.strokeStyle = '#b8352a'; g.lineWidth = 1.5; g.stroke();
      rr(g, -13, -2, 26, 7, 3.5); g.fillStyle = '#fff'; g.fill(); outline(g);
      g.beginPath(); g.arc(0, -17, 4.5, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); outline(g);
    },
    korona: function (g) {
      g.beginPath(); g.moveTo(-11, 3); g.lineTo(-12, -9); g.lineTo(-6, -3); g.lineTo(0, -13); g.lineTo(6, -3); g.lineTo(12, -9); g.lineTo(11, 3); g.closePath();
      g.fillStyle = '#f5c330'; g.fill(); outline(g);
      g.beginPath(); g.moveTo(-10, 0); g.lineTo(10, 0); g.strokeStyle = GOLD; g.lineWidth = 2; g.stroke();
      [[-12, -9, '#3f86d8'], [0, -13, '#e2533f'], [12, -9, '#3fae5f']].forEach(function (p) {
        g.beginPath(); g.arc(p[0], p[1], 2.4, 0, Math.PI * 2); g.fillStyle = p[2]; g.fill(); outline(g, 1.2);
      });
    },
    kokardka: function (g) {
      g.fillStyle = '#ff7eb6';
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-12, -12, -13, -2); g.quadraticCurveTo(-12, 8, 0, 0); g.closePath(); g.fill(); outline(g);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(12, -12, 13, -2); g.quadraticCurveTo(12, 8, 0, 0); g.closePath(); g.fill(); outline(g);
      g.beginPath(); g.arc(0, 0, 3.6, 0, Math.PI * 2); g.fillStyle = '#e8559a'; g.fill(); outline(g, 1.6);
      g.beginPath(); g.arc(-7, -3, 1.4, 0, Math.PI * 2); g.arc(7, -3, 1.4, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
    },
    okulary: function (g) {
      g.beginPath(); g.moveTo(-4, -1); g.lineTo(-11, -3); outline(g, 1.8);
      g.beginPath(); g.ellipse(8.5, 0.5, 2.6, 4.2, 0, 0, Math.PI * 2); g.fillStyle = '#26305a'; g.fill(); outline(g, 1.5);
      g.beginPath(); g.moveTo(4, -1); g.lineTo(6.5, -0.5); outline(g, 1.6);
      g.beginPath(); g.arc(0, 0, 5.2, 0, Math.PI * 2); g.fillStyle = '#26305a'; g.fill(); outline(g, 1.8);
      g.beginPath(); g.moveTo(-2.5, -2); g.lineTo(0.5, -3.5); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.5; g.stroke();
    },
    szalikTail: function (g, t) {
      var w1 = Math.sin(t * 9) * 3, w2 = Math.sin(t * 9 + 1.5) * 4;
      g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-8, 1 + w1, -14, -2 + w2, -22, 2 + w2);
      g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 8.5; g.stroke();
      g.strokeStyle = '#3f86d8'; g.lineWidth = 5; g.stroke();
      g.setLineDash([3, 4]); g.strokeStyle = '#fff'; g.lineWidth = 5; g.stroke(); g.setLineDash([]);
    },
    szalik: function (g) {
      rr(g, -4.5, -11, 9, 22, 4.5); g.fillStyle = '#3f86d8'; g.fill();
      g.save(); g.clip();
      g.fillStyle = '#fff'; for (var y = -9; y < 12; y += 7) g.fillRect(-6, y, 12, 3);
      g.restore();
      rr(g, -4.5, -11, 9, 22, 4.5); outline(g);
    }
  };

  // st: { t, legs, air, apples, wear, shield, dizzy, roll }
  function drawHog(g, st) {
    var wear = st.wear || {}, t = st.t || 0;
    // feet
    var lp = st.air ? 0 : Math.sin(st.legs || 0) * 5;
    g.fillStyle = '#5a3a22';
    g.beginPath(); g.ellipse(-8 + lp, -2, 6, 4, 0, 0, Math.PI * 2); g.fill(); outline(g, 1.6);
    g.beginPath(); g.ellipse(10 - lp, -2, 6, 4, 0, 0, Math.PI * 2); g.fill(); outline(g, 1.6);
    // scarf tail behind the body
    if (wear.neck === 'szalik') { g.save(); g.translate(2, -10); WEAR.szalikTail(g, t); g.restore(); }
    // spiny back
    var cx = -2, cy = -17, N = 13, a0 = 160 * Math.PI / 180, a1 = 332 * Math.PI / 180;
    g.beginPath();
    for (var i = 0; i <= N * 2; i++) {
      var a = a0 + (a1 - a0) * i / (N * 2), r = i % 2 ? 28 : 19;
      if (i === 0) g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); else g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.lineTo(18, -5); g.quadraticCurveTo(8, 1, -4, 0); g.quadraticCurveTo(-18, -1, -21, -9); g.closePath();
    g.fillStyle = '#8a5a33'; g.fill(); outline(g, 2.2);
    // spine texture
    g.beginPath();
    for (var j = 0; j < 9; j++) {
      var b = a0 + 0.2 + (a1 - a0 - 0.5) * j / 8;
      g.moveTo(cx + Math.cos(b) * 10, cy + Math.sin(b) * 10); g.lineTo(cx + Math.cos(b + 0.08) * 19, cy + Math.sin(b + 0.08) * 19);
    }
    g.strokeStyle = '#6b4325'; g.lineWidth = 1.6; g.stroke();
    // belly
    g.beginPath(); g.ellipse(2, -6, 13, 5, 0, 0, Math.PI); g.fillStyle = '#c8945e'; g.fill();
    // apples stuck on the spines
    for (var k = 0; k < Math.min(st.apples || 0, APPLE_SPOTS.length); k++) {
      var aa = APPLE_SPOTS[k] * Math.PI / 180, ar = k % 2 ? 22 : 25;
      drawApple(g, cx + Math.cos(aa) * ar, cy + Math.sin(aa) * ar + 1, 4.6);
    }
    // ear + face + snout
    g.beginPath(); g.arc(8, -24, 4, 0, Math.PI * 2); g.fillStyle = '#e4b98a'; g.fill(); outline(g, 1.6);
    g.beginPath();
    g.moveTo(3, -22); g.quadraticCurveTo(14, -27, 22, -18); g.quadraticCurveTo(28, -15, 32, -12);
    g.quadraticCurveTo(28, -7, 20, -6); g.quadraticCurveTo(10, -2, 3, -6); g.quadraticCurveTo(-1, -14, 3, -22); g.closePath();
    g.fillStyle = '#f0cf9f'; g.fill(); outline(g, 2);
    g.beginPath(); g.arc(31.5, -12.5, 3, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
    g.beginPath(); g.arc(18, -10, 2.8, 0, Math.PI * 2); g.fillStyle = 'rgba(255,120,140,.45)'; g.fill();
    if (wear.neck === 'szalik') { g.save(); g.translate(4, -12); g.rotate(-0.25); WEAR.szalik(g); g.restore(); }
    // eye
    if (st.dizzy) {
      g.beginPath(); g.moveTo(14, -19); g.lineTo(19, -14); g.moveTo(19, -19); g.lineTo(14, -14); outline(g, 1.8);
    } else {
      var blink = (t % 3.2) > 3.05;
      if (blink) { g.beginPath(); g.moveTo(14, -16.5); g.quadraticCurveTo(16.5, -15, 19, -16.5); outline(g, 1.8); }
      else {
        g.beginPath(); g.arc(16.5, -16.5, 2.6, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
        g.beginPath(); g.arc(17.3, -17.4, 0.9, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
      }
    }
    // smile
    g.beginPath(); g.moveTo(24, -9); g.quadraticCurveTo(26.5, -7.5, 28.5, -9); outline(g, 1.4);
    if (wear.eyes === 'okulary') { g.save(); g.translate(16.5, -16.5); WEAR.okulary(g); g.restore(); }
    if (wear.head) {
      g.save();
      if (wear.head === 'kokardka') { g.translate(4, -31); g.rotate(-0.15); }
      else { g.translate(10, -30); g.rotate(0.32); }
      WEAR[wear.head](g); g.restore();
    }
    if (st.dizzy) {
      for (var d = 0; d < 3; d++) {
        var da = t * 5 + d * 2.1;
        star(g, 8 + Math.cos(da) * 16, -40 + Math.sin(da) * 5, 4, '#f5c330');
      }
    }
    if (st.shield) {
      var pr = 37 + Math.sin(t * 6) * 1.5;
      g.beginPath(); g.arc(5, -20, pr, 0, Math.PI * 2);
      g.fillStyle = 'rgba(140,210,255,.22)'; g.fill();
      g.lineWidth = 2.5; g.strokeStyle = 'rgba(63,134,216,.85)'; g.stroke();
      g.beginPath(); g.arc(5, -20, pr - 6, -2.4, -1.6); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.stroke();
    }
  }

  function star(g, x, y, r, col) {
    g.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
    }
    g.closePath(); g.fillStyle = col; g.fill(); outline(g, Math.max(1, r * 0.25));
  }

  function drawMushroom(g, x, y, t) {
    var glow = 0.5 + 0.5 * Math.sin(t * 5);
    g.beginPath(); g.arc(x, y - 8, 22 + glow * 3, 0, Math.PI * 2); g.fillStyle = 'rgba(255,240,150,' + (0.25 + glow * 0.2) + ')'; g.fill();
    rr(g, x - 6, y - 8, 12, 16, 5); g.fillStyle = '#fff4dc'; g.fill(); outline(g);
    g.beginPath(); g.moveTo(x - 17, y - 6); g.quadraticCurveTo(x - 17, y - 26, x, y - 26); g.quadraticCurveTo(x + 17, y - 26, x + 17, y - 6); g.closePath();
    g.fillStyle = '#e2533f'; g.fill(); outline(g);
    g.fillStyle = '#fff';
    [[-8, -15, 3.4], [4, -20, 3], [9, -11, 2.6], [-2, -10, 2]].forEach(function (p) { g.beginPath(); g.arc(x + p[0], y + p[1], p[2], 0, Math.PI * 2); g.fill(); });
    for (var i = 0; i < 3; i++) {
      var a = t * 2 + i * 2.1;
      star(g, x + Math.cos(a) * 24, y - 12 + Math.sin(a) * 16, 3.2, '#ffe066');
    }
  }

  NG.register('jezyk', {
    mount: function (el, ctx) {
      var save = ctx.load({ best: 0, bestScore: 0, bestSeason: 0, runs: 0, owned: {}, wear: { head: null, neck: null, eyes: null } });
      if (!save.wear || typeof save.wear !== 'object') save.wear = { head: null, neck: null, eyes: null };
      if (!save.owned || typeof save.owned !== 'object') save.owned = {};

      var cv = document.createElement('canvas');
      el.appendChild(cv);
      var g = cv.getContext('2d');
      var W = 1, H = 1, DPR = 1, S = 1, LW = 400, LH = 700, GY = 470;

      function resize() {
        var r = el.getBoundingClientRect();
        W = Math.max(1, r.width); H = Math.max(1, r.height);
        DPR = Math.min(3, window.devicePixelRatio || 1);
        cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
        S = clamp(Math.min(W / 400, H / 700), 0.6, 2.6);
        LW = W / S; LH = H / S; GY = Math.round(LH * 0.68);
        if (!raf) draw();
      }

      // ---------- world state ----------
      var state = 'idle';     // idle | run | pause | crash | over
      var clock = 0;          // always ticking, for idle animation
      var R = null;           // current run
      var bg = { far: 0, near: 0, ground: 0, trees: [], decor: [], clouds: [], parts: [] };
      var panel = null, wardrobe = null;

      function curSeason() { return R ? R.season : 0; }

      function seedBackground() {
        bg.trees = []; bg.decor = []; bg.clouds = []; bg.parts = [];
        for (var x = -40; x < LW + 200; x += rnd(80, 190)) bg.trees.push(makeTree(x, 0));
        for (var y = 0; y < 40; y++) bg.decor.push(makeDecor(rnd(-20, LW + 300), 0));
        for (var c = 0; c < 4; c++) bg.clouds.push({ x: rnd(0, LW + 100), y: rnd(40, GY * 0.45), s: rnd(0.7, 1.25) });
        for (var p = 0; p < 26; p++) bg.parts.push(makePart(0, true));
      }
      function makeTree(x, season) { return { x: x, s: rnd(0.75, 1.25), season: season % 4, kind: Math.random() < 0.5 ? 0 : 1, seed: Math.random() * 10 }; }
      function makeDecor(x, season) {
        var kinds = [['tulip', 'daisy', 'tuft', 'tulip'], ['daisy', 'tuft', 'sunflower', 'tuft'], ['leaf', 'tuft', 'pumpkin', 'leaf'], ['snow', 'snow', 'tuft', 'snow']][season % 4];
        return { x: x, k: kinds[(Math.random() * kinds.length) | 0], y: Math.random(), c: (Math.random() * 3) | 0, season: season % 4 };
      }
      function makePart(season, anywhere) {
        return { x: rnd(0, LW), y: anywhere ? rnd(0, LH) : rnd(-60, -10), vx: rnd(-30, -10), vy: rnd(25, 60), a: rnd(0, 6.28), sp: rnd(1, 3), s: rnd(0.7, 1.3), season: season % 4 };
      }

      function newRun() {
        R = {
          t: 0, v: 230, dist: 0, apples: 0, h: 0, vy: 0, ground: true, dbl: false, roll: 0, legs: 0,
          shield: false, inv: 0, obs: [], items: [], pops: [], gap: 420, mushT: rnd(18, 42), mushDone: false,
          season: 0, banner: 0, buffer: 0, crashT: 0, record: false
        };
      }

      // ---------- input ----------
      function tap() {
        if (state === 'pause') { state = 'run'; return; }
        if (state !== 'run') return;
        if (R.ground) { R.vy = JUMP; R.ground = false; R.dbl = false; }
        else if (!R.dbl) { R.dbl = true; R.vy = JUMP2; R.roll = 0.0001; }
        else R.buffer = 0.15;
      }
      function onDown(e) { if (e.button > 0) return; e.preventDefault(); tap(); }
      function onKey(e) { if (e.code === 'Space' || e.code === 'ArrowUp') { if (state === 'run' || state === 'pause') { e.preventDefault(); tap(); } } }
      cv.addEventListener('pointerdown', onDown);
      window.addEventListener('keydown', onKey);

      // ---------- spawning ----------
      function spawn() {
        var t = R.t, x = LW + 40, v = R.v;
        var gap = v * rnd(1.05, 1.9) + 90 + (t < 20 ? v * 0.6 : 0);
        if (!R.mushDone && t >= R.mushT) {
          R.mushDone = true;
          R.items.push({ type: 'mush', x: x + 20, y: 30 });
          R.gap = v * 1.1 + 160; return;
        }
        // the jump arc gets longer as the hedgehog speeds up (same air time, more ground covered),
        // so apples placed along a jump spread out with speed; spacing was tuned at the start speed 230
        var sv = Math.max(1, v / 230);
        var pool = ['stone', 'puddle', 'stone', 'puddle'];
        if (t > 12) pool.push('log', 'log');
        if (t > 35) pool.push('bee', 'bee');
        if (t > 55) pool.push('pair', 'bigpuddle');
        var k = pool[(Math.random() * pool.length) | 0], o, w = 0;
        if (k === 'stone') { w = rnd(30, 40); o = { type: 'stone', x: x, w: w, h: rnd(22, 28) }; }
        else if (k === 'log') { w = rnd(60, 76); o = { type: 'log', x: x, w: w, h: 28 }; }
        else if (k === 'puddle') { w = rnd(70, 100); o = { type: 'puddle', x: x, w: w, h: 0 }; }
        else if (k === 'bigpuddle') { w = rnd(120, 150); o = { type: 'puddle', x: x, w: w, h: 0 }; }
        else if (k === 'bee') { w = 30; o = { type: 'bee', x: x, w: w, h: 0, fly: 90, ph: rnd(0, 6) }; gap += v * 0.4; }
        if (k === 'pair') {
          var d = v * 0.36;
          R.obs.push({ type: 'stone', x: x, w: 32, h: 24 });
          R.obs.push({ type: 'stone', x: x + d, w: 32, h: 24 });
          w = d + 32; gap += d;
          if (Math.random() < 0.6) { var pa = 36 * sv; apples([[x + d / 2, 150], [x + d / 2 - pa, 128], [x + d / 2 + pa, 128]]); }
        } else {
          R.obs.push(o);
          if (k === 'bee') apples([[x - 30, 22], [x, 22], [x + 30, 22]]);
          else if (Math.random() < 0.5) { var c = x + w / 2, ja = 44 * sv; apples([[c - ja, 95], [c, 135], [c + ja, 95]]); }
        }
        if (Math.random() < 0.3) {
          var gx = x + w + (gap - w) * 0.3;
          apples([[gx, 22], [gx + 34, 22], [gx + 68, 22]]);
        }
        R.gap = gap;
      }
      function apples(list) { list.forEach(function (p) { R.items.push({ type: 'apple', x: p[0], y: p[1], ph: Math.random() * 6 }); }); }

      // ---------- update ----------
      function scroll(dx, season) {
        bg.far += dx * 0.12; bg.near += dx * 0.3; bg.ground += dx;
        bg.trees.forEach(function (tr) { tr.x -= dx * 0.45; });
        bg.trees = bg.trees.filter(function (tr) { return tr.x > -90; });
        var lastT = bg.trees.length ? bg.trees[bg.trees.length - 1].x : 0;
        while (lastT < LW + 120) { lastT += rnd(80, 200); bg.trees.push(makeTree(lastT, season)); }
        bg.decor.forEach(function (d) { d.x -= dx; });
        bg.decor = bg.decor.filter(function (d) { return d.x > -40; });
        while (bg.decor.length < 40) bg.decor.push(makeDecor(LW + rnd(10, 300), season));
        bg.clouds.forEach(function (c) { c.x -= dx * 0.06; });
      }

      function update(dt) {
        clock += dt;
        bg.clouds.forEach(function (c) { c.x -= 5 * dt; if (c.x < -120) { c.x = LW + rnd(40, 160); c.y = rnd(40, GY * 0.45); } });
        var season = curSeason() % 4;
        bg.parts.forEach(function (p) {
          p.x += (p.vx - (state === 'run' ? R.v * 0.15 : 0)) * dt; p.y += p.vy * dt; p.a += p.sp * dt;
          if (p.y > LH + 10 || p.x < -20) { var np = makePart(season, false); for (var k in np) p[k] = np[k]; }
        });
        if (state === 'run') updateRun(dt);
        else if (state === 'crash') updateCrash(dt);
      }

      function updateRun(dt) {
        var r = R;
        r.t += dt;
        var t = r.t;
        r.v = Math.min(520, 230 + (t < 60 ? 1.3 * t : 78 + 2.4 * (t - 60)));
        var dx = r.v * dt;
        r.dist += dx;
        var si = Math.floor(t / SEASON_LEN);
        if (si !== r.season) { r.season = si; r.banner = 2.4; }
        if (r.banner > 0) r.banner -= dt;
        scroll(dx, r.season);
        // physics
        if (r.buffer > 0) r.buffer -= dt;
        if (r.inv > 0) r.inv -= dt;
        if (!r.ground) {
          r.vy -= GRAV * dt; r.h += r.vy * dt;
          if (r.roll > 0) { r.roll += dt / 0.5; if (r.roll >= 1) r.roll = 0; }
          if (r.h <= 0) {
            r.h = 0; r.vy = 0; r.ground = true; r.dbl = false; r.roll = 0;
            if (r.buffer > 0) { r.buffer = 0; r.vy = JUMP; r.ground = false; }
          }
        } else r.legs += dt * (10 + r.v / 30);
        // spawn
        r.gap -= dx;
        if (r.gap <= 0) spawn();
        // move things
        r.obs.forEach(function (o) {
          o.x -= dx;
          if (o.type === 'bee') { o.x -= 45 * dt; o.ph += dt * 4; }
          if (o.ko != null) o.ko += dt * 1.6;
        });
        r.obs = r.obs.filter(function (o) { return o.x + o.w > -80 && !(o.ko >= 1); });
        r.items.forEach(function (it) { it.x -= dx; it.ph = (it.ph || 0) + dt * 3; });
        r.items = r.items.filter(function (it) { return it.x > -40 && !it.got; });
        r.pops.forEach(function (p) { p.t += dt; p.x -= dx * 0.5; });
        r.pops = r.pops.filter(function (p) { return p.t < 0.9; });
        // collisions
        var hx = 90, hy = GY - r.h;
        var box = { l: hx - 18, r: hx + 24, t: hy - 38, b: hy - 2 };
        var cx = hx + 4, cy = hy - 22;
        for (var i = 0; i < r.obs.length; i++) {
          var o = r.obs[i];
          if (o.ko != null) continue;
          var hit = false;
          if (o.type === 'puddle') {
            hit = r.h < 3 && hx + 10 > o.x + 18 && hx - 8 < o.x + o.w - 18;
          } else if (o.type === 'bee') {
            var by = GY - o.fly + Math.sin(o.ph) * 6, bx = o.x + 15;
            var nx = clamp(bx, box.l, box.r), ny = clamp(by, box.t, box.b);
            hit = (nx - bx) * (nx - bx) + (ny - by) * (ny - by) < 12 * 12;
          } else {
            hit = box.r > o.x + 6 && box.l < o.x + o.w - 6 && box.b > GY - o.h + 7;
          }
          if (hit) {
            if (r.inv > 0) continue;
            if (r.shield) {
              r.shield = false; r.inv = 1.3; o.ko = 0;
              r.pops.push({ x: hx + 10, y: hy - 70, t: 0, text: 'Uff!', col: '#3f86d8' });
            } else { crash(); return; }
          }
        }
        r.items.forEach(function (it) {
          var iy = GY - it.y, d2 = (it.x - cx) * (it.x - cx) + (iy - cy) * (iy - cy);
          if (it.type === 'apple' && d2 < 32 * 32) {
            it.got = true; r.apples++;
            r.pops.push({ x: it.x, y: iy - 10, t: 0, text: '+5', col: '#cf412d' });
          } else if (it.type === 'mush' && d2 < 38 * 38) {
            it.got = true; r.shield = true;
            r.pops.push({ x: it.x, y: iy - 30, t: 0, text: 'Tarcza!', col: '#3f86d8' });
          }
        });
      }

      function crash() {
        state = 'crash'; R.crashT = 0; R.vy = 420; R.ground = false; R.roll = 0;
      }
      function updateCrash(dt) {
        var r = R;
        r.crashT += dt;
        r.vy -= GRAV * 0.7 * dt; r.h = Math.max(0, r.h + r.vy * dt);
        if (r.h === 0) r.vy = Math.abs(r.vy) > 200 ? -r.vy * 0.3 : 0;
        r.pops.forEach(function (p) { p.t += dt; });
        if (r.crashT > 1.2) finishRun();
      }

      function meters() { return Math.floor(R.dist / 40); }
      function score() { return meters() + R.apples * 5; }

      function finishRun() {
        state = 'over';
        var m = meters(), sc = score(), rec = m > save.best;
        save.best = Math.max(save.best, m);
        save.bestScore = Math.max(save.bestScore, sc);
        save.bestSeason = Math.max(save.bestSeason, R.season);
        save.runs = (save.runs || 0) + 1;
        ctx.save(save);
        showPanel({
          big: sc + ' pkt',
          title: rec ? 'Nowy rekord!' : 'Koniec biegu',
          lines: [
            m + ' m i ' + R.apples + ' ' + pl(R.apples, 'jabłko', 'jabłka', 'jabłek'),
            'Pora roku: ' + seasonLabel(R.season),
            { text: 'Rekord: ' + save.best + ' m · ' + save.bestScore + ' pkt', muted: true }
          ],
          button: 'Biegnij znowu'
        });
      }

      // ---------- panels ----------
      function closePanel() { if (panel) { panel.close(); panel = null; } }
      function showPanel(o) {
        closePanel();
        panel = ctx.panel({
          big: o.big, title: o.title, lines: o.lines, price: PRICE, note: 'bieg', button: o.button,
          onPlay: function () { closePanel(); startRun(); },
          secondary: [
            { label: 'Szafa', onClick: function () { closePanel(); openWardrobe(function () { showPanel(o); }); } },
            { label: 'Wróć do gier', onClick: function () { closePanel(); ctx.exit(); } }
          ]
        });
      }
      function startPanel() {
        state = 'idle';
        var lines = ['Dotknij: skok. Jeszcze raz w górze: wyżej!', 'Zbieraj jabłka. Omijaj kałuże, kamienie i pszczoły.'];
        if (save.best > 0) lines.push({ text: 'Rekord: ' + save.best + ' m · ' + save.bestScore + ' pkt · ' + seasonLabel(save.bestSeason), muted: true });
        showPanel({ title: 'Jeżyk w biegu', lines: lines, button: 'Biegnij' });
      }
      function startRun() {
        newRun();
        state = 'run';
        bg.trees.forEach(function (tr) { tr.season = 0; });
        bg.decor.forEach(function (d) { if (d.season !== 0) { var nd = makeDecor(d.x, 0); for (var k in nd) d[k] = nd[k]; } });
      }

      // ---------- wardrobe ----------
      function openWardrobe(back) {
        var p = document.createElement('div');
        p.className = 'ng-panel';
        var card = document.createElement('div');
        card.className = 'ng-card';
        card.style.cssText = 'max-height:100%;overflow-y:auto;gap:8px;padding:16px 14px';
        p.appendChild(card);
        el.appendChild(p);
        wardrobe = p;
        var msg = null;

        function mini(w, h, drawFn) {
          var c = document.createElement('canvas'), d = Math.min(3, window.devicePixelRatio || 1);
          c.width = w * d; c.height = h * d; c.style.width = w + 'px'; c.style.height = h + 'px'; c.style.flex = 'none';
          var cg = c.getContext('2d'); cg.setTransform(d, 0, 0, d, 0, 0); drawFn(cg);
          return c;
        }
        function build() {
          var lvl = ctx.level();
          card.innerHTML = '';
          var h = document.createElement('h2'); h.textContent = 'Szafa jeżyka'; card.appendChild(h);
          var pv = mini(220, 104, function (cg) {
            cg.fillStyle = '#e2f4ff'; rr(cg, 0, 0, 220, 104, 16); cg.fill();
            cg.fillStyle = '#8fd06b'; cg.fillRect(0, 86, 220, 18);
            cg.save(); cg.translate(104, 88); cg.scale(1.7, 1.7);
            drawHog(cg, { t: 0.5, legs: 0, apples: 0, wear: save.wear }); cg.restore();
          });
          pv.style.cssText += ';align-self:center;border:2px solid ' + INK + ';border-radius:16px';
          card.appendChild(pv);
          var bal = document.createElement('p'); bal.className = 'muted';
          bal.textContent = 'Masz ' + ctx.balance() + ' ★ · poziom ' + lvl; card.appendChild(bal);
          if (msg) { var mp = document.createElement('p'); mp.textContent = msg.text; mp.style.color = msg.bad ? '#cf412d' : '#2a8a56'; card.appendChild(mp); msg = null; }
          ITEMS.forEach(function (it) {
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:10px;border:2px solid #d4def0;border-radius:14px;padding:6px 8px;text-align:left';
            var locked = lvl < it.lvl, owned = !!save.owned[it.id], worn = save.wear[it.slot] === it.id;
            var ic = mini(52, 52, function (cg) {
              cg.fillStyle = worn ? '#fff4d6' : '#f3f6fc'; rr(cg, 1, 1, 50, 50, 12); cg.fill();
              cg.save(); cg.translate(it.slot === 'neck' ? 36 : 26, it.slot === 'head' ? 34 : 26); cg.scale(it.slot === 'head' ? 1.5 : 1.6, it.slot === 'head' ? 1.5 : 1.6);
              if (it.slot === 'neck') { cg.save(); cg.translate(-1, 0); WEAR.szalikTail(cg, 0); cg.restore(); }
              WEAR[it.id](cg); cg.restore();
            });
            if (locked) ic.style.filter = 'grayscale(1) opacity(.5)';
            row.appendChild(ic);
            var tx = document.createElement('div'); tx.style.cssText = 'flex:1;min-width:0;line-height:1.1';
            tx.innerHTML = '<div style="font-size:1.3rem">' + it.name + '</div><div class="muted" style="font-size:.95rem">' +
              (locked ? 'od poziomu ' + it.lvl : it.info) + '</div>';
            row.appendChild(tx);
            var b = document.createElement('button'); b.type = 'button';
            b.style.cssText = 'min-height:44px;min-width:92px;font-size:1.15rem;padding:4px 10px';
            if (locked) { b.className = 'ng-btn sec'; b.disabled = true; b.textContent = 'poziom ' + it.lvl; }
            else if (!owned) {
              b.className = 'ng-btn'; b.textContent = ITEM_PRICE + ' ★';
              b.onclick = function () {
                if (!ctx.spend(ITEM_PRICE, 'szafa: ' + it.name)) { msg = { text: 'Za mało gwiazdek. Zbieraj je w nauce!', bad: true }; build(); return; }
                save.owned[it.id] = true; save.wear[it.slot] = it.id; ctx.save(save);
                msg = { text: 'Hura! ' + it.name + ' w szafie.' }; build();
              };
            } else {
              b.className = 'ng-btn sec'; b.textContent = worn ? 'Zdejmij' : 'Załóż';
              b.onclick = function () { save.wear[it.slot] = worn ? null : it.id; ctx.save(save); build(); };
            }
            row.appendChild(b);
            card.appendChild(row);
          });
          var done = document.createElement('button'); done.type = 'button'; done.className = 'ng-btn sec';
          done.textContent = 'Gotowe'; done.style.marginTop = '4px';
          done.onclick = function () { p.remove(); wardrobe = null; back(); };
          card.appendChild(done);
          if (!raf) draw();
        }
        build();
      }

      // ---------- draw ----------
      function palette() {
        var si = curSeason(), t = R ? R.t - si * SEASON_LEN : 99;
        var a = SEASONS[(si + 3) % 4], b = SEASONS[si % 4], k = si === 0 ? 1 : clamp(t / 2.5, 0, 1);
        var P = {};
        for (var key in b) if (key !== 'name') P[key] = mix(a[key], b[key], k);
        return P;
      }

      function hills(off, base, amp, k, col) {
        g.beginPath(); g.moveTo(-5, LH);
        for (var x = -5; x <= LW + 10; x += 8) {
          var wx = x + off;
          g.lineTo(x, base - amp * (0.6 * Math.sin(wx * k) + 0.4 * Math.sin(wx * k * 2.3 + 1.7)));
        }
        g.lineTo(LW + 10, LH); g.closePath();
        g.fillStyle = col; g.fill();
        g.lineWidth = 1.5; g.strokeStyle = 'rgba(29,47,111,.18)'; g.stroke();
      }

      function drawCloud(c) {
        g.save(); g.translate(c.x, c.y); g.scale(c.s, c.s);
        g.beginPath();
        g.arc(0, 0, 18, Math.PI * 0.5, Math.PI * 1.5); g.arc(20, -12, 20, Math.PI, Math.PI * 1.9);
        g.arc(44, -4, 16, Math.PI * 1.3, Math.PI * 0.5); g.closePath();
        g.fillStyle = 'rgba(255,255,255,.92)'; g.fill();
        g.lineWidth = 1.5; g.strokeStyle = 'rgba(29,47,111,.2)'; g.stroke();
        g.restore();
      }

      function drawTree(tr) {
        var x = tr.x, base = GY - 2, s = tr.s;
        g.save(); g.translate(x, base); g.scale(s, s);
        g.fillStyle = '#8a6142';
        g.beginPath(); g.moveTo(-4, 0); g.lineTo(-3, -42); g.lineTo(3, -42); g.lineTo(4, 0); g.closePath(); g.fill();
        g.lineWidth = 1.5; g.strokeStyle = 'rgba(29,47,111,.35)'; g.stroke();
        var cols = [['#6cc66a', '#ff9fc6'], ['#3f9e45', null], ['#e9813c', '#f5c330'], [null, null]][tr.season];
        if (tr.season === 3) {
          g.beginPath(); g.moveTo(0, -30); g.lineTo(-14, -50); g.moveTo(0, -38); g.lineTo(12, -58); g.moveTo(-1, -42); g.lineTo(-2, -64);
          g.moveTo(-8, -42); g.lineTo(-18, -46); g.moveTo(7, -50); g.lineTo(16, -52);
          g.strokeStyle = '#8a6142'; g.lineWidth = 3; g.stroke();
          g.fillStyle = '#fff';
          [[-14, -51], [12, -59], [-2, -65]].forEach(function (p) { g.beginPath(); g.ellipse(p[0], p[1], 5, 2.5, 0, 0, Math.PI * 2); g.fill(); });
        } else if (tr.kind === 0) {
          g.beginPath(); g.arc(0, -52, 20, 0, Math.PI * 2); g.arc(-13, -42, 13, 0, Math.PI * 2); g.arc(13, -42, 13, 0, Math.PI * 2);
          g.fillStyle = cols[0]; g.fill();
          g.lineWidth = 1.5; g.strokeStyle = 'rgba(29,47,111,.3)'; g.stroke();
          if (cols[1]) {
            g.fillStyle = cols[1];
            for (var i = 0; i < 6; i++) { var a = tr.seed + i * 1.1; g.beginPath(); g.arc(Math.cos(a) * 14, -48 + Math.sin(a) * 11, 2.6, 0, Math.PI * 2); g.fill(); }
          }
        } else {
          g.beginPath(); g.moveTo(0, -78); g.lineTo(17, -34); g.lineTo(-17, -34); g.closePath();
          g.fillStyle = tr.season === 2 ? '#c9762f' : tr.season === 0 ? '#58b25c' : '#2f8a45'; g.fill();
          g.lineWidth = 1.5; g.strokeStyle = 'rgba(29,47,111,.3)'; g.stroke();
          if (cols[1]) { g.fillStyle = cols[1]; g.beginPath(); g.arc(-5, -48, 2.5, 0, Math.PI * 2); g.arc(6, -58, 2.5, 0, Math.PI * 2); g.fill(); }
        }
        g.restore();
      }

      function drawDecor(d, P) {
        var y = GY + 36 + d.y * Math.max(10, LH - GY - 56), x = d.x;
        g.save(); g.translate(x, y);
        if (d.k === 'tuft') {
          g.beginPath(); g.moveTo(-6, 0); g.quadraticCurveTo(-6, -8, -9, -12); g.moveTo(0, 0); g.lineTo(0, -14); g.moveTo(6, 0); g.quadraticCurveTo(6, -8, 9, -11);
          g.strokeStyle = d.season === 3 ? '#9fb3cf' : d.season === 2 ? '#8c7a33' : '#3f8f35'; g.lineWidth = 2.2; g.lineCap = 'round'; g.stroke();
        } else if (d.k === 'tulip' || d.k === 'daisy' || d.k === 'sunflower') {
          var big = d.k === 'sunflower';
          g.beginPath(); g.moveTo(0, 0); g.lineTo(0, big ? -24 : -14); g.strokeStyle = '#3f8f35'; g.lineWidth = 2; g.stroke();
          var fy = big ? -26 : -16;
          if (d.k === 'tulip') {
            g.beginPath(); g.moveTo(-5, fy - 4); g.lineTo(-2.5, fy - 1); g.lineTo(0, fy - 5); g.lineTo(2.5, fy - 1); g.lineTo(5, fy - 4); g.quadraticCurveTo(5, fy + 4, 0, fy + 4); g.quadraticCurveTo(-5, fy + 4, -5, fy - 4);
            g.fillStyle = ['#ff7eb6', '#e2533f', '#f5c330'][d.c]; g.fill(); outline(g, 1.2);
          } else {
            var pr = big ? 7 : 4.5;
            g.fillStyle = big ? '#f5c330' : ['#fff', '#fff', '#ffd6ec'][d.c];
            for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3; g.beginPath(); g.arc(Math.cos(a) * pr, fy + Math.sin(a) * pr, pr * 0.6, 0, Math.PI * 2); g.fill(); }
            g.beginPath(); g.arc(0, fy, pr * 0.55, 0, Math.PI * 2); g.fillStyle = big ? '#7a4a22' : '#f5c330'; g.fill();
          }
        } else if (d.k === 'leaf') {
          g.rotate(d.c); g.beginPath(); g.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2); g.fillStyle = ['#e9813c', '#f5c330', '#cf412d'][d.c]; g.fill();
        } else if (d.k === 'pumpkin') {
          g.beginPath(); g.ellipse(0, -6, 10, 7, 0, 0, Math.PI * 2); g.fillStyle = '#f08a24'; g.fill(); outline(g, 1.4);
          g.beginPath(); g.moveTo(0, -12); g.lineTo(1, -16); g.strokeStyle = '#3f8f35'; g.lineWidth = 2.2; g.stroke();
        } else if (d.k === 'snow') {
          g.beginPath(); g.ellipse(0, -2, 12 + d.c * 3, 5, 0, Math.PI, 0); g.fillStyle = '#fff'; g.fill();
          g.lineWidth = 1; g.strokeStyle = 'rgba(29,47,111,.2)'; g.stroke();
        }
        g.restore();
      }

      function drawObstacle(o, season) {
        g.save();
        if (o.ko != null) { g.globalAlpha = Math.max(0, 1 - o.ko); g.translate(o.x + o.w / 2, GY - o.ko * 110); g.rotate(o.ko * 4); g.translate(-(o.x + o.w / 2), -GY); }
        var x = o.x, w = o.w, h = o.h;
        if (o.type === 'stone') {
          g.beginPath(); g.moveTo(x, GY); g.quadraticCurveTo(x - 2, GY - h * 0.7, x + w * 0.3, GY - h);
          g.quadraticCurveTo(x + w * 0.75, GY - h * 1.12, x + w, GY - h * 0.35); g.quadraticCurveTo(x + w + 2, GY, x + w, GY); g.closePath();
          g.fillStyle = '#9aa4b8'; g.fill(); outline(g, 2);
          g.beginPath(); g.ellipse(x + w * 0.38, GY - h * 0.72, w * 0.14, h * 0.12, -0.4, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.6)'; g.fill();
          if (season === 3) { g.beginPath(); g.ellipse(x + w * 0.5, GY - h * 0.93, w * 0.34, h * 0.16, -0.1, Math.PI, 0); g.fillStyle = '#fff'; g.fill(); }
        } else if (o.type === 'log') {
          rr(g, x, GY - h, w, h, h / 2); g.fillStyle = '#9b6a3f'; g.fill(); outline(g, 2);
          g.beginPath(); g.moveTo(x + 18, GY - h * 0.6); g.lineTo(x + w - 14, GY - h * 0.6); g.moveTo(x + 24, GY - h * 0.3); g.lineTo(x + w - 20, GY - h * 0.3);
          g.strokeStyle = '#7a4f2c'; g.lineWidth = 1.5; g.stroke();
          g.beginPath(); g.ellipse(x + h / 2, GY - h / 2, h / 2 - 1, h / 2 - 1, 0, 0, Math.PI * 2); g.fillStyle = '#e8c08a'; g.fill(); outline(g, 2);
          g.beginPath(); g.arc(x + h / 2, GY - h / 2, h * 0.28, 0, Math.PI * 2); g.arc(x + h / 2, GY - h / 2, h * 0.1, 0, Math.PI * 2);
          g.strokeStyle = '#b5884f'; g.lineWidth = 1.4; g.stroke();
          g.beginPath(); g.moveTo(x + w * 0.62, GY - h); g.quadraticCurveTo(x + w * 0.66, GY - h - 9, x + w * 0.74, GY - h - 10); g.strokeStyle = '#3f8f35'; g.lineWidth = 2; g.stroke();
          if (season === 3) { rr(g, x + h * 0.6, GY - h - 4, w - h * 0.8, 7, 3.5); g.fillStyle = '#fff'; g.fill(); }
        } else if (o.type === 'puddle') {
          var ice = season === 3;
          g.beginPath(); g.ellipse(x + w / 2, GY + 4, w / 2, 7, 0, 0, Math.PI * 2);
          g.fillStyle = ice ? '#cfe8ff' : '#4d97e0'; g.fill(); outline(g, 2);
          g.beginPath(); g.ellipse(x + w * 0.4, GY + 2.5, w * 0.18, 1.8, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.75)'; g.fill();
          if (ice) { g.beginPath(); g.moveTo(x + w * 0.6, GY + 1); g.lineTo(x + w * 0.75, GY + 7); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
          if (season === 2) { g.save(); g.translate(x + w * 0.68, GY + 4); g.rotate(0.5); g.beginPath(); g.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI * 2); g.fillStyle = '#e9813c'; g.fill(); g.restore(); }
        } else if (o.type === 'bee') {
          var bx = x + 15, by = GY - o.fly + Math.sin(o.ph) * 6;
          g.setLineDash([2, 5]); g.beginPath(); g.moveTo(bx + 16, by + 2); g.quadraticCurveTo(bx + 34, by - 8 + Math.sin(o.ph) * 4, bx + 50, by + 4);
          g.strokeStyle = 'rgba(29,47,111,.35)'; g.lineWidth = 1.5; g.stroke(); g.setLineDash([]);
          var flap = Math.sin(clock * 40) * 0.5;
          g.translate(bx, by); g.scale(1.3, 1.3); g.translate(-bx, -by);
          g.save(); g.translate(bx + 2, by - 7); g.rotate(-0.4 + flap);
          g.beginPath(); g.ellipse(0, -6, 5, 9, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill(); outline(g, 1.4); g.restore();
          g.beginPath(); g.ellipse(bx, by, 14, 10, 0, 0, Math.PI * 2); g.fillStyle = '#f5c330'; g.fill();
          g.save(); g.clip(); g.fillStyle = INK; g.fillRect(bx - 3, by - 12, 4, 24); g.fillRect(bx + 5, by - 12, 4, 24); g.restore();
          g.beginPath(); g.ellipse(bx, by, 14, 10, 0, 0, Math.PI * 2); outline(g, 2);
          g.beginPath(); g.moveTo(bx + 13, by + 1); g.lineTo(bx + 19, by + 2); g.lineTo(bx + 13, by + 4); g.fillStyle = INK; g.fill();
          g.beginPath(); g.arc(bx - 8, by - 2, 2, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
          g.beginPath(); g.moveTo(bx - 10, by - 8); g.quadraticCurveTo(bx - 14, by - 16, bx - 17, by - 15); outline(g, 1.4);
          g.save(); g.translate(bx - 4, by - 8); g.rotate(0.5 - flap);
          g.beginPath(); g.ellipse(0, -6, 5, 9, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.9)'; g.fill(); outline(g, 1.4); g.restore();
        }
        g.restore();
      }

      function drawPart(p) {
        g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.scale(p.s, p.s);
        if (p.season === 0) { g.beginPath(); g.ellipse(0, 0, 4, 2.4, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(255,170,205,.85)'; g.fill(); }
        else if (p.season === 1) { g.beginPath(); g.arc(0, 0, 1.6, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.8)'; g.fill(); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 6); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1; g.stroke(); }
        else if (p.season === 2) { g.beginPath(); g.ellipse(0, 0, 5.5, 2.8, 0, 0, Math.PI * 2); g.fillStyle = ['#e9813c', '#f5c330', '#cf412d'][Math.floor(p.sp * 10) % 3]; g.fill(); }
        else { g.beginPath(); g.arc(0, 0, 2.6, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 0.8; g.strokeStyle = 'rgba(29,47,111,.25)'; g.stroke(); }
        g.restore();
      }

      function text(s, x, y, size, col, align, lw) {
        g.font = size + 'px ' + FONT; g.textAlign = align || 'left'; g.textBaseline = 'middle';
        g.lineJoin = 'round'; g.lineWidth = lw || size * 0.24; g.strokeStyle = '#fff'; g.strokeText(s, x, y);
        g.fillStyle = col; g.fillText(s, x, y);
      }

      function draw() {
        g.setTransform(DPR * S, 0, 0, DPR * S, 0, 0);
        var P = palette(), season = curSeason() % 4;
        // sky
        var sk = g.createLinearGradient(0, 0, 0, GY);
        sk.addColorStop(0, P.sky1); sk.addColorStop(1, P.sky2);
        g.fillStyle = sk; g.fillRect(0, 0, LW + 2, GY + 2);
        // sun
        var sx = LW * 0.74, sy = GY * 0.24;
        g.beginPath(); g.arc(sx, sy, 34, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
        g.beginPath(); g.arc(sx, sy, 24, 0, Math.PI * 2); g.fillStyle = P.sun; g.fill();
        g.lineWidth = 2; g.strokeStyle = 'rgba(29,47,111,.25)'; g.stroke();
        bg.clouds.forEach(drawCloud);
        hills(bg.far, GY - 105, 26, 0.008, P.far);
        hills(bg.near + 300, GY - 40, 16, 0.014, P.near);
        bg.trees.forEach(drawTree);
        // ground: meadow with a dirt path along the top
        var mg = g.createLinearGradient(0, GY, 0, LH);
        mg.addColorStop(0, P.grass); mg.addColorStop(1, P.grass2);
        g.fillStyle = mg; g.fillRect(0, GY, LW + 2, LH - GY + 2);
        g.fillStyle = P.dirt;
        g.beginPath(); g.moveTo(0, GY - 1); g.lineTo(LW + 2, GY - 1); g.lineTo(LW + 2, GY + 14);
        var off2 = bg.ground % 40;
        for (var x2 = LW + 40 - off2; x2 > -40; x2 -= 40) { g.quadraticCurveTo(x2 - 10, GY + 22, x2 - 20, GY + 16); g.quadraticCurveTo(x2 - 30, GY + 11, x2 - 40, GY + 17); }
        g.lineTo(0, GY + 16); g.closePath(); g.fill();
        g.lineWidth = 1.5; g.strokeStyle = 'rgba(29,47,111,.25)'; g.stroke();
        g.fillStyle = P.dirt2;
        var off = bg.ground % 70;
        for (var x = -off; x < LW + 70; x += 70) {
          g.beginPath(); g.ellipse(x + 12, GY + 8, 4, 2.2, 0, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.ellipse(x + 47, GY + 12, 3, 1.8, 0, 0, Math.PI * 2); g.fill();
        }
        g.beginPath(); g.moveTo(0, GY - 1); g.lineTo(LW + 2, GY - 1); g.lineWidth = 2; g.strokeStyle = 'rgba(29,47,111,.3)'; g.stroke();
        g.strokeStyle = P.grass2; g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath();
        var off3 = bg.ground % 26;
        for (var x3 = -off3; x3 < LW + 26; x3 += 26) { g.moveTo(x3, GY); g.lineTo(x3 - 3, GY - 7); g.moveTo(x3 + 4, GY); g.lineTo(x3 + 6, GY - 8); g.moveTo(x3 + 8, GY); g.lineTo(x3 + 11, GY - 5); }
        g.stroke();
        bg.decor.forEach(function (d) { drawDecor(d, P); });

        // puddles first (flat), then items, other obstacles, hedgehog
        if (R) {
          R.obs.forEach(function (o) { if (o.type === 'puddle') drawObstacle(o, season); });
          R.items.forEach(function (it) {
            if (it.type === 'apple') drawApple(g, it.x, GY - it.y + Math.sin(it.ph) * 2.5, 8);
            else drawMushroom(g, it.x, GY - it.y + Math.sin(it.ph) * 3, clock);
          });
          R.obs.forEach(function (o) { if (o.type !== 'puddle') drawObstacle(o, season); });
        }
        // hedgehog
        var h = R ? R.h : 0, hy = GY - h;
        g.beginPath(); g.ellipse(92, GY + 2, 24 * Math.max(0.4, 1 - h / 300), 4, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(29,47,111,.18)'; g.fill();
        var blinkOut = R && R.inv > 0 && Math.floor(R.inv * 10) % 2 === 0;
        g.save();
        if (blinkOut) g.globalAlpha = 0.45;
        var bob = (state === 'run' && R.ground) ? Math.abs(Math.sin(R.legs)) * -1.5 : (state === 'idle' ? Math.sin(clock * 2) * 0.8 : 0);
        g.translate(90, hy + bob);
        if (R && R.roll > 0) { g.translate(4, -20 * HOG_SC); g.rotate(R.roll * Math.PI * 2); g.translate(-4, 20 * HOG_SC); }
        else if (state === 'crash') g.rotate(-0.25);
        g.scale(HOG_SC, HOG_SC);
        drawHog(g, {
          t: clock, legs: R ? R.legs : 0, air: R ? !R.ground : false, apples: R ? R.apples : 0, wear: save.wear,
          shield: R ? R.shield : false, dizzy: state === 'crash' || state === 'over'
        });
        g.restore();

        bg.parts.forEach(function (p) { if (p.season === season) drawPart(p); });

        if (R) {
          R.pops.forEach(function (p) { g.globalAlpha = 1 - p.t / 0.9; text(p.text, p.x, p.y - p.t * 40, 26, p.col, 'center'); g.globalAlpha = 1; });
        }
        // HUD
        if (R && state !== 'idle') {
          text(meters() + ' m', 14, 26, 32, INK);
          drawApple(g, 26, 62, 10);
          text('' + R.apples, 44, 62, 28, '#cf412d');
          if (R.shield) {
            g.save(); g.translate(LW - 32, 80); g.scale(0.7, 0.7); drawMushroom(g, 0, 0, clock); g.restore();
          }
          var sn = SEASONS[R.season % 4].name;
          g.font = '22px ' + FONT; var tw = g.measureText(sn).width + 22;
          rr(g, LW - 12 - tw, 12, tw, 30, 15); g.fillStyle = '#fff'; g.fill(); outline(g, 2);
          g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sn, LW - 12 - tw / 2, 28);
          if (R.banner > 0 && R.season > 0) {
            var bt = R.banner, al = Math.min(1, bt / 0.5, (2.4 - bt) / 0.3);
            g.globalAlpha = clamp(al, 0, 1);
            text(SEASONS[R.season % 4].name + '!', LW / 2, GY * 0.4 - (2.4 - bt) * 6, 54, PURPLE, 'center', 10);
            g.globalAlpha = 1;
          }
          if (R.t < 4.5 && state === 'run') {
            g.globalAlpha = clamp((4.5 - R.t) / 0.6, 0, 1);
            text('Dotknij: skok!', LW / 2, GY * 0.36, 34, INK, 'center');
            text('Jeszcze raz w górze: wyżej!', LW / 2, GY * 0.36 + 36, 24, INK, 'center');
            g.globalAlpha = 1;
          }
        }
        if (state === 'pause') {
          g.fillStyle = 'rgba(29,47,111,.35)'; g.fillRect(0, 0, LW + 2, LH + 2);
          text('Pauza', LW / 2, LH * 0.38, 56, INK, 'center', 10);
          text('Dotknij, żeby biec dalej', LW / 2, LH * 0.38 + 50, 28, INK, 'center');
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
      if (window.NG_DEBUG) window.NG_DEBUG.jezyk = { run: function () { return R; }, state: function () { return state; } };

      return {
        pause: function () { if (state === 'run') state = 'pause'; stopLoop(); draw(); },
        resume: function () { startLoop(); },
        destroy: function () {
          alive = false;
          stopLoop();
          ro.disconnect();
          cv.removeEventListener('pointerdown', onDown);
          window.removeEventListener('keydown', onKey);
          closePanel();
          if (wardrobe) { wardrobe.remove(); wardrobe = null; }
          cv.remove();
        }
      };
    }
  });
})();
