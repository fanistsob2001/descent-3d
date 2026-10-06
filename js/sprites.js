'use strict';

// Pixel-art sprites των χαρακτήρων (STORY.md, ενότητα 6): κάθε sprite είναι ένα πλέγμα
// από χαρακτήρες (ένας χαρακτήρας = ένα art pixel), με τα χρώματα της SPR_PAL.
// Στο init() γίνονται μικροί καμβάδες (και καθρεφτισμένοι, για όταν κοιτάνε αριστερά)
// με αυτόματο περίγραμμα γύρω γύρω. Ζωγραφίζονται στον μικρό καμβά του Pixel,
// ένα pixel του sprite = ένα art pixel, πάντα σε ακέραιες θέσεις (καθαρά pixels).
// Όλα κοιτάνε δεξιά στο σχέδιο ('.' = διάφανο).

// Παλέτα: ζεστά χρώματα πηλού / αγγείου (χωρίς μπλε ή ψυχρά γκρι).
const SPR_PAL = {
  h: '190,64,34',    // κόκκινα μαλλιά (Ορφέας)
  H: '120,34,18',
  s: '238,172,120',  // δέρμα (άμμος / πηλός)
  S: '196,122,78',
  e: '40,20,12',     // μάτια, σκούρες λεπτομέρειες
  w: '244,230,204',  // χιτώνας / λευκό φόρεμα
  W: '196,172,136',
  b: '124,66,32',    // δέρμα (ζώνη, σανδάλια)
  y: '246,196,72',   // χρυσό (λύρα, στέμματα)
  Y: '176,122,40',
  1: '255,246,210',  // οι τρεις χορδές της λύρας (φαίνονται όσες έχεις βρει)
  2: '255,246,210',
  3: '255,246,210',
  k: '50,42,38',     // κάρβουνο (σκιές, πανοπλία του Άδη)
  K: '30,24,22',
  E: '255,252,240',  // λευκά μάτια που λάμπουν (σκιές)
  p: '250,244,234',  // χλωμό φάσμα (Ευρυδίκη, ψυχές)
  P: '206,194,180',
  c: '196,180,160',  // χλωμά μαλλιά (Ευρυδίκη)
  v: '110,98,90',    // μάτι του φάσματος
  g: '214,158,58',   // φίδι: χρυσό / καφέ με σκούρες ρίγες
  G: '150,94,38',
  d: '86,52,22',
  t: '210,44,32',    // γλώσσα
  q: '104,68,32',    // ξερό χορτάρι
  Q: '150,104,48',
  r: '176,34,34',    // ρόδι (στέμμα της Περσεφόνης), κόκκινα μάτια
  R: '120,20,24',
  a: '64,32,22',     // σκούρα μαλλιά (Περσεφόνη)
  m: '92,62,46',     // πέτρα (θρόνοι)
  M: '58,38,30',
  n: '128,90,66',
  o: '150,96,48',    // ξύλο (κουπί, βάρκα)
  O: '100,62,30',
  T: '186,118,70',   // ηλιοκαμένο δέρμα (Χάροντας)
  U: '140,84,48',
  B: '210,196,172',  // γκριζωπά μαλλιά και γένια (Χάροντας)
  z: '110,74,48',    // χιτώνας του Χάροντα
  Z: '70,46,30',
  // Διακοσμητικά του 3D κόσμου:
  i: '222,204,168',  // κόκαλο
  I: '150,128,96',
  l: '150,62,40',    // πέτρα (σταλαγμίτες, πέτρες)
  L: '92,34,24',
  j: '128,84,52',    // σκουριασμένο σίδερο (αλυσίδες)
  J: '74,46,30',
  f: '240,228,204',  // άνθος ασφόδελου
  F: '124,104,52',   // μίσχος / ξερό χορτάρι
  x: '160,126,62',   // καλάμι
  X: '104,80,38',
  A: '184,94,50',    // πηλός αμφορέα
  C: '122,56,30',
  N: '30,18,12',     // μαύρο γάνωμα
  V: '176,142,96',   // μπρούντζος / πέτρα αγάλματος
  D: '108,84,56',
};

// ---- Ορφέας: σύνθεση από πάνω μέρος (γραμμές 0-12) και πόδια (13-15) ----
const ORPHEUS_UPPER = {
  base: [
    '...hhhh......',
    '..hhhhhhh....',
    '..hhhhsss....',
    '..hhhhses....',
    '..Hhhssss....',
    '...Hhsss.....',
    '....Ss..y...y',
    '...wwwwwyyyyy',
    '..Wwwwwwy123y',
    '..Wwwwwss123y',
    '..Wbbbbb.YYY.',
    '..Wwwwww.....',
    '..Wwwwww.....',
  ],
};
// Τρέξιμο: τα μαλλιά πετάνε πίσω.
ORPHEUS_UPPER.run = ORPHEUS_UPPER.base.map((r, i) =>
  i === 1 ? '.hhhhhhhh....' : i === 2 ? 'hhhhhhsss....' : r);
