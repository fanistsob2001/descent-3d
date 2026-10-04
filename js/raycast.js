'use strict';

// Ο raycaster πρώτου προσώπου (σαν το Wolfenstein 3D): για κάθε στήλη του μικρού καμβά
// του Pixel ρίχνουμε μια ακτίνα στο πλέγμα του Level, βρίσκουμε τον πρώτο αδιαφανή τοίχο
// και ζωγραφίζουμε μια κάθετη λωρίδα με ύψος ανάλογο της απόστασης. Το δάπεδο και το
// ταβάνι ζωγραφίζονται γραμμή-γραμμή (floor casting).
//
// Τίποτα δεν έχει δικό του φως: όλα είναι μαύρα, εκτός από ό,τι έχει φωτίσει ήχος.
// Οι τοίχοι παίρνουν το φως από τα κομμάτια τοίχων του Echoes (litTime / litStrength,
// ένα κομμάτι ανά 5 μονάδες), το δάπεδο από τα κελιά (cellTime / cellStr), και το
// μέτωπο κάθε κύματος φαίνεται σαν φωτεινό δαχτυλίδι που απλώνει στο δάπεδο.
//
// Γράφουμε κατευθείαν στα pixels (ImageData, Uint32) και μετά το Pixel κάνει την
// κβάντιση/dithering και τη μεγέθυνση όπως πριν.

const RC_FOV = 66 * Math.PI / 180;   // οριζόντιο οπτικό πεδίο σε οριζόντια οθόνη (κινητό)
const RC_FOV_PC = 80 * Math.PI / 180;   // στο PC: πιο ανοιχτό, όπως στα FPS του υπολογιστή
const RC_EYE = 0.5;                  // ύψος των ματιών σε κελιά (οι τοίχοι έχουν ύψος 1 κελί)
const RC_MAX = 26;                   // ως πόσα κελιά μακριά ψάχνει τοίχο μια ακτίνα
const RC_TEX = 40;                   // texels ανά πλευρά υφής δαπέδου/ταβανιού (1 texel = 1 μονάδα κόσμου)
const RC_WTEX = 64;                  // texels ανά πλευρά υφής τοίχου (πιο λεπτομερείς)
const RC_RING = 10;                  // πάχος του μετώπου του κύματος (μονάδες κόσμου)
const RC_FOG = 900;                  // σε τόσες μονάδες το φως έχει πέσει στο ελάχιστο
const RC_CEIL = 0.45;                // το ταβάνι φωτίζεται λιγότερο από το δάπεδο
const RC_ALTAR_R = 3.4;              // ως πόσα κελιά φτάνει το φως ενός αναμμένου βωμού
const RC_SPX = 1.9;                  // μονάδες κόσμου ανά pixel ενός sprite (η σκιά = 16 px ≈ 30 μονάδες)
const RC_DAY = [255, 236, 190];      // το φως της ημέρας στην έξοδο

// Ποια υφή τοίχου έχει κάθε κεφάλαιο: σπηλιά, λαξευμένη πέτρα, παλάτι (με μαίανδρο).
const RC_THEMES = ['rock', 'rock', 'rock', 'blocks', 'rock', 'blocks', 'palace', 'rock'];

// Ένα μοτίβο μαιάνδρου 6×6 (σε texels) — μαύρο πάνω σε πηλό, όπως στα μελανόμορφα αγγεία.
const RC_MEANDER = [
  '#####.',
  '....#.',
  '###.#.',
  '#.#.#.',
  '#...#.',
  '#####.',
];

