'use strict';

// Τα σκηνικά και τα αντικείμενα (js/art.js): δέντρα, έπιπλα, σπηλιές, Κάτω Κόσμος, αντικείμενα.
// Το ύψος τους στον κόσμο είναι από το RC_REAL_H (js/raycast.js)· εδώ μόνο πόσο λεπτομερής είναι η ζωγραφιά.

// Αγγείο εκ περιστροφής (αμφορέας, λήκυθος, πίθος): προφίλ = [[y, μισό πλάτος], ...] από πάνω προς τα κάτω.
// Πηλός με μαύρες ζώνες και μαίανδρο (μελανόμορφο), λαβές.
function artVase(g, cx, prof, o = {}) {
  const L = prof.map(([y, r]) => [cx - r, y]), R = prof.map(([y, r]) => [cx + r, y]).reverse();
  const body = g.blob([...L, ...R], o.tone || 'cla3', { size: 12 });
  if (o.bands) {
    g.inside(body, () => {
      for (const [y0, y1, t] of o.bands) g.poly([[0, y0], [999, y0], [999, y1], [0, y1]], t || 'ink1', { flat: true });
      if (o.meander) for (let x = cx - 20; x < cx + 20; x += 3) g.line([[x, o.meander + 1.2], [x, o.meander - 0.6], [x + 1.6, o.meander - 0.6]], 0.6, 'cla4', {});
    });
  }
  if (o.handles) g.sym(cx, (m) => g.limb([[m(cx + o.handles[0]), o.handles[1]], [m(cx + o.handles[0] + 4), o.handles[1] + 3], [m(cx + o.handles[0] + 1), o.handles[2]]], 2, 2, o.tone || 'cla3', { size: 2, cap: false }));
  return body;
}

// Πέτρα: ακανόνιστο σχήμα με ρωγμές και κόκκους.
function artRock(g, cx, cy, rx, ry, t, seed) {
  const rnd = ArtPainter.rng(seed), pts = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, k = 0.78 + rnd() * 0.3;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k * (Math.sin(a) > 0 ? 0.7 : 1), i % 3 === 0 ? 1 : 0]);
  }
  const p = g.blob(pts, t, { size: Math.min(rx, ry) * 2 });
  g.speckle(p, t.replace(/\d/, (d) => Math.max(0, d - 2)), Math.round(rx * ry * 0.4), 0.6, seed + 3);
  g.line([[cx - rx * 0.3, cy - ry * 0.3], [cx, cy + ry * 0.1], [cx + rx * 0.2, cy + ry * 0.4]], 1, t.replace(/\d/, (d) => Math.max(0, d - 2)), { px: true });
  return p;
}

// Φύλλωμα: πολλά μικρά φυλλαράκια (ελλείψεις με τυχαία κλίση) σε τρεις τόνους, μέσα σε μια περιοχή (κέντρα και
// ακτίνες). Πρώτα τα σκούρα (πίσω), μετά τα φωτεινά από πάνω-αριστερά (φως).
function artFoliage(g, clusters, tones, n, leaf, seed) {
  const rnd = ArtPainter.rng(seed);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const [cx, cy, rx, ry] = clusters[Math.floor(rnd() * clusters.length)];
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
    const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r;
    // πιο φωτεινά προς τα πάνω-αριστερά κάθε συστάδας
    const lit = (cy - y) / ry * 0.6 + (cx - x) / rx * 0.4 + (rnd() - 0.5) * 0.9;
    pts.push([x, y, lit > 0.35 ? 2 : lit > -0.35 ? 1 : 0, rnd() * Math.PI]);
  }
  pts.sort((a, b) => a[2] - b[2]);
  for (const [x, y, k, rot] of pts) g.ell(x, y, leaf, leaf * 0.5, tones[k], { rot, flat: true });
}

