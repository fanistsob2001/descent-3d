'use strict';

// Ακτίνα του εικονικού joystick σε CSS pixels.
const JOY_RADIUS = 55;
const JOY_DEADZONE = 0.12;
// Πάνω από αυτό το ποσοστό του joystick ο παίκτης τρέχει (και κάνει θόρυβο).
// Κάτω από αυτό περπατάει αργά και αθόρυβα.
const RUN_THRESHOLD = 0.6;
// Μέγιστος χρόνος φόρτισης του κύματος (δευτ.).
const MAX_CHARGE = 1.5;
// Drag-to-cancel: αν σύρεις το δάχτυλο τόσο μακριά (CSS px) από εκεί που ξεκίνησε η
// φόρτιση, το κύμα ακυρώνεται με ασφάλεια (δεν βγαίνει κανένας ήχος).
const CANCEL_DRAG = 80;

// Ποντίκι χωρίς κλείδωμα (μόνο ως εφεδρεία, αν ο browser δεν το επιτρέπει): τόσο ποσοστό του πλάτους στην αριστερή/δεξιά άκρη γυρίζει συνέχεια το βλέμμα.
const MOUSE_EDGE = 0.08;
const LOCK_RETRY = 1100;   // ms: σε πόσο ξαναδοκιμάζει να πιάσει το ποντίκι αν αποτύχει (π.χ. αμέσως μετά το Esc)
const MOUSE_TOP = 90;      // CSS px από πάνω: η ζώνη των κουμπιών, όπου η άκρη δεν γυρίζει το βλέμμα

// Το κουμπί της λύρας (κάτω δεξιά, σε CSS px από τις άκρες): κράτημα = φόρτιση κύματος.
const LYRE_BTN = { right: 76, bottom: 100, r: 50 };