// Παίζει τη λύρα (φόρτιση κύματος): το χέρι περνάει πάνω από τις χορδές.
ORPHEUS_UPPER.play0 = ORPHEUS_UPPER.base.map((r, i) => (i === 8 ? '..Wwwwwwys23y' : r));
ORPHEUS_UPPER.play1 = ORPHEUS_UPPER.base.map((r, i) => (i === 8 ? '..Wwwwwwy12sy' : r));

const ORPHEUS_LEGS = {
  stand: ['...WwwwW.....', '....s.s......', '...bb.bb.....'],
  stepA: ['...WwwwW.....', '...S...s.....', '..bb...bb....'],
  stepB: ['...WwwwW.....', '...s...S.....', '..bb...bb....'],
  pass:  ['...WwwwW.....', '.....s.......', '....bb.......'],
  runA:  ['...WwwwWw....', '..S.....s....', '.bb......bb..'],
  runB:  ['...WwwwWw....', '..s.....S....', '.bb......bb..'],
};

// [πάνω μέρος, πόδια, πόσο "βουλιάζει" το πάνω μέρος (art px)]
const ORPHEUS_ANIMS = {
  idle: [['base', 'stand', 0], ['base', 'stand', 1]],
  walk: [['base', 'stepA', 1], ['base', 'pass', 0], ['base', 'stepB', 1], ['base', 'pass', 0]],
  run:  [['run', 'runA', 1], ['run', 'pass', 0], ['run', 'runB', 1], ['run', 'pass', 0]],
  play: [['play0', 'stand', 0], ['play1', 'stand', 0]],
};

// ---- Ευρυδίκη (χλωμό, διάφανο φάσμα με αρχαίο φόρεμα) ----
const EURY_TOP = [
  '...cccc....',
  '..cccccc...',
  '..cccpppp..',
  '.ccccppvp..',
  '.ccccpppp..',
  '.cccc.pp...',
  '.ccc..pP...',
  '.cc.PpppP..',
  '..pPpppPp..',
  '..p.pppp.p.',
  '...PPPPP...',
  '...ppppp...',
  '...pppppp..',
  '..Ppppppp..',
];
const EURY_HEM = {
  A: ['..Ppppppp..', '.Pppppppp..'],
  B: ['..pppppppP.', '..PpppppppP'],
  C: ['..Ppppppp..', '..PPpppppP.'],
};

// ---- Σκιά (κάρβουνο, σκυφτή, με απλωμένα χέρια και λευκά μάτια) ----
const SHADE_TOP = [
  '......kkkk....',
  '.....kkkkkk...',
  '.....kkEkEk...',
  '.....kkkkkk...',
  '....kkkkkk....',
  '..kkkkkkkkkkk.',
  '.kkkkkkkkkkkkk',
  '.kkkkkk...kKkK',
  '..kkkkk.......',
  '..Kkkkk.......',
  '..Kkkkkk......',
  '..KkkkkkK.....',
];
const SHADE_TAT = {
  A: ['..Kk...kK.....', '.Kk.....kK....'],
  B: ['...Kk.kK......', '...Kk..kK.....'],
};

// ---- Ερινύα (φτερωτή γυναίκα από μπροστά, φίδια στα μαλλιά, κίτρινα μάτια) ----
// Γράφεται μόνο το αριστερό μισό· το δεξί είναι καθρέφτης. Δύο καρέ: φτερά κάτω / πάνω.
const ERINYS_HALF = {
  A: [
    '........g',
    '.....g.gG',
    'K...gGgGR',
    'KK..GgRRR',
    'KkK..gRyR',
    'KkkK..RRR',
    'KkkkK..RR',
    '.KkkkKkkk',
    '..KkkkKkk',
    '...KKkkkk',
    '....KRkkk',
    '.....Rkkk',
    '......kkk',
    '......kKk',
    '.......kK',
    '.......K.',
  ],
  B: [
    'K.......g',
    'KK...g.gG',
    'KkK.gGgGR',
    '.KkKGgRRR',
    '..KkKgRyR',
    '...KkKRRR',
    '....KkKRR',
    '.....Kkkk',
    '......Kkk',
    '......kkk',
    '....KRkkk',
    '.....Rkkk',
    '......kkk',
    '......kKk',
    '.......kK',
    '.......K.',
  ],
};

// ---- Χαμένη ψυχή (φωτεινό χλωμό πνεύμα, μισό σώμα με ουρά) ----
const SOUL_TOP = [
  '...ppp...',
  '..ppppp..',
  '..pPpPp..',
  '..ppppp..',
  '...ppp...',
  '.ppppppp.',
  'ppPpppPpp',
  'p.ppppp.p',
  '..ppppp..',
  '..Ppppp..',
];
const SOUL_TAIL = {
  A: ['...ppP...', '...Pp....', '....P....'],
  B: ['...Ppp...', '....pP...', '.....P...'],
};

