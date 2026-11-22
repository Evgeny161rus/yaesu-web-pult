#!/usr/bin/env bash
# Pi side: WireGuard client for the remote VPS.
#
# Step 1 (on Pi): generate the key and print the public key
#   sudo bash setup-pi-wg.sh init
#
# Step 2 (on VPS): run setup-vps.sh with that public key.
#
# Step 3 (on Pi): write the client config and start WireGuard
#   sudo bash setup-pi-wg.sh configure <VPS_IP>:51820 <VPS_PUBLIC_KEY>
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  sudo bash setup-pi-wg.sh init
  sudo bash setup-pi-wg.sh configure <VPS_IP>:51820 <VPS_PUBLIC_KEY>
EOF
  exit 1
}

[[ $EUID -eq 0 ]] || { echo "Run as root (sudo)." >&2; exit 1; }
MODE="${1:-}"

install_wg() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y wireguard
  mkdir -p /etc/wireguard
  chmod 700 /etc/wireguard
}

case "$MODE" in
  init)
    install_wg
    if [[ ! -f /etc/wireguard/pi.key ]]; then
      (umask 077; wg genkey > /etc/wireguard/pi.key)
    fi
    chmod 600 /etc/wireguard/pi.key
    echo "Pi public key:"
    wg pubkey < /etc/wireguard/pi.key
    echo
    echo "Pass this key to setup-vps.sh on the VPS."
    ;;
  configure)
    VPS_ENDPOINT="${2:-}"
    VPS_PUB="${3:-}"
    [[ -n "$VPS_ENDPOINT" && -n "$VPS_PUB" ]] || usage
    [[ -f /etc/wireguard/pi.key ]] || { echo "Run 'init' first." >&2; exit 1; }
    install_wg
    PI_PRIV="$(cat /etc/wireguard/pi.key)"
    if [[ -f /etc/wireguard/wg0.conf ]]; then
      cp -a /etc/wireguard/wg0.conf "/etc/wireguard/wg0.conf.bak.$(date +%s)"
    fi
    cat > /etc/wireguard/wg0.conf <<EOF
[Interface]
Address = 10.8.0.2/24
PrivateKey = $PI_PRIV

[Peer]
PublicKey = $VPS_PUB
Endpoint = $VPS_ENDPOINT
AllowedIPs = 10.8.0.1/32
PersistentKeepalive = 25
EOF
    chmod 600 /etc/wireguard/wg0.conf
    systemctl enable --now wg-quick@wg0

    # If the Pi firewall is enabled, allow the VPS to reach the HTTPS port.
    if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
      ufw allow from 10.8.0.1 to any port 8443 proto tcp
    fi

    echo "WireGuard started."
    echo "Check: wg show"
    echo "Then on the VPS: curl -k https://10.8.0.2:8443/panel.html"
    ;;
  *)
    usage
    ;;
esac
