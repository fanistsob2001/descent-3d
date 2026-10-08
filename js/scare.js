'use strict';

// Jump scare: το πρόσωπο του τέρατος που σε έπιασε, σε pixel art — το ίδιο τέρας με τα
// sprites του παιχνιδιού, από πολύ κοντά (SCARE_KINDS: η σκιά με λευκά μάτια, η Ερινύα με
// φίδια στα μαλλιά, κίτρινα μάτια και φτερά). Ορμάει από το σκοτάδι, το στόμα ανοίγει,
// χέρια με νύχια σε αρπάζουν από κάτω, η εικόνα "σπάει" σαν χαλασμένο σήμα και στο τέλος
// τα μάτια φλέγονται.
// Ζωγραφίζεται στον μικρό καμβά του Pixel (σε art pixels), όπως όλος ο κόσμος.
const SCARE_TIME = 0.65;    // συνολική διάρκεια (δευτ.)
const SCARE_LUNGE = 0.3;    // ώσπου να γεμίσει την οθόνη το πρόσωπο

// Τα πρόσωπα "ζωγραφίζονται" με το paintGrid (js/sprites.js) σε μεγάλη λεπτομέρεια και μετά
// περνάνε από Sprites.hdify (διπλή ανάλυση με σκίαση) — στο ίδιο στυλ με τις μορφές του 3D.
// m = στόμα: 0 κλειστό, 1 μισάνοιχτο, 2 ορθάνοιχτο. Τα μάτια = 'E' (σκιά) / 'y' (Ερινύα).

// Η σκιά: κρανίο μέσα σε κουκούλα, κόγχες με λευκά μάτια, μαύρα "δάκρυα", ρωγμές· το σαγόνι
// κατεβαίνει και αποκαλύπτει κόκκινο φως και μακριά δόντια.
function scareShadeFace(m) {
  return paintGrid(46, 56, (p) => {
    p.ellipse(23, 25, 22, 26, 'k');                     // κουκούλα
    p.ellipse(23, 28, 17, 21, 'K');                     // σκοτάδι μέσα της
    p.ellipse(23, 27, 12.5, 14, 'I');                   // κρανίο (σκιά στο περίγραμμα)
    p.ellipse(22.5, 26, 11, 12.5, 'i');
    p.ellipse(17.5, 25, 3.8, 3.4, 'N');                 // κόγχη
    p.ellipse(17.5, 25, 1.3, 1.3, 'E');                 // μάτι
    p.line(13, 20.5, 20, 21.5, 1, 'I');                 // φρύδι
    p.line(17.5, 28.5, 16.5, 36, 1, 'N');               // μαύρο δάκρυ
    p.line(14, 14, 17, 18, 1, 'I'); p.line(17, 18, 16, 21, 1, 'I');   // ρωγμή
    p.line(12, 27, 14, 31, 1, 'I');                     // ζυγωματικό
    p.mirror();
    p.poly([[21.5, 30], [24.5, 30], [23, 33.5]], 'N');  // μύτη
    if (m === 0) {
      p.line(15, 36, 31, 36, 1, 'N');
      for (let x = 15; x <= 31; x += 2) p.line(x, 34.5, x, 37.5, 1, 'I');
    } else if (m === 1) {
      p.poly([[15, 35], [31, 35], [29, 41], [17, 41]], 'N');
      p.ellipse(23, 40, 4, 1.5, 'r');
      for (let x = 16; x <= 30; x += 2) { p.px(x, 35, 'i'); p.px(x, 36, 'i'); p.px(x + 1, 40, 'i'); }
    } else {
      p.poly([[13, 34], [33, 34], [31, 48], [15, 48]], 'N');                    // ορθάνοιχτο
      p.ellipse(23, 42, 6, 4, 'R'); p.ellipse(23, 42, 3.5, 2.2, 'r');            // κόκκινο φως
      for (let x = 14; x <= 31; x += 3) { p.line(x, 34, x + 1, 38.5, 1, 'i'); p.line(x + 1, 48, x + 1.5, 43.5, 1, 'i'); }
      p.poly([[14, 48], [32, 48], [29, 53], [17, 53]], 'i');                    // κάτω σαγόνι
      p.line(17, 53, 29, 53, 1, 'I');
    }
  });
}

