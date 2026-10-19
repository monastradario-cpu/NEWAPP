/* Casa Mia — vista 3D: modellino e passeggiata, materiali, mobili, luci e sole */
(function (root) {
  'use strict';
  const CM = root.CM;
  const P = CM.plan, G = CM.geom;
  const EYE = 1.6;

  /* ---------- Texture procedurali ---------- */
  const texCache = new Map();
  function shade(hex, k) {
    const n = parseInt((hex || '#cccccc').replace('#', ''), 16);
    const f = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
    return 'rgb(' + f((n >> 16) & 255) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
  }
  function rand(seed) { let s = seed || 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  function canvasTexture(kind, color, extra) {
    const key = kind + color + JSON.stringify(extra || {});
    if (texCache.has(key)) return texCache.get(key);
    const T = window.THREE;
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const x = c.getContext('2d');
    const r = rand(7);
    x.fillStyle = color; x.fillRect(0, 0, 512, 512);
    if (kind === 'wood') {
      const rows = 4;
      for (let i = 0; i < rows; i++) {
        const y = i * 512 / rows, off = (i % 2) * 256 + r() * 120;
        for (let k = -1; k < 2; k++) {
          x.fillStyle = shade(color, 0.9 + r() * 0.2);
          x.fillRect(off + k * 512, y, 512, 512 / rows);
          x.strokeStyle = shade(color, 0.7); x.lineWidth = 2; x.strokeRect(off + k * 512, y, 512, 512 / rows);
        }
        for (let g = 0; g < 14; g++) {
          x.strokeStyle = shade(color, 0.82 + r() * 0.1); x.lineWidth = 1;
          x.beginPath(); const gy = y + r() * 512 / rows; x.moveTo(0, gy);
          for (let gx = 0; gx <= 512; gx += 32) x.lineTo(gx, gy + Math.sin(gx / 40 + g) * 2);
          x.stroke();
        }
      }
    } else if (kind === 'tile' || kind === 'marble') {
      const n = 2;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        x.fillStyle = shade(color, 0.95 + r() * 0.08);
        x.fillRect(i * 256, j * 256, 256, 256);
      }
      if (kind === 'marble') {
        for (let v = 0; v < 9; v++) {
          x.strokeStyle = 'rgba(120,120,120,' + (0.15 + r() * 0.2) + ')'; x.lineWidth = 0.6 + r() * 1.6;
          x.beginPath(); let px = r() * 512, py = 0; x.moveTo(px, py);
          while (py < 512) { px += (r() - 0.5) * 60; py += 20 + r() * 40; x.lineTo(px, py); }
          x.stroke();
        }
      }
      x.strokeStyle = 'rgba(255,255,255,0.75)'; x.lineWidth = 4;
      for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * 256, 0); x.lineTo(i * 256, 512); x.moveTo(0, i * 256); x.lineTo(512, i * 256); x.stroke(); }
    } else if (kind === 'herringbone') {
      // spina di pesce (a spina "francese": doghe a 45° in colonne alternate)
      const colW = 128, W = 30, L = colW / Math.SQRT1_2, step = W / Math.SQRT1_2;
      for (let col = 0; col < 4; col++) {
        x.save();
        x.beginPath(); x.rect(col * colW, 0, colW, 512); x.clip();
        for (let y = -step * 3; y < 512 + step * 3; y += step) {
          x.save();
          x.translate(col * colW + colW / 2, y);
          x.rotate((col % 2 ? 1 : -1) * Math.PI / 4);
          x.fillStyle = shade(color, 0.86 + r() * 0.24);
          x.fillRect(-L / 2, -W / 2, L, W);
          x.strokeStyle = shade(color, 0.62); x.lineWidth = 2; x.strokeRect(-L / 2, -W / 2, L, W);
          x.restore();
        }
        x.restore();
      }
    } else if (kind === 'tile_offset') {
      for (let j = 0; j < 4; j++) {
        const off = (j % 2) * 128;
        for (let i = -1; i < 3; i++) {
          x.fillStyle = shade(color, 0.94 + r() * 0.09);
          x.fillRect(i * 256 + off, j * 128, 256, 128);
          x.strokeStyle = 'rgba(255,255,255,0.75)'; x.lineWidth = 4; x.strokeRect(i * 256 + off, j * 128, 256, 128);
        }
      }
    } else if (kind === 'grass') {
      for (let i = 0; i < 9000; i++) { x.fillStyle = shade(color, 0.75 + r() * 0.5); x.fillRect(r() * 512, r() * 512, 2, 3); }
    } else if (kind === 'water') {
      const g = x.createLinearGradient(0, 0, 512, 512); g.addColorStop(0, '#7FC4DA'); g.addColorStop(1, '#3E95B8');
      x.fillStyle = g; x.fillRect(0, 0, 512, 512);
      x.strokeStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 40; i++) { x.beginPath(); const yy = r() * 512, xx = r() * 512; x.moveTo(xx, yy); x.quadraticCurveTo(xx + 20, yy - 6, xx + 40, yy); x.stroke(); }
    } else if (kind === 'stripes') {
      for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? shade(color, 0.88) : color; x.fillRect(i * 64, 0, 64, 512); }
    } else if (kind === 'pattern') {
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
        x.fillStyle = shade(color, 0.75); x.beginPath(); x.arc(i * 86 + 43 + (j % 2) * 43, j * 86 + 43, 12, 0, Math.PI * 2); x.fill();
      }
    } else if (kind === 'concrete') {
      for (let i = 0; i < 6000; i++) { x.fillStyle = 'rgba(0,0,0,' + r() * 0.06 + ')'; x.fillRect(r() * 512, r() * 512, 2, 2); }
    }
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    texCache.set(key, t);
    return t;
  }

  function imageTexture(src, onReady) {
    const key = 'img:' + src;
    if (texCache.has(key)) return texCache.get(key);
    const T = window.THREE;
    const t = new T.Texture();
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => { t.image = im; t.needsUpdate = true; onReady && onReady(); };
    im.src = src;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.colorSpace = T.SRGBColorSpace;
    texCache.set(key, t);
    return t;
  }

  /* ---------- Posizione del sole ---------- */
  CM.sun = function (latDeg, dayOfYear, hour) {
    const rad = Math.PI / 180;
    const decl = 23.44 * Math.sin(rad * 360 / 365 * (284 + dayOfYear));
    const H = 15 * (hour - 12);
    const phi = latDeg * rad, d = decl * rad, h = H * rad;
    const sinEl = Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(h);
    const el = Math.asin(sinEl);
    let az = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(d) * Math.cos(phi)) + Math.PI; // da nord, in senso orario
    return { elevation: el / rad, azimuth: (az / rad) % 360 };
  };

  class View3D {
    constructor(container, hooks) {
      this.container = container;
      this.hooks = hooks || {};
      this.mode = 'orbit';
      this.phase = 'dopo';
      this.lowWalls = false;
      this.day = 172; this.hour = 15;
      this.ready = false;
      this.dirty = true;
      this.pointers = new Map();
      this.walk = { x: 0, z: 0, yaw: 0, pitch: -0.05, move: { x: 0, y: 0 } };
      this.orbit = { theta: -0.7, phi: 0.95, r: 18, target: { x: 0, y: 0, z: 0 } };
    }

    init() {
      if (this.ready) return true;
      const T = window.THREE;
      if (!T) return false;
      try {
        this.renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      } catch (e) {
        console.error('WebGL non disponibile: ' + e.message);
        return false;
      }
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = T.PCFSoftShadowMap;
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      this.container.appendChild(this.renderer.domElement);
      this.renderer.domElement.style.touchAction = 'none';
      this.scene = new T.Scene();
      this.scene.background = new T.Color('#E9EEF2');
      this.camera = new T.PerspectiveCamera(55, 1, 0.05, 400);
      this.hemi = new T.HemisphereLight('#F4F7FB', '#C9C2B4', 0.75);
      this.scene.add(this.hemi);
      this.sunLight = new T.DirectionalLight('#FFF4E0', 2.2);
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(2048, 2048);
      this.sunLight.shadow.bias = -0.0006;
      this.scene.add(this.sunLight, this.sunLight.target);
      this.group = new T.Group();
      this.scene.add(this.group);
      this._bind();
      this.ready = true;
      const loop = () => {
        this._raf = requestAnimationFrame(loop);
        if (this.mode === 'walk' && (this.walk.move.x || this.walk.move.y)) this._stepWalk();
        if (this.dirty && this.visible) { this.dirty = false; this._render(); }
      };
      loop();
      return true;
    }

    setVisible(v) { this.visible = v; if (v) { this.resize(); this.dirty = true; } }

    resize() {
      if (!this.ready) return;
      const r = this.container.getBoundingClientRect();
      const w = Math.max(1, r.width), h = Math.max(1, r.height);
      this.renderer.setSize(w, h, false);
      this.renderer.domElement.style.width = w + 'px';
      this.renderer.domElement.style.height = h + 'px';
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.dirty = true;
    }

    /* ---------- Costruzione della scena ---------- */
    build(project) {
      if (!this.init()) return false;
      const T = window.THREE;
      this.project = project;
      const plan = CM.project.plan(project);
      this.plan = plan;
      // svuota
      this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      this.scene.remove(this.group);
      this.group = new T.Group();
      this.scene.add(this.group);
      this.lamps = [];
      const redraw = () => { this.dirty = true; };
      const b = P.bounds(plan) || { minX: 0, minY: 0, maxX: 8, maxY: 6 };
      this.bounds = b;
      const cx = (b.minX + b.maxX) / 2, cz = (b.minY + b.maxY) / 2;
      const size = Math.max(b.maxX - b.minX, b.maxY - b.minY, 4);

      // terreno
      const ground = new T.Mesh(new T.PlaneGeometry(size * 6, size * 6), new T.MeshStandardMaterial({ color: '#DCE3D3', roughness: 1 }));
      ground.rotation.x = -Math.PI / 2; ground.position.set(cx, -0.02, cz); ground.receiveShadow = true;
      this.group.add(ground);

      const mat = (opts) => new T.MeshStandardMaterial(Object.assign({ roughness: 0.85, metalness: 0 }, opts));

      // pavimenti
      for (const id in plan.rooms) {
        const room = plan.rooms[id];
        const pts = P.roomPts(plan, room);
        if (pts.length < 3) continue;
        const shape = new T.Shape(pts.map(p => new T.Vector2(p.x, -p.y)));
        const geo = new T.ShapeGeometry(shape);
        const fm = this._floorMaterial(room, redraw);
        const mesh = new T.Mesh(geo, fm);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = room.type === 'piscina' ? -0.05 : 0;
        mesh.receiveShadow = true;
        mesh.userData = { kind: 'room', id };
        this.group.add(mesh);
      }

      // muri
      const wallH = (w) => (this.lowWalls ? 1.05 : (w.h || 2.7));
      for (const id in plan.walls) {
        const w = plan.walls[id];
        if (this.phase === 'dopo' && w.state === 'demolire') continue;
        if (this.phase === 'prima' && w.state === 'nuovo') continue;
        this._buildWall(plan, id, w, wallH(w), mat);
      }
      // pilastri e travi
      for (const id in plan.columns) {
        const c = plan.columns[id];
        const h = this.lowWalls ? 1.05 : 2.7;
        const m = new T.Mesh(new T.BoxGeometry(c.w, h, c.d), mat({ color: '#E7E4DE' }));
        m.position.set(c.x, h / 2, c.y); m.castShadow = m.receiveShadow = true; this.group.add(m);
      }
      if (!this.lowWalls) for (const id in plan.beams) {
        const bm = plan.beams[id];
        const len = Math.hypot(bm.x2 - bm.x1, bm.y2 - bm.y1);
        const m = new T.Mesh(new T.BoxGeometry(len, 0.3, bm.w), mat({ color: '#E7E4DE' }));
        m.position.set((bm.x1 + bm.x2) / 2, 2.55, (bm.y1 + bm.y2) / 2);
        m.rotation.y = -Math.atan2(bm.y2 - bm.y1, bm.x2 - bm.x1);
        m.castShadow = true; this.group.add(m);
      }
      // arredi
      for (const id in plan.furniture) this._buildFurniture(plan.furniture[id], mat);
      // impianti visibili (termosifoni, condizionatori, caldaia)
      for (const id in plan.fixtures) {
        const fx = plan.fixtures[id];
        if (!['termosifone', 'condizionatore', 'caldaia', 'quadro'].includes(fx.kind)) continue;
        const dims = { termosifone: [0.8, 0.6, 0.1], condizionatore: [0.85, 0.3, 0.22], caldaia: [0.45, 0.7, 0.35], quadro: [0.4, 0.5, 0.1] }[fx.kind];
        const m = new T.Mesh(new T.BoxGeometry(dims[0], dims[1], dims[2]), mat({ color: '#F4F4F2' }));
        const rot = this._wallAngleNear(plan, fx);
        m.position.set(fx.x, CM.FIXTURES[fx.kind].elev + dims[1] / 2, fx.y);
        m.rotation.y = rot; m.castShadow = true; this.group.add(m);
      }

      this.updateSun();
      if (!this._placed) { this.resetCamera(); this._placed = true; }
      this.dirty = true;
      return true;
    }

    _floorMaterial(room, redraw) {
      const T = window.THREE;
      const f = room.finish && room.finish.floor;
      const m = f && CM.lib.material(f.mat);
      if (room.type === 'piscina') { const t = canvasTexture('water', '#5DB0CF'); t.repeat.set(0.25, 0.25); return new T.MeshStandardMaterial({ map: t, roughness: 0.15, metalness: 0.1 }); }
      if (!m && room.type === 'giardino') { const t = canvasTexture('grass', '#7FA05F'); t.repeat.set(0.5, 0.5); return new T.MeshStandardMaterial({ map: t, roughness: 1 }); }
      if (!m && room.type === 'box') { const t = canvasTexture('concrete', '#C9C7C2'); t.repeat.set(0.3, 0.3); return new T.MeshStandardMaterial({ map: t, roughness: 1 }); }
      if (!m) return new T.MeshStandardMaterial({ color: '#E8E2D6', roughness: 0.9 });
      return new T.MeshStandardMaterial({ map: this._surfaceTexture(m, f.pose, redraw), roughness: m.tex === 'marble' ? 0.35 : 0.75 });
    }

    // Texture di un materiale tenendo conto del tipo di posa
    // Le foto dei negozi vengono prima salvate dentro l'app, poi usate come texture
    _localize(m) {
      this._pendingImg = this._pendingImg || {};
      if (this._pendingImg[m.id] || !CM.localImage) return;
      this._pendingImg[m.id] = true;
      CM.localImage(m.img, 1024).then(d => {
        const cur = CM.lib.material(m.id);
        if (!cur) return;
        if (d) cur.img = d; else { cur.imgRemote = cur.img; cur.img = ''; }
        try { CM.lib.saveMaterial(cur); } catch (e) {}
        if (this.project) this.build(this.project);
      });
    }

    _surfaceTexture(m, pose, redraw) {
      let tex;
      if (m.img && /^https?:/i.test(m.img)) { this._localize(m); m = Object.assign({}, m, { img: '' }); }
      pose = pose || 'dritta';
      if (m.img) {
        tex = imageTexture(m.img, redraw);
        tex = tex.clone(); tex.needsUpdate = true;
        tex.repeat.set(1 / (m.tw || 0.6), 1 / (m.th || 0.6));
      } else if (pose === 'spina' && (m.tex === 'wood' || m.tex === 'tile' || m.tex === 'marble')) {
        tex = canvasTexture('herringbone', m.color).clone(); tex.needsUpdate = true;
        const plank = Math.max(m.tw || 0.1, 0.06);
        tex.repeat.set(1 / (plank * 4 * 1.2), 1 / (plank * 4 * 1.2));
      } else if (pose === 'sfalsata' && (m.tex === 'tile' || m.tex === 'marble')) {
        tex = canvasTexture('tile_offset', m.color).clone(); tex.needsUpdate = true;
        tex.repeat.set(1 / ((m.th || 0.6) * 2), 1 / ((m.tw || 0.6) * 4));
      } else {
        tex = canvasTexture(m.tex || 'plain', m.color).clone(); tex.needsUpdate = true;
        if (m.tex === 'wood') tex.repeat.set(1 / ((m.tw || 0.2) * 4), 1 / ((m.th || 1.2) * 1.2));
        else if (m.tex === 'tile' || m.tex === 'marble') tex.repeat.set(1 / ((m.tw || 0.6) * 2), 1 / ((m.th || 0.6) * 2));
        else tex.repeat.set(0.5, 0.5);
      }
      if (pose === 'diagonale') { tex.center.set(0.5, 0.5); tex.rotation = Math.PI / 4; }
      return tex;
    }

    _wallFaceMaterial(roomId, wallId) {
      const T = window.THREE;
      const room = roomId && this.plan.rooms[roomId];
      const f = room && room.finish;
      const onWall = (sel) => !sel || !sel.length || sel.includes(wallId);
      if (f && f.wallpaper && f.wallpaper.mat && onWall(f.wallpaper.walls)) {
        const m = CM.lib.material(f.wallpaper.mat);
        if (m) { const t = canvasTexture(m.tex || 'stripes', m.color); t.repeat.set(1 / 0.53 / 8 * 8 / 4, 0.4); return new T.MeshStandardMaterial({ map: t, roughness: 0.9 }); }
      }
      const pm = f && f.paint && CM.lib.material(f.paint.mat);
      if (room && CM.roomType(room.type).outdoor) return new T.MeshStandardMaterial({ color: '#EFEDE8', roughness: 0.95 });
      return new T.MeshStandardMaterial({ color: pm ? pm.color : '#F3F1EC', roughness: 0.95 });
    }

    _buildWall(plan, id, w, H, mat) {
      const T = window.THREE;
      const A = plan.nodes[w.a], B = plan.nodes[w.b];
      const L = G.dist(A, B);
      if (L < 0.01) return;
      const u = { x: (B.x - A.x) / L, y: (B.y - A.y) / L };
      const n = { x: -u.y, y: u.x };
      const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
      const probe = (k) => P.roomOf(plan, { x: mid.x + n.x * k * (w.t / 2 + 0.06), y: mid.y + n.y * k * (w.t / 2 + 0.06) });
      const roomPlus = probe(1), roomMinus = probe(-1);
      const top = mat({ color: '#D9D6CF' });
      const edge = mat({ color: w.state === 'nuovo' && this.phase === 'dopo' ? '#EDE6E1' : '#E3E0DA' });
      // BoxGeometry: +x,-x,+y,-y,+z,-z. Lunghezza su x, altezza y, spessore z; +z locale = lato n
      const mats = [edge, edge, top, top, this._wallFaceMaterial(roomPlus, id), this._wallFaceMaterial(roomMinus, id)];
      const ops = Object.values(plan.openings).filter(o => o.wall === id).sort((a, b) => a.pos - b.pos);
      const ext = w.t / 2;
      const pieces = [];
      let cur = -ext;
      for (const o of ops) {
        const s0 = o.pos - o.w / 2, s1 = o.pos + o.w / 2;
        if (s0 > cur) pieces.push([cur, s0, 0, H]);
        const bottom = o.kind === 'finestra' ? Math.min(o.sill || 0, H) : 0;
        const topO = Math.min(o.h + bottom, H);
        if (bottom > 0) pieces.push([s0, s1, 0, bottom]);
        if (topO < H) pieces.push([s0, s1, topO, H]);
        this._buildOpening(plan, o, u, n, w, bottom, topO, mat);
        cur = Math.max(cur, s1);
      }
      if (cur < L + ext) pieces.push([cur, L + ext, 0, H]);
      const angle = -Math.atan2(u.y, u.x);
      for (const [s0, s1, y0, y1] of pieces) {
        const len = s1 - s0, hh = y1 - y0;
        if (len <= 0.001 || hh <= 0.001) continue;
        const m = new T.Mesh(new T.BoxGeometry(len, hh, w.t), mats);
        const c = (s0 + s1) / 2;
        m.position.set(A.x + u.x * c, y0 + hh / 2, A.y + u.y * c);
        m.rotation.y = angle;
        m.castShadow = true; m.receiveShadow = true;
        m.userData = { kind: 'wall', id };
        this.group.add(m);
        // rivestimento (piastrelle) sul lato delle stanze che lo prevedono
        for (const [rid, side] of [[roomPlus, 1], [roomMinus, -1]]) {
          const r = rid && plan.rooms[rid];
          const cl = r && r.finish && r.finish.cladding;
          const cm = cl && cl.mat && CM.lib.material(cl.mat);
          if (!cm || !(cl.height > y0)) continue;
          if (cl.walls && cl.walls.length && !cl.walls.includes(id)) continue;
          const ch = Math.min(cl.height, y1) - y0;
          if (ch <= 0) continue;
          const tex = this._surfaceTexture(cm, cl.pose, () => { this.dirty = true; });
          const geo = new T.PlaneGeometry(len, ch);
          // UV in metri, così la piastrella ha la sua misura reale
          const uv = geo.attributes.uv;
          for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * len, uv.getY(k) * ch);
          const pm = new T.Mesh(geo, new T.MeshStandardMaterial({ map: tex, roughness: 0.4 }));
          const off = side * (w.t / 2 + 0.004);
          pm.position.set(A.x + u.x * c + n.x * off, y0 + ch / 2, A.y + u.y * c + n.y * off);
          pm.rotation.y = angle + (side > 0 ? 0 : Math.PI);
          pm.receiveShadow = true;
          this.group.add(pm);
        }
      }
    }

    _buildOpening(plan, o, u, n, w, bottom, top, mat) {
      const T = window.THREE;
      const A = plan.nodes[w.a];
      const c = { x: A.x + u.x * o.pos, y: A.y + u.y * o.pos };
      const angle = -Math.atan2(u.y, u.x);
      const hh = top - bottom;
      if (o.kind === 'arco' || hh <= 0) return;
      if (o.kind === 'finestra' || o.kind === 'portafinestra') {
        const glass = new T.Mesh(new T.BoxGeometry(o.w, hh, 0.02), new T.MeshStandardMaterial({ color: '#BFD8E3', transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1 }));
        glass.position.set(c.x, bottom + hh / 2, c.y); glass.rotation.y = angle; this.group.add(glass);
        const frameM = mat({ color: '#F7F7F5' });
        const fw = 0.06;
        for (const [dx, dy, sw, sh] of [[0, hh / 2 - fw / 2, o.w, fw], [0, -hh / 2 + fw / 2, o.w, fw], [-o.w / 2 + fw / 2, 0, fw, hh], [o.w / 2 - fw / 2, 0, fw, hh], [0, 0, fw, hh]]) {
          const fr = new T.Mesh(new T.BoxGeometry(sw, sh, 0.07), frameM);
          fr.position.set(c.x + u.x * dx, bottom + hh / 2 + dy, c.y + u.y * dx); fr.rotation.y = angle; this.group.add(fr);
        }
        if (o.kind === 'finestra') {
          const sill = new T.Mesh(new T.BoxGeometry(o.w + 0.08, 0.03, w.t + 0.06), mat({ color: '#E6E2DA' }));
          sill.position.set(c.x, bottom - 0.015, c.y); sill.rotation.y = angle; this.group.add(sill);
        }
        return;
      }
      // porte: anta chiusa nel varco
      const door = new T.Mesh(new T.BoxGeometry(o.w - 0.02, hh - 0.01, 0.04), mat({ color: o.kind === 'battente' ? '#E9E4DA' : '#D9CFC0', roughness: 0.6 }));
      const side = (o.flipSide ? -1 : 1) * (w.t / 2 - 0.03);
      door.position.set(c.x + n.x * side, bottom + hh / 2, c.y + n.y * side); door.rotation.y = angle;
      door.castShadow = true; this.group.add(door);
      const handle = new T.Mesh(new T.BoxGeometry(0.12, 0.02, 0.06), mat({ color: '#9AA0A6', metalness: 0.6, roughness: 0.3 }));
      const hs = (o.flipHinge ? -1 : 1) * (o.w / 2 - 0.1);
      handle.position.set(c.x + u.x * hs + n.x * side, 1.0, c.y + u.y * hs + n.y * side); handle.rotation.y = angle; this.group.add(handle);
    }

    _wallAngleNear(plan, p) {
      let best = 0, bd = Infinity;
      for (const id in plan.walls) {
        const w = plan.walls[id];
        const A = plan.nodes[w.a], B = plan.nodes[w.b];
        const pr = G.projSeg(p, A, B);
        if (pr.d < bd) { bd = pr.d; best = -Math.atan2(B.y - A.y, B.x - A.x); }
      }
      return best;
    }

    _buildFurniture(f, mat) {
      const T = window.THREE;
      const g = new T.Group();
      const col = f.color || '#D9D4CB';
      const base = mat({ color: col });
      const light = mat({ color: '#F6F4EF' });
      const dark = mat({ color: '#3A3F46' });
      const wood = mat({ color: '#B8946A' });
      const W = f.w, D = f.d, H = f.h || 0.8;
      const box = (w, h, d, x, y, z, m) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m || base); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
      const cyl = (rt, rb, h, x, y, z, m, seg) => { const c = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 20), m || base); c.position.set(x, y, z); c.castShadow = true; g.add(c); return c; };
      const legs = (h, inset, m) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.04, h, 0.04, sx * (W / 2 - inset), h / 2, sz * (D / 2 - inset), m || dark); };
      // nel sistema locale: x = larghezza, z = profondità (retro a -D/2), y in alto
      switch (f.shape) {
        case 'bed': {
          box(W, 0.3, D, 0, 0.15, 0, wood);
          box(W - 0.04, 0.22, D - 0.08, 0, 0.41, 0.03, light);
          box(W, 0.95, 0.06, 0, 0.475, -D / 2 + 0.03, base);
          const pw = W > 1.2 ? (W - 0.3) / 2 : W - 0.2;
          if (W > 1.2) { box(pw, 0.12, 0.35, -pw / 2 - 0.05, 0.58, -D / 2 + 0.3, light); box(pw, 0.12, 0.35, pw / 2 + 0.05, 0.58, -D / 2 + 0.3, light); }
          else box(pw, 0.12, 0.35, 0, 0.58, -D / 2 + 0.3, light);
          box(W - 0.02, 0.05, D * 0.55, 0, 0.545, D * 0.2, base);
          break;
        }
        case 'sofa': case 'armchair': {
          box(W, 0.42, D, 0, 0.21, 0);
          box(W, H - 0.42, 0.2, 0, 0.42 + (H - 0.42) / 2, -D / 2 + 0.1);
          box(0.16, 0.62 - 0.42 + 0.2, D, -W / 2 + 0.08, 0.52, 0); box(0.16, 0.62 - 0.42 + 0.2, D, W / 2 - 0.08, 0.52, 0);
          break;
        }
        case 'sofa_l': {
          box(W, 0.42, 0.92, 0, 0.21, -D / 2 + 0.46); box(W, H - 0.42, 0.2, 0, 0.42 + (H - 0.42) / 2, -D / 2 + 0.1);
          box(0.95, 0.42, D - 0.92, W / 2 - 0.475, 0.21, (0.92) / 2); box(0.2, H - 0.42, D, W / 2 - 0.1, 0.42 + (H - 0.42) / 2, 0);
          break;
        }
        case 'table': case 'desk': box(W, 0.04, D, 0, H - 0.02, 0, f.shape === 'desk' ? base : base); legs(H - 0.04, 0.05); break;
        case 'round_table': cyl(W / 2, W / 2, 0.04, 0, H - 0.02, 0); cyl(0.05, 0.05, H - 0.04, 0, (H - 0.04) / 2, 0, dark); cyl(0.25, 0.25, 0.03, 0, 0.015, 0, dark); break;
        case 'chair': box(W, 0.05, D, 0, 0.46, 0); box(W, H - 0.48, 0.04, 0, 0.48 + (H - 0.48) / 2, -D / 2 + 0.02); legs(0.44, 0.03); break;
        case 'wardrobe': case 'cabinet': case 'kitchen_tall': case 'fridge': case 'washer': {
          box(W, H, D, 0, H / 2, 0);
          if (f.shape === 'washer') { const c = cyl(0.17, 0.17, 0.02, 0, H * 0.45, D / 2 + 0.005, mat({ color: '#9BB3C1', metalness: 0.2 })); c.rotation.x = Math.PI / 2; }
          else if (f.shape !== 'fridge') { const n = Math.max(1, Math.round(W / 0.5)); for (let i = 1; i < n; i++) box(0.006, H - 0.04, 0.006, -W / 2 + W * i / n, H / 2, D / 2 + 0.003, dark); }
          break;
        }
        case 'kitchen_base': box(W, H - 0.04, D - 0.02, 0, (H - 0.04) / 2, -0.01); box(W, 0.04, D, 0, H - 0.02, 0, mat({ color: '#7D7A75', roughness: 0.4 })); break;
        case 'kitchen_wall': box(W, H, D, 0, H / 2, 0); break;
        case 'sink': {
          box(W, H - 0.04, D - 0.02, 0, (H - 0.04) / 2, -0.01); box(W, 0.04, D, 0, H - 0.02, 0, mat({ color: '#7D7A75', roughness: 0.4 }));
          box(Math.min(0.5, W - 0.1), 0.02, D - 0.25, 0, H + 0.001, 0.02, mat({ color: '#A9AEB3', metalness: 0.5, roughness: 0.3 }));
          cyl(0.015, 0.015, 0.3, 0, H + 0.15, -D / 2 + 0.08, mat({ color: '#C8CCD1', metalness: 0.8, roughness: 0.2 }));
          break;
        }
        case 'hob': box(W, H - 0.04, D - 0.02, 0, (H - 0.04) / 2, -0.01); box(W, 0.04, D, 0, H - 0.02, 0, mat({ color: '#7D7A75', roughness: 0.4 })); box(Math.min(0.58, W - 0.04), 0.01, 0.5, 0, H + 0.005, 0, dark); break;
        case 'wc': case 'bidet': box(W * 0.9, 0.38, D * 0.75, 0, 0.21 + 0.19, D * 0.12, light); box(W, 0.6, 0.12, 0, 0.6, -D / 2 + 0.06, light); break;
        case 'basin': box(W, H - 0.1, D, 0, (H - 0.1) / 2 + 0.1 * 0, base); box(W, 0.1, D, 0, H - 0.05, 0, light); break;
        case 'shower': {
          box(W, 0.05, D, 0, 0.025, 0, light);
          const glass = new T.MeshStandardMaterial({ color: '#CFE3EA', transparent: true, opacity: 0.25, roughness: 0.05 });
          box(W, 2.0, 0.01, 0, 1.05, D / 2, glass); box(0.01, 2.0, D, W / 2, 1.05, 0, glass);
          break;
        }
        case 'bath': box(W, H, D, 0, H / 2, 0, light); box(W - 0.14, 0.02, D - 0.14, 0, H + 0.001, 0, mat({ color: '#D5E5EA' })); break;
        case 'tv': box(W, H, Math.max(D, 0.04), 0, H / 2, 0, dark); break;
        case 'shelf': {
          box(W, H, 0.02, 0, H / 2, -D / 2 + 0.01); box(0.02, H, D, -W / 2 + 0.01, H / 2, 0); box(0.02, H, D, W / 2 - 0.01, H / 2, 0);
          for (let i = 0; i <= 5; i++) box(W, 0.02, D, 0, 0.01 + (H - 0.02) * i / 5, 0);
          break;
        }
        case 'rug': box(W, 0.01, D, 0, 0.005, 0); break;
        case 'plant': cyl(0.16, 0.12, 0.35, 0, 0.175, 0, mat({ color: '#B98E62' })); { const s = new T.Mesh(new T.SphereGeometry(Math.min(W, D) / 2, 16, 12), mat({ color: '#5E8C61' })); s.position.y = 0.35 + (H - 0.35) / 2; s.scale.y = (H - 0.35) / Math.min(W, D); s.castShadow = true; g.add(s); } break;
        case 'tree': cyl(0.12, 0.16, H * 0.45, 0, H * 0.225, 0, mat({ color: '#7A5A3C' })); { const s = new T.Mesh(new T.SphereGeometry(Math.min(W, D) / 2, 16, 12), mat({ color: '#5E8C61' })); s.position.y = H * 0.65; s.castShadow = true; g.add(s); } break;
        case 'lamp_floor': cyl(0.12, 0.14, 0.03, 0, 0.015, 0, dark); cyl(0.012, 0.012, H - 0.2, 0, (H - 0.2) / 2, 0, dark); cyl(0.1, W / 2, 0.24, 0, H - 0.12, 0, mat({ color: '#F1E7C9', emissive: '#FFE7B0', emissiveIntensity: 0.5 })); break;
        case 'lamp_ceiling': { const sh = cyl(0.06, W / 2, H, 0, H / 2, 0, mat({ color: '#F1E7C9', emissive: '#FFE7B0', emissiveIntensity: 0.6 })); sh.castShadow = false; cyl(0.006, 0.006, 3, 0, H + 1.5, 0, dark); break; }
        case 'curtain': box(W, H, Math.max(D, 0.03), 0, H / 2, 0); break;
        case 'mirror': box(W, H, Math.max(D, 0.02), 0, H / 2, 0, mat({ color: '#D8E6EC', metalness: 0.7, roughness: 0.05 })); break;
        case 'picture': box(W, H, Math.max(D, 0.02), 0, H / 2, 0); break;
        case 'umbrella': cyl(0.02, 0.02, H, 0, H / 2, 0, dark); { const c = new T.Mesh(new T.ConeGeometry(W / 2, 0.5, 16), base); c.position.y = H - 0.1; c.castShadow = true; g.add(c); } break;
        case 'pergola': for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.1, H, 0.1, sx * (W / 2 - 0.05), H / 2, sz * (D / 2 - 0.05), wood); { const n = Math.max(3, Math.round(W / 0.4)); for (let i = 0; i <= n; i++) box(0.05, 0.12, D, -W / 2 + W * i / n, H, 0, wood); } break;
        case 'hedge': box(W, H, D, 0, H / 2, 0, mat({ color: '#5E8C61' })); break;
        case 'car': box(W, H * 0.45, D, 0, 0.15 + H * 0.225, 0); box(W * 0.9, H * 0.35, D * 0.5, 0, 0.15 + H * 0.45 + H * 0.175, -D * 0.05, mat({ color: '#2F3A46' })); break;
        case 'path': box(W, 0.03, D, 0, 0.015, 0, mat({ color: col, roughness: 1 })); break;
        case 'fence': {
          const n = Math.max(2, Math.round(W / 1.0));
          for (let i = 0; i <= n; i++) box(0.07, H, 0.07, -W / 2 + W * i / n, H / 2, 0);
          box(W, 0.06, 0.04, 0, H * 0.85, 0); box(W, 0.06, 0.04, 0, H * 0.35, 0);
          if (col === '#3A3F46') for (let i = 0; i < Math.round(W / 0.12); i++) box(0.02, H * 0.9, 0.02, -W / 2 + 0.06 + i * 0.12, H * 0.45, 0);
          break;
        }
        case 'lounger': box(W, 0.3, D, 0, 0.15, 0); box(W, 0.06, D * 0.35, 0, 0.45, -D / 2 + D * 0.17); break;
        default: box(W, H, D, 0, H / 2, 0);
      }
      g.position.set(f.x, f.elev || 0, f.y);
      g.rotation.y = -(f.rot || 0);
      this.group.add(g);
      if (f.light && this.lamps.length < 6) {
        const l = new T.PointLight('#FFE2B0', 2.2, 6, 1.6);
        l.position.set(f.x, (f.elev || 0) + (f.shape === 'lamp_ceiling' ? 0 : H - 0.15), f.y);
        this.group.add(l);
        this.lamps.push(l);
      }
    }

    /* ---------- Sole ---------- */
    updateSun() {
      if (!this.ready) return;
      const lat = (this.project && this.project.lat) || 41.9;
      const s = CM.sun(lat, this.day, this.hour);
      this.sunInfo = s;
      const b = this.bounds || { minX: 0, minY: 0, maxX: 8, maxY: 6 };
      const cx = (b.minX + b.maxX) / 2, cz = (b.minY + b.maxY) / 2;
      const size = Math.max(b.maxX - b.minX, b.maxY - b.minY, 4);
      const north = ((this.project && this.project.north) || 0) * Math.PI / 180;
      const N = { x: Math.sin(north), z: -Math.cos(north) }, E = { x: Math.cos(north), z: Math.sin(north) };
      const az = s.azimuth * Math.PI / 180, el = Math.max(s.elevation, 2) * Math.PI / 180;
      const hx = N.x * Math.cos(az) + E.x * Math.sin(az), hz = N.z * Math.cos(az) + E.z * Math.sin(az);
      const dist = size * 2;
      this.sunLight.position.set(cx + hx * Math.cos(el) * dist, Math.sin(el) * dist, cz + hz * Math.cos(el) * dist);
      this.sunLight.target.position.set(cx, 0, cz);
      const cam = this.sunLight.shadow.camera;
      cam.left = cam.bottom = -size * 0.9; cam.right = cam.top = size * 0.9; cam.near = 0.5; cam.far = dist * 2.5;
      cam.updateProjectionMatrix();
      const day = s.elevation > 0;
      this.sunLight.intensity = day ? 0.6 + 2.0 * Math.min(1, s.elevation / 35) : 0;
      this.hemi.intensity = day ? 0.75 : 0.25;
      this.scene.background.set(day ? (s.elevation < 8 ? '#F1DCC8' : '#E9EEF2') : '#2B3442');
      this.sunLight.color.set(s.elevation < 10 ? '#FFD8A8' : '#FFF4E0');
      for (const l of this.lamps || []) l.intensity = day ? 1.2 : 3.2;
      this.dirty = true;
    }

    /* ---------- Camera e comandi ---------- */
    resetCamera() {
      const b = this.bounds || { minX: 0, minY: 0, maxX: 8, maxY: 6 };
      this.orbit.target = { x: (b.minX + b.maxX) / 2, y: 0.8, z: (b.minY + b.maxY) / 2 };
      this.orbit.r = Math.max(b.maxX - b.minX, b.maxY - b.minY, 4) * 1.35;
      this.orbit.theta = -0.7; this.orbit.phi = 0.9;
      // passeggiata: parti dal centro della stanza più grande
      let best = null, ba = 0;
      for (const id in this.plan.rooms) { const st = P.roomStats(this.plan, this.plan.rooms[id]); if (st.net > ba && !CM.roomType(this.plan.rooms[id].type).outdoor) { ba = st.net; best = id; } }
      const c = best ? G.labelPoint(P.roomPts(this.plan, this.plan.rooms[best])) : { x: this.orbit.target.x, y: this.orbit.target.z };
      this.walk.x = c.x; this.walk.z = c.y; this.walk.yaw = 0; this.walk.pitch = -0.05;
      this.dirty = true;
    }

    setMode(m) { this.mode = m; this.walk.move = { x: 0, y: 0 }; this.dirty = true; }

    _render() {
      const T = window.THREE;
      if (this.mode === 'walk') {
        this.camera.fov = 70;
        this.camera.position.set(this.walk.x, EYE, this.walk.z);
        const dir = new T.Vector3(Math.sin(this.walk.yaw) * Math.cos(this.walk.pitch), Math.sin(this.walk.pitch), -Math.cos(this.walk.yaw) * Math.cos(this.walk.pitch));
        this.camera.lookAt(this.walk.x + dir.x, EYE + dir.y, this.walk.z + dir.z);
      } else {
        this.camera.fov = 50;
        const o = this.orbit;
        this.camera.position.set(o.target.x + o.r * Math.sin(o.phi) * Math.sin(o.theta), o.target.y + o.r * Math.cos(o.phi), o.target.z + o.r * Math.sin(o.phi) * Math.cos(o.theta));
        this.camera.lookAt(o.target.x, o.target.y, o.target.z);
      }
      this.camera.updateProjectionMatrix();
      this.renderer.render(this.scene, this.camera);
    }

    _bind() {
      const el = this.renderer.domElement;
      const pos = (e) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); this.pointers.set(e.pointerId, pos(e)); this._g = null; });
      el.addEventListener('pointermove', e => {
        if (!this.pointers.has(e.pointerId)) return;
        const p = pos(e), prev = this.pointers.get(e.pointerId);
        this.pointers.set(e.pointerId, p);
        const pts = [...this.pointers.values()];
        if (pts.length === 1) {
          const dx = p.x - prev.x, dy = p.y - prev.y;
          if (this.mode === 'walk') { this.walk.yaw += dx * 0.005; this.walk.pitch = Math.max(-1.2, Math.min(1.2, this.walk.pitch - dy * 0.004)); }
          else { this.orbit.theta -= dx * 0.008; this.orbit.phi = Math.max(0.12, Math.min(1.5, this.orbit.phi - dy * 0.006)); }
          this.dirty = true;
        } else if (pts.length === 2) {
          const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
          const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
          if (this._g && this.mode === 'orbit') {
            this.orbit.r = Math.max(2, Math.min(120, this.orbit.r * this._g.d / d));
            // spostamento del punto osservato
            const k = this.orbit.r * 0.0016;
            const mx = mid.x - this._g.mid.x, my = mid.y - this._g.mid.y;
            const th = this.orbit.theta;
            this.orbit.target.x -= (Math.cos(th) * mx - Math.sin(th) * my) * k;
            this.orbit.target.z -= (-Math.sin(th) * mx - Math.cos(th) * my) * k;
          }
          this._g = { d, mid };
          this.dirty = true;
        }
      });
      const up = e => { this.pointers.delete(e.pointerId); this._g = null; };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('wheel', e => { e.preventDefault(); if (this.mode === 'orbit') { this.orbit.r = Math.max(2, Math.min(120, this.orbit.r * Math.exp(e.deltaY * 0.001))); this.dirty = true; } }, { passive: false });
    }

    // Movimento con il joystick (x: laterale, y: avanti)
    setMove(x, y) { this.walk.move = { x, y }; }

    _stepWalk() {
      const speed = 0.045;
      const fw = { x: Math.sin(this.walk.yaw), z: -Math.cos(this.walk.yaw) };
      const rt = { x: Math.cos(this.walk.yaw), z: Math.sin(this.walk.yaw) };
      const nx = this.walk.x + (fw.x * this.walk.move.y + rt.x * this.walk.move.x) * speed;
      const nz = this.walk.z + (fw.z * this.walk.move.y + rt.z * this.walk.move.x) * speed;
      if (this._canMove({ x: this.walk.x, y: this.walk.z }, { x: nx, y: nz })) { this.walk.x = nx; this.walk.z = nz; }
      else if (this._canMove({ x: this.walk.x, y: this.walk.z }, { x: nx, y: this.walk.z })) this.walk.x = nx;
      else if (this._canMove({ x: this.walk.x, y: this.walk.z }, { x: this.walk.x, y: nz })) this.walk.z = nz;
      this.dirty = true;
    }

    // Collisione con i muri: si passa solo attraverso porte, archi e portefinestre
    _canMove(a, b) {
      const plan = this.plan;
      for (const id in plan.walls) {
        const w = plan.walls[id];
        if (this.phase === 'dopo' && w.state === 'demolire') continue;
        if (this.phase === 'prima' && w.state === 'nuovo') continue;
        const A = plan.nodes[w.a], B = plan.nodes[w.b];
        const pr = G.projSeg(b, A, B);
        if (pr.d > w.t / 2 + 0.22) continue;
        const along = pr.t * pr.L;
        if (along < -0.2 || along > pr.L + 0.2) continue;
        const passable = Object.values(plan.openings).some(o => o.wall === id && o.kind !== 'finestra' && along > o.pos - o.w / 2 + 0.12 && along < o.pos + o.w / 2 - 0.12);
        if (passable) continue;
        // permetti di allontanarsi da un muro
        if (G.projSeg(a, A, B).d < pr.d) continue;
        return false;
      }
      return true;
    }

    snapshot() { this._render(); return this.renderer.domElement.toDataURL('image/jpeg', 0.92); }
  }

  CM.View3D = View3D;
})(typeof window !== 'undefined' ? window : globalThis);