// ---- Φίδι (κουλουριασμένο στο χορτάρι) ----
const SNAKE_BASE = [
  '.gGgGgGgGgGgg.',
  'gddddddddddddg',
  '.gGgGgGgGgGgg.',
];
const SNAKE_TOP = {
  coil: [
    '..............',
    '..............',
    '..............',
    '....gGgGgGg...',
    '..ggdddddggegg',
  ],
  hiss: [
    '..........ggg.',
    '.........gdegt',
    '.........gg..t',
    '....gGgGgGg...',
    '..ggdddddgg...',
  ],
};
const GRASS = [
  '.Q......Q.....Q...',
  '.q.Q...qQ...Q.q.Q.',
  'qQ.q.Q.q.q.Qq.qQq.',
  'qqQqqqQqqQqqqQqqqQ',
];

// ---- Άδης στον θρόνο (μπροστινή όψη) ----
const HADES = [
  '..nn........nn..',
  '..mm.y.yy.y.mm..',
  '..mm.kykkyk.mm..',
  '..mm.KssssK.mm..',
  '..mm.KeSSeK.mm..',
  '..mm.KsssSK.mm..',
  '..mm.KKKKKK.mm..',
  '..mmkKKKKKKkmm..',
  '..mkkkKKKKkkkm..',
  '..mkykkKKkkykm..',
  '..mkkkkkkkkkkm..',
  '..mskkyyyykksm..',
  '.nnnkkkkkkkknnn.',
  '.mmmkkkkkkkkmmm.',
  '.mmmKkkkkkkKmmm.',
  '.mmmmKkkkkKmmmm.',
  '.mmmmKkkkkKmmmm.',
  '.MMMMbb..bbMMMM.',
  '.nnnnnnnnnnnnnn.',
  '.MMMMMMMMMMMMMM.',
];
// Μικρό σκυλί του Κάτω Κόσμου με τρία κεφάλια, δίπλα στον θρόνο.
const HOUND = [
  'k.k.k.....',
  'rkrkrk....',
  'kkkkkk....',
  '..kkkk....',
  '..kkkkkkk.',
  '..kkkkkkkk',
  '..k.k..kk.',
];

// ---- Περσεφόνη στον θρόνο (λευκό φόρεμα, στέμμα με ρόδι) ----
const PERSEPHONE = [
  '..nn...r....nn..',
  '..mm.yrRRry.mm..',
  '..mm.aaaaaa.mm..',
  '..mm.assssa.mm..',
  '..mm.aessea.mm..',
  '..mm.aSssSa.mm..',
  '..mm.aasSaa.mm..',
  '..mmawwwwwwamm..',
  '..mawwwrwwwwam..',
  '..mawwwwwwwwam..',
  '..mswwwyywwwsm..',
  '..mswwwwwwwwsm..',
  '.nnnwwwwwwwwnnn.',
  '.mmmWwwwwwwWmmm.',
  '.mmmWwwwrwwWmmm.',
  '.mmmmWwwwwWmmmm.',
  '.mmmmWwwwwWmmmm.',
  '.MMMMss..ssMMMM.',
  '.nnnnnnnnnnnnnn.',
  '.MMMMMMMMMMMMMM.',
];
// Γέρνει προς τον Άδη (που κάθεται αριστερά της): το κεφάλι ένα pixel αριστερά.
const PERSEPHONE_LEAN = PERSEPHONE.map((r, i) => [
  '..nn..r.....nn..',
  '..mmyrRRry..mm..',
  '..mmaaaaaa..mm..',
  '..mmassssa..mm..',
  '..mmaessea..mm..',
  '..mmaSssSa..mm..',
  '..mmaasSaa..mm..',
][i] || r);

// ---- Χάροντας (ηλιοκαμένος βαρκάρης με κουπί) και η βάρκα του ----
const CHARON = [
  '...BBBB....o',
  '..BBBBBB...o',
  '..BBTTTT...o',
  '..BTTTeT...o',
  '..BTTTTU...o',
  '..BBBBBB...o',
  '...BBBB....o',
  '..zzBBzzTTTo',
  '.zzzzzzz..To',
  '.Zzzzzzz...o',
  '.ZzzzzzzT..o',
  '.Zzzbbzz...o',
  '.Zzzzzzz...o',
  '..Zzzzzz...o',
  '..Zzzzzz...o',
  '..UT..TU...O',
  '..bb..bb...O',
  '...........O',
];
// Όσο περιμένει τον οβολό: απλώνει την παλάμη.
const CHARON_ASK = CHARON.map((r, i) => (i === 10 ? '.ZzzzzzzTTTo' : r));
const BOAT = [
  'O' + '.'.repeat(26) + 'O',
  'Oo' + '.'.repeat(24) + 'oO',
  '.O' + 'o'.repeat(24) + 'O.',
  '..O' + 'o'.repeat(21) + 'EO..',   // "μάτι" στην πλώρη, όπως στα πλοία των αγγείων
  '...' + 'O'.repeat(22) + '...',
];

// ---- Εικονίδια πάνω από τις σκιές: "ακούει" ((•)) και "ψάχνει" ? ----
const ICON_HEAR = [
  '.y.......y.',
  'y..y...y..y',
  'y.y..y..y.y',
  'y.y.yyy.y.y',
  'y.y..y..y.y',
  'y..y...y..y',
  '.y.......y.',
];
const ICON_SEARCH = [
  '.yy.',
  'y..y',
  '..y.',
  '....',
  '..y.',
];

