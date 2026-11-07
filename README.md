# Udyam Digital - prototype (Airtel Sync 2026, Digital Track)

**Team RabdiJalebi, VIT Vellore**

This prototype is a digital-first journey for Accel Business. A small-business owner finds the right bundle, buys it, completes KYC and tracks activation on a phone, in one sitting, in their own language.

All data is the synthetic hackathon pack: fictional businesses, people and identifiers. "Today" is fixed at **15 Jul 2026**, as the data README specifies.

## Run it (Windows, macOS or Linux)

You only need **Python 3.8+**. No `pip install` is needed, and the app runs without internet.

```
python server.py
```

Then open **http://localhost:8000** in Chrome or Edge. On Windows you can also double-click `start.bat`.

| Page | URL | What it shows |
|---|---|---|
| Customer app | `/` | Advisor → quote & checkout → details → consent → Smart KYC → schedule & pay → order tracker, with a live "under the hood" trace |
| Back-office | `/backoffice.html` | Leads the advisor could not close, ranked by propensity score, with route and next best action (stretch goal) |
| KYC lab | `/kyclab.html` | Runs Smart KYC on all 12 specimen packs (K01-K12) and shows every planted problem it catches |

### Optional: switch on GenAI

Set one API key before starting the server. The advisor then uses the LLM to understand free text in any language and to write the plain-language "why".

```
set GEMINI_API_KEY=...        (Windows)   |   export GEMINI_API_KEY=...   (macOS/Linux)
python server.py
```

`OPENAI_API_KEY` and `ANTHROPIC_API_KEY` also work, and `LLM_MODEL` overrides the default model.

Without a key the advisor uses its built-in rules parser and templated explanations, so the demo never breaks.

## What is built

**Advisor.** It asks at most 6 questions: business type, staff, sites, city, current internet and spend, priorities, plus an optional GSTIN.
- The owner can answer everything in one sentence ("insurance office in Visakhapatnam with 12 staff"). Answers can be typed, tapped or spoken (voice input in English or Hindi), and the advisor can read its replies aloud.
- Full English and Hindi UI. With GenAI on, explanations are generated in any of the 10 languages in the data.
- A GSTIN is checked live: format, checksum and state code, then a registry lookup. A cancelled or suspended GSTIN locks GST-only products and switches the owner to lite KYC.

**Rules & pricing engine** (`web/js/engine.js`). It is deterministic, and only it decides products and prices. The LLM can only explain.
- Four bundles: Dukaan Digital, Pro Office, Chain Connect and Factory Assured.
- Every product and add-on is checked against the catalogue rules: city tier, minimum staff, minimum sites, active GSTIN and `requires_one_of` dependencies.
- Locked add-ons show the reason, for example "not sold in tier-2 cities" or "needs an active GSTIN".
- A price audit proves each bundle price sits inside the catalogue range.

**Quote & checkout.** One monthly price with add-on toggles and quantity steppers. It shows 18% GST, the one-time setup fee, contract length and install time (from `typical_install_days`). The quote can be shared on WhatsApp or handed to an expert.

**Consent.** A DPDP Act 2023 consent screen with a separate consent per purpose. Marketing is optional and unticked. Each consent is written to a ledger.

**Smart KYC** (`web/js/kyc.js`). Documents are read on the device with Tesseract.js OCR, which is bundled locally, and the images are discarded after reading.
- **Image quality:** a sharpness score rejects blurry photos (pack K04). Tilted scans are straightened automatically (K02).
- **GSTIN:** OCR misreads are fixed using the GSTIN structure and checksum (K03, K10). Checks cover format, checksum, registry status (K01 is cancelled) and legal and trade name against the registry (K07 is a name mismatch). A tampered number is caught and the registry record it should have matched is shown (K06).
- **Udyam:** number present (K01 is blank), format, registry record, and the same business and state as the GST record.
- **Signatory:** the ID is valid and belongs to the same business. For a proprietorship the signatory must be the proprietor. For an LLP it must be a designated partner, and for a company a director; otherwise the case goes to review (K05, K10, K11).
- **Address proof:** dated within 90 days (K11's bill is too old), in the business name, and the PIN code matches the GST address.
- **Decision:** Verified, Quick review or Action needed, with the exact fix for each failed check. Signatory ID can be fetched through DigiLocker (mock), and the order form is signed with Aadhaar e-sign (mock).

**Tracker.** The order timeline (placed → KYC → scheduled → engineer → installed → live) with an ETA, and WhatsApp-style updates as it moves, so the owner never needs to call.

**Back-office** (stretch goal). Shows 3,039 stalled leads plus live hand-offs from the app.
- Leads are ranked by a logistic-regression propensity score, exported from `tools/build_data.py`; hold-out AUC is 0.75.
- Each lead is routed to Field, Partner or Call back, and gets a next best action for its drop reason and the bundle the advisor would offer.

**Mock APIs** (`server.py`): `GET /api/gstin/<id>`, `GET /api/udyam/<id>`, `POST /api/llm/extract`, `POST /api/llm/explain`. If the page is opened without the server, the same lookups run in the browser from the bundled registry files.

## Architecture

```
 Phone (PWA)  ── advisor chat / voice ──►  Language layer (LLM, optional) ──► structured profile
      │                                        ▲ PII redacted before any LLM call
      ▼
 Rules & pricing engine  ◄── product_catalogue.csv   (eligibility, dependencies, price audit)
      │
      ▼
 Quote & checkout ──► Consent ledger ──► Smart KYC: quality → OCR (on device) → GSTIN/Udyam lookups
                                                    ◄── mock_gstin_registry.csv / mock_udyam_registry.csv
      │
      ▼
 Order + tracker (WhatsApp updates)        Back-office console ◄── propensity model + app hand-offs
```

## Privacy and security choices

- **Data minimisation:** the advisor asks for no ID numbers. Lite KYC asks for 2 documents instead of 4 when no GST product is in the bundle.
- **On-device OCR:** document images are read on the device. Only the extracted fields are kept, and the images are discarded after verification.
- **Masking:** GSTIN (first 2 and last 4 characters), Udyam, ID and phone numbers are masked in the UI trace and in the server logs.
- **LLM redaction:** GSTIN, Udyam, phone, Aadhaar-like numbers and emails are redacted before any text is sent to an LLM. The LLM never chooses products or prices.
- **Consent:** separate consents per purpose. Marketing is opt-in, and consent can be withdrawn from the tracker.

## Tests

```
node tests/engine.test.js      # 34 checks: bundles, eligibility rules, price audit, GSTIN checksum/OCR fixes
```

To test KYC, open `/kyclab.html` and press **Run all 12 packs**.

## Repository layout

```
server.py                 stdlib web server + mock REST API + optional LLM proxy
data/                     hackathon CSVs (synthetic)
tools/build_data.py       CSV -> web/data/*.js, trains and exports the propensity model
web/index.html            customer app (phone frame + under-the-hood trace)
web/backoffice.html       sales & partner console
web/kyclab.html           Smart KYC batch test
web/js/engine.js          rules & pricing engine, identifier validation
web/js/kyc.js             image quality, OCR, field extraction, validation
web/js/api.js             mock API layer (server or in-browser)
web/js/app.js             customer journey UI, advisor, i18n (EN/HI), voice
web/specimens/            KYC specimen documents K01-K12
web/vendor/tesseract/     Tesseract.js 5.1.1 + English model (Apache-2.0), bundled for offline use
tests/engine.test.js      engine tests
```

Third-party code: Tesseract.js and tesseract.js-core (Apache License 2.0).
