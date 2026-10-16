// pm2 processes for the server. The deploy script copies this to /var/www/haat/.
// Secrets and per-server settings come from /var/www/haat/shared/api.env.
const fs = require('fs');

const APP = '/var/www/haat';

function readEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

const shared = readEnv(`${APP}/shared/api.env`);

module.exports = {
  apps: [
    {
      name: 'haat-api',
      cwd: `${APP}/current/apps/api`,
      script: 'dist/main.js',
      node_args: '--max-old-space-size=384',
      env: { ...shared, NODE_ENV: 'production', PORT: '4100' },
      max_memory_restart: '450M',
      kill_timeout: 8000,
      autorestart: true,
    },
    {
      name: 'haat-web',
      cwd: `${APP}/current/apps/web`,
      script: '../../node_modules/next/dist/bin/next',
      args: 'start -H 127.0.0.1 -p 3100',
      env: {
        NODE_ENV: 'production',
        NEXT_TELEMETRY_DISABLED: '1',
        API_URL: 'http://127.0.0.1:4100',
        SITE_URL: shared.WEB_URL,
      },
      max_memory_restart: '600M',
      kill_timeout: 8000,
      autorestart: true,
    },
  ],
};
