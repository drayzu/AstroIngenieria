// Publica dist/ en la rama gh-pages (GitHub Pages).
// Reemplaza a `gh-pages -d dist`, que en Windows falla con
// "spawn ENAMETOOLONG" al pasar miles de archivos a git en un solo comando.
// Aquí se usa un worktree temporal de gh-pages y comandos de git cortos.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SITE_URL = 'https://drayzu.github.io/AstroIngenieria/';
const BRANCH = 'gh-pages';
const distDir = join(process.cwd(), 'dist');

const git = (args, options = {}) =>
  execFileSync('git', args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', ...options }).trim();

if (!existsSync(join(distDir, 'index.html'))) {
  throw new Error('dist/index.html does not exist. Run npm run build before deploying.');
}

// Huella del build: el bundle de entrada lleva un hash distinto en cada cambio
const entryBundle = readdirSync(join(distDir, 'assets')).find((name) => /^index-.+\.js$/.test(name));

const worktree = mkdtempSync(join(tmpdir(), 'astro-gh-pages-'));
try {
  console.log(`Preparing ${BRANCH} in a temporary worktree…`);
  git(['fetch', 'origin', BRANCH]);
  git(['worktree', 'add', '-f', '-B', BRANCH, worktree, `origin/${BRANCH}`]);

  // Se reemplaza todo el contenido publicado por el build actual
  git(['rm', '-r', '-q', '--ignore-unmatch', '.'], { cwd: worktree });
  cpSync(distDir, worktree, { recursive: true });
  git(['add', '-A'], { cwd: worktree });

  if (!git(['status', '--porcelain'], { cwd: worktree })) {
    console.log('Nothing to publish: gh-pages already matches dist/.');
  } else {
    git(['commit', '-q', '-m', 'Updates'], { cwd: worktree });
    console.log(`Pushing to origin/${BRANCH}…`);
    git(['push', '-q', 'origin', BRANCH], { cwd: worktree });
    console.log('Published.');
  }
} finally {
  try {
    git(['worktree', 'remove', '--force', worktree]);
  } catch {
    rmSync(worktree, { recursive: true, force: true });
    git(['worktree', 'prune']);
  }
}

// GitHub Pages tarda en servir la versión nueva: se espera a verla en vivo
if (entryBundle) {
  console.log(`Waiting for ${SITE_URL} to serve ${entryBundle}…`);
  const deadline = Date.now() + 3 * 60_000;
  let live = false;
  while (!live && Date.now() < deadline) {
    try {
      const html = await (await fetch(`${SITE_URL}?v=${Date.now()}`, { cache: 'no-store' })).text();
      live = html.includes(entryBundle);
    } catch {
      // Sin red momentánea: se reintenta
    }
    if (!live) await new Promise((resolve) => setTimeout(resolve, 6_000));
  }
  console.log(
    live
      ? `Live: ${SITE_URL}`
      : `Still propagating; check ${SITE_URL} in a minute (Ctrl+F5).`,
  );
}

