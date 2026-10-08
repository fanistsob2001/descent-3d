'use strict';

// Τα χέρια του Ορφέα με τη λύρα, στο κάτω μέρος της οθόνης (πρώτο πρόσωπο).
// Το αριστερό χέρι κρατάει τον βραχίονα της λύρας, το δεξί είναι έτοιμο να χτυπήσει τις χορδές.
// Η ζωγραφιά (χέρια, ηχείο-χελώνα, βραχίονες, ζυγός) φτιάχνεται μία φορά σε pixel art, σε δύο
// στάσεις (ήρεμο / χτύπημα χορδών)· οι χορδές ζωγραφίζονται ζωντανά: όσες έχεις βρει, λάμπουν
// και τρέμουν όσο φορτίζεις κύμα, και κοκκινίζουν στο VIII πέρα από το όριο του "κοιτάζω πίσω".
// Στο σκοτάδι τα χέρια φαίνονται αχνά· τα φωτίζει η λύρα όταν παίζει, ή ένας αναμμένος βωμός.

const HANDS_W = 72, HANDS_H = 50;         // μέγεθος της ζωγραφιάς σε art pixels
const HANDS_OX = 36, HANDS_OY = 46;       // η βάση του ηχείου (κάτω-κέντρο της λύρας)
const HANDS_STRING_X = [-3, 0, 3];        // οι τρεις χορδές (ως προς το κέντρο)
const HANDS_STRING_TOP = -35, HANDS_STRING_BOT = -10;
const HANDS_PLUCK = 0.6;                  // πόσο κρατάει η "δόνηση" μετά το κύμα (δευτ.)