// Η Ερινύα: χλωμό, άγριο γυναικείο πρόσωπο, κίτρινα μάτια, φίδια αντί για μαλλιά (f = καρέ
// που σφαδάζουν), στόμα με κυνόδοντες που ουρλιάζει.
function scareErinysFace(m, f) {
  return paintGrid(48, 60, (p) => {
    // Φίδια-μαλλιά (αριστερά, μετά καθρέφτισμα).
    const snakes = [[20, 14, 12, 2], [17, 16, 5, 8], [15, 20, 2, 20], [16, 26, 3, 34], [22, 12, 20, 0], [18, 13, 9, 0]];
    snakes.forEach(([x0, y0, x1, y1], i) => {
      const w = (i + f) % 2 ? 2 : -2;
      const mx = (x0 + x1) / 2 + w, my = (y0 + y1) / 2 - w;
      p.line(x0, y0, mx, my, 2, 'g'); p.line(mx, my, x1, y1, 2, 'G');
      p.ellipse(x1, y1, 1.8, 1.4, 'g'); p.px(x1, y1 - 0.5, 'y'); p.px(x1 - 2, y1 + 1, 't');
    });
    p.ellipse(24, 30, 13, 17, 'P');                     // πρόσωπο
    p.ellipse(18, 37, 3, 4, 'S');                       // βυθισμένο μάγουλο
    p.line(13, 22, 21, 25.5, 2, 'N');                   // θυμωμένο φρύδι
    p.ellipse(18.5, 28, 3.6, 2.4, 'N');                 // μάτι
    p.ellipse(18.5, 28, 1.6, 1.4, 'y'); p.px(18.5, 28, 'Y');
    p.line(16, 31.5, 20, 31, 1, 'S');                   // σακούλες κάτω από τα μάτια
    p.mirror();
    p.line(24, 30, 23, 36, 1, 'S'); p.line(22, 36.5, 26, 36.5, 1, 'S');   // μύτη
    if (m === 0) {
      p.line(18, 41, 30, 41, 1, 'R'); p.px(20, 42, 'i'); p.px(28, 42, 'i');
    } else if (m === 1) {
      p.poly([[17, 40], [31, 40], [29, 45], [19, 45]], 'N');
      p.px(19, 40.5, 'i'); p.px(29, 40.5, 'i'); p.line(19, 41, 19, 43, 1, 'i'); p.line(29, 41, 29, 43, 1, 'i');
      p.ellipse(24, 44, 3, 1, 'R');
    } else {
      p.poly([[15, 38], [33, 38], [30, 51], [18, 51]], 'N');
      p.ellipse(24, 47, 4, 2.5, 'R');
      p.line(17.5, 38, 18.5, 44, 2, 'i'); p.line(30.5, 38, 29.5, 44, 2, 'i');  // κυνόδοντες
      for (let x = 20; x <= 28; x += 2) p.px(x, 38.5, 'i');
      p.line(26, 46, 31, 47, 1, 't'); p.px(32, 46, 't'); p.px(32, 48, 't');    // γλώσσα φιδιού
      p.poly([[16, 51], [32, 51], [28, 55], [20, 55]], 'P');                   // σαγόνι
    }
  });
}

