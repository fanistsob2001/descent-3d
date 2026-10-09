'use strict';

// Στάδιο 4 της επέκτασης (STORY.md, ενότητα 12): υλικά και αντικείμενα που φτιάχνεις στα ιερά του Ερμή
// (Inventory), κιβώτια που τρίζουν όταν τα ανοίγεις (Chests), κρυψώνες όπου κρατάς την ανάσα σου (Hides).
// Τα ονόματα / μηνύματα: STORY.materials, STORY.tools κ.λπ.
//
// Θέσεις (slots) με στοίβες { id, n }: μόνο οι HOTBAR_SLOTS (5) της μπάρας κάτω στη μέση (1-5 / ροδέλα = τι κρατάς
// στο χέρι) — χωρίς σάκο (9/10, ο χρήστης το ζήτησε). Χωράνε ακριβώς η λύρα και τα 4 αντικείμενα (αγγείο, χαλίκι,
// δαυλός, κουδούνι), το καθένα σε μία στοίβα. Τα υλικά δεν πιάνουν θέση: μπαίνουν σε ένα σακουλάκι (mats), που
// φαίνεται στο ιερό και στο Inventory. Το κύμα με το Space βγαίνει πάντα (η φωνή του Ορφέα).

const MATERIALS = ['clay', 'wine', 'oil', 'linen', 'bronze', 'thread', 'resin', 'wax'];
// Τι φτιάχνεται από τι (δύο υλικά το καθένα).
const RECIPES = [
  { id: 'jar', needs: ['clay', 'wine'] },
  { id: 'torch', needs: ['oil', 'linen'] },   // (8/10: αντί για τη μελόπιτα — χωρίς φαγητό στο παιχνίδι)
  { id: 'bell', needs: ['bronze', 'thread'] },
  { id: 'lyreResin', needs: ['resin', 'wax'] },
];
// Τα αντικείμενα που χρησιμοποιούνται από το χέρι (πετιούνται — ο δαυλός ανάβει).
const TOOL_ORDER = ['jar', 'pebble', 'torch', 'bell'];
const TORCH_TIME = 30;        // δευτ. που καίει ένας δαυλός
const TORCH_R = 2.8;          // κελιά: ως πού φωτίζει
const HOTBAR_SLOTS = 5;
const STACK_MAX = 64;

const CHEST_REACH = 34;       // τόσο κοντά = "Open"
const HIDE_REACH = 30;
const BREATH_NEAR = 240;      // τόσο κοντά = η σκιά σε "ψάχνει" (η ανάσα αδειάζει)
// Οι πινακίδες με οδηγίες (STORY.tablets): οι συνταγές (III, μετά τον Χάροντα) και ο Κέρβερος (X).
const TABLET_RECIPES = 1;
const TABLET_BOSS = 5;

