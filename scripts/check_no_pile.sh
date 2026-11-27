#!/usr/bin/env bash
# Entry point used by the pre-commit hook and by CI. The logic is in check_no_pile.py.
set -euo pipefail
exec python3 "$(git rev-parse --show-toplevel)/scripts/check_no_pile.py" "$@"
