# Spec — Lab estrazione dati, livello base

Versione 0.3 · 28 novembre 2026 · Autore: Pietro Monari, con il capo progetto (Claude Code)
Sostituisce `docs/SPEC-sprint1.md` (v0.2), che resta come storico.
Implementazione: Mistral Vibe. Licenza: Apache-2.0. Repository pubblico.

**Questo documento è la fonte di verità.** Se un'issue o `docs/tasks.md` lo contraddicono, vale questo documento; le modifiche passano da una nuova versione.

---

## 1. Prodotto

Una **webapp serverless**: HTML, CSS e JavaScript eseguiti interamente nel browser, pubblicati come file statici su GitHub Pages all'indirizzo <https://trainingdataextraction.monaripietro.it>. Nessun backend, nessuna API propria, nessun account.

I modelli linguistici (`Xenova/pythia-70m` e `Xenova/pythia-70m-deduped`, formato ONNX) vengono scaricati da Hugging Face ed **eseguiti nel browser** con Transformers.js su WebAssembly.

**Obiettivo didattico:** far vedere che un modello memorizza parti dei dati di addestramento, ma che l'estrazione riesce solo se si sa già che cosa cercare; mostrare l'effetto della deduplicazione e la differenza tra tentativo alla cieca e guidato. Pubblico: partecipanti di un corso aziendale, che non programmano.

### Confine del prodotto

| Componente | Dove gira | Ruolo |
| --- | --- | --- |
| `site/` | browser dei partecipanti e del formatore | **il prodotto** |
| `scripts/prepare_prefixes.py` | computer del formatore, offline, una tantum | prepara `prefixes.json` (dati del Pile) e `controls.json`; fornisce il riferimento PyTorch per CA1 |
| `scripts/check_no_pile.*`, hook, CI | computer del formatore e GitHub | impediscono che estratti del Pile entrino nel repository (D1) |
| `scripts/netcheck.py`, `site/netcheck.html` | qualunque computer | verifica di rete (T0) |

Lo script Python **non** è parte della webapp e non è richiesto ai partecipanti.

## 2. Fatti tecnici di riferimento

Verificati sulle fonti il 26/11/2026 (spec v0.2) e, dove indicato, il 28/11/2026.

- Pythia 70M: duped e deduped, stessi dati nello stesso ordine, checkpoint finale `step143000`, Apache-2.0.
- `EleutherAI/pythia-memorized-evals`: split `duped.70m` (463.953 righe) e `deduped.70m` (411.448). Ogni riga ha `index` (indice nella sequenza di addestramento) e `tokens` (64 token). «Memorizzata» = dati i primi 32 token, la continuazione greedy riproduce esattamente i 32 successivi. Gli `index` dei due split **non sono confrontabili**.
- Transformers.js esegue modelli ONNX nel browser con ONNX Runtime Web; greedy con `do_sample: false`, `num_beams: 1`.
- GitHub Pages non permette header COOP/COEP: ONNX Runtime gira su **un solo thread** (28/11).
- Rete di casa (28/11): `huggingface.co`, `us.aws.cdn.hf.co` (file grandi) e `cdn.jsdelivr.net` raggiungibili; 4,1 MB/s.

## 3. Decisioni

| ID | Decisione | Stato |
| --- | --- | --- |
| D1 | Gli estratti del Pile non si pubblicano. `prefixes.json` resta sul disco del formatore e la pagina lo carica dal disco. Nessun file versionato, `docs/` compreso, contiene testi del Pile: se in bozza ne serve uno, va in un blocco marcato «estratto», che il controllo CA8 blocca oltre i 200 caratteri. In caso di incidente: `docs/procedura-dati.md`. | decisa |
| D2 | Pubblicazione con GitHub Actions della sola cartella `site/`, dominio `trainingdataextraction.monaripietro.it`. | decisa |
| D3 | Licenza Apache-2.0. | decisa |
| D4 | **Scenario d'aula:** le modalità B e C (che richiedono `prefixes.json`) le esegue il formatore, proiettando; i partecipanti usano la modalità A sui propri portatili. | **adottata per accelerare**; Pietro può cambiarla fino all'inizio dello sprint 3 |
| D5 | **Testi nel CSV:** l'esportazione esclude per impostazione predefinita l'output del modello e il testo libero; un'opzione esplicita li include. | **adottata per accelerare**; come D4 |
| D6 | Prefissi: 10 da `duped.70m` e 10 da `deduped.70m`, eseguiti su entrambi i modelli. | decisa |
| D7 | Nessun passaggio di build: moduli ES caricati direttamente, nessun `npm` in produzione. Unica dipendenza esterna: Transformers.js da jsDelivr a versione esatta. | decisa |
| D8 | Variante ONNX predefinita: la quantizzata che passa CA1 con la quota più alta; finché CA1 non è misurato, `q8`. | provvisoria |

