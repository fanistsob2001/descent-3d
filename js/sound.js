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
  listenerAngle: 0,  // προς τα πού κοιτάει ο παίκτης (πρώτο πρόσωπο): ο ακροατής γυρίζει μαζί του

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
    conv.buffer = this.makeImpulse(3.2, 3.2);
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
    // Σπηλιά: πρώτα μερικές διακριτές ανακλάσεις από τους κοντινούς τοίχους (διαφορετικές σε κάθε
    // αυτί), μετά μια πυκνή ουρά που σβήνει εκθετικά και γίνεται όλο και πιο "σκοτεινή" (η πέτρα
    // απορροφά τα πρίμα) — ένα lowpass που κλείνει με τον χρόνο.
    const ac = this.ctx;
    const len = Math.floor(ac.sampleRate * seconds);
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const k = 0.75 - 0.7 * t;                    // όσο περνάει ο χρόνος, πιο πολύ lowpass
        lp += k * ((Math.random() * 2 - 1) - lp);
        d[i] = lp * Math.pow(1 - t, decay) * (1.4 - 0.4 * k);
      }
      for (let r = 0; r < 9; r++) {
        const at = Math.floor(ac.sampleRate * (0.008 + Math.random() * 0.075));
        d[at] += (Math.random() < 0.5 ? -1 : 1) * (0.9 - r * 0.07);
      }
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

  // ---- Ήχος στον χώρο (πρώτο πρόσωπο) ----
  // Ο ακροατής (ctx.listener) στέκεται στη θέση του Ορφέα, γυρισμένος προς το βλέμμα του. Κάθε
  // ήχος με θέση περνάει από PannerNode, οπότε γυρίζει μαζί με το κεφάλι (με HRTF ακούγεται και
  // μπρος / πίσω). Χάρτης (x, y) → ήχος (x, 0, y), με τον άξονα y του ήχου προς τα πάνω.
  // Την ένταση με την απόσταση τη ρυθμίζουμε εμείς (όπως πριν): rolloffFactor = 0.
  SPACE: 1 / TILE,   // μονάδες κόσμου → μονάδες ήχου (κελιά)

  // Κάθε καρέ: θέση και προσανατολισμός του ακροατή.
  updateListener() {
    if (!this.ctx) return;
    const L = this.ctx.listener;
    const x = this.listenerX * this.SPACE, z = this.listenerY * this.SPACE;
    const fx = Math.cos(this.listenerAngle), fz = Math.sin(this.listenerAngle);
    if (L.positionX) {
      L.positionX.value = x; L.positionY.value = 0; L.positionZ.value = z;
      L.forwardX.value = fx; L.forwardY.value = 0; L.forwardZ.value = fz;
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else {
      L.setPosition(x, 0, z);
      L.setOrientation(fx, 0, fz, 0, 1, 0);
    }
  },

  // Ένας PannerNode στο σημείο (x, y) του κόσμου. model: 'HRTF' (μπρος/πίσω) ή 'equalpower' (φθηνός).
  placeNode(x, y, model = 'HRTF') {
    const p = this.ctx.createPanner();
    p.panningModel = model;
    p.distanceModel = 'linear';
    p.rolloffFactor = 0;
    this.setPlace(p, x, y);
    return p;
  },

  setPlace(p, x, y) {
    const px = x * this.SPACE, pz = y * this.SPACE;
    if (p.positionX) { p.positionX.value = px; p.positionY.value = 0; p.positionZ.value = pz; }
    else p.setPosition(px, 0, pz);
  },

  // Πόσο πίσω από τον παίκτη είναι ένα σημείο: 0 = μπροστά ή στο πλάι, 1 = ακριβώς πίσω.
  behind(x, y) {
    const dx = x - this.listenerX, dy = y - this.listenerY;
    const d = Math.hypot(dx, dy);
    if (d < 4) return 0;
    return Math.max(0, -(Math.cos(this.listenerAngle) * dx + Math.sin(this.listenerAngle) * dy) / d);
  },

  // Ό,τι έρχεται από πίσω ακούγεται πιο πνιχτό (σαν να το κρύβει το κεφάλι): χαμηλοπερατό φίλτρο.
  // Επιστρέφει { input, output } για να μπει στην αλυσίδα.
  headShadow(x, y) {
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 18000 - this.behind(x, y) * 15200;   // ακριβώς πίσω: ~2.8 kHz
    lp.Q.value = 0.5;
    return lp;
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

    // Αέρας που σφυρίζει μέσα από τις σπηλιές: θόρυβος μέσα από στενό φίλτρο που "ταξιδεύει"
    // αργά, και δυναμώνει / σβήνει σαν ριπές.
    const wind = this.noiseSource(true);
    const wbp = ac.createBiquadFilter();
    wbp.type = 'bandpass';
    wbp.frequency.value = 520;
    wbp.Q.value = 6;
    const wg = ac.createGain();
    wg.gain.value = 0.08;
    wind.connect(wbp);
    wbp.connect(wg);
    wg.connect(this.ambient);
    for (const [freq, depth, target] of [[0.045, 260, wbp.frequency], [0.11, 0.07, wg.gain]]) {
      const l = ac.createOscillator();
      l.frequency.value = freq;
      const ld = ac.createGain();
      ld.gain.value = depth;
      l.connect(ld);
      ld.connect(target);
      l.start();
    }
    wind.start();
  },

  // Πού και πού, ένα μακρινό βουητό της γης (κάθε 20-50 δευτ.) — το Κάτω Κόσμο "αναπνέει".
  // Δεν είναι ήχος του παιχνιδιού: οι σκιές δεν το ακούνε.
  ambienceTick(now) {
    if (!this.ready() || this.muted) return;
    if (this._rumbleAt === undefined) this._rumbleAt = now + 15 + Math.random() * 20;
    if (now < this._rumbleAt) return;
    this._rumbleAt = now + 20 + Math.random() * 30;
    const ac = this.ctx, t = ac.currentTime;
    const src = this.noiseSource();
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 90;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.sfx);
    const rv = ac.createGain();
    rv.gain.value = 0.6;
    g.connect(rv);
    rv.connect(this.reverbSend);
    src.start(t, Math.random());
    src.stop(t + 3.8);
  },

  // ---- Ο πρόλογος (στον πάνω κόσμο): φύση αντί για το βουητό του Κάτω Κόσμου ----
  // mode: 'day' (πουλιά, τζιτζίκια), 'dusk' (γρύλοι), 'night' (θάλασσα, αέρας), null = τίποτα.
  natureMode: null,
  nature(mode) {
    this.natureMode = mode;
    this._natureAt = 0;
  },
  natureTick(now) {
    const mode = this.natureMode;
    if (!mode || !this.ready() || this.muted || now < (this._natureAt || 0)) return;
    const ac = this.ctx, t = ac.currentTime;
    const out = ac.createGain();
    out.gain.value = 1;
    out.connect(this.sfx);
    const pan = (v) => { const p = ac.createStereoPanner(); p.pan.value = v; p.connect(out); return p; };
    if (mode === 'day') {
      this._natureAt = now + 0.6 + Math.random() * 1.6;
      if (Math.random() < 0.55) {
        // Πουλί: 2-5 γρήγορα κελαηδίσματα (ημίτονο που γλιστράει πάνω-κάτω).
        const p = pan(Math.random() * 1.6 - 0.8), n = 2 + Math.floor(Math.random() * 4), f = 2400 + Math.random() * 1800;
        for (let k = 0; k < n; k++) {
          const o = ac.createOscillator(), g = ac.createGain(), at = t + k * (0.09 + Math.random() * 0.05);
          o.frequency.setValueAtTime(f * (0.9 + Math.random() * 0.2), at);
          o.frequency.exponentialRampToValueAtTime(f * (1.2 + Math.random() * 0.3), at + 0.06);
          this.envelope(g.gain, at, 0.035, 0.008, 0.07);
          o.connect(g); g.connect(p);
          o.start(at); o.stop(at + 0.1);
        }
      } else {
        // Τζιτζίκι: θόρυβος σε ψηλή μπάντα που "τρίβεται" γρήγορα (διαμόρφωση πλάτους), 1-2 δευτ.
        const src = this.noiseSource(), bp = ac.createBiquadFilter(), g = ac.createGain(), am = ac.createOscillator(), amg = ac.createGain();
        bp.type = 'bandpass'; bp.frequency.value = 5200 + Math.random() * 1500; bp.Q.value = 6;
        const d = 1 + Math.random() * 1.2;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.03, t + 0.3);
        g.gain.linearRampToValueAtTime(0.0001, t + d);
        am.frequency.value = 38 + Math.random() * 20; amg.gain.value = 0.02;
        am.connect(amg); amg.connect(g.gain);
        src.connect(bp); bp.connect(g); g.connect(pan(Math.random() * 1.6 - 0.8));
        src.start(t, Math.random()); src.stop(t + d + 0.05); am.start(t); am.stop(t + d + 0.05);
      }
    } else if (mode === 'dusk') {
      // Γρύλος: σύντομα "τρρ" σε σταθερό ύψος.
      this._natureAt = now + 0.5 + Math.random() * 0.9;
      const p = pan(Math.random() * 1.6 - 0.8), f = 4300 + Math.random() * 500;
      for (let k = 0; k < 3; k++) {
        const o = ac.createOscillator(), g = ac.createGain(), at = t + k * 0.06;
        o.frequency.value = f;
        this.envelope(g.gain, at, 0.018, 0.004, 0.035);
        o.connect(g); g.connect(p);
        o.start(at); o.stop(at + 0.05);
      }
    } else if (mode === 'night') {
      // Κύμα που σκάει στα βράχια από κάτω (χαμηλός θόρυβος που φουσκώνει και αποσύρεται).
      this._natureAt = now + 3 + Math.random() * 3;
      const src = this.noiseSource(), lp = ac.createBiquadFilter(), g = ac.createGain();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(400, t); lp.frequency.linearRampToValueAtTime(1100, t + 1.3); lp.frequency.linearRampToValueAtTime(300, t + 3.4);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.13, t + 1.3);
      g.gain.linearRampToValueAtTime(0.0001, t + 3.6);
      src.connect(lp); lp.connect(g); g.connect(pan(0.5 - Math.random() * 0.3));
      src.start(t, Math.random()); src.stop(t + 3.7);
    }
  },

  // Κραυγή γυναίκας από μακριά (ο πρόλογος): φωνή με formants "α" που ανεβαίνει και σπάει.
  scream(x, y) {
    if (!this.ready()) return;
    const ac = this.ctx, t = ac.currentTime;
    const out = this.spatial(x, y, 0.5, 900);
    const o = ac.createOscillator(), o2 = ac.createOscillator();
    o.type = 'sawtooth'; o2.type = 'sawtooth';
    o.frequency.setValueAtTime(520, t);
    o.frequency.linearRampToValueAtTime(820, t + 0.25);
    o.frequency.linearRampToValueAtTime(760, t + 0.9);
    o.frequency.linearRampToValueAtTime(380, t + 1.4);
    o2.frequency.setValueAtTime(527, t);
    o2.frequency.linearRampToValueAtTime(812, t + 0.25);
    o2.frequency.linearRampToValueAtTime(380, t + 1.4);
    const vib = ac.createOscillator(), vg = ac.createGain();
    vib.frequency.value = 7; vg.gain.value = 18;
    vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.08);
    g.gain.setValueAtTime(0.5, t + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    for (const [f, q, k] of [[900, 6, 1], [1500, 8, 0.6], [2900, 9, 0.35]]) {
      const bp = ac.createBiquadFilter(), bg = ac.createGain();
      bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; bg.gain.value = k;
      o.connect(bp); o2.connect(bp); bp.connect(bg); bg.connect(g);
    }
    g.connect(out);
    const rv = ac.createGain();
    rv.gain.value = 0.5;
    g.connect(rv); rv.connect(this.reverbSend);
    for (const n of [o, o2, vib]) { n.start(t); n.stop(t + 1.6); }
  },

  // Το γλίστρημα στο πρώτο σκαλί: γδούπος, η λύρα σπάει, οι χορδές "φεύγουν" με ένα τελευταίο τρέμουλο.
  slip() {
    if (!this.ready()) return;
    this.shatter(this.listenerX + 20, this.listenerY);
    const t = this.ctx.currentTime;
    [392, 330, 262].forEach((f, k) => this.pluck(f * (1 - k * 0.02), t + 0.25 + k * 0.22, 0.22 - k * 0.05));
    const src = this.noiseSource(), lp = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 160;
    this.envelope(g.gain, t, 0.5, 0.005, 0.35);
    src.connect(lp); lp.connect(g); g.connect(this.sfx);
    src.start(t, Math.random()); src.stop(t + 0.4);
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

  step(surface = 'stone', wet = false) {
    // Βήμα (μόνο όταν τρέχεις): ο γδούπος της φτέρνας + το σύρσιμο της σόλας. surface:
    // 'gravel' (σπηλιά: κοκκώδες, με χαλίκια), 'stone' (λαξευμένη πέτρα), 'marble' (παλάτι: καθαρό
    // "κλακ"). wet = δίπλα σε νερό: λίγο πλατσούρισμα.
    if (!this.ready()) return;
    const ac = this.ctx, t = ac.currentTime;
    const out = ac.createGain();
    out.gain.value = 1;
    out.connect(this.sfx);
    const rv = ac.createGain();
    rv.gain.value = surface === 'marble' ? 0.35 : 0.2;
    out.connect(rv);
    rv.connect(this.reverbSend);
    const burst = (type, freq, q, peak, at, dec) => {
      const src = this.noiseSource();
      const f = ac.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ac.createGain();
      this.envelope(g.gain, t + at, peak, 0.003, dec);
      src.connect(f);
      f.connect(g);
      g.connect(out);
      src.start(t + at, Math.random() * 1.5);
      src.stop(t + at + dec + 0.05);
    };
    burst('lowpass', 200 + Math.random() * 80, 0.8, 0.13, 0, 0.08);                 // φτέρνα
    if (surface === 'marble') {
      burst('bandpass', 3200 + Math.random() * 600, 3, 0.05, 0.006, 0.035);           // κλακ
    } else {
      burst('bandpass', (surface === 'gravel' ? 2400 : 1700) + Math.random() * 500, 1.6, 0.045, 0.014, 0.07);   // σύρσιμο
    }
    if (surface === 'gravel') {
      for (let k = 0; k < 3; k++) burst('highpass', 3800, 0.7, 0.025, 0.01 + Math.random() * 0.05, 0.012);       // χαλίκια
    }
    if (wet) burst('bandpass', 900 + Math.random() * 300, 0.7, 0.05, 0.02, 0.16);    // πλατσούρισμα
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
  // Ένας ήχος από τη θέση (x, y) του κόσμου: ένταση και panning ανάλογα με
  // το πού είναι σε σχέση με τον παίκτη. Επιστρέφει τον κόμβο εξόδου.
  spatial(x, y, baseVol, falloff) {
    const dx = x - this.listenerX, dy = y - this.listenerY;
    const g = this.ctx.createGain();
    g.gain.value = baseVol * Math.max(0.15, 1 - Math.hypot(dx, dy) / falloff);
    const lp = this.headShadow(x, y);
    const pan = this.placeNode(x, y);
    g.connect(lp);
    lp.connect(pan);
    pan.connect(this.sfx);
    pan.connect(this.echoSend);
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
    const src = this.noiseSource();
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900 + Math.random() * 300;
    bp.Q.value = 0.9;
    const g = ac.createGain();
    this.envelope(g.gain, t, 0.05 + Math.random() * 0.015, 0.006, 0.09);
    src.connect(bp);
    bp.connect(g);
    // Από τη θέση της (πίσω σου): πνιχτά και από πίσω, μέσα από τον panner.
    const lp = this.headShadow(x, y);
    const pan = this.placeNode(x, y);
    g.connect(lp);
    lp.connect(pan);
    pan.connect(this.sfx);
    src.start(t, Math.random() * 1.5);
    src.stop(t + 0.14);
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
    // Γάβγισμα: τραχύς λαρυγγικός τόνος (πριονωτός με "τρίξιμο" ~55 Hz) που ανεβαίνει απότομα και
    // πέφτει ("γουάφ"), μέσα από δύο formants στόματος που κλείνουν (α → ου), λίγη παραμόρφωση,
    // και θόρυβος ανάσας στην αρχή.
    if (!this.ready()) return;
    const ac = this.ctx, t = ac.currentTime + delay;
    const out = this.spatial(x, y, 1, 650);
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq * 0.85, t);
    o.frequency.exponentialRampToValueAtTime(freq * 1.6, t + 0.035);
    o.frequency.exponentialRampToValueAtTime(freq * 0.72, t + 0.24);
    const rough = ac.createGain();
    rough.gain.value = 0.7;
    const am = ac.createOscillator();
    am.frequency.value = 55 + Math.random() * 15;
    const amg = ac.createGain();
    amg.gain.value = 0.35;
    am.connect(amg);
    amg.connect(rough.gain);
    o.connect(rough);
    const drive = ac.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) curve[i] = Math.tanh(((i / 255) * 2 - 1) * 2.5);
    drive.curve = curve;
    rough.connect(drive);
    const env = ac.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.55, t + 0.012);
    env.gain.setValueAtTime(0.55, t + 0.07);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.27);
    for (const [f0, f1, q, gv] of [[freq * 2.4, freq * 1.5, 3, 1.4], [freq * 5.5, freq * 3.4, 5, 0.8]]) {
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = q;
      bp.frequency.setValueAtTime(f0, t);
      bp.frequency.exponentialRampToValueAtTime(f1, t + 0.22);
      const g = ac.createGain();
      g.gain.value = gv;
      drive.connect(bp);
      bp.connect(g);
      g.connect(env);
    }
    env.connect(out);
    o.start(t); am.start(t);
    o.stop(t + 0.3); am.stop(t + 0.3);
    const n = this.noiseSource();
    const hp = ac.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 1800;
    hp.Q.value = 0.8;
    const ng = ac.createGain();
    this.envelope(ng.gain, t, 0.2, 0.005, 0.07);
    n.connect(hp);
    hp.connect(ng);
    ng.connect(out);
    n.start(t, Math.random());
    n.stop(t + 0.12);
  },

  // Σφύριγμα φιδιού: θόρυβος στα πρίμα που φουσκώνει και σβήνει, με ένα λεπτό "τρέμουλο".
  hiss(x, y) {
    if (!this.ready()) return;
    const ac = this.ctx, t = ac.currentTime;
    const out = this.spatial(x, y, 0.8, 420);
    const src = this.noiseSource();
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2600;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(5200, t);
    bp.frequency.linearRampToValueAtTime(6800, t + 0.9);
    bp.Q.value = 0.9;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.12);
    g.gain.setValueAtTime(0.32, t + 0.65);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
    const trem = ac.createOscillator();
    trem.frequency.value = 22;
    const tg = ac.createGain();
    tg.gain.value = 0.08;
    trem.connect(tg);
    tg.connect(g.gain);
    src.connect(hp);
    hp.connect(bp);
    bp.connect(g);
    g.connect(out);
    src.start(t, Math.random());
    trem.start(t);
    src.stop(t + 1.2);
    trem.stop(t + 1.2);
  },

  // Ο Κέρβερος κοιμάται: βαθιά ανάσα / ροχαλητό (θόρυβος μέσα από χαμηλό φίλτρο που ανεβοκατεβαίνει
  // αργά) και ένα πολύ χαμηλό γρύλισμα, από τη θέση του. dist < 0 = σιωπή.
  updateSnore(x, y, dist, los) {
    if (!this.ctx) return;
    const ac = this.ctx, t = ac.currentTime;
    if (!this._snore) {
      const src = this.noiseSource(true);
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 260;
      bp.Q.value = 1.6;
      const breath = ac.createGain();
      breath.gain.value = 0.5;
      const lfo = ac.createOscillator();
      lfo.frequency.value = 0.28;
      const lg = ac.createGain();
      lg.gain.value = 0.5;
      lfo.connect(lg);
      lg.connect(breath.gain);
      const growl = ac.createOscillator();
      growl.type = 'sawtooth';
      growl.frequency.value = 46;
      const glp = ac.createBiquadFilter();
      glp.type = 'lowpass';
      glp.frequency.value = 180;
      const gg = ac.createGain();
      gg.gain.value = 0.25;
      lg.connect(gg.gain);
      const g = ac.createGain();
      g.gain.value = 0;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1200;
      const pan = this.placeNode(x, y, 'equalpower');
      src.connect(bp); bp.connect(breath); breath.connect(g);
      growl.connect(glp); glp.connect(gg); gg.connect(g);
      g.connect(lp); lp.connect(pan); pan.connect(this.sfx);
      src.start(); lfo.start(); growl.start();
      this._snore = { g, lp, pan };
    }
    const w = this._snore;
    const v = dist < 0 ? 0 : Math.max(0, 1 - dist / 260);
    w.g.gain.setTargetAtTime(v * v * 0.5, t, 0.3);
    w.lp.frequency.setTargetAtTime(los ? 1200 : 400, t, 0.3);
    if (dist >= 0) this.setPlace(w.pan, x, y);
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

  // ---- Νερό (3D): καταρράκτες και σταγόνες ----
  // Δεν είναι ήχοι του παιχνιδιού (δεν περνάνε από το Echoes.emit): οι σκιές δεν τους ακούνε.

  // Κάθε καρέ: ο θόρυβος του πιο κοντινού καταρράκτη, από τη θέση του. dist < 0 = σιωπή.
  // Δυναμώνει όσο πλησιάζεις· πίσω από τοίχο ακούγεται πνιχτός.
  updateWater(x, y, dist, los) {
    if (!this.ctx) return;
    const ac = this.ctx, t = ac.currentTime;
    if (!this._water) {
      const src = this.noiseSource(true);
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      bp.Q.value = 0.6;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2400;
      const g = ac.createGain();
      g.gain.value = 0;
      const pan = this.placeNode(x, y, 'equalpower');
      src.connect(bp);
      bp.connect(lp);
      lp.connect(g);
      g.connect(pan);
      pan.connect(this.sfx);
      const rev = ac.createGain();
      rev.gain.value = 0.25;
      g.connect(rev);
      rev.connect(this.reverbSend);
      src.start();
      this._water = { g, lp, pan };
    }
    const w = this._water;
    const p = dist < 0 ? 0 : Math.max(0, 1 - dist / 420);
    w.g.gain.setTargetAtTime(p * p * 0.2, t, 0.3);
    w.lp.frequency.setTargetAtTime(los ? 2400 : 700, t, 0.3);
    if (dist >= 0) this.setPlace(w.pan, x, y);
  },

  // Μια σταγόνα που πέφτει από το ταβάνι: ένα σύντομο "πλιπ" (ψηλός τόνος που πέφτει), με ηχώ.
  drip(x, y, onWater) {
    if (!this.ready()) return;
    const ac = this.ctx, t = ac.currentTime;
    const d = Math.hypot(x - this.listenerX, y - this.listenerY);
    if (d > 320) return;
    const out = this.spatial(x, y, 0.75, 340);
    const o = ac.createOscillator();
    o.type = 'sine';
    const f = (onWater ? 1100 : 1700) + Math.random() * 700;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * (onWater ? 0.45 : 0.7), t + 0.07);
    const g = ac.createGain();
    this.envelope(g.gain, t, 0.05, 0.002, onWater ? 0.16 : 0.07);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + 0.25);
  },

  // ---- Γρύλισμα τεράτων ----
  makeGrowl() {
    const ac = this.ctx;
    const v = {};
    const base = 44 + Math.random() * 10;

    v.out = ac.createGain();
    v.out.gain.value = 0;
    // Φθηνός panner (equalpower): τα γρυλίσματα είναι πολλά και παίζουν συνέχεια.
    v.pan = this.placeNode(0, 0, 'equalpower');
    v.out.connect(v.pan);
    v.pan.connect(this.sfx);

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
      let vol = 0, cutoff = 280;
      if (m) {
        const dx = m.x - this.listenerX, dy = m.y - this.listenerY;
        const p = Math.max(0, 1 - Math.hypot(dx, dy) / 380);
        vol = p * p * 0.55;
        // Πίσω από τοίχο: πνιχτό. Πίσω από την πλάτη σου: λίγο πιο πνιχτό.
        cutoff = (m.los ? 300 : 150) * (1 - 0.35 * this.behind(m.x, m.y));
        if (vol > 0.001) this.setPlace(g.pan, m.x, m.y);
      }
      g.out.gain.setTargetAtTime(vol, t, 0.15);
      g.filter.frequency.setTargetAtTime(cutoff, t, 0.2);
    });
  },
};
