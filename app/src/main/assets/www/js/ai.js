/* Casa Mia — assistente AI (Google Gemini, chiave personale gratuita) */
(function (root) {
  'use strict';
  const CM = root.CM;
  const API = 'https://generativelanguage.googleapis.com/v1beta/models/';

  const AI = CM.ai = {
    key() { return (CM.store && CM.store.pref('geminiKey')) || ''; },
    textModel() { return (CM.store && CM.store.pref('geminiModel')) || 'gemini-3.8-flash'; },
    imageModel() { return (CM.store && CM.store.pref('geminiImageModel')) || 'gemini-2.5-flash-image'; },
    enabled() { return !!AI.key(); },

    // Se Google ritira un modello, ne scelgo da solo uno nuovo e lo ricordo
    async pickModel(oldModel, msg, wantImage) {
      const m = /use\s+(?:models\/)?(gemini-[\w.-]+)/i.exec(msg || '');
      if (m && !wantImage) return m[1];
      try {
        const r = await fetch(API.replace(/models\/$/, 'models') + '?pageSize=200&key=' + encodeURIComponent(AI.key()));
        const d = await r.json();
        const names = (d.models || [])
          .filter(x => (x.supportedGenerationMethods || []).includes('generateContent'))
          .map(x => String(x.name).replace(/^models\//, ''))
          .filter(n => /^gemini-/.test(n) && /flash/.test(n) && !/(lite|tts|live|audio|embedding|thinking|exp)/.test(n) && (wantImage ? /image/.test(n) : !/image/.test(n)));
        const ver = n => { const v = /gemini-(\d+(?:\.\d+)?)/.exec(n); return v ? parseFloat(v[1]) : 0; };
        names.sort((a, b) => (ver(b) - ver(a)) || (/preview/.test(a) - /preview/.test(b)) || (a.length - b.length));
        const pick = names.find(n => n !== oldModel);
        if (pick) return pick;
      } catch (e) {}
      return m ? m[1] : null;
    },

    async call(model, parts, opts) {
      try { return await AI._call(model, parts, opts); } catch (e) {
        const msg = String(e.message || '');
        if (!/no longer available|not found|not supported|deprecated|update your code/i.test(msg)) throw e;
        const wantImage = !!(opts && opts.image);
        const nm = await AI.pickModel(model, msg, wantImage);
        if (!nm || nm === model) throw e;
        CM.store.pref(wantImage ? 'geminiImageModel' : 'geminiModel', nm);
        if (CM.ui) CM.ui.toast('Gemini: passo al modello ' + nm);
        return AI._call(nm, parts, opts);
      }
    },

    async _call(model, parts, opts) {
      opts = opts || {};
      if (!AI.key()) throw new Error('NO_KEY');
      const body = { contents: (opts.history || []).concat([{ role: 'user', parts }]) };
      if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
      const gc = {};
      if (opts.json) gc.responseMimeType = 'application/json';
      if (opts.image) gc.responseModalities = ['TEXT', 'IMAGE'];
      if (Object.keys(gc).length) body.generationConfig = gc;
      const r = await fetch(API + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(AI.key()), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = (data.error && data.error.message) || ('HTTP ' + r.status);
        throw new Error(msg);
      }
      const cand = data.candidates && data.candidates[0];
      const out = { text: '', images: [] };
      for (const p of (cand && cand.content && cand.content.parts) || []) {
        if (p.text) out.text += p.text;
        const inl = p.inlineData || p.inline_data;
        if (inl && inl.data) out.images.push('data:' + (inl.mimeType || inl.mime_type || 'image/png') + ';base64,' + inl.data);
      }
      return out;
    },

    async text(prompt, opts) {
      opts = opts || {};
      const parts = [{ text: prompt }];
      for (const im of opts.images || []) parts.push(imagePart(im));
      const out = await AI.call(AI.textModel(), parts, opts);
      if (opts.json) return parseJSON(out.text);
      return out.text;
    },

    async image(prompt, imageDataUrl) {
      const parts = [{ text: prompt }];
      if (imageDataUrl) parts.push(imagePart(imageDataUrl));
      const out = await AI.call(AI.imageModel(), parts, { image: true });
      if (!out.images.length) throw new Error(out.text || 'Nessuna immagine ricevuta');
      return out.images[0];
    },

    errorText(e) {
      const m = String(e && e.message || e);
      if (m === 'NO_KEY') return 'Inserisci la chiave Gemini nelle impostazioni dell’assistente.';
      if (/API key not valid|API_KEY_INVALID/i.test(m)) return 'La chiave Gemini non è valida.';
      if (/quota|exhausted|429/i.test(m)) return 'Limite giornaliero del piano gratuito raggiunto: riprova più tardi.';
      if (/Failed to fetch|NetworkError/i.test(m)) return 'Serve la connessione a internet.';
      if (/not found|is not supported/i.test(m)) return 'Il modello Gemini indicato non è disponibile: cambialo nelle impostazioni.';
      return 'Errore dell’assistente: ' + m.slice(0, 160);
    }
  };

  function imagePart(dataUrl) {
    const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
    return { inline_data: { mime_type: m ? m[1] : 'image/jpeg', data: m ? m[2] : dataUrl } };
  }
  function parseJSON(t) {
    const s = String(t || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    try { return JSON.parse(s); } catch (e) {
      const i = s.indexOf('{'), j = s.lastIndexOf('}');
      if (i >= 0 && j > i) return JSON.parse(s.slice(i, j + 1));
      throw new Error('Risposta non leggibile');
    }
  }
  AI.parseJSON = parseJSON;

  // Riassunto compatto del progetto da dare all'assistente come contesto
  AI.projectContext = function (project) {
    const plan = CM.project.plan(project);
    const P = CM.plan;
    const rooms = Object.keys(plan.rooms).map(id => {
      const r = plan.rooms[id], st = P.roomStats(plan, r), rect = P.rectInfo(plan, r);
      const pts = P.roomPts(plan, r).map(p => [CM.r3(p.x), CM.r3(p.y)]);
      return { id, nome: r.name, tipo: r.type, m2: +st.net.toFixed(1), altezza: r.h, rettangolo: rect ? [CM.r3(rect.x0), CM.r3(rect.y0), CM.r3(rect.w), CM.r3(rect.h)] : null, vertici: pts };
    });
    const furniture = Object.values(plan.furniture).map(f => ({ nome: f.name, x: f.x, y: f.y, w: f.w, d: f.d, prezzo: f.price }));
    const openings = Object.values(plan.openings).map(o => { const g = P.openingGeom(plan, o); return { tipo: o.kind, larghezza: o.w, x: g ? CM.r3(g.c.x) : null, y: g ? CM.r3(g.c.y) : null }; });
    let costi = null;
    try { const c = CM.costs.compute(project); costi = { totale: Math.round(c.total), materiali: Math.round(c.mat), manodopera: Math.round(c.lab), perVoce: Object.fromEntries(Object.entries(c.groups).map(([k, g]) => [k, Math.round(g.total)])) }; } catch (e) { /* ignora */ }
    return { progetto: project.name, variante: CM.project.variant(project).name, budget: project.budget && project.budget.total, stanze: rooms, aperture: openings, arredi: furniture, costi };
  };
})(typeof window !== 'undefined' ? window : globalThis);
