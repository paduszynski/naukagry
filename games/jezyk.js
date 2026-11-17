/*
 * Jeżyk w biegu: a hedgehog runs. Tap = jump, tap again in the air = higher jump (roll).
 * v2: stages instead of one endless run. Five worlds (Łąka, Las, Góry, Nad morzem, Zima), 3 stages each,
 * every stage ends at grandma's house and is rated 1-3 apples by the share of apples collected.
 * A stage gives 3 hearts; one mushroom per run gives a shield for one hit (more with upgrades).
 * 'Bez końca' is the old endless run (seasons change every 30 s, one hit ends it), unlocked after the first world.
 * Cosmetics (hats, scarf, glasses) unlocked by player level, bought once for 75 ★, chosen in the wardrobe.
 * Upgrades (map -> Ulepszenia), bought per level with stars, gated by player level, each can be switched off
 *   (off = exactly like not bought): Dodatkowe serduszko (hearts 3/4/5), Magnes na jabłka (apples within
 *   56/80 units fly to the hedgehog), Mocniejszy grzybek (the mushroom shield takes 1/2/3 hits).
 * Save (naukagry.jezyk): best, bestScore, bestSeason, runs, stages { '<idx>': best rating 1-3 },
 *   owned + wear (the wardrobe; Zwierzątko reads these two keys, do not rename them),
 *   up { k: bought level }, off { k: true when switched off }.
 * Logical coordinates: 1 unit = S css px, so a portrait phone is ~400 units wide whatever its size.
 */
