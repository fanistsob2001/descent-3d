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

const RC_FOV = 66 * Math.PI / 180;   // οριζόντιο οπτικό πεδίο σε οριζόντια οθόνη
const RC_EYE = 0.5;                  // ύψος των ματιών σε κελιά (οι τοίχοι έχουν ύψος 1 κελί)
const RC_MAX = 26;                   // ως πόσα κελιά μακριά ψάχνει τοίχο μια ακτίνα
const RC_TEX = 40;                   // texels ανά πλευρά υφής (1 texel = 1 μονάδα κόσμου)
const RC_RING = 10;                  // πάχος του μετώπου του κύματος (μονάδες κόσμου)
const RC_FOG = 900;                  // σε τόσες μονάδες το φως έχει πέσει στο ελάχιστο
const RC_CEIL = 0.45;                // το ταβάνι φωτίζεται λιγότερο από το δάπεδο

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
  focal: 0,           // art pixels ανά μονάδα (σε απόσταση 1 κελιού = 1 κελί)
  horizon: 0,
  // Η κάμερα του τελευταίου καρέ (για τα sprites): θέση σε κελιά, κατεύθυνση, επίπεδο.
  posX: 0, posY: 0, dirX: 1, dirY: 0, planeX: 0, planeY: 0,

  segBase: null,      // Int32Array: για κάθε (κελί, πλευρά) το πρώτο κομμάτι τοίχου του Level
  segPer: 8,
  cellLight: null,    // Float32Array: φως κάθε κελιού δαπέδου αυτό το καρέ
  tex: {},            // υφές: Uint8Array RGB (RC_TEX × RC_TEX × 3), σε "πλήρες φως"

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
    this.buildTextures();
  },

  // ---- Υφές (φτιάχνονται μία φορά, σε pixel art) ----
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
    const LIGHT = [236, 156, 98], TERRA = [206, 108, 56], DEEP = [112, 54, 30], DARK = [10, 6, 4];

    // Λαξευμένοι λίθοι: σειρές των 10 μονάδων, λίθοι των 20, μετατοπισμένοι ανά σειρά.
    // Οι αρμοί είναι η "φωτεινή ακμή" που λάμπει όταν τους βρει ήχος.
    const block = (u, v, s) => {
      const row = Math.floor(v / 10);
      const bu = (u + (row % 2) * 10) % 20, bv = v % 10;
      if (bu === 0 || bv === 0) return mul(LIGHT, 0.95);
      const id = Math.floor((u + (row % 2) * 10) / 20) + row * 7;
      let k = 0.7 + hash(id, s, 1) * 0.3 + (hash(u, v, s) - 0.5) * 0.18;
      if (bv === 1) k *= 1.3;          // πάνω ακμή κάθε λίθου, σαν ανάγλυφο
      if (bv === 9 || bu === 19) k *= 0.6;
      return mul(DEEP, k);
    };
    this.tex.blocks = make((u, v) => block(u, v, 3));

    // Παλάτι: ίδιοι λίθοι, με ζωφόρο μαιάνδρου στην κορυφή (μαύρο πάνω σε πηλό).
    this.tex.palace = make((u, v) => {
      if (v < 9) {
        if (v === 0 || v === 8) return DARK;
        if (v === 1) return mul(TERRA, 0.85);
        const m = RC_MEANDER[v - 2][u % 6];
        return m === '#' ? DARK : mul(TERRA, 0.85 + hash(u, v, 9) * 0.1);
      }
      return block(u, v, 5);
    });

    // Σπηλιά: ακανόνιστοι βράχοι (κελιά Voronoi που επαναλαμβάνονται χωρίς ραφές),
    // με φωτεινές ρωγμές ανάμεσά τους.
    const seeds = [];
    for (let k = 0; k < 5; k++) seeds.push([hash(k, 1, 2) * N, hash(k, 2, 3) * N]);
    this.tex.rock = make((u, v) => {
      let d1 = 1e9, d2 = 1e9, id = 0;
      for (let k = 0; k < seeds.length; k++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const dx = u + 0.5 - (seeds[k][0] + ox * N), dy = v + 0.5 - (seeds[k][1] + oy * N);
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < d1) { d2 = d1; d1 = d; id = k; } else if (d < d2) d2 = d;
          }
        }
      }
      const edge = d2 - d1;
      if (edge < 0.8) return mul(LIGHT, 0.72);
      // Κάθε βράχος "φουσκώνει": πιο φωτεινός στη μέση, σκοτεινός δίπλα στη ρωγμή,
      // με λίγο φως από πάνω (η πάνω πλευρά κάθε βράχου πιάνει περισσότερο).
      const bulge = Math.min(1, edge / 9);
      const k = 0.3 + bulge * 0.45 + hash(id, 4, 4) * 0.2 + (hash(u, v, 7) - 0.5) * 0.16;
      return mul(DEEP, edge < 2 ? k * 0.55 : k);
    });

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
    this.focal = Math.max((W / 2) / Math.tan(RC_FOV / 2), H * 0.4);
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

    const hasWaves = Echoes.waves.length > 0;
    if (hasWaves) this.prepareWaves();
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
        if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) break;
        if (L.opaque[ty * cols + tx] === 1) { hit = true; break; }
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
      const base = this.segBase[(ty * cols + tx) * 4 + side];
      let light = base >= 0 ? this.segLight(base + Math.min(per - 1, Math.floor(frac * per)), now) : 0;
      let glow = 0;
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

      // Η υφή δεν καθρεφτίζεται ανάλογα με την πλευρά.
      let u = Math.floor(frac * RC_TEX);
      if (side === 3 || side === 0) u = RC_TEX - 1 - u;
      const tex = this.tex[RC_THEMES[L.region[(ty * cols + tx)]] || this.regionThemeNear(tx, ty)] || this.tex.rock;
      const y0 = Math.max(0, Math.floor(top)), y1 = Math.min(H, Math.ceil(bot));
      const vStep = RC_TEX / (bot - top);
      let v = (y0 + 0.5 - top) * vStep;
      for (let y = y0; y < y1; y++, v += vStep) {
        const ti = ((v < 0 ? 0 : v >= RC_TEX ? RC_TEX - 1 : v | 0) * RC_TEX + u) * 3;
        let r = tex[ti] * light + gr, g = tex[ti + 1] * light + gg, b = tex[ti + 2] * light + gb;
        if (r > 255) r = 255;
        if (g > 255) g = 255;
        if (b > 255) b = 255;
        buf[y * W + x] = 0xff000000 | (b << 16) | (g << 8) | r;
      }
    }

    // ---- Δάπεδο και ταβάνι (γραμμή-γραμμή) ----
    const fl = this.tex.floor, ceil = this.tex.ceil;
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
        const tx = Math.floor(wx), ty = Math.floor(wy);
        if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) continue;
        const c = ty * cols + tx;
        let light = cl[c], glow = 0;
        if (hasWaves) {
          light += this.ringAt(wx * TILE, wy * TILE, true, c);
          glow = this.glow * fog;
        }
        light *= fog;
        if (light < 0.012 && glow < 0.01) continue;
        if (light > 1.4) light = 1.4;
        const u = ((wx - tx) * RC_TEX) | 0, v = ((wy - ty) * RC_TEX) | 0;
        let r, g, b;
        const t = below ? L.terrain[c] : T_FLOOR;
        if (!below) {
          const i = (v * RC_TEX + u) * 3;
          r = ceil[i]; g = ceil[i + 1]; b = ceil[i + 2];
        } else if (t === T_FLOOR) {
          const tex = fl[(tx * 7 + ty * 13) & 3];
          const i = (v * RC_TEX + u) * 3;
          r = tex[i]; g = tex[i + 1]; b = tex[i + 2];
        } else if (t === T_WATER) {
          // Σκούρο νερό με κυματάκια που κυλάνε αργά.
          const X = wx * TILE, Y = wy * TILE;
          const m = (Y + Math.sin(X * 0.12 + ripple + tx * 1.7) * 3) % 13;
          const line = Math.abs((m < 0 ? m + 13 : m) - 6.5) < 0.9;
          if (line) { r = 150; g = 78; b = 40; } else { r = 34; g = 20; b = 15; }
        } else {
          continue;   // χάσμα: μαύρο, χωρίς πάτο
        }
        r = r * light + glow * 210; g = g * light + glow * 110; b = b * light + glow * 56;
        if (r > 255) r = 255;
        if (g > 255) g = 255;
        if (b > 255) b = 255;
        buf[y * W + x] = 0xff000000 | (b << 16) | (g << 8) | r;
      }
    }

    pc.putImageData(this.img, 0, 0);
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
