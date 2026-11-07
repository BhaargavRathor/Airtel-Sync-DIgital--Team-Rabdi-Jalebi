/* Udyam Digital - customer app (advisor -> quote -> details -> consent -> Smart KYC -> schedule & pay -> tracker) */
(function () {
  const E = window.Engine, A = window.Api, K = window.Kyc;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const inr = E.inr;

  // ---------------- i18n ----------------
  const LANGS = [['en', 'English'], ['hi', 'हिंदी'], ['mr', 'मराठी'], ['ta', 'தமிழ்'], ['te', 'తెలుగు'], ['kn', 'ಕನ್ನಡ'], ['bn', 'বাংলা'], ['gu', 'ગુજરાતી'], ['ml', 'മലയാളം'], ['pa', 'ਪੰਜਾਬੀ']];
  const LANG_NAME = { en: 'English', hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', te: 'Telugu', kn: 'Kannada', bn: 'Bengali', gu: 'Gujarati', ml: 'Malayalam', pa: 'Punjabi' };
  const T = {
    en: {
      welcomeTitle: 'Get your business online in one sitting', welcomeSub: 'Internet, business lines, WhatsApp, billing and security - one bundle, one bill, set up in days.',
      chooseLang: 'Choose your language', start: 'Start with the advisor', track: 'Track my order', talk: 'Prefer a call? Request a callback',
      b1: 'The right bundle in 6 quick questions', b2: 'One clear monthly price - no product codes', b3: 'KYC in minutes, no paperwork run-around', b4: 'Live order tracker - no need to call us',
      advisor: 'Advisor', quote: 'Your quote', details: 'Your details', consent: 'Your consent', kyc: 'Smart KYC', pay: 'Schedule & pay', tracker: 'Order tracker',
      typeHere: 'Type or tap the mic...', seePrice: 'See price & customise', cont: 'Continue', thinking: 'Finding the right bundle...',
      q_type: 'Namaste! I am your Accel Business advisor. What kind of business do you run?\n(You can also tell me everything at once, e.g. "dental clinic in Kochi with 12 staff")',
      q_employees: 'How many people work with you, including you?', q_sites: 'How many shops, branches or sites do you have?', q_city: 'Which city is your business in?',
      q_internet: 'What do you use for internet today, and roughly how much do you spend on phone + internet a month?', q_priorities: 'Which of these matter to you? Pick all that apply, then tap Done.',
      q_gstin: 'Last one: do you have a GSTIN? It fills in your details automatically and unlocks GST-only products like the WhatsApp Business API.',
      enterGstin: 'Type your 15-character GSTIN', noGstin: 'No GSTIN', haveGstin: 'I have a GSTIN', done: 'Done',
      recoIntro: 'Here is what I recommend for you:', why: 'Why this fits you',
      gstFound: 'Found it: {name} in {state} - GST status {status}.', gstCancelled: 'Your GST registration is {status}. I can still set you up with products that do not need GST (lite KYC); GST-only extras stay locked until it is active again.',
      gstBad: 'That GSTIN does not look right ({why}). Please check and type it again, or tap "No GSTIN".', gstNotFound: 'I could not find that GSTIN in the GST registry. Please re-check it, or continue without GST.',
      noted: 'Got it.',
    },
    hi: {
      welcomeTitle: 'एक ही बार में अपना बिज़नेस डिजिटल बनाइए', welcomeSub: 'इंटरनेट, बिज़नेस लाइन, WhatsApp, बिलिंग और सुरक्षा - एक बंडल, एक बिल, कुछ ही दिनों में चालू।',
      chooseLang: 'अपनी भाषा चुनें', start: 'सलाहकार से शुरू करें', track: 'मेरा ऑर्डर ट्रैक करें', talk: 'कॉल चाहिए? कॉलबैक माँगें',
      b1: '6 आसान सवालों में सही बंडल', b2: 'एक साफ़ मासिक कीमत - कोई प्रोडक्ट कोड नहीं', b3: 'मिनटों में KYC, कागज़ी भागदौड़ नहीं', b4: 'लाइव ऑर्डर ट्रैकर - कॉल करने की ज़रूरत नहीं',
      advisor: 'सलाहकार', quote: 'आपका कोटेशन', details: 'आपकी जानकारी', consent: 'आपकी सहमति', kyc: 'स्मार्ट KYC', pay: 'समय चुनें और भुगतान', tracker: 'ऑर्डर ट्रैकर',
      typeHere: 'लिखें या माइक दबाएँ...', seePrice: 'कीमत देखें और बदलें', cont: 'आगे बढ़ें', thinking: 'आपके लिए सही बंडल ढूँढ रहा हूँ...',
      q_type: 'नमस्ते! मैं आपका Accel Business सलाहकार हूँ। आपका व्यवसाय क्या है?\n(आप सब एक साथ भी बता सकते हैं, जैसे "जयपुर में किराना दुकान, 3 लोग काम करते हैं")',
      q_employees: 'आपके साथ कितने लोग काम करते हैं (आपको मिलाकर)?', q_sites: 'आपकी कितनी दुकानें, ब्रांच या जगहें हैं?', q_city: 'आपका व्यवसाय किस शहर में है?',
      q_internet: 'अभी इंटरनेट कैसे चलाते हैं, और फ़ोन + इंटरनेट पर महीने का खर्च लगभग कितना है?', q_priorities: 'इनमें से आपके लिए क्या ज़रूरी है? सभी चुनें, फिर "हो गया" दबाएँ।',
      q_gstin: 'आखिरी सवाल: क्या आपके पास GSTIN है? इससे आपकी जानकारी अपने-आप भर जाएगी और WhatsApp Business API जैसे GST वाले प्रोडक्ट भी मिलेंगे।',
      enterGstin: 'अपना 15 अक्षरों का GSTIN लिखें', noGstin: 'GSTIN नहीं है', haveGstin: 'मेरे पास GSTIN है', done: 'हो गया',
      recoIntro: 'आपके लिए मेरी सलाह:', why: 'यह आपके लिए क्यों सही है',
      gstFound: 'मिल गया: {name}, {state} - GST स्थिति {status}।', gstCancelled: 'आपका GST रजिस्ट्रेशन {status} है। फिर भी मैं बिना GST वाले प्रोडक्ट (लाइट KYC) से आपका काम शुरू कर सकता हूँ; GST वाले प्रोडक्ट तब तक बंद रहेंगे।',
      gstBad: 'यह GSTIN सही नहीं लग रहा ({why})। कृपया दोबारा लिखें, या "GSTIN नहीं है" दबाएँ।', gstNotFound: 'यह GSTIN रजिस्ट्री में नहीं मिला। कृपया दोबारा जाँचें, या बिना GST आगे बढ़ें।',
      noted: 'ठीक है।',
    },
  };
  const t = (k, vars) => { let s = (T[S.lang] || T.en)[k] || T.en[k] || k; if (vars) for (const v in vars) s = s.replace('{' + v + '}', vars[v]); return s; };

  const CHIPS = {
    type: [['kirana / general store', 'Kirana / shop', 'किराना / दुकान'], ['salon', 'Salon', 'सैलून'], ['pharmacy', 'Pharmacy', 'मेडिकल स्टोर'], ['restaurant', 'Restaurant / cafe', 'रेस्टोरेंट / कैफ़े'],
      ['clinic', 'Clinic', 'क्लिनिक'], ['CA / law office', 'CA / law office', 'CA / वकील ऑफिस'], ['coaching centre', 'Coaching centre', 'कोचिंग सेंटर'], ['manufacturing unit', 'Factory / workshop', 'फैक्ट्री / वर्कशॉप'], ['retail chain', 'Chain of stores', 'दुकानों की चेन']],
    employees: [['2', '1-2'], ['6', '3-9'], ['15', '10-24'], ['50', '25-99'], ['120', '100+']],
    sites: [['1', '1'], ['2', '2'], ['4', '3-5'], ['8', '6-10'], ['12', '10+']],
    city: Object.keys(window.CITIES || {}).slice(0, 0).concat(['Mumbai', 'Delhi', 'Bengaluru', 'Pune', 'Jaipur', 'Visakhapatnam', 'Kochi', 'Nagpur']).map(c => [c, c]),
    internet: [['Mobile hotspot', 'Mobile hotspot', 'मोबाइल हॉटस्पॉट'], ['Home broadband', 'Home broadband', 'घर का ब्रॉडबैंड'], ['Business broadband', 'Business broadband', 'बिज़नेस ब्रॉडबैंड'], ['Leased line', 'Leased line', 'लीज़्ड लाइन'], ['Mixed per site', 'Different ISP per site', 'हर ब्रांच में अलग']],
    priorities: [['payments', 'UPI/card payments & billing', 'UPI/कार्ड पेमेंट और बिलिंग'], ['customers', 'Reach customers on WhatsApp/SMS', 'WhatsApp/SMS पर ग्राहक'], ['cctv', 'CCTV cameras', 'CCTV कैमरे'], ['email', 'Business email & files', 'बिज़नेस ईमेल और फ़ाइलें'],
      ['security', 'Cyber security', 'साइबर सुरक्षा'], ['uptime', 'Internet that never goes down', 'इंटरनेट कभी बंद न हो'], ['calls', 'Phone lines / IVR / toll-free', 'फ़ोन लाइन / IVR / टोल-फ्री'], ['machines', 'Machine monitoring', 'मशीन मॉनिटरिंग'], ['fleet', 'Vehicle tracking', 'गाड़ी ट्रैकिंग'], ['website', 'Website', 'वेबसाइट']],
  };
  const chipLabel = c => (S.lang === 'hi' && c[2]) ? c[2] : c[1];
  const ORDER = ['type', 'employees', 'sites', 'city', 'internet', 'priorities', 'gstin'];

  // ---------------- state ----------------
  const fresh = () => ({ lang: 'en', screen: 'welcome', profile: { priorities: [] }, chat: [], asking: null, selection: {}, rec: null, contact: {}, consent: {}, kyc: { docs: {}, srcs: {}, result: null, pack: '' }, order: null, speak: false, prioritiesDone: false, gstDone: false });
  let S = fresh();
  try { const o = JSON.parse(localStorage.getItem('ud_order') || 'null'); if (o) S.order = o; } catch (e) { }

  // ---------------- trace panel ----------------
  A.onTrace(item => {
    const log = $('#log'); if (!log) return;
    const d = document.createElement('div');
    d.innerHTML = `<span class="k ${item.kind}">${item.kind.toUpperCase()}</span>${esc(item.text)}`;
    log.appendChild(d); log.scrollTop = log.scrollHeight;
  });

  // ---------------- free-text parser (rules fallback for the GenAI extractor) ----------------
  const NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20, 'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पाँच': 5, 'पांच': 5, 'छह': 6, 'सात': 7, 'आठ': 8, 'दस': 10, 'बारह': 12, 'बीस': 20 };
  const num = s => { s = String(s).trim().toLowerCase(); return /^\d+$/.test(s) ? parseInt(s, 10) : (NUMW[s] || null); };
  function rulesExtract(text) {
    const x = {}; const s = ' ' + String(text) + ' ';
    const g = s.toUpperCase().match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]\b/); if (g) x.gstin = g[0];
    const NUM = '(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|एक|दो|तीन|चार|पाँच|पांच|छह|सात|आठ|दस|बारह|बीस)';
    let m = s.match(new RegExp(NUM + '\\s*(\\+\\s*)?(staff|employees|people|workers|members|persons|log|लोग|कर्मचारी|आदमी)', 'i')); if (m) x.employees = num(m[1]);
    m = s.match(new RegExp(NUM + '\\s*(branches|branch|outlets|outlet|stores|shops|sites|locations|clinics|centres|centers|ब्रांच|दुकानें|दुकान|जगह|आउटलेट)', 'i')); if (m) x.sites = num(m[1]);
    if (/\b(single|one) (shop|store|location|site|office)\b|एक ही/i.test(s)) x.sites = x.sites || 1;
    const C = window.CITIES || {}; const extra = ['Kanpur', 'Agra', 'Varanasi', 'Bhubaneswar', 'Guwahati', 'Chandigarh', 'Dehradun', 'Raipur', 'Ranchi', 'Madurai', 'Mangaluru', 'Thiruvananthapuram', 'Gurugram', 'Noida', 'Ghaziabad', 'Rajkot', 'Amritsar', 'Jodhpur'];
    const HI_CITY = { 'जयपुर': 'Jaipur', 'दिल्ली': 'Delhi', 'मुंबई': 'Mumbai', 'पुणे': 'Pune', 'लखनऊ': 'Lucknow', 'पटना': 'Patna', 'इंदौर': 'Indore', 'भोपाल': 'Bhopal', 'नागपुर': 'Nagpur', 'कोलकाता': 'Kolkata', 'सूरत': 'Surat', 'अहमदाबाद': 'Ahmedabad', 'बेंगलुरु': 'Bengaluru', 'हैदराबाद': 'Hyderabad', 'चेन्नई': 'Chennai', 'लुधियाना': 'Ludhiana', 'कानपुर': 'Kanpur', 'वाराणसी': 'Varanasi' };
    for (const c of Object.keys(C).concat(extra)) if (new RegExp('\\b' + c + '\\b', 'i').test(s)) { x.city = c; break; }
    if (!x.city) for (const h in HI_CITY) if (s.includes(h)) { x.city = HI_CITY[h]; break; }
    if (/bangalore/i.test(s)) x.city = 'Bengaluru'; if (/bombay/i.test(s)) x.city = 'Mumbai'; if (/vizag/i.test(s)) x.city = 'Visakhapatnam';
    if (/hotspot|phone (data|internet)|mobile data|हॉटस्पॉट|मोबाइल डेटा/i.test(s)) x.current_internet = 'Mobile hotspot';
    else if (/home (broadband|wifi|wi-fi)|घर का/i.test(s)) x.current_internet = 'Home broadband';
    else if (/business broadband|fibre|fiber|broadband|wifi|ब्रॉडबैंड/i.test(s)) x.current_internet = 'Business broadband';
    else if (/leased line|लीज़्ड/i.test(s)) x.current_internet = 'Leased line';
    m = s.match(/(?:₹|rs\.?|inr|rupees?)\s*([\d,]+)|([\d,]{3,})\s*(?:rs|rupees|₹|रुपये|रुपए)/i); if (m) x.monthly_spend = parseInt((m[1] || m[2]).replace(/,/g, ''), 10);
    const pr = []; const P = { payments: /upi|payment|billing|pos|card|बिलिंग|पेमेंट/i, customers: /whatsapp|sms|customers? (reach|message)|ग्राहक|व्हाट्सऐप/i, cctv: /cctv|camera|कैमरा/i, email: /e-?mail|ईमेल/i, security: /security|virus|hack|सुरक्षा/i, uptime: /never (goes )?down|backup internet|failover|uptime|बंद न/i, calls: /ivr|toll|phone line|telephony/i, machines: /machine/i, fleet: /vehicle|fleet|truck|गाड़ी/i, website: /website|वेबसाइट/i };
    for (const k in P) if (P[k].test(s)) pr.push(k);
    if (pr.length) x.priorities = pr;
    const seg = E.guessSegment(s, x.sites || 1); if (seg) { x.segment = seg; x.business_type = (s.match(/(dental clinic|physio\w* clinic|clinic|insurance\w*( advisory)?( office)?|travel agency|real estate agency|ca firm|law firm|diagnostic lab|kirana\w*|salon|pharmacy|restaurant|cafe|coaching\w*|ca firm|law office|factory|workshop|textile unit|auto parts unit|bakery|store|shop|office|किराना दुकान|किराना|सैलून|क्लिनिक|दुकान)/i) || [''])[0].trim() || null; }
    return x;
  }

  function mergeSlots(x, source) {
    if (!x) return [];
    const P = S.profile, got = [];
    if (x.business_type && !P.businessType) { P.businessType = x.business_type; got.push('type'); }
    if (x.segment && !P.segment) P.segment = x.segment;
    if (x.employees && !P.employees) { P.employees = +x.employees; got.push('employees'); }
    if (x.sites && !P.sites) { P.sites = +x.sites; got.push('sites'); }
    if (x.city && !P.city) { const c = E.cityInfo(x.city); Object.assign(P, { city: c.city, tier: c.tier, state: c.state || P.state }); got.push('city'); }
    if (x.current_internet && !P.currentInternet) { P.currentInternet = x.current_internet; got.push('internet'); }
    if (x.monthly_spend && !P.spend) P.spend = +x.monthly_spend;
    if (x.priorities && x.priorities.length) { P.priorities = [...new Set((P.priorities || []).concat(x.priorities))]; }
    if (x.gstin && !P.gstinInput) P.gstinInput = x.gstin;
    if (got.length) A.trace('ai', `${source} understood: ${got.map(k => k + '=' + ({ type: P.businessType, employees: P.employees, sites: P.sites, city: P.city + ' (tier ' + P.tier + ')', internet: P.currentInternet }[k])).join(', ')}${P.segment ? ' → segment ' + E.SEGMENTS[P.segment] : ''}`);
    return got;
  }

  // ---------------- rendering ----------------
  const SCREENS = ['welcome', 'advisor', 'quote', 'details', 'consent', 'kyc', 'pay', 'tracker'];
  function render() {
    const scr = S.screen; const body = $('#body'), footer = $('#footer');
    const idx = SCREENS.indexOf(scr);
    $('#appTitle').textContent = scr === 'welcome' ? 'Accel Business' : t(scr);
    $('#steps').innerHTML = scr === 'welcome' || scr === 'tracker' ? '' : SCREENS.slice(1, 7).map((s, i) => `<span class="${i < idx ? 'on' : ''}"></span>`).join('');
    $('#back').style.visibility = scr === 'welcome' ? 'hidden' : 'visible';
    $('#langSel').value = S.lang;
    footer.innerHTML = ''; footer.style.display = 'block';
    ({ welcome: rWelcome, advisor: rAdvisor, quote: rQuote, details: rDetails, consent: rConsent, kyc: rKyc, pay: rPay, tracker: rTracker })[scr](body, footer);
  }
  function go(scr) { S.screen = scr; render(); $('#body').scrollTop = 0; }

  // ---- welcome
  function rWelcome(body, footer) {
    body.innerHTML = `<div class="hero"><h2>${t('welcomeTitle')}</h2><p>${t('welcomeSub')}</p></div>
      <div class="small muted" style="font-weight:700">${t('chooseLang')}</div>
      <div class="langgrid">${LANGS.map(([k, n]) => `<button data-l="${k}" class="${S.lang === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="benefits">${['b1', 'b2', 'b3', 'b4'].map((b, i) => `<div class="benefit"><div class="ic">${i + 1}</div>${t(b)}</div>`).join('')}</div>
      <div class="note">We only ask what each step needs. Nothing is shared or stored until you give consent before KYC.</div>`;
    body.querySelectorAll('[data-l]').forEach(b => b.onclick = () => setLang(b.dataset.l));
    footer.innerHTML = `<button class="btn" id="go">${t('start')}</button>
      <div class="row" style="margin-top:8px">${S.order ? `<button class="btn ghost sm" style="flex:1" id="trk">${t('track')}</button>` : ''}<button class="btn ghost sm" style="flex:1" id="cb">${t('talk')}</button></div>`;
    $('#go').onclick = () => { go('advisor'); if (!S.chat.length) startAdvisor(); };
    if ($('#trk')) $('#trk').onclick = () => go('tracker');
    $('#cb').onclick = () => { handoff('Callback requested from welcome screen'); toast('Accel Business', 'Thanks! An advisor will call you within 2 working hours.'); };
  }
  function setLang(l) {
    S.lang = l;
    if (!T[l]) { A.trace('sys', `${LANG_NAME[l]} selected - prototype UI falls back to English; with GenAI on, advisor explanations are generated in ${LANG_NAME[l]}`); }
    else A.trace('sys', `Language: ${LANG_NAME[l]}`);
    render();
  }

  // ---- advisor
  function rAdvisor(body, footer) {
    body.innerHTML = `<div class="chat" id="chat"></div>`;
    S.chat.forEach(m => drawMsg(m));
    footer.innerHTML = `<div id="chipbar"></div><div class="composer"><input id="inp" placeholder="${esc(t('typeHere'))}" autocomplete="off"><button class="iconbtn mic" id="mic" title="Speak">🎤</button><button class="iconbtn" id="send" title="Send">➤</button></div>`;
    $('#send').onclick = () => submitText(); $('#inp').onkeydown = e => { if (e.key === 'Enter') submitText(); };
    $('#mic').onclick = voice;
    drawChips();
  }
  function drawMsg(m) {
    const chat = $('#chat'); if (!chat) return;
    const d = document.createElement('div');
    if (m.kind === 'reco') { d.innerHTML = recoCard(); d.querySelector('#seePrice').onclick = () => go('quote'); }
    else { d.className = 'msg ' + m.who; d.textContent = m.text; }
    chat.appendChild(d); const b = $('#body'); b.scrollTop = b.scrollHeight;
  }
  function say(text, who = 'bot') {
    const m = { who, text }; S.chat.push(m); drawMsg(m);
    if (who === 'bot' && S.speak && window.speechSynthesis) { const u = new SpeechSynthesisUtterance(text.replace(/\(.*\)/s, '')); u.lang = S.lang === 'hi' ? 'hi-IN' : 'en-IN'; speechSynthesis.cancel(); speechSynthesis.speak(u); }
  }
  async function botTyping(ms = 550) {
    const chat = $('#chat'); if (!chat) return; const d = document.createElement('div'); d.className = 'msg bot'; d.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>'; chat.appendChild(d); $('#body').scrollTop = 1e6;
    await sleep(ms); d.remove();
  }
  function drawChips() {
    const bar = $('#chipbar'); if (!bar) return; const k = S.asking; bar.innerHTML = '';
    if (!k || S.screen !== 'advisor') return;
    let chips = [];
    if (k === 'gstin') chips = [['__have', t('haveGstin')], ['__no', t('noGstin')]];
    else chips = (CHIPS[k] || []);
    const div = document.createElement('div'); div.className = 'chips';
    chips.forEach(c => {
      const b = document.createElement('button'); b.className = 'chip'; b.textContent = chipLabel(c);
      if (k === 'priorities' && S.profile.priorities.includes(c[0])) b.classList.add('on');
      b.onclick = () => chipPick(k, c, b); div.appendChild(b);
    });
    if (k === 'priorities') { const b = document.createElement('button'); b.className = 'chip'; b.style.cssText = 'background:var(--red);color:#fff;border-color:var(--red)'; b.textContent = t('done') + ' ✓'; b.onclick = () => { S.prioritiesDone = true; say(S.profile.priorities.map(p => chipLabel(CHIPS.priorities.find(c => c[0] === p))).join(', ') || '-', 'me'); next(); }; div.appendChild(b); }
    bar.appendChild(div);
  }
  function chipPick(k, c, btn) {
    const P = S.profile;
    if (k === 'priorities') { const i = P.priorities.indexOf(c[0]); if (i >= 0) P.priorities.splice(i, 1); else P.priorities.push(c[0]); btn.classList.toggle('on'); return; }
    if (k === 'gstin') { if (c[0] === '__no') { say(t('noGstin'), 'me'); P.gst = { found: false, none: true }; S.gstDone = true; A.trace('rule', 'No GSTIN → lite KYC; GST-only products will be locked'); next(); } else { $('#inp').placeholder = t('enterGstin'); $('#inp').focus(); } return; }
    say(chipLabel(c), 'me');
    if (k === 'type') { P.businessType = c[0]; P.segment = c[0] === 'retail chain' ? 'multi' : E.guessSegment(c[0], P.sites || 1); A.trace('ai', `type=${c[0]} → segment ${E.SEGMENTS[P.segment]}`); }
    if (k === 'employees') P.employees = +c[0];
    if (k === 'sites') { P.sites = +c[0]; if (P.sites >= 3 && P.segment !== 'mfg') { P.segment = 'multi'; A.trace('rule', `${P.sites} sites → segment ${E.SEGMENTS.multi}`); } }
    if (k === 'city') { const ci = E.cityInfo(c[0]); Object.assign(P, { city: ci.city, tier: ci.tier, state: ci.state }); A.trace('rule', `${ci.city} → tier ${ci.tier}`); }
    if (k === 'internet') P.currentInternet = c[0];
    next();
  }
  async function submitText() {
    const inp = $('#inp'); const text = inp.value.trim(); if (!text) return; inp.value = ''; inp.placeholder = t('typeHere');
    say(text, 'me');
    const P = S.profile;
    // GSTIN typed?
    const gm = text.toUpperCase().replace(/\s+/g, '').match(/[0-9A-Z]{15}/);
    if (S.asking === 'gstin' && gm) { await checkGstin(gm[0]); return; }
    let slots = await A.llmExtract(text, LANG_NAME[S.lang], { known: P });
    const src = slots ? 'GenAI' : 'Rules parser';
    if (!slots) slots = rulesExtract(text);
    const got = mergeSlots(slots, src);
    if (src === 'GenAI') { const gx = rulesExtract(text).gstin; if (gx && !P.gstinInput) P.gstinInput = gx; } // GSTINs are redacted before the LLM call
    // answer to the current question that the parser could not map
    if (!got.includes(S.asking)) {
      const k = S.asking, n = parseInt(text, 10);
      if (k === 'type' && !P.businessType) { P.businessType = text; P.segment = P.segment || E.guessSegment(text, P.sites || 1) || 'micro'; A.trace('ai', `type="${text}" → segment ${E.SEGMENTS[P.segment]}`); }
      else if (k === 'employees' && n) P.employees = n;
      else if (k === 'sites' && n) P.sites = n;
      else if (k === 'city' && !P.city) { const ci = E.cityInfo(text); Object.assign(P, { city: ci.city || text, tier: ci.tier, state: ci.state }); A.trace('rule', `${text} → tier ${ci.tier}${ci.known ? '' : ' (not in coverage list, assumed tier 2)'}`); }
      else if (k === 'internet' && !P.currentInternet) P.currentInternet = text;
      else if (k === 'priorities') S.prioritiesDone = true;
    }
    if (P.sites >= 3 && P.segment && P.segment !== 'mfg' && P.segment !== 'multi') { P.segment = 'multi'; A.trace('rule', `${P.sites} sites → segment ${E.SEGMENTS.multi}`); }
    if (P.gstinInput && !S.gstDone) { await checkGstin(P.gstinInput); return; }
    next();
  }
  async function checkGstin(raw) {
    const P = S.profile; const v = E.validateGstin(raw);
    A.trace('rule', `GSTIN check: format ${v.format ? '✓' : '✗'}, checksum ${v.checksum ? '✓' : '✗'}, state code ${v.stateCode} ${v.state || '?'}`);
    await botTyping(300);
    if (!v.valid) { P.gstinInput = null; say(t('gstBad', { why: !v.length ? 'needs 15 characters' : !v.format ? 'wrong format' : !v.checksum ? 'check character does not match' : 'unknown state code' })); return; }
    const r = await A.gstinLookup(v.gstin);
    if (!r.found) { P.gstinInput = null; say(t('gstNotFound')); return; }
    P.gst = r; P.gstin = v.gstin; S.gstDone = true; P.businessName = r.tradeName;
    if (!P.city) { const city = (r.address.match(/,\s*([A-Za-z ]+),\s*[A-Za-z ]+-\s*\d{6}/) || [])[1]; if (city) { const ci = E.cityInfo(city); Object.assign(P, { city: ci.city, tier: ci.tier }); } }
    P.state = r.state;
    say(t('gstFound', { name: r.tradeName, state: r.state, status: r.status }));
    if (r.status !== 'Active') { A.trace('rule', `GST status ${r.status} → GST-only products (P03, P05, P06, P10, P12-P15, P21, P24) locked`); await botTyping(300); say(t('gstCancelled', { status: r.status })); }
    next();
  }
  function nextMissing() {
    const P = S.profile;
    if (!P.businessType) return 'type';
    if (!P.employees) return 'employees';
    if (!P.sites) return 'sites';
    if (!P.city) return 'city';
    if (!P.currentInternet) return 'internet';
    if (!S.prioritiesDone) return 'priorities';
    if (!S.gstDone) return 'gstin';
    return null;
  }
  async function startAdvisor() { A.trace('sys', 'Advisor session started'); await A.probe(); await botTyping(400); S.asking = 'type'; say(t('q_type')); drawChips(); }
  async function next() {
    const k = nextMissing(); S.asking = k; drawChips();
    if (k) { await botTyping(); if (k === 'priorities' && S.profile.priorities.length) say(t('noted') + ' ' + t('q_priorities')); else say(t('q_' + k)); drawChips(); return; }
    // all slots filled -> recommend
    S.asking = null; drawChips();
    say(t('thinking')); await botTyping(700);
    buildReco(true);
    const facts = factsFor(S.profile, S.rec);
    let expl = await A.llmExplain(facts.en, LANG_NAME[S.lang], S.rec.name, inr(S.rec.monthly) + '/month');
    S.rec.explanation = expl;
    S.chat.push({ kind: 'reco' }); drawMsg({ kind: 'reco' });
    if (S.speak) say(t('recoIntro') + ' ' + S.rec.name);
  }
  function buildReco(log) {
    S.rec = E.recommend(S.profile, Object.keys(S.selection).length ? S.selection : null);
    if (!Object.keys(S.selection).length) S.rec.addons.forEach(a => S.selection[a.id] = a.qty);
    if (log) {
      const r = S.rec;
      A.trace('rule', `Segment ${r.segmentName} → bundle "${r.name}" (${r.variant})`);
      r.notes.forEach(n => A.trace('rule', n));
      r.lines.forEach(l => A.trace('rule', `${l.id} ${l.product.name} ×${l.qty}: ${l.check.ok ? 'eligible ✓' : 'BLOCKED - ' + l.check.reasons.join('; ')}`));
      r.addons.filter(a => !a.ok).forEach(a => A.trace('rule', `${a.id} ${a.name}: locked - ${a.reasons.join('; ')}`));
      A.trace('rule', `Price audit: ${inr(r.unitPrice)} vs catalogue range ${inr(r.audit.listMin)}-${inr(r.audit.listMax)} → ${r.audit.withinRange ? 'within range ✓' : 'OUT OF RANGE'}`);
    }
  }
  function factsFor(P, r) {
    const en = E.explainFacts(P, r);
    const hi = [];
    if (r.key === 'micro') hi.push(r.variant === 'Fibre' ? 'Biz Fibre 100 से UPI और बिलिंग के लिए हॉटस्पॉट की जगह भरोसेमंद इंटरनेट' : '5G AirFiber (आपके इलाके में अभी फ़ाइबर नहीं है) से भरोसेमंद इंटरनेट', 'बिज़नेस मोबाइल लाइन से काम की कॉल आपके निजी नंबर से अलग रहेंगी', 'ग्राहकों के लिए अलग गेस्ट Wi-Fi, ताकि आपके बिलिंग डिवाइस सुरक्षित रहें');
    if (r.key === 'prof') hi.push(`${P.employees || 1} लोगों के लिए 300 Mbps फ़ाइबर - वीडियो कॉल और फ़ाइल अपलोड एक साथ`, 'अपने डोमेन पर बिज़नेस ईमेल और हर कंप्यूटर के लिए एंटीवायरस', '1 TB क्लाउड बैकअप, ताकि क्लाइंट की फ़ाइलें कभी न खोएँ');
    if (r.key === 'multi') hi.push(`सभी ${P.sites} ब्रांच के लिए एक बिल और एक सपोर्ट नंबर`, 'हर ब्रांच में फ़ाइबर के साथ ऑटोमैटिक 4G/5G बैकअप, बिलिंग कभी नहीं रुकेगी', 'हर ब्रांच में क्लाउड POS और 2 CCTV कैमरे, फ़ोन पर देखें');
    if (r.key === 'mfg') hi.push('ERP और मशीनों के लिए 99.5% SLA वाली 20 Mbps लीज़्ड लाइन', 'Accel सुरक्षा टीम द्वारा मैनेज्ड फ़ायरवॉल', '10 मशीनों पर IoT किट - अपटाइम और बिजली की खपत पर नज़र');
    const locked = r.addons.filter(a => !a.ok && a.suggested);
    if (locked.length) hi.push('अभी उपलब्ध नहीं: ' + locked.map(a => a.name).join(', '));
    return { en, hi };
  }
  function recoCard() {
    const r = S.rec, P = S.profile; const f = factsFor(P, r);
    const list = (S.lang === 'hi' ? f.hi : f.en);
    return `<div class="card hl reco" style="margin-top:4px">
      <div class="seg">${esc(r.segmentName)} · ${esc(r.variant)}</div>
      <div class="name">${esc(r.name)}</div>
      <div class="price">${inr(r.monthly)}<small> /month · ${r.contract} months</small></div>
      ${r.units > 1 ? `<div class="small muted">${inr(r.unitPrice)} per site × ${r.units} sites${r.monthly > r.base ? ' + add-ons' : ''}</div>` : ''}
      <h3 style="margin:10px 0 4px">${t('why')}</h3>
      ${r.explanation ? `<p class="small" style="line-height:1.45;margin:0 0 4px">${esc(r.explanation)}</p><div class="small muted">✨ Explained by GenAI from catalogue facts only</div>` : `<ul class="why">${list.map(x => `<li>${esc(x[0].toUpperCase() + x.slice(1))}</li>`).join('')}</ul>`}
      <button class="btn" id="seePrice" style="margin-top:12px">${t('seePrice')}</button></div>`;
  }

  async function voice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('Voice', 'Voice input needs Chrome or Edge.'); return; }
    const r = new SR(); r.lang = S.lang === 'hi' ? 'hi-IN' : 'en-IN'; r.interimResults = true;
    const mic = $('#mic'); mic.classList.add('live'); A.trace('sys', `Listening (${r.lang})...`);
    r.onresult = e => { $('#inp').value = Array.from(e.results).map(x => x[0].transcript).join(''); };
    r.onend = () => { mic.classList.remove('live'); if ($('#inp').value.trim()) submitText(); };
    r.onerror = () => mic.classList.remove('live');
    r.start();
  }

  // ---- quote
  function rQuote(body, footer) {
    buildReco(false);
    const r = S.rec;
    const lines = r.lines.map(l => `<li><span><span class="tick">✓</span>${esc(l.product.name)}${l.qty > 1 ? ' × ' + l.qty : ''}</span><span class="muted small">incl.</span></li>`).join('');
    const addons = r.addons.map(a => {
      const per = a.per ? ` / ${a.per}` : a.perSite ? ' / site' : '';
      const qtyCtl = a.per && a.ok && a.qty > 0 ? `<div class="stepper" data-q="${a.id}"><button data-d="-1">−</button><span>${a.qty}</span><button data-d="1">+</button></div>` : '';
      return `<div class="addon ${a.ok ? '' : 'locked'}"><div class="info"><div class="nm">${esc(a.name)}${a.suggested && a.ok ? '<span class="tag">for you</span>' : ''}</div>
        <div class="ds">${esc(a.description || '')}</div>${a.ok ? '' : `<div class="lock">🔒 ${esc(a.reasons.join('; '))}</div>`}${qtyCtl}</div>
        <div class="pr">+${inr(a.price)}${per}</div><button class="switch ${a.qty > 0 ? 'on' : ''}" data-s="${a.id}" ${a.ok ? '' : 'disabled'} aria-label="toggle ${esc(a.name)}"></button></div>`;
    }).join('');
    body.innerHTML = `<div class="card reco"><div class="seg">${esc(r.segmentName)}</div><div class="name">${esc(r.name)}</div>
        <div class="small muted">${r.units > 1 ? `${inr(r.unitPrice)} per site × ${r.units} sites` : inr(r.unitPrice) + ' base'} · ${r.contract}-month contract · ${esc(r.setupNote)}</div>
        <ul class="incl">${lines}</ul></div>
      <h3>Add-ons you can switch on</h3><div class="card" style="padding:4px 14px">${addons}</div>
      <div class="card"><div class="totals">
        <div class="r"><span>Bundle</span><span>${inr(r.base)}</span></div>
        <div class="r"><span>Add-ons</span><span>${inr(r.monthly - r.base)}</span></div>
        <div class="r big"><span>Monthly</span><span style="color:var(--red)">${inr(r.monthly)}</span></div>
        <div class="r muted small"><span>+ 18% GST</span><span>${inr(r.gst)}</span></div>
        <div class="r small"><span>One-time setup</span><span>${r.setup ? inr(r.setup) : '₹0'}</span></div>
        <div class="r small"><span>Ready in about</span><span>${r.installDays} days</span></div></div>
        <div class="audit">✓ Every item checked against catalogue rules for ${esc(S.profile.city || '')} (tier ${S.profile.tier || 2}), ${S.profile.employees} staff, ${S.profile.sites} site${S.profile.sites > 1 ? 's' : ''}, GSTIN ${E.gstActive(S.profile) ? 'active' : 'not active'}. Bundle price is inside the catalogue range (${inr(r.audit.listMin)}-${inr(r.audit.listMax)}).</div></div>`;
    body.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const id = b.dataset.s, a = r.addons.find(x => x.id === id); S.selection[id] = a.qty > 0 ? 0 : B_DEFQ(a); A.trace('rule', `${a.name} ${S.selection[id] ? 'ON' : 'OFF'} → monthly ${inr(E.recommend(S.profile, S.selection).monthly)}`); render(); });
    body.querySelectorAll('[data-q] button').forEach(b => b.onclick = () => { const id = b.parentNode.dataset.q, a = r.addons.find(x => x.id === id); S.selection[id] = Math.max(1, Math.min(a.max || 99, a.qty + (+b.dataset.d))); render(); });
    footer.innerHTML = `<button class="btn" id="buy">Buy now · ${inr(r.monthly)}/month</button>
      <div class="row" style="margin-top:8px"><button class="btn ghost sm" style="flex:1" id="wa">Share on WhatsApp</button><button class="btn ghost sm" style="flex:1" id="expert">Talk to an expert</button></div>`;
    $('#buy').onclick = () => { A.trace('sys', `Quote accepted: ${r.name}, ${inr(r.monthly)}/month, ${r.needsFullKyc ? 'full KYC (GST products in bundle)' : 'lite KYC (no GST products)'}`); go('details'); };
    $('#wa').onclick = () => { const txt = `Accel Business quote: ${r.name} - ${inr(r.monthly)}/month (+GST), ${r.contract} months. Includes: ${r.lines.map(l => l.product.name).join(', ')}${r.addons.filter(a => a.qty).map(a => ', ' + a.name).join('')}.`; window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank'); };
    $('#expert').onclick = () => { handoff('Asked for an expert at quote stage'); toast('Accel Business', 'An expert will call you in 2 working hours. Your quote is saved - no need to repeat anything.'); };
  }
  const B_DEFQ = a => { const B = E.BUNDLES[S.rec.key].addons.find(x => x.id === a.id); return (B && B.qty) || 1; };

  // ---- details
  function rDetails(body, footer) {
    const P = S.profile, c = S.contact;
    const addr = P.gst && P.gst.found ? P.gst.address : '';
    body.innerHTML = `<p class="muted small" style="margin-top:0">Only what we need to set up your order.</p>
      <div class="field"><label>Your name</label><input id="nm" value="${esc(c.name || (P.gst && P.gst.found ? (P.gst.legalName.match(/^(.*?)\s*\(Prop/) || [, ''])[1] : ''))}"></div>
      <div class="field"><label>Business name</label><input id="bn" value="${esc(c.business || P.businessName || '')}"></div>
      <div class="field"><label>Mobile number</label><div class="row"><input id="mob" inputmode="numeric" maxlength="10" value="${esc(c.mobile || '')}" placeholder="10-digit mobile"><button class="btn sm dark" id="otp">Send OTP</button></div></div>
      <div class="field" id="otpf" style="display:${c.otpSent ? 'block' : 'none'}"><label>OTP</label><input id="otpv" inputmode="numeric" maxlength="6" value="${esc(c.otp || '')}" placeholder="6-digit code"></div>
      <div class="field"><label>Installation address</label><input id="ad" value="${esc(c.address || addr)}">${addr ? '<div class="small muted" style="margin-top:4px">Pre-filled from your GST registration</div>' : ''}</div>`;
    $('#otp').onclick = () => { const m = $('#mob').value; if (!/^[6-9]\d{9}$/.test(m)) { toast('Mobile', 'Enter a valid 10-digit mobile number'); return; } c.otpSent = true; $('#otpf').style.display = 'block'; A.trace('api', `POST /api/otp → sent to ${E.maskPhone(m)}`); toast('SMS · Accel', 'Your Accel Business OTP is 482913 (demo)'); };
    footer.innerHTML = `<button class="btn" id="cont">${t('cont')}</button>`;
    $('#cont').onclick = () => {
      Object.assign(c, { name: $('#nm').value.trim(), business: $('#bn').value.trim(), mobile: $('#mob').value.trim(), otp: ($('#otpv') || {}).value, address: $('#ad').value.trim() });
      if (!c.name || !c.business || !c.address) { toast('Details', 'Please fill name, business name and address'); return; }
      if (!c.otpSent || c.otp !== '482913') { toast('OTP', 'Tap "Send OTP" and enter the code (demo: 482913)'); return; }
      P.businessName = P.businessName || c.business; A.trace('sys', `Mobile verified ${E.maskPhone(c.mobile)}`); go('consent');
    };
  }

  // ---- consent (DPDP)
  function rConsent(body, footer) {
    const r = S.rec, C = S.consent;
    const docs = r.needsFullKyc ? 'GST certificate, Udyam certificate, signatory ID and address proof' : 'signatory ID and address proof only (lite KYC - no GST documents needed)';
    body.innerHTML = `<h2 style="font-size:18px">Before we verify your business</h2>
      <p class="small muted" style="margin-top:0">Under the Digital Personal Data Protection Act, 2023 we need your consent for each purpose. You can withdraw it any time from the order tracker.</p>
      <div class="note"><b>What we will use:</b> ${docs}${S.profile.gstin ? ', plus a lookup of your GSTIN ' + E.maskGstin(S.profile.gstin) : ''}.<br><b>How long:</b> photos are read on your phone and deleted after verification; verified details are kept only as long as telecom KYC rules require.</div>
      <label class="consent"><input type="checkbox" id="c1" ${C.c1 ? 'checked' : ''}><span><b>Verify my business and identity (required)</b>Look up my GSTIN / Udyam and read my documents to complete KYC for this order.</span></label>
      <label class="consent"><input type="checkbox" id="c2" ${C.c2 ? 'checked' : ''}><span><b>Share my address with the installation team (required)</b>Only name, phone and address, only for this installation.</span></label>
      <label class="consent"><input type="checkbox" id="c3" ${C.c3 ? 'checked' : ''}><span><b>Send me offers (optional)</b>New products and discounts on WhatsApp. Not needed for your order.</span></label>
      <p class="small muted">Grievance officer: privacy@accelbusiness.example · <a href="#" id="pv">Read the full privacy notice</a></p>`;
    ['c1', 'c2', 'c3'].forEach(k => $('#' + k).onchange = e => { C[k] = e.target.checked; render(); });
    $('#pv').onclick = e => { e.preventDefault(); toast('Privacy notice', 'Data used only for this order · masked in our systems · you can view, correct or erase it.'); };
    footer.innerHTML = `<button class="btn" id="cont" ${C.c1 && C.c2 ? '' : 'disabled'}>I agree - continue to KYC</button>`;
    $('#cont').onclick = () => { C.at = new Date().toISOString(); A.trace('sys', `Consent recorded: verify=yes, install=yes, marketing=${C.c3 ? 'yes' : 'no'} (ledger v1.2, ${C.at.slice(0, 19)})`); go('kyc'); };
  }

  // ---- Smart KYC
  const SLOTS_FULL = ['gst', 'udyam', 'sig', 'addr'], SLOTS_LITE = ['sig', 'addr'];
  function rKyc(body, footer) {
    const r = S.rec, P = S.profile, k = S.kyc;
    const full = r.needsFullKyc || E.gstActive(P);
    const slots = full ? SLOTS_FULL : SLOTS_LITE;
    const lookup = full && P.gst && P.gst.found ? `<div class="lookup ok"><b>GSTIN ${E.maskGstin(P.gstin)}</b> · ${esc(P.gst.tradeName)}<br>${esc(P.gst.constitution)} · ${esc(P.gst.state)} · status <b>${esc(P.gst.status)}</b> · checked live with the GST registry</div>` : `<div class="lookup warn"><b>Lite KYC</b> - ${P.gst && P.gst.found ? 'GSTIN is ' + esc(P.gst.status) + ', so' : 'no GSTIN, so'} only signatory ID and address proof are needed for your bundle.</div>`;
    const slotHtml = slots.map(s => {
      const d = k.docs[s], src = k.srcs[s];
      const st = d ? (d.quality === 'blurry' ? '<span style="color:var(--red)">Too blurry - retake</span>' : `Read ✓ ${d.confidence || ''}%${d.skew ? ' · straightened' : ''}`) : src ? 'Ready to verify' : 'Not uploaded';
      return `<div class="docslot ${src ? 'has' : ''}">${src ? `<img src="${src}" alt="">` : '<div class="ph">＋</div>'}<div class="meta"><b>${K.LABEL[s]}</b><div class="st">${st}</div></div>
        ${s === 'sig' ? `<button class="up" data-dl="1">DigiLocker</button>` : ''}<label class="up">Upload<input type="file" accept="image/*" data-f="${s}"></label></div>`;
    }).join('');
    const res = k.result;
    const resHtml = res ? `<div class="verdict ${res.decision}"><b>${{ verified: '✓ Verified - you are all set', review: '⏳ Sent for a quick check (about 2 hours)', action: '✗ A few things need fixing' }[res.decision]}</b>
        <span class="small">${res.checks.filter(c => c.status === 'pass').length} of ${res.checks.length} checks passed${res.decision === 'action' ? ' - fix the items in red and verify again' : ''}</span></div>
        ${res.checks.map(c => `<div class="check"><div class="ic ${c.status}">${{ pass: '✓', fail: '✗', review: '!' }[c.status]}</div><div><div class="t">${esc(c.title)}</div>${c.detail ? `<div class="d">${esc(c.detail)}</div>` : ''}${c.fix && c.status !== 'pass' ? `<div class="fx">→ ${esc(c.fix)}</div>` : ''}</div></div>`).join('')}` : '';
    body.innerHTML = `${lookup}
      <div class="row" style="justify-content:space-between;margin:10px 0 6px"><b>Documents</b><select id="pack" style="border:1px solid var(--line);border-radius:8px;padding:4px 6px;font-size:12px"><option value="">Demo: load specimen pack</option>${K.SPECIMENS.map(x => `<option ${k.pack === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      ${slotHtml}
      <div id="prog" style="display:none"><div class="small muted" id="progT">Reading documents...</div><div class="progress"><i id="progB"></i></div></div>
      <div id="res" style="margin-top:10px">${resHtml}</div>`;
    $('#pack').onchange = e => { k.pack = e.target.value; k.docs = {}; k.result = null; slots.forEach(s => { k.srcs[s] = k.pack ? K.specimenSrc(k.pack, s) : null; }); A.trace('kyc', `Specimen pack ${k.pack} loaded (${slots.filter(s => k.srcs[s]).length} documents)`); render(); };
    body.querySelectorAll('[data-f]').forEach(inp => inp.onchange = e => { const f = e.target.files[0]; if (!f) return; const s = inp.dataset.f; k.srcs[s] = URL.createObjectURL(f); delete k.docs[s]; k.result = null; A.trace('kyc', `${K.LABEL[s]} uploaded (${Math.round(f.size / 1024)} KB, stays on this device)`); render(); });
    const dl = body.querySelector('[data-dl]'); if (dl) dl.onclick = async () => { A.trace('api', 'DigiLocker: consent screen → issued document "Authorised signatory ID" fetched'); await sleep(500); k.srcs.sig = K.specimenSrc(k.pack || 'K09', 'sig'); delete k.docs.sig; k.result = null; toast('DigiLocker', 'Signatory ID fetched from DigiLocker'); render(); };
    const ready = slots.filter(s => s !== 'udyam').every(s => k.srcs[s]);
    if (res && res.decision !== 'action') {
      footer.innerHTML = `<button class="btn" id="esign">e-Sign order form with Aadhaar OTP</button>`;
      $('#esign').onclick = esign;
    } else {
      footer.innerHTML = `<button class="btn" id="ver" ${ready ? '' : 'disabled'}>${res ? 'Verify again' : 'Verify documents'}</button>`;
      $('#ver').onclick = () => verify(slots);
    }
  }
  async function verify(slots) {
    const k = S.kyc; $('#ver').disabled = true; $('#prog').style.display = 'block';
    const todo = slots.filter(s => k.srcs[s]);
    for (let i = 0; i < todo.length; i++) {
      const s = todo[i];
      if (k.docs[s] && k.docs[s].quality === 'ok') continue;
      $('#progT').textContent = `Reading ${K.LABEL[s].toLowerCase()} (${i + 1}/${todo.length})...`;
      k.docs[s] = await K.readDocument(s, k.srcs[s], p => { $('#progB').style.width = ((i + p) / todo.length * 100) + '%'; });
    }
    $('#progB').style.width = '100%'; $('#progT').textContent = 'Checking with GST and Udyam registries...';
    const docs = {}; slots.forEach(s => docs[s] = k.docs[s] || null);
    const lite = !(S.rec.needsFullKyc || E.gstActive(S.profile));
    k.result = await K.validate(docs, { needsFullKyc: S.rec.needsFullKyc, gstin: lite ? null : S.profile.gstin, businessName: S.contact.business || S.profile.businessName, lite });
    A.trace('kyc', 'Document images discarded after extraction; only verified fields kept');
    if (k.result.decision === 'action') handoff('KYC needs attention: ' + k.result.fails.map(f => f.title).join('; '), true);
    render(); $('#res').scrollIntoView({ behavior: 'smooth' });
  }
  function esign() {
    sheet(`<h3 style="margin-top:0">Aadhaar e-Sign</h3><p class="small muted" style="margin-top:0">Sign the order form for ${esc(S.rec.name)} (${inr(S.rec.monthly)}/month, ${S.rec.contract} months). Enter the OTP sent to your Aadhaar-linked mobile.</p>
      <div class="field"><input id="eotp" inputmode="numeric" maxlength="6" placeholder="6-digit OTP (demo: 761204)"></div>`, 'Sign', () => {
      if ($('#eotp').value !== '761204') { toast('e-Sign', 'Incorrect OTP (demo: 761204)'); return false; }
      A.trace('api', 'POST /api/esign → order form signed (Aadhaar •••• •••• 4417)'); toast('e-Sign', 'Order form signed ✓'); go('pay'); return true;
    });
  }
  function sheet(html, okLabel, onOk) {
    const el = document.createElement('div'); el.className = 'sheet-wrap';
    el.innerHTML = `<div class="sheet">${html}<div class="row" style="margin-top:6px"><button class="btn ghost sm" style="flex:1" data-x>Cancel</button><button class="btn sm" style="flex:1" data-ok>${okLabel}</button></div></div>`;
    $('.screen').appendChild(el);
    el.querySelector('[data-x]').onclick = () => el.remove();
    el.querySelector('[data-ok]').onclick = () => { if (onOk() !== false) el.remove(); };
    const i = el.querySelector('input'); if (i) i.focus();
  }

  // ---- schedule & pay
  function rPay(body, footer) {
    const r = S.rec; const start = E.addDays(E.DEMO_TODAY, r.installDays - 2 > 1 ? r.installDays - 2 : 1);
    const slots = [0, 1, 2].map(i => E.addDays(start, i));
    S.slot = S.slot || slots[0] + ' 10:00-12:00';
    const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    const due = r.monthly + r.gst + (r.key === 'micro' || r.key === 'prof' ? r.setup : Math.round(r.setup / (r.key === 'multi' ? 6 : 12)));
    body.innerHTML = `<h3 style="margin-top:0">Pick an installation slot</h3>
      ${slots.map(d => ['10:00-12:00', '14:00-16:00'].map(h => `<label class="consent" style="padding:8px 0"><input type="radio" name="slot" value="${d} ${h}" ${S.slot === d + ' ' + h ? 'checked' : ''}><span><b>${fmt(d)}</b>${h}</span></label>`).join('')).join('')}
      <div class="note" style="margin-top:8px">Fibre feasibility at your address: <b style="color:var(--green)">confirmed ✓</b> · engineer details shared a day before.</div>
      <div class="card" style="margin-top:12px"><div class="totals"><div class="r"><span>First month</span><span>${inr(r.monthly)}</span></div><div class="r"><span>GST 18%</span><span>${inr(r.gst)}</span></div>${r.setup ? `<div class="r"><span>Setup ${r.key === 'multi' || r.key === 'mfg' ? '(1st instalment)' : ''}</span><span>${inr(due - r.monthly - r.gst)}</span></div>` : ''}<div class="r big"><span>Pay now</span><span style="color:var(--red)">${inr(due)}</span></div></div></div>
      <div class="small muted">Pay with any UPI app. Monthly bills after this come on one consolidated invoice.</div>`;
    body.querySelectorAll('[name=slot]').forEach(x => x.onchange = () => { S.slot = x.value; });
    footer.innerHTML = `<button class="btn" id="paybtn">Pay ${inr(due)} with UPI</button>`;
    $('#paybtn').onclick = async () => { const b = $('#paybtn'); b.disabled = true; b.textContent = 'Waiting for UPI approval...'; A.trace('api', `POST /api/payments/upi-collect → ${inr(due)} (demo)`); await sleep(1500); placeOrder(due); };
  }
  function placeOrder(paid) {
    const r = S.rec, now = E.DEMO_TODAY;
    const id = 'UD-' + now.replace(/-/g, '').slice(2) + '-' + Math.floor(1000 + Math.random() * 9000);
    const slotDate = S.slot.split(' ')[0];
    const eta = E.addDays(slotDate, r.key === 'mfg' ? 3 : 0);
    S.order = { id, business: S.contact.business || S.profile.businessName, bundle: r.name, monthly: r.monthly, paid, slot: S.slot, eta, kyc: S.kyc.result ? S.kyc.result.decision : 'verified', mobile: E.maskPhone(S.contact.mobile),
      steps: [{ k: 'placed', t: 'Order placed', d: now + ' · payment received', s: 'done' }, { k: 'kyc', t: 'KYC verified', d: now + ' · ' + (S.kyc.result && S.kyc.result.decision === 'review' ? 'quick review cleared' : 'auto-approved in minutes'), s: 'done' },
        { k: 'sched', t: 'Installation scheduled', d: S.slot, s: 'now' }, { k: 'eng', t: 'Engineer on the way', d: 'Name & phone shared a day before', s: 'todo' }, { k: 'inst', t: 'Installed & tested', d: 'Speed test shared on WhatsApp', s: 'todo' }, { k: 'live', t: 'Live - welcome to Accel Business', d: 'Expected ' + eta, s: 'todo' }] };
    localStorage.setItem('ud_order', JSON.stringify(S.order));
    A.trace('sys', `Order ${id} created → provisioning, install slot ${S.slot}`);
    toast('WhatsApp · Accel Business', `Order ${id} confirmed. Track it here any time - no need to call.`);
    go('tracker');
  }

  // ---- tracker
  function rTracker(body, footer) {
    const o = S.order;
    if (!o) { body.innerHTML = '<p class="muted">No order yet.</p>'; footer.innerHTML = `<button class="btn" id="home">Start</button>`; $('#home').onclick = () => go('welcome'); return; }
    const cur = o.steps.find(s => s.s === 'now');
    body.innerHTML = `<div class="orderhead"><div><div class="small muted">Order</div><b>${esc(o.id)}</b></div><span class="pill ${cur && cur.k === 'live' ? 'ok' : 'red'}"><span class="dot"></span>${cur ? esc(cur.t) : 'Live'}</span></div>
      <div class="eta"><div><div class="small muted">${o.steps[5].s === 'done' ? 'Live since' : 'Expected live'}</div><b>${new Date(o.eta + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</b></div><div style="text-align:right"><div class="small muted">${esc(o.bundle)}</div><b style="font-size:15px">${inr(o.monthly)}/mo</b></div></div>
      <div class="timeline">${o.steps.map(s => `<div class="tl ${s.s}"><div class="b">${s.s === 'done' ? '✓' : ''}</div><div><div class="t">${esc(s.t)}</div><div class="d">${esc(s.d)}</div></div></div>`).join('')}</div>
      <div class="note">Updates come on WhatsApp${o.mobile ? ' to ' + esc(o.mobile) : ''}. Customers today call 3 times on average to chase status - you should not need to.</div>`;
    footer.innerHTML = `<div class="row"><button class="btn ghost sm" style="flex:1" id="resch">Reschedule</button><button class="btn ghost sm" style="flex:1" id="help">Chat with support</button></div>`;
    $('#resch').onclick = () => toast('Accel Business', 'Pick a new slot - we have sent options on WhatsApp.');
    $('#help').onclick = () => toast('Support', 'Support chat opens with your order already attached.');
  }
  function advanceOrder() {
    const o = S.order; if (!o) { toast('Demo', 'Place an order first'); return; }
    const i = o.steps.findIndex(s => s.s === 'now'); if (i < 0) return;
    o.steps[i].s = 'done'; if (o.steps[i].k === 'sched') o.steps[i].d = o.slot + ' · confirmed';
    const msgs = { eng: `Your engineer Ravi K. (ID ACC-2291) arrives ${o.slot.split(' ')[1]} today.`, inst: 'Installed. Speed test: 312 Mbps down / 298 Mbps up.', live: `You are live! Your first consolidated bill comes on the 1st. Welcome to Accel Business.` };
    if (o.steps[i + 1]) { o.steps[i + 1].s = o.steps[i + 1].k === 'live' ? 'done' : 'now'; if (o.steps[i + 1].k === 'eng') o.steps[i + 1].d = 'Ravi K. · ACC-2291 · ' + o.slot; if (o.steps[i + 1].k === 'live') o.steps[i + 1].d = 'Activated ' + o.eta; toast('WhatsApp · Accel Business', msgs[o.steps[i + 1].k] || 'Update'); A.trace('sys', `Order ${o.id}: ${o.steps[i + 1].t}`); }
    localStorage.setItem('ud_order', JSON.stringify(o)); if (S.screen === 'tracker') render();
  }

  // ---------------- hand-off to back-office ----------------
  function scoreProfile(P) {
    const M = window.PROPENSITY_MODEL; if (!M) return null;
    const segName = E.SEGMENTS[P.segment || 'micro'];
    const f = { ['segment=' + segName]: 1, 'lead_source=Website form': 1, ['city_tier=' + (P.tier || 2)]: 1, ['preferred_language=' + (LANG_NAME[S.lang] || 'English')]: 1, ['has_gstin=' + (E.gstActive(P) ? 'Y' : 'N')]: 1, ['current_internet=' + (P.currentInternet || 'Home broadband')]: 1, 'contact_role=Owner': 1,
      log_employees: Math.log1p(P.employees || 1), log_sites: Math.log1p(P.sites || 1), log_spend: Math.log1p(P.spend || 1500), n_interest: Math.max(1, (P.priorities || []).length) };
    let z = M.intercept; for (const k in f) if (M.coef[k] !== undefined) z += M.coef[k] * f[k];
    return 1 / (1 + Math.exp(-z));
  }
  function handoff(reason, silent) {
    const P = S.profile; const list = JSON.parse(localStorage.getItem('ud_app_leads') || '[]');
    const lead = { id: 'APP-' + Date.now().toString().slice(-6), at: new Date().toISOString(), business: S.contact.business || P.businessName || P.businessType || 'New business', type: P.businessType, segment: E.SEGMENTS[P.segment || 'micro'], city: P.city, tier: P.tier, employees: P.employees, sites: P.sites, language: LANG_NAME[S.lang], stage: S.screen, reason, bundle: S.rec ? S.rec.name : null, monthly: S.rec ? S.rec.monthly : null, score: scoreProfile(P), gstin: P.gstin ? E.maskGstin(P.gstin) : null, chat: S.chat.filter(m => m.text).slice(-8).map(m => (m.who === 'me' ? 'Owner: ' : 'Advisor: ') + m.text) };
    list.unshift(lead); localStorage.setItem('ud_app_leads', JSON.stringify(list.slice(0, 50)));
    A.trace('sys', `Hand-off to back-office queue: ${lead.id} (score ${(lead.score * 100).toFixed(0)}%) - ${reason}`);
  }

  // ---------------- toast ----------------
  let toastTimer;
  function toast(title, text) { const el = $('#toast'); el.innerHTML = `<div style="font-size:18px">💬</div><div><b>${esc(title)}</b>${esc(text)}</div>`; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3800); }

  // ---------------- demo personas (for recording the walkthrough) ----------------
  async function typeAndSend(text) { const inp = $('#inp'); inp.value = ''; for (const ch of text) { inp.value += ch; await sleep(18); } await sleep(250); await submitText(); }
  async function persona(n) {
    reset(true);
    S.lang = n === 'hi' ? 'hi' : 'en';
    go('advisor'); await startAdvisor(); await sleep(600);
    if (n === 1) { await typeAndSend('I run an insurance advisory office in Visakhapatnam with 12 staff, we use home broadband'); }
    if (n === 'hi') { await typeAndSend('मेरी जयपुर में किराना दुकान है, 3 लोग काम करते हैं, मोबाइल हॉटस्पॉट से इंटरनेट चलाते हैं'); }
    if (n === 3) { await typeAndSend('Travel agency in Visakhapatnam, 13 staff, one office, home broadband'); }
  }
  function reset(keepTrace) { const lang = S.lang; S = fresh(); S.lang = keepTrace ? lang : 'en'; if (!keepTrace) $('#log').innerHTML = ''; localStorage.removeItem('ud_order'); S.order = null; render(); }

  // ---------------- boot ----------------
  function boot() {
    $('#langSel').innerHTML = LANGS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
    $('#langSel').onchange = e => setLang(e.target.value);
    $('#back').onclick = () => { const i = SCREENS.indexOf(S.screen); if (S.screen === 'tracker') go('welcome'); else if (i > 0) go(SCREENS[i - 1]); };
    $('#spk').onclick = () => { S.speak = !S.speak; $('#spk').style.opacity = S.speak ? 1 : .45; A.trace('sys', 'Voice replies ' + (S.speak ? 'on' : 'off')); };
    document.querySelectorAll('[data-demo]').forEach(b => b.onclick = () => {
      const d = b.dataset.demo;
      if (d === 'reset') reset(false); else if (d === 'advance') advanceOrder(); else if (d === 'p1') persona(1); else if (d === 'p2') persona('hi'); else if (d === 'p3') persona(3);
      else if (d === 'gst') { if (S.screen === 'advisor' && S.asking === 'gstin') typeAndSend(b.dataset.g); else toast('Demo', 'Use this when the advisor asks for the GSTIN'); }
      else if (d === 'pack') { if (S.screen === 'kyc') { const sel = $('#pack'); sel.value = b.dataset.p; sel.onchange({ target: sel }); } else toast('Demo', 'Open the Smart KYC step first'); }
    });
    A.probe(); render();
    window.UD = { get state() { return S; }, persona, advanceOrder, go, render };
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
