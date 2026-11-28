"""Aggiorna la dashboard del progetto nel corpo dell'issue con l'etichetta `dashboard`.

Legge issue e pull request aperte tramite l'API di GitHub e le raggruppa per
`chi:*` (chi deve agire) e `stato:*` (a che punto è il lavoro), come descritto in
`docs/PROTOCOLLO.md`. Usa solo la libreria standard.

Uso in GitHub Actions (variabili fornite dal workflow `dashboard.yml`):
    GITHUB_TOKEN, GITHUB_REPOSITORY=owner/repo  python3 scripts/dashboard.py

Uso locale senza rete, per provare la formattazione:
    python3 scripts/dashboard.py --from-json fixture.json --print
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone

API = "https://api.github.com"
ROLES = [
    ("chi:pietro", "Pietro"),
    ("chi:capo-progetto", "Capo progetto (Claude Code)"),
    ("chi:vibe", "Sviluppatore (Vibe)"),
    ("chi:locale", "Sessione locale di Claude Code"),
]
STATES = [
    "stato:bloccato",
    "stato:da-unire",
    "stato:da-verificare",
    "stato:in-revisione",
    "stato:in-corso",
    "stato:da-fare",
]
STATE_LABELS = {
    "stato:bloccato": "bloccato",
    "stato:da-unire": "da unire",
    "stato:da-verificare": "da verificare nel browser",
    "stato:in-revisione": "in revisione",
    "stato:in-corso": "in corso",
    "stato:da-fare": "da fare",
}
CLOSES_RE = re.compile(r"\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)", re.IGNORECASE)


def api(path: str, token: str, method: str = "GET", body: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(
        f"{API}{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "lab-dashboard",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read() or b"null")


def fetch(repo: str, token: str) -> dict:
    issues, page = [], 1
    while True:
        batch = api(f"/repos/{repo}/issues?state=open&per_page=100&page={page}", token)
        issues += batch
        if len(batch) < 100:
            break
        page += 1
    pulls = api(f"/repos/{repo}/pulls?state=open&per_page=100", token)
    return {"issues": issues, "pulls": pulls}


def labels_of(item: dict) -> set[str]:
    return {label["name"] for label in item.get("labels", [])}


def priority(item: dict) -> int:
    for name in labels_of(item):
        if name.startswith("priorità:"):
            try:
                return int(name.split(":", 1)[1])
            except ValueError:
                pass
    return 9


def state_of(item: dict) -> str | None:
    names = labels_of(item)
    for state in STATES:
        if state in names:
            return state
    return None


def linked_pulls(pulls: list[dict]) -> dict[int, list[dict]]:
    links: dict[int, list[dict]] = {}
    for pull in pulls:
        for number in CLOSES_RE.findall(pull.get("body") or ""):
            links.setdefault(int(number), []).append(pull)
    return links


def render(data: dict, now: datetime) -> str:
    issues = [i for i in data["issues"] if "pull_request" not in i and not labels_of(i) & {"dashboard", "sprint"}]
    pulls = data["pulls"]
    links = linked_pulls(pulls)

    def line(issue: dict) -> str:
        state = state_of(issue)
        state_text = STATE_LABELS.get(state, "senza stato")
        prs = ", ".join(
            f"PR #{p['number']}{' (bozza)' if p.get('draft') else ''}" for p in links.get(issue["number"], [])
        )
        extra = f" · {prs}" if prs else ""
        question = " · ❓ domanda" if "domanda" in labels_of(issue) else ""
        return f"- **#{issue['number']}** {issue['title']} — _{state_text}_{extra}{question}"

    def ordered(items: list[dict]) -> list[dict]:
        return sorted(
            items,
            key=lambda i: (STATES.index(state_of(i)) if state_of(i) in STATES else len(STATES), priority(i), i["number"]),
        )

    out = [
        "# Dashboard del progetto",
        "",
        f"Aggiornata automaticamente il {now.strftime('%d/%m/%Y alle %H:%M')} UTC. "
        "Non modificare questo testo a mano: cambia le etichette delle issue (vedi `docs/PROTOCOLLO.md`).",
        "",
        "## Prossima azione per ciascuno",
        "",
    ]
    for label, name in ROLES:
        mine = ordered([i for i in issues if label in labels_of(i) and state_of(i) != "stato:bloccato"])
        nxt = mine[0] if mine else None
        out.append(f"- **{name}:** " + (f"#{nxt['number']} {nxt['title']}" if nxt else "nulla in attesa"))
    out += ["", "## Attività per responsabile", ""]
    for label, name in ROLES:
        mine = ordered([i for i in issues if label in labels_of(i)])
        out.append(f"### {name} ({len(mine)})")
        out += [line(i) for i in mine] or ["- nessuna"]
        out.append("")
    unassigned = ordered([i for i in issues if not any(r[0] in labels_of(i) for r in ROLES)])
    if unassigned:
        out.append(f"### Senza responsabile ({len(unassigned)})")
        out += [line(i) for i in unassigned]
        out.append("")
    out += ["## Pull request aperte", ""]
    if pulls:
        for pull in sorted(pulls, key=lambda p: p["number"]):
            closes = ", ".join(f"#{n}" for n in CLOSES_RE.findall(pull.get("body") or "")) or "nessuna issue collegata"
            draft = " · bozza" if pull.get("draft") else ""
            out.append(f"- **PR #{pull['number']}** {pull['title']} — chiude {closes}{draft}")
    else:
        out.append("- nessuna")
    out.append("")
    return "\n".join(out)


def strip_timestamp(text: str) -> str:
    return "\n".join(l for l in text.strip().splitlines() if not l.startswith("Aggiornata automaticamente"))


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--from-json", help="legge issue e PR da un file invece che dall'API")
    parser.add_argument("--print", action="store_true", help="stampa la dashboard invece di aggiornarla")
    args = parser.parse_args(argv)

    if args.from_json:
        data = json.load(open(args.from_json, encoding="utf-8"))
    else:
        token = os.environ["GITHUB_TOKEN"]
        repo = os.environ["GITHUB_REPOSITORY"]
        data = fetch(repo, token)
    body = render(data, datetime.now(timezone.utc))

    if args.print or args.from_json:
        print(body)
        return 0

    targets = [i for i in data["issues"] if "dashboard" in labels_of(i) and "pull_request" not in i]
    if not targets:
        print("Nessuna issue con l'etichetta «dashboard»: niente da aggiornare.", file=sys.stderr)
        return 1
    target = min(targets, key=lambda i: i["number"])
    number = target["number"]
    if strip_timestamp(target.get("body") or "") == strip_timestamp(body):
        print(f"Dashboard #{number} già aggiornata.")
        return 0
    api(f"/repos/{os.environ['GITHUB_REPOSITORY']}/issues/{number}", os.environ["GITHUB_TOKEN"], "PATCH", {"body": body})
    print(f"Dashboard #{number} aggiornata.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
