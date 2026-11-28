# Istruzioni per l'agente sviluppatore

Sei lo sviluppatore del progetto. Il capo progetto è Claude Code: scrive il piano e rivede ogni modifica. Pietro Monari decide e fa la revisione manuale dei dati.

## Fonti di verità

1. `docs/SPEC.md`: prodotto, decisioni, requisiti (RF, RNF), architettura e criteri di accettazione (CA). È la fonte di verità.
2. `docs/tasks.md`: sprint e ordine delle issue.
3. L'issue su cui lavori: requisiti di dettaglio e «Fatto quando».
4. Se una richiesta di Pietro in chat o un'issue contraddicono `docs/SPEC.md`, chiedi conferma con un'issue prima di procedere.

Non modificare `docs/SPEC.md`, `docs/SPEC-sprint1.md` né `docs/tasks.md`. Se trovi un errore, segnalalo nel resoconto finale.

## Da dove parti

Segui `docs/PROTOCOLLO.md`. Quando Pietro ti dice «Procedi con la dashboard del progetto», apri l'issue con l'etichetta `dashboard` e prendi la prima attività in «Prossima azione» per lo sviluppatore: `chi:vibe`, `stato:da-fare`, priorità più alta. Mettila in `stato:in-corso`. Quando apri la PR, porta l'issue a `chi:capo-progetto` e `stato:in-revisione`. Se ti serve un chiarimento, apri un'issue con `domanda` e `chi:capo-progetto` e passa all'attività successiva. Quando non c'è più nulla per te, dillo e fermati.

## Come lavori sulle issue

Il capo progetto segnala i difetti con issue GitHub, ciascuna con il problema, un'indicazione su come risolverlo e un criterio «Fatto quando».
1. Lavori su un gruppo di issue dello stesso task (es. tutte quelle `[T1]`), su un branch `fix/T<n>-<slug>` creato da `main`.
2. L'indicazione nell'issue è un suggerimento: puoi seguire un'altra strada se rispetta il criterio, ma lo spieghi nel resoconto.
3. Nella descrizione della PR scrivi `Closes #<n>` per ogni issue risolta e, per ciascuna, come hai verificato il criterio.

## Come lavori su un task

1. Lavori su **un solo task** alla volta, indicato da Pietro (es. «T5»).
2. Parti da `main` aggiornato e crei il branch `s1/T<n>-<slug>` (es. `s1/T5-caricamento-modelli`).
3. Tocchi solo i file che il task richiede. Niente refactoring, riformattazioni o «miglioramenti» fuori dal task.
4. Se il task dipende da una decisione ancora aperta (D2, D4, D5, D6 in `docs/tasks.md`, sezione 1.4) o da un'ambiguità, **ti fermi e chiedi**. Non scegliere da solo.
5. Verifichi ogni punto «Fatto quando» del task. Se un punto si può verificare solo a mano o in un browser, lo dici e spieghi come verificarlo.
6. Commit piccoli, messaggi in italiano all'indicativo («Aggiunge il controllo dei prefissi»).
7. Apri una pull request verso `main` e **non farne il merge**: lo fa Pietro dopo la revisione del capo progetto.
8. Chiudi con un resoconto, nella descrizione della PR, in questo formato:
   - task e branch;
   - file creati o modificati;
   - per ogni punto «Fatto quando»: verificato / non verificato, con il comando o la prova;
   - scostamenti dal piano e perché;
   - dubbi aperti per il capo progetto.

## Ambiente di lavoro

Lavori in un ambiente remoto, non sul computer di Pietro. Ne segue che:
- non hai `data/` e non devi ricrearla;
- puoi scrivere `scripts/prepare_prefixes.py` e i suoi test, ma non eseguirlo sul dataset reale né scaricare modelli o dataset da Hugging Face: lo esegue Pietro in locale (T2, T3);
- le prove nel browser (T5-T13) le fa Pietro: nel resoconto indica i passi esatti per verificarle;
- lavori sul branch del task e fai push solo di quel branch.

## Vincoli sui dati (decisione D1) — non negoziabili

- Non creare, leggere né aprire file in `data/`. Contengono estratti del Pile che non devono uscire dal disco di Pietro, nemmeno verso il modello che stai usando.
- Per i test usa solo dati sintetici in `tests/fixtures/`, con ID di token e testi inventati.
- Non scrivere testi del Pile in nessun file versionato, compreso `docs/test-report.md`.
- Non indebolire `scripts/check_no_pile.sh`, l'hook pre-commit o il workflow `check-data`. Se ti bloccano, fermati e chiedi.

## Vincoli tecnici

**Pagina (`site/`)**
- Webapp serverless: HTML, CSS e JavaScript (moduli ES) eseguiti nel browser, senza passaggio di build e senza `npm` in produzione (D7). Struttura dei file come in `docs/SPEC.md`, sezione 6.
- La logica che non tocca DOM né modelli sta in moduli puri in `site/lib/`, testati con `node --test tests/js/` (nessuna dipendenza da installare).
- Unica libreria: Transformers.js da CDN, a **versione esatta** (mai `latest` né una versione parziale). Elenca in testa ad `app.js` gli host che la pagina contatta.
- Nessun'altra richiesta di rete: niente font esterni, analytics, cookie, `localStorage`, `sessionStorage` o IndexedDB scritti dall'app.
- Esecuzione su WASM; WebGPU disattivato.
- Generazione: si passano **ID di token**, non testo; `do_sample: false`, `num_beams: 1`, `max_new_tokens: 32`, tutti espliciti. Non fermarti su EOS e non sopprimerlo (niente `min_new_tokens`): vedi T7.
- Testi dell'interfaccia in italiano semplice; identificatori e commenti del codice in inglese.
- Accessibilità: uso da tastiera, etichette, `aria-live` per gli stati, nessuna informazione affidata solo al colore.

**Script (`scripts/`)**
- Python 3.11 o successivo, dipendenze con versioni fissate in `scripts/requirements.txt`.
- Esecuzioni riproducibili: seme fisso, output ordinato e deterministico.
- Messaggi di errore in italiano.

## Divieti

- Non fare push su `main`, né force push, né riscrivere la cronologia.
- Non aggiungere dipendenze non previste dal task senza chiedere.
- Non modificare `LICENSE`.
- Non disattivare, saltare o allentare test e controlli per farli passare.
- Non includere chiavi, token o credenziali in nessun file.
