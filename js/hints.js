'use strict';

// Μηνύματα στην οθόνη, το ένα μετά το άλλο (ουρά).
//   touch / keys: κείμενο για κινητό / υπολογιστή (αν λείπει το keys, χρησιμοποιείται το touch)
//   until: 'move' | 'call' | 'run' | 'jar' | 'melody' — προχωράει όταν το κάνει ο παίκτης
//   time:  δευτ. — προχωράει μόνο του μετά από τόσο χρόνο (ή μέγιστος χρόνος για το until)
//   title: { numeral, name, line } — αντί για κείμενο, δείχνει τον τίτλο κεφαλαίου
//          στη μέση της οθόνης (μέσω του onTitle)
const HINT_MIN_TIME = 2;     // κάθε οδηγία μένει τουλάχιστον τόσο (δευτ.)
const HINT_GAP = 0.8;        // κενό ανάμεσα σε δύο μηνύματα
// Πόση ώρα πρέπει να κρατήσει μια "συνεχής" ενέργεια για να μετρήσει.
const HINT_HOLD = { move: 0.8, sneak: 1.2 };

const Hints = {
  el: null,
  touch: true,
  list: [],
  idx: -1,
  showing: false,
  shownAt: 0,
  nextAt: 0,
  progress: 0,
  done: false,
  onTitle: null,

  init(el) {
    this.el = el;
    this.touch = matchMedia('(pointer: coarse)').matches;
  },

  // Αντικαθιστά ό,τι έδειχνε με νέα λίστα.
  start(list, now) {
    this.list = (list || []).slice();
    this.idx = -1;
    this.showing = false;
    this.nextAt = now + HINT_GAP;
    this.el.classList.remove('visible');
  },

  // Προσθέτει μηνύματα στο τέλος της ουράς.
  push(list) {
    this.list.push(...list);
  },

  stop() {
    this.list = [];
    this.idx = -1;
    this.showing = false;
    this.el.classList.remove('visible');
  },

  // Ο παίκτης έκανε κάτι ('move', 'call', 'run', 'jar', 'melody'). dt για τις συνεχείς ενέργειες.
  notify(event, dt = 0) {
    if (!this.showing) return;
    const h = this.list[this.idx];
    if (h.until !== event) return;
    if (HINT_HOLD[event]) {
      this.progress += dt;
      if (this.progress >= HINT_HOLD[event]) this.done = true;
    } else {
      this.done = true;
    }
  },

  update(now) {
    if (this.showing) {
      const h = this.list[this.idx];
      const elapsed = now - this.shownAt;
      const finished = (this.done && elapsed >= HINT_MIN_TIME) || (h.time && elapsed >= h.time);
      if (finished) {
        this.showing = false;
        this.nextAt = now + HINT_GAP;
        this.el.classList.remove('visible');
      }
    } else if (this.idx + 1 < this.list.length && now >= this.nextAt) {
      this.idx++;
      const h = this.list[this.idx];
      if (h.title) {
        if (this.onTitle) this.onTitle(h.title);
      } else {
        this.el.textContent = this.touch ? h.touch : (h.keys || h.touch);
        this.el.classList.add('visible');
      }
      this.showing = true;
      this.shownAt = now;
      this.progress = 0;
      this.done = false;
    }
  },
};

// Άμεσα μηνύματα (αντικείμενα, Χάροντας κ.λπ.): βγαίνουν αμέσως, σε δικό τους
// σημείο της οθόνης, χωρίς να διακόπτουν την ουρά του Hints.
const Notice = {
  el: null,
  until: 0,

  init(el) {
    this.el = el;
  },

  // Αν δοθεί then, δείχνει μετά (στη σειρά) και δεύτερο μήνυμα.
  // cls: στυλ του υπότιτλου ανάλογα με το ποιος μιλάει ('whisper', 'shade', 'charon').
  show(text, now, time = 5, then = null, cls = '') {
    this.el.textContent = text;
    this.el.classList.remove('whisper', 'shade', 'charon');
    if (cls) this.el.classList.add(cls);
    this.el.classList.add('visible');
    this.until = now + time;
    this.then = then;
  },

  // Δείχνει κάτι αυτή τη στιγμή;
  busy(now) {
    return this.until > now;
  },

  clear() {
    this.until = 0;
    this.then = null;
    this.el.classList.remove('visible');
  },

  update(now) {
    if (this.until && now >= this.until) {
      if (this.then) {
        const next = this.then;
        this.then = null;
        this.show(next.text, now, next.time);
        if (next.who) Voice.say(next.text, next.who);
        return;
      }
      this.until = 0;
      this.el.classList.remove('visible');
    }
  },
};
