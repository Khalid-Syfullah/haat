#!/usr/bin/env bash
# Builds one commit of Haat into a new release, migrates the database, moves traffic to it
# and health-checks it. If the check fails, the previous release is put back.
#
# Runs on the server as the app user (ubuntu). The /usr/local/bin/haat-deploy wrapper
# (installed by server-setup.sh) fetches this file from the commit being deployed, so the
# script always matches the code it deploys:
#
#   sudo -u ubuntu -H haat-deploy <commit-sha | branch>
set -euo pipefail

SHA="${1:?usage: haat-deploy <commit-sha>}"
APP=/var/www/haat
SRC="$APP/src"
KEEP=3
API_PORT=4100
WEB_PORT=3100

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

exec 9>"$APP/.deploy.lock"
flock -n 9 || { log "Another deploy is running. Try again when it finishes."; exit 1; }

# Settings shared by every release (database URL, secrets, public URL). Never in git.
set -a
# shellcheck disable=SC1091
. "$APP/shared/api.env"
set +a
SITE_URL="${WEB_URL:?WEB_URL missing from shared/api.env}"

# 1. Code at the exact commit
git -C "$SRC" cat-file -e "$SHA^{commit}"
TS=$(date -u +%Y%m%d%H%M%S)
REL="$APP/releases/$TS"
mkdir -p "$REL"
git -C "$SRC" archive "$SHA" | tar -x -C "$REL"
echo "$SHA" >"$REL/REVISION"
log "Release $TS for ${SHA:0:7}"

PREV=$(readlink -f "$APP/current" 2>/dev/null || true)
SWITCHED=0
fail() {
  trap - ERR
  log "Deploy failed: $*"
  if [ "$SWITCHED" = 1 ] && [ -n "$PREV" ] && [ -d "$PREV" ]; then
    ln -sfn "$PREV" "$APP/current.tmp" && mv -Tf "$APP/current.tmp" "$APP/current"
    pm2 startOrReload "$APP/ecosystem.config.cjs" --update-env >/dev/null || true
    log "Restored the previous release $(basename "$PREV")"
    rm -rf "$REL"
  elif [ "$SWITCHED" = 0 ]; then
    rm -rf "$REL" # traffic never moved; the live release is untouched
  fi
  exit 1
}
trap 'fail "command on line $LINENO"' ERR

# 2. Install and build. NODE_ENV stays unset here so npm installs the build tools.
cd "$REL"
ln -sfn "$APP/shared/api.env" "$REL/apps/api/.env"
export NEXT_TELEMETRY_DISABLED=1 CI=1 PRISMA_HIDE_UPDATE_MESSAGE=1
log "Installing dependencies"
npm ci --no-audit --no-fund --loglevel=error || fail "npm ci"
log "Building API and web"
API_URL="http://127.0.0.1:$API_PORT" SITE_URL="$SITE_URL" NODE_OPTIONS=--max-old-space-size=1536 npm run build || fail "build"
rm -rf apps/web/.next/cache

# 3. Database migrations run before traffic moves, so they must stay backwards compatible
#    with the release that is still serving (add columns and tables; drop them a release later).
log "Applying database migrations"
(cd apps/api && npx prisma migrate deploy) || fail "migrations"

# 4. Product images that ship with the code; customer uploads live in shared/uploads.
mkdir -p "$APP/shared/uploads"
if [ -d apps/api/uploads/seed ]; then mkdir -p "$APP/shared/uploads/seed" && cp -a apps/api/uploads/seed/. "$APP/shared/uploads/seed/"; fi

# 5. Switch traffic
cp deploy/ecosystem.config.cjs "$APP/ecosystem.config.cjs"
ln -sfn "$REL" "$APP/current.tmp" && mv -Tf "$APP/current.tmp" "$APP/current"
SWITCHED=1
pm2 startOrReload "$APP/ecosystem.config.cjs" --update-env || fail "pm2 reload"

# 6. Health check: the API answers and the storefront renders
healthy() {
  for _ in $(seq 1 45); do
    if curl -fsS -o /dev/null "http://127.0.0.1:$API_PORT/api/health" && curl -fsS -o /dev/null "http://127.0.0.1:$WEB_PORT/"; then
      return 0
    fi
    sleep 2
  done
  return 1
}
if ! healthy; then
  pm2 logs haat-api --nostream --lines 30 || true
  pm2 logs haat-web --nostream --lines 30 || true
  fail "health check"
fi
pm2 save --force >/dev/null

# 7. Keep the newest releases only
find "$APP/releases" -mindepth 1 -maxdepth 1 -type d | sort -r | tail -n +$((KEEP + 1)) | xargs -r rm -rf
log "Live: ${SHA:0:7} ($TS)"