ART_BUILDERS.push((A) => {
  const P = ART_PX;
  const px = (h, min = 20) => Math.max(min, h * P);

  // ---- Ο πάνω κόσμος ----
  // Ελιά: στριφτός, χοντρός κορμός, κλαδιά, συστάδες ασημοπράσινων (εδώ: χακί) φύλλων. f = 0 / 1: δύο σχήματα.
  A.paint('olive', 120, 110, px(62), (g, f) => {
    const rnd = ArtPainter.rng(5 + f * 11);
    g.limb([[54, 110], [50, 92], [58, 78], [52, 62]], [16, 12, 11, 9], 0, 'brn2/brn4', { size: 10 });
    g.limb([[60, 108], [64, 94], [58, 80]], [8, 7, 5], 0, 'brn2/brn4', { size: 6 });
    const tr = g.limbPath([[54, 110], [50, 92], [58, 78], [52, 62]], [16, 12, 11, 9], 0);
    g.hatch(tr, 'brn1', 6, (i) => [[46 + i * 3, 108], [48 + i * 2.6, 90], [52 + i * 1.6, 66]], 1, 2);
    for (const [x, y] of f ? [[24, 40], [40, 22], [80, 26], [96, 44]] : [[28, 34], [50, 18], [76, 20], [94, 38]]) g.limb([[53, 64], [(53 + x) / 2, (64 + y) / 2 + 6], [x, y]], 5, 2, 'brn2/brn4', { size: 4 });
    const cl = [];
    for (let i = 0; i < 10; i++) cl.push([16 + rnd() * 88, 14 + rnd() * 40 + Math.abs(i - 5) * 2, 12 + rnd() * 8, 8 + rnd() * 5]);
    for (const [x, y, rx, ry] of cl) g.ell(x, y, rx * 0.8, ry * 0.75, 'brn1', { flat: true });
    artFoliage(g, cl, ['brn2', 'brn3', 'brn5'], 900, 2.2, 7 + f);
  }, { frames: 2, dither: 0.25 });
  // Κυπαρίσσι: ψηλή, στενή φλόγα από σκούρο φύλλωμα.
  A.paint('cypress', 30, 110, px(105), (g) => {
    g.limb([[15, 110], [15, 100]], 4, 3.4, 'brn1/brn3', { size: 3 });
    g.blob([[15, 0, 1], [19, 12], [23, 34], [25, 60], [24, 84], [20, 100], [10, 100], [6, 84], [5, 60], [7, 34], [11, 12]], 'brn1', { flat: true });
    const cl = [];
    for (let y = 6; y < 98; y += 6) { const w = Math.min(10, 2 + y * 0.35, (100 - y) * 0.6 + 3); cl.push([15, y, w, 5]); }
    artFoliage(g, cl, ['brn1', 'brn2', 'brn3'], 700, 1.8, 3);
  }, { dither: 0.25 });
  // Θάμνος (πρόλογος).
  A.paint('bush', 50, 30, px(9), (g) => {
    const cl = [[12, 20, 9, 8], [26, 14, 12, 10], [38, 20, 9, 8], [24, 22, 10, 7]];
    for (const [x, y, rx, ry] of cl) g.ell(x, y, rx, ry, 'brn1', { flat: true });
    artFoliage(g, cl, ['brn2', 'brn3', 'brn5'], 260, 2, 5);
  }, { dither: 0.2 });
  // Λουλούδια του λιβαδιού: παπαρούνες και μαργαρίτες σε μια μικρή τούφα χορταριού.
  A.paint('flowers', 30, 20, px(4, 22), (g) => {
    for (let i = 0; i < 9; i++) g.limb([[3 + i * 3, 20], [4 + i * 3 + (i % 3) - 1, 9 + (i % 4) * 2]], 1.2, 0.4, i % 2 ? 'brn4' : 'brn3', { size: 1, cap: false });
    for (const [x, y, t] of [[6, 7, 'red4'], [15, 4, 'crm5'], [22, 8, 'red4'], [11, 11, 'crm5'], [26, 12, 'red3']]) { g.dot(x, y, 2.2, t); g.px(x, y, t === 'crm5' ? 'gld4' : 'ink1', 1); }
  }, { dither: 0.1 });
  // Ασφόδελος: ψηλός μίσχος με λευκά άνθη (Ασφόδελοι, πρόλογος).
  A.paint('asphodel', 24, 40, px(7, 26), (g) => {
    for (const [x, h] of [[8, 4], [14, 0], [19, 8]]) {
      g.limb([[x, 40], [x + 0.5, h + 8]], 1.4, 1, 'brn3', { size: 1 });
      for (let k = 0; k < 4; k++) { g.dot(x + (k % 2 ? 2 : -1.5), h + 3 + k * 3, 1.6, 'crm5'); g.px(x + (k % 2 ? 2 : -1.5), h + 3 + k * 3, 'cla3'); }
    }
    for (let i = 0; i < 5; i++) g.limb([[6 + i * 3, 40], [3 + i * 4, 30]], 1.6, 0.3, 'brn3', { size: 1, cap: false });
  }, { dither: 0.1 });
  // Ο αμφορέας (χωριό, παλάτι) και ο σπασμένος.
  A.paint('amphora', 30, 50, px(10, 36), (g) => artVase(g, 15, [[2, 4], [3, 3], [10, 3], [14, 9], [22, 12], [32, 10], [42, 5], [48, 2.5], [50, 4]], { tone: 'cla3', bands: [[24, 31, 'ink1'], [37, 39, 'ink1']], meander: 27.5, handles: [3, 4, 14] }), { dither: 0.2 });
  A.paint('amphoraBroken', 34, 30, px(6, 24), (g) => {
    artVase(g, 17, [[8, 9], [10, 11], [18, 12], [26, 9], [30, 4]], { tone: 'cla3', bands: [[14, 18, 'ink1']] });
    g.poly([[8, 9], [12, 3], [15, 9], [19, 5], [22, 9], [26, 4], [26, 9]], 'cla3', { size: 4 });
    g.ell(17, 9, 8, 1.6, 'ink0', { flat: true });
    g.poly([[1, 29], [6, 26], [9, 29]], 'cla2', { size: 3 }); g.poly([[27, 29], [31, 25], [33, 29]], 'cla2', { size: 3 });
  }, { dither: 0.2 });
  // Λήκυθος (το αγγείο σπονδής).
  A.paint('lekythos', 16, 30, px(5, 22), (g) => {
    artVase(g, 8, [[1, 3], [3, 1.6], [8, 1.6], [9, 5], [14, 6.5], [24, 6], [28, 3], [30, 3.5]], { tone: 'cla3', bands: [[14, 19, 'ink1']] });
    g.limb([[9, 4], [12.5, 6], [12, 10]], 1.4, 1.4, 'cla3', { size: 1, cap: false });
  }, { dither: 0.2 });
  // Επιτύμβια στήλη: μάρμαρο με ανάγλυφο ανθέμιο. f = 1: λουλούδια και ένα λυχνάρι στη βάση (μετά την κηδεία).
  A.paint('stele', 30, 60, px(17), (g, f) => {
    g.poly([[5, 60], [6, 12], [24, 12], [25, 60]], 'crm3/crm5', { size: 18 });
    g.blob([[4, 13], [8, 6], [15, 1], [22, 6], [26, 13]], 'crm3/crm5', { size: 10 });
    for (let i = 0; i < 5; i++) g.limb([[15, 10], [9 + i * 3, 4 + Math.abs(i - 2)]], 1.4, 0.8, 'crm1', { size: 1 });
    g.poly([[9, 22], [21, 22], [21, 44], [9, 44]], 'crm2', { size: 10 });
    for (let y = 26; y < 42; y += 3) g.line([[11, y], [19, y]], 1, 'crm1', { px: true });
    g.poly([[2, 60], [3, 56], [27, 56], [28, 60]], 'brn3', { size: 4 });
    if (f) {
      for (const [x, t] of [[6, 'red4'], [9, 'crm5'], [22, 'red4'], [25, 'crm5']]) { g.limb([[x, 60], [x + 1, 52]], 1, 0.6, 'brn3', { size: 1 }); g.dot(x + 1, 51, 1.8, t); }
      g.blob([[12, 57], [18, 57], [19, 59.5], [11, 59.5]], 'cla2', { size: 2 });
    }
  }, { frames: 2, dither: 0.2 });
  // Το σπίτι: τζάκι, αργαλειός, τραπέζι, κρεβάτι.
  A.paint('hearth', 60, 26, px(13), (g) => {
    for (let i = 0; i < 8; i++) artRock(g, 5 + i * 7.2, 20 + (i % 2), 5, 4, 'brn2', 40 + i);
    g.ell(30, 18, 20, 4, 'ink1', { flat: true });
    for (const [x, y] of [[20, 16], [30, 15], [40, 16], [26, 18], [36, 18]]) { g.dot(x, y, 2, 'red3'); g.px(x, y - 0.5, 'cla5'); }
    g.limb([[14, 18], [44, 12]], 5, 4, 'brn1/brn3', { size: 4 }); g.limb([[16, 11], [46, 18]], 5, 4, 'brn2/brn4', { size: 4 });
  }, { dither: 0.2 });
  A.paint('loom', 50, 80, px(22), (g) => {
    g.limb([[5, 0], [8, 80]], 3.6, 3.6, 'brn2/brn4', { size: 3 }); g.limb([[45, 0], [42, 80]], 3.6, 3.6, 'brn2/brn4', { size: 3 });
    g.limb([[1, 4], [49, 4]], 4, 4, 'brn2/brn4', { size: 3 });
    const cloth = g.poly([[9, 8], [41, 8], [41, 48], [9, 48]], 'crm4', { size: 16 });
    g.hatch(cloth, 'crm2', 10, (i) => [[10 + i * 3.2, 8], [10 + i * 3.2, 48]], 1, 2);
    for (const y of [16, 30, 42]) { g.line([[9, y], [41, y]], 2, 'red3', {}); for (let x = 11; x < 41; x += 4) g.line([[x, y - 1.6], [x, y + 1.6], [x + 2, y + 1.6]], 0.6, 'ink1', {}); }
    for (let x = 11; x <= 39; x += 2.6) g.line([[x, 48], [x, 64]], 1, 'crm3', { px: true });
    for (let x = 12; x <= 38; x += 5) g.ell(x, 67, 2.4, 3, 'brn3');
  }, { dither: 0.2 });
  A.paint('table', 60, 22, px(10), (g) => {
    for (const x of [6, 52]) g.limb([[x, 9], [x, 22]], 3.2, 3, 'brn2/brn4', { size: 3 });
    g.poly([[1, 8], [59, 8], [59, 11], [1, 11]], 'brn3/brn5', { size: 4 });
    g.ell(16, 6, 8, 3.6, 'cla4/cla5'); g.line([[11, 5], [20, 4.5]], 1, 'cla2', { px: true });       // ψωμί
    g.blob([[30, 1], [37, 1], [36, 7], [31, 7]], 'cla3', { size: 4 }); g.line([[30, 2.5], [37, 2.5]], 1, 'ink1', { px: true });   // κύπελλο
    for (const [x, y] of [[44, 5], [46, 3.4], [48, 5], [45.5, 6.5], [47.5, 6.6], [50, 6]]) g.dot(x, y, 1.4, 'mar4');                // σταφύλια
    g.ell(54, 6, 3, 2.4, 'red4');                                                                                                     // ρόδι
  }, { dither: 0.2 });
  A.paint('bed', 70, 22, px(8), (g) => {
    for (const x of [3, 67]) g.limb([[x, 12], [x, 22]], 3, 3, 'brn2/brn4', { size: 3 });
    g.limb([[3, 2], [3, 14]], 3.4, 3.4, 'brn2/brn4', { size: 3 });
    g.poly([[2, 12], [68, 12], [68, 16], [2, 16]], 'brn2/brn4', { size: 4 });
    g.blob([[4, 12], [6, 7], [66, 7], [68, 12]], 'crm4', { size: 6 });
    g.blob([[30, 13], [32, 6], [66, 6], [68, 13]], 'red3/red4', { size: 6 });
    g.hatch(g.path([[30, 13], [32, 6], [66, 6], [68, 13]]), 'red2', 5, (i) => [[36 + i * 7, 6], [35 + i * 7, 13]], 1, 2);
    g.ell(12, 6, 7, 3.2, 'crm4/crm5');
  }, { dither: 0.2 });
  // Ρούχα που στεγνώνουν στο σκοινί.
  A.paint('laundry', 90, 66, px(24), (g) => {
    g.limb([[3, 0], [3, 66]], 3, 3, 'brn2/brn4', { size: 3 }); g.limb([[87, 0], [87, 66]], 3, 3, 'brn2/brn4', { size: 3 });
    g.line([[3, 6], [45, 10], [87, 6]], 1, 'brn1', { px: true });
    const c1 = g.poly([[10, 7], [28, 8.5], [30, 38], [8, 36]], 'crm4', { size: 14 }); g.hatch(c1, 'crm2', 4, (i) => [[13 + i * 4, 8], [12 + i * 4, 36]], 1, 2);
    g.line([[8, 33], [30, 35]], 2, 'red3', {});
    g.poly([[36, 9.5], [52, 9.8], [52, 28], [36, 29]], 'red3/red4', { size: 10 });
    const c3 = g.poly([[58, 9], [80, 7.5], [82, 44], [56, 42]], 'cla4', { size: 16 }); g.hatch(c3, 'cla2', 5, (i) => [[60 + i * 4.5, 9], [59 + i * 4.5, 42]], 1, 3);
  }, { dither: 0.2 });
  // Το πηγάδι: πέτρινο στόμιο, ξύλινο πλαίσιο, σχοινί και κουβάς. f = 1: ο κουβάς ανεβασμένος (γεμάτος).
  A.paint('well', 50, 56, px(13), (g, f) => {
    g.limb([[6, 4], [6, 34]], 3.6, 3.6, 'brn2/brn4', { size: 3 }); g.limb([[44, 4], [44, 34]], 3.6, 3.6, 'brn2/brn4', { size: 3 });
    g.limb([[3, 5], [47, 5]], 4, 4, 'brn2/brn4', { size: 3 });
    g.ell(25, 5, 4, 4, 'brn3');
    const by = f ? 14 : 26;
    g.line([[25, 6], [25, by]], 1, 'brn4', { px: true });
    g.blob([[21, by], [29, by], [28, by + 7], [22, by + 7]], 'brn2/brn4', { size: 5 });
    g.line([[21, by + 2.5], [29, by + 2.5]], 1, 'ink2', { px: true });
    if (f) g.ell(25, by + 0.6, 3.4, 1, 'crm4', { flat: true });
    const rim = g.blob([[2, 34], [48, 34], [48, 56], [2, 56]], 'brn3/brn5', { size: 20 });
    g.inside(rim, () => { for (let y = 36; y < 56; y += 5) for (let x = ((y / 5) % 2) * 5 - 2; x < 50; x += 10) g.poly([[x, y], [x + 9, y], [x + 9, y + 4.2], [x, y + 4.2]], 'brn3/brn5', { size: 4 }); });
    g.ell(25, 34, 23, 3.4, 'brn4');
    g.ell(25, 34, 19, 2.2, 'ink0', { flat: true });
  }, { frames: 2, dither: 0.2 });
  // Η πεσμένη Ευρυδίκη (το φίδι την τσίμπησε): ξαπλωμένη στο χορτάρι, τα μαλλιά απλωμένα.
  A.paint('euryLying', 100, 24, px(5, 30) * 1.3, (g) => {
    g.blob([[74, 14], [84, 8], [96, 10], [99, 18], [92, 22], [78, 21]], 'mar4', { size: 10 });   // μαλλιά
    g.blob([[10, 17], [16, 13], [40, 12], [62, 11], [76, 13], [76, 20], [56, 22], [30, 22], [12, 21]], 'crm4', { size: 10 });
    g.hatch(g.path([[10, 17], [16, 13], [40, 12], [62, 11], [76, 13], [76, 20], [56, 22], [30, 22], [12, 21]]), 'crm2', 6, (i) => [[16 + i * 8, 13], [14 + i * 8, 22]], 1, 2);
    g.line([[12, 19], [74, 18]], 1.6, 'red3', {});
    g.blob([[2, 16], [10, 15], [11, 19], [2, 19]], 'skn3', { size: 3 });
    g.ell(84, 13, 6.5, 5, 'skn3');
    g.line([[86, 12], [88.5, 12]], 1, 'ink1', { px: true });
    g.limb([[66, 13], [58, 11], [50, 13]], [3.4, 3, 2.6], 0, 'skn3', { size: 3 });
    for (const [x, y] of [[80, 8], [84, 7], [88, 8]]) g.dot(x, y, 1.1, 'crm5');
  }, { dither: 0.2 });
  // Χορτάρι (κάτω από το φίδι).
  A.paint('grass', 40, 12, 16, (g) => {
    for (let i = 0; i < 16; i++) g.limb([[1 + i * 2.5, 12], [2 + i * 2.5 + (i % 3) - 1, 3 + (i % 4) * 1.5]], 1.4, 0.3, i % 2 ? 'brn4' : 'brn3', { size: 1, cap: false });
  }, { dither: 0.1 });

  // ---- Σπηλιές και Κάτω Κόσμος ----
  // Σταλαγμίτης / σταλακτίτης: κώνος με νερένιες ραβδώσεις και δαχτυλίδια.
  const cone = (g, down) => {
    const pts = [[12, 0, 1], [14, 10], [17, 24], [21, 38], [24, 50], [0, 50], [3, 38], [7, 24], [10, 10]];
    const P2 = down ? pts.map(([x, y, q]) => [x, 50 - y, q]) : pts;
    const p = g.blob(P2, 'mar2/mar4', { size: 14 });
    g.hatch(p, 'mar1', 5, (i) => [[5 + i * 3.6, down ? 0 : 50], [12 + (i - 2) * 0.6, down ? 46 : 4]], 1, 3);
    g.hatch(p, 'mar4', 4, (i) => [[4, (down ? 50 - (12 + i * 9) : 12 + i * 9)], [20, (down ? 50 - (14 + i * 9) : 14 + i * 9)]], 1, 5);
    if (down) g.dot(12, 49, 0.9, 'crm4');
  };
  A.paint('stalagmite', 24, 50, px(15), (g) => cone(g, false), { dither: 0.25 });
  A.paint('stalactite', 24, 50, px(13), (g) => cone(g, true), { dither: 0.25 });
  A.paint('rocks', 40, 16, px(4, 22), (g) => { artRock(g, 12, 10, 10, 6, 'mar3', 1); artRock(g, 28, 11, 9, 5, 'mar2', 2); artRock(g, 21, 13, 6, 3, 'mar3', 3); }, { dither: 0.2 });
  A.paint('bones', 40, 12, px(2.5, 18), (g) => {
    const bone = (x0, y0, x1, y1) => { g.limb([[x0, y0], [x1, y1]], 1.8, 1.8, 'crm3', { size: 2 }); for (const [x, y] of [[x0, y0], [x1, y1]]) { g.dot(x - 0.8, y, 1.4, 'crm3'); g.dot(x + 0.8, y + 0.6, 1.4, 'crm3'); } };
    bone(4, 9, 22, 6); bone(16, 11, 34, 9.5); bone(26, 5, 36, 3);
  }, { dither: 0.1 });
  const skull = (g, x, y, k = 1, t = 'crm3') => {
    g.blob([[x - 6 * k, y + 1 * k], [x - 5.5 * k, y - 5 * k], [x, y - 7.5 * k], [x + 5.5 * k, y - 5 * k], [x + 6 * k, y + 1 * k], [x + 3.6 * k, y + 4 * k], [x + 3.4 * k, y + 7 * k], [x - 3.4 * k, y + 7 * k], [x - 3.6 * k, y + 4 * k]], t, { size: 10 * k });
    g.ell(x - 2.4 * k, y + 0.2 * k, 1.8 * k, 2 * k, 'ink0', { flat: true }); g.ell(x + 2.4 * k, y + 0.2 * k, 1.8 * k, 2 * k, 'ink0', { flat: true });
    g.poly([[x - 0.8 * k, y + 2.6 * k], [x + 0.8 * k, y + 2.6 * k], [x, y + 4 * k]], 'ink0', { flat: true });
    for (let i = -2; i <= 2; i++) g.line([[x + i * 1.2 * k, y + 5 * k], [x + i * 1.2 * k, y + 7 * k]], 0.5, 'ink1', {});
  };
  A.paint('skull', 16, 16, px(3, 18), (g) => skull(g, 8, 8, 1), { dither: 0.1 });
  A.paint('skullpile', 44, 28, px(7, 28), (g) => {
    for (const [x, y, k] of [[8, 20, 0.9], [20, 21, 1], [33, 20, 0.95], [14, 12, 0.85], [27, 12, 0.9], [21, 5, 0.8]]) skull(g, x, y, k, k > 0.9 ? 'crm3' : 'crm2');
  }, { dither: 0.15 });
  A.paint('reeds', 40, 70, px(20), (g) => {
    for (let i = 0; i < 13; i++) {
      const x = 3 + i * 2.8, h = 12 + ((i * 37) % 23);
      g.limb([[x, 70], [x + ((i % 3) - 1) * 3, h]], 1.6, 0.5, i % 2 ? 'brn4' : 'brn3', { size: 1, cap: false });
      if (i % 3 === 0) g.ell(x + ((i % 3) - 1) * 3, h + 3, 1.4, 4, 'brn2');
    }
  }, { dither: 0.1 });
  A.paint('roots', 50, 90, px(26), (g) => {
    const rnd = ArtPainter.rng(4);
    for (let i = 0; i < 9; i++) {
      const x = 4 + i * 5.2, end = 40 + rnd() * 48;
      g.limb([[x, 0], [x + (rnd() - 0.5) * 10, end * 0.5], [x + (rnd() - 0.5) * 14, end]], 3.6 - i * 0.15, 0.4, 'brn2/brn4', { size: 3 });
    }
  }, { dither: 0.15 });
  A.paint('chain', 10, 100, px(48), (g) => {
    for (let y = 2; y < 100; y += 7) {
      if ((y / 7) % 2 < 1) g.ell(5, y + 3, 2.4, 4, 'brn2/brn4', { size: 3 }); else g.limb([[5, y], [5, y + 6]], 1.6, 1.6, 'brn1/brn3', { size: 2 });
      g.ell(5, y + 3, 1, 2.2, 'ink0', { flat: true });
    }
  }, { dither: 0.1 });

  // ---- Αντικείμενα ----
  // Κιβώτιο: ξύλο με χάλκινες λωρίδες. f = 1: ανοιχτό.
  A.paint('chest', 44, 34, px(8, 30), (g, f) => {
    const box = g.poly([[2, 14], [42, 14], [40, 34], [4, 34]], 'brn2/brn4', { size: 16 });
    g.hatch(box, 'brn1', 3, (i) => [[2, 20 + i * 5], [42, 20 + i * 5]], 1, 2);
    for (const x of [7, 37]) g.poly([[x - 2, 14], [x + 2, 14], [x + 2, 34], [x - 2, 34]], 'gld1/gld3', { size: 3 });
    if (f) {
      g.poly([[4, 14], [40, 14], [38, 10], [6, 10]], 'ink0', { flat: true });
      g.poly([[4, 10], [40, 10], [36, 0], [8, 0]], 'brn2/brn4', { size: 8 });
      g.line([[8, 1], [36, 1]], 1.6, 'gld2', {});
    } else {
      g.blob([[1, 14], [3, 6], [22, 3], [41, 6], [43, 14]], 'brn2/brn4', { size: 10 });
      for (const x of [7, 37]) g.line([[x, 6], [x, 14]], 3, 'gld2', {});
      g.ell(22, 16, 2.6, 2.6, 'gld2/gld4'); g.px(22, 16.5, 'ink0', 1);
    }
  }, { frames: 2, dither: 0.2 });
  // Κρυψώνα: όρθια ανοιχτή πέτρινη σαρκοφάγος μέσα στον βράχο.
  A.paint('niche', 36, 70, px(26), (g) => {
    const s = g.poly([[3, 6], [33, 6], [35, 70], [1, 70]], 'brn2/brn4', { size: 20 });
    g.speckle(s, 'brn1', 60, 0.8, 9);
    g.blob([[8, 70], [8, 14], [12, 9], [24, 9], [28, 14], [28, 70]], 'ink0', { flat: true });
    g.ell(18, 6, 15, 4, 'brn3/brn5');
    for (const y of [24, 44]) g.line([[3, y], [7, y]], 1, 'brn1', { px: true });
  }, { dither: 0.2 });
  // Τα χάλκινα κάγκελα της Πύλης.
  A.paint('bars', 40, 80, px(44), (g) => {
    for (let x = 3; x < 40; x += 7) { g.limb([[x, 6], [x, 80]], 2.4, 2.4, 'gld1/gld3', { size: 2 }); g.poly([[x - 2, 6], [x, 0, 1], [x + 2, 6]], 'gld2/gld4', { size: 2 }); }
    for (const y of [12, 60]) g.poly([[0, y], [40, y], [40, y + 3], [0, y + 3]], 'gld1/gld3', { size: 3 });
  }, { dither: 0.15 });
  // Η πέτρα του Σίσυφου (κυλάει: f αλλάζει τις ρωγμές).
  A.paint('boulder', 60, 56, px(44), (g, f) => {
    const p = artRock(g, 30, 28, 29, 27, 'mar3', 20 + f * 5);
    g.speckle(p, 'mar5', 40, 0.9, 7 + f);
    for (let i = 0; i < 4; i++) { const a = f * 0.8 + i * 1.6; g.line([[30 + Math.cos(a) * 6, 28 + Math.sin(a) * 6], [30 + Math.cos(a + 0.3) * 20, 28 + Math.sin(a + 0.3) * 18]], 1, 'mar1', { px: true }); }
  }, { frames: 2, dither: 0.2 });
  // Πήλινη πινακίδα με χαραγμένα γράμματα.
  A.paint('tablet', 30, 22, px(6, 22), (g) => {
    g.poly([[2, 6], [28, 3], [29, 20], [3, 22]], 'cla3/cla4', { size: 12 });
    for (let y = 8; y < 19; y += 2.6) g.line([[6, y], [25, y - 0.8]], 0.7, 'cla1', {});
  }, { dither: 0.1 });
  A.paint('bell', 16, 16, px(3, 18), (g) => {
    g.limb([[8, 0], [8, 3]], 1.6, 1.6, 'brn2', { size: 1 });
    g.blob([[5, 3], [11, 3], [13, 12], [15, 14], [1, 14], [3, 12]], 'gld1/gld3', { size: 8 });
    g.dot(8, 15, 1.2, 'gld1');
  }, { dither: 0.1 });
  // Χάλκινος τρίποδας με λεκάνη (ο βωμός / το λυχνάρι του Ερμή, τα μαγκάλια).
  A.paint('tripod', 40, 40, px(14, 40), (g) => {
    for (const [x0, x1] of [[10, 3], [20, 20], [30, 37]]) g.limb([[x0, 12], [x1, 40]], 2.2, 1.6, 'gld1/gld3', { size: 2 });
    g.line([[8, 24], [32, 24]], 1, 'gld1', { px: true });
    g.blob([[2, 4], [38, 4], [33, 13], [7, 13]], 'gld1/gld3', { size: 10 });
    g.ell(20, 4, 18, 2.4, 'ink1/gld1');
    for (let x = 6; x < 34; x += 4) g.line([[x, 7], [x, 10], [x + 2, 10]], 0.7, 'ink1', {});
  }, { dither: 0.15 });
  // Ο οβολός: χάλκινο νόμισμα με κουκουβάγια.
  A.paint('obol', 16, 16, px(3, 16), (g) => {
    g.ell(8, 8, 7, 7, 'gld2/gld4', { size: 10 });
    g.ell(8, 8, 5, 5, 'gld3', { flat: true });
    g.ell(8, 8.5, 2.4, 3, 'gld1'); g.px(7.2, 7.6, 'gld5', 1); g.px(8.8, 7.6, 'gld5', 1);
  }, { dither: 0.1 });
  // Η χορδή της λύρας: τυλιγμένη σε κουλούρα, λάμπει.
  A.paint('stringCoil', 16, 16, px(3.5, 16), (g) => {
    for (let k = 0; k < 3; k++) {
      const r = 6 - k * 2, pts = [];
      for (let i = 0; i <= 16; i++) pts.push([8 + Math.cos(i / 16 * Math.PI * 2) * r, 8 + Math.sin(i / 16 * Math.PI * 2) * r]);
      g.line(pts, 1.2, k ? 'crm4' : 'crm5', { px: true });
    }
    g.line([[8, 1.5], [12, 0]], 1, 'gld4', { px: true });
  }, { dither: 0, outline: null });
  A.paint('shard', 8, 6, 8, (g) => g.poly([[0, 6], [3, 0], [8, 2], [6, 6]], 'cla3', { size: 4 }), { dither: 0 });
});
