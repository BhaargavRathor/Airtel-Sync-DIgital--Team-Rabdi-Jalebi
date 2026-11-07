/* Mock API layer.
 * If the page is served by server.py, calls go to its REST endpoints (/api/...).
 * Otherwise the same lookups run in the browser against the bundled registry files.
 * Every call is written to the "under the hood" trace with identifiers masked.
 */
(function () {
  const E = window.Engine;
  let serverMode = null; // null = unknown, true/false after probe
  let llm = { enabled: false, provider: null };
  const listeners = [];
  const trace = (kind, text, extra) => { const item = { t: new Date(), kind, text, extra }; listeners.forEach(f => f(item)); };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function probe() {
    if (serverMode !== null) return serverMode;
    try {
      const r = await fetch('/api/health', { cache: 'no-store' });
      const j = await r.json();
      serverMode = !!j.ok; llm = j.llm || llm;
    } catch (e) { serverMode = false; }
    trace('sys', serverMode ? `API server connected${llm.enabled ? ' · GenAI: ' + llm.provider : ' · GenAI: off (rules fallback)'}` : 'No API server - using in-browser mock API');
    return serverMode;
  }

  function localGstin(g) {
    const v = E.validateGstin(g);
    const rec = (window.GSTIN_REGISTRY || {})[v.gstin];
    if (!rec) return { gstin: v.gstin, validation: v, found: false };
    const [legal, trade, constitution, address, state, regDate, status] = rec;
    return { gstin: v.gstin, validation: v, found: true, legalName: legal, tradeName: trade, constitution, address, state, registrationDate: regDate, status };
  }
  function localUdyam(u) {
    const v = E.validateUdyam(u);
    const rec = (window.UDYAM_REGISTRY || {})[v.udyam];
    if (!rec) return { udyam: v.udyam, validation: v, found: false };
    const [name, type, activity, nic, state, city, regDate] = rec;
    return { udyam: v.udyam, validation: v, found: true, enterpriseName: name, enterpriseType: type, majorActivity: activity, nic, state, city, registrationDate: regDate };
  }

  async function gstinLookup(g) {
    const t0 = performance.now();
    let res;
    if (await probe()) {
      const r = await fetch('/api/gstin/' + encodeURIComponent(g)); res = await r.json();
    } else { await sleep(350); res = localGstin(g); }
    trace('api', `GET /api/gstin/${E.maskGstin(res.gstin)} → ${res.found ? res.status : (res.validation && !res.validation.checksum ? 'invalid checksum' : 'not found')} (${Math.round(performance.now() - t0)} ms)`);
    return res;
  }
  async function udyamLookup(u) {
    const t0 = performance.now();
    let res;
    if (await probe()) { const r = await fetch('/api/udyam/' + encodeURIComponent(u)); res = await r.json(); }
    else { await sleep(300); res = localUdyam(u); }
    trace('api', `GET /api/udyam/${E.maskUdyam(res.udyam)} → ${res.found ? res.enterpriseType + ' · ' + res.majorActivity : 'not found'} (${Math.round(performance.now() - t0)} ms)`);
    return res;
  }
  // find registry entries with the same trade name (to spot a tampered / mistyped GSTIN)
  function registryByTradeName(name, state) {
    const R = window.GSTIN_REGISTRY || {}; const n = norm(name); const out = [];
    for (const g in R) if (norm(R[g][1]) === n && (!state || R[g][4] === state)) out.push(g);
    return out;
  }
  const norm = s => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');

  // ---- GenAI (only through server.py, which holds the API key and redacts PII) ----
  async function llmExtract(text, lang, context) {
    if (!(await probe()) || !llm.enabled) return null;
    try {
      const t0 = performance.now();
      const r = await fetch('/api/llm/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, lang, context }) });
      const j = await r.json();
      trace('ai', `LLM extract (${llm.provider}) → ${JSON.stringify(j.slots || {})} (${Math.round(performance.now() - t0)} ms)`);
      return j.slots || null;
    } catch (e) { trace('ai', 'LLM extract failed - using rules parser'); return null; }
  }
  async function llmExplain(facts, lang, bundleName, price) {
    if (!(await probe()) || !llm.enabled) return null;
    try {
      const t0 = performance.now();
      const r = await fetch('/api/llm/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ facts, lang, bundle: bundleName, price }) });
      const j = await r.json();
      trace('ai', `LLM explain (${llm.provider}, grounded on ${facts.length} catalogue facts) (${Math.round(performance.now() - t0)} ms)`);
      return j.text || null;
    } catch (e) { return null; }
  }

  window.Api = { probe, gstinLookup, udyamLookup, registryByTradeName, llmExtract, llmExplain, trace, onTrace: f => listeners.push(f), get llm() { return llm; }, get serverMode() { return serverMode; }, norm };
})();
