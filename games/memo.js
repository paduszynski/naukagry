/* Memo: odkrywaj po dwie karty i szukaj par.
 * Motywy: zwierzęta, owoce, warzywa z ogródka i angielski (obrazek + słowo po angielsku).
 * Plansze 12 / 16 / 20 kart, gra sam(a) albo we dwie na jednym telefonie (para = kolejny ruch).
 * 30 ★ za grę. Zaczęta gra zapisuje się, więc wyjście nic nie zabiera.
 * Karty to DOM + SVG (obrót CSS 3D), bez plików graficznych.
 */
(function () {
  'use strict';

  var FONT = '"Patrick Hand", "Comic Sans MS", cursive';
  var INK = '#1d2f6f', GOLD = '#e3a008', PURPLE = '#7a4fc4', MUTED = '#5a6690';
  var PRICE = 30;
  var P_COL = ['#d9468c', '#2f7fd6'], P_BG = ['#fde3ef', '#dcebff'];
  var SOLO_COL = '#2f9e5a';
  var K = ' stroke="#1d2f6f" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
  var K2 = ' stroke="#1d2f6f" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';
  var NOF = ' fill="none"';

  function eye(x, y, r) {
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + INK + '"/>' +
      '<circle cx="' + (x + r * 0.35) + '" cy="' + (y - r * 0.38) + '" r="' + (r * 0.36) + '" fill="#fff"/>';
  }
  function starPath(cx, cy, R, r) {
    var d = '';
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R;
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1);
    }
    return d + 'Z';
  }
  function dots(list, r, fill) {
    return list.map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + r + '" fill="' + fill + '"/>'; }).join('');
  }
  var CHEEK = '#f28ab2';

  // ---------- pictures (viewBox 0 0 100 100) ----------
  var PIC = {
    // animals
    kot: '<path d="M22 42 L25 14 L42 30 Q50 27 58 30 L75 14 L78 42 Q85 64 70 77 Q50 91 30 77 Q15 64 22 42 Z" fill="#f2a65a"' + K + '/>' +
      '<path d="M29 23 L30 35 L38 31 Z M71 23 L70 35 L62 31 Z" fill="#f7c9d4"/>' +
      '<path d="M50 33 v8 M43 34 l1.5 6 M57 34 l-1.5 6" stroke="#c9772a" stroke-width="3" stroke-linecap="round"/>' +
      eye(38, 51, 5) + eye(62, 51, 5) +
      '<path d="M45.5 60 h9 l-4.5 5 z" fill="#e86fae"' + K2 + '/>' +
      '<path d="M50 65 q-4 6 -9 3 M50 65 q4 6 9 3" ' + NOF + K2 + '/>' +
      '<path d="M32 62 h-15 M32 67 l-14 4 M68 62 h15 M68 67 l14 4"' + NOF + K2 + '/>',
    pies: '<ellipse cx="50" cy="53" rx="27" ry="28" fill="#e8c08f"' + K + '/>' +
      '<path d="M34 30 Q18 26 13 46 Q10 64 22 68 Q31 66 34 50 Z" fill="#8a5a33"' + K + '/>' +
      '<path d="M66 30 Q82 26 87 46 Q90 64 78 68 Q69 66 66 50 Z" fill="#8a5a33"' + K + '/>' +
      '<ellipse cx="50" cy="67" rx="14" ry="11" fill="#fff3e0"' + K2 + '/>' +
      eye(41, 47, 4.5) + eye(59, 47, 4.5) +
      '<ellipse cx="50" cy="61" rx="6" ry="4.5" fill="' + INK + '"/>' +
      '<path d="M47 72 q3 8 6 0 z" fill="#e2533f"' + K2 + '/>' +
      '<path d="M50 65 v5 q-4 4 -8 1 M50 70 q4 4 8 1"' + NOF + K2 + '/>',
    zaba: '<circle cx="33" cy="33" r="13" fill="#6cc04a"' + K + '/><circle cx="67" cy="33" r="13" fill="#6cc04a"' + K + '/>' +
      '<path d="M13 60 Q13 36 50 38 Q87 36 87 60 Q87 82 50 82 Q13 82 13 60 Z" fill="#6cc04a"' + K + '/>' +
      '<circle cx="33" cy="32" r="7.5" fill="#fff"' + K2 + '/><circle cx="67" cy="32" r="7.5" fill="#fff"' + K2 + '/>' +
      '<circle cx="34" cy="33" r="3.6" fill="' + INK + '"/><circle cx="66" cy="33" r="3.6" fill="' + INK + '"/>' +
      '<path d="M30 60 Q50 76 70 60"' + NOF + K + '/>' +
      '<circle cx="24" cy="63" r="4.5" fill="' + CHEEK + '" opacity=".7"/><circle cx="76" cy="63" r="4.5" fill="' + CHEEK + '" opacity=".7"/>' +
      '<circle cx="45" cy="50" r="1.6" fill="' + INK + '"/><circle cx="55" cy="50" r="1.6" fill="' + INK + '"/>',
    ryba: '<path d="M16 52 Q38 22 64 40 L86 26 L83 52 L86 78 L64 64 Q38 82 16 52 Z" fill="#f2b51d"' + K + '/>' +
      '<path d="M46 40 q7 12 0 24"' + NOF + K2 + '/>' +
      '<path d="M56 46 q3 6 0 12 M64 48 q2 4 0 8" stroke="#d98a00" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
      eye(32, 47, 4.5) +
      '<path d="M22 58 q4 3 8 1"' + NOF + K2 + '/>' +
      '<circle cx="12" cy="30" r="4" fill="none" stroke="#3f86d8" stroke-width="2.5"/><circle cx="20" cy="18" r="3" fill="none" stroke="#3f86d8" stroke-width="2.5"/>',
    swinka: '<path d="M25 38 L22 15 L43 29 Z M75 38 L78 15 L57 29 Z" fill="#f28aa8"' + K + '/>' +
      '<ellipse cx="50" cy="55" rx="31" ry="27" fill="#f7b3c4"' + K + '/>' +
      '<ellipse cx="50" cy="63" rx="14" ry="10" fill="#f28aa8"' + K + '/>' +
      '<ellipse cx="45" cy="63" rx="2.6" ry="3.8" fill="' + INK + '"/><ellipse cx="55" cy="63" rx="2.6" ry="3.8" fill="' + INK + '"/>' +
      eye(37, 47, 4) + eye(63, 47, 4) +
      '<circle cx="27" cy="62" r="4" fill="#ef7b9c" opacity=".6"/><circle cx="73" cy="62" r="4" fill="#ef7b9c" opacity=".6"/>',
    kurczak: '<path d="M42 84 v9 M37 93 h10 M58 84 v9 M53 93 h10" stroke="#f08a24" stroke-width="3.5" stroke-linecap="round"/>' +
      '<circle cx="50" cy="56" r="29" fill="#f8d84a"' + K + '/>' +
      '<path d="M45 28 q-3 -11 5 -11 M50 28 q5 -10 11 -5"' + NOF + K + '/>' +
      '<path d="M28 58 q-8 7 1 15 q9 -2 11 -9"' + ' fill="#f2c21d"' + K2 + '/>' +
      '<path d="M61 51 l13 4 l-13 5 z" fill="#f08a24"' + K2 + '/>' + eye(55, 44, 4) +
      '<circle cx="64" cy="64" r="4" fill="' + CHEEK + '" opacity=".6"/>',
    mysz: '<circle cx="27" cy="31" r="17" fill="#b8bfcc"' + K + '/><circle cx="73" cy="31" r="17" fill="#b8bfcc"' + K + '/>' +
      '<circle cx="27" cy="31" r="9" fill="#f7c9d4"/><circle cx="73" cy="31" r="9" fill="#f7c9d4"/>' +
      '<path d="M24 56 Q24 36 50 36 Q76 36 76 56 Q76 72 50 86 Q24 72 24 56 Z" fill="#cfd5df"' + K + '/>' +
      eye(40, 55, 4.5) + eye(60, 55, 4.5) +
      '<circle cx="50" cy="80" r="4.5" fill="#e86fae"' + K2 + '/>' +
      '<path d="M40 74 h-18 M40 78 l-16 5 M60 74 h18 M60 78 l16 5"' + NOF + K2 + '/>',
    sowa: '<path d="M26 28 L20 9 L40 20 Z M74 28 L80 9 L60 20 Z" fill="#a87447"' + K + '/>' +
      '<path d="M22 42 Q22 18 50 18 Q78 18 78 42 L78 70 Q78 91 50 91 Q22 91 22 70 Z" fill="#a87447"' + K + '/>' +
      '<ellipse cx="50" cy="72" rx="17" ry="15" fill="#ecd3ab"/>' +
      '<path d="M43 66 l3 3 l3 -3 M51 66 l3 3 l3 -3 M47 75 l3 3 l3 -3" fill="none" stroke="#a87447" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="38" cy="42" r="11.5" fill="#fff"' + K + '/><circle cx="62" cy="42" r="11.5" fill="#fff"' + K + '/>' +
      eye(39, 43, 5.5) + eye(61, 43, 5.5) +
      '<path d="M45.5 53 l4.5 8 l4.5 -8 z" fill="#f2b51d"' + K2 + '/>',
    biedronka: '<path d="M45 14 q-6 -9 -13 -7 M55 14 q6 -9 13 -7"' + NOF + K + '/>' +
      '<circle cx="50" cy="23" r="12" fill="' + INK + '"/>' +
      '<circle cx="45" cy="21" r="2.6" fill="#fff"/><circle cx="55" cy="21" r="2.6" fill="#fff"/>' +
      '<circle cx="50" cy="58" r="32" fill="#e2533f"' + K + '/>' +
      '<path d="M50 27 v63"' + K + '/>' +
      dots([[36, 46], [64, 46], [33, 66], [67, 66], [41, 80], [59, 80]], 5.5, INK),
    zajac: '<path d="M34 42 Q25 6 36 6 Q47 6 44 42 Z M66 42 Q75 6 64 6 Q53 6 56 42 Z" fill="#eef0f4"' + K + '/>' +
      '<path d="M36.5 34 Q32 13 36.5 13 Q41 13 40.5 34 Z M63.5 34 Q68 13 63.5 13 Q59 13 59.5 34 Z" fill="#f7c9d4"/>' +
      '<ellipse cx="50" cy="62" rx="27" ry="25" fill="#eef0f4"' + K + '/>' +
      eye(40, 56, 4.5) + eye(60, 56, 4.5) +
      '<path d="M46.5 65 h7 l-3.5 4 z" fill="#e86fae"' + K2 + '/>' +
      '<rect x="46" y="73" width="8" height="7" rx="1.5" fill="#fff"' + K2 + '/>' +
      '<path d="M50 69 v4 q-4 3 -8 0 M50 73 q4 3 8 0"' + NOF + K2 + '/>' +
      '<circle cx="31" cy="68" r="4.5" fill="' + CHEEK + '" opacity=".6"/><circle cx="69" cy="68" r="4.5" fill="' + CHEEK + '" opacity=".6"/>',
    ptak: '<path d="M69 56 L91 46 L87 68 Z" fill="#3f86d8"' + K + '/>' +
      '<path d="M44 82 v8 M52 82 v8" stroke="#f08a24" stroke-width="3.5" stroke-linecap="round"/>' +
      '<circle cx="47" cy="55" r="27" fill="#6fb3ee"' + K + '/>' +
      '<path d="M40 60 Q52 74 66 58 Q55 50 40 60 Z" fill="#3f86d8"' + K2 + '/>' +
      '<path d="M22 47 L8 52 L22 57 Z" fill="#f2b51d"' + K2 + '/>' + eye(35, 46, 4.5) +
      '<path d="M44 29 q2 -9 9 -8"' + NOF + K + '/>',

    // fruit
    jablko: '<path d="M50 31 Q36 20 24 30 Q11 44 19 65 Q30 89 50 83 Q70 89 81 65 Q89 44 76 30 Q64 20 50 31 Z" fill="#e2533f"' + K + '/>' +
      '<path d="M50 31 Q50 19 56 12"' + NOF + K + '/>' +
      '<path d="M55 22 Q66 10 77 16 Q67 29 55 22 Z" fill="#3fae5f"' + K2 + '/>' +
      '<path d="M29 44 q-4 8 -2 17" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity=".75" fill="none"/>',
    gruszka: '<path d="M50 19 Q61 19 61 35 Q61 45 70 54 Q83 70 73 83 Q63 93 50 91 Q37 93 27 83 Q17 70 30 54 Q39 45 39 35 Q39 19 50 19 Z" fill="#b8d64c"' + K + '/>' +
      '<path d="M50 19 q1 -8 6 -11"' + NOF + K + '/>' +
      '<path d="M54 15 Q64 6 73 12 Q64 22 54 15 Z" fill="#3fae5f"' + K2 + '/>' +
      '<path d="M32 66 q-3 8 2 14" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity=".7" fill="none"/>' +
      dots([[58, 62], [48, 74], [62, 78]], 1.6, '#7e9a2a'),
    banan: '<path d="M20 28 Q20 72 57 81 Q79 86 88 70 Q70 74 55 64 Q35 51 30 26 Z" fill="#f8d84a"' + K + '/>' +
      '<path d="M19 30 l-1 -9 l11 1 l1 4" fill="#8a5a33"' + K2 + '/>' +
      '<path d="M27 36 Q33 62 62 74" fill="none" stroke="#e0b12a" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="87" cy="71" r="2.5" fill="#8a5a33"/>',
    truskawka: '<path d="M50 89 Q19 71 21 45 Q23 31 50 33 Q77 31 79 45 Q81 71 50 89 Z" fill="#e2533f"' + K + '/>' +
      '<path d="M29 35 L39 22 L45 30 L50 17 L55 30 L61 22 L71 35 Q50 44 29 35 Z" fill="#3fae5f"' + K2 + '/>' +
      dots([[36, 50], [50, 52], [64, 50], [42, 63], [58, 63], [50, 75], [32, 61], [68, 61]], 2.2, '#ffe28a'),
    wisnie: '<path d="M32 56 Q40 30 58 16 M67 60 Q64 36 58 16"' + NOF + K + '/>' +
      '<path d="M58 16 Q72 5 85 13 Q73 26 58 16 Z" fill="#3fae5f"' + K2 + '/>' +
      '<circle cx="31" cy="70" r="16" fill="#c8243a"' + K + '/><circle cx="67" cy="74" r="16" fill="#c8243a"' + K + '/>' +
      '<path d="M23 64 q-2 6 1 11 M59 68 q-2 6 1 11" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".7" fill="none"/>',
    winogrona: '<path d="M50 30 V13"' + K + '/>' +
      '<path d="M50 18 Q62 6 75 12 Q63 25 50 18 Z" fill="#3fae5f"' + K2 + '/>' +
      [[33, 38], [50, 36], [67, 38], [41, 54], [59, 54], [33, 70], [67, 70], [50, 70], [42, 85], [58, 85]].map(function (p) {
        return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="10" fill="#8a5cd0"' + K2 + '/>' +
          '<circle cx="' + (p[0] - 3) + '" cy="' + (p[1] - 3.5) + '" r="2.4" fill="#fff" opacity=".6"/>';
      }).join(''),
    cytryna: '<path d="M13 50 Q15 44 21 42 Q40 22 66 28 Q81 32 85 42 Q91 46 88 53 Q85 59 80 60 Q64 81 37 74 Q21 70 18 58 Q11 56 13 50 Z" fill="#f8e04a"' + K + '/>' +
      '<path d="M32 44 q-6 6 -5 14" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity=".75" fill="none"/>' +
      dots([[50, 40], [62, 46], [56, 58], [44, 62], [68, 58]], 1.5, '#d6b51e'),
    pomarancza: '<circle cx="50" cy="55" r="33" fill="#f39a2b"' + K + '/>' +
      '<path d="M50 23 q-1 -7 3 -10"' + NOF + K + '/>' +
      '<path d="M53 18 Q63 8 74 13 Q65 25 53 18 Z" fill="#3fae5f"' + K2 + '/>' +
      '<path d="M30 46 q-4 8 -2 17" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity=".6" fill="none"/>' +
      dots([[46, 40], [60, 44], [66, 58], [54, 66], [42, 60], [58, 78], [72, 70], [38, 74]], 1.6, '#d47812'),
    arbuz: '<path d="M10 32 A40 40 0 0 0 90 32 Z" fill="#3fae5f"' + K + '/>' +
      '<path d="M17 32 A33 33 0 0 0 83 32 Z" fill="#e4f6d6"/>' +
      '<path d="M21 32 A29 29 0 0 0 79 32 Z" fill="#f05b62"/>' +
      '<path d="M10 32 H90"' + K + '/>' +
      [[36, 42], [50, 46], [64, 42], [43, 56], [57, 56], [50, 66]].map(function (p) {
        return '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="2.2" ry="3.4" fill="' + INK + '"/>';
      }).join(''),
    ananas: '<path d="M50 38 L37 10 L47 22 L50 4 L53 22 L63 10 Z" fill="#3fae5f"' + K + '/>' +
      '<ellipse cx="50" cy="64" rx="23" ry="29" fill="#f2b51d"' + K + '/>' +
      (function () {
        var s = '';
        [[50, 44], [40, 54], [60, 54], [50, 64], [36, 68], [64, 68], [44, 76], [56, 76], [50, 86], [40, 40], [60, 40]].forEach(function (p) {
          if (p[1] < 42) return;
          s += '<path d="M' + (p[0] - 4) + ' ' + (p[1] - 4) + ' l8 8 M' + (p[0] + 4) + ' ' + (p[1] - 4) + ' l-8 8" stroke="#b9780c" stroke-width="2" stroke-linecap="round"/>';
        });
        return s;
      })(),

    // vegetables
    marchewka: '<path d="M44 30 Q30 18 34 7 Q46 13 50 28 Q52 10 61 6 Q65 18 56 30 Z" fill="#3fae5f"' + K2 + '/>' +
      '<path d="M35 33 Q50 24 65 33 L52 90 Q50 95 48 90 Z" fill="#f08a24"' + K + '/>' +
      '<path d="M42 46 h8 M48 59 h8 M45 72 h6" stroke="#c4621a" stroke-width="2.5" stroke-linecap="round"/>',
    pomidor: '<ellipse cx="50" cy="59" rx="35" ry="29" fill="#e2533f"' + K + '/>' +
      '<path d="M50 35 v-11"' + K + ' stroke="#2a8a56"/>' +
      '<path d="M50 34 L40 25 L45 36 L30 36 L45 41 L50 47 L55 41 L70 36 L55 36 L60 25 Z" fill="#3fae5f"' + K2 + '/>' +
      '<path d="M27 52 q-3 7 0 14" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity=".7" fill="none"/>',
    ogorek: '<path d="M19 71 Q13 60 24 52 L66 22 Q80 14 85 26 Q89 37 76 45 L34 77 Q25 83 19 71 Z" fill="#4fa84a"' + K + '/>' +
      '<path d="M28 62 L70 31" stroke="#8fd06b" stroke-width="4" stroke-linecap="round" opacity=".8"/>' +
      dots([[34, 70], [46, 58], [58, 52], [70, 42], [40, 54], [62, 36], [52, 64]], 1.8, '#2b6e2f'),
    groszek: '<path d="M89 44 q5 -8 1 -15"' + NOF + K + '/>' +
      '<path d="M11 56 Q30 30 60 32 Q82 32 90 44 Q76 67 50 70 Q26 72 11 56 Z" fill="#7cc35a"' + K + '/>' +
      '<circle cx="32" cy="53" r="8.5" fill="#b0e384"' + K2 + '/><circle cx="50" cy="51" r="9" fill="#b0e384"' + K2 + '/><circle cx="68" cy="49" r="8.5" fill="#b0e384"' + K2 + '/>' +
      '<path d="M14 56 Q40 66 86 46"' + NOF + K2 + '/>',
    rzodkiewka: '<path d="M48 42 Q29 32 31 11 Q46 17 50 40 Z M52 42 Q71 32 69 11 Q54 17 50 40 Z" fill="#3fae5f"' + K2 + '/>' +
      '<path d="M50 94 Q48 86 46 83 Q23 77 25 57 Q27 41 50 41 Q73 41 75 57 Q77 77 54 83 Q52 86 50 94 Z" fill="#e8467c"' + K + '/>' +
      '<path d="M46 83 Q50 86 54 83" stroke="#fff" stroke-width="3" fill="none"/>' +
      '<path d="M34 54 q-2 7 1 13" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity=".7" fill="none"/>',
    kukurydza: '<path d="M50 12 Q69 20 67 54 Q65 82 50 90 Q35 82 33 54 Q31 20 50 12 Z" fill="#f8d84a"' + K + '/>' +
      (function () {
        var s = '';
        for (var r = 0; r < 6; r++) for (var c = -1; c <= 1; c++) {
          var x = 50 + c * 9 + (r % 2 ? 4.5 : 0), y = 24 + r * 9;
          if (r % 2 && c === 1) continue;
          s += '<ellipse cx="' + x + '" cy="' + y + '" rx="3.4" ry="3.2" fill="#f2b51d" stroke="#d99a12" stroke-width="1.2"/>';
        }
        return s;
      })() +
      '<path d="M50 91 Q19 81 21 43 Q34 64 47 70 Z M50 91 Q81 81 79 43 Q66 64 53 70 Z" fill="#7cc35a"' + K2 + '/>',
    papryka: '<path d="M30 35 Q17 41 19 61 Q21 85 38 87 Q46 89 50 83 Q54 89 62 87 Q79 85 81 61 Q83 41 70 35 Q60 31 50 37 Q40 31 30 35 Z" fill="#f8c62a"' + K + '/>' +
      '<path d="M50 37 Q50 22 61 15"' + NOF + ' stroke="#2a8a56" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M41 37 Q50 28 59 37 Q50 41 41 37 Z" fill="#3fae5f"' + K2 + '/>' +
      '<path d="M50 44 Q46 64 50 82" stroke="#d99a12" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
      '<path d="M28 52 q-3 9 0 18" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity=".7" fill="none"/>',
    cebula: '<path d="M44 88 l-4 7 M50 88 v8 M56 88 l4 7"' + NOF + K2 + '/>' +
      '<path d="M50 13 Q54 30 70 40 Q87 52 81 70 Q73 89 50 89 Q27 89 19 70 Q13 52 30 40 Q46 30 50 13 Z" fill="#e7b56b"' + K + '/>' +
      '<path d="M50 22 Q35 50 42 87 M50 22 Q65 50 58 87" stroke="#b88437" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
      '<path d="M50 13 q-2 -6 2 -9" ' + NOF + K + '/>',
    dynia: '<path d="M46 35 Q46 22 54 17 L59 21 Q52 26 54 35 Z" fill="#6b8f3a"' + K2 + '/>' +
      '<ellipse cx="50" cy="61" rx="39" ry="29" fill="#f08a24"' + K + '/>' +
      '<path d="M50 33 Q36 61 50 89 M50 33 Q64 61 50 89 M29 37 Q17 61 29 85 M71 37 Q83 61 71 85" fill="none" stroke="#c4621a" stroke-width="2.5" stroke-linecap="round"/>',
    brokul: '<path d="M41 91 L44 60 L56 60 L59 91 Z" fill="#a9de7c"' + K + '/>' +
      '<circle cx="32" cy="47" r="15" fill="#3f9a45"' + K + '/><circle cx="68" cy="47" r="15" fill="#3f9a45"' + K + '/>' +
      '<circle cx="50" cy="36" r="17" fill="#3f9a45"' + K + '/><circle cx="50" cy="56" r="13" fill="#3f9a45"' + K + '/>' +
      dots([[44, 30], [56, 33], [28, 44], [70, 44], [48, 54], [36, 52], [62, 52], [52, 42]], 2, '#2b7a32'),

    // extra pictures for English words
    slonce: '<path d="M50 5 v12 M50 83 v12 M5 50 h12 M83 50 h12 M18 18 l9 9 M73 73 l9 9 M82 18 l-9 9 M27 73 l-9 9" stroke="#f2a51d" stroke-width="5.5" stroke-linecap="round"/>' +
      '<circle cx="50" cy="50" r="25" fill="#f8d84a"' + K + '/>' + eye(41, 46, 3.5) + eye(59, 46, 3.5) +
      '<path d="M40 57 Q50 66 60 57"' + NOF + K + '/>',
    ksiezyc: '<path d="M60 12 A38 38 0 1 0 88 70 A30 30 0 1 1 60 12 Z" fill="#f8e04a"' + K + '/>' +
      '<path d="M' + starPath(78, 24, 8, 3.5).slice(1) + '" fill="#f2b51d"' + K2 + '/>' +
      '<circle cx="66" cy="48" r="2.5" fill="#f2b51d"/><circle cx="34" cy="58" r="3" fill="#e0c43a" opacity=".6"/><circle cx="44" cy="76" r="2" fill="#e0c43a" opacity=".6"/>',
    gwiazda: '<path d="' + starPath(50, 54, 42, 18) + '" fill="#f8d84a"' + K + '/>' +
      eye(43, 52, 3.2) + eye(57, 52, 3.2) + '<path d="M44 61 Q50 66 56 61"' + NOF + K2 + '/>',
    dom: '<rect x="63" y="18" width="10" height="20" fill="#8a5a33"' + K2 + '/>' +
      '<rect x="22" y="46" width="56" height="43" fill="#f6d7a7"' + K + '/>' +
      '<path d="M13 50 L50 15 L87 50 Z" fill="#e2533f"' + K + '/>' +
      '<rect x="42" y="64" width="16" height="25" rx="2" fill="#8a5a33"' + K2 + '/>' +
      '<circle cx="54" cy="77" r="1.6" fill="#f2b51d"/>' +
      '<rect x="27" y="55" width="11" height="11" fill="#bfe1f7"' + K2 + '/><rect x="62" y="55" width="11" height="11" fill="#bfe1f7"' + K2 + '/>',
    drzewo: '<path d="M43 91 L46 60 L54 60 L57 91 Z" fill="#8a5a33"' + K + '/>' +
      '<path d="M50 11 Q70 11 74 29 Q89 37 81 54 Q79 69 61 67 Q50 75 39 67 Q21 69 19 54 Q11 37 26 29 Q30 11 50 11 Z" fill="#3fae5f"' + K + '/>' +
      '<path d="M34 34 q4 -6 10 -6 M58 46 q6 -2 10 2" stroke="#8fd06b" stroke-width="3" stroke-linecap="round" fill="none"/>',
    pilka: '<path d="M50 17 A35 35 0 0 0 50 87 Q29 52 50 17 Z" fill="#e2533f"/>' +
      '<path d="M50 17 A35 35 0 0 1 50 87 Q71 52 50 17 Z" fill="#3f86d8"/>' +
      '<path d="M50 17 Q29 52 50 87 M50 17 Q71 52 50 87"' + NOF + K2 + '/>' +
      '<circle cx="50" cy="52" r="35"' + NOF + K + '/>' +
      '<path d="M28 38 q-4 6 -4 12" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7" fill="none"/>',
    auto: '<path d="M9 68 L11 53 Q13 47 21 47 L30 47 L38 32 Q40 28 46 28 L64 28 Q70 28 72 32 L80 47 Q91 47 91 57 L91 68 Z" fill="#e2533f"' + K + '/>' +
      '<path d="M41 45 L46 33 L54 33 L54 45 Z M58 45 L58 33 L65 33 L71 45 Z" fill="#bfe1f7"' + K2 + '/>' +
      '<circle cx="30" cy="69" r="10" fill="#3a3f55"' + K + '/><circle cx="72" cy="69" r="10" fill="#3a3f55"' + K + '/>' +
      '<circle cx="30" cy="69" r="3.5" fill="#c9cfda"/><circle cx="72" cy="69" r="3.5" fill="#c9cfda"/>' +
      '<rect x="84" y="51" width="6" height="5" rx="1.5" fill="#f8d84a"/>',
    kwiat: '<path d="M50 56 V93" stroke="#2a8a56" stroke-width="4.5" stroke-linecap="round"/>' +
      '<path d="M50 78 Q36 66 28 74 Q38 86 50 78 Z" fill="#3fae5f"' + K2 + '/>' +
      [0, 1, 2, 3, 4, 5].map(function (k) {
        var a = k * Math.PI / 3 - Math.PI / 2;
        return '<circle cx="' + (50 + Math.cos(a) * 17).toFixed(1) + '" cy="' + (38 + Math.sin(a) * 17).toFixed(1) + '" r="12" fill="#f28ab2"' + K2 + '/>';
      }).join('') +
      '<circle cx="50" cy="38" r="10" fill="#f2b51d"' + K2 + '/>'
  };

  var THEMES = [
    { id: 'zw', name: 'Zwierzęta', back: '#ffd9a8', icon: 'kot', items: ['kot', 'pies', 'zaba', 'ryba', 'swinka', 'kurczak', 'mysz', 'sowa', 'biedronka', 'zajac', 'ptak'] },
    { id: 'ow', name: 'Owoce', back: '#ffcfdc', icon: 'jablko', items: ['jablko', 'gruszka', 'banan', 'truskawka', 'wisnie', 'winogrona', 'cytryna', 'pomarancza', 'arbuz', 'ananas'] },
    { id: 'wa', name: 'Warzywa', back: '#cdeccf', icon: 'marchewka', items: ['marchewka', 'pomidor', 'ogorek', 'groszek', 'rzodkiewka', 'kukurydza', 'papryka', 'cebula', 'dynia', 'brokul'] },
    { id: 'en', name: 'Angielski', back: '#d3e3ff', icon: 'en', english: true,
      items: ['cat', 'dog', 'fish', 'bird', 'pig', 'frog', 'apple', 'banana', 'sun', 'moon', 'star', 'house', 'tree', 'ball', 'car', 'flower'] }
  ];
  var EN_PIC = { cat: 'kot', dog: 'pies', fish: 'ryba', bird: 'ptak', pig: 'swinka', frog: 'zaba', apple: 'jablko', banana: 'banan',
    sun: 'slonce', moon: 'ksiezyc', star: 'gwiazda', house: 'dom', tree: 'drzewo', ball: 'pilka', car: 'auto', flower: 'kwiat' };
  var SIZES = [
    { id: 's', cols: 3, rows: 4, label: '12 kart', sub: 'łatwo' },
    { id: 'm', cols: 4, rows: 4, label: '16 kart', sub: 'średnio' },
    { id: 'l', cols: 4, rows: 5, label: '20 kart', sub: 'trudno' }
  ];
  function themeOf(id) { return THEMES.filter(function (t) { return t.id === id; })[0] || THEMES[0]; }
  function sizeOf(id) { return SIZES.filter(function (s) { return s.id === id; })[0] || SIZES[0]; }
  function picOf(key) { return PIC[EN_PIC[key] || key] || ''; }
  function svg(inner) { return '<svg viewBox="0 0 100 100" aria-hidden="true">' + inner + '</svg>'; }

  // stars by moves: pairs P -> 3★ up to round(1.75P)+1, 2★ up to 2.5P
  function rating(moves, P) {
    if (moves <= Math.round(P * 1.75) + 1) return 3;
    if (moves <= Math.round(P * 2.5)) return 2;
    return 1;
  }
  function plural(n, one, few, many) {
    if (n === 1) return one;
    var d = n % 10, t = n % 100;
    return (d >= 2 && d <= 4 && (t < 12 || t > 14)) ? few : many;
  }
  function fmtTime(ms) {
    var s = Math.max(0, Math.round(ms / 1000)), m = Math.floor(s / 60);
    s %= 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  var BACK_STAR = '<path d="' + starPath(50, 52, 26, 11) + '" fill="#f8d84a"' + K + '/>' +
    '<path d="M16 22 q4 -6 10 -4 M84 82 q-4 6 -10 4" fill="none" stroke="rgba(29,47,111,.45)" stroke-width="3" stroke-linecap="round"/>' +
    '<circle cx="80" cy="20" r="3" fill="rgba(29,47,111,.35)"/><circle cx="20" cy="84" r="3" fill="rgba(29,47,111,.35)"/>';
  var BADGE = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="' + starPath(50, 54, 44, 19) + '" fill="#f8d84a"' + ' stroke="#1d2f6f" stroke-width="7" stroke-linejoin="round"/></svg>';
  var EN_ICON = '<path d="M14 18 h72 v64 h-72 z" fill="#fffdf0"' + K2 + '/><path d="M14 40 h72 M14 60 h72" stroke="#cfe0ff" stroke-width="2"/>' +
    '<text x="50" y="62" text-anchor="middle" font-size="38" font-family="Patrick Hand, Comic Sans MS, cursive" fill="' + INK + '">cat</text>';

  var CSS = [
    '.mm-root{background:#f4ecff;font-family:' + FONT + ';color:' + INK + ';display:flex;flex-direction:column;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;overflow:hidden}',
    '.mm-root *{box-sizing:border-box}',
    '.mm-hud{flex:none;display:flex;gap:8px;justify-content:center;align-items:center;padding:10px 10px 2px;flex-wrap:wrap;min-height:54px}',
    '.mm-pill{border:3px solid ' + INK + ';border-radius:16px;background:#fff;padding:3px 14px;font-size:1.25rem;line-height:1.2;box-shadow:0 3px 0 rgba(29,47,111,.22);white-space:nowrap;transition:transform .2s,opacity .2s,background .2s}',
    '.mm-pill b{font-weight:400;color:' + PURPLE + '}',
    '.mm-pl{opacity:.55}',
    '.mm-pl.on{opacity:1;transform:scale(1.08)}',
    '.mm-pl b{font-size:1.4rem}',
    '.mm-board{flex:1;position:relative;min-height:0}',
    '.mm-grid{position:absolute;display:grid}',
    '.mm-card{position:relative;border:0;padding:0;margin:0;background:none;perspective:700px;transform:rotate(var(--tilt,0deg));touch-action:manipulation;cursor:pointer}',
    '.mm-in{position:absolute;inset:0;transition:transform .38s cubic-bezier(.3,1.3,.5,1);transform-style:preserve-3d}',
    '.mm-card.open .mm-in{transform:rotateY(180deg)}',
    '.mm-face{position:absolute;inset:0;-webkit-backface-visibility:hidden;backface-visibility:hidden;border:3px solid ' + INK + ';display:flex;align-items:center;justify-content:center;overflow:hidden;' +
      'border-radius:var(--r,18px) calc(var(--r,18px) + 3px) calc(var(--r,18px) - 2px) calc(var(--r,18px) + 2px) / calc(var(--r,18px) + 2px) calc(var(--r,18px) - 2px) calc(var(--r,18px) + 3px) var(--r,18px);' +
      'box-shadow:0 4px 0 rgba(29,47,111,.25)}',
    '.mm-back{background:var(--back)}',
    '.mm-back::after{content:"";position:absolute;inset:5px;border:2px dashed rgba(29,47,111,.4);border-radius:calc(var(--r,18px) - 5px)}',
    '.mm-back svg{width:70%;height:70%}',
    '.mm-front{transform:rotateY(180deg);background:#fff}',
    '.mm-front svg{width:86%;height:86%}',
    '.mm-word{background-color:#fffdf0;background-image:linear-gradient(90deg,transparent 13%,#f6b9b9 13%,#f6b9b9 calc(13% + 2px),transparent calc(13% + 2px)),repeating-linear-gradient(transparent 0,transparent 16px,#d7e5fb 16px,#d7e5fb 18px)}',
    '.mm-word span{line-height:1;color:' + INK + ';padding-bottom:4%}',
    '.mm-card.done .mm-front{border-color:var(--pc);box-shadow:0 4px 0 rgba(29,47,111,.25),inset 0 0 0 3px var(--pc)}',
    '.mm-badge{position:absolute;left:-7px;top:-9px;width:30%;max-width:34px;aspect-ratio:1;transform:rotateY(180deg) scale(0);transition:transform .3s cubic-bezier(.2,1.6,.4,1) .1s;-webkit-backface-visibility:hidden;backface-visibility:hidden;pointer-events:none}',
    '.mm-badge svg{width:100%;height:100%;display:block}',
    '.mm-card.done .mm-badge{transform:rotateY(180deg) scale(1)}',
    '.mm-card.pop{animation:mmpop .5s ease}',
    '.mm-card.shake{animation:mmshake .4s ease}',
    '@keyframes mmpop{0%{transform:rotate(var(--tilt,0deg)) scale(1)}40%{transform:rotate(var(--tilt,0deg)) scale(1.12)}100%{transform:rotate(var(--tilt,0deg)) scale(1)}}',
    '@keyframes mmshake{0%,100%{transform:rotate(var(--tilt,0deg))}25%{transform:rotate(calc(var(--tilt,0deg) - 4deg))}75%{transform:rotate(calc(var(--tilt,0deg) + 4deg))}}',
    '.mm-turn{position:absolute;left:50%;top:50%;z-index:6;transform:translate(-50%,-50%);pointer-events:none;background:#fff;border:3px solid ' + INK + ';border-radius:20px;padding:8px 22px;font-size:2rem;white-space:nowrap;box-shadow:0 5px 0 rgba(29,47,111,.25);animation:mmturn 1.2s ease forwards}',
    '@keyframes mmturn{0%{opacity:0;transform:translate(-50%,-50%) scale(.6)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.05)}25%{transform:translate(-50%,-50%) scale(1)}80%{opacity:1}100%{opacity:0}}',
    '.mm-conf{position:absolute;top:-30px;width:22px;height:22px;pointer-events:none;z-index:7;animation:mmfall 1.6s ease-in forwards}',
    '.mm-conf svg{width:100%;height:100%;display:block}',
    '@keyframes mmfall{from{transform:translateY(0) rotate(0)}to{transform:translateY(var(--fall,600px)) rotate(360deg);opacity:.2}}',
    // setup screen
    '.mm-setup{position:absolute;inset:0;overflow-y:auto;touch-action:pan-y;display:flex;padding:14px 12px 24px}',
    '.mm-setup .ng-card{margin:auto;max-width:430px;gap:8px;padding:18px 16px}',
    '.mm-sec{font-size:1.15rem;color:' + MUTED + ';margin-top:4px;text-align:left}',
    '.mm-opts{display:grid;gap:8px}',
    '.mm-opt{border:3px solid ' + INK + ';border-radius:16px;background:#fff;padding:6px 8px;min-height:48px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:1.25rem;line-height:1.05;box-shadow:0 3px 0 rgba(29,47,111,.2);position:relative}',
    '.mm-opt svg{width:40px;height:40px;flex:none}',
    '.mm-opt small{display:block;font-size:.95rem;color:' + MUTED + '}',
    '.mm-opt.sel{background:#fff1bf;box-shadow:0 3px 0 ' + INK + ';outline:3px solid ' + GOLD + ';outline-offset:-7px}',
    '.mm-opt.sel::after{content:"✓";position:absolute;right:-8px;top:-10px;width:24px;height:24px;border-radius:50%;background:' + GOLD + ';border:2px solid ' + INK + ';color:#fff;font-size:1rem;line-height:20px;text-align:center}',
    '.mm-col{flex-direction:column;gap:0}',
    '.mm-dots{display:flex;gap:3px;margin-right:2px}',
    '.mm-dots i{width:12px;height:16px;border:2px solid ' + INK + ';border-radius:4px;background:#d3e3ff;display:block}',
    '.mm-dots i:nth-child(2){background:#fde3ef}',
    '@media (prefers-reduced-motion: reduce){.mm-in,.mm-badge,.mm-pill{transition:none}.mm-card.pop,.mm-card.shake{animation:none}.mm-turn{animation-duration:1.4s}}'
  ].join('\n');

  NG.register('memo', {
    meta: {
      name: 'Memo',
      price: '30 ★ za grę',
      bg: '#f1e6ff',
      music: 'calm',
      pic: '<g transform="rotate(-9 26 38)"><rect x="10" y="15" width="31" height="43" rx="7" fill="#d3e3ff" stroke="#1d2f6f" stroke-width="2.5"/>' +
        '<rect x="13.5" y="18.5" width="24" height="36" rx="4.5" fill="none" stroke="#1d2f6f" stroke-opacity=".4" stroke-width="1.2" stroke-dasharray="2.5 2.5"/>' +
        '<path d="' + starPath(25.5, 37, 9, 3.8) + '" fill="#f8d84a" stroke="#1d2f6f" stroke-width="1.4" stroke-linejoin="round"/></g>' +
        '<rect x="45" y="11" width="31" height="43" rx="7" fill="#fff" stroke="#1d2f6f" stroke-width="2.5"/>' +
        '<g transform="translate(46.5 19) scale(.28)">' + PIC.jablko + '</g>' +
        '<g transform="rotate(8 95 36)"><rect x="80" y="15" width="31" height="43" rx="7" fill="#fff" stroke="#1d2f6f" stroke-width="2.5"/>' +
        '<g transform="translate(81.5 23) scale(.28)">' + PIC.jablko + '</g></g>' +
        '<path d="' + starPath(78, 7, 5.5, 2.4) + '" fill="#e3a008"/>'
    },
    medals: [
      { id: 'games5', stat: 'games', at: 5, tier: 1, text: '5 gier w Memo' },
      { id: 'pairs100', stat: 'pairs', at: 100, tier: 2, text: '100 par w Memo' },
      { id: 'stars10', stat: 'stars3', at: 10, tier: 3, text: '10 gier na 3 ★' }
    ],
    quests: [
      { id: 'play', stat: 'games', n: [1, 2], text: 'Zagraj w Memo {n} {raz}', forms: ['raz', 'razy', 'razy'] },
      { id: 'pairs', stat: 'pairs', n: [8, 12], text: 'Znajdź {n} par w Memo' }
    ],
    stickers: [
      { id: 'big', emoji: '🧩', name: 'Pierwsze 20 kart w Memo' },
      { id: 'english', emoji: '🔤', name: 'Memo po angielsku' },
      { id: 'duo', emoji: '👭', name: 'Memo we dwie' },
      { id: 'stars3', emoji: '🌟', name: 'Memo na 3 gwiazdki' }
    ],
    _test: { PIC: PIC, THEMES: THEMES, rating: rating },

    mount: function (el, ctx) {
      var save = ctx.load({ theme: 'zw', size: 's', players: 1, games: 0, pairs: 0, best: {}, cur: null });
      if (!save.best || typeof save.best !== 'object') save.best = {};
      var alive = true, panel = null, timers = [], offBal = null, ro = null;
      var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      var g = null, open = [], pending = 0, finished = false, clockStart = 0, spoke = false;
      var root = document.createElement('div');
      root.className = 'mm-root';
      el.appendChild(root);
      var css = document.createElement('style');
      css.textContent = CSS;
      el.appendChild(css);
      var hud = null, board = null, grid = null, cards = [];

      function later(fn, ms) {
        var id = setTimeout(function () { timers = timers.filter(function (x) { return x !== id; }); if (alive) fn(); }, ms);
        timers.push(id);
        return id;
      }
      function cancel(id) { clearTimeout(id); timers = timers.filter(function (x) { return x !== id; }); }
      function tickClock() {
        if (!clockStart) return;
        var n = performance.now();
        if (g) g.ms = (g.ms || 0) + (n - clockStart);
        clockStart = n;
      }
      function persist() {
        tickClock();
        save.cur = g && !finished ? g : null;
        ctx.save(save);
      }
      function closePanel() { if (panel) { try { panel.close(); } catch (e) {} panel = null; } }
      function stopBal() { if (offBal) { offBal(); offBal = null; } }

      // ---------- speech (English theme) ----------
      function say(word) {
        try {
          if (!NG.sound.pref().sfx || !('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) return;
          var vs = speechSynthesis.getVoices().filter(function (v) { return /^en[-_]/i.test(v.lang); });
          var gb = vs.filter(function (v) { return /GB/i.test(v.lang); });
          var voice = gb.filter(function (v) { return v.localService; })[0] || gb[0] || vs.filter(function (v) { return v.localService; })[0] || vs[0] || null;
          speechSynthesis.cancel();
          var u = new SpeechSynthesisUtterance(word);
          u.lang = voice ? voice.lang : 'en-GB';
          if (voice) u.voice = voice;
          u.rate = 0.8;
          speechSynthesis.speak(u);
          spoke = true;
        } catch (e) {}
      }

      // ---------- setup screen ----------
      function showSetup() {
        closePanel();
        stopBal();
        cancelAllPlay();
        g = null; finished = false;
        root.innerHTML = '';
        hud = board = grid = null; cards = [];
        var wrap = document.createElement('div');
        wrap.className = 'mm-setup';
        var card = document.createElement('div');
        card.className = 'ng-card';
        wrap.appendChild(card);
        root.appendChild(wrap);

        function build() {
          card.innerHTML = '';
          var h = document.createElement('h2'); h.textContent = 'Memo'; card.appendChild(h);
          var p = document.createElement('p'); p.textContent = 'Odkrywaj po dwie karty i szukaj par.'; card.appendChild(p);
          var mr = document.createElement('div'); mr.className = 'medal-row';
          ctx.medals().forEach(function (md) {
            var sp = document.createElement('span'); if (md.got) sp.className = 'got';
            sp.innerHTML = '<i>' + NG.meta.TIER[md.tier].e + '</i>';
            sp.appendChild(document.createTextNode(md.text));
            mr.appendChild(sp);
          });
          card.appendChild(mr);

          section('Karty', 2, THEMES.map(function (t) {
            return { sel: save.theme === t.id, html: svg(t.icon === 'en' ? EN_ICON : PIC[t.icon]) + '<span>' + t.name + '</span>', pick: function () { save.theme = t.id; } };
          }));
          section('Ile kart', 3, SIZES.map(function (s) {
            return { col: true, sel: save.size === s.id, html: '<span>' + s.label + '</span><small>' + s.sub + '</small>', pick: function () { save.size = s.id; } };
          }));
          section('Kto gra', 2, [1, 2].map(function (n) {
            return { sel: save.players === n, html: (n === 2 ? '<span class="mm-dots"><i></i><i></i></span>' : '<span class="mm-dots"><i></i></span>') + '<span>' + (n === 1 ? '1 gracz' : '2 graczy') + '</span>', pick: function () { save.players = n; } };
          }));

          var bal = ctx.balance(), poor = bal < PRICE;
          var b = document.createElement('button');
          b.type = 'button'; b.className = 'ng-btn'; b.style.marginTop = '6px';
          b.textContent = 'Zagraj za ' + PRICE + ' ★';
          b.disabled = poor;
          b.onclick = function () {
            if (!ctx.spend(PRICE, 'gra')) { build(); return; }
            ctx.sfx('buy');
            newGame();
          };
          card.appendChild(b);
          if (poor) {
            var m = document.createElement('p'); m.className = 'ng-poor';
            m.innerHTML = 'Brakuje ' + (PRICE - bal) + ' ★. Zdobądź je w <a href="/matma/">Matmie</a>, <a href="/angielski/">Angielskim</a> albo <a href="/polski/">Polskim</a>.';
            card.appendChild(m);
          }
          if (save.games) {
            var st = document.createElement('p'); st.className = 'muted';
            st.textContent = 'Gry: ' + save.games + ' · Pary: ' + save.pairs;
            card.appendChild(st);
          }
          var row = document.createElement('div'); row.className = 'ng-row';
          var back = document.createElement('button'); back.type = 'button'; back.className = 'ng-btn sec'; back.textContent = 'Wróć do gier';
          back.onclick = function () { ctx.exit(); };
          row.appendChild(back);
          card.appendChild(row);
        }
        function section(title, cols, opts) {
          var lab = document.createElement('div'); lab.className = 'mm-sec'; lab.textContent = title; card.appendChild(lab);
          var box = document.createElement('div'); box.className = 'mm-opts';
          box.style.gridTemplateColumns = 'repeat(' + cols + ',1fr)';
          opts.forEach(function (o) {
            var b = document.createElement('button');
            b.type = 'button'; b.className = 'mm-opt' + (o.sel ? ' sel' : '') + (o.col ? ' mm-col' : '');
            b.innerHTML = o.html;
            b.setAttribute('aria-pressed', o.sel ? 'true' : 'false');
            b.onclick = function () { o.pick(); ctx.save(save); ctx.sfx('tap'); var y = wrap.scrollTop; build(); wrap.scrollTop = y; };
            box.appendChild(b);
          });
          card.appendChild(box);
        }
        build();
        offBal = window.Skarbonka && Skarbonka.on ? Skarbonka.on(function () { if (alive && card.isConnected) { var y = wrap.scrollTop; build(); wrap.scrollTop = y; } }) : null;
      }

      // ---------- game ----------
      function newGame() {
        stopBal();
        var t = themeOf(save.theme), s = sizeOf(save.size), P = s.cols * s.rows / 2;
        var keys = shuffle(t.items.slice()).slice(0, P), deck = [];
        keys.forEach(function (k) {
          deck.push({ k: k, w: false });
          deck.push({ k: k, w: !!t.english });
        });
        shuffle(deck);
        g = { theme: t.id, size: s.id, players: save.players === 2 ? 2 : 1, deck: deck, done: deck.map(function () { return -1; }),
          moves: 0, scores: [0, 0], turn: 0, ms: 0 };
        finished = false; open = []; clockStart = 0;
        persist();
        buildBoard();
      }
      function validCur(c) {
        if (!c || !Array.isArray(c.deck) || !Array.isArray(c.done) || c.deck.length !== c.done.length) return false;
        var s = sizeOf(c.size);
        if (c.deck.length !== s.cols * s.rows) return false;
        for (var i = 0; i < c.deck.length; i++) if (!c.deck[i] || !picOf(c.deck[i].k)) return false;
        if (!Array.isArray(c.scores)) c.scores = [0, 0];
        c.turn = c.turn === 1 && c.players === 2 ? 1 : 0;
        c.moves = +c.moves || 0; c.ms = +c.ms || 0;
        return c.done.some(function (d) { return d < 0; });
      }
      function cancelAllPlay() {
        if (pending) { cancel(pending); pending = 0; }
        open = [];
      }

      function buildBoard() {
        closePanel();
        root.innerHTML = '';
        var t = themeOf(g.theme);
        root.style.setProperty('--back', t.back);
        hud = document.createElement('div'); hud.className = 'mm-hud';
        board = document.createElement('div'); board.className = 'mm-board';
        grid = document.createElement('div'); grid.className = 'mm-grid';
        board.appendChild(grid);
        root.appendChild(hud); root.appendChild(board);
        cards = g.deck.map(function (c, i) {
          var b = document.createElement('button');
          b.type = 'button'; b.className = 'mm-card';
          b.dataset.i = i;
          b.style.setProperty('--tilt', (((i * 37 + 11) % 7) - 3) * 0.45 + 'deg');
          b.setAttribute('aria-label', 'Karta ' + (i + 1));
          var front = c.w
            ? '<div class="mm-face mm-front mm-word"><span>' + c.k + '</span></div>'
            : '<div class="mm-face mm-front">' + svg(picOf(c.k)) + '</div>';
          b.innerHTML = '<div class="mm-in"><div class="mm-face mm-back">' + svg(BACK_STAR) + '</div>' + front + '<div class="mm-badge">' + BADGE + '</div></div>';
          if (g.done[i] >= 0) { b.classList.add('open', 'done'); b.style.setProperty('--pc', g.players === 2 ? P_COL[g.done[i]] : SOLO_COL); }
          grid.appendChild(b);
          return b;
        });
        grid.addEventListener('click', onGridClick);
        updateHud();
        layout();
      }
      function layout() {
        if (!grid || !g) return;
        var W = board.clientWidth, H = board.clientHeight;
        if (!W || !H) return;
        var s = sizeOf(g.size), pad = 10, gap = W < 420 ? 8 : 12, A = 0.8, best = null;
        [[s.cols, s.rows], [s.rows, s.cols]].forEach(function (o) {
          var c = o[0], r = o[1];
          var w = Math.min((W - 2 * pad - gap * (c - 1)) / c, ((H - 2 * pad - gap * (r - 1)) / r) * A);
          if (!best || w > best.w * 1.12) best = { c: c, r: r, w: w };
        });
        var w = Math.max(30, Math.floor(Math.min(best.w, 180))), h = Math.floor(w / A);
        var gw = best.c * w + (best.c - 1) * gap, gh = best.r * h + (best.r - 1) * gap;
        grid.style.gridTemplateColumns = 'repeat(' + best.c + ',' + w + 'px)';
        grid.style.gridAutoRows = h + 'px';
        grid.style.gap = gap + 'px';
        grid.style.left = Math.round((W - gw) / 2) + 'px';
        grid.style.top = Math.round(Math.max(4, (H - gh) / 2)) + 'px';
        root.style.setProperty('--r', Math.round(Math.max(10, Math.min(20, w * 0.15))) + 'px');
        cards.forEach(function (b, i) {
          var c = g.deck[i];
          if (!c.w) return;
          var sp = b.querySelector('.mm-word span');
          if (sp) sp.style.fontSize = Math.round(Math.min(0.42, 1.7 / c.k.length) * w) + 'px';
        });
      }
      function updateHud() {
        if (!hud || !g) return;
        var P = g.deck.length / 2, found = g.done.filter(function (d) { return d >= 0; }).length / 2;
        if (g.players === 2) {
          hud.innerHTML = [0, 1].map(function (p) {
            var on = p === g.turn;
            return '<div class="mm-pill mm-pl' + (on ? ' on' : '') + '" style="border-color:' + (on ? P_COL[p] : INK) + ';background:' + (on ? P_BG[p] : '#fff') + '">' +
              (on ? '▶ ' : '') + 'Gracz ' + (p + 1) + ': <b style="color:' + P_COL[p] + '">' + g.scores[p] + '</b></div>';
          }).join('');
        } else {
          hud.innerHTML = '<div class="mm-pill">Ruchy: <b>' + g.moves + '</b></div><div class="mm-pill">Pary: <b>' + found + '</b> / ' + P + '</div>';
        }
      }
      function showTurn() {
        if (!board || g.players !== 2) return;
        var old = board.querySelector('.mm-turn'); if (old) old.remove();
        var d = document.createElement('div');
        d.className = 'mm-turn';
        d.style.borderColor = P_COL[g.turn];
        d.style.color = P_COL[g.turn];
        d.textContent = 'Teraz Gracz ' + (g.turn + 1);
        board.appendChild(d);
        later(function () { d.remove(); }, 1500);
      }
      function setOpen(i, on) { if (cards[i]) cards[i].classList.toggle('open', on); }
      function anim(i, cls) {
        var b = cards[i]; if (!b || reduce) return;
        b.classList.remove(cls); void b.offsetWidth; b.classList.add(cls);
        later(function () { b.classList.remove(cls); }, 550);
      }

      function onGridClick(ev) {
        var b = ev.target.closest ? ev.target.closest('.mm-card') : null;
        if (!b || !grid.contains(b)) return;
        tap(+b.dataset.i);
      }
      function tap(i) {
        if (!g || finished || panel) return;
        if (pending) resolveMismatch();
        if (g.done[i] >= 0 || open.indexOf(i) >= 0 || open.length >= 2) { if (g.done[i] >= 0) anim(i, 'pop'); return; }
        if (!clockStart) clockStart = performance.now();
        open.push(i);
        setOpen(i, true);
        ctx.sfx('open');
        var c = g.deck[i];
        if (open.length < 2) { if (c.w) say(c.k); return; }
        g.moves++;
        var a = open[0], bI = open[1];
        if (g.deck[a].k === g.deck[bI].k) {
          var who = g.turn;
          g.done[a] = g.done[bI] = who;
          g.scores[who]++;
          open = [];
          var allDone = g.done.every(function (d) { return d >= 0; });
          if (!allDone) persist();
          ctx.stat('pairs', 1);
          later(function () {
            [a, bI].forEach(function (k) {
              cards[k].style.setProperty('--pc', g.players === 2 ? P_COL[who] : SOLO_COL);
              cards[k].classList.add('done');
              anim(k, 'pop');
            });
            ctx.sfx('star');
            if (themeOf(g.theme).english) say(g.deck[a].k);
          }, reduce ? 150 : 400);
          updateHud();
          if (allDone) finish();
        } else {
          // the next player is decided now (saved), the HUD follows when the cards close
          if (g.players === 2) g.turn = 1 - g.turn;
          persist();
          if (c.w) say(c.k);
          updateHud2Moves();
          pending = later(resolveMismatch, 1150);
        }
      }
      function updateHud2Moves() {
        // solo: moves count now; duo: keep the current player's highlight until the cards close
        if (g.players !== 2) updateHud();
      }
      function resolveMismatch() {
        if (pending) { cancel(pending); pending = 0; }
        if (!g) return;
        open.forEach(function (k) { setOpen(k, false); anim(k, 'shake'); });
        open = [];
        ctx.sfx('close');
        updateHud();
        if (g.players === 2) showTurn();
      }

      // results and stats are recorded right away; the win sound, confetti and end card follow the last flip
      function finish() {
        finished = true;
        tickClock(); clockStart = 0;
        var s = sizeOf(g.size), t = themeOf(g.theme), P = g.deck.length / 2;
        var stars = rating(g.moves, P);
        var prevBest = save.best[g.size] || 0;
        var isBest = !prevBest || g.moves < prevBest;
        if (isBest) save.best[g.size] = g.moves;
        save.games = (save.games || 0) + 1;
        save.pairs = (save.pairs || 0) + P;
        var result = { moves: g.moves, ms: g.ms, stars: stars, P: P, size: s, theme: t, players: g.players, scores: g.scores.slice(), best: save.best[g.size], isBest: isBest && !!prevBest };
        persist();   // finished -> cur cleared
        ctx.stat('games', 1);
        if (stars === 3) ctx.stat('stars3', 1);
        if (s.id === 'l') ctx.sticker('big');
        if (t.english) ctx.sticker('english');
        if (g.players === 2) ctx.sticker('duo');
        if (stars === 3) ctx.sticker('stars3');
        later(function () {
          ctx.sfx('win');
          confetti();
          later(function () { showEnd(result); }, reduce ? 400 : 1300);
        }, reduce ? 300 : 650);
      }
      function confetti() {
        if (reduce || !board) return;
        var H = board.clientHeight, W = board.clientWidth;
        var cols = ['#f8d84a', '#f28ab2', '#6fb3ee', '#7cc35a', '#c9a6f2'];
        for (var k = 0; k < 18; k++) {
          var d = document.createElement('div');
          d.className = 'mm-conf';
          d.style.left = Math.round(Math.random() * (W - 22)) + 'px';
          d.style.setProperty('--fall', (H + 60) + 'px');
          d.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's';
          d.innerHTML = '<svg viewBox="0 0 100 100"><path d="' + starPath(50, 54, 44, 19) + '" fill="' + cols[k % cols.length] + '" stroke="#1d2f6f" stroke-width="6" stroke-linejoin="round"/></svg>';
          board.appendChild(d);
        }
        later(function () { if (board) board.querySelectorAll('.mm-conf').forEach(function (n) { n.remove(); }); }, 2300);
      }
      function showEnd(r) {
        var title, lines = [];
        if (r.players === 2) {
          title = r.scores[0] === r.scores[1] ? 'Remis!' : 'Wygrywa Gracz ' + (r.scores[0] > r.scores[1] ? 1 : 2) + '!';
          lines.push('Gracz 1: ' + r.scores[0] + ' ' + plural(r.scores[0], 'para', 'pary', 'par') + ' · Gracz 2: ' + r.scores[1] + ' ' + plural(r.scores[1], 'para', 'pary', 'par'));
        } else {
          title = r.stars === 3 ? 'Super!' : r.stars === 2 ? 'Brawo!' : 'Udało się!';
        }
        lines.push('Ruchy: ' + r.moves + ' · Czas: ' + fmtTime(r.ms));
        if (r.isBest) lines.push({ text: 'Nowy rekord dla ' + r.size.label + '!' });
        else lines.push({ text: 'Najlepiej (' + r.size.label + '): ' + r.best + ' ' + plural(r.best, 'ruch', 'ruchy', 'ruchów'), muted: true });
        if (r.stars < 3) lines.push({ text: 'Na 3 ★: najwyżej ' + (Math.round(r.P * 1.75) + 1) + ' ruchów', muted: true });
        panel = ctx.panel({
          title: title,
          big: '★★★'.slice(0, r.stars) + '☆☆☆'.slice(0, 3 - r.stars),
          lines: lines,
          medals: true,
          price: PRICE, note: 'gra',
          button: 'Jeszcze raz',
          onPlay: function () { panel = null; ctx.sfx('buy'); newGame(); },
          secondary: [
            { label: 'Zmień karty', onClick: function () { panel = null; showSetup(); } },
            { label: 'Wróć do gier', onClick: function () { panel = null; ctx.exit(); } }
          ]
        });
      }
      function showResume() {
        g = save.cur; finished = false; open = [];
        buildBoard();
        var t = themeOf(g.theme), s = sizeOf(g.size);
        panel = ctx.panel({
          title: 'Memo',
          lines: ['Masz zaczętą grę.', t.name + ' · ' + s.label + (g.players === 2 ? ' · 2 graczy' : ''), { text: 'Ruchy: ' + g.moves, muted: true }],
          button: 'Graj dalej',
          onPlay: function () { panel = null; if (g.players === 2) showTurn(); },
          secondary: [
            { label: 'Nowa gra', onClick: function () { panel = null; showSetup(); } },
            { label: 'Wróć do gier', onClick: function () { panel = null; ctx.exit(); } }
          ]
        });
      }

      function onResize() { layout(); }
      if (window.ResizeObserver) { ro = new ResizeObserver(onResize); ro.observe(root); }
      else window.addEventListener('resize', onResize);

      if (validCur(save.cur)) showResume();
      else { save.cur = null; showSetup(); }

      return {
        destroy: function () {
          if (g && !finished) persist();
          alive = false;
          timers.forEach(clearTimeout); timers = [];
          pending = 0;
          stopBal();
          closePanel();
          if (ro) ro.disconnect(); else window.removeEventListener('resize', onResize);
          if (grid) grid.removeEventListener('click', onGridClick);
          if (spoke) { try { speechSynthesis.cancel(); } catch (e) {} }
          root.remove();
          css.remove();
        },
        pause: function () { tickClock(); clockStart = 0; if (g && !finished) persist(); },
        resume: function () {}
      };
    }
  });
})();
