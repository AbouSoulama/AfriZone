/**
 * Build local + upload dist vers le VPS AfriZone.
 * Usage (PowerShell) :
 *   $env:AFZ_SSH_PASS='...'
 *   node scripts/deploy-vps.mjs
 *
 * Nécessite paramiko (pip install paramiko) et le helper SSH.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sshHelper = path.join(
  process.env.LOCALAPPDATA || '',
  'Temp',
  'afrizone_ssh.py'
);

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, shell: true, ...opts });
  if (r.status !== 0) process.exit(r.status || 1);
}

console.log('→ Build production…');
run('npm', ['run', 'build'], {
  env: {
    ...process.env,
    VITE_APP_URL: process.env.VITE_APP_URL || 'https://afrizone.tech',
  },
});

console.log('→ Upload dist…');
run('python', [sshHelper, 'run', 'rm -rf /var/www/afrizone.tech/*']);
run('python', [sshHelper, 'upload-dir', path.join(root, 'dist'), '/var/www/afrizone.tech']);
run('python', [sshHelper, 'run', 'nginx -t && systemctl reload nginx && echo RELOADED']);
console.log('→ Déployé : https://afrizone.tech');
