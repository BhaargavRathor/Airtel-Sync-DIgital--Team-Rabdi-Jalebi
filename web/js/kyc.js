/* Smart KYC: image quality checks, OCR (Tesseract.js, bundled locally), field extraction and validation.
 * Images never leave the browser; only extracted fields are kept, and identifiers are masked in the trace.
 */
(function () {
  const E = window.Engine, A = window.Api;
  let workerP = null;

  function getWorker(onProgress) {
    if (!workerP) {
      A.trace('kyc', 'Loading OCR engine (Tesseract.js, runs on this device)');
      workerP = Tesseract.createWorker('eng', 1, {
        workerPath: 'vendor/tesseract/worker.min.js', corePath: 'vendor/tesseract/core', langPath: 'vendor/tesseract/lang', gzip: true,
        logger: m => { if (onProgress && m.status === 'recognizing text') onProgress(m.progress); },
      });
    }
    return workerP;
  }

  function loadImage(src) {
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  }
  function toCanvas(img, maxW, angle) {
    const scale = Math.min(1, maxW / img.naturalWidth);
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const c = document.createElement('canvas');
    if (angle) {
      const r = angle * Math.PI / 180, cw = Math.ceil(Math.abs(w * Math.cos(r)) + Math.abs(h * Math.sin(r))), ch = Math.ceil(Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r)));
      c.width = cw; c.height = ch; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cw, ch);
      x.translate(cw / 2, ch / 2); x.rotate(-r); x.drawImage(img, -w / 2, -h / 2, w, h);
    } else { c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h); }
    return c;
  }
  function gray(c) {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, g = new Float32Array(c.width * c.height);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) g[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    return g;
  }
  // sharpness = variance of the Laplacian (low = blurry)
  function sharpness(img) {
    const c = toCanvas(img, 620), w = c.width, h = c.height, g = gray(c);
    let n = 0, s = 0, s2 = 0;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, l = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w];
      s += l; s2 += l * l; n++;
    }
    const m = s / n; return s2 / n - m * m;
  }
  // skew estimate: angle that maximises the variance of the horizontal projection of dark pixels
  function skewAngle(img) {
    let best = { v: -1, a: 0 };
    for (let a10 = -100; a10 <= 100; a10 += 5) {
      const a = a10 / 10, c = toCanvas(img, 400, a), w = c.width, h = c.height, g = gray(c), rows = new Float32Array(h);
      for (let y = 0; y < h; y++) { let k = 0; for (let x = 0; x < w; x++) if (g[y * w + x] < 128) k++; rows[y] = k; }
      let m = 0; for (const r of rows) m += r; m /= h; let v = 0; for (const r of rows) v += (r - m) * (r - m); v /= h;
      if (v > best.v) best = { v, a };
    }
    return best.a;
  }

  // ---------- field extraction from OCR text ----------
  const line = (t, label) => { const m = t.match(new RegExp(label + '[ \\t]*[:\\-]?[ \\t]*([^\\n]*)', 'i')); return m ? m[1].trim() : null; };
  const nextLine = (t, label) => { const ls = t.split('\n').map(s => s.trim()).filter(Boolean); const i = ls.findIndex(l => new RegExp('^' + label + '$', 'i').test(l)); return i >= 0 && ls[i + 1] ? ls[i + 1] : null; };
  const dateIn = s => { const m = String(s || '').match(/(20\d\d)[-\/.](\d\d)[-\/.](\d\d)/); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };
  const pin = s => { const m = String(s || '').replace(/(\d)\s+(\d)/g, '$1$2').match(/(\d{6})(?!.*\d{6})/); return m ? m[1] : null; };
  function detectType(t) {
    if (/GST Registration/i.test(t) || /\bGSTIN\b/.test(t)) return 'gst';
    if (/Udyam/i.test(t)) return 'udyam';
    if (/Signatory/i.test(t) || /Valid till/i.test(t)) return 'sig';
    if (/Bill date|Electricity|Consumer no/i.test(t)) return 'addr';
    return null;
  }
  function parse(type, t) {
    t = t.replace(/\r/g, '');
    if (type === 'gst') {
      const raw = (line(t, 'GSTIN') || '').replace(/\s+/g, '');
      const ad1 = line(t, 'Address of principal') || '', ad2 = line(t, 'place of business') || '';
      return { gstinRaw: raw.slice(0, 15), legalName: line(t, 'Legal name'), tradeName: line(t, 'Trade name'), constitution: line(t, 'Constitution'),
        address: (ad1 + ad2).replace(/\s+-\s*/, ' - '), pincode: pin(ad1 + ad2), liabilityDate: dateIn(line(t, 'Date of liability')) };
    }
    if (type === 'udyam') {
      const v = line(t, 'Udyam reg\\.? number') || '';
      return { udyam: /UDYAM/i.test(v) ? v.replace(/\s+/g, '').toUpperCase() : '', enterpriseName: line(t, 'Enterprise name'), activity: line(t, 'Major activity'), city: line(t, 'City'), state: line(t, 'State'), regDate: dateIn(line(t, 'Date of registration')) };
    }
    if (type === 'sig') {
      return { name: nextLine(t, 'Name'), designation: nextLine(t, 'Designation'), business: nextLine(t, 'For business'), idNo: nextLine(t, 'ID no\\.?'), validTill: dateIn(nextLine(t, 'Valid till')) };
    }
    if (type === 'addr') {
      const sa = t.match(/Supply address[ \t]*([\s\S]*?)\n\s*(Bill date|Units|Amount)/i);
      const addr = sa ? sa[1].split('\n').map(x => x.trim()).filter(Boolean).join('') : '';
      return { consumerNo: line(t, 'Consumer no\\.?'), billedTo: line(t, 'Billed to'), address: addr, pincode: pin(addr), billDate: dateIn(line(t, 'Bill date')), amount: line(t, 'Amount due \\(INR\\)') };
    }
    return {};
  }

  // ---------- read one document ----------
  async function readDocument(slot, src, onProgress) {
    const img = await loadImage(src);
    const sharp = sharpness(img);
    const out = { slot, sharpness: Math.round(sharp), skew: 0, text: '', fields: {}, quality: 'ok', notes: [] };
    if (sharp < 150) {
      out.quality = 'blurry';
      A.trace('kyc', `${slot}: image too blurry (sharpness ${Math.round(sharp)} < 150) - OCR skipped, ask for a retake`);
      return out;
    }
    const worker = await getWorker(onProgress);
    let { data } = await worker.recognize(toCanvas(img, 1400));
    out.text = data.text; out.confidence = Math.round(data.confidence);
    let type = detectType(out.text) || slot;
    const needsRetry = () => (type === 'gst' && !E.normaliseGstinOcr(parse('gst', out.text).gstinRaw).ok) || out.confidence < 55;
    if (needsRetry()) {
      const est = skewAngle(img);
      if (Math.abs(est) >= 1) {
        A.trace('kyc', `${slot}: page tilted ~${est}° - deskewing and re-reading`);
        for (const a of [est - 1, est - 0.5, est - 1.5, est, est + 0.5]) {
          const r = await worker.recognize(toCanvas(img, 1400, a));
          const t = r.data.text; const ty = detectType(t) || slot;
          const ok = ty !== 'gst' || E.normaliseGstinOcr(parse('gst', t).gstinRaw).ok;
          if (ok) { out.text = t; out.confidence = Math.round(r.data.confidence); out.skew = a; type = ty; out.notes.push(`auto-deskewed by ${a}°`); break; }
        }
      }
    }
    out.type = type;
    out.fields = parse(type, out.text);
    if (type === 'gst') {
      const n = E.normaliseGstinOcr(out.fields.gstinRaw);
      out.fields.gstin = n.gstin; out.fields.gstinOcrOk = n.ok; out.fields.gstinFixes = n.notes || [];
    }
    A.trace('kyc', `${slot}: OCR ${out.confidence}% confidence, ${Object.values(out.fields).filter(Boolean).length} fields extracted${out.skew ? ', deskewed' : ''}`);
    return out;
  }

  // ---------- validation ----------
  const N = A.norm;
  const nameEq = (a, b) => N(a) && N(a) === N(b);
  function proprietor(legal) { const m = String(legal || '').match(/^(.*?)\s*\(Prop\./i); return m ? m[1].trim() : null; }

  async function validate(docs, application) {
    const checks = []; const add = (group, status, title, detail, fix) => checks.push({ group, status, title, detail, fix });
    const today = E.DEMO_TODAY;
    const gd = docs.gst, ud = docs.udyam, sd = docs.sig, ad = docs.addr;
    let reg = null;

    // quality
    for (const [k, d] of Object.entries(docs)) {
      if (!d) continue;
      if (d.quality === 'blurry') add('Image quality', 'fail', `${LABEL[k]} is too blurry to read`, `Sharpness score ${d.sharpness} (needs 150+).`, `Retake the ${LABEL[k].toLowerCase()} photo in good light`);
      else if (d.skew) add('Image quality', 'pass', `${LABEL[k]} was tilted - straightened automatically`, `Deskewed by ${d.skew}° before reading.`);
    }

    // GST certificate
    if (!gd) { if (application.needsFullKyc) add('GST', 'fail', 'GST certificate not provided', 'Your bundle has GST-only products.', 'Upload the GST certificate'); else add('GST', 'pass', 'Lite KYC - GST documents not needed', 'None of the products you chose require a GSTIN.'); }
    else if (gd.quality === 'ok') {
      const f = gd.fields, v = E.validateGstin(f.gstin);
      if (!f.gstin || f.gstin.length < 15) add('GST', 'fail', 'Could not read the GSTIN', 'The GSTIN line was not legible.', 'Retake the GST certificate photo');
      else {
        if (f.gstinFixes && f.gstinFixes.length) add('GST', 'pass', 'GSTIN read with OCR correction', f.gstinFixes.join('; '));
        add('GST', v.format ? 'pass' : 'fail', 'GSTIN format (15 characters, state + PAN + entity + Z + check)', v.format ? `State code ${v.stateCode} = ${v.state}. PAN entity letter "${v.panEntity}" accepted for synthetic data.` : 'Structure does not match a GSTIN.');
        add('GST', v.checksum ? 'pass' : 'fail', 'GSTIN checksum', v.checksum ? 'Check character is valid.' : `The 15th (check) character does not fit the other 14 - expected "${E.gstChecksum(f.gstin)}". The number has been altered or mistyped.`, v.checksum ? null : 'Upload an original GST certificate');
        reg = await A.gstinLookup(f.gstin);
        if (!reg.found) {
          const near = A.registryByTradeName(f.tradeName, v.state);
          let hint = '';
          if (near.length) {
            const same = (x, y) => x === y || (/[O0]/.test(x) && /[O0]/.test(y)) || (/[I1]/.test(x) && /[I1]/.test(y)); // ignore OCR look-alikes
            const diff = [...near[0]].map((ch, i) => same(ch, f.gstin[i]) ? -1 : i).filter(i => i >= 0);
            hint = ` The registry has ${E.maskGstin(near[0])} for "${f.tradeName}" - the certificate differs in ${diff.length} character${diff.length > 1 ? 's' : ''}${diff.length <= 2 ? ' (position ' + diff.map(i => i + 1).join(', ') + ')' : ''}.`;
          }
          add('GST', 'fail', 'GSTIN found in GST registry', 'No registry record for this GSTIN.' + hint, 'Possible tampering - route to KYC review');
        } else {
          add('GST', reg.status === 'Active' ? 'pass' : 'fail', `GST status: ${reg.status}`, reg.status === 'Active' ? `Registered ${reg.registrationDate}.` : 'A cancelled or suspended GSTIN cannot be used for GST-only products.', reg.status === 'Active' ? null : 'Switch to lite KYC (no GST products) or update GST registration');
          add('GST', nameEq(f.legalName, reg.legalName) ? 'pass' : 'fail', 'Legal name matches registry', nameEq(f.legalName, reg.legalName) ? reg.legalName : `Certificate: "${f.legalName}" · Registry: "${reg.legalName}"`, nameEq(f.legalName, reg.legalName) ? null : 'Possible tampering - route to KYC review');
          add('GST', nameEq(f.tradeName, reg.tradeName) ? 'pass' : 'fail', 'Trade name matches registry', reg.tradeName);
          if (application.gstin && application.gstin !== f.gstin) add('GST', 'fail', 'GSTIN matches the one in your application', `Application ${E.maskGstin(application.gstin)} vs certificate ${E.maskGstin(f.gstin)}.`, 'Check you uploaded the right business');
        }
      }
    }
    const gstState = reg && reg.found ? reg.state : null, trade = reg && reg.found ? reg.tradeName : ((gd && gd.fields.tradeName) || application.businessName), legal = reg && reg.found ? reg.legalName : (gd && gd.fields.legalName);
    const constitution = reg && reg.found ? reg.constitution : (gd && gd.fields.constitution);

    // Udyam
    if (!ud && application.lite) { /* lite KYC: Udyam not requested */ }
    else if (!ud) add('Udyam', 'review', 'Udyam certificate not provided', 'Udyam is optional for connectivity products; useful for MSME offers.', 'Ask the customer to add it later');
    else if (ud.quality === 'ok') {
      const f = ud.fields;
      if (!f.udyam) add('Udyam', 'fail', 'Udyam registration number is missing', 'The number field on the certificate is blank.', 'Upload a complete Udyam certificate');
      else {
        const v = E.validateUdyam(f.udyam);
        add('Udyam', v.format ? 'pass' : 'fail', 'Udyam number format', v.format ? `UDYAM-${v.stateCode}-${v.district}-•••••••${v.district === '00' ? ' (district 00 = synthetic data)' : ''}` : f.udyam);
        const ur = await A.udyamLookup(f.udyam);
        if (!ur.found) add('Udyam', 'fail', 'Udyam number found in registry', 'No record.', 'Re-check the Udyam number');
        else {
          add('Udyam', nameEq(ur.enterpriseName, f.enterpriseName) ? 'pass' : 'fail', 'Enterprise name matches Udyam registry', ur.enterpriseName);
          if (trade) add('Udyam', nameEq(ur.enterpriseName, trade) || nameEq(ur.enterpriseName, legal) ? 'pass' : 'fail', 'Same business on GST and Udyam', `GST: ${trade} · Udyam: ${ur.enterpriseName}`);
          if (gstState) add('Udyam', ur.state === gstState ? 'pass' : 'fail', 'State matches GST registration', `${ur.state}`);
        }
      }
    }

    // Signatory ID
    if (!sd) add('Signatory', 'fail', 'Signatory ID not provided', '', 'Fetch ID from DigiLocker or upload a photo');
    else if (sd.quality === 'ok') {
      const f = sd.fields;
      add('Signatory', f.validTill && f.validTill >= today ? 'pass' : 'fail', 'ID is valid', f.validTill ? `Valid till ${f.validTill}. ID no. ${E.maskId(f.idNo)}.` : 'Expiry date not readable.', f.validTill && f.validTill >= today ? null : 'Upload a valid ID');
      if (trade) add('Signatory', nameEq(f.business, trade) || nameEq(f.business, legal) ? 'pass' : 'fail', 'ID is for the same business', f.business || '-');
      const prop = proprietor(legal);
      if (/Proprietor/i.test(constitution || '') && prop) {
        const ok = nameEq(f.name, prop);
        add('Signatory', ok ? 'pass' : 'fail', 'Signatory is the proprietor on the GST record', ok ? `${f.name}${f.designation && !/owner|proprietor/i.test(f.designation) ? ` (ID says "${f.designation}", name matches the proprietor)` : ''}` : `ID: ${f.name} · GST proprietor: ${prop}`, ok ? null : 'Proprietor must sign, or upload an authorisation letter');
      } else if (/Liability Partnership/i.test(constitution || '')) {
        const ok = /partner/i.test(f.designation || '');
        add('Signatory', ok ? 'pass' : 'review', 'LLP signatory is a designated partner', ok ? `${f.name}, ${f.designation}` : `${f.name} is listed as "${f.designation}" - an LLP is signed by a designated partner.`, ok ? null : 'Ask for the LLP authorisation letter');
      } else if (/Private Limited|Company/i.test(constitution || '')) {
        const ok = /director/i.test(f.designation || '');
        add('Signatory', ok ? 'pass' : 'review', 'Company signatory is a director', ok ? `${f.name}, ${f.designation}` : `${f.name} is listed as "${f.designation}" - a company is signed by a director.`, ok ? null : 'Ask for a board resolution or authorisation letter');
      }
    }

    // Address proof
    if (!ad) add('Address', 'fail', 'Address proof not provided', '', 'Upload a recent electricity, water or phone bill');
    else if (ad.quality === 'ok') {
      const f = ad.fields;
      const age = f.billDate ? E.daysBetween(f.billDate, today) : null;
      add('Address', age !== null && age <= 90 ? 'pass' : 'fail', 'Address proof is from the last 90 days', f.billDate ? `Bill date ${f.billDate} - ${age} days before ${today}.` : 'Bill date not readable.', age !== null && age <= 90 ? null : 'Upload a bill dated after ' + E.addDays(today, -90));
      if (trade) add('Address', nameEq(f.billedTo, trade) || nameEq(f.billedTo, legal) ? 'pass' : 'fail', 'Bill is in the business name', f.billedTo || '-');
      if (reg && reg.found) { const p = pin(reg.address); add('Address', p && p === f.pincode ? 'pass' : 'fail', 'Address matches GST principal place of business', `PIN ${f.pincode || '?'} vs GST ${p || '?'}`); }
    }

    const fails = checks.filter(c => c.status === 'fail'), reviews = checks.filter(c => c.status === 'review');
    const decision = fails.length ? 'action' : reviews.length ? 'review' : 'verified';
    A.trace('kyc', `Decision: ${decision.toUpperCase()} - ${checks.length} checks, ${fails.length} failed, ${reviews.length} for review`);
    return { checks, decision, fails, reviews, registry: reg };
  }

  const LABEL = { gst: 'GST certificate', udyam: 'Udyam certificate', sig: 'Signatory ID', addr: 'Address proof' };
  const SPECIMENS = Array.from({ length: 12 }, (_, i) => 'K' + String(i + 1).padStart(2, '0'));
  const specimenSrc = (k, slot) => {
    if (k === 'K05' && slot === 'udyam') return null; // pack K05 has no Udyam certificate
    return `specimens/${k}_${{ gst: 'gst_certificate', udyam: 'udyam_certificate', sig: 'signatory_id', addr: 'address_proof' }[slot]}.png`;
  };

  window.Kyc = { readDocument, validate, LABEL, SPECIMENS, specimenSrc, parse, getWorker };
})();