// Χέρια με νύχια που ανεβαίνουν από κάτω: της σκιάς σκελετωμένο (κόκαλα μέσα σε σάβανο), της
// Ερινύας χλωμό με μακριά μαύρα νύχια.
function scareHand(erinys) {
  const skin = erinys ? 'P' : 'i', joint = erinys ? 'S' : 'I', nail = erinys ? 'N' : 'i';
  return paintGrid(24, 40, (p) => {
    p.poly([[5, 22], [19, 22], [21, 40], [3, 40]], erinys ? 'K' : 'k');      // μανίκι / σάβανο
    p.ellipse(12, 19, 7, 5, skin);                                           // παλάμη
    const fingers = [[5, 16, 2, 4], [9, 15, 7, 1], [13, 15, 13, 0], [17, 16, 19, 2], [19, 19, 23, 13]];
    for (const [x0, y0, x1, y1] of fingers) {
      p.line(x0, y0, x1, y1, 2, skin);
      p.px((x0 + x1) / 2, (y0 + y1) / 2, joint);
      p.line(x1, y1, x1 + (x1 - x0) * 0.25, y1 - 3, 1, nail);               // νύχι
    }
    if (!erinys) for (const y of [24, 28, 32]) p.line(7, y, 17, y + 1, 1, 'K');   // πτυχές του σάβανου
  });
}

// Ο Κέρβερος: κεφάλι σκύλου από μπροστά — σκούρο τρίχωμα, μυτερά αυτιά, κόκκινα μάτια, ρυτίδες
// στη μουσούδα· το στόμα από γρύλισμα με κυνόδοντες ως ορθάνοιχτο με γλώσσα και σάλια.
function scareDogFace(m) {
  return paintGrid(56, 54, (p) => {
    p.poly([[5, 16], [10, 0], [19, 12]], 'K');                // αυτί
    p.poly([[8, 14], [11, 4], [16, 12]], 'M');
    p.ellipse(28, 25, 24, 22, 'k');                           // κεφάλι
    p.ellipse(16, 30, 8, 9, 'K');                             // μάγουλο (σκιά)
    p.line(10, 14, 20, 18, 2, 'K');                           // βαριά φρύδια
    p.ellipse(19, 21, 3.4, 2.2, 'N'); p.px(19, 21, 'r'); p.px(20, 21, 'r'); p.px(18, 21, 'r');   // μάτι
    p.ellipse(22, 37, 9, 9, 'M');                             // μουσούδα
    for (const [y, x0] of [[29, 18], [31, 17], [33, 18]]) p.line(x0, y, x0 + 5, y + 1, 1, 'K');   // ρυτίδες γρυλίσματος
    p.mirror();
    p.ellipse(28, 30, 4.2, 2.6, 'N'); p.px(27, 29, 'n');      // μύτη
    if (m === 0) {
      p.line(19, 40, 37, 40, 1, 'N');
      for (const x of [21, 34]) { p.line(x, 40, x + 0.5, 44, 2, 'i'); }        // κυνόδοντες έξω από τα χείλη
      for (let x = 23; x <= 33; x += 2) p.px(x, 41, 'i');
    } else if (m === 1) {
      p.poly([[18, 39], [38, 39], [35, 47], [21, 47]], 'N');
      p.line(18, 39, 38, 39, 1, 'R');
      for (let x = 19; x <= 37; x += 2) p.line(x, 40, x, 41, 1, 'i');
      for (const x of [20, 36]) p.line(x, 40, x, 45, 2, 'i');
      p.ellipse(28, 45, 4, 1.6, 't');
    } else {
      p.poly([[15, 37], [41, 37], [38, 53], [18, 53]], 'N');                    // ορθάνοιχτο
      p.line(15, 37, 41, 37, 2, 'R');
      p.ellipse(28, 49, 7, 4, 't'); p.line(28, 46, 28, 52, 1, 'R');             // γλώσσα
      for (let x = 17; x <= 39; x += 3) { p.line(x, 38, x + 0.5, 41.5, 1, 'i'); p.line(x, 53, x + 0.5, 50, 1, 'i'); }
      for (const x of [17, 39]) { p.line(x, 38, x + (x < 28 ? 1 : -1), 46, 2, 'i'); p.line(x + (x < 28 ? 2 : -2), 53, x + (x < 28 ? 2 : -2), 47, 2, 'i'); }
      for (const [x, y] of [[16, 44], [40, 46]]) p.line(x, y, x, y + 7, 1, 'p');   // σάλια
    }
  });
}

