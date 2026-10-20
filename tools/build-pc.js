// Crea "CasaMia-PC.html": l'app in un unico file da aprire con Chrome o Edge su Windows (doppio clic).
// Tutto incluso: script, stili, font. I progetti restano nel browser del PC; si aprono e salvano come file.
const fs = require('fs'), path = require('path');
const www = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'www');
let html = fs.readFileSync(path.join(www, 'index.html'), 'utf8');
const read = (rel) => fs.readFileSync(path.join(www, rel));
// CSS con i font incorporati
html = html.replace(/<link[^>]+href="([^"]+\.css)"[^>]*>/g, (m, href) => {
  let css = read(href).toString('utf8');
  const base = path.dirname(href);
  css = css.replace(/url\((\.\.\/fonts\/[^)]+)\)/g, (mm, f) => {
    const p = path.join(base, f);
    try { return 'url(data:font/woff2;base64,' + read(p).toString('base64') + ')'; } catch (e) { return mm; }
  });
  return '<style>\n' + css + '\n</style>';
});
// script incorporati
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => '<script>\n' + read(src).toString('utf8').replace(/<\/script/gi, '<\\/script') + '\n</script>');
html = html.replace('<head>', '<head>\n<!-- Casa Mia per PC: apri questo file con Chrome o Edge -->');
const out = process.argv[2] || 'CasaMia-PC.html';
fs.writeFileSync(out, html);
console.log('Creato ' + out + ' (' + Math.round(html.length / 1024) + ' KB)');
