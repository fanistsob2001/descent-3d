'use strict';

// Cutscenes (STORY.md, ενότητα 7): για κάθε γραμμή μια κινούμενη ζωγραφιά (js/cutart.js) και
// από κάτω η γραμμή, που τη λέει ο χαρακτήρας της. Άγγιγμα / κλικ / Space / Enter = επόμενη γραμμή, κουμπί Skip.
const CUT_MIN_GAP = 0.45;   // δευτ. — ώστε ένα διπλό άγγιγμα να μην πηδάει γραμμές

const Cutscene = {
  el: null,
  linesEl: null,
  lines: [],
  shown: 0,
  onEnd: null,
  lastAdvance: 0,
  active: false,

  init() {
    this.el = document.getElementById('cutscene');
    this.linesEl = document.getElementById('cut-lines');
    this.el.addEventListener('pointerup', (e) => {
      if (e.target.closest('#cut-skip')) return;
      e.preventDefault();
      this.advance();
    });
    document.getElementById('cut-skip').addEventListener('click', (e) => {
      e.preventDefault();
      this.finish();
    });
  },

  // style: '' | 'good' | 'bad' (λίγο διαφορετικό φόντο για τα τέλη)
  // art: 'intro' | 'middle' | 'good' | 'bad' — οι ζωγραφιές (js/cutart.js), μία για κάθε γραμμή
  // who: ποιος λέει κάθε γραμμή (π.χ. STORY.middleWho) — βλ. js/voice.js.
  play(lines, style, onEnd, art, who) {
    this.lines = lines;
    this.who = who || [];
    this.shown = 0;
    this.onEnd = onEnd;
    this.active = true;
    this.lastAdvance = 0;
    this.linesEl.textContent = '';
    this.el.className = 'overlay cutscene ' + (style || '');
    this.art = art;
    this.showNext();
  },

  showNext() {
    // Μία γραμμή τη φορά, κάτω από τη ζωγραφιά της (σαν υπότιτλος).
    const p = document.createElement('p');
    p.textContent = this.lines[this.shown];
    this.linesEl.textContent = '';
    this.linesEl.appendChild(p);
    requestAnimationFrame(() => p.classList.add('in'));
    const panels = CUT_PANELS[this.art];
    if (panels) CutArt.show(panels[Math.min(this.shown, panels.length - 1)]);
    this.shown++;
    this.el.classList.toggle('last', this.shown >= this.lines.length);
    // Η προηγούμενη φωνή σταματάει αν πατήσεις "επόμενη" πριν τελειώσει.
    Voice.stop();
    Voice.say(this.lines[this.shown - 1], this.who[this.shown - 1] || 'narrator');
  },

  advance() {
    if (!this.active) return;
    const now = performance.now() / 1000;
    if (now - this.lastAdvance < CUT_MIN_GAP) return;
    this.lastAdvance = now;
    if (this.shown < this.lines.length) this.showNext();
    else this.finish();
  },

  finish() {
    if (!this.active) return;
    Voice.stop();
    CutArt.stop();
    this.active = false;
    this.el.classList.add('hidden');
    const cb = this.onEnd;
    this.onEnd = null;
    if (cb) cb();
  },
};
