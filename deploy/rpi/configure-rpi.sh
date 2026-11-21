#!/usr/bin/env bash
# Interactive terminal configuration for Yaesu Web Pult (run over SSH on the Raspberry Pi).
set -euo pipefail
DEST="/opt/yaesu-web-pult"
if [[ -x "${DEST}/.venv/bin/python" ]]; then
  PY="${DEST}/.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PY="python3"
else
  echo "python3 не найден." >&2
  exit 1
fi
exec "${PY}" "${DEST}/server/configure.py" "$@"
