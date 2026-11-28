# Protocollo di lavoro

Come Pietro, il capo progetto (Claude Code nel cloud), lo sviluppatore (Mistral Vibe) e la sessione locale di Claude Code si passano il lavoro **senza messaggi in chat**. Il canale è GitHub: issue, etichette e pull request. La **dashboard** è un'issue fissata con l'etichetta `dashboard`, aggiornata da sola dal workflow `dashboard.yml` a ogni cambiamento e ogni ora.

## Etichette

| Etichetta | Significato |
| --- | --- |
| `chi:pietro` · `chi:capo-progetto` · `chi:vibe` · `chi:locale` | chi deve agire adesso (una sola per issue) |
| `stato:da-fare` | pronta per chi è indicato |
| `stato:in-corso` | qualcuno ci sta lavorando |
| `stato:in-revisione` | PR aperta, la rivede il capo progetto |
| `stato:da-verificare` | PR approvata nel codice, Pietro la prova nel browser |
| `stato:da-unire` | approvata e verificata, Pietro fa il merge |
| `stato:bloccato` | ferma; il motivo è nell'ultimo commento |
| `priorità:1` … `priorità:3` | ordine dentro lo stesso responsabile (1 = prima) |
| `domanda` | richiesta di chiarimento, sempre con `chi:capo-progetto` |
| `sprint` | issue di coordinamento di uno sprint: non compare tra le attività |

## Passaggi

```
capo progetto apre l'issue ── chi:vibe, stato:da-fare
        │
Vibe la prende ───────────── stato:in-corso
Vibe apre la PR (Closes #n) ─ chi:capo-progetto, stato:in-revisione
        │
capo progetto rivede
  ├─ modifiche richieste ─── chi:vibe, stato:da-fare (commento nella PR)
  ├─ serve prova nel browser  chi:pietro, stato:da-verificare
  └─ approvata ───────────── chi:pietro, stato:da-unire
        │
Pietro verifica e unisce ─── l'issue si chiude da sola con «Closes #n»
  └─ la prova fallisce ───── chi:capo-progetto, stato:da-fare (commento con l'errore)
```

Domande: chi ha un dubbio apre un'issue con `domanda` e `chi:capo-progetto`. Il capo progetto risponde nell'issue e la chiude, oppure la trasforma in lavoro e riassegna le etichette.

Prove in locale: le attività che richiedono il computer di Pietro hanno `chi:locale`. Il corpo dell'issue contiene il prompt esatto da eseguire; l'esito va scritto come commento, **solo numeri e id, mai testi del Pile**, e poi l'etichetta passa a `chi:capo-progetto`.

## Regole

- Un'issue ha **una sola** etichetta `chi:` e **una sola** `stato:`. Chi cambia lo stato aggiorna anche `chi:`.
- Chi finisce un passaggio lascia un commento di una riga con cosa ha fatto e il link (PR, run della CI).
- Nessuno, tranne Pietro, fa il merge.
- La dashboard non si modifica a mano.

## Frasi fisse

Bastano queste, sempre uguali, per far ripartire chi non si sveglia da solo:

- **Per Vibe:** «Procedi con la dashboard del progetto, secondo `docs/PROTOCOLLO.md`.»
- **Per la sessione locale:** «Esegui le attività `chi:locale` della dashboard, secondo `CLAUDE.md` e `docs/PROTOCOLLO.md`.»

Il capo progetto controlla la dashboard ogni ora con un'attività pianificata, e subito quando riceve eventi dalle PR.
