"""Udyam Digital prototype server - Python 3 standard library only (no pip install needed).

    python server.py            -> http://localhost:8000
    python server.py 9000       -> another port

Serves the web app and a small mock REST API backed by the hackathon CSVs:
    GET  /api/health
    GET  /api/gstin/<GSTIN>        mock GSTIN lookup   (data/mock_gstin_registry.csv)
    GET  /api/udyam/<UDYAM-NO>     mock Udyam lookup   (data/mock_udyam_registry.csv)
    POST /api/llm/extract          GenAI: free text -> structured business profile
    POST /api/llm/explain          GenAI: catalogue facts -> plain-language explanation

GenAI is optional. Set ONE of these environment variables before starting:
    GEMINI_API_KEY     (Google Gemini, default model gemini-2.0-flash)
    OPENAI_API_KEY     (OpenAI, default model gpt-4o-mini)
    ANTHROPIC_API_KEY  (Anthropic, default model claude-haiku-4-5)
    LLM_MODEL          optional override of the model name
Without a key the app uses its built-in rules parser and templated explanations.

Privacy: identifiers (GSTIN, Udyam, phone, Aadhaar-like numbers) are masked in logs and
redacted from any text sent to the LLM. The LLM never chooses products or prices.
"""
import csv, json, os, re, sys, time, urllib.request, urllib.error
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import unquote

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(ROOT, 'web')
DATA = os.path.join(ROOT, 'data')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
CH = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'


def load(name, key):
    path = os.path.join(DATA, name)
    with open(path, encoding='utf-8') as f:
        return {r[key]: r for r in csv.DictReader(f)}


GST = load('mock_gstin_registry.csv', 'gstin')
UDYAM = load('mock_udyam_registry.csv', 'udyam_number')


def checksum(g):
    t = 0
    for i, c in enumerate(g[:14]):
        v = CH.find(c)
        if v < 0:
            return None
        p = v * (2 if i % 2 else 1)
        t += p // 36 + p % 36
    return CH[(36 - t % 36) % 36]


def mask(text):
    s = str(text)
    s = re.sub(r'\b(\d{2})[0-9A-Z]{9}([0-9A-Z]{4})\b', r'\1•••••••••\2', s)          # GSTIN
    s = re.sub(r'(UDYAM-[A-Z]{2}-\d{2}-)\d{3}(\d{4})', r'\1•••\2', s)                 # Udyam
    s = re.sub(r'\b\d{4}\s?\d{4}\s?(\d{4})\b', r'•••• •••• \1', s)                     # Aadhaar-like
    s = re.sub(r'\b[6-9]\d{5}(\d{4})\b', r'••••••\1', s)                               # mobile
    return s


def redact(text):
    s = re.sub(r'\b\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]\b', '[GSTIN]', str(text), flags=re.I)
    s = re.sub(r'UDYAM-[A-Z]{2}-\d{2}-\d{7}', '[UDYAM]', s, flags=re.I)
    s = re.sub(r'\b\d{4}\s?\d{4}\s?\d{4}\b', '[ID]', s)
    s = re.sub(r'\b[6-9]\d{9}\b', '[PHONE]', s)
    s = re.sub(r'\S+@\S+\.\w+', '[EMAIL]', s)
    return s


# ---------------- LLM ----------------
def llm_config():
    if os.environ.get('GEMINI_API_KEY'):
        return 'gemini', os.environ.get('LLM_MODEL', 'gemini-2.0-flash')
    if os.environ.get('OPENAI_API_KEY'):
        return 'openai', os.environ.get('LLM_MODEL', 'gpt-4o-mini')
    if os.environ.get('ANTHROPIC_API_KEY'):
        return 'anthropic', os.environ.get('LLM_MODEL', 'claude-haiku-4-5')
    return None, None


def post_json(url, body, headers):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', **headers})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode())


