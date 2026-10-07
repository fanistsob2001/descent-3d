'use strict';

// Pixel art (STORY.md, ενότητα 6): ο κόσμος ζωγραφίζεται σε έναν μικρό καμβά (π.χ.
// ~195×422 σε κινητό) και μεγαλώνει χωρίς εξομάλυνση, οπότε κάθε "pixel" της
// ζωγραφιάς γίνεται ένα καθαρό τετράγωνο. Πριν μεγαλώσει, τα χρώματα κβαντίζονται
// σε λίγα επίπεδα με διάχυση Bayer 4×4 (ordered dithering), όπως στις παλιές κονσόλες:
// οι λάμψεις και οι σκιάσεις γίνονται "κουκκιδωτές" διαβαθμίσεις.
const PIXEL_TARGET = 200;    // περίπου πόσα art pixels χωράνε στη μικρή πλευρά της οθόνης (κινητό)
const PIXEL_TARGET_PC = 210; // στο PC: χοντρά pixels, όπως στα retro dungeon crawlers (π.χ. 384×216 σε 1080p)
const PIXEL_LEVELS = 9;      // επίπεδα ανά κανάλι χρώματος (λιγότερα = πιο "8-bit")
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// Η παλέτα του 3D κόσμου: κάθε pixel γίνεται το πλησιέστερο από αυτά τα χρώματα, χωρίς
// dithering — επίπεδα χρώματα, όπως στα retro dungeon crawlers (και στις εικόνες αναφοράς
// του χρήστη). Ζεστά μόνο: μαύρο, μπορντό, καφέ/χακί, πηλός/πορτοκαλί, κρεμ, κόκκινο, χρυσό.
const PALETTE = [
  [0, 0, 0], [16, 7, 5], [30, 12, 9], [48, 16, 12], [70, 20, 15], [96, 26, 19], [124, 36, 25],
  [38, 24, 15], [62, 40, 25], [92, 66, 42], [128, 100, 66], [170, 142, 100], [212, 190, 146],
  [158, 64, 30], [198, 98, 40], [232, 138, 54], [248, 182, 100],
  [236, 218, 186], [255, 246, 228],
  [140, 18, 12], [200, 34, 22], [255, 84, 56],
  [222, 172, 58], [168, 120, 40],
  [206, 134, 92], [150, 90, 60],
];

