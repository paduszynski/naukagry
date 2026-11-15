/* Rury do ogródka: obracaj rury, żeby woda z beczki doszła do kwiatków.
 * Plansze są budowane z rozwiązania (losowe drzewo rozpinające od kranu do kwiatków),
 * reszta pól to rury-zmyłki albo kamienie i kępki trawy, potem każda rura jest losowo obrócona,
 * więc plansza zawsze ma rozwiązanie.
 * 50 ★ = paczka 5 plansz na wybranym poziomie (Łatwe / Średnie / Trudne), 3 podpowiedzi na paczkę;
 * każda skończona paczka wysyła nasionko do Ogródka (Trudne czasem rzadkie).
 */
(function () {
  'use strict';

  var FONT = '"Patrick Hand", "Comic Sans MS", cursive';
  var INK = '#1d2f6f', GOLD = '#e3a008', PURPLE = '#7a4fc4', MUTED = '#5a6690';
  var WATER = '#3f86d8', WATER_HI = '#9cc9f5', CHANNEL = '#c9d6ea', PIPE = '#f4f7fb';
  var PACK = 5, PRICE = 50, HINTS = 3;
  var SPEED = 9;            // water speed, cells per second
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];   // N E S W, bit = 1 << d
  var FLOWER_COLORS = ['#e2533f', '#f28ab2', '#f2b51d', '#8a5cd0', '#f08a24', '#e86fae'];
  var PIC = '<g fill="#fff" stroke="#1d2f6f" stroke-width="2"><rect x="14" y="10" width="28" height="28"/><rect x="42" y="10" width="28" height="28"/><rect x="70" y="10" width="28" height="28"/><rect x="14" y="38" width="28" height="28"/><rect x="42" y="38" width="28" height="28"/><rect x="70" y="38" width="28" height="28"/></g><path d="M14 24 h42 v28 h28" fill="none" stroke="#3f86d8" stroke-width="6" stroke-linecap="round"/><path d="M84 52 v-28" stroke="#c9d6ea" stroke-width="6"/><circle cx="110" cy="48" r="5" fill="#e2533f"/><path d="M110 53 v14" stroke="#2a8a56" stroke-width="2.5"/>';

  function rotMask(m, k) { k = ((k % 4) + 4) % 4; while (k--) m = ((m << 1) | (m >> 3)) & 15; return m; }
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

  // ---------- difficulty ----------
  // Each level has a few gentle steps; the step grows every GROW boards solved on that level,
  // drops back after a slow board (ease) and the first board of a pack is one step easier.
  // N: board size, f2: chance of a 2nd flower, f3: chance of a 3rd (given 2),
  // k: how scrambled (x the base number of needed turns), st: share of spare cells that become stones/grass.
  var GROW = 4;
  var DIFFS = {
    e: { name: 'Łatwe', size: '4×4', fl: '1 kwiatek', color: '#8fd06b',
      relief: { N: 4, f2: 0, f3: 0, k: 0.6, st: 0, cap: 1.5 },
      steps: [{ N: 4, f2: 0, f3: 0, k: 0.75, st: 0, cap: 1.6 }, { N: 4, f2: 0, f3: 0, k: 0.9, st: 0, cap: 1.7 }, { N: 4, f2: 0, f3: 0, k: 1.05, st: 0, cap: 1.85 }, { N: 4, f2: 0, f3: 0, k: 1.2, st: 0, cap: 2 }] },
    m: { name: 'Średnie', size: '5×5', fl: 'do 2 kwiatków', color: '#f2b51d',
      relief: { N: 5, f2: 0, f3: 0, k: 0.7, st: 0.4, cap: 1.5 },
      steps: [{ N: 5, f2: 0, f3: 0, k: 0.85, st: 0.3, cap: 1.6 }, { N: 5, f2: 0, f3: 0, k: 1, st: 0.25, cap: 1.75 }, { N: 5, f2: 0.5, f3: 0, k: 1.1, st: 0.25, cap: 1.9 }, { N: 5, f2: 0.8, f3: 0, k: 1.2, st: 0.2, cap: 2.1 }] },
    h: { name: 'Trudne', size: '6×6, 7×7', fl: 'do 3 kwiatków', color: '#e2533f',
      relief: { N: 6, f2: 0.2, f3: 0, k: 0.85, st: 0.55, cap: 1.6 },
      steps: [{ N: 6, f2: 0.6, f3: 0, k: 1, st: 0.45, cap: 1.75 }, { N: 6, f2: 0.9, f3: 0, k: 1.1, st: 0.4, cap: 1.9 }, { N: 7, f2: 0.9, f3: 0.25, k: 1.1, st: 0.45, cap: 2.1 }, { N: 7, f2: 1, f3: 0.5, k: 1.2, st: 0.4, cap: 2.4 }] }
  };
  var DIFF_ORDER = ['e', 'm', 'h'];
  function paramsFor(d, step) {
    var D = DIFFS[d] || DIFFS.e;
    return step < 0 ? D.relief : D.steps[Math.min(step, D.steps.length - 1)];
  }
  // prog: boards solved on this level, ease: 0..2 after slow boards, idx: board number in the pack (0-based)
  function stepFor(d, prog, ease, idx) {
    var D = DIFFS[d] || DIFFS.e;
    var base = Math.min(D.steps.length - 1, Math.floor((prog || 0) / GROW));
    var warm = idx === 0 && prog > 0 ? 1 : 0;
    return Math.max(-1, base - (ease || 0) - warm);
  }
  // seed sent to Ogródek for a finished pack (ids from ogrodek.js PLANTS)
  var SEED_NAMES = { kwiatek: 'kwiatek', tulipan: 'tulipan', mak: 'mak', lawenda: 'lawenda', roza: 'róża', lilia: 'lilia', storczyk: 'storczyk', teczowy: 'tęczowy kwiat' };
  var RARE = ['roza', 'lilia', 'storczyk', 'teczowy'];
  function seedFor(d) {
    var r = Math.random();
    function pick(a) { return a[Math.random() * a.length | 0]; }
    if (d === 'h') return r < 0.3 ? pick(RARE) : pick(['tulipan', 'mak', 'lawenda']);
    if (d === 'm') return r < 0.6 ? 'kwiatek' : 'tulipan';
    return 'kwiatek';
  }

  // ---------- board generation ----------
  function generate(prm, seed) {
    var R = rng(seed);
    var N = prm.N, T = N * N;
    var nF = 1;
    if (R() < prm.f2) nF = 2;
    if (nF === 2 && R() < prm.f3) nF = 3;
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
    for (i = 0; i < T; i++) cells.push({ kind: 'pipe', base: 0, sol: false, turns: 0, vis: 0, d: dist[i] });
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
    // fewer decoys: some spare cells become stones or grass tufts (cannot be turned).
    // Cells next to the water path keep their decoy pipe more often, so the puzzle stays a puzzle.
    if (prm.st > 0) {
      cells.forEach(function (c, ci) {
        if (c.kind !== 'pipe' || c.sol) return;
        var near = false;
        for (var d = 0; d < 4; d++) { var v = nb(ci, d); if (v >= 0 && (cells[v].sol || cells[v].kind === 'flower')) near = true; }
        var pr = near ? prm.st * 0.6 : Math.min(0.85, prm.st * 1.4);
        if (R() < pr) {
          c.kind = R() < 0.5 ? 'rock' : 'grass';
          c.base = 0;
          c.rk = [];
          for (var k = 0; k < 7; k++) c.rk.push(0.82 + R() * 0.3);
          c.dz = R() < 0.35;
          c.sx = R() < 0.5 ? -1 : 1;
        }
      });
    }
    // grass tufts (static decoration)
    cells.forEach(function (c) {
      c.tufts = [];
      for (var t = 0; t < 3; t++) c.tufts.push([R() * 0.8 + 0.1, R() * 0.8 + 0.1, R() * 0.5 + 0.6]);
    });

    var board = { N: N, cells: cells, entry: entry, flowers: flowers, min: 0 };
    // scramble every pipe; keep it unsolved and with some work to do
    // need: fewest turns the child must make; cap: at most that many (easy steps leave some path pipes already right)
    var need = Math.max(3, Math.round((N * 1.2 + flowers.length) * (prm.k || 1)));
    var cap = prm.cap ? Math.max(need + 2, Math.round(need * prm.cap)) : 1e9;
    var solIdx = [];
    cells.forEach(function (c, ci) { if (c.kind === 'pipe' && c.sol) solIdx.push(ci); });
    for (var att = 0; att < 60; att++) {
      cells.forEach(function (c) { if (c.kind === 'pipe') c.turns = c.vis = R() * 4 | 0; });
      board.min = minMoves(board);
      for (var guard = 0; board.min > cap && guard < 200; guard++) {
        var pc = cells[solIdx[R() * solIdx.length | 0]];
        if (rotMask(pc.base, pc.turns) === pc.base) continue;
        pc.turns = pc.vis = 0;
        board.min = minMoves(board);
      }
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
    meta: { name: 'Rury do ogródka', price: '50 ★ za 5 plansz', bg: '#e8f6e4', pic: PIC, music: 'water' },
    medals: [
      { id: 'b10', stat: 'total', at: 10, tier: 1, text: '10 plansz' },
      { id: 'b50', stat: 'total', at: 50, tier: 2, text: '50 plansz' },
      { id: 'b150', stat: 'total', at: 150, tier: 3, text: '150 plansz' }
    ],
    quests: [
      { id: 'boards', stat: 'boards', n: [3, 5], text: 'Ułóż {n} {plansza} w Rurach', forms: ['planszę', 'plansze', 'plansz'] },
      { id: 'drops', stat: 'drops', n: [6, 10], text: 'Zbierz {n} kropli w Rurach' }
    ],
    stickers: [
      { id: 'hard-pack', emoji: '🏆', name: 'Pierwsza trudna paczka' },
      { id: 'no-hint', emoji: '🧠', name: 'Paczka bez podpowiedzi' },
      { id: 'full-can', emoji: '💧', name: 'Pełna konewka: 15 kropli' },
      { id: 'three', emoji: '🌷', name: 'Trzy kwiatki naraz' },
      { id: 'big', emoji: '🪨', name: 'Wielki ogród 7×7' }
    ],
    _test: { generate: generate, flow: flow, solvedNow: solvedNow, minMoves: minMoves, rotMask: rotMask, paramsFor: paramsFor, stepFor: stepFor, DIFFS: DIFFS },
    mount: function (el, ctx) {
      var save = ctx.load({ boards: 0, drops: 0, packs: 0, pack: null });
      // ---- migrate older saves (v1 had no levels, hints or per-level progress) ----
      if (typeof save.boards !== 'number') save.boards = 0;
      if (typeof save.drops !== 'number') save.drops = 0;
      if (typeof save.packs !== 'number') save.packs = 0;
      if (!DIFFS[save.diff]) save.diff = save.boards >= 5 ? 'm' : 'e';
      if (!save.prog || typeof save.prog !== 'object') save.prog = {};
      if (!save.ease || typeof save.ease !== 'object') save.ease = {};
      DIFF_ORDER.forEach(function (d) {
        if (typeof save.prog[d] !== 'number') save.prog[d] = 0;
        if (typeof save.ease[d] !== 'number') save.ease[d] = 0;
      });
      if (save.pack && typeof save.pack === 'object') {
        var pk = save.pack;
        if (!DIFFS[pk.diff]) pk.diff = save.boards >= 5 ? 'm' : 'e';
        if (typeof pk.hints !== 'number') pk.hints = HINTS;
        if (typeof pk.idx !== 'number') pk.idx = 0;
        if (!Array.isArray(pk.drops)) pk.drops = [];
        if (typeof pk.seed !== 'number') pk.seed = (Math.random() * 4294967296) >>> 0;
        if (pk.cur && pk.cur.v !== 2) pk.cur = null;   // v1 boards were built differently: start that board fresh
        if (pk.idx >= PACK) save.pack = null;
      } else save.pack = null;
      save.v = 2;
      ctx.save(save);
      // boards solved before medals existed still count towards them
      if (save.boards > (ctx.getStat('total') || 0)) ctx.stat('total', save.boards, 'max');

      var canvas = document.createElement('canvas');
      el.appendChild(canvas);
      // keep "Kolejne 5 plansz za 50 ★" on one line on 360px phones (scoped to this game's lifetime)
      var css = document.createElement('style');
      css.textContent = '.ng-panel .ng-btn{white-space:nowrap}@media (max-width:400px){.ng-panel .ng-btn:not(.sec){font-size:1.32rem;padding-left:12px;padding-right:12px}}' +
        '.rr-pick{display:flex;flex-direction:column;gap:6px}' +
        '.rr-opts{display:flex;gap:6px;justify-content:center}' +
        '.rr-opt{flex:1 1 0;min-width:0;min-height:64px;font:inherit;color:#1d2f6f;background:#fff;border:3px solid #1d2f6f;border-radius:16px;padding:6px 4px 5px;' +
        'box-shadow:0 3px 0 #1d2f6f;display:flex;flex-direction:column;align-items:center;gap:1px;cursor:pointer;line-height:1.05}' +
        '.rr-opt b{font-weight:400;font-size:1.3rem}.rr-opt small{font-size:.95rem;color:#5a6690}' +
        '.rr-opt i{display:block;width:26px;height:6px;border-radius:3px;margin-bottom:3px;border:1.5px solid #1d2f6f}' +
        '.rr-opt.on{background:#fff4cf;border-color:#1d2f6f;box-shadow:0 1px 0 #1d2f6f;transform:translateY(2px);outline:3px solid #e3a008;outline-offset:1px}' +
        '.rr-opt:active{transform:translateY(3px);box-shadow:0 0 0 #1d2f6f}' +
        '.rr-cap{font-size:1.05rem;color:#5a6690;margin:0}' +
        '@media (max-width:370px){.rr-opt b{font-size:1.15rem}.rr-opt small{font-size:.85rem}}';
      el.appendChild(css);
      var reduced = false;
      try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
      var g = canvas.getContext('2d');
      var W = 0, H = 0, dpr = 1, L = null;
      var board = null, fill = [], prevEnt = [], bloom = [], bloomed = [], fl = null;
      var mode = 'menu';          // menu | play | won
      var moves = 0, playTime = 0, hinted = false, winAt = 0, lastDrops = 0, packSummary = null, easierNext = false;
      var particles = [], panel = null, panelObs = null, raf = 0, last = 0, paused = false, alive = true, tNow = 0;
      var bannerBtn = null, hintBtn = null, curIdx = 0, endTimer = 0, lastWaterSfx = -9, hintGlow = null;

      function persist() { ctx.save(save); }

      // ---------- layout ----------
      function layout() {
        if (!board) return;
        var N = board.N, pad = 8, frame = 8, hud = 50, bottom = 84;
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
        particles = []; hintGlow = null;
        layout();
      }
      function boardSeed() { return (save.pack.seed + save.pack.idx * 7919) >>> 0; }
      function startBoard() {
        var P = save.pack, d = P.diff, cur = P.cur;
        var resume = cur && cur.v === 2 && cur.idx === P.idx && typeof cur.step === 'number';
        var step = resume ? cur.step : stepFor(d, save.prog[d], save.ease[d], P.idx);
        var b = generate(paramsFor(d, step), boardSeed());
        b.step = step;
        if (resume && cur.turns && cur.turns.length === b.cells.length) {
          b.cells.forEach(function (c, i) { if (c.kind === 'pipe') c.turns = c.vis = cur.turns[i] || 0; });
          moves = cur.moves || 0; playTime = cur.time || 0; hinted = !!cur.hinted;
        } else {
          moves = 0; playTime = 0; hinted = false;
        }
        setBoard(b);
        mode = 'play';
        curIdx = P.idx + 1;
        bannerBtn = null;
        saveCur();
      }
      function newPack(d) {
        save.diff = d;
        save.pack = { v: 2, diff: d, seed: (Math.random() * 4294967296) >>> 0, idx: 0, drops: [], hints: HINTS, cur: null };
        persist();
        startBoard();
      }
      function saveCur() {
        if (!save.pack || !board || mode !== 'play') return;
        save.pack.cur = { v: 2, idx: save.pack.idx, step: board.step, moves: moves, time: Math.round(playTime), hinted: hinted,
          turns: board.cells.map(function (c) { return ((c.turns % 4) + 4) % 4; }) };
        persist();
      }
      function sendSeed(kind) {
        try {
          var key = 'naukagry.ogrodek.inbox', arr = [];
          try { arr = JSON.parse(localStorage.getItem(key)) || []; } catch (e) { arr = []; }
          if (!Array.isArray(arr)) arr = [];
          arr.push({ kind: kind, n: 1, from: 'rury' });
          localStorage.setItem(key, JSON.stringify(arr));
        } catch (e) {}
      }
      function onWin() {
        mode = 'won';
        winAt = tNow;
        ctx.sfx('win');
        var P = save.pack, d = P.diff;
        lastDrops = dropsFor(moves, board.min);
        // adapt: a long or tiring board makes the next one a bit easier, a quick clean one undoes that
        var slow = playTime > 90 || moves > Math.max(20, Math.round(board.min * 2.5) + 6);
        var quick = playTime < 40 && moves <= Math.round(board.min * 1.6) + 4 && !hinted;
        easierNext = false;
        if (slow) { if (save.ease[d] < 2) easierNext = true; save.ease[d] = Math.min(2, save.ease[d] + 1); }
        else if (quick) save.ease[d] = Math.max(0, save.ease[d] - 1);
        save.prog[d] += 1;
        save.boards += 1;
        save.drops += lastDrops;
        P.drops.push(lastDrops);
        P.idx += 1;
        P.cur = null;
        var nFl = board.flowers.length, bigBoard = board.N >= 7;
        if (P.idx >= PACK) {
          var sum = P.drops.reduce(function (a, b) { return a + b; }, 0);
          var kind = seedFor(d);
          packSummary = { drops: sum, seed: kind, diff: d, hintsUsed: HINTS - P.hints };
          save.packs += 1;
          save.pack = null;
          easierNext = false;
          sendSeed(kind);
        } else packSummary = null;
        persist();
        ctx.stat('boards', 1);
        ctx.stat('drops', lastDrops);
        ctx.stat('total', save.boards, 'max');
        if (nFl >= 3) ctx.sticker('three');
        if (bigBoard) ctx.sticker('big');
        if (packSummary) {
          if (packSummary.diff === 'h') ctx.sticker('hard-pack');
          if (packSummary.hintsUsed === 0) ctx.sticker('no-hint');
          if (packSummary.drops >= PACK * 3) ctx.sticker('full-can');
        }
      }
      function afterBanner() {
        ctx.sfx('click');
        if (packSummary) {
          mode = 'menu';      // short pause so a double tap cannot hit the buy button
          endTimer = setTimeout(function () { endTimer = 0; if (alive) showEndPanel(); }, 400);
        } else startBoard();
      }

      // ---------- hint ----------
      function useHint() {
        if (mode !== 'play' || !save.pack) return;
        if (save.pack.hints <= 0) { ctx.sfx('tap'); ctx.toast('W tej paczce nie ma już podpowiedzi.'); return; }
        var best = -1, need = 0;
        board.cells.forEach(function (c, i) {
          if (c.kind !== 'pipe' || !c.sol) return;
          var cur = rotMask(c.base, c.turns);
          if (cur === c.base) return;
          if (best < 0 || c.d < board.cells[best].d) {
            best = i;
            for (var k = 1; k < 4; k++) if (rotMask(cur, k) === c.base) { need = k; break; }
          }
        });
        if (best < 0) return;
        var c = board.cells[best];
        c.turns += need;
        save.pack.hints -= 1;
        hinted = true;
        hintGlow = { i: best, t: tNow };
        ctx.sfx('whoosh');
        if (!reduced && L) {
          var x = L.gx + (best % L.N + 0.5) * L.s, y = L.gy + ((best / L.N | 0) + 0.5) * L.s;
          for (var j = 0; j < 10; j++) {
            var a = j / 10 * Math.PI * 2, sp = 60 + Math.random() * 40;
            particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, t: 0, life: 0.7, color: j % 2 ? GOLD : '#fff3b0', r: 3 });
          }
        }
        saveCur();
      }

      // ---------- panels ----------
      function closePanel() {
        if (panelObs) { panelObs.disconnect(); panelObs = null; }
        if (panel) { try { panel.close(); } catch (e) {} panel = null; }
      }
      function demoBoard(d) {
        var b = generate(paramsFor(d || save.diff, 0), 12345 + save.boards);
        b.step = 0;
        setBoard(b);
        mode = 'menu';
      }
      // level picker placed inside the shared panel card (re-added if the card rebuilds, e.g. after a wallet change)
      function makePicker() {
        var box = document.createElement('div');
        box.className = 'rr-pick';
        var row = document.createElement('div');
        row.className = 'rr-opts';
        var cap = document.createElement('p');
        cap.className = 'rr-cap';
        var btns = {};
        function refresh() {
          DIFF_ORDER.forEach(function (d) { btns[d].classList.toggle('on', d === save.diff); btns[d].setAttribute('aria-pressed', d === save.diff ? 'true' : 'false'); });
          cap.textContent = save.diff === 'h' ? 'Nagroda: nasionko, czasem rzadkie ✦'
            : save.diff === 'm' ? 'Nagroda: nasionko kwiatka albo tulipana' : 'Nagroda: nasionko kwiatka';
        }
        DIFF_ORDER.forEach(function (d) {
          var D = DIFFS[d], b = document.createElement('button');
          b.type = 'button'; b.className = 'rr-opt';
          b.innerHTML = '<i style="background:' + D.color + '"></i><b>' + D.name + '</b><small>' + D.size + '</small><small>' + D.fl + '</small>';
          b.onclick = function () {
            if (save.diff === d) return;
            save.diff = d; persist(); refresh();
            ctx.sfx('tap');
            demoBoard(d);
          };
          btns[d] = b;
          row.appendChild(b);
        });
        box.appendChild(row);
        box.appendChild(cap);
        refresh();
        return box;
      }
      function attachPicker(p) {
        var card = p && p.el && p.el.firstChild;
        if (!card) return;
        var picker = makePicker();
        function place() {
          if (picker.parentNode === card) return;
          var before = card.querySelector('.ng-btn:not(.sec)') || card.querySelector('.ng-poor') || card.querySelector('.ng-row');
          if (before) card.insertBefore(picker, before); else card.appendChild(picker);
        }
        place();
        panelObs = new MutationObserver(place);
        panelObs.observe(card, { childList: true });
      }
      function statsLine() {
        return { text: 'Plansze: ' + save.boards + ' · Krople: ' + save.drops, muted: true };
      }
      function showStartPanel() {
        closePanel();
        demoBoard(save.pack ? save.pack.diff : save.diff);
        curIdx = save.pack && save.pack.idx < PACK ? save.pack.idx + 1 : 0;
        if (save.pack && save.pack.idx < PACK) {
          panel = ctx.panel({
            title: 'Rury do ogródka', medals: true,
            lines: ['Masz zaczętą paczkę.', DIFFS[save.pack.diff].name + ' · plansza ' + (save.pack.idx + 1) + '/' + PACK, statsLine()],
            button: 'Graj dalej',
            onPlay: function () { closePanel(); startBoard(); },
            secondary: [{ label: 'Wróć do gier', onClick: function () { ctx.exit(); } }]
          });
        } else {
          panel = ctx.panel({
            title: 'Rury do ogródka', medals: true,
            lines: ['Obracaj rury, żeby woda doszła do kwiatków.', 'Wybierz poziom:'],
            price: PRICE, note: PACK + ' plansz',
            button: PACK + ' plansz',
            onPlay: function () { closePanel(); newPack(save.diff); },
            secondary: [{ label: 'Wróć do gier', onClick: function () { ctx.exit(); } }]
          });
          attachPicker(panel);
        }
      }
      function showEndPanel() {
        closePanel();
        mode = 'menu';
        curIdx = 0;
        ctx.sfx('plant');
        var d = packSummary ? packSummary.drops : 0, kind = packSummary ? packSummary.seed : 'kwiatek';
        panel = ctx.panel({
          title: 'Kwiatki podlane!', medals: true,
          big: d + ' / ' + (PACK * 3),
          lines: [
            'Zebrane krople w tej paczce.',
            'Ogródek dostał nasionko: ' + SEED_NAMES[kind] + (RARE.indexOf(kind) >= 0 ? ' ✦' : '') + '.',
            { text: 'Razem: ' + save.boards + ' ' + plural(save.boards, 'plansza', 'plansze', 'plansz') + ', ' + save.drops + ' ' + plural(save.drops, 'kropla', 'krople', 'kropel'), muted: true }
          ],
          price: PRICE, note: PACK + ' plansz',
          button: 'Kolejne ' + PACK + ' plansz',
          onPlay: function () { closePanel(); newPack(save.diff); },
          secondary: [{ label: 'Wróć do gier', onClick: function () { ctx.exit(); } }]
        });
        attachPicker(panel);
      }

      // ---------- input ----------
      function hit(r, x, y, m) { return r && x >= r.x - m && x <= r.x + r.w + m && y >= r.y - m && y <= r.y + r.h + m; }
      function onDown(ev) {
        if (!board || !L) return;
        var r = canvas.getBoundingClientRect();
        var x = ev.clientX - r.left, y = ev.clientY - r.top;
        if (mode === 'won') {
          if (bannerBtn && tNow - winAt > bannerDelay() + 0.25 && hit(bannerBtn, x, y, 6)) {
            bannerBtn = null;
            afterBanner();
          }
          return;
        }
        if (mode !== 'play') return;
        if (hit(hintBtn, x, y, 4)) { useHint(); return; }
        var cx = Math.floor((x - L.gx) / L.s), cy = Math.floor((y - L.gy) / L.s);
        if (cx < 0 || cy < 0 || cx >= L.N || cy >= L.N) return;
        var i = cy * L.N + cx, c = board.cells[i];
        if (c.kind !== 'pipe') { c.wiggle = tNow; ctx.sfx('tap'); return; }
        c.turns += 1;
        moves += 1;
        ctx.sfx('rotate');
        saveCur();
      }
      canvas.addEventListener('pointerdown', onDown);

      // ---------- simulation ----------
      function bannerDelay() { return 1.1; }
      function step(dt) {
        if (!board) return;
        if (mode === 'play') playTime += dt;
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
        var T = board.cells.length, i, newWater = false;
        var conn = [];
        for (i = 0; i < T; i++) conn.push(false);
        for (var k = 0; k < fl.order.length; k++) {
          var cI = fl.order[k], p = fl.par[cI];
          conn[cI] = true;
          if (fl.ent[cI] !== prevEnt[cI]) fill[cI] = 0;
          var parentFull = p === -1 || fill[p] >= 1;
          if (parentFull) { if (fill[cI] === 0 && p !== -1) newWater = true; fill[cI] = Math.min(1, fill[cI] + dt * SPEED); }
        }
        for (i = 0; i < T; i++) { if (!conn[i]) fill[i] = 0; prevEnt[i] = fl.ent[i]; }
        if (newWater && mode === 'play' && tNow - lastWaterSfx > 0.8) { lastWaterSfx = tNow; ctx.sfx('water'); }
        var allBloom = true;
        board.flowers.forEach(function (f) {
          var target = fill[f] >= 1 ? 1 : 0;
          bloom[f] = clamp(bloom[f] + (target ? dt * 1.6 : -dt * 2.5), 0, 1);
          if (bloom[f] > 0.9 && !bloomed[f]) { bloomed[f] = true; burst(f); if (mode === 'play') ctx.sfx('splash'); }
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
        for (var i = 0; i < (reduced ? 5 : 12); i++) {
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

      function drawRock(i, x, y, s) {
        var c = board.cells[i], cx = x + s / 2, cy = y + s * 0.56, rad = s * 0.3;
        var wig = c.wiggle ? Math.max(0, 1 - (tNow - c.wiggle) / 0.4) : 0;
        g.save();
        g.translate(cx + Math.sin(tNow * 40) * wig * s * 0.03, cy);
        // shadow
        g.beginPath(); g.ellipse(0, rad * 0.62, rad * 1.05, rad * 0.28, 0, 0, Math.PI * 2);
        g.fillStyle = 'rgba(29,47,111,.18)'; g.fill();
        function blob(r0, sq) {
          g.beginPath();
          var n = c.rk.length;
          for (var k = 0; k <= n; k++) {
            var a = k / n * Math.PI * 2, rr2 = r0 * c.rk[k % n];
            var px = Math.cos(a) * rr2 * 1.12, py = Math.sin(a) * rr2 * sq;
            if (k === 0) g.moveTo(px, py);
            else {
              var am = (k - 0.5) / n * Math.PI * 2, rm = r0 * (c.rk[k % n] + c.rk[k - 1]) / 2 * 1.06;
              g.quadraticCurveTo(Math.cos(am) * rm * 1.12, Math.sin(am) * rm * sq, px, py);
            }
          }
          g.closePath();
        }
        blob(rad, 0.78);
        g.fillStyle = '#a9b3c1'; g.fill();
        g.save(); g.clip();
        g.beginPath(); g.ellipse(rad * 0.15, rad * 0.55, rad * 1.3, rad * 0.5, 0, 0, Math.PI * 2);
        g.fillStyle = '#8b96a8'; g.fill();
        if (c.dz) { g.beginPath(); g.ellipse(-rad * 0.35, -rad * 0.62, rad * 0.55, rad * 0.25, -0.2, 0, Math.PI * 2); g.fillStyle = '#6fb552'; g.fill(); }
        g.restore();
        blob(rad, 0.78);
        g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
        g.beginPath(); g.ellipse(-rad * 0.38, -rad * 0.22, rad * 0.22, rad * 0.11, -0.5, 0, Math.PI * 2);
        g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
        g.beginPath(); g.moveTo(rad * 0.25, -rad * 0.15); g.lineTo(rad * 0.42, rad * 0.08); g.lineTo(rad * 0.33, rad * 0.25);
        g.lineWidth = 1.5; g.strokeStyle = 'rgba(29,47,111,.45)'; g.stroke();
        // pebble
        g.beginPath(); g.ellipse(c.sx * rad * 1.05, rad * 0.55, rad * 0.24, rad * 0.16, 0, 0, Math.PI * 2);
        g.fillStyle = '#c3cbd6'; g.fill(); g.lineWidth = 1.8; g.strokeStyle = INK; g.stroke();
        g.restore();
      }
      function drawGrass(i, x, y, s) {
        var c = board.cells[i], cx = x + s / 2, base = y + s * 0.78;
        var wig = c.wiggle ? Math.max(0, 1 - (tNow - c.wiggle) / 0.6) : 0;
        var sway = Math.sin(tNow * 1.6 + i) * 0.04 + Math.sin(tNow * 22) * 0.18 * wig;
        g.beginPath(); g.ellipse(cx, base, s * 0.3, s * 0.07, 0, 0, Math.PI * 2);
        g.fillStyle = 'rgba(42,110,60,.3)'; g.fill();
        var blades = 7;
        for (var k = 0; k < blades; k++) {
          var t = k / (blades - 1) - 0.5;                    // -0.5 .. 0.5
          var hgt = s * (0.36 + 0.2 * (1 - Math.abs(t) * 2)) * c.rk[k % c.rk.length];
          var lean = t * 1.1 + sway;
          var bx = cx + t * s * 0.42, wdt = s * 0.07;
          var tx = bx + Math.sin(lean) * hgt, ty = base - Math.cos(lean) * hgt;
          g.beginPath();
          g.moveTo(bx - wdt, base);
          g.quadraticCurveTo(bx - wdt * 0.4 + (tx - bx) * 0.3, base - hgt * 0.55, tx, ty);
          g.quadraticCurveTo(bx + wdt * 0.4 + (tx - bx) * 0.3, base - hgt * 0.5, bx + wdt, base);
          g.closePath();
          g.fillStyle = k % 2 ? '#4fa04a' : '#3d8c41'; g.fill();
          g.lineWidth = 1.8; g.lineJoin = 'round'; g.strokeStyle = INK; g.stroke();
        }
        if (c.dz) {   // a tiny daisy
          var dx = cx + c.sx * s * 0.16, dy = base - s * 0.42;
          for (var p = 0; p < 5; p++) {
            var a = p / 5 * Math.PI * 2;
            g.beginPath(); g.arc(dx + Math.cos(a) * s * 0.045, dy + Math.sin(a) * s * 0.045, s * 0.035, 0, Math.PI * 2);
            g.fillStyle = '#fff'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = INK; g.stroke();
          }
          g.beginPath(); g.arc(dx, dy, s * 0.03, 0, Math.PI * 2); g.fillStyle = '#f2c21d'; g.fill(); g.stroke();
        }
      }
      function drawHintGlow() {
        if (!hintGlow) return;
        var t = tNow - hintGlow.t;
        if (t > 1.4) { hintGlow = null; return; }
        var i = hintGlow.i, s = L.s, x = L.gx + (i % L.N) * s, y = L.gy + (i / L.N | 0) * s;
        var a = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 1.2;
        var grow = reduced ? 0 : Math.sin(t * 9) * 2;
        g.globalAlpha = clamp(a, 0, 1);
        rr(x + 1 - grow, y + 1 - grow, s - 2 + grow * 2, s - 2 + grow * 2, Math.max(6, s * 0.16));
        g.lineWidth = 5; g.strokeStyle = GOLD; g.stroke();
        g.lineWidth = 2; g.strokeStyle = '#fff6c8'; g.stroke();
        g.globalAlpha = 1;
      }
      function drawBulb(x, y, r, on) {
        if (on) {
          g.strokeStyle = GOLD; g.lineWidth = 2.2; g.lineCap = 'round';
          for (var k = -2; k <= 2; k++) {
            var a = -Math.PI / 2 + k * 0.62;
            g.beginPath(); g.moveTo(x + Math.cos(a) * r * 1.35, y - r * 0.15 + Math.sin(a) * r * 1.35); g.lineTo(x + Math.cos(a) * r * 1.8, y - r * 0.15 + Math.sin(a) * r * 1.8); g.stroke();
          }
          g.lineCap = 'butt';
        }
        g.beginPath();
        g.arc(x, y - r * 0.15, r, Math.PI * 0.78, Math.PI * 2.22);
        g.lineTo(x + r * 0.42, y + r * 0.95); g.lineTo(x - r * 0.42, y + r * 0.95); g.closePath();
        g.fillStyle = on ? '#ffe066' : '#e3e7ef'; g.fill();
        g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke();
        rr(x - r * 0.45, y + r * 0.95, r * 0.9, r * 0.55, 2);
        g.fillStyle = on ? '#9aa6b8' : '#c3c9d4'; g.fill(); g.lineWidth = 2; g.stroke();
        if (on) { g.beginPath(); g.ellipse(x - r * 0.38, y - r * 0.4, r * 0.16, r * 0.28, 0.5, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.8)'; g.fill(); }
      }
      function drawHintBtn() {
        if (mode !== 'play' || !save.pack) { hintBtn = null; return; }
        var left = save.pack.hints, bh = 48, bw = 104;
        var bx = Math.round(W / 2 - bw / 2), by = Math.round(L.gy + L.s * L.N + L.frame + 10);
        if (by + bh > H - 2) by = H - 2 - bh;
        var pulse = hintGlow ? Math.max(0, 1 - (tNow - hintGlow.t) / 0.25) * 3 : 0;
        rr(bx, by + 4, bw, bh, 18); g.fillStyle = INK; g.fill();
        rr(bx, by + pulse, bw, bh, 18); g.fillStyle = left > 0 ? '#fffbe6' : '#f1f3f8'; g.fill();
        g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
        drawBulb(bx + 32, by + pulse + bh / 2 - 1, 10, left > 0);
        g.font = '26px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = left > 0 ? INK : MUTED;
        g.fillText('×' + left, bx + 72, by + pulse + bh / 2 + 1);
        hintBtn = { x: bx, y: by, w: bw, h: bh + 4 };
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
        var cw = Math.min(330, W - 32), ch = easierNext ? 266 : 240;
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
        if (easierNext) { g.font = '19px ' + FONT; g.fillText('Następna będzie łatwiejsza.', W / 2, cy + 164); }
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
          else if (c.kind === 'rock') drawRock(i, x, y, s);
          else if (c.kind === 'grass') drawGrass(i, x, y, s);
        }
        drawHintGlow();
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
        drawHintBtn();
        // hint text under the bulb button
        if (mode === 'play') {
          var hint = save.boards === 0 && moves < 4 ? 'Stuknij rurę, żeby ją obrócić.'
            : board.flowers.length > 1 ? 'Podlej wszystkie kwiatki!' : '';
          if (hint && hintBtn) {
            g.font = '20px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#2f5d2a';
            var hy = hintBtn.y + hintBtn.h + 14;
            if (hy < H - 8) g.fillText(hint, W / 2, hy);
          }
        }
        if (mode === 'won') drawBanner();
      }

      // read-only peek for automated tests
      var testApi = NG.impl.rury && NG.impl.rury._test;
      if (testApi) testApi.state = function () { return { mode: mode, winAt: winAt, tNow: tNow, moves: moves, time: playTime, hints: save.pack ? save.pack.hints : 0 }; };
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
          if (mode === 'play') saveCur();
          alive = false;
          cancelAnimationFrame(raf);
          clearTimeout(endTimer);
          ro.disconnect();
          canvas.removeEventListener('pointerdown', onDown);
          closePanel();
          if (testApi) testApi.state = null;
          canvas.remove();
          css.remove();
        },
        pause: function () { paused = true; cancelAnimationFrame(raf); raf = 0; if (mode === 'play') saveCur(); },
        resume: function () {
          if (!alive || !paused) return;
          paused = false; last = 0;
          raf = requestAnimationFrame(loop);
        }
      };
    }
  });
})();
