# Casa Mia

App Android per progettare, ristrutturare e arredare casa. La specifica completa è in [SPEC.md](SPEC.md).

## Installare sul telefono
1. Dal telefono apri **Releases** di questo repository (ultima versione).
2. Scarica il file `CasaMia-0.1.N.apk` e aprilo.
3. Se Android lo chiede, consenti l'installazione da questa fonte.

Gli aggiornamenti si installano sopra la versione precedente senza perdere i progetti.

## Stato
- **Tappa 1 — Pianta 2D**: stanze a rettangolo e muri liberi, porte (battente, scorrevole, a scomparsa), finestre, portefinestre, archi, pilastri e travi, stati dei muri (esistente / da demolire / da costruire), quote e superfici nette, annulla/ripeti, bussola, guida iniziale, progetto d'esempio, verticale e orizzontale.

## Come è fatta
- `app/src/main/java/...` — guscio Android (WebView) con salvataggio su file nella memoria dell'app.
- `app/src/main/assets/www/` — l'app vera e propria (HTML, CSS, JavaScript), funziona offline.
- `tests/plan.test.js` — test della logica della pianta (`node tests/plan.test.js`).
- `tests/ui_test.py` — test dell'interfaccia in un browser con schermo da Poco F5.
- `.github/workflows/build.yml` — compila l'APK, lo prova su un emulatore Android e lo pubblica come release solo se il test passa.

Nota: la chiave di firma `app/casamia.keystore` è nel repository per permettere aggiornamenti senza disinstallare; l'app è per uso personale e non è sul Play Store.
