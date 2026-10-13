import { copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { checkDccSsh, dccHost, dccSshOptions, dccUser } from './dccSsh.mjs';

const user = dccUser;
const host = dccHost;
const base = `/~${user}/`;
const outDir = 'dist-dcc';
const isWindows = process.platform === 'win32';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: isWindows && command === 'npx' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

if (!checkDccSsh()) {
  console.error('No se pudo conectar al DCC con la llave SSH. Ejecuta npm run setup:dcc una vez.');
  process.exit(1);
}

if (process.argv.includes('--check')) {
  console.log('Conexión al DCC verificada sin contraseña.');
  process.exit(0);
}

run('npx', ['tsc']);
run('npx', ['vite', 'build', `--base=${base}`, '--outDir', outDir]);
copyFileSync(join(outDir, 'index.html'), join(outDir, '404.html'));

console.log(`Uploading ${outDir} to ${host} with the deployment SSH key`);
run('ssh', [...dccSshOptions, host, 'rm -rf ~/public_www_new && mkdir ~/public_www_new']);
run('scp', [...dccSshOptions, '-r', `${outDir}/.`, `${host}:public_www_new/`]);
// Swap the fresh upload in and drop the old copy, so stale hashed assets never pile up.
run('ssh', [
  ...dccSshOptions,
  host,
  'chmod -R u=rwX,go=rX ~/public_www_new && rm -rf ~/public_www_old && mv ~/public_www ~/public_www_old && mv ~/public_www_new ~/public_www && rm -rf ~/public_www_old',
]);

console.log(`Published: https://users.dcc.uchile.cl/${base.slice(1)}`);