const Hands = {
  art: [],      // [ήρεμο, χτύπημα]: { c: καμβάς, s: σιλουέτα (μαύρη, για το σκοτάδι) }

  init() {
    this.hold = this.buildHold();
    this.art = [false, true].map((pluck) => this.build(pluck));
    // Διπλή ανάλυση με σκίαση (όπως οι μορφές): λείες γραμμές, όγκος στα χέρια.
    this.artHD = this.art.map((a) => ({ c: Sprites.hdify(a.c), s: Sprites.hdify(a.s) }));
  },

  build(pluck) {
    const W = HANDS_W, H = HANDS_H;
    const px = new Array(W * H).fill(null);
    const C = (k) => SPR_PAL[k];
    const set = (x, y, col) => {
      x = Math.round(x + HANDS_OX); y = Math.round(y + HANDS_OY);
      if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = col;
    };
    // Χοντρή γραμμή (πήχης του χεριού): από (x0,y0) ως (x1,y1), πάχος t, με σκιά στην κάτω πλευρά
    // και λευκό χιτώνα (μανίκι) στο κομμάτι που φτάνει στην άκρη της οθόνης.
    const forearm = (x0, y0, x1, y1, t) => {
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
      const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny);
      for (let i = 0; i <= n; i++) {
        const f = i / n, cx = x0 + (x1 - x0) * f, cy = y0 + (y1 - y0) * f;
        for (let k = -t / 2; k <= t / 2; k += 0.5) {
          const sleeve = f > 0.55;
          const shade = k > t / 2 - 1.5;
          const col = sleeve ? C(shade ? 'W' : 'w') : C(shade ? 'S' : 's');
          set(cx + (nx / nl) * k, cy + (ny / nl) * k, col);
        }
      }
    };

    // Οι πήχεις, πίσω από τη λύρα.
    forearm(-13, -24, -42, 12, 7);
    forearm(pluck ? 6 : 8, -12, 40, 12, 7);

    // Το ηχείο: καβούκι χελώνας (έλλειψη με εξάγωνα "λέπια"), χρυσό χείλος.
    for (let y = -14; y <= 0; y++) {
      for (let x = -12; x <= 12; x++) {
        const e = (x / 11.5) ** 2 + ((y + 7) / 7.2) ** 2;
        if (e > 1) continue;
        let col;
        if (e > 0.78) col = C('Y');
        else if (((Math.floor((x + 20) / 4) + Math.floor((y + 20) / 3)) & 1) === 0) col = C('O');
        else col = C('o');
        if (e <= 0.78 && ((x + 20) % 4 === 0 || (y + 20) % 3 === 0)) col = C('d');   // αρμοί των λεπιών
        set(x, y, col);
      }
    }
    // Ο καβαλάρης (εκεί που δένουν οι χορδές).
    for (let x = -6; x <= 6; x++) { set(x, -10, C('b')); set(x, -9, C('O')); }

    // Οι δύο βραχίονες: κέρατα που ανοίγουν και ξανακλείνουν, χρυσά με φωτεινή εσωτερική ακμή.
    for (let t = 0; t <= 1; t += 0.01) {
      const y = -12 - 26 * t;
      const xo = 8 + 5 * Math.sin(t * Math.PI) - t;
      for (const sd of [-1, 1]) {
        set(sd * xo, y, C('Y'));
        set(sd * (xo + 1), y, C('Y'));
        set(sd * (xo - 1), y, C('y'));
      }
    }
    // Ο ζυγός πάνω, με "κόμβους" στις άκρες.
    for (let x = -10; x <= 10; x++) { set(x, -37, C('y')); set(x, -36, C('Y')); }
    for (const sd of [-1, 1]) for (let y = -39; y <= -34; y++) { set(sd * 11, y, C('Y')); set(sd * 12, y, C('Y')); }

    // Αριστερό χέρι: τυλιγμένο γύρω από τον βραχίονα (τα δάχτυλα μπροστά του).
    for (let y = -31; y <= -23; y++) {
      for (let x = -17; x <= -10; x++) {
        if ((x === -17 || x === -10) && (y === -31 || y === -23)) continue;   // στρογγυλεμένες γωνίες
        set(x, y, C(x >= -12 && (y + 31) % 2 === 1 ? 'S' : 's'));         // χαραγματιές ανάμεσα στα δάχτυλα
      }
    }
    set(-9, -29, C('s')); set(-9, -27, C('s')); set(-9, -25, C('s'));      // άκρες δαχτύλων
    // Δεξί χέρι: στο ηχείο, με τα δάχτυλα προς τις χορδές (στο χτύπημα: πάνω από τις χορδές).
    const hx = pluck ? -2 : 1;
    for (let y = -18; y <= -11; y++) {
      for (let x = 5; x <= 11; x++) {
        if ((x === 11) && (y === -18 || y === -11)) continue;
        set(x + (pluck ? -2 : 0), y, C(y === -11 ? 'S' : 's'));
      }
    }
    for (let x = hx; x <= 4; x++) { set(x, -16, C('s')); set(x, -14, C('s')); }   // δείκτης και μέσος
    set(hx, -15, C('S'));

    // Περίγραμμα 1 pixel γύρω από όλα (όπως στα sprites), και η μαύρη σιλουέτα.
    const out = px.slice();
    const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && px[y * W + x] !== null;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (px[y * W + x] === null && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) {
          out[y * W + x] = '26,12,6';
        }
      }
    }
    const make = (shadow) => {
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const c = cv.getContext('2d');
      const img = c.createImageData(W, H);
      for (let i = 0; i < out.length; i++) {
        if (out[i] === null) continue;
        const [r, g, b] = out[i].split(',').map(Number);
        img.data[i * 4] = shadow ? 0 : r;
        img.data[i * 4 + 1] = shadow ? 0 : g;
        img.data[i * 4 + 2] = shadow ? 0 : b;
        img.data[i * 4 + 3] = 255;
      }
      c.putImageData(img, 0, 0);
      return cv;
    };
    return { c: make(false), s: make(true) };
  },

  // Το δεξί χέρι μόνο του (όταν κρατάς κάτι άλλο από τη λύρα): πήχης από κάτω δεξιά, με λευκό μανίκι,
  // και μια γροθιά με την παλάμη προς τα πάνω (εκεί κάθεται το αντικείμενο). 44×40 art pixels.
  buildHold() {
    const W = 44, H = 40;
    const px = new Array(W * H).fill(null);
    const C = (k) => SPR_PAL[k];
    const set = (x, y, col) => {
      x = Math.round(x); y = Math.round(y);
      if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = col;
    };
    // Ο πήχης: από την κάτω δεξιά γωνία ως την παλάμη.
    const x0 = 40, y0 = 42, x1 = 18, y1 = 20, t = 9;
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
    const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny);
    for (let i = 0; i <= n; i++) {
      const f = i / n, cx = x0 + (x1 - x0) * f, cy = y0 + (y1 - y0) * f;
      for (let k = -t / 2; k <= t / 2; k += 0.5) {
        const sleeve = f < 0.45, shade = k > t / 2 - 2;
        set(cx + (nx / nl) * k, cy + (ny / nl) * k, sleeve ? C(shade ? 'W' : 'w') : C(shade ? 'S' : 's'));
      }
    }
    // Η παλάμη (ανοιχτή, προς τα πάνω) και τα δάχτυλα που κλείνουν γύρω από το αντικείμενο.
    for (let y = 14; y <= 22; y++) {
      for (let x = 8; x <= 24; x++) {
        const e = ((x - 16) / 8.5) ** 2 + ((y - 19) / 4.2) ** 2;
        if (e > 1) continue;
        set(x, y, C(y > 20 ? 'S' : 's'));
      }
    }
    for (const fx of [9, 12, 15]) for (let y = 13; y <= 16; y++) set(fx, y, C(y === 13 ? 's' : 'S'));   // δάχτυλα
    for (let x = 21; x <= 24; x++) set(x, 15, C('s'));   // ο αντίχειρας
    const out = px.slice();
    const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && px[y * W + x] !== null;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (px[y * W + x] === null && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) out[y * W + x] = '26,12,6';
    }
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const img = c.createImageData(W, H);
    out.forEach((v, i) => {
      if (v === null) return;
      const [r, g, b] = v.split(',').map(Number);
      img.data.set([r, g, b, 255], i * 4);
    });
    c.putImageData(img, 0, 0);
    return { c: Sprites.hdify(cv), w: W, h: H, palmX: 16, palmY: 15 };
  },

  // Το χέρι με αυτό που κρατάς (εικονίδιο από το Inventory). o: { light, walkPhase, walkSpeed, thrown (0..1:
  // πόσο πρόσφατα το πέταξες — το χέρι τινάζεται μπροστά και το αντικείμενο λείπει για λίγο) }.
  drawHeld(pc, W, H, now, icon, o) {
    const kh = Math.max(1, Math.round(Math.min(H, W * 0.75) / 216));
    const k = 2 * kh;
    const idle = 1 - Math.min(1, o.walkSpeed * 2);
    const sway = Math.sin(o.walkPhase) * o.walkSpeed * 2.5 + Math.sin(now * 0.9) * 0.6 * idle;
    const bob = (1 - Math.cos(o.walkPhase * 2)) * o.walkSpeed * 1.5 + (0.5 + 0.5 * Math.sin(now * 1.6)) * 1.1 * idle;
    const th = o.thrown > 0 ? Math.sin(Math.min(1, o.thrown) * Math.PI) : 0;
    const hd = this.hold;
    const x0 = Math.round(W * 0.62 + (sway - th * 6) * k);
    const y0 = Math.round(H - hd.h * k + (bob + 4 - th * 8) * k);
    const bright = Math.min(1, 0.35 + o.light * 0.65);
    pc.save();
    pc.setTransform(1, 0, 0, 1, 0, 0);
    pc.imageSmoothingEnabled = false;
    pc.filter = bright < 0.99 ? 'brightness(' + bright.toFixed(2) + ')' : 'none';
    pc.drawImage(hd.c, x0, y0, hd.w * k, hd.h * k);
    // Το αντικείμενο στην παλάμη (ξαναεμφανίζεται λίγο μετά το πέταγμα).
    // Ο δαυλός που καίει: η φλόγα πάνω από το χέρι (προσθετικό φως).
    if (o.flame) {
      const fh = 30 * k, fw = (fh * o.flame.width) / o.flame.height;
      pc.filter = 'none';
      pc.globalCompositeOperation = 'lighter';
      pc.drawImage(o.flame, Math.round(x0 + hd.palmX * k - fw / 2), Math.round(y0 + hd.palmY * k - fh - 8 * k), Math.round(fw), Math.round(fh));
      pc.globalCompositeOperation = 'source-over';
    }
    if (icon && !(o.thrown > 0 && o.thrown < 0.7)) {
      // ~14 pixels της ζωγραφιάς του χεριού το πιο μεγάλο του μέγεθος.
      const s = (14 * k) / Math.max(icon.width, icon.height);
      const iw = icon.width * s, ih = icon.height * s;
      pc.drawImage(icon, Math.round(x0 + hd.palmX * k - iw / 2), Math.round(y0 + hd.palmY * k - ih + k), Math.round(iw), Math.round(ih));
    }
    pc.filter = 'none';
    pc.restore();
  },

  // o: { strings (0..3), charge (0..1), charging, pluck (0..1: πόσο πρόσφατο ήταν το κύμα),
  //      cancel (0..1: μόλις ακυρώθηκε), warn (κόκκινο: θα σήμαινε "κοιτάζω πίσω"), warnNear (0..1:
  //      πλησιάζει το όριο), light (0..1: φως από τον χώρο, π.χ. βωμός), walkPhase, walkSpeed, melody (0..1) }
  draw(pc, W, H, now, o) {
    // Μέγεθος: ακέραια μεγέθυνση ανάλογα με την ανάλυση (PC ~270 γραμμές → 2, κινητό οριζόντια → 1).
    // Σε διπλή ανάλυση: kh art px ανά pixel της HD ζωγραφιάς (k = 2·kh στις συντεταγμένες της απλής).
    // Μεγάλα, όπως το χέρι με το όπλο στα retro dungeon crawlers (~1/3 της οθόνης).
    const kh = Math.max(1, Math.round(Math.min(H, W * 0.75) / 216));
    const k = 2 * kh;
    const c = o.charging ? o.charge : 0;
    // Κίνηση: ταλαντεύεται με τα βήματα, σηκώνεται λίγο όσο φορτίζεις.
    // Όταν στέκεσαι: αργή "ανάσα" (τα χέρια ανεβοκατεβαίνουν λίγο), όπως στα FPS.
    const idle = 1 - Math.min(1, o.walkSpeed * 2);
    const sway = Math.sin(o.walkPhase) * o.walkSpeed * 2.5 + Math.sin(now * 0.9) * 0.6 * idle;
    const bob = (1 - Math.cos(o.walkPhase * 2)) * o.walkSpeed * 1.5 + (0.5 + 0.5 * Math.sin(now * 1.6)) * 1.1 * idle;
    const lift = c * 4 + o.pluck * 2;
    const x0 = Math.round(W / 2 - HANDS_OX * k + sway * k);
    const y0 = Math.round(H - HANDS_H * k + (bob - lift + 3) * k);

    // Πόσο φωτεινά φαίνονται: αχνά στο σκοτάδι, φωτεινά όταν παίζει η λύρα.
    const bright = Math.min(1, 0.3 + o.light * 0.6 + c * 0.55 + o.pluck * 0.6 + o.melody * 0.7);
    const art = this.artHD[o.pluck > 0.35 ? 1 : 0];
    pc.save();
    pc.setTransform(1, 0, 0, 1, 0, 0);
    pc.imageSmoothingEnabled = false;
    pc.globalAlpha = 1;
    pc.globalCompositeOperation = 'source-over';
    pc.drawImage(art.c, x0, y0, HANDS_W * k, HANDS_H * k);
    if (bright < 1) {
      pc.globalAlpha = 1 - bright;
      pc.drawImage(art.s, x0, y0, HANDS_W * k, HANDS_H * k);
      pc.globalAlpha = 1;
    }

    // Οι χορδές.
    const ox = x0 + HANDS_OX * k, oy = y0 + HANDS_OY * k;
    const vib = Math.max(c, o.pluck) * (1 - o.cancel);
    // Χρώμα: κρεμ που φωτίζει όσο φορτίζεις· κόκκινο (παλλόμενο) όταν θα σήμαινε "κοιτάζω πίσω".
    const pulse = 0.5 + 0.5 * Math.sin(now * (8 + c * 16));
    let col = [255, 246, 210];
    const red = o.warn ? 1 : o.warnNear * 0.7;
    col = col.map((v, i) => v + ([255, 50, 34][i] - v) * red);
    // Στο cooldown (μόλις έπαιξε) οι χορδές είναι σβηστές και ξαναφωτίζουν σιγά σιγά.
    const sb = Math.min(1, 0.35 + bright * 0.3 + c * 0.6 + o.pluck * 0.6 + (o.warn ? 0.3 * pulse : 0)) * (1 - o.cancel * 0.6) * (1 - (o.cool || 0) * 0.6);
    const n = Math.min(3, o.strings);
    if (n > 0) {
      // Λάμψη γύρω από τις χορδές (προσθετική).
      const ga = (c * 0.32 + o.pluck * 0.4 + o.melody * 0.35 + (o.warn ? 0.2 * pulse : 0)) * (1 - o.cancel);
      if (ga > 0.01) {
        const gy = oy - 22 * k, R = 26 * k;
        const g = pc.createRadialGradient(ox, gy, 0, ox, gy, R);
        const gc = o.melody > red ? POT.light : `${col[0] | 0},${col[1] | 0},${col[2] | 0}`;
        g.addColorStop(0, `rgba(${gc},${ga.toFixed(3)})`);
        g.addColorStop(1, `rgba(${gc},0)`);
        pc.globalCompositeOperation = 'lighter';
        pc.fillStyle = g;
        pc.fillRect(ox - R, gy - R, R * 2, R * 2);
        pc.globalCompositeOperation = 'source-over';
      }
      pc.fillStyle = `rgb(${(col[0] * sb) | 0},${(col[1] * sb) | 0},${(col[2] * sb) | 0})`;
      for (let i = 0; i < n; i++) {
        const sx = HANDS_STRING_X[i];
        for (let y = HANDS_STRING_TOP; y < HANDS_STRING_BOT; y++) {
          // Η δόνηση: μεγαλύτερη στη μέση της χορδής, μηδέν στις άκρες.
          const mid = Math.sin(((y - HANDS_STRING_TOP) / (HANDS_STRING_BOT - HANDS_STRING_TOP)) * Math.PI);
          const dx = Math.round(Math.sin(now * (50 + i * 9) + y * 0.9) * vib * mid * 1.3);
          pc.fillRect(ox + (sx + dx) * k + (k - kh) / 2, oy + y * k, kh, k);
        }
      }
    }
    pc.restore();
  },
};
