'use strict';

// Αποστολές (STORY.md, ενότητα 11): ο σκοπός, η κύρια αποστολή κάθε κεφαλαίου και οι δευτερεύουσες.
// Η πρόοδος των δευτερευουσών βγαίνει από ό,τι ήδη ξέρει το παιχνίδι (χορδές, οβολός, αγγεία, βωμοί)·
// μόνο οι ψυχές που άκουσες (heard) και τα μυστικά που βρήκες (secrets) κρατιούνται εδώ, και μπαίνουν
// στο save μαζί με τα υπόλοιπα (όπως τα αντικείμενα: ό,τι έγινε μετά τον τελευταίο βωμό χάνεται στον θάνατο).

const Missions = {
  heard: new Set(),     // οι αριθμοί (1..9) των ψυχών που άκουσες
  secrets: new Set(),   // 'cerberus', 'stuck'
  done: new Set(),      // ποιες δευτερεύουσες έχουν ήδη ολοκληρωθεί (για να μη βγαίνει ξανά το μήνυμα)
  pending: [],          // μηνύματα ολοκλήρωσης που περιμένουν να ελευθερωθεί το Notice
  _checkAt: 0,

  // saved = το save (ή Save.fresh()).
  reset(saved) {
    this.heard = new Set(Array.isArray(saved.heard) ? saved.heard : []);
    this.secrets = new Set(Array.isArray(saved.secrets) ? saved.secrets : []);
    this.pending = [];
    // Όσες είναι ήδη ολοκληρωμένες δεν ξαναβγάζουν μήνυμα.
    this.done = new Set(STORY.sideMissions.filter((m) => this.progress(m.id).done).map((m) => m.id));
  },

  saveData() {
    return { heard: [...this.heard], secrets: [...this.secrets] };
  },

  // Η πρόοδος μιας δευτερεύουσας: { cur, total, done }.
  progress(id) {
    let cur = 0, total = 1;
    if (id === 'strings') { cur = strings; total = 3; }
    else if (id === 'obol') { cur = Charon.paid ? 1 : 0; }
    else if (id === 'souls') { cur = this.heard.size; total = Level.souls.length; }
    else if (id === 'jars') {
      // Φτιάξε και τα τέσσερα αντικείμενα σε ένα ιερό (τα αγγεία δεν βρίσκονται πια σκόρπια).
      cur = RECIPES.filter((r) => Inventory.made.has(r.id)).length;
      total = RECIPES.length;
    } else if (id === 'altars') { cur = Altars.list.filter((a) => a.lit).length; total = Altars.list.length; }
    else { cur = this.secrets.has(id) ? 1 : 0; }
    return { cur, total, done: cur >= total };
  },

  // Η κύρια αποστολή του κεφαλαίου όπου βρίσκεσαι.
  mainTitle(region) {
    return STORY.missionMain[Math.max(0, Math.min(STORY.missionMain.length - 1, region))];
  },

  // Κάθε καρέ (όσο παίζεις): μόλις ολοκληρωθεί μια δευτερεύουσα, μήνυμα και ήχος λύρας.
  update(now) {
    if (now >= this._checkAt) {
      this._checkAt = now + 0.4;
      for (const m of STORY.sideMissions) {
        if (this.done.has(m.id) || !this.progress(m.id).done) continue;
        this.done.add(m.id);
        this.pending.push(m.title);
      }
    }
    if (this.pending.length && !Notice.busy(now)) {
      Notice.show(STORY.missionComplete(this.pending.shift()), now, 4.5);
      Sound.stringFound(2);
    }
  },
};
