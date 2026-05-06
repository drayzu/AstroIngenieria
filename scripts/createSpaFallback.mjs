import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'dist');
const indexPath = join(distDir, 'index.html');
const fallbackPath = join(distDir, '404.html');

if (!existsSync(indexPath)) {
  throw new Error('dist/index.html does not exist. Run vite build before creating the SPA fallback.');
}

copyFileSync(indexPath, fallbackPath);
console.log('Created dist/404.html SPA fallback');
