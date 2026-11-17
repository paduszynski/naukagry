/*
 * Pokoik: a room to decorate, a long-running collection like Akwarium.
 * Furniture, decorations and toys are bought with stars (ctx.spend), some unlock by level. Items are drawn on
 * a canvas side view (wall + floor) and placed freely: drag to move (a teddy can sit on the bed), tap for a
 * small toolbar (flip, forward, back, put away). Owned items that are not in a room wait in the box (Pudło).
 * Wallpapers and floors are bought once and picked per room. A second room (Pokój zabaw) can be bought from
 * level 5. "Zrób zdjęcie" only celebrates (no download).
 * A guest from Zwierzątko (NG.petArt, the next pet in the family each visit) walks around the room; tap it.
 */
(function () {
  'use strict';

  var INK = '#1d2f6f', MUTED = '#5a6690';
  var FONT = '"Patrick Hand","Comic Sans MS",cursive';
  var MAX_ROOM = 40, ROOM2_PRICE = 150, ROOM2_LV = 5;
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // cat: shop tab; L: draw layer (0 flat on the floor, 1 on the wall, 2 everything else); at: default spot
  var ITEMS = [
    { k: 'lozko', n: 'łóżko', cat: 'meble', p: 100, lv: 1, w: 150, h: 84, L: 2, at: 'floor' },
    { k: 'biurko', n: 'biurko', cat: 'meble', p: 80, lv: 1, w: 112, h: 70, L: 2, at: 'floor' },
    { k: 'krzeslo', n: 'krzesło', cat: 'meble', p: 40, lv: 1, w: 44, h: 78, L: 2, at: 'floor' },
    { k: 'komoda', n: 'komoda', cat: 'meble', p: 70, lv: 1, w: 80, h: 58, L: 2, at: 'floor' },
    { k: 'stolik', n: 'stolik', cat: 'meble', p: 45, lv: 1, w: 60, h: 40, L: 2, at: 'floor' },
    { k: 'polka', n: 'półka na ścianę', cat: 'meble', p: 35, lv: 1, w: 80, h: 16, L: 1, at: 'wall' },
    { k: 'pufa', n: 'pufa', cat: 'meble', p: 50, lv: 2, w: 70, h: 52, L: 2, at: 'floor' },
    { k: 'regal', n: 'regał z książkami', cat: 'meble', p: 90, lv: 2, w: 70, h: 130, L: 2, at: 'floor' },
    { k: 'skrzynia', n: 'skrzynia na zabawki', cat: 'meble', p: 60, lv: 3, w: 74, h: 48, L: 2, at: 'floor' },
    { k: 'fotel', n: 'fotel', cat: 'meble', p: 95, lv: 4, w: 84, h: 80, L: 2, at: 'floor' },
    { k: 'szafa', n: 'szafa', cat: 'meble', p: 120, lv: 5, w: 96, h: 150, L: 2, at: 'floor' },
    { k: 'pietrowe', n: 'łóżko piętrowe', cat: 'meble', p: 150, lv: 9, w: 150, h: 150, L: 2, at: 'floor' },

    { k: 'dywan', n: 'dywan', cat: 'ozdoby', p: 50, lv: 1, w: 140, h: 16, L: 0, at: 'rug' },
    { k: 'kwiatek', n: 'kwiatek', cat: 'ozdoby', p: 25, lv: 1, w: 30, h: 44, L: 2, at: 'floor' },
    { k: 'plakat', n: 'plakat z tęczą', cat: 'ozdoby', p: 25, lv: 1, w: 50, h: 66, L: 1, at: 'wall' },
    { k: 'zegar', n: 'zegar', cat: 'ozdoby', p: 40, lv: 1, w: 40, h: 40, L: 1, at: 'wall' },
    { k: 'okno', n: 'okno z zasłonkami', cat: 'ozdoby', p: 90, lv: 1, w: 122, h: 116, L: 1, at: 'wall' },
    { k: 'lampka', n: 'lampka nocna', cat: 'ozdoby', p: 35, lv: 1, w: 30, h: 44, L: 2, at: 'floor' },
    { k: 'kaktus', n: 'kaktus', cat: 'ozdoby', p: 30, lv: 2, w: 28, h: 42, L: 2, at: 'floor' },
    { k: 'plakatkot', n: 'plakat z kotkiem', cat: 'ozdoby', p: 30, lv: 2, w: 50, h: 66, L: 1, at: 'wall' },
    { k: 'obrazek', n: 'obrazek', cat: 'ozdoby', p: 35, lv: 2, w: 56, h: 44, L: 1, at: 'wall' },
    { k: 'lampki', n: 'kolorowe lampki', cat: 'ozdoby', p: 60, lv: 2, w: 160, h: 36, L: 1, at: 'wall' },
    { k: 'lampa', n: 'lampa stojąca', cat: 'ozdoby', p: 65, lv: 3, w: 40, h: 130, L: 2, at: 'floor' },
    { k: 'choragiewki', n: 'chorągiewki', cat: 'ozdoby', p: 40, lv: 3, w: 160, h: 32, L: 1, at: 'wall' },
    { k: 'lustro', n: 'lustro', cat: 'ozdoby', p: 55, lv: 3, w: 44, h: 70, L: 1, at: 'wall' },
    { k: 'teczowy', n: 'tęczowy dywan', cat: 'ozdoby', p: 75, lv: 4, w: 120, h: 18, L: 0, at: 'rug' },
    { k: 'kula', n: 'kula z rybką', cat: 'ozdoby', p: 80, lv: 4, w: 40, h: 42, L: 2, at: 'floor' },
    { k: 'wiszaca', n: 'lampa wisząca', cat: 'ozdoby', p: 55, lv: 4, w: 50, h: 40, L: 1, at: 'ceil' },
    { k: 'roslina', n: 'duża roślina', cat: 'ozdoby', p: 70, lv: 5, w: 64, h: 120, L: 2, at: 'floor' },
    { k: 'plakatrak', n: 'plakat z rakietą', cat: 'ozdoby', p: 40, lv: 5, w: 50, h: 66, L: 1, at: 'wall' },
    { k: 'globus', n: 'globus', cat: 'ozdoby', p: 45, lv: 6, w: 36, h: 52, L: 2, at: 'floor' },
    { k: 'tablica', n: 'tablica', cat: 'ozdoby', p: 65, lv: 6, w: 80, h: 64, L: 1, at: 'wall' },
    { k: 'ksiezyc', n: 'lampka-księżyc', cat: 'ozdoby', p: 60, lv: 7, w: 40, h: 40, L: 1, at: 'wall' },
    { k: 'tecza', n: 'tęcza na ścianę', cat: 'ozdoby', p: 50, lv: 8, w: 96, h: 52, L: 1, at: 'wall' },

    { k: 'mis', n: 'miś', cat: 'zabawki', p: 40, lv: 1, w: 40, h: 46, L: 2, at: 'floor' },
    { k: 'pilka', n: 'piłka', cat: 'zabawki', p: 25, lv: 1, w: 30, h: 30, L: 2, at: 'floor' },
    { k: 'klocki', n: 'klocki', cat: 'zabawki', p: 30, lv: 1, w: 50, h: 34, L: 2, at: 'floor' },
    { k: 'lalka', n: 'lalka', cat: 'zabawki', p: 45, lv: 2, w: 28, h: 54, L: 2, at: 'floor' },
    { k: 'autko', n: 'autko', cat: 'zabawki', p: 30, lv: 2, w: 46, h: 28, L: 2, at: 'floor' },
    { k: 'konik', n: 'konik na biegunach', cat: 'zabawki', p: 90, lv: 4, w: 84, h: 70, L: 2, at: 'floor' },
    { k: 'namiot', n: 'namiot', cat: 'zabawki', p: 110, lv: 5, w: 100, h: 112, L: 2, at: 'floor' },
    { k: 'domek', n: 'domek dla lalek', cat: 'zabawki', p: 130, lv: 6, w: 108, h: 110, L: 2, at: 'floor' },
    { k: 'pianinko', n: 'pianinko', cat: 'zabawki', p: 85, lv: 7, w: 70, h: 50, L: 2, at: 'floor' },
    { k: 'jednorozec', n: 'jednorożec', cat: 'zabawki', p: 70, lv: 8, w: 46, h: 60, L: 2, at: 'floor' },
    { k: 'rakieta', n: 'rakieta', cat: 'zabawki', p: 75, lv: 9, w: 40, h: 84, L: 2, at: 'floor' },
    { k: 'kotek', n: 'kotek', cat: 'zabawki', p: 150, lv: 10, w: 64, h: 36, L: 2, at: 'floor' },
    { k: 'piesek', n: 'piesek', cat: 'zabawki', p: 150, lv: 12, w: 58, h: 54, L: 2, at: 'floor' }
  ];
  var WALLS = [
    { k: 'kremowa', n: 'kremowa', p: 0, lv: 1, c: '#fbf1dc' },
    { k: 'paski', n: 'różowe paski', p: 75, lv: 1, c: '#fde2ea', c2: '#f9c9d8' },
    { k: 'kropki', n: 'niebieskie kropki', p: 75, lv: 1, c: '#e3f0fb', c2: '#bcd8f2' },
    { k: 'kwiatki', n: 'kwiatki', p: 100, lv: 3, c: '#fff6e0' },
    { k: 'gwiazdki', n: 'gwiazdki', p: 100, lv: 4, c: '#34478a', c2: '#ffe28a' },
    { k: 'chmurki', n: 'chmurki', p: 125, lv: 6, c: '#bfe3fa' },
    { k: 'serduszka', n: 'serduszka', p: 125, lv: 8, c: '#fde7f0', c2: '#f7a8c4' },
    { k: 'kosmos', n: 'kosmos', p: 150, lv: 10, c: '#1f2556' },
    { k: 'tecza', n: 'tęczowe pasy', p: 150, lv: 12, c: '#fde2e2' }
  ];
  var FLOORS = [
    { k: 'deski', n: 'deski', p: 0, lv: 1, c: '#c98f5a', c2: '#a8703f' },
    { k: 'jasne', n: 'jasne deski', p: 75, lv: 1, c: '#ecd0a2', c2: '#c9a674' },
    { k: 'kafelki', n: 'kafelki', p: 75, lv: 2, c: '#f6f6f2', c2: '#9cc3e6' },
    { k: 'wykladzina', n: 'miękka wykładzina', p: 100, lv: 3, c: '#8fb0e6', c2: '#7a9bd6' },
    { k: 'parkiet', n: 'parkiet', p: 100, lv: 5, c: '#c08048', c2: '#9a6338' },
    { k: 'trawka', n: 'zielona trawka', p: 125, lv: 7, c: '#94d27c', c2: '#6db55a' },
    { k: 'chmurkip', n: 'chmurki', p: 150, lv: 10, c: '#d6ecff', c2: '#ffffff' }
  ];
  var ROOMS = [
    { k: 'r1', n: 'Mój pokój' },
    { k: 'r2', n: 'Pokój zabaw' }
  ];
  var IB = {}, WB = {}, FB = {};
  ITEMS.forEach(function (i) { IB[i.k] = i; });
  WALLS.forEach(function (i) { WB[i.k] = i; });
  FLOORS.forEach(function (i) { FB[i.k] = i; });

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function seeded(n) { var s = n; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

  // ---------- drawing helpers (local units, base centre 0,0, up is -y) ----------
  var G, U = 2;
  function P(fn, fill, ns) {
    G.beginPath(); fn();
    if (fill) { G.fillStyle = fill; G.fill(); }
    if (!ns) { G.lineWidth = U; G.strokeStyle = INK; G.stroke(); }
  }
  function rrp(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    G.moveTo(x + r, y); G.arcTo(x + w, y, x + w, y + h, r); G.arcTo(x + w, y + h, x, y + h, r);
    G.arcTo(x, y + h, x, y, r); G.arcTo(x, y, x + w, y, r); G.closePath();
  }
  function rect(x, y, w, h, fill, ns) { P(function () { G.rect(x, y, w, h); }, fill, ns); }
  function rr(x, y, w, h, r, fill, ns) { P(function () { rrp(x, y, w, h, r); }, fill, ns); }
  function circ(x, y, r, fill, ns) { P(function () { G.arc(x, y, r, 0, Math.PI * 2); }, fill, ns); }
  function ell(x, y, rx, ry, rot, fill, ns) { P(function () { G.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); }, fill, ns); }
  function dot(x, y, r, fill) { G.beginPath(); G.arc(x, y, r, 0, Math.PI * 2); G.fillStyle = fill; G.fill(); }
  function poly(pts, fill, ns) { P(function () { G.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) G.lineTo(pts[i], pts[i + 1]); G.closePath(); }, fill, ns); }
  function ln(pts, w, col) {
    G.beginPath(); G.moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) G.lineTo(pts[i], pts[i + 1]);
    G.lineWidth = w || U; G.strokeStyle = col || INK; G.stroke();
  }
  // a thick coloured line with an ink outline
  function bar(pts, w, col) { ln(pts, w + U * 2, INK); ln(pts, w, col); }
  function heart(x, y, s, fill, ns) {
    P(function () { G.moveTo(x, y + s); G.bezierCurveTo(x - s * 1.8, y - s * 0.2, x - s, y - s * 1.8, x, y - s * 0.8); G.bezierCurveTo(x + s, y - s * 1.8, x + s * 1.8, y - s * 0.2, x, y + s); }, fill, ns);
  }
  function star(x, y, r, fill, ns) {
    P(function () {
      for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.45 : r; if (i) G.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); else G.moveTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
      G.closePath();
    }, fill, ns);
  }
  function shine(x, y, rx, ry, rot) { G.fillStyle = 'rgba(255,255,255,.45)'; G.beginPath(); G.ellipse(x, y, rx, ry, rot || 0, 0, 7); G.fill(); }
  function glow(x, y, r, a) {
    var gr = G.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,226,130,' + a + ')'); gr.addColorStop(1, 'rgba(255,226,130,0)');
    G.fillStyle = gr; G.beginPath(); G.arc(x, y, r, 0, 7); G.fill();
  }
  // text that stays readable when the item is flipped
  function txt(s, x, y, size, col, o) {
    G.save(); if (o && o.f) G.scale(-1, 1);
    G.font = size + 'px ' + FONT; G.fillStyle = col; G.textAlign = 'center'; G.textBaseline = 'middle';
    G.fillText(s, o && o.f ? -x : x, y); G.restore();
  }
  function eyes(x1, x2, y, r) { dot(x1, y, r, INK); dot(x2, y, r, INK); dot(x1 + r * 0.3, y - r * 0.35, r * 0.35, '#fff'); dot(x2 + r * 0.3, y - r * 0.35, r * 0.35, '#fff'); }
  function smile(x, y, r) { G.beginPath(); G.arc(x, y - r * 0.6, r, 0.25 * Math.PI, 0.75 * Math.PI); G.lineWidth = U * 0.8; G.strokeStyle = INK; G.stroke(); }
  function cheeks(x1, x2, y, r) { G.fillStyle = 'rgba(240,110,130,.4)'; G.beginPath(); G.ellipse(x1, y, r, r * 0.6, 0, 0, 7); G.ellipse(x2, y, r, r * 0.6, 0, 0, 7); G.fill(); }
  function books(x0, y, seed, maxX) {
    var cols = ['#e2533f', '#3f86d8', '#f2b51d', '#5cbc4b', '#8a5cd0', '#f47fb0'], x = x0, i = 0;
    while (true) {
      var w = 5 + ((seed * 7 + i * 3) % 4), h = 20 + ((seed * 3 + i * 5) % 9);
      if (x + w > maxX) break;
      rect(x, y - h, w, h, cols[(seed + i) % 6]);
      ln([x + 1.5, y - h + 4, x + w - 1.5, y - h + 4], 1, 'rgba(255,255,255,.7)');
      x += w; i++;
    }
  }
  function sky(x, y, w, h, night, t) {
    G.save(); G.beginPath(); G.rect(x, y, w, h); G.clip();
    var gr = G.createLinearGradient(0, y, 0, y + h);
    if (night) { gr.addColorStop(0, '#1d2a66'); gr.addColorStop(1, '#3a4f9a'); } else { gr.addColorStop(0, '#8fd0f6'); gr.addColorStop(1, '#d4effc'); }
    G.fillStyle = gr; G.fillRect(x, y, w, h);
    if (night) {
      dot(x + w * 0.7, y + h * 0.28, w * 0.13, '#fff5c4');
      dot(x + w * 0.75, y + h * 0.24, w * 0.11, '#2a3a80');
      [[0.2, 0.2], [0.4, 0.5], [0.15, 0.7], [0.55, 0.15], [0.85, 0.6], [0.35, 0.85]].forEach(function (p, i) { dot(x + w * p[0], y + h * p[1], 1.4 + (i % 2), 'rgba(255,255,255,' + (0.6 + 0.4 * Math.sin(t * 2 + i)) + ')'); });
    } else {
      dot(x + w * 0.75, y + h * 0.25, w * 0.12, '#ffd84a');
      var cx = x + ((t * 3) % (w + 40)) - 20;
      G.fillStyle = '#fff'; G.beginPath(); G.arc(cx, y + h * 0.55, 7, 0, 7); G.arc(cx + 8, y + h * 0.5, 9, 0, 7); G.arc(cx + 17, y + h * 0.56, 6, 0, 7); G.fill();
      G.fillStyle = '#7cc66a'; G.beginPath(); G.ellipse(x + w * 0.3, y + h + 4, w * 0.5, h * 0.18, 0, 0, 7); G.fill();
    }
    G.restore();
  }
  function isNight() { var h = new Date().getHours(); return h >= 20 || h < 7; }

  // ---------- items ----------
  var DRAW = {
    lozko: function () {
      var wd = '#c98f5a';
      rect(-72, -14, 5, 14, wd); rect(67, -14, 5, 14, wd);
      rr(-75, -84, 17, 84, 7, wd); heart(-66.5, -68, 4.5, '#f47fb0');
      rr(60, -54, 15, 54, 6, wd);
      rect(-60, -30, 121, 16, wd);
      rr(-60, -44, 121, 16, 6, '#fff');
      ell(-40, -50, 16, 8, -0.08, '#fff');
      P(function () { G.moveTo(-14, -47); G.lineTo(62, -47); G.quadraticCurveTo(67, -38, 62, -24); G.lineTo(-14, -24); G.quadraticCurveTo(-18, -36, -14, -47); }, '#f7a8c4');
      rect(-14, -47, 12, 23, '#fbc7da');
      [[10, -40], [26, -33], [42, -40], [52, -31], [18, -29]].forEach(function (p) { heart(p[0], p[1], 2.4, '#fff', true); });
    },
    biurko: function () {
      var wd = '#e0b07a', lt = '#ecc89a';
      rect(-52, -62, 40, 62, wd);
      for (var i = 0; i < 3; i++) { rr(-48, -58 + i * 19, 32, 15, 2, lt); circ(-32, -50.5 + i * 19, 2.2, '#fff'); }
      rect(44, -62, 7, 62, wd);
      rr(-56, -70, 112, 9, 3, '#c98f5a');
    },
    krzeslo: function () {
      var c = '#7cc3a5';
      rect(-18, -38, 5, 38, c); rect(13, -38, 5, 38, c);
      rr(-22, -78, 11, 42, 4, c);
      rr(-19, -72, 6, 22, 3, '#a8dcc6', true);
      rr(-22, -42, 44, 8, 3, c);
    },
    komoda: function () {
      rect(-36, -6, 5, 6, '#9a6338'); rect(31, -6, 5, 6, '#9a6338');
      rr(-40, -58, 80, 52, 4, '#9fd3f2');
      for (var i = 0; i < 3; i++) { rr(-35, -53 + i * 15.5, 70, 12.5, 3, '#c8e7fa'); circ(0, -46.7 + i * 15.5, 2.3, '#fff'); }
    },
    stolik: function () {
      rr(-15, -5, 30, 5, 2, '#fff');
      rect(-3, -36, 6, 32, '#fff');
      rr(-30, -40, 60, 6, 3, '#f2b51d');
    },
    polka: function () {
      poly([-30, -10, -30, 0, -20, -10], '#9a6338');
      poly([30, -10, 30, 0, 20, -10], '#9a6338');
      rr(-40, -16, 80, 6, 2, '#c98f5a');
    },
    pufa: function () {
      P(function () { G.moveTo(-33, 0); G.bezierCurveTo(-38, -30, -16, -54, 4, -50); G.bezierCurveTo(28, -46, 38, -22, 33, 0); G.closePath(); }, '#f47fb0');
      G.beginPath(); G.moveTo(-14, -4); G.quadraticCurveTo(-4, -28, 12, -44); G.lineWidth = U * 0.8; G.strokeStyle = 'rgba(29,47,111,.35)'; G.stroke();
      shine(-14, -32, 7, 4, -0.7);
    },
    regal: function () {
      var wd = '#b97a45';
      rect(-35, -130, 70, 130, wd);
      rect(-30, -125, 60, 120, '#8a5530');
      [-92, -59, -26].forEach(function (y) { rect(-30, y, 60, 5, wd); });
      books(-29, -92, 1, 18); books(-29, -59, 4, 29); books(-10, -26, 2, 29);
      circ(23, -98, 6, '#f2f2f2'); P(function () { G.moveTo(20, -103); G.quadraticCurveTo(16, -114, 24, -116); G.quadraticCurveTo(26, -108, 23, -103); }, '#5cc46a');
      rr(-28, -40, 14, 14, 3, '#f2b51d'); circ(-21, -33, 3, '#e2533f');
    },
    skrzynia: function () {
      rr(-35, -40, 70, 40, 5, '#f2b51d');
      rr(-37, -48, 74, 11, 4, '#e2533f');
      star(-14, -21, 8, '#fff'); star(15, -19, 6, '#fff'); heart(1, -24, 3, '#f47fb0');
    },
    fotel: function () {
      var c = '#6fa8dc', d = '#5a92c8';
      rect(-30, -8, 5, 8, '#9a6338'); rect(25, -8, 5, 8, '#9a6338');
      rr(-28, -80, 56, 52, 16, c);
      rr(-36, -40, 72, 32, 8, d);
      rr(-30, -46, 60, 12, 6, c);
      rr(-42, -56, 15, 48, 7, c); rr(27, -56, 15, 48, 7, c);
      shine(-12, -66, 8, 4, -0.3);
    },
    szafa: function () {
      var c = '#f3dcc0';
      rect(-42, -6, 6, 6, '#9a6338'); rect(36, -6, 6, 6, '#9a6338');
      rr(-44, -144, 88, 138, 4, c);
      rr(-48, -150, 96, 9, 3, '#e6c49c');
      ln([0, -141, 0, -9]);
      G.lineWidth = U * 0.7; G.strokeStyle = 'rgba(29,47,111,.3)';
      G.beginPath(); rrp(-37, -132, 31, 116, 4); G.stroke(); G.beginPath(); rrp(6, -132, 31, 116, 4); G.stroke();
      circ(-5, -76, 2.6, '#e3a008'); circ(5, -76, 2.6, '#e3a008');
      heart(-21.5, -116, 4.5, '#f7a8c4'); heart(21.5, -116, 4.5, '#f7a8c4');
    },
    pietrowe: function () {
      var wd = '#9fd3f2';
      rect(-75, -150, 9, 150, wd); rect(66, -150, 9, 150, wd);
      rect(-66, -26, 132, 12, wd); rr(-66, -38, 132, 12, 5, '#fff');
      ell(-48, -42, 14, 6, 0, '#fff'); rr(-22, -41, 88, 15, 5, '#f7a8c4');
      rect(-66, -100, 132, 12, wd); rr(-66, -112, 132, 12, 5, '#fff');
      ell(-48, -116, 14, 6, 0, '#fff'); rr(-22, -115, 88, 15, 5, '#8fb8ef');
      star(10, -107, 3, '#fff', true); star(36, -109, 3, '#fff', true); heart(10, -34, 2.5, '#fff', true); heart(36, -33, 2.5, '#fff', true);
      rect(-66, -134, 104, 6, wd);
      for (var x = -58; x < 36; x += 16) rect(x, -128, 3, 16, wd);
      rect(44, -112, 4, 112, wd); rect(58, -112, 4, 112, wd);
      for (var y = -94; y < 0; y += 22) rect(44, y, 18, 3.5, wd);
    },

    dywan: function () {
      G.lineWidth = 1.6; G.strokeStyle = INK;
      for (var i = -1; i <= 1; i += 2) for (var j = -2; j <= 2; j++) { G.beginPath(); G.moveTo(i * 69, -8 + j * 2.2); G.lineTo(i * 74, -8 + j * 2.6); G.stroke(); }
      ell(0, -8, 70, 8, 0, '#e2533f');
      ell(0, -8, 54, 5.8, 0, '#f7c25a');
      ell(0, -8, 34, 3.6, 0, '#e2533f');
      ell(0, -8, 14, 1.6, 0, '#fff', true);
    },
    kwiatek: function () {
      ln([0, -18, 0, -34], 2.5, '#3fae5f');
      ell(-6, -25, 6, 2.8, -0.5, '#5cc46a'); ell(6, -28, 6, 2.8, 0.5, '#5cc46a');
      for (var i = 0; i < 5; i++) { var a = i * Math.PI * 2 / 5 - Math.PI / 2; circ(Math.cos(a) * 5, -38 + Math.sin(a) * 5, 4.4, '#f47fb0'); }
      circ(0, -38, 3.4, '#ffd36e');
      poly([-11, -18, 11, -18, 8, 0, -8, 0], '#d9824a');
      rr(-13, -21, 26, 5, 2, '#e8955a');
    },
    plakat: function () {
      rr(-25, -66, 50, 66, 3, '#fff');
      var cols = ['#e2533f', '#f6982a', '#f2d23a', '#5cbc4b', '#3f86d8', '#8a5cd0'];
      for (var i = 0; i < 6; i++) { G.beginPath(); G.arc(0, -22, 19 - i * 3, Math.PI, 0); G.lineWidth = 3.2; G.strokeStyle = cols[i]; G.stroke(); }
      [-17, 17].forEach(function (x) { G.fillStyle = '#fff'; G.beginPath(); G.arc(x - 4, -21, 5, 0, 7); G.arc(x + 3, -22, 6, 0, 7); G.fill(); });
      G.fillStyle = 'rgba(242,181,29,.55)'; G.fillRect(-28, -68, 12, 5); G.fillRect(16, -68, 12, 5);
      txt('hej!', 0, -52, 11, INK);
    },
    zegar: function (t, o) {
      G.save(); if (o.f) G.scale(-1, 1);
      circ(0, -20, 19, '#e2533f'); circ(0, -20, 15, '#fff');
      for (var i = 0; i < 12; i++) { var a = i * Math.PI / 6; dot(Math.cos(a) * 12, -20 + Math.sin(a) * 12, i % 3 ? 0.9 : 1.6, INK); }
      var d = new Date(), m = d.getMinutes() + d.getSeconds() / 60, h = (d.getHours() % 12) + m / 60;
      G.lineCap = 'round';
      var ha = h / 12 * Math.PI * 2 - Math.PI / 2, ma = m / 60 * Math.PI * 2 - Math.PI / 2, sa = d.getSeconds() / 60 * Math.PI * 2 - Math.PI / 2;
      ln([0, -20, Math.cos(ha) * 7, -20 + Math.sin(ha) * 7], 2.6, INK);
      ln([0, -20, Math.cos(ma) * 10.5, -20 + Math.sin(ma) * 10.5], 1.8, INK);
      ln([0, -20, Math.cos(sa) * 11, -20 + Math.sin(sa) * 11], 0.9, '#e2533f');
      dot(0, -20, 1.8, INK);
      G.restore();
    },
    okno: function (t) {
      var night = isNight();
      ln([-60, -113, 60, -113], 3, '#9a6338'); dot(-61, -113, 3, '#9a6338'); dot(61, -113, 3, '#9a6338');
      rr(-50, -108, 100, 98, 4, '#fff');
      sky(-44, -102, 88, 86, night, t);
      G.lineWidth = U; G.strokeStyle = INK; G.strokeRect(-44, -102, 88, 86);
      rect(-2.5, -102, 5, 86, '#fff'); rect(-44, -61, 88, 5, '#fff');
      rr(-56, -12, 112, 10, 3, '#fff');
      [-1, 1].forEach(function (sd) {
        G.save(); G.scale(sd, 1);
        P(function () { G.moveTo(-61, -112); G.lineTo(-36, -112); G.quadraticCurveTo(-38, -76, -46, -56); G.quadraticCurveTo(-38, -34, -42, -14); G.lineTo(-61, -14); G.closePath(); }, '#f7a8c4');
        G.lineWidth = U * 0.7; G.strokeStyle = 'rgba(29,47,111,.3)';
        G.beginPath(); G.moveTo(-54, -110); G.quadraticCurveTo(-52, -80, -54, -58); G.moveTo(-46, -110); G.quadraticCurveTo(-44, -84, -50, -60); G.stroke();
        rr(-60, -60, 18, 6, 3, '#e3a008');
        G.restore();
      });
    },
    lampka: function () {
      glow(0, -34, 34, 0.45);
      rr(-10, -6, 20, 6, 3, '#f47fb0');
      rect(-2, -24, 4, 18, '#f47fb0');
      poly([-13, -24, -7, -43, 7, -43, 13, -24], '#ffe7a3');
    },
    kaktus: function () {
      rr(-15, -32, 8, 14, 4, '#4fae4a'); rr(7, -36, 8, 14, 4, '#4fae4a');
      rr(-7, -40, 14, 28, 7, '#5cbc4b');
      [[-2, -32], [2, -24], [-3, -19], [3, -35]].forEach(function (p) { dot(p[0], p[1], 0.9, '#fff'); });
      circ(0, -41, 3.2, '#f47fb0');
      poly([-11, -14, 11, -14, 8, 0, -8, 0], '#e8955a');
    },
    plakatkot: function () {
      rr(-25, -66, 50, 66, 3, '#ffe1ec');
      poly([-12, -44, -9, -55, -3, -46], '#f6b26b'); poly([12, -44, 9, -55, 3, -46], '#f6b26b');
      circ(0, -36, 13, '#f6b26b');
      eyes(-5, 5, -38, 1.8); poly([-1.5, -33.5, 1.5, -33.5, 0, -31.5], '#f47fb0', true);
      G.lineWidth = 0.9; G.strokeStyle = INK;
      [[-6, -32, -16, -34], [-6, -30, -16, -28], [6, -32, 16, -34], [6, -30, 16, -28]].forEach(function (l) { G.beginPath(); G.moveTo(l[0], l[1]); G.lineTo(l[2], l[3]); G.stroke(); });
      cheeks(-8, 8, -31, 2.2);
      heart(-14, -12, 3, '#f47fb0', true); heart(0, -10, 3, '#f47fb0', true); heart(14, -12, 3, '#f47fb0', true);
      G.fillStyle = 'rgba(242,181,29,.55)'; G.fillRect(-28, -68, 12, 5); G.fillRect(16, -68, 12, 5);
    },
    obrazek: function () {
      rr(-28, -44, 56, 44, 3, '#c98f5a');
      G.save(); G.beginPath(); G.rect(-22, -38, 44, 32); G.clip();
      G.fillStyle = '#bfe3fa'; G.fillRect(-22, -38, 44, 32);
      dot(12, -30, 5, '#ffd84a');
      G.fillStyle = '#7cc66a'; G.beginPath(); G.ellipse(-10, -4, 22, 12, 0, 0, 7); G.fill();
      G.fillStyle = '#5cae58'; G.beginPath(); G.ellipse(14, -2, 18, 9, 0, 0, 7); G.fill();
      G.restore();
      G.lineWidth = U; G.strokeStyle = INK; G.strokeRect(-22, -38, 44, 32);
    },
    lampki: function (t) {
      var cols = ['#ff6b6b', '#ffd36e', '#6fd3a0', '#6fb7ff', '#d38bff'], k = 0;
      function q(p0, c, p1, s) { var a = 1 - s; return [a * a * p0[0] + 2 * a * s * c[0] + s * s * p1[0], a * a * p0[1] + 2 * a * s * c[1] + s * s * p1[1]]; }
      [[[-80, -32], [-40, 2], [0, -32]], [[0, -32], [40, 2], [80, -32]]].forEach(function (sw) {
        G.beginPath(); G.moveTo(sw[0][0], sw[0][1]); G.quadraticCurveTo(sw[1][0], sw[1][1], sw[2][0], sw[2][1]); G.lineWidth = 1.4; G.strokeStyle = '#2f6b4f'; G.stroke();
        for (var i = 0; i < 6; i++) {
          var p = q(sw[0], sw[1], sw[2], (i + 0.5) / 6), a = REDUCED ? 1 : 0.55 + 0.45 * Math.sin(t * 3 + k * 1.7), c = cols[k % 5];
          G.save(); G.globalAlpha = a * 0.5; dot(p[0], p[1] + 6, 8, c); G.restore();
          ell(p[0], p[1] + 5, 3.2, 4.6, 0, c);
          k++;
        }
      });
      dot(-80, -32, 2, INK); dot(0, -32, 2, INK); dot(80, -32, 2, INK);
    },
    lampa: function () {
      glow(0, -108, 58, 0.4);
      ell(0, -3, 16, 4, 0, '#5a6690');
      rect(-2, -102, 4, 99, '#5a6690');
      poly([-20, -100, -12, -130, 12, -130, 20, -100], '#9fd3f2');
    },
    choragiewki: function () {
      var cols = ['#e2533f', '#f2b51d', '#5cbc4b', '#3f86d8', '#8a5cd0', '#f47fb0'];
      function y(x) { var s = (x + 80) / 160; return -30 + 22 * 4 * s * (1 - s); }
      ln([-80, -30, -60, y(-60), -40, y(-40), -20, y(-20), 0, y(0), 20, y(20), 40, y(40), 60, y(60), 80, -30], 1.4, INK);
      for (var i = 0; i < 8; i++) { var x = -70 + i * 20, yy = y(x); poly([x - 8, yy, x + 8, yy, x, yy + 15], cols[i % 6]); }
      dot(-80, -30, 2, INK); dot(80, -30, 2, INK);
    },
    lustro: function () {
      ell(0, -35, 21, 34, 0, '#e3a008');
      ell(0, -35, 15.5, 28.5, 0, '#d8eefb');
      G.lineWidth = 3; G.strokeStyle = 'rgba(255,255,255,.85)'; G.lineCap = 'round';
      G.beginPath(); G.moveTo(-7, -48); G.lineTo(3, -58); G.moveTo(-7, -38); G.lineTo(6, -51); G.stroke();
      heart(0, -72, 4, '#f47fb0');
    },
    teczowy: function () {
      var cols = ['#e2533f', '#f6982a', '#f2d23a', '#5cbc4b', '#3f86d8', '#8a5cd0'];
      for (var i = 0; i < 6; i++) ell(0, -9, 60 - i * 9.5, 9 - i * 1.4, 0, cols[i], i > 0);
      ell(0, -9, 60, 9, 0, null);
    },
    kula: function (t, o) {
      rr(-12, -4, 24, 4, 2, '#5a6690');
      G.save(); G.beginPath(); G.arc(0, -22, 19, 0, 7); G.clip();
      G.fillStyle = 'rgba(214,238,252,.7)'; G.fillRect(-20, -42, 40, 40);
      G.fillStyle = '#7ccaf0'; G.fillRect(-20, -32, 40, 30);
      G.fillStyle = '#f2dca0'; G.beginPath(); G.ellipse(0, -4, 18, 5, 0, 0, 7); G.fill();
      var ph = t * 0.9 + (o.id || 0), fx = Math.sin(ph) * 8, dir = Math.cos(ph) >= 0 ? 1 : -1;
      G.save(); G.translate(fx, -18 + Math.sin(ph * 2.3) * 2); G.scale(dir, 1);
      poly([-5, 0, -10, -4, -10, 4], '#f6982a'); ell(0, 0, 6, 4, 0, '#f6982a'); dot(3, -1, 1, INK);
      G.restore();
      var by = -6 - ((t * 10 + (o.id || 0) * 7) % 26);
      G.beginPath(); G.arc(fx * 0.5 + 4, by, 1.5, 0, 7); G.lineWidth = 0.8; G.strokeStyle = '#fff'; G.stroke();
      G.restore();
      P(function () { G.arc(0, -22, 19, -Math.PI * 0.32, Math.PI * 1.32); }, null);
      ell(0, -38, 11, 2.6, 0, 'rgba(255,255,255,.6)');
      shine(-9, -28, 3, 6, 0.4);
    },
    wiszaca: function (t, o) {
      ln([0, -40, 0, -40 - Math.max(4, o.up - 40)], 1.6, INK);
      glow(0, -14, 44, 0.4);
      P(function () { G.moveTo(-24, -14); G.quadraticCurveTo(-22, -40, 0, -40); G.quadraticCurveTo(22, -40, 24, -14); G.closePath(); }, '#f2b51d');
      circ(0, -12, 5.5, '#fff6c8');
      shine(-9, -28, 4, 7, 0.5);
    },
    roslina: function () {
      [[-18, -88, -0.7], [17, -94, 0.6], [-3, -112, 0.05], [-22, -60, -1.1], [23, -64, 1.1]].forEach(function (l) {
        ln([0, -34, l[0] * 0.6, l[1] * 0.75, l[0], l[1]], 2.2, '#3f8a4a');
      });
      [[-22, -60, -1.1], [23, -64, 1.1], [-18, -88, -0.7], [17, -94, 0.6], [-3, -112, 0.05]].forEach(function (l) {
        ell(l[0], l[1], 17, 10, l[2], '#3fae5f');
        G.save(); G.translate(l[0], l[1]); G.rotate(l[2]);
        G.lineWidth = 1; G.strokeStyle = 'rgba(255,255,255,.55)'; G.beginPath(); G.moveTo(-14, 0); G.lineTo(14, 0); G.moveTo(-4, 0); G.lineTo(-8, -7); G.moveTo(4, 0); G.lineTo(8, 7); G.stroke();
        G.restore();
      });
      poly([-18, -34, 18, -34, 14, 0, -14, 0], '#f4f4f4');
      rect(-17, -24, 34, 5, '#3f86d8', true);
    },
    plakatrak: function () {
      rr(-25, -66, 50, 66, 3, '#2c3e7a');
      [[-16, -58], [14, -54], [-12, -18], [16, -22], [-18, -38], [8, -10]].forEach(function (p) { star(p[0], p[1], 2.4, '#ffe28a', true); });
      G.save(); G.translate(0, -34); G.rotate(0.5);
      poly([-6, 10, -11, 18, -6, 16], '#e2533f'); poly([6, 10, 11, 18, 6, 16], '#e2533f');
      P(function () { G.moveTo(-6, 16); G.lineTo(-6, -6); G.quadraticCurveTo(0, -20, 6, -6); G.lineTo(6, 16); G.closePath(); }, '#fff');
      circ(0, -2, 3, '#6fb7ff');
      poly([-4, 16, 4, 16, 0, 24], '#f6982a');
      G.restore();
      G.fillStyle = 'rgba(242,181,29,.55)'; G.fillRect(-28, -68, 12, 5); G.fillRect(16, -68, 12, 5);
    },
    globus: function () {
      ell(0, -3, 12, 3.5, 0, '#c98f5a');
      rect(-2, -14, 4, 11, '#c98f5a');
      G.save(); G.beginPath(); G.arc(0, -32, 14, 0, 7); G.clip();
      G.fillStyle = '#6fb7ff'; G.fillRect(-15, -47, 30, 30);
      G.fillStyle = '#7cc66a';
      G.beginPath(); G.ellipse(-5, -38, 7, 5, 0.4, 0, 7); G.ellipse(6, -26, 6, 7, -0.3, 0, 7); G.ellipse(10, -40, 3, 2, 0, 0, 7); G.fill();
      G.restore();
      circ(0, -32, 14, null);
      G.beginPath(); G.arc(0, -32, 18, Math.PI * 0.55, Math.PI * 1.45); G.lineWidth = 2.6; G.strokeStyle = '#e3a008'; G.stroke();
      shine(-6, -38, 3, 5, 0.5);
    },
    tablica: function (t, o) {
      rr(-40, -64, 80, 56, 4, '#c98f5a');
      rect(-35, -59, 70, 46, '#2f6b4f');
      txt('2+2=4', -12, -48, 11, '#fff', o);
      G.lineWidth = 1.3; G.strokeStyle = 'rgba(255,255,255,.9)';
      var s = o.f ? -1 : 1;
      G.beginPath(); G.arc(18 * s, -40, 7, 0, 7); G.moveTo(15 * s, -38); G.arc(18 * s, -39, 3, 0.8, 2.3); G.stroke();
      G.beginPath(); G.moveTo(-26 * s, -18); G.lineTo(-26 * s, -28); G.lineTo(-20 * s, -34); G.lineTo(-14 * s, -28); G.lineTo(-14 * s, -18); G.closePath(); G.stroke();
      star(4 * s, -24, 5, null, true); G.stroke();
      rr(-36, -11, 72, 5, 2, '#c98f5a');
      rect(-24, -13, 8, 2.5, '#fff', true); rect(18, -13, 6, 2.5, '#f7a8c4', true);
    },
    ksiezyc: function (t) {
      glow(-2, -20, 30, REDUCED ? 0.4 : 0.32 + 0.12 * Math.sin(t * 1.5));
      P(function () { G.arc(0, -20, 17, -Math.PI / 2, Math.PI / 2, true); G.arc(7, -20, 18.38, 1.96, 4.32, false); G.closePath(); }, '#ffe28a');
      G.beginPath(); G.arc(-9, -24, 2.2, 0.1 * Math.PI, 0.9 * Math.PI); G.lineWidth = U * 0.8; G.strokeStyle = INK; G.stroke();
      G.fillStyle = 'rgba(240,110,130,.45)'; G.beginPath(); G.ellipse(-8, -17, 2.4, 1.5, 0, 0, 7); G.fill();
      star(12, -34, 3, '#ffe28a'); star(14, -8, 2.2, '#ffe28a');
    },
    tecza: function () {
      var cols = ['#e2533f', '#f6982a', '#f2d23a', '#5cbc4b', '#3f86d8', '#8a5cd0'];
      for (var i = 0; i < 6; i++) { G.beginPath(); G.arc(0, -6, 44 - i * 4.6, Math.PI, 0); G.lineWidth = 4.8; G.strokeStyle = cols[i]; G.stroke(); }
      [-38, 38].forEach(function (x) {
        P(function () { G.moveTo(x - 12, -2); G.arc(x - 6, -6, 6, Math.PI * 0.6, Math.PI * 1.6); G.arc(x + 2, -11, 8, Math.PI * 1.1, Math.PI * 1.9); G.arc(x + 9, -5, 5.5, Math.PI * 1.5, Math.PI * 0.45); G.closePath(); }, '#fff');
      });
    },

    mis: function () {
      var c = '#c98f5a', l = '#ecc89a';
      ell(-10, -5, 7.5, 5, 0, c); ell(10, -5, 7.5, 5, 0, c); ell(-10, -5, 3.5, 2.6, 0, l, true); ell(10, -5, 3.5, 2.6, 0, l, true);
      ell(-14, -18, 5, 8, 0.4, c); ell(14, -18, 5, 8, -0.4, c);
      ell(0, -16, 13, 13, 0, c); ell(0, -14, 7.5, 7.5, 0, l, true);
      circ(-9, -42, 5, c); circ(9, -42, 5, c); dot(-9, -42, 2.4, l); dot(9, -42, 2.4, l);
      circ(0, -33, 11, c);
      ell(0, -29.5, 5.5, 4, 0, l); dot(0, -31, 1.8, INK); eyes(-4, 4, -35.5, 1.6); cheeks(-6.5, 6.5, -30, 1.8);
      poly([0, -23, -6, -26, -6, -20], '#f47fb0'); poly([0, -23, 6, -26, 6, -20], '#f47fb0');
    },
    pilka: function () {
      var cols = ['#e2533f', '#fff', '#3f86d8', '#fff', '#f2d23a', '#fff'];
      G.save(); G.beginPath(); G.arc(0, -15, 15, 0, 7); G.clip();
      for (var i = 0; i < 6; i++) { G.beginPath(); G.moveTo(0, -15); G.arc(0, -15, 16, i * Math.PI / 3 - 0.4, (i + 1) * Math.PI / 3 - 0.4); G.closePath(); G.fillStyle = cols[i]; G.fill(); }
      G.restore();
      circ(0, -15, 15, null); circ(0, -15, 3.5, '#fff');
      shine(-6, -21, 4, 2.5, -0.6);
    },
    klocki: function (t, o) {
      rr(-24, -16, 22, 16, 2, '#e2533f'); txt('A', -13, -7.5, 13, '#fff', o);
      rr(2, -16, 22, 16, 2, '#3f86d8'); txt('B', 13, -7.5, 13, '#fff', o);
      rr(-10, -33, 22, 17, 2, '#f2b51d'); txt('C', 1, -24, 13, '#fff', o);
    },
    lalka: function () {
      var sk = '#ffd9b8', hr = '#f2b51d';
      bar([-4, -14, -4, -2], 3, sk); bar([4, -14, 4, -2], 3, sk);
      ell(-5, -1.5, 3.5, 2, 0, '#e2533f'); ell(5, -1.5, 3.5, 2, 0, '#e2533f');
      bar([-6, -31, -11, -20], 2.6, sk); bar([6, -31, 11, -20], 2.6, sk);
      poly([-13, -12, -6, -34, 6, -34, 13, -12], '#8a5cd0');
      dot(-4, -20, 1.4, '#fff'); dot(3, -24, 1.4, '#fff'); dot(5, -16, 1.4, '#fff');
      circ(-10, -42, 4, hr); circ(10, -42, 4, hr);
      ell(0, -43, 10, 11, 0, hr);
      circ(0, -42, 8, sk);
      P(function () { G.moveTo(-8, -43); G.quadraticCurveTo(-6, -52, 0, -51); G.quadraticCurveTo(7, -52, 8, -43); G.quadraticCurveTo(2, -47, -8, -43); }, hr);
      eyes(-3, 3, -41, 1.3); smile(0, -37, 2.5); cheeks(-5, 5, -38.5, 1.6);
    },
    autko: function () {
      P(function () { G.moveTo(-22, -8); G.lineTo(-22, -16); G.lineTo(-12, -17); G.lineTo(-6, -27); G.lineTo(10, -27); G.lineTo(16, -17); G.lineTo(22, -15); G.lineTo(22, -8); G.closePath(); }, '#e2533f');
      poly([-4, -18, -1, -24, 6, -24, 10, -18], '#bfe3fa');
      rect(-18, -14, 6, 3, '#ffe28a', true);
      [-12, 12].forEach(function (x) { circ(x, -7, 6, '#3a3f58'); circ(x, -7, 2.4, '#c3cce0'); });
      shine(-12, -20, 4, 1.5, 0);
    },
    konik: function () {
      P(function () { G.moveTo(-42, -12); G.quadraticCurveTo(0, 10, 42, -12); G.lineTo(40, -18); G.quadraticCurveTo(0, 2, -40, -18); G.closePath(); }, '#c98f5a');
      rect(-24, -34, 6, 22, '#fff'); rect(16, -34, 6, 20, '#fff');
      P(function () { G.moveTo(-26, -40); G.quadraticCurveTo(-40, -42, -40, -24); G.quadraticCurveTo(-34, -34, -26, -34); }, '#f47fb0');
      ell(-2, -40, 27, 12, 0, '#fff');
      P(function () { G.moveTo(14, -46); G.lineTo(24, -62); G.quadraticCurveTo(40, -70, 42, -58); G.lineTo(36, -52); G.lineTo(26, -42); G.closePath(); }, '#fff');
      poly([25, -63, 27, -70, 30, -64], '#fff');
      for (var i = 0; i < 4; i++) circ(16 + i * 2.6, -48 - i * 4.2, 3.4, '#f47fb0');
      rr(-12, -54, 18, 8, 3, '#e2533f');
      dot(33, -61, 1.6, INK); dot(-14, -38, 2, '#bcd8f2'); dot(0, -34, 2, '#bcd8f2'); dot(-6, -44, 1.6, '#bcd8f2');
    },
    namiot: function () {
      ln([-12, -112, 0, -96], 3, '#9a6338'); ln([12, -112, 0, -96], 3, '#9a6338'); ln([0, -114, 0, -96], 3, '#9a6338');
      G.save(); G.beginPath(); G.moveTo(-50, 0); G.lineTo(0, -100); G.lineTo(50, 0); G.closePath(); G.clip();
      G.fillStyle = '#fbe3a6'; G.fillRect(-50, -100, 100, 100);
      G.fillStyle = '#f47fb0'; G.fillRect(-50, -34, 100, 8); G.fillRect(-50, -66, 100, 6);
      G.fillStyle = '#6fb7ff'; G.fillRect(-50, -52, 100, 4);
      G.restore();
      poly([-50, 0, 0, -100, 50, 0], null);
      poly([-18, 0, 0, -58, 18, 0], '#6b4b8a');
      poly([0, -58, -24, 0, -12, 0], '#fff3d0');
      star(0, -80, 5, '#f2b51d');
    },
    domek: function () {
      rect(24, -104, 10, 22, '#c98f5a');
      rr(-48, -72, 96, 72, 2, '#fde2ea');
      rect(-42, -66, 84, 28, '#fff6e0'); rect(-42, -32, 84, 28, '#e3f0fb');
      rect(-38, -48, 22, 7, '#f7a8c4'); ell(-34, -50, 4, 2.5, 0, '#fff');
      rr(14, -60, 18, 14, 2, '#bfe3fa'); ln([23, -60, 23, -46], 1, INK);
      rect(-32, -18, 22, 3, '#c98f5a'); rect(-30, -15, 2.5, 11, '#c98f5a'); rect(-14, -15, 2.5, 11, '#c98f5a');
      circ(-21, -21, 2.5, '#e2533f');
      rr(12, -26, 16, 22, 3, '#f2b51d'); dot(25, -15, 1.4, INK);
      ln([-48, -35, 48, -35], U, INK);
      poly([-56, -70, 0, -110, 56, -70], '#e2533f');
      circ(0, -86, 7, '#bfe3fa');
    },
    pianinko: function () {
      rect(-30, -14, 5, 14, '#c43b2a'); rect(25, -14, 5, 14, '#c43b2a');
      rr(-35, -50, 70, 38, 6, '#e2533f');
      rect(-30, -34, 60, 16, '#fff');
      G.lineWidth = 0.9; G.strokeStyle = INK;
      for (var i = 1; i < 8; i++) { G.beginPath(); G.moveTo(-30 + i * 7.5, -34); G.lineTo(-30 + i * 7.5, -18); G.stroke(); }
      [1, 2, 4, 5, 6].forEach(function (i) { G.fillStyle = INK; G.fillRect(-30 + i * 7.5 - 2.2, -34, 4.4, 9); });
      star(-20, -42, 3.5, '#f2d23a', true); star(0, -43, 3.5, '#fff', true); star(20, -42, 3.5, '#f2d23a', true);
    },
    jednorozec: function () {
      var c = '#fff', l = '#fde2ea', mane = ['#f47fb0', '#b892e0', '#6fb7ff'];
      ell(-10, -5, 7.5, 5, 0, c); ell(10, -5, 7.5, 5, 0, c); ell(-10, -4, 4, 2, 0, l, true); ell(10, -4, 4, 2, 0, l, true);
      ell(-14, -18, 5, 8, 0.4, c); ell(14, -18, 5, 8, -0.4, c);
      ell(0, -16, 13, 13, 0, c);
      // full mane flowing down one side (behind the head), a couple of locks peeking out on the other
      [[-3, -46.5, 4], [-8.5, -45, 4.2], [-12.5, -40.5, 4.2], [-14, -34.5, 4.2], [-13.5, -28.5, 4], [-11.5, -23, 3.6], [11.5, -37.5, 3.4], [12, -31.5, 3.2]].forEach(function (m, j) { circ(m[0], m[1], m[2], mane[j % 3]); });
      // leaf-shaped ears with pink insides
      [-1, 1].forEach(function (k) {
        P(function () { G.moveTo(k * 8.5, -40); G.quadraticCurveTo(k * 10.5, -48, k * 7, -51.5); G.quadraticCurveTo(k * 3.2, -46.5, k * 3.6, -42); G.closePath(); }, c);
        P(function () { G.moveTo(k * 7.6, -42); G.quadraticCurveTo(k * 8.6, -47, k * 6.8, -49); G.quadraticCurveTo(k * 4.8, -46, k * 5, -42.5); G.closePath(); }, l, true);
      });
      // long horse head narrowing into a soft muzzle
      function head() { G.moveTo(0, -44.5); G.bezierCurveTo(7.5, -44.5, 11, -40.5, 11, -34.5); G.bezierCurveTo(11, -29.5, 7.5, -28, 7, -24.5); G.bezierCurveTo(6.6, -19.5, -6.6, -19.5, -7, -24.5); G.bezierCurveTo(-7.5, -28, -11, -29.5, -11, -34.5); G.bezierCurveTo(-11, -40.5, -7.5, -44.5, 0, -44.5); G.closePath(); }
      P(head, c);
      G.save(); G.beginPath(); head(); G.clip(); ell(0, -22.5, 8.5, 5.4, 0, l, true); G.restore();
      P(head, null);
      // forelock under the horn
      circ(-3.2, -43, 3, mane[0]); circ(1, -44, 2.8, mane[1]);
      poly([-3, -43, 0, -59, 3, -43], '#f2d23a');
      G.lineWidth = U * 0.7; G.strokeStyle = INK; G.beginPath();
      G.moveTo(-3.3, -24.8); G.quadraticCurveTo(-2, -24.4, -2.4, -23); G.moveTo(3.3, -24.8); G.quadraticCurveTo(2, -24.4, 2.4, -23); G.stroke();
      eyes(-4, 4, -35, 1.6); cheeks(-7, 7, -30.5, 1.8);
      star(0, -14, 3.5, '#f2d23a', true);
    },
    rakieta: function () {
      poly([-12, -26, -20, -2, -10, -8], '#e2533f'); poly([12, -26, 20, -2, 10, -8], '#e2533f');
      P(function () { G.moveTo(-12, -8); G.lineTo(-12, -54); G.quadraticCurveTo(0, -86, 12, -54); G.lineTo(12, -8); G.closePath(); }, '#fff');
      P(function () { G.moveTo(-10.5, -60); G.quadraticCurveTo(0, -86, 10.5, -60); G.closePath(); }, '#e2533f');
      circ(0, -42, 6, '#6fb7ff'); shine(-2, -44, 2, 1.4, 0);
      rect(-12, -18, 24, 5, '#3f86d8');
      rr(-7, -8, 14, 6, 2, '#5a6690');
    },
    kotek: function (t, o) {
      var b = REDUCED ? 1 : 1 + Math.sin(t * 1.8 + (o.id || 0)) * 0.035, c = '#f6b26b';
      G.save(); G.translate(0, -1); G.scale(1, b);
      // tail: out from behind the rump and round the front of the body, outlined, striped, rounded tip
      function tail() {
        function tp() { G.beginPath(); G.moveTo(-24, -9); G.quadraticCurveTo(-30.5, -4.5, -26.5, 0); G.quadraticCurveTo(-23, 2, -10, 0.8); G.quadraticCurveTo(1, -0.2, 6.5, -3.2); }
        tp(); G.lineWidth = 5 + U * 2; G.strokeStyle = INK; G.stroke();
        tp(); G.lineWidth = 5; G.strokeStyle = c; G.stroke();
        tp(); G.setLineDash([2.6, 5.4]); G.lineDashOffset = -1; G.lineCap = 'butt'; G.strokeStyle = 'rgba(200,120,50,.5)'; G.stroke(); G.setLineDash([]); G.lineCap = 'round';
      }
      tail();
      ell(-4, -13, 24, 13, 0, c);
      G.fillStyle = 'rgba(200,120,50,.5)'; [-14, -6, 2].forEach(function (x) { G.fillRect(x, -25, 3, 8); });
      // the part lying in front of the body again, without the root that hides behind the rump
      G.save(); G.beginPath(); G.rect(-40, -40, 80, 80);
      for (var i = 0; i <= 48; i++) { var th = i / 48 * Math.PI * 2, x = Math.min(-12, -4 + Math.cos(th) * (24 + U / 2)), y = Math.min(-4.2, -13 + Math.sin(th) * (13 + U / 2)); if (i) G.lineTo(x, y); else G.moveTo(x, y); }
      G.clip('evenodd'); tail(); G.restore();
      G.restore();
      poly([10, -21, 12, -30, 17, -23], c); poly([22, -22, 25, -30, 27, -20], c);
      circ(19, -15, 10, c);
      G.lineWidth = U * 0.8; G.strokeStyle = INK;
      G.beginPath(); G.arc(15.5, -16, 2.2, 0.1 * Math.PI, 0.9 * Math.PI); G.moveTo(24.7, -15.3); G.arc(22.5, -16, 2.2, 0.1 * Math.PI, 0.9 * Math.PI); G.stroke();
      dot(19, -12, 1.2, '#f47fb0'); cheeks(14, 25, -12, 1.8);
      if (!REDUCED) {
        var z = ((t * 0.5 + (o.id || 0) * 0.3) % 1);
        G.save(); G.globalAlpha = Math.sin(z * Math.PI); txt('z', 26 + z * 8, -30 - z * 16, 9 + z * 5, MUTED, o); G.restore();
      }
    },
    piesek: function (t, o) {
      var c = '#e8c49a', d = '#a8703f', wag = REDUCED ? 0 : Math.sin(t * 7 + (o.id || 0)) * 0.45;
      G.save(); G.translate(-16, -12); G.rotate(-0.6 + wag);
      P(function () { G.moveTo(0, 0); G.quadraticCurveTo(-6, -8, -4, -16); G.quadraticCurveTo(0, -8, 3, -1); G.closePath(); }, c);
      G.restore();
      ell(-4, -17, 15, 16, 0, c);
      ell(-12, -4, 7, 4.5, 0, c);
      rr(2, -22, 7, 22, 3.5, c); rr(9, -20, 7, 20, 3.5, c);
      ell(-6, -18, 6, 7, 0, '#fff', true);
      circ(8, -37, 12, c);
      ell(17, -33, 7, 5, 0, '#fff'); dot(22, -35, 2.2, INK);
      ell(-1, -36, 4.5, 9, 0.25, d);
      eyes(9, 15, -40, 1.6);
      smile(18, -29, 2.6);
      rr(-2, -27, 16, 4, 2, '#e2533f'); circ(8, -22, 2.4, '#f2b51d');
    }
  };
  function drawItem(g, k, t, o) {
    G = g; g.lineJoin = 'round'; g.lineCap = 'round';
    try { DRAW[k](t, o || {}); } catch (e) { /* a drawing bug must not break the room */ }
  }

  // ---------- wall + floor ----------
  function drawWall(b, B, W, H, u) {
    var i, x, y, R = seeded(7);
    b.fillStyle = B.c; b.fillRect(0, 0, W, H);
    b.save();
    if (B.k === 'kremowa') {
      b.fillStyle = 'rgba(200,160,100,.10)';
      for (x = 0; x < W; x += 26 * u) b.fillRect(x, 0, 2 * u, H);
    } else if (B.k === 'paski') {
      b.fillStyle = B.c2;
      for (x = 0; x < W; x += 30 * u) b.fillRect(x, 0, 14 * u, H);
    } else if (B.k === 'kropki') {
      b.fillStyle = B.c2;
      for (y = 14 * u, i = 0; y < H; y += 26 * u, i++) for (x = (i % 2) * 15 * u + 8 * u; x < W; x += 30 * u) { b.beginPath(); b.arc(x, y, 4.5 * u, 0, 7); b.fill(); }
    } else if (B.k === 'kwiatki') {
      var fc = ['#f7a8c4', '#ffd36e', '#9fd3f2', '#c6a8ee'];
      for (y = 20 * u, i = 0; y < H; y += 40 * u, i++) for (x = (i % 2) * 22 * u + 12 * u, j = 0; x < W; x += 44 * u, j++) {
        b.fillStyle = fc[(i + j) % 4];
        for (var p = 0; p < 5; p++) { var a = p * Math.PI * 2 / 5; b.beginPath(); b.arc(x + Math.cos(a) * 4 * u, y + Math.sin(a) * 4 * u, 3.4 * u, 0, 7); b.fill(); }
        b.fillStyle = '#fff'; b.beginPath(); b.arc(x, y, 2.4 * u, 0, 7); b.fill();
      }
    } else if (B.k === 'gwiazdki') {
      b.fillStyle = B.c2; G = b;
      for (i = 0; i < W * H / (1500 * u * u); i++) { var sx = R() * W, sy = R() * H, sr = (2 + R() * 4) * u; b.save(); b.globalAlpha = 0.5 + R() * 0.5; star(sx, sy, sr, B.c2, true); b.restore(); }
    } else if (B.k === 'chmurki') {
      b.fillStyle = 'rgba(255,255,255,.9)';
      for (y = 30 * u, i = 0; y < H; y += 70 * u, i++) for (x = (i % 2) * 60 * u + 20 * u; x < W + 40 * u; x += 120 * u) {
        b.beginPath(); b.arc(x, y, 12 * u, 0, 7); b.arc(x + 14 * u, y - 6 * u, 15 * u, 0, 7); b.arc(x + 30 * u, y, 11 * u, 0, 7); b.rect(x, y, 30 * u, 11 * u); b.fill();
      }
    } else if (B.k === 'serduszka') {
      G = b;
      for (y = 22 * u, i = 0; y < H; y += 36 * u, i++) for (x = (i % 2) * 18 * u + 10 * u; x < W; x += 36 * u) heart(x, y, 5 * u, B.c2, true);
    } else if (B.k === 'kosmos') {
      for (i = 0; i < W * H / (300 * u * u); i++) { b.fillStyle = 'rgba(255,255,255,' + (0.3 + R() * 0.7) + ')'; b.beginPath(); b.arc(R() * W, R() * H, (0.6 + R() * 1.4) * u, 0, 7); b.fill(); }
      G = b; U = 2;
      [[0.2, 0.25, 16, '#f6982a'], [0.78, 0.18, 11, '#9fd3f2'], [0.6, 0.5, 8, '#f47fb0']].forEach(function (pl, n) {
        var px = pl[0] * W, py = pl[1] * H, r = pl[2] * u;
        circ(px, py, r, pl[3]);
        if (n === 0) { b.beginPath(); b.ellipse(px, py, r * 1.7, r * 0.45, -0.3, 0, 7); b.lineWidth = 2.5 * u; b.strokeStyle = '#ffe28a'; b.stroke(); }
      });
    } else if (B.k === 'tecza') {
      var tc = ['#fde2e2', '#fdebd4', '#fdf6cf', '#e1f4d8', '#dbeafb', '#ebe0fa'], bh = 36 * u;
      for (y = 0, i = 0; y < H; y += bh, i++) { b.fillStyle = tc[i % 6]; b.fillRect(0, y, W, bh); }
    }
    b.restore();
  }
  var j; // shared loop var for kwiatki
  function drawFloor(b, F, top, W, H, u) {
    var i, x, y, h = H - top;
    b.fillStyle = F.c; b.fillRect(0, top, W, h);
    b.save(); b.beginPath(); b.rect(0, top, W, h); b.clip();
    // rows grow towards the front (a little perspective)
    var rows = [], acc = 0, n = 5, tot = 0;
    for (i = 0; i < n; i++) tot += Math.pow(1.25, i);
    for (i = 0; i < n; i++) { var rh = h * Math.pow(1.25, i) / tot; rows.push([top + acc, rh]); acc += rh; }
    function vx(xb, yy) { return W / 2 + (xb - W / 2) * (0.82 + 0.18 * (yy - top) / h); }
    if (F.k === 'deski' || F.k === 'jasne') {
      b.strokeStyle = F.c2; b.lineWidth = 2;
      rows.forEach(function (r, ri) {
        b.beginPath(); b.moveTo(0, r[0]); b.lineTo(W, r[0]); b.stroke();
        for (x = ((ri * 47) % 90) * u; x < W + 90 * u; x += 110 * u) { b.beginPath(); b.moveTo(vx(x, r[0]), r[0]); b.lineTo(vx(x, r[0] + r[1]), r[0] + r[1]); b.stroke(); }
        b.fillStyle = 'rgba(255,255,255,.08)'; b.fillRect(0, r[0] + 2, W, r[1] * 0.3);
      });
    } else if (F.k === 'kafelki') {
      var cw = 44 * u;
      rows.forEach(function (r, ri) {
        for (x = -cw * 2, i = 0; x < W + cw * 2; x += cw, i++) {
          if ((i + ri) % 2) continue;
          b.fillStyle = F.c2; b.beginPath();
          b.moveTo(vx(x, r[0]), r[0]); b.lineTo(vx(x + cw, r[0]), r[0]); b.lineTo(vx(x + cw, r[0] + r[1]), r[0] + r[1]); b.lineTo(vx(x, r[0] + r[1]), r[0] + r[1]); b.closePath(); b.fill();
        }
      });
    } else if (F.k === 'wykladzina') {
      var R = seeded(3);
      for (i = 0; i < W * h / (60 * u * u); i++) { b.fillStyle = i % 2 ? 'rgba(255,255,255,.18)' : 'rgba(40,60,140,.14)'; b.beginPath(); b.arc(R() * W, top + R() * h, (0.8 + R()) * u, 0, 7); b.fill(); }
    } else if (F.k === 'parkiet') {
      b.strokeStyle = F.c2; b.lineWidth = 1.6;
      rows.forEach(function (r, ri) {
        b.beginPath(); b.moveTo(0, r[0]); b.lineTo(W, r[0]); b.stroke();
        var step = 22 * u;
        for (x = -step, i = 0; x < W + step; x += step, i++) {
          b.fillStyle = (i + ri) % 2 ? 'rgba(255,255,255,.10)' : 'rgba(80,40,10,.10)';
          b.beginPath(); b.moveTo(x, r[0] + r[1]); b.lineTo(x + step, r[0]); b.lineTo(x + step * 2, r[0]); b.lineTo(x + step, r[0] + r[1]); b.closePath(); b.fill(); b.stroke();
        }
      });
    } else if (F.k === 'trawka') {
      var R2 = seeded(5);
      b.strokeStyle = F.c2; b.lineWidth = 2 * u; b.lineCap = 'round';
      for (i = 0; i < W * h / (110 * u * u); i++) { x = R2() * W; y = top + 6 * u + R2() * h; var s = (3 + R2() * 4) * u; b.beginPath(); b.moveTo(x - s * 0.6, y - s); b.lineTo(x, y); b.lineTo(x + s * 0.6, y - s); b.stroke(); }
      [['#fff', 0.3], ['#ffd36e', 0.6], ['#f7a8c4', 0.8]].forEach(function (f, n) { for (var m = 0; m < 4; m++) { b.fillStyle = f[0]; b.beginPath(); b.arc(R2() * W, top + 10 * u + R2() * (h - 16 * u), 2.6 * u, 0, 7); b.fill(); } });
    } else if (F.k === 'chmurkip') {
      var R3 = seeded(9);
      b.fillStyle = F.c2;
      for (i = 0; i < W / (60 * u); i++) { x = R3() * W; y = top + 12 * u + R3() * (h - 20 * u); b.beginPath(); b.ellipse(x, y, 20 * u, 6 * u, 0, 0, 7); b.ellipse(x + 12 * u, y - 3 * u, 14 * u, 6 * u, 0, 0, 7); b.fill(); }
    }
    b.restore();
  }
  function drawRoomBg(b, R, W, H, u, floorTop) {
    drawWall(b, WB[R.wall] || WALLS[0], W, floorTop, u);
    drawFloor(b, FB[R.floor] || FLOORS[0], floorTop, W, H, u);
    // soft shade where the wall meets the floor
    var gr = b.createLinearGradient(0, floorTop, 0, floorTop + 16 * u);
    gr.addColorStop(0, 'rgba(29,47,111,.16)'); gr.addColorStop(1, 'rgba(29,47,111,0)');
    b.fillStyle = gr; b.fillRect(0, floorTop, W, 16 * u);
    // skirting board + ceiling strip
    b.fillStyle = '#fffaf0'; b.fillRect(0, floorTop - 9 * u, W, 9 * u);
    b.fillRect(0, 0, W, 6 * u);
    b.strokeStyle = INK; b.lineWidth = 2;
    b.beginPath(); b.moveTo(0, floorTop - 9 * u); b.lineTo(W, floorTop - 9 * u); b.moveTo(0, floorTop); b.lineTo(W, floorTop); b.moveTo(0, 6 * u); b.lineTo(W, 6 * u); b.stroke();
  }

  // ---------- thumbnails ----------
  var thumbs = {};
  function mkCanvas(w, h) {
    var dpr = Math.min(3, window.devicePixelRatio || 1), c = document.createElement('canvas');
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    var g = c.getContext('2d'); g.scale(dpr, dpr);
    return { c: c, g: g };
  }
  function itemThumb(I, size, lock) {
    var key = 'i' + I.k + size + (lock ? 'l' : '');
    if (thumbs[key]) return thumbs[key];
    var m = mkCanvas(size, size), g = m.g;
    var s = size * 0.84 / Math.max(I.w, I.h);
    g.translate(size / 2, size / 2 + I.h * s / 2); g.scale(s, s);
    U = 1.8 / s;
    drawItem(g, I.k, 0.6, { up: 44, id: 1 });
    if (lock) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#c3cce0'; g.fillRect(0, 0, m.c.width, m.c.height); }
    return (thumbs[key] = m.c.toDataURL());
  }
  function surfThumb(kind, B, w, h) {
    var key = kind + B.k + w;
    if (thumbs[key]) return thumbs[key];
    var m = mkCanvas(w, h), u = 0.5;
    if (kind === 'w') drawWall(m.g, B, w, h, u);
    else { m.g.fillStyle = '#fbf1dc'; m.g.fillRect(0, 0, w, h * 0.25); drawFloor(m.g, B, h * 0.25, w, h, u); m.g.fillStyle = '#fffaf0'; m.g.fillRect(0, h * 0.25 - 4, w, 4); }
    return (thumbs[key] = m.c.toDataURL());
  }
  function roomThumb(R, w, h) {
    var m = mkCanvas(w, h), u = w / 360, ft = h * 0.7;
    drawRoomBg(m.g, R, w, h, u, ft);
    R.items.slice().sort(function (a, b) { return IB[a.k].L - IB[b.k].L; }).forEach(function (it) {
      m.g.save(); m.g.translate(it.x * w, it.y * h); if (it.f) m.g.scale(-1, 1); m.g.scale(u, u); U = 1.6 / u;
      drawItem(m.g, it.k, 0.6, { up: it.y * h / u, id: it.id, f: it.f }); m.g.restore();
    });
    return m.c.toDataURL();
  }

  var CSS = [
    '.pk{display:flex;flex-direction:column;font-family:var(--hand);color:#1d2f6f;background:#fbf1dc}',
    '.pk-cv{flex:1;position:relative;min-height:0}',
    '.pk-cv canvas{position:absolute;inset:0}',
    '.pk-bar{flex:none;display:flex;gap:6px;padding:7px 8px calc(7px + env(safe-area-inset-bottom,0px));background:#fff;border-top:3px solid #1d2f6f}',
    '.pk-btn{flex:1;min-width:0;min-height:58px;border:3px solid #1d2f6f;border-radius:16px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-size:1.05rem;line-height:1;box-shadow:0 3px 0 #1d2f6f;padding:3px 2px;position:relative;color:#1d2f6f}',
    '.pk-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #1d2f6f}',
    '.pk-btn svg{width:32px;height:28px;flex:none}',
    '.pk-btn.drop{background:#fff4d6;box-shadow:0 3px 0 #1d2f6f,0 0 0 5px rgba(227,160,8,.5);transform:scale(1.06)}',
    '.pk-btn .badge{position:absolute;top:-8px;right:-4px;min-width:24px;height:24px;border-radius:12px;background:#e3a008;color:#2a1d00;border:2px solid #1d2f6f;font-size:.95rem;line-height:20px;padding:0 4px}',
    '.pk-btn .badge.bump{animation:pkbump .4s ease}',
    '@keyframes pkbump{40%{transform:scale(1.5)}}',
    '.pk-banner{position:absolute;left:50%;top:14px;transform:translateX(-50%);max-width:calc(100% - 20px);width:max-content;background:#fff;border:2px solid #1d2f6f;border-radius:14px;padding:4px 12px;font-size:1.1rem;text-align:center;box-shadow:0 3px 0 rgba(29,47,111,.2);z-index:2;pointer-events:none}',
    '.pk-chip{position:absolute;left:8px;top:12px;z-index:3;min-height:40px;border:2px solid #1d2f6f;border-radius:14px;background:#fff;font-size:1.05rem;padding:2px 10px;box-shadow:0 2px 0 #1d2f6f;color:#1d2f6f}',
    '.pk-tools{position:absolute;z-index:4;display:flex;gap:6px;background:#fff;border:3px solid #1d2f6f;border-radius:16px;padding:5px;box-shadow:0 4px 0 rgba(29,47,111,.25);animation:pkpop .18s ease-out}',
    '.pk-tools button{width:58px;min-height:50px;border:2px solid #1d2f6f;border-radius:12px;background:#f5fbff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-size:.85rem;line-height:1;padding:3px 2px;color:#1d2f6f}',
    '.pk-tools button:active{background:#dceeff}',
    '.pk-tools svg{width:26px;height:22px}',
    '@keyframes pkpop{from{transform:scale(.6);opacity:0}}',
    '.pk-sheetw{position:absolute;inset:0;z-index:10;background:rgba(29,47,111,.35);opacity:0;transition:opacity .2s}',
    '.pk-sheetw.on{opacity:1}',
    '.pk-sheet{position:absolute;left:0;right:0;bottom:0;max-height:88%;display:flex;flex-direction:column;background:#fffaf2;border-top:3px solid #1d2f6f;border-radius:22px 22px 0 0;transform:translateY(100%);transition:transform .25s ease;padding-bottom:env(safe-area-inset-bottom,0px)}',
    '.pk-sheetw.on .pk-sheet{transform:none}',
    '.pk-sh-h{display:flex;align-items:center;gap:8px;padding:10px 12px 4px 16px}',
    '.pk-sh-h h3{margin:0;font-weight:400;font-size:1.8rem;flex:1;line-height:1}',
    '.pk-sh-h .bal{font-size:1.2rem}.pk-sh-h .bal span{color:#e3a008}',
    '.pk-x{width:44px;height:44px;border:2px solid #1d2f6f;border-radius:12px;background:#fff;font-size:1.5rem;line-height:1;color:#1d2f6f}',
    '.pk-tabs{display:flex;gap:5px;padding:4px 10px 6px}',
    '.pk-tab{flex:1;min-width:0;min-height:44px;border:2px solid #1d2f6f;border-radius:12px;background:#fff;font-size:1.1rem;padding:0 2px;color:#1d2f6f}',
    '.pk-tab.on{background:#e8789f;color:#fff}',
    '.pk-sh-b{overflow-y:auto;touch-action:pan-y;padding:2px 12px 16px;-webkit-overflow-scrolling:touch}',
    '.pk-note{color:#5a6690;font-size:1.05rem;margin:4px 4px}',
    '.pk-note.warn{color:#cf412d}',
    '.pk-h4{font-size:1.35rem;margin:10px 4px 2px}',
    '.pk-row{display:flex;align-items:center;gap:10px;background:#fff;border:2px solid #ead9c4;border-radius:14px;padding:6px 8px;margin:6px 0}',
    '.pk-row img{width:60px;height:60px;flex:none}',
    '.pk-row img.wide{width:84px;height:56px;border:2px solid #1d2f6f;border-radius:8px}',
    '.pk-row .tx{flex:1;min-width:0;line-height:1.1}',
    '.pk-row .tx b{font-weight:400;font-size:1.3rem;display:block}',
    '.pk-row .tx small{color:#5a6690;font-size:1rem;display:block}',
    '.pk-row.lock{opacity:.6}',
    '.pk-row.cur{border-color:#e8789f;background:#fff0f5}',
    '.pk-buy{min-width:84px;min-height:46px;border:3px solid #1d2f6f;border-radius:14px;background:#e3a008;color:#2a1d00;font-size:1.25rem;box-shadow:0 3px 0 #1d2f6f}',
    '.pk-buy.pick{background:#fff;color:#1d2f6f}',
    '.pk-buy[disabled]{background:#e6e9f2;color:#5a6690;box-shadow:none}',
    '.pk-buy:active{transform:translateY(2px);box-shadow:0 1px 0 #1d2f6f}',
    '.pk-lockt{color:#7a4fc4;font-size:1.05rem;white-space:nowrap}',
    '.pk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin-top:6px}',
    '.pk-cell{position:relative;background:#fff;border:2px solid #ead9c4;border-radius:14px;padding:6px 4px 4px;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:1.05rem;line-height:1.05;min-height:110px;color:#1d2f6f}',
    '.pk-cell:active{background:#fff0f5}',
    '.pk-cell img{width:64px;height:64px}',
    '.pk-cell i{position:absolute;top:4px;right:6px;font-style:normal;color:#7a4fc4;font-size:1rem}',
    '.pk-roomimg{width:120px;height:84px;border:2px solid #1d2f6f;border-radius:10px;flex:none}',
    '.pk-photo{position:absolute;inset:0;z-index:12;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:rgba(29,47,111,.5);overflow:hidden}',
    '.pk-flash{position:absolute;inset:0;background:#fff;animation:pkflash .6s ease-out forwards;pointer-events:none}',
    '@keyframes pkflash{from{opacity:1}to{opacity:0}}',
    '.pk-pol{background:#fff;border:3px solid #1d2f6f;border-radius:10px;padding:10px 10px 6px;box-shadow:0 8px 0 rgba(29,47,111,.3);transform:rotate(-3deg);animation:pkpol .6s cubic-bezier(.2,1.4,.4,1);max-width:86%;text-align:center}',
    '.pk-pol img{display:block;width:min(300px,70vw);max-height:52vh;object-fit:cover;border:2px solid #1d2f6f;border-radius:4px}',
    '.pk-pol p{margin:6px 0 0;font-size:1.5rem}',
    '@keyframes pkpol{from{transform:rotate(-14deg) scale(.4);opacity:0}}',
    '.pk-conf{position:absolute;top:-20px;width:10px;height:16px;border-radius:3px;animation:pkfall 2.4s linear forwards;pointer-events:none}',
    '@keyframes pkfall{to{transform:translateY(110vh) rotate(720deg)}}'
  ].join('');
  var SVG = {
    shop: '<svg viewBox="0 0 40 34" aria-hidden="true"><path d="M6 12 h28 l-3 18 h-22 z" fill="#ffd0e0" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/><path d="M13 12 q0 -9 7 -9 q7 0 7 9" fill="none" stroke="#1d2f6f" stroke-width="2.5"/><path d="M20 18 l2 4 h4 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 h4 z" fill="#e3a008" stroke="#1d2f6f" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    box: '<svg viewBox="0 0 40 34" aria-hidden="true"><path d="M5 13 h30 v17 h-30 z" fill="#e0b07a" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/><path d="M5 13 l-2 -6 h14 l3 6 M35 13 l2 -6 h-14 l-3 6" fill="#ecc89a" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/><path d="M15 20 h10" stroke="#1d2f6f" stroke-width="2.5" stroke-linecap="round"/></svg>',
    rooms: '<svg viewBox="0 0 40 34" aria-hidden="true"><path d="M5 16 l15 -12 l15 12" fill="#e2533f" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/><path d="M9 15 v16 h22 v-16" fill="#fde2ea" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/><rect x="17" y="21" width="7" height="10" fill="#f2b51d" stroke="#1d2f6f" stroke-width="2"/></svg>',
    photo: '<svg viewBox="0 0 40 34" aria-hidden="true"><rect x="4" y="9" width="32" height="21" rx="4" fill="#9fd3f2" stroke="#1d2f6f" stroke-width="2.5"/><path d="M13 9 l3 -4 h8 l3 4" fill="#9fd3f2" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/><circle cx="20" cy="19" r="6" fill="#fff" stroke="#1d2f6f" stroke-width="2.5"/><circle cx="31" cy="13" r="1.6" fill="#e3a008"/></svg>',
    flip: '<svg viewBox="0 0 30 24" aria-hidden="true"><path d="M15 3 v18" stroke="#1d2f6f" stroke-width="2" stroke-dasharray="3 3"/><path d="M11 6 l-8 12 h8 z" fill="#9fd3f2" stroke="#1d2f6f" stroke-width="2" stroke-linejoin="round"/><path d="M19 6 l8 12 h-8 z" fill="#fff" stroke="#1d2f6f" stroke-width="2" stroke-linejoin="round"/></svg>',
    front: '<svg viewBox="0 0 30 24" aria-hidden="true"><rect x="4" y="4" width="13" height="11" rx="2" fill="#e6e9f2" stroke="#1d2f6f" stroke-width="2"/><rect x="11" y="9" width="14" height="12" rx="2" fill="#f7a8c4" stroke="#1d2f6f" stroke-width="2"/></svg>',
    back: '<svg viewBox="0 0 30 24" aria-hidden="true"><rect x="11" y="9" width="14" height="12" rx="2" fill="#e6e9f2" stroke="#1d2f6f" stroke-width="2"/><rect x="4" y="4" width="13" height="11" rx="2" fill="#f7a8c4" stroke="#1d2f6f" stroke-width="2"/></svg>',
    stow: '<svg viewBox="0 0 30 24" aria-hidden="true"><path d="M4 10 h22 v11 h-22 z" fill="#e0b07a" stroke="#1d2f6f" stroke-width="2" stroke-linejoin="round"/><path d="M15 1 v8 M11 5 l4 4 l4 -4" fill="none" stroke="#1d2f6f" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  var PIC = '<rect width="120" height="72" fill="#fde2ea"/>' +
    '<g fill="#f9c9d8"><rect x="6" width="8" height="52"/><rect x="26" width="8" height="52"/><rect x="46" width="8" height="52"/><rect x="66" width="8" height="52"/><rect x="86" width="8" height="52"/><rect x="106" width="8" height="52"/></g>' +
    '<rect y="52" width="120" height="20" fill="#c98f5a"/><path d="M0 60 h120 M30 52 l-2 8 M80 52 l-1 8 M55 60 l-1 12 M100 60 l1 12" stroke="#a8703f" stroke-width="1.5"/>' +
    '<rect y="48" width="120" height="4" fill="#fffaf0"/><path d="M0 48 h120 M0 52 h120" stroke="#1d2f6f" stroke-width="1.5"/>' +
    '<rect x="44" y="8" width="32" height="28" rx="2" fill="#aee0fb" stroke="#1d2f6f" stroke-width="2"/><circle cx="68" cy="15" r="4" fill="#ffd84a"/><path d="M60 8 v28 M44 22 h32" stroke="#fff" stroke-width="2.5"/>' +
    '<path d="M40 6 h10 q-2 12 -4 16 q2 8 0 14 h-6 z M80 6 h-10 q2 12 4 16 q-2 8 0 14 h6 z" fill="#f7a8c4" stroke="#1d2f6f" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<ellipse cx="60" cy="60" rx="30" ry="4" fill="#e2533f" stroke="#1d2f6f" stroke-width="1.6"/>' +
    '<rect x="6" y="30" width="7" height="30" rx="3" fill="#c98f5a" stroke="#1d2f6f" stroke-width="1.6"/><rect x="13" y="44" width="38" height="8" fill="#c98f5a" stroke="#1d2f6f" stroke-width="1.6"/><rect x="13" y="38" width="38" height="7" rx="3" fill="#fff" stroke="#1d2f6f" stroke-width="1.6"/><rect x="27" y="37" width="24" height="8" rx="3" fill="#f7a8c4" stroke="#1d2f6f" stroke-width="1.6"/><ellipse cx="20" cy="36" rx="6" ry="3" fill="#fff" stroke="#1d2f6f" stroke-width="1.4"/>' +
    '<g stroke="#1d2f6f" stroke-width="1.4"><circle cx="90" cy="50" r="6" fill="#c98f5a"/><circle cx="90" cy="41" r="5" fill="#c98f5a"/><circle cx="86" cy="37" r="2.2" fill="#c98f5a"/><circle cx="94" cy="37" r="2.2" fill="#c98f5a"/></g><circle cx="88.4" cy="40.5" r=".9" fill="#1d2f6f"/><circle cx="91.6" cy="40.5" r=".9" fill="#1d2f6f"/>' +
    '<path d="M104 56 h12 l-2 -10 h-8 z" fill="#d9824a" stroke="#1d2f6f" stroke-width="1.4" stroke-linejoin="round"/><path d="M110 46 v-10" stroke="#3fae5f" stroke-width="2"/><circle cx="110" cy="33" r="4" fill="#f47fb0" stroke="#1d2f6f" stroke-width="1.4"/>' +
    '<path d="M98 14 q6 6 12 0" fill="none" stroke="#1d2f6f" stroke-width="1"/><circle cx="100" cy="16" r="2" fill="#ffd36e"/><circle cx="104" cy="18" r="2" fill="#6fd3a0"/><circle cx="108" cy="16" r="2" fill="#6fb7ff"/>';

  NG.register('pokoik', {
    meta: { name: 'Pokoik', price: 'meble od 25 ★', bg: '#fde2ea', pic: PIC, music: 'cozy' },
    medals: [
      { id: 'own5', stat: 'owned', at: 5, tier: 1, text: '5 rzeczy w Pokoiku' },
      { id: 'own15', stat: 'owned', at: 15, tier: 2, text: '15 rzeczy w Pokoiku' },
      { id: 'own30', stat: 'owned', at: 30, tier: 3, text: '30 rzeczy w Pokoiku' }
    ],
    quests: [
      { id: 'buy', stat: 'bought', n: [1], text: 'Kup coś do Pokoiku' },
      { id: 'move', stat: 'moves', n: [5, 10], text: 'Przestaw {n} rzeczy w Pokoiku' }
    ],
    stickers: [
      { id: 'tapeta', emoji: '🎨', name: 'Pierwsza tapeta' },
      { id: 'pokoj2', emoji: '🧸', name: 'Pokój zabaw' },
      { id: 'zdjecie', emoji: '📸', name: 'Zdjęcie pokoju' }
    ],
    _test: { ITEMS: ITEMS, WALLS: WALLS, FLOORS: FLOORS },
    mount: function (el, ctx) {
      function blankRoom() { return { wall: 'kremowa', floor: 'deski', items: [] }; }
      var st = ctx.load({ v: 1, owned: {}, walls: ['kremowa'], floors: ['deski'], room: 'r1', room2: false, rooms: {}, nextId: 1, seenHelp: false });
      if (!st.owned || typeof st.owned !== 'object' || Array.isArray(st.owned)) st.owned = {};
      ['walls', 'floors'].forEach(function (k) { if (!Array.isArray(st[k])) st[k] = []; });
      if (st.walls.indexOf('kremowa') < 0) st.walls.push('kremowa');
      if (st.floors.indexOf('deski') < 0) st.floors.push('deski');
      if (!st.rooms || typeof st.rooms !== 'object') st.rooms = {};
      var used = {};
      ROOMS.forEach(function (R) {
        var r = st.rooms[R.k];
        if (!r || typeof r !== 'object') r = st.rooms[R.k] = blankRoom();
        if (!Array.isArray(r.items)) r.items = [];
        if (!WB[r.wall] || st.walls.indexOf(r.wall) < 0) r.wall = 'kremowa';
        if (!FB[r.floor] || st.floors.indexOf(r.floor) < 0) r.floor = 'deski';
        // drop unknown items and anything placed more often than owned
        r.items = r.items.filter(function (it) {
          if (!it || !IB[it.k] || !isFinite(it.x) || !isFinite(it.y)) return false;
          used[it.k] = (used[it.k] || 0) + 1;
          return used[it.k] <= (st.owned[it.k] || 0);
        });
        r.items.forEach(function (it) { if (!it.id) it.id = st.nextId++; });
      });
      if (st.room !== 'r1' && !(st.room === 'r2' && st.room2)) st.room = 'r1';
      var lvl = ctx.level();

      var root = document.createElement('div'); root.className = 'pk';
      var style = document.createElement('style'); style.textContent = CSS; root.appendChild(style);
      var cvWrap = document.createElement('div'); cvWrap.className = 'pk-cv'; root.appendChild(cvWrap);
      var cv = document.createElement('canvas'); cvWrap.appendChild(cv);
      var banner = document.createElement('div'); banner.className = 'pk-banner'; banner.hidden = true; cvWrap.appendChild(banner);
      var chip = document.createElement('button'); chip.type = 'button'; chip.className = 'pk-chip'; chip.hidden = true; cvWrap.appendChild(chip);
      var tools = document.createElement('div'); tools.className = 'pk-tools'; tools.hidden = true; cvWrap.appendChild(tools);
      var bar = document.createElement('div'); bar.className = 'pk-bar'; root.appendChild(bar);
      function mkBtn(svg, label) { var b = document.createElement('button'); b.type = 'button'; b.className = 'pk-btn'; b.innerHTML = svg + '<span>' + label + '</span>'; bar.appendChild(b); return b; }
      var bShop = mkBtn(SVG.shop, 'Sklep'), bBox = mkBtn(SVG.box, 'Pudło'), bRooms = mkBtn(SVG.rooms, 'Pokoje'), bPhoto = mkBtn(SVG.photo, 'Zdjęcie');
      var badge = document.createElement('span'); badge.className = 'badge'; badge.hidden = true; bBox.appendChild(badge);
      [['flip', 'Obróć'], ['front', 'Do przodu'], ['back', 'Do tyłu'], ['stow', 'Schowaj']].forEach(function (d) {
        var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-a', d[0]); b.innerHTML = SVG[d[0]] + '<span>' + d[1] + '</span>';
        tools.appendChild(b);
      });
      el.appendChild(root);
      var g = cv.getContext('2d');

      var W = 0, H = 0, dpr = 1, u = 1, floorTop = 0, bgCache = null;
      var raf = 0, running = true, timers = [], last = 0, T = 0, tick = 0;
      var sel = null, drag = null, sheet = null, photo = null, fx = [];

      function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
      function save() { ctx.save(st); }
      function room() { return st.rooms[st.room]; }
      function roomName(k) { return ROOMS.filter(function (r) { return r.k === k; })[0].n; }
      function toast(text) {
        ctx.toast(text);
        var ts = el.querySelectorAll('.ng-toast'), t = ts[ts.length - 1];
        if (t) t.style.cssText += ';inset:auto;top:14px;left:50%;right:auto;bottom:auto;white-space:normal;width:max-content;max-width:calc(100% - 24px);text-align:center';
      }
      function placedCount(k) { var n = 0; ROOMS.forEach(function (R) { st.rooms[R.k].items.forEach(function (it) { if (it.k === k) n++; }); }); return n; }
      function inBox(k) { return Math.max(0, (st.owned[k] || 0) - placedCount(k)); }
      function boxTotal() { var n = 0; ITEMS.forEach(function (I) { n += inBox(I.k); }); return n; }
      function ownedTotal() { var n = 0; for (var k in st.owned) if (IB[k]) n += st.owned[k] || 0; return n; }

      // ---------- geometry ----------
      function layout() {
        var r = cvWrap.getBoundingClientRect();
        W = Math.max(1, r.width); H = Math.max(1, r.height);
        dpr = Math.min(3, window.devicePixelRatio || 1);
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        u = Math.min(W / 320, H / 500);
        floorTop = Math.round(H * 0.68);
        buildBg();
        if (sel) placeTools();
      }
      function buildBg() {
        bgCache = document.createElement('canvas'); bgCache.width = cv.width; bgCache.height = cv.height;
        var b = bgCache.getContext('2d'); b.scale(dpr, dpr);
        drawRoomBg(b, room(), W, H, u, floorTop);
      }
      // on-screen position of an item's base centre, kept inside the room
      function pos(it) {
        var I = IB[it.k], hw = I.w * u / 2, hh = I.h * u;
        return { x: clamp(it.x * W, Math.min(hw, W / 2), Math.max(W - hw, W / 2)), y: clamp(it.y * H, Math.min(hh + 2, H), H - 2) };
      }
      function setPos(it, x, y) { it.x = x / W; it.y = y / H; var p = pos(it); it.x = p.x / W; it.y = p.y / H; }
      function ordered() {
        var items = room().items;
        return items.map(function (it, i) { return { it: it, i: i }; }).sort(function (a, b) { return (IB[a.it.k].L - IB[b.it.k].L) || (a.i - b.i); }).map(function (o) { return o.it; });
      }
      function box(it) {
        var I = IB[it.k], p = pos(it), hw = I.w * u / 2 + 6, top = p.y - I.h * u - 6;
        if (p.y - top < 40) top = p.y - 40;
        return { l: p.x - hw, r: p.x + hw, t: top, b: p.y + 8 };
      }
      function hitAt(x, y) {
        var list = ordered();
        for (var i = list.length - 1; i >= 0; i--) { var b = box(list[i]); if (x >= b.l && x <= b.r && y >= b.t && y <= b.b) return list[i]; }
        return null;
      }
      function defaultSpot(I) {
        var band = H - floorTop, x = rnd(0.22, 0.78) * W, y;
        if (I.at === 'wall') y = clamp(floorTop * rnd(0.42, 0.62), I.h * u + 14 * u, floorTop - 14 * u);
        else if (I.at === 'ceil') y = I.h * u + rnd(18, 44) * u;
        else if (I.at === 'rug') y = floorTop + band * rnd(0.5, 0.7);
        else y = floorTop + band * rnd(0.25, 0.75);
        return { x: x, y: y };
      }
      function addToRoom(k) {
        var it = { id: st.nextId++, k: k, x: 0.5, y: 0.5, f: false }, sp = defaultSpot(IB[k]);
        setPos(it, sp.x, sp.y);
        room().items.push(it);
        return it;
      }

      // ---------- a guest: one pet from Zwierzątko comes to visit and walks around the room ----------
      // Each time the room opens the next pet in the family visits (st.guest remembers who came last).
      // It wanders on the floor, sniffs at furniture, now and then sits or naps; a tap makes it happy.
      var guest = null;
      function pickGuest() {
        var A = NG.petArt, list = A ? A.pets() : [];
        if (!list.length) return null;
        var i = 0;
        for (var j = 0; j < list.length; j++) if (list[j].id === st.guest) { i = (j + 1) % list.length; break; }
        st.guest = list[i].id; save();
        return { pet: list[i], x: -0.12, k: 0.55, tx: rnd(0.25, 0.45), tk: rnd(0.35, 0.7), face: 1, legs: 0, walking: false, wait: 0, hop: -1, happy: 0, nap: 0, seed: Math.random() * 10 };
      }
      function guestY(gs) { return floorTop + (H - floorTop) * (0.18 + 0.72 * gs.k); }
      function guestScale(gs) { return u * 1.15 * NG.petArt.size(gs.pet) * (0.9 + 0.15 * gs.k); }
      function guestBox(gs) {
        var Gm = NG.petArt.geo(gs.pet, gs.nap > 0 ? 'sleep' : 'stand'), s = guestScale(gs), x = gs.x * W, y = guestY(gs);
        var x0 = gs.face > 0 ? Gm.x0 : -Gm.x1, x1 = gs.face > 0 ? Gm.x1 : -Gm.x0;
        return { l: x + x0 * s - 6, r: x + x1 * s + 6, t: y + Gm.top * s - 6, b: y + 8 };
      }
      function guestSay(text) { fx = fx.filter(function (f) { return f.kind !== 'label'; }); var b = guestBox(guest); fx.push({ kind: 'label', x: (b.l + b.r) / 2, y: b.t - 4, text: text, life: 2.4 }); }
      function guestHello() {
        if (!guest) return;
        var n = guest.pet.name, f = NG.petArt.fem(guest.pet);
        guestSay(n + (f ? ' przyszła' : ' przyszedł') + ' w odwiedziny!');
      }
      function petGuest() {
        var gs = guest; if (!gs) return;
        gs.nap = 0; gs.happy = 1.8; gs.hop = 0; gs.walking = false; gs.wait = rnd(1.5, 2.5); gs.tx = gs.x; gs.tk = gs.k;
        var b = guestBox(gs);
        for (var i = 0; i < 3; i++) fx.push({ kind: 'heart', x: (b.l + b.r) / 2 + rnd(-14, 14) * u, y: b.t + 6 + i * 6, life: 0.9 + i * 0.2 });
        ctx.sfx('pop');
        var lines = ['Ale tu ładnie!', 'Fajny pokój!', 'Lubię tu być!', 'Pobawimy się?', 'Hej!', 'Ale przytulnie!'];
        guestSay(lines[Math.floor(Math.random() * lines.length)]);
        ctx.stat('guest', 1);
      }
      function updateGuest(dt) {
        var gs = guest; if (!gs) return;
        if (gs.hop >= 0) { gs.hop += dt / 0.45; if (gs.hop >= 1) gs.hop = -1; }
        if (gs.happy > 0) gs.happy -= dt;
        if (gs.nap > 0) { gs.nap -= dt; if (gs.nap <= 0) gs.wait = rnd(0.5, 1.5); return; }
        var dx = gs.tx - gs.x, dk = gs.tk - gs.k, dist = Math.hypot(dx * W, dk * (H - floorTop));
        if (dist > 2) {
          gs.walking = true; if (Math.abs(dx * W) > 1) gs.face = dx > 0 ? 1 : -1;
          var step = Math.min(dist, 46 * u * dt), m = step / dist;
          gs.x += dx * m; gs.k += dk * m; gs.legs += dt * 9;
          if (dist - step <= 2) gs.wait = rnd(1.5, 4);
          return;
        }
        gs.walking = false;
        gs.wait -= dt;
        if (gs.wait > 0) return;
        var r = Math.random(), floorItems = room().items.filter(function (it) { return IB[it.k].L === 2 && IB[it.k].at === 'floor'; });
        if (r < 0.12 && !REDUCED) { gs.nap = rnd(4, 7); }
        else if (r < 0.24) { gs.hop = 0; gs.wait = rnd(1, 2); }
        else if (r < 0.55 && floorItems.length) {
          // go and sniff at something in the room, standing beside it
          var it = floorItems[Math.floor(Math.random() * floorItems.length)], ip = pos(it), side = Math.random() < 0.5 ? -1 : 1;
          var x = ip.x + side * (IB[it.k].w * u / 2 + 26 * u);
          if (x < 24 * u || x > W - 24 * u) x = ip.x - side * (IB[it.k].w * u / 2 + 26 * u);
          gs.tx = clamp(x / W, 0.06, 0.94); gs.tk = clamp((((ip.y + 6 * u) - floorTop) / Math.max(1, H - floorTop) - 0.18) / 0.72, 0, 1);
        } else { gs.tx = rnd(0.1, 0.9); gs.tk = rnd(0, 1); }
      }
      function drawGuest() {
        var gs = guest; if (!gs || !NG.petArt) return;
        var s = guestScale(gs), x = gs.x * W, y = guestY(gs), nap = gs.nap > 0, Gm = NG.petArt.geo(gs.pet, nap ? 'sleep' : 'stand');
        g.fillStyle = 'rgba(29,47,111,.13)'; g.beginPath(); g.ellipse(x, y - 1, (Gm.x1 - Gm.x0) * s * 0.42, 5 * u, 0, 0, 7); g.fill();
        var lift = gs.hop >= 0 ? Math.sin(Math.PI * gs.hop) * 16 * u : (gs.walking && NG.petArt.hops(gs.pet) && !REDUCED ? Math.abs(Math.sin(gs.legs * 0.55)) * 6 * u : 0);
        var br = 1 + Math.sin(T * (nap ? 1.4 : 2.2) + gs.seed) * (nap ? 0.03 : 0.015);
        g.save(); g.translate(x, y - lift); g.scale(s * gs.face, s * br);
        NG.petArt.draw(g, gs.pet, { t: T, legs: gs.walking ? gs.legs : 0, pose: nap ? 'sleep' : 'stand', eye: nap ? 'closed' : gs.happy > 0 ? 'happy' : 'open', mouth: nap ? 'chew' : gs.happy > 0.8 ? 'open' : 'smile', wag: gs.happy > 0 ? 1 : 0, seed: gs.seed });
        g.restore();
        if (nap && !REDUCED) {
          g.save(); g.font = Math.round(18 * clamp(u, 0.9, 1.3)) + 'px ' + FONT; g.fillStyle = '#7a4fc4'; g.textAlign = 'center';
          for (var i = 0; i < 2; i++) { var ph = (T * 0.6 + i * 0.5) % 1; g.globalAlpha = 1 - ph; g.fillText('z', x + (Gm.hx || 10) * s * gs.face + ph * 14 * u, y + Gm.top * s - ph * 26 * u); }
          g.restore();
        }
      }
      function hitGuest(x, y) { if (!guest) return false; var b = guestBox(guest); return x >= b.l && x <= b.r && y >= b.t && y <= b.b; }

      // ---------- frame ----------
      function drawOne(it, lifted) {
        var I = IB[it.k], p = pos(it);
        if (I.L === 2 && p.y > floorTop + 2) {
          g.fillStyle = lifted ? 'rgba(29,47,111,.22)' : 'rgba(29,47,111,.13)';
          g.beginPath(); g.ellipse(p.x, p.y - 1, I.w * u * 0.42, 5 * u, 0, 0, 7); g.fill();
        }
        g.save(); g.translate(p.x, p.y - (lifted ? 8 : 0));
        if (it.f) g.scale(-1, 1);
        g.scale(u, u); U = 2 / u;
        drawItem(g, it.k, T, { up: (p.y - (lifted ? 8 : 0)) / u, id: it.id, f: !!it.f });
        g.restore();
      }
      function drawFrame(dt) {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (bgCache) g.drawImage(bgCache, 0, 0, W, H);
        var dragged = drag && drag.moving ? drag.it : null, gy = guest ? guestY(guest) : 0, gDone = !guest;
        ordered().forEach(function (it) {
          if (it === dragged) return;
          // the guest walks in front of things standing behind it and behind things in front of it
          if (!gDone && IB[it.k].L === 2 && pos(it).y > gy) { drawGuest(); gDone = true; }
          drawOne(it, false);
        });
        if (!gDone) drawGuest();
        if (dragged) drawOne(dragged, true);
        if (sel) {
          var b = box(sel);
          g.save(); g.setLineDash([7, 6]); g.lineDashOffset = -T * 20; g.lineWidth = 2.5; g.strokeStyle = '#e8789f';
          g.beginPath(); g.moveTo(b.l + 10, b.t); g.arcTo(b.r, b.t, b.r, b.b, 10); g.arcTo(b.r, b.b, b.l, b.b, 10); g.arcTo(b.l, b.b, b.l, b.t, 10); g.arcTo(b.l, b.t, b.r, b.t, 10); g.closePath(); g.stroke();
          g.restore();
        }
        fx = fx.filter(function (f) {
          f.life -= dt; if (f.life <= 0) return false;
          var a = Math.min(1, f.life * 2);
          if (f.kind === 'heart') {
            f.y -= 26 * u * dt;
            g.save(); g.globalAlpha = a; g.translate(f.x, f.y); g.scale(u, u); U = 1.6 / u; G = g; heart(0, 0, 6, '#f47fb0'); g.restore();
          } else if (f.kind === 'spark') {
            var k2 = 1 - f.life / f.max;
            g.save(); g.globalAlpha = a; g.translate(f.x, f.y); g.scale(u, u); U = 1.4 / u; G = g;
            for (var i = 0; i < 6; i++) { var an = i * Math.PI / 3 + f.r, d = 10 + k2 * 26; star(Math.cos(an) * d, Math.sin(an) * d * 0.6, 4 * (1 - k2 * 0.5), i % 2 ? '#ffd36e' : '#f7a8c4'); }
            g.restore();
          } else if (f.kind === 'label') {
            g.save(); g.globalAlpha = a;
            g.font = Math.round(19 * clamp(u, 0.9, 1.25)) + 'px ' + FONT;
            var w = g.measureText(f.text).width + 22, h = 32, lx = clamp(f.x - w / 2, 6, W - w - 6), ly = clamp(f.y - h, 6, H - h - 6);
            g.beginPath(); g.moveTo(lx + 12, ly); g.arcTo(lx + w, ly, lx + w, ly + h, 12); g.arcTo(lx + w, ly + h, lx, ly + h, 12); g.arcTo(lx, ly + h, lx, ly, 12); g.arcTo(lx, ly, lx + w, ly, 12); g.closePath();
            g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
            g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(f.text, lx + w / 2, ly + h / 2 + 1);
            g.restore();
          }
          return true;
        });
      }
      function frame(now) {
        raf = 0; if (!running) return;
        raf = requestAnimationFrame(frame);
        var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now; T += dt;
        updateGuest(dt);
        // 30 fps is plenty for a calm room; full rate while dragging
        if (!drag && !fx.length && (tick++ % 2)) return;
        if (W) drawFrame(dt);
      }
      function start() { if (!raf && running) { last = 0; raf = requestAnimationFrame(frame); } }
      function spark(it) { if (REDUCED) return; var p = pos(it); fx.push({ kind: 'spark', x: p.x, y: p.y - IB[it.k].h * u / 2, life: 0.6, max: 0.6, r: Math.random() }); }
      function label(it, text) { var p = pos(it); fx = fx.filter(function (f) { return f.kind !== 'label'; }); fx.push({ kind: 'label', x: p.x, y: p.y - IB[it.k].h * u - 10, text: text, life: 2.2 }); }

      // ---------- UI state ----------
      function updateBar() {
        var n = boxTotal();
        badge.hidden = !n; badge.textContent = n;
        chip.hidden = !st.room2;
        chip.textContent = '⇄ ' + roomName(st.room);
        var any = ownedTotal() > 0, items = room().items.length;
        if (!any) { banner.hidden = false; banner.textContent = 'Kup pierwszą rzecz w sklepie.'; }
        else if (!items && n) { banner.hidden = false; banner.textContent = 'Wyjmij rzeczy z pudła.'; }
        else if (!items) { banner.hidden = false; banner.textContent = 'Ten pokój jest pusty. Urządź go!'; }
        else banner.hidden = true;
        if (!chip.hidden && !banner.hidden) banner.style.top = '60px'; else banner.style.top = '';
      }
      function bumpBadge() { badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump'); }
      function select(it) {
        sel = it; placeTools(); tools.hidden = false;
        tools.style.animation = 'none'; void tools.offsetWidth; tools.style.animation = '';
      }
      function deselect() { sel = null; tools.hidden = true; }
      function placeTools() {
        if (!sel) return;
        var b = box(sel), tw = tools.offsetWidth || 270, th = tools.offsetHeight || 66;
        var top = b.t - th - 8;
        if (top < 6) top = Math.min(b.b + 8, H - th - 6);
        if (top < 6) top = 6;
        tools.style.left = clamp((b.l + b.r) / 2 - tw / 2, 6, Math.max(6, W - tw - 6)) + 'px';
        tools.style.top = top + 'px';
      }
      tools.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b || !sel) return;
        var a = b.getAttribute('data-a'), items = room().items, i = items.indexOf(sel);
        if (i < 0) { deselect(); return; }
        if (a === 'flip') { sel.f = !sel.f; ctx.sfx('swap'); }
        else if (a === 'front') { items.splice(i, 1); items.push(sel); ctx.sfx('tap'); }
        else if (a === 'back') { items.splice(i, 1); items.unshift(sel); ctx.sfx('tap'); }
        else if (a === 'stow') { stow(sel); return; }
        save(); placeTools();
      });
      function stow(it) {
        var items = room().items, i = items.indexOf(it);
        if (i < 0) return;
        items.splice(i, 1);
        if (sel === it) deselect();
        save(); ctx.sfx('pop'); updateBar(); bumpBadge();
      }

      // ---------- sheets ----------
      function closeSheet() {
        if (!sheet) return;
        var s = sheet; sheet = null; s.wrap.classList.remove('on');
        s.wrap.style.pointerEvents = 'none';   // sliding away: a second tap must not buy again
        later(function () { s.wrap.remove(); }, 260);
      }
      function openSheet(title, tabs, tab, renderBody) {
        closeSheet(); deselect();
        var wrap = document.createElement('div'); wrap.className = 'pk-sheetw';
        var sh = document.createElement('div'); sh.className = 'pk-sheet'; wrap.appendChild(sh);
        sh.innerHTML = '<div class="pk-sh-h"><h3></h3><span class="bal"><span>★</span> <b style="font-weight:400"></b></span><button type="button" class="pk-x" aria-label="Zamknij">×</button></div>' +
          (tabs ? '<div class="pk-tabs">' + tabs.map(function (t) { return '<button type="button" class="pk-tab" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' : '') + '<div class="pk-sh-b"></div>';
        sh.querySelector('h3').textContent = title;
        var body = sh.querySelector('.pk-sh-b');
        sh.querySelector('.pk-x').onclick = function () { ctx.sfx('close'); closeSheet(); };
        wrap.addEventListener('pointerdown', function (e) { if (e.target === wrap) closeSheet(); });
        Array.prototype.forEach.call(sh.querySelectorAll('.pk-tab'), function (b) { b.onclick = function () { tab = b.getAttribute('data-t'); body.scrollTop = 0; render(); ctx.sfx('tap'); }; });
        root.appendChild(wrap); void wrap.offsetWidth; wrap.classList.add('on');
        ctx.sfx('open');
        var S = { wrap: wrap, body: body, render: render };
        sheet = S;
        function render() {
          if (!wrap.isConnected) return;
          sh.querySelector('.bal b').textContent = ctx.balance();
          Array.prototype.forEach.call(sh.querySelectorAll('.pk-tab'), function (b) { b.classList.toggle('on', b.getAttribute('data-t') === tab); });
          body.innerHTML = '';
          renderBody(body, tab, render);
        }
        render();
        return S;
      }
      function note(body, text, warn) { var p = document.createElement('p'); p.className = 'pk-note' + (warn ? ' warn' : ''); p.innerHTML = text; body.appendChild(p); }
      function row(body, img, imgCls, title, sub, extra) {
        var r = document.createElement('div'); r.className = 'pk-row';
        var im = document.createElement('img'); im.alt = ''; im.src = img; if (imgCls) im.className = imgCls; r.appendChild(im);
        var tx = document.createElement('div'); tx.className = 'tx'; tx.innerHTML = '<b></b>' + (sub ? '<small></small>' : '');
        tx.querySelector('b').textContent = title; if (sub) tx.querySelector('small').textContent = sub;
        r.appendChild(tx);
        if (extra) r.appendChild(extra);
        body.appendChild(r);
        return r;
      }
      function btn(label, disabled, fn, cls) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'pk-buy' + (cls ? ' ' + cls : '');
        b.textContent = label; b.disabled = !!disabled; b.onclick = fn; return b;
      }
      function lockT(lv) { var s = document.createElement('span'); s.className = 'pk-lockt'; s.textContent = 'od poziomu ' + lv; return s; }
      function poorNote(body, bal) { if (bal < 25) note(body, 'Brakuje gwiazdek. Zdobądź je w <a href="/matma/">Matmie</a>, <a href="/angielski/">Angielskim</a> albo <a href="/polski/">Polskim</a>.', true); }

      function openShop(tab) {
        openSheet('Sklep', [['meble', 'Meble'], ['ozdoby', 'Ozdoby'], ['zabawki', 'Zabawki'], ['sciany', 'Tapety']], tab || 'meble', function (body, t, render) {
          var bal = ctx.balance();
          if (t === 'sciany') {
            note(body, 'Tapeta i podłoga do pokoju: ' + roomName(st.room) + '.');
            var h = document.createElement('div'); h.className = 'pk-h4'; h.textContent = 'Tapety'; body.appendChild(h);
            WALLS.forEach(function (B) { surfRow(body, 'w', B, bal, render); });
            var h2 = document.createElement('div'); h2.className = 'pk-h4'; h2.textContent = 'Podłogi'; body.appendChild(h2);
            FLOORS.forEach(function (B) { surfRow(body, 'f', B, bal, render); });
          } else {
            if (t === 'meble') note(body, 'Kupione rzeczy możesz przesuwać palcem.');
            ITEMS.filter(function (I) { return I.cat === t; }).forEach(function (I) {
              var locked = I.lv > lvl, have = st.owned[I.k] || 0;
              var r = row(body, itemThumb(I, 120, locked), '', I.n, have ? 'masz: ' + have : '',
                locked ? lockT(I.lv) : btn(I.p + ' ★', I.p > bal, function () { buyItem(I, render); }));
              if (locked) r.classList.add('lock');
            });
          }
          poorNote(body, bal);
        });
      }
      function surfRow(body, kind, B, bal, render) {
        var R = room(), list = kind === 'w' ? st.walls : st.floors, curK = kind === 'w' ? R.wall : R.floor;
        var locked = B.lv > lvl, own = list.indexOf(B.k) >= 0, cur = curK === B.k, b;
        if (cur) b = btn('Teraz', true, null, 'pick');
        else if (own) b = btn('Wybierz', false, function () { setSurf(kind, B.k); ctx.sfx('paint'); render(); }, 'pick');
        else if (locked) b = lockT(B.lv);
        else b = btn(B.p + ' ★', B.p > bal, function () { buySurf(kind, B, render); });
        var r = row(body, surfThumb(kind, B, 168, 112), 'wide', B.n, '', b);
        if (cur) r.classList.add('cur');
        if (locked && !own) r.classList.add('lock');
      }
      function setSurf(kind, k) {
        if (kind === 'w') room().wall = k; else room().floor = k;
        save(); buildBg();
      }
      function buySurf(kind, B, render) {
        if (!ctx.spend(B.p, (kind === 'w' ? 'tapeta: ' : 'podłoga: ') + B.n)) { render(); return; }
        (kind === 'w' ? st.walls : st.floors).push(B.k);
        setSurf(kind, B.k);
        ctx.sfx('buy'); later(function () { ctx.sfx('paint'); }, 160);
        if (kind === 'w') ctx.sticker('tapeta');
        toast(kind === 'w' ? 'Nowa tapeta: ' + B.n + '!' : 'Nowa podłoga: ' + B.n + '!');
        render();
      }
      function buyItem(I, render) {
        if (!sheet || sheet.render !== render) return;   // this sheet is already closing (double tap)
        if (!ctx.spend(I.p, I.n)) { render(); return; }
        st.owned[I.k] = (st.owned[I.k] || 0) + 1;
        ctx.sfx('buy');
        var it = null;
        if (room().items.length < MAX_ROOM) it = addToRoom(I.k);
        save();
        closeSheet();
        ctx.stat('bought', 1);
        ctx.stat('owned', ownedTotal(), 'max');
        if (it) { label(it, I.n); spark(it); later(function () { ctx.sfx('place'); }, 140); }
        else { toast('Pokój jest pełny. ' + I.n + ' czeka w pudle.'); bumpBadge(); }
        updateBar();
      }

      function openBox() {
        openSheet('Pudło', null, null, function (body) {
          var any = false, grid = document.createElement('div'); grid.className = 'pk-grid';
          ITEMS.forEach(function (I) {
            var n = inBox(I.k); if (!n) return; any = true;
            var c = document.createElement('button'); c.type = 'button'; c.className = 'pk-cell';
            c.innerHTML = '<img alt="" src="' + itemThumb(I, 120, false) + '"><span></span>' + (n > 1 ? '<i>×' + n + '</i>' : '');
            c.querySelector('span').textContent = I.n;
            c.onclick = function () { takeOut(I); };
            grid.appendChild(c);
          });
          if (any) { note(body, 'Dotknij rzeczy, żeby ją wyjąć. Schowasz ją, gdy przeciągniesz ją na pudło.'); body.appendChild(grid); }
          else note(body, ownedTotal() ? 'Pudło jest puste. Wszystko stoi w pokojach.' : 'Pudło jest puste. Kup coś w sklepie!');
        });
      }
      function takeOut(I) {
        if (!sheet || !inBox(I.k)) return;
        if (room().items.length >= MAX_ROOM) { toast('W tym pokoju nie ma już miejsca.'); ctx.sfx('error'); return; }
        var it = addToRoom(I.k);
        save(); closeSheet();
        ctx.sfx('pop'); later(function () { ctx.sfx('place'); }, 120);
        label(it, I.n); spark(it); updateBar();
      }

      function openRooms() {
        openSheet('Pokoje', null, null, function (body, t, render) {
          var bal = ctx.balance();
          ROOMS.forEach(function (R) {
            var r = document.createElement('div'); r.className = 'pk-row';
            var im = document.createElement('img'); im.alt = ''; im.className = 'pk-roomimg';
            var own = R.k === 'r1' || st.room2, cur = st.room === R.k, b;
            im.src = own ? roomThumb(st.rooms[R.k], 120, 84) : surfThumb('w', WALLS[0], 120, 84);
            r.appendChild(im);
            var tx = document.createElement('div'); tx.className = 'tx'; tx.innerHTML = '<b></b><small></small>';
            tx.querySelector('b').textContent = R.n;
            tx.querySelector('small').textContent = own ? 'rzeczy: ' + st.rooms[R.k].items.length : 'drugi pokój';
            r.appendChild(tx);
            if (cur) { b = btn('Tu jesteś', true, null, 'pick'); r.classList.add('cur'); }
            else if (own) b = btn('Idź', false, function () { closeSheet(); switchRoom(R.k); }, 'pick');
            else if (lvl < ROOM2_LV) { b = lockT(ROOM2_LV); r.classList.add('lock'); }
            else b = btn(ROOM2_PRICE + ' ★', ROOM2_PRICE > bal, function () { buyRoom2(render); });
            r.appendChild(b);
            body.appendChild(r);
          });
          note(body, 'Rzeczy z pudła możesz postawić w każdym pokoju.');
          if (!st.room2 && lvl >= ROOM2_LV && bal < ROOM2_PRICE) poorNote(body, 0);
        });
      }
      function buyRoom2(render) {
        if (st.room2 || lvl < ROOM2_LV) return;
        if (!ctx.spend(ROOM2_PRICE, 'Pokój zabaw')) { render(); return; }
        st.room2 = true; save();
        ctx.sfx('buy');
        ctx.sticker('pokoj2');
        closeSheet();
        switchRoom('r2');
        later(function () { toast('Nowy pokój: Pokój zabaw!'); ctx.sfx('win'); }, 250);
      }
      function switchRoom(k) {
        if (k === 'r2' && !st.room2) return;
        st.room = k; deselect(); save(); buildBg(); fx = [];
        ctx.sfx('whoosh'); updateBar();
      }

      // ---------- photo ----------
      function takePhoto() {
        if (photo) return;
        if (!room().items.length) { toast('Najpierw postaw coś w pokoju.'); ctx.sfx('error'); return; }
        deselect(); fx = [];
        drawFrame(0);
        var url = '';
        try { url = cv.toDataURL('image/jpeg', 0.85); } catch (e) {}
        var ov = document.createElement('div'); ov.className = 'pk-photo';
        var flash = document.createElement('div'); flash.className = 'pk-flash'; if (REDUCED) flash.style.animationDuration = '0.2s';
        var pol = document.createElement('div'); pol.className = 'pk-pol';
        pol.innerHTML = (url ? '<img alt="">' : '') + '<p></p>';
        if (url) pol.querySelector('img').src = url;
        var lines = ['Ale pięknie!', 'Super pokój!', 'Jak przytulnie!', 'Cudownie!'];
        pol.querySelector('p').textContent = roomName(st.room) + ' · ' + lines[Math.floor(Math.random() * lines.length)];
        var ok = document.createElement('button'); ok.type = 'button'; ok.className = 'ng-btn'; ok.textContent = 'Super!';
        ov.appendChild(pol); ov.appendChild(ok);
        if (!REDUCED) {
          var cols = ['#f47fb0', '#ffd36e', '#6fb7ff', '#6fd3a0', '#b892e0', '#e2533f'];
          for (var i = 0; i < 28; i++) {
            var c = document.createElement('span'); c.className = 'pk-conf';
            c.style.left = (Math.random() * 100) + '%'; c.style.background = cols[i % cols.length];
            c.style.animationDelay = (Math.random() * 0.8) + 's'; c.style.animationDuration = (1.8 + Math.random() * 1.4) + 's';
            ov.appendChild(c);
          }
        }
        ov.appendChild(flash);
        root.appendChild(ov); photo = ov;
        ctx.sfx('click'); later(function () { ctx.sfx('win'); }, 260);
        ctx.stat('photos', 1);
        ctx.sticker('zdjecie');
        function shut() { if (!photo) return; photo.remove(); photo = null; ctx.sfx('close'); }
        ok.onclick = shut;
        ov.addEventListener('pointerdown', function (e) { if (e.target === ov) shut(); });
      }

      // ---------- input ----------
      var down = null;
      function ptr(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
      function overBox(e) { var r = bBox.getBoundingClientRect(); return e.clientX >= r.left - 6 && e.clientX <= r.right + 6 && e.clientY >= r.top - 10 && e.clientY <= r.bottom + 6; }
      function onDown(e) {
        if (down) return;
        var p = ptr(e);
        down = { x: p.x, y: p.y, id: e.pointerId };
        if (hitGuest(p.x, p.y)) { down.guest = true; try { cv.setPointerCapture(e.pointerId); } catch (er) {} return; }
        var it = hitAt(p.x, p.y);
        if (it) { var ip = pos(it); drag = { it: it, ox: p.x - ip.x, oy: p.y - ip.y, moving: false }; }
        try { cv.setPointerCapture(e.pointerId); } catch (er) {}
      }
      function onMove(e) {
        if (!drag || !down || down.id !== e.pointerId) return;
        var p = ptr(e);
        if (!drag.moving && Math.hypot(p.x - down.x, p.y - down.y) > 8) {
          drag.moving = true;
          if (sel) deselect();
          var items = room().items, i = items.indexOf(drag.it);
          if (i >= 0) { items.splice(i, 1); items.push(drag.it); }
          ctx.sfx('tap');
        }
        if (drag.moving) {
          setPos(drag.it, p.x - drag.ox, p.y - drag.oy);
          bBox.classList.toggle('drop', overBox(e));
        }
      }
      function onUp(e) {
        if (!down || down.id !== e.pointerId) return;
        var p = ptr(e), moved = Math.hypot(p.x - down.x, p.y - down.y), wasGuest = down.guest;
        down = null;
        if (wasGuest) { if (moved < 16) { if (sel) deselect(); petGuest(); } return; }
        bBox.classList.remove('drop');
        if (drag) {
          var it = drag.it, was = drag.moving; drag = null;
          if (was) {
            if (overBox(e)) { stow(it); return; }
            save(); ctx.sfx('place'); spark(it);
            if (moved > 20) ctx.stat('moves', 1);
            return;
          }
          if (sel === it) { deselect(); return; }
          select(it);
          var ip = pos(it);
          if (it.k === 'kotek' || it.k === 'piesek' || it.k === 'mis' || it.k === 'jednorozec') { fx.push({ kind: 'heart', x: ip.x, y: ip.y - IB[it.k].h * u, life: 1.1 }); ctx.sfx(it.k === 'piesek' ? 'jump' : 'pop'); }
          else if (it.k === 'pianinko') { var notes = [60, 62, 64, 67, 69, 72]; ctx.note(notes[Math.floor(Math.random() * notes.length)], 0.5); }
          else if (it.k === 'pilka') ctx.sfx('jump');
          else ctx.sfx('tap');
          return;
        }
        if (moved < 12 && sel) deselect();
      }
      function onCancel() { down = null; bBox.classList.remove('drop'); if (drag && drag.moving) save(); drag = null; }
      cv.addEventListener('pointerdown', onDown);
      cv.addEventListener('pointermove', onMove);
      cv.addEventListener('pointerup', onUp);
      cv.addEventListener('pointercancel', onCancel);
      bShop.onclick = function () { openShop(); };
      bBox.onclick = openBox;
      bRooms.onclick = openRooms;
      bPhoto.onclick = takePhoto;
      chip.onclick = function () { switchRoom(st.room === 'r1' ? 'r2' : 'r1'); };
      cv._pk = function () { return { st: st, W: W, H: H, u: u, floorTop: floorTop, pos: function (it) { return pos(it); }, box: function (it) { return box(it); } }; }; // test hook

      // ---------- boot ----------
      var ro = new ResizeObserver(function () { layout(); });
      ro.observe(cvWrap);
      layout();
      updateBar();
      if (ownedTotal()) ctx.stat('owned', ownedTotal(), 'max');
      var offS = window.Skarbonka.on(function () { lvl = ctx.level(); if (sheet) sheet.render(); });
      start();
      guest = pickGuest();
      if (guest) later(guestHello, 900);
      if (!st.seenHelp) {
        st.seenHelp = true; save();
        ctx.panel({ title: 'Pokoik', lines: ['Kup meble i zabawki w sklepie.', 'Przesuwaj je palcem po pokoju.', { text: 'Dotknij rzeczy, żeby ją obrócić albo schować do pudła.', muted: true }], button: 'Do pokoju', closable: false });
      }

      return {
        pause: function () { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
        resume: function () { if (running) return; running = true; start(); },
        destroy: function () {
          running = false; if (raf) cancelAnimationFrame(raf); raf = 0;
          timers.forEach(clearTimeout);
          ro.disconnect(); offS();
          cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove);
          cv.removeEventListener('pointerup', onUp); cv.removeEventListener('pointercancel', onCancel);
          root.remove();
        }
      };
    }
  });
})();
