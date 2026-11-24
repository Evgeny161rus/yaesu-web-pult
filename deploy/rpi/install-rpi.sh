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
# RTL-SDR/FTDI USB devices are root:plugdev; without this group rtl_sdr
# cannot open the dongle on a clean Raspberry Pi OS install.
SERVICE_GROUPS="dialout,audio"
if getent group plugdev >/dev/null 2>&1; then
  SERVICE_GROUPS="${SERVICE_GROUPS},plugdev"
fi
usermod -aG "${SERVICE_GROUPS}" "${USER_NAME}" || true

echo "==> Копирование файлов"
mkdir -p "${DEST}"
# Preserve station data on both update paths, including rsync --delete.
RUNTIME_PATHS=(config.json cert.pem key.pem records voice sstv fax memory
  ft8_log.adi cty.dat worked_import.json 'ftx1-pult.log*')
RUNTIME_EXCLUDES=()
RUNTIME_TAR_EXCLUDES=()
for path in "${RUNTIME_PATHS[@]}"; do
  # Anchor to the install root: a bare "cty.dat" would also exclude the
  # bundled server/cty.dat on a fresh install.
  RUNTIME_EXCLUDES+=("--exclude=/${path}")
  RUNTIME_TAR_EXCLUDES+=("--exclude=./${path}")
done
# Prefer rsync if available to keep updates clean; fall back to tar.
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete \
    --exclude '.git' --exclude '.venv' --exclude '__pycache__' --exclude '*.pyc' \
    --exclude 'dist' --exclude 'build' --exclude '*.spec' \
    "${RUNTIME_EXCLUDES[@]}" \
    "${SRC_DIR}/" "${DEST}/"
else
  # Fallback without rsync: exclude runtime files so an update never
  # overwrites the live config/certificates.
  tar -C "${SRC_DIR}" \
    --exclude='.git' --exclude='.venv' --exclude='__pycache__' --exclude='*.pyc' \
    --exclude='dist' --exclude='build' --exclude='*.spec' \
    "${RUNTIME_TAR_EXCLUDES[@]}" \
    -cf - . | tar -C "${DEST}" -xf -
fi
# Stale .pyc from a previous copy can shadow updated sources on the Pi.
find "${DEST}" -type d -name '__pycache__' -prune -exec rm -rf {} + 2>/dev/null || true
find "${DEST}" -type f -name '*.pyc' -delete 2>/dev/null || true

echo "==> Виртуальное окружение Python"
if [[ ! -x "${DEST}/.venv/bin/python" ]]; then
  "${PYTHON_BIN}" -m venv "${DEST}/.venv"
fi
"${DEST}/.venv/bin/pip" install --upgrade pip wheel setuptools
# Tray/GUI packages are harmless on headless but optional; install core deps explicitly.
"${DEST}/.venv/bin/pip" install "numpy>=1.24" "pyserial>=3.5" "sounddevice>=0.4.6" "cryptography>=41"

echo "==> Модуль FT8 (_ftx)"
if ( cd "${DEST}/server" && "${DEST}/.venv/bin/python" setup_ftx.py build_ext --inplace ); then
  echo "    _ftx собран"
else
  echo "    Предупреждение: _ftx не собрался (нужны build-essential и python3-dev). FT8/FT4 будут недоступны."
fi

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
# Restore ownership of all preserved runtime data, not just config.json.
touch "${DEST}/config.json" 2>/dev/null || true
chown -R root:root "${DEST}"
chown "${USER_NAME}:${USER_NAME}" "${DEST}"
for pattern in "${RUNTIME_PATHS[@]}"; do
  while IFS= read -r -d '' path; do
    chown -R "${USER_NAME}:${USER_NAME}" "$path"
  done < <(find "${DEST}" -mindepth 1 -maxdepth 1 -name "$pattern" -print0)
done

echo "==> systemd unit"
install -m 0644 "${DEST}/deploy/yaesu-web-pult.service" /etc/systemd/system/yaesu-web-pult.service
systemctl daemon-reload
systemctl enable yaesu-web-pult.service

