'use strict';

// Στάδιο 4 της επέκτασης (STORY.md, ενότητα 12): υλικά και αντικείμενα που φτιάχνεις στα ιερά του Ερμή
// (Inventory), κιβώτια που τρίζουν όταν τα ανοίγεις (Chests), κρυψώνες όπου κρατάς την ανάσα σου (Hides).
// Τα ονόματα / μηνύματα: STORY.materials, STORY.tools κ.λπ.
//
// Από 8/10 το Inventory είναι σαν του Minecraft: θέσεις (slots) με στοίβες { id, n }. Οι πρώτες
// HOTBAR_SLOTS είναι η μπάρα κάτω στη μέση (1-6 / ροδέλα = τι κρατάς στο χέρι), οι υπόλοιπες ο "σάκος".
// Η λύρα είναι κι αυτή αντικείμενο: τη βάζεις στον σάκο για να κρατάς κάτι άλλο (το κύμα με το Space
// βγαίνει πάντα — είναι η φωνή του Ορφέα).

const MATERIALS = ['clay', 'wine', 'honey', 'poppy', 'bronze', 'thread', 'resin', 'wax'];
// Τι φτιάχνεται από τι (δύο υλικά το καθένα).
const RECIPES = [
  { id: 'jar', needs: ['clay', 'wine'] },
  { id: 'cake', needs: ['honey', 'poppy'] },
  { id: 'bell', needs: ['bronze', 'thread'] },
  { id: 'lyreResin', needs: ['resin', 'wax'] },
];
// Τα αντικείμενα που χρησιμοποιούνται από το χέρι (πετιούνται).
const TOOL_ORDER = ['jar', 'pebble', 'cake', 'bell'];
const HOTBAR_SLOTS = 6;
const BAG_SLOTS = 18;
const STACK_MAX = 64;

const CHEST_REACH = 34;       // τόσο κοντά = "Open"
const HIDE_REACH = 30;
const BREATH_TIME = 6;        // δευτ. που κρατάς την ανάσα σου όταν μια σκιά είναι κοντά
const BREATH_NEAR = 240;      // τόσο κοντά = η σκιά σε "ψάχνει" (η ανάσα αδειάζει)
const CHEST_REFILL = 30;      // δευτ.: στο κεφάλαιο του boss τα κιβώτια ξαναγεμίζουν με μελόπιτες
// Οι πινακίδες με οδηγίες (STORY.tablets): οι συνταγές (III, μετά τον Χάροντα) και ο Κέρβερος (X).
const TABLET_RECIPES = 1;
const TABLET_BOSS = 5;

