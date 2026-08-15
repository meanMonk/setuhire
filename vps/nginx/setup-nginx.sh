#!/usr/bin/env bash
# Set up nginx vhost + Let's Encrypt SSL for setuhire.vaayulabs.com
#   https://setuhire.vaayulabs.com  -> 127.0.0.1:3421  (web container;
#   web proxies /api/ to the API container on vaayu_db)
# Runs on the VPS (Ubuntu) — no Node required.
#
# Usage:
#   bash vps/nginx/setup-nginx.sh          # from the deployed repo on the VPS
set -euo pipefail

CERTBOT_EMAIL="hi@vaayulabs.com"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# The script lives in vps/nginx/, so the repo root is three levels up.
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

DOMAIN="setuhire.vaayulabs.com"
PORT="3421"

CONF="${ROOT}/nginx/setuhire.conf"
DEST="/etc/nginx/sites-available/${DOMAIN}.conf"
LINK="/etc/nginx/sites-enabled/${DOMAIN}.conf"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
CERT_PATH="${CERT_DIR}/fullchain.pem"
WEBROOT="/var/www/certbot"

echo "▶ Setting up nginx + SSL for ${DOMAIN}"

if ! command -v nginx &>/dev/null; then
  echo "▶ Install nginx"
  apt-get update -qq && apt-get install -y nginx
fi

if ! command -v certbot &>/dev/null; then
  echo "▶ Install certbot"
  apt-get install -y certbot python3-certbot-nginx
fi

echo "▶ nginx config: ${DEST}"
sed "s/{{PORT}}/${PORT}/g" "${CONF}" > "${DEST}"
ln -sf "${DEST}" "${LINK}"

mkdir -p "${WEBROOT}"

if [ ! -f "${CERT_PATH}" ]; then
  # First-time SSL: nginx -t would fail on the missing cert, so issue a
  # throwaway self-signed cert at the exact letsencrypt paths. This lets nginx
  # start and serve the port-80 ACME challenge, then certbot replaces it.
  echo "▶ Generate temporary self-signed cert"
  mkdir -p "${CERT_DIR}" "${WEBROOT}"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "${CERT_DIR}/privkey.pem" -out "${CERT_DIR}/fullchain.pem" \
    -subj "/CN=${DOMAIN}"

  echo "▶ Start nginx (temporary cert)"
  nginx -t
  systemctl reload nginx || nginx -s reload || true

  # nginx is now running with the temp cert loaded in memory. Remove the live
  # dir so certbot can create a NEW lineage (it refuses if the live dir exists).
  echo "▶ Remove temp cert so certbot can enroll a new lineage"
  rm -rf "${CERT_DIR}"

  echo "▶ Obtain SSL cert (Let's Encrypt)"
  if certbot certonly --webroot -w "${WEBROOT}" -d "${DOMAIN}" \
    --non-interactive --agree-tos --email "${CERTBOT_EMAIL}"; then
    systemctl reload nginx
    echo "✅ https://${DOMAIN} → 127.0.0.1:${PORT} (real SSL cert)"
  else
    echo "⚠ certbot failed — the site is still up with a TEMPORARY self-signed cert."
    echo "  Ensure DNS A-record ${DOMAIN} → VPS IP, then re-run: bash vps/nginx/setup-nginx.sh"
  fi
else
  # Only reached when a real (non-throwaway) cert exists.
  echo "✔ SSL cert exists"
  nginx -t
  systemctl reload nginx
  echo "✅ https://${DOMAIN} → 127.0.0.1:${PORT}"
fi
