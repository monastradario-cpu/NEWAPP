/* Casa Mia — spiegazioni dei termini (i) e centro errori con correzione automatica */
(function (root) {
  'use strict';
  const CM = root.CM;
  const P = CM.plan, G = CM.geom;

  /* ---------- Glossario: la (i) accanto ai campi ---------- */
  CM.GLOSSARY = {
    'Lunghezza di questo tratto': 'Un “tratto” è il pezzo di parete tra due incroci con altri muri. Se cambi la sua misura, la casa si allunga o si accorcia da un lato: i muri attaccati si spostano insieme e gli angoli restano dritti.',
    'Allunga o accorcia verso': 'Indica quale estremo del muro si sposta quando cambi la lunghezza. Tutto quello che sta da quella parte (muri, stanze, mobili) trasla insieme.',
    'Modifica': '“Solo questo tratto” cambia solo il pezzo selezionato. “Tutta la parete” applica spessore, altezza e stato a tutti i tratti allineati della stessa parete.',
    'Spessore': 'Spessore del muro finito, intonaco compreso. Tipico: tramezzi 8–12 cm, muri portanti 25–40 cm, muri esterni 30–45 cm.',
    'Altezza': 'Altezza dal pavimento finito.',
    'Altezza soffitto': 'Altezza netta della stanza dal pavimento al soffitto. Per legge (D.M. 5/7/1975) almeno 270 cm nelle stanze abitabili e 240 cm in bagni, corridoi e ripostigli.',
    'Stato': 'Esistente = c’è già e resta (nero). Da demolire = va abbattuto (giallo tratteggiato). Da costruire = muro nuovo (rosso). Serve per i computi dei lavori e per lo stato di fatto/progetto.',
    'Tutti i muri della stanza': 'Cambia lo stato di tutti i muri che chiudono questa stanza in un colpo solo.',
    'Larghezza': 'Misura interna, da muro a muro (asse dei muri per le stanze disegnate).',
    'Lunghezza': 'Misura interna, da muro a muro (asse dei muri per le stanze disegnate).',
    'Profondità': 'Ingombro del mobile dal muro verso il centro della stanza.',
    'Da terra': 'Distanza del fondo del mobile dal pavimento (es. pensili 140–150 cm).',
    'Davanzale da terra': 'Altezza del davanzale (parte bassa della finestra) dal pavimento. Tipico 90–110 cm.',
    'Distanza dall’angolo': 'Distanza tra l’inizio del muro e il bordo dell’apertura.',
    'Posa': 'Come vengono messe le piastrelle o il parquet. Dritta: a file allineate (meno sfrido). Sfalsata: ogni fila spostata di mezza piastrella. Diagonale: a 45° (più sfrido, circa +15%). Spina di pesce: listelli a V, tipico del parquet (circa +15%).',
    'Fuga': 'Lo spazio tra una piastrella e l’altra, riempito di stucco. Tipico 2–3 mm per gres rettificato, 3–5 mm per piastrelle non rettificate.',
    'Mani': 'Quante passate di pittura. Su muro nuovo o cambio di colore servono di solito 2 mani.',
    'Soffitto': 'Se includere anche il soffitto nel calcolo della pittura.',
    'Resa': 'Quanti m² copre un litro di pittura per una mano (scritto sulla latta, es. 10–12 m²/L).',
    'Misura reale': 'La lunghezza vera di quel tratto, presa col metro o dalla quota scritta sulla planimetria.',
    'Misura reale del muro blu': 'La lunghezza vera del muro evidenziato, presa col metro o dalla quota scritta sulla planimetria. Da questa ricavo la scala di tutto il disegno.',
    'Tipo di ambiente': 'Serve per i controlli di legge (superfici minime, finestre), per il calcolo dei costi e per i suggerimenti d’arredo.'
  };

  /* ---------- Centro errori ---------- */
  const r3 = (v) => Math.round(v * 1000) / 1000;

  // Prova a spostare un mobile in un punto vicino dove non dà più problemi
  function relocate(plan, id) {
    const f = plan.furniture[id];
    if (!f) return false;
    const x0 = f.x, y0 = f.y, rot0 = f.rot || 0;
    const ok = () => !(CM.checks.furniture(plan)[id] || []).length;
    const step = 0.05;
    for (let r = 1; r <= 50; r++) {
      for (let i = -r; i <= r; i++) {
        for (const [dx, dy] of [[i, -r], [i, r], [-r, i], [r, i]]) {
          f.x = r3(x0 + dx * step); f.y = r3(y0 + dy * step);
          if (ok()) return true;
        }
      }
      if (r === 20) { // prova anche ruotato di 90°
        f.rot = (rot0 + 90) % 360; f.x = x0; f.y = y0; if (ok()) return true; f.rot = rot0;
      }
    }
    f.x = x0; f.y = y0; f.rot = rot0;
    return false;
  }

  CM.problems = function (plan, warnings) {
    const out = [];
    // regole di legge sulle stanze
    for (const n of CM.norms.check(plan)) {
      const room = plan.rooms[n.room];
      const it = { text: n.text, sel: { type: 'room', id: n.room } };
      if (/altezza/.test(n.text) && room) {
        const need = /240/.test(n.text) ? 2.4 : 2.7;
        it.fixLabel = 'Porta a ' + Math.round(need * 100) + ' cm';
        it.fix = (pl) => { if (pl.rooms[n.room]) { pl.rooms[n.room].h = need; return true; } return false; };
      } else if (/camera doppia/.test(n.text) && room) {
        const st = P.roomStats(plan, room);
        if (st.net >= 9) { it.fixLabel = 'È una singola'; it.fix = (pl) => { if (pl.rooms[n.room]) { pl.rooms[n.room].type = 'cameretta'; return true; } return false; }; }
      }
      out.push(it);
    }
    // arredo
    const fw = warnings || CM.checks.furniture(plan);
    for (const fid in fw) {
      if (!plan.furniture[fid]) continue;
      for (const w of fw[fid]) {
        out.push({ text: plan.furniture[fid].name + ': ' + w, sel: { type: 'furniture', id: fid }, fixLabel: 'Sposta io', fix: (pl) => relocate(pl, fid) });
      }
    }
    // muri quasi dritti
    for (const id in plan.walls) {
      const w = plan.walls[id], A = plan.nodes[w.a], B = plan.nodes[w.b];
      if (!A || !B) continue;
      const L = G.dist(A, B);
      if (L < 0.08) {
        out.push({ text: 'Muro cortissimo (' + CM.fmt.cm(L) + '): probabilmente un errore di disegno', sel: { type: 'wall', id }, fixLabel: 'Elimina', fix: (pl) => { if (!pl.walls[id]) return false; P.mergeNodes(pl, pl.walls[id].a, pl.walls[id].b); return true; } });
        continue;
      }
      const ang = Math.abs(Math.atan2(B.y - A.y, B.x - A.x) * 180 / Math.PI) % 90;
      const off = Math.min(ang, 90 - ang);
      if (off > 0.2 && off < 4) {
        out.push({
          text: 'Muro storto di ' + CM.fmt.num(off, 1) + '° (' + CM.fmt.m(L) + ')', sel: { type: 'wall', id }, fixLabel: 'Raddrizza',
          fix: (pl) => {
            const ww = pl.walls[id]; if (!ww) return false;
            const a = pl.nodes[ww.a], b = pl.nodes[ww.b];
            if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) { const y = r3((a.y + b.y) / 2); a.y = y; b.y = y; }
            else { const x = r3((a.x + b.x) / 2); a.x = x; b.x = x; }
            return true;
          }
        });
      }
    }
    // vertici quasi sovrapposti ma non uniti
    const ids = Object.keys(plan.nodes);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = plan.nodes[ids[i]], b = plan.nodes[ids[j]];
      const d = G.dist(a, b);
      if (d > 0.006 && d < 0.04) {
        const ka = ids[i], kb = ids[j];
        out.push({ text: 'Due angoli a ' + CM.fmt.cm(d) + ' uno dall’altro non sono uniti: la stanza potrebbe non chiudersi', sel: {}, at: { x: a.x, y: a.y }, fixLabel: 'Unisci', fix: (pl) => { if (!pl.nodes[ka] || !pl.nodes[kb]) return false; P.mergeNodes(pl, ka, kb); return true; } });
      }
    }
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
