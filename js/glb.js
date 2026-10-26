/* Casa Mia — lettore di modelli 3D GLB (glTF 2.0 binario) per i mobili veri dei negozi.
   Supporta mesh, materiali PBR con texture incorporate, gerarchia dei nodi. Le compressioni Draco/Meshopt non sono supportate. */
(function (root) {
  'use strict';
  const CM = root.CM;
  const GL = CM.glb = {};
  const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

  function b64ToBytes(b64) { const s = atob(b64); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }
  GL.fromDataUrl = (d) => b64ToBytes(String(d).split(',')[1] || '');

  // Restituisce una Promise<THREE.Group>
  GL.parse = function (bytes) {
    const T = window.THREE;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (dv.getUint32(0, true) !== 0x46546C67) return Promise.reject(new Error('Non è un file GLB'));
    let off = 12, json = null, bin = null;
    while (off < bytes.byteLength) {
      const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
      const chunk = bytes.subarray(off + 8, off + 8 + len);
      if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(chunk));
      else if (type === 0x004E4942) bin = chunk;
      off += 8 + len;
    }
    if (!json) return Promise.reject(new Error('GLB senza dati'));
    const req = json.extensionsRequired || [];
    if (req.some(e => /draco|meshopt/i.test(e))) return Promise.reject(new Error('Modello compresso non supportato'));
    const view = (i) => { const v = json.bufferViews[i]; return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); };
    const accessor = (i) => {
      const a = json.accessors[i], C = COMP[a.componentType], n = NUM[a.type];
      const v = json.bufferViews[a.bufferView];
      const stride = v.byteStride || 0, esz = C.BYTES_PER_ELEMENT * n;
      const base = (v.byteOffset || 0) + (a.byteOffset || 0);
      let arr;
      if (!stride || stride === esz) {
        const raw = bin.slice(base, base + a.count * esz); arr = new C(raw.buffer, raw.byteOffset, a.count * n);
      } else {
        arr = new C(a.count * n);
        const src = new DataView(bin.buffer, bin.byteOffset);
        const get = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[a.componentType];
        for (let k = 0; k < a.count; k++) for (let j = 0; j < n; j++) arr[k * n + j] = src[get](base + k * stride + j * C.BYTES_PER_ELEMENT, true);
      }
      if (a.normalized && !(arr instanceof Float32Array)) { const max = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }[a.componentType]; arr = Float32Array.from(arr, x => x / max); }
      return { arr, n };
    };
    // texture incorporate
    const texCache = {};
    const texture = (i, srgb) => {
      const key = i + (srgb ? 's' : 'l');
      if (texCache[key]) return texCache[key];
      const tx = json.textures[i], ext = tx.extensions || {}, src = tx.source != null ? tx.source : ((ext.EXT_texture_webp || ext.KHR_texture_basisu || {}).source), img = json.images[src];
      if (!img || img.bufferView == null) return null;
      const blob = new Blob([view(img.bufferView)], { type: img.mimeType || 'image/png' });
      const url = URL.createObjectURL(blob);
      const t = new T.Texture();
      const im = new Image();
      t.ready = new Promise(res => { im.onload = () => { t.image = im; t.needsUpdate = true; res(); }; im.onerror = () => res(); });
      im.src = url;
      t.flipY = false;
      if (srgb) t.colorSpace = T.SRGBColorSpace;
      const smp = tx.sampler != null && json.samplers ? json.samplers[tx.sampler] : null;
      t.wrapS = smp && smp.wrapS === 33071 ? T.ClampToEdgeWrapping : T.RepeatWrapping;
      t.wrapT = smp && smp.wrapT === 33071 ? T.ClampToEdgeWrapping : T.RepeatWrapping;
      texCache[key] = t;
      return t;
    };
    // KHR_texture_transform: scala/sposta/ruota la texture (usato da molti modelli dei negozi)
    const tx = (info, srgb) => {
      let t = texture(info.index, srgb);
      const tt = info.extensions && info.extensions.KHR_texture_transform;
      if (t && tt) {
        const c = t.clone(); c.ready = t.ready;
        t.ready && t.ready.then(() => { c.image = t.image; c.needsUpdate = true; });
        if (tt.scale) c.repeat.set(tt.scale[0], tt.scale[1]);
        if (tt.offset) c.offset.set(tt.offset[0], tt.offset[1]);
        if (tt.rotation) c.rotation = -tt.rotation;
        c.needsUpdate = true;
        t = c;
      }
      return t;
    };
    const mats = (json.materials || []).map(m => {
      const pbr = m.pbrMetallicRoughness || {};
      const c = pbr.baseColorFactor || [1, 1, 1, 1];
      const o = { color: new T.Color(c[0], c[1], c[2]), metalness: pbr.metallicFactor == null ? 1 : pbr.metallicFactor, roughness: pbr.roughnessFactor == null ? 1 : pbr.roughnessFactor, side: m.doubleSided ? T.DoubleSide : T.FrontSide };
      if (pbr.baseColorTexture) o.map = tx(pbr.baseColorTexture, true);
      if (pbr.metallicRoughnessTexture) { const t = tx(pbr.metallicRoughnessTexture, false); o.metalnessMap = t; o.roughnessMap = t; }
      if (m.normalTexture) o.normalMap = tx(m.normalTexture, false);
      if (m.emissiveTexture) { o.emissiveMap = tx(m.emissiveTexture, true); o.emissive = new T.Color(1, 1, 1); }
      if (m.emissiveFactor && !m.emissiveTexture) o.emissive = new T.Color(m.emissiveFactor[0], m.emissiveFactor[1], m.emissiveFactor[2]);
      if (m.occlusionTexture) o.aoMap = tx(m.occlusionTexture, false);
      if (m.alphaMode === 'BLEND' || c[3] < 1) { o.transparent = true; o.opacity = c[3]; }
      if (m.alphaMode === 'MASK') o.alphaTest = m.alphaCutoff == null ? 0.5 : m.alphaCutoff;
      // estensioni dei materiali: velluto (sheen), iridescenza, vetro (transmission)
      const ex = m.extensions || {};
      const sh = ex.KHR_materials_sheen, ir = ex.KHR_materials_iridescence, tr = ex.KHR_materials_transmission;
      if ((sh || ir || tr) && T.MeshPhysicalMaterial) {
        if (sh) { const sc = sh.sheenColorFactor || [0, 0, 0]; o.sheen = 1; o.sheenColor = new T.Color(sc[0], sc[1], sc[2]); o.sheenRoughness = sh.sheenRoughnessFactor == null ? 0 : sh.sheenRoughnessFactor; if (sh.sheenColorTexture) o.sheenColorMap = tx(sh.sheenColorTexture, true); }
        if (ir) { o.iridescence = ir.iridescenceFactor == null ? 0 : ir.iridescenceFactor; o.iridescenceIOR = ir.iridescenceIor || 1.3; o.iridescenceThicknessRange = [ir.iridescenceThicknessMinimum || 100, ir.iridescenceThicknessMaximum || 400]; }
        if (tr && (tr.transmissionFactor || 0) > 0) { o.transparent = true; o.opacity = Math.max(0.25, 1 - 0.7 * tr.transmissionFactor); o.roughness = Math.min(o.roughness, 0.2); o.depthWrite = false; }
        return new T.MeshPhysicalMaterial(o);
      }
      return new T.MeshStandardMaterial(o);
    });
    const defMat = new T.MeshStandardMaterial({ color: '#cccccc', roughness: 0.8 });
    const meshCache = {};
    const buildMesh = (mi) => {
      if (meshCache[mi]) return meshCache[mi].clone();
      const g = new T.Group();
      for (const p of json.meshes[mi].primitives) {
        if (p.mode != null && p.mode !== 4) continue;
        const geo = new T.BufferGeometry();
        const pos = accessor(p.attributes.POSITION);
        for (let k = 0; k < pos.arr.length; k++) if (!isFinite(pos.arr[k])) pos.arr[k] = 0;
        geo.setAttribute('position', new T.BufferAttribute(pos.arr, 3));
        if (p.attributes.NORMAL != null) { const n = accessor(p.attributes.NORMAL); geo.setAttribute('normal', new T.BufferAttribute(n.arr, 3)); }
        if (p.attributes.TEXCOORD_0 != null) { const uv = accessor(p.attributes.TEXCOORD_0); geo.setAttribute('uv', new T.BufferAttribute(uv.arr, 2)); }
        if (p.indices != null) { const ix = accessor(p.indices); geo.setIndex(new T.BufferAttribute(ix.arr instanceof Uint8Array ? Uint16Array.from(ix.arr) : ix.arr, 1)); }
        if (p.attributes.NORMAL == null) geo.computeVertexNormals();
        const mesh = new T.Mesh(geo, p.material != null ? mats[p.material] : defMat);
        mesh.castShadow = true; mesh.receiveShadow = true;
        // varianti del prodotto (tessuti, colori): ricordate per geometria
        const vm = p.extensions && p.extensions.KHR_materials_variants;
        if (vm && vm.mappings) { const map = { def: mesh.material }; for (const mp of vm.mappings) for (const vi of mp.variants || []) map[vi] = mats[mp.material]; VARIANTS.set(geo, map); }
        g.add(mesh);
      }
      meshCache[mi] = g;
      return g.clone();
    };
    const buildNode = (ni) => {
      const n = json.nodes[ni];
      const o = n.mesh != null ? buildMesh(n.mesh) : new T.Group();
      if (n.matrix) { const m = new T.Matrix4().fromArray(n.matrix); m.decompose(o.position, o.quaternion, o.scale); }
      else {
        if (n.translation) o.position.fromArray(n.translation);
        if (n.rotation) o.quaternion.fromArray(n.rotation);
        if (n.scale) o.scale.fromArray(n.scale);
      }
      (n.children || []).forEach(c => o.add(buildNode(c)));
      return o;
    };
    const root = new T.Group();
    const vlist = json.extensions && json.extensions.KHR_materials_variants && json.extensions.KHR_materials_variants.variants;
    if (vlist) root.userData.variants = vlist.map(v => v.name || '');
    const sc = json.scenes ? json.scenes[json.scene || 0] : { nodes: json.nodes.map((n, i) => i) };
    sc.nodes.forEach(ni => root.add(buildNode(ni)));
    const waits = Object.values(texCache).map(t => t.ready);
    return Promise.all(waits).then(() => root);
  };

  // Varianti (KHR_materials_variants): geometria -> { def, 0: mat, 1: mat ... }
  const VARIANTS = new WeakMap();
  GL.info = {};
  GL.setVariant = function (obj, idx) {
    obj.traverse(o => { if (!o.isMesh) return; const m = VARIANTS.get(o.geometry); if (!m) return; o.material = idx == null || m[idx] == null ? m.def : m[idx]; });
  };
  // nomi delle varianti in italiano (i più comuni)
  GL.variantLabel = (n) => String(n || '').replace(/_/g, ' ').replace(/\bvelvet\b/i, 'velluto').replace(/\bleather\b/i, 'pelle').replace(/\bfabric\b/i, 'tessuto').replace(/\bblack\b/i, 'nero').replace(/\bnavy\b/i, 'blu navy').replace(/\bgr[ae]y\b/i, 'grigio').replace(/\bpale ?pink\b/i, 'rosa cipria').replace(/\bpink\b/i, 'rosa').replace(/\bchampagne\b/i, 'champagne').replace(/\bgreen\b/i, 'verde').replace(/\bwhite\b/i, 'bianco').replace(/\bbrown\b/i, 'marrone').replace(/\bred\b/i, 'rosso').replace(/\bblue\b/i, 'blu').replace(/\bgold\b/i, 'oro');

  // Adatta il modello alle misure del mobile (larghezza x, profondità z, altezza y), appoggiato a terra e centrato
  GL.fit = function (obj, w, d, h) {
    const T = window.THREE;
    const box = new T.Box3().setFromObject(obj);
    const size = box.getSize(new T.Vector3());
    // il lato più lungo in pianta va sulla larghezza del mobile
    if (size.z > size.x * 1.15 && w > d * 1.15) { obj.rotation.y = Math.PI / 2; box.setFromObject(obj); box.getSize(size); }
    const k = Math.min(w / Math.max(size.x, 1e-3), d / Math.max(size.z, 1e-3), h / Math.max(size.y, 1e-3));
    const kk = isFinite(k) && k > 0 ? k : 1;
    obj.scale.multiplyScalar(kk);
    box.setFromObject(obj);
    const c = box.getCenter(new T.Vector3());
    obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box.min.y;
    const wrap = new T.Group(); wrap.add(obj);
    return wrap;
  };
})(typeof window !== 'undefined' ? window : globalThis);
