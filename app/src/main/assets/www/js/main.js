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
  let lastRevealed = '', lastRevealed3d = '';

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
    if (window.innerWidth >= 1000) bar.appendChild(el('button', { class: 'chip' + (S.pref('split') ? ' active' : ''), title: 'Pianta e 3D affiancati (T)', html: U.icon('cube', 18) + '<span>Pianta + 3D</span>', onclick: toggleSplit }));
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
    if (editor.sel.type !== 'wall') editor.scopeWalls = null;
    const in3d = is3dEdit();
    const sheet = in3d ? $('v3dPanel') : $('sheet');
    if (in3d) { $('sheet').classList.add('hidden'); $('stage').classList.remove('with-sheet'); }
    if (sheet.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName) && document.activeElement.type !== 'range') return;
    const sel = editor.sel;
    const plan = editor.plan;
    const scroll = sheet.scrollTop;
    sheet.innerHTML = '';
    const multi = editor.tool === 'multi' && editor.multi;
    const has = sheetMode === 'underlay' || (sel.type && sel.type !== 'node') || !!multi;
    sheet.classList.toggle('hidden', !has);
    if (!in3d) {
      $('stage').classList.toggle('with-sheet', !!has);
      $('hint').classList.toggle('hidden', !!has);
    }
    if (!has) { lastRevealed = ''; if (in3d) view3d.setSelected(null); return; }
    const ctx = sheetCtx();
    const mut = ctx.mut;
    sheet.appendChild(U.grab());

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
      sheet.appendChild(el('p', { class: 'muted small', style: 'margin:0 0 4px', text: 'Per spostarla trascinala: si muove solo lei, con i suoi mobili; le stanze vicine restano dove sono.' }));
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
        el('button', { class: 'btn primary', html: U.icon('spark', 18) + 'Arreda con l’AI', onclick: () => CM.roomAI.furnish(sel.id) }),
        el('button', { class: 'btn', text: 'Inserisci un progetto (IKEA, PDF, foto)', onclick: () => CM.roomAI.importPlan(sel.id) }),
        el('button', { class: 'btn', text: 'Foto / diario', onclick: () => CM.tabs.addDiary({ room: sel.id }) }),
        el('button', { class: 'btn danger', html: U.icon('trash', 18) + 'Elimina stanza', onclick: () => { editor.deleteSelection(); U.toast('Stanza eliminata · puoi annullare'); } })
      ]));
    } else if (sel.type === 'wall' && plan.walls[sel.id]) {
      const w = plan.walls[sel.id];
      const L = P.wallLen(plan, w);
      sheet.appendChild(sheetHead('Muro', CM.fmt.m(L)));
      const line = P.wallLine(plan, sel.id);
      // quale muro: solo il tratto, il muro di una delle stanze (anche se in comune), tutta la parete
      const owners = P.wallOwners(plan, sel.id);
      const scopes = [{ value: 'one', label: 'Solo questo tratto' }];
      owners.forEach(rid => { const run = P.roomRun(plan, sel.id, rid); if (owners.length > 1 || run.length > 1) scopes.push({ value: 'room:' + rid, label: 'Muro di ' + plan.rooms[rid].name + ' (' + CM.fmt.m(run.reduce((a, id) => a + P.wallLen(plan, id), 0)) + ')' }); });
      if (line.length > 1) scopes.push({ value: 'all', label: 'Tutta la parete (' + line.length + ' tratti)' });
      const scope = scopes.some(x => x.value === editor.wallScope) ? editor.wallScope : 'one';
      const whole = scope === 'all';
      const targets = whole ? line : scope.startsWith('room:') ? P.roomRun(plan, sel.id, scope.slice(5)) : [sel.id];
      editor.scopeWalls = targets.length > 1 || scope !== 'one' ? targets : null;
      const A = plan.nodes[w.a], B = plan.nodes[w.b];
      const horiz = Math.abs(B.x - A.x) >= Math.abs(B.y - A.y);
      const sideLabel = (end) => { const p = end === 'a' ? A : B, q = end === 'a' ? B : A; return horiz ? (p.x < q.x ? 'Sinistra' : 'Destra') : (p.y < q.y ? 'Sopra' : 'Sotto'); };
      const side = editor.stretchSide || 'b';
      const fields = el('div', { class: 'fields' });
      if (owners.length > 1) sheet.appendChild(el('div', { class: 'warn-box', html: 'Muro in comune tra <b>' + owners.map(r => plan.rooms[r].name).join('</b> e <b>') + '</b>: scegli qui sotto se lavorare sul muro di una sola stanza.' }));
      if (scopes.length > 1) fields.appendChild(U.segField('Modifica', scopes, scope, v => { editor.wallScope = v; renderSheet(); editor.draw(); }));
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
      const faces = P.wallFaces(plan, sel.id);
      // misure delle due facce (quelle che prendi col metro): scrivi la misura e il muro si allunga o si accorcia
      if (faces.length === 2) {
        const ff = el('div', { class: 'fields' });
        faces.forEach(fc => {
          const lbl = (fc.room && plan.rooms[fc.room] ? 'Lato ' + plan.rooms[fc.room].name : 'Lato esterno') + ' (misura col metro)';
          ff.appendChild(U.numField(lbl, fc.len, 'm', v => mut(pl => {
            const cur = P.wallFaces(pl, sel.id).find(x => x.side === fc.side);
            if (!cur) return;
            P.stretchWall(pl, sel.id, Math.max(0.05, P.wallLen(pl, sel.id) + (v - cur.len)), editor.stretchSide || 'b');
          }), { min: 0.05, max: 100 }));
        });
        sheet.appendChild(ff);
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
        el('button', { class: 'btn danger', html: U.icon('trash', 18) + (scope.startsWith('room:') ? 'Elimina il muro di ' + plan.rooms[scope.slice(5)].name : whole ? 'Elimina tutta la parete' : 'Elimina muro'), onclick: () => deleteWallScope(scope, targets) })
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
      // distanze dagli angoli, sul muro finito (come le misuri col metro dentro la stanza)
      const cls = P.openingClearances(plan, sel.id), cl = cls.find(c => c.room) || cls[0];
      if (cl) {
        const ow = plan.walls[op.wall], wa = plan.nodes[ow.a], wb = plan.nodes[ow.b];
        const hz = Math.abs(wb.x - wa.x) >= Math.abs(wb.y - wa.y);
        const lLo = hz ? (wa.x < wb.x ? 'a sinistra' : 'a destra') : (wa.y < wb.y ? 'in alto' : 'in basso');
        const lHi = hz ? (wa.x < wb.x ? 'a destra' : 'a sinistra') : (wa.y < wb.y ? 'in basso' : 'in alto');
        const where = cl.room && plan.rooms[cl.room] ? ' (' + plan.rooms[cl.room].name + ')' : ' (esterno)';
        fields.appendChild(U.numField('Dall’angolo ' + lLo + where, cl.left, 'cm', v => mut(pl => { const o = pl.openings[sel.id]; o.pos = CM.r3(cl.lo + v + o.w / 2); P.clampOpening(pl, sel.id); }), { min: 0, max: 100 }));
        fields.appendChild(U.numField('Dall’angolo ' + lHi + where, cl.right, 'cm', v => mut(pl => { const o = pl.openings[sel.id]; o.pos = CM.r3(cl.hi - v - o.w / 2); P.clampOpening(pl, sel.id); }), { min: 0, max: 100 }));
      } else fields.appendChild(U.numField('Distanza dall’angolo', Math.max(0, op.pos - op.w / 2), 'cm', v => mut(pl => { const o = pl.openings[sel.id]; o.pos = v + o.w / 2; }), { min: 0, max: 100 }));
      CM.sheets.openingState(fields, ctx, sel.id);
      sheet.appendChild(fields);
      if (op.kind !== 'arco') sheet.appendChild(CM.trim.openingControls(plan, sel.id, (fn) => mut(fn, 'style')));
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
      if (in3d) { view3d.setSelected(null); return; }
      $('stage').classList.remove('with-sheet');
      $('hint').classList.remove('hidden');
      return;
    }
    const key = sheetMode === 'underlay' ? 'underlay' : sel.type + ':' + sel.id;
    if (in3d) {
      decorate3dSheet(sheet, sel);
      if (key === lastRevealed3d) sheet.scrollTop = scroll; else sheet.scrollTop = 0;
      lastRevealed3d = key;
      return;
    }
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
    const prevTab = tab;
    tab = id;
    if (prevTab === '3d' && id !== '3d') { endTool3d(true); if (view3d && view3d.editMode) { $('v3dPanel').classList.add('hidden'); renderSheet(); } }
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
    closeCtx();
    applySplit();
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
      const editSeg = el('div', { class: 'seg edit-seg' }, [['vista', 'Vista'], ['modifica', 'Modifica']].map(([v, l]) => el('button', { class: (v === 'modifica') === !!view3d.editMode ? 'on' : '', text: l, onclick: () => { if ((v === 'modifica') !== !!view3d.editMode) { set3dEdit(v === 'modifica'); render(); } } })));
      bar.append(editSeg);
      if (view3d.editMode) bar.append(el('button', { class: 'chip small accent', html: '<b style="font-size:16px;line-height:1">+</b><span>Aggiungi</span>', onclick: add3d }));
      bar.append(
        seg([['orbit', 'Modellino'], ['walk', 'Passeggiata']], view3d.mode, v => { view3d.setMode(v); $('joystick').classList.toggle('hidden', v !== 'walk'); render(); roomNav(); if (v === 'walk') $('v3dTip').classList.add('hidden'); if (v === 'walk' && CM.isPC && CM.isPC()) U.toast('Frecce per camminare (Maiusc per correre) \u00b7 PagSu/PagGi\u00f9 per cambiare stanza'); }),
        seg([['prima', 'Prima'], ['dopo', 'Dopo']], view3d.phase, v => { view3d.phase = v; view3d.build(project); render(); }),
        el('button', { class: 'chip small' + (view3d.lowWalls ? ' active' : ''), text: 'Muri bassi', onclick: () => { view3d.lowWalls = !view3d.lowWalls; view3d.build(project); render(); } }),
        el('button', { class: 'chip small', html: U.icon('sun', 16) + '<span>Sole</span>', onclick: () => $('sunPanel').classList.toggle('hidden') }),
        el('button', { class: 'chip small accent', html: U.icon('spark', 16) + '<span>Stili</span>', onclick: () => CM.personal.styleGallery(persCtx()) }),
        el('button', { class: 'chip small', text: 'Ispirazione', onclick: () => CM.inspire && CM.inspire.open(persCtx()) }),
        seg([['auto', 'Qualit\u00e0 auto'], ['leggero', 'Leggero'], ['realistico', 'Realistico']], view3d.quality, v => { view3d.setQuality(v); render(); U.toast(v === 'auto' ? 'L\u2019app sceglie la qualit\u00e0 che il dispositivo regge (ora: ' + (view3d.tier === 'alta' ? 'realistica' : 'leggera') + ')' : v === 'realistico' ? 'Qualit\u00e0 realistica: pi\u00f9 bella, consuma di pi\u00f9' : 'Qualit\u00e0 leggera: fluida e risparmia batteria'); }),
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
        el('button', { class: 'chip small', text: 'Foto realistica AI', onclick: () => CM.share.render(project) }),
        el('button', { class: 'chip small', text: 'Inquadra', onclick: () => { view3d.resetCamera(); } })
      );
    };
    render();
    build3dUi.refresh = render;
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

  // Barra "vai in…" per passare da stanza a stanza (passeggiata)
  function roomNav() {
    let nav = $('roomNav');
    if (!nav) { nav = el('div', { class: 'room-nav', id: 'roomNav', role: 'toolbar', 'aria-label': 'Vai in un\u2019altra stanza' }); $('view3dWrap').appendChild(nav); }
    if (!view3d || view3d.mode !== 'walk') { nav.classList.add('hidden'); return; }
    nav.classList.remove('hidden');
    nav.innerHTML = '';
    const cur = view3d.currentRoom();
    nav.append(el('button', { class: 'chip small', 'aria-label': 'Stanza precedente', title: 'Stanza precedente (PagSu)', text: '\u25c0', onclick: () => view3d.stepRoom(-1) }));
    view3d.rooms().forEach(r => nav.appendChild(el('button', { class: 'chip small' + (r.id === cur ? ' active' : ''), text: r.name, onclick: () => view3d.goRoom(r.id) })));
    nav.append(el('button', { class: 'chip small', 'aria-label': 'Stanza successiva', title: 'Stanza successiva (PagGi\u00f9)', text: '\u25b6', onclick: () => view3d.stepRoom(1) }));
    const a = nav.querySelector('.active'); if (a) a.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  // Contesto per la personalizzazione (3D, stili, ispirazione)
  function persCtx(room) {
    return {
      project, room: room || null,
      plan: () => editor.plan,
      mutate: (fn) => editor.mutate(fn, 'style'),
      after: () => { schedule3d(); updateSummary(); },
      openRoom: (rid) => {
        if (is3dEdit()) { last3dHit = { kind: 'floor', room: rid }; editor.select({ type: 'room', id: rid }); U.toast('Piastrelle a parete e carta da parati: qui sotto, in “Rivestimento a parete”'); return; }
        $('v3dPanel').classList.add('hidden'); focusSel({ type: 'room', id: rid });
      }
    };
  }

  /* ---------- Modifica dentro il 3D ---------- */
  let last3dHit = null, v3dTool = null, r3 = 0;
  function is3dEdit() { return tab === '3d' && !!view3d && !!view3d.editMode; }
  function schedule3d() {
    if (!view3d || !show3dNow() || r3) return;
    r3 = requestAnimationFrame(() => { r3 = 0; if (view3d && show3dNow()) view3d.build(project); });
  }
  const hitToSel = (h) => !h ? {} : h.kind === 'floor' ? { type: 'room', id: h.room } : { type: h.kind, id: h.id };
  const selToHit = (sel) => {
    if (!sel || !sel.type) return null;
    if (sel.type === 'room') return { kind: 'floor', room: sel.id };
    if (last3dHit && hitToSel(last3dHit).type === sel.type && hitToSel(last3dHit).id === sel.id) return last3dHit;
    return { kind: sel.type, id: sel.id };
  };

  // Nel 3D il pannello del 2D si arricchisce delle finiture rapide (colori, pavimenti, tessuti)
  function decorate3dSheet(sheet, sel) {
    const hit = selToHit(sel);
    view3d.setSelected(hit);
    if (!hit || !['floor', 'wall'].includes(hit.kind)) return;
    if (hit.kind === 'wall' && !hit.room) return;
    const box = el('div', { class: 'quick3d' });
    try {
      CM.personal.panel3d(box, hit, Object.assign(persCtx(), { bare: true }));
    } catch (e) { console.error(e); return; }
    if (!box.childNodes.length) return;
    const title = { floor: 'Pavimento: scegli e vedi subito', wall: 'Colore di questa parete', furniture: 'Finiture' }[hit.kind];
    // pavimento: prima i materiali; muro: prima le misure, poi il colore
    const anchor = hit.kind === 'wall' ? sheet.querySelector('.fields') : sheet.querySelector('.sheet-head');
    const wrap = el('div', {}, [el('div', { class: 'sec-title', text: title }), box]);
    if (anchor && anchor.nextSibling) sheet.insertBefore(wrap, anchor.nextSibling); else sheet.appendChild(wrap);
  }

  function tip3d(text) { const t = $('v3dTip'); if (!text) { t.classList.add('hidden'); return; } t.textContent = text; t.classList.remove('hidden'); }
  const EDIT_TIP = 'Modifica: trascina mobili, porte, finestre e impianti · tocca per misure e materiali · un muro si sposta dopo averlo toccato';

  function set3dEdit(on) {
    endTool3d(true);
    editor.select({});
    $('v3dPanel').classList.add('hidden');
    view3d.setEdit(on);
    S.pref('v3dEdit', on);
    tip3d(on ? EDIT_TIP : 'Tocca una parete, un pavimento o un mobile per cambiarne colori e materiali');
    renderSheet();
  }

  function toolMsg(text, buttons) {
    let box = $('v3dTool');
    if (!box) { box = el('div', { class: 'v3d-tool', id: 'v3dTool', role: 'status' }); $('view3dWrap').appendChild(box); }
    box.innerHTML = '';
    if (!text) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    box.append(el('span', { class: 'grow', text }), ...(buttons || []));
  }
  function startTool3d(t) {
    v3dTool = t;
    editor.select({});
    $('v3dPanel').classList.add('hidden');
    tip3d(null);
    view3d.setTool({ type: t.type });
    const cancel = el('button', { class: 'btn small', text: 'Annulla', onclick: () => endTool3d() });
    if (t.type === 'chain') toolMsg('Tocca il pavimento punto per punto: ogni tocco alza un muro. Torna al primo punto per chiudere la stanza.', [el('button', { class: 'btn small primary', text: 'Fine', onclick: () => endTool3d() }), cancel]);
    else placedMsg(null);
  }
  function endTool3d(silent) {
    if (v3dTool && v3dTool.type === 'chain') { editor.finishChain(); editor.setTool('select'); }
    v3dTool = null;
    if (view3d) { view3d.setTool(null); view3d.showDraft(null); }
    toolMsg(null);
    if (!silent && is3dEdit()) tip3d(null);
  }

  async function add3d(preset) {
    const what = typeof preset === 'string' ? preset : await U.menu('Aggiungi nel 3D', [
      { id: 'furniture', label: 'Mobile o oggetto', icon: 'sofa' },
      { id: 'opening', label: 'Porta o finestra', icon: 'opening' },
      { id: 'room', label: 'Stanza (trascina sul pavimento)', icon: 'room' },
      { id: 'wall', label: 'Muri (tocca i punti)', icon: 'thick' },
      { id: 'fixture', label: 'Luce, presa o impianto', icon: 'plug' }
    ]);
    if (!what) return;
    if (what === 'furniture') {
      const it = await CM.tabs.pickItem();
      if (!it) return;
      startTool3d({ type: 'point', what, item: it, msg: 'Tocca il pavimento dove vuoi ' + (it.name || 'il mobile') + ': vicino a un muro si appoggia da solo' });
    } else if (what === 'opening') {
      const k = await U.menu('Porta o finestra', Object.keys(CM.OPENINGS).map(id => ({ id, label: CM.OPENINGS[id].label, icon: 'opening' })));
      if (!k) return;
      startTool3d({ type: 'point', what, kind: k, msg: 'Tocca il muro nel punto dove vuoi ' + CM.OPENINGS[k].label.toLowerCase() });
    } else if (what === 'room') {
      startTool3d({ type: 'rect', what, msg: 'Trascina il dito sul pavimento per disegnare la stanza (due dita per girare la vista)' });
    } else if (what === 'wall') {
      editor.setTool('wall');
      startTool3d({ type: 'chain', what });
    } else if (what === 'fixture') {
      const k = await U.menu('Luce, presa o impianto', Object.keys(CM.FIXTURES).map(id => ({ id, label: CM.FIXTURES[id].label, icon: 'plug' })));
      if (!k) return;
      startTool3d({ type: 'point', what, kind: k, msg: 'Tocca il muro o il pavimento dove vuoi ' + CM.FIXTURES[k].label.toLowerCase() });
    }
  }

  // Dopo ogni inserimento nel 3D lo strumento resta attivo
  function placedMsg(r) {
    if (!v3dTool) return;
    v3dTool.last = r || v3dTool.last;
    v3dTool.count = (v3dTool.count || 0) + (r ? 1 : 0);
    const btns = [];
    if (v3dTool.last) btns.push(el('button', { class: 'btn small', text: 'Modifica l’ultimo', onclick: () => { const l = v3dTool.last; endTool3d(); last3dHit = null; if (l) editor.select(l); } }));
    btns.push(el('button', { class: 'btn small primary', text: 'Fine', onclick: () => endTool3d() }));
    toolMsg((v3dTool.count ? 'Inseriti: ' + v3dTool.count + ' · ' : '') + v3dTool.msg + (v3dTool.count ? ' · tocca ancora per aggiungerne un altro' : ''), btns);
  }

  function onPlace3d({ floor, hit }) {
    const t = v3dTool;
    if (!t) return;
    const onWall = hit && (hit.kind === 'wall' || hit.kind === 'opening') ? hit.point : null;
    const onFloor = hit && hit.kind === 'floor' ? hit.point : floor;
    if (t.what === 'furniture') {
      if (!onFloor) return U.toast('Tocca un punto del pavimento');
      placedMsg(editor.extPlaceFurniture(t.item, onFloor));
      const w = t.last && editor.warnings[t.last.id]; if (w && w.length) U.toast(w[0]);
    } else if (t.what === 'opening') {
      const p = onWall || floor;
      const r = p ? editor.extPlaceOpening(t.kind, p) : null;
      if (!r) return U.toast('Tocca un muro');
      placedMsg(r);
    } else if (t.what === 'fixture') {
      const p = onWall || (hit && hit.point) || floor;
      if (!p) return U.toast('Tocca un muro o il pavimento');
      placedMsg(editor.extPlaceFixture(t.kind, p));
    } else if (t.what === 'wall') {
      const p = (hit && hit.kind === 'wall' && hit.top ? hit.point : null) || floor;
      if (!p) return;
      const ch = editor.extWallTap(p);
      if (!ch) { endTool3d(); U.toast('Stanza chiusa: scegli tipo e materiali qui sotto'); return; }
      view3d.showDraft({ chain: ch });
    }
  }

  function open3d() {
    if (!view3d) {
      view3d = new CM.View3D($('view3d'), {
        onPick: (hit) => {
          if (view3d.editMode) {
            tip3d(null);
            last3dHit = hit;
            if (!hit) { editor.select({}); return; }
            view3d.flash(hit);
            editor.select(hitToSel(hit));
            return;
          }
          $('v3dTip').classList.add('hidden');
          if (!hit) { $('v3dPanel').classList.add('hidden'); return; }
          view3d.flash(hit);
          CM.personal.panel3d($('v3dPanel'), hit, persCtx());
        },
        canDrag: (hit) => {
          if (!view3d.editMode || !hit) return false;
          if (['furniture', 'fixture', 'opening'].includes(hit.kind)) return !!editor.plan[{ furniture: 'furniture', fixture: 'fixtures', opening: 'openings' }[hit.kind]][hit.id];
          if (hit.kind === 'wall') return editor.sel.type === 'wall' && editor.sel.id === hit.id;
          return false;
        },
        onDragStart: (hit, world) => {
          tip3d(null);
          last3dHit = hit;
          const sel = hitToSel(hit);
          if (editor.sel.type !== sel.type || editor.sel.id !== sel.id) editor.select(sel);
          editor.extDragStart(sel, world);
        },
        onDragMove: (world) => {
          editor.extDragMove(world);
          const t = editor._ext && editor._ext.target;
          if (t && t.type === 'furniture') { const f = editor.plan.furniture[t.id]; if (f && view3d.moveLive('furniture', t.id, f.x, f.y, f.rot || 0)) return; }
          schedule3d();
        },
        onDragEnd: () => { editor.extDragEnd(); schedule3d(); },
        onDragCancel: () => { editor.extDragCancel(); schedule3d(); },
        onPlace: onPlace3d,
        onRoomChange: () => { const nav = $('roomNav'); if (nav && !nav.classList.contains('hidden')) roomNav(); },
        onRoom: () => { $('joystick').classList.remove('hidden'); setTimeout(() => { if (view3d.mode === 'walk') { build3dUi.refresh && build3dUi.refresh(); roomNav(); } }, 700); },
        onContext: on3dContext,
        onRect: (a, b, final) => {
          if (!final) { view3d.showDraft({ rect: { a, b } }); return; }
          view3d.showDraft(null);
          if (Math.abs(b.x - a.x) < 0.5 || Math.abs(b.y - a.y) < 0.5) { U.toast('Trascina per una stanza di almeno 50 cm'); return; }
          placedMsg(editor.extRect(a, b));
        }
      });
      if (!view3d.init()) { U.toast('La vista 3D non è disponibile su questo dispositivo'); view3d = null; return; }
      view3d.editMode = !!S.pref('v3dEdit');
      build3dUi();
      new ResizeObserver(() => view3d && view3d.resize()).observe($('view3d'));
      view3d.renderer.domElement.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { const r = view3d.renderer.domElement.getBoundingClientRect(); const w = view3d.floorAt(e.clientX - r.left, e.clientY - r.top, 0); if (w) mouseWorld = w; } });
      if (view3d.editMode) tip3d(EDIT_TIP);
    }
    view3d.setVisible(true);
    view3d._placed = view3d.project === project && view3d._placed;
    view3d.resize();
    view3d.build(project);
    view3d.resize();
    roomNav();
    if (view3d.editMode) renderSheet();
  }

  /* ---------- Comodità da PC: copia e incolla, menu col tasto destro, tasti rapidi, pianta + 3D affiancati ---------- */
  let mouseWorld = null, ctxEl = null;
  function show3dNow() { return tab === '3d' || $('editor').classList.contains('split'); }
  function splitWanted() { return !!S.pref('split') && window.innerWidth >= 1000; }
  function applySplit() {
    const on = tab === 'pianta' && splitWanted();
    const was = $('editor').classList.contains('split');
    $('editor').classList.toggle('split', on);
    if (on) { $('view3dWrap').classList.remove('hidden'); open3d(); }
    else if (was && tab !== '3d') { $('view3dWrap').classList.add('hidden'); if (view3d) view3d.setVisible(false); }
    if (on !== was) requestAnimationFrame(() => { editor.resize(); editor.draw(); if (view3d) view3d.resize(); });
  }
  function toggleSplit() {
    S.pref('split', !S.pref('split'));
    applySplit(); buildTools();
    U.toast(S.pref('split') ? 'Pianta e 3D affiancati: ogni modifica si vede subito in entrambi' : 'Solo pianta');
  }

  // Gli elementi che fanno parte della selezione (una stanza porta con sé muri, porte, mobili e impianti)
  function selSet(plan, sel) {
    if (!sel || !sel.type) return null;
    const set = { nodes: [], walls: [], rooms: [], furniture: [], fixtures: [], columns: [], beams: [] };
    const node = (n) => { if (!set.nodes.includes(n)) set.nodes.push(n); };
    if (sel.type === 'furniture' && plan.furniture[sel.id]) set.furniture.push(sel.id);
    else if (sel.type === 'fixture' && plan.fixtures[sel.id]) set.fixtures.push(sel.id);
    else if (sel.type === 'column' && plan.columns[sel.id]) set.columns.push(sel.id);
    else if (sel.type === 'beam' && plan.beams[sel.id]) set.beams.push(sel.id);
    else if (sel.type === 'wall' && plan.walls[sel.id]) { const w = plan.walls[sel.id]; node(w.a); node(w.b); set.walls.push(sel.id); }
    else if (sel.type === 'room' && plan.rooms[sel.id]) {
      const r = plan.rooms[sel.id];
      r.nodes.forEach(node); set.rooms.push(sel.id);
      P.roomWalls(plan, r).forEach(id => { const w = plan.walls[id]; if (!w) return; set.walls.push(id); node(w.a); node(w.b); });
      for (const id in plan.furniture) if (P.roomOf(plan, plan.furniture[id]) === sel.id) set.furniture.push(id);
      for (const id in plan.fixtures) if (P.roomOf(plan, plan.fixtures[id]) === sel.id) set.fixtures.push(id);
    } else return null;
    return set;
  }
  // Elimina il tratto, la parete intera o il muro di una sola stanza (il tratto in comune resta all'altra stanza)
  function deleteWallScope(scope, targets) {
    if (scope === 'one') { editor.deleteSelection(); U.toast('Muro eliminato \u00b7 puoi annullare'); return; }
    if (scope === 'all') { editor.mutate(pl => targets.forEach(id => { if (pl.walls[id]) P.deleteWall(pl, id); }), 'delete'); editor.select({}); U.toast('Parete eliminata \u00b7 puoi annullare'); return; }
    const rid = scope.slice(5), name = editor.plan.rooms[rid].name;
    let removed = 0, kept = [];
    editor.mutate(pl => {
      for (const id of targets) {
        const w = pl.walls[id]; if (!w) continue;
        const others = P.wallOwners(pl, id).filter(r => r !== rid);
        if (!others.length) { P.deleteWall(pl, id); removed++; continue; }
        // tratto in comune: resta, con le misure e lo stato che aveva per l'altra stanza
        const keep = w.byRoom && w.byRoom[others[0]];
        if (keep) { w.t = keep.t; w.h = keep.h; w.state = keep.state; }
        if (w.byRoom) { const by = Object.assign({}, w.byRoom); delete by[rid]; w.byRoom = by; }
        kept.push(pl.rooms[others[0]].name);
      }
    }, 'delete');
    editor.select({});
    if (removed && kept.length) U.toast('Tolto il muro di ' + name + ': il tratto in comune resta a ' + kept[0]);
    else if (kept.length) U.toast('Il muro di ' + name + ' era tutto in comune con ' + kept[0] + ': resta quello di ' + kept[0] + ' (con il suo spessore)');
    else U.toast('Muro di ' + name + ' eliminato \u00b7 puoi annullare');
  }

  /* ---------- Menu rotondo intorno all'oggetto selezionato (pianta) ---------- */
  let radialKey = '', radialRaf = 0;
  function radialItems(sel) {
    const plan = editor.plan, pick = () => sel;
    void pick;
    const props = () => { U.setPanelMin(false); const s = $('sheet').querySelector('.personal, .sec-title'); if (s) s.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
    if (sel.type === 'furniture') return [
      { icon: 'brush', t: 'Colore e finiture', run: props },
      { icon: 'rotate', t: 'Ruota di 90\u00b0', run: () => editor.rotateSelected(90) },
      { icon: 'spark', t: 'Abbina il resto con l\u2019AI', ai: true, run: () => CM.inspire && CM.inspire.matchFromItem(persCtx(), sel.id) },
      { icon: 'copy', t: 'Duplica o sposta', run: async () => { const c = await U.menu('Duplica o sposta', [{ id: 'dup', label: 'Duplica qui accanto', icon: 'copy' }, { id: 'dupr', label: 'Duplica in un\u2019altra stanza\u2026', icon: 'room' }, { id: 'mv', label: 'Sposta in un\u2019altra stanza\u2026', icon: 'room' }]); if (c === 'dup') duplicateSel(); else if (c === 'dupr') toOtherRoom(true); else if (c === 'mv') toOtherRoom(false); } },
      { icon: 'trash', t: 'Elimina', danger: true, run: () => { editor.deleteSelection(); U.toast('Eliminato \u00b7 puoi annullare'); } }
    ];
    if (sel.type === 'room') return [
      { icon: 'brush', t: 'Stile della stanza', run: () => CM.personal.styleGallery(persCtx(sel.id)) },
      { icon: 'spark', t: 'Arreda con l\u2019AI', ai: true, run: () => CM.roomAI.furnish(sel.id) },
      { icon: 'image', t: 'Inserisci un progetto (IKEA, PDF, foto)', run: () => CM.roomAI.importPlan(sel.id) },
      { icon: 'copy', t: 'Duplica la stanza', run: duplicateSel },
      { icon: 'trash', t: 'Elimina la stanza', danger: true, run: () => { editor.deleteSelection(); U.toast('Stanza eliminata \u00b7 puoi annullare'); } }
    ];
    if (sel.type === 'opening') {
      const o = plan.openings[sel.id];
      return [
        { icon: 'flip', t: 'Inverti lato', run: () => editor.mutate(pl => { pl.openings[sel.id].flipSide = !pl.openings[sel.id].flipSide; }, 'flip') },
        o && o.kind === 'battente' ? { icon: 'hinge', t: 'Cerniera dall\u2019altra parte', run: () => editor.mutate(pl => { pl.openings[sel.id].flipHinge = !pl.openings[sel.id].flipHinge; }, 'flip') } : null,
        { icon: 'brush', t: 'Modello e colore', run: props },
        { icon: 'copy', t: 'Duplica', run: duplicateSel },
        { icon: 'trash', t: 'Elimina', danger: true, run: () => editor.deleteSelection() }
      ].filter(Boolean);
    }
    if (sel.type === 'fixture' || sel.type === 'column') return [
      { icon: 'copy', t: 'Duplica', run: duplicateSel },
      { icon: 'trash', t: 'Elimina', danger: true, run: () => editor.deleteSelection() }
    ];
    return null;
  }
  function updateRadial() {
    if (radialRaf) return;
    radialRaf = requestAnimationFrame(() => { radialRaf = 0; drawRadial(); });
  }
  function drawRadial() {
    let box = $('radial');
    if (!box) { box = el('div', { class: 'radial', id: 'radial' }); $('stage').appendChild(box); }
    const sel = editor.sel, g = editor.gesture;
    const items = tab === 'pianta' && editor.tool === 'select' && sel.type ? radialItems(sel) : null;
    const busy = g && ['drag', 'pan', 'pinch'].includes(g.type);
    const b = items && editor.boundsOf(sel);
    if (!items || busy || !b || document.body.classList.contains('kb')) { box.classList.add('hidden'); return; }
    const key = sel.type + ':' + sel.id;
    if (key !== radialKey || !box.childNodes.length) {
      radialKey = key; box.innerHTML = '';
      items.forEach(it => box.appendChild(el('button', { class: 'rad' + (it.ai ? ' ai' : '') + (it.danger ? ' danger' : ''), title: it.t, 'aria-label': it.t, html: U.icon(it.icon, 20), onclick: (e) => { e.stopPropagation(); it.run(); } })));
    }
    box.classList.remove('hidden');
    const v = editor.view, st = $('stage').getBoundingClientRect();
    const sh = $('sheet').classList.contains('hidden') ? null : $('sheet').getBoundingClientRect();
    const x0 = v.x + b.minX * v.s, x1 = v.x + b.maxX * v.s, y0 = v.y + b.minY * v.s, y1 = v.y + b.maxY * v.s;
    let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const room = sel.type === 'room';
    const half = Math.hypot(x1 - x0, y1 - y0) / 2;
    const r = room ? 62 : Math.max(48, Math.min(half + 30, 150));
    if (room) { const lp = CM.geom.labelPoint(P.roomPts(editor.plan, editor.plan.rooms[sel.id])); cx = v.x + lp.x * v.s; cy = v.y + lp.y * v.s; }
    const bottomLimit = sh && sh.top > st.top + 40 && sh.left <= st.left + 10 ? sh.top - st.top : st.height;
    const n = box.childNodes.length, span = Math.min(Math.PI * 0.9, 0.62 * (n - 1) * 52 / r * 1.1 + 0.2);
    const up = cy - r > 50;
    const mid = up ? -Math.PI / 2 : Math.PI / 2;
    [...box.childNodes].forEach((btn, i) => {
      const a = mid + (n === 1 ? 0 : (i / (n - 1) - 0.5) * span) * (up ? 1 : -1);
      const x = Math.max(4, Math.min(st.width - 48, cx + r * Math.cos(a) - 22));
      const y = Math.max(4, Math.min(bottomLimit - 48, cy + r * Math.sin(a) - 22));
      btn.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
    });
  }

  /* ---------- Inserisci stanze da un altro progetto o da un file ---------- */
  function readProjectFile() {
    return new Promise(resolve => {
      const input = el('input', { type: 'file', accept: '.json,.casamia,application/json,*/*', style: 'display:none' });
      document.body.appendChild(input);
      input.addEventListener('change', () => {
        const f = input.files[0]; input.remove();
        if (!f) return resolve(null);
        if (/^image\/|pdf$/i.test(f.type || '')) { U.toast('Questa \u00e8 un\u2019immagine: per un disegno usa \u201cPlanimetria\u201d'); return resolve(null); }
        const r = new FileReader();
        r.onload = () => {
          try {
            const d = JSON.parse(String(r.result).replace(/^\uFEFF/, ''));
            const raw = d.type === 'casamia-progetto' && d.project ? d.project : d.type === 'casamia-backup' && d.projects && d.projects.length ? d.projects[0] : (d.variants || d.plan ? d : null);
            if (!raw) throw new Error('no');
            // materiali e articoli del file, così pavimenti e mobili si vedono uguali
            const merge = (key, list) => { if (!list || !list.length) return; const cur = S.getJSON(key, []); const ids = new Set(cur.map(x => x.id)); S.putJSON(key, cur.concat(list.filter(x => !ids.has(x.id)))); };
            merge('materiali', d.materials); merge('catalogo', d.catalog);
            resolve(CM.project.normalize(raw));
          } catch (e) { U.toast('File non riconosciuto: serve un progetto di Casa Mia'); resolve(null); }
        };
        r.onerror = () => { U.toast('Non riesco a leggere il file'); resolve(null); };
        r.readAsText(f);
      });
      input.click();
    });
  }
  async function insertRooms() {
    const others = S.listProjects().filter(p => p.id !== project.id);
    const src = await U.menu('Inserisci stanze da\u2026', [
      { id: 'file', label: 'Un file di progetto (ricevuto o salvato)', icon: 'opening' }
    ].concat(others.slice(0, 12).map(p => ({ id: 'p:' + p.id, label: p.name, icon: 'house' }))));
    if (!src) return;
    const sp = src === 'file' ? await readProjectFile() : S.loadProject(src.slice(2));
    if (!sp) return;
    const plan = CM.project.plan(sp);
    const ids = Object.keys(plan.rooms);
    if (!ids.length) { U.toast('In quel progetto non ci sono stanze'); return; }
    const chosen = new Set(ids.length === 1 ? ids : []);
    let withFurn = true;
    const body = el('div');
    const draw = () => {
      body.innerHTML = '';
      body.append(
        el('div', { class: 'actions', style: 'margin:0 0 6px' }, [
          el('button', { class: 'btn small', text: 'Tutte', onclick: () => { ids.forEach(i => chosen.add(i)); draw(); } }),
          el('button', { class: 'btn small', text: 'Nessuna', onclick: () => { chosen.clear(); draw(); } })
        ]),
        el('div', { class: 'check-list' }, ids.map(i => {
          const r = plan.rooms[i];
          return el('label', { class: 'check' }, [el('input', { type: 'checkbox', checked: chosen.has(i), onchange: (e) => { if (e.target.checked) chosen.add(i); else chosen.delete(i); } }), el('span', { text: r.name + ' \u00b7 ' + CM.fmt.area(P.roomStats(plan, r).net) })]);
        })),
        el('label', { class: 'check', style: 'margin-top:8px' }, [el('input', { type: 'checkbox', checked: withFurn, onchange: (e) => { withFurn = e.target.checked; } }), el('span', { text: 'Con mobili e impianti' })])
      );
    };
    draw();
    const ok = await U.dialog({ title: 'Quali stanze di \u201c' + sp.name + '\u201d?', text: 'Vengono inserite con muri, porte, finestre e finiture. Poi le sposti dove vuoi.', body, actions: [{ label: 'Annulla', value: null }, { label: 'Inserisci', value: true, primary: true }] });
    if (!ok || !chosen.size) return;
    const set = { nodes: [], walls: [], rooms: [], furniture: [], fixtures: [], columns: [], beams: [] };
    for (const rid of chosen) {
      const s1 = selSet(plan, { type: 'room', id: rid });
      for (const k in set) for (const x of s1[k]) if (!set[k].includes(x)) set[k].push(x);
    }
    if (!withFurn) { set.furniture = []; set.fixtures = []; }
    const bb = P.setBounds(plan, set), cur = P.bounds(Object.assign({}, editor.plan, { underlay: null }));
    const dx = cur && bb ? CM.r3(cur.maxX + 1 - bb.x0) : (bb ? -bb.x0 : 0), dy = cur && bb ? CM.r3(cur.minY - bb.y0) : (bb ? -bb.y0 : 0);
    let out; editor.mutate(pl => { out = P.copySet(plan, pl, set, dx, dy); }, 'insert');
    setTab('pianta');
    editor.setTool('multi'); editor.setMulti(out); buildTools(); renderSheet(); editor.fit();
    U.toast(chosen.size === 1 ? 'Stanza inserita a destra: trascina il riquadro blu dove vuoi' : chosen.size + ' stanze inserite a destra: trascina il riquadro blu dove vuoi');
  }

  function selectPasted(out) {
    const one = (k, t) => out[k].length === 1 && P.setCount(out) === 1 ? { type: t, id: out[k][0] } : null;
    const s1 = one('furniture', 'furniture') || one('fixtures', 'fixture') || one('columns', 'column') || one('beams', 'beam') || one('walls', 'wall') ||
      (out.rooms.length === 1 ? { type: 'room', id: out.rooms[0] } : null);
    if (s1) { last3dHit = null; editor.setTool('select'); editor.select(s1); }
    else { editor.setTool('multi'); editor.setMulti(out); }
    buildTools(); renderSheet();
  }
  function copySel() {
    const set = selSet(editor.plan, editor.sel);
    if (!set) { U.toast(editor.sel.type === 'opening' ? 'Per porte e finestre usa Duplica (Ctrl+D)' : 'Seleziona prima qualcosa da copiare'); return; }
    CM.clipboard = { plan: CM.clone(editor.plan), set: CM.clone(set) };
    U.toast('Copiato · Ctrl+V per incollare dove c’è il mouse (anche in un altro progetto)');
  }
  function pasteAt(world) {
    const c = CM.clipboard;
    if (!c) { U.toast('Niente da incollare: copia prima qualcosa (Ctrl+C)'); return; }
    const bb = P.setBounds(c.plan, c.set);
    if (!bb) return;
    let dx = 0.5, dy = 0.5;
    if (world) { dx = world.x - (bb.x0 + bb.x1) / 2; dy = world.y - (bb.y0 + bb.y1) / 2; }
    dx = CM.r3(Math.round(dx / 0.05) * 0.05); dy = CM.r3(Math.round(dy / 0.05) * 0.05);
    let out; editor.mutate(pl => { out = P.copySet(c.plan, pl, c.set, dx, dy); }, 'paste');
    selectPasted(out);
    U.toast('Incollato');
  }
  function duplicateSel() {
    const sel = editor.sel, plan = editor.plan;
    if (sel.type === 'opening' && plan.openings[sel.id]) {
      let nid; editor.mutate(pl => { const o = pl.openings[sel.id]; nid = CM.uid('o'); pl.openings[nid] = Object.assign(CM.clone(o), { pos: CM.r3(o.pos + o.w + 0.2) }); P.clampOpening(pl, nid); }, 'duplicate');
      editor.select({ type: 'opening', id: nid }); return;
    }
    const set = selSet(plan, sel);
    if (!set) { U.toast('Seleziona prima qualcosa da duplicare'); return; }
    let dx = 0.4, dy = 0.4;
    if (sel.type === 'room' || sel.type === 'wall') { const bb = P.setBounds(plan, set), all = P.bounds(Object.assign({}, plan, { underlay: null })); dx = all && bb ? CM.r3(all.maxX + 0.6 - bb.x0) : 1; dy = 0; }
    let out; editor.mutate(pl => { out = P.copySet(pl, pl, set, dx, dy); }, 'duplicate');
    selectPasted(out);
    U.toast(sel.type === 'room' ? 'Stanza duplicata a destra della casa: trascinala dove vuoi' : 'Duplicato');
  }
  // Duplica o sposta un mobile/impianto in un'altra stanza (stessa rotazione; se era contro un muro, si appoggia a un muro anche lì)
  async function toOtherRoom(copy) {
    const sel = editor.sel, plan = editor.plan;
    const coll = sel.type === 'furniture' ? 'furniture' : sel.type === 'fixture' ? 'fixtures' : null;
    const obj = coll && plan[coll][sel.id];
    if (!obj) { U.toast('Seleziona un mobile o un impianto'); return; }
    const here = P.roomOf(plan, obj);
    const rooms = Object.keys(plan.rooms).filter(r => r !== here);
    if (!rooms.length) { U.toast('Non ci sono altre stanze'); return; }
    const rid = await U.menu((copy ? 'Duplica ' : 'Sposta ') + (obj.name ? '\u201c' + obj.name + '\u201d ' : '') + 'in\u2026', rooms.map(r => ({ id: r, label: plan.rooms[r].name, icon: 'room' })));
    if (!rid) return;
    const c = CM.geom.labelPoint(P.roomPts(plan, plan.rooms[rid]));
    let nid = sel.id;
    editor.mutate(pl => {
      const src = pl[coll][sel.id];
      let t = src;
      if (copy) { nid = CM.uid(coll === 'furniture' ? 'f' : 'i'); t = pl[coll][nid] = CM.clone(src); }
      if (coll === 'furniture') {
        // era appoggiato a un muro?
        const near = Object.keys(pl.walls).some(id => { const w = pl.walls[id]; return CM.geom.projSeg(src, pl.nodes[w.a], pl.nodes[w.b]).d < (w.t / 2 + src.d / 2 + 0.12); });
        const pos = editor.at3d(() => editor._furnitureSnap(Object.assign({}, t, { x: c.x, y: c.y }), near));
        t.x = CM.r3(pos.x); t.y = CM.r3(pos.y); if (near && pos.rot != null) t.rot = pos.rot;
        if (!CM.geom.inPoly(t, P.roomPts(pl, pl.rooms[rid]))) { t.x = CM.r3(c.x); t.y = CM.r3(c.y); }
      } else { const pos = editor.at3d(() => editor._fixtureSnap(c)); t.x = CM.r3(pos.x); t.y = CM.r3(pos.y); }
    }, copy ? 'duplicate' : 'move');
    editor.select({ type: sel.type, id: nid });
    if (tab === 'pianta') { const b = editor.boundsOf({ type: sel.type, id: nid }); if (b) editor.reveal({ type: sel.type, id: nid }, { x: 0, y: 0, w: $('stage').clientWidth - 72, h: $('stage').clientHeight * 0.5 }); }
    U.toast((copy ? 'Duplicato in ' : 'Spostato in ') + plan.rooms[rid].name + ': trascinalo dove vuoi');
  }

  function nudgeSel(dx, dy) {
    const sel = editor.sel;
    if (!sel.type) return false;
    editor.mutate(pl => {
      const o = sel.type === 'furniture' ? pl.furniture[sel.id] : sel.type === 'fixture' ? pl.fixtures[sel.id] : sel.type === 'column' ? pl.columns[sel.id] : null;
      if (o) { o.x = CM.r3(o.x + dx); o.y = CM.r3(o.y + dy); return; }
      if (sel.type === 'opening' && pl.openings[sel.id]) { const op = pl.openings[sel.id]; op.pos = CM.r3(op.pos + (Math.abs(dx) > Math.abs(dy) ? dx : dy)); P.clampOpening(pl, sel.id); return; }
      const set = selSet(pl, sel); if (set) P.translateSet(pl, set, dx, dy);
    }, 'nudge');
    return true;
  }

  function closeCtx() { if (ctxEl) ctxEl.remove(); ctxEl = null; document.removeEventListener('pointerdown', ctxOutside, true); }
  function ctxOutside(e) { if (ctxEl && !ctxEl.contains(e.target)) closeCtx(); }
  function ctxMenu(x, y, title, items) {
    closeCtx();
    const m = el('div', { class: 'ctx-menu', role: 'menu' }, [title ? el('div', { class: 'ctx-title', text: title }) : null].concat(items.filter(Boolean).map(it => it === '-' ? el('div', { class: 'ctx-sep' }) :
      el('button', { role: 'menuitem', class: it.danger ? 'danger' : '', html: (it.icon ? U.icon(it.icon, 16) : '<i class="ctx-ic"></i>') + '<span class="grow">' + it.label + '</span>' + (it.key ? '<kbd>' + it.key + '</kbd>' : ''), onclick: () => { closeCtx(); it.run(); } }))));
    document.body.appendChild(m);
    const r = m.getBoundingClientRect();
    m.style.left = Math.max(6, Math.min(x, window.innerWidth - r.width - 6)) + 'px';
    m.style.top = Math.max(6, Math.min(y, window.innerHeight - r.height - 6)) + 'px';
    ctxEl = m;
    setTimeout(() => document.addEventListener('pointerdown', ctxOutside, true), 0);
  }
  const SEL_NAMES = { furniture: 'Mobile', fixture: 'Impianto', room: 'Stanza', wall: 'Muro', opening: 'Porta o finestra', column: 'Pilastro', beam: 'Trave' };
  function contextFor(sel, world, x, y) {
    const plan = editor.plan, items = [];
    let title = '';
    if (sel && sel.type) {
      const o = { furniture: plan.furniture, fixture: plan.fixtures, room: plan.rooms, opening: plan.openings }[sel.type];
      const obj = o && o[sel.id];
      title = (SEL_NAMES[sel.type] || '') + (obj && obj.name ? ': ' + obj.name : sel.type === 'opening' && obj ? ': ' + CM.OPENINGS[obj.kind].label : '');
      const pick = () => { if (editor.sel.type !== sel.type || editor.sel.id !== sel.id) editor.select(sel); };
      items.push({ label: 'Proprietà', icon: 'rename', run: () => { U.setPanelMin(false); pick(); renderSheet(); } });
      if (sel.type === 'furniture') {
        items.push({ label: 'Ruota di 90°', key: 'R', run: () => { pick(); editor.rotateSelected(90); } });
        items.push({ label: 'Ruota di 15°', key: 'Maiusc+R', run: () => { pick(); editor.rotateSelected(15); } });
      }
      items.push({ label: 'Duplica', key: 'Ctrl+D', icon: 'copy', run: () => { pick(); duplicateSel(); } });
      if (sel.type === 'furniture' || sel.type === 'fixture') {
        items.push({ label: 'Duplica in un\u2019altra stanza\u2026', icon: 'room', run: () => { pick(); toOtherRoom(true); } });
        items.push({ label: 'Sposta in un\u2019altra stanza\u2026', icon: 'room', run: () => { pick(); toOtherRoom(false); } });
      }
      if (sel.type !== 'opening') items.push({ label: 'Copia', key: 'Ctrl+C', run: () => { pick(); copySel(); } });
      if (sel.type === 'room') items.push({ label: 'Stile della stanza', icon: 'spark', run: () => CM.personal.styleGallery(persCtx(sel.id)) });
      items.push('-');
      items.push({ label: 'Elimina', key: 'Canc', icon: 'trash', danger: true, run: () => { pick(); editor.deleteSelection(); U.toast('Eliminato · puoi annullare (Ctrl+Z)'); } });
    } else {
      title = 'Qui';
      if (CM.clipboard && world) items.push({ label: 'Incolla qui', key: 'Ctrl+V', icon: 'copy', run: () => pasteAt(world) });
      if (world) items.push({ label: 'Aggiungi un mobile qui', icon: 'sofa', run: async () => { const it = await CM.tabs.pickItem(); if (!it) return; const r = editor.extPlaceFurniture(it, world); if (r) { last3dHit = null; editor.select(r); } } });
      if (world) items.push({ label: 'Aggiungi luce o presa qui', icon: 'plug', run: async () => { const k = await U.menu('Luce, presa o impianto', Object.keys(CM.FIXTURES).map(id => ({ id, label: CM.FIXTURES[id].label, icon: 'plug' }))); if (!k) return; const r = editor.extPlaceFixture(k, world); if (r) { last3dHit = null; editor.select(r); } } });
      items.push('-');
      items.push({ label: 'Tasti rapidi', key: '?', icon: 'help', run: shortcutsDialog });
    }
    ctxMenu(x, y, title, items);
  }
  function onPlanContext(e) {
    e.preventDefault();
    if (!['select', 'multi'].includes(editor.tool)) { editor.setTool('select'); buildTools(); renderSheet(); U.toast('Fine'); return; }
    const r = $('planCanvas').getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    const h = editor.hitTest(sx, sy);
    const sel = h && h.id && !['node', 'pin'].includes(h.type) ? { type: h.type, id: h.id } : null;
    contextFor(sel, editor.toWorld(sx, sy), e.clientX, e.clientY);
  }
  function on3dContext(hit, floor, x, y) {
    if (v3dTool) { endTool3d(); U.toast('Fine'); return; }
    last3dHit = hit;
    contextFor(hit ? hitToSel(hit) : null, hit && hit.kind === 'floor' ? hit.point : floor, x, y);
  }

  function shortcutsDialog() {
    const rows = [
      ['Generali', ''], ['Ctrl+Z / Ctrl+Y', 'Annulla / Ripeti'], ['1 … 5', 'Pianta, 3D, Arredo, Costi, Lavori'], ['?', 'Questo elenco'], ['Esc', 'Chiudi, smetti di inserire'],
      ['Oggetto selezionato', ''], ['Canc', 'Elimina'], ['Ctrl+C / Ctrl+V', 'Copia / Incolla dove c’è il mouse'], ['Ctrl+D', 'Duplica'], ['R / Maiusc+R', 'Ruota di 90° / 15°'], ['Frecce', 'Sposta di 5 cm (con Maiusc: 1 cm)'],
      ['Strumenti (pianta e 3D in Modifica)', ''], ['V', 'Seleziona'], ['S', 'Stanza'], ['M', 'Muri'], ['P', 'Porte e finestre'], ['A', 'Arredo'], ['I', 'Luci e impianti'], ['F', 'Inquadra tutta la casa'], ['T', 'Pianta e 3D affiancati'],
      ['3D', ''], ['Frecce', 'Cammina e gira (in Modellino: gira la casa)'], ['W A S D', 'Cammina (Q / E: passo di lato)'], ['Maiusc', 'Corri'], ['PagSu / PagGi\u00f9', 'Stanza precedente / successiva'], ['+ / \u2212', 'Avvicina / allontana (Modellino)'],
      ['Mouse', ''], ['Tasto destro', 'Menu dell’oggetto (o “Fine” mentre inserisci)'], ['Rotella', 'Zoom'], ['3D: sinistro / destro', 'Gira / sposta la vista']
    ];
    const body = el('div', { class: 'keys' }, rows.map(([k, v]) => v === '' ? el('div', { class: 'sec-title', text: k }) : el('div', { class: 'key-row' }, [el('kbd', { text: k }), el('span', { text: v })])));
    U.dialog({ title: 'Tasti rapidi', body });
  }

  function onKey(e) {
    if (U.overlayOpen() && e.key === 'Escape') { U.closeOverlay(); return; }
    if ($('editor').classList.contains('hidden') || U.overlayOpen()) return;
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const key = e.key, low = key.length === 1 ? key.toLowerCase() : key, ctrl = e.ctrlKey || e.metaKey;
    if (key === 'Escape' && ctxEl) { closeCtx(); return; }
    if (key === '?' || key === 'F1') { e.preventDefault(); shortcutsDialog(); return; }
    if (!ctrl && !e.altKey && /^[1-5]$/.test(key)) { closeCtx(); setTab(['pianta', '3d', 'arredo', 'costi', 'lavori'][+key - 1]); return; }
    const in3 = is3dEdit(), inPlan = tab === 'pianta';
    // 3D: frecce (e W A S D in passeggiata) per muoversi, PagSu/PagGiù per cambiare stanza
    if (tab === '3d' && view3d && view3d.ready && !ctrl && !e.altKey) {
      const code = e.code || '';
      const arrow = /^Arrow/.test(code), walkKey = view3d.mode === 'walk' && /^Key[WASDQE]$/.test(code) && !(in3 && v3dTool);
      const zoom = /^(Equal|Minus|NumpadAdd|NumpadSubtract)$/.test(code);
      const nudging = arrow && in3 && editor.sel.type;
      if (!nudging && (arrow || walkKey || zoom)) { e.preventDefault(); if (!e.repeat) view3d.key(code, true, e.shiftKey); else view3d._run = e.shiftKey; return; }
      if (key === 'PageDown' || key === 'PageUp') { e.preventDefault(); view3d.stepRoom(key === 'PageDown' ? 1 : -1); return; }
    }
    if (!inPlan && !in3) return;
    if (ctrl && low === 'z') { e.preventDefault(); e.shiftKey ? editor.redo() : editor.undo(); return; }
    if (ctrl && low === 'y') { e.preventDefault(); editor.redo(); return; }
    if (ctrl && low === 'c') { e.preventDefault(); copySel(); return; }
    if (ctrl && low === 'v') return; // gestito dall'evento "incolla": foto o elementi copiati
    if (ctrl && low === 'd') { e.preventDefault(); duplicateSel(); return; }
    if (ctrl || e.altKey) return;
    if (key === 'Delete' || key === 'Backspace') { if (editor.sel.type) { e.preventDefault(); editor.deleteSelection(); } return; }
    if (key === 'Escape') {
      if (in3) { if (v3dTool) endTool3d(); else editor.select({}); return; }
      if (editor.tool !== 'select') { editor.setTool('select'); buildTools(); renderSheet(); return; }
      return CM.onBack();
    }
    if (low === 'r' && editor.sel.type === 'furniture') { editor.rotateSelected(e.shiftKey ? 15 : 90); return; }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[key] && editor.sel.type) { e.preventDefault(); const st = e.shiftKey ? 0.01 : 0.05; nudgeSel(arrows[key][0] * st, arrows[key][1] * st); return; }
    if (low === 't') { toggleSplit(); return; }
    if (in3) {
      const m = { s: 'room', m: 'wall', p: 'opening', a: 'furniture', i: 'fixture' }[low];
      if (m) { endTool3d(true); add3d(m); return; }
      if (low === 'v') { endTool3d(); return; }
      if (low === 'f') { view3d.resetCamera(); return; }
      return;
    }
    const tl = { v: 'select', s: 'room', m: 'wall', p: 'opening', a: 'furniture', i: 'fixture' }[low];
    if (tl) { toolClick(tl); return; }
    if (low === 'f') editor.fit();
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
      { id: 'insertplan', label: 'Inserisci un progetto di stanza (IKEA, Planner 5D, PDF, foto)', icon: 'image' },
      { id: 'insert', label: 'Inserisci stanze da un altro progetto', icon: 'room' },
      { id: 'trim', label: 'Porte, finestre e battiscopa', icon: 'opening' },
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
      { id: 'autojoin', label: 'Aggancia i muri da soli quando sposti un angolo', icon: 'wall', toggle: !!s.autoJoin },
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
      case 'insert': return insertRooms();
      case 'insertplan': return CM.roomAI.importPlan();
      case 'trim': return CM.trim.houseDialog((fn) => editor.mutate(fn, 'style'), () => editor.plan);
      case 'autojoin': s.autoJoin = !s.autoJoin; scheduleSave(); return U.toast(s.autoJoin ? 'Spostando un angolo vicino a un altro muro, si aggancia da solo' : 'I muri non si agganciano più da soli');
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
  const PC_FILE = !S.isNative && !!window.CASAMIA_PC_VERSION; // il file CasaMia-PC.html aperto sul computer
  function currentVersion() { return S.isNative && window.CasaMiaAndroid.version ? window.CasaMiaAndroid.version() : (window.CASAMIA_PC_VERSION || 'web'); }
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
      const apk = (rel.assets || []).find(a => PC_FILE ? /^CasaMia-PC-[\d.]+\.html$/i.test(a.name) : /\.apk$/i.test(a.name));
      updateInfo = apk && CM.versionNewer(ver, currentVersion()) ? { ver, url: apk.browser_download_url, page: rel.html_url, size: apk.size } : null;
      if (updateInfo && PC_FILE && !manual && S.pref('pcUpdateSeen') !== ver) { S.pref('pcUpdateSeen', ver); setTimeout(offerUpdate, 800); }
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
    if (PC_FILE) {
      const ok = await U.dialog({ title: 'È disponibile la versione ' + u.ver, text: 'Stai usando la ' + currentVersion() + '. Scarico il nuovo file' + mb + ': aprilo con doppio clic e chiudi questa finestra. I progetti restano, perché sono salvati nel browser e non nel file.', actions: [{ label: 'Più tardi', value: false }, { label: 'Scarica la nuova versione', value: true, primary: true }] });
      if (!ok) return;
      saveNow();
      const a = el('a', { href: u.url, download: 'CasaMia-PC.html' }); document.body.appendChild(a); a.click(); a.remove();
      U.dialog({ title: 'Download avviato', text: 'Quando è finito, apri “CasaMia-PC.html” dalla cartella Download (o dalla barra dei download del browser). Consiglio: sostituisci il vecchio file sul Desktop con quello nuovo, così il collegamento resta lo stesso.', actions: [{ label: 'Ho capito', value: true, primary: true }] });
      return;
    }
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
    toOtherRoom: (copy) => toOtherRoom(copy),
    selectSet: (set) => { setTab('pianta'); editor.setTool('multi'); editor.setMulti(set); buildTools(); renderSheet(); },
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
      onChange: () => { scheduleSave(); updateSummary(); updateHeader(); renderSheet(); schedule3d(); },
      onSelect: () => { if (editor.sel.type) sheetMode = null; renderSheet(); },
      onHint: (text, actions) => {
        $('hintText').textContent = text;
        const box = $('hintActions');
        box.innerHTML = '';
        if (actions.includes('undoPoint')) box.appendChild(el('button', { text: 'Annulla punto', onclick: () => editor.undoPoint() }));
        if (actions.includes('finish')) box.appendChild(el('button', { class: 'primary', text: 'Fine', onclick: () => editor.finishChain() }));
        if (['fixture', 'opening', 'furniture', 'column'].includes(editor.tool)) {
          if (editor.lastPlaced) box.appendChild(el('button', { text: 'Modifica l\u2019ultimo', onclick: () => { editor.editLastPlaced(); buildTools(); } }));
          box.appendChild(el('button', { class: 'primary', text: 'Fine', onclick: () => { editor.setTool('select'); buildTools(); } }));
        }
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
      onPlaced: () => { if (tab === 'pianta') U.toast('Inserito \u00b7 tocca ancora per aggiungerne un altro, \u201cFine\u201d per smettere'); },
      onHistory: (u, r) => { $('undoBtn').disabled = !u; $('redoBtn').disabled = !r; },
      onToast: (t) => U.toast(t),
      onDraw: (view) => { updateScale(view); updateRadial(); },
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

    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', (e) => { if (view3d && view3d.keys) { view3d.key(e.code || '', false, e.shiftKey); view3d._run = e.shiftKey; } });
    window.addEventListener('blur', () => { if (view3d) view3d.clearKeys(); });
    // Incolla: un'immagine negli appunti diventa la foto del mobile selezionato (al computer); altrimenti incolla gli elementi copiati
    document.addEventListener('paste', async (e) => {
      if (U.overlayOpen() || /INPUT|TEXTAREA/.test(document.activeElement.tagName) || $('editor').classList.contains('hidden')) return;
      if (tab !== 'pianta' && !is3dEdit()) return;
      const dt = e.clipboardData;
      const hasImg = dt && [...(dt.items || [])].some(it => it.kind === 'file' && /^image\//.test(it.type));
      e.preventDefault();
      if (hasImg && CM.isPC()) {
        const sel = editor.sel;
        if (sel.type !== 'furniture') { U.toast('Seleziona prima il mobile a cui dare questa foto'); return; }
        const d = await CM.imageFromData(dt);
        if (d) { editor.mutate(pl => { if (pl.furniture[sel.id]) pl.furniture[sel.id].img = d; }, 'photo'); U.toast('Foto del mobile salvata'); }
        return;
      }
      pasteAt(mouseWorld);
    });
    $('planCanvas').addEventListener('contextmenu', onPlanContext);
    $('planCanvas').addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { const r = $('planCanvas').getBoundingClientRect(); mouseWorld = editor.toWorld(e.clientX - r.left, e.clientY - r.top); } });
    window.addEventListener('resize', () => { if (project) applySplit(); });
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
    if (PC_FILE) setTimeout(() => checkUpdate(false), 2500);
    if (!S.isNative && !PC_FILE) $('updateBtn').classList.add('hidden'); // la versione web è sempre l'ultima
    if (S.isNative) {
      setTimeout(() => checkUpdate(false), 2500);
      setTimeout(() => CM.shop.syncWatch(), 4000);
      setTimeout(() => { try { if (CM.share.autoBackup(false)) U.toast('Backup automatico salvato in Download/CasaMia'); } catch (e) { console.error(e); } }, 6000);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
