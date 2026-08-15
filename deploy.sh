#!/usr/bin/env bash
# Deploy setuhire to the VPS for
#   https://setuhire.vaayulabs.com          (web + /api/* -> :3421)
#   http://setuhire.vaayulabs.com/api/      (API routes, proxied by web nginx)
#   http://setuhire.vaayulabs.com/api/docs  (Scalar API docs)
#
# Mirrors the vaayu_docapp deploy pattern:
#   rsync source -> docker compose on the existing vaayu_db network (reuses
#   the already-running postgres/minio containers) -> nginx vhost + Let's
#   Encrypt SSL.
#
# Usage:  bash deploy.sh
set -euo pipefail

SSH_HOST="contabo"
REMOTE_DIR="/var/www/setuhire"
WEB_PORT="3421"
DOMAIN="setuhire.vaayulabs.com"

REPO="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO"

# --- PostgreSQL app credentials (created on the VPS below) ----------------
PG_SUPER_USER="vaayu_admin"
PG_APP_USER="setuhire"
PG_APP_PASSWORD="setuHire@7125!"
PG_DB="app_setuhire"

echo "▶ Checking Docker on ${SSH_HOST}..."
ssh "$SSH_HOST" 'bash -s' <<'REMOTE'
set -e
if command -v docker &>/dev/null; then echo "  Docker: $(docker --version)"; else
  curl -fsSL https://get.docker.com | sh && sudo systemctl enable docker && sudo systemctl start docker
fi
if ! docker ps &>/dev/null 2>&1; then sudo usermod -aG docker "$USER" && echo "  Re-login for docker group"; fi
if ! docker compose version &>/dev/null 2>&1; then sudo apt-get install -y -qq docker-compose-plugin; fi
docker network create vaayu_db 2>/dev/null || true
echo "  network vaayu_db: $(docker network ls --filter name=vaayu_db --format '{{.Name}}')"
REMOTE

echo "▶ Ensuring remote directory..."
ssh "$SSH_HOST" "mkdir -p ${REMOTE_DIR}"

echo "▶ Syncing source (no node_modules/.env/.git/dist)..."
rsync -avz \
  --exclude node_modules --exclude .git --exclude '*.log' --exclude '.DS_Store' \
  --exclude '.env' --exclude '.env.*' --exclude 'dist' --exclude 'coverage' \
  --exclude 'docs' --exclude 'test' \
  ./ "${SSH_HOST}:${REMOTE_DIR}/" 2>/dev/null || true

echo "▶ Creating PostgreSQL database + user on the VPS..."
PGQ() { ssh "$SSH_HOST" "docker exec vaayu-postgres psql -U ${PG_SUPER_USER} -d postgres -c \"$1\"" >/dev/null 2>&1; }
if PGQ "SELECT 1 FROM pg_roles WHERE rolname='${PG_APP_USER}'" ; then
  PGQ "ALTER ROLE ${PG_APP_USER} WITH LOGIN PASSWORD '${PG_APP_PASSWORD}'" || true
else
  PGQ "CREATE ROLE ${PG_APP_USER} LOGIN PASSWORD '${PG_APP_PASSWORD}'" || true
fi
PGQ "CREATE DATABASE ${PG_DB} OWNER ${PG_APP_USER}" || true
PGQ "GRANT ALL PRIVILEGES ON DATABASE ${PG_DB} TO ${PG_APP_USER}" || true

echo "▶ Writing prod .env on server (vaayu_db hostnames)..."
ENC() { node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$1" 2>/dev/null || printf '%s' "$1"; }
ENC_PASS=$(ENC "$PG_APP_PASSWORD")

API_ENV="PORT=3400
SERVICE_NAME=setuhireapi
DB_TYPE=postgres
DB_NAME=${PG_DB}
PG_URI=postgres://${PG_APP_USER}:${ENC_PASS}@postgres:5432/${PG_DB}
OPENAPI_TITLE=setuhireapi API"
ssh "$SSH_HOST" "mkdir -p ${REMOTE_DIR}/packages/backend/setuhireapi"
printf '%s\n' "$API_ENV" | ssh "$SSH_HOST" "cat > ${REMOTE_DIR}/packages/backend/setuhireapi/.env"

WEB_ENV="VITE_API_URL=/api"
ssh "$SSH_HOST" "mkdir -p ${REMOTE_DIR}/packages/web/setuhireweb"
printf '%s\n' "$WEB_ENV" | ssh "$SSH_HOST" "cat > ${REMOTE_DIR}/packages/web/setuhireweb/.env"

ROOT_ENV="VA_DOMAIN=${DOMAIN}
MONGO_ROOT_USER=admin
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=password123"
printf '%s\n' "$ROOT_ENV" | ssh "$SSH_HOST" "cat > ${REMOTE_DIR}/.env"

echo "▶ Building & starting containers on VPS..."
ssh "$SSH_HOST" "cd ${REMOTE_DIR} && docker compose up -d --build"

echo "▶ Setting up nginx + SSL..."
ssh "$SSH_HOST" "cd ${REMOTE_DIR} && bash vps/nginx/setup-nginx.sh" || {
  echo "  nginx setup failed, trying direct config..."
  ssh "$SSH_HOST" "sed 's/{{PORT}}/${WEB_PORT}/g' ${REMOTE_DIR}/nginx/setuhire.conf > /etc/nginx/sites-available/${DOMAIN}.conf && ln -sf /etc/nginx/sites-available/${DOMAIN}.conf /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx"
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Web : https://${DOMAIN}"
echo "  API : https://${DOMAIN}/api"
echo "  Docs: https://${DOMAIN}/api/docs"
echo "  Ensure ${DOMAIN} A-records -> VPS IP, and PG+MinIO run on vaayu_db."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
