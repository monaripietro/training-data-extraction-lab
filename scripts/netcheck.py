"""Verifica di rete per il task T0 (fattibilità della rete).

Controlla se dalla rete in uso si raggiungono gli host che servono al lab:
Hugging Face (elenco dei file, config.json, file ONNX e host di download a cui
reindirizza) e jsDelivr (libreria Transformers.js). Misura anche la velocità di
download di un file ONNX intero (circa 70 MB), se non si passa --no-speed.

Usa solo la libreria standard di Python: non installa pacchetti, non scrive
file, non invia dati se non le richieste agli host indicati.

Limite: verifica la rete, non il browser. Filtri sulle richieste cross-origin
(CORS) o sui contenuti del browser si vedono solo con site/netcheck.html.

Procedura per una sessione locale (conda):

    conda create -y -n t0-netcheck python=3.12
    conda run -n t0-netcheck python scripts/netcheck.py
    conda env remove -y -n t0-netcheck

Poi riportare l'output nella tabella «Esecuzioni» di docs/test-report.md,
indicando data, rete (cliente o controllo) e computer.
"""

from __future__ import annotations

import argparse
import json
import platform
import sys
import time
import urllib.parse
import urllib.request

HF = "https://huggingface.co"
MODELS = ("Xenova/pythia-70m", "Xenova/pythia-70m-deduped")
JSDELIVR_PROBE = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0/package.json"
TIMEOUT_S = 20


def fetch(url: str, byte_range: str | None = None) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": "lab-netcheck"})
    if byte_range:
        request.add_header("Range", byte_range)
    start = time.time()
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
            body = response.read()
            return {
                "ok": response.status in (200, 206),
                "status": response.status,
                "host": urllib.parse.urlparse(response.geturl()).netloc,
                "ms": round((time.time() - start) * 1000),
                "body": body,
            }
    except Exception as error:  # noqa: BLE001 - any failure is a finding
        return {
            "ok": False,
            "status": "ERRORE",
            "host": f"{type(error).__name__}: {str(error)[:160]}",
            "ms": round((time.time() - start) * 1000),
            "body": b"",
        }


def line(tag: str, ok: bool, text: str) -> bool:
    print(f"[{'OK' if ok else 'BLOCCATO'}] {tag}: {text}")
    return ok


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--no-speed", action="store_true", help="salta la misura della velocità")
    args = parser.parse_args()

    print("Verifica di rete del lab (T0)")
    print(f"Data: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}")
    print(f"Sistema: {platform.platform()} · Python {platform.python_version()}")
    print()

    all_ok = True
    speed_url = None
    for repo in MODELS:
        r = fetch(f"{HF}/api/models/{repo}?blobs=true")
        all_ok &= line(f"elenco file {repo}", r["ok"], f"{r['status']} da {r['host']}, {r['ms']} ms")
        if not r["ok"]:
            continue
        siblings = json.loads(r["body"]).get("siblings", [])
        onnx = sorted(
            (s for s in siblings if s["rfilename"].startswith("onnx/") and s["rfilename"].endswith(".onnx")),
            key=lambda s: s.get("size") or 0,
        )
        print("       file ONNX: " + ", ".join(
            f"{s['rfilename']} ({round((s.get('size') or 0) / 1e6)} MB)" for s in onnx
        ))

        r = fetch(f"{HF}/{repo}/resolve/main/config.json")
        all_ok &= line(f"config.json {repo}", r["ok"], f"{r['status']}, servito da {r['host']}, {r['ms']} ms")

        if onnx:
            name = onnx[0]["rfilename"]
            url = f"{HF}/{repo}/resolve/main/{name}"
            r = fetch(url, byte_range="bytes=0-1023")
            all_ok &= line(f"ONNX {repo}", r["ok"], f"{name}: {r['status']}, servito da {r['host']}, {r['ms']} ms")
            if r["ok"] and speed_url is None:
                speed_url = url

    r = fetch(JSDELIVR_PROBE)
    all_ok &= line("jsDelivr", r["ok"], f"{r['status']} da {r['host']}, {r['ms']} ms")

    if speed_url and not args.no_speed:
        start = time.time()
        r = fetch(speed_url)
        seconds = time.time() - start
        if r["ok"]:
            mb = len(r["body"]) / 1e6
            print(f"[INFO] velocità: {mb:.0f} MB in {seconds:.1f} s = {mb / seconds:.1f} MB/s")
        else:
            all_ok &= line("velocità", False, f"{r['status']} {r['host']}")

    print()
    print("Esito: " + ("tutti gli host necessari sono raggiungibili" if all_ok
                       else "almeno un host non è raggiungibile: serve il piano B o un'autorizzazione dell'IT"))
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
