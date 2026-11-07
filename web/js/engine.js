/* Udyam Digital - rules & pricing engine.
 * Deterministic: eligibility and prices come only from product_catalogue.csv (window.CATALOGUE).
 * The GenAI layer may phrase explanations, but it never decides products or prices.
 */
(function () {
  const CAT = {};
  (window.CATALOGUE || []).forEach(p => { CAT[p.id] = p; });

  const DEMO_TODAY = '2026-07-15'; // README: use 15 Jul 2026 as "today" for date checks

  const STATE_CODES = { '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat', '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh' };

  // ---------------- identifiers ----------------
  const CH = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function gstChecksum(s) {
    let t = 0;
    for (let i = 0; i < 14; i++) { const v = CH.indexOf(s[i]); if (v < 0) return null; const p = v * (i % 2 ? 2 : 1); t += Math.floor(p / 36) + (p % 36); }
    return CH[(36 - (t % 36)) % 36];
  }
  const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
  function validateGstin(raw) {
    const g = String(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    const out = { gstin: g, length: g.length === 15, format: GST_RE.test(g), checksum: false, stateCode: g.slice(0, 2), state: STATE_CODES[g.slice(0, 2)] || null, panEntity: g[5] };
    if (g.length === 15) out.checksum = gstChecksum(g) === g[14];
    out.valid = out.length && out.format && out.checksum && !!out.state;
    return out;
  }
  // Fix common OCR confusions using the GSTIN structure, then the checksum.
  const DIG = { O: '0', Q: '0', D: '0', I: '1', L: '1', T: '1', Z: '2', S: '5', B: '8', G: '6' };
  const LET = { '0': 'O', '1': 'I', '5': 'S', '8': 'B', '2': 'Z', '6': 'G' };
  const CONF = { I: 'J1L', J: 'I', L: 'I1', O: '0Q', '0': 'O', '1': 'I', '5': 'S', S: '5', '8': 'B', B: '8', Z: '2', '2': 'Z', G: '6', '6': 'G' };
  function normaliseGstinOcr(raw) {
    let s = String(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (s.length < 15) return { gstin: s, corrected: false, ok: false };
    s = s.slice(0, 15).split('');
    const before = s.join('');
    [0, 1, 7, 8, 9, 10].forEach(i => { if (DIG[s[i]]) s[i] = DIG[s[i]]; });
    [2, 3, 4, 5, 6, 11].forEach(i => { if (LET[s[i]]) s[i] = LET[s[i]]; });
    s[13] = 'Z';
    let g = s.join('');
    const notes = [];
    if (g !== before) notes.push(`structure fix ${before} -> ${g}`);
    if (gstChecksum(g) === g[14]) return { gstin: g, corrected: g !== before, ok: true, notes };
    // single-character swap that makes the checksum valid AND exists in the registry
    for (let i = 0; i < 15; i++) {
      for (const alt of (CONF[g[i]] || '')) {
        const c = g.slice(0, i) + alt + g.slice(i + 1);
        if (gstChecksum(c) === c[14] && window.GSTIN_REGISTRY && window.GSTIN_REGISTRY[c]) {
          notes.push(`checksum fix position ${i + 1}: ${g[i]} -> ${alt}`);
          return { gstin: c, corrected: true, ok: true, notes };
        }
      }
    }
    return { gstin: g, corrected: g !== before, ok: false, notes };
  }
  function validateUdyam(raw) {
    const u = String(raw || '').toUpperCase().replace(/\s+/g, '');
    const m = u.match(/^UDYAM-([A-Z]{2})-(\d{2})-(\d{7})$/);
    return { udyam: u, format: !!m, stateCode: m ? m[1] : null, district: m ? m[2] : null };
  }
  const maskGstin = g => g && g.length >= 15 ? g.slice(0, 2) + '•'.repeat(9) + g.slice(11) : (g || '');
  const maskUdyam = u => u ? u.replace(/(\d{3})(\d{4})$/, '•••$2') : '';
  const maskId = s => s ? s.replace(/(\d+)(\d{3})$/, (m, a, b) => '•'.repeat(a.length) + b) : '';
  const maskPhone = p => p ? String(p).replace(/\d(?=\d{4})/g, '•') : '';

  // ---------------- profile helpers ----------------
  const SEGMENTS = { micro: 'Micro retail & services', prof: 'Professional offices', multi: 'Small multi-site businesses', mfg: 'Small manufacturers' };
  const TYPE_WORDS = [
    ['mfg', /factor|manufactur|workshop|textile|auto ?parts|fabricat|plant\b|mill\b|woodcraft|foundry|machin|unit\b|कारखान|फैक्ट|फ़ैक्ट|उत्पादन/i],
    ['prof', /clinic|dental|dentist|doctor|physio|diagnos|lab\b|chartered|\bca\b|accountant|account|law|legal|advocate|lawyer|coaching|tuition|academy|insurance|real ?estate|realty|travel|consult|architect|agency|office|hospital|क्लिनिक|डॉक्टर|दवाखान|कोचिंग|ऑफिस|वकील|सीए/i],
    ['micro', /kirana|grocery|general store|shop|store|salon|parlou?r|pharma|chemist|medical store|bakery|bake|cafe|café|tea|restaurant|dhaba|sweet|boutique|tailor|mobile|electronics|stationer|hardware|dukaan|dukan|दुकान|किराना|सैलून|पार्लर|मेडिकल|बेकरी|होटल|रेस्टोरेंट/i],
  ];
  function guessSegment(text, sites) {
    for (const [seg, re] of TYPE_WORDS) if (re.test(text || '')) {
      if (seg !== 'mfg' && sites >= 3) return 'multi';
      return seg;
    }
    if (sites >= 3) return 'multi';
    return null;
  }
  function cityInfo(city) {
    const C = window.CITIES || {};
    const key = Object.keys(C).find(k => k.toLowerCase() === String(city || '').trim().toLowerCase());
    if (key) return { city: key, tier: C[key][0], state: C[key][1], known: true };
    return { city: city || '', tier: 2, state: null, known: false };
  }
  // mock fibre feasibility: deterministic per city, ~1 in 6 unknown towns has no fibre
  function fibreFeasible(profile) {
    const c = cityInfo(profile.city);
    if (c.known || !profile.city) return true;
    let h = 0; for (const ch of String(profile.city || '').toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) % 997;
    return h % 6 !== 0;
  }
  const gstActive = p => !!(p.gst && p.gst.found && p.gst.status === 'Active');

  // ---------------- eligibility (catalogue rules) ----------------
  function checkProduct(id, profile, bundleIds) {
    const p = CAT[id]; const reasons = [];
    if (!p) return { ok: false, reasons: ['unknown product'] };
    const tier = profile.tier || 2;
    if (!p.tiers.includes(tier)) reasons.push(`not sold in tier-${tier} cities`);
    if ((profile.employees || 1) < p.minEmployees) reasons.push(`needs ${p.minEmployees}+ staff`);
    if ((profile.sites || 1) < p.minSites) reasons.push(`needs ${p.minSites}+ sites`);
    if (p.requiresGstin && !gstActive(profile)) reasons.push(profile.gst && profile.gst.found ? `needs an active GSTIN (yours is ${profile.gst.status})` : 'needs an active GSTIN');
    if (p.requiresOneOf.length && !p.requiresOneOf.some(x => (bundleIds || []).includes(x))) reasons.push(`needs one of ${p.requiresOneOf.map(x => CAT[x] ? CAT[x].name : x).join(' / ')} in the bundle`);
    return { ok: reasons.length === 0, reasons };
  }

  // ---------------- bundles (see deck slide 3) ----------------
  // price = bundle price per unit (month); lines = catalogue items included; addons = toggleable extras
  const BUNDLES = {
    micro: {
      key: 'micro', name: 'Dukaan Digital', segment: 'micro', contract: 12, setupNote: '₹1,000 setup waived', setupWaived: true,
      build(profile) {
        const fibre = fibreFeasible(profile);
        return { price: fibre ? 1699 : 1599, unitLabel: '/month', variant: fibre ? 'Fibre' : '5G AirFiber',
          lines: [[fibre ? 'P01' : 'P04', 1], ['P07', 1], ['P22', 1]] };
      },
      addons: [
        { id: 'P19', price: 599, per: 'counter', qty: 1, max: 5, why: 'payments' },
        { id: 'P23', price: 199, per: 'camera', qty: 2, max: 8, why: 'cctv' },
        { id: 'P15', price: 999, why: 'customers' },
        { id: 'P18', price: 299, why: 'website' },
        { id: 'P14', price: 1500, why: 'customers_sms' },
        { id: 'P07', price: 299, per: 'line', qty: 1, max: 5, why: 'lines', label: 'Extra Business Postpaid 299 line' },
        { id: 'P20', price: 99, per: 'device', qty: 2, max: 10, why: 'security' },
      ],
    },
    prof: {
      key: 'prof', name: 'Pro Office', segment: 'prof', contract: 12, setupNote: 'no setup fee',
      build(profile) {
        const staff = Math.max(1, profile.employees || 5);
        const seats = staff <= 5 ? 5 : 10;
        const extra = Math.max(0, staff - 10);
        return { price: seats === 5 ? 3999 : 5499, unitLabel: '/month', variant: `${seats} users`, nameSuffix: ' ' + seats, seats, extraSeats: extra,
          lines: [['P02', 1], ['P08', seats === 5 ? 1 : 2], ['P16', seats], ['P20', seats], ['P17', 1]] };
      },
      addons: [
        { id: 'SEAT', price: 249, per: 'user', qty: 0, max: 90, label: 'Extra user (email + endpoint security)', products: ['P16', 'P20'], auto: 'extraSeats' },
        { id: 'P11', price: 200, why: 'remote' },
        { id: 'P12', price: 1000, per: 'channel', qty: 2, max: 10, why: 'calls' },
        { id: 'P13', price: 1500, why: 'calls_tollfree' },
        { id: 'P03', price: 2500, label: 'Upgrade to Biz Fibre 1G', upgradeOf: 'P02', why: 'speed' },
        { id: 'P09', price: 499, why: 'uptime' },
        { id: 'P21', price: 1999, why: 'security_fw' },
        { id: 'P23', price: 199, per: 'camera', qty: 2, max: 8, why: 'cctv' },
        { id: 'P15', price: 999, why: 'customers' },
        { id: 'P18', price: 299, why: 'website' },
      ],
    },
    multi: {
      key: 'multi', name: 'Chain Connect', segment: 'multi', contract: 24, perSite: true, setupNote: 'setup ₹8,600/site over 6 bills',
      build(profile) {
        const sites = Math.max(2, profile.sites || 3);
        return { price: 3499, unitLabel: '/site/month', units: sites, variant: `${sites} sites`,
          lines: [['P01', sites], ['P09', sites], ['P08', sites], ['P19', sites], ['P23', 2 * sites], ['P22', sites]] };
      },
      addons: [
        { id: 'P10', price: 2500, perSite: true, why: 'central' },
        { id: 'P02', price: 500, perSite: true, label: 'Upgrade every site to Biz Fibre 300', upgradeOf: 'P01', why: 'speed' },
        { id: 'P13', price: 1500, why: 'calls_tollfree' },
        { id: 'P15', price: 999, why: 'customers' },
        { id: 'P16', price: 125, per: 'user', qty: 10, max: 200, why: 'email' },
        { id: 'P25', price: 199, per: 'vehicle', qty: 3, max: 50, why: 'fleet' },
      ],
    },
    mfg: {
      key: 'mfg', name: 'Factory Assured', segment: 'mfg', contract: 24, setupNote: 'setup ₹44,000 over 12 bills',
      build() {
        return { price: 15999, unitLabel: '/month', variant: 'Leased line 20 Mbps',
          lines: [['P05', 1], ['P21', 1], ['P08', 5], ['P24', 10], ['P20', 10]] };
      },
      addons: [
        { id: 'P06', price: 17000, label: 'Upgrade to Internet Leased Line 100', upgradeOf: 'P05', why: 'speed' },
        { id: 'P24', price: 199, per: 'machine kit', qty: 5, max: 100, label: 'Extra machine monitoring kits', why: 'machines' },
        { id: 'P23', price: 199, per: 'camera', qty: 4, max: 32, why: 'cctv' },
        { id: 'P17', price: 499, why: 'backup' },
        { id: 'P25', price: 199, per: 'vehicle', qty: 3, max: 50, why: 'fleet' },
        { id: 'P16', price: 125, per: 'user', qty: 10, max: 200, why: 'email' },
      ],
    },
  };

  const PRIORITY_TO_ADDONS = {
    payments: ['P19'], customers: ['P15'], cctv: ['P23'], email: ['P16'], security: ['P20'], uptime: ['P09', 'P10'],
    calls: ['P12', 'P13'], machines: ['P24'], fleet: ['P25'], website: ['P18'], remote: ['P11'],
  };

  function chooseBundle(profile) {
    const seg = profile.segment || 'micro';
    const notes = [];
    if (seg === 'mfg') {
      const ok = ['P05', 'P21', 'P24'].map(id => checkProduct(id, profile, ['P05']));
      if (ok.every(c => c.ok)) return { key: 'mfg', notes };
      notes.push('Factory Assured needs 10+ staff and an active GSTIN (leased line, firewall, IoT), so I matched you to Pro Office instead.');
      return { key: 'prof', notes };
    }
    if (seg === 'multi' && (profile.sites || 1) < 2) { notes.push('With one site, Chain Connect is not needed.'); return { key: (profile.employees || 1) >= 5 ? 'prof' : 'micro', notes }; }
    return { key: seg, notes };
  }

  // Build a full recommendation + quote for a profile. selection = {addonId: qty} (qty 0 = off)
  function recommend(profile, selection) {
    const { key, notes } = chooseBundle(profile);
    const B = BUNDLES[key];
    const built = B.build(profile);
    const units = built.units || 1;
    const baseIds = built.lines.map(l => l[0]);
    const lineChecks = built.lines.map(([id, q]) => ({ id, qty: q, product: CAT[id], check: checkProduct(id, profile, baseIds) }));
    const priorities = profile.priorities || [];
    const wanted = new Set(priorities.flatMap(p => PRIORITY_TO_ADDONS[p] || []));
    const addons = B.addons.map(a => {
      const prodIds = a.products || [a.id];
      const ctxIds = baseIds.filter(x => x !== a.upgradeOf).concat(prodIds);
      const checks = prodIds.map(id => checkProduct(id, profile, ctxIds));
      const ok = checks.every(c => c.ok);
      const reasons = [...new Set(checks.flatMap(c => c.reasons))];
      let qty;
      if (selection && selection[a.id] !== undefined) qty = selection[a.id];
      else if (a.auto && built[a.auto]) qty = built[a.auto];
      else qty = wanted.has(a.id) ? (a.qty || 1) : 0;
      if (!ok) qty = 0;
      const unitsMul = a.perSite ? units : 1;
      const p = CAT[a.id];
      return Object.assign({}, a, { name: a.label || (p ? p.name : a.id), description: p ? p.description : '', ok, reasons, qty, unitsMul,
        monthly: qty * a.price * unitsMul, setup: (p && !a.upgradeOf ? p.setup : (p ? Math.max(0, p.setup - (CAT[a.upgradeOf] ? CAT[a.upgradeOf].setup : 0)) : 0)) * qty * unitsMul,
        suggested: wanted.has(a.id), installDays: p ? p.installDays : 1 });
    });
    const base = built.price * units;
    const addonMonthly = addons.reduce((s, a) => s + a.monthly, 0);
    const monthly = base + addonMonthly;
    // setup: bundle setup per the deck (waived / spread), add-ons at catalogue setup
    let bundleSetup = 0;
    if (key === 'multi') bundleSetup = 8600 * units;
    if (key === 'mfg') bundleSetup = 44000;
    const addonSetup = addons.reduce((s, a) => s + a.setup, 0);
    // price audit: bundle price must not be below catalogue minimums
    // compare per unit (per site for Chain Connect)
    const listMin = built.lines.reduce((s, [id, q]) => s + CAT[id].priceMin * q, 0) / units;
    const listMax = built.lines.reduce((s, [id, q]) => s + CAT[id].priceMax * q, 0) / units;
    const allIds = baseIds.concat(addons.filter(a => a.qty > 0).flatMap(a => a.products || [a.id]));
    const installDays = Math.max(...allIds.map(id => CAT[id] ? CAT[id].installDays : 1));
    const needsFullKyc = allIds.some(id => CAT[id] && CAT[id].requiresGstin);
    return {
      key, name: B.name + (built.nameSuffix || ''), segment: key, segmentName: SEGMENTS[key], variant: built.variant, contract: B.contract,
      unitPrice: built.price, unitLabel: built.unitLabel, units, base, lines: lineChecks, addons, monthly, gst: Math.round(monthly * 0.18),
      setup: bundleSetup + addonSetup, setupNote: B.setupNote, installDays, needsFullKyc, notes,
      audit: { listMin, listMax, unitPrice: built.price, withinRange: built.price >= listMin && built.price <= listMax, allLinesEligible: lineChecks.every(l => l.check.ok) },
    };
  }

  // plain-language reasons, built from facts (the LLM can rephrase these; fallback uses them as-is)
  function explainFacts(profile, rec) {
    const f = [];
    const staff = profile.employees || 1, sites = profile.sites || 1;
    if (rec.key === 'micro') {
      f.push(`${rec.variant === 'Fibre' ? 'Biz Fibre 100' : '5G AirFiber (fibre is not available at your location yet)'} gives you steady internet for UPI and billing instead of a phone hotspot`);
      f.push('a business mobile line keeps work calls separate from your personal number');
      f.push('a separate guest Wi-Fi for customers keeps your billing devices safe');
    }
    if (rec.key === 'prof') {
      f.push(`300 Mbps fibre is enough for ${staff} people on video calls and file uploads at the same time`);
      f.push(`business email on your own domain and antivirus for ${Math.max(staff, rec.lines.find(l => l.id === 'P16').qty)} users`);
      f.push('1 TB cloud backup so client or patient files are not lost if a PC fails');
    }
    if (rec.key === 'multi') {
      f.push(`one bill and one support number for all ${sites} sites instead of separate ISPs`);
      f.push('each site gets fibre plus automatic 4G/5G failover, so billing never stops');
      f.push('cloud POS and 2 CCTV cameras per site that you can watch from your phone');
    }
    if (rec.key === 'mfg') {
      f.push('a dedicated 20 Mbps leased line with 99.5% uptime SLA for ERP and machines');
      f.push('a managed firewall watched by the Accel security team');
      f.push('IoT kits on 10 machines to track uptime and energy use');
    }
    const on = rec.addons.filter(a => a.qty > 0 && a.suggested).map(a => a.name);
    if (on.length) f.push(`added because you asked for it: ${on.join(', ')}`);
    const locked = rec.addons.filter(a => !a.ok && a.suggested).map(a => `${a.name} (${a.reasons[0]})`);
    if (locked.length) f.push(`not available for you yet: ${locked.join('; ')}`);
    return f;
  }

  function addDays(iso, n) { const d = new Date(iso + 'T10:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); }
  const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');

  window.Engine = { CAT, DEMO_TODAY, STATE_CODES, SEGMENTS, BUNDLES, validateGstin, normaliseGstinOcr, gstChecksum, validateUdyam,
    maskGstin, maskUdyam, maskId, maskPhone, guessSegment, cityInfo, fibreFeasible, checkProduct, recommend, explainFacts, addDays, daysBetween, inr, gstActive };
})();
