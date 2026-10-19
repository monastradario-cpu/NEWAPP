// Test della logica della pianta: node tests/plan.test.js
const path = require('path');
const CM = require(path.join(__dirname, '..', 'app/src/main/assets/www/js/core.js'));
require(path.join(__dirname, '..', 'app/src/main/assets/www/js/sample.js'));

let failed = 0;
function check(cond, msg) {
  if (!cond) { failed++; console.error('✗ ' + msg); } else console.log('✓ ' + msg);
}

const errs = CM.selfTest();
errs.forEach(e => console.error('  ' + e));
check(errs.length === 0, 'autotest del modello');

// Muro libero che attraversa un muro esistente in un punto interno: deve dividerlo
{
  const P = CM.plan;
  const plan = P.create();
  P.addRectRoom(plan, 0, 0, 4, 4, {});
  const a = P.getOrCreateNode(plan, 2, 0);
  const b = P.getOrCreateNode(plan, 2, 4);
  P.addWall(plan, a, b, {});
  check(Object.keys(plan.walls).length === 7, 'tramezzo a T su due muri (7 muri)');
  // Unione di nodi: spostare un nodo sopra un altro li fonde
  const extra = P.addNode(plan, 6, 6);
  P.addWall(plan, b, extra, {});
  P.mergeNodes(plan, b, extra);
  check(!plan.nodes[extra], 'nodo fuso eliminato');
  check(Object.values(plan.walls).every(w => w.a !== w.b), 'nessun muro degenere dopo la fusione');
}

// Muri sovrapposti parzialmente
{
  const P = CM.plan;
  const plan = P.create();
  const n1 = P.addNode(plan, 0, 0), n2 = P.addNode(plan, 4, 0);
  P.addWall(plan, n1, n2, {});
  const n3 = P.getOrCreateNode(plan, 2, 0), n4 = P.getOrCreateNode(plan, 6, 0);
  P.addWall(plan, n3, n4, {});
  const total = Object.values(plan.walls).reduce((s, w) => s + P.wallLen(plan, w), 0);
  check(Math.abs(total - 6) < 1e-6, 'muri sovrapposti non duplicati (lunghezza totale 6 m)');
}

// Progetto d'esempio coerente
{
  const p = CM.sample.create();
  const plan = CM.project.plan(p);
  const t = CM.plan.totals(plan);
  check(Object.keys(plan.rooms).length === 8, 'esempio: 8 ambienti');
  check(t.gross > 80 && t.gross < 100, 'esempio: superficie lorda plausibile (' + t.gross.toFixed(1) + ')');
  check(Object.keys(plan.openings).length >= 14, 'esempio: porte e finestre presenti');
  check(Object.values(plan.walls).some(w => w.state === 'demolire'), 'esempio: muro da demolire');
  check(Object.values(plan.walls).some(w => w.state === 'nuovo'), 'esempio: muro nuovo');
  check(Object.values(plan.openings).every(o => plan.walls[o.wall]), 'esempio: aperture su muri esistenti');
}

if (failed) { console.error(failed + ' test falliti'); process.exit(1); }
console.log('Tutti i test superati');
