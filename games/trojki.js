/* Grządkowe trójki: match-3 on a raised garden bed.
 * Swap neighbouring vegetables to line up 3+. Specials: 4 in a line -> pszczoła (clears its row/column),
 * L/T -> kret (3x3), 5 in a line -> tęczowa konewka (swap with any tile: clears that kind).
 * 30 hand-made levels, then generated ones. 40 ★ per attempt; a fail with more than half the goal refunds 20 ★.
 * A won level sends up to 2 seeds to Ogródek (localStorage 'naukagry.ogrodek.inbox').
 * Board logic (Board, playMove, levelDef) has no DOM and is exposed as NG.impl.trojki.core for tests.
 */
(function () {
  'use strict';
  var INK = '#1d2f6f', GOLD = '#e3a008', LVL = '#7a4fc4', RED = '#cf412d', GREEN = '#2a8a56', MUTED = '#5a6690';
  var FONT = '"Patrick Hand","Comic Sans MS",cursive';
  var PRICE = 40, REFUND = 20, INBOX = 'naukagry.ogrodek.inbox';

  var KINDS = [
    { id: 'marchewka', seed: 'marchewka', forms: ['marchewka', 'marchewki', 'marchewek'], col: '#f07f22' },
    { id: 'pomidor', seed: 'pomidor', forms: ['pomidor', 'pomidory', 'pomidorów'], col: '#e2453a' },
    { id: 'salata', seed: 'salata', forms: ['sałata', 'sałaty', 'sałat'], col: '#5fb94a' },
    { id: 'winogrono', seed: 'winogrono', forms: ['winogrono', 'winogrona', 'winogron'], col: '#8a5cd0' },
    { id: 'kukurydza', seed: 'kukurydza', forms: ['kolba kukurydzy', 'kolby kukurydzy', 'kolb kukurydzy'], col: '#f2c81d' },
    { id: 'dynia', seed: null, forms: ['dynia', 'dynie', 'dyń'], col: '#f39a33' }
  ];
  var WEED_FORMS = ['chwast', 'chwasty', 'chwastów'];
  var SEED_GEN = { marchewka: 'marchewki', pomidor: 'pomidora', salata: 'sałaty', winogrono: 'winogrona', kukurydza: 'kukurydzy', kwiatek: 'kwiatka' };
  var WEED = -2, RAIN = -1;

  function plural(forms, n) {
    if (n === 1) return forms[0];
    var d = n % 10, h = n % 100;
    return (d >= 2 && d <= 4 && (h < 12 || h > 14)) ? forms[1] : forms[2];
  }
  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---------- levels ----------
  // map rows: '.' cell, '#' no cell, 'w' weed, 'W' thick weed (2 hits). Goals: 'kind:n', 'chwast' = all weeds on the map.
  var CORNERS = ['##....##', '#......#', '........', '........', '........', '........', '#......#', '##....##'];
  var HOLE = ['........', '........', '........', '...##...', '...##...', '........', '........', '........'];
  var PLUS = ['##....##', '##....##', '........', '........', '........', '........', '##....##', '##....##'];
  var WAIST = ['........', '........', '#......#', '##....##', '##....##', '#......#', '........', '........'];
  var CORNERS7 = ['#.....#', '.......', '.......', '.......', '.......', '.......', '#.....#'];

  function L(s, k, m, g, map) { return { size: s, kinds: k, moves: m, goals: g, map: map || null }; }
  var LEVELS = [
    L(7, 5, 20, 'marchewka:10'),
    L(7, 5, 20, 'pomidor:15'),
    L(7, 5, 22, 'salata:12 winogrono:12'),
    L(7, 5, 22, 'kukurydza:20', CORNERS7),
    L(7, 5, 24, 'marchewka:16 pomidor:16'),
    L(8, 5, 24, 'winogrono:24'),
    L(8, 5, 24, 'salata:18 kukurydza:18', CORNERS),
    L(8, 5, 24, 'marchewka:28'),
    L(8, 5, 25, 'pomidor:20 winogrono:20', HOLE),
    L(8, 5, 26, 'chwast', ['........', '........', '........', '........', '........', '........', '.w....w.', 'ww.ww.ww']),
    L(8, 5, 25, 'marchewka:22 chwast', ['........', '........', '........', '..w..w..', '........', '........', '........', 'w..ww..w']),
    L(8, 5, 25, 'kukurydza:22 salata:22', PLUS),
    L(8, 6, 26, 'dynia:14'),
    L(8, 6, 27, 'winogrono:14 chwast', ['##....##', '#......#', '........', '........', '........', '.w....w.', '#w....w#', '##w..w##']),
    L(8, 6, 28, 'marchewka:20 kukurydza:20'),
    L(8, 6, 30, 'chwast', ['........', '........', '........', '........', '........', 'W......W', '.w....w.', '..w..w..']),
    L(8, 6, 27, 'pomidor:18 dynia:12', HOLE),
    L(8, 6, 30, 'salata:14 chwast', ['........', '........', '.w....w.', '........', '........', '........', 'w......w', 'w..W...w']),
    L(8, 6, 27, 'winogrono:20', WAIST),
    L(8, 6, 28, 'marchewka:18 pomidor:18', PLUS),
    L(8, 6, 30, 'chwast', ['........', '........', '........', 'w......w', '........', '..w..w..', '........', 'w..WW..w']),
    L(8, 6, 29, 'kukurydza:16 chwast', ['##....##', '#......#', '........', '........', '..W..W..', '........', '#w....w#', '##wwww##']),
    L(8, 6, 27, 'dynia:16 salata:20', CORNERS),
    L(8, 6, 30, 'winogrono:14 chwast', ['........', '........', '........', '...WW...', '........', 'w......w', '........', 'w.w..w.w']),
    L(8, 6, 29, 'marchewka:22', HOLE),
    L(8, 6, 29, 'pomidor:20 kukurydza:20', ['##....##', '#......#', '........', '........', '........', 'w......w', '#w....w#', '##wwww##']),
    L(8, 6, 30, 'chwast', ['........', '........', '..w..w..', '........', 'W......W', '........', 'w......w', 'w..ww..w']),
    L(8, 6, 28, 'salata:20 dynia:14', WAIST),
    L(8, 6, 30, 'winogrono:18 chwast', ['##....##', '##....##', '........', '...ww...', '..w..w..', '........', '##W..W##', '##w..w##']),
    L(8, 6, 30, 'marchewka:18 pomidor:18 chwast', ['........', '........', '........', 'w......w', '........', '..W..W..', 'w......w', '.w.ww.w.'])
  ];
  var SHAPES = [null, null, CORNERS, HOLE, PLUS, WAIST];

  // after level 30: gentle ramp, same level number always gives the same level
  function genLevel(n) {
    var rnd = mulberry(n * 7919 + 13), t = Math.min(1, (n - 30) / 80);
    var breather = n % 5 === 0, weeds = n % 2 === 0 && !breather;
    var shape = SHAPES[Math.floor(rnd() * SHAPES.length)];
    var rows = [], r, c;
    for (r = 0; r < 8; r++) rows.push((shape ? shape[r] : '........').split(''));
    var nw = 0;
    if (weeds) {
      var spots = [];
      for (r = 4; r < 8; r++) for (c = 0; c < 8; c++) if (rows[r][c] === '.') spots.push([r, c]);
      var want = 4 + Math.round(t * 4 + rnd() * 2);
      while (nw < want && spots.length) {
        var sp = spots.splice(Math.floor(rnd() * spots.length), 1)[0];
        rows[sp[0]][sp[1]] = rnd() < 0.1 + t * 0.15 ? 'W' : 'w'; nw++;
      }
    }
    var pool = [0, 1, 2, 3, 4], a = pool.splice(Math.floor(rnd() * pool.length), 1)[0], b = pool[Math.floor(rnd() * pool.length)];
    var moves = breather ? 28 : 28 + (shape && nw ? 2 : 0), goals;
    if (nw) goals = rnd() < 0.5 ? 'chwast' : KINDS[a].id + ':' + Math.round(12 + t * 4) + ' chwast';
    else if (rnd() < 0.4) goals = KINDS[a].id + ':' + Math.round((breather ? 28 : 20) + t * (breather ? 6 : 4));
    else goals = KINDS[a].id + ':' + Math.round((breather ? 22 : 16) + t * 3) + ' ' + KINDS[b].id + ':' + Math.round((breather ? 22 : 16) + t * 3);
    return L(8, breather ? 5 : 6, moves, goals, rows.map(function (x) { return x.join(''); }));
  }
  function levelDef(n) {
    var d = n <= LEVELS.length ? LEVELS[n - 1] : genLevel(n);
    var map = [], weeds = 0;
    for (var r = 0; r < d.size; r++) {
      var row = d.map ? d.map[r] : new Array(d.size + 1).join('.');
      map.push(row);
      for (var c = 0; c < d.size; c++) if (row[c] === 'w' || row[c] === 'W') weeds++;
    }
    var goals = d.goals.split(' ').map(function (s) {
      var p = s.split(':');
      if (p[0] === 'chwast') return { kind: 'w', need: weeds };
      for (var i = 0; i < KINDS.length; i++) if (KINDS[i].id === p[0]) return { kind: i, need: +p[1] };
      return null;
    }).filter(Boolean);
    return { n: n, size: d.size, kinds: d.kinds, moves: d.moves, map: map, goals: goals };
  }

  // ---------- board logic (no DOM) ----------
  var UID = 0;
  function Board(def, rng) {
    this.R = def.size; this.C = def.size; this.nk = def.kinds; this.def = def; this.rng = rng || Math.random;
    this.hole = []; this.g = [];
    for (var r = 0; r < this.R; r++) {
      this.hole.push([]); this.g.push([]);
      for (var c = 0; c < this.C; c++) { this.hole[r].push(def.map[r][c] === '#'); this.g[r].push(null); }
    }
  }
  var BP = Board.prototype;
  BP.tile = function (k) { return { id: ++UID, k: k, sp: null, dir: null, hp: 0, x: 0, y: 0 }; };
  BP.rand = function () { return Math.floor(this.rng() * this.nk); };
  BP.in = function (r, c) { return r >= 0 && r < this.R && c >= 0 && c < this.C && !this.hole[r][c]; };
  BP.at = function (p) { return this.in(p.r, p.c) ? this.g[p.r][p.c] : null; };
  BP.kindAt = function (r, c) { var t = this.in(r, c) ? this.g[r][c] : null; return t ? t.k : -9; };
  BP.fill = function () {
    for (var tries = 0; tries < 200; tries++) {
      for (var r = 0; r < this.R; r++) for (var c = 0; c < this.C; c++) {
        if (this.hole[r][c]) { this.g[r][c] = null; continue; }
        var ch = this.def.map[r][c], t;
        if (ch === 'w' || ch === 'W') { t = this.tile(WEED); t.hp = ch === 'W' ? 2 : 1; }
        else {
          var k, guard = 0;
          do { k = this.rand(); guard++; } while (guard < 50 && ((this.kindAt(r, c - 1) === k && this.kindAt(r, c - 2) === k) || (this.kindAt(r - 1, c) === k && this.kindAt(r - 2, c) === k)));
          t = this.tile(k);
        }
        t.x = c; t.y = r; this.g[r][c] = t;
      }
      if (!this.runs().length && this.findMove()) return;
    }
  };
  BP.runs = function () {
    var out = [], r, c, e, k;
    for (r = 0; r < this.R; r++) for (c = 0; c < this.C;) {
      k = this.kindAt(r, c);
      if (k < 0) { c++; continue; }
      for (e = c + 1; e < this.C && this.kindAt(r, e) === k; e++);
      if (e - c >= 3) { var cl = []; for (var i = c; i < e; i++) cl.push({ r: r, c: i }); out.push({ dir: 'h', cells: cl }); }
      c = e;
    }
    for (c = 0; c < this.C; c++) for (r = 0; r < this.R;) {
      k = this.kindAt(r, c);
      if (k < 0) { r++; continue; }
      for (e = r + 1; e < this.R && this.kindAt(e, c) === k; e++);
      if (e - r >= 3) { var cv = []; for (var j = r; j < e; j++) cv.push({ r: j, c: c }); out.push({ dir: 'v', cells: cv }); }
      r = e;
    }
    return out;
  };
  // runs joined into shapes; each shape may create a special at `spot`
  BP.groups = function (prefer) {
    var runs = this.runs(), self = this;
    if (!runs.length) return [];
    var parent = runs.map(function (_, i) { return i; }), owner = {};
    function find(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
    runs.forEach(function (run, i) {
      run.cells.forEach(function (p) {
        var kk = p.r * 16 + p.c;
        if (owner[kk] !== undefined) parent[find(owner[kk])] = find(i); else owner[kk] = i;
      });
    });
    var byRoot = {};
    runs.forEach(function (run, i) { var rt = find(i); (byRoot[rt] = byRoot[rt] || []).push(run); });
    var out = [];
    Object.keys(byRoot).forEach(function (rt) {
      var rs = byRoot[rt], seen = {}, cells = [], hasH = false, hasV = false, longest = rs[0], inH = {}, inV = {};
      rs.forEach(function (run) {
        if (run.dir === 'h') hasH = true; else hasV = true;
        if (run.cells.length > longest.cells.length) longest = run;
        run.cells.forEach(function (p) {
          var kk = p.r * 16 + p.c;
          (run.dir === 'h' ? inH : inV)[kk] = 1;
          if (!seen[kk]) { seen[kk] = 1; cells.push(p); }
        });
      });
      var sp = null, dir = null, len = longest.cells.length;
      if (len >= 5) sp = 'rain';
      else if (hasH && hasV) sp = 'mole';
      else if (len === 4) { sp = 'bee'; dir = longest.dir; }
      var spot = null;
      if (sp) {
        var free = function (p) { var t = self.g[p.r][p.c]; return t && !t.sp; };
        var inGroup = function (p) { return seen[p.r * 16 + p.c]; };
        (prefer || []).forEach(function (p) { if (!spot && p && inGroup(p) && free(p)) spot = p; });
        if (!spot && sp === 'mole') cells.forEach(function (p) { var kk = p.r * 16 + p.c; if (!spot && inH[kk] && inV[kk] && free(p)) spot = p; });
        if (!spot) { var mid = longest.cells[Math.floor((len - 1) / 2)]; if (free(mid)) spot = mid; }
        if (!spot) cells.forEach(function (p) { if (!spot && free(p)) spot = p; });
        if (!spot) sp = null;
      }
      out.push({ cells: cells, sp: sp, dir: dir, spot: spot });
    });
    return out;
  };
  BP.lineLen = function (r, c, dr, dc, k) { var n = 0; r += dr; c += dc; while (this.kindAt(r, c) === k) { n++; r += dr; c += dc; } return n; };
  BP.matchAt = function (r, c) {
    var k = this.kindAt(r, c);
    if (k < 0) return false;
    return 1 + this.lineLen(r, c, 0, -1, k) + this.lineLen(r, c, 0, 1, k) >= 3 || 1 + this.lineLen(r, c, -1, 0, k) + this.lineLen(r, c, 1, 0, k) >= 3;
  };
  BP.swap = function (a, b) { var t = this.g[a.r][a.c]; this.g[a.r][a.c] = this.g[b.r][b.c]; this.g[b.r][b.c] = t; };
  BP.canSwap = function (a, b) {
    if (Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1) return false;
    var ta = this.at(a), tb = this.at(b);
    return !!(ta && tb && ta.k !== WEED && tb.k !== WEED);
  };
  BP.validSwap = function (a, b) {
    if (!this.canSwap(a, b)) return false;
    var ta = this.at(a), tb = this.at(b);
    if (ta.sp === 'rain' || tb.sp === 'rain' || (ta.sp && tb.sp)) return true;
    this.swap(a, b);
    var ok = this.matchAt(a.r, a.c) || this.matchAt(b.r, b.c);
    this.swap(a, b);
    return ok;
  };
  BP.findMoves = function (first) {
    var out = [];
    for (var r = 0; r < this.R; r++) for (var c = 0; c < this.C; c++) {
      var a = { r: r, c: c };
      var cand = [{ r: r, c: c + 1 }, { r: r + 1, c: c }];
      for (var i = 0; i < 2; i++) if (this.validSwap(a, cand[i])) { out.push([a, cand[i]]); if (first) return out; }
    }
    return out;
  };
  BP.findMove = function () { var m = this.findMoves(true); return m.length ? m[0] : null; };
  BP.mostCommon = function () {
    var cnt = [], best = 0;
    for (var r = 0; r < this.R; r++) for (var c = 0; c < this.C; c++) { var t = this.g[r][c]; if (t && t.k >= 0) cnt[t.k] = (cnt[t.k] || 0) + 1; }
    for (var k = 0; k < cnt.length; k++) if ((cnt[k] || 0) > (cnt[best] || 0)) best = k;
    return best;
  };
  BP.ofKind = function (k) {
    var out = [];
    for (var r = 0; r < this.R; r++) for (var c = 0; c < this.C; c++) { var t = this.g[r][c]; if (t && t.k === k) out.push({ r: r, c: c }); }
    return out;
  };
  BP.blast = function (t, r, c) {
    var out = [], i, j;
    if (t.sp === 'bee') {
      if (t.dir === 'h') { for (i = 0; i < this.C; i++) if (i !== c && this.in(r, i)) out.push({ r: r, c: i, dist: Math.abs(i - c) }); }
      else { for (i = 0; i < this.R; i++) if (i !== r && this.in(i, c)) out.push({ r: i, c: c, dist: Math.abs(i - r) }); }
    } else if (t.sp === 'mole') {
      for (i = -1; i <= 1; i++) for (j = -1; j <= 1; j++) if ((i || j) && this.in(r + i, c + j)) out.push({ r: r + i, c: c + j, dist: 1 });
    } else if (t.sp === 'rain') {
      this.ofKind(this.mostCommon()).forEach(function (p) { out.push({ r: p.r, c: p.c, dist: Math.hypot(p.r - r, p.c - c) }); });
    }
    return out;
  };
  // swap involving a watering can or two specials; positions are after the swap (b = where the dragged tile landed)
  BP.comboExtra = function (a, b) {
    var A = this.g[a.r][a.c], Bt = this.g[b.r][b.c], ex = { cells: [], spent: [A.id, Bt.id], effects: [] }, self = this, r, c;
    function dist(p, q) { return Math.hypot(p.r - q.r, p.c - q.c); }
    if (A.sp === 'rain' && Bt.sp === 'rain') {
      for (r = 0; r < this.R; r++) for (c = 0; c < this.C; c++) if (this.g[r][c]) ex.cells.push({ r: r, c: c, d: 60 + dist(b, { r: r, c: c }) * 45 });
      ex.effects.push({ type: 'rainAll', r: b.r, c: b.c, t: 0 });
      return ex;
    }
    if (A.sp === 'rain' || Bt.sp === 'rain') {
      var rp = A.sp === 'rain' ? a : b, other = A.sp === 'rain' ? Bt : A;
      ex.spent = [this.g[rp.r][rp.c].id];
      ex.cells.push({ r: rp.r, c: rp.c, d: 0 });
      var targets = this.ofKind(other.k);
      targets.forEach(function (p) {
        var t = self.g[p.r][p.c];
        if (other.sp && !t.sp) { t.sp = other.sp; t.dir = self.rng() < 0.5 ? 'h' : 'v'; }
        ex.cells.push({ r: p.r, c: p.c, d: 120 + dist(rp, p) * 30 });
      });
      ex.effects.push({ type: 'rain', r: rp.r, c: rp.c, t: 0, targets: targets.map(function (p) { return { r: p.r, c: p.c, dist: dist(rp, p) }; }), kind: other.k });
      return ex;
    }
    var combo = [A.sp, Bt.sp].sort().join('+'), add = function (r2, c2, d) { if (self.in(r2, c2)) ex.cells.push({ r: r2, c: c2, d: d }); };
    ex.cells.push({ r: a.r, c: a.c, d: 0 }, { r: b.r, c: b.c, d: 0 });
    if (combo === 'bee+bee') {
      for (c = 0; c < this.C; c++) add(b.r, c, 40 + Math.abs(c - b.c) * 40);
      for (r = 0; r < this.R; r++) add(r, b.c, 40 + Math.abs(r - b.r) * 40);
      ex.effects.push({ type: 'bee', r: b.r, c: b.c, dir: 'h', t: 0 }, { type: 'bee', r: b.r, c: b.c, dir: 'v', t: 0 });
    } else if (combo === 'bee+mole') {
      for (var o = -1; o <= 1; o++) {
        for (c = 0; c < this.C; c++) add(b.r + o, c, 40 + Math.abs(c - b.c) * 40);
        for (r = 0; r < this.R; r++) add(r, b.c + o, 40 + Math.abs(r - b.r) * 40);
        ex.effects.push({ type: 'bee', r: b.r + o, c: b.c, dir: 'h', t: 0 }, { type: 'bee', r: b.r, c: b.c + o, dir: 'v', t: 0 });
      }
    } else {
      for (r = -2; r <= 2; r++) for (c = -2; c <= 2; c++) add(b.r + r, b.c + c, 60 + Math.max(Math.abs(r), Math.abs(c)) * 60);
      ex.effects.push({ type: 'mole', r: b.r, c: b.c, t: 0, big: true });
    }
    return ex;
  };
  // clears groups (+ extra cells from a combo), triggers specials in chain. Mutates the grid.
  BP.resolve = function (groups, extra) {
    var self = this, pending = [], fin = {}, protect = {}, spent = {}, creates = [], effects = [], order = [];
    function push(r, c, d) { pending.push({ r: r, c: c, d: d }); }
    groups.forEach(function (gp) {
      var spot = gp.sp ? gp.spot : null;
      if (spot) { protect[spot.r * 16 + spot.c] = 1; creates.push({ r: spot.r, c: spot.c, sp: gp.sp, dir: gp.dir }); }
      gp.cells.forEach(function (p) {
        if (!(spot && p.r === spot.r && p.c === spot.c)) push(p.r, p.c, 0);
        else [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) {
          var t = self.in(p.r + o[0], p.c + o[1]) ? self.g[p.r + o[0]][p.c + o[1]] : null;
          if (t && t.k === WEED) push(p.r + o[0], p.c + o[1], 30);
        });
      });
    });
    if (extra) {
      extra.spent.forEach(function (id) { spent[id] = 1; });
      extra.cells.forEach(function (p) { push(p.r, p.c, p.d); });
      effects = effects.concat(extra.effects);
    }
    while (pending.length) {
      var bi = 0;
      for (var i = 1; i < pending.length; i++) if (pending[i].d < pending[bi].d) bi = i;
      var p = pending.splice(bi, 1)[0], kk = p.r * 16 + p.c;
      if (fin[kk] !== undefined || protect[kk] || !this.in(p.r, p.c)) continue;
      var t = this.g[p.r][p.c];
      if (!t) continue;
      fin[kk] = p.d;
      order.push({ r: p.r, c: p.c, d: p.d, t: t });
      if (t.k !== WEED) [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) {
        var w = self.in(p.r + o[0], p.c + o[1]) ? self.g[p.r + o[0]][p.c + o[1]] : null;
        if (w && w.k === WEED) push(p.r + o[0], p.c + o[1], p.d + 30);
      });
      if (t.sp && !spent[t.id]) {
        spent[t.id] = 1;
        var bl = this.blast(t, p.r, p.c), per = t.sp === 'rain' ? 30 : t.sp === 'mole' ? 50 : 40;
        var eff = { type: t.sp, r: p.r, c: p.c, dir: t.dir, t: p.d };
        if (t.sp === 'rain') eff.targets = bl;
        effects.push(eff);
        bl.forEach(function (b) { push(b.r, b.c, p.d + 60 + b.dist * per); });
      }
    }
    var counts = { w: 0 }, clears = [], maxD = 0;
    order.forEach(function (o) {
      var t = o.t, removed = true;
      if (t.k === WEED) { t.hp--; removed = t.hp <= 0; if (removed) counts.w++; }
      else if (t.k >= 0) counts[t.k] = (counts[t.k] || 0) + 1;
      if (removed) self.g[o.r][o.c] = null;
      clears.push({ t: t, r: o.r, c: o.c, d: o.d, removed: removed });
      if (o.d > maxD) maxD = o.d;
    });
    creates.forEach(function (cr) {
      var t = self.g[cr.r][cr.c];
      if (!t) return;
      cr.t = t; t.sp = cr.sp; t.dir = cr.dir;
      if (cr.sp === 'rain') t.k = RAIN;
    });
    return { clears: clears, creates: creates, effects: effects, counts: counts, maxD: maxD };
  };
  BP.gravity = function () {
    var falls = [], spawns = [];
    for (var c = 0; c < this.C; c++) {
      var cells = [];
      for (var r = 0; r < this.R; r++) if (!this.hole[r][c]) cells.push(r);
      if (!cells.length) continue;
      var write = cells.length - 1;
      for (var i = cells.length - 1; i >= 0; i--) {
        var t = this.g[cells[i]][c];
        if (!t) continue;
        if (i !== write) { this.g[cells[write]][c] = t; this.g[cells[i]][c] = null; falls.push({ t: t, c: c, from: cells[i], to: cells[write] }); }
        write--;
      }
      for (var j = write; j >= 0; j--) {
        var nt = this.tile(this.rand());
        this.g[cells[j]][c] = nt;
        spawns.push({ t: nt, c: c, from: cells[0] - 1 - (write - j), to: cells[j] });
      }
    }
    return { falls: falls, spawns: spawns };
  };
  BP.shuffle = function () {
    var pos = [], tiles = [], r, c, i, tries;
    for (r = 0; r < this.R; r++) for (c = 0; c < this.C; c++) { var t = this.g[r][c]; if (t && t.k !== WEED) { pos.push({ r: r, c: c }); tiles.push(t); } }
    for (tries = 0; tries < 300; tries++) {
      for (i = tiles.length - 1; i > 0; i--) { var j = Math.floor(this.rng() * (i + 1)), tmp = tiles[i]; tiles[i] = tiles[j]; tiles[j] = tmp; }
      for (i = 0; i < pos.length; i++) this.g[pos[i].r][pos[i].c] = tiles[i];
      if (!this.runs().length && this.findMove()) return true;
    }
    for (tries = 0; tries < 300; tries++) {
      for (i = 0; i < tiles.length; i++) if (!tiles[i].sp) tiles[i].k = this.rand();
      if (!this.runs().length && this.findMove()) return true;
    }
    return false;
  };

  // one player move with all cascades; H hooks animate (UI) or just count (tests)
  async function playMove(B, a, b, H) {
    if (!B.canSwap(a, b)) return { ok: false, blocked: true };
    var ta = B.at(a), tb = B.at(b);
    B.swap(a, b);
    if (H.swap) await H.swap(a, b, false);
    var groups = null, extra = null;
    if (ta.sp === 'rain' || tb.sp === 'rain' || (ta.sp && tb.sp)) extra = B.comboExtra(a, b);
    else {
      groups = B.groups([b, a]);
      if (!groups.length) { B.swap(a, b); if (H.swap) await H.swap(a, b, true); return { ok: false }; }
    }
    if (H.used) H.used();
    var chain = 0;
    for (;;) {
      if (!extra && !groups) groups = B.groups(null);
      if (!extra && !groups.length) break;
      chain++;
      var res = B.resolve(groups || [], extra);
      groups = null; extra = null;
      if (H.step) await H.step(res, chain);
      var gv = B.gravity();
      if (H.fall) await H.fall(gv);
      if (chain > 50) break;
    }
    return { ok: true, chain: chain };
  }

  // ---------- drawing: vegetables and friends (unit cell, centred) ----------
  function face(g, ey, s) {
    s = s || 1;
    g.fillStyle = INK;
    g.beginPath(); g.arc(-0.075 * s, ey, 0.034 * s, 0, 7); g.arc(0.075 * s, ey, 0.034 * s, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)';
    g.beginPath(); g.arc(-0.065 * s, ey - 0.012 * s, 0.011 * s, 0, 7); g.arc(0.085 * s, ey - 0.012 * s, 0.011 * s, 0, 7); g.fill();
    g.strokeStyle = INK; g.lineWidth = 0.028; g.lineCap = 'round';
    g.beginPath(); g.arc(0, ey + 0.035 * s, 0.045 * s, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
    g.fillStyle = 'rgba(255,120,140,.35)';
    g.beginPath(); g.arc(-0.14 * s, ey + 0.05 * s, 0.038 * s, 0, 7); g.arc(0.14 * s, ey + 0.05 * s, 0.038 * s, 0, 7); g.fill();
  }
  function outline(g, fill, lw) { g.fillStyle = fill; g.fill(); g.lineWidth = lw || 0.045; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke(); }
  function leaf(g, x, y, rot, rx, ry, col) {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.beginPath(); g.moveTo(0, ry); g.quadraticCurveTo(rx * 1.6, 0, 0, -ry); g.quadraticCurveTo(-rx * 1.6, 0, 0, ry); g.closePath();
    outline(g, col, 0.04); g.restore();
  }
  function shadow(g, y, rx) { g.fillStyle = 'rgba(60,30,10,.22)'; g.beginPath(); g.ellipse(0, y, rx, 0.07, 0, 0, 7); g.fill(); }
  var VEG = [
    function carrot(g) {
      shadow(g, 0.4, 0.2);
      g.save(); g.rotate(0.18);
      leaf(g, -0.1, -0.34, -0.5, 0.06, 0.13, '#4fae3e'); leaf(g, 0.1, -0.34, 0.5, 0.06, 0.13, '#4fae3e'); leaf(g, 0, -0.38, 0, 0.065, 0.15, '#62c24d');
      g.beginPath(); g.moveTo(-0.2, -0.2); g.quadraticCurveTo(-0.2, 0.08, -0.035, 0.4); g.quadraticCurveTo(0, 0.45, 0.035, 0.4); g.quadraticCurveTo(0.2, 0.08, 0.2, -0.2); g.quadraticCurveTo(0, -0.29, -0.2, -0.2); g.closePath();
      outline(g, '#f28526');
      g.strokeStyle = '#c95f12'; g.lineWidth = 0.03; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-0.13, 0.12); g.lineTo(-0.04, 0.13); g.moveTo(0.06, 0.22); g.lineTo(0.12, 0.2); g.moveTo(0.09, 0.03); g.lineTo(0.16, 0.02); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 0.035;
      g.beginPath(); g.moveTo(-0.14, -0.15); g.quadraticCurveTo(-0.15, 0.0, -0.1, 0.1); g.stroke();
      face(g, -0.07, 0.95);
      g.restore();
    },
    function tomato(g) {
      shadow(g, 0.38, 0.28);
      g.beginPath(); g.ellipse(0, 0.06, 0.36, 0.31, 0, 0, 7); outline(g, '#e8473b');
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(-0.18, -0.06, 0.075, 0.045, -0.6, 0, 7); g.fill();
      g.beginPath();
      for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 0.05 : 0.15; g.lineTo(Math.cos(a) * rr, -0.23 + Math.sin(a) * rr * 0.7); }
      g.closePath(); outline(g, '#4fae3e', 0.035);
      g.strokeStyle = INK; g.lineWidth = 0.045; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -0.26); g.quadraticCurveTo(0.01, -0.34, 0.06, -0.37); g.stroke();
      face(g, 0.08);
    },
    function lettuce(g) {
      shadow(g, 0.39, 0.3);
      function scallop(rr, bump, n, col, y) {
        g.beginPath();
        for (var i = 0; i <= n; i++) {
          var a = i / n * Math.PI * 2, a2 = (i - 0.5) / n * Math.PI * 2;
          if (i === 0) g.moveTo(Math.cos(a) * rr, y + Math.sin(a) * rr * 0.92);
          else g.quadraticCurveTo(Math.cos(a2) * (rr + bump), y + Math.sin(a2) * (rr + bump) * 0.92, Math.cos(a) * rr, y + Math.sin(a) * rr * 0.92);
        }
        g.closePath(); outline(g, col, 0.04);
      }
      scallop(0.33, 0.07, 11, '#4faa3d', 0.03);
      scallop(0.23, 0.06, 9, '#8fd05a', 0.04);
      g.strokeStyle = '#d9f5b0'; g.lineWidth = 0.03; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, 0.2); g.lineTo(0, 0.27); g.moveTo(-0.12, 0.15); g.lineTo(-0.2, 0.2); g.moveTo(0.12, 0.15); g.lineTo(0.2, 0.2); g.stroke();
      face(g, 0.02);
    },
    function grapes(g) {
      shadow(g, 0.39, 0.22);
      g.strokeStyle = '#7a4a22'; g.lineWidth = 0.05; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, -0.25); g.quadraticCurveTo(0, -0.34, 0.04, -0.4); g.stroke();
      leaf(g, 0.14, -0.33, 1.1, 0.06, 0.11, '#4fae3e');
      [[-0.19, -0.13], [0.19, -0.13], [0, -0.15], [-0.1, 0.07], [0.1, 0.07], [0, 0.26]].forEach(function (p) {
        g.beginPath(); g.arc(p[0], p[1], 0.125, 0, 7); outline(g, '#8b5bd4', 0.04);
        g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(p[0] - 0.045, p[1] - 0.045, 0.028, 0, 7); g.fill();
      });
      face(g, -0.14, 0.85);
    },
    function corn(g) {
      shadow(g, 0.41, 0.22);
      g.save();
      g.beginPath(); g.ellipse(0, -0.04, 0.17, 0.35, 0, 0, 7); outline(g, '#f7d33b');
      g.clip();
      g.strokeStyle = '#d8a514'; g.lineWidth = 0.025;
      g.beginPath();
      for (var y = -0.36; y < 0.35; y += 0.085) { g.moveTo(-0.2, y); g.lineTo(0.2, y); }
      g.moveTo(-0.06, -0.4); g.lineTo(-0.06, 0.4); g.moveTo(0.06, -0.4); g.lineTo(0.06, 0.4);
      g.stroke();
      g.restore();
      g.beginPath(); g.ellipse(0, -0.04, 0.17, 0.35, 0, 0, 7); g.lineWidth = 0.045; g.strokeStyle = INK; g.stroke();
      g.beginPath(); g.moveTo(-0.02, 0.42); g.quadraticCurveTo(-0.34, 0.28, -0.25, -0.1); g.quadraticCurveTo(-0.13, 0.16, 0.0, 0.3); g.closePath(); outline(g, '#5cb84a', 0.04);
      g.beginPath(); g.moveTo(0.02, 0.42); g.quadraticCurveTo(0.34, 0.28, 0.25, -0.1); g.quadraticCurveTo(0.13, 0.16, 0.0, 0.3); g.closePath(); outline(g, '#4aa33a', 0.04);
      face(g, -0.13, 0.9);
    },
    function pumpkin(g) {
      shadow(g, 0.38, 0.32);
      g.save(); g.translate(0, 0.08);
      g.beginPath(); g.ellipse(-0.17, 0, 0.19, 0.27, 0, 0, 7); outline(g, '#ef8f2c', 0.04);
      g.beginPath(); g.ellipse(0.17, 0, 0.19, 0.27, 0, 0, 7); outline(g, '#ef8f2c', 0.04);
      g.beginPath(); g.ellipse(0, 0, 0.18, 0.29, 0, 0, 7); outline(g, '#f6a542', 0.04);
      g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(-0.07, -0.16, 0.05, 0.03, -0.4, 0, 7); g.fill();
      g.restore();
      g.beginPath(); g.moveTo(-0.04, -0.17); g.lineTo(-0.02, -0.33); g.lineTo(0.06, -0.33); g.lineTo(0.05, -0.17); g.closePath(); outline(g, '#8a5a33', 0.04);
      g.strokeStyle = '#3f9a35'; g.lineWidth = 0.035; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0.06, -0.27); g.quadraticCurveTo(0.2, -0.36, 0.22, -0.26); g.quadraticCurveTo(0.2, -0.2, 0.15, -0.24); g.stroke();
      face(g, 0.06);
    }
  ];
  function drawWeed(g, hp) {
    var big = hp >= 2;
    g.fillStyle = 'rgba(60,30,10,.25)'; g.beginPath(); g.ellipse(0, 0.36, 0.34, 0.08, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(0, 0.33, 0.3, 0.1, 0, Math.PI, 0); g.closePath(); outline(g, '#7a4e2c', 0.04);
    function spike(rot, len, col) {
      g.save(); g.translate(0, 0.28); g.rotate(rot);
      g.beginPath(); g.moveTo(-0.07, 0);
      g.lineTo(-0.09, -len * 0.4); g.lineTo(-0.035, -len * 0.45); g.lineTo(-0.05, -len * 0.75); g.lineTo(0, -len);
      g.lineTo(0.05, -len * 0.75); g.lineTo(0.035, -len * 0.45); g.lineTo(0.09, -len * 0.4); g.lineTo(0.07, 0); g.closePath();
      outline(g, col, 0.035); g.restore();
    }
    if (big) { spike(-1.05, 0.5, '#3c6e22'); spike(1.05, 0.5, '#3c6e22'); spike(-0.5, 0.62, '#3c6e22'); spike(0.5, 0.62, '#3c6e22'); }
    spike(-0.8, 0.44, '#5d8f2a'); spike(0.8, 0.44, '#5d8f2a'); spike(-0.3, 0.55, '#6fa232'); spike(0.3, 0.55, '#6fa232'); spike(0, 0.6, '#7cb53a');
    g.beginPath(); g.arc(0, 0.12, 0.13, 0, 7); outline(g, big ? '#4f7f25' : '#6c9c30', 0.04);
    // grumpy little face
    g.strokeStyle = INK; g.lineWidth = 0.03; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-0.09, 0.06); g.lineTo(-0.03, 0.085); g.moveTo(0.09, 0.06); g.lineTo(0.03, 0.085); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(-0.05, 0.12, 0.022, 0, 7); g.arc(0.05, 0.12, 0.022, 0, 7); g.fill();
    g.beginPath(); g.arc(0, 0.21, 0.035, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke();
    if (big) {
      g.fillStyle = '#e8d24a'; g.strokeStyle = INK; g.lineWidth = 0.03;
      [[-0.2, -0.12], [0.2, -0.12]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 0.045, 0, 7); g.fill(); g.stroke(); });
    }
  }
  function drawBee(g, flap) {
    // facing right, centred, roughly 0.5 wide
    g.save();
    g.globalAlpha = 0.9;
    g.fillStyle = '#ffffff'; g.strokeStyle = INK; g.lineWidth = 0.035;
    var w = 0.6 + 0.4 * Math.abs(Math.sin(flap));
    g.beginPath(); g.ellipse(-0.04, -0.13, 0.08, 0.12 * w, -0.3, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(0.06, -0.13, 0.07, 0.11 * w, 0.3, 0, 7); g.fill(); g.stroke();
    g.globalAlpha = 1;
    g.beginPath(); g.ellipse(0, 0, 0.2, 0.135, 0, 0, 7); outline(g, '#f7c933', 0.04);
    g.save(); g.beginPath(); g.ellipse(0, 0, 0.2, 0.135, 0, 0, 7); g.clip();
    g.fillStyle = INK; g.fillRect(-0.09, -0.2, 0.05, 0.4); g.fillRect(0.01, -0.2, 0.05, 0.4);
    g.restore();
    g.beginPath(); g.moveTo(-0.2, 0); g.lineTo(-0.27, 0.01); g.lineTo(-0.2, 0.04); g.fillStyle = INK; g.fill();
    g.beginPath(); g.arc(0.17, -0.01, 0.075, 0, 7); outline(g, '#3a3a52', 0.03);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(0.19, -0.03, 0.025, 0, 7); g.fill();
    g.strokeStyle = INK; g.lineWidth = 0.025; g.beginPath(); g.moveTo(0.17, -0.07); g.quadraticCurveTo(0.2, -0.15, 0.25, -0.15); g.stroke();
    g.restore();
  }
  function drawMole(g, wob) {
    g.beginPath(); g.ellipse(0, 0.36, 0.38, 0.13, 0, Math.PI, 0); g.closePath(); outline(g, '#8a5a33', 0.04);
    g.save(); g.translate(0, wob);
    g.beginPath(); g.arc(0, 0.2, 0.17, Math.PI, 0); g.lineTo(0.17, 0.32); g.lineTo(-0.17, 0.32); g.closePath(); outline(g, '#6d5d73', 0.04);
    g.fillStyle = INK; g.beginPath(); g.arc(-0.06, 0.15, 0.022, 0, 7); g.arc(0.06, 0.15, 0.022, 0, 7); g.fill();
    g.beginPath(); g.ellipse(0, 0.22, 0.055, 0.04, 0, 0, 7); outline(g, '#ff9fb2', 0.03);
    g.restore();
    g.beginPath(); g.ellipse(-0.16, 0.32, 0.06, 0.035, 0.3, 0, 7); outline(g, '#ffb6c4', 0.03);
    g.beginPath(); g.ellipse(0.16, 0.32, 0.06, 0.035, -0.3, 0, 7); outline(g, '#ffb6c4', 0.03);
    g.fillStyle = '#6b4424';
    [[-0.28, 0.33], [0.27, 0.31], [-0.05, 0.35], [0.1, 0.36]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 0.018, 0, 7); g.fill(); });
  }
  var RAINBOW = ['#e2533f', '#f28a26', '#f2c81d', '#5cb84a', '#3f86d8', '#8a5cd0'];
  function drawCan(g, spin) {
    shadow(g, 0.38, 0.3);
    g.strokeStyle = INK; g.lineWidth = 0.09; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0.16, 0.06); g.lineTo(0.38, -0.2); g.stroke();
    g.strokeStyle = '#9fc3ea'; g.lineWidth = 0.045; g.beginPath(); g.moveTo(0.16, 0.06); g.lineTo(0.38, -0.2); g.stroke();
    g.beginPath(); g.ellipse(0.4, -0.22, 0.07, 0.04, -0.8, 0, 7); outline(g, '#9fc3ea', 0.035);
    g.strokeStyle = INK; g.lineWidth = 0.07;
    g.beginPath(); g.arc(-0.14, -0.06, 0.15, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 0.03; g.stroke();
    g.beginPath(); g.moveTo(-0.27, -0.1); g.lineTo(0.18, -0.1); g.lineTo(0.2, 0.32); g.quadraticCurveTo(0, 0.37, -0.29, 0.32); g.closePath();
    g.save(); g.clip();
    for (var i = 0; i < 6; i++) { g.fillStyle = RAINBOW[i]; g.fillRect(-0.3 + i * 0.085, -0.15, 0.09, 0.55); }
    g.restore();
    g.lineWidth = 0.045; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(-0.18, 0.02, 0.035, 0.09, 0, 0, 7); g.fill();
    for (var s = 0; s < 3; s++) {
      var a = spin + s * 2.1, x = Math.cos(a) * 0.36, y = Math.sin(a) * 0.3;
      star4(g, x, y, 0.06 + 0.02 * Math.sin(spin * 2 + s), '#fff6b0');
    }
  }
  function star4(g, x, y, r, col) {
    g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r);
    g.fillStyle = col; g.fill(); g.strokeStyle = 'rgba(29,47,111,.6)'; g.lineWidth = 0.02; g.stroke();
  }
  function chevrons(g, dir) {
    g.save(); if (dir === 'v') g.rotate(Math.PI / 2);
    g.lineCap = 'round'; g.lineJoin = 'round';
    [-1, 1].forEach(function (s) {
      g.beginPath(); g.moveTo(s * 0.36, -0.09); g.lineTo(s * 0.45, 0); g.lineTo(s * 0.36, 0.09);
      g.strokeStyle = INK; g.lineWidth = 0.09; g.stroke();
      g.strokeStyle = '#fff6b0'; g.lineWidth = 0.045; g.stroke();
    });
    g.restore();
  }
  function rrect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function easeIO(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  var CSS = [
    '.tj-map{z-index:10;overflow-y:auto;touch-action:pan-y;background:linear-gradient(#d6f0bf,#a6d986);font-family:' + FONT + ';color:' + INK + ';-webkit-overflow-scrolling:touch}',
    '.tj-in{max-width:560px;margin:0 auto;padding:14px 14px 40px;display:flex;flex-direction:column;gap:12px}',
    '.tj-head{background:#fffaf0;border:3px solid ' + INK + ';border-radius:20px;padding:10px 14px;box-shadow:0 4px 0 rgba(29,47,111,.18);display:flex;align-items:center;gap:12px}',
    '.tj-head h2{margin:0;font-weight:400;font-size:1.9rem;line-height:1;flex:1}',
    '.tj-head .tj-sum{font-size:1.15rem;text-align:right;line-height:1.1}.tj-head .tj-sum b{font-weight:400;color:' + GOLD + ';font-size:1.6rem}',
    '.tj-go{font:inherit;font-size:1.5rem;padding:10px 18px;border-radius:16px;border:3px solid ' + INK + ';background:' + GOLD + ';color:#2a1d00;box-shadow:0 4px 0 ' + INK + ';cursor:pointer}',
    '.tj-go:active{transform:translateY(3px);box-shadow:0 1px 0 ' + INK + '}',
    '.tj-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px 8px}',
    '.tj-lv{font:inherit;color:' + INK + ';background:none;border:0;padding:0;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;min-height:64px}',
    '.tj-lv i{font-style:normal;display:flex;align-items:center;justify-content:center;width:52px;height:46px;border-radius:14px;border:3px solid ' + INK + ';background:#b98551;color:#fff8e6;font-size:1.45rem;box-shadow:0 3px 0 rgba(29,47,111,.25);text-shadow:0 2px 0 rgba(29,47,111,.45)}',
    '.tj-lv.done i{background:#7cc456}',
    '.tj-lv.cur i{background:' + GOLD + ';color:#2a1d00;text-shadow:none;animation:tjpulse 1.2s ease-in-out infinite}',
    '.tj-lv.lock{cursor:default;opacity:.45}.tj-lv.lock i{background:#d9cbb5;box-shadow:none}',
    '.tj-lv s{text-decoration:none;font-size:.95rem;letter-spacing:1px;line-height:1;color:#b9b4a5;min-height:1em}.tj-lv s b{font-weight:400;color:' + GOLD + '}',
    '.tj-note{margin:0;color:' + MUTED + ';font-size:1.05rem;text-align:center}',
    '.tj-back{font:inherit;align-self:center;font-size:1.2rem;padding:6px 16px;border-radius:16px;border:3px solid ' + INK + ';background:#fff;box-shadow:0 3px 0 ' + INK + ';cursor:pointer;color:' + INK + '}',
    '@keyframes tjpulse{50%{transform:scale(1.08)}}'
  ].join('\n');

  function mount(el, ctx) {
    var save = ctx.load({ unlocked: 1, stars: {}, best: {}, seen: {} });
    var cv = document.createElement('canvas'), g = cv.getContext('2d');
    var style = document.createElement('style'); style.textContent = CSS;
    var mapEl = document.createElement('div'); mapEl.className = 'tj-map';
    el.appendChild(style); el.appendChild(cv); el.appendChild(mapEl);

    var W = 0, H = 0, dpr = 1, Lt = null, sprites = {}, bg = null;
    var B = null, def = null, lvl = 1, moves = 0, goals = [], score = 0, phase = 'map';
    var dying = [], fx = [], parts = [], flyers = [], banners = [], waits = [];
    var clock = 0, last = 0, raf = 0, paused = false, dead = false;
    var sel = null, drag = null, idleAt = 0, hint = null, shake = null, panelRef = null;
    var vegBuf = 0; // vegetables picked since the last stat report
    function flushVeg() { if (vegBuf) { var n = vegBuf; vegBuf = 0; ctx.stat('veg', n); } }
    // old saves: levels won before medals existed still count
    if (save.unlocked > 1 && ctx.getStat('levels') < save.unlocked - 1) ctx.stat('levels', save.unlocked - 1, 'max');

    function wait(ms) { return new Promise(function (res) { waits.push({ t: clock + ms, res: res }); }); }
    function S() { ctx.save(save); }

    // ---------- layout & caches ----------
    function resize() {
      var r = el.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      dpr = Math.min(3, window.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      if (B) { layout(); buildCaches(); }
    }
    function layout() {
      var R = B.R, C = B.C, hudH = 92, gap = 14, side = 12;
      var cs = Math.floor(Math.min((W - side * 2) / C, (H - hudH - gap - 24) / R, 74));
      cs = Math.max(cs, 20);
      var bw = cs * C, bh = cs * R, hw = Math.min(Math.max(bw, Math.min(W - 16, 380)), W - 16);
      var top = Math.max(8, (H - hudH - gap - bh) * 0.38);
      Lt = { cs: cs, bx: Math.round((W - bw) / 2), by: Math.round(top + hudH + gap), bw: bw, bh: bh, hx: Math.round((W - hw) / 2), hy: Math.round(top), hw: hw, hh: hudH };
      var mw = 78, gx = Lt.hx + mw + 8, gw = Lt.hx + hw - gx, n = goals.length || 1;
      Lt.mw = mw; Lt.gx = gx; Lt.gw = gw;
      Lt.slots = goals.map(function (_, i) { return { x: gx + gw * (i + 0.5) / n, y: Lt.hy + 58 }; });
    }
    function sprite(key, fn) {
      var cs = Lt.cs, size = Math.ceil(cs * 1.3 * dpr), c = document.createElement('canvas');
      c.width = c.height = size;
      var x = c.getContext('2d');
      x.translate(size / 2, size / 2); x.scale(cs * dpr, cs * dpr);
      fn(x);
      sprites[key] = c;
    }
    function buildCaches() {
      sprites = {};
      VEG.forEach(function (fn, i) { sprite('v' + i, fn); });
      sprite('w1', function (x) { drawWeed(x, 1); });
      sprite('w2', function (x) { drawWeed(x, 2); });
      // background: grass, flowers, then the raised bed
      bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height;
      var b = bg.getContext('2d'); b.scale(dpr, dpr);
      var gr = b.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#d9f1c4'); gr.addColorStop(1, '#9ed37b');
      b.fillStyle = gr; b.fillRect(0, 0, W, H);
      var rnd = mulberry(1234 + (lvl || 1));
      for (var i = 0; i < W * H / 2600; i++) {
        var x = rnd() * W, y = rnd() * H;
        b.strokeStyle = rnd() < 0.5 ? 'rgba(63,140,60,.45)' : 'rgba(90,170,70,.5)'; b.lineWidth = 2; b.lineCap = 'round';
        b.beginPath(); b.moveTo(x - 4, y); b.quadraticCurveTo(x - 5, y - 6, x - 7, y - 9); b.moveTo(x, y); b.lineTo(x, y - 10); b.moveTo(x + 4, y); b.quadraticCurveTo(x + 5, y - 6, x + 7, y - 9); b.stroke();
      }
      var fcols = ['#ffffff', '#ffd93b', '#f6a6c1', '#b9a2ff'];
      for (i = 0; i < W * H / 9000; i++) {
        var fx0 = rnd() * W, fy0 = rnd() * H, fc = fcols[Math.floor(rnd() * fcols.length)];
        b.fillStyle = fc; b.strokeStyle = 'rgba(29,47,111,.35)'; b.lineWidth = 1;
        for (var p = 0; p < 5; p++) { var a = p * 1.2566; b.beginPath(); b.arc(fx0 + Math.cos(a) * 4, fy0 + Math.sin(a) * 4, 3.2, 0, 7); b.fill(); b.stroke(); }
        b.fillStyle = '#f2a51d'; b.beginPath(); b.arc(fx0, fy0, 2.6, 0, 7); b.fill();
      }
      var cs = Lt.cs, R = B.R, C = B.C, r, c;
      // soil cells
      for (r = 0; r < R; r++) for (c = 0; c < C; c++) {
        if (B.hole[r][c]) continue;
        var x0 = Lt.bx + c * cs, y0 = Lt.by + r * cs;
        b.fillStyle = (r + c) % 2 ? '#b07a48' : '#bb8653';
        b.fillRect(x0, y0, cs + 0.5, cs + 0.5);
        b.fillStyle = 'rgba(90,50,20,.25)';
        for (var s = 0; s < 5; s++) { b.beginPath(); b.arc(x0 + rnd() * cs, y0 + rnd() * cs, 1 + rnd() * 1.6, 0, 7); b.fill(); }
        b.fillStyle = 'rgba(255,235,200,.18)';
        b.beginPath(); b.arc(x0 + rnd() * cs, y0 + rnd() * cs, 1.4, 0, 7); b.fill();
      }
      // wooden planks around the outside edges of the bed
      var fw = Math.max(6, cs * 0.17), edges = [];
      for (r = 0; r < R; r++) for (c = 0; c < C; c++) {
        if (B.hole[r][c]) continue;
        var X = Lt.bx + c * cs, Y = Lt.by + r * cs, o = fw / 2;
        // end extension: convex corner +o, straight 0, concave -o
        var ext = function (sideR, sideC, diagR, diagC) { return !B.in(sideR, sideC) ? o : B.in(diagR, diagC) ? -o : 0; };
        if (!B.in(r - 1, c)) edges.push([X - ext(r, c - 1, r - 1, c - 1), Y - o, X + cs + ext(r, c + 1, r - 1, c + 1), Y - o]);
        if (!B.in(r + 1, c)) edges.push([X - ext(r, c - 1, r + 1, c - 1), Y + cs + o, X + cs + ext(r, c + 1, r + 1, c + 1), Y + cs + o]);
        if (!B.in(r, c - 1)) edges.push([X - o, Y - ext(r - 1, c, r - 1, c - 1), X - o, Y + cs + ext(r + 1, c, r + 1, c - 1)]);
        if (!B.in(r, c + 1)) edges.push([X + cs + o, Y - ext(r - 1, c, r - 1, c + 1), X + cs + o, Y + cs + ext(r + 1, c, r + 1, c + 1)]);
      }
      b.lineCap = 'round';
      [[fw + 5, INK], [fw, '#d99a5b'], [fw * 0.25, 'rgba(255,230,180,.6)']].forEach(function (st, k) {
        b.lineWidth = st[0]; b.strokeStyle = st[1];
        b.beginPath();
        edges.forEach(function (e) { var oy = k === 2 ? -fw * 0.18 : 0; b.moveTo(e[0], e[1] + oy); b.lineTo(e[2], e[3] + oy); });
        b.stroke();
      });
    }

    // ---------- tiles ----------
    function upd(t) {
      var an = t.an;
      if (!an) return;
      var p = (clock - an.t0) / an.dur;
      if (p < 0) { t.x = an.x0; t.y = an.y0; return; }
      if (p >= 1) { t.x = an.x1; t.y = an.y1; t.an = null; if (an.fall) t.landAt = clock; return; }
      var e = an.fall ? p * p : easeIO(p);
      t.x = an.x0 + (an.x1 - an.x0) * e; t.y = an.y0 + (an.y1 - an.y0) * e;
    }
    function moveTo(t, x1, y1, dur, fall, delay) { t.an = { x0: t.x, y0: t.y, x1: x1, y1: y1, t0: clock + (delay || 0), dur: dur, fall: fall }; }
    function drawTileAt(t, px, py, sc, rot) {
      var cs = Lt.cs;
      g.save(); g.translate(px, py); if (rot) g.rotate(rot); if (sc !== 1) g.scale(sc, sc);
      var sz = cs * 1.3;
      if (t.k === WEED) {
        var sh = t.hitAt && clock - t.hitAt < 300 && clock >= t.hitAt ? Math.sin((clock - t.hitAt) / 30) * 0.12 : 0;
        if (sh) g.rotate(sh);
        g.drawImage(sprites[t.hp >= 2 ? 'w2' : 'w1'], -sz / 2, -sz / 2, sz, sz);
      } else if (t.sp === 'rain') {
        g.scale(cs, cs); drawCan(g, clock / 500);
      } else if (t.sp) {
        var vk = sprites['v' + t.k], glow = 0.43 + 0.02 * Math.sin(clock / 200 + t.id);
        g.beginPath(); g.arc(0, 0, cs * glow, 0, 7);
        g.fillStyle = t.sp === 'bee' ? 'rgba(255,243,160,.9)' : 'rgba(255,226,190,.9)'; g.fill();
        g.lineWidth = 2.5; g.strokeStyle = t.sp === 'bee' ? GOLD : '#a0683a'; g.stroke();
        if (t.sp === 'bee') {
          g.drawImage(vk, -sz * 0.42, -sz * 0.46, sz * 0.75, sz * 0.75);
          g.scale(cs, cs);
          chevrons(g, t.dir);
          g.save(); g.translate(0.12, 0.17); if (t.dir === 'v') g.rotate(-Math.PI / 2);
          g.scale(1.15, 1.15); drawBee(g, clock / 40 + t.id); g.restore();
        } else {
          g.drawImage(vk, -sz * 0.36, -sz * 0.52, sz * 0.72, sz * 0.72);
          g.scale(cs, cs); drawMole(g, Math.sin(clock / 260 + t.id) * 0.02);
        }
      } else {
        g.drawImage(sprites['v' + t.k], -sz / 2, -sz / 2, sz, sz);
      }
      g.restore();
    }
    function drawTile(t, extraSc) {
      upd(t);
      var cs = Lt.cs, px = Lt.bx + (t.x + 0.5) * cs, py = Lt.by + (t.y + 0.5) * cs, sx = 1, sy = 1, rot = 0;
      if (t.landAt) {
        var lt = clock - t.landAt;
        if (lt < 180) { var q = Math.sin(lt / 180 * Math.PI); sx = 1 + 0.1 * q; sy = 1 - 0.12 * q; } else t.landAt = 0;
      }
      if (t.bornAt) {
        var bt = clock - t.bornAt;
        if (bt >= 0 && bt < 400) { var s2 = 1 + 0.35 * Math.sin(bt / 400 * Math.PI); sx *= s2; sy *= s2; } else if (bt >= 400) t.bornAt = 0;
      }
      if (hint && phase === 'idle' && (t === hint.ta || t === hint.tb)) {
        var ht = (clock - hint.t0) % 1600;
        if (ht < 700) { var w = Math.sin(ht / 700 * Math.PI * 4) * Math.sin(ht / 700 * Math.PI); rot = w * 0.16; px += hint.dx * w * cs * 0.05 * (t === hint.ta ? 1 : -1); py += hint.dy * w * cs * 0.05 * (t === hint.ta ? 1 : -1); }
      }
      if (shake && shake.t === t) { var st = clock - shake.t0; if (st < 300) px += Math.sin(st / 25) * cs * 0.06 * (1 - st / 300); else shake = null; }
      if (extraSc) { sx *= extraSc; sy *= extraSc; }
      g.save(); g.translate(px, py + cs * 0.4); g.scale(sx, sy); g.translate(-px, -py - cs * 0.4);
      drawTileAt(t, px, py, 1, rot);
      g.restore();
    }

    // ---------- effects ----------
    function burst(x, y, col, n, spd) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2, v = (0.4 + Math.random()) * (spd || 1) * Lt.cs * 0.006;
        parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - Lt.cs * 0.003, t0: clock, life: 450 + Math.random() * 300, col: col, r: Lt.cs * (0.04 + Math.random() * 0.05), leaf: Math.random() < 0.4 });
      }
    }
    function cellXY(r, c) { return { x: Lt.bx + (c + 0.5) * Lt.cs, y: Lt.by + (r + 0.5) * Lt.cs }; }
    function banner(text, dur, size, col) { banners.push({ text: text, t0: clock, dur: dur || 1200, size: size || 40, col: col || INK }); }

    function drawFx() {
      var cs = Lt.cs;
      fx = fx.filter(function (e) {
        var tau = clock - e.t0;
        if (tau < 0) return true;
        var o = cellXY(e.r, e.c);
        if (e.type === 'bee') {
          var len = (Math.max(B.R, B.C) + 1) * 40 + 60;
          if (tau > len) return false;
          var dist = Math.max(0, tau - 60) / 40;
          [-1, 1].forEach(function (s) {
            var x = o.x + (e.dir === 'h' ? s * dist * cs : 0), y = o.y + (e.dir === 'v' ? s * dist * cs : 0);
            g.save();
            g.strokeStyle = 'rgba(255,246,176,.9)'; g.lineWidth = cs * 0.08; g.setLineDash([cs * 0.12, cs * 0.12]); g.lineCap = 'round';
            g.beginPath(); g.moveTo(o.x, o.y); g.lineTo(x, y); g.stroke();
            g.restore();
            g.save(); g.translate(x, y); g.scale(cs * 1.1, cs * 1.1);
            if (e.dir === 'h') { if (s < 0) g.scale(-1, 1); } else g.rotate(s < 0 ? -Math.PI / 2 : Math.PI / 2);
            drawBee(g, clock / 30); g.restore();
          });
          return true;
        }
        if (e.type === 'mole') {
          var dur = e.big ? 600 : 450;
          if (tau > dur) return false;
          if (!e.burst) { e.burst = 1; burst(o.x, o.y, '#7a4e2c', e.big ? 40 : 24, 1.8); }
          var p = tau / dur, rr = cs * (e.big ? 2.6 : 1.6) * Math.sqrt(p);
          g.save(); g.globalAlpha = 1 - p;
          g.strokeStyle = '#7a4e2c'; g.lineWidth = cs * 0.25 * (1 - p) + 2; g.beginPath(); g.arc(o.x, o.y, rr, 0, 7); g.stroke();
          g.restore();
          g.save(); g.translate(o.x, o.y - cs * 0.15 * Math.sin(p * Math.PI)); g.scale(cs * 1.3, cs * 1.3); g.globalAlpha = Math.min(1, 3 * (1 - p)); drawMole(g, 0); g.restore();
          return true;
        }
        if (e.type === 'rain') {
          var maxd = 0; (e.targets || []).forEach(function (q) { maxd = Math.max(maxd, q.dist); });
          var end = 120 + maxd * 30 + 200;
          if (tau > end) return false;
          g.save(); g.lineCap = 'round';
          (e.targets || []).forEach(function (q, i) {
            var arrive = 120 + q.dist * 30, pr = Math.min(1, tau / Math.max(1, arrive)), tq = cellXY(q.r, q.c);
            if (tau > arrive + 160) return;
            var mx = (o.x + tq.x) / 2, my = Math.min(o.y, tq.y) - cs * (0.8 + q.dist * 0.15);
            var x = (1 - pr) * (1 - pr) * o.x + 2 * (1 - pr) * pr * mx + pr * pr * tq.x, y = (1 - pr) * (1 - pr) * o.y + 2 * (1 - pr) * pr * my + pr * pr * tq.y;
            g.fillStyle = RAINBOW[i % 6]; g.strokeStyle = INK; g.lineWidth = 1.5;
            g.beginPath(); g.arc(x, y, cs * 0.11, 0, 7); g.fill(); g.stroke();
          });
          g.restore();
          if (!e.burst) { e.burst = 1; burst(o.x, o.y, '#9fc3ea', 18, 1.5); }
          return true;
        }
        if (e.type === 'rainAll') {
          if (tau > 900) return false;
          var p2 = tau / 900;
          g.save(); g.globalAlpha = 1 - p2;
          RAINBOW.forEach(function (col, i) { g.strokeStyle = col; g.lineWidth = cs * 0.18; g.beginPath(); g.arc(o.x, o.y, Math.max(1, (p2 * 9 - i * 0.25) * cs), 0, 7); g.stroke(); });
          g.restore();
          return true;
        }
        return false;
      });
      // particles
      parts = parts.filter(function (p) {
        var tau = clock - p.t0;
        if (tau > p.life) return false;
        var x = p.x + p.vx * tau, y = p.y + p.vy * tau + 0.0000045 * Lt.cs * tau * tau;
        g.save(); g.globalAlpha = 1 - tau / p.life; g.fillStyle = p.col;
        if (p.leaf) { g.translate(x, y); g.rotate(tau / 120); g.beginPath(); g.ellipse(0, 0, p.r * 1.4, p.r * 0.7, 0, 0, 7); g.fill(); }
        else { g.beginPath(); g.arc(x, y, p.r, 0, 7); g.fill(); }
        g.restore();
        return true;
      });
      // harvested vegetables flying to the goal card
      flyers = flyers.filter(function (f) {
        var tau = clock - f.t0;
        if (tau < 0) return true;
        var p = Math.min(1, tau / 560), e = easeIO(p), s = Lt.slots[f.slot];
        if (!s) return false;
        var mx = (f.x + s.x) / 2 + (f.x < s.x ? -1 : 1) * cs, my = Math.min(f.y, s.y) - cs * 0.5;
        var x = (1 - e) * (1 - e) * f.x + 2 * (1 - e) * e * mx + e * e * s.x, y = (1 - e) * (1 - e) * f.y + 2 * (1 - e) * e * my + e * e * s.y;
        var sc = 1 - 0.35 * e, sz = cs * 1.3 * sc;
        if (f.weed) g.drawImage(sprites[f.hp2 ? 'w2' : 'w1'], x - sz / 2, y - sz / 2, sz, sz);
        else g.drawImage(sprites['v' + f.k], x - sz / 2, y - sz / 2, sz, sz);
        if (p >= 1) { var gl = goals[f.slot]; gl.shown = Math.min(gl.need, gl.shown + 1); gl.bump = clock; return false; }
        return true;
      });
      banners = banners.filter(function (bn) {
        var tau = clock - bn.t0;
        if (tau > bn.dur) return false;
        var p = tau / bn.dur, sc = tau < 250 ? 0.6 + 0.4 * Math.sin(tau / 250 * Math.PI / 2) * 1.08 : 1;
        var a = p > 0.8 ? (1 - p) / 0.2 : 1, cx = Lt.bx + Lt.bw / 2, cy = Lt.by + Lt.bh * 0.45;
        g.save(); g.globalAlpha = a; g.translate(cx, cy - p * 10); g.scale(sc, sc);
        g.font = bn.size + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
        var tw = g.measureText(bn.text).width + bn.size * 0.9, th = bn.size * 1.35;
        rrect(g, -tw / 2, -th / 2, tw, th, th / 2); g.fillStyle = '#fffaf0'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
        g.fillStyle = bn.col; g.fillText(bn.text, 0, bn.size * 0.04);
        g.restore();
        return true;
      });
    }

    function drawHud() {
      var x = Lt.hx, y = Lt.hy, h = Lt.hh, mw = Lt.mw;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      // moves sign
      rrect(g, x, y, mw, h, 16); g.fillStyle = '#fff8e6'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
      g.fillStyle = MUTED; g.font = '17px ' + FONT; g.fillText('Ruchy', x + mw / 2, y + 17);
      g.fillStyle = moves <= 5 ? RED : INK; g.font = '44px ' + FONT; g.fillText(String(moves), x + mw / 2, y + 56);
      // goals card
      var gx = Lt.gx, gw = Lt.gw;
      rrect(g, gx, y, gw, h, 16); g.fillStyle = '#fffaf0'; g.fill(); g.stroke();
      g.font = '17px ' + FONT; g.textAlign = 'left'; g.fillStyle = LVL; g.fillText('Poziom ' + lvl, gx + 12, y + 16);
      g.textAlign = 'right'; g.fillStyle = MUTED; g.fillText(score + ' pkt', gx + gw - 12, y + 16);
      var n = goals.length, isz = Math.min(40, gw / n * 0.42);
      goals.forEach(function (gl, i) {
        var s = Lt.slots[i], left = gl.need - gl.shown, bt = clock - (gl.bump || -1e9), bs = bt < 200 ? 1 + 0.18 * Math.sin(bt / 200 * Math.PI) : 1;
        var ix = s.x - isz * 0.55, iy = s.y;
        g.save(); g.translate(ix, iy); g.scale(bs, bs);
        var spr = gl.kind === 'w' ? sprites.w1 : sprites['v' + gl.kind], sz = isz * 1.3;
        g.drawImage(spr, -sz / 2, -sz / 2, sz, sz);
        g.restore();
        g.textAlign = 'left';
        if (left <= 0) {
          g.save(); g.translate(s.x + isz * 0.25, iy); g.strokeStyle = GREEN; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round';
          g.beginPath(); g.moveTo(0, 0); g.lineTo(7, 8); g.lineTo(20, -10); g.stroke(); g.restore();
        } else {
          g.fillStyle = INK; g.font = Math.round(isz * 0.8) + 'px ' + FONT; g.fillText(String(left), s.x + isz * 0.15, iy + 2);
        }
      });
    }

    function draw() {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!B || !Lt) { g.fillStyle = '#cdeab3'; g.fillRect(0, 0, W, H); return; }
      g.drawImage(bg, 0, 0, W, H);
      drawHud();
      var cs = Lt.cs, r, c;
      // tiles, clipped to the bed cells so new ones appear from the top edge
      g.save();
      g.beginPath();
      for (r = 0; r < B.R; r++) for (c = 0; c < B.C; c++) if (!B.hole[r][c]) g.rect(Lt.bx + c * cs - 0.5, Lt.by + r * cs - (r === 0 || !B.in(r - 1, c) ? cs * 0.25 : 0.5), cs + 1, cs + 1 + (r === 0 || !B.in(r - 1, c) ? cs * 0.25 : 0));
      g.clip();
      if (sel) {
        var sp = cellXY(sel.r, sel.c), pul = 1 + 0.04 * Math.sin(clock / 120);
        g.fillStyle = 'rgba(255,240,170,.75)'; rrect(g, sp.x - cs * 0.47 * pul, sp.y - cs * 0.47 * pul, cs * 0.94 * pul, cs * 0.94 * pul, cs * 0.22); g.fill();
        g.strokeStyle = GOLD; g.lineWidth = 3; g.stroke();
      }
      for (r = 0; r < B.R; r++) for (c = 0; c < B.C; c++) {
        var t = B.g[r][c];
        if (t && !(t === (sel && B.g[sel.r][sel.c]))) drawTile(t);
      }
      if (sel && B.g[sel.r][sel.c]) drawTile(B.g[sel.r][sel.c], 1.08 + 0.03 * Math.sin(clock / 120));
      dying = dying.filter(function (d) {
        var tau = clock - d.at;
        if (tau < 0) { drawTile(d.t); return true; }
        if (!d.popped) {
          d.popped = 1;
          var p0 = cellXY(d.r, d.c);
          burst(p0.x, p0.y, d.t.k >= 0 ? KINDS[d.t.k].col : d.t.k === WEED ? '#5d8f2a' : '#9fc3ea', 7, 1);
        }
        if (tau > 240) return false;
        var p = tau / 240, s = p < 0.3 ? 1 + p * 0.6 : 1.18 * (1 - (p - 0.3) / 0.7);
        g.save(); g.globalAlpha = 1 - p * 0.5; drawTile(d.t, Math.max(0.01, s)); g.restore();
        return true;
      });
      g.restore();
      drawFx();
    }

    function tick(ts) {
      raf = requestAnimationFrame(tick);
      var dt = last ? Math.min(50, ts - last) : 16;
      last = ts;
      if (paused) return;
      clock += dt;
      if (waits.length) {
        var due = waits.filter(function (w) { return w.t <= clock; });
        if (due.length) { waits = waits.filter(function (w) { return w.t > clock; }); due.forEach(function (w) { w.res(); }); }
      }
      if (phase === 'idle' && !hint && clock - idleAt > (lvl <= 2 ? 3500 : 6000)) {
        var m = B.findMove();
        if (m) hint = { ta: B.at(m[0]), tb: B.at(m[1]), dx: m[1].c - m[0].c, dy: m[1].r - m[0].r, t0: clock };
      }
      if (phase !== 'map') draw();
    }

    // ---------- animation hooks for playMove ----------
    var hooks = {
      swap: function (a, b, back) {
        var ta = B.at(a), tb = B.at(b), d = back ? 150 : 170;
        ctx.sfx(back ? 'error' : 'swap');
        if (ta) moveTo(ta, a.c, a.r, d);
        if (tb) moveTo(tb, b.c, b.r, d);
        return wait(d + 10);
      },
      used: function () { moves--; },
      step: function (res, chain) {
        var removed = 0, firstSp = null, heard = {};
        ctx.sfx(chain >= 2 ? 'combo' : 'clear');
        if (chain >= 3) ctx.sticker('chain3');
        res.effects.forEach(function (e) {
          e.t0 = clock + e.t; fx.push(e);
          var snd = { bee: 'whoosh', mole: 'land', rain: 'water' }[e.type];
          if (snd && !heard[snd]) { heard[snd] = 1; setTimeoutClock(e.t + 30, function () { ctx.sfx(snd); }); }
        });
        res.clears.forEach(function (cl) {
          var at = clock + cl.d;
          if (!cl.removed) { cl.t.hitAt = at; var p = cellXY(cl.r, cl.c); setTimeoutClock(cl.d, function () { burst(p.x, p.y, '#6fa232', 6, 1); }); return; }
          removed++;
          if (cl.t.k >= 0) vegBuf++;
          cl.t.x = cl.c; cl.t.y = cl.r; cl.t.an = null;
          dying.push({ t: cl.t, r: cl.r, c: cl.c, at: at });
          var gi = -1;
          goals.forEach(function (gl, i) { if ((gl.kind === 'w' && cl.t.k === WEED) || gl.kind === cl.t.k) gi = i; });
          if (gi >= 0 && goals[gi].got < goals[gi].need) {
            goals[gi].got++;
            var pp = cellXY(cl.r, cl.c);
            flyers.push({ t0: at + 120, x: pp.x, y: pp.y, slot: gi, k: cl.t.k, weed: cl.t.k === WEED });
          }
        });
        res.creates.forEach(function (cr) {
          if (!cr.t) return;
          cr.t.bornAt = clock + 80;
          score += cr.sp === 'rain' ? 100 : 50;
          if (!firstSp) firstSp = cr.sp;
          ctx.sticker(cr.sp);
        });
        if (firstSp) setTimeoutClock(120, function () { ctx.sfx('pop'); });
        score += removed * 10 * chain;
        if (firstSp && !save.seen[firstSp]) {
          save.seen[firstSp] = 1; S();
          banner({ bee: 'Pszczoła! Zbierze cały rząd', mole: 'Kret! Kopie dookoła', rain: 'Tęczowa konewka!' }[firstSp], 1800, 26);
        } else if (chain === 3) banner('Super!', 900, 40, GREEN);
        else if (chain === 5) banner('Ekstra!', 900, 44, LVL);
        else if (chain === 7) banner('Mistrz ogrodu!', 1100, 40, GOLD);
        return wait(res.maxD + 250);
      },
      fall: function (gv) {
        var maxT = 0;
        gv.falls.concat(gv.spawns).forEach(function (f) {
          f.t.x = f.c;
          if (gv.spawns.indexOf(f) >= 0) f.t.y = f.from;
          var dist = f.to - f.from, dur = 70 + 75 * Math.sqrt(dist);
          moveTo(f.t, f.c, f.to, dur, true);
          maxT = Math.max(maxT, dur);
        });
        return wait(maxT + 40);
      }
    };
    function setTimeoutClock(ms, fn) { wait(ms).then(function () { if (!dead) fn(); }); }

    // ---------- game flow ----------
    function goalsDone() { return goals.every(function (gl) { return gl.got >= gl.need; }); }
    function startLevel(n, cur) {
      lvl = n; def = levelDef(n);
      if (cur) {
        B = boardFrom(def, cur.board);
        moves = cur.moves; score = cur.score || 0;
        goals = def.goals.map(function (gl, i) { var got = Math.min(gl.need, cur.got[i] || 0); return { kind: gl.kind, need: gl.need, got: got, shown: got, bump: 0 }; });
      } else {
        B = new Board(def); B.fill();
        moves = def.moves; score = 0;
        goals = def.goals.map(function (gl) { return { kind: gl.kind, need: gl.need, got: 0, shown: 0, bump: 0 }; });
      }
      persist();
      dying = []; fx = []; parts = []; flyers = []; banners = []; sel = null; hint = null; drag = null;
      mapEl.hidden = true;
      layout(); buildCaches();
      var maxT = 0;
      for (var r = 0; r < B.R; r++) for (var c = 0; c < B.C; c++) {
        var t = B.g[r][c];
        if (!t) continue;
        t.x = c; t.y = r - B.R - 1;
        var dur = 70 + 75 * Math.sqrt(B.R + 1), delay = c * 35 + (B.R - r) * 25;
        moveTo(t, c, r, dur, true, delay);
        maxT = Math.max(maxT, dur + delay);
      }
      phase = 'busy';
      wait(maxT + 100).then(function () {
        if (dead) return;
        phase = 'idle'; idleAt = clock;
        if (n === 1 && !cur) banner('Przesuń warzywko!', 1500, 32);
      });
    }
    function doSwap(a, b) {
      if (!B.in(b.r, b.c) || phase !== 'idle') return;
      sel = null; hint = null;
      if (!B.canSwap(a, b)) { var t = B.at(a); if (t) { shake = { t: t, t0: clock }; ctx.sfx('error'); } return; }
      phase = 'busy';
      playMove(B, a, b, hooks).then(function (res) {
        if (dead) return;
        if (!res.ok) { phase = 'idle'; idleAt = clock; return; }
        return afterMove();
      });
    }
    async function afterMove() {
      flushVeg();
      if (goalsDone()) return win();
      if (moves <= 0) return fail();
      if (!B.findMove() && !(await reshuffle())) return stuck();
      if (dead) return;
      persist();
      phase = 'idle'; idleAt = clock;
    }
    // false when even a fresh board (same weeds, goals and moves) has no move: the level ends with a refund
    async function reshuffle() {
      banner('Tasuję!', 1300, 44, LVL);
      ctx.sfx('whoosh');
      await wait(500);
      if (dead) return true;
      var ok = B.shuffle();
      if (!ok) {
        var nb = rebuilt();
        if (!nb) return false;
        B = nb;
        dying = []; sel = null; hint = null;
        for (var r = 0; r < B.R; r++) for (var c = 0; c < B.C; c++) { var t = B.g[r][c]; if (t) { t.x = c; t.y = r - B.R - 1; moveTo(t, c, r, 450, true, c * 30); } }
        await wait(800);
        return true;
      }
      for (var r2 = 0; r2 < B.R; r2++) for (var c2 = 0; c2 < B.C; c2++) { var t2 = B.g[r2][c2]; if (t2) moveTo(t2, c2, r2, 450); }
      await wait(500);
      return true;
    }
    // a new board keeping the weeds still standing (and their strength)
    function rebuilt() {
      var map = [];
      for (var r = 0; r < B.R; r++) {
        var row = '';
        for (var c = 0; c < B.C; c++) {
          var t = B.hole[r][c] ? null : B.g[r][c];
          row += B.hole[r][c] ? '#' : t && t.k === WEED ? (t.hp >= 2 ? 'W' : 'w') : '.';
        }
        map.push(row);
      }
      var d2 = { size: def.size, kinds: def.kinds, moves: def.moves, goals: def.goals, map: map };
      var nb = new Board(d2); nb.fill();
      nb.def = def;
      return !nb.runs().length && nb.findMove() ? nb : null;
    }
    // board with no possible move even after a rebuild: give the stars back
    async function stuck() {
      phase = 'over';
      clearCur();
      ctx.refund(PRICE, 'poziom ' + lvl + ', zaplątane warzywka');
      ctx.sfx('error');
      await wait(700);
      if (dead) return;
      var n = lvl;
      panelRef = ctx.panel({
        title: 'Warzywka się zaplątały', lines: ['Nie da się już ułożyć żadnej trójki.', 'Oddaję ' + PRICE + ' ★. Spróbuj jeszcze raz!'],
        price: PRICE, button: 'Jeszcze raz', note: 'poziom ' + n,
        onPlay: function () { closePanel(); startLevel(n); }, secondary: secondary()
      });
    }

    // ---------- round in progress: saved after every move, so a paid level survives the app being closed ----------
    function persist() {
      if (!B) return;
      var board = [];
      for (var r = 0; r < B.R; r++) {
        var row = [];
        for (var c = 0; c < B.C; c++) { var t = B.g[r][c]; row.push(t ? [t.k, t.sp || 0, t.dir || 0, t.hp || 0] : 0); }
        board.push(row);
      }
      save.cur = { lvl: lvl, moves: moves, score: score, got: goals.map(function (gl) { return gl.got; }), board: board };
      S();
    }
    function clearCur() { if (save.cur) { save.cur = null; S(); } }
    function boardFrom(d, rows) {
      var b = new Board(d);
      for (var r = 0; r < b.R; r++) for (var c = 0; c < b.C; c++) {
        var q = rows[r][c];
        if (b.hole[r][c] || !q) { b.g[r][c] = null; continue; }
        var t = b.tile(q[0]); t.sp = q[1] || null; t.dir = q[2] || null; t.hp = q[3] || 0; t.x = c; t.y = r;
        b.g[r][c] = t;
      }
      return b;
    }
    function validCur(c) {
      if (!c || !(c.lvl >= 1) || !(c.moves > 0) || !Array.isArray(c.got) || !Array.isArray(c.board)) return false;
      var d = levelDef(c.lvl);
      if (c.lvl > save.unlocked || c.got.length !== d.goals.length || c.board.length !== d.size) return false;
      for (var r = 0; r < d.size; r++) {
        if (!Array.isArray(c.board[r]) || c.board[r].length !== d.size) return false;
        for (var k = 0; k < d.size; k++) {
          var q = c.board[r][k], hole = d.map[r][k] === '#';
          if (hole ? q : !(Array.isArray(q) && typeof q[0] === 'number' && q[0] >= WEED && q[0] < d.kinds)) return false;
        }
      }
      return !!boardFrom(d, c.board).findMove();
    }
    function resumePanel() {
      closePanel();
      var c = save.cur, d = levelDef(c.lvl);
      var left = d.goals.map(function (gl, i) { return { kind: gl.kind, need: gl.need, got: Math.min(gl.need, c.got[i] || 0) }; });
      panelRef = ctx.panel({
        title: 'Poziom ' + c.lvl, medals: true,
        lines: ['Masz zaczęty poziom ' + c.lvl + '.', 'Zostało ' + c.moves + ' ' + plural(['ruch', 'ruchy', 'ruchów'], c.moves) + '.',
          { text: left.map(function (gl) { return goalText(gl, true); }).join(' · '), muted: true }],
        button: 'Graj dalej',
        onPlay: function () { closePanel(); startLevel(c.lvl, c); },
        secondary: [
          { label: 'Nowa gra', onClick: function () { panelRef = null; clearCur(); showMap(); levelPanel(save.unlocked); } },
          { label: 'Wróć do gier', onClick: function () { closePanel(); ctx.exit(); } }
        ]
      });
    }
    function starsFor(left, total) { return left >= Math.ceil(total * 0.25) ? 3 : left >= Math.ceil(total * 0.1) ? 2 : 1; }
    function starStr(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }
    function goalText(gl, withGot) {
      var forms = gl.kind === 'w' ? WEED_FORMS : KINDS[gl.kind].forms;
      return withGot ? Math.min(gl.got, gl.need) + ' z ' + gl.need + ' ' + plural(forms, gl.need) : gl.need + ' ' + plural(forms, gl.need);
    }
    function goalsLine(d) {
      var col = d.goals.filter(function (gl) { return gl.kind !== 'w'; }).map(function (gl) { return goalText(gl); });
      var weed = d.goals.filter(function (gl) { return gl.kind === 'w'; })[0];
      var parts2 = [];
      if (col.length) parts2.push('Zbierz ' + col.join(' i ') + '.');
      if (weed) parts2.push('Wyrwij ' + goalText(weed) + '.');
      return parts2.join(' ');
    }
    var TIPS = {
      1: 'Przesuń warzywko na pole obok. Trzy takie same w rzędzie znikają!',
      2: '4 w rzędzie dają pszczołę. Pszczoła zbiera cały rząd.',
      3: 'Kształt L albo T daje kreta. Kret kopie dookoła.',
      4: '5 w rzędzie daje tęczową konewkę. Zamień ją z warzywkiem!',
      10: 'Chwasty! Zrób trójkę obok chwastu, żeby go wyrwać.',
      13: 'Nowe warzywo: dynia!',
      16: 'Gruby chwast trzeba wyrwać dwa razy.'
    };
    function closePanel() { if (panelRef) { panelRef.close(); panelRef = null; } }
    function secondary() {
      return [{ label: 'Mapa', onClick: function () { closePanel(); showMap(); } }, { label: 'Wróć do gier', onClick: function () { closePanel(); ctx.exit(); } }];
    }
    function levelPanel(n) {
      closePanel();
      var d = levelDef(n), st = save.stars[n] || 0, lines = [goalsLine(d), 'Masz ' + d.moves + ' ruchów.'];
      if (TIPS[n]) lines.push({ text: TIPS[n], muted: true });
      panelRef = ctx.panel({
        title: 'Poziom ' + n, big: st ? starStr(st) : '', lines: lines, price: PRICE, button: 'Graj', note: 'poziom ' + n, medals: true,
        onPlay: function () { closePanel(); startLevel(n); }, secondary: secondary()
      });
    }
    function giveSeeds(stars) {
      var kinds = goals.filter(function (gl) { return gl.kind !== 'w' && KINDS[gl.kind].seed; }).map(function (gl) { return KINDS[gl.kind].seed; });
      var list;
      if (!kinds.length) list = [{ kind: 'kwiatek', n: 1 }];
      else if (kinds.length === 1) list = [{ kind: kinds[0], n: stars === 3 ? 2 : 1 }];
      else list = kinds.slice(0, 2).map(function (k) { return { kind: k, n: 1 }; });
      try {
        var arr = JSON.parse(localStorage.getItem(INBOX) || '[]');
        if (!Array.isArray(arr)) arr = [];
        list.forEach(function (s) { arr.push({ kind: s.kind, n: s.n, from: 'trojki' }); });
        localStorage.setItem(INBOX, JSON.stringify(arr));
      } catch (e) {}
      return list;
    }
    // the result is saved the moment the goals are met, so leaving during the animation keeps it
    async function win() {
      phase = 'over';
      var stars = starsFor(moves, def.moves);
      save.stars[lvl] = Math.max(save.stars[lvl] || 0, stars);
      var best = save.best[lvl] || 0, isBest = score > best;
      if (isBest) save.best[lvl] = score;
      save.unlocked = Math.max(save.unlocked, lvl + 1);
      save.cur = null;
      S();
      ctx.stat('wins', 1);
      ctx.stat('levels', lvl, 'max');
      if (stars === 3) ctx.sticker('stars3');
      var seeds = giveSeeds(stars);
      await wait(700);
      if (dead) return;
      banner('Brawo!', 1100, 52, GREEN);
      ctx.sfx('win');
      for (var i = 0; i < 6; i++) { var p = cellXY(Math.floor(B.R / 2), i % B.C); burst(p.x + (Math.random() - 0.5) * Lt.bw, p.y, RAINBOW[i], 10, 2); }
      await wait(1100);
      if (dead) return;
      var seedLine = 'Do Ogródka: ' + seeds.map(function (s) { return (s.n === 1 ? 'nasionko ' : '2 nasionka ') + SEED_GEN[s.kind]; }).join(' i ') + '.';
      var n = lvl;
      panelRef = ctx.panel({
        big: starStr(stars), title: 'Brawo!', medals: true,
        lines: ['Poziom ' + n + ' zaliczony! Zostało ruchów: ' + moves + '.', seedLine, { text: score + ' pkt' + (isBest ? ' (rekord!)' : ' (rekord: ' + best + ')'), muted: true }],
        price: PRICE, button: 'Poziom ' + (n + 1), note: 'poziom ' + (n + 1),
        onPlay: function () { closePanel(); startLevel(n + 1); }, secondary: secondary()
      });
    }
    async function fail() {
      phase = 'over';
      clearCur();
      ctx.sfx('lose');
      var got = 0, need = 0;
      goals.forEach(function (gl) { got += Math.min(gl.got, gl.need); need += gl.need; });
      var half = need > 0 && got / need > 0.5, n = lvl;
      if (half) ctx.refund(REFUND, 'poziom ' + n + ', ponad połowa');
      await wait(700);
      if (dead) return;
      var lines = ['Zabrakło ruchów.'].concat(goals.map(function (gl) { return 'Masz ' + goalText(gl, true) + '.'; }));
      if (half) lines.push('Ponad połowa! Oddaję ' + REFUND + ' ★.');
      else lines.push({ text: 'Za ponad połowę celu oddaję ' + REFUND + ' ★.', muted: true });
      panelRef = ctx.panel({
        title: half ? 'Prawie!' : 'Koniec ruchów', lines: lines, price: PRICE, button: 'Jeszcze raz', note: 'poziom ' + n,
        onPlay: function () { closePanel(); startLevel(n); }, secondary: secondary()
      });
    }

    // ---------- map ----------
    function showMap() {
      phase = 'map'; sel = null; hint = null;
      var n = save.unlocked, maxShow = Math.max(30, Math.ceil((n + 5) / 5) * 5), total = 0;
      Object.keys(save.stars).forEach(function (k) { total += save.stars[k]; });
      var h = '<div class="tj-in"><div class="tj-head"><h2>Grządkowe trójki</h2><div class="tj-sum"><b>★ ' + total + '</b><br>z poziomów</div></div>';
      h += '<button type="button" class="tj-go" data-lv="' + n + '">Graj: poziom ' + n + '</button><div class="tj-grid">';
      for (var i = 1; i <= maxShow; i++) {
        var st = save.stars[i] || 0, cls = i < n || st ? 'done' : i === n ? 'cur' : 'lock';
        if (i === n) cls = 'cur';
        h += '<button type="button" class="tj-lv ' + cls + '" data-lv="' + (i <= n ? i : '') + '"' + (i > n ? ' aria-disabled="true"' : '') + '><i>' + i + '</i><s>' +
          (st ? '<b>' + '★★★'.slice(0, st) + '</b>' + '★★★'.slice(0, 3 - st) : (i < n ? '★★★' : '')) + '</s></button>';
      }
      h += '</div><p class="tj-note">Każdy poziom kosztuje ' + PRICE + ' ★. Warzywa z wygranego poziomu lecą jako nasiona do Ogródka.</p>';
      h += '<button type="button" class="tj-back">Wróć do gier</button></div>';
      mapEl.innerHTML = h;
      mapEl.hidden = false;
      var cur = mapEl.querySelector('.tj-lv.cur');
      if (cur && cur.scrollIntoView && n > 15) cur.scrollIntoView({ block: 'center' });
    }
    function onMapClick(e) {
      var b = e.target.closest && e.target.closest('button');
      if (!b) return;
      if (b.classList.contains('tj-back')) { ctx.exit(); return; }
      var lv = +b.getAttribute('data-lv');
      if (lv) levelPanel(lv);
    }
    mapEl.addEventListener('click', onMapClick);

    // ---------- input ----------
    function cellAt(e) {
      var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (!Lt) return null;
      var c = Math.floor((x - Lt.bx) / Lt.cs), rr = Math.floor((y - Lt.by) / Lt.cs);
      if (!B || !B.in(rr, c)) return null;
      return { r: rr, c: c, x: x, y: y };
    }
    function onDown(e) {
      if (phase !== 'idle') return;
      idleAt = clock; hint = null;
      var p = cellAt(e);
      if (!p) { sel = null; return; }
      drag = { r: p.r, c: p.c, x: p.x, y: p.y, id: e.pointerId, done: false };
      try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    }
    function onMove(e) {
      if (!drag || drag.done || e.pointerId !== drag.id || phase !== 'idle') return;
      var r = cv.getBoundingClientRect(), dx = e.clientX - r.left - drag.x, dy = e.clientY - r.top - drag.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < Lt.cs * 0.32) return;
      drag.done = true;
      var t = Math.abs(dx) > Math.abs(dy) ? { r: drag.r, c: drag.c + (dx > 0 ? 1 : -1) } : { r: drag.r + (dy > 0 ? 1 : -1), c: drag.c };
      doSwap({ r: drag.r, c: drag.c }, t);
    }
    function onUp(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag; drag = null;
      if (d.done || phase !== 'idle') return;
      var p = { r: d.r, c: d.c };
      if (sel && sel.r === p.r && sel.c === p.c) sel = null;
      else if (sel && Math.abs(sel.r - p.r) + Math.abs(sel.c - p.c) === 1) doSwap(sel, p);
      else { var t = B.at(p); sel = t && t.k !== WEED ? p : null; if (t && t.k === WEED) { shake = { t: t, t0: clock }; ctx.sfx('error'); } else if (sel) ctx.sfx('tap'); }
    }
    function onCancel() { drag = null; }
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onCancel);

    var ro = new ResizeObserver(function () { resize(); });
    ro.observe(el);
    resize();
    raf = requestAnimationFrame(tick);
    showMap();
    if (save.cur && validCur(save.cur)) resumePanel();
    else { if (save.cur) clearCur(); levelPanel(save.unlocked); }
    // read-only peek for automated tests
    NG.impl.trojki.debug = function () { return { B: B, phase: phase, moves: moves, goals: goals, L: Lt, lvl: lvl, cv: cv, setMoves: function (n) { moves = n; } }; };

    return {
      destroy: function () {
        dead = true;
        // mid-move the saved round is the one before this move, which will be played again: don't count its veg twice
        if (save.cur) vegBuf = 0; else flushVeg();
        cancelAnimationFrame(raf);
        ro.disconnect();
        cv.removeEventListener('pointerdown', onDown);
        cv.removeEventListener('pointermove', onMove);
        cv.removeEventListener('pointerup', onUp);
        cv.removeEventListener('pointercancel', onCancel);
        mapEl.removeEventListener('click', onMapClick);
        closePanel();
        NG.impl.trojki.debug = null;
        waits = [];
        el.innerHTML = '';
      },
      pause: function () { paused = true; if (phase === 'idle') persist(); },
      resume: function () { paused = false; last = 0; }
    };
  }

  NG.register('trojki', {
    meta: { music: 'meadow' },
    medals: [
      { id: 'lv5', stat: 'levels', at: 5, tier: 1, text: 'Poziom 5' },
      { id: 'lv15', stat: 'levels', at: 15, tier: 2, text: 'Poziom 15' },
      { id: 'lv30', stat: 'levels', at: 30, tier: 3, text: 'Poziom 30' }
    ],
    quests: [
      { id: 'win', stat: 'wins', n: [1, 2], text: 'Wygraj {n} {poziom} w Trójkach', forms: ['poziom', 'poziomy', 'poziomów'] },
      { id: 'veg', stat: 'veg', n: [40, 70], text: 'Zbierz {n} warzyw w Trójkach' }
    ],
    stickers: [
      { id: 'bee', emoji: '🐝', name: 'Pierwsza pszczoła' },
      { id: 'mole', emoji: '🐹', name: 'Pierwszy kret' },
      { id: 'rain', emoji: '🌈', name: 'Tęczowa konewka' },
      { id: 'chain3', emoji: '🔥', name: 'Seria ×3' },
      { id: 'stars3', emoji: '⭐', name: 'Trzy gwiazdki' }
    ],
    mount: mount,
    core: { Board: Board, playMove: playMove, levelDef: levelDef, LEVELS: LEVELS, KINDS: KINDS, mulberry: mulberry }
  });
})();
