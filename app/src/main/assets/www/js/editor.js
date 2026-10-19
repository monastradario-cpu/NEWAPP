/* Casa Mia — editor della pianta: strumenti, gesti, selezione, annulla/ripeti */
(function (root) {
  'use strict';
  const CM = root.CM;
  const P = CM.plan, G = CM.geom, R = CM.render;

  const TAP_MOVE = 8;      // px oltre i quali un tocco diventa trascinamento
  const NODE_SNAP = 16;    // px
  const WALL_SNAP = 12;    // px
  const ALIGN_SNAP = 9;    // px

  const HINTS = {
    select: 'Tocca un elemento per modificarlo · un dito sposta la vista · due dita per lo zoom',
    room: 'Trascina da un angolo all’altro della stanza · due dita per spostare la vista',
    wall: 'Tocca i punti del muro uno dopo l’altro · tocca il primo punto per chiudere la stanza',
    opening: 'Tocca un muro per inserire l’apertura',
    column: 'Tocca dove mettere il pilastro',
    beam: 'Trascina per tracciare la trave'
  };

  class Editor {
    constructor(canvas, hooks) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.hooks = hooks || {};
      this.tool = 'select';
      this.openingKind = 'battente';
      this.sel = {};
      this.undoStack = [];
      this.redoStack = [];
      this.pointers = new Map();
      this.gesture = null;
      this.chain = null;
      this.draft = null;
      this.view = { s: 40, x: 0, y: 0 };
      this.W = 0; this.H = 0;
      this._raf = 0;
      this._bind();
    }

    /* ---------- Progetto e vista ---------- */
    setProject(project) {
      this.project = project;
      this.plan = CM.project.plan(project);
      this.undoStack = []; this.redoStack = [];
      this.sel = {}; this.chain = null; this.draft = null;
      this.resize();
      this.fit();
      this._emitSelect();
      this._emitHistory();
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
      if (w === this.W && h === this.H && this.canvas.width === Math.round(w * dpr)) return;
      const oldW = this.W, oldH = this.H;
      this.W = w; this.H = h;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (oldW && oldH) { this.view.x += (w - oldW) / 2; this.view.y += (h - oldH) / 2; }
      this.draw();
    }

    fit() {
      if (!this.plan) return;
      this.view = R.fitView(this.plan, this.W, this.H, Math.min(48, Math.min(this.W, this.H) * 0.1));
      this.draw();
    }

    zoomBy(f, cx, cy) {
      cx = cx == null ? this.W / 2 : cx; cy = cy == null ? this.H / 2 : cy;
      const s = Math.max(5, Math.min(600, this.view.s * f));
      const wx = (cx - this.view.x) / this.view.s, wy = (cy - this.view.y) / this.view.s;
      this.view = { s, x: cx - wx * s, y: cy - wy * s };
      this.draw();
    }

    toWorld(sx, sy) { return { x: (sx - this.view.x) / this.view.s, y: (sy - this.view.y) / this.view.s }; }

    draw() {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => { this._raf = 0; this._drawNow(); });
    }

    _drawNow() {
      if (!this.plan || !this.W) return;
      const s = this.project.settings || {};
      R.draw(this.ctx, {
        plan: this.plan, view: this.view, width: this.W, height: this.H,
        sel: this.sel, showGrid: s.showGrid !== false, showDims: !!s.showDims,
        draft: this.draft, highlightNodes: this._handleNodes()
      });
      if (this.hooks.onDraw) this.hooks.onDraw(this.view);
    }

    /* ---------- Strumenti ---------- */
    setTool(tool, kind) {
      this.finishChain();
      this.tool = tool;
      if (kind) this.openingKind = kind;
      this.draft = null;
      if (tool !== 'select') this.select({});
      this._emitHint();
      this.draw();
    }

    hint() {
      if (this.tool === 'opening') return 'Tocca un muro per inserire: ' + CM.OPENINGS[this.openingKind].label.toLowerCase();
      return HINTS[this.tool];
    }

    _emitHint() {
      if (this.hooks.onHint) this.hooks.onHint(this.hint(), this.tool === 'wall' && this.chain ? ['undoPoint', 'finish'] : []);
    }

    /* ---------- Selezione ---------- */
    select(sel) {
      this.sel = sel && sel.type ? sel : {};
      this._emitSelect();
      this.draw();
    }
    _emitSelect() { if (this.hooks.onSelect) this.hooks.onSelect(this.sel); }

    // Rettangolo (in metri) occupato dall'elemento selezionato
    boundsOf(sel) {
      const plan = this.plan;
      let pts = [];
      if (sel.type === 'room' && plan.rooms[sel.id]) pts = P.roomPts(plan, plan.rooms[sel.id]);
      else if (sel.type === 'wall' && plan.walls[sel.id]) pts = P.wallEnds(plan, plan.walls[sel.id]);
      else if (sel.type === 'opening' && plan.openings[sel.id]) {
        const op = plan.openings[sel.id], g = P.openingGeom(plan, op);
        if (g) pts = [{ x: g.c.x - g.u.x * op.w, y: g.c.y - g.u.y * op.w }, { x: g.c.x + g.u.x * op.w, y: g.c.y + g.u.y * op.w },
          { x: g.c.x + g.n.x * op.w, y: g.c.y + g.n.y * op.w }, { x: g.c.x - g.n.x * op.w, y: g.c.y - g.n.y * op.w }];
      } else if (sel.type === 'column' && plan.columns[sel.id]) {
        const c = plan.columns[sel.id]; pts = [{ x: c.x - c.w, y: c.y - c.d }, { x: c.x + c.w, y: c.y + c.d }];
      } else if (sel.type === 'beam' && plan.beams[sel.id]) {
        const b = plan.beams[sel.id]; pts = [{ x: b.x1, y: b.y1 }, { x: b.x2, y: b.y2 }];
      }
      if (!pts.length) return null;
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
      return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
    }

    // Porta l'elemento selezionato dentro l'area visibile (px) non coperta dal pannello
    reveal(sel, area) {
      const b = this.boundsOf(sel);
      if (!b || area.w < 60 || area.h < 60) return;
      const m = 28;
      const v = this.view;
      let s = v.s;
      const bw = (b.maxX - b.minX) * s, bh = (b.maxY - b.minY) * s;
      if (bw > area.w - m * 2 || bh > area.h - m * 2) {
        s = Math.max(5, Math.min((area.w - m * 2) / Math.max(b.maxX - b.minX, 0.1), (area.h - m * 2) / Math.max(b.maxY - b.minY, 0.1)));
      }
      const x0 = v.x + b.minX * v.s, y0 = v.y + b.minY * v.s, x1 = v.x + b.maxX * v.s, y1 = v.y + b.maxY * v.s;
      const inside = s === v.s && x0 >= area.x + m && y0 >= area.y + m && x1 <= area.x + area.w - m && y1 <= area.y + area.h - m;
      if (inside) return;
      const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
      this.view = { s, x: area.x + area.w / 2 - cx * s, y: area.y + area.h / 2 - cy * s };
      this.draw();
    }

    _handleNodes() {
      if (this.sel.type === 'wall' && this.plan.walls[this.sel.id]) {
        const w = this.plan.walls[this.sel.id]; return [w.a, w.b];
      }
      if (this.sel.type === 'room' && this.plan.rooms[this.sel.id]) return this.plan.rooms[this.sel.id].nodes.slice();
      return [];
    }

    /* ---------- Modifiche e storia ---------- */
    snapshot() {
      this.undoStack.push(JSON.stringify(this.plan));
      if (this.undoStack.length > 100) this.undoStack.shift();
      this.redoStack = [];
      this._emitHistory();
    }

    commit(reason) {
      this.project.updated = Date.now();
      if (this.sel.type && !this._selExists()) this.sel = {};
      this._emitSelect();
      this._emitHistory();
      if (this.hooks.onChange) this.hooks.onChange(reason || 'edit');
      this.draw();
    }

    mutate(fn, reason) {
      this.snapshot();
      fn(this.plan);
      P.tidy(this.plan);
      this.commit(reason);
    }

    _replacePlan(json) {
      const variant = CM.project.variant(this.project);
      variant.plan = JSON.parse(json);
      this.plan = variant.plan;
    }

    undo() {
      if (this.chain) this._chainPop();
      if (!this.undoStack.length) return;
      this.redoStack.push(JSON.stringify(this.plan));
      this._replacePlan(this.undoStack.pop());
      this.commit('undo');
    }
    redo() {
      if (!this.redoStack.length) return;
      this.undoStack.push(JSON.stringify(this.plan));
      this._replacePlan(this.redoStack.pop());
      this.commit('redo');
    }
    canUndo() { return this.undoStack.length > 0; }
    canRedo() { return this.redoStack.length > 0; }
    _emitHistory() { if (this.hooks.onHistory) this.hooks.onHistory(this.canUndo(), this.canRedo()); }

    _selExists() {
      const map = { wall: 'walls', room: 'rooms', opening: 'openings', column: 'columns', beam: 'beams' }[this.sel.type];
      return map && this.plan[map][this.sel.id];
    }

    deleteSelection() {
      const s = this.sel;
      if (!s.type) return;
      this.mutate(plan => {
        if (s.type === 'wall') P.deleteWall(plan, s.id);
        if (s.type === 'room') P.deleteRoom(plan, s.id, true);
        if (s.type === 'opening') delete plan.openings[s.id];
        if (s.type === 'column') delete plan.columns[s.id];
        if (s.type === 'beam') delete plan.beams[s.id];
      }, 'delete');
      this.select({});
    }

    /* ---------- Aggancio (snap) ---------- */
    gridStep() { return this.view.s < 30 ? 0.1 : 0.05; }

    snapPoint(world, opts) {
      opts = opts || {};
      const v = this.view;
      const out = { p: { x: world.x, y: world.y }, node: null, wall: null, guides: [] };
      // 1. vertici esistenti
      let best = null, bestD = NODE_SNAP / v.s;
      for (const id in this.plan.nodes) {
        if (opts.exclude && opts.exclude.includes(id)) continue;
        const n = this.plan.nodes[id];
        const d = Math.hypot(n.x - world.x, n.y - world.y);
        if (d < bestD) { best = id; bestD = d; }
      }
      if (best) { out.node = best; out.p = { x: this.plan.nodes[best].x, y: this.plan.nodes[best].y }; return out; }
      // 2. vincolo d'angolo rispetto al punto precedente
      if (opts.from) {
        const dx = world.x - opts.from.x, dy = world.y - opts.from.y;
        const tol = Math.tan(7 * Math.PI / 180);
        if (Math.abs(dy) < Math.abs(dx) * tol) out.p.y = opts.from.y;
        else if (Math.abs(dx) < Math.abs(dy) * tol) out.p.x = opts.from.x;
      }
      // 3. griglia
      const step = this.gridStep();
      const lockX = opts.from && out.p.x === opts.from.x, lockY = opts.from && out.p.y === opts.from.y;
      if (!lockX) out.p.x = G.snap(out.p.x, step);
      if (!lockY) out.p.y = G.snap(out.p.y, step);
      // 4. allineamento con altri vertici
      let ax = null, ay = null, adx = ALIGN_SNAP / v.s, ady = ALIGN_SNAP / v.s;
      for (const id in this.plan.nodes) {
        if (opts.exclude && opts.exclude.includes(id)) continue;
        const n = this.plan.nodes[id];
        if (!lockX && Math.abs(n.x - world.x) < adx) { adx = Math.abs(n.x - world.x); ax = n; }
        if (!lockY && Math.abs(n.y - world.y) < ady) { ady = Math.abs(n.y - world.y); ay = n; }
      }
      if (ax) { out.p.x = ax.x; out.guides.push({ a: { x: ax.x, y: ax.y }, b: { x: ax.x, y: out.p.y } }); }
      if (ay) { out.p.y = ay.y; out.guides.push({ a: { x: ay.x, y: ay.y }, b: { x: out.p.x, y: ay.y } }); }
      // 5. su un muro esistente (incroci a T)
      if (opts.walls) {
        let bw = null, bd = WALL_SNAP / v.s;
        for (const id in this.plan.walls) {
          const w = this.plan.walls[id];
          if (opts.exclude && (opts.exclude.includes(w.a) || opts.exclude.includes(w.b))) continue;
          const pr = G.projSeg(world, this.plan.nodes[w.a], this.plan.nodes[w.b]);
          if (pr.d < bd && pr.t > 0 && pr.t < 1) { bd = pr.d; bw = { id, pr }; }
        }
        if (bw) {
          const A = this.plan.nodes[this.plan.walls[bw.id].a], B = this.plan.nodes[this.plan.walls[bw.id].b];
          // aggancia lungo il muro mantenendo la griglia sull'asse libero
          const horizontal = Math.abs(A.y - B.y) < 1e-6, vertical = Math.abs(A.x - B.x) < 1e-6;
          if (horizontal) out.p = { x: out.p.x, y: A.y };
          else if (vertical) out.p = { x: A.x, y: out.p.y };
          else out.p = bw.pr.q;
          out.wall = bw.id;
          out.guides = [];
        }
      }
      return out;
    }

    /* ---------- Hit test (coordinate schermo) ---------- */
    hitTest(sx, sy) {
      const plan = this.plan, v = this.view;
      const w = this.toWorld(sx, sy);
      // maniglie
      for (const nid of this._handleNodes()) {
        const n = plan.nodes[nid];
        if (n && Math.hypot(v.x + n.x * v.s - sx, v.y + n.y * v.s - sy) < 20) return { type: 'node', id: nid };
      }
      // aperture
      let best = null, bestD = Infinity;
      for (const id in plan.openings) {
        const op = plan.openings[id];
        const g = P.openingGeom(plan, op);
        if (!g) continue;
        const a = { x: g.c.x - g.u.x * op.w / 2, y: g.c.y - g.u.y * op.w / 2 }, b = { x: g.c.x + g.u.x * op.w / 2, y: g.c.y + g.u.y * op.w / 2 };
        const d = G.projSeg(w, a, b).d * v.s;
        const tol = Math.max(g.t * v.s / 2, 10) + 6;
        if (d < tol && d < bestD) { best = { type: 'opening', id }; bestD = d; }
      }
      if (best) return best;
      // pilastri
      for (const id in plan.columns) {
        const c = plan.columns[id];
        const pad = 6 / v.s;
        if (Math.abs(w.x - c.x) <= c.w / 2 + pad && Math.abs(w.y - c.y) <= c.d / 2 + pad) return { type: 'column', id };
      }
      // muri
      for (const id in plan.walls) {
        const wl = plan.walls[id];
        const d = G.projSeg(w, plan.nodes[wl.a], plan.nodes[wl.b]).d * v.s;
        const tol = Math.max(wl.t * v.s / 2, 9) + 3;
        if (d < tol && d < bestD) { best = { type: 'wall', id }; bestD = d; }
      }
      if (best) return best;
      // travi
      for (const id in plan.beams) {
        const b = plan.beams[id];
        const d = G.projSeg(w, { x: b.x1, y: b.y1 }, { x: b.x2, y: b.y2 }).d * v.s;
        if (d < Math.max(b.w * v.s / 2, 9) + 3) return { type: 'beam', id };
      }
      // stanze: la più piccola che contiene il punto
      let room = null, roomA = Infinity;
      for (const id in plan.rooms) {
        const pts = P.roomPts(plan, plan.rooms[id]);
        if (pts.length >= 3 && G.inPoly(w, pts)) {
          const a = Math.abs(G.signedArea(pts));
          if (a < roomA) { roomA = a; room = id; }
        }
      }
      return room ? { type: 'room', id: room } : null;
    }

    /* ---------- Gesti ---------- */
    _bind() {
      const c = this.canvas;
      c.style.touchAction = 'none';
      c.addEventListener('pointerdown', e => this._down(e));
      c.addEventListener('pointermove', e => this._move(e));
      c.addEventListener('pointerup', e => this._up(e));
      c.addEventListener('pointercancel', e => this._cancel(e));
      c.addEventListener('wheel', e => { e.preventDefault(); this.zoomBy(Math.exp(-e.deltaY * 0.0015), e.offsetX, e.offsetY); }, { passive: false });
    }

    _pos(e) { const r = this.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

    _down(e) {
      this.canvas.setPointerCapture(e.pointerId);
      const pos = this._pos(e);
      this.pointers.set(e.pointerId, pos);
      if (this.pointers.size === 2) {
        // pizzico: annulla l'eventuale azione a un dito
        this._abortSingle();
        const [p1, p2] = [...this.pointers.values()];
        this.gesture = { type: 'pinch', d0: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1, mid0: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }, view0: Object.assign({}, this.view) };
        return;
      }
      if (this.pointers.size > 2) return;
      const world = this.toWorld(pos.x, pos.y);
      this.gesture = { type: 'pending', start: pos, startWorld: world, last: pos, moved: false, hit: this.tool === 'select' ? this.hitTest(pos.x, pos.y) : null };
      if (this.tool === 'room' || this.tool === 'beam') {
        const sp = this.snapPoint(world, { walls: true });
        this.gesture.anchor = sp.p;
        this.draft = this.tool === 'room' ? { kind: 'rect', a: sp.p, b: sp.p, snap: sp.p } : { kind: 'beam', points: [sp.p], cursor: sp.p };
        this.draw();
      }
      if (this.tool === 'wall' || this.tool === 'column') this._previewPoint(world);
      if (this.tool === 'opening') this._previewOpening(world);
    }

    _move(e) {
      if (!this.pointers.has(e.pointerId)) {
        // mouse senza tasto premuto: anteprima
        if (e.pointerType === 'mouse' && this.tool === 'wall' && this.chain) { const p = this._pos(e); this._previewPoint(this.toWorld(p.x, p.y)); }
        return;
      }
      const pos = this._pos(e);
      this.pointers.set(e.pointerId, pos);
      const g = this.gesture;
      if (!g) return;
      if (g.type === 'pinch' && this.pointers.size >= 2) {
        const [p1, p2] = [...this.pointers.values()];
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const v0 = g.view0;
        const s = Math.max(5, Math.min(600, v0.s * d / g.d0));
        const wx = (g.mid0.x - v0.x) / v0.s, wy = (g.mid0.y - v0.y) / v0.s;
        this.view = { s, x: mid.x - wx * s, y: mid.y - wy * s };
        this.draw();
        return;
      }
      const dist = Math.hypot(pos.x - g.start.x, pos.y - g.start.y);
      if (!g.moved && dist > TAP_MOVE) {
        g.moved = true;
        if (g.type === 'pending' && this.tool === 'select') this._startDrag(g);
      }
      const world = this.toWorld(pos.x, pos.y);
      if (g.type === 'pan') {
        this.view.x += pos.x - g.last.x; this.view.y += pos.y - g.last.y;
        this.draw();
      } else if (g.type === 'drag') {
        this._dragTo(g, world);
      } else if (this.tool === 'room' && this.draft) {
        const sp = this.snapPoint(world, { walls: true });
        this.draft.b = sp.p; this.draft.snap = sp.node || sp.wall ? sp.p : null; this.draft.guides = sp.guides;
        this.draw();
      } else if (this.tool === 'beam' && this.draft) {
        const sp = this.snapPoint(world, { from: g.anchor });
        this.draft.cursor = sp.p;
        this.draw();
      } else if (this.tool === 'wall' || this.tool === 'column') {
        this._previewPoint(world);
      } else if (this.tool === 'opening') {
        this._previewOpening(world);
      }
      g.last = pos;
    }

    _up(e) {
      const pos = this._pos(e);
      const wasPinch = this.gesture && this.gesture.type === 'pinch';
      this.pointers.delete(e.pointerId);
      if (wasPinch) {
        if (this.pointers.size === 0) this.gesture = null;
        else this.gesture = { type: 'ignore' };
        return;
      }
      const g = this.gesture;
      this.gesture = this.pointers.size ? { type: 'ignore' } : null;
      if (!g || g.type === 'ignore') return;
      const world = this.toWorld(pos.x, pos.y);
      if (g.type === 'drag') { this._endDrag(g); return; }
      if (g.type === 'pan') return;
      // tocco o fine di un tracciamento
      switch (this.tool) {
        case 'select':
          this.select(g.hit && g.hit.type !== 'node' ? g.hit : (g.hit && g.hit.type === 'node' ? this.sel : {}));
          break;
        case 'room': this._finishRect(); break;
        case 'beam': this._finishBeam(); break;
        case 'wall': this._chainTap(world); break;
        case 'column': this._placeColumn(world); break;
        case 'opening': this._placeOpening(world); break;
      }
    }

    _cancel(e) {
      this.pointers.delete(e.pointerId);
      this._abortSingle();
      this.gesture = null;
    }

    _abortSingle() {
      const g = this.gesture;
      if (g && g.type === 'drag' && g.snapshotTaken) {
        // ripristina lo stato precedente al trascinamento
        this._replacePlan(this.undoStack.pop());
        this._emitHistory();
      }
      if (this.tool === 'room' || this.tool === 'beam') this.draft = null;
      if (this.tool === 'wall' || this.tool === 'column' || this.tool === 'opening') this.draft = this.chain ? this.draft : null;
      this.draw();
    }

    /* ---------- Trascinamenti (strumento selezione) ---------- */
    _startDrag(g) {
      const hit = g.hit;
      const selected = hit && (hit.type === 'node' || (this.sel.type === hit.type && this.sel.id === hit.id));
      if (!selected) { g.type = 'pan'; return; }
      g.type = 'drag';
      g.target = hit;
      this.snapshot();
      g.snapshotTaken = true;
      g.orig = JSON.parse(this.undoStack[this.undoStack.length - 1]);
    }

    _dragTo(g, world) {
      const plan = this.plan, t = g.target, orig = g.orig;
      const dx = world.x - g.startWorld.x, dy = world.y - g.startWorld.y;
      const step = this.gridStep();
      this.draft = null;
      if (t.type === 'node') {
        const sp = this.snapPoint(world, { exclude: [t.id], walls: true });
        plan.nodes[t.id].x = CM.r3(sp.p.x); plan.nodes[t.id].y = CM.r3(sp.p.y);
        g.mergeWith = sp.node; g.ontoWall = sp.wall;
        this.draft = { kind: 'none', snap: sp.node || sp.wall ? sp.p : null, guides: sp.guides };
      } else if (t.type === 'wall') {
        const w = orig.walls[t.id];
        const A = orig.nodes[w.a], B = orig.nodes[w.b];
        const L = G.dist(A, B) || 1;
        const n = { x: -(B.y - A.y) / L, y: (B.x - A.x) / L };
        const k = G.snap(dx * n.x + dy * n.y, step);
        for (const id of [w.a, w.b]) { plan.nodes[id].x = CM.r3(orig.nodes[id].x + n.x * k); plan.nodes[id].y = CM.r3(orig.nodes[id].y + n.y * k); }
      } else if (t.type === 'room') {
        const sx = G.snap(dx, step), sy = G.snap(dy, step);
        for (const id of orig.rooms[t.id].nodes) { plan.nodes[id].x = CM.r3(orig.nodes[id].x + sx); plan.nodes[id].y = CM.r3(orig.nodes[id].y + sy); }
      } else if (t.type === 'opening') {
        const op = plan.openings[t.id];
        const w = plan.walls[op.wall];
        const pr = G.projSeg(world, plan.nodes[w.a], plan.nodes[w.b]);
        op.pos = CM.r3(G.snap(pr.t * pr.L, 0.01));
        P.clampOpening(plan, t.id);
      } else if (t.type === 'column') {
        const c = orig.columns[t.id];
        const sp = this.snapPoint({ x: c.x + dx, y: c.y + dy }, { walls: true });
        plan.columns[t.id].x = CM.r3(sp.p.x); plan.columns[t.id].y = CM.r3(sp.p.y);
      } else if (t.type === 'beam') {
        const b = orig.beams[t.id];
        const sx = G.snap(dx, step), sy = G.snap(dy, step);
        Object.assign(plan.beams[t.id], { x1: CM.r3(b.x1 + sx), y1: CM.r3(b.y1 + sy), x2: CM.r3(b.x2 + sx), y2: CM.r3(b.y2 + sy) });
      }
      for (const oid in plan.openings) P.clampOpening(plan, oid);
      this.draw();
    }

    _endDrag(g) {
      const plan = this.plan;
      this.draft = null;
      if (g.target.type === 'node') {
        if (g.mergeWith && plan.nodes[g.mergeWith]) P.mergeNodes(plan, g.mergeWith, g.target.id);
        else if (g.ontoWall && plan.walls[g.ontoWall]) {
          const w = plan.walls[g.ontoWall];
          if (w.a !== g.target.id && w.b !== g.target.id) P.splitWall(plan, g.ontoWall, g.target.id);
        }
      }
      P.tidy(plan);
      this.commit('drag');
    }

    /* ---------- Stanza rettangolare ---------- */
    _finishRect() {
      const d = this.draft;
      this.draft = null;
      if (!d) return this.draw();
      const w = Math.abs(d.b.x - d.a.x), h = Math.abs(d.b.y - d.a.y);
      if (w < 0.5 || h < 0.5) {
        if (this.hooks.onToast) this.hooks.onToast('Trascina per disegnare una stanza di almeno 50 cm');
        return this.draw();
      }
      const s = this.project.settings;
      let rid;
      this.mutate(plan => {
        const n = Object.keys(plan.rooms).length + 1;
        rid = P.addRectRoom(plan, d.a.x, d.a.y, d.b.x, d.b.y, { name: 'Stanza ' + n, type: 'altro', h: s.wallH, wall: { t: s.wallT, h: s.wallH, state: s.newState } });
      }, 'room');
      if (this.plan.rooms[rid]) this.select({ type: 'room', id: rid });
    }

    /* ---------- Trave ---------- */
    _finishBeam() {
      const d = this.draft;
      this.draft = null;
      if (!d || !d.cursor || G.dist(d.points[0], d.cursor) < 0.3) return this.draw();
      let bid;
      this.mutate(plan => {
        bid = CM.uid('b');
        plan.beams[bid] = { x1: d.points[0].x, y1: d.points[0].y, x2: d.cursor.x, y2: d.cursor.y, w: 0.30 };
      }, 'beam');
      this.setTool('select');
      this.select({ type: 'beam', id: bid });
    }

    /* ---------- Muri liberi ---------- */
    _previewPoint(world) {
      const from = this.chain && this.chain.points.length ? this.chain.points[this.chain.points.length - 1] : null;
      const sp = this.snapPoint(world, { walls: true, from });
      if (this.tool === 'wall') {
        this.draft = { kind: 'chain', points: this.chain ? this.chain.points : [], cursor: from ? sp.p : null, snap: sp.p, guides: sp.guides };
      } else {
        this.draft = { kind: 'none', snap: sp.p, guides: sp.guides };
      }
      this.draw();
      return sp;
    }

    _chainTap(world) {
      const from = this.chain && this.chain.points.length ? this.chain.points[this.chain.points.length - 1] : null;
      const sp = this.snapPoint(world, { walls: true, from });
      const s = this.project.settings;
      const props = { t: s.wallT, h: s.wallH, state: s.newState };
      if (!this.chain) {
        this.chain = { points: [sp.p], nodes: [] };
      } else {
        if (G.dist(from, sp.p) < 0.1) { this._previewPoint(world); return; }
        const chain = this.chain;
        const closing = chain.nodes.length >= 3 && sp.node === chain.nodes[0];
        this.mutate(plan => {
          if (!chain.nodes.length) chain.nodes.push(P.getOrCreateNode(plan, from.x, from.y));
          const nb = P.getOrCreateNode(plan, sp.p.x, sp.p.y);
          P.addWall(plan, chain.nodes[chain.nodes.length - 1], nb, props);
          chain.nodes.push(nb);
          chain.points.push(sp.p);
          if (closing) {
            const n = Object.keys(plan.rooms).length + 1;
            chain.roomId = P.addRoom(plan, chain.nodes.slice(0, -1), { name: 'Stanza ' + n, type: 'altro', h: s.wallH });
          }
        }, 'wall');
        if (closing) {
          const rid = chain.roomId;
          this.chain = null;
          this.draft = null;
          this.setTool('select');
          if (this.plan.rooms[rid]) this.select({ type: 'room', id: rid });
          return;
        }
      }
      this._previewPoint(world);
      this._emitHint();
    }

    _chainPop() {
      if (!this.chain) return;
      this.chain.points.pop();
      this.chain.nodes.pop();
      if (this.chain.nodes.length === 1) this.chain.nodes = [];
      if (!this.chain.points.length) this.chain = null;
      this.draft = this.chain ? { kind: 'chain', points: this.chain.points } : null;
      this._emitHint();
    }

    undoPoint() {
      if (!this.chain) return;
      if (this.chain.points.length <= 1) { this.chain = null; this.draft = null; this._emitHint(); this.draw(); return; }
      this.undo();
    }

    finishChain() {
      if (!this.chain) return;
      this.chain = null;
      this.draft = null;
      this._emitHint();
      this.draw();
    }

    /* ---------- Pilastri e aperture ---------- */
    _placeColumn(world) {
      const sp = this.snapPoint(world, { walls: true });
      let cid;
      this.mutate(plan => { cid = CM.uid('c'); plan.columns[cid] = { x: CM.r3(sp.p.x), y: CM.r3(sp.p.y), w: 0.30, d: 0.30 }; }, 'column');
      this.draft = null;
      this.setTool('select');
      this.select({ type: 'column', id: cid });
    }

    _nearestWall(world, maxPx) {
      let best = null, bestD = (maxPx || 26) / this.view.s;
      for (const id in this.plan.walls) {
        const w = this.plan.walls[id];
        const pr = G.projSeg(world, this.plan.nodes[w.a], this.plan.nodes[w.b]);
        if (pr.d < bestD) { bestD = pr.d; best = { id, pos: pr.tc * pr.L, q: pr.q }; }
      }
      return best;
    }

    _previewOpening(world) {
      const hit = this._nearestWall(world);
      this.draft = hit ? { kind: 'none', snap: hit.q } : null;
      this.draw();
    }

    _placeOpening(world) {
      const hit = this._nearestWall(world);
      this.draft = null;
      if (!hit) {
        if (this.hooks.onToast) this.hooks.onToast('Tocca più vicino a un muro');
        return this.draw();
      }
      let oid;
      const kind = this.openingKind;
      this.mutate(plan => {
        oid = P.addOpening(plan, hit.id, G.snap(hit.pos, 0.05), kind);
        // apri verso il lato dove si trova il dito
        const g = P.openingGeom(plan, plan.openings[oid]);
        const dot = (world.x - g.c.x) * g.n.x + (world.y - g.c.y) * g.n.y;
        plan.openings[oid].flipSide = dot < 0;
      }, 'opening');
      this.setTool('select');
      this.select({ type: 'opening', id: oid });
    }
  }

  CM.Editor = Editor;
})(typeof window !== 'undefined' ? window : globalThis);