// ---- Διακοσμητικά του 3D κόσμου (φαίνονται μόνο όταν τα φωτίζει ο ήχος) ----
const STALAGMITE = [
  '....l.....',
  '....l.....',
  '...lL.....',
  '...llL....',
  '...llL....',
  '..lllLL...',
  '..lllLL...',
  '..llllL...',
  '.lllllLL..',
  '.lllllLL..',
  '.llllllLL.',
  'lllllllLL.',
  'llllllllLL',
  'LLLLLLLLLL',
];
const ROCKS = [
  '...lll.......',
  '..llllL...l..',
  '.lllllLL.llL.',
  'llllllLLlllLL',
  'LLLLLLLLLLLLL',
];
const SKULL = [
  '..iiiii..',
  '.iiiiiiI.',
  'iiiiiiiiI',
  'iNNiiNNiI',
  'iNNiiNNiI',
  'iiiiNiiiI',
  '.IiiiiiI.',
  '.iNiNiNi.',
  '..IiIiI..',
];
const BONES = [
  'ii.........ii.',
  'iiiiiiiiiiiiI.',
  '.IiiiiiiiiiI..',
  'ii.........II.',
  '...ii..ii.....',
  '..iIiiiiIi....',
];
const SKULLPILE = [
  '.....iiii.......',
  '....iNiiNi......',
  '...iiiiiiiiii...',
  '..iiNiiNiiNiNi..',
  '.iiiiiiiiiiiiii.',
  'iiNiiNiiiNiiNiiI',
  'iIiiiiIiiiiiIiiI',
  'IIIIiIIIiIIIIIII',
];
const AMPHORA = [
  '...NNNNN...',
  '....AAA....',
  '..A.AAA.A..',
  '..AAAAAAA..',
  '.AAAAAAAAC.',
  'AAAAAAAAAAC',
  'NNNNNNNNNNN',
  'AANNAANNAAC',
  'NNNNNNNNNNN',
  'AAAAAAAAAAC',
  '.AAAAAAAAC.',
  '..AAAAAAC..',
  '...AAAAC...',
  '....AAC....',
  '...NNNNN...',
];
const AMPHORA_BROKEN = [
  '..A......A..',
  '..AA..A.AA..',
  '.AAAAAAAAAC.',
  'NNNNNNNNNNNN',
  'AAAAAAAAAAAC',
  '.AAAAAAAAAC.',
  '..AAAAAAAC..',
  '...AAAAAC.A.',
  '....AAAC.AC.',
];
const ASPHODEL = [
  '.f.....f...',
  'fff...fff.f',
  '.f.f...f.ff',
  '.F.fff.F.f.',
  '.F..f..F.F.',
  '..F.F.F..F.',
  '..F.F.F.F..',
  '...FFFF.F..',
  '....FFFF...',
  '....FF.....',
];
const REEDS = [
  '.x......x..',
  '.x...x..x..',
  '.X...x..X..',
  '.x...X..x.x',
  '.x...x..x.x',
  'xX...x..X.X',
  'x.x..x.x..x',
  'x.x..X.x..x',
  'X.x..x.X..X',
  'x.X..x.x.x.',
  '.xx.xX.x.x.',
  '.x..x..xx..',
  '.X.xX..X...',
  '.xxx...x...',
  '..xX.xX....',
  '..XXXX.....',
];
const CHAIN_LINK = ['.j.', 'j.j', 'j.J', '.J.'];
const CHAIN = [].concat(...Array.from({ length: 8 }, () => CHAIN_LINK));
const ROOTS = [
  'FFFFFFFFFFFF',
  '.F.F..F.FF.F',
  '.F.F..F..F.F',
  '.F..F.F..F..',
  'F...F..F.F..',
  'F...F..F..F.',
  '.F..F..F..F.',
  '.F.F...F..F.',
  '.F.F..F...F.',
  '..F...F...F.',
  '..F...F....F',
  '..F..F.....F',
  '...F.F.....F',
  '...F.F......',
  '...F........',
  '....F.......',
];
// Άγαλμα (κούρος) σε βάθρο: μπρούντζος/πέτρα, στο παλάτι.
const STATUE = [
  '....VVV.....',
  '...VVVVV....',
  '...VDVDV....',
  '...VVVVV....',
  '....VVV.....',
  '..VVVVVVV...',
  '.VVVVVVVVV..',
  '.VV.VVVV.VV.',
  '.VV.VVVV.VV.',
  '.VD.VVVV.DV.',
  '.V..VVVV..V.',
  '....VVVV....',
  '....VDDV....',
  '....VV.VV...',
  '....VV.VV...',
  '....VV.VV...',
  '...VVV.VVV..',
  '..DDDDDDDD..',
  '.VVVVVVVVVV.',
  '.VDVDVDVDVV.',
  '.VVVVVVVVVV.',
  'DDDDDDDDDDDD',
];

