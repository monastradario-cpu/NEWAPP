/* Casa Mia — planimetria caricata: sfondo, scala, riconoscimento muri (offline e Gemini) */
(function (root) {
  'use strict';
  const CM = root.CM;
  const P = CM.plan, G = CM.geom;
  const MAX_PX = 2000;

  function readFile(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  }
  function loadImg(src) {
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  }

  const U = CM.underlay = {
    // Restituisce un dataURL JPEG ridimensionato dall'immagine o dal PDF scelto
    async fromFile(file) {
      let src;
      if (/pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)) {
        if (!window.CasaMiaAndroid || !window.CasaMiaAndroid.pdfToImage) throw new Error('PDF');
        const b64 = (await readFile(file)).split(',')[1];
        const out = window.CasaMiaAndroid.pdfToImage(b64);
        if (!out) throw new Error('PDF illeggibile');
        src = 'data:image/png;base64,' + out;
      } else {
        src = await readFile(file);
      }
      const im = await loadImg(src);
      const k = Math.min(1, MAX_PX / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(im, 0, 0, c.width, c.height);
      return { src: c.toDataURL('image/jpeg', 0.85), pxW: c.width, pxH: c.height };
    },

    create(img, plan) {
      // Larghezza iniziale ipotetica di 14 m: va calibrata su un muro noto
      const wM = 14;
      const b = P.bounds(Object.assign({}, plan, { underlay: null }));
      return { src: img.src, pxW: img.pxW, pxH: img.pxH, x: b ? b.minX : 0, y: b ? b.minY : 0, wM, hM: wM * img.pxH / img.pxW, opacity: 0.5, calibrated: false };
    },

    toWorld(u, px, py) { return { x: u.x + px * u.wM / u.pxW, y: u.y + py * u.hM / u.pxH }; },
    mPerPx(u) { return u.wM / u.pxW; },

    /* ---------- Riconoscimento offline dei muri dritti ---------- */
    async detectWalls(u) {
      const im = await loadImg(u.src);
      const k = Math.min(1, 1100 / Math.max(im.naturalWidth, im.naturalHeight));
      const W = Math.round(im.naturalWidth * k), H = Math.round(im.naturalHeight * k);
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      ctx.drawImage(im, 0, 0, W, H);
      const data = ctx.getImageData(0, 0, W, H).data;
      // scala di grigi e soglia di Otsu
      const gray = new Uint8Array(W * H), hist = new Array(256).fill(0);
      for (let i = 0; i < W * H; i++) { const g = (data[i * 4] * 0.3 + data[i * 4 + 1] * 0.59 + data[i * 4 + 2] * 0.11) | 0; gray[i] = g; hist[g]++; }
      let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
      let sumB = 0, wB = 0, best = 0, thr = 128;
      for (let t = 0; t < 256; t++) {
        wB += hist[t]; if (!wB) continue;
        const wF = W * H - wB; if (!wF) break;
        sumB += t * hist[t];
        const mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) * (mB - mF);
        if (between > best) { best = between; thr = t; }
      }
      thr = Math.min(thr, 160);
      const merged = U.wallsFromDark(gray.map(g => g < thr ? 1 : 0), W, H);
      const kx = u.wM / W, ky = u.hM / H;
      return merged.map(sg => sg.dir === 'h'
        ? { a: { x: u.x + sg.b0 * kx, y: u.y + sg.mid * ky }, b: { x: u.x + sg.b1 * kx, y: u.y + sg.mid * ky }, t: sg.th * ky }
        : { a: { x: u.x + sg.mid * kx, y: u.y + sg.b0 * ky }, b: { x: u.x + sg.mid * kx, y: u.y + sg.b1 * ky }, t: sg.th * kx });
    },

    /* Trova i muri dritti in un'immagine binaria (1 = nero).
       1) chiude le doppie linee e i muri vuoti (catasto) riempiendoli;
       2) separa le parti orizzontali e verticali con un'apertura a linea;
       3) ogni blocco connesso diventa un muro (asse + spessore);
       4) allunga gli estremi fino ai muri perpendicolari. */
    wallsFromDark(dark, W, H) {
      const S = Math.max(W, H);
      const rc = Math.max(2, Math.round(S * 0.006));
      const L = Math.max(12, Math.round(S * 0.03));
      const maxThick = Math.max(6, Math.round(S * 0.035));
      // dilatazione/erosione lungo righe o colonne con finestra [-r1, r2] (somma mobile)
      const pass = (src, horiz, r1, r2, erode) => {
        const out = new Uint8Array(W * H);
        const A = horiz ? H : W, B = horiz ? W : H;
        for (let a = 0; a < A; a++) {
          const idx = (b) => horiz ? a * W + b : b * W + a;
          // prefisso
          const pre = new Int32Array(B + 1);
          for (let b = 0; b < B; b++) pre[b + 1] = pre[b] + src[idx(b)];
          for (let b = 0; b < B; b++) {
            const lo = Math.max(0, b - r1), hi = Math.min(B - 1, b + r2);
            const cnt = pre[hi + 1] - pre[lo];
            out[idx(b)] = erode ? (cnt === (b + r2 - (b - r1) + 1) && b - r1 >= 0 && b + r2 < B ? 1 : 0) : (cnt > 0 ? 1 : 0);
          }
        }
        return out;
      };
      // chiusura quadrata (riempie muri disegnati a doppia linea)
      let m = pass(pass(dark, true, rc, rc, false), false, rc, rc, false);
      m = pass(pass(m, true, rc, rc, true), false, rc, rc, true);
      const segs = [];
      for (const horiz of [true, false]) {
        // apertura con una linea lunga L: restano solo i tratti orizzontali (o verticali)
        const half = Math.floor(L / 2);
        const op = pass(pass(m, horiz, half, L - 1 - half, true), horiz, L - 1 - half, half, false);
        // componenti connesse
        const lab = new Int32Array(W * H); let id = 0;
        const stack = [];
        for (let i = 0; i < W * H; i++) {
          if (!op[i] || lab[i]) continue;
          id++;
          let x0 = W, x1 = -1, y0 = H, y1 = -1, n = 0;
          const rowCnt = new Map();
          stack.push(i); lab[i] = id;
          while (stack.length) {
            const j = stack.pop(); const x = j % W, y = (j / W) | 0; n++;
            if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
            const key = horiz ? y : x; rowCnt.set(key, (rowCnt.get(key) || 0) + 1);
            if (x > 0 && op[j - 1] && !lab[j - 1]) { lab[j - 1] = id; stack.push(j - 1); }
            if (x < W - 1 && op[j + 1] && !lab[j + 1]) { lab[j + 1] = id; stack.push(j + 1); }
            if (y > 0 && op[j - W] && !lab[j - W]) { lab[j - W] = id; stack.push(j - W); }
            if (y < H - 1 && op[j + W] && !lab[j + W]) { lab[j + W] = id; stack.push(j + W); }
          }
          const len = horiz ? x1 - x0 + 1 : y1 - y0 + 1;
          const th = horiz ? y1 - y0 + 1 : x1 - x0 + 1;
          if (len < L) continue;
          if (th <= maxThick) {
            // asse pesato sulle righe piene
            let sw = 0, sm = 0; rowCnt.forEach((c, k) => { sw += c; sm += c * k; });
            segs.push({ dir: horiz ? 'h' : 'v', mid: sm / sw + 0.5, b0: horiz ? x0 : y0, b1: (horiz ? x1 : y1) + 1, th });
          } else {
            // blocco troppo spesso: lo divido in fasce di righe piene
            const keys = [...rowCnt.keys()].sort((p, q) => p - q);
            let band = [];
            const flush = () => { if (band.length >= 1 && band.length <= maxThick) segs.push({ dir: horiz ? 'h' : 'v', mid: (band[0] + band[band.length - 1] + 1) / 2, b0: horiz ? x0 : y0, b1: (horiz ? x1 : y1) + 1, th: band.length }); band = []; };
            for (const k of keys) { if (rowCnt.get(k) >= len * 0.6) { if (band.length && k !== band[band.length - 1] + 1) flush(); band.push(k); } else flush(); }
            flush();
          }
        }
      }
      // estendi gli estremi fino ai muri perpendicolari vicini (angoli e incroci)
      for (const sg of segs) {
        for (const o of segs) {
          if (o.dir === sg.dir) continue;
          const tol = Math.max(o.th, sg.th) + rc * 2 + 2;
          if (sg.mid >= o.b0 - tol && sg.mid <= o.b1 + tol) {
            if (Math.abs(sg.b0 - o.mid) < tol) sg.b0 = o.mid;
            if (Math.abs(sg.b1 - o.mid) < tol) sg.b1 = o.mid;
          }
        }
      }
      return segs;
    },

    // Muri disegnati con due linee parallele (tipico delle planimetrie catastali): diventano un solo muro
    mergeDoubleLines(segs) {
      const horiz = (s) => Math.abs(s.a.y - s.b.y) < 1e-6;
      const norm = segs.map(s => {
        const h = horiz(s);
        const c = h ? s.a.y : s.a.x;
        const lo = h ? Math.min(s.a.x, s.b.x) : Math.min(s.a.y, s.b.y), hi = h ? Math.max(s.a.x, s.b.x) : Math.max(s.a.y, s.b.y);
        return { h, c, lo, hi, t: s.t, used: false };
      });
      const out = [];
      for (let i = 0; i < norm.length; i++) {
        const a = norm[i];
        if (a.used) continue;
        let best = null, bestD = Infinity;
        for (let j = i + 1; j < norm.length; j++) {
          const b = norm[j];
          if (b.used || b.h !== a.h) continue;
          const d = Math.abs(a.c - b.c);
          if (d < 0.06 || d > 0.55) continue;
          const ov = Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo);
          if (ov < 0.6 * Math.min(a.hi - a.lo, b.hi - b.lo)) continue;
          if (d < bestD) { bestD = d; best = b; }
        }
        a.used = true;
        let seg = a;
        if (best) {
          best.used = true;
          seg = { h: a.h, c: (a.c + best.c) / 2, lo: Math.min(a.lo, best.lo), hi: Math.max(a.hi, best.hi), t: bestD + Math.max(a.t, best.t) * 0.5 };
        }
        out.push(seg.h ? { a: { x: seg.lo, y: seg.c }, b: { x: seg.hi, y: seg.c }, t: seg.t } : { a: { x: seg.c, y: seg.lo }, b: { x: seg.c, y: seg.hi }, t: seg.t });
      }
      return out;
    },

    // Ritaglia la planimetria al rettangolo (in metri) scelto dall'utente, mantenendo la scala
    async crop(u, r) {
      const im = await loadImg(u.src);
      const kx = u.pxW / u.wM, ky = u.pxH / u.hM;
      const x0 = Math.max(0, Math.floor((r.x0 - u.x) * kx)), y0 = Math.max(0, Math.floor((r.y0 - u.y) * ky));
      const x1 = Math.min(u.pxW, Math.ceil((r.x1 - u.x) * kx)), y1 = Math.min(u.pxH, Math.ceil((r.y1 - u.y) * ky));
      if (x1 - x0 < 20 || y1 - y0 < 20) throw new Error('Ritaglio troppo piccolo');
      const sx = im.naturalWidth / u.pxW, sy = im.naturalHeight / u.pxH;
      const c = document.createElement('canvas'); c.width = x1 - x0; c.height = y1 - y0;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(im, x0 * sx, y0 * sy, (x1 - x0) * sx, (y1 - y0) * sy, 0, 0, c.width, c.height);
      return Object.assign({}, u, { cropped: true, src: c.toDataURL('image/jpeg', 0.9), pxW: c.width, pxH: c.height, x: u.x + x0 / kx, y: u.y + y0 / ky, wM: (x1 - x0) / kx, hM: (y1 - y0) / ky });
    },

    // Sbianca una zona della planimetria (parti che non devono entrare nella pianta)
    async mask(u, r) {
      const im = await loadImg(u.src);
      const kx = u.pxW / u.wM, ky = u.pxH / u.hM;
      const c = document.createElement('canvas'); c.width = u.pxW; c.height = u.pxH;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(im, 0, 0, c.width, c.height);
      const x0 = (r.x0 - u.x) * kx, y0 = (r.y0 - u.y) * ky;
      ctx.fillRect(x0, y0, (r.x1 - r.x0) * kx, (r.y1 - r.y0) * ky);
      return Object.assign({}, u, { src: c.toDataURL('image/jpeg', 0.9) });
    },

    applyWalls(plan, segs, state) {
      segs = U.mergeDoubleLines(segs);
      let n = 0;
      for (const sg of segs) {
        if (G.dist(sg.a, sg.b) < 0.3) continue;
        const snap = (v) => Math.round(v * 100) / 100;
        const a = P.getOrCreateNode(plan, snap(sg.a.x), snap(sg.a.y));
        const b = P.getOrCreateNode(plan, snap(sg.b.x), snap(sg.b.y));
        const t = Math.min(0.5, Math.max(0.08, Math.round(sg.t * 100) / 100));
        n += P.addWall(plan, a, b, { t, state: state || 'esistente' }).length;
      }
      P.tidy(plan);
      return n;
    },

    /* ---------- Riconoscimento con Gemini ---------- */
    async detectAI(u) {
      const prompt = 'Sei un tecnico che legge planimetrie. L’immagine è larga ' + u.pxW + ' px e alta ' + u.pxH + ' px. ' +
        'Restituisci SOLO JSON con questa forma: {"scala_m_per_px": numero o null, "muri": [{"x1":px,"y1":px,"x2":px,"y2":px,"spessore_px":px}], ' +
        '"stanze": [{"nome":"Cucina","tipo":"soggiorno|cucina|camera|cameretta|bagno|corridoio|ingresso|studio|ripostiglio|lavanderia|balcone|altro","vertici":[[px,py],...]}], ' +
        '"porte": [{"x":px,"y":px,"larghezza_px":px}], "finestre": [{"x":px,"y":px,"larghezza_px":px}]}. ' +
        'Coordinate in pixel dell’immagine, origine in alto a sinistra. Muri come segmenti sull’asse del muro. ' +
        'Se nella planimetria ci sono quote o misure scritte, usale per stimare scala_m_per_px.';
      return CM.ai.text(prompt, { images: [u.src], json: true });
    },

    applyAI(plan, u, res) {
      const out = { walls: 0, rooms: 0, openings: 0, scaled: false };
      if (res.scala_m_per_px > 0 && !u.calibrated) {
        u.wM = res.scala_m_per_px * u.pxW; u.hM = res.scala_m_per_px * u.pxH; out.scaled = true;
      }
      const W = (x, y) => U.toWorld(u, x, y);
      const kpx = U.mPerPx(u);
      const segs = (res.muri || []).map(m => ({ a: W(m.x1, m.y1), b: W(m.x2, m.y2), t: (m.spessore_px || 10) * kpx }));
      out.walls = U.applyWalls(plan, segs, 'esistente');
      for (const st of res.stanze || []) {
        const pts = (st.vertici || []).map(v => W(v[0], v[1]));
        if (pts.length < 3) continue;
        const ids = pts.map(p => P.getOrCreateNode(plan, Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100));
        P.addRoom(plan, ids, { name: st.nome || undefined, type: CM.ROOM_TYPES.some(t => t.id === st.tipo) ? st.tipo : 'altro' });
        out.rooms++;
      }
      const place = (o, kind) => {
        const p = W(o.x, o.y);
        let best = null, bd = 0.6;
        for (const id in plan.walls) {
          const w = plan.walls[id];
          const pr = G.projSeg(p, plan.nodes[w.a], plan.nodes[w.b]);
          if (pr.d < bd && pr.t > 0 && pr.t < 1) { bd = pr.d; best = { id, pos: pr.t * pr.L }; }
        }
        if (!best) return;
        const oid = P.addOpening(plan, best.id, best.pos, kind);
        if (o.larghezza_px) plan.openings[oid].w = Math.max(0.5, Math.min(3, Math.round(o.larghezza_px * kpx * 20) / 20));
        P.clampOpening(plan, oid);
        out.openings++;
      };
      (res.porte || []).forEach(o => place(o, 'battente'));
      (res.finestre || []).forEach(o => place(o, 'finestra'));
      P.tidy(plan);
      return out;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
