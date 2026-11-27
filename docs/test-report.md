# Report dei test — Sprint 1

Nessun testo del Pile in questo file: solo id, conteggi, quote e tempi (vedi `docs/tasks.md`, K3).

## T0 — Fattibilità della rete

**Strumento:** `site/netcheck.html`. Pubblicato su GitHub Pages dopo il merge di T1, oppure da aprire in locale facendo doppio clic sul file scaricato. Controlla:
- il browser: WebAssembly, isolamento cross-origin (thread), core, memoria, Cache API, spazio disponibile;
- `huggingface.co`: elenco dei file dei due modelli, `config.json`, primi 1024 byte del file ONNX più piccolo, con l'host che lo serve dopo il reindirizzamento;
- `cdn.jsdelivr.net`: un file del pacchetto Transformers.js;
- su richiesta, la velocità di download di un file ONNX completo (circa 70 MB).

**Host da far autorizzare al reparto IT del cliente se qualcosa risulta bloccato:**
- `huggingface.co`;
- l'host di download dei file grandi a cui Hugging Face reindirizza: la pagina lo riporta in «servito da»;
- `cdn.jsdelivr.net`;
- l'host della pagina (`*.github.io` o il dominio personalizzato).

**Verifica del 27/11/2026 nell'ambiente di sviluppo (non rappresentativo):** la pagina funziona senza errori e segnala correttamente come bloccati gli host non raggiungibili, perché quell'ambiente li blocca. Il caso positivo (host raggiungibili) è da confermare sulla prima esecuzione reale.

### Esecuzioni

| Data | Rete | Computer e browser | Hugging Face | Host di download | jsDelivr | Velocità | Esito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | rete del cliente | | | | | | |
| | rete di casa o ufficio (controllo) | | | | | | |

**Se l'esito è negativo:** aprire il task del piano B prima di T5. Il piano B consiste nel servire i file del modello dal portatile del formatore o da un server interno, configurando `env.localModelPath` in Transformers.js.

## CA1-CA6, RNF3

Da compilare in T13.