// ---- "Ζωγραφική" σε πλέγμα χαρακτήρων (για τα μεγάλα, λεπτομερή sprites του 3D) ----
// ops πάνω σε ένα πλέγμα w×h γεμάτο '.': ellipse(cx, cy, rx, ry, ch), line(x0, y0, x1, y1, w, ch),
// poly([[x, y], ...], ch), px(x, y, ch). Επιστρέφει πίνακα από strings (όπως τα χειροποίητα).
function paintGrid(w, h, draw) {
  const g = Array.from({ length: h }, () => new Array(w).fill('.'));
  const set = (x, y, ch) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = ch; };
  const api = {
    px: set,
    ellipse(cx, cy, rx, ry, ch) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) set(x, y, ch);
        }
      }
    },
    line(x0, y0, x1, y1, lw, ch) {
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
        for (let a = -(lw - 1) / 2; a <= (lw - 1) / 2; a += 0.5) for (let b = -(lw - 1) / 2; b <= (lw - 1) / 2; b += 0.5) set(x + a, y + b, ch);
      }
    },
    poly(pts, ch) {
      const ys = pts.map((p) => p[1]);
      for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
        const xs = [];
        for (let i = 0; i < pts.length; i++) {
          const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
          if ((y0 <= y + 0.5 && y1 > y + 0.5) || (y1 <= y + 0.5 && y0 > y + 0.5)) xs.push(x0 + ((y + 0.5 - y0) * (x1 - x0)) / (y1 - y0));
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) set(x, y, ch);
      }
    },
  };
  // mirror(): ό,τι είναι ζωγραφισμένο στο αριστερό μισό αντιγράφεται καθρεφτισμένο δεξιά (για
  // συμμετρικές μορφές από μπροστά). map(fn): αλλάζει κάθε pixel — fn(x, y, ch) → νέος χαρακτήρας.
  api.mirror = () => {
    for (let y = 0; y < h; y++) for (let x = 0; x < Math.floor(w / 2); x++) if (g[y][x] !== '.') g[y][w - 1 - x] = g[y][x];
  };
  api.map = (fn) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y][x] = fn(x, y, g[y][x]);
  };
  api.get = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? g[y][x] : '.');
  draw(api);
  return g.map((r) => r.join(''));
}

// Η σκιά (3D): σκυφτό, σκελετωμένο πλάσμα με κουκούλα, κρανίο με μάτια που λάμπουν και κόκκινο
// στόμα, πλευρά που φαίνονται, μακριά χέρια με νύχια, κουρελιασμένο σάβανο. Κοιτάζει δεξιά.
// f = καρέ (0 / 1): τα πόδια, το κρεμασμένο χέρι και ο ποδόγυρος αλλάζουν.
function ghoulGrid(f) {
  return paintGrid(30, 38, (p) => {
    const sw = f ? 1 : -1;
    // Σάβανο: φαρδαίνει προς τα κάτω, με κουρελιασμένο ποδόγυρο.
    const hem = [];
    for (let x = 22; x >= 4; x -= 2) hem.push([x, 32 + ((x / 2 + f) % 2 ? 2 : 0)]);
    p.poly([[8, 13], [19, 13], [23, 31], ...hem, [4, 31]], 'k');
    for (let x = 7; x <= 20; x += 3) p.line(x, 20, x - 1 + (x > 13 ? 2 : 0), 31, 1, 'K');   // πτυχώσεις
    // Πόδια (σκελετωμένα) κάτω από τον ποδόγυρο.
    p.line(10 + sw, 32, 9 + sw, 37, 1, 'I');
    p.line(16 - sw, 32, 17 - sw, 37, 1, 'I');
    p.px(8 + sw, 37, 'I'); p.px(18 - sw, 37, 'I');
    // Θώρακας: σκοτεινή κοιλότητα με πλευρά.
    p.ellipse(14, 18, 5.5, 5, 'K');
    for (const y of [15, 17, 19, 21]) { p.line(10, y, 13, y + 0.5, 1, 'I'); p.line(15, y + 0.5, 18, y, 1, 'I'); }
    p.line(14, 14, 14, 22, 1, 'i');        // σπονδυλική στήλη / στέρνο
    // Σκυφτοί ώμοι.
    p.ellipse(14, 12.5, 8, 3, 'k');
    // Κουκούλα και κρανίο (μπροστά και ψηλά, δεξιά).
    p.ellipse(20, 7, 6, 6, 'k');
    p.ellipse(21, 7.5, 4, 4.5, 'i');
    p.ellipse(19.5, 6.5, 1.3, 1.3, 'K'); p.ellipse(23, 6.5, 1.3, 1.3, 'K');   // κόγχες
    p.px(19.5, 6.5, 'E'); p.px(23, 6.5, 'E');                                 // μάτια
    p.px(21.5, 8.5, 'I');                                                      // μύτη
    p.line(18.5, 10.5, 24, 10.5, 1, 'r');                                      // στόμα
    for (let x = 19; x <= 23; x += 2) p.px(x, 10, 'i');                        // δόντια
    p.line(19, 11.5, 23, 11.5, 1, 'I');                                        // σαγόνι
    // Χέρι που απλώνεται μπροστά (δεξιά), με νύχια.
    p.line(19, 13, 24, 17 + sw * 0.5, 2, 'k');
    p.line(24, 17 + sw * 0.5, 27, 22, 2, 'k');
    p.line(27, 22, 29, 25, 1, 'i'); p.line(27, 22, 27, 26, 1, 'i'); p.line(27, 22, 25, 25, 1, 'i');
    // Χέρι που κρέμεται (αριστερά), με νύχια.
    p.line(9, 13, 5, 20, 2, 'k');
    p.line(5, 20, 5 + sw, 27, 2, 'k');
    p.line(5 + sw, 27, 4 + sw, 30, 1, 'i'); p.line(5 + sw, 27, 6 + sw, 30, 1, 'i');
  });
}

