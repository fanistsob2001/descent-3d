'use strict';

// Στάδιο 4 του WebGL: τα 3D μοντέλα των χαρακτήρων και των τεράτων (low-poly, χωρίς αρχεία — χτισμένα εδώ από απλά
// σχήματα: κύλινδροι / κώνοι, ελλειψοειδή, κουτιά, τρίγωνα). Ίδια παλέτα με τα sprites (SPR_PAL), επίπεδη σκίαση.
// Κάθε μοντέλο έχει ύψος 1 (το μέγεθος στον κόσμο το δίνει το RC_REAL_H / o.h, όπως στα sprites), κοιτάζει προς +y,
// x δεξιά, z πάνω. Τα κομμάτια έχουν "κόκαλο" (bone) με σημείο περιστροφής: τα πόδια / χέρια / κεφάλια / φτερά
// κινούνται (Models.pose). Η μηχανή WebGL (js/gl3d.js) αντικαθιστά με αυτά τα sprites που έχουν όνομα στο MODEL_OF.

const MC = (k) => SPR_PAL[k].split(',').map((v) => Number(v) / 255);
const MCOL = (r, g, b) => [r / 255, g / 255, b / 255];

const Models = {
  defs: {},

  // ---- Σχήματα: κάθε συνάρτηση επιστρέφει τρίγωνα [[x,y,z]×3] ----
  // Σωλήνας (κόλουρος κώνος) από το a ως το b, ακτίνες r0 → r1, n πλευρές, με καπάκια.
  tube(a, b, r0, r1, n = 6) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const L = Math.hypot(...d) || 1e-6;
    const w = d.map((v) => v / L);
    // Δύο κάθετα διανύσματα στον άξονα.
    const t = Math.abs(w[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    let u = [w[1] * t[2] - w[2] * t[1], w[2] * t[0] - w[0] * t[2], w[0] * t[1] - w[1] * t[0]];
    const ul = Math.hypot(...u); u = u.map((v) => v / ul);
    const v = [w[1] * u[2] - w[2] * u[1], w[2] * u[0] - w[0] * u[2], w[0] * u[1] - w[1] * u[0]];
    const ring = (c, r, k) => {
      const ang = (k / n) * Math.PI * 2, cs = Math.cos(ang) * r, sn = Math.sin(ang) * r;
      return [c[0] + u[0] * cs + v[0] * sn, c[1] + u[1] * cs + v[1] * sn, c[2] + u[2] * cs + v[2] * sn];
    };
    const tris = [];
    for (let k = 0; k < n; k++) {
      const p0 = ring(a, r0, k), p1 = ring(a, r0, k + 1), q0 = ring(b, r1, k), q1 = ring(b, r1, k + 1);
      tris.push([p0, p1, q1], [p0, q1, q0]);
      if (r0 > 0) tris.push([a, p1, p0]);
      if (r1 > 0) tris.push([b, q0, q1]);
    }
    return tris;
  },

  // Ελλειψοειδές με κέντρο c και ακτίνες r = [rx, ry, rz].
  ball(c, r, n = 7, m = 5) {
    const P = (i, j) => {
      const th = (i / n) * Math.PI * 2, ph = (j / m) * Math.PI - Math.PI / 2;
      return [c[0] + Math.cos(ph) * Math.cos(th) * r[0], c[1] + Math.cos(ph) * Math.sin(th) * r[1], c[2] + Math.sin(ph) * r[2]];
    };
    const tris = [];
    for (let j = 0; j < m; j++) {
      for (let i = 0; i < n; i++) {
        const a = P(i, j), b = P(i + 1, j), cc = P(i + 1, j + 1), d = P(i, j + 1);
        if (j > 0) tris.push([a, b, cc]);
        if (j < m - 1) tris.push([a, cc, d]);
      }
    }
    return tris;
  },

  box(x0, y0, z0, x1, y1, z1) {
    const p = (x, y, z) => [x ? x1 : x0, y ? y1 : y0, z ? z1 : z0];
    const f = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]].map((q) => p(...q));
    const q = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 4, 7, 3]];
    const tris = [];
    for (const [a, b, c, d] of q) tris.push([f[a], f[b], f[c]], [f[a], f[c], f[d]]);
    return tris;
  },

  // ---- Ορισμός μοντέλου: κομμάτια { tris, col, glow (λάμπει μόνο του), bone } και κόκαλα { pivot } ----
  def(name, build) {
    const parts = [];
    const add = (tris, col, bone = 'body', glow = false) => parts.push({ tris, col, bone, glow });
    build(add, this);
    this.defs[name] = { parts };
  },

  init() {
    const T = this.tube.bind(this), B = this.ball.bind(this), X = this.box.bind(this);
    const skin = MC('s'), skinD = MC('S'), white = MC('w'), whiteD = MC('W'), hairDark = MC('a'), gold = MC('y');
    const black = MCOL(34, 28, 26), charcoal = MC('k'), pale = MC('p'), paleD = MC('P'), cream = MC('E');

    // Άνθρωπος (γενικός): φόρεμα / χιτώνας, κορμός, χέρια, κεφάλι, μαλλιά. o = { dress, top, hair, skin, long, beard, hood, staff }
    const human = (add, o) => {
      const sk = o.skin || skin;
      if (o.long) {
        add(T([0, 0, 0], [0, 0, 0.6], 0.15, 0.1, 8), o.dress, 'body');          // μακρύ φόρεμα
      } else {
        add(T([0, 0, 0.3], [0, 0, 0.6], 0.13, 0.1, 8), o.dress, 'body');        // κοντός χιτώνας ως το γόνατο
        add(T([-0.055, 0, 0.5], [-0.055, 0.01, 0.02], 0.035, 0.028, 5), sk, 'legL');
        add(T([0.055, 0, 0.5], [0.055, 0.01, 0.02], 0.035, 0.028, 5), sk, 'legR');
        add(X(-0.08, -0.02, 0, -0.03, 0.06, 0.03), MC('b'), 'legL');           // σανδάλια
        add(X(0.03, -0.02, 0, 0.08, 0.06, 0.03), MC('b'), 'legR');
      }
      add(T([0, 0, 0.56], [0, 0, 0.82], 0.105, 0.125, 8), o.top || o.dress, 'body');
      add(X(-0.11, -0.03, 0.6, 0.11, 0.03, 0.63), MC('b'), 'body');            // ζώνη
      add(T([0, 0, 0.81], [0, 0, 0.86], 0.035, 0.035, 5), sk, 'head');
      add(B([0, 0.005, 0.915], [0.062, 0.068, 0.075]), sk, 'head');
      add(B([0, 0.06, 0.91], [0.01, 0.012, 0.014], 4, 3), skinD, 'head');      // μύτη
      add(B([-0.022, 0.06, 0.93], [0.008, 0.004, 0.006], 4, 3), MC('e'), 'head');
      add(B([0.022, 0.06, 0.93], [0.008, 0.004, 0.006], 4, 3), MC('e'), 'head');
      if (o.hood) add(B([0, -0.012, 0.93], [0.083, 0.085, 0.092]), o.hood, 'head');
      else if (o.hair) {
        add(B([0, -0.015, 0.94], [0.07, 0.07, 0.07]), o.hair, 'head');
        if (o.longHair) add(T([0, -0.04, 0.93], [0, -0.05, 0.74], 0.06, 0.045, 6), o.hair, 'head');
      }
      if (o.beard) add(B([0, 0.045, 0.875], [0.045, 0.03, 0.045]), o.beard, 'head');
      if (o.crown) add(T([0, 0, 0.98], [0, 0, 1.02], 0.07, 0.075, 8), o.crown, 'head');
      const arm = o.sleeve || sk;
      add(T([-0.13, 0, 0.8], [-0.15, 0.02, 0.52], 0.034, 0.028, 5), arm, 'armL');
      add(T([0.13, 0, 0.8], [0.15, 0.02, 0.52], 0.034, 0.028, 5), arm, 'armR');
      add(B([-0.15, 0.02, 0.5], [0.025, 0.025, 0.03], 4, 3), sk, 'armL');
      add(B([0.15, 0.02, 0.5], [0.025, 0.025, 0.03], 4, 3), sk, 'armR');
      if (o.staff) add(T([0.16, 0.03, 0.02], [0.16, 0.05, 1.02], 0.012, 0.01, 4), MC('o'), 'armR');
    };
    this.human = human;

    this.def('euryAlive', (add) => human(add, { dress: white, top: white, hair: hairDark, long: true, longHair: true }));
    this.def('villager', (add) => human(add, { dress: whiteD, top: whiteD, hair: MC('B'), beard: MC('B'), staff: true }));
    this.def('mournerF', (add) => human(add, { dress: black, top: black, hood: black, long: true }));
    this.def('mournerM', (add) => human(add, { dress: black, top: black, hair: MCOL(60, 44, 36), beard: MCOL(60, 44, 36), sleeve: black }));
    // Η Ευρυδίκη ως σκιά (VIII) και οι ψυχές: χλωμές, λάμπουν μόνες τους (ζωγραφίζονται διάφανες).
    this.def('eurydice3d', (add) => human(add, { dress: pale, top: pale, hair: MC('c'), long: true, longHair: true, skin: paleD }));
    this.def('soulF3d', (add) => human(add, { dress: pale, top: pale, hair: MC('c'), long: true, longHair: true, skin: paleD }));
    this.def('soulM3d', (add) => human(add, { dress: pale, top: pale, hair: MC('c'), skin: paleD }));
    this.def('soulOld3d', (add) => human(add, { dress: pale, top: pale, hair: MC('c'), beard: pale, skin: paleD, staff: true }));
    // Η πεσμένη Ευρυδίκη (στο λιβάδι): η ίδια, ξαπλωμένη.
    this.def('euryLying', (add) => human(add, { dress: white, top: white, hair: hairDark, long: true, longHair: true }));

    // Ο Χάροντας: ψηλός, σκυφτός, με κουκούλα και κουπί.
    this.def('charon3d', (add) => {
      human(add, { dress: MC('z'), top: MC('Z'), hood: MC('Z'), long: true, skin: MC('T'), beard: MC('B') });
      add(T([0.16, 0.06, 0.05], [0.12, 0.0, 1.05], 0.014, 0.012, 4), MC('o'), 'armR');                // κουπί
      add(X(0.1, 0.03, 0.0, 0.14, 0.09, 0.2), MC('O'), 'armR');
    });
    // Η βάρκα: μακρόστενο σκαρί με υψωμένη πλώρη και πρύμνη, και το "μάτι".
    this.def('boat3d', (add) => {
      const wood = MC('o'), woodD = MC('O');
      add(T([0, -1.6, 0.35], [0, 1.6, 0.35], 0.3, 0.3, 8), woodD, 'body');
      add(X(-0.32, -1.5, 0.3, 0.32, 1.5, 0.62), wood, 'body');
      add(T([0, 1.5, 0.5], [0, 2.0, 1.0], 0.2, 0.04, 6), woodD, 'body');
      add(T([0, -1.5, 0.5], [0, -1.9, 0.95], 0.2, 0.04, 6), woodD, 'body');
      add(B([0.33, 1.2, 0.5], [0.02, 0.12, 0.07], 5, 3), cream, 'body', true);
      add(B([-0.33, 1.2, 0.5], [0.02, 0.12, 0.07], 5, 3), cream, 'body', true);
    });

    // Θρόνος (για τον Άδη και την Περσεφόνη): πέτρινο κάθισμα με ψηλή πλάτη.
    const throne = (add) => {
      const st = MC('m'), stD = MC('M');
      add(X(-0.24, -0.2, 0, 0.24, 0.2, 0.38), st, 'throne');
      add(X(-0.26, -0.28, 0, 0.26, -0.18, 1.1), stD, 'throne');
      add(X(-0.28, -0.2, 0.38, -0.22, 0.18, 0.55), st, 'throne');
      add(X(0.22, -0.2, 0.38, 0.28, 0.18, 0.55), st, 'throne');
      add(T([0, -0.24, 1.1], [0, -0.24, 1.2], 0.12, 0.02, 6), gold, 'throne');
    };
    // Καθιστή μορφή: μηροί οριζόντια, κνήμες κάθετα (κόκαλο 'body' για όλο το πάνω σώμα, για το γείρε της Περσεφόνης).
    const seated = (add, o) => {
      const sk = skin;
      add(X(-0.14, -0.14, 0.36, 0.14, 0.22, 0.5), o.dress, 'legs');                 // μηροί και ποδιά
      add(T([-0.06, 0.2, 0.42], [-0.06, 0.24, 0.02], 0.045, 0.04, 6), o.dress, 'legs');
      add(T([0.06, 0.2, 0.42], [0.06, 0.24, 0.02], 0.045, 0.04, 6), o.dress, 'legs');
      add(T([0, -0.05, 0.45], [0, -0.04, 0.78], 0.12, 0.14, 8), o.top, 'body');
      add(T([0, -0.04, 0.77], [0, -0.04, 0.82], 0.035, 0.035, 5), sk, 'body');
      add(B([0, -0.035, 0.88], [0.065, 0.07, 0.078]), sk, 'body');
      add(B([-0.022, 0.03, 0.9], [0.008, 0.004, 0.006], 4, 3), MC('e'), 'body');
      add(B([0.022, 0.03, 0.9], [0.008, 0.004, 0.006], 4, 3), MC('e'), 'body');
      add(B([0, -0.05, 0.91], [0.072, 0.072, 0.072]), o.hair, 'body');
      if (o.longHair) add(T([0, -0.09, 0.9], [0, -0.1, 0.7], 0.06, 0.045, 6), o.hair, 'body');
      if (o.beard) add(B([0, 0.01, 0.84], [0.05, 0.035, 0.06]), o.beard, 'body');
      add(T([-0.15, -0.04, 0.76], [-0.2, 0.12, 0.55], 0.035, 0.03, 5), o.sleeve || o.top, 'body');
      add(T([0.15, -0.04, 0.76], [0.2, 0.12, 0.55], 0.035, 0.03, 5), o.sleeve || o.top, 'body');
      add(B([-0.2, 0.13, 0.54], [0.028, 0.03, 0.028], 4, 3), sk, 'body');
      add(B([0.2, 0.13, 0.54], [0.028, 0.03, 0.028], 4, 3), sk, 'body');
      if (o.crown) {
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          add(T([Math.cos(a) * 0.06, -0.05 + Math.sin(a) * 0.06, 0.95], [Math.cos(a) * 0.06, -0.05 + Math.sin(a) * 0.06, 1.02], 0.016, 0, 4), o.crown, 'body');
        }
      }
      if (o.pomegranate) add(B([0, 0.0, 0.99], [0.03, 0.03, 0.03], 5, 4), MC('r'), 'body');
    };
    this.def('hades3d', (add) => { throne(add); seated(add, { dress: charcoal, top: MCOL(96, 70, 40), sleeve: charcoal, hair: black, beard: black, crown: black }); });
    this.def('persephone3d', (add) => { throne(add); seated(add, { dress: white, top: white, hair: hairDark, longHair: true, crown: gold, pomegranate: true }); });

    // Η σκιά: σκυφτή μορφή με κουκούλα, κρανίο, μακριά κοκαλιάρικα χέρια, σάβανο που σέρνεται, μάτια που λάμπουν.
    this.def('ghoul', (add) => {
      const robe = charcoal, robeD = MC('K'), bone = MCOL(200, 186, 160);
      add(T([0, 0, 0], [0, 0.04, 0.55], 0.2, 0.13, 8), robeD, 'body');
      add(T([0, 0.04, 0.5], [0, 0.14, 0.78], 0.13, 0.12, 8), robe, 'body');
      add(B([0, 0.2, 0.84], [0.09, 0.1, 0.1]), robeD, 'head');                       // κουκούλα
      add(B([0, 0.25, 0.82], [0.06, 0.06, 0.07]), bone, 'head');                     // κρανίο
      add(B([-0.024, 0.305, 0.835], [0.014, 0.008, 0.012], 4, 3), cream, 'head', true);
      add(B([0.024, 0.305, 0.835], [0.014, 0.008, 0.012], 4, 3), cream, 'head', true);
      add(T([-0.11, 0.12, 0.74], [-0.14, 0.38, 0.6], 0.03, 0.018, 5), robe, 'armL');
      add(T([0.11, 0.12, 0.74], [0.14, 0.38, 0.6], 0.03, 0.018, 5), robe, 'armR');
      for (const s of [-1, 1]) for (let f = 0; f < 3; f++) {
        add(T([s * 0.14, 0.38, 0.6], [s * (0.12 + f * 0.025), 0.47, 0.55 - f * 0.02], 0.007, 0.003, 3), bone, s < 0 ? 'armL' : 'armR');
      }
    });

    // Ερινύα: γυναίκα με φτερά νυχτερίδας και φίδια για μαλλιά, που αιωρείται.
    this.def('erinys3d', (add) => {
      const robe = MCOL(92, 30, 26), wing = MCOL(60, 22, 20), sk = MCOL(170, 120, 96);
      add(T([0, 0, 0.05], [0, 0, 0.6], 0.02, 0.11, 7), robe, 'body');
      add(T([0, 0, 0.56], [0, 0, 0.8], 0.1, 0.12, 7), robe, 'body');
      add(B([0, 0.01, 0.9], [0.06, 0.065, 0.075]), sk, 'head');
      add(B([-0.022, 0.065, 0.91], [0.01, 0.005, 0.007], 4, 3), MCOL(255, 210, 90), 'head', true);
      add(B([0.022, 0.065, 0.91], [0.01, 0.005, 0.007], 4, 3), MCOL(255, 210, 90), 'head', true);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        add(T([Math.cos(a) * 0.05, Math.sin(a) * 0.05 - 0.01, 0.95], [Math.cos(a) * 0.11, Math.sin(a) * 0.11 - 0.03, 0.86], 0.014, 0.006, 4), MC('g'), 'hair');
      }
      add(T([-0.12, 0, 0.78], [-0.18, 0.1, 0.55], 0.03, 0.022, 5), sk, 'armL');
      add(T([0.12, 0, 0.78], [0.18, 0.1, 0.55], 0.03, 0.022, 5), sk, 'armR');
      // Φτερά: τρίγωνα από την πλάτη (και από τις δύο όψεις).
      for (const s of [-1, 1]) {
        const root = [s * 0.05, -0.06, 0.78], tip = [s * 0.62, -0.12, 0.98], low = [s * 0.5, -0.1, 0.42], mid = [s * 0.3, -0.08, 0.55];
        add([[root, tip, mid], [root, mid, tip], [mid, tip, low], [mid, low, tip], [root, mid, low], [root, low, mid]], wing, s < 0 ? 'wingL' : 'wingR');
      }
    });

    // Ο Κέρβερος: τεράστιο σκυλί με τρία κεφάλια, ουρά-φίδι, κόκκινα μάτια.
    this.def('cerberus', (add) => {
      const fur = MCOL(70, 44, 32), furD = MCOL(44, 28, 22), red = MCOL(255, 70, 40);
      add(B([0, 0, 0.5], [0.2, 0.42, 0.2]), fur, 'body');
      add(B([0, 0.3, 0.58], [0.24, 0.2, 0.22]), fur, 'body');                         // στήθος
      for (const [lx, ly, bone] of [[-0.12, 0.3, 'legFL'], [0.12, 0.3, 'legFR'], [-0.12, -0.3, 'legBL'], [0.12, -0.3, 'legBR']]) {
        add(T([lx, ly, 0.5], [lx, ly + 0.02, 0.04], 0.07, 0.05, 6), furD, bone);
        add(B([lx, ly + 0.05, 0.03], [0.05, 0.07, 0.03], 5, 3), furD, bone);
      }
      for (const [hx, bone] of [[-0.2, 'headL'], [0, 'headM'], [0.2, 'headR']]) {
        add(T([hx * 0.6, 0.4, 0.66], [hx, 0.55, 0.82], 0.08, 0.07, 6), fur, bone);       // λαιμός
        add(B([hx, 0.6, 0.86], [0.09, 0.11, 0.09]), fur, bone);
        add(X(hx - 0.045, 0.66, 0.78, hx + 0.045, 0.82, 0.86), furD, bone);              // μουσούδα
        add(T([hx - 0.05, 0.58, 0.92], [hx - 0.06, 0.56, 1.02], 0.03, 0, 4), furD, bone); // αυτιά
        add(T([hx + 0.05, 0.58, 0.92], [hx + 0.06, 0.56, 1.02], 0.03, 0, 4), furD, bone);
        add(B([hx - 0.035, 0.68, 0.9], [0.016, 0.01, 0.012], 4, 3), red, bone, true);
        add(B([hx + 0.035, 0.68, 0.9], [0.016, 0.01, 0.012], 4, 3), red, bone, true);
      }
      add(T([0, -0.4, 0.55], [0, -0.62, 0.7], 0.05, 0.03, 5), MC('g'), 'tail');
      add(T([0, -0.62, 0.7], [0, -0.78, 0.62], 0.03, 0.02, 5), MC('g'), 'tail');
      add(B([0, -0.8, 0.62], [0.035, 0.045, 0.03], 5, 3), MC('G'), 'tail');
    });

    // Κατσίκα (πρόλογος).
    this.def('goat', (add) => {
      const fur = MCOL(206, 184, 150), dark = MCOL(90, 70, 52);
      add(B([0, 0, 0.62], [0.17, 0.36, 0.16]), fur, 'body');
      for (const [lx, ly, bone] of [[-0.09, 0.24, 'legFL'], [0.09, 0.24, 'legFR'], [-0.09, -0.24, 'legBL'], [0.09, -0.24, 'legBR']]) {
        add(T([lx, ly, 0.56], [lx, ly, 0.02], 0.035, 0.025, 5), dark, bone);
      }
      add(T([0, 0.3, 0.7], [0, 0.42, 0.88], 0.06, 0.05, 6), fur, 'headM');
      add(B([0, 0.48, 0.88], [0.06, 0.1, 0.06]), fur, 'headM');
      add(T([-0.03, 0.44, 0.94], [-0.06, 0.36, 1.04], 0.014, 0.004, 4), dark, 'headM');
      add(T([0.03, 0.44, 0.94], [0.06, 0.36, 1.04], 0.014, 0.004, 4), dark, 'headM');
      add(T([0, 0.53, 0.82], [0, 0.55, 0.74], 0.015, 0.005, 4), MCOL(240, 236, 220), 'headM');
      add(T([0, -0.36, 0.7], [0, -0.42, 0.78], 0.03, 0.01, 4), fur, 'tail');
    });

    // Το φίδι: σώμα σε σχήμα S στο χορτάρι, με σηκωμένο κεφάλι.
    this.def('snake3d', (add) => {
      const g = MC('g'), G = MC('G');
      const pts = [];
      for (let k = 0; k <= 10; k++) pts.push([Math.sin(k * 0.9) * 0.6, -1.6 + k * 0.28, 0.08]);
      for (let k = 0; k < pts.length - 1; k++) add(T(pts[k], pts[k + 1], 0.09, 0.09, 6), k % 2 ? G : g, 'body');
      const n = pts[pts.length - 1];
      add(T(n, [n[0], n[1] + 0.2, 0.7], 0.09, 0.08, 6), g, 'headM');
      add(B([n[0], n[1] + 0.3, 0.78], [0.13, 0.17, 0.09]), G, 'headM');
      add(B([n[0] - 0.06, n[1] + 0.4, 0.82], [0.02, 0.02, 0.02], 4, 3), MC('e'), 'headM');
      add(B([n[0] + 0.06, n[1] + 0.4, 0.82], [0.02, 0.02, 0.02], 4, 3), MC('e'), 'headM');
    });

    // Τα σημεία περιστροφής των κοκάλων (ανά είδος).
    this.pivots = {
      legL: [0, 0, 0.52], legR: [0, 0, 0.52], armL: [-0.13, 0, 0.8], armR: [0.13, 0, 0.8], head: [0, 0, 0.84],
      body: [0, 0, 0], legs: [0, 0, 0], throne: [0, 0, 0], hair: [0, 0, 0.9], wingL: [-0.05, -0.06, 0.78], wingR: [0.05, -0.06, 0.78],
      legFL: [0, 0.3, 0.5], legFR: [0, 0.3, 0.5], legBL: [0, -0.3, 0.5], legBR: [0, -0.3, 0.5],
      headL: [-0.1, 0.4, 0.66], headM: [0, 0.4, 0.66], headR: [0.1, 0.4, 0.66], tail: [0, -0.4, 0.55],
    };
  },

  // Η στάση ενός μοντέλου τώρα: γωνίες ανά κόκαλο [γύρω από x (μπρος-πίσω), γύρω από y (πλάγια)], και ολόκληρο το
  // σώμα (lie = ξαπλωμένο, bob = πάνω-κάτω). a = { t, walk (0..1 ταχύτητα), phase, ... }
  pose(name, a) {
    const p = {}, sw = Math.sin(a.phase) * 0.55 * a.walk;
    const t = a.t;
    if (name === 'cerberus' || name === 'goat') {
      const g = a.walk;
      p.legFL = [Math.sin(a.phase) * 0.6 * g, 0]; p.legBR = p.legFL;
      p.legFR = [-Math.sin(a.phase) * 0.6 * g, 0]; p.legBL = p.legFR;
      p.tail = [0, Math.sin(t * 6) * 0.4];
      const bark = a.bark || [0, 0, 0];
      p.headL = [-0.25 * bark[0] + Math.sin(t * 1.3) * 0.05, 0.15];
      p.headM = [-0.25 * bark[1] + Math.sin(t * 1.1 + 1) * 0.05, 0];
      p.headR = [-0.25 * bark[2] + Math.sin(t * 1.2 + 2) * 0.05, -0.15];
      if (a.lie) { for (const k of ['legFL', 'legFR', 'legBL', 'legBR']) p[k] = [k[3] === 'F' ? -1.3 : 1.3, 0]; p.lower = 0.36; }
      if (a.asleep) { p.headL[0] += 0.5; p.headM[0] += 0.5; p.headR[0] += 0.5; }
      else if (a.sleepHeads) { for (let i = 0; i < a.sleepHeads; i++) p[['headL', 'headM', 'headR'][i]][0] += 0.55; }
      return p;
    }
    p.legL = [sw, 0]; p.legR = [-sw, 0];
    p.armL = [-sw * 0.8 + Math.sin(t * 1.6) * 0.03, 0]; p.armR = [sw * 0.8 - Math.sin(t * 1.6) * 0.03, 0];
    p.head = [Math.sin(t * 0.9) * 0.04, Math.sin(t * 0.6) * 0.06];
    if (name === 'ghoul') {
      p.armL = [-0.2 + Math.sin(t * 2.1) * 0.15, 0]; p.armR = [-0.2 + Math.sin(t * 2.1 + 1.6) * 0.15, 0];
      p.bob = Math.sin(t * 3) * 0.015;
    }
    if (name === 'erinys3d') {
      const f = Math.sin(t * 9) * 0.5;
      p.wingL = [0, f]; p.wingR = [0, -f];
      p.hair = [0, Math.sin(t * 5) * 0.2];
    }
    if (name === 'charon3d' && a.frame === 1) p.armL = [-1.2, 0];            // απλώνει την παλάμη για τον οβολό
    if (name === 'villager') p.armR = [-0.3, 0];
    if (name === 'persephone3d' && a.frame === 1) p.body = [0, 0.32];          // γέρνει προς τον Άδη
    if (name === 'snake3d' && a.frame === 1) p.headM = [-0.3, 0];
    if (name === 'euryLying') p.lie = true;
    return p;
  },

  // Τα τρίγωνα του μοντέλου στον κόσμο: [x, y, z, nx, ny, nz, r, g, b, glow] ανά κορυφή, σε κελιά.
  // pos = { x, y, z } (κελιά), yaw (ακτίνια: προς τα πού κοιτάζει), h (ύψος σε κελιά), pose.
  emit(name, pos, yaw, h, pose, out, dim = 1) {
    const def = this.defs[name];
    if (!def) return;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    // Τοπικό: x δεξιά, y μπροστά, z πάνω. Κόσμος: μπροστά = (cos yaw, sin yaw), δεξιά = (−sin yaw, cos yaw)·
    // (στην οθόνη του χάρτη με το y προς τα κάτω, αυτό είναι το "δεξί χέρι" της μορφής).
    const lie = pose.lie;
    const lower = pose.lower || 0;
    const bob = pose.bob || 0;
    const rot = (v, piv, ax, ay) => {
      let x = v[0] - piv[0], y = v[1] - piv[1], z = v[2] - piv[2];
      if (ax) { const c = Math.cos(ax), s = Math.sin(ax); const y2 = y * c - z * s, z2 = y * s + z * c; y = y2; z = z2; }
      if (ay) { const c = Math.cos(ay), s = Math.sin(ay); const x2 = x * c + z * s, z2 = -x * s + z * c; x = x2; z = z2; }
      return [x + piv[0], y + piv[1], z + piv[2]];
    };
    for (const part of def.parts) {
      const piv = this.pivots[part.bone] || [0, 0, 0];
      const ang = pose[part.bone];
      const col = part.col;
      for (const tri of part.tris) {
        const w = tri.map((v0) => {
          let v = ang ? rot(v0, piv, ang[0], ang[1]) : v0;
          if (lie) v = [v[0], v[2] - 0.5, v[1] + 0.12];       // ξαπλωμένη: το σώμα πάνω στο έδαφος
          else if (lower) v = [v[0], v[1], v[2] < 0.55 ? v[2] * (1 - lower) : v[2] - 0.55 * lower];   // (ξαπλωμένο ζώο: πιο χαμηλά)
          const lx = v[0] * h, ly = v[1] * h, lz = (v[2] + bob) * h;
          return [pos.x + cy * ly - sy * lx, pos.y + sy * ly + cy * lx, pos.z + lz];
        });
        const ux = w[1][0] - w[0][0], uy = w[1][1] - w[0][1], uz = w[1][2] - w[0][2];
        const vx = w[2][0] - w[0][0], vy = w[2][1] - w[0][1], vz = w[2][2] - w[0][2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        for (const p of w) out.push(p[0], p[1], p[2], nx, ny, nz, col[0] * dim, col[1] * dim, col[2] * dim, part.glow ? 1 : 0);
      }
    }
  },
};

// Ποιο μοντέλο αντικαθιστά ποιο sprite (όνομα καρέ → μοντέλο).
const MODEL_OF = {
  euryAlive: 'euryAlive', euryLying: 'euryLying', eurydice3d: 'eurydice3d', villager: 'villager', mournerF: 'mournerF',
  mournerM: 'mournerM', charon3d: 'charon3d', boat3d: 'boat3d', hades3d: 'hades3d', persephone3d: 'persephone3d',
  soulM3d: 'soulM3d', soulF3d: 'soulF3d', soulOld3d: 'soulOld3d', ghoul: 'ghoul', erinys3d: 'erinys3d', cerberus: 'cerberus',
  goat: 'goat', snake3d: 'snake3d',
};
// Τα χλωμά (ψυχές, η Ευρυδίκη-σκιά): λάμπουν μόνα τους, σαν φαντάσματα.
const MODEL_GHOST = new Set(['eurydice3d', 'soulM3d', 'soulF3d', 'soulOld3d']);
