"""Blocks Pile extracts from entering the repository (decision D1, criterion CA8).

Modes:
  (no argument)        staged content, for the pre-commit hook
  --tree               every tracked file at HEAD
  --range BASE..HEAD   every file added or changed by each commit in the range,
                       so a file added and then removed inside a PR is caught too
  --commits SHA...      the same check on an explicit list of commits, used by the
                       pre-push hook (new branches and ordinary updates)

Rules:
  a. no path under data/
  b. no .json / .jsonl file holding an entry with "type": "memorized"
  c. no .csv / .tsv file (exports of the experiment log contain model output)
  d. no block marked as "estratto" longer than 200 characters in docs/

Files under tests/fixtures/ are exempt from rules b and c, so that synthetic
fixtures can exercise the checks.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys

EXEMPT_PREFIX = "tests/fixtures/"
MAX_MARKED_BLOCK = 200


def git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], check=True, capture_output=True, text=True
    ).stdout


def git_blob(spec: str) -> bytes | None:
    result = subprocess.run(["git", "show", spec], capture_output=True)
    return result.stdout if result.returncode == 0 else None


def has_memorized_entry(obj: object) -> bool:
    if isinstance(obj, dict):
        if obj.get("type") == "memorized":
            return True
        return any(has_memorized_entry(v) for v in obj.values())
    if isinstance(obj, list):
        return any(has_memorized_entry(v) for v in obj)
    return False


def json_has_memorized(path: str, text: str) -> bool:
    if path.endswith(".jsonl"):
        docs = []
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                docs.append(json.loads(line))
            except json.JSONDecodeError:
                # An unreadable line could hide an extract: treat it as one.
                if '"memorized"' in line:
                    return True
        return any(has_memorized_entry(d) for d in docs)
    try:
        return has_memorized_entry(json.loads(text))
    except json.JSONDecodeError:
        return '"memorized"' in text


def marked_blocks(lines: list[str]) -> list[str]:
    blocks: list[str] = []
    in_fence, tag, buf = False, "", []
    for line in lines:
        if not in_fence:
            m = re.match(r"^\s*```(.*)$", line)
            if m:
                in_fence, tag, buf = True, m.group(1), []
            continue
        if re.match(r"^\s*```\s*$", line):
            if "estratto" in tag.lower():
                blocks.append("\n".join(buf))
            in_fence, tag, buf = False, "", []
        else:
            buf.append(line)
    if in_fence and "estratto" in tag.lower():
        blocks.append("\n".join(buf))

    in_quote, first, buf = False, "", []
    for line in lines + [""]:
        stripped = line.lstrip()
        if stripped.startswith(">"):
            content = stripped[1:].lstrip()
            if not in_quote:
                in_quote, first = True, content
            buf.append(content)
        else:
            if in_quote and "estratto" in first.lower():
                blocks.append("\n".join(buf))
            in_quote, buf = False, []
    return blocks


def check_file(path: str, content: bytes | None, where: str) -> list[str]:
    errors: list[str] = []
    label = f'"{path}"{where}'
    if path == "data" or path.startswith("data/"):
        return [f"{label} sta sotto data/: gli estratti del Pile non entrano nel repository (D1)"]
    exempt = path.startswith(EXEMPT_PREFIX)
    lower = path.lower()
    if not exempt and lower.endswith((".csv", ".tsv")):
        errors.append(f"{label} è un file CSV/TSV: le esportazioni del registro contengono output del modello (D1)")
    if content is None:
        return errors
    text = content.decode("utf-8", errors="replace")
    if not exempt and lower.endswith((".json", ".jsonl")) and json_has_memorized(path, text):
        errors.append(f'{label} contiene una voce con type "memorized": è un estratto del Pile (D1)')
    if path.startswith("docs/"):
        for block in marked_blocks(text.splitlines()):
            if len(block) > MAX_MARKED_BLOCK:
                errors.append(
                    f"{label} contiene un blocco marcato come estratto di {len(block)} caratteri "
                    f"(limite {MAX_MARKED_BLOCK}) (K3)"
                )
    return errors


def staged() -> list[str]:
    errors: list[str] = []
    for path in git("diff", "--cached", "--name-only", "--diff-filter=ACMR").splitlines():
        errors += check_file(path, git_blob(f":{path}"), "")
    return errors


def tree() -> list[str]:
    errors: list[str] = []
    for path in git("ls-tree", "-r", "--name-only", "HEAD").splitlines():
        errors += check_file(path, git_blob(f"HEAD:{path}"), "")
    return errors


def commit_range(spec: str) -> list[str]:
    errors: list[str] = []
    for commit in git("rev-list", "--no-merges", spec).splitlines():
        changed = git(
            "diff-tree", "--no-commit-id", "--name-only", "-r", "--root",
            "--diff-filter=ACMR", commit,
        ).splitlines()
        for path in changed:
            errors += check_file(path, git_blob(f"{commit}:{path}"), f" (commit {commit[:9]})")
    return errors


def commit_list(shas: list[str]) -> list[str]:
    errors: list[str] = []
    for commit in shas:
        commit = commit.strip()
        if not commit:
            continue
        changed = git(
            "diff-tree", "--no-commit-id", "--name-only", "-r", "--root",
            "--diff-filter=ACMR", commit,
        ).splitlines()
        for path in changed:
            errors += check_file(path, git_blob(f"{commit}:{path}"), f" (commit {commit[:9]})")
    return errors


def main(argv: list[str]) -> int:
    if not argv:
        errors = staged()
    elif argv == ["--tree"]:
        errors = tree()
    elif len(argv) == 2 and argv[0] == "--range":
        try:
            errors = commit_range(argv[1])
        except subprocess.CalledProcessError:
            print(f"Intervallo di commit non leggibile: {argv[1]} (cronologia riscritta o incompleta). "
                  "Controllo bloccato per sicurezza.", file=sys.stderr)
            return 1
    elif argv[0] == "--commits":
        if len(argv) < 2:
            print("Uso: check_no_pile.py --commits SHA [SHA...]", file=sys.stderr)
            return 2
        try:
            errors = commit_list(argv[1:])
        except subprocess.CalledProcessError:
            print(f"Commit non leggibili: {' '.join(argv[1:])} (cronologia riscritta o incompleta). "
                  "Controllo bloccato per sicurezza.", file=sys.stderr)
            return 1
    elif argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    else:
        print(f"Argomenti non validi: {' '.join(argv)}. "
              "Uso: check_no_pile.sh [--tree | --range BASE..HEAD | --commits SHA...]",
              file=sys.stderr)
        return 2
    if errors:
        for error in errors:
            print(f"VIOLAZIONE CA8: {error}", file=sys.stderr)
        print("Operazione bloccata: rimuovi i file indicati. Vedi AGENTS.md, «Vincoli sui dati».",
              file=sys.stderr)
        print("Prima di ripetere il push, rimuovi l'estratto dai commit con git reset o git rebase locale.",
              file=sys.stderr)
        return 1
    print("Controllo protezioni sui dati (CA8): OK")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
