# Istruzioni per la sessione locale di Claude Code

Questa sessione gira sul computer di Pietro e serve a **eseguire** prove e script che richiedono la rete o i dati locali. Non sviluppa: il codice lo scrive Mistral Vibe (vedi `AGENTS.md`), il piano e le revisioni li cura il capo progetto (`docs/tasks.md`).

## Regole

1. **Non aprire, leggere, cercare o mostrare file in `data/`.** Contengono estratti del Pile che non devono lasciare questo computer (decisione D1), nemmeno verso il modello di questa sessione. Vale anche per `grep`, `cat`, `head`, `jq` e simili, e per l'output degli script che stampano quei testi. Puoi controllare solo che un file esista e quante voci contiene (es. `python -c "import json;print(len(json.load(open('data/candidates.json'))))"`).
   La stessa regola vale per la **cache di Hugging Face** (`~/.cache/huggingface/datasets` e `~/.cache/huggingface/hub/datasets--EleutherAI--pythia-memorized-evals`), che contiene il dataset con gli estratti: puoi misurarne la dimensione (`du -sh`), non leggerne o elencarne il contenuto. Rimuovere l'ambiente conda non svuota la cache: è voluto, così una seconda esecuzione non riscarica tutto.
2. **Non modificare file versionati e non fare commit né push**, salvo richiesta esplicita di Pietro. Se una prova fallisce per un difetto del codice, descrivi il problema: lo segnala il capo progetto a Vibe con un'issue.
3. **Ambienti Python con conda**, uno per prova, da rimuovere alla fine anche se la prova fallisce:
   ```bash
   conda create -y -n <nome> python=3.12
   conda run -n <nome> pip install -r scripts/requirements.txt   # solo se serve
   conda run -n <nome> python <script> ...
   conda env remove -y -n <nome>
   ```
4. Prima di ogni prova: `git checkout main && git pull`, poi `bash scripts/install-hooks.sh` (modifica solo `.git/hooks`, non file versionati), salvo diversa indicazione.
5. **Riporta sempre** l'output completo della console (che non deve contenere testi del Pile), i comandi eseguiti, il sistema operativo e le versioni usate. Pietro lo inoltra al capo progetto.

## Attività dalla dashboard

Quando Pietro scrive «Esegui le attività `chi:locale` della dashboard», leggi le issue aperte con l'etichetta `chi:locale` (il repository è pubblico: `curl -s "https://api.github.com/repos/monaripietro/training-data-extraction-lab/issues?labels=chi:locale&state=open"`). Per ciascuna, esegui il prompt contenuto nel corpo dell'issue rispettando le regole sopra. Poi prepara per Pietro un commento con l'esito (solo numeri e id) da incollare nell'issue: non hai credenziali per scriverlo tu.

## Prove previste

| Task | Cosa | Riferimento |
| --- | --- | --- |
| T0 | Verifica di rete da riga di comando | intestazione di `scripts/netcheck.py` |
| T2/T3 | Preparazione dei candidati (dopo la chiusura dell'issue #8) | `scripts/prepare_prefixes.py --help` |
| T4 | Generazione di `site/controls.json` | `prepare_prefixes.py --controls` |
