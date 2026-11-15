/* Rury do ogródka: obracaj rury, żeby woda z beczki doszła do kwiatków.
 * Plansze są budowane z rozwiązania (losowe drzewo rozpinające od kranu do kwiatków),
 * reszta pól to rury-zmyłki, potem każda płytka jest losowo obrócona, więc plansza zawsze ma rozwiązanie.
 * 100 ★ = paczka 5 plansz; każda skończona paczka wysyła nasionko kwiatka do Ogródka.
 */
(function () {
  'use strict';

  var FONT = '"Patrick Hand", "Comic Sans MS", cursive';
  var INK = '#1d2f6f', GOLD = '#e3a008', PURPLE = '#7a4fc4', MUTED = '#5a6690';
  var WATER = '#3f86d8', WATER_HI = '#9cc9f5', CHANNEL = '#c9d6ea', PIPE = '#f4f7fb';
  var PACK = 5, PRICE = 100;
  var SPEED = 9;            // water speed, cells per second
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];   // N E S W, bit = 1 << d
  var FLOWER_COLORS = ['#e2533f', '#f28ab2', '#f2b51d', '#8a5cd0', '#f08a24', '#e86fae'];

  function rotMask(m, k) { k = ((k % 4) + 4) % 4; while (k--) m = ((m << 1) | (m >> 3)) & 15; return m; }
  function bitCount(m) { var c = 0; while (m) { c += m & 1; m >>= 1; } return c; }
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
  function plural(n, one, few, many) {
    if (n === 1) return one;
    var d = n % 10, t = n % 100;
    return (d >= 2 && d <= 4 && (t < 12 || t > 14)) ? few : many;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mix(c1, c2, t) {
    var a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
    var r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
    var g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
    var bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  // ---------- progression ----------
  function sizeFor(no) { return no <= 4 ? 4 : no <= 10 ? 5 : no <= 20 ? 6 : 7; }
  function flowersFor(no, R) {
    if (no < 15) return 1;
    if (no < 20) return no % 2 === 1 ? 2 : 1;
    if (no >= 30 && R() < 0.3) return 3;
    return R() < 0.75 ? 2 : 1;
  }

  // ---------- board generation ----------
  function generate(no, seed) {
    var R = rng(seed);
    var N = sizeFor(no), T = N * N;
    var nF = flowersFor(no, R);
    function nb(i, d) {
      var x = i % N + DX[d], y = (i / N | 0) + DY[d];
      return (x < 0 || y < 0 || x >= N || y >= N) ? -1 : y * N + x;
    }
    function dirTo(a, b) { for (var d = 0; d < 4; d++) if (nb(a, d) === b) return d; return -1; }

    // Wilson's algorithm: uniform random spanning tree, gives nicely winding paths
    var inTree = [], next = [], adj = [], i, u;
    for (i = 0; i < T; i++) { inTree.push(false); next.push(-1); adj.push(0); }
    inTree[R() * T | 0] = true;
    var order = [];
    for (i = 0; i < T; i++) order.push(i);
    for (i = T - 1; i > 0; i--) { var j = R() * (i + 1) | 0, tmp = order[i]; order[i] = order[j]; order[j] = tmp; }
    order.forEach(function (s) {
      u = s;
      while (!inTree[u]) {
        var v;
        do { v = nb(u, R() * 4 | 0); } while (v < 0);
        next[u] = v; u = v;
      }
      u = s;
      while (!inTree[u]) { inTree[u] = true; u = next[u]; }
    });
    for (i = 0; i < T; i++) if (next[i] >= 0) { var d0 = dirTo(i, next[i]); adj[i] |= 1 << d0; adj[next[i]] |= 1 << ((d0 + 2) % 4); }

    // root the tree at the entry cell (top row, under the tap)
    var entryCol = R() * N | 0, entry = entryCol;
    var par = [], dist = [];
    for (i = 0; i < T; i++) { par.push(-2); dist.push(-1); }
    par[entry] = -1; dist[entry] = 0;
    var q = [entry];
    while (q.length) {
      u = q.shift();
      for (var d = 0; d < 4; d++) if (adj[u] & (1 << d)) {
        var w = nb(u, d);
        if (dist[w] < 0) { dist[w] = dist[u] + 1; par[w] = u; q.push(w); }
      }
    }
    function isAnc(a, b) { while (b >= 0) { if (b === a) return true; b = par[b]; } return false; }
    function pathSet(fl) {
      var s = {}, n = 0;
      fl.forEach(function (f) { var c = f; while (c >= 0) { if (!s[c]) { s[c] = 1; n++; } c = par[c]; } });
      return n;
    }
    var maxD = 0;
    for (i = 0; i < T; i++) if (dist[i] > maxD) maxD = dist[i];

    // pick flowers: far from the tap, never one on the way to another
    var flowers = null, best = -1;
    var minD = Math.max(2, Math.min(maxD, Math.round(N * (nF > 1 ? 0.9 : 1.1))));
    for (var tr = 0; tr < 400; tr++) {
      var fl = [];
      for (var k = 0; k < nF; k++) fl.push(R() * T | 0);
      var ok = true;
      for (k = 0; k < nF && ok; k++) {
        if (fl[k] === entry || dist[fl[k]] < minD) ok = false;
        for (var m = 0; m < nF && ok; m++) if (m !== k && isAnc(fl[m], fl[k])) ok = false;
      }
      if (!ok) continue;
      var score = pathSet(fl) + R() * N * 0.8;
      if (score > best) { best = score; flowers = fl; }
    }
    if (!flowers) {   // fallback: the farthest cell
      var far = 0;
      for (i = 0; i < T; i++) if (dist[i] > dist[far]) far = i;
      flowers = [far];
    }

    // solution masks along the paths
    var cells = [];
    for (i = 0; i < T; i++) cells.push({ kind: 'pipe', base: 0, sol: false, turns: 0, vis: 0 });
    cells[entry].base |= 1;
    cells[entry].sol = true;
    flowers.forEach(function (f, fi) {
      cells[f].kind = 'flower';
      cells[f].color = FLOWER_COLORS[(R() * FLOWER_COLORS.length | 0)];
      if (fi > 0 && cells[f].color === cells[flowers[0]].color) cells[f].color = FLOWER_COLORS[(FLOWER_COLORS.indexOf(cells[f].color) + 2) % FLOWER_COLORS.length];
      var c = f;
      while (c !== entry) {
        var p = par[c], dd = dirTo(p, c);
        cells[p].base |= 1 << dd;
        cells[p].sol = true;
        if (cells[c].kind === 'pipe') { cells[c].base |= 1 << ((dd + 2) % 4); cells[c].sol = true; }
        c = p;
      }
    });
    // decoys
    var SHAPES = [[1, 15], [5, 25], [3, 30], [7, 22], [15, 8]];
    cells.forEach(function (c) {
      if (c.kind !== 'pipe' || c.sol) return;
      var r = R() * 100, acc = 0, sh = 3;
      for (var s = 0; s < SHAPES.length; s++) { acc += SHAPES[s][1]; if (r < acc) { sh = SHAPES[s][0]; break; } }
      c.base = rotMask(sh, R() * 4 | 0);
    });
    // grass tufts (static decoration)
    cells.forEach(function (c) {
      c.tufts = [];
      for (var t = 0; t < 3; t++) c.tufts.push([R() * 0.8 + 0.1, R() * 0.8 + 0.1, R() * 0.5 + 0.6]);
    });

    var board = { no: no, N: N, cells: cells, entry: entry, flowers: flowers, min: 0 };
    // scramble every pipe; keep it unsolved and with some work to do
    var need = Math.max(3, Math.round(N * 1.2 + flowers.length));
    for (var att = 0; att < 60; att++) {
      cells.forEach(function (c) { if (c.kind === 'pipe') c.turns = c.vis = R() * 4 | 0; });
      board.min = minMoves(board);
      if (board.min >= need && !solvedNow(board)) break;
    }
    return board;
  }

  function minMoves(b) {
    var sum = 0;
    b.cells.forEach(function (c) {
      if (c.kind !== 'pipe' || !c.sol) return;
      var cur = rotMask(c.base, c.turns);
      for (var k = 0; k < 4; k++) if (rotMask(cur, k) === c.base) { sum += k; break; }
    });
    return sum;
  }

  // water flow from the tap through the current (non-rotating) pipes
  function flow(b) {
    var N = b.N, T = N * N, par = [], ent = [], order = [];
    for (var i = 0; i < T; i++) { par.push(-2); ent.push(-1); }
    function rotating(c) { return Math.abs(c.turns - c.vis) > 0.04; }
    var e = b.cells[b.entry];
    if (e.kind === 'pipe' && !rotating(e) && (rotMask(e.base, e.turns) & 1)) {
      par[b.entry] = -1; ent[b.entry] = 0; order.push(b.entry);
      for (var qi = 0; qi < order.length; qi++) {
        var u = order[qi], cu = b.cells[u];
        if (cu.kind !== 'pipe') continue;
        var m = rotMask(cu.base, cu.turns);
        for (var d = 0; d < 4; d++) {
          if (!(m & (1 << d))) continue;
          var x = u % N + DX[d], y = (u / N | 0) + DY[d];
          if (x < 0 || y < 0 || x >= N || y >= N) continue;
          var v = y * N + x;
          if (par[v] !== -2) continue;
          var cv = b.cells[v], od = (d + 2) % 4;
          if (cv.kind === 'flower' || (!rotating(cv) && (rotMask(cv.base, cv.turns) & (1 << od)))) {
            par[v] = u; ent[v] = od; order.push(v);
          }
        }
      }
    }
    return { par: par, ent: ent, order: order };
  }
  function solvedNow(b) {
    var f = flow(b);
    return b.flowers.every(function (x) { return f.par[x] !== -2; });
  }

  function dropsFor(moves, min) {
    var extra = moves - min;
    if (extra <= 2 + Math.floor(min / 6)) return 3;
    if (extra <= 8 + Math.round(min * 0.6)) return 2;
    return 1;
  }

  NG.register('rury', {
    _test: { generate: generate, flow: flow, solvedNow: solvedNow, minMoves: minMoves, rotMask: rotMask },
    mount: function (el, ctx) {
      var save = ctx.load({ boards: 0, drops: 0, packs: 0, pack: null });
      var canvas = document.createElement('canvas');
      el.appendChild(canvas);
      // keep "Kolejne 5 plansz za 100 ★" on one line on 360px phones (scoped to this game's lifetime)
      var css = document.createElement('style');
      css.textContent = '.ng-panel .ng-btn{white-space:nowrap}@media (max-width:400px){.ng-panel .ng-btn:not(.sec){font-size:1.32rem;padding-left:12px;padding-right:12px}}';
      el.appendChild(css);
      var g = canvas.getContext('2d');
      var W = 0, H = 0, dpr = 1, L = null;
      var board = null, fill = [], prevEnt = [], bloom = [], bloomed = [], fl = null;
      var mode = 'menu';          // menu | play | won
      var moves = 0, winAt = 0, lastDrops = 0, packSummary = null;
      var particles = [], panel = null, raf = 0, last = 0, paused = false, alive = true, tNow = 0;
      var bannerBtn = null, curIdx = 0, endTimer = 0;

      function persist() { ctx.save(save); }

      // ---------- layout ----------
      function layout() {
        if (!board) return;
        var N = board.N, pad = 8, frame = 8, hud = 50, bottom = 34;
        var sW = (W - 2 * pad - 2 * frame) / N;
        var sH = (H - hud - bottom - 2 * frame - 6) / (N + 1.25);
        var s = Math.floor(Math.max(30, Math.min(sW, sH, 96)));
        var gw = s * N;
        var tapH = Math.round(s * 1.25);
        var used = hud + tapH + gw + 2 * frame + bottom;
        var top = hud + Math.max(0, (H - used) / 2);
        L = { s: s, N: N, gx: Math.round((W - gw) / 2), gy: Math.round(top + tapH + frame), frame: frame, hud: hud, tapTop: top };
      }
      function resize() {
        var r = el.getBoundingClientRect();
        W = Math.max(1, r.width); H = Math.max(1, r.height);
        dpr = Math.min(3, window.devicePixelRatio || 1);
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        layout();
        draw();
      }
      var ro = new ResizeObserver(resize);
      ro.observe(el);

      // ---------- board lifecycle ----------
      function setBoard(b) {
        board = b;
        var T = b.N * b.N;
        fill = []; prevEnt = []; bloom = []; bloomed = [];
        for (var i = 0; i < T; i++) { fill.push(0); prevEnt.push(-1); bloom.push(0); bloomed.push(false); }
        particles = [];
        layout();
      }
      function boardSeed() { return (save.pack.seed + save.pack.idx * 7919) >>> 0; }
      function startBoard() {
        var no = save.boards + 1;
        var b = generate(no, boardSeed());
        var cur = save.pack.cur;
        if (cur && cur.no === no && cur.turns && cur.turns.length === b.cells.length) {
          b.cells.forEach(function (c, i) { c.turns = c.vis = cur.turns[i]; });
          moves = cur.moves || 0;
        } else {
          moves = 0;
          save.pack.cur = null;
        }
        setBoard(b);
        mode = 'play';
        curIdx = save.pack.idx + 1;
        bannerBtn = null;
      }
      function newPack() {
        save.pack = { seed: (Math.random() * 4294967296) >>> 0, idx: 0, drops: [], cur: null };
        persist();
        startBoard();
      }
      function saveCur() {
        if (!save.pack) return;
        save.pack.cur = { no: board.no, moves: moves, turns: board.cells.map(function (c) { return ((c.turns % 4) + 4) % 4; }) };
        persist();
      }
      function sendSeed() {
        try {
          var key = 'naukagry.ogrodek.inbox', arr = [];
          try { arr = JSON.parse(localStorage.getItem(key)) || []; } catch (e) { arr = []; }
          if (!Array.isArray(arr)) arr = [];
          arr.push({ kind: 'kwiatek', n: 1, from: 'rury' });
          localStorage.setItem(key, JSON.stringify(arr));
        } catch (e) {}
      }
      function onWin() {
        mode = 'won';
        winAt = tNow;
        lastDrops = dropsFor(moves, board.min);
        save.boards += 1;
        save.drops += lastDrops;
        save.pack.drops.push(lastDrops);
        save.pack.idx += 1;
        save.pack.cur = null;
        if (save.pack.idx >= PACK) {
          var d = save.pack.drops.reduce(function (a, b) { return a + b; }, 0);
          packSummary = { drops: d };
          save.packs += 1;
          save.pack = null;
          sendSeed();
        } else packSummary = null;
        persist();
      }
      function afterBanner() {
        if (packSummary) {
          mode = 'menu';      // short pause so a double tap cannot hit the buy button
          endTimer = setTimeout(function () { endTimer = 0; if (alive) showEndPanel(); }, 400);
        } else startBoard();
      }

      // ---------- panels ----------
      function demoBoard() {
        var b = generate(save.boards + 1, 12345 + save.boards);
        setBoard(b);
        mode = 'menu';
      }
      function showStartPanel() {
        demoBoard();
        curIdx = save.pack && save.pack.idx < PACK ? save.pack.idx + 1 : 0;
        var stats = 'Plansze: ' + save.boards + ' · Krople: ' + save.drops;
        if (save.pack && save.pack.idx < PACK) {
          panel = ctx.panel({
            title: 'Rury do ogródka',
            lines: ['Masz zaczętą paczkę.', 'Plansza ' + (save.pack.idx + 1) + '/' + PACK, { text: stats, muted: true }],
            button: 'Graj dalej',
            onPlay: function () { panel = null; startBoard(); },
            secondary: [{ label: 'Wróć do gier', onClick: function () { ctx.exit(); } }]
          });
        } else {
          panel = ctx.panel({
            title: 'Rury do ogródka',
            lines: ['Obracaj rury, żeby woda z beczki doszła do kwiatka.', PACK + ' plansz za ' + PRICE + ' ★', { text: stats, muted: true }],
            price: PRICE, note: PACK + ' plansz',
            button: 'Zagraj',
            onPlay: function () { panel = null; newPack(); },
            secondary: [{ label: 'Wróć do gier', onClick: function () { ctx.exit(); } }]
          });
        }
      }
      function showEndPanel() {
        mode = 'menu';
        var d = packSummary ? packSummary.drops : 0;
        panel = ctx.panel({
          title: 'Kwiatki podlane!',
          big: d + ' / ' + (PACK * 3),
          lines: [
            'Zebrane krople w tej paczce.',
            'Ogródek dostał nasionko kwiatka.',
            { text: 'Razem: ' + save.boards + ' ' + plural(save.boards, 'plansza', 'plansze', 'plansz') + ', ' + save.drops + ' ' + plural(save.drops, 'kropla', 'krople', 'kropel'), muted: true }
          ],
          price: PRICE, note: PACK + ' plansz',
          button: 'Kolejne ' + PACK + ' plansz',
          onPlay: function () { panel = null; newPack(); },
          secondary: [{ label: 'Wróć do gier', onClick: function () { ctx.exit(); } }]
        });
      }

      // ---------- input ----------
      function onDown(ev) {
        if (!board || !L) return;
        var r = canvas.getBoundingClientRect();
        var x = ev.clientX - r.left, y = ev.clientY - r.top;
        if (mode === 'won') {
          if (bannerBtn && tNow - winAt > bannerDelay() + 0.25 &&
              x >= bannerBtn.x - 6 && x <= bannerBtn.x + bannerBtn.w + 6 && y >= bannerBtn.y - 6 && y <= bannerBtn.y + bannerBtn.h + 6) {
            bannerBtn = null;
            afterBanner();
          }
          return;
        }
        if (mode !== 'play') return;
        var cx = Math.floor((x - L.gx) / L.s), cy = Math.floor((y - L.gy) / L.s);
        if (cx < 0 || cy < 0 || cx >= L.N || cy >= L.N) return;
        var i = cy * L.N + cx, c = board.cells[i];
        if (c.kind === 'flower') { c.wiggle = tNow; return; }
        c.turns += 1;
        moves += 1;
        saveCur();
      }
      canvas.addEventListener('pointerdown', onDown);

      // ---------- simulation ----------
      function bannerDelay() { return 1.1; }
      function step(dt) {
        if (!board) return;
        var anyRot = false;
        board.cells.forEach(function (c) {
          if (c.kind !== 'pipe') return;
          var diff = c.turns - c.vis;
          if (Math.abs(diff) > 0.002) {
            anyRot = true;
            c.vis += diff * (1 - Math.exp(-dt * 16));
            if (Math.abs(c.turns - c.vis) < 0.01) c.vis = c.turns;
          }
          // keep numbers small without visual jumps
          if (c.vis === c.turns && c.turns >= 4) { c.turns -= 4; c.vis -= 4; }
        });
        fl = flow(board);
        var T = board.cells.length, i;
        var conn = [];
        for (i = 0; i < T; i++) conn.push(false);
        for (var k = 0; k < fl.order.length; k++) {
          var cI = fl.order[k], p = fl.par[cI];
          conn[cI] = true;
          if (fl.ent[cI] !== prevEnt[cI]) fill[cI] = 0;
          var parentFull = p === -1 || fill[p] >= 1;
          if (parentFull) fill[cI] = Math.min(1, fill[cI] + dt * SPEED);
        }
        for (i = 0; i < T; i++) { if (!conn[i]) fill[i] = 0; prevEnt[i] = fl.ent[i]; }
        var allBloom = true;
        board.flowers.forEach(function (f) {
          var target = fill[f] >= 1 ? 1 : 0;
          bloom[f] = clamp(bloom[f] + (target ? dt * 1.6 : -dt * 2.5), 0, 1);
          if (bloom[f] > 0.9 && !bloomed[f]) { bloomed[f] = true; burst(f); }
          if (bloom[f] < 0.3) bloomed[f] = false;
          if (bloom[f] < 1) allBloom = false;
        });
        if (mode === 'play' && allBloom && !anyRot) onWin();
        for (i = particles.length - 1; i >= 0; i--) {
          var pt = particles[i];
          pt.t += dt;
          pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 160 * dt;
          if (pt.t > pt.life) particles.splice(i, 1);
        }
      }
      function burst(f) {
        if (!L) return;
        var c = board.cells[f];
        var x = L.gx + (f % L.N + 0.5) * L.s, y = L.gy + ((f / L.N | 0) + 0.3) * L.s;
        for (var i = 0; i < 12; i++) {
          var a = Math.random() * Math.PI * 2, sp = 50 + Math.random() * 90;
          particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, t: 0, life: 0.8 + Math.random() * 0.4,
            color: i % 3 === 0 ? GOLD : i % 3 === 1 ? c.color : WATER_HI, r: 2.5 + Math.random() * 2.5 });
        }
      }

      // ---------- drawing helpers ----------
      function rr(x, y, w, h, r) {
        g.beginPath();
        g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
      }
      function drop(x, y, r, filled) {
        g.beginPath();
        g.moveTo(x, y - r * 1.5);
        g.bezierCurveTo(x + r * 0.35, y - r * 0.9, x + r, y - r * 0.35, x + r, y + r * 0.2);
        g.arc(x, y + r * 0.2, r, 0, Math.PI);
        g.bezierCurveTo(x - r, y - r * 0.35, x - r * 0.35, y - r * 0.9, x, y - r * 1.5);
        g.closePath();
        g.fillStyle = filled ? WATER : '#e6edf7';
        g.fill();
        g.lineWidth = Math.max(1.5, r * 0.16); g.strokeStyle = INK; g.stroke();
        if (filled) {
          g.beginPath(); g.ellipse(x - r * 0.38, y + r * 0.05, r * 0.18, r * 0.32, 0.4, 0, Math.PI * 2);
          g.fillStyle = 'rgba(255,255,255,.75)'; g.fill();
        }
      }
      function pill(x, y, w, h) {
        rr(x, y, w, h, h / 2);
        g.fillStyle = '#fff'; g.fill();
        g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
      }

      function drawBackground() {
        var sky = g.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, '#e9f6ff'); sky.addColorStop(1, '#d9f0d0');
        g.fillStyle = sky; g.fillRect(0, 0, W, H);
        if (!L) return;
        var horizon = L.tapTop + L.s * 0.55;
        if (horizon - L.hud > 80) {
          var cy0 = L.hud + Math.min(60, (horizon - L.hud) * 0.45);
          [[0.22, 0, 1], [0.55, -14, 0.75]].forEach(function (cl) {
            var ccx = ((cl[0] * W + tNow * 6 * cl[2]) % (W + 120)) - 60, ccy = cy0 + cl[1], k2 = 16 * cl[2];
            var puffs = [[-1.1, 0.2, 0.75], [-0.2, -0.3, 1], [0.9, 0.1, 0.8]];
            function puffPath() {
              g.beginPath();
              puffs.forEach(function (pf) { g.moveTo(ccx + pf[0] * k2 + pf[2] * k2, ccy + pf[1] * k2); g.arc(ccx + pf[0] * k2, ccy + pf[1] * k2, pf[2] * k2, 0, Math.PI * 2); });
              g.rect(ccx - k2 * 1.1, ccy + k2 * 0.1, k2 * 2, k2 * 0.85);
            }
            puffPath(); g.lineWidth = 4; g.strokeStyle = 'rgba(29,47,111,.3)'; g.stroke();
            puffPath(); g.fillStyle = '#fff'; g.fill();
          });
          var sx = W - 52, sy = L.hud + Math.min(46, (horizon - L.hud) * 0.35), sr = 20;
          g.strokeStyle = '#f2b51d'; g.lineWidth = 3; g.lineCap = 'round';
          for (var k = 0; k < 8; k++) {
            var a = k * Math.PI / 4 + tNow * 0.2;
            g.beginPath(); g.moveTo(sx + Math.cos(a) * (sr + 6), sy + Math.sin(a) * (sr + 6)); g.lineTo(sx + Math.cos(a) * (sr + 13), sy + Math.sin(a) * (sr + 13)); g.stroke();
          }
          g.lineCap = 'butt';
          g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fillStyle = '#ffd34d'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
        }
        // fence
        var fy = L.tapTop + L.s * 0.1, fh = horizon - fy + 6, pw = 16, gap = 8;
        g.lineWidth = 2; g.strokeStyle = 'rgba(29,47,111,.45)';
        g.fillStyle = '#f6e3c1';
        rr(-4, fy + fh * 0.3, W + 8, 7, 3); g.fill(); g.stroke();
        rr(-4, fy + fh * 0.68, W + 8, 7, 3); g.fill(); g.stroke();
        for (var x = 4; x < W; x += pw + gap) {
          g.beginPath();
          g.moveTo(x, fy + fh); g.lineTo(x, fy + 6); g.lineTo(x + pw / 2, fy); g.lineTo(x + pw, fy + 6); g.lineTo(x + pw, fy + fh); g.closePath();
          g.fillStyle = '#fbeed6'; g.fill(); g.stroke();
        }
        // grass
        var gr = g.createLinearGradient(0, horizon, 0, H);
        gr.addColorStop(0, '#9fd97c'); gr.addColorStop(1, '#7cc35a');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(0, horizon);
        for (var gx = 0; gx <= W + 20; gx += 20) g.quadraticCurveTo(gx + 10, horizon - 5, gx + 20, horizon);
        g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(42,138,86,.35)'; g.lineWidth = 2; g.stroke();
      }

      function drawHud() {
        var y = 9, h = 34;
        var label = curIdx ? 'Plansza ' + curIdx + '/' + PACK : 'Plansze: ' + save.boards;
        g.font = '22px ' + FONT; g.textBaseline = 'middle';
        var w1 = g.measureText(label).width + 26;
        pill(10, y, w1, h);
        g.fillStyle = INK; g.textAlign = 'left'; g.fillText(label, 23, y + h / 2 + 1);
        // total drops (right)
        var tot = String(save.drops);
        var w3 = g.measureText(tot).width + 46;
        pill(W - 10 - w3, y, w3, h);
        drop(W - 10 - w3 + 18, y + h / 2 + 2, 7.5, true);
        g.fillStyle = INK; g.textAlign = 'right'; g.fillText(tot, W - 22, y + h / 2 + 1);
        // rotations (middle)
        var mv = String(moves);
        var w2 = g.measureText(mv).width + 48;
        var mx = (10 + w1 + (W - 10 - w3)) / 2 - w2 / 2;
        if (mx > 14 + w1 && mode !== 'menu') {
          pill(mx, y, w2, h);
          var ix = mx + 18, iy = y + h / 2;
          g.beginPath(); g.arc(ix, iy, 7, -Math.PI * 0.85, Math.PI * 0.6);
          g.strokeStyle = PURPLE; g.lineWidth = 3; g.lineCap = 'round'; g.stroke();
          var ax = ix + Math.cos(Math.PI * 0.6) * 7, ay = iy + Math.sin(Math.PI * 0.6) * 7;
          g.beginPath(); g.moveTo(ax - 5, ay - 1); g.lineTo(ax + 1, ay + 1); g.lineTo(ax - 1, ay - 5);
          g.stroke(); g.lineCap = 'butt';
          g.fillStyle = INK; g.textAlign = 'left'; g.fillText(mv, mx + 31, y + h / 2 + 1);
        }
      }

      function drawTap() {
        var s = L.s, col = board.entry % L.N;
        var x = L.gx + (col + 0.5) * s;
        var bw = s * 0.92, bh = s * 0.7;
        var by = L.gy - L.frame - s * 0.42 - bh;      // barrel top
        var pw = s * 0.24;
        // down pipe from barrel to the board
        var py0 = by + bh * 0.7, py1 = L.gy + 2;
        g.lineCap = 'butt';
        g.strokeStyle = INK; g.lineWidth = pw + 5; g.beginPath(); g.moveTo(x, py0); g.lineTo(x, py1); g.stroke();
        g.strokeStyle = PIPE; g.lineWidth = pw; g.stroke();
        g.strokeStyle = WATER; g.lineWidth = pw * 0.5; g.stroke();
        // barrel
        var bx = x - bw / 2;
        function barrelPath() {
          g.beginPath();
          g.moveTo(bx + bw * 0.08, by);
          g.quadraticCurveTo(bx - bw * 0.06, by + bh / 2, bx + bw * 0.08, by + bh);
          g.lineTo(bx + bw * 0.92, by + bh);
          g.quadraticCurveTo(bx + bw * 1.06, by + bh / 2, bx + bw * 0.92, by);
          g.closePath();
        }
        barrelPath();
        g.fillStyle = '#c98a4f'; g.fill();
        g.save(); g.clip();
        g.strokeStyle = 'rgba(110,60,25,.45)'; g.lineWidth = 2;
        for (var k = 1; k < 5; k++) { var sx = bx + bw * k / 5; g.beginPath(); g.moveTo(sx, by); g.quadraticCurveTo(sx + (k - 2.5) * bw * 0.03, by + bh / 2, sx, by + bh); g.stroke(); }
        g.fillStyle = '#6d7a8a';
        g.fillRect(bx - 4, by + bh * 0.18, bw + 8, Math.max(3, bh * 0.09));
        g.fillRect(bx - 4, by + bh * 0.73, bw + 8, Math.max(3, bh * 0.09));
        g.restore();
        barrelPath();
        g.strokeStyle = INK; g.lineWidth = 2.5; g.stroke();
        // water surface
        g.beginPath(); g.ellipse(x, by + 1, bw * 0.42, bh * 0.1, 0, 0, Math.PI * 2);
        g.fillStyle = '#7a4a24'; g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
        g.beginPath(); g.ellipse(x, by + 2, bw * 0.34, bh * 0.065, 0, 0, Math.PI * 2);
        g.fillStyle = WATER; g.fill();
        g.beginPath(); g.ellipse(x - bw * 0.12, by + 1, bw * 0.08, bh * 0.025, 0, 0, Math.PI * 2);
        g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
        // wooden tap handle on the pipe
        var hy = by + bh + (L.gy - L.frame - by - bh) * 0.5;
        rr(x - pw * 0.9, hy - pw * 0.42, pw * 1.8, pw * 0.84, pw * 0.3);
        g.fillStyle = '#e0a45e'; g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
        var flip = col >= L.N / 2 ? -1 : 1;
        var hx = x + flip * pw * 0.9;
        g.save(); g.translate(hx, hy); g.scale(flip, 1); g.rotate(fill[board.entry] > 0 ? -0.15 : 0.6);
        rr(0, -pw * 0.22, s * 0.36, pw * 0.44, pw * 0.22);
        g.fillStyle = '#b86f34'; g.fill(); g.strokeStyle = INK; g.stroke();
        g.restore();
        g.beginPath(); g.arc(hx, hy, pw * 0.22, 0, Math.PI * 2); g.fillStyle = '#e2533f'; g.fill(); g.stroke();
      }

      function drawBoardFrame() {
        var s = L.s, n = L.N, f = L.frame;
        rr(L.gx - f, L.gy - f, s * n + 2 * f, s * n + 2 * f, 14);
        g.fillStyle = '#9b6a3f'; g.fill();
        g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
        rr(L.gx - 2, L.gy - 2, s * n + 4, s * n + 4, 9);
        g.fillStyle = '#6f4726'; g.fill();
      }

      function drawTileBg(i, x, y, s) {
        var c = board.cells[i], col = i % L.N, row = i / L.N | 0;
        var gap = Math.max(1.5, s * 0.035);
        rr(x + gap, y + gap, s - 2 * gap, s - 2 * gap, Math.max(5, s * 0.14));
        if (c.kind === 'flower') {
          g.fillStyle = bloom[i] > 0 ? mix('#a8744a', '#7a4d2c', bloom[i]) : '#a8744a';
        } else {
          g.fillStyle = (col + row) % 2 ? '#9ad27a' : '#8cc96c';
        }
        g.fill();
        g.lineWidth = 1.5; g.strokeStyle = 'rgba(29,47,111,.22)'; g.stroke();
        // tufts
        g.strokeStyle = c.kind === 'flower' ? 'rgba(60,35,15,.25)' : 'rgba(42,110,60,.45)';
        g.lineWidth = 1.5; g.lineCap = 'round';
        c.tufts.forEach(function (t) {
          var tx = x + t[0] * s, ty = y + t[1] * s, th = s * 0.06 * t[2];
          g.beginPath();
          if (c.kind === 'flower') { g.arc(tx, ty, th * 0.35, 0, Math.PI * 2); }
          else { g.moveTo(tx - th * 0.6, ty - th); g.lineTo(tx, ty); g.lineTo(tx + th * 0.6, ty - th); g.moveTo(tx, ty); g.lineTo(tx, ty - th * 1.2); }
          g.stroke();
        });
        g.lineCap = 'butt';
      }

      function drawPipe(i, x, y, s) {
        var c = board.cells[i];
        var cx = x + s / 2, cy = y + s / 2, h = s / 2, pw = s * 0.25;
        var diff = Math.abs(c.turns - c.vis);
        var sc = 1 - 0.07 * Math.min(1, diff * 2);
        g.save();
        g.translate(cx, cy);
        g.rotate(c.vis * Math.PI / 2);
        g.scale(sc, sc);
        g.beginPath(); g.rect(-h, -h, s, s); g.clip();
        var m = c.base, dirs = [];
        for (var d = 0; d < 4; d++) if (m & (1 << d)) dirs.push(d);
        function strokeAll(width, color) {
          g.beginPath();
          dirs.forEach(function (d) { g.moveTo(0, 0); g.lineTo(DX[d] * (h + 2), DY[d] * (h + 2)); });
          g.lineWidth = width; g.strokeStyle = color; g.stroke();
        }
        g.lineCap = 'round'; g.lineJoin = 'round';
        strokeAll(pw + 5, INK);
        strokeAll(pw, PIPE);
        strokeAll(pw * 0.5, CHANNEL);
        // water
        var f = fill[i];
        if (f > 0 && fl && fl.ent[i] >= 0) {
          var e = ((fl.ent[i] - c.turns) % 4 + 4) % 4;
          var a = Math.min(1, f * 2), b2 = Math.max(0, f * 2 - 1);
          g.beginPath();
          g.moveTo(DX[e] * (h + 2), DY[e] * (h + 2));
          g.lineTo(DX[e] * (h + 2) * (1 - a), DY[e] * (h + 2) * (1 - a));
          if (b2 > 0) dirs.forEach(function (d) { if (d === e) return; g.moveTo(0, 0); g.lineTo(DX[d] * h * b2, DY[d] * h * b2); });
          g.lineWidth = pw * 0.5; g.strokeStyle = WATER; g.stroke();
          g.lineWidth = Math.max(1, pw * 0.12); g.strokeStyle = 'rgba(255,255,255,.55)'; g.stroke();
        }
        // flanges at the tile edge
        g.lineCap = 'butt';
        var fw = pw + 8, fd = Math.max(4, s * 0.075);
        dirs.forEach(function (d) {
          g.save(); g.rotate(d * Math.PI / 2);
          rr(-fw / 2, -h, fw, fd, 2);
          g.fillStyle = '#dfe6ef'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
          g.restore();
        });
        if (dirs.length === 1) {   // closed end: a round cap
          g.beginPath(); g.arc(0, 0, pw * 0.72, 0, Math.PI * 2);
          g.fillStyle = '#dfe6ef'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
          g.beginPath(); g.arc(0, 0, pw * 0.28, 0, Math.PI * 2);
          g.fillStyle = f >= 0.5 ? WATER : '#b9c6d9'; g.fill();
        }
        g.restore();
      }

      function drawFlower(i, x, y, s) {
        var c = board.cells[i], b = bloom[i];
        var cx = x + s / 2, base = y + s * 0.82;
        var pw = s * 0.25, h = s / 2;
        // water coming in from the neighbour pipe
        if (fl && fl.ent[i] >= 0 && fill[i] > 0) {
          var e = fl.ent[i], a = Math.min(1, fill[i]);
          var ex = x + h + DX[e] * h, ey = y + h + DY[e] * h;
          var tx = x + h + DX[e] * h * (1 - a * 0.55), ty = y + h + DY[e] * h * (1 - a * 0.55);
          g.lineCap = 'round';
          g.beginPath(); g.moveTo(ex, ey); g.lineTo(tx, ty);
          g.lineWidth = pw * 0.55 + 4; g.strokeStyle = INK; g.stroke();
          g.lineWidth = pw * 0.55; g.strokeStyle = WATER; g.stroke();
          g.lineCap = 'butt';
          g.beginPath(); g.ellipse(cx, base, s * 0.34 * a, s * 0.12 * a, 0, 0, Math.PI * 2);
          g.fillStyle = 'rgba(63,134,216,.45)'; g.fill();
        }
        // soil mound
        g.beginPath(); g.ellipse(cx, base, s * 0.3, s * 0.1, 0, 0, Math.PI * 2);
        g.fillStyle = mix('#6b4122', '#4a2c16', b); g.fill();
        g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
        // stem
        var wig = c.wiggle ? Math.max(0, 1 - (tNow - c.wiggle) / 0.6) : 0;
        var sway = Math.sin(tNow * 2 + i) * 0.06 * b + Math.sin(tNow * 25) * 0.25 * wig;
        var ang = (1 - b) * 1.25 + sway;
        var Ls = s * 0.58;
        var hx = cx + Math.sin(ang) * Ls * 0.62, hy = base - Ls * (0.42 + 0.58 * Math.cos(ang));
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(cx, base); g.quadraticCurveTo(cx, base - Ls * 0.55, hx, hy);
        g.lineWidth = Math.max(4, s * 0.075); g.strokeStyle = INK; g.stroke();
        g.lineWidth = Math.max(2, s * 0.045); g.strokeStyle = '#3fae5f'; g.stroke();
        // leaves
        [-1, 1].forEach(function (side) {
          g.save();
          g.translate(cx, base - Ls * 0.22);
          g.rotate(side * (0.9 + (1 - b) * 0.6));
          g.beginPath(); g.ellipse(0, -s * 0.08, s * 0.045, s * 0.09, 0, 0, Math.PI * 2);
          g.fillStyle = mix('#3fae5f', '#8a9a5a', 1 - b); g.fill();
          g.lineWidth = 1.8; g.strokeStyle = INK; g.stroke();
          g.restore();
        });
        // head
        g.save();
        g.translate(hx, hy);
        g.rotate(ang);
        var col = mix(c.color, '#a8968a', (1 - b) * 0.55);
        var petals = 6, plen = s * (0.075 + 0.07 * b), pwid = s * (0.05 + 0.03 * b), dist = s * (0.03 + 0.065 * b);
        for (var k = 0; k < petals; k++) {
          var a2 = k / petals * Math.PI * 2 + (1 - b) * 0.4;
          g.save(); g.rotate(a2);
          g.beginPath(); g.ellipse(0, -dist, pwid, plen, 0, 0, Math.PI * 2);
          g.fillStyle = col; g.fill(); g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke();
          g.restore();
        }
        var cr = s * (0.045 + 0.04 * b);
        g.beginPath(); g.arc(0, 0, cr, 0, Math.PI * 2);
        g.fillStyle = mix('#f2d21d', '#c9b26a', 1 - b); g.fill(); g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke();
        if (cr > 5) {   // tiny face
          g.rotate(-ang);
          g.fillStyle = INK; g.strokeStyle = INK; g.lineWidth = 1.3;
          if (b > 0.6) {
            g.beginPath(); g.arc(-cr * 0.35, -cr * 0.15, cr * 0.12, 0, Math.PI * 2); g.arc(cr * 0.35, -cr * 0.15, cr * 0.12, 0, Math.PI * 2); g.fill();
            g.beginPath(); g.arc(0, cr * 0.1, cr * 0.38, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
          } else {
            g.beginPath(); g.moveTo(-cr * 0.5, -cr * 0.1); g.lineTo(-cr * 0.2, -cr * 0.05); g.moveTo(cr * 0.2, -cr * 0.05); g.lineTo(cr * 0.5, -cr * 0.1); g.stroke();
          }
        }
        g.restore();
        g.lineCap = 'butt';
      }

      function drawBanner() {
        var t = tNow - winAt - bannerDelay();
        if (t < 0) { bannerBtn = null; return; }
        var k = Math.min(1, t / 0.3), e = 1 - Math.pow(1 - k, 3);
        g.fillStyle = 'rgba(29,47,111,' + (0.28 * e) + ')';
        g.fillRect(0, 0, W, H);
        var cw = Math.min(330, W - 32), ch = 240;
        var cx = (W - cw) / 2, cy = H / 2 - ch / 2 + (1 - e) * 40;
        g.globalAlpha = e;
        rr(cx, cy + 6, cw, ch, 22); g.fillStyle = 'rgba(29,47,111,.25)'; g.fill();
        rr(cx, cy, cw, ch, 22); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK;
        g.font = '38px ' + FONT;
        g.fillText(lastDrops === 3 ? 'Super!' : lastDrops === 2 ? 'Brawo!' : 'Udało się!', W / 2, cy + 36);
        for (var d = 0; d < 3; d++) {
          var pop = clamp((t - 0.25 - d * 0.18) / 0.25, 0, 1);
          var r = 17 * (d < lastDrops ? (pop < 1 ? 0.6 + 0.6 * Math.sin(pop * Math.PI / 2) : 1) : 1);
          drop(W / 2 + (d - 1) * 52, cy + 92, r, d < lastDrops && pop > 0);
        }
        g.font = '21px ' + FONT; g.fillStyle = MUTED;
        g.fillText('Obroty: ' + moves, W / 2, cy + 136);
        var label = packSummary ? 'Zobacz wynik' : 'Dalej';
        g.font = '26px ' + FONT;
        var bw = Math.max(150, g.measureText(label).width + 50), bh = 50;
        var bx = W / 2 - bw / 2, by = cy + ch - bh - 22;
        rr(bx, by + 4, bw, bh, 16); g.fillStyle = INK; g.fill();
        rr(bx, by, bw, bh, 16); g.fillStyle = GOLD; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
        g.fillStyle = '#2a1d00'; g.fillText(label, W / 2, by + bh / 2 + 1);
        g.globalAlpha = 1;
        bannerBtn = { x: bx, y: by, w: bw, h: bh };
      }

      function draw() {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, W, H);
        drawBackground();
        if (!board || !L) return;
        drawBoardFrame();
        drawTap();
        var s = L.s;
        for (var i = 0; i < board.cells.length; i++) {
          var x = L.gx + (i % L.N) * s, y = L.gy + (i / L.N | 0) * s;
          drawTileBg(i, x, y, s);
        }
        for (i = 0; i < board.cells.length; i++) {
          var c = board.cells[i];
          x = L.gx + (i % L.N) * s; y = L.gy + (i / L.N | 0) * s;
          if (c.kind === 'pipe') drawPipe(i, x, y, s);
        }
        for (i = 0; i < board.cells.length; i++) {
          if (board.cells[i].kind !== 'flower') continue;
          drawFlower(i, L.gx + (i % L.N) * s, L.gy + (i / L.N | 0) * s, s);
        }
        particles.forEach(function (p) {
          g.globalAlpha = 1 - p.t / p.life;
          g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fillStyle = p.color; g.fill();
        });
        g.globalAlpha = 1;
        drawHud();
        // hint under the board
        if (mode === 'play') {
          var hint = save.boards === 0 && moves < 4 ? 'Stuknij rurę, żeby ją obrócić.'
            : board.flowers.length > 1 ? 'Podlej wszystkie kwiatki!' : '';
          if (hint) {
            g.font = '20px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#2f5d2a';
            var hy = L.gy + s * L.N + L.frame + 18;
            if (hy < H - 8) g.fillText(hint, W / 2, hy);
          }
        }
        if (mode === 'won') drawBanner();
      }

      function loop(ts) {
        if (!alive) return;
        raf = requestAnimationFrame(loop);
        var t = ts / 1000;
        var dt = last ? Math.min(0.05, t - last) : 0;
        last = t;
        tNow += dt;
        step(dt);
        draw();
      }

      resize();
      showStartPanel();
      raf = requestAnimationFrame(loop);

      return {
        destroy: function () {
          alive = false;
          cancelAnimationFrame(raf);
          clearTimeout(endTimer);
          ro.disconnect();
          canvas.removeEventListener('pointerdown', onDown);
          if (panel) { try { panel.close(); } catch (e) {} panel = null; }
          canvas.remove();
          css.remove();
        },
        pause: function () { paused = true; cancelAnimationFrame(raf); raf = 0; },
        resume: function () {
          if (!alive || !paused) return;
          paused = false; last = 0;
          raf = requestAnimationFrame(loop);
        }
      };
    }
  });
})();
