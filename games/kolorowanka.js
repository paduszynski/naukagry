/*
 * Kolorowanka: a coloring book. Every picture is line art made of vector regions (SVG paths, painter's order:
 * later shapes cover earlier ones). The visible outlines come from one SVG mask per picture (each region
 * drawn black with a white stroke, in order), so outlines hidden behind later shapes never show and brush
 * strokes stay under the lines. Tap a region to fill it (20+ colors, patterns, rainbow), or draw with the
 * brush; eraser, undo, pinch / button zoom. 2 pictures free, the rest bought once for 40 ★. "Gotowe" puts
 * the picture into the gallery (region colors as one char each + compact brush strokes, no images stored).
 */
(function () {
  'use strict';

  var INK = '#1d2f6f', GOLD = '#e3a008', LVL = '#7a4fc4', MUTED = '#5a6690';
  var FONT = '"Patrick Hand","Comic Sans MS",cursive';
  var PRICE = 40, FREE = 2, FIN = 0.75, MAXGAL = 30, MAXPTS = 3000, GALPTS = 1200, ZMAX = 6;
  var SVGNS = 'http://www.w3.org/2000/svg';

  // ---------- colors and patterns ----------
  var PAL = ['#e2533f', '#f47b2a', '#f9c623', '#fff08a', '#a8d94a', '#3fae5f', '#1f7a4a', '#36c2b4', '#8fd3f4', '#3f86d8', '#2c3f9e',
    '#8a5cd0', '#c9a7ef', '#f7a8c8', '#e8459a', '#ffd3b0', '#c98a52', '#8a5a33', '#a0a8b8', '#3a3a48', '#ffffff', '#f2e6c9'];
  var NP = PAL.length;
  var PATS = ['zwykły', 'kropki', 'paski', 'kratka', 'serca', 'gwiazdki', 'tęcza'];
  var RB = 6; // rainbow pattern index (ignores the color)
  var RAINBOW = ['#e2533f', '#f47b2a', '#f9c623', '#3fae5f', '#36c2b4', '#3f86d8', '#8a5cd0'];

  function hexMix(a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
    var g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
    var bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }

  // ---------- geometry helpers (picture space 0..400) ----------
  function f(n) { return Math.round(n * 10) / 10; }
  function P(a) { var s = 'M' + f(a[0]) + ' ' + f(a[1]); for (var i = 2; i < a.length; i += 2) s += 'L' + f(a[i]) + ' ' + f(a[i + 1]); return s + 'Z'; }
  function el(cx, cy, rx, ry) {
    if (ry == null) ry = rx;
    return 'M' + f(cx - rx) + ' ' + f(cy) + 'A' + f(rx) + ' ' + f(ry) + ' 0 1 0 ' + f(cx + rx) + ' ' + f(cy) + 'A' + f(rx) + ' ' + f(ry) + ' 0 1 0 ' + f(cx - rx) + ' ' + f(cy) + 'Z';
  }
  var ci = el;
  function rc(x, y, w, h, r) {
    r = Math.min(r || 0, w / 2, h / 2);
    if (!r) return P([x, y, x + w, y, x + w, y + h, x, y + h]);
    var a = 'A' + r + ' ' + r + ' 0 0 1 ';
    return 'M' + (x + r) + ' ' + y + 'H' + (x + w - r) + a + (x + w) + ' ' + (y + r) + 'V' + (y + h - r) + a + (x + w - r) + ' ' + (y + h) +
      'H' + (x + r) + a + x + ' ' + (y + h - r) + 'V' + (y + r) + a + (x + r) + ' ' + y + 'Z';
  }
  function polar(cx, cy, r, a) { return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
  function star(cx, cy, ro, ri, n, rot) {
    n = n || 5; rot = rot == null ? -Math.PI / 2 : rot;
    var pts = [];
    for (var i = 0; i < n * 2; i++) { var p = polar(cx, cy, i % 2 ? ri : ro, rot + i * Math.PI / n); pts.push(p[0], p[1]); }
    return P(pts);
  }
  // rounded petals, each kept inside its own wedge (no self-crossing)
  function flower(cx, cy, ri, ro, n, rot) {
    rot = rot == null ? -Math.PI / 2 : rot;
    var st = Math.PI * 2 / n, s = '';
    for (var i = 0; i < n; i++) {
      var a0 = rot + i * st - st / 2, a1 = a0 + st;
      var p0 = polar(cx, cy, ri, a0), c1 = polar(cx, cy, ro * 1.33, a0 + st * 0.02), c2 = polar(cx, cy, ro * 1.33, a1 - st * 0.02), p1 = polar(cx, cy, ri, a1);
      if (!i) s = 'M' + f(p0[0]) + ' ' + f(p0[1]);
      s += 'C' + f(c1[0]) + ' ' + f(c1[1]) + ' ' + f(c2[0]) + ' ' + f(c2[1]) + ' ' + f(p1[0]) + ' ' + f(p1[1]);
    }
    return s + 'Z';
  }
  // bumps between points listed clockwise on screen bulge outwards
  function bumps(pts, k, close) {
    var s = 'M' + f(pts[0][0]) + ' ' + f(pts[0][1]);
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], r = Math.hypot(b[0] - a[0], b[1] - a[1]) * k;
      s += 'A' + f(r) + ' ' + f(r) + ' 0 0 1 ' + f(b[0]) + ' ' + f(b[1]);
    }
    return s + (close || 'Z');
  }
  function cloud(x, y, w) {
    return bumps([[x, y], [x + w * 0.1, y - w * 0.24], [x + w * 0.36, y - w * 0.4], [x + w * 0.66, y - w * 0.36], [x + w * 0.9, y - w * 0.2], [x + w, y]], 0.6);
  }
  function blob(cx, cy, r, n, rot) {
    var pts = [];
    for (var i = 0; i <= n; i++) pts.push(polar(cx, cy, r, (rot || 0) + i * Math.PI * 2 / n));
    return bumps(pts, 0.62);
  }
  function spikes(cx, cy, rx, ry, n, k, a0, a1) {
    var pts = [];
    for (var i = 0; i <= n * 2; i++) {
      var t = a0 + (a1 - a0) * i / (n * 2), rf = i % 2 ? 1 + k : 1;
      pts.push(cx + rx * rf * Math.cos(t), cy + ry * rf * Math.sin(t));
    }
    return P(pts);
  }
  function heart(cx, cy, s) {
    return 'M' + f(cx) + ' ' + f(cy + s * 0.9) + 'C' + f(cx - s * 1.5) + ' ' + f(cy) + ' ' + f(cx - s * 0.9) + ' ' + f(cy - s * 1.1) + ' ' + f(cx) + ' ' + f(cy - s * 0.4) +
      'C' + f(cx + s * 0.9) + ' ' + f(cy - s * 1.1) + ' ' + f(cx + s * 1.5) + ' ' + f(cy) + ' ' + f(cx) + ' ' + f(cy + s * 0.9) + 'Z';
  }
  function leaf(x1, y1, x2, y2, w) {
    var mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, px = -dy / l * w * 1.4, py = dx / l * w * 1.4;
    return 'M' + f(x1) + ' ' + f(y1) + 'Q' + f(mx + px) + ' ' + f(my + py) + ' ' + f(x2) + ' ' + f(y2) + 'Q' + f(mx - px) + ' ' + f(my - py) + ' ' + f(x1) + ' ' + f(y1) + 'Z';
  }
  function arcBand(cx, cy, ro, ri) {
    return 'M' + (cx - ro) + ' ' + cy + 'A' + ro + ' ' + ro + ' 0 0 1 ' + (cx + ro) + ' ' + cy + 'L' + (cx + ri) + ' ' + cy + 'A' + ri + ' ' + ri + ' 0 0 0 ' + (cx - ri) + ' ' + cy + 'Z';
  }
  function bow(cx, cy, s) { return P([cx, cy, cx - s, cy - s * 0.7, cx - s, cy + s * 0.7]) + P([cx, cy, cx + s, cy - s * 0.7, cx + s, cy + s * 0.7]); }
  function icing(x, y, w, h, n) {
    var s = 'M' + x + ' ' + (y + h) + 'V' + (y + 8) + 'Q' + x + ' ' + y + ' ' + (x + 8) + ' ' + y + 'H' + (x + w - 8) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + 8) + 'V' + (y + h);
    var sw = w / n;
    for (var i = n; i > 0; i--) s += 'Q' + f(x + i * sw - sw / 2) + ' ' + f(y + h * 2.3) + ' ' + f(x + (i - 1) * sw) + ' ' + (y + h);
    return s + 'Z';
  }
  function flame(cx, cy, s) {
    return 'M' + cx + ' ' + f(cy - s * 1.7) + 'Q' + f(cx + s * 1.2) + ' ' + f(cy - s * 0.2) + ' ' + f(cx + s * 0.9) + ' ' + f(cy + s * 0.4) + 'Q' + f(cx + s * 0.6) + ' ' + f(cy + s) + ' ' + cx + ' ' + f(cy + s) +
      'Q' + f(cx - s * 0.6) + ' ' + f(cy + s) + ' ' + f(cx - s * 0.9) + ' ' + f(cy + s * 0.4) + 'Q' + f(cx - s * 1.2) + ' ' + f(cy - s * 0.2) + ' ' + cx + ' ' + f(cy - s * 1.7) + 'Z';
  }
  function rays(cx, cy, r1, r2, n) {
    var s = '';
    for (var i = 0; i < n; i++) { var a = i * Math.PI * 2 / n + 0.2, p = polar(cx, cy, r1, a), q = polar(cx, cy, r2, a); s += 'M' + f(p[0]) + ' ' + f(p[1]) + 'L' + f(q[0]) + ' ' + f(q[1]); }
    return s;
  }
  function crenel(x0, x1, yTop, yBot, mw) {
    var pts = [x0, yBot, x0, yTop - 16], x = x0, up = true;
    while (x < x1 - 0.5) { var nx = Math.min(x1, x + mw); pts.push(nx, up ? yTop - 16 : yTop); if (nx < x1) pts.push(nx, up ? yTop : yTop - 16); x = nx; up = !up; }
    pts.push(x1, yBot);
    return P(pts);
  }

  // item kinds: r = region (tap to color), l = ink line, k = ink fill, w = fixed white (shine)
  function R(d, e) { return e ? ['r', d, 'e'] : ['r', d]; }
  function L(d) { return ['l', d]; }
  function K(d) { return ['k', d]; }
  function W(d) { return ['w', d]; }
  function eye(x, y, r) { return [K(ci(x, y, r)), W(ci(x - r * 0.35, y - r * 0.38, r * 0.36))]; }
  function flat(a) { var o = []; a.forEach(function (x) { if (Array.isArray(x[0])) o.push.apply(o, x); else o.push(x); }); return o; }

  // ---------- pictures ----------
  var PICS = [
    { id: 'jez', name: 'Jeżyk na łące', build: function () {
      return [
        R(rc(0, 0, 400, 400)), L(rays(335, 65, 40, 56, 10)), R(ci(335, 65, 31)),
        R(cloud(30, 140, 130)), R(cloud(196, 108, 100)),
        R('M0 228Q95 172 195 214Q295 178 400 218V400H0Z'),
        R(rc(322, 254, 20, 34, 6)), R('M296 262Q330 210 366 262Z'), R(ci(318, 249, 5)), R(ci(341, 239, 5.5)),
        R('M0 290Q120 266 230 284Q320 298 400 280V400H0Z'),
        R(spikes(185, 332, 92, 72, 13, 0.2, Math.PI, Math.PI * 2)),
        R(el(150, 340, 18, 9)), R(el(214, 340, 18, 9)),
        R(ci(256, 274, 11)),
        R('M238 296Q268 258 304 284Q326 300 348 316Q330 340 292 344Q252 348 240 330Z'),
        eye(292, 302, 6), K(ci(347, 315, 7)), L('M322 332Q330 336 338 330'),
        R(ci(172, 270, 20)), L('M172 250Q173 242 178 237'), R(leaf(176, 246, 198, 236, 6)),
        L('M55 338V378'), R(leaf(55, 362, 80, 350, 7)), R(flower(55, 318, 9, 24, 5)), R(ci(55, 318, 9)),
        L('M370 345V384'), R(flower(370, 332, 7, 19, 5)), R(ci(370, 332, 7)),
        L('M100 384V398'), R(flower(100, 374, 6, 15, 6)), R(ci(100, 374, 6)),
        L('M18 398l5-14l5 14M246 398l5-12l5 12M300 396l4-12l4 12M326 400l5-14l5 14')
      ];
    } },
    { id: 'kot', name: 'Kotek', build: function () {
      return [
        R(rc(0, 0, 400, 400)), R(rc(0, 300, 400, 100)), R(el(200, 352, 175, 34)),
        R(rc(250, 40, 120, 112, 8)), R(rc(262, 52, 45, 40, 3)), R(rc(313, 52, 45, 40, 3)), R(rc(262, 98, 45, 42, 3)), R(rc(313, 98, 45, 42, 3)),
        R(rc(36, 56, 112, 84, 6)), R(rc(48, 68, 88, 60, 3)), R(heart(92, 100, 15)),
        R('M246 330Q318 336 314 270Q311 246 326 242Q342 242 338 262Q344 344 252 350Z'),
        R(P([146, 178, 150, 104, 196, 140])), R(P([254, 178, 250, 104, 204, 140])),
        R(P([158, 160, 158, 124, 184, 142])), R(P([242, 160, 242, 124, 216, 142])),
        R('M136 342Q124 250 200 232Q276 250 264 342Z'), R(el(200, 302, 34, 36)),
        R(rc(158, 236, 84, 14, 7)), R(ci(200, 256, 8)),
        R(ci(200, 186, 56)),
        R(el(178, 180, 13, 15)), R(el(222, 180, 13, 15)), K(el(178, 183, 5, 10)), K(el(222, 183, 5, 10)), W(ci(175, 176, 3)), W(ci(219, 176, 3)),
        R(P([191, 204, 209, 204, 200, 214])),
        L('M200 214Q193 225 184 219M200 214Q207 225 216 219'),
        L('M168 208L130 202M168 214L132 220M232 208L270 202M232 214L268 220'),
        R(el(176, 340, 21, 12)), R(el(224, 340, 21, 12)), L('M170 335v8M181 335v8M219 335v8M230 335v8'),
        L('M118 346Q150 372 158 350'), R(ci(88, 330, 34)),
        L('M62 312Q92 330 104 362M74 302Q104 322 118 350M60 342Q80 346 90 364')
      ];
    } },
    { id: 'akw', name: 'Akwarium', build: function () {
      return [
        R(rc(0, 0, 400, 400)), R(rc(0, 334, 400, 66)), R(rc(30, 44, 340, 280, 14)),
        R('M33 274Q120 258 200 270Q290 282 367 264V310Q367 321 356 321H44Q33 321 33 310Z'),
        R('M70 272Q54 220 74 182Q90 150 78 118Q102 150 94 186Q80 226 92 272Z'),
        R('M318 270Q306 230 322 196Q336 168 326 140Q348 168 340 200Q330 234 340 270Z'),
        R('M236 278Q246 240 276 242Q308 246 312 280Z'),
        R(star(128, 292, 22, 10, 5)),
        R('M328 302Q346 270 364 302Z'), L('M346 302L338 286M346 302V280M346 302L354 286'),
        R('M150 122Q166 94 190 125Z'), R(P([112, 150, 82, 122, 82, 178])), R(el(162, 150, 52, 32)),
        R('M156 120Q170 150 156 180Q168 183 180 180Q192 150 178 120Q166 117 156 120Z'),
        eye(194, 142, 6), L('M210 158Q203 163 196 160'),
        R(P([316, 108, 342, 92, 342, 124])), R(el(290, 108, 30, 19)), eye(276, 103, 4),
        R(P([270, 208, 290, 196, 290, 220])), R(el(250, 208, 22, 14)), eye(240, 205, 3),
        R(ci(214, 98, 8)), R(ci(224, 76, 6)), R(ci(212, 59, 5)),
        R(rc(22, 32, 356, 16, 6))
      ];
    } },
    { id: 'lat', name: 'Latawiec', build: function () {
      return [
        R(rc(0, 0, 400, 400)), L(rays(334, 66, 38, 52, 10)), R(ci(334, 66, 29)),
        R(cloud(216, 178, 110)), R(cloud(0, 236, 80)),
        L('M232 70q8-8 16 0q8-8 16 0M268 104q6-6 12 0q6-6 12 0'),
        R(rc(48, 238, 14, 50, 3)), R(blob(55, 220, 30, 8)),
        R('M0 300Q100 236 220 300V400H0Z'),
        R('M140 330Q280 250 400 296V400H140Z'),
        L('M130 206Q240 236 342 206'),
        L('M292 262V282M308 262V282'), R(el(289, 284, 8, 4)), R(el(311, 284, 8, 4)),
        R(P([284, 214, 316, 214, 332, 264, 268, 264])), L('M316 222L342 206M284 222L268 240'),
        R(ci(279, 190, 7)), R(ci(321, 190, 7)), R(ci(300, 196, 18)),
        R('M281 196Q280 172 300 172Q321 172 319 196Q314 182 300 182Q286 182 281 196Z'),
        K(ci(294, 199, 2)), K(ci(306, 199, 2)), L('M295 206Q300 210 305 206'),
        L('M130 206Q112 236 134 262Q156 288 138 318'),
        R(P([130, 36, 184, 104, 130, 104])), R(P([184, 104, 130, 206, 130, 104])), R(P([130, 206, 76, 104, 130, 104])), R(P([76, 104, 130, 36, 130, 104])),
        R(bow(122, 235, 11)), R(bow(146, 289, 11)), R(bow(138, 318, 11)),
        L('M200 344V362'), R(flower(200, 334, 6, 16, 5)), R(ci(200, 334, 6)),
        L('M370 334V354'), R(flower(370, 322, 6, 15, 5)), R(ci(370, 322, 6))
      ];
    } },
    { id: 'ogr', name: 'Ogródek', build: function () {
      var it = [R(rc(0, 0, 400, 400)), L(rays(62, 62, 38, 52, 10)), R(ci(62, 62, 29)), R(cloud(238, 104, 120)),
        R(rc(0, 232, 400, 14)), R(rc(0, 292, 400, 14))];
      for (var i = 0; i < 5; i++) { var x = 12 + i * 80; it.push(R('M' + x + ' 336V204L' + (x + 17) + ' 186L' + (x + 34) + ' 204V336Z')); }
      return it.concat([
        R(rc(118, 170, 9, 170, 4)), R(leaf(126, 262, 168, 238, 12)), R(flower(122, 160, 20, 46, 12)), R(ci(122, 160, 20)),
        R(rc(287, 230, 7, 100, 3)), R(leaf(291, 300, 260, 262, 10)), R('M266 236V204L278 218L290 200L302 218L314 204V236Q290 262 266 236Z'),
        R('M0 322Q200 300 400 322V400H0Z'),
        R('M206 314Q230 272 254 314L245 314Q230 288 215 314Z'), R(rc(200, 310, 60, 52, 8)), R(P([258, 326, 300, 296, 307, 303, 260, 342])),
        R('M310 388Q308 372 322 372L372 374Q388 376 388 388Z'), R(ci(348, 362, 22)),
        L('M348 362m-4 0a4 4 0 1 1 8 0a8 8 0 1 1 -16 0a13 13 0 1 1 26 0'), L('M374 376L380 356M382 378L392 360'), K(ci(380, 355, 2.5)), K(ci(392, 359, 2.5)),
        R(rc(98, 338, 8, 14, 2)), R(el(102, 370, 32, 22)), L('M102 350Q90 370 102 392M102 350Q114 370 102 392M84 356Q76 370 84 386M120 356Q128 370 120 386'),
        R(el(189, 114, 11, 8)), R(el(211, 114, 11, 8)), L('M200 106V126M200 108L194 99M200 108L206 99')
      ]);
    } },
    { id: 'dom', name: 'Domek', build: function () {
      return [
        R(rc(0, 0, 400, 400)), L(rays(60, 58, 36, 50, 10)), R(ci(60, 58, 27)), R(cloud(150, 96, 90)),
        R(ci(280, 72, 10)), R(ci(298, 50, 13)),
        R(rc(334, 236, 16, 84, 3)), R(blob(342, 204, 40, 9)), R(ci(326, 196, 7)), R(ci(358, 212, 7)), R(ci(338, 228, 7)),
        R('M0 316Q200 294 400 316V400H0Z'),
        R(rc(250, 92, 30, 70, 2)), R(rc(80, 184, 220, 150)), R(P([58, 190, 190, 82, 322, 190])),
        R(ci(190, 148, 16)), L('M190 132V164M174 148H206'),
        R('M166 334V272Q190 244 214 272V334Z'), K(ci(205, 302, 3.5)),
        R(rc(88, 216, 14, 52, 2)), R(rc(150, 216, 14, 52, 2)), R(rc(102, 216, 48, 52, 2)), L('M126 216V268M102 242H150'),
        R(rc(216, 216, 14, 52, 2)), R(rc(278, 216, 14, 52, 2)), R(rc(230, 216, 48, 52, 2)), L('M254 216V268M230 242H278'),
        R('M170 334H210L244 400H136Z'),
        L('M98 360V380'), R(flower(98, 352, 5, 13, 5)), R(ci(98, 352, 5)),
        L('M284 362V384'), R(flower(284, 354, 5, 13, 5)), R(ci(284, 354, 5))
      ];
    } },
    { id: 'jed', name: 'Jednorożec', build: function () {
      // a leg: slimmer at the knee, a little wider hoof; dx leans the lower leg, so the outer legs stand apart
      function leg(x, y, h, dx) {
        var k = y + h * 0.55, hy = y + h - 13, b = y + h;
        return 'M' + x + ' ' + y + 'H' + (x + 18) + 'Q' + f(x + 18) + ' ' + f(k - 12) + ' ' + f(x + 16.5 + dx / 2) + ' ' + f(k) + 'L' + f(x + 17 + dx) + ' ' + hy +
          'L' + f(x + 18.5 + dx) + ' ' + (b - 4) + 'Q' + f(x + 18.5 + dx) + ' ' + b + ' ' + f(x + 9 + dx) + ' ' + b + 'Q' + f(x - 0.5 + dx) + ' ' + b + ' ' + f(x - 0.5 + dx) + ' ' + (b - 4) +
          'L' + f(x + 1 + dx) + ' ' + hy + 'L' + f(x + 1.5 + dx / 2) + ' ' + f(k) + 'Q' + x + ' ' + f(k - 12) + ' ' + x + ' ' + y + 'Z';
      }
      function hoof(x, y, h, dx) { return 'M' + f(x + 1 + dx) + ' ' + (y + h - 13) + 'H' + f(x + 17 + dx); }
      return [
        R(rc(0, 0, 400, 400)),
        R(arcBand(200, 330, 190, 168)), R(arcBand(200, 330, 168, 146)), R(arcBand(200, 330, 146, 124)), R(arcBand(200, 330, 124, 102)),
        R(star(60, 70, 14, 6)), R(star(336, 52, 12, 5)), R(star(374, 136, 9, 4)),
        R(cloud(-8, 322, 100)), R(cloud(308, 322, 100)),
        R('M0 316Q200 296 400 316V400H0Z'),
        R(leg(136, 286, 72, -6)), R(leg(166, 292, 68, -1)), R(leg(206, 292, 68, 1)), R(leg(236, 286, 72, 6)),
        L(hoof(136, 286, 72, -6) + hoof(166, 292, 68, -1) + hoof(206, 292, 68, 1) + hoof(236, 286, 72, 6)),
        R('M120 262Q80 252 78 292Q76 322 56 334Q100 342 112 306Q118 286 130 280Z'),
        R('M226 256Q238 212 260 178L300 196Q282 230 266 282Z'),
        R(el(192, 268, 76, 44)),
        R(P([296, 152, 318, 98, 314, 158])), R(P([274, 154, 280, 126, 294, 150])),
        R('M258 166Q286 142 318 158Q346 172 342 194Q338 214 310 212Q284 210 266 200Q252 186 258 166Z'),
        L('M301 140L313 135M304 126L315 121M308 112L316 108'),
        R('M262 160Q236 154 232 188Q218 200 222 226Q208 242 220 266Q236 244 244 218Q256 202 268 184Z'),
        L('M298 176Q306 184 314 176M300 179l-3 4M306 182v5M312 179l3 4'),
        R(el(318, 194, 7, 5)), K(ci(334, 190, 2.5)), L('M322 203Q328 206 334 201'),
        L('M60 370V392'), R(flower(60, 362, 6, 16, 5)), R(ci(60, 362, 6)),
        L('M336 372V394'), R(flower(336, 364, 6, 16, 5)), R(ci(336, 364, 6))
      ];
    } },
    { id: 'rak', name: 'Rakieta', build: function () {
      return [
        R(rc(0, 0, 400, 400)),
        R(star(40, 186, 10, 4)), R(star(118, 40, 8, 3.5)), R(star(262, 36, 9, 4)), R(star(372, 210, 10, 4)), R(star(58, 330, 9, 4)),
        R(ci(70, 82, 30)), R(ci(60, 74, 7)), R(ci(82, 96, 5)),
        R(ci(316, 324, 56)), R(el(316, 324, 96, 22) + el(316, 324, 70, 12), 'e'),
        R('M286 118Q306 82 326 118Z'), R(el(306, 120, 40, 12)), R(ci(286, 121, 4)), R(ci(306, 125, 4)), R(ci(326, 121, 4)),
        R('M150 236L112 296V322L150 300Z'), R('M210 236L248 296V322L210 300Z'),
        R('M162 312Q168 356 180 382Q192 356 198 312Z'), R('M170 312Q174 340 180 354Q186 340 190 312Z'),
        R(rc(158, 298, 44, 16, 3)),
        R('M150 304V170Q150 112 180 70Q210 112 210 170V304Z'),
        R('M152 150Q156 106 180 70Q204 106 208 150Q180 158 152 150Z'),
        R(rc(150, 252, 60, 14)),
        R(ci(180, 196, 20)), R(ci(180, 196, 13)), W(ci(175, 191, 3.5))
      ];
    } },
    { id: 'zam', name: 'Zamek', build: function () {
      return [
        R(rc(0, 0, 400, 400)), R(cloud(16, 92, 100)), R(cloud(286, 60, 96)),
        R(rc(160, 110, 80, 110)), R(P([150, 112, 200, 40, 250, 112])), L('M200 40V16'), R(P([200, 16, 226, 23, 200, 30])),
        R('M190 162V148Q200 134 210 148V162Z'),
        R(rc(40, 170, 70, 170)), R(P([30, 172, 75, 96, 120, 172])), L('M75 96V72'), R(P([75, 72, 99, 79, 75, 86])),
        R(rc(290, 170, 70, 170)), R(P([280, 172, 325, 96, 370, 172])), L('M325 96V72'), R(P([325, 72, 349, 79, 325, 86])),
        R('M64 238V222Q75 208 86 222V238Z'), R('M314 238V222Q325 208 336 222V238Z'),
        R(crenel(110, 290, 206, 340, 20)),
        R('M172 340V284Q200 252 228 284V340Z'), L('M186 274V340M200 268V340M214 274V340M172 300H228M172 320H228'),
        R('M128 262V248Q138 236 148 248V262Z'), R('M252 262V248Q262 236 272 248V262Z'),
        R('M0 330Q200 306 400 330V400H0Z'),
        R('M178 326H222L262 400H138Z'),
        R(blob(30, 352, 26, 7)), R(blob(372, 354, 26, 7))
      ];
    } },
    { id: 'mot', name: 'Motyl', build: function () {
      return [
        R(rc(0, 0, 400, 400)), R(heart(60, 62, 16)), R(heart(342, 70, 13)), R(heart(354, 236, 10)),
        R('M0 352Q200 328 400 352V400H0Z'),
        L('M70 336V394M330 340V394'), R(flower(70, 324, 10, 28, 6)), R(ci(70, 324, 10)), R(flower(330, 328, 9, 25, 5)), R(ci(330, 328, 9)),
        R('M196 212Q128 220 108 270Q106 318 158 310Q190 292 198 232Z'), R('M204 212Q272 220 292 270Q294 318 242 310Q210 292 202 232Z'),
        R('M196 190Q120 72 66 118Q34 168 88 208Q140 226 196 206Z'), R('M204 190Q280 72 334 118Q366 168 312 208Q260 226 204 206Z'),
        R(ci(118, 150, 22)), R(ci(282, 150, 22)), R(ci(160, 190, 10)), R(ci(240, 190, 10)),
        R(ci(148, 274, 14)), R(ci(252, 274, 14)),
        R(el(200, 214, 11, 64)),
        L('M195 132Q184 102 170 96M205 132Q216 102 230 96'), K(ci(170, 96, 4.5)), K(ci(230, 96, 4.5)),
        R(ci(200, 144, 15)), K(ci(195, 142, 2)), K(ci(205, 142, 2)), L('M195 149Q200 153 205 149')
      ];
    } },
    { id: 'sta', name: 'Statek', build: function () {
      return [
        R(rc(0, 0, 400, 400)), L(rays(70, 70, 38, 52, 10)), R(ci(70, 70, 29)), R(cloud(170, 96, 110)), R(cloud(300, 150, 80)),
        L('M250 50q8-8 16 0q8-8 16 0M118 150q6-6 12 0q6-6 12 0'),
        R('M300 254Q345 226 392 254Z'), R('M342 242Q346 214 338 190L345 188Q354 212 350 242Z'),
        R(leaf(342, 190, 308, 200, 8)), R(leaf(342, 190, 376, 198, 8)), R(leaf(342, 190, 336, 160, 7)),
        R('M0 252Q25 242 50 252T100 252T150 252T200 252T250 252T300 252T350 252T400 252V400H0Z'),
        R(rc(198, 86, 8, 196, 3)), R(P([196, 98, 196, 262, 104, 262])), R(P([210, 116, 210, 262, 290, 262])), R(P([206, 86, 240, 96, 206, 106])),
        R('M86 278H324L292 334H118Z'), R('M95 290H315L307 304H103Z'), R(ci(150, 318, 7)), R(ci(205, 318, 7)), R(ci(260, 318, 7)),
        R('M0 322Q25 306 50 322T100 322T150 322T200 322T250 322T300 322T350 322T400 322V400H0Z'),
        R(P([96, 360, 112, 349, 112, 371])), R(el(80, 360, 17, 10)), K(ci(71, 357, 2.2)),
        L('M220 372q10-8 20 0q10-8 20 0M318 356q10-8 20 0M150 390q10-8 20 0')
      ];
    } },
    { id: 'tor', name: 'Tort urodzinowy', build: function () {
      var it = [R(rc(0, 0, 400, 400)), L('M0 20Q200 60 400 20')];
      [0.1, 0.3, 0.5, 0.7, 0.9].forEach(function (t) { var x = 400 * t, y = 20 + 80 * t * (1 - t); it.push(R(P([x - 17, y, x + 17, y, x, y + 32]))); });
      return it.concat([
        L('M50 144Q62 190 46 232M352 132Q340 176 356 220'), R(el(50, 108, 28, 34)), K(P([44, 141, 56, 141, 50, 148])), R(el(352, 98, 26, 32)), K(P([346, 129, 358, 129, 352, 136])),
        R(rc(0, 330, 400, 70)), R(el(200, 334, 160, 20)),
        R(rc(80, 244, 240, 92, 10)), R(icing(80, 242, 240, 18, 6)),
        R(ci(118, 302, 8)), R(ci(172, 308, 8)), R(ci(228, 308, 8)), R(ci(282, 302, 8)),
        R(rc(120, 170, 160, 78, 10)), R(icing(120, 168, 160, 16, 4)), R(heart(162, 218, 10)), R(heart(238, 218, 10)),
        L('M157 116v-8M200 108v-8M243 116v-8'),
        R(rc(150, 116, 14, 54, 3)), R(rc(193, 108, 14, 62, 3)), R(rc(236, 116, 14, 54, 3)),
        R(flame(157, 98, 8)), R(flame(200, 90, 8)), R(flame(243, 98, 8))
      ]);
    } },
    { id: 'sow', name: 'Sowa w nocy', build: function () {
      return [
        R(rc(0, 0, 400, 400)), R(ci(322, 80, 38)), R(star(60, 60, 11, 5)), R(star(104, 36, 8, 3.5)), R(star(64, 196, 9, 4)), R(star(362, 196, 9, 4)),
        R('M0 296Q200 280 400 306V330Q200 306 0 322Z'),
        R(leaf(60, 304, 28, 272, 10)), R(leaf(334, 312, 364, 284, 10)), R(leaf(380, 318, 398, 346, 8)),
        R(P([134, 152, 122, 98, 172, 124])), R(P([266, 152, 278, 98, 228, 124])),
        R('M200 112Q288 112 284 228Q280 312 200 312Q120 312 116 228Q112 112 200 112Z'),
        R(el(200, 254, 50, 50)),
        L('M184 234q6 6 12 0M204 234q6 6 12 0M174 254q6 6 12 0M194 254q6 6 12 0M214 254q6 6 12 0M184 274q6 6 12 0M204 274q6 6 12 0'),
        R('M124 186Q92 246 132 300Q148 262 142 200Z'), R('M276 186Q308 246 268 300Q252 262 258 200Z'),
        R(ci(166, 178, 30)), R(ci(234, 178, 30)), R(ci(166, 180, 16)), R(ci(234, 180, 16)),
        K(ci(166, 181, 8)), K(ci(234, 181, 8)), W(ci(162, 177, 3)), W(ci(230, 177, 3)),
        R(P([190, 198, 210, 198, 200, 218])),
        R('M174 302q-6 12 0 14q4-6 6 0q4-6 6 0q6-2 0-14Z'), R('M214 302q-6 12 0 14q4-6 6 0q4-6 6 0q6-2 0-14Z')
      ];
    } },
    { id: 'din', name: 'Dinozaur', build: function () {
      return [
        R(rc(0, 0, 400, 400)), L(rays(60, 60, 36, 50, 10)), R(ci(60, 60, 27)),
        R(P([280, 290, 346, 136, 378, 136, 400, 187, 400, 290])), R('M346 136H378L374 162Q367 153 361 168Q354 155 349 161Z'), R(blob(362, 102, 20, 7)),
        R('M0 280Q200 264 400 284V400H0Z'),
        R('M112 282Q50 290 16 336Q76 328 118 308Z'),
        R(rc(118, 300, 22, 64, 9)), R(rc(150, 306, 22, 60, 9)), R(rc(200, 306, 22, 60, 9)), R(rc(232, 300, 22, 64, 9)),
        R('M232 266Q244 190 264 148L298 158Q280 206 266 296Z'),
        R(P([118, 246, 130, 220, 142, 240])), R(P([148, 236, 160, 208, 172, 232])), R(P([184, 232, 196, 204, 208, 232])),
        R(el(184, 282, 88, 52)), R(ci(152, 272, 9)), R(ci(190, 258, 7)), R(ci(214, 292, 10)),
        R('M260 150Q262 122 296 122Q330 122 332 144Q332 164 300 166Q264 168 260 150Z'),
        eye(302, 138, 5), K(ci(326, 136, 2)), L('M310 154Q318 156 326 150'),
        R(leaf(370, 360, 338, 300, 12)), R(leaf(372, 362, 398, 296, 11))
      ];
    } }
  ];
  var PB = {};
  PICS.forEach(function (p, i) { p.idx = i; PB[p.id] = p; });
  function items(p) {
    if (!p._it) { p._it = flat(p.build()); p.n = p._it.filter(function (x) { return x[0] === 'r'; }).length; }
    return p._it;
  }
  function nRegions(p) { items(p); return p.n; }

  // ---------- codes: one char per region; '.' = empty ----------
  function codeChar(pat, col) { return String.fromCharCode(0x100 + (pat === RB ? RB * NP : pat * NP + col)); }
  function decode(ch) {
    if (!ch || ch === '.') return null;
    var c = ch.charCodeAt(0) - 0x100;
    if (c < 0 || c > RB * NP) return null;
    return { pat: Math.floor(c / NP), col: c % NP };
  }
  function blank(p) { return new Array(nRegions(p) + 1).join('.'); }
  function fixColors(p, s) {
    var n = nRegions(p), out = '';
    s = typeof s === 'string' ? s : '';
    for (var i = 0; i < n; i++) { var ch = s.charAt(i); out += decode(ch) ? ch : '.'; }
    return out;
  }
  function colored(s) { var n = 0; for (var i = 0; i < s.length; i++) if (s.charAt(i) !== '.') n++; return n; }

  // strokes: { c: code char, w: width, pts: [x, y, ...] } <-> string: code char, width char, then 2 chars per point (half units)
  function encStroke(s) {
    var o = s.c + String.fromCharCode(0x100 + Math.round(s.w * 2));
    for (var i = 0; i < s.pts.length; i++) o += String.fromCharCode(0x100 + Math.max(0, Math.min(800, Math.round(s.pts[i] * 2))));
    return o;
  }
  function decStroke(str) {
    if (typeof str !== 'string' || str.length < 4 || !decode(str.charAt(0))) return null;
    var pts = [];
    for (var i = 2; i + 1 < str.length; i += 2) pts.push((str.charCodeAt(i) - 0x100) / 2, (str.charCodeAt(i + 1) - 0x100) / 2);
    return { c: str.charAt(0), w: Math.max(1, (str.charCodeAt(1) - 0x100) / 2), pts: pts };
  }
  function strokeD(pts) {
    if (!pts.length) return '';
    var s = 'M' + f(pts[0]) + ' ' + f(pts[1]);
    if (pts.length === 2) return s + 'L' + f(pts[0]) + ' ' + f(pts[1]);
    for (var i = 2; i < pts.length; i += 2) s += 'L' + f(pts[i]) + ' ' + f(pts[i + 1]);
    return s;
  }
  function countPts(strokes) { var n = 0; strokes.forEach(function (s) { n += s.pts.length / 2; }); return n; }
  function sigOf(colors, strokes) {
    var s = colors + '|' + strokes.join('|'), h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36) + s.length.toString(36);
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function plural(n, forms) { if (n === 1) return forms[0]; var d = n % 10, h = n % 100; return d >= 2 && d <= 4 && (h < 12 || h > 14) ? forms[1] : forms[2]; }

  // ---------- shared defs (patterns, gradients, masks) for the current mount ----------
  var DEFS = null, made = {};
  function defsAdd(id, tag, attrs, inner) {
    if (made[id] || !DEFS) return;
    made[id] = 1;
    var e = document.createElementNS(SVGNS, tag);
    e.setAttribute('id', id);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    e.innerHTML = inner;
    DEFS.appendChild(e);
  }
  function patInner(pat, color) {
    var c = color === '#ffffff' ? '#d6dcea' : color, bg = color === '#ffffff' ? '#ffffff' : hexMix(color, '#ffffff', 0.62);
    var b = '<rect width="20" height="20" fill="' + bg + '"/>';
    if (pat === 1) return b + '<circle cx="5" cy="5" r="3.2" fill="' + c + '"/><circle cx="15" cy="15" r="3.2" fill="' + c + '"/>';
    if (pat === 2) return b + '<path d="M-5 5L5 -5M-5 25L25 -5M15 25L25 15" stroke="' + c + '" stroke-width="5"/>';
    if (pat === 3) return b + '<rect width="10" height="10" fill="' + c + '"/><rect x="10" y="10" width="10" height="10" fill="' + c + '"/>';
    if (pat === 4) return b + '<path d="' + heart(10, 10, 5) + '" fill="' + c + '"/>';
    return b + '<path d="' + star(10, 10, 6, 2.6, 5) + '" fill="' + c + '"/>';
  }
  function fillOf(ch, forStroke) {
    var d = decode(ch);
    if (!d) return '#ffffff';
    if (d.pat === 0) return PAL[d.col];
    if (d.pat === RB) return forStroke ? 'url(#kol-rbu)' : 'url(#kol-rb)';
    var id = 'kol-p' + d.pat + '-' + d.col;
    defsAdd(id, 'pattern', { patternUnits: 'userSpaceOnUse', width: 20, height: 20 }, patInner(d.pat, PAL[d.col]));
    return 'url(#' + id + ')';
  }
  function ensureBase() {
    var stops = '';
    RAINBOW.forEach(function (c, i) { stops += '<stop offset="' + (i / 7).toFixed(3) + '" stop-color="' + c + '"/><stop offset="' + ((i + 1) / 7).toFixed(3) + '" stop-color="' + c + '"/>'; });
    defsAdd('kol-rb', 'linearGradient', { x1: 0, y1: 0, x2: 1, y2: 1 }, stops);
    defsAdd('kol-rbu', 'linearGradient', { gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 160, y2: 160, spreadMethod: 'repeat' }, stops);
  }
  function ensureMask(p, id) {
    var inner = '<g stroke-linejoin="round" stroke-linecap="round">' + items(p).map(function (it) {
      var d = it[1];
      if (it[0] === 'r') return '<path d="' + d + '" fill="#000" stroke="#fff" style="stroke-width:calc(var(--zs,1)*3px)"' + (it[2] ? ' fill-rule="evenodd"' : '') + '/>';
      if (it[0] === 'l') return '<path d="' + d + '" fill="none" stroke="#fff" style="stroke-width:calc(var(--zs,1)*2.6px)"/>';
      if (it[0] === 'k') return '<path d="' + d + '" fill="#fff"/>';
      return '<path d="' + d + '" fill="#000"/>';
    }).join('') + '</g>';
    defsAdd(id || 'kol-m-' + p.id, 'mask', { maskUnits: 'userSpaceOnUse', x: -6, y: -6, width: 412, height: 412 }, inner);
  }
  function fillsHTML(p, colors) {
    var i = 0;
    return items(p).map(function (it) {
      if (it[0] === 'r') { var s = '<path data-r="' + i + '" d="' + it[1] + '" fill="' + fillOf(colors.charAt(i)) + '"' + (it[2] ? ' fill-rule="evenodd"' : '') + '/>'; i++; return s; }
      if (it[0] === 'w') return '<path d="' + it[1] + '" fill="#fff" pointer-events="none"/>';
      return '';
    }).join('');
  }
  function strokeHTML(s) { return '<path d="' + strokeD(s.pts) + '" stroke="' + fillOf(s.c, true) + '" stroke-width="' + s.w + '"/>'; }
  function svgHTML(p, colors, strokes, extra, maskId) {
    maskId = maskId || 'kol-m-' + p.id;
    ensureMask(p, maskId);
    return '<svg xmlns="' + SVGNS + '" viewBox="0 0 400 400" ' + (extra || '') + '><g class="kf">' + fillsHTML(p, colors) + '</g>' +
      '<g class="kb" fill="none" stroke-linecap="round" stroke-linejoin="round" pointer-events="none">' + strokes.map(strokeHTML).join('') + '</g>' +
      '<rect x="-6" y="-6" width="412" height="412" fill="' + INK + '" mask="url(#' + maskId + ')" pointer-events="none"/></svg>';
  }

  // ---------- icons ----------
  function ic(d, extra) { return '<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' + d + (extra || '') + '</svg>'; }
  var ICON = {
    back: ic('<path d="M20 6L10 16l10 10"/>'),
    undo: ic('<path d="M11 6L5 12l6 6"/><path d="M5 12h13a8 8 0 0 1 0 16h-5"/>'),
    trash: ic('<path d="M6 9h20M13 9V5h6v4M8 9l2 18h12l2-18"/><path d="M14 14v8M18 14v8" stroke-width="2.4"/>'),
    fill: ic('<path d="M6 15l9-9 10 10-9 9z" fill="#fff"/><path d="M6 15h19"/><path d="M27 21c0 0 3 4 3 6a3 3 0 0 1-6 0c0-2 3-6 3-6z" fill="#3f86d8" stroke-width="2"/>'),
    brush: ic('<path d="M27 4L14 18" stroke-width="4"/><path d="M13 17c-4-1-8 2-8 6 0 3-2 4-3 5 6 1 13-1 13-6 0-2-1-4-2-5z" fill="#e8459a" stroke-width="2.4"/>'),
    erase: ic('<path d="M4 22l12-12 10 10-6 6H10z" fill="#fff"/><path d="M4 22l6-6 10 10h-10z" fill="#f7a8c8"/><path d="M12 28h16"/>'),
    plus: ic('<circle cx="13" cy="13" r="9" fill="#fff"/><path d="M20 20l8 8M9 13h8M13 9v8"/>'),
    minus: ic('<circle cx="13" cy="13" r="9" fill="#fff"/><path d="M20 20l8 8M9 13h8"/>'),
    fit: ic('<path d="M5 12V5h7M20 5h7v7M27 20v7h-7M12 27H5v-7"/>'),
    check: ic('<path d="M6 17l6 6L26 8"/>'),
    lock: ic('<rect x="7" y="14" width="18" height="14" rx="3" fill="#fff"/><path d="M11 14v-4a5 5 0 0 1 10 0v4"/>')
  };

  var CSS = [
    '.kol{position:absolute;inset:0;display:flex;flex-direction:column;font-family:' + FONT + ';color:' + INK + ';background:#fdf6ec;overflow:hidden}',
    '.kol button{font-family:inherit;color:' + INK + ';-webkit-tap-highlight-color:transparent}',
    '.kol svg{display:block}',
    '.kol-defs{position:absolute;width:0;height:0;overflow:hidden;pointer-events:none}',
    /* menu */
    '.kol-menu{flex:1;min-height:0;overflow-y:auto;touch-action:pan-y;-webkit-overflow-scrolling:touch;padding:12px max(12px,env(safe-area-inset-left,0px)) calc(24px + env(safe-area-inset-bottom,0px))}',
    '.kol-in{max-width:1100px;margin:0 auto}',
    '.kol-tabs{display:flex;gap:8px;margin-bottom:12px}',
    '.kol-tab{flex:1;min-height:48px;border:3px solid ' + INK + ';border-radius:16px;background:#fff;font-size:1.3rem;box-shadow:0 3px 0 rgba(29,47,111,.2)}',
    '.kol-tab.on{background:#ffe9a8}',
    '.kol-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:12px}',
    '.kol-card{position:relative;background:#fff;border:3px solid ' + INK + ';border-radius:18px;padding:0;overflow:hidden;display:flex;flex-direction:column;text-align:left;box-shadow:0 4px 0 rgba(29,47,111,.2)}',
    '.kol-card:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(29,47,111,.2)}',
    '.kol-card>svg{width:100%;height:auto;aspect-ratio:1;border-bottom:3px solid ' + INK + '}',
    '.kol-card.lock>svg{filter:grayscale(1);opacity:.55}',
    '.kol-card .nm{padding:5px 9px 7px;font-size:1.15rem;line-height:1.1;display:flex;justify-content:space-between;gap:6px;align-items:baseline}',
    '.kol-card .nm small{color:' + MUTED + ';font-size:.95rem;white-space:nowrap}',
    '.kol-card .nm b{font-weight:400;color:' + GOLD + ';white-space:nowrap}',
    '.kol-badge{position:absolute;top:8px;right:8px;background:#fff;border:2.5px solid ' + INK + ';border-radius:999px;padding:1px 10px 1px 6px;font-size:1.1rem;display:flex;align-items:center;gap:2px}',
    '.kol-badge svg{width:22px;height:22px}',
    '.kol-badge.ok{background:#2a8a56;color:#fff;border-color:#2a8a56;padding:2px}',
    '.kol-badge.ok svg{stroke:#fff}',
    '.kol-empty{text-align:center;color:' + MUTED + ';font-size:1.25rem;padding:30px 10px}',
    '.kol-note{color:' + MUTED + ';font-size:1.05rem;margin:14px 2px 0;text-align:center}',
    /* editor */
    '.kol-ed{flex:1;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;grid-template-columns:minmax(0,1fr)}',
    '.kol-top{display:flex;align-items:center;gap:6px;padding:6px 8px;background:#fff;border-bottom:3px solid ' + INK + '}',
    '.kol-ib{width:44px;height:44px;flex:none;border:2.5px solid ' + INK + ';border-radius:14px;background:#fff;padding:5px;display:flex;align-items:center;justify-content:center}',
    '.kol-ib svg{width:28px;height:28px}',
    '.kol-ib[disabled]{opacity:.35}',
    '.kol-tt{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}',
    '.kol-tt b{font-weight:400;font-size:1.15rem;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.kol-bar{height:10px;border:2px solid ' + LVL + ';border-radius:8px;background:rgba(122,79,196,.13);overflow:hidden}',
    '.kol-bar i{display:block;height:100%;width:0;background:' + LVL + ';transition:width .3s}',
    '.kol-done{height:44px;flex:none;border:3px solid ' + INK + ';border-radius:14px;background:' + GOLD + ';color:#2a1d00 !important;font-size:1.2rem;padding:0 10px 0 6px;display:flex;align-items:center;gap:3px;box-shadow:0 3px 0 ' + INK + '}',
    '.kol-done svg{width:24px;height:24px}',
    '.kol-done:active{transform:translateY(2px);box-shadow:0 1px 0 ' + INK + '}',
    '.kol-done.pulse{animation:kolpulse 1s ease-in-out infinite}',
    '@keyframes kolpulse{50%{transform:scale(1.1)}}',
    '.kol-area{position:relative;min-height:0;overflow:hidden;touch-action:none;background:#efe6d6}',
    '.kol-area>svg{position:absolute;inset:0;width:100%;height:100%}',
    '.kol-zoom{position:absolute;right:8px;bottom:6px;display:flex;gap:6px}',
    '.kol-zoom .kol-ib{box-shadow:0 2px 0 rgba(29,47,111,.3)}',
    '.kol-ctrl{background:#fff;border-top:3px solid ' + INK + ';padding:6px 8px calc(6px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:6px}',
    '.kol-tools{display:flex;gap:6px;align-items:center}',
    '.kol-tool{flex:1;min-width:0;height:46px;border:2.5px solid ' + INK + ';border-radius:14px;background:#fff;font-size:1.05rem;display:flex;align-items:center;justify-content:center;gap:3px;padding:0 4px}',
    '.kol-tool svg{width:26px;height:26px;flex:none}',
    '.kol-tool.on{background:#ffe9a8;box-shadow:inset 0 0 0 2px ' + GOLD + '}',
    '.kol-sizes{display:flex;gap:2px;flex:none}',
    '@media (max-width:400px){.kol-tool{flex-direction:column;gap:0;font-size:.9rem;line-height:1}.kol-tool svg{width:22px;height:22px}.kol-size{width:30px}.kol-done{font-size:1.1rem;padding:0 8px 0 4px}.kol-top{gap:5px;padding:6px}}',
    '.kol-size{width:34px;height:46px;border:0;background:none;display:flex;align-items:center;justify-content:center;padding:0;border-radius:10px}',
    '.kol-size i{display:block;border-radius:50%;background:' + INK + '}',
    '.kol-size.on{background:#ffe9a8}',
    '.kol-pats{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}',
    '.kol-pat{height:42px;border:2.5px solid ' + INK + ';border-radius:12px;padding:0;overflow:hidden;background:#fff}',
    '.kol-pat svg{width:100%;height:100%}',
    '.kol-pat.on{box-shadow:0 0 0 3px ' + GOLD + ';border-color:' + INK + '}',
    '.kol-pal{display:grid;grid-template-columns:repeat(auto-fill,minmax(35px,1fr));gap:5px}',
    '.kol-sw{height:38px;border:2.5px solid ' + INK + ';border-radius:50%;padding:0;position:relative}',
    '.kol-sw.on{box-shadow:0 0 0 3px #fff,0 0 0 6px ' + INK + '}',
    '.kol-sw.on::after{content:"";position:absolute;inset:11px;border-radius:50%;background:#fff;border:2px solid ' + INK + '}',
    '@media (min-width:720px) and (min-aspect-ratio:5/4){.kol-ed{grid-template-columns:minmax(0,1fr) 360px;grid-template-rows:auto minmax(0,1fr)}.kol-top{grid-column:1/3}.kol-ctrl{border-top:0;border-left:3px solid ' + INK + ';overflow-y:auto}.kol-tool{flex-direction:column;gap:0;font-size:.9rem;line-height:1}.kol-tool svg{width:22px;height:22px}}',
    /* gallery viewer, confetti */
    '.kol-view{position:absolute;inset:0;z-index:15;background:rgba(29,47,111,.4);display:flex;align-items:center;justify-content:center;padding:16px}',
    '.kol-vcard{background:#fff;border:3px solid ' + INK + ';border-radius:22px;padding:14px;width:100%;max-width:440px;display:flex;flex-direction:column;gap:10px;align-items:stretch}',
    '.kol-vcard>svg{width:100%;height:auto;aspect-ratio:1;border:3px solid ' + INK + ';border-radius:12px}',
    '.kol-vcard h3{margin:0;font-weight:400;font-size:1.5rem;text-align:center}',
    '.kol-vrow{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}',
    '.kol-vrow .ng-btn{font-size:1.2rem;padding:6px 14px}',
    '.kol-conf{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:12}',
    '.kol-conf i{position:absolute;top:-20px;width:10px;height:14px;border-radius:3px;animation:kolfall 1.7s ease-in forwards}',
    '@keyframes kolfall{to{transform:translate(var(--dx),110vh) rotate(720deg)}}',
    '.kol-flash{animation:kolflash .3s ease-out}',
    '@keyframes kolflash{from{opacity:.35}to{opacity:1}}',
    '@media (prefers-reduced-motion:reduce){.kol-done.pulse,.kol-flash{animation:none}}'
  ].join('\n');

  NG.register('kolorowanka', {
    meta: {
      name: 'Kolorowanka', price: '2 obrazki gratis', bg: '#fdeef4', music: 'calm',
      pic: '<rect x="10" y="8" width="66" height="58" rx="6" fill="#fff" stroke="#1d2f6f" stroke-width="2.5"/>' +
        '<path d="M43 46v14" stroke="#1d2f6f" stroke-width="2"/><path d="M43 54q8-8 14-4q-6 8-14 4z" fill="#3fae5f" stroke="#1d2f6f" stroke-width="1.6"/>' +
        '<g stroke="#1d2f6f" stroke-width="1.8"><ellipse cx="43" cy="22" rx="6" ry="9" fill="#f7a8c8"/><ellipse cx="55" cy="31" rx="9" ry="6" fill="#f7a8c8"/><ellipse cx="31" cy="31" rx="9" ry="6" fill="#fff"/><ellipse cx="50" cy="42" rx="6" ry="8" transform="rotate(-35 50 42)" fill="#e8459a"/><ellipse cx="36" cy="42" rx="6" ry="8" transform="rotate(35 36 42)" fill="#fff"/></g>' +
        '<circle cx="43" cy="33" r="6" fill="#f9c623" stroke="#1d2f6f" stroke-width="2"/>' +
        '<g transform="rotate(-22 92 42)" stroke="#1d2f6f" stroke-width="2" stroke-linejoin="round"><path d="M87 30l3 -9h4l3 9z" fill="#2c5fb0"/><rect x="87" y="30" width="10" height="32" rx="1.5" fill="#3f86d8"/><path d="M87 36h10M87 56h10" stroke-width="1.6"/></g><g transform="rotate(18 108 42)" stroke="#1d2f6f" stroke-width="2" stroke-linejoin="round"><path d="M103 30l3 -9h4l3 9z" fill="#b33a28"/><rect x="103" y="30" width="10" height="32" rx="1.5" fill="#e2533f"/><path d="M103 36h10M103 56h10" stroke-width="1.6"/></g>' +
        '<path d="M84 66q8-5 16 0t16 0" fill="none" stroke="#e8459a" stroke-width="2.5" stroke-linecap="round"/>' +
        '<path d="M18 16l2 5l5 1l-4 3l1 5l-4-3l-4 3l1-5l-4-3l5-1z" fill="#e3a008"/>'
    },
    medals: [
      { id: 'b', stat: 'done', at: 1, tier: 1, text: 'Pierwszy obrazek' },
      { id: 's', stat: 'done', at: 8, tier: 2, text: '8 obrazków' },
      { id: 'g', stat: 'done', at: 20, tier: 3, text: '20 obrazków' }
    ],
    quests: [
      { id: 'pic', stat: 'done', n: [1, 2], text: 'Pokoloruj {n} {obrazek} w Kolorowance', forms: ['obrazek', 'obrazki', 'obrazków'] },
      { id: 'fills', stat: 'fills', n: [20, 30], text: 'Pomaluj {n} {pól} w Kolorowance', forms: ['pole', 'pola', 'pól'] }
    ],
    stickers: [
      { id: 'first', emoji: '🖍️', name: 'Pierwszy obrazek w galerii' },
      { id: 'rainbow', emoji: '🌈', name: 'Tęczowe pole' },
      { id: 'brush', emoji: '🖌️', name: 'Pędzel w ruch' },
      { id: 'buy', emoji: '🖼️', name: 'Nowy obrazek' },
      { id: 'all', emoji: '👑', name: 'Wszystkie obrazki' }
    ],
    _test: { PICS: PICS, items: items, nRegions: nRegions, encStroke: encStroke, decStroke: decStroke },

    mount: function (el, ctx) {
      var state = ctx.load({ own: [], work: {}, gal: [], fin: {} });
      if (!Array.isArray(state.own)) state.own = [];
      if (!Array.isArray(state.gal)) state.gal = [];
      if (!state.work || typeof state.work !== 'object') state.work = {};
      if (!state.fin || typeof state.fin !== 'object') state.fin = {};
      // cnt[pic] = colours of the last finish that counted as a new picture ('done' stat, quest).
      // Finishing again counts only after "Od nowa" or when most fields changed since then.
      if (!state.cnt || typeof state.cnt !== 'object') {
        state.cnt = {};
        state.gal.forEach(function (g) { if (g && state.fin[g.p] && typeof g.c === 'string') state.cnt[g.p] = g.c; });
      }
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      var root = document.createElement('div');
      root.className = 'kol';
      var css = document.createElement('style');
      css.textContent = CSS;
      root.appendChild(css);
      var defsSvg = document.createElementNS(SVGNS, 'svg');
      defsSvg.setAttribute('class', 'kol-defs');
      defsSvg.setAttribute('aria-hidden', 'true');
      var defs = document.createElementNS(SVGNS, 'defs');
      defsSvg.appendChild(defs);
      root.appendChild(defsSvg);
      el.appendChild(root);
      DEFS = defs; made = {};
      ensureBase();

      var view = null;            // current screen node
      var panel = null, overlay = null, saveT = 0, confT = 0, alive = true, ro = null;
      var ed = null;              // editor state
      var tool = 'fill', pat = 0, col = 0, size = 1;
      var SIZES = [5, 11, 22];

      function owned(p) { return p.idx < FREE || state.own.indexOf(p.id) >= 0; }
      function workOf(p) {
        var w = state.work[p.id] || {};
        return { c: fixColors(p, w.c), s: (Array.isArray(w.s) ? w.s : []).map(decStroke).filter(Boolean) };
      }
      function persist() {
        clearTimeout(saveT); saveT = 0;
        if (ed) state.work[ed.p.id] = { c: ed.colors, s: ed.strokes.map(encStroke) };
        ctx.save(state);
      }
      function saveSoon() { clearTimeout(saveT); saveT = setTimeout(persist, 400); }
      function closePanel() { if (panel) { panel.close(); panel = null; } }
      function showPanel(o) { closePanel(); panel = ctx.panel(o); return panel; }
      function closeOverlay() { if (overlay) { overlay.remove(); overlay = null; } }
      function setView(node) {
        closeOverlay();
        [].forEach.call(root.querySelectorAll('.kol-conf'), function (c) { c.remove(); });
        if (ro) { ro.disconnect(); ro = null; }
        if (view) view.remove();
        view = node; root.appendChild(node);
      }

      // =====================================================================
      // Menu: pictures + gallery
      // =====================================================================
      var tab = 'pics';
      function showMenu(which) {
        if (ed) { persist(); ed = null; }
        tab = which || tab;
        var m = document.createElement('div');
        m.className = 'kol-menu';
        var inner = document.createElement('div'); inner.className = 'kol-in';
        m.appendChild(inner);
        var tabs = document.createElement('div'); tabs.className = 'kol-tabs';
        [['pics', 'Obrazki'], ['gal', 'Galeria · ' + state.gal.length]].forEach(function (t) {
          var b = document.createElement('button'); b.type = 'button';
          b.className = 'kol-tab' + (tab === t[0] ? ' on' : '');
          b.textContent = t[1];
          b.onclick = function () { if (tab !== t[0]) { ctx.sfx('click'); showMenu(t[0]); } };
          tabs.appendChild(b);
        });
        inner.appendChild(tabs);
        var grid = document.createElement('div'); grid.className = 'kol-grid';
        inner.appendChild(grid);
        if (tab === 'pics') {
          PICS.forEach(function (p) {
            var own = owned(p), w = own ? workOf(p) : { c: blank(p), s: [] };
            var b = document.createElement('button'); b.type = 'button';
            b.className = 'kol-card' + (own ? '' : ' lock');
            b.setAttribute('data-pic', p.id);
            var n = nRegions(p), done = colored(w.c);
            b.innerHTML = svgHTML(p, w.c, w.s, 'aria-hidden="true"') +
              (own ? (state.fin[p.id] ? '<span class="kol-badge ok">' + ICON.check + '</span>' : '') : '<span class="kol-badge">' + ICON.lock + PRICE + ' ★</span>') +
              '<span class="nm"><span></span>' + (own ? '<small>' + done + '/' + n + '</small>' : '<b>' + PRICE + ' ★</b>') + '</span>';
            b.querySelector('.nm span').textContent = p.name;
            b.onclick = function () { if (own) { ctx.sfx('open'); openEditor(p); } else askBuy(p); };
            grid.appendChild(b);
          });
          var note = document.createElement('p'); note.className = 'kol-note';
          note.textContent = 'Kupiony obrazek jest twój na zawsze. Możesz go kolorować ile chcesz.';
          inner.appendChild(note);
        } else {
          if (!state.gal.length) {
            var e = document.createElement('p'); e.className = 'kol-empty';
            e.textContent = 'Galeria jest pusta. Pokoloruj obrazek i naciśnij „Gotowe”.';
            inner.appendChild(e);
          }
          state.gal.slice().reverse().forEach(function (g) {
            var p = PB[g.p]; if (!p) return;
            var b = document.createElement('button'); b.type = 'button'; b.className = 'kol-card';
            b.innerHTML = svgHTML(p, fixColors(p, g.c), (g.s || []).map(decStroke).filter(Boolean), 'aria-hidden="true"') + '<span class="nm"><span></span><small>' + (g.d || '').slice(5).split('-').reverse().join('.') + '</small></span>';
            b.querySelector('.nm span').textContent = p.name;
            b.onclick = function () { ctx.sfx('open'); openGal(g); };
            grid.appendChild(b);
          });
        }
        setView(m);
      }

      function askBuy(p) {
        ctx.sfx('tap');
        showPanel({
          title: p.name,
          lines: ['Kup ten obrazek do kolorowania.', { text: 'Będzie twój na zawsze.', muted: true }],
          price: PRICE, button: 'Kup', note: 'obrazek ' + p.name,
          onPlay: function () {
            panel = null;
            if (state.own.indexOf(p.id) < 0) state.own.push(p.id);
            persist();
            ctx.sfx('buy');
            ctx.sticker('buy');
            var cnt = PICS.filter(owned).length;
            ctx.stat('owned', cnt, 'max');
            if (cnt === PICS.length) ctx.sticker('all');
            openEditor(p);
          },
          secondary: [{ label: 'Nie teraz', onClick: function () { panel = null; } }]
        });
      }

      function openGal(g) {
        var p = PB[g.p];
        closeOverlay();
        var o = document.createElement('div'); o.className = 'kol-view';
        var c = document.createElement('div'); c.className = 'kol-vcard';
        o.appendChild(c);
        c.innerHTML = '<h3></h3>' + svgHTML(p, fixColors(p, g.c), (g.s || []).map(decStroke).filter(Boolean), 'aria-hidden="true"') + '<div class="kol-vrow"></div>';
        c.querySelector('h3').textContent = p.name;
        var row = c.querySelector('.kol-vrow');
        function btn(label, cls, fn) { var b = document.createElement('button'); b.type = 'button'; b.className = 'ng-btn' + (cls ? ' ' + cls : ''); b.textContent = label; b.onclick = fn; row.appendChild(b); return b; }
        btn('Maluj dalej', '', function () {
          var prev = workOf(p), gc = fixColors(p, g.c), gs = (g.s || []).slice();
          function take() {
            state.work[p.id] = { c: gc, s: gs };
            ctx.sfx('open');
            openEditor(p, { t: 'all', colors: prev.c, strokes: prev.s });
          }
          closeOverlay();
          var blankNow = !colored(prev.c) && !prev.s.length;
          if (blankNow || (prev.c === gc && prev.s.map(encStroke).join('|') === gs.join('|'))) { take(); return; }
          // the working copy has other colours: don't overwrite it without asking
          ctx.sfx('tap');
          showPanel({
            title: 'Zamienić malowanie?', lines: ['Ten obrazek ma teraz inne kolory niż w galerii.', { text: 'Zamienić je na wersję z galerii, czy malować dalej swoje?', muted: true }],
            button: 'Wersja z galerii',
            onPlay: function () { panel = null; take(); },
            secondary: [
              { label: 'Moje malowanie', onClick: function () { panel = null; ctx.sfx('open'); openEditor(p); } },
              { label: 'Nie', onClick: function () { panel = null; } }
            ]
          });
        });
        var del = btn('Usuń', 'sec', function () {
          if (!del.dataset.sure) { del.dataset.sure = '1'; del.textContent = 'Na pewno usunąć?'; ctx.sfx('tap'); return; }
          var i = state.gal.indexOf(g);
          if (i >= 0) state.gal.splice(i, 1);
          persist(); ctx.sfx('close');
          showMenu('gal');
        });
        btn('Zamknij', 'sec', function () { ctx.sfx('close'); closeOverlay(); });
        o.addEventListener('pointerdown', function (e) { if (e.target === o) { ctx.sfx('close'); closeOverlay(); } });
        root.appendChild(o);
        overlay = o;
      }

      // =====================================================================
      // Editor
      // =====================================================================
      function openEditor(p, undoFirst) {
        closePanel();
        var w = workOf(p);
        ed = { p: p, colors: w.c, strokes: w.s, undo: [], regionEls: [], strokeEls: [], n: nRegions(p), cheered: false };
        if (undoFirst) ed.undo.push(undoFirst);
        var box = document.createElement('div'); box.className = 'kol-ed';
        box.innerHTML =
          '<div class="kol-top">' +
            '<button type="button" class="kol-ib" data-a="back" aria-label="Wróć do obrazków">' + ICON.back + '</button>' +
            '<div class="kol-tt"><b></b><span class="kol-bar"><i></i></span></div>' +
            '<button type="button" class="kol-ib" data-a="clear" aria-label="Od nowa">' + ICON.trash + '</button>' +
            '<button type="button" class="kol-ib" data-a="undo" aria-label="Cofnij">' + ICON.undo + '</button>' +
            '<button type="button" class="kol-done" data-a="done">' + ICON.check + 'Gotowe</button>' +
          '</div>' +
          '<div class="kol-area">' + svgHTML(p, ed.colors, ed.strokes, 'class="kol-pic"', 'kol-me-' + p.id) +
            '<div class="kol-zoom"><button type="button" class="kol-ib" data-a="zin" aria-label="Powiększ">' + ICON.plus + '</button>' +
            '<button type="button" class="kol-ib" data-a="zout" aria-label="Pomniejsz">' + ICON.minus + '</button>' +
            '<button type="button" class="kol-ib" data-a="zfit" aria-label="Cały obrazek">' + ICON.fit + '</button></div>' +
          '</div>' +
          '<div class="kol-ctrl">' +
            '<div class="kol-tools">' +
              '<button type="button" class="kol-tool" data-tool="fill">' + ICON.fill + 'Wypełnij</button>' +
              '<button type="button" class="kol-tool" data-tool="brush">' + ICON.brush + 'Pędzel</button>' +
              '<button type="button" class="kol-tool" data-tool="erase">' + ICON.erase + 'Gumka</button>' +
              '<span class="kol-sizes">' + SIZES.map(function (s, i) { return '<button type="button" class="kol-size" data-size="' + i + '" aria-label="Grubość ' + (i + 1) + '"><i style="width:' + (6 + i * 7) + 'px;height:' + (6 + i * 7) + 'px"></i></button>'; }).join('') + '</span>' +
            '</div>' +
            '<div class="kol-pats"></div>' +
            '<div class="kol-pal"></div>' +
          '</div>';
        box.querySelector('.kol-tt b').textContent = p.name;
        setView(box);
        ed.box = box;
        ed.area = box.querySelector('.kol-area');
        ed.svg = ed.area.querySelector('svg');
        ed.brushG = ed.svg.querySelector('.kb');
        [].forEach.call(ed.svg.querySelectorAll('[data-r]'), function (e) { ed.regionEls[+e.getAttribute('data-r')] = e; });
        ed.strokeEls = [].slice.call(ed.brushG.children);
        ed.bar = box.querySelector('.kol-bar i');
        ed.doneBtn = box.querySelector('.kol-done');
        ed.undoBtn = box.querySelector('[data-a="undo"]');
        ed.mask = defs.querySelector('#kol-me-' + p.id);
        ed.view = { z: 1, cx: 200, cy: 200, k: 1, W: 0, H: 0, sx: 0, sy: 0 };

        // palette + patterns
        var pal = box.querySelector('.kol-pal');
        PAL.forEach(function (c, i) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'kol-sw'; b.style.background = c;
          b.setAttribute('aria-label', 'Kolor ' + (i + 1)); b.dataset.col = i;
          b.onclick = function () { col = i; if (pat === RB) pat = 0; ctx.sfx('pop'); syncCtrl(); };
          pal.appendChild(b);
        });
        var pats = box.querySelector('.kol-pats');
        PATS.forEach(function (name, i) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'kol-pat';
          b.setAttribute('aria-label', 'Wzór: ' + name); b.dataset.pat = i;
          b.onclick = function () { pat = i; ctx.sfx('pop'); syncCtrl(); };
          pats.appendChild(b);
        });
        [].forEach.call(box.querySelectorAll('[data-tool]'), function (b) {
          b.onclick = function () { tool = b.dataset.tool; ctx.sfx('click'); syncCtrl(); };
        });
        [].forEach.call(box.querySelectorAll('[data-size]'), function (b) {
          b.onclick = function () { size = +b.dataset.size; if (tool === 'fill') tool = 'brush'; ctx.sfx('click'); syncCtrl(); };
        });
        box.querySelector('[data-a="back"]').onclick = function () { ctx.sfx('close'); showMenu('pics'); };
        box.querySelector('[data-a="undo"]').onclick = undo;
        box.querySelector('[data-a="clear"]').onclick = askClear;
        ed.doneBtn.onclick = finish;
        box.querySelector('[data-a="zin"]').onclick = function () { zoomBy(1.6); ctx.sfx('tap'); };
        box.querySelector('[data-a="zout"]').onclick = function () { zoomBy(1 / 1.6); ctx.sfx('tap'); };
        box.querySelector('[data-a="zfit"]').onclick = function () { ed.view.z = 1; ed.view.cx = 200; ed.view.cy = 200; applyView(); ctx.sfx('tap'); };

        var a = ed.area;
        a.addEventListener('pointerdown', onDown);
        a.addEventListener('pointermove', onMove);
        a.addEventListener('pointerup', onUp);
        a.addEventListener('pointercancel', onCancel);
        a.addEventListener('wheel', onWheel, { passive: false });
        ro = new ResizeObserver(function () { measure(); });
        ro.observe(a);
        measure();
        syncCtrl();
        syncProgress();
      }

      function curCode() { return codeChar(pat, col); }
      function syncCtrl() {
        if (!ed) return;
        var box = ed.box;
        [].forEach.call(box.querySelectorAll('[data-tool]'), function (b) { b.classList.toggle('on', b.dataset.tool === tool); });
        [].forEach.call(box.querySelectorAll('[data-size]'), function (b) { b.classList.toggle('on', +b.dataset.size === size && tool !== 'fill'); });
        [].forEach.call(box.querySelectorAll('[data-col]'), function (b) { b.classList.toggle('on', +b.dataset.col === col && pat !== RB); });
        [].forEach.call(box.querySelectorAll('[data-pat]'), function (b) {
          var i = +b.dataset.pat;
          b.classList.toggle('on', i === pat);
          b.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" fill="' + fillOf(codeChar(i, col)) + '"/></svg>';
        });
      }
      function syncProgress() {
        var n = colored(ed.colors);
        ed.bar.style.width = (n / ed.n * 100).toFixed(1) + '%';
        ed.undoBtn.disabled = !ed.undo.length;
        var full = n === ed.n;
        ed.doneBtn.classList.toggle('pulse', full && state.fin[ed.p.id] !== sigOf(ed.colors, ed.strokes.map(encStroke)));
        if (full && !ed.cheered) { ed.cheered = true; ctx.sfx('star'); ctx.toast('Wszystko pokolorowane! Naciśnij „Gotowe”.'); }
        if (!full) ed.cheered = false;
      }

      // ---------- view (zoom / pan) ----------
      function measure() {
        if (!ed) return;
        var r = ed.area.getBoundingClientRect();
        var v = ed.view;
        v.W = r.width; v.H = r.height;
        var reserve = Math.max(0, Math.min(54, r.height - r.width * 0.97)), hu = r.height - reserve;
        v.k = Math.max(0.1, Math.min(r.width, hu) / 400 * 0.97);
        v.sx = r.width / 2; v.sy = hu / 2;
        applyView();
      }
      function vb() { var v = ed.view; return { w: v.W / (v.k * v.z), h: v.H / (v.k * v.z) }; }
      function clampView() {
        var v = ed.view, s = vb();
        v.z = Math.max(1, Math.min(ZMAX, v.z));
        var u = v.k * v.z, lo = Math.min(v.sx / u, 200), hi = Math.max(400 - (v.W - v.sx) / u, 200);
        v.cx = Math.max(lo, Math.min(hi, v.cx));
        lo = Math.min(v.sy / u, 200); hi = Math.max(400 - (v.H - v.sy) / u, 200);
        v.cy = Math.max(lo, Math.min(hi, v.cy));
      }
      function applyView() {
        if (!ed || !ed.view.W) return;
        clampView();
        var v = ed.view, s = vb();
        if (ed.mask) ed.mask.style.setProperty('--zs', (1 / Math.pow(v.z, 0.6)).toFixed(3));
        ed.svg.setAttribute('viewBox', f(v.cx - v.sx / (v.k * v.z)) + ' ' + f(v.cy - v.sy / (v.k * v.z)) + ' ' + f(s.w) + ' ' + f(s.h));
      }
      function toPic(cx, cy) {
        var v = ed.view, r = ed.area.getBoundingClientRect(), u = v.k * v.z;
        return { x: v.cx + (cx - r.left - v.sx) / u, y: v.cy + (cy - r.top - v.sy) / u };
      }
      function zoomAt(z, clientX, clientY) {
        var v = ed.view, r = ed.area.getBoundingClientRect(), p = toPic(clientX, clientY);
        v.z = Math.max(1, Math.min(ZMAX, z));
        v.cx = p.x - (clientX - r.left - v.sx) / (v.k * v.z);
        v.cy = p.y - (clientY - r.top - v.sy) / (v.k * v.z);
        applyView();
      }
      function zoomBy(m) { var r = ed.area.getBoundingClientRect(); zoomAt(ed.view.z * m, r.left + ed.view.sx, r.top + ed.view.sy); }
      function onWheel(e) { e.preventDefault(); zoomAt(ed.view.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY); }

      // ---------- pointer gestures ----------
      var ptrs = {}, gst = null;
      function nPtr() { return Object.keys(ptrs).length; }
      function pinchInfo() {
        var k = Object.keys(ptrs), a = ptrs[k[0]], b = ptrs[k[1]];
        return { d: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      }
      function onDown(e) {
        if (e.target.closest('.kol-zoom') || (e.button && e.button > 0)) return;
        e.preventDefault();
        try { ed.area.setPointerCapture(e.pointerId); } catch (er) {}
        ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
        var n = nPtr();
        if (n === 1) {
          gst = { mode: 'one', sx: e.clientX, sy: e.clientY, moved: false, panned: false, c0x: ed.view.cx, c0y: ed.view.cy, stroke: null, erased: [] };
          if (tool === 'brush') startStroke(e);
          else if (tool === 'erase') eraseAt(e.clientX, e.clientY, true);
        } else if (n === 2 && gst) {
          if (gst.stroke) cancelStroke();
          if (gst.erased.length) commitErase();
          var pi = pinchInfo(), p = toPic(pi.x, pi.y);
          gst = { mode: 'pinch', z0: ed.view.z, d0: pi.d, px: p.x, py: p.y };
        }
      }
      function onMove(e) {
        if (!ptrs[e.pointerId] || !gst) return;
        ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
        if (gst.mode === 'pinch') {
          if (nPtr() < 2) return;
          var pi = pinchInfo(), v = ed.view, r = ed.area.getBoundingClientRect();
          v.z = Math.max(1, Math.min(ZMAX, gst.z0 * pi.d / gst.d0));
          v.cx = gst.px - (pi.x - r.left - v.sx) / (v.k * v.z);
          v.cy = gst.py - (pi.y - r.top - v.sy) / (v.k * v.z);
          applyView();
          return;
        }
        if (gst.mode !== 'one') return;
        var dx = e.clientX - gst.sx, dy = e.clientY - gst.sy;
        if (!gst.moved && dx * dx + dy * dy > 64) gst.moved = true;
        if (tool === 'brush') { if (gst.stroke) addPoint(e.clientX, e.clientY); }
        else if (tool === 'erase') eraseAt(e.clientX, e.clientY, false);
        else if (gst.moved && ed.view.z > 1.01) {
          gst.panned = true;
          ed.view.cx = gst.c0x - dx / (ed.view.k * ed.view.z);
          ed.view.cy = gst.c0y - dy / (ed.view.k * ed.view.z);
          applyView();
        }
      }
      function onUp(e) {
        if (!ptrs[e.pointerId]) return;
        delete ptrs[e.pointerId];
        if (!gst) return;
        if (gst.mode === 'pinch') { gst = nPtr() ? { mode: 'wait' } : null; return; }
        if (gst.mode === 'wait') { if (!nPtr()) gst = null; return; }
        if (tool === 'brush') { if (gst.stroke) endStroke(); }
        else if (tool === 'erase') { if (gst.erased.length) commitErase(); else if (!gst.moved) tapRegion(gst.sx, gst.sy, true); }
        else if (!gst.panned) {
          var dx = e.clientX - gst.sx, dy = e.clientY - gst.sy;
          if (dx * dx + dy * dy < 900) tapRegion(gst.sx, gst.sy, false);
        }
        gst = null;
      }
      function onCancel(e) {
        delete ptrs[e.pointerId];
        if (gst && gst.mode === 'one') { if (gst.stroke) endStroke(); if (gst.erased.length) commitErase(); }
        if (!nPtr()) gst = null;
      }

      // ---------- fill / erase regions ----------
      function regionAt(x, y) {
        var t = document.elementFromPoint(x, y);
        if (!t || !ed.svg.contains(t)) return -1;
        var r = t.getAttribute && t.getAttribute('data-r');
        return r == null ? -1 : +r;
      }
      function setRegion(i, ch) {
        ed.colors = ed.colors.slice(0, i) + ch + ed.colors.slice(i + 1);
        var e = ed.regionEls[i];
        e.setAttribute('fill', fillOf(ch));
        if (!reduce) { e.classList.remove('kol-flash'); void e.getBoundingClientRect(); e.classList.add('kol-flash'); }
      }
      function tapRegion(x, y, erase) {
        var i = regionAt(x, y);
        if (i < 0) return;
        var prev = ed.colors.charAt(i), next = erase ? '.' : curCode();
        if (prev === next) { ctx.sfx('tap'); return; }
        pushUndo({ t: 'f', i: i, prev: prev, next: next });
        setRegion(i, next);
        ctx.sfx(erase ? 'pop' : 'paint');
        if (!erase) {
          ctx.stat('fills', 1);
          if (pat === RB) ctx.sticker('rainbow');
        }
        changed();
      }
      function pushUndo(u) { ed.undo.push(u); if (ed.undo.length > 80) ed.undo.shift(); }
      function changed() { syncProgress(); saveSoon(); }

      // ---------- brush ----------
      function startStroke(e) {
        if (countPts(ed.strokes) >= MAXPTS) { ctx.sfx('error'); ctx.toast('Za dużo kresek. Użyj gumki albo cofnij.'); return; }
        var p = toPic(e.clientX, e.clientY), w = Math.max(1.5, SIZES[size] / Math.sqrt(ed.view.z));
        var s = { c: curCode(), w: Math.round(w * 2) / 2, pts: [cl(p.x), cl(p.y)] };
        var pe = document.createElementNS(SVGNS, 'path');
        pe.setAttribute('stroke', fillOf(s.c, true));
        pe.setAttribute('stroke-width', s.w);
        pe.setAttribute('d', strokeD(s.pts));
        ed.brushG.appendChild(pe);
        gst.stroke = { s: s, el: pe };
        ctx.sfx('paint');
      }
      function cl(v) { return Math.round(Math.max(0, Math.min(400, v)) * 2) / 2; }
      function addPoint(x, y) {
        var st = gst.stroke, p = toPic(x, y), pts = st.s.pts, lx = pts[pts.length - 2], ly = pts[pts.length - 1];
        var nx = cl(p.x), ny = cl(p.y);
        if (Math.hypot(nx - lx, ny - ly) < 2 / ed.view.z + 0.5) return;
        if (pts.length / 2 > 600) return;
        pts.push(nx, ny);
        st.el.setAttribute('d', strokeD(pts));
      }
      function endStroke() {
        var st = gst.stroke; gst.stroke = null;
        ed.strokes.push(st.s); ed.strokeEls.push(st.el);
        pushUndo({ t: 's', s: st.s });
        ctx.sticker('brush');
        changed();
      }
      function cancelStroke() { gst.stroke.el.remove(); gst.stroke = null; }
      function eraseAt(x, y, first) {
        var p = toPic(x, y), rr = 12 / ed.view.z, hit = false;
        for (var i = ed.strokes.length - 1; i >= 0; i--) {
          var s = ed.strokes[i], lim = rr + s.w / 2, pts = s.pts;
          for (var j = 0; j < pts.length; j += 2) {
            if (Math.abs(pts[j] - p.x) <= lim && Math.abs(pts[j + 1] - p.y) <= lim && Math.hypot(pts[j] - p.x, pts[j + 1] - p.y) <= lim) {
              gst.erased.push({ s: s, i: i });
              ed.strokeEls[i].remove();
              ed.strokes.splice(i, 1); ed.strokeEls.splice(i, 1);
              hit = true;
              break;
            }
          }
        }
        if (hit) { ctx.sfx(first ? 'pop' : 'tick'); syncProgress(); }
      }
      function commitErase() {
        pushUndo({ t: 'e', list: gst.erased.slice() });
        gst.erased = [];
        changed();
      }
      function rebuildStrokes() {
        ed.brushG.innerHTML = ed.strokes.map(strokeHTML).join('');
        ed.strokeEls = [].slice.call(ed.brushG.children);
      }

      // ---------- undo / clear ----------
      function undo() {
        if (!ed || !ed.undo.length) return;
        var u = ed.undo.pop();
        if (u.t === 'f') setRegion(u.i, u.prev);
        else if (u.t === 's') {
          var i = ed.strokes.lastIndexOf(u.s);
          if (i >= 0) { ed.strokes.splice(i, 1); ed.strokeEls[i].remove(); ed.strokeEls.splice(i, 1); }
        } else if (u.t === 'e') {
          u.list.slice().reverse().forEach(function (x) { ed.strokes.splice(Math.min(x.i, ed.strokes.length), 0, x.s); });
          rebuildStrokes();
        } else if (u.t === 'all') {
          if (u.cnt) { if (u.cnt.v) state.cnt[ed.p.id] = u.cnt.v; else delete state.cnt[ed.p.id]; }
          ed.colors = u.colors; ed.strokes = u.strokes.slice();
          for (var r = 0; r < ed.n; r++) ed.regionEls[r].setAttribute('fill', fillOf(ed.colors.charAt(r)));
          rebuildStrokes();
        }
        ctx.sfx('swap');
        changed();
      }
      function askClear() {
        ctx.sfx('tap');
        if (!colored(ed.colors) && !ed.strokes.length) { ctx.toast('Obrazek jest jeszcze czysty.'); return; }
        showPanel({
          title: 'Od nowa?', lines: ['Wyczyścić cały obrazek?', { text: 'Możesz to cofnąć strzałką.', muted: true }],
          button: 'Wyczyść',
          onPlay: function () {
            panel = null;
            var pid = ed.p.id;
            pushUndo({ t: 'all', colors: ed.colors, strokes: ed.strokes.slice(), cnt: { v: state.cnt[pid] } });
            delete state.cnt[pid];   // a fresh start: the next finish is a new picture
            ed.colors = blank(ed.p); ed.strokes = [];
            for (var r = 0; r < ed.n; r++) ed.regionEls[r].setAttribute('fill', '#ffffff');
            rebuildStrokes();
            ctx.sfx('whoosh');
            changed();
          },
          secondary: [{ label: 'Nie', onClick: function () { panel = null; } }]
        });
      }

      // ---------- finish ----------
      function finish() {
        var n = colored(ed.colors), need = Math.ceil(ed.n * FIN);
        if (n < need) {
          var left = need - n;
          ctx.sfx('tap');
          ctx.toast('Pokoloruj jeszcze ' + left + ' ' + plural(left, ['pole', 'pola', 'pól']) + '.');
          return;
        }
        var strokes = ed.strokes.map(encStroke), sig = sigOf(ed.colors, strokes);
        if (state.fin[ed.p.id] === sig) { ctx.sfx('tap'); ctx.toast('Ten obrazek już jest w galerii.'); return; }
        state.fin[ed.p.id] = sig;
        // gallery copy: thin out long brush work so the save stays small
        var all = countPts(ed.strokes), step = all > GALPTS ? Math.ceil(all / GALPTS) : 1;
        var gs = step === 1 ? strokes : ed.strokes.map(function (s) {
          var pts = [];
          for (var j = 0; j < s.pts.length; j += 2) if ((j / 2) % step === 0 || j === s.pts.length - 2) pts.push(s.pts[j], s.pts[j + 1]);
          return encStroke({ c: s.c, w: s.w, pts: pts });
        });
        var pid = ed.p.id, base = state.cnt[pid], diff = 0;
        if (typeof base === 'string') for (var k = 0; k < ed.n; k++) if (base.charAt(k) !== ed.colors.charAt(k)) diff++;
        var isNew = typeof base !== 'string' || diff * 2 > ed.n;
        var entry = { p: pid, c: ed.colors, s: gs, d: today() }, dropped = false, lines;
        var lastI = -1;
        if (!isNew) for (var gi = state.gal.length - 1; gi >= 0; gi--) if (state.gal[gi].p === pid) { lastI = gi; break; }
        if (lastI >= 0) state.gal.splice(lastI, 1);   // re-finish: replace that picture's latest gallery copy
        state.gal.push(entry);
        while (state.gal.length > MAXGAL) { state.gal.shift(); dropped = true; }
        if (isNew) state.cnt[pid] = ed.colors;
        persist();
        ctx.sfx('win');
        if (isNew) {
          confetti();
          var first = state.gal.length === 1 && !ctx.getStat('done');
          ctx.stat('done', 1);
          ctx.sticker('first');
          lines = ['Obrazek jest w galerii.'];
          if (dropped) lines.push({ text: 'Najstarszy obrazek zrobił miejsce (galeria mieści ' + MAXGAL + ').', muted: true });
          else if (first) lines.push({ text: 'Kolorować go można dalej, ile chcesz.', muted: true });
        } else {
          lines = [lastI >= 0 ? 'Obrazek w galerii jest poprawiony.' : 'Obrazek jest w galerii.',
            { text: 'Jako nowy obrazek liczy się, gdy zaczniesz od nowa (kosz).', muted: true }];
          if (dropped) lines.push({ text: 'Najstarszy obrazek zrobił miejsce (galeria mieści ' + MAXGAL + ').', muted: true });
        }
        syncProgress();
        showPanel({
          big: '★', title: 'Brawo!', medals: true, lines: lines, button: 'Maluj dalej',
          onPlay: function () { panel = null; },
          secondary: [
            { label: 'Galeria', onClick: function () { panel = null; showMenu('gal'); } },
            { label: 'Inne obrazki', onClick: function () { panel = null; showMenu('pics'); } }
          ]
        });
      }
      function confetti() {
        if (reduce) return;
        var c = document.createElement('div'); c.className = 'kol-conf';
        for (var i = 0; i < 46; i++) {
          var p = document.createElement('i');
          p.style.left = (Math.random() * 100) + '%';
          p.style.background = PAL[(Math.random() * 15) | 0];
          p.style.setProperty('--dx', ((Math.random() - 0.5) * 160) + 'px');
          p.style.animationDelay = (Math.random() * 0.5) + 's';
          c.appendChild(p);
        }
        root.appendChild(c);
        clearTimeout(confT);
        confT = setTimeout(function () { c.remove(); }, 2400);
      }

      // ---------- start ----------
      showMenu('pics');
      showPanel({
        title: 'Kolorowanka', medals: true,
        lines: ['Wybierz obrazek. Dotknij pole, żeby je pomalować.', { text: '2 obrazki za darmo, kolejne po ' + PRICE + ' ★. Kupiony obrazek zostaje na zawsze.', muted: true }],
        button: 'Zaczynamy', onPlay: function () { panel = null; }
      });

      return {
        destroy: function () {
          if (!alive) return;
          alive = false;
          if (ed) persist(); else if (saveT) persist();
          clearTimeout(saveT); clearTimeout(confT);
          if (ro) ro.disconnect();
          closePanel(); closeOverlay();
          root.remove();
          if (DEFS === defs) { DEFS = null; made = {}; }
          ed = null;
        },
        pause: function () { if (ed) persist(); },
        resume: function () {}
      };
    }
  });
})();
