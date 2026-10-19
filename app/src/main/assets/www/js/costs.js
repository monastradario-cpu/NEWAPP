/* Casa Mia — librerie utente, finiture, costi, norme e controlli d'ingombro */
(function (root) {
  'use strict';
  const CM = root.CM;
  const P = CM.plan, G = CM.geom;
  const S = () => CM.store;

  /* ---------- Librerie dell'utente (prezzi, materiali, catalogo) ---------- */
  const L = CM.lib = {
    prices() {
      const ov = (S() && S().getJSON('prezzi', {})) || {};
      const out = {};
      for (const k in CM.PRICES_BASE) out[k] = Object.assign({}, CM.PRICES_BASE[k], ov[k] || {});
      return out;
    },
    setPrice(key, mat, lab) {
      const ov = S().getJSON('prezzi', {});
      ov[key] = { mat, lab };
      S().putJSON('prezzi', ov);
    },
    resetPrices() { S().putJSON('prezzi', {}); },
    materials() { return CM.MATERIALS_BASE.concat((S() && S().getJSON('materiali', [])) || []); },
    material(id) { return L.materials().find(m => m.id === id) || null; },
    saveMaterial(m) {
      const list = S().getJSON('materiali', []).filter(x => x.id !== m.id);
      list.push(m); S().putJSON('materiali', list);
    },
    removeMaterial(id) { S().putJSON('materiali', S().getJSON('materiali', []).filter(x => x.id !== id)); },
    catalog() { return CM.FURNITURE_BASE.concat((S() && S().getJSON('catalogo', [])) || []); },
    item(id) { return L.catalog().find(i => i.id === id) || null; },
    saveItem(it) {
      const list = S().getJSON('catalogo', []).filter(x => x.id !== it.id);
      list.push(it); S().putJSON('catalogo', list);
    },
    removeItem(id) { S().putJSON('catalogo', S().getJSON('catalogo', []).filter(x => x.id !== id)); }
  };

  /* ---------- Finiture di una stanza ---------- */
  const FN = CM.finish = {};

  function tileCalc(mat, area, pose, prices, isWall) {
    const waste = (CM.POSE[pose] || CM.POSE.dritta).waste;
    const out = { mat, area, pose, waste, buyArea: area * (1 + waste), boxes: 0, matCost: 0, lab: 0, extras: [] };
    if (!mat || area <= 0) return out;
    if (mat.type === 'resina') {
      out.matCost = area * (mat.price || 0);
      out.lab = area * (prices.posa_resina.lab || 0);
      out.buyArea = area;
      return out;
    }
    const boxM2 = mat.boxM2 || 1;
    out.boxes = Math.ceil(out.buyArea / boxM2);
    out.matCost = out.boxes * boxM2 * (mat.price || 0);
    const posaKey = isWall ? 'posa_rivestimento' : (mat.type === 'parquet' ? 'posa_parquet' : 'posa_piastrelle');
    out.lab = area * (prices[posaKey].lab || 0) + area * (prices[posaKey].mat || 0);
    if (mat.type === 'piastrella') {
      const sacchi = Math.ceil(area * 4 / 25); // ~4 kg/m² di colla, sacchi da 25 kg
      const kgStucco = Math.ceil(area * 0.4);   // ~0,4 kg/m² di stucco
      out.extras.push({ label: 'Colla', qty: sacchi, unit: 'sacchi da 25 kg', cost: sacchi * prices.colla.mat });
      out.extras.push({ label: 'Stucco per fughe', qty: kgStucco, unit: 'kg', cost: kgStucco * prices.stucco.mat });
      out.extras.push({ label: 'Distanziatori', qty: Math.ceil(area / 10), unit: 'confezioni', cost: Math.ceil(area / 10) * 4 });
      out.matCost += out.extras.reduce((s, e) => s + e.cost, 0);
    }
    return out;
  }

  FN.room = function (plan, roomId, prices) {
    prices = prices || L.prices();
    const room = plan.rooms[roomId];
    const f = room.finish || {};
    const st = P.roomStats(plan, room);
    const ws = P.roomWallSurface(plan, room);
    const res = { room, stats: st, walls: ws, items: [] };

    // Pavimento
    if (f.floor && f.floor.mat) {
      const mat = L.material(f.floor.mat);
      const t = tileCalc(mat, st.net, f.floor.pose || 'dritta', prices, false);
      res.floor = t;
      if (f.baseboard !== false && mat) {
        res.baseboard = { m: ws.baseboard, mat: ws.baseboard * prices.battiscopa.mat, lab: ws.baseboard * prices.battiscopa.lab };
      }
    }
    // Rivestimento a parete (bagno, cucina)
    let cladArea = 0;
    if (f.cladding && f.cladding.mat && f.cladding.height > 0) {
      const mat = L.material(f.cladding.mat);
      const hc = Math.min(f.cladding.height, ws.height);
      cladArea = ws.perimeter * hc - ws.openArea * Math.min(1, hc / ws.height);
      if (f.cladding.walls && f.cladding.walls.length) cladArea *= Math.min(1, f.cladding.walls.length / Math.max(1, P.roomWalls(plan, room).length));
      cladArea = Math.max(0, cladArea);
      res.cladding = tileCalc(mat, cladArea, f.cladding.pose || 'dritta', prices, true);
    }
    // Carta da parati
    let paperArea = 0;
    if (f.wallpaper && f.wallpaper.mat) {
      const mat = L.material(f.wallpaper.mat);
      if (mat) {
        const share = f.wallpaper.share || 1; // frazione di pareti (1 = tutte)
        const width = ws.perimeter * share;
        const strips = Math.ceil(width / (mat.rollW || 0.53));
        const perRoll = Math.max(1, Math.floor((mat.rollL || 10.05) / (ws.height + (mat.repeat || 0))));
        const rolls = Math.ceil(strips / perRoll);
        paperArea = Math.max(0, width * ws.height - ws.openArea * share);
        res.wallpaper = { mat, rolls, area: paperArea, matCost: rolls * (mat.price || 0), lab: rolls * prices.carta_lab.lab };
      }
    }
    // Pittura (pareti non rivestite + soffitto)
    if (f.paint && f.paint.mat) {
      const mat = L.material(f.paint.mat);
      if (mat) {
        const coats = f.paint.coats || 2;
        const wallArea = Math.max(0, ws.net - cladArea - paperArea);
        const area = wallArea + (f.paint.ceiling === false ? 0 : st.net);
        const liters = area * coats / (mat.resa || 10);
        const cans = Math.ceil(liters / (mat.canL || 5));
        res.paint = { mat, coats, area, wallArea, liters, cans, matCost: cans * (mat.canL || 5) * (mat.price || 0), lab: area * prices.pittura_lab.lab };
      }
    }
    return res;
  };

  /* ---------- Costi ---------- */
  const C = CM.costs = {};
  const OPENING_PRICE = { battente: 'porta_battente', scorrevole: 'porta_scorrevole', scomparsa: 'porta_scomparsa', finestra: 'finestra', portafinestra: 'portafinestra', arco: 'arco' };

  C.compute = function (project, plan) {
    plan = plan || CM.project.plan(project);
    const prices = L.prices();
    const lines = [];
    const add = (group, label, qty, unit, mat, lab, room, extra) => lines.push(Object.assign({ group, label, qty, unit, mat: mat || 0, lab: lab || 0, total: (mat || 0) + (lab || 0), room: room || null }, extra || {}));

    // Opere edili
    let demArea = 0;
    for (const id in plan.walls) {
      const w = plan.walls[id];
      const len = P.wallLen(plan, w), a = len * (w.h || 2.7);
      if (w.state === 'demolire') demArea += a;
      if (w.state === 'nuovo') add('Opere edili', 'Nuovo tramezzo ' + CM.fmt.m(len), a, 'm²', a * prices.tramezzo.mat, a * prices.tramezzo.lab);
    }
    if (demArea > 0) {
      add('Opere edili', 'Demolizione tramezzi', demArea, 'm²', 0, demArea * prices.demolizione.lab);
      add('Opere edili', 'Smaltimento macerie', demArea, 'm²', 0, demArea * prices.smaltimento.lab);
    }
    // Serramenti nuovi o da sostituire
    for (const id in plan.openings) {
      const op = plan.openings[id];
      if (op.state !== 'nuova' && op.state !== 'sostituire') continue;
      const pr = prices[OPENING_PRICE[op.kind]];
      const perM2 = pr.unit === '€/m²';
      const q = perM2 ? op.w * op.h : 1;
      add('Serramenti', CM.OPENINGS[op.kind].label + ' ' + CM.fmt.cm(op.w) + (op.state === 'sostituire' ? ' (sostituzione)' : ''), q, perM2 ? 'm²' : 'cad', q * pr.mat, q * pr.lab);
    }
    // Impianti
    const fixCount = {};
    for (const id in plan.fixtures) {
      const fx = plan.fixtures[id];
      if (fx.state === 'esistente') continue;
      fixCount[fx.kind] = (fixCount[fx.kind] || 0) + 1;
    }
    for (const k in fixCount) {
      const def = CM.FIXTURES[k], pr = prices[def.price];
      add('Impianti', def.label, fixCount[k], 'cad', fixCount[k] * pr.mat, fixCount[k] * pr.lab);
    }
    // Finiture per stanza
    for (const rid in plan.rooms) {
      const r = FN.room(plan, rid, prices);
      const name = plan.rooms[rid].name;
      if (r.floor && r.floor.mat) add('Finiture', 'Pavimento ' + r.floor.mat.name, r.floor.area, 'm²', r.floor.matCost, r.floor.lab, rid, { detail: r.floor.boxes ? r.floor.boxes + ' scatole' : '' });
      if (r.baseboard) add('Finiture', 'Battiscopa', r.baseboard.m, 'm', r.baseboard.mat, r.baseboard.lab, rid);
      if (r.cladding && r.cladding.mat) add('Finiture', 'Rivestimento ' + r.cladding.mat.name, r.cladding.area, 'm²', r.cladding.matCost, r.cladding.lab, rid, { detail: r.cladding.boxes + ' scatole' });
      if (r.wallpaper) add('Finiture', 'Carta da parati ' + r.wallpaper.mat.name, r.wallpaper.rolls, 'rotoli', r.wallpaper.matCost, r.wallpaper.lab, rid);
      if (r.paint) add('Finiture', 'Pittura ' + r.paint.mat.name, r.paint.area, 'm²', r.paint.matCost, r.paint.lab, rid, { detail: CM.fmt.num(r.paint.liters, 1) + ' L · ' + r.paint.cans + ' latte' });
      void name;
    }
    // Arredamento
    let noPrice = 0;
    for (const id in plan.furniture) {
      const f = plan.furniture[id];
      const rid = P.roomOf(plan, f);
      if (f.price == null || f.price === '') { noPrice++; continue; }
      add('Arredamento', f.name, 1, 'cad', +f.price, 0, rid, { store: f.store, fid: id });
    }

    const sum = (arr, k) => arr.reduce((s, l) => s + l[k], 0);
    const groups = {};
    for (const l of lines) {
      if (!groups[l.group]) groups[l.group] = { mat: 0, lab: 0, total: 0, lines: [] };
      const g = groups[l.group]; g.mat += l.mat; g.lab += l.lab; g.total += l.total; g.lines.push(l);
    }
    const byRoom = {};
    for (const l of lines) if (l.room) byRoom[l.room] = (byRoom[l.room] || 0) + l.total;
    // Preventivi scelti: sostituiscono la stima della loro voce
    const chosen = {};
    for (const q of project.quotes || []) if (q.chosen) chosen[q.group] = (chosen[q.group] || 0) + (+q.amount || 0);
    let withQuotes = 0;
    for (const g in groups) withQuotes += chosen[g] != null ? chosen[g] : groups[g].total;
    for (const g in chosen) if (!groups[g]) withQuotes += chosen[g];
    return { lines, groups, byRoom, mat: sum(lines, 'mat'), lab: sum(lines, 'lab'), total: sum(lines, 'total'), noPrice, withQuotes, chosen };
  };

  C.GROUPS = ['Opere edili', 'Serramenti', 'Impianti', 'Finiture', 'Arredamento'];
  CM.fmt.eur = (v) => (isFinite(v) ? Math.round(v).toLocaleString('it-IT') : '–') + ' €';

  /* ---------- Norme (indicative) ---------- */
  const N = CM.norms = {};
  const ABITABILI = ['soggiorno', 'cucina', 'camera', 'cameretta', 'studio'];
  const ACCESSORI = ['bagno', 'corridoio', 'ingresso', 'ripostiglio', 'lavanderia'];
  N.check = function (plan) {
    const out = [];
    for (const id in plan.rooms) {
      const r = plan.rooms[id];
      if (r.type === 'balcone' || r.type === 'altro') continue;
      const st = P.roomStats(plan, r);
      const h = r.h || 2.7;
      const push = (text) => out.push({ room: id, text });
      if (r.type === 'camera' && st.net < 14) push(r.name + ': ' + CM.fmt.area(st.net) + ', sotto i 14 m² previsti per una camera doppia (9 m² per una singola).');
      if (r.type === 'cameretta' && st.net < 9) push(r.name + ': ' + CM.fmt.area(st.net) + ', sotto i 9 m² previsti per una camera singola.');
      if (r.type === 'soggiorno' && st.net < 14) push(r.name + ': ' + CM.fmt.area(st.net) + ', sotto i 14 m² previsti per il soggiorno.');
      if (ABITABILI.includes(r.type) && h < 2.7 - 1e-6) push(r.name + ': altezza ' + CM.fmt.cm(h) + ', sotto i 270 cm previsti per i locali abitabili.');
      if (ACCESSORI.includes(r.type) && h < 2.4 - 1e-6) push(r.name + ': altezza ' + CM.fmt.cm(h) + ', sotto i 240 cm previsti per bagni e corridoi.');
      const walls = P.roomWalls(plan, r);
      let win = 0;
      for (const oid in plan.openings) {
        const op = plan.openings[oid];
        if (walls.includes(op.wall) && (op.kind === 'finestra' || op.kind === 'portafinestra')) win += op.w * op.h;
      }
      if (ABITABILI.includes(r.type) && win < st.net / 8 - 1e-6) push(r.name + ': finestre ' + CM.fmt.area(win) + ', sotto 1/8 del pavimento (' + CM.fmt.area(st.net / 8) + ').');
      if (r.type === 'bagno' && win === 0) push(r.name + ': senza finestra serve un’aerazione forzata.');
    }
    return out;
  };
  N.NOTE = 'Valori indicativi del D.M. 5 luglio 1975: verifica sempre con il tecnico e con il regolamento edilizio del tuo comune.';

  /* ---------- Controlli d'ingombro dell'arredo ---------- */
  function axes(poly) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const nx = -(b.y - a.y), ny = b.x - a.x, l = Math.hypot(nx, ny) || 1;
      out.push({ x: nx / l, y: ny / l });
    }
    return out;
  }
  function project(poly, ax) {
    let mn = Infinity, mx = -Infinity;
    for (const p of poly) { const v = p.x * ax.x + p.y * ax.y; if (v < mn) mn = v; if (v > mx) mx = v; }
    return [mn, mx];
  }
  // Sovrapposizione di poligoni convessi (SAT), con tolleranza
  function overlap(a, b, tol) {
    for (const ax of axes(a).concat(axes(b))) {
      const [a0, a1] = project(a, ax), [b0, b1] = project(b, ax);
      if (a1 <= b0 + tol || b1 <= a0 + tol) return false;
    }
    return true;
  }
  function polyDist(a, b) {
    if (overlap(a, b, 0)) return 0;
    let d = Infinity;
    for (const p of a) for (let i = 0; i < b.length; i++) d = Math.min(d, G.projSeg(p, b[i], b[(i + 1) % b.length]).d);
    for (const p of b) for (let i = 0; i < a.length; i++) d = Math.min(d, G.projSeg(p, a[i], a[(i + 1) % a.length]).d);
    return d;
  }
  CM.polyOverlap = overlap;

  // Settore di apertura di una porta a battente
  function doorSector(plan, op) {
    const g = P.openingGeom(plan, op);
    if (!g) return null;
    const side = op.flipSide ? -1 : 1;
    const nn = { x: g.n.x * side, y: g.n.y * side };
    const hs = op.flipHinge ? 1 : -1;
    const hinge = { x: g.c.x + g.u.x * hs * op.w / 2 + nn.x * g.t / 2, y: g.c.y + g.u.y * hs * op.w / 2 + nn.y * g.t / 2 };
    const pts = [hinge];
    const u = { x: -g.u.x * hs, y: -g.u.y * hs };
    for (let k = 0; k <= 6; k++) {
      const a = (Math.PI / 2) * k / 6;
      pts.push({ x: hinge.x + (u.x * Math.cos(a) + nn.x * Math.sin(a)) * op.w, y: hinge.y + (u.y * Math.cos(a) + nn.y * Math.sin(a)) * op.w });
    }
    return pts;
  }
  CM.doorSector = doorSector;

  const SMALL = ['chair', 'rug', 'lamp_ceiling', 'picture', 'mirror', 'tv', 'curtain', 'plant', 'lamp_floor', 'umbrella', 'tree', 'pergola'];
  CM.checks = {
    furniture(plan) {
      const res = {};
      const warn = (id, t) => { (res[id] = res[id] || []).push(t); };
      const ids = Object.keys(plan.furniture);
      const poly = {}, zr = {};
      for (const id of ids) { const f = plan.furniture[id]; poly[id] = P.furnitureCorners(f); zr[id] = [f.elev || 0, (f.elev || 0) + (f.h || 0)]; }
      const onFloor = (f) => f.shape !== 'rug' && f.shape !== 'lamp_ceiling' && f.shape !== 'picture' && f.shape !== 'curtain';
      for (let i = 0; i < ids.length; i++) {
        const a = plan.furniture[ids[i]];
        // fuori dalle stanze (gli esterni possono stare ovunque)
        if (a.cat !== 'esterni' && Object.keys(plan.rooms).length) {
          const out = poly[ids[i]].some(c => !P.roomOf(plan, c));
          if (out) warn(ids[i], 'Esce dalla stanza o attraversa un muro');
        }
        for (let j = i + 1; j < ids.length; j++) {
          const b = plan.furniture[ids[j]];
          if (!onFloor(a) || !onFloor(b)) continue;
          const zOver = zr[ids[i]][0] < zr[ids[j]][1] - 0.01 && zr[ids[j]][0] < zr[ids[i]][1] - 0.01;
          if (zOver && overlap(poly[ids[i]], poly[ids[j]], 0.01)) {
            warn(ids[i], 'Si sovrappone a ' + b.name); warn(ids[j], 'Si sovrappone a ' + a.name);
            continue;
          }
          if (SMALL.includes(a.shape) || SMALL.includes(b.shape) || a.elev > 0.3 || b.elev > 0.3) continue;
          if (a.w * a.d < 0.35 || b.w * b.d < 0.35) continue;
          const d = polyDist(poly[ids[i]], poly[ids[j]]);
          if (d > 0.05 && d < 0.6 && P.roomOf(plan, a) === P.roomOf(plan, b)) {
            const t = 'Passaggio stretto (' + CM.fmt.cm(d) + ') con ' + b.name;
            warn(ids[i], t); warn(ids[j], 'Passaggio stretto (' + CM.fmt.cm(d) + ') con ' + a.name);
          }
        }
      }
      // porte bloccate
      for (const oid in plan.openings) {
        const op = plan.openings[oid];
        if (op.kind !== 'battente' && op.kind !== 'portafinestra') continue;
        const sec = doorSector(plan, op);
        if (!sec) continue;
        for (const id of ids) {
          const f = plan.furniture[id];
          if (!onFloor(f) || (f.elev || 0) > 2.0) continue;
          if (overlap(sec, poly[id], 0.01)) warn(id, 'Blocca l’apertura di una porta');
        }
      }
      return res;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
