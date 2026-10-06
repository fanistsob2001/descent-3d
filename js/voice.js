'use strict';

// Φωνές χαρακτήρων (STORY.md, ενότητα 10): οι αληθινές φωνές του browser (Web Speech API),
// χωρίς αρχεία ήχου. Οι παλιές συνθετικές 8-bit φωνές αφαιρέθηκαν.
// Για να ακούγονται όσο πιο ανθρώπινες γίνεται:
//   - προτιμάμε τις "φυσικές" (neural) φωνές όπου υπάρχουν (Edge: "... Online (Natural)",
//     Chrome: "Google UK English ...", Mac/iPhone: Daniel, Samantha κ.λπ.) πριν από τις παλιές
//     φωνές των Windows (David / Mark / Zira),
//   - κάθε κύριος χαρακτήρας παίρνει δική του φωνή (αν υπάρχουν αρκετές),
//   - μικρές αλλαγές στον τόνο (οι μεγάλες κάνουν τη φωνή να ακούγεται "ρομποτική"), και λίγη
//     τυχαία διαφορά σε κάθε φράση, ώστε η ίδια ατάκα να μην ακούγεται ποτέ ακριβώς ίδια.

// Για κάθε χαρακτήρα: φύλο ('m' / 'f'), ποιες φωνές του ταιριάζουν (με σειρά προτίμησης, μέρος
// του ονόματος), τόνος, ταχύτητα, ένταση. far = σε πόσες μονάδες κόσμου δεν ακούγεται πια.
const SPEECH = {
  // Ο αφηγητής: ζεστός, ήρεμος.
  narrator: { g: 'm', pitch: 0.96, rate: 0.9, vol: 1, prefer: ['Ryan', 'Thomas', 'Christopher', 'Daniel', 'Arthur', 'Google UK English Male', 'Brian', 'George', 'David'] },
  // Ο Ορφέας: νέος άντρας, τραγουδιστής.
  orpheus: { g: 'm', pitch: 1.04, rate: 0.95, vol: 1, prefer: ['Andrew', 'Eric', 'Guy', 'Liam', 'Connor', 'Oliver', 'Alex', 'Tom', 'Evan', 'Mark'] },
  // Ο Χάροντας: γέρος, πολύ βαθύς, αργός.
  charon: { g: 'm', pitch: 0.76, rate: 0.8, vol: 1, prefer: ['Roger', 'Steffan', 'Davis', 'Gordon', 'Arthur', 'Fred', 'David'] },
  // Ο Άδης: βαθύς, βαρύς.
  hades: { g: 'm', pitch: 0.8, rate: 0.84, vol: 1, prefer: ['Christopher', 'Davis', 'Tony', 'Thomas', 'Steffan', 'Daniel', 'Mark'] },
  // Η Ευρυδίκη: απαλή, νέα.
  eurydice: { g: 'f', pitch: 1.06, rate: 0.88, vol: 0.85, prefer: ['Sonia', 'Libby', 'Emily', 'Emma', 'Serena', 'Kate', 'Moira', 'Google UK English Female', 'Zira'] },
  // Η Περσεφόνη: βασιλική, ήρεμη.
  persephone: { g: 'f', pitch: 0.96, rate: 0.86, vol: 0.9, prefer: ['Aria', 'Natasha', 'Michelle', 'Ava', 'Clara', 'Fiona', 'Karen', 'Samantha', 'Google US English', 'Zira'] },
  // Σκιές: σιγανές, σέρνονται — άντρες ή γυναίκες.
  shade: { g: 'm', pitch: 0.72, rate: 0.76, vol: 0.8, prefer: ['Davis', 'Roger', 'Guy', 'Steffan', 'Gordon', 'David'] },
  shadeF: { g: 'f', pitch: 0.84, rate: 0.78, vol: 0.8, prefer: ['Michelle', 'Jenny', 'Clara', 'Tessa', 'Karen', 'Zira'] },
  // Ερινύες: γυναίκες, κοφτές, απειλητικές.
  erinys: { g: 'f', pitch: 1.12, rate: 1.04, vol: 0.9, prefer: ['Natasha', 'Jenny', 'Ava', 'Karen', 'Tessa', 'Zira'] },
  // Χαμένες ψυχές: σιγανά, κουρασμένα — άντρας, γέρος, γυναίκα.
  soulM: { g: 'm', pitch: 0.94, rate: 0.84, vol: 0.6, prefer: ['Eric', 'Brian', 'Liam', 'Tom', 'Connor', 'Mark'] },
  soulOld: { g: 'm', pitch: 0.8, rate: 0.78, vol: 0.6, prefer: ['Roger', 'Arthur', 'Steffan', 'Gordon', 'David'] },
  soulF: { g: 'f', pitch: 1.02, rate: 0.84, vol: 0.6, prefer: ['Libby', 'Emma', 'Emily', 'Moira', 'Serena', 'Zira'] },
};

