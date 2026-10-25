/* Casa Mia — dalla foto al mobile (solo al computer).
   L'AI guarda la foto (sito del negozio, Pinterest, Instagram...) e ricava tipo, forma per il 3D,
   colori, materiali e, se scritte, misure e prezzo. Si possono caricare tante foto insieme. */
(function (root) {
  'use strict';
  const CM = root.CM;
  const PA = CM.photoAI = {};
  const U = () => CM.ui;
  const el = (...a) => CM.ui.el(...a);

  const SHAPES = ['box', 'sofa', 'sofa_l', 'armchair', 'bed', 'table', 'round_table', 'chair', 'wardrobe', 'cabinet', 'kitchen_base', 'kitchen_wall', 'kitchen_tall', 'sink', 'hob', 'fridge', 'washer', 'tv', 'shelf', 'desk', 'wc', 'basin', 'shower', 'bath', 'rug', 'plant', 'lamp_floor', 'lamp_ceiling', 'curtain', 'mirror', 'picture', 'tree', 'umbrella', 'lounger'];
  const TYPICAL = { // misure tipiche in metri se la foto non le dice
    sofa: [2.1, 0.92, 0.85], sofa_l: [2.7, 1.6, 0.85], armchair: [0.85, 0.85, 0.9], bed: [1.6, 2.05, 1.0], table: [1.6, 0.9, 0.75], round_table: [1.1, 1.1, 0.75],
    chair: [0.45, 0.52, 0.85], wardrobe: [1.5, 0.6, 2.36], cabinet: [1.6, 0.45, 0.8], kitchen_base: [0.6, 0.6, 0.9], kitchen_wall: [0.6, 0.35, 0.7], kitchen_tall: [0.6, 0.6, 2.1],
    sink: [0.8, 0.6, 0.9], hob: [0.6, 0.6, 0.9], fridge: [0.6, 0.65, 1.85], washer: [0.6, 0.6, 0.85], tv: [1.25, 0.08, 0.72], shelf: [0.8, 0.3, 2.0], desk: [1.2, 0.6, 0.75],
    wc: [0.36, 0.55, 0.4], basin: [0.8, 0.46, 0.85], shower: [0.9, 0.9, 2.0], bath: [1.7, 0.75, 0.55], rug: [2.0, 1.4, 0.01], plant: [0.5, 0.5, 1.2], lamp_floor: [0.4, 0.4, 1.6],
    lamp_ceiling: [0.45, 0.45, 0.3], curtain: [1.4, 0.1, 2.6], mirror: [0.6, 0.03, 0.9], picture: [0.7, 0.03, 0.5], tree: [1.5, 1.5, 3], umbrella: [2.5, 2.5, 2.4], lounger: [0.65, 1.9, 0.4], box: [0.8, 0.5, 0.8]
  };

  PA.enabled = () => !!(CM.ai && CM.ai.enabled());
  async function needAI() {
    if (PA.enabled()) return true;
    await CM.share.aiSettings();
    return PA.enabled();
  }

  // Analizza una foto (e, se c'è, il testo copiato dalla pagina del negozio)
  PA.analyze = async function (img, text) {
    const cats = CM.CATEGORIES.filter(c => !CM.MATERIAL_CATS.includes(c.id)).map(c => c.id).join(', ');
    const prompt = 'Sei un arredatore italiano. Guarda la foto di un mobile o oggetto d’arredo (può venire dal sito di un negozio, da Pinterest o Instagram).' +
      (text ? ' Ecco anche il testo della pagina del prodotto, usalo per nome, misure e prezzo:\n"""' + String(text).slice(0, 6000) + '"""\n' : ' ') +
      'Se nella foto ci sono più oggetti, descrivi quello principale. Rispondi SOLO con JSON con questi campi: ' +
      '{"nome": nome breve in italiano (con marca e modello se si leggono), "categoria": una tra [' + cats + '], ' +
      '"forma": una tra [' + SHAPES.join(', ') + '] (la più simile per disegnarlo in 3D), ' +
      '"larghezza_cm": numero, "profondita_cm": numero, "altezza_cm": numero, "misure_lette": true se le misure sono scritte nella foto o nel testo, false se le stimi, ' +
      '"prezzo_euro": numero o null, "negozio": nome del negozio se riconoscibile o "", ' +
      '"colore": colore principale in esadecimale #RRGGBB, ' +
      '"tessuto": uno tra [' + CM.FABRICS.map(f => f.id).join(', ') + '] o null se non è imbottito, ' +
      '"legno": uno tra [' + CM.WOODS.map(w => w.id).join(', ') + '] o null, ' +
      '"metallo": uno tra [' + CM.METALS.map(m => m.id).join(', ') + '] o null (gambe, maniglie), ' +
      '"descrizione": una frase su stile e materiali}.';
    return CM.ai.text(prompt, { json: true, images: [img] });
  };

  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) && n > 0 ? n : null; };
  const hex = (c) => /^#[0-9a-f]{6}$/i.test(c || '') ? c.toUpperCase() : null;

  // Dal risultato dell'AI ai campi di un mobile
  PA.toFields = function (j) {
    j = j || {};
    const shape = SHAPES.includes(j.forma) ? j.forma : 'box';
    const typ = TYPICAL[shape] || TYPICAL.box;
    const w = num(j.larghezza_cm), d = num(j.profondita_cm), h = num(j.altezza_cm);
    const out = {
      name: String(j.nome || '').trim().slice(0, 80) || 'Mobile dalla foto',
      cat: CM.CATEGORIES.some(c => c.id === j.categoria) ? j.categoria : 'altro',
      shape,
      w: CM.r3(w ? w / 100 : typ[0]), d: CM.r3(d ? d / 100 : typ[1]), h: CM.r3(h ? h / 100 : typ[2]),
      measured: !!(j.misure_lette && w && d && h),
      price: num(j.prezzo_euro),
      store: String(j.negozio || '').slice(0, 40),
      color: hex(j.colore) || '#D9D4CB',
      note: String(j.descrizione || '').slice(0, 200)
    };
    if (CM.FABRICS.some(f => f.id === j.tessuto)) out.fabric = j.tessuto;
    if (CM.WOODS.some(f => f.id === j.legno)) out.wood = j.legno;
    if (CM.METALS.some(f => f.id === j.metallo)) out.metal = j.metallo;
    out.light = /^lamp/.test(shape);
    if (shape === 'lamp_ceiling') out.elev = 2.3;
    if (shape === 'kitchen_wall') out.elev = 1.45;
    if (['mirror', 'picture'].includes(shape)) out.elev = 1.2;
    return out;
  };

  // Un solo mobile: riconosce la foto e propone i dati prima di applicarli
  PA.recognize = async function (img, opts) {
    opts = opts || {};
    if (!img) { U().toast('Prima aggiungi la foto'); return null; }
    if (!(await needAI())) return null;
    const ta = el('textarea', { rows: 4, placeholder: 'Facoltativo: incolla qui il testo della pagina del negozio (misure, prezzo). Aiuta molto con le misure.', 'aria-label': 'Testo della pagina del prodotto', style: 'width:100%' });
    const go = await U().dialog({ title: 'Riconosci il mobile dalla foto', text: 'L’AI guarda la foto e prepara il mobile per il 3D: forma, colori, materiali e, se le trova, misure e prezzo.', body: el('div', {}, [el('img', { src: img, alt: '', style: 'max-width:100%;max-height:180px;display:block;margin:0 auto 8px;border-radius:8px' }), ta]), actions: [{ label: 'Annulla', value: null }, { label: 'Riconosci', value: () => ta.value || ' ', primary: true }] });
    if (!go) return null;
    U().toast('Gemini guarda la foto…');
    let fields;
    try { fields = PA.toFields(await PA.analyze(img, go.trim())); } catch (e) { U().toast(CM.ai.errorText(e)); return null; }
    return PA.review(fields, img, opts);
  };

  // Mostra cosa ha capito l'AI: si può correggere prima di confermare
  PA.review = async function (v, img, opts) {
    opts = opts || {};
    const shapeLabel = (s) => (CM.tabs.SHAPES || []).find(x => x[0] === s);
    const fields = el('div', { class: 'fields' }, [
      U().textField('Nome', v.name, x => { v.name = x; }),
      U().selectField('Categoria', CM.CATEGORIES.filter(c => !CM.MATERIAL_CATS.includes(c.id)).map(c => ({ value: c.id, label: c.label })), v.cat, x => { v.cat = x; }, { full: false }),
      U().selectField('Forma nel 3D', SHAPES.map(s => ({ value: s, label: (shapeLabel(s) || [s, s])[1] })), v.shape, x => { v.shape = x; }, { full: false }),
      U().numField('Larghezza', v.w, 'cm', x => { v.w = x; }, { min: 0.02, max: 20 }),
      U().numField('Profondità', v.d, 'cm', x => { v.d = x; }, { min: 0.01, max: 20 }),
      U().numField('Altezza', v.h, 'cm', x => { v.h = x; }, { min: 0.01, max: 8 }),
      CM.sheets.moneyField('Prezzo', v.price, x => { v.price = x; }),
      U().textField('Negozio', v.store || '', x => { v.store = x; }, { full: false }),
      CM.sheets.colorField('Colore', v.color, x => { v.color = x; })
    ]);
    const fin = [v.fabric && 'tessuto ' + CM.FABRICS.find(f => f.id === v.fabric).label.toLowerCase(), v.wood && 'legno ' + CM.WOODS.find(f => f.id === v.wood).label.toLowerCase(), v.metal && 'metallo ' + CM.METALS.find(f => f.id === v.metal).label.toLowerCase()].filter(Boolean).join(', ');
    const body = el('div', {}, [
      el('div', { style: 'display:flex;gap:12px;align-items:center;margin-bottom:8px' }, [
        el('img', { src: img, alt: '', style: 'width:96px;height:96px;object-fit:contain;background:#fff;border-radius:8px;flex-shrink:0' }),
        el('div', { class: 'small' }, [
          el('div', { html: v.measured ? '<b>✓ Misure lette</b> dalla foto o dalla pagina' : '<b>Misure stimate</b>: controllale sull’etichetta o sul sito' }),
          fin ? el('div', { class: 'muted', text: 'Materiali: ' + fin }) : null,
          v.note ? el('div', { class: 'muted', text: v.note }) : null
        ])
      ]),
      fields
    ]);
    const ok = await U().dialog({ title: 'Ecco cosa ho capito', body, actions: [{ label: 'Annulla', value: null }, { label: opts.confirm || 'Conferma', value: true, primary: true }] });
    return ok ? v : null;
  };

  // Tante foto insieme: per ognuna un articolo nel catalogo
  PA.batch = async function (files) {
    files = [...(files || [])].filter(f => /^image\//.test(f.type));
    if (!files.length) { U().toast('Nessuna immagine tra i file scelti'); return 0; }
    const useAI = await (async () => {
      if (PA.enabled()) return true;
      const r = await U().dialog({ title: files.length + ' foto', text: 'Con l’assistente AI (Gemini) ogni foto diventa un mobile già pronto: tipo, forma, colori, materiali e misure. Senza, creo gli articoli con la foto e li completi tu.', actions: [{ label: 'Senza AI', value: 'no' }, { label: 'Usa l’AI', value: 'ai', primary: true }] });
      if (r === 'ai') { await CM.share.aiSettings(); return PA.enabled(); }
      return r ? false : null;
    })();
    if (useAI === null) return 0;
    const bar = el('div', { class: 'batch-bar' }, [el('i')]);
    const lbl = el('div', { class: 'small', text: 'Preparo le foto…' });
    const list = el('div', { class: 'batch-list' });
    let stop = false;
    U().dialog({ title: 'Carico le foto', body: el('div', {}, [lbl, bar, list]), actions: [{ label: 'Interrompi', value: 'stop' }] }).then(r => { if (r === 'stop') stop = true; });
    let n = 0;
    for (let i = 0; i < files.length && !stop; i++) {
      const f = files[i];
      lbl.textContent = 'Foto ' + (i + 1) + ' di ' + files.length + (useAI ? ' · l’AI la sta guardando…' : '');
      bar.firstChild.style.width = Math.round(i / files.length * 100) + '%';
      const img = await CM.inspire.shrink(f, 600);
      if (!img) continue;
      let v;
      if (useAI) {
        try { v = PA.toFields(await PA.analyze(img, '')); }
        catch (e) {
          const msg = CM.ai.errorText(e);
          list.appendChild(el('div', { class: 'small', text: '⚠︎ ' + f.name + ': ' + msg }));
          if (/Limite|chiave/i.test(msg)) stop = true;
          v = null;
        }
        if (i < files.length - 1) await new Promise(r => setTimeout(r, 800));
      }
      if (!v) v = Object.assign(PA.toFields({ forma: 'box' }), { name: f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').slice(0, 60) || 'Mobile' });
      const it = Object.assign({ id: CM.uid('c'), elev: 0, url: '' }, v, { img });
      delete it.measured; delete it.note;
      CM.lib.saveItem(it);
      n++;
      list.prepend(el('div', { class: 'batch-row' }, [el('img', { src: img, alt: '' }), el('span', { text: it.name + ' · ' + Math.round(it.w * 100) + '×' + Math.round(it.d * 100) + '×' + Math.round(it.h * 100) + ' cm' + (v.measured ? '' : ' (stimate)') })]));
    }
    bar.firstChild.style.width = '100%';
    const dl = [...document.querySelectorAll('.dialog')].pop();
    const btn = dl && dl.querySelector('.actions button');
    if (btn && !stop) { btn.textContent = 'Chiudi'; btn.classList.add('primary'); }
    lbl.textContent = n + ' articoli aggiunti a “I miei articoli”.' + (useAI ? ' Le misure con “(stimate)” vanno controllate.' : ' Aprili per completare misure e tipo.');
    return n;
  };

  // Riquadro per l'Arredo: trascina tante foto o scegli una cartella
  PA.batchBox = function (onDone) {
    const pick = (dir) => {
      const i = el('input', { type: 'file', accept: 'image/*', multiple: true });
      if (dir) i.setAttribute('webkitdirectory', '');
      i.addEventListener('change', async () => { const n = await PA.batch(i.files); if (n && onDone) onDone(); });
      i.click();
    };
    const box = el('div', { class: 'photo-drop batch-drop' }, [
      el('div', { class: 'photo-ph', html: U().icon('camera', 28) }),
      el('div', { class: 'photo-txt' }, [
        el('b', { text: 'Mobili dalle foto' }),
        el('span', { class: 'muted small', text: 'Trascina qui le foto dei mobili (dai siti dei negozi, Pinterest, Instagram): l’AI riconosce tipo, misure, colori e materiali e crea gli articoli pronti da mettere in casa.' }),
        el('div', { class: 'actions' }, [
          el('button', { class: 'btn small primary', text: 'Scegli le foto…', onclick: () => pick(false) }),
          el('button', { class: 'btn small', text: 'Una cartella intera…', onclick: () => pick(true) })
        ])
      ])
    ]);
    box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('over'); });
    box.addEventListener('dragleave', () => box.classList.remove('over'));
    box.addEventListener('drop', async e => {
      e.preventDefault(); box.classList.remove('over');
      const dt = e.dataTransfer;
      let files = [...(dt.files || [])];
      if (!files.length) { const one = await CM.imageFromData(dt); if (one) { const b = await (await fetch(one)).blob(); files = [new File([b], 'foto.jpg', { type: 'image/jpeg' })]; } }
      const n = await PA.batch(files);
      if (n && onDone) onDone();
    });
    return box;
  };
})(typeof window !== 'undefined' ? window : globalThis);
