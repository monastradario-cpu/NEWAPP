/* Casa Mia — progetto d'esempio (appartamento 12 x 8 m) */
(function (root) {
  'use strict';
  const CM = root.CM;
  const P = CM.plan, G = CM.geom;

  function wallsAlong(plan, x1, y1, x2, y2) {
    const A = { x: x1, y: y1 }, B = { x: x2, y: y2 };
    return Object.keys(plan.walls).filter(id => {
      const w = plan.walls[id];
      return G.projSeg(plan.nodes[w.a], A, B).d < 0.005 && G.projSeg(plan.nodes[w.b], A, B).d < 0.005;
    });
  }

  function openingAt(plan, x, y, kind, opts) {
    opts = opts || {};
    const p = { x, y };
    let best = null, bestD = 0.02;
    for (const id in plan.walls) {
      const w = plan.walls[id];
      const pr = G.projSeg(p, plan.nodes[w.a], plan.nodes[w.b]);
      if (pr.d < bestD && pr.t > 0 && pr.t < 1) { best = { id, pos: pr.t * pr.L }; bestD = pr.d; }
    }
    if (!best) return null;
    const oid = P.addOpening(plan, best.id, best.pos, kind);
    const op = plan.openings[oid];
    if (opts.w) op.w = opts.w;
    if (opts.h) op.h = opts.h;
    if (opts.sill != null) op.sill = opts.sill;
    if (opts.towards) {
      const g = P.openingGeom(plan, op);
      const dot = (opts.towards.x - g.c.x) * g.n.x + (opts.towards.y - g.c.y) * g.n.y;
      op.flipSide = dot < 0;
    }
    P.clampOpening(plan, oid);
    return oid;
  }

  CM.sample = {
    create() {
      const p = CM.project.create("Appartamento d'esempio");
      p.sample = true;
      p.north = 20;
      const plan = CM.project.plan(p);
      const wall = { t: 0.10, h: 2.7, state: 'esistente' };
      const rooms = [
        ['soggiorno', 'Soggiorno', 0, 0, 5.2, 4.4],
        ['cucina', 'Cucina', 5.2, 0, 8.4, 4.4],
        ['camera', 'Camera da letto', 8.4, 0, 12, 4.4],
        ['corridoio', 'Corridoio', 0, 4.4, 12, 5.6],
        ['bagno', 'Bagno', 0, 5.6, 2.4, 8],
        ['cameretta', 'Cameretta', 2.4, 5.6, 5.8, 8],
        ['studio', 'Studio', 5.8, 5.6, 8.4, 8],
        ['lavanderia', 'Lavanderia', 8.4, 5.6, 12, 8]
      ];
      for (const r of rooms) P.addRectRoom(plan, r[2], r[3], r[4], r[5], { type: r[0], name: r[1], wall });

      // Muri perimetrali più spessi
      for (const seg of [[0, 0, 12, 0], [12, 0, 12, 8], [0, 8, 12, 8], [0, 0, 0, 8]]) {
        for (const id of wallsAlong(plan, ...seg)) plan.walls[id].t = 0.30;
      }
      // Ristrutturazione: muro soggiorno/cucina da demolire, nuovo tramezzo studio/lavanderia
      for (const id of wallsAlong(plan, 5.2, 0, 5.2, 4.4)) plan.walls[id].state = 'demolire';
      for (const id of wallsAlong(plan, 8.4, 5.6, 8.4, 8)) plan.walls[id].state = 'nuovo';

      // Porte (si aprono verso l'interno delle stanze)
      openingAt(plan, 1.4, 4.4, 'battente', { towards: { x: 1.4, y: 3 } });
      openingAt(plan, 6.0, 4.4, 'battente', { towards: { x: 6, y: 3 } });
      openingAt(plan, 9.4, 4.4, 'battente', { towards: { x: 9.4, y: 3 } });
      openingAt(plan, 1.2, 5.6, 'battente', { towards: { x: 1.2, y: 7 } });
      openingAt(plan, 3.4, 5.6, 'battente', { towards: { x: 3.4, y: 7 } });
      openingAt(plan, 6.6, 5.6, 'scorrevole', { towards: { x: 6.6, y: 7 } });
      openingAt(plan, 9.4, 5.6, 'battente', { towards: { x: 9.4, y: 7 } });
      openingAt(plan, 12, 5.0, 'battente', { w: 0.9, towards: { x: 10, y: 5 } });
      // Finestre
      openingAt(plan, 2.6, 0, 'portafinestra', { w: 1.6, towards: { x: 2.6, y: 1 } });
      openingAt(plan, 6.8, 0, 'finestra', { towards: { x: 6.8, y: 1 } });
      openingAt(plan, 10.2, 0, 'finestra', { w: 1.4, towards: { x: 10.2, y: 1 } });
      openingAt(plan, 0, 2.2, 'finestra', { towards: { x: 1, y: 2.2 } });
      openingAt(plan, 1.2, 8, 'finestra', { w: 0.6, h: 0.6, sill: 1.5, towards: { x: 1.2, y: 7 } });
      openingAt(plan, 4.1, 8, 'finestra', { towards: { x: 4.1, y: 7 } });
      openingAt(plan, 7.1, 8, 'finestra', { w: 1.0, towards: { x: 7.1, y: 7 } });
      openingAt(plan, 10.2, 8, 'finestra', { w: 1.0, towards: { x: 10.2, y: 7 } });

      // Struttura: pilastro che resta dopo la demolizione e trave sopra il muro demolito
      plan.columns[CM.uid('c')] = { x: 5.2, y: 4.4, w: 0.30, d: 0.30 };
      plan.beams[CM.uid('b')] = { x1: 5.2, y1: 0.15, x2: 5.2, y2: 4.25, w: 0.30 };

      // Lavori sulle aperture
      for (const oid in plan.openings) {
        const op = plan.openings[oid], g = P.openingGeom(plan, op);
        if (op.kind === 'scorrevole') op.state = 'nuova';
        if ((op.kind === 'finestra' || op.kind === 'portafinestra') && g.c.y < 0.1) op.state = 'sostituire';
      }

      // Arredi (se il catalogo è caricato)
      const base = CM.FURNITURE_BASE || [];
      const put = (id, x, y, rot) => { const it = base.find(i => i.id === id); if (it) P.addFurniture(plan, it, x, y, rot || 0); };
      const R = Math.PI / 2;
      put('mobiletv', 3.6, 4.14, Math.PI); put('divano3', 3.6, 2.0, 0); put('tappeto200', 3.6, 2.9, 0);
      put('tavolo4', 1.2, 1.3, 0); put('lampterra', 4.85, 1.6, 0);
      put('k-colfrigo', 8.05, 0.45, R); put('k-lavello120', 8.05, 1.35, R); put('k-base60', 8.05, 2.25, R); put('k-cottura60', 8.05, 2.85, R); put('k-colforno', 8.05, 3.45, R);
      put('k-pensile60', 8.175, 2.25, R); put('k-cappa', 8.175, 2.85, R);
      put('letto160', 10.8, 2.2, R); put('comodino', 11.65, 1.1, R); put('comodino', 11.65, 3.3, R); put('armadio4', 8.75, 1.2, -R);
      put('wc', 0.42, 7.0, -R); put('bidet', 0.42, 7.5, -R); put('lavabo60', 2.12, 6.6, R); put('doccia80', 1.95, 7.45, Math.PI);
      put('letto90', 4.725, 7.3, R); put('scrivaniacam', 2.75, 7.2, -R);
      put('scrivania', 7.1, 7.5, Math.PI); put('lavatrice', 11.55, 7.4, R);

      // Impianti
      const fx = (k, x, y, st) => { const id = P.addFixture(plan, k, x, y); if (st) plan.fixtures[id].state = st; };
      fx('presa', 5.0, 3.9); fx('presa_tv', 3.0, 4.27); fx('presa', 0.3, 0.5); fx('interruttore', 0.85, 4.27); fx('luce', 2.6, 2.2);
      fx('termosifone', 2.6, 0.3, 'esistente'); fx('termosifone', 10.2, 0.3, 'esistente'); fx('termosifone', 1.2, 7.7, 'esistente');
      fx('acqua', 8.25, 1.35); fx('scarico', 8.25, 1.5); fx('acqua', 0.25, 7.0); fx('scarico', 0.25, 7.2); fx('acqua', 11.75, 7.4); fx('scarico', 11.75, 7.6);
      fx('caldaia', 11.75, 6.2, 'esistente'); fx('quadro', 11.75, 5.0); fx('condizionatore', 11.75, 2.2);

      // Finiture
      const room = (type) => Object.keys(plan.rooms).find(id => plan.rooms[id].type === type);
      const fin = (type, f) => { const id = room(type); if (id) plan.rooms[id].finish = f; };
      fin('soggiorno', { floor: { mat: 'm-parquet-rovere', pose: 'spina' }, paint: { mat: 'm-pittura-salvia', coats: 2 } });
      fin('cucina', { floor: { mat: 'm-gres-cemento', pose: 'dritta', joint: 2 }, paint: { mat: 'm-pittura-lavabile', coats: 2 }, cladding: { mat: 'm-mosaico', height: 0.6, pose: 'dritta', joint: 2, walls: wallsAlong(plan, 8.4, 0, 8.4, 4.4) } });
      fin('camera', { floor: { mat: 'm-parquet-rovere', pose: 'dritta' }, paint: { mat: 'm-pittura-grigio', coats: 2 } });
      fin('bagno', { floor: { mat: 'm-gres-cemento', pose: 'dritta', joint: 2 }, cladding: { mat: 'm-ceramica-bagno', height: 1.2, pose: 'dritta', joint: 2 }, paint: { mat: 'm-pittura-lavabile', coats: 2 } });
      fin('corridoio', { floor: { mat: 'm-gres-legno', pose: 'sfalsata', joint: 2 }, paint: { mat: 'm-pittura-bianca', coats: 2 } });
      fin('cameretta', { floor: { mat: 'm-laminato', pose: 'dritta' }, paint: { mat: 'm-pittura-bianca', coats: 2 } });
      fin('studio', { floor: { mat: 'm-laminato', pose: 'dritta' }, paint: { mat: 'm-pittura-bianca', coats: 2 } });
      fin('lavanderia', { floor: { mat: 'm-ceramica-bagno', pose: 'diagonale', joint: 2 }, paint: { mat: 'm-pittura-lavabile', coats: 2 } });

      p.budget = { total: 40000, rooms: {} };

      // Seconda variante: cucina chiusa (il muro resta, niente nuovo vano)
      const v2 = CM.project.addVariant(p, 'Cucina chiusa');
      for (const id in v2.plan.walls) if (v2.plan.walls[id].state === 'demolire') v2.plan.walls[id].state = 'esistente';
      v2.plan.beams = {};
      p.active = p.variants[0].id;
      return p;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
