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
    } else if (kind === 'weave') {
      // trama del lino
      for (let y = 0; y < 512; y += 4) { x.fillStyle = shade(color, 0.93 + r() * 0.1); x.fillRect(0, y, 512, 2); }
      for (let xx = 0; xx < 512; xx += 4) { x.fillStyle = 'rgba(255,255,255,' + (0.03 + r() * 0.05) + ')'; x.fillRect(xx, 0, 2, 512); }
    } else if (kind === 'boucle') {
      for (let i = 0; i < 9000; i++) { x.fillStyle = shade(color, 0.85 + r() * 0.3); const rr = 1 + r() * 2.5; x.beginPath(); x.arc(r() * 512, r() * 512, rr, 0, Math.PI * 2); x.fill(); }
    } else if (kind === 'woodgrain') {
      // venatura per i mobili
      for (let i = 0; i < 70; i++) { x.strokeStyle = shade(color, 0.86 + r() * 0.2); x.lineWidth = 1 + r() * 3; x.beginPath(); const y0 = r() * 512; x.moveTo(0, y0); for (let xx = 0; xx <= 512; xx += 32) x.lineTo(xx, y0 + Math.sin(xx / 60 + i) * 6 + (r() - 0.5) * 3); x.stroke(); }
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
      this.hooks = hooks || {};
      this.quality = (CM.store && CM.store.pref('q3d')) || 'leggero';
      this.lowWalls = true; // dall'alto si vede dentro le stanze; in passeggiata i muri tornano interi
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
        this.renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
      } catch (e) {
        console.error('WebGL non disponibile: ' + e.message);
        return false;
      }
      const hi = this.quality === 'realistico';
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hi ? 2 : 1.5));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = T.PCFSoftShadowMap;
      this.renderer.shadowMap.autoUpdate = true;
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
      this.sunLight.shadow.mapSize.set(hi ? 4096 : 2048, hi ? 4096 : 2048);
      this.sunLight.shadow.normalBias = 0.02;
      // luce di riempimento morbida (solo realistico): ammorbidisce le ombre dentro le stanze
      this.fill = new T.DirectionalLight('#FFF8EE', hi ? 0.45 : 0.3);
      this.fill.position.set(-10, 12, 8);
      this.scene.add(this.fill);
      this.sunLight.shadow.bias = -0.0006;
      this.scene.add(this.sunLight, this.sunLight.target);
      this.group = new T.Group();
      this.scene.add(this.group);
      this._bind();
      this.ready = true;
      // Disegno solo quando serve: niente ciclo continuo (consuma batteria e scalda il telefono)
      let d = true;
      Object.defineProperty(this, 'dirty', { get: () => d, set: (x) => { d = x; if (x) this._kick(); }, configurable: true });
      this._kick();
      return true;
    }

    _kick() {
      if (this._raf || !this.ready || !this.visible || document.hidden) return;
      this._raf = requestAnimationFrame(() => {
        this._raf = 0;
        if (!this.visible || document.hidden) return;
        const moving = this.mode === 'walk' && (this.walk.move.x || this.walk.move.y);
        if (moving) this._stepWalk();
        if (this.dirty || moving) { this.dirty = false; this._render(); }
        if (moving) this._kick();
      });
    }

    setVisible(v) { this.visible = v; if (v) { this.resize(); this.dirty = true; } else if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; } }

    resize() {
      if (!this.ready) return;
      const r = this.container.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      if (w === this._w && h === this._h) return;
      this._w = w; this._h = h;
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
      const low = this.lowWalls && this.mode !== 'walk';
      const wallH = (w) => (low ? 1.05 : (w.h || 2.7));
      for (const id in plan.walls) {
        const w = plan.walls[id];
        if (this.phase === 'dopo' && w.state === 'demolire') continue;
        if (this.phase === 'prima' && w.state === 'nuovo') continue;
        this._buildWall(plan, id, w, wallH(w), mat);
      }
      // pilastri e travi
      for (const id in plan.columns) {
        const c = plan.columns[id];
        const h = low ? 1.05 : 2.7;
        const m = new T.Mesh(new T.BoxGeometry(c.w, h, c.d), mat({ color: '#E7E4DE' }));
        m.position.set(c.x, h / 2, c.y); m.castShadow = m.receiveShadow = true; this.group.add(m);
      }
      if (!low) for (const id in plan.beams) {
        const bm = plan.beams[id];
        const len = Math.hypot(bm.x2 - bm.x1, bm.y2 - bm.y1);
        const m = new T.Mesh(new T.BoxGeometry(len, 0.3, bm.w), mat({ color: '#E7E4DE' }));
        m.position.set((bm.x1 + bm.x2) / 2, 2.55, (bm.y1 + bm.y2) / 2);
        m.rotation.y = -Math.atan2(bm.y2 - bm.y1, bm.x2 - bm.x1);
        m.castShadow = true; this.group.add(m);
      }
      // arredi
      for (const id in plan.furniture) { plan.furniture[id]._id = id; this._buildFurniture(plan.furniture[id], mat); delete plan.furniture[id]._id; }
      // impianti visibili (termosifoni, condizionatori, caldaia)
      const layers = (project.settings && project.settings.layers) || {};
      for (const id in plan.fixtures) {
        const fx = plan.fixtures[id];
        const def = CM.FIXTURES[fx.kind];
        if (!def) continue;
        const rot = this._wallAngleNear(plan, fx);
        const big = ['termosifone', 'condizionatore', 'caldaia', 'quadro'].includes(fx.kind);
        if (!big && layers.impianti === false && !this.editMode) continue;
        let m;
        if (big) {
          const dims = { termosifone: [0.8, 0.6, 0.1], condizionatore: [0.85, 0.3, 0.22], caldaia: [0.45, 0.7, 0.35], quadro: [0.4, 0.5, 0.1] }[fx.kind];
          m = new T.Mesh(new T.BoxGeometry(dims[0], dims[1], dims[2]), mat({ color: '#F4F4F2' }));
          m.position.set(fx.x, def.elev + dims[1] / 2, fx.y);
        } else if (fx.kind === 'luce') {
          // punto luce a soffitto: un piccolo disco; con i muri bassi resta sospeso a mezz'aria per vederlo
          m = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 0.03, 20), mat({ color: '#FFF6DA', emissive: '#FFE7B0', emissiveIntensity: 0.5 }));
          m.position.set(fx.x, low ? 1.6 : def.elev, fx.y);
        } else {
          // placchette di prese, interruttori, attacchi: colore del tipo di impianto
          const col = (CM.FIXTURE_GROUPS[def.group] || {}).color || '#888';
          m = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 0.03), mat({ color: '#FAFAF8' }));
          const dot = new T.Mesh(new T.BoxGeometry(0.05, 0.05, 0.035), mat({ color: col }));
          m.add(dot);
          m.position.set(fx.x, Math.min(def.elev, low ? 1.0 : 9), fx.y);
        }
        m.rotation.y = rot; m.castShadow = big;
        m.userData = { kind: 'fixture', id };
        this.group.add(m);
        if (this.editMode) {
          const hb = new T.Mesh(new T.SphereGeometry(0.24, 8, 6), new T.MeshBasicMaterial());
          hb.position.copy(m.position); hb.visible = false; hb.userData = { kind: 'fixture', id, hitbox: true };
          this.group.add(hb);
        }
      }
      this._applySel();

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
      if (!m) {
        // pavimento di base credibile finch\u00e9 non ne scegli uno
        const wet = ['bagno', 'cucina', 'lavanderia'].includes(room.type), out = CM.roomType(room.type).outdoor;
        const def = out ? { id: 'def-out', tex: 'tile', color: '#CFCBC3', tw: 0.3, th: 0.3 } : wet ? { id: 'def-wet', tex: 'tile', color: '#E3DFD8', tw: 0.6, th: 0.6 } : { id: 'def-wood', tex: 'wood', color: '#D4B48E', tw: 0.19, th: 1.2 };
        return new T.MeshStandardMaterial({ map: this._surfaceTexture(def, 'dritta', redraw), roughness: def.tex === 'wood' ? 0.7 : 0.55 });
      }
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
      if (f && f.accent && f.accent.color && (f.accent.walls || []).includes(wallId)) return new T.MeshStandardMaterial({ color: f.accent.color, roughness: 0.92 });
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
      const ops = Object.keys(plan.openings).filter(k => plan.openings[k].wall === id).map(k => Object.assign({ _id: k }, plan.openings[k])).sort((a, b) => a.pos - b.pos);
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
        const before = this.group.children.length;
        this._buildOpening(plan, o, u, n, w, bottom, topO, mat);
        for (let k = before; k < this.group.children.length; k++) this.group.children[k].userData = { kind: 'opening', id: o._id, wall: id };
        // area invisibile per toccare facilmente porte e finestre (anche gli archi)
        if (this.editMode) {
          const hb = new T.Mesh(new T.BoxGeometry(o.w, Math.max(topO - bottom, 0.3), w.t + 0.08), new T.MeshBasicMaterial());
          const oc = { x: A.x + u.x * o.pos, y: A.y + u.y * o.pos };
          hb.position.set(oc.x, bottom + Math.max(topO - bottom, 0.3) / 2, oc.y); hb.rotation.y = -Math.atan2(u.y, u.x);
          hb.visible = false; hb.userData = { kind: 'opening', id: o._id, wall: id, hitbox: true };
          this.group.add(hb);
        }
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
        m.userData = { kind: 'wall', id, rooms: [roomPlus, roomMinus] };
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

    // Geometria a spigoli arrotondati (cuscini, materassi) per la qualit\u00e0 realistica
    _rbox(w, h, d, r) {
      const T = window.THREE;
      this._geoCache = this._geoCache || new Map();
      const key = [w, h, d, r].map(v => v.toFixed(3)).join('|');
      if (this._geoCache.has(key)) return this._geoCache.get(key);
      r = Math.max(0.002, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
      const sh = new T.Shape();
      const x0 = -w / 2 + r, x1 = w / 2 - r, y0 = -h / 2 + r, y1 = h / 2 - r;
      sh.moveTo(x0, -h / 2); sh.lineTo(x1, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, y0); sh.lineTo(w / 2, y1); sh.quadraticCurveTo(w / 2, h / 2, x1, h / 2);
      sh.lineTo(x0, h / 2); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, y1); sh.lineTo(-w / 2, y0); sh.quadraticCurveTo(-w / 2, -h / 2, x0, -h / 2);
      const geo = new T.ExtrudeGeometry(sh, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.6, bevelSegments: 3, curveSegments: 4 });
      geo.translate(0, 0, -(d - 2 * r) / 2);
      this._geoCache.set(key, geo);
      return geo;
    }

    // Materiali di un mobile dalle sue finiture (tessuto, legno, metallo)
    _furnMats(f) {
      const T = window.THREE;
      const hi = this.quality === 'realistico';
      const ST = CM.style;
      const col = f.color || '#D9D4CB';
      const kind = ST ? ST.kind(f) : null;
      const fab = ST ? ST.fabric(f.fabric) : { rough: 0.85, sheen: 0, pattern: null };
      const fabricMat = () => {
        const o = { color: col, roughness: fab.rough, metalness: 0 };
        if (fab.pattern && hi) { const t = canvasTexture(fab.pattern, col).clone(); t.needsUpdate = true; t.repeat.set(2, 2); o.map = t; o.color = '#FFFFFF'; }
        if (f.fabric === 'velluto') { o.roughness = 0.55; }
        if (f.fabric === 'pelle') { o.roughness = 0.42; }
        const m = (hi && T.MeshPhysicalMaterial) ? new T.MeshPhysicalMaterial(Object.assign(o, f.fabric === 'velluto' ? { sheen: 1, sheenColor: new T.Color(col).offsetHSL(0, 0, 0.15), sheenRoughness: 0.5 } : {})) : new T.MeshStandardMaterial(o);
        return m;
      };
      const w = ST && f.wood ? ST.wood(f.wood) : null;
      const woodCol = w ? w.color : (kind === 'wood' ? col : '#B8946A');
      const woodMat = () => {
        if (w && w.plain) return new T.MeshStandardMaterial({ color: woodCol, roughness: 0.45 });
        const t = canvasTexture('woodgrain', woodCol).clone(); t.needsUpdate = true; t.repeat.set(1, 1);
        return new T.MeshStandardMaterial({ map: t, roughness: 0.6 });
      };
      const mt = ST && f.metal ? ST.metal(f.metal) : null;
      const metalMat = new T.MeshStandardMaterial(mt ? { color: mt.color, metalness: mt.metal, roughness: mt.rough } : { color: '#3A3F46', roughness: 0.6, metalness: 0.3 });
      const main = kind === 'fabric' ? fabricMat() : kind === 'wood' ? woodMat() : new T.MeshStandardMaterial({ color: col, roughness: 0.8 });
      return { main, fabric: kind === 'fabric' ? main : fabricMat(), wood: kind === 'wood' ? main : woodMat(), metal: metalMat, hi };
    }

    // Modelli dei negozi: caricati una volta, poi riusati
    _model(id) {
      this._models = this._models || {};
      const c = this._models[id];
      if (c && c.obj) return c.obj;
      if (c) return null; // in caricamento o non disponibile
      this._models[id] = { loading: true };
      const data = CM.store.getRaw('mdl_' + id);
      if (!data) { this._models[id] = { failed: true }; return null; }
      CM.glb.parse(CM.glb.fromDataUrl(data)).then(obj => { this._models[id] = { obj }; if (this.project) this.build(this.project); })
        .catch(e => { console.warn && 0; this._models[id] = { failed: true, err: String(e.message || e) }; });
      return null;
    }

    // Composizione componibile: moduli affiancati con frontali, maniglie, zoccolo, top e pensili
    _buildComposite(f, g, M, mat, box, cyl) {
      const T = window.THREE;
      const CF = CM.config, S = CF && CF.SYSTEMS[f.system] || { kitchen: false };
      const KH = CF ? CF.KITCHEN_H : { base: 0.88, top: 0.04, plinth: 0.1, wallBottom: 1.45, wallH: 0.8, wallD: 0.37, d: 0.6 };
      const W = f.w, D = f.d;
      const front = new T.MeshStandardMaterial({ color: (f.front && f.front.color) || f.color || '#F1EFEA', roughness: /lucido/i.test((f.front && f.front.name) || '') ? 0.25 : 0.55 });
      const body = new T.MeshStandardMaterial({ color: '#EDEBE6', roughness: 0.7 });
      const metal = M.metal;
      const dark = mat({ color: '#2B2E33', roughness: 0.4 });
      const steel = mat({ color: '#B9BEC4', metalness: 0.8, roughness: 0.3 });
      const glass = new T.MeshStandardMaterial({ color: '#D8E6EC', transparent: true, opacity: 0.45, roughness: 0.05 });
      const mirror = mat({ color: '#D8E6EC', metalness: 0.9, roughness: 0.05 });
      const style = (f.front && f.front.style) || 'liscio';
      const handleType = f.handle || 'maniglia';
      const panel = (w, h, x, y, z, m) => {
        box(w - 0.004, h - 0.004, 0.018, x, y, z, m || front);
        if (style === 'telaio' && w > 0.2 && h > 0.2) { const t = 0.05; box(w - 2 * t, h - 2 * t, 0.006, x, y, z + 0.011, m || front); }
        if (style === 'cannettato') { const n = Math.max(3, Math.round(w / 0.025)); for (let i = 0; i < n; i++) box(0.01, h - 0.02, 0.006, x - w / 2 + (i + 0.5) * w / n, y, z + 0.011, m || front); }
      };
      const handle = (x, y, z, vertical, len) => {
        if (handleType === 'gola') return;
        if (handleType === 'pomolo') { const c = cyl(0.012, 0.012, 0.025, x, y, z + 0.022, metal, 10); c.rotation.x = Math.PI / 2; return; }
        const L = len || 0.16;
        box(vertical ? 0.012 : L, vertical ? L : 0.012, 0.02, x, y, z + 0.02, metal);
      };
      const drawers = (x, y0, w, h, z, n) => { for (let i = 0; i < n; i++) { const hh = h / n; const yy = y0 + hh * (i + 0.5); panel(w, hh, x, yy, z); handle(x, yy + hh * 0.3, z, false, Math.min(0.3, w * 0.5)); } };
      const mount = f.mount || 0;
      const floor = (f.modules || []).filter(m => !m.wall), wall = (f.modules || []).filter(m => m.wall);
      let x = -W / 2;
      const zf = D / 2 - 0.009; // faccia dei frontali
      let topRuns = [], runStart = null;
      for (const m of floor) {
        const cx = x + m.w / 2;
        const tall = !!m.h && m.h > 1.2;
        const H = S.kitchen ? (tall ? m.h : KH.base) : (m.h || (f.body && f.body.h) || f.h);
        const dd = m.d || (f.body && f.body.d) || D;
        const y0 = S.kitchen ? KH.plinth : mount;
        const hb = S.kitchen ? (tall ? H - KH.plinth : KH.base - KH.plinth - KH.top) : H;
        // zoccolo (cucina) o piedini
        if (S.kitchen) box(m.w, KH.plinth, dd - 0.06, cx, KH.plinth / 2, -0.03 - (D - dd) / 2, dark);
        box(m.w - 0.004, hb, dd - 0.02, cx, y0 + hb / 2, -0.01 - (D - dd) / 2, body);
        const z = -D / 2 + dd - 0.009;
        const yc = y0 + hb / 2;
        switch (m.kind) {
          case 'ante2': case 'lavello': panel(m.w / 2, hb, cx - m.w / 4, yc, z); panel(m.w / 2, hb, cx + m.w / 4, yc, z); handle(cx - 0.03, y0 + Math.min(hb * 0.55, 1.05), z, true, hb > 1.2 ? 0.3 : 0.12); handle(cx + 0.03, y0 + Math.min(hb * 0.55, 1.05), z, true, hb > 1.2 ? 0.3 : 0.12); break;
          case 'scorrevole': panel(m.w / 2 + 0.03, hb, cx - m.w / 4 + 0.015, yc, z + 0.025); panel(m.w / 2 + 0.03, hb, cx + m.w / 4 - 0.015, yc, z); break;
          case 'cassetti': case 'cottura': {
            if (hb > 1.2) { panel(m.w, hb * 0.55, cx, y0 + hb * 0.725, z); handle(cx + m.w / 2 - 0.05, y0 + hb * 0.6, z, true, 0.3); drawers(cx, y0, m.w, hb * 0.45, z, 3); }
            else drawers(cx, y0, m.w, hb, z, 3);
            break;
          }
          case 'aperto': { for (let i = 1; i < 5; i++) box(m.w - 0.03, 0.018, dd - 0.04, cx, y0 + hb * i / 5, 0, body); break; }
          case 'vetro': panel(m.w, hb, cx, yc, z, glass); handle(cx + m.w / 2 - 0.05, yc, z, true); break;
          case 'specchio': panel(m.w, hb, cx, yc, z, mirror); handle(cx + m.w / 2 - 0.05, yc, z, true); break;
          case 'forno': panel(m.w, hb * 0.18, cx, y0 + hb * 0.09, z); box(m.w - 0.02, hb * 0.78, 0.02, cx, y0 + hb * 0.6, z, dark); handle(cx, y0 + hb * 0.92, z, false, m.w * 0.7); break;
          case 'colonnaForno': panel(m.w, hb * 0.3, cx, y0 + hb * 0.15, z); box(m.w - 0.02, hb * 0.22, 0.02, cx, y0 + hb * 0.45, z, dark); box(m.w - 0.02, hb * 0.12, 0.02, cx, y0 + hb * 0.63, z, dark); panel(m.w, hb * 0.3, cx, y0 + hb * 0.85, z); break;
          case 'colonnaFrigo': panel(m.w, hb * 0.6, cx, y0 + hb * 0.3, z); panel(m.w, hb * 0.4, cx, y0 + hb * 0.8, z); handle(cx + m.w / 2 - 0.05, y0 + hb * 0.5, z, true, 0.3); handle(cx + m.w / 2 - 0.05, y0 + hb * 0.68, z, true, 0.2); break;
          case 'lavastoviglie': panel(m.w, hb, cx, yc, z); handle(cx, y0 + hb - 0.05, z, false, m.w * 0.6); break;
          case 'lavabo': { panel(m.w, hb / 2, cx, y0 + hb * 0.25, z); panel(m.w, hb / 2, cx, y0 + hb * 0.75, z); handle(cx, y0 + hb * 0.4, z, false, 0.2); handle(cx, y0 + hb * 0.9, z, false, 0.2); box(m.w + 0.01, 0.06, dd + 0.01, cx, y0 + hb + 0.03, 0, mat({ color: '#FFFFFF', roughness: 0.2 })); cyl(0.012, 0.012, 0.18, cx, y0 + hb + 0.15, -dd / 2 + 0.08, steel); break; }
          case 'angolo': panel(m.w * 0.45, hb, cx + m.w * 0.27, yc, z); box(m.w * 0.55, hb, 0.02, cx - m.w * 0.22, yc, z, body); handle(cx + 0.06, y0 + hb - 0.08, z, false); break;
          default: panel(m.w, hb, cx, yc, z); handle(cx + m.w / 2 - 0.05, hb > 1.2 ? y0 + 1.05 : y0 + hb - 0.08, z, true, hb > 1.2 ? 0.3 : 0.12);
        }
        // top della cucina: tratti continui tra le colonne
        if (S.kitchen && !tall) { if (runStart == null) runStart = x; }
        else if (runStart != null) { topRuns.push([runStart, x]); runStart = null; }
        if (S.kitchen && m.kind === 'lavello') box(Math.min(0.5, m.w - 0.15), 0.01, 0.4, cx, KH.base + 0.006, 0.02, steel);
        if (S.kitchen && m.kind === 'cottura') { box(Math.min(0.58, m.w - 0.04), 0.008, 0.5, cx, KH.base + 0.005, 0.02, dark); }
        if (S.kitchen && m.kind === 'lavello') { const c = cyl(0.012, 0.012, 0.3, cx, KH.base + 0.15, -D / 2 + 0.07, steel); c.castShadow = true; }
        x += m.w;
      }
      if (runStart != null) topRuns.push([runStart, x]);
      const topMat = mat({ color: (f.worktop && f.worktop.color) || '#7D7A75', roughness: /quarzo|marmo/i.test((f.worktop && f.worktop.name) || '') ? 0.25 : 0.5 });
      if (S.kitchen) for (const [a, b] of topRuns) box(b - a, KH.top, D + 0.02, (a + b) / 2, KH.base - KH.top / 2, 0.01, topMat);
      // pensili / contenitori a parete (dopo le colonne alte iniziali)
      x = -W / 2 + (CF ? CF.wallStart(f) : 0);
      for (const m of wall) {
        const cx = x + m.w / 2;
        const hh = S.kitchen ? KH.wallH : (m.h || 0.7);
        const yb = S.kitchen ? KH.wallBottom : mount + ((f.body && f.body.h) || 0.6) + 0.35;
        const dd = S.kitchen ? KH.wallD : (m.d || 0.15);
        box(m.w - 0.004, hh, dd - 0.02, cx, yb + hh / 2, -D / 2 + dd / 2 - 0.01, body);
        const z = -D / 2 + dd - 0.009;
        if (m.kind === 'specchio') panel(m.w, hh, cx, yb + hh / 2, z, mirror);
        else { panel(m.w, hh, cx, yb + hh / 2, z); handle(cx + m.w / 2 - 0.05, yb + 0.08, z, true, 0.12); }
        if (m.kind === 'cappa') box(m.w * 0.9, 0.06, dd + 0.05, cx, yb - 0.03, -D / 2 + dd / 2, steel);
        x += m.w;
      }
      void g;
    }

    _buildFurniture(f, mat) {
      const T = window.THREE;
      const g = new T.Group();
      g.userData = { kind: 'furniture', id: f._id };
      const col = f.color || '#D9D4CB';
      const M = this._furnMats(f);
      const base = M.main;
      const light = mat({ color: '#F6F4EF' });
      const dark = M.metal;
      const wood = M.wood;
      const hi = M.hi;
      const W = f.w, D = f.d, H = f.h || 0.8;
      const box = (w, h, d, x, y, z, m) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m || base); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
      // modello 3D vero del negozio, se l'abbiamo
      if (f.model && CM.glb) {
        const mdl = this._model(f.model);
        if (mdl) {
          const obj = CM.glb.fit(mdl.clone(true), W, D, H);
          g.add(obj);
          g.position.set(f.x, f.elev || 0, f.y); g.rotation.y = -(f.rot || 0);
          this.group.add(g);
          return;
        }
      }
      const soft = (w, h, d, x, y, z, m, r) => { if (!hi) return box(w, h, d, x, y, z, m); const b = new T.Mesh(this._rbox(w, h, d, r || 0.05), m || base); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
      const cyl = (rt, rb, h, x, y, z, m, seg) => { const c = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 20), m || base); c.position.set(x, y, z); c.castShadow = true; g.add(c); return c; };
      const legs = (h, inset, m, th) => { const t = th || 0.04; for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(t, h, t, sx * (W / 2 - inset), h / 2, sz * (D / 2 - inset), m || dark); };
      const handles = (n, y, h) => { for (let i = 0; i < n; i++) box(0.012, h || 0.18, 0.02, -W / 2 + W * (i + 0.5) / n + (W / n) * 0.35 * (i % 2 ? -1 : 1), y, D / 2 + 0.012, dark); };
      // nel sistema locale: x = larghezza, z = profondit\u00e0 (retro a -D/2), y in alto
      switch (f.shape) {
        case 'bed': {
          box(W, 0.26, D, 0, 0.17, 0, wood);                                   // struttura
          box(0.05, 0.06, 0.05, -W / 2 + 0.05, 0.03, D / 2 - 0.05, dark); box(0.05, 0.06, 0.05, W / 2 - 0.05, 0.03, D / 2 - 0.05, dark);
          soft(W - 0.04, 0.22, D - 0.1, 0, 0.41, 0.03, light, 0.06);         // materasso
          soft(W + 0.02, 1.0, 0.09, 0, 0.55, -D / 2 + 0.045, M.fabric, 0.035); // testiera imbottita
          const pw = W > 1.2 ? (W - 0.3) / 2 : W - 0.2;
          const pil = (x) => soft(pw, 0.13, 0.36, x, 0.58, -D / 2 + 0.3, light, 0.06);
          if (W > 1.2) { pil(-pw / 2 - 0.05); pil(pw / 2 + 0.05); } else pil(0);
          soft(W - 0.02, 0.05, D * 0.55, 0, 0.545, D * 0.2, M.fabric, 0.02); // copriletto
          break;
        }
        case 'sofa': case 'armchair': {
          const arm = Math.min(0.18, W * 0.12), seatH = 0.42;
          box(W, 0.12, D, 0, 0.14, 0, base);                                      // base
          legs(0.08, 0.06, dark, 0.035);
          const n = f.shape === 'armchair' ? 1 : Math.max(2, Math.round((W - 2 * arm) / 0.7));
          const cw = (W - 2 * arm) / n;
          for (let i = 0; i < n; i++) {
            const x = -W / 2 + arm + cw * (i + 0.5);
            soft(cw - 0.01, 0.16, D - 0.26, x, seatH - 0.08 + 0.02, 0.08, base, 0.05); // seduta
            soft(cw - 0.02, H - seatH - 0.02, 0.2, x, seatH + (H - seatH) / 2 - 0.02, -D / 2 + 0.17, base, 0.07); // schienale
          }
          box(W, H - 0.2, 0.08, 0, 0.2 + (H - 0.2) / 2 - 0.04, -D / 2 + 0.04, base);
          soft(arm, 0.62 - 0.14, D, -W / 2 + arm / 2, 0.2 + (0.62 - 0.2) / 2, 0, base, 0.06);
          soft(arm, 0.62 - 0.14, D, W / 2 - arm / 2, 0.2 + (0.62 - 0.2) / 2, 0, base, 0.06);
          break;
        }
        case 'sofa_l': {
          box(W, 0.12, 0.92, 0, 0.14, -D / 2 + 0.46); box(0.95, 0.12, D - 0.92, W / 2 - 0.475, 0.14, 0.46);
          const n = Math.max(2, Math.round((W - 0.95) / 0.7)), cw = (W - 0.95 - 0.16) / n;
          for (let i = 0; i < n; i++) { const x = -W / 2 + 0.16 + cw * (i + 0.5); soft(cw - 0.01, 0.16, 0.66, x, 0.36, -D / 2 + 0.55, base, 0.05); soft(cw - 0.02, H - 0.44, 0.2, x, 0.42 + (H - 0.42) / 2, -D / 2 + 0.12, base, 0.07); }
          soft(0.93, 0.16, D - 0.2, W / 2 - 0.475, 0.36, 0.1, base, 0.05);
          box(0.2, H - 0.2, D, W / 2 - 0.1, 0.2 + (H - 0.2) / 2, 0, base);
          box(W - 0.95, H - 0.2, 0.1, -0.475, 0.2 + (H - 0.2) / 2, -D / 2 + 0.05, base);
          soft(0.16, 0.48, 0.92, -W / 2 + 0.08, 0.44, -D / 2 + 0.46, base, 0.06);
          legs(0.08, 0.06, dark, 0.035);
          break;
        }
        case 'table': case 'desk':
          box(W, 0.04, D, 0, H - 0.02, 0, wood);
          legs(H - 0.04, 0.06, f.metal ? dark : wood, 0.05);
          if (f.shape === 'desk') box(Math.min(0.45, W * 0.35), 0.16, D - 0.06, W / 2 - Math.min(0.45, W * 0.35) / 2 - 0.04, H - 0.12, 0, wood);
          break;
        case 'round_table': cyl(W / 2, W / 2, 0.04, 0, H - 0.02, 0, wood, 40); cyl(0.05, 0.05, H - 0.04, 0, (H - 0.04) / 2, 0, dark); cyl(0.26, 0.28, 0.03, 0, 0.015, 0, dark); break;
        case 'chair':
          soft(W, 0.05, D, 0, 0.46, 0, f.fabric ? M.fabric : wood, 0.02);
          soft(W, H - 0.5, 0.035, 0, 0.5 + (H - 0.5) / 2, -D / 2 + 0.02, wood, 0.015);
          legs(0.44, 0.03, f.metal ? dark : wood, 0.03);
          break;
        case 'composite': this._buildComposite(f, g, M, mat, box, cyl); break;
        case 'wardrobe': case 'cabinet': case 'kitchen_tall': case 'fridge': case 'washer': {
          box(W, H, D, 0, H / 2, 0, f.shape === 'fridge' || f.shape === 'washer' ? light : base);
          if (f.shape === 'washer') { const c = cyl(0.17, 0.17, 0.02, 0, H * 0.45, D / 2 + 0.005, mat({ color: '#9BB3C1', metalness: 0.2 })); c.rotation.x = Math.PI / 2; }
          else if (f.shape === 'fridge') { box(0.015, 0.3, 0.025, W / 2 - 0.06, H * 0.6, D / 2 + 0.015, dark); box(0.015, 0.25, 0.025, W / 2 - 0.06, H * 0.25, D / 2 + 0.015, dark); box(W, 0.006, 0.006, 0, H * 0.42, D / 2 + 0.003, dark); }
          else {
            const n = Math.max(1, Math.round(W / 0.5));
            for (let i = 1; i < n; i++) box(0.006, H - 0.04, 0.006, -W / 2 + W * i / n, H / 2, D / 2 + 0.003, mat({ color: '#000000', transparent: true, opacity: 0.18 }));
            handles(n, H > 1 ? H * 0.5 : H - 0.08, H > 1 ? 0.3 : 0.12);
            if (f.shape === 'cabinet' && H < 1) legs(0.1, 0.05, dark, 0.03);
          }
          break;
        }
        case 'kitchen_base': {
          box(W, H - 0.04 - 0.1, D - 0.02, 0, 0.1 + (H - 0.14) / 2, -0.01);
          box(W - 0.06, 0.1, D - 0.08, 0, 0.05, -0.04, dark);                      // zoccolo
          box(W, 0.04, D, 0, H - 0.02, 0, mat({ color: '#7D7A75', roughness: 0.35 })); // top
          const n = Math.max(1, Math.round(W / 0.6)); handles(n, H - 0.12, 0.012); for (let i = 0; i < n; i++) box(Math.min(0.3, W / n - 0.1), 0.012, 0.02, -W / 2 + W * (i + 0.5) / n, H - 0.12, D / 2 + 0.012, dark);
          break;
        }
        case 'kitchen_wall': { box(W, H, D, 0, H / 2, 0); const n = Math.max(1, Math.round(W / 0.6)); for (let i = 0; i < n; i++) box(Math.min(0.3, W / n - 0.1), 0.012, 0.02, -W / 2 + W * (i + 0.5) / n, 0.05, D / 2 + 0.012, dark); break; }
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
        case 'rug': soft(W, 0.012, D, 0, 0.006, 0, M.fabric, 0.004); break;
        case 'plant': cyl(0.16, 0.12, 0.35, 0, 0.175, 0, mat({ color: '#B98E62' })); { const s = new T.Mesh(new T.SphereGeometry(Math.min(W, D) / 2, 16, 12), mat({ color: '#5E8C61' })); s.position.y = 0.35 + (H - 0.35) / 2; s.scale.y = (H - 0.35) / Math.min(W, D); s.castShadow = true; g.add(s); } break;
        case 'tree': cyl(0.12, 0.16, H * 0.45, 0, H * 0.225, 0, mat({ color: '#7A5A3C' })); { const s = new T.Mesh(new T.SphereGeometry(Math.min(W, D) / 2, 16, 12), mat({ color: '#5E8C61' })); s.position.y = H * 0.65; s.castShadow = true; g.add(s); } break;
        case 'lamp_floor': cyl(0.12, 0.14, 0.03, 0, 0.015, 0, dark); cyl(0.012, 0.012, H - 0.2, 0, (H - 0.2) / 2, 0, dark); cyl(0.1, W / 2, 0.24, 0, H - 0.12, 0, mat({ color: '#F1E7C9', emissive: '#FFE7B0', emissiveIntensity: 0.5 })); break;
        case 'lamp_ceiling': { const sh = cyl(0.06, W / 2, H, 0, H / 2, 0, mat({ color: '#F1E7C9', emissive: '#FFE7B0', emissiveIntensity: 0.6 })); sh.castShadow = false; cyl(0.006, 0.006, 3, 0, H + 1.5, 0, dark); break; }
        case 'curtain': { const n = Math.max(4, Math.round(W / 0.12)); for (let i = 0; i < n; i++) { const c = cyl(W / n * 0.62, W / n * 0.62, H, -W / 2 + W * (i + 0.5) / n, H / 2, (i % 2 ? 0.015 : -0.015), M.fabric, hi ? 10 : 6); c.castShadow = false; } box(W + 0.1, 0.02, 0.02, 0, H + 0.02, 0, dark); break; }
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
      const half = size * 0.62 + 1;
      cam.left = cam.bottom = -half; cam.right = cam.top = half; cam.near = 0.5; cam.far = dist * 2.5;
      cam.updateProjectionMatrix();
      const day = s.elevation > 0;
      this.sunLight.intensity = day ? 0.6 + 2.0 * Math.min(1, s.elevation / 35) : 0;
      this.hemi.intensity = day ? 0.95 : 0.3;
      this.scene.background.set(day ? (s.elevation < 8 ? '#F1DCC8' : '#E9EEF2') : '#2B3442');
      this.sunLight.color.set(s.elevation < 10 ? '#FFD8A8' : '#FFF4E0');
      for (const l of this.lamps || []) l.intensity = day ? 1.2 : 3.2;
      this.dirty = true;
    }

    /* ---------- Camera e comandi ---------- */
    resetCamera() {
      const b = this.bounds || { minX: 0, minY: 0, maxX: 8, maxY: 6 };
      this.orbit.target = { x: (b.minX + b.maxX) / 2, y: 0.8, z: (b.minY + b.maxY) / 2 };
      const size = Math.max(b.maxX - b.minX, b.maxY - b.minY, 4);
      // la casa deve entrare tutta anche con il telefono in verticale (campo orizzontale stretto)
      const cam = this.camera, asp = cam && cam.aspect ? cam.aspect : 1;
      const vf = (cam && cam.fov ? cam.fov : 50) * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * asp);
      this.orbit.r = Math.min(120, Math.max(size * 1.35, size * 0.6 / Math.tan(Math.min(vf, hf) / 2)));
      this.orbit.theta = -0.7; this.orbit.phi = 0.9;
      // passeggiata: parti dal centro della stanza più grande
      let best = null, ba = 0;
      for (const id in this.plan.rooms) { const st = P.roomStats(this.plan, this.plan.rooms[id]); if (st.net > ba && !CM.roomType(this.plan.rooms[id].type).outdoor) { ba = st.net; best = id; } }
      const c = best ? G.labelPoint(P.roomPts(this.plan, this.plan.rooms[best])) : { x: this.orbit.target.x, y: this.orbit.target.z };
      this.walk.x = c.x; this.walk.z = c.y; this.walk.yaw = 0; this.walk.pitch = -0.05;
      this.dirty = true;
    }

    setMode(m) { const ch = m !== this.mode; this.mode = m; this.walk.move = { x: 0, y: 0 }; if (ch && this.lowWalls && this.project) this.build(this.project); this.dirty = true; }

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
      const H = this.hooks;
      el.addEventListener('pointerdown', e => {
        el.setPointerCapture(e.pointerId); this.pointers.set(e.pointerId, pos(e)); this._g = null;
        this._tap = this.pointers.size === 1 ? { p: pos(e), t: Date.now(), moved: 0 } : null;
        if (this.pointers.size > 1) {
          // secondo dito: si torna a girare/zoomare, annullando ciò che si stava facendo
          if (this._drag) { if (this._drag.started && H.onDragCancel) H.onDragCancel(); this._drag = null; }
          if (this._rect) { this._rect = null; this.showDraft(null); }
          return;
        }
        if (!this.editMode) return;
        const p = pos(e);
        if (this.tool && this.tool.type === 'rect') {
          const a = this.floorAt(p.x, p.y, 0);
          if (a) { this._rect = { a, b: a }; }
          return;
        }
        if (!this.tool && H.onDragStart) {
          const hit = this.pick(p.x, p.y);
          if (hit && H.canDrag && H.canDrag(hit)) {
            const h = hit.kind === 'furniture' || hit.kind === 'fixture' ? Math.max(0, Math.min(hit.y3 || 0, 2.4)) : Math.max(0, Math.min(hit.y3 || 0, 2.6));
            this._drag = { hit, h, start: this.floorAt(p.x, p.y, h), p0: p, started: false };
          }
        }
      });
      el.addEventListener('pointermove', e => {
        if (!this.pointers.has(e.pointerId)) return;
        const p = pos(e), prev = this.pointers.get(e.pointerId);
        this.pointers.set(e.pointerId, p);
        if (this._tap) this._tap.moved = Math.max(this._tap.moved, Math.hypot(p.x - this._tap.p.x, p.y - this._tap.p.y));
        const pts = [...this.pointers.values()];
        if (pts.length === 1 && this._drag) {
          const d = this._drag;
          if (!d.started && Math.hypot(p.x - d.p0.x, p.y - d.p0.y) < 8) return;
          const w = this.floorAt(p.x, p.y, d.h);
          if (!w || !d.start) return;
          if (!d.started) { d.started = true; H.onDragStart(d.hit, d.start); }
          H.onDragMove(w, d.start);
          return;
        }
        if (pts.length === 1 && this._rect) {
          const b = this.floorAt(p.x, p.y, 0);
          if (b) { this._rect.b = b; if (H.onRect) H.onRect(this._rect.a, b, false); }
          return;
        }
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
      const up = e => {
        this.pointers.delete(e.pointerId); this._g = null;
        const tp = this._tap; this._tap = null;
        const isTap = e.type === 'pointerup' && tp && tp.moved < 8 && Date.now() - tp.t < 450;
        if (this._drag) {
          const d = this._drag; this._drag = null;
          if (d.started) { if (e.type === 'pointerup') H.onDragEnd(); else if (H.onDragCancel) H.onDragCancel(); return; }
        }
        if (this._rect) {
          const r = this._rect; this._rect = null;
          if (e.type === 'pointerup' && H.onRect) H.onRect(r.a, r.b, true);
          return;
        }
        if (!isTap) return;
        const hit = this.pick(tp.p.x, tp.p.y);
        if (this.editMode && this.tool && H.onPlace) {
          H.onPlace({ floor: this.floorAt(tp.p.x, tp.p.y, 0), hit });
          return;
        }
        if (H.onPick) H.onPick(hit);
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('wheel', e => { e.preventDefault(); if (this.mode === 'orbit') { this.orbit.r = Math.max(2, Math.min(120, this.orbit.r * Math.exp(e.deltaY * 0.001))); this.dirty = true; } }, { passive: false });
    }

    // Punto della pianta (in metri) sotto il dito, su un piano orizzontale all'altezza h
    floorAt(x, y, h) {
      const T = window.THREE;
      const r = this.renderer.domElement.getBoundingClientRect();
      const v = new T.Vector2((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1);
      const rc = new T.Raycaster();
      rc.setFromCamera(v, this.camera);
      const out = new T.Vector3();
      const plane = new T.Plane(new T.Vector3(0, 1, 0), -(h || 0));
      if (!rc.ray.intersectPlane(plane, out)) return null;
      // troppo lontano (vista quasi orizzontale): non è un punto utile
      const b = this.bounds || { minX: -10, minY: -10, maxX: 10, maxY: 10 };
      const pad = 30;
      if (out.x < b.minX - pad || out.x > b.maxX + pad || out.z < b.minY - pad || out.z > b.maxY + pad) return null;
      return { x: out.x, y: out.z };
    }

    // Modalità modifica: aree di tocco più grandi e impianti sempre visibili
    setEdit(on) {
      on = !!on;
      if (this.editMode === on) return;
      this.editMode = on;
      if (!on) { this.tool = null; this.showDraft(null); this.setSelected(null); }
      if (this.project) this.build(this.project);
    }

    setTool(t) { this.tool = t || null; if (!t) this.showDraft(null); }

    // Anteprima di ciò che stai disegnando: stanza (rettangolo) o muri (catena di punti)
    showDraft(d) {
      const T = window.THREE;
      if (!this.scene) return;
      if (this.draftGroup) { this.draftGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); }); this.scene.remove(this.draftGroup); this.draftGroup = null; }
      if (!d) { this.dirty = true; return; }
      const g = new T.Group();
      const blue = new T.MeshBasicMaterial({ color: '#1F4FD1', transparent: true, opacity: 0.28, depthWrite: false });
      const line = new T.MeshBasicMaterial({ color: '#1F4FD1' });
      if (d.rect) {
        const { a, b } = d.rect;
        const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
        if (w > 0.01 && h > 0.01) {
          const m = new T.Mesh(new T.BoxGeometry(w, 0.02, h), blue);
          m.position.set((a.x + b.x) / 2, 0.02, (a.y + b.y) / 2); g.add(m);
          const t = 0.04;
          for (const [cx, cz, sx, sz] of [[(a.x + b.x) / 2, a.y, w, t], [(a.x + b.x) / 2, b.y, w, t], [a.x, (a.y + b.y) / 2, t, h], [b.x, (a.y + b.y) / 2, t, h]]) {
            const e = new T.Mesh(new T.BoxGeometry(sx, 0.4, sz), blue); e.position.set(cx, 0.2, cz); g.add(e);
          }
        }
      }
      if (d.chain) {
        const pts = d.chain.points.concat(d.chain.cursor ? [d.chain.cursor] : []);
        pts.forEach((p, i) => {
          const s = new T.Mesh(new T.SphereGeometry(i === 0 ? 0.11 : 0.08, 14, 10), line);
          s.position.set(p.x, 0.08, p.y); g.add(s);
          if (i > 0) {
            const q = pts[i - 1], L = Math.hypot(p.x - q.x, p.y - q.y);
            if (L > 0.01) {
              const m = new T.Mesh(new T.BoxGeometry(L, 1.0, 0.1), blue);
              m.position.set((p.x + q.x) / 2, 0.5, (p.y + q.y) / 2); m.rotation.y = -Math.atan2(p.y - q.y, p.x - q.x); g.add(m);
            }
          }
        });
      }
      if (d.point) {
        const s = new T.Mesh(new T.SphereGeometry(0.1, 14, 10), line); s.position.set(d.point.x, 0.1, d.point.y); g.add(s);
      }
      this.draftGroup = g; this.scene.add(g); this.dirty = true;
    }

    // Elemento selezionato: resta evidenziato (anche dopo ogni ricostruzione)
    setSelected(hit) { this._sel = hit || null; this._applySel(); }
    _applySel() {
      const T = window.THREE;
      if (!this.scene) return;
      if (this._selHelper) { this.scene.remove(this._selHelper); this._selHelper = null; }
      const hit = this._sel;
      if (!hit || !this.editMode) { this.dirty = true; return; }
      const box = this._boxOf(hit);
      if (!box) { this.dirty = true; return; }
      box.expandByScalar(0.02);
      this._selHelper = new T.Box3Helper(box, new T.Color('#1F4FD1'));
      this.scene.add(this._selHelper); this.dirty = true;
    }
    _boxOf(hit) {
      const T = window.THREE;
      const box = new T.Box3();
      this.group.traverse(o => {
        const u = o.userData || {};
        if (u.hitbox) return;
        const ok = (hit.kind === 'wall' && u.kind === 'wall' && u.id === hit.id) || (hit.kind === 'floor' && u.kind === 'room' && u.id === hit.room) ||
          (hit.kind === u.kind && u.id === hit.id && ['furniture', 'opening', 'fixture'].includes(hit.kind));
        if (ok) box.expandByObject(o);
      });
      return box.isEmpty() ? null : box;
    }

    // Sposta subito un mobile già costruito (mentre lo trascini), senza ricostruire la scena
    moveLive(kind, id, x, y, rot) {
      let found = null;
      this.group.children.forEach(o => { const u = o.userData || {}; if (u.kind === kind && u.id === id && !u.hitbox) found = o; });
      if (!found) return false;
      found.position.x = x; found.position.z = y;
      if (rot != null) found.rotation.y = -rot;
      this._applySel();
      return true;
    }

    // Cosa c'è sotto il dito: parete (con la stanza dal lato toccato), pavimento, mobile, porta/finestra o impianto
    pick(x, y) {
      const T = window.THREE;
      const r = this.renderer.domElement.getBoundingClientRect();
      const v = new T.Vector2((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1);
      const rc = new T.Raycaster();
      rc.setFromCamera(v, this.camera);
      const hits = rc.intersectObjects(this.group.children, true);
      for (const h of hits) {
        let o = h.object;
        while (o && !(o.userData && o.userData.kind)) o = o.parent;
        if (!o) continue;
        const u = o.userData;
        const at = { point: { x: h.point.x, y: h.point.z }, y3: h.point.y };
        if (u.kind === 'wall') {
          const mi = h.face ? h.face.materialIndex : -1;
          const room = mi === 4 ? u.rooms[0] : mi === 5 ? u.rooms[1] : null;
          if (mi === 2 || mi === 3 || mi === 0 || mi === 1) return Object.assign({ kind: 'wall', id: u.id, room: u.rooms[0] || u.rooms[1] || null, top: true }, at);
          return Object.assign({ kind: 'wall', id: u.id, room }, at);
        }
        if (u.kind === 'room') return Object.assign({ kind: 'floor', room: u.id }, at);
        if (u.kind === 'furniture') return Object.assign({ kind: 'furniture', id: u.id }, at);
        if (u.kind === 'opening') return Object.assign({ kind: 'opening', id: u.id, wall: u.wall }, at);
        if (u.kind === 'fixture') return Object.assign({ kind: 'fixture', id: u.id }, at);
      }
      return null;
    }

    // Evidenzia per un attimo ci\u00f2 che hai toccato
    flash(hit) {
      if (!hit) return;
      const T = window.THREE;
      const box = this._boxOf(hit);
      if (!box) return;
      const helper = new T.Box3Helper(box, new T.Color('#1F4FD1'));
      this.scene.add(helper); this.dirty = true;
      setTimeout(() => { this.scene.remove(helper); this.dirty = true; }, 900);
    }

    // Esporta la scena in GLB (glTF binario): si apre con Visualizzatore 3D di Windows, Blender, SketchUp...
    exportGLB() {
      const T = window.THREE;
      this.group.updateMatrixWorld(true);
      const prims = [], mats = [], matKey = new Map();
      const matIndex = (m) => {
        const c = (m && m.color) ? m.color : new T.Color('#cccccc');
        let col = c.clone();
        if (m && m.map && m.map.image && m.map.image.getContext) {
          // colore medio della texture procedurale
          try { const x = m.map.image.getContext('2d').getImageData(0, 0, 8, 8).data; let r = 0, g = 0, b = 0; for (let i = 0; i < x.length; i += 4) { r += x[i]; g += x[i + 1]; b += x[i + 2]; } const n = x.length / 4; col = new T.Color(r / n / 255, g / n / 255, b / n / 255); } catch (e) {}
        }
        const lin = col.clone();
        const key = lin.getHexString() + (m && m.transparent ? 't' + m.opacity : '') + (m ? m.metalness + ':' + m.roughness : '');
        if (matKey.has(key)) return matKey.get(key);
        const out = { pbrMetallicRoughness: { baseColorFactor: [lin.r, lin.g, lin.b, m && m.transparent ? m.opacity : 1], metallicFactor: m ? (m.metalness || 0) : 0, roughnessFactor: m ? (m.roughness == null ? 0.8 : m.roughness) : 0.8 }, doubleSided: true };
        if (m && m.transparent) out.alphaMode = 'BLEND';
        mats.push(out); matKey.set(key, mats.length - 1);
        return mats.length - 1;
      };
      this.group.traverse(o => {
        if (!o.isMesh || !o.geometry || !o.visible) return;
        let geo = o.geometry;
        if (!geo.attributes.position) return;
        geo = geo.index ? geo.toNonIndexed() : geo.clone();
        geo.applyMatrix4(o.matrixWorld);
        if (!geo.attributes.normal) geo.computeVertexNormals();
        const pos = geo.attributes.position.array, nor = geo.attributes.normal.array;
        if (pos.some(v => !isFinite(v))) return;
        const groups = geo.groups && geo.groups.length && Array.isArray(o.material) ? geo.groups : [{ start: 0, count: pos.length / 3, materialIndex: 0 }];
        for (const g of groups) {
          const m = Array.isArray(o.material) ? o.material[g.materialIndex] : o.material;
          prims.push({ pos: pos.slice(g.start * 3, (g.start + g.count) * 3), nor: nor.slice(g.start * 3, (g.start + g.count) * 3), mat: matIndex(m) });
        }
      });
      // buffer unico
      let len = 0; prims.forEach(p => { len += p.pos.byteLength + p.nor.byteLength; });
      const bin = new Uint8Array(len);
      const views = [], accs = [], meshes = [];
      let off = 0;
      prims.forEach(p => {
        const n = p.pos.length / 3;
        let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < p.pos.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p.pos[i + k]); mx[k] = Math.max(mx[k], p.pos[i + k]); }
        bin.set(new Uint8Array(p.pos.buffer, p.pos.byteOffset, p.pos.byteLength), off);
        views.push({ buffer: 0, byteOffset: off, byteLength: p.pos.byteLength, target: 34962 }); off += p.pos.byteLength;
        accs.push({ bufferView: views.length - 1, componentType: 5126, count: n, type: 'VEC3', min: mn, max: mx });
        bin.set(new Uint8Array(p.nor.buffer, p.nor.byteOffset, p.nor.byteLength), off);
        views.push({ buffer: 0, byteOffset: off, byteLength: p.nor.byteLength, target: 34962 }); off += p.nor.byteLength;
        accs.push({ bufferView: views.length - 1, componentType: 5126, count: n, type: 'VEC3' });
        meshes.push({ primitives: [{ attributes: { POSITION: accs.length - 2, NORMAL: accs.length - 1 }, material: p.mat }] });
      });
      const gltf = { asset: { version: '2.0', generator: 'Casa Mia' }, scene: 0, scenes: [{ nodes: meshes.map((m, i) => i) }], nodes: meshes.map((m, i) => ({ mesh: i })), meshes, materials: mats, accessors: accs, bufferViews: views, buffers: [{ byteLength: bin.length }] };
      let json = new TextEncoder().encode(JSON.stringify(gltf));
      const jpad = (4 - json.length % 4) % 4, bpad = (4 - bin.length % 4) % 4;
      const total = 12 + 8 + json.length + jpad + 8 + bin.length + bpad;
      const out = new Uint8Array(total), dv = new DataView(out.buffer);
      dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
      dv.setUint32(12, json.length + jpad, true); dv.setUint32(16, 0x4E4F534A, true); out.set(json, 20); for (let i = 0; i < jpad; i++) out[20 + json.length + i] = 0x20;
      const b0 = 20 + json.length + jpad;
      dv.setUint32(b0, bin.length + bpad, true); dv.setUint32(b0 + 4, 0x004E4942, true); out.set(bin, b0 + 8);
      return out;
    }

    setQuality(q) {
      this.quality = q;
      if (CM.store) CM.store.pref('q3d', q);
      if (!this.ready) return;
      const T = window.THREE, hi = q === 'realistico';
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hi ? 2 : 1.5));
      const sz = hi ? 4096 : 2048;
      if (this.sunLight.shadow.map) { this.sunLight.shadow.map.dispose(); this.sunLight.shadow.map = null; }
      this.sunLight.shadow.mapSize.set(sz, sz);
      this.sunLight.shadow.radius = hi ? 4 : 1;
      if (this.fill) this.fill.intensity = hi ? 0.45 : 0.3;
      this._w = 0; this.resize();
      if (this.project) this.build(this.project);
    }

    // Movimento con il joystick (x: laterale, y: avanti)
    setMove(x, y) { this.walk.move = { x, y }; this._kick(); }

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
