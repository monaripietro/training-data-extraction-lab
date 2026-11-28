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

cat > "$hooks_dir/pre-push" <<'HOOK'
#!/usr/bin/env bash
# Blocks Pile extracts before they leave this computer (D1, CA8).
# stdin lines: <local ref> <local sha> <remote ref> <remote sha>
set -uo pipefail
checker="$(git rev-parse --show-toplevel)/scripts/check_no_pile.py"
status=0
while read -r local_ref local_sha remote_ref remote_sha; do
  case "$local_sha" in
    *[!0]*) ;;
    *) continue ;;
  esac
  case "$remote_sha" in
    *[!0]*)
      if ! shas="$(git rev-list --no-merges "$remote_sha..$local_sha")"; then
        echo "Errore: l'intervallo $remote_sha..$local_sha non è leggibile (cronologia riscritta o remoto non aggiornato). Push bloccato per sicurezza." >&2
        status=1
        continue
      fi
      ;;
    *)
      if ! shas="$(git rev-list --no-merges "$local_sha" --not --remotes)"; then
        echo "Errore: impossibile elencare i commit di $local_ref non presenti su nessun remoto. Push bloccato per sicurezza." >&2
        status=1
        continue
      fi
      ;;
  esac
  if [ -n "$shas" ]; then
    # shellcheck disable=SC2086
    if ! python3 "$checker" --commits $shas; then
      status=1
    fi
  fi
done
exit $status
HOOK
chmod +x "$hooks_dir/pre-push"

echo "Hook pre-commit installato in $hooks_dir/pre-commit"
echo "Ogni commit esegue scripts/check_no_pile.sh (controllo CA8)."
echo "Hook pre-push installato in $hooks_dir/pre-push"
echo "Ogni push esamina i commit non ancora sul remoto: quelli creati con --no-verify o prima dell'installazione non passano."
