# Deployment

Tuktak Bazaar runs on one EC2 instance (t4g.small, Ubuntu 24.04, ap-southeast-2) behind nginx at
https://production.khalidsyfullah.com. PostgreSQL 16 runs on the same machine.

The server-side names still say `haat` (`/var/www/haat`, the `haat-api` and `haat-web` pm2 apps,
the `haat` database, the `haat-deploy` command, the `haat-github-deploy` role and this repository).
They are internal and were kept on purpose when the store was renamed, so nothing on the running
server had to move.

## How a deploy works

1. Push or merge to `main` (or run **Deploy** by hand from the Actions tab on `main`).
2. `deploy.yml` runs the CI workflow first: type-check, both builds, migrations, seed and the
   end-to-end checks against a throwaway Postgres. If CI fails, nothing is deployed.
3. It assumes the AWS role `haat-github-deploy` through GitHub OIDC (no stored keys), which
   may only send a shell command to this one instance.
4. On the instance, `/usr/local/bin/haat-deploy <sha>` fetches the repo and runs
   `deploy/haat-deploy.sh` from that same commit, which:
   - unpacks the commit into `/var/www/haat/releases/<timestamp>`,
   - runs `npm ci` and `npm run build`,
   - applies Prisma migrations,
   - points `/var/www/haat/current` at the new release and reloads pm2,
   - health-checks the API and the storefront. If either fails, the previous release is put
     back and the job fails. The newest 3 releases are kept.
5. The workflow checks that `https://production.khalidsyfullah.com/api/health` reports the
   deployed commit.

Pull requests run CI only.

## Layout on the server

| Path | What it is |
|---|---|
| `/var/www/haat/current` | symlink to the live release |
| `/var/www/haat/releases/*` | built releases |
| `/var/www/haat/src` | git checkout the releases are cut from |
| `/var/www/haat/shared/api.env` | database URL, JWT secret, public URL, provider settings (mode 600, never in git) |
| `/var/www/haat/shared/uploads` | uploaded images; seed images are copied in on each deploy |
| `/var/www/haat/ecosystem.config.cjs` | pm2 apps `haat-api` (port 4100) and `haat-web` (port 3100) |
| `/etc/nginx/sites-available/haat` | copy of `deploy/nginx/haat.conf` |
| `/usr/local/bin/haat-deploy` | wrapper installed by `deploy/server-setup.sh` |

nginx sends `/api/*` and `/uploads/*` straight to the API and everything else to Next.js.

## Changing settings on the server

Edit `/var/www/haat/shared/api.env` (for example to switch `PAYMENT_PROVIDER=sslcommerz` and add
the SSLCommerz store ID and password), then reload:

```bash
sudo -u ubuntu -H pm2 startOrReload /var/www/haat/ecosystem.config.cjs --update-env
```

## Migrations

Migrations run before traffic moves to the new release, while the old one is still serving.
Keep them backwards compatible: add tables and columns first, and drop old ones in a later
release once no running code reads them.

## Rollback

Open an older successful **Deploy** run in the Actions tab and choose **Re-run all jobs** (it
deploys that run's commit), or on the server:

```bash
sudo -u ubuntu -H haat-deploy <older-sha>
```

## One-time setup (already done)

1. `sudo bash deploy/server-setup.sh` installs PostgreSQL, creates the `haat` database and
   `shared/api.env` with fresh secrets, clones the repo, installs `haat-deploy` and registers
   pm2 with systemd so the apps come back after a reboot.
2. First deploy: `sudo -u ubuntu -H haat-deploy main`, then load the demo catalog once with
   `cd /var/www/haat/current && sudo -u ubuntu -H bash -c 'set -a; . /var/www/haat/shared/api.env; npm run db:seed -w apps/api'`.
   The seed empties every table first, so never run it again on a live store.
3. nginx: copy `deploy/nginx/haat.conf` to `/etc/nginx/sites-available/haat`, link it into
   `sites-enabled`, `nginx -t && systemctl reload nginx`. The certificate is certbot's and renews
   itself.
4. AWS: the GitHub OIDC provider already exists in account 312605974340. The role
   `haat-github-deploy` uses `deploy/iam/trust-policy.json` (both the name and the numeric-ID
   form of the subject claim, since GitHub may send either) and `deploy/iam/permissions-policy.json`
   as its inline policy.
5. GitHub: the `production` environment is created by the first deploy. The workflow only
   deploys from `main`; for a second guard, set Settings > Environments > `production` >
   Deployment branches to `main`.