## 4. Requisiti funzionali

**RF0. Prefissi.** La pagina non contiene prefissi del Pile. Il formatore carica `prefixes.json` dal disco (selettore di file o trascinamento). Il file si legge solo nel browser con `FileReader`, senza invii, senza `localStorage`/`sessionStorage`/IndexedDB. Senza file sono disponibili la modalità A e i prefissi di controllo (`site/controls.json`, pubblico).

**RF1. Modelli.** Stato visibile per ciascun modello: in attesa, download con percentuale, pronto, errore con messaggio comprensibile. Caricamento su richiesta, un modello alla volta per impostazione predefinita; opzione «carica entrambi». Selettore della variante ONNX (almeno `fp32` e `q8`) visibile nella vista del formatore.

**RF2. Modalità A, alla cieca.** Testo libero, pulsante «Genera», 32 token greedy. Output separato dal prompt. Breve spiegazione: senza sapere che cosa cercare, l'output non dice se è memorizzato.

**RF3. Modalità B, prefissi noti.** Elenco dei prefissi (caricati e di controllo). Il modello riceve **gli ID** del prefisso, non testo ricodificato, e genera 32 token greedy. La pagina mostra: atteso e generato affiancati; evidenziazione token per token; «Corrispondenza esatta: sì/no» calcolata sugli ID; numero di token iniziali coincidenti (0–32).

**RF4. Modalità C, confronto.** Stesso prefisso su entrambi i modelli, risultati affiancati con l'evidenziazione di RF3. Riquadro fisso con 463.953 e 411.448 sequenze memorizzate, link alla fonte, nota che la differenza è di circa l'11 % e che gli indici non sono confrontabili.

**RF5. Controlli.** I prefissi di controllo sono indistinguibili dagli altri fuori dalla vista del formatore (stesso formato di id, ordine mescolato con seme fisso).

**RF6. Registro.** Ogni tentativo resta in memoria con: ora, modalità, modello, variante, id del prefisso o testo libero, output, corrispondenza esatta, token coincidenti. Esportazione CSV (UTF-8 con BOM, separatore `,`, campi tra virgolette, formule neutralizzate) e pulsante «Copia per il foglio» (TSV). Testi esclusi di default (D5). Avviso prima di chiudere la pagina se il registro non è vuoto.

**RF7. Vista del formatore.** Interruttore, spento di default: mostra tipo, `split`, `index`, note, `reproduced_pytorch`, `matching_tokens` e il selettore della variante.

## 5. Requisiti non funzionali

- **RNF1 Privacy.** Richieste di rete solo verso: dominio della pagina, `cdn.jsdelivr.net`, `huggingface.co` e i suoi host di download (`*.hf.co`). Nessun cookie, analytics, font o CSS esterni.
- **RNF2 Browser.** Chrome, Edge e Firefox desktop recenti. WASM; WebGPU disattivato.
- **RNF3 Prestazioni.** Tempi di primo caricamento, caricamento da cache e generazione di 32 token misurati su tre portatili (`docs/test-report.md`). Nessuna soglia fissa: decide Pietro.
- **RNF4 Offline.** Ipotesi: dopo il primo caricamento funziona senza rete grazie alla cache del browser. Va verificata (CA6).
- **RNF5 Pesi** mai nel repository.
- **RNF6 Accessibilità.** Italiano semplice e corretto (accenti compresi), uso completo da tastiera, focus visibile, `aria-live` per stati ed esiti, informazione mai affidata solo al colore, contrasto AA.
- **RNF7 Qualità del codice.** La logica che non tocca DOM né modelli (confronto, validazione, CSV, mescolamento) sta in moduli puri, testati con `node --test` in CI.

