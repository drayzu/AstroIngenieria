import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export const dccUser = 'direyes';
export const dccHost = `${dccUser}@anakena.dcc.uchile.cl`;
export const dccKeyPath = resolve(process.env.DCC_SSH_KEY || join(homedir(), '.ssh', 'astroingenieria-dcc-deploy'));
export const dccSshOptions = [
  '-o', 'BatchMode=yes',
  '-o', 'IdentitiesOnly=yes',
  '-o', 'StrictHostKeyChecking=yes',
  '-o', 'ConnectTimeout=15',
  '-i', dccKeyPath,
];

export function checkDccSsh() {
  if (!existsSync(dccKeyPath)) return false;
  const result = spawnSync('ssh', [...dccSshOptions, dccHost, 'true'], {
    stdio: 'ignore',
    timeout: 30000,
  });
  if (result.error && result.error.code !== 'ETIMEDOUT') throw result.error;
  return result.status === 0;
}
