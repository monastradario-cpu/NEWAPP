/* Casa Mia — personalizzazione: galleria stili, pannello "tocca e cambia" nel 3D, finiture dei mobili */
(function (root) {
  'use strict';
  const CM = root.CM;
  const P = CM.plan;
  const U = () => CM.ui;
  const el = (...a) => CM.ui.el(...a);
  const PS = CM.personal = {};

  /* ---------- Pezzi riutilizzabili ---------- */
  // Riga di campioni di colore, con "+" per un colore qualsiasi
  PS.swatches = function (current, onPick, extra) {
    const list = [...new Set((extra || []).concat(CM.SWATCHES))];
    const row = el('div', { class: 'swatches' });
    list.forEach(c => row.appendChild(el('button', { class: 'swatch' + (current && current.toLowerCase() === c.toLowerCase() ? ' on' : ''), style: 'background:' + c, 'aria-label': 'Colore ' + c, onclick: () => onPick(c) })));
    const custom = el('input', { type: 'color', value: current && /^#[0-9a-f]{6}$/i.test(current) ? current : '#c49a6c', 'aria-label': 'Scegli un colore qualsiasi' });
    custom.addEventListener('change', () => onPick(custom.value));
    row.appendChild(el('label', { class: 'swatch more', title: 'Altro colore' }, [el('span', { text: '+' }), custom]));
    return row;
  };
  const chips = (items, current, onPick, dot) => el('div', { class: 'chips-row wrap' }, items.map(it => el('button', {
    class: 'chip small' + (current === it.id ? ' active' : ''), onclick: () => onPick(it.id),
    html: (dot && it.color ? '<span class="dot" style="background:' + it.color + ';border-radius:99px"></span>' : '') + it.label
  })));
  const sec = (t) => el('div', { class: 'sec-title', text: t });

  // Colori già usati nel progetto (per ripeterli facilmente)
  PS.usedColors = function (plan) {
    const out = [];
    for (const id in plan.rooms) {
      const f = plan.rooms[id].finish || {};
      const pm = f.paint && CM.lib.material(f.paint.mat);
      if (pm && pm.color) out.push(pm.color);
      if (f.accent && f.accent.color) out.push(f.accent.color);
    }
    for (const id in plan.furniture) if (plan.furniture[id].color) out.push(plan.furniture[id].color);
    return [...new Set(out)].slice(0, 10);
  };

  /* ---------- Finiture di un mobile ---------- */
  PS.furnitureControls = function (f, apply) {
    const kind = CM.style.kind(f);
    const box = el('div', { class: 'personal' });
    box.appendChild(sec(kind === 'wood' ? 'Colore / finitura' : 'Colore'));
    box.appendChild(PS.swatches(f.color, c => apply(x => { x.color = c; if (kind === 'wood') delete x.wood; })));
    if (kind === 'fabric' && f.shape !== 'rug') {
      box.appendChild(sec('Tessuto'));
      box.appendChild(chips(CM.FABRICS, f.fabric || 'liscio', id => apply(x => { x.fabric = id; })));
    }
    if (kind === 'wood' || kind === 'fabric' || ['table', 'desk', 'chair', 'bed'].includes(f.shape)) {
      box.appendChild(sec(kind === 'fabric' ? 'Legno (gambe, struttura)' : 'Legno'));
      box.appendChild(chips(CM.WOODS, f.wood || '', id => apply(x => { x.wood = id; if (kind === 'wood') x.color = CM.style.wood(id).color; }), true));
    }
    box.appendChild(sec('Metallo (gambe, maniglie)'));
    box.appendChild(chips(CM.METALS, f.metal || '', id => apply(x => { x.metal = id; }), true));
    return box;
  };

  /* ---------- Galleria degli stili ---------- */
  PS.styleCard = function (st, onClick) {
    const w = CM.style.wood(st.wood);
    return el('button', { class: 'style-card', onclick: onClick }, [
      el('div', { class: 'style-prev' }, [
        el('i', { style: 'background:' + st.walls }), el('i', { style: 'background:' + st.accent }),
        el('i', { style: 'background:' + (w ? w.color : '#C49A6C') }), el('i', { style: 'background:' + st.fabric }),
        el('i', { style: 'background:' + (CM.style.metal(st.metal) || { color: '#333' }).color })
      ]),
      el('b', { text: st.label }), el('small', { text: st.desc })
    ]);
  };

  // ctx: { plan(), mutate(fn), after(), room: id|null }
  PS.styleGallery = async function (ctx) {
    const plan = ctx.plan();
    const rid = ctx.room;
    let chosen = null;
    const grid = el('div', { class: 'style-grid' }, CM.style.all().map(st => PS.styleCard(st, () => { chosen = st; U().closeOverlay('pick'); })));
    const r = await U().dialog({ title: 'Scegli uno stile', text: rid ? 'Lo applico a ' + plan.rooms[rid].name + ' o a tutta la casa: pareti (con una parete d’accento), pavimento, mobili e luci.' : 'Lo applico a tutta la casa: pareti, pavimenti, mobili e luci. Poi puoi cambiare ogni cosa.', body: grid, actions: [{ label: 'Chiudi', value: null }] });
    if (r !== 'pick' || !chosen) return;
    let where = 'casa';
    if (rid) {
      where = await U().dialog({ title: chosen.label, text: chosen.desc, actions: [{ label: 'Annulla', value: null }, { label: 'Tutta la casa', value: 'casa' }, { label: plan.rooms[rid].name, value: 'stanza', primary: true }] });
      if (!where) return;
    }
    ctx.mutate(pl => { if (where === 'casa') CM.style.applyToHouse(pl, chosen); else CM.style.applyToRoom(pl, rid, chosen); });
    ctx.after && ctx.after();
    U().toast('Stile ' + chosen.label + ' applicato');
  };

  /* ---------- Pannello "tocca e cambia" nel 3D ---------- */
  // hit: { kind: 'wall'|'floor'|'furniture', id, room }
  PS.panel3d = function (host, hit, ctx) {
    host.innerHTML = '';
    if (!hit) { host.classList.add('hidden'); return; }
    const plan = ctx.plan();
    const close = el('button', { class: 'icon-btn ghost', 'aria-label': 'Chiudi', html: U().icon('close'), onclick: () => { host.classList.add('hidden'); } });
    const headRow = (kind, name) => ctx.bare ? document.createDocumentFragment() : el('div', { class: 'sheet-head' }, [el('div', { class: 'grow' }, [el('span', { class: 'kind', text: kind }), el('span', { class: 'name', text: name })]), close]);
    const done = () => { ctx.after && ctx.after(); PS.panel3d(host, hit, ctx); };
    host.classList.remove('hidden');

    if (hit.kind === 'furniture') {
      const f = plan.furniture[hit.id];
      if (!f) { host.classList.add('hidden'); return; }
      host.appendChild(headRow('Mobile', f.name));
      if (f.shape === 'composite') {
        host.appendChild(el('div', { class: 'actions' }, [el('button', { class: 'btn primary', text: 'Modifica la composizione', onclick: () => CM.config.open(f, nf => { ctx.mutate(pl => { const t = pl.furniture[hit.id]; if (!t) return; ['modules', 'front', 'handle', 'metal', 'worktop', 'body', 'mount', 'components', 'w', 'd', 'h', 'price', 'color'].forEach(k => { if (nf[k] !== undefined) t[k] = CM.clone(nf[k]); }); }); done(); }) })]));
        return;
      }
      host.appendChild(PS.furnitureControls(f, (fn) => { ctx.mutate(pl => { if (pl.furniture[hit.id]) fn(pl.furniture[hit.id]); }); done(); }));
      host.appendChild(el('div', { class: 'actions' }, [
        el('button', { class: 'btn small', text: 'Stesso stile a tutti i mobili della stanza', onclick: () => {
          const rid = P.roomOf(plan, f); if (!rid) return;
          ctx.mutate(pl => { const src = pl.furniture[hit.id]; for (const id in pl.furniture) { const x = pl.furniture[id]; if (id === hit.id || P.roomOf(pl, x) !== rid) continue; if (CM.style.kind(x) === CM.style.kind(src)) { x.color = src.color; x.fabric = src.fabric; } if (src.wood) x.wood = src.wood; if (src.metal) x.metal = src.metal; } });
          done(); U().toast('Finiture copiate sugli altri mobili della stanza');
        } }),
        el('button', { class: 'btn small', text: 'Abbina il resto (AI)', onclick: () => CM.inspire && CM.inspire.matchFromItem(ctx, hit.id) })
      ]));
      return;
    }

    const rid = hit.room;
    const room = rid && plan.rooms[rid];
    if (hit.kind === 'floor' && room) {
      host.appendChild(headRow('Pavimento', room.name));
      const cur = room.finish && room.finish.floor && room.finish.floor.mat;
      const mats = CM.lib.materials().filter(m => m.cat === 'pavimenti');
      host.appendChild(el('div', { class: 'mat-row' }, mats.map(m => el('button', { class: 'mat-chip' + (cur === m.id ? ' on' : ''), onclick: () => { ctx.mutate(pl => { const r = pl.rooms[rid]; r.finish = r.finish || {}; r.finish.floor = Object.assign({ pose: 'dritta' }, r.finish.floor, { mat: m.id }); }); done(); } }, [
        el('span', { class: 'mat-sw', style: m.img && /^data:/.test(m.img) ? 'background-image:url(' + m.img + ');background-size:cover' : 'background:' + (m.color || '#ccc') }),
        el('span', { text: m.name })
      ]))));
      if (cur) {
        host.appendChild(sec('Posa'));
        host.appendChild(chips(Object.keys(CM.POSE).map(k => ({ id: k, label: CM.POSE[k].label || k })), (room.finish.floor.pose || 'dritta'), id => { ctx.mutate(pl => { pl.rooms[rid].finish.floor.pose = id; }); done(); }));
      }
      host.appendChild(el('div', { class: 'actions' }, [
        el('button', { class: 'btn small', text: 'Stesso pavimento in tutta la casa', onclick: () => { if (!cur) return; ctx.mutate(pl => { for (const id in pl.rooms) { const r = pl.rooms[id]; if (CM.roomType(r.type).outdoor || ['bagno'].includes(r.type)) continue; r.finish = r.finish || {}; r.finish.floor = Object.assign({}, room.finish.floor); } }); done(); U().toast('Pavimento esteso alla casa (bagni e esterni esclusi)'); } }),
        el('button', { class: 'btn small', text: 'Stile della stanza', onclick: () => PS.styleGallery(Object.assign({}, ctx, { room: rid })) })
      ]));
      return;
    }

    if (hit.kind === 'wall') {
      if (!room) { host.appendChild(headRow('Parete', 'Lato esterno')); host.appendChild(el('p', { class: 'muted small', text: 'Questo è il lato esterno del muro. Tocca la parete dall’interno di una stanza per cambiarne il colore.' })); return; }
      host.appendChild(headRow('Parete', room.name));
      const f = room.finish || {};
      const pm = f.paint && CM.lib.material(f.paint.mat);
      const isAccent = f.accent && (f.accent.walls || []).includes(hit.id);
      const scope = PS._scope || 'stanza';
      host.appendChild(el('div', { class: 'seg compact', style: 'margin:6px 0' }, [['stanza', 'Tutta la stanza'], ['parete', 'Solo questa parete']].map(([v, l]) => el('button', { class: scope === v ? 'on' : '', text: l, onclick: () => { PS._scope = v; PS.panel3d(host, hit, ctx); } }))));
      const current = scope === 'parete' ? (isAccent ? f.accent.color : (pm && pm.color)) : (pm && pm.color);
      host.appendChild(PS.swatches(current, c => {
        ctx.mutate(pl => {
          const r = pl.rooms[rid]; r.finish = r.finish || {};
          if (scope === 'stanza') { r.finish.paint = Object.assign({ coats: 2 }, r.finish.paint, { mat: CM.style.paintMat(c) }); if (r.finish.accent) r.finish.accent.walls = r.finish.accent.walls.filter(w => w !== hit.id || r.finish.accent.color !== c); }
          else {
            const acc = r.finish.accent && r.finish.accent.color === c ? r.finish.accent : { color: c, walls: [] };
            acc.walls = [...new Set((acc.walls || []).concat([hit.id]))];
            r.finish.accent = acc;
          }
        });
        done();
      }, PS.usedColors(plan)));
      const acts = [];
      if (isAccent) acts.push(el('button', { class: 'btn small', text: 'Togli l’accento', onclick: () => { ctx.mutate(pl => { const a = pl.rooms[rid].finish.accent; a.walls = a.walls.filter(w => w !== hit.id); if (!a.walls.length) delete pl.rooms[rid].finish.accent; }); done(); } }));
      acts.push(el('button', { class: 'btn small', text: 'Stile della stanza', onclick: () => PS.styleGallery(Object.assign({}, ctx, { room: rid })) }));
      acts.push(el('button', { class: 'btn small', text: 'Carta da parati o piastrelle', onclick: () => ctx.openRoom && ctx.openRoom(rid) }));
      host.appendChild(el('div', { class: 'actions' }, acts));
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
