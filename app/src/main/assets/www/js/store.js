/* Casa Mia — salvataggio: file nella memoria dell'app (Android) o localStorage (browser) */
(function (root) {
  'use strict';
  const CM = root.CM;
  const native = root.CasaMiaAndroid;
  const LS_PREFIX = 'casamia:';

  const backend = native ? {
    get: (k) => { const v = native.get(k); return v == null ? null : String(v); },
    put: (k, v) => native.put(k, v),
    remove: (k) => native.remove(k)
  } : {
    get: (k) => { try { return localStorage.getItem(LS_PREFIX + k); } catch (e) { return null; } },
    put: (k, v) => { try { localStorage.setItem(LS_PREFIX + k, v); return true; } catch (e) { return false; } },
    remove: (k) => { try { localStorage.removeItem(LS_PREFIX + k); return true; } catch (e) { return false; } }
  };

  function readJSON(key, fallback) {
    const raw = backend.get(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (e) { console.error('Dati illeggibili: ' + key); return fallback; }
  }

  const store = CM.store = {
    isNative: !!native,
    listProjects() { return readJSON('indice', []).sort((a, b) => b.updated - a.updated); },
    loadProject(id) { const p = readJSON('p_' + id, null); return p ? CM.project.normalize(p) : null; },
    saveProject(p) {
      const ok = backend.put('p_' + p.id, JSON.stringify(p));
      if (!ok) return false;
      const idx = readJSON('indice', []).filter(s => s.id !== p.id);
      idx.push(CM.project.summary(p));
      return backend.put('indice', JSON.stringify(idx));
    },
    deleteProject(id) {
      backend.remove('p_' + id);
      const idx = readJSON('indice', []).filter(s => s.id !== id);
      backend.put('indice', JSON.stringify(idx));
    },
    getJSON(key, fallback) { return readJSON(key, fallback); },
    putJSON(key, value) { return backend.put(key, JSON.stringify(value)); },
    pref(key, value) {
      const prefs = readJSON('preferenze', {});
      if (value === undefined) return prefs[key];
      prefs[key] = value;
      backend.put('preferenze', JSON.stringify(prefs));
      return value;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
