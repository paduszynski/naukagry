/* Klockownia: drewniane klocki na planszy 8×8.
 * Przeciągnij jeden z trzech klocków na planszę; pełny rząd albo kolumna znika.
 * Kilka linii naraz i czyszczenie w kolejnych ruchach dają mnożnik (combo).
 * Koniec, gdy żaden z pozostałych klocków się nie mieści.
 * Motywy kolorów: drewno (zawsze), kreda (poziom 3+), owoce (poziom 6+).
 */
(function () {
  'use strict';

  var INK = '#1d2f6f', STAR = '#e3a008', LVL = '#7a4fc4';
  var FONT = '"Patrick Hand","Comic Sans MS",cursive';
  var N = 8, PRICE = 100;

  // ---------- shapes ----------
  function parse(rows) {
    var cells = [];
    rows.forEach(function (row, r) { for (var c = 0; c < row.length; c++) if (row[c] === 'X') cells.push([r, c]); });
    return cells;
  }
  function normalize(cells) {
    var mr = Infinity, mc = Infinity;
    cells.forEach(function (p) { mr = Math.min(mr, p[0]); mc = Math.min(mc, p[1]); });
    return cells.map(function (p) { return [p[0] - mr, p[1] - mc]; })
      .sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
  }
  function rotate(cells) { return normalize(cells.map(function (p) { return [p[1], -p[0]]; })); }
  function mirror(cells) { return normalize(cells.map(function (p) { return [p[0], -p[1]]; })); }
  function orientations(rows, withMirror) {
    var out = [], seen = {};
    var bases = [normalize(parse(rows))];
    if (withMirror) bases.push(mirror(bases[0]));
    bases.forEach(function (b) {
      var c = b;
      for (var i = 0; i < 4; i++) {
        var k = JSON.stringify(c);
        if (!seen[k]) { seen[k] = 1; out.push(c); }
        c = rotate(c);
      }
    });
    return out;
  }
  // e: early-game weight, m: middle, l: late game
  var FAMILIES = [
    { id: 'dot', rows: ['X'], e: 1.3, m: 0.55, l: 0.3 },
    { id: 'line2', rows: ['XX'], e: 1.5, m: 1, l: 0.6 },
    { id: 'line3', rows: ['XXX'], e: 1.2, m: 1, l: 0.9 },
    { id: 'line4', rows: ['XXXX'], e: 0.35, m: 0.9, l: 1 },
    { id: 'line5', rows: ['XXXXX'], e: 0.05, m: 0.6, l: 0.9 },
    { id: 'sq2', rows: ['XX', 'XX'], e: 1.3, m: 1, l: 0.9 },
    { id: 'sq3', rows: ['XXX', 'XXX', 'XXX'], e: 0.03, m: 0.45, l: 0.8 },
    { id: 'corner3', rows: ['X.', 'XX'], e: 1.4, m: 1, l: 0.8 },
    { id: 'L4', rows: ['X.', 'X.', 'XX'], mirror: true, e: 0.45, m: 1, l: 1.1 },
    { id: 'T4', rows: ['XXX', '.X.'], e: 0.35, m: 0.9, l: 1 },
    { id: 'SZ', rows: ['.XX', 'XX.'], mirror: true, e: 0.15, m: 0.8, l: 1.1 },
    { id: 'corner5', rows: ['X..', 'X..', 'XXX'], e: 0.05, m: 0.6, l: 0.9 }
  ];
  FAMILIES.forEach(function (f) { f.shapes = orientations(f.rows, f.mirror); });

  // ---------- themes ----------
  var THEMES = {
    drewno: { name: 'Drewno', lvl: 1, style: 'wood',
      colors: ['#e07a5f', '#efb54f', '#84b98f', '#6fa3d8', '#5db5ad', '#e899a4'] },
    kreda: { name: 'Kreda', lvl: 3, style: 'chalk',
      colors: ['#f7a8a8', '#ffe08a', '#a9e6a1', '#9fd0ff', '#ffc38c', '#f2f5ff'] },
    owoce: { name: 'Owoce', lvl: 6, style: 'fruit',
      colors: ['#e8505b', '#f5973a', '#f5cf45', '#8cc152', '#5b7fd6', '#f27a96'] }
  };
  var THEME_ORDER = ['drewno', 'kreda', 'owoce'];

  // ---------- small helpers ----------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function shade(h, amt) { // amt -1..1: towards black / white
    var c = hexRgb(h);
    var t = amt < 0 ? 0 : 255, a = Math.abs(amt);
    return 'rgb(' + c.map(function (v) { return Math.round(v + (t - v) * a); }).join(',') + ')';
  }
  function rgba(h, a) { var c = hexRgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function rng(seed) { // mulberry32
    var s = seed >>> 0;
    return function () {
      s = s + 0x6D2B79F5 >>> 0;
      var t = s;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function makeCanvas(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

  // ---------- block sprites ----------
  function drawWoodGrain(g, x, y, w, h, color, R, lw) {
    g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round';
    var lines = 3 + Math.floor(R() * 2);
    for (var i = 0; i < lines; i++) {
      var y0 = y + h * (0.12 + (i + R() * 0.6) / lines * 0.85);
      var a1 = (R() - 0.5) * h * 0.18, a2 = (R() - 0.5) * h * 0.18;
      g.beginPath();
      g.moveTo(x - 2, y0);
      g.bezierCurveTo(x + w * 0.33, y0 + a1, x + w * 0.66, y0 + a2, x + w + 2, y0 + (R() - 0.5) * h * 0.08);
      g.stroke();
    }
    if (R() < 0.35) {
      g.beginPath();
      g.ellipse(x + w * (0.25 + R() * 0.5), y + h * (0.3 + R() * 0.4), w * 0.07, h * 0.035, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }

  function blockSprite(theme, col, v, px) {
    var cv = makeCanvas(px, px), g = cv.getContext('2d'), s = px;
    var T = THEMES[theme], c = T.colors[col % T.colors.length];
    var R = rng(col * 7919 + v * 104729 + (theme === 'kreda' ? 31 : theme === 'owoce' ? 57 : 3));
    var m = s * 0.04, depth = s * 0.085, r = s * 0.17;
    if (T.style === 'chalk') {
      var cm = s * 0.08;
      g.save();
      rr(g, cm, cm, s - 2 * cm, s - 2 * cm, s * 0.12);
      g.fillStyle = rgba(c, 0.5); g.fill();
      g.clip();
      // diagonal chalk hatching
      g.strokeStyle = c; g.lineCap = 'round';
      for (var k = -s; k < s * 2; k += s * 0.13) {
        g.lineWidth = s * (0.05 + R() * 0.03);
        g.globalAlpha = 0.7 + R() * 0.3;
        g.beginPath(); g.moveTo(k + (R() - 0.5) * s * 0.05, s); g.lineTo(k + s + (R() - 0.5) * s * 0.05, 0); g.stroke();
      }
      g.globalAlpha = 1;
      // chalk dust gaps
      g.fillStyle = 'rgba(46,75,63,0.35)';
      for (var d = 0; d < s * 0.9; d++) g.fillRect(R() * s, R() * s, s * 0.025, s * 0.025);
      g.restore();
      // rough white outline (two jittered passes)
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineJoin = 'round';
      for (var pass = 0; pass < 2; pass++) {
        var j = function () { return (R() - 0.5) * s * 0.04; };
        g.lineWidth = s * (pass ? 0.025 : 0.045);
        g.beginPath();
        g.moveTo(cm + j(), cm + j());
        g.lineTo(s - cm + j(), cm + j());
        g.lineTo(s - cm + j(), s - cm + j());
        g.lineTo(cm + j(), s - cm + j());
        g.closePath();
        g.stroke();
      }
      return cv;
    }
    // wooden / fruity block: darker base gives the block thickness, face on top
    rr(g, m, m + depth * 0.3, s - 2 * m, s - 2 * m - depth * 0.3, r);
    g.fillStyle = shade(c, -0.28); g.fill();
    g.save();
    rr(g, m, m, s - 2 * m, s - 2 * m - depth, r);
    g.fillStyle = c; g.fill();
    g.clip();
    if (T.style === 'wood') drawWoodGrain(g, m, m, s - 2 * m, s - 2 * m - depth, rgba('#5a3510', 0.16), R, s * 0.028);
    var hl = g.createLinearGradient(0, m, 0, s * 0.55);
    hl.addColorStop(0, 'rgba(255,255,255,0.42)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hl; g.fillRect(0, 0, s, s);
    if (T.style === 'fruit') drawFruit(g, col, s, m, depth, R);
    g.restore();
    if (T.style === 'wood') {
      // carved inner square, like a toy block
      var ix = s * 0.25, iy = s * 0.22, iw = s * 0.5, ih = s * 0.46;
      rr(g, ix, iy + s * 0.018, iw, ih, s * 0.09);
      g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = s * 0.03; g.stroke();
      rr(g, ix, iy, iw, ih, s * 0.09);
      g.strokeStyle = rgba('#4a2a0a', 0.16); g.lineWidth = s * 0.03; g.stroke();
    }
    rr(g, m, m, s - 2 * m, s - 2 * m, r);
    g.strokeStyle = 'rgba(29,47,111,0.6)'; g.lineWidth = Math.max(1, s * 0.035); g.stroke();
    return cv;
  }

  function drawFruit(g, col, s, m, depth, R) {
    var cx = s / 2, cy = (s - depth) / 2 + m * 0.3;
    var i;
    function seed(x, y, a, color, sz) {
      g.save(); g.translate(x, y); g.rotate(a);
      g.beginPath(); g.ellipse(0, 0, s * 0.028 * sz, s * 0.05 * sz, 0, 0, Math.PI * 2);
      g.fillStyle = color; g.fill(); g.restore();
    }
    function leaf(x, y, a) {
      g.save(); g.translate(x, y); g.rotate(a);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * 0.12, -s * 0.1, s * 0.22, 0); g.quadraticCurveTo(s * 0.12, s * 0.07, 0, 0);
      g.fillStyle = '#4f9a3a'; g.fill(); g.restore();
    }
    switch (col) {
      case 0: // strawberry: seeds + leaf
        for (i = 0; i < 6; i++) seed(s * (0.28 + (i % 3) * 0.22 + (Math.floor(i / 3) ? 0.11 : 0)), s * (0.42 + Math.floor(i / 3) * 0.2), 0.3, '#ffe39a', 1);
        leaf(s * 0.5, s * 0.2, -2.6); leaf(s * 0.5, s * 0.2, -0.5);
        break;
      case 1: // orange slice
        g.beginPath(); g.arc(cx, cy, s * 0.29, 0, Math.PI * 2); g.fillStyle = '#ffd7a6'; g.fill();
        g.beginPath(); g.arc(cx, cy, s * 0.24, 0, Math.PI * 2); g.fillStyle = '#ffab4f'; g.fill();
        g.strokeStyle = '#ffd7a6'; g.lineWidth = s * 0.03;
        for (i = 0; i < 6; i++) { var a = i * Math.PI / 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * s * 0.24, cy + Math.sin(a) * s * 0.24); g.stroke(); }
        break;
      case 2: // lemon
        g.save(); g.translate(cx, cy); g.rotate(-0.5);
        g.beginPath(); g.ellipse(0, 0, s * 0.27, s * 0.19, 0, 0, Math.PI * 2); g.fillStyle = '#fff09a'; g.fill();
        g.beginPath(); g.ellipse(-s * 0.08, -s * 0.06, s * 0.07, s * 0.035, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fill();
        g.restore();
        leaf(cx + s * 0.12, cy - s * 0.17, -0.8);
        break;
      case 3: // kiwi
        g.beginPath(); g.arc(cx, cy, s * 0.26, 0, Math.PI * 2); g.fillStyle = '#b6e07a'; g.fill();
        g.beginPath(); g.arc(cx, cy, s * 0.09, 0, Math.PI * 2); g.fillStyle = '#f4f7d8'; g.fill();
        for (i = 0; i < 9; i++) { var b = i / 9 * Math.PI * 2; seed(cx + Math.cos(b) * s * 0.165, cy + Math.sin(b) * s * 0.165, b + Math.PI / 2, '#2c2c2c', 0.8); }
        break;
      case 4: // blueberries
        [[0.36, 0.42], [0.62, 0.38], [0.5, 0.62]].forEach(function (p) {
          g.beginPath(); g.arc(s * p[0], s * p[1], s * 0.13, 0, Math.PI * 2); g.fillStyle = '#3f5fb8'; g.fill();
          g.beginPath(); g.arc(s * p[0] - s * 0.04, s * p[1] - s * 0.04, s * 0.035, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fill();
        });
        break;
      default: // watermelon
        g.fillStyle = '#5aa24a'; g.fillRect(0, s - depth - m - s * 0.12, s, s * 0.12);
        g.fillStyle = '#d9f0c8'; g.fillRect(0, s - depth - m - s * 0.16, s, s * 0.045);
        for (i = 0; i < 5; i++) seed(s * (0.22 + i * 0.14), s * (i % 2 ? 0.34 : 0.52), (i % 2 ? 0.4 : -0.4), '#3a2020', 1);
    }
  }

  // ---------- game ----------
  NG.register('klocki', {
    mount: function (el, ctx) {
      var save = ctx.load({ best: 0, theme: 'drewno', games: 0 });
      if (!THEMES[save.theme] || ctx.level() < THEMES[save.theme].lvl) save.theme = 'drewno';

      var cv = document.createElement('canvas');
      el.appendChild(cv);
      var g = cv.getContext('2d');

      var W = 0, H = 0, dpr = 1;
      var L = {}; // layout
      var sprites = {}, boardCache = null, bgCache = null;

      var grid, tray, score, shownScore, streak, setsDealt, placed, state = 'idle';
      var drag = null;        // { idx, x, y, t0, mouse }
      var ghost = null;       // { r, c, lines:{rows,cols} }
      var returning = [];     // tray pieces flying back
      var placeAnims = {};    // cellIndex -> t0
      var pops = [], parts = [], floats = [];
      var overT0 = 0, newBest = false, bestAtStart = save.best;
      var raf = 0, paused = false, destroyed = false, timers = [];
      var panelRef = null, picker = null;

      // ----- board logic -----
      function emptyGrid() { var a = []; for (var r = 0; r < N; r++) { a.push([]); for (var c = 0; c < N; c++) a[r].push(-1); } return a; }
      function fitsAt(gr, cells, r0, c0) {
        for (var i = 0; i < cells.length; i++) {
          var r = r0 + cells[i][0], c = c0 + cells[i][1];
          if (r < 0 || c < 0 || r >= N || c >= N || gr[r][c] >= 0) return false;
        }
        return true;
      }
      function dims(cells) { var h = 0, w = 0; cells.forEach(function (p) { h = Math.max(h, p[0] + 1); w = Math.max(w, p[1] + 1); }); return { w: w, h: h }; }
      function anyFit(gr, cells) {
        var d = dims(cells);
        for (var r = 0; r + d.h <= N; r++) for (var c = 0; c + d.w <= N; c++) if (fitsAt(gr, cells, r, c)) return true;
        return false;
      }
      // rows/cols that would be full after putting cells at r0,c0
      function linesAfter(gr, cells, r0, c0) {
        var mark = {};
        cells.forEach(function (p) { mark[(r0 + p[0]) * N + c0 + p[1]] = 1; });
        var rows = [], cols = [], r, c, full;
        for (r = 0; r < N; r++) { full = true; for (c = 0; c < N; c++) if (gr[r][c] < 0 && !mark[r * N + c]) { full = false; break; } if (full) rows.push(r); }
        for (c = 0; c < N; c++) { full = true; for (r = 0; r < N; r++) if (gr[r][c] < 0 && !mark[r * N + c]) { full = false; break; } if (full) cols.push(c); }
        return { rows: rows, cols: cols, n: rows.length + cols.length };
      }
      function copyGrid(gr) { return gr.map(function (row) { return row.slice(); }); }
      function applyPlace(gr, cells, r0, c0, val) {
        cells.forEach(function (p) { gr[r0 + p[0]][c0 + p[1]] = val; });
        var ln = linesAfter(gr, [], 0, 0);
        ln.rows.forEach(function (r) { for (var c = 0; c < N; c++) gr[r][c] = -1; });
        ln.cols.forEach(function (c) { for (var r = 0; r < N; r++) gr[r][c] = -1; });
        return ln;
      }
      // best spot by a simple greedy rule: clear lines, then hug neighbours / walls
      function bestSpot(gr, cells) {
        var d = dims(cells), best = null;
        for (var r = 0; r + d.h <= N; r++) for (var c = 0; c + d.w <= N; c++) {
          if (!fitsAt(gr, cells, r, c)) continue;
          var sc = linesAfter(gr, cells, r, c).n * 100;
          cells.forEach(function (p) {
            var rr2 = r + p[0], cc = c + p[1];
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) {
              var a = rr2 + o[0], b = cc + o[1];
              if (a < 0 || b < 0 || a >= N || b >= N || gr[a][b] >= 0) sc += 1;
            });
          });
          if (!best || sc > best.sc) best = { r: r, c: c, sc: sc };
        }
        return best;
      }
      function fitCount(gr, cells, enough) {
        var d = dims(cells), n = 0;
        for (var r = 0; r + d.h <= N; r++) for (var c = 0; c + d.w <= N; c++) if (fitsAt(gr, cells, r, c) && ++n >= enough) return n;
        return n;
      }
      function canClear(gr, cells) {
        var d = dims(cells);
        for (var r = 0; r + d.h <= N; r++) for (var c = 0; c + d.w <= N; c++)
          if (fitsAt(gr, cells, r, c) && linesAfter(gr, cells, r, c).n > 0) return true;
        return false;
      }
      function setPlaceable(gr, set) {
        var orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
        for (var o = 0; o < orders.length; o++) {
          var tg = copyGrid(gr), ok = true;
          for (var i = 0; i < 3; i++) {
            var cells = set[orders[o][i]].cells, sp = bestSpot(tg, cells);
            if (!sp) { ok = false; break; }
            applyPlace(tg, cells, sp.r, sp.c, 0);
          }
          if (ok) return true;
        }
        return false;
      }

      // ----- piece generator -----
      function familyWeights(ease, hard) {
        return FAMILIES.map(function (f) { return ease > 0 ? lerp(f.m, f.e, ease) : lerp(f.m, f.l, hard); });
      }
      function randomPiece(weights) {
        var tot = 0, i;
        for (i = 0; i < weights.length; i++) tot += weights[i];
        var x = Math.random() * tot;
        for (i = 0; i < weights.length; i++) { x -= weights[i]; if (x <= 0) break; }
        var f = FAMILIES[Math.min(i, FAMILIES.length - 1)];
        return { fam: f.id, cells: f.shapes[Math.floor(Math.random() * f.shapes.length)] };
      }
      function dealSet() {
        var ease = clamp(1 - setsDealt / 9, 0, 1);          // first ~9 sets (a minute or two): easy and friendly
        var hard = clamp((setsDealt - 9) / 35, 0, 1);       // then slow ramp
        var minRoom = Math.round(2 + 8 * ease);            // early: every piece must have plenty of spots
        var weights = familyWeights(ease, hard);
        var pAll = ease > 0 ? 1 : lerp(0.8, 0.45, hard);    // chance the whole set must be placeable
        var set = null;
        for (var attempt = 0; attempt < 40 && !set; attempt++) {
          var cand = [];
          for (var k = 0; k < 3; k++) {
            var p = randomPiece(weights);
            if (ease > 0 && Math.random() < 0.5 * ease) {
              for (var t = 0; t < 8; t++) { var q = randomPiece(weights); if (canClear(grid, q.cells)) { p = q; break; } }
            }
            cand.push(p);
          }
          if (cand[0].fam === cand[1].fam && cand[1].fam === cand[2].fam) continue;
          if (!cand.some(function (pc) { return anyFit(grid, pc.cells); })) continue;
          if (ease > 0 && attempt < 30 && !cand.every(function (pc) { return fitCount(grid, pc.cells, minRoom) >= minRoom; })) continue;
          if (Math.random() < pAll && !setPlaceable(grid, cand)) continue;
          set = cand;
        }
        if (!set) { // fallback: smallest shapes that fit
          var fit = [];
          FAMILIES.forEach(function (f) { f.shapes.forEach(function (sh) { if (anyFit(grid, sh)) fit.push({ fam: f.id, cells: sh }); }); });
          fit.sort(function (a, b) { return a.cells.length - b.cells.length; });
          var pool = fit.slice(0, Math.max(3, Math.min(8, fit.length)));
          set = [0, 1, 2].map(function () { return pool[Math.floor(Math.random() * pool.length)] || { fam: 'dot', cells: [[0, 0]] }; });
        }
        var cols = [0, 1, 2, 3, 4, 5].sort(function () { return Math.random() - 0.5; });
        var now = performance.now();
        tray = set.map(function (p, i) {
          var d = dims(p.cells);
          return { fam: p.fam, cells: p.cells, w: d.w, h: d.h, col: cols[i],
            vars: p.cells.map(function () { return Math.floor(Math.random() * 3); }), inT0: now + i * 70, fits: true };
        });
        setsDealt++;
        updateFits();
      }
      function updateFits() { tray.forEach(function (p) { if (p) p.fits = anyFit(grid, p.cells); }); }

      // ----- layout -----
      function layout() {
        var pad = 12, hudH = 60;
        var B = Math.min(W - 2 * pad, 560);
        var trayH, cellT;
        for (var it = 0; it < 3; it++) {
          var cell = B / 8;
          cellT = Math.min(cell * 0.62, (Math.min(W - 8, B + 8) / 3 - 14) / 4);
          trayH = cellT * 4 + 22;
          var need = hudH + B + trayH + pad * 3;
          if (need > H) B = Math.max(160, B - (need - H));
        }
        var extra = Math.max(0, H - (hudH + B + trayH + pad * 3));
        var fr = Math.round(B * 0.03);
        var boardTop = hudH + pad + extra * 0.3;
        L.hudH = hudH;
        L.fr = fr;
        L.bx = Math.round((W - B) / 2) + fr; L.by = Math.round(boardTop) + fr;
        L.cell = (B - 2 * fr) / N;
        L.bs = L.cell * N;
        L.cellT = cellT;
        L.trayY = boardTop + B + pad + extra * 0.4;
        L.trayH = trayH;
        var trayW = Math.min(W - 8, B + 8);
        L.slotW = trayW / 3;
        L.trayX = (W - trayW) / 2;
        L.themeBtn = { x: W - 52, y: 8, w: 44, h: 44 };
      }

      function resize() {
        var r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        dpr = Math.min(window.devicePixelRatio || 1, 3);
        W = r.width; H = r.height;
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        layout();
        sprites = {}; boardCache = null; bgCache = null;
        requestDraw();
      }

      // ----- caches -----
      function sprite(col, v, size) {
        var px = Math.max(4, Math.round(size * dpr));
        var key = save.theme + '|' + col + '|' + v + '|' + px;
        return sprites[key] || (sprites[key] = blockSprite(save.theme, col, v, px));
      }

      function buildBg() {
        var c = makeCanvas(W * dpr, H * dpr), b = c.getContext('2d');
        b.scale(dpr, dpr);
        var R = rng(11), x, y;
        if (save.theme === 'drewno') {
          b.fillStyle = '#f8efdc'; b.fillRect(0, 0, W, H);
          b.strokeStyle = 'rgba(176,124,64,0.12)'; b.lineWidth = 1.5;
          for (x = 0; x < W; x += 46) { b.beginPath(); b.moveTo(x, 0); b.lineTo(x, H); b.stroke(); }
          drawWoodGrain(b, 0, 0, W, H, 'rgba(176,124,64,0.05)', R, 2);
        } else if (save.theme === 'kreda') {
          b.fillStyle = '#e7eee9'; b.fillRect(0, 0, W, H);
          b.fillStyle = 'rgba(46,75,63,0.05)';
          for (var i = 0; i < W * H / 900; i++) b.fillRect(R() * W, R() * H, 2, 2);
        } else {
          b.fillStyle = '#fff6ee'; b.fillRect(0, 0, W, H);
          var s = 26;
          b.fillStyle = 'rgba(232,80,91,0.12)';
          for (x = 0; x < W; x += s * 2) b.fillRect(x, 0, s, H);
          for (y = 0; y < H; y += s * 2) b.fillRect(0, y, W, s);
        }
        return c;
      }

      function buildBoard() {
        var fr = L.fr, B = L.bs + 2 * fr, cell = L.cell;
        var c = makeCanvas((B + 12) * dpr, (B + 12) * dpr), b = c.getContext('2d');
        b.scale(dpr, dpr);
        b.translate(6, 6);
        var R = rng(5);
        var frame, inner, cellFill, cellLine, i, j;
        if (save.theme === 'kreda') { frame = '#b07d4f'; inner = '#2e4b3f'; }
        else if (save.theme === 'owoce') { frame = '#e2b77f'; inner = '#f4dfbd'; }
        else { frame = '#c99659'; inner = '#e9d0a0'; }
        // drop shadow + frame
        rr(b, 0, 4, B, B, fr * 1.4 + 6); b.fillStyle = 'rgba(29,47,111,0.18)'; b.fill();
        rr(b, 0, 0, B, B, fr * 1.4 + 6); b.fillStyle = frame; b.fill();
        b.save(); b.clip(); drawWoodGrain(b, 0, 0, B, B, 'rgba(90,50,15,0.13)', R, 1.6); drawWoodGrain(b, 0, B * 0.4, B, B * 0.6, 'rgba(90,50,15,0.1)', R, 1.4); b.restore();
        rr(b, 0, 0, B, B, fr * 1.4 + 6); b.strokeStyle = INK; b.lineWidth = 2.5; b.stroke();
        rr(b, fr, fr, L.bs, L.bs, 6); b.fillStyle = inner; b.fill();
        if (save.theme === 'kreda') {
          b.save(); b.clip();
          b.fillStyle = 'rgba(255,255,255,0.035)';
          for (i = 0; i < 400; i++) b.fillRect(fr + R() * L.bs, fr + R() * L.bs, 3, 1.5);
          b.restore();
        }
        b.strokeStyle = 'rgba(29,47,111,0.45)'; b.lineWidth = 1.5; b.stroke();
        for (i = 0; i < N; i++) for (j = 0; j < N; j++) {
          var x = fr + j * cell, y = fr + i * cell, m = cell * 0.06;
          if (save.theme === 'kreda') {
            b.setLineDash([cell * 0.18, cell * 0.1]);
            rr(b, x + m * 1.5, y + m * 1.5, cell - 3 * m, cell - 3 * m, cell * 0.12);
            b.strokeStyle = 'rgba(255,255,255,0.16)'; b.lineWidth = 1.3; b.stroke();
            b.setLineDash([]);
          } else {
            cellFill = save.theme === 'owoce' ? '#fbefd9' : '#f3e2bd';
            cellLine = save.theme === 'owoce' ? 'rgba(160,110,60,0.25)' : 'rgba(130,85,35,0.28)';
            rr(b, x + m, y + m, cell - 2 * m, cell - 2 * m, cell * 0.14);
            b.fillStyle = cellFill; b.fill();
            b.save(); b.clip();
            b.fillStyle = 'rgba(120,75,30,0.10)'; b.fillRect(x, y, cell, cell * 0.12); // inner shadow at the top
            b.restore();
            b.strokeStyle = cellLine; b.lineWidth = 1; b.stroke();
          }
        }
        return c;
      }

      // ----- drawing -----
      function requestDraw() { if (!raf && !paused && !destroyed) raf = requestAnimationFrame(frame); }

      function drawPiece(p, x, y, cell, alpha) {
        g.globalAlpha = alpha == null ? 1 : alpha;
        for (var i = 0; i < p.cells.length; i++) {
          g.drawImage(sprite(p.col, p.vars[i], cell), x + p.cells[i][1] * cell, y + p.cells[i][0] * cell, cell, cell);
        }
        g.globalAlpha = 1;
      }
      function trayCell(p) { return Math.min(L.cellT, (L.slotW - 12) / p.w, (L.trayH - 12) / p.h); }
      function slotCenter(i) { return { x: L.trayX + L.slotW * (i + 0.5), y: L.trayY + L.trayH / 2 }; }
      function dragPos(now) {
        var cell = L.cell;
        var k = drag ? easeOut(clamp((now - drag.t0) / 110, 0, 1)) : 1;
        var p = tray[drag.idx];
        var sc = lerp(trayCell(p), cell, k);
        var pw = p.w * sc, ph = p.h * sc;
        var lift = drag.mouse ? -ph / 2 : lerp(0, cell * 0.9, k);
        return { x: drag.x - pw / 2, y: drag.y - ph - lift, cell: sc };
      }

      function text(str, x, y, size, fill, align, outline) {
        g.font = size + 'px ' + FONT;
        g.textAlign = align || 'center'; g.textBaseline = 'middle';
        if (outline) { g.lineJoin = 'round'; g.lineWidth = Math.max(3, size * 0.16); g.strokeStyle = outline; g.strokeText(str, x, y); }
        g.fillStyle = fill; g.fillText(str, x, y);
      }

      function drawTrophy(x, y, s) {
        g.save(); g.translate(x, y);
        g.fillStyle = STAR; g.strokeStyle = INK; g.lineWidth = 2; g.lineJoin = 'round';
        g.beginPath();
        g.moveTo(-s * 0.42, -s * 0.45); g.lineTo(s * 0.42, -s * 0.45);
        g.quadraticCurveTo(s * 0.42, s * 0.12, 0, s * 0.18);
        g.quadraticCurveTo(-s * 0.42, s * 0.12, -s * 0.42, -s * 0.45);
        g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(-s * 0.42, -s * 0.32); g.quadraticCurveTo(-s * 0.68, -s * 0.3, -s * 0.38, -s * 0.02); g.stroke();
        g.beginPath(); g.moveTo(s * 0.42, -s * 0.32); g.quadraticCurveTo(s * 0.68, -s * 0.3, s * 0.38, -s * 0.02); g.stroke();
        g.fillRect(-s * 0.07, s * 0.18, s * 0.14, s * 0.16);
        rr(g, -s * 0.28, s * 0.32, s * 0.56, s * 0.14, 2); g.fill(); g.stroke();
        g.restore();
      }

      function drawPaletteIcon(b) {
        var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        rr(g, b.x, b.y, b.w, b.h, 14); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = INK; g.lineWidth = 2.5; g.stroke();
        g.beginPath();
        g.ellipse(cx, cy + 1, 14, 12, 0, 0, Math.PI * 2);
        g.fillStyle = '#f3dcb0'; g.fill(); g.lineWidth = 2; g.stroke();
        g.beginPath(); g.arc(cx + 6, cy + 6, 3.2, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.stroke();
        var T = THEMES[save.theme].colors;
        [[-7, -3], [-1, -7], [6, -4], [-6, 5]].forEach(function (p, i) {
          g.beginPath(); g.arc(cx + p[0], cy + p[1], 3, 0, Math.PI * 2); g.fillStyle = T[i]; g.fill();
        });
      }

      function frame(now) {
        raf = 0;
        if (!W) return;
        var anim = false;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (!bgCache) bgCache = buildBg();
        if (!boardCache) boardCache = buildBoard();
        g.drawImage(bgCache, 0, 0, W, H);

        // HUD
        if (shownScore < score) { shownScore = Math.min(score, shownScore + Math.max(1, Math.ceil((score - shownScore) * 0.15))); anim = true; }
        var best = Math.max(save.best, score);
        text(String(shownScore), W / 2, 31, 44, INK, 'center', '#fff');
        drawTrophy(26, 28, 26);
        text(String(best), 46, 30, 26, score > 0 && score >= save.best && score > bestAtStart ? STAR : INK, 'left', '#fff');
        drawPaletteIcon(L.themeBtn);
        if (streak >= 2 && state === 'play') {
          text('combo ×' + streak, W / 2, 62, 18, LVL, 'center', '#fff');
        }

        // board
        g.drawImage(boardCache, L.bx - L.fr - 6, L.by - L.fr - 6, L.bs + 2 * L.fr + 12, L.bs + 2 * L.fr + 12);
        var cell = L.cell, r, c;
        var overK = state === 'over' ? clamp((now - overT0) / 900, 0, 1) : 0;
        for (r = 0; r < N; r++) for (c = 0; c < N; c++) {
          var v = grid[r][c];
          if (v < 0) continue;
          var x = L.bx + c * cell, y = L.by + r * cell, s = cell;
          var pa = placeAnims[r * N + c];
          if (pa) {
            var k = (now - pa) / 160;
            if (k >= 1) delete placeAnims[r * N + c];
            else { var sc = 1 + 0.1 * Math.sin(k * Math.PI); x -= (sc - 1) * cell / 2; y -= (sc - 1) * cell / 2; s = cell * sc; anim = true; }
          }
          g.drawImage(sprite(v % 10, Math.floor(v / 10), cell), x, y, s, s);
        }
        if (overK > 0) {
          // fade the board towards grey, cell by cell from the top
          for (r = 0; r < N; r++) for (c = 0; c < N; c++) {
            if (grid[r][c] < 0) continue;
            var kk = clamp(overK * 1.6 - r * 0.08, 0, 1);
            g.fillStyle = 'rgba(235,230,222,' + (0.62 * kk) + ')';
            rr(g, L.bx + c * cell + cell * 0.04, L.by + r * cell + cell * 0.04, cell * 0.92, cell * 0.92, cell * 0.17); g.fill();
          }
          if (overK < 1) anim = true;
        }

        // ghost + lines that would clear
        if (drag && ghost) {
          var gp = tray[drag.idx];
          g.fillStyle = save.theme === 'kreda' ? 'rgba(255,255,255,0.22)' : 'rgba(255,250,225,0.55)';
          ghost.lines.rows.forEach(function (rr2) { rr(g, L.bx + 2, L.by + rr2 * cell + 2, L.bs - 4, cell - 4, cell * 0.2); g.fill(); });
          ghost.lines.cols.forEach(function (cc) { rr(g, L.bx + cc * cell + 2, L.by + 2, cell - 4, L.bs - 4, cell * 0.2); g.fill(); });
          drawPiece(gp, L.bx + ghost.c * cell, L.by + ghost.r * cell, cell, 0.4);
          g.strokeStyle = save.theme === 'kreda' ? 'rgba(255,255,255,0.7)' : 'rgba(29,47,111,0.35)';
          g.lineWidth = 2;
          gp.cells.forEach(function (p) {
            rr(g, L.bx + (ghost.c + p[1]) * cell + cell * 0.08, L.by + (ghost.r + p[0]) * cell + cell * 0.08, cell * 0.84, cell * 0.84, cell * 0.16); g.stroke();
          });
        }

        // popping cells
        pops = pops.filter(function (p) {
          var k = (now - p.t0 - p.delay) / 300;
          if (k >= 1) return false;
          anim = true;
          if (k < 0) { g.drawImage(sprite(p.col, p.v, cell), L.bx + p.c * cell, L.by + p.r * cell, cell, cell); return true; }
          if (!p.burst) {
            p.burst = true;
            for (var q = 0; q < 3; q++) {
              var a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 3;
              parts.push({ x: L.bx + (p.c + 0.5) * cell, y: L.by + (p.r + 0.5) * cell, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2.5,
                col: THEMES[save.theme].colors[p.col % 6], t0: now, life: 500 + Math.random() * 300, s: cell * (0.12 + Math.random() * 0.1), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4 });
            }
          }
          var scl = k < 0.35 ? 1 + 0.25 * (k / 0.35) : 1.25 * (1 - (k - 0.35) / 0.65);
          var ss = cell * Math.max(0, scl);
          g.globalAlpha = k < 0.35 ? 1 : 1 - (k - 0.35) / 0.65;
          g.drawImage(sprite(p.col, p.v, cell), L.bx + (p.c + 0.5) * cell - ss / 2, L.by + (p.r + 0.5) * cell - ss / 2, ss, ss);
          g.globalAlpha = 1;
          return true;
        });

        // tray shelf
        rr(g, L.trayX + 4, L.trayY, L.slotW * 3 - 8, L.trayH, 18);
        g.fillStyle = save.theme === 'kreda' ? 'rgba(46,75,63,0.10)' : 'rgba(255,255,255,0.5)'; g.fill();
        g.strokeStyle = 'rgba(29,47,111,0.14)'; g.lineWidth = 2; g.stroke();
        // tray
        for (var i = 0; i < 3; i++) {
          var p = tray[i];
          if (!p || (drag && drag.idx === i)) continue;
          if (returning.some(function (rt) { return rt.idx === i; })) continue;
          var ctr = slotCenter(i), ct = trayCell(p);
          var inK = clamp((now - p.inT0) / 260, 0, 1);
          if (now < p.inT0) continue;
          if (inK < 1) anim = true;
          var off = (1 - easeOut(inK)) * (W * 0.6);
          var dim = (!p.fits && state === 'play') || state === 'over';
          drawPiece(p, ctr.x - p.w * ct / 2 + off, ctr.y - p.h * ct / 2, ct, (dim ? 0.35 : 1) * inK);
        }
        returning = returning.filter(function (rt) {
          var k = easeOut(clamp((now - rt.t0) / 180, 0, 1));
          var pc = tray[rt.idx];
          if (!pc) return false;
          var ctr2 = slotCenter(rt.idx);
          var tc = trayCell(pc), cs = lerp(rt.cell, tc, k);
          var tx = ctr2.x - pc.w * tc / 2, ty = ctr2.y - pc.h * tc / 2;
          drawPiece(pc, lerp(rt.x, tx, k), lerp(rt.y, ty, k), cs, 1);
          if (k < 1) { anim = true; return true; }
          return false;
        });

        // particles (wood chips)
        parts = parts.filter(function (q) {
          var k = (now - q.t0) / q.life;
          if (k >= 1) return false;
          anim = true;
          var dt = (now - q.t0) / 16.7;
          var x = q.x + q.vx * dt, y = q.y + q.vy * dt + 0.12 * dt * dt;
          g.save(); g.translate(x, y); g.rotate(q.rot + q.vr * dt);
          g.globalAlpha = 1 - k;
          g.fillStyle = q.col; g.fillRect(-q.s / 2, -q.s / 2, q.s, q.s * 0.6);
          g.strokeStyle = 'rgba(29,47,111,0.5)'; g.lineWidth = 1; g.strokeRect(-q.s / 2, -q.s / 2, q.s, q.s * 0.6);
          g.restore();
          return true;
        });

        // dragged piece
        if (drag) {
          var dp = dragPos(now);
          if (now - drag.t0 < 110) anim = true;
          g.save();
          g.shadowColor = 'rgba(29,47,111,0.25)'; g.shadowBlur = 10; g.shadowOffsetY = 6;
          drawPiece(tray[drag.idx], dp.x, dp.y, dp.cell, ghost ? 1 : 0.9);
          g.restore();
        }

        // floating texts
        floats = floats.filter(function (f) {
          var k = (now - f.t0) / f.life;
          if (k >= 1) return false;
          if (k < 0) { anim = true; return true; }
          anim = true;
          var a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
          var sz = f.size * (k < 0.15 ? 0.6 + 0.4 * easeOut(k / 0.15) * 1.1 : 1);
          g.globalAlpha = a;
          text(f.text, f.x, f.y - k * 40, Math.round(sz), f.color, 'center', '#fff');
          g.globalAlpha = 1;
          return true;
        });

        if (state === 'over') {
          var ok = clamp((now - overT0 - 200) / 300, 0, 1);
          if (ok < 1) anim = true;
          g.globalAlpha = ok;
          text('Brak miejsca!', L.bx + L.bs / 2, L.by + L.bs / 2, Math.round(L.cell * 0.9), '#cf412d', 'center', '#fff');
          g.globalAlpha = 1;
        }

        if (anim || drag) requestDraw();
      }

      // ----- moves -----
      function findGhost() {
        if (!drag) return null;
        var p = tray[drag.idx], dp = dragPos(performance.now() + 1000);
        var fc = (dp.x - L.bx) / L.cell, fr = (dp.y - L.by) / L.cell;
        var r0 = Math.round(fr), c0 = Math.round(fc), best = null;
        for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
          var r = r0 + dr, c = c0 + dc;
          var dist = Math.hypot(r - fr, c - fc);
          if (dist > 0.75) continue;
          if (!fitsAt(grid, p.cells, r, c)) continue;
          if (!best || dist < best.d) best = { r: r, c: c, d: dist };
        }
        if (!best) return null;
        best.lines = linesAfter(grid, p.cells, best.r, best.c);
        return best;
      }

      function place(idx, r0, c0) {
        var p = tray[idx], now = performance.now();
        var vals = p.cells.map(function (q, i) { return p.col + 10 * p.vars[i]; });
        p.cells.forEach(function (q, i) { grid[r0 + q[0]][c0 + q[1]] = vals[i]; placeAnims[(r0 + q[0]) * N + c0 + q[1]] = now; });
        tray[idx] = null;
        placed++;
        var gain = p.cells.length;
        var ln = linesAfter(grid, [], 0, 0);
        if (ln.n > 0) {
          streak++;
          var mult = streak;
          var lineGain = 10 * ln.n * ln.n * mult;
          gain += lineGain;
          // centre of the placed piece, for the pop wave
          var pr = r0 + p.h / 2, pc = c0 + p.w / 2;
          var seen = {};
          function pop(r, c) {
            var k = r * N + c;
            if (seen[k] || grid[r][c] < 0) return;
            seen[k] = 1;
            var v = grid[r][c];
            pops.push({ r: r, c: c, col: v % 10, v: Math.floor(v / 10), t0: now, delay: Math.hypot(r + 0.5 - pr, c + 0.5 - pc) * 28 });
          }
          ln.rows.forEach(function (r) { for (var c = 0; c < N; c++) pop(r, c); });
          ln.cols.forEach(function (c) { for (var r = 0; r < N; r++) pop(r, c); });
          ln.rows.forEach(function (r) { for (var c = 0; c < N; c++) grid[r][c] = -1; });
          ln.cols.forEach(function (c) { for (var r = 0; r < N; r++) grid[r][c] = -1; });
          Object.keys(seen).forEach(function (k) { delete placeAnims[k]; });
          var cx = L.bx + L.bs / 2, cy = L.by + L.bs * 0.42;
          var word = ln.n >= 4 ? 'Ekstra!' : ln.n === 3 ? 'Super!' : ln.n === 2 ? 'Brawo!' : streak >= 3 ? 'Świetnie!' : '';
          if (word) floats.push({ text: word, x: cx, y: cy - L.cell * 0.9, size: Math.round(L.cell * 1.0), color: LVL, t0: now, life: 1000 });
          floats.push({ text: '+' + lineGain, x: cx, y: cy, size: Math.round(L.cell * 0.85), color: STAR, t0: now + 60, life: 950 });
          if (mult >= 2) floats.push({ text: 'combo ×' + mult, x: cx, y: cy + L.cell * 0.8, size: Math.round(L.cell * 0.6), color: '#2a8a56', t0: now + 120, life: 950 });
          var emptyAll = grid.every(function (row) { return row.every(function (v) { return v < 0; }); });
          if (emptyAll) {
            gain += 100;
            floats.push({ text: 'Czysta plansza! +100', x: cx, y: cy + L.cell * 1.7, size: Math.round(L.cell * 0.6), color: '#cf412d', t0: now + 250, life: 1300 });
          }
        } else {
          streak = 0;
        }
        score += gain;
        if (score > save.best) { save.best = score; newBest = true; ctx.save(save); }
        if (!tray.some(Boolean)) dealSet(); else updateFits();
        if (!tray.some(function (q) { return q && q.fits; }) && setsDealt <= 5) rescue();
        if (!tray.some(function (q) { return q && q.fits; })) gameOver();
        requestDraw();
      }

      // first minute only: swap stuck pieces for small ones that fit instead of ending the game
      function rescue() {
        var small = [];
        FAMILIES.forEach(function (f) {
          if (['dot', 'line2', 'line3', 'corner3', 'sq2'].indexOf(f.id) < 0) return;
          f.shapes.forEach(function (sh) { if (anyFit(grid, sh)) small.push({ fam: f.id, cells: sh }); });
        });
        if (!small.length) return;
        var now = performance.now();
        tray.forEach(function (p, i) {
          if (!p) return;
          var q = small[Math.floor(Math.random() * small.length)], d = dims(q.cells);
          tray[i] = { fam: q.fam, cells: q.cells, w: d.w, h: d.h, col: p.col,
            vars: q.cells.map(function () { return Math.floor(Math.random() * 3); }), inT0: now + 250 + i * 70, fits: true };
        });
        floats.push({ text: 'Nowy klocek!', x: L.bx + L.bs / 2, y: L.trayY - 8, size: Math.round(L.cell * 0.6), color: '#2a8a56', t0: now + 150, life: 1200 });
        updateFits();
      }
      function gameOver() {
        state = 'over';
        overT0 = performance.now();
        drag = null; ghost = null;
        save.best = Math.max(save.best, score);
        ctx.save(save);
        timers.push(setTimeout(showEnd, 1700));
        requestDraw();
      }

      // ----- input -----
      function pt(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
      function onDown(e) {
        if (picker || drag) return;
        var p = pt(e), b = L.themeBtn;
        if (p.x >= b.x - 6 && p.x <= b.x + b.w + 6 && p.y >= b.y - 6 && p.y <= b.y + b.h + 6) {
          if (state === 'play' || state === 'idle') openThemes(null);
          return;
        }
        if (state !== 'play') return;
        if (p.y < L.trayY - 14 || p.y > L.trayY + L.trayH + 30) return;
        var idx = Math.floor((p.x - L.trayX) / L.slotW);
        if (idx < 0 || idx > 2 || !tray[idx]) return;
        if (returning.some(function (rt) { return rt.idx === idx; })) returning = returning.filter(function (rt) { return rt.idx !== idx; });
        e.preventDefault();
        try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        drag = { idx: idx, x: p.x, y: p.y, t0: performance.now(), id: e.pointerId, mouse: e.pointerType === 'mouse' };
        ghost = findGhost();
        requestDraw();
      }
      function onMove(e) {
        if (!drag || e.pointerId !== drag.id) return;
        var p = pt(e);
        drag.x = p.x; drag.y = p.y;
        ghost = findGhost();
        requestDraw();
      }
      function cancelDrag() {
        if (!drag) return;
        var dp = dragPos(performance.now());
        returning.push({ idx: drag.idx, x: dp.x, y: dp.y, cell: dp.cell, t0: performance.now() });
        drag = null; ghost = null;
        requestDraw();
      }
      function onUp(e) {
        if (!drag || e.pointerId !== drag.id) return;
        var p = pt(e);
        drag.x = p.x; drag.y = p.y;
        var gh = findGhost();
        if (gh && state === 'play') { var idx = drag.idx; drag = null; ghost = null; place(idx, gh.r, gh.c); }
        else cancelDrag();
      }
      function onCancel(e) { if (drag && e.pointerId === drag.id) cancelDrag(); }
      cv.addEventListener('pointerdown', onDown);
      cv.addEventListener('pointermove', onMove);
      cv.addEventListener('pointerup', onUp);
      cv.addEventListener('pointercancel', onCancel);
      cv.addEventListener('lostpointercapture', onCancel);

      // ----- theme picker -----
      function previewCanvas(theme) {
        var s = 26, c2 = makeCanvas(3 * s * dpr, 2 * s * dpr), b = c2.getContext('2d');
        c2.style.width = 3 * s + 'px'; c2.style.height = 2 * s + 'px';
        [[0, 0, 0], [0, 1, 1], [0, 2, 2], [1, 0, 3], [1, 1, 4], [1, 2, 5]].forEach(function (q) {
          b.drawImage(blockSprite(theme, q[2], q[0] + q[1], Math.round(s * dpr)), q[1] * s * dpr, q[0] * s * dpr);
        });
        return c2;
      }
      function openThemes(after) {
        if (picker) return;
        cancelDrag();
        var lvl = ctx.level();
        picker = document.createElement('div');
        picker.className = 'ng-panel';
        var card = document.createElement('div');
        card.className = 'ng-card';
        var h = document.createElement('h2'); h.textContent = 'Kolory klocków'; card.appendChild(h);
        var msg = document.createElement('p');
        msg.style.cssText = 'color:' + LVL + ';font-size:1.1rem;min-height:1.4em';
        var list = document.createElement('div');
        list.style.cssText = 'display:flex;flex-direction:column;gap:8px';
        THEME_ORDER.forEach(function (id) {
          var T = THEMES[id], locked = lvl < T.lvl, on = save.theme === id;
          var b = document.createElement('button');
          b.type = 'button';
          b.style.cssText = 'display:flex;align-items:center;gap:12px;padding:8px 12px;min-height:60px;border-radius:16px;font-size:1.35rem;text-align:left;' +
            'border:3px solid ' + (on ? STAR : INK) + ';background:' + (on ? '#fff6dc' : '#fff') + ';' + (locked ? 'filter:grayscale(.9);opacity:.6;' : '') +
            'box-shadow:0 3px 0 ' + (on ? STAR : 'rgba(29,47,111,.25)');
          var pv = previewCanvas(id);
          pv.style.flex = 'none'; pv.style.borderRadius = '6px';
          if (id === 'kreda') pv.style.background = '#2e4b3f';
          b.appendChild(pv);
          var lab = document.createElement('span');
          lab.style.cssText = 'flex:1;display:flex;flex-direction:column;line-height:1.1';
          lab.innerHTML = '<span>' + T.name + '</span>' + (locked ? '<small style="font-size:1rem;color:' + LVL + '">od poziomu ' + T.lvl + '</small>' : on ? '<small style="font-size:1rem;color:#8a6a00">wybrane</small>' : '');
          b.appendChild(lab);
          b.onclick = function () {
            if (locked) { msg.textContent = 'Te kolory otworzą się na poziomie ' + T.lvl + '. Zbieraj gwiazdki!'; return; }
            save.theme = id; ctx.save(save);
            sprites = {}; boardCache = null; bgCache = null;
            closePicker();
            requestDraw();
            if (after) after();
          };
          list.appendChild(b);
        });
        card.appendChild(list);
        card.appendChild(msg);
        var back = document.createElement('button');
        back.type = 'button'; back.className = 'ng-btn sec'; back.textContent = 'Gotowe';
        back.onclick = function () { closePicker(); if (after) after(); };
        var row = document.createElement('div'); row.className = 'ng-row'; row.appendChild(back);
        card.appendChild(row);
        picker.appendChild(card);
        el.appendChild(picker);
      }
      function closePicker() { if (picker) { picker.remove(); picker = null; } }

      // ----- panels -----
      function closePanel() { if (panelRef) { panelRef.close(); panelRef = null; } }
      function secondary(again) {
        return [
          { label: 'Kolory', onClick: function () { openThemes(again); } },
          { label: 'Wróć do gier', onClick: function () { ctx.exit(); } }
        ];
      }
      function showStart() {
        closePanel();
        panelRef = ctx.panel({
          title: 'Klockownia',
          lines: ['Przeciągnij klocek na planszę.', 'Pełny rząd albo kolumna znika!',
            { text: save.best ? 'Rekord: ' + save.best : 'Zdobądź pierwszy rekord!', muted: true }],
          price: PRICE, button: 'Zagraj', note: 'gra',
          onPlay: startGame,
          secondary: secondary(showStart)
        });
      }
      function showEnd() {
        closePanel();
        panelRef = ctx.panel({
          big: score + ' pkt',
          title: newBest ? 'Nowy rekord!' : 'Koniec gry',
          lines: [newBest ? 'Brawo! Lepiej niż kiedykolwiek.' : { text: 'Rekord: ' + save.best, muted: true }],
          price: PRICE, button: 'Zagraj jeszcze raz', note: 'gra',
          onPlay: startGame,
          secondary: secondary(showEnd)
        });
      }

      function resetBoard() {
        grid = emptyGrid(); score = 0; shownScore = 0; streak = 0; setsDealt = 0; placed = 0;
        pops = []; parts = []; floats = []; placeAnims = {}; returning = []; drag = null; ghost = null;
        newBest = false; bestAtStart = save.best;
        dealSet();
      }
      function startGame() {
        closePanel();
        closePicker();
        resetBoard();
        state = 'play';
        save.games = (save.games || 0) + 1;
        ctx.save(save);
        requestDraw();
      }

      // ----- lifecycle -----
      var ro = new ResizeObserver(resize);
      ro.observe(el);
      resetBoard();
      resize();
      showStart();

      if (/[?&]test\b/.test(location.search)) {
        window.__klocki = {
          get state() { return state; }, get score() { return score; }, get grid() { return grid; }, get tray() { return tray; },
          get layout() { return L; }, set grid(v) { grid = v; updateFits(); requestDraw(); },
          deal: function () { dealSet(); requestDraw(); },
          restart: function () { timers.forEach(clearTimeout); closePanel(); resetBoard(); state = 'play'; requestDraw(); },
          place: function (i, r, c) { if (tray[i] && fitsAt(grid, tray[i].cells, r, c)) place(i, r, c); }
        };
      }

      return {
        destroy: function () {
          destroyed = true;
          if (raf) cancelAnimationFrame(raf);
          raf = 0;
          timers.forEach(clearTimeout);
          ro.disconnect();
          cv.removeEventListener('pointerdown', onDown);
          cv.removeEventListener('pointermove', onMove);
          cv.removeEventListener('pointerup', onUp);
          cv.removeEventListener('pointercancel', onCancel);
          cv.removeEventListener('lostpointercapture', onCancel);
          closePanel(); closePicker();
          if (score > save.best) { save.best = score; ctx.save(save); }
          if (window.__klocki) delete window.__klocki;
          sprites = {};
        },
        pause: function () {
          paused = true;
          if (drag) { returning = []; drag = null; ghost = null; }
          if (raf) { cancelAnimationFrame(raf); raf = 0; }
        },
        resume: function () { paused = false; requestDraw(); }
      };
    }
  });
})();
