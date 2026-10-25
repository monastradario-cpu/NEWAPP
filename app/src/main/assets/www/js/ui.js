/* Casa Mia — componenti di interfaccia: dialoghi, menu, campi, guida */
(function (root) {
  'use strict';
  const CM = root.CM;

  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    (Array.isArray(children) ? children : children != null ? [children] : []).forEach(c => {
      if (c == null || c === false) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  const ICONS = {
    brush: '<path d="M4 5h12v5H4z"/><path d="M16 7h3v6h-8v3"/><path d="M10 16h2v5h-2z"/>',
    rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
    cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    select: '<path d="M5 3l14 8-6 2-3 6z"/>',
    room: '<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M4 9h3M17 19v-3"/>',
    wall: '<path d="M4 18L10 6l10 4"/><circle cx="4" cy="18" r="1.6"/><circle cx="10" cy="6" r="1.6"/><circle cx="20" cy="10" r="1.6"/>',
    opening: '<path d="M4 20V4h9"/><path d="M13 4a9 9 0 0 1-9 9"/><path d="M15 20h5"/>',
    column: '<rect x="7" y="7" width="10" height="10"/><path d="M7 7l10 10M17 7L7 17"/>',
    beam: '<path d="M3 9h18M3 15h18" stroke-dasharray="3 2.5"/>',
    battente: '<path d="M5 20V5"/><path d="M5 5a14 14 0 0 1 14 14"/><path d="M3 20h18"/>',
    scorrevole: '<path d="M3 18h18"/><path d="M4 13h10" stroke-width="3"/><path d="M15 13h5" stroke-dasharray="2 2"/>',
    scomparsa: '<path d="M3 16h18" stroke-dasharray="2 2"/><path d="M3 12h9" stroke-width="3"/>',
    finestra: '<rect x="3" y="9" width="18" height="6"/><path d="M3 12h18"/>',
    portafinestra: '<rect x="3" y="15" width="18" height="4"/><path d="M3 15a9 9 0 0 0 9-9M21 15a9 9 0 0 1-9-9"/>',
    arco: '<path d="M4 20v-9a8 8 0 0 1 16 0v9"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    flip: '<path d="M12 3v18" stroke-dasharray="2 2"/><path d="M8 7l-4 5 4 5M16 7l4 5-4 5"/>',
    hinge: '<path d="M4 12h16"/><path d="M8 8l-4 4 4 4M16 8l4 4-4 4"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    grid: '<path d="M4 4h16v16H4zM4 10h16M4 16h16M10 4v16M16 4v16"/>',
    ruler: '<path d="M3 15L15 3l6 6L9 21z"/><path d="M7 11l2 2M10 8l2 2M13 5l2 2"/>',
    rename: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7v.5M12 17h.01"/>',
    thick: '<path d="M4 8h16M4 16h16"/><path d="M12 10v4"/>',
    height: '<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    dots: '<circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/>',
    sofa: '<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3z"/>',
    plug: '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0z"/><path d="M12 17v4"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>',
    euro: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5a4 4 0 1 0 0 7M7 11h6M7 13.5h6"/>'
  };
  function icon(name, size) {
    size = size || 20;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  /* ---------- Toast ---------- */
  let toastTimer = 0;
  function toast(text) {
    const t = document.getElementById('toast');
    t.textContent = text;
    t.classList.toggle('top', stack.length > 0); // con un dialogo aperto il messaggio va in alto, non sopra i pulsanti
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------- Overlay (dialoghi, menu, guida) ---------- */
  const stack = [];
  function openOverlay(content, onClose) {
    const ov = document.getElementById('overlay');
    if (ov.firstChild) ov.firstChild.style.display = 'none';
    const tt = document.getElementById('toast'); if (tt) tt.classList.add('top');
    ov.appendChild(content);
    ov.classList.remove('hidden');
    const entry = { content, onClose };
    stack.push(entry);
    ov.onclick = (e) => { if (e.target === ov) closeOverlay(); };
    const focusable = content.querySelector('input, select, button');
    if (focusable && focusable.tagName !== 'BUTTON') setTimeout(() => focusable.focus(), 50);
    return entry;
  }
  function closeOverlay(result) {
    const entry = stack.pop();
    const ov = document.getElementById('overlay');
    if (entry && entry.content.parentNode === ov) ov.removeChild(entry.content);
    if (stack.length) stack[stack.length - 1].content.style.display = '';
    else { ov.classList.add('hidden'); ov.innerHTML = ''; }
    if (entry && entry.onClose) entry.onClose(result);
    return !!entry;
  }
  function overlayOpen() { return stack.length > 0; }

  function dialog(opts) {
    return new Promise(resolve => {
      const actions = (opts.actions || [{ label: 'OK', value: true, primary: true }]).map(a =>
        el('button', { class: 'btn' + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : ''), onclick: () => closeOverlay(typeof a.value === 'function' ? a.value() : a.value) }, a.label));
      const box = el('div', { class: 'dialog' + (opts.clear ? ' clear' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title }, [
        el('h2', { text: opts.title }),
        opts.text ? el('p', { text: opts.text }) : null,
        opts.body || null,
        el('div', { class: 'actions' }, actions)
      ]);
      openOverlay(box, (r) => resolve(r === undefined ? null : r));
    });
  }

  function confirmDialog(title, text, okLabel, danger) {
    return dialog({ title, text, actions: [{ label: 'Annulla', value: false }, { label: okLabel || 'Conferma', value: true, primary: !danger, danger }] });
  }

  function promptDialog(title, value, opts) {
    opts = opts || {};
    const input = el('input', { type: 'text', value: value || '', 'aria-label': opts.label || title, inputmode: opts.inputmode || 'text', class: opts.mono ? 'num' : '' });
    const field = el('div', { class: 'field full', style: 'margin-top:10px' }, [opts.label ? el('label', { text: opts.label }) : null, opts.unit ? el('div', { class: 'input-unit' }, [input, el('span', { text: opts.unit })]) : input]);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') closeOverlay(input.value); });
    return dialog({ title, text: opts.text, body: field, actions: [{ label: 'Annulla', value: null }, { label: opts.ok || 'Salva', value: () => input.value, primary: true }] });
  }

  function menu(title, items) {
    return new Promise(resolve => {
      const list = el('div', { class: 'menu-list' }, items.filter(Boolean).map(it =>
        el('button', { class: 'menu-item' + (it.danger ? ' danger' : ''), onclick: () => closeOverlay(it.id) }, [
          el('span', { html: icon(it.icon || 'info', 22) }),
          el('span', { text: it.label }),
          it.toggle != null ? el('span', { class: 'switch' + (it.toggle ? ' on' : ''), 'aria-hidden': 'true' }) : null,
          it.right ? el('span', { class: 'mi-right', text: it.right }) : null
        ])));
      const box = el('div', { class: 'dialog', role: 'dialog', 'aria-label': title }, [el('h2', { text: title }), list]);
      openOverlay(box, (r) => resolve(r === undefined ? null : r));
    });
  }

  /* ---------- Campi del pannello proprietà ---------- */
  /* Etichetta del campo con la (i): spiegazione dei termini tecnici */
  function fieldLabel(tag, label) {
    const g = CM.GLOSSARY && (CM.GLOSSARY[label] || CM.GLOSSARY[String(label).replace(/\s*\(.*\)$/, '')]);
    const lb = el(tag, { class: tag === 'span' ? 'lbl' : '' }, [document.createTextNode(label)]);
    if (g) lb.appendChild(el('button', { class: 'info-i', type: 'button', 'aria-label': 'Cosa significa ' + label, text: 'i', onclick: (e) => { e.preventDefault(); e.stopPropagation(); dialog({ title: label, text: g }); } }));
    return lb;
  }

  function numField(label, meters, unit, onCommit, opts) {
    opts = opts || {};
    const toDisplay = (m) => unit === 'cm' ? String(Math.round(m * 100)) : CM.fmt.num(m, 2);
    const input = el('input', { type: 'text', inputmode: 'decimal', class: 'num', value: toDisplay(meters), 'aria-label': label, enterkeyhint: 'done' });
    let last = input.value;
    const commit = () => {
      if (input.value === last) return;
      const v = CM.fmt.parseM(input.value, unit);
      if (!isFinite(v) || v < (opts.min || 0) || (opts.max && v > opts.max)) {
        toast('Valore non valido');
        input.value = last;
        return;
      }
      last = input.value;
      onCommit(v);
    };
    input.addEventListener('change', commit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { input.blur(); } });
    input.addEventListener('focus', () => setTimeout(() => input.select(), 0));
    return el('div', { class: 'field' + (opts.full ? ' full' : '') }, [fieldLabel('label', label), el('div', { class: 'input-unit' }, [input, el('span', { text: unit })])]);
  }

  function textField(label, value, onCommit, opts) {
    opts = opts || {};
    const input = el('input', { type: 'text', value, 'aria-label': label, enterkeyhint: 'done' });
    input.addEventListener('change', () => { const v = input.value.trim(); if (v) onCommit(v); else input.value = value; });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
    return el('div', { class: 'field' + (opts.full === false ? '' : ' full') }, [fieldLabel('label', label), input]);
  }

  function selectField(label, options, value, onChange, opts) {
    opts = opts || {};
    const sel = el('select', { 'aria-label': label }, options.map(o => el('option', { value: o.value, selected: o.value === value }, o.label)));
    sel.addEventListener('change', () => onChange(sel.value));
    return el('div', { class: 'field' + (opts.full === false ? '' : ' full') }, [fieldLabel('label', label), sel]);
  }

  function segField(label, options, value, onChange) {
    const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label }, options.map(o =>
      el('button', { class: o.value === value ? 'on' : '', role: 'radio', 'aria-checked': o.value === value ? 'true' : 'false', onclick: () => onChange(o.value), html: (o.dot ? '<span class="dot ' + o.dot + '"></span>' : '') + o.label })));
    return el('div', { class: 'field full' }, [fieldLabel('span', label), seg]);
  }

  function stat(k, v) { return el('div', { class: 'stat' }, [el('div', { class: 'k', text: k }), el('div', { class: 'v', text: v })]); }

  /* ---------- Guida rapida ---------- */
  const TUTORIAL = [
    { t: 'Benvenuto in Casa Mia', p: 'Qui disegni la pianta della tua casa con le misure vere. Tutto resta salvato sul telefono, anche senza internet.', art: 'house' },
    { t: 'Disegna le stanze', p: 'Scegli “Stanza” e trascina col dito da un angolo all’altro. Le misure si agganciano ogni 5 cm e alle stanze vicine: due stanze affiancate condividono lo stesso muro.', art: 'room' },
    { t: 'Muri liberi', p: 'Con “Muro” tocchi i punti uno dopo l’altro: perfetto per stanze a L o storte. Tocca di nuovo il primo punto per chiudere la stanza.', art: 'wall' },
    { t: 'Porte e finestre', p: 'Scegli il tipo e tocca un muro. Poi trascinala lungo il muro e correggi larghezza, altezza e verso di apertura nel pannello.', art: 'opening' },
    { t: 'Ristrutturazione', p: 'Ogni muro ha uno stato: nero esistente, giallo da demolire, rosso da costruire. Toccalo e cambialo dal pannello: servirà anche per i costi.', art: 'states' },
    { t: 'Per modificare', p: 'Tocca un elemento per selezionarlo; trascina i pallini blu per spostare gli angoli. Un dito sposta la vista, due dita fanno lo zoom. Freccia indietro per annullare. Se compare il ! rosso, toccalo: vedi gli errori e l\u2019app li corregge per te.', art: 'select' },
    { t: 'Arredo e impianti', p: 'Con \u201cArredo\u201d scegli un mobile dal catalogo e tocchi dove metterlo: vicino a un muro si appoggia da solo. I mobili con il pallino arancione si sovrappongono, stanno stretti o bloccano una porta. Con \u201cImpianti\u201d segni prese, luci, acqua, scarichi e termosifoni.', art: 'arredo' },
    { t: 'Finiture e costi', p: 'Tocca una stanza: nel pannello scegli pavimento, rivestimento, pittura e carta da parati e vedi subito scatole, litri e costo. Nella scheda Costi trovi budget, materiali e manodopera, preventivi, varianti e controllo delle norme.', art: 'costi' },
    { t: '3D e stile', p: 'Nel 3D tocca una parete, il pavimento o un mobile e cambiane colori e materiali. Con \u201cStili\u201d trasformi la casa in un tocco (Scandinavo, Japandi, Boho\u2026); con \u201cIspirazione\u201d usi le tue foto e idee. Puoi anche passeggiare dentro casa.', art: '3d' },
    { t: 'Negozi, lavori e condivisione', p: 'In Arredo importi articoli da IKEA, Leroy Merlin e altri negozi. In Lavori tieni lista acquisti, pagamenti, cantiere, ditte, diario fotografico e promemoria. Dal menu \u22ee condividi il progetto, esporti il PDF e parli con l\u2019assistente.', art: 'share' },
  ];
  const TUT_ART = {
    arredo: '<svg width="200" height="120" viewBox="0 0 200 120" fill="none" aria-hidden="true"><rect x="20" y="15" width="160" height="90" stroke="#1B1E22" stroke-width="6"/><rect x="40" y="25" width="80" height="34" rx="6" fill="#C9D1DC" stroke="#4A4F57" stroke-width="2"/><rect x="40" y="25" width="80" height="9" stroke="#4A4F57" stroke-width="2"/><rect x="130" y="60" width="40" height="40" fill="#E8E1D6" stroke="#C2410C" stroke-width="3"/><circle cx="166" cy="64" r="8" fill="#C2410C"/><circle cx="60" cy="96" r="8" fill="#C27C0E"/></svg>',
    costi: '<svg width="200" height="120" viewBox="0 0 200 120" aria-hidden="true"><rect x="30" y="70" width="26" height="35" fill="#1F4FD1"/><rect x="66" y="45" width="26" height="60" fill="#1F4FD1"/><rect x="102" y="55" width="26" height="50" fill="#E0A800"/><rect x="138" y="25" width="26" height="80" fill="#1F4FD1"/><path d="M20 105h165" stroke="#1B1E22" stroke-width="2"/></svg>',
    '3d': '<svg width="200" height="120" viewBox="0 0 200 120" fill="none" aria-hidden="true"><path d="M100 15l70 35v40l-70 25-70-25V50z" fill="#F3EEE4" stroke="#1B1E22" stroke-width="3"/><path d="M30 50l70 25 70-25M100 75v40" stroke="#1B1E22" stroke-width="3"/><circle cx="168" cy="20" r="10" fill="#F2B84B"/></svg>',
    share: '<svg width="200" height="120" viewBox="0 0 200 120" fill="none" stroke="#1F4FD1" stroke-width="5" aria-hidden="true"><circle cx="150" cy="30" r="14"/><circle cx="50" cy="60" r="14"/><circle cx="150" cy="90" r="14"/><path d="M63 53l74-17M63 67l74 17"/></svg>',
    house: '<svg width="120" height="110" viewBox="0 0 120 110" fill="none" aria-hidden="true"><path d="M14 52L60 16l46 36" stroke="#1F4FD1" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 44v52h72V44" stroke="#1F4FD1" stroke-width="5" stroke-linejoin="round"/><path d="M50 96V72h20v24" stroke="#1B1E22" stroke-width="4"/></svg>',
    room: '<svg width="200" height="120" viewBox="0 0 200 120" aria-hidden="true"><rect x="30" y="20" width="140" height="80" fill="#E8EEFC" stroke="#1F4FD1" stroke-width="2.5" stroke-dasharray="7 5"/><circle cx="170" cy="100" r="9" fill="#fff" stroke="#1F4FD1" stroke-width="3"/><text x="100" y="64" text-anchor="middle" font-family="monospace" font-size="13" fill="#1F4FD1">4,20 × 2,40</text></svg>',
    wall: '<svg width="200" height="120" viewBox="0 0 200 120" fill="none" aria-hidden="true"><path d="M30 100V20h90v40h50v40z" stroke="#1B1E22" stroke-width="7" stroke-linejoin="miter"/><circle cx="30" cy="100" r="7" fill="#fff" stroke="#1F4FD1" stroke-width="3"/><circle cx="170" cy="100" r="7" fill="#fff" stroke="#1F4FD1" stroke-width="3"/></svg>',
    opening: '<svg width="200" height="120" viewBox="0 0 200 120" fill="none" aria-hidden="true"><path d="M20 90h50M120 90h60" stroke="#1B1E22" stroke-width="8"/><path d="M70 90V40" stroke="#1B1E22" stroke-width="2.5"/><path d="M70 40a50 50 0 0 1 50 50" stroke="#1B1E22" stroke-width="1.5"/><rect x="66" y="80" width="58" height="20" stroke="#1F4FD1" stroke-width="2.5" rx="2"/></svg>',
    states: '<svg width="220" height="120" viewBox="0 0 220 120" aria-hidden="true"><rect x="20" y="30" width="50" height="12" fill="#1B1E22"/><rect x="85" y="30" width="50" height="12" fill="#FBEFC6" stroke="#B88A00" stroke-width="2" stroke-dasharray="5 3"/><rect x="150" y="30" width="50" height="12" fill="#D23B2A"/><text x="45" y="70" text-anchor="middle" font-size="12" fill="#1B1E22" font-family="sans-serif">esistente</text><text x="110" y="70" text-anchor="middle" font-size="12" fill="#1B1E22" font-family="sans-serif">demolire</text><text x="175" y="70" text-anchor="middle" font-size="12" fill="#1B1E22" font-family="sans-serif">nuovo</text></svg>',
    select: '<svg width="200" height="120" viewBox="0 0 200 120" fill="none" aria-hidden="true"><rect x="40" y="20" width="120" height="80" fill="#E8EEFC" stroke="#1B1E22" stroke-width="6"/><circle cx="40" cy="20" r="8" fill="#fff" stroke="#1F4FD1" stroke-width="3"/><circle cx="160" cy="20" r="8" fill="#fff" stroke="#1F4FD1" stroke-width="3"/><circle cx="160" cy="100" r="8" fill="#fff" stroke="#1F4FD1" stroke-width="3"/><circle cx="40" cy="100" r="8" fill="#fff" stroke="#1F4FD1" stroke-width="3"/></svg>'
  };

  function tutorial(onDone) {
    let i = 0;
    const art = el('div', { class: 'tut-art' });
    const step = el('div', { class: 'tut-step' });
    const h = el('h2');
    const p = el('p');
    const dots = el('div', { class: 'tut-dots', 'aria-hidden': 'true' }, TUTORIAL.map(() => el('i')));
    const back = el('button', { class: 'btn', onclick: () => { if (i > 0) { i--; render(); } else closeOverlay('skip'); } });
    const next = el('button', { class: 'btn primary', onclick: () => { if (i < TUTORIAL.length - 1) { i++; render(); } else closeOverlay('done'); } });
    const box = el('div', { class: 'tutorial', role: 'dialog', 'aria-label': 'Guida rapida' }, [art, step, h, p, el('div', { class: 'tut-nav' }, [dots, el('div', { class: 'actions', style: 'margin:0' }, [back, next])])]);
    function render() {
      const s = TUTORIAL[i];
      art.innerHTML = TUT_ART[s.art];
      step.textContent = (i + 1) + ' / ' + TUTORIAL.length;
      h.textContent = s.t; p.textContent = s.p;
      [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
      back.textContent = i === 0 ? 'Salta' : 'Indietro';
      next.textContent = i === TUTORIAL.length - 1 ? 'Inizia' : 'Avanti';
    }
    render();
    openOverlay(box, (r) => { if (onDone) onDone(r); });
  }

  /* Maniglia dei pannelli in basso: trascina per alzare/abbassare, tocca (o clic) per ridurre/aprire */
  function grab() {
    const min = document.body.classList.contains('panel-min');
    return el('div', { class: 'sheet-grab', role: 'separator', 'aria-label': 'Trascina per alzare o abbassare il pannello', title: 'Trascina per alzare o abbassare \u00b7 clic per ridurre o riaprire' }, [
      el('i', { 'aria-hidden': 'true' }),
      el('span', { class: 'grab-btn', text: min ? '\u25b4 Apri' : '\u25be Abbassa' })
    ]);
  }
  function setPanelMin(on) {
    document.body.classList.toggle('panel-min', !!on);
    document.querySelectorAll('.sheet-grab .grab-btn').forEach(b => { b.textContent = on ? '\u25b4 Apri' : '\u25be Abbassa'; });
    try { CM.store.pref('panelMin', !!on); } catch (e) {}
  }
  (function panelSizer() {
    if (typeof document === 'undefined') return;
    try { const h = CM.store && CM.store.pref('panelH'); if (h) document.documentElement.style.setProperty('--panel-h', (h * 100).toFixed(1) + '%'); if (CM.store && CM.store.pref('panelMin')) document.addEventListener('DOMContentLoaded', () => setPanelMin(true)); } catch (e) {}
    let d = null;
    document.addEventListener('pointerdown', e => {
      const g = e.target.closest && e.target.closest('.sheet-grab');
      if (!g) return;
      const panel = g.closest('.sheet, .v3d-panel');
      if (!panel || getComputedStyle(g).display === 'none') return;
      e.preventDefault();
      d = { g, panel, y0: e.clientY, moved: false, box: panel.parentElement.getBoundingClientRect(), id: e.pointerId };
      try { g.setPointerCapture(e.pointerId); } catch (er) {}
    });
    document.addEventListener('pointermove', e => {
      if (!d || e.pointerId !== d.id) return;
      if (!d.moved && Math.abs(e.clientY - d.y0) < 5) return;
      d.moved = true;
      document.body.classList.remove('panel-min');
      const f = Math.max(0.1, Math.min(0.92, (d.box.bottom - e.clientY) / d.box.height));
      d.f = f;
      document.documentElement.style.setProperty('--panel-h', (f * 100).toFixed(1) + '%');
    });
    const end = e => {
      if (!d || e.pointerId !== d.id) return;
      const x = d; d = null;
      if (!x.moved) { setPanelMin(!document.body.classList.contains('panel-min')); return; }
      if (x.f < 0.16) { document.documentElement.style.setProperty('--panel-h', '48%'); setPanelMin(true); try { CM.store.pref('panelH', 0.48); } catch (er) {} return; }
      setPanelMin(false);
      try { CM.store.pref('panelH', x.f); } catch (er) {}
    };
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
  })();

  CM.ui = { grab, setPanelMin, el, icon, toast, openOverlay, dialog, confirmDialog, promptDialog, menu, closeOverlay, overlayOpen, numField, textField, selectField, segField, stat, tutorial };
})(typeof window !== 'undefined' ? window : globalThis);
