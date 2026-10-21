/* Casa Mia — vista frontale (prospetto) di una parete con aperture, mobili e impianti */
(function (root) {
  'use strict';
  const CM = root.CM;
  const P = CM.plan, G = CM.geom;
  const el = (...a) => CM.ui.el(...a);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Elementi visibili guardando la parete dal lato "side" (+1 = lato della normale)
  function collect(plan, wid, side) {
    const w = plan.walls[wid];
    const A = plan.nodes[w.a], B = plan.nodes[w.b];
    const L = G.dist(A, B);
    const u = { x: (B.x - A.x) / L, y: (B.y - A.y) / L };
    const n = { x: -u.y * side, y: u.x * side };
    const face = w.t / 2;
    const along = (p) => (p.x - A.x) * u.x + (p.y - A.y) * u.y;
    const dist = (p) => (p.x - A.x) * n.x + (p.y - A.y) * n.y - face;
    const items = [];
    for (const id in plan.furniture) {
      const f = plan.furniture[id];
      const c = P.furnitureCorners(f);
      const ds = c.map(dist), as = c.map(along);
      const near = Math.min(...ds);
      if (near < -0.08 || near > 0.9) continue;
      const a0 = Math.max(0, Math.min(...as)), a1 = Math.min(L, Math.max(...as));
      if (a1 - a0 < 0.05) continue;
      items.push({ kind: 'f', name: f.name, a0, a1, z0: f.elev || 0, z1: (f.elev || 0) + (f.h || 0.8), color: f.color, depth: near, shape: f.shape });
    }
    for (const id in plan.fixtures) {
      const fx = plan.fixtures[id];
      const d = dist(fx);
      if (d < -0.1 || d > 0.4) continue;
      const a = along(fx);
      if (a < 0 || a > L) continue;
      items.push({ kind: 'i', name: CM.FIXTURES[fx.kind].label, a0: a, a1: a, z0: CM.FIXTURES[fx.kind].elev, fx: fx.kind, state: fx.state });
    }
    const ops = Object.values(plan.openings).filter(o => o.wall === wid).map(o => {
      const b = o.kind === 'finestra' ? (o.sill || 0) : 0;
      return { kind: o.kind, a0: o.pos - o.w / 2, a1: o.pos + o.w / 2, z0: b, z1: b + o.h, w: o.w, h: o.h };
    });
    return { L, H: w.h || 2.7, items, ops, wall: w };
  }

  function svg(data, side, roomName) {
    const { L, H, items, ops } = data;
    const S = 100; // cm
    const fs = Math.max(9, Math.min(16, L * S / 34));
    const X = (a) => (side > 0 ? a : L - a) * S;
    const Y = (z) => (H - z) * S;
    const out = [];
    const pad = fs * 3;
    out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + (-pad) + ' ' + (-pad) + ' ' + (L * S + pad * 2) + ' ' + (H * S + pad * 2.8) + '" style="width:100%;height:auto;background:#FBFBF9;border-radius:12px" role="img" aria-label="Prospetto della parete ' + esc(roomName) + '">');
    out.push('<rect x="0" y="0" width="' + L * S + '" height="' + H * S + '" fill="#F3F1EC" stroke="#1B1E22" stroke-width="2"/>');
    // rivestimento (se presente nella stanza) non disegnato qui: solo struttura e arredi
    for (const o of ops) {
      const x0 = Math.min(X(o.a0), X(o.a1)), w = Math.abs(X(o.a1) - X(o.a0));
      const y0 = Y(Math.min(H, o.z1)), h = (Math.min(H, o.z1) - o.z0) * S;
      if (o.kind === 'arco') { out.push('<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + h + '" fill="#FFFFFF" stroke="#1B1E22" stroke-dasharray="6 4"/>'); continue; }
      const glass = o.kind === 'finestra' || o.kind === 'portafinestra';
      out.push('<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + h + '" fill="' + (glass ? '#DCEBF1' : '#E9E4DA') + '" stroke="#1B1E22" stroke-width="1.5"/>');
      if (glass) out.push('<path d="M' + (x0 + w / 2) + ' ' + y0 + 'v' + h + 'M' + x0 + ' ' + (y0 + h / 2) + 'h' + w + '" stroke="#8AA7B4" stroke-width="1"/>');
      else out.push('<circle cx="' + (x0 + w - 10) + '" cy="' + Y(1.0) + '" r="3" fill="#6B7079"/>');
      out.push('<text x="' + (x0 + w / 2) + '" y="' + (y0 - fs * 0.4) + '" font-size="' + fs * 0.8 + '" text-anchor="middle" fill="#5F6670" font-family="monospace">' + Math.round(o.w * 100) + '×' + Math.round(o.h * 100) + '</text>');
    }
    // mobili: prima quelli più lontani
    const furn = items.filter(i => i.kind === 'f').sort((a, b) => b.depth - a.depth);
    for (const it of furn) {
      const x0 = Math.min(X(it.a0), X(it.a1)), w = Math.abs(X(it.a1) - X(it.a0));
      const y0 = Y(Math.min(H, it.z1)), h = (Math.min(H, it.z1) - it.z0) * S;
      out.push('<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + Math.max(1, h) + '" fill="' + esc(it.color || '#D9D4CB') + '" fill-opacity="0.85" stroke="#4A4F57" stroke-width="1.2"/>');
      if (/kitchen_base|sink|hob/.test(it.shape)) out.push('<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="4" fill="#7D7A75"/>');
      if (w > fs * 3 && h > fs * 1.6) out.push('<text x="' + (x0 + w / 2) + '" y="' + (y0 + h / 2 + fs * 0.35) + '" font-size="' + fs * 0.85 + '" text-anchor="middle" fill="#1B1E22" font-family="sans-serif">' + esc(it.name.length > 22 ? it.name.slice(0, 21) + '…' : it.name) + '</text>');
      if (w > fs * 2.5) out.push('<text x="' + (x0 + w / 2) + '" y="' + (y0 + h - fs * 0.35) + '" font-size="' + fs * 0.7 + '" text-anchor="middle" fill="#4A4F57" font-family="monospace">' + Math.round((it.a1 - it.a0) * 100) + ' · h ' + Math.round((it.z1 - it.z0) * 100) + (it.z0 > 0.05 ? ' da ' + Math.round(it.z0 * 100) : '') + '</text>');
    }
    for (const it of items.filter(i => i.kind === 'i')) {
      const color = CM.FIXTURE_GROUPS[CM.FIXTURES[it.fx].group].color;
      out.push('<circle cx="' + X(it.a0) + '" cy="' + Y(it.z0) + '" r="' + fs * 0.6 + '" fill="' + (it.state === 'esistente' ? '#fff' : color) + '" stroke="' + color + '" stroke-width="2"><title>' + esc(it.name) + '</title></circle>');
      out.push('<text x="' + (X(it.a0) + fs * 0.9) + '" y="' + (Y(it.z0) + fs * 0.3) + '" font-size="' + fs * 0.65 + '" fill="' + color + '" font-family="monospace">' + Math.round(it.z0 * 100) + '</text>');
    }
    // quote
    const yd = H * S + fs * 1.6;
    out.push('<path d="M0 ' + yd + 'H' + L * S + 'M0 ' + (yd - 6) + 'v12M' + L * S + ' ' + (yd - 6) + 'v12" stroke="#1F4FD1" stroke-width="1.5"/>');
    out.push('<text x="' + L * S / 2 + '" y="' + (yd + fs * 1.3) + '" font-size="' + fs + '" text-anchor="middle" fill="#1F4FD1" font-family="monospace">' + CM.fmt.num(L, 2) + ' m</text>');
    out.push('<path d="M' + (-fs * 1.2) + ' 0V' + H * S + '" stroke="#1F4FD1" stroke-width="1.5"/>');
    out.push('<text x="' + (-fs * 1.6) + '" y="' + H * S / 2 + '" font-size="' + fs + '" text-anchor="middle" fill="#1F4FD1" font-family="monospace" transform="rotate(-90 ' + (-fs * 1.6) + ' ' + H * S / 2 + ')">h ' + CM.fmt.num(H, 2) + ' m</text>');
    out.push('</svg>');
    return out.join('');
  }

  CM.elevation = {
    open(plan, wid) {
      const w = plan.walls[wid];
      if (!w) return;
      const A = plan.nodes[w.a], B = plan.nodes[w.b];
      const L = G.dist(A, B) || 1;
      const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
      const nx = -(B.y - A.y) / L, ny = (B.x - A.x) / L;
      const roomAt = (k) => { const id = P.roomOf(plan, { x: mid.x + nx * k * (w.t / 2 + 0.1), y: mid.y + ny * k * (w.t / 2 + 0.1) }); return id ? plan.rooms[id].name : 'Esterno'; };
      const names = { 1: roomAt(1), '-1': roomAt(-1) };
      // parte dal lato con più arredi
      const count = (s) => collect(plan, wid, s).items.length;
      let side = count(-1) > count(1) ? -1 : 1;
      const view = el('div', {});
      const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Lato della parete' });
      const render = () => {
        view.innerHTML = svg(collect(plan, wid, side), side, names[side]);
        seg.innerHTML = '';
        for (const s of [1, -1]) seg.appendChild(el('button', { class: side === s ? 'on' : '', role: 'radio', 'aria-checked': side === s ? 'true' : 'false', text: 'Lato ' + names[s], onclick: () => { side = s; render(); } }));
      };
      render();
      const body = el('div', { style: 'display:flex;flex-direction:column;gap:10px' }, [seg, view,
        el('p', { class: 'muted small', text: 'Vista frontale della parete: porte e finestre, mobili appoggiati (basi, pensili, colonne, armadi) e punti degli impianti con l’altezza da terra in cm.' })]);
      CM.ui.dialog({ title: 'Prospetto della parete', body, actions: [{ label: 'Condividi immagine', value: 'share' }, { label: 'Chiudi', value: true, primary: true }] }).then(r => {
        if (r !== 'share') return;
        const svgText = svg(collect(plan, wid, side), side, names[side]).replace('style="width:100%;height:auto;background:#FBFBF9;border-radius:12px"', 'width="1600" height="' + Math.round(1600 * ((w.h || 2.7) + 0.9) / (L + 0.6)) + '"');
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas'); c.width = img.width || 1600; c.height = img.height || 1000;
          const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
          CM.share.file('prospetto.png', 'image/png', c.toDataURL('image/png'), true);
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText)));
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