// Πόδι σκύλου με μαύρα νύχια (αντί για χέρι, στο jump scare του Κέρβερου).
function scarePaw() {
  return paintGrid(26, 36, (p) => {
    p.poly([[6, 14], [20, 14], [22, 36], [4, 36]], 'k');
    p.ellipse(13, 13, 10, 7, 'k');
    for (const x of [6, 11, 16, 20]) { p.ellipse(x, 9, 2.6, 3, 'K'); p.line(x, 6, x + (x - 13) * 0.15, 1, 2, 'N'); }
    for (const y of [20, 26, 31]) p.line(6, y, 10, y + 2, 1, 'K');
  });
}

// Το αριστερό φτερό της Ερινύας (το δεξί = καθρέφτης): κόκκινη μεμβράνη με μαύρα κόκαλα.
function scareWing() {
  return paintGrid(34, 40, (p) => {
    const tips = [[1, 4], [0, 16], [3, 28], [10, 38]];
    p.poly([[33, 10], ...tips, [30, 30]], 'R');
    for (const [tx, ty] of tips) p.line(33, 10, tx, ty, 1, 'K');
    for (let k = 0; k < tips.length - 1; k++) {
      const [ax, ay] = tips[k], [bx, by] = tips[k + 1];
      p.line(ax, ay, (ax + bx) / 2 + 3, (ay + by) / 2, 1, 'K');
      p.line((ax + bx) / 2 + 3, (ay + by) / 2, bx, by, 1, 'K');
    }
  });
}

// Τα jump scares ανά είδος τέρατος (eyeColor: χρώμα της λάμψης των ματιών, halo: λάμψη πίσω από
// το κεφάλι, size: πόσο μεγαλώνει το πρόσωπο — 1 = όσο η οθόνη).
const SCARE_KINDS = {
  shade: { face: (m) => [scareShadeFace(m)], eye: 'E', eyeColor: '255,250,235', erinys: false, wing: false, halo: POT.red, size: 1.05 },
  erinys: { face: (m) => [0, 1].map((f) => scareErinysFace(m, f)), eye: 'y', eyeColor: '255,214,90', erinys: true, wing: true, halo: '190,40,20', size: 0.8 },
  // Ο Κέρβερος: τρία κεφάλια (τα δύο στα πλάγια, πιο πίσω), πόδια με νύχια αντί για χέρια.
  cerberus: { face: (m) => [scareDogFace(m)], eye: 'r', eyeColor: '255,70,40', erinys: false, wing: false, halo: '170,30,10', size: 0.95, heads: true, paw: true },
};