# --- Интерактивное меню настройки (whiptail, как raspi-config) ---
tui_config() {
  local PY="${DEST}/.venv/bin/python" CLI="${DEST}/server/config_cli.py"
  local val cur opts dev desc name flags id mid

  cfg_get() { "$PY" "$CLI" get "$1"; }
  cfg_set() { "$PY" "$CLI" set "$1" "$2" >/dev/null; }
  cfg_set_raw() { "$PY" "$CLI" setraw "$1" >/dev/null; }

  tui_ports() {
    local key="$1"
    opts=()
    while IFS=$'\t' read -r dev desc; do
      [ -n "$dev" ] || continue
      opts+=("$dev" "${desc:-$dev}")
    done < <("$PY" "$CLI" ports)
    if [ ${#opts[@]} -eq 0 ]; then
      whiptail --title "Порты" --msgbox "COM/tty-порты не найдены. Подключите трансивер и повторите." 0 0
      return
    fi
    val=$(whiptail --title "Порты" --menu "Выберите порт" 0 0 0 "${opts[@]}" 3>&1 1>&2 2>&3) || return
    [ -n "$val" ] && cfg_set "$key" "\"$val\""
  }

  tui_radio() {
    cur="$(cfg_get radio_backend)"
    val=$(whiptail --title "Трансивер" --radiolist "Драйвер трансивера" 0 0 2 \
      "native" "FTX-1 — расширенное управление" "$([ "$cur" = native ] && echo ON || echo OFF)" \
      "hamlib" "Любой трансивер — Hamlib/CAT" "$([ "$cur" = hamlib ] && echo ON || echo OFF)" \
      3>&1 1>&2 2>&3) || return
    cfg_set radio_backend "\"$val\""

    if [ "$val" = hamlib ]; then
      opts=()
      while IFS=$'\t' read -r id name; do
        [ -n "$id" ] || continue
        opts+=("$id" "${name:0:60}")
      done < <("$PY" "$CLI" hamlib)
      if [ ${#opts[@]} -gt 0 ]; then
        mid=$(whiptail --title "Трансивер" --menu "Модель Hamlib" 0 0 0 "${opts[@]}" 3>&1 1>&2 2>&3) || return
        [ -n "$mid" ] && cfg_set hamlib_model "$mid"
      else
        whiptail --title "Трансивер" --msgbox "Список Hamlib пуст (проверьте rigctld)." 0 0
      fi
    fi

    tui_ports cat_port
    val=$(whiptail --title "Трансивер" --menu "Скорость CAT" 0 0 0 \
      "4800" "" "9600" "" "19200" "" "38400" " (по умолчанию)" "115200" "" 3>&1 1>&2 2>&3) || return
    [ -n "$val" ] && cfg_set cat_baud "$val"
  }

  tui_audio() {
    local kind key
    for kind in in out; do
      key="audio_${kind}_name"
      opts=()
      while IFS=$'\t' read -r name flags; do
        [ -n "$name" ] || continue
        case "$flags" in *"$kind"*) opts+=("$name" "$name") ;; esac
      done < <("$PY" "$CLI" audio)
      val=$(whiptail --title "Звук" --menu "$([ "$kind" = in ] && echo 'Звук приёма' || echo 'Звук передачи')" 0 0 0 \
        "" "(авто)" "${opts[@]}" 3>&1 1>&2 2>&3) || return
      cfg_set "$key" "\"$val\""
    done
  }

  tui_ptt() {
    cur="$(cfg_get ptt_method)"
    val=$(whiptail --title "PTT" --radiolist "Способ PTT" 0 0 4 \
      "TX1" "Командой CAT (рекомендуется)" "$([ "$cur" = TX1 ] && echo ON || echo OFF)" \
      "TX2" "Командой CAT (DATA)" "$([ "$cur" = TX2 ] && echo ON || echo OFF)" \
      "RTS" "Линией RTS порта" "$([ "$cur" = RTS ] && echo ON || echo OFF)" \
      "DTR" "Линией DTR порта" "$([ "$cur" = DTR ] && echo ON || echo OFF)" \
      3>&1 1>&2 2>&3) || return
    cfg_set ptt_method "\"$val\""
    if [ "$val" = RTS ] || [ "$val" = DTR ]; then
      tui_ports ptt_port
    fi
  }

  tui_wf() {
    cur="$(cfg_get waterfall_source)"
    val=$(whiptail --title "Водопад" --radiolist "Источник водопада" 0 0 4 \
      "auto" "Авто" "$([ "$cur" = auto ] && echo ON || echo OFF)" \
      "audio" "По звуку USB-кодека" "$([ "$cur" = audio ] && echo ON || echo OFF)" \
      "rtlsdr" "RTL-SDR / внешний SDR" "$([ "$cur" = rtlsdr ] && echo ON || echo OFF)" \
      "sdr" "SoapySDR (rx_sdr)" "$([ "$cur" = sdr ] && echo ON || echo OFF)" \
      3>&1 1>&2 2>&3) || return
    cfg_set waterfall_source "\"$val\""
    case "$val" in
      sdr) cfg_set sdr_driver '"rx_sdr"' ;;
      rtlsdr) cfg_set sdr_driver '"rtlsdr"' ;;
    esac
  }

  tui_pw() {
    local pw1 pw2
    pw1=$(whiptail --title "Пароль панели" --passwordbox "Пароль для входа в панель по сети (пусто — запретить удалённый вход):" 0 0 3>&1 1>&2 2>&3) || return
    if [ -n "$pw1" ]; then
      pw2=$(whiptail --title "Пароль панели" --passwordbox "Повторите пароль:" 0 0 3>&1 1>&2 2>&3) || return
      if [ "$pw1" != "$pw2" ]; then
        whiptail --title "Пароль панели" --msgbox "Пароли не совпадают." 0 0
      else
        printf '%s' "$pw1" | cfg_set_raw password
      fi
    else
      printf '%s' "" | cfg_set_raw password
    fi
  }

  while true; do
    val=$(whiptail --title "Yaesu Web Pult — настройка" --menu "Выберите пункт" 0 0 0 \
      "radio" "Трансивер и CAT" \
      "audio" "Звук (приём/передача)" \
      "ptt"   "PTT (передача)" \
      "wf"    "Водопад / SDR" \
      "pw"    "Пароль панели" \
      "done"  "Сохранить и перезапустить" \
      "exit"  "Выйти без перезапуска" \
      3>&1 1>&2 2>&3) || break
    case "$val" in
      radio) tui_radio ;;
      audio) tui_audio ;;
      ptt)   tui_ptt ;;
      wf)    tui_wf ;;
      pw)    tui_pw ;;
      done)
        systemctl restart yaesu-web-pult
        whiptail --title "Yaesu Web Pult" --msgbox "Сервис перезапущен.\nПанель: http://$(hostname -I | awk '{print $1}'):8080/panel.html" 0 0
        break ;;
      exit) break ;;
    esac
  done
}

