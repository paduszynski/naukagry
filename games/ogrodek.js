/*
 * Ogródek: a long-running garden. Seeds cost stars (ctx.spend), plants grow in real time over 1-3 days,
 * computed from saved timestamps so they grow while the app is closed. Each plant needs water once per
 * calendar day; the watering can fills after the first finished learning set of the day
 * (Skarbonka.get().days.last === today). Harvest -> zielnik (collection book) + small refund.
 * Free seeds from other games arrive through localStorage['naukagry.ogrodek.inbox'] = [{kind, n, from}].
 */
(function () {
  'use strict';

  var INK = '#1d2f6f', STAR = '#e3a008', LVL = '#7a4fc4', MUTED = '#5a6690';
  var FONT = '"Patrick Hand","Comic Sans MS",cursive';
  var HOUR = 3600e3;
  var INBOX = 'naukagry.ogrodek.inbox';
  var MAX_PLOTS = 12;

  // ---------- catalogue ----------
  // h: hours of watered growth needed. type: drawing archetype.
  var PLANTS = [
    { k: 'rzodkiewka', n: 'rzodkiewka', lv: 1, price: 50, h: 24, type: 'root', shape: 'round', fc: '#e2405a' },
    { k: 'slonecznik', n: 'słonecznik', lv: 1, price: 60, h: 24, type: 'flower', head: 'sun', tall: 1, pc: '#f7c51e', cc: '#8a5428' },
    { k: 'marchewka', n: 'marchewka', lv: 2, price: 60, h: 24, type: 'root', shape: 'long', fc: '#f08a24' },
    { k: 'kwiatek', n: 'kwiatek', lv: 3, price: 70, h: 30, type: 'flower', head: 'round', tall: 0.55, pc: '#f47fb0', cc: '#f7d23a' },
    { k: 'salata', n: 'sałata', lv: 4, price: 70, h: 30, type: 'leafy' },
    { k: 'pomidor', n: 'pomidor', lv: 5, price: 90, h: 48, type: 'bush', fruit: 'round', fc: '#e2402f', fl: '#f7d23a' },
    { k: 'truskawka', n: 'truskawka', lv: 6, price: 90, h: 40, type: 'low', fc: '#e8344a' },
    { k: 'tulipan', n: 'tulipan', lv: 7, price: 80, h: 36, type: 'flower', head: 'cup', tall: 0.7, pc: '#ec4f7a' },
    { k: 'kukurydza', n: 'kukurydza', lv: 8, price: 100, h: 54, type: 'corn' },
    { k: 'groszek', n: 'groszek', lv: 9, price: 90, h: 42, type: 'bush', fruit: 'pod', fc: '#74c94e', fl: '#ffffff' },
    { k: 'winogrono', n: 'winogrono', lv: 10, price: 110, h: 60, type: 'vine', fruit: 'grapes', fc: '#8657c9', fl: '#c8e07a' },
    { k: 'dynia', n: 'dynia', lv: 11, price: 120, h: 60, type: 'pumpkin', fc: '#f08a24' },
    { k: 'papryka', n: 'papryka', lv: 12, price: 110, h: 48, type: 'bush', fruit: 'pepper', fc: '#f6c21b', fl: '#ffffff' },
    { k: 'lawenda', n: 'lawenda', lv: 13, price: 110, h: 42, type: 'spike', pc: '#9a72d8' },
    { k: 'ogorek', n: 'ogórek', lv: 14, price: 100, h: 44, type: 'vine', fruit: 'cucumber', fc: '#3f9a45', fl: '#f7d23a' },
    { k: 'mak', n: 'mak', lv: 15, price: 120, h: 48, type: 'flower', head: 'poppy', tall: 0.8, pc: '#e23a2f', cc: '#2a2333' },
    { k: 'baklazan', n: 'bakłażan', lv: 16, price: 120, h: 54, type: 'bush', fruit: 'eggplant', fc: '#6a3d9a', fl: '#c9a6f0' },
    { k: 'roza', n: 'róża', lv: 17, price: 140, h: 60, type: 'flower', head: 'rose', tall: 0.85, pc: '#e0315b', rare: 1 },
    { k: 'lilia', n: 'lilia', lv: 18, price: 140, h: 66, type: 'flower', head: 'lily', tall: 0.9, pc: '#fde3ef', cc: '#f08a24', rare: 1 },
    { k: 'storczyk', n: 'storczyk', lv: 19, price: 150, h: 72, type: 'orchid', pc: '#d77be0', rare: 1 },
    { k: 'teczowy', n: 'tęczowy kwiat', lv: 20, price: 150, h: 72, type: 'flower', head: 'rainbow', tall: 0.9, rare: 1 }
  ];
  var BY = {};
  PLANTS.forEach(function (p) { BY[p.k] = p; });
  var FROM = { trojki: 'z Grządkowych trójek', 'Grządkowe trójki': 'z Grządkowych trójek', rury: 'z Rur do ogródka', 'Rury do ogródka': 'z Rur do ogródka' };

  // ---------- dates ----------
  function dstr(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function today() { return dstr(new Date()); }
  var dayCache = {};
  function dayRange(s) {
    var r = dayCache[s];
    if (!r) { var p = s.split('-'); r = dayCache[s] = [new Date(+p[0], p[1] - 1, +p[2]).getTime(), new Date(+p[0], p[1] - 1, +p[2] + 1).getTime()]; }
    return r;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hexMix(a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
    var g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
    var bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }

  // ---------- plant drawing (units: plant max height ~100, base at 0,0, up is -y) ----------
  var G, U, D, LEAF, LEAF2, STEMC, TT;
  function path(fn, fill, noStroke) {
    G.beginPath(); fn();
    if (fill) { G.fillStyle = fill; G.fill(); }
    if (!noStroke) { G.lineWidth = U; G.strokeStyle = INK; G.stroke(); }
  }
  function circ(x, y, r, fill, ns) { path(function () { G.arc(x, y, r, 0, Math.PI * 2); }, fill, ns); }
  function ell(x, y, rx, ry, rot, fill, ns) { path(function () { G.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); }, fill, ns); }
  function shine(x, y, r) { G.beginPath(); G.arc(x, y, r, 0, Math.PI * 2); G.fillStyle = 'rgba(255,255,255,.55)'; G.fill(); }
  function leaf(x, y, ang, len, wid, fill) {
    G.save(); G.translate(x, y); G.rotate(ang);
    path(function () { G.moveTo(0, 0); G.quadraticCurveTo(len * 0.45, -wid, len, 0); G.quadraticCurveTo(len * 0.45, wid, 0, 0); }, fill);
    G.beginPath(); G.moveTo(len * 0.12, 0); G.lineTo(len * 0.78, 0);
    G.strokeStyle = 'rgba(255,255,255,.45)'; G.lineWidth = U * 0.8; G.stroke();
    G.restore();
  }
  function softLeaf(x, y, ang, len, wid, fill) {
    G.save(); G.translate(x, y); G.rotate(ang);
    G.beginPath(); G.moveTo(0, 0); G.quadraticCurveTo(len * 0.45, -wid, len, 0); G.quadraticCurveTo(len * 0.45, wid, 0, 0);
    G.fillStyle = fill; G.fill(); G.lineWidth = U * 0.7; G.strokeStyle = '#2f7a34'; G.stroke();
    G.restore();
  }
  function bead(x, y, r, fill, edge) { G.beginPath(); G.arc(x, y, r, 0, Math.PI * 2); G.fillStyle = fill; G.fill(); G.lineWidth = U * 0.7; G.strokeStyle = edge; G.stroke(); }
  function stem(x0, y0, cx, cy, x1, y1, w, col) {
    G.lineCap = 'round';
    G.beginPath(); G.moveTo(x0, y0); G.quadraticCurveTo(cx, cy, x1, y1);
    G.strokeStyle = INK; G.lineWidth = w + U * 2; G.stroke();
    G.strokeStyle = col || STEMC; G.lineWidth = w; G.stroke();
  }
  function qpt(x0, y0, cx, cy, x1, y1, t) { var a = 1 - t; return [a * a * x0 + 2 * a * t * cx + t * t * x1, a * a * y0 + 2 * a * t * cy + t * t * y1]; }
  function dl(ang) { return ang + D * 0.6 * (Math.cos(ang) >= 0 ? 1 : -1); }
  function star5(x, y, r, fill) {
    path(function () {
      for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; G.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      G.closePath();
    }, fill);
  }
  function smallFlower(x, y, r, fill) {
    for (var i = 0; i < 5; i++) { var a = i * Math.PI * 2 / 5; circ(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 0.55, fill); }
    circ(x, y, r * 0.4, '#f7d23a');
  }
  function face(x, y, s) {
    G.fillStyle = INK;
    G.beginPath(); G.arc(x - 3 * s, y - 1 * s, 1.3 * s, 0, 7); G.arc(x + 3 * s, y - 1 * s, 1.3 * s, 0, 7); G.fill();
    G.beginPath(); G.lineWidth = U; G.strokeStyle = INK;
    if (D > 0.3) G.arc(x, y + 4.5 * s, 2.6 * s, -Math.PI * 0.85, -Math.PI * 0.15);
    else G.arc(x, y + 1.2 * s, 2.6 * s, Math.PI * 0.15, Math.PI * 0.85);
    G.stroke();
    G.fillStyle = 'rgba(240,110,130,.45)';
    G.beginPath(); G.arc(x - 5 * s, y + 2 * s, 1.5 * s, 0, 7); G.arc(x + 5 * s, y + 2 * s, 1.5 * s, 0, 7); G.fill();
  }

  function seedStage(f) {
    ell(0, 0, 11, 4.5, 0, '#6e4527', true);
    G.save(); G.translate(0, -1.5 - f * 1.5); G.rotate(-0.3 + Math.sin(TT * 2) * 0.05 * f);
    ell(0, 0, 4.5, 3, 0, '#d9b07a');
    if (f > 0.6) { G.beginPath(); G.moveTo(-1, -2.5); G.lineTo(0.5, -0.5); G.lineTo(-0.5, 1); G.strokeStyle = INK; G.lineWidth = U * 0.8; G.stroke(); }
    G.restore();
  }
  function sprout(f) {
    var h = 8 + 16 * f, tx = D * h * 0.4, ty = -h * (1 - 0.2 * D);
    stem(0, 0, 0, -h * 0.5, tx, ty, 2.4);
    var L = 7 + 6 * f;
    leaf(tx, ty, dl(-Math.PI * 0.86), L, 4.5, LEAF);
    leaf(tx, ty, dl(-Math.PI * 0.14), L, 4.5, LEAF2);
  }

  function fruitAt(kind, x, y, s, col) {
    G.save(); G.translate(x, y); G.scale(s, s);
    if (kind === 'round') {
      circ(0, 7, 7, col); shine(-2.5, 4.5, 1.8);
      star5(0, 0.8, 3.2, '#3f9a3f');
    } else if (kind === 'pod') {
      ell(0, 9, 3.6, 9.5, 0.15, col);
      G.fillStyle = 'rgba(29,47,111,.18)'; [3, 8, 13].forEach(function (yy) { G.beginPath(); G.arc(0.2 + yy * 0.12, yy + 1, 1.8, 0, 7); G.fill(); });
    } else if (kind === 'pepper') {
      path(function () { G.moveTo(-6, 2); G.quadraticCurveTo(-8.5, 14, -2.5, 16); G.quadraticCurveTo(0, 13.5, 2.5, 16); G.quadraticCurveTo(8.5, 14, 6, 2); G.quadraticCurveTo(0, -1, -6, 2); }, col);
      shine(-3, 6, 1.6);
      path(function () { G.moveTo(-3, 2); G.lineTo(3, 2); G.lineTo(0, -3); G.closePath(); }, '#3f9a3f');
    } else if (kind === 'eggplant') {
      ell(0, 12, 6, 11, 0.12, col); shine(-2.5, 8, 1.6);
      star5(0, 2, 4, '#3f9a3f');
    } else if (kind === 'berry') {
      path(function () { G.moveTo(0, 13); G.quadraticCurveTo(-8, 6, -5.5, 1.5); G.quadraticCurveTo(0, -1, 5.5, 1.5); G.quadraticCurveTo(8, 6, 0, 13); }, col);
      G.fillStyle = '#ffe58a'; [[-2.5, 4], [2.5, 4], [0, 7], [-3, 8.5], [3, 8.5], [0, 10.5]].forEach(function (p) { G.beginPath(); G.arc(p[0], p[1], 0.8, 0, 7); G.fill(); });
      star5(0, 1, 3.4, '#3f9a3f');
    } else if (kind === 'cucumber') {
      ell(0, 11, 3.8, 11, 0.1, col);
      G.fillStyle = 'rgba(255,255,255,.5)'; [[-1, 5], [1.2, 9], [-1, 13], [1, 17]].forEach(function (p) { G.beginPath(); G.arc(p[0], p[1], 0.8, 0, 7); G.fill(); });
    } else if (kind === 'grapes') {
      var rows = [4, 3, 3, 2, 1], yy = 3;
      rows.forEach(function (n, ri) { for (var i = 0; i < n; i++) { var xx = (i - (n - 1) / 2) * 5.6; circ(xx, yy, 3.3, col); shine(xx - 1, yy - 1.2, 0.9); } yy += 4.6; void ri; });
      path(function () { G.moveTo(0, 0); G.lineTo(0, -3); }, null);
    }
    G.restore();
  }
  // green unripe fruit for the bud stage
  function unripe(kind, x, y, s) { fruitAt(kind, x, y, s * 0.55, kind === 'eggplant' ? '#9bd27a' : '#8fd06b'); }

  var TYPES = {
    root: function (P, p, sz, bud, ready) {
      var r = ready ? 1 : bud >= 0 ? 0.15 + bud * 0.55 : 0;
      var top = 0;
      if (r > 0) {
        if (P.shape === 'round') {
          var rr = 4 + 10 * r;
          ell(0, -rr * 0.55, rr, rr * 0.88, 0, P.fc); shine(-rr * 0.35, -rr * 0.85, rr * 0.18);
          path(function () { G.moveTo(-rr * 0.3, rr * 0.25); G.quadraticCurveTo(0, rr * 0.5, rr * 0.3, rr * 0.25); }, '#fff', true);
          top = -rr * 1.3;
        } else {
          var w = 3.5 + 5 * r, hh = 3 + 9 * r;
          path(function () { G.moveTo(-w, 1); G.lineTo(-w * 0.95, -hh + w * 0.6); G.quadraticCurveTo(0, -hh - w * 0.5, w * 0.95, -hh + w * 0.6); G.lineTo(w, 1); G.closePath(); }, P.fc);
          G.strokeStyle = 'rgba(29,47,111,.35)'; G.lineWidth = U * 0.8;
          for (var i = 1; i < 3; i++) { G.beginPath(); G.moveTo(-w * 0.7, -hh * i / 3); G.lineTo(-w * 0.15, -hh * i / 3 + 1); G.stroke(); }
          top = -hh;
        }
      }
      var n = 5, L = 18 + 26 * sz;
      for (var j = 0; j < n; j++) {
        var a = -Math.PI / 2 + (j - (n - 1) / 2) * 0.36, len = L * (j % 2 ? 0.82 : 1), col = j % 2 ? LEAF2 : LEAF;
        var sway = Math.sin(TT * 1.6 + j) * 0.04;
        if (P.shape === 'long') {
          var aa = dl(a) + sway, ex = Math.cos(aa) * len, ey = top + Math.sin(aa) * len;
          stem(0, top, ex * 0.5, top + (ey - top) * 0.5, ex, ey, 1.6, col);
          for (var t = 0.4; t < 1; t += 0.28) { var px = ex * t, py = top + (ey - top) * t; softLeaf(px, py, aa - 0.8, 6 * sz + 3, 2.8, col); softLeaf(px, py, aa + 0.8, 6 * sz + 3, 2.8, col); }
          softLeaf(ex, ey, aa, 6 * sz + 3, 3, col);
        } else leaf(0, top, dl(a) + sway, len, 6 + 3 * sz, col);
      }
    },
    flower: function (P, p, sz, bud, ready) {
      var Ht = (34 + 54 * (P.tall || 0.7)) * sz;
      var tx = D * Ht * 0.3, ty = -Ht * (1 - 0.2 * D), cx = D * Ht * 0.05, cy = -Ht * 0.55;
      stem(0, 0, cx, cy, tx, ty, 3);
      var big = P.head === 'sun' ? 1.35 : 1;
      var p1 = qpt(0, 0, cx, cy, tx, ty, 0.3), p2 = qpt(0, 0, cx, cy, tx, ty, 0.52);
      leaf(p1[0], p1[1], dl(-0.45) + Math.sin(TT * 1.5) * 0.05, (12 + 10 * sz) * big, 6 * big, LEAF);
      leaf(p2[0], p2[1], dl(-Math.PI + 0.5) + Math.sin(TT * 1.5 + 1) * 0.05, (11 + 9 * sz) * big, 5.5 * big, LEAF2);
      G.save(); G.translate(tx, ty); G.rotate(D * 0.9 + Math.sin(TT * 1.2) * 0.04);
      if (ready) flowerHead(P);
      else if (bud >= 0) {
        var s = 3.5 + 5 * bud;
        path(function () { G.moveTo(0, 2); G.quadraticCurveTo(-s, -s * 0.6, 0, -s * 1.8); G.quadraticCurveTo(s, -s * 0.6, 0, 2); }, bud > 0.45 ? hexMix('#7cc95a', P.pc || '#f47fb0', (bud - 0.45) * 1.6) : '#7cc95a');
        leaf(0, 1, -Math.PI * 0.75, s * 0.9, 2, LEAF2); leaf(0, 1, -Math.PI * 0.25, s * 0.9, 2, LEAF2);
      }
      G.restore();
    },
    spike: function (P, p, sz, bud, ready) {
      for (var b = 0; b < 4; b++) leaf(0, 0, dl(-Math.PI / 2 + (b - 1.5) * 0.55), 12 + 8 * sz, 2.6, b % 2 ? LEAF2 : '#7fae8a');
      for (var i = 0; i < 5; i++) {
        var a = (i - 2) * 0.16 + Math.sin(TT * 1.4 + i) * 0.03, Ht = (40 + 26 * sz) * (i % 2 ? 0.86 : 1);
        var tx = Math.sin(a) * Ht + D * Ht * 0.3, ty = -Math.cos(a) * Ht * (1 - 0.2 * D);
        stem(0, 0, tx * 0.3, ty * 0.5, tx, ty, 1.6, '#6f9a6a');
        if (bud >= 0 || ready) {
          var col = ready ? P.pc : hexMix('#a3b89b', P.pc, bud * 0.7), n = ready ? 7 : 3 + Math.floor(bud * 4);
          for (var j = 0; j < n; j++) {
            var t = 1 - j * 0.07, px = tx * 0.3 * 2 * (1 - t) * t + tx * t * t, py = ty * 0.5 * 2 * (1 - t) * t + ty * t * t;
            bead(px + (j % 2 ? 1.8 : -1.8), py, ready ? 2.5 : 1.8, col, ready ? '#5b3f9a' : '#6f8a68');
          }
        }
      }
    },
    leafy: function (P, p, sz, bud, ready) {
      var n = 7, L = 16 + 16 * sz;
      for (var i = 0; i < n; i++) {
        var a = -Math.PI + (i + 0.5) * Math.PI / n, col = i % 2 ? '#5fb34a' : '#7cc95a';
        leaf(0, -1, dl(a) + Math.sin(TT * 1.3 + i) * 0.03, L * (Math.abs(i - 3) === 3 ? 0.8 : 1), 9 + 5 * sz, D ? hexMix(col, '#b5a957', D * 0.45) : col);
      }
      if (bud >= 0 || ready) {
        var r = ready ? 1 : 0.4 + bud * 0.5;
        ell(0, -10 * r - 3, 12 * r + 2, 10 * r + 2, 0, D ? hexMix('#c3ea8e', '#d8cf8a', D * 0.45) : '#c3ea8e');
        G.strokeStyle = 'rgba(63,154,63,.7)'; G.lineWidth = U;
        G.beginPath(); G.arc(-3 * r, -10 * r - 3, 6 * r, -2.4, -0.6); G.stroke();
        G.beginPath(); G.arc(3 * r, -8 * r - 2, 5 * r, -2.2, -0.4); G.stroke();
        if (ready) { leaf(-2, -2, dl(-Math.PI * 0.8), 18, 9, '#93d66a'); leaf(2, -2, dl(-Math.PI * 0.2), 18, 9, '#93d66a'); }
      }
    },
    bush: function (P, p, sz, bud, ready) {
      var Ht = 60 * sz, tx = D * Ht * 0.25, ty = -Ht * (1 - 0.15 * D), cx = 3, cy = -Ht * 0.5;
      stem(0, 0, cx, cy, tx, ty, 3);
      var spots = [[0.28, 1], [0.45, -1], [0.62, 1], [0.8, -1], [0.95, 1]];
      var fruits = [];
      spots.forEach(function (s, i) {
        var pt = qpt(0, 0, cx, cy, tx, ty, s[0]), side = s[1], sw = Math.sin(TT * 1.4 + i) * 0.05;
        var bx = pt[0] + side * (8 + 6 * sz), by = pt[1] - 3;
        stem(pt[0], pt[1], pt[0] + side * 4, pt[1] - 4, bx, by, 1.8);
        leaf(bx, by, dl(side > 0 ? -0.35 : -Math.PI + 0.35) + sw, 10 + 7 * sz, 5, i % 2 ? LEAF2 : LEAF);
        if (i < 4) fruits.push([pt[0] + side * (5 + 4 * sz), pt[1] + 1]);
      });
      leaf(tx, ty, dl(-Math.PI / 2) + Math.sin(TT * 1.4) * 0.05, 9 + 4 * sz, 4.5, LEAF);
      var cnt = { round: 4, pod: 4, pepper: 3, eggplant: 2 }[P.fruit] || 3;
      var order = P.fruit === 'eggplant' ? [0, 2] : P.fruit === 'pepper' ? [0, 1, 2] : [0, 1, 2, 3];
      order.slice(0, cnt).forEach(function (fi) {
        var f = fruits[fi]; if (!f) return;
        if (ready) fruitAt(P.fruit, f[0], f[1], P.fruit === 'eggplant' ? 1.05 : 0.95, P.fc);
        else if (bud >= 0) { if (bud < 0.5) smallFlower(f[0], f[1] + 2, 2 + bud * 3, P.fl); else unripe(P.fruit, f[0], f[1], 0.6 + bud * 0.5); }
      });
    },
    low: function (P, p, sz, bud, ready) {
      var stalks = [-2.3, -1.6, -1.15, -0.5];
      stalks.forEach(function (a0, i) {
        var a = dl(a0 + (a0 < -1.57 ? 0 : 0)) + Math.sin(TT * 1.5 + i) * 0.04, L = 14 + 14 * sz;
        var ex = Math.cos(a) * L, ey = Math.sin(a) * L;
        stem(0, 0, ex * 0.4, ey * 0.7, ex, ey, 1.6);
        [-0.7, 0, 0.7].forEach(function (o, j) { ell(ex + Math.cos(a + o) * 4.5, ey + Math.sin(a + o) * 4.5, 5 + 2 * sz, 3.5 + 1.5 * sz, a + o, j === 1 ? LEAF : LEAF2); });
      });
      var spots = [[-15, -6], [13, -5], [2, -14]];
      spots.forEach(function (s) {
        if (ready) fruitAt('berry', s[0], s[1], 1, P.fc);
        else if (bud >= 0) { if (bud < 0.5) smallFlower(s[0], s[1] + 3, 3 + bud * 2, '#ffffff'); else unripe('berry', s[0], s[1] + 2, 1); }
      });
    },
    vine: function (P, p, sz, bud, ready) {
      var poleH = 74;
      path(function () { G.rect(-2, -poleH, 4, poleH + 2); }, '#c98b4f');
      var Ht = poleH * (0.25 + 0.75 * sz);
      G.lineCap = 'round';
      G.beginPath(); G.moveTo(0, 0);
      for (var y = 0; y <= Ht; y += 3) G.lineTo(Math.sin(y * 0.18) * 5 + D * y * 0.1, -y);
      G.strokeStyle = INK; G.lineWidth = 2.6 + U * 2; G.stroke(); G.strokeStyle = STEMC; G.lineWidth = 2.6; G.stroke();
      var n = Math.floor(2 + 5 * sz);
      for (var i = 0; i < n; i++) {
        var yy = Ht * (i + 0.6) / (n + 0.2), side = i % 2 ? -1 : 1, xx = Math.sin(yy * 0.18) * 5;
        var a = dl(side > 0 ? -0.25 : -Math.PI + 0.25) + Math.sin(TT * 1.3 + i) * 0.05;
        leaf(xx, -yy, a, 12 + 5 * sz, 7, i % 2 ? LEAF2 : LEAF);
      }
      var spots = P.fruit === 'grapes' ? [[11, 0.5], [-11, 0.78]] : [[10, 0.35], [-10, 0.6], [9, 0.85]];
      spots.forEach(function (s) {
        var yy = -Ht * s[1], xx = s[0];
        if (ready) fruitAt(P.fruit, xx, yy, 1, P.fc);
        else if (bud >= 0) { if (bud < 0.5) smallFlower(xx, yy + 2, 2.5 + bud * 2, P.fl); else unripe(P.fruit, xx, yy, 1); }
      });
    },
    corn: function (P, p, sz, bud, ready) {
      var Ht = 92 * sz, tx = D * Ht * 0.2, ty = -Ht * (1 - 0.12 * D);
      stem(0, 0, 0, -Ht * 0.5, tx, ty, 4.4, '#79b84d');
      [0.18, 0.34, 0.5, 0.66, 0.8].forEach(function (t, i) {
        var pt = qpt(0, 0, 0, -Ht * 0.5, tx, ty, t), side = i % 2 ? -1 : 1, L = (26 - i * 2) * (0.6 + 0.4 * sz);
        G.save(); G.translate(pt[0], pt[1]);
        var a = dl(side > 0 ? -0.55 : -Math.PI + 0.55) + Math.sin(TT * 1.3 + i) * 0.05;
        G.rotate(a);
        path(function () { G.moveTo(0, -1.5); G.quadraticCurveTo(L * 0.5, -6, L, 4 + D * 4); G.quadraticCurveTo(L * 0.5, -1, 0, 2); G.closePath(); }, i % 2 ? LEAF2 : LEAF);
        G.restore();
      });
      if (bud >= 0 || ready) {
        G.strokeStyle = '#c9a23a'; G.lineWidth = 1.4; G.lineCap = 'round';
        for (var j = -2; j <= 2; j++) { G.beginPath(); G.moveTo(tx, ty); G.quadraticCurveTo(tx + j * 3, ty - 6, tx + j * 4.5, ty - 4 + Math.abs(j) * 2); G.stroke(); }
        var cobs = ready ? [[0.45, 1], [0.6, -1]] : bud > 0.5 ? [[0.45, 1]] : [];
        cobs.forEach(function (c) {
          var pt = qpt(0, 0, 0, -Ht * 0.5, tx, ty, c[0]), s = ready ? 1 : 0.6;
          G.save(); G.translate(pt[0] + c[1] * 4, pt[1]); G.rotate(c[1] * 0.45); G.scale(s, s);
          ell(0, -9, 4.5, 10, 0, ready ? '#f7d23a' : '#cfe68a');
          if (ready) { G.fillStyle = 'rgba(200,140,20,.45)'; for (var yy = -16; yy < -2; yy += 3) for (var xx = -2.4; xx <= 2.4; xx += 2.4) { G.beginPath(); G.arc(xx, yy, 0.8, 0, 7); G.fill(); } }
          leaf(0, 1, -Math.PI / 2 - 0.35, 14, 3.5, '#8fcf62'); leaf(0, 1, -Math.PI / 2 + 0.35, 14, 3.5, '#6fb84f');
          G.restore();
        });
      }
    },
    pumpkin: function (P, p, sz, bud, ready) {
      G.lineCap = 'round';
      G.beginPath(); G.moveTo(-26 * sz, -2); G.quadraticCurveTo(0, -8, 26 * sz, -2);
      G.strokeStyle = INK; G.lineWidth = 2.4 + U * 2; G.stroke(); G.strokeStyle = STEMC; G.lineWidth = 2.4; G.stroke();
      var lv = [[-20, -12, -0.5], [18, -14, 0.4], [-2, -22, 0]];
      lv.forEach(function (l, i) {
        var s = 0.55 + 0.45 * sz, x = l[0] * s, y = l[1] * s * (1 - D * 0.3);
        stem(l[0] * s * 0.5, -2, l[0] * s * 0.6, y * 0.5, x, y + 6, 1.6);
        G.save(); G.translate(x, y); G.rotate(l[2] + D * (l[0] < 0 ? -0.4 : 0.4) + Math.sin(TT * 1.3 + i) * 0.04);
        var c = i === 2 ? LEAF : LEAF2;
        circ(-5 * s, 0, 7 * s, c); circ(5 * s, 0, 7 * s, c); circ(0, -4 * s, 7.5 * s, c);
        G.restore();
      });
      if (ready) {
        var x0 = 4, y0 = -11;
        ell(x0, y0, 19, 13, 0, P.fc);
        G.strokeStyle = 'rgba(29,47,111,.45)'; G.lineWidth = U;
        G.beginPath(); G.ellipse(x0, y0, 10, 13, 0, 0, 7); G.stroke();
        G.beginPath(); G.ellipse(x0, y0, 3.5, 13, 0, 0, 7); G.stroke();
        shine(x0 - 11, y0 - 5, 2.2);
        path(function () { G.moveTo(x0 - 1.5, y0 - 12); G.lineTo(x0 + 0.5, y0 - 18); G.lineTo(x0 + 3.5, y0 - 17); G.lineTo(x0 + 2, y0 - 12); G.closePath(); }, '#8a5a33');
      } else if (bud >= 0) {
        if (bud < 0.5) {
          G.save(); G.translate(10, -10); G.rotate(-0.4);
          path(function () { G.moveTo(-3, 0); G.lineTo(-6, -10); G.quadraticCurveTo(0, -13, 6, -10); G.lineTo(3, 0); G.closePath(); }, '#f7c51e');
          G.restore();
        } else ell(8, -6, 5 + bud * 6, 4 + bud * 4, 0, '#8fd06b');
      }
    },
    orchid: function (P, p, sz, bud, ready) {
      ell(-9, -4, 14, 5.5, -0.35 - D * 0.2, LEAF); ell(9, -5, 14, 5.5, 0.35 + D * 0.2, LEAF2);
      var Ht = 70 * sz, ex = 20 * sz + D * 8, ey = -Ht * (1 - 0.18 * D);
      G.lineCap = 'round';
      G.beginPath(); G.moveTo(0, -4); G.quadraticCurveTo(-6, -Ht * 0.9, ex, ey);
      G.strokeStyle = INK; G.lineWidth = 1.8 + U * 2; G.stroke(); G.strokeStyle = '#6f9a4f'; G.lineWidth = 1.8; G.stroke();
      if (bud >= 0 || ready) {
        [0.62, 0.8, 0.97].forEach(function (t, i) {
          var pt = qpt(0, -4, -6, -Ht * 0.9, ex, ey, t);
          if (ready) {
            G.save(); G.translate(pt[0], pt[1] + 6); G.rotate(Math.sin(TT * 1.2 + i) * 0.06 + D * 0.5);
            for (var j = 0; j < 5; j++) { var a = -Math.PI / 2 + j * Math.PI * 2 / 5; ell(Math.cos(a) * 5, Math.sin(a) * 5, 5, 3.4, a, P.pc); }
            ell(0, 2.5, 3, 3.6, 0, '#a43aa8'); circ(0, 0, 1.6, '#f7d23a');
            G.restore();
          } else if (bud * 3 > i) circ(pt[0], pt[1] + 3, 2 + bud * 2, hexMix('#9bd27a', P.pc, bud * 0.8));
        });
      }
    }
  };
  var RAINBOW = ['#e2402f', '#f08a24', '#f7d23a', '#5fbf4a', '#3f86d8', '#5b4fc4', '#b45fd0'];
  function flowerHead(P) {
    var i, a;
    if (P.head === 'sun') {
      for (i = 0; i < 14; i++) { a = i * Math.PI * 2 / 14; ell(Math.cos(a) * 13, Math.sin(a) * 13, 4.5, 8, a + Math.PI / 2, i % 2 ? P.pc : '#fbd64a'); }
      circ(0, 0, 10, P.cc);
      G.fillStyle = 'rgba(255,220,150,.35)';
      for (i = 0; i < 12; i++) { a = i * 2.4; var r = 2 + (i % 4) * 2; G.beginPath(); G.arc(Math.cos(a) * r, Math.sin(a) * r, 0.9, 0, 7); G.fill(); }
      face(0, 0, 1.1);
    } else if (P.head === 'round') {
      for (i = 0; i < 5; i++) { a = -Math.PI / 2 + i * Math.PI * 2 / 5; circ(Math.cos(a) * 6.5, Math.sin(a) * 6.5, 5.6, P.pc); }
      circ(0, 0, 4.2, P.cc); shine(-1.4, -1.4, 1.2);
    } else if (P.head === 'cup') {
      ell(-4.5, -7, 5.2, 9, -0.3, hexMix(P.pc, '#000000', 0.08));
      ell(4.5, -7, 5.2, 9, 0.3, hexMix(P.pc, '#000000', 0.08));
      ell(0, -8, 4.6, 10, 0, P.pc); shine(-1.5, -12, 1.3);
    } else if (P.head === 'poppy') {
      [[-6, -4], [6, -4], [-5, 5], [5, 5]].forEach(function (q) { circ(q[0], q[1], 8, P.pc); });
      circ(0, 0, 4.2, P.cc);
      G.fillStyle = '#2a2333'; for (i = 0; i < 8; i++) { a = i * Math.PI / 4; G.beginPath(); G.arc(Math.cos(a) * 6, Math.sin(a) * 6, 0.9, 0, 7); G.fill(); }
    } else if (P.head === 'rose') {
      leaf(0, 3, Math.PI * 0.15, 8, 3, LEAF2); leaf(0, 3, Math.PI * 0.85, 8, 3, LEAF2);
      circ(0, -4, 11, P.pc);
      G.strokeStyle = 'rgba(120,10,40,.55)'; G.lineWidth = U;
      G.beginPath(); G.arc(0, -4, 7.5, 0.3, 2.9); G.stroke();
      G.beginPath(); G.arc(0, -5, 4.5, 2.6, 6.2); G.stroke();
      G.beginPath(); G.arc(0.5, -4.5, 2, 0, 3.6); G.stroke();
      shine(-5, -9, 1.5);
    } else if (P.head === 'lily') {
      for (i = 0; i < 6; i++) {
        G.save(); G.rotate(i * Math.PI / 3);
        path(function () { G.moveTo(0, 0); G.quadraticCurveTo(6, -8, 0, -17); G.quadraticCurveTo(-6, -8, 0, 0); }, P.pc);
        G.beginPath(); G.moveTo(0, -2); G.lineTo(0, -12); G.strokeStyle = 'rgba(230,90,140,.6)'; G.lineWidth = U; G.stroke();
        G.restore();
      }
      G.strokeStyle = '#6f9a4f'; G.lineWidth = U;
      for (i = 0; i < 5; i++) { a = -Math.PI / 2 + (i - 2) * 0.45; G.beginPath(); G.moveTo(0, 0); G.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); G.stroke(); circ(Math.cos(a) * 8, Math.sin(a) * 8, 1.4, P.cc, true); }
    } else if (P.head === 'rainbow') {
      for (i = 0; i < 7; i++) { a = -Math.PI / 2 + i * Math.PI * 2 / 7; ell(Math.cos(a) * 10, Math.sin(a) * 10, 5.5, 8.5, a + Math.PI / 2, RAINBOW[i]); }
      circ(0, 0, 7.5, '#fff3a8');
      face(0, 0, 0.9);
    }
  }

  // ctx g translated to the plant base. p: progress 0..1, k: px per unit, d: droop 0..1, t: seconds
  function drawPlant(g, P, p, k, d, t, sway) {
    G = g; D = d || 0; TT = t || 0;
    U = clamp(k * 1.7, 1.1, 2.4) / k;
    LEAF = hexMix('#5cbc4b', '#b5a957', D * 0.45);
    LEAF2 = hexMix('#3f9a3f', '#9c8f45', D * 0.45);
    STEMC = hexMix('#4f9f3f', '#9c8f45', D * 0.4);
    g.save(); g.scale(k, k); g.rotate(sway || 0); g.lineJoin = 'round';
    if (p < 0.15) seedStage(p / 0.15);
    else if (p < 0.4) sprout((p - 0.15) / 0.25);
    else {
      var sz = 0.5 + 0.5 * clamp((p - 0.4) / 0.6, 0, 1);
      var bud = p >= 0.7 ? clamp((p - 0.7) / 0.3, 0, 1) : -1;
      TYPES[P.type](P, p, sz, bud, p >= 1);
    }
    g.restore();
  }
  function stageOf(p) { return p >= 1 ? 4 : p >= 0.7 ? 3 : p >= 0.4 ? 2 : p >= 0.15 ? 1 : 0; }
  function stageName(P, s) {
    return ['nasionko', 'kiełek', 'listki', 'pąk', (P.type === 'flower' || P.type === 'spike' || P.type === 'orchid') ? 'kwiat' : (P.type === 'root' || P.type === 'leafy' || P.type === 'corn') ? 'warzywo' : 'owoc'][s];
  }

  // thumbnails (ready plant on a soil mound), cached as data URLs and canvases
  var thumbCache = {};
  function thumbCanvas(P, size, sil) {
    var key = P.k + ':' + size + ':' + (sil ? 1 : 0);
    if (thumbCache[key]) return thumbCache[key];
    var dpr = Math.min(3, window.devicePixelRatio || 1);
    var c = document.createElement('canvas'); c.width = Math.round(size * dpr); c.height = Math.round(size * dpr);
    var g = c.getContext('2d'); g.scale(dpr, dpr);
    g.save(); g.translate(size / 2, size * 0.86);
    g.beginPath(); g.ellipse(0, 0, size * 0.36, size * 0.1, 0, 0, 7); g.fillStyle = '#8a5a33'; g.fill();
    var k = size * 0.78 / 100;
    if (P.type === 'pumpkin' || P.type === 'leafy' || P.type === 'low') k = size * 1.1 / 100;
    drawPlant(g, P, 1, k, 0, 0.3, 0);
    g.restore();
    if (sil) { g.globalCompositeOperation = 'source-in'; g.fillStyle = '#c3cce0'; g.fillRect(0, 0, size, size); }
    thumbCache[key] = c;
    return c;
  }
  var urlCache = {};
  function thumbUrl(P, size, sil) {
    var key = P.k + ':' + size + ':' + (sil ? 1 : 0);
    if (!urlCache[key]) urlCache[key] = thumbCanvas(P, size, sil).toDataURL();
    return urlCache[key];
  }

  var CSS = [
    '.og{display:flex;flex-direction:column;font-family:var(--hand);color:#1d2f6f;background:#8fd06b}',
    '.og-cv{flex:1;position:relative;min-height:0}',
    '.og-cv canvas{position:absolute;inset:0}',
    '.og-bar{flex:none;display:flex;gap:8px;padding:8px 10px calc(8px + env(safe-area-inset-bottom,0px));background:#fff;border-top:3px solid #1d2f6f}',
    '.og-btn{flex:1;min-height:60px;border:3px solid #1d2f6f;border-radius:16px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;font-size:1.1rem;line-height:1;box-shadow:0 3px 0 #1d2f6f;position:relative;padding:4px}',
    '.og-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #1d2f6f}',
    '.og-btn svg{width:34px;height:30px;display:block}',
    '.og-btn.full{background:#dff0ff;animation:ogglow 1.6s ease-in-out infinite}',
    '.og-btn.done{color:#5a6690}',
    '.og-btn .bdg{position:absolute;top:-8px;right:-6px;background:#cf412d;color:#fff;border:2px solid #1d2f6f;border-radius:999px;min-width:24px;height:24px;font-size:.95rem;line-height:20px;padding:0 5px}',
    '.og-btn.bump{animation:ogbump .5s ease}',
    '@keyframes ogglow{50%{box-shadow:0 3px 0 #1d2f6f,0 0 0 5px rgba(63,134,216,.35)}}',
    '@keyframes ogbump{40%{transform:scale(1.15)}}',
    '.og-banner{position:absolute;left:50%;top:8px;transform:translateX(-50%);max-width:calc(100% - 20px);width:max-content;background:#fff;border:2px solid #1d2f6f;border-radius:14px;padding:4px 12px;font-size:1.05rem;text-align:center;box-shadow:0 3px 0 rgba(29,47,111,.2);z-index:2}',
    '.og-info{position:absolute;left:10px;right:10px;bottom:10px;background:#fff;border:3px solid #1d2f6f;border-radius:18px;padding:10px 12px;display:flex;gap:12px;align-items:center;box-shadow:0 4px 0 rgba(29,47,111,.25);z-index:3;animation:ogup .2s ease}',
    '.og-info img{width:64px;height:64px;flex:none}',
    '.og-info b{font-weight:400;font-size:1.4rem;display:block;line-height:1.05}',
    '.og-info .st{color:#5a6690;font-size:1.05rem}',
    '.og-info .pb{height:12px;border:2px solid #2a8a56;border-radius:9px;margin:4px 0;overflow:hidden;background:#eaf7e2}',
    '.og-info .pb i{display:block;height:100%;background:#5cbc4b}',
    '.og-info .th{color:#3f86d8}',
    '@keyframes ogup{from{transform:translateY(20px);opacity:0}}',
    '.og-sheetw{position:absolute;inset:0;z-index:10;background:rgba(29,47,111,.35);opacity:0;transition:opacity .2s}',
    '.og-sheetw.on{opacity:1}',
    '.og-sheet{position:absolute;left:0;right:0;bottom:0;max-height:86%;display:flex;flex-direction:column;background:#fffdf5;border-top:3px solid #1d2f6f;border-radius:22px 22px 0 0;transform:translateY(100%);transition:transform .25s ease;padding-bottom:env(safe-area-inset-bottom,0px)}',
    '.og-sheetw.on .og-sheet{transform:none}',
    '.og-sh-h{display:flex;align-items:center;gap:8px;padding:10px 12px 6px 16px}',
    '.og-sh-h h3{margin:0;font-weight:400;font-size:1.8rem;flex:1;line-height:1}',
    '.og-sh-h .bal{font-size:1.2rem}.og-sh-h .bal span{color:#e3a008}',
    '.og-x{width:44px;height:44px;border:2px solid #1d2f6f;border-radius:12px;background:#fff;font-size:1.5rem;line-height:1}',
    '.og-sh-b{overflow-y:auto;touch-action:pan-y;padding:4px 12px 16px;-webkit-overflow-scrolling:touch}',
    '.og-sec{font-size:1.25rem;color:#7a4fc4;margin:10px 4px 4px}',
    '.og-row{display:flex;align-items:center;gap:10px;background:#fff;border:2px solid #d4def0;border-radius:14px;padding:6px 8px;margin:6px 0}',
    '.og-row img{width:56px;height:56px;flex:none}',
    '.og-row .tx{flex:1;min-width:0;line-height:1.1}',
    '.og-row .tx b{font-weight:400;font-size:1.3rem;display:block}',
    '.og-row .tx small{color:#5a6690;font-size:1rem}',
    '.og-row.lock{opacity:.6}.og-row.lock img{filter:grayscale(1)}',
    '.og-row.gift{border-color:#8fd06b;background:#f3fbec}',
    '.og-buy{min-width:84px;min-height:46px;border:3px solid #1d2f6f;border-radius:14px;background:#e3a008;color:#2a1d00;font-size:1.25rem;box-shadow:0 3px 0 #1d2f6f}',
    '.og-buy.free{background:#8fd06b;color:#1d2f6f}',
    '.og-buy[disabled]{background:#e6e9f2;color:#5a6690;box-shadow:none}',
    '.og-buy:active{transform:translateY(2px);box-shadow:0 1px 0 #1d2f6f}',
    '.og-lockt{color:#7a4fc4;font-size:1.05rem;white-space:nowrap}',
    '.og-poor{color:#cf412d;font-size:1.05rem;margin:6px 4px}',
    '.og-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(98px,1fr));gap:8px}',
    '.og-card{background:#fff;border:2px solid #d4def0;border-radius:14px;padding:6px 4px 8px;text-align:center;line-height:1.05;position:relative}',
    '.og-card img{width:76px;height:76px;display:block;margin:0 auto}',
    '.og-card b{font-weight:400;font-size:1.1rem;display:block}',
    '.og-card small{color:#5a6690;font-size:.95rem}',
    '.og-card .cnt{position:absolute;top:4px;right:6px;color:#2a8a56;font-size:1.1rem}',
    '.og-card.have{border-color:#8fd06b}',
    '.og-card.rare.have{border-color:#e3a008;background:#fffbe8}',
    '.og-links{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}',
    '.og-links a{text-decoration:none}'
  ].join('');

  function svgCan(full) {
    return '<svg viewBox="0 0 40 34" aria-hidden="true"><path d="M8 12 h18 v16 a3 3 0 0 1 -3 3 h-12 a3 3 0 0 1 -3 -3 z" fill="' + (full ? '#9fc3ea' : '#e6e9f2') + '" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/>' +
      (full ? '<path d="M9 19 h16 v8 a3 3 0 0 1 -3 3 h-10 a3 3 0 0 1 -3 -3 z" fill="#3f86d8"/>' : '') +
      '<path d="M26 16 l9 -7 l2 2 l-9 9" fill="#9fc3ea" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/><path d="M11 12 q6 -9 12 0" fill="none" stroke="#1d2f6f" stroke-width="2.5"/>' +
      (full ? '<path d="M37 14 v4 M34 16 v5" stroke="#3f86d8" stroke-width="2" stroke-linecap="round"/>' : '') + '</svg>';
  }
  var SVG_SEED = '<svg viewBox="0 0 40 34" aria-hidden="true"><path d="M8 6 h24 l-2 24 h-20 z" fill="#f6dfb0" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/><path d="M20 26 v-8 M20 20 q-5 -1 -6 -6 q5 0 6 6 M20 18 q5 -1 6 -6 q-5 0 -6 6" fill="#5cbc4b" stroke="#2a8a56" stroke-width="2"/></svg>';
  var SVG_BOOK = '<svg viewBox="0 0 40 34" aria-hidden="true"><path d="M5 6 q8 -3 15 2 q7 -5 15 -2 v22 q-8 -3 -15 2 q-7 -5 -15 -2 z" fill="#fff" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/><path d="M20 8 v22" stroke="#1d2f6f" stroke-width="2"/><circle cx="12" cy="15" r="3.5" fill="#f47fb0"/><path d="M12 19 v5" stroke="#2a8a56" stroke-width="2"/><path d="M26 22 q3 -8 6 -8 q-1 6 -6 8" fill="#5cbc4b"/></svg>';

  function hoursText(ms) {
    var h = Math.ceil(ms / HOUR);
    if (h <= 1) return 'mniej niż godzinę';
    if (h < 24) return 'ok. ' + h + ' godz.';
    var d = Math.floor(h / 24), r = h % 24;
    return 'ok. ' + d + (d === 1 ? ' dzień' : ' dni') + (r ? ' i ' + r + ' godz.' : '');
  }

  NG.register('ogrodek', {
    mount: function (el, ctx) {
      var S = window.Skarbonka;
      var st = ctx.load({ v: 1, plots: [], pouch: {}, book: {}, wet: [], wateredDay: '', seenHelp: false });
      if (!Array.isArray(st.plots)) st.plots = [];
      if (!Array.isArray(st.wet)) st.wet = [];
      var lvl = ctx.level();
      function plotCount() { return Math.min(MAX_PLOTS, 4 + Math.floor(lvl / 5)); }
      function nextPlotLevel() { var n = plotCount(); return n >= MAX_PLOTS ? 0 : (n - 3) * 5; }

      // ---------- DOM ----------
      var root = document.createElement('div'); root.className = 'og';
      var style = document.createElement('style'); style.textContent = CSS; root.appendChild(style);
      var cvWrap = document.createElement('div'); cvWrap.className = 'og-cv'; root.appendChild(cvWrap);
      var cv = document.createElement('canvas'); cvWrap.appendChild(cv);
      var banner = document.createElement('div'); banner.className = 'og-banner'; banner.hidden = true; cvWrap.appendChild(banner);
      var bar = document.createElement('div'); bar.className = 'og-bar'; root.appendChild(bar);
      function mkBtn(svg, label) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'og-btn';
        b.innerHTML = svg + '<span class="lb">' + label + '</span>';
        bar.appendChild(b); return b;
      }
      var bSeeds = mkBtn(SVG_SEED, 'Nasiona'), bCan = mkBtn(svgCan(false), 'Konewka'), bBook = mkBtn(SVG_BOOK, 'Zielnik');
      el.appendChild(root);
      var g = cv.getContext('2d');

      var W = 0, H = 0, dpr = 1, cells = [], skyH = 60, bgCache = null;
      var raf = 0, running = true, timers = [], lastDraw = 0, t0 = performance.now();
      var particles = [], flyers = [], watering = null, info = null, infoTimer = 0, sheet = null, modal = null, droop = [], pops = {};

      function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
      function save() {
        // keep only watered days still relevant to planted plots
        var min = today();
        st.plots.forEach(function (pl) { if (pl) { var d = dstr(new Date(pl.t)); if (d < min) min = d; } });
        st.wet = st.wet.filter(function (d) { return d >= min; });
        ctx.save(st);
      }
      function toast(text) {
        ctx.toast(text);
        var ts = el.querySelectorAll('.ng-toast'), t = ts[ts.length - 1];
        // #stage > * gives every stage child inset:0; pin the toast to the top centre instead
        if (t) { t.style.cssText += ';inset:auto;top:14px;left:50%;right:auto;bottom:auto;white-space:normal;width:max-content;max-width:calc(100% - 24px);text-align:center'; }
      }

      // ---------- growth ----------
      function progress(pl, now) {
        var P = BY[pl.k]; if (!P) return 0;
        var plantDay = dstr(new Date(pl.t)), ms = 0, seen = {};
        var days = st.wet.concat([plantDay]);
        for (var i = 0; i < days.length; i++) {
          var d = days[i]; if (seen[d] || d < plantDay) continue; seen[d] = 1;
          var r = dayRange(d), s = Math.max(r[0], pl.t), e = Math.min(r[1], now);
          if (e > s) ms += e - s;
        }
        return ms / (P.h * HOUR);
      }
      function wateredToday(pl) { var td = today(); return st.wet.indexOf(td) >= 0 || dstr(new Date(pl.t)) === td; }
      function thirsty(pl, now) { return pl && progress(pl, now) < 1 && !wateredToday(pl); }
      function canFull() { var s; try { s = S.get(); } catch (e) { return false; } return s && s.days && s.days.last === today(); }
      function canState() { return st.wateredDay === today() ? 'done' : canFull() ? 'full' : 'empty'; }

      // ---------- layout ----------
      function layout() {
        var r = cvWrap.getBoundingClientRect();
        W = Math.max(1, r.width); H = Math.max(1, r.height);
        dpr = Math.min(3, window.devicePixelRatio || 1);
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        skyH = clamp(H * 0.12, 54, 100);
        var n = plotCount(), total = n < MAX_PLOTS ? n + 1 : n;
        var cols = total <= 6 ? 2 : 3, rows = Math.ceil(total / cols);
        if (W > H * 1.1) { cols = Math.min(total, total <= 6 ? 3 : 4); rows = Math.ceil(total / cols); }
        var gx = 8, gy = skyH + 8, gw = W - 16, gh = H - gy - 6;
        var cw = gw / cols, ch = gh / rows;
        if (cw > ch * 1.5) cw = ch * 1.5;
        var ox = (W - cw * cols) / 2;
        cells = [];
        for (var i = 0; i < total; i++) {
          var c = i % cols, rr = Math.floor(i / cols);
          var x = ox + c * cw, y = gy + rr * ch;
          var bx = x + 6, bw = cw - 12, sy = y + ch * 0.64, bh = Math.min(ch * 0.3, bw * 0.55);
          cells.push({ x: x, y: y, w: cw, h: ch, bx: bx, by: sy, bw: bw, bh: bh, baseX: x + cw / 2, baseY: sy + bh * 0.4,
            k: Math.min(ch * 0.7, cw * 1.05) / 100, locked: i >= n });
        }
        buildBg();
        drawFrame(performance.now());
      }
      function buildBg() {
        bgCache = document.createElement('canvas'); bgCache.width = cv.width; bgCache.height = cv.height;
        var b = bgCache.getContext('2d'); b.scale(dpr, dpr);
        var sky = b.createLinearGradient(0, 0, 0, skyH);
        sky.addColorStop(0, '#bfe3ff'); sky.addColorStop(1, '#e9f6ff');
        b.fillStyle = sky; b.fillRect(0, 0, W, skyH + 2);
        // far hills
        b.fillStyle = '#b5e09a';
        b.beginPath(); b.moveTo(0, skyH);
        for (var x = 0; x <= W + 20; x += 20) b.lineTo(x, skyH - 10 - Math.sin(x / 70) * 8 - Math.sin(x / 23) * 3);
        b.lineTo(W, skyH); b.closePath(); b.fill();
        var gr = b.createLinearGradient(0, skyH, 0, H);
        gr.addColorStop(0, '#9edb78'); gr.addColorStop(1, '#7fc65c');
        b.fillStyle = gr; b.fillRect(0, skyH, W, H - skyH);
        // grass tufts (deterministic)
        b.strokeStyle = 'rgba(42,138,86,.35)'; b.lineWidth = 1.5; b.lineCap = 'round';
        var seed = 7; function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
        for (var i = 0; i < W * H / 1400; i++) {
          var tx = rnd() * W, ty = skyH + 10 + rnd() * (H - skyH - 10);
          b.beginPath(); b.moveTo(tx - 3, ty); b.lineTo(tx - 4, ty - 5); b.moveTo(tx, ty); b.lineTo(tx, ty - 7); b.moveTo(tx + 3, ty); b.lineTo(tx + 4, ty - 5); b.stroke();
        }
        for (i = 0; i < W / 30; i++) { var fx = rnd() * W, fy = skyH + 14 + rnd() * (H - skyH - 20); b.fillStyle = ['#fff', '#ffe27a', '#ffc0d8'][i % 3]; b.beginPath(); b.arc(fx, fy, 2.2, 0, 7); b.fill(); }
        // fence
        var fy0 = skyH - 22;
        b.fillStyle = '#fff'; b.strokeStyle = INK; b.lineWidth = 2;
        b.beginPath(); b.rect(-2, fy0 + 6, W + 4, 5); b.rect(-2, fy0 + 15, W + 4, 5); b.fill(); b.stroke();
        for (x = 6; x < W; x += 22) {
          b.beginPath(); b.moveTo(x, skyH + 2); b.lineTo(x, fy0 + 2); b.lineTo(x + 5, fy0 - 3); b.lineTo(x + 10, fy0 + 2); b.lineTo(x + 10, skyH + 2); b.closePath(); b.fill(); b.stroke();
        }
      }

      // ---------- drawing ----------
      function rrect(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
      function drawBed(c, wet) {
        rrect(c.bx, c.by, c.bw, c.bh, 12); g.fillStyle = '#c98b4f'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
        rrect(c.bx + 6, c.by + 5, c.bw - 12, c.bh - 11, 9); g.fillStyle = wet ? '#5e3b22' : '#8a5a33'; g.fill();
        g.strokeStyle = wet ? 'rgba(0,0,0,.18)' : 'rgba(0,0,0,.14)'; g.lineWidth = 2;
        for (var i = 1; i <= 2; i++) {
          var yy = c.by + 5 + (c.bh - 11) * i / 3;
          g.beginPath(); g.moveTo(c.bx + 14, yy); g.quadraticCurveTo(c.baseX, yy + 3, c.bx + c.bw - 14, yy); g.stroke();
        }
        if (wet) { g.fillStyle = 'rgba(160,210,255,.6)'; [[0.25, 0.35], [0.7, 0.6], [0.45, 0.75]].forEach(function (q) { g.beginPath(); g.ellipse(c.bx + c.bw * q[0], c.by + c.bh * q[1], 4, 1.6, 0, 0, 7); g.fill(); }); }
      }
      function drawCloud(x, y, s) {
        g.fillStyle = '#fff'; g.strokeStyle = 'rgba(29,47,111,.25)'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(x, y, 10 * s, Math.PI * 0.5, Math.PI * 1.5); g.arc(x + 12 * s, y - 8 * s, 12 * s, Math.PI, 0); g.arc(x + 26 * s, y - 2 * s, 9 * s, Math.PI * 1.3, Math.PI * 0.5); g.closePath(); g.fill(); g.stroke();
      }
      function drawSun(t) {
        var x = W - 38, y = skyH * 0.4, r = 14;
        g.save(); g.translate(x, y); g.rotate(t * 0.15);
        g.strokeStyle = '#f2b51d'; g.lineWidth = 3; g.lineCap = 'round';
        for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5; g.beginPath(); g.moveTo(Math.cos(a) * (r + 5), Math.sin(a) * (r + 5)); g.lineTo(Math.cos(a) * (r + 11), Math.sin(a) * (r + 11)); g.stroke(); }
        g.restore();
        g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = '#ffd84a'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
        g.fillStyle = INK; g.beginPath(); g.arc(x - 4.5, y - 2, 1.5, 0, 7); g.arc(x + 4.5, y - 2, 1.5, 0, 7); g.fill();
        g.beginPath(); g.arc(x, y + 1, 5, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
      }
      var BUTTERFLIES = [{ c: '#f47fb0', a: 0, sp: 0.11 }, { c: '#ffd84a', a: 2.1, sp: 0.08 }, { c: '#8fc3ff', a: 4.2, sp: 0.095 }];
      function drawButterfly(b, t) {
        var ph = b.a + t * b.sp * 2 * Math.PI / 6;
        var x = W * (0.5 + 0.42 * Math.sin(ph) * Math.cos(ph * 0.37 + b.a));
        var y = skyH + (H - skyH) * (0.45 + 0.4 * Math.sin(ph * 1.7 + b.a));
        var dx = Math.cos(ph) * Math.cos(ph * 0.37 + b.a) - 0.37 * Math.sin(ph) * Math.sin(ph * 0.37 + b.a);
        var flap = 0.35 + 0.65 * Math.abs(Math.sin(t * 9 + b.a));
        g.save(); g.translate(x, y); if (dx < 0) g.scale(-1, 1); g.rotate(0.2);
        g.lineWidth = 1.4; g.strokeStyle = INK; g.fillStyle = b.c;
        g.save(); g.scale(flap, 1);
        g.beginPath(); g.ellipse(-5, -4, 6, 5, -0.5, 0, 7); g.fill(); g.stroke();
        g.beginPath(); g.ellipse(-4, 4, 4, 3.5, 0.5, 0, 7); g.fill(); g.stroke();
        g.restore();
        g.beginPath(); g.ellipse(0, 0, 1.6, 6, 0, 0, 7); g.fillStyle = INK; g.fill();
        g.beginPath(); g.moveTo(0, -5); g.lineTo(3, -9); g.moveTo(0, -5); g.lineTo(-1, -10); g.stroke();
        g.restore();
      }
      function drawDrop(x, y, s) {
        g.beginPath(); g.arc(x, y, 11 * s, 0, 7); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
        g.beginPath(); g.moveTo(x, y - 7 * s); g.quadraticCurveTo(x + 6 * s, y + 1 * s, x, y + 5 * s); g.quadraticCurveTo(x - 6 * s, y + 1 * s, x, y - 7 * s); g.fillStyle = '#3f86d8'; g.fill();
      }
      function sparkle(x, y, r, a) {
        g.save(); g.globalAlpha = a; g.fillStyle = '#ffd84a'; g.strokeStyle = INK; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill(); g.stroke();
        g.restore();
      }
      function drawCan(x, y, tilt) {
        g.save(); g.translate(x, y); g.rotate(tilt); g.lineWidth = 2.5; g.strokeStyle = INK; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(14, -6); g.lineTo(34, -20); g.lineTo(37, -16); g.lineTo(18, 2); g.closePath(); g.fillStyle = '#9fc3ea'; g.fill(); g.stroke();
        g.beginPath(); g.ellipse(36, -18, 4, 6, -0.9, 0, 7); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(-16, -14); g.lineTo(16, -14); g.lineTo(16, 14); g.quadraticCurveTo(16, 18, 12, 18); g.lineTo(-12, 18); g.quadraticCurveTo(-16, 18, -16, 14); g.closePath(); g.fillStyle = '#6fa8e8'; g.fill(); g.stroke();
        g.beginPath(); g.moveTo(-10, -14); g.quadraticCurveTo(0, -30, 10, -14); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(-11, -9, 4, 20);
        g.restore();
      }

      function drawFrame(now) {
        if (!W) return;
        var t = (now - t0) / 1000, wall = Date.now(), td = today();
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, W, H);
        if (bgCache) g.drawImage(bgCache, 0, 0, W, H);
        drawSun(t);
        var cx1 = ((t * 6) % (W + 120)) - 60, cx2 = ((t * 4 + W * 0.55) % (W + 120)) - 60;
        drawCloud(cx1, skyH * 0.35, 0.8); drawCloud(cx2, skyH * 0.62, 0.6);
        var wetToday = st.wet.indexOf(td) >= 0;
        cells.forEach(function (c, i) {
          if (c.locked) {
            g.save(); g.setLineDash([7, 6]); rrect(c.bx, c.by, c.bw, c.bh, 12); g.fillStyle = 'rgba(255,255,255,.25)'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = 'rgba(29,47,111,.45)'; g.stroke(); g.restore();
            var lx = c.baseX, ly = c.by + c.bh * 0.42;
            g.lineWidth = 2.5; g.strokeStyle = INK; g.fillStyle = '#e3a008';
            g.beginPath(); g.arc(lx, ly - 7, 6, Math.PI, 0); g.stroke();
            rrect(lx - 9, ly - 7, 18, 14, 3); g.fill(); g.stroke();
            g.fillStyle = 'rgba(29,47,111,.75)'; g.font = Math.round(clamp(c.bw / 8, 14, 18)) + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'top';
            g.fillText('od poziomu ' + nextPlotLevel(), lx, ly + 10);
            return;
          }
          var pl = st.plots[i];
          drawBed(c, pl && (wetToday || wateredToday(pl)));
          if (!pl) {
            var pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + i);
            var r = Math.min(c.bh * 0.28, 18);
            g.save(); g.globalAlpha = 0.8 + 0.2 * pulse;
            g.beginPath(); g.arc(c.baseX, c.by + c.bh * 0.48, r, 0, 7); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
            g.beginPath(); g.moveTo(c.baseX - r * 0.5, c.by + c.bh * 0.48); g.lineTo(c.baseX + r * 0.5, c.by + c.bh * 0.48); g.moveTo(c.baseX, c.by + c.bh * 0.48 - r * 0.5); g.lineTo(c.baseX, c.by + c.bh * 0.48 + r * 0.5); g.lineWidth = 3; g.stroke();
            g.restore();
            return;
          }
          var P = BY[pl.k]; if (!P) return;
          var p = Math.min(1, progress(pl, wall)), th = p < 1 && !wateredToday(pl);
          droop[i] = (droop[i] || 0) + ((th ? 1 : 0) - (droop[i] || 0)) * 0.06;
          if (Math.abs(droop[i] - (th ? 1 : 0)) < 0.01) droop[i] = th ? 1 : 0;
          var sway = Math.sin(t * 1.3 + i * 1.7) * 0.035 * (1 - droop[i] * 0.7);
          var pop = pops[i] ? clamp(1 - (now - pops[i]) / 500, 0, 1) : 0;
          var bounce = p >= 1 ? 1 + Math.sin(t * 3 + i) * 0.025 : 1 + Math.sin(pop * Math.PI) * 0.15;
          g.save(); g.translate(c.baseX, c.baseY); g.scale(bounce, bounce);
          drawPlant(g, P, p, c.k, droop[i], t + i, sway);
          g.restore();
          // seed sign for young plants
          if (p < 0.4) {
            var sx = c.bx + 16, sy2 = c.by + 6, ss = clamp(c.bw * 0.22, 22, 34);
            g.lineWidth = 2; g.strokeStyle = INK;
            g.beginPath(); g.moveTo(sx, sy2 + 4); g.lineTo(sx, sy2 - ss * 0.5); g.strokeStyle = '#8a5a33'; g.lineWidth = 3; g.stroke();
            rrect(sx - ss / 2, sy2 - ss * 1.35, ss, ss, 5); g.fillStyle = '#fff8ea'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
            g.drawImage(thumbCanvas(P, 48, false), sx - ss / 2 + 2, sy2 - ss * 1.35 + 2, ss - 4, ss - 4);
          }
          if (p < 1) {
            var pw = c.bw * 0.5, px = c.baseX - pw / 2, py = c.by + c.bh - 11;
            rrect(px, py, pw, 7, 3.5); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill();
            if (p > 0.02) { rrect(px, py, Math.max(7, pw * p), 7, 3.5); g.fillStyle = th ? '#c9b25a' : '#5cbc4b'; g.fill(); }
            rrect(px, py, pw, 7, 3.5); g.lineWidth = 1.5; g.strokeStyle = INK; g.stroke();
          }
          if (th) drawDrop(c.x + c.w - 22, c.y + 22 + Math.sin(t * 2.5 + i) * 3, clamp(c.w / 150, 0.8, 1.1));
          if (p >= 1) for (var s = 0; s < 3; s++) {
            var aa = t * 0.8 + s * 2.1 + i, rr2 = c.k * 42;
            sparkle(c.baseX + Math.cos(aa) * rr2, c.baseY - c.k * 45 + Math.sin(aa * 1.3) * c.k * 30, 4 + 2 * Math.sin(t * 4 + s), 0.5 + 0.5 * Math.sin(t * 3 + s * 2));
          }
        });
        BUTTERFLIES.forEach(function (b) { drawButterfly(b, t); });
        // watering can animation
        if (watering) {
          var wt = (now - watering.start) / watering.per, idx = Math.floor(wt);
          if (idx >= watering.list.length) { watering = null; toast('Podlane! Rośliny rosną dalej.'); }
          else {
            var cc = cells[watering.list[idx]], f = wt - idx;
            var x = cc.baseX - 30 + f * 20, y = cc.by - cc.h * 0.15;
            drawCan(x, y, 0.45);
            if (Math.random() < 0.9) particles.push({ x: x + 40, y: y - 12, vx: 30 + Math.random() * 30, vy: 20, life: 0.6, c: '#3f86d8', r: 2.2, k: 'drop' });
          }
        }
        // particles
        var dt = Math.min(0.05, (now - (drawFrame.last || now)) / 1000); drawFrame.last = now;
        particles = particles.filter(function (q) {
          q.life -= dt; if (q.life <= 0) return false;
          q.vy += 260 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
          if (q.k === 'star') sparkle(q.x, q.y, q.r, Math.min(1, q.life * 2));
          else { g.beginPath(); g.fillStyle = q.c; g.globalAlpha = Math.min(1, q.life * 3); g.arc(q.x, q.y, q.r, 0, 7); g.fill(); g.globalAlpha = 1; }
          return true;
        });
        flyers = flyers.filter(function (f) {
          var u = (now - f.start) / 800; if (u >= 1) { bBook.classList.remove('bump'); void bBook.offsetWidth; bBook.classList.add('bump'); return false; }
          var e = u * u * (3 - 2 * u), x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e - Math.sin(u * Math.PI) * 80;
          var s = f.s * (1 - u * 0.5);
          g.drawImage(f.img, x - s / 2, y - s / 2, s, s);
          return true;
        });
      }

      function frame(now) {
        raf = 0;
        if (!running) return;
        raf = requestAnimationFrame(frame);
        if (now - lastDraw < 30) return; // ~30 fps is plenty for a calm garden
        lastDraw = now;
        drawFrame(now);
      }
      function start() { if (!raf && running) raf = requestAnimationFrame(frame); }

      // ---------- UI state ----------
      function updateBar() {
        var cs = canState();
        bCan.className = 'og-btn' + (cs === 'full' ? ' full' : cs === 'done' ? ' done' : '');
        bCan.innerHTML = svgCan(cs === 'full') + '<span class="lb">' + (cs === 'full' ? 'Podlej' : cs === 'done' ? 'Podlane ✓' : 'Konewka') + '</span>';
        var pouchN = 0; for (var k in st.pouch) pouchN += st.pouch[k] || 0;
        bSeeds.innerHTML = SVG_SEED + '<span class="lb">Nasiona</span>' + (pouchN ? '<span class="bdg">' + pouchN + '</span>' : '');
        var now = Date.now(), anyThirsty = false;
        for (var i = 0; i < plotCount(); i++) if (thirsty(st.plots[i], now)) anyThirsty = true;
        if (anyThirsty && cs !== 'done') {
          banner.hidden = false;
          banner.textContent = cs === 'full' ? 'Rośliny chcą pić. Podlej je konewką!' : 'Rośliny chcą pić. Konewka jest pusta.';
        } else banner.hidden = true;
      }
      function tick() {
        var l = ctx.level();
        if (l !== lvl) { lvl = l; layout(); }
        updateBar();
      }

      function closeInfo() { if (info) { info.remove(); info = null; } clearTimeout(infoTimer); }
      function showInfo(i) {
        closeInfo();
        var pl = st.plots[i], P = BY[pl.k], now = Date.now(), p = Math.min(1, progress(pl, now)), th = thirsty(pl, now);
        info = document.createElement('div'); info.className = 'og-info';
        var left = (1 - p) * P.h * HOUR;
        info.innerHTML = '<img alt="" src="' + thumbUrl(P, 96, false) + '"><div style="flex:1;min-width:0"><b>' + P.n + '</b>' +
          '<span class="st">Teraz: ' + stageName(P, stageOf(p)) + '</span><div class="pb"><i style="width:' + Math.round(p * 100) + '%"></i></div>' +
          (th ? '<span class="th">Chce pić! Podlej konewką, wtedy urośnie.</span>' : '<span class="st">Gotowe za ' + hoursText(left) + '</span>') + '</div>';
        info.onclick = closeInfo;
        cvWrap.appendChild(info);
        infoTimer = later(closeInfo, 5000);
      }

      // ---------- sheets ----------
      function closeSheet() {
        if (!sheet) return;
        var s = sheet; sheet = null; s.wrap.classList.remove('on');
        later(function () { s.wrap.remove(); }, 260);
      }
      function openSheet(title, showBal) {
        closeSheet(); closeInfo();
        var wrap = document.createElement('div'); wrap.className = 'og-sheetw';
        var sh = document.createElement('div'); sh.className = 'og-sheet'; wrap.appendChild(sh);
        var hd = document.createElement('div'); hd.className = 'og-sh-h';
        hd.innerHTML = '<h3></h3>' + (showBal ? '<span class="bal"><span>★</span> <b style="font-weight:400"></b></span>' : '') + '<button type="button" class="og-x" aria-label="Zamknij">×</button>';
        hd.querySelector('h3').textContent = title;
        sh.appendChild(hd);
        var body = document.createElement('div'); body.className = 'og-sh-b'; sh.appendChild(body);
        wrap.addEventListener('pointerdown', function (e) { if (e.target === wrap) closeSheet(); });
        hd.querySelector('.og-x').onclick = closeSheet;
        root.appendChild(wrap);
        void wrap.offsetWidth; wrap.classList.add('on');
        sheet = { wrap: wrap, body: body, hd: hd };
        return sheet;
      }
      function firstEmpty() { for (var i = 0; i < plotCount(); i++) if (!st.plots[i]) return i; return -1; }

      function openShop(target) {
        if (target < 0) { toast('Wszystkie grządki są zajęte. Zbierz plony albo poczekaj.'); return; }
        var sh = openSheet('Nasiona', true);
        function render() {
          if (!sh.wrap.isConnected) return;
          var bal = ctx.balance(), body = sh.body;
          sh.hd.querySelector('.bal b').textContent = bal;
          body.innerHTML = '';
          var pouchKinds = PLANTS.filter(function (P) { return st.pouch[P.k] > 0; });
          if (pouchKinds.length) {
            var sec = document.createElement('div'); sec.className = 'og-sec'; sec.textContent = 'Twoje nasiona (za darmo)'; body.appendChild(sec);
            pouchKinds.forEach(function (P) { body.appendChild(row(P, true, bal)); });
          }
          var sec2 = document.createElement('div'); sec2.className = 'og-sec'; sec2.textContent = 'Sklep z nasionami'; body.appendChild(sec2);
          PLANTS.forEach(function (P) { body.appendChild(row(P, false, bal)); });
        }
        function growText(P) { var d = P.h / 24; return 'rośnie ' + (d <= 1 ? '1 dzień' : (Math.round(d * 2) / 2).toString().replace('.', ',') + ' dnia'); }
        function row(P, free, bal) {
          var locked = !free && P.lv > lvl;
          var r = document.createElement('div'); r.className = 'og-row' + (locked ? ' lock' : '') + (free ? ' gift' : '');
          r.innerHTML = '<img alt="" src="' + thumbUrl(P, 112, locked) + '"><div class="tx"><b></b><small></small></div>';
          r.querySelector('b').textContent = P.n + (free ? ' ×' + st.pouch[P.k] : '') + (P.rare ? ' ✦' : '');
          r.querySelector('small').textContent = growText(P) + (st.book[P.k] ? ' · zebrane ' + st.book[P.k] + '×' : '');
          if (locked) {
            var lk = document.createElement('span'); lk.className = 'og-lockt'; lk.textContent = 'od poziomu ' + P.lv; r.appendChild(lk);
          } else {
            var b = document.createElement('button'); b.type = 'button'; b.className = 'og-buy' + (free ? ' free' : '');
            b.textContent = free ? 'Posadź' : P.price + ' ★';
            if (!free && P.price > bal) b.disabled = true;
            b.onclick = function () {
              if (free) {
                if (!(st.pouch[P.k] > 0)) return;
                st.pouch[P.k]--; if (!st.pouch[P.k]) delete st.pouch[P.k];
                plant(target, P, 0);
              } else {
                if (!ctx.spend(P.price, 'nasiona: ' + P.n)) { render(); toast('Za mało gwiazdek'); return; }
                plant(target, P, P.price);
              }
              closeSheet();
            };
            r.appendChild(b);
          }
          return r;
        }
        render();
        var bal = ctx.balance(), cheapest = PLANTS.filter(function (P) { return P.lv <= lvl; }).reduce(function (m, P) { return Math.min(m, P.price); }, 1e9);
        if (bal < cheapest && !Object.keys(st.pouch).length) {
          var poor = document.createElement('p'); poor.className = 'og-poor';
          poor.innerHTML = 'Brakuje gwiazdek. Zdobądź je w <a href="/matma/">Matmie</a>, <a href="/angielski/">Angielskim</a> albo <a href="/polski/">Polskim</a>.';
          sh.body.insertBefore(poor, sh.body.firstChild);
        }
      }
      function plant(i, P, paid) {
        st.plots[i] = { k: P.k, t: Date.now(), paid: paid };
        pops[i] = performance.now();
        var c = cells[i];
        for (var j = 0; j < 10; j++) particles.push({ x: c.baseX, y: c.baseY, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 80, life: 0.6, c: '#6e4527', r: 2.5 });
        save();
        toast('Posadzone: ' + P.n + '!');
        updateBar();
      }

      function openBook() {
        var sh = openSheet('Zielnik', false);
        var have = PLANTS.filter(function (P) { return st.book[P.k] > 0; }).length;
        var p = document.createElement('div'); p.className = 'og-sec'; p.textContent = 'Zebrane rośliny: ' + have + ' z ' + PLANTS.length; sh.body.appendChild(p);
        var grid = document.createElement('div'); grid.className = 'og-grid'; sh.body.appendChild(grid);
        PLANTS.forEach(function (P) {
          var n = st.book[P.k] || 0, card = document.createElement('div');
          card.className = 'og-card' + (n ? ' have' : '') + (P.rare ? ' rare' : '');
          card.innerHTML = '<img alt="" src="' + thumbUrl(P, 112, !n) + '"><b></b><small></small>' + (n ? '<span class="cnt">×' + n + '</span>' : '');
          card.querySelector('b').textContent = n ? P.n : '???';
          card.querySelector('small').textContent = n ? (P.rare ? 'rzadki okaz' : stageName(P, 4)) : P.lv > lvl ? 'poziom ' + P.lv : 'jeszcze nie';
          grid.appendChild(card);
        });
      }

      // ---------- modal (empty can) ----------
      function closeModal() { if (modal) { modal.remove(); modal = null; } }
      function emptyCanModal() {
        closeModal(); closeInfo();
        modal = document.createElement('div'); modal.className = 'ng-panel';
        modal.innerHTML = '<div class="ng-card"><div style="display:flex;justify-content:center">' + svgCan(false).replace('<svg', '<svg style="width:90px;height:76px"') + '</div>' +
          '<h2>Konewka jest pusta</h2><p>Zrób dziś jeden zestaw w Matmie, Angielskim albo Polskim, a konewka się napełni.</p>' +
          '<div class="og-links"><a class="ng-btn sec" href="/matma/">Matma</a><a class="ng-btn sec" href="/angielski/">Angielski</a><a class="ng-btn sec" href="/polski/">Polski</a></div>' +
          '<button type="button" class="ng-btn">Dobrze</button></div>';
        modal.querySelector('button.ng-btn').onclick = closeModal;
        modal.addEventListener('pointerdown', function (e) { if (e.target === modal) closeModal(); });
        root.appendChild(modal);
      }
      function useCan() {
        if (watering) return;
        var cs = canState();
        if (cs === 'done') { toast('Dziś już podlane. Jutro znowu!'); return; }
        if (cs === 'empty') { emptyCanModal(); return; }
        var list = [];
        for (var i = 0; i < plotCount(); i++) if (st.plots[i]) list.push(i);
        if (!list.length) { toast('Najpierw posadź nasionko.'); return; }
        var td = today();
        st.wateredDay = td;
        if (st.wet.indexOf(td) < 0) st.wet.push(td);
        save();
        watering = { start: performance.now(), per: Math.min(550, 3500 / list.length), list: list };
        updateBar();
      }

      // ---------- harvest ----------
      function harvest(i) {
        var pl = st.plots[i], P = BY[pl.k], c = cells[i];
        st.plots[i] = null;
        var first = !st.book[P.k];
        st.book[P.k] = (st.book[P.k] || 0) + 1;
        var back = Math.round((pl.paid || 0) * 0.5);
        if (back > 0) ctx.refund(back, 'zbiór: ' + P.n);
        save();
        for (var j = 0; j < 12; j++) particles.push({ x: c.baseX, y: c.baseY - c.k * 40, vx: (Math.random() - 0.5) * 220, vy: -120 - Math.random() * 120, life: 0.9, k: 'star', r: 5 });
        var br = bBook.getBoundingClientRect(), cr = cvWrap.getBoundingClientRect();
        flyers.push({ img: thumbCanvas(P, 96, false), x0: c.baseX, y0: c.baseY - c.k * 40, x1: br.left + br.width / 2 - cr.left, y1: Math.min(H - 10, br.top - cr.top), s: Math.max(60, c.k * 90), start: performance.now() });
        toast((first ? 'Nowość w zielniku: ' : 'Zebrane: ') + P.n + '!' + (back ? ' +' + back + ' ★' : ''));
        updateBar();
      }

      // ---------- input ----------
      var down = null;
      function onDown(e) { down = { x: e.clientX, y: e.clientY, id: e.pointerId }; }
      function onUp(e) {
        if (!down || down.id !== e.pointerId) return;
        var moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
        if (moved > 14) return;
        var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        if (info) { closeInfo(); }
        for (var i = 0; i < cells.length; i++) {
          var c = cells[i];
          if (x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h) { tapPlot(i); return; }
        }
      }
      function tapPlot(i) {
        var c = cells[i];
        if (c.locked) { toast('Nowa grządka na poziomie ' + nextPlotLevel() + '.'); return; }
        var pl = st.plots[i];
        if (!pl) { openShop(i); return; }
        var p = progress(pl, Date.now());
        if (p >= 1) harvest(i); else showInfo(i);
      }
      cv.addEventListener('pointerdown', onDown);
      cv.addEventListener('pointerup', onUp);
      bSeeds.onclick = function () { openShop(firstEmpty()); };
      bCan.onclick = useCan;
      banner.onclick = useCan;
      bBook.onclick = openBook;

      // ---------- inbox from other games ----------
      function takeInbox() {
        var arr = null;
        try { arr = JSON.parse(localStorage.getItem(INBOX) || 'null'); localStorage.removeItem(INBOX); } catch (e) { return; }
        if (!Array.isArray(arr) || !arr.length) return;
        var groups = {}, order = [];
        arr.forEach(function (it) {
          if (!it || !BY[it.kind]) return;
          var n = Math.max(1, Math.min(99, Math.floor(+it.n) || 1));
          st.pouch[it.kind] = (st.pouch[it.kind] || 0) + n;
          var f = FROM[it.from] || '';
          if (!groups[f]) { groups[f] = {}; order.push(f); }
          groups[f][it.kind] = (groups[f][it.kind] || 0) + n;
        });
        if (!order.length) return;
        save();
        order.forEach(function (f, gi) {
          var parts = Object.keys(groups[f]).map(function (k) { return BY[k].n + ' ×' + groups[f][k]; });
          later(function () { toast('Nowe nasiona' + (f ? ' ' + f : '') + ': ' + parts.join(', ')); }, 400 + gi * 2300);
        });
        updateBar();
        later(function () { bSeeds.classList.remove('bump'); void bSeeds.offsetWidth; bSeeds.classList.add('bump'); }, 500);
      }

      // ---------- boot ----------
      var ro = new ResizeObserver(function () { layout(); });
      ro.observe(cvWrap);
      var offS = S.on(function () { if (running) tick(); });
      var iv = setInterval(function () { if (running) tick(); }, 20000);
      layout();
      takeInbox();
      updateBar();
      start();
      if (!st.seenHelp) {
        st.seenHelp = true; save();
        ctx.panel({ title: 'Ogródek', lines: ['Dotknij grządki i posadź nasionko.', 'Podlewaj codziennie konewką, a rośliny urosną w kilka dni.', { text: 'Konewka napełnia się po zestawie w nauce.', muted: true }], button: 'Do ogródka', closable: false });
      }

      return {
        pause: function () { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
        resume: function () { if (running) return; running = true; lastDraw = 0; drawFrame.last = 0; takeInbox(); tick(); start(); },
        destroy: function () {
          running = false; if (raf) cancelAnimationFrame(raf); raf = 0;
          timers.forEach(clearTimeout); clearTimeout(infoTimer); clearInterval(iv);
          ro.disconnect(); offS();
          cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointerup', onUp);
          root.remove();
        }
      };
    }
  });
})();
