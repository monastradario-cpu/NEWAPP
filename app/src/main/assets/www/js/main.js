/* Casa Mia — avvio, home dei progetti, schede del progetto e collegamenti tra moduli */
(function () {
  'use strict';
  const CM = window.CM, U = CM.ui, P = CM.plan, S = CM.store, el = U.el;
  const $ = (id) => document.getElementById(id);

  let project = null;
  let editor = null;
  let view3d = null;
  let saveTimer = 0;
  let tab = 'pianta';
  let sheetMode = null; // 'underlay' quando è aperto il pannello della planimetria
  let lastRevealed = '';

  /* ================= HOME ================= */
  function relDate(ts) {
    const d = new Date(ts), now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Modificato oggi alle ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    return 'Modificato il ' + d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  }

  function drawThumb(canvas, p) {
    const dpr = window.devicePixelRatio || 1, w = 104, h = 72;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const plan = CM.project.plan(p);
    CM.render.draw(ctx, { plan, view: CM.render.fitView(plan, w, h, 7), width: w, height: h, thumb: true });
  }

  function renderHome() {
    const list = $('projectList');
    list.innerHTML = '';
    const items = S.listProjects();
    if (!items.length) list.appendChild(el('div', { class: 'empty', html: 'Nessun progetto per ora.<br>Tocca <b>Nuovo</b> per iniziare oppure apri l’<b>Esempio</b>.' }));
    for (const s of items) {
      const cv = el('canvas', { 'aria-hidden': 'true' });
      const p = S.loadProject(s.id);
      if (p) drawThumb(cv, p);
      const meta = CM.fmt.num(s.area || 0, 1) + ' m² · ' + (s.rooms || 0) + (s.rooms === 1 ? ' ambiente' : ' ambienti') + (s.variants > 1 ? ' · ' + s.variants + ' varianti' : '');
      const title = el('div', { class: 'pc-title' }, [s.name, s.sample ? el('span', { class: 'pc-tag', text: 'Esempio' }) : null]);
      const card = el('button', { class: 'project-card', onclick: () => openProject(s.id), 'aria-label': 'Apri ' + s.name }, [
        cv, el('div', { class: 'pc-body' }, [title, el('div', { class: 'pc-meta', text: meta }), el('div', { class: 'pc-date', text: relDate(s.updated) })])
      ]);
      const more = el('button', { class: 'icon-btn ghost pc-menu', 'aria-label': 'Opzioni per ' + s.name, html: U.icon('dots'), onclick: (e) => { e.stopPropagation(); projectMenu(s); } });
      list.appendChild(el('div', { class: 'pc-wrap' }, [card, more]));
    }
    const ver = currentVersion();
    let v = document.querySelector('.version');
    if (!v) { v = el('div', { class: 'version' }); document.querySelector('.home-body').appendChild(v); }
    const last = S.pref('ultimoBackup');
    v.textContent = 'Casa Mia ' + ver + (last ? ' · ultimo backup ' + new Date(last).toLocaleDateString('it-IT') : '');
  }

  async function projectMenu(s) {
    const choice = await U.menu(s.name, [
      { id: 'rename', label: 'Rinomina', icon: 'rename' },
      { id: 'dup', label: 'Duplica', icon: 'copy' },
      { id: 'export', label: 'Esporta il file del progetto', icon: 'opening' },
      { id: 'delete', label: 'Elimina', icon: 'trash', danger: true }
    ]);
    const p = S.loadProject(s.id);
    if (!p) return;
    if (choice === 'rename') {
      const name = await U.promptDialog('Rinomina progetto', p.name, { label: 'Nome' });
      if (name && name.trim()) { p.name = name.trim(); p.updated = Date.now(); S.saveProject(p); renderHome(); }
    } else if (choice === 'dup') {
      const copy = CM.clone(p);
      copy.id = CM.uid('p'); copy.name = p.name + ' (copia)'; copy.sample = false; copy.created = copy.updated = Date.now();
      S.saveProject(copy); renderHome(); U.toast('Progetto duplicato');
    } else if (choice === 'export') {
      CM.share.exportProject(p);
    } else if (choice === 'delete') {
      const ok = await U.confirmDialog('Eliminare il progetto?', '“' + p.name + '” verrà cancellato dal telefono. L’operazione non si può annullare.', 'Elimina', true);
      if (ok) { S.deleteProject(p.id); renderHome(); U.toast('Progetto eliminato'); }
    }
  }

  async function newProject(withPlan) {
    const n = S.listProjects().length + 1;
    const name = await U.promptDialog(withPlan ? 'Nuovo progetto da planimetria' : 'Nuovo progetto', n === 1 ? 'Casa mia' : 'Progetto ' + n, { label: 'Nome del progetto', ok: withPlan ? 'Avanti' : 'Crea' });
    if (!name || !name.trim()) return;
    const p = CM.project.create(name.trim());
    S.saveProject(p);
    openProject(p.id);
    if (withPlan) loadUnderlay();
    // (progetto vuoto: ci pensa la scheda \u201cCome vuoi iniziare?\u201d)
  }

  function openSample() {
    const existing = S.listProjects().find(s => s.sample);
    if (existing) return openProject(existing.id);
    const p = CM.sample.create();
    S.saveProject(p);
    openProject(p.id);
  }

  function show(screen) {
    $('home').classList.toggle('hidden', screen !== 'home');
    $('editor').classList.toggle('hidden', screen !== 'editor');
  }

  /* ================= PROGETTO ================= */
  const TOOLS = [
    { id: 'select', label: 'Seleziona', icon: 'select' },
    { id: 'room', label: 'Stanza', icon: 'room' },
    { id: 'wall', label: 'Muro', icon: 'wall' },
    { id: 'opening', label: 'Porte e finestre', icon: 'opening' },
    { id: 'furniture', label: 'Arredo', icon: 'sofa' },
    { id: 'fixture', label: 'Impianti', icon: 'plug' },
    { id: 'column', label: 'Pilastro', icon: 'column' },
    { id: 'beam', label: 'Trave', icon: 'beam' },
    { id: 'underlay', label: 'Planimetria', icon: 'image' },
    { id: 'measure', label: 'Metro', icon: 'ruler' },
    { id: 'multi', label: 'Seleziona pi\u00f9', icon: 'select' },
    { id: 'erase', label: 'Cancella zona', icon: 'trash' }
  ];

  async function openProjectFile() {
    const r = await CM.share.importFile();
    afterImport(r);
  }
  function afterImport(r) {
    if (!r) return;
    renderHome();
    if (r.project) openProject(r.project);
  }
  // Qualcosa condiviso verso l'app (file di progetto o link di un negozio)
  CM.onShared = function (text, name) {
    text = String(text || '').trim();
    if (!text) { U.toast('File vuoto o non leggibile'); return; }
    if (/^\s*[{[]/.test(text)) { afterImport(CM.share.importText(text)); return; }
    const isImg = /^data:image\//.test(text);
    const m = isImg ? null : /https?:\/\/\S+/.exec(text);
    (async () => {
      let what = isImg ? 'board' : null;
      if (m) what = await U.menu('Cosa faccio con questo link?', [{ id: 'board', label: 'Aggiungi alla bacheca idee', icon: 'image' }, { id: 'shop', label: 'Importa articoli dal negozio', icon: 'sofa' }]);
      if (!what) return;
      if (what === 'shop') { if (S.isNative && window.CasaMiaAndroid.openShop) { U.toast('Apro il negozio: tocca \u201cImporta\u201d sugli articoli'); window.CasaMiaAndroid.openShop(m[0]); } return; }
      if (!project) {
        const list = S.listProjects ? S.listProjects() : [];
        if (!list.length) { U.toast('Crea prima un progetto'); return; }
        const pid = list.length === 1 ? list[0].id : await U.menu('In quale progetto?', list.map(p => ({ id: p.id, label: p.name, icon: 'house' })));
        if (!pid) return;
        openProject(pid);
      }
      CM.inspire.addToBoard(persCtx(), isImg ? text : m[0]);
    })();
    if (!isImg && !m) U.toast('Non so cosa fare con questo contenuto');
  };

  /* ---------- Modalit\u00e0 semplice / completa ---------- */
  function isSimple() { return !!S.pref('simpleMode'); }
  function applyMode() {
    const on = isSimple();
    document.body.classList.toggle('simple', on);
    const b = $('modeBtn');
    if (b) { b.textContent = 'Semplice'; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  }
  function toggleMode() {
    S.pref('simpleMode', !isSimple());
    applyMode();
    if (isSimple() && tab === 'lavori') setTab('pianta');
    if (isSimple() && ['fixture', 'column', 'beam'].includes(editor.tool)) editor.setTool('select');
    buildTools(); renderSheet(); if (tab !== 'pianta' && tab !== '3d') renderTab();
    U.toast(isSimple() ? 'Modalit\u00e0 semplice: impianti, strutture, lavori e preventivi nascosti' : 'Modalit\u00e0 completa: tutte le funzioni');
  }

  /* ---------- Progetto vuoto: tre grandi scelte ---------- */
  const IC = (d) => '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">' + d + '</svg>';
  function updateStart() {
    const card = $('startCard');
    if (!card || !editor) return;
    const p = editor.plan;
    const empty = p && !Object.keys(p.walls).length && !Object.keys(p.rooms).length && !p.underlay && editor.tool === 'select';
    card.classList.toggle('hidden', !empty);
    $('hint').classList.toggle('hidden-soft', !!empty);
    if (!empty || card.childNodes.length) return;
    const big = (icon, title, sub, fn) => el('button', { class: 'big', onclick: fn, html: IC(icon) + '<span><b>' + title + '</b><small>' + sub + '</small></span>' });
    card.appendChild(el('h3', { text: 'Come vuoi iniziare?' }));
    card.appendChild(el('p', { text: 'Scegli un modo: potrai sempre aggiungere e correggere dopo.' }));
    card.appendChild(big('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>', 'Carica la planimetria', 'Foto, immagine o PDF: riconosco i muri da solo', () => { card.classList.add('hidden'); loadUnderlay(); }));
    card.appendChild(big('<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12h8v8"/>', 'Disegna una stanza', 'Trascina il dito sulla griglia, poi correggi le misure', () => { editor.setTool('room'); buildTools(); card.classList.add('hidden'); U.toast('Trascina il dito in diagonale per disegnare la stanza'); }));
    card.appendChild(big('<path d="M4 17l6-6 4 4 6-6"/><path d="M3 21h18"/><path d="M14 4h6v6"/>', 'Scrivi le misure', 'Larghezza \u00d7 lunghezza: le stanze si affiancano da sole', () => { card.classList.add('hidden'); roomByMeasures(); }));
  }

  // Stanza dalle misure: si attacca a destra (o sotto) della casa gi\u00e0 disegnata
  async function roomByMeasures() {
    const v = { w: '', l: '', type: 'soggiorno', where: 'destra' };
    const plan = editor.plan;
    const hasRooms = Object.keys(plan.rooms).length > 0;
    const wIn = el('input', { type: 'text', inputmode: 'decimal', class: 'num', placeholder: 'es. 4,20', 'aria-label': 'Larghezza' });
    const lIn = el('input', { type: 'text', inputmode: 'decimal', class: 'num', placeholder: 'es. 3,50', 'aria-label': 'Lunghezza' });
    const types = ['soggiorno', 'cucina', 'camera', 'cameretta', 'bagno', 'corridoio', 'ingresso', 'studio', 'ripostiglio', 'lavanderia', 'balcone', 'altro'];
    const chips = el('div', { class: 'chips-row wrap' });
    const drawChips = () => { chips.innerHTML = ''; types.forEach(k => chips.appendChild(el('button', { class: 'chip small' + (v.type === k ? ' active' : ''), text: CM.roomType(k).label, onclick: () => { v.type = k; drawChips(); } }))); };
    drawChips();
    const body = el('div', {}, [
      chips,
      el('div', { class: 'fields', style: 'margin-top:10px' }, [
        el('div', { class: 'field' }, [el('label', { text: 'Larghezza' }), el('div', { class: 'input-unit' }, [wIn, el('span', { text: 'm' })])]),
        el('div', { class: 'field' }, [el('label', { text: 'Lunghezza' }), el('div', { class: 'input-unit' }, [lIn, el('span', { text: 'm' })])]),
        hasRooms ? U.segField('Dove la metto', [{ value: 'destra', label: 'A destra' }, { value: 'sotto', label: 'Sotto' }, { value: 'sinistra', label: 'A sinistra' }, { value: 'sopra', label: 'Sopra' }], v.where, x => { v.where = x; body.querySelectorAll('.seg button').forEach(b => { const on = b.textContent.toLowerCase().includes(x); b.classList.toggle('on', on); }); }) : null
      ])
    ]);
    const r = await U.dialog({ title: hasRooms ? 'Aggiungi una stanza' : 'Prima stanza', text: 'Scegli il tipo e scrivi le misure interne.', body, actions: [{ label: 'Annulla', value: null }, { label: 'Aggiungi', value: 'ok', primary: true }] });
    if (r !== 'ok') { updateStart(); return; }
    const W = CM.fmt.parseM(wIn.value, 'm'), L = CM.fmt.parseM(lIn.value, 'm');
    if (!(W > 0.3) || !(L > 0.3)) { U.toast('Scrivi larghezza e lunghezza (es. 4,20)'); return roomByMeasures(); }
    const s = project.settings;
    const b = hasRooms ? P.bounds(Object.assign({}, plan, { underlay: null, furniture: {}, fixtures: {} })) : null;
    // le misure scritte sono interne: il disegno usa l'asse dei muri, quindi aggiungo lo spessore
    const t = s.wallT || 0.1, AW = W + t, AL = L + t;
    let x0 = 0, y0 = 0;
    if (b) {
      if (v.where === 'destra') { x0 = b.maxX; y0 = b.minY; }
      else if (v.where === 'sinistra') { x0 = b.minX - AW; y0 = b.minY; }
      else if (v.where === 'sotto') { x0 = b.minX; y0 = b.maxY; }
      else { x0 = b.minX; y0 = b.minY - AL; }
    }
    let rid;
    editor.mutate(pl => { rid = P.addRectRoom(pl, x0, y0, x0 + AW, y0 + AL, { type: v.type, h: s.wallH, wall: { t: s.wallT, h: s.wallH, state: s.newState } }); }, 'room');
    editor.setTool('select'); buildTools();
    editor.fit();
    editor.select({ type: 'room', id: rid });
    const again = await U.dialog({ title: CM.roomType(v.type).label + ' aggiunta', text: CM.fmt.m(W) + ' \u00d7 ' + CM.fmt.m(L) + ' = ' + CM.fmt.area(W * L) + '. Vuoi aggiungerne un\u2019altra?', actions: [{ label: 'Basta cos\u00ec', value: false }, { label: 'Un\u2019altra stanza', value: true, primary: true }] });
    if (again) roomByMeasures();
  }

  function buildTools() {
    updateStart();
    const bar = $('tools');
    bar.innerHTML = '';
    const activeTool = sheetMode === 'underlay' ? 'underlay' : editor.tool;
    const SIMPLE_HIDE = ['fixture', 'column', 'beam'];
    for (const t of TOOLS) {
      if (isSimple() && SIMPLE_HIDE.includes(t.id)) continue;
      const on = activeTool === t.id || (t.id === 'underlay' && ['calibrate', 'moveUnderlay', 'calibPick'].includes(editor.tool));
      bar.appendChild(el('button', {
        class: 'chip' + (on ? ' active' : ''), 'data-tool': t.id, 'aria-pressed': on ? 'true' : 'false',
        html: U.icon(t.icon, 18) + '<span>' + t.label + '</span>', onclick: () => toolClick(t.id)
      }));
    }
    const st = project.settings.newState;
    bar.appendChild(el('button', {
      class: 'chip state', 'aria-label': 'Stato dei muri che disegni: ' + CM.WALL_STATES[st].label,
      html: '<span class="dot ' + st + '"></span><span>Nuovi muri: ' + CM.WALL_STATES[st].label.toLowerCase() + '</span>',
      onclick: () => {
        project.settings.newState = st === 'esistente' ? 'nuovo' : 'esistente';
        scheduleSave(); buildTools();
        U.toast(project.settings.newState === 'nuovo' ? 'I muri che disegni saranno “da costruire” (rossi)' : 'I muri che disegni saranno “esistenti” (neri)');
      }
    }));
    const sub = $('subtools');
    sub.innerHTML = '';
    const showSub = editor.tool === 'opening' || editor.tool === 'fixture';
    sub.classList.toggle('hidden', !showSub);
    if (editor.tool === 'opening') {
      for (const k in CM.OPENINGS) sub.appendChild(el('button', {
        class: 'chip small' + (editor.openingKind === k ? ' active' : ''), 'aria-pressed': editor.openingKind === k ? 'true' : 'false',
        html: U.icon(k, 18) + '<span>' + CM.OPENINGS[k].label + '</span>', onclick: () => { editor.setTool('opening', k); buildTools(); }
      }));
    }
    if (editor.tool === 'fixture') {
      for (const k in CM.FIXTURES) {
        const g = CM.FIXTURE_GROUPS[CM.FIXTURES[k].group];
        sub.appendChild(el('button', {
          class: 'chip small' + (editor.fixtureKind === k ? ' active' : ''), 'aria-pressed': editor.fixtureKind === k ? 'true' : 'false',
          html: '<span class="dot" style="background:' + g.color + ';border-radius:99px"></span><span>' + CM.FIXTURES[k].label + '</span>',
          onclick: () => { editor.fixtureKind = k; editor.setTool('fixture'); buildTools(); }
        }));
      }
    }
    requestAnimationFrame(() => editor.resize());
  }

  async function toolClick(id) {
    if (id === 'underlay') {
      if (!editor.plan.underlay) { loadUnderlay(); return; }
      editor.setTool('select');
      editor.select({});
      sheetMode = 'underlay';
      buildTools(); renderSheet();
      return;
    }
    sheetMode = null;
    if (id === 'furniture') {
      const it = await CM.tabs.pickItem();
      if (!it) { buildTools(); return; }
      editor.setPendingItem(it);
      buildTools();
      return;
    }
    editor.setTool(id);
    buildTools();
    renderSheet();
  }

  function openProject(id) {
    const p = S.loadProject(id);
    if (!p) { U.toast('Progetto non trovato'); renderHome(); return; }
    project = p;
    sheetMode = null;
    show('editor');
    setTab('pianta', true);
    editor.setProject(project);
    editor.setTool('select');
    buildTools();
    updateHeader();
    updateCompass();
    updateSummary();
    renderSheet();
    CM.share.history.auto(project);
  }

  function reloadProject() {
    if (!project) return;
    editor.setProject(project);
    buildTools(); updateHeader(); updateSummary(); renderSheet();
    if (tab !== 'pianta') renderTab();
    scheduleSave();
  }

  function goHome() {
    if (project) CM.share.history.auto(project);
    saveNow();
    project = null;
    if (view3d) view3d.setVisible(false);
    show('home');
    renderHome();
  }

  function updateHeader() {
    if (!project) return;
    $('projectName').textContent = project.name;
    const t = P.totals(editor.plan);
    $('projectSub').textContent = CM.project.variant(project).name + (project.variants.length > 1 ? ' ▾' : '') + ' · ' + CM.fmt.area(t.net);
  }

  function allWarnings() {
    try { return CM.problems(editor.plan, editor.warnings); } catch (e) { console.error(e); return []; }
  }

  function updateSummary() {
    updateStart();
    const plan = editor.plan;
    const t = P.totals(plan);
    let dem = 0, nuovo = 0;
    for (const id in plan.walls) {
      const w = plan.walls[id];
      if (w.state === 'demolire') dem += P.wallLen(plan, w);
      if (w.state === 'nuovo') nuovo += P.wallLen(plan, w);
    }
    const box = $('summary');
    box.innerHTML = '';
    const warns = allWarnings();
    const pb = $('probBtn');
    if (pb) { pb.classList.toggle('hidden', !warns.length); pb.querySelector('b').textContent = warns.length; }
    // superficie di ogni stanza, sempre in vista
    const rooms = Object.keys(plan.rooms).map(id => ({ id, r: plan.rooms[id], st: P.roomStats(plan, plan.rooms[id]) }));
    box.appendChild(el('button', { class: 'm2-chip total', onclick: areasDialog, html: 'Casa <b>' + CM.fmt.area(t.net) + '</b>' }));
    for (const x of rooms) box.appendChild(el('button', { class: 'm2-chip' + (editor.sel.type === 'room' && editor.sel.id === x.id ? ' on' : ''), onclick: () => focusSel({ type: 'room', id: x.id }), html: x.r.name + ' <b>' + CM.fmt.area(x.st.net) + '</b>' }));
    if (dem > 0) box.appendChild(el('span', { class: 'm2-chip plain', html: '<span class="dot demolire"></span> ' + CM.fmt.m(dem) }));
    if (nuovo > 0) box.appendChild(el('span', { class: 'm2-chip plain', html: '<span class="dot nuovo"></span> ' + CM.fmt.m(nuovo) }));
  }

  // Tabella delle superfici: stanza per stanza e totali
  function areasDialog() {
    const plan = editor.plan, t = P.totals(plan);
    const rows = Object.keys(plan.rooms).map(id => { const r = plan.rooms[id], st = P.roomStats(plan, r); return { r, st, out: !!CM.roomType(r.type).outdoor }; })
      .sort((a, b) => (a.out - b.out) || (b.st.net - a.st.net));
    const tbl = el('div', { class: 'card' }, rows.map(x => el('div', { class: 'line' }, [el('span', { class: 'l-main', text: x.r.name + (x.out ? ' (esterno)' : '') }), el('span', { class: 'l-num', text: CM.fmt.area(x.st.net) })])));
    const tot = el('div', { class: 'stats' }, [
      U.stat('Calpestabile', CM.fmt.area(t.net)), U.stat('Lorda (con i muri)', CM.fmt.area(t.gross)),
      t.outdoor > 0 ? U.stat('Esterni', CM.fmt.area(t.outdoor)) : null, U.stat('Stanze', String(t.rooms))
    ].filter(Boolean));
    U.dialog({ title: 'Metri quadri della casa', body: el('div', {}, [tbl, tot]), actions: [{ label: 'Chiudi', value: true, primary: true }] });
  }

  // Centro errori: ogni problema con \u201cVai\u201d (lo sistemi tu) e \u201cCorreggi\u201d (lo sistema l'app)
  function warningsDialog() {
    const list = allWarnings();
    if (!list.length) { U.toast('Nessun errore: tutto a posto'); return; }
    const fixable = list.filter(w => w.fix).length;
    const rows = list.map(w => el('div', { class: 'prob' }, [
      el('div', { class: 'prob-text', text: w.text }),
      el('div', { class: 'prob-acts' }, [
        (w.sel && w.sel.type) || w.at ? el('button', { class: 'btn small', text: 'Vai', onclick: () => { U.closeOverlay(); goProblem(w); } }) : null,
        w.fix ? el('button', { class: 'btn small primary', text: w.fixLabel || 'Correggi', onclick: () => { U.closeOverlay(); fixProblem(w); } }) : null
      ])
    ]));
    const body = el('div', {}, [el('div', { class: 'prob-list' }, rows), el('p', { class: 'muted small', text: CM.norms.NOTE })]);
    const actions = [{ label: 'Chiudi', value: false }];
    if (fixable > 1) actions.push({ label: 'Correggi tutto (' + fixable + ')', value: 'all', primary: true });
    U.dialog({ title: list.length + (list.length === 1 ? ' errore' : ' errori'), body, actions }).then(r => { if (r === 'all') fixAll(); });
  }
  function goProblem(w) {
    if (w.sel && w.sel.type) return focusSel(w.sel);
    setTab('pianta'); editor.setTool('select'); buildTools();
    if (w.at) editor.revealSegment({ a: w.at, b: w.at }, { x: 0, y: 0, w: $('stage').clientWidth, h: $('stage').clientHeight });
  }
  function fixProblem(w) {
    let ok = false;
    editor.mutate(pl => { ok = w.fix(pl); }, 'fix');
    U.toast(ok ? 'Corretto \u00b7 puoi annullare' : 'Non riesco a correggerlo da solo: toccalo e sistemalo tu');
    if (!ok && w.sel && w.sel.type) focusSel(w.sel);
    updateSummary();
  }
  function fixAll() {
    let n = 0;
    editor.mutate(pl => {
      const tried = new Set();
      for (let k = 0; k < 60; k++) {
        const w = CM.problems(pl).find(x => x.fix && !tried.has(x.text));
        if (!w) break;
        tried.add(w.text);
        if (w.fix(pl)) n++;
      }
    }, 'fix');
    U.toast(n ? n + ' errori corretti \u00b7 puoi annullare' : 'Nessuno corretto automaticamente');
    updateSummary();
  }

  function focusSel(sel) {
    setTab('pianta');
    editor.setTool('select');
    buildTools();
    editor.select(sel);
  }

  function updateCompass() {
    $('compassNeedle').setAttribute('transform', 'rotate(' + (project.north || 0) + ' 20 20)');
  }

  function updateScale(view) {
    const nice = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
    let L = nice[0];
    for (const n of nice) { L = n; if (n * view.s >= 48) break; }
    document.querySelector('#scalebar .bar').style.width = Math.round(L * view.s) + 'px';
    document.querySelector('#scalebar .lbl').textContent = L < 1 ? Math.round(L * 100) + ' cm' : CM.fmt.num(L, 0) + ' m';
  }

  /* ---------- Pannello proprietà ---------- */
  function sheetHead(kind, name) { return CM.sheets.head(kind, name, sheetCtx()); }

  function sheetCtx() {
    return {
      editor, project, mut: (fn, reason) => editor.mutate(fn, reason), refresh: renderSheet, save: scheduleSave,
      loadUnderlay, detectWalls, calibrate: () => autoCalibrate(),
      closeUnderlay: (keep) => { sheetMode = null; if (!keep) editor.setTool('select'); buildTools(); renderSheet(); }
    };
  }

  function renderSheet() {
    const sheet = $('sheet');
    if (sheet.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName) && document.activeElement.type !== 'range') return;
    const sel = editor.sel;
    const plan = editor.plan;
    const scroll = sheet.scrollTop;
    sheet.innerHTML = '';
    const multi = editor.tool === 'multi' && editor.multi;
    const has = sheetMode === 'underlay' || (sel.type && sel.type !== 'node') || !!multi;
    sheet.classList.toggle('hidden', !has);
    $('stage').classList.toggle('with-sheet', !!has);
    $('hint').classList.toggle('hidden', !!has);
    if (!has) { lastRevealed = ''; return; }
    const ctx = sheetCtx();
    const mut = ctx.mut;
    sheet.appendChild(el('div', { class: 'sheet-grab', 'aria-hidden': 'true' }));

    if (multi) {
      const n = P.setCount(multi);
      sheet.appendChild(sheetHead('Selezione', n + (n === 1 ? ' elemento' : ' elementi')));
      sheet.appendChild(el('p', { class: 'muted small', text: 'Trascina dentro il riquadro blu per spostare tutto insieme. ' + [multi.rooms.length ? multi.rooms.length + ' stanze' : '', multi.walls.length ? multi.walls.length + ' muri' : '', multi.furniture.length ? multi.furniture.length + ' mobili' : '', multi.fixtures.length ? multi.fixtures.length + ' impianti' : ''].filter(Boolean).join(', ') }));
      // la copia va nello spazio libero a destra di tutta la casa
      const offX = () => { const bb = P.setBounds(plan, multi), all = P.bounds(Object.assign({}, plan, { underlay: null })); return bb && all ? all.maxX + 0.6 - bb.x0 : 1; };
      sheet.appendChild(el('div', { class: 'actions' }, [
        el('button', { class: 'btn primary', html: U.icon('copy', 18) + 'Duplica', onclick: () => { let out; editor.mutate(pl => { out = P.copySet(pl, pl, multi, offX(), 0); }, 'duplicate'); editor.setMulti(out); renderSheet(); U.toast('Duplicato a destra: trascinalo dove vuoi'); } }),
        el('button', { class: 'btn', text: 'Copia', onclick: () => { CM.clipboard = { plan: CM.clone(plan), set: CM.clone(multi) }; U.toast('Copiato: incolla da \u22ee \u203a Incolla, anche in un\u2019altra variante o progetto'); } }),
        el('button', { class: 'btn danger', html: U.icon('trash', 18) + 'Elimina', onclick: () => { editor.mutate(pl => P.deleteSet(pl, multi), 'delete'); editor.setMulti(null); renderSheet(); U.toast('Eliminati \u00b7 puoi annullare'); } }),
        el('button', { class: 'btn', text: 'Fine', onclick: () => { editor.setTool('select'); buildTools(); renderSheet(); } })
      ]));
    } else if (sheetMode === 'underlay') {
      CM.sheets.underlay(sheet, ctx);
    } else if (sel.type === 'room' && plan.rooms[sel.id]) {
      const room = plan.rooms[sel.id];
      const st = P.roomStats(plan, room);
      const rect = P.rectInfo(plan, room);
      sheet.appendChild(sheetHead('Stanza', room.name));
      // tipo con un tocco
      const quick = ['soggiorno', 'cucina', 'camera', 'cameretta', 'bagno', 'corridoio', 'ingresso', 'studio', 'ripostiglio', 'lavanderia', 'balcone', 'altro'];
      sheet.appendChild(el('div', { class: 'chips-row wrap type-chips' }, quick.map(k => el('button', {
        class: 'chip small' + (room.type === k ? ' active' : ''), text: CM.roomType(k).label,
        onclick: () => mut(pl => { const r = pl.rooms[sel.id]; const auto = r.name === CM.roomType(r.type).label || /^Stanza \d+$/.test(r.name); r.type = k; if (auto) r.name = CM.roomType(k).label; }, 'type')
      }))));
      const fields = el('div', { class: 'fields' });
      fields.appendChild(U.textField('Nome', room.name, v => mut(pl => { pl.rooms[sel.id].name = v; }, 'rename'), { full: false }));
      fields.appendChild(U.selectField('Tipo di ambiente', CM.ROOM_TYPES.map(t => ({ value: t.id, label: t.label })), room.type, v => mut(pl => {
        const r = pl.rooms[sel.id];
        const auto = r.name === CM.roomType(r.type).label || /^Stanza \d+$/.test(r.name);
        r.type = v;
        if (auto) r.name = CM.roomType(v).label;
      }, 'type'), { full: false }));
      if (rect) {
        fields.appendChild(U.numField('Larghezza', rect.w, 'm', v => mut(pl => P.setRectSize(pl, sel.id, v, rect.h)), { min: 0.3, max: 100 }));
        fields.appendChild(U.numField('Lunghezza', rect.h, 'm', v => mut(pl => P.setRectSize(pl, sel.id, rect.w, v)), { min: 0.3, max: 100 }));
      }
      fields.appendChild(U.numField('Altezza soffitto', room.h || 2.7, 'cm', v => mut(pl => { pl.rooms[sel.id].h = v; }), { min: 1.5, max: 8 }));
      sheet.appendChild(fields);
      const ws = P.roomWallSurface(plan, room);
      sheet.appendChild(el('div', { class: 'stats' }, [
        U.stat('Pavimento netto', CM.fmt.area(st.net)), U.stat('Lorda (asse muri)', CM.fmt.area(st.gross)),
        U.stat('Perimetro', CM.fmt.m(st.perimeter)), U.stat('Volume', CM.fmt.num(st.net * (room.h || 2.7), 1) + ' m³')
      ]));
      sheet.appendChild(el('div', { class: 'sec-title', text: 'Superfici delle pareti' }));
      sheet.appendChild(el('div', { class: 'stats' }, [
        U.stat('Pareti lorde', CM.fmt.area(ws.gross)), U.stat('Pareti nette', CM.fmt.area(ws.net)),
        U.stat('Porte e finestre', CM.fmt.area(ws.openArea)), U.stat('Soffitto', CM.fmt.area(ws.ceiling)),
        U.stat('Pareti + soffitto', CM.fmt.area(ws.net + ws.ceiling))
      ]));
      sheet.appendChild(el('div', { class: 'muted small', style: 'margin-top:6px', text: 'Pareti nette = perimetro interno × altezza, meno porte e finestre: è la superficie da imbiancare o rivestire.' }));
      const nw = CM.norms.check(plan).filter(n => n.room === sel.id);
      if (nw.length) sheet.appendChild(el('div', { class: 'warn-box', html: nw.map(n => n.text).join('<br>') + '<br><small>' + CM.norms.NOTE + '</small>' }));
      const roomWalls = P.roomWalls(plan, room);
      const states = new Set(roomWalls.map(id => plan.walls[id].state));
      const f2 = el('div', { class: 'fields' });
      f2.appendChild(U.segField('Tutti i muri della stanza', Object.keys(CM.WALL_STATES).map(k => ({ value: k, label: CM.WALL_STATES[k].label, dot: k })), states.size === 1 ? [...states][0] : null, v => mut(pl => { roomWalls.forEach(id => { if (pl.walls[id]) pl.walls[id].state = v; }); }, 'state')));
      sheet.appendChild(f2);
      CM.sheets.roomFinish(sheet, ctx, sel.id);
      sheet.appendChild(el('div', { class: 'actions' }, [
        el('button', { class: 'btn', text: 'Consigli d’arredo (AI)', onclick: () => CM.share.layoutAdvice(project, sel.id) }),
        el('button', { class: 'btn', text: 'Foto / diario', onclick: () => CM.tabs.addDiary({ room: sel.id }) }),
        el('button', { class: 'btn danger', html: U.icon('trash', 18) + 'Elimina stanza', onclick: () => { editor.deleteSelection(); U.toast('Stanza eliminata · puoi annullare'); } })
      ]));
    } else if (sel.type === 'wall' && plan.walls[sel.id]) {
      const w = plan.walls[sel.id];
      const L = P.wallLen(plan, w);
      sheet.appendChild(sheetHead('Muro', CM.fmt.m(L)));
      const line = P.wallLine(plan, sel.id);
      const whole = line.length > 1 && editor.wallScope === 'all';
      const targets = whole ? line : [sel.id];
      const A = plan.nodes[w.a], B = plan.nodes[w.b];
      const horiz = Math.abs(B.x - A.x) >= Math.abs(B.y - A.y);
      const sideLabel = (end) => { const p = end === 'a' ? A : B, q = end === 'a' ? B : A; return horiz ? (p.x < q.x ? 'Sinistra' : 'Destra') : (p.y < q.y ? 'Sopra' : 'Sotto'); };
      const side = editor.stretchSide || 'b';
      const fields = el('div', { class: 'fields' });
      if (line.length > 1) fields.appendChild(U.segField('Modifica', [{ value: 'one', label: 'Solo questo tratto' }, { value: 'all', label: 'Tutta la parete (' + line.length + ' tratti)' }], whole ? 'all' : 'one', v => { editor.wallScope = v; renderSheet(); }));
      fields.appendChild(U.numField('Lunghezza di questo tratto', L, 'm', v => mut(pl => P.stretchWall(pl, sel.id, v, editor.stretchSide || 'b')), { min: 0.1, max: 100 }));
      fields.appendChild(U.segField('Allunga o accorcia verso', [{ value: 'a', label: sideLabel('a') }, { value: 'b', label: sideLabel('b') }], side, v => { editor.stretchSide = v; }));
      const angDeg = ((Math.atan2(B.y - A.y, B.x - A.x) * 180 / Math.PI) + 360) % 360;
      fields.appendChild(U.numField('Angolo', Math.round(angDeg * 10) / 10, '\u00b0', v => mut(pl => P.setWallAngle(pl, sel.id, v)), { min: 0, max: 360 }));
      fields.appendChild(U.numField('Spessore', w.t, 'cm', v => mut(pl => { targets.forEach(id => { if (pl.walls[id]) pl.walls[id].t = v; }); }), { min: 0.03, max: 1.2 }));
      fields.appendChild(U.numField('Altezza', w.h || 2.7, 'cm', v => mut(pl => { targets.forEach(id => { if (pl.walls[id]) pl.walls[id].h = v; }); }), { min: 0.3, max: 8 }));
      fields.appendChild(U.segField('Stato', Object.keys(CM.WALL_STATES).map(k => ({ value: k, label: CM.WALL_STATES[k].label, dot: k })), w.state, v => mut(pl => { targets.forEach(id => { if (pl.walls[id]) pl.walls[id].state = v; }); }, 'state')));
      sheet.appendChild(fields);
      if (line.length > 1) {
        // tutti i tratti della parete, ognuno modificabile
        const tot = line.reduce((a, id) => a + P.wallLen(plan, id), 0);
        const list = el('div', { class: 'fields' });
        list.appendChild(el('div', { class: 'field full' }, [el('label', { text: 'Tratti di questa parete \u00b7 totale ' + CM.fmt.m(tot) })]));
        line.forEach((id, i) => {
          const f = U.numField('Tratto ' + (i + 1) + (id === sel.id ? ' (selezionato)' : ''), P.wallLen(plan, id), 'm', v => mut(pl => P.stretchWall(pl, id, v, editor.stretchSide || 'b')), { min: 0.1, max: 100 });
          list.appendChild(f);
        });
        sheet.appendChild(list);
      }
      const ops = Object.keys(plan.openings).filter(o => plan.openings[o].wall === sel.id).length;
      const wsf = P.wallSurface(plan, sel.id);
      sheet.appendChild(el('div', { class: 'stats' }, [
        U.stat('Lorda per faccia', CM.fmt.area(wsf.gross)), U.stat('Netta per faccia', CM.fmt.area(wsf.net)),
        U.stat('Netta, due facce', CM.fmt.area(wsf.net * 2)), U.stat('Aperture', ops + ' · ' + CM.fmt.area(wsf.openings))
      ]));
      sheet.appendChild(el('div', { class: 'actions' }, [
        el('button', { class: 'btn', text: 'Vista frontale (prospetto)', onclick: () => CM.elevation && CM.elevation.open(editor.plan, sel.id) }),
        el('button', { class: 'btn', text: 'Curva il muro', onclick: async () => {
          const v = await U.promptDialog('Muro ad arco', '50', { label: 'Freccia (quanto sporge al centro)', unit: 'cm', inputmode: 'decimal', mono: true, text: 'Il muro diventa un arco che sporge verso l\u2019esterno della misura scritta. Con un numero negativo rientra verso la stanza. Le porte e finestre su questo muro vanno rimesse.', ok: 'Curva' });
          if (v == null) return;
          let sag = CM.fmt.parseM(v, 'cm');
          // positivo = verso l'esterno della stanza
          { const A0 = plan.nodes[w.a], B0 = plan.nodes[w.b], L0 = CM.geom.dist(A0, B0); const nn = { x: -(B0.y - A0.y) / L0, y: (B0.x - A0.x) / L0 }; const mid = { x: (A0.x + B0.x) / 2 + nn.x * 0.2, y: (A0.y + B0.y) / 2 + nn.y * 0.2 }; if (P.roomOf(plan, mid)) sag = -sag; }
          if (!isFinite(sag) || Math.abs(sag) < 0.02) { U.toast('Freccia non valida'); return; }
          editor.mutate(pl => P.curveWall(pl, sel.id, sag), 'curve'); editor.select({}); U.toast('Muro curvato \u00b7 puoi annullare');
        } })
      ]));
      sheet.appendChild(el('div', { class: 'actions' }, [
        el('button', { class: 'btn', text: 'Foto delle tracce', onclick: () => CM.tabs.addDiary({ type: 'tracce', wall: sel.id, room: P.roomOf(plan, { x: (plan.nodes[w.a].x + plan.nodes[w.b].x) / 2, y: (plan.nodes[w.a].y + plan.nodes[w.b].y) / 2 }) || '' }) }),
        el('button', { class: 'btn danger', html: U.icon('trash', 18) + 'Elimina muro', onclick: () => editor.deleteSelection() })
      ]));
    } else if (sel.type === 'opening' && plan.openings[sel.id]) {
      const op = plan.openings[sel.id];
      sheet.appendChild(sheetHead('Apertura', CM.OPENINGS[op.kind].label));
      const fields = el('div', { class: 'fields' });
      fields.appendChild(U.selectField('Tipo', Object.keys(CM.OPENINGS).map(k => ({ value: k, label: CM.OPENINGS[k].label })), op.kind, v => mut(pl => {
        const o = pl.openings[sel.id], d = CM.OPENINGS[v];
        o.kind = v; o.h = d.h; o.sill = d.sill;
      }, 'kind')));
      fields.appendChild(U.numField('Larghezza', op.w, 'cm', v => mut(pl => { pl.openings[sel.id].w = v; }), { min: 0.2, max: 8 }));
      fields.appendChild(U.numField('Altezza', op.h, 'cm', v => mut(pl => { pl.openings[sel.id].h = v; }), { min: 0.2, max: 6 }));
      if (op.kind === 'finestra') fields.appendChild(U.numField('Davanzale da terra', op.sill || 0, 'cm', v => mut(pl => { pl.openings[sel.id].sill = v; }), { min: 0, max: 3 }));
      fields.appendChild(U.numField('Distanza dall’angolo', Math.max(0, op.pos - op.w / 2), 'cm', v => mut(pl => { const o = pl.openings[sel.id]; o.pos = v + o.w / 2; }), { min: 0, max: 100 }));
      CM.sheets.openingState(fields, ctx, sel.id);
      sheet.appendChild(fields);
      const acts = [el('button', { class: 'btn', html: U.icon('flip', 18) + 'Inverti lato', onclick: () => mut(pl => { pl.openings[sel.id].flipSide = !pl.openings[sel.id].flipSide; }) })];
      if (op.kind === 'battente') acts.push(el('button', { class: 'btn', html: U.icon('hinge', 18) + 'Cerniera', onclick: () => mut(pl => { pl.openings[sel.id].flipHinge = !pl.openings[sel.id].flipHinge; }) }));
      acts.push(el('button', { class: 'btn danger', html: U.icon('trash', 18) + 'Elimina', onclick: () => editor.deleteSelection() }));
      sheet.appendChild(el('div', { class: 'actions' }, acts));
    } else if (sel.type === 'column' && plan.columns[sel.id]) {
      const c = plan.columns[sel.id];
      sheet.appendChild(sheetHead('Struttura', 'Pilastro'));
      const fields = el('div', { class: 'fields' });
      fields.appendChild(U.numField('Larghezza', c.w, 'cm', v => mut(pl => { pl.columns[sel.id].w = v; }), { min: 0.1, max: 3 }));
      fields.appendChild(U.numField('Profondità', c.d, 'cm', v => mut(pl => { pl.columns[sel.id].d = v; }), { min: 0.1, max: 3 }));
      sheet.appendChild(fields);
      sheet.appendChild(el('div', { class: 'actions' }, [el('button', { class: 'btn danger', html: U.icon('trash', 18) + 'Elimina pilastro', onclick: () => editor.deleteSelection() })]));
    } else if (sel.type === 'beam' && plan.beams[sel.id]) {
      const b = plan.beams[sel.id];
      sheet.appendChild(sheetHead('Struttura', 'Trave'));
      const fields = el('div', { class: 'fields' });
      fields.appendChild(U.numField('Larghezza', b.w, 'cm', v => mut(pl => { pl.beams[sel.id].w = v; }), { min: 0.05, max: 2 }));
      sheet.appendChild(fields);
      sheet.appendChild(el('div', { class: 'stats' }, [U.stat('Lunghezza', CM.fmt.m(Math.hypot(b.x2 - b.x1, b.y2 - b.y1)))]));
      sheet.appendChild(el('div', { class: 'actions' }, [el('button', { class: 'btn danger', html: U.icon('trash', 18) + 'Elimina trave', onclick: () => editor.deleteSelection() })]));
    } else if (sel.type === 'furniture' && plan.furniture[sel.id]) {
      CM.sheets.furniture(sheet, ctx, sel.id);
    } else if (sel.type === 'fixture' && plan.fixtures[sel.id]) {
      CM.sheets.fixture(sheet, ctx, sel.id);
    } else {
      sheet.classList.add('hidden');
      $('stage').classList.remove('with-sheet');
      $('hint').classList.remove('hidden');
      return;
    }
    const key = sheetMode === 'underlay' ? 'underlay' : sel.type + ':' + sel.id;
    requestAnimationFrame(() => {
      editor.resize();
      if (key === lastRevealed) { sheet.scrollTop = scroll; return; }
      lastRevealed = key;
      if (sheetMode === 'underlay') return;
      const st = $('stage').getBoundingClientRect(), sh = sheet.getBoundingClientRect();
      const side = sh.left > st.left + 10;
      editor.reveal(sel, side ? { x: 0, y: 0, w: sh.left - st.left - 72, h: st.height } : { x: 0, y: 0, w: st.width - 72, h: sh.top - st.top });
    });
  }

  /* ---------- Planimetria ---------- */
  function pickFile(accept, capture) {
    return new Promise(resolve => {
      const input = el('input', { type: 'file', accept });
      if (capture) input.setAttribute('capture', capture);
      input.addEventListener('change', () => resolve(input.files[0] || null));
      input.click();
    });
  }

  async function loadUnderlay() {
    const how = await U.menu('Carica la planimetria', [
      { id: 'foto', label: 'Scatta una foto', icon: 'camera' },
      { id: 'file', label: 'Scegli immagine o PDF', icon: 'image' }
    ]);
    if (!how) return;
    const file = await pickFile(how === 'foto' ? 'image/*' : 'image/*,application/pdf', how === 'foto' ? 'environment' : null);
    if (!file) return;
    U.toast('Preparo la planimetria…');
    try {
      let img = await CM.underlay.fromFile(file);
      // foto del foglio: propongo di raddrizzarla (i PDF sono gi\u00e0 dritti)
      if (!/pdf/i.test(file.type || '') && !/\.pdf$/i.test(file.name || '')) img = await straightenDialog(img);
      editor.mutate(pl => { pl.underlay = CM.underlay.create(img, pl); }, 'underlay');
      editor.fit();
      sheetMode = null;
      buildTools(); renderSheet();
      const r = await U.dialog({ title: 'Inquadra solo la casa', text: 'Trascina un rettangolo intorno alla pianta della casa, lasciando fuori cornici, intestazioni, scritte e cartigli: cos\u00ec riconosco i muri giusti. Se la planimetria ha una barra di scala sul margine (es. \u201c10 metri\u201d nelle schede catastali) e non conosci la misura di nessun muro, usa prima la barra.', actions: [{ label: 'Salta', value: 'skip' }, { label: 'Prima la barra di scala', value: 'bar' }, { label: 'Ritaglia', value: 'crop', primary: true }] });
      if (r === 'crop') { editor.setTool('cropUnderlay'); buildTools(); }
      else if (r === 'bar') { editor.setTool('calibrate'); buildTools(); U.toast('Trascina il dito lungo la barra di scala, da un estremo all\u2019altro'); }
      else autoCalibrate();
    } catch (e) {
      U.toast(String(e.message) === 'PDF' ? 'I PDF si aprono nell’app sul telefono' : 'Non riesco ad aprire questo file');
    }
  }

  // Raddrizza una foto storta: 4 angoli da trascinare sugli angoli del foglio
  async function straightenDialog(img) {
    let corners;
    try { corners = await CM.underlay.guessCorners(img.src); } catch (e) { return img; }
    const full = corners.every((c, i) => (i === 0 && c.x === 0 && c.y === 0) || (i === 1 && c.y === 0 && c.x === img.pxW) || (i === 2 && c.x === img.pxW && c.y === img.pxH) || (i === 3 && c.x === 0 && c.y === img.pxH));
    const wrap = el('div', { class: 'warp-box' });
    const im = el('img', { src: img.src, alt: 'Planimetria', draggable: 'false' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    svg.appendChild(poly); wrap.append(im, svg);
    const hs = corners.map((c, i) => { const h = el('div', { class: 'warp-h', 'aria-label': 'Angolo ' + (i + 1) }); wrap.appendChild(h); return h; });
    const place = () => {
      const r = wrap.getBoundingClientRect(); const k = r.width / img.pxW;
      svg.setAttribute('viewBox', '0 0 ' + r.width + ' ' + r.height);
      poly.setAttribute('points', corners.map(c => (c.x * k) + ',' + (c.y * k)).join(' '));
      hs.forEach((h, i) => { h.style.left = (corners[i].x * k) + 'px'; h.style.top = (corners[i].y * k) + 'px'; });
    };
    hs.forEach((h, i) => {
      h.addEventListener('pointerdown', e => { h.setPointerCapture(e.pointerId); e.preventDefault(); });
      h.addEventListener('pointermove', e => {
        if (!h.hasPointerCapture(e.pointerId)) return;
        const r = wrap.getBoundingClientRect(); const k = r.width / img.pxW;
        corners[i] = { x: Math.max(0, Math.min(img.pxW, (e.clientX - r.left) / k)), y: Math.max(0, Math.min(img.pxH, (e.clientY - r.top) / k)) };
        place();
      });
    });
    im.addEventListener('load', place);
    setTimeout(place, 60);
    const r = await U.dialog({ title: 'Raddrizza la foto', text: full ? 'Se hai fotografato il foglio di traverso, trascina i 4 pallini sugli angoli del foglio: lo raddrizzo. Se \u00e8 gi\u00e0 dritta, tocca \u201c\u00c8 dritta\u201d.' : 'Ho trovato i bordi del foglio: correggi i 4 pallini se serve e tocca \u201cRaddrizza\u201d.', body: wrap, actions: [{ label: '\u00c8 dritta', value: false }, { label: 'Raddrizza', value: true, primary: true }] });
    if (!r) return img;
    U.toast('Raddrizzo la foto\u2026');
    try { return await CM.underlay.warp(img.src, corners); } catch (e) { console.error(e); return img; }
  }

  /* Calibrazione automatica: riconosco i muri, evidenzio il più lungo e chiedo solo la sua misura */
  async function autoCalibrate() {
    const u = editor.plan.underlay;
    if (!u) return;
    U.toast('Riconosco i muri della planimetria\u2026');
    let segs = [];
    try { segs = await CM.underlay.detectWalls(u); } catch (e) { console.error(e); }
    segs = segs.map(sg => Object.assign(sg, { len: CM.geom.dist(sg.a, sg.b) })).filter(sg => sg.len > 0.4).sort((p, q) => q.len - p.len).slice(0, 30);
    if (!segs.length) {
      const go = await U.dialog({ title: 'Non trovo muri dritti', text: 'L\u2019immagine non \u00e8 abbastanza nitida per riconoscerli. Puoi indicare tu un muro trascinando il dito lungo di esso.', actions: [{ label: 'Pi\u00f9 tardi', value: false }, { label: 'Indico io il muro', value: true, primary: true }] });
      if (go) { sheetMode = null; editor.setTool('calibrate'); buildTools(); renderSheet(); }
      else { sheetMode = 'underlay'; buildTools(); renderSheet(); }
      return;
    }
    sheetMode = null;
    editor.select({});
    editor.setCalibCandidates(segs);
    buildTools(); renderSheet();
    askCalibration();
  }

  async function askCalibration() {
    if (!editor.calibSeg()) return;
    const st = $('stage').getBoundingClientRect();
    // inquadro tutta la planimetria nello spazio libero sopra il dialogo
    let freeH = st.height * 0.42;
    const reveal = () => {
      const u = editor.plan.underlay;
      const sg = u ? { a: { x: u.x, y: u.y }, b: { x: u.x + u.wM, y: u.y + u.hM } } : editor.calibSeg();
      if (sg) editor.revealSegment(sg, { x: 0, y: 0, w: st.width - 72, h: freeH });
    };
    reveal();
    setTimeout(() => { const d = document.querySelector('.dialog.clear'); if (d) { freeH = Math.max(160, d.getBoundingClientRect().top - st.top - 8); reveal(); } }, 60);
    const input = el('input', { type: 'text', inputmode: 'decimal', class: 'num', 'aria-label': 'Misura reale del muro', placeholder: 'es. 4,20', enterkeyhint: 'done' });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') U.closeOverlay(input.value); });
    const what = el('div', { class: 'what' });
    const upd = () => { what.innerHTML = '<b>Muro ' + (editor.calib.idx + 1) + ' di ' + editor.calib.segs.length + '</b>quello blu con il ?'; };
    const step = (d) => { editor.stepCalib(d); upd(); };
    const nav = el('div', { class: 'calib-nav' }, [
      el('button', { 'aria-label': 'Muro precedente', text: '\u25C0', onclick: () => step(-1) }),
      what,
      el('button', { 'aria-label': 'Muro successivo', text: '\u25B6', onclick: () => step(1) })
    ]);
    upd();
    const body = el('div', {}, [nav, el('div', { class: 'field full', style: 'margin-top:6px' }, [el('label', { text: 'Misura reale del muro blu' }), el('div', { class: 'input-unit' }, [input, el('span', { text: 'm' })])])]);
    const r = await U.dialog({
      title: 'Scegli un muro di cui sai la misura',
      text: 'Con le frecce passi da un muro all\u2019altro: quando \u00e8 evidenziato quello giusto, scrivi la sua lunghezza vera.',
      body, clear: true,
      actions: (CM.ai.enabled() ? [{ label: 'Leggi le quote (AI)', value: 'quote' }] : []).concat([{ label: 'Uso la barra di scala', value: 'manual' }, { label: 'Conferma', value: () => input.value, primary: true }])
    });
    if (r === 'quote') {
      U.toast('Gemini legge le misure scritte sul disegno\u2026');
      try {
        const u = editor.plan.underlay;
        const q = await CM.underlay.readDimensions(u);
        if (!q) { U.toast('Non trovo quote leggibili: scrivi la misura di un muro'); return askCalibration(); }
        const sg0 = editor.calibSeg();
        const lenPx = CM.geom.dist(sg0.a, sg0.b) / (u.wM / u.pxW);
        editor.applyCalibration(sg0.a, CM.geom.dist(sg0.a, sg0.b), lenPx * q.mPerPx);
        buildTools();
        U.toast('Scala presa da ' + q.count + ' quote su ' + q.total);
        const segs = await CM.underlay.detectWalls(editor.plan.underlay).catch(() => []);
        if (segs.length) await raiseWalls(segs, true);
      } catch (e) { U.toast(CM.ai.errorText(e)); }
      return;
    }
    const sg = editor.calibSeg();
    if (r === 'other') { U.toast('Tocca il muro di cui conosci la misura'); return; }
    if (r === 'manual') { editor.calib = null; editor.setTool('calibrate'); buildTools(); U.toast('Trascina lungo la barra di scala (es. \u201c10 metri\u201d) o un tratto di cui sai la misura'); return; }
    if (r == null) { editor.calib = null; editor.setTool('select'); sheetMode = 'underlay'; buildTools(); renderSheet(); return; }
    const real = CM.fmt.parseM(r, 'm');
    if (!(real > 0.1)) { U.toast('Misura non valida'); return askCalibration(); }
    const len = CM.geom.dist(sg.a, sg.b);
    editor.applyCalibration(sg.a, len, real);
    buildTools();
    const segs = await CM.underlay.detectWalls(editor.plan.underlay).catch(() => []);
    if (segs.length) { await raiseWalls(segs, true); return; }
    U.toast('Planimetria in scala');
    sheetMode = 'underlay'; renderSheet();
  }

  // Dalla planimetria in scala: alzo i muri, creo le stanze e spiego come modificarli
  async function raiseWalls(segs, scaled) {
    const ok = await U.confirmDialog(scaled ? 'Planimetria in scala' : 'Muri trovati', 'Ho trovato ' + segs.length + ' tratti di muro. Li alzo come muri esistenti (alti ' + CM.fmt.m(project.settings.wallH || 2.7) + ') e creo le stanze negli spazi chiusi? Puoi annullare in ogni momento.', 'Alza i muri');
    if (!ok) { sheetMode = 'underlay'; renderSheet(); return; }
    let n = 0, r = 0, doors = 0;
    editor.mutate(pl => {
      n = CM.underlay.applyWalls(pl, segs, 'esistente');
      const h = project.settings.wallH || 2.7;
      for (const id in pl.walls) if (pl.walls[id].h == null || pl.walls[id].h === 2.7) pl.walls[id].h = h;
      try { CM.autoTidy(pl); } catch (e) { console.error(e); }
      try { doors = CM.plan.fillDoorGaps(pl); } catch (e) { console.error(e); }
      try { CM.autoTidy(pl); } catch (e) { console.error(e); }
      try { r = CM.plan.autoRooms(pl); } catch (e) { console.error(e); }
      try { CM.autoTidy(pl); } catch (e) { console.error(e); }
    }, 'detect');
    sheetMode = null; editor.select({}); buildTools(); renderSheet(); updateSummary();
    editor.fit();
    const go = await U.dialog({
      title: n + ' muri, ' + r + ' stanze' + (doors ? ', ' + doors + ' porte' : ''),
      text: 'Ora la casa \u00e8 in pianta e nel 3D. Per lavorarci: tocca un muro per cambiarne lunghezza e spessore o per segnarlo \u201cda demolire\u201d (giallo) o \u201cnuovo\u201d (rosso); con Muro disegni le pareti nuove; tocca una stanza per darle nome e tipo. Se un muro \u00e8 sbagliato lo selezioni ed Elimina, o usi Cancella zona.',
      actions: [{ label: 'Resta in pianta', value: false }, { label: 'Guarda in 3D', value: true, primary: true }]
    });
    if (go) setTab('3d');
  }

  async function onCrop(rect) {
    const u = editor.plan.underlay;
    if (!u) return;
    try {
      const nu = await CM.underlay.crop(u, rect);
      editor.mutate(pl => { pl.underlay = nu; }, 'crop');
      editor.setTool('select');
      editor.fit();
      buildTools();
      if (!nu.calibrated) autoCalibrate();
      else { sheetMode = 'underlay'; renderSheet(); detectWalls(false); }
    } catch (e) { U.toast('Ritaglio troppo piccolo: riprova'); }
  }

  // Cancella una parte della casa (e, se vuoi, anche dalla planimetria sotto)
  async function onErase(rect) {
    if (rect.x1 - rect.x0 < 0.1 || rect.y1 - rect.y0 < 0.1) return;
    const u = editor.plan.underlay;
    const actions = [{ label: 'Annulla', value: null }];
    if (u) actions.push({ label: 'Anche dalla planimetria', value: 'both' });
    actions.push({ label: 'Elimina', value: 'plan', primary: true });
    const r = await U.dialog({ title: 'Eliminare questa zona?', text: 'Tolgo muri, stanze, arredi e impianti dentro il rettangolo.' + (u ? ' Con “Anche dalla planimetria” la zona viene sbiancata anche sul disegno caricato, così non viene più riconosciuta.' : '') + ' Puoi sempre annullare.', actions });
    if (!r) { editor.draw(); return; }
    let nu = null;
    if (r === 'both' && u) { try { nu = await CM.underlay.mask(u, rect); } catch (e) { U.toast('Non riesco a modificare la planimetria'); } }
    let n = 0;
    editor.mutate(pl => { n = CM.plan.eraseArea(pl, rect); if (nu) pl.underlay = nu; }, 'erase');
    editor.select({});
    U.toast(n ? n + ' elementi eliminati · puoi annullare' : (nu ? 'Zona tolta dalla planimetria' : 'Nessun elemento in quella zona'));
  }

  async function onCalibrate(a, b, len) {
    const v = await U.promptDialog('Quanto misura questo muro?', '', { label: 'Misura reale', unit: 'm', inputmode: 'decimal', mono: true, text: 'Sulla planimetria hai tracciato ' + CM.fmt.m(len) + ' (scala provvisoria).' });
    if (v == null) { editor.setTool('select'); buildTools(); return; }
    const real = CM.fmt.parseM(v, 'm');
    if (!(real > 0.1)) { U.toast('Misura non valida'); return; }
    editor.applyCalibration(a, len, real);
    buildTools();
    U.toast('Planimetria in scala');
    const u = editor.plan.underlay;
    if (u && !u.cropped) {
      const c = await U.dialog({ title: 'Ora inquadra la casa', text: 'La scala \u00e8 fatta. Trascina un rettangolo intorno alla pianta della casa (fuori cornici e scritte): poi riconosco i muri gi\u00e0 in scala.', actions: [{ label: 'Salta', value: false }, { label: 'Ritaglia', value: true, primary: true }] });
      if (c) { editor.setTool('cropUnderlay'); buildTools(); return; }
    }
    sheetMode = 'underlay'; renderSheet();
  }

  async function detectWalls(ai) {
    const u = editor.plan.underlay;
    if (!u) return;
    if (!u.calibrated && !ai) {
      const go = await U.confirmDialog('La planimetria non è in scala', 'Conviene calibrarla prima, altrimenti le misure dei muri saranno sbagliate. Procedo lo stesso?', 'Procedi');
      if (!go) return;
    }
    if (ai) {
      if (!CM.ai.enabled()) { await CM.share.aiSettings(); if (!CM.ai.enabled()) return; }
      U.toast('Gemini sta leggendo la planimetria…');
      try {
        const res = await CM.underlay.detectAI(u);
        let out;
        editor.mutate(pl => { out = CM.underlay.applyAI(pl, pl.underlay, res); }, 'detect-ai');
        U.dialog({ title: 'Planimetria riconosciuta', text: 'Ho aggiunto ' + out.walls + ' muri, ' + out.rooms + ' stanze e ' + out.openings + ' porte e finestre' + (out.scaled ? ', e stimato la scala dalle quote' : '') + '. Controlla e correggi sopra la planimetria: puoi annullare.' });
      } catch (e) { U.toast(CM.ai.errorText(e)); }
      return;
    }
    U.toast('Cerco i muri…');
    try {
      const segs = await CM.underlay.detectWalls(u);
      if (!segs.length) { U.toast('Non trovo muri dritti: prova con un’immagine più nitida o con Gemini'); return; }
      await raiseWalls(segs, !!u.calibrated);
    } catch (e) { console.error(e); U.toast('Riconoscimento non riuscito'); }
  }

  /* ---------- Schede ---------- */
  function setTab(id, silent) {
    tab = id;
    document.querySelectorAll('.tab').forEach(t => {
      const on = t.dataset.tab === id;
      t.classList.toggle('active', on);
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    $('editor').classList.toggle('tab-other', id !== 'pianta');
    $('tabview').classList.toggle('hidden', id === 'pianta' || id === '3d');
    $('view3dWrap').classList.toggle('hidden', id !== '3d');
    if (view3d) view3d.setVisible(id === '3d');
    if (id === 'pianta') { requestAnimationFrame(() => { editor.resize(); editor.draw(); }); }
    if (!silent) renderTab();
  }

  function renderTab() {
    if (!project) return;
    const box = $('tabview');
    const keep = box.scrollTop;
    try {
      if (tab === 'arredo') CM.tabs.renderArredo(box);
      else if (tab === 'costi') CM.tabs.renderCosti(box);
      else if (tab === 'lavori') CM.tabs.renderLavori(box);
      else if (tab === '3d') open3d();
    } catch (e) { console.error(e); U.toast('Errore nella scheda: ' + e.message); }
    box.scrollTop = keep;
  }

  /* ---------- 3D ---------- */
  function build3dUi() {
    const wrap = $('view3dWrap');
    const seg = (items, val, on) => el('div', { class: 'seg compact' }, items.map(([v, l]) => el('button', { class: v === val ? 'on' : '', text: l, onclick: () => on(v) })));
    const bar = $('v3dBar');
    const render = () => {
      bar.innerHTML = '';
      bar.append(
        seg([['orbit', 'Modellino'], ['walk', 'Passeggiata']], view3d.mode, v => { view3d.setMode(v); $('joystick').classList.toggle('hidden', v !== 'walk'); render(); }),
        seg([['prima', 'Prima'], ['dopo', 'Dopo']], view3d.phase, v => { view3d.phase = v; view3d.build(project); render(); }),
        el('button', { class: 'chip small' + (view3d.lowWalls ? ' active' : ''), text: 'Muri bassi', onclick: () => { view3d.lowWalls = !view3d.lowWalls; view3d.build(project); render(); } }),
        el('button', { class: 'chip small', html: U.icon('sun', 16) + '<span>Sole</span>', onclick: () => $('sunPanel').classList.toggle('hidden') }),
        el('button', { class: 'chip small accent', html: U.icon('spark', 16) + '<span>Stili</span>', onclick: () => CM.personal.styleGallery(persCtx()) }),
        el('button', { class: 'chip small', text: 'Ispirazione', onclick: () => CM.inspire && CM.inspire.open(persCtx()) }),
        seg([['leggero', 'Leggero'], ['realistico', 'Realistico']], view3d.quality, v => { view3d.setQuality(v); render(); U.toast(v === 'realistico' ? 'Qualit\u00e0 realistica: pi\u00f9 bella, consuma di pi\u00f9' : 'Qualit\u00e0 leggera: fluida e risparmia batteria'); }),
        el('button', { class: 'chip small', text: 'Foto', onclick: () => CM.share.file('vista-3d.jpg', 'image/jpeg', view3d.snapshot(), true) }),
        el('button', { class: 'chip small', text: 'Esporta 3D', onclick: () => {
          const low = view3d.lowWalls; if (low) { view3d.lowWalls = false; view3d.build(project); }
          try {
            const b = view3d.exportGLB();
            let bin = ''; for (let i = 0; i < b.length; i += 8192) bin += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
            CM.share.file(project.name.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-') + '-3D.glb', 'model/gltf-binary', 'data:model/gltf-binary;base64,' + btoa(bin), true);
            U.toast('File 3D pronto: si apre al PC con \u201cVisualizzatore 3D\u201d di Windows o Blender');
          } catch (e) { console.error(e); U.toast('Esportazione 3D non riuscita'); }
          if (low) { view3d.lowWalls = true; view3d.build(project); }
        } }),
        el('button', { class: 'chip small', text: 'Render AI', onclick: () => CM.share.render(project) }),
        el('button', { class: 'chip small', text: 'Inquadra', onclick: () => { view3d.resetCamera(); } })
      );
    };
    render();
    // sole
    const day = el('input', { type: 'range', min: '1', max: '365', value: String(view3d.day), 'aria-label': 'Giorno dell’anno' });
    const hour = el('input', { type: 'range', min: '5', max: '21', step: '0.25', value: String(view3d.hour), 'aria-label': 'Ora del giorno' });
    const lbl = el('div', { class: 'mono small' });
    const upd = () => {
      view3d.day = +day.value; view3d.hour = +hour.value; view3d.updateSun();
      const d = new Date(2026, 0, view3d.day);
      const h = Math.floor(view3d.hour), m = Math.round((view3d.hour - h) * 60);
      const s = view3d.sunInfo || { elevation: 0, azimuth: 0 };
      lbl.textContent = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }) + ' · ore ' + h + ':' + String(m).padStart(2, '0') + ' · ' + (s.elevation > 0 ? 'sole a ' + Math.round(s.elevation) + '°' : 'sole sotto l’orizzonte');
    };
    day.addEventListener('input', upd); hour.addEventListener('input', upd);
    $('sunPanel').append(el('div', { class: 'range-row' }, [el('span', { class: 'small', text: 'Giorno' }), day]), el('div', { class: 'range-row' }, [el('span', { class: 'small', text: 'Ora' }), hour]), lbl,
      el('button', { class: 'btn small', text: 'Posizione della casa', onclick: () => CM.share.locationDialog(project).then(upd) }));
    setTimeout(upd, 0);
    // joystick per la passeggiata
    const joy = $('joystick'), knob = joy.querySelector('i');
    let jid = null;
    const jmove = (e) => {
      const r = joy.getBoundingClientRect();
      let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
      const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
      knob.style.transform = 'translate(' + (x * 34) + 'px,' + (y * 34) + 'px)';
      view3d.setMove(x, -y);
    };
    joy.addEventListener('pointerdown', e => { jid = e.pointerId; joy.setPointerCapture(jid); jmove(e); });
    joy.addEventListener('pointermove', e => { if (e.pointerId === jid) jmove(e); });
    const jend = () => { jid = null; knob.style.transform = ''; view3d.setMove(0, 0); };
    joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
    void wrap;
  }

  // Contesto per la personalizzazione (3D, stili, ispirazione)
  function persCtx(room) {
    return {
      project, room: room || null,
      plan: () => editor.plan,
      mutate: (fn) => editor.mutate(fn, 'style'),
      after: () => { if (view3d && tab === '3d') view3d.build(project); updateSummary(); },
      openRoom: (rid) => { $('v3dPanel').classList.add('hidden'); focusSel({ type: 'room', id: rid }); }
    };
  }

  function open3d() {
    if (!view3d) {
      view3d = new CM.View3D($('view3d'), {
        onPick: (hit) => {
          $('v3dTip').classList.add('hidden');
          if (!hit) { $('v3dPanel').classList.add('hidden'); return; }
          view3d.flash(hit);
          CM.personal.panel3d($('v3dPanel'), hit, persCtx());
        }
      });
      if (!view3d.init()) { U.toast('La vista 3D non è disponibile su questo dispositivo'); view3d = null; return; }
      build3dUi();
      new ResizeObserver(() => view3d && view3d.resize()).observe($('view3d'));
    }
    view3d.setVisible(true);
    view3d._placed = view3d.project === project && view3d._placed;
    view3d.build(project);
    view3d.resize();
  }

  /* ---------- Menu del progetto ---------- */
  async function moreMenu() {
    const s = project.settings;
    const L = s.layers || (s.layers = { arredo: true, impianti: true, planimetria: true });
    const choice = await U.menu('Progetto', [
      { id: 'variants', label: 'Varianti', icon: 'copy', right: project.variants.length > 1 ? String(project.variants.length) : '' },
      { id: 'assistant', label: 'Assistente', icon: 'spark' },
      { id: 'share', label: 'Condividi con altre persone', icon: 'share' },
      CM.clipboard ? { id: 'paste', label: 'Incolla gli elementi copiati', icon: 'copy' } : null,
      { id: 'tavole', label: 'Tavole in scala (PDF per geometra e ditte)', icon: 'ruler' },
      { id: 'pdf', label: 'Esporta PDF riepilogo', icon: 'opening' },
      { id: 'img', label: 'Immagine della pianta', icon: 'image' },
      { id: 'file', label: 'Esporta il file del progetto', icon: 'opening' },
      { id: 'history', label: 'Storico versioni', icon: 'history' },
      { id: 'autorooms', label: 'Crea le stanze dai muri', icon: 'room' },
      { id: 'location', label: 'Posizione della casa (sole)', icon: 'sun', right: project.address ? project.address.replace('_', ' ') : '' },
      { id: 'l-arredo', label: 'Mostra arredo', icon: 'sofa', toggle: L.arredo !== false },
      { id: 'l-impianti', label: 'Mostra impianti', icon: 'plug', toggle: L.impianti !== false },
      { id: 'l-plan', label: 'Mostra planimetria', icon: 'image', toggle: L.planimetria !== false },
      { id: 'l-foto', label: 'Mostra foto e tracce', icon: 'camera', toggle: L.foto !== false },
      { id: 'dims', label: 'Quote dei muri', icon: 'ruler', toggle: !!s.showDims },
      { id: 'grid', label: 'Griglia', icon: 'grid', toggle: s.showGrid !== false },
      { id: 'thick', label: 'Spessore dei nuovi muri', icon: 'thick', right: Math.round(s.wallT * 100) + ' cm' },
      { id: 'height', label: 'Altezza dei soffitti', icon: 'height', right: Math.round(s.wallH * 100) + ' cm' },
      { id: 'rename', label: 'Rinomina progetto', icon: 'rename' },
      { id: 'help', label: 'Guida rapida', icon: 'help' },
      { id: 'delete', label: 'Elimina progetto', icon: 'trash', danger: true }
    ]);
    const redraw = () => { scheduleSave(); editor.draw(); };
    switch (choice) {
      case 'variants': return variantsMenu();
      case 'assistant': return CM.share.assistant(project);
      case 'autorooms': {
        let r = 0;
        editor.mutate(pl => { r = CM.plan.autoRooms(pl); }, 'rooms');
        updateSummary();
        return U.toast(r ? r + ' stanze create: toccale per dare nome e tipo' : 'Nessuno spazio chiuso nuovo: chiudi i muri o disegna la stanza');
      }
      case 'share': return CM.share.shareDialog(project);
      case 'tavole': return CM.tavole.dialog(project, editor.plan);
      case 'paste': {
        const c = CM.clipboard; if (!c) return;
        const bb = P.setBounds(c.plan, c.set), cur = P.bounds(Object.assign({}, editor.plan, { underlay: null }));
        const dx = cur && bb ? cur.maxX + 0.5 - bb.x0 : 0, dy = cur && bb ? cur.minY - bb.y0 : 0;
        let out; editor.mutate(pl => { out = P.copySet(c.plan, pl, c.set, dx, dy); }, 'paste');
        editor.setTool('multi'); editor.setMulti(out); buildTools(); renderSheet(); editor.fit();
        return U.toast('Incollato: trascina il riquadro blu dove vuoi');
      }
      case 'pdf': return CM.share.pdf(project);
      case 'img': return CM.share.file('pianta-' + project.name.replace(/\W+/g, '-') + '.png', 'image/png', CM.share.planImage(project), true);
      case 'file': return CM.share.exportProject(project);
      case 'history': return CM.share.history.dialog(project);
      case 'location': return CM.share.locationDialog(project);
      case 'l-arredo': L.arredo = L.arredo === false; return redraw();
      case 'l-impianti': L.impianti = L.impianti === false; return redraw();
      case 'l-plan': L.planimetria = L.planimetria === false; return redraw();
      case 'l-foto': L.foto = L.foto === false; return redraw();
      case 'dims': s.showDims = !s.showDims; return redraw();
      case 'grid': s.showGrid = s.showGrid === false; return redraw();
      case 'help': return U.tutorial();
      case 'rename': return renameProject();
      case 'thick': {
        const v = await U.promptDialog('Spessore dei nuovi muri', String(Math.round(s.wallT * 100)), { label: 'Spessore', unit: 'cm', inputmode: 'decimal', mono: true });
        const m = CM.fmt.parseM(v, 'cm');
        if (v != null) { if (m >= 0.03 && m <= 1.2) { s.wallT = m; scheduleSave(); } else U.toast('Valore non valido'); }
        return;
      }
      case 'height': {
        const v = await U.promptDialog('Altezza dei soffitti', String(Math.round(s.wallH * 100)), { label: 'Altezza', unit: 'cm', inputmode: 'decimal', mono: true });
        const m = CM.fmt.parseM(v, 'cm');
        if (v != null) { if (m >= 1.5 && m <= 8) { s.wallH = m; scheduleSave(); } else U.toast('Valore non valido'); }
        return;
      }
      case 'delete': {
        const ok = await U.confirmDialog('Eliminare il progetto?', '“' + project.name + '” verrà cancellato dal telefono. L’operazione non si può annullare.', 'Elimina', true);
        if (ok) { const id = project.id; clearTimeout(saveTimer); project = null; S.deleteProject(id); show('home'); renderHome(); U.toast('Progetto eliminato'); }
      }
    }
  }

  async function variantsMenu() {
    const items = project.variants.map(v => ({ id: 'v:' + v.id, label: v.name + (v.id === project.active ? '  ✓' : ''), icon: 'room' }));
    items.push({ id: 'new', label: 'Nuova variante da quella aperta', icon: 'copy' });
    items.push({ id: 'rename', label: 'Rinomina la variante aperta', icon: 'rename' });
    if (project.variants.length > 1) items.push({ id: 'compare', label: 'Confronta i costi', icon: 'euro' });
    if (project.variants.length > 1) items.push({ id: 'delete', label: 'Elimina la variante aperta', icon: 'trash', danger: true });
    const c = await U.menu('Varianti', items);
    if (!c) return;
    if (c.startsWith('v:')) return setVariant(c.slice(2));
    if (c === 'new') {
      const name = await U.promptDialog('Nuova variante', 'Variante ' + (project.variants.length + 1), { label: 'Nome', text: 'Es. “Cucina aperta”: parte come copia di quella aperta, poi la modifichi.' });
      if (name == null) return;
      CM.project.addVariant(project, name.trim() || undefined);
      reloadProject(); U.toast('Stai lavorando su “' + CM.project.variant(project).name + '”');
    }
    if (c === 'rename') {
      const v = CM.project.variant(project);
      const name = await U.promptDialog('Rinomina variante', v.name, { label: 'Nome' });
      if (name && name.trim()) { v.name = name.trim(); scheduleSave(); updateHeader(); }
    }
    if (c === 'compare') setTab('costi');
    if (c === 'delete') {
      const v = CM.project.variant(project);
      const ok = await U.confirmDialog('Eliminare “' + v.name + '”?', 'La variante verrà cancellata.', 'Elimina', true);
      if (!ok) return;
      project.variants = project.variants.filter(x => x.id !== v.id);
      project.active = project.variants[0].id;
      reloadProject();
    }
  }

  function setVariant(id) {
    if (!project.variants.some(v => v.id === id)) return;
    project.active = id;
    reloadProject();
    U.toast('Variante “' + CM.project.variant(project).name + '”');
  }

  async function renameProject() {
    const name = await U.promptDialog('Rinomina progetto', project.name, { label: 'Nome' });
    if (name && name.trim()) { project.name = name.trim(); project.updated = Date.now(); scheduleSave(); updateHeader(); }
  }

  function compassDialog() {
    let val = project.north || 0;
    const needle = el('div', { html: '<svg width="96" height="96" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="#FBFBF9" stroke="#E3E1DB"/><g class="nd"><path d="M20 5l5 15h-10z" fill="#D23B2A"/><path d="M20 35l-5-15h10z" fill="#C9C6BE"/></g></svg>', style: 'display:flex;justify-content:center;margin:10px 0' });
    const label = el('span', { class: 'val', text: val + '°' });
    const range = el('input', { type: 'range', min: '0', max: '359', value: String(val), 'aria-label': 'Direzione del nord in gradi' });
    const sync = () => { label.textContent = val + '°'; needle.querySelector('.nd').setAttribute('transform', 'rotate(' + val + ' 20 20)'); };
    range.addEventListener('input', () => { val = +range.value; sync(); });
    setTimeout(sync, 0);
    U.dialog({
      title: 'Dov’è il nord?', text: 'Ruota la freccia rossa verso il nord rispetto alla pianta: serve per la luce del sole nella vista 3D.',
      body: el('div', {}, [needle, el('div', { class: 'range-row' }, [range, label])]),
      actions: [{ label: 'Annulla', value: null }, { label: 'Salva', value: () => val, primary: true }]
    }).then(v => { if (v == null) return; project.north = v; project.updated = Date.now(); updateCompass(); scheduleSave(); });
  }

  /* ---------- Salvataggio ---------- */
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 500);
  }
  function saveNow() {
    clearTimeout(saveTimer);
    if (!project) return;
    project.updated = Date.now();
    if (!S.saveProject(project)) U.toast('Salvataggio non riuscito: memoria piena?');
    CM.share.driveBackup(false);
  }

  /* ---------- Aggiornamento dell'app ---------- */
  const RELEASES_API = 'https://api.github.com/repos/monastradario-cpu/NEWAPP/releases/latest';
  let updateInfo = null, checking = false;
  function currentVersion() { return S.isNative && window.CasaMiaAndroid.version ? window.CasaMiaAndroid.version() : 'web'; }
  function setUpdateUi(state) {
    const b = $('updateBtn');
    b.classList.toggle('busy', state === 'busy');
    b.classList.toggle('available', !!updateInfo);
    $('updateBadge').classList.toggle('hidden', !updateInfo);
    b.querySelector('span').textContent = updateInfo ? 'Aggiorna a ' + updateInfo.ver : 'Aggiorna';
  }
  async function checkUpdate(manual) {
    if (checking) return;
    checking = true;
    if (manual) setUpdateUi('busy');
    try {
      const r = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const rel = await r.json();
      const ver = String(rel.tag_name || '').replace(/^v/, '');
      const apk = (rel.assets || []).find(a => /\.apk$/i.test(a.name));
      updateInfo = apk && CM.versionNewer(ver, currentVersion()) ? { ver, url: apk.browser_download_url, page: rel.html_url, size: apk.size } : null;
      setUpdateUi();
      if (manual) { if (updateInfo) offerUpdate(); else U.toast('Hai già l’ultima versione (' + currentVersion() + ')'); }
    } catch (e) {
      setUpdateUi();
      if (manual) U.toast('Non riesco a controllare: sei connesso a internet?');
    } finally { checking = false; }
  }
  async function offerUpdate() {
    const u = updateInfo;
    if (!u) return;
    const mb = u.size ? ' (' + CM.fmt.num(u.size / 1048576, 1) + ' MB)' : '';
    const ok = await U.dialog({ title: 'È disponibile la versione ' + u.ver, text: 'Stai usando la ' + currentVersion() + '. Scarico l’aggiornamento' + mb + ' e poi Android ti chiede di confermare l’installazione. I tuoi progetti restano salvati.', actions: [{ label: 'Più tardi', value: false }, { label: 'Aggiorna ora', value: true, primary: true }] });
    if (!ok) return;
    saveNow();
    if (S.isNative && window.CasaMiaAndroid.update) { window.CasaMiaAndroid.update(u.url, u.ver); setUpdateUi('busy'); }
    else window.open(u.page, '_blank');
  }
  CM.onUpdateStatus = function (status) {
    if (status === 'download') U.toast('Download dell’aggiornamento in corso…');
    if (status === 'scaricato') { setUpdateUi(); U.toast('Download completato: conferma l’installazione'); }
    if (status === 'errore') { setUpdateUi(); U.toast('Aggiornamento non riuscito, riprova tra poco'); }
    if (status === 'permesso') {
      setUpdateUi();
      U.dialog({ title: 'Un ultimo permesso', text: 'Android chiede di consentire a Casa Mia di installare aggiornamenti. Attiva “Consenti da questa fonte” e torna indietro: l’installazione riparte da sola. Serve solo la prima volta.', actions: [{ label: 'Ho capito', value: true, primary: true }] });
    }
  };

  /* ---------- Indietro ---------- */
  CM.onBack = function () {
    if (U.overlayOpen()) { U.closeOverlay(); return true; }
    if (!$('editor').classList.contains('hidden')) {
      if (tab !== 'pianta') { setTab('pianta'); return true; }
      if (editor.chain) { editor.finishChain(); return true; }
      if (sheetMode) { sheetMode = null; buildTools(); renderSheet(); return true; }
      if (editor.sel.type) { editor.select({}); return true; }
      if (editor.tool !== 'select') { editor.setTool('select'); buildTools(); return true; }
      goHome();
      return true;
    }
    return false;
  };
  CM.flush = saveNow;

  /* ---------- Interfaccia per gli altri moduli ---------- */
  CM.app = {
    project: () => project,
    editor: () => editor,
    save: () => { scheduleSave(); if (tab === 'pianta') { updateSummary(); } },
    tab: () => tab,
    setTab,
    refreshTab: renderTab,
    reload: reloadProject,
    setVariant,
    focus: focusSel,
    straighten: (img) => straightenDialog(img),
    placeItem: (it) => { setTab('pianta'); sheetMode = null; editor.setPendingItem(it); buildTools(); renderSheet(); },
    snapshot3d: (needOpen) => {
      if (view3d && view3d.ready && view3d.project === project) return view3d.snapshot();
      if (needOpen) return null;
      return null;
    }
  };
  CM._debug = { editor: () => editor, project: () => project, v3d: () => view3d };

  /* ================= AVVIO ================= */
  function init() {
    editor = new CM.Editor($('planCanvas'), {
      onChange: () => { scheduleSave(); updateSummary(); updateHeader(); renderSheet(); },
      onSelect: () => { if (editor.sel.type) sheetMode = null; renderSheet(); },
      onHint: (text, actions) => {
        $('hintText').textContent = text;
        const box = $('hintActions');
        box.innerHTML = '';
        if (actions.includes('undoPoint')) box.appendChild(el('button', { text: 'Annulla punto', onclick: () => editor.undoPoint() }));
        if (actions.includes('finish')) box.appendChild(el('button', { class: 'primary', text: 'Fine', onclick: () => editor.finishChain() }));
        if (editor.tool === 'fixture') box.appendChild(el('button', { class: 'primary', text: 'Fine', onclick: () => { editor.setTool('select'); buildTools(); } }));
        if (editor.tool === 'room') box.appendChild(el('button', { class: 'primary', text: 'Con le misure', onclick: () => roomByMeasures() }));
        if (editor.tool === 'erase') box.appendChild(el('button', { class: 'primary', text: 'Fine', onclick: () => { editor.setTool('select'); buildTools(); } }));
        if (editor.tool === 'cropUnderlay') box.appendChild(el('button', { text: 'Salta', onclick: () => { editor.setTool('select'); buildTools(); autoCalibrate(); } }));
        if (editor.tool === 'calibPick') {
          box.appendChild(el('button', { class: 'arrow', 'aria-label': 'Muro precedente', text: '\u25C0', onclick: () => editor.stepCalib(-1) }));
          box.appendChild(el('button', { class: 'arrow', 'aria-label': 'Muro successivo', text: '\u25B6', onclick: () => editor.stepCalib(1) }));
          box.appendChild(el('button', { class: 'primary', text: 'Misura', onclick: () => askCalibration() }));
        }
        if (editor.tool === 'calibrate' || editor.tool === 'moveUnderlay') box.appendChild(el('button', { class: 'primary', text: 'Fine', onclick: () => { editor.setTool('select'); sheetMode = 'underlay'; buildTools(); renderSheet(); } }));
      },
      onHistory: (u, r) => { $('undoBtn').disabled = !u; $('redoBtn').disabled = !r; },
      onToast: (t) => U.toast(t),
      onDraw: (view) => updateScale(view),
      onCalibrate,
      onCalibPick: () => askCalibration(),
      onCrop,
      onErase,
      onMeasure: (d, final) => { $('hintText').textContent = 'Distanza: ' + CM.fmt.m(d) + (final ? ' \u00b7 trascina di nuovo per un\u2019altra misura' : ''); },
      onMulti: () => renderSheet(),
      onPin: (ids) => CM.tabs.showDiary(ids)
    });

    $('newProject').addEventListener('click', () => newProject(false));
    $('openSample').addEventListener('click', openSample);
    $('loadPlan').addEventListener('click', () => newProject(true));
    $('homeMenu').addEventListener('click', async () => {
      const c = await U.menu('Casa Mia', [
        { id: 'open', label: 'Apri un file di progetto o backup', icon: 'opening' },
        { id: 'drive', label: 'Backup automatico su Google Drive', icon: 'share', right: CM.share.driveLinked() ? 'attivo' : '' },
        { id: 'backup', label: 'Salva una copia adesso', icon: 'share' },
        { id: 'autobackup', label: 'Backup automatico settimanale', icon: 'history', toggle: S.pref('backupAuto') !== false },
        { id: 'ai', label: 'Assistente Gemini', icon: 'spark', right: CM.ai.enabled() ? 'attivo' : '' },
        { id: 'prices', label: 'Prezzi di riferimento', icon: 'euro' },
        { id: 'shop', label: 'Ricontrolla i prezzi dei negozi', icon: 'history' },
        { id: 'help', label: 'Guida rapida', icon: 'help' },
        { id: 'sample', label: 'Ricrea il progetto d’esempio', icon: 'copy' }
      ]);
      if (c === 'open') { openProjectFile(); }
      if (c === 'backup') CM.share.backupAll();
      if (c === 'drive') {
        if (CM.share.driveLinked()) {
          const r = await U.dialog({ title: 'Backup su Drive attivo', text: 'Ogni modifica aggiorna il file di backup su Drive.', actions: [{ label: 'Scollega', value: 'off' }, { label: 'Aggiorna ora', value: 'now' }, { label: 'OK', value: null, primary: true }] });
          if (r === 'off') { window.CasaMiaAndroid.unlinkBackup(); U.toast('Backup su Drive scollegato'); }
          if (r === 'now') { CM.share.driveBackup(true); U.toast('Backup aggiornato'); }
        } else CM.share.linkDrive();
      }
      if (c === 'autobackup') {
        const on = S.pref('backupAuto') === false;
        S.pref('backupAuto', on);
        if (on) { const ok = CM.share.autoBackup(true); U.dialog({ title: 'Backup automatico attivo', text: 'Ogni settimana salvo una copia di tutti i progetti in Download/CasaMia sul telefono' + (ok ? ' (fatto ora).' : '.') + ' Per averla anche su Google Drive puoi sincronizzare quella cartella o usare \u201cBackup su Drive\u201d.' }); }
        else U.toast('Backup automatico disattivato');
      }
      if (c === 'ai') CM.share.aiSettings();
      if (c === 'prices') CM.tabs.pricesDialog();
      if (c === 'shop') CM.shop.refreshPrices();
      if (c === 'help') U.tutorial();
      if (c === 'sample') { const p = CM.sample.create(); S.saveProject(p); renderHome(); U.toast('Esempio aggiunto'); }
    });
    $('updateBtn').addEventListener('click', () => (updateInfo ? offerUpdate() : checkUpdate(true)));
    $('backHome').addEventListener('click', goHome);
    $('projectTitle').addEventListener('click', () => (project.variants.length > 1 ? variantsMenu() : renameProject()));
    $('undoBtn').addEventListener('click', () => editor.undo());
    $('redoBtn').addEventListener('click', () => editor.redo());
    $('moreBtn').addEventListener('click', moreMenu);
    $('openFile').addEventListener('click', openProjectFile);
    $('modeBtn').addEventListener('click', toggleMode);
    $('probBtn').addEventListener('click', warningsDialog);
    applyMode();
    $('compass').addEventListener('click', compassDialog);
    $('zoomIn').addEventListener('click', () => editor.zoomBy(1.4));
    $('zoomOut').addEventListener('click', () => editor.zoomBy(1 / 1.4));
    $('zoomFit').addEventListener('click', () => editor.fit());
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => setTab(t.dataset.tab)));

    new ResizeObserver(() => editor.resize()).observe($('stage'));
    window.addEventListener('resize', () => { editor.resize(); if (project && tab === 'pianta') renderSheet(); });

    document.addEventListener('keydown', (e) => {
      if ($('editor').classList.contains('hidden') || U.overlayOpen() || tab !== 'pianta') return;
      if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? editor.redo() : editor.undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); editor.redo(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') editor.deleteSelection();
      else if (e.key === 'Escape') CM.onBack();
    });
    // Tastiera del telefono: quando si apre la finestra si accorcia
    let maxH = window.innerHeight;
    const kbCheck = () => {
      const h = window.innerHeight;
      if (h > maxH) maxH = h;
      const kb = maxH - h > 140 && document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      document.body.classList.toggle('kb', !!kb);
      if (kb) setTimeout(() => { const a = document.activeElement; if (a && a.scrollIntoView) a.scrollIntoView({ block: 'center' }); }, 60);
    };
    window.addEventListener('resize', kbCheck);
    document.addEventListener('focusout', () => setTimeout(kbCheck, 120));
    document.addEventListener('focusin', () => setTimeout(kbCheck, 350));
    window.addEventListener('orientationchange', () => { maxH = 0; setTimeout(() => { maxH = window.innerHeight; kbCheck(); }, 400); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { saveNow(); CM.share.driveBackup(true); } else if (view3d && tab === '3d') view3d.dirty = true; });

    const errs = CM.selfTest();
    if (errs.length) console.error('CASAMIA_SELFTEST_FAIL ' + errs.join('; '));
    else console.log('CASAMIA_SELFTEST_OK');

    const first = !S.pref('avviato');
    if (first) { S.saveProject(CM.sample.create()); S.pref('avviato', Date.now()); }
    renderHome();
    show('home');
    if (first) setTimeout(() => U.tutorial(), 300);
    console.log('CASAMIA_READY ' + (S.isNative ? 'android' : 'browser'));
    if (S.isNative && window.CasaMiaAndroid.takeShared) { try { const sh = window.CasaMiaAndroid.takeShared(); if (sh) setTimeout(() => CM.onShared(sh), 400); } catch (e) { console.error(e); } }
    if (S.isNative) {
      setTimeout(() => checkUpdate(false), 2500);
      setTimeout(() => CM.shop.syncWatch(), 4000);
      setTimeout(() => { try { if (CM.share.autoBackup(false)) U.toast('Backup automatico salvato in Download/CasaMia'); } catch (e) { console.error(e); } }, 6000);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
