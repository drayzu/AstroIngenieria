import { access, readFile, readdir, realpath, rename, rmdir, stat } from 'node:fs/promises';
import path from 'node:path';

const workspace = await realpath(path.resolve(import.meta.dirname, '..'));
const root = await realpath(path.join(workspace, 'output', 'study-room-curation'));
const index = JSON.parse(await readFile(path.join(root, 'INDICE.json'), 'utf8'));
const inside = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};
if (!inside(workspace, root)) throw new Error('La colección está fuera del proyecto');
if (index.rooms.length !== 107) throw new Error('Número inesperado de carpetas de sala');

const moves = [];
const candidateFolders = [];
for (const room of index.rooms) {
  const base = path.resolve(root, room.folder);
  if (!inside(root, base)) throw new Error(`Sala fuera de la colección: ${room.folder}`);
  const candidates = path.resolve(base, 'candidatas');
  if (!inside(base, candidates)) throw new Error(`Ruta inválida: ${candidates}`);
  try {
    await access(candidates);
  } catch (error) {
    if (error.code === 'ENOENT') continue;
    throw error;
  }
  if ((await realpath(candidates)) !== candidates) throw new Error(`Enlace inesperado: ${candidates}`);
  candidateFolders.push(candidates);
  for (const entry of await readdir(candidates, { withFileTypes: true })) {
    if (!entry.isFile()) throw new Error(`Elemento inesperado: ${entry.name}`);
    const from = path.resolve(candidates, entry.name);
    const to = path.resolve(base, entry.name);
    if (!inside(candidates, from) || !inside(base, to) || !inside(root, to)) {
      throw new Error(`Ruta fuera de la colección: ${entry.name}`);
    }
    try {
      await stat(to);
      throw new Error(`Ya existe en la sala: ${to}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    moves.push({ from, to });
  }
}

for (const { from, to } of moves) await rename(from, to);
for (const folder of candidateFolders) await rmdir(folder);
console.log(`Trasladados ${moves.length} archivos a las salas; eliminadas ${candidateFolders.length} carpetas candidatas vacías.`);
