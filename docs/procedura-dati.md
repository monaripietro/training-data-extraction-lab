# Procedura in caso di pubblicazione accidentale di estratti del Pile

Vale per qualsiasi file con testi o ID di token del Pile (`data/`, export del registro, report) arrivato su GitHub, anche solo su un branch o in una PR chiusa. Riferimenti: decisione D1, criterio CA8.

## Subito (entro un'ora)

1. **Non fare altri push** sul branch interessato e non aprire PR da esso.
2. **Annota** il commit, il branch, l'eventuale numero della PR e i file coinvolti. Non copiare i contenuti in issue, chat o email.
3. **Elimina il branch remoto**: `git push origin --delete <branch>`. Se una PR era aperta, chiudila senza merge.
4. Se l'estratto è arrivato su `main`: **disattiva temporaneamente GitHub Pages** (Settings → Pages) se il file era sotto `site/`, poi riscrivi la cronologia di `main` in locale (`git rebase -i` o `git filter-repo --path <file> --invert-paths`) e fai un force push. È l'unico caso in cui il force push su `main` è ammesso; rimetti poi la protezione del branch.

## Dopo

5. **Chiedi a GitHub Support** la rimozione dei dati in cache: commit non più referenziati, viste delle PR, fork. Usa il modulo per la rimozione di dati sensibili. Fino ad allora il commit resta raggiungibile tramite il suo SHA.
6. **Verifica** con `bash scripts/check_no_pile.sh --tree` su `main` e, quando disponibile, con `--range` sull'intervallo interessato.
7. **Registra l'incidente** in `docs/test-report.md`, sezione «Incidenti»: data, tipo di file, durata dell'esposizione, azioni svolte. Nessun contenuto.
8. **Apri un'issue per il capo progetto** che spieghi quale barriera non ha funzionato (pre-commit, pre-push, CI), senza contenuti, così da correggerla.

## Prevenzione

- Hook installati sul clone locale: `bash scripts/install-hooks.sh` (pre-commit e pre-push). Da rieseguire dopo ogni modifica dello script.
- Mai `git commit --no-verify` né `git push --no-verify`: saltano gli hook. Con `--no-verify` sul commit, il pre-push blocca comunque; con `--no-verify` sul push resta solo la CI, che interviene quando il file è già pubblico.
- La cache di Hugging Face sul computer del formatore contiene il dataset con gli estratti: resta fuori dal repository e, dopo il pilota, si può svuotare con `huggingface-cli delete-cache`.
- `data/` resta in `.gitignore`; mai `git add -f` su file di `data/`.
- Le sessioni di Claude Code e di Vibe non leggono `data/` (`CLAUDE.md`, `AGENTS.md`).
