/* Casa Mia — importazione dai negozi, classificazione, aggiornamento prezzi */
(function (root) {
  'use strict';
  const CM = root.CM;
  const U = () => CM.ui;
  const el = (...a) => CM.ui.el(...a);
  const native = () => window.CasaMiaAndroid;

  const STORES = [
    ['IKEA', 'https://www.ikea.com/it/it/'],
    ['Mondo Convenienza', 'https://www.mondoconv.it/'],
    ['Leroy Merlin', 'https://www.leroymerlin.it/'],
    ['Tecnomat', 'https://www.tecnomat.it/'],
    ['Bricoman', 'https://www.bricoman.it/'],
    ['Brico Center', 'https://www.bricocenter.it/'],
    ['Maisons du Monde', 'https://www.maisonsdumonde.com/IT/it'],
    ['Poltronesofà', 'https://www.poltronesofa.com/it/'],
    ['Deghi', 'https://www.deghi.it/'],
    ['Unieuro', 'https://www.unieuro.it/'],
    ['MediaWorld', 'https://www.mediaworld.it/'],
    ['Euronics', 'https://www.euronics.it/'],
    ['Amazon', 'https://www.amazon.it/']
  ];
  const HOSTS = { ikea: 'IKEA', mondoconv: 'Mondo Convenienza', leroymerlin: 'Leroy Merlin', tecnomat: 'Tecnomat', bricoman: 'Bricoman', bricocenter: 'Brico Center', maisonsdumonde: 'Maisons du Monde', poltronesofa: 'Poltronesofà', deghi: 'Deghi', unieuro: 'Unieuro', mediaworld: 'MediaWorld', euronics: 'Euronics', amazon: 'Amazon', chateaudax: 'Chateau d’Ax', scavolini: 'Scavolini', kasanova: 'Kasanova', obi: 'OBI', iperceramica: 'Iperceramica', bauhaus: 'Bauhaus' };
  function storeName(host) {
    host = String(host || '').toLowerCase();
    for (const k in HOSTS) if (host.includes(k)) return HOSTS[k];
    const parts = host.replace(/^www\./, '').split('.');
    return parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : 'Negozio';
  }

  /* ---------- Classificazione ---------- */
  const RULES = [
    ['pavimenti', /piastrell|gres|parquet|laminat|pavimento|rivestiment|mosaic|ceramic|cotto|resina|klinker|vinilic|lvt|spc/],
    ['pitture', /pittura|idropittura|vernice|smalto murale|carta da parati|tappezzeria|fondo fissativo|tinta/],
    ['bagno', /\bwc\b|vaso |sanitari|bidet|lavabo|lavandino|doccia|vasca|rubinett|miscelator|mobile bagno|piatto doccia/],
    ['cucina', /cucina|pensile|lavello|piano cottura|cappa|base cucina|isola|penisola|colonna forno/],
    ['elettrodomestici', /frigo|lavatrice|asciugatric|lavastovigli|forno|microonde|congelator|climatizzator|condizionator|aspirapolver/],
    ['elettronica', /\btv\b|televisor|smart tv|soundbar|monitor|notebook|\bpc\b|console|router|altoparlant|speaker/],
    ['illuminazione', /lampad|lampadario|applique|plafonier|faretto|sospensione|lume|piantana|\bled\b/],
    ['tessili', /tenda|tappeto|cuscin|piumon|copriletto|lenzuol|plaid|tovagli/],
    ['decorazioni', /quadro|specchio|vaso decor|pianta|cornice|decorazion|orologio da parete|stampa/],
    ['studio', /scrivania|sedia (da )?ufficio|poltrona ufficio|cassettiera ufficio/],
    ['esterni', /giardino|da esterno|outdoor|ombrellon|gazebo|pergol|barbecue|sdraio|lettino|recinzion|siepe/],
    ['camera', /letto|materasso|comodino|armadio|cassettiera|guardaroba|rete a doghe|testiera/],
    ['soggiorno', /divano|poltrona|tavolo|sedia|libreria|madia|credenza|mobile tv|tavolino|sgabello|vetrina|pouf/],
    ['serramenti', /porta interna|porta |finestra|zanzarier|maniglia|portoncino|serrament/]
  ];
  const SHAPE_RULES = [
    [/divano ad angolo|angolare/, 'sofa_l'], [/divano/, 'sofa'], [/poltrona(?! ufficio)/, 'armchair'], [/letto|materasso/, 'bed'],
    [/tavolo rotondo|tavolo tondo/, 'round_table'], [/tavol/, 'table'], [/sedia ufficio|sedia da ufficio/, 'chair'], [/sedia|sgabello/, 'chair'],
    [/armadio|guardaroba/, 'wardrobe'], [/pensile/, 'kitchen_wall'], [/colonna/, 'kitchen_tall'], [/lavello/, 'sink'], [/piano cottura/, 'hob'],
    [/base cucina|cucina/, 'kitchen_base'], [/comodino|cassettiera|credenza|madia|mobile/, 'cabinet'], [/libreria|scaffal/, 'shelf'],
    [/scrivania/, 'desk'], [/frigo|congelator/, 'fridge'], [/lavatrice|asciugatric/, 'washer'], [/lavastovigli/, 'kitchen_base'],
    [/\btv\b|televisor|monitor/, 'tv'], [/lampadario|sospensione|plafonier/, 'lamp_ceiling'], [/lampad|piantana|lume/, 'lamp_floor'],
    [/tappeto/, 'rug'], [/tenda/, 'curtain'], [/specchio/, 'mirror'], [/quadro|stampa|cornice/, 'picture'], [/pianta/, 'plant'],
    [/\bwc\b|vaso/, 'wc'], [/bidet/, 'bidet'], [/lavabo|lavandino/, 'basin'], [/doccia/, 'shower'], [/vasca/, 'bath'],
    [/ombrellon/, 'umbrella'], [/gazebo|pergol/, 'pergola'], [/sdraio|lettino/, 'lounger'], [/climatizzator|condizionator/, 'box']
  ];

  function parseDims(text) {
    const t = ' ' + String(text || '').toLowerCase().replace(/,/g, '.') + ' ';
    const out = {};
    const unitK = (u) => (u && /mm/.test(u) ? 0.001 : u && /\bm\b/.test(u) && !/cm/.test(u) ? 1 : 0.01);
    let m = t.match(/(?:l|larg\w*)\s*[.:]?\s*(\d+(?:\.\d+)?)\s*(cm|mm)?\s*[x×]\s*(?:p|prof\w*)\s*[.:]?\s*(\d+(?:\.\d+)?)\s*(cm|mm)?\s*[x×]\s*(?:h|alt\w*)\s*[.:]?\s*(\d+(?:\.\d+)?)\s*(cm|mm)?/);
    if (m) { const k = unitK(m[6] || m[4] || m[2]); out.w = +m[1] * k; out.d = +m[3] * k; out.h = +m[5] * k; return out; }
    m = t.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(cm|mm|m)\b/);
    if (m) { const k = unitK(m[4]); out.w = +m[1] * k; out.d = +m[2] * k; out.h = +m[3] * k; return out; }
    const one = (re) => { const x = t.match(re); return x ? +x[1] * unitK(x[2]) : null; };
    const w = one(/larghezza[^\d]{0,20}(\d+(?:\.\d+)?)\s*(cm|mm|m)?/), d = one(/profondit\S*[^\d]{0,20}(\d+(?:\.\d+)?)\s*(cm|mm|m)?/), h = one(/altezza[^\d]{0,20}(\d+(?:\.\d+)?)\s*(cm|mm|m)?/);
    if (w) out.w = w; if (d) out.d = d; if (h) out.h = h;
    // formato piastrella (es. 60x120 cm)
    m = t.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(cm|mm)?(?!\s*[x×])/);
    if (m) { const k = m[3] === 'mm' ? 0.001 : 0.01; out.fa = +m[1] * k; out.fb = +m[2] * k; }
    // pollici TV
    m = t.match(/(\d{2,3})\s*(?:pollici|"|''|”)/);
    if (m) { const inch = +m[1] * 0.0254; out.w = inch * 0.872; out.h = inch * 0.49; out.d = 0.08; }
    m = t.match(/(\d+(?:\.\d+)?)\s*m[²2]\s*(?:\/|per|a)?\s*(?:conf|scatola|pacco|collo)/) || t.match(/(?:conf\w*|scatola|pacco)[^\d]{0,25}(\d+(?:\.\d+)?)\s*m[²2]/);
    if (m) out.boxM2 = +m[1];
    m = t.match(/(\d+(?:\.\d+)?)\s*(?:l|lt|litri)\b/);
    if (m && +m[1] <= 30) out.liters = +m[1];
    m = t.match(/resa[^\d]{0,20}(\d+(?:\.\d+)?)\s*(?:-\s*\d+\s*)?m[²2]/);
    if (m) out.resa = +m[1];
    return out;
  }

  function classify(it, ctx) {
    const hay = (it.name + ' ' + (it.category || '') + ' ' + (ctx.crumbs || '') + ' ' + (it.url || '')).toLowerCase();
    let cat = 'altro';
    for (const [c, re] of RULES) if (re.test(hay)) { cat = c; break; }
    return cat;
  }

  function toCandidate(it, ctx) {
    const cat = classify(it, ctx);
    const dims = parseDims(it.name + ' ' + (it.desc || ''));
    const store = storeName(ctx.host);
    const lower = (it.name + ' ' + (it.desc || '')).toLowerCase();
    if (cat === 'pavimenti') {
      const type = /parquet|laminat|vinilic|lvt|spc/.test(lower) ? 'parquet' : /resina/.test(lower) ? 'resina' : 'piastrella';
      const perM2 = /\/\s*m[²2]|al\s*m[²2]|€\s*\/\s*mq|\/mq/.test(lower);
      let price = it.price;
      if (price != null && !perM2 && dims.boxM2) price = price / dims.boxM2; // prezzo a confezione → al m²
      return { kind: 'material', cat, store, url: it.url, img: it.img, name: it.name, data: { type, cat: 'pavimenti', tw: dims.fa || 0.6, th: dims.fb || 0.6, boxM2: dims.boxM2 || 1.44, price: price != null ? Math.round(price * 100) / 100 : null, color: '#C9C6C0', tex: type === 'parquet' ? 'wood' : 'tile' } };
    }
    if (cat === 'pitture') {
      if (/carta da parati|tappezzeria/.test(lower)) return { kind: 'material', cat, store, url: it.url, img: it.img, name: it.name, data: { type: 'carta', cat: 'pitture', rollW: 0.53, rollL: 10.05, repeat: 0.53, price: it.price, color: '#DCD3C2', tex: 'pattern' } };
      const L = dims.liters || 5;
      return { kind: 'material', cat, store, url: it.url, img: it.img, name: it.name, data: { type: 'pittura', cat: 'pitture', canL: L, resa: dims.resa || 10, price: it.price != null ? Math.round(it.price / L * 100) / 100 : null, color: '#EDEBE6', code: '' } };
    }
    let shape = 'box';
    for (const [re, s] of SHAPE_RULES) if (re.test(lower)) { shape = s; break; }
    const ref = CM.FURNITURE_BASE.find(f => f.shape === shape) || { w: 0.8, d: 0.6, h: 0.8, color: '#D9D4CB', elev: 0 };
    return {
      kind: 'item', cat, store, url: it.url, img: it.img, name: it.name,
      data: { shape, w: dims.w || ref.w, d: dims.d || ref.d, h: dims.h || ref.h, elev: ref.elev || 0, color: ref.color, price: it.price, light: /^lamp/.test(shape), dimsFound: !!(dims.w && dims.d) }
    };
  }

  const SHOP = CM.shop = {
    STORES, storeName, parseDims, classify,

    open() {
      const input = el('input', { type: 'url', placeholder: 'https://www.negozio.it/categoria/...', 'aria-label': 'Indirizzo del negozio', inputmode: 'url' });
      const chips = el('div', { class: 'chips-row wrap' }, STORES.map(([n, u]) => el('button', { class: 'chip small', text: n, onclick: () => { input.value = u; } })));
      const body = el('div', {}, [
        el('p', { text: 'Incolla il link di un negozio, di una sua sezione o di un prodotto. Si apre qui dentro: naviga fino agli articoli che ti interessano e tocca “Importa”. Leggo nome, prezzo, foto e misure e li divido per categoria.' }),
        el('div', { class: 'field full' }, [el('label', { text: 'Link' }), input]),
        el('div', { class: 'sec-title', text: 'Oppure parti da' }), chips
      ]);
      U().dialog({ title: 'Importa da un negozio', body, actions: [{ label: 'Annulla', value: null }, { label: 'Apri', value: () => input.value, primary: true }] }).then(url => {
        if (!url) return;
        url = url.trim();
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        if (native() && native().openShop) native().openShop(url);
        else { window.open(url, '_blank'); U().toast('L’importazione funziona nell’app sul telefono'); }
      });
    },

    async review(res) {
      const ctx = { host: res.host, crumbs: res.crumbs };
      let cands = res._cands || (res.items || []).map(it => toCandidate(it, ctx));
      if (!cands.length && CM.ai.enabled()) {
        U().toast('Non trovo articoli leggibili: chiedo a Gemini…');
        cands = await SHOP.aiExtract(res);
      }
      if (!cands.length) {
        U().dialog({ title: 'Nessun articolo trovato', text: 'In questa pagina non riesco a leggere prodotti con prezzo. Prova ad aprire la pagina di una categoria o di un singolo prodotto' + (CM.ai.enabled() ? '.' : ', oppure aggiungi la chiave Gemini per un aiuto in più.') });
        return;
      }
      const selected = cands.map(() => true);
      const list = el('div', { class: 'import-list' });
      const render = () => {
        list.innerHTML = '';
        cands.forEach((c, i) => {
          const sel = el('select', { 'aria-label': 'Categoria di ' + c.name }, CM.CATEGORIES.map(cat => el('option', { value: cat.id, selected: cat.id === c.cat }, cat.label)));
          sel.addEventListener('change', () => {
            const was = c.cat;
            c.cat = sel.value;
            if (CM.MATERIAL_CATS.includes(c.cat) !== CM.MATERIAL_CATS.includes(was)) { cands[i] = toCandidate({ name: c.name, url: c.url, img: c.img, price: c.data.price, category: CM.categoryLabel(c.cat) }, ctx); cands[i].cat = c.cat; render(); }
          });
          const cb = el('input', { type: 'checkbox', checked: selected[i], 'aria-label': 'Importa ' + c.name, onchange: (e) => { selected[i] = e.target.checked; } });
          const dims = c.kind === 'item' ? (c.data.dimsFound ? Math.round(c.data.w * 100) + '×' + Math.round(c.data.d * 100) + '×' + Math.round(c.data.h * 100) + ' cm' : 'misure standard, da verificare') : c.data.type === 'pittura' ? c.data.canL + ' L' : c.data.type === 'carta' ? 'rotolo' : Math.round(c.data.tw * 100) + '×' + Math.round(c.data.th * 100) + ' cm';
          list.appendChild(el('div', { class: 'import-row' }, [
            el('label', { class: 'check' }, [cb]),
            c.img ? el('img', { class: 'thumb', src: c.img, alt: '', loading: 'lazy' }) : el('div', { class: 'thumb' }),
            el('div', { class: 'ir-body' }, [
              el('div', { class: 'ir-name', text: c.name }),
              el('div', { class: 'ir-meta', text: (c.data.price != null ? CM.fmt.num(c.data.price, 2) + ' €' + (c.kind === 'material' ? (c.data.type === 'pittura' ? '/L' : c.data.type === 'carta' ? '' : '/m²') : '') : 'senza prezzo') + ' · ' + dims }),
              sel
            ])
          ]));
        });
      };
      render();
      const store = storeName(res.host);
      const body = el('div', {}, [el('p', { text: cands.length + ' articoli trovati su ' + store + '. Controlla le categorie, togli la spunta a quelli che non vuoi e importa.' }), list]);
      const actions = [{ label: 'Annulla', value: null }];
      if (CM.ai.enabled()) actions.unshift({ label: 'Migliora con Gemini', value: 'ai' });
      actions.push({ label: 'Importa', value: 'ok', primary: true });
      const r = await U().dialog({ title: 'Articoli trovati', body, actions });
      if (r === 'ai') {
        U().toast('Gemini sta leggendo la pagina…');
        const better = await SHOP.aiExtract(res);
        if (better.length) return SHOP.review(Object.assign({}, res, { items: [] , _cands: better })).catch(() => {});
        return;
      }
      if (r !== 'ok') return;
      const chosen = cands.filter((c, i) => selected[i] && c.img && /^https?:/i.test(c.img));
      if (chosen.length) {
        U().toast('Salvo le foto degli articoli…');
        for (let i = 0; i < chosen.length; i += 4) {
          await Promise.all(chosen.slice(i, i + 4).map(async c => {
            const d = await CM.localImage(c.img, c.kind === 'material' ? 1024 : 480);
            if (d) c.img = d;
          }));
        }
      }
      // pagina di un singolo prodotto con il modello 3D: lo scarico e lo collego all'articolo
      const sel1 = cands.filter((c, i) => selected[i] && c.kind === 'item');
      if (sel1.length === 1 && (res.models || []).length) {
        U().toast('Scarico il modello 3D del prodotto\u2026');
        for (const u of res.models.slice(0, 3)) { const id = await CM.saveModel(u); if (id) { sel1[0].model = id; break; } }
        U().toast(sel1[0].model ? 'Modello 3D vero salvato: nel 3D vedrai proprio questo mobile' : 'Modello 3D non disponibile: uso la forma standard');
      }
      // progetto di un planner (PAX, METOD, BEST\u00c5, bagno): propongo di crearlo come composizione
      const comp = CM.config && CM.config.fromProductList(res.items || [], res.text);
      if (comp && (res.items || []).length >= 3) {
        const go = await U().dialog({ title: 'Progetto ' + CM.config.SYSTEMS[comp.system].short + ' riconosciuto', text: 'In questa pagina c\u2019\u00e8 un progetto con ' + comp.modules.length + ' moduli (' + Math.round(comp.w * 100) + ' cm). Lo creo come composizione unica, modificabile nel configuratore e con la lista della spesa?', actions: [{ label: 'No, articoli singoli', value: false }, { label: 'Crea composizione', value: true, primary: true }] });
        if (go) {
          comp.store = store; comp.url = res.url;
          CM.lib.saveItem(Object.assign({ id: CM.uid('c') }, comp));
          if (CM.app && CM.app.project()) { const pl = await U().confirmDialog('Composizione salvata', 'La trovi in I miei articoli. La metto ora in pianta?', 'Metti in pianta'); if (pl) CM.app.placeItem(comp); }
          return;
        }
      }
      let n = 0, lastItem = null;
      cands.forEach((c, i) => {
        if (!selected[i]) return;
        if (c.kind === 'material') {
          CM.lib.saveMaterial(Object.assign({ id: CM.uid('m'), name: c.name, store, url: c.url, img: c.img }, c.data, { cat: c.cat === 'pitture' ? 'pitture' : 'pavimenti' }));
        } else {
          const d = Object.assign({}, c.data); delete d.dimsFound;
          lastItem = Object.assign({ id: CM.uid('c'), name: c.name, cat: c.cat, store, url: c.url, img: c.img }, d, c.model ? { model: c.model } : {});
          CM.lib.saveItem(lastItem);
        }
        n++;
      });
      U().toast(n + ' articoli aggiunti a “I miei articoli”');
      SHOP.syncWatch();
      if (CM.app && CM.app.tab() === 'arredo') CM.app.refreshTab();
      if (n === 1 && lastItem && CM.app && CM.app.project()) {
        const go = await U().confirmDialog('Articolo salvato', 'Lo trovi in Arredo › I miei articoli. Per vederlo in pianta e nel 3D va messo nella casa: lo metto ora?', 'Metti in pianta');
        if (go) CM.app.placeItem(lastItem);
      }
    },

    async aiExtract(res) {
      try {
        const out = await CM.ai.text('Dal testo di questa pagina del negozio ' + res.host + ' estrai i prodotti. Rispondi SOLO JSON: {"prodotti":[{"nome":"","prezzo_euro":numero o null,"larghezza_cm":numero o null,"profondita_cm":numero o null,"altezza_cm":numero o null,"categoria":"una tra: ' + CM.CATEGORIES.map(c => c.id).join(', ') + '"}]}. Testo:\n' + String(res.text || '').slice(0, 10000), { json: true });
        const ctx = { host: res.host, crumbs: res.crumbs };
        return (out.prodotti || []).map(p => {
          const c = toCandidate({ name: p.nome, price: p.prezzo_euro, url: res.url, desc: (p.larghezza_cm && p.profondita_cm ? 'L ' + p.larghezza_cm + ' x P ' + p.profondita_cm + ' x H ' + (p.altezza_cm || 80) + ' cm' : '') }, ctx);
          if (p.categoria && CM.CATEGORIES.some(x => x.id === p.categoria) && CM.MATERIAL_CATS.includes(p.categoria) === CM.MATERIAL_CATS.includes(c.cat)) c.cat = p.categoria;
          return c;
        });
      } catch (e) {
        U().toast(CM.ai.errorText(e));
        return [];
      }
    },

    /* ---------- Prezzi ---------- */
    watched() {
      return CM.lib.catalog().filter(i => !i.base && i.url && i.price != null).map(i => ({ id: i.id, url: i.url, price: +i.price, name: i.name }))
        .concat(CM.lib.materials().filter(m => m.url && m.price != null && !CM.MATERIALS_BASE.includes(m)).map(m => ({ id: m.id, url: m.url, price: +m.price, name: m.name, material: true })));
    },
    syncWatch() {
      if (native() && native().setPriceWatch) native().setPriceWatch(JSON.stringify(SHOP.watched()));
    },
    refreshPrices() {
      const list = SHOP.watched();
      if (!list.length) { U().toast('Nessun articolo importato con link e prezzo'); return; }
      if (!native() || !native().refreshPrices) { U().toast('Funziona nell’app sul telefono'); return; }
      U().toast('Ricontrollo ' + list.length + ' prezzi…');
      native().refreshPrices(JSON.stringify(list));
    }
  };

  /* ---------- Foto dei prodotti salvate dentro l'app ----------
     I siti dei negozi spesso non permettono di usare le loro foto come texture 3D:
     le scarico dal telefono e le conservo come immagini interne. */
  const pendingImages = {};
  CM.onImageFetched = function (id, data) { const cb = pendingImages[id]; delete pendingImages[id]; if (cb) cb(data || null); };
  CM.localImage = function (url, max) {
    if (!url || /^data:/.test(url)) return Promise.resolve(url || null);
    if (!native() || !native().fetchImage) return Promise.resolve(null);
    return new Promise(resolve => {
      const id = CM.uid('img');
      const t = setTimeout(() => { delete pendingImages[id]; resolve(null); }, 30000);
      pendingImages[id] = (d) => { clearTimeout(t); resolve(d); };
      native().fetchImage(url, id, max || 800);
    });
  };

  // Modelli 3D dei negozi (GLB): scaricati dal telefono e salvati nell'app
  const pendingBin = {};
  CM.onBinaryFetched = function (id, data) { const cb = pendingBin[id]; delete pendingBin[id]; if (cb) cb(data || null); };
  CM.fetchModel = function (url) {
    if (!native() || !native().fetchBinary) return Promise.resolve(null);
    return new Promise(resolve => {
      const id = CM.uid('bin');
      const t = setTimeout(() => { delete pendingBin[id]; resolve(null); }, 90000);
      pendingBin[id] = (d) => { clearTimeout(t); resolve(d); };
      native().fetchBinary(url, id);
    });
  };
  // Scarica e salva il modello; restituisce l'id da mettere nell'articolo
  CM.saveModel = async function (url) {
    const d = await CM.fetchModel(url);
    if (!d || d.length < 2000) return null;
    try { await CM.glb.parse(CM.glb.fromDataUrl(d)); } catch (e) { return null; } // formato non leggibile: meglio la forma standard
    const id = CM.uid('glb');
    return CM.store.putRaw('mdl_' + id, d) === false ? null : id;
  };

  // Risultato della pagina del negozio (dal guscio Android)
  CM.onShopResult = function (json) {
    let res;
    try { res = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) { U().toast('Pagina non leggibile'); return; }
    SHOP.review(res);
  };

  // Risultato dell'aggiornamento prezzi: [{id, price}]
  CM.onPriceResults = function (json) {
    let list = [];
    try { list = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) { return; }
    const changes = [];
    for (const r of list) {
      if (!(r.price > 0)) continue;
      const it = CM.lib.item(r.id), m = !it && CM.lib.material(r.id);
      const obj = it || m;
      if (!obj) continue;
      const old = +obj.price;
      const nw = m && m.type === 'pittura' && m.canL ? Math.round(r.price / m.canL * 100) / 100 : r.price;
      if (Math.abs(nw - old) > 0.009) {
        changes.push({ name: obj.name, old, nw });
        obj.oldPrice = old; obj.price = nw;
        if (it) CM.lib.saveItem(obj); else CM.lib.saveMaterial(obj);
      }
    }
    if (!changes.length) { U().toast('Prezzi controllati: nessuna variazione'); return; }
    U().dialog({ title: 'Prezzi aggiornati', body: el('div', {}, changes.map(c => el('div', { class: 'line' }, [el('span', { class: 'l-main', text: c.name }), el('span', { class: 'mono ' + (c.nw < c.old ? 'best' : 'warn'), text: CM.fmt.eur(c.old) + ' → ' + CM.fmt.eur(c.nw) })]))) });
    SHOP.syncWatch();
  };
})(typeof window !== 'undefined' ? window : globalThis);
