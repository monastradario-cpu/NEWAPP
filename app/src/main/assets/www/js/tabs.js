/* Casa Mia — schede Arredo, Costi e Lavori, dialoghi di catalogo e diario */
(function (root) {
  'use strict';
  const CM = root.CM;
  const P = CM.plan;
  const T = CM.tabs = {};
  const U = () => CM.ui;
  const el = (...a) => CM.ui.el(...a);
  const app = () => CM.app;
  const fmtDate = (ts) => ts ? new Date(ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const toInputDate = (ts) => { if (!ts) return ''; const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const fromInputDate = (s) => s ? new Date(s + 'T09:00:00').getTime() : null;

  function section(title, right) { return el('div', { class: 'tab-sec' }, [el('h2', { text: title }), right || null]); }
  function card(children, cls) { return el('div', { class: 'card' + (cls ? ' ' + cls : '') }, children); }

  /* ---------- Anteprima di un articolo ---------- */
  function itemThumb(it, size) {
    size = size || 64;
    if (it.img) return el('img', { class: 'thumb', src: it.img, alt: '', loading: 'lazy', style: 'width:' + size + 'px;height:' + size + 'px' });
    const c = el('canvas', { class: 'thumb', 'aria-hidden': 'true', style: 'width:' + size + 'px;height:' + size + 'px' });
    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr; c.height = size * dpr;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#FBFBF9'; ctx.fillRect(0, 0, size, size);
    if (it.type) { // materiale
      ctx.fillStyle = it.color || '#ccc'; ctx.fillRect(8, 8, size - 16, size - 16);
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.strokeRect(8.5, 8.5, size - 17, size - 17);
      if (it.type === 'piastrella' || it.type === 'parquet') { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.moveTo(size / 2, 8); ctx.lineTo(size / 2, size - 8); ctx.moveTo(8, size / 2); ctx.lineTo(size - 8, size / 2); ctx.stroke(); }
      return c;
    }
    const k = (size - 14) / Math.max(it.w || 1, it.d || 1);
    ctx.translate(size / 2, size / 2); ctx.scale(k, k);
    ctx.fillStyle = CM.render2.hexAlpha(it.color, 0.55); ctx.strokeStyle = '#4A4F57';
    CM.render2.symbol(ctx, { shape: it.shape || 'box', w: it.w || 1, d: it.d || 1 }, 1.2 / k);
    return c;
  }
  T.itemThumb = itemThumb;

  /* ================= ARREDO ================= */
  const arredoState = { cat: 'tutti', q: '' };
  function itemsFor(state) {
    const q = state.q.trim().toLowerCase();
    let list = state.cat === 'materiali' ? CM.lib.materials()
      : state.cat === 'miei' ? CM.lib.catalog().filter(i => !i.base).concat(CM.lib.materials().filter(m => !CM.MATERIALS_BASE.includes(m)))
      : CM.lib.catalog().concat(CM.lib.materials());
    if (!['tutti', 'miei', 'materiali'].includes(state.cat)) list = list.filter(i => i.cat === state.cat);
    if (q) list = list.filter(i => (i.name + ' ' + (i.store || '') + ' ' + CM.categoryLabel(i.cat)).toLowerCase().includes(q));
    return list;
  }

  function itemRow(it, onPick) {
    const isMat = !!it.type;
    const dims = isMat
      ? (it.type === 'pittura' ? (it.code || 'Pittura') + ' · resa ' + it.resa + ' m²/L' : it.type === 'carta' ? 'Rotolo ' + CM.fmt.num(it.rollW, 2) + '×' + CM.fmt.num(it.rollL, 2) + ' m' : it.tw ? Math.round(it.tw * 100) + '×' + Math.round(it.th * 100) + ' cm' + (it.boxM2 ? ' · ' + CM.fmt.num(it.boxM2, 2) + ' m²/scatola' : '') : 'Al m²')
      : Math.round(it.w * 100) + '×' + Math.round(it.d * 100) + '×' + Math.round(it.h * 100) + ' cm';
    const price = it.price != null && it.price !== '' ? CM.fmt.num(+it.price, it.price % 1 ? 2 : 0) + ' €' + (isMat ? (it.type === 'pittura' ? '/L' : it.type === 'carta' ? '/rotolo' : '/m²') : '') : 'Prezzo da inserire';
    const body = el('div', { class: 'ir-body' }, [
      el('div', { class: 'ir-name', text: it.name }),
      el('div', { class: 'ir-meta', text: dims }),
      el('div', { class: 'ir-meta' }, [price, it.store ? el('span', { class: 'store-tag', text: it.store }) : null])
    ]);
    const actions = [];
    if (onPick) actions.push(el('button', { class: 'btn small primary', text: 'Scegli', onclick: () => onPick(it) }));
    else if (!isMat) actions.push(el('button', { class: 'btn small primary', text: 'In pianta', onclick: () => app().placeItem(it) }));
    if (!onPick) actions.push(el('button', { class: 'icon-btn ghost', 'aria-label': 'Modifica ' + it.name, html: U().icon('rename', 18), onclick: async () => {
      if (isMat) { await T.editMaterial(it, it.type); } else { await T.editItem(it); }
      app().refreshTab();
    } }));
    return el('div', { class: 'item-row' }, [itemThumb(it, 56), body, el('div', { class: 'ir-actions' }, actions)]);
  }

  function catalogBrowser(container, state, onPick) {
    const search = el('input', { type: 'search', class: 'search', placeholder: 'Cerca: divano, gres, frigorifero…', value: state.q, 'aria-label': 'Cerca nel catalogo' });
    const chips = el('div', { class: 'chips-row' });
    const list = el('div', { class: 'item-list' });
    const cats = [{ id: 'tutti', label: 'Tutto' }, { id: 'miei', label: 'I miei articoli' }].concat(CM.CATEGORIES);
    const renderChips = () => {
      chips.innerHTML = '';
      for (const c of cats) chips.appendChild(el('button', { class: 'chip small' + (state.cat === c.id ? ' active' : ''), text: c.label, onclick: () => { state.cat = c.id; renderChips(); renderList(); } }));
    };
    const renderList = () => {
      list.innerHTML = '';
      const items = itemsFor(state);
      if (!items.length) list.appendChild(el('div', { class: 'empty', text: state.cat === 'miei' ? 'Qui trovi gli articoli importati dai negozi e quelli creati da te.' : 'Nessun articolo trovato.' }));
      items.slice(0, 200).forEach(it => list.appendChild(itemRow(it, onPick)));
    };
    search.addEventListener('input', () => { state.q = search.value; renderList(); });
    renderChips(); renderList();
    container.append(search, chips, list);
  }

  T.renderArredo = function (box) {
    const project = app().project();
    const plan = CM.project.plan(project);
    box.innerHTML = '';
    box.appendChild(el('div', { class: 'tab-head' }, [
      el('h1', { text: 'Arredo e materiali' }),
      el('div', { class: 'actions', style: 'margin:0' }, [
        el('button', { class: 'btn primary', html: U().icon('opening', 18) + 'Importa da negozio', onclick: () => CM.shop.open() }),
        el('button', { class: 'btn', html: U().icon('arredo', 18) + 'Componi armadio o cucina', onclick: () => CM.config.open(null, f => { const it = Object.assign({ id: CM.uid('c') }, f); CM.lib.saveItem(it); app().placeItem(it); U().toast('Tocca dove metterla: vicino a un muro si appoggia da sola'); }) }),
        el('button', { class: 'btn', text: 'Nuovo articolo', onclick: async () => {
          const c = await U().menu('Nuovo articolo', [{ id: 'mobile', label: 'Mobile o oggetto', icon: 'room' }, { id: 'piastrella', label: 'Piastrella o pavimento', icon: 'grid' }, { id: 'pittura', label: 'Pittura', icon: 'rename' }, { id: 'carta', label: 'Carta da parati', icon: 'beam' }]);
          if (c === 'mobile') {
            const it = await T.editItem(null);
            if (it && app().project()) {
              const go = await U().confirmDialog('Articolo salvato', 'Per vederlo in pianta e nel 3D va messo nella casa: lo metto ora?', 'Metti in pianta');
              if (go) { app().placeItem(it); return; }
            }
          } else if (c) await T.editMaterial(null, c);
          app().refreshTab();
        } })
      ])
    ]));
    // mobili nel progetto
    const placed = Object.keys(plan.furniture);
    if (placed.length) {
      const warns = CM.checks.furniture(plan);
      const nWarn = Object.keys(warns).length;
      const tot = placed.reduce((s, id) => s + (+plan.furniture[id].price || 0), 0);
      const list = el('div', { class: 'placed-list' }, placed.map(id => {
        const f = plan.furniture[id];
        return el('button', { class: 'placed' + (warns[id] ? ' bad' : ''), onclick: () => app().focus({ type: 'furniture', id }) }, [
          itemThumb(f, 40), el('span', { text: f.name }), warns[id] ? el('span', { class: 'badge-warn', text: '!' }) : null
        ]);
      }));
      box.appendChild(card([
        el('div', { class: 'card-row' }, [el('b', { text: placed.length + ' arredi nel progetto' }), el('span', { class: 'mono', text: CM.fmt.eur(tot) })]),
        nWarn ? el('div', { class: 'warn-box', text: nWarn + ' arredi con avvisi (sovrapposti, passaggi stretti o porte bloccate): toccali per vederli in pianta.' }) : null,
        list
      ]));
    }
    catalogBrowser(box, arredoState);
  };

  T.pickItem = function () {
    return new Promise(resolve => {
      const state = { cat: arredoState.cat === 'materiali' ? 'tutti' : arredoState.cat, q: '' };
      const body = el('div', { class: 'picker' });
      let done = false;
      catalogBrowser(body, state, (it) => {
        if (it.type) { U().toast('I materiali si scelgono dalle finiture della stanza'); return; }
        done = true; U().closeOverlay(it);
      });
      const box = el('div', { class: 'dialog tall', role: 'dialog', 'aria-label': 'Scegli un arredo' }, [
        el('div', { class: 'sheet-head' }, [el('div', { class: 'grow' }, [el('span', { class: 'name', text: 'Scegli un arredo' })]), el('button', { class: 'icon-btn ghost', 'aria-label': 'Chiudi', html: U().icon('close'), onclick: () => U().closeOverlay(null) })]),
        body
      ]);
      CM.ui.openOverlay(box, (r) => resolve(done ? r : (r || null)));
    });
  };

  /* ---------- Editor articolo / materiale ---------- */
  function formDialog(title, fields, extraActions) {
    return CM.ui.dialog({ title, body: el('div', { class: 'fields' }, fields), actions: (extraActions || []).concat([{ label: 'Annulla', value: false }, { label: 'Salva', value: true, primary: true }]) });
  }

  const SHAPES = [['box', 'Generico'], ['sofa', 'Divano'], ['armchair', 'Poltrona'], ['bed', 'Letto'], ['table', 'Tavolo'], ['round_table', 'Tavolo rotondo'], ['chair', 'Sedia'], ['wardrobe', 'Armadio'], ['cabinet', 'Mobile basso'], ['kitchen_base', 'Base cucina'], ['kitchen_wall', 'Pensile'], ['kitchen_tall', 'Colonna'], ['sink', 'Lavello'], ['hob', 'Piano cottura'], ['fridge', 'Frigorifero'], ['washer', 'Lavatrice'], ['tv', 'TV'], ['shelf', 'Libreria'], ['desk', 'Scrivania'], ['wc', 'WC'], ['basin', 'Lavabo'], ['shower', 'Doccia'], ['bath', 'Vasca'], ['rug', 'Tappeto'], ['plant', 'Pianta'], ['lamp_floor', 'Lampada da terra'], ['lamp_ceiling', 'Lampadario'], ['curtain', 'Tenda'], ['mirror', 'Specchio'], ['picture', 'Quadro'], ['tree', 'Albero'], ['umbrella', 'Ombrellone'], ['pergola', 'Pergola'], ['car', 'Auto'], ['lounger', 'Sdraio']];

  T.editItem = async function (it) {
    const isNew = !it;
    const base = it && it.base;
    const d = Object.assign({ id: CM.uid('c'), name: '', cat: 'soggiorno', shape: 'box', w: 1, d: 0.6, h: 0.8, elev: 0, color: '#D9D4CB', price: null, store: '', url: '' }, it || {});
    if (base) { d.id = CM.uid('c'); d.base = false; }
    const v = Object.assign({}, d);
    const fields = [
      U().textField('Nome', v.name, x => { v.name = x; }),
      U().selectField('Categoria', CM.CATEGORIES.filter(c => !CM.MATERIAL_CATS.includes(c.id)).map(c => ({ value: c.id, label: c.label })), v.cat, x => { v.cat = x; }, { full: false }),
      U().selectField('Forma', SHAPES.map(([value, label]) => ({ value, label })), v.shape, x => { v.shape = x; v.light = /^lamp/.test(x); }, { full: false }),
      U().numField('Larghezza', v.w, 'cm', x => { v.w = x; }, { min: 0.02, max: 20 }),
      U().numField('Profondità', v.d, 'cm', x => { v.d = x; }, { min: 0.01, max: 20 }),
      U().numField('Altezza', v.h, 'cm', x => { v.h = x; }, { min: 0.01, max: 8 }),
      U().numField('Da terra', v.elev || 0, 'cm', x => { v.elev = x; }, { min: 0, max: 5 }),
      CM.sheets.colorField('Colore', v.color, x => { v.color = x; }),
      CM.sheets.moneyField('Prezzo', v.price, x => { v.price = x; }),
      U().textField('Negozio', v.store || '', x => { v.store = x; }, { full: false }),
      U().textField('Link al prodotto', v.url || '', x => { v.url = x; })
    ];
    if (CM.isPC && CM.isPC()) {
      const holder = el('div', { class: 'field full' });
      const draw = () => { holder.innerHTML = ''; holder.append(el('label', { text: 'Foto del mobile' }), CM.sheets.photoField(v.img, d => { v.img = d; draw(); })); };
      draw();
      fields.push(holder);
    }
    const extra = !isNew && !base ? [{ label: 'Elimina', value: 'delete', danger: true }] : [];
    const r = await formDialog(isNew ? 'Nuovo mobile' : base ? 'Personalizza ' + d.name : 'Modifica articolo', fields, extra);
    if (r === 'delete') { CM.lib.removeItem(d.id); U().toast('Articolo eliminato'); return null; }
    if (!r) return null;
    if (!v.name.trim()) v.name = 'Articolo';
    delete v.base;
    if (v.img && /^https?:/i.test(v.img) && CM.localImage) { U().toast('Salvo la foto\u2026'); const d = await CM.localImage(v.img, 480); if (d) v.img = d; }
    CM.lib.saveItem(v);
    U().toast(base ? 'Salvato tra i tuoi articoli' : 'Articolo salvato');
    return v;
  };

  T.editMaterial = async function (m, type) {
    const isNew = !m;
    const base = m && CM.MATERIALS_BASE.includes(m);
    type = (m && m.type) || type || 'piastrella';
    const defs = {
      piastrella: { cat: 'pavimenti', tw: 0.6, th: 0.6, boxM2: 1.44, price: 25, color: '#C9C6C0', tex: 'tile' },
      parquet: { cat: 'pavimenti', tw: 0.15, th: 1.2, boxM2: 1.6, price: 40, color: '#C49A6C', tex: 'wood' },
      resina: { cat: 'pavimenti', price: 70, color: '#C9C6C0', tex: 'plain' },
      pittura: { cat: 'pitture', color: '#EDEBE6', code: '', resa: 10, canL: 5, price: 8 },
      carta: { cat: 'pitture', rollW: 0.53, rollL: 10.05, repeat: 0.53, price: 35, color: '#DCD3C2', tex: 'stripes' }
    };
    const v = Object.assign({ id: CM.uid('m'), type, name: '' }, defs[type], m || {});
    if (base) v.id = CM.uid('m');
    const fields = [U().textField('Nome', v.name, x => { v.name = x; })];
    if (isNew) fields.push(U().selectField('Tipo', [{ value: 'piastrella', label: 'Piastrella' }, { value: 'parquet', label: 'Parquet / laminato' }, { value: 'resina', label: 'Resina / continuo' }, { value: 'pittura', label: 'Pittura' }, { value: 'carta', label: 'Carta da parati' }], v.type, x => { v.type = x; Object.assign(v, defs[x], { name: v.name, id: v.id, type: x }); }));
    if (['piastrella', 'parquet'].includes(type)) {
      fields.push(U().numField('Formato: lato A', v.tw, 'cm', x => { v.tw = x; }, { min: 0.01, max: 4 }));
      fields.push(U().numField('Formato: lato B', v.th, 'cm', x => { v.th = x; }, { min: 0.01, max: 4 }));
      fields.push(U().numField('m² per scatola', v.boxM2, 'm²', x => { v.boxM2 = x; }, { min: 0.05, max: 10 }));
      fields.push(CM.sheets.moneyField('Prezzo', v.price, x => { v.price = x; }, { unit: '€/m²' }));
    } else if (type === 'resina') {
      fields.push(CM.sheets.moneyField('Prezzo posato', v.price, x => { v.price = x; }, { unit: '€/m²' }));
    } else if (type === 'pittura') {
      fields.push(U().textField('Codice colore', v.code || '', x => { v.code = x; }, { full: false }));
      fields.push(U().numField('Resa per mano', v.resa, 'm²/L', x => { v.resa = x; }, { min: 1, max: 30 }));
      fields.push(U().numField('Latta', v.canL, 'L', x => { v.canL = x; }, { min: 0.25, max: 30 }));
      fields.push(CM.sheets.moneyField('Prezzo', v.price, x => { v.price = x; }, { unit: '€/L' }));
    } else if (type === 'carta') {
      fields.push(U().numField('Larghezza rotolo', v.rollW, 'cm', x => { v.rollW = x; }, { min: 0.1, max: 2 }));
      fields.push(U().numField('Lunghezza rotolo', v.rollL, 'm', x => { v.rollL = x; }, { min: 1, max: 50 }));
      fields.push(U().numField('Rapporto motivo', v.repeat || 0, 'cm', x => { v.repeat = x; }, { min: 0, max: 2 }));
      fields.push(CM.sheets.moneyField('Prezzo', v.price, x => { v.price = x; }, { unit: '€/rotolo' }));
    }
    fields.push(CM.sheets.colorField('Colore', v.color, x => { v.color = x; }));
    fields.push(U().textField('Negozio', v.store || '', x => { v.store = x; }, { full: false }));
    const extra = !isNew && !base ? [{ label: 'Elimina', value: 'delete', danger: true }] : [];
    const r = await formDialog(isNew ? 'Nuovo materiale' : base ? 'Personalizza ' + m.name : 'Modifica materiale', fields, extra);
    if (r === 'delete') { CM.lib.removeMaterial(v.id); U().toast('Materiale eliminato'); return null; }
    if (!r) return null;
    if (!v.name.trim()) v.name = 'Materiale';
    if (v.img && /^https?:/i.test(v.img) && CM.localImage) { U().toast('Salvo la foto\u2026'); const d = await CM.localImage(v.img, 1024); if (d) v.img = d; }
    CM.lib.saveMaterial(v);
    U().toast('Materiale salvato');
    return v;
  };

  /* ================= COSTI ================= */
  const openGroups = {};
  T.renderCosti = function (box) {
    const project = app().project();
    const c = CM.costs.compute(project);
    const plan = CM.project.plan(project);
    const budget = (project.budget && project.budget.total) || 0;
    box.innerHTML = '';
    box.appendChild(el('div', { class: 'tab-head' }, [
      el('h1', { text: 'Costi' }),
      el('div', { class: 'actions', style: 'margin:0' }, [
        el('button', { class: 'btn', text: 'Prezzi di riferimento', onclick: () => T.pricesDialog() }),
        el('button', { class: 'btn', text: 'Computo Excel per le ditte', onclick: () => CM.fiscal.exportComputo(project) }),
        el('button', { class: 'btn', text: 'Esporta PDF', onclick: () => CM.share.pdf(project) })
      ])
    ]));
    // riepilogo e budget
    const pct = budget > 0 ? Math.min(100, c.total / budget * 100) : 0;
    const over = budget > 0 && c.total > budget;
    const hasQuotes = Object.keys(c.chosen).length > 0;
    box.appendChild(card([
      el('div', { class: 'big-num', text: CM.fmt.eur(c.total) }),
      el('div', { class: 'muted', text: 'Stima per la variante “' + CM.project.variant(project).name + '”' + (c.noPrice ? ' · ' + c.noPrice + ' arredi senza prezzo' : '') }),
      hasQuotes ? el('div', { class: 'card-row', style: 'margin-top:8px' }, [el('span', { text: 'Con i preventivi scelti' }), el('b', { class: 'mono', text: CM.fmt.eur(c.withQuotes) })]) : null,
      el('div', { class: 'card-row', style: 'margin-top:12px' }, [
        el('span', { text: budget ? 'Budget ' + CM.fmt.eur(budget) : 'Nessun budget impostato' }),
        el('button', { class: 'btn small', text: budget ? 'Modifica' : 'Imposta budget', onclick: async () => {
          const v = await U().promptDialog('Budget totale', budget ? String(budget) : '', { label: 'Budget', unit: '€', inputmode: 'decimal', mono: true });
          if (v == null) return;
          const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
          project.budget.total = isFinite(n) && n > 0 ? n : 0; app().save(); app().refreshTab();
        } })
      ]),
      budget ? el('div', { class: 'bar' + (over ? ' over' : '') }, [el('i', { style: 'width:' + pct + '%' })]) : null,
      over ? el('div', { class: 'warn-box', text: 'Superi il budget di ' + CM.fmt.eur(c.total - budget) + '.' }) : null,
      c.total > 0 ? el('div', { class: 'split' }, [
        el('div', { class: 'split-bar' }, [el('i', { class: 'mat', style: 'width:' + (c.mat / c.total * 100) + '%' }), el('i', { class: 'lab', style: 'width:' + (c.lab / c.total * 100) + '%' })]),
        el('div', { class: 'card-row small' }, [el('span', { html: '<span class="dot mat"></span>Materiali ' + CM.fmt.eur(c.mat) }), el('span', { html: '<span class="dot lab"></span>Manodopera ' + CM.fmt.eur(c.lab) })])
      ]) : null
    ]));
    // IVA e detrazioni
    if (c.total > 0) box.appendChild(CM.fiscal.card(project, () => app().refreshTab()));
    // superfici
    const sf = P.surfaceTotals(plan);
    if (sf.rooms) box.appendChild(card([
      el('div', { class: 'gh-name', text: 'Superfici della casa' }),
      el('div', { class: 'stats' }, [
        U().stat('Pavimenti', CM.fmt.area(sf.floors)), U().stat('Pareti nette', CM.fmt.area(sf.wallsNet)),
        U().stat('Pareti lorde', CM.fmt.area(sf.wallsGross)), U().stat('Soffitti', CM.fmt.area(sf.ceilings)),
        U().stat('Pareti + soffitti', CM.fmt.area(sf.wallsNet + sf.ceilings))
      ]),
      el('div', { class: 'muted small', text: 'Utili per i preventivi: imbiancatura (pareti + soffitti), rasature, pavimenti.' })
    ]));
    // voci
    box.appendChild(section('Per voce'));
    if (!c.lines.length) box.appendChild(el('div', { class: 'empty', text: 'Segna i muri da demolire o costruire, le aperture nuove, gli impianti, le finiture delle stanze e i prezzi degli arredi: qui comparirà la stima.' }));
    for (const g of CM.costs.GROUPS) {
      const gr = c.groups[g];
      if (!gr) continue;
      const open = !!openGroups[g];
      const lines = open ? el('div', { class: 'lines' }, gr.lines.map(l => el('div', { class: 'line' }, [
        el('div', { class: 'l-main' }, [el('span', { text: l.label }), el('span', { class: 'muted small', text: CM.fmt.num(l.qty, l.unit === 'cad' || l.unit === 'rotoli' ? 0 : 1) + ' ' + l.unit + (l.room && plan.rooms[l.room] ? ' · ' + plan.rooms[l.room].name : '') + (l.detail ? ' · ' + l.detail : '') })]),
        el('span', { class: 'mono', text: CM.fmt.eur(l.total) })
      ]))) : null;
      box.appendChild(card([
        el('button', { class: 'group-head', 'aria-expanded': open ? 'true' : 'false', onclick: () => { openGroups[g] = !open; app().refreshTab(); } }, [
          el('span', { class: 'gh-name', text: g }),
          el('span', { class: 'muted small', text: 'mat. ' + CM.fmt.eur(gr.mat) + ' · man. ' + CM.fmt.eur(gr.lab) }),
          el('b', { class: 'mono', text: CM.fmt.eur(gr.total) }),
          c.chosen[g] != null ? el('span', { class: 'store-tag', text: 'preventivo ' + CM.fmt.eur(c.chosen[g]) }) : null
        ]),
        lines
      ], 'group'));
    }
    // per stanza
    const rooms = Object.keys(plan.rooms);
    if (rooms.length) {
      box.appendChild(section('Per stanza', el('span', { class: 'muted small', text: 'tocca per un tetto di spesa' })));
      box.appendChild(card(rooms.map(rid => {
        const v = c.byRoom[rid] || 0;
        const cap = project.budget.rooms[rid] || 0;
        return el('button', { class: 'line btnline', onclick: async () => {
          const x = await U().promptDialog('Tetto di spesa: ' + plan.rooms[rid].name, cap ? String(cap) : '', { label: 'Massimo', unit: '€', inputmode: 'decimal', mono: true });
          if (x == null) return;
          const n = parseFloat(String(x).replace(/\./g, '').replace(',', '.'));
          if (isFinite(n) && n > 0) project.budget.rooms[rid] = n; else delete project.budget.rooms[rid];
          app().save(); app().refreshTab();
        } }, [
          el('div', { class: 'l-main' }, [el('span', { text: plan.rooms[rid].name }), cap ? el('span', { class: 'muted small' + (v > cap ? ' warn' : ''), text: (v > cap ? 'Oltre il tetto di ' : 'Tetto ') + CM.fmt.eur(cap) }) : null]),
          el('span', { class: 'mono', text: CM.fmt.eur(v) })
        ]);
      })));
    }
    const simple = !!(CM.store && CM.store.pref('simpleMode'));
    if (!simple) {
    // preventivi
    box.appendChild(section('Preventivi delle ditte', el('button', { class: 'btn small', text: 'Aggiungi', onclick: () => T.editQuote(null) })));
    const quotes = project.quotes || [];
    if (!quotes.length) box.appendChild(el('div', { class: 'empty', text: 'Inserisci i preventivi ricevuti per confrontarli: quello scelto sostituisce la stima della sua voce.' }));
    const byGroup = {};
    quotes.forEach(q => { (byGroup[q.group] = byGroup[q.group] || []).push(q); });
    for (const g in byGroup) {
      const min = Math.min(...byGroup[g].map(q => +q.amount || Infinity));
      box.appendChild(card([el('div', { class: 'gh-name', text: g + (c.groups[g] ? ' · stima ' + CM.fmt.eur(c.groups[g].total) : '') })].concat(byGroup[g].map(q => el('div', { class: 'line' }, [
        el('label', { class: 'check' }, [el('input', { type: 'radio', name: 'q-' + g, checked: !!q.chosen, onchange: () => { byGroup[g].forEach(x => { x.chosen = x === q; }); app().save(); app().refreshTab(); } }), el('span', { text: q.company || 'Ditta' })]),
        el('div', { class: 'l-main' }, [q.note ? el('span', { class: 'muted small', text: q.note }) : null]),
        el('span', { class: 'mono' + (+q.amount === min ? ' best' : ''), text: CM.fmt.eur(+q.amount) }),
        el('button', { class: 'icon-btn ghost', 'aria-label': 'Modifica preventivo', html: U().icon('rename', 18), onclick: () => T.editQuote(q) })
      ])))));
    }
    }
    // varianti
    if (!simple && project.variants.length > 1) {
      box.appendChild(section('Confronto varianti'));
      const rows = project.variants.map(v => ({ v, c: CM.costs.compute(project, v.plan), t: P.totals(v.plan) }));
      box.appendChild(card(rows.map(r => el('button', { class: 'line btnline' + (r.v.id === project.active ? ' current' : ''), onclick: () => app().setVariant(r.v.id) }, [
        el('div', { class: 'l-main' }, [el('span', { text: r.v.name + (r.v.id === project.active ? ' (aperta)' : '') }), el('span', { class: 'muted small', text: CM.fmt.area(r.t.net) + ' · ' + r.t.rooms + ' ambienti' })]),
        el('span', { class: 'mono', text: CM.fmt.eur(r.c.total) })
      ]))));
    }
    // norme
    const norms = CM.norms.check(plan);
    box.appendChild(section('Controllo norme'));
    box.appendChild(card([
      norms.length ? el('div', {}, norms.map(n => el('div', { class: 'warn-line', text: n.text }))) : el('div', { text: 'Nessun avviso sui minimi di superficie, altezza e finestre.' }),
      el('div', { class: 'muted small', style: 'margin-top:8px', text: CM.norms.NOTE })
    ]));
  };

  T.editQuote = async function (q) {
    const project = app().project();
    const isNew = !q;
    const v = Object.assign({ id: CM.uid('q'), group: 'Opere edili', company: '', amount: null, note: '', chosen: false }, q || {});
    const contacts = project.contacts || [];
    const fields = [
      U().selectField('Voce', CM.costs.GROUPS.concat(['Altro']).map(g => ({ value: g, label: g })), v.group, x => { v.group = x; }, { full: false }),
      contacts.length ? U().selectField('Ditta', [{ value: '', label: 'Scrivi a mano' }].concat(contacts.map(ct => ({ value: ct.name, label: ct.name + (ct.trade ? ' (' + ct.trade + ')' : '') }))), contacts.some(ct => ct.name === v.company) ? v.company : '', x => { if (x) v.company = x; }, { full: false }) : null,
      U().textField('Nome ditta', v.company, x => { v.company = x; }),
      CM.sheets.moneyField('Importo', v.amount, x => { v.amount = x; }),
      U().textField('Note', v.note || '', x => { v.note = x; })
    ].filter(Boolean);
    const r = await formDialog(isNew ? 'Nuovo preventivo' : 'Preventivo', fields, isNew ? [] : [{ label: 'Elimina', value: 'delete', danger: true }]);
    if (r === 'delete') project.quotes = project.quotes.filter(x => x.id !== v.id);
    else if (r) {
      if (isNew) project.quotes.push(v); else Object.assign(q, v);
    } else return;
    app().save(); app().refreshTab();
  };

  T.pricesDialog = function () {
    const prices = CM.lib.prices();
    const groups = {};
    for (const k in prices) (groups[prices[k].group] = groups[prices[k].group] || []).push(k);
    const body = el('div', {}, [el('p', { text: 'Prezzi medi di partenza, indicativi: sostituiscili con quelli dei tuoi preventivi. Valgono per tutti i progetti.' })]);
    for (const g in groups) {
      body.appendChild(el('div', { class: 'sec-title', text: g }));
      for (const k of groups[g]) {
        if (k === 'montaggio_mobili') continue;
        const p = prices[k];
        const row = el('div', { class: 'price-row' }, [
          el('div', { class: 'pr-label' }, [el('span', { text: p.label }), el('span', { class: 'muted small', text: p.unit })]),
          CM.sheets.moneyField('Materiale', p.mat, v => CM.lib.setPrice(k, v || 0, CM.lib.prices()[k].lab), { unit: '' }),
          CM.sheets.moneyField('Manodopera', p.lab, v => CM.lib.setPrice(k, CM.lib.prices()[k].mat, v || 0), { unit: '' })
        ]);
        body.appendChild(row);
      }
    }
    CM.ui.dialog({ title: 'Prezzi di riferimento', body, actions: [{ label: 'Ripristina valori iniziali', value: 'reset' }, { label: 'Fatto', value: true, primary: true }] }).then(r => {
      if (r === 'reset') { CM.lib.resetPrices(); U().toast('Prezzi ripristinati'); }
      app().refreshTab();
    });
  };

  /* ================= LAVORI ================= */
  const lavoriState = { sub: 'acquisti' };
  const STATUSES = ['da comprare', 'ordinato', 'arrivato', 'montato'];

  T.purchaseItems = function (project) {
    const plan = CM.project.plan(project);
    const items = [];
    for (const id in plan.furniture) {
      const f = plan.furniture[id];
      items.push({ key: 'f:' + id, name: f.name, qty: '1 pz', price: f.price != null ? +f.price : null, store: f.store || 'Da scegliere', url: f.url });
    }
    const mats = {};
    for (const rid in plan.rooms) {
      const r = CM.finish.room(plan, rid);
      const add = (m, qty, unit, cost) => { if (!m) return; const k = m.id; mats[k] = mats[k] || { m, qty: 0, unit, cost: 0 }; mats[k].qty += qty; mats[k].cost += cost; };
      if (r.floor && r.floor.mat) add(r.floor.mat, r.floor.boxes || r.floor.area, r.floor.boxes ? 'scatole' : 'm²', r.floor.matCost);
      if (r.cladding && r.cladding.mat) add(r.cladding.mat, r.cladding.boxes, 'scatole', r.cladding.matCost);
      if (r.paint) add(r.paint.mat, r.paint.cans, 'latte', r.paint.matCost);
      if (r.wallpaper) add(r.wallpaper.mat, r.wallpaper.rolls, 'rotoli', r.wallpaper.matCost);
    }
    for (const k in mats) {
      const x = mats[k];
      items.push({ key: 'm:' + k, name: x.m.name, qty: CM.fmt.num(x.qty, x.unit === 'm²' ? 1 : 0) + ' ' + x.unit, price: x.cost, store: x.m.store || 'Da scegliere', url: x.m.url });
    }
    return items;
  };

  T.renderLavori = function (box) {
    const project = app().project();
    box.innerHTML = '';
    box.appendChild(el('div', { class: 'tab-head' }, [el('h1', { text: 'Lavori' })]));
    const subs = [['acquisti', 'Acquisti'], ['pagamenti', 'Pagamenti'], ['cantiere', 'Cantiere'], ['ditte', 'Ditte'], ['diario', 'Diario'], ['promemoria', 'Promemoria']];
    box.appendChild(el('div', { class: 'chips-row' }, subs.map(([id, label]) => el('button', { class: 'chip small' + (lavoriState.sub === id ? ' active' : ''), text: label, onclick: () => { lavoriState.sub = id; app().refreshTab(); } }))));
    const fn = { acquisti: renderAcquisti, pagamenti: renderPagamenti, cantiere: renderCantiere, ditte: renderDitte, diario: renderDiario, promemoria: renderPromemoria }[lavoriState.sub];
    fn(box, project);
  };
  T.showLavori = function (sub) { lavoriState.sub = sub; app().setTab('lavori'); };

  function renderAcquisti(box, project) {
    const items = T.purchaseItems(project);
    if (!items.length) { box.appendChild(el('div', { class: 'empty', text: 'La lista si compila da sola con gli arredi messi in pianta e i materiali delle finiture.' })); return; }
    const st = project.purchases || (project.purchases = {});
    const counts = STATUSES.map(s => items.filter(i => (st[i.key] || 'da comprare') === s).length);
    box.appendChild(card([el('div', { class: 'status-sum' }, STATUSES.map((s, i) => el('div', {}, [el('b', { text: String(counts[i]) }), el('span', { class: 'muted small', text: s })])))]));
    const byStore = {};
    items.forEach(i => { (byStore[i.store] = byStore[i.store] || []).push(i); });
    for (const store of Object.keys(byStore).sort((a, b) => a === 'Da scegliere' ? 1 : b === 'Da scegliere' ? -1 : a.localeCompare(b))) {
      const list = byStore[store];
      const tot = list.reduce((s, i) => s + (i.price || 0), 0);
      box.appendChild(section(store, el('span', { class: 'mono', text: CM.fmt.eur(tot) })));
      box.appendChild(card(list.map(i => {
        const s = st[i.key] || 'da comprare';
        return el('div', { class: 'line' }, [
          el('div', { class: 'l-main' }, [el('span', { text: i.name }), el('span', { class: 'muted small', text: i.qty + (i.price != null ? ' · ' + CM.fmt.eur(i.price) : '') })]),
          i.url ? el('a', { class: 'icon-btn ghost', href: i.url, target: '_blank', rel: 'noopener', 'aria-label': 'Apri nel negozio', html: U().icon('opening', 18) }) : null,
          el('button', { class: 'status s' + STATUSES.indexOf(s), text: s, 'aria-label': 'Stato: ' + s + '. Tocca per cambiare', onclick: () => { st[i.key] = STATUSES[(STATUSES.indexOf(s) + 1) % STATUSES.length]; app().save(); app().refreshTab(); } })
        ]);
      })));
    }
  }

  function renderPagamenti(box, project) {
    const c = CM.costs.compute(project);
    const total = Object.keys(c.chosen).length ? c.withQuotes : c.total;
    const pays = project.payments || [];
    const paid = pays.filter(p => p.paid).reduce((s, p) => s + (+p.amount || 0), 0);
    const due = pays.filter(p => !p.paid).reduce((s, p) => s + (+p.amount || 0), 0);
    box.appendChild(card([
      el('div', { class: 'card-row' }, [el('span', { text: 'Pagato' }), el('b', { class: 'mono', text: CM.fmt.eur(paid) })]),
      el('div', { class: 'card-row' }, [el('span', { text: 'Da pagare (registrato)' }), el('b', { class: 'mono', text: CM.fmt.eur(due) })]),
      el('div', { class: 'card-row' }, [el('span', { text: 'Restante rispetto alla stima' }), el('b', { class: 'mono', text: CM.fmt.eur(Math.max(0, total - paid)) })]),
      total > 0 ? el('div', { class: 'bar' }, [el('i', { style: 'width:' + Math.min(100, paid / total * 100) + '%' })]) : null
    ]));
    box.appendChild(section('Pagamenti e acconti', el('button', { class: 'btn small', text: 'Aggiungi', onclick: () => editPayment(null) })));
    if (!pays.length) { box.appendChild(el('div', { class: 'empty', text: 'Registra acconti e saldi a ditte e negozi.' })); return; }
    box.appendChild(card(pays.slice().sort((a, b) => (b.date || 0) - (a.date || 0)).map(p => el('button', { class: 'line btnline', onclick: () => editPayment(p) }, [
      el('div', { class: 'l-main' }, [el('span', { text: p.descr || 'Pagamento' }), el('span', { class: 'muted small', text: (p.to ? p.to + ' · ' : '') + fmtDate(p.date) })]),
      el('span', { class: 'status ' + (p.paid ? 's3' : 's0'), text: p.paid ? 'pagato' : 'da pagare' }),
      el('span', { class: 'mono', text: CM.fmt.eur(+p.amount) })
    ]))));
    async function editPayment(p) {
      const isNew = !p;
      const v = Object.assign({ id: CM.uid('pg'), descr: '', to: '', amount: null, date: Date.now(), paid: true }, p || {});
      const date = el('input', { type: 'date', value: toInputDate(v.date), 'aria-label': 'Data' });
      const fields = [
        U().textField('Descrizione', v.descr, x => { v.descr = x; }),
        U().textField('A chi', v.to, x => { v.to = x; }, { full: false }),
        CM.sheets.moneyField('Importo', v.amount, x => { v.amount = x; }),
        el('div', { class: 'field' }, [el('label', { text: 'Data' }), date]),
        U().segField('Stato', [{ value: true, label: 'Pagato' }, { value: false, label: 'Da pagare' }], v.paid, x => { v.paid = x; })
      ];
      const r = await formDialog(isNew ? 'Nuovo pagamento' : 'Pagamento', fields, isNew ? [] : [{ label: 'Elimina', value: 'delete', danger: true }]);
      v.date = fromInputDate(date.value) || v.date;
      if (r === 'delete') project.payments = pays.filter(x => x.id !== v.id);
      else if (r) { if (isNew) project.payments.push(v); else Object.assign(p, v); }
      else return;
      app().save(); app().refreshTab();
    }
  }

  const PHASES = ['Demolizioni e smaltimento', 'Nuovi tramezzi', 'Impianto elettrico', 'Impianto idraulico', 'Impianto di riscaldamento e clima', 'Massetti', 'Intonaci e rasature', 'Pavimenti e rivestimenti', 'Serramenti e porte', 'Pitture', 'Montaggio cucina e arredi', 'Pulizia finale'];
  function renderCantiere(box, project) {
    const tasks = project.tasks || [];
    const done = tasks.filter(t => t.done).length;
    box.appendChild(section('Cronoprogramma', el('div', { class: 'actions', style: 'margin:0' }, [
      !tasks.length ? el('button', { class: 'btn small', text: 'Fasi tipiche', onclick: () => {
        let d = Date.now();
        project.tasks = PHASES.map(name => { const t = { id: CM.uid('t'), name, start: d, end: d + 4 * 864e5, contact: '', done: false }; d += 5 * 864e5; return t; });
        app().save(); app().refreshTab();
      } }) : null,
      el('button', { class: 'btn small', text: 'Aggiungi fase', onclick: () => editTask(null) })
    ])));
    if (!tasks.length) { box.appendChild(el('div', { class: 'empty', text: 'Crea le fasi dei lavori con le date: puoi partire dalle fasi tipiche di una ristrutturazione e modificarle.' })); return; }
    const sorted = tasks.slice().sort((a, b) => (a.start || 0) - (b.start || 0));
    const min = Math.min(...sorted.map(t => t.start || Date.now())), max = Math.max(...sorted.map(t => t.end || t.start || Date.now()));
    const span = Math.max(864e5, max - min);
    box.appendChild(card([el('div', { class: 'muted small', text: done + ' di ' + tasks.length + ' fasi completate · dal ' + fmtDate(min) + ' al ' + fmtDate(max) })].concat(sorted.map(t => {
      const left = ((t.start || min) - min) / span * 100, width = Math.max(2, ((t.end || t.start) - (t.start || min)) / span * 100);
      return el('div', { class: 'task' + (t.done ? ' done' : '') }, [
        el('label', { class: 'check' }, [el('input', { type: 'checkbox', checked: !!t.done, 'aria-label': 'Completata: ' + t.name, onchange: (e) => { t.done = e.target.checked; app().save(); app().refreshTab(); } })]),
        el('button', { class: 'task-body', onclick: () => editTask(t) }, [
          el('div', { class: 'card-row' }, [el('span', { class: 't-name', text: t.name }), el('span', { class: 'muted small', text: fmtDate(t.start) + ' → ' + fmtDate(t.end) })]),
          t.contact ? el('div', { class: 'muted small', text: t.contact }) : null,
          el('div', { class: 'gantt' }, [el('i', { style: 'left:' + left + '%;width:' + Math.min(width, 100 - left) + '%' })])
        ])
      ]);
    }))));
    async function editTask(t) {
      const isNew = !t;
      const v = Object.assign({ id: CM.uid('t'), name: '', start: Date.now(), end: Date.now() + 3 * 864e5, contact: '', done: false, note: '' }, t || {});
      const s = el('input', { type: 'date', value: toInputDate(v.start), 'aria-label': 'Inizio' });
      const e = el('input', { type: 'date', value: toInputDate(v.end), 'aria-label': 'Fine' });
      const contacts = project.contacts || [];
      const fields = [
        U().textField('Fase', v.name, x => { v.name = x; }),
        el('div', { class: 'field' }, [el('label', { text: 'Inizio' }), s]),
        el('div', { class: 'field' }, [el('label', { text: 'Fine' }), e]),
        U().selectField('Ditta', [{ value: '', label: 'Nessuna' }].concat(contacts.map(ct => ({ value: ct.name, label: ct.name }))), v.contact, x => { v.contact = x; }),
        U().textField('Note', v.note || '', x => { v.note = x; })
      ];
      const r = await formDialog(isNew ? 'Nuova fase' : 'Fase', fields, isNew ? [] : [{ label: 'Elimina', value: 'delete', danger: true }]);
      v.start = fromInputDate(s.value) || v.start; v.end = fromInputDate(e.value) || v.end;
      if (v.end < v.start) v.end = v.start;
      if (r === 'delete') project.tasks = tasks.filter(x => x.id !== v.id);
      else if (r) { if (!v.name.trim()) v.name = 'Fase'; if (isNew) project.tasks.push(v); else Object.assign(t, v); }
      else return;
      app().save(); app().refreshTab();
    }
  }

  function renderDitte(box, project) {
    const list = project.contacts || [];
    box.appendChild(section('Rubrica ditte', el('button', { class: 'btn small', text: 'Aggiungi', onclick: () => editContact(null) })));
    if (!list.length) { box.appendChild(el('div', { class: 'empty', text: 'Salva idraulico, elettricista, piastrellista e gli altri contatti dei lavori.' })); return; }
    box.appendChild(card(list.map(ct => {
      const tel = (ct.tel || '').replace(/[^\d+]/g, '');
      const wa = tel ? 'https://wa.me/' + (tel.startsWith('+') ? tel.slice(1) : tel.startsWith('00') ? tel.slice(2) : '39' + tel) : null;
      return el('div', { class: 'line' }, [
        el('button', { class: 'l-main btn-reset', onclick: () => editContact(ct) }, [el('span', { text: ct.name }), el('span', { class: 'muted small', text: [ct.trade, ct.tel].filter(Boolean).join(' · ') })]),
        tel ? el('a', { class: 'btn small', href: 'tel:' + tel, text: 'Chiama' }) : null,
        wa ? el('a', { class: 'btn small', href: wa, target: '_blank', rel: 'noopener', text: 'WhatsApp' }) : null,
        ct.email ? el('a', { class: 'btn small', href: 'mailto:' + ct.email, text: 'Email' }) : null
      ]);
    })));
    async function editContact(ct) {
      const isNew = !ct;
      const v = Object.assign({ id: CM.uid('ct'), name: '', trade: '', tel: '', email: '', note: '' }, ct || {});
      const fields = [
        U().textField('Nome o ditta', v.name, x => { v.name = x; }),
        U().selectField('Mestiere', ['', 'Impresa edile', 'Muratore', 'Idraulico', 'Elettricista', 'Piastrellista', 'Imbianchino', 'Falegname', 'Serramentista', 'Termotecnico', 'Architetto / geometra', 'Negozio', 'Altro'].map(x => ({ value: x, label: x || 'Scegli…' })), v.trade, x => { v.trade = x; }, { full: false }),
        U().textField('Telefono', v.tel, x => { v.tel = x; }, { full: false }),
        U().textField('Email', v.email, x => { v.email = x; }),
        U().textField('Note', v.note, x => { v.note = x; })
      ];
      const r = await formDialog(isNew ? 'Nuovo contatto' : 'Contatto', fields, isNew ? [] : [{ label: 'Elimina', value: 'delete', danger: true }]);
      if (r === 'delete') project.contacts = list.filter(x => x.id !== v.id);
      else if (r) { if (!v.name.trim()) v.name = 'Contatto'; if (isNew) project.contacts.push(v); else Object.assign(ct, v); }
      else return;
      app().save(); app().refreshTab();
    }
  }

  function compressPhoto(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => {
        const im = new Image();
        im.onload = () => {
          const k = Math.min(1, 1280 / Math.max(im.naturalWidth, im.naturalHeight));
          const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', 0.72));
        };
        im.onerror = rej; im.src = r.result;
      };
      r.onerror = rej; r.readAsDataURL(file);
    });
  }
  T.compressPhoto = compressPhoto;

  T.addDiary = async function (opts) {
    opts = opts || {};
    const project = app().project();
    const plan = CM.project.plan(project);
    const v = { id: CM.uid('d'), date: Date.now(), type: opts.type || 'avanzamento', room: opts.room || '', wall: opts.wall || '', fixture: opts.fixture || '', text: '', photo: '' };
    const preview = el('div', { class: 'photo-prev' });
    const file = el('input', { type: 'file', accept: 'image/*', capture: 'environment', 'aria-label': 'Foto' });
    file.addEventListener('change', async () => {
      if (!file.files[0]) return;
      v.photo = await compressPhoto(file.files[0]);
      preview.innerHTML = ''; preview.appendChild(el('img', { src: v.photo, alt: 'Foto scelta' }));
    });
    const fields = [
      U().segField('Tipo', [{ value: 'avanzamento', label: 'Avanzamento' }, { value: 'tracce', label: 'Tracce impianti' }], v.type, x => { v.type = x; }),
      U().selectField('Stanza', [{ value: '', label: 'Nessuna' }].concat(Object.keys(plan.rooms).map(id => ({ value: id, label: plan.rooms[id].name }))), v.room, x => { v.room = x; }),
      el('div', { class: 'field full' }, [el('label', { text: 'Foto' }), file, preview]),
      U().textField('Descrizione', '', x => { v.text = x; })
    ];
    const r = await formDialog(v.type === 'tracce' ? 'Foto delle tracce' : 'Nuova voce di diario', fields);
    if (!r) return;
    project.diary.push(v);
    app().save();
    if (app().editor()) app().editor().draw();
    U().toast('Salvato nel diario');
    if (app().tab() === 'lavori') app().refreshTab();
  };

  function renderDiario(box, project) {
    const plan = CM.project.plan(project);
    const list = (project.diary || []).slice().sort((a, b) => b.date - a.date);
    box.appendChild(section('Diario e foto', el('button', { class: 'btn small', text: 'Aggiungi', onclick: () => T.addDiary({}) })));
    if (!list.length) { box.appendChild(el('div', { class: 'empty', text: 'Fotografa l’avanzamento dei lavori e soprattutto le tracce degli impianti prima di chiudere i muri: tra anni saprai dove non forare.' })); return; }
    box.appendChild(el('div', { class: 'diary' }, list.map(d => el('div', { class: 'diary-item card' }, [
      d.photo ? el('button', { class: 'diary-photo', 'aria-label': 'Ingrandisci foto', onclick: () => CM.ui.dialog({ title: fmtDate(d.date), body: el('img', { src: d.photo, alt: d.text || 'Foto', style: 'width:100%;border-radius:12px' }), actions: [{ label: 'Elimina', value: 'delete', danger: true }, { label: 'Chiudi', value: true, primary: true }] }).then(r => { if (r === 'delete') { project.diary = project.diary.filter(x => x.id !== d.id); app().save(); app().refreshTab(); } }) }, [el('img', { src: d.photo, alt: '' })]) : null,
      el('div', { class: 'diary-body' }, [
        el('div', { class: 'card-row' }, [el('span', { class: 'status ' + (d.type === 'tracce' ? 's1' : 's2'), text: d.type === 'tracce' ? 'tracce impianti' : 'avanzamento' }), el('span', { class: 'muted small', text: fmtDate(d.date) })]),
        d.room && plan.rooms[d.room] ? el('div', { class: 'muted small', text: plan.rooms[d.room].name }) : null,
        d.text ? el('div', { text: d.text }) : null
      ])
    ]))));
  }

  // Apre le foto collegate a un segnaposto della pianta
  T.showDiary = function (ids) {
    const project = app().project();
    const plan = CM.project.plan(project);
    const list = project.diary.filter(d => ids.includes(d.id)).sort((a, b) => b.date - a.date);
    if (!list.length) return;
    const body = el('div', { class: 'diary' }, list.map(d => el('div', { class: 'diary-item card' }, [
      d.photo ? el('img', { src: d.photo, alt: d.text || 'Foto', style: 'width:100%;border-radius:12px 12px 0 0;display:block' }) : null,
      el('div', { class: 'diary-body' }, [
        el('div', { class: 'card-row' }, [el('span', { class: 'status ' + (d.type === 'tracce' ? 's1' : 's2'), text: d.type === 'tracce' ? 'tracce impianti' : 'avanzamento' }), el('span', { class: 'muted small', text: fmtDate(d.date) })]),
        d.room && plan.rooms[d.room] ? el('div', { class: 'muted small', text: plan.rooms[d.room].name }) : null,
        d.text ? el('div', { text: d.text }) : null
      ])
    ])));
    CM.ui.dialog({ title: list.length > 1 ? list.length + ' foto in questo punto' : 'Foto', body, actions: [{ label: 'Apri il diario', value: 'diario' }, { label: 'Chiudi', value: true, primary: true }] })
      .then(r => { if (r === 'diario') T.showLavori('diario'); });
  };

  function renderPromemoria(box, project) {
    const list = (project.reminders || []).slice().sort((a, b) => a.when - b.when);
    box.appendChild(section('Promemoria', el('button', { class: 'btn small', text: 'Aggiungi', onclick: () => editReminder() })));
    if (!list.length) { box.appendChild(el('div', { class: 'empty', text: 'Consegne, sopralluoghi, scadenze: ti arriva una notifica sul telefono.' })); return; }
    box.appendChild(card(list.map(r => el('div', { class: 'line' + (r.when < Date.now() ? ' past' : '') }, [
      el('div', { class: 'l-main' }, [el('span', { text: r.text }), el('span', { class: 'muted small', text: new Date(r.when).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })]),
      el('button', { class: 'icon-btn ghost', 'aria-label': 'Elimina promemoria', html: U().icon('trash', 18), onclick: () => {
        project.reminders = project.reminders.filter(x => x.id !== r.id);
        if (window.CasaMiaAndroid && window.CasaMiaAndroid.cancelReminder) window.CasaMiaAndroid.cancelReminder(r.id);
        app().save(); app().refreshTab();
      } })
    ]))));
    async function editReminder() {
      const v = { id: CM.uid('r'), text: '', when: Date.now() + 864e5 };
      const d = el('input', { type: 'date', value: toInputDate(v.when), 'aria-label': 'Giorno' });
      const t = el('input', { type: 'time', value: '09:00', 'aria-label': 'Ora' });
      const fields = [U().textField('Cosa', '', x => { v.text = x; }), el('div', { class: 'field' }, [el('label', { text: 'Giorno' }), d]), el('div', { class: 'field' }, [el('label', { text: 'Ora' }), t])];
      const r = await formDialog('Nuovo promemoria', fields);
      if (!r) return;
      v.when = new Date(d.value + 'T' + (t.value || '09:00') + ':00').getTime();
      if (!v.text.trim()) v.text = 'Promemoria lavori';
      project.reminders.push(v);
      if (window.CasaMiaAndroid && window.CasaMiaAndroid.scheduleReminder) window.CasaMiaAndroid.scheduleReminder(v.id, v.when, project.name, v.text);
      app().save(); app().refreshTab();
      U().toast('Promemoria impostato');
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
