/* Bańki: bubble shooter on a meadow. A frog on a lily pad holds the next bubble; drag to aim
 * (dotted guide with wall bounces and a ghost where it lands), release to shoot.
 * 3+ touching bubbles of one colour pop, bubbles left without a hold on the branch fall.
 * Every bubble has a colour AND a symbol (ladybird, daisy, drop, leaf, star, heart) for colour-blind kids.
 * 10 hand-made levels, then generated ones; colours grow slowly; the branch drops every N shots.
 * 40 ★ per level attempt; a lost level with more than half of the board cleared gives 20 ★ back.
 * Board logic (unit coordinates, bubble radius = 1) has no DOM and is exposed as NG.impl.banki.core.
 */
(function () {
  'use strict';
  var INK = '#1d2f6f', GOLD = '#e3a008', LVL = '#7a4fc4', RED = '#cf412d', MUTED = '#5a6690';
  var FONT = '"Patrick Hand","Comic Sans MS",cursive';
  var PRICE = 40, REFUND = 20;

  // ---------- board geometry (units: bubble radius = 1) ----------
  var COLS = 8;                       // even rows have 8 bubbles, odd rows 7 (shifted half a bubble right)
  var DEADROWS = 11;                  // a bubble on row 11 (counting the dropped branch) touches the line
  var MAXROWS = DEADROWS + 1;
  var ROWH = Math.sqrt(3);
  var BW = COLS * 2;                  // board width
  var LINE_Y = 1 + (DEADROWS - 0.5) * ROWH;
  var LX = COLS, LY = LINE_Y + 2.4;   // launcher (bubble in the frog's hands)
  var BH = LY + 4.3;                  // board + frog + pond height
  var MIN_ANG = 9 * Math.PI / 180, MAX_ANG = Math.PI - MIN_ANG;
  var HIT2 = 1.72 * 1.72;             // a little forgiving: bubbles can squeeze past a touch

  var COLORS = [
    { name: 'biedronka', fill: '#e2453a', hi: '#ff9d8f', dark: '#a8261b' },
    { name: 'stokrotka', fill: '#f4c21f', hi: '#fff3a6', dark: '#b88600' },
    { name: 'kropla', fill: '#3f8fe0', hi: '#b5dcff', dark: '#1f5ea8' },
    { name: 'listek', fill: '#47b347', hi: '#bff0a8', dark: '#227227' },
    { name: 'gwiazdka', fill: '#9a62d8', hi: '#dcc6f8', dark: '#5f3398' },
    { name: 'serduszko', fill: '#f5892a', hi: '#ffd6a6', dark: '#b4520a' }
  ];
  var LETTERS = 'rybgpo';

  function rowLen(r) { return r & 1 ? COLS - 1 : COLS; }
  function cellX(r, c) { return 1 + 2 * c + (r & 1); }
  function cellY(r, d) { return 1 + (r + d) * ROWH; }
  function emptyGrid() { var g = []; for (var r = 0; r < MAXROWS; r++) { var row = []; for (var c = 0; c < rowLen(r); c++) row.push(-1); g.push(row); } return g; }
  function cloneGrid(g) { return g.map(function (row) { return row.slice(); }); }
  function neighbors(r, c) {
    var o = r & 1, out = [], list = [[r, c - 1], [r, c + 1], [r - 1, c - 1 + o], [r - 1, c + o], [r + 1, c - 1 + o], [r + 1, c + o]];
    for (var i = 0; i < 6; i++) { var a = list[i]; if (a[0] >= 0 && a[0] < MAXROWS && a[1] >= 0 && a[1] < rowLen(a[0])) out.push(a); }
    return out;
  }
  function eachCell(g, fn) { for (var r = 0; r < g.length; r++) for (var c = 0; c < g[r].length; c++) if (g[r][c] >= 0) fn(r, c, g[r][c]); }
  function count(g) { var n = 0; eachCell(g, function () { n++; }); return n; }
  function colorsLeft(g) { var seen = {}, out = []; eachCell(g, function (r, c, v) { if (!seen[v]) { seen[v] = 1; out.push(v); } }); return out.sort(); }
  function isDead(g, drops) { var dead = false; eachCell(g, function (r) { if (r + drops >= DEADROWS) dead = true; }); return dead; }
  function gridToRows(g) { return g.map(function (row) { return row.map(function (v) { return v < 0 ? '.' : LETTERS[v]; }).join(''); }); }
  function rowsToGrid(rows) {
    var g = emptyGrid();
    rows.forEach(function (s, r) { if (r >= MAXROWS) return; for (var c = 0; c < rowLen(r) && c < s.length; c++) { var k = LETTERS.indexOf(s[c]); if (k >= 0) g[r][c] = k; } });
    return g;
  }

  // Path of a shot at angle `ang` (radians, PI/2 = straight up): polyline + the cell it sticks to.
  function trace(g, drops, ang) {
    var dx = Math.cos(ang), dy = -Math.sin(ang), x = LX, y = LY, st = 0.12, pts = [[x, y]], bounces = 0;
    var occ = [];
    eachCell(g, function (r, c) { occ.push(cellX(r, c), cellY(r, drops)); });
    var top = drops * ROWH + 1, minX = 1, maxX = BW - 1, hit = false;
    for (var i = 0; i < 4000 && !hit; i++) {
      x += dx * st; y += dy * st;
      if (x < minX) { var py = y - dy * st * ((minX - x) / (Math.abs(dx * st) || 1)); x = 2 * minX - x; dx = -dx; pts.push([minX, py]); bounces++; }
      else if (x > maxX) { var py2 = y - dy * st * ((x - maxX) / (Math.abs(dx * st) || 1)); x = 2 * maxX - x; dx = -dx; pts.push([maxX, py2]); bounces++; }
      if (y <= top) { y = top; hit = true; break; }
      for (var k = 0; k < occ.length; k += 2) {
        var ex = occ[k] - x, ey = occ[k + 1] - y;
        if (ex * ex + ey * ey < HIT2) { hit = true; break; }
      }
    }
    pts.push([x, y]);
    var best = null, bd = Infinity;
    for (var r = 0; r < MAXROWS; r++) for (var c = 0; c < rowLen(r); c++) {
      if (g[r][c] >= 0) continue;
      var ok = r === 0;
      if (!ok) { var nb = neighbors(r, c); for (var j = 0; j < nb.length; j++) if (g[nb[j][0]][nb[j][1]] >= 0) { ok = true; break; } }
      if (!ok) continue;
      var ddx = cellX(r, c) - x, ddy = cellY(r, drops) - y, d2 = ddx * ddx + ddy * ddy;
      if (d2 < bd) { bd = d2; best = [r, c]; }
    }
    return { pts: pts, cell: best, bounces: bounces };
  }

  // Put a bubble on (r, c); pops 3+ of a kind and drops what hangs on nothing. Mutates g.
  function resolve(g, r, c, col) {
    g[r][c] = col;
    var res = { popped: [], dropped: [] };
    var seen = {}, stack = [[r, c]], group = [];
    seen[r + ',' + c] = 1;
    while (stack.length) {
      var p = stack.pop(); group.push(p);
      neighbors(p[0], p[1]).forEach(function (q) { var k = q[0] + ',' + q[1]; if (!seen[k] && g[q[0]][q[1]] === col) { seen[k] = 1; stack.push(q); } });
    }
    if (group.length < 3) return res;
    group.forEach(function (p) { res.popped.push([p[0], p[1], col]); g[p[0]][p[1]] = -1; });
    var held = {}, st = [];
    for (var c0 = 0; c0 < rowLen(0); c0++) if (g[0][c0] >= 0) { held['0,' + c0] = 1; st.push([0, c0]); }
    while (st.length) {
      var q = st.pop();
      neighbors(q[0], q[1]).forEach(function (n) { var k = n[0] + ',' + n[1]; if (!held[k] && g[n[0]][n[1]] >= 0) { held[k] = 1; st.push(n); } });
    }
    eachCell(g, function (rr, cc, v) { if (!held[rr + ',' + cc]) { res.dropped.push([rr, cc, v]); g[rr][cc] = -1; } });
    return res;
  }

  // ---------- levels ----------
  // r biedronka, y stokrotka, b kropla, g listek, p gwiazdka, o serduszko; even rows 8, odd rows 7
  var LEVELS = [
    { tip: 'Zbij 3 takie same bańki.', rows: ['rrrbbbyy', 'rrbbbyy', 'yyyrrrbb', 'yyrrrbb'] },
    { tip: 'Przeciągnij palcem, żeby celować. Puść, żeby strzelić.', rows: ['rrbbyyrr', 'yyrrbby', 'bbyyrrbb', 'rrbbyyr', 'yyrrbbyy', 'bbyyrrb'] },
    { tip: 'Bańki bez oparcia spadają!', rows: ['r......b', 'r.....b', 'r......b', 'ryyyyyb', 'rbbyyrrb', 'ryyrrbb', 'rrbbyyyb', 'r.....b'] },
    { tip: 'Bańka odbija się od ściany.', rows: ['rrggbbyy', 'gbbyyrr', 'ggyyrrbb', 'bbrrggy', 'yyrrggbb', 'rggbbyy', 'rrbb..gg'] },
    { tip: 'Stuknij żabkę albo następną bańkę, żeby je zamienić.', rows: ['yybbrrgg', 'brrggyy', 'rrggyybb', 'gyybbrr', 'yybbrrgg', 'brrggyy', '..gg..bb'] },
    { tip: 'Gałąź zjeżdża w dół co kilka strzałów.', rows: ['ggrrbbyy', 'g.r.b.y', 'ggrrbbyy', 'yrrbbgg', 'yybbggrr', 'ybbggrr', 'rr.yy.bb', 'r.y..b.'] },
    { tip: 'Celuj w duże grupy.', rows: ['bbyyrrgg', 'yrrggbb', 'rrggbbyy', 'gbbyyrr', 'ggyyrrbb', 'yrrbbgg', 'yybbggrr', 'b.g.r.y'] },
    { tip: 'Szukaj miejsca, gdzie dużo spadnie naraz.', rows: ['rrggyybb', 'rgyybbr', 'ggyybbrr', 'gyybbrg', 'yybbrrgg', 'ybbrrgy', 'bbrrggyy', 'b.r.g.y'] },
    { tip: 'Odbij bańkę od ściany do kąta.', rows: ['yyggbbrr', 'gbbrryy', 'bbrryygg', 'ryyggbb', 'yyggbbrr', 'gbbrryy', 'bbrryygg', 'ryyggbb'] },
    { tip: 'Duża plansza. Dasz radę!', rows: ['rrbbggyy', 'bggyyrr', 'ggyyrrbb', 'yrrbbgg', 'rrbbggyy', 'bggyyrr', 'ggyyrrbb', 'yrrbbgg'] }
  ];

  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function colorsFor(n) { return n <= 3 ? 3 : n <= 18 ? 4 : n <= 60 ? 5 : 6; }
  function rowsFor(n) { return Math.min(7, 6 + Math.floor((n - 11) / 12)); }
  function lonely(g) {
    var lone = 0, tot = 0;
    eachCell(g, function (r, c, v) { tot++; if (!neighbors(r, c).some(function (q) { return g[q[0]][q[1]] === v; })) lone++; });
    return tot ? lone / tot : 1;
  }
  // a few seeds per level; keep the first without too many lonely bubbles (those make a level much harder)
  function generate(n) {
    var best = null, bl = 2;
    for (var a = 0; a < 12; a++) {
      var g = generateOnce(n, n * 7919 + 17 + a * 104729), l = lonely(g);
      if (l < bl) { bl = l; best = g; }
      if (l <= 0.2) break;
    }
    return best;
  }
  function generateOnce(n, seed) {
    var R = mulberry(seed), k = colorsFor(n), rows = rowsFor(n), g = emptyGrid(), r, c;
    var stick = 0.45 - Math.min(0.07, (n - 11) * 0.003) + (k >= 6 ? 0.05 : 0);   // chance to copy a neighbour: bigger clumps early
    for (r = 0; r < rows; r++) for (c = 0; c < rowLen(r); c++) {
      var nb = neighbors(r, c).filter(function (q) { return q[0] < r || (q[0] === r && q[1] < c); }).map(function (q) { return g[q[0]][q[1]]; }).filter(function (v) { return v >= 0; });
      g[r][c] = nb.length && R() < stick ? nb[Math.floor(R() * nb.length)] : Math.floor(R() * k);
    }
    // ragged bottom edge and a few holes
    for (c = 0; c < rowLen(rows - 1); c++) if (R() < 0.4) g[rows - 1][c] = -1;
    for (r = 2; r < rows - 1; r++) for (c = 0; c < rowLen(r); c++) if (R() < 0.05) g[r][c] = -1;
    // remove anything not held from the top
    var tmp = cloneGrid(g), held = {}, st = [];
    for (c = 0; c < COLS; c++) if (tmp[0][c] >= 0) { held['0,' + c] = 1; st.push([0, c]); }
    while (st.length) { var q = st.pop(); neighbors(q[0], q[1]).forEach(function (m) { var key = m[0] + ',' + m[1]; if (!held[key] && tmp[m[0]][m[1]] >= 0) { held[key] = 1; st.push(m); } }); }
    eachCell(g, function (rr, cc) { if (!held[rr + ',' + cc]) g[rr][cc] = -1; });
    return g;
  }
  function levelDef(n) {
    var hand = LEVELS[n - 1];
    var g = hand ? rowsToGrid(hand.rows) : generate(n);
    var total = count(g), k = colorsLeft(g).length;
    var shots = Math.ceil(total * (0.5 + 0.06 * k + (k >= 6 ? 0.1 : 0))) + 6;
    var every = n <= 3 ? 12 : 10;
    return { n: n, grid: g, total: total, colors: k, shots: shots, every: every, tip: hand ? hand.tip : '', t3: Math.ceil(shots * 0.45), t2: Math.ceil(shots * 0.2) };
  }
  function starsFor(def, left) { return left >= def.t3 ? 3 : left >= def.t2 ? 2 : 1; }
  function pickColor(g, rnd) { var cl = colorsLeft(g); return cl.length ? cl[Math.floor((rnd || Math.random)() * cl.length)] : 0; }

  var core = {
    COLS: COLS, DEADROWS: DEADROWS, MAXROWS: MAXROWS, ROWH: ROWH, LX: LX, LY: LY, LEVELS: LEVELS,
    rowLen: rowLen, cellX: cellX, cellY: cellY, emptyGrid: emptyGrid, cloneGrid: cloneGrid, neighbors: neighbors,
    count: count, colorsLeft: colorsLeft, isDead: isDead, trace: trace, resolve: resolve, levelDef: levelDef,
    starsFor: starsFor, generate: generate, rowsToGrid: rowsToGrid, gridToRows: gridToRows, mulberry: mulberry, pickColor: pickColor
  };

  // =====================================================================
  // Drawing helpers
  // =====================================================================
  function roundRect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function starPath(g, x, y, ro, ri) {
    g.beginPath();
    for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i & 1 ? ri : ro; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath();
  }
  function heartPath(g, x, y, s) {
    g.beginPath();
    g.moveTo(x, y + s * 0.75);
    g.bezierCurveTo(x - s * 1.1, y + s * 0.05, x - s * 0.75, y - s * 0.85, x, y - s * 0.3);
    g.bezierCurveTo(x + s * 0.75, y - s * 0.85, x + s * 1.1, y + s * 0.05, x, y + s * 0.75);
    g.closePath();
  }
  function dropPath(g, x, y, s) {
    g.beginPath();
    g.moveTo(x, y - s);
    g.bezierCurveTo(x + s * 0.2, y - s * 0.55, x + s * 0.72, y - s * 0.05, x + s * 0.72, y + s * 0.35);
    g.arc(x, y + s * 0.35, s * 0.72, 0, Math.PI);
    g.bezierCurveTo(x - s * 0.72, y - s * 0.05, x - s * 0.2, y - s * 0.55, x, y - s);
    g.closePath();
  }
  // one bubble: glossy dew drop in its colour + a symbol
  function drawBubble(g, x, y, rad, col, alpha) {
    var C = COLORS[col] || COLORS[0];
    g.save();
    if (alpha != null) g.globalAlpha = alpha;
    var grd = g.createRadialGradient(x - rad * 0.35, y - rad * 0.4, rad * 0.1, x, y, rad);
    grd.addColorStop(0, C.hi); grd.addColorStop(0.55, C.fill); grd.addColorStop(1, C.dark);
    g.beginPath(); g.arc(x, y, rad * 0.94, 0, Math.PI * 2);
    g.fillStyle = grd; g.fill();
    g.lineWidth = Math.max(1.5, rad * 0.1); g.strokeStyle = INK; g.stroke();
    var s = rad * 0.5;
    g.lineWidth = Math.max(1, rad * 0.07);
    if (col === 0) {
      // ladybird: dark head, wing line, dots
      g.fillStyle = '#26203a';
      g.beginPath(); g.arc(x, y - rad * 0.94, rad * 0.5, 0.15 * Math.PI, 0.85 * Math.PI); g.closePath(); g.fill();
      g.strokeStyle = '#26203a'; g.lineWidth = Math.max(1, rad * 0.08);
      g.beginPath(); g.moveTo(x, y - rad * 0.5); g.lineTo(x, y + rad * 0.88); g.stroke();
      [[-0.45, -0.1], [0.45, -0.1], [-0.4, 0.42], [0.4, 0.42]].forEach(function (p) { g.beginPath(); g.arc(x + p[0] * rad, y + p[1] * rad, rad * 0.15, 0, Math.PI * 2); g.fill(); });
    } else if (col === 1) {
      g.fillStyle = '#fff';
      for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3; g.beginPath(); g.ellipse(x + Math.cos(a) * s * 0.62, y + Math.sin(a) * s * 0.62, s * 0.42, s * 0.24, a, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#e07b00'; g.beginPath(); g.arc(x, y, s * 0.32, 0, Math.PI * 2); g.fill();
    } else if (col === 2) {
      g.fillStyle = '#fff'; dropPath(g, x, y - s * 0.1, s * 0.95); g.fill();
    } else if (col === 3) {
      g.save(); g.translate(x, y); g.rotate(-Math.PI / 4);
      g.fillStyle = '#e6ffd8';
      g.beginPath(); g.moveTo(-s, 0); g.quadraticCurveTo(0, -s * 0.9, s, 0); g.quadraticCurveTo(0, s * 0.9, -s, 0); g.fill();
      g.strokeStyle = C.dark; g.beginPath(); g.moveTo(-s * 0.85, 0); g.lineTo(s * 0.8, 0); g.stroke();
      g.restore();
    } else if (col === 4) {
      g.fillStyle = '#fff'; starPath(g, x, y + s * 0.05, s * 0.95, s * 0.42); g.fill();
    } else {
      g.fillStyle = '#fff'; heartPath(g, x, y + s * 0.02, s * 0.95); g.fill();
    }
    // dew gloss
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath(); g.ellipse(x - rad * 0.45, y - rad * 0.5, rad * 0.2, rad * 0.12, -0.7, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  function plural(n, one, few, many) {
    if (n === 1) return one;
    var d = n % 10, t = n % 100;
    return (d >= 2 && d <= 4 && (t < 12 || t > 14)) ? few : many;
  }
  function starStr(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }

  // =====================================================================
  // Game
  // =====================================================================
  function mount(el, ctx) {
    var save = ctx.load({ unlocked: 1, stars: {}, wins: 0, cur: null });
    if (!save.stars || typeof save.stars !== 'object') save.stars = {};
    var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', 'Bańki');
    el.appendChild(canvas);
    var g = canvas.getContext('2d');
    var W = 1, H = 1, dpr = 1, R = 20, bx = 0, by = 0, HUD = 46;
    var alive = true, paused = false, raf = 0, last = 0, tNow = 0, endTimer = 0, panel = null;

    // round state
    var mode = 'menu';                 // menu | play | fly | over
    var def = null, grid = emptyGrid(), drops = 0, dropsVis = 0, shotsLeft = 0, sinceDrop = 0, cur = 0, next = 0;
    var aim = { on: false, ang: Math.PI / 2, valid: false, tr: null }, ptr = null;
    var shot = null, pops = [], falls = [], bits = [], confetti = [], shake = 0, frogHop = 0, swapAnim = 0, blinkAt = 2;
    var shownLevel = 1;

    function persist() { ctx.save(save); }

    // ---------- layout ----------
    function resize() {
      var r = el.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      HUD = 46;
      R = Math.max(10, Math.min((W - 12) / BW, (H - HUD - 8) / BH, 34));
      bx = (W - BW * R) / 2;
      var spare = H - HUD - 6 - BH * R;
      by = HUD + 6 + Math.max(0, spare) * 0.15;
      draw();
    }
    var ro = new ResizeObserver(resize);
    ro.observe(el);
    function px(x) { return bx + x * R; }
    function py(y) { return by + y * R; }

    // ---------- round lifecycle ----------
    function startLevel(n) {
      def = levelDef(n);
      grid = cloneGrid(def.grid);
      drops = 0; dropsVis = 0; shotsLeft = def.shots; sinceDrop = 0;
      cur = pickColor(grid); next = pickColor(grid);
      pops = []; falls = []; bits = []; confetti = []; shot = null;
      mode = 'play';
      save.cur = snapshot();
      persist();
    }
    function snapshot() { return { n: def.n, rows: gridToRows(grid), drops: drops, left: shotsLeft, since: sinceDrop, cur: cur, next: next }; }
    function resumeLevel() {
      var s = save.cur;
      def = levelDef(s.n);
      grid = rowsToGrid(s.rows);
      drops = dropsVis = s.drops || 0; shotsLeft = s.left; sinceDrop = s.since || 0; cur = s.cur; next = s.next;
      var cl = colorsLeft(grid);
      if (cl.indexOf(cur) < 0) cur = pickColor(grid);
      if (cl.indexOf(next) < 0) next = pickColor(grid);
      pops = []; falls = []; bits = []; confetti = []; shot = null;
      mode = 'play';
    }
    function showDemo(n) {
      def = levelDef(n); grid = cloneGrid(def.grid); drops = dropsVis = 0; shotsLeft = def.shots; sinceDrop = 0;
      cur = colorsLeft(grid)[0] || 0; next = colorsLeft(grid)[1] || cur; shot = null; aim.on = false;
    }

    function swap() {
      if (mode !== 'play' || cur === next) { if (mode === 'play') ctx.sfx('tap'); return; }
      var t = cur; cur = next; next = t; swapAnim = 1; ctx.sfx('swap');
      if (save.cur) { save.cur.cur = cur; save.cur.next = next; persist(); }
    }
    function shoot(ang) {
      if (mode !== 'play') return false;
      ang = Math.max(MIN_ANG, Math.min(MAX_ANG, ang));
      var tr = trace(grid, drops, ang);
      if (!tr.cell) return false;
      var target = [cellX(tr.cell[0], tr.cell[1]), cellY(tr.cell[0], drops)];
      var pts = tr.pts.concat([target]), lens = [0];
      for (var i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      shot = { col: cur, pts: pts, lens: lens, d: 0, cell: tr.cell, bounces: tr.bounces, bounced: 0 };
      mode = 'fly';
      cur = next; next = pickColor(grid);
      shotsLeft--; sinceDrop++;
      frogHop = 1;
      aim.on = false;
      ctx.sfx('whoosh');
      // save the landed board now: leaving during the flight must not give the shot back
      var sg = cloneGrid(grid), sd = drops, ss = sinceDrop;
      resolve(sg, tr.cell[0], tr.cell[1], shot.col);
      if (ss >= def.every) { ss = 0; sd++; }
      if (count(sg) && !isDead(sg, sd) && shotsLeft > 0) {
        save.cur = { n: def.n, rows: gridToRows(sg), drops: sd, left: shotsLeft, since: ss, cur: cur, next: next };
      } else if (save.cur) {
        save.cur.left = shotsLeft;   // the shot ends the level: destroy()/pause() finish it with land()
      }
      persist();
      return true;
    }
    function land() {
      var s = shot; shot = null;
      var r = s.cell[0], c = s.cell[1];
      var res = resolve(grid, r, c, s.col);
      var n = res.popped.length + res.dropped.length;
      if (!res.popped.length) {
        ctx.sfx('land');
        pops.push({ x: cellX(r, c), y: cellY(r, drops), col: s.col, t: 0, kind: 'wob', r: r, c: c });
      } else {
        res.popped.forEach(function (p, i) { pops.push({ x: cellX(p[0], p[1]), y: cellY(p[0], drops), col: p[2], t: -i * 0.045, kind: 'pop', snd: i < 7 }); });
        res.dropped.forEach(function (p) { falls.push({ x: cellX(p[0], p[1]), y: cellY(p[0], drops), vx: (Math.random() - 0.5) * 3, vy: -2 - Math.random() * 3, col: p[2], t: 0 }); });
        if (res.dropped.length) setTimeout2(function () { ctx.sfx(res.dropped.length >= 6 ? 'combo' : 'clear'); }, 0.25);
        ctx.stat('popped', n);
        if (res.dropped.length >= 10) ctx.sticker('big-drop');
        if (s.bounces > 0) ctx.sticker('bank-shot');
      }
      var left = count(grid);
      if (!left) return win();
      // keep the frog's bubbles to colours still on the board
      var cl = colorsLeft(grid);
      if (cl.indexOf(cur) < 0) cur = pickColor(grid);
      if (cl.indexOf(next) < 0) next = pickColor(grid);
      if (sinceDrop >= def.every) { sinceDrop = 0; drops++; shake = 1; ctx.sfx('hit'); }
      if (isDead(grid, drops)) return lose('line');
      if (shotsLeft <= 0) return lose('shots');
      mode = 'play';
      save.cur = snapshot();
      persist();
    }

    // small timed callbacks driven by the game clock (so pause/destroy stop them)
    var timed = [];
    function setTimeout2(fn, sec) { timed.push({ at: tNow + sec, fn: fn }); }

    function win() {
      mode = 'over';
      var n = def.n, stars = starsFor(def, shotsLeft), prev = save.stars[n] || 0;
      save.stars[n] = Math.max(prev, stars);
      save.wins = (save.wins || 0) + 1;
      if (n >= save.unlocked) save.unlocked = n + 1;
      save.cur = null;
      persist();
      ctx.sfx('win');
      ctx.stat('wins', 1);
      ctx.stat('level', n, 'max');
      ctx.sticker('first-win');
      if (stars === 3) ctx.sticker('three-stars');
      if (!reduced) for (var i = 0; i < 60; i++) confetti.push({ x: Math.random() * BW, y: -Math.random() * 8, vx: (Math.random() - 0.5) * 2, vy: 3 + Math.random() * 4, rot: Math.random() * 6, col: Math.floor(Math.random() * 6) });
      endTimer = setTimeout(function () {
        endTimer = 0; if (!alive) return;
        panel = ctx.panel({
          big: starStr(stars), title: 'Brawo!',
          lines: ['Poziom ' + n + ' zaliczony!', 'Zostało ' + shotsLeft + ' ' + plural(shotsLeft, 'strzał', 'strzały', 'strzałów') + '.',
            { text: stars < 3 ? 'Trzy gwiazdki: zostaw ' + def.t3 + ' ' + plural(def.t3, 'strzał', 'strzały', 'strzałów') + '.' : 'Najlepiej jak się da!', muted: true }],
          price: PRICE, note: 'poziom ' + (n + 1), button: 'Poziom ' + (n + 1),
          onPlay: function () { panel = null; startLevel(n + 1); },
          secondary: [{ label: 'Wybierz poziom', onClick: function () { panel = null; levelPanel(n); } }, { label: 'Wróć do gier', onClick: function () { ctx.exit(); } }]
        });
      }, reduced ? 600 : 1300);
    }
    function lose(why) {
      mode = 'over';
      var n = def.n, cleared = 1 - count(grid) / Math.max(1, def.total), half = cleared > 0.5;
      save.cur = null;
      persist();
      ctx.sfx('lose');
      if (half) ctx.refund(REFUND, 'poziom ' + n + ', ponad połowa');   // now, not in the timer: leaving early must not lose it
      endTimer = setTimeout(function () {
        endTimer = 0; if (!alive) return;
        var lines = [why === 'line' ? 'Bańki doszły do żabki.' : 'Skończyły się strzały.', 'Zbite: ' + Math.round(cleared * 100) + '% planszy.'];
        if (half) lines.push('Ponad połowa! Oddaję ' + REFUND + ' ★.');
        else lines.push({ text: 'Za ponad połowę planszy oddaję ' + REFUND + ' ★.', muted: true });
        panel = ctx.panel({
          title: half ? 'Prawie!' : 'Spróbuj jeszcze raz', lines: lines,
          price: PRICE, note: 'poziom ' + n, button: 'Jeszcze raz',
          onPlay: function () { panel = null; startLevel(n); },
          secondary: [{ label: 'Wybierz poziom', onClick: function () { panel = null; levelPanel(n); } }, { label: 'Wróć do gier', onClick: function () { ctx.exit(); } }]
        });
      }, 1000);
    }

    // ---------- panels ----------
    function levelPanel(n) {
      n = Math.max(1, Math.min(save.unlocked, n));
      shownLevel = n;
      mode = 'menu';
      showDemo(n);
      var d = def, best = save.stars[n] || 0, sec = [];
      if (n > 1) sec.push({ label: '◀ ' + (n - 1), onClick: function () { panel = null; ctx.sfx('tap'); levelPanel(n - 1); } });
      if (n < save.unlocked) sec.push({ label: (n + 1) + ' ▶', onClick: function () { panel = null; ctx.sfx('tap'); levelPanel(n + 1); } });
      sec.push({ label: 'Wróć do gier', onClick: function () { ctx.exit(); } });
      panel = ctx.panel({
        title: 'Bańki: poziom ' + n, big: best ? starStr(best) : '', medals: true,
        lines: [d.tip || 'Zbij wszystkie bańki!', 'Masz ' + d.shots + ' ' + plural(d.shots, 'strzał', 'strzały', 'strzałów') + '.',
          { text: 'Gałąź zjeżdża co ' + d.every + ' strzałów.', muted: true }],
        price: PRICE, note: 'poziom ' + n, button: 'Graj',
        onPlay: function () { panel = null; startLevel(n); }, secondary: sec
      });
    }
    function startPanel() {
      if (save.cur && save.cur.rows) {
        resumeLevel();
        mode = 'menu';
        panel = ctx.panel({
          title: 'Bańki', medals: true,
          lines: ['Masz zaczęty poziom ' + save.cur.n + '.', 'Zostało ' + save.cur.left + ' ' + plural(save.cur.left, 'strzał', 'strzały', 'strzałów') + '.'],
          button: 'Graj dalej',
          onPlay: function () { panel = null; resumeLevel(); },
          secondary: [{ label: 'Wróć do gier', onClick: function () { ctx.exit(); } }]
        });
      } else levelPanel(save.unlocked);
    }

    // ---------- input ----------
    function toUnits(ev) { var r = canvas.getBoundingClientRect(); return { x: (ev.clientX - r.left - bx) / R, y: (ev.clientY - r.top - by) / R, sx: ev.clientX, sy: ev.clientY }; }
    function inSwapZone(p) {
      var nx = LX + 4.3, ny = LY + 1.5;
      if (Math.hypot(p.x - nx, p.y - ny) < 1.9) return true;               // next bubble
      return Math.hypot(p.x - LX, (p.y - (LY + 1.3)) * 0.8) < 2.1;           // the frog
    }
    function setAim(p) {
      var dx = p.x - LX, dy = LY - p.y;
      if (dy < 0.4) dy = 0.4;
      var a = Math.atan2(dy, dx);
      aim.ang = Math.max(MIN_ANG, Math.min(MAX_ANG, a));
      aim.valid = true;
      aim.tr = trace(grid, drops, aim.ang);
    }
    function onDown(ev) {
      if (mode !== 'play' || ptr) return;
      var p = toUnits(ev);
      ptr = { id: ev.pointerId, sx: p.sx, sy: p.sy, swap: inSwapZone(p), moved: false };
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
      if (!ptr.swap) { aim.on = true; setAim(p); }
    }
    function onMove(ev) {
      if (!ptr || ev.pointerId !== ptr.id) return;
      var p = toUnits(ev);
      if (Math.hypot(p.sx - ptr.sx, p.sy - ptr.sy) > 12) ptr.moved = true;
      if (ptr.swap && ptr.moved && !inSwapZone(p)) { ptr.swap = false; aim.on = true; }
      if (aim.on && mode === 'play') setAim(p);
    }
    function onUp(ev) {
      if (!ptr || ev.pointerId !== ptr.id) return;
      var p = toUnits(ev), was = ptr;
      ptr = null;
      if (mode !== 'play') { aim.on = false; return; }
      if (was.swap) { if (!was.moved || inSwapZone(p)) swap(); aim.on = false; return; }
      if (aim.on) {
        // letting go on the frog cancels the shot
        if (inSwapZone(p) && was.moved) { aim.on = false; return; }
        setAim(p);
        shoot(aim.ang);
      }
    }
    function onCancel(ev) { if (ptr && ev.pointerId === ptr.id) { ptr = null; aim.on = false; } }
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);

    // ---------- simulation ----------
    var SPEED = 34;   // units per second
    function step(dt) {
      for (var i = timed.length - 1; i >= 0; i--) if (tNow >= timed[i].at) { var f = timed[i].fn; timed.splice(i, 1); f(); }
      dropsVis += (drops - dropsVis) * (1 - Math.exp(-dt * 10));
      if (Math.abs(drops - dropsVis) < 0.002) dropsVis = drops;
      if (shake > 0) shake = Math.max(0, shake - dt * 2);
      if (frogHop > 0) frogHop = Math.max(0, frogHop - dt * 4);
      if (swapAnim > 0) swapAnim = Math.max(0, swapAnim - dt * 5);
      if (shot) {
        var before = shot.d;
        shot.d += SPEED * dt;
        var tot = shot.lens[shot.lens.length - 1];
        // wall bounce ticks
        for (var k = 1; k < shot.lens.length - 2; k++) if (before < shot.lens[k] && shot.d >= shot.lens[k]) ctx.sfx('tick');
        if (shot.d >= tot) land();
      }
      for (i = pops.length - 1; i >= 0; i--) {
        var p = pops[i];
        var t0 = p.t; p.t += dt;
        if (p.kind === 'pop' && t0 < 0 && p.t >= 0) {
          if (p.snd) ctx.sfx('bubble');
          if (!reduced) for (var b = 0; b < 6; b++) { var a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 4; bits.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, col: p.col }); }
        }
        if (p.t > 0.3) pops.splice(i, 1);
      }
      for (i = falls.length - 1; i >= 0; i--) {
        var f2 = falls[i];
        f2.t += dt; f2.vy += 40 * dt; f2.x += f2.vx * dt; f2.y += f2.vy * dt;
        if (f2.y > BH + 4 || (reduced && f2.t > 0.4)) falls.splice(i, 1);
      }
      for (i = bits.length - 1; i >= 0; i--) {
        var bt = bits[i];
        bt.t += dt; bt.vy += 12 * dt; bt.x += bt.vx * dt; bt.y += bt.vy * dt;
        if (bt.t > 0.5) bits.splice(i, 1);
      }
      for (i = confetti.length - 1; i >= 0; i--) {
        var c = confetti[i];
        c.x += c.vx * dt; c.y += c.vy * dt; c.rot += dt * 3;
        if (c.y > BH + 2) confetti.splice(i, 1);
      }
      if (tNow > blinkAt + 0.15) blinkAt = tNow + 2 + Math.random() * 3;
    }

    // ---------- drawing ----------
    function draw() {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // sky and meadow
      var sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#d8efff'); sky.addColorStop(0.62, '#eef9ff'); sky.addColorStop(0.78, '#d9f2c8'); sky.addColorStop(1, '#a9dc8a');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      drawSides();
      drawPond();
      drawHedge();
      drawLine();
      // bubbles
      var dv = dropsVis, sh = shake > 0 && !reduced ? Math.sin(tNow * 50) * shake * R * 0.12 : 0;
      var wob = {};
      pops.forEach(function (p) { if (p.kind === 'wob') wob[p.r + ',' + p.c] = p.t; });
      var popping = {};
      pops.forEach(function (p) { if (p.kind === 'pop') popping[p.x.toFixed(2) + ',' + p.y.toFixed(2)] = 1; });
      eachCell(grid, function (r, c, v) {
        var x = cellX(r, c), y = cellY(r, dv), k = r + ',' + c, s = 1;
        if (wob[k] != null) s = 1 + Math.sin(wob[k] * 20) * 0.08 * (1 - wob[k] / 0.3);
        drawBubble(g, px(x) + sh, py(y), R * s, v);
      });
      pops.forEach(function (p) {
        if (p.kind !== 'pop') return;
        var y = p.y + (dv - drops) * ROWH;
        if (p.t < 0) { drawBubble(g, px(p.x), py(y), R, p.col); return; }
        var k = p.t / 0.3;
        drawBubble(g, px(p.x), py(y), R * (1 + k * 0.5), p.col, 1 - k);
      });
      bits.forEach(function (b) {
        g.globalAlpha = Math.max(0, 1 - b.t / 0.5);
        g.fillStyle = COLORS[b.col].hi;
        g.beginPath(); g.arc(px(b.x), py(b.y), R * 0.18, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
      });
      falls.forEach(function (f) { drawBubble(g, px(f.x), py(f.y), R, f.col, reduced ? 1 - f.t / 0.4 : 1); });
      // aim guide
      if (aim.on && aim.valid && aim.tr && mode === 'play') drawGuide(aim.tr);
      drawFrog();
      if (shot) {
        var pos = along(shot);
        drawBubble(g, px(pos[0]), py(pos[1]), R, shot.col);
      }
      confetti.forEach(function (c) {
        g.save(); g.translate(px(c.x), py(c.y)); g.rotate(c.rot);
        g.fillStyle = COLORS[c.col].fill;
        g.beginPath(); g.ellipse(0, 0, R * 0.32, R * 0.16, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      });
      drawHud();
    }
    function along(s) {
      for (var i = 1; i < s.lens.length; i++) {
        if (s.d <= s.lens[i]) {
          var seg = s.lens[i] - s.lens[i - 1] || 1, k = (s.d - s.lens[i - 1]) / seg;
          return [s.pts[i - 1][0] + (s.pts[i][0] - s.pts[i - 1][0]) * k, s.pts[i - 1][1] + (s.pts[i][1] - s.pts[i - 1][1]) * k];
        }
      }
      return s.pts[s.pts.length - 1];
    }
    function drawSides() {
      // reeds marking the walls the bubbles bounce off
      var top = py(0) - 4, bot = py(LINE_Y);
      [px(0) - 3, px(BW) + 3].forEach(function (x, i) {
        g.strokeStyle = '#7cc46a'; g.lineWidth = 4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x, bot + R * 2); g.lineTo(x, top); g.stroke();
        g.strokeStyle = 'rgba(29,47,111,0.25)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(x + (i ? 2 : -2), bot + R * 2); g.lineTo(x + (i ? 2 : -2), top); g.stroke();
      });
      // flowers on wide screens
      var free = bx - 10;
      if (free > 40) {
        var R2 = mulberry(5), n = Math.floor(H / 90);
        for (var i = 0; i < n * 2; i++) {
          var side = i & 1, x = side ? px(BW) + 14 + R2() * (free - 28) : 14 + R2() * (free - 28), y = HUD + 40 + R2() * (H - HUD - 80);
          var col = ['#f28ab2', '#f2b51d', '#ffffff', '#8a5cd0'][i % 4];
          g.strokeStyle = '#4f9e3f'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 18); g.stroke();
          g.fillStyle = col;
          for (var k = 0; k < 5; k++) { var a = k * Math.PI * 2 / 5; g.beginPath(); g.arc(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 4, 0, Math.PI * 2); g.fill(); }
          g.fillStyle = '#f0a020'; g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
        }
      }
    }
    function drawPond() {
      var y = py(LY + 2.9);
      g.fillStyle = '#9fd3f2';
      g.beginPath(); g.ellipse(px(LX), y, R * 6.5, R * 1.3, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(29,47,111,0.35)'; g.lineWidth = 2; g.stroke();
      // lily pad
      g.fillStyle = '#5fb94a'; g.strokeStyle = INK; g.lineWidth = 2.5;
      g.beginPath(); g.ellipse(px(LX), y, R * 3.2, R * 0.8, 0, 0.12 * Math.PI, 2.05 * Math.PI); g.lineTo(px(LX), y); g.closePath(); g.fill(); g.stroke();
      // the leaf for the next bubble
      var nx = px(LX + 4.3), ny = py(LY + 2.25);
      g.fillStyle = '#7dcc5f';
      g.beginPath(); g.ellipse(nx, ny, R * 1.25, R * 0.42, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    function drawHedge() {
      var bottom = py(dropsVis * ROWH), sh = shake > 0 && !reduced ? Math.sin(tNow * 50) * shake * R * 0.12 : 0;
      var x0 = px(0) - 6, x1 = px(BW) + 6;
      if (bottom > by + 1) {
        g.fillStyle = '#6fb64f';
        g.fillRect(x0, by - 4, x1 - x0, bottom - by + 4);
        g.fillStyle = '#86c866';
        for (var y = by + 6; y < bottom - 4; y += R * 0.9) for (var x = x0 + ((y / R | 0) % 2) * R * 0.6; x < x1; x += R * 1.2) {
          g.beginPath(); g.ellipse(x, y, R * 0.42, R * 0.26, 0.6, 0, Math.PI * 2); g.fill();
        }
      }
      // branch
      var yb = bottom - 2;
      g.strokeStyle = INK; g.lineWidth = 9; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0 + sh, yb); g.lineTo(x1 + sh, yb); g.stroke();
      g.strokeStyle = '#a0683a'; g.lineWidth = 5.5;
      g.beginPath(); g.moveTo(x0 + sh, yb); g.lineTo(x1 + sh, yb); g.stroke();
      for (var i = 0; i < 9; i++) {
        var lx = x0 + (i + 0.5) * (x1 - x0) / 9 + sh, up = i & 1;
        g.fillStyle = up ? '#5fb94a' : '#47a83a';
        g.beginPath(); g.ellipse(lx, yb + (up ? -6 : 5), R * 0.42, R * 0.2, up ? -0.5 : 0.5, 0, Math.PI * 2); g.fill();
        g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke();
      }
    }
    function drawLine() {
      var y = py(LINE_Y);
      g.save();
      g.setLineDash([R * 0.5, R * 0.4]);
      var near = false;
      eachCell(grid, function (r) { if (r + drops >= DEADROWS - 2) near = true; });
      g.strokeStyle = near && mode !== 'menu' ? 'rgba(207,65,45,' + (0.6 + 0.35 * Math.sin(tNow * 6)) + ')' : 'rgba(207,65,45,0.45)';
      g.lineWidth = near ? 4 : 3;
      g.beginPath(); g.moveTo(px(0), y); g.lineTo(px(BW), y); g.stroke();
      g.restore();
    }
    function drawGuide(tr) {
      var pts = tr.pts, col = COLORS[cur];
      // dots along the path, every 0.8 units
      var acc = 0.6;
      g.fillStyle = '#fff'; g.strokeStyle = col.dark; g.lineWidth = 1.5;
      for (var i = 1; i < pts.length; i++) {
        var ax = pts[i - 1][0], ay = pts[i - 1][1], dx = pts[i][0] - ax, dy = pts[i][1] - ay, len = Math.hypot(dx, dy);
        var d = acc;
        while (d < len) {
          var x = ax + dx * d / len, y = ay + dy * d / len;
          g.beginPath(); g.arc(px(x), py(y), R * 0.17, 0, Math.PI * 2); g.fill(); g.stroke();
          d += 0.8;
        }
        acc = d - len;
      }
      if (tr.cell) {
        var cx = px(cellX(tr.cell[0], tr.cell[1])), cy = py(cellY(tr.cell[0], drops));
        drawBubble(g, cx, cy, R, cur, 0.35);
        g.save(); g.setLineDash([4, 4]); g.strokeStyle = INK; g.lineWidth = 2;
        g.beginPath(); g.arc(cx, cy, R * 0.95, 0, Math.PI * 2); g.stroke(); g.restore();
      }
    }
    function drawFrog() {
      var hop = frogHop > 0 && !reduced ? Math.sin(frogHop * Math.PI) * R * 0.35 : 0;
      var fx = px(LX), fy = py(LY + 2.0) - hop, s = R;
      // body
      g.fillStyle = '#6cc35a'; g.strokeStyle = INK; g.lineWidth = 2.5;
      g.beginPath(); g.ellipse(fx, fy + s * 0.25, s * 2.2, s * 1.35, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#c9f0a6';
      g.beginPath(); g.ellipse(fx, fy + s * 0.65, s * 1.25, s * 0.75, 0, 0, Math.PI * 2); g.fill();
      // feet
      g.fillStyle = '#6cc35a';
      [-1, 1].forEach(function (k) { g.beginPath(); g.ellipse(fx + k * s * 1.7, fy + s * 1.4, s * 0.7, s * 0.3, 0, 0, Math.PI * 2); g.fill(); g.stroke(); });
      // eyes look where we aim
      var la = aim.on ? aim.ang : Math.PI / 2, ex = Math.cos(la) * s * 0.16, ey = -Math.sin(la) * s * 0.16, blink = tNow > blinkAt && tNow < blinkAt + 0.15;
      [-1, 1].forEach(function (k) {
        var x = fx + k * s * 1.45, y = fy - s * 1.0;
        g.fillStyle = '#6cc35a'; g.beginPath(); g.arc(x, y, s * 0.62, 0, Math.PI * 2); g.fill(); g.stroke();
        if (blink) { g.beginPath(); g.moveTo(x - s * 0.35, y); g.lineTo(x + s * 0.35, y); g.stroke(); return; }
        g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, s * 0.42, 0, Math.PI * 2); g.fill();
        g.fillStyle = INK; g.beginPath(); g.arc(x + ex, y + ey, s * 0.2, 0, Math.PI * 2); g.fill();
      });
      // smile + cheeks
      g.strokeStyle = INK; g.lineWidth = 2.5;
      g.beginPath(); g.arc(fx, fy - s * 0.05, s * 0.75, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
      g.fillStyle = 'rgba(242,138,178,0.6)';
      [-1, 1].forEach(function (k) { g.beginPath(); g.ellipse(fx + k * s * 1.2, fy + s * 0.05, s * 0.25, s * 0.15, 0, 0, Math.PI * 2); g.fill(); });
      // current bubble held up (hidden while it flies)
      var bob = mode === 'play' && !reduced ? Math.sin(tNow * 2.5) * R * 0.05 : 0;
      if (mode === 'play' || mode === 'menu') {
        var sc = swapAnim > 0 ? 1 - Math.sin(swapAnim * Math.PI) * 0.25 : 1;
        drawBubble(g, px(LX), py(LY) - hop + bob, R * sc, cur);
        // hands
        g.fillStyle = '#6cc35a'; g.strokeStyle = INK; g.lineWidth = 2;
        [-1, 1].forEach(function (k) { g.beginPath(); g.ellipse(px(LX) + k * R * 0.95, py(LY) + R * 0.55 - hop, R * 0.3, R * 0.22, 0, 0, Math.PI * 2); g.fill(); g.stroke(); });
      }
      // next bubble on its leaf + swap arrows
      var nx = px(LX + 4.3), ny = py(LY + 1.5);
      if (mode !== 'over') drawBubble(g, nx, ny, R * 0.78, next);
      g.fillStyle = INK; g.font = Math.round(Math.max(13, R * 0.62)) + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('⇄ następna', nx, ny - R * 1.3);
      // shots until the branch drops
      if (def && mode !== 'menu' || def) {
        var left = def.every - sinceDrop, sx = px(LX - 4.4), sy = py(LY + 1.6), warn = left <= 1 && mode === 'play';
        var bw = R * 2.3, bh = R * 1.3;
        g.fillStyle = warn ? '#ffe1d9' : '#fff7e6'; g.strokeStyle = INK; g.lineWidth = 2.5;
        roundRect(g, sx - bw / 2, sy - bh / 2, bw, bh, R * 0.35); g.fill(); g.stroke();
        g.fillStyle = warn ? RED : '#8a5a33';
        g.font = Math.round(Math.max(15, R * 0.8)) + 'px ' + FONT;
        g.fillText('↓ ' + left, sx, sy + 1);
        g.fillStyle = MUTED; g.font = Math.round(Math.max(12, R * 0.55)) + 'px ' + FONT;
        g.fillText('gałąź', sx, sy - bh / 2 - R * 0.45);
      }
    }
    function drawHud() {
      if (!def) return;
      var fs = 20;
      g.font = fs + 'px ' + FONT; g.textBaseline = 'middle'; g.textAlign = 'left';
      // level pill
      var t = 'Poziom ' + def.n, w = g.measureText(t).width + 24;
      g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 2.5;
      roundRect(g, 8, 7, w, 32, 16); g.fill(); g.stroke();
      g.fillStyle = LVL; g.fillText(t, 20, 24);
      // shots pill
      var st = String(shotsLeft), sw = g.measureText(st).width + 58, sx = W - 8 - sw;
      g.fillStyle = '#fff'; roundRect(g, sx, 7, sw, 32, 16); g.fill(); g.stroke();
      drawBubble(g, sx + 20, 23, 11, cur);
      g.fillStyle = shotsLeft <= 3 ? RED : INK; g.fillText(st, sx + 38, 24);
      // stars you would get right now
      var stars = starsFor(def, shotsLeft), cx = W / 2;
      if (cx - 45 > 8 + w + 6 && cx + 45 < sx - 6) {
        for (var i = 0; i < 3; i++) {
          starPath(g, cx + (i - 1) * 28, 23, 12, 5.5);
          g.fillStyle = i < stars ? GOLD : '#e6e9f2'; g.fill();
          g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
        }
      }
    }

    function loop(ts) {
      if (!alive || paused) return;
      raf = requestAnimationFrame(loop);
      var t = ts / 1000, dt = last ? Math.min(0.05, t - last) : 0;
      last = t; tNow += dt;
      step(dt);
      draw();
    }

    // test hook (headless tests only): drive the real game
    NG.impl.banki._live = {
      state: function () { return { mode: mode, level: def && def.n, shotsLeft: shotsLeft, drops: drops, left: count(grid), cur: cur, next: next, rows: gridToRows(grid), save: JSON.parse(JSON.stringify(save)) }; },
      setGrid: function (rows, c1, c2) { grid = rowsToGrid(rows); if (c1 != null) cur = c1; if (c2 != null) next = c2; },
      shoot: function (deg) { return shoot(deg * Math.PI / 180); },
      swap: swap,
      geo: function () { return { bx: bx, by: by, R: R, LX: LX, LY: LY }; }
    };

    resize();
    startPanel();
    raf = requestAnimationFrame(loop);

    return {
      destroy: function () {
        if (mode === 'fly' && shot) land();   // finish the shot in flight (saves the board, or wins/loses)
        alive = false;
        cancelAnimationFrame(raf);
        clearTimeout(endTimer);
        ro.disconnect();
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onCancel);
        if (panel) { try { panel.close(); } catch (e) {} panel = null; }
        canvas.remove();
        if (NG.impl.banki) delete NG.impl.banki._live;
      },
      pause: function () { paused = true; cancelAnimationFrame(raf); raf = 0; if (mode === 'fly' && shot) land(); },
      resume: function () {
        if (!alive || !paused) return;
        paused = false; last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
  }

  // tile picture: frog with a bubble, a few bubbles hanging from a branch
  var PIC = (function () {
    var s = '<rect x="0" y="0" width="120" height="72" fill="#e3f4ff"/><rect x="0" y="58" width="120" height="14" fill="#9fd3f2"/>';
    s += '<path d="M6 7 h108" stroke="#1d2f6f" stroke-width="6" stroke-linecap="round"/><path d="M6 7 h108" stroke="#a0683a" stroke-width="3.5" stroke-linecap="round"/>';
    var b = [[22, 16, '#e2453a'], [36, 16, '#f4c21f'], [50, 16, '#3f8fe0'], [64, 16, '#47b347'], [78, 16, '#e2453a'], [92, 16, '#9a62d8'], [29, 28, '#3f8fe0'], [43, 28, '#3f8fe0'], [71, 28, '#f4c21f'], [85, 28, '#47b347']];
    b.forEach(function (p) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="6.6" fill="' + p[2] + '" stroke="#1d2f6f" stroke-width="1.6"/><ellipse cx="' + (p[0] - 2.4) + '" cy="' + (p[1] - 2.6) + '" rx="1.6" ry="1" fill="#fff" opacity=".8"/>'; });
    s += '<circle cx="22" cy="16" r="1.3" fill="#26203a"/><circle cx="78" cy="14" r="1.3" fill="#26203a"/>';
    s += '<path d="M60 52 l-4 -14" stroke="#1d2f6f" stroke-width="1.6" stroke-dasharray="2 3"/>';
    s += '<ellipse cx="60" cy="64" rx="22" ry="5" fill="#5fb94a" stroke="#1d2f6f" stroke-width="2"/>';
    s += '<ellipse cx="60" cy="58" rx="14" ry="8" fill="#6cc35a" stroke="#1d2f6f" stroke-width="2"/>';
    s += '<circle cx="51" cy="50" r="4" fill="#6cc35a" stroke="#1d2f6f" stroke-width="2"/><circle cx="69" cy="50" r="4" fill="#6cc35a" stroke="#1d2f6f" stroke-width="2"/><circle cx="51" cy="50" r="1.6" fill="#1d2f6f"/><circle cx="69" cy="50" r="1.6" fill="#1d2f6f"/>';
    s += '<path d="M55 59 q5 4 10 0" fill="none" stroke="#1d2f6f" stroke-width="1.8" stroke-linecap="round"/>';
    s += '<circle cx="60" cy="44" r="6.6" fill="#f5892a" stroke="#1d2f6f" stroke-width="1.6"/><path d="M60 47 c-4 -3 -3 -6 0 -4.5 c3 -1.5 4 1.5 0 4.5z" fill="#fff"/>';
    return s;
  })();

  NG.register('banki', {
    meta: { name: 'Bańki', price: '40 ★ za poziom', bg: '#e3f4ff', pic: PIC, music: 'play' },
    medals: [
      { id: 'l3', stat: 'level', at: 3, tier: 1, text: '3 poziomy' },
      { id: 'l10', stat: 'level', at: 10, tier: 2, text: '10 poziomów' },
      { id: 'l25', stat: 'level', at: 25, tier: 3, text: '25 poziomów' }
    ],
    quests: [
      { id: 'popped', stat: 'popped', n: [40, 70], text: 'Zbij {n} baniek w Bańkach' },
      { id: 'wins', stat: 'wins', n: [1, 2], text: 'Wygraj {n} {poziom} w Bańkach', forms: ['poziom', 'poziomy', 'poziomów'] }
    ],
    stickers: [
      { id: 'first-win', emoji: '🐸', name: 'Pierwsza wygrana w Bańkach' },
      { id: 'big-drop', emoji: '🍃', name: 'Wielki spadek (10 baniek naraz)' },
      { id: 'bank-shot', emoji: '🎯', name: 'Odbicie od ściany' },
      { id: 'three-stars', emoji: '🌟', name: 'Trzy gwiazdki w Bańkach' }
    ],
    core: core,
    mount: mount
  });
})();
