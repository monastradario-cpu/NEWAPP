/* Casa Mia — nucleo: utilità, geometria, modello della pianta, progetto.
   Funziona sia nel browser (window.CM) sia in Node (per i test). */
(function (root) {
  'use strict';
  const CM = root.CM || (root.CM = {});
  root.CasaMia = CM; // nome usato dal guscio Android (tasto indietro, salvataggio)

  /* ---------- Utilità ---------- */
  let idCounter = 0;
  CM.uid = function (prefix) {
    idCounter = (idCounter + 1) % 1679616;
    return (prefix || '') + Date.now().toString(36) + idCounter.toString(36) + Math.random().toString(36).slice(2, 6);
  };
  const r3 = (v) => Math.round(v * 1000) / 1000; // precisione al millimetro
  CM.r3 = r3;
  CM.clone = (o) => JSON.parse(JSON.stringify(o));

  const fmt = CM.fmt = {
    num(v, dec) {
      if (!isFinite(v)) return '–';
      return v.toFixed(dec).replace('.', ',');
    },
    m(v) { return fmt.num(v, 2) + ' m'; },
    cm(v) { return Math.round(v * 100) + ' cm'; },
    area(v) { return fmt.num(v, 1) + ' m²'; },
    // "3,8" "3.80" "380cm" → metri
    parseM(str, unit) {
      if (str == null) return NaN;
      let s = String(str).trim().toLowerCase().replace(/\s+/g, '').replace(',', '.');
      let u = unit || 'm';
      if (s.endsWith('cm')) { u = 'cm'; s = s.slice(0, -2); } else if (s.endsWith('m')) { u = 'm'; s = s.slice(0, -1); }
      const v = parseFloat(s);
      if (!isFinite(v)) return NaN;
      return u === 'cm' ? v / 100 : v;
    }
  };

  // true se la versione a (es. "0.1.12") è più recente di b
  CM.versionNewer = function (a, b) {
    const pa = String(a || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(b || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const x = pa[i] || 0, y = pb[i] || 0;
      if (x !== y) return x > y;
    }
    return false;
  };

  /* ---------- Geometria ---------- */
  const G = CM.geom = {
    dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); },
    projSeg(p, a, b) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const L2 = dx * dx + dy * dy;
      const t = L2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2 : 0;
      const tc = Math.max(0, Math.min(1, t));
      const q = { x: a.x + dx * tc, y: a.y + dy * tc };
      return { t, tc, q, d: Math.hypot(p.x - q.x, p.y - q.y), L: Math.sqrt(L2) };
    },
    signedArea(pts) {
      let s = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        s += a.x * b.y - b.x * a.y;
      }
      return s / 2;
    },
    centroid(pts) {
      const A = G.signedArea(pts);
      if (Math.abs(A) < 1e-9) {
        const c = pts.reduce((s, p) => ({ x: s.x + p.x, y: s.y + p.y }), { x: 0, y: 0 });
        return { x: c.x / pts.length, y: c.y / pts.length };
      }
      let cx = 0, cy = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const f = a.x * b.y - b.x * a.y;
        cx += (a.x + b.x) * f; cy += (a.y + b.y) * f;
      }
      return { x: cx / (6 * A), y: cy / (6 * A) };
    },
    inPoly(p, pts) {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i], b = pts[j];
        if (((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) inside = !inside;
      }
      return inside;
    },
    snap(v, step) { return Math.round(v / step) * step; },
    // Punto interno "buono" per l'etichetta (centroide se interno, altrimenti un punto interno)
    labelPoint(pts) {
      const c = G.centroid(pts);
      if (G.inPoly(c, pts)) return c;
      let best = pts[0], bestD = -1;
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      for (let i = 1; i < 12; i++) for (let j = 1; j < 12; j++) {
        const p = { x: minX + (maxX - minX) * i / 12, y: minY + (maxY - minY) * j / 12 };
        if (!G.inPoly(p, pts)) continue;
        let d = Infinity;
        for (let k = 0; k < pts.length; k++) d = Math.min(d, G.projSeg(p, pts[k], pts[(k + 1) % pts.length]).d);
        if (d > bestD) { bestD = d; best = p; }
      }
      return best;
    }
  };

  /* ---------- Cataloghi ---------- */
  CM.ROOM_TYPES = [
    { id: 'soggiorno', label: 'Soggiorno', fill: '#F3EEE4' },
    { id: 'cucina', label: 'Cucina', fill: '#EDF1E8' },
    { id: 'camera', label: 'Camera da letto', fill: '#ECEFF6' },
    { id: 'cameretta', label: 'Cameretta', fill: '#EEEDF6' },
    { id: 'bagno', label: 'Bagno', fill: '#E7F0F2' },
    { id: 'corridoio', label: 'Corridoio', fill: '#F3F2EE' },
    { id: 'ingresso', label: 'Ingresso', fill: '#F3F2EE' },
    { id: 'studio', label: 'Studio', fill: '#F1EDF3' },
    { id: 'ripostiglio', label: 'Ripostiglio', fill: '#F0EFEA' },
    { id: 'lavanderia', label: 'Lavanderia', fill: '#E7F0F2' },
    { id: 'balcone', label: 'Balcone / terrazzo', fill: '#EBF1E6', outdoor: true },
    { id: 'veranda', label: 'Veranda', fill: '#EEF1EA', outdoor: true },
    { id: 'giardino', label: 'Giardino', fill: '#E3EDD9', outdoor: true },
    { id: 'piscina', label: 'Piscina', fill: '#D5E8EF', outdoor: true },
    { id: 'box', label: 'Box / posto auto', fill: '#ECEBE7', outdoor: true },
    { id: 'altro', label: 'Altro', fill: '#F3F2EE' }
  ];
  CM.roomType = (id) => CM.ROOM_TYPES.find(t => t.id === id) || CM.ROOM_TYPES[CM.ROOM_TYPES.length - 1];

  CM.OPENINGS = {
    battente: { label: 'Porta a battente', w: 0.8, h: 2.1, sill: 0, door: true },
    scorrevole: { label: 'Porta scorrevole esterno muro', w: 0.8, h: 2.1, sill: 0, door: true },
    scomparsa: { label: 'Porta a scomparsa', w: 0.8, h: 2.1, sill: 0, door: true },
    finestra: { label: 'Finestra', w: 1.2, h: 1.4, sill: 0.9 },
    portafinestra: { label: 'Portafinestra', w: 1.2, h: 2.3, sill: 0 },
    arco: { label: 'Arco / passaggio', w: 1.0, h: 2.2, sill: 0 }
  };

  CM.WALL_STATES = {
    esistente: { label: 'Esistente', color: '#1B1E22' },
    demolire: { label: 'Da demolire', color: '#E0A800' },
    nuovo: { label: 'Da costruire', color: '#D23B2A' }
  };

  /* ---------- Modello della pianta ---------- */
  const NODE_EPS = 0.005; // 5 mm
  const P = CM.plan = {};

  P.create = () => ({ nodes: {}, walls: {}, rooms: {}, openings: {}, columns: {}, beams: {}, furniture: {}, fixtures: {}, underlay: null });

  // Completa piante salvate con versioni precedenti
  P.normalize = function (plan) {
    for (const k of ['nodes', 'walls', 'rooms', 'openings', 'columns', 'beams', 'furniture', 'fixtures']) if (!plan[k]) plan[k] = {};
    if (plan.underlay === undefined) plan.underlay = null;
    for (const id in plan.openings) if (!plan.openings[id].state) plan.openings[id].state = 'esistente';
    for (const id in plan.rooms) if (!plan.rooms[id].finish) plan.rooms[id].finish = {};
    return plan;
  };

  /* ----- Mobili ----- */
  P.furnitureCorners = function (f) {
    const c = Math.cos(f.rot || 0), s = Math.sin(f.rot || 0);
    const hw = f.w / 2, hd = f.d / 2;
    return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, y]) => ({ x: f.x + x * c - y * s, y: f.y + x * s + y * c }));
  };
  P.addFurniture = function (plan, item, x, y, rot) {
    const id = CM.uid('f');
    plan.furniture[id] = {
      item: item.id || null, name: item.name, cat: item.cat || 'altro', shape: item.shape || 'box',
      x: r3(x), y: r3(y), w: item.w, d: item.d, h: item.h, elev: item.elev || 0, rot: rot || 0,
      color: item.color || '#D9D4CB', price: item.price != null ? item.price : null, store: item.store || '',
      url: item.url || '', img: item.img || '', light: !!item.light
    };
    // finiture, modello 3D del negozio e composizioni (PAX, cucine\u2026)
    for (const k of ['fabric', 'wood', 'metal', 'model', 'system', 'modules', 'front', 'handle', 'worktop', 'body', 'components', 'mount']) if (item[k] != null) plan.furniture[id][k] = CM.clone(item[k]);
    return id;
  };
  P.pointInFurniture = function (f, p) {
    const c = Math.cos(-(f.rot || 0)), s = Math.sin(-(f.rot || 0));
    const dx = p.x - f.x, dy = p.y - f.y;
    const lx = dx * c - dy * s, ly = dx * s + dy * c;
    return Math.abs(lx) <= f.w / 2 && Math.abs(ly) <= f.d / 2;
  };

  /* ----- Impianti ----- */
  P.addFixture = function (plan, kind, x, y) {
    const id = CM.uid('i');
    plan.fixtures[id] = { kind, x: r3(x), y: r3(y), rot: 0, state: 'nuovo' };
    return id;
  };

  /* ----- Stanza: muri sul perimetro e superfici ----- */
  P.roomWalls = function (plan, room) {
    if (typeof room === 'string') room = plan.rooms[room];
    return Object.keys(plan.walls).filter(id => {
      const w = plan.walls[id];
      const A = plan.nodes[w.a], B = plan.nodes[w.b];
      if (!A || !B) return false;
      return [A, B, { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }].every(p => P.pointOnRoomBoundary(plan, room, p));
    });
  };
  P.roomOf = function (plan, p) {
    let best = null, bestA = Infinity;
    for (const id in plan.rooms) {
      const pts = P.roomPts(plan, plan.rooms[id]);
      if (pts.length >= 3 && G.inPoly(p, pts)) { const a = Math.abs(G.signedArea(pts)); if (a < bestA) { bestA = a; best = id; } }
    }
    return best;
  };
  // Superficie delle pareti interne di una stanza (netta delle aperture) e lunghezza utile del battiscopa
  P.roomWallSurface = function (plan, room) {
    if (typeof room === 'string') room = plan.rooms[room];
    const st = P.roomStats(plan, room);
    const h = room.h || 2.7;
    let openArea = 0, doorWidth = 0;
    const walls = P.roomWalls(plan, room);
    for (const oid in plan.openings) {
      const op = plan.openings[oid];
      if (!walls.includes(op.wall)) continue;
      openArea += op.w * Math.min(op.h, h);
      if (op.kind !== 'finestra') doorWidth += op.w;
    }
    // perimetro interno approssimato: perimetro netto dalla superficie netta (stessa forma)
    const ratio = st.gross > 0 ? Math.sqrt(st.net / st.gross) : 1;
    const perim = st.perimeter * ratio;
    return { perimeter: perim, height: h, gross: perim * h, net: Math.max(0, perim * h - openArea), baseboard: Math.max(0, perim - doorWidth), openArea, ceiling: st.net, floor: st.net };
  };

  // Superficie di un singolo muro, per faccia (lunghezza sull'asse x altezza)
  P.wallSurface = function (plan, wid) {
    const w = plan.walls[wid];
    const L = P.wallLen(plan, w), h = w.h || 2.7;
    let openings = 0, n = 0;
    for (const oid in plan.openings) {
      const op = plan.openings[oid];
      if (op.wall !== wid) continue;
      const bottom = op.kind === 'finestra' ? (op.sill || 0) : 0;
      openings += op.w * Math.max(0, Math.min(h, bottom + op.h) - bottom);
      n++;
    }
    return { L, h, gross: L * h, openings, net: Math.max(0, L * h - openings), count: n };
  };

  // Totali delle superfici interne della casa (esclusi gli esterni)
  P.surfaceTotals = function (plan) {
    const t = { wallsGross: 0, wallsNet: 0, openings: 0, ceilings: 0, floors: 0, rooms: 0 };
    for (const id in plan.rooms) {
      if (CM.roomType(plan.rooms[id].type).outdoor) continue;
      const s = P.roomWallSurface(plan, id);
      t.wallsGross += s.gross; t.wallsNet += s.net; t.openings += s.openArea; t.ceilings += s.ceiling; t.floors += s.floor; t.rooms++;
    }
    return t;
  };

  P.addNode = function (plan, x, y) {
    const id = CM.uid('n');
    plan.nodes[id] = { x: r3(x), y: r3(y) };
    return id;
  };

  P.nodeAt = function (plan, x, y, eps) {
    eps = eps == null ? NODE_EPS : eps;
    let best = null, bestD = eps;
    for (const id in plan.nodes) {
      const n = plan.nodes[id];
      const d = Math.hypot(n.x - x, n.y - y);
      if (d <= bestD) { best = id; bestD = d; }
    }
    return best;
  };

  P.findWall = function (plan, a, b) {
    for (const id in plan.walls) {
      const w = plan.walls[id];
      if ((w.a === a && w.b === b) || (w.a === b && w.b === a)) return id;
    }
    return null;
  };

  P.wallsOfNode = function (plan, nid) {
    const out = [];
    for (const id in plan.walls) { const w = plan.walls[id]; if (w.a === nid || w.b === nid) out.push(id); }
    return out;
  };

  P.wallEnds = function (plan, w) { return [plan.nodes[w.a], plan.nodes[w.b]]; };

  // Le due facce di un muro (lato +normale e lato −normale) con la loro lunghezza vera:
  // la faccia interna di un angolo è più corta dell'asse, quella esterna più lunga.
  P.wallFaces = function (plan, id) {
    const w = plan.walls[id];
    if (!w) return [];
    const A = plan.nodes[w.a], B = plan.nodes[w.b];
    const L = G.dist(A, B);
    if (L < 1e-6) return [];
    const u = { x: (B.x - A.x) / L, y: (B.y - A.y) / L }, n = { x: -u.y, y: u.x };
    const h = (w.t || 0.1) / 2;
    const cross = (a, b) => a.x * b.y - a.y * b.x, dot = (a, b) => a.x * b.x + a.y * b.y;
    // parametro lungo l'asse dove la faccia (lato s) incontra il muro vicino al nodo
    const trim = (nid, s, atStart) => {
      const N = plan.nodes[nid];
      const dir = atStart ? u : { x: -u.x, y: -u.y };
      const side = { x: n.x * s, y: n.y * s };
      let best = null, bestPhi = Infinity;
      for (const oid of P.wallsOfNode(plan, nid)) {
        if (oid === id) continue;
        const o = plan.walls[oid];
        const other = plan.nodes[o.a === nid ? o.b : o.a];
        const ol = G.dist(N, other); if (ol < 1e-6) continue;
        const d = { x: (other.x - N.x) / ol, y: (other.y - N.y) / ol };
        let phi = Math.atan2(dot(d, side), dot(d, dir)); if (phi <= 1e-6) phi += Math.PI * 2;
        if (phi < bestPhi) { bestPhi = phi; best = { d, t: o.t || 0.1 }; }
      }
      const base = atStart ? 0 : L;
      if (!best) return base;
      const d = best.d;
      if (Math.abs(cross(dir, d)) < 1e-3) return base; // muro che prosegue dritto
      const no = { x: -d.y, y: d.x };
      const so = (dot(no, dir) > 0 ? 1 : -1) * (dot(d, side) >= 0 ? 1 : -1);
      // faccia del muro vicino rivolta verso il nostro lato
      const P0 = { x: A.x + side.x * h, y: A.y + side.y * h };
      const Q0 = { x: N.x + no.x * so * best.t / 2, y: N.y + no.y * so * best.t / 2 };
      const den = cross(u, d);
      const t = cross({ x: Q0.x - P0.x, y: Q0.y - P0.y }, d) / den;
      return isFinite(t) && Math.abs(t - base) < 3 ? t : base;
    };
    const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    return [1, -1].map(s => {
      const t0 = trim(w.a, s, true), t1 = trim(w.b, s, false);
      const off = { x: n.x * s * h, y: n.y * s * h };
      const room = P.roomOf(plan, { x: mid.x + n.x * s * (h + 0.06), y: mid.y + n.y * s * (h + 0.06) });
      return { side: s, len: Math.max(0, t1 - t0), a: { x: A.x + u.x * t0 + off.x, y: A.y + u.y * t0 + off.y }, b: { x: A.x + u.x * t1 + off.x, y: A.y + u.y * t1 + off.y }, room };
    });
  };
  P.wallLen = function (plan, w) {
    if (typeof w === 'string') w = plan.walls[w];
    return G.dist(plan.nodes[w.a], plan.nodes[w.b]);
  };

  // Muro su cui giace (strettamente all'interno) il punto
  P.wallUnder = function (plan, x, y, eps, exceptNode) {
    eps = eps == null ? NODE_EPS : eps;
    let best = null, bestD = eps;
    for (const id in plan.walls) {
      const w = plan.walls[id];
      if (exceptNode && (w.a === exceptNode || w.b === exceptNode)) continue;
      const A = plan.nodes[w.a], B = plan.nodes[w.b];
      const pr = G.projSeg({ x, y }, A, B);
      const fromEnds = Math.min(pr.tc * pr.L, (1 - pr.tc) * pr.L);
      if (pr.d <= bestD && pr.t > 0 && pr.t < 1 && fromEnds > NODE_EPS) { best = { wid: id, t: pr.t, q: pr.q }; bestD = pr.d; }
    }
    return best;
  };

  P.splitWall = function (plan, wid, nid) {
    const w = plan.walls[wid];
    const A = plan.nodes[w.a];
    const N = plan.nodes[nid];
    const dAN = G.dist(A, N);
    const id2 = CM.uid('w');
    plan.walls[id2] = Object.assign({}, w, { a: nid, b: w.b });
    w.b = nid;
    for (const oid in plan.openings) {
      const op = plan.openings[oid];
      if (op.wall === wid && op.pos > dAN) { op.wall = id2; op.pos = r3(op.pos - dAN); }
    }
    return id2;
  };

  P.getOrCreateNode = function (plan, x, y) {
    const existing = P.nodeAt(plan, x, y);
    if (existing) return existing;
    const id = P.addNode(plan, x, y);
    const hit = P.wallUnder(plan, x, y, NODE_EPS, id);
    if (hit) P.splitWall(plan, hit.wid, id);
    return id;
  };

  // Aggiunge un muro da a a b gestendo incroci a T e sovrapposizioni con muri esistenti
  P.addWall = function (plan, na, nb, props) {
    if (na === nb) return [];
    props = props || {};
    for (const id of [na, nb]) {
      const n = plan.nodes[id];
      const hit = P.wallUnder(plan, n.x, n.y, NODE_EPS, id);
      if (hit) P.splitWall(plan, hit.wid, id);
    }
    const A = plan.nodes[na], B = plan.nodes[nb];
    const inner = [];
    for (const id in plan.nodes) {
      if (id === na || id === nb) continue;
      const pr = G.projSeg(plan.nodes[id], A, B);
      if (pr.d < NODE_EPS && pr.t > 0 && pr.t < 1 && Math.min(pr.t, 1 - pr.t) * pr.L > NODE_EPS) inner.push({ id, t: pr.t });
    }
    inner.sort((p, q) => p.t - q.t);
    const chain = [na].concat(inner.map(i => i.id), [nb]);
    const created = [];
    for (let i = 0; i < chain.length - 1; i++) {
      if (P.findWall(plan, chain[i], chain[i + 1])) continue;
      const id = CM.uid('w');
      plan.walls[id] = {
        a: chain[i], b: chain[i + 1],
        t: props.t != null ? props.t : 0.12,
        h: props.h != null ? props.h : 2.7,
        state: props.state || 'esistente'
      };
      created.push(id);
    }
    return created;
  };

  P.addRectRoom = function (plan, x0, y0, x1, y1, props) {
    props = props || {};
    const xa = Math.min(x0, x1), xb = Math.max(x0, x1), ya = Math.min(y0, y1), yb = Math.max(y0, y1);
    const corners = [[xa, ya], [xb, ya], [xb, yb], [xa, yb]].map(c => P.getOrCreateNode(plan, c[0], c[1]));
    for (let i = 0; i < 4; i++) P.addWall(plan, corners[i], corners[(i + 1) % 4], props.wall);
    const rid = P.addRoom(plan, corners, props);
    // ogni muro ricorda com'era per ciascuna stanza: se due stanze si toccano, il muro in comune
    // resta uno solo, ma si può togliere quello di una stanza e tenere quello dell'altra
    const wp = props.wall || {};
    for (const wid of P.roomWalls(plan, plan.rooms[rid])) {
      const w = plan.walls[wid];
      const by = Object.assign({}, w.byRoom || {});
      if (!w.byRoom) P.wallOwners(plan, wid).filter(r => r !== rid).forEach(o => { by[o] = { t: w.t, h: w.h, state: w.state }; });
      by[rid] = { t: wp.t != null ? wp.t : w.t, h: wp.h != null ? wp.h : w.h, state: wp.state || w.state };
      w.byRoom = by;
    }
    return rid;
  };

  P.addRoom = function (plan, nodeIds, props) {
    props = props || {};
    const id = CM.uid('r');
    const type = props.type || 'altro';
    plan.rooms[id] = {
      nodes: nodeIds.slice(),
      name: props.name || CM.roomType(type).label,
      type,
      h: props.h != null ? props.h : 2.7,
      finish: {}
    };
    return id;
  };

  P.roomPts = function (plan, room) {
    if (typeof room === 'string') room = plan.rooms[room];
    return room.nodes.map(id => plan.nodes[id]).filter(Boolean);
  };

  P.pointOnRoomBoundary = function (plan, room, p) {
    const pts = P.roomPts(plan, room);
    for (let i = 0; i < pts.length; i++) {
      if (G.projSeg(p, pts[i], pts[(i + 1) % pts.length]).d < NODE_EPS) return true;
    }
    return false;
  };

  // Spessore del muro che corre lungo il lato a-b di una stanza (0 se nessun muro)
  P.edgeThickness = function (plan, a, b) {
    let t = 0;
    for (const id in plan.walls) {
      const w = plan.walls[id];
      const A = plan.nodes[w.a], B = plan.nodes[w.b];
      if (G.projSeg(A, a, b).d < NODE_EPS && G.projSeg(B, a, b).d < NODE_EPS) t = Math.max(t, w.t);
    }
    return t;
  };

  P.roomStats = function (plan, room) {
    if (typeof room === 'string') room = plan.rooms[room];
    const pts = P.roomPts(plan, room);
    const n = pts.length;
    if (n < 3) return { gross: 0, net: 0, perimeter: 0 };
    const sA = G.signedArea(pts);
    const gross = Math.abs(sA);
    const orient = Math.sign(sA) || 1;
    const d = [], L = [];
    let perimeter = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      L[i] = G.dist(a, b);
      d[i] = P.edgeThickness(plan, a, b) / 2;
      perimeter += L[i];
    }
    let net = gross;
    for (let i = 0; i < n; i++) net -= L[i] * d[i];
    for (let i = 0; i < n; i++) {
      const prev = (i - 1 + n) % n;
      const P0 = pts[prev], P1 = pts[i], P2 = pts[(i + 1) % n];
      const e1 = { x: P1.x - P0.x, y: P1.y - P0.y }, e2 = { x: P2.x - P1.x, y: P2.y - P1.y };
      const cross = e1.x * e2.y - e1.y * e2.x;
      const u = { x: -e1.x, y: -e1.y };
      const ang = Math.atan2(Math.abs(u.x * e2.y - u.y * e2.x), u.x * e2.x + u.y * e2.y); // 0..π
      const convex = Math.sign(cross) === orient;
      const theta = convex ? ang : 2 * Math.PI - ang;
      const tanHalf = Math.tan(theta / 2);
      if (Math.abs(tanHalf) > 1e-6 && Math.abs(tanHalf) < 1e6) net += d[prev] * d[i] / tanHalf;
    }
    return { gross, net: Math.max(0, net), perimeter };
  };

  P.rectInfo = function (plan, room) {
    if (typeof room === 'string') room = plan.rooms[room];
    const pts = P.roomPts(plan, room);
    if (pts.length !== 4) return null;
    for (let i = 0; i < 4; i++) {
      const a = pts[i], b = pts[(i + 1) % 4];
      if (Math.abs(a.x - b.x) > NODE_EPS && Math.abs(a.y - b.y) > NODE_EPS) return null;
    }
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  };

  // Cambia larghezza/lunghezza di una stanza rettangolare spostando il lato destro / inferiore
  P.setRectSize = function (plan, room, w, h) {
    const info = P.rectInfo(plan, room);
    if (!info) return false;
    const nx = r3(info.x0 + w), ny = r3(info.y0 + h);
    for (const id in plan.nodes) {
      const p = plan.nodes[id];
      const onRight = Math.abs(p.x - info.x1) < NODE_EPS && p.y > info.y0 - NODE_EPS && p.y < info.y1 + NODE_EPS;
      const onBottom = Math.abs(p.y - info.y1) < NODE_EPS && p.x > info.x0 - NODE_EPS && p.x < info.x1 + NODE_EPS;
      if (onRight) p.x = nx;
      if (onBottom) p.y = ny;
    }
    P.tidy(plan);
    return true;
  };

  P.setWallLength = function (plan, wid, len) {
    const w = plan.walls[wid];
    const A = plan.nodes[w.a], B = plan.nodes[w.b];
    const L = G.dist(A, B);
    if (L < 1e-6 || !(len > 0.05)) return false;
    B.x = r3(A.x + (B.x - A.x) / L * len);
    B.y = r3(A.y + (B.y - A.y) / L * len);
    P.tidy(plan);
    return true;
  };

  /* Cambia la lunghezza di un muro "stirando" la casa: tutto ci\u00f2 che sta oltre l'estremo
     che si sposta (muri, stanze, arredi, impianti) trasla insieme, cos\u00ec gli angoli restano dritti.
     side: 'b' sposta l'estremo finale, 'a' quello iniziale. */
  P.stretchWall = function (plan, wid, len, side) {
    const w = plan.walls[wid];
    if (!w) return false;
    const A = plan.nodes[w.a], B = plan.nodes[w.b];
    const L = G.dist(A, B);
    if (L < 1e-6 || !(len > 0.05)) return false;
    const ux = (B.x - A.x) / L, uy = (B.y - A.y) / L, d = len - L;
    const eps = 0.02, ax = A.x, ay = A.y;
    const t = (p) => (p.x - ax) * ux + (p.y - ay) * uy;
    const moves = side === 'a' ? (p) => t(p) <= eps : (p) => t(p) >= L - eps;
    const mx = side === 'a' ? -ux * d : ux * d, my = side === 'a' ? -uy * d : uy * d;
    const mv = (p) => { p.x = r3(p.x + mx); p.y = r3(p.y + my); };
    // aperture sui muri il cui estremo iniziale si sposta: tengo ferma la loro posizione reale
    const keep = [];
    for (const oid in plan.openings) {
      const op = plan.openings[oid], ow = plan.walls[op.wall];
      if (!ow) continue;
      const pa = plan.nodes[ow.a], pb = plan.nodes[ow.b];
      if (moves(pa) && !moves(pb)) {
        const l = G.dist(pa, pb); if (l < 1e-6) continue;
        keep.push({ op, ow, x: pa.x + (pb.x - pa.x) / l * op.pos, y: pa.y + (pb.y - pa.y) / l * op.pos });
      }
    }
    for (const id in plan.nodes) { const n = plan.nodes[id]; if (moves(n)) mv(n); }
    for (const id in plan.furniture || {}) if (moves(plan.furniture[id])) mv(plan.furniture[id]);
    for (const id in plan.fixtures || {}) if (moves(plan.fixtures[id])) mv(plan.fixtures[id]);
    for (const id in plan.columns || {}) if (moves(plan.columns[id])) mv(plan.columns[id]);
    for (const id in plan.beams || {}) {
      const bm = plan.beams[id];
      if (moves({ x: bm.x1, y: bm.y1 })) { bm.x1 = r3(bm.x1 + mx); bm.y1 = r3(bm.y1 + my); }
      if (moves({ x: bm.x2, y: bm.y2 })) { bm.x2 = r3(bm.x2 + mx); bm.y2 = r3(bm.y2 + my); }
    }
    for (const k of keep) {
      const pa = plan.nodes[k.ow.a], pb = plan.nodes[k.ow.b], l = G.dist(pa, pb);
      if (l > 1e-6) k.op.pos = r3(((k.x - pa.x) * (pb.x - pa.x) + (k.y - pa.y) * (pb.y - pa.y)) / l);
    }
    P.tidy(plan);
    return true;
  };

  // Tutti i tratti allineati che formano la stessa parete (spezzata dagli incroci a T)
  P.wallLine = function (plan, wid) {
    const w0 = plan.walls[wid];
    if (!w0) return [];
    const A = plan.nodes[w0.a], B = plan.nodes[w0.b], L = G.dist(A, B);
    if (L < 1e-6) return [wid];
    const ux = (B.x - A.x) / L, uy = (B.y - A.y) / L;
    const onLine = (p) => Math.abs((p.x - A.x) * uy - (p.y - A.y) * ux) < 0.02;
    const out = [wid], seen = new Set([wid]);
    let grow = true;
    while (grow) {
      grow = false;
      for (const id in plan.walls) {
        if (seen.has(id)) continue;
        const w = plan.walls[id];
        if (!onLine(plan.nodes[w.a]) || !onLine(plan.nodes[w.b])) continue;
        if (out.some(o => { const q = plan.walls[o]; return q.a === w.a || q.a === w.b || q.b === w.a || q.b === w.b; })) { out.push(id); seen.add(id); grow = true; }
      }
    }
    const t = (id) => { const w = plan.walls[id], a = plan.nodes[w.a], b = plan.nodes[w.b]; return Math.min((a.x - A.x) * ux + (a.y - A.y) * uy, (b.x - A.x) * ux + (b.y - A.y) * uy); };
    return out.sort((p, q) => t(p) - t(q));
  };

  // Stanze che hanno questo tratto di muro sul loro bordo
  P.wallOwners = function (plan, wid) {
    return Object.keys(plan.rooms).filter(rid => P.roomWalls(plan, plan.rooms[rid]).includes(wid));
  };
  // Il muro "della stanza": i tratti allineati e contigui del bordo di quella stanza, attorno a questo tratto
  P.roomRun = function (plan, wid, rid) {
    const line = P.wallLine(plan, wid);
    const rw = new Set(P.roomWalls(plan, plan.rooms[rid]));
    let i = line.indexOf(wid);
    if (i < 0 || !rw.has(wid)) return [wid];
    let a = i, b = i;
    while (a > 0 && rw.has(line[a - 1])) a--;
    while (b < line.length - 1 && rw.has(line[b + 1])) b++;
    return line.slice(a, b + 1);
  };

  // Distanze di porte e finestre dagli angoli (muro finito, misurate sulle facce del muro)
  P.openingClearances = function (plan, oid) {
    const o = plan.openings[oid];
    const w = o && plan.walls[o.wall];
    if (!w) return [];
    const A = plan.nodes[w.a], B = plan.nodes[w.b], L = G.dist(A, B);
    if (L < 1e-6) return [];
    const u = { x: (B.x - A.x) / L, y: (B.y - A.y) / L }, n = { x: -u.y, y: u.x };
    const line = P.wallLine(plan, o.wall);
    const k0 = line.indexOf(o.wall);
    const proj = (p) => (p.x - A.x) * u.x + (p.y - A.y) * u.y;
    // faccia di un tratto sul lato s (riferito al muro della porta): [inizio, fine] lungo u, e i capi dell'asse
    const faceOn = (id, s) => {
      const ww = plan.walls[id];
      const ends = [proj(plan.nodes[ww.a]), proj(plan.nodes[ww.b])].sort((x, y) => x - y);
      for (const fc of P.wallFaces(plan, id)) {
        const side = ((fc.a.x + fc.b.x) / 2 - A.x) * n.x + ((fc.a.y + fc.b.y) / 2 - A.y) * n.y;
        if (side * s > 0) { const t = [proj(fc.a), proj(fc.b)].sort((x, y) => x - y); return { lo: t[0], hi: t[1], e0: ends[0], e1: ends[1] }; }
      }
      return null;
    };
    const out = [];
    for (const s of [1, -1]) {
      const f0 = faceOn(o.wall, s);
      if (!f0) continue;
      let lo = f0.lo, hi = f0.hi;
      // la faccia prosegue sui tratti allineati finché non incontra un muro di traverso
      for (let k = k0 + 1, f = f0; k < line.length && Math.abs(f.hi - f.e1) < 0.002; k++) { f = faceOn(line[k], s); if (!f) break; hi = f.hi; }
      for (let k = k0 - 1, f = f0; k >= 0 && Math.abs(f.lo - f.e0) < 0.002; k--) { f = faceOn(line[k], s); if (!f) break; lo = f.lo; }
      if (!isFinite(lo)) continue;
      const h = (w.t || 0.1) / 2;
      const mid = { x: A.x + u.x * o.pos + n.x * s * (h + 0.06), y: A.y + u.y * o.pos + n.y * s * (h + 0.06) };
      out.push({ side: s, room: P.roomOf(plan, mid), lo, hi, left: Math.max(0, o.pos - o.w / 2 - lo), right: Math.max(0, hi - (o.pos + o.w / 2)), A, u, n, h });
    }
    return out;
  };

  P.moveNodes = function (plan, ids, dx, dy) {
    for (const id of ids) { const n = plan.nodes[id]; if (n) { n.x = r3(n.x + dx); n.y = r3(n.y + dy); } }
  };

  P.mergeNodes = function (plan, keep, drop) {
    if (keep === drop || !plan.nodes[drop]) return;
    for (const id in plan.walls) {
      const w = plan.walls[id];
      if (w.a === drop) w.a = keep;
      if (w.b === drop) w.b = keep;
    }
    for (const id in plan.rooms) {
      const r = plan.rooms[id];
      r.nodes = r.nodes.map(n => (n === drop ? keep : n)).filter((n, i, arr) => n !== arr[(i + 1) % arr.length] || arr.length === 1);
    }
    delete plan.nodes[drop];
    P.tidy(plan);
  };

  P.openingGeom = function (plan, op) {
    const w = plan.walls[op.wall];
    if (!w) return null;
    const A = plan.nodes[w.a], B = plan.nodes[w.b];
    const L = G.dist(A, B);
    if (L < 1e-6) return null;
    const u = { x: (B.x - A.x) / L, y: (B.y - A.y) / L };
    const n = { x: -u.y, y: u.x };
    const c = { x: A.x + u.x * op.pos, y: A.y + u.y * op.pos };
    return { c, u, n, L, t: w.t, A, B, wall: w };
  };

  P.addOpening = function (plan, wid, pos, kind) {
    const def = CM.OPENINGS[kind] || CM.OPENINGS.battente;
    const id = CM.uid('o');
    plan.openings[id] = { wall: wid, pos: r3(pos), kind, w: def.w, h: def.h, sill: def.sill, flipSide: false, flipHinge: false, state: 'esistente' };
    P.clampOpening(plan, id);
    return id;
  };

  P.clampOpening = function (plan, oid) {
    const op = plan.openings[oid];
    const w = plan.walls[op.wall];
    if (!w) return;
    const L = P.wallLen(plan, w);
    if (op.w > L - 0.02) op.w = r3(Math.max(0.2, L - 0.02));
    const half = op.w / 2;
    op.pos = r3(Math.min(Math.max(op.pos, half + 0.01), L - half - 0.01));
  };

  // Stacca una stanza dalle vicine per spostarla da sola: i vertici e i muri in comune vengono sdoppiati
  // (la stanza vicina tiene il suo muro, quella spostata ne riceve una copia con le sue misure)
  P.detachRoom = function (plan, rid) {
    const room = plan.rooms[rid];
    if (!room) return [];
    const own = P.roomWalls(plan, room);
    const others = Object.keys(plan.rooms).filter(r => r !== rid);
    const sharedW = new Set();
    for (const r of others) for (const w of P.roomWalls(plan, plan.rooms[r])) if (own.includes(w)) sharedW.add(w);
    const ownSet = new Set(own);
    const usedElsewhere = (nid) => others.some(r => plan.rooms[r].nodes.includes(nid)) || Object.keys(plan.walls).some(wid => !ownSet.has(wid) && (plan.walls[wid].a === nid || plan.walls[wid].b === nid)) || own.some(wid => sharedW.has(wid) && (plan.walls[wid].a === nid || plan.walls[wid].b === nid));
    const map = {};
    room.nodes = room.nodes.map(nid => { if (!usedElsewhere(nid)) return nid; const n = plan.nodes[nid]; map[nid] = P.addNode(plan, n.x, n.y); return map[nid]; });
    const m = (id) => map[id] || id;
    for (const wid of own) {
      const w = plan.walls[wid];
      if (sharedW.has(wid)) {
        const copy = CM.clone(w); copy.a = m(w.a); copy.b = m(w.b);
        const mine = w.byRoom && w.byRoom[rid];
        if (mine) Object.assign(copy, mine);
        copy.byRoom = mine ? { [rid]: mine } : undefined;
        plan.walls[CM.uid('w')] = copy;
        if (w.byRoom) { const by = Object.assign({}, w.byRoom); delete by[rid]; w.byRoom = by; }
      } else { w.a = m(w.a); w.b = m(w.b); }
    }
    return room.nodes.slice();
  };

  P.deleteWall = function (plan, wid) {
    delete plan.walls[wid];
    P.tidy(plan);
  };

  P.deleteRoom = function (plan, rid, withWalls) {
    const room = plan.rooms[rid];
    if (!room) return;
    if (withWalls) {
      for (const wid in plan.walls) {
        const w = plan.walls[wid];
        const A = plan.nodes[w.a], B = plan.nodes[w.b];
        const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
        if (![A, B, mid].every(p => P.pointOnRoomBoundary(plan, room, p))) continue;
        let shared = false;
        for (const oid in plan.rooms) {
          if (oid === rid) continue;
          if ([A, B, mid].every(p => P.pointOnRoomBoundary(plan, plan.rooms[oid], p))) { shared = true; break; }
        }
        if (!shared) delete plan.walls[wid];
      }
    }
    delete plan.rooms[rid];
    P.tidy(plan);
  };

  // Pulizia: muri degeneri o doppi, aperture orfane, nodi inutilizzati, stanze degeneri
  /* Crea automaticamente le stanze negli spazi chiusi dai muri.
     Le aperture delle porte (fino a 1,3 m) vengono chiuse solo per il calcolo. */
  P.autoRooms = function (plan, opts) {
    opts = opts || {};
    const res = 0.05, DOOR = 1.3;
    const ids = Object.keys(plan.walls);
    if (!ids.length) return 0;
    const b = P.bounds(Object.assign({}, plan, { underlay: null, furniture: {}, fixtures: {} }));
    if (!b) return 0;
    const ox = b.minX - 0.5, oy = b.minY - 0.5;
    const W = Math.ceil((b.maxX - b.minX + 1) / res) + 1, H = Math.ceil((b.maxY - b.minY + 1) / res) + 1;
    if (W * H > 4e6) return 0;
    const g = new Uint8Array(W * H); // 1 muro, 2 esterno, 0 libero
    const gx = (x) => Math.round((x - ox) / res), gy = (y) => Math.round((y - oy) / res);
    const line = (x0, y0, x1, y1) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
        if (x >= 0 && y >= 0 && x < W && y < H) g[y * W + x] = 1;
      }
    };
    for (const id of ids) {
      const w = plan.walls[id], A = plan.nodes[w.a], B = plan.nodes[w.b];
      line(gx(A.x), gy(A.y), gx(B.x), gy(B.y));
    }
    // vani porta: prolungo ogni muro oltre il suo estremo (se non continua gi\u00e0) fino a un altro muro vicino
    const dirs = {};
    for (const id of ids) {
      const w = plan.walls[id], A = plan.nodes[w.a], B = plan.nodes[w.b];
      const L = Math.hypot(A.x - B.x, A.y - B.y); if (L < 1e-6) continue;
      (dirs[w.a] = dirs[w.a] || []).push({ dx: (B.x - A.x) / L, dy: (B.y - A.y) / L });
      (dirs[w.b] = dirs[w.b] || []).push({ dx: (A.x - B.x) / L, dy: (A.y - B.y) / L });
    }
    for (const nid in dirs) {
      const A = plan.nodes[nid], list = dirs[nid];
      if (list.length > 2) continue; // incroci a T: niente prolungamenti
      const maxD = list.length === 1 ? DOOR : 1.0;
      for (const d0 of list) {
        const dx = -d0.dx, dy = -d0.dy; // continuazione oltre il nodo
        if (list.some(o => o.dx * dx + o.dy * dy > 0.95)) continue;
        let hitD = 0;
        for (let d = res * 2; d <= maxD; d += res / 2) {
          const x = gx(A.x + dx * d), y = gy(A.y + dy * d);
          if (x < 0 || y < 0 || x >= W || y >= H) break;
          if (g[y * W + x] === 1) { hitD = d; break; }
        }
        if (hitD) line(gx(A.x), gy(A.y), gx(A.x + dx * hitD), gy(A.y + dy * hitD));
      }
    }
    // esterno: riempimento dal bordo
    const st = [];
    for (let x = 0; x < W; x++) { st.push(x, (H - 1) * W + x); }
    for (let y = 0; y < H; y++) { st.push(y * W, y * W + W - 1); }
    while (st.length) {
      const i = st.pop();
      if (g[i]) continue;
      g[i] = 2;
      const x = i % W;
      if (x > 0) st.push(i - 1); if (x < W - 1) st.push(i + 1);
      if (i >= W) st.push(i - W); if (i < W * (H - 1)) st.push(i + W);
    }
    // stanze già presenti: non le duplico
    const existing = Object.values(plan.rooms).map(r => P.roomPts(plan, r));
    const xs = [], ys = [];
    for (const id in plan.nodes) { xs.push(plan.nodes[id].x); ys.push(plan.nodes[id].y); }
    const snap = (v, arr) => { let best = v, bd = 0.12; for (const a of arr) { const d = Math.abs(a - v); if (d < bd) { bd = d; best = a; } } return best; };
    const lab = new Int32Array(W * H);
    let made = 0, named = 0, id = 0;
    for (let i0 = 0; i0 < W * H; i0++) {
      if (g[i0] || lab[i0]) continue;
      id++;
      const cells = []; const q = [i0]; lab[i0] = id;
      while (q.length) {
        const i = q.pop(); cells.push(i);
        const x = i % W;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
          if (j < 0 || j >= W * H || g[j] || lab[j]) continue;
          lab[j] = id; q.push(j);
        }
      }
      if (cells.length * res * res < 1.0) continue;
      // contorno: lati delle celle con la stanza a sinistra, concatenati
      const edges = new Map();
      const inR = (x, y) => x >= 0 && y >= 0 && x < W && y < H && lab[y * W + x] === id;
      const key = (x, y) => x + ',' + y;
      for (const i of cells) {
        const x = i % W, y = (i / W) | 0;
        if (!inR(x, y - 1)) edges.set(key(x + 1, y), [x, y]);         // lato alto: da (x+1,y) a (x,y)
        if (!inR(x, y + 1)) edges.set(key(x, y + 1), [x + 1, y + 1]); // lato basso
        if (!inR(x - 1, y)) edges.set(key(x, y), [x, y + 1]);         // lato sinistro
        if (!inR(x + 1, y)) edges.set(key(x + 1, y + 1), [x + 1, y]); // lato destro
      }
      let bestLoop = null;
      const seen = new Set();
      for (const k0 of edges.keys()) {
        if (seen.has(k0)) continue;
        const loop = []; let k = k0, guard = 0;
        while (!seen.has(k) && guard++ < 200000) {
          seen.add(k);
          const [px, py] = k.split(',').map(Number); loop.push([px, py]);
          const nx = edges.get(k); if (!nx) break;
          k = key(nx[0], nx[1]);
        }
        if (!bestLoop || loop.length > bestLoop.length) bestLoop = loop;
      }
      if (!bestLoop || bestLoop.length < 4) continue;
      // tieni solo i vertici d'angolo
      let pts = bestLoop.filter((p, i) => {
        const a = bestLoop[(i - 1 + bestLoop.length) % bestLoop.length], c = bestLoop[(i + 1) % bestLoop.length];
        return (a[0] - p[0]) * (c[1] - p[1]) - (a[1] - p[1]) * (c[0] - p[0]) !== 0;
      }).map(p => ({ x: snap(ox + (p[0] - 0.5) * res, xs), y: snap(oy + (p[1] - 0.5) * res, ys) }));
      // pulizia: punti doppi e allineati dopo l'aggancio
      for (let pass = 0; pass < 3; pass++) {
        pts = pts.filter((p, i) => { const q2 = pts[(i + 1) % pts.length]; return Math.hypot(p.x - q2.x, p.y - q2.y) > 0.02; });
        pts = pts.filter((p, i) => {
          const a = pts[(i - 1 + pts.length) % pts.length], c = pts[(i + 1) % pts.length];
          return Math.abs((a.x - p.x) * (c.y - p.y) - (a.y - p.y) * (c.x - p.x)) > 1e-4;
        });
      }
      if (pts.length < 3) continue;
      const area = Math.abs(G.signedArea(pts));
      if (area < 1.0) continue;
      const c = G.centroid(pts);
      if (existing.some(ep => ep.length && G.inPoly(c, ep))) continue;
      // balcone: striscia stretta e lunga sul bordo esterno della casa
      const bx = pts.map(p => p.x), by = pts.map(p => p.y);
      const rw = Math.max(...bx) - Math.min(...bx), rh = Math.max(...by) - Math.min(...by);
      const edge = 0.3;
      const onBorder = Math.min(...bx) - b.minX < edge || b.maxX - Math.max(...bx) < edge || Math.min(...by) - b.minY < edge || b.maxY - Math.max(...by) < edge;
      const balcony = onBorder && Math.min(rw, rh) < 2.0 && Math.max(rw, rh) >= 3 * Math.min(rw, rh) && Math.max(rw, rh) >= 2.5;
      made++;
      const nodes = pts.map(p => P.nodeAt(plan, p.x, p.y, 0.07) || P.getOrCreateNode(plan, p.x, p.y));
      if (!balcony) named++;
      P.addRoom(plan, nodes, balcony ? { type: 'balcone' } : { name: 'Stanza ' + named });
    }
    return made;
  };

  /* ---------- Gruppi di elementi: selezione multipla, sposta, duplica ---------- */
  P.collectArea = function (plan, r) {
    const inside = (p) => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;
    const set = { nodes: [], walls: [], rooms: [], furniture: [], fixtures: [], columns: [], beams: [] };
    for (const id in plan.nodes) if (inside(plan.nodes[id])) set.nodes.push(id);
    const ns = new Set(set.nodes);
    for (const id in plan.walls) if (ns.has(plan.walls[id].a) && ns.has(plan.walls[id].b)) set.walls.push(id);
    for (const id in plan.rooms) if (plan.rooms[id].nodes.every(n => ns.has(n))) set.rooms.push(id);
    for (const id in plan.furniture) if (inside(plan.furniture[id])) set.furniture.push(id);
    for (const id in plan.fixtures) if (inside(plan.fixtures[id])) set.fixtures.push(id);
    for (const id in plan.columns) if (inside(plan.columns[id])) set.columns.push(id);
    for (const id in plan.beams) { const b = plan.beams[id]; if (inside({ x: b.x1, y: b.y1 }) && inside({ x: b.x2, y: b.y2 })) set.beams.push(id); }
    return set;
  };
  P.setCount = (set) => set ? set.walls.length + set.rooms.length + set.furniture.length + set.fixtures.length + set.columns.length + set.beams.length : 0;
  P.setBounds = function (plan, set) {
    const pts = [];
    set.nodes.forEach(id => plan.nodes[id] && pts.push(plan.nodes[id]));
    set.furniture.forEach(id => plan.furniture[id] && pts.push(...P.furnitureCorners(plan.furniture[id])));
    set.fixtures.forEach(id => plan.fixtures[id] && pts.push(plan.fixtures[id]));
    set.columns.forEach(id => plan.columns[id] && pts.push(plan.columns[id]));
    set.beams.forEach(id => { const b = plan.beams[id]; if (b) pts.push({ x: b.x1, y: b.y1 }, { x: b.x2, y: b.y2 }); });
    if (!pts.length) return null;
    return { x0: Math.min(...pts.map(p => p.x)), y0: Math.min(...pts.map(p => p.y)), x1: Math.max(...pts.map(p => p.x)), y1: Math.max(...pts.map(p => p.y)) };
  };
  P.translateSet = function (plan, set, dx, dy) {
    // i nodi dei muri selezionati (anche se un capo \u00e8 fuori: il muro si allunga)
    set.nodes.forEach(id => { const n = plan.nodes[id]; if (n) { n.x = r3(n.x + dx); n.y = r3(n.y + dy); } });
    const mv = (o) => { if (o) { o.x = r3(o.x + dx); o.y = r3(o.y + dy); } };
    set.furniture.forEach(id => mv(plan.furniture[id]));
    set.fixtures.forEach(id => mv(plan.fixtures[id]));
    set.columns.forEach(id => mv(plan.columns[id]));
    set.beams.forEach(id => { const b = plan.beams[id]; if (b) { b.x1 = r3(b.x1 + dx); b.y1 = r3(b.y1 + dy); b.x2 = r3(b.x2 + dx); b.y2 = r3(b.y2 + dy); } });
  };
  // Copia gli elementi (anche da un altro progetto/variante: src pu\u00f2 essere un'altra pianta) spostati di dx, dy
  P.copySet = function (src, dst, set, dx, dy) {
    const map = {};
    const out = { nodes: [], walls: [], rooms: [], furniture: [], fixtures: [], columns: [], beams: [] };
    const node = (id) => {
      if (map[id]) return map[id];
      const n = src.nodes[id];
      const nid = P.getOrCreateNode(dst, r3(n.x + dx), r3(n.y + dy));
      map[id] = nid; out.nodes.push(nid);
      return nid;
    };
    set.walls.forEach(id => {
      const w = src.walls[id]; if (!w) return;
      const ids = P.addWall(dst, node(w.a), node(w.b), { t: w.t, h: w.h, state: w.state });
      out.walls.push(...ids);
      for (const oid in src.openings) {
        const o = src.openings[oid];
        if (o.wall !== id || !ids.length) continue;
        const nid = CM.uid('o'); dst.openings[nid] = Object.assign(CM.clone(o), { wall: ids[0] }); P.clampOpening(dst, nid);
      }
    });
    set.rooms.forEach(id => { const r = src.rooms[id]; if (!r) return; const rid = CM.uid('r'); dst.rooms[rid] = Object.assign(CM.clone(r), { nodes: r.nodes.map(node) }); out.rooms.push(rid); });
    const cp = (coll, pre) => set[coll].forEach(id => { const o = src[coll][id]; if (!o) return; const nid = CM.uid(pre); dst[coll][nid] = Object.assign(CM.clone(o), { x: r3(o.x + dx), y: r3(o.y + dy) }); out[coll].push(nid); });
    cp('furniture', 'f'); cp('fixtures', 'i'); cp('columns', 'c');
    set.beams.forEach(id => { const b = src.beams[id]; if (!b) return; const nid = CM.uid('b'); dst.beams[nid] = Object.assign(CM.clone(b), { x1: r3(b.x1 + dx), y1: r3(b.y1 + dy), x2: r3(b.x2 + dx), y2: r3(b.y2 + dy) }); out.beams.push(nid); });
    P.tidy(dst);
    return out;
  };
  P.deleteSet = function (plan, set) {
    set.rooms.forEach(id => delete plan.rooms[id]);
    set.walls.forEach(id => delete plan.walls[id]);
    set.furniture.forEach(id => delete plan.furniture[id]);
    set.fixtures.forEach(id => delete plan.fixtures[id]);
    set.columns.forEach(id => delete plan.columns[id]);
    set.beams.forEach(id => delete plan.beams[id]);
    P.tidy(plan);
  };
  // Ruota un muro intorno al suo primo estremo all'angolo dato (gradi, 0 = verso destra, senso orario sullo schermo)
  P.setWallAngle = function (plan, wid, deg) {
    const w = plan.walls[wid]; if (!w) return false;
    const A = plan.nodes[w.a], B = plan.nodes[w.b];
    const L = G.dist(A, B), a = deg * Math.PI / 180;
    B.x = r3(A.x + Math.cos(a) * L); B.y = r3(A.y + Math.sin(a) * L);
    P.tidy(plan);
    return true;
  };
  // Muro ad arco: sostituisce il muro con tanti tratti lungo un arco con la freccia data (m, + verso un lato)
  P.curveWall = function (plan, wid, sag, segs) {
    const w = plan.walls[wid]; if (!w || Math.abs(sag) < 0.01) return false;
    segs = segs || Math.max(6, Math.min(16, Math.round(G.dist(plan.nodes[w.a], plan.nodes[w.b]) / 0.35)));
    const A = plan.nodes[w.a], B = plan.nodes[w.b];
    const L = G.dist(A, B), c = L / 2;
    const R = (c * c + sag * sag) / (2 * Math.abs(sag));
    const u = { x: (B.x - A.x) / L, y: (B.y - A.y) / L }, n = { x: -u.y, y: u.x };
    const sgn = Math.sign(sag);
    const M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    const C = { x: M.x - n.x * sgn * (R - Math.abs(sag)), y: M.y - n.y * sgn * (R - Math.abs(sag)) };
    const a0 = Math.atan2(A.y - C.y, A.x - C.x), a1 = Math.atan2(B.y - C.y, B.x - C.x);
    let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    // il verso giusto \u00e8 quello che passa dal punto di freccia
    const mid = { x: M.x + n.x * sag, y: M.y + n.y * sag };
    const am = Math.atan2(mid.y - C.y, mid.x - C.x);
    const test = (d) => { let x = am - a0; while (x > Math.PI) x -= 2 * Math.PI; while (x < -Math.PI) x += 2 * Math.PI; return Math.sign(x) === Math.sign(d); };
    if (!test(da)) da = da > 0 ? da - 2 * Math.PI : da + 2 * Math.PI;
    const props = { t: w.t, h: w.h, state: w.state };
    delete plan.walls[wid];
    for (const oid in plan.openings) if (plan.openings[oid].wall === wid) delete plan.openings[oid];
    let prev = w.a;
    const inner = [];
    for (let i = 1; i <= segs; i++) {
      const nid = i === segs ? w.b : P.addNode(plan, C.x + Math.cos(a0 + da * i / segs) * R, C.y + Math.sin(a0 + da * i / segs) * R);
      if (i < segs) inner.push(nid);
      P.addWall(plan, prev, nid, props);
      prev = nid;
    }
    // le stanze che usavano il muro seguono la curva
    for (const rid in plan.rooms) {
      const r = plan.rooms[rid];
      for (let i = 0; i < r.nodes.length; i++) {
        const a = r.nodes[i], b = r.nodes[(i + 1) % r.nodes.length];
        if ((a === w.a && b === w.b) || (a === w.b && b === w.a)) {
          r.nodes.splice(i + 1, 0, ...(a === w.a ? inner : inner.slice().reverse()));
          break;
        }
      }
    }
    P.tidy(plan);
    return true;
  };

  // Vani porta lasciati aperti dai muri riconosciuti: li chiudo con una porta (cos\u00ec anche le stanze si chiudono)
  P.fillDoorGaps = function (plan) {
    const deg = {}, dirs = {};
    for (const id in plan.walls) {
      const w = plan.walls[id], A = plan.nodes[w.a], B = plan.nodes[w.b];
      const L = G.dist(A, B); if (L < 1e-6) continue;
      deg[w.a] = (deg[w.a] || 0) + 1; deg[w.b] = (deg[w.b] || 0) + 1;
      dirs[w.a] = { x: (A.x - B.x) / L, y: (A.y - B.y) / L, w: id };
      dirs[w.b] = { x: (B.x - A.x) / L, y: (B.y - A.y) / L, w: id };
    }
    const free = Object.keys(deg).filter(n => deg[n] === 1);
    const used = new Set();
    let n = 0;
    for (const na of free) {
      if (used.has(na)) continue;
      const A = plan.nodes[na], da = dirs[na];
      let best = null, bd = Infinity;
      // 1) un altro muro allineato che riprende dopo il vano
      for (const nb of free) {
        if (nb === na || used.has(nb)) continue;
        const B = plan.nodes[nb], db = dirs[nb];
        const d = G.dist(A, B);
        if (d < 0.5 || d > 1.6) continue;
        const ux = (B.x - A.x) / d, uy = (B.y - A.y) / d;
        if (ux * da.x + uy * da.y < 0.97 || -(ux * db.x + uy * db.y) < 0.97) continue;
        if (d < bd) { bd = d; best = { nb, d }; }
      }
      // 2) oppure un muro perpendicolare davanti
      let hit = null;
      if (!best) {
        for (const id in plan.walls) {
          if (id === da.w) continue;
          const w = plan.walls[id], P1 = plan.nodes[w.a], P2 = plan.nodes[w.b];
          // intersezione del raggio con il muro
          const ex = P2.x - P1.x, ey = P2.y - P1.y;
          const den = da.x * ey - da.y * ex; if (Math.abs(den) < 1e-6) continue;
          const t = ((P1.x - A.x) * ey - (P1.y - A.y) * ex) / den, sP = ((P1.x - A.x) * da.y - (P1.y - A.y) * da.x) / den;
          if (t < 0.5 || t > 1.6 || sP < 0.02 || sP > 0.98) continue;
          if (!hit || t < hit.t) hit = { t, x: A.x + da.x * t, y: A.y + da.y * t };
        }
      }
      if (!best && !hit) continue;
      const wa = plan.walls[da.w];
      const props = { t: wa.t, h: wa.h, state: wa.state };
      let nb = best ? best.nb : P.getOrCreateNode(plan, Math.round(hit.x * 100) / 100, Math.round(hit.y * 100) / 100);
      const gap = best ? best.d : hit.t;
      const ids = P.addWall(plan, na, nb, props);
      used.add(na); if (best) used.add(best.nb);
      if (ids.length) {
        const wid = ids[0];
        const oid = P.addOpening(plan, wid, P.wallLen(plan, wid) / 2, 'battente');
        plan.openings[oid].w = Math.round(Math.max(0.6, Math.min(1.2, gap - 0.04)) * 100) / 100;
        P.clampOpening(plan, oid);
        n++;
      }
    }
    P.tidy(plan);
    return n;
  };

  // Elimina tutto ciò che sta dentro un rettangolo (in metri). Ritorna quanti elementi ha tolto.
  P.eraseArea = function (plan, r) {
    const inside = (p) => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;
    let n = 0;
    for (const id of Object.keys(plan.rooms)) {
      const pts = P.roomPts(plan, plan.rooms[id]);
      if (pts.length && (pts.every(inside) || inside(G.centroid(pts)))) { delete plan.rooms[id]; n++; }
    }
    for (const id of Object.keys(plan.walls)) {
      const w = plan.walls[id], A = plan.nodes[w.a], B = plan.nodes[w.b];
      if (!A || !B) continue;
      if (inside({ x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }) && (inside(A) || inside(B))) { delete plan.walls[id]; n++; }
    }
    const zap = (coll, get) => { for (const id of Object.keys(coll || {})) if (inside(get(coll[id]))) { delete coll[id]; n++; } };
    zap(plan.furniture, f => f);
    zap(plan.fixtures, f => f);
    zap(plan.columns, c => c);
    zap(plan.beams, b => ({ x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 }));
    P.tidy(plan);
    return n;
  };

  P.tidy = function (plan) {
    const seen = {};
    for (const id of Object.keys(plan.walls)) {
      const w = plan.walls[id];
      const A = plan.nodes[w.a], B = plan.nodes[w.b];
      if (!A || !B || w.a === w.b || G.dist(A, B) < NODE_EPS) { delete plan.walls[id]; continue; }
      const key = w.a < w.b ? w.a + '|' + w.b : w.b + '|' + w.a;
      if (seen[key]) {
        for (const oid in plan.openings) if (plan.openings[oid].wall === id) {
          const op = plan.openings[oid];
          if (plan.walls[seen[key]].a !== w.a) op.pos = r3(G.dist(A, B) - op.pos);
          op.wall = seen[key];
        }
        delete plan.walls[id];
        continue;
      }
      seen[key] = id;
    }
    for (const id of Object.keys(plan.rooms)) {
      const r = plan.rooms[id];
      r.nodes = r.nodes.filter(n => plan.nodes[n]);
      if (r.nodes.length < 3) delete plan.rooms[id];
    }
    for (const oid of Object.keys(plan.openings)) {
      if (!plan.walls[plan.openings[oid].wall]) delete plan.openings[oid];
      else P.clampOpening(plan, oid);
    }
    const used = {};
    for (const id in plan.walls) { used[plan.walls[id].a] = 1; used[plan.walls[id].b] = 1; }
    for (const id in plan.rooms) for (const n of plan.rooms[id].nodes) used[n] = 1;
    for (const id of Object.keys(plan.nodes)) if (!used[id]) delete plan.nodes[id];
  };

  P.totals = function (plan) {
    let gross = 0, net = 0, rooms = 0, outdoor = 0;
    for (const id in plan.rooms) {
      const s = P.roomStats(plan, plan.rooms[id]);
      if (CM.roomType(plan.rooms[id].type).outdoor) { outdoor += s.net; continue; }
      gross += s.gross; net += s.net; rooms++;
    }
    return { gross, net, rooms, outdoor };
  };

  P.bounds = function (plan) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const add = (x, y) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
    for (const id in plan.nodes) add(plan.nodes[id].x, plan.nodes[id].y);
    for (const id in plan.columns) { const c = plan.columns[id]; add(c.x - c.w / 2, c.y - c.d / 2); add(c.x + c.w / 2, c.y + c.d / 2); }
    for (const id in plan.beams) { const b = plan.beams[id]; add(b.x1, b.y1); add(b.x2, b.y2); }
    for (const id in (plan.furniture || {})) for (const c of P.furnitureCorners(plan.furniture[id])) add(c.x, c.y);
    for (const id in (plan.fixtures || {})) add(plan.fixtures[id].x, plan.fixtures[id].y);
    if (!isFinite(minX) && plan.underlay) {
      const u = plan.underlay; add(u.x, u.y); add(u.x + u.wM, u.y + u.hM);
    }
    if (!isFinite(minX)) return null;
    return { minX, minY, maxX, maxY };
  };

  /* ---------- Progetto ---------- */
  const PR = CM.project = {};
  PR.create = function (name) {
    const vid = CM.uid('v');
    const now = Date.now();
    return PR.normalize({
      v: 2,
      id: CM.uid('p'),
      name: name || 'Nuovo progetto',
      created: now,
      updated: now,
      north: 0,
      settings: { wallT: 0.12, wallH: 2.7, newState: 'esistente', showDims: true, showGrid: true },
      variants: [{ id: vid, name: 'Principale', plan: P.create() }],
      active: vid
    });
  };
  // Aggiunge i campi introdotti nelle versioni successive
  PR.normalize = function (p) {
    p.settings = Object.assign({ wallT: 0.12, wallH: 2.7, newState: 'esistente', showDims: true, showGrid: true, layers: { arredo: true, impianti: true, planimetria: true } }, p.settings || {});
    p.variants.forEach(v => P.normalize(v.plan));
    const def = {
      address: '', lat: 41.9, budget: { total: 0, rooms: {} }, quotes: [], purchases: {}, payments: [],
      tasks: [], contacts: [], diary: [], reminders: [], history: [], chat: [], shares: []
    };
    for (const k in def) if (p[k] === undefined) p[k] = def[k];
    p.v = 2;
    return p;
  };
  PR.variant = (p) => p.variants.find(v => v.id === p.active) || p.variants[0];
  PR.plan = (p) => PR.variant(p).plan;
  PR.addVariant = function (p, name, fromId) {
    const src = p.variants.find(v => v.id === (fromId || p.active)) || p.variants[0];
    const v = { id: CM.uid('v'), name: name || 'Variante ' + (p.variants.length + 1), plan: CM.clone(src.plan) };
    p.variants.push(v);
    p.active = v.id;
    return v;
  };
  PR.summary = function (p) {
    const t = P.totals(PR.plan(p));
    return { id: p.id, name: p.name, updated: p.updated, area: t.net, gross: t.gross, rooms: t.rooms, variants: p.variants.length, sample: !!p.sample };
  };

  /* ---------- Autotest (eseguito anche nell'app sul telefono) ---------- */
  CM.selfTest = function () {
    const errors = [];
    const near = (a, b, tol, msg) => { if (Math.abs(a - b) > (tol || 1e-3)) errors.push(msg + ': atteso ' + b + ', ottenuto ' + a); };
    const plan = P.create();
    const r1 = P.addRectRoom(plan, 0, 0, 4, 3, { type: 'camera', wall: { t: 0.12 } });
    near(Object.keys(plan.walls).length, 4, 0, 'muri prima stanza');
    near(P.roomStats(plan, r1).gross, 12, 1e-6, 'area lorda');
    near(P.roomStats(plan, r1).net, 3.88 * 2.88, 1e-6, 'area netta');
    // seconda stanza affiancata con lato in comune parziale (incrocio a T)
    const r2 = P.addRectRoom(plan, 4, 1, 7, 3, { type: 'bagno', wall: { t: 0.12 } });
    near(Object.keys(plan.walls).length, 8, 0, 'muri con lato condiviso');
    near(Object.keys(plan.rooms).length, 2, 0, 'stanze');
    // apertura e split
    const wid = Object.keys(plan.walls).find(id => { const w = plan.walls[id]; const A = plan.nodes[w.a], B = plan.nodes[w.b]; return A.y === 0 && B.y === 0; });
    const oid = P.addOpening(plan, wid, 2, 'finestra');
    near(plan.openings[oid].pos, 2, 1e-6, 'posizione finestra');
    const mid = P.getOrCreateNode(plan, 1, 0);
    near(Object.keys(plan.walls).length, 9, 0, 'split muro');
    near(P.wallLen(plan, plan.openings[oid].wall), 3, 1e-6, 'finestra sul tratto giusto');
    near(plan.openings[oid].pos, 1, 1e-6, 'posizione finestra dopo split');
    // ridimensiona stanza
    P.setRectSize(plan, r1, 4.5, 3);
    near(P.rectInfo(plan, r1).w, 4.5, 1e-6, 'nuova larghezza');
    // eliminazione stanza: il muro in comune resta
    P.deleteRoom(plan, r2, true);
    if (!plan.rooms[r1]) errors.push('stanza 1 sparita');
    near(Object.keys(plan.rooms).length, 1, 0, 'stanze dopo eliminazione');
    if (!mid) errors.push('nodo intermedio non creato');
    // stanza a L: area netta coerente
    const pl = P.create();
    const ids = [[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]].map(c => P.addNode(pl, c[0], c[1]));
    for (let i = 0; i < 6; i++) P.addWall(pl, ids[i], ids[(i + 1) % 6], { t: 0.2 });
    const rl = P.addRoom(pl, ids, {});
    near(P.roomStats(pl, rl).gross, 12, 1e-6, 'area L lorda');
    // L inset 0.1: (3.8x1.8) + (1.8x2.0) = 6.84 + 3.6 = 10.44
    near(P.roomStats(pl, rl).net, 10.44, 1e-6, 'area L netta');
    // formattazione e parsing
    near(fmt.parseM('3,8'), 3.8, 1e-9, 'parse 3,8');
    near(fmt.parseM('380cm'), 3.8, 1e-9, 'parse 380cm');
    near(fmt.parseM('80', 'cm'), 0.8, 1e-9, 'parse 80 cm');
    if (!CM.versionNewer('0.1.10', '0.1.9') || CM.versionNewer('0.1.2', '0.1.2') || CM.versionNewer('v0.1.1', '0.1.2')) errors.push('confronto versioni');
    return errors;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CM;
})(typeof window !== 'undefined' ? window : globalThis);
