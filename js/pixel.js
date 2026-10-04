'use strict';

// Pixel art (STORY.md, ενότητα 6): ο κόσμος ζωγραφίζεται σε έναν μικρό καμβά (π.χ.
// ~195×422 σε κινητό) και μεγαλώνει χωρίς εξομάλυνση, οπότε κάθε "pixel" της
// ζωγραφιάς γίνεται ένα καθαρό τετράγωνο. Πριν μεγαλώσει, τα χρώματα κβαντίζονται
// σε λίγα επίπεδα με διάχυση Bayer 4×4 (ordered dithering), όπως στις παλιές κονσόλες:
// οι λάμψεις και οι σκιάσεις γίνονται "κουκκιδωτές" διαβαθμίσεις.
const PIXEL_TARGET = 200;    // περίπου πόσα art pixels χωράνε στη μικρή πλευρά της οθόνης (κινητό)
const PIXEL_TARGET_PC = 290; // στο PC: περισσότερη λεπτομέρεια (π.χ. 480×270 σε οθόνη 1080p)
const PIXEL_LEVELS = 9;      // επίπεδα ανά κανάλι χρώματος (λιγότερα = πιο "8-bit")
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const Pixel = {
  canvas: null,
  ctx: null,
  w: 0,          // πλάτος σε art pixels
  h: 0,
  px: 2,         // πόσα CSS pixels είναι ένα art pixel
  dither: true,
  _lut: null,    // [16][256]: κβαντισμένη τιμή για κάθε κατώφλι Bayer και κάθε τιμή καναλιού

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
  bloom(strength = 0.5) {
    const w = Math.max(1, Math.ceil(this.w / 4)), h = Math.max(1, Math.ceil(this.h / 4));
    if (!this._bloom || this._bloom.width !== w || this._bloom.height !== h) {
      this._bloom = document.createElement('canvas');
      this._bloom.width = w;
      this._bloom.height = h;
      this._bloom2 = document.createElement('canvas');
      this._bloom2.width = w;
      this._bloom2.height = h;
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
  present(mainCtx, dpr, ox = 0, oy = 0, dither = this.dither) {
    if (dither) this.quantize();
    const k = this.px * dpr;
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    mainCtx.imageSmoothingEnabled = false;
    mainCtx.drawImage(this.canvas, 0, 0, this.w, this.h,
      Math.round(ox * k), Math.round(oy * k), this.w * k, this.h * k);
    mainCtx.imageSmoothingEnabled = true;
  },
};
