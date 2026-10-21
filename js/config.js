/* Casa Mia — composizioni componibili: armadi PAX, cucine METOD, soggiorno BESTÅ, bagno ENHET/GODMORGON e altri negozi.
   Una composizione è un mobile (shape 'composite') fatto di moduli affiancati, con frontali, maniglie, top e zoccolo. */
(function (root) {
  'use strict';
  const CM = root.CM;
  const U = () => CM.ui;
  const el = (...a) => CM.ui.el(...a);
  const CF = CM.config = {};

  // Misure dei sistemi (cm → m) e prezzi indicativi, da correggere con il prezzo vero (o importando dal sito)
  CF.SYSTEMS = {
    pax: {
      label: 'Armadio PAX (IKEA)', short: 'PAX', cat: 'camera', depth: [0.58, 0.35], height: [2.36, 2.01],
      modules: [
        { kind: 'ante', label: 'Anta battente', widths: [0.5], price: 120 },
        { kind: 'ante2', label: 'Due ante', widths: [1.0], price: 190 },
        { kind: 'ante', label: 'Anta 75', widths: [0.75], price: 140 },
        { kind: 'cassetti', label: 'Cassetti + anta', widths: [0.5, 0.75, 1.0], price: 210 },
        { kind: 'aperto', label: 'A giorno (ripiani)', widths: [0.5, 0.75, 1.0], price: 90 },
        { kind: 'specchio', label: 'Anta a specchio', widths: [0.5], price: 160 },
        { kind: 'scorrevole', label: 'Ante scorrevoli', widths: [1.5, 2.0], price: 360 }
      ],
      fronts: ['Bianco', 'Rovere sbiancato', 'Grigio-beige', 'Nero-marrone', 'Verde salvia'],
      frontColors: ['#F1EFEA', '#E3D6C1', '#B9AFA2', '#3E332D', '#A9B8A1']
    },
    metod: {
      label: 'Cucina METOD (IKEA)', short: 'METOD', cat: 'cucina', kitchen: true,
      modules: [
        { kind: 'base', label: 'Base con anta', widths: [0.4, 0.6], price: 110 },
        { kind: 'cassetti', label: 'Base cassetti', widths: [0.4, 0.6, 0.8], price: 220 },
        { kind: 'lavello', label: 'Base lavello', widths: [0.6, 0.8], price: 170 },
        { kind: 'cottura', label: 'Base piano cottura', widths: [0.6, 0.8], price: 190 },
        { kind: 'forno', label: 'Base forno', widths: [0.6], price: 140 },
        { kind: 'lavastoviglie', label: 'Lavastoviglie integrata', widths: [0.6], price: 60 },
        { kind: 'angolo', label: 'Base angolo', widths: [1.28], price: 260 },
        { kind: 'colonna', label: 'Colonna dispensa', widths: [0.4, 0.6], h: 2.2, price: 320 },
        { kind: 'colonnaFrigo', label: 'Colonna frigo', widths: [0.6], h: 2.2, price: 290 },
        { kind: 'colonnaForno', label: 'Colonna forno + micro', widths: [0.6], h: 2.2, price: 330 },
        { kind: 'pensile', label: 'Pensile', widths: [0.4, 0.6, 0.8], wall: true, price: 90 },
        { kind: 'cappa', label: 'Pensile cappa', widths: [0.6], wall: true, price: 130 }
      ],
      fronts: ['Bianco lucido', 'Rovere', 'Grigio scuro', 'Verde', 'Nero opaco'],
      frontColors: ['#F4F3F0', '#C9A57E', '#5B6168', '#8FA383', '#2B2E33']
    },
    besta: {
      label: 'Soggiorno BESTÅ (IKEA)', short: 'BESTÅ', cat: 'soggiorno', depth: [0.42, 0.22], height: [0.64, 0.38, 1.28, 1.92],
      modules: [
        { kind: 'ante', label: 'Con anta', widths: [0.6], price: 75 },
        { kind: 'cassetti', label: 'Con cassetti', widths: [0.6], price: 110 },
        { kind: 'aperto', label: 'A giorno', widths: [0.6], price: 50 },
        { kind: 'vetro', label: 'Anta in vetro', widths: [0.6], price: 95 }
      ],
      fronts: ['Bianco', 'Rovere', 'Nero-marrone', 'Grigio-beige'],
      frontColors: ['#F1EFEA', '#D2B48C', '#3E332D', '#B9AFA2']
    },
    bagno: {
      label: 'Bagno ENHET / GODMORGON (IKEA)', short: 'Bagno', cat: 'bagno', depth: [0.47], height: [0.58],
      modules: [
        { kind: 'lavabo', label: 'Mobile lavabo', widths: [0.6, 0.8, 1.0, 1.2], price: 260 },
        { kind: 'cassetti', label: 'Mobile cassetti', widths: [0.4, 0.6], price: 150 },
        { kind: 'colonna', label: 'Colonna', widths: [0.4], h: 1.92, d: 0.32, price: 160 },
        { kind: 'specchio', label: 'Specchio contenitore', widths: [0.6, 0.8, 1.0], wall: true, price: 140 }
      ],
      fronts: ['Bianco', 'Rovere', 'Grigio', 'Antracite'],
      frontColors: ['#F4F3F0', '#C9A57E', '#A9A7A2', '#3A3F46']
    },
    generico: {
      label: 'Componibile di altri negozi', short: 'Componibile', cat: 'altro', depth: [0.6, 0.58, 0.45, 0.35], height: [2.4, 2.2, 2.0, 0.9],
      modules: [
        { kind: 'ante', label: 'Con ante', widths: [0.45, 0.5, 0.6, 0.9, 1.0], price: 120 },
        { kind: 'cassetti', label: 'Cassetti', widths: [0.45, 0.6, 0.9], price: 160 },
        { kind: 'aperto', label: 'A giorno', widths: [0.45, 0.6, 0.9], price: 70 },
        { kind: 'base', label: 'Base cucina', widths: [0.45, 0.6, 0.9], price: 110 },
        { kind: 'pensile', label: 'Pensile', widths: [0.45, 0.6, 0.9], wall: true, price: 80 },
        { kind: 'colonna', label: 'Colonna', widths: [0.45, 0.6], h: 2.2, price: 250 }
      ],
      fronts: ['Bianco', 'Legno chiaro', 'Legno scuro', 'Grigio', 'Colore'],
      frontColors: ['#F1EFEA', '#D2B48C', '#6E4A32', '#9AA0A6', '#7C9DAE']
    }
  };
  const KITCHEN_H = { base: 0.88, top: 0.04, plinth: 0.1, wallBottom: 1.45, wallH: 0.8, wallD: 0.37, d: 0.6 };

  CF.KITCHEN_H = KITCHEN_H;
  CF.moduleDef = (sys, kind) => CF.SYSTEMS[sys].modules.find(m => m.kind === kind) || CF.SYSTEMS[sys].modules[0];

  // Misure complessive della composizione (le basi e le colonne vanno in fila, i pensili sopra)
  CF.measure = function (f) {
    const S = CF.SYSTEMS[f.system] || CF.SYSTEMS.generico;
    const floor = f.modules.filter(m => !m.wall);
    const wall = f.modules.filter(m => m.wall);
    const w = Math.max(floor.reduce((a, m) => a + m.w, 0), CF.wallStart(f) + wall.reduce((a, m) => a + m.w, 0), 0.3);
    let h = f.body && f.body.h || (S.height ? S.height[0] : KITCHEN_H.base);
    let d = f.body && f.body.d || (S.depth ? S.depth[0] : KITCHEN_H.d);
    if (S.kitchen) { h = Math.max(...f.modules.map(m => m.wall ? KITCHEN_H.wallBottom + KITCHEN_H.wallH : (m.h || KITCHEN_H.base))); d = KITCHEN_H.d + 0.02; }
    else h = Math.max(h, ...f.modules.map(m => (m.wall ? (f.mount || 0) + 1.5 + 0.7 : 0) + (m.h || 0)));
    return { w, d, h };
  };
  // i pensili partono dopo le colonne alte iniziali (frigo, dispensa)
  CF.wallStart = function (f) { let x = 0; for (const m of f.modules) { if (m.wall) continue; if (m.h && m.h > 1.2) x += m.w; else break; } return x; };
  CF.price = (f) => f.modules.reduce((a, m) => a + (m.price || 0), 0) + (f.worktop && f.worktop.price ? f.worktop.price : 0);
  CF.components = function (f) {
    const S = CF.SYSTEMS[f.system] || CF.SYSTEMS.generico;
    const map = new Map();
    for (const m of f.modules) { const k = (CF.moduleDef(f.system, m.kind).label) + ' ' + Math.round(m.w * 100) + ' cm'; const c = map.get(k) || { name: k, qty: 0, price: m.price || 0 }; c.qty++; map.set(k, c); }
    const out = [...map.values()];
    if (S.kitchen) out.push({ name: 'Piano di lavoro ' + Math.round(CF.measure(f).w * 100) + ' cm', qty: 1, price: f.worktop && f.worktop.price || 0 });
    return out;
  };
  CF.refresh = function (f) {
    const m = CF.measure(f);
    f.w = Math.round(m.w * 1000) / 1000; f.d = Math.round(m.d * 1000) / 1000; f.h = Math.round(m.h * 1000) / 1000;
    f.price = Math.round(CF.price(f));
    f.components = CF.components(f);
    return f;
  };
  CF.create = function (sys) {
    const S = CF.SYSTEMS[sys];
    const f = { shape: 'composite', system: sys, name: S.short, cat: S.cat, modules: [], front: { color: S.frontColors[0], name: S.fronts[0], style: 'liscio' }, handle: 'maniglia', color: S.frontColors[0] };
    if (S.kitchen) {
      f.worktop = { color: '#7D7A75', name: 'Laminato grigio', price: 150 };
      ['colonnaFrigo', 'base', 'lavastoviglie', 'lavello', 'cassetti', 'cottura', 'base'].forEach(k => f.modules.push(mod(sys, k)));
      // pensili allineati alle basi (la cappa sopra il piano cottura)
      f.modules.filter(m => !m.wall && !(m.h > 1.2)).forEach(m => f.modules.push(mod(sys, m.kind === 'cottura' ? 'cappa' : 'pensile', m.kind === 'cottura' ? 0.6 : m.w)));
      // la cappa \u00e8 larga 60: se il piano cottura \u00e8 80 aggiungo un pensile da 20 di compensazione
      const cot = f.modules.find(m => m.kind === 'cottura'); if (cot && cot.w > 0.6) { const i = f.modules.findIndex(m => m.kind === 'cappa'); f.modules.splice(i + 1, 0, Object.assign(mod(sys, 'pensile'), { w: Math.round((cot.w - 0.6) * 100) / 100 })); }
    } else if (sys === 'pax') { f.body = { h: 2.36, d: 0.58 }; ['ante2', 'cassetti', 'ante2'].forEach(k => f.modules.push(mod(sys, k))); }
    else if (sys === 'besta') { f.body = { h: 0.38, d: 0.42 }; f.mount = 0; ['ante', 'aperto', 'ante'].forEach(k => f.modules.push(mod(sys, k))); }
    else if (sys === 'bagno') { f.body = { h: 0.58, d: 0.47 }; f.mount = 0.3; ['lavabo', 'specchio'].forEach(k => f.modules.push(mod(sys, k))); }
    else { f.body = { h: 2.2, d: 0.6 }; ['ante', 'cassetti', 'ante'].forEach(k => f.modules.push(mod(sys, k))); }
    return CF.refresh(f);
  };
  function mod(sys, kind, w) {
    const d = CF.moduleDef(sys, kind);
    return { id: CM.uid('m'), kind, w: w || d.widths[d.widths.length > 1 ? 1 : 0] || d.widths[0], h: d.h, d: d.d, wall: !!d.wall, price: d.price };
  }

  /* ---------- Disegno frontale (SVG) per il configuratore ---------- */
  CF.frontSvg = function (f, selId) {
    const S = CF.SYSTEMS[f.system] || CF.SYSTEMS.generico;
    const m = CF.measure(f);
    const W = 340, k = Math.min(W / Math.max(m.w, 0.5), 200 / Math.max(m.h, 0.5));
    const H = m.h * k + 16;
    const parts = [];
    const fc = (f.front && f.front.color) || '#F1EFEA';
    const rect = (x, y, w, h, fill, extra) => '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" fill="' + fill + '" stroke="#1B1E22" stroke-width="0.8" ' + (extra || '') + '/>';
    const y0 = H - 8; // pavimento
    let x = 6;
    const floor = f.modules.filter(q => !q.wall), wall = f.modules.filter(q => q.wall);
    const bodyH = (q) => S.kitchen ? (q.h || KITCHEN_H.base) : (q.h || (f.body && f.body.h) || m.h);
    for (const q of floor) {
      const w = q.w * k, h = bodyH(q) * k, top = y0 - h - (f.mount || 0) * k;
      parts.push('<g data-id="' + q.id + '">' + rect(x, top, w, h, fc, q.id === selId ? 'stroke="#1F4FD1" stroke-width="2.5"' : ''));
      parts.push(frontLines(q, x, top, w, h, S));
      parts.push('</g>');
      x += w;
    }
    if (S.kitchen) parts.push(rect(6, y0 - KITCHEN_H.base * k - KITCHEN_H.top * k, floor.reduce((a, q) => a + (q.h ? 0 : q.w), 0) * k + 0.001, KITCHEN_H.top * k, (f.worktop && f.worktop.color) || '#7D7A75'));
    x = 6 + CF.wallStart(f) * k;
    for (const q of wall) {
      const w = q.w * k, h = (S.kitchen ? KITCHEN_H.wallH : (q.h || 0.7)) * k;
      const top = y0 - (S.kitchen ? KITCHEN_H.wallBottom + KITCHEN_H.wallH : (f.mount || 0) + bodyH({}) + 0.25 + (q.h || 0.7)) * k;
      parts.push('<g data-id="' + q.id + '">' + rect(x, top, w, h, q.kind === 'specchio' ? '#D8E6EC' : fc, q.id === selId ? 'stroke="#1F4FD1" stroke-width="2.5"' : ''));
      parts.push(frontLines(q, x, top, w, h, S));
      parts.push('</g>');
      x += w;
    }
    parts.push('<line x1="0" y1="' + y0 + '" x2="' + (W + 12) + '" y2="' + y0 + '" stroke="#9AA0A6" stroke-width="1"/>');
    return '<svg viewBox="0 0 ' + (W + 12) + ' ' + H + '" width="100%" style="max-height:240px;touch-action:manipulation">' + parts.join('') + '</svg>';
  };
  function frontLines(q, x, y, w, h, S) {
    const L = [];
    const ln = (x1, y1, x2, y2) => L.push('<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#1B1E22" stroke-width="0.6"/>');
    const handle = (hx, hy, vert) => L.push('<rect x="' + (hx - (vert ? 1 : 6)).toFixed(1) + '" y="' + (hy - (vert ? 8 : 1)).toFixed(1) + '" width="' + (vert ? 2 : 12) + '" height="' + (vert ? 16 : 2) + '" fill="#3A3F46"/>');
    switch (q.kind) {
      case 'ante2': case 'scorrevole': ln(x + w / 2, y + 2, x + w / 2, y + h - 2); handle(x + w / 2 - 5, y + h / 2, true); handle(x + w / 2 + 5, y + h / 2, true); break;
      case 'cassetti': { const n = h > 120 ? 3 : 3; const top = h > 120 ? h * 0.55 : 0; if (top) { ln(x, y + top, x + w, y + top); handle(x + w - 8, y + top / 2, true); } for (let i = 1; i < n; i++) ln(x, y + top + (h - top) * i / n, x + w, y + top + (h - top) * i / n); for (let i = 0; i < n; i++) handle(x + w / 2, y + top + (h - top) * (i + 0.5) / n - 4, false); break; }
      case 'aperto': for (let i = 1; i < 5; i++) ln(x + 2, y + h * i / 5, x + w - 2, y + h * i / 5); break;
      case 'vetro': L.push('<rect x="' + (x + 6) + '" y="' + (y + 6) + '" width="' + (w - 12) + '" height="' + (h - 12) + '" fill="#D8E6EC" opacity="0.8"/>'); break;
      case 'forno': ln(x, y + h * 0.15, x + w, y + h * 0.15); L.push('<rect x="' + (x + 6) + '" y="' + (y + h * 0.25) + '" width="' + (w - 12) + '" height="' + (h * 0.45) + '" fill="#2B2E33"/>'); handle(x + w / 2, y + h * 0.2, false); break;
      case 'colonnaForno': L.push('<rect x="' + (x + 6) + '" y="' + (y + h * 0.35) + '" width="' + (w - 12) + '" height="' + (h * 0.2) + '" fill="#2B2E33"/><rect x="' + (x + 6) + '" y="' + (y + h * 0.58) + '" width="' + (w - 12) + '" height="' + (h * 0.12) + '" fill="#2B2E33"/>'); break;
      case 'colonnaFrigo': ln(x, y + h * 0.55, x + w, y + h * 0.55); handle(x + w - 6, y + h * 0.4, true); handle(x + w - 6, y + h * 0.7, true); break;
      case 'lavello': L.push('<rect x="' + (x + w * 0.2) + '" y="' + (y - 3) + '" width="' + (w * 0.6) + '" height="3" fill="#A9AEB3"/>'); ln(x + w / 2, y + 2, x + w / 2, y + h - 2); handle(x + w / 2 - 5, y + 10, true); handle(x + w / 2 + 5, y + 10, true); break;
      case 'cottura': L.push('<rect x="' + (x + 4) + '" y="' + (y - 3) + '" width="' + (w - 8) + '" height="3" fill="#2B2E33"/>'); for (let i = 1; i < 3; i++) ln(x, y + h * i / 3, x + w, y + h * i / 3); for (let i = 0; i < 3; i++) handle(x + w / 2, y + h * (i + 0.5) / 3 - 4, false); break;
      case 'lavastoviglie': handle(x + w / 2, y + 8, false); break;
      case 'specchio': ln(x + 4, y + 4, x + w - 4, y + h - 4); break;
      case 'lavabo': L.push('<rect x="' + (x + 4) + '" y="' + (y - 4) + '" width="' + (w - 8) + '" height="4" fill="#FFFFFF" stroke="#1B1E22" stroke-width="0.5"/>'); ln(x, y + h / 2, x + w, y + h / 2); handle(x + w / 2, y + h / 4 - 3, false); handle(x + w / 2, y + h * 0.75 - 3, false); break;
      default: handle(x + w - 7, y + Math.min(h / 2, 60), true);
    }
    return L.join('');
  }

  /* ---------- Configuratore ---------- */
  // f esistente (modifica) o nuova; onSave(f) riceve la composizione aggiornata
  CF.open = async function (f0, onSave) {
    let sys = f0 ? f0.system : null;
    if (!sys) {
      sys = await U().menu('Cosa vuoi comporre?', Object.keys(CF.SYSTEMS).map(k => ({ id: k, label: CF.SYSTEMS[k].label, icon: k === 'metod' ? 'arredo' : k === 'bagno' ? 'plug' : 'sofa' })));
      if (!sys) return;
    }
    const f = f0 ? CM.clone(f0) : CF.create(sys);
    const S = CF.SYSTEMS[sys];
    let sel = null;
    const box = el('div', { class: 'cfg' });
    const draw = () => {
      CF.refresh(f);
      box.innerHTML = '';
      const prev = el('div', { class: 'cfg-prev', html: CF.frontSvg(f, sel) });
      prev.addEventListener('click', (e) => { const g = e.target.closest('[data-id]'); sel = g ? g.getAttribute('data-id') : null; draw(); });
      box.appendChild(prev);
      box.appendChild(el('div', { class: 'cfg-sum', html: '<b>' + Math.round(f.w * 100) + ' × ' + Math.round(f.d * 100) + ' × ' + Math.round(f.h * 100) + ' cm</b> · ' + f.modules.length + ' moduli · circa <b>' + CM.fmt.eur(f.price) + '</b>' }));
      // modulo selezionato
      const q = f.modules.find(x => x.id === sel);
      if (q) {
        const d = CF.moduleDef(sys, q.kind);
        const idx = f.modules.indexOf(q);
        box.appendChild(el('div', { class: 'sec-title', text: 'Modulo selezionato: ' + d.label }));
        box.appendChild(el('div', { class: 'chips-row wrap' }, d.widths.map(w => el('button', { class: 'chip small' + (Math.abs(q.w - w) < 0.001 ? ' active' : ''), text: Math.round(w * 100) + ' cm', onclick: () => { q.w = w; draw(); } }))));
        box.appendChild(el('div', { class: 'chips-row wrap' }, S.modules.filter(x => !!x.wall === !!q.wall).map(x => el('button', { class: 'chip small' + (x.kind === q.kind ? ' active' : ''), text: x.label, onclick: () => { q.kind = x.kind; q.price = x.price; q.h = x.h; q.d = x.d; if (!x.widths.some(w => Math.abs(w - q.w) < 0.001)) q.w = x.widths[0]; draw(); } }))));
        box.appendChild(el('div', { class: 'actions', style: 'justify-content:flex-start' }, [
          el('button', { class: 'btn small', text: '◀ Sposta', onclick: () => { if (idx > 0) { f.modules.splice(idx, 1); f.modules.splice(idx - 1, 0, q); } draw(); } }),
          el('button', { class: 'btn small', text: 'Sposta ▶', onclick: () => { if (idx < f.modules.length - 1) { f.modules.splice(idx, 1); f.modules.splice(idx + 1, 0, q); } draw(); } }),
          el('button', { class: 'btn small', text: 'Duplica', onclick: () => { f.modules.splice(idx + 1, 0, Object.assign({}, q, { id: CM.uid('m') })); draw(); } }),
          el('button', { class: 'btn small danger', text: 'Togli', onclick: () => { f.modules.splice(idx, 1); sel = null; draw(); } })
        ]));
        const pr = U().numField('Prezzo del modulo', q.price || 0, '€', v => { q.price = v; draw(); }, { min: 0, max: 100000 });
        box.appendChild(el('div', { class: 'fields' }, [pr]));
      } else box.appendChild(el('p', { class: 'muted small', text: 'Tocca un modulo nel disegno per cambiarne larghezza, tipo, posizione o prezzo.' }));
      // aggiungi
      box.appendChild(el('div', { class: 'sec-title', text: 'Aggiungi un modulo' }));
      box.appendChild(el('div', { class: 'chips-row wrap' }, S.modules.map(x => el('button', { class: 'chip small', text: '+ ' + x.label, onclick: () => { const n = mod(sys, x.kind); f.modules.push(n); sel = n.id; draw(); } }))));
      // misure del corpo
      if (S.height && !S.kitchen) {
        box.appendChild(el('div', { class: 'sec-title', text: 'Altezza e profondità' }));
        box.appendChild(el('div', { class: 'chips-row wrap' }, S.height.map(h => el('button', { class: 'chip small' + (f.body && Math.abs(f.body.h - h) < 0.001 ? ' active' : ''), text: 'H ' + Math.round(h * 100), onclick: () => { f.body = Object.assign({}, f.body, { h }); draw(); } })).concat(S.depth.map(d => el('button', { class: 'chip small' + (f.body && Math.abs(f.body.d - d) < 0.001 ? ' active' : ''), text: 'P ' + Math.round(d * 100), onclick: () => { f.body = Object.assign({}, f.body, { d }); draw(); } })))));
      }
      // frontali e maniglie
      box.appendChild(el('div', { class: 'sec-title', text: 'Frontali' }));
      box.appendChild(el('div', { class: 'chips-row wrap' }, S.fronts.map((n, i) => el('button', { class: 'chip small' + (f.front.name === n ? ' active' : ''), html: '<span class="dot" style="background:' + S.frontColors[i] + ';border-radius:99px"></span>' + n, onclick: () => { f.front = Object.assign({}, f.front, { name: n, color: S.frontColors[i] }); f.color = S.frontColors[i]; draw(); } }))));
      box.appendChild(CM.personal.swatches(f.front.color, c => { f.front = Object.assign({}, f.front, { color: c, name: 'Personalizzato' }); f.color = c; draw(); }));
      box.appendChild(el('div', { class: 'chips-row wrap' }, [['liscio', 'Lisci'], ['telaio', 'Con cornice'], ['cannettato', 'Cannettati']].map(([k, l]) => el('button', { class: 'chip small' + (f.front.style === k ? ' active' : ''), text: l, onclick: () => { f.front.style = k; draw(); } }))));
      box.appendChild(el('div', { class: 'sec-title', text: 'Maniglie' }));
      box.appendChild(el('div', { class: 'chips-row wrap' }, [['maniglia', 'Maniglia'], ['pomolo', 'Pomolo'], ['gola', 'Senza (gola / push)']].map(([k, l]) => el('button', { class: 'chip small' + (f.handle === k ? ' active' : ''), text: l, onclick: () => { f.handle = k; draw(); } }))));
      box.appendChild(el('div', { class: 'chips-row wrap' }, CM.METALS.map(m => el('button', { class: 'chip small' + (f.metal === m.id ? ' active' : ''), html: '<span class="dot" style="background:' + m.color + ';border-radius:99px"></span>' + m.label, onclick: () => { f.metal = m.id; draw(); } }))));
      if (S.kitchen) {
        box.appendChild(el('div', { class: 'sec-title', text: 'Piano di lavoro' }));
        const tops = [['Laminato grigio', '#7D7A75', 150], ['Laminato rovere', '#B88A5C', 170], ['Quarzo bianco', '#ECEAE5', 900], ['Marmo', '#E6E2DC', 1400], ['Nero', '#2B2E33', 600]];
        box.appendChild(el('div', { class: 'chips-row wrap' }, tops.map(([n, c, p]) => el('button', { class: 'chip small' + (f.worktop.name === n ? ' active' : ''), html: '<span class="dot" style="background:' + c + ';border-radius:99px"></span>' + n, onclick: () => { f.worktop = { name: n, color: c, price: Math.round(p * f.w / 2.4) }; draw(); } }))));
      }
      // lista della spesa
      box.appendChild(el('div', { class: 'sec-title', text: 'Lista della spesa' }));
      box.appendChild(el('div', { class: 'card' }, f.components.map(c => el('div', { class: 'line' }, [el('span', { class: 'l-main', text: c.qty + ' × ' + c.name }), el('span', { class: 'l-num', text: c.price ? CM.fmt.eur(c.price * c.qty) : '' })]))));
      box.appendChild(el('p', { class: 'muted small', text: 'Prezzi indicativi: correggili toccando il modulo, oppure importa il tuo progetto dal sito del negozio per avere quelli veri.' }));
    };
    draw();
    const r = await U().dialog({ title: S.label, body: box, actions: [{ label: 'Annulla', value: null }, { label: 'Importa dal sito', value: 'import' }, { label: f0 ? 'Salva' : 'Metti in pianta', value: 'ok', primary: true }] });
    if (r === 'import') { CF.importHelp(sys); return; }
    if (r !== 'ok') return;
    CF.refresh(f);
    f.name = f.name || S.short;
    onSave && onSave(f);
  };

  CF.importHelp = async function (sys) {
    const S = CF.SYSTEMS[sys];
    const urls = { pax: 'https://www.ikea.com/it/it/planner/pax-planner/', metod: 'https://www.ikea.com/it/it/planner/metod-planner/', besta: 'https://www.ikea.com/it/it/planner/besta-planner/', bagno: 'https://www.ikea.com/it/it/planner/', generico: '' };
    const ok = await U().dialog({ title: 'Importa il progetto ' + S.short, text: 'Si apre il sito qui dentro: accedi al tuo account, apri il progetto salvato e vai al riepilogo (la lista dei prodotti). Poi tocca “Importa”: leggo i pezzi con codici, misure e prezzi e creo la composizione, che puoi continuare a modificare qui.', actions: [{ label: 'Annulla', value: false }, { label: 'Apri il sito', value: true, primary: true }] });
    if (!ok) return;
    const u = urls[sys] || 'https://www.ikea.com/it/it/';
    if (window.CasaMiaAndroid && window.CasaMiaAndroid.openShop) window.CasaMiaAndroid.openShop(u);
    else { window.open(u, '_blank'); U().toast('Sul telefono il sito si apre dentro l’app e l’importazione è automatica'); }
  };

  /* ---------- Dal riepilogo di un progetto IKEA (o di un altro negozio) alla composizione ---------- */
  // items: [{name, desc, price, qty}] letti dalla pagina; restituisce una composizione o null
  CF.fromProductList = function (items, text) {
    const all = (items || []).map(i => ((i.name || '') + ' ' + (i.desc || '')).toLowerCase()).join(' \n ') + ' ' + String(text || '').toLowerCase();
    const sys = /metod|enhet.*cucina|knoxhult|cucina/.test(all) && /metod|knoxhult|pensile|base per/.test(all) ? 'metod' : /pax/.test(all) ? 'pax' : /best[aå]/.test(all) ? 'besta' : /godmorgon|enhet|tvallen|lavabo/.test(all) ? 'bagno' : null;
    if (!sys) return null;
    const f = CF.create(sys);
    f.modules = [];
    const dims = (s) => { const m = /(\d{2,3})\s*[x×]\s*(\d{2,3})(?:\s*[x×]\s*(\d{2,3}))?\s*cm/i.exec(s); return m ? [m[1], m[2], m[3]].map(v => v ? +v / 100 : null) : null; };
    for (const it of items || []) {
      const s = ((it.name || '') + ' ' + (it.desc || '')).toLowerCase();
      const qty = Math.max(1, Math.min(20, +it.qty || 1));
      const dm = dims(s);
      let kind = null, wall = false;
      if (sys === 'pax') { if (/struttura|guardaroba|frame/.test(s)) kind = dm && dm[0] >= 0.95 ? 'ante2' : 'ante'; else continue; }
      else if (sys === 'metod') {
        if (/pensile|wall/.test(s)) { kind = /cappa/.test(s) ? 'cappa' : 'pensile'; wall = true; }
        else if (/mobile alto|colonna|high/.test(s)) kind = /frigo/.test(s) ? 'colonnaFrigo' : /forno/.test(s) ? 'colonnaForno' : 'colonna';
        else if (/base/.test(s)) kind = /lavello|sink/.test(s) ? 'lavello' : /forno/.test(s) ? 'forno' : /angol/.test(s) ? 'angolo' : /cassett/.test(s) ? 'cassetti' : 'base';
        else if (/lavastoviglie/.test(s)) kind = 'lavastoviglie';
        else continue;
      } else if (sys === 'besta') { if (/struttura|mobile|panca|tv/.test(s)) kind = /cassett/.test(s) ? 'cassetti' : /vetro/.test(s) ? 'vetro' : 'ante'; else continue; }
      else { if (/lavabo|mobile per lavabo/.test(s)) kind = 'lavabo'; else if (/colonna|mobile alto/.test(s)) kind = 'colonna'; else if (/specchio/.test(s)) { kind = 'specchio'; wall = true; } else if (/mobile|cassett/.test(s)) kind = 'cassetti'; else continue; }
      const def = CF.moduleDef(sys, kind);
      const w = dm && dm[0] ? dm[0] : def.widths[0];
      for (let i = 0; i < qty; i++) f.modules.push({ id: CM.uid('m'), kind, w, h: def.h, d: def.d, wall: wall || !!def.wall, price: it.price ? it.price : def.price });
      if (sys === 'pax' && dm && dm[2]) f.body = { h: dm[2] > 2.2 ? 2.36 : 2.01, d: dm[1] > 0.45 ? 0.58 : 0.35 };
    }
    if (!f.modules.length) return null;
    // i prezzi di ante, cassetti e accessori (non moduli) li sommo al totale
    const used = f.modules.reduce((a, m) => a + (m.price || 0), 0);
    const total = (items || []).reduce((a, i) => a + (i.price || 0) * Math.max(1, +i.qty || 1), 0);
    if (total > used) f.modules[0].price += total - used;
    f.name = CF.SYSTEMS[sys].short + ' (importato)';
    return CF.refresh(f);
  };
})(typeof window !== 'undefined' ? window : globalThis);
