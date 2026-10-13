import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { checkDccSsh, dccHost, dccKeyPath } from './dccSsh.mjs';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} terminó con código ${result.status}.`);
}

try {
  if (checkDccSsh()) {
    console.log('La llave SSH ya funciona. Los deploys del DCC no pedirán contraseña.');
    process.exit(0);
  }

  if (!existsSync(dccKeyPath)) {
    if (existsSync(`${dccKeyPath}.pub`)) {
      throw new Error(`Ya existe ${dccKeyPath}.pub sin su llave privada. No se sobrescribirá.`);
    }
    mkdirSync(dirname(dccKeyPath), { recursive: true });
    console.log(`Creando una llave dedicada de despliegue en ${dccKeyPath}`);
    run('ssh-keygen', ['-t', 'ed25519', '-f', dccKeyPath, '-N', '', '-C', 'astroingenieria-dcc-deploy']);
  }

  const publicKeyPath = `${dccKeyPath}.pub`;
  if (!existsSync(publicKeyPath)) throw new Error(`Falta la llave pública ${publicKeyPath}.`);
  const [type, blob] = readFileSync(publicKeyPath, 'utf8').trim().split(/\s+/);
  if (type !== 'ssh-ed25519' || !/^[A-Za-z0-9+/]+={0,2}$/.test(blob ?? '')) {
    throw new Error('La llave pública debe ser una llave Ed25519 válida.');
  }

  // Only the public key is registered. Existing authorized keys are retained.
  // Disable forwarding and interactive terminals for this deployment key.
  const authorizedKey = `restrict ${type} ${blob} astroingenieria-dcc-deploy`;
  const install = [
    'set -eu',
    'umask 077',
    'mkdir -p "$HOME/.ssh"',
    'chmod 700 "$HOME/.ssh"',
    'keys="$HOME/.ssh/authorized_keys"',
    'touch "$keys"',
    `if ! grep -qF -- '${blob}' "$keys"; then`,
    `  printf '\\n%s\\n' '${authorizedKey}' >> "$keys"`,
    'fi',
    'chmod 600 "$keys"',
    'echo "Llave pública registrada en el DCC."',
  ].join('\n');

  console.log('Ingresa tu contraseña del DCC una vez para registrar la llave pública.');
  run('ssh', [
    '-o', 'PubkeyAuthentication=no',
    '-o', 'PreferredAuthentications=password,keyboard-interactive',
    '-o', 'StrictHostKeyChecking=yes',
    '-o', 'ConnectTimeout=15',
    dccHost,
    install,
  ]);

  if (!checkDccSsh()) {
    throw new Error('La conexión con la llave todavía falla. Si usas una llave cifrada, cárgala en ssh-agent.');
  }
  console.log('Listo. npm run deploy:dcc ya puede ejecutarse sin contraseña.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
