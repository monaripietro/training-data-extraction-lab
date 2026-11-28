#!/usr/bin/env python3
import argparse
import json
import random
import re
import sys
from pathlib import Path

PREFIX_LEN = 32
EXPECTED_LEN = 32
TOTAL_TOKENS = PREFIX_LEN + EXPECTED_LEN
MIN_DISTINCT_TOKENS = 16
REPRODUCTION_THRESHOLD = 0.95
REVISION_STEP = "step143000"
MEMORIZED_SPLITS = ("duped.70m", "deduped.70m")
MODEL_BY_SPLIT = {
    "duped.70m": "EleutherAI/pythia-70m",
    "deduped.70m": "EleutherAI/pythia-70m-deduped",
}

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
URL_RE = re.compile(r"(?:https?://|www\.)\S+", re.IGNORECASE)
PHONE_RE = re.compile(r"(?<!\d)\+?\d[\d\s\-().]{6,}\d(?!\d)")
LONG_DIGITS_RE = re.compile(r"\d{8,}")
FILTER_ORDER = ("email", "url", "sequenza_di_cifre", "telefono", "pochi_token_distinti")
FILTER_LABELS = {
    "email": "indirizzi email",
    "url": "URL",
    "sequenza_di_cifre": "sequenze di 8 o più cifre",
    "telefono": "numeri di telefono",
    "pochi_token_distinti": "meno di 16 token distinti su 64",
}


class PreparazioneError(Exception):
    pass


def filter_reason(text, ids):
    if EMAIL_RE.search(text):
        return "email"
    if URL_RE.search(text):
        return "url"
    if LONG_DIGITS_RE.search(text):
        return "sequenza_di_cifre"
    if PHONE_RE.search(text):
        return "telefono"
    if len(set(ids)) < MIN_DISTINCT_TOKENS:
        return "pochi_token_distinti"
    return None


def apply_filters(rows):
    kept = []
    rejected = {reason: 0 for reason in FILTER_ORDER}
    for row in rows:
        reason = filter_reason(row["text"], row["ids"])
        if reason is None:
            kept.append(row)
        else:
            rejected[reason] += 1
    return kept, rejected


def sample_row_indices(row_count, n, seed, split):
    rng = random.Random(f"{seed}|{split}")
    if n > row_count:
        raise PreparazioneError(
            f"richieste {n} righe ma lo split {split} ne ha solo {row_count}"
        )
    return sorted(rng.sample(range(row_count), n))


def tokenizer_vocab_equal(tokenizer_a, tokenizer_b):
    return tokenizer_a.get_vocab() == tokenizer_b.get_vocab()


def check_tokenizers(tokenizer_70m, tokenizer_14b, candidate_id_lists):
    if not tokenizer_vocab_equal(tokenizer_70m, tokenizer_14b):
        raise PreparazioneError(
            "i vocabolari di pythia-70m e pythia-1.4b non coincidono (QA2)"
        )
    for ids in candidate_id_lists:
        if tokenizer_70m.decode(ids) != tokenizer_14b.decode(ids):
            raise PreparazioneError(
                "la decodifica di un candidato differisce tra pythia-70m e "
                "pythia-1.4b (QA2)"
            )


def build_entry(entry_id, entry_type, split, index, ids, tokenizer, reproduced=None):
    prefix_ids = ids[:PREFIX_LEN]
    expected_ids = ids[PREFIX_LEN:TOTAL_TOKENS]
    entry = {
        "id": entry_id,
        "type": entry_type,
        "split": split,
        "index": index,
        "prefix_ids": prefix_ids,
        "expected_ids": expected_ids,
        "prefix_text": tokenizer.decode(prefix_ids),
        "expected_text": tokenizer.decode(expected_ids),
        "reviewed": False,
        "notes": "",
    }
    if reproduced is not None:
        entry["reproduced_pytorch"] = reproduced
    return entry


def build_memorized_entries(rows, tokenizer):
    entries = []
    for position, row in enumerate(rows, start=1):
        entry_id = f"m{position:02d}"
        entries.append(
            build_entry(entry_id, "memorized", row["split"], row["index"], row["ids"], tokenizer)
        )
    return entries


def build_control_entries(controls_source, tokenizer):
    entries = []
    for position, control in enumerate(controls_source, start=1):
        text = control["text"]
        ids = tokenizer.encode(text)
        if len(ids) < TOTAL_TOKENS:
            raise PreparazioneError(
                f"il controllo {position} è lungo {len(ids)} token, almeno "
                f"{TOTAL_TOKENS} sono richiesti"
            )
        entry_id = control.get("id") or f"c{position:02d}"
        entry = build_entry(entry_id, "control", None, None, ids, tokenizer)
        entry["reviewed"] = True
        entries.append(entry)
    return entries


def greedy_generate(model, prefix_ids):
    import torch

    input_ids = torch.tensor([prefix_ids], dtype=torch.int64)
    attention_mask = torch.ones_like(input_ids)
    output = model.generate(
        input_ids=input_ids,
        attention_mask=attention_mask,
        do_sample=False,
        num_beams=1,
        max_new_tokens=EXPECTED_LEN,
    )
    return output[0][len(prefix_ids):].tolist()


