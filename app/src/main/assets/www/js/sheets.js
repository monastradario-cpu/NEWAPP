/* Casa Mia — pannelli proprietà aggiuntivi della pianta */
(function (root) {
  'use strict';
  const CM = root.CM;
  const P = CM.plan;
  const SH = CM.sheets = {};

  const U = () => CM.ui;
  const el = (...a) => CM.ui.el(...a);

  function head(kind, name, ctx) {
    return el('div', { class: 'sheet-head' }, [
      el('div', { class: 'grow' }, [el('span', { class: 'kind', text: kind }), el('span', { class: 'name', text: name })]),
      el('button', { class: 'icon-btn ghost', 'aria-label': 'Chiudi pannello', html: U().icon('close'), onclick: () => ctx.editor.select({}) })
    ]);
  }
  SH.head = head;

  function colorField(label, value, onChange) {
    const input = el('input', { type: 'color', value: value || '#D9D4CB', 'aria-label': label, style: 'padding:4px;height:44px' });
    input.addEventListener('change', () => onChange(input.value));
    return el('div', { class: 'field' }, [el('label', { text: label }), input]);
  }
  SH.colorField = colorField;

  function moneyField(label, value, onCommit, opts) {
    opts = opts || {};
    const input = el('input', { type: 'text', inputmode: 'decimal', class: 'num', value: value == null || value === '' ? '' : String(value).replace('.', ','), placeholder: opts.placeholder || '—', 'aria-label': label, enterkeyhint: 'done' });
    input.addEventListener('change', () => {
      const s = input.value.trim().replace(/\./g, '').replace(',', '.');
      if (s === '') return onCommit(null);
      const v = parseFloat(s);
      if (!isFinite(v) || v < 0) { U().toast('Valore non valido'); return; }
      onCommit(v);
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
    return el('div', { class: 'field' + (opts.full ? ' full' : '') }, [el('label', { text: label }), el('div', { class: 'input-unit' }, [input, el('span', { text: opts.unit || '€' })])]);
  }
  SH.moneyField = moneyField;

  /* ---------- Foto del mobile (solo al computer) ----------
     Trascina un file, incolla (Ctrl+V) un'immagine copiata dal sito del negozio, oppure scegli un file. */
  CM.isPC = () => !root.CasaMiaAndroid && !!(root.matchMedia && root.matchMedia('(pointer: fine)').matches);
  CM.imageFromData = async function (dt) {
    if (!dt) return null;
    const files = [...(dt.files || [])].filter(f => /^image\//.test(f.type));
    if (!files.length && dt.items) for (const it of dt.items) if (it.kind === 'file' && /^image\//.test(it.type)) { const f = it.getAsFile(); if (f) files.push(f); }
    if (files.length) return CM.inspire.shrink(files[0], 600);
    // immagine trascinata da una pagina web: si prova a scaricarla
    const html = dt.getData && dt.getData('text/html');
    const m = html && html.match(/<img[^>]+src="([^"]+)"/i);
    const url = (m && m[1]) || (dt.getData && (dt.getData('text/uri-list') || '').split('\n')[0].trim());
    if (url && /^(https?:|data:image)/i.test(url)) {
      if (/^data:/.test(url)) return CM.inspire.shrink(url, 600);
      const d = CM.localImage ? await CM.localImage(url, 600) : null;
      if (d) return d;
      U().toast('Il sito non permette di scaricare la foto trascinata: fai clic destro sulla foto \u203a \u201cCopia immagine\u201d e poi Ctrl+V qui');
    }
    return null;
  };
  SH.photoField = function (current, onSet, onRecognize) {
    const box = el('div', { class: 'photo-drop', tabindex: '0', title: 'Trascina qui una foto oppure incollala con Ctrl+V' });
    const set = async (p) => { const d = await p; if (d) { onSet(d); U().toast('Foto del mobile salvata'); } };
    const pick = () => { const i = el('input', { type: 'file', accept: 'image/*' }); i.addEventListener('change', () => { if (i.files[0]) set(CM.inspire.shrink(i.files[0], 600)); }); i.click(); };
    box.append(
      current ? el('img', { src: current, alt: 'Foto del mobile' }) : el('div', { class: 'photo-ph', html: U().icon('camera', 28) }),
      el('div', { class: 'photo-txt' }, [
        el('b', { text: current ? 'Cambia la foto' : 'Aggiungi la foto del mobile' }),
        el('span', { class: 'muted small', text: 'Trascinala qui, oppure sul sito del negozio fai clic destro sulla foto \u203a \u201cCopia immagine\u201d e premi Ctrl+V.' }),
        el('div', { class: 'actions' }, [
          el('button', { class: 'btn small', text: 'Scegli un file\u2026', onclick: (e) => { e.stopPropagation(); pick(); } }),
          navigator.clipboard && navigator.clipboard.read ? el('button', { class: 'btn small', text: 'Incolla', onclick: async (e) => {
            e.stopPropagation();
            try { for (const it of await navigator.clipboard.read()) { const t = it.types.find(x => /^image\//.test(x)); if (t) return set(CM.inspire.shrink(await it.getType(t), 600)); } U().toast('Negli appunti non c\u2019\u00e8 un\u2019immagine'); }
            catch (er) { U().toast('Premi Ctrl+V per incollare la foto'); }
          } }) : null,
          current && onRecognize ? el('button', { class: 'btn small primary', html: U().icon('spark', 16) + 'Riconosci con l\u2019AI', onclick: (e) => { e.stopPropagation(); onRecognize(current); } }) : null,
          current ? el('button', { class: 'btn small danger', text: 'Togli la foto', onclick: (e) => { e.stopPropagation(); onSet(''); } }) : null
        ])
      ])
    );
    box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('over'); });
    box.addEventListener('dragleave', () => box.classList.remove('over'));
    box.addEventListener('drop', e => { e.preventDefault(); box.classList.remove('over'); set(CM.imageFromData(e.dataTransfer)); });
    box.addEventListener('paste', e => { e.preventDefault(); e.stopPropagation(); set(CM.imageFromData(e.clipboardData)); });
    return box;
  };

  /* ---------- Mobile ---------- */
  SH.furniture = function (sheet, ctx, id) {
    const plan = ctx.editor.plan;
    const f = plan.furniture[id];
    const mut = ctx.mut;
    sheet.appendChild(head(CM.categoryLabel(f.cat), f.name, ctx));
    const warns = ctx.editor.warnings[id] || [];
    if (warns.length) sheet.appendChild(el('div', { class: 'warn-box', html: warns.map(w => '⚠︎ ' + w).join('<br>') }));
    const fields = el('div', { class: 'fields' });
    fields.appendChild(U().textField('Nome', f.name, v => mut(pl => { pl.furniture[id].name = v; })));
    fields.appendChild(U().numField('Larghezza', f.w, 'cm', v => mut(pl => { pl.furniture[id].w = v; }), { min: 0.05, max: 20 }));
    fields.appendChild(U().numField('Profondità', f.d, 'cm', v => mut(pl => { pl.furniture[id].d = v; }), { min: 0.01, max: 20 }));
    fields.appendChild(U().numField('Altezza', f.h, 'cm', v => mut(pl => { pl.furniture[id].h = v; }), { min: 0.01, max: 8 }));
    fields.appendChild(U().numField('Da terra', f.elev || 0, 'cm', v => mut(pl => { pl.furniture[id].elev = v; }), { min: 0, max: 5 }));
    fields.appendChild(moneyField('Prezzo', f.price, v => mut(pl => { pl.furniture[id].price = v; })));
    fields.appendChild(U().textField('Negozio', f.store || '', v => mut(pl => { pl.furniture[id].store = v; }), { full: false }));
    sheet.appendChild(fields);
    if (CM.isPC()) {
      sheet.appendChild(el('div', { class: 'sec-title', text: 'Foto del mobile' }));
      sheet.appendChild(SH.photoField(f.img, d => mut(pl => { if (pl.furniture[id]) pl.furniture[id].img = d; }), async (img) => {
        const v = await CM.photoAI.recognize(img, { confirm: 'Applica al mobile' });
        if (!v) return;
        mut(pl => {
          const t = pl.furniture[id]; if (!t) return;
          ['name', 'cat', 'shape', 'w', 'd', 'h', 'price', 'store', 'color', 'light'].forEach(k => { if (v[k] != null && v[k] !== '') t[k] = v[k]; });
          ['fabric', 'wood', 'metal'].forEach(k => { if (v[k]) t[k] = v[k]; else delete t[k]; });
          if (v.elev != null) t.elev = v.elev;
        });
        U().toast('Mobile aggiornato: guardalo nel 3D');
      }));
    }
    if (f.shape === 'composite') {
      sheet.appendChild(el('div', { class: 'actions' }, [el('button', { class: 'btn primary', html: U().icon('arredo', 18) + 'Modifica la composizione', onclick: () => CM.config.open(f, nf => mut(pl => { const t = pl.furniture[id]; if (!t) return; ['modules', 'front', 'handle', 'metal', 'worktop', 'body', 'mount', 'components', 'w', 'd', 'h', 'price', 'color', 'name'].forEach(k => { if (nf[k] !== undefined) t[k] = CM.clone(nf[k]); }); })) })]));
      if (f.components && f.components.length) sheet.appendChild(el('div', { class: 'card' }, f.components.map(c => el('div', { class: 'line' }, [el('span', { class: 'l-main', text: c.qty + ' \u00d7 ' + c.name }), el('span', { class: 'l-num', text: c.price ? CM.fmt.eur(c.price * c.qty) : '' })]))));
    } else {
      sheet.appendChild(el('div', { class: 'sec-title', text: 'Personalizza' }));
      sheet.appendChild(CM.personal.furnitureControls(f, fn => mut(pl => { if (pl.furniture[id]) fn(pl.furniture[id]); })));
    }
    if (f.model) {
      const inf = CM.glb && CM.glb.info[f.model];
      if (inf && inf.variants && inf.variants.length) {
        sheet.appendChild(el('div', { class: 'sec-title', text: 'Versione del modello' }));
        sheet.appendChild(el('div', { class: 'chips-row wrap' }, [{ i: null, n: 'Originale' }].concat(inf.variants.map((n, i) => ({ i, n: CM.glb.variantLabel(n) }))).map(v => el('button', { class: 'chip small' + ((f.variant == null ? null : f.variant) === v.i ? ' active' : ''), text: v.n, onclick: () => mut(pl => { const t = pl.furniture[id]; if (v.i == null) delete t.variant; else t.variant = v.i; }) }))));
      }
      sheet.appendChild(el('p', { class: 'muted small', text: f.store && /CC BY/.test(f.store) ? '\u2713 Modello 3D realistico (' + f.store + ').' : '\u2713 Nel 3D usa il modello vero del negozio.' }));
    }
    const acts = [
      el('button', { class: 'btn', html: U().icon('flip', 18) + 'Ruota 90°', onclick: () => ctx.editor.rotateSelected(90) }),
      el('button', { class: 'btn', text: 'Ruota 15°', onclick: () => ctx.editor.rotateSelected(15) }),
      el('button', { class: 'btn', html: U().icon('copy', 18) + 'Duplica', onclick: () => {
        let nid;
        mut(pl => { const src = pl.furniture[id]; nid = CM.uid('f'); pl.furniture[nid] = Object.assign({}, src, { x: src.x + 0.3, y: src.y + 0.3 }); });
        ctx.editor.select({ type: 'furniture', id: nid });
      } })
    ];
    acts.push(el('button', { class: 'btn', html: U().icon('room', 18) + 'Duplica in un\u2019altra stanza', onclick: () => CM.app.toOtherRoom(true) }));
    acts.push(el('button', { class: 'btn', text: 'Sposta in un\u2019altra stanza', onclick: () => CM.app.toOtherRoom(false) }));
    if (f.url) acts.push(el('a', { class: 'btn', href: f.url, target: '_blank', rel: 'noopener', text: 'Apri nel negozio' }));
    acts.push(el('button', { class: 'btn', text: 'Salva nel catalogo', onclick: () => {
      const it = { id: CM.uid('c'), name: f.name, cat: f.cat, w: f.w, d: f.d, h: f.h, elev: f.elev || 0, shape: f.shape, color: f.color, price: f.price, store: f.store, url: f.url, img: f.img, light: f.light };
      CM.lib.saveItem(it); U().toast('Aggiunto ai tuoi articoli');
    } }));
    acts.push(el('button', { class: 'btn danger', html: U().icon('trash', 18) + 'Elimina', onclick: () => ctx.editor.deleteSelection() }));
    sheet.appendChild(el('div', { class: 'actions' }, acts));
  };

  /* ---------- Impianto ---------- */
  SH.fixture = function (sheet, ctx, id) {
    const fx = ctx.editor.plan.fixtures[id];
    const def = CM.FIXTURES[fx.kind];
    sheet.appendChild(head('Impianto ' + CM.FIXTURE_GROUPS[def.group].label.toLowerCase(), def.label, ctx));
    const fields = el('div', { class: 'fields' });
    fields.appendChild(U().selectField('Tipo', Object.keys(CM.FIXTURES).map(k => ({ value: k, label: CM.FIXTURE_GROUPS[CM.FIXTURES[k].group].label + ' · ' + CM.FIXTURES[k].label })), fx.kind, v => ctx.mut(pl => { pl.fixtures[id].kind = v; })));
    fields.appendChild(U().segField('Stato', [{ value: 'nuovo', label: 'Da fare' }, { value: 'esistente', label: 'Esistente' }], fx.state || 'nuovo', v => ctx.mut(pl => { pl.fixtures[id].state = v; })));
    sheet.appendChild(fields);
    sheet.appendChild(el('div', { class: 'actions' }, [
      el('button', { class: 'btn', text: 'Foto della traccia', onclick: () => CM.tabs && CM.tabs.addDiary({ type: 'tracce', fixture: id, room: P.roomOf(ctx.editor.plan, fx) }) }),
      el('button', { class: 'btn danger', html: U().icon('trash', 18) + 'Elimina', onclick: () => ctx.editor.deleteSelection() })
    ]));
  };

  /* ---------- Stato delle aperture ---------- */
  SH.openingState = function (fields, ctx, id) {
    const op = ctx.editor.plan.openings[id];
    fields.appendChild(U().segField('Lavori', [{ value: 'esistente', label: 'Esistente' }, { value: 'nuova', label: 'Nuova' }, { value: 'sostituire', label: 'Da sostituire' }], op.state || 'esistente', v => ctx.mut(pl => { pl.openings[id].state = v; })));
  };

  /* ---------- Finiture della stanza ---------- */
  function matOptions(filter) {
    const list = CM.lib.materials().filter(filter);
    return [{ value: '', label: 'Nessuno' }].concat(list.map(m => ({ value: m.id, label: m.name + (m.price ? ' · ' + CM.fmt.num(m.price, m.price % 1 ? 2 : 0) + (m.type === 'pittura' ? ' €/L' : m.type === 'carta' ? ' €/rotolo' : ' €/m²') : '') }))).concat([{ value: '__new', label: '+ Aggiungi un materiale…' }]);
  }

  // Scelta delle pareti di una stanza (vuoto = tutte)
  function wallPicker(plan, room, selected, onChange) {
    const ids = P.roomWalls(plan, room);
    const pts = P.roomPts(plan, room);
    const c = CM.geom.centroid(pts);
    const side = (id) => {
      const w = plan.walls[id], A = plan.nodes[w.a], B = plan.nodes[w.b];
      const mx = (A.x + B.x) / 2 - c.x, my = (A.y + B.y) / 2 - c.y;
      return Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 'destra' : 'sinistra') : (my > 0 ? 'in basso' : 'in alto');
    };
    const sel = new Set(selected || []);
    const box = el('div', { class: 'chips-row wrap', role: 'group', 'aria-label': 'Pareti' });
    box.appendChild(el('button', { class: 'chip small' + (sel.size === 0 ? ' active' : ''), text: 'Tutte', onclick: () => onChange([]) }));
    ids.forEach((id, i) => box.appendChild(el('button', {
      class: 'chip small' + (sel.has(id) ? ' active' : ''), 'aria-pressed': sel.has(id) ? 'true' : 'false',
      text: 'Parete ' + (i + 1) + ' · ' + side(id) + ' · ' + CM.fmt.num(P.wallLen(plan, id), 2) + ' m',
      onclick: () => { if (sel.has(id)) sel.delete(id); else sel.add(id); onChange([...sel]); }
    })));
    return el('div', { class: 'field full' }, [el('span', { class: 'lbl', text: 'Su quali pareti' }), box]);
  }

  SH.roomFinish = function (sheet, ctx, rid) {
    const plan = ctx.editor.plan;
    const room = plan.rooms[rid];
    const f = room.finish || (room.finish = {});
    const calc = CM.finish.room(plan, rid);
    const mut = (fn) => ctx.mut(pl => { const r = pl.rooms[rid]; r.finish = r.finish || {}; fn(r.finish, r); });
    const pick = async (v, type, apply) => {
      if (v === '__new') { const m = await CM.tabs.editMaterial(null, type); if (m) apply(m.id); else ctx.refresh(); return; }
      apply(v || null);
    };
    const section = (title) => el('div', { class: 'sec-title', text: title });

    sheet.appendChild(section('Pavimento'));
    let fl = el('div', { class: 'fields' });
    fl.appendChild(U().selectField('Materiale', matOptions(m => m.cat === 'pavimenti' && m.type !== 'rivestimento'), (f.floor && f.floor.mat) || '', v => pick(v, 'piastrella', id => mut(fi => { fi.floor = id ? Object.assign({ pose: 'dritta' }, fi.floor, { mat: id }) : null; }))));
    if (f.floor && f.floor.mat && calc.floor && calc.floor.mat && calc.floor.mat.type !== 'resina') {
      fl.appendChild(U().selectField('Posa', Object.keys(CM.POSE).map(k => ({ value: k, label: CM.POSE[k].label + ' (sfrido ' + Math.round(CM.POSE[k].waste * 100) + '%)' })), f.floor.pose || 'dritta', v => mut(fi => { fi.floor.pose = v; }), { full: false }));
      if (calc.floor && calc.floor.mat && calc.floor.mat.type === 'piastrella') fl.appendChild(U().numField('Fuga', f.floor.joint || 3, 'mm', v => mut(fi => { fi.floor.joint = v; }), { min: 1, max: 20 }));
    }
    sheet.appendChild(fl);
    if (calc.floor && calc.floor.mat) {
      const t = calc.floor;
      const parts = [CM.fmt.area(t.area) + ' da posare'];
      if (t.boxes) parts.push('<b>' + t.boxes + ' scatole</b> (' + CM.fmt.num(t.buyArea, 1) + ' m² con sfrido)');
      for (const e of t.extras) parts.push(e.label.toLowerCase() + ' ' + e.qty + ' ' + e.unit);
      if (calc.baseboard) parts.push('battiscopa ' + CM.fmt.m(calc.baseboard.m));
      parts.push('<b>' + CM.fmt.eur(t.matCost + t.lab + (calc.baseboard ? calc.baseboard.mat + calc.baseboard.lab : 0)) + '</b>');
      sheet.appendChild(el('div', { class: 'calc', html: parts.join(' · ') }));
    }

    sheet.appendChild(section('Rivestimento a parete'));
    const cl = el('div', { class: 'fields' });
    cl.appendChild(U().selectField('Piastrelle o rivestimento', matOptions(m => m.cat === 'pavimenti' && (m.type === 'piastrella' || m.type === 'rivestimento')), (f.cladding && f.cladding.mat) || '', v => pick(v, 'piastrella', id => mut(fi => { fi.cladding = id ? Object.assign({ height: room.type === 'bagno' ? 1.2 : 0.6, pose: 'dritta' }, fi.cladding, { mat: id }) : null; })), { full: false }));
    if (f.cladding && f.cladding.mat) {
      cl.appendChild(U().numField('Altezza', f.cladding.height || 1.2, 'cm', v => mut(fi => { fi.cladding.height = v; }), { min: 0.1, max: 4 }));
      cl.appendChild(U().selectField('Posa', Object.keys(CM.POSE).map(k => ({ value: k, label: CM.POSE[k].label })), f.cladding.pose || 'dritta', v => mut(fi => { fi.cladding.pose = v; }), { full: false }));
      cl.appendChild(U().numField('Fuga', f.cladding.joint || 2, 'mm', v => mut(fi => { fi.cladding.joint = v; }), { min: 1, max: 20 }));
      cl.appendChild(wallPicker(plan, room, f.cladding.walls, ids => mut(fi => { fi.cladding.walls = ids; })));
    }
    sheet.appendChild(cl);
    if (calc.cladding && calc.cladding.mat) sheet.appendChild(el('div', { class: 'calc', html: CM.fmt.area(calc.cladding.area) + ' · <b>' + calc.cladding.boxes + ' scatole</b> · <b>' + CM.fmt.eur(calc.cladding.matCost + calc.cladding.lab) + '</b>' }));

    sheet.appendChild(section('Pittura'));
    const pa = el('div', { class: 'fields' });
    pa.appendChild(U().selectField('Colore', matOptions(m => m.type === 'pittura'), (f.paint && f.paint.mat) || '', v => pick(v, 'pittura', id => mut(fi => { fi.paint = id ? Object.assign({ coats: 2 }, fi.paint, { mat: id }) : null; }))));
    if (f.paint && f.paint.mat) {
      pa.appendChild(U().segField('Mani', [{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }], f.paint.coats || 2, v => mut(fi => { fi.paint.coats = v; })));
      pa.appendChild(U().segField('Soffitto', [{ value: true, label: 'Compreso' }, { value: false, label: 'Escluso' }], f.paint.ceiling !== false, v => mut(fi => { fi.paint.ceiling = v; })));
    }
    sheet.appendChild(pa);
    if (calc.paint) {
      const pm = calc.paint.mat;
      sheet.appendChild(el('div', { class: 'calc', html: '<span class="swatch" style="background:' + pm.color + '"></span>' + (pm.code ? pm.code + ' · ' : '') + CM.fmt.area(calc.paint.area) + ' · <b>' + CM.fmt.num(calc.paint.liters, 1) + ' L</b> (' + calc.paint.cans + ' latt' + (calc.paint.cans === 1 ? 'a' : 'e') + ' da ' + CM.fmt.num(pm.canL || 5, 1) + ' L) · <b>' + CM.fmt.eur(calc.paint.matCost + calc.paint.lab) + '</b>' }));
    }

    sheet.appendChild(section('Carta da parati'));
    const wp = el('div', { class: 'fields' });
    wp.appendChild(U().selectField('Carta', matOptions(m => m.type === 'carta'), (f.wallpaper && f.wallpaper.mat) || '', v => pick(v, 'carta', id => mut(fi => { fi.wallpaper = id ? Object.assign({ share: 1 }, fi.wallpaper, { mat: id }) : null; })), { full: false }));
    if (f.wallpaper && f.wallpaper.mat) wp.appendChild(wallPicker(plan, room, f.wallpaper.walls, ids => mut(fi => { fi.wallpaper.walls = ids; fi.wallpaper.share = 1; })));
    sheet.appendChild(wp);
    if (calc.wallpaper) sheet.appendChild(el('div', { class: 'calc', html: '<b>' + calc.wallpaper.rolls + ' rotoli</b> · ' + CM.fmt.area(calc.wallpaper.area) + ' · <b>' + CM.fmt.eur(calc.wallpaper.matCost + calc.wallpaper.lab) + '</b>' }));

    sheet.appendChild(section('Stile guidato'));
    const sty = el('div', { class: 'style-row' }, CM.style.all().map(s => el('button', { class: 'style-chip', onclick: () => SH.applyStyle(ctx, rid, s) }, [
      el('span', { class: 'sw', style: 'background:linear-gradient(135deg,' + s.walls + ' 0 45%,' + s.accent + ' 45% 70%,' + ((CM.style.wood(s.wood) || {}).color || s.fabric) + ' 70%)' }),
      el('span', { text: s.label })
    ])));
    sheet.appendChild(sty);
  };

  SH.applyStyle = async function (ctx, rid, s) {
    const r = await U().dialog({ title: 'Stile ' + s.label, text: s.desc + '. Applico colori delle pareti (con una parete d\u2019accento), pavimento e finiture dei mobili. Puoi annullare.', actions: [{ label: 'Annulla', value: null }, { label: 'Tutta la casa', value: 'casa' }, { label: 'Questa stanza', value: 'stanza', primary: true }] });
    if (!r) return;
    ctx.mut(pl => { if (r === 'casa') CM.style.applyToHouse(pl, s); else CM.style.applyToRoom(pl, rid, s); });
    U().toast('Stile ' + s.label + ' applicato' + (r === 'casa' ? ' a tutta la casa' : ''));
  };

  /* ---------- Planimetria di sfondo ---------- */
  SH.underlay = function (sheet, ctx) {
    const plan = ctx.editor.plan;
    const u = plan.underlay;
    sheet.appendChild(el('div', { class: 'sheet-head' }, [
      el('div', { class: 'grow' }, [el('span', { class: 'kind', text: 'Planimetria' }), el('span', { class: 'name', text: u ? (u.calibrated ? 'In scala' : 'Da mettere in scala') : 'Nessuna' })]),
      el('button', { class: 'icon-btn ghost', 'aria-label': 'Chiudi pannello', html: U().icon('close'), onclick: () => ctx.closeUnderlay() })
    ]));
    if (!u) {
      sheet.appendChild(el('p', { class: 'muted', text: 'Carica una foto, un’immagine o un PDF della planimetria: la metto sotto la pianta per ricalcarla.' }));
      sheet.appendChild(el('div', { class: 'actions' }, [el('button', { class: 'btn primary', text: 'Carica planimetria', onclick: () => ctx.loadUnderlay() })]));
      return;
    }
    if (!u.calibrated) sheet.appendChild(el('div', { class: 'warn-box', text: 'Per prima cosa metti in scala: tocca “Calibra la scala”, riconosco io i muri e ti chiedo solo la misura di uno.' }));
    const range = el('input', { type: 'range', min: '0.1', max: '1', step: '0.05', value: String(u.opacity == null ? 0.5 : u.opacity), 'aria-label': 'Trasparenza' });
    range.addEventListener('input', () => { u.opacity = +range.value; ctx.editor.draw(); });
    range.addEventListener('change', () => ctx.save());
    sheet.appendChild(el('div', { class: 'field full' }, [el('span', { class: 'lbl', text: 'Visibilità della planimetria' }), el('div', { class: 'range-row' }, [range])]));
    sheet.appendChild(el('div', { class: 'actions' }, [
      el('button', { class: 'btn primary', text: 'Calibra la scala', onclick: () => { ctx.closeUnderlay(true); ctx.calibrate(); } }),
      el('button', { class: 'btn', text: 'Ritaglia sulla casa', onclick: () => { ctx.closeUnderlay(true); ctx.editor.setTool('cropUnderlay'); } }),
      el('button', { class: 'btn', text: 'Calibra con barra di scala o tratto noto', onclick: () => { ctx.closeUnderlay(true); ctx.editor.setTool('calibrate'); } }),
      el('button', { class: 'btn', text: 'Cancella una zona', onclick: () => { ctx.closeUnderlay(true); ctx.editor.setTool('erase'); } }),
      el('button', { class: 'btn', text: 'Sposta', onclick: () => { ctx.closeUnderlay(true); ctx.editor.setTool('moveUnderlay'); } }),
      el('button', { class: 'btn', text: 'Riconosci i muri', onclick: () => ctx.detectWalls(false) }),
      el('button', { class: 'btn', text: 'Pulisci (togli scritte e simboli)', onclick: async () => { U().toast('Pulisco la planimetria\u2026'); try { const nu = await CM.underlay.clean(ctx.editor.plan.underlay); ctx.mut(pl => { pl.underlay = nu; }, 'clean'); U().toast('Fatto: restano solo le linee lunghe (muri). Puoi annullare.'); } catch (e) { U().toast('Non riesco a pulirla'); } } }),
      el('button', { class: 'btn', text: 'Raddrizza la foto', onclick: async () => { const u = ctx.editor.plan.underlay; const im = await CM.app.straighten({ src: u.src, pxW: u.pxW, pxH: u.pxH }); if (im && im.src !== u.src) ctx.mut(pl => { pl.underlay = Object.assign({}, pl.underlay, im, { hM: pl.underlay.wM * im.pxH / im.pxW }); }, 'warp'); } }),
      el('button', { class: 'btn', text: 'Riconosci con Gemini', onclick: () => ctx.detectWalls(true) }),
      el('button', { class: 'btn', text: 'Sostituisci', onclick: () => ctx.loadUnderlay() }),
      el('button', { class: 'btn danger', text: 'Rimuovi', onclick: () => ctx.mut(pl => { pl.underlay = null; }) })
    ]));
  };
})(typeof window !== 'undefined' ? window : globalThis);
