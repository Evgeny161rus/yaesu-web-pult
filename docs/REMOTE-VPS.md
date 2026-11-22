# Удалённый доступ через VPS (WireGuard + Nginx)

Схема:

```
Pi  --WireGuard (исходящее)-->  VPS  --HTTPS/TLS-->  браузер
```

Дом открывает **только исходящее** соединение. Входящие порты дома не нужны,
поэтому схема работает за CGNAT и не зависит от смены домашнего IP.

## Что нужно

| Компонент | Требование |
|---|---|
| VPS | 1 vCPU, 1 GB RAM, 10–20 GB SSD, 1 TB/мес, публичный IPv4, Debian 12 / Ubuntu 22.04+ |
| Домен | любой, например `pult.example.com` (A-запись на IP VPS) |
| Pi | уже работающий пульт на `https://<pi>:8443`, включённый `yaesu-web-pult` |
| Интернет дома | стабильный, upload 5–10 Mbps, RTT до VPS < 50 ms |
| Сертификат | Let's Encrypt через certbot (бесплатно) |

Ориентир по цене: VPS ~250–400 ₽/мес + домен ~200–300 ₽/год.

## 1. Подготовка VPS

```bash
# от root или через sudo
apt update && apt full-upgrade -y
apt install -y wireguard nginx certbot python3-certbot-nginx ufw fail2ban unattended-upgrades curl
systemctl enable --now nginx
systemctl enable --now fail2ban
systemctl enable --now unattended-upgrades
```

SSH: используйте ключи, после проверки входа отключите пароль:

```bash
# /etc/ssh/sshd_config
PasswordAuthentication no
PermitRootLogin prohibit-password
```

Перезапуск SSH: `systemctl reload ssh`.

## 2. Ключи WireGuard на Pi

```bash
sudo apt install -y wireguard
sudo mkdir -p /etc/wireguard && sudo chmod 700 /etc/wireguard
sudo sh -c 'umask 077; wg genkey > /etc/wireguard/pi.key'
sudo sh -c 'wg pubkey < /etc/wireguard/pi.key'
```

Последняя команда печатает **публичный ключ Pi**. Он понадобится на VPS.

## 3. VPS: WireGuard + Nginx

Можно вручную или скриптом `deploy/vps/setup-vps.sh`.

### 3.1 WireGuard

```bash
sudo sh -c 'umask 077; wg genkey > /etc/wireguard/vps.key'
sudo sh -c 'wg pubkey < /etc/wireguard/vps.key'   # публичный ключ VPS
```

`/etc/wireguard/wg0.conf`:

```ini
[Interface]
Address = 10.8.0.1/24
ListenPort = 51820
PrivateKey = <VPS_PRIVATE_KEY>

[Peer]
# Raspberry Pi
PublicKey = <PI_PUBLIC_KEY>
AllowedIPs = 10.8.0.2/32
```

```bash
sudo chmod 600 /etc/wireguard/wg0.conf /etc/wireguard/vps.key
sudo systemctl enable --now wg-quick@wg0
```

### 3.2 Nginx + Let's Encrypt

Сначала HTTP-конфиг для проверки домена:

`/etc/nginx/sites-available/yaesu-web-pult`:

```nginx
server {
    listen 80;
    server_name pult.example.com;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://$host$request_uri; }
}
```

```bash
sudo ln -sf /etc/nginx/sites-available/yaesu-web-pult /etc/nginx/sites-enabled/yaesu-web-pult
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot certonly --nginx -d pult.example.com --non-interactive --agree-tos -m admin@example.com
```

Затем полный конфиг:

`/etc/nginx/conf.d/websocket-upgrade.conf`:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

`/etc/nginx/sites-available/yaesu-web-pult`:

```nginx
server {
    listen 80;
    server_name pult.example.com;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name pult.example.com;

    ssl_certificate     /etc/letsencrypt/live/pult.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pult.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass https://10.8.0.2:8443;
        proxy_ssl_verify off;              # Pi использует self-signed сертификат
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $http_host;   # важно для valid_origin()
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;                # важно для аудио
        proxy_request_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_connect_timeout 10s;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo systemctl enable --now certbot.timer
```

