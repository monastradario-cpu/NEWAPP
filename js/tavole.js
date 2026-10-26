/* Casa Mia — tavole tecniche in scala (PDF): stato di fatto, progetto, gialli e rossi, quote, cartiglio */
(function (root) {
  'use strict';
  const CM = root.CM;
  const P = CM.plan, G = CM.geom;
  const U = () => CM.ui;
  const el = (...a) => CM.ui.el(...a);
  const TV = CM.tavole = {};

  const PAPERS = { A4L: [297, 210], A3L: [420, 297], A2L: [594, 420], A1L: [841, 594] };
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f2 = (v) => CM.fmt.num(v, 2);

  // Quale combinazione carta/scala ci sta (margini e cartiglio esclusi)
  TV.fit = function (plan, scale) {
    const b = P.bounds(Object.assign({}, plan, { underlay: null, furniture: {}, fixtures: {} }));
    if (!b) return null;
    const w = (b.maxX - b.minX + 2.4) * 1000 / scale, h = (b.maxY - b.minY + 2.4) * 1000 / scale;
    for (const k of ['A4L', 'A3L', 'A2L', 'A1L']) {
      const [pw, ph] = PAPERS[k];
      if (w <= pw - 20 && h <= ph - 20 - 42) return k;
    }
    return null;
  };

  // phase: 'fatto' | 'progetto' | 'confronto'
  TV.svg = function (project, plan, opts) {
    const scale = opts.scale, paper = opts.paper, phase = opts.phase;
    const [PW, PH] = PAPERS[paper];
    const k = 1000 / scale; // mm sulla carta per 1 m
    const b = P.bounds(Object.assign({}, plan, { underlay: null, furniture: {}, fixtures: {} }));
    const drawW = (b.maxX - b.minX) * k, drawH = (b.maxY - b.minY) * k;
    const areaH = PH - 20 - 42;
    const ox = 10 + (PW - 20 - drawW) / 2 - b.minX * k, oy = 10 + 6 + (areaH - drawH) / 2 - b.minY * k;
    const X = (x) => (ox + x * k).toFixed(2), Y = (y) => (oy + y * k).toFixed(2);
    const out = [];
    const showWall = (w) => phase === 'fatto' ? w.state !== 'nuovo' : phase === 'progetto' ? w.state !== 'demolire' : true;
    const wallFill = (w) => {
      if (phase === 'confronto' && w.state === 'demolire') return 'url(#giallo)';
      if (phase === 'confronto' && w.state === 'nuovo') return '#D23B2A';
      return 'url(#taglio)';
    };
    // stanze: superficie e nome
    for (const id in plan.rooms) {
      const r = plan.rooms[id];
      const pts = P.roomPts(plan, r);
      if (pts.length < 3) continue;
      out.push('<polygon points="' + pts.map(p => X(p.x) + ',' + Y(p.y)).join(' ') + '" fill="' + (CM.roomType(r.type).outdoor ? '#F4F6F1' : '#FFFFFF') + '" stroke="none"/>');
    }
    // muri (sezione), con le aperture ritagliate
    for (const id in plan.walls) {
      const w = plan.walls[id];
      if (!showWall(w)) continue;
      const A = plan.nodes[w.a], B = plan.nodes[w.b];
      const L = G.dist(A, B); if (L < 0.01) continue;
      const u = { x: (B.x - A.x) / L, y: (B.y - A.y) / L }, n = { x: -u.y, y: u.x };
      const ops = Object.values(plan.openings).filter(o => o.wall === id && !(phase === 'fatto' && o.state === 'nuova')).sort((a, c) => a.pos - c.pos);
      let cur = -w.t / 2;
      const pieces = [];
      for (const o of ops) { const s0 = o.pos - o.w / 2, s1 = o.pos + o.w / 2; if (s0 > cur) pieces.push([cur, s0]); cur = Math.max(cur, s1); }
      if (cur < L + w.t / 2) pieces.push([cur, L + w.t / 2]);
      for (const [s0, s1] of pieces) {
        const h = w.t / 2;
        const q = [[s0, h], [s1, h], [s1, -h], [s0, -h]].map(([s, d]) => ({ x: A.x + u.x * s + n.x * d, y: A.y + u.y * s + n.y * d }));
        out.push('<polygon points="' + q.map(p => X(p.x) + ',' + Y(p.y)).join(' ') + '" fill="' + wallFill(w) + '" stroke="#1B1E22" stroke-width="0.35"/>');
      }
      // aperture: finestre con il vetro, porte con l'arco
      for (const o of ops) {
        const c = { x: A.x + u.x * o.pos, y: A.y + u.y * o.pos };
        const a1 = { x: c.x - u.x * o.w / 2, y: c.y - u.y * o.w / 2 }, a2 = { x: c.x + u.x * o.w / 2, y: c.y + u.y * o.w / 2 };
        const col = phase === 'confronto' && o.state === 'nuova' ? '#D23B2A' : '#1B1E22';
        if (o.kind === 'finestra' || o.kind === 'portafinestra') {
          for (const d of [-w.t / 2, -0.01, 0.01, w.t / 2]) out.push('<line x1="' + X(a1.x + n.x * d) + '" y1="' + Y(a1.y + n.y * d) + '" x2="' + X(a2.x + n.x * d) + '" y2="' + Y(a2.y + n.y * d) + '" stroke="' + col + '" stroke-width="' + (Math.abs(d) < 0.02 ? 0.25 : 0.35) + '"/>');
        }
        if (o.kind === 'battente' || o.kind === 'portafinestra') {
          const side = o.flipSide ? -1 : 1, hs = o.flipHinge ? 1 : -1;
          const hinge = { x: c.x + u.x * hs * o.w / 2 + n.x * side * w.t / 2, y: c.y + u.y * hs * o.w / 2 + n.y * side * w.t / 2 };
          const tip = { x: hinge.x + n.x * side * o.w, y: hinge.y + n.y * side * o.w };
          const end = { x: hinge.x - u.x * hs * o.w, y: hinge.y - u.y * hs * o.w };
          out.push('<line x1="' + X(hinge.x) + '" y1="' + Y(hinge.y) + '" x2="' + X(tip.x) + '" y2="' + Y(tip.y) + '" stroke="' + col + '" stroke-width="0.3"/>');
          const sweep = (hs * side) > 0 ? 1 : 0;
          out.push('<path d="M' + X(tip.x) + ' ' + Y(tip.y) + ' A' + (o.w * k).toFixed(2) + ' ' + (o.w * k).toFixed(2) + ' 0 0 ' + sweep + ' ' + X(end.x) + ' ' + Y(end.y) + '" fill="none" stroke="' + col + '" stroke-width="0.18" stroke-dasharray="1 0.8"/>');
        }
        if (o.kind === 'scorrevole' || o.kind === 'scomparsa') out.push('<line x1="' + X(a1.x) + '" y1="' + Y(a1.y) + '" x2="' + X(a2.x) + '" y2="' + Y(a2.y) + '" stroke="' + col + '" stroke-width="0.5"/>');
        // larghezza dell'apertura
        out.push('<text x="' + X(c.x + n.x * (w.t / 2 + 0.25)) + '" y="' + Y(c.y + n.y * (w.t / 2 + 0.25)) + '" font-size="2" text-anchor="middle" fill="' + col + '">' + Math.round(o.w * 100) + (o.h ? '×' + Math.round(o.h * 100) : '') + '</text>');
      }
    }
    // pilastri
    for (const id in plan.columns) { const c = plan.columns[id]; out.push('<rect x="' + X(c.x - c.w / 2) + '" y="' + Y(c.y - c.d / 2) + '" width="' + (c.w * k).toFixed(2) + '" height="' + (c.d * k).toFixed(2) + '" fill="#1B1E22"/>'); }
    // nomi delle stanze, superficie e altezza
    for (const id in plan.rooms) {
      const r = plan.rooms[id];
      const pts = P.roomPts(plan, r);
      if (pts.length < 3) continue;
      const lp = G.labelPoint(pts), st = P.roomStats(plan, r);
      out.push('<text x="' + X(lp.x) + '" y="' + Y(lp.y) + '" font-size="2.8" font-weight="700" text-anchor="middle">' + esc(r.name) + '</text>');
      out.push('<text x="' + X(lp.x) + '" y="' + (+Y(lp.y) + 3.4) + '" font-size="2.2" text-anchor="middle">S = ' + f2(st.net) + ' m²</text>');
      if (!CM.roomType(r.type).outdoor) out.push('<text x="' + X(lp.x) + '" y="' + (+Y(lp.y) + 6.4) + '" font-size="2.2" text-anchor="middle">h = ' + f2(r.h || 2.7) + ' m</text>');
    }
    // quote dei muri (esterne ai muri, una per tratto)
    for (const id in plan.walls) {
      const w = plan.walls[id];
      if (!showWall(w)) continue;
      const A = plan.nodes[w.a], B = plan.nodes[w.b];
      const L = G.dist(A, B); if (L < 0.3) continue;
      const u = { x: (B.x - A.x) / L, y: (B.y - A.y) / L }, n = { x: -u.y, y: u.x };
      const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
      // lato verso cui scrivere: quello senza stanza (esterno) se c'è, altrimenti il primo
      const outSide = P.roomOf(plan, { x: mid.x + n.x * (w.t / 2 + 0.1), y: mid.y + n.y * (w.t / 2 + 0.1) }) ? -1 : 1;
      const off = (w.t / 2 + (outSide === 1 ? 0.45 : 0.3)) * outSide;
      const p1 = { x: A.x + n.x * off, y: A.y + n.y * off }, p2 = { x: B.x + n.x * off, y: B.y + n.y * off };
      out.push('<line x1="' + X(p1.x) + '" y1="' + Y(p1.y) + '" x2="' + X(p2.x) + '" y2="' + Y(p2.y) + '" stroke="#5F6670" stroke-width="0.15"/>');
      for (const p of [p1, p2]) out.push('<line x1="' + (+X(p.x) - 0.8) + '" y1="' + (+Y(p.y) + 0.8) + '" x2="' + (+X(p.x) + 0.8) + '" y2="' + (+Y(p.y) - 0.8) + '" stroke="#1B1E22" stroke-width="0.25"/>');
      const tm = { x: (p1.x + p2.x) / 2 + n.x * 0.12 * outSide, y: (p1.y + p2.y) / 2 + n.y * 0.12 * outSide };
      let ang = Math.atan2(B.y - A.y, B.x - A.x) * 180 / Math.PI;
      if (ang > 90.1) ang -= 180; if (ang <= -89.9) ang += 180;
      out.push('<text x="' + X(tm.x) + '" y="' + Y(tm.y) + '" font-size="2.1" text-anchor="middle" dominant-baseline="middle" transform="rotate(' + ang.toFixed(1) + ' ' + X(tm.x) + ' ' + Y(tm.y) + ')" fill="#1B1E22">' + f2(L) + '</text>');
    }
    // nord
    const nx = PW - 22, ny = 22, ang = project.north || 0;
    out.push('<g transform="rotate(' + ang + ' ' + nx + ' ' + ny + ')"><circle cx="' + nx + '" cy="' + ny + '" r="7" fill="none" stroke="#1B1E22" stroke-width="0.3"/><path d="M' + nx + ' ' + (ny - 7) + ' L' + (nx + 2.5) + ' ' + (ny + 3) + ' L' + nx + ' ' + (ny + 1) + ' L' + (nx - 2.5) + ' ' + (ny + 3) + 'Z" fill="#1B1E22"/></g><text x="' + nx + '" y="' + (ny - 9) + '" font-size="3" text-anchor="middle" font-weight="700">N</text>');
    // barra della scala
    const sb = 5 * k; const sx = PW - 14 - sb, sy = PH - 42 - 8;
    out.push('<g><rect x="' + sx + '" y="' + sy + '" width="' + (sb / 2) + '" height="1.6" fill="#1B1E22"/><rect x="' + (sx + sb / 2) + '" y="' + sy + '" width="' + (sb / 2) + '" height="1.6" fill="#fff" stroke="#1B1E22" stroke-width="0.25"/><text x="' + sx + '" y="' + (sy - 1.2) + '" font-size="2.2">0</text><text x="' + (sx + sb) + '" y="' + (sy - 1.2) + '" font-size="2.2" text-anchor="middle">5 m</text></g>');
    // legenda e cartiglio
    const t = P.totals(plan);
    const titles = { fatto: 'STATO DI FATTO', progetto: 'STATO DI PROGETTO', confronto: 'STATO DI CONFRONTO (demolizioni in giallo, costruzioni in rosso)' };
    const cy = PH - 10 - 32, cw = PW - 20;
    const meta = opts.meta || {};
    out.push('<rect x="10" y="' + cy + '" width="' + cw + '" height="32" fill="#fff" stroke="#1B1E22" stroke-width="0.4"/>');
    const col = (x, w2, label, val, big) => '<line x1="' + x + '" y1="' + cy + '" x2="' + x + '" y2="' + (cy + 32) + '" stroke="#1B1E22" stroke-width="0.25"/><text x="' + (x + 2) + '" y="' + (cy + 5) + '" font-size="2" fill="#5F6670">' + esc(label) + '</text><text x="' + (x + 2) + '" y="' + (cy + (big ? 14 : 11)) + '" font-size="' + (big ? 4.4 : 3) + '" font-weight="700">' + esc(val) + '</text>';
    const W1 = cw * 0.34, W2 = cw * 0.22, W3 = cw * 0.22, W4 = cw - W1 - W2 - W3;
    out.push(col(10, W1, 'Progetto', project.name, true));
    out.push('<text x="12" y="' + (cy + 21) + '" font-size="2.4">' + esc(meta.address || project.address || '') + '</text>');
    out.push('<text x="12" y="' + (cy + 27) + '" font-size="2.4">' + esc(meta.owner ? 'Committente: ' + meta.owner : '') + '</text>');
    out.push(col(10 + W1, W2, 'Tavola', (meta.num || '01') + ' — ' + titles[phase].split(' (')[0]));
    out.push('<text x="' + (12 + W1) + '" y="' + (cy + 18) + '" font-size="2.4">Scala 1:' + scale + ' · ' + paper.replace('L', '') + '</text>');
    out.push('<text x="' + (12 + W1) + '" y="' + (cy + 24) + '" font-size="2.4">Data: ' + new Date().toLocaleDateString('it-IT') + '</text>');
    out.push(col(10 + W1 + W2, W3, 'Superfici', 'Utile ' + f2(t.net) + ' m²'));
    out.push('<text x="' + (12 + W1 + W2) + '" y="' + (cy + 18) + '" font-size="2.4">Lorda ' + f2(t.gross) + ' m²' + (t.outdoor ? ' · Esterni ' + f2(t.outdoor) + ' m²' : '') + '</text>');
    out.push('<text x="' + (12 + W1 + W2) + '" y="' + (cy + 24) + '" font-size="2.4">' + t.rooms + ' ambienti</text>');
    out.push(col(10 + W1 + W2 + W3, W4, 'Redatto da', meta.author || ''));
    // legenda dentro il cartiglio
    const lx = 12 + W1 + W2 + W3, ly = cy + 17;
    const leg = [['url(#taglio)', 'Muro esistente']].concat(phase === 'confronto' ? [['url(#giallo)', 'Da demolire'], ['#D23B2A', 'Da costruire']] : []);
    leg.forEach(([fill, txt], i) => out.push('<rect x="' + lx + '" y="' + (ly + i * 4.5) + '" width="7" height="2.8" fill="' + fill + '" stroke="#1B1E22" stroke-width="0.25"/><text x="' + (lx + 9) + '" y="' + (ly + i * 4.5 + 2.4) + '" font-size="2.3">' + txt + '</text>'));
    out.push('<text x="10" y="' + (cy - 2) + '" font-size="3" font-weight="700">' + titles[phase] + '</text>');
    if (meta.note) out.push('<text x="' + (PW - 10) + '" y="' + (cy - 2) + '" font-size="2.2" text-anchor="end" fill="#5F6670">' + esc(meta.note) + '</text>');
    const defs = '<defs><pattern id="taglio" width="1.2" height="1.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.2" height="1.2" fill="#fff"/><line x1="0" y1="0" x2="0" y2="1.2" stroke="#1B1E22" stroke-width="0.35"/></pattern><pattern id="giallo" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.6" height="1.6" fill="#F6D65C"/><line x1="0" y1="0" x2="0" y2="1.6" stroke="#B88A00" stroke-width="0.3"/></pattern></defs>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + PW + 'mm" height="' + PH + 'mm" viewBox="0 0 ' + PW + ' ' + PH + '" font-family="Instrument Sans, Arial, sans-serif">' + defs +
      '<rect x="5" y="5" width="' + (PW - 10) + '" height="' + (PH - 10) + '" fill="none" stroke="#1B1E22" stroke-width="0.5"/>' + out.join('') + '</svg>';
  };

  TV.html = function (project, plan, opts) {
    const [PW, PH] = PAPERS[opts.paper];
    const pages = opts.phases.map(ph => '<div class="pg">' + TV.svg(project, plan, Object.assign({}, opts, { phase: ph, meta: Object.assign({}, opts.meta, { num: String(opts.phases.indexOf(ph) + 1).padStart(2, '0') }) })) + '</div>').join('');
    return '<!doctype html><html lang="it"><head><meta charset="utf-8"><title>' + esc(project.name) + ' - tavole</title><style>@page{size:' + PW + 'mm ' + PH + 'mm;margin:0}html,body{margin:0;padding:0;background:#fff}.pg{width:' + PW + 'mm;height:' + PH + 'mm;page-break-after:always;overflow:hidden}.pg:last-child{page-break-after:auto}svg{display:block}</style></head><body>' + pages + '</body></html>';
  };

  /* ---------- Dialogo ---------- */
  TV.dialog = async function (project, plan) {
    if (!Object.keys(plan.walls).length) { U().toast('Disegna prima i muri della casa'); return; }
    const v = { scale: 100, phases: ['fatto', 'progetto', 'confronto'], author: CM.store.pref('tavoleAutore') || '', owner: CM.store.pref('tavoleCommittente') || '', address: project.address || '' };
    const fit = () => TV.fit(plan, v.scale);
    const info = el('p', { class: 'muted small' });
    const upd = () => { const p = fit(); info.textContent = p ? 'Ci sta su un foglio ' + p.replace('L', '') + ' orizzontale.' : 'La casa è troppo grande per questa scala: scegli 1:100 o 1:200.'; };
    const hasWork = Object.values(plan.walls).some(w => w.state !== 'esistente');
    if (!hasWork) v.phases = ['progetto'];
    const phaseBox = el('div', { class: 'chips-row wrap' });
    const drawPh = () => { phaseBox.innerHTML = ''; [['fatto', 'Stato di fatto'], ['progetto', 'Progetto'], ['confronto', 'Gialli e rossi']].forEach(([k, l]) => phaseBox.appendChild(el('button', { class: 'chip small' + (v.phases.includes(k) ? ' active' : ''), text: l, onclick: () => { v.phases = v.phases.includes(k) ? v.phases.filter(x => x !== k) : v.phases.concat(k); if (!v.phases.length) v.phases = [k]; drawPh(); } }))); };
    drawPh();
    const body = el('div', { class: 'fields' }, [
      U().segField('Scala', [{ value: 50, label: '1:50' }, { value: 100, label: '1:100' }, { value: 200, label: '1:200' }], v.scale, x => { v.scale = x; body.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.textContent === '1:' + x)); upd(); }),
      el('div', { class: 'field full' }, [el('label', { text: 'Tavole' }), phaseBox]),
      U().textField('Redatto da', v.author, x => { v.author = x; }, { full: false }),
      U().textField('Committente', v.owner, x => { v.owner = x; }, { full: false }),
      U().textField('Indirizzo', v.address, x => { v.address = x; }),
      el('div', { class: 'full' }, [info])
    ]);
    upd();
    const r = await U().dialog({ title: 'Tavole in scala', text: hasWork ? '' : 'Non ci sono muri da demolire o costruire: preparo la tavola di progetto.', body, actions: [{ label: 'Annulla', value: null }, { label: 'Crea PDF', value: 'ok', primary: true }] });
    if (r !== 'ok') return;
    const paper = fit();
    if (!paper) { U().toast('Troppo grande per questa scala'); return; }
    CM.store.pref('tavoleAutore', v.author); CM.store.pref('tavoleCommittente', v.owner);
    const order = ['fatto', 'progetto', 'confronto'].filter(k => v.phases.includes(k));
    const html = TV.html(project, plan, { scale: v.scale, paper, phases: order, meta: { author: v.author, owner: v.owner, address: v.address } });
    const nat = window.CasaMiaAndroid;
    if (nat && nat.printHtmlMedia) { nat.printHtmlMedia(html, project.name + ' - tavole', paper); U().toast('Scegli “Salva come PDF” e il formato ' + paper.replace('L', '') + ' orizzontale'); return; }
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
