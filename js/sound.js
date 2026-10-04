'use strict';

// Όλοι οι ήχοι φτιάχνονται με κώδικα (Web Audio API) — κανένα αρχείο ήχου.
//
// Αλυσίδα:  ήχοι → sfx ─┬───────────────→ master → compressor → ηχεία
//                        ├→ echo (delay με feedback) ↗
//                        └→ reverb (convolver)       ↗
//           ambient ─────────────────────────────────↗
//
// Το AudioContext δημιουργείται στο πρώτο πάτημα κουμπιού (unlock), γιατί οι
// browsers — ειδικά το iPhone — δεν αφήνουν ήχο πριν αγγίξει ο χρήστης κάτι.
// Η ρύθμιση ήχος on/off αποθηκεύεται στο Settings (js/save.js).

const Sound = {
  ctx: null,
  muted: false,
  master: null,
  sfx: null,
  echoSend: null,
  reverbSend: null,
  ambient: null,
  noiseBuffer: null,
  growls: [],        // μία "φωνή" ανά τέρας
  listenerX: 0,      // θέση του παίκτη, για panning / απόσταση
  listenerY: 0,
  listenerAngle: 0,  // προς τα πού κοιτάει ο παίκτης (πρώτο πρόσωπο): το panning γυρίζει μαζί του

  loadSettings() {
    this.muted = !Settings.sound;
  },

  // Καλείται μέσα σε click / keydown handler.
  unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) {
      // iPhone: να παίζει ήχος και με τον διακόπτη σίγασης (όπου υποστηρίζεται).
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) { /* - */ }
      this.ctx = new AC();
      this.build();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    // Ένας "κενός" ήχος μέσα στο άγγιγμα ξεκλειδώνει τον ήχο στα παλιότερα iPhone.
    const b = this.ctx.createBufferSource();
    b.buffer = this.ctx.createBuffer(1, 1, 22050);
    b.connect(this.ctx.destination);
    b.start(0);
  },

  build() {
    const ac = this.ctx;

    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    comp.connect(ac.destination);

    this.master = ac.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(comp);

    this.sfx = ac.createGain();
    this.sfx.connect(this.master);

    // Ηχώ: delay με feedback και φίλτρο, ώστε κάθε επανάληψη να είναι πιο "θολή".
    this.echoSend = ac.createGain();
    const delay = ac.createDelay(1);
    delay.delayTime.value = 0.27;
    const fb = ac.createGain();
    fb.gain.value = 0.42;
    const damp = ac.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 2000;
    this.echoSend.connect(delay);
    delay.connect(damp);
    damp.connect(fb);
    fb.connect(delay);
    damp.connect(this.master);

    // Reverb από "τεχνητή" απόκριση χώρου: θόρυβος που σβήνει εκθετικά.
    this.reverbSend = ac.createGain();
    const conv = ac.createConvolver();
    conv.buffer = this.makeImpulse(2.8, 3);
    const revOut = ac.createGain();
    revOut.gain.value = 0.6;
    this.reverbSend.connect(conv);
    conv.connect(revOut);
    revOut.connect(this.master);

    this.noiseBuffer = this.makeNoise(2);
    this.buildAmbient();
  },

  makeNoise(seconds) {
    const ac = this.ctx;
    const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  },

  makeImpulse(seconds, decay) {
    const ac = this.ctx;
    const len = Math.floor(ac.sampleRate * seconds);
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  },

  noiseSource(loop = false) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = loop;
    if (loop) src.loopStart = Math.random();
    return src;
  },

  panner(pan) {
    if (!this.ctx.createStereoPanner) return null;   // πολύ παλιοί browsers: χωρίς panning
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    return p;
  },

  // Περιβάλλουσα έντασης: γρήγορη άνοδος, εκθετικό σβήσιμο.
  envelope(gainParam, t, peak, attack, decay) {
    gainParam.setValueAtTime(0.0001, t);
    gainParam.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    gainParam.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  },

  ready() {
    return this.ctx && this.ctx.state === 'running';
  },

  setMuted(m) {
    this.muted = m;
    Settings.sound = !m;
    Settings.store();
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
  },

  // Όταν η σελίδα κρύβεται, σταματάμε τον ήχο (π.χ. στο κινητό στο background).
  setBackground(hidden) {
    if (!this.ctx) return;
    if (hidden) this.ctx.suspend();
    else this.ctx.resume();
  },

  // ---- Συνεχές ambient βουητό ----
  buildAmbient() {
    const ac = this.ctx;
    this.ambient = ac.createGain();
    this.ambient.gain.value = 0;
    this.ambient.connect(this.master);

    // Χαμηλός "θόρυβος σπηλιάς" με φίλτρο που ανοιγοκλείνει πολύ αργά.
    const noise = this.noiseSource(true);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 160;
    lp.Q.value = 0.7;
    const noiseGain = ac.createGain();
    noiseGain.gain.value = 0.5;
    noise.connect(lp);
    lp.connect(noiseGain);
    noiseGain.connect(this.ambient);

    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoDepth = ac.createGain();
    lfoDepth.gain.value = 70;
    lfo.connect(lfoDepth);
    lfoDepth.connect(lp.frequency);

    // Δύο χαμηλοί τόνοι, λίγο "φάλτσοι" μεταξύ τους, για ανησυχητικό βουητό.
    for (const [freq, type, g] of [[36.7, 'sine', 0.35], [55.4, 'triangle', 0.1], [73.9, 'sine', 0.05]]) {
      const o = ac.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const og = ac.createGain();
      og.gain.value = g;
      o.connect(og);
      og.connect(this.ambient);
      o.start();
    }
    noise.start();
    lfo.start();
  },

  // Ένταση του ambient (0..1), με ομαλή μετάβαση.
  setAmbient(level) {
    if (!this.ambient) return;
    this.ambient.gain.setTargetAtTime(level * 0.22, this.ctx.currentTime, 1.2);
  },

  // ---- Ηχητικά εφέ ----

  // Η φωνή του Ορφέα: ένα τραγουδιστό "Αα" που σβήνει μέσα στη σπηλιά, σαν να φωνάζει
  // στο σκοτάδι. Μικρό κύμα = απαλό, ψηλό μουρμουρητό ("Μμ"). Μεγάλο κύμα = βαθύ,
  // δυνατό, ανοιχτό "Αα". Φτιαγμένη με φωνηεντικά φίλτρα (formants) πάνω σε πριονωτούς
  // τόνους, με δονισμό (vibrato) και λίγη ανάσα. lyre = η λύρα είναι ολόκληρη: ακούγεται
  // και μια χορδή της μαζί με τη φωνή.
  voice(size, lyre) {
    if (!this.ready()) return;
    const ac = this.ctx, t = ac.currentTime;
    const f0 = 262 * Math.pow(131 / 262, size);          // 262 Hz (μικρό) → 131 Hz (μεγάλο)
    const dur = 0.5 + 1.2 * size;
    const peak = 0.11 + 0.3 * size;

    const out = ac.createGain();
    out.connect(this.sfx);
    const send = ac.createGain();
    send.gain.value = 0.7 + 0.25 * size;
    out.connect(send);
    send.connect(this.echoSend);
    send.connect(this.reverbSend);
    this.envelope(out.gain, t, peak, 0.06, dur);

    // Πηγή: δύο πριονωτοί τόνοι ελαφρά ξεκούρδιστοι + ένας τριγωνικός μια οκτάβα πάνω.
    const mix = ac.createGain();
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4200;
    mix.connect(lp);

    const vib = ac.createOscillator();      // δονισμός: μπαίνει σιγά σιγά, όπως στους τραγουδιστές
    vib.frequency.value = 5.3;
    const vibGain = ac.createGain();
    vibGain.gain.setValueAtTime(0, t);
    vibGain.gain.linearRampToValueAtTime(f0 * 0.014, t + 0.3);
    vib.connect(vibGain);
    vib.start(t);
    vib.stop(t + dur + 0.4);

    for (const [type, mul, detune, amp] of [['sawtooth', 1, -7, 0.5], ['sawtooth', 1, 7, 0.5], ['triangle', 2, 0, 0.25]]) {
      const o = ac.createOscillator();
      o.type = type;
      o.detune.value = detune;
      o.frequency.setValueAtTime(f0 * mul * 1.05, t);
      o.frequency.exponentialRampToValueAtTime(f0 * mul, t + 0.09);
      o.frequency.linearRampToValueAtTime(f0 * mul * 0.955, t + dur);   // η φωνή πέφτει στο τέλος
      vibGain.connect(o.frequency);
      const g = ac.createGain();
      g.gain.value = amp;
      o.connect(g);
      g.connect(mix);
      o.start(t);
      o.stop(t + dur + 0.4);
    }

    // Φωνηεντικά φίλτρα: το στόμα ανοίγει από "Μμ" προς "Αα" στην αρχή της νότας.
    const open = 0.25 + 0.75 * size;                     // πόσο ανοιχτό καταλήγει το στόμα
    const formants = [
      [270, 730, 10, 1.0],                             // F1: κλειστό → ανοιχτό
      [800, 1090, 12, 0.45],                           // F2
      [2500, 2440, 14, 0.2],                           // F3
    ];
    for (const [fClosed, fOpen, q, gain] of formants) {
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = q;
      const target = fClosed + (fOpen - fClosed) * open;
      bp.frequency.setValueAtTime(fClosed, t);
      bp.frequency.linearRampToValueAtTime(target, t + 0.22);
      const g = ac.createGain();
      g.gain.value = gain * 4.6;
      lp.connect(bp);
      bp.connect(g);
      g.connect(out);
    }

    // Λίγη ανάσα στην αρχή της νότας.
    const n = this.noiseSource();
    const nbp = ac.createBiquadFilter();
    nbp.type = 'bandpass';
    nbp.frequency.value = 2600;
    nbp.Q.value = 0.8;
    const ng = ac.createGain();
    this.envelope(ng.gain, t, 0.05 + 0.05 * size, 0.03, 0.22);
    n.connect(nbp);
    nbp.connect(ng);
    ng.connect(out);
    n.start(t, Math.random());
    n.stop(t + 0.3);

    // Η χορδή της λύρας μαζί με τη φωνή (Ρε δώριος, ίδια με τη Μελωδία).
    if (lyre) this.pluck(size > 0.5 ? 146.83 : 293.66, t + 0.03, 0.26);
  },

  // Βήμα: πολύ σύντομος φιλτραρισμένος θόρυβος.
  step() {
    if (!this.ready()) return;
    const ac = this.ctx, t = ac.currentTime;
    const src = this.noiseSource();
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420 + Math.random() * 380;
    const g = ac.createGain();
    this.envelope(g.gain, t, 0.09 + Math.random() * 0.03, 0.004, 0.07);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.sfx);
    src.start(t, Math.random() * 1.5);
    src.stop(t + 0.12);
  },

  // Πέταγμα αγγείου: σύντομο "φσστ".
  jarThrow() {
    if (!this.ready()) return;
    const ac = this.ctx, t = ac.currentTime;
    const src = this.noiseSource();
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(2500, t);
    bp.frequency.exponentialRampToValueAtTime(900, t + 0.2);
    const g = ac.createGain();
    this.envelope(g.gain, t, 0.12, 0.02, 0.2);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfx);
    src.start(t, Math.random());
    src.stop(t + 0.3);
  },

  // Πόσο δεξιά (θετικό) ή αριστερά (αρνητικό) βρίσκεται ένα σημείο (dx, dy από τον παίκτη)
  // σε σχέση με το πού κοιτάει.
  lateral(dx, dy) {
    return -Math.sin(this.listenerAngle) * dx + Math.cos(this.listenerAngle) * dy;
  },

  // Ένας ήχος από τη θέση (x, y) του κόσμου: ένταση και panning ανάλογα με
  // το πού είναι σε σχέση με τον παίκτη. Επιστρέφει τον κόμβο εξόδου.
  spatial(x, y, baseVol, falloff) {
    const dx = x - this.listenerX, dy = y - this.listenerY;
    const g = this.ctx.createGain();
    g.gain.value = baseVol * Math.max(0.15, 1 - Math.hypot(dx, dy) / falloff);
    const pan = this.panner(this.lateral(dx, dy) / 300);
    if (pan) { g.connect(pan); pan.connect(this.sfx); pan.connect(this.echoSend); }
    else { g.connect(this.sfx); g.connect(this.echoSend); }
    return g;
  },

  // Αγγείο σπονδής που σπάει: χτύπος + θόρυβος + κεραμικά "τσιν".
  shatter(x, y) {
    if (!this.ready()) return;
    const ac = this.ctx, t = ac.currentTime;
    const out = this.spatial(x, y, 1, 750);

    const thud = ac.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(140, t);
    thud.frequency.exponentialRampToValueAtTime(50, t + 0.15);
    const tg = ac.createGain();
    this.envelope(tg.gain, t, 0.5, 0.003, 0.18);
    thud.connect(tg);
    tg.connect(out);
    thud.start(t);
    thud.stop(t + 0.25);

    const noise = this.noiseSource();
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    const ng = ac.createGain();
    this.envelope(ng.gain, t, 0.45, 0.002, 0.35);
    noise.connect(hp);
    hp.connect(ng);
    ng.connect(out);
    noise.start(t, Math.random());
    noise.stop(t + 0.45);

    for (let i = 0; i < 7; i++) {
      const tt = t + 0.01 + Math.random() * 0.28;
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.value = 2200 + Math.random() * 3500;
      const g = ac.createGain();
      this.envelope(g.gain, tt, 0.06 + Math.random() * 0.06, 0.002, 0.06 + Math.random() * 0.1);
      o.connect(g);
      g.connect(out);
      o.start(tt);
      o.stop(tt + 0.25);
    }
  },

  // Μεταλλικό "κλινκ" νομίσματος (δύο φάλτσοι υψηλοί τόνοι).
  coin() {
    if (!this.ready()) return;
    const ac = this.ctx, t = ac.currentTime;
    for (const [dt, f] of [[0, 2637], [0.09, 3520]]) {
      for (const mul of [1, 2.71]) {
        const o = ac.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * mul;
        const g = ac.createGain();
        this.envelope(g.gain, t + dt, mul > 1 ? 0.03 : 0.1, 0.002, 0.5);
        o.connect(g);
        g.connect(this.sfx);
        g.connect(this.reverbSend);
        o.start(t + dt);
        o.stop(t + dt + 0.6);
      }
    }
  },

  // Μαζεύεις αγγείο: σύντομο κεραμικό "τοκ".
  jarPickup() {
    if (!this.ready()) return;
    const ac = this.ctx, t = ac.currentTime;
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(620, t);
    o.frequency.exponentialRampToValueAtTime(480, t + 0.1);
    const g = ac.createGain();
    this.envelope(g.gain, t, 0.15, 0.003, 0.14);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + 0.2);
  },

  // Νότα "λύρας" με τον αλγόριθμο Karplus-Strong: θόρυβος μέσα σε μια γραμμή
  // καθυστέρησης που μαλακώνει κάθε φορά — ακούγεται σαν χορδή που τσιμπιέται.
  pluckBuffers: {},
  pluckBuffer(freq) {
    const key = Math.round(freq);
    if (this.pluckBuffers[key]) return this.pluckBuffers[key];
    const ac = this.ctx, sr = ac.sampleRate;
    const len = Math.floor(sr * 2.2);
    const buf = ac.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const period = Math.max(2, Math.round(sr / freq));
    const line = new Float32Array(period);
    for (let i = 0; i < period; i++) line[i] = Math.random() * 2 - 1;
    let p = 0;
    for (let i = 0; i < len; i++) {
      const next = (p + 1) % period;
      const v = line[p];
      line[p] = 0.996 * 0.5 * (v + line[next]);
      d[i] = v;
      p = next;
    }
    this.pluckBuffers[key] = buf;
    return buf;
  },

  pluck(freq, when, vol) {
    const ac = this.ctx;
    const src = ac.createBufferSource();
    src.buffer = this.pluckBuffer(freq);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3500;
    const g = ac.createGain();
    g.gain.value = vol;
    src.connect(lp);
    lp.connect(g);
    g.connect(this.sfx);
    g.connect(this.reverbSend);
    src.start(when);
  },

  // Βρήκες χορδή: μία νότα λύρας (n = ποια χορδή, 1..3 — κάθε φορά πιο ψηλά).
  stringFound(n) {
    if (!this.ready()) return;
    const t = this.ctx.currentTime;
    const notes = [293.66, 349.23, 440];
    this.pluck(notes[Math.max(0, Math.min(2, n - 1))], t, 0.5);
    if (n >= 3) {
      // Η λύρα ξανά ολόκληρη: και οι τρεις χορδές μαζί.
      notes.forEach((f, i) => this.pluck(f, t + 0.35 + i * 0.12, 0.35));
    }
  },

  // Η Μελωδία: ένα αργό arpeggio λύρας (Ρε δώριος) με πολύ reverb.
  melody() {
    if (!this.ready()) return;
    const t = this.ctx.currentTime;
    const seq = [293.66, 349.23, 440, 523.25, 440, 392, 349.23, 293.66];
    seq.forEach((f, i) => this.pluck(f, t + i * 0.16, 0.45));
    this.pluck(146.83, t, 0.3);
  },

  // Τα βήματα της Ευρυδίκης: πιο απαλά και πιο "ελαφριά" από του παίκτη,
  // από τη θέση της (πίσω σου) — χωρίς ηχώ, για να μένουν κοντινά και προσωπικά.
  softStep(x, y) {
    if (!this.ready()) return;
    const ac = this.ctx, t = ac.currentTime;
    const dx = this.lateral(x - this.listenerX, y - this.listenerY);
    const src = this.noiseSource();
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900 + Math.random() * 300;
    bp.Q.value = 0.9;
    const g = ac.createGain();
    this.envelope(g.gain, t, 0.05 + Math.random() * 0.015, 0.006, 0.09);
    src.connect(bp);
    bp.connect(g);
    const pan = this.panner(dx / 120);
    if (pan) { g.connect(pan); pan.connect(this.sfx); } else g.connect(this.sfx);
    src.start(t, Math.random() * 1.5);
    src.stop(t + 0.14);
  },

  // Ψίθυρος "Or-phe-us...": θόρυβος μέσα από φίλτρα φωνηέντων, με πολύ reverb.
  whisper() {
    if (!this.ready()) return;
    const ac = this.ctx, t = ac.currentTime + 0.1;
    // [πότε, διάρκεια, κεντρική συχνότητα, ένταση] — "Or", "phe", "u", "s"
    const syllables = [[0, 0.32, 650, 0.22], [0.36, 0.2, 2600, 0.16], [0.58, 0.3, 900, 0.2], [0.86, 0.45, 5200, 0.12]];
    for (const [dt, dur, f, vol] of syllables) {
      const src = this.noiseSource();
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = f > 2000 ? 1.5 : 5;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(vol, t + dt + dur * 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + dur);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.sfx);
      g.connect(this.reverbSend);
      src.start(t + dt, Math.random());
      src.stop(t + dt + dur + 0.05);
    }
  },

  // Απαλή νότα λύρας για κάθε γραμμή μιας cutscene (ανεβαίνει σιγά σιγά).
  cutLine(i) {
    if (!this.ready()) return;
    const notes = [146.83, 174.61, 220, 196, 261.63, 220, 293.66, 261.63, 220];
    this.pluck(notes[i % notes.length], this.ctx.currentTime, 0.22);
  },

  // Easter egg A: η σκιά χτυπάει στον τοίχο — ένα κούφιο "μπονκ".
  // Ακούγεται μόνο αν είσαι κοντά (αλλιώς θα αντηχούσε σε όλο τον χάρτη).
  bonk(x, y) {
    if (!this.ready()) return;
    const d = Math.hypot(x - this.listenerX, y - this.listenerY);
    if (d > 360) return;
    const ac = this.ctx, t = ac.currentTime;
    const out = this.spatial(x, y, 0.45 * (1 - d / 360), 360);
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.12);
    const g = ac.createGain();
    this.envelope(g.gain, t, 0.5, 0.004, 0.16);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + 0.22);
  },

  // Easter egg B: ένα γάβγισμα του Κέρβερου (freq = πόσο βαθύ), μετά από delay δευτ.
  // Δεν είναι κύμα του παιχνιδιού — οι σκιές δεν το ακούνε.
  bark(x, y, freq, delay) {
    if (!this.ready()) return;
    const ac = this.ctx, t = ac.currentTime + delay;
    const out = this.spatial(x, y, 0.9, 600);
    // Φωνή: πριονωτός τόνος που πέφτει απότομα, μέσα από φίλτρο "στόματος".
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq * 1.5, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.2);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq * 3.2;
    bp.Q.value = 1.4;
    const g = ac.createGain();
    this.envelope(g.gain, t, 0.5, 0.01, 0.2);
    o.connect(bp);
    bp.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + 0.3);
    // Λίγη "ανάσα" στην αρχή του γαβγίσματος.
    const n = this.noiseSource();
    const hp = ac.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = freq * 6;
    const ng = ac.createGain();
    this.envelope(ng.gain, t, 0.18, 0.005, 0.08);
    n.connect(hp);
    hp.connect(ng);
    ng.connect(out);
    n.start(t, Math.random());
    n.stop(t + 0.12);
  },

  // Ακύρωση κύματος: ένα απαλό "φσσσ" που πέφτει — ο ήχος δεν βγήκε ποτέ.
  cancel() {
    if (!this.ready()) return;
    const ac = this.ctx, t = ac.currentTime;
    const n = this.noiseSource();
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(1800, t);
    bp.frequency.exponentialRampToValueAtTime(300, t + 0.25);
    const g = ac.createGain();
    this.envelope(g.gain, t, 0.06, 0.01, 0.25);
    n.connect(bp);
    bp.connect(g);
    g.connect(this.sfx);
    n.start(t, Math.random());
    n.stop(t + 0.3);
  },

  // Ένταση στο κεφ. V όσο φορτίζεις πέρα από το όριο "κοιτάζω πίσω": ένα δυσαρμονικό
  // βουητό (μικρή δεύτερη) που ανεβαίνει και δυναμώνει, μαζί με τρεμάμενο θόρυβο.
  tension(on) {
    if (!this.ctx) return;
    const ac = this.ctx, t = ac.currentTime;
    if (on) {
      if (this._tension) return;
      const out = ac.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.22, t + 0.9);
      out.connect(this.sfx);
      out.connect(this.reverbSend);
      const nodes = [];
      for (const [f, type] of [[110, 'sawtooth'], [116.5, 'sawtooth'], [220, 'triangle']]) {
        const o = ac.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 1.5, t + 2.5);   // ανεβαίνει όσο κρατάς
        const lp = ac.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 900;
        o.connect(lp);
        lp.connect(out);
        o.start(t);
        nodes.push(o);
      }
      // Τρέμουλο έντασης σαν γρήγορη ανάσα.
      const lfo = ac.createOscillator();
      lfo.frequency.value = 7;
      const lg = ac.createGain();
      lg.gain.value = 0.08;
      lfo.connect(lg);
      lg.connect(out.gain);
      lfo.start(t);
      nodes.push(lfo);
      this._tension = { out, nodes };
    } else if (this._tension) {
      const { out, nodes } = this._tension;
      this._tension = null;
      out.gain.cancelScheduledValues(t);
      out.gain.setTargetAtTime(0.0001, t, 0.08);
      for (const n of nodes) n.stop(t + 0.5);
    }
  },

  // Ο Χάροντας δεν παίρνει τίποτα: χαμηλό, κούφιο μουρμουρητό.
  charonRefuse() {
    if (!this.ready()) return;
    const ac = this.ctx, t = ac.currentTime;
    const noise = this.noiseSource();
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 220;
    bp.Q.value = 3;
    const g = ac.createGain();
    this.envelope(g.gain, t, 0.25, 0.2, 0.9);
    noise.connect(bp);
    bp.connect(g);
    g.connect(this.sfx);
    g.connect(this.reverbSend);
    noise.start(t, Math.random());
    noise.stop(t + 1.3);
  },

  // Πληρώνεις τον Χάροντα: νόμισμα στην παλάμη και μετά νερό που κινείται.
  charonPaid() {
    if (!this.ready()) return;
    this.coin();
    const ac = this.ctx, t = ac.currentTime + 0.4;
    const noise = this.noiseSource();
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.linearRampToValueAtTime(900, t + 1.2);
    lp.frequency.linearRampToValueAtTime(250, t + 2.6);
    const g = ac.createGain();
    this.envelope(g.gain, t, 0.3, 0.6, 2);
    noise.connect(lp);
    lp.connect(g);
    g.connect(this.sfx);
    g.connect(this.reverbSend);
    noise.start(t, Math.random());
    noise.stop(t + 2.8);
  },

  // Καρδιοχτύπι: δύο χαμηλά "γδουπ" (lub-dub). vol 0..1.
  heartbeat(vol) {
    if (!this.ready()) return;
    const ac = this.ctx, t = ac.currentTime;
    for (const [dt, amp] of [[0, 1], [0.17, 0.65]]) {
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(68, t + dt);
      o.frequency.exponentialRampToValueAtTime(38, t + dt + 0.14);
      const g = ac.createGain();
      this.envelope(g.gain, t + dt, 0.55 * vol * amp, 0.012, 0.2);
      o.connect(g);
      g.connect(this.sfx);
      o.start(t + dt);
      o.stop(t + dt + 0.3);
    }
  },

  // Νίκη επιπέδου: ανοδικό, "ανακουφιστικό" arpeggio με πολύ reverb.
  win() {
    if (!this.ready()) return;
    const ac = this.ctx, t = ac.currentTime;
    [293.66, 369.99, 440, 587.33].forEach((f, i) => {
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ac.createGain();
      this.envelope(g.gain, t + i * 0.13, 0.13, 0.02, 1.8);
      o.connect(g);
      g.connect(this.sfx);
      g.connect(this.reverbSend);
      o.start(t + i * 0.13);
      o.stop(t + i * 0.13 + 2);
    });
  },

  // Jump scare: ένα χορωδιακό ουρλιαχτό νεκρών (έξι φωνές με δυσαρμονικά διαστήματα που
  // ανεβαίνουν απότομα), ένα χτύπημα και ένα 8-bit στρίγγλισμα.
  // kind: 'shade' | 'erinys' — η Ερινύα ουρλιάζει πιο ψηλά, με σφύριγμα φιδιών και φτερουγίσματα.
  scare(kind = 'shade') {
    if (!this.ready()) return;
    const ac = this.ctx, t = ac.currentTime;

    // 1) Το χτύπημα: βαθύς "μπουμ" + θόρυβος, τη στιγμή που ορμάει.
    const boom = ac.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(95, t);
    boom.frequency.exponentialRampToValueAtTime(26, t + 0.9);
    const bg = ac.createGain();
    this.envelope(bg.gain, t, 1.0, 0.004, 0.95);
    boom.connect(bg);
    bg.connect(this.sfx);
    boom.start(t);
    boom.stop(t + 1.1);

    const rock = this.noiseSource();
    const rlp = ac.createBiquadFilter();
    rlp.type = 'lowpass';
    rlp.frequency.setValueAtTime(1800, t);
    rlp.frequency.exponentialRampToValueAtTime(220, t + 0.45);
    const rg = ac.createGain();
    this.envelope(rg.gain, t, 0.75, 0.002, 0.5);
    rock.connect(rlp);
    rlp.connect(rg);
    rg.connect(this.sfx);
    rg.connect(this.reverbSend);
    rock.start(t, Math.random());
    rock.stop(t + 0.6);

    // 2) Το ουρλιαχτό: φωνές με βάση που πηδάει προς τα πάνω και μετά σπάει.
    const shaper = ac.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 3.2);
    }
    shaper.curve = curve;
    const wail = ac.createGain();
    this.envelope(wail.gain, t + 0.005, 0.55, 0.012, 1.15);
    shaper.connect(wail);
    wail.connect(this.sfx);
    wail.connect(this.reverbSend);
    // Δυσαρμονία: μικρή δεύτερη, τρίτονο, ελαφρώς ξεκούρδιστες οκτάβες.
    const ratios = [1, 1.0595, 1.4142, 1.498, 2.02, 2.16];
    ratios.forEach((r, i) => {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      const f = (kind === 'erinys' ? 470 : 330) * r;
      o.frequency.setValueAtTime(f * 0.7, t);
      o.frequency.exponentialRampToValueAtTime(f * 1.55, t + 0.16);            // πηδάει προς τα πάνω
      o.frequency.exponentialRampToValueAtTime(f * (1.15 + (i % 3) * 0.08), t + 0.75);
      o.frequency.exponentialRampToValueAtTime(f * 0.75, t + 1.2);             // και σπάει προς τα κάτω
      const vib = ac.createOscillator();
      vib.frequency.value = 6 + i * 0.9;
      const vg = ac.createGain();
      vg.gain.value = f * 0.03;
      vib.connect(vg);
      vg.connect(o.frequency);
      // Στόμα ανοιχτό "Αα" για κάθε φωνή.
      const b1 = ac.createBiquadFilter();
      b1.type = 'bandpass';
      b1.frequency.value = 800 + i * 40;
      b1.Q.value = 2.2;
      const b2 = ac.createBiquadFilter();
      b2.type = 'bandpass';
      b2.frequency.value = 1750 + i * 60;
      b2.Q.value = 3;
      const g = ac.createGain();
      g.gain.value = 0.7;
      o.connect(b1);
      o.connect(b2);
      b1.connect(g);
      b2.connect(g);
      g.connect(shaper);
      o.start(t);
      o.stop(t + 1.3);
      vib.start(t);
      vib.stop(t + 1.3);
    });

    // 3) Το στρίγγλισμα της σκιάς σε 8-bit: τετραγωνικός τόνος που πηδάει τυχαία σε
    //    ψηλές νότες, σαν χαλασμένο σήμα — εκεί που "σπάει" και η εικόνα (0.19 δευτ. και μετά).
    const sq = ac.createOscillator();
    sq.type = 'square';
    const sg = ac.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    for (let tt = 0.19; tt < 0.62; tt += 0.028) {
      sq.frequency.setValueAtTime(700 + Math.random() * 1900, t + tt);
      // Κενά ανάμεσα στα "κομμάτια", σαν τραυλισμός.
      sg.gain.setValueAtTime(Math.random() < 0.75 ? 0.13 : 0.0001, t + tt);
    }
    sg.gain.setValueAtTime(0.0001, t + 0.62);
    sq.connect(sg);
    sg.connect(this.sfx);
    sg.connect(this.echoSend);
    sq.start(t + 0.19);
    sq.stop(t + 0.65);

    if (kind === 'erinys') {
      // 4) Τα φίδια στα μαλλιά της σφυρίζουν όλα μαζί.
      const hiss = this.noiseSource();
      const hp = ac.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 3800;
      const hg = ac.createGain();
      hg.gain.setValueAtTime(0.0001, t);
      hg.gain.exponentialRampToValueAtTime(0.3, t + 0.05);
      hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      hiss.connect(hp);
      hp.connect(hg);
      hg.connect(this.sfx);
      hiss.start(t, Math.random());
      hiss.stop(t + 0.75);
      // 5) Φτερουγίσματα: βαθιά φουπ από θόρυβο.
      for (let i = 0; i < 4; i++) {
        const tt = t + 0.08 + i * 0.13;
        const n = this.noiseSource();
        const lp = ac.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 320;
        const g = ac.createGain();
        this.envelope(g.gain, tt, 0.6, 0.02, 0.1);
        n.connect(lp);
        lp.connect(g);
        g.connect(this.sfx);
        n.start(tt, Math.random());
        n.stop(tt + 0.15);
      }
    }
  },


  // Οθόνη Game Over: βαθιά, αργή "καμπάνα".
  gameOver() {
    if (!this.ready()) return;
    const ac = this.ctx, t = ac.currentTime;
    for (const [f, amp] of [[55, 0.4], [110.6, 0.18], [164.3, 0.08]]) {
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ac.createGain();
      this.envelope(g.gain, t, amp, 0.02, 3.2);
      o.connect(g);
      g.connect(this.sfx);
      g.connect(this.reverbSend);
      o.start(t);
      o.stop(t + 3.4);
    }
  },

  // ---- Γρύλισμα τεράτων ----
  makeGrowl() {
    const ac = this.ctx;
    const v = {};
    const base = 44 + Math.random() * 10;

    v.out = ac.createGain();
    v.out.gain.value = 0;
    v.pan = this.panner(0);
    if (v.pan) { v.out.connect(v.pan); v.pan.connect(this.sfx); } else v.out.connect(this.sfx);

    // Φίλτρο: ανοιχτό όταν το "βλέπεις", κλειστό (πνιχτό) πίσω από τοίχο.
    v.filter = ac.createBiquadFilter();
    v.filter.type = 'lowpass';
    v.filter.frequency.value = 280;
    v.filter.Q.value = 5;

    // Ακανόνιστη διαμόρφωση έντασης: "ανάσα" του τέρατος.
    v.am = ac.createGain();
    v.am.gain.value = 0.6;
    v.am.connect(v.out);
    v.filter.connect(v.am);

    for (const mul of [1, 1.013, 2.02]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = base * mul;
      const g = ac.createGain();
      g.gain.value = mul > 2 ? 0.25 : 0.5;
      o.connect(g);
      g.connect(v.filter);
      o.start();
    }
    const breath = this.noiseSource(true);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 380;
    bp.Q.value = 1.4;
    const bg = ac.createGain();
    bg.gain.value = 0.35;
    breath.connect(bp);
    bp.connect(bg);
    bg.connect(v.filter);
    breath.start();

    for (const [freq, depth, target] of [[1.7 + Math.random(), 0.35, v.am.gain], [0.23, 90, v.filter.frequency]]) {
      const lfo = ac.createOscillator();
      lfo.frequency.value = freq;
      const d = ac.createGain();
      d.gain.value = depth;
      lfo.connect(d);
      d.connect(target);
      lfo.start();
    }
    return v;
  },

  // Κάθε frame: ένταση/panning/φίλτρο του γρυλίσματος κάθε τέρατος.
  // voices = [{ x, y, los } ή null για σιωπηλή σκιά] (άδειο = σιωπή)
  updateGrowls(voices) {
    if (!this.ctx) return;
    while (this.growls.length < voices.length) this.growls.push(this.makeGrowl());
    const t = this.ctx.currentTime;
    this.growls.forEach((g, i) => {
      const m = voices[i];
      let vol = 0, pan = 0, cutoff = 280;
      if (m) {
        const dx = m.x - this.listenerX, dy = m.y - this.listenerY;
        const p = Math.max(0, 1 - Math.hypot(dx, dy) / 380);
        vol = p * p * 0.55;
        pan = Math.max(-1, Math.min(1, this.lateral(dx, dy) / 220));
        cutoff = m.los ? 300 : 150;
      }
      g.out.gain.setTargetAtTime(vol, t, 0.15);
      g.filter.frequency.setTargetAtTime(cutoff, t, 0.2);
      if (g.pan) g.pan.pan.setTargetAtTime(pan, t, 0.1);
    });
  },
};