# --- Запуск настройки ---
CFG="${DEST}/config.json"
if [ -t 0 ]; then
  echo
  echo "==> Настройка"
  if command -v whiptail >/dev/null 2>&1 || apt-get install -y whiptail >/dev/null 2>&1; then
    tui_config
  else
    echo "    whiptail недоступен — настройка пропущена. Задайте пароль вручную: sudo nano ${CFG}"
  fi
else
  echo
  echo "    Неинтерактивный режим: настройка пропущена. Задайте позже: sudo nano ${CFG}"
fi
chown "${USER_NAME}:${USER_NAME}" "${CFG}" 2>/dev/null || true

echo
echo "Готово. Дальнейшие шаги:"
echo "  1. Настройте параметры (рекомендуется интерактивно по SSH, с автоопределением порта/звука и опросом трансивера):"
echo "       sudo -u yaesu ${DEST}/.venv/bin/python ${DEST}/server/configure.py"
echo "     или вручную: sudo nano ${DEST}/config.json"
echo "     (CAT-порт: обычно /dev/ttyUSB0 или путь из /dev/serial/by-id/...; cat_baud как в меню трансивера;"
echo "      пароль можно изменить в config.json или через configure.py; audio_in_name/audio_out_name — имя USB Audio CODEC при необходимости.)"
echo "  2. Запуск:   sudo systemctl start yaesu-web-pult"
echo "  3. Журнал:   sudo journalctl -u yaesu-web-pult -f"
echo "  4. Статус:   sudo systemctl status yaesu-web-pult"
echo "  5. Пульт:    https://<IP-Raspberry-Pi>:8443/  (панель: http://127.0.0.1:8080/panel локально на Pi или через SSH-туннель)"
echo
echo "Важно: USB-COM и USB Audio должны быть подключены до старта (или перезапустите сервис после подключения)."
echo "Подробная инструкция: ${DEST}/deploy/RASPBERRY-PI-HEADLESS.md"
