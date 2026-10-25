/* Casa Mia — progetti di stanze e arredo con l'AI
   1) Inserisci un progetto fatto altrove (planner IKEA, Planner 5D, PDF, foto, disegno) dentro una stanza della casa.
   2) Arreda una stanza con l'AI ("bacchetta magica"). */
(function (root) {
  'use strict';
  const CM = root.CM;
  const P = CM.plan, G = CM.geom;
  const RA = CM.roomAI = {};
  const U = () => CM.ui;
  const el = (...a) => CM.ui.el(...a);
  const app = () => CM.app;

  const SHAPES = ['box', 'sofa', 'sofa_l', 'armchair', 'bed', 'table', 'round_table', 'chair', 'wardrobe', 'cabinet', 'kitchen_base', 'kitchen_wall', 'kitchen_tall', 'sink', 'hob', 'fridge', 'washer', 'tv', 'shelf', 'desk', 'wc', 'bidet', 'basin', 'shower', 'bath', 'rug', 'plant', 'lamp_floor', 'lamp_ceiling', 'curtain', 'mirror', 'picture'];
  const num = (v, d) => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : d; };

  async function needAI() {
    if (CM.ai.enabled()) return true;
    await CM.share.aiSettings();
    return CM.ai.enabled();
  }

  // Interno della stanza: rettangolo che la contiene, al netto di mezzo muro
  function interior(plan, rid) {
    const room = plan.rooms[rid];
    const pts = P.roomPts(plan, room);
    const ws = P.roomWalls(plan, room).map(id => plan.walls[id]).filter(Boolean);
    const h = ws.length ? ws.reduce((a, w) => a + (w.t || 0.1), 0) / ws.length / 2 : 0.05;
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    return { pts, x0: Math.min(...xs) + h, y0: Math.min(...ys) + h, x1: Math.max(...xs) - h, y1: Math.max(...ys) - h, h };
  }
  const centroid = (pts) => pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 });

  // Mette i mobili (coordinate in metri rispetto all'angolo interno in alto a sinistra) nella stanza
  function place(rid, items, opts) {
    opts = opts || {};
    const ed = app().editor();
    const plan = ed.plan;
    const inn = interior(plan, rid);
    const ids = [];
    ed.mutate(pl => {
      if (opts.clear) for (const fid in pl.furniture) if (P.roomOf(pl, pl.furniture[fid]) === rid) delete pl.furniture[fid];
      for (const it of items) {
        let x = inn.x0 + it.x, y = inn.y0 + it.y;
        if (!G.inPoly({ x, y }, inn.pts)) { const c = centroid(inn.pts); x = (x + c.x) / 2; y = (y + c.y) / 2; }
        const item = Object.assign({ cat: 'altro', color: '#D9D4CB' }, it);
        delete item.x; delete item.y; delete item.rot; delete item.wall;
        let pos = { x, y, rot: it.rot || 0 };
        if (it.wall) { try { const s = ed.at3d(() => ed._furnitureSnap({ x, y, w: it.w, d: it.d, rot: it.rot || 0 }, true)); if (s && G.dist(s, { x, y }) < 0.6) pos = s; } catch (e) {} }
        ids.push(P.addFurniture(pl, item, pos.x, pos.y, pos.rot));
      }
    }, 'ai-room');
    app().selectSet({ nodes: [], walls: [], rooms: [], furniture: ids, fixtures: [], columns: [], beams: [] });
    return ids.length;
  }

  // Dal JSON dell'AI ai mobili, adattati alle misure della stanza scelta
  function fromAI(j, inn) {
    const st = j.stanza || {};
    let aw = num(st.larghezza_cm, 0) / 100, ad = num(st.profondita_cm, 0) / 100;
    const W = inn.x1 - inn.x0, D = inn.y1 - inn.y0;
    const raw = (j.mobili || []).filter(m => m && (num(m.larghezza_cm, 0) > 0));
    if (!aw || !ad) { aw = Math.max(W, ...raw.map(m => (num(m.x_cm, 0) + num(m.larghezza_cm, 0) / 2) / 100)); ad = Math.max(D, ...raw.map(m => (num(m.y_cm, 0) + num(m.profondita_cm, 0) / 2) / 100)); }
    // il disegno può essere ruotato rispetto alla stanza: scelgo l'orientamento che combacia meglio
    const swap = Math.abs(aw - D) + Math.abs(ad - W) < Math.abs(aw - W) + Math.abs(ad - D) - 0.2;
    const sw = swap ? ad : aw, sd = swap ? aw : ad;
    // piccole differenze: si adatta; differenze grandi: si tiene la misura vera dei mobili, appoggiati all'angolo in alto a sinistra
    const near = (r) => r > 0.85 && r < 1.18;
    const kx = near(W / sw) ? W / sw : 1, ky = near(D / sd) ? D / sd : 1;
    const fitted = Math.abs(W / sw - 1) > 0.04 || Math.abs(D / sd - 1) > 0.04;
    const items = raw.map(m => {
      let x = num(m.x_cm, 0) / 100, y = num(m.y_cm, 0) / 100, rot = num(m.rotazione_gradi, 0);
      if (swap) { const nx = ad - y, ny = x; x = nx; y = ny; rot += 90; }
      const shape = SHAPES.includes(m.forma) ? m.forma : 'box';
      const it = {
        name: String(m.nome || 'Mobile').slice(0, 60), shape,
        w: CM.r3(num(m.larghezza_cm, 60) / 100), d: CM.r3(num(m.profondita_cm, 60) / 100), h: CM.r3(num(m.altezza_cm, 80) / 100),
        elev: CM.r3(num(m.da_terra_cm, 0) / 100), x: x * kx, y: y * ky, rot: ((rot % 360) + 360) % 360 * Math.PI / 180,
        wall: !!m.contro_parete, price: m.prezzo_euro != null ? num(m.prezzo_euro, null) : null, store: String(m.negozio || '').slice(0, 30),
        color: /^#[0-9a-f]{6}$/i.test(m.colore || '') ? m.colore : '#D9D4CB', light: /^lamp/.test(shape)
      };
      it.cat = /kitchen|sink|hob|fridge/.test(shape) ? 'cucina' : /wc|bidet|basin|shower|bath/.test(shape) ? 'bagno' : /bed|wardrobe/.test(shape) ? 'camera' : /desk/.test(shape) ? 'studio' : 'soggiorno';
      // dentro la stanza
      it.x = Math.max(it.w / 2, Math.min(W - it.w / 2, it.x)); it.y = Math.max(Math.min(it.d / 2, D / 2), Math.min(D - it.d / 2, it.y));
      return it;
    });
    return { items, fitted, aw, ad, W, D, swap };
  }

  function readFile(accept) {
    return new Promise(resolve => {
      const input = el('input', { type: 'file', accept, style: 'display:none' });
      document.body.appendChild(input);
      input.addEventListener('change', () => {
        const f = input.files[0]; input.remove();
        if (!f) return resolve(null);
        if (/^image\//.test(f.type)) return CM.inspire.shrink(f, 1800).then(d => resolve(d ? { data: d, name: f.name } : null));
        if (f.size > 15 * 1048576) { U().toast('File troppo grande (massimo 15 MB)'); return resolve(null); }
        const r = new FileReader();
        r.onload = () => resolve({ data: r.result, name: f.name });
        r.onerror = () => resolve(null);
        r.readAsDataURL(f);
      });
      input.click();
    });
  }

  /* ---------- 1) Progetto di una stanza da un'altra app, PDF o foto ---------- */
  RA.importPlan = async function (roomId) {
    const ed = app().editor();
    const plan = ed.plan;
    if (!(await needAI())) return;
    const file = await readFile('image/*,application/pdf');
    if (!file) return;
    if (!/^data:(image\/|application\/pdf)/.test(file.data)) { U().toast('Serve un PDF o un’immagine (anche lo screenshot del progetto)'); return; }
    // in quale stanza?
    let rid = roomId;
    if (!rid) {
      const list = Object.keys(plan.rooms).map(id => ({ id, label: plan.rooms[id].name + ' · ' + CM.fmt.area(P.roomStats(plan, plan.rooms[id]).net), icon: 'room' }));
      rid = await U().menu('In quale stanza lo metto?', list.concat([{ id: '__new', label: 'In una stanza nuova accanto alla casa', icon: 'room' }]));
      if (!rid) return;
    }
    let clear = false;
    if (rid !== '__new' && Object.values(plan.furniture).some(f => P.roomOf(plan, f) === rid)) {
      const c = await U().dialog({ title: 'Nella stanza ci sono già dei mobili', text: 'Li tolgo e metto quelli del progetto, oppure li aggiungo?', actions: [{ label: 'Annulla', value: null }, { label: 'Aggiungi', value: 'add' }, { label: 'Sostituisci', value: 'clear', primary: true }] });
      if (!c) return;
      clear = c === 'clear';
    }
    U().toast('Gemini sta leggendo il progetto…');
    const prompt = 'Questo file è il progetto di una stanza fatto con un’app (per esempio il planner di IKEA o Planner 5D), oppure una pianta o una foto. ' +
      'Ricava le misure interne della stanza e TUTTI i mobili, elettrodomestici e sanitari visti dall’alto. Usa le misure scritte quando ci sono (codici e misure dei prodotti IKEA, quote). ' +
      'Coordinate in centimetri, con origine nell’angolo in alto a sinistra dell’INTERNO della stanza: x verso destra, y verso il basso; x_cm e y_cm sono il CENTRO del mobile. ' +
      'Se il disegno è una vista frontale (prospetto, come le cucine IKEA viste di fronte), metti i mobili lungo la parete in alto, nello stesso ordine da sinistra a destra; pensili e cappe con da_terra_cm. ' +
      'rotazione_gradi: 0 = schienale verso l’alto (y piccola), 90 = schienale verso destra, 180 = verso il basso, 270 = verso sinistra. ' +
      'Rispondi SOLO con JSON: {"stanza":{"larghezza_cm":n,"profondita_cm":n},"vista":"pianta|prospetto|foto","mobili":[{"nome":"","forma":una tra [' + SHAPES.join(', ') + '],"larghezza_cm":n,"profondita_cm":n,"altezza_cm":n,"da_terra_cm":n,"x_cm":n,"y_cm":n,"rotazione_gradi":n,"contro_parete":true/false,"colore":"#RRGGBB","prezzo_euro":n o null,"negozio":""}],"note":"una frase"}';
    let j;
    try { j = await CM.ai.text(prompt, { json: true, images: [file.data] }); }
    catch (e) { U().toast(CM.ai.errorText(e)); return; }
    if (!j || !(j.mobili || []).length) { U().toast('Non ho trovato mobili nel file: prova con un PDF o uno screenshot più nitido'); return; }
    // stanza nuova con le misure lette
    if (rid === '__new') {
      const w = num(j.stanza && j.stanza.larghezza_cm, 350) / 100, d = num(j.stanza && j.stanza.profondita_cm, 300) / 100;
      const b = P.bounds(Object.assign({}, plan, { underlay: null }));
      const s = app().project().settings;
      const x0 = b ? b.maxX + 1 : 0, y0 = b ? b.minY : 0, t = s.wallT || 0.1;
      ed.mutate(pl => { rid = P.addRectRoom(pl, x0, y0, x0 + w + t, y0 + d + t, { name: 'Stanza dal progetto', type: 'altro', h: s.wallH, wall: { t, h: s.wallH, state: s.newState } }); }, 'room');
    }
    const inn = interior(ed.plan, rid);
    const res = fromAI(j, inn);
    const room = ed.plan.rooms[rid];
    const lines = res.items.map(i => '• ' + i.name + ' · ' + Math.round(i.w * 100) + '×' + Math.round(i.d * 100) + ' cm');
    const ok = await U().dialog({
      title: res.items.length + ' elementi per ' + room.name,
      text: (j.note ? j.note + ' ' : '') + (res.fitted ? 'Il progetto (' + CM.fmt.num(res.aw, 2) + '×' + CM.fmt.num(res.ad, 2) + ' m) non ha le stesse misure della stanza (' + CM.fmt.num(res.W, 2) + '×' + CM.fmt.num(res.D, 2) + ' m): ho adattato le posizioni, controlla.' : 'Le misure combaciano con la stanza.'),
      body: el('div', { class: 'small', style: 'max-height:40vh;overflow:auto;white-space:pre-line', text: lines.join('\n') }),
      actions: [{ label: 'Annulla', value: null }, { label: 'Metti nella stanza', value: true, primary: true }]
    });
    if (!ok) return;
    const n = place(rid, res.items, { clear });
    U().toast(n + ' elementi messi in ' + room.name + ': trascina il riquadro blu per aggiustare, o annulla con ↶');
  };

  /* ---------- 2) Arreda la stanza con l'AI ---------- */
  RA.furnish = async function (roomId) {
    const ed = app().editor();
    const plan = ed.plan;
    if (!(await needAI())) return;
    let rid = roomId;
    if (!rid) {
      rid = await U().menu('Quale stanza arredo?', Object.keys(plan.rooms).map(id => ({ id, label: plan.rooms[id].name, icon: 'room' })));
      if (!rid) return;
    }
    const room = plan.rooms[rid];
    const styles = (CM.style && CM.style.all ? CM.style.all() : []).map(s => s.label);
    let style = styles[0] || 'Moderno';
    let clear = Object.values(plan.furniture).some(f => P.roomOf(plan, f) === rid);
    const ta = el('textarea', { rows: 3, placeholder: 'Es. divano grande verso la TV, tavolo per 6, angolo lettura. Lascia vuoto per una proposta libera.', style: 'width:100%', 'aria-label': 'Esigenze' });
    const body = el('div');
    const draw = () => {
      body.innerHTML = '';
      body.append(
        el('div', { class: 'sec-title', text: 'Stile' }),
        el('div', { class: 'chips-row wrap' }, styles.map(s => el('button', { class: 'chip small' + (s === style ? ' active' : ''), text: s, onclick: () => { style = s; draw(); } }))),
        el('div', { class: 'sec-title', text: 'Cosa ti serve' }), ta,
        el('label', { class: 'check' }, [el('input', { type: 'checkbox', checked: clear, onchange: (e) => { clear = e.target.checked; } }), el('span', { text: 'Togli i mobili che ci sono adesso' })])
      );
    };
    draw();
    const ok = await U().dialog({ title: '✨ Arreda ' + room.name, text: 'L’AI sceglie e dispone i mobili tenendo conto di porte, finestre e passaggi. Se non ti piace, annulli con ↶.', body, actions: [{ label: 'Annulla', value: null }, { label: 'Arreda', value: true, primary: true }] });
    if (!ok) return;
    const inn = interior(plan, rid);
    const rel = (p) => [CM.r3((p.x - inn.x0) * 100), CM.r3((p.y - inn.y0) * 100)];
    const ops = Object.values(plan.openings).filter(o => P.roomWalls(plan, room).includes(o.wall)).map(o => { const g = P.openingGeom(plan, o); const c = rel(g.c); return { tipo: CM.OPENINGS[o.kind].label, larghezza_cm: Math.round(o.w * 100), centro_cm: c }; });
    const keep = clear ? [] : Object.values(plan.furniture).filter(f => P.roomOf(plan, f) === rid).map(f => ({ nome: f.name, centro_cm: rel(f), w: Math.round(f.w * 100), d: Math.round(f.d * 100) }));
    const cats = { soggiorno: ['soggiorno', 'illuminazione', 'tessili', 'decorazioni', 'elettronica'], cucina: ['cucina', 'elettrodomestici', 'illuminazione'], camera: ['camera', 'tessili', 'illuminazione', 'decorazioni'], cameretta: ['camera', 'studio', 'tessili', 'illuminazione'], bagno: ['bagno', 'decorazioni'], studio: ['studio', 'illuminazione', 'decorazioni'] }[room.type] || ['soggiorno', 'camera', 'studio', 'illuminazione', 'decorazioni', 'tessili'];
    const catalog = CM.lib.catalog().filter(i => cats.includes(i.cat) && i.shape !== 'composite').slice(0, 120).map(i => ({ id: i.id, nome: i.name, cm: [Math.round(i.w * 100), Math.round(i.d * 100), Math.round((i.h || 0) * 100)] }));
    const prompt = 'Sei un arredatore italiano. Arreda la stanza "' + room.name + '" (' + CM.roomType(room.type).label + '), stile ' + style + '. ' +
      'Interno della stanza: ' + Math.round((inn.x1 - inn.x0) * 100) + ' × ' + Math.round((inn.y1 - inn.y0) * 100) + ' cm; contorno (cm, origine angolo interno in alto a sinistra, x a destra, y in basso): ' + JSON.stringify(inn.pts.map(rel)) + '. ' +
      'Porte e finestre: ' + JSON.stringify(ops) + '. ' + (keep.length ? 'Mobili già presenti da lasciare: ' + JSON.stringify(keep) + '. ' : '') +
      'Esigenze: ' + (ta.value.trim() || 'proposta libera, funzionale e accogliente') + '. ' +
      'Usa SOLO articoli di questo catalogo (id, nome, [larghezza, profondità, altezza] cm): ' + JSON.stringify(catalog) + '. ' +
      'Regole: passaggi di almeno 70 cm; non davanti alle porte (lascia libero 90 cm davanti a ogni porta) né sotto le finestre con mobili alti; armadi, letti, librerie e divani con lo schienale contro una parete se possibile; niente sovrapposizioni; tutto dentro la stanza. ' +
      'Rispondi SOLO JSON: {"spiegazione":"2 frasi","mobili":[{"id":"id del catalogo","x_cm":centro,"y_cm":centro,"rotazione_gradi":0,"contro_parete":true}]}. rotazione_gradi: 0 = schienale verso l’alto, 90 = verso destra, 180 = verso il basso, 270 = verso sinistra.';
    U().toast('Gemini sta arredando ' + room.name + '…');
    let j;
    try { j = await CM.ai.text(prompt, { json: true }); } catch (e) { U().toast(CM.ai.errorText(e)); return; }
    const items = (j.mobili || []).map(m => {
      const it = CM.lib.item(m.id);
      if (!it) return null;
      return Object.assign(CM.clone(it), { x: num(m.x_cm, 0) / 100, y: num(m.y_cm, 0) / 100, rot: ((num(m.rotazione_gradi, 0) % 360) + 360) % 360 * Math.PI / 180, wall: !!m.contro_parete });
    }).filter(Boolean);
    if (!items.length) { U().toast('Nessuna proposta utilizzabile, riprova'); return; }
    const n = place(rid, items, { clear });
    U().toast((j.spiegazione ? j.spiegazione + ' ' : '') + '(' + n + ' mobili) · non ti piace? ↶ Annulla');
  };
})(typeof window !== 'undefined' ? window : globalThis);
