"""Test dell'interfaccia nel browser, con schermo e tocco come un Poco F5.
Uso: python3 tests/ui_test.py [cartella_screenshot]
"""
import functools, http.server, os, socketserver, sys, threading
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(__file__), '..', 'app', 'src', 'main', 'assets', 'www')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/casamia-shots'
os.makedirs(OUT, exist_ok=True)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass
Handler = functools.partial(Quiet, directory=ROOT)
httpd = socketserver.TCPServer(('127.0.0.1', 0), Handler)
port = httpd.server_address[1]
threading.Thread(target=httpd.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{port}/index.html'

failures = []
def check(cond, msg):
    print(('✓ ' if cond else '✗ ') + msg)
    if not cond:
        failures.append(msg)

def count(page, what):
    return page.evaluate(f"Object.keys(CM._debug.editor().plan.{what}).length")

def to_screen(page, x, y):
    # coordinate mondo (metri) -> pagina (px)
    return page.evaluate("""([x, y]) => {
        const e = CM._debug.editor(); const r = e.canvas.getBoundingClientRect();
        return [r.left + e.view.x + x * e.view.s, r.top + e.view.y + y * e.view.s];
    }""", [x, y])

def tap(page, x, y):
    # chiude il pannello se aperto (come farebbe l'utente) e tocca il punto
    if page.locator('#sheet').is_visible():
        page.get_by_role('button', name='Chiudi pannello').click()
        page.wait_for_timeout(100)
    page.mouse.click(*to_screen(page, x, y))
    page.wait_for_timeout(250)

def drag(page, a, b, steps=12):
    page.mouse.move(*a); page.mouse.down(); page.mouse.move(*b, steps=steps); page.mouse.up()

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={'width': 393, 'height': 873}, device_scale_factor=2.75, has_touch=True, locale='it-IT')
    page = ctx.new_page()
    logs, errors = [], []
    page.on('console', lambda m: logs.append(m.text))
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_timeout(600)

    check(any('CASAMIA_READY' in l for l in logs), 'app avviata')
    check(any('CASAMIA_SELFTEST_OK' in l for l in logs), 'autotest superato')
    check(page.locator('.tutorial').is_visible(), 'guida al primo avvio')
    page.screenshot(path=f'{OUT}/01-guida.png')
    for _ in range(5):
        page.get_by_role('button', name='Avanti').click()
    page.get_by_role('button', name='Inizia').click()
    check(not page.locator('.tutorial').is_visible(), 'guida chiusa')
    check(page.locator('.project-card').count() == 1, 'esempio presente in home')
    page.screenshot(path=f'{OUT}/02-home.png')

    # Esempio
    page.locator('.project-card').first.click()
    page.wait_for_timeout(300)
    check(page.locator('#editor').is_visible(), 'editor aperto')
    check(count(page, 'rooms') == 8, 'esempio: 8 stanze')
    page.screenshot(path=f'{OUT}/03-esempio.png')
    sx, sy = to_screen(page, 2.0, 1.4)
    page.mouse.click(sx, sy)
    page.wait_for_timeout(200)
    check(page.locator('#sheet').is_visible() and 'Soggiorno' in page.locator('#sheet').inner_text(), 'tocco sul soggiorno apre il pannello')
    page.screenshot(path=f'{OUT}/04-stanza.png')
    # tocco sul muro da demolire
    tap(page, 5.2, 2.6)
    check('Da demolire' in page.locator('#sheet').inner_text() and page.locator('#sheet .seg button.on').inner_text().strip() == 'Da demolire', 'muro da demolire selezionato')
    page.screenshot(path=f'{OUT}/05-muro.png')
    # tocco su una porta
    tap(page, 1.4, 4.4)
    check('Porta a battente' in page.locator('#sheet').inner_text(), 'porta selezionata')
    page.screenshot(path=f'{OUT}/06-porta.png')
    page.get_by_role('button', name='Chiudi pannello').click()
    page.get_by_role('button', name='Torna ai progetti').click()

    # Nuovo progetto
    page.locator('#newProject').click()
    page.get_by_role('button', name='Crea').click()
    page.wait_for_timeout(300)
    check(count(page, 'rooms') == 0, 'nuovo progetto vuoto')
    page.locator('[data-tool=room]').click()
    page.evaluate("CM._debug.editor().view = {s: 50, x: 40, y: 60}")
    drag(page, to_screen(page, 0, 0), to_screen(page, 4.02, 3.01))
    check(count(page, 'rooms') == 1 and count(page, 'walls') == 4, 'stanza disegnata trascinando')
    rect = page.evaluate("(() => { const e = CM._debug.editor(); const id = Object.keys(e.plan.rooms)[0]; return CM.plan.rectInfo(e.plan, id); })()")
    check(abs(rect['w'] - 4.0) < 1e-6 and abs(rect['h'] - 3.0) < 1e-6, 'misure agganciate alla griglia (4,00 x 3,00)')
    page.screenshot(path=f'{OUT}/07-prima-stanza.png')
    # seconda stanza affiancata
    drag(page, to_screen(page, 4.0, 0.5), to_screen(page, 6.5, 3.0))
    check(count(page, 'rooms') == 2, 'seconda stanza')
    check(count(page, 'walls') == 8, 'muro in comune non duplicato (8 muri)')
    # modifica larghezza dal pannello
    page.locator('[data-tool=select]').click()
    page.evaluate("CM._debug.editor().view = {s: 50, x: 40, y: 60}")
    tap(page, 2, 1.5)
    check(page.evaluate("CM.plan.rectInfo(CM._debug.editor().plan, CM._debug.editor().sel.id).w") == 4, 'selezionata la prima stanza')
    inp = page.get_by_label('Larghezza')
    inp.fill('4,5')
    inp.press('Enter')
    page.wait_for_timeout(200)
    rect = page.evaluate("(() => { const e = CM._debug.editor(); const id = e.sel.id; return CM.plan.rectInfo(e.plan, id); })()")
    check(rect and abs(rect['w'] - 4.5) < 1e-6, 'larghezza cambiata a 4,50 m dal pannello')
    page.get_by_role('button', name='Chiudi pannello').click()

    # Muri liberi: stanza a L chiusa tornando al primo punto
    page.evaluate("CM._debug.editor().view = {s: 45, x: 40, y: 40}")
    page.locator('[data-tool=wall]').click()
    pts = [(0, 4), (3, 4), (3, 5), (1.5, 5), (1.5, 6.5), (0, 6.5), (0, 4)]
    for (x, y) in pts:
        page.mouse.click(*to_screen(page, x, y))
        page.wait_for_timeout(60)
    check(count(page, 'rooms') == 3, 'stanza a L creata con i muri liberi')
    area = page.evaluate("(() => { const e = CM._debug.editor(); const id = e.sel.id; return CM.plan.roomStats(e.plan, id).gross; })()")
    check(abs(area - (3 * 1 + 1.5 * 1.5)) < 1e-6, 'area della L corretta (5,25 m²)')
    page.screenshot(path=f'{OUT}/08-stanza-L.png')
    page.get_by_role('button', name='Chiudi pannello').click()

    # Porta su un muro
    page.locator('#zoomFit').click()
    page.wait_for_timeout(100)
    page.locator('[data-tool=opening]').click()
    page.get_by_role('button', name='Porta a battente').click()
    page.mouse.click(*to_screen(page, 2.0, 0.08))
    check(count(page, 'openings') == 1, 'porta inserita toccando il muro')
    page.locator('#undoBtn').click()
    check(count(page, 'openings') == 0, 'annulla')
    page.locator('#redoBtn').click()
    check(count(page, 'openings') == 1, 'ripeti')
    # pilastro
    page.locator('[data-tool=column]').click()
    page.mouse.click(*to_screen(page, 6.5, 3.0))
    check(count(page, 'columns') == 1, 'pilastro inserito')
    # trascinamento di un vertice
    page.locator('[data-tool=select]').click()
    tap(page, 5.2, 1.5)
    sel = page.evaluate("CM._debug.editor().sel")
    check(sel.get('type') == 'room', 'selezione seconda stanza')
    page.wait_for_timeout(200)
    drag(page, to_screen(page, 6.5, 0.5), to_screen(page, 7.0, 0.5))
    moved = page.evaluate("Object.values(CM._debug.editor().plan.nodes).some(n => Math.abs(n.x - 7) < 1e-6 && Math.abs(n.y - 0.5) < 1e-6)")
    if not moved:
        print(page.evaluate("JSON.stringify({v: CM._debug.editor().view, sel: CM._debug.editor().sel, n: Object.values(CM._debug.editor().plan.nodes)})"))
        page.screenshot(path=f'{OUT}/debug-drag.png')
    check(moved, 'vertice trascinato a 7,00 m')
    page.screenshot(path=f'{OUT}/09-modifiche.png')

    # Persistenza
    pid = page.evaluate("CM._debug.project().id")
    page.evaluate("CM.flush()")
    page.reload()
    page.wait_for_timeout(500)
    check(not page.locator('.tutorial').is_visible(), 'la guida non riappare al secondo avvio')
    check(page.locator('.project-card').count() == 2, 'progetti salvati dopo il riavvio')
    page.locator('.project-card').first.click()
    page.wait_for_timeout(200)
    check(page.evaluate("CM._debug.project().id") == pid and count(page, 'rooms') == 3, 'progetto ritrovato intatto')

    # Indietro di sistema
    page.evaluate("CM.onBack()")
    check(page.locator('#home').is_visible(), 'indietro torna alla home')

    # Orizzontale
    page.set_viewport_size({'width': 873, 'height': 393})
    page.locator('.project-card').nth(1).click()
    page.wait_for_timeout(300)
    page.mouse.click(*to_screen(page, 2.0, 1.4))
    page.wait_for_timeout(200)
    page.screenshot(path=f'{OUT}/10-orizzontale.png')
    check(page.locator('#sheet').is_visible(), 'pannello visibile in orizzontale')

    check(not errors, 'nessun errore JavaScript' + ('' if not errors else ': ' + '; '.join(errors)))
    browser.close()

httpd.shutdown()
if failures:
    print(f'{len(failures)} controlli falliti'); sys.exit(1)
print('Tutti i controlli superati')
