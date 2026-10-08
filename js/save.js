'use strict';

// Αποθήκευση στον browser (localStorage). Αν ο browser δεν το επιτρέπει
// (π.χ. ιδιωτική περιήγηση), το παιχνίδι δουλεύει κανονικά χωρίς αποθήκευση.

// Μία μόνο θέση αποθήκευσης: η κατάσταση τη στιγμή που άναψε ο τελευταίος βωμός.
// { v: 2, chapter: 0..7, jars, strings, obol, paid, melody, taken: [id αντικειμένων],
//   seen: τα κελιά που έχει δει ο παίκτης (Level.seenString) }
// v2: 8 κεφάλαια. Τα παλιά saves (χωρίς v, 5 κεφάλαια) μετατρέπονται: τα κεφάλαια IV και V
// έγιναν VII και VIII, και τα id των αντικειμένων μετά το III μετακινήθηκαν.
// v3: 12 κεφάλαια με νέους χάρτες (μεγάλη επέκταση). Τα κεφάλαια του v2 βρίσκονται σε νέες θέσεις
// (SAVE_V2_CHAPTERS)· τα αντικείμενα και ο χάρτης που είχες δει δεν μεταφέρονται (άλλοι χάρτες).
// v4: οι χάρτες μεγάλωσαν (×1.5) και οι καταδιώξεις άλλαξαν: το κεφάλαιο μένει, τα αντικείμενα / κιβώτια /
// χάρτες που είχες δει όχι.
// v5: τα αγγεία δεν είναι πια σκόρπια στον χάρτη (τα id των αντικειμένων άλλαξαν) και μπήκε μία νέα πινακίδα
// (οι συνταγές, n = 1): τα μαζεμένα ξαναβγαίνουν από τις χορδές / τον οβολό / τις πινακίδες· inventory με θέσεις.
const SAVE_VERSION = 5;
const SAVE_V1_CHAPTERS = [0, 1, 2, 6, 7];   // v1 → v2
const SAVE_V2_CHAPTERS = [0, 1, 3, 4, 6, 8, 10, 11];   // v2 → v3

const Save = {
  KEY: 'descent-save',

  // Η κατάσταση ενός καινούργιου παιχνιδιού (chapter -1 = πριν τον πρώτο βωμό).
  fresh() {
    // heard / secrets: οι ψυχές που άκουσες και τα μυστικά που βρήκες (αποστολές, js/missions.js).
    return { chapter: -1, jars: 0, strings: 0, obol: false, paid: false, melody: 0, taken: [], seen: '', heard: [], secrets: [] };
  },

  load() {
    try {
      const d = this.migrate(JSON.parse(localStorage.getItem(this.KEY)));
      if (d && Number.isInteger(d.chapter) && d.chapter >= 0 && d.chapter < CHAPTERS.length) {
        const int = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
        return {
          chapter: d.chapter,
          jars: int(d.jars),
          strings: Math.min(3, int(d.strings)),
          obol: d.obol === true,
          paid: d.paid === true,
          melody: int(d.melody),
          taken: Array.isArray(d.taken) ? d.taken.filter(Number.isInteger) : [],
          seen: typeof d.seen === 'string' && /^[0-9a-f]*$/.test(d.seen) ? d.seen : '',
          heard: Array.isArray(d.heard) ? d.heard : [],
          secrets: Array.isArray(d.secrets) ? d.secrets : [],
          inv: d.inv && typeof d.inv === 'object' ? d.inv : {},
        };
      }
    } catch (_) { /* χωρίς αποθήκευση */ }
    return null;
  },

  // Μετατρέπει ένα παλιό save (v1) στη μορφή του v2.
  migrate(d) {
    if (!d || d.v === SAVE_VERSION || !Number.isInteger(d.chapter)) return d;
    return this.toV5(this.toV4(d));
  },

  // v4 → v5: οι πινακίδες μετά την πρώτη πάνε μία θέση πιο κάτω· τα αντικείμενα που είχες μαζέψει
  // βρίσκονται από ό,τι ξέρουμε (οι πρώτες χορδές, ο οβολός, οι πινακίδες που διάβασες).
  toV5(d) {
    if (!d) return d;
    const inv = d.inv && typeof d.inv === 'object' ? { ...d.inv } : {};
    const tablets = (Array.isArray(inv.tablets) ? inv.tablets : []).map((n) => (n >= 1 ? n + 1 : n));
    // Η νέα πινακίδα με τις συνταγές είναι στο ιερό του III: όποιος έχει ήδη περάσει από εκεί την ξέρει.
    if (d.chapter >= 2 && !tablets.includes(1)) tablets.push(1);
    inv.tablets = tablets;
    const taken = [];
    let strings = Math.min(3, d.strings | 0);
    Level.items.forEach((it, id) => {
      if (it.kind === 'string' && strings > 0) { strings--; taken.push(id); }
      if (it.kind === 'obol' && (d.obol || d.paid)) taken.push(id);
      if (it.kind === 'tablet' && tablets.includes(it.n)) taken.push(id);
    });
    return { ...d, v: SAVE_VERSION, inv, taken };
  },

  toV4(d) {
    if (d.v === 4) return d;
    if (d.v === 3) {
      const inv = d.inv && typeof d.inv === 'object' ? { ...d.inv, opened: [], maps: [] } : {};
      return { ...d, v: SAVE_VERSION, taken: [], seen: '', inv };
    }
    if (d.v === 2) {
      const ch = SAVE_V2_CHAPTERS[d.chapter];
      return { ...d, v: SAVE_VERSION, chapter: ch === undefined ? -1 : ch, taken: [], seen: '', paid: d.paid || ch >= 2 };
    }
    // Τα αντικείμενα του παλιού χάρτη, με τη σειρά τους: όσα ανήκουν στα παλιά κεφάλαια.
    const oldIds = [];
    Level.items.forEach((it, id) => { if (SAVE_V1_CHAPTERS.includes(it.region)) oldIds.push(id); });
    void oldIds;
    const v2 = SAVE_V1_CHAPTERS[d.chapter];
    const ch = v2 !== undefined ? SAVE_V2_CHAPTERS[v2] : -1;
    return { ...d, v: SAVE_VERSION, chapter: ch, taken: [], seen: '', paid: d.paid || ch >= 2 };
  },

  exists() {
    return this.load() !== null;
  },

  write(data) {
    try { localStorage.setItem(this.KEY, JSON.stringify({ v: SAVE_VERSION, ...data })); } catch (_) { /* - */ }
  },

  clear() {
    try { localStorage.removeItem(this.KEY); } catch (_) { /* - */ }
  },
};