const Inventory = {
  slots: [],            // HOTBAR_SLOTS θέσεις: null ή { id, n }
  mats: {},             // τα υλικά: id → πόσα
  sel: 0,               // ποια θέση της μπάρας κρατάς
  opened: new Set(),    // id των κιβωτίων που άνοιξες
  maps: new Set(),      // κεφάλαια των οποίων βρήκες τον χάρτη
  tablets: new Set(),   // οι πινακίδες που διάβασες (STORY.tablets[n]) — ξαναδιαβάζονται στο Inventory
  made: new Set(),      // τι έχεις φτιάξει ήδη (για την αποστολή)

  reset(saved) {
    const inv = saved.inv || {};
    this.slots = new Array(HOTBAR_SLOTS).fill(null);
    this.mats = {};
    if (inv.mats && !Array.isArray(inv.mats) && Array.isArray(inv.slots)) for (const m of MATERIALS) this.mats[m] = inv.mats[m] | 0;
    if (Array.isArray(inv.slots)) {
      // (παλιά save: μέλι / παπαρούνα / μελόπιτα έγιναν λάδι / λινάρι / δαυλός· οι παλιές 24 θέσεις — με σάκο —
      // ξαναμπαίνουν μία-μία: τα αντικείμενα στη μπάρα, τα υλικά στο σακουλάκι)
      const OLD = { honey: 'oil', poppy: 'linen', cake: 'torch' };
      inv.slots.forEach((s, i) => {
        if (!s || typeof s.id !== 'string' || !Number.isInteger(s.n) || s.n <= 0) return;
        const id = OLD[s.id] || s.id;
        if (i < HOTBAR_SLOTS && !this.isMaterial(id) && !this.slots[i]) this.slots[i] = { id, n: s.n };
        else this.add(id, s.n);
      });
    } else {
      // Παλιό save (πριν τις θέσεις): η λύρα, τα αντικείμενα στη μπάρα, τα υλικά στον σάκο.
      this.slots[0] = { id: 'lyre', n: 1 };
      for (const m of MATERIALS) this.mats[m] = 0;
      this.add('jar', saved.jars | 0);
      this.add('pebble', inv.pebbles | 0);
      this.add('torch', inv.cakes | 0);
      this.add('bell', inv.bells | 0);
      for (const m of MATERIALS) this.add(m, (inv.mats && inv.mats[m]) | 0);
    }
    if (!this.count('lyre')) this.add('lyre', 1);
    this.sel = Number.isInteger(inv.sel) && inv.sel >= 0 && inv.sel < HOTBAR_SLOTS ? inv.sel : 0;
    this.opened = new Set(Array.isArray(inv.opened) ? inv.opened : []);
    this.maps = new Set(Array.isArray(inv.maps) ? inv.maps : []);
    this.tablets = new Set(Array.isArray(inv.tablets) ? inv.tablets : []);
    this.made = new Set((Array.isArray(inv.made) ? inv.made : []).map((id) => (id === 'cake' ? 'torch' : id)));
  },

  saveData() {
    return { inv: { slots: this.slots.map((s) => (s ? { id: s.id, n: s.n } : null)), sel: this.sel, mats: { ...this.mats },
      opened: [...this.opened], maps: [...this.maps], tablets: [...this.tablets], made: [...this.made] } };
  },

  isMaterial(id) {
    return MATERIALS.includes(id);
  },

  isTool(id) {
    return TOOL_ORDER.includes(id);
  },

  // Πόσα έχεις από κάτι (σε όλες τις θέσεις).
  count(id) {
    if (this.isMaterial(id)) return this.mats[id] | 0;
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.n;
    return n;
  },

  // Τι κρατάς στο χέρι ('lyre', 'jar', 'clay', ... ή null).
  held() {
    const s = this.slots[this.sel];
    return s ? s.id : null;
  },

  // Βάζει n από κάτι: τα υλικά στο σακουλάκι· τα αντικείμενα πρώτα στις στοίβες που υπάρχουν, μετά σε άδεια θέση
  // (5 θέσεις = η λύρα και τα 4 αντικείμενα, άρα πάντα χωράνε).
  add(id, n = 1) {
    if (n <= 0) return;
    if (this.isMaterial(id)) { this.mats[id] = (this.mats[id] | 0) + n; return; }
    const max = id === 'lyre' ? 1 : STACK_MAX;
    for (const s of this.slots) {
      if (n <= 0) return;
      if (s && s.id === id && s.n < max) { const k = Math.min(n, max - s.n); s.n += k; n -= k; }
    }
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      if (n <= 0) return;
      if (!this.slots[i]) { const k = Math.min(n, max); this.slots[i] = { id, n: k }; n -= k; }
    }
  },

  // Παίρνει n από κάτι. true αν υπήρχαν.
  take(id, n = 1) {
    if (this.count(id) < n) return false;
    if (this.isMaterial(id)) { this.mats[id] -= n; return true; }
    for (let i = 0; i < this.slots.length && n > 0; i++) {
      const s = this.slots[i];
      if (!s || s.id !== id) continue;
      const k = Math.min(n, s.n);
      s.n -= k;
      n -= k;
      if (!s.n) this.slots[i] = null;
    }
    return true;
  },

  // Επόμενη / προηγούμενη θέση της μπάρας (ροδέλα).
  cycle(dir) {
    this.sel = (this.sel + dir + HOTBAR_SLOTS) % HOTBAR_SLOTS;
  },

  // Ξέρεις πώς να το φτιάξεις; (μόνο αφού διαβάσεις την πινακίδα του αγγειοπλάστη, STORY.tablets[1])
  knowsRecipes() {
    return this.tablets.has(TABLET_RECIPES);
  },

  canCraft(r) {
    if (!this.knowsRecipes()) return false;
    if (r.id === 'lyreResin' && strings < 3) return false;
    return r.needs.every((m) => this.count(m) > 0);
  },

  craft(id) {
    const r = RECIPES.find((x) => x.id === id);
    if (!r || !this.canCraft(r)) return false;
    for (const m of r.needs) this.take(m, 1);
    if (id === 'lyreResin') Melody.uses++;
    else this.add(id, 1);
    if (id === 'jar') jarsFound = true;
    this.made.add(id);
    return true;
  },

  // ---- Εικονίδια (για τη μπάρα και το Inventory): από τα sprites, ή ζωγραφισμένα εδώ για τα υλικά ----
  _icons: {},
  _cv: {},
  icon(id) {
    if (!this._icons[id]) this._icons[id] = this.iconCanvas(id).toDataURL();
    return this._icons[id];
  },

  // Ο καμβάς του εικονιδίου (και για το χέρι που το κρατάει, js/hands.js).
  iconCanvas(id) {
    if (this._cv[id]) return this._cv[id];
    const spr = { lyre: 'lyre', jar: 'lekythos', pebble: 'rocks', bell: 'bell' }[id];
    const cv = spr ? Sprites.getHD(spr, 0).c : this.drawMaterial(id);
    this._cv[id] = cv;
    return cv;
  },

  // Μικρά εικονίδια 16×16 για τα υλικά (pixel art, ζεστή παλέτα).
  drawMaterial(id) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 16;
    const c = cv.getContext('2d');
    const px = (x, y, col, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    const ell = (cx, cy, rx, ry, col) => {
      for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x / rx) ** 2 + (y / ry) ** 2 <= 1.05) px(cx + x, cy + y, col);
    };
    const O = '#1a0c06';
    if (id === 'clay') {          // ένα κομμάτι πηλός
      ell(8, 10, 6, 4, O); ell(8, 10, 5, 3, '#a2532a'); ell(7, 9, 3, 2, '#ce6c38'); px(6, 8, '#ec9c62', 2, 1);
    } else if (id === 'wine') {   // ασκί με κρασί
      ell(8, 10, 5, 5, O); ell(8, 10, 4, 4, '#6e1f22'); ell(7, 9, 2, 2, '#a3333a'); px(7, 2, O, 3, 4); px(8, 3, '#8a5a30', 1, 3);
    } else if (id === 'oil') {    // λυχνάρι / βαζάκι με λάδι
      ell(8, 10, 5, 5, O); ell(8, 10, 4, 4, '#ce6c38'); px(5, 4, O, 7, 2); px(6, 5, '#b8a040', 5, 2); px(7, 7, '#e8d070', 2, 1);
    } else if (id === 'linen') {  // διπλωμένο λινό πανί
      px(3, 5, O, 11, 8); px(4, 6, '#e6dcc4', 9, 6); px(4, 8, '#bfb294', 9, 1); px(4, 10, '#bfb294', 9, 1);
    } else if (id === 'torch') {  // δαυλός: ξύλο, τυλιγμένο πανί, φλόγα
      px(7, 7, O, 3, 9); px(8, 8, '#8a5a30', 1, 7); px(6, 5, O, 5, 4); px(7, 6, '#d8c49a', 3, 2);
      ell(8, 3, 2, 3, '#e8762a'); px(8, 2, '#ffd772', 1, 2);
    } else if (id === 'bronze') { // ράβδος χαλκού
      px(2, 8, O, 13, 5); px(3, 9, '#9a6a2a', 11, 3); px(3, 9, '#e0a050', 11, 1); px(4, 11, '#6a4418', 10, 1);
    } else if (id === 'thread') { // κουβάρι κλωστή
      ell(8, 8, 5, 5, O); ell(8, 8, 4, 4, '#d8c49a'); px(5, 6, '#f2e6c8', 6, 1); px(5, 9, '#a8946a', 6, 1); px(12, 12, '#d8c49a', 3, 1);
    } else if (id === 'resin') {  // σταγόνα ρητίνης
      ell(8, 10, 4, 4, O); px(7, 3, O, 3, 4); ell(8, 10, 3, 3, '#c07a1a'); px(8, 4, '#c07a1a', 1, 4); px(7, 9, '#ffd060');
    } else if (id === 'wax') {    // κερήθρα
      px(3, 4, O, 11, 9); px(4, 5, '#e8c060', 9, 7);
      for (let y = 5; y < 12; y += 2) for (let x = 4 + (y % 4 === 1 ? 1 : 0); x < 13; x += 3) px(x, y, '#b8862a');
    }
    return cv;
  },
};