> Проксировать нужно именно на **8443 (HTTPS)**, а не на 8080: приложение проверяет `Origin` и TLS-сокет.

### 3.3 Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 51820/udp
sudo ufw --force enable
```

Если SSH-IP постоянный, лучше `ufw allow from <ADMIN_IP> to any port 22 proto tcp`.

## 4. Pi: WireGuard-клиент

`/etc/wireguard/wg0.conf`:

```ini
[Interface]
Address = 10.8.0.2/24
PrivateKey = <PI_PRIVATE_KEY>

[Peer]
PublicKey = <VPS_PUBLIC_KEY>
Endpoint = <VPS_IP>:51820
AllowedIPs = 10.8.0.1/32
PersistentKeepalive = 25
```

```bash
sudo chmod 600 /etc/wireguard/wg0.conf
sudo systemctl enable --now wg-quick@wg0
sudo wg show
```

В `wg show` должен появиться handshake. Если Pi использует UFW:

```bash
sudo ufw allow from 10.8.0.1 to any port 8443 proto tcp
```

## 5. DNS

A-запись:

```
pult.example.com.  A  <VPS_IP>
```

Если домен в Cloudflare, для certbot HTTP-01 включите **DNS only** (серое облако),
либо используйте DNS-01.

## 6. Проверка

```bash
# на VPS
curl -I https://pult.example.com/
wg show
systemctl status nginx wg-quick@wg0

# с телефона/ПК
https://pult.example.com/
```

Проверить в браузере:

- панель открывается по HTTPS с валидным сертификатом;
- вход по паролю;
- звук приёма идёт;
- микрофон (TX) работает: браузер запросит разрешение (нужен HTTPS);
- PTT срабатывает, задержка приемлемая;
- в пульте `audioStat` без роста underruns.

## 7. Стабильность

- **WireGuard**: `PersistentKeepalive = 25` на Pi, `systemctl enable wg-quick@wg0`.
- **Nginx**: `proxy_buffering off`, длинные таймауты, `systemctl enable nginx`.
- **TLS**: `certbot.timer` включён; сертификат продлевается автоматически.
- **Питание**: UPS для Pi и роутера; проводной Ethernet до Pi.
- **Пароль панели**: длинный случайный (16+ символов), не `1234`.
- **PTT**: `max_tx_seconds` 30–60 с на первое время.
- **Мониторинг**: cron/systemd timer с `deploy/vps/healthcheck.sh`.
- **Обновления**: `unattended-upgrades`, периодический `apt upgrade`.
- **Снапшоты VPS** перед изменениями.

## 8. Диагностика

| Симптом | Что проверить |
|---|---|
| `wg show` без handshake | `Endpoint`, `PublicKey`, UDP 51820, время на Pi/VPS (NTP) |
| 502 Bad Gateway | Pi доступен по `10.8.0.2:8443`, сервис `yaesu-web-pult` активен |
| WebSocket 403 `origin denied` | Nginx не сохраняет `Host`; нужен `proxy_set_header Host $http_host` |
| Нет звука, но управление работает | `proxy_buffering off`, таймауты WebSocket |
| Микрофон не работает | нет HTTPS/валидного сертификата, нет разрешения браузера |
| Аудио рвётся | 8 кГц в пульте, ближе VPS, проводной интернет, проверить потери |
| Сертификат не выпускается | A-запись, порт 80, Cloudflare proxy выключен |

## 9. Безопасность

- Панель защищена паролем приложения; VPS не добавляет свою авторизацию.
- 8080 на Pi остаётся localhost-only; наружу — только 8443 через WireGuard.
- SSH только по ключам, fail2ban, UFW.
- Не коммитьте `wg0.conf`, приватные ключи и `config.json` в git.
- VPS видит PCM-аудио (TLS терминируется на нём). Если это неприемлемо —
  используйте WireGuard/Tailscale от клиента до Pi или TLS passthrough.
