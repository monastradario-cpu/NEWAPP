/* Casa Mia — esportazioni, condivisione, backup, storico versioni, assistente */
(function (root) {
  'use strict';
  const CM = root.CM;
  const P = CM.plan;
  const U = () => CM.ui;
  const el = (...a) => CM.ui.el(...a);
  const native = () => window.CasaMiaAndroid;
  const app = () => CM.app;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  const safeName = (s) => String(s || 'progetto').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'progetto';

  function b64utf8(text) { return btoa(unescape(encodeURIComponent(text))); }

  const SH = CM.share = {};

  // Condivide (o scarica nel browser) un file
  SH.file = function (name, mime, content, isDataUrl) {
    const base64 = isDataUrl ? content.split(',')[1] : b64utf8(content);
    if (native() && native().shareFile) { native().shareFile(name, mime, base64); return; }
    const a = document.createElement('a');
    a.href = isDataUrl ? content : 'data:' + mime + ';base64,' + base64;
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  };

  /* ---------- Immagine della pianta ---------- */
  SH.planImage = function (project, width, plan) {
    plan = plan || CM.project.plan(project);
    width = width || 1800;
    const b = P.bounds(plan);
    const ratio = b ? Math.min(1.6, Math.max(0.5, (b.maxY - b.minY + 1) / (b.maxX - b.minX + 1))) : 0.7;
    const W = width, H = Math.round(width * ratio);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const view = CM.render.fitView(plan, W, H, 70);
    CM.render.draw(ctx, { plan, view, width: W, height: H, showGrid: false, showDims: true, layers: { arredo: true, impianti: true, planimetria: false } });
    // barra di scala e nord
    const s = view.s;
    ctx.fillStyle = '#1B1E22'; ctx.fillRect(40, H - 40, s, 4);
    ctx.font = "500 20px 'JetBrains Mono', monospace"; ctx.fillText('1 m', 50 + s, H - 30);
    const n = (project.north || 0) * Math.PI / 180;
    ctx.save(); ctx.translate(W - 60, 60); ctx.rotate(n);
    ctx.fillStyle = '#D23B2A'; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(10, 0); ctx.lineTo(-10, 0); ctx.fill();
    ctx.fillStyle = '#C9C6BE'; ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(10, 0); ctx.lineTo(-10, 0); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#D23B2A'; ctx.font = "700 18px sans-serif"; ctx.textAlign = 'center'; ctx.fillText('N', W - 60, 20);
    return c.toDataURL('image/png');
  };

  /* ---------- Contenuto del resoconto (PDF e pagina di sola lettura) ---------- */
  const SECTIONS = [
    ['pianta', 'Pianta'], ['stanze', 'Stanze e finiture'], ['arredo', 'Arredo'], ['costi', 'Costi e budget'],
    ['preventivi', 'Preventivi'], ['pagamenti', 'Pagamenti'], ['acquisti', 'Lista acquisti'], ['cantiere', 'Cantiere'], ['diario', 'Diario e foto tracce']
  ];
  SH.SECTIONS = SECTIONS;

  function reportBody(project, sec, image3d) {
    const plan = CM.project.plan(project);
    const out = [];
    out.push('<header><h1>' + esc(project.name) + '</h1><p>Variante “' + esc(CM.project.variant(project).name) + '” · ' + today() + '</p></header>');
    const t = P.totals(plan);
    out.push('<p class="sum">Superficie netta <b>' + CM.fmt.area(t.net) + '</b> · lorda <b>' + CM.fmt.area(t.gross) + '</b> · <b>' + t.rooms + '</b> ambienti' + (t.outdoor ? ' · esterni <b>' + CM.fmt.area(t.outdoor) + '</b>' : '') + '</p>');
    if (sec.pianta) {
      out.push('<section><h2>Pianta</h2><img class="plan" src="' + SH.planImage(project) + '" alt="Pianta"></section>');
      if (image3d) out.push('<section><h2>Vista 3D</h2><img class="plan" src="' + image3d + '" alt="Vista 3D"></section>');
      out.push('<p class="legend"><span class="k e"></span> esistente <span class="k d"></span> da demolire <span class="k n"></span> da costruire</p>');
    }
    if (sec.stanze) {
      const rows = Object.keys(plan.rooms).map(id => {
        const r = plan.rooms[id], st = P.roomStats(plan, r), f = CM.finish.room(plan, id);
        const fin = [];
        if (f.floor && f.floor.mat) fin.push('Pavimento: ' + esc(f.floor.mat.name) + (f.floor.boxes ? ' (' + f.floor.boxes + ' scatole, posa ' + CM.POSE[f.floor.pose].label.toLowerCase() + ')' : ''));
        if (f.cladding && f.cladding.mat) fin.push('Rivestimento: ' + esc(f.cladding.mat.name) + ' h ' + CM.fmt.cm(r.finish.cladding.height) + ' (' + f.cladding.boxes + ' scatole)');
        if (f.paint) fin.push('Pittura: ' + esc(f.paint.mat.name) + (f.paint.mat.code ? ' ' + esc(f.paint.mat.code) : '') + ' · ' + CM.fmt.num(f.paint.liters, 1) + ' L, ' + f.paint.coats + ' mani');
        if (f.wallpaper) fin.push('Carta da parati: ' + esc(f.wallpaper.mat.name) + ' (' + f.wallpaper.rolls + ' rotoli)');
        const ws = P.roomWallSurface(plan, r);
        return '<tr><td>' + esc(r.name) + '</td><td class="n">' + CM.fmt.area(st.net) + '</td><td class="n">' + CM.fmt.cm(r.h || 2.7) + '</td><td class="n">' + CM.fmt.area(ws.net) + '</td><td>' + (fin.join('<br>') || '—') + '</td></tr>';
      });
      const sf = P.surfaceTotals(plan);
      out.push('<section><h2>Stanze e finiture</h2><table><tr><th>Stanza</th><th>Pavimento</th><th>Altezza</th><th>Pareti nette</th><th>Finiture</th></tr>' + rows.join('') + '<tr class="tot"><td>Totale</td><td class="n">' + CM.fmt.area(sf.floors) + '</td><td></td><td class="n">' + CM.fmt.area(sf.wallsNet) + '</td><td>Soffitti ' + CM.fmt.area(sf.ceilings) + ' · pareti lorde ' + CM.fmt.area(sf.wallsGross) + '</td></tr></table>');
      const norms = CM.norms.check(plan);
      if (norms.length) out.push('<p class="warn">' + norms.map(n => esc(n.text)).join('<br>') + '<br><small>' + esc(CM.norms.NOTE) + '</small></p>');
      out.push('</section>');
    }
    if (sec.arredo) {
      const rows = Object.values(plan.furniture).map(f => '<tr><td>' + esc(f.name) + '</td><td>' + esc(P.roomOf(plan, f) ? plan.rooms[P.roomOf(plan, f)].name : '') + '</td><td class="n">' + Math.round(f.w * 100) + '×' + Math.round(f.d * 100) + '×' + Math.round(f.h * 100) + '</td><td>' + esc(f.store || '') + '</td><td class="n">' + (f.price != null ? CM.fmt.eur(+f.price) : '—') + '</td></tr>');
      if (rows.length) out.push('<section><h2>Arredo</h2><table><tr><th>Articolo</th><th>Stanza</th><th>Misure (cm)</th><th>Negozio</th><th>Prezzo</th></tr>' + rows.join('') + '</table></section>');
    }
    if (sec.costi) {
      const c = CM.costs.compute(project);
      const rows = [];
      for (const g of CM.costs.GROUPS) {
        const gr = c.groups[g];
        if (!gr) continue;
        rows.push('<tr class="g"><td>' + g + '</td><td class="n">' + CM.fmt.eur(gr.mat) + '</td><td class="n">' + CM.fmt.eur(gr.lab) + '</td><td class="n">' + CM.fmt.eur(gr.total) + '</td></tr>');
        for (const l of gr.lines) rows.push('<tr><td> ' + esc(l.label) + ' <small>' + CM.fmt.num(l.qty, l.unit === 'cad' ? 0 : 1) + ' ' + l.unit + (l.detail ? ' · ' + esc(l.detail) : '') + '</small></td><td class="n">' + CM.fmt.eur(l.mat) + '</td><td class="n">' + CM.fmt.eur(l.lab) + '</td><td class="n">' + CM.fmt.eur(l.total) + '</td></tr>');
      }
      rows.push('<tr class="tot"><td>Totale stimato</td><td class="n">' + CM.fmt.eur(c.mat) + '</td><td class="n">' + CM.fmt.eur(c.lab) + '</td><td class="n">' + CM.fmt.eur(c.total) + '</td></tr>');
      out.push('<section><h2>Costi</h2>' + (project.budget.total ? '<p>Budget: <b>' + CM.fmt.eur(project.budget.total) + '</b></p>' : '') + '<table><tr><th>Voce</th><th>Materiali</th><th>Manodopera</th><th>Totale</th></tr>' + rows.join('') + '</table><p><small>Stima basata su prezzi indicativi: non sostituisce un preventivo.</small></p></section>');
    }
    if (sec.preventivi && project.quotes.length) {
      out.push('<section><h2>Preventivi</h2><table><tr><th>Voce</th><th>Ditta</th><th>Importo</th><th></th></tr>' + project.quotes.map(q => '<tr><td>' + esc(q.group) + '</td><td>' + esc(q.company) + (q.note ? ' <small>' + esc(q.note) + '</small>' : '') + '</td><td class="n">' + CM.fmt.eur(+q.amount) + '</td><td>' + (q.chosen ? 'scelto' : '') + '</td></tr>').join('') + '</table></section>');
    }
    if (sec.pagamenti && project.payments.length) {
      out.push('<section><h2>Pagamenti</h2><table><tr><th>Data</th><th>Descrizione</th><th>A chi</th><th>Importo</th><th>Stato</th></tr>' + project.payments.map(p => '<tr><td>' + new Date(p.date).toLocaleDateString('it-IT') + '</td><td>' + esc(p.descr) + '</td><td>' + esc(p.to) + '</td><td class="n">' + CM.fmt.eur(+p.amount) + '</td><td>' + (p.paid ? 'pagato' : 'da pagare') + '</td></tr>').join('') + '</table></section>');
    }
    if (sec.acquisti) {
      const items = CM.tabs.purchaseItems(project);
      if (items.length) out.push('<section><h2>Lista acquisti</h2><table><tr><th>Articolo</th><th>Quantità</th><th>Negozio</th><th>Prezzo</th><th>Stato</th></tr>' + items.map(i => '<tr><td>' + esc(i.name) + '</td><td>' + esc(i.qty) + '</td><td>' + esc(i.store) + '</td><td class="n">' + (i.price != null ? CM.fmt.eur(i.price) : '—') + '</td><td>' + esc(project.purchases[i.key] || 'da comprare') + '</td></tr>').join('') + '</table></section>');
    }
    if (sec.cantiere && project.tasks.length) {
      out.push('<section><h2>Cantiere</h2><table><tr><th>Fase</th><th>Dal</th><th>Al</th><th>Ditta</th><th></th></tr>' + project.tasks.slice().sort((a, b) => a.start - b.start).map(t => '<tr><td>' + esc(t.name) + '</td><td>' + new Date(t.start).toLocaleDateString('it-IT') + '</td><td>' + new Date(t.end).toLocaleDateString('it-IT') + '</td><td>' + esc(t.contact) + '</td><td>' + (t.done ? 'fatta' : '') + '</td></tr>').join('') + '</table></section>');
    }
    if (sec.diario && project.diary.length) {
      out.push('<section><h2>Diario e foto</h2><div class="photos">' + project.diary.slice().sort((a, b) => b.date - a.date).map(d => '<figure>' + (d.photo ? '<img src="' + d.photo + '" alt="">' : '') + '<figcaption><b>' + (d.type === 'tracce' ? 'Tracce impianti' : 'Avanzamento') + '</b> · ' + new Date(d.date).toLocaleDateString('it-IT') + (d.room && plan.rooms[d.room] ? ' · ' + esc(plan.rooms[d.room].name) : '') + '<br>' + esc(d.text) + '</figcaption></figure>').join('') + '</div></section>');
    }
    return out.join('\n');
  }

  const REPORT_CSS = "body{font-family:'Instrument Sans',system-ui,sans-serif;color:#1B1E22;margin:0;padding:24px;background:#fff;line-height:1.45}header h1{margin:0;font-size:26px}header p{margin:4px 0 0;color:#5F6670}.sum{font-family:'JetBrains Mono',monospace;font-size:13px}h2{font-size:18px;margin:26px 0 8px;border-bottom:1px solid #E3E1DB;padding-bottom:4px}img.plan{width:100%;border:1px solid #E3E1DB;border-radius:8px}table{width:100%;border-collapse:collapse;font-size:12.5px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #EFEDE8;vertical-align:top}th{color:#5F6670;font-weight:600}td.n{text-align:right;font-family:'JetBrains Mono',monospace;white-space:nowrap}tr.g td{font-weight:700;background:#F6F5F1}tr.tot td{font-weight:700;border-top:2px solid #1B1E22}small{color:#5F6670}.warn{background:#FDF0E1;color:#7A3A06;padding:10px 12px;border-radius:8px;font-size:13px}.legend{font-size:12px;color:#5F6670}.k{display:inline-block;width:18px;height:8px;margin:0 4px 0 10px;vertical-align:1px}.k.e{background:#1B1E22}.k.d{background:#FBEFC6;border:1px dashed #B88A00}.k.n{background:#D23B2A}.photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}figure{margin:0}figure img{width:100%;border-radius:8px}figcaption{font-size:12px;color:#4A4F57}@media print{body{padding:0}section{break-inside:avoid-page}}";

  SH.reportHtml = function (project, sec, image3d, viewer) {
    return '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(project.name) + '</title><style>' + REPORT_CSS + (viewer ? 'body{max-width:900px;margin:0 auto}' : '') + '</style></head><body>' + reportBody(project, sec, image3d) + (viewer ? '<footer><p><small>Pagina di sola lettura creata con Casa Mia il ' + today() + '.</small></p></footer>' : '') + '</body></html>';
  };

  SH.pdf = function (project, sections) {
    const sec = sections || Object.fromEntries(SECTIONS.map(([k]) => [k, k !== 'diario' && k !== 'pagamenti']));
    const html = SH.reportHtml(project, sec, CM.app && CM.app.snapshot3d && CM.app.snapshot3d());
    if (native() && native().printHtml) { native().printHtml(html, project.name); U().toast('Scegli “Salva come PDF” come stampante'); return; }
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
  };

  /* ---------- File di progetto ---------- */
  function filterProject(project, sec) {
    const p = CM.clone(project);
    delete p.history; delete p.shares;
    if (!sec.costi) { p.budget = { total: 0, rooms: {} }; p.variants.forEach(v => Object.values(v.plan.furniture).forEach(f => { f.price = null; })); }
    if (!sec.preventivi) p.quotes = [];
    if (!sec.pagamenti) p.payments = [];
    if (!sec.acquisti) p.purchases = {};
    if (!sec.cantiere) { p.tasks = []; p.contacts = []; p.reminders = []; }
    if (!sec.diario) p.diary = [];
    if (!sec.arredo) p.variants.forEach(v => { v.plan.furniture = {}; });
    p.chat = [];
    return p;
  }

  SH.exportProject = function (project, sec) {
    const p = sec ? filterProject(project, sec) : Object.assign(CM.clone(project), { history: undefined });
    const data = JSON.stringify({ type: 'casamia-progetto', version: 2, exported: Date.now(), project: p, materials: usedMaterials(p) });
    SH.file(safeName(project.name) + '.casamia.json', 'application/json', data);
  };

  function usedMaterials(p) {
    const ids = new Set();
    p.variants.forEach(v => Object.values(v.plan.rooms).forEach(r => { const f = r.finish || {}; ['floor', 'paint', 'cladding', 'wallpaper'].forEach(k => { if (f[k] && f[k].mat) ids.add(f[k].mat); }); }));
    return [...ids].map(id => CM.lib.material(id)).filter(m => m && !CM.MATERIALS_BASE.includes(m));
  }

  SH.backupJSON = function () {
    const projects = CM.store.listProjects().map(s => CM.store.loadProject(s.id)).filter(Boolean);
    return JSON.stringify({ type: 'casamia-backup', version: 2, exported: Date.now(), projects, catalog: CM.store.getJSON('catalogo', []), materials: CM.store.getJSON('materiali', []), prices: CM.store.getJSON('prezzi', {}) });
  };

  // Backup automatico settimanale nella cartella Download/CasaMia del telefono
  SH.autoBackup = function (force) {
    if (!native() || !native().saveDocument) return false;
    if (CM.store.pref('backupAuto') === false && !force) return false;
    const last = CM.store.pref('ultimoBackupAuto') || 0;
    if (!force && Date.now() - last < 7 * 864e5) return false;
    if (!CM.store.listProjects().length) return false;
    const ok = native().saveDocument('CasaMia-backup-automatico.json', 'application/json', b64utf8(SH.backupJSON()));
    if (ok) CM.store.pref('ultimoBackupAuto', Date.now());
    return ok;
  };

  /* ---------- Backup su Google Drive, aggiornato da solo ---------- */
  SH.driveLinked = () => !!(native() && native().hasBackupLink && native().hasBackupLink());
  SH.linkDrive = async function () {
    if (!native() || !native().linkBackup) { U().toast('Funziona nell\u2019app sul telefono'); return; }
    const ok = await U().dialog({ title: 'Backup su Google Drive', text: 'Ora si apre la finestra \u201cSalva\u201d di Android: tocca \u2630 in alto a sinistra, scegli Drive e la cartella che vuoi, poi Salva. Da quel momento ogni modifica ai progetti aggiorna quel file da sola (serve l\u2019app Google Drive installata). Per ripristinare: Carica un progetto \u203a scegli quel file.', actions: [{ label: 'Annulla', value: false }, { label: 'Scegli dove salvare', value: true, primary: true }] });
    if (ok) native().linkBackup();
  };
  CM.onBackupLinked = function (ok, where) {
    if (!ok) { U().toast('Backup su Drive non attivato'); return; }
    CM.store.pref('driveBackup', true);
    SH.driveBackup(true);
    U().dialog({ title: 'Backup su Drive attivo', text: 'Ho salvato una copia di tutti i progetti su ' + where + '. Si aggiorner\u00e0 da sola dopo ogni modifica. Resta anche la copia settimanale sul telefono in Download/CasaMia.' });
  };
  CM.onBackupWritten = function (ok) { CM.store.pref(ok ? 'driveOk' : 'driveErr', Date.now()); if (!ok && !SH._driveWarned) { SH._driveWarned = true; U().toast('Backup su Drive non riuscito: controlla la connessione o ricollega il file'); } };
  let driveTimer = 0;
  SH.driveBackup = function (now) {
    if (!SH.driveLinked()) return;
    clearTimeout(driveTimer);
    const go = () => { try { native().writeBackup(b64utf8(SH.backupJSON())); } catch (e) { console.error(e); } };
    if (now) go(); else driveTimer = setTimeout(go, 20000);
  };

  SH.backupAll = function () {
    const data = SH.backupJSON();
    SH.file('CasaMia-backup-' + new Date().toISOString().slice(0, 10) + '.json', 'application/json', data);
    CM.store.pref('ultimoBackup', Date.now());
    U().toast('Scegli Google Drive per salvare il backup');
  };

  // Importa un progetto o un backup dal suo contenuto (file scelto, ricevuto su WhatsApp, da Drive\u2026)
  SH.importText = function (text) {
    let d;
    try { d = JSON.parse(String(text).replace(/^\uFEFF/, '')); } catch (e) { U().toast('File non riconosciuto: non \u00e8 un progetto di Casa Mia'); return null; }
    const mergeLib = (key, list) => { if (!list || !list.length) return; const cur = CM.store.getJSON(key, []); const ids = new Set(cur.map(x => x.id)); CM.store.putJSON(key, cur.concat(list.filter(x => !ids.has(x.id)))); };
    if (d.type === 'casamia-backup') {
      let n = 0;
      for (const p of d.projects || []) { CM.project.normalize(p); CM.store.saveProject(p); n++; }
      mergeLib('catalogo', d.catalog); mergeLib('materiali', d.materials);
      if (d.prices && Object.keys(d.prices).length) CM.store.putJSON('prezzi', Object.assign(CM.store.getJSON('prezzi', {}), d.prices));
      U().toast(n + ' progetti ripristinati');
      return { backup: true };
    }
    // progetto esportato, oppure un progetto \u201cnudo\u201d (ha la pianta)
    const raw = d.type === 'casamia-progetto' && d.project ? d.project : (d.variants || d.plan ? d : null);
    if (raw) {
      const p = CM.project.normalize(raw);
      if (CM.store.loadProject(p.id)) { p.id = CM.uid('p'); p.name += ' (ricevuto)'; }
      p.updated = Date.now();
      CM.store.saveProject(p);
      mergeLib('materiali', d.materials); mergeLib('catalogo', d.catalog);
      U().toast('Progetto \u201c' + p.name + '\u201d caricato');
      return { project: p.id };
    }
    U().toast('Questo file non \u00e8 un progetto di Casa Mia');
    return null;
  };

  SH.importFile = function () {
    return new Promise(resolve => {
      const input = el('input', { type: 'file', accept: '*/*', style: 'display:none' });
      document.body.appendChild(input);
      input.addEventListener('change', () => {
        const f = input.files[0];
        input.remove();
        if (!f) return resolve(null);
        if (/^image\/|pdf$/i.test(f.type || '')) { U().toast('Questa \u00e8 una planimetria: usa \u201cPlanimetria\u201d'); return resolve(null); }
        const r = new FileReader();
        r.onload = () => resolve(SH.importText(r.result));
        r.onerror = () => { U().toast('Non riesco a leggere il file'); resolve(null); };
        r.readAsText(f);
      });
      input.click();
    });
  };

  /* ---------- Condivisione con altre persone ---------- */
  SH.shareDialog = async function (project) {
    const v = { name: '', role: 'vista', sec: Object.fromEntries(SECTIONS.map(([k]) => [k, ['pianta', 'stanze', 'arredo'].includes(k)])) };
    const checks = el('div', { class: 'check-list' }, SECTIONS.map(([k, label]) => el('label', { class: 'check' }, [
      el('input', { type: 'checkbox', checked: v.sec[k], onchange: (e) => { v.sec[k] = e.target.checked; } }), el('span', { text: label })
    ])));
    const body = el('div', { class: 'fields' }, [
      U().textField('Con chi condividi', '', x => { v.name = x; }),
      U().segField('Cosa può fare', [{ value: 'vista', label: 'Solo vedere' }, { value: 'modifica', label: 'Modificare' }], v.role, x => { v.role = x; }),
      el('div', { class: 'field full' }, [el('span', { class: 'lbl', text: 'Cosa può vedere' }), checks]),
      el('p', { class: 'muted small full', text: 'Solo vedere: invii una pagina web che si apre con qualsiasi telefono, senza l’app. Modificare: invii il file del progetto, che l’altra persona apre con Casa Mia (Menu › Apri file) e ti rimanda quando ha finito.' })
    ]);
    const ok = await U().dialog({ title: 'Condividi “' + project.name + '”', body, actions: [{ label: 'Annulla', value: false }, { label: 'Condividi', value: true, primary: true }] });
    if (!ok) return;
    if (v.role === 'vista') {
      const html = SH.reportHtml(project, v.sec, v.sec.pianta && CM.app && CM.app.snapshot3d && CM.app.snapshot3d(), true);
      SH.file(safeName(project.name) + '.html', 'text/html', html);
    } else {
      SH.exportProject(project, v.sec);
    }
    project.shares.push({ name: v.name || 'Senza nome', role: v.role, sections: Object.keys(v.sec).filter(k => v.sec[k]), date: Date.now() });
    app().save();
  };

  /* ---------- Storico versioni ---------- */
  SH.history = {
    list(pid) { return CM.store.getJSON('h_' + pid, []); },
    save(project, label) {
      const list = SH.history.list(project.id);
      const data = JSON.stringify(project.variants);
      if (list.length && list[list.length - 1].data === data) return false;
      list.push({ id: CM.uid('h'), date: Date.now(), label: label || 'Salvataggio automatico', data, active: project.active });
      while (list.length > 20) list.shift();
      CM.store.putJSON('h_' + project.id, list);
      return true;
    },
    auto(project) {
      const list = SH.history.list(project.id);
      const last = list[list.length - 1];
      if (!last || Date.now() - last.date > 30 * 60 * 1000) SH.history.save(project, 'Salvataggio automatico');
    },
    async dialog(project) {
      const list = SH.history.list(project.id).slice().reverse();
      const body = el('div', {}, [
        el('p', { text: 'Le versioni si salvano da sole ogni mezz’ora di lavoro. Ripristinando una versione, quella attuale resta nello storico.' }),
        el('div', { class: 'card' }, list.length ? list.map(h => el('div', { class: 'line' }, [
          el('div', { class: 'l-main' }, [el('span', { text: h.label }), el('span', { class: 'muted small', text: new Date(h.date).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })]),
          el('button', { class: 'btn small', text: 'Ripristina', onclick: async () => {
            const ok = await U().confirmDialog('Ripristinare questa versione?', 'La versione attuale viene salvata nello storico prima del ripristino.', 'Ripristina');
            if (!ok) return;
            SH.history.save(project, 'Prima del ripristino');
            project.variants = JSON.parse(h.data); project.active = h.active || project.variants[0].id;
            CM.project.normalize(project);
            U().closeOverlay(); app().reload(); U().toast('Versione ripristinata');
          } })
        ])) : [el('div', { class: 'muted', text: 'Ancora nessuna versione salvata.' })])
      ]);
      const r = await U().dialog({ title: 'Storico versioni', body, actions: [{ label: 'Salva versione ora', value: 'save' }, { label: 'Chiudi', value: true, primary: true }] });
      if (r === 'save') {
        const label = await U().promptDialog('Nome della versione', 'Versione del ' + new Date().toLocaleDateString('it-IT'), { label: 'Nome' });
        if (label != null) { SH.history.save(project, label || 'Versione'); U().toast('Versione salvata'); }
      }
    }
  };

  /* ---------- Assistente ---------- */
  SH.aiSettings = async function () {
    const v = { key: CM.ai.key(), model: CM.ai.textModel(), img: CM.ai.imageModel() };
    const body = el('div', { class: 'fields' }, [
      el('p', { class: 'full', html: 'L’assistente usa Google Gemini con una <b>chiave gratuita personale</b>: creala su <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> e incollala qui. Il piano gratuito ha limiti giornalieri.' }),
      U().textField('Chiave Gemini', v.key, x => { v.key = x; }),
      U().textField('Modello per testo e planimetrie', v.model, x => { v.model = x; }, { full: false }),
      U().textField('Modello per immagini', v.img, x => { v.img = x; }, { full: false })
    ]);
    const r = await U().dialog({ title: 'Assistente Gemini', body, actions: [{ label: 'Annulla', value: false }, { label: 'Prova', value: 'test' }, { label: 'Salva', value: true, primary: true }] });
    if (!r) return;
    CM.store.pref('geminiKey', v.key.trim());
    CM.store.pref('geminiModel', v.model.trim() || 'gemini-3.8-flash');
    CM.store.pref('geminiImageModel', v.img.trim() || 'gemini-2.5-flash-image');
    if (r === 'test') {
      try { const t = await CM.ai.text('Rispondi solo con la parola: pronto'); U().toast('Gemini risponde: ' + t.trim().slice(0, 40)); }
      catch (e) { U().toast(CM.ai.errorText(e)); }
    } else U().toast('Impostazioni salvate');
  };

  SH.assistant = async function (project) {
    if (!CM.ai.enabled()) { await SH.aiSettings(); if (!CM.ai.enabled()) return; }
    const log = el('div', { class: 'chat-log', role: 'log', 'aria-live': 'polite' });
    const input = el('input', { type: 'text', placeholder: 'Es. quanto spendo per il bagno?', 'aria-label': 'Messaggio' });
    const renderLog = () => {
      log.innerHTML = '';
      if (!project.chat.length) log.appendChild(el('div', { class: 'muted small', text: 'Chiedimi qualcosa sul progetto: costi, disposizione dei mobili, materiali, cosa manca.' }));
      for (const m of project.chat.slice(-30)) log.appendChild(el('div', { class: 'msg ' + (m.role === 'user' ? 'me' : 'ai'), text: m.text }));
      log.scrollTop = log.scrollHeight;
    };
    const send = async (text) => {
      if (!text.trim()) return;
      project.chat.push({ role: 'user', text, date: Date.now() });
      renderLog();
      const wait = el('div', { class: 'msg ai muted', text: 'Sto pensando…' }); log.appendChild(wait); log.scrollTop = log.scrollHeight;
      try {
        const history = project.chat.slice(-12, -1).map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
        const sys = 'Sei l’assistente di Casa Mia, un’app per progettare e ristrutturare casa in Italia. Rispondi in italiano, in modo concreto e breve. Misure in metri, prezzi in euro; i prezzi dell’app sono stime indicative. Dati del progetto (JSON): ' + JSON.stringify(CM.ai.projectContext(project));
        const ans = await CM.ai.text(text, { system: sys, history });
        project.chat.push({ role: 'ai', text: ans.trim(), date: Date.now() });
      } catch (e) { project.chat.push({ role: 'ai', text: CM.ai.errorText(e), date: Date.now() }); }
      app().save(); renderLog();
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { const t = input.value; input.value = ''; send(t); } });
    renderLog();
    const body = el('div', { class: 'chat' }, [
      log,
      el('div', { class: 'chat-input' }, [input, el('button', { class: 'btn primary', text: 'Invia', onclick: () => { const t = input.value; input.value = ''; send(t); } })]),
      el('div', { class: 'actions' }, [
        el('button', { class: 'btn small', text: 'Consigli d’arredo', onclick: () => { U().closeOverlay(); SH.layoutAdvice(project); } }),
        el('button', { class: 'btn small', text: 'Render fotorealistico', onclick: () => { U().closeOverlay(); SH.render(project); } }),
        el('button', { class: 'btn small', text: 'Cancella chat', onclick: () => { project.chat = []; app().save(); renderLog(); } })
      ])
    ]);
    U().dialog({ title: 'Assistente', body, actions: [{ label: 'Chiudi', value: true, primary: true }] });
  };

  // Gemini propone una disposizione di mobili per una stanza e la applica
  SH.layoutAdvice = async function (project, roomId) {
    if (!CM.ai.enabled()) { await SH.aiSettings(); if (!CM.ai.enabled()) return; }
    const plan = CM.project.plan(project);
    const rooms = Object.keys(plan.rooms);
    if (!rooms.length) { U().toast('Disegna prima almeno una stanza'); return; }
    let rid = roomId;
    if (!rid) {
      rid = await U().menu('Per quale stanza?', rooms.map(id => ({ id, label: plan.rooms[id].name, icon: 'room' })));
      if (!rid) return;
    }
    const wish = await U().promptDialog('Cosa desideri?', '', { label: 'Esigenze', text: 'Es. divano grande verso la TV, tavolo per 6, zona lettura. Lascia vuoto per una proposta libera.', ok: 'Chiedi a Gemini' });
    if (wish == null) return;
    U().toast('Gemini sta progettando la stanza…');
    const room = plan.rooms[rid];
    const pts = P.roomPts(plan, room);
    const ops = Object.values(plan.openings).filter(o => P.roomWalls(plan, room).includes(o.wall)).map(o => { const g = P.openingGeom(plan, o); return { tipo: o.kind, larghezza: o.w, x: CM.r3(g.c.x), y: CM.r3(g.c.y) }; });
    const catalog = CM.lib.catalog().filter(i => ['soggiorno', 'cucina', 'camera', 'bagno', 'studio', 'illuminazione', 'tessili', 'decorazioni', 'elettrodomestici', 'elettronica'].includes(i.cat)).map(i => ({ id: i.id, nome: i.name, w: i.w, d: i.d }));
    const prompt = 'Progetta la disposizione dei mobili per la stanza "' + room.name + '" (' + CM.roomType(room.type).label + '). ' +
      'Vertici del pavimento in metri (x verso destra, y verso il basso): ' + JSON.stringify(pts.map(p => [CM.r3(p.x), CM.r3(p.y)])) + '. Porte e finestre: ' + JSON.stringify(ops) + '. ' +
      'Esigenze: ' + (wish || 'proposta libera e funzionale') + '. Usa articoli di questo catalogo (id): ' + JSON.stringify(catalog) + '. ' +
      'Lascia passaggi di almeno 70 cm, non bloccare porte e finestre, appoggia armadi e letti alle pareti. ' +
      'Rispondi SOLO JSON: {"spiegazione":"breve testo","mobili":[{"id":"id del catalogo","x":centro_x,"y":centro_y,"rotazione_gradi":0}]}. Rotazione 0 = schienale verso y minore (verso l’alto), 90 = schienale verso destra.';
    try {
      const res = await CM.ai.text(prompt, { json: true });
      const list = (res.mobili || []).filter(m => CM.lib.item(m.id));
      if (!list.length) { U().toast('Nessuna proposta utilizzabile, riprova'); return; }
      const ok = await U().confirmDialog('Proposta per ' + room.name, (res.spiegazione || '') + ' (' + list.length + ' mobili). La aggiungo alla pianta? Puoi annullare.', 'Aggiungi');
      if (!ok) return;
      app().editor().mutate(pl => {
        for (const m of list) {
          const it = CM.lib.item(m.id);
          P.addFurniture(pl, it, +m.x, +m.y, ((+m.rotazione_gradi || 0) * Math.PI / 180));
        }
      }, 'ai-layout');
      app().setTab('pianta');
      app().editor().select({ type: 'room', id: rid });
      U().toast('Proposta aggiunta: controlla gli avvisi');
    } catch (e) { U().toast(CM.ai.errorText(e)); }
  };

  // Render fotorealistico a partire dalla vista 3D
  // Foto realistica della casa con i prodotti VERI che hai scelto (le loro foto vanno all'AI insieme alla vista 3D)
  SH.render = async function (project) {
    if (!CM.ai.enabled()) { await SH.aiSettings(); if (!CM.ai.enabled()) return; }
    const shot = CM.app.snapshot3d && CM.app.snapshot3d(true);
    if (!shot) { U().toast('Apri la scheda 3D e inquadra la vista da trasformare'); return; }
    const plan = CM.project.plan(project);
    // prodotti con foto: prima quelli dei negozi
    const prods = Object.values(plan.furniture).filter(f => f.img).sort((a, b) => (b.store ? 1 : 0) - (a.store ? 1 : 0));
    const pick = [];
    for (const f of prods) {
      if (pick.length >= 4) break;
      let img = f.img;
      if (/^https?:/i.test(img) && CM.localImage) img = await CM.localImage(img, 640);
      if (img && /^data:/.test(img)) pick.push({ f, img });
    }
    const ta = el('textarea', { rows: 2, placeholder: 'Facoltativo: es. luce del tramonto, atmosfera calda', style: 'width:100%' });
    const r = await U().dialog({ title: 'Foto realistica', text: 'Trasformo l\u2019inquadratura 3D in una foto d\u2019interni realistica' + (pick.length ? ', usando le foto vere di ' + pick.length + ' prodotti: ' + pick.map(p => p.f.name).join(', ') + '.' : '. Per vedere i prodotti veri, importali dai negozi con la loro foto.'), body: ta, actions: [{ label: 'Annulla', value: null }, { label: 'Crea', value: 'go', primary: true }] });
    if (r !== 'go') return;
    U().toast('Gemini sta creando la foto (pu\u00f2 richiedere un minuto)\u2026');
    try {
      const prompt = 'La PRIMA immagine \u00e8 un modello 3D semplificato di un interno: trasformala in una fotografia d\u2019interni fotorealistica, mantenendo esattamente prospettiva, pareti, porte, finestre, posizione e misure dei mobili e i colori dei materiali. ' +
        (pick.length ? 'Le immagini successive sono le foto dei PRODOTTI REALI scelti: sostituisci i mobili semplificati con questi prodotti, identici nell\u2019aspetto (forma, colore, tessuto, dettagli): ' + pick.map((p, i) => (i + 2) + '\u00aa immagine = ' + p.f.name).join('; ') + '. ' : '') +
        'Luce naturale, materiali realistici, nessuna persona, nessun testo. ' + (ta.value || '');
      const parts = [{ text: prompt }];
      const imgs = [shot].concat(pick.map(p => p.img));
      const out = await CM.ai.call(CM.ai.imageModel(), parts.concat(imgs.map(i => { const m = /^data:([^;]+);base64,(.*)$/.exec(i); return { inline_data: { mime_type: m ? m[1] : 'image/jpeg', data: m ? m[2] : i } }; })), { image: true });
      const img = out.images[0];
      if (!img) throw new Error(out.text || 'Nessuna immagine ricevuta');
      const body = el('div', {}, [el('img', { src: img, alt: 'Foto realistica', style: 'width:100%;border-radius:12px' })]);
      const rr = await U().dialog({ title: 'Foto realistica', body, actions: [{ label: 'Chiudi', value: false }, { label: 'In bacheca', value: 'board' }, { label: 'Condividi', value: 'share', primary: true }] });
      if (rr === 'share') SH.file('casa-' + safeName(project.name) + '.png', 'image/png', img, true);
      if (rr === 'board' && CM.inspire) CM.inspire.addToBoard({ project, plan: () => plan, mutate: () => {} }, img, 'Foto realistica');
    } catch (e) { U().toast(CM.ai.errorText(e)); }
  };

  /* ---------- Posizione (per il sole) ---------- */
  const CITIES = { Torino: 45.07, Milano: 45.46, Venezia: 45.44, Genova: 44.41, Bologna: 44.49, Firenze: 43.77, Ancona: 43.62, Perugia: 43.11, Roma: 41.9, Pescara: 42.46, Napoli: 40.85, Bari: 41.12, Potenza: 40.64, Cagliari: 39.22, Catanzaro: 38.91, Reggio_Calabria: 38.11, Palermo: 38.12, Catania: 37.5, Trento: 46.07, Bolzano: 46.5, Trieste: 45.65, Aosta: 45.74 };
  SH.locationDialog = async function (project) {
    const opts = Object.keys(CITIES).map(c => ({ value: c, label: c.replace('_', ' ') }));
    let city = project.address && CITIES[project.address] ? project.address : '';
    let lat = project.lat || 41.9;
    const body = el('div', { class: 'fields' }, [
      el('p', { class: 'full', text: 'Serve per simulare la luce del sole nella vista 3D. Scegli la città più vicina o scrivi la latitudine.' }),
      U().selectField('Città vicina', [{ value: '', label: 'Scegli…' }].concat(opts), city, x => { city = x; if (CITIES[x]) lat = CITIES[x]; }, { full: false }),
      U().numField('Latitudine', lat, '°', x => { lat = x; city = ''; }, { min: 35, max: 48 })
    ]);
    const ok = await U().dialog({ title: 'Dove si trova la casa?', body, actions: [{ label: 'Annulla', value: false }, { label: 'Salva', value: true, primary: true }] });
    if (!ok) return;
    project.address = city; project.lat = city ? CITIES[city] : lat;
    app().save();
  };
})(typeof window !== 'undefined' ? window : globalThis);