const Chests = {
  list: [],

  reset() {
    this.list = Level.chests.map((c, id) => ({
      id, x: c.x, y: c.y, region: c.region, map: c.map, opened: Inventory.opened.has(id), openedAt: -1e6,
      revealTime: -1e6, revealStrength: 0,
      onHear(wave, d, los) {
        if (!los) return;
        const s = Echoes.strengthAt(wave, d);
        if (s < this.revealStrength * Math.max(0, 1 - (Echoes.now - this.revealTime) / 3)) return;
        this.revealTime = Echoes.now;
        this.revealStrength = s;
      },
    }));
  },

  near(p) {
    let best = null, bd = CHEST_REACH;
    for (const c of this.list) {
      if (c.opened) continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  },

  // Ανοίγει: τρίζει (οι σκιές το ακούνε), και δίνει δύο υλικά (ένα ζευγάρι συνταγής, με τη σειρά), μερικές
  // φορές χαλίκια, και — στο σημαδεμένο κιβώτιο κάθε κεφαλαίου — τον χάρτη. Επιστρέφει το κείμενο.
  open(c, now) {
    c.opened = true;
    c.openedAt = now;
    c.revealTime = now;
    c.revealStrength = 1;
    Inventory.opened.add(c.id);
    Echoes.emit(c.x, c.y, 170, 0.42, 'step');
    Sound.creak(c.x, c.y);
    const got = [];
    const a = MATERIALS[(c.id * 2) % MATERIALS.length], b = MATERIALS[(c.id * 2 + 1) % MATERIALS.length];
    for (const m of [a, b]) { Inventory.add(m, 1); got.push(STORY.materials[m]); }
    if (c.id % 3 === 0 || c.map) { Inventory.add('pebble', 3); got.push(STORY.tools.pebble); }
    let text = STORY.chestInside(got.join(', '));
    if (c.map && !Inventory.maps.has(c.region)) { Inventory.maps.add(c.region); text = STORY.mapPiece + ' ' + text; }
    return text;
  },
};

const Hides = {
  list: [],
  active: null,       // η κρυψώνα όπου είσαι τώρα
  breath: 1,          // 0..1
  enteredAt: 0,

  reset() {
    this.list = Level.hides.map((h) => {
      // Η σαρκοφάγος ακουμπάει στον πιο κοντινό τοίχο.
      const tx = Math.floor(h.x / TILE), ty = Math.floor(h.y / TILE);
      const w = [[0, -1], [0, 1], [-1, 0], [1, 0]].find(([dx, dy]) => Level.isOpaque(tx + dx, ty + dy)) || [0, -1];
      return { x: h.x, y: h.y, wx: w[0], wy: w[1], revealTime: -1e6, revealStrength: 0,
        onHear(wave, d, los) {
          if (!los) return;
          this.revealTime = Echoes.now;
          this.revealStrength = Math.max(0.5, Echoes.strengthAt(wave, d));
        } };
    });
    this.active = null;
    this.breath = 1;
  },

  near(p) {
    let best = null, bd = HIDE_REACH;
    for (const h of this.list) {
      const d = Math.hypot(h.x - p.x, h.y - p.y);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  },

  enter(h, now) {
    this.active = h;
    this.enteredAt = now;
    player.x = h.x + h.wx * TILE * 0.2;
    player.y = h.y + h.wy * TILE * 0.2;
    // Κοιτάζεις έξω, μακριά από τον τοίχο.
    player.angle = Math.atan2(-h.wy, -h.wx);
    Sound.breath(true);
  },

  exit() {
    this.active = null;
    HeartGame.reset();
    Sound.breath(false);
  },

  // Κάθε καρέ: όσο είσαι κρυμμένος και ένα τέρας ψάχνει κοντά (σε άκουσε / σε κυνηγάει — όχι αν απλώς
  // περνάει), κρατάς την ανάσα σου με το παιχνίδι της καρδιάς (HeartGame)· όταν φύγει, ξαναγεμίζει.
  // Επιστρέφει true αν τελείωσε η ανάσα (λαχάνιασμα).
  update(dt, mons, now) {
    if (!this.active) {
      this.breath = Math.min(1, this.breath + dt / 3);
      return false;
    }
    const near = mons.some((m) => !m.isFrozen() && Math.hypot(m.x - player.x, m.y - player.y) < BREATH_NEAR &&
      (m.state === 'hunt' || m.state === 'search' || m.huntPlayer || m.chase));
    HeartGame.update(dt, now, near);
    if (!near) this.breath = Math.min(1, this.breath + dt / 3);
    return this.breath <= 0;
  },
};

// Ο δαυλός (λάδι + λινάρι): ανάβει και καίει TORCH_TIME δευτ. Φωτίζει γύρω σου χωρίς ήχο (Raycast.prepareLight)
// — οι νεκροί είναι τυφλοί, δεν τον βλέπουν.
const Torch = {
  until: 0,
  litAt: -1e6,

  reset() {
    this.until = 0;
  },

  light(now) {
    this.litAt = now;
    this.until = now + TORCH_TIME;
    Sound.ignite();
  },

  // 0..1: πόσο φως δίνει τώρα (τρεμοπαίζει, και σβήνει τα τελευταία 3 δευτ.).
  strength(now) {
    if (now >= this.until) return 0;
    const fade = Math.min(1, (this.until - now) / 3);
    return fade * (0.86 + 0.08 * Math.sin(now * 11) + 0.06 * Math.sin(now * 4.3));
  },
};

// Το "παιχνίδι της καρδιάς" στην κρυψώνα (σαν το DOORS του Roblox): όσο ένα τέρας ψάχνει έξω από την κρυψώνα,
// καρδιές έρχονται από αριστερά και δεξιά προς τη μέση· πατάς την πλευρά τους (αριστερό / δεξί κλικ, A / D,
// ← / →, ή άγγιγμα στο αριστερό / δεξί μισό) τη στιγμή που φτάνουν στον κύκλο. Κάθε λάθος σου κόβει την ανάσα·
// όταν τελειώσει, λαχανιάζεις και το τέρας σε ακούει.
const HEART_TRAVEL = 1.1;     // δευτ. από την άκρη ως τη μέση
const HEART_WINDOW = 0.2;     // πόσο νωρίς / αργά μετράει το πάτημα
const HEART_MISS = 0.3;       // πόση ανάσα χάνεις σε κάθε λάθος

const HeartGame = {
  active: false,
  beats: [],          // { side: -1 | 1, at: πότε φτάνει στη μέση, done }
  nextAt: 0,
  flash: { t: -1e6, ok: true },

  reset() {
    this.active = false;
    this.beats = [];
  },

  // Κάθε καρέ όσο είσαι κρυμμένος. near = ένα τέρας ψάχνει κοντά.
  update(dt, now, near) {
    if (!near) {
      if (this.active) { this.active = false; this.beats = []; }
      return;
    }
    if (!this.active) { this.active = true; this.nextAt = now + 0.6; this.beats = []; }
    if (now >= this.nextAt) {
      this.beats.push({ side: Math.random() < 0.5 ? -1 : 1, at: now + HEART_TRAVEL, done: false });
      this.nextAt = now + 0.75 + Math.random() * 0.55;
    }
    for (const b of this.beats) {
      if (!b.done && now > b.at + HEART_WINDOW) { b.done = true; this.miss(now); }
    }
    this.beats = this.beats.filter((b) => !b.done || now - b.at < 0.4);
  },

  miss(now) {
    Hides.breath -= HEART_MISS;
    this.flash = { t: now, ok: false };
    Sound.heartbeat(1);
    if (typeof vibrate === 'function') vibrate(80);
  },

  // Πάτημα: side = -1 (αριστερά) ή 1 (δεξιά). true αν το χειρίστηκε.
  press(side, now) {
    if (!this.active) return false;
    const b = this.beats.find((x) => !x.done && Math.abs(x.at - now) <= HEART_WINDOW);
    if (b && b.side === side) {
      b.done = true;
      b.hit = true;
      Hides.breath = Math.min(1, Hides.breath + 0.04);
      this.flash = { t: now, ok: true };
      Sound.heartbeat(0.35);
    } else {
      if (b) b.done = true;
      this.miss(now);
    }
    return true;
  },

  // Σε πλήρη ανάλυση (CSS px), πάνω από τον κόσμο.
  draw(ctx, W, H, now) {
    if (!this.active) return;
    const cx = W / 2, cy = H * 0.6, span = Math.min(260, W * 0.36);
    const fl = Math.max(0, 1 - (now - this.flash.t) / 0.35);
    ctx.save();
    // Οι δύο "διάδρομοι" και ο κύκλος στη μέση.
    ctx.strokeStyle = 'rgba(206,108,56,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - span, cy); ctx.lineTo(cx - 26, cy);
    ctx.moveTo(cx + 26, cy); ctx.lineTo(cx + span, cy);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = fl > 0 ? (this.flash.ok ? `rgba(255,236,190,${0.5 + fl * 0.5})` : `rgba(255,60,40,${0.5 + fl * 0.5})`) : 'rgba(236,156,98,0.8)';
    ctx.beginPath();
    ctx.arc(cx, cy, 22 + fl * 6, 0, Math.PI * 2);
    ctx.stroke();
    const heart = (x, y, s, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.9);
      ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.1, x, y - s * 0.35);
      ctx.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
      ctx.fill();
    };
    for (const b of this.beats) {
      const k = 1 - (b.at - now) / HEART_TRAVEL;     // 0 στην άκρη, 1 στη μέση
      if (b.done) {
        if (b.hit) heart(cx, cy, 14 + (now - b.at) * 40, `rgba(255,236,190,${Math.max(0, 0.8 - (now - b.at) * 2)})`);
        continue;
      }
      const x = cx + b.side * span * (1 - Math.min(1, k));
      heart(x, cy, 12 + (k > 0.9 ? 3 : 0), 'rgba(220,60,44,0.95)');
    }
    // Ποιο κουμπί για ποια πλευρά (οδηγία χειρισμού, όχι κείμενο της ιστορίας).
    ctx.fillStyle = 'rgba(231,207,174,0.75)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const touch = typeof IS_TOUCH !== 'undefined' && IS_TOUCH;
    ctx.fillText(touch ? 'Tap left' : 'A / Left click', cx - span * 0.6, cy + 30);
    ctx.fillText(touch ? 'Tap right' : 'D / Right click', cx + span * 0.6, cy + 30);
    ctx.restore();
  },
};
