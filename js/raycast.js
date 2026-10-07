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
const RC_ALTAR_R = 2.4;              // ως πόσα κελιά φτάνει το φως ενός αναμμένου βωμού (μικρό λυχνάρι)
// Χώρος (στάδιο 1 της μεγάλης επέκτασης, STORY.md ενότητα 12): οι τοίχοι έχουν δικό τους ύψος (σε κελιά),
// ανάλογα με το πόσο ανοιχτός είναι ο χώρος μπροστά τους· ταβάνι (σε ύψος 1) μόνο στα στενά περάσματα,
// αλλού σκοτάδι από πάνω. Οι βράχοι έχουν ακανόνιστη κορυφή.
const RC_WALL_MAX = { rock: 2.7, blocks: 1.5, palace: 2.2, meadow: 0.8, grave: 0.8, road: 2.4 };   // πόσο ψηλώνουν (πάνω από το 1) στους μεγάλους χώρους
// Ύψος ανά είδος τοίχου (Level.wallKind): 1 = χαμηλή ξερολιθιά, 2 = τοίχος σπιτιού.
const RC_KIND_H = [0, 0.72, 1.7];
const RC_HMAX = 4.2;                 // το πιο ψηλό που μπορεί να είναι ένας τοίχος (για να σταματάει η ακτίνα)
const RC_NARROW = 0.44;              // κάτω από τόσο "άνοιγμα" (ποσοστό ελεύθερων κελιών 5×5) ένα κελί έχει ταβάνι
const RC_JAG = 0.28;                 // πόσο ακανόνιστη είναι η κορυφή των βράχων (ποσοστό του ύψους)
// Περιοχές (κεφάλαια) στο ύπαιθρο: ουρανός αντί για σκοτάδι, φως ημέρας παντού (για τον πρόλογο).
// sun: { az, el (ακτίνια), r (ακτίνια), color, glow } (ήλιος ή φεγγάρι), stars: true, hills: [r,g,b].
const RC_OUTDOOR = {};               // region → { sky: [[θέση 0..1, [r,g,b]], ...], light: 0..1, sun, stars, hills }
const RC_SPX = 1.9;                  // μονάδες κόσμου ανά pixel ενός sprite (η σκιά = 16 px ≈ 30 μονάδες)
const RC_DAY = [255, 236, 190];      // το φως της ημέρας στην έξοδο
const RC_AO = 0.3;                   // ως πόσο μακριά (σε κελιά) από τοίχο σκοτεινιάζει το δάπεδο/ταβάνι
const RC_RED_R = 1.8;                // ακτίνα (κελιά) της κόκκινης λάμψης κάτω από μια σκιά που φάνηκε