// Ποιοι παίρνουν πρώτοι "δική τους" φωνή (οι υπόλοιποι μοιράζονται).
const SPEECH_ORDER = ['narrator', 'orpheus', 'eurydice', 'hades', 'charon', 'persephone', 'erinys', 'shade', 'shadeF', 'soulOld', 'soulM', 'soulF'];

const VOICE_FEMALE = /female|zira|hazel|susan|samantha|victoria|karen|moira|tessa|fiona|aria|jenny|libby|sonia|natasha|emma|emily|olivia|catherine|serena|ava\b|allison|kate|linda|heera|michelle|clara|elizabeth|martha|nicky|molly|neerja|leah|luna|maisie|ana\b|google us english/i;
const VOICE_MALE = /\bmale|david|mark|george|daniel|alex\b|fred|ryan|guy|james|thomas|oliver|arthur|brian|christopher|eric|roger|richard|william|sean|liam|tony|rishi|aaron|andrew|davis|steffan|connor|gordon|tom\b|evan|nathan|mitchell|prabhat|wayne|luke/i;

const Voice = {
  _voices: null,
  _cast: null,       // χαρακτήρας → φωνή
  _timers: [],       // φράσεις που περιμένουν (delay), για να ακυρώνονται στο stop()
  _cancelAt: 0,
  _pending: 0,       // φράσεις στην ουρά του browser

  // Πόσο "φυσική" ακούγεται μια φωνή: neural / online > Google > Mac/iPhone > παλιές των Windows.
  quality(v) {
    const n = v.name;
    if (/natural|neural/i.test(n)) return 4;
    if (/online|google/i.test(n)) return 3;
    if (/premium|enhanced|siri/i.test(n)) return 3;
    if (!/microsoft/i.test(n)) return 2;
    return 1;
  },

  // Οι αγγλικές φωνές του browser, χωρισμένες σε γυναικείες / αντρικές (από το όνομά τους).
  speechVoices() {
    if (!('speechSynthesis' in window)) return null;
    if (this._voices && this._voices.all.length) return this._voices;
    const all = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
    // Οι καλύτερες πρώτα· στην ίδια ποιότητα, βρετανικά αγγλικά (ταιριάζουν στον μύθο) πριν από τα άλλα.
    all.sort((a, b) => this.quality(b) - this.quality(a) || (/GB/i.test(b.lang) ? 1 : 0) - (/GB/i.test(a.lang) ? 1 : 0));
    const f = all.filter((v) => VOICE_FEMALE.test(v.name));
    const m = all.filter((v) => !VOICE_FEMALE.test(v.name) && VOICE_MALE.test(v.name));
    this._voices = { all, f, m };
    this._cast = null;
    return this._voices;
  },

  // Μοιράζει τις φωνές στους χαρακτήρες: ο καθένας την πρώτη από τις προτιμήσεις του που δεν έχει
  // πάρει άλλος· αν δεν βρεθεί, την καλύτερη ελεύθερη του φύλου του· αν έχουν τελειώσει, μοιράζονται.
  cast() {
    if (this._cast) return this._cast;
    const V = this.speechVoices();
    const cast = {};
    if (!V || !V.all.length) return cast;
    const used = new Set();
    for (const who of SPEECH_ORDER) {
      const sp = SPEECH[who];
      const pool = (sp.g === 'f' ? V.f : V.m).length ? (sp.g === 'f' ? V.f : V.m) : V.all;
      const best = Math.max(...pool.map((v) => this.quality(v)));
      // Μόνο φωνές της καλύτερης διαθέσιμης ποιότητας (μια παλιά φωνή ανάμεσα σε φυσικές ξενίζει).
      const good = pool.filter((v) => this.quality(v) >= Math.min(best, 3));
      const byPref = (list) => {
        for (const name of sp.prefer) {
          const v = list.find((x) => x.name.toLowerCase().includes(name.toLowerCase()));
          if (v) return v;
        }
        return null;
      };
      const free = good.filter((v) => !used.has(v));
      const v = byPref(free) || free[0] || byPref(good) || good[SPEECH_ORDER.indexOf(who) % good.length];
      cast[who] = v;
      used.add(v);
    }
    this._cast = cast;
    return cast;
  },

  // Φωνές: αν το θέλει ο παίκτης (Settings.voice) και ο browser έχει αγγλικές φωνές.
  enabled() {
    if (typeof Settings !== 'undefined' && Settings.voice === 'off') return false;
    const v = this.speechVoices();
    return !!(v && v.all.length);
  },

  // Πόσο θα κρατήσει περίπου μια φράση (δευτ.) — για να μένει ο υπότιτλος όσο χρειάζεται.
  duration(text, who) {
    const sp = SPEECH[who] || SPEECH.narrator;
    const words = text.split(/\s+/).filter(Boolean).length;
    const pauses = (text.match(/\.\.\.|[.,!?;:]/g) || []).length;
    return words / (2.6 * sp.rate) + pauses * 0.28 + 0.4;
  },

  stop() {
    for (const t of this._timers) clearTimeout(t);
    this._timers = [];
    if ('speechSynthesis' in window && (speechSynthesis.speaking || speechSynthesis.pending)) {
      speechSynthesis.cancel();
      this._cancelAt = performance.now();
    }
    this._pending = 0;
  },

  // Λέει μια φράση. opts: { x, y } = από εκείνο το σημείο του κόσμου (πιο σιγά όσο πιο μακριά),
  // fade: true = σιγανά (σβήνει στη σιωπή), delay: δευτ. πριν ξεκινήσει.
  // Επιστρέφει πόσο κρατάει (δευτ.) — για τον υπότιτλο.
  say(text, who, opts = {}) {
    const sp = SPEECH[who] || SPEECH.narrator;
    const dur = this.duration(text, who);
    if (!this.enabled() || (typeof Sound !== 'undefined' && Sound.muted)) return dur;
    let near = 1;
    if (opts.x !== undefined) {
      const d = Math.hypot(opts.x - Sound.listenerX, opts.y - Sound.listenerY);
      near = Math.max(0, 1 - d / 650);
      if (near < 0.05) return dur;
      // Φωνές του κόσμου: όχι πολλές μαζί στην ουρά (θα ακούγονταν πολύ μετά τον υπότιτλό τους).
      if (this._pending > 1) return dur;
    }
    const voice = this.cast()[who];
    const u = new SpeechSynthesisUtterance(text);
    if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-GB';
    // Οι φυσικές φωνές χαλάνε με μεγάλες αλλαγές τόνου: σε αυτές μόνο το μισό της διαφοράς.
    // Οι παλιές (λίγες) φωνές των Windows τη χρειάζονται ολόκληρη για να ξεχωρίζουν οι χαρακτήρες.
    const natural = voice && this.quality(voice) >= 3;
    const V = this.speechVoices();
    const wrongSex = !(sp.g === 'f' ? V.f : V.m).length;
    let pitch = 1 + (sp.pitch - 1) * (natural ? 0.5 : 1);
    if (wrongSex) pitch += sp.g === 'f' ? 0.35 : -0.2;
    // Λίγη ζωντάνια: κάθε φορά λίγο διαφορετικά.
    u.pitch = Math.max(0.5, Math.min(1.6, pitch + (Math.random() - 0.5) * 0.04));
    u.rate = sp.rate * (1 + (Math.random() - 0.5) * 0.04);
    u.volume = Math.max(0.05, Math.min(1, sp.vol * (opts.fade ? 0.45 : 1) * (0.3 + 0.7 * near)));
    const done = () => { this._pending = Math.max(0, this._pending - 1); };
    u.onend = done;
    u.onerror = done;
    const go = () => {
      this._pending++;
      speechSynthesis.speak(u);
    };
    // Αμέσως μετά από cancel() ο Chrome μερικές φορές "τρώει" την επόμενη φράση: μικρή αναμονή.
    const wait = Math.max((opts.delay || 0) * 1000, this._cancelAt + 80 - performance.now());
    if (wait > 0) {
      const id = setTimeout(() => {
        this._timers = this._timers.filter((t) => t !== id);
        go();
      }, wait);
      this._timers.push(id);
    } else go();
    return dur;
  },
};

// Οι φωνές του browser φορτώνουν ασύγχρονα: όταν αλλάξουν, ξαναδιάβασέ τες.
if ('speechSynthesis' in window) {
  speechSynthesis.addEventListener('voiceschanged', () => { Voice._voices = null; Voice._cast = null; });
  speechSynthesis.getVoices();
}
