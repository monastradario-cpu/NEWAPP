/* Casa Mia — porte, finestre, maniglie, battiscopa e colori su misura (RAL, NCS, contagocce) */
(function (root) {
  'use strict';
  const CM = root.CM;
  const U = () => CM.ui;
  const el = (...a) => CM.ui.el(...a);

  /* ---------- Cataloghi ---------- */
  CM.TRIM = {
    doorModels: [
      { id: 'liscia', label: 'Liscia' },
      { id: 'pannelli', label: 'A pannelli (classica)' },
      { id: 'incisa', label: 'Con incisioni' },
      { id: 'vetro', label: 'Con vetro' },
      { id: 'filomuro', label: 'Filo muro' }
    ],
    doorColors: [
      { id: 'bianco', label: 'Bianco', color: '#F2F0EB' },
      { id: 'avorio', label: 'Avorio', color: '#E8E0CF' },
      { id: 'grigio', label: 'Grigio perla', color: '#CFCCC6' },
      { id: 'tortora', label: 'Tortora', color: '#A99B8C' },
      { id: 'rovere-chiaro', label: 'Rovere chiaro', wood: 'rovere-chiaro' },
      { id: 'rovere', label: 'Rovere', wood: 'rovere' },
      { id: 'noce', label: 'Noce', wood: 'noce' },
      { id: 'nero', label: 'Nero', color: '#2A2A2A' }
    ],
    frames: [
      { id: 'pvc', label: 'PVC bianco', color: '#F5F5F2', rough: 0.5 },
      { id: 'pvc-grigio', label: 'PVC grigio', color: '#8E9196', rough: 0.5 },
      { id: 'legno', label: 'Legno rovere', wood: 'rovere' },
      { id: 'legno-noce', label: 'Legno noce', wood: 'noce' },
      { id: 'alluminio', label: 'Alluminio antracite', color: '#3B3F44', metal: 0.5, rough: 0.45 },
      { id: 'ferro', label: 'Ferro-finestra nero', color: '#1F2124', metal: 0.4, rough: 0.5 },
      { id: 'bianco-legno', label: 'Legno laccato bianco', color: '#EFEDE7', rough: 0.4 }
    ],
    skirting: [
      { id: 'bianco', label: 'Bianco', color: '#F4F2EE' },
      { id: 'porte', label: 'Come le porte' },
      { id: 'pavimento', label: 'Come il pavimento' },
      { id: 'muro', label: 'Come il muro' },
      { id: 'nessuno', label: 'Nessuno' }
    ],
    skirtingH: [{ id: 0.06, label: '6 cm' }, { id: 0.08, label: '8 cm' }, { id: 0.1, label: '10 cm' }, { id: 0.15, label: '15 cm' }],
    DEFAULT: { door: { model: 'liscia', color: 'bianco' }, frame: 'pvc', handle: 'cromo', skirting: { type: 'bianco', h: 0.08 } }
  };
  const TR = CM.trim = {};
  const find = (list, id) => list.find(x => x.id === id) || list[0];

  // Impostazioni della casa (con i valori di partenza)
  TR.house = function (plan) {
    const t = plan.trim || {};
    const D = CM.TRIM.DEFAULT;
    return { door: Object.assign({}, D.door, t.door), frame: t.frame || D.frame, handle: t.handle || D.handle, skirting: Object.assign({}, D.skirting, t.skirting) };
  };
  // Aspetto di una porta o finestra: le sue scelte, altrimenti quelle della casa
  TR.of = function (plan, o) {
    const h = TR.house(plan), x = (o && o.trim) || {};
    return { model: x.model || h.door.model, color: x.color || h.door.color, frame: x.frame || h.frame, handle: x.handle || h.handle };
  };
  TR.doorColor = (id) => find(CM.TRIM.doorColors, id);
  TR.frame = (id) => find(CM.TRIM.frames, id);

  const sec = (t) => el('div', { class: 'sec-title', text: t });
  const chips = (items, cur, on, dot) => el('div', { class: 'chips-row wrap' }, items.map(it => el('button', {
    class: 'chip small' + (String(cur) === String(it.id) ? ' active' : ''), onclick: () => on(it.id),
    html: (dot ? '<span class="dot" style="background:' + (it.color || (it.wood && CM.style.wood(it.wood) ? CM.style.wood(it.wood).color : '#ccc')) + ';border-radius:99px"></span>' : '') + it.label
  })));

  // Scheda di una porta o finestra: aspetto
  TR.openingControls = function (plan, id, mut) {
    const o = plan.openings[id];
    const box = el('div', { class: 'personal' });
    if (!o || o.kind === 'arco') return box;
    const t = TR.of(plan, o);
    const set = (k, v) => mut(pl => { const x = pl.openings[id]; x.trim = Object.assign({}, x.trim, { [k]: v }); });
    const door = CM.OPENINGS[o.kind] && CM.OPENINGS[o.kind].door;
    if (door) {
      box.appendChild(sec('Modello della porta'));
      box.appendChild(chips(CM.TRIM.doorModels, t.model, v => set('model', v)));
      box.appendChild(sec('Colore della porta'));
      box.appendChild(chips(CM.TRIM.doorColors, t.color, v => set('color', v), true));
    } else {
      box.appendChild(sec('Infisso'));
      box.appendChild(chips(CM.TRIM.frames, t.frame, v => set('frame', v), true));
    }
    box.appendChild(sec('Maniglia'));
    box.appendChild(chips(CM.METALS, t.handle, v => set('handle', v), true));
    box.appendChild(el('div', { class: 'actions' }, [
      el('button', { class: 'btn small', text: door ? 'Uguale per tutte le porte' : 'Uguale per tutte le finestre', onclick: () => {
        mut(pl => {
          const cur = TR.of(pl, pl.openings[id]);
          pl.trim = pl.trim || {};
          if (door) { pl.trim.door = { model: cur.model, color: cur.color }; } else pl.trim.frame = cur.frame;
          pl.trim.handle = cur.handle;
          for (const k in pl.openings) { const x = pl.openings[k]; const isDoor = CM.OPENINGS[x.kind] && CM.OPENINGS[x.kind].door; if (x.trim && (isDoor === !!door)) { delete x.trim.model; delete x.trim.color; delete x.trim.frame; delete x.trim.handle; } }
        });
        U().toast(door ? 'Tutte le porte sono uguali' : 'Tutte le finestre sono uguali');
      } }),
      el('button', { class: 'btn small', text: 'Porte, finestre e battiscopa…', onclick: () => TR.houseDialog(mut, () => plan) })
    ]));
    return box;
  };

  // Finestra con le scelte per tutta la casa
  TR.houseDialog = async function (mut, getPlan) {
    const plan = getPlan();
    const h = TR.house(plan);
    const v = CM.clone(h);
    const body = el('div');
    const draw = () => {
      body.innerHTML = '';
      body.append(
        sec('Porte interne: modello'), chips(CM.TRIM.doorModels, v.door.model, x => { v.door.model = x; draw(); }),
        sec('Porte interne: colore'), chips(CM.TRIM.doorColors, v.door.color, x => { v.door.color = x; draw(); }, true),
        sec('Finestre: infissi'), chips(CM.TRIM.frames, v.frame, x => { v.frame = x; draw(); }, true),
        sec('Maniglie'), chips(CM.METALS, v.handle, x => { v.handle = x; draw(); }, true),
        sec('Battiscopa'), chips(CM.TRIM.skirting, v.skirting.type, x => { v.skirting.type = x; draw(); }),
        v.skirting.type !== 'nessuno' ? chips(CM.TRIM.skirtingH, v.skirting.h, x => { v.skirting.h = x; draw(); }) : el('span')
      );
    };
    draw();
    const ok = await U().dialog({ title: 'Porte, finestre e battiscopa', text: 'Valgono per tutta la casa. Le porte e finestre a cui hai dato un aspetto diverso restano come le hai scelte.', body, actions: [{ label: 'Annulla', value: null }, { label: 'Applica', value: true, primary: true }] });
    if (!ok) return;
    mut(pl => { pl.trim = v; });
    U().toast('Fatto: guarda il 3D');
  };

  /* ---------- Colori su misura ---------- */
  // RAL classici (colore a schermo indicativo)
  CM.RAL = [
    ['9001', 'Bianco crema', '#FDF4E3'], ['9002', 'Bianco grigiastro', '#E7EBDA'], ['9003', 'Bianco segnale', '#F4F4F4'], ['9010', 'Bianco puro', '#F1EDE1'], ['9016', 'Bianco traffico', '#F6F6F6'],
    ['9005', 'Nero intenso', '#0A0A0A'], ['9006', 'Alluminio brillante', '#A5A5A5'], ['9007', 'Alluminio grigiastro', '#8F8F8F'],
    ['1013', 'Bianco perla', '#EAE6CA'], ['1015', 'Avorio chiaro', '#E6D690'], ['1001', 'Beige', '#C2B078'], ['1002', 'Giallo sabbia', '#C6A664'], ['1019', 'Beige grigiastro', '#9E9764'], ['1011', 'Beige marrone', '#8A6642'], ['1021', 'Giallo navone', '#F3DA0B'], ['1023', 'Giallo traffico', '#FAD201'],
    ['2000', 'Arancio giallastro', '#ED760E'], ['3000', 'Rosso fuoco', '#AF2B1E'], ['3004', 'Rosso porpora', '#75151E'], ['3005', 'Rosso vino', '#5E2129'], ['3009', 'Rosso ossido', '#642424'], ['3012', 'Rosso beige', '#C1876B'], ['3014', 'Rosa antico', '#D36E70'], ['3015', 'Rosa chiaro', '#EA899A'],
    ['4005', 'Lilla bluastro', '#6C4675'], ['4009', 'Violetto pastello', '#A18594'],
    ['5000', 'Blu violaceo', '#354D73'], ['5002', 'Blu oltremare', '#20214F'], ['5003', 'Blu zaffiro', '#1D1E33'], ['5010', 'Blu genziana', '#0E294B'], ['5014', 'Blu colomba', '#606E8C'], ['5015', 'Blu cielo', '#2271B3'], ['5024', 'Blu pastello', '#5D9B9B'],
    ['6000', 'Verde patina', '#316650'], ['6005', 'Verde muschio', '#2F4538'], ['6009', 'Verde abete', '#31372B'], ['6011', 'Verde reseda', '#587246'], ['6013', 'Verde canna', '#6C7156'], ['6019', 'Verde biancastro', '#BDECB6'], ['6021', 'Verde pallido', '#89AC76'], ['6034', 'Turchese pastello', '#7FB5B5'],
    ['7015', 'Grigio ardesia', '#434750'], ['7016', 'Grigio antracite', '#293133'], ['7021', 'Grigio nerastro', '#23282B'], ['7022', 'Grigio ombra', '#332F2C'], ['7030', 'Grigio pietra', '#8B8C7A'], ['7032', 'Grigio ghiaia', '#B8B799'], ['7035', 'Grigio luce', '#D7D7D7'], ['7036', 'Grigio platino', '#7F7679'], ['7037', 'Grigio polvere', '#7D7F7D'], ['7038', 'Grigio agata', '#B5B8B1'], ['7039', 'Grigio quarzo', '#6C6960'], ['7044', 'Grigio seta', '#CAC4B0'], ['7047', 'Telegrigio 4', '#D0D0D0'],
    ['8001', 'Marrone ocra', '#955F20'], ['8003', 'Marrone fango', '#734222'], ['8011', 'Marrone noce', '#5B3A29'], ['8014', 'Marrone seppia', '#382C1E'], ['8017', 'Marrone cioccolato', '#45322E'], ['8019', 'Marrone grigiastro', '#403A3A'], ['8024', 'Marrone beige', '#79553D'], ['8025', 'Marrone pallido', '#755C48']
  ];

  // NCS: dal codice (es. "S 1502-Y50R") a un colore a schermo approssimato
  // modello approssimato, tarato su codici NCS noti: il colore a schermo è indicativo
  const NCS_HUE = { Y: [1.0, 0.83, 0.0], R: [0.77, 0.01, 0.2], B: [0.0, 0.53, 0.74], G: [0.0, 0.62, 0.42] };
  CM.ncsToHex = function (code) {
    const m = String(code || '').toUpperCase().replace(/\s+/g, ' ').match(/(?:S\s*)?(\d{2})(\d{2})\s*-\s*(N|[YRBG](?:(\d{1,2})[YRBG])?)/);
    if (!m) return null;
    const s = +m[1] / 100, c = +m[2] / 100;
    if (s + c > 1) return null;
    const g = 0.97 * Math.pow(1 - s, 1.2);
    let rgb = [g, g, g];
    if (m[3] !== 'N') {
      const a = m[3][0], b = m[3][m[3].length - 1], p = m[4] ? +m[4] / 100 : 0;
      const h = NCS_HUE[a].map((x, i) => x * (1 - p) + NCS_HUE[b][i] * p);
      const hl = 0.3 * h[0] + 0.59 * h[1] + 0.11 * h[2];
      rgb = h.map(x => g + 1.7 * c * (x - hl) * (0.35 + g));
    }
    return '#' + rgb.map(x => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  const NCS_POPULAR = ['S 0500-N', 'S 0502-Y', 'S 0804-Y30R', 'S 1002-Y', 'S 1005-Y20R', 'S 1502-Y', 'S 1502-Y50R', 'S 2002-Y', 'S 2005-Y20R', 'S 2010-Y30R', 'S 2010-G30Y', 'S 3005-G20Y', 'S 3020-Y60R', 'S 3030-Y60R', 'S 4010-Y30R', 'S 2020-B', 'S 3020-R80B', 'S 4020-B10G', 'S 6020-R90B', 'S 5010-G10Y', 'S 7005-B20G', 'S 8502-B'];

  // Colori miei (salvati sul dispositivo)
  CM.myColors = () => { try { return CM.store.pref('myColors') || []; } catch (e) { return []; } };
  function remember(c) {
    try { const list = CM.myColors().filter(x => x.color.toLowerCase() !== c.color.toLowerCase()); list.unshift(c); CM.store.pref('myColors', list.slice(0, 16)); } catch (e) {}
  }

  // Contagocce: tocca un punto di una foto
  async function eyedropper() {
    const file = await CM.inspire.pickImage();
    if (!file) return null;
    const src = await CM.inspire.shrink(file, 1200);
    if (!src) return null;
    const img = await new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
    if (!img) return null;
    const c = el('canvas', { style: 'width:100%;border-radius:10px;touch-action:none;cursor:crosshair' });
    const k = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
    const sw = el('span', { class: 'swatch big' }), lbl = el('span', { class: 'mono small', text: 'Tocca il colore nella foto' });
    let picked = null;
    c.addEventListener('pointerdown', e => {
      const r = c.getBoundingClientRect();
      const px = Math.round((e.clientX - r.left) / r.width * c.width), py = Math.round((e.clientY - r.top) / r.height * c.height);
      const d = x.getImageData(Math.max(0, px - 4), Math.max(0, py - 4), 9, 9).data;
      let R = 0, Gc = 0, B = 0, n = 0; for (let i = 0; i < d.length; i += 4) { R += d[i]; Gc += d[i + 1]; B += d[i + 2]; n++; }
      picked = '#' + [R, Gc, B].map(v => Math.round(v / n).toString(16).padStart(2, '0')).join('').toUpperCase();
      sw.style.background = picked; lbl.textContent = picked + ' · ' + CM.nearestRAL(picked);
    });
    const ok = await U().dialog({ title: 'Prendi il colore da una foto', body: el('div', {}, [c, el('div', { style: 'display:flex;gap:10px;align-items:center;margin-top:8px' }, [sw, lbl])]), actions: [{ label: 'Annulla', value: null }, { label: 'Usa questo colore', value: true, primary: true }] });
    return ok && picked ? { color: picked, name: 'colore dalla foto' } : null;
  }
  CM.nearestRAL = function (hex) {
    const v = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const a = v(hex);
    let best = null, bd = Infinity;
    for (const r of CM.RAL) { const b = v(r[2]); const d = (a[0] - b[0]) ** 2 * 0.3 + (a[1] - b[1]) ** 2 * 0.59 + (a[2] - b[2]) ** 2 * 0.11; if (d < bd) { bd = d; best = r; } }
    return best ? 'simile a RAL ' + best[0] + ' ' + best[1] : '';
  };

  // Finestra "Colore su misura": RAL, NCS, contagocce, ruota dei colori
  CM.colorDialog = function (current) {
    return new Promise(async (resolve) => {
      let tab = 'ral', choice = null;
      const body = el('div', { class: 'colordlg' });
      const preview = el('div', { class: 'color-preview' });
      const showPick = (c) => { choice = c; preview.innerHTML = ''; preview.append(el('span', { class: 'swatch big', style: 'background:' + c.color }), el('span', { class: 'small', html: '<b>' + (c.code || c.color) + '</b><br>' + (c.name || '') })); };
      const draw = () => {
        body.innerHTML = '';
        body.append(el('div', { class: 'seg compact' }, [['ral', 'RAL'], ['ncs', 'NCS'], ['foto', 'Da una foto'], ['libero', 'Libero']].map(([v, l]) => el('button', { class: tab === v ? 'on' : '', text: l, onclick: () => { tab = v; draw(); } }))));
        if (tab === 'ral') {
          const q = el('input', { type: 'search', placeholder: 'Cerca: 7044, grigio, verde…', 'aria-label': 'Cerca RAL', style: 'width:100%;margin:8px 0' });
          const grid = el('div', { class: 'ral-grid' });
          const fill = () => { grid.innerHTML = ''; const t = q.value.trim().toLowerCase(); CM.RAL.filter(r => !t || r[0].includes(t) || r[1].toLowerCase().includes(t)).forEach(r => grid.appendChild(el('button', { class: 'ral', onclick: () => showPick({ color: r[2], code: 'RAL ' + r[0], name: r[1] }) }, [el('span', { class: 'swatch', style: 'background:' + r[2] }), el('span', { html: '<b>' + r[0] + '</b> ' + r[1] })]))); };
          q.addEventListener('input', fill); fill();
          body.append(q, grid);
        } else if (tab === 'ncs') {
          const inp = el('input', { type: 'text', placeholder: 'Es. S 1502-Y50R', 'aria-label': 'Codice NCS', style: 'width:100%;margin:8px 0', class: 'mono' });
          const msg = el('div', { class: 'muted small', text: 'Scrivi il codice che trovi sulla mazzetta o sul barattolo. Il colore a schermo è indicativo.' });
          inp.addEventListener('input', () => { const h = CM.ncsToHex(inp.value); if (h) showPick({ color: h, code: 'NCS ' + inp.value.trim().toUpperCase().replace(/^NCS\s*/, ''), name: CM.nearestRAL(h) }); });
          const grid = el('div', { class: 'ral-grid' }, NCS_POPULAR.map(code => { const h = CM.ncsToHex(code); return el('button', { class: 'ral', onclick: () => showPick({ color: h, code: 'NCS ' + code, name: '' }) }, [el('span', { class: 'swatch', style: 'background:' + h }), el('span', { class: 'mono small', text: code })]); }));
          body.append(inp, msg, grid);
        } else if (tab === 'foto') {
          body.append(el('p', { class: 'muted small', text: 'Scegli o scatta una foto (una stoffa, un campione, una parete che ti piace) e tocca il colore.' }), el('button', { class: 'btn primary', text: 'Scegli la foto…', onclick: async () => { const c = await eyedropper(); if (c) showPick(Object.assign(c, { name: CM.nearestRAL(c.color) })); } }));
        } else {
          const inp = el('input', { type: 'color', value: current && /^#[0-9a-f]{6}$/i.test(current) ? current : '#C49A6C', style: 'width:100%;height:120px;margin-top:8px', 'aria-label': 'Ruota dei colori' });
          inp.addEventListener('input', () => showPick({ color: inp.value.toUpperCase(), name: CM.nearestRAL(inp.value) }));
          body.append(inp);
        }
        const mine = CM.myColors();
        if (mine.length) body.append(el('div', { class: 'sec-title', text: 'I miei colori' }), el('div', { class: 'swatches' }, mine.map(c => el('button', { class: 'swatch', style: 'background:' + c.color, title: (c.code || '') + ' ' + (c.name || ''), onclick: () => showPick(c) }))));
      };
      draw();
      const ok = await U().dialog({ title: 'Colore su misura', body: el('div', {}, [body, preview]), actions: [{ label: 'Annulla', value: null }, { label: 'Usa il colore', value: true, primary: true }] });
      if (ok && choice) { remember(choice); resolve(choice); } else resolve(null);
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