## 6. Architettura della webapp

```
site/
├── index.html          struttura, testi, nessuna logica inline
├── style.css
├── app.js              avvio e collegamento dei moduli
├── lib/
│   ├── models.js       caricamento e generazione (Transformers.js)
│   ├── prefixes.js     lettura e validazione di prefixes.json e controls.json   [puro]
│   ├── compare.js      confronto per ID, prefisso comune, segmenti per l'evidenziazione   [puro]
│   ├── tokens.js       decodifica robusta ai frammenti UTF-8   [puro, riceve il tokenizer]
│   ├── log.js          registro, CSV, TSV, neutralizzazione formule   [puro]
│   └── ui.js           rendering e accessibilità
├── controls.json       generato da prepare_prefixes.py --controls
└── netcheck.html
tests/js/               test node --test dei moduli puri
```

**Generazione:** tensore `int64` `[1, 32]` di `input_ids` con `attention_mask` di uno; `do_sample: false`, `num_beams: 1`, `max_new_tokens: 32` espliciti. Il Pile contiene token EOS tra documenti: la generazione **non si ferma** su EOS e **non lo sopprime** (niente `min_new_tokens`). Il modo esatto con la versione fissata di Transformers.js va verificato e documentato in `models.js`.

**Formato dei dati** (`prefixes.json` e `controls.json`): elenco di voci con `id`, `type` (`memorized` | `control`), `split`, `index`, `prefix_ids` (32 interi), `expected_ids` (32 interi), `prefix_text`, `expected_text`, `reviewed: true`, `notes`. Facoltativi: `reproduced_pytorch` (booleano nelle voci memorizzate, oggetto `{duped, deduped}` nei controlli), `matching_tokens` (oggetto `{duped, deduped}`), `style`.

## 7. Criteri di accettazione

| ID | Criterio | Verifica |
| --- | --- | --- |
| CA1 | Per `fp32` e almeno una variante quantizzata, quota dei 20 prefissi memorizzati riprodotti esattamente nel browser, confrontata con `reproduced_pytorch` | tabella in `docs/test-report.md` |
| CA2 | Nessun controllo con corrispondenza esatta di 32 token | modalità B su tutti i controlli; già verificato in PyTorch da `--controls` |
| CA3 | Modalità C affiancata sugli stessi prefissi | prova manuale |
| CA4 | CSV corretto in Google Fogli ed Excel con impostazioni italiane, accenti compresi; una cella che inizia con `=` resta testo | prova manuale |
| CA5 | Solo le richieste di rete di RNF1 | scheda Rete degli strumenti di sviluppo |
| CA6 | Comportamento offline documentato | modalità aereo |
| CA7 | `prefixes.json` contiene solo voci rivedute e riprodotte da PyTorch | `--finalize` |
| CA8 | Nessun estratto del Pile nel repository | hook pre-commit e pre-push, CI |
| CA9 | Tutte le funzioni dei moduli puri coperte da test `node --test` in CI | CI verde |
| CA10 | Flusso completo della modalità B eseguibile solo da tastiera | prova manuale |

## 8. Piano degli sprint

| Sprint | Contenuto | Uscita |
| --- | --- | --- |
| 1 (chiuso) | Protezioni dati, script dei prefissi, controlli, verifica di rete | `main` del 28/11 |
| **2** | Webapp: scheletro, caricamento modelli, prefissi, modalità B, vista del formatore | modalità B funzionante su controlli e prefissi locali; prima misura di CA1 |
| **3** | Modalità A e C, registro ed esportazione, accessibilità, README | prodotto completo per il pilota |
| Test | T3 (prefissi reali), misure CA1–CA6, RNF3 | in parallelo agli sprint 2 e 3, a cura di Pietro |

Il dettaglio dei task e delle issue è in `docs/tasks.md`.

## 9. Fuori ambito

Server o API proprie, account, analytics, fine-tuning, RAG, interfaccia in altre lingue, modelli in italiano, WebGPU, supporto mobile.