def llm(system, user, want_json=False):
    provider, model = llm_config()
    if not provider:
        return None
    if provider == 'gemini':
        body = {'systemInstruction': {'parts': [{'text': system}]}, 'contents': [{'role': 'user', 'parts': [{'text': user}]}],
                'generationConfig': {'temperature': 0.2, **({'responseMimeType': 'application/json'} if want_json else {})}}
        r = post_json(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={os.environ["GEMINI_API_KEY"]}', body, {})
        return r['candidates'][0]['content']['parts'][0]['text']
    if provider == 'openai':
        body = {'model': model, 'temperature': 0.2, 'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}]}
        if want_json:
            body['response_format'] = {'type': 'json_object'}
        r = post_json('https://api.openai.com/v1/chat/completions', body, {'Authorization': 'Bearer ' + os.environ['OPENAI_API_KEY']})
        return r['choices'][0]['message']['content']
    if provider == 'anthropic':
        body = {'model': model, 'max_tokens': 600, 'temperature': 0.2, 'system': system, 'messages': [{'role': 'user', 'content': user}]}
        r = post_json('https://api.anthropic.com/v1/messages', body, {'x-api-key': os.environ['ANTHROPIC_API_KEY'], 'anthropic-version': '2023-06-01'})
        return r['content'][0]['text']


EXTRACT_SYSTEM = """You extract a small-business profile from what an Indian shop or office owner typed or said (any Indian language or Hinglish).
Return ONLY a JSON object with these keys (use null when not stated, never guess):
business_type (short English noun phrase, e.g. "dental clinic"), segment ("micro" for shops/salons/pharmacies/cafes/single restaurants,
"prof" for clinics/CA/law/coaching/agencies/offices, "multi" for chains with 3+ outlets, "mfg" for factories/workshops/manufacturing units),
employees (integer), sites (integer number of locations), city (English city name), current_internet (one of "Mobile hotspot",
"Home broadband", "Business broadband", "Leased line", "Mixed per site"), monthly_spend (integer rupees),
priorities (array, subset of: payments, customers, cctv, email, security, uptime, calls, machines, fleet, website, remote).
Do not add any other keys."""

EXPLAIN_SYSTEM = """You are a friendly advisor for Accel Business explaining a recommended bundle to a small-business owner in India.
Use ONLY the facts given. Never mention a product, price, discount or promise that is not in the facts. No jargon, no product codes.
Write 2-3 short sentences (max 70 words) in the requested language, addressing the owner as "you". Plain text, no lists."""


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=WEB, **k)

    def log_message(self, fmt, *args):
        sys.stderr.write('%s  %s\n' % (time.strftime('%H:%M:%S'), mask(fmt % args)))

    def send_json(self, obj, code=200):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(b)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(b)

    def end_headers(self):
        if self.path.endswith('.wasm.js') or self.path.endswith('.gz'):
            self.send_header('Cache-Control', 'max-age=86400')
        super().end_headers()

    def do_GET(self):
        p = unquote(self.path.split('?')[0])
        if p == '/api/health':
            prov, model = llm_config()
            return self.send_json({'ok': True, 'llm': {'enabled': bool(prov), 'provider': f'{prov}:{model}' if prov else None}, 'records': {'gstin': len(GST), 'udyam': len(UDYAM)}})
        if p.startswith('/api/gstin/'):
            g = re.sub(r'[^0-9A-Z]', '', p.split('/')[-1].upper())
            val = {'gstin': g, 'length': len(g) == 15, 'checksum': len(g) == 15 and checksum(g) == g[14]}
            r = GST.get(g)
            if not r:
                return self.send_json({'gstin': g, 'validation': val, 'found': False})
            return self.send_json({'gstin': g, 'validation': val, 'found': True, 'legalName': r['legal_name'], 'tradeName': r['trade_name'], 'constitution': r['constitution'],
                                   'address': r['principal_place_of_business'], 'state': r['state'], 'registrationDate': r['registration_date'], 'status': r['status']})
        if p.startswith('/api/udyam/'):
            u = p.split('/')[-1].upper().replace(' ', '')
            r = UDYAM.get(u)
            if not r:
                return self.send_json({'udyam': u, 'found': False})
            return self.send_json({'udyam': u, 'found': True, 'enterpriseName': r['enterprise_name'], 'enterpriseType': r['enterprise_type'], 'majorActivity': r['major_activity'],
                                   'nic': r['nic_description'], 'state': r['state'], 'city': r['city'], 'registrationDate': r['date_of_registration']})
        if p == '/':
            self.path = '/index.html'
        return super().do_GET()

    def do_POST(self):
        p = self.path.split('?')[0]
        n = int(self.headers.get('Content-Length') or 0)
        try:
            body = json.loads(self.rfile.read(n) or b'{}')
        except json.JSONDecodeError:
            return self.send_json({'error': 'bad json'}, 400)
        try:
            if p == '/api/llm/extract':
                text = redact(body.get('text', ''))
                out = llm(EXTRACT_SYSTEM, f'Owner said: """{text}"""\nAlready known: {json.dumps(body.get("context") or {})}', want_json=True)
                if out is None:
                    return self.send_json({'slots': None, 'llm': False})
                out = re.sub(r'^```(json)?|```$', '', out.strip()).strip()
                return self.send_json({'slots': json.loads(out), 'llm': True})
            if p == '/api/llm/explain':
                facts = [redact(f) for f in body.get('facts', [])][:12]
                lang = body.get('lang', 'English')
                user = f'Language: {lang}\nBundle: {body.get("bundle")}\nMonthly price: {body.get("price")}\nFacts:\n- ' + '\n- '.join(facts)
                out = llm(EXPLAIN_SYSTEM, user)
                return self.send_json({'text': out.strip() if out else None, 'llm': out is not None})
        except (urllib.error.URLError, KeyError, ValueError, TimeoutError) as e:
            sys.stderr.write('LLM error: %s\n' % mask(str(e)[:200]))
            return self.send_json({'slots': None, 'text': None, 'error': 'llm_unavailable'})
        return self.send_json({'error': 'not found'}, 404)


if __name__ == '__main__':
    prov, model = llm_config()
    print(f'Udyam Digital prototype on http://localhost:{PORT}')
    print(f'  GSTIN records: {len(GST)}, Udyam records: {len(UDYAM)}')
    print(f'  GenAI: {prov + ":" + model if prov else "off (set GEMINI_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY to enable)"}')
    print('  Customer app: /   Back-office: /backoffice.html   KYC lab: /kyclab.html')
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
