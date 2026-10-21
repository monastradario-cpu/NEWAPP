/* Casa Mia — ispirazione: bacheca idee, foto della stanza trasformata, abbinamenti, proposte dell'AI */
(function (root) {
  'use strict';
  const CM = root.CM;
  const P = CM.plan;
  const U = () => CM.ui;
  const el = (...a) => CM.ui.el(...a);
  const IN = CM.inspire = {};

  /* ---------- Utilità immagini ---------- */
  // Riduce un'immagine (file o data URL) per conservarla nel progetto senza appesantirlo
  IN.shrink = function (src, max) {
    max = max || 900;
    return new Promise((resolve) => {
      const go = (url) => {
        const im = new Image();
        im.onload = () => {
          const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
          const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
          const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.82));
        };
        im.onerror = () => resolve(null);
        im.src = url;
      };
      if (typeof src === 'string') go(src);
      else { const r = new FileReader(); r.onload = () => go(r.result); r.onerror = () => resolve(null); r.readAsDataURL(src); }
    });
  };
  IN.pickImage = function (capture) {
    return new Promise(resolve => {
      const input = el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
      if (capture) input.setAttribute('capture', 'environment');
      document.body.appendChild(input);
      input.addEventListener('change', () => { const f = input.files[0]; input.remove(); resolve(f || null); });
      input.click();
    });
  };

  const needAI = async () => {
    if (CM.ai.enabled()) return true;
    await CM.share.aiSettings();
    return CM.ai.enabled();
  };
  const roomLabel = (plan, key) => key === 'casa' ? 'Tutta la casa' : (plan.rooms[key] ? plan.rooms[key].name : 'Stanza');

  /* ---------- Menu ---------- */
  IN.open = async function (ctx) {
    const c = await U().menu('Ispirazione', [
      { id: 'board', label: 'Bacheca idee', icon: 'image' },
      { id: 'describe', label: 'Descrivi a parole, propone l’AI', icon: 'spark' },
      { id: 'photo', label: 'Trasforma una foto della tua stanza', icon: 'camera' },
      { id: 'styles', label: 'Galleria degli stili', icon: 'copy' }
    ]);
    if (c === 'board') IN.board(ctx);
    if (c === 'describe') IN.describe(ctx);
    if (c === 'photo') IN.transformPhoto(ctx);
    if (c === 'styles') CM.personal.styleGallery(ctx);
  };

  /* ---------- Bacheca idee ---------- */
  function boards(project) { project.boards = project.boards || {}; return project.boards; }

  IN.addToBoard = async function (ctx, src, note) {
    const plan = ctx.plan();
    const keys = ['casa'].concat(Object.keys(plan.rooms));
    const where = keys.length > 1 ? await U().menu('In quale bacheca?', keys.map(k => ({ id: k, label: roomLabel(plan, k), icon: k === 'casa' ? 'house' : 'room' }))) : 'casa';
    if (!where) return;
    U().toast('Salvo l’immagine…');
    let data = typeof src === 'string' && /^https?:/i.test(src) ? await CM.localImage(src, 1000) : src;
    data = data ? await IN.shrink(data, 900) : null;
    if (!data) { U().toast('Non riesco a scaricare questa immagine'); return; }
    const b = boards(ctx.project);
    (b[where] = b[where] || []).push({ id: CM.uid('i'), img: data, note: note || '', at: Date.now() });
    CM.app.save();
    IN.board(ctx, where);
  };

  IN.board = async function (ctx, key) {
    const plan = ctx.plan();
    const b = boards(ctx.project);
    key = key || (ctx.room && plan.rooms[ctx.room] ? ctx.room : 'casa');
    const items = b[key] || [];
    const keys = ['casa'].concat(Object.keys(plan.rooms));
    const tabs = el('div', { class: 'chips-row' }, keys.map(k => el('button', { class: 'chip small' + (k === key ? ' active' : ''), text: roomLabel(plan, k) + (b[k] && b[k].length ? ' · ' + b[k].length : ''), onclick: () => { U().closeOverlay(); IN.board(ctx, k); } })));
    const grid = el('div', { class: 'board-grid' }, items.map(it => el('div', { class: 'board-item' }, [
      el('img', { src: it.img, alt: it.note || 'Idea' }),
      el('button', { class: 'board-del', 'aria-label': 'Togli', text: '×', onclick: () => { b[key] = items.filter(x => x !== it); CM.app.save(); U().closeOverlay(); IN.board(ctx, key); } })
    ])));
    const palBox = el('div', { class: 'swatches' });
    let palette = [];
    const add = el('div', { class: 'actions', style: 'justify-content:flex-start' }, [
      el('button', { class: 'btn small', text: 'Dalla galleria', onclick: async () => { const f = await IN.pickImage(false); if (f) { U().closeOverlay(); IN.addToBoardDirect(ctx, key, f); } } }),
      el('button', { class: 'btn small', text: 'Scatta foto', onclick: async () => { const f = await IN.pickImage(true); if (f) { U().closeOverlay(); IN.addToBoardDirect(ctx, key, f); } } }),
      el('button', { class: 'btn small', text: 'Da un link', onclick: async () => { const u = await U().promptDialog('Immagine da un link', '', { label: 'Link dell’immagine o della pagina', text: 'Incolla il link di un’immagine (Pinterest, Instagram, negozio). Puoi anche condividere direttamente un’immagine o un link verso Casa Mia dalle altre app.', ok: 'Aggiungi' }); if (u) { U().closeOverlay(); IN.addToBoardDirect(ctx, key, u.trim()); } } })
    ]);
    const body = el('div', {}, [
      tabs,
      items.length ? grid : el('div', { class: 'empty', text: 'Nessuna immagine. Aggiungi foto di case che ti piacciono: ne ricavo colori e stile.' }),
      add,
      items.length ? el('div', { class: 'sec-title', text: 'Colori delle tue immagini' }) : null,
      items.length ? palBox : null
    ]);
    if (items.length) {
      const all = [];
      for (const it of items) all.push(...(await CM.style.paletteFromImage(it.img, 5)));
      // unisco i colori simili, pesati per quanto compaiono
      const merged = [];
      all.sort((a, c) => c.share - a.share).forEach(c => { const m = merged.find(x => CM.style.dist(x.color, c.color) < 38); if (m) m.share += c.share; else merged.push(Object.assign({}, c)); });
      palette = merged.sort((a, c) => c.share - a.share).slice(0, 7);
      palette.forEach(c => palBox.appendChild(el('span', { class: 'swatch', style: 'background:' + c.color, title: c.color })));
    }
    const actions = [{ label: 'Chiudi', value: null }];
    if (items.length) { actions.push({ label: 'Chiedi all’AI', value: 'ai' }); actions.push({ label: 'Applica questi colori', value: 'apply', primary: true }); }
    const r = await U().dialog({ title: 'Bacheca idee', body, actions });
    if (r === 'apply') {
      const st = CM.style.styleFromPalette(palette, 'Su misura · ' + roomLabel(plan, key));
      CM.style.saveCustom(st);
      ctx.mutate(pl => { if (key === 'casa') CM.style.applyToHouse(pl, st); else CM.style.applyToRoom(pl, key, st); });
      ctx.after && ctx.after();
      U().toast('Colori applicati: lo stile “' + st.label + '” è salvato tra gli stili');
    }
    if (r === 'ai') IN.analyzeBoard(ctx, key);
  };
  IN.addToBoardDirect = async function (ctx, key, src) {
    U().toast('Salvo l’immagine…');
    let data = typeof src === 'string' && /^https?:/i.test(src) ? await CM.localImage(src, 1000) : src;
    data = data ? await IN.shrink(data, 900) : null;
    if (!data) { U().toast('Non riesco a scaricare questa immagine: salvala e scegli “Dalla galleria”'); IN.board(ctx, key); return; }
    const b = boards(ctx.project);
    (b[key] = b[key] || []).push({ id: CM.uid('i'), img: data, at: Date.now() });
    CM.app.save();
    IN.board(ctx, key);
  };

  /* ---------- AI: stile da descrizione, da immagini, abbinamenti ---------- */
  const STYLE_SCHEMA = 'Rispondi SOLO con JSON: {"nome": "breve nome dello stile", "descrizione": "una frase", "stile_vicino": uno tra ' + JSON.stringify(CM.STYLES.map(s => s.id)) +
    ', "pareti": "#rrggbb", "accento": "#rrggbb", "tessuti": "#rrggbb", "tappeto": "#rrggbb", "tipo_tessuto": uno tra ' + JSON.stringify(CM.FABRICS.map(f => f.id)) +
    ', "legno": uno tra ' + JSON.stringify(CM.WOODS.map(w => w.id)) + ', "metallo": uno tra ' + JSON.stringify(CM.METALS.map(m => m.id)) +
    ', "pavimento": uno tra ' + JSON.stringify(['m-parquet-rovere', 'm-laminato', 'm-gres-legno', 'm-gres-cemento', 'm-gres-marmo', 'm-resina']) +
    ', "luce_calda": numero 0-1, "consigli": ["3-6 consigli concreti di arredo, oggetti, luci e tessili da comprare"]}';

  function styleFromAI(j) {
    const near = CM.style.byId(j.stile_vicino) || CM.STYLES[0];
    const isHex = (h) => /^#[0-9a-f]{6}$/i.test(h || '');
    return {
      id: 'ai-' + Date.now().toString(36), label: j.nome || ('Come ' + near.label), desc: j.descrizione || near.desc, custom: true,
      walls: isHex(j.pareti) ? j.pareti : near.walls, accent: isHex(j.accento) ? j.accento : near.accent,
      fabric: isHex(j.tessuti) ? j.tessuti : near.fabric, rug: isHex(j.tappeto) ? j.tappeto : near.rug,
      fabricType: CM.FABRICS.some(f => f.id === j.tipo_tessuto) ? j.tipo_tessuto : near.fabricType,
      wood: CM.style.wood(j.legno) ? j.legno : near.wood, metal: CM.style.metal(j.metallo) ? j.metallo : near.metal,
      floor: CM.lib.material(j.pavimento) ? j.pavimento : near.floor, warm: typeof j.luce_calda === 'number' ? j.luce_calda : near.warm,
      tips: Array.isArray(j.consigli) ? j.consigli.slice(0, 8) : []
    };
  }

  async function proposeStyle(ctx, st, key) {
    const plan = ctx.plan();
    const body = el('div', {}, [
      CM.personal.styleCard(st, () => {}),
      st.tips && st.tips.length ? el('div', { class: 'sec-title', text: 'Consigli' }) : null,
      st.tips && st.tips.length ? el('ul', { class: 'tips' }, st.tips.map(t => el('li', { text: t }))) : null
    ]);
    const acts = [{ label: 'Chiudi', value: null }, { label: 'Salva lo stile', value: 'save' }];
    acts.push({ label: key && key !== 'casa' && plan.rooms[key] ? 'Applica a ' + plan.rooms[key].name : 'Applica alla casa', value: 'apply', primary: true });
    const r = await U().dialog({ title: 'Proposta', body, actions: acts });
    if (!r) return;
    CM.style.saveCustom(st);
    if (r === 'apply') {
      ctx.mutate(pl => { if (key && key !== 'casa' && pl.rooms[key]) CM.style.applyToRoom(pl, key, st); else CM.style.applyToHouse(pl, st); });
      ctx.after && ctx.after();
      U().toast('Stile “' + st.label + '” applicato');
    } else U().toast('Salvato tra gli stili');
  }

  IN.describe = async function (ctx) {
    if (!(await needAI())) return;
    const plan = ctx.plan();
    const keys = ['casa'].concat(Object.keys(plan.rooms));
    const ta = el('textarea', { rows: 4, placeholder: 'Es. soggiorno caldo e accogliente, legno chiaro, verde salvia, tanta luce, niente di troppo moderno', 'aria-label': 'Descrizione', style: 'width:100%' });
    let key = ctx.room || 'casa';
    const chips = el('div', { class: 'chips-row wrap' });
    const draw = () => { chips.innerHTML = ''; keys.forEach(k => chips.appendChild(el('button', { class: 'chip small' + (k === key ? ' active' : ''), text: roomLabel(plan, k), onclick: () => { key = k; draw(); } }))); };
    draw();
    const r = await U().dialog({ title: 'Come la vuoi?', text: 'Descrivi a parole l’atmosfera che cerchi: l’AI propone colori, materiali e consigli.', body: el('div', {}, [chips, ta]), actions: [{ label: 'Annulla', value: null }, { label: 'Proponi', value: () => ta.value, primary: true }] });
    if (!r || !String(r).trim()) return;
    U().toast('Gemini sta pensando…');
    try {
      const room = key !== 'casa' ? plan.rooms[key] : null;
      const j = await CM.ai.text('Sei un interior designer italiano. ' + (room ? 'Ambiente: ' + room.name + ' (' + CM.roomType(room.type).label + ', ' + CM.fmt.area(P.roomStats(plan, room).net) + '). ' : 'Tutta la casa. ') + 'Richiesta: ' + r + '. ' + STYLE_SCHEMA, { json: true });
      proposeStyle(ctx, styleFromAI(j), key);
    } catch (e) { U().toast(CM.ai.errorText(e)); }
  };

  IN.analyzeBoard = async function (ctx, key) {
    if (!(await needAI())) return;
    const items = (boards(ctx.project)[key] || []).slice(-4);
    if (!items.length) return;
    U().toast('Gemini guarda le tue immagini…');
    try {
      const j = await CM.ai.text('Sei un interior designer italiano. Guarda queste immagini di ispirazione e ricava lo stile comune. ' + STYLE_SCHEMA, { json: true, images: items.map(i => i.img) });
      proposeStyle(ctx, styleFromAI(j), key);
    } catch (e) { U().toast(CM.ai.errorText(e)); }
  };

  // Parto da un mobile che mi piace: l'AI abbina colori e il resto
  IN.matchFromItem = async function (ctx, fid) {
    if (!(await needAI())) return;
    const plan = ctx.plan();
    const f = plan.furniture[fid];
    if (!f) return;
    const rid = P.roomOf(plan, f);
    U().toast('Gemini cerca gli abbinamenti…');
    try {
      const desc = f.name + ', colore ' + (f.color || '') + (f.fabric ? ', tessuto ' + f.fabric : '') + (f.wood ? ', legno ' + f.wood : '') + (f.metal ? ', metallo ' + f.metal : '') + (f.store ? ', del negozio ' + f.store : '');
      const imgs = f.img && /^data:/.test(f.img) ? [f.img] : [];
      const j = await CM.ai.text('Sei un interior designer italiano. Questo mobile mi piace molto e voglio costruirci intorno la stanza (' + (rid ? plan.rooms[rid].name : 'stanza') + '): ' + desc + '. Proponi lo stile che lo valorizza. Nei consigli indica cosa abbinare (tipo di mobile, colore, materiale). ' + STYLE_SCHEMA, { json: true, images: imgs });
      const st = styleFromAI(j);
      proposeStyle(ctx, st, rid || 'casa');
    } catch (e) { U().toast(CM.ai.errorText(e)); }
  };

  /* ---------- Foto della stanza vera trasformata ---------- */
  IN.transformPhoto = async function (ctx) {
    if (!(await needAI())) return;
    const how = await U().menu('Foto della stanza', [{ id: 'cam', label: 'Scatta ora', icon: 'camera' }, { id: 'gal', label: 'Dalla galleria', icon: 'image' }]);
    if (!how) return;
    const file = await IN.pickImage(how === 'cam');
    if (!file) return;
    const photo = await IN.shrink(file, 1280);
    if (!photo) { U().toast('Non riesco ad aprire la foto'); return; }
    let chosen = null;
    const styles = CM.style.all();
    const ta = el('textarea', { rows: 2, placeholder: 'Facoltativo: es. divano verde salvia, parquet chiaro, più luce', 'aria-label': 'Indicazioni', style: 'width:100%' });
    const grid = el('div', { class: 'chips-row wrap' });
    const draw = () => { grid.innerHTML = ''; styles.forEach(s => grid.appendChild(el('button', { class: 'chip small' + (chosen === s ? ' active' : ''), text: s.label, onclick: () => { chosen = s; draw(); } }))); };
    draw();
    const r = await U().dialog({ title: 'Come la trasformo?', body: el('div', {}, [el('img', { src: photo, alt: 'La tua stanza', style: 'width:100%;border-radius:12px;max-height:200px;object-fit:cover' }), el('div', { class: 'sec-title', text: 'Stile' }), grid, el('div', { class: 'sec-title', text: 'Indicazioni' }), ta]), actions: [{ label: 'Annulla', value: null }, { label: 'Trasforma', value: 'go', primary: true }] });
    if (r !== 'go') return;
    const st = chosen;
    const wood = st && CM.style.wood(st.wood);
    const prompt = 'Ridisegna questa foto della stanza come una fotografia d’interni fotorealistica dopo una ristrutturazione. Mantieni la stessa inquadratura, la stessa forma della stanza, porte e finestre nella stessa posizione. ' +
      (st ? 'Stile ' + st.label + ' (' + st.desc + '): pareti ' + st.walls + ', parete d’accento ' + st.accent + ', tessuti ' + st.fabric + ', legno ' + (wood ? wood.label : '') + ', dettagli in metallo ' + ((CM.style.metal(st.metal) || {}).label || '') + '. ' : '') +
      (ta.value ? 'Indicazioni: ' + ta.value + '. ' : '') + 'Luce naturale, materiali realistici, nessuna persona.';
    U().toast('Gemini sta trasformando la foto (può richiedere un minuto)…');
    try {
      const img = await CM.ai.image(prompt, photo);
      const slider = el('div', { class: 'ba' }, [el('img', { src: photo, alt: 'Prima' }), el('img', { src: img, alt: 'Dopo', class: 'after' })]);
      const range = el('input', { type: 'range', min: '0', max: '100', value: '50', 'aria-label': 'Prima e dopo' });
      range.addEventListener('input', () => { slider.querySelector('.after').style.clipPath = 'inset(0 0 0 ' + range.value + '%)'; });
      slider.querySelector('.after').style.clipPath = 'inset(0 0 0 50%)';
      const res = await U().dialog({ title: 'Prima e dopo', body: el('div', {}, [slider, range]), actions: [{ label: 'Chiudi', value: null }, { label: 'In bacheca', value: 'board' }, { label: 'Condividi', value: 'share', primary: true }] });
      if (res === 'share') CM.share.file('stanza-trasformata.png', 'image/png', img, true);
      if (res === 'board') IN.addToBoard(ctx, img, 'Trasformata con l’AI');
    } catch (e) { U().toast(CM.ai.errorText(e)); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
