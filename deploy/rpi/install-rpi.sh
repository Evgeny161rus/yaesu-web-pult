#!/usr/bin/env bash
# Install Yaesu Web Pult as a headless systemd service on Raspberry Pi OS / Debian.
# Run from the repository root:  sudo bash deploy/install-rpi.sh
set -euo pipefail

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Запустите от root: sudo bash deploy/install-rpi.sh" >&2
  exit 1
fi

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEST="/opt/yaesu-web-pult"
USER_NAME="yaesu"
PYTHON_BIN="${PYTHON_BIN:-python3}"

echo "==> Yaesu Web Pult: установка в ${DEST}"
if [[ ! -f "${SRC_DIR}/server/main.py" ]]; then
  echo "Ошибка: запустите скрипт из корня репозитория (не найден server/main.py)." >&2
  exit 1
fi

echo "==> Системные пакеты (python3, venv, PortAudio/ALSA, serial tools)"
apt-get update
apt-get install -y --no-install-recommends \
  "${PYTHON_BIN}" "${PYTHON_BIN}-venv" "${PYTHON_BIN}-pip" \
  python3-dev build-essential \
  libportaudio2 portaudio19-dev libasound2-dev \
  libffi-dev libssl-dev \
  ca-certificates curl git \
  libhamlib-utils

echo "==> Пользователь сервиса ${USER_NAME}"
if ! id -u "${USER_NAME}" >/dev/null 2>&1; then
  useradd --system --home-dir "${DEST}" --shell /usr/sbin/nologin --comment "Yaesu Web Pult" "${USER_NAME}"
fi
usermod -aG dialout,audio "${USER_NAME}" || true

echo "==> Копирование файлов"
mkdir -p "${DEST}"
# Prefer rsync if available to keep updates clean; fall back to cp.
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete \
    --exclude '.git' --exclude '.venv' --exclude '__pycache__' --exclude '*.pyc' \
    --exclude 'dist' --exclude 'build' --exclude '*.spec' \
    --exclude 'config.json' --exclude 'cert.pem' --exclude 'key.pem' \
    "${SRC_DIR}/" "${DEST}/"
else
  cp -a "${SRC_DIR}/." "${DEST}/"
  rm -rf "${DEST}/.git" "${DEST}/.venv" "${DEST}/dist" "${DEST}/build" || true
fi

echo "==> Виртуальное окружение Python"
if [[ ! -x "${DEST}/.venv/bin/python" ]]; then
  "${PYTHON_BIN}" -m venv "${DEST}/.venv"
fi
"${DEST}/.venv/bin/pip" install --upgrade pip wheel setuptools
# Tray/GUI packages are harmless on headless but optional; install core deps explicitly.
"${DEST}/.venv/bin/pip" install "numpy>=1.24" "pyserial>=3.5" "sounddevice>=0.4.6" "cryptography>=41"

echo "==> RTL-SDR (опционально)"
RTL_SDR_DETECTED=0
if command -v lsusb >/dev/null 2>&1 && lsusb | grep -qiE '0bda:2838|0bda:2832|RTL2838|RTL2832|RTL-SDR|Blog V4'; then
  RTL_SDR_DETECTED=1
elif grep -qiE 'rtl2832|rtl2838' /sys/bus/usb/devices/*/product 2>/dev/null; then
  RTL_SDR_DETECTED=1
fi
if [[ "${RTL_SDR_DETECTED}" -eq 1 ]]; then
  echo "    Обнаружен RTL-SDR — устанавливаю rtl-sdr и библиотеки..."
  apt-get install -y --no-install-recommends rtl-sdr librtlsdr-dev usbutils || true
  # DVB-драйвер ядра перехватывает RTL2832U и мешает SDR; blacklist на следующую загрузку
  BL="/etc/modprobe.d/blacklist-rtl-sdr.conf"
  cat > "${BL}" <<'BLK'
# Yaesu Web Pult: allow rtl_sdr userspace access instead of DVB-T driver
blacklist dvb_usb_rtl28xxu
blacklist rtl2832
blacklist rtl2830
blacklist dvb_usb_v2
BLK
  echo "    Blacklist DVB записан в ${BL} (действует после перезагрузки)."
  # Если модуль сейчас загружен - выгрузить безопасно не всегда возможно; rtl_sdr сам делает detach.
else
  echo "    RTL-SDR не обнаружен (можно подключить позже; при следующем запуске установщика он будет настроен)."
fi

echo "==> Права доступа"
# config/cert are runtime files; keep them writable by the service user.
if [[ -f "${DEST}/config.json" ]]; then
  chown "${USER_NAME}:${USER_NAME}" "${DEST}/config.json" || true
fi
touch "${DEST}/config.json" 2>/dev/null || true
chown -R root:root "${DEST}"
chown "${USER_NAME}:${USER_NAME}" "${DEST}"
chown "${USER_NAME}:${USER_NAME}" "${DEST}/config.json" 2>/dev/null || true
# Allow cert generation next to config
chown "${USER_NAME}:${USER_NAME}" "${DEST}" || true

echo "==> systemd unit"
install -m 0644 "${DEST}/deploy/yaesu-web-pult.service" /etc/systemd/system/yaesu-web-pult.service
systemctl daemon-reload
systemctl enable yaesu-web-pult.service

echo
echo "Готово. Дальнейшие шаги:"
echo "  1. Настройте параметры (рекомендуется интерактивно по SSH, с автоопределением порта/звука и опросом трансивера):"
echo "       sudo -u yaesu ${DEST}/.venv/bin/python ${DEST}/server/configure.py"
echo "     или вручную: sudo nano ${DEST}/config.json"
echo "     (CAT-порт: обычно /dev/ttyUSB0 или путь из /dev/serial/by-id/...; cat_baud как в меню трансивера;"
echo "      задайте password для доступа по сети; audio_in_name/audio_out_name — имя USB Audio CODEC при необходимости.)"
echo "  2. Запуск:   sudo systemctl start yaesu-web-pult"
echo "  3. Журнал:   sudo journalctl -u yaesu-web-pult -f"
echo "  4. Статус:   sudo systemctl status yaesu-web-pult"
echo "  5. Пульт:    https://<IP-Raspberry-Pi>:8443/  (панель: http://127.0.0.1:8080/panel локально на Pi или через SSH-туннель)"
echo
echo "Важно: USB-COM и USB Audio должны быть подключены до старта (или перезапустите сервис после подключения)."
echo "Подробная инструкция: ${DEST}/deploy/RASPBERRY-PI-HEADLESS.md"