// Ρυθμίσεις: ήχος, δόνηση, και (PC) ευαισθησία ποντικιού.
const MOUSE_SENS = [0.5, 0.75, 1, 1.5, 2, 3];
const SETTINGS_FOV = [66, 72, 80, 90, 100];
const SETTINGS_BRIGHT = [0.8, 0.9, 1, 1.15, 1.3];
const Settings = {
  KEY: 'descent-settings',
  sound: true,
  vibration: true,
  mouse: 1,          // πολλαπλασιαστής του βλέμματος με το ποντίκι (ένα από τα MOUSE_SENS)
  voice: 'on',       // φωνές των χαρακτήρων: 'on' | 'off' (οι υπότιτλοι μένουν πάντα)
  invert: false,     // ποντίκι: πάνω-κάτω ανάποδα
  fov: 0,            // οπτικό πεδίο σε μοίρες (0 = το προεπιλεγμένο: 80 στο PC, 66 στο κινητό)
  bright: 1,         // φωτεινότητα (1 = κανονική)
  subs: 'medium',    // μέγεθος υποτίτλων: small | medium | large

  load() {
    try {
      const d = JSON.parse(localStorage.getItem(this.KEY));
      if (d) {
        this.sound = d.sound !== false;
        this.vibration = d.vibration !== false;
        if (MOUSE_SENS.includes(d.mouse)) this.mouse = d.mouse;
        if (d.voice === 'off') this.voice = 'off';
        this.invert = d.invert === true;
        if (SETTINGS_FOV.includes(d.fov)) this.fov = d.fov;
        if (SETTINGS_BRIGHT.includes(d.bright)) this.bright = d.bright;
        if (['small', 'medium', 'large'].includes(d.subs)) this.subs = d.subs;
      }
    } catch (_) { /* - */ }
  },

  store() {
    try {
      localStorage.setItem(this.KEY, JSON.stringify({ sound: this.sound, vibration: this.vibration, mouse: this.mouse, voice: this.voice, invert: this.invert, fov: this.fov, bright: this.bright, subs: this.subs }));
    } catch (_) { /* - */ }
  },
};