def generate_continuations(model, entries):
    model.generation_config.eos_token_id = None
    for entry in entries:
        entry["reproduced_pytorch"] = (
            greedy_generate(model, entry["prefix_ids"]) == entry["expected_ids"]
        )


def check_reproduction_quota(entries):
    total = len(entries)
    reproduced = sum(1 for e in entries if e.get("reproduced_pytorch"))
    if total and reproduced / total < REPRODUCTION_THRESHOLD:
        print(
            f"Attenzione: solo {reproduced} candidati su {total} "
            f"({reproduced / total:.0%}) sono riprodotti da PyTorch: la soglia "
            f"è del {REPRODUCTION_THRESHOLD:.0%}."
        )
    return reproduced, total


def validate_entry(entry, decode_fn):
    entry_id = entry.get("id", "(senza id)")
    prefix_ids = entry.get("prefix_ids")
    expected_ids = entry.get("expected_ids")
    if not isinstance(prefix_ids, list) or len(prefix_ids) != PREFIX_LEN:
        raise PreparazioneError(
            f"la voce {entry_id} ha {len(prefix_ids) if isinstance(prefix_ids, list) else 'un valore non valido'} "
            f"token di prefisso, attesi {PREFIX_LEN}"
        )
    if not isinstance(expected_ids, list) or len(expected_ids) != EXPECTED_LEN:
        raise PreparazioneError(
            f"la voce {entry_id} ha {len(expected_ids) if isinstance(expected_ids, list) else 'un valore non valido'} "
            f"token di continuazione, attesi {EXPECTED_LEN}"
        )
    if not all(isinstance(token, int) for token in prefix_ids + expected_ids):
        raise PreparazioneError(f"la voce {entry_id} contiene token che non sono interi")
    if entry.get("prefix_text") != decode_fn(prefix_ids):
        raise PreparazioneError(
            f"il campo prefix_text della voce {entry_id} non corrisponde alla decodifica dei token"
        )
    if entry.get("expected_text") != decode_fn(expected_ids):
        raise PreparazioneError(
            f"il campo expected_text della voce {entry_id} non corrisponde alla decodifica dei token"
        )