const Inventory = {
  slots: [],            // HOTBAR_SLOTS + BAG_SLOTS θέσεις: null ή { id, n }
  sel: 0,               // ποια θέση της μπάρας κρατάς
  opened: new Set(),    // id των κιβωτίων που άνοιξες
  maps: new Set(),      // κεφάλαια των οποίων βρήκες τον χάρτη
  tablets: new Set(),   // οι πινακίδες που διάβασες (STORY.tablets[n]) — ξαναδιαβάζονται στο Inventory
  made: new Set(),      // τι έχεις φτιάξει ήδη (για την αποστολή)

  reset(saved) {
    const inv = saved.inv || {};
    this.slots = new Array(HOTBAR_SLOTS + BAG_SLOTS).fill(null);
    if (Array.isArray(inv.slots)) {
      inv.slots.forEach((s, i) => {
        if (i < this.slots.length && s && typeof s.id === 'string' && Number.isInteger(s.n) && s.n > 0) this.slots[i] = { id: s.id, n: s.n };
      });
    } else {
      // Παλιό save (πριν τις θέσεις): η λύρα, τα αντικείμενα στη μπάρα, τα υλικά στον σάκο.
      this.slots[0] = { id: 'lyre', n: 1 };
      this.add('jar', saved.jars | 0);
      this.add('pebble', inv.pebbles | 0);
      this.add('cake', inv.cakes | 0);
      this.add('bell', inv.bells | 0);
      for (const m of MATERIALS) this.add(m, (inv.mats && inv.mats[m]) | 0);
    }
    if (!this.count('lyre')) this.add('lyre', 1);
    this.sel = Number.isInteger(inv.sel) && inv.sel >= 0 && inv.sel < HOTBAR_SLOTS ? inv.sel : 0;
    this.opened = new Set(Array.isArray(inv.opened) ? inv.opened : []);
    this.maps = new Set(Array.isArray(inv.maps) ? inv.maps : []);
    this.tablets = new Set(Array.isArray(inv.tablets) ? inv.tablets : []);
    this.made = new Set(Array.isArray(inv.made) ? inv.made : []);
  },

  saveData() {
    return { inv: { slots: this.slots.map((s) => (s ? { id: s.id, n: s.n } : null)), sel: this.sel,
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
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.n;
    return n;
  },

  // Τι κρατάς στο χέρι ('lyre', 'jar', 'clay', ... ή null).
  held() {
    const s = this.slots[this.sel];
    return s ? s.id : null;
  },

  // Βάζει n από κάτι: πρώτα στις στοίβες που υπάρχουν, μετά σε άδεια θέση (αντικείμενα: πρώτα στη
  // μπάρα· υλικά: πρώτα στον σάκο). Ό,τι δεν χωράει χάνεται (δεν γίνεται με 24 θέσεις).
  add(id, n = 1) {
    if (n <= 0) return;
    const max = id === 'lyre' ? 1 : STACK_MAX;
    for (const s of this.slots) {
      if (n <= 0) return;
      if (s && s.id === id && s.n < max) { const k = Math.min(n, max - s.n); s.n += k; n -= k; }
    }
    const order = [];
    const hot = [...Array(HOTBAR_SLOTS).keys()], bag = [...Array(BAG_SLOTS).keys()].map((i) => i + HOTBAR_SLOTS);
    order.push(...(this.isMaterial(id) ? bag.concat(hot) : hot.concat(bag)));
    for (const i of order) {
      if (n <= 0) return;
      if (!this.slots[i]) { const k = Math.min(n, max); this.slots[i] = { id, n: k }; n -= k; }
    }
  },

  // Παίρνει n από κάτι (πρώτα από τον σάκο, ώστε η μπάρα να αδειάζει τελευταία). true αν υπήρχαν.
  take(id, n = 1) {
    if (this.count(id) < n) return false;
    for (let pass = 0; pass < 2 && n > 0; pass++) {
      for (let i = 0; i < this.slots.length && n > 0; i++) {
        const s = this.slots[i];
        if (!s || s.id !== id || (pass === 0) === (i < HOTBAR_SLOTS)) continue;
        const k = Math.min(n, s.n);
        s.n -= k;
        n -= k;
        if (!s.n) this.slots[i] = null;
      }
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
    const spr = { lyre: 'lyre', jar: 'lekythos', pebble: 'rocks', cake: 'cake', bell: 'bell' }[id];
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
    } else if (id === 'honey') {  // πήλινο βαζάκι με μέλι
      ell(8, 10, 5, 5, O); ell(8, 10, 4, 4, '#ce6c38'); px(5, 4, O, 7, 2); px(6, 5, '#e8b040', 5, 2); px(7, 7, '#ffd772', 2, 1);
    } else if (id === 'poppy') {  // παπαρούνα
      px(8, 9, '#4d6a2a', 1, 6); ell(8, 6, 4, 3, O); ell(8, 6, 3, 2, '#c8302a'); px(8, 6, '#2a1210'); px(6, 5, '#f05a40');
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

  // Στο κεφάλαιο του Κέρβερου (όσο είναι ξύπνιος) τα άδεια κιβώτια ξαναγεμίζουν, ώστε να μην κολλήσεις.
  update(now, bossAlive) {
    if (!bossAlive || !Level.boss) return;
    for (const c of this.list) {
      if (c.opened && c.region === Level.boss.region && now - c.openedAt > CHEST_REFILL) {
        c.opened = false;
        Inventory.opened.delete(c.id);
      }
    }
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
  // φορές χαλίκια, και — στο σημαδεμένο κιβώτιο κάθε κεφαλαίου — τον χάρτη. Στο κεφάλαιο του Κέρβερου:
  // μελόπιτες. Επιστρέφει το κείμενο.
  open(c, now) {
    c.opened = true;
    c.openedAt = now;
    c.revealTime = now;
    c.revealStrength = 1;
    Inventory.opened.add(c.id);
    Echoes.emit(c.x, c.y, 170, 0.42, 'step');
    Sound.creak(c.x, c.y);
    const got = [];
    if (Level.boss && c.region === Level.boss.region) {
      Inventory.add('cake', 2);
      got.push(STORY.tools.cake + ' ×2');
    } else {
      const a = MATERIALS[(c.id * 2) % MATERIALS.length], b = MATERIALS[(c.id * 2 + 1) % MATERIALS.length];
      for (const m of [a, b]) { Inventory.add(m, 1); got.push(STORY.materials[m]); }
      if (c.id % 3 === 0 || c.map) { Inventory.add('pebble', 3); got.push(STORY.tools.pebble); }
    }
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
    Sound.breath(false);
  },

  // Κάθε καρέ όσο είσαι κρυμμένος: η ανάσα αδειάζει όσο μια σκιά είναι κοντά και ξαναγεμίζει όταν φύγει.
  // Επιστρέφει true αν τελείωσε η ανάσα (λαχάνιασμα).
  update(dt, mons) {
    if (!this.active) {
      this.breath = Math.min(1, this.breath + dt / 3);
      return false;
    }
    const near = mons.some((m) => !m.isFrozen() && Math.hypot(m.x - player.x, m.y - player.y) < BREATH_NEAR);
    this.breath = near ? this.breath - dt / BREATH_TIME : Math.min(1, this.breath + dt / 3);
    return this.breath <= 0;
  },
};