// Ο Κέρβερος (3D): μαύρο τρικέφαλο σκυλί ξαπλωμένο, κοιτάζει δεξιά, με ουρά-φίδι και χρυσό κολάρο
// με καρφιά. barking[i] = το κεφάλι i (0 = μπροστινό/χαμηλό, 2 = πίσω/ψηλό) γαβγίζει: ανοιχτό στόμα
// με δόντια και κόκκινο μάτι· αλλιώς κοιμάται (κλειστό μάτι). breath = 0 / 1 (ανάσα στον ύπνο).
function cerberusGrid(barking, breath) {
  return paintGrid(50, 30, (p) => {
    // Ουρά-φίδι.
    p.line(8, 19, 4, 14, 2, 'g'); p.line(4, 14, 5, 8, 2, 'g'); p.line(5, 8, 2, 5, 2, 'g');
    p.ellipse(2, 4, 1.6, 1.3, 'G'); p.px(0, 4, 't');
    // Σώμα και πίσω πόδια.
    p.ellipse(19, 20, 13, 6 + breath * 0.6, 'k');
    p.line(9, 23, 12, 26, 1, 'K'); p.line(11, 25, 8, 29, 3, 'k'); p.line(17, 25, 16, 29, 3, 'k');
    p.line(9, 22, 28, 22, 1, 'K');
    // Μπροστινά πόδια απλωμένα μπροστά, με νύχια.
    p.line(27, 23, 39, 27, 3, 'k'); p.line(26, 25, 36, 29, 3, 'k');
    p.px(41, 27, 'i'); p.px(40, 28, 'i'); p.px(38, 29, 'i'); p.px(37, 29, 'i');
    // Τρία κεφάλια: [κέντρο x, y] από το μπροστινό (χαμηλό) στο πίσω (ψηλό).
    const heads = [[41, 18], [37, 11], [31, 5]];
    heads.forEach(([hx, hy], i) => p.line(26, 16, hx - 2, hy + 1, 4, 'k'));   // λαιμοί
    p.line(24, 12, 26, 19, 2, 'Y');                                          // κολάρο
    for (const [x, y] of [[24, 12], [25, 15], [26, 18]]) p.px(x - 1, y, 'y');
    heads.forEach(([hx, hy], i) => {
      const open = barking[i];
      p.ellipse(hx, hy, 4.2, 3.3, 'k');
      p.ellipse(hx + 4, hy + (open ? 0 : 1), 2.8, 1.8, 'k');                  // ρύγχος
      p.line(hx - 2, hy - 3, hx - 3, hy - 6, 2, 'K');                         // αυτί
      p.px(hx + 7, hy + (open ? 0 : 1), 'K');                                 // μύτη
      if (open) {
        p.line(hx + 2, hy + 2, hx + 7, hy + 2.5, 1, 'r');                     // στόμα
        p.line(hx + 2, hy + 3.5, hx + 6, hy + 4, 1, 'k');                     // κάτω σαγόνι
        p.px(hx + 3, hy + 2, 'i'); p.px(hx + 5, hy + 2, 'i'); p.px(hx + 4, hy + 3, 'i');   // δόντια
        p.px(hx + 1, hy - 1, 'r');                                            // μάτι
      } else {
        p.line(hx, hy - 0.5, hx + 1.5, hy - 0.5, 1, 'K');                     // κλειστό μάτι
      }
    });
  });
}

