/* Obrazki logiczne (nonogramy): zamaluj kratki według liczb przy wierszach i kolumnach, a pojawi się obrazek.
 * Rysunki są ręcznie zaprojektowane; każdy da się rozwiązać samą logiką wiersz po wierszu
 * (sprawdzone line-solverem poniżej, więc rozwiązanie jest jedyne i nie trzeba zgadywać).
 * 40 ★ = paczka 3 obrazków; przed każdym obrazkiem dziecko wybiera wielkość (5×5, 8×8, 10×10).
 * Rozwiązany obrazek zmienia się w kolorowy rysunek i trafia do galerii.
 */
(function () {
  'use strict';

  var FONT = '"Patrick Hand", "Comic Sans MS", cursive';
  var INK = '#1d2f6f', GOLD = '#e3a008', PURPLE = '#7a4fc4', MUTED = '#5a6690';
  var FILL = '#2e3f80', BG = '#efe9fb', PAPER = '#eef6ff';
  var PACK = 3, PRICE = 40;

  // design letters -> colour of the finished drawing ('.' empty)
  var COLORS = {
    r: '#e2533f', w: '#ffffff', y: '#f2c21d', n: '#8a5a33', g: '#3fae5f', G: '#2a8a56', b: '#3f86d8', B: '#9cc9f5',
    k: '#2b2b45', p: '#f28ab2', o: '#f08a24', c: '#f6dfb0', v: '#8a5cd0', s: '#aab4c8', l: '#9ad46a'
  };
  // empty in the puzzle, but painted in the finished drawing (eyes, spots)
  var EMPTY_PAINT = { ':': '#2b2b45', '-': '#ffffff', '=': '#7fcf5a' };

  var LEVELS = [
    { n: 5, key: 'easy', name: 'Łatwe', size: '5×5', color: '#dff3d2' },
    { n: 8, key: 'mid', name: 'Średnie', size: '8×8', color: '#fff1c9' },
    { n: 10, key: 'hard', name: 'Trudne', size: '10×10', color: '#f6dcef' }
  ];

  var PICS = [
    // 5×5
    ['serce', 'Serce', ['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..']],
    ['domek', 'Domek', ['..r..', '.rrr.', 'rrrrr', '.yny.', '.yny.']],
    ['jablko', 'Jabłko', ['..ng.', '.rrr.', 'rrrrr', 'rrrrr', '.rrr.']],
    ['rybka', 'Rybka', ['.b...', '.bb.b', 'bbbbb', '.bb.b', '.....']],
    ['choinka', 'Choinka', ['..y..', '.ggg.', 'ggggg', '.ggg.', '..n..']],
    ['grzybek', 'Grzybek', ['.rrr.', 'rwrwr', 'rrrrr', '.ccc.', '.ccc.']],
    ['slonko', 'Słonko', ['..y..', '.yyy.', 'yyoyy', '.yyy.', '..y..']],
    ['kotek', 'Kotek', ['o...o', 'ooooo', 'o:o:o', 'oopoo', '.ooo.']],
    // 8×8
    ['kot', 'Kot', ['o......o', 'oo....oo', 'oooooooo', 'o:oooo:o', 'oooppooo', 'oooooooo', '.oooooo.', '..oooo..']],
    ['dom', 'Dom', ['......n.', '...rr.n.', '..rrrrn.', '.rrrrrr.', 'rrrrrrrr', '.yByynn.', '.yyyynn.', 'gggggggg']],
    ['serduszko', 'Serduszko', ['.rr..rr.', 'rwrrrrrr', 'rrrrrrrr', 'rrrrrrrr', '.rrrrrr.', '..rrrr..', '...rr...', '........']],
    ['ryba', 'Ryba', ['......B.', '..bbb...', '.bbbbb.b', 'bkbbbbbb', 'bbbbbbbb', '.bbbbb.b', '..bbb...', '.....B..']],
    ['jabluszko', 'Jabłuszko', ['....n...', '...ngg..', '.rr.rrr.', 'rrrrrrrr', 'rwrrrrrr', 'rrrrrrrr', '.rrrrrr.', '..rrrr..']],
    ['motyl', 'Motyl', ['vv....vv', 'vvv..vvv', 'vpvkkvpv', 'vvvkkvvv', '.vvkkvv.', 'vvvkkvvv', 'vpv..vpv', 'vv....vv']],
    ['grzyb', 'Grzyb', ['..rrrr..', '.rwrrwr.', 'rrrrrrrr', 'rwrrrrwr', '..cccc..', '..cccc..', '..cccc..', 'gggggggg']],
    ['auto', 'Auto', ['........', '..bbbb..', '.bBbBbb.', 'bbbbbbbb', 'bbbbbbby', '.kk..kk.', '.kk..kk.', '........']],
    // 10×10
    ['sowa', 'Sowa', ['.n......n.', '.nnnnnnnn.', 'nn--nn--nn', 'nn-knnk-nn', 'nnnnoonnnn', '.nccccccn.', '.nc:cc:cn.', '.nccccccn.', '..nnnnnn..', '...o..o...']],
    ['statek', 'Statek', ['....r.....', '....ww....', '....www...', '....wwww..', '....wwwww.', '....n.....', 'nnnnnnnnnn', '.nnnnnnnn.', '..nnnnnn..', 'bbbbbbbbbb']],
    ['rakieta', 'Rakieta', ['....rr....', '...rrrr...', '...ssss...', '...sBBs...', '...sBBs...', '...ssss...', '..rssssr..', '.rrssssrr.', '.r.oooo.r.', '....oo....']],
    ['kocur', 'Kocur', ['.k......k.', '.kk....kk.', '.kkkkkkkk.', '.k=kkkk=k.', '.kkkkkkkk.', '.kkkppkkk.', '..kkkkkk..', '.kkkkkkkk.', 'kkkkkkkkkk', 'kkkkkkkkkk']],
    ['kwiatek', 'Kwiatek', ['...pp.....', '..pppp....', '.ppyypp...', '.ppyypp...', '..pppp....', '...pp..gg.', '....g.ggg.', '.gg.gggg..', '.ggggg....', '..nnnnnn..']],
    ['biedronka', 'Biedronka', ['....kk....', '...kkkk...', '.rrrkkrrr.', 'rr:rkkr:rr', 'rrrrkkrrrr', 'r::rkkr::r', 'rrrrkkrrrr', 'rr:rkkr:rr', '.rrrkkrrr.', '..rrkkrr..']]
  ];

  function plural(n, one, few, many) {
    if (n === 1) return one;
    var d = n % 10, t = n % 100;
    return (d >= 2 && d <= 4 && (t < 12 || t > 14)) ? few : many;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hexRgb(h) { var v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function mix(c1, c2, t) {
    var a = hexRgb(c1), b = hexRgb(c2);
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')';
  }

  // ---------- puzzles ----------
  function parse(p) {
    var rows = p[2], N = rows.length, sol = [], color = [];
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      var ch = rows[r][c], filled = COLORS[ch] !== undefined;
      sol.push(filled ? 1 : 0);
      color.push(filled ? COLORS[ch] : (EMPTY_PAINT[ch] || null));
    }
    var rowC = [], colC = [];
    for (r = 0; r < N; r++) rowC.push(clues(sol.slice(r * N, r * N + N)));
    for (c = 0; c < N; c++) { var line = []; for (r = 0; r < N; r++) line.push(sol[r * N + c]); colC.push(clues(line)); }
    return { id: p[0], name: p[1], N: N, sol: sol, color: color, rowC: rowC, colC: colC, filled: sol.reduce(function (a, b) { return a + b; }, 0) };
  }
  var PUZ = PICS.map(parse);
  function byId(id) { for (var i = 0; i < PUZ.length; i++) if (PUZ[i].id === id) return PUZ[i]; return null; }
  function ofSize(n) { return PUZ.filter(function (p) { return p.N === n; }); }

  function clues(line) {
    var out = [], run = 0;
    for (var i = 0; i < line.length; i++) {
      if (line[i] === 1) run++;
      else if (run) { out.push(run); run = 0; }
    }
    if (run) out.push(run);
    return out;
  }
  function sameClue(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // line solver: cells -1 unknown / 0 empty / 1 filled; returns what is certain in this line (null = contradiction)
  function solveLine(cells, clue) {
    var n = cells.length, k = clue.length, memo = {};
    function blockOk(p, L) {
      if (p + L > n) return false;
      for (var j = p; j < p + L; j++) if (cells[j] === 0) return false;
      return true;
    }
    function fits(p, ci) {
      var key = p * 32 + ci;
      if (key in memo) return memo[key];
      var ok = false, i;
      if (ci === k) { ok = true; for (i = p; i < n; i++) if (cells[i] === 1) { ok = false; break; } }
      else {
        if (p < n && cells[p] !== 1 && fits(p + 1, ci)) ok = true;
        var L = clue[ci];
        if (!ok && blockOk(p, L)) {
          if (p + L === n) ok = ci + 1 === k;
          else if (cells[p + L] !== 1) ok = fits(p + L + 1, ci + 1);
        }
      }
      memo[key] = ok;
      return ok;
    }
    if (!fits(0, 0)) return null;
    var canF = [], canE = [], seen = {}, i;
    for (i = 0; i < n; i++) { canF.push(false); canE.push(false); }
    function walk(p, ci) {
      var key = p * 32 + ci, j;
      if (seen[key]) return;
      seen[key] = 1;
      if (ci === k) { for (j = p; j < n; j++) canE[j] = true; return; }
      if (p < n && cells[p] !== 1 && fits(p + 1, ci)) { canE[p] = true; walk(p + 1, ci); }
      var L = clue[ci];
      if (blockOk(p, L)) {
        if (p + L === n) { if (ci + 1 === k) for (j = p; j < p + L; j++) canF[j] = true; }
        else if (cells[p + L] !== 1 && fits(p + L + 1, ci + 1)) {
          for (j = p; j < p + L; j++) canF[j] = true;
          canE[p + L] = true;
          walk(p + L + 1, ci + 1);
        }
      }
    }
    walk(0, 0);
    return cells.map(function (v, idx) { return canF[idx] && canE[idx] ? -1 : canF[idx] ? 1 : 0; });
  }
  // repeat the line solver over rows and columns; fully solved = unique solution without guessing
  function lineSolve(rowC, colC, N) {
    var g = [], i, r, c, line, res, changed = true;
    for (i = 0; i < N * N; i++) g.push(-1);
    while (changed) {
      changed = false;
      for (r = 0; r < N; r++) {
        line = g.slice(r * N, r * N + N); res = solveLine(line, rowC[r]);
        if (!res) return null;
        for (c = 0; c < N; c++) if (res[c] !== line[c]) { g[r * N + c] = res[c]; changed = true; }
      }
      for (c = 0; c < N; c++) {
        line = []; for (r = 0; r < N; r++) line.push(g[r * N + c]);
        res = solveLine(line, colC[c]);
        if (!res) return null;
        for (r = 0; r < N; r++) if (res[r] !== line[r]) { g[r * N + c] = res[r]; changed = true; }
      }
    }
    return g;
  }

  // ---------- drawings ----------
  function drawPicture(g, P, x, y, size, opts) {
    opts = opts || {};
    var N = P.N, s = size / N;
    g.save();
    g.fillStyle = opts.locked ? '#e6e9f2' : PAPER;
    g.fillRect(x, y, size, size);
    if (!opts.locked) {
      for (var i = 0; i < N * N; i++) {
        var col = P.color[i];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(x + (i % N) * s, y + (i / N | 0) * s, Math.ceil(s), Math.ceil(s));
      }
    }
    g.lineWidth = Math.max(1.5, size / 40); g.strokeStyle = INK;
    g.strokeRect(x, y, size, size);
    if (opts.locked) {
      g.fillStyle = MUTED; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = Math.round(size * 0.5) + 'px ' + FONT;
      g.fillText('?', x + size / 2, y + size / 2 + 2);
    }
    g.restore();
  }
  function picCanvas(P, size, locked) {
    var cv = document.createElement('canvas'), dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    var g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPicture(g, P, 1, 1, size - 2, { locked: locked });
    return cv;
  }

  // ---------- shop tile ----------
  var TILE_PIC = (function () {
    var heart = ['.#.#.', '#####', '#####', '.###.', '..#..'], s = '', cell = 10, ox = 56, oy = 18;
    var rowsC = ['1 1', '5', '5', '3', '1'], colsC = ['2', '4', '4', '4', '2'];
    for (var r = 0; r < 5; r++) for (var c = 0; c < 5; c++) {
      var on = heart[r][c] === '#', red = on && (r + c) >= 4;
      s += '<rect x="' + (ox + c * cell) + '" y="' + (oy + r * cell) + '" width="' + cell + '" height="' + cell + '" fill="' + (on ? (red ? '#e2533f' : '#2e3f80') : '#fff') + '" stroke="#c9d0e6" stroke-width=".8"/>';
      if (!on && (r + c) % 2 === 0 && r > 2) s += '<path d="M' + (ox + c * cell + 3) + ' ' + (oy + r * cell + 3) + ' l4 4 m0 -4 l-4 4" stroke="#8a94b8" stroke-width="1.2"/>';
    }
    s += '<rect x="' + ox + '" y="' + oy + '" width="50" height="50" fill="none" stroke="#1d2f6f" stroke-width="2.2"/>';
    for (r = 0; r < 5; r++) s += '<text x="' + (ox - 4) + '" y="' + (oy + r * cell + 8) + '" font-size="8.5" text-anchor="end" fill="#1d2f6f" font-family="Patrick Hand, Comic Sans MS, cursive">' + rowsC[r] + '</text>';
    for (c = 0; c < 5; c++) s += '<text x="' + (ox + c * cell + 5) + '" y="' + (oy - 4) + '" font-size="8.5" text-anchor="middle" fill="#1d2f6f" font-family="Patrick Hand, Comic Sans MS, cursive">' + colsC[c] + '</text>';
    s += '<path d="M14 58 l4 -22 l14 14 z" fill="#f2c21d" stroke="#1d2f6f" stroke-width="2" stroke-linejoin="round"/><path d="M18 36 l-6 -8 l6 -4 l8 10" fill="#f28ab2" stroke="#1d2f6f" stroke-width="2" stroke-linejoin="round"/>';
    s += '<path d="M112 34 l2.5 5 l5.5 .8 l-4 3.8 l1 5.4 l-5 -2.6 l-5 2.6 l1 -5.4 l-4 -3.8 l5.5 -.8 z" fill="#e3a008"/>';
    return s;
  })();

  var CSS = [
    '.ob-root{display:flex;flex-direction:column;background:' + BG + ';font-family:' + FONT + ';color:' + INK + ';user-select:none;-webkit-user-select:none}',
    '.ob-hud{flex:none;display:flex;align-items:center;gap:8px;padding:8px 10px 4px}',
    '.ob-title{flex:1;min-width:0;font-size:1.35rem;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.ob-title small{display:block;font-size:1rem;color:' + MUTED + '}',
    '.ob-pill{flex:none;background:#fff;border:2px solid ' + INK + ';border-radius:12px;padding:2px 10px;font-size:1.05rem;color:' + PURPLE + '}',
    '.ob-small{flex:none;border:2px solid ' + INK + ';background:#fff;border-radius:12px;padding:4px 10px;font:inherit;font-size:1.05rem;color:' + INK + ';min-height:38px}',
    '.ob-wrap{flex:1;position:relative;min-height:0}',
    '.ob-wrap canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none}',
    '.ob-bar{flex:none;display:flex;gap:6px;justify-content:center;align-items:center;padding:6px 8px calc(10px + env(safe-area-inset-bottom,0px))}',
    '.ob-seg{display:flex;border:3px solid ' + INK + ';border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 3px 0 ' + INK + '}',
    '.ob-seg button{font:inherit;font-size:1.2rem;border:0;background:#fff;color:' + INK + ';padding:6px 10px;min-height:44px;display:flex;align-items:center;gap:5px}',
    '.ob-seg button + button{border-left:3px solid ' + INK + '}',
    '.ob-seg button.on{background:' + GOLD + ';color:#2a1d00}',
    '.ob-tool{font:inherit;font-size:1.2rem;border:3px solid ' + INK + ';border-radius:16px;background:#fff;color:' + INK + ';padding:4px 10px;min-height:50px;min-width:50px;box-shadow:0 3px 0 ' + INK + '}',
    '.ob-tool:active,.ob-seg button:active{transform:translateY(2px)}',
    '.ob-tool[disabled]{opacity:.45}',
    '.ob-tool[data-a="undo"]{font-size:1.7rem;line-height:1;font-family:system-ui,sans-serif}',
    '.ob-ico{display:inline-block;width:16px;height:16px;border-radius:3px;background:' + FILL + '}',
    '.ob-x{display:inline-block;font-size:1.25rem;line-height:1;color:#8a94b8}',
    '.ob-pick{display:flex;flex-direction:column;gap:10px}',
    '.ob-lvl{display:flex;align-items:center;gap:12px;text-align:left;font:inherit;color:' + INK + ';border:3px solid ' + INK + ';border-radius:18px;padding:8px 12px;box-shadow:0 4px 0 ' + INK + ';min-height:64px}',
    '.ob-lvl:active{transform:translateY(3px);box-shadow:0 1px 0 ' + INK + '}',
    '.ob-lvl b{font-weight:400;font-size:1.45rem;line-height:1}',
    '.ob-lvl small{display:block;font-size:1rem;color:' + MUTED + '}',
    '.ob-lvl .ob-mini{flex:none;display:grid;gap:1px;background:#c9d0e6;border:2px solid ' + INK + ';width:40px;height:40px}',
    '.ob-lvl .ob-mini i{background:#fff}',
    '.ob-lvl .ob-mini i.f{background:' + FILL + '}',
    '.ob-gal{display:flex;flex-direction:column;gap:12px;max-height:min(60vh,520px);overflow:auto;padding:2px}',
    '.ob-gal h3{margin:0;font-weight:400;font-size:1.25rem;text-align:left}',
    '.ob-gal .row{display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:8px}',
    '.ob-gal figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:.95rem}',
    '.ob-win canvas{display:block;margin:0 auto}',
    '@media (max-width:370px){.ob-seg button{padding:6px 8px;font-size:1.1rem}.ob-tool{padding:4px 8px;font-size:1.1rem}}'
  ].join('\n');

  NG.register('obrazki', {
    _test: { PUZ: PUZ, PICS: PICS, lineSolve: lineSolve, solveLine: solveLine, clues: clues, parse: parse },
    meta: { name: 'Obrazki logiczne', price: '40 ★ za 3 obrazki', bg: '#efe9fb', pic: TILE_PIC, music: 'calm' },
    medals: [
      { id: 'b', stat: 'solved', at: 3, tier: 1, text: '3 obrazki logiczne' },
      { id: 's', stat: 'solved', at: 12, tier: 2, text: '12 obrazków logicznych' },
      { id: 'g', stat: 'gallery', at: PUZ.length, tier: 3, text: 'Cała galeria (' + PUZ.length + ')' }
    ],
    quests: [
      { id: 'solve', stat: 'solved', n: [2, 3], text: 'Rozwiąż {n} {f}', forms: ['obrazek logiczny', 'obrazki logiczne', 'obrazków logicznych'] },
      { id: 'cells', stat: 'cells', n: [50, 80], text: 'Zamaluj {n} kratek w Obrazkach logicznych' }
    ],
    stickers: [
      { id: 'first', emoji: '🖼️', name: 'Pierwszy obrazek' },
      { id: 'big', emoji: '🦉', name: 'Pierwszy obrazek 10×10' },
      { id: 'clean', emoji: '✨', name: 'Duży obrazek bez pomyłki' },
      { id: 'easyall', emoji: '🌈', name: 'Wszystkie łatwe obrazki' }
    ],

    mount: function (el, ctx) {
      var save = ctx.load({ credits: 0, solved: {}, total: 0, cur: null, mode: 1, last: null });
      if (!save.solved || typeof save.solved !== 'object') save.solved = {};
      var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      var alive = true, raf = 0, paused = false, timers = [], overlays = [], panel = null;

      var css = document.createElement('style'); css.textContent = CSS;
      var root = document.createElement('div'); root.className = 'ob-root';
      root.innerHTML =
        '<div class="ob-hud"><div class="ob-title"></div><span class="ob-pill"></span><button type="button" class="ob-small" data-a="other">Inny</button></div>' +
        '<div class="ob-wrap"><canvas></canvas></div>' +
        '<div class="ob-bar">' +
          '<div class="ob-seg"><button type="button" data-m="1"><span class="ob-ico"></span>Maluj</button><button type="button" data-m="2"><span class="ob-x">✕</span>Krzyżyk</button></div>' +
          '<button type="button" class="ob-tool" data-a="undo" aria-label="Cofnij">↶</button>' +
          '<button type="button" class="ob-tool" data-a="check">Pokaż błędy</button>' +
        '</div>';
      el.appendChild(css); el.appendChild(root);
      var hudTitle = root.querySelector('.ob-title'), pill = root.querySelector('.ob-pill');
      var canvas = root.querySelector('canvas'), wrap = root.querySelector('.ob-wrap');
      var segBtns = root.querySelectorAll('.ob-seg button');
      var undoBtn = root.querySelector('[data-a="undo"]'), checkBtn = root.querySelector('[data-a="check"]'), otherBtn = root.querySelector('[data-a="other"]');
      var g = canvas.getContext('2d');
      var W = 1, H = 1, dpr = 1, L = null;

      var P = null, cells = [], undo = [], mode = save.mode === 2 ? 2 : 1;
      var state = 'menu';         // menu | play | won
      var wrongFlash = [], flashT0 = -9, winT0 = 0, tNow = 0, lastTs = 0;
      var hover = -1, helpUsed = false, everWrong = false;

      function persist() { ctx.save(save); }
      function later(fn, ms) { var id = setTimeout(function () { timers = timers.filter(function (x) { return x !== id; }); if (alive) fn(); }, ms); timers.push(id); return id; }

      // ---------- layout ----------
      function clueW(list) { var w = 0.2; list.forEach(function (n) { w += String(n).length * 0.28 + 0.22; }); return w; }
      function layout() {
        if (!P) { L = null; return; }
        var N = P.N, rw = 0, ch = 0;
        P.rowC.forEach(function (c) { rw = Math.max(rw, clueW(c.length ? c : [0])); });
        P.colC.forEach(function (c) { ch = Math.max(ch, (c.length || 1) * 0.52 + 0.25); });
        var pad = 10, hint = 30;
        var s = Math.floor(Math.min((W - 2 * pad) / (N + rw), (H - 2 * pad - hint) / (N + ch), 64));
        s = Math.max(18, s);
        var cw = Math.ceil(rw * s), chh = Math.ceil(ch * s), tw = cw + N * s, th = chh + N * s;
        var ox = Math.round((W - tw) / 2), oy = Math.round(Math.max(pad, (H - th - hint) / 2));
        L = { s: s, N: N, cw: cw, ch: chh, gx: ox + cw, gy: oy + chh, ox: ox, oy: oy };
      }
      function resize() {
        var r = wrap.getBoundingClientRect();
        W = Math.max(1, r.width); H = Math.max(1, r.height);
        dpr = Math.min(3, window.devicePixelRatio || 1);
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        layout(); draw();
      }
      var ro = new ResizeObserver(resize);
      ro.observe(wrap);

      // ---------- drawing ----------
      function rr(x, y, w, h, r) {
        g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
      }
      function lineDone(isRow, k) {
        var N = P.N, line = [];
        for (var j = 0; j < N; j++) line.push(cells[isRow ? k * N + j : j * N + k] === 1 ? 1 : 0);
        return sameClue(clues(line), isRow ? P.rowC[k] : P.colC[k]);
      }
      function draw() {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, W, H);
        if (!P || !L) return;
        var N = P.N, s = L.s, i, r, c;
        var hr = hover >= 0 && state === 'play' ? (hover / N | 0) : -1, hc = hover >= 0 && state === 'play' ? hover % N : -1;
        var won = state === 'won', wt = won ? tNow - winT0 : 0;
        var fade = won ? clamp(wt / 0.4, 0, 1) : 0;
        // clue panels
        g.globalAlpha = 1 - fade * 0.7;
        rr(L.ox - 4, L.gy - 2, L.cw + 6, N * s + 4, 12); g.fillStyle = '#fff'; g.fill();
        rr(L.gx - 2, L.oy - 4, N * s + 4, L.ch + 6, 12); g.fill();
        var fs = Math.max(12, Math.min(26, Math.round(s * 0.52)));
        g.font = fs + 'px ' + FONT; g.textBaseline = 'middle';
        for (r = 0; r < N; r++) {
          if (r % 2 === 1 || r === hr) { g.fillStyle = r === hr ? '#fff3c4' : '#f4f1fc'; g.fillRect(L.ox, L.gy + r * s, L.cw - 2, s); }
          var done = lineDone(true, r), list = P.rowC[r].length ? P.rowC[r] : [0];
          g.fillStyle = done ? '#b3bad3' : INK; g.textAlign = 'right';
          var x = L.gx - s * 0.22;
          for (i = list.length - 1; i >= 0; i--) {
            g.fillText(String(list[i]), x, L.gy + r * s + s / 2 + 1);
            x -= (String(list[i]).length * 0.28 + 0.22) * s;
          }
        }
        for (c = 0; c < N; c++) {
          if (c % 2 === 1 || c === hc) { g.fillStyle = c === hc ? '#fff3c4' : '#f4f1fc'; g.fillRect(L.gx + c * s, L.oy, s, L.ch - 2); }
          done = lineDone(false, c); list = P.colC[c].length ? P.colC[c] : [0];
          g.fillStyle = done ? '#b3bad3' : INK; g.textAlign = 'center';
          var y = L.gy - s * 0.32;
          for (i = list.length - 1; i >= 0; i--) { g.fillText(String(list[i]), L.gx + c * s + s / 2, y); y -= s * 0.52; }
        }
        g.globalAlpha = 1;
        // grid
        var gx = L.gx, gy = L.gy, size = N * s;
        g.fillStyle = '#fff'; g.fillRect(gx, gy, size, size);
        for (i = 0; i < N * N; i++) {
          r = i / N | 0; c = i % N;
          var x0 = gx + c * s, y0 = gy + r * s, st = cells[i];
          if (!won && (r === hr || c === hc) && st !== 1) { g.fillStyle = '#fffbe6'; g.fillRect(x0, y0, s, s); }
          if (won) {
            var k = clamp((wt - 0.15 - (r + c) * (reduced ? 0 : 0.035)) / 0.3, 0, 1);
            var target = P.color[i] || PAPER;
            if (P.sol[i]) g.fillStyle = mix(FILL, P.color[i], k);
            else g.fillStyle = mix('#ffffff', target, k);
            g.fillRect(x0, y0, s + 0.5, s + 0.5);
            if (st === 2 && k < 1) drawX(x0, y0, s, 1 - k);
            continue;
          }
          if (st === 1) { rr(x0 + 1.5, y0 + 1.5, s - 3, s - 3, Math.max(2, s * 0.12)); g.fillStyle = FILL; g.fill(); }
          else if (st === 2) drawX(x0, y0, s, 1);
        }
        // gentle error flash
        var fl = tNow - flashT0;
        if (!won && fl < 2.6 && wrongFlash.length) {
          var a = fl < 2 ? 1 : 1 - (fl - 2) / 0.6;
          var pulse = reduced ? 1 : 0.75 + 0.25 * Math.sin(fl * 9);
          wrongFlash.forEach(function (idx) {
            var x1 = gx + (idx % N) * s, y1 = gy + (idx / N | 0) * s;
            g.globalAlpha = a * 0.55 * pulse; g.fillStyle = '#ff8fa3'; g.fillRect(x1 + 1, y1 + 1, s - 2, s - 2);
            g.globalAlpha = a; g.lineWidth = 2.5; g.strokeStyle = '#d6336c';
            rr(x1 + 2, y1 + 2, s - 4, s - 4, 4); g.stroke();
          });
          g.globalAlpha = 1;
        }
        // grid lines
        var thick = N === 8 ? 4 : 5;
        g.lineWidth = 1; g.strokeStyle = won ? 'rgba(201,208,230,' + (1 - fade) + ')' : '#c9d0e6';
        g.beginPath();
        for (i = 1; i < N; i++) {
          if (i % thick === 0) continue;
          g.moveTo(gx + i * s + 0.5, gy); g.lineTo(gx + i * s + 0.5, gy + size);
          g.moveTo(gx, gy + i * s + 0.5); g.lineTo(gx + size, gy + i * s + 0.5);
        }
        g.stroke();
        if (!won) {
          g.lineWidth = 2; g.strokeStyle = INK; g.beginPath();
          for (i = thick; i < N; i += thick) {
            g.moveTo(gx + i * s, gy); g.lineTo(gx + i * s, gy + size);
            g.moveTo(gx, gy + i * s); g.lineTo(gx + size, gy + i * s);
          }
          g.stroke();
        }
        g.lineWidth = 3; g.strokeStyle = INK;
        rr(gx - 1.5, gy - 1.5, size + 3, size + 3, 4); g.stroke();
        // hint under the board
        var hint = '';
        if (state === 'play' && save.total === 0 && countFilled() < 3) hint = 'Liczby mówią, ile kratek zamalować po kolei.';
        else if (state === 'play' && save.total < 2 && countFilled() >= 3 && countFilled() < 8) hint = 'Przytrzymaj palec, żeby postawić krzyżyk.';
        else if (won) hint = 'To ' + P.name.toLowerCase() + '!';
        if (hint) {
          g.font = Math.round(clamp(W / 20, 17, 24)) + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillStyle = won ? PURPLE : MUTED;
          var hy = gy + size + 22;
          if (hy < H - 4) g.fillText(hint, W / 2, hy);
        }
      }
      function drawX(x0, y0, s, a) {
        var m = s * 0.28;
        g.globalAlpha = a; g.lineWidth = Math.max(2, s * 0.08); g.strokeStyle = '#8a94b8'; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x0 + m, y0 + m); g.lineTo(x0 + s - m, y0 + s - m); g.moveTo(x0 + s - m, y0 + m); g.lineTo(x0 + m, y0 + s - m); g.stroke();
        g.lineCap = 'butt'; g.globalAlpha = 1;
      }
      function countFilled() { var n = 0; for (var i = 0; i < cells.length; i++) if (cells[i] === 1) n++; return n; }

      // animation loop only while something moves
      function animating() { return state === 'won' ? tNow - winT0 < 2.5 : (tNow - flashT0 < 2.7 && wrongFlash.length > 0); }
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
        if (P) {
          var lv = LEVELS.filter(function (x) { return x.n === P.N; })[0];
          hudTitle.innerHTML = '';
          hudTitle.appendChild(document.createTextNode(state === 'won' ? P.name : 'Co to będzie?'));
          var sm = document.createElement('small'); sm.textContent = lv.name + ' ' + lv.size; hudTitle.appendChild(sm);
        } else hudTitle.textContent = 'Obrazki logiczne';
        pill.textContent = 'Paczka: ' + save.credits + '/' + PACK;
        pill.style.visibility = save.credits > 0 || P ? 'visible' : 'hidden';
        otherBtn.style.visibility = state === 'play' ? 'visible' : 'hidden';
        [].forEach.call(segBtns, function (b) { b.classList.toggle('on', +b.dataset.m === mode); b.setAttribute('aria-pressed', +b.dataset.m === mode); });
        undoBtn.disabled = state !== 'play' || !undo.length;
        checkBtn.disabled = state !== 'play';
      }

      // ---------- game flow ----------
      function startPuzzle(p, restore) {
        P = p; state = 'play'; undo = []; wrongFlash = []; hover = -1;
        cells = [];
        for (var i = 0; i < P.N * P.N; i++) cells.push(0);
        helpUsed = false; everWrong = false;
        if (restore && restore.cells && restore.cells.length === cells.length) {
          cells = restore.cells.slice(); helpUsed = !!restore.help; everWrong = !!restore.wrong;
        }
        save.cur = { id: P.id, cells: cells.slice(), help: helpUsed, wrong: everWrong };
        persist();
        layout(); syncHud(); draw();
      }
      function saveCur() { if (P && state === 'play') { save.cur = { id: P.id, cells: cells.slice(), help: helpUsed, wrong: everWrong }; persist(); } }
      function pickFor(n) {
        var list = ofSize(n), fresh = list.filter(function (p) { return !save.solved[p.id]; });
        var pool = fresh.length ? fresh : list.filter(function (p) { return p.id !== save.last; });
        return pool[Math.floor(Math.random() * pool.length)];
      }
      function checkWin() {
        for (var i = 0; i < cells.length; i++) if ((cells[i] === 1) !== (P.sol[i] === 1)) return false;
        return true;
      }
      function onWin() {
        state = 'won'; winT0 = tNow; wrongFlash = [];
        ctx.sfx('win');
        var firstTime = !save.solved[P.id];
        save.solved[P.id] = 1;
        save.total = (save.total || 0) + 1;
        save.credits = Math.max(0, save.credits - 1);
        save.last = P.id;
        save.cur = null;
        persist();
        var galleryN = Object.keys(save.solved).filter(function (id) { return byId(id); }).length;
        ctx.stat('solved', 1);
        ctx.stat('cells', P.filled);
        ctx.stat('gallery', galleryN, 'max');
        ctx.sticker('first');
        if (P.N === 10) ctx.sticker('big');
        if (P.N >= 8 && !everWrong && !helpUsed) ctx.sticker('clean');
        if (ofSize(5).every(function (p) { return save.solved[p.id]; })) ctx.sticker('easyall');
        syncHud(); kick();
        later(function () { showWinCard(firstTime); }, reduced ? 500 : 1700);
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
      function btn(label, cls, fn) {
        var b = document.createElement('button'); b.type = 'button'; b.className = cls || 'ng-btn'; b.textContent = label;
        b.onclick = fn; return b;
      }
      function para(text, muted) { var p = document.createElement('p'); p.textContent = text; if (muted) p.className = 'muted'; return p; }

      function showWinCard(firstTime) {
        overlay(function (card, o) {
          card.classList.add('ob-win');
          var h = document.createElement('h2'); h.textContent = 'Brawo!'; card.appendChild(h);
          var size = Math.min(200, Math.max(140, W - 140));
          card.appendChild(picCanvas(P, size, false));
          card.appendChild(para('To ' + P.name.toLowerCase() + '!'));
          card.appendChild(para(firstTime ? 'Obrazek trafił do galerii.' : 'Ten obrazek już był w galerii.', true));
          card.appendChild(btn(save.credits > 0 ? 'Dalej' : 'Gotowe', 'ng-btn', function () { o.close(); ctx.sfx('click'); next(); }));
        });
      }
      function next() {
        if (save.credits > 0) showPicker();
        else showBuy(true);
      }
      function miniGrid(n) {
        var m = document.createElement('span'); m.className = 'ob-mini';
        var k = n === 5 ? 5 : n === 8 ? 6 : 7;
        m.style.gridTemplateColumns = 'repeat(' + k + ',1fr)';
        var pat = n === 5 ? '.#.#.#####.###...#..' : '';
        for (var i = 0; i < k * k; i++) {
          var it = document.createElement('i');
          var on = n === 5 ? pat[i] === '#' : ((i * 7 + (i / k | 0) * 3) % 5) < 2;
          if (on) it.className = 'f';
          m.appendChild(it);
        }
        return m;
      }
      function showPicker() {
        state = 'menu'; P = null; layout(); syncHud(); draw();
        overlay(function (card, o) {
          var h = document.createElement('h2'); h.textContent = 'Wybierz obrazek'; card.appendChild(h);
          card.appendChild(para('Zostały ' + save.credits + ' z ' + PACK + ' w paczce.', true));
          var box = document.createElement('div'); box.className = 'ob-pick';
          LEVELS.forEach(function (lv) {
            var list = ofSize(lv.n), have = list.filter(function (p) { return save.solved[p.id]; }).length;
            var b = document.createElement('button'); b.type = 'button'; b.className = 'ob-lvl'; b.style.background = lv.color;
            b.appendChild(miniGrid(lv.n));
            var t = document.createElement('span'); t.innerHTML = '<b></b><small></small>';
            t.querySelector('b').textContent = lv.name + ' ' + lv.size;
            t.querySelector('small').textContent = 'W galerii: ' + have + ' / ' + list.length;
            b.appendChild(t);
            b.onclick = function () { o.close(); ctx.sfx('pop'); startPuzzle(pickFor(lv.n)); };
            box.appendChild(b);
          });
          card.appendChild(box);
          var row = document.createElement('div'); row.className = 'ng-row';
          row.appendChild(btn('Galeria', 'ng-btn sec', function () { o.close(); showGallery(showPicker); }));
          row.appendChild(btn('Wróć do gier', 'ng-btn sec', function () { ctx.exit(); }));
          card.appendChild(row);
        });
      }
      function showGallery(back) {
        ctx.sfx('open');
        overlay(function (card, o) {
          var have = PUZ.filter(function (p) { return save.solved[p.id]; }).length;
          var h = document.createElement('h2'); h.textContent = 'Galeria'; card.appendChild(h);
          card.appendChild(para(have + ' / ' + PUZ.length + ' obrazków', true));
          var gal = document.createElement('div'); gal.className = 'ob-gal';
          LEVELS.forEach(function (lv) {
            var h3 = document.createElement('h3'); h3.textContent = lv.name + ' ' + lv.size; gal.appendChild(h3);
            var row = document.createElement('div'); row.className = 'row';
            ofSize(lv.n).forEach(function (p) {
              var got = !!save.solved[p.id], f = document.createElement('figure');
              f.appendChild(picCanvas(p, 62, !got));
              var cap = document.createElement('figcaption'); cap.textContent = got ? p.name : '\u00a0'; f.appendChild(cap);
              row.appendChild(f);
            });
            gal.appendChild(row);
          });
          card.appendChild(gal);
          var row2 = document.createElement('div'); row2.className = 'ng-row';
          row2.appendChild(btn('Zamknij', 'ng-btn sec', function () { o.close(); ctx.sfx('close'); back(); }));
          card.appendChild(row2);
        });
      }
      function showBuy(after) {
        state = 'menu'; P = null; layout(); syncHud(); draw();
        var have = PUZ.filter(function (p) { return save.solved[p.id]; }).length;
        panel = ctx.panel({
          title: after ? 'Paczka gotowa!' : 'Obrazki logiczne',
          big: after ? '🖼️ ' + have + ' / ' + PUZ.length : undefined,
          medals: true,
          lines: after
            ? ['Wszystkie 3 obrazki rozwiązane.', { text: 'W galerii: ' + have + ' / ' + PUZ.length, muted: true }]
            : ['Zamaluj kratki według liczb, a pojawi się obrazek.', PACK + ' obrazki za ' + PRICE + ' ★', { text: 'W galerii: ' + have + ' / ' + PUZ.length, muted: true }],
          price: PRICE, note: PACK + ' obrazki',
          button: after ? 'Nowa paczka' : 'Zagraj',
          onPlay: function () { panel = null; save.credits = PACK; persist(); ctx.sfx('buy'); syncHud(); showPicker(); },
          secondary: [
            { label: 'Galeria', onClick: function () { panel = null; showGallery(function () { showBuy(after); }); } },
            { label: 'Wróć do gier', onClick: function () { ctx.exit(); } }
          ]
        });
      }
      function askOther() {
        if (state !== 'play') return;
        ctx.sfx('open');
        overlay(function (card, o) {
          var h = document.createElement('h2'); h.textContent = 'Inny obrazek?'; card.appendChild(h);
          card.appendChild(para('Ten obrazek zacznie się od nowa. Paczka się nie zmniejszy.'));
          var row = document.createElement('div'); row.className = 'ng-row';
          row.appendChild(btn('Tak, wybierz', 'ng-btn', function () { o.close(); save.cur = null; persist(); showPicker(); }));
          row.appendChild(btn('Graj dalej', 'ng-btn sec', function () { o.close(); ctx.sfx('close'); }));
          card.appendChild(row);
        });
      }

      // ---------- input ----------
      var stroke = null, pressTimer = 0, lastSfx = 0;
      function cellAt(x, y) {
        if (!L) return -1;
        var c = Math.floor((x - L.gx) / L.s), r = Math.floor((y - L.gy) / L.s);
        if (c < 0 || r < 0 || c >= L.N || r >= L.N) return -1;
        return r * L.N + c;
      }
      function apply(i) {
        var st = cells[i], t = stroke.target;
        if (t === 0) { if (st !== stroke.from) return false; }
        else if (st !== 0) return false;
        cells[i] = t;
        if (t === 1 && !P.sol[i]) everWrong = true;
        return true;
      }
      function sfxFor(t) {
        var now = performance.now();
        if (now - lastSfx < 45) return;
        lastSfx = now;
        ctx.sfx(t === 1 ? 'tap' : t === 2 ? 'click' : 'pop');
      }
      function onDown(ev) {
        if (state !== 'play' || stroke) return;
        var r = canvas.getBoundingClientRect(), i = cellAt(ev.clientX - r.left, ev.clientY - r.top);
        if (i < 0) return;
        ev.preventDefault();
        try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
        var st = cells[i], target = st === 0 ? mode : 0;
        stroke = { id: ev.pointerId, start: i, axis: null, target: target, from: st, snap: cells.slice(), moved: false, linesBefore: doneLines(), wrongBefore: everWrong };
        apply(i); sfxFor(target);
        hover = i;
        clearTimeout(pressTimer);
        if (mode === 1 && st === 0) {
          pressTimer = setTimeout(function () {
            pressTimer = 0;
            if (!alive || !stroke || stroke.moved) return;
            // long press: X instead of fill
            cells = stroke.snap.slice();
            stroke.target = 2; stroke.from = 0;
            cells[stroke.start] = 2;
            everWrong = stroke.wrongBefore;
            ctx.sfx('click');
            if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) {} }
            draw();
          }, 420);
        }
        draw();
      }
      function onMove(ev) {
        var r = canvas.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
        if (!stroke) {
          if (ev.pointerType === 'mouse' && state === 'play') { var h = cellAt(x, y); if (h !== hover) { hover = h; draw(); } }
          return;
        }
        if (ev.pointerId !== stroke.id) return;
        var i = cellAt(x, y);
        if (i < 0) {
          // clamp to the board so a fast drag past the edge still fills to the end
          if (!L) return;
          var cc = clamp(Math.floor((x - L.gx) / L.s), 0, L.N - 1), r0 = clamp(Math.floor((y - L.gy) / L.s), 0, L.N - 1);
          i = r0 * L.N + cc;
        }
        if (i === stroke.start && !stroke.moved) return;
        var N = P.N, sr = stroke.start / N | 0, sc = stroke.start % N, cr = i / N | 0, ccol = i % N;
        if (!stroke.axis) {
          if (cr === sr && ccol === sc) return;
          stroke.axis = Math.abs(cr - sr) >= Math.abs(ccol - sc) ? 'v' : 'h';
          stroke.moved = true;
          clearTimeout(pressTimer); pressTimer = 0;
        }
        var changed = false, k;
        if (stroke.axis === 'h') { var a = Math.min(sc, ccol), b = Math.max(sc, ccol); for (k = a; k <= b; k++) changed = apply(sr * N + k) || changed; hover = sr * N + ccol; }
        else { a = Math.min(sr, cr); b = Math.max(sr, cr); for (k = a; k <= b; k++) changed = apply(k * N + sc) || changed; hover = cr * N + sc; }
        if (changed) sfxFor(stroke.target);
        draw();
      }
      function doneLines() {
        var n = 0;
        for (var k = 0; k < P.N; k++) { if (lineDone(true, k)) n++; if (lineDone(false, k)) n++; }
        return n;
      }
      function onUp(ev) {
        if (!stroke || ev.pointerId !== stroke.id) return;
        clearTimeout(pressTimer); pressTimer = 0;
        var changed = false;
        for (var i = 0; i < cells.length; i++) if (cells[i] !== stroke.snap[i]) { changed = true; break; }
        if (changed) { undo.push(stroke.snap); if (undo.length > 80) undo.shift(); }
        var before = stroke.linesBefore;
        stroke = null;
        if (ev.pointerType !== 'mouse') hover = -1;
        if (!changed) { draw(); return; }
        saveCur(); syncHud();
        if (checkWin()) { onWin(); return; }
        if (doneLines() > before && stroke === null) ctx.sfx('pop');
        draw();
      }
      function onLeave() { if (!stroke && hover >= 0) { hover = -1; draw(); } }

      function doUndo() {
        if (state !== 'play' || !undo.length) return;
        cells = undo.pop(); wrongFlash = [];
        ctx.sfx('swap'); saveCur(); syncHud(); draw();
      }
      function doCheck() {
        if (state !== 'play') return;
        var bad = [];
        for (var i = 0; i < cells.length; i++) {
          if (cells[i] === 1 && !P.sol[i]) bad.push(i);
          else if (cells[i] === 2 && P.sol[i]) bad.push(i);
        }
        helpUsed = true; saveCur();
        if (!bad.length) { wrongFlash = []; ctx.sfx('star'); ctx.toast('Wszystko dobrze! Tak trzymaj.'); draw(); return; }
        wrongFlash = bad; flashT0 = tNow;
        ctx.sfx('error');
        ctx.toast(bad.length === 1 ? 'Popraw jedną kratkę.' : 'Popraw ' + bad.length + ' ' + plural(bad.length, 'kratkę', 'kratki', 'kratek') + '.');
        kick();
      }
      function onSeg(ev) {
        var b = ev.currentTarget; mode = +b.dataset.m; save.mode = mode; persist(); ctx.sfx('click'); syncHud();
      }
      function onKey(ev) {
        if (state !== 'play') return;
        if ((ev.ctrlKey || ev.metaKey) && ev.key === 'z') { ev.preventDefault(); doUndo(); }
        else if (ev.key === 'x' || ev.key === 'X') { mode = mode === 1 ? 2 : 1; syncHud(); }
      }

      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);
      canvas.addEventListener('pointerleave', onLeave);
      canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      [].forEach.call(segBtns, function (b) { b.addEventListener('click', onSeg); });
      undoBtn.addEventListener('click', doUndo);
      checkBtn.addEventListener('click', doCheck);
      otherBtn.addEventListener('click', askOther);
      window.addEventListener('keydown', onKey);

      // ---------- start ----------
      resize();
      var resume = save.cur && byId(save.cur.id);
      if (resume) startPuzzle(resume, save.cur);
      else if (save.credits > 0) showPicker();
      else showBuy(false);
      syncHud();

      return {
        destroy: function () {
          alive = false;
          cancelAnimationFrame(raf); raf = 0;
          clearTimeout(pressTimer);
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