const Raycast = {
  W: 0, H: 0,
  img: null, buf: null,
  zbuf: null,         // απόσταση (σε κελιά, κάθετη στο επίπεδο της κάμερας) του τοίχου ανά στήλη
  wallTop: null,      // πού αρχίζει / τελειώνει ο τοίχος σε κάθε στήλη (y σε art pixels)
  wallBot: null,
  fov: RC_FOV,        // οριζόντιο οπτικό πεδίο (το main βάζει RC_FOV_PC στο PC)
  focal: 0,           // art pixels ανά μονάδα (σε απόσταση 1 κελιού = 1 κελί)
  horizon: 0,
  // Η κάμερα του τελευταίου καρέ (για τα sprites): θέση σε κελιά, κατεύθυνση, επίπεδο.
  posX: 0, posY: 0, dirX: 1, dirY: 0, planeX: 0, planeY: 0,

  segBase: null,      // Int32Array: για κάθε (κελί, πλευρά) το πρώτο κομμάτι τοίχου του Level
  segPer: 8,
  cellLight: null,    // Float32Array: φως κάθε κελιού δαπέδου αυτό το καρέ
  tex: {},            // υφές δαπέδου/ταβανιού: Uint8Array RGB (RC_TEX × RC_TEX × 3), σε "πλήρες φως"
  walls: {},          // υφές τοίχων ανά θέμα: [Uint8Array RGB (RC_WTEX × RC_WTEX × 3), ...] (παραλλαγές)
  gateAt: null,       // Int16Array: ποια πύλη (βάρκα του Χάροντα) είναι σε κάθε κελί, -1 = καμία
  altarCells: [],     // ανά βωμό: [κελί, ένταση, ...] — όσα φωτίζει η φλόγα του (με οπτική επαφή)
  altarSegs: [],      // ανά βωμό: [κομμάτι τοίχου, ένταση, ...]
  segExtra: null,     // Float32Array: φως από βωμούς σε κάθε κομμάτι τοίχου, αυτό το καρέ
  _segTouched: [],
  exitKey: -1,        // (κελί*4 + πλευρά) του τοίχου πίσω από την έξοδο: εκεί φαίνεται το φως της ημέρας
  exitCells: [],      // τα κελιά μπροστά στην έξοδο που φωτίζει το φως της ημέρας: [κελί, ένταση, ...]
  exitA: 0,           // πόσο φαίνεται τώρα η έξοδος (το βάζει το main πριν το render)
  sprites: [],        // τα billboards αυτού του καρέ (sprite → flushSprites)
  // Ποιότητα: 'auto' | 'high' | 'low'. Στο 'low' (ή στο 'auto' αν το render αργεί, π.χ. σε
  // αδύναμο κινητό) το δάπεδο/ταβάνι ζωγραφίζεται με μισή οριζόντια ανάλυση (ο ακριβότερος βρόχος).
  quality: 'auto',
  slowMs: 7,          // πάνω από τόσα ms ανά render → χαμηλή ποιότητα (το main βάζει 10 στο PC)
  coarse: false,
  _avg: 0,
  _frames: 0,

  // Μία φορά, αφού φορτωθεί ο κόσμος.
  init() {
    const L = Level;
    this.segPer = Math.round(TILE / WALL_SAMPLE_STEP);
    const len = TILE / this.segPer;
    // Κάθε κομμάτι τοίχου ανήκει σε μία πλευρά ενός αδιαφανούς κελιού:
    // 0 = πάνω (βλέπει προς -y), 1 = κάτω, 2 = αριστερά (-x), 3 = δεξιά.
    // Τα κομμάτια μιας πλευράς είναι συνεχόμενα (Level.buildSegments).
    this.segBase = new Int32Array(L.cols * L.rows * 4).fill(-1);
    for (let i = 0; i < L.segCount; i++) {
      const x1 = L.segX1[i], y1 = L.segY1[i];
      let tx, ty, side, off;
      if (y1 === L.segY2[i]) {
        tx = Math.floor(Math.min(x1, L.segX2[i]) / TILE);
        if (L.testY[i] < y1) { ty = Math.round(y1 / TILE); side = 0; }
        else { ty = Math.round(y1 / TILE) - 1; side = 1; }
        off = Math.min(x1, L.segX2[i]) - tx * TILE;
      } else {
        ty = Math.floor(Math.min(y1, L.segY2[i]) / TILE);
        if (L.testX[i] < x1) { tx = Math.round(x1 / TILE); side = 2; }
        else { tx = Math.round(x1 / TILE) - 1; side = 3; }
        off = Math.min(y1, L.segY2[i]) - ty * TILE;
      }
      const k = Math.round(off / len);
      if (k === 0) this.segBase[(ty * L.cols + tx) * 4 + side] = i;
    }
    this.cellLight = new Float32Array(L.cols * L.rows);
    this.segExtra = new Float32Array(L.segCount);

    // Οι πύλες (η βάρκα του Χάροντα) δεν ζωγραφίζονται ως τοίχος: εκεί είναι νερό και η βάρκα.
    this.gateAt = new Int16Array(L.cols * L.rows).fill(-1);
    L.gates.forEach((g, i) => { this.gateAt[g.ty * L.cols + g.tx] = i; });

    // Το φως κάθε βωμού: κελιά και κομμάτια τοίχων σε ακτίνα RC_ALTAR_R, με οπτική επαφή.
    const R = RC_ALTAR_R * TILE;
    this.altarCells = L.altars.map((a) => {
      const out = [];
      const r = Math.ceil(RC_ALTAR_R);
      for (let ty = Math.floor(a.y / TILE) - r; ty <= Math.floor(a.y / TILE) + r; ty++) {
        for (let tx = Math.floor(a.x / TILE) - r; tx <= Math.floor(a.x / TILE) + r; tx++) {
          if (L.isOpaque(tx, ty)) continue;
          const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
          const d = Math.hypot(cx - a.x, cy - a.y);
          if (d > R || !L.lineOfSight(a.x, a.y, cx, cy)) continue;
          out.push(ty * L.cols + tx, Math.pow(1 - d / R, 1.3));
        }
      }
      return out;
    });
    this.altarSegs = L.altars.map((a) => {
      const out = [];
      for (let i = 0; i < L.segCount; i++) {
        const d = Math.hypot(L.testX[i] - a.x, L.testY[i] - a.y);
        if (d > R || !L.lineOfSight(a.x, a.y, L.testX[i], L.testY[i])) continue;
        out.push(i, Math.pow(1 - d / R, 1.3));
      }
      return out;
    });

    // Η έξοδος: ο τοίχος απέναντι από τον διάδρομο γίνεται "άνοιγμα" με φως της ημέρας,
    // και το φως χύνεται στα κελιά μπροστά του.
    const ex = L.exit;
    const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => !L.isWall(ex.tx + dx, ex.ty + dy));
    if (open) {
      const [ix, iy] = open;                        // προς τον διάδρομο
      const wx = ex.tx - ix, wy = ex.ty - iy;        // ο τοίχος πίσω από την έξοδο
      const side = ix === 1 ? 3 : ix === -1 ? 2 : iy === 1 ? 1 : 0;
      this.exitKey = (wy * L.cols + wx) * 4 + side;
      this.exitDir = [ix, iy];
      this.exitCells = [];
      for (let k = 0; k < 4; k++) {
        const tx = ex.tx + ix * k, ty = ex.ty + iy * k;
        if (L.isOpaque(tx, ty)) break;
        this.exitCells.push(ty * L.cols + tx, 1 - k / 4);
      }
    }
  },

  // ---- Υφές (φτιάχνονται μία φορά, σε pixel art· μετά το Sprites.init, γιατί οι ζωφόροι
  // των τοίχων φτιάχνονται από τα sprites) ----
  buildTextures() {
    const N = RC_TEX;
    const hash = (a, b, s) => {
      const v = Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453;
      return v - Math.floor(v);
    };
    const make = (fn) => {
      const t = new Uint8Array(N * N * 3);
      for (let v = 0; v < N; v++) {
        for (let u = 0; u < N; u++) {
          const [r, g, b] = fn(u, v);
          const i = (v * N + u) * 3;
          t[i] = r; t[i + 1] = g; t[i + 2] = b;
        }
      }
      return t;
    };
    const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
    const LIGHT = [236, 156, 98], TERRA = [206, 108, 56], DEEP = [112, 54, 30];

    // ---- Τοίχοι: υφές RC_WTEX × RC_WTEX, σε παραλλαγές ανά θέμα (this.walls[θέμα] = [υφές]) ----
    const WN = RC_WTEX;
    const makeW = (fn) => {
      const t = new Uint8Array(WN * WN * 3);
      for (let v = 0; v < WN; v++) {
        for (let u = 0; u < WN; u++) {
          const [r, g, b] = fn(u, v);
          const i = (v * WN + u) * 3;
          t[i] = r; t[i + 1] = g; t[i + 2] = b;
        }
      }
      return t;
    };

    // Λαξευμένοι λίθοι: σειρές των 16 texels, λίθοι των 32, μετατοπισμένοι ανά σειρά.
    // Οι αρμοί είναι η "φωτεινή ακμή" που λάμπει όταν τους βρει ήχος· ανάγλυφο στις άκρες.
    const block = (u, v, s) => {
      const row = Math.floor(v / 16);
      const bu = (u + (row % 2) * 16) % 32, bv = v % 16;
      if (bu === 0 || bv === 0) return mul(LIGHT, 0.9);
      const id = Math.floor((u + (row % 2) * 16) / 32) + row * 7;
      let k = 0.66 + hash(id, s, 1) * 0.3 + (hash(u, v, s) - 0.5) * 0.14;
      if (bv === 1 || bu === 1) k *= 1.32;           // φωτεινή πάνω/αριστερή ακμή (ανάγλυφο)
      if (bv >= 14 || bu >= 30) k *= 0.62;            // σκιά στην κάτω/δεξιά ακμή
      if (hash(u >> 1, v >> 1, s + 40) > 0.97) k *= 0.55;   // μικρές φθορές
      return mul(DEEP, k);
    };

    // Σπηλιά: ακανόνιστοι βράχοι (Voronoi που επαναλαμβάνεται χωρίς ραφές), με λεπτές φωτεινές
    // ρωγμές και "φουσκωμένες" πέτρες (φωτεινές στη μέση, σκοτεινές δίπλα στη ρωγμή).
    const rock = (seedBase) => {
      const seeds = [];
      for (let k = 0; k < 7; k++) seeds.push([hash(k, 1, seedBase) * WN, hash(k, 2, seedBase + 1) * WN]);
      return makeW((u, v) => {
        let d1 = 1e9, d2 = 1e9, id = 0;
        for (let k = 0; k < seeds.length; k++) {
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              const dx = u + 0.5 - (seeds[k][0] + ox * WN), dy = v + 0.5 - (seeds[k][1] + oy * WN);
              const d = Math.sqrt(dx * dx + dy * dy);
              if (d < d1) { d2 = d1; d1 = d; id = k; } else if (d < d2) d2 = d;
            }
          }
        }
        const edge = d2 - d1;
        if (edge < 0.9) return mul(LIGHT, 0.7);
        const bulge = Math.min(1, edge / 13);
        let k = 0.26 + bulge * 0.5 + hash(id, 4, seedBase) * 0.18 + (hash(u, v, 7) - 0.5) * 0.14;
        if (edge < 2.2) k *= 0.5;
        // Το φως "πέφτει" λίγο από πάνω: η πάνω μεριά κάθε πέτρας φωτεινότερη.
        const up = seeds[id][1] - (v + 0.5);
        k *= 1 + Math.max(-0.15, Math.min(0.15, up / 40));
        return mul(DEEP, k);
      });
    };

    // Μελανόμορφη ζωφόρος: οι μορφές των sprites ως μαύρες σιλουέτες πάνω σε πηλό, με
    // "χαραγμένες" λεπτομέρειες στο χρώμα του πηλού — όπως στα αγγεία. Το "πρόσθετο λευκό" μόνο
    // για γυναίκες και φαντάσματα (white = true: ό,τι είναι ανοιχτόχρωμο) και για τα μάτια των σκιών.
    // figs = [[όνομα, καρέ, καθρέφτισμα, white], ...].
    const BLACK = [16, 10, 7], CREAM = [236, 216, 182];
    const stamp = (t, figs, bandTop, bandBot) => {
      const n = figs.length;
      figs.forEach(([name, frame, flip, white], i) => {
        if (!Sprites.frames[name]) return;
        const fr = Sprites.get(name, frame);
        if (fr.h > bandBot - bandTop) return;
        const data = (flip ? fr.f : fr.c).getContext('2d').getImageData(0, 0, fr.w, fr.h).data;
        const x0 = Math.round(((i + 0.5) * WN) / n - fr.w / 2), y0 = bandBot - fr.h;
        for (let y = 0; y < fr.h; y++) {
          for (let x = 0; x < fr.w; x++) {
            const p = (y * fr.w + x) * 4;
            if (data[p + 3] < 128) continue;
            const r = data[p], g = data[p + 1], b = data[p + 2];
            const lum = 0.3 * r + 0.59 * g + 0.11 * b;
            let c = BLACK;
            if (white ? lum > 185 : lum > 245) c = CREAM;     // πρόσθετο λευκό (ή μάτια που λάμπουν)
            else if (r === 40 && g === 20 && b === 12) c = TERRA;   // χαραγμένη λεπτομέρεια
            const u = ((x0 + x) % WN + WN) % WN, i3 = ((y0 + y) * WN + u) * 3;
            t[i3] = c[0]; t[i3 + 1] = c[1]; t[i3 + 2] = c[2];
          }
        }
      });
      return t;
    };
    const clay = (u, v) => mul(TERRA, 0.84 + hash(u, v, 9) * 0.1);
    const meander = (u, v) => (RC_MEANDER[v][u % 6] === '#' ? BLACK : clay(u, v));

    // Παλάτι (VII): ζωφόρος μαιάνδρου, από κάτω μελανόμορφη σκηνή, και λίθοι στη βάση.
    const palace = (figs) => stamp(makeW((u, v) => {
      if (v === 0 || v === 11 || v === 38 || v === 40) return BLACK;
      if (v <= 2 || v === 9 || v === 10 || v === 39) return clay(u, v);
      if (v <= 8) return meander(u, v - 3);
      if (v <= 37) return clay(u, v);
      return block(u, v - 41 + 64, 5);
    }), figs, 13, 37);
    // Λαξευμένη πέτρα (IV, VI): λίθοι, και σε μερικές πλευρές μια στενή ζωφόρος με μορφές.
    const frieze = (figs) => stamp(makeW((u, v) => {
      if (v === 0 || v === 21) return BLACK;
      if (v === 1 || v === 20) return clay(u, v);
      if (v <= 19) return clay(u, v);
      return block(u, v, 3);
    }), figs, 2, 20);

    this.walls = {
      rock: [rock(2), rock(11), rock(23)],
      blocks: [makeW((u, v) => block(u, v, 3)), makeW((u, v) => block(u, v, 8)), makeW((u, v) => block(u, v, 13)),
        frieze([['soul', 0, false, true], ['soul', 1, false, true], ['soul', 0, false, true]]),
        frieze([['shade', 0, false], ['shade', 1, false], ['erinys', 0, false]])],
      palace: [
        palace([['orpheus_play_3', 0, false], ['hades', 0, false], ['persephone', 1, false, true]]),
        palace([['shade', 0, false], ['shade', 1, false], ['erinys', 1, false]]),
        palace([['soul', 0, true, true], ['orpheus_walk_3', 1, true], ['eurydice', 0, true, true]]),
        palace([['charon', 1, false], ['soul', 1, false, true], ['hound', 0, true]]),
      ],
    };

    // Δάπεδο: 2×2 πήλινα πλακάκια ανά κελί, με φωτεινούς αρμούς· 4 παραλλαγές (μία με ρωγμή).
    this.tex.floor = [0, 1, 2, 3].map((s) => make((u, v) => {
      const tu = u % 20, tv = v % 20;
      if (tu === 0 || tv === 0) return mul(TERRA, 0.7);
      const id = Math.floor(u / 20) + Math.floor(v / 20) * 2;
      let k = 0.55 + hash(id, s, 11) * 0.3 + (hash(u, v, s + 20) - 0.5) * 0.12;
      if (tu === 1 || tv === 1) k *= 1.25;
      // Ρωγμή σε ένα πλακάκι της παραλλαγής 3.
      if (s === 3 && id === 1 && Math.abs((tu - 3) * 0.8 - (tv - 4)) < 0.7 && tu > 2 && tu < 17) k = 0.12;
      return mul([92, 46, 26], k);
    }));

    // Ταβάνι: μεγάλες, σκούρες πλάκες βράχου.
    this.tex.ceil = make((u, v) => {
      if (u === 0 || v === 0 || (v === 20 && u < 26)) return mul(TERRA, 0.45);
      return mul([70, 34, 20], 0.6 + hash(Math.floor(u / 13), Math.floor(v / 9), 30) * 0.4);
    });
  },

  resize(W, H) {
    // Π.χ. σε iframe που δεν έχει πάρει ακόμα μέγεθος: τουλάχιστον 1×1.
    W = Math.max(1, W | 0);
    H = Math.max(1, H | 0);
    this.W = W;
    this.H = H;
    this.img = Pixel.ctx.createImageData(W, H);
    this.buf = new Uint32Array(this.img.data.buffer);
    this.zbuf = new Float32Array(W);
    this.wallTop = new Float32Array(W);
    this.wallBot = new Float32Array(W);
    // Σε οριζόντια οθόνη: οπτικό πεδίο RC_FOV. Σε κατακόρυφη το ίδιο θα έδειχνε πολύ μικρούς
    // τοίχους, οπότε κρατάμε λίγο μεγαλύτερη μεγέθυνση (λίγο στενότερο πεδίο).
    this.focal = Math.max((W / 2) / Math.tan(this.fov / 2), H * 0.4);
  },

  // Μετά από κάθε render (ms): μέσος όρος, και στο 'auto' γυρίζει σε χαμηλή ποιότητα αν
  // ξεπεράσει τα slowMs (μένει χαμηλή — αλλιώς θα "αναβόσβηνε" η ανάλυση).
  measure(ms) {
    this._frames++;
    this._avg += (ms - this._avg) * 0.05;
    if (this.quality === 'auto') {
      if (this._frames > 90 && this._avg > this.slowMs) this.coarse = true;
    } else {
      this.coarse = this.quality === 'low';
    }
  },

  // Το φως ενός κομματιού τοίχου τώρα (ίδιος τύπος με το παλιό Echoes.draw).
  segLight(i, now) {
    const age = now - Echoes.litTime[i];
    const fade = Level.segFade[i];
    if (age >= fade) return 0;
    const f = 1 - age / fade;
    return Echoes.litStrength[i] * f * Math.sqrt(f);
  },

  // Το φωτεινό μέτωπο των κυμάτων σε ένα σημείο του κόσμου (x, y σε μονάδες).
  // floor = true: και η απαλή λάμψη πίσω από το μέτωπο (μέσα στην ορατότητα του ήχου).
  // cell >= 0: σημείο του δαπέδου σε αυτό το κελί (η ορατότητα ελέγχεται ανά κελί, από τη
  // λίστα κελιών του κύματος — γρήγορο)· cell < 0: σημείο πάνω σε τοίχο (έλεγχος με τις ακτίνες).
  // Επιστρέφει το απαλό φως πίσω από το μέτωπο (πολλαπλασιάζει την υφή)· τη λάμψη του ίδιου
  // του μετώπου (πορτοκαλί που προστίθεται, φαίνεται ακόμα και πάνω σε σκούρα πέτρα) τη γράφει
  // στο this.glow.
  ringAt(x, y, floor, cell) {
    let sum = 0, glow = 0;
    this.glow = 0;
    const waves = Echoes.waves;
    for (let i = 0; i < waves.length; i++) {
      const w = waves[i];
      const dx = x - w.x, dy = y - w.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > w.r * w.r) continue;
      const d = Math.sqrt(d2);
      const t = (w.r - d) / RC_RING;
      const front = t < 3 ? Math.exp(-t * t) * w._amp : 0;
      const a = (front + (floor ? 0.1 : 0)) * w._amp;
      if (a < 0.01 && front < 0.01) continue;
      // Μόνο όπου ο ήχος έφτασε χωρίς τοίχο στη μέση.
      if (cell >= 0) {
        if (w._vis[cell] !== 1) continue;
      } else {
        const n = w.rays.length;
        let k = Math.round((Math.atan2(dy, dx) / (Math.PI * 2)) * n);
        if (k < 0) k += n;
        if (w.rays[k % n] < d - 6) continue;
      }
      sum += a;
      glow += front;
    }
    this.glow = glow;
    return sum;
  },

  // Μία φορά ανά καρέ: η ένταση κάθε κύματος, και (μία φορά ανά κύμα) ποια κελιά "βλέπει".
  prepareWaves() {
    for (const w of Echoes.waves) {
      const life = 1 - w.r / w.radius;
      w._amp = w.strength * life * life * (w.kind === 'step' ? 0.35 : 1);
      if (!w._vis) {
        w._vis = new Uint8Array(Level.cols * Level.rows);
        for (const h of w.cells) w._vis[h.c] = 1;
      }
    }
  },

  // Ζωγραφίζει τον κόσμο από τα μάτια του παίκτη. angle = προς τα πού κοιτάει (ακτίνια),
  // bob = μετατόπιση του ορίζοντα (βηματισμός), σε art pixels.
  render(pc, px, py, angle, now, bob) {
    const L = Level, W = this.W, H = this.H, buf = this.buf;
    const cols = L.cols, rows = L.rows;
    buf.fill(0xff000000);

    const posX = px / TILE, posY = py / TILE;
    const dirX = Math.cos(angle), dirY = Math.sin(angle);
    const plane = (W / 2) / this.focal;
    const planeX = -dirY * plane, planeY = dirX * plane;
    const hz = H * 0.5 + bob;
    Object.assign(this, { posX, posY, dirX, dirY, planeX, planeY, horizon: hz });

    // Το φως κάθε κελιού δαπέδου αυτό το καρέ.
    const cl = this.cellLight;
    for (let c = 0; c < cl.length; c++) {
      const age = now - Echoes.cellTime[c];
      const fade = L.regionFade[L.region[c]] || 1.5;
      if (age >= fade) { cl[c] = 0; continue; }
      const f = 1 - age / fade;
      cl[c] = Echoes.cellStr[c] * f * Math.sqrt(f);
    }

    // Οι αναμμένοι βωμοί: μόνιμο φως που τρεμοπαίζει (κελιά και κομμάτια τοίχων γύρω τους).
    const se = this.segExtra;
    for (const i of this._segTouched) se[i] = 0;
    this._segTouched.length = 0;
    Altars.list.forEach((a, n) => {
      if (!a.lit) return;
      const f = (0.82 + 0.1 * Math.sin(now * 13 + a.x) + 0.08 * Math.sin(now * 5.3 + a.y * 0.3)) *
        (0.62 + 0.5 * Math.max(0, 1 - (now - a.litAt) / 1.4));
      const cs = this.altarCells[n], ss = this.altarSegs[n];
      for (let k = 0; k < cs.length; k += 2) cl[cs[k]] = Math.max(cl[cs[k]], cs[k + 1] * f);
      for (let k = 0; k < ss.length; k += 2) {
        if (se[ss[k]] === 0) this._segTouched.push(ss[k]);
        se[ss[k]] = Math.max(se[ss[k]], ss[k + 1] * f);
      }
    });
    // Το φως της ημέρας μπροστά στην έξοδο.
    const exA = this.exitA;
    if (exA > 0.01) {
      const ec = this.exitCells;
      for (let k = 0; k < ec.length; k += 2) cl[ec[k]] = Math.max(cl[ec[k]], ec[k + 1] * exA);
    }

    const hasWaves = Echoes.waves.length > 0;
    if (hasWaves) this.prepareWaves();
    const gateAt = this.gateAt;
    const per = this.segPer;

    // ---- Τοίχοι ----
    for (let x = 0; x < W; x++) {
      const cam = (2 * (x + 0.5)) / W - 1;
      const rdx = dirX + planeX * cam, rdy = dirY + planeY * cam;
      let tx = Math.floor(posX), ty = Math.floor(posY);
      const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
      const sx = rdx < 0 ? -1 : 1, sy = rdy < 0 ? -1 : 1;
      let sdx = (rdx < 0 ? posX - tx : tx + 1 - posX) * ddx;
      let sdy = (rdy < 0 ? posY - ty : ty + 1 - posY) * ddy;
      let hit = false, xSide = false, dist = 0;
      while (dist < RC_MAX) {
        if (sdx < sdy) { dist = sdx; sdx += ddx; tx += sx; xSide = true; }
        else { dist = sdy; sdy += ddy; ty += sy; xSide = false; }
        // Έξω από τον χάρτη = τοίχος (π.χ. πίσω από την έξοδο, που είναι στην τελευταία γραμμή).
        if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) { hit = true; break; }
        const ci = ty * cols + tx;
        if (L.opaque[ci] === 1 && gateAt[ci] < 0) { hit = true; break; }
      }
      if (!hit) {
        this.zbuf[x] = Infinity;
        this.wallTop[x] = this.wallBot[x] = hz;
        continue;
      }
      this.zbuf[x] = dist;
      const lineH = this.focal / dist;
      const top = hz - lineH * (1 - RC_EYE), bot = hz + lineH * RC_EYE;
      this.wallTop[x] = top;
      this.wallBot[x] = bot;

      // Πού ακριβώς χτύπησε (0..1 κατά μήκος της πλευράς) και ποια πλευρά.
      let frac, side;
      if (xSide) { frac = posY + dist * rdy; side = sx > 0 ? 2 : 3; }
      else { frac = posX + dist * rdx; side = sy > 0 ? 0 : 1; }
      frac -= Math.floor(frac);
      const inside = tx >= 0 && ty >= 0 && tx < cols && ty < rows;
      const base = inside ? this.segBase[(ty * cols + tx) * 4 + side] : -1;
      const seg = base >= 0 ? base + Math.min(per - 1, Math.floor(frac * per)) : -1;
      let light = seg >= 0 ? this.segLight(seg, now) + se[seg] : 0;
      let glow = 0;
      if (exA > 0.01 && (ty * cols + tx) * 4 + side === this.exitKey) {
        this.drawDaylight(x, top, bot, frac, exA, now);
        continue;
      }
      if (hasWaves) {
        const hx = (posX + dist * rdx) * TILE, hy = (posY + dist * rdy) * TILE;
        light += this.ringAt(hx, hy, false, -1) * 0.8;
        glow = this.glow;
      }
      const wfog = Math.max(0.3, 1 - (dist * TILE) / RC_FOG);
      light *= wfog;
      glow *= wfog;
      if (light < 0.01 && glow < 0.01) continue;
      if (light > 1.4) light = 1.4;
      const gr = glow * 210, gg = glow * 110, gb = glow * 56;

      // Σκίαση πλευρών (όπως στα κλασικά raycasters): οι πλευρές προς ανατολή/δύση λίγο πιο
      // σκοτεινές από αυτές προς βορρά/νότο — δίνει όγκο στις γωνίες.
      const shade = xSide ? 0.8 : 1;

      // Η υφή: παραλλαγή ανά πλευρά τοίχου (σταθερή), και δεν καθρεφτίζεται ανάλογα με την πλευρά.
      const N = RC_WTEX;
      let u = Math.floor(frac * N);
      if (side === 3 || side === 0) u = N - 1 - u;
      const variants = this.walls[(inside && RC_THEMES[L.region[ty * cols + tx]]) || this.regionThemeNear(tx, ty)] || this.walls.rock;
      const tex = variants[(((tx * 73856093) ^ (ty * 19349663) ^ (side * 83492791)) >>> 0) % variants.length];

      // Φωτεινές ακμές (όπως στα παιχνίδια ηχοεντοπισμού): η κορυφή και η βάση κάθε τοίχου, και
      // οι κάθετες ακμές εκεί που ο τοίχος γυρίζει (εξωτερική ή εσωτερική γωνία).
      const fdx = side === 2 ? -1 : side === 3 ? 1 : 0, fdy = side === 0 ? -1 : side === 1 ? 1 : 0;
      const adx = fdy !== 0 ? 1 : 0, ady = fdx !== 0 ? 1 : 0;
      const cw = Math.max(0.02, 1.2 / lineH);
      let corner = false;
      if (frac < cw) corner = !(L.isOpaque(tx - adx, ty - ady) && !L.isOpaque(tx - adx + fdx, ty - ady + fdy));
      else if (frac > 1 - cw) corner = !(L.isOpaque(tx + adx, ty + ady) && !L.isOpaque(tx + adx + fdx, ty + ady + fdy));
      const edge = Math.min(1.6, (light + glow) * 1.5);
      const er = 236 * edge, eg = 156 * edge, eb = 98 * edge;

      const y0 = Math.max(0, Math.floor(top)), y1 = Math.min(H, Math.ceil(bot));
      const yTop = Math.floor(top), yBot = Math.ceil(bot) - 1;
      const span = bot - top;
      const vStep = N / span;
      let v = (y0 + 0.5 - top) * vStep;
      const lit = light * shade;
      for (let y = y0; y < y1; y++, v += vStep) {
        let r, g, b;
        if (corner || y === yTop || y === yBot) {
          r = er; g = eg; b = eb;
        } else {
          const ti = ((v < 0 ? 0 : v >= N ? N - 1 : v | 0) * N + u) * 3;
          // Σκιά στη βάση του τοίχου (εκεί που ακουμπάει το δάπεδο) και λίγο στην κορυφή.
          const vv = v / N;
          const ao = vv > 0.84 ? 1 - (vv - 0.84) * 3 : vv < 0.05 ? 0.8 : 1;
          const k = lit * ao;
          r = tex[ti] * k + gr; g = tex[ti + 1] * k + gg; b = tex[ti + 2] * k + gb;
        }
        if (r > 255) r = 255;
        if (g > 255) g = 255;
        if (b > 255) b = 255;
        buf[y * W + x] = 0xff000000 | (b << 16) | (g << 8) | r;
      }
    }

    // ---- Δάπεδο και ταβάνι (γραμμή-γραμμή) ----
    const fl = this.tex.floor, ceil = this.tex.ceil;
    const coarse = this.coarse;
    const ripple = now * 1.3;
    for (let y = 0; y < H; y++) {
      const below = y + 0.5 > hz;
      const p = below ? y + 0.5 - hz : hz - y - 0.5;
      if (p < 0.5) continue;
      const rd = (this.focal * (below ? RC_EYE : 1 - RC_EYE)) / p;   // σε κελιά
      const fog = Math.max(0.3, 1 - (rd * TILE) / RC_FOG) * (below ? 1 : RC_CEIL);
      const stX = (rd * 2 * planeX) / W, stY = (rd * 2 * planeY) / W;
      let wx = posX + rd * (dirX - planeX) + stX * 0.5;
      let wy = posY + rd * (dirY - planeY) + stY * 0.5;
      for (let x = 0; x < W; x++, wx += stX, wy += stY) {
        if (below ? y < this.wallBot[x] : y >= this.wallTop[x]) continue;
        // Χαμηλή ποιότητα: κάθε δεύτερο pixel αντιγράφει το διπλανό του.
        if (coarse && (x & 1)) { buf[y * W + x] = buf[y * W + x - 1]; continue; }
        const tx = Math.floor(wx), ty = Math.floor(wy);
        if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) continue;
        const c = ty * cols + tx;
        const t = !below ? T_FLOOR : gateAt[c] >= 0 && !L.gates[gateAt[c]].open ? T_WATER : L.terrain[c];
        if (t === T_CHASM) continue;   // χάσμα: μαύρο, χωρίς πάτο
        let light = cl[c], glow = 0;
        if (hasWaves) {
          light += this.ringAt(wx * TILE, wy * TILE, true, c);
          glow = this.glow * fog;
        }
        light *= fog;
        // Νερό: ο φωτισμένος τοίχος πίσω του καθρεφτίζεται (ανάποδα, κυματιστά), πιο αχνά όσο
        // πλησιάζει το νερό προς τον παίκτη — φαίνεται ακόμα κι όταν το ίδιο το νερό είναι σκοτεινό.
        let rr = 0, rg = 0, rb = 0;
        if (t === T_WATER) {
          const wb = this.wallBot[x];
          if (wb < H && y > wb) {
            const my = Math.round(2 * wb - y);
            if (my >= 0 && my >= this.wallTop[x]) {
              let mx = x + Math.round(Math.sin(wy * 14 + now * 2.2) * 1.2);
              mx = mx < 0 ? 0 : mx >= W ? W - 1 : mx;
              const px = buf[my * W + mx];
              const k = 0.45 * Math.max(0, 1 - (y - wb) / (wb - this.wallTop[x] + 1));
              if (k > 0.01 && (px & 0xffffff) !== 0) {
                rr = (px & 255) * k; rg = ((px >> 8) & 255) * k; rb = ((px >> 16) & 255) * k;
              }
            }
          }
        }
        if (light < 0.012 && glow < 0.01 && rr + rg + rb < 2) continue;
        if (light > 1.4) light = 1.4;
        const u = ((wx - tx) * RC_TEX) | 0, v = ((wy - ty) * RC_TEX) | 0;
        let r, g, b;
        if (!below) {
          const i = (v * RC_TEX + u) * 3;
          r = ceil[i]; g = ceil[i + 1]; b = ceil[i + 2];
        } else if (t === T_WATER) {
          // Σκούρο νερό με κυματάκια που κυλάνε αργά.
          const X = wx * TILE, Y = wy * TILE;
          const m = (Y + Math.sin(X * 0.12 + ripple + tx * 1.7) * 3) % 13;
          const line = Math.abs((m < 0 ? m + 13 : m) - 6.5) < 0.6;
          if (line) { r = 112; g = 58; b = 30; } else { r = 30; g = 18; b = 13; }
        } else {
          const tex = fl[(tx * 7 + ty * 13) & 3];
          const i = (v * RC_TEX + u) * 3;
          r = tex[i]; g = tex[i + 1]; b = tex[i + 2];
        }
        r = r * light + glow * 210 + rr; g = g * light + glow * 110 + rg; b = b * light + glow * 56 + rb;
        if (r > 255) r = 255;
        if (g > 255) g = 255;
        if (b > 255) b = 255;
        buf[y * W + x] = 0xff000000 | (b << 16) | (g << 8) | r;
      }
    }

    // Dithering του κόσμου εδώ, στον buffer (πιο γρήγορα από getImageData/putImageData μετά).
    Pixel.quantizeBuf(buf, W, H);
    pc.putImageData(this.img, 0, 0);
  },

  // Το άνοιγμα της εξόδου: φως της ημέρας σε μια στήλη του τοίχου, με πλαίσιο από πηλό
  // και ακτίνες που τρεμοπαίζουν. a = πόσο φαίνεται (0..1).
  drawDaylight(x, top, bot, frac, a, now) {
    const W = this.W, H = this.H, buf = this.buf;
    const y0 = Math.max(0, Math.floor(top)), y1 = Math.min(H, Math.ceil(bot));
    const edge = frac < 0.08 || frac > 0.92;
    const ray = 0.85 + 0.15 * Math.sin(frac * 23 + now * 1.7) * Math.sin(frac * 7 - now * 0.9);
    for (let y = y0; y < y1; y++) {
      const v = (y + 0.5 - top) / (bot - top);
      let r, g, b;
      if (edge || v < 0.06) {
        r = 206 * a; g = 108 * a; b = 56 * a;          // πλαίσιο από πηλό
      } else {
        const k = a * ray * (0.75 + 0.25 * v);
        r = RC_DAY[0] * k; g = RC_DAY[1] * k; b = RC_DAY[2] * k;
      }
      buf[y * W + x] = 0xff000000 | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0);
    }
  },

  // ---- Billboards: sprites που κοιτάνε πάντα την κάμερα ----
  // frame = { c, f, w, h } (καρέ του Sprites, ή δικός μας καμβάς) ή null (μόνο λάμψη).
  // o: { x, y } θέση (μονάδες) · h ύψος σε μονάδες (αλλιώς frame.h × RC_SPX × scale) · z πόσο πάνω
  //    από το δάπεδο · flip · alpha · add (προσθετικό φως, π.χ. φλόγα) · fog (false = χωρίς σβήσιμο
  //    με την απόσταση) · glow { r (μονάδες), color, a, cy (0 = κορυφή .. 1 = βάση) } ·
  //    bias (ζωγραφίζεται λίγο πιο μπροστά) · after(pc, box): για επιπλέον ζωγραφική (μάτια, εικονίδια) — box = { left, top, w, h, k, sx, depth }.
  sprite(frame, o) {
    const p = this.project(o.x, o.y);
    if (!p || p.depth > RC_MAX) return null;
    this.sprites.push({ frame, o, p });
    return p;
  },

  // Είναι ορατό (όχι πίσω από τοίχο) ένα σημείο σε απόσταση depth στη στήλη x;
  visible(x, depth) {
    const i = Math.round(x);
    return i >= 0 && i < this.W && this.zbuf[i] > depth;
  },

  flushSprites(pc) {
    const list = this.sprites;
    // Από τα πιο μακρινά στα πιο κοντινά (bias: για μορφές στην ίδια θέση, π.χ. ο Χάροντας μπροστά από τη βάρκα).
    list.sort((a, b) => (b.p.depth - (b.o.bias || 0)) - (a.p.depth - (a.o.bias || 0)));
    pc.save();
    pc.setTransform(1, 0, 0, 1, 0, 0);
    pc.imageSmoothingEnabled = false;
    for (const { frame, o, p } of list) {
      const k = this.focal / (p.depth * TILE);    // art px ανά μονάδα κόσμου
      const fog = o.fog === false ? 1 : Math.max(0.35, 1 - (p.depth * TILE) / RC_FOG);
      const alpha = Math.max(0, Math.min(1, (o.alpha === undefined ? 1 : o.alpha) * fog));
      if (alpha < 0.01) continue;
      const fh = frame ? frame.h : 1, fw = frame ? frame.w : 1;
      const h = (o.h || fh * RC_SPX * (o.scale || 1)) * k;
      const w = (h * fw) / fh;
      const bottom = this.horizon + (this.focal * (RC_EYE - (o.z || 0) / TILE)) / p.depth;
      const top = Math.round(bottom - h), left = Math.round(p.sx - w / 2);

      if (o.glow) {
        const g = o.glow;
        const cy = top + h * (g.cy === undefined ? 0.5 : g.cy);
        if (this.visible(p.sx, p.depth - 0.3)) {
          const R = Math.max(1, g.r * k);
          const gr = pc.createRadialGradient(p.sx, cy, 0, p.sx, cy, R);
          gr.addColorStop(0, 'rgba(' + g.color + ',' + (g.a * fog).toFixed(3) + ')');
          gr.addColorStop(1, 'rgba(' + g.color + ',0)');
          pc.globalAlpha = 1;
          pc.globalCompositeOperation = 'lighter';
          pc.fillStyle = gr;
          pc.fillRect(p.sx - R, cy - R, R * 2, R * 2);
        }
      }
      if (frame) {
        pc.globalAlpha = alpha;
        pc.globalCompositeOperation = o.add ? 'lighter' : 'source-over';
        const img = o.flip ? frame.f : frame.c;
        // Στήλη-στήλη: μόνο όπου δεν το κρύβει τοίχος (συνεχόμενα κομμάτια με ένα drawImage).
        const x0 = Math.max(0, left), x1 = Math.min(this.W, Math.ceil(left + w));
        let run = -1;
        for (let x = x0; x <= x1; x++) {
          const vis = x < x1 && this.zbuf[x] > p.depth;
          if (vis && run < 0) run = x;
          else if (!vis && run >= 0) {
            const sx0 = ((run - left) / w) * fw, sw = Math.min(fw - sx0, ((x - run) / w) * fw);
            if (sw > 0) pc.drawImage(img, sx0, 0, sw, fh, run, top, x - run, h);
            run = -1;
          }
        }
      }
      if (o.after) {
        pc.globalAlpha = 1;
        pc.globalCompositeOperation = 'source-over';
        o.after(pc, { left, top, w, h, k, sx: p.sx, depth: p.depth, alpha });
      }
    }
    pc.restore();
    list.length = 0;
  },

  // Τοίχος γεμίσματος (region -1): πάρε το θέμα του διπλανού κεφαλαίου.
  regionThemeNear(tx, ty) {
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const r = Level.regionAt(tx + dx, ty + dy);
      if (r >= 0) return RC_THEMES[r];
    }
    return 'rock';
  },

  // Προβολή ενός σημείου του κόσμου (x, y σε μονάδες) στην οθόνη: { sx, depth } ή null
  // αν είναι πίσω από την κάμερα. depth σε κελιά (για σύγκριση με το zbuf).
  project(x, y) {
    const rx = x / TILE - this.posX, ry = y / TILE - this.posY;
    const inv = 1 / (this.planeX * this.dirY - this.dirX * this.planeY);
    const tX = inv * (this.dirY * rx - this.dirX * ry);
    const tY = inv * (-this.planeY * rx + this.planeX * ry);
    if (tY <= 0.05) return null;
    return { sx: (this.W / 2) * (1 + tX / tY), depth: tY };
  },
};
