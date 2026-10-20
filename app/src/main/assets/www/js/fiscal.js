/* Casa Mia — IVA, detrazioni fiscali (regole 2026) e computo metrico in Excel */
(function (root) {
  'use strict';
  const CM = root.CM;
  const U = () => CM.ui;
  const el = (...a) => CM.ui.el(...a);
  const F = CM.fiscal = {};

  // Regole 2026 (Legge di bilancio 2026): verificare sempre con il commercialista
  F.RULES = {
    year: 2026,
    ristrutturazione: { principale: 0.5, altra: 0.36, tetto: 96000, anni: 10 },
    mobili: { aliquota: 0.5, tetto: 5000, anni: 10 },
    ivaLavori: 0.10,    // manutenzione e ristrutturazione su abitazioni (con eccezioni per i “beni significativi”)
    ivaAcquisti: 0.22   // materiali e mobili comprati direttamente
  };
  F.NOTE = 'Stima indicativa secondo le regole 2026 (bonus ristrutturazione 50% abitazione principale / 36% altre case, tetto 96.000 €; bonus mobili 50% su max 5.000 € se collegato a una ristrutturazione iniziata dal 1/1/2025). Pagamenti con bonifico “parlante”. Verifica sempre con il tuo commercialista.';
  const LAVORI = ['Opere edili', 'Serramenti', 'Impianti', 'Finiture'];
  const NO_MOBILI = /tend|tappet|quadr|specchi|tv|televis|pianta|decor|lampad.*soffitto/i;

  F.settings = (project) => (project.fiscal = Object.assign({ abitazione: 'principale', prezziIva: 'esclusa', ristrutturazione: true }, project.fiscal || {}));

  F.compute = function (project, c) {
    const s = F.settings(project), R = F.RULES;
    c = c || CM.costs.compute(project);
    let lavori = 0, arredi = 0, arrediBonus = 0;
    for (const g of LAVORI) if (c.groups[g]) lavori += c.chosen[g] != null ? c.chosen[g] : c.groups[g].total;
    if (c.groups.Arredamento) for (const l of c.groups.Arredamento.lines) { arredi += l.total; if (!NO_MOBILI.test(l.label)) arrediBonus += l.total; }
    const ivaL = s.prezziIva === 'esclusa' ? lavori * R.ivaLavori : 0;
    const lavoriIva = lavori + ivaL;
    const aliq = s.abitazione === 'principale' ? R.ristrutturazione.principale : R.ristrutturazione.altra;
    const baseR = Math.min(R.ristrutturazione.tetto, lavoriIva);
    const detR = s.ristrutturazione ? baseR * aliq : 0;
    const baseM = s.ristrutturazione ? Math.min(R.mobili.tetto, arrediBonus) : 0;
    const detM = baseM * R.mobili.aliquota;
    const totale = lavoriIva + arredi;
    return { lavori, ivaL, lavoriIva, arredi, arrediBonus, totale, aliq, detR, detM, det: detR + detM, annuo: (detR + detM) / 10, netto: totale - detR - detM };
  };

  F.card = function (project, rerender) {
    const s = F.settings(project), x = F.compute(project);
    const eur = CM.fmt.eur;
    const seg = (label, opts, val, on) => U().segField(label, opts, val, v => { on(v); CM.app.save(); rerender && rerender(); });
    return el('div', { class: 'card' }, [
      el('div', { class: 'gh-name', text: 'IVA e detrazioni ' + F.RULES.year }),
      el('div', { class: 'fields' }, [
        seg('Casa', [{ value: 'principale', label: 'Abitazione principale' }, { value: 'altra', label: 'Altra casa' }], s.abitazione, v => { s.abitazione = v; }),
        seg('Prezzi dei lavori', [{ value: 'esclusa', label: 'IVA esclusa' }, { value: 'inclusa', label: 'IVA inclusa' }], s.prezziIva, v => { s.prezziIva = v; }),
        seg('È una ristrutturazione', [{ value: true, label: 'Sì' }, { value: false, label: 'No' }], s.ristrutturazione, v => { s.ristrutturazione = v; })
      ]),
      el('div', { class: 'stats' }, [
        U().stat('Lavori' + (s.prezziIva === 'esclusa' ? ' + IVA 10%' : ''), eur(x.lavoriIva)),
        U().stat('Arredi (IVA incl.)', eur(x.arredi)),
        U().stat('Totale', eur(x.totale)),
        U().stat('Detrazione lavori ' + Math.round(x.aliq * 100) + '%', eur(x.detR)),
        U().stat('Bonus mobili 50%', eur(x.detM)),
        U().stat('Ti torna ogni anno', eur(x.annuo) + ' × 10'),
        U().stat('Costo reale', eur(x.netto))
      ]),
      el('p', { class: 'muted small', text: F.NOTE })
    ]);
  };

  /* ---------- Excel (xlsx) senza librerie: zip non compresso ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let off = 0;
    for (const f of files) {
      const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(8, 0, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    }
    const cs = central.reduce((s, a) => s + a.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
    const all = parts.concat(central, [new Uint8Array(e.buffer)]);
    const out = new Uint8Array(all.reduce((s, a) => s + a.length, 0));
    let p = 0; for (const a of all) { out.set(a, p); p += a.length; }
    return out;
  }
  const xesc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const colName = (i) => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

  // rows: array di righe; cella = stringa | numero | {f: formula} | {v, s: stile}
  F.xlsx = function (sheetName, rows, widths) {
    const sheetRows = rows.map((r, ri) => '<row r="' + (ri + 1) + '">' + r.map((c, ci) => {
      if (c == null || c === '') return '';
      const ref = colName(ci) + (ri + 1);
      const o = typeof c === 'object' ? c : { v: c };
      const st = o.s ? ' s="' + o.s + '"' : '';
      if (o.f) return '<c r="' + ref + '"' + st + '><f>' + xesc(o.f) + '</f></c>';
      if (typeof o.v === 'number') return '<c r="' + ref + '"' + st + '><v>' + (Math.round(o.v * 100) / 100) + '</v></c>';
      return '<c r="' + ref + '" t="inlineStr"' + st + '><is><t xml:space="preserve">' + xesc(o.v) + '</t></is></c>';
    }).join('') + '</row>').join('');
    const cols = widths ? '<cols>' + widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>' : '';
    const files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + xesc(sheetName) + '" sheetId="1" r:id="rId1"/></sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      // stili: 0 normale, 1 grassetto, 2 euro, 3 euro grassetto, 4 titolo, 5 numero 2 decimali, 6 cella gialla da compilare (euro)
      { name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00 &quot;€&quot;"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF6CC"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="7"><xf/><xf fontId="1" applyFont="1"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" applyNumberFormat="1" applyFont="1"/><xf fontId="2" applyFont="1"/><xf numFmtId="2" applyNumberFormat="1"/><xf numFmtId="164" fillId="2" applyNumberFormat="1" applyFill="1"/></cellXfs></styleSheet>' },
      { name: 'xl/worksheets/sheet1.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + cols + '<sheetData>' + sheetRows + '</sheetData></worksheet>' }
    ];
    return zip(files);
  };

  // Computo metrico: le ditte compilano la colonna gialla con il loro prezzo
  F.computoXlsx = function (project) {
    const plan = CM.project.plan(project);
    const c = CM.costs.compute(project, plan);
    const rows = [];
    rows.push([{ v: 'Computo metrico — ' + project.name, s: 4 }]);
    rows.push(['Creato con Casa Mia il ' + new Date().toLocaleDateString('it-IT') + (project.address ? ' · ' + project.address : '') + ' · Le ditte compilano la colonna gialla “Prezzo unitario ditta”.']);
    rows.push([]);
    const head = ['N.', 'Categoria', 'Descrizione', 'Stanza', 'Unità', 'Quantità', 'Prezzo unitario stimato', 'Importo stimato', 'Prezzo unitario ditta', 'Importo ditta', 'Note'];
    rows.push(head.map(h => ({ v: h, s: 1 })));
    let n = 0;
    const totRows = [];
    for (const g of CM.costs.GROUPS) {
      if (g === 'Arredamento' || !c.groups[g]) continue;
      const first = rows.length + 2;
      for (const l of c.groups[g].lines) {
        n++;
        const r = rows.length + 1;
        const unit = l.qty ? l.total / l.qty : 0;
        rows.push([n, g, l.label, l.room && plan.rooms[l.room] ? plan.rooms[l.room].name : '', l.unit, { v: l.qty, s: 5 }, { v: unit, s: 2 }, { f: 'F' + r + '*G' + r, s: 2 }, { v: '', s: 6 }, { f: 'IF(I' + r + '="","",F' + r + '*I' + r + ')', s: 2 }, l.detail || '']);
      }
      const last = rows.length;
      rows.push(['', { v: 'Totale ' + g, s: 1 }, '', '', '', '', '', { f: 'SUM(H' + first + ':H' + last + ')', s: 3 }, '', { f: 'SUM(J' + first + ':J' + last + ')', s: 3 }]);
      totRows.push(rows.length);
    }
    rows.push([]);
    rows.push(['', { v: 'TOTALE LAVORI (IVA esclusa)', s: 1 }, '', '', '', '', '', { f: totRows.map(r => 'H' + r).join('+') || '0', s: 3 }, '', { f: totRows.map(r => 'J' + r).join('+') || '0', s: 3 }]);
    const tr = rows.length;
    rows.push(['', { v: 'IVA 10%', s: 1 }, '', '', '', '', '', { f: 'H' + tr + '*0.1', s: 2 }, '', { f: 'J' + tr + '*0.1', s: 2 }]);
    rows.push(['', { v: 'TOTALE CON IVA', s: 1 }, '', '', '', '', '', { f: 'H' + tr + '*1.1', s: 3 }, '', { f: 'J' + tr + '*1.1', s: 3 }]);
    rows.push([]);
    rows.push(['', 'Ditta:', '', '', '', '', '', '', 'Firma:']);
    return F.xlsx('Computo', rows, [5, 14, 42, 16, 7, 10, 14, 14, 14, 14, 24]);
  };

  F.exportComputo = function (project) {
    const bytes = F.computoXlsx(project);
    let bin = ''; for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    const url = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + btoa(bin);
    CM.share.file('Computo-' + project.name.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-') + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', url, true);
  };
})(typeof window !== 'undefined' ? window : globalThis);
