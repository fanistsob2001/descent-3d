'use strict';

// Μηνύματα χαμένων ψυχών (STORY.md, ενότητα 8): κρυμμένα στον χάρτη, φαίνονται
// μόνο όταν τα ακουμπήσει κύμα — ένα μικρό φωτεινό πνεύμα (pixel sprite) και από
// πάνω του τα λόγια του, που αναδύονται στο σκοτάδι.
const SOUL_HOLD = 5;          // πόσα δευτ. μένει καθαρό μετά το κύμα
const SOUL_FADE = 1.5;        // και μετά σβήνει σε τόσο
const SOUL_FONT = 14;         // μέγεθος γραμμάτων σε μονάδες κόσμου (~12px σε κινητό)
const SOUL_WIDTH = 210;       // πλάτος γραμμής πριν αλλάξει σειρά
const SOUL_ABOVE = 34;        // πόσο πάνω από το πνεύμα είναι η τελευταία γραμμή
// Ποια φωνή έχει κάθε ψυχή (1..9), ανάλογα με το ποιος μιλάει (STORY.md, ενότητα 10).
const SOUL_VOICES = ['soulM', 'soulOld', 'soulF', 'soulM', 'soulF', 'soulF', 'soulM', 'soulF', 'soulOld'];

const Souls = {
  list: [],   // { n, x, y, lines, revealTime, onHear }

  reset() {
    this.list = Level.souls.map((s) => ({
      n: s.n, x: s.x, y: s.y, lines: null, revealTime: -1e6,
      spokeAt: -1e6,
      onHear(wave, d, los) {
        if (!los || wave.kind === 'step') return;   // τα βήματα είναι πολύ αχνά για να τα φέρουν
        this.revealTime = Echoes.now;
        if (typeof Missions !== 'undefined') Missions.heard.add(this.n);   // αποστολή "Voices of the lost"
        // Ψιθυρίζει τα λόγια της (όχι ξανά μέσα σε 12 δευτ.).
        if (Echoes.now - this.spokeAt > 12) {
          this.spokeAt = Echoes.now;
          Voice.say(STORY.souls[this.n - 1], SOUL_VOICES[this.n - 1], { x: this.x, y: this.y, delay: 0.3 });
        }
      },
    }));
  },

  alpha(s, now) {
    const age = now - s.revealTime;
    if (age < 0 || age > SOUL_HOLD + SOUL_FADE) return 0;
    const fadeIn = Math.min(1, age / 0.6);
    const fadeOut = age < SOUL_HOLD ? 1 : 1 - (age - SOUL_HOLD) / SOUL_FADE;
    return fadeIn * fadeOut;
  },

  // Χωρίζει το κείμενο σε γραμμές που χωράνε στο SOUL_WIDTH.
  wrap(ctx, text) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (line && ctx.measureText(test).width > SOUL_WIDTH) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  },

  // Τα πνεύματα, στον μικρό καμβά του pixel art (τα λόγια ζωγραφίζονται μετά, από πάνω).
  drawSpirits(ctx, now, view) {
    for (const s of this.list) {
      if (s.x < view.x0 - TILE || s.x > view.x1 + TILE || s.y < view.y0 - TILE || s.y > view.y1 + TILE) continue;
      const a = this.alpha(s, now);
      if (a < 0.01) continue;
      const bob = Math.sin(now * 2 + s.n) * 2;
      const R = 24;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(s.x, s.y + bob, 0, s.x, s.y + bob, R);
      g.addColorStop(0, `rgba(${POT.cream},${(a * 0.3).toFixed(3)})`);
      g.addColorStop(1, `rgba(${POT.cream},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y + bob, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      Sprites.draw(ctx, 'soul', Math.floor(now * 2 + s.n), s.x, s.y + bob, { alpha: a * 0.9, center: true });
    }
  },

  draw(ctx, now, view) {
    ctx.font = `italic ${SOUL_FONT}px Georgia, 'Times New Roman', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const s of this.list) {
      if (s.x < view.x0 - SOUL_WIDTH || s.x > view.x1 + SOUL_WIDTH ||
          s.y < view.y0 - TILE * 2 || s.y > view.y1 + TILE * 2) continue;
      const a = this.alpha(s, now);
      if (a < 0.01) continue;
      if (!s.lines) s.lines = this.wrap(ctx, STORY.souls[s.n - 1]);

      const lh = SOUL_FONT * 1.35;
      // Τα λόγια πάνω από το πνεύμα.
      const top = s.y - SOUL_ABOVE - (s.lines.length - 1) * lh;
      // Σκοτεινό "φόντο" ώστε να διαβάζεται πάνω από τους φωτισμένους τοίχους.
      ctx.fillStyle = `rgba(0,0,0,${(a * 0.7).toFixed(3)})`;
      ctx.fillRect(s.x - SOUL_WIDTH / 2 - 6, top - lh / 2 - 4, SOUL_WIDTH + 12, s.lines.length * lh + 8);
      ctx.fillStyle = `rgba(${POT.cream},${(a * 0.85).toFixed(3)})`;
      s.lines.forEach((l, i) => ctx.fillText(l, s.x, top + i * lh));
    }
  },
};