const Pixel = {
  canvas: null,
  ctx: null,
  w: 0,          // πλάτος σε art pixels
  h: 0,
  px: 2,         // πόσα CSS pixels είναι ένα art pixel
  dither: true,
  _lut: null,    // [16][256]: κβαντισμένη τιμή για κάθε κατώφλι Bayer και κάθε τιμή καναλιού
  _pal: null,    // Uint32Array(32768): για κάθε χρώμα (5 bits ανά κανάλι) το πλησιέστερο της PALETTE

  init() {
    this.canvas = document.createElement('canvas');
    // willReadFrequently: ο καμβάς μένει στη μνήμη (όχι στην κάρτα γραφικών), οπότε το
    // getImageData της κβάντισης κάθε καρέ είναι φθηνό.
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    // Πίνακες κβάντισης: κάθε κανάλι σε PIXEL_LEVELS επίπεδα, με κατώφλι ανά θέση Bayer.
    // Η κβάντιση γίνεται σε "γάμμα" χώρο: περισσότερα επίπεδα στα σκούρα, ώστε το
    // σκοτάδι να μένει καθαρό και να μη γεμίζει κόκκους.
    const L = PIXEL_LEVELS;
    this._lut = BAYER4.map((b) => {
      const off = (b / 16 - 0.5) / L;
      const t = new Uint8ClampedArray(256);
      for (let v = 0; v < 256; v++) {
        const g = Math.pow(v / 255, 1 / 2.2);
        const q = Math.round(Math.max(0, Math.min(1, g + off)) * L) / L;
        t[v] = v < 4 ? 0 : Math.round(Math.pow(q, 2.2) * 255);
      }
      return t;
    });
    // Πίνακας παλέτας: για κάθε χρώμα 15-bit, το πλησιέστερο της PALETTE (με βάρη για το μάτι).
    this._pal = new Uint32Array(32768);
    for (let i = 0; i < 32768; i++) {
      const r = ((i >> 10) & 31) * 8 + 4, g = ((i >> 5) & 31) * 8 + 4, b = (i & 31) * 8 + 4;
      let best = 0, bd = Infinity;
      for (let k = 0; k < PALETTE.length; k++) {
        const p = PALETTE[k];
        const dr = r - p[0], dg = g - p[1], db = b - p[2];
        const d = 3 * dr * dr + 4 * dg * dg + 2 * db * db;
        if (d < bd) { bd = d; best = k; }
      }
      const p = PALETTE[best];
      this._pal[i] = 0xff000000 | (p[2] << 16) | (p[1] << 8) | p[0];
    }
  },

  // Όλος ο μικρός καμβάς στην παλέτα (επίπεδα χρώματα, χωρίς dithering).
  posterize() {
    const img = this.ctx.getImageData(0, 0, this.w, this.h);
    const d = new Uint32Array(img.data.buffer), pal = this._pal;
    for (let i = 0; i < d.length; i++) {
      const p = d[i];
      if ((p & 0xffffff) === 0) continue;
      d[i] = pal[((p & 0xf8) << 7) | ((p >> 6) & 0x3e0) | ((p >> 19) & 31)];
    }
    this.ctx.putImageData(img, 0, 0);
  },

  // target = πόσα art pixels στη μικρή πλευρά (PC: περισσότερα, για περισσότερη λεπτομέρεια).
  resize(cssW, cssH, target = PIXEL_TARGET) {
    this.px = Math.max(2, Math.round(Math.min(cssW, cssH) / target));
    this.w = Math.ceil(cssW / this.px);
    this.h = Math.ceil(cssH / this.px);
    this.canvas.width = this.w;
    this.canvas.height = this.h;
  },

  // Καθαρίζει τον μικρό καμβά και τον δίνει για ζωγραφική (συντεταγμένες σε art pixels).
  begin() {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.fillStyle = '#000';
    c.fillRect(0, 0, this.w, this.h);
    return c;
  },

  // Bloom: ό,τι λάμπει "ξεχειλίζει" απαλά γύρω του. Ο καμβάς μικραίνει στο 1/4, πολλαπλασιάζεται
  // με τον εαυτό του (τα σκοτεινά σβήνουν, μένουν μόνο τα φωτεινά), θολώνει, και ξαναμπαίνει
  // από πάνω προσθετικά. Γίνεται πριν από την κβάντιση, οπότε η λάμψη βγαίνει κι αυτή "κουκκιδωτή".
  // lights = [{ x, y (art px), a (0..1) }]: πηγές φωτός (φλόγες, έξοδος) — από αυτές απλώνονται
  // ακτίνες (god rays): η φωτεινή περιοχή γύρω από την πηγή "σέρνεται" ακτινωτά προς τα έξω, οπότε
  // ό,τι μπαίνει μπροστά της (κολόνες, ακμές) αφήνει σκοτεινές λωρίδες.
  bloom(strength = 0.5, lights = []) {
    if (!this.canvas.width || !this.canvas.height) return;   // π.χ. σε κρυφό παράθυρο χωρίς μέγεθος
    const w = Math.max(1, Math.ceil(this.w / 4)), h = Math.max(1, Math.ceil(this.h / 4));
    if (!this._bloom || this._bloom.width !== w || this._bloom.height !== h) {
      const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
      this._bloom = mk();
      this._bloom2 = mk();
      this._rays = mk();
      this._rays2 = mk();
    }
    const b = this._bloom.getContext('2d'), b2 = this._bloom2.getContext('2d');
    b.globalCompositeOperation = 'source-over';
    b.imageSmoothingEnabled = true;
    b.drawImage(this.canvas, 0, 0, w, h);
    b.globalCompositeOperation = 'multiply';
    b.drawImage(this._bloom, 0, 0);
    b.globalCompositeOperation = 'source-over';
    b2.clearRect(0, 0, w, h);
    b2.filter = 'blur(1.5px)';
    b2.drawImage(this._bloom, 0, 0);
    b2.filter = 'none';
    const c = this.ctx;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = strength;
    c.imageSmoothingEnabled = true;
    c.drawImage(this._bloom2, 0, 0, this.w, this.h);

    // Ακτίνες φωτός από τις πηγές (το πολύ 3): μόνο η φωτεινή περιοχή γύρω από κάθε πηγή,
    // σερνόμενη ακτινωτά προς τα έξω σε 9 βήματα που σβήνουν.
    if (lights.length > 0) {
      const r = this._rays.getContext('2d'), acc = this._rays2.getContext('2d');
      acc.globalCompositeOperation = 'source-over';
      acc.clearRect(0, 0, w, h);
      for (const L of lights.slice(0, 3)) {
        const lx = L.x / 4, ly = L.y / 4, R = Math.max(4, h * 0.22);
        r.globalCompositeOperation = 'source-over';
        r.clearRect(0, 0, w, h);
        r.save();
        r.beginPath();
        r.arc(lx, ly, R, 0, Math.PI * 2);
        r.clip();
        r.drawImage(this._bloom, 0, 0);
        r.restore();
        acc.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 9; i++) {
          const s = 1 + i * 0.1;
          acc.globalAlpha = Math.min(1, L.a) * 0.42 * (1 - i / 9);
          acc.drawImage(this._rays, lx - lx * s, ly - ly * s, w * s, h * s);
        }
        acc.globalAlpha = 1;
      }
      c.globalAlpha = strength;
      c.drawImage(this._rays2, 0, 0, this.w, this.h);
    }
    c.restore();
  },

  // Η ίδια κβάντιση, κατευθείαν σε έναν buffer pixels (Uint32, ABGR) — χωρίς getImageData /
  // putImageData. Τη χρησιμοποιεί ο raycaster πριν βάλει την εικόνα στον καμβά.
  quantizeBuf(d, w, h) {
    const lut = this._lut;
    for (let y = 0, i = 0; y < h; y++) {
      const row = (y & 3) * 4;
      for (let x = 0; x < w; x++, i++) {
        const p = d[i];
        if ((p & 0xffffff) === 0) continue;
        const t = lut[row + (x & 3)];
        d[i] = (p & 0xff000000) | (t[(p >> 16) & 255] << 16) | (t[(p >> 8) & 255] << 8) | t[p & 255];
      }
    }
  },

  // Κβάντιση με dithering (μόνο στα pixels που δεν είναι εντελώς μαύρα — τα περισσότερα είναι).
  quantize() {
    const img = this.ctx.getImageData(0, 0, this.w, this.h);
    // Ένα pixel = ένα Uint32 (ABGR): ένας έλεγχος για το μαύρο και μία εγγραφή ανά pixel.
    const d = new Uint32Array(img.data.buffer), w = this.w, lut = this._lut;
    for (let y = 0, i = 0; y < this.h; y++) {
      const row = (y & 3) * 4;
      for (let x = 0; x < w; x++, i++) {
        const p = d[i];
        if ((p & 0xffffff) === 0) continue;
        const t = lut[row + (x & 3)];
        d[i] = (p & 0xff000000) | (t[(p >> 16) & 255] << 16) | (t[(p >> 8) & 255] << 8) | t[p & 255];
      }
    }
    this.ctx.putImageData(img, 0, 0);
  },

  // Μεταφέρει τον μικρό καμβά στον κανονικό, μεγεθυμένο με καθαρά τετράγωνα pixels.
  // (ox, oy) = μετατόπιση σε art pixels (π.χ. τίναγμα της οθόνης).
  // dither = false: ο κόσμος έχει ήδη κβαντιστεί (π.χ. από τον raycaster).
  // dither: true = Bayer (μενού, χάρτης, jump scare), false = τίποτα, 'palette' = η παλέτα του 3D κόσμου.
  present(mainCtx, dpr, ox = 0, oy = 0, dither = this.dither) {
    if (dither === 'palette') this.posterize();
    else if (dither) this.quantize();
    const k = this.px * dpr;
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    mainCtx.imageSmoothingEnabled = false;
    mainCtx.drawImage(this.canvas, 0, 0, this.w, this.h,
      Math.round(ox * k), Math.round(oy * k), this.w * k, this.h * k);
    mainCtx.imageSmoothingEnabled = true;
  },
};
