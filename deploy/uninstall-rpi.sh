#!/usr/bin/env bash
# Remove the Yaesu Web Pult systemd service (keeps /opt/yaesu-web-pult and config by default).
set -euo pipefail
if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Запустите от root: sudo bash deploy/uninstall-rpi.sh" >&2
  exit 1
fi
PURGE="${1:-}"
systemctl stop yaesu-web-pult.service 2>/dev/null || true
systemctl disable yaesu-web-pult.service 2>/dev/null || true
rm -f /etc/systemd/system/yaesu-web-pult.service
systemctl daemon-reload
echo "Сервис удалён."
if [[ "${PURGE}" == "--purge" ]]; then
  rm -rf /opt/yaesu-web-pult
  if id -u yaesu >/dev/null 2>&1; then userdel yaesu || true; fi
  echo "Каталог /opt/yaesu-web-pult и пользователь yaesu удалены."
else
  echo "Файлы и config.json оставлены в /opt/yaesu-web-pult. Для полного удаления: sudo bash deploy/uninstall-rpi.sh --purge"
fi
