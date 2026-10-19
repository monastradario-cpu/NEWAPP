/* Casa Mia — avvio dell'app, home dei progetti, schermata pianta */
(function () {
  'use strict';
  const CM = window.CM, U = CM.ui, P = CM.plan, S = CM.store, el = U.el;
  const $ = (id) => document.getElementById(id);

  let project = null;
  let editor = null;
  let saveTimer = 0;

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
    if (!items.length) {
      list.appendChild(el('div', { class: 'empty', html: 'Nessun progetto per ora.<br>Tocca <b>Nuovo</b> per iniziare oppure apri l’<b>Esempio</b>.' }));
    }
    for (const s of items) {
      const cv = el('canvas', { 'aria-hidden': 'true' });
      const p = S.loadProject(s.id);
      if (p) drawThumb(cv, p);
      const meta = CM.fmt.num(s.area || 0, 1) + ' m² · ' + (s.rooms || 0) + (s.rooms === 1 ? ' ambiente' : ' ambienti');
      const title = el('div', { class: 'pc-title' }, [s.name, s.sample ? el('span', { class: 'pc-tag', text: 'Esempio' }) : null]);
      const card = el('button', { class: 'project-card', onclick: () => openProject(s.id), 'aria-label': 'Apri ' + s.name }, [
        cv,
        el('div', { class: 'pc-body' }, [title, el('div', { class: 'pc-meta', text: meta }), el('div', { class: 'pc-date', text: relDate(s.updated) })])
      ]);
      const more = el('button', { class: 'icon-btn ghost pc-menu', 'aria-label': 'Opzioni per ' + s.name, html: U.icon('dots'), onclick: (e) => { e.stopPropagation(); projectMenu(s); } });
      list.appendChild(el('div', { class: 'pc-wrap' }, [card, more]));
    }
    const ver = S.isNative && window.CasaMiaAndroid.version ? window.CasaMiaAndroid.version() : 'web';
    let v = document.querySelector('.version');
    if (!v) { v = el('div', { class: 'version' }); document.querySelector('.home-body').appendChild(v); }
    v.textContent = 'Casa Mia ' + ver + ' · tappa 1: pianta 2D';
  }

  async function projectMenu(s) {
    const choice = await U.menu(s.name, [
      { id: 'rename', label: 'Rinomina', icon: 'rename' },
      { id: 'dup', label: 'Duplica', icon: 'copy' },
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
    } else if (choice === 'delete') {
      const ok = await U.confirmDialog('Eliminare il progetto?', '“' + p.name + '” verrà cancellato dal telefono. L’operazione non si può annullare.', 'Elimina', true);
      if (ok) { S.deleteProject(p.id); renderHome(); U.toast('Progetto eliminato'); }
    }
  }

  async function newProject() {
    const n = S.listProjects().length + 1;
    const name = await U.promptDialog('Nuovo progetto', n === 1 ? 'Casa mia' : 'Progetto ' + n, { label: 'Nome del progetto', ok: 'Crea' });
    if (!name || !name.trim()) return;
    const p = CM.project.create(name.trim());
    S.saveProject(p);
    openProject(p.id);
    U.toast('Scegli “Stanza” e trascina per disegnare');
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

  /* ================= EDITOR ================= */
  const TOOLS = [
    { id: 'select', label: 'Seleziona' },
    { id: 'room', label: 'Stanza' },
    { id: 'wall', label: 'Muro' },
    { id: 'opening', label: 'Porte e finestre' },
    { id: 'column', label: 'Pilastro' },
    { id: 'beam', label: 'Trave' }
  ];

  function buildTools() {
    const bar = $('tools');
    bar.innerHTML = '';
    for (const t of TOOLS) {
      bar.appendChild(el('button', {
        class: 'chip' + (editor.tool === t.id ? ' active' : ''), 'data-tool': t.id, 'aria-pressed': editor.tool === t.id ? 'true' : 'false',
        html: U.icon(t.id, 18) + '<span>' + t.label + '</span>', onclick: () => setTool(t.id)
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
    sub.classList.toggle('hidden', editor.tool !== 'opening');
    if (editor.tool === 'opening') {
      for (const k in CM.OPENINGS) {
        sub.appendChild(el('button', {
          class: 'chip small' + (editor.openingKind === k ? ' active' : ''), 'aria-pressed': editor.openingKind === k ? 'true' : 'false',
          html: U.icon(k, 18) + '<span>' + CM.OPENINGS[k].label + '</span>', onclick: () => { editor.setTool('opening', k); buildTools(); }
        }));
      }
    }
    requestAnimationFrame(() => editor.resize());
  }

  function setTool(id) {
    editor.setTool(id);
    buildTools();
  }

  function openProject(id) {
    const p = S.loadProject(id);
    if (!p) { U.toast('Progetto non trovato'); renderHome(); return; }
    project = p;
    project.settings = Object.assign({ wallT: 0.12, wallH: 2.7, newState: 'esistente', showDims: true, showGrid: true }, project.settings || {});
    show('editor');
    editor.setProject(project);
    editor.setTool('select');
    buildTools();
    updateHeader();
    updateCompass();
    updateSummary();
    renderSheet();
  }

  function goHome() {
    saveNow();
    project = null;
    show('home');
    renderHome();
  }

  function updateHeader() {
    if (!project) return;
    $('projectName').textContent = project.name;
    const t = P.totals(editor.plan);
    $('projectSub').textContent = CM.project.variant(project).name + ' · ' + CM.fmt.area(t.net);
  }

  function updateSummary() {
    const plan = editor.plan;
    const t = P.totals(plan);
    let dem = 0, nuovo = 0;
    for (const id in plan.walls) {
      const w = plan.walls[id];
      if (w.state === 'demolire') dem += P.wallLen(plan, w);
      if (w.state === 'nuovo') nuovo += P.wallLen(plan, w);
    }
    const parts = [
      'Netta <b>' + CM.fmt.area(t.net) + '</b>',
      'Lorda <b>' + CM.fmt.area(t.gross) + '</b>',
      '<b>' + t.rooms + '</b> ' + (t.rooms === 1 ? 'ambiente' : 'ambienti')
    ];
    if (t.outdoor > 0) parts.push('Esterni <b>' + CM.fmt.area(t.outdoor) + '</b>');
    if (dem > 0) parts.push('<span class="dot demolire"></span> <b>' + CM.fmt.m(dem) + '</b>');
    if (nuovo > 0) parts.push('<span class="dot nuovo"></span> <b>' + CM.fmt.m(nuovo) + '</b>');
    $('summary').innerHTML = parts.join(' · ');
  }

  function updateCompass() {
    $('compassNeedle').setAttribute('transform', 'rotate(' + (project.north || 0) + ' 20 20)');
  }

  function updateScale(view) {
    const nice = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
    let L = nice[0];
    for (const n of nice) { if (n * view.s >= 48) { L = n; break; } L = n; }
    const bar = document.querySelector('#scalebar .bar');
    bar.style.width = Math.round(L * view.s) + 'px';
    document.querySelector('#scalebar .lbl').textContent = L < 1 ? Math.round(L * 100) + ' cm' : CM.fmt.num(L, 0) + ' m';
  }

  /* ---------- Pannello proprietà ---------- */
  function sheetHead(kind, name) {
    return el('div', { class: 'sheet-head' }, [
      el('div', { class: 'grow' }, [el('span', { class: 'kind', text: kind }), el('span', { class: 'name', text: name })]),
      el('button', { class: 'icon-btn ghost', 'aria-label': 'Chiudi pannello', html: U.icon('close'), onclick: () => editor.select({}) })
    ]);
  }

  function renderSheet() {
    const sheet = $('sheet');
    if (sheet.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
    const sel = editor.sel;
    const plan = editor.plan;
    sheet.innerHTML = '';
    const has = sel.type && (sel.type === 'node' ? false : true);
    sheet.classList.toggle('hidden', !has);
    $('stage').classList.toggle('with-sheet', !!has);
    $('hint').classList.toggle('hidden', !!has);
    if (!has) { lastRevealed = ''; return; }
    const mut = (fn, reason) => editor.mutate(fn, reason);
    sheet.appendChild(el('div', { class: 'sheet-grab', 'aria-hidden': 'true' }));

    if (sel.type === 'room' && plan.rooms[sel.id]) {
      const room = plan.rooms[sel.id];
      const st = P.roomStats(plan, room);
      const rect = P.rectInfo(plan, room);
      sheet.appendChild(sheetHead('Stanza', room.name));
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
      sheet.appendChild(el('div', { class: 'stats' }, [
        U.stat('Superficie netta', CM.fmt.area(st.net)),
        U.stat('Lorda (asse muri)', CM.fmt.area(st.gross)),
        U.stat('Perimetro', CM.fmt.m(st.perimeter)),
        U.stat('Volume', CM.fmt.num(st.net * (room.h || 2.7), 1) + ' m³')
      ]));
      // stato dei muri della stanza
      const roomWalls = Object.keys(plan.walls).filter(id => {
        const w = plan.walls[id];
        const A = plan.nodes[w.a], B = plan.nodes[w.b];
        return [A, B, { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }].every(p => P.pointOnRoomBoundary(plan, room, p));
      });
      const states = new Set(roomWalls.map(id => plan.walls[id].state));
      const common = states.size === 1 ? [...states][0] : null;
      const f2 = el('div', { class: 'fields' });
      f2.appendChild(U.segField('Tutti i muri della stanza', Object.keys(CM.WALL_STATES).map(k => ({ value: k, label: CM.WALL_STATES[k].label, dot: k })), common, v => mut(pl => { roomWalls.forEach(id => { if (pl.walls[id]) pl.walls[id].state = v; }); }, 'state')));
      sheet.appendChild(f2);
      sheet.appendChild(el('div', { class: 'actions' }, [
        el('button', { class: 'btn danger', html: U.icon('trash', 18) + 'Elimina stanza', onclick: () => { editor.deleteSelection(); U.toast('Stanza eliminata · puoi annullare'); } })
      ]));
    } else if (sel.type === 'wall' && plan.walls[sel.id]) {
      const w = plan.walls[sel.id];
      const L = P.wallLen(plan, w);
      sheet.appendChild(sheetHead('Muro', CM.fmt.m(L)));
      const fields = el('div', { class: 'fields' });
      fields.appendChild(U.numField('Lunghezza', L, 'm', v => mut(pl => P.setWallLength(pl, sel.id, v)), { min: 0.1, max: 100 }));
      fields.appendChild(U.numField('Spessore', w.t, 'cm', v => mut(pl => { pl.walls[sel.id].t = v; }), { min: 0.03, max: 1.2 }));
      fields.appendChild(U.numField('Altezza', w.h || 2.7, 'cm', v => mut(pl => { pl.walls[sel.id].h = v; }), { min: 0.3, max: 8 }));
      fields.appendChild(U.segField('Stato', Object.keys(CM.WALL_STATES).map(k => ({ value: k, label: CM.WALL_STATES[k].label, dot: k })), w.state, v => mut(pl => { pl.walls[sel.id].state = v; }, 'state')));
      sheet.appendChild(fields);
      const ops = Object.keys(plan.openings).filter(o => plan.openings[o].wall === sel.id).length;
      sheet.appendChild(el('div', { class: 'stats' }, [
        U.stat('Superficie parete', CM.fmt.area(L * (w.h || 2.7))),
        U.stat('Aperture', String(ops))
      ]));
      sheet.appendChild(el('div', { class: 'actions' }, [
        el('button', { class: 'btn danger', html: U.icon('trash', 18) + 'Elimina muro', onclick: () => editor.deleteSelection() })
      ]));
    } else if (sel.type === 'opening' && plan.openings[sel.id]) {
      const op = plan.openings[sel.id];
      const def = CM.OPENINGS[op.kind];
      sheet.appendChild(sheetHead('Apertura', def.label));
      const fields = el('div', { class: 'fields' });
      fields.appendChild(U.selectField('Tipo', Object.keys(CM.OPENINGS).map(k => ({ value: k, label: CM.OPENINGS[k].label })), op.kind, v => mut(pl => {
        const o = pl.openings[sel.id], d = CM.OPENINGS[v];
        o.kind = v; o.h = d.h; o.sill = d.sill;
      }, 'kind')));
      fields.appendChild(U.numField('Larghezza', op.w, 'cm', v => mut(pl => { pl.openings[sel.id].w = v; }), { min: 0.2, max: 8 }));
      fields.appendChild(U.numField('Altezza', op.h, 'cm', v => mut(pl => { pl.openings[sel.id].h = v; }), { min: 0.2, max: 6 }));
      if (op.kind === 'finestra') fields.appendChild(U.numField('Davanzale da terra', op.sill || 0, 'cm', v => mut(pl => { pl.openings[sel.id].sill = v; }), { min: 0, max: 3 }));
      fields.appendChild(U.numField('Distanza dall’angolo', Math.max(0, op.pos - op.w / 2), 'cm', v => mut(pl => { const o = pl.openings[sel.id]; o.pos = v + o.w / 2; }), { min: 0, max: 100 }));
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
    } else {
      sheet.classList.add('hidden');
      $('stage').classList.remove('with-sheet');
      $('hint').classList.remove('hidden');
    }
    const key = sel.type + ':' + sel.id;
    requestAnimationFrame(() => {
      editor.resize();
      if (key === lastRevealed) return;
      lastRevealed = key;
      const st = $('stage').getBoundingClientRect(), sh = sheet.getBoundingClientRect();
      const side = sh.left > st.left + 10;
      // lascia libera la colonna di bussola e zoom a destra
      editor.reveal(sel, side ? { x: 0, y: 0, w: sh.left - st.left - 72, h: st.height } : { x: 0, y: 0, w: st.width - 72, h: sh.top - st.top });
    });
  }
  let lastRevealed = '';

  /* ---------- Menu, bussola, impostazioni ---------- */
  async function moreMenu() {
    const s = project.settings;
    const choice = await U.menu('Opzioni', [
      { id: 'dims', label: 'Quote dei muri', icon: 'ruler', toggle: !!s.showDims },
      { id: 'grid', label: 'Griglia', icon: 'grid', toggle: s.showGrid !== false },
      { id: 'thick', label: 'Spessore dei nuovi muri', icon: 'thick', right: Math.round(s.wallT * 100) + ' cm' },
      { id: 'height', label: 'Altezza dei soffitti', icon: 'height', right: Math.round(s.wallH * 100) + ' cm' },
      { id: 'fit', label: 'Adatta alla vista', icon: 'fit' },
      { id: 'rename', label: 'Rinomina progetto', icon: 'rename' },
      { id: 'help', label: 'Guida rapida', icon: 'help' },
      { id: 'delete', label: 'Elimina progetto', icon: 'trash', danger: true }
    ]);
    if (choice === 'dims') { s.showDims = !s.showDims; scheduleSave(); editor.draw(); }
    if (choice === 'grid') { s.showGrid = s.showGrid === false; scheduleSave(); editor.draw(); }
    if (choice === 'fit') editor.fit();
    if (choice === 'help') U.tutorial();
    if (choice === 'thick') {
      const v = await U.promptDialog('Spessore dei nuovi muri', String(Math.round(s.wallT * 100)), { label: 'Spessore', unit: 'cm', inputmode: 'decimal', mono: true, text: 'Vale per i muri che disegnerai da ora. Per un muro esistente toccalo e cambia lo spessore nel pannello.' });
      const m = CM.fmt.parseM(v, 'cm');
      if (v != null) { if (m >= 0.03 && m <= 1.2) { s.wallT = m; scheduleSave(); } else U.toast('Valore non valido'); }
    }
    if (choice === 'height') {
      const v = await U.promptDialog('Altezza dei soffitti', String(Math.round(s.wallH * 100)), { label: 'Altezza', unit: 'cm', inputmode: 'decimal', mono: true, text: 'Vale per le stanze e i muri che disegnerai da ora.' });
      const m = CM.fmt.parseM(v, 'cm');
      if (v != null) { if (m >= 1.5 && m <= 8) { s.wallH = m; scheduleSave(); } else U.toast('Valore non valido'); }
    }
    if (choice === 'rename') renameProject();
    if (choice === 'delete') {
      const ok = await U.confirmDialog('Eliminare il progetto?', '“' + project.name + '” verrà cancellato dal telefono. L’operazione non si può annullare.', 'Elimina', true);
      if (ok) { const id = project.id; clearTimeout(saveTimer); project = null; S.deleteProject(id); show('home'); renderHome(); U.toast('Progetto eliminato'); }
    }
  }

  async function renameProject() {
    const name = await U.promptDialog('Rinomina progetto', project.name, { label: 'Nome' });
    if (name && name.trim()) { project.name = name.trim(); project.updated = Date.now(); scheduleSave(); updateHeader(); }
  }

  function compassDialog() {
    let val = project.north || 0;
    const needle = el('div', { html: '<svg width="96" height="96" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="#FBFBF9" stroke="#E3E1DB"/><g class="nd"><path d="M20 5l5 15h-10z" fill="#D23B2A"/><path d="M20 35l-5-15h10z" fill="#C9C6BE"/></g></svg>', style: 'display:flex;justify-content:center;margin:10px 0' });
    const g = () => needle.querySelector('.nd');
    const label = el('span', { class: 'val', text: val + '°' });
    const range = el('input', { type: 'range', min: '0', max: '359', value: String(val), 'aria-label': 'Direzione del nord in gradi' });
    const sync = () => { label.textContent = val + '°'; g().setAttribute('transform', 'rotate(' + val + ' 20 20)'); };
    range.addEventListener('input', () => { val = +range.value; sync(); });
    setTimeout(sync, 0);
    const body = el('div', {}, [needle, el('div', { class: 'range-row' }, [range, label])]);
    U.dialog({
      title: 'Dov’è il nord?',
      text: 'Ruota la freccia rossa verso il nord rispetto alla pianta. Servirà per simulare la luce del sole nella vista 3D.',
      body,
      actions: [{ label: 'Annulla', value: null }, { label: 'Salva', value: () => val, primary: true }]
    }).then(v => {
      if (v == null) return;
      project.north = v; project.updated = Date.now();
      updateCompass(); scheduleSave();
    });
  }

  const SOON = {
    '3d': 'La vista 3D con passeggiata arriva in una prossima tappa',
    arredo: 'Arredo e cataloghi arrivano in una prossima tappa',
    costi: 'Costi, budget e varianti arrivano in una prossima tappa',
    lavori: 'Acquisti e cantiere arrivano in una prossima tappa'
  };

  /* ---------- Salvataggio ---------- */
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 500);
  }
  function saveNow() {
    clearTimeout(saveTimer);
    if (!project) return;
    if (!S.saveProject(project)) U.toast('Salvataggio non riuscito: memoria piena?');
  }

  /* ---------- Indietro ---------- */
  CM.onBack = function () {
    if (U.overlayOpen()) { U.closeOverlay(); return true; }
    if (!$('editor').classList.contains('hidden')) {
      if (editor.chain) { editor.finishChain(); return true; }
      if (editor.sel.type) { editor.select({}); return true; }
      if (editor.tool !== 'select') { setTool('select'); return true; }
      goHome();
      return true;
    }
    return false;
  };
  CM.flush = saveNow;
  // Accesso per i test automatici
  CM._debug = { editor: () => editor, project: () => project };

  /* ================= AVVIO ================= */
  function init() {
    editor = new CM.Editor($('planCanvas'), {
      onChange: () => { scheduleSave(); updateSummary(); updateHeader(); renderSheet(); },
      onSelect: () => renderSheet(),
      onHint: (text, actions) => {
        $('hintText').textContent = text;
        const box = $('hintActions');
        box.innerHTML = '';
        if (actions.includes('undoPoint')) box.appendChild(el('button', { text: 'Annulla punto', onclick: () => editor.undoPoint() }));
        if (actions.includes('finish')) box.appendChild(el('button', { class: 'primary', text: 'Fine', onclick: () => editor.finishChain() }));
      },
      onHistory: (u, r) => { $('undoBtn').disabled = !u; $('redoBtn').disabled = !r; },
      onToast: (t) => U.toast(t),
      onDraw: (view) => updateScale(view)
    });

    $('newProject').addEventListener('click', newProject);
    $('openSample').addEventListener('click', openSample);
    $('loadPlan').addEventListener('click', () => U.toast('Caricare una planimetria (foto, immagine o PDF) arriva nella prossima tappa'));
    $('homeMenu').addEventListener('click', async () => {
      const c = await U.menu('Casa Mia', [
        { id: 'help', label: 'Guida rapida', icon: 'help' },
        { id: 'sample', label: 'Ricrea il progetto d’esempio', icon: 'copy' }
      ]);
      if (c === 'help') U.tutorial();
      if (c === 'sample') { const p = CM.sample.create(); S.saveProject(p); renderHome(); U.toast('Esempio aggiunto'); }
    });
    $('backHome').addEventListener('click', goHome);
    $('projectTitle').addEventListener('click', renameProject);
    $('undoBtn').addEventListener('click', () => editor.undo());
    $('redoBtn').addEventListener('click', () => editor.redo());
    $('moreBtn').addEventListener('click', moreMenu);
    $('compass').addEventListener('click', compassDialog);
    $('zoomIn').addEventListener('click', () => editor.zoomBy(1.4));
    $('zoomOut').addEventListener('click', () => editor.zoomBy(1 / 1.4));
    $('zoomFit').addEventListener('click', () => editor.fit());
    document.querySelectorAll('.tab').forEach(t => {
      if (t.dataset.tab !== 'pianta') t.classList.add('soon');
      t.addEventListener('click', () => { if (SOON[t.dataset.tab]) U.toast(SOON[t.dataset.tab]); });
    });

    const ro = new ResizeObserver(() => editor.resize());
    ro.observe($('stage'));
    window.addEventListener('resize', () => { editor.resize(); renderSheet(); });

    // Scorciatoie da tastiera (utili su tablet con tastiera e per i test)
    document.addEventListener('keydown', (e) => {
      if ($('editor').classList.contains('hidden') || U.overlayOpen()) return;
      if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? editor.redo() : editor.undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); editor.redo(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') editor.deleteSelection();
      else if (e.key === 'Escape') CM.onBack();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

    // Autotest del modello sul dispositivo
    const errs = CM.selfTest();
    if (errs.length) console.error('CASAMIA_SELFTEST_FAIL ' + errs.join('; '));
    else console.log('CASAMIA_SELFTEST_OK');

    const first = !S.pref('avviato');
    if (first) {
      S.saveProject(CM.sample.create());
      S.pref('avviato', Date.now());
    }
    renderHome();
    show('home');
    if (first) setTimeout(() => U.tutorial(() => S.pref('guidaVista', true)), 300);
    console.log('CASAMIA_READY ' + (S.isNative ? 'android' : 'browser'));
    setTimeout(() => {
      const r = $('home').getBoundingClientRect();
      console.log('CASAMIA_LAYOUT ' + JSON.stringify({
        win: [innerWidth, innerHeight], dpr: devicePixelRatio, home: [Math.round(r.width), Math.round(r.height)],
        cards: document.querySelectorAll('.project-card').length, overlay: !$('overlay').classList.contains('hidden'),
        ua: navigator.userAgent.replace(/^.*(Chrome\/[\d.]+).*$/, '$1')
      }));
    }, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
