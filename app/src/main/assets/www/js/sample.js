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
      return p;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
