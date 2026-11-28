# Report dei test — Sprint 1

Nessun testo del Pile in questo file: solo id, conteggi, quote e tempi (vedi `docs/tasks.md`, K3).

## T0 — Fattibilità della rete

**Strumento:** `site/netcheck.html`. Pubblicato su GitHub Pages dopo il merge di T1, oppure da aprire in locale facendo doppio clic sul file scaricato. Controlla:
- il browser: WebAssembly, isolamento cross-origin (thread), core, memoria, Cache API, spazio disponibile;
- `huggingface.co`: elenco dei file dei due modelli, `config.json`, primi 1024 byte del file ONNX più piccolo, con l'host che lo serve dopo il reindirizzamento;
- `cdn.jsdelivr.net`: un file del pacchetto Transformers.js;
- su richiesta, la velocità di download di un file ONNX completo (circa 70 MB).

**Variante da riga di comando:** `scripts/netcheck.py`, solo libreria standard di Python. Verifica la rete ma non il browser, quindi non sostituisce `netcheck.html` sulla rete del cliente. La procedura con conda è nell'intestazione dello script.

**Host da far autorizzare al reparto IT del cliente se qualcosa risulta bloccato:**
- `huggingface.co`;
- l'host di download dei file grandi a cui Hugging Face reindirizza: la pagina lo riporta in «servito da». Il 28/11 era `us.aws.cdn.hf.co`; può cambiare con la regione, quindi va riletto dalla prova sulla rete del cliente;
- `cdn.jsdelivr.net`;
- l'host della pagina (`*.github.io` o il dominio personalizzato).

**Verifica del 27/11/2026 nell'ambiente di sviluppo (non rappresentativo):** la pagina funziona senza errori e segnala correttamente come bloccati gli host non raggiungibili, perché quell'ambiente li blocca. Il caso positivo (host raggiungibili) è da confermare sulla prima esecuzione reale.

### Esecuzioni

| Data | Rete | Computer e browser | Hugging Face | Host di download | jsDelivr | Velocità | Esito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | rete del cliente | | | | | | |
| 28/11/2026 | rete di casa (controllo) | Mac arm64, macOS 27.2.1; `scripts/netcheck.py`, Python 3.12 (non browser) | OK (240–450 ms) | OK, `us.aws.cdn.hf.co` (circa 1,2 s) | OK (184 ms) | 4,1 MB/s (71 MB in 17,3 s) | tutti raggiungibili |

**Stato di T0 (28/11):** riga di controllo compilata. Con 4,1 MB/s il primo download di un modello quantizzato (circa 70 MB) richiede circa 20 s; quello di un modello fp32 (circa 290 MB) poco più di un minuto. Restano da fare la prova **dalla rete del cliente** e la prova **nel browser** con `site/netcheck.html`, che controlla anche WebAssembly, cache e CORS.

**Se l'esito è negativo:** aprire il task del piano B prima di T5. Il piano B consiste nel servire i file del modello dal portatile del formatore o da un server interno, configurando `env.localModelPath` in Transformers.js.

## CA1-CA6, RNF3

Da compilare in T13.