const Sprites = {
  frames: {},   // name → [{ c: canvas (δεξιά), f: canvas (αριστερά), w, h }]
  hdFrames: {}, // name → τα ίδια καρέ σε διπλή ανάλυση με σκίαση (για το 3D), hd = 2

  init() {
    // Ορφέας: κάθε καρέ σε 4 εκδοχές (0..3 χορδές στη λύρα).
    for (const anim in ORPHEUS_ANIMS) {
      for (let n = 0; n <= 3; n++) {
        this.frames[`orpheus_${anim}_${n}`] = ORPHEUS_ANIMS[anim].map(([up, legs, bob]) => {
          // Πρώτα τα πόδια (γραμμές 13-15), μετά από πάνω το πάνω μέρος, bob γραμμές πιο κάτω.
          const rows = [];
          for (let i = 0; i < 16; i++) rows.push([...(i >= 13 ? ORPHEUS_LEGS[legs][i - 13] : '.'.repeat(13))]);
          ORPHEUS_UPPER[up].forEach((r, i) => [...r].forEach((ch, x) => { if (ch !== '.') rows[i + bob][x] = ch; }));
          // Οι χορδές που δεν έχεις βρει ακόμα λείπουν από τη λύρα.
          const shown = rows.map((r) => r.join('').replace(/[123]/g, (d) => (Number(d) <= n ? d : '.')));
          return this.build(shown, '26,12,6');
        });
      }
    }
    this.frames.eurydice = ['A', 'C', 'B', 'C'].map((k) => this.build([...EURY_TOP, ...EURY_HEM[k]], '120,110,100'));
    this.frames.shade = ['A', 'B'].map((k) => this.build([...SHADE_TOP, ...SHADE_TAT[k]], POT.terra));
    const mirror = (r) => r + [...r].reverse().join('');
    this.frames.erinys = ['A', 'B'].map((k) => this.build(ERINYS_HALF[k].map(mirror), POT.terra));
    this.frames.soul = ['A', 'B'].map((k) => this.build([...SOUL_TOP, ...SOUL_TAIL[k]], '160,140,120'));
    this.frames.snake = ['coil', 'hiss'].map((k) => this.build([...SNAKE_TOP[k], ...SNAKE_BASE], '30,16,8'));
    this.frames.grass = [this.build(GRASS, null)];
    this.frames.hades = [this.build(HADES, POT.terra)];
    this.frames.hound = [this.build(HOUND, POT.terra)];
    this.frames.persephone = [this.build(PERSEPHONE, POT.terra), this.build(PERSEPHONE_LEAN, POT.terra)];
    this.frames.charon = [this.build(CHARON, '26,12,6'), this.build(CHARON_ASK, '26,12,6')];
    this.frames.boat = [this.build(BOAT, POT.terra)];
    this.frames.iconHear = [this.build(ICON_HEAR, null)];
    this.frames.iconSearch = [this.build(ICON_SEARCH, null)];
    // Διακοσμητικά (3D).
    const dk = '20,10,6';
    // Σταλαγμίτες / σταλακτίτες με κάθετες ραβδώσεις (σαν σταλαγματική πέτρα).
    const streak = (rows) => rows.map((r) => [...r].map((ch, x) => (ch === 'l' && x % 3 === 1 ? 'L' : ch)).join(''));
    this.frames.stalagmite = [this.build(streak(STALAGMITE), dk)];
    this.frames.stalactite = [this.build(streak([...STALAGMITE].reverse()), dk)];
    this.frames.rocks = [this.build(ROCKS, dk)];
    this.frames.skull = [this.build(SKULL, dk)];
    this.frames.bones = [this.build(BONES, dk)];
    this.frames.skullpile = [this.build(SKULLPILE, dk)];
    this.frames.amphora = [this.build(AMPHORA, dk)];
    this.frames.amphoraBroken = [this.build(AMPHORA_BROKEN, dk)];
    this.frames.asphodel = [this.build(ASPHODEL, null)];
    this.frames.reeds = [this.build(REEDS, null)];
    this.frames.chain = [this.build(CHAIN, null)];
    this.frames.roots = [this.build(ROOTS, null)];
    this.frames.statue = [this.build(STATUE, dk)];
    // Η λεπτομερής σκιά του 3D (με περίγραμμα πηλού, όπως η απλή).
    this.frames.ghoul = [0, 1].map((f) => this.build(ghoulGrid(f), POT.terra));
  },

  // Φτιάχνει τον καμβά ενός sprite. outline = χρώμα του περιγράμματος (1 pixel γύρω
  // από το σχήμα, μόνο οριζόντια / κάθετα), ή null για χωρίς περίγραμμα.
  build(rows, outline) {
    const h = rows.length, w = rows[0].length;
    for (const r of rows) if (r.length !== w) console.warn('sprite row width', r);
    const pad = outline ? 1 : 0;
    const W = w + pad * 2, H = h + pad * 2;
    const make = (flip) => {
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const c = cv.getContext('2d');
      const img = c.createImageData(W, H);
      const put = (x, y, rgb) => {
        const i = (y * W + (flip ? W - 1 - x : x)) * 4;
        const [r, g, b] = rgb.split(',').map(Number);
        img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
      };
      const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && rows[y][x] !== '.';
      for (let y = -pad; y < h + pad; y++) {
        for (let x = -pad; x < w + pad; x++) {
          if (solid(x, y)) {
            put(x + pad, y + pad, SPR_PAL[rows[y][x]]);
          } else if (outline && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) {
            put(x + pad, y + pad, outline);
          }
        }
      }
      c.putImageData(img, 0, 0);
      return cv;
    };
    return { c: make(false), f: make(true), w: W, h: H };
  },

  // Διπλή ανάλυση με σκίαση, για τα billboards του 3D: Scale2x (λείες διαγώνιες αντί για
  // "σκαλοπάτια") και μετά φως από πάνω-αριστερά / σκιά κάτω-δεξιά στη σειρά pixels μέσα από το
  // περίγραμμα — οι μορφές αποκτούν όγκο, σαν ζωγραφισμένες σε περισσότερους τόνους.
  getHD(name, i = 0) {
    let list = this.hdFrames[name];
    if (!list) {
      list = this.hdFrames[name] = this.frames[name].map((fr) => {
        const c = this.hdify(fr.c);
        const f = document.createElement('canvas');
        f.width = c.width;
        f.height = c.height;
        const fc = f.getContext('2d');
        fc.translate(c.width, 0);
        fc.scale(-1, 1);
        fc.drawImage(c, 0, 0);
        return { c, f, w: c.width, h: c.height, hd: 2 };
      });
    }
    return list[((i % list.length) + list.length) % list.length];
  },

  hdify(src) {
    const w = src.width, h = src.height, W = w * 2, H = h * 2;
    const s = new Uint32Array(src.getContext('2d').getImageData(0, 0, w, h).data.buffer);
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const oc = out.getContext('2d');
    const img = oc.createImageData(W, H);
    const d = new Uint32Array(img.data.buffer);
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : s[y * w + x]);
    // Scale2x (EPX).
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
        d[(2 * y) * W + 2 * x] = C === A && C !== D && A !== B ? A : P;
        d[(2 * y) * W + 2 * x + 1] = A === B && A !== C && B !== D ? B : P;
        d[(2 * y + 1) * W + 2 * x] = D === C && D !== B && C !== A ? C : P;
        d[(2 * y + 1) * W + 2 * x + 1] = B === D && B !== A && D !== C ? D : P;
      }
    }
    // Σκίαση: μόνο στα pixels ΜΕΣΑ από το περίγραμμα (όχι στο ίδιο το περίγραμμα).
    const alpha = (x, y) => x >= 0 && y >= 0 && x < W && y < H && (d[y * W + x] >>> 24) > 128;
    const edge = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!alpha(x, y)) continue;
        if (!alpha(x - 1, y) || !alpha(x + 1, y) || !alpha(x, y - 1) || !alpha(x, y + 1)) edge[y * W + x] = 1;
      }
    }
    const tone = (p, k) => {
      const r = Math.min(255, (p & 255) * k), g = Math.min(255, ((p >> 8) & 255) * k), b = Math.min(255, ((p >> 16) & 255) * k);
      return (p & 0xff000000) | (b << 16) | (g << 8) | r;
    };
    const res = d.slice();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!alpha(x, y) || edge[i]) continue;
        const up = edge[(y - 1) * W + x] || (x > 0 && edge[i - 1]);
        const dn = (y + 1 < H && edge[(y + 1) * W + x]) || (x + 1 < W && edge[i + 1]);
        if (up && !dn) res[i] = tone(d[i], 1.22);
        else if (dn && !up) res[i] = tone(d[i], 0.74);
      }
    }
    d.set(res);
    oc.putImageData(img, 0, 0);
    return out;
  },

  // Ο Κέρβερος σε διπλή ανάλυση, για κάθε συνδυασμό κεφαλιών που γαβγίζουν (και ανάσας).
  cerberusHD(barking, breath) {
    const key = barking.map(Number).join('') + breath;
    this._cerb = this._cerb || {};
    if (!this._cerb[key]) {
      const fr = this.build(cerberusGrid(barking, breath), POT.terra);
      const c = this.hdify(fr.c);
      this._cerb[key] = { c, f: c, w: c.width, h: c.height, hd: 2 };
    }
    return this._cerb[key];
  },

  get(name, i = 0) {
    const list = this.frames[name];
    return list[((i % list.length) + list.length) % list.length];
  },

  // Από συντεταγμένες κόσμου σε art pixels του καμβά (με τον τωρινό μετασχηματισμό του ctx).
  toArt(ctx, x, y) {
    const t = ctx.getTransform();
    return { x: t.a * x + t.c * y + t.e, y: t.b * x + t.d * y + t.f };
  },

  // Ζωγραφίζει το sprite με το κάτω-κέντρο του στο (ax, ay) σε art pixels,
  // κουμπωμένο σε ακέραια pixels. opts: { flip, alpha, scale (ακέραιος), center }
  // center = το (ax, ay) είναι το κέντρο του sprite αντί για το κάτω μέρος.
  blit(ctx, name, i, ax, ay, opts = {}) {
    const s = this.get(name, i);
    const k = opts.scale || 1;
    const w = s.w * k, h = s.h * k;
    const sx = Math.round(ax - w / 2);
    const sy = Math.round(ay - (opts.center ? h / 2 : h));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (opts.alpha !== undefined) ctx.globalAlpha *= Math.max(0, Math.min(1, opts.alpha));
    ctx.drawImage(opts.flip ? s.f : s.c, sx, sy, w, h);
    ctx.restore();
    return { x: sx, y: sy, w, h };
  },

  // Όπως το blit, αλλά σε συντεταγμένες κόσμου.
  draw(ctx, name, i, x, y, opts = {}) {
    const p = this.toArt(ctx, x, y);
    return this.blit(ctx, name, i, p.x, p.y, opts);
  },
};
