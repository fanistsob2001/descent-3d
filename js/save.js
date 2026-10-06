'use strict';

// Αποθήκευση στον browser (localStorage). Αν ο browser δεν το επιτρέπει
// (π.χ. ιδιωτική περιήγηση), το παιχνίδι δουλεύει κανονικά χωρίς αποθήκευση.

// Μία μόνο θέση αποθήκευσης: η κατάσταση τη στιγμή που άναψε ο τελευταίος βωμός.
// { v: 2, chapter: 0..7, jars, strings, obol, paid, melody, taken: [id αντικειμένων],
//   seen: τα κελιά που έχει δει ο παίκτης (Level.seenString) }
// v2: 8 κεφάλαια. Τα παλιά saves (χωρίς v, 5 κεφάλαια) μετατρέπονται: τα κεφάλαια IV και V
// έγιναν VII και VIII, και τα id των αντικειμένων μετά το III μετακινήθηκαν.
const SAVE_VERSION = 2;
const SAVE_V1_CHAPTERS = [0, 1, 2, 6, 7];   // παλιό κεφάλαιο → νέο

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
        };
      }
    } catch (_) { /* χωρίς αποθήκευση */ }
    return null;
  },

  // Μετατρέπει ένα παλιό save (v1) στη μορφή του v2.
  migrate(d) {
    if (!d || d.v === SAVE_VERSION || !Number.isInteger(d.chapter)) return d;
    // Τα αντικείμενα του παλιού χάρτη, με τη σειρά τους: όσα ανήκουν στα παλιά κεφάλαια.
    const oldIds = [];
    Level.items.forEach((it, id) => { if (SAVE_V1_CHAPTERS.includes(it.region)) oldIds.push(id); });
    return {
      ...d,
      v: SAVE_VERSION,
      chapter: SAVE_V1_CHAPTERS[d.chapter] !== undefined ? SAVE_V1_CHAPTERS[d.chapter] : -1,
      taken: Array.isArray(d.taken) ? d.taken.map((id) => oldIds[id]).filter(Number.isInteger) : [],
    };
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
const Settings = {
  KEY: 'descent-settings',
  sound: true,
  vibration: true,
  mouse: 1,          // πολλαπλασιαστής του βλέμματος με το ποντίκι (ένα από τα MOUSE_SENS)
  voice: 'real',     // φωνές: 'real' (του browser) ή '8bit' (συνθετικές)

  load() {
    try {
      const d = JSON.parse(localStorage.getItem(this.KEY));
      if (d) {
        this.sound = d.sound !== false;
        this.vibration = d.vibration !== false;
        if (MOUSE_SENS.includes(d.mouse)) this.mouse = d.mouse;
        if (d.voice === '8bit' || d.voice === 'real') this.voice = d.voice;
      }
    } catch (_) { /* - */ }
  },

  store() {
    try {
      localStorage.setItem(this.KEY, JSON.stringify({ sound: this.sound, vibration: this.vibration, mouse: this.mouse, voice: this.voice }));
    } catch (_) { /* - */ }
  },
};
