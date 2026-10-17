#!/usr/bin/env bash
# One-time preparation of the EC2 instance for Tuktak Bazaar. Safe to re-run: it never overwrites the
# database password, JWT secret or other values already in shared/api.env.
# Run as root:  sudo bash deploy/server-setup.sh
set -euo pipefail

APP=/var/www/haat
APP_USER=ubuntu
DOMAIN=production.khalidsyfullah.com
REPO=https://github.com/Khalid-Syfullah/haat.git

# Node 20.9+ and pm2 run the apps. Install Node yourself (e.g. NodeSource 22.x) if it's missing.
NODE_OK=$(node -p 'const [a, b] = process.versions.node.split(".").map(Number); a > 20 || (a === 20 && b >= 9) ? 1 : 0' 2>/dev/null || echo 0)
if [ "$NODE_OK" != 1 ]; then
  echo "Node.js 20.9 or newer is required (found: $(node -v 2>/dev/null || echo none)). Install Node 22, then run this again." >&2
  exit 1
fi
command -v pm2 >/dev/null || npm install -g pm2@6 --silent

# PostgreSQL 16 (Ubuntu 24.04), listening on localhost only
if ! command -v psql >/dev/null; then
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql >/dev/null
fi
systemctl enable --now postgresql >/dev/null

mkdir -p "$APP/releases" "$APP/shared/uploads"
chown -R "$APP_USER:$APP_USER" "$APP"

ENV_FILE="$APP/shared/api.env"
if [ ! -f "$ENV_FILE" ]; then
  DB_PASS=$(openssl rand -hex 24)
  JWT=$(openssl rand -hex 48)
  sudo -u postgres psql -qtAc "SELECT 1 FROM pg_roles WHERE rolname='haat'" | grep -q 1 ||
    sudo -u postgres psql -qc "CREATE ROLE haat LOGIN PASSWORD '$DB_PASS'"
  sudo -u postgres psql -qc "ALTER ROLE haat PASSWORD '$DB_PASS'"
  sudo -u postgres psql -qtAc "SELECT 1 FROM pg_database WHERE datname='haat'" | grep -q 1 ||
    sudo -u postgres createdb -O haat haat
  # The init migration creates pg_trgm, which needs a superuser the first time.
  sudo -u postgres psql -q -d haat -c "CREATE EXTENSION IF NOT EXISTS pg_trgm"
  umask 077
  cat >"$ENV_FILE" <<EOF
DATABASE_URL="postgresql://haat:$DB_PASS@127.0.0.1:5432/haat?schema=public"
JWT_SECRET="$JWT"
JWT_EXPIRES_DAYS=7
COOKIE_SECURE=true
WEB_URL="https://$DOMAIN"
API_PUBLIC_URL="https://$DOMAIN"
UPLOAD_DIR="$APP/shared/uploads"
PAYMENT_PROVIDER=mock
SMS_PROVIDER=console
EOF
  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi

# Source checkout the deploy script builds releases from (public repo, read-only)
if [ ! -d "$APP/src/.git" ]; then
  sudo -u "$APP_USER" git clone --quiet "$REPO" "$APP/src"
fi

# Wrapper: fetch, then run the deploy script from the commit being deployed
cat >/usr/local/bin/haat-deploy <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
REF="${1:?usage: haat-deploy <commit-sha | branch>}"
SRC=/var/www/haat/src
if [ "$(id -un)" != "ubuntu" ]; then exec sudo -u ubuntu -H "$0" "$@"; fi
git -C "$SRC" fetch --quiet --prune --tags origin '+refs/heads/*:refs/remotes/origin/*'
# A branch name means the branch as GitHub has it now, never the clone's stale local copy.
if [[ "$REF" =~ ^[0-9a-f]{7,40}$ ]]; then
  SHA=$(git -C "$SRC" rev-parse --verify "$REF^{commit}")
else
  SHA=$(git -C "$SRC" rev-parse --verify --quiet "origin/$REF^{commit}" || git -C "$SRC" rev-parse --verify "$REF^{commit}")
fi
SCRIPT=$(mktemp /tmp/haat-deploy.XXXXXX)
trap 'rm -f "$SCRIPT"' EXIT
git -C "$SRC" show "$SHA:deploy/haat-deploy.sh" >"$SCRIPT"
bash "$SCRIPT" "$SHA"
EOF
chmod 755 /usr/local/bin/haat-deploy

# Start pm2 (and so Tuktak Bazaar) again after a reboot
if ! systemctl is-enabled "pm2-$APP_USER" >/dev/null 2>&1; then
  env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" >/dev/null
fi

echo "Server ready. Deploy with: sudo -u $APP_USER -H haat-deploy main"
