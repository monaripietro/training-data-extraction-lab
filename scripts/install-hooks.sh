#!/usr/bin/env bash
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
hooks_dir="$(git rev-parse --git-dir)/hooks"

mkdir -p "$hooks_dir"
cat > "$hooks_dir/pre-commit" <<'HOOK'
#!/usr/bin/env bash
exec bash "$(git rev-parse --show-toplevel)/scripts/check_no_pile.sh"
HOOK
chmod +x "$hooks_dir/pre-commit"

echo "Hook pre-commit installato in $hooks_dir/pre-commit"
echo "Ogni commit esegue scripts/check_no_pile.sh (controllo CA8)."
