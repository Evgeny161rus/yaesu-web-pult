#!/usr/bin/env bash
# VPS healthcheck for the remote-control tunnel.
# Usage: bash healthcheck.sh pult.example.com
set -u

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "Usage: $0 <domain>" >&2
  exit 2
fi

fail=0

if ! systemctl is-active --quiet wg-quick@wg0; then
  echo "FAIL wg-quick@wg0 is not active"
  fail=1
fi

hs="$(wg show wg0 latest-handshakes 2>/dev/null | awk 'NR==1{print $2}')"
now="$(date +%s)"
if [[ -z "${hs:-}" || "$hs" -eq 0 || $((now - hs)) -gt 180 ]]; then
  echo "FAIL WireGuard handshake (${hs:-none})"
  fail=1
fi

if ! systemctl is-active --quiet nginx; then
  echo "FAIL nginx is not active"
  fail=1
fi

code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$DOMAIN/" 2>/dev/null || echo 000)"
if [[ "$code" != "200" ]]; then
  echo "FAIL https://$DOMAIN/ -> $code"
  fail=1
fi

if [[ $fail -eq 0 ]]; then
  echo "OK"
fi
exit $fail
