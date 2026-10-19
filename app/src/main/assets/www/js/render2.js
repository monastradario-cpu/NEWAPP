/* Casa Mia — disegno di arredi, impianti e planimetria di sfondo */
(function (root) {
  'use strict';
  const CM = root.CM;
  const P = CM.plan;
  const imgCache = new Map();

  function getImage(src, onload) {
    let im = imgCache.get(src);
    if (!im) {
      im = new Image();
      im.onload = () => onload && onload();
      im.src = src;
      imgCache.set(src, im);
    }
    return im.complete && im.naturalWidth ? im : null;
  }
  CM.getImage = getImage;

  function drawUnderlay(ctx, v, u, redraw) {
    if (!u || !u.src) return;
    const im = getImage(u.src, redraw);
    if (!im) return;
    ctx.save();
    ctx.globalAlpha = u.opacity == null ? 0.5 : u.opacity;
    ctx.translate(v.x + u.x * v.s, v.y + u.y * v.s);
    ctx.drawImage(im, 0, 0, u.wM * v.s, u.hM * v.s);
    ctx.restore();
  }

  // Simboli in pianta: disegnati nel sistema locale del mobile (metri, origine al centro)
  function symbol(ctx, f, lw) {
    const w = f.w, d = f.d, hw = w / 2, hd = d / 2;
    const rect = (x, y, a, b, r) => {
      ctx.beginPath();
      if (r && ctx.roundRect) ctx.roundRect(x, y, a, b, r); else ctx.rect(x, y, a, b);
    };
    const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
    const circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); };
    ctx.lineWidth = lw;
    switch (f.shape) {
      case 'bed': {
        rect(-hw, -hd, w, d, 0.04); ctx.fill(); ctx.stroke();
        const pw = w > 1.2 ? (w - 0.3) / 2 : w - 0.2;
        if (w > 1.2) { rect(-hw + 0.1, -hd + 0.08, pw, 0.32, 0.06); ctx.stroke(); rect(0.05, -hd + 0.08, pw, 0.32, 0.06); ctx.stroke(); }
        else { rect(-pw / 2, -hd + 0.08, pw, 0.32, 0.06); ctx.stroke(); }
        line(-hw, -hd + 0.55, hw, -hd + 0.55);
        line(-hw, -hd + 0.55, -hw + 0.25, -hd + 0.75);
        break;
      }
      case 'sofa': case 'armchair': {
        rect(-hw, -hd, w, d, 0.06); ctx.fill(); ctx.stroke();
        rect(-hw, -hd, w, 0.22); ctx.stroke();
        rect(-hw, -hd, 0.18, d); ctx.stroke(); rect(hw - 0.18, -hd, 0.18, d); ctx.stroke();
        if (f.shape === 'sofa') { const n = Math.max(1, Math.round((w - 0.36) / 0.65)); for (let i = 1; i < n; i++) { const x = -hw + 0.18 + (w - 0.36) * i / n; line(x, -hd + 0.22, x, hd); } }
        break;
      }
      case 'sofa_l': {
        ctx.beginPath(); ctx.moveTo(-hw, -hd); ctx.lineTo(hw, -hd); ctx.lineTo(hw, hd); ctx.lineTo(hw - 0.95, hd); ctx.lineTo(hw - 0.95, -hd + 0.92); ctx.lineTo(-hw, -hd + 0.92); ctx.closePath(); ctx.fill(); ctx.stroke();
        line(-hw, -hd + 0.22, hw - 0.22, -hd + 0.22); line(hw - 0.22, -hd + 0.22, hw - 0.22, hd);
        break;
      }
      case 'round_table': ctx.beginPath(); ctx.ellipse(0, 0, hw, hd, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break;
      case 'chair': rect(-hw, -hd, w, d, 0.05); ctx.fill(); ctx.stroke(); rect(-hw, -hd, w, 0.08); ctx.stroke(); break;
      case 'wardrobe': case 'kitchen_tall': {
        rect(-hw, -hd, w, d); ctx.fill(); ctx.stroke();
        line(-hw, hd - 0.04, hw, hd - 0.04);
        if (f.shape === 'kitchen_tall') { line(-hw, -hd, hw, hd); line(hw, -hd, -hw, hd); }
        else { const n = Math.max(1, Math.round(w / 0.5)); for (let i = 1; i < n; i++) { const x = -hw + w * i / n; line(x, -hd, x, hd); } }
        break;
      }
      case 'kitchen_wall': ctx.setLineDash([0.08, 0.05]); rect(-hw, -hd, w, d); ctx.stroke(); ctx.setLineDash([]); break;
      case 'kitchen_base': case 'cabinet': case 'desk': rect(-hw, -hd, w, d); ctx.fill(); ctx.stroke(); line(-hw, hd - 0.05, hw, hd - 0.05); break;
      case 'sink': rect(-hw, -hd, w, d); ctx.fill(); ctx.stroke(); rect(-Math.min(0.25, hw - 0.05), -hd + 0.12, Math.min(0.5, w - 0.1), d - 0.25, 0.05); ctx.stroke(); circle(0, -hd + 0.08, 0.025); ctx.stroke(); break;
      case 'hob': {
        rect(-hw, -hd, w, d); ctx.fill(); ctx.stroke();
        const cx = [-w * 0.22, w * 0.22], cy = [-d * 0.2, d * 0.2];
        for (const x of cx) for (const y of cy) { circle(x, y, Math.min(w, d) * 0.12); ctx.stroke(); }
        break;
      }
      case 'fridge': case 'washer': rect(-hw, -hd, w, d); ctx.fill(); ctx.stroke(); if (f.shape === 'washer') { circle(0, 0.03, Math.min(w, d) * 0.3); ctx.stroke(); } else line(-hw, -hd + d * 0.1, hw, -hd + d * 0.1); break;
      case 'wc': case 'bidet': rect(-hw + 0.03, -hd, w - 0.06, 0.16, 0.03); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(0, -hd + 0.16 + (d - 0.16) / 2, hw, (d - 0.16) / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break;
      case 'basin': rect(-hw, -hd, w, d); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(0, 0.02, hw * 0.65, hd * 0.6, 0, 0, Math.PI * 2); ctx.stroke(); break;
      case 'shower': rect(-hw, -hd, w, d); ctx.fill(); ctx.stroke(); line(-hw, -hd, hw, hd); line(hw, -hd, -hw, hd); circle(0, 0, 0.04); ctx.stroke(); break;
      case 'bath': rect(-hw, -hd, w, d, 0.05); ctx.fill(); ctx.stroke(); rect(-hw + 0.08, -hd + 0.08, w - 0.16, d - 0.16, 0.2); ctx.stroke(); break;
      case 'tv': case 'picture': case 'mirror': rect(-hw, -hd, w, Math.max(d, 0.03)); ctx.fill(); ctx.stroke(); break;
      case 'shelf': { rect(-hw, -hd, w, d); ctx.fill(); ctx.stroke(); const n = Math.max(2, Math.round(w / 0.3)); for (let i = 1; i < n; i++) { const x = -hw + w * i / n; line(x, -hd, x, hd); } break; }
      case 'rug': ctx.setLineDash([0.06, 0.04]); rect(-hw, -hd, w, d); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); break;
      case 'plant': case 'tree': {
        circle(0, 0, Math.min(hw, hd)); ctx.fill(); ctx.stroke();
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; line(0, 0, Math.cos(a) * Math.min(hw, hd) * 0.8, Math.sin(a) * Math.min(hw, hd) * 0.8); }
        break;
      }
      case 'lamp_floor': circle(0, 0, Math.min(hw, hd)); ctx.fill(); ctx.stroke(); line(-hw * 0.7, 0, hw * 0.7, 0); line(0, -hd * 0.7, 0, hd * 0.7); break;
      case 'lamp_ceiling': ctx.setLineDash([0.04, 0.04]); circle(0, 0, Math.min(hw, hd)); ctx.stroke(); ctx.setLineDash([]); circle(0, 0, Math.min(hw, hd) * 0.3); ctx.fill(); ctx.stroke(); break;
      case 'curtain': { ctx.beginPath(); const n = Math.max(3, Math.round(w / 0.12)); for (let i = 0; i <= n; i++) { const x = -hw + w * i / n, y = (i % 2 ? 1 : -1) * Math.max(d, 0.05) / 2; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke(); break; }
      case 'umbrella': { circle(0, 0, Math.min(hw, hd)); ctx.fill(); ctx.stroke(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; line(0, 0, Math.cos(a) * Math.min(hw, hd), Math.sin(a) * Math.min(hw, hd)); } break; }
      case 'pergola': { rect(-hw, -hd, w, d); ctx.stroke(); const n = Math.max(3, Math.round(w / 0.4)); for (let i = 1; i < n; i++) { const x = -hw + w * i / n; line(x, -hd, x, hd); } break; }
      case 'hedge': rect(-hw, -hd, w, d, Math.min(hw, hd)); ctx.fill(); ctx.stroke(); break;
      case 'car': rect(-hw, -hd, w, d, 0.3); ctx.fill(); ctx.stroke(); rect(-hw + 0.15, -hd + d * 0.28, w - 0.3, d * 0.16, 0.1); ctx.stroke(); rect(-hw + 0.15, hd - d * 0.28, w - 0.3, d * 0.12, 0.1); ctx.stroke(); break;
      case 'path': {
        rect(-hw, -hd, w, d); ctx.fill(); ctx.stroke();
        const n = Math.max(2, Math.round(d / 0.5));
        for (let i = 0; i < n; i++) { const y = -hd + d * (i + 0.5) / n; ctx.beginPath(); ctx.ellipse((i % 2 ? 0.1 : -0.1) * w, y, w * 0.28, d / n * 0.32, 0, 0, Math.PI * 2); ctx.stroke(); }
        break;
      }
      case 'fence': {
        line(-hw, 0, hw, 0);
        const n = Math.max(2, Math.round(w / 1.0));
        for (let i = 0; i <= n; i++) { const x = -hw + w * i / n; rect(x - 0.04, -0.04, 0.08, 0.08); ctx.fill(); ctx.stroke(); }
        break;
      }
      case 'lounger': rect(-hw, -hd, w, d, 0.05); ctx.fill(); ctx.stroke(); line(-hw, -hd + d * 0.3, hw, -hd + d * 0.3); break;
      default: rect(-hw, -hd, w, d); ctx.fill(); ctx.stroke();
    }
  }

  function hexAlpha(hex, a) {
    const h = (hex || '#D9D4CB').replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function drawFurniture(ctx, v, plan, opts) {
    const sel = opts.sel || {};
    const warns = opts.furnitureWarnings || {};
    const ids = Object.keys(plan.furniture).sort((a, b) => {
      const fa = plan.furniture[a], fb = plan.furniture[b];
      const ka = fa.shape === 'rug' ? 0 : (fa.elev > 1 ? 2 : 1), kb = fb.shape === 'rug' ? 0 : (fb.elev > 1 ? 2 : 1);
      return ka - kb;
    });
    for (const id of ids) {
      const f = plan.furniture[id];
      const p = { x: v.x + f.x * v.s, y: v.y + f.y * v.s };
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(f.rot || 0);
      ctx.scale(v.s, v.s);
      const isSel = sel.type === 'furniture' && sel.id === id;
      const bad = warns[id] && warns[id].length;
      ctx.fillStyle = hexAlpha(f.color, f.shape === 'rug' ? 0.35 : 0.55);
      ctx.strokeStyle = bad ? '#C2410C' : (isSel ? CM.colors.accent : '#4A4F57');
      symbol(ctx, f, (isSel || bad ? 2.2 : 1.1) / v.s);
      if (isSel) {
        ctx.setLineDash([4 / v.s, 3 / v.s]); ctx.strokeStyle = CM.colors.accent; ctx.lineWidth = 1.5 / v.s;
        ctx.strokeRect(-f.w / 2 - 0.04, -f.d / 2 - 0.04, f.w + 0.08, f.d + 0.08); ctx.setLineDash([]);
        // freccia del fronte
        ctx.beginPath(); ctx.moveTo(-0.08, f.d / 2 + 0.08); ctx.lineTo(0, f.d / 2 + 0.16); ctx.lineTo(0.08, f.d / 2 + 0.08); ctx.lineWidth = 2 / v.s; ctx.stroke();
      }
      ctx.restore();
      if (!opts.thumb && Math.min(f.w, f.d) * v.s > 34 && f.shape !== 'rug') {
        ctx.font = '600 10px ' + "'Instrument Sans', sans-serif";
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        const label = f.name.length > 18 ? f.name.slice(0, 17) + '…' : f.name;
        ctx.strokeText(label, p.x, p.y); ctx.fillStyle = '#1B1E22'; ctx.fillText(label, p.x, p.y);
      }
      if (bad && !opts.thumb) {
        ctx.beginPath(); ctx.arc(p.x + f.w * v.s / 2 * 0.7, p.y - f.d * v.s / 2 * 0.7, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#C2410C'; ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '700 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('!', p.x + f.w * v.s / 2 * 0.7, p.y - f.d * v.s / 2 * 0.7 + 0.5);
      }
    }
  }

  const FIX_GLYPH = { presa: 'P', presa_tv: 'TV', interruttore: 'I', luce: '✕', applique: 'L', quadro: 'QE', acqua: 'A', scarico: 'S', termosifone: 'T', condizionatore: 'AC', caldaia: 'C' };
  function drawFixtures(ctx, v, plan, opts) {
    const sel = opts.sel || {};
    for (const id in plan.fixtures) {
      const fx = plan.fixtures[id];
      const def = CM.FIXTURES[fx.kind];
      if (!def) continue;
      const color = CM.FIXTURE_GROUPS[def.group].color;
      const p = { x: v.x + fx.x * v.s, y: v.y + fx.y * v.s };
      const r = opts.thumb ? 2 : 10;
      ctx.beginPath();
      if (fx.kind === 'termosifone' || fx.kind === 'condizionatore' || fx.kind === 'quadro' || fx.kind === 'caldaia') ctx.rect(p.x - r * 1.3, p.y - r * 0.8, r * 2.6, r * 1.6);
      else ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = fx.state === 'esistente' ? '#FFFFFF' : color;
      ctx.fill();
      ctx.lineWidth = sel.type === 'fixture' && sel.id === id ? 3 : 1.5;
      ctx.strokeStyle = sel.type === 'fixture' && sel.id === id ? CM.colors.accent : color;
      ctx.stroke();
      if (!opts.thumb) {
        ctx.fillStyle = fx.state === 'esistente' ? color : '#FFFFFF';
        ctx.font = '700 ' + (FIX_GLYPH[fx.kind].length > 1 ? 8.5 : 10) + "px 'JetBrains Mono', monospace";
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(FIX_GLYPH[fx.kind], p.x, p.y + 0.5);
      }
    }
  }

  // Segnaposto delle foto (diario e tracce impianti)
  function drawPins(ctx, v, pins) {
    for (const pin of pins) {
      const x = v.x + pin.x * v.s, y = v.y + pin.y * v.s;
      ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF'; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = pin.type === 'tracce' ? '#C2410C' : '#1F4FD1'; ctx.stroke();
      // fotocamera
      ctx.beginPath(); ctx.rect(x - 6, y - 3.5, 12, 8); ctx.moveTo(x - 2.5, y - 3.5); ctx.lineTo(x - 1.5, y - 5.5); ctx.lineTo(x + 1.5, y - 5.5); ctx.lineTo(x + 2.5, y - 3.5);
      ctx.lineWidth = 1.4; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y + 0.5, 2.3, 0, Math.PI * 2); ctx.stroke();
      if (pin.count > 1) {
        ctx.beginPath(); ctx.arc(x + 10, y - 10, 7, 0, Math.PI * 2); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '700 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(pin.count), x + 10, y - 9.5);
      }
    }
  }

  CM.render2 = { drawUnderlay, drawFurniture, drawFixtures, drawPins, symbol, hexAlpha };
})(typeof window !== 'undefined' ? window : globalThis);