const Input = {
  keys: {},
  moveX: 0,         // πλάγια κίνηση (+ = δεξιά)
  moveY: 0,         // μπρος / πίσω (- = μπροστά, όπως το "πάνω" του joystick)
  turn: 0,          // στροφή από τα βελάκια (-1..1)
  lookDX: 0,        // πόσο έσυρε το δάχτυλο για να γυρίσει το βλέμμα (CSS px, μαζεύεται ως το επόμενο καρέ)
  mouseDX: 0,       // το ίδιο από το ποντίκι (με pointer lock)
  mouseDY: 0,       // κάθετη κίνηση του ποντικιού (βλέμμα πάνω / κάτω)
  running: false,   // true = γρήγορο περπάτημα με θόρυβο βημάτων
  canLook: () => false,   // το main λέει πότε το ποντίκι μπορεί να "κλειδώσει" (μόνο όσο παίζεις)

  // Εικονικό joystick (αριστερό μισό οθόνης). Εμφανίζεται εκεί που ακουμπάς.
  joy: { id: null, ox: 0, oy: 0, x: 0, y: 0 },
  // Το δάχτυλο που γυρίζει το βλέμμα (δεξί μισό, έξω από το κουμπί της λύρας).
  look: { id: null, x: 0 },

  // Το κέντρο και η ακτίνα του κουμπιού της λύρας (CSS px).
  lyreButton() {
    // Οι safe areas (env(...)) διαβάζονται μόνο από ένα στοιχείο που τις χρησιμοποιεί.
    if (!this._safe) {
      this._safe = document.createElement('div');
      this._safe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;' +
        'padding-right:env(safe-area-inset-right,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
      document.body.appendChild(this._safe);
    }
    const s = getComputedStyle(this._safe);
    const sr = parseFloat(s.paddingRight) || 0, sb = parseFloat(s.paddingBottom) || 0;
    return { x: window.innerWidth - LYRE_BTN.right - sr, y: window.innerHeight - LYRE_BTN.bottom - sb, r: LYRE_BTN.r };
  },

  // Φόρτιση κύματος (κουμπί λύρας, Space ή αριστερό κλικ με κλειδωμένο ποντίκι).
  charging: false,
  chargeStart: 0,
  chargeSource: null,   // 'key' ή pointerId
  onRelease: null,      // callback(heldSeconds)
  onCancel: null,       // callback() όταν η φόρτιση ακυρώνεται με σύρσιμο (ή X στο PC)
  onPrimary: null,      // callback() στο αριστερό κλικ· true = το χειρίστηκε (π.χ. πέταξε αντικείμενο), όχι κύμα
  chargeX: 0,           // πού ακούμπησε το δάχτυλο που φορτίζει
  chargeY: 0,
  chargeDrag: 0,        // 0..1: πόσο κοντά είναι το σύρσιμο στην ακύρωση

  // Η ώρα του παιχνιδιού έρχεται από το main loop ώστε η φόρτιση να μετράει σωστά.
  now: () => 0,

  init(canvas) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) this.startCharge('key');
      }
      // Στο PC: X ακυρώνει το κύμα που φορτίζει (αντίστοιχο του drag-to-cancel).
      if (e.code === 'KeyX' && this.charging && (this.chargeSource === 'key' || this.chargeSource === 'mouse')) this.dragCancel();
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'Space') this.endCharge('key');
    });
    window.addEventListener('blur', () => {
      this.keys = {};
      this.joy.id = null;
      this.look.id = null;
      this.cancelCharge();
    });

    // Ποντίκι (PC), όπως σε κάθε παιχνίδι πρώτου προσώπου: όσο παίζεις, το ποντίκι είναι
    // "πιασμένο" (pointer lock — ο κέρσορας μένει κρυφός στο κέντρο, στροφή χωρίς όρια). Πιάνεται
    // μόνο του όταν ξεκινάς / συνεχίζεις (main: setState('play')), ή με οποιοδήποτε κλικ όσο παίζεις.
    // Κίνηση = βλέμμα (οριζόντια και κάθετα), αριστερό κλικ (κράτημα) = κύμα, δεξί = ακύρωση,
    // Esc = το ελευθερώνει (→ παύση). Αν το κλείδωμα αποτύχει προσωρινά (π.χ. το Chrome το αρνείται
    // ~1 δευτ. μετά το Esc), ξαναδοκιμάζει μόνο του (LOCK_RETRY).
    // Όπου ο browser δεν το επιτρέπει ΠΟΤΕ (lockUnsupported: π.χ. ο browser μέσα στην εφαρμογή του
    // Claude ή ένα iframe — WrongDocumentError), το βλέμμα γυρίζει με την κίνηση του (κρυφού)
    // κέρσορα και συνεχώς όταν φτάσει στις άκρες (MOUSE_EDGE)· το κλικ φορτίζει κύμα κατευθείαν.
    this.canvas = canvas;
    this.locked = false;
    this.lockUnsupported = false;   // το κλείδωμα απαγορεύεται μόνιμα εδώ
    this.lockFailed = false;        // χωρίς κλείδωμα: το κλικ φορτίζει κύμα κατευθείαν (μόνιμα ή μετά από 2 αποτυχίες)
    this.mouseX = -1;               // πού είναι ο κέρσορας (-1 = έξω από το παράθυρο) — για τη στροφή στις άκρες
    let fails = 0, fromClick = false, retry = 0, retries = 0;
    const unsupported = () => { this.lockUnsupported = true; this.lockFailed = true; clearTimeout(retry); };
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.locked) { fails = 0; retries = 0; this.lockFailed = this.lockUnsupported; clearTimeout(retry); }
      if (!this.locked && this.chargeSource === 'mouse') this.cancelCharge();
    });
    document.addEventListener('pointerlockerror', () => {
      if (this.lockUnsupported) return;
      if (fromClick) { retries = 0; if (++fails >= 2) this.lockFailed = true; }
      fromClick = false;
      // Ξαναδοκίμασε σε λίγο (ως 2 φορές μετά από κάθε κλικ, ώστε να μη δοκιμάζει για πάντα).
      clearTimeout(retry);
      if (retries++ < 2) retry = setTimeout(() => { if (this.canLook()) this.requestLock(false); }, LOCK_RETRY);
    });
    this.requestLock = (click) => {
      if (this.locked || this.lockUnsupported) return;
      if (!canvas.requestPointerLock) { unsupported(); return; }
      fromClick = !!click;
      try {
        const pr = canvas.requestPointerLock();
        if (pr && pr.catch) {
          pr.catch((e) => {
            // Μόνιμη άρνηση (η σελίδα είναι ενσωματωμένη / δεν υποστηρίζεται) ≠ προσωρινή (SecurityError).
            if (e && (e.name === 'WrongDocumentError' || e.name === 'NotSupportedError')) unsupported();
          });
        }
      } catch (e) {
        if (e && (e.name === 'WrongDocumentError' || e.name === 'NotSupportedError')) unsupported();
      }
    };
    // Οποιοδήποτε κλικ στη σελίδα όσο παίζεις (όχι μόνο στον καμβά) ξαναπιάνει το ποντίκι.
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && !this.locked && this.canLook()) this.requestLock(true);
    }, true);
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;   // όχι από άγγιγμα (κινητό)
      if (this.locked) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      } else if (this.canLook()) {
        // Χωρίς κλείδωμα (ο κέρσορας είναι κρυφός όσο παίζεις): η κίνησή του γυρίζει το βλέμμα.
        // Η πάνω ζώνη με τα κουμπιά δεν γυρίζει το βλέμμα από την άκρη.
        this.mouseX = e.clientY > MOUSE_TOP ? e.clientX : -1;
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    });
    document.addEventListener('mouseleave', () => { this.mouseX = -1; });
    window.addEventListener('blur', () => { this.mouseX = -1; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (e.pointerType === 'mouse') {
        if (!this.locked && !this.lockFailed) {
          // Το κλικ ζήτησε ήδη να πιαστεί το ποντίκι (window pointerdown πιο πάνω)· δεν είναι κύμα.
          // (Όπου το κλείδωμα δεν γίνεται — lockFailed — το κλικ είναι κύμα, παρακάτω.)
        } else if (e.button === 0) {
          // Αν κρατάς κάτι που πετιέται, το κλικ το πετάει (main.js)· αλλιώς είναι κύμα.
          if (!(this.onPrimary && this.onPrimary())) this.startCharge('mouse');
        } else if (e.button === 2 && this.chargeSource === 'mouse') {
          this.dragCancel();   // δεξί κλικ ενώ φορτίζεις = ακύρωση (σαν το X)
        }
        return;
      }
      if (e.clientX < window.innerWidth / 2) {
        if (this.joy.id !== null) return;
        this.joy.id = e.pointerId;
        this.joy.ox = this.joy.x = e.clientX;
        this.joy.oy = this.joy.y = e.clientY;
      } else {
        const b = this.lyreButton();
        if (Math.hypot(e.clientX - b.x, e.clientY - b.y) <= b.r * 1.3) {
          this.startCharge(e.pointerId);
          this.chargeX = e.clientX;
          this.chargeY = e.clientY;
        } else if (this.look.id === null) {
          this.look.id = e.pointerId;
          this.look.x = e.clientX;
        }
      }
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* δεν πειράζει */ }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.joy.id) {
        this.joy.x = e.clientX;
        this.joy.y = e.clientY;
      }
      if (e.pointerId === this.look.id) {
        this.lookDX += e.clientX - this.look.x;
        this.look.x = e.clientX;
      }
      if (this.charging && e.pointerId === this.chargeSource) {
        const d = Math.hypot(e.clientX - this.chargeX, e.clientY - this.chargeY);
        this.chargeDrag = Math.min(1, d / CANCEL_DRAG);
        if (d >= CANCEL_DRAG) this.dragCancel();
      }
    });
    const up = (e) => {
      if (e.pointerType === 'mouse') {
        if (e.button === 0) this.endCharge('mouse');
        return;
      }
      if (e.pointerId === this.joy.id) this.joy.id = null;
      if (e.pointerId === this.look.id) this.look.id = null;
      if (e.type === 'pointercancel' && this.chargeSource === e.pointerId) this.cancelCharge();
      else this.endCharge(e.pointerId);
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  },

  startCharge(source) {
    if (this.charging) return;
    this.chargeDrag = 0;
    this.charging = true;
    this.chargeSource = source;
    this.chargeStart = this.now();
  },

  endCharge(source) {
    if (!this.charging || this.chargeSource !== source) return;
    const held = Math.min(MAX_CHARGE, this.now() - this.chargeStart);
    this.charging = false;
    this.chargeSource = null;
    if (this.onRelease) this.onRelease(held);
  },

  cancelCharge() {
    this.charging = false;
    this.chargeSource = null;
    this.chargeDrag = 0;
  },

  // Ακύρωση από τον παίκτη (σύρσιμο ή X): σβήνει τη φόρτιση και το λέει στο main.
  dragCancel() {
    if (!this.charging) return;
    const amount = this.chargeAmount();
    this.cancelCharge();
    if (this.onCancel) this.onCancel(amount);
  },

  // 0..1: πόσο έχει φορτίσει το κύμα αυτή τη στιγμή.
  chargeAmount() {
    if (!this.charging) return 0;
    return Math.min(1, (this.now() - this.chargeStart) / MAX_CHARGE);
  },

  // Υπολογίζει moveX/moveY (μήκος 0..1) από joystick ή πληκτρολόγιο.
  update() {
    let mx = 0, my = 0;

    if (this.joy.id !== null) {
      const dx = (this.joy.x - this.joy.ox) / JOY_RADIUS;
      const dy = (this.joy.y - this.joy.oy) / JOY_RADIUS;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        // Το κέντρο "ακολουθεί" το δάχτυλο αν ξεφύγει πολύ.
        this.joy.ox = this.joy.x - (dx / len) * JOY_RADIUS;
        this.joy.oy = this.joy.y - (dy / len) * JOY_RADIUS;
      }
      const m = Math.min(1, len);
      if (m > JOY_DEADZONE) {
        const strength = (m - JOY_DEADZONE) / (1 - JOY_DEADZONE);
        mx = (dx / len) * strength;
        my = (dy / len) * strength;
      }
    }

    // WASD: μπρος/πίσω/πλάγια· ←/→: στροφή· ↑/↓: μπρος/πίσω.
    const k = this.keys;
    const kx = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    const ky = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
    this.turn = (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0);
    // Χωρίς κλείδωμα: ο (κρυφός) κέρσορας κοντά στην αριστερή/δεξιά άκρη = συνεχής στροφή προς τα εκεί.
    if (!this.locked && this.mouseX >= 0 && this.joy.id === null) {
      const edge = Math.max(24, window.innerWidth * MOUSE_EDGE);
      if (this.mouseX < edge) this.turn -= 1 - this.mouseX / edge;
      else if (this.mouseX > window.innerWidth - edge) this.turn += 1 - (window.innerWidth - this.mouseX) / edge;
      this.turn = Math.max(-1, Math.min(1, this.turn));
    }
    if (kx || ky) {
      // Με Shift: αργό, αθόρυβο περπάτημα.
      const sneak = k.ShiftLeft || k.ShiftRight;
      const l = Math.hypot(kx, ky) / (sneak ? RUN_THRESHOLD : 1);
      mx = kx / l;
      my = ky / l;
    }

    this.moveX = mx;
    this.moveY = my;
    this.running = Math.hypot(mx, my) > RUN_THRESHOLD + 1e-3;
  },
};