(function () {
  'use strict';
  if (!window.NG) return;

  var INK = '#1d2f6f', GOLD = '#e3a008', PURPLE = '#7a4fc4';
  var FONT = '"Patrick Hand", "Comic Sans MS", cursive';
  var PRICE = 50, ITEM_PRICE = 75, SEASON_LEN = 30;
  var HOG_SC = 1.3;                 // hedgehog drawing scale
  // jumps are 1.5x longer than the original 2400/820/900 at the same height:
  // air time x1.5 -> jump speed x2/3, gravity x4/9
  var GRAV = 2400 * 4 / 9, JUMP = 820 * 2 / 3, JUMP2 = 900 * 2 / 3, GRAV_CRASH = 2400;
  var BRAKE = 170, RATE3 = 0.7, RATE2 = 0.4, STAGES = 15;

  // drawing styles: 0-3 are the endless-run seasons, 4-6 the extra worlds
  var STYLES = [
    { name: 'Wiosna', sky1: '#9fd6ff', sky2: '#e8f7ff', far: '#b9e4a3', near: '#93d273', grass: '#79c457', grass2: '#5ea844', dirt: '#b07f52', dirt2: '#966843', sun: '#ffd84a' },
    { name: 'Lato',   sky1: '#6fbff8', sky2: '#d6f0ff', far: '#9fd884', near: '#6fbf4f', grass: '#5fb243', grass2: '#4a9a35', dirt: '#a06f45', dirt2: '#875b37', sun: '#ffc928' },
    { name: 'Jesień', sky1: '#f2b979', sky2: '#fff0d8', far: '#dcb56d', near: '#c9984a', grass: '#b9a54c', grass2: '#9c8a3a', dirt: '#8f5e36', dirt2: '#774c2b', sun: '#ff9a3c' },
    { name: 'Zima',   sky1: '#a9c3e3', sky2: '#f0f5fc', far: '#e4ecf7', near: '#d3e0f0', grass: '#f7faff', grass2: '#d6e2f2', dirt: '#a3afc4', dirt2: '#8e9ab0', sun: '#fff3c4' },
    { name: 'Las',    sky1: '#9ed3c4', sky2: '#eaf7ec', far: '#6fae6a', near: '#4f9a55', grass: '#5aa04a', grass2: '#3f8538', dirt: '#8a6440', dirt2: '#6f4f31', sun: '#ffe27a' },
    { name: 'Góry',   sky1: '#8ec5f0', sky2: '#eef6ff', far: '#a9b8d6', near: '#8fc47a', grass: '#86c066', grass2: '#6aa44f', dirt: '#a7a39a', dirt2: '#8b877e', sun: '#ffd84a' },
    { name: 'Morze',  sky1: '#7cc8f5', sky2: '#e6f7ff', far: '#4fa8e0', near: '#f3dc9e', grass: '#f6e3ad', grass2: '#e9cf8c', dirt: '#e2c27f', dirt2: '#cfa968', sun: '#ffcf3a' }
  ];
  var SEASONS = STYLES.slice(0, 4);
  var WORLDS = [
    { name: 'Łąka',       style: 0, base: ['stone', 'puddle', 'log'], own: ['molehill', 'bee'], music: 'meadow', roof: '#e2533f', wall: '#fff4dc', warn: 'kretowiska i pszczoły' },
    { name: 'Las',        style: 4, base: ['stone', 'puddle', 'log'], own: ['cone', 'stump'], music: 'calm', roof: '#8a5a33', wall: '#f0d9b0', warn: 'toczące się szyszki i pieńki' },
    { name: 'Góry',       style: 5, base: ['stone', 'puddle'], own: ['boulder', 'bird'], music: 'sky', roof: '#5b6fa8', wall: '#f3ead8', warn: 'toczące się kamyki i ptaszki' },
    { name: 'Nad morzem', style: 6, base: ['stone', 'puddle'], own: ['crab', 'castle'], music: 'water', roof: '#3f86d8', wall: '#ffffff', warn: 'kraby i zamki z piasku' },
    { name: 'Zima',       style: 3, base: ['stone', 'puddle', 'log'], own: ['snowball', 'snowman'], music: 'cozy', roof: '#cf412d', wall: '#fff4dc', warn: 'śnieżki i bałwanki' }
  ];
  // stage idx 0..14: world = idx / 3, stage in world = idx % 3; longer and faster as it goes
  function stageCfg(idx) {
    return { idx: idx, w: Math.floor(idx / 3), j: idx % 3, len: 240 + idx * 25, v0: 215 + idx * 9, v1: 260 + idx * 12, g0: 1.25 - idx * 0.015, g1: 2.05 - idx * 0.02 };
  }
  var ITEMS = [
    { id: 'czapka',   name: 'Czapka',   slot: 'head', lvl: 2,  info: 'ciepła, z pomponem' },
    { id: 'szalik',   name: 'Szalik',   slot: 'neck', lvl: 4,  info: 'w paski, fruwa na wietrze' },
    { id: 'kokardka', name: 'Kokardka', slot: 'head', lvl: 6,  info: 'różowa, na czubek głowy' },
    { id: 'korona',   name: 'Korona',   slot: 'head', lvl: 8,  info: 'dla króla łąki' },
    { id: 'okulary',  name: 'Okulary',  slot: 'eyes', lvl: 10, info: 'przeciwsłoneczne' }
  ];
  // ---------- upgrades (map -> Ulepszenia): bought once per level with stars, kept forever, each can be switched off ----------
  // v: the value at each level (index 0 = not bought / switched off), price[i]: cost of level i+1, lv[i]: player level needed,
  // say[i]: what level i does
  var UPS = [
    { k: 'heart', n: 'Dodatkowe serduszko', v: [3, 4, 5], price: [500, 1200], lv: [3, 7],
      say: ['W etapie są 3 serduszka', 'W etapie są 4 serduszka', 'W etapie jest 5 serduszek'] },
    { k: 'magnet', n: 'Magnes na jabłka', v: [0, 56, 80], price: [600, 1300], lv: [2, 6],
      say: ['Jabłka trzeba złapać samemu', 'Jabłka tuż obok lecą do jeżyka', 'Magnes łapie jabłka z dalszej odległości'] },
    { k: 'shield', n: 'Mocniejszy grzybek', v: [1, 2, 3], price: [400, 900], lv: [1, 5],
      say: ['Tarcza z grzybka chroni raz', 'Tarcza wytrzyma 2 uderzenia', 'Tarcza wytrzyma 3 uderzenia'] }
  ];
  var UB = {}; UPS.forEach(function (U) { UB[U.k] = U; });
  var MAG_PULL = 14;   // how fast a magnet apple flies to the hedgehog (share of the distance per second)

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function hex(c) { var n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a, b, t) {
    if (t <= 0) return a; if (t >= 1) return b;
    var A = hex(a), B = hex(b);
    return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' + Math.round(A[1] + (B[1] - A[1]) * t) + ',' + Math.round(A[2] + (B[2] - A[2]) * t) + ')';
  }
  function pl(n, one, few, many) {
    if (n === 1) return one;
    var d = n % 10, h = n % 100;
    return (d >= 2 && d <= 4 && (h < 12 || h > 14)) ? few : many;
  }
  function seasonLabel(i) {
    var n = SEASONS[i % 4].name.toLowerCase();
    return i >= 4 ? n + ' (' + (Math.floor(i / 4) + 1) + '. rok)' : n;
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function outline(g, w) { g.lineWidth = w || 2; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
  function appleRow(n) { var s = ''; for (var i = 0; i < n; i++) s += '🍎'; return s; }

  // ---------- drawing: the hedgehog (side view, facing right, feet at y=0) ----------
  var APPLE_SPOTS = [262, 236, 290, 212, 316, 249, 276, 224, 303, 196, 256, 284];

  function drawApple(g, x, y, r, grey) {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = grey ? '#e3e8f2' : '#e2533f'; g.fill(); outline(g, Math.max(1, r * 0.28));
    if (!grey) { g.beginPath(); g.arc(x - r * 0.35, y - r * 0.3, r * 0.28, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill(); }
    g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x + r * 0.9, y - r * 1.7, x + r * 1.2, y - r * 1.05);
    g.quadraticCurveTo(x + r * 0.5, y - r * 0.9, x, y - r); g.fillStyle = grey ? '#c9d3e3' : '#3fae5f'; g.fill();
  }
  function heart(g, x, y, r, fill) {
    g.beginPath(); g.moveTo(x, y + r * 0.9);
    g.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.4, x, y - r * 0.5);
    g.bezierCurveTo(x + r * 0.7, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
    g.closePath(); g.fillStyle = fill; g.fill(); outline(g, Math.max(1.2, r * 0.2));
  }

  // wearables, each drawn around its own origin
  var WEAR = {
    czapka: function (g) {
      g.beginPath(); g.moveTo(-11, 2); g.quadraticCurveTo(-12, -15, 0, -16); g.quadraticCurveTo(12, -15, 11, 2); g.closePath();
      g.fillStyle = '#e2533f'; g.fill(); outline(g);
      g.beginPath(); g.moveTo(-5, -1); g.lineTo(-4, -12); g.moveTo(1, -1); g.lineTo(1, -14); g.moveTo(6, -1); g.lineTo(5, -12);
      g.strokeStyle = '#b8352a'; g.lineWidth = 1.5; g.stroke();
      rr(g, -13, -2, 26, 7, 3.5); g.fillStyle = '#fff'; g.fill(); outline(g);
      g.beginPath(); g.arc(0, -17, 4.5, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); outline(g);
    },
    korona: function (g) {
      g.beginPath(); g.moveTo(-11, 3); g.lineTo(-12, -9); g.lineTo(-6, -3); g.lineTo(0, -13); g.lineTo(6, -3); g.lineTo(12, -9); g.lineTo(11, 3); g.closePath();
      g.fillStyle = '#f5c330'; g.fill(); outline(g);
      g.beginPath(); g.moveTo(-10, 0); g.lineTo(10, 0); g.strokeStyle = GOLD; g.lineWidth = 2; g.stroke();
      [[-12, -9, '#3f86d8'], [0, -13, '#e2533f'], [12, -9, '#3fae5f']].forEach(function (p) {
        g.beginPath(); g.arc(p[0], p[1], 2.4, 0, Math.PI * 2); g.fillStyle = p[2]; g.fill(); outline(g, 1.2);
      });
    },
    kokardka: function (g) {
      g.fillStyle = '#ff7eb6';
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-12, -12, -13, -2); g.quadraticCurveTo(-12, 8, 0, 0); g.closePath(); g.fill(); outline(g);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(12, -12, 13, -2); g.quadraticCurveTo(12, 8, 0, 0); g.closePath(); g.fill(); outline(g);
      g.beginPath(); g.arc(0, 0, 3.6, 0, Math.PI * 2); g.fillStyle = '#e8559a'; g.fill(); outline(g, 1.6);
      g.beginPath(); g.arc(-7, -3, 1.4, 0, Math.PI * 2); g.arc(7, -3, 1.4, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
    },
    okulary: function (g) {
      g.beginPath(); g.moveTo(-4, -1); g.lineTo(-11, -3); outline(g, 1.8);
      g.beginPath(); g.ellipse(8.5, 0.5, 2.6, 4.2, 0, 0, Math.PI * 2); g.fillStyle = '#26305a'; g.fill(); outline(g, 1.5);
      g.beginPath(); g.moveTo(4, -1); g.lineTo(6.5, -0.5); outline(g, 1.6);
      g.beginPath(); g.arc(0, 0, 5.2, 0, Math.PI * 2); g.fillStyle = '#26305a'; g.fill(); outline(g, 1.8);
      g.beginPath(); g.moveTo(-2.5, -2); g.lineTo(0.5, -3.5); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.5; g.stroke();
    },
    szalikTail: function (g, t) {
      var w1 = Math.sin(t * 9) * 3, w2 = Math.sin(t * 9 + 1.5) * 4;
      g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-8, 1 + w1, -14, -2 + w2, -22, 2 + w2);
      g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 8.5; g.stroke();
      g.strokeStyle = '#3f86d8'; g.lineWidth = 5; g.stroke();
      g.setLineDash([3, 4]); g.lineCap = 'butt'; g.strokeStyle = '#fff'; g.lineWidth = 5; g.stroke(); g.setLineDash([]); g.lineCap = 'round';
    },
    szalik: function (g) {
      rr(g, -4.5, -11, 9, 22, 4.5); g.fillStyle = '#3f86d8'; g.fill();
      g.save(); g.clip();
      g.fillStyle = '#fff'; for (var y = -9; y < 12; y += 7) g.fillRect(-6, y, 12, 3);
      g.restore();
      rr(g, -4.5, -11, 9, 22, 4.5); outline(g);
    },
    // grandma only (not in the wardrobe): headscarf and round reading glasses
    chusta: function (g) {
      g.beginPath(); g.moveTo(-14, 5); g.quadraticCurveTo(-13, -12, 1, -13); g.quadraticCurveTo(15, -12, 15, 5); g.quadraticCurveTo(0, 1, -14, 5); g.closePath();
      g.fillStyle = '#9b6fd6'; g.fill(); outline(g);
      g.fillStyle = '#fff';
      [[-6, -4], [3, -8], [8, -1], [-1, 1]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 1.6, 0, Math.PI * 2); g.fill(); });
    },
    babcia: function (g) {
      g.beginPath(); g.arc(0, 0, 4.6, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill(); outline(g, 1.6);
      g.beginPath(); g.moveTo(-4.6, -1); g.lineTo(-11, -3); outline(g, 1.4);
    }
  };

  // st: { t, legs, air, apples, wear, shield, dizzy, roll }
  function drawHog(g, st) {
    var wear = st.wear || {}, t = st.t || 0;
    // feet: set wide apart where the belly curves up, so they show below the body; the foot swinging forward lifts a little
    var lg = st.legs || 0, lp = st.air ? 0 : Math.sin(lg) * 4.5, lf = st.air ? 0 : Math.cos(lg) * 1.4;
    g.fillStyle = '#5a3a22';
    g.beginPath(); g.ellipse(-11 + lp, -1.2 - Math.max(0, lf), 6, 4, 0, 0, Math.PI * 2); g.fill(); outline(g, 1.6);
    g.beginPath(); g.ellipse(12 - lp, -1.2 - Math.max(0, -lf), 6, 4, 0, 0, Math.PI * 2); g.fill(); outline(g, 1.6);
    // spiny back
    var cx = -2, cy = -17, N = 13, a0 = 160 * Math.PI / 180, a1 = 332 * Math.PI / 180;
    g.beginPath();
    for (var i = 0; i <= N * 2; i++) {
      var a = a0 + (a1 - a0) * i / (N * 2), r = i % 2 ? 28 : 19;
      if (i === 0) g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); else g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.lineTo(18, -5); g.quadraticCurveTo(8, 1, -4, 0); g.quadraticCurveTo(-18, -1, -21, -9); g.closePath();
    g.fillStyle = st.old ? '#9b7a5e' : '#8a5a33'; g.fill(); outline(g, 2.2);
    // spine texture
    g.beginPath();
    for (var j = 0; j < 9; j++) {
      var b = a0 + 0.2 + (a1 - a0 - 0.5) * j / 8;
      g.moveTo(cx + Math.cos(b) * 10, cy + Math.sin(b) * 10); g.lineTo(cx + Math.cos(b + 0.08) * 19, cy + Math.sin(b + 0.08) * 19);
    }
    g.strokeStyle = st.old ? '#7d6049' : '#6b4325'; g.lineWidth = 1.6; g.stroke();
    // belly
    g.beginPath(); g.ellipse(2, -6, 13, 5, 0, 0, Math.PI); g.fillStyle = '#c8945e'; g.fill();
    // apples stuck on the spines
    for (var k = 0; k < Math.min(st.apples || 0, APPLE_SPOTS.length); k++) {
      var aa = APPLE_SPOTS[k] * Math.PI / 180, ar = k % 2 ? 22 : 25;
      drawApple(g, cx + Math.cos(aa) * ar, cy + Math.sin(aa) * ar + 1, 4.6);
    }
    // scarf tail fluttering back over the side (its root hides behind the head and the knot)
    if (wear.neck === 'szalik') { g.save(); g.translate(2, -10); WEAR.szalikTail(g, t); g.restore(); }
    // ear + face + snout
    g.beginPath(); g.arc(8, -24, 4, 0, Math.PI * 2); g.fillStyle = '#e4b98a'; g.fill(); outline(g, 1.6);
    g.beginPath();
    g.moveTo(3, -22); g.quadraticCurveTo(14, -27, 22, -18); g.quadraticCurveTo(28, -15, 32, -12);
    g.quadraticCurveTo(28, -7, 20, -6); g.quadraticCurveTo(10, -2, 3, -6); g.quadraticCurveTo(-1, -14, 3, -22); g.closePath();
    g.fillStyle = '#f0cf9f'; g.fill(); outline(g, 2);
    g.beginPath(); g.arc(31.5, -12.5, 3, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
    g.beginPath(); g.arc(18, -10, 2.8, 0, Math.PI * 2); g.fillStyle = 'rgba(255,120,140,.45)'; g.fill();
    if (wear.neck === 'szalik') { g.save(); g.translate(4, -12); g.rotate(-0.25); WEAR.szalik(g); g.restore(); }
    // eye
    if (st.dizzy) {
      g.beginPath(); g.moveTo(14, -19); g.lineTo(19, -14); g.moveTo(19, -19); g.lineTo(14, -14); outline(g, 1.8);
    } else if (st.happy) {
      g.beginPath(); g.moveTo(14, -15.5); g.quadraticCurveTo(16.5, -19, 19, -15.5); outline(g, 1.8);
    } else {
      var blink = (t % 3.2) > 3.05;
      if (blink) { g.beginPath(); g.moveTo(14, -16.5); g.quadraticCurveTo(16.5, -15, 19, -16.5); outline(g, 1.8); }
      else {
        g.beginPath(); g.arc(16.5, -16.5, 2.6, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
        g.beginPath(); g.arc(17.3, -17.4, 0.9, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
      }
    }
    // smile
    g.beginPath(); g.moveTo(24, -9); g.quadraticCurveTo(26.5, -7.5, 28.5, -9); outline(g, 1.4);
    if (wear.eyes === 'okulary' || wear.eyes === 'babcia') { g.save(); g.translate(16.5, -16.5); WEAR[wear.eyes](g); g.restore(); }
    if (wear.head) {
      g.save();
      if (wear.head === 'kokardka') { g.translate(4, -31); g.rotate(-0.15); }
      else if (wear.head === 'chusta') { g.translate(6, -26); g.rotate(0.22); }
      else { g.translate(10, -30); g.rotate(0.32); }
      WEAR[wear.head](g); g.restore();
    }
    if (st.dizzy) {
      for (var d = 0; d < 3; d++) {
        var da = t * 5 + d * 2.1;
        star(g, 8 + Math.cos(da) * 16, -40 + Math.sin(da) * 5, 4, '#f5c330');
      }
    }
    if (st.shield) {
      var pr = 37 + Math.sin(t * 6) * 1.5;
      g.beginPath(); g.arc(5, -20, pr, 0, Math.PI * 2);
      g.fillStyle = 'rgba(140,210,255,.22)'; g.fill();
      g.lineWidth = 2.5; g.strokeStyle = 'rgba(63,134,216,.85)'; g.stroke();
      g.beginPath(); g.arc(5, -20, pr - 6, -2.4, -1.6); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.stroke();
    }
  }

  function star(g, x, y, r, col) {
    g.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
    }
    g.closePath(); g.fillStyle = col; g.fill(); outline(g, Math.max(1, r * 0.25));
  }

  function drawMushroom(g, x, y, t) {
    var glow = 0.5 + 0.5 * Math.sin(t * 5);
    g.beginPath(); g.arc(x, y - 8, 22 + glow * 3, 0, Math.PI * 2); g.fillStyle = 'rgba(255,240,150,' + (0.25 + glow * 0.2) + ')'; g.fill();
    rr(g, x - 6, y - 8, 12, 16, 5); g.fillStyle = '#fff4dc'; g.fill(); outline(g);
    g.beginPath(); g.moveTo(x - 17, y - 6); g.quadraticCurveTo(x - 17, y - 26, x, y - 26); g.quadraticCurveTo(x + 17, y - 26, x + 17, y - 6); g.closePath();
    g.fillStyle = '#e2533f'; g.fill(); outline(g);
    g.fillStyle = '#fff';
    [[-8, -15, 3.4], [4, -20, 3], [9, -11, 2.6], [-2, -10, 2]].forEach(function (p) { g.beginPath(); g.arc(x + p[0], y + p[1], p[2], 0, Math.PI * 2); g.fill(); });
    for (var i = 0; i < 3; i++) {
      var a = t * 2 + i * 2.1;
      star(g, x + Math.cos(a) * 24, y - 12 + Math.sin(a) * 16, 3.2, '#ffe066');
    }
  }

  // a horseshoe magnet, centre at 0,0, about 40 units tall, poles pointing down
  function drawMagnet(g, s) {
    g.save(); g.scale(s, s);
    g.beginPath(); g.moveTo(-18, 14); g.lineTo(-18, -2); g.arc(0, -2, 18, Math.PI, 0); g.lineTo(18, 14);
    g.lineTo(8, 14); g.lineTo(8, -2); g.arc(0, -2, 8, 0, Math.PI, true); g.lineTo(-8, 14); g.closePath();
    g.fillStyle = '#e2533f'; g.fill(); outline(g, 2.5);
    [-13, 13].forEach(function (x) { rr(g, x - 5, 10, 10, 9, 2); g.fillStyle = '#dfe6f2'; g.fill(); outline(g, 2); });
    g.beginPath(); g.arc(0, -2, 13, Math.PI * 1.15, Math.PI * 1.45); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; g.stroke();
    g.restore();
  }
  // upgrade pictures for the shop, centre at 0,0, about 80 units across
  function drawUp(g, k) {
    if (k === 'heart') {
      heart(g, -4, 4, 30, '#e2533f');
      g.beginPath(); g.ellipse(-16, -8, 6, 4, -0.6, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.6)'; g.fill();
      g.beginPath(); g.arc(24, -22, 13, 0, Math.PI * 2); g.fillStyle = GOLD; g.fill(); outline(g, 2.5);
      g.fillStyle = '#fff'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('+', 24, -21);
    } else if (k === 'magnet') {
      g.save(); g.translate(-10, -6); g.rotate(-0.5); drawMagnet(g, 1.35); g.restore();
      g.strokeStyle = 'rgba(63,134,216,.8)'; g.lineWidth = 2.5; g.lineCap = 'round';
      [[12, 16, 22], [16, 22, 30]].forEach(function (a) { g.beginPath(); g.arc(4, 8, a[2], -0.2, 0.9); g.stroke(); });
      drawApple(g, 26, 24, 10);
    } else if (k === 'shield') {
      g.beginPath(); g.arc(0, 0, 36, 0, Math.PI * 2); g.fillStyle = 'rgba(140,210,255,.35)'; g.fill();
      g.lineWidth = 3; g.strokeStyle = 'rgba(63,134,216,.9)'; g.stroke();
      g.beginPath(); g.arc(0, 0, 30, -2.5, -1.6); g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 3.5; g.stroke();
      g.save(); g.translate(0, 14); g.scale(1.2, 1.2);
      rr(g, -6, -8, 12, 16, 5); g.fillStyle = '#fff4dc'; g.fill(); outline(g);
      g.beginPath(); g.moveTo(-17, -6); g.quadraticCurveTo(-17, -26, 0, -26); g.quadraticCurveTo(17, -26, 17, -6); g.closePath();
      g.fillStyle = '#e2533f'; g.fill(); outline(g);
      g.fillStyle = '#fff';
      [[-8, -15, 3.4], [4, -20, 3], [9, -11, 2.6], [-2, -10, 2]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], p[2], 0, Math.PI * 2); g.fill(); });
      g.restore();
    }
  }

  // grandma's house; x = centre, gy = ground line; the door is on the left (towards the hedgehog)
  function drawHouse(g, x, gy, Wd, snow, t) {
    var hw = 104, hh = 70, x0 = x - hw / 2;
    // smoke
    for (var i = 0; i < 3; i++) {
      var k = ((t * 0.5 + i / 3) % 1);
      g.beginPath(); g.arc(x0 + hw * 0.72 + 7 + Math.sin(k * 6 + i) * 5 + k * 10, gy - hh - 46 - k * 50, 5 + k * 8, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,255,' + (0.75 * (1 - k)) + ')'; g.fill();
    }
    rr(g, x0 + hw * 0.72, gy - hh - 44, 14, 34, 2); g.fillStyle = '#c0604a'; g.fill(); outline(g, 2);
    rr(g, x0, gy - hh, hw, hh + 1, 5); g.fillStyle = Wd.wall; g.fill(); outline(g, 2.5);
    g.beginPath(); g.moveTo(x0 - 12, gy - hh + 6); g.lineTo(x, gy - hh - 46); g.lineTo(x0 + hw + 12, gy - hh + 6); g.closePath();
    g.fillStyle = Wd.roof; g.fill(); outline(g, 2.5);
    if (snow) {
      g.beginPath(); g.moveTo(x0 - 12, gy - hh + 6); g.lineTo(x, gy - hh - 46); g.lineTo(x0 + hw + 12, gy - hh + 6);
      g.lineTo(x0 + hw + 2, gy - hh + 2); g.quadraticCurveTo(x + 20, gy - hh - 26, x, gy - hh - 36); g.quadraticCurveTo(x - 24, gy - hh - 22, x0 - 4, gy - hh + 2); g.closePath();
      g.fillStyle = '#fff'; g.fill(); outline(g, 1.5);
    }
    // round window in the roof
    g.beginPath(); g.arc(x, gy - hh - 16, 8, 0, Math.PI * 2); g.fillStyle = '#ffe9a3'; g.fill(); outline(g, 2);
    // door
    g.beginPath(); g.moveTo(x0 + 14, gy); g.lineTo(x0 + 14, gy - 32); g.arc(x0 + 27, gy - 32, 13, Math.PI, 0); g.lineTo(x0 + 40, gy); g.closePath();
    g.fillStyle = '#8a5a33'; g.fill(); outline(g, 2);
    g.beginPath(); g.arc(x0 + 35, gy - 20, 2, 0, Math.PI * 2); g.fillStyle = '#f5c330'; g.fill();
    // window
    rr(g, x0 + 56, gy - 52, 32, 26, 4); g.fillStyle = '#ffe9a3'; g.fill(); outline(g, 2);
    g.beginPath(); g.moveTo(x0 + 72, gy - 52); g.lineTo(x0 + 72, gy - 26); g.moveTo(x0 + 56, gy - 39); g.lineTo(x0 + 88, gy - 39); outline(g, 1.6);
    // flower box
    rr(g, x0 + 54, gy - 26, 36, 7, 2); g.fillStyle = '#b07f52'; g.fill(); outline(g, 1.5);
    ['#ff7eb6', '#f5c330', '#e2533f'].forEach(function (c, n) { g.beginPath(); g.arc(x0 + 62 + n * 10, gy - 29, 3.2, 0, Math.PI * 2); g.fillStyle = snow ? '#fff' : c; g.fill(); });
  }

  NG.register('jezyk', {
    meta: {
      name: 'Jeżyk w biegu', price: '50 ★ za bieg', bg: '#e2f4ff', music: 'meadow',
      pic: '<rect x="0" y="62" width="120" height="10" fill="#8fd06b"/><ellipse cx="88" cy="63" rx="16" ry="4" fill="#3f86d8"/><path d="M28 60 a16 14 0 0 1 32 0 z" fill="#8a5a33" stroke="#1d2f6f" stroke-width="2"/><path d="M30 50 l-4 -6 l6 1 l0 -7 l5 4 l2 -7 l4 6 l4 -6 l2 7 l5 -4 l0 7 l6 -1 l-4 6" fill="none" stroke="#1d2f6f" stroke-width="2.5" stroke-linejoin="round"/><circle cx="56" cy="54" r="1.8" fill="#1d2f6f"/><circle cx="102" cy="34" r="6" fill="#e2533f"/>'
    },
    medals: [
      { id: 'st3', stat: 'stages', at: 3, tier: 1, text: '3 etapy' },
      { id: 'st9', stat: 'stages', at: 9, tier: 2, text: '9 etapów' },
      { id: 'st15', stat: 'stages', at: 15, tier: 3, text: 'Wszystkie 15 etapów' }
    ],
    quests: [
      { id: 'apples', stat: 'apples', n: [25, 40], text: 'Zbierz {n} jabłek w Jeżyku' },
      { id: 'stage', stat: 'cleared', n: [1, 2], text: 'Ukończ {n} {etap} w Jeżyku', forms: ['etap', 'etapy', 'etapów'] }
    ],
    stickers: [
      { id: 'w0', emoji: '🌼', name: 'Łąka przebiegnięta' },
      { id: 'w1', emoji: '🌲', name: 'Las przebiegnięty' },
      { id: 'w2', emoji: '⛰️', name: 'Góry przebiegnięte' },
      { id: 'w3', emoji: '🦀', name: 'Plaża przebiegnięta' },
      { id: 'w4', emoji: '⛄', name: 'Zima przebiegnięta' },
      { id: 'apples3', emoji: '🍎', name: 'Trzy jabłka w etapie' }
    ],
    mount: function (el, ctx) {
      var save = ctx.load({ best: 0, bestScore: 0, bestSeason: 0, runs: 0, stages: {}, owned: {}, wear: { head: null, neck: null, eyes: null } });
      if (!save.wear || typeof save.wear !== 'object') save.wear = { head: null, neck: null, eyes: null };
      if (!save.owned || typeof save.owned !== 'object') save.owned = {};
      if (!save.stages || typeof save.stages !== 'object' || Array.isArray(save.stages)) save.stages = {};
      // upgrades: up[k] = bought level, off[k] = true when the player switched it off (then it works like level 0)
      if (!save.up || typeof save.up !== 'object' || Array.isArray(save.up)) save.up = {};
      if (!save.off || typeof save.off !== 'object' || Array.isArray(save.off)) save.off = {};
      UPS.forEach(function (U) {
        var n = Math.floor(+save.up[U.k] || 0);
        if (n > 0) save.up[U.k] = clamp(n, 0, U.v.length - 1); else delete save.up[U.k];
        if (save.off[U.k] !== true || !save.up[U.k]) delete save.off[U.k];
      });
      function upLv(k) { return clamp(save.up[k] | 0, 0, UB[k].v.length - 1); }
      function upOn(k) { return upLv(k) > 0 && !save.off[k]; }
      function upV(k) { return UB[k].v[upOn(k) ? upLv(k) : 0]; }
      var reduced = false;
      try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

      var css = document.createElement('style');
      css.textContent = [
        '.jz-map{position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;background:#eaf5ff;color:' + INK + ';font-family:' + FONT + '}',
        '.jz-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px 6px;max-width:600px;width:100%;margin:0 auto;box-sizing:border-box}',
        '.jz-head h2{margin:0;font-weight:400;font-size:2rem;line-height:1}',
        '.jz-tot{display:flex;align-items:center;gap:4px;background:#fff;border:2px solid ' + INK + ';border-radius:14px;padding:2px 10px;font-size:1.3rem;white-space:nowrap}',
        '.jz-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:4px 12px 16px;display:flex;flex-direction:column;align-items:center;gap:12px}',
        '.jz-world{position:relative;flex:none;width:100%;max-width:576px;aspect-ratio:360/210;border:3px solid ' + INK + ';border-radius:20px;overflow:hidden;background:#fff;box-sizing:border-box}',
        '.jz-world svg{display:block;width:100%;height:100%}',
        '.jz-world.locked .jz-bg{filter:grayscale(.85);opacity:.55}',
        '.jz-tag{position:absolute;top:7px;background:#fff;border:2px solid ' + INK + ';border-radius:14px;padding:0 10px;font-size:1.3rem;line-height:1.5}',
        '.jz-lock{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;border:2px solid ' + INK + ';border-radius:14px;padding:2px 12px;font-size:1.2rem;white-space:nowrap;display:flex;align-items:center;gap:6px}',
        '.jz-node{position:absolute;width:52px;height:52px;transform:translate(-50%,-50%);border-radius:50%;border:3px solid ' + INK + ';background:#fff;color:' + INK + ';font:inherit;font-size:1.7rem;line-height:1;padding:0;box-shadow:0 3px 0 ' + INK + ';cursor:pointer;display:flex;align-items:center;justify-content:center}',
        '.jz-node:active{transform:translate(-50%,calc(-50% + 2px));box-shadow:0 1px 0 ' + INK + '}',
        '.jz-node.next{background:#ffd84a;animation:jzp 1.4s ease-in-out infinite}',
        '.jz-node.done{background:#dff3d2}',
        '.jz-node[disabled]{background:#e6e9f2;box-shadow:none;cursor:default}',
        '.jz-node .ap{position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:3px;pointer-events:none}',
        '@keyframes jzp{0%,100%{box-shadow:0 3px 0 ' + INK + ',0 0 0 0 rgba(227,160,8,.6)}50%{box-shadow:0 3px 0 ' + INK + ',0 0 0 9px rgba(227,160,8,0)}}',
        '@media (prefers-reduced-motion: reduce){.jz-node.next{animation:none}}',
        '.jz-foot{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;padding:8px 12px calc(10px + env(safe-area-inset-bottom,0px));border-top:3px solid ' + INK + ';background:#fff}',
        '.jz-foot .ng-btn{line-height:1.05;min-height:48px}',
        '.jz-foot small{display:block;font-size:.95rem;opacity:.8}',
        '.jz-up{display:flex;align-items:center;gap:10px;border:2px solid #d4def0;border-radius:14px;padding:6px 8px;text-align:left;background:#fff}',
        '.jz-up.top{background:#f3fbe9;border-color:#8fd06b}',
        '.jz-up.lock{opacity:.6}.jz-up.lock canvas{filter:grayscale(1)}',
        '.jz-up.off canvas{filter:grayscale(.8);opacity:.6}',
        '.jz-up .tx{flex:1;min-width:0;line-height:1.1}',
        '.jz-up .tx b{font-weight:400;font-size:1.3rem;display:block}',
        '.jz-up .tx small{display:block;color:#5a6690;font-size:1rem}',
        '.jz-up .dots{display:flex;gap:4px;margin:3px 0 2px}.jz-up .dots i{width:14px;height:14px;border-radius:50%;border:2px solid ' + INK + ';background:#fff;box-sizing:border-box}.jz-up .dots i.on{background:' + GOLD + '}',
        '.jz-up.off .dots i.on{background:#c9d3e3}',
        '.jz-buy{flex:none;min-width:84px;min-height:46px;border:3px solid ' + INK + ';border-radius:14px;background:' + GOLD + ';color:#2a1d00;font:inherit;font-size:1.25rem;box-shadow:0 3px 0 ' + INK + ';cursor:pointer;padding:2px 8px}',
        '.jz-buy[disabled]{background:#e6e9f2;color:#5a6690;box-shadow:none;cursor:default}',
        '.jz-buy:active{transform:translateY(2px);box-shadow:0 1px 0 ' + INK + '}',
        '.jz-lockt{flex:none;font-size:1.05rem;color:#5a6690;text-align:center;max-width:76px;line-height:1.1}',
        '.jz-done{flex:none;font-size:1.8rem;color:#2a8a56;min-width:46px;text-align:center}',
        '.jz-tog{display:inline-flex;align-items:center;gap:6px;margin-top:5px;min-height:36px;border:2px solid ' + INK + ';border-radius:18px;padding:2px 10px 2px 4px;font:inherit;font-size:1.1rem;cursor:pointer;background:#dff3d2;color:' + INK + '}',
        '.jz-tog i{position:relative;width:34px;height:20px;border-radius:10px;background:#3fae5f;border:2px solid ' + INK + ';box-sizing:border-box;flex:none}',
        '.jz-tog i::after{content:"";position:absolute;top:1px;left:15px;width:14px;height:14px;border-radius:50%;background:#fff;border:1.5px solid ' + INK + ';box-sizing:border-box;transition:left .15s}',
        '.jz-tog.off{background:#eef1f7;color:#5a6690}.jz-tog.off i{background:#c9d3e3}.jz-tog.off i::after{left:1px}'
      ].join('\n');
      el.appendChild(css);

      var cv = document.createElement('canvas');
      el.appendChild(cv);
      var g = cv.getContext('2d');
      var W = 1, H = 1, DPR = 1, S = 1, LW = 400, LH = 700, GY = 470;

      function resize() {
        var r = el.getBoundingClientRect();
        W = Math.max(1, r.width); H = Math.max(1, r.height);
        DPR = Math.min(3, window.devicePixelRatio || 1);
        cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
        S = clamp(Math.min(W / 400, H / 700), 0.6, 2.6);
        LW = W / S; LH = H / S; GY = Math.round(LH * 0.68);
        if (!raf) draw();
      }

      // ---------- world state ----------
      var state = 'idle';     // idle | run | pause | crash | finish | done | over
      var clock = 0;          // always ticking, for idle animation
      var R = null;           // current run
      var style = 0;          // drawing style outside the endless run (world being played / previewed)
      var bg = { far: 0, near: 0, ground: 0, trees: [], decor: [], clouds: [], parts: [] };
      var panel = null, wardrobe = null, shop = null, mapEl = null, music = 'meadow';
      var god = false, timeScale = 1;   // test hooks only

      function curSeason() { return R && R.mode === 'endless' ? R.season : 0; }
      function curStyle() { return R && R.mode === 'endless' ? R.season % 4 : style; }

      function seedBackground() {
        var s = curStyle();
        bg.trees = []; bg.decor = []; bg.clouds = []; bg.parts = [];
        var x = -40;
        while (x < LW + 200) { bg.trees.push(makeTree(x, s)); x += treeGap(s); }
        for (var y = 0; y < 40; y++) bg.decor.push(makeDecor(rnd(-20, LW + 300), s));
        for (var c = 0; c < 4; c++) bg.clouds.push({ x: rnd(0, LW + 100), y: rnd(40, GY * 0.45), s: rnd(0.7, 1.25) });
        for (var p = 0; p < 26; p++) bg.parts.push(makePart(s, true));
      }
      function treeGap(s) { return s === 4 ? rnd(45, 110) : s === 5 ? rnd(130, 260) : s === 6 ? rnd(140, 280) : rnd(80, 190); }
      function makeTree(x, s) { return { x: x, s: rnd(0.75, 1.25), season: s, kind: Math.random() < 0.5 ? 0 : 1, seed: Math.random() * 10 }; }
      var DECOR = [['tulip', 'daisy', 'tuft', 'tulip'], ['daisy', 'tuft', 'sunflower', 'tuft'], ['leaf', 'tuft', 'pumpkin', 'leaf'], ['snow', 'snow', 'tuft', 'snow'],
        ['fern', 'shroom', 'tuft', 'fern', 'leaf'], ['pebble', 'daisy', 'tuft', 'pebble'], ['shell', 'starfish', 'pebble', 'shell']];
      function makeDecor(x, s) {
        var kinds = DECOR[s];
        return { x: x, k: kinds[(Math.random() * kinds.length) | 0], y: Math.random(), c: (Math.random() * 3) | 0, season: s };
      }
      function makePart(s, anywhere) {
        return { x: rnd(0, LW), y: anywhere ? rnd(0, LH) : rnd(-60, -10), vx: rnd(-30, -10), vy: rnd(25, 60), a: rnd(0, 6.28), sp: rnd(1, 3), s: rnd(0.7, 1.3), season: s };
      }
      function setStyle(s) { if (style !== s || !bg.trees.length) { style = s; seedBackground(); } }
      function setMusic(th) { if (th !== music) { music = th; ctx.music(th); } }

      function newRun(mode, c) {
        R = {
          mode: mode, cfg: c || null, world: c ? c.w : 0, L: c ? c.len * 40 : 0, hearts: c ? upV('heart') : null, maxHearts: c ? upV('heart') : 0,
          mag: upV('magnet'), shieldHits: upV('shield'),
          t: 0, v: c ? c.v0 : 230, dist: 0, apples: 0, spawned: 0, h: 0, vy: 0, ground: true, dbl: false, roll: 0, legs: 0,
          shield: 0, inv: 0, ouch: 0, obs: [], items: [], pops: [], fx: [], gap: 420, mushT: c ? rnd(8, 20) : rnd(18, 42), mushDone: false,
          season: 0, banner: 0, buffer: 0, crashT: 0, record: false,
          brakeA: 0, stopped: false, stopT: 0, rating: 0, shown: 0, hops: 0, ended: false
        };
      }

      // ---------- input ----------
      function tap() {
        if (state === 'pause') { state = 'run'; return; }
        if (state !== 'run') return;
        if (R.ground) { R.vy = JUMP; R.ground = false; R.dbl = false; ctx.sfx('jump'); }
        else if (!R.dbl) { R.dbl = true; R.vy = JUMP2; R.roll = 0.0001; ctx.sfx('whoosh'); }
        else R.buffer = 0.15;
      }
      function onDown(e) { if (e.button > 0) return; e.preventDefault(); tap(); }
      function onKey(e) { if (e.code === 'Space' || e.code === 'ArrowUp') { if (state === 'run' || state === 'pause') { e.preventDefault(); tap(); } } }
      cv.addEventListener('pointerdown', onDown);
      window.addEventListener('keydown', onKey);

      // ---------- spawning ----------
      function obsOf(k, x) {
        switch (k) {
          case 'stone': return { type: 'stone', x: x, w: rnd(30, 40), h: rnd(22, 28) };
          case 'log': return { type: 'log', x: x, w: rnd(60, 76), h: 28 };
          case 'puddle': return { type: 'puddle', x: x, w: rnd(70, 100), h: 0 };
          case 'bigpuddle': return { type: 'puddle', x: x, w: rnd(120, 150), h: 0 };
          case 'bee': return { type: 'bee', x: x, w: 30, h: 0, fly: 90, ph: rnd(0, 6), spd: 45 };
          case 'bird': return { type: 'bird', x: x, w: 30, h: 0, fly: 92, ph: rnd(0, 6), spd: 60 };
          case 'molehill': return { type: 'molehill', x: x, w: rnd(40, 48), h: 24 };
          case 'stump': return { type: 'stump', x: x, w: rnd(38, 44), h: 32 };
          case 'castle': return { type: 'castle', x: x, w: 46, h: 34 };
          case 'snowman': return { type: 'snowman', x: x, w: 36, h: 40 };
          // rolling / walking ones come at the hedgehog a bit faster than the ground
          case 'cone': return { type: 'cone', x: x, w: 26, h: 24, spd: 70, roll: true, rot: 0 };
          case 'boulder': return { type: 'boulder', x: x, w: 34, h: 32, spd: 55, roll: true, rot: 0, seed: Math.random() * 6 };
          case 'snowball': return { type: 'snowball', x: x, w: 32, h: 30, spd: 75, roll: true, rot: 0 };
          case 'crab': return { type: 'crab', x: x, w: 38, h: 22, spd: 40, roll: true, ph: rnd(0, 6) };
        }
        return { type: 'stone', x: x, w: 34, h: 24 };
      }
      function stagePool(p) {
        var c = R.cfg, Wd = WORLDS[c.w], pool = Wd.base.slice();
        if (c.idx === 0 && p < 0.3) pool = ['stone', 'puddle'];
        if (p > 0.08) pool.push(Wd.own[0], Wd.own[0]);
        if ((c.j === 0 && p > 0.55) || (c.j >= 1 && p > 0.25) || (c.j === 2 && p > 0.12)) pool.push(Wd.own[1], Wd.own[1]);
        if (c.j === 2 && p > 0.5) pool.push('pair', 'bigpuddle');
        return pool;
      }
      function endlessPool(t) {
        var pool = ['stone', 'puddle', 'stone', 'puddle'];
        if (t > 12) pool.push('log', 'log');
        if (t > 35) pool.push('bee', 'bee');
        if (t > 55) pool.push('pair', 'bigpuddle');
        return pool;
      }
      function spawn() {
        var t = R.t, x = LW + 40, v = R.v, stage = R.mode === 'stage', gap;
        if (stage) {
          // keep the run-up to grandma's house clear
          if (R.dist + (x - 90) + 200 > R.L - 260) { R.gap = 1e9; return; }
          gap = v * rnd(R.cfg.g0, R.cfg.g1) + 90 + (t < 6 ? v * 0.6 : 0);
        } else gap = v * rnd(1.05, 1.9) + 90 + (t < 20 ? v * 0.6 : 0);
        if (!R.mushDone && t >= R.mushT) {
          R.mushDone = true;
          R.items.push({ type: 'mush', x: x + 20, y: 30 });
          R.gap = v * 1.1 + 160; return;
        }
        // the jump arc gets longer as the hedgehog speeds up (same air time, more ground covered),
        // so apples placed along a jump spread out with speed; spacing was tuned at the start speed 230
        var sv = Math.max(1, v / 230);
        var pool = stage ? stagePool(R.dist / R.L) : endlessPool(t);
        var k = pool[(Math.random() * pool.length) | 0], o, w = 0;
        if (k === 'pair') {
          var d = v * 0.36;
          R.obs.push({ type: 'stone', x: x, w: 32, h: 24 });
          R.obs.push({ type: 'stone', x: x + d, w: 32, h: 24 });
          w = d + 32; gap += d;
          if (Math.random() < 0.6) { var pa = 54 * sv; apples([[x + d / 2, 150], [x + d / 2 - pa, 128], [x + d / 2 + pa, 128]]); }
        } else {
          o = obsOf(k, x); w = o.w;
          if (o.fly) gap += v * 0.4;
          // a roller starts further right so it reaches the hedgehog when a still obstacle at x would;
          // apples for it are placed around x as usual and meet the hedgehog at the same moment
          if (o.roll) o.x = 90 + (x - 90) * (v + o.spd) / v;
          R.obs.push(o);
          if (o.fly) apples([[x - 30, 22], [x, 22], [x + 30, 22]]);
          else if (Math.random() < 0.5) { var c = x + w / 2, ja = 66 * sv; apples([[c - ja, 95], [c, 135], [c + ja, 95]]); }
        }
        if (Math.random() < 0.3) {
          // a row on the ground after the obstacle, where a jump over it lands (further at higher speed)
          var gx = x + Math.max(w + (gap - w) * 0.3, v * 0.9);
          if (gx + 68 < x + gap - v * 0.3) apples([[gx, 22], [gx + 34, 22], [gx + 68, 22]]);
        }
        R.gap = gap;
      }
      function apples(list) {
        list.forEach(function (p) {
          // nothing to collect in front of grandma's house (the hedgehog is braking there)
          if (R.mode === 'stage' && R.dist + p[0] - 90 > R.L - BRAKE - 40) return;
          R.spawned++; R.items.push({ type: 'apple', x: p[0], y: p[1], ph: Math.random() * 6 });
        });
      }

      // ---------- update ----------
      function scroll(dx, s) {
        bg.far += dx * 0.12; bg.near += dx * 0.3; bg.ground += dx;
        bg.trees.forEach(function (tr) { tr.x -= dx * 0.45; });
        bg.trees = bg.trees.filter(function (tr) { return tr.x > -90; });
        var lastT = bg.trees.length ? bg.trees[bg.trees.length - 1].x : 0;
        while (lastT < LW + 120) { lastT += treeGap(s); bg.trees.push(makeTree(lastT, s)); }
        bg.decor.forEach(function (d) { d.x -= dx; });
        bg.decor = bg.decor.filter(function (d) { return d.x > -40; });
        while (bg.decor.length < 40) bg.decor.push(makeDecor(LW + rnd(10, 300), s));
        bg.clouds.forEach(function (c) { c.x -= dx * 0.06; });
      }

      function update(dt) {
        clock += dt;
        bg.clouds.forEach(function (c) { c.x -= 5 * dt; if (c.x < -120) { c.x = LW + rnd(40, 160); c.y = rnd(40, GY * 0.45); } });
        var s = curStyle(), moving = state === 'run' || (state === 'finish' && !R.stopped);
        bg.parts.forEach(function (p) {
          p.x += (p.vx - (moving ? R.v * 0.15 : 0)) * dt; p.y += p.vy * dt; p.a += p.sp * dt;
          if (p.y > LH + 10 || p.x < -20) { var np = makePart(s, false); for (var k in np) p[k] = np[k]; }
        });
        if (state === 'run') updateRun(dt);
        else if (state === 'crash') updateCrash(dt);
        else if (state === 'finish' || state === 'done') updateFinish(dt);
      }

      // move everything on the ground by dx (and timers by dt)
      function moveWorld(dx, dt) {
        var r = R;
        scroll(dx, curStyle());
        r.obs.forEach(function (o) {
          o.x -= dx;
          if (o.spd) o.x -= o.spd * dt;
          if (o.ph != null) o.ph += dt * 4;
          if (o.rot != null) o.rot -= (dx + o.spd * dt) / (o.h / 2);
          if (o.ko != null) o.ko += dt * 1.6;
        });
        r.obs = r.obs.filter(function (o) { return o.x + o.w > -80 && !(o.ko >= 1); });
        r.items.forEach(function (it) { it.x -= dx; it.ph = (it.ph || 0) + dt * 3; });
        r.items = r.items.filter(function (it) { return it.x > -40 && !it.got; });
        r.pops.forEach(function (p) { p.t += dt; p.x -= dx * 0.5; });
        r.pops = r.pops.filter(function (p) { return p.t < 0.9; });
        r.fx.forEach(function (f) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += (f.g || 0) * dt; f.a += (f.va || 0) * dt; });
        r.fx = r.fx.filter(function (f) { return f.t < f.life; });
      }

      function air(r, dt) {
        if (r.ground) return;
        r.vy -= GRAV * dt; r.h += r.vy * dt;
        if (r.roll > 0) { r.roll += dt / 0.5; if (r.roll >= 1) r.roll = 0; }
        if (r.h <= 0) {
          r.h = 0; r.vy = 0; r.ground = true; r.dbl = false; r.roll = 0;
          ctx.sfx('land');
          if (r.buffer > 0 && state === 'run') { r.buffer = 0; r.vy = JUMP; r.ground = false; ctx.sfx('jump'); }
        }
      }

      function collect(r, dt) {
        var cx = 94, cy = GY - r.h - 22;
        r.items.forEach(function (it) {
          var iy = GY - it.y, d2 = (it.x - cx) * (it.x - cx) + (iy - cy) * (iy - cy);
          // the magnet: an apple that came close enough flies to the hedgehog
          if (it.type === 'apple' && !it.got && (it.mag || (r.mag && d2 < r.mag * r.mag))) {
            it.mag = true;
            var k = Math.min(1, (dt || 0) * MAG_PULL);
            it.x += (cx - it.x) * k; it.y += ((GY - cy) - it.y) * k;
            iy = GY - it.y; d2 = (it.x - cx) * (it.x - cx) + (iy - cy) * (iy - cy);
          }
          if (it.type === 'apple' && d2 < 32 * 32) {
            it.got = true; r.apples++; ctx.sfx('coin');
            r.pops.push({ x: it.x, y: iy - 10, t: 0, text: r.mode === 'endless' ? '+5' : '+1', col: '#cf412d' });
          } else if (it.type === 'mush' && d2 < 38 * 38) {
            it.got = true; r.shield = r.shieldHits || 1; ctx.sfx('pop');
            r.pops.push({ x: it.x, y: iy - 30, t: 0, text: 'Tarcza!', col: '#3f86d8' });
          }
        });
      }

      function updateRun(dt) {
        var r = R;
        r.t += dt;
        var t = r.t;
        if (r.mode === 'stage') r.v = r.cfg.v0 + (r.cfg.v1 - r.cfg.v0) * clamp(r.dist / r.L, 0, 1);
        else r.v = Math.min(520, 230 + (t < 60 ? 1.3 * t : 78 + 2.4 * (t - 60)));
        var dx = r.v * dt;
        r.dist += dx;
        if (r.mode === 'endless') {
          var si = Math.floor(t / SEASON_LEN);
          if (si !== r.season) { r.season = si; r.banner = 2.4; }
        }
        if (r.banner > 0) r.banner -= dt;
        // physics
        if (r.buffer > 0) r.buffer -= dt;
        if (r.inv > 0) r.inv -= dt;
        if (r.ouch > 0) r.ouch -= dt;
        air(r, dt);
        if (r.ground) r.legs += dt * (10 + r.v / 30);
        // spawn
        r.gap -= dx;
        if (r.gap <= 0) spawn();
        moveWorld(dx, dt);
        // collisions
        var hx = 90, hy = GY - r.h;
        var box = { l: hx - 18, r: hx + 24, t: hy - 38, b: hy - 2 };
        for (var i = 0; i < r.obs.length; i++) {
          var o = r.obs[i];
          if (o.ko != null) continue;
          var hit = false;
          if (o.type === 'puddle') {
            hit = r.h < 3 && hx + 10 > o.x + 18 && hx - 8 < o.x + o.w - 18;
          } else if (o.fly) {
            var by = GY - o.fly + Math.sin(o.ph) * 6, bx = o.x + 15;
            var nx = clamp(bx, box.l, box.r), ny = clamp(by, box.t, box.b);
            hit = (nx - bx) * (nx - bx) + (ny - by) * (ny - by) < 12 * 12;
          } else {
            hit = box.r > o.x + 6 && box.l < o.x + o.w - 6 && box.b > GY - o.h + 7;
          }
          if (hit) {
            if (r.inv > 0 || god) continue;
            if (r.shield) {
              r.shield--; r.inv = 1.3; o.ko = 0; ctx.sfx('pop');
              r.pops.push({ x: hx + 10, y: hy - 70, t: 0, text: r.shield ? 'Uff! Tarcza: ' + r.shield : 'Uff!', col: '#3f86d8' });
            } else if (r.hearts != null && r.hearts > 1) {
              r.hearts--; r.inv = 1.6; r.ouch = 0.7; o.ko = 0; ctx.sfx('hit');
              r.pops.push({ x: hx + 10, y: hy - 70, t: 0, text: 'Ojej!', col: '#cf412d' });
            } else { if (r.hearts != null) r.hearts = 0; crash(); return; }
          }
        }
        collect(r, dt);
        if (r.mode === 'stage' && r.L - r.dist <= BRAKE) {
          state = 'finish';
          r.brakeA = r.v * r.v / (2 * Math.max(1, r.L - r.dist));
        }
      }

      // the hedgehog brakes in front of grandma's house, hops, and the rating apples pop up
      function updateFinish(dt) {
        var r = R;
        if (r.inv > 0) r.inv -= dt;
        if (!r.stopped) {
          var rem = Math.max(0, r.L - r.dist);
          r.v = Math.max(18, Math.sqrt(2 * r.brakeA * rem));
          var dx = Math.min(r.v * dt, rem);
          r.dist += dx;
          air(r, dt);
          if (r.ground) r.legs += dt * (6 + r.v / 30);
          moveWorld(dx, dt);
          collect(r, dt);
          if (r.L - r.dist <= 0.01 && r.ground) { r.stopped = true; r.stopT = 0; r.v = 0; stageCleared(); }
          return;
        }
        r.stopT += dt;
        if (r.ground && r.hops < 2 && r.stopT > 0.35 + r.hops * 0.6) { r.vy = 330; r.ground = false; r.hops++; }
        air(r, dt);
        moveWorld(0, dt);
        if (r.shown < r.rating && r.stopT > 0.7 + r.shown * 0.45) {
          var ax = LW / 2 + (r.shown - 1) * 66, ay = GY * 0.27;
          r.shown++; ctx.sfx('star');
          if (!reduced) for (var i = 0; i < 14; i++) {
            var a = Math.random() * Math.PI * 2, sp = rnd(80, 220);
            r.fx.push({ kind: 'conf', x: ax, y: ay, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 260, t: 0, life: 1.3, a: rnd(0, 6), va: rnd(-8, 8), col: ['#e2533f', '#f5c330', '#3fae5f', '#3f86d8', '#ff7eb6'][i % 5] });
          }
        }
        if (Math.random() < dt * (reduced ? 1.5 : 4)) r.fx.push({ kind: 'heart', x: 150 + rnd(-10, 10), y: GY - 60, vx: rnd(-12, 12), vy: -50, t: 0, life: 1.6, a: 0 });
        if (state === 'finish' && r.stopT > 0.7 + 3 * 0.45 + 0.9) { state = 'done'; donePanel(); }
      }

      function crash() {
        state = 'crash'; R.crashT = 0; R.vy = 420; R.ground = false; R.roll = 0; ctx.sfx('hit');
      }
      function updateCrash(dt) {
        var r = R;
        r.crashT += dt;
        r.vy -= GRAV_CRASH * 0.7 * dt; r.h = Math.max(0, r.h + r.vy * dt);
        if (r.h === 0) r.vy = Math.abs(r.vy) > 200 ? -r.vy * 0.3 : 0;
        r.pops.forEach(function (p) { p.t += dt; });
        if (r.crashT > 1.2) finishRun();
      }

      function meters() { return Math.floor(R.dist / 40); }
      function score() { return meters() + R.apples * 5; }
      function countDone() { var n = 0; for (var i = 0; i < STAGES; i++) if (save.stages[i]) n++; return n; }
      function stageOpen(i) { return i === 0 || !!save.stages[i - 1]; }
      function endlessOpen() { return !!save.stages[2] || save.best > 0; } // players from before the stages keep it
      function totalApples() { var n = 0; for (var i = 0; i < STAGES; i++) n += save.stages[i] || 0; return n; }

      // saved the moment the hedgehog stops, so leaving during the animation keeps the result
      function stageCleared() {
        var r = R, c = r.cfg;
        if (r.ended) return;
        r.ended = true;
        var share = r.spawned ? r.apples / r.spawned : 1;
        r.rating = share >= RATE3 ? 3 : share >= RATE2 ? 2 : 1;
        var wasEndless = endlessOpen(), wasNext = stageOpen(c.idx + 1);
        r.first = !save.stages[c.idx];
        save.stages[c.idx] = Math.max(save.stages[c.idx] || 0, r.rating);
        save.runs = (save.runs || 0) + 1;
        ctx.save(save);
        r.newWorld = c.j === 2 && c.w < WORLDS.length - 1 && !wasNext;
        r.newEndless = !wasEndless && endlessOpen();
        ctx.sfx('win');
        if (r.apples) ctx.stat('apples', r.apples);
        ctx.stat('cleared', 1);
        ctx.stat('stages', countDone(), 'max');
        if (r.rating === 3) ctx.sticker('apples3');
        if (c.j === 2) ctx.sticker('w' + c.w);
      }

      function finishRun() {
        state = 'over';
        save.runs = (save.runs || 0) + 1;
        if (R.mode === 'stage') {
          ctx.save(save);
          if (R.apples) ctx.stat('apples', R.apples);
          var c = R.cfg, left = Math.max(1, Math.ceil((R.L - R.dist) / 40));
          openPanel({
            big: Math.round(clamp(R.dist / R.L, 0, 0.99) * 100) + '%',
            title: 'Ojej, koniec serduszek',
            lines: ['Do domku babci zostało ' + left + ' m.', 'Jabłka: ' + R.apples, { text: 'Uważaj na: ' + WORLDS[c.w].warn + '.', muted: true }],
            button: 'Spróbuj znowu', note: 'etap', onPlay: function () { startStage(c.idx); }
          });
          return;
        }
        var m = meters(), sc = score(), rec = m > save.best;
        save.best = Math.max(save.best, m);
        save.bestScore = Math.max(save.bestScore, sc);
        save.bestSeason = Math.max(save.bestSeason, R.season);
        ctx.save(save);
        if (R.apples) ctx.stat('apples', R.apples);
        ctx.stat('best', m, 'max');
        openPanel({
          big: sc + ' pkt',
          title: rec ? 'Nowy rekord!' : 'Koniec biegu',
          lines: [
            m + ' m i ' + R.apples + ' ' + pl(R.apples, 'jabłko', 'jabłka', 'jabłek'),
            'Pora roku: ' + seasonLabel(R.season),
            { text: 'Rekord: ' + save.best + ' m · ' + save.bestScore + ' pkt', muted: true }
          ],
          button: 'Biegnij znowu', note: 'bieg bez końca', onPlay: startEndless
        });
      }

      // ---------- panels ----------
      function closePanel() { if (panel) { panel.close(); panel = null; } }
      function openPanel(o) {
        closePanel(); closeMap();
        panel = ctx.panel({
          big: o.big, title: o.title, lines: o.lines, price: PRICE, note: o.note || 'bieg', button: o.button, medals: !!o.medals,
          onPlay: function () { panel = null; o.onPlay(); },
          secondary: [{ label: 'Mapa', onClick: function () { panel = null; showMap(); } }]
        });
      }
      function donePanel() {
        var r = R, c = r.cfg, next = c.idx + 1 < STAGES ? c.idx + 1 : c.idx;
        var lines = ['Jabłka: ' + r.apples + ' z ' + r.spawned];
        if (r.rating < 3) lines.push({ text: 'Na 3 jabłka zbierz ' + Math.ceil(r.spawned * RATE3) + '.', muted: true });
        else lines.push('Wszystkie trzy jabłka!');
        if (r.newWorld) lines.push('Nowy świat: ' + WORLDS[c.w + 1].name + '!');
        if (r.newEndless) lines.push('Otwarty bieg Bez końca!');
        if (c.idx === STAGES - 1 && r.first) lines.push('Wszystkie etapy przebiegnięte. Brawo!');
        openPanel({
          big: appleRow(r.rating), title: r.rating === 3 ? 'Super! U babci!' : 'U babci!',
          lines: lines, button: next !== c.idx ? 'Następny etap' : 'Jeszcze raz', note: 'etap',
          onPlay: function () { startStage(next); }
        });
      }
      function stagePanel(idx) {
        var c = stageCfg(idx), Wd = WORLDS[c.w], best = save.stages[idx] || 0;
        state = 'idle'; R = null; setStyle(Wd.style);
        var hs = upV('heart'), lines = ['Dobiegnij do domku babci!', c.len + ' m · ' + hs + ' ' + pl(hs, 'serduszko', 'serduszka', 'serduszek')];
        if (idx === 0) lines.push('Dotknij: skok. Jeszcze raz w górze: wyżej!');
        else if (c.j === 0) lines.push('Nowe: ' + Wd.warn + '.');
        lines.push({ text: best ? 'Najlepiej: ' + appleRow(best) + ' z 3' : 'Zbierz dużo jabłek, a dostaniesz 3 🍎', muted: true });
        openPanel({ title: Wd.name + ' · etap ' + (c.j + 1), lines: lines, button: 'Biegnij', note: 'etap ' + (idx + 1), medals: true, onPlay: function () { startStage(idx); } });
      }
      function endlessPanel() {
        state = 'idle'; R = null; setStyle(0);
        var lines = ['Biegnij jak najdalej! Pory roku się zmieniają.', 'Jedno uderzenie kończy bieg.'];
        if (save.best > 0) lines.push({ text: 'Rekord: ' + save.best + ' m · ' + save.bestScore + ' pkt · ' + seasonLabel(save.bestSeason), muted: true });
        openPanel({ title: 'Bez końca', lines: lines, button: 'Biegnij', note: 'bieg bez końca', onPlay: startEndless });
      }
      function startStage(idx) {
        var c = stageCfg(idx), Wd = WORLDS[c.w];
        R = null; setStyle(Wd.style); setMusic(Wd.music);
        newRun('stage', c);
        state = 'run';
      }
      function startEndless() {
        R = null; setStyle(0); setMusic('meadow');
        newRun('endless');
        state = 'run';
        bg.trees.forEach(function (tr) { tr.season = 0; });
        bg.decor.forEach(function (d) { if (d.season !== 0) { var nd = makeDecor(d.x, 0); for (var k in nd) d[k] = nd[k]; } });
      }

      // ---------- stage map ----------
      var MAP_PTS = [[66, 150], [160, 96], [252, 148], [318, 92]];   // 3 stages + the house, viewBox 360x210
      function closeMap() { if (mapEl) { mapEl.remove(); mapEl = null; } }
      function svgApple(cx, cy, r, on) {
        return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + (on ? '#e2533f' : '#e3e8f2') + '" stroke="' + INK + '" stroke-width="1.5"/>' +
          '<path d="M' + cx + ' ' + (cy - r) + ' q' + (r * 0.9) + ' ' + (-r * 0.7) + ' ' + (r * 1.2) + ' ' + (-r * 0.05) + ' q' + (-r * 0.7) + ' ' + (r * 0.15) + ' ' + (-r * 1.2) + ' ' + (r * 0.05) + 'z" fill="' + (on ? '#3fae5f' : '#c9d3e3') + '"/>';
      }
      function wavy(y, amp, step, ph, col) {
        var d = 'M0 ' + y;
        for (var x = 0; x < 360; x += step) d += ' Q' + (x + step / 2) + ' ' + (y - amp * Math.sin((x / step + ph) * 1.7)) + ' ' + (x + step) + ' ' + y;
        return '<path d="' + d + ' V210 H0Z" fill="' + col + '" stroke="rgba(29,47,111,.2)" stroke-width="1.5"/>';
      }
      function pine(x, y, s, col, snow) {
        var p = '<rect x="' + (x - 2 * s) + '" y="' + (y - 6 * s) + '" width="' + (4 * s) + '" height="' + (6 * s) + '" fill="#8a6142"/>' +
          '<path d="M' + x + ' ' + (y - 34 * s) + ' l' + (11 * s) + ' ' + (16 * s) + ' h' + (-5 * s) + ' l' + (8 * s) + ' ' + (12 * s) + ' h' + (-28 * s) + ' l' + (8 * s) + ' ' + (-12 * s) + ' h' + (-5 * s) + 'z" fill="' + col + '" stroke="rgba(29,47,111,.35)" stroke-width="1.2"/>';
        if (snow) p += '<path d="M' + x + ' ' + (y - 34 * s) + ' l' + (5 * s) + ' ' + (7 * s) + ' h' + (-10 * s) + 'z" fill="#fff"/>';
        return p;
      }
      function worldSvg(w, mir) {
        var Wd = WORLDS[w], P = STYLES[Wd.style], s = '', id = 'jz-sky-' + w;
        function X(x) { return mir ? 360 - x : x; }
        s += '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + P.sky1 + '"/><stop offset="1" stop-color="' + P.sky2 + '"/></linearGradient></defs>';
        s += '<g class="jz-bg"><rect width="360" height="210" fill="url(#' + id + ')"/>';
        s += '<circle cx="' + X(250) + '" cy="34" r="16" fill="' + P.sun + '" stroke="rgba(29,47,111,.25)" stroke-width="2"/>';
        if (w === 2) {
          [[40, 40], [110, 20], [190, 34], [270, 14], [340, 38]].forEach(function (m) {
            s += '<path d="M' + (m[0] - 60) + ' 130 L' + m[0] + ' ' + m[1] + ' L' + (m[0] + 60) + ' 130Z" fill="' + P.far + '" stroke="rgba(29,47,111,.25)" stroke-width="1.5"/>';
            s += '<path d="M' + (m[0] - 17) + ' ' + (m[1] + 26) + ' L' + m[0] + ' ' + m[1] + ' L' + (m[0] + 17) + ' ' + (m[1] + 26) + ' l-6 -5 l-5 6 l-6 -6 l-6 6z" fill="#fff"/>';
          });
        } else if (w === 3) {
          s += '<rect x="0" y="84" width="360" height="50" fill="' + P.far + '"/>';
          for (var i = 0; i < 6; i++) s += '<path d="M' + (i * 64 + 10) + ' ' + (98 + (i % 2) * 14) + ' q8 -6 16 0 q8 6 16 0" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>';
          s += '<path d="M' + X(100) + ' 92 h30 l-6 8 h-18z" fill="#fff" stroke="' + INK + '" stroke-width="1.5"/><path d="M' + X(115) + ' 90 v-24 l14 20z" fill="#e2533f" stroke="' + INK + '" stroke-width="1.5"/>';
        } else s += wavy(110, 14, 60, w, P.far);
        s += wavy(132, 7, 45, w + 2, P.near);
        s += '<path d="M0 150 Q90 140 180 150 T360 148 V210 H0Z" fill="' + P.grass + '"/>';
        if (w === 1) [[20, 136], [52, 128], [300, 132], [340, 140], [200, 130]].forEach(function (p, n) { s += pine(X(p[0]), p[1], 0.9 + (n % 2) * 0.25, '#2f7a43'); });
        if (w === 4) { [[22, 138], [300, 134], [338, 142], [196, 128]].forEach(function (p) { s += pine(X(p[0]), p[1], 1, '#3d8a55', true); }); for (var f = 0; f < 10; f++) s += '<circle cx="' + ((f * 47 + 13) % 360) + '" cy="' + ((f * 31 + 20) % 120) + '" r="2.2" fill="#fff" stroke="rgba(29,47,111,.25)" stroke-width=".6"/>'; }
        if (w === 0) for (var k = 0; k < 9; k++) s += '<circle cx="' + ((k * 41 + 9) % 360) + '" cy="' + (170 + (k * 13) % 34) + '" r="3" fill="' + ['#ff7eb6', '#fff', '#f5c330'][k % 3] + '"/>';
        if (w === 3) for (var q = 0; q < 5; q++) s += '<path d="M' + ((q * 77 + 30) % 360) + ' ' + (178 + (q * 11) % 24) + ' l3 -6 l3 6 l-6 -3 h6z" fill="#ff9a6a" stroke="' + INK + '" stroke-width="1"/>';
        s += '</g>';
        // path from the start through the 3 stages to the house
        var pts = [[X(10), 196]].concat(MAP_PTS.map(function (p) { return [X(p[0]), p[1]]; }));
        var d = 'M' + pts[0][0] + ' ' + pts[0][1];
        for (var n = 1; n < pts.length; n++) {
          var a = pts[n - 1], b = pts[n];
          d += ' C' + (a[0] + (b[0] - a[0]) * 0.5) + ' ' + a[1] + ' ' + (a[0] + (b[0] - a[0]) * 0.5) + ' ' + b[1] + ' ' + b[0] + ' ' + b[1];
        }
        s += '<path d="' + d + '" fill="none" stroke="' + INK + '" stroke-width="17" stroke-linecap="round" opacity=".9"/>';
        s += '<path d="' + d + '" fill="none" stroke="' + P.dirt + '" stroke-width="12" stroke-linecap="round"/>';
        s += '<path d="' + d + '" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="2 9" stroke-linecap="round"/>';
        // the house at the end
        var hx = X(MAP_PTS[3][0]), hy = MAP_PTS[3][1] + 4;
        s += '<rect x="' + (hx - 17) + '" y="' + (hy - 24) + '" width="34" height="26" rx="3" fill="' + Wd.wall + '" stroke="' + INK + '" stroke-width="2"/>';
        s += '<path d="M' + (hx - 23) + ' ' + (hy - 22) + ' L' + hx + ' ' + (hy - 44) + ' L' + (hx + 23) + ' ' + (hy - 22) + 'Z" fill="' + Wd.roof + '" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>';
        if (w === 4) s += '<path d="M' + (hx - 14) + ' ' + (hy - 30) + ' L' + hx + ' ' + (hy - 44) + ' L' + (hx + 14) + ' ' + (hy - 30) + ' q-7 -3 -14 -5 q-7 2 -14 5z" fill="#fff"/>';
        s += '<rect x="' + (hx - 6) + '" y="' + (hy - 12) + '" width="12" height="14" rx="5" fill="#8a5a33" stroke="' + INK + '" stroke-width="1.5"/>';
        return s;
      }
      function lockSvg(sz) {
        return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 9 V6.5 a4 4 0 0 1 8 0 V9" fill="none" stroke="' + INK + '" stroke-width="2.2"/><rect x="3.5" y="8.5" width="13" height="9.5" rx="2.5" fill="#f5c330" stroke="' + INK + '" stroke-width="2"/></svg>';
      }
      function showMap() {
        closePanel(); closeMap();
        state = 'idle'; R = null;
        var m = document.createElement('div');
        m.className = 'jz-map';
        mapEl = m;
        var head = document.createElement('div'); head.className = 'jz-head';
        head.innerHTML = '<h2>Mapa jeżyka</h2><span class="jz-tot"><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">' + svgApple(11, 13, 7, true) + '</svg>' + totalApples() + ' / ' + STAGES * 3 + '</span>';
        m.appendChild(head);
        var sc = document.createElement('div'); sc.className = 'jz-scroll';
        m.appendChild(sc);
        var nextIdx = -1;
        for (var i = 0; i < STAGES; i++) if (stageOpen(i) && !save.stages[i]) { nextIdx = i; break; }
        var focus = null;
        WORLDS.forEach(function (Wd, w) {
          var mir = w % 2 === 1, open = stageOpen(w * 3);
          var card = document.createElement('div'); card.className = 'jz-world' + (open ? '' : ' locked');
          card.innerHTML = '<svg viewBox="0 0 360 210" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + worldSvg(w, mir) + '</svg>';
          var tag = document.createElement('div'); tag.className = 'jz-tag'; tag.textContent = Wd.name;
          tag.style[mir ? 'right' : 'left'] = '10px';
          card.appendChild(tag);
          for (var j = 0; j < 3; j++) (function (idx, p) {
            var b = document.createElement('button'); b.type = 'button';
            var ok = stageOpen(idx), got = save.stages[idx] || 0;
            b.className = 'jz-node' + (got ? ' done' : '') + (idx === nextIdx ? ' next' : '');
            b.style.left = ((mir ? 360 - p[0] : p[0]) / 360 * 100) + '%';
            b.style.top = (p[1] / 210 * 100) + '%';
            b.setAttribute('aria-label', Wd.name + ', etap ' + (idx % 3 + 1));
            b.dataset.stage = idx;
            if (!ok) { b.disabled = true; b.innerHTML = lockSvg(24); }
            else {
              var ap = '';
              for (var a = 0; a < 3; a++) ap += svgApple(9 + a * 17, 10, 6, a < got);
              b.innerHTML = (idx % 3 + 1) + '<svg class="ap" width="52" height="18" viewBox="0 0 52 18" aria-hidden="true">' + ap + '</svg>';
              b.onclick = function () { ctx.sfx('tap'); stagePanel(idx); };
            }
            card.appendChild(b);
          })(w * 3 + j, MAP_PTS[j]);
          if (!open) {
            var lk = document.createElement('div'); lk.className = 'jz-lock';
            lk.innerHTML = lockSvg(20) + '<span>Najpierw: ' + WORLDS[w - 1].name + '</span>';
            card.appendChild(lk);
          }
          if (nextIdx >= 0 && Math.floor(nextIdx / 3) === w) focus = card;
          sc.appendChild(card);
        });
        var foot = document.createElement('div'); foot.className = 'jz-foot';
        var eb = document.createElement('button'); eb.type = 'button';
        if (endlessOpen()) {
          eb.className = 'ng-btn';
          eb.innerHTML = 'Bez końca<small>' + (save.best ? 'rekord ' + save.best + ' m' : 'jak najdalej') + '</small>';
          eb.onclick = function () { ctx.sfx('tap'); endlessPanel(); };
        } else {
          eb.className = 'ng-btn sec'; eb.disabled = true;
          eb.innerHTML = 'Bez końca<small>po Łące</small>';
        }
        var wb = document.createElement('button'); wb.type = 'button'; wb.className = 'ng-btn sec'; wb.textContent = 'Szafa';
        wb.onclick = function () { closeMap(); openWardrobe(showMap); };
        var ub = document.createElement('button'); ub.type = 'button'; ub.className = 'ng-btn sec'; ub.textContent = 'Ulepszenia';
        ub.onclick = function () { ctx.sfx('tap'); closeMap(); openShop(showMap); };
        var xb = document.createElement('button'); xb.type = 'button'; xb.className = 'ng-btn sec'; xb.textContent = 'Wróć do gier';
        xb.onclick = function () { ctx.exit(); };
        foot.appendChild(eb); foot.appendChild(wb); foot.appendChild(ub); foot.appendChild(xb);
        m.appendChild(foot);
        el.appendChild(m);
        if (focus) sc.scrollTop = Math.max(0, focus.offsetTop - sc.offsetTop - (sc.clientHeight - focus.offsetHeight) / 2);
        else if (nextIdx < 0) sc.scrollTop = sc.scrollHeight;
      }

      // ---------- wardrobe ----------
      function openWardrobe(back) {
        var p = document.createElement('div');
        p.className = 'ng-panel';
        var card = document.createElement('div');
        card.className = 'ng-card';
        card.style.cssText = 'max-height:100%;overflow-y:auto;gap:8px;padding:16px 14px';
        p.appendChild(card);
        el.appendChild(p);
        wardrobe = p;
        var msg = null;

        function mini(w, h, drawFn) {
          var c = document.createElement('canvas'), d = Math.min(3, window.devicePixelRatio || 1);
          c.width = w * d; c.height = h * d; c.style.width = w + 'px'; c.style.height = h + 'px'; c.style.flex = 'none';
          var cg = c.getContext('2d'); cg.setTransform(d, 0, 0, d, 0, 0); drawFn(cg);
          return c;
        }
        function build() {
          var lvl = ctx.level();
          card.innerHTML = '';
          var h = document.createElement('h2'); h.textContent = 'Szafa jeżyka'; card.appendChild(h);
          var pv = mini(220, 104, function (cg) {
            cg.fillStyle = '#e2f4ff'; rr(cg, 0, 0, 220, 104, 16); cg.fill();
            cg.fillStyle = '#8fd06b'; cg.fillRect(0, 86, 220, 18);
            cg.save(); cg.translate(104, 88); cg.scale(1.7, 1.7);
            drawHog(cg, { t: 0.5, legs: 0, apples: 0, wear: save.wear }); cg.restore();
          });
          pv.style.cssText += ';align-self:center;border:2px solid ' + INK + ';border-radius:16px';
          card.appendChild(pv);
          var bal = document.createElement('p'); bal.className = 'muted';
          bal.textContent = 'Masz ' + ctx.balance() + ' ★ · poziom ' + lvl; card.appendChild(bal);
          if (msg) { var mp = document.createElement('p'); mp.textContent = msg.text; mp.style.color = msg.bad ? '#cf412d' : '#2a8a56'; card.appendChild(mp); msg = null; }
          ITEMS.forEach(function (it) {
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:10px;border:2px solid #d4def0;border-radius:14px;padding:6px 8px;text-align:left';
            var locked = lvl < it.lvl, owned = !!save.owned[it.id], worn = save.wear[it.slot] === it.id;
            var ic = mini(52, 52, function (cg) {
              cg.fillStyle = worn ? '#fff4d6' : '#f3f6fc'; rr(cg, 1, 1, 50, 50, 12); cg.fill();
              cg.save(); cg.translate(it.slot === 'neck' ? 36 : 26, it.slot === 'head' ? 34 : 26); cg.scale(it.slot === 'head' ? 1.5 : 1.6, it.slot === 'head' ? 1.5 : 1.6);
              if (it.slot === 'neck') { cg.save(); cg.translate(-1, 0); cg.scale(0.72, 0.72); WEAR.szalikTail(cg, 0); cg.restore(); } // shorter tail so its end stays on the icon
              WEAR[it.id](cg); cg.restore();
            });
            if (locked) ic.style.filter = 'grayscale(1) opacity(.5)';
            row.appendChild(ic);
            var tx = document.createElement('div'); tx.style.cssText = 'flex:1;min-width:0;line-height:1.1';
            tx.innerHTML = '<div style="font-size:1.3rem">' + it.name + '</div><div class="muted" style="font-size:.95rem">' +
              (locked ? 'od poziomu ' + it.lvl : it.info) + '</div>';
            row.appendChild(tx);
            var b = document.createElement('button'); b.type = 'button';
            b.style.cssText = 'min-height:44px;min-width:92px;font-size:1.15rem;padding:4px 10px';
            if (locked) { b.className = 'ng-btn sec'; b.disabled = true; b.textContent = 'poziom ' + it.lvl; }
            else if (!owned) {
              b.className = 'ng-btn'; b.textContent = ITEM_PRICE + ' ★';
              b.onclick = function () {
                if (!ctx.spend(ITEM_PRICE, 'szafa: ' + it.name)) { msg = { text: 'Za mało gwiazdek. Zbieraj je w nauce!', bad: true }; ctx.sfx('error'); build(); return; }
                save.owned[it.id] = true; save.wear[it.slot] = it.id; ctx.save(save); ctx.sfx('buy');
                msg = { text: 'Hura! ' + it.name + ' w szafie.' }; build();
              };
            } else {
              b.className = 'ng-btn sec'; b.textContent = worn ? 'Zdejmij' : 'Załóż';
              b.onclick = function () { save.wear[it.slot] = worn ? null : it.id; ctx.save(save); ctx.sfx('tap'); build(); };
            }
            row.appendChild(b);
            card.appendChild(row);
          });
          var done = document.createElement('button'); done.type = 'button'; done.className = 'ng-btn sec';
          done.textContent = 'Gotowe'; done.style.marginTop = '4px';
          done.onclick = function () { p.remove(); wardrobe = null; back(); };
          card.appendChild(done);
          if (!raf) draw();
        }
        build();
      }

      // ---------- upgrades shop ----------
      function openShop(back) {
        var p = document.createElement('div');
        p.className = 'ng-panel';
        var card = document.createElement('div');
        card.className = 'ng-card';
        card.style.cssText = 'max-height:100%;overflow-y:auto;gap:8px;padding:16px 14px';
        p.appendChild(card);
        el.appendChild(p);
        shop = p;
        var msg = null;
        function add(parent, tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; parent.appendChild(e); return e; }
        function build() {
          var lvl = ctx.level(), bal = ctx.balance(), top0 = card.scrollTop;
          card.innerHTML = '';
          add(card, 'h2', '', 'Ulepszenia jeżyka');
          add(card, 'p', 'muted', 'Masz ' + bal + ' ★ · poziom ' + lvl);
          add(card, 'p', 'muted', 'Ulepszenia zostają na zawsze. Każde możesz wyłączyć, gdy chcesz trudniej.').style.fontSize = '1rem';
          if (msg) { var mp = add(card, 'p', '', msg.text); mp.style.color = msg.bad ? '#cf412d' : '#2a8a56'; msg = null; }
          UPS.forEach(function (U) {
            var L = upLv(U.k), top = L >= U.v.length - 1, need = top ? 0 : U.lv[L], locked = !top && need > lvl, off = L > 0 && !!save.off[U.k];
            var row = add(card, 'div', 'jz-up' + (locked ? ' lock' : '') + (top && !off ? ' top' : '') + (off ? ' off' : ''));
            var d = Math.min(3, window.devicePixelRatio || 1), cvs = document.createElement('canvas');
            cvs.width = 56 * d; cvs.height = 56 * d; cvs.style.cssText = 'width:56px;height:56px;flex:none';
            var cg = cvs.getContext('2d'); cg.setTransform(d, 0, 0, d, 0, 0);
            cg.fillStyle = '#f3f6fc'; rr(cg, 1, 1, 54, 54, 12); cg.fill();
            cg.translate(28, 28); cg.scale(0.6, 0.6); drawUp(cg, U.k);
            row.appendChild(cvs);
            var tx = add(row, 'div', 'tx');
            add(tx, 'b', '', U.n);
            var dots = add(tx, 'span', 'dots');
            for (var i = 1; i < U.v.length; i++) add(dots, 'i', i <= L ? 'on' : '');
            var now = L ? (off ? 'Wyłączone: jak bez ulepszenia' : U.say[L]) : U.say[0];
            var next = top ? 'Najwyższy poziom!' : L ? 'Dalej: ' + U.say[L + 1].charAt(0).toLowerCase() + U.say[L + 1].slice(1) : 'Kupisz: ' + U.say[1].charAt(0).toLowerCase() + U.say[1].slice(1);
            add(tx, 'small', '', now);
            add(tx, 'small', '', next);
            if (L > 0) {
              var tg = add(tx, 'button', 'jz-tog' + (off ? ' off' : '')); tg.type = 'button';
              tg.setAttribute('aria-pressed', off ? 'false' : 'true');
              add(tg, 'i');
              add(tg, 'span', '', off ? 'Wyłączone' : 'Włączone');
              tg.onclick = function () {
                if (save.off[U.k]) delete save.off[U.k]; else save.off[U.k] = true;
                ctx.save(save); ctx.sfx('tap'); build();
              };
            }
            if (top) { add(row, 'span', 'jz-done', '✓'); return; }
            if (locked) { add(row, 'span', 'jz-lockt', 'od poziomu ' + need); return; }
            var price = U.price[L], b = add(row, 'button', 'jz-buy', price + ' ★'); b.type = 'button';
            if (price > bal) b.disabled = true;
            b.onclick = function () { buyUp(U, L); };
          });
          add(card, 'p', 'muted', 'Gwiazdki zdobędziesz w nauce.').style.fontSize = '1rem';
          var done = add(card, 'button', 'ng-btn sec', 'Gotowe'); done.type = 'button'; done.style.marginTop = '4px';
          done.onclick = function () { p.remove(); shop = null; back(); };
          card.scrollTop = top0;
          if (!raf) draw();
        }
        function buyUp(U, L) {
          if (upLv(U.k) !== L || L >= U.v.length - 1 || U.lv[L] > ctx.level()) return;
          if (!ctx.spend(U.price[L], U.n)) { msg = { text: 'Za mało gwiazdek. Zbieraj je w nauce!', bad: true }; ctx.sfx('error'); build(); return; }
          save.up[U.k] = L + 1; delete save.off[U.k];
          ctx.save(save); ctx.sfx('buy');
          msg = { text: 'Hura! ' + U.n + ': ' + U.say[L + 1].charAt(0).toLowerCase() + U.say[L + 1].slice(1) + '.' };
          build();
        }
        build();
      }

      // ---------- draw ----------
      function palette() {
        var P = {}, key;
        if (!R || R.mode !== 'endless') { var b0 = STYLES[style]; for (key in b0) if (key !== 'name') P[key] = b0[key]; return P; }
        var si = curSeason(), t = R.t - si * SEASON_LEN;
        var a = SEASONS[(si + 3) % 4], b = SEASONS[si % 4], k = si === 0 ? 1 : clamp(t / 2.5, 0, 1);
        for (key in b) if (key !== 'name') P[key] = mix(a[key], b[key], k);
        return P;
      }

      function hills(off, base, amp, k, col) {
        g.beginPath(); g.moveTo(-5, LH);
        for (var x = -5; x <= LW + 10; x += 8) {
          var wx = x + off;
          g.lineTo(x, base - amp * (0.6 * Math.sin(wx * k) + 0.4 * Math.sin(wx * k * 2.3 + 1.7)));
        }
        g.lineTo(LW + 10, LH); g.closePath();
        g.fillStyle = col; g.fill();
        g.lineWidth = 1.5; g.strokeStyle = 'rgba(29,47,111,.18)'; g.stroke();
      }
      function mountains(off, P) {
        var step = 120, first = Math.floor(off / step) - 1;
        for (var i = first; i < first + Math.ceil(LW / step) + 3; i++) {
          var x = i * step - off, hgt = 120 + 50 * Math.abs(Math.sin(i * 2.17)), base = GY - 30, top = base - hgt;
          g.beginPath(); g.moveTo(x - 95, base); g.lineTo(x, top); g.lineTo(x + 95, base); g.closePath();
          g.fillStyle = P.far; g.fill(); g.lineWidth = 1.5; g.strokeStyle = 'rgba(29,47,111,.22)'; g.stroke();
          var sw = 95 * 0.32, sh = hgt * 0.32;
          g.beginPath(); g.moveTo(x - sw, top + sh); g.lineTo(x, top); g.lineTo(x + sw, top + sh);
          g.lineTo(x + sw * 0.4, top + sh * 0.8); g.lineTo(x, top + sh * 1.05); g.lineTo(x - sw * 0.45, top + sh * 0.78); g.closePath();
          g.fillStyle = '#fff'; g.fill();
        }
      }
      function sea(off, P) {
        var top = GY - 72;
        g.fillStyle = P.far; g.fillRect(0, top, LW + 2, GY - top + 2);
        g.beginPath(); g.moveTo(0, top); g.lineTo(LW + 2, top); g.lineWidth = 1.5; g.strokeStyle = 'rgba(29,47,111,.25)'; g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; g.lineCap = 'round';
        for (var row = 0; row < 3; row++) {
          var y = top + 14 + row * 17, o = (off * (0.5 + row * 0.25) + row * 37) % 70;
          g.beginPath();
          for (var x = -o; x < LW + 70; x += 70) { g.moveTo(x, y); g.quadraticCurveTo(x + 8, y - 5, x + 16, y); g.quadraticCurveTo(x + 24, y + 5, x + 32, y); }
          g.stroke();
        }
        // a little sailing boat far away
        var bx = LW - ((off * 0.3 + 120) % (LW + 160)) + 80, by = top + 6;
        g.beginPath(); g.moveTo(bx - 16, by); g.lineTo(bx + 16, by); g.lineTo(bx + 11, by + 7); g.lineTo(bx - 11, by + 7); g.closePath(); g.fillStyle = '#fff'; g.fill(); outline(g, 1.5);
        g.beginPath(); g.moveTo(bx, by - 1); g.lineTo(bx, by - 26); g.lineTo(bx + 13, by - 4); g.closePath(); g.fillStyle = '#e2533f'; g.fill(); outline(g, 1.5);
      }

      function drawCloud(c) {
        g.save(); g.translate(c.x, c.y); g.scale(c.s, c.s);
        g.beginPath();
        g.arc(0, 0, 18, Math.PI * 0.5, Math.PI * 1.5); g.arc(20, -12, 20, Math.PI, Math.PI * 1.9);
        g.arc(44, -4, 16, Math.PI * 1.3, Math.PI * 0.5); g.closePath();
        g.fillStyle = 'rgba(255,255,255,.92)'; g.fill();
        g.lineWidth = 1.5; g.strokeStyle = 'rgba(29,47,111,.2)'; g.stroke();
        g.restore();
      }

      function trunk(h) {
        g.fillStyle = '#8a6142';
        g.beginPath(); g.moveTo(-4, 0); g.lineTo(-3, -h); g.lineTo(3, -h); g.lineTo(4, 0); g.closePath(); g.fill();
        g.lineWidth = 1.5; g.strokeStyle = 'rgba(29,47,111,.35)'; g.stroke();
      }
      function pineTree(col, snow, tall) {
        trunk(16);
        for (var i = 0; i < 3; i++) {
          var y = -14 - i * (tall ? 20 : 16), w = (tall ? 24 : 20) - i * 5;
          g.beginPath(); g.moveTo(-w, y); g.lineTo(0, y - (tall ? 32 : 26)); g.lineTo(w, y); g.closePath();
          g.fillStyle = col; g.fill(); g.lineWidth = 1.5; g.strokeStyle = 'rgba(29,47,111,.3)'; g.stroke();
          if (snow) { g.beginPath(); g.moveTo(-w * 0.45, y - (tall ? 18 : 14)); g.lineTo(0, y - (tall ? 32 : 26)); g.lineTo(w * 0.45, y - (tall ? 18 : 14)); g.closePath(); g.fillStyle = '#fff'; g.fill(); }
        }
      }
      function drawTree(tr) {
        var x = tr.x, base = GY - 2, s = tr.s;
        g.save(); g.translate(x, base); g.scale(s, s);
        if (tr.season === 4) {
          if (tr.kind === 0) pineTree('#2f7a43', false, true);
          else {
            trunk(44);
            g.beginPath(); g.arc(0, -56, 22, 0, Math.PI * 2); g.arc(-15, -44, 14, 0, Math.PI * 2); g.arc(15, -44, 14, 0, Math.PI * 2);
            g.fillStyle = '#3c8c3f'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = 'rgba(29,47,111,.3)'; g.stroke();
          }
        } else if (tr.season === 5) {
          pineTree(tr.kind === 0 ? '#3d8a55' : '#4f9a5f', false, false);
        } else if (tr.season === 6) {
          if (tr.kind === 0) {
            // beach umbrella
            g.beginPath(); g.moveTo(0, 0); g.lineTo(2, -52); g.lineWidth = 3; g.strokeStyle = '#8a6142'; g.stroke();
            g.beginPath(); g.moveTo(-26, -44); g.quadraticCurveTo(2, -76, 30, -40); g.closePath();
            g.fillStyle = '#fff'; g.fill();
            g.save(); g.clip(); g.fillStyle = '#e2533f';
            for (var u = -26; u < 32; u += 16) { g.beginPath(); g.moveTo(2, -62); g.lineTo(u, -38); g.lineTo(u + 8, -38); g.closePath(); g.fill(); }
            g.restore();
            g.beginPath(); g.moveTo(-26, -44); g.quadraticCurveTo(2, -76, 30, -40); g.closePath(); g.lineWidth = 1.5; g.strokeStyle = 'rgba(29,47,111,.45)'; g.stroke();
          } else {
            // dune grass
            g.beginPath();
            for (var q = -3; q <= 3; q++) { g.moveTo(q * 3, 0); g.quadraticCurveTo(q * 4, -12, q * 7, -22 - Math.abs(q) * -2); }
            g.strokeStyle = '#8fae5a'; g.lineWidth = 2; g.lineCap = 'round'; g.stroke();
          }
        } else if (tr.season === 3) {
          trunk(42);
          g.beginPath(); g.moveTo(0, -30); g.lineTo(-14, -50); g.moveTo(0, -38); g.lineTo(12, -58); g.moveTo(-1, -42); g.lineTo(-2, -64);
          g.moveTo(-8, -42); g.lineTo(-18, -46); g.moveTo(7, -50); g.lineTo(16, -52);
          g.strokeStyle = '#8a6142'; g.lineWidth = 3; g.stroke();
          g.fillStyle = '#fff';
          [[-14, -51], [12, -59], [-2, -65]].forEach(function (p) { g.beginPath(); g.ellipse(p[0], p[1], 5, 2.5, 0, 0, Math.PI * 2); g.fill(); });
        } else {
          trunk(42);
          var cols = [['#6cc66a', '#ff9fc6'], ['#3f9e45', null], ['#e9813c', '#f5c330']][tr.season];
          if (tr.kind === 0) {
            g.beginPath(); g.arc(0, -52, 20, 0, Math.PI * 2); g.arc(-13, -42, 13, 0, Math.PI * 2); g.arc(13, -42, 13, 0, Math.PI * 2);
            g.fillStyle = cols[0]; g.fill();
            g.lineWidth = 1.5; g.strokeStyle = 'rgba(29,47,111,.3)'; g.stroke();
            if (cols[1]) {
              g.fillStyle = cols[1];
              for (var i = 0; i < 6; i++) { var a = tr.seed + i * 1.1; g.beginPath(); g.arc(Math.cos(a) * 14, -48 + Math.sin(a) * 11, 2.6, 0, Math.PI * 2); g.fill(); }
            }
          } else {
            g.beginPath(); g.moveTo(0, -78); g.lineTo(17, -34); g.lineTo(-17, -34); g.closePath();
            g.fillStyle = tr.season === 2 ? '#c9762f' : tr.season === 0 ? '#58b25c' : '#2f8a45'; g.fill();
            g.lineWidth = 1.5; g.strokeStyle = 'rgba(29,47,111,.3)'; g.stroke();
            if (cols[1]) { g.fillStyle = cols[1]; g.beginPath(); g.arc(-5, -48, 2.5, 0, Math.PI * 2); g.arc(6, -58, 2.5, 0, Math.PI * 2); g.fill(); }
          }
        }
        g.restore();
      }

      function drawDecor(d) {
        var y = GY + 36 + d.y * Math.max(10, LH - GY - 56), x = d.x;
        g.save(); g.translate(x, y);
        if (d.k === 'tuft') {
          g.beginPath(); g.moveTo(-6, 0); g.quadraticCurveTo(-6, -8, -9, -12); g.moveTo(0, 0); g.lineTo(0, -14); g.moveTo(6, 0); g.quadraticCurveTo(6, -8, 9, -11);
          g.strokeStyle = d.season === 3 ? '#9fb3cf' : d.season === 2 ? '#8c7a33' : d.season === 4 ? '#2f6f2c' : '#3f8f35'; g.lineWidth = 2.2; g.lineCap = 'round'; g.stroke();
        } else if (d.k === 'tulip' || d.k === 'daisy' || d.k === 'sunflower') {
          var big = d.k === 'sunflower';
          g.beginPath(); g.moveTo(0, 0); g.lineTo(0, big ? -24 : -14); g.strokeStyle = '#3f8f35'; g.lineWidth = 2; g.stroke();
          var fy = big ? -26 : -16;
          if (d.k === 'tulip') {
            g.beginPath(); g.moveTo(-5, fy - 4); g.lineTo(-2.5, fy - 1); g.lineTo(0, fy - 5); g.lineTo(2.5, fy - 1); g.lineTo(5, fy - 4); g.quadraticCurveTo(5, fy + 4, 0, fy + 4); g.quadraticCurveTo(-5, fy + 4, -5, fy - 4);
            g.fillStyle = ['#ff7eb6', '#e2533f', '#f5c330'][d.c]; g.fill(); outline(g, 1.2);
          } else {
            var pr = big ? 7 : 4.5;
            g.fillStyle = big ? '#f5c330' : ['#fff', '#fff', '#ffd6ec'][d.c];
            for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3; g.beginPath(); g.arc(Math.cos(a) * pr, fy + Math.sin(a) * pr, pr * 0.6, 0, Math.PI * 2); g.fill(); }
            g.beginPath(); g.arc(0, fy, pr * 0.55, 0, Math.PI * 2); g.fillStyle = big ? '#7a4a22' : '#f5c330'; g.fill();
          }
        } else if (d.k === 'leaf') {
          g.rotate(d.c); g.beginPath(); g.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2);
          g.fillStyle = d.season === 4 ? ['#6aa83f', '#c9a23a', '#3f8f35'][d.c] : ['#e9813c', '#f5c330', '#cf412d'][d.c]; g.fill();
        } else if (d.k === 'pumpkin') {
          g.beginPath(); g.ellipse(0, -6, 10, 7, 0, 0, Math.PI * 2); g.fillStyle = '#f08a24'; g.fill(); outline(g, 1.4);
          g.beginPath(); g.moveTo(0, -12); g.lineTo(1, -16); g.strokeStyle = '#3f8f35'; g.lineWidth = 2.2; g.stroke();
        } else if (d.k === 'snow') {
          g.beginPath(); g.ellipse(0, -2, 12 + d.c * 3, 5, 0, Math.PI, 0); g.fillStyle = '#fff'; g.fill();
          g.lineWidth = 1; g.strokeStyle = 'rgba(29,47,111,.2)'; g.stroke();
        } else if (d.k === 'fern') {
          g.strokeStyle = '#2f7a35'; g.lineWidth = 1.8; g.lineCap = 'round';
          for (var f = -1; f <= 1; f++) {
            g.save(); g.rotate(f * 0.5); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(2, -10, 0, -18);
            for (var fl = 4; fl < 17; fl += 4) { g.moveTo(1, -fl); g.lineTo(5, -fl - 3); g.moveTo(0, -fl); g.lineTo(-4, -fl - 3); }
            g.stroke(); g.restore();
          }
        } else if (d.k === 'shroom') {
          rr(g, -2.5, -8, 5, 8, 2); g.fillStyle = '#fff4dc'; g.fill(); outline(g, 1.2);
          g.beginPath(); g.ellipse(0, -8, 8, 5, 0, Math.PI, 0); g.closePath(); g.fillStyle = ['#b06a3a', '#c98a4a', '#e2533f'][d.c]; g.fill(); outline(g, 1.2);
        } else if (d.k === 'pebble') {
          g.beginPath(); g.ellipse(0, -2, 5 + d.c * 2, 3 + d.c, 0, 0, Math.PI * 2); g.fillStyle = ['#b9bfcc', '#a7adba', '#cfc6b4'][d.c]; g.fill(); outline(g, 1);
        } else if (d.k === 'shell') {
          g.beginPath(); g.moveTo(-7, 0); g.quadraticCurveTo(0, -14, 7, 0); g.closePath(); g.fillStyle = ['#ffd6c4', '#fff', '#ffe7a3'][d.c]; g.fill(); outline(g, 1.2);
          g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -8); g.moveTo(-3, 0); g.lineTo(-2, -7); g.moveTo(3, 0); g.lineTo(2, -7); g.strokeStyle = 'rgba(29,47,111,.35)'; g.lineWidth = 1; g.stroke();
        } else if (d.k === 'starfish') {
          g.rotate(d.c);
          g.beginPath();
          for (var si = 0; si < 10; si++) { var sa = -Math.PI / 2 + si * Math.PI / 5, srad = si % 2 ? 3 : 8; g.lineTo(Math.cos(sa) * srad, Math.sin(sa) * srad); }
          g.closePath(); g.fillStyle = '#ff9a6a'; g.fill(); outline(g, 1.2);
        }
        g.restore();
      }

      function drawObstacle(o, sty) {
        g.save();
        if (o.ko != null) { g.globalAlpha = Math.max(0, 1 - o.ko); g.translate(o.x + o.w / 2, GY - o.ko * 110); g.rotate(o.ko * 4); g.translate(-(o.x + o.w / 2), -GY); }
        var x = o.x, w = o.w, h = o.h, cx = x + w / 2;
        if (o.type === 'stone') {
          g.beginPath(); g.moveTo(x, GY); g.quadraticCurveTo(x - 2, GY - h * 0.7, x + w * 0.3, GY - h);
          g.quadraticCurveTo(x + w * 0.75, GY - h * 1.12, x + w, GY - h * 0.35); g.quadraticCurveTo(x + w + 2, GY, x + w, GY); g.closePath();
          g.fillStyle = sty === 6 ? '#b7b0a2' : '#9aa4b8'; g.fill(); outline(g, 2);
          g.beginPath(); g.ellipse(x + w * 0.38, GY - h * 0.72, w * 0.14, h * 0.12, -0.4, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.6)'; g.fill();
          if (sty === 3) { g.beginPath(); g.ellipse(x + w * 0.5, GY - h * 0.93, w * 0.34, h * 0.16, -0.1, Math.PI, 0); g.fillStyle = '#fff'; g.fill(); }
          if (sty === 4) { g.beginPath(); g.ellipse(x + w * 0.62, GY - h * 0.9, w * 0.22, h * 0.12, 0.2, Math.PI, 0); g.fillStyle = '#6aa83f'; g.fill(); }
        } else if (o.type === 'log') {
          rr(g, x, GY - h, w, h, h / 2); g.fillStyle = '#9b6a3f'; g.fill(); outline(g, 2);
          g.beginPath(); g.moveTo(x + 18, GY - h * 0.6); g.lineTo(x + w - 14, GY - h * 0.6); g.moveTo(x + 24, GY - h * 0.3); g.lineTo(x + w - 20, GY - h * 0.3);
          g.strokeStyle = '#7a4f2c'; g.lineWidth = 1.5; g.stroke();
          g.beginPath(); g.ellipse(x + h / 2, GY - h / 2, h / 2 - 1, h / 2 - 1, 0, 0, Math.PI * 2); g.fillStyle = '#e8c08a'; g.fill(); outline(g, 2);
          g.beginPath(); g.arc(x + h / 2, GY - h / 2, h * 0.28, 0, Math.PI * 2); g.arc(x + h / 2, GY - h / 2, h * 0.1, 0, Math.PI * 2);
          g.strokeStyle = '#b5884f'; g.lineWidth = 1.4; g.stroke();
          g.beginPath(); g.moveTo(x + w * 0.62, GY - h); g.quadraticCurveTo(x + w * 0.66, GY - h - 9, x + w * 0.74, GY - h - 10); g.strokeStyle = '#3f8f35'; g.lineWidth = 2; g.stroke();
          if (sty === 3) { rr(g, x + h * 0.6, GY - h - 4, w - h * 0.8, 7, 3.5); g.fillStyle = '#fff'; g.fill(); }
        } else if (o.type === 'puddle') {
          var ice = sty === 3, fill = ice ? '#cfe8ff' : sty === 4 ? '#7d5a3a' : sty === 5 ? '#6fb7ef' : sty === 6 ? '#5fb3e6' : '#4d97e0';
          g.beginPath(); g.ellipse(x + w / 2, GY + 4, w / 2, 7, 0, 0, Math.PI * 2);
          g.fillStyle = fill; g.fill(); outline(g, 2);
          g.beginPath(); g.ellipse(x + w * 0.4, GY + 2.5, w * 0.18, 1.8, 0, 0, Math.PI * 2); g.fillStyle = sty === 4 ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.75)'; g.fill();
          if (ice) { g.beginPath(); g.moveTo(x + w * 0.6, GY + 1); g.lineTo(x + w * 0.75, GY + 7); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
          if (sty === 2) { g.save(); g.translate(x + w * 0.68, GY + 4); g.rotate(0.5); g.beginPath(); g.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI * 2); g.fillStyle = '#e9813c'; g.fill(); g.restore(); }
          if (sty === 6) { g.save(); g.translate(x + w * 0.7, GY + 4); g.scale(0.6, 0.35); g.beginPath(); for (var si = 0; si < 10; si++) { var sa = -Math.PI / 2 + si * Math.PI / 5, srad = si % 2 ? 3 : 8; g.lineTo(Math.cos(sa) * srad, Math.sin(sa) * srad); } g.closePath(); g.fillStyle = '#ff9a6a'; g.fill(); g.restore(); }
        } else if (o.type === 'bee') {
          var bx = x + 15, by = GY - o.fly + Math.sin(o.ph) * 6;
          g.setLineDash([2, 5]); g.beginPath(); g.moveTo(bx + 16, by + 2); g.quadraticCurveTo(bx + 34, by - 8 + Math.sin(o.ph) * 4, bx + 50, by + 4);
          g.strokeStyle = 'rgba(29,47,111,.35)'; g.lineWidth = 1.5; g.stroke(); g.setLineDash([]);
          var flap = Math.sin(clock * 40) * 0.5;
          g.translate(bx, by); g.scale(1.3, 1.3); g.translate(-bx, -by);
          g.save(); g.translate(bx + 2, by - 7); g.rotate(-0.4 + flap);
          g.beginPath(); g.ellipse(0, -6, 5, 9, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill(); outline(g, 1.4); g.restore();
          g.beginPath(); g.ellipse(bx, by, 14, 10, 0, 0, Math.PI * 2); g.fillStyle = '#f5c330'; g.fill();
          g.save(); g.clip(); g.fillStyle = INK; g.fillRect(bx - 3, by - 12, 4, 24); g.fillRect(bx + 5, by - 12, 4, 24); g.restore();
          g.beginPath(); g.ellipse(bx, by, 14, 10, 0, 0, Math.PI * 2); outline(g, 2);
          g.beginPath(); g.moveTo(bx + 13, by + 1); g.lineTo(bx + 19, by + 2); g.lineTo(bx + 13, by + 4); g.fillStyle = INK; g.fill();
          g.beginPath(); g.arc(bx - 8, by - 2, 2, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
          g.beginPath(); g.moveTo(bx - 10, by - 8); g.quadraticCurveTo(bx - 14, by - 16, bx - 17, by - 15); outline(g, 1.4);
          g.save(); g.translate(bx - 4, by - 8); g.rotate(0.5 - flap);
          g.beginPath(); g.ellipse(0, -6, 5, 9, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.9)'; g.fill(); outline(g, 1.4); g.restore();
        } else if (o.type === 'bird') {
          var qx = x + 15, qy = GY - o.fly + Math.sin(o.ph) * 6, wf = Math.sin(clock * 18);
          g.translate(qx, qy); g.scale(1.3, 1.3);
          g.beginPath(); g.moveTo(10, -1); g.lineTo(22, -6); g.lineTo(20, 4); g.closePath(); g.fillStyle = '#3f6fb8'; g.fill(); outline(g, 1.4);
          g.beginPath(); g.ellipse(0, 0, 13, 9, 0, 0, Math.PI * 2); g.fillStyle = '#6aa8e8'; g.fill(); outline(g, 2);
          g.beginPath(); g.ellipse(-2, 3, 8, 4.5, 0, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
          g.beginPath(); g.moveTo(-12, -2); g.lineTo(-19, 0); g.lineTo(-12, 2); g.closePath(); g.fillStyle = '#f5a623'; g.fill(); outline(g, 1.2);
          g.beginPath(); g.arc(-6, -3, 1.9, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
          g.beginPath(); g.moveTo(-1, -4); g.quadraticCurveTo(4, -6 - wf * 12, 10, -4 - wf * 14); g.quadraticCurveTo(7, -2, 3, -1); g.closePath(); g.fillStyle = '#4f8fd8'; g.fill(); outline(g, 1.4);
        } else if (o.type === 'molehill') {
          g.beginPath(); g.moveTo(x, GY); g.quadraticCurveTo(x + w * 0.12, GY - h, cx, GY - h); g.quadraticCurveTo(x + w * 0.88, GY - h, x + w, GY); g.closePath();
          g.fillStyle = '#8a5a33'; g.fill(); outline(g, 2);
          g.fillStyle = '#6f4528';
          [[0.3, 0.45], [0.62, 0.3], [0.72, 0.65], [0.42, 0.75]].forEach(function (p) { g.beginPath(); g.arc(x + w * p[0], GY - h * (1 - p[1]) + 4, 2, 0, Math.PI * 2); g.fill(); });
          // a mole peeking out
          g.beginPath(); g.arc(cx, GY - h + 3, 8, Math.PI, 0); g.closePath(); g.fillStyle = '#5b5560'; g.fill(); outline(g, 1.6);
          // white eyes with dark pupils: plain dark dots vanish on the grey head
          [-3.3, 3.3].forEach(function (ex) {
            g.beginPath(); g.arc(cx + ex, GY - h - 1.7, 2, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); outline(g, 0.8);
            g.beginPath(); g.arc(cx + ex + 0.2, GY - h - 1.5, 1.15, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
          });
          g.beginPath(); g.arc(cx, GY - h + 2, 2.4, 0, Math.PI * 2); g.fillStyle = '#ff8fb0'; g.fill();
        } else if (o.type === 'stump') {
          rr(g, x, GY - h, w, h + 2, 4); g.fillStyle = '#9b6a3f'; g.fill(); outline(g, 2);
          g.beginPath(); g.moveTo(x + w * 0.3, GY - h + 8); g.lineTo(x + w * 0.3, GY - 4); g.moveTo(x + w * 0.65, GY - h + 10); g.lineTo(x + w * 0.65, GY - 6);
          g.strokeStyle = '#7a4f2c'; g.lineWidth = 1.5; g.stroke();
          g.beginPath(); g.ellipse(cx, GY - h, w / 2, 6, 0, 0, Math.PI * 2); g.fillStyle = '#e8c08a'; g.fill(); outline(g, 2);
          g.beginPath(); g.ellipse(cx, GY - h, w * 0.28, 3.2, 0, 0, Math.PI * 2); g.strokeStyle = '#b5884f'; g.lineWidth = 1.3; g.stroke();
          rr(g, x + w - 6, GY - 12, 4, 8, 2); g.fillStyle = '#fff4dc'; g.fill();
          g.beginPath(); g.ellipse(x + w - 4, GY - 12, 6, 4, 0, Math.PI, 0); g.closePath(); g.fillStyle = '#e2533f'; g.fill(); outline(g, 1.3);
        } else if (o.type === 'cone') {
          g.translate(cx, GY - h / 2); g.rotate(o.rot);
          g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); g.fillStyle = '#a8743f'; g.fill(); outline(g, 2);
          g.save(); g.clip();
          g.strokeStyle = '#6f4528'; g.lineWidth = 1.5;
          for (var cl = -16; cl <= 16; cl += 7) { g.beginPath(); g.moveTo(cl - 10, -14); g.lineTo(cl + 10, 14); g.moveTo(cl + 10, -14); g.lineTo(cl - 10, 14); g.stroke(); }
          g.restore();
          g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); outline(g, 2);
        } else if (o.type === 'boulder') {
          g.translate(cx, GY - h / 2); g.rotate(o.rot);
          g.beginPath();
          for (var bi = 0; bi < 9; bi++) { var ba = bi / 9 * Math.PI * 2, brr = h / 2 * (0.88 + 0.12 * Math.sin(o.seed + bi * 2.3)); g.lineTo(Math.cos(ba) * brr, Math.sin(ba) * brr); }
          g.closePath(); g.fillStyle = '#8f97a8'; g.fill(); outline(g, 2);
          g.beginPath(); g.moveTo(-6, -4); g.lineTo(0, 1); g.lineTo(5, -2); g.moveTo(0, 1); g.lineTo(2, 8); g.strokeStyle = 'rgba(29,47,111,.5)'; g.lineWidth = 1.5; g.stroke();
          g.beginPath(); g.ellipse(-5, -8, 4, 2.4, -0.5, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.55)'; g.fill();
        } else if (o.type === 'snowball') {
          g.translate(cx, GY - h / 2);
          g.beginPath(); g.arc(0, 0, h / 2, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); outline(g, 2);
          g.beginPath(); g.arc(3, 3, h / 2 - 3, 0.1, 1.6); g.strokeStyle = '#c9d8ee'; g.lineWidth = 3; g.stroke();
          g.rotate(o.rot); g.fillStyle = '#d6e2f2';
          [[-6, -5, 2.4], [5, -6, 1.8], [2, 6, 2.2]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], p[2], 0, Math.PI * 2); g.fill(); });
        } else if (o.type === 'crab') {
          var leg = Math.sin(o.ph * 3) * 3, cy = GY - 11;
          g.strokeStyle = INK; g.lineWidth = 2; g.lineCap = 'round';
          g.beginPath();
          for (var li = 0; li < 3; li++) { var lx = 7 + li * 4, ll = li % 2 ? leg : -leg; g.moveTo(cx - lx + 4, cy + 4); g.lineTo(cx - lx - 4, GY - 1 + ll * 0.3); g.moveTo(cx + lx - 4, cy + 4); g.lineTo(cx + lx + 4, GY - 1 - ll * 0.3); }
          g.stroke();
          [-1, 1].forEach(function (sd) {
            var px = cx + sd * 15, py = cy - 12 + (sd < 0 ? leg : -leg) * 0.6;
            g.beginPath(); g.moveTo(cx + sd * 10, cy - 3); g.lineTo(px, py + 4); g.strokeStyle = INK; g.lineWidth = 2.2; g.stroke();
            g.beginPath(); g.arc(px, py, 5.5, 0.6, Math.PI * 2 - 0.6); g.lineTo(px, py); g.closePath(); g.fillStyle = '#e8553f'; g.fill(); outline(g, 1.6);
          });
          g.beginPath(); g.ellipse(cx, cy, 15, 10, 0, 0, Math.PI * 2); g.fillStyle = '#e8553f'; g.fill(); outline(g, 2);
          g.beginPath(); g.moveTo(cx - 4, cy - 8); g.lineTo(cx - 5, cy - 15); g.moveTo(cx + 4, cy - 8); g.lineTo(cx + 5, cy - 15); outline(g, 1.6);
          [-5, 5].forEach(function (ex) {
            g.beginPath(); g.arc(cx + ex, cy - 16, 2.6, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); outline(g, 1.2);
            g.beginPath(); g.arc(cx + ex - 0.6, cy - 16, 1.2, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
          });
          g.beginPath(); g.moveTo(cx - 4, cy + 2); g.quadraticCurveTo(cx, cy + 5, cx + 4, cy + 2); outline(g, 1.4);
        } else if (o.type === 'castle') {
          var sand = '#ecc97f';
          rr(g, x + 8, GY - 22, w - 16, 22, 2); g.fillStyle = sand; g.fill(); outline(g, 2);
          [x, x + w - 14].forEach(function (tx) {
            g.beginPath(); g.moveTo(tx, GY); g.lineTo(tx, GY - h); g.lineTo(tx + 4, GY - h); g.lineTo(tx + 4, GY - h + 4); g.lineTo(tx + 10, GY - h + 4); g.lineTo(tx + 10, GY - h); g.lineTo(tx + 14, GY - h); g.lineTo(tx + 14, GY); g.closePath();
            g.fillStyle = sand; g.fill(); outline(g, 2);
          });
          g.beginPath(); g.moveTo(cx - 5, GY); g.lineTo(cx - 5, GY - 9); g.arc(cx, GY - 9, 5, Math.PI, 0); g.lineTo(cx + 5, GY); g.closePath(); g.fillStyle = '#b8894a'; g.fill(); outline(g, 1.5);
          g.beginPath(); g.moveTo(x + w - 7, GY - h); g.lineTo(x + w - 7, GY - h - 14); outline(g, 1.6);
          g.beginPath(); g.moveTo(x + w - 7, GY - h - 14); g.lineTo(x + w + 4, GY - h - 10); g.lineTo(x + w - 7, GY - h - 6); g.closePath(); g.fillStyle = '#e2533f'; g.fill(); outline(g, 1.4);
          g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 12, GY - 6, 2, 0, Math.PI * 2); g.fill();
        } else if (o.type === 'snowman') {
          g.beginPath(); g.arc(cx, GY - 13, 14, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); outline(g, 2);
          g.beginPath(); g.arc(cx, GY - 33, 10, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); outline(g, 2);
          rr(g, cx - 9, GY - 27, 18, 5, 2.5); g.fillStyle = '#e2533f'; g.fill(); outline(g, 1.4);
          rr(g, cx - 7, GY - 50, 14, 9, 1.5); g.fillStyle = INK; g.fill();
          g.fillRect(cx - 10, GY - 42, 20, 2.5);
          g.beginPath(); g.moveTo(cx - 3, GY - 33); g.lineTo(cx - 12, GY - 31.5); g.lineTo(cx - 3, GY - 30.5); g.closePath(); g.fillStyle = '#f08a24'; g.fill();
          g.fillStyle = INK;
          [[cx - 4, GY - 36, 1.5], [cx + 3, GY - 36, 1.5], [cx, GY - 16, 1.6], [cx, GY - 9, 1.6]].forEach(function (q) { g.beginPath(); g.arc(q[0], q[1], q[2], 0, Math.PI * 2); g.fill(); });
          g.beginPath(); g.moveTo(cx + 12, GY - 18); g.lineTo(cx + 22, GY - 26); g.moveTo(cx - 12, GY - 18); g.lineTo(cx - 20, GY - 24); g.strokeStyle = '#8a6142'; g.lineWidth = 2; g.stroke();
        }
        g.restore();
      }

      function drawPart(p) {
        g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.scale(p.s, p.s);
        var k = p.season;
        if (k === 0) { g.beginPath(); g.ellipse(0, 0, 4, 2.4, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(255,170,205,.85)'; g.fill(); }
        else if (k === 1 || k === 5) { g.beginPath(); g.arc(0, 0, 1.6, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.8)'; g.fill(); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 6); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1; g.stroke(); }
        else if (k === 2 || k === 4) { g.beginPath(); g.ellipse(0, 0, 5.5, 2.8, 0, 0, Math.PI * 2); g.fillStyle = (k === 4 ? ['#6aa83f', '#c9a23a', '#8cc04a'] : ['#e9813c', '#f5c330', '#cf412d'])[Math.floor(p.sp * 10) % 3]; g.fill(); }
        else if (k === 3) { g.beginPath(); g.arc(0, 0, 2.6, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 0.8; g.strokeStyle = 'rgba(29,47,111,.25)'; g.stroke(); }
        g.restore();
      }

      function text(s, x, y, size, col, align, lw) {
        g.font = size + 'px ' + FONT; g.textAlign = align || 'left'; g.textBaseline = 'middle';
        g.lineJoin = 'round'; g.lineWidth = lw || size * 0.24; g.strokeStyle = '#fff'; g.strokeText(s, x, y);
        g.fillStyle = col; g.fillText(s, x, y);
      }

      function draw() {
        if (mapEl) return;   // the map covers everything
        g.setTransform(DPR * S, 0, 0, DPR * S, 0, 0);
        var P = palette(), sty = curStyle();
        // sky
        var sk = g.createLinearGradient(0, 0, 0, GY);
        sk.addColorStop(0, P.sky1); sk.addColorStop(1, P.sky2);
        g.fillStyle = sk; g.fillRect(0, 0, LW + 2, GY + 2);
        // sun
        var sx = LW * 0.74, sy = GY * 0.24;
        g.beginPath(); g.arc(sx, sy, 34, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
        g.beginPath(); g.arc(sx, sy, 24, 0, Math.PI * 2); g.fillStyle = P.sun; g.fill();
        g.lineWidth = 2; g.strokeStyle = 'rgba(29,47,111,.25)'; g.stroke();
        bg.clouds.forEach(drawCloud);
        if (sty === 5) mountains(bg.far, P); else if (sty === 6) sea(bg.far, P); else hills(bg.far, GY - 105, 26, 0.008, P.far);
        if (sty === 6) hills(bg.near + 300, GY - 12, 9, 0.02, P.near);
        else hills(bg.near + 300, GY - 40, 16, 0.014, P.near);
        bg.trees.forEach(drawTree);
        // ground: meadow with a dirt path along the top
        var mg = g.createLinearGradient(0, GY, 0, LH);
        mg.addColorStop(0, P.grass); mg.addColorStop(1, P.grass2);
        g.fillStyle = mg; g.fillRect(0, GY, LW + 2, LH - GY + 2);
        g.fillStyle = P.dirt;
        g.beginPath(); g.moveTo(0, GY - 1); g.lineTo(LW + 2, GY - 1); g.lineTo(LW + 2, GY + 14);
        var off2 = bg.ground % 40;
        for (var x2 = LW + 40 - off2; x2 > -40; x2 -= 40) { g.quadraticCurveTo(x2 - 10, GY + 22, x2 - 20, GY + 16); g.quadraticCurveTo(x2 - 30, GY + 11, x2 - 40, GY + 17); }
        g.lineTo(0, GY + 16); g.closePath(); g.fill();
        g.lineWidth = 1.5; g.strokeStyle = 'rgba(29,47,111,.25)'; g.stroke();
        g.fillStyle = P.dirt2;
        var off = bg.ground % 70;
        for (var x = -off; x < LW + 70; x += 70) {
          g.beginPath(); g.ellipse(x + 12, GY + 8, 4, 2.2, 0, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.ellipse(x + 47, GY + 12, 3, 1.8, 0, 0, Math.PI * 2); g.fill();
        }
        g.beginPath(); g.moveTo(0, GY - 1); g.lineTo(LW + 2, GY - 1); g.lineWidth = 2; g.strokeStyle = 'rgba(29,47,111,.3)'; g.stroke();
        if (sty !== 6) {
          g.strokeStyle = P.grass2; g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath();
          var off3 = bg.ground % 26;
          for (var x3 = -off3; x3 < LW + 26; x3 += 26) { g.moveTo(x3, GY); g.lineTo(x3 - 3, GY - 7); g.moveTo(x3 + 4, GY); g.lineTo(x3 + 6, GY - 8); g.moveTo(x3 + 8, GY); g.lineTo(x3 + 11, GY - 5); }
          g.stroke();
        }
        bg.decor.forEach(drawDecor);

        // grandma's house at the end of a stage
        var houseX = null;
        if (R && R.mode === 'stage') {
          houseX = 90 + 125 + (R.L - R.dist);
          if (houseX - 70 < LW + 20) {
            var Wd = WORLDS[R.world];
            drawHouse(g, houseX, GY, Wd, sty === 3, clock);
            var gb = R.stopped ? Math.abs(Math.sin(clock * 5)) * -3 : 0;
            g.save(); g.translate(houseX - 25, GY + gb); g.scale(-1.15, 1.15);
            drawHog(g, { t: clock + 1.3, legs: 0, apples: 0, wear: { head: 'chusta', eyes: 'babcia' }, old: true, happy: R.stopped });
            g.restore();
          }
        }

        // puddles first (flat), then items, other obstacles, hedgehog
        if (R) {
          R.obs.forEach(function (o) { if (o.type === 'puddle') drawObstacle(o, sty); });
          R.items.forEach(function (it) {
            if (it.type === 'apple') drawApple(g, it.x, GY - it.y + Math.sin(it.ph) * 2.5, 8);
            else drawMushroom(g, it.x, GY - it.y + Math.sin(it.ph) * 3, clock);
          });
          R.obs.forEach(function (o) { if (o.type !== 'puddle') drawObstacle(o, sty); });
        }
        // hedgehog
        var h = R ? R.h : 0, hy = GY - h;
        g.beginPath(); g.ellipse(92, GY + 2, 24 * Math.max(0.4, 1 - h / 300), 4, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(29,47,111,.18)'; g.fill();
        var blinkOut = R && R.inv > 0 && Math.floor(R.inv * 10) % 2 === 0;
        g.save();
        if (blinkOut) g.globalAlpha = 0.45;
        var bob = (state === 'run' && R.ground) ? Math.abs(Math.sin(R.legs)) * -1.5 : (state === 'idle' ? Math.sin(clock * 2) * 0.8 : 0);
        g.translate(90, hy + bob);
        if (R && R.roll > 0) { g.translate(4, -20 * HOG_SC); g.rotate(R.roll * Math.PI * 2); g.translate(-4, 20 * HOG_SC); }
        else if (state === 'crash') g.rotate(-0.25);
        g.scale(HOG_SC, HOG_SC);
        drawHog(g, {
          t: clock, legs: R ? R.legs : 0, air: R ? !R.ground : false, apples: R ? R.apples : 0, wear: save.wear,
          shield: R ? R.shield : false, dizzy: state === 'crash' || state === 'over' || (R && R.ouch > 0), happy: R && R.stopped
        });
        g.restore();

        bg.parts.forEach(function (p) { if (p.season === sty) drawPart(p); });

        if (R) {
          R.pops.forEach(function (p) { g.globalAlpha = 1 - p.t / 0.9; text(p.text, p.x, p.y - p.t * 40, 26, p.col, 'center'); g.globalAlpha = 1; });
          R.fx.forEach(function (f) {
            g.globalAlpha = clamp(1 - f.t / f.life, 0, 1) * (f.kind === 'heart' ? 0.9 : 1);
            if (f.kind === 'heart') heart(g, f.x + Math.sin(f.t * 4) * 6, f.y, 7, '#ff6f9a');
            else { g.save(); g.translate(f.x, f.y); g.rotate(f.a); g.fillStyle = f.col; g.fillRect(-4, -2.5, 8, 5); g.restore(); }
            g.globalAlpha = 1;
          });
        }
        // HUD
        if (R && state !== 'idle') {
          if (R.mode === 'stage') drawStageHud(); else drawEndlessHud();
        }
        if (state === 'pause') {
          g.fillStyle = 'rgba(29,47,111,.35)'; g.fillRect(0, 0, LW + 2, LH + 2);
          text('Pauza', LW / 2, LH * 0.38, 56, INK, 'center', 10);
          text('Dotknij, żeby biec dalej', LW / 2, LH * 0.38 + 50, 28, INK, 'center');
        }
      }

      // the mushroom in the corner, with the hits it still takes when that is more than one
      function shieldHud(x, y, s) {
        g.save(); g.translate(x, y); g.scale(s, s); drawMushroom(g, 0, 0, clock); g.restore();
        if (R.shield > 1) text('×' + R.shield, x - 22, y - 2, 24, '#3f86d8', 'right');
      }
      function drawEndlessHud() {
        text(meters() + ' m', 14, 26, 32, INK);
        drawApple(g, 26, 62, 10);
        text('' + R.apples, 44, 62, 28, '#cf412d');
        if (R.shield) shieldHud(LW - 32, 80, 0.7);
        if (R.mag) { g.save(); g.translate(26, 96); g.rotate(-0.4); drawMagnet(g, 0.55); g.restore(); }
        var sn = SEASONS[R.season % 4].name;
        g.font = '22px ' + FONT; var tw = g.measureText(sn).width + 22;
        rr(g, LW - 12 - tw, 12, tw, 30, 15); g.fillStyle = '#fff'; g.fill(); outline(g, 2);
        g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sn, LW - 12 - tw / 2, 28);
        if (R.banner > 0 && R.season > 0) {
          var bt = R.banner, al = Math.min(1, bt / 0.5, (2.4 - bt) / 0.3);
          g.globalAlpha = clamp(al, 0, 1);
          text(SEASONS[R.season % 4].name + '!', LW / 2, GY * 0.4 - (2.4 - bt) * 6, 54, PURPLE, 'center', 10);
          g.globalAlpha = 1;
        }
        if (R.t < 4.5 && state === 'run') {
          g.globalAlpha = clamp((4.5 - R.t) / 0.6, 0, 1);
          text('Dotknij: skok!', LW / 2, GY * 0.36, 34, INK, 'center');
          text('Jeszcze raz w górze: wyżej!', LW / 2, GY * 0.36 + 36, 24, INK, 'center');
          g.globalAlpha = 1;
        }
      }

      function drawStageHud() {
        var c = R.cfg, Wd = WORLDS[c.w], p = clamp(R.dist / R.L, 0, 1);
        // progress: hedgehog on a track towards the house
        var x0 = 18, x1 = LW - 58, y = 26;
        rr(g, x0, y - 8, x1 - x0, 16, 8); g.fillStyle = '#fff'; g.fill(); outline(g, 2);
        if (p > 0.02) { rr(g, x0 + 2, y - 6, (x1 - x0 - 4) * p, 12, 6); g.fillStyle = '#ffd84a'; g.fill(); }
        g.save(); g.translate(LW - 34, y + 12); g.scale(0.3, 0.3); drawHouse(g, 0, 0, Wd, Wd.style === 3, clock); g.restore();
        g.save(); g.translate(x0 + (x1 - x0) * p - 4, y + 9); g.scale(0.5, 0.5);
        drawHog(g, { t: clock, legs: R.legs, air: !R.ground, apples: 0, wear: save.wear }); g.restore();
        // apples and hearts
        drawApple(g, 26, 66, 10);
        text('' + R.apples, 44, 66, 28, '#cf412d');
        for (var i = 0; i < R.maxHearts; i++) heart(g, LW - 26 - i * 30, 66, 10, i < R.hearts ? '#e2533f' : '#fff');
        if (R.shield) shieldHud(LW - 30, 110, 0.65);
        if (R.mag) { g.save(); g.translate(26, 100); g.rotate(-0.4); drawMagnet(g, 0.55); g.restore(); }
        if (R.t < 3.5 && state === 'run') {
          g.globalAlpha = clamp((3.5 - R.t) / 0.6, 0, 1);
          text(Wd.name + ' · etap ' + (c.j + 1), LW / 2, GY * 0.34, 44, PURPLE, 'center', 9);
          text(c.idx === 0 ? 'Dotknij: skok! Jeszcze raz: wyżej!' : 'Biegnij do domku babci!', LW / 2, GY * 0.34 + 40, 24, INK, 'center');
          g.globalAlpha = 1;
        }
        if (R.stopped) {
          for (var a = 0; a < 3; a++) {
            var on = a < R.shown, ax = LW / 2 + (a - 1) * 66, ay = GY * 0.27;
            var k = on ? clamp((R.stopT - (0.7 + a * 0.45)) / 0.25, 0, 1) : 1, sc = on ? (reduced ? 1 : 0.6 + 0.4 * k + Math.sin(k * Math.PI) * 0.25) : 1;
            g.save(); g.translate(ax, ay); g.scale(sc, sc); drawApple(g, 0, 0, 22, !on); g.restore();
          }
        }
      }

      // ---------- loop ----------
      var raf = 0, last = 0, alive = true;
      function frame(ts) {
        raf = requestAnimationFrame(frame);
        var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
        last = ts;
        if (mapEl) return;
        var total = dt * timeScale;
        while (total > 1e-6) { var st = Math.min(total, 0.025); update(st); total -= st; }
        draw();
      }
      function startLoop() { if (!raf && alive) { last = 0; raf = requestAnimationFrame(frame); } }
      function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

      var ro = new ResizeObserver(resize);
      ro.observe(el);
      resize();
      seedBackground();
      startLoop();
      showMap();
      if (window.NG_DEBUG) window.NG_DEBUG.jezyk = {
        run: function () { return R; }, state: function () { return state; }, save: function () { return save; },
        // jump to n metres before grandma's house (stage) and clear the way
        skip: function (m) { if (R && R.mode === 'stage') { R.dist = Math.max(0, R.L - (m || 20) * 40); R.obs = []; R.spawned -= R.items.filter(function (it) { return it.type === 'apple'; }).length; R.items = []; R.gap = 1e9; } },
        speed: function (k) { timeScale = k == null ? 1 : k; }, god: function (on) { god = on !== false; },
        map: function () { return mapEl; }
      };

      return {
        pause: function () { if (state === 'run') state = 'pause'; stopLoop(); draw(); },
        resume: function () { startLoop(); },
        destroy: function () {
          alive = false;
          stopLoop();
          ro.disconnect();
          cv.removeEventListener('pointerdown', onDown);
          window.removeEventListener('keydown', onKey);
          closePanel();
          closeMap();
          if (wardrobe) { wardrobe.remove(); wardrobe = null; }
          if (shop) { shop.remove(); shop = null; }
          cv.remove();
          css.remove();
        }
      };
    }
  });
})();