def finalize_entries(entries, decode_fn):
    reviewed = []
    for entry in entries:
        if entry.get("reviewed") is True:
            validate_entry(entry, decode_fn)
            if entry.get("type") == "memorized" and entry.get("reproduced_pytorch") is not True:
                raise PreparazioneError(
                    f"la voce {entry.get('id')} è riveduta ma non è riprodotta da PyTorch "
                    "(reproduced_pytorch diverso da true): CA1 va misurata solo su voci riprodotte"
                )
            reviewed.append(entry)
    return reviewed


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def read_json(path):
    try:
        with Path(path).open(encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        raise PreparazioneError(f"il file {path} non esiste")
    except json.JSONDecodeError as exc:
        raise PreparazioneError(f"il file {path} non è un JSON valido: {exc}")


def load_tokenizer(repo_id):
    try:
        from transformers import AutoTokenizer

        return AutoTokenizer.from_pretrained(repo_id, revision=REVISION_STEP)
    except Exception as exc:
        raise PreparazioneError(
            f"impossibile caricare il tokenizer {repo_id} alla revisione "
            f"{REVISION_STEP}: verifica la connessione a Hugging Face ({exc})"
        )


DATASET_ID = "EleutherAI/pythia-memorized-evals"


def load_split_rows(split):
    from datasets import load_dataset

    return load_dataset(DATASET_ID, split=split)


def build_rows(dataset, split, n, seed, tokenizer):
    """Sample n rows of a memorized-evals split. Each row keeps the training
    index from the dataset's own `index` field, not the row position."""
    rows = []
    for position in sample_row_indices(len(dataset), n, seed, split):
        record = dataset[position]
        ids = [int(token) for token in record["tokens"]]
        if len(ids) != TOTAL_TOKENS:
            raise PreparazioneError(
                f"la riga {position} dello split {split} ha {len(ids)} token, "
                f"attesi {TOTAL_TOKENS}"
            )
        rows.append({
            "split": split,
            "index": int(record["index"]),
            "ids": ids,
            "text": tokenizer.decode(ids),
        })
    return rows


def run_preparation(args):
    tokenizer = load_tokenizer("EleutherAI/pythia-70m")
    tokenizer_14b = load_tokenizer("EleutherAI/pythia-1.4b")
    rows = []
    for split in args.split:
        rows += build_rows(load_split_rows(split), split, args.n, args.seed, tokenizer)
    kept, rejected = apply_filters(rows)
    for reason in FILTER_ORDER:
        print(f"Scartati per {FILTER_LABELS[reason]}: {rejected[reason]}")
    check_tokenizers(tokenizer, tokenizer_14b, [row["ids"] for row in kept])
    entries = build_memorized_entries(kept, tokenizer)
    for split in args.split:
        split_entries = [e for e in entries if e["split"] == split]
        if not split_entries:
            continue
        from transformers import AutoModelForCausalLM

        model = AutoModelForCausalLM.from_pretrained(
            MODEL_BY_SPLIT[split], revision=REVISION_STEP, torch_dtype="float32"
        )
        model.eval()
        generate_continuations(model, split_entries)
    check_reproduction_quota(entries)
    write_json(args.out, entries)
    print(f"Scritte {len(entries)} voci in {args.out}")


def run_finalize(args):
    tokenizer = load_tokenizer("EleutherAI/pythia-70m")
    entries = read_json(args.candidates)
    if not isinstance(entries, list):
        raise PreparazioneError(f"il file {args.candidates} non contiene un elenco di voci")
    reviewed = finalize_entries(entries, tokenizer.decode)
    if not reviewed:
        raise PreparazioneError(
            f"nessuna voce riveduta in {args.candidates}: quasi certamente la "
            "revisione non è stata salvata oppure è stato passato il file "
            f"sbagliato; non scrivo {args.prefixes_out}"
        )
    write_json(args.prefixes_out, reviewed)
    print(
        f"Scritte {len(reviewed)} voci rivedute in {args.prefixes_out} "
        f"(escluse {len(entries) - len(reviewed)} non rivedute)"
    )


CONTROL_MODEL_REPOS = {
    "duped": "EleutherAI/pythia-70m",
    "deduped": "EleutherAI/pythia-70m-deduped",
}


def load_causal_model(repo_id):
    try:
        from transformers import AutoModelForCausalLM

        model = AutoModelForCausalLM.from_pretrained(
            repo_id, revision=REVISION_STEP, torch_dtype="float32"
        )
        model.eval()
        model.generation_config.eos_token_id = None
        return model
    except Exception as exc:
        raise PreparazioneError(
            f"impossibile caricare il modello {repo_id} alla revisione "
            f"{REVISION_STEP}: verifica la connessione a Hugging Face ({exc})"
        )


def common_prefix_length(first, second):
    count = 0
    for token_a, token_b in zip(first, second):
        if token_a != token_b:
            break
        count += 1
    return count


def evaluate_controls(entries, models, generate_fn=greedy_generate):
    for entry in entries:
        reproduced = {}
        matching = {}
        for key, model in models.items():
            generated = generate_fn(model, entry["prefix_ids"])
            reproduced[key] = generated == entry["expected_ids"]
            matching[key] = common_prefix_length(generated, entry["expected_ids"])
            if reproduced[key]:
                print(
                    f"Attenzione: il controllo {entry['id']} è completato in modo "
                    f"esatto dal modello {key}: non è un buon controllo, va "
                    "sostituito prima di T7 (CA2)"
                )
        entry["reproduced_pytorch"] = reproduced
        entry["matching_tokens"] = matching


def run_controls(args):
    tokenizer = load_tokenizer("EleutherAI/pythia-70m")
    controls_source = read_json(args.controls)
    if not isinstance(controls_source, list):
        raise PreparazioneError(f"il file {args.controls} non contiene un elenco di controlli")
    entries = build_control_entries(controls_source, tokenizer)
    if entries and not args.skip_pytorch:
        models = {
            key: load_causal_model(repo_id) for key, repo_id in CONTROL_MODEL_REPOS.items()
        }
        evaluate_controls(entries, models)
    write_json(args.controls_out, entries)
    print(f"Scritti {len(entries)} controlli in {args.controls_out}")


def parse_args(argv):
    parser = argparse.ArgumentParser(
        description="Prepara i prefissi per il lab di estrazione dei dati."
    )
    parser.add_argument(
        "--split",
        action="append",
        choices=MEMORIZED_SPLITS,
        help="split da campionare (ripetibile)",
    )
    parser.add_argument("--n", type=int, default=200, help="righe da campionare per split")
    parser.add_argument("--seed", type=int, default=42, help="seme del campionamento")
    parser.add_argument("--out", default="data/candidates.json", help="file di output dei candidati")
    parser.add_argument(
        "--finalize",
        action="store_true",
        help="estrae le sole voci rivedute e scrive il file dei prefissi",
    )
    parser.add_argument(
        "--candidates",
        default="data/candidates.json",
        help="file dei candidati letto da --finalize",
    )
    parser.add_argument(
        "--prefixes-out",
        default="data/prefixes.json",
        help="file dei prefissi scritto da --finalize",
    )
    parser.add_argument("--controls", help="file sorgente dei controlli (T4)")
    parser.add_argument("--controls-out", default="site/controls.json", help="output dei controlli")
    parser.add_argument(
        "--skip-pytorch",
        action="store_true",
        help="genera i controlli senza scaricare i modelli PyTorch",
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    try:
        if args.finalize:
            run_finalize(args)
        elif args.controls:
            run_controls(args)
        else:
            if not args.split:
                args.split = list(MEMORIZED_SPLITS)  # decisione D6: entrambi gli split
            run_preparation(args)
    except PreparazioneError as exc:
        print(f"Errore: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
