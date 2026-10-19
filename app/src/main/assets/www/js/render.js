/* Casa Mia — disegno della pianta su canvas */
(function (root) {
  'use strict';
  const CM = root.CM;
  const P = CM.plan, G = CM.geom;

  const C = CM.colors = {
    paper: '#FBFBF9',
    gridMinor: '#EFEEE9',
    gridMajor: '#E1DFD8',
    ink: '#1B1E22',
    muted: '#5F6670',
    accent: '#1F4FD1',
    accentSoft: 'rgba(31,79,209,0.10)',
    demolishFill: '#FBEFC6',
    demolishLine: '#B88A00',
    newWall: '#D23B2A',
    warn: '#B45309'
  };
  const MONO = "'JetBrains Mono', ui-monospace, monospace";
  const SANS = "'Instrument Sans', system-ui, sans-serif";

  function toS(v, p) { return { x: v.x + p.x * v.s, y: v.y + p.y * v.s }; }

  function fitView(plan, w, h, pad) {
    pad = pad == null ? 32 : pad;
    const b = P.bounds(plan);
    if (!b) return { s: 40, x: w / 2 - 4 * 40, y: h / 2 - 3 * 40 };
    const bw = Math.max(b.maxX - b.minX, 1), bh = Math.max(b.maxY - b.minY, 1);
    const s = Math.max(4, Math.min((w - pad * 2) / bw, (h - pad * 2) / bh, 400));
    return { s, x: (w - bw * s) / 2 - b.minX * s, y: (h - bh * s) / 2 - b.minY * s };
  }

  function wallQuad(plan, w, extend) {
    const A = plan.nodes[w.a], B = plan.nodes[w.b];
    const L = G.dist(A, B) || 1;
    const u = { x: (B.x - A.x) / L, y: (B.y - A.y) / L };
    const n = { x: -u.y, y: u.x };
    const h = w.t / 2, e = extend ? h : 0;
    return [
      { x: A.x - u.x * e + n.x * h, y: A.y - u.y * e + n.y * h },
      { x: B.x + u.x * e + n.x * h, y: B.y + u.y * e + n.y * h },
      { x: B.x + u.x * e - n.x * h, y: B.y + u.y * e - n.y * h },
      { x: A.x - u.x * e - n.x * h, y: A.y - u.y * e - n.y * h }
    ];
  }

  function polyPath(ctx, v, pts) {
    ctx.beginPath();
    pts.forEach((p, i) => { const q = toS(v, p); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
    ctx.closePath();
  }

  function haloText(ctx, text, x, y, color) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(251,251,249,0.95)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawGrid(ctx, v, w, h) {
    const levels = [[0.1, C.gridMinor, 9], [0.5, C.gridMinor, 10], [1, C.gridMajor, 6]];
    for (const [step, color, minPx] of levels) {
      if (step * v.s < minPx) continue;
      ctx.beginPath();
      const x0 = Math.floor(-v.x / v.s / step) * step, x1 = (w - v.x) / v.s;
      const y0 = Math.floor(-v.y / v.s / step) * step, y1 = (h - v.y) / v.s;
      for (let x = x0; x <= x1; x += step) { const sx = Math.round(v.x + x * v.s) + 0.5; ctx.moveTo(sx, 0); ctx.lineTo(sx, h); }
      for (let y = y0; y <= y1; y += step) { const sy = Math.round(v.y + y * v.s) + 0.5; ctx.moveTo(0, sy); ctx.lineTo(w, sy); }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawOpening(ctx, v, plan, op, selected) {
    const g = P.openingGeom(plan, op);
    if (!g) return;
    const { c, u, n, t } = g;
    const half = op.w / 2;
    const side = op.flipSide ? -1 : 1;
    const nn = { x: n.x * side, y: n.y * side };
    const at = (along, across) => ({ x: c.x + u.x * along + n.x * across, y: c.y + u.y * along + n.y * across });
    const atS = (along, across) => toS(v, at(along, across));
    const hw = t / 2 + 0.01;

    // Varco nel muro
    polyPath(ctx, v, [at(-half, hw), at(half, hw), at(half, -hw), at(-half, -hw)]);
    ctx.fillStyle = C.paper;
    ctx.fill();

    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.2;
    const line = (p, q, width, dash) => {
      ctx.beginPath(); ctx.setLineDash(dash || []); ctx.lineWidth = width || 1.2;
      const a = toS(v, p), b = toS(v, q); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
    };
    const jambs = () => { line(at(-half, -t / 2), at(-half, t / 2)); line(at(half, -t / 2), at(half, t / 2)); };

    const leaf = (hingeAlong, closedAlong, width) => {
      // anta a battente: cerniera sul filo del muro dal lato di apertura
      const hinge = { x: c.x + u.x * hingeAlong + nn.x * t / 2, y: c.y + u.y * hingeAlong + nn.y * t / 2 };
      const closed = { x: c.x + u.x * closedAlong + nn.x * t / 2, y: c.y + u.y * closedAlong + nn.y * t / 2 };
      const open = { x: hinge.x + nn.x * width, y: hinge.y + nn.y * width };
      line(hinge, open, 2);
      const H = toS(v, hinge), O = toS(v, open), K = toS(v, closed);
      const a0 = Math.atan2(O.y - H.y, O.x - H.x), a1 = Math.atan2(K.y - H.y, K.x - H.x);
      let d = a1 - a0;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.arc(H.x, H.y, width * v.s, a0, a1, d < 0);
      ctx.stroke();
    };

    const hingeSign = op.flipHinge ? 1 : -1;
    switch (op.kind) {
      case 'finestra':
      case 'portafinestra': {
        polyPath(ctx, v, [at(-half, t / 2), at(half, t / 2), at(half, -t / 2), at(-half, -t / 2)]);
        ctx.lineWidth = 1.1; ctx.stroke();
        line(at(-half, 0), at(half, 0), 1.1);
        if (op.kind === 'portafinestra') {
          leaf(-half, 0, half);
          leaf(half, 0, half);
        }
        break;
      }
      case 'scorrevole': {
        jambs();
        const off = t / 2 + 0.05;
        line(at(-half, side * off), at(half, side * off), 3);
        line(at(half, side * off), at(half + op.w * 0.9, side * off), 1, [4, 3]);
        break;
      }
      case 'scomparsa': {
        jambs();
        line(at(-half, 0), at(half, 0), 2.5);
        line(at(half, 0), at(half + op.w, 0), 1, [4, 3]);
        break;
      }
      case 'arco': {
        line(at(-half, -t / 2), at(-half, t / 2), 1, [3, 2]);
        line(at(half, -t / 2), at(half, t / 2), 1, [3, 2]);
        line(at(-half, -t / 2), at(half, -t / 2), 1, [2, 4]);
        line(at(-half, t / 2), at(half, t / 2), 1, [2, 4]);
        break;
      }
      default: { // battente
        jambs();
        leaf(hingeSign * half, -hingeSign * half, op.w);
      }
    }

    if (selected) {
      polyPath(ctx, v, [at(-half - 0.02, hw + 0.03), at(half + 0.02, hw + 0.03), at(half + 0.02, -hw - 0.03), at(-half - 0.02, -hw - 0.03)]);
      ctx.strokeStyle = C.accent; ctx.lineWidth = 2; ctx.stroke();
      const lp = atS(0, -(t / 2 + 0.02) * side);
      ctx.font = '600 11px ' + MONO; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const off = 12;
      haloText(ctx, CM.fmt.cm(op.w), lp.x - n.x * side * off, lp.y - n.y * side * off, C.accent);
    }
  }

  function dimLabel(ctx, v, A, B, offsetPx, text, color, bold) {
    const a = toS(v, A), b = toS(v, B);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 34) return;
    let ang = Math.atan2(b.y - a.y, b.x - a.x);
    const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
    const mx = (a.x + b.x) / 2 + nx * offsetPx, my = (a.y + b.y) / 2 + ny * offsetPx;
    if (ang > Math.PI / 2 + 1e-3) ang -= Math.PI;
    if (ang <= -Math.PI / 2 + 1e-3) ang += Math.PI;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(ang);
    ctx.font = (bold ? '600 ' : '500 ') + '10.5px ' + MONO;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    haloText(ctx, text, 0, 0, color);
    ctx.restore();
  }

  /**
   * opts: { plan, view, width, height, sel, showGrid, showDims, thumb, draft, highlightNodes, northDeg }
   */
  function draw(ctx, opts) {
    const { plan, view: v, width: W, height: H } = opts;
    const sel = opts.sel || {};
    ctx.save();
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);
    if (opts.showGrid && !opts.thumb) drawGrid(ctx, v, W, H);

    // Stanze
    for (const id in plan.rooms) {
      const room = plan.rooms[id];
      const pts = P.roomPts(plan, room);
      if (pts.length < 3) continue;
      polyPath(ctx, v, pts);
      ctx.fillStyle = CM.roomType(room.type).fill;
      ctx.fill();
      if (sel.type === 'room' && sel.id === id) {
        ctx.fillStyle = C.accentSoft; ctx.fill();
      }
    }

    // Travi (tratteggio, sono "sopra" la pianta)
    for (const id in plan.beams) {
      const b = plan.beams[id];
      const quad = wallQuad({ nodes: { a: { x: b.x1, y: b.y1 }, b: { x: b.x2, y: b.y2 } } }, { a: 'a', b: 'b', t: b.w }, false);
      polyPath(ctx, v, quad);
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = sel.type === 'beam' && sel.id === id ? 2 : 1.2;
      ctx.strokeStyle = sel.type === 'beam' && sel.id === id ? C.accent : '#6B7079';
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Muri: prima quelli da demolire, poi gli altri
    const wallIds = Object.keys(plan.walls);
    const order = wallIds.filter(id => plan.walls[id].state === 'demolire').concat(wallIds.filter(id => plan.walls[id].state !== 'demolire'));
    for (const id of order) {
      const w = plan.walls[id];
      if (!plan.nodes[w.a] || !plan.nodes[w.b]) continue;
      const quad = wallQuad(plan, w, true);
      polyPath(ctx, v, quad);
      if (w.state === 'demolire') {
        ctx.fillStyle = C.demolishFill; ctx.fill();
        ctx.setLineDash([5, 3]); ctx.lineWidth = 1.4; ctx.strokeStyle = C.demolishLine; ctx.stroke(); ctx.setLineDash([]);
      } else {
        ctx.fillStyle = w.state === 'nuovo' ? C.newWall : C.ink;
        ctx.fill();
        if (w.t * v.s < 2) { ctx.lineWidth = 2; ctx.strokeStyle = ctx.fillStyle; ctx.stroke(); }
      }
    }

    // Aperture
    for (const id in plan.openings) drawOpening(ctx, v, plan, plan.openings[id], !opts.thumb && sel.type === 'opening' && sel.id === id);

    // Pilastri
    for (const id in plan.columns) {
      const c = plan.columns[id];
      const p = toS(v, { x: c.x - c.w / 2, y: c.y - c.d / 2 });
      const w = c.w * v.s, h = c.d * v.s;
      ctx.fillStyle = '#3A3F46';
      ctx.fillRect(p.x, p.y, w, h);
      if (!opts.thumb) {
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + w, p.y + h); ctx.moveTo(p.x + w, p.y); ctx.lineTo(p.x, p.y + h);
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; ctx.stroke();
      }
      if (sel.type === 'column' && sel.id === id) { ctx.strokeStyle = C.accent; ctx.lineWidth = 2; ctx.strokeRect(p.x - 3, p.y - 3, w + 6, h + 6); }
    }

    if (!opts.thumb) {
      // Muro selezionato
      if (sel.type === 'wall' && plan.walls[sel.id]) {
        polyPath(ctx, v, wallQuad(plan, plan.walls[sel.id], true));
        ctx.strokeStyle = C.accent; ctx.lineWidth = 2.5; ctx.stroke();
      }
      // Etichette stanze
      for (const id in plan.rooms) {
        const room = plan.rooms[id];
        const pts = P.roomPts(plan, room);
        if (pts.length < 3) continue;
        const st = P.roomStats(plan, room);
        const lp = toS(v, G.labelPoint(pts));
        const fs = Math.max(10, Math.min(15, v.s * 0.3));
        const minSide = Math.sqrt(st.gross) * v.s;
        if (minSide < 46) continue;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '600 ' + fs + 'px ' + SANS;
        const selected = sel.type === 'room' && sel.id === id;
        haloText(ctx, room.name, lp.x, lp.y - fs * 0.62, selected ? C.accent : C.ink);
        ctx.font = '500 ' + (fs - 1.5) + 'px ' + MONO;
        haloText(ctx, CM.fmt.area(st.net), lp.x, lp.y + fs * 0.62, C.muted);
      }
      // Quote dei muri
      if (opts.showDims || sel.type === 'wall') {
        for (const id in plan.walls) {
          const isSel = sel.type === 'wall' && sel.id === id;
          if (!opts.showDims && !isSel) continue;
          const w = plan.walls[id];
          const A = plan.nodes[w.a], B = plan.nodes[w.b];
          const off = w.t * v.s / 2 + 9;
          dimLabel(ctx, v, A, B, off, CM.fmt.num(G.dist(A, B), 2), isSel ? C.accent : C.muted, isSel);
        }
      }
      // Maniglie dei vertici
      for (const nid of (opts.highlightNodes || [])) {
        const n = plan.nodes[nid];
        if (!n) continue;
        const p = toS(v, n);
        ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF'; ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = C.accent; ctx.stroke();
      }
      if (opts.draft) drawDraft(ctx, v, opts.draft);
    }
    ctx.restore();
  }

  function drawDraft(ctx, v, d) {
    ctx.save();
    if (d.kind === 'rect') {
      const a = toS(v, d.a), b = toS(v, d.b);
      ctx.fillStyle = 'rgba(31,79,209,0.08)';
      ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.setLineDash([6, 4]); ctx.strokeStyle = C.accent; ctx.lineWidth = 2;
      ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.setLineDash([]);
      const w = Math.abs(d.b.x - d.a.x), h = Math.abs(d.b.y - d.a.y);
      ctx.font = '600 12px ' + MONO; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      haloText(ctx, CM.fmt.num(w, 2), (a.x + b.x) / 2, Math.min(a.y, b.y) - 12, C.accent);
      ctx.save(); ctx.translate(Math.min(a.x, b.x) - 12, (a.y + b.y) / 2); ctx.rotate(-Math.PI / 2);
      haloText(ctx, CM.fmt.num(h, 2), 0, 0, C.accent); ctx.restore();
      ctx.font = '600 13px ' + SANS;
      haloText(ctx, CM.fmt.area(w * h), (a.x + b.x) / 2, (a.y + b.y) / 2, C.accent);
    }
    if (d.kind === 'chain' || d.kind === 'beam') {
      const pts = d.points.map(p => toS(v, p));
      ctx.strokeStyle = C.accent; ctx.lineWidth = 3;
      if (d.kind === 'beam') ctx.setLineDash([6, 4]);
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      if (d.cursor) { const c = toS(v, d.cursor); ctx.lineTo(c.x, c.y); }
      ctx.stroke();
      ctx.setLineDash([]);
      for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); }
      if (d.cursor && d.points.length) {
        const last = d.points[d.points.length - 1];
        dimLabel(ctx, v, last, d.cursor, 16, CM.fmt.num(G.dist(last, d.cursor), 2), C.accent, true);
      }
    }
    if (d.snap) {
      const p = toS(v, d.snap);
      ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.strokeStyle = C.accent; ctx.lineWidth = 1.5; ctx.stroke();
    }
    if (d.guides) {
      ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(31,79,209,0.55)'; ctx.lineWidth = 1;
      for (const gl of d.guides) {
        const a = toS(v, gl.a), b = toS(v, gl.b);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  CM.render = { draw, fitView, toS, wallQuad };
})(typeof window !== 'undefined' ? window : globalThis);
