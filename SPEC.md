# Casa Mia — Specifica del progetto

App Android per progettare, ristrutturare e arredare casa. Uso personale, un solo piano, stile grafico chiaro e pulito, solo italiano.
Telefono di riferimento: Poco F5. Verticale e orizzontale. APK generato da GitHub Actions; ogni APK passa un test prima della consegna.

Uso principale: **ristrutturare casa mia** (partire dall'esistente). Usi secondari: arredare, progettare da zero.

---

## 1. Pianta 2D
- Stanze a rettangolo **e** muri liberi tracciati punto per punto (stanze a L, irregolari)
- Misure trascinando col dito, aggancio a griglia; correzione numerica sempre possibile
- Quote automatiche, superficie per stanza e totale
- Elementi strutturali: **pilastri e travi** (ingombri fissi)
- Aperture: porte a battente (arco, verso dx/sx), porte scorrevoli (esterno muro / a scomparsa), finestre e portefinestre (altezza davanzale), archi e passaggi
- **Stati dei muri** stile tavola tecnica: esistente (nero), da demolire (giallo), da costruire (rosso) — conteggiati nei costi
- Orientamento: bussola/nord + indirizzo (per simulazione sole)
- Annulla/ripeti, salvataggio automatico

## 2. Planimetria caricata
- Da foto della fotocamera, immagine (JPG/PNG) o PDF
- **Riconoscimento automatico offline** di muri e stanze; **Gemini opzionale** (chiave gratuita nelle impostazioni) per risultati migliori
- La planimetria resta come sfondo, con scala impostabile su un muro noto; l'utente corregge a mano

## 3. Rilievo
- **Metro AR** con la fotocamera (ARCore: da verificare il supporto sul Poco F5) + inserimento manuale delle misure

## 4. Impianti
- Elettrico: prese, interruttori, punti luce
- Idraulico: attacchi acqua e scarichi
- Riscaldamento/clima: termosifoni, condizionatori, caldaia
- **Documentazione tracce**: foto delle tracce impianti collegate alla posizione sulla pianta

## 5. Finiture e materiali
- **Piastrelle/parquet**: scatole da comprare (m² stanza ÷ m² per scatola + sfrido), tipo di posa (dritta, sfalsata, diagonale, spina di pesce) che incide su sfrido e aspetto, fughe, colla, stucco, distanziatori, battiscopa coordinato
- **Rivestimenti a parete** (bagno, cucina): altezza rivestimento, parete per parete
- **Pittura**: codici colore (RAL/NCS/colorificio), litri e numero di mani
- **Carta da parati**: rotoli in base a parete e rapporto del motivo
- La foto del prodotto importato diventa la **texture nel 3D**

## 6. Arredamento
- Catalogo base con misure standard + mobili personalizzati (nome, misure, prezzo)
- **Cucine e armadi componibili**: basi, pensili, colonne, incassi, con vista frontale della parete
- Illuminazione (luce reale nel 3D), tessili (tende, tappeti), decorazioni (quadri, piante, specchi)
- **Stili guidati** (scandinavo, industriale, ...) con palette e mobili coerenti
- Controlli: mobili sovrapposti o fuori stanza, spazio di passaggio insufficiente, porte bloccate dall'arredo

## 7. Importazione dai negozi
- Incolli il link di un negozio o di una sua sezione; l'app lo apre al suo interno e **importa gli articoli della pagina** che stai guardando (nome, misure, prezzo, foto, link)
- Classificazione automatica: bagno, cucina, camera, soggiorno, elettrodomestici, TV ed elettronica, illuminazione, piastrelle/pavimenti, pitture, porte/finestre, sanitari, esterni...
- Negozi: arredamento (IKEA, Mondo Convenienza, Deghi, ...), elettronica (frigoriferi, TV, ...), bricolage/edilizia (Leroy Merlin, Tecnomat, ...) e qualsiasi altro sito
- Nota: niente download dell'intero catalogo (bloccato dai siti e vietato dai termini d'uso); si importa ciò che apri
- AI Gemini come aiuto quando la pagina è difficile da leggere (se c'è la chiave); altrimenti completamento manuale
- Prezzi: **aggiornamento su richiesta** + **avvisi di sconto** periodici sui prodotti salvati

## 8. Vista 3D
- Curata: texture di pavimenti e pareti, mobili riconoscibili, luci
- Modellino da girare dall'esterno + **passeggiata** ad altezza occhi
- **Simulazione del sole**: luce e ombre per ora del giorno e stagione, dato nord e indirizzo

## 9. Esterni
- Balconi e terrazzi, giardino (prato, piante, vialetti, recinzioni), box e posto auto, piscina, verande, pergole, gazebo

## 10. Costi e budget
- Voci: arredamento, finiture, opere edili (muri da costruire/demolire, porte, finestre, impianti)
- Tabella prezzi medi italiani modificabile
- **Tetto di budget** con avviso di sforamento (anche per stanza)
- Separazione **materiali vs manodopera**
- **Preventivi ditte** da inserire e confrontare
- **Varianti** dello stesso progetto con costi a confronto

## 11. Acquisti
- Lista della spesa raggruppata per negozio, con link al prodotto
- Stato: da comprare, ordinato, arrivato, montato
- Pagamenti e acconti: pagato / da pagare

## 12. Cantiere
- Cronoprogramma dei lavori per fasi con date
- Rubrica ditte (idraulico, elettricista, piastrellista...)
- Foto e diario di avanzamento collegati alle stanze
- Promemoria e notifiche per scadenze e consegne

## 13. Controlli normativi (indicativi)
- Avvisi su minimi edilizi (es. camera singola 9 m², doppia 14 m², altezza 2,70 m, superficie finestrata ≥ 1/8 del pavimento). Sempre da verificare con un tecnico.

## 14. AI (Gemini, opzionale)
- Riconoscimento planimetrie, aiuto import negozi
- Consigli di disposizione dell'arredo applicabili
- Render fotorealistici da una vista 3D (limiti del piano gratuito)
- Chat sul progetto ("quanto spendo per il bagno?")

## 15. Esportazione e condivisione
- PDF con pianta quotata, mobili e costi
- Immagini delle viste 3D
- Condivisione su WhatsApp
- File di progetto da mandare a un'altra persona che lo apre e modifica con l'app
- Backup su Google Drive

## 16. Uso
- Funziona offline tutto tranne importazione web e AI
- Tutorial al primo avvio + progetto d'esempio
- Stile: chiaro e pulito "tavolo da architetto" (bianco/carta, inchiostro scuro, accento blu progetto; Instrument Sans + JetBrains Mono per le misure). Riferimento: canvas "Casa Mia — Layout app"

## 17. Gestione condivisa
- Invitati possibili: famiglia/partner, tecnico, ditte e artigiani, amici
- Ruoli: proprietario, può modificare, solo visione
- Sincronizzazione tramite **cartella condivisa su Google Drive** (aggiornamento ogni pochi minuti; in caso di modifiche contemporanee l'app chiede quale versione tenere)
- Invito con **link/codice** (es. via WhatsApp) **oppure email Google**
- **Visibilità a spunte per ogni condivisione**: a ogni invito l'app elenca le sezioni (pianta, 3D, arredo, finiture, costi e budget, preventivi, pagamenti, acquisti, cantiere, foto impianti, chat...) e si spunta cosa quella persona può vedere. Tecnicamente il progetto è salvato su Drive in file separati per sezione, così Drive condivide solo quelli spuntati
- **Chat del progetto** tra i partecipanti
- **Storico versioni**: chi ha cambiato cosa, con possibilità di tornare indietro
- Le ditte non aggiornano il cantiere (solo visione/chat secondo i permessi)
- Chi non ha l'app riceve un link a una **pagina web di sola lettura** (pianta, 3D, lista), con le stesse sezioni spuntate
- Nota: chi usa l'app deve installare l'APK e avere un account Google; la prima configurazione dell'accesso a Drive richiede un passaggio una tantum su Google Cloud (guidato)

---

## Tappe di sviluppo (ordine pensato per la ristrutturazione)
1. **Pianta 2D**: stanze, muri liberi, aperture, pilastri/travi, stati dei muri, quote, salvataggio, tutorial, progetto d'esempio
2. **Planimetria caricata e rilievo**: sfondo + scala, riconoscimento offline, Gemini opzionale, metro AR
3. **Impianti** e documentazione tracce con foto
4. **Costi**: opere edili, tabella prezzi, budget, materiali/manodopera, preventivi, varianti, controlli normativi
5. **Finiture**: piastrelle, rivestimenti, pittura, carta da parati
6. **Arredamento**: catalogo, componibili, luci, tessili, decorazioni, stili, controlli di ingombro
7. **3D** curato, passeggiata, sole, esterni
8. **Importazione dai negozi** con classificazione, aggiornamento prezzi, avvisi sconto
9. **Acquisti e cantiere**: lista spesa, pagamenti, cronoprogramma, ditte, diario, promemoria
10. **AI**: consigli, render, chat
11. **Esportazioni**: PDF, immagini, WhatsApp, file progetto, backup Drive
12. **Condivisione**: Drive condiviso, ruoli, sezioni a spunte, chat, storico versioni, pagina web di sola lettura
