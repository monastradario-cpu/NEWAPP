/* Casa Mia — personalizzazione: stili, palette, finiture dei mobili, colori dalle immagini */
(function (root) {
  'use strict';
  const CM = root.CM;
  const P = CM.plan;

  /* ---------- Finiture ---------- */
  CM.FABRICS = [
    { id: 'liscio', label: 'Liscio', rough: 0.85, sheen: 0, pattern: null },
    { id: 'lino', label: 'Lino', rough: 0.95, sheen: 0, pattern: 'weave' },
    { id: 'velluto', label: 'Velluto', rough: 0.6, sheen: 1, pattern: null },
    { id: 'boucle', label: 'Bouclé', rough: 1, sheen: 0, pattern: 'boucle' },
    { id: 'pelle', label: 'Pelle', rough: 0.45, sheen: 0, pattern: null }
  ];
  CM.WOODS = [
    { id: 'rovere-chiaro', label: 'Rovere chiaro', color: '#D9C3A0' },
    { id: 'rovere', label: 'Rovere naturale', color: '#C49A6C' },
    { id: 'frassino-grigio', label: 'Frassino grigio', color: '#A9A39A' },
    { id: 'teak', label: 'Teak', color: '#A0703F' },
    { id: 'noce', label: 'Noce', color: '#6E4A32' },
    { id: 'wenge', label: 'Wengè', color: '#3E2E25' },
    { id: 'bianco', label: 'Laccato bianco', color: '#F1EFEA', plain: true },
    { id: 'nero', label: 'Laccato nero', color: '#2A2A2A', plain: true },
    { id: 'salvia', label: 'Laccato salvia', color: '#A9B8A1', plain: true }
  ];
  CM.METALS = [
    { id: 'nero', label: 'Nero opaco', color: '#26282B', metal: 0.4, rough: 0.6 },
    { id: 'ottone', label: 'Ottone', color: '#B9975B', metal: 0.9, rough: 0.35 },
    { id: 'cromo', label: 'Cromo', color: '#C9CCD0', metal: 1, rough: 0.2 },
    { id: 'bronzo', label: 'Bronzo', color: '#7A5C3E', metal: 0.85, rough: 0.45 },
    { id: 'bianco', label: 'Bianco', color: '#EDEDEA', metal: 0.2, rough: 0.5 }
  ];
  // Colori per tessuti e pareti (nomi descrittivi, nessun codice di marca inventato)
  CM.SWATCHES = [
    '#F4F3EF', '#EFE6D6', '#E3DED5', '#D6D4CF', '#C9C6C0', '#9AA0A6', '#5B6168', '#2B2E33',
    '#E8D9C5', '#D8C3A5', '#C9A27E', '#B07D5B', '#8B5E3C', '#6B4E37',
    '#E7C9B9', '#D9A38E', '#C98B6B', '#A65D45', '#8A3B2E',
    '#F0DFA8', '#E2C26B', '#C9A13B',
    '#D7E0CF', '#B8C4B0', '#8FA383', '#5E7A5A', '#3E5444',
    '#D3E1E6', '#A9C2CC', '#7C9DAE', '#3E5C7A', '#2F3E57',
    '#E3D7E4', '#B9A2BE', '#7E5F86', '#E9C8CF', '#C48E9B'
  ];

  /* ---------- Stili ---------- */
  // walls = pareti, accent = parete d'accento, floor = pavimento, wood/fabric/metal = mobili, warm = luce calda (0..1)
  CM.STYLES = [
    { id: 'scandinavo', label: 'Scandinavo', desc: 'Luce, legni chiari, bianco e tessuti naturali', walls: '#F2F0EB', accent: '#B8C4B0', floor: 'm-parquet-rovere', wood: 'rovere-chiaro', fabric: '#E3DED5', fabricType: 'lino', metal: 'nero', rug: '#D6D4CF', warm: 0.5 },
    { id: 'japandi', label: 'Japandi', desc: 'Calma giapponese e semplicità nordica: legno, beige, nero', walls: '#EDE7DD', accent: '#C9B79C', floor: 'm-parquet-rovere', wood: 'rovere', fabric: '#D8CDBD', fabricType: 'boucle', metal: 'nero', rug: '#C9BBA5', warm: 0.7 },
    { id: 'industriale', label: 'Industriale', desc: 'Cemento, metallo nero, legno scuro e pelle', walls: '#D6D4CF', accent: '#3A3F46', floor: 'm-gres-cemento', wood: 'noce', fabric: '#8B5E3C', fabricType: 'pelle', metal: 'nero', rug: '#5B6168', warm: 0.8 },
    { id: 'moderno', label: 'Moderno', desc: 'Linee pulite, grigi caldi e un accento di colore', walls: '#EDEBE6', accent: '#3E4E66', floor: 'm-gres-marmo', wood: 'frassino-grigio', fabric: '#8C9AAE', fabricType: 'liscio', metal: 'cromo', rug: '#C9C6C0', warm: 0.4 },
    { id: 'classico', label: 'Classico', desc: 'Legni caldi, marmo e toni avorio', walls: '#EFE6D6', accent: '#8A6A4A', floor: 'm-parquet-rovere', wood: 'noce', fabric: '#C9B79C', fabricType: 'velluto', metal: 'ottone', rug: '#A65D45', warm: 0.8 },
    { id: 'mediterraneo', label: 'Mediterraneo', desc: 'Bianco calce, terracotta, blu e fibre naturali', walls: '#F6F2EA', accent: '#C98B6B', floor: 'm-gres-cemento', wood: 'rovere', fabric: '#3E5C7A', fabricType: 'lino', metal: 'bronzo', rug: '#E8D9C5', warm: 0.7 },
    { id: 'minimal', label: 'Minimal', desc: 'Pochi elementi, bianco e grigio, nessun decoro', walls: '#F4F3EF', accent: '#9AA0A6', floor: 'm-resina', wood: 'bianco', fabric: '#D6D4CF', fabricType: 'liscio', metal: 'cromo', rug: '#E3DED5', warm: 0.3 },
    { id: 'boho', label: 'Boho', desc: 'Colori terra, rattan, piante e tessuti morbidi', walls: '#EFE2D0', accent: '#C98B6B', floor: 'm-laminato', wood: 'teak', fabric: '#D9A38E', fabricType: 'boucle', metal: 'ottone', rug: '#B07D5B', warm: 0.9 },
    { id: 'contemporaneo-scuro', label: 'Elegante scuro', desc: 'Pareti profonde, velluti e ottone', walls: '#2F3E57', accent: '#3E5444', floor: 'm-parquet-rovere', wood: 'noce', fabric: '#5E7A5A', fabricType: 'velluto', metal: 'ottone', rug: '#2B2E33', warm: 0.9 },
    { id: 'country', label: 'Country', desc: 'Legno vissuto, panna, verde salvia e quadretti', walls: '#F0E9DA', accent: '#8FA383', floor: 'm-gres-legno', wood: 'rovere', fabric: '#EFE6D6', fabricType: 'lino', metal: 'bronzo', rug: '#8FA383', warm: 0.8 }
  ];

  const S = CM.style = {};
  S.wood = (id) => CM.WOODS.find(w => w.id === id) || null;
  S.metal = (id) => CM.METALS.find(w => w.id === id) || null;
  S.fabric = (id) => CM.FABRICS.find(w => w.id === id) || CM.FABRICS[0];
  S.byId = (id) => CM.STYLES.find(s => s.id === id) || (CM.store && (CM.store.getJSON('stili', []).find(s => s.id === id))) || null;
  S.all = () => CM.STYLES.concat(CM.store ? CM.store.getJSON('stili', []) : []);
  S.saveCustom = (st) => { const list = CM.store.getJSON('stili', []).filter(x => x.id !== st.id); list.push(st); CM.store.putJSON('stili', list); };

  // Pittura come materiale riutilizzabile (per calcolo litri e costi)
  S.paintMat = function (color, name) {
    const id = 'm-colore-' + color.replace('#', '').toLowerCase();
    if (!CM.lib.material(id)) CM.lib.saveMaterial({ id, type: 'pittura', cat: 'pitture', name: name || ('Idropittura ' + color.toUpperCase()), color, code: '', resa: 10, canL: 5, price: 10 });
    return id;
  };

  // Che tipo di finitura usa un mobile
  S.kind = (f) => CM.SHAPE_FINISH[f.shape] || null;

  // Applica uno stile a una stanza (pareti, pavimento, mobili)
  S.applyToRoom = function (plan, rid, st, opts) {
    opts = opts || {};
    const r = plan.rooms[rid];
    if (!r) return;
    r.finish = r.finish || {};
    const out = CM.roomType(r.type).outdoor;
    if (!out) {
      r.finish.paint = Object.assign({ coats: 2 }, r.finish.paint, { mat: S.paintMat(st.walls, 'Pittura ' + st.label.toLowerCase()) });
      if (opts.accent !== false && st.accent && ['soggiorno', 'camera', 'studio', 'cameretta'].includes(r.type)) {
        // parete d'accento: la più lunga senza finestre
        const ws = P.roomWalls(plan, r).filter(id => !Object.values(plan.openings).some(o => o.wall === id));
        ws.sort((a, b) => P.wallLen(plan, b) - P.wallLen(plan, a));
        if (ws[0]) r.finish.accent = { walls: [ws[0]], color: st.accent };
      } else delete r.finish.accent;
      if (!['bagno', 'lavanderia'].includes(r.type) && st.floor && CM.lib.material(st.floor)) r.finish.floor = Object.assign({ pose: 'dritta' }, r.finish.floor, { mat: st.floor });
    }
    for (const fid in plan.furniture) {
      const f = plan.furniture[fid];
      if (P.roomOf(plan, f) !== rid) continue;
      S.applyToFurniture(f, st);
    }
    r.style = st.id;
    r.mood = st.warm;
  };
  S.applyToFurniture = function (f, st) {
    const k = S.kind(f);
    if (k === 'fabric') { f.color = f.shape === 'rug' ? (st.rug || st.fabric) : st.fabric; if (f.shape !== 'rug' && f.shape !== 'curtain') f.fabric = st.fabricType; }
    else if (k === 'wood') { const w = S.wood(st.wood); if (w) { f.wood = w.id; f.color = w.color; } }
    if (st.metal) f.metal = st.metal;
    if (k === 'fabric' && st.wood) f.wood = st.wood;
  };
  S.applyToHouse = function (plan, st) {
    for (const rid in plan.rooms) S.applyToRoom(plan, rid, st);
  };

  /* ---------- Colori da un'immagine (bacheca idee) ---------- */
  const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  S.rgb = (h) => { const v = parseInt(String(h).replace('#', ''), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  S.lum = (h) => { const [r, g, b] = S.rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  S.dist = (a, b) => { const x = S.rgb(a), y = S.rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };

  S.paletteFromImage = function (src, k) {
    k = k || 6;
    return new Promise((resolve) => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas'); const n = 64;
        const sc = n / Math.max(im.naturalWidth, im.naturalHeight);
        c.width = Math.max(1, Math.round(im.naturalWidth * sc)); c.height = Math.max(1, Math.round(im.naturalHeight * sc));
        const ctx = c.getContext('2d'); ctx.drawImage(im, 0, 0, c.width, c.height);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        const px = [];
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) px.push([d[i], d[i + 1], d[i + 2]]);
        if (!px.length) return resolve([]);
        // k-means semplice
        let cent = [];
        for (let i = 0; i < k; i++) cent.push(px[Math.floor((i + 0.5) * px.length / k)].slice());
        const as = new Array(px.length).fill(0);
        for (let it = 0; it < 10; it++) {
          for (let i = 0; i < px.length; i++) { let best = 0, bd = Infinity; for (let j = 0; j < k; j++) { const dd = (px[i][0] - cent[j][0]) ** 2 + (px[i][1] - cent[j][1]) ** 2 + (px[i][2] - cent[j][2]) ** 2; if (dd < bd) { bd = dd; best = j; } } as[i] = best; }
          const sum = cent.map(() => [0, 0, 0, 0]);
          for (let i = 0; i < px.length; i++) { const s = sum[as[i]]; s[0] += px[i][0]; s[1] += px[i][1]; s[2] += px[i][2]; s[3]++; }
          cent = sum.map((s, j) => s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : cent[j]);
        }
        const cnt = new Array(k).fill(0); as.forEach(a => cnt[a]++);
        const out = cent.map((c2, j) => ({ color: hex(c2[0], c2[1], c2[2]), share: cnt[j] / px.length })).filter(x => x.share > 0.02).sort((a, b) => b.share - a.share);
        resolve(out);
      };
      im.onerror = () => resolve([]);
      im.src = src;
    });
  };

  // Da una palette ricavo uno stile su misura (chiaro alle pareti, medio ai tessuti, scuro/saturo all'accento)
  S.styleFromPalette = function (colors, name) {
    const cs = colors.map(c => c.color || c);
    const byLum = cs.slice().sort((a, b) => S.lum(b) - S.lum(a));
    const sat = (h) => { const [r, g, b] = S.rgb(h); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };
    const walls = byLum[0] || '#F4F3EF';
    const accent = cs.slice().sort((a, b) => sat(b) - sat(a))[0] || byLum[byLum.length - 1];
    const fabric = byLum[Math.min(1, byLum.length - 1)] || walls;
    const dark = byLum[byLum.length - 1];
    // legno: il più vicino tra quelli disponibili
    const woodC = cs.find(c => { const [r, g, b] = S.rgb(c); return r > g && g > b && S.lum(c) < 0.75 && S.lum(c) > 0.2; }) || '#C49A6C';
    const wood = CM.WOODS.slice().sort((a, b) => S.dist(a.color, woodC) - S.dist(b.color, woodC))[0].id;
    const nearest = S.all().slice().sort((a, b) => (S.dist(a.walls, walls) + S.dist(a.fabric, fabric)) - (S.dist(b.walls, walls) + S.dist(b.fabric, fabric)))[0];
    return {
      id: 'su-misura-' + Date.now().toString(36), label: name || 'Su misura', desc: 'Ricavato dalle tue immagini' + (nearest ? ' · somiglia a ' + nearest.label : ''),
      walls, accent, floor: nearest ? nearest.floor : 'm-parquet-rovere', wood, fabric, fabricType: nearest ? nearest.fabricType : 'liscio',
      metal: S.lum(dark) < 0.25 ? 'nero' : (nearest ? nearest.metal : 'nero'), rug: dark, warm: nearest ? nearest.warm : 0.6, custom: true
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
