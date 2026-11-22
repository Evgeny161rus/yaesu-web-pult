#!/usr/bin/env bash
# VPS side: WireGuard + Nginx + Let's Encrypt + UFW.
# Usage:
#   sudo bash setup-vps.sh <domain> <pi_public_key> <letsencrypt_email> [wg_port]
#
# Run this after generating the Pi WireGuard key (see docs/REMOTE-VPS.md).
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: sudo bash setup-vps.sh <domain> <pi_public_key> <letsencrypt_email> [wg_port]

Example:
  sudo bash setup-vps.sh pult.example.com 'AbCd...PI_PUBLIC_KEY...' admin@example.com 51820
EOF
  exit 1
}

DOMAIN="${1:-}"
PI_PUB="${2:-}"
EMAIL="${3:-}"
WG_PORT="${4:-51820}"
[[ -n "$DOMAIN" && -n "$PI_PUB" && -n "$EMAIL" ]] || usage
[[ $EUID -eq 0 ]] || { echo "Run as root (sudo)." >&2; exit 1; }

if ! getent hosts "$DOMAIN" >/dev/null 2>&1; then
  echo "DNS: $DOMAIN does not resolve yet. Create an A record to this VPS first." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y wireguard nginx certbot python3-certbot-nginx ufw fail2ban unattended-upgrades curl

# --- WireGuard ---
umask 077
mkdir -p /etc/wireguard
if [[ ! -f /etc/wireguard/vps.key ]]; then
  wg genkey > /etc/wireguard/vps.key
fi
VPS_PRIV="$(cat /etc/wireguard/vps.key)"
VPS_PUB="$(printf '%s' "$VPS_PRIV" | wg pubkey)"

if [[ -f /etc/wireguard/wg0.conf ]]; then
  cp -a /etc/wireguard/wg0.conf "/etc/wireguard/wg0.conf.bak.$(date +%s)"
fi
cat > /etc/wireguard/wg0.conf <<EOF
[Interface]
Address = 10.8.0.1/24
ListenPort = $WG_PORT
PrivateKey = $VPS_PRIV

[Peer]
# Raspberry Pi
PublicKey = $PI_PUB
AllowedIPs = 10.8.0.2/32
EOF
chmod 600 /etc/wireguard/wg0.conf /etc/wireguard/vps.key
systemctl enable --now wg-quick@wg0

# --- Nginx: temporary HTTP config for ACME ---
cat > /etc/nginx/sites-available/yaesu-web-pult <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://\$host\$request_uri; }
}
EOF
ln -sf /etc/nginx/sites-available/yaesu-web-pult /etc/nginx/sites-enabled/yaesu-web-pult
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

if [[ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
  certbot certonly --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL"
fi

# --- Nginx: WebSocket map + HTTPS proxy ---
cat > /etc/nginx/conf.d/websocket-upgrade.conf <<'EOF'
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
EOF

cat > /etc/nginx/sites-available/yaesu-web-pult <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://\$host\$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        # Pi's own HTTPS port, reached over WireGuard.
        proxy_pass https://10.8.0.2:8443;
        proxy_ssl_verify off;              # Pi uses a self-signed certificate
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_set_header Host \$http_host;  # required by valid_origin()
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;               # real-time audio
        proxy_request_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_connect_timeout 10s;
    }
}
EOF
nginx -t
systemctl reload nginx
systemctl enable --now certbot.timer

# --- Firewall ---
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH || ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow "$WG_PORT"/udp
ufw --force enable

systemctl enable --now fail2ban
systemctl enable --now unattended-upgrades

VPS_IP="$(curl -4 -fsS --max-time 10 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"

cat <<EOF

Готово.

VPS public key: $VPS_PUB
VPS endpoint:   $VPS_IP:$WG_PORT

Pi /etc/wireguard/wg0.conf:
[Interface]
Address = 10.8.0.2/24
PrivateKey = <PI_PRIVATE_KEY>

[Peer]
PublicKey = $VPS_PUB
Endpoint = $VPS_IP:$WG_PORT
AllowedIPs = 10.8.0.1/32
PersistentKeepalive = 25
EOF
