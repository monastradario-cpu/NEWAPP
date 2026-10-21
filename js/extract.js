/* Casa Mia — lettore eseguito dentro la pagina del negozio. Restituisce una stringa JSON. */
(function () {
  var out = [], seen = {};
  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function abs(u) { try { return u ? new URL(u, location.href).href : ''; } catch (e) { return ''; } }
  function num(s) {
    if (s == null || s === '') return null;
    if (typeof s === 'number') return s;
    var t = String(s).replace(/[^\d.,]/g, '');
    if (!t) return null;
    if (t.indexOf(',') >= 0 && t.indexOf('.') >= 0) {
      t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
    } else if (t.indexOf(',') >= 0) t = t.replace(',', '.');
    else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '');
    var v = parseFloat(t);
    return isFinite(v) ? v : null;
  }
  function first(x) { return Array.isArray(x) ? x[0] : x; }
  function push(o) {
    o.name = clean(o.name);
    if (!o.name || o.name.length < 3) return;
    var k = (o.url || '') + '|' + o.name;
    if (seen[k]) return;
    seen[k] = 1;
    out.push(o);
  }
  function walk(d) {
    if (!d || typeof d !== 'object') return;
    if (Array.isArray(d)) { d.forEach(walk); return; }
    var t = [].concat(d['@type'] || []);
    if (t.indexOf('Product') >= 0 || t.indexOf('ProductGroup') >= 0) {
      var off = first(d.offers) || {};
      if (off.offers) off = first(off.offers) || off;
      var price = num(off.price != null ? off.price : (off.lowPrice != null ? off.lowPrice : (off.priceSpecification && first(off.priceSpecification).price)));
      var img = first(d.image);
      var dims = ['width', 'depth', 'height'].map(function (k) { var v = d[k]; return v ? (k + ' ' + (v.value || v) + ' ' + (v.unitCode || v.unitText || '')) : ''; }).join(' ');
      var props = [].concat(d.additionalProperty || []).map(function (p) { return (p.name || '') + ': ' + (p.value || ''); }).join(' ; ');
      push({ name: d.name, price: price, url: abs(d.url || (off.url) || location.href), img: abs(img && (img.url || img.contentUrl || img)), desc: clean((d.description || '') + ' ' + dims + ' ' + props).slice(0, 900), brand: clean(d.brand && (d.brand.name || d.brand)), category: clean(d.category) });
    }
    if (d.itemListElement) [].concat(d.itemListElement).forEach(function (e) { walk(e.item || e); });
    if (d['@graph']) walk(d['@graph']);
    if (d.mainEntity) walk(d.mainEntity);
    if (d.hasVariant) walk(d.hasVariant);
  }
  try {
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < scripts.length; i++) { try { walk(JSON.parse(scripts[i].textContent)); } catch (e) { } }
  } catch (e) { }
  function meta(p) { var m = document.querySelector('meta[property="' + p + '"],meta[name="' + p + '"],meta[itemprop="' + p + '"]'); return m && m.content; }
  if (!out.length && /product/i.test(meta('og:type') || '')) {
    push({ name: meta('og:title') || document.title, price: num(meta('product:price:amount') || meta('og:price:amount') || meta('price')), url: location.href, img: abs(meta('og:image')), desc: clean(meta('og:description')) });
  }
  // Schede prodotto generiche: link con immagine e prezzo in euro
  if (out.length < 3) {
    var cards = [];
    var anchors = document.querySelectorAll('a[href]');
    for (var a = 0; a < anchors.length && out.length < 80; a++) {
      var link = anchors[a];
      var im = link.querySelector('img');
      if (!im) continue;
      var c = link, txt = '';
      for (var up = 0; up < 5 && c; up++) { txt = c.innerText || ''; if (/€|EUR/.test(txt)) break; c = c.parentElement; }
      if (!c || cards.indexOf(c) >= 0) continue;
      var pm = txt.match(/(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?)\s*€|€\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?)/);
      if (!pm) continue;
      cards.push(c);
      var lines = txt.split('\n').map(clean).filter(function (l) { return l.length > 5 && !/€/.test(l); });
      push({ name: clean(im.alt) || lines[0] || link.title, price: num(pm[1] || pm[2]), url: abs(link.href), img: abs(im.currentSrc || im.src || im.getAttribute('data-src')), desc: clean(txt).slice(0, 400) });
    }
  }
  var text = '';
  try { text = (document.body.innerText || '').slice(0, 20000); } catch (e) { }
  if (out.length === 1) {
    var extra = text.match(/(dimensioni|misure|larghezza|profondità|altezza|formato|resa|confezione|contenuto)[^\n]{0,160}/gi) || [];
    out[0].desc = clean(out[0].desc + ' ' + extra.join(' ; ')).slice(0, 1500);
  }
  var crumbs = [];
  try { document.querySelectorAll('[class*="readcrumb"] a, nav[aria-label*="read"] a, [itemtype*="BreadcrumbList"] a').forEach(function (x) { var t = clean(x.innerText); if (t) crumbs.push(t); }); } catch (e) { }
  // modelli 3D (GLB) caricati o citati dalla pagina (es. “Vedi in 3D” di IKEA)
  var models = [];
  try {
    (performance.getEntriesByType('resource') || []).forEach(function (e) { if (/\.glb(\?|$)/i.test(e.name)) models.push(e.name); });
    var html = document.documentElement.innerHTML;
    var re = /https?:\\?\/\\?\/[^"'\s<>]+?\.glb(?:\?[^"'\s<>]*)?/gi, mm;
    while ((mm = re.exec(html)) && models.length < 10) models.push(mm[0].replace(/\\\//g, '/'));
    (window.__casaMiaGlb || []).forEach(function (u) { models.push(u); });
  } catch (e) { }
  models = models.filter(function (u, i) { return models.indexOf(u) === i; });
  return JSON.stringify({ items: out.slice(0, 80), title: document.title, url: location.href, host: location.hostname, crumbs: crumbs.join(' > '), text: text.slice(0, 30000), models: models });
})();