// Ποια υφή τοίχου έχει κάθε κεφάλαιο: σπηλιά, λαξευμένη πέτρα, παλάτι (με μαίανδρο).
const RC_THEMES_MAIN = CHAPTERS.map((c) => c.theme || 'rock');   // τα θέματα του Κάτω Κόσμου (js/levels.js)
let RC_THEMES = RC_THEMES_MAIN.slice();   // τα θέματα του κόσμου που είναι φορτωμένος (loadWorldData)

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
  cellFloor: null,    // ανά κελί: η υφή του δαπέδου (ανάλογα με την περιοχή: σπηλιά, πλακάκια, παλάτι)
  cellCeil: null,     // ανά κελί: η υφή του ταβανιού
  aoMask: null,       // Uint8Array ανά κελί: ποιοι γείτονες είναι τοίχοι (για το ambient occlusion)
  redCell: null,      // Float32Array: κόκκινη λάμψη ανά κελί (κάτω από σκιές που φάνηκαν), αυτό το καρέ
  _redTouched: [],
  _redSrc: [],        // οι σκιές που λάμπουν αυτό το καρέ: [x, y (κελιά), ένταση, ...]
  monsters: [],       // οι σκιές (το main τις δίνει πριν το render)
  waterFace: null,    // Uint8Array ανά (κελί*4 + πλευρά): 1 = υγρός τοίχος (νερό μπροστά), 2 = καταρράκτης
  foam: null,         // Uint8Array ανά κελί: νερό μπροστά σε καταρράκτη (αφρός)
  falls: [],          // κέντρα των καταρρακτών σε μονάδες κόσμου: [{ x, y }] (για τον ήχο του νερού)
  fogDist: RC_FOG,    // πού έχει πέσει το φως στο ελάχιστο (η ομίχλη του ποταμού το μικραίνει: js/crossing.js)
  fogMin: 0.3,        // το ελάχιστο (0 = τελείως σκοτεινό από εκεί και πέρα)
  lava: null,         // Uint8Array ανά κελί: λάβα (το "νερό" στα κεφάλαια με θέμα fire)
  lavaNear: null,     // Float32Array ανά κελί: απόσταση (κελιά) από την πιο κοντινή λάβα, ως 8
  wallH: null,        // Float32Array ανά κελί: ύψος του τοίχου σε κελιά (μόνο για αδιαφανή κελιά)
  ceilOn: null,       // Uint8Array ανά κελί: 1 = έχει ταβάνι (στενό πέρασμα)
  ambient: null,      // Float32Array ανά κελί: σταθερό φως (ύπαιθρο / φως ημέρας)
  sky: null,          // ο ουρανός αυτού του καρέ (αν είσαι στο ύπαιθρο): Uint32Array ανά γραμμή
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
    this.buildSpace();

    // Νερό: κάθε πλευρά τοίχου με νερό μπροστά της είναι υγρή· στη δυτική άκρη κάθε ποταμού (ο
    // τοίχος δυτικά του νερού, πλευρά 3) το νερό πέφτει από τον τοίχο σαν καταρράκτης — από εκεί
    // "έρχεται" το ποτάμι. Το νερό μπροστά σε καταρράκτη αφρίζει.
    this.waterFace = new Uint8Array(L.cols * L.rows * 4);
    this.foam = new Uint8Array(L.cols * L.rows);
    this.falls = [];
    const front = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (let ty = 0; ty < L.rows; ty++) {
      for (let tx = 0; tx < L.cols; tx++) {
        if (!L.isOpaque(tx, ty)) continue;
        for (let side = 0; side < 4; side++) {
          const fx = tx + front[side][0], fy = ty + front[side][1];
          if (L.terrainAt(fx, fy) !== T_WATER || RC_THEMES[L.region[fy * L.cols + fx]] === 'fire') continue;
          const fall = side === 3;
          this.waterFace[(ty * L.cols + tx) * 4 + side] = fall ? 2 : 1;
          if (fall) {
            this.foam[fy * L.cols + fx] = 1;
            this.falls.push({ x: (tx + 1) * TILE + 2, y: (ty + 0.5) * TILE });
          }
        }
      }
    }

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

  // Ο χώρος: πόσο ψηλός είναι κάθε τοίχος και πού υπάρχει ταβάνι. "Άνοιγμα" ενός κελιού = πόσα από
  // τα 5×5 γύρω του δεν είναι τοίχοι. Ένας τοίχος ψηλώνει όσο πιο ανοιχτός είναι ο χώρος μπροστά του·
  // τα κελιά μέσα στον βράχο παίρνουν το ύψος των γειτόνων τους (ο βράχος είναι ένας συμπαγής όγκος,
  // ώστε να μη φαίνονται από πάνω του οι σπηλιές που είναι πίσω).
  buildSpace() {
    const L = Level, cols = L.cols, rows = L.rows, n = cols * rows;
    const open = new Float32Array(n);
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        if (L.isOpaque(tx, ty)) continue;
        let k = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!L.isOpaque(tx + dx, ty + dy)) k++;
        open[ty * cols + tx] = k / 25;
      }
    }
    this.open = open;          // το "άνοιγμα" κάθε κελιού (για την ηχώ: Sound.setSpace)
    this.ceilOn = new Uint8Array(n);
    this.ambient = new Float32Array(n);
    // Λάβα (Φλεγέθων): φωτίζει μόνη της και ό,τι είναι γύρω της (μέχρι ~4 κελιά, χωρίς να περνάει τοίχους).
    this.lava = new Uint8Array(n);
    this.lavaNear = new Float32Array(n).fill(99);
    const lq = [];
    for (let c = 0; c < n; c++) {
      if (L.terrain[c] === T_WATER && RC_THEMES[L.region[c]] === 'fire') { this.lava[c] = 1; this.lavaNear[c] = 0; lq.push(c); }
    }
    for (let qi = 0; qi < lq.length; qi++) {
      const c = lq[qi], d = this.lavaNear[c];
      if (d >= 8) continue;
      for (const o of [1, -1, cols, -cols]) {
        const k = c + o;
        if (k < 0 || k >= n || L.opaque[k] || this.lavaNear[k] <= d + 1) continue;
        this.lavaNear[k] = d + 1;
        lq.push(k);
      }
    }
    for (let c = 0; c < n; c++) {
      if (L.opaque[c]) continue;
      if (this.lavaNear[c] < 4.5) this.ambient[c] = this.lava[c] ? 1 : 0.62 * Math.pow(1 - this.lavaNear[c] / 4.5, 1.4);
      const out = RC_OUTDOOR[L.region[c]];
      if (out) this.ambient[c] = out.light;
      else if (open[c] < RC_NARROW) this.ceilOn[c] = 1;
    }
    const H = new Float32Array(n);
    const near = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const c = ty * cols + tx;
        if (!L.opaque[c]) continue;
        let best = -1;
        for (const [dx, dy] of near) {
          const x = tx + dx, y = ty + dy;
          if (x < 0 || y < 0 || x >= cols || y >= rows || L.opaque[y * cols + x]) continue;
          best = Math.max(best, open[y * cols + x]);
        }
        if (best < 0) continue;
        const theme = RC_THEMES[L.region[c]] || this.regionThemeNear(tx, ty);
        const k = Math.max(0, Math.min(1, (best - 0.3) / 0.42));
        H[c] = L.wallKind[c] ? RC_KIND_H[L.wallKind[c]] : 1 + k * (RC_WALL_MAX[theme] || 1.5);
      }
    }
    // Μέσα στον βράχο: το ύψος των γειτόνων (λίγα περάσματα "διαστολής").
    const inner = new Uint8Array(n);
    for (let c = 0; c < n; c++) if (L.opaque[c] && H[c] === 0) inner[c] = 1;
    for (let pass = 0; pass < 4; pass++) {
      for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols; tx++) {
          const c = ty * cols + tx;
          if (!inner[c]) continue;
          let m = H[c];
          for (const [dx, dy] of near) {
            const x = tx + dx, y = ty + dy;
            if (x >= 0 && y >= 0 && x < cols && y < rows && L.opaque[y * cols + x]) m = Math.max(m, H[y * cols + x]);
          }
          H[c] = m;
        }
      }
    }
    for (let c = 0; c < n; c++) if (L.opaque[c] && H[c] === 0) H[c] = 2;
    this.wallH = H;
  },

  // Η ακανόνιστη κορυφή των βράχων: συνεχής θόρυβος κατά μήκος της πλευράς (ίδιος στα διπλανά κελιά).
  jag(p) {
    const i = Math.floor(p), f = p - i, u = f * f * (3 - 2 * f);
    const h = (k) => { const v = Math.sin(k * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
    return h(i) * (1 - u) + h(i + 1) * u;
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

    // ---- Πέτρες (στυλ retro dungeon crawler): επίπεδα χρώματα, χοντρός σκούρος αρμός, στρογγυλεμένες
    // γωνίες, φωτεινή πάνω/αριστερή ακμή, σκιά κάτω/δεξιά, βαθουλώματα και ρωγμές. ----
    const MORTAR = [30, 13, 9];
    // Πέτρες σε σειρές (σαν χτισμένος τοίχος): ύψη σειρών και πλάτη πετρών τυχαία αλλά σταθερά,
    // που "κλείνουν" ακριβώς στο Nn (η υφή επαναλαμβάνεται χωρίς ραφές).
    const courses = (Nn, seed, rh0, rh1, w0, w1) => {
      const rows = [];
      for (let y = 0; y < Nn;) {
        let h = rh0 + Math.floor(hash(rows.length, 1, seed) * (rh1 - rh0 + 1));
        if (Nn - (y + h) < rh0) h = Nn - y;
        const ws = [];
        for (let x = 0; x < Nn;) {
          let w = w0 + Math.floor(hash(rows.length, ws.length + 3, seed) * (w1 - w0 + 1));
          if (Nn - (x + w) < w0) w = Nn - x;
          ws.push([x, w]);
          x += w;
        }
        rows.push({ y0: y, h, ws, off: Math.floor(hash(rows.length, 99, seed) * Nn) });
        y += h;
      }
      return (u, v) => {
        let r = 0;
        while (r < rows.length - 1 && v >= rows[r].y0 + rows[r].h) r++;
        const row = rows[r], uu = (u + row.off) % Nn;
        let k = 0;
        while (k < row.ws.length - 1 && uu >= row.ws[k][0] + row.ws[k][1]) k++;
        return { id: r * 31 + k, du: uu - row.ws[k][0], dv: v - row.y0, w: row.ws[k][1], h: row.h };
      };
    };
    // Το χρώμα ενός σημείου μιας πέτρας (st = αποτέλεσμα του courses), base = χρώμα της πέτρας.
    const stone = (st, u, v, base, gap, seed) => {
      const { du, dv, w, h, id } = st;
      if (du < gap || dv < gap) return MORTAR;
      // Στρογγυλεμένες γωνίες.
      const rc = gap + 2, x = du - gap, y = dv - gap, iw = w - gap, ih = h - gap;
      const cx = x < rc ? rc - x : x > iw - 1 - rc ? x - (iw - 1 - rc) : 0;
      const cy = y < rc ? rc - y : y > ih - 1 - rc ? y - (ih - 1 - rc) : 0;
      if (cx * cx + cy * cy > rc * rc + 1) return MORTAR;
      let k = 0.86 + hash(id, 7, seed) * 0.26;
      if (y <= 1 || x <= 0) k *= 1.28;                          // φωτεινή πάνω/αριστερή ακμή
      else if (y >= ih - 2 || x >= iw - 1) k *= 0.66;           // σκιά κάτω/δεξιά
      if (hash(u >> 1, v >> 1, seed + 40) > 0.92) k *= 0.62;    // βαθουλώματα
      // Ρωγμή σε μερικές πέτρες: μια σκούρη λοξή γραμμή.
      if (hash(id, 11, seed) > 0.72 && Math.abs((x - iw * 0.3) * 0.6 - (y - ih * 0.2)) < 0.6 && x > 2 && x < iw - 2) return mul(MORTAR, 1.4);
      return mul(base, k);
    };
    const BRICK = [150, 40, 28];      // μπορντό λίθοι (σαν στην εικόνα αναφοράς)
    const block = (u, v, s) => stone(courses(WN, s, 10, 16, 14, 30)(u, v), u, v, BRICK, 2, s);
    const blockTex = (s) => { const f = courses(WN, s, 10, 16, 14, 30); return makeW((u, v) => stone(f(u, v), u, v, BRICK, 2, s)); };

    // Σπηλιά: ακανόνιστοι βράχοι (Voronoi που επαναλαμβάνεται χωρίς ραφές) σε καφέ-μπορντό, με
    // χοντρές σκούρες σχισμές, φωτεινή πάνω ακμή και σκιά από κάτω.
    const ROCK = [132, 50, 32];
    const rock = (seedBase, base = ROCK) => {
      const seeds = [];
      for (let k = 0; k < 9; k++) seeds.push([hash(k, 1, seedBase) * WN, hash(k, 2, seedBase + 1) * WN]);
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
        if (edge < 2.2) return MORTAR;
        // Πού είναι το σημείο ως προς το κέντρο της πέτρας: από πάνω = φως, από κάτω = σκιά.
        let cy = seeds[id][1] - (v + 0.5);
        if (cy > WN / 2) cy -= WN; else if (cy < -WN / 2) cy += WN;
        let k = 0.8 + hash(id, 4, seedBase) * 0.3;
        if (edge < 3.6) k *= cy > 0 ? 0.62 : 1.3;
        if (hash(u >> 1, v >> 1, seedBase + 9) > 0.93) k *= 0.6;
        return mul(base, k);
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
      return block(u, v - 41, 5);
    }), figs, 13, 37);
    // Λαξευμένη πέτρα (IV, VI): λίθοι, και σε μερικές πλευρές μια στενή ζωφόρος με μορφές.
    const frieze = (figs) => stamp(makeW((u, v) => {
      if (v === 0 || v === 21) return BLACK;
      if (v === 1 || v === 20) return clay(u, v);
      if (v <= 19) return clay(u, v);
      return block(u, v, 3);
    }), figs, 2, 20);

    // Ύπαιθρο (πρόλογος): ασβεστόλιθος στους λόφους, ξερολιθιά (χαμηλοί τοίχοι), ασβεστωμένος
    // τοίχος σπιτιού με ρωγμές και κόκκινη λωρίδα στη βάση.
    const LIME = [176, 150, 112];
    const dry = courses(WN, 31, 7, 12, 9, 20);
    const plaster = makeW((u, v) => {
      if (v >= WN - 6) return mul([150, 64, 36], v === WN - 6 ? 0.7 : 1);      // κόκκινη λωρίδα
      let k = 0.9 + hash(u >> 2, v >> 2, 70) * 0.1;
      if (hash(u, v, 71) > 0.985) k *= 0.75;
      if (Math.abs(((u * 0.7 + v * 0.4) % 23) - 11) < 0.5 && hash(u >> 3, v >> 3, 72) > 0.7) k *= 0.7;   // ρωγμές
      return mul([236, 222, 196], k);
    });

    this.walls = {
      meadow: [rock(41, LIME), rock(47, LIME)],
      grave: [rock(41, LIME), rock(53, LIME)],
      road: [rock(2), rock(11)],
      drystone: [makeW((u, v) => stone(dry(u, v), u, v, LIME, 1, 33))],
      plaster: [plaster],
      rock: [rock(2), rock(11), rock(23)],
      blocks: [blockTex(3), blockTex(8), blockTex(13),
        frieze([['soul', 0, false, true], ['soul', 1, false, true], ['soul', 0, false, true]]),
        frieze([['shade', 0, false], ['shade', 1, false], ['erinys', 0, false]])],
      palace: [
        palace([['orpheus_play_3', 0, false], ['hades', 0, false], ['persephone', 1, false, true]]),
        palace([['shade', 0, false], ['shade', 1, false], ['erinys', 1, false]]),
        palace([['soul', 0, true, true], ['orpheus_walk_3', 1, true], ['eurydice', 0, true, true]]),
        palace([['charon', 1, false], ['soul', 1, false, true], ['hound', 0, true]]),
      ],
    };

    // Δάπεδο (IV, VI): επιμήκεις λίθοι σε σειρές (4 παραλλαγές)· ταβάνι από πιο σκούρους λίθους.
    this.tex.floor = [0, 1, 2, 3].map((sd) => { const f = courses(N, 60 + sd, 7, 11, 11, 22); return make((u, v) => stone(f(u, v), u, v, BRICK, 2, 60 + sd)); });
    this.tex.ceil = (() => { const f = courses(N, 70, 8, 12, 12, 24); return make((u, v) => stone(f(u, v), u, v, [104, 30, 21], 2, 70)); })();

    // Σπηλιά: δάπεδο από ακανόνιστες πλάκες πέτρας (Voronoi, χωρίς ραφές) με φωτεινούς αρμούς,
    // και τραχύ, σκοτεινό ταβάνι από βράχο με λεπτές ρωγμές.
    const voronoi = (n, seedBase, fn) => {
      const seeds = [];
      for (let k = 0; k < n; k++) seeds.push([hash(k, 5, seedBase) * N, hash(k, 6, seedBase + 1) * N]);
      return make((u, v) => {
        let d1 = 1e9, d2 = 1e9, id = 0;
        for (let k = 0; k < n; k++) {
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              const dx = u + 0.5 - (seeds[k][0] + ox * N), dy = v + 0.5 - (seeds[k][1] + oy * N);
              const d = Math.sqrt(dx * dx + dy * dy);
              if (d < d1) { d2 = d1; d1 = d; id = k; } else if (d < d2) d2 = d;
            }
          }
        }
        return fn(u, v, d2 - d1, id);
      });
    };
    this.tex.caveFloor = [3, 17].map((sb) => voronoi(7, sb, (u, v, edge, id) => {
      if (edge < 1.6) return MORTAR;
      const k = (0.8 + hash(id, 8, sb) * 0.3) * (edge < 2.8 ? 1.22 : 1) * (hash(u >> 1, v >> 1, sb + 5) > 0.93 ? 0.6 : 1);
      return mul(ROCK, k * 0.92);
    }));
    this.tex.caveCeil = voronoi(6, 41, (u, v, edge, id) => {
      if (edge < 1.4) return MORTAR;
      return mul([96, 36, 24], 0.75 + hash(id, 9, 41) * 0.3 + (edge < 2.6 ? 0.2 : 0));
    });
    // Παλάτι: δάπεδο σκακιέρα από "μαύρο γάνωμα" και πηλό (τα χρώματα των αγγείων), με
    // φωτεινούς αρμούς· ταβάνι με φατνώματα (τετράγωνα βαθουλώματα με πλαίσιο).
    this.tex.palaceFloor = make((u, v) => {
      const tu = u % 20, tv = v % 20;
      if (tu === 0 || tv === 0) return mul(LIGHT, 0.55);
      const dark = ((Math.floor(u / 20) + Math.floor(v / 20)) & 1) === 0;
      const k = 0.85 + (hash(u, v, 51) - 0.5) * 0.1 + (tu === 1 || tv === 1 ? 0.2 : 0);
      return dark ? mul([40, 24, 18], k) : mul([170, 90, 48], k);
    });
    // Ύπαιθρο (πρόλογος): ξερό καλοκαιρινό χορτάρι με λεπίδες και πετραδάκια, χωματόδρομος,
    // πήλινα πλακάκια του σπιτιού (= το floor), δοκάρια στο ταβάνι του σπιτιού.
    this.tex.grass = [0, 1].map((k) => make((u, v) => {
      const n = hash(u, v, 60 + k), m = hash(Math.floor(u / 3), Math.floor(v / 5), 62 + k);
      if (n > 0.93) return mul([214, 170, 92], 0.95);                         // λεπίδα στον ήλιο
      if (n < 0.06) return mul([92, 66, 42], 0.9);                            // σκιά
      if (hash(Math.floor(u / 6), Math.floor(v / 6), 64 + k) > 0.92 && n > 0.5) return [150, 140, 120];   // πετραδάκι
      return mul([168, 128, 62], 0.78 + m * 0.22);
    }));
    this.tex.dirt = make((u, v) => {
      const n = hash(u, v, 66), m = hash(Math.floor(u / 4), Math.floor(v / 4), 67);
      if (n > 0.95) return [176, 150, 112];
      if (n < 0.05) return [74, 50, 32];
      return mul([140, 104, 68], 0.8 + m * 0.2);
    });
    this.tex.beams = make((u, v) => {
      const tu = u % 10;
      if (tu <= 2) return mul([110, 70, 40], tu === 0 ? 0.6 : 1);           // δοκάρι
      return mul([170, 140, 100], 0.55 + hash(Math.floor(u / 10), v >> 3, 68) * 0.1);   // καλάμια
    });

    this.tex.palaceCeil = make((u, v) => {
      const tu = u % 20, tv = v % 20;
      if (tu <= 1 || tv <= 1) return mul(TERRA, 0.6);                       // δοκάρια
      if (tu === 2 || tv === 2) return mul(TERRA, 0.38);                    // ακμή του φατνώματος
      if (tu >= 17 || tv >= 17) return mul([40, 22, 14], 0.8);              // σκιά μέσα στο φάτνωμα
      return mul([70, 38, 24], 0.7 + hash(Math.floor(u / 20), Math.floor(v / 20), 52) * 0.15);
    });

    this.buildCells();
  },

  // Ανά κελί: ποια υφή δαπέδου / ταβανιού (ανάλογα με το θέμα της περιοχής), και ποιοι
  // γείτονες είναι τοίχοι (ambient occlusion: bit 0..3 = Β, Ν, Δ, Α· 4..7 = διαγώνιες γωνίες
  // ΒΔ, ΒΑ, ΝΔ, ΝΑ, μόνο όταν οι δύο πλαϊνοί δεν είναι τοίχοι). Ξανά σε κάθε κόσμο που φορτώνεται.
  buildCells() {
    const L = Level, cells = L.cols * L.rows;
    this.cellFloor = new Array(cells);
    this.cellCeil = new Array(cells);
    this.aoMask = new Uint8Array(cells);
    this.redCell = new Float32Array(cells);
    for (let ty = 0; ty < L.rows; ty++) {
      for (let tx = 0; tx < L.cols; tx++) {
        const c = ty * L.cols + tx;
        const theme = RC_THEMES[L.region[c]] || 'rock';
        if (theme === 'palace') {
          this.cellFloor[c] = this.tex.palaceFloor;
          this.cellCeil[c] = this.tex.palaceCeil;
        } else if (theme === 'meadow' || theme === 'grave' || theme === 'road') {
          // Ύπαιθρο: ξερό χορτάρι (το σπίτι και τα μονοπάτια τα αλλάζει ο πρόλογος).
          this.cellFloor[c] = this.tex.grass[(tx * 5 + ty * 3) & 1];
          this.cellCeil[c] = this.tex.beams;
        } else if (theme === 'blocks') {
          this.cellFloor[c] = this.tex.floor[(tx * 7 + ty * 13) & 3];
          this.cellCeil[c] = this.tex.ceil;
        } else {
          this.cellFloor[c] = this.tex.caveFloor[(tx * 5 + ty * 3) & 1];
          this.cellCeil[c] = this.tex.caveCeil;
        }
        const o = (dx, dy) => L.isOpaque(tx + dx, ty + dy);
        let m = 0;
        if (o(0, -1)) m |= 1;
        if (o(0, 1)) m |= 2;
        if (o(-1, 0)) m |= 4;
        if (o(1, 0)) m |= 8;
        if (!(m & 5) && o(-1, -1)) m |= 16;
        if (!(m & 9) && o(1, -1)) m |= 32;
        if (!(m & 6) && o(-1, 1)) m |= 64;
        if (!(m & 10) && o(1, 1)) m |= 128;
        this.aoMask[c] = m;
      }
    }
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

  // Αλλάζει το οπτικό πεδίο χωρίς να ξαναφτιάξει τους buffers (π.χ. όσο τρέχεις σε καταδίωξη).
  setFov(f) {
    this.fov = f;
    this.focal = Math.max((this.W / 2) / Math.tan(f / 2), this.H * 0.4);
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
    // Στο ύπαιθρο: ουρανός πάνω από τον ορίζοντα (αλλιώς σκοτάδι — στις σπηλιές δεν φαίνεται τίποτα από πάνω).
    const outdoor = RC_OUTDOOR[L.regionAt(Math.floor(px / TILE), Math.floor(py / TILE))];
    if (outdoor) this.fillSky(outdoor, H * 0.5 + bob, angle);

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
    // Σταθερό φως (ύπαιθρο): μόνο στα κελιά που το έχουν.
    const amb0 = this.ambient;
    for (let c = 0; c < cl.length; c++) if (amb0[c] > cl[c]) cl[c] = amb0[c];

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

    // Κόκκινη λάμψη στο δάπεδο κάτω από κάθε σκιά τη στιγμή που φαίνεται (στη θέση που φάνηκε).
    const red = this.redCell;
    for (const c of this._redTouched) red[c] = 0;
    this._redTouched.length = 0;
    const rs = this._redSrc;
    rs.length = 0;
    for (const m of this.monsters) {
      if (m.isFrozen()) continue;
      const a = m.revealAlpha(now);
      if (a < 0.03) continue;
      const mx = m.revealX / TILE, my = m.revealY / TILE;
      rs.push(mx, my, a);
      const r = Math.ceil(RC_RED_R);
      for (let ty = Math.floor(my) - r; ty <= Math.floor(my) + r; ty++) {
        for (let tx = Math.floor(mx) - r; tx <= Math.floor(mx) + r; tx++) {
          if (tx < 0 || ty < 0 || tx >= cols || ty >= rows || L.opaque[ty * cols + tx]) continue;
          const d = Math.hypot(tx + 0.5 - mx, ty + 0.5 - my);
          if (d > RC_RED_R) continue;
          const c = ty * cols + tx, v = a * Math.pow(1 - d / RC_RED_R, 1.5);
          if (red[c] === 0) this._redTouched.push(c);
          if (v > red[c]) red[c] = v;
        }
      }
    }

    const hasWaves = Echoes.waves.length > 0;
    if (hasWaves) this.prepareWaves();
    const gateAt = this.gateAt;
    const per = this.segPer;

    // ---- Τοίχοι ----
    // Η ακτίνα δεν σταματάει στον πρώτο τοίχο: ένας ψηλότερος τοίχος πιο πίσω φαίνεται πάνω από έναν
    // χαμηλότερο μπροστά. clip = ως πού (από πάνω) έχει ήδη ζωγραφιστεί η στήλη.
    const wallH = this.wallH, amb = this.ambient;
    const N = RC_WTEX;
    for (let x = 0; x < W; x++) {
      const cam = (2 * (x + 0.5)) / W - 1;
      const rdx = dirX + planeX * cam, rdy = dirY + planeY * cam;
      let tx = Math.floor(posX), ty = Math.floor(posY);
      const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
      const sx = rdx < 0 ? -1 : 1, sy = rdy < 0 ? -1 : 1;
      let sdx = (rdx < 0 ? posX - tx : tx + 1 - posX) * ddx;
      let sdy = (rdy < 0 ? posY - ty : ty + 1 - posY) * ddy;
      let xSide = false, dist = 0, first = true, clip = H;
      this.zbuf[x] = Infinity;
      this.wallTop[x] = this.wallBot[x] = hz;
      while (dist < RC_MAX) {
        if (sdx < sdy) { dist = sdx; sdx += ddx; tx += sx; xSide = true; }
        else { dist = sdy; sdy += ddy; ty += sy; xSide = false; }
        // Έξω από τον χάρτη = τοίχος (π.χ. πίσω από την έξοδο, που είναι στην τελευταία γραμμή).
        const inside = tx >= 0 && ty >= 0 && tx < cols && ty < rows;
        const ci = inside ? ty * cols + tx : -1;
        if (inside && (L.opaque[ci] !== 1 || gateAt[ci] >= 0)) continue;
        const lineH = this.focal / dist;
        // Ούτε ο πιο ψηλός τοίχος δεν θα φαινόταν πάνω από ό,τι έχει ήδη ζωγραφιστεί: τέλος.
        if (!first && hz - lineH * (RC_HMAX - RC_EYE) >= clip) break;

        // Πού ακριβώς χτύπησε (0..1 κατά μήκος της πλευράς) και ποια πλευρά.
        let frac, side;
        if (xSide) { frac = posY + dist * rdy; side = sx > 0 ? 2 : 3; }
        else { frac = posX + dist * rdx; side = sy > 0 ? 0 : 1; }
        const along = frac;
        frac -= Math.floor(frac);
        const theme = (inside && RC_THEMES[L.region[ci]]) || this.regionThemeNear(tx, ty);
        let h = inside ? wallH[ci] : 3;
        // Βράχος: ακανόνιστη κορυφή.
        if (theme !== 'palace' && theme !== 'blocks' && !(inside && L.wallKind[ci]) && h > 1.15) h *= 1 + RC_JAG * Math.min(1, h - 1) * (this.jag(along * 1.7 + side * 31.7) - 0.5) * 2;
        const top = hz - lineH * (h - RC_EYE), bot = hz + lineH * RC_EYE;
        const isFirst = first;
        if (first) {
          this.zbuf[x] = dist;
          this.wallTop[x] = top;
          this.wallBot[x] = bot;
          first = false;
        }
        if (top >= clip) continue;
        const yLimit = isFirst ? bot : Math.min(bot, clip);
        clip = Math.min(clip, top);

        const base = inside ? this.segBase[ci * 4 + side] : -1;
        const seg = base >= 0 ? base + Math.min(per - 1, Math.floor(frac * per)) : -1;
        let light = seg >= 0 ? this.segLight(seg, now) + se[seg] : 0;
        const fdx = side === 2 ? -1 : side === 3 ? 1 : 0, fdy = side === 0 ? -1 : side === 1 ? 1 : 0;
        // Σταθερό φως (ύπαιθρο): από το κελί μπροστά στον τοίχο.
        if (inside) {
          const fx = tx + fdx, fy = ty + fdy;
          if (fx >= 0 && fy >= 0 && fx < cols && fy < rows) { const ab = amb[fy * cols + fx]; if (ab > light) light = ab; }
        }
        let yCut = yLimit;
        if (isFirst && exA > 0.01 && ci * 4 + side === this.exitKey) {
          // Το άνοιγμα της εξόδου: φως της ημέρας στο κάτω μέρος, βράχος από πάνω.
          const openTop = hz - lineH * (1.2 - RC_EYE);
          this.drawDaylight(x, Math.max(top, openTop), bot, frac, exA, now);
          yCut = Math.max(top, openTop);
        }
        let glow = 0;
        if (hasWaves) {
          const hx = (posX + dist * rdx) * TILE, hy = (posY + dist * rdy) * TILE;
          light += this.ringAt(hx, hy, false, -1) * 0.8;
          glow = this.glow;
        }
        const wfog = Math.max(this.fogMin, 1 - (dist * TILE) / this.fogDist);
        light *= wfog;
        glow *= wfog;
        if (light < 0.01 && glow < 0.01) {
          if (clip <= 0 || !inside) break;
          continue;
        }
        if (light > 1.4) light = 1.4;
        const gr = glow * 210, gg = glow * 110, gb = glow * 56;

        // Σκίαση πλευρών (όπως στα κλασικά raycasters).
        const shade = xSide ? 0.8 : 1;
        let u = Math.floor(frac * N);
        if (side === 3 || side === 0) u = N - 1 - u;
        const kind = inside ? L.wallKind[ci] : 0;
        const variants = kind === 1 ? this.walls.drystone : kind === 2 ? this.walls.plaster : this.walls[theme] || this.walls.rock;
        const tex0 = variants[(((tx * 73856093) ^ (ty * 19349663) ^ (side * 83492791)) >>> 0) % variants.length];
        // Πάνω από το πρώτο ύψος: απλοί λίθοι (οι ζωφόροι και οι τοιχογραφίες μόνο μία φορά, στο ύψος των ματιών).
        const texUp = !kind && (theme === 'palace' || theme === 'blocks') ? this.walls.blocks[0] : tex0;

        // Φωτεινές ακμές: η (ακανόνιστη) κορυφή, η βάση, και οι κάθετες γωνίες.
        const adx = fdy !== 0 ? 1 : 0, ady = fdx !== 0 ? 1 : 0;
        const cw = Math.max(0.02, 1.2 / lineH);
        let corner = false;
        if (frac < cw) corner = !(L.isOpaque(tx - adx, ty - ady) && !L.isOpaque(tx - adx + fdx, ty - ady + fdy));
        else if (frac > 1 - cw) corner = !(L.isOpaque(tx + adx, ty + ady) && !L.isOpaque(tx + adx + fdx, ty + ady + fdy));
        const edge = Math.min(1.25, (light + glow) * 1.05);
        const er = 206 * edge, eg = 98 * edge, eb = 54 * edge;

        const wf = inside ? this.waterFace[ci * 4 + side] : 0;
        const stream = Math.floor(frac * 5);
        const sh = Math.abs(Math.sin(stream * 12.9898 + tx * 78.233 + ty * 37.719) * 43758.5453) % 1;
        const y0 = Math.max(0, Math.floor(top)), y1 = Math.min(H, Math.ceil(yCut));
        const yTop = Math.floor(top), yBot = Math.ceil(bot) - 1;
        const lit = light * shade;
        const dz = 1 / lineH;
        let z = (bot - (y0 + 0.5)) * dz;     // ύψος από το δάπεδο (σε κελιά)
        for (let y = y0; y < y1; y++, z -= dz) {
          // Η υφή επαναλαμβάνεται ανά κελί ύψους· πιο ψηλά ο ήχος φωτίζει λιγότερο (σκοτάδι από πάνω).
          const zf = z - Math.floor(z);
          let v = ((1 - zf) * N) | 0;
          if (v >= N) v = N - 1;
          const up = z > 0.9 ? Math.max(0.28, 1 - (z - 0.9) * 0.32) : 1;
          const tex = z >= 1 ? texUp : tex0;
          let r, g, b;
          if (wf === 2) {
            // Καταρράκτης σε όλο το ύψος: φωτεινά ρυάκια που κατεβαίνουν, αφρός στη βάση.
            const vv = 1 - z / h;
            const ti = (v * N + u) * 3;
            const fl = (vv * h * (1.1 + sh * 0.8) - now * (0.9 + sh * 0.8) + sh * 7) % 1;
            const f = fl < 0 ? fl + 1 : fl;
            const sf = frac * 5 - stream;
            let wk = (f < 0.55 ? 0.95 : f < 0.75 ? 0.6 : 0.3) * (sf < 0.12 || sf > 0.88 ? 0.45 : 1);
            if (z < 0.14) wk = Math.max(wk, 0.75 + 0.25 * Math.sin(now * 9 + stream * 2.3 + y));
            const kk = lit * up;
            r = tex[ti] * kk * 0.4 + 196 * wk * kk + gr;
            g = tex[ti + 1] * kk * 0.4 + 168 * wk * kk + gg;
            b = tex[ti + 2] * kk * 0.4 + 140 * wk * kk + gb;
          } else if (corner || y === yTop || y === yBot) {
            r = er * up; g = eg * up; b = eb * up;
          } else if (wf === 1) {
            // Υγρός τοίχος: πιο σκούρος κοντά στο νερό, σταγόνες που γλιστράνε σε μερικά σημεία.
            const ti = (v * N + u) * 3;
            let k = lit * up * (z < 0.38 ? 0.62 : 0.85);
            if (sh > 0.78) {
              const dl = ((1 - z / h) * 1.6 * h - now * (0.25 + sh * 0.3) + sh * 5) % 1;
              if ((dl < 0 ? dl + 1 : dl) < 0.12) k *= 1.6;
            }
            r = tex[ti] * k + gr; g = tex[ti + 1] * k + gg; b = tex[ti + 2] * k + gb;
          } else {
            const ti = (v * N + u) * 3;
            // Σκιά στη βάση του τοίχου (εκεί που ακουμπάει το δάπεδο) και λίγο στην κορυφή.
            const ao = z < 0.16 ? 1 - (0.16 - z) * 3 : z > h - 0.06 ? 0.8 : 1;
            const k = lit * ao * up;
            r = tex[ti] * k + gr; g = tex[ti + 1] * k + gg; b = tex[ti + 2] * k + gb;
          }
          if (r > 255) r = 255;
          if (g > 255) g = 255;
          if (b > 255) b = 255;
          buf[y * W + x] = 0xff000000 | (b << 16) | (g << 8) | r;
        }
        if (clip <= 0 || !inside) break;
      }
    }

    // ---- Δάπεδο και ταβάνι (γραμμή-γραμμή) ----
    const cellFloor = this.cellFloor, cellCeil = this.cellCeil, aoMask = this.aoMask, ceilOn = this.ceilOn;
    const coarse = this.coarse;
    const ripple = now * 1.3;
    for (let y = 0; y < H; y++) {
      const below = y + 0.5 > hz;
      const p = below ? y + 0.5 - hz : hz - y - 0.5;
      if (p < 0.5) continue;
      const rd = (this.focal * (below ? RC_EYE : 1 - RC_EYE)) / p;   // σε κελιά
      const fog = Math.max(this.fogMin, 1 - (rd * TILE) / this.fogDist) * (below ? 1 : RC_CEIL);
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
        // Ταβάνι μόνο στα στενά περάσματα· αλλού από πάνω είναι σκοτάδι (ή ό,τι ψηλό φαίνεται πίσω).
        if (!below && !ceilOn[c]) continue;
        const t = !below ? T_FLOOR : gateAt[c] >= 0 && !L.gates[gateAt[c]].open ? T_WATER : L.terrain[c];
        if (t === T_CHASM) continue;   // χάσμα: μαύρο, χωρίς πάτο
        let light = cl[c], glow = 0;
        if (hasWaves) {
          light += this.ringAt(wx * TILE, wy * TILE, true, c);
          glow = this.glow * fog;
        }
        light *= fog;
        // Ambient occlusion: πιο σκοτεινά δίπλα στους τοίχους και στις γωνίες.
        const am = aoMask[c];
        if (am !== 0 && light > 0.012) {
          const fx = wx - tx, fy = wy - ty;
          let d = 1;
          if ((am & 1) && fy < d) d = fy;
          if ((am & 2) && 1 - fy < d) d = 1 - fy;
          if ((am & 4) && fx < d) d = fx;
          if ((am & 8) && 1 - fx < d) d = 1 - fx;
          if (am & 240) {
            if (am & 16) { const q = Math.sqrt(fx * fx + fy * fy); if (q < d) d = q; }
            if (am & 32) { const q = Math.sqrt((1 - fx) * (1 - fx) + fy * fy); if (q < d) d = q; }
            if (am & 64) { const q = Math.sqrt(fx * fx + (1 - fy) * (1 - fy)); if (q < d) d = q; }
            if (am & 128) { const q = Math.sqrt((1 - fx) * (1 - fx) + (1 - fy) * (1 - fy)); if (q < d) d = q; }
          }
          if (d < RC_AO) light *= 0.4 + 0.6 * (d / RC_AO);
        }
        // Κόκκινη λάμψη κάτω από σκιά (μόνο στο δάπεδο): στρογγυλή, με την απόσταση του pixel
        // από τη σκιά (μόνο στα κελιά που την έχουν).
        let rl = 0;
        if (below && red[c] > 0) {
          for (let k = 0; k < rs.length; k += 3) {
            const dx = wx - rs[k], dy = wy - rs[k + 1];
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < RC_RED_R) { const v = rs[k + 2] * Math.pow(1 - d / RC_RED_R, 1.5); if (v > rl) rl = v; }
          }
          rl *= fog;
        }
        // Νερό: ο φωτισμένος τοίχος πίσω του καθρεφτίζεται (ανάποδα, κυματιστά), πιο αχνά όσο
        // πλησιάζει το νερό προς τον παίκτη — φαίνεται ακόμα κι όταν το ίδιο το νερό είναι σκοτεινό.
        let rr = 0, rg = 0, rb = 0;
        if (t === T_WATER && !this.lava[c]) {
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
        if (light < 0.012 && glow < 0.01 && rr + rg + rb < 2 && rl < 0.01) {
          // Σκοτεινό ταβάνι: κρύβει ό,τι ψηλό είναι πίσω του.
          if (!below) buf[y * W + x] = 0xff000000;
          continue;
        }
        if (light > 1.4) light = 1.4;
        const u = ((wx - tx) * RC_TEX) | 0, v = ((wy - ty) * RC_TEX) | 0;
        let r, g, b;
        if (!below) {
          const ct = cellCeil[c];
          const i = (v * RC_TEX + u) * 3;
          r = ct[i]; g = ct[i + 1]; b = ct[i + 2];
        } else if (t === T_WATER && this.lava[c]) {
          // Λάβα: κινούμενα κύματα φωτιάς (σκούρο κόκκινο → πορτοκαλί → σχεδόν λευκό), φωτίζει μόνη της.
          const X = wx * TILE, Y = wy * TILE;
          const f = Math.sin(X * 0.11 + now * 1.3 + Math.sin(Y * 0.07)) * Math.sin(Y * 0.09 - now * 0.9) * 0.5 + 0.5;
          const crust = Math.abs(Math.sin(X * 0.05 - Y * 0.04 + now * 0.25)) < 0.12;
          if (crust) { r = 70; g = 20; b = 15; } else if (f > 0.78) { r = 255; g = 214; b = 130; } else if (f > 0.45) { r = 232; g = 120; b = 40; } else { r = 170; g = 34; b = 18; }
          light = 1;
          rr = rg = rb = 0;
        } else if (t === T_WATER) {
          // Σκούρο νερό με κυματάκια που κυλάνε αργά.
          const X = wx * TILE, Y = wy * TILE;
          const m = (Y + Math.sin(X * 0.12 + ripple + tx * 1.7) * 3) % 13;
          const line = Math.abs((m < 0 ? m + 13 : m) - 6.5) < 0.6;
          if (line) { r = 112; g = 58; b = 30; } else { r = 30; g = 18; b = 13; }
          // Αφρός μπροστά στον καταρράκτη: φωτεινές κηλίδες που ανακατεύονται, πιο πυκνές κοντά στον τοίχο.
          if (this.foam[c]) {
            const fx = wx - tx;
            const n = Math.abs(Math.sin(Math.floor(X * 0.5) * 12.98 + Math.floor(Y * 0.5) * 78.23 + Math.floor(now * 7) * 3.1) * 43758.5) % 1;
            if (n < 0.75 - fx * 0.8) { r = 200; g = 172; b = 140; }
          }
        } else {
          const tex = cellFloor[c];
          const i = (v * RC_TEX + u) * 3;
          r = tex[i]; g = tex[i + 1]; b = tex[i + 2];
        }
        r = r * light + glow * 210 + rr + rl * 190; g = g * light + glow * 110 + rg + rl * 22; b = b * light + glow * 56 + rb + rl * 14;
        if (r > 255) r = 255;
        if (g > 255) g = 255;
        if (b > 255) b = 255;
        buf[y * W + x] = 0xff000000 | (b << 16) | (g << 8) | r;
      }
    }

    // (Τα χρώματα μπαίνουν στην παλέτα στο τέλος του καρέ, μαζί με τις μορφές: Pixel.posterize.)
    pc.putImageData(this.img, 0, 0);
  },

  // Ουρανός (ύπαιθρο): κάθετη διαβάθμιση πάνω από τον ορίζοντα. stops = [[θέση 0 (πάνω) .. 1 (ορίζοντας), [r,g,b]], ...]
  // o = RC_OUTDOOR[...]: sky (διαβάθμιση), sun (ήλιος / φεγγάρι σε σταθερή κατεύθυνση του κόσμου),
  // stars, hills (μακρινοί λόφοι στον ορίζοντα, γυρίζουν μαζί με το βλέμμα).
  fillSky(o, hz, angle) {
    const W = this.W, buf = this.buf, top = Math.min(this.H, Math.ceil(hz)), stops = o.sky, f0 = this.focal;
    const pack = (r, g, b) => 0xff000000 | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0);
    for (let y = 0; y < top; y++) {
      const t = Math.max(0, Math.min(1, 1 - (hz - y) / (this.H * 0.75)));
      let k = 0;
      while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
      const [p0, c0] = stops[k], [p1, c1] = stops[Math.min(k + 1, stops.length - 1)];
      const f = p1 > p0 ? Math.max(0, Math.min(1, (t - p0) / (p1 - p0))) : 0;
      buf.fill(pack(c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f), y * W, (y + 1) * W);
    }
    if (top <= 0) return;
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    for (let x = 0; x < W; x++) {
      const a = angle + Math.atan((x + 0.5 - W / 2) / f0);
      // Αστέρια: σταθερά στον ουρανό (ανά γωνία / ύψος), όχι στην οθόνη.
      if (o.stars) {
        const ai = Math.floor(((a % 6.2832) + 6.2832) * 90);
        for (let y = 0; y < top; y++) {
          const ei = Math.floor(Math.atan((hz - y) / f0) * 90);
          const h = Math.sin(ai * 12.9898 + ei * 78.233) * 43758.5453;
          if (h - Math.floor(h) > 0.992) buf[y * W + x] = h - Math.floor(h) > 0.997 ? pack(255, 246, 228) : pack(170, 142, 100);
        }
      }
      // Ήλιος / φεγγάρι με λάμψη γύρω του.
      if (o.sun) {
        const s = o.sun, da = wrap(a - s.az);
        if (Math.abs(da) < s.r * 5) {
          for (let y = 0; y < top; y++) {
            const de = Math.atan((hz - y) / f0) - s.el, d = Math.hypot(da, de) / s.r;
            if (d < 1) buf[y * W + x] = pack(...s.color);
            else if (d < 2.6 && s.glow) {
              const k = (1 - (d - 1) / 1.6) * 0.35, p = buf[y * W + x];
              buf[y * W + x] = pack((p & 255) + (s.glow[0] - (p & 255)) * k, ((p >> 8) & 255) + (s.glow[1] - ((p >> 8) & 255)) * k, ((p >> 16) & 255) + (s.glow[2] - ((p >> 16) & 255)) * k);
            }
          }
        }
      }
      // Μακρινοί λόφοι: δύο στρώσεις, πιο σκούρα η κοντινή.
      if (o.hills) {
        for (let layer = 0; layer < 2; layer++) {
          const n = (q) => { const i = Math.floor(q), fr = q - i, u = fr * fr * (3 - 2 * fr); const h = (k) => { const v = Math.sin(k * 127.1 + layer * 31.3) * 43758.5453; return v - Math.floor(v); }; return h(i) * (1 - u) + h(i + 1) * u; };
          const q = ((a % 6.2832) + 6.2832) * (layer ? 2.2 : 1.3);
          const el = (layer ? 0.035 : 0.06) + (layer ? 0.05 : 0.07) * (n(q) * 0.7 + n(q * 3.1) * 0.3);
          const yTop = Math.max(0, Math.floor(hz - Math.tan(el) * f0));
          const c = o.hills[layer] || o.hills[0];
          for (let y = yTop; y < top; y++) buf[y * W + x] = pack(c[0], c[1], c[2]);
        }
      }
    }
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
      const fog = o.fog === false ? 1 : Math.max(this.fogMin + 0.05, 1 - (p.depth * TILE) / this.fogDist);
      const alpha = Math.max(0, Math.min(1, (o.alpha === undefined ? 1 : o.alpha) * fog));
      if (alpha < 0.01) continue;
      const fh = frame ? frame.h : 1, fw = frame ? frame.w : 1;
      // Τα καρέ διπλής ανάλυσης (frame.hd = 2) έχουν το ίδιο μέγεθος στον κόσμο με τα απλά.
      const h = (o.h || (fh / ((frame && frame.hd) || 1)) * RC_SPX * (o.scale || 1)) * k;
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
