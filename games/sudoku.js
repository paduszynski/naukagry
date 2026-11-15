/* Sudoku: w każdym wierszu, kolumnie i ramce każdy owoc (albo cyfra) jest tylko raz.
 * Łatwe 4×4 z owocami, Średnie 6×6 (owoce albo cyfry), Trudne 9×9 z cyframi.
 * Plansze są losowane: pełne rozwiązanie, potem zdejmujemy pola, dopóki da się je odgadnąć
 * samą logiką „tylko jedno miejsce / tylko jedna cyfra” (to też gwarantuje jedno rozwiązanie;
 * dodatkowo liczymy rozwiązania backtrackingiem).
 * 30 ★ = paczka 3 sudoku; przed każdym dziecko wybiera trudność.
 */
(function () {
  'use strict';

  var FONT = '"Patrick Hand", "Comic Sans MS", cursive';
  var INK = '#1d2f6f', GOLD = '#e3a008', PURPLE = '#7a4fc4', MUTED = '#5a6690';
  var USER = '#3a6fd8', BG = '#e8f4ec';
  var PACK = 3, PRICE = 30;

  var LEVELS = [
    { key: 'easy', n: 4, br: 2, bc: 2, givens: 6, name: 'Łatwe', size: '4×4', note: 'z owocami', color: '#dff3d2' },
    { key: 'mid', n: 6, br: 2, bc: 3, givens: 14, name: 'Średnie', size: '6×6', note: 'owoce albo cyfry', color: '#fff1c9' },
    { key: 'hard', n: 9, br: 3, bc: 3, givens: 30, name: 'Trudne', size: '9×9', note: 'z cyframi', color: '#f6dcef' }
  ];
  function levelOf(key) { for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].key === key) return LEVELS[i]; return LEVELS[0]; }
  var FRUIT_NAMES = ['jabłko', 'banan', 'winogrona', 'gruszka', 'pomarańcza', 'wiśnie'];

  function plural(n, one, few, many) {
    if (n === 1) return one;
    var d = n % 10, t = n % 100;
    return (d >= 2 && d <= 4 && (t < 12 || t > 14)) ? few : many;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function shuffle(a, R) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(R() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- puzzle logic ----------
  // units (rows, columns, boxes) and peers for an n×n grid with br×bc boxes
  var GEO = {};
  function geo(lv) {
    if (GEO[lv.key]) return GEO[lv.key];
    var n = lv.n, units = [], peers = [], i, r, c;
    for (r = 0; r < n; r++) { var u = []; for (c = 0; c < n; c++) u.push(r * n + c); units.push(u); }
    for (c = 0; c < n; c++) { u = []; for (r = 0; r < n; r++) u.push(r * n + c); units.push(u); }
    for (var b0 = 0; b0 < n; b0 += lv.br) for (var b1 = 0; b1 < n; b1 += lv.bc) {
      u = [];
      for (r = b0; r < b0 + lv.br; r++) for (c = b1; c < b1 + lv.bc; c++) u.push(r * n + c);
      units.push(u);
    }
    for (i = 0; i < n * n; i++) {
      var set = {};
      units.forEach(function (un) { if (un.indexOf(i) >= 0) un.forEach(function (j) { if (j !== i) set[j] = 1; }); });
      peers.push(Object.keys(set).map(Number));
    }
    return (GEO[lv.key] = { n: n, units: units, peers: peers, full: (1 << (n + 1)) - 2 });
  }
  function bits(m) { var c = 0; while (m) { m &= m - 1; c++; } return c; }
  function lowVal(m) { var v = 0; while (!(m & (1 << v))) v++; return v; }

  function fillGrid(lv, R) {
    var G = geo(lv), n = lv.n, grid = [], i;
    for (i = 0; i < n * n; i++) grid.push(0);
    function ok(i, v) { var p = G.peers[i]; for (var k = 0; k < p.length; k++) if (grid[p[k]] === v) return false; return true; }
    function rec(i) {
      if (i === n * n) return true;
      var vals = []; for (var v = 1; v <= n; v++) vals.push(v);
      shuffle(vals, R);
      for (var k = 0; k < vals.length; k++) if (ok(i, vals[k])) { grid[i] = vals[k]; if (rec(i + 1)) return true; }
      grid[i] = 0;
      return false;
    }
    rec(0);
    return grid;
  }
  // only naked + hidden singles; returns the solved grid or null when it needs harder tricks
  function singlesSolve(lv, puzzle) {
    var G = geo(lv), n = lv.n, T = n * n, g = puzzle.slice(), cand = [], i, k;
    for (i = 0; i < T; i++) cand.push(g[i] ? 0 : G.full);
    for (i = 0; i < T; i++) if (g[i]) G.peers[i].forEach(function (j) { cand[j] &= ~(1 << g[i]); });
    function place(i, v) { g[i] = v; cand[i] = 0; G.peers[i].forEach(function (j) { cand[j] &= ~(1 << v); }); }
    var progress = true;
    while (progress) {
      progress = false;
      for (i = 0; i < T; i++) {
        if (g[i]) continue;
        if (!cand[i]) return null;
        if (bits(cand[i]) === 1) { place(i, lowVal(cand[i])); progress = true; }
      }
      for (k = 0; k < G.units.length; k++) {
        var un = G.units[k];
        for (var v = 1; v <= n; v++) {
          var where = -1, cnt = 0, have = false;
          for (var m = 0; m < un.length; m++) {
            var c = un[m];
            if (g[c] === v) { have = true; break; }
            if (!g[c] && (cand[c] & (1 << v))) { cnt++; where = c; }
          }
          if (have) continue;
          if (cnt === 0) return null;
          if (cnt === 1) { place(where, v); progress = true; }
        }
      }
    }
    for (i = 0; i < T; i++) if (!g[i]) return null;
    return g;
  }
  function countSolutions(lv, puzzle, limit) {
    var G = geo(lv), n = lv.n, g = puzzle.slice(), count = 0;
    function rec() {
      var best = -1, bestM = 0, bestC = 99;
      for (var i = 0; i < g.length; i++) {
        if (g[i]) continue;
        var m = G.full;
        G.peers[i].forEach(function (j) { if (g[j]) m &= ~(1 << g[j]); });
        var c = bits(m);
        if (c === 0) return;
        if (c < bestC) { bestC = c; best = i; bestM = m; }
      }
      if (best < 0) { count++; return; }
      for (var v = 1; v <= n && count < limit; v++) if (bestM & (1 << v)) { g[best] = v; rec(); g[best] = 0; }
    }
    rec();
    return count;
  }
  function generate(lv, seed) {
    var R = rng(seed), sol = fillGrid(lv, R), T = lv.n * lv.n, puz = sol.slice(), givens = T;
    var order = []; for (var i = 0; i < T; i++) order.push(i);
    shuffle(order, R);
    for (var k = 0; k < order.length && givens > lv.givens; k++) {
      var c = order[k], keep = puz[c];
      puz[c] = 0;
      if (!singlesSolve(lv, puz)) puz[c] = keep; else givens--;
    }
    return { puz: puz, sol: sol };
  }

  // ---------- fruit pictures ----------
  function fruit(g, k, cx, cy, r, alpha) {
    g.save();
    g.translate(cx, cy);
    if (alpha != null) g.globalAlpha = alpha;
    var lw = Math.max(1.2, r * 0.1);
    g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round';
    function circle(x, y, rad, fill) { g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); g.stroke(); }
    function leaf(x, y, ang, len, fill) {
      g.save(); g.translate(x, y); g.rotate(ang);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -len * 0.45, len, 0); g.quadraticCurveTo(len * 0.5, len * 0.45, 0, 0);
      g.fillStyle = fill || '#3fae5f'; g.fill(); g.stroke(); g.restore();
    }
    function shine(x, y, rad) { g.beginPath(); g.ellipse(x, y, rad * 0.5, rad, -0.5, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.55)'; g.fill(); }
    if (k === 0) { // apple
      g.beginPath();
      g.moveTo(0, -r * 0.55);
      g.bezierCurveTo(r * 0.5, -r * 0.95, r * 1.05, -r * 0.45, r * 0.85, r * 0.25);
      g.bezierCurveTo(r * 0.7, r * 0.85, r * 0.25, r * 0.95, 0, r * 0.78);
      g.bezierCurveTo(-r * 0.25, r * 0.95, -r * 0.7, r * 0.85, -r * 0.85, r * 0.25);
      g.bezierCurveTo(-r * 1.05, -r * 0.45, -r * 0.5, -r * 0.95, 0, -r * 0.55);
      g.closePath(); g.fillStyle = '#e2533f'; g.fill(); g.stroke();
      g.beginPath(); g.moveTo(0, -r * 0.55); g.quadraticCurveTo(r * 0.05, -r * 0.85, r * 0.15, -r * 0.98); g.stroke();
      leaf(r * 0.12, -r * 0.78, -0.5, r * 0.55);
      shine(-r * 0.45, -r * 0.1, r * 0.22);
    } else if (k === 1) { // banana
      g.beginPath();
      g.moveTo(-r * 0.85, -r * 0.55);
      g.quadraticCurveTo(-r * 0.6, r * 0.75, r * 0.85, r * 0.35);
      g.quadraticCurveTo(r * 0.95, r * 0.15, r * 0.8, r * 0.1);
      g.quadraticCurveTo(-r * 0.25, r * 0.3, -r * 0.55, -r * 0.6);
      g.closePath(); g.fillStyle = '#f7d23e'; g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-r * 0.85, -r * 0.55); g.lineTo(-r * 0.78, -r * 0.82); g.lineTo(-r * 0.6, -r * 0.8); g.lineTo(-r * 0.55, -r * 0.6);
      g.fillStyle = '#8a5a33'; g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-r * 0.55, -r * 0.2); g.quadraticCurveTo(-r * 0.3, r * 0.35, r * 0.45, r * 0.32); g.strokeStyle = 'rgba(29,47,111,.35)'; g.stroke();
    } else if (k === 2) { // grapes
      var gr = r * 0.27, col = '#8a5cd0';
      [[-0.5, -0.3], [0, -0.3], [0.5, -0.3], [-0.25, 0.12], [0.25, 0.12], [0, 0.54]].forEach(function (p) { circle(p[0] * r, p[1] * r, gr, col); });
      g.beginPath(); g.moveTo(0, -r * 0.55); g.lineTo(r * 0.05, -r * 0.85); g.stroke();
      leaf(r * 0.05, -r * 0.75, -0.3, r * 0.6);
      shine(-r * 0.55, -r * 0.38, r * 0.08);
    } else if (k === 3) { // pear
      g.beginPath();
      g.moveTo(0, -r * 0.75);
      g.bezierCurveTo(r * 0.35, -r * 0.75, r * 0.3, -r * 0.2, r * 0.6, r * 0.2);
      g.bezierCurveTo(r * 0.95, r * 0.7, r * 0.45, r * 0.95, 0, r * 0.92);
      g.bezierCurveTo(-r * 0.45, r * 0.95, -r * 0.95, r * 0.7, -r * 0.6, r * 0.2);
      g.bezierCurveTo(-r * 0.3, -r * 0.2, -r * 0.35, -r * 0.75, 0, -r * 0.75);
      g.closePath(); g.fillStyle = '#9ad046'; g.fill(); g.stroke();
      g.beginPath(); g.moveTo(0, -r * 0.75); g.lineTo(-r * 0.08, -r * 0.98); g.stroke();
      leaf(0, -r * 0.88, -0.2, r * 0.45);
      shine(-r * 0.3, r * 0.35, r * 0.2);
    } else if (k === 4) { // orange
      circle(0, r * 0.08, r * 0.82, '#f08a24');
      g.fillStyle = 'rgba(29,47,111,.35)';
      [[-0.35, -0.1], [0.3, 0.3], [0.1, -0.3], [-0.2, 0.45], [0.45, -0.05]].forEach(function (p) { g.beginPath(); g.arc(p[0] * r, p[1] * r, r * 0.04, 0, Math.PI * 2); g.fill(); });
      leaf(0, -r * 0.72, -0.6, r * 0.55);
      shine(-r * 0.4, -r * 0.2, r * 0.2);
    } else { // cherries
      g.beginPath(); g.moveTo(-r * 0.42, r * 0.3); g.quadraticCurveTo(-r * 0.2, -r * 0.4, r * 0.15, -r * 0.85);
      g.moveTo(r * 0.45, r * 0.4); g.quadraticCurveTo(r * 0.35, -r * 0.3, r * 0.15, -r * 0.85);
      g.strokeStyle = '#2a8a56'; g.lineWidth = lw * 1.4; g.stroke();
      g.strokeStyle = INK; g.lineWidth = lw;
      circle(-r * 0.42, r * 0.48, r * 0.34, '#c2185b');
      circle(r * 0.45, r * 0.56, r * 0.34, '#c2185b');
      leaf(r * 0.15, -r * 0.85, 0.2, r * 0.5);
      shine(-r * 0.52, r * 0.38, r * 0.08); shine(r * 0.35, r * 0.46, r * 0.08);
    }
    g.restore();
  }
  function fruitCanvas(k, size) {
    var cv = document.createElement('canvas'), dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    fruit(g, k, size / 2, size / 2, size * 0.42);
    return cv;
  }

  // ---------- shop tile ----------
  var TILE_PIC = (function () {
    var s = '', ox = 34, oy = 6, cell = 15;
    var grid = ['A2.4', '.4A.', '4.2A', '2A4.'];
    s += '<rect x="' + ox + '" y="' + oy + '" width="60" height="60" rx="4" fill="#fff" stroke="#1d2f6f" stroke-width="2.4"/>';
    s += '<path d="M' + (ox + 30) + ' ' + oy + ' v60 M' + ox + ' ' + (oy + 30) + ' h60" stroke="#1d2f6f" stroke-width="2"/>';
    s += '<path d="M' + (ox + 15) + ' ' + oy + ' v60 M' + (ox + 45) + ' ' + oy + ' v60 M' + ox + ' ' + (oy + 15) + ' h60 M' + ox + ' ' + (oy + 45) + ' h60" stroke="#c9d0e6" stroke-width="1"/>';
    for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) {
      var ch = grid[r][c], x = ox + c * cell + cell / 2, y = oy + r * cell + cell / 2;
      if (ch === 'A') s += '<circle cx="' + x + '" cy="' + (y + 1) + '" r="5" fill="#e2533f" stroke="#1d2f6f" stroke-width="1.2"/><path d="M' + x + ' ' + (y - 4) + ' q3 -3 5 -1 q-2 3 -5 1" fill="#3fae5f" stroke="#1d2f6f" stroke-width=".8"/>';
      else if (ch !== '.') s += '<text x="' + x + '" y="' + (y + 4.5) + '" font-size="12" text-anchor="middle" fill="' + (r + c === 3 ? '#3a6fd8' : '#1d2f6f') + '" font-family="Patrick Hand, Comic Sans MS, cursive">' + ch + '</text>';
    }
    s += '<path d="M106 18 l2.5 5 l5.5 .8 l-4 3.8 l1 5.4 l-5 -2.6 l-5 2.6 l1 -5.4 l-4 -3.8 l5.5 -.8 z" fill="#e3a008"/>';
    [[14, 34], [22, 34], [18, 41], [10, 41], [26, 41], [14, 48], [22, 48], [18, 55]].forEach(function (p) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4.2" fill="#8a5cd0" stroke="#1d2f6f" stroke-width="1.3"/>'; });
    s += '<path d="M18 30 l1 -6" stroke="#1d2f6f" stroke-width="1.6"/><path d="M19 25 q6 -5 10 -1 q-5 4 -10 1 z" fill="#3fae5f" stroke="#1d2f6f" stroke-width="1.2"/>';
    return s;
  })();

  var CSS = [
    '.sd-root{display:flex;flex-direction:column;background:' + BG + ';font-family:' + FONT + ';color:' + INK + ';user-select:none;-webkit-user-select:none}',
    '.sd-hud{flex:none;display:flex;align-items:center;gap:8px;padding:8px 10px 4px}',
    '.sd-title{flex:1;min-width:0;font-size:1.35rem;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.sd-title small{display:block;font-size:1rem;color:' + MUTED + '}',
    '.sd-pill{flex:none;background:#fff;border:2px solid ' + INK + ';border-radius:12px;padding:2px 10px;font-size:1.05rem;color:' + PURPLE + '}',
    '.sd-small{flex:none;border:2px solid ' + INK + ';background:#fff;border-radius:12px;padding:4px 10px;font:inherit;font-size:1.05rem;color:' + INK + ';min-height:38px}',
    '.sd-wrap{flex:1;position:relative;min-height:0}',
    '.sd-wrap canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none}',
    '.sd-pad{flex:none;display:flex;flex-direction:column;gap:8px;padding:4px 8px calc(10px + env(safe-area-inset-bottom,0px));align-items:center}',
    '.sd-vals{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;width:100%;max-width:560px}',
    '.sd-val{font:inherit;font-size:1.7rem;line-height:1;border:3px solid ' + INK + ';border-radius:14px;background:#fff;color:' + INK + ';box-shadow:0 3px 0 ' + INK + ';min-height:50px;padding:0;display:flex;align-items:center;justify-content:center}',
    '.sd-val:active{transform:translateY(2px);box-shadow:0 1px 0 ' + INK + '}',
    '.sd-val.done{opacity:.35}',
    '.sd-val canvas{pointer-events:none}',
    '.sd-tools{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}',
    '.sd-tool{font:inherit;font-size:1.15rem;border:3px solid ' + INK + ';border-radius:14px;background:#fff;color:' + INK + ';padding:4px 10px;min-height:46px;min-width:46px;box-shadow:0 3px 0 ' + INK + '}',
    '.sd-tool:active{transform:translateY(2px);box-shadow:0 1px 0 ' + INK + '}',
    '.sd-tool.on{background:' + GOLD + ';color:#2a1d00}',
    '.sd-tool[disabled]{opacity:.45}',
    '.sd-tool[data-a="undo"]{font-size:1.6rem;line-height:1;font-family:system-ui,sans-serif}',
    '.sd-pick{display:flex;flex-direction:column;gap:10px}',
    '.sd-lvl{display:flex;align-items:center;gap:12px;text-align:left;font:inherit;color:' + INK + ';border:3px solid ' + INK + ';border-radius:18px;padding:8px 12px;box-shadow:0 4px 0 ' + INK + ';min-height:64px}',
    '.sd-lvl:active{transform:translateY(3px);box-shadow:0 1px 0 ' + INK + '}',
    '.sd-lvl b{font-weight:400;font-size:1.45rem;line-height:1}',
    '.sd-lvl small{display:block;font-size:1rem;color:' + MUTED + '}',
    '.sd-lvl canvas{flex:none}',
    '.sd-switch{display:flex;align-items:center;justify-content:center;gap:8px;font-size:1.1rem}',
    '.sd-switch button{font:inherit;font-size:1.1rem;border:2px solid ' + INK + ';background:#fff;color:' + INK + ';border-radius:12px;padding:3px 12px;min-height:40px}',
    '.sd-switch button.on{background:' + GOLD + ';color:#2a1d00}',
    '@media (max-width:370px){.sd-tool{padding:4px 8px;font-size:1.05rem}}'
  ].join('\n');

  NG.register('sudoku', {
    _test: { generate: generate, singlesSolve: singlesSolve, countSolutions: countSolutions, LEVELS: LEVELS, geo: geo },
    meta: { name: 'Sudoku', price: '30 ★ za 3 sudoku', bg: '#e8f4ec', pic: TILE_PIC, music: 'calm' },
    medals: [
      { id: 'easy', stat: 'easy', at: 3, tier: 1, text: '3 sudoku 4×4' },
      { id: 'mid', stat: 'mid', at: 3, tier: 2, text: '3 sudoku 6×6' },
      { id: 'hard', stat: 'hard', at: 3, tier: 3, text: '3 sudoku 9×9' }
    ],
    quests: [
      { id: 'solve', stat: 'solved', n: [2, 3], text: 'Rozwiąż {n} sudoku' },
      { id: 'fill', stat: 'filled', n: [20, 30], text: 'Uzupełnij {n} pól w Sudoku' }
    ],
    stickers: [
      { id: 'first', emoji: '🍎', name: 'Pierwsze sudoku' },
      { id: 'six', emoji: '🍇', name: 'Pierwsze sudoku 6×6' },
      { id: 'nine', emoji: '🏆', name: 'Pierwsze sudoku 9×9' },
      { id: 'nocheck', emoji: '🧠', name: 'Duże sudoku bez sprawdzania' }
    ],

    mount: function (el, ctx) {
      var save = ctx.load({ credits: 0, total: 0, cur: null, pics6: true, by: {} });
      if (!save.by || typeof save.by !== 'object') save.by = {};
      var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      var alive = true, raf = 0, paused = false, timers = [], overlays = [], panel = null;

      var css = document.createElement('style'); css.textContent = CSS;
      var root = document.createElement('div'); root.className = 'sd-root';
      root.innerHTML =
        '<div class="sd-hud"><div class="sd-title"></div><span class="sd-pill"></span><button type="button" class="sd-small" data-a="pics"></button><button type="button" class="sd-small" data-a="other">Inne</button></div>' +
        '<div class="sd-wrap"><canvas></canvas></div>' +
        '<div class="sd-pad"><div class="sd-vals"></div><div class="sd-tools">' +
          '<button type="button" class="sd-tool" data-a="pencil">✏️ Ołówek</button>' +
          '<button type="button" class="sd-tool" data-a="undo" aria-label="Cofnij">↶</button>' +
          '<button type="button" class="sd-tool" data-a="erase">Gumka</button>' +
          '<button type="button" class="sd-tool" data-a="check">Sprawdź</button>' +
        '</div></div>';
      el.appendChild(css); el.appendChild(root);
      var hudTitle = root.querySelector('.sd-title'), pill = root.querySelector('.sd-pill');
      var canvas = root.querySelector('canvas'), wrap = root.querySelector('.sd-wrap');
      var valsBox = root.querySelector('.sd-vals'), toolsBox = root.querySelector('.sd-tools');
      var pencilBtn = root.querySelector('[data-a="pencil"]'), undoBtn = root.querySelector('[data-a="undo"]');
      var eraseBtn = root.querySelector('[data-a="erase"]'), checkBtn = root.querySelector('[data-a="check"]');
      var picsBtn = root.querySelector('[data-a="pics"]'), otherBtn = root.querySelector('[data-a="other"]');
      var g = canvas.getContext('2d');
      var W = 1, H = 1, dpr = 1, L = null;

      var lv = null, puz = null, sol = null, vals = [], marks = [], undo = [], sel = -1, hiVal = 0;
      var pencil = false, checks = 0, state = 'menu';
      var flash = [], flashT0 = -9, winT0 = 0, tNow = 0, lastTs = 0, lastFullWrong = '';

      function persist() { ctx.save(save); }
      function later(fn, ms) { var id = setTimeout(function () { timers = timers.filter(function (x) { return x !== id; }); if (alive) fn(); }, ms); timers.push(id); return id; }
      function usePics() { return lv && (lv.n === 4 || (lv.n === 6 && save.pics6)); }

      // ---------- layout ----------
      function layout() {
        if (!lv) { L = null; return; }
        var pad = 10, size = Math.floor(Math.min(W - 2 * pad, H - 2 * pad, 620));
        var s = Math.floor(size / lv.n);
        size = s * lv.n;
        L = { s: s, n: lv.n, gx: Math.round((W - size) / 2), gy: Math.round((H - size) / 2), size: size };
      }
      function resize() {
        var r = wrap.getBoundingClientRect();
        W = Math.max(1, r.width); H = Math.max(1, r.height);
        dpr = Math.min(3, window.devicePixelRatio || 1);
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        layout(); buildPad(); draw();
      }
      var ro = new ResizeObserver(resize);
      ro.observe(wrap);

      // ---------- pad ----------
      var padW = -1, padKey = '';
      function buildPad() {
        if (!lv) { valsBox.innerHTML = ''; return; }
        var w = Math.min(root.clientWidth || W, 560) - 16;
        var key = lv.key + ':' + usePics() + ':' + Math.round(w);
        if (key === padKey) { syncPad(); return; }
        padKey = key; padW = w;
        valsBox.innerHTML = '';
        var n = lv.n, perRow = n;
        if (w / n < 42) perRow = Math.ceil(n / 2);
        var bw = Math.floor(Math.min(76, (w - (perRow - 1) * 6) / perRow));
        for (var v = 1; v <= n; v++) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'sd-val'; b.dataset.v = v;
          b.style.width = bw + 'px';
          if (usePics()) { b.appendChild(fruitCanvas(v - 1, Math.min(44, bw - 10))); b.setAttribute('aria-label', FRUIT_NAMES[v - 1]); }
          else b.textContent = v;
          b.addEventListener('click', onVal);
          valsBox.appendChild(b);
        }
        syncPad();
      }
      function syncPad() {
        if (!lv) return;
        var cnt = [];
        for (var v = 0; v <= lv.n; v++) cnt.push(0);
        vals.forEach(function (x) { if (x) cnt[x]++; });
        [].forEach.call(valsBox.children, function (b) {
          var vv = +b.dataset.v;
          b.classList.toggle('done', cnt[vv] >= lv.n);
          b.style.outline = hiVal === vv ? '3px solid ' + GOLD : '';
        });
        pencilBtn.hidden = lv.n === 4;
        pencilBtn.classList.toggle('on', pencil);
        pencilBtn.setAttribute('aria-pressed', pencil);
        undoBtn.disabled = state !== 'play' || !undo.length;
        eraseBtn.disabled = checkBtn.disabled = state !== 'play';
      }

      // ---------- drawing ----------
      function rr(x, y, w, h, r) {
        g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
      }
      function boxOf(i) { var n = lv.n, r = i / n | 0, c = i % n; return Math.floor(r / lv.br) * (n / lv.bc) + Math.floor(c / lv.bc); }
      function draw() {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, W, H);
        if (!lv || !L) return;
        var n = lv.n, s = L.s, gx = L.gx, gy = L.gy, i, r, c;
        var pics = usePics(), won = state === 'won', wt = tNow - winT0;
        var sr = sel >= 0 ? sel / n | 0 : -1, sc = sel >= 0 ? sel % n : -1, sb = sel >= 0 ? boxOf(sel) : -1;
        var hv = hiVal || (sel >= 0 ? vals[sel] : 0);
        // board shadow + paper
        rr(gx - 3, gy + 3, L.size + 6, L.size + 6, 12); g.fillStyle = 'rgba(29,47,111,.18)'; g.fill();
        rr(gx - 3, gy - 3, L.size + 6, L.size + 6, 12); g.fillStyle = '#fff'; g.fill();
        for (i = 0; i < n * n; i++) {
          r = i / n | 0; c = i % n;
          var x = gx + c * s, y = gy + r * s, bg = null;
          if (puz[i]) bg = '#eef1f8';
          if (sel >= 0 && (r === sr || c === sc || boxOf(i) === sb)) bg = puz[i] ? '#e2e9fb' : '#edf3ff';
          if (hv && vals[i] === hv) bg = '#ffe9a8';
          if (i === sel) bg = '#ffd76a';
          if (won) {
            var k = clamp((wt - (reduced ? 0 : (r + c) * 0.05)) / 0.35, 0, 1);
            var a = Math.sin(k * Math.PI);
            if (a > 0.01) bg = 'rgba(255,215,106,' + (0.35 + 0.65 * a) + ')';
          }
          if (bg) { g.fillStyle = bg; g.fillRect(x, y, s, s); }
        }
        // gentle error flash
        var fl = tNow - flashT0;
        if (flash.length && fl < 2.6 && !won) {
          var al = fl < 2 ? 1 : 1 - (fl - 2) / 0.6;
          flash.forEach(function (idx) {
            var x1 = gx + (idx % n) * s, y1 = gy + (idx / n | 0) * s;
            g.globalAlpha = al * 0.5; g.fillStyle = '#ff8fa3'; g.fillRect(x1 + 1, y1 + 1, s - 2, s - 2);
            g.globalAlpha = al; g.lineWidth = 2.5; g.strokeStyle = '#d6336c'; rr(x1 + 3, y1 + 3, s - 6, s - 6, 6); g.stroke();
          });
          g.globalAlpha = 1;
        }
        // values
        g.textAlign = 'center'; g.textBaseline = 'middle';
        for (i = 0; i < n * n; i++) {
          r = i / n | 0; c = i % n;
          var cx = gx + c * s + s / 2, cy = gy + r * s + s / 2, v = vals[i];
          var bump = 1;
          if (won) { var kk = clamp((wt - (reduced ? 0 : (r + c) * 0.05)) / 0.35, 0, 1); bump = 1 + 0.18 * Math.sin(kk * Math.PI); }
          if (v) {
            if (pics) fruit(g, v - 1, cx, cy, s * 0.36 * bump);
            else {
              g.font = Math.round(s * 0.62 * bump) + 'px ' + FONT;
              g.fillStyle = puz[i] ? INK : USER;
              g.fillText(String(v), cx, cy + s * 0.03);
            }
          } else if (marks[i]) {
            var cols = 3, rowsM = n === 9 ? 3 : 2, ms = s * 0.92 / 3;
            var mox = gx + c * s + (s - cols * ms) / 2, moy = gy + r * s + (s - rowsM * ms) / 2;
            for (var m = 1; m <= n; m++) {
              if (!(marks[i] & (1 << m))) continue;
              var mi = m - 1, mx = mox + (mi % cols + 0.5) * ms, my = moy + ((mi / cols | 0) + 0.5) * ms;
              if (pics) fruit(g, mi, mx, my, ms * 0.36, 0.85);
              else {
                g.font = Math.round(ms * 0.95) + 'px ' + FONT;
                g.fillStyle = m === hv ? '#b07800' : MUTED;
                g.fillText(String(m), mx, my + 1);
              }
            }
          }
        }
        // lines
        g.lineWidth = 1; g.strokeStyle = '#c9d0e6'; g.beginPath();
        for (i = 1; i < n; i++) {
          if (i % lv.bc) { g.moveTo(gx + i * s + 0.5, gy); g.lineTo(gx + i * s + 0.5, gy + L.size); }
          if (i % lv.br) { g.moveTo(gx, gy + i * s + 0.5); g.lineTo(gx + L.size, gy + i * s + 0.5); }
        }
        g.stroke();
        g.lineWidth = 2.5; g.strokeStyle = INK; g.beginPath();
        for (i = lv.bc; i < n; i += lv.bc) { g.moveTo(gx + i * s, gy); g.lineTo(gx + i * s, gy + L.size); }
        for (i = lv.br; i < n; i += lv.br) { g.moveTo(gx, gy + i * s); g.lineTo(gx + L.size, gy + i * s); }
        g.stroke();
        g.lineWidth = 3.5; rr(gx - 1.5, gy - 1.5, L.size + 3, L.size + 3, 6); g.stroke();
        // hint for the first game
        if (state === 'play' && save.total === 0 && countEmpty() === countEmptyStart()) {
          var hint = pics ? 'Stuknij pole, potem owoc.' : 'Stuknij pole, potem cyfrę.';
          g.font = Math.round(clamp(W / 20, 17, 23)) + 'px ' + FONT; g.fillStyle = MUTED;
          var hy = gy + L.size + 20;
          if (hy < H - 4) g.fillText(hint, W / 2, hy);
          else if (gy - 18 > 4) g.fillText(hint, W / 2, gy - 16);
        }
      }
      function countEmpty() { var k = 0; for (var i = 0; i < vals.length; i++) if (!vals[i]) k++; return k; }
      function countEmptyStart() { var k = 0; for (var i = 0; i < puz.length; i++) if (!puz[i]) k++; return k; }

      function animating() { return state === 'won' ? tNow - winT0 < 2.2 : (flash.length > 0 && tNow - flashT0 < 2.7); }
      function kick() { if (!raf && !paused && alive) { lastTs = 0; raf = requestAnimationFrame(loop); } }
      function loop(ts) {
        raf = 0;
        if (!alive || paused) return;
        var t = ts / 1000, dt = lastTs ? Math.min(0.05, t - lastTs) : 0;
        lastTs = t; tNow += dt;
        draw();
        if (animating()) raf = requestAnimationFrame(loop);
      }

      // ---------- HUD ----------
      function syncHud() {
        hudTitle.innerHTML = '';
        if (lv) {
          hudTitle.appendChild(document.createTextNode('Sudoku ' + lv.size));
          var sm = document.createElement('small'); sm.textContent = lv.name; hudTitle.appendChild(sm);
        } else hudTitle.textContent = 'Sudoku';
        pill.textContent = 'Paczka: ' + save.credits + '/' + PACK;
        pill.style.visibility = save.credits > 0 ? 'visible' : 'hidden';
        picsBtn.hidden = !(lv && lv.n === 6 && state === 'play');
        picsBtn.textContent = save.pics6 ? '123' : '🍎';
        picsBtn.setAttribute('aria-label', save.pics6 ? 'Pokaż cyfry' : 'Pokaż owoce');
        otherBtn.style.visibility = state === 'play' ? 'visible' : 'hidden';
        toolsBox.style.visibility = lv ? 'visible' : 'hidden';
        syncPad();
      }

      // ---------- game flow ----------
      function startGame(level, restore) {
        lv = level; state = 'play'; undo = []; flash = []; sel = -1; hiVal = 0; pencil = false; lastFullWrong = '';
        if (restore) {
          puz = restore.puz; sol = restore.sol; vals = restore.vals.slice(); marks = restore.marks.slice(); checks = restore.checks || 0;
        } else {
          var gen = generate(lv, (Math.random() * 4294967296) >>> 0);
          puz = gen.puz; sol = gen.sol; vals = puz.slice(); marks = puz.map(function () { return 0; }); checks = 0;
        }
        saveCur();
        padKey = ''; layout(); syncHud(); buildPad(); draw();
      }
      function saveCur() {
        if (!lv || state !== 'play') return;
        save.cur = { lv: lv.key, puz: puz, sol: sol, vals: vals.slice(), marks: marks.slice(), checks: checks };
        persist();
      }
      function snapshot() { undo.push({ vals: vals.slice(), marks: marks.slice() }); if (undo.length > 120) undo.shift(); }
      function setValue(i, v) {
        if (puz[i] || state !== 'play') return;
        if (pencil && v && lv.n > 4) {
          if (vals[i]) return;
          snapshot();
          marks[i] ^= (1 << v);
          ctx.sfx('tick');
        } else {
          if (vals[i] === v && v) v = 0;   // tapping the same value again clears it
          if (vals[i] === v && !marks[i]) return;
          snapshot();
          vals[i] = v;
          if (!v) { marks[i] = 0; ctx.sfx('pop'); }
          else {
            marks[i] = 0;
            geo(lv).peers[i].forEach(function (j) { marks[j] &= ~(1 << v); });
            ctx.sfx('place');
          }
        }
        flash = [];
        saveCur(); syncPad(); draw();
        afterMove();
      }
      function afterMove() {
        if (countEmpty()) return;
        var ok = true;
        for (var i = 0; i < vals.length; i++) if (vals[i] !== sol[i]) { ok = false; break; }
        if (ok) { onWin(); return; }
        var key = vals.join('');
        if (key !== lastFullWrong) {
          lastFullWrong = key;
          ctx.toast('Prawie! Coś się nie zgadza. Stuknij „Sprawdź”.');
        }
      }
      function onWin() {
        state = 'won'; winT0 = tNow; sel = -1; hiVal = 0; flash = []; pencil = false;
        ctx.sfx('win');
        var filled = countEmptyStart();
        save.total = (save.total || 0) + 1;
        save.by[lv.key] = (save.by[lv.key] || 0) + 1;
        save.credits = Math.max(0, save.credits - 1);
        save.cur = null;
        persist();
        ctx.stat('solved', 1);
        ctx.stat('filled', filled);
        ctx.stat(lv.key, 1);
        ctx.sticker('first');
        if (lv.n === 6) ctx.sticker('six');
        if (lv.n === 9) ctx.sticker('nine');
        if (lv.n >= 6 && checks === 0) ctx.sticker('nocheck');
        syncHud(); kick();
        later(showWinCard, reduced ? 500 : 1500);
      }

      // ---------- overlays ----------
      function overlay(build) {
        var p = document.createElement('div'); p.className = 'ng-panel';
        var card = document.createElement('div'); card.className = 'ng-card'; p.appendChild(card);
        var o = { el: p, card: card, close: function () { p.remove(); overlays = overlays.filter(function (x) { return x !== o; }); } };
        build(card, o);
        el.appendChild(p); overlays.push(o);
        return o;
      }
      function btn(label, cls, fn) { var b = document.createElement('button'); b.type = 'button'; b.className = cls || 'ng-btn'; b.textContent = label; b.onclick = fn; return b; }
      function para(text, muted) { var p = document.createElement('p'); p.textContent = text; if (muted) p.className = 'muted'; return p; }

      function showWinCard() {
        overlay(function (card, o) {
          var big = document.createElement('div'); big.className = 'big'; big.textContent = '★ ★ ★'; card.appendChild(big);
          var h = document.createElement('h2'); h.textContent = 'Brawo!'; card.appendChild(h);
          card.appendChild(para('Sudoku ' + lv.size + ' rozwiązane!'));
          var done = save.by[lv.key] || 0;
          card.appendChild(para('Rozwiązane ' + lv.size + ': ' + done + ' · razem: ' + save.total, true));
          card.appendChild(btn(save.credits > 0 ? 'Dalej' : 'Gotowe', 'ng-btn', function () { o.close(); ctx.sfx('click'); next(); }));
        });
      }
      function next() { if (save.credits > 0) showPicker(); else showBuy(true); }
      function clearBoard() { lv = null; state = 'menu'; sel = -1; layout(); syncHud(); buildPad(); draw(); }
      function lvlIcon(L0) {
        var size = 44, cv = document.createElement('canvas'), d = Math.min(3, window.devicePixelRatio || 1);
        cv.width = size * d; cv.height = size * d; cv.style.width = size + 'px'; cv.style.height = size + 'px';
        var c2 = cv.getContext('2d'); c2.setTransform(d, 0, 0, d, 0, 0);
        c2.fillStyle = '#fff'; c2.fillRect(1, 1, size - 2, size - 2);
        var n = L0.n, s = (size - 2) / n;
        c2.strokeStyle = '#c9d0e6'; c2.lineWidth = 0.8; c2.beginPath();
        for (var i = 1; i < n; i++) { c2.moveTo(1 + i * s, 1); c2.lineTo(1 + i * s, size - 1); c2.moveTo(1, 1 + i * s); c2.lineTo(size - 1, 1 + i * s); }
        c2.stroke();
        c2.strokeStyle = INK; c2.lineWidth = 1.6; c2.beginPath();
        for (i = L0.bc; i < n; i += L0.bc) { c2.moveTo(1 + i * s, 1); c2.lineTo(1 + i * s, size - 1); }
        for (i = L0.br; i < n; i += L0.br) { c2.moveTo(1, 1 + i * s); c2.lineTo(size - 1, 1 + i * s); }
        c2.stroke(); c2.lineWidth = 2; c2.strokeRect(1, 1, size - 2, size - 2);
        if (n === 4) { fruit(c2, 0, 1 + s / 2, 1 + s / 2, s * 0.38); fruit(c2, 1, 1 + s * 2.5, 1 + s * 1.5, s * 0.38); fruit(c2, 2, 1 + s * 1.5, 1 + s * 3.5, s * 0.38); fruit(c2, 3, 1 + s * 3.5, 1 + s * 2.5, s * 0.38); }
        else {
          c2.fillStyle = INK; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.font = Math.round(s * 0.85) + 'px ' + FONT;
          [[0, 0, 1], [2, 1, 3], [1, 3, 5], [4, 2, 2], [3, 4, 6], [5, 5, 4]].forEach(function (p) { if (p[0] < n && p[1] < n) c2.fillText(String(p[2]), 1 + (p[0] + 0.5) * s, 1 + (p[1] + 0.5) * s + 1); });
        }
        return cv;
      }
      function showPicker() {
        clearBoard();
        overlay(function (card, o) {
          var h = document.createElement('h2'); h.textContent = 'Wybierz sudoku'; card.appendChild(h);
          card.appendChild(para(plural(save.credits, 'Został', 'Zostały', 'Zostało') + ' ' + save.credits + ' z ' + PACK + ' w paczce.', true));
          var box = document.createElement('div'); box.className = 'sd-pick';
          LEVELS.forEach(function (L0) {
            var b = document.createElement('button'); b.type = 'button'; b.className = 'sd-lvl'; b.style.background = L0.color;
            b.appendChild(lvlIcon(L0));
            var t = document.createElement('span'); t.innerHTML = '<b></b><small></small>';
            t.querySelector('b').textContent = L0.name + ' ' + L0.size;
            t.querySelector('small').textContent = L0.note + (save.by[L0.key] ? ' · rozwiązane: ' + save.by[L0.key] : '');
            b.appendChild(t);
            b.onclick = function () { o.close(); ctx.sfx('pop'); startGame(L0); };
            box.appendChild(b);
          });
          card.appendChild(box);
          var row = document.createElement('div'); row.className = 'ng-row';
          row.appendChild(btn('Wróć do gier', 'ng-btn sec', function () { ctx.exit(); }));
          card.appendChild(row);
        });
      }
      function showBuy(after) {
        clearBoard();
        panel = ctx.panel({
          title: after ? 'Paczka gotowa!' : 'Sudoku',
          big: after ? '★ ' + save.total : undefined,
          medals: true,
          lines: after
            ? ['Wszystkie 3 sudoku rozwiązane.', { text: 'Razem rozwiązane: ' + save.total, muted: true }]
            : ['W każdym wierszu, kolumnie i ramce każdy owoc albo cyfra jest tylko raz.', PACK + ' sudoku za ' + PRICE + ' ★'].concat(save.total ? [{ text: 'Rozwiązane: ' + save.total, muted: true }] : []),
          price: PRICE, note: PACK + ' sudoku',
          button: after ? 'Nowa paczka' : 'Zagraj',
          onPlay: function () { panel = null; save.credits = PACK; persist(); ctx.sfx('buy'); showPicker(); },
          secondary: [{ label: 'Wróć do gier', onClick: function () { ctx.exit(); } }]
        });
      }
      function askOther() {
        if (state !== 'play') return;
        ctx.sfx('open');
        overlay(function (card, o) {
          var h = document.createElement('h2'); h.textContent = 'Inne sudoku?'; card.appendChild(h);
          card.appendChild(para('To sudoku zniknie. Paczka się nie zmniejszy.'));
          var row = document.createElement('div'); row.className = 'ng-row';
          row.appendChild(btn('Tak, wybierz', 'ng-btn', function () { o.close(); save.cur = null; persist(); showPicker(); }));
          row.appendChild(btn('Graj dalej', 'ng-btn sec', function () { o.close(); ctx.sfx('close'); }));
          card.appendChild(row);
        });
      }

      // ---------- input ----------
      function onDown(ev) {
        if (state !== 'play' || !L) return;
        var r = canvas.getBoundingClientRect(), x = ev.clientX - r.left - L.gx, y = ev.clientY - r.top - L.gy;
        var c = Math.floor(x / L.s), rw = Math.floor(y / L.s);
        if (c < 0 || rw < 0 || c >= lv.n || rw >= lv.n) { if (sel >= 0 || hiVal) { sel = -1; hiVal = 0; syncPad(); draw(); } return; }
        ev.preventDefault();
        var i = rw * lv.n + c;
        sel = i;
        hiVal = 0;
        ctx.sfx('tap');
        syncPad(); draw();
      }
      function onVal(ev) {
        var v = +ev.currentTarget.dataset.v;
        if (state !== 'play') return;
        if (sel >= 0 && !puz[sel]) { setValue(sel, v); return; }
        // nothing editable selected: light up every cell with this value
        sel = -1;
        hiVal = hiVal === v ? 0 : v;
        ctx.sfx('tap');
        syncPad(); draw();
      }
      function doErase() {
        if (state !== 'play') return;
        if (sel < 0 || puz[sel]) { ctx.toast('Stuknij swoje pole, żeby je wyczyścić.'); return; }
        if (!vals[sel] && !marks[sel]) return;
        snapshot(); vals[sel] = 0; marks[sel] = 0; ctx.sfx('pop'); flash = [];
        saveCur(); syncPad(); draw();
      }
      function doUndo() {
        if (state !== 'play' || !undo.length) return;
        var u = undo.pop(); vals = u.vals; marks = u.marks; flash = [];
        ctx.sfx('swap'); saveCur(); syncPad(); draw();
      }
      function doCheck() {
        if (state !== 'play') return;
        checks++;
        var bad = [];
        for (var i = 0; i < vals.length; i++) if (vals[i] && !puz[i] && vals[i] !== sol[i]) bad.push(i);
        saveCur();
        if (!bad.length) {
          flash = [];
          ctx.sfx('star');
          ctx.toast(countEmpty() ? 'Na razie wszystko dobrze!' : 'Wszystko dobrze!');
          draw(); return;
        }
        flash = bad; flashT0 = tNow;
        ctx.sfx('error');
        ctx.toast(bad.length === 1 ? 'Jedno pole trzeba poprawić.' : bad.length + ' ' + plural(bad.length, 'pole', 'pola', 'pól') + ' trzeba poprawić.');
        kick();
      }
      function onPencil() { pencil = !pencil; ctx.sfx('click'); syncPad(); }
      function onPics() { save.pics6 = !save.pics6; persist(); ctx.sfx('click'); padKey = ''; buildPad(); syncHud(); draw(); }
      function onKey(ev) {
        if (state !== 'play') return;
        var k = ev.key;
        if ((ev.ctrlKey || ev.metaKey) && k === 'z') { ev.preventDefault(); doUndo(); return; }
        if (/^[1-9]$/.test(k) && +k <= lv.n) { if (sel >= 0) setValue(sel, +k); return; }
        if (k === 'Backspace' || k === 'Delete' || k === '0') { doErase(); return; }
        if (k === 'p' || k === 'P') { if (lv.n > 4) onPencil(); return; }
        var d = { ArrowUp: -lv.n, ArrowDown: lv.n, ArrowLeft: -1, ArrowRight: 1 }[k];
        if (d) {
          ev.preventDefault();
          if (sel < 0) sel = 0;
          else { var nx = sel + d; if (nx >= 0 && nx < lv.n * lv.n && (Math.abs(d) !== 1 || (nx / lv.n | 0) === (sel / lv.n | 0))) sel = nx; }
          draw();
        }
      }

      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      pencilBtn.addEventListener('click', onPencil);
      undoBtn.addEventListener('click', doUndo);
      eraseBtn.addEventListener('click', doErase);
      checkBtn.addEventListener('click', doCheck);
      picsBtn.addEventListener('click', onPics);
      otherBtn.addEventListener('click', askOther);
      window.addEventListener('keydown', onKey);

      // ---------- start ----------
      resize();
      var cur = save.cur;
      if (cur && cur.lv && cur.puz && cur.sol && cur.vals && cur.marks && cur.puz.length === levelOf(cur.lv).n * levelOf(cur.lv).n) startGame(levelOf(cur.lv), cur);
      else if (save.credits > 0) showPicker();
      else showBuy(false);
      syncHud();

      return {
        destroy: function () {
          alive = false;
          cancelAnimationFrame(raf); raf = 0;
          timers.forEach(clearTimeout); timers = [];
          ro.disconnect();
          window.removeEventListener('keydown', onKey);
          if (panel) { try { panel.close(); } catch (e) {} panel = null; }
          overlays.slice().forEach(function (o) { o.close(); });
          root.remove(); css.remove();
        },
        pause: function () { paused = true; cancelAnimationFrame(raf); raf = 0; },
        resume: function () { if (!alive) return; paused = false; kick(); draw(); }
      };
    }
  });
})();
