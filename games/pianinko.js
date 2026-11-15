/* Pianinko: nutki spadają w kolorowych torach do klawiszy na dole. Stuknij klawisz, gdy nutka dotknie kreski,
 * a zagra prawdziwa nuta melodii. Pudło nie psuje piosenki: nuta, której nikt nie trafił, gra cicho sama.
 * 40 ★ za piosenkę (wybór: 4 albo 5–6 klawiszy, tempo Wolno / Normalnie / Szybko).
 * Wynik: celność %, 1–3 gwiazdki, najdłuższa seria. „Graj sam”: darmowa klawiatura do zabawy.
 * Piosenki: polskie i światowe melodie ludowe / z domeny publicznej, zapisane ręcznie (nazwa nuty + długość w ćwierćnutach).
 */
(function () {
  'use strict';

  var FONT = '"Patrick Hand", "Comic Sans MS", cursive';
  var INK = '#1d2f6f', GOLD = '#e3a008', PURPLE = '#7a4fc4', MUTED = '#5a6690', GREEN = '#2a8a56';
  var PRICE = 40;
  var PALETTE = ['#ef6a5b', '#f39a3c', '#f2c230', '#5cbf6a', '#4f9be0', '#9a6ad8'];
  var LANE_COLORS = { 4: [0, 2, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] };
  var LANE_KEYS = { 4: 'dfjk', 5: 'sdfjk', 6: 'sdfjkl' };
  var SYL = ['do', 'do#', 're', 're#', 'mi', 'fa', 'fa#', 'sol', 'sol#', 'la', 'la#', 'si'];
  // white keys in free play: Boomwhacker-like colours per note name
  var WHITE_COL = { 0: '#ef6a5b', 2: '#f39a3c', 4: '#f2c230', 5: '#5cbf6a', 7: '#4f9be0', 9: '#7a6ad8', 11: '#d46ab8' };
  var SPEEDS = [
    { id: 0, name: 'Wolno', tempo: 0.72, fall: 2.6 },
    { id: 1, name: 'Normalnie', tempo: 1, fall: 2.1 },
    { id: 2, name: 'Szybko', tempo: 1.25, fall: 1.7 }
  ];
  // hit windows in seconds
  var W_SUPER = 0.10, W_GOOD = 0.18, W_OK = 0.26;

  // 'G4 E4*2 r*1': note name + octave, optional *beats (default 1); r = rest
  function parse(str) {
    var out = [], beat = 0, BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    str.trim().split(/\s+/).forEach(function (tok) {
      var m = /^([A-Gr])(#|b)?(\d)?(?:\*([\d.]+))?$/.exec(tok);
      if (!m) throw new Error('pianinko: bad note ' + tok);
      var len = m[4] ? parseFloat(m[4]) : 1;
      if (m[1] !== 'r') {
        var midi = 12 * (parseInt(m[3], 10) + 1) + BASE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
        out.push({ midi: midi, beat: beat, len: len });
      }
      beat += len;
    });
    return { notes: out, beats: beat };
  }
  function rep(s, n) { var a = []; for (var i = 0; i < n; i++) a.push(s); return a.join(' '); }

  var KOTEK_A = 'G4 E4 E4*2 F4 D4 D4*2 C4 E4 G4*2';
  var KOTEK_B = 'G4 E4 E4*2 F4 D4 D4*2 C4 E4 C4*2';
  var OWCA = 'E4 D4 C4 D4 E4 E4 E4*2 D4 D4 D4*2 E4 G4 G4*2 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4*4';
  var JANIE = 'C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4*2 E4 F4 G4*2 G4*.5 A4*.5 G4*.5 F4*.5 E4 C4 G4*.5 A4*.5 G4*.5 F4*.5 E4 C4 C4 G3 C4*2 C4 G3 C4*2';
  var DONALD = 'G4 G4 G4 D4 E4 E4 D4*2 B4 B4 A4 A4 G4*3 D4 G4 G4 G4 D4 E4 E4 D4*2 B4 B4 A4 A4 G4*4';
  var ODA_A = 'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4*1.5 D4*.5 D4*2';
  var ODA_A2 = 'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4*1.5 C4*.5 C4*2';
  var ODA_B = 'D4 D4 E4 C4 D4 E4*.5 F4*.5 E4 C4 D4 E4*.5 F4*.5 E4 D4 C4 D4 G3*2';
  var JINGLE_A = 'E4 E4 E4*2 E4 E4 E4*2 E4 G4 C4*1.5 D4*.5 E4*4 F4 F4 F4*1.5 F4*.5 F4 E4 E4 E4*.5 E4*.5';
  var SONG_DEFS = [
    { id: 'kotek', name: 'Wlazł kotek na płotek', lvl: 1, bpm: 100, col: '#f39a3c',
      src: rep(KOTEK_A + ' ' + KOTEK_B, 3) },
    { id: 'owieczka', name: 'Mała owieczka', lvl: 1, bpm: 104, col: '#5cbf6a', src: rep(OWCA, 3) },
    { id: 'gwiazdka', name: 'Błyszcz, gwiazdko', lvl: 1, bpm: 96, col: '#4f9be0',
      src: rep('C4 C4 G4 G4 A4 A4 G4*2 F4 F4 E4 E4 D4 D4 C4*2 G4 G4 F4 F4 E4 E4 D4*2 G4 G4 F4 F4 E4 E4 D4*2 C4 C4 G4 G4 A4 A4 G4*2 F4 F4 E4 E4 D4 D4 C4*2', 2) },
    { id: 'janie', name: 'Panie Janie', lvl: 2, bpm: 100, col: '#ef6a5b', src: rep(JANIE, 3) },
    { id: 'donald', name: 'Stary Donald farmę miał', lvl: 2, bpm: 112, col: '#9a6ad8', src: rep(DONALD, 3) },
    { id: 'oda', name: 'Oda do radości', lvl: 3, bpm: 108, col: '#f2c230',
      src: [ODA_A, ODA_A2, ODA_B, ODA_A2, ODA_B, ODA_A2].join(' ') },
    { id: 'dzwonki', name: 'Dzwoneczki (Jingle Bells)', lvl: 3, bpm: 120, col: '#2a9ab0',
      src: rep(JINGLE_A + ' E4 D4 D4 E4 D4*2 G4*2 ' + JINGLE_A + ' G4 G4 F4 D4 C4*4', 2) }
  ];
  var SONGS = SONG_DEFS.map(function (d) {
    var p = parse(d.src), pitches = [];
    p.notes.forEach(function (n) { if (pitches.indexOf(n.midi) < 0) pitches.push(n.midi); });
    pitches.sort(function (a, b) { return a - b; });
    return { id: d.id, name: d.name, lvl: d.lvl, bpm: d.bpm, col: d.col, notes: p.notes, beats: p.beats, pitches: pitches };
  });

  // lanes: higher note -> same or further-right lane, so the melody's shape stays visible
  function laneCount(song, hard) {
    var n = song.pitches.length;
    if (!hard) return Math.min(4, n);
    return n < 5 ? n : Math.min(6, n);
  }
  function laneOf(song, midi, L) {
    var n = song.pitches.length, r = song.pitches.indexOf(midi);
    if (n <= L) return n === 1 ? 0 : Math.round(r * (L - 1) / (n - 1));
    return Math.floor(r * L / n);
  }
  function starsFor(acc) { return acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1; }
  function plural(n, one, few, many) {
    if (n === 1) return one;
    var d = n % 10, t = n % 100;
    return (d >= 2 && d <= 4 && (t < 12 || t > 14)) ? few : many;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
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
  function lighten(hex, t) {
    var v = parseInt(hex.slice(1), 16);
    var r = (v >> 16) & 255, gg = (v >> 8) & 255, b = v & 255;
    return 'rgb(' + Math.round(r + (255 - r) * t) + ',' + Math.round(gg + (255 - gg) * t) + ',' + Math.round(b + (255 - b) * t) + ')';
  }
  function darken(hex, t) {
    var v = parseInt(hex.slice(1), 16);
    return 'rgb(' + Math.round(((v >> 16) & 255) * (1 - t)) + ',' + Math.round(((v >> 8) & 255) * (1 - t)) + ',' + Math.round((v & 255) * (1 - t)) + ')';
  }
  function starsText(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }

  var PIC = (function () {
    var s = '';
    // falling lanes
    var cols = ['#ef6a5b', '#f39a3c', '#f2c230', '#5cbf6a', '#4f9be0', '#9a6ad8'];
    for (var i = 0; i < 6; i++) s += '<rect x="' + (6 + i * 18) + '" y="0" width="18" height="50" fill="' + cols[i] + '" opacity=".13"/>';
    s += '<path d="M4 44 H116" stroke="#1d2f6f" stroke-width="2" stroke-dasharray="4 3"/>';
    // keys
    for (i = 0; i < 6; i++) s += '<rect x="' + (7.5 + i * 18) + '" y="50" width="15" height="19" rx="4" fill="' + cols[i] + '" stroke="#1d2f6f" stroke-width="2"/>';
    // notes
    [[0, 36], [2, 22], [3, 8], [5, 28]].forEach(function (p) {
      var x = 15 + p[0] * 18;
      s += '<circle cx="' + x + '" cy="' + p[1] + '" r="6.5" fill="' + cols[p[0]] + '" stroke="#1d2f6f" stroke-width="2"/>';
    });
    s += '<path d="M84 18 v-12 l9 -3 v12" fill="none" stroke="#1d2f6f" stroke-width="2"/><ellipse cx="81.5" cy="18" rx="3.2" ry="2.4" fill="#1d2f6f"/><ellipse cx="90.5" cy="15" rx="3.2" ry="2.4" fill="#1d2f6f"/>';
    return s;
  })();

  var CSS = [
    '.pk-menu{overflow-y:auto;touch-action:pan-y;-webkit-overflow-scrolling:touch;background:linear-gradient(#fde7f1,#eef3ff 60%);z-index:2}',
    '.pk-in{max-width:620px;margin:0 auto;padding:14px 14px 30px;display:flex;flex-direction:column;gap:12px}',
    '.pk-card{background:#fff;border:3px solid #1d2f6f;border-radius:20px;padding:12px 14px;box-shadow:0 4px 0 rgba(29,47,111,.18)}',
    '.pk-head{text-align:center;display:flex;flex-direction:column;gap:6px}',
    '.pk-head h2{margin:0;font-weight:400;font-size:2.2rem;line-height:1}',
    '.pk-head p{margin:0;font-size:1.15rem}',
    '.pk-md{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}',
    '.pk-md span{font-size:.95rem;border:2px solid #d4def0;border-radius:999px;padding:1px 9px;color:#5a6690;opacity:.75}',
    '.pk-md span.got{border-color:#1d2f6f;color:#1d2f6f;opacity:1;background:#fff8e1}',
    '.pk-opt{display:flex;flex-direction:column;gap:8px}',
    '.pk-lbl{font-size:1.05rem;color:#5a6690;margin-bottom:-4px}',
    '.pk-seg{display:flex;gap:6px}',
    '.pk-seg button{flex:1;min-height:46px;border:3px solid #1d2f6f;border-radius:14px;background:#fff;font-size:1.15rem;padding:4px 6px;line-height:1.05}',
    '.pk-seg button.on{background:#7a4fc4;color:#fff}',
    '.pk-seg button small{display:block;font-size:.85rem;opacity:.85}',
    '.pk-songs{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}',
    '.pk-song{position:relative;text-align:left;background:#fff;border:3px solid #1d2f6f;border-radius:18px;padding:10px 12px 10px 20px;min-height:84px;display:flex;flex-direction:column;justify-content:space-between;gap:4px;box-shadow:0 4px 0 rgba(29,47,111,.18);overflow:hidden}',
    '.pk-song:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(29,47,111,.18)}',
    '.pk-song i{position:absolute;left:0;top:0;bottom:0;width:10px;border-right:2px solid #1d2f6f}',
    '.pk-song b{font-weight:400;font-size:1.2rem;line-height:1.05}',
    '.pk-song span{display:flex;justify-content:space-between;align-items:baseline;font-size:1rem;color:#5a6690}',
    '.pk-song em{font-style:normal;color:#e3a008;font-size:1.25rem;letter-spacing:1px}',
    '.pk-btns{display:flex;flex-direction:column;gap:10px;align-items:stretch}',
    '.pk-free{background:#fff;font-size:1.4rem}',
    '.pk-bar{position:absolute;left:0;right:0;top:0;bottom:auto !important;height:56px;display:flex;align-items:center;gap:8px;padding:8px 10px;z-index:3;pointer-events:none}',
    '.pk-bar button{pointer-events:auto;min-height:44px;min-width:44px;border:3px solid #1d2f6f;border-radius:14px;background:#fff;font-size:1.15rem;padding:2px 12px;box-shadow:0 3px 0 rgba(29,47,111,.25)}',
    '.pk-bar .sp{flex:1;text-align:center;font-size:1.3rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.ng-panel .ng-btn{white-space:nowrap}',
    '@media (max-width:400px){.ng-panel .ng-btn:not(.sec){font-size:1.32rem;padding-left:12px;padding-right:12px}}'
  ].join('\n');

  var impl = {
    ownMusic: true,
    meta: { name: 'Pianinko', price: PRICE + ' ★ za piosenkę', bg: '#fde7f1', pic: PIC },
    medals: [
      { id: 'b', stat: 'songs', at: 3, tier: 1, text: '3 zagrane piosenki' },
      { id: 's', stat: 'stars3', at: 3, tier: 2, text: '3 piosenki na ★★★' },
      { id: 'g', stat: 'stars3', at: SONGS.length, tier: 3, text: 'Wszystkie piosenki na ★★★' }
    ],
    quests: [
      { id: 'songs', stat: 'songs', n: [1, 2], text: 'Zagraj {n} {p} na Pianinku', forms: ['piosenkę', 'piosenki', 'piosenek'] },
      { id: 'combo', stat: 'combo', mode: 'max', n: [10, 15], text: 'Zrób serię {n} nutek na Pianinku' }
    ],
    stickers: [
      { id: 'first-song', emoji: '🎹', name: 'Pierwsza piosenka' },
      { id: 'first-3star', emoji: '🌟', name: 'Pierwsze ★★★' },
      { id: 'no-miss', emoji: '🎯', name: 'Bez pudła' },
      { id: 'all-songs', emoji: '🎼', name: 'Każda piosenka zagrana' }
    ],
    _test: { songs: SONGS, parse: parse, laneOf: laneOf, laneCount: laneCount, live: null },
    mount: mount
  };
  NG.register('pianinko', impl);

  function mount(el, ctx) {
    var save = ctx.load({ best: {}, played: {}, hard: false, speed: 1, plays: 0 });
    if (!save.best || typeof save.best !== 'object') save.best = {};
    if (!save.played || typeof save.played !== 'object') save.played = {};
    function persist() { ctx.save(save); }
    ctx.music(null);

    var reduced = false;
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

    var css = document.createElement('style');
    css.textContent = CSS;
    el.appendChild(css);
    var canvas = document.createElement('canvas');
    el.appendChild(canvas);
    var g = canvas.getContext('2d');
    var menu = document.createElement('div');
    menu.className = 'pk-menu';
    el.appendChild(menu);
    var bar = null;

    var W = 1, H = 1, dpr = 1;
    var mode = 'menu';            // menu | play | result | free
    var alive = true, paused = false, raf = 0, panel = null, endTimer = 0;
    var tNow = 0, lastTs = 0;     // animation clock (seconds)
    var fx = [], parts = [];

    // ---------- song state ----------
    var S = null;  // { song, L, colors, speed, spb, fall, lead, notes, startPerf, endT, combo, maxCombo, score, strays, hits, misses, count, hold }
    var pressed = [];

    function songTime(now) { return (now - S.startPerf) / 1000 - S.lead; }

    // ---------- layout ----------
    var Lp = null;
    function layoutPlay() {
      if (!S) return;
      var pad = 6, hud = 52;
      var laneW = (W - 2 * pad) / S.L;
      var keyH = clamp(Math.round(H * 0.17), 74, 140);
      var r = clamp(Math.round(laneW * 0.36), 16, 32);
      var keyTop = H - keyH - 8;
      var lineY = keyTop - r - 10;
      Lp = { pad: pad, hud: hud, laneW: laneW, keyH: keyH, keyTop: keyTop, lineY: lineY, r: r, top: hud + 6 };
    }
    var Lf = null;
    function layoutFree() {
      var nWhite = W >= 640 ? 15 : 8;
      var pad = 8, kw = (W - 2 * pad) / nWhite;
      var top = Math.max(150, Math.round(H * 0.4));
      Lf = { nWhite: nWhite, pad: pad, kw: kw, top: top, bottom: H - 10, bw: kw * 0.62, bh: (H - 10 - top) * 0.6 };
    }
    function resize() {
      var r = el.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      layoutPlay(); layoutFree();
      draw();
    }
    var ro = new ResizeObserver(resize);
    ro.observe(el);

    // ---------- menu ----------
    function closePanel() { if (panel) { try { panel.close(); } catch (e) {} panel = null; } }
    function showMenu() {
      closePanel();
      clearTimeout(endTimer);
      removeBar();
      mode = 'menu'; S = null; impl._test.live = null;
      menu.hidden = false;
      menu.innerHTML = '';
      var inn = document.createElement('div'); inn.className = 'pk-in';
      menu.appendChild(inn);

      var head = document.createElement('div'); head.className = 'pk-card pk-head';
      head.innerHTML = '<h2>Pianinko</h2><p>Stuknij klawisz, kiedy nutka dotknie kreski.</p>';
      var md = document.createElement('div'); md.className = 'pk-md';
      ctx.medals().forEach(function (m) {
        var sp = document.createElement('span'); if (m.got) sp.className = 'got';
        sp.textContent = NG.meta.TIER[m.tier].e + ' ' + m.text;
        md.appendChild(sp);
      });
      head.appendChild(md);
      inn.appendChild(head);

      var opt = document.createElement('div'); opt.className = 'pk-card pk-opt';
      opt.appendChild(label('Klawisze'));
      opt.appendChild(seg([
        { html: 'Łatwo<small>4 klawisze</small>', on: !save.hard, pick: function () { save.hard = false; } },
        { html: 'Trudniej<small>5–6 klawiszy</small>', on: !!save.hard, pick: function () { save.hard = true; } }
      ]));
      opt.appendChild(label('Tempo'));
      opt.appendChild(seg(SPEEDS.map(function (sp) {
        return { html: sp.name, on: save.speed === sp.id, pick: function () { save.speed = sp.id; } };
      })));
      inn.appendChild(opt);

      var list = document.createElement('div'); list.className = 'pk-songs';
      SONGS.forEach(function (song) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'pk-song';
        b.dataset.song = song.id;
        var best = save.best[song.id];
        b.innerHTML = '<i></i><b></b><span><em></em><small></small></span>';
        b.querySelector('i').style.background = song.col;
        b.querySelector('b').textContent = song.name;
        b.querySelector('em').textContent = starsText(best ? best.s : 0);
        b.querySelector('small').textContent = '♪♪♪'.slice(0, song.lvl);
        b.onclick = function () { ctx.sfx('tap'); askSong(song); };
        list.appendChild(b);
      });
      inn.appendChild(list);

      var btns = document.createElement('div'); btns.className = 'pk-btns';
      var fb = document.createElement('button'); fb.type = 'button'; fb.className = 'ng-btn pk-free'; fb.textContent = '🎹 Graj sam · za darmo';
      fb.onclick = function () { ctx.sfx('open'); startFree(); };
      var back = document.createElement('button'); back.type = 'button'; back.className = 'ng-btn sec'; back.textContent = 'Wróć do gier';
      back.onclick = function () { ctx.exit(); };
      btns.appendChild(fb); btns.appendChild(back);
      inn.appendChild(btns);
      draw();
    }
    function label(t) { var d = document.createElement('div'); d.className = 'pk-lbl'; d.textContent = t; return d; }
    function seg(items) {
      var box = document.createElement('div'); box.className = 'pk-seg';
      items.forEach(function (it) {
        var b = document.createElement('button'); b.type = 'button'; b.innerHTML = it.html;
        if (it.on) b.className = 'on';
        b.setAttribute('aria-pressed', it.on ? 'true' : 'false');
        b.onclick = function () {
          it.pick(); persist(); ctx.sfx('click');
          [].forEach.call(box.children, function (c) { c.className = ''; c.setAttribute('aria-pressed', 'false'); });
          b.className = 'on'; b.setAttribute('aria-pressed', 'true');
        };
        box.appendChild(b);
      });
      return box;
    }
    function askSong(song) {
      closePanel();
      var L = laneCount(song, save.hard), sp = SPEEDS[save.speed] || SPEEDS[1];
      var best = save.best[song.id];
      panel = ctx.panel({
        title: song.name,
        lines: [
          L + ' ' + plural(L, 'klawisz', 'klawisze', 'klawiszy') + ' · ' + sp.name,
          { text: best ? 'Najlepiej: ' + starsText(best.s) + ' · ' + Math.round(best.a * 100) + '%' : 'Jeszcze nie grana', muted: true }
        ],
        price: PRICE, note: song.name,
        button: 'Graj',
        onPlay: function () { panel = null; startSong(song); },
        secondary: [{ label: 'Inna piosenka', onClick: function () { panel = null; } }]
      });
    }

    // ---------- song ----------
    function startSong(song) {
      closePanel();
      menu.hidden = true;
      var sp = SPEEDS[save.speed] || SPEEDS[1];
      var L = laneCount(song, save.hard);
      var spb = 60 / (song.bpm * sp.tempo);
      var notes = song.notes.map(function (n) {
        return { midi: n.midi, t: n.beat * spb, dur: clamp(n.len * spb * 0.95, 0.25, 1.4), len: n.len * spb, lane: laneOf(song, n.midi, L),
          judged: false, hit: 0, hitAt: 0, played: false, missAt: 0 };
      });
      var last = notes[notes.length - 1];
      S = { song: song, L: L, colors: LANE_COLORS[L].map(function (i) { return PALETTE[i]; }), speed: sp, spb: spb, fall: sp.fall,
        lead: Math.max(sp.fall, 3 * spb) + 0.5, notes: notes, startPerf: performance.now(), endT: last.t + last.len + 1.0,
        combo: 0, maxCombo: 0, score: 0, strays: 0, hits: 0, misses: 0, count: 4, hold: 0, holdT: 0, ended: false };
      pressed = []; for (var i = 0; i < L; i++) pressed.push(-9);
      fx = []; parts = [];
      mode = 'play';
      layoutPlay();
      impl._test.live = { song: song.id, L: L, notes: notes, time: function () { return S ? songTime(performance.now()) : null; }, tap: tapLane, state: function () { return S; } };
    }

    function judge(note, err) {
      var a = Math.abs(err), pts, txt, col;
      if (a <= W_SUPER) { pts = 1; txt = 'Super!'; col = GOLD; }
      else if (a <= W_GOOD) { pts = 0.8; txt = 'Dobrze!'; col = GREEN; }
      else { pts = 0.55; txt = err < 0 ? 'Za szybko' : 'Za późno'; col = PURPLE; }
      note.judged = true; note.hit = pts; note.hitAt = tNow;
      S.score += pts; S.hits++;
      S.combo++; if (S.combo > S.maxCombo) S.maxCombo = S.combo;
      ctx.note(note.midi, note.dur, 0.45);
      note.played = true;
      fx.push({ lane: note.lane, text: txt, col: col, t0: tNow });
      if (pts === 1 && !reduced && Lp) burst(laneX(note.lane), Lp.lineY, S.colors[note.lane]);
      if (S.combo > 0 && S.combo % 25 === 0) { fx.push({ lane: -1, text: 'Seria ' + S.combo + '!', col: GOLD, t0: tNow }); }
    }
    function tapLane(lane) {
      if (mode !== 'play' || !S || lane < 0 || lane >= S.L) return;
      pressed[lane] = tNow;
      if (S.hold) return;
      var t = songTime(performance.now());
      var best = null;
      for (var i = 0; i < S.notes.length; i++) {
        var n = S.notes[i];
        if (n.t - t > W_OK) break;
        if (n.judged || n.lane !== lane) continue;
        if (Math.abs(n.t - t) <= W_OK) { best = n; break; }
      }
      if (best) judge(best, t - best.t);
      else {
        S.strays++;
        S.combo = 0;
        ctx.sfx('tap');
      }
    }
    function stepSong() {
      var now = performance.now();
      if (S.hold) {
        // after a pause: keep the clock frozen for a moment with a 3-2-1 countdown
        S.startPerf = now - (S.holdT + S.lead) * 1000;
        if (now >= S.hold) S.hold = 0;
        return;
      }
      var t = songTime(now);
      // count-in ticks: 3, 2, 1 beats before the first note
      var c = Math.ceil(-t / S.spb);
      if (t < 0 && c <= 3 && c < S.count) { S.count = c; ctx.sfx('tick'); }
      if (t >= 0 && S.count > 0) S.count = 0;
      for (var i = 0; i < S.notes.length; i++) {
        var n = S.notes[i];
        if (n.t > t) break;
        // the melody keeps going: a note nobody tapped (yet) plays softly by itself
        if (!n.played) { n.played = true; if (!n.judged) ctx.note(n.midi, n.dur, 0.14); }
        if (!n.judged && t - n.t > W_OK) {
          n.judged = true; n.missAt = tNow; S.misses++; S.combo = 0;
          fx.push({ lane: n.lane, text: 'Ups', col: MUTED, t0: tNow });
        }
      }
      if (!S.ended && t >= S.endT) { S.ended = true; finish(); }
    }
    function finish() {
      var s = S, N = s.notes.length;
      var acc = clamp((s.score - 0.25 * s.strays) / N, 0, 1);
      var stars = starsFor(acc);
      var prev = save.best[s.song.id];
      var record = !prev || stars > prev.s || (stars === prev.s && acc > prev.a + 0.0001);
      if (record) save.best[s.song.id] = { s: stars, a: Math.round(acc * 1000) / 1000 };
      save.played[s.song.id] = (save.played[s.song.id] || 0) + 1;
      save.plays = (save.plays || 0) + 1;
      persist();
      var n3 = SONGS.filter(function (x) { return save.best[x.id] && save.best[x.id].s === 3; }).length;
      ctx.stat('songs', 1);
      ctx.stat('notes', s.hits);
      ctx.stat('combo', s.maxCombo, 'max');
      ctx.stat('stars3', n3, 'max');
      ctx.sticker('first-song');
      if (stars === 3) ctx.sticker('first-3star');
      if (s.misses === 0) ctx.sticker('no-miss');
      if (SONGS.every(function (x) { return save.played[x.id]; })) ctx.sticker('all-songs');
      ctx.sfx(stars === 3 ? 'win' : 'star');
      mode = 'result';
      impl._test.live = { song: s.song.id, result: { acc: acc, stars: stars, combo: s.maxCombo, hits: s.hits, misses: s.misses, strays: s.strays } };
      endTimer = setTimeout(function () {
        endTimer = 0;
        if (!alive) return;
        panel = ctx.panel({
          title: stars === 3 ? 'Wspaniale!' : stars === 2 ? 'Brawo!' : 'Dobrze!',
          big: starsText(stars),
          lines: [
            s.song.name,
            'Celność: ' + Math.round(acc * 100) + '%',
            'Najdłuższa seria: ' + s.maxCombo + ' ' + plural(s.maxCombo, 'nutka', 'nutki', 'nutek'),
            { text: record && prev ? 'Nowy rekord!' : stars < 3 ? 'Na ★★★ trzeba 90%. Spróbuj wolniej!' : 'Pięknie zagrane!', muted: true }
          ],
          price: PRICE, note: s.song.name,
          button: 'Jeszcze raz',
          onPlay: function () { panel = null; startSong(s.song); },
          secondary: [
            { label: 'Inna piosenka', onClick: function () { panel = null; showMenu(); } },
            { label: 'Wróć do gier', onClick: function () { ctx.exit(); } }
          ]
        });
      }, 500);
    }
    function burst(x, y, col) {
      for (var i = 0; i < 7; i++) {
        var a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 90;
        parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t0: tNow, col: Math.random() < 0.5 ? GOLD : col });
      }
      if (parts.length > 120) parts.splice(0, parts.length - 120);
    }
    function laneX(i) { return Lp.pad + Lp.laneW * (i + 0.5); }

    // ---------- free play ----------
    var freeBase = 60, voices = {}, bubbles = [], freeDown = {};
    function removeBar() { if (bar) { bar.remove(); bar = null; } }
    function startFree() {
      closePanel();
      menu.hidden = true;
      mode = 'free'; S = null; impl._test.live = { free: true };
      layoutFree();
      bar = document.createElement('div'); bar.className = 'pk-bar';
      bar.innerHTML = '<button type="button" data-a="back">← Piosenki</button><span class="sp">Graj sam</span><button type="button" data-a="down" aria-label="Niżej">▼</button><button type="button" data-a="up" aria-label="Wyżej">▲</button>';
      bar.addEventListener('click', onBar);
      el.appendChild(bar);
      bubbles = []; freeDown = {}; fx = [];
    }
    function onBar(e) {
      var b = e.target.closest('button'); if (!b) return;
      var a = b.dataset.a;
      if (a === 'back') { ctx.sfx('close'); showMenu(); return; }
      var nb = clamp(freeBase + (a === 'up' ? 12 : -12), 48, 72);
      if (nb === freeBase) { ctx.sfx('error'); return; }
      freeBase = nb; ctx.sfx('click');
      fx.push({ lane: -2, text: nb > 60 ? 'Wyżej' : nb < 60 ? 'Niżej' : 'Środek', col: PURPLE, t0: tNow });
    }
    var WHITE_STEPS = [0, 2, 4, 5, 7, 9, 11];
    function whiteMidi(i) { return freeBase + 12 * Math.floor(i / 7) + WHITE_STEPS[i % 7]; }
    function freeKeys() {
      // list of { midi, x, y, w, h, black }
      var keys = [], i;
      for (i = 0; i < Lf.nWhite; i++) keys.push({ midi: whiteMidi(i), x: Lf.pad + i * Lf.kw, y: Lf.top, w: Lf.kw, h: Lf.bottom - Lf.top, black: false });
      for (i = 0; i < Lf.nWhite - 1; i++) {
        var st = WHITE_STEPS[i % 7];
        if (st === 4 || st === 11) continue;
        keys.push({ midi: whiteMidi(i) + 1, x: Lf.pad + (i + 1) * Lf.kw - Lf.bw / 2, y: Lf.top, w: Lf.bw, h: Lf.bh, black: true });
      }
      return keys;
    }
    function freeKeyAt(x, y) {
      if (!Lf || y < Lf.top) return null;
      var keys = freeKeys(), i;
      for (i = keys.length - 1; i >= 0; i--) { var k = keys[i]; if (k.black && x >= k.x && x <= k.x + k.w && y <= k.y + k.h) return k; }
      for (i = 0; i < keys.length; i++) { k = keys[i]; if (!k.black && x >= k.x && x < k.x + k.w) return k; }
      return null;
    }
    function playFree(k) {
      ctx.note(k.midi, 0.9, 0.42);
      voices[k.midi] = tNow;
      if (bubbles.length > 40) bubbles.shift();
      var pc = k.midi % 12;
      bubbles.push({ x: k.x + k.w / 2, y: Lf.top - 10, t0: tNow, midi: k.midi, col: WHITE_COL[pc] || '#b8c0e0', drift: (Math.random() - 0.5) * 30 });
    }

    // ---------- input ----------
    function pos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function onDown(e) {
      var p = pos(e);
      if (mode === 'play' && S && Lp) {
        if (p.y < Lp.top) return;
        e.preventDefault();
        tapLane(clamp(Math.floor((p.x - Lp.pad) / Lp.laneW), 0, S.L - 1));
      } else if (mode === 'free') {
        var k = freeKeyAt(p.x, p.y);
        if (!k) return;
        e.preventDefault();
        try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
        freeDown[e.pointerId] = k.midi;
        playFree(k);
      }
    }
    function onMove(e) {
      if (mode !== 'free' || !(e.pointerId in freeDown)) return;
      var p = pos(e), k = freeKeyAt(p.x, p.y);
      if (k && k.midi !== freeDown[e.pointerId]) { freeDown[e.pointerId] = k.midi; playFree(k); }
    }
    function onUp(e) { delete freeDown[e.pointerId]; }
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    var FREE_KEYS = 'asdfghjkl;', FREE_BLACK = { w: 1, e: 3, t: 6, y: 8, u: 10, o: 13, p: 15 };
    function onKey(e) {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      var k = (e.key || '').toLowerCase();
      if (mode === 'play' && S) {
        var idx = LANE_KEYS[S.L] ? LANE_KEYS[S.L].indexOf(k) : -1;
        if (idx < 0 && k >= '1' && k <= '6') idx = +k - 1;
        if (idx >= 0 && idx < S.L) { e.preventDefault(); tapLane(idx); }
      } else if (mode === 'free' && Lf) {
        var wi = FREE_KEYS.indexOf(k), midi = null;
        if (wi >= 0 && wi < Lf.nWhite) midi = whiteMidi(wi);
        else if (k in FREE_BLACK) midi = freeBase + FREE_BLACK[k];
        if (midi == null) return;
        var key = freeKeys().filter(function (q) { return q.midi === midi; })[0];
        if (key) { e.preventDefault(); playFree(key); }
      }
    }
    window.addEventListener('keydown', onKey);

    // ---------- drawing ----------
    function draw() {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if ((mode === 'play' || mode === 'result') && S && Lp) drawPlay();
      else if (mode === 'free' && Lf) drawFree();
      else { g.fillStyle = '#fde7f1'; g.fillRect(0, 0, W, H); }
    }
    function drawPlay() {
      var now = performance.now();
      var t = mode === 'play' ? songTime(now) : S.endT;
      var bgr = g.createLinearGradient(0, 0, 0, H);
      bgr.addColorStop(0, '#fdf1f7'); bgr.addColorStop(1, '#eef3ff');
      g.fillStyle = bgr; g.fillRect(0, 0, W, H);
      var L = S.L, lw = Lp.laneW, i, x;
      // lanes
      for (i = 0; i < L; i++) {
        x = Lp.pad + i * lw;
        var glow = clamp(1 - (tNow - pressed[i]) / 0.25, 0, 1);
        g.globalAlpha = 0.13 + glow * 0.22;
        g.fillStyle = S.colors[i];
        g.fillRect(x + 2, Lp.top, lw - 4, Lp.keyTop - Lp.top);
        g.globalAlpha = 1;
      }
      // hit line + target rings
      g.strokeStyle = INK; g.lineWidth = 3; g.setLineDash([10, 7]);
      g.beginPath(); g.moveTo(4, Lp.lineY); g.lineTo(W - 4, Lp.lineY); g.stroke();
      g.setLineDash([]);
      for (i = 0; i < L; i++) {
        g.beginPath(); g.arc(laneX(i), Lp.lineY, Lp.r + 3, 0, Math.PI * 2);
        g.fillStyle = 'rgba(255,255,255,.75)'; g.fill();
        g.lineWidth = 3; g.strokeStyle = S.colors[i]; g.stroke();
      }
      // notes
      var span = Lp.lineY - Lp.top, r = Lp.r;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (i = 0; i < S.notes.length; i++) {
        var n = S.notes[i];
        var y = Lp.lineY - (n.t - t) / S.fall * span;
        if (y < Lp.top - r - 200) break;
        x = laneX(n.lane);
        if (n.hit) {
          var k = (tNow - n.hitAt) / 0.25;
          if (k >= 1) continue;
          g.globalAlpha = 1 - k;
          drawNote(x, Lp.lineY, r * (1 + k * 0.6), S.colors[n.lane], n.midi, 0);
          g.globalAlpha = 1;
          continue;
        }
        if (y > H + r) continue;
        var tail = n.len >= S.spb * 1.9 ? n.len * 0.75 / S.fall * span : 0;
        if (n.judged) { g.globalAlpha = 0.3; drawNote(x, y, r * 0.85, '#b9c2d8', n.midi, tail); g.globalAlpha = 1; }
        else if (y > Lp.top - r - tail) drawNote(x, y, r, S.colors[n.lane], n.midi, tail);
      }
      // keys
      for (i = 0; i < L; i++) {
        x = Lp.pad + i * lw;
        var down = tNow - pressed[i] < 0.12, off = down ? 3 : 0;
        rr(g, x + 4, Lp.keyTop + 4, lw - 8, Lp.keyH - 4, 16);
        g.fillStyle = 'rgba(29,47,111,.25)'; g.fill();
        rr(g, x + 4, Lp.keyTop + off, lw - 8, Lp.keyH - 4, 16);
        g.fillStyle = down ? darken(S.colors[i], 0.12) : S.colors[i]; g.fill();
        g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
        rr(g, x + 12, Lp.keyTop + off + 8, lw - 24, Math.min(16, Lp.keyH * 0.18), 8);
        g.fillStyle = 'rgba(255,255,255,.45)'; g.fill();
      }
      // particles
      for (i = parts.length - 1; i >= 0; i--) {
        var p = parts[i], a = tNow - p.t0;
        if (a > 0.6) { parts.splice(i, 1); continue; }
        g.globalAlpha = 1 - a / 0.6;
        g.fillStyle = p.col;
        star(p.x + p.vx * a, p.y + p.vy * a + 160 * a * a, 5);
        g.globalAlpha = 1;
      }
      // feedback words
      for (i = fx.length - 1; i >= 0; i--) {
        var f = fx[i], age = tNow - f.t0, life = f.lane === -1 ? 1.2 : 0.6;
        if (age > life) { fx.splice(i, 1); continue; }
        g.globalAlpha = 1 - age / life;
        var fxX = f.lane >= 0 ? laneX(f.lane) : W / 2, fxY = f.lane >= 0 ? Lp.lineY - r - 18 - age * 40 : H * 0.36 - age * 30;
        g.font = (f.lane === -1 ? 40 : clamp(Math.round(lw * 0.26), 16, 24)) + 'px ' + FONT;
        g.lineWidth = 4; g.strokeStyle = '#fff'; g.strokeText(f.text, fxX, fxY);
        g.fillStyle = f.col; g.fillText(f.text, fxX, fxY);
        g.globalAlpha = 1;
      }
      // HUD
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, Lp.hud);
      g.fillStyle = INK; g.fillRect(0, Lp.hud - 3, W, 3);
      var prog = clamp(t / (S.endT - 1), 0, 1);
      g.fillStyle = 'rgba(122,79,196,.18)'; g.fillRect(0, Lp.hud - 9, W, 6);
      g.fillStyle = PURPLE; g.fillRect(0, Lp.hud - 9, W * prog, 6);
      g.textAlign = 'left'; g.textBaseline = 'middle';
      g.font = '21px ' + FONT; g.fillStyle = INK;
      var comboTxt = 'Seria: ' + S.combo;
      g.font = '22px ' + FONT;
      var cw = g.measureText(comboTxt).width;
      g.font = '21px ' + FONT;
      var nm = S.song.name, maxW = W - cw - 36;
      while (nm.length > 4 && g.measureText(nm).width > maxW) nm = nm.slice(0, -2) + '…';
      g.fillText(nm, 12, (Lp.hud - 8) / 2 + 1);
      g.textAlign = 'right'; g.font = '22px ' + FONT;
      g.fillStyle = S.combo >= 10 ? GOLD : INK;
      g.fillText(comboTxt, W - 12, (Lp.hud - 8) / 2 + 1);
      // countdown
      var cd = 0;
      if (S.hold) cd = Math.ceil((S.hold - now) / 500);
      else if (mode === 'play' && t < 0 && S.count > 0 && S.count <= 3) cd = S.count;
      if (cd > 0) {
        var cy = (Lp.top + Lp.lineY) / 2 - 20;
        g.beginPath(); g.arc(W / 2, cy, 46, 0, Math.PI * 2);
        g.fillStyle = '#fff'; g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
        g.textAlign = 'center'; g.fillStyle = PURPLE; g.font = '58px ' + FONT;
        g.fillText(String(cd), W / 2, cy + 3);
      } else if (mode === 'play' && t < 0) {
        g.textAlign = 'center'; g.font = '26px ' + FONT;
        g.lineWidth = 5; g.strokeStyle = '#fff'; g.strokeText('Patrz na kreskę!', W / 2, Lp.top + 50);
        g.fillStyle = INK; g.fillText('Patrz na kreskę!', W / 2, Lp.top + 50);
      }
    }
    function drawNote(x, y, r, col, midi, tail) {
      if (tail > 0) {
        rr(g, x - r * 0.32, y - tail, r * 0.64, tail, r * 0.32);
        g.fillStyle = lighten(col.charAt(0) === '#' ? col : '#b9c2d8', 0.45); g.fill();
        g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
      }
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
      g.fillStyle = col; g.fill();
      g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
      g.beginPath(); g.arc(x - r * 0.35, y - r * 0.38, r * 0.22, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,255,.55)'; g.fill();
      g.font = Math.round(r * 0.82) + 'px ' + FONT;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = INK;
      g.fillText(SYL[midi % 12], x, y + 1);
    }
    function star(x, y, r) {
      g.beginPath();
      for (var i = 0; i < 10; i++) {
        var a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.45 : r;
        g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
      }
      g.closePath(); g.fill();
    }
    function drawFree() {
      var bgr = g.createLinearGradient(0, 0, 0, H);
      bgr.addColorStop(0, '#fde7f1'); bgr.addColorStop(1, '#eef3ff');
      g.fillStyle = bgr; g.fillRect(0, 0, W, H);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (!bubbles.length) {
        g.font = '24px ' + FONT; g.fillStyle = MUTED;
        g.fillText('Zagraj, co chcesz!', W / 2, (56 + Lf.top) / 2);
      }
      // rising note bubbles
      for (var i = bubbles.length - 1; i >= 0; i--) {
        var b = bubbles[i], a = tNow - b.t0, life = 1.8;
        if (a > life) { bubbles.splice(i, 1); continue; }
        var y = b.y - (reduced ? 20 * a : a * (Lf.top - 70) / life);
        var x = b.x + (reduced ? 0 : Math.sin(a * 4) * 8 + b.drift * a);
        g.globalAlpha = 1 - a / life;
        drawNote(x, y, 20, b.col, b.midi, 0);
        g.globalAlpha = 1;
      }
      // keyboard
      var keys = freeKeys();
      g.fillStyle = INK;
      rr(g, Lf.pad - 4, Lf.top - 8, W - 2 * Lf.pad + 8, Lf.bottom - Lf.top + 14, 14); g.fill();
      keys.forEach(function (k) {
        if (k.black) return;
        var down = tNow - (voices[k.midi] || -9) < 0.15;
        var col = WHITE_COL[k.midi % 12];
        rr(g, k.x + 2, k.y, k.w - 4, k.h - (down ? 0 : 4), 10);
        g.fillStyle = down ? lighten(col, 0.55) : '#fff'; g.fill();
        // colour band + name
        var bandH = Math.min(46, k.h * 0.22);
        rr(g, k.x + 6, k.y + k.h - bandH - 10, k.w - 12, bandH, 9);
        g.fillStyle = col; g.fill();
        g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
        g.fillStyle = INK; g.font = Math.round(clamp(k.w * 0.4, 15, 24)) + 'px ' + FONT;
        g.fillText(SYL[k.midi % 12], k.x + k.w / 2, k.y + k.h - bandH / 2 - 9);
      });
      keys.forEach(function (k) {
        if (!k.black) return;
        var down = tNow - (voices[k.midi] || -9) < 0.15;
        rr(g, k.x, k.y - 2, k.w, k.h, 8);
        g.fillStyle = down ? '#4a5aa0' : INK; g.fill();
        rr(g, k.x + k.w * 0.2, k.y + 4, k.w * 0.6, k.h * 0.25, 5);
        g.fillStyle = 'rgba(255,255,255,.18)'; g.fill();
      });
      // octave hint
      for (i = fx.length - 1; i >= 0; i--) {
        var f = fx[i], age = tNow - f.t0;
        if (age > 0.9) { fx.splice(i, 1); continue; }
        g.globalAlpha = 1 - age / 0.9;
        g.font = '34px ' + FONT; g.lineWidth = 5; g.strokeStyle = '#fff';
        g.strokeText(f.text, W / 2, Lf.top - 40); g.fillStyle = f.col; g.fillText(f.text, W / 2, Lf.top - 40);
        g.globalAlpha = 1;
      }
    }

    // ---------- loop ----------
    function loop(ts) {
      if (!alive || paused) return;
      raf = requestAnimationFrame(loop);
      var t = ts / 1000;
      var dt = lastTs ? Math.min(0.05, t - lastTs) : 0;
      lastTs = t;
      tNow += dt;
      if (mode === 'play' && S) stepSong();
      if (mode !== 'menu') draw();
    }

    resize();
    showMenu();
    raf = requestAnimationFrame(loop);

    return {
      destroy: function () {
        alive = false;
        cancelAnimationFrame(raf);
        clearTimeout(endTimer);
        ro.disconnect();
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
        window.removeEventListener('keydown', onKey);
        closePanel();
        removeBar();
        canvas.remove(); menu.remove(); css.remove();
        impl._test.live = null;
        S = null;
      },
      pause: function () {
        if (paused) return;
        paused = true;
        cancelAnimationFrame(raf); raf = 0;
        if (mode === 'play' && S && !S.ended) {
          var now = performance.now();
          S.holdT = S.hold ? S.holdT : songTime(now);
          S.hold = Infinity;
        }
      },
      resume: function () {
        if (!alive || !paused) return;
        paused = false; lastTs = 0;
        if (mode === 'play' && S && S.hold) S.hold = performance.now() + 1500;
        raf = requestAnimationFrame(loop);
      }
    };
  }
})();
