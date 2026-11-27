#!/usr/bin/env bash
set -euo pipefail

mode="commit"
case "${1:-}" in
  "") mode="commit" ;;
  --tree) mode="tree" ;;
  -h|--help)
    echo "Uso: $0 [--tree]"
    echo "  senza argomenti: controlla i file nello stage (uso pre-commit)"
    echo "  --tree: controlla tutti i file dell'albero di HEAD (uso in CI)"
    exit 0
    ;;
  *)
    echo "Argomento non valido: ${1}. Uso: $0 [--tree]" >&2
    exit 2
    ;;
esac

if [[ "$mode" == "tree" ]]; then
  files="$(git ls-tree -r --name-only HEAD)"
else
  files="$(git diff --cached --name-only --diff-filter=ACMR)"
fi

export CHECK_NO_PILE_FILES="$files"

checker='
import json, os, re, sys

files = [f for f in os.environ["CHECK_NO_PILE_FILES"].splitlines() if f]
errors = []

def has_memorized_entry(obj):
    if isinstance(obj, dict):
        if obj.get("type") == "memorized" and obj.get("expected_ids"):
            return True
        return any(has_memorized_entry(v) for v in obj.values())
    if isinstance(obj, list):
        return any(has_memorized_entry(v) for v in obj)
    return False

def read_lines(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return fh.read().splitlines()
    except (OSError, UnicodeDecodeError):
        return None

def extracted_blocks(lines):
    blocks = []
    in_fence = False
    tag = ""
    buf = []
    for line in lines:
        if not in_fence:
            m = re.match(r"^\s*```(.*)$", line)
            if m:
                in_fence = True
                tag = m.group(1)
                buf = []
            continue
        if re.match(r"^\s*```\s*$", line):
            if "estratto" in tag.lower():
                blocks.append("\n".join(buf))
            in_fence = False
            tag = ""
            buf = []
        else:
            buf.append(line)
    if in_fence and "estratto" in tag.lower():
        blocks.append("\n".join(buf))
    in_quote = False
    first = ""
    buf = []
    for line in lines:
        stripped = line.lstrip()
        if stripped.startswith(">"):
            content = stripped[1:].lstrip()
            if not in_quote:
                in_quote = True
                first = content
            buf.append(content)
        else:
            if in_quote and "estratto" in first.lower():
                blocks.append("\n".join(buf))
            in_quote = False
            buf = []
    if in_quote and "estratto" in first.lower():
        blocks.append("\n".join(buf))
    return blocks

for path in files:
    if path == "data" or path.startswith("data/"):
        errors.append("il percorso \"" + path + "\" sta sotto data/: gli estratti del Pile non devono entrare nel repository (decisione D1, CA8)")
        continue
    if not os.path.isfile(path):
        continue
    if path.endswith(".json"):
        try:
            with open(path, encoding="utf-8") as fh:
                data = json.load(fh)
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            data = None
        if data is not None and has_memorized_entry(data):
            errors.append("il file \"" + path + "\" contiene una voce con type \"memorized\" e expected_ids non vuota: e un estratto del Pile (D1, CA8)")
    if path.startswith("docs/"):
        lines = read_lines(path)
        if lines is not None:
            for block in extracted_blocks(lines):
                if len(block) > 200:
                    errors.append("il file \"" + path + "\" contiene un blocco marcato come estratto di " + str(len(block)) + " caratteri (limite 200): gli estratti non vanno in docs/ (K3, CA8)")

if errors:
    for e in errors:
        print("VIOLAZIONE CA8: " + e, file=sys.stderr)
    print("Operazione bloccata: rimuovi i file indicati. Vedi AGENTS.md, sezione Vincoli sui dati (D1).", file=sys.stderr)
    sys.exit(1)
'

if python3 -c "$checker"; then
  echo "Controllo protezioni sui dati (CA8): OK"
else
  exit 1
fi