const Scare = {
  kinds: null,    // για κάθε είδος: { faces: [στόμα][μαλλιά], eyes, hand, wing }
  kind: 'shade',
  hands: [],      // από πού ανεβαίνουν τα χέρια αυτή τη φορά
  seed: 0,

  build() {
    // Σε διπλή ανάλυση (Sprites.hdify): { c, f, w, h }.
    const hd = (fr) => {
      const c = Sprites.hdify(fr.c), f = Sprites.hdify(fr.f);
      return { c, f, w: c.width, h: c.height };
    };
    this.kinds = {};
    // Οι ζωγραφιές του js/art-beasts.js (ίδιο στυλ με τις μορφές του κόσμου), όταν υπάρχουν.
    if (typeof Art !== 'undefined' && Art.scareKinds) {
      const art = Art.scareKinds();
      for (const name in SCARE_KINDS) {
        const d = SCARE_KINDS[name], a = art[name];
        this.kinds[name] = { faces: a.faces, eyes: a.eyes, hand: a.hand, heads: !!d.heads, wing: a.wing || null, eyeColor: d.eyeColor, halo: d.halo, size: d.size };
      }
      return;
    }
    for (const name in SCARE_KINDS) {
      const d = SCARE_KINDS[name];
      // Κέντρα των ματιών (σε pixels του HD καρέ): ο μέσος όρος των pixels τους σε κάθε μισό.
      const grid = d.face(0)[0];
      const eyes = [0, 1].map((side) => {
        let sx = 0, sy = 0, n = 0;
        grid.forEach((r, y) => [...r].forEach((c, x) => {
          if (c === d.eye && (x < r.length / 2) === (side === 0)) { sx += x; sy += y; n++; }
        }));
        return [(sx / n + 1.5) * 2, (sy / n + 1.5) * 2];
      });
      this.kinds[name] = {
        faces: [0, 1, 2].map((m) => d.face(m).map((g) => hd(Sprites.build(g, POT.terra)))),
        eyes,
        hand: hd(Sprites.build(d.paw ? scarePaw() : scareHand(d.erinys), POT.terra)),
        heads: !!d.heads,
        wing: d.wing ? hd(Sprites.build(scareWing(), POT.terra)) : null,
        eyeColor: d.eyeColor,
        halo: d.halo,
        size: d.size,
      };
    }
  },

  // Ετοιμάζει ένα λίγο διαφορετικό jump scare κάθε φορά (μία φορά ανά θάνατο).
  // kind = το είδος του τέρατος που σε έπιασε ('shade' | 'erinys').
  prepare(kind = 'shade') {
    if (!this.kinds) this.build();
    this.kind = this.kinds[kind] ? kind : 'shade';
    this.seed = Math.random() * 100;
    // Δύο ή τρία χέρια: x = θέση στο πλάτος της οθόνης, flip = δεξί χέρι.
    const n = Math.random() < 0.5 ? 2 : 3;
    this.hands = [];
    for (let i = 0; i < n; i++) {
      const left = i % 2 === 0;
      this.hands.push({
        x: i === 2 ? 0.4 + Math.random() * 0.2 : left ? 0.14 + Math.random() * 0.12 : 0.74 + Math.random() * 0.12,
        flip: !left,
        delay: 0.14 + Math.random() * 0.1,
        reach: 0.55 + Math.random() * 0.25,
      });
    }
  },

  // t = δευτ. από τη στιγμή του θανάτου. (w, h) = μέγεθος του μικρού καμβά (art pixels).
  draw(ctx, w, h, t) {
    if (t > SCARE_TIME) return;
    if (!this.kinds) this.build();
    const K = this.kinds[this.kind];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // Πρώτα ένα στιγμιαίο κόκκινο φλας.
    if (t < 0.04) {
      ctx.fillStyle = Pottery.rgba(POT.red, 1);
      ctx.fillRect(0, 0, w, h);
      return;
    }
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // Ορμάει: από μικρό στο βάθος ως λίγο μεγαλύτερο από την οθόνη.
    const lunge = Math.min(1, (t - 0.04) / (SCARE_LUNGE - 0.04));
    const grow = 1 - Math.pow(1 - lunge, 3);
    const mouth = K.faces[t < 0.13 ? 0 : t < 0.22 ? 1 : 2];
    const face = mouth[Math.floor(t * 14) % mouth.length];   // τα φίδια σφαδάζουν
    const fw = Math.min(w, h * 0.85) * (0.12 + K.size * grow);
    const k = fw / face.w;
    const fh = face.h * k;
    const shake = 1 + grow * 3 + (t > 0.45 ? 3 : 0);
    const cx = w / 2 + (Math.random() - 0.5) * shake;
    const cy = h * 0.46 + (Math.random() - 0.5) * shake;
    const x0 = Math.round(cx - fw / 2), y0 = Math.round(cy - fh / 2);

    // Λάμψη πίσω από το κεφάλι.
    const halo = ctx.createRadialGradient(cx, cy, fw * 0.2, cx, cy, fw * 0.9);
    halo.addColorStop(0, Pottery.rgba(K.halo, 0.55));
    halo.addColorStop(1, Pottery.rgba(K.halo, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    // Φτερά που ανοίγουν πίσω από το πρόσωπο και χτυπάνε.
    if (K.wing) {
      const wk = k * (0.9 + 0.5 * grow);
      const ww = K.wing.w * wk, wh = K.wing.h * wk;
      const flap = Math.sin(t * 30) * wh * 0.08;
      const wy = Math.round(cy - wh * 0.75 + flap);
      ctx.drawImage(K.wing.c, Math.round(cx - fw * 0.3 - ww), wy, ww, wh);
      ctx.drawImage(K.wing.f, Math.round(cx + fw * 0.3), wy, ww, wh);
    }

    // Ο Κέρβερος: τα δύο άλλα κεφάλια, στα πλάγια και λίγο πιο πίσω, με το δικό τους τίναγμα.
    if (K.heads) {
      for (const s of [-1, 1]) {
        const sk = k * 0.72, sw = face.w * sk, sh = face.h * sk;
        const sx = Math.round(cx + s * fw * 0.6 - sw / 2 + (Math.random() - 0.5) * shake * 1.5);
        const sy = Math.round(cy - sh * 0.38 + (Math.random() - 0.5) * shake * 1.5);
        ctx.drawImage(s < 0 ? face.c : face.f, sx, sy, sw, sh);
      }
    }

    // Το πρόσωπο. Στις στιγμές της "παρεμβολής" κόβεται σε λωρίδες που γλιστράνε στο πλάι.
    const glitch = (t > 0.19 && t < 0.235) || (t > 0.5 && Math.random() < 0.5);
    if (glitch) {
      const bands = 7;
      for (let b = 0; b < bands; b++) {
        const sy = (face.h / bands) * b, sh = face.h / bands;
        const off = Math.round((Math.random() - 0.5) * fw * 0.18);
        ctx.drawImage(face.c, 0, sy, face.w, sh, x0 + off, y0 + sy * k, fw, sh * k);
      }
    } else {
      ctx.drawImage(face.c, x0, y0, fw, fh);
    }

    // Τα μάτια λάμπουν — και στο τέλος φλέγονται.
    const flare = t > 0.42 ? (t - 0.42) / (SCARE_TIME - 0.42) : 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [ex, ey] of K.eyes) {
      const px = x0 + ex * k, py = y0 + ey * k;
      const R = k * (3 + flare * 6) * (0.9 + 0.2 * Math.random());
      const g = ctx.createRadialGradient(px, py, 0, px, py, R);
      g.addColorStop(0, `rgba(${K.eyeColor},${(0.55 + 0.45 * flare).toFixed(3)})`);
      g.addColorStop(1, `rgba(${K.eyeColor},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(px - R, py - R, R * 2, R * 2);
    }
    ctx.restore();

    // Χέρια με νύχια που ανεβαίνουν από κάτω και σε αρπάζουν.
    const hk = Math.max(1, k * 0.62);
    const hw = K.hand.w * hk, hh = K.hand.h * hk;
    for (const hd of this.hands) {
      const p = Math.max(0, Math.min(1, (t - hd.delay) / 0.14));
      if (p <= 0) continue;
      const rise = 1 - Math.pow(1 - p, 2);
      const hx = Math.round(hd.x * w - hw / 2 + (Math.random() - 0.5) * 2);
      const hy = Math.round(h - hh * hd.reach * rise + (Math.random() - 0.5) * 2);
      ctx.drawImage(hd.flip ? K.hand.f : K.hand.c, hx, hy, hw, hh);
    }

    // Λωρίδες "παρεμβολής" σαν χαλασμένο σήμα, πάνω από όλα.
    ctx.fillStyle = Pottery.rgba(POT.light, 0.12);
    for (let i = 0; i < 10; i++) {
      ctx.fillRect(Math.random() * w, Math.random() * h, Math.random() * w * 0.4, 1);
    }
    // Ο λεπτός μαίανδρος πάνω και κάτω, όπως στην οθόνη του παιχνιδιού.
    Pottery.meander(ctx, 0, 0, w, 7, POT.terra, 0.6, 1);
    Pottery.meander(ctx, 0, h - 7, w, 7, POT.terra, 0.6, 1);
  },
};
