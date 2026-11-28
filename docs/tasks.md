# Piano dei task

Riferimento: `docs/SPEC.md` v0.3 (fonte di verità). Aggiornato dal capo progetto il 28/11/2026.
L'analisi iniziale della spec v0.2 (conflitti, ambiguità, rischi) è nella cronologia di questo file e in `docs/SPEC-sprint1.md`.

## Stato

| Sprint | Stato | Issue |
| --- | --- | --- |
| 1 — protezioni dati, script dei prefissi, controlli, verifica di rete | **chiuso** il 28/11 | #24 e precedenti |
| 2 — webapp: scheletro, modelli, prefissi, modalità B | **aperto** | #39: #43 ✔, #33 ✔, #46, #47, #54, #34, #35 |
| 3 — modalità A e C, registro, accessibilità, README | in coda | #40: #36, #37, #38 (comprende #30) |

## Sprint 2 (#39)

| Ordine | Issue | Uscita | Criteri |
| --- | --- | --- | --- |
| 0 | #43 download dei soli due split del dataset (rallenta T3) | `prepare_prefixes.py` scarica solo `duped.70m` e `deduped.70m` | T2 |
| 0 | #47 nomi dei file divisi in parti del dataset | `select_split_files` accetta `split-00000-of-0000N` | T2 |
| 0 | #46 percentuale di caricamento | percentuale complessiva da 0 a 100 | RF1 |
| 1 | #33 S2-A scheletro, test JS in CI, caricamento modelli | i due modelli si caricano nel browser; `node --test` in CI | RF1, CA5, CA9 |
| 2 | #34 S2-B prefissi, controlli, vista del formatore | elenco unico e validato; controlli indistinguibili | RF0, RF5, RF7, CA7 |
| 3 | #35 S2-C modalità B | confronto per ID con evidenziazione; prima misura di CA1 | RF3, CA1, CA2 |

Parallelismo: i moduli puri `compare.js` e `tokens.js` (#35) partono subito dopo il merge di #33.

## Sprint 3 (#40)

| Ordine | Issue | Uscita | Criteri |
| --- | --- | --- | --- |
| 1 | #36 S3-A modalità A e C | prodotto con le tre modalità | RF2, RF4, CA3 |
| 1 | #37 S3-B registro, CSV, TSV | esportazione per il foglio condiviso | RF6, CA4 |
| 2 | #38 S3-C accessibilità, testi, README | prodotto pronto per il pilota | RNF6, CA10 |

`log.js` (#37) è un modulo puro e può partire già durante lo sprint 2.

## Attività di Pietro, in parallelo

| Attività | Quando | Come |
| --- | --- | --- |
| T0 nel browser e dalla rete del cliente | appena possibile | `netcheck.html`, risultato in `docs/test-report.md` |
| T3 preparazione dei prefissi reali | **fatta** il 28/11 (276 candidati, 72 % riprodotti) | sessione locale, `CLAUDE.md` |
| T3 diagnosi del 72 % | dopo #54 | `--recheck` in tre configurazioni |
| T3 revisione manuale e `--finalize` | dopo T3 | a mano su `data/candidates.json` |
| T4 generazione di `site/controls.json` | ora | sessione locale, `prepare_prefixes.py --controls` |
| Verifiche nel browser di ogni issue | a ogni PR | passi indicati nel resoconto di Vibe |
| CA1–CA6 e RNF3 su tre portatili | fine sprint 2 e 3 | `docs/test-report.md` |
| Conferma di D4 e D5 | prima dello sprint 3 | commento su #40 |

## Ritmo

- Una PR per issue; il capo progetto la rivede appena Pietro ne segnala il numero.
- I difetti trovati in revisione diventano issue nuove, collegate allo sprint; non si correggono «di passaggio».
- Uno sprint si chiude quando tutte le sue issue sono unite e le verifiche di Pietro sono registrate nel report.
