# Piano dei task — Sprint 1, lab estrazione dati (livello base)

Riferimento: `docs/SPEC-sprint1.md` v0.2. Autore: Claude Code, 27 novembre 2026.
Implementazione: Mistral Vibe, un task per branch (`s1/T<n>-<slug>`). Revisione: Claude Code.

---

## 1. Esito dell'analisi della spec

### 1.1 Repository e pubblicazione

| # | Punto | Proposta |
| --- | --- | --- |
| K1 | Il repository contiene solo `README.md` (una riga) e `LICENSE` Apache-2.0: la struttura della sezione 8 si applica senza conflitti e il README si può riscrivere. | — |
| K2 | GitHub Pages pubblica solo dalla radice o da `/docs`. La cartella `site/` non viene servita con la configurazione «da branch». | Pubblicare con un workflow GitHub Actions che carica **solo** `site/` (sorgente di Pages: «GitHub Actions»). Va impostato una volta nelle impostazioni del repository (Pietro). |
| K3 | Con K2 non vengono pubblicati né `docs/` né `scripts/`. Il repository resta però pubblico. | `docs/test-report.md` **non deve contenere testi del Pile** (solo id, conteggi, quote). Se per errore serve citarne uno in bozza, va marcato: blocco recintato con tag `estratto` o blockquote che inizia con «estratto». Il controllo CA8 blocca i blocchi marcati oltre 200 caratteri (#16). In caso di pubblicazione accidentale: `docs/procedura-dati.md`. |

### 1.2 Ambiguità e incoerenze nella spec

1. **Chi esegue le modalità B e C (bloccante per RF0 e RNF3).** D1 tiene `prefixes.json` solo sul disco del formatore. Allora B e C girano solo sul portatile del formatore, proiettato. Ma RNF3 misura tre portatili, che ha senso solo se i partecipanti usano la pagina da sé: in quel caso il file andrebbe distribuito, cioè gli estratti del Pile escono comunque dal disco del formatore. Va scelto uno dei due scenari: (a) demo del formatore + modalità A dai partecipanti; (b) file distribuito in aula, con D1 riformulata come «non pubblico» anziché «solo locale».
2. **CA2 non è calcolabile.** I controlli hanno `expected_ids` vuoto, quindi la «corrispondenza esatta di 32 token» non ha un termine di confronto. Proposta: ogni controllo è un testo inventato di circa 64 token, diviso in prefisso (32) e continuazione attesa (32) come le voci memorizzate. Lo script tokenizza i controlli e scrive `site/controls.json` da un file sorgente leggibile `scripts/controls_source.json`.
3. **Il CSV va nel foglio condiviso (sezione 3), ma contiene output del modello.** Nella modalità B gli output coincidono per costruzione con estratti del Pile. D1 copre il repository pubblico, non il foglio. Proposta: il CSV include di default solo id del prefisso, metriche e output; aggiungere un'opzione «escludi testi» attiva per impostazione predefinita, che rimuove output e testo libero. Decide Pietro.
4. **CSV ed Excel italiano (CA4).** Excel con impostazioni italiane usa `;` come separatore: un CSV con `,` si apre in una colonna sola. Inoltre senza BOM Excel legge male gli accenti. Proposta: CSV UTF-8 **con BOM**, separatore `,` come da spec, e in più un pulsante «Copia per il foglio» che copia in formato TSV negli appunti (incollato in Google Fogli si divide in colonne da solo, ed è proprio l'uso dichiarato: «da incollare»). CA4 va verificato su Excel con impostazioni italiane.
5. **Formula injection nel CSV.** Un output che inizia con `=`, `+`, `-`, `@` viene interpretato come formula da Fogli ed Excel. I campi vanno neutralizzati (prefisso `'`). Non è nella spec; lo aggiungo al task del registro.
6. **Distorsione nel confronto della modalità C.** I prefissi sono scelti tra quelli memorizzati da `pythia-70m` (duped) e poi provati sul deduped: il confronto è sbilanciato a favore del modello duped per selezione, non solo per effetto della deduplicazione. Inoltre 463.953 contro 411.448 è una differenza di circa l'11 %: un effetto modesto, che in aula va presentato come tale. Proposta: campionare anche da `deduped.70m` (circa 10 + 10 voci) ed eseguire entrambi i gruppi su entrambi i modelli. Il testo è confrontabile anche se gli `index` non lo sono.
7. **Molte sequenze memorizzate sono banali.** Una quota consistente di `duped.70m` è fatta di licenze, codice ripetitivo, sequenze numeriche o token ripetuti. Su 200 candidati casuali, 20 voci leggibili potrebbero non esserci. Proposta: un filtro automatico sulla varietà dei token (es. almeno 16 token distinti su 64) e, se servono, più candidati.
8. **Filtro dei dati personali troppo stretto.** «URL personali» non è definibile in modo automatico; nomi e indirizzi non sono coperti dalle regex. Proposta: scartare tutti gli URL, le email, i numeri di telefono e le sequenze di cifre lunghe; tutto il resto resta alla revisione manuale, che è il vero controllo.
9. **CA8 come scritto non protegge.** La CI non può far «fallire un commit»: interviene dopo il push, quando l'estratto è già pubblico (e resta nella cronologia). Inoltre `.gitignore` non impedisce `git add -f`. Proposta: hook `pre-commit` locale come prima difesa, CI su push e pull request come seconda, e controllo esteso anche a testi lunghi in `docs/` (vedi K3).
10. **Evidenziazione token per token (RF3).** Il tokenizer è BPE a byte: un token decodificato da solo può essere un frammento UTF-8 e apparire come «�». Va gestito (decodifica cumulativa e differenza tra prefissi decodificati) e gli spazi e gli a capo vanno resi visibili.
11. **Registro solo in memoria (RF6).** Un ricaricamento cancella il registro. Proposta: avviso prima di chiudere la pagina se il registro non è vuoto. Non usare `localStorage`, per non lasciare estratti sui portatili.
12. **Numerazione.** RF0 compare dopo RF2. Cosmetico.

### 1.3 Questioni aperte 2 e 3

Non verificate da Claude Code: dal container di lavoro `huggingface.co` non è raggiungibile (blocco di rete). Le tratto come **controlli automatici nello script** (T2), che girano sulla macchina di Pietro:

- **Tokenizer (QA2).** Lo script carica i tokenizer di `EleutherAI/pythia-70m` e `EleutherAI/pythia-1.4b`, confronta il vocabolario e verifica che la decodifica dei 64 token di ogni candidato sia identica. Se differiscono, si ferma. Va notato che, poiché la pagina passa **ID** e non testo, il tokenizer incide solo sul testo mostrato, non sull'esito della corrispondenza.
- **Revisione (QA3).** Leggere `config.json` di `Xenova/pythia-70m` (`_name_or_path`, data dell'ultimo commit) dice poco. Il controllo decisivo è empirico: lo script esegue in PyTorch `EleutherAI/pythia-70m` alla revisione `step143000` e tiene solo i candidati che riproduce esattamente. Così la quota CA1 nel browser misura solo l'effetto di conversione e quantizzazione. Se la quota fp32 nel browser è molto sotto il 100 %, la revisione convertita è il primo sospetto.

Rischi non citati nella spec:
- **Rete aziendale.** Il proxy del cliente può bloccare `huggingface.co` o i suoi host di download. Va provato presto (T0), non in aula. Piano B: copia dei pesi su disco o su un server locale del formatore, caricata con `env.localModelPath` di Transformers.js (non viola RNF5, che riguarda il repository).
- **Precisione numerica.** La memorizzazione del dataset è stata calcolata su GPU, non in fp32 su WASM. Su token quasi a pari probabilità l'argmax può cambiare anche in fp32. È già coperto da CA1 e va spiegato in aula come limite.
- **Un solo thread su GitHub Pages.** I thread WASM richiedono l'isolamento cross-origin (header COOP e COEP), che GitHub Pages non permette di impostare. ONNX Runtime girerà quindi su un solo thread. Va misurato in T13 e, se i tempi non bastano, si valuta un service worker che aggiunge gli header (es. `coi-serviceworker`), con le relative verifiche su CA5.
- **Versioni.** Transformers.js va fissato a una versione esatta (nessun `@latest`), che scarica anche i file WASM di ONNX Runtime da CDN: gli host attesi vanno elencati per CA5.

### 1.4 Decisioni richieste a Pietro prima di T3

| ID | Decisione | Default proposto |
| --- | --- | --- |
| D2 | Pubblicazione di `site/` | **decisa:** workflow Actions, sorgente Pages già impostata (27/11) |
| D4 | Scenario d'aula | (a) demo del formatore per B e C (1.2.1) |
| D5 | Testi nel CSV | esclusi di default (1.2.3) |
| D6 | Campione anche da `deduped.70m` | **decisa:** sì, 10 + 10 (1.2.6) |

---

## 2. Task

Formato: obiettivo · file · fatto quando · criteri di riferimento. Ogni task è indipendente nel branch e si chiude con una pull request.

### T0 — Prova di fattibilità della rete
Strumento pronto: `site/netcheck.html` (Claude Code, 27/11). Resta a Pietro aprirlo **dalla rete del cliente** (o da una rete aziendale simile), copiare il risultato nella tabella di `docs/test-report.md` e passarlo al capo progetto.
**Fatto quando:** esito scritto in `docs/test-report.md`. Se qualcosa è bloccato, chiedere al reparto IT del cliente di autorizzare gli host elencati nel report, oppure aprire un task per il piano B prima di T5. · CA5, RNF1

### T1 — Protezioni sui dati
**Stato (27/11):** completato da Vibe (PR #3) e corretto dal capo progetto dopo la revisione. Le correzioni sono: blocco di ogni voce `memorized` anche senza `expected_ids`, blocco di `.jsonl`, `.csv` e `.tsv`, lettura del contenuto in stage, controllo commit per commit nelle PR e nei push, deploy del commit verificato e solo da eventi `push`, test automatici in `tests/test_check_no_pile.sh`. Il marcatore «estratto» per `docs/` scelto da Vibe è confermato (#16). Correzioni unite con la PR #5; resta l'hook pre-push (#18).

- `.gitignore`: `data/`, `*.prefixes.json`, `__pycache__/`, `.venv/`.
- `scripts/check_no_pile.sh`: fallisce se tra i file da controllare (quelli in stage nel pre-commit, tutti i file versionati in CI) c'è (a) un file sotto `data/`, oppure (b) un file `.json` che contiene una voce con `"type": "memorized"`. Con `--tree` controlla l'intero albero versionato. Messaggio di errore in italiano che dice quale file e quale regola. Per i testi in `docs/` vale il marcatore «estratto» (K3).
- Fixture di prova in `tests/fixtures/`: un JSON sintetico con `"type": "memorized"` (deve far fallire lo script) e uno con soli `"type": "control"` (deve passare). La fixture che fallisce va esclusa dal controllo con un elenco esplicito di eccezioni nello script, limitato a `tests/fixtures/`.
- Hook `pre-commit` (configurazione in `.pre-commit-config.yaml` o `scripts/install-hooks.sh`) che lancia lo script.
- `.github/workflows/check-data.yml`: su `push` e `pull_request`, esegue `scripts/check_no_pile.sh --tree` e i test dello script sulle fixture. Nome del job: `check-data` (serve per la regola di protezione di `main`).
- `.github/workflows/pages.yml`: su `push` a `main`, un job che riesegue il controllo e un job di deploy che dipende dal primo (`needs`), con `actions/upload-pages-artifact` sulla sola cartella `site/` e `actions/deploy-pages`. Azioni fissate a una versione maggiore esplicita. Finché `site/` non esiste, il deploy pubblica un `site/index.html` provvisorio («Lab in preparazione»), creato in questo task (K2).
- L'hook pre-commit protegge solo i commit fatti sul computer di Pietro; quelli dell'agente remoto passano solo dalla CI. Per questo il merge su `main` deve richiedere che `check-data` sia verde (regola di protezione del branch).
**Fatto quando:** lo script fallisce sulla fixture `memorized` e su un `data/x.json` creato in una cartella temporanea, e passa sull'albero del repository; il workflow `check-data` è verde sulla PR del task; dopo il merge la pagina provvisoria è online. · CA8, K2

### T2 — Script di preparazione dei prefissi
**Stato (28/11):** implementato da Vibe (PR #4), corretto dopo la revisione. Le correzioni sono: dataset `EleutherAI/pythia-memorized-evals` al posto del repository del modello, campi `tokens` e `index` del dataset (l'`index` è quello di addestramento, non la posizione della riga), testo decodificato prima dei filtri, entrambi gli split di default (D6 = sì), `--finalize` che rifiuta voci memorizzate rivedute ma non riprodotte da PyTorch, test Python in CI. Correzioni unite con la PR #5; resta l'errore su output vuoto di `--finalize` (#8). Da eseguire in locale da Pietro (T3).

`scripts/prepare_prefixes.py`, `scripts/requirements.txt` (versioni fissate: `datasets`, `transformers`, `torch` CPU).
1. Argomenti: `--split` (ripetibile: `duped.70m`, `deduped.70m`), `--n` (default 200 per split), `--seed` (default 42), `--out data/candidates.json`, `--finalize`.
2. Carica lo split, campiona con seme fisso.
3. Controllo QA2: confronto dei tokenizer `pythia-70m` e `pythia-1.4b` (vedi 1.3); in caso di differenza esce con errore.
4. Decodifica con il tokenizer di `EleutherAI/pythia-70m`.
5. Filtri automatici: email, URL (tutti), telefoni, sequenze di ≥ 8 cifre, meno di 16 token distinti su 64. Conta gli scarti per motivo e li stampa.
6. Controllo QA3: per ogni candidato rimasto, generazione greedy di 32 token con `EleutherAI/pythia-70m` (per `duped.70m`) o `pythia-70m-deduped` (per `deduped.70m`), `revision="step143000"`, in fp32. Campo `reproduced_pytorch: true/false`. Se la quota è sotto il 95 %, avviso esplicito.
7. Scrive `data/candidates.json` nel formato della sezione 5 della spec, con `reviewed: false`, `notes: ""`, `reproduced_pytorch`.
8. `--finalize`: legge `data/candidates.json`, tiene solo `reviewed: true`, verifica che ogni voce abbia 32 + 32 ID, che `prefix_text`/`expected_text` corrispondano alla decodifica, e scrive `data/prefixes.json`. Esce con errore se c'è anche una sola voce non riveduta nell'output (CA7).
9. Opzione `--controls scripts/controls_source.json`: tokenizza i controlli e scrive `site/controls.json` (vedi T4).
**Fatto quando:** eseguito due volte con lo stesso seme produce file identici; `--finalize` su un file con una voce `reviewed: false` la esclude e su un file manomesso esce con errore. · CA7, QA2, QA3

### T3 — Revisione manuale (Pietro)
Scegliere circa 20 voci (o 10 + 10 se D6), leggibili, senza dati personali, con `reproduced_pytorch: true`. Impostare `reviewed: true` e una nota. Lanciare `--finalize`.
**Fatto quando:** esiste `data/prefixes.json` con circa 20 voci, mai committato. · CA7

### T4 — Prefissi di controllo
`scripts/controls_source.json`: 5-8 testi inventati in inglese (il modello è addestrato sull'inglese), stile simile alle voci memorizzate (prosa, codice, elenco), ciascuno lungo almeno 64 token. Non devono essere citazioni o testi noti. Generazione di `site/controls.json` con T2 punto 9: `type: "control"`, `split: null`, `index: null`, 32 + 32 ID.
**Fatto quando:** `site/controls.json` è valido e versionato; nessun controllo è una frase reperibile online (verifica a campione di Pietro). · CA2, RF5

### T5 — Scheletro della pagina e caricamento dei modelli
`site/index.html`, `site/app.js` (modulo ES), `site/style.css`. Stile autonomo, nessun font o CSS esterno.
- Transformers.js da CDN a **versione esatta**, `device: 'wasm'`, WebGPU disattivato.
- Selettore della variante (`dtype`: `fp32`, `q8`, e le altre disponibili) per CA1.
- Stato per modello: in attesa, download con percentuale (`progress_callback`), pronto, errore con messaggio comprensibile.
- Caricamento su richiesta: un modello alla volta di default; opzione «carica entrambi» (RF1 resta aperta fino a T11).
- Nessun cookie, analytics, font esterni o altre richieste (CA5). Gli host attesi sono elencati in un commento in testa ad `app.js`.
**Fatto quando:** i due modelli si caricano in Chrome, Edge e Firefox, lo stato è visibile e la scheda Rete mostra solo CDN della libreria e host di Hugging Face. · RF1, RNF1, RNF2, RNF5, CA5

### T6 — Caricamento dei prefissi
Nota di formato (PR #28): `reproduced_pytorch` è un booleano nelle voci `memorized` e un oggetto `{"duped": bool, "deduped": bool}` nei controlli, che hanno anche `matching_tokens` con le stesse chiavi. La validazione deve accettare entrambe le forme; i campi servono solo alla vista del formatore.
Selettore di file e trascinamento di `prefixes.json`; validazione dello schema (campi, 32 + 32 interi, `reviewed: true`) con errori in italiano; lettura con `FileReader`, nessun invio, nessun salvataggio in `localStorage`. Senza file: elenco con i soli controlli.
**Fatto quando:** un file valido popola l'elenco; un file malformato mostra l'errore senza bloccare la pagina; la scheda Rete non mostra richieste al caricamento. · RF0, RNF1

### T7 — Modalità B
- Il modello riceve `input_ids` (tensore `int64`, forma `[1, 32]`) e `attention_mask` di uno, mai il testo ricodificato. Generazione con `do_sample: false`, `num_beams: 1`, `max_new_tokens: 32`, parametri espliciti. Le sequenze del Pile contengono token EOS tra un documento e l'altro: la generazione **non deve fermarsi** su EOS e **non deve sopprimerlo**. Quindi non usare `min_new_tokens` (sopprime EOS e cambia l'argmax); disattivare invece il criterio di arresto su EOS nella versione fissata della libreria e documentare come.
- Confronto sugli ID: corrispondenza esatta sì/no, numero di token iniziali coincidenti (lunghezza del prefisso comune, 0-32).
- Vista affiancata atteso/generato con evidenziazione per token; decodifica robusta ai frammenti UTF-8 (1.2.10); spazi e a capo visibili.
- Funzione di confronto pura, in un modulo separato, con test minimi eseguibili nel browser (`site/tests.html`) o con Node.
**Fatto quando:** su un prefisso noto il risultato coincide con `reproduced_pytorch`; i test della funzione di confronto passano (identici, primo token diverso, ultimo token diverso). · RF3, CA2

### T8 — Vista del formatore
Interruttore, spento di default, che mostra per ogni voce `type`, `split`, `index`, `notes`. A interruttore spento controlli e voci memorizzate sono indistinguibili nell'elenco (stesso formato di id, ordine mescolato con seme fisso).
**Fatto quando:** a interruttore spento nessun elemento visibile distingue i controlli. · RF5, RF7

### T9 — Modalità A
Campo libero, «Genera», 32 token greedy con gli stessi parametri di T7; output separato dal prompt. Messaggio didattico breve: senza sapere che cosa cercare, l'output non dice se è memorizzato.
**Fatto quando:** funziona con entrambi i modelli; il testo libero non viene inviato da nessuna parte. · RF2

### T10 — Modalità C
Stesso prefisso (ID) eseguito sui due modelli, risultati affiancati con l'evidenziazione di T7. Se è caricato un solo modello, i due si eseguono in sequenza, liberando il primo (`dispose()`) se l'opzione di memoria lo richiede. Riquadro fisso: 463.953 e 411.448, link alla scheda del dataset, una frase che dica che la differenza è circa dell'11 % e che gli indici non sono confrontabili. Se D6: etichetta dello split di origine visibile solo nella vista del formatore.
**Fatto quando:** CA3 verificato manualmente sugli stessi prefissi. · RF4, CA3

### T11 — Registro e esportazione
Registro in memoria con i campi di RF6 più `variante` (`dtype`). Esportazione CSV UTF-8 con BOM, separatore `,`, campi tra virgolette, neutralizzazione delle formule (1.2.5). Pulsante «Copia per il foglio» (TSV). Opzione «escludi testi» secondo D5. Avviso prima di chiudere se il registro non è vuoto.
**Fatto quando:** il file si apre correttamente in Google Fogli ed Excel con impostazioni italiane, con accenti corretti; un output che inizia con `=` resta testo. · RF6, CA4

### T12 — Accessibilità
Navigazione completa da tastiera, focus visibile, etichette sui controlli, `aria-live` per gli stati di caricamento e per l'esito della generazione, evidenziazione non affidata solo al colore (es. sottolineatura o simbolo), contrasto AA. Testi in italiano semplice.
**Fatto quando:** l'intero flusso B si esegue senza mouse; controllo del contrasto superato. · RNF6

### T13 — Test e report (Pietro, con supporto di Claude Code)
`docs/test-report.md`, senza testi del Pile (K3):
- CA1: tabella variante × quota di riproduzione esatta (su 20, e per gruppo se D6), confrontata con `reproduced_pytorch`.
- CA2: esito su tutti i controlli.
- CA3, CA4, CA5 (elenco degli host osservati), CA6 (modalità aereo, con e senza `prefixes.json` già caricato).
- RNF3: tre portatili (modello, RAM, browser), tempi di primo caricamento, di caricamento da cache e di generazione per 32 token, memoria usata con uno e con due modelli. Da qui si decide RF1.
**Fatto quando:** tutte le righe compilate, decisione su RF1 e sulla variante del pilota scritta nel report. · CA1-CA6, RNF3, RNF4

### T14 — Documentazione
Riscrivere `README.md` in italiano (scopo, uso in aula, fonti, limiti, nota su D1) con link alla spec. Aggiornare la spec a v0.3 con le decisioni D2, D4-D6.
**Fatto quando:** README e spec coerenti con quanto implementato. · —

---

## 3. Ordine e dipendenze

```
T0 ─┐
T1 ─┼─> T2 ─> T3 ─────────────┐
    │    └──> T4 ─────────────┤
    └──> T5 ─> T6 ─> T7 ─> T8 ┼─> T9 ─> T10 ─> T11 ─> T12 ─> T13 ─> T14
```

T1 va fatto **prima** di qualunque file in `data/`. T5-T7 possono partire con i soli controlli mentre Pietro fa T3.
