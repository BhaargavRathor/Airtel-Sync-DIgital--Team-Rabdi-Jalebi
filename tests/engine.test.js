// Rules & pricing engine tests.  Run:  node tests/engine.test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const W = path.join(__dirname, '..', 'web');
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const f of ['data/catalogue.js', 'data/gstin_registry.js', 'data/cities.js', 'js/engine.js']) vm.runInContext(fs.readFileSync(path.join(W, f), 'utf8'), ctx);
const E = ctx.window.Engine, REG = ctx.window.GSTIN_REGISTRY;
let pass = 0, fail = 0;
const t = (name, cond, extra) => { if (cond) { pass++; console.log('  ok  ', name); } else { fail++; console.log('  FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const active = { found: true, status: 'Active' }, cancelled = { found: true, status: 'Cancelled' };
const P = o => Object.assign({ priorities: [], sites: 1, employees: 1, tier: 2 }, o);
const addon = (r, id) => r.addons.find(a => a.id === id);

console.log('Bundles');
let r = E.recommend(P({ segment: 'micro', employees: 3, city: 'Jaipur', tier: 2 }));
t('kirana, Jaipur, no GST -> Dukaan Digital Rs 1,699', r.name === 'Dukaan Digital' && r.monthly === 1699, r.monthly);
t('  WhatsApp API locked without GSTIN', !addon(r, 'P15').ok && /GSTIN/.test(addon(r, 'P15').reasons[0]));
t('  lite KYC (no GST product)', r.needsFullKyc === false);
r = E.recommend(P({ segment: 'micro', employees: 3, city: 'Jaipur', tier: 2, priorities: ['payments', 'cctv'] }));
t('  POS + 2 CCTV switched on from priorities -> Rs 2,696', r.monthly === 1699 + 599 + 2 * 199, r.monthly);
let town = ['Ballia', 'Hosur', 'Anand', 'Karnal', 'Bhilai', 'Sangli', 'Erode', 'Kota', 'Ujjain', 'Satara', 'Hapur', 'Bidar'].find(c => !E.fibreFeasible({ city: c }));
r = E.recommend(P({ segment: 'micro', employees: 2, city: town }));
t(`town without fibre (${town}) -> 5G AirFiber variant Rs 1,599`, r.variant === '5G AirFiber' && r.monthly === 1599 && r.lines[0].id === 'P04');
r = E.recommend(P({ segment: 'prof', employees: 12, city: 'Kochi', tier: 2, gst: active }));
t('dental clinic, 12 staff, Kochi -> Pro Office 10 + 2 extra users', r.name === 'Pro Office 10' && addon(r, 'SEAT').qty === 2 && r.monthly === 5499 + 498, r.monthly);
t('  Biz Fibre 1G locked in a tier-2 city', !addon(r, 'P03').ok && /tier-2/.test(addon(r, 'P03').reasons.join()));
r = E.recommend(P({ segment: 'prof', employees: 8, city: 'Mumbai', tier: 1, gst: active }));
t('CA firm, 8 staff, Mumbai -> 1G upgrade available', addon(r, 'P03').ok);
r = E.recommend(P({ segment: 'prof', employees: 4, gst: cancelled }));
t('4-person office -> Pro Office 5 Rs 3,999', r.name === 'Pro Office 5' && r.monthly === 3999, r.monthly);
t('  cancelled GSTIN locks cloud telephony', !addon(r, 'P12').ok && /Cancelled/.test(addon(r, 'P12').reasons.join()));
r = E.recommend(P({ segment: 'multi', employees: 60, sites: 6, tier: 1, gst: active }));
t('restaurant chain, 6 sites -> Chain Connect 6 x Rs 3,499', r.name === 'Chain Connect' && r.base === 6 * 3499 && r.units === 6);
t('  SD-WAN eligible (3+ sites, 10+ staff, GSTIN)', addon(r, 'P10').ok);
t('  setup Rs 8,600 per site', r.setup === 6 * 8600, r.setup);
r = E.recommend(P({ segment: 'multi', employees: 30, sites: 2, tier: 1, gst: active }));
t('  2 sites -> SD-WAN locked (needs 3+ sites)', !addon(r, 'P10').ok);
r = E.recommend(P({ segment: 'mfg', employees: 74, tier: 2, gst: active }));
t('auto-parts unit, 74 staff -> Factory Assured Rs 15,999', r.name === 'Factory Assured' && r.monthly === 15999);
t('  leased line 100 upgrade allowed (25+ staff)', addon(r, 'P06').ok);
r = E.recommend(P({ segment: 'mfg', employees: 8, tier: 2, gst: active }));
t('workshop with 8 staff -> falls back to Pro Office with a note', r.key === 'prof' && r.notes.length === 1);
r = E.recommend(P({ segment: 'mfg', employees: 40, tier: 2 }));
t('factory without GSTIN -> falls back (leased line needs GSTIN)', r.key === 'prof');

console.log('Catalogue rules hold for every bundle');
const cases = [P({ segment: 'micro', tier: 1 }), P({ segment: 'prof', employees: 12, gst: active }), P({ segment: 'prof', employees: 3 }), P({ segment: 'multi', employees: 50, sites: 5, gst: active }), P({ segment: 'mfg', employees: 60, gst: active })];
for (const c of cases) {
  const x = E.recommend(c);
  t(`${x.name}: price ${x.unitPrice} within catalogue range ${x.audit.listMin}-${x.audit.listMax}`, x.audit.withinRange);
  t(`${x.name}: every included product passes tier/size/GSTIN/dependency rules`, x.audit.allLinesEligible, x.lines.filter(l => !l.check.ok).map(l => l.id + ':' + l.check.reasons));
}

console.log('Identifiers');
const keys = Object.keys(REG);
t(`all ${keys.length} registry GSTINs pass format + checksum`, keys.every(g => E.validateGstin(g).valid));
t('tampered GSTIN from pack K06 fails checksum', !E.validateGstin('08YKZXS8189L1ZO').checksum);
t('OCR misread I->J in pack K10 auto-corrected via checksum', E.normaliseGstinOcr('27QHIXKO658U1ZL').gstin === '27QHJXK0658U1ZL');
t('OCR O->0 in digit positions corrected (K03)', E.normaliseGstinOcr('27XUIXGO767D1ZP').gstin === '27XUIXG0767D1ZP');
t('Udyam format check', E.validateUdyam('UDYAM-AP-00-9751562').format && !E.validateUdyam('UDYAM-AP-9751562').format);
t('GSTIN mask keeps first 2 and last 4', E.maskGstin('37LDYXK0296F1ZB') === '37•••••••••F1ZB');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
