# Report dei test — Sprint 1

Nessun testo del Pile in questo file: solo id, conteggi, quote e tempi (vedi `docs/tasks.md`, K3).

## T0 — Fattibilità della rete

**Strumento:** `site/netcheck.html`, pubblicato su <https://trainingdataextraction.monaripietro.it/netcheck.html>, oppure da aprire in locale facendo doppio clic sul file scaricato. Controlla:
- il browser: WebAssembly, isolamento cross-origin (thread), core, memoria, Cache API, spazio disponibile;
- `huggingface.co`: elenco dei file dei due modelli, `config.json`, primi 1024 byte del file ONNX più piccolo, con l'host che lo serve dopo il reindirizzamento;
- `cdn.jsdelivr.net`: un file del pacchetto Transformers.js;
- su richiesta, la velocità di download di un file ONNX completo (circa 70 MB).

**Variante da riga di comando:** `scripts/netcheck.py`, solo libreria standard di Python. Verifica la rete ma non il browser, quindi non sostituisce `netcheck.html` sulla rete del cliente. La procedura con conda è nell'intestazione dello script.

**Host da far autorizzare al reparto IT del cliente se qualcosa risulta bloccato:**
- `huggingface.co`;
- l'host di download dei file grandi a cui Hugging Face reindirizza: la pagina lo riporta in «servito da». Il 28/11 era `us.aws.cdn.hf.co`; può cambiare con la regione, quindi va riletto dalla prova sulla rete del cliente;
- `cdn.jsdelivr.net`;
- l'host della pagina: `trainingdataextraction.monaripietro.it` (dominio personalizzato di GitHub Pages, dal 28/11).

**Verifica del 27/11/2026 nell'ambiente di sviluppo (non rappresentativo):** la pagina funziona senza errori e segnala correttamente come bloccati gli host non raggiungibili, perché quell'ambiente li blocca. Il caso positivo (host raggiungibili) è da confermare sulla prima esecuzione reale.

### Esecuzioni

| Data | Rete | Computer e browser | Hugging Face | Host di download | jsDelivr | Velocità | Esito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | rete del cliente | | | | | | |
| 28/11/2026 | rete di casa (controllo) | Mac, Chrome 158; `site/netcheck.html` da localhost | OK (170–240 ms) | OK, `us.aws.cdn.hf.co` (0,7–1,1 s) | OK (274 ms) | 2,5 MB/s (71 MB in 28,2 s) | tutti raggiungibili; WASM sì, thread no, Cache API sì, circa 2000 MB di spazio per la cache |
| 28/11/2026 | rete di casa (controllo) | Mac arm64, macOS 27.2.1; `scripts/netcheck.py`, Python 3.12 (non browser) | OK (240–450 ms) | OK, `us.aws.cdn.hf.co` (circa 1,2 s) | OK (184 ms) | 4,1 MB/s (71 MB in 17,3 s) | tutti raggiungibili |

**Stato di T0 (28/11):** righe di controllo compilate, da riga di comando e da browser. Con 4,1 MB/s il primo download di un modello quantizzato (circa 70 MB) richiede circa 20 s; quello di un modello fp32 (circa 290 MB) poco più di un minuto. Resta da fare la prova **dalla rete del cliente** con `site/netcheck.html`.

**File ONNX disponibili (28/11, identici per i due modelli):** `onnx/model_quantized.onnx` circa 71 MB (variante `q8`), `onnx/model.onnx` circa 282 MB (`fp32`); presenti anche `int8`, `uint8`, `fp16`, `q4`, `q4f16`, `bnb4` e le versioni `decoder_*`.

**Se l'esito è negativo:** aprire il task del piano B prima di T5. Il piano B consiste nel servire i file del modello dal portatile del formatore o da un server interno, configurando `env.localModelPath` in Transformers.js.

## T3 — Preparazione dei prefissi

**Prima esecuzione (28/11, Mac, Python 3.12, versione di `main` precedente a #45):** 400 righe campionate (200 per split); scartate 124 (email 3, URL 32, sequenze di cifre 4, telefoni 41, meno di 16 token distinti 44); 276 candidati; **200 riprodotti da PyTorch (72 %)**, fp32, revisione `step143000`. Cache di Hugging Face cresciuta fino a 26 GB perché quella versione scaricava e convertiva tutti gli split (corretto con #45 e #50).

**Lettura:** il 72 % è inferiore all'atteso (vicino al 100 %, per come il dataset definisce la memorizzazione). Non blocca T3: la revisione usa solo voci con `reproduced_pytorch: true`, cioè memorizzate dal modello del lab. Le cause possibili (precisione numerica, versione v0 dei modelli, differenze tra split) si distinguono con `--recheck` (#54). Fino ad allora il dato va presentato in aula come limite, non nascosto.

| Configurazione `--recheck` | duped.70m | deduped.70m | Totale |
| --- | --- | --- | --- |
| fp32, `step143000` | | | 200/276 (72 %) |
| float16, `step143000` | | | |
| fp32, modelli `-v0` | | | |

## Sprint 2: prove nel browser

| Data | Issue | Browser | Esito |
| --- | --- | --- | --- |
| 28/11/2026 | #33 (PR #42) | Chrome 158, Mac, localhost | generazione di 32 ID riuscita su prefisso sintetico (controls.json non ancora generato); percentuale di caricamento errata → #46; Edge, Firefox, `fp32` e scheda Rete da verificare |

## CA1-CA6, RNF3

Da compilare in T13.
