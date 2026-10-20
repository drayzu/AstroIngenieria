// Herramientas de imágenes del museo, en un solo servidor local:
//   /             inicio
//   /elegir/      elegir rápido las imágenes de cada sala de la página
//   /referencias/ juntar las imágenes que más gustan para dárselas a ChatGPT
// Uso, desde la raíz del repo: npm run imagenes (abre el navegador solo)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportCollection, REFERENCES } from './exportReferences.mjs';

const PAGES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pages');
const CURATION = path.resolve('output/study-room-curation');
const DATA = path.join(CURATION, '_revision/elegir');
const CHOICES = path.join(DATA, 'elecciones.json');
const COLLECTIONS = path.join(REFERENCES, 'colecciones.json');
const PORT = Number(process.env.PORT) || 5460;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8' };

if (!fs.existsSync(path.join(DATA, 'data.json'))) {
  console.error('Faltan los datos de las imágenes. Ejecuta primero: npm run imagenes:actualizar');
  process.exit(1);
}

const readBody = (req) => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch (error) { reject(error); } });
});
const sendJson = (res, status, value) => res.writeHead(status, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' }).end(JSON.stringify(value));
const openFolder = (folder) => {
  const command = process.platform === 'win32' ? 'explorer' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(command, [folder], { detached: true, stdio: 'ignore' }).unref();
};
// Un JSON guardado por la página: GET lo lee, POST lo reemplaza
const jsonStore = async (req, res, file) => {
  if (req.method === 'POST') {
    try {
      const value = await readBody(req);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
      return sendJson(res, 200, { ok: true });
    } catch {
      return sendJson(res, 400, { error: 'JSON inválido' });
    }
  }
  return sendJson(res, 200, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {});
};
const serveFile = (res, base, relative) => {
  let file = path.resolve(base, relative);
  if (file !== base && !file.startsWith(base + path.sep)) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return res.writeHead(404).end('No existe');
  res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const route = decodeURIComponent(url.pathname);
  if (route === '/api/elecciones') return jsonStore(req, res, CHOICES);
  if (route === '/api/colecciones') return jsonStore(req, res, COLLECTIONS);
  if (route === '/api/exportar' && req.method === 'POST') {
    try {
      const { collection, open } = await readBody(req);
      const result = await exportCollection(collection);
      if (open) openFolder(result.folder);
      return sendJson(res, 200, result);
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }
  if (route === '/api/abrir' && req.method === 'POST') {
    const { folder } = await readBody(req).catch(() => ({}));
    const target = path.resolve(folder || REFERENCES);
    if (!target.startsWith(REFERENCES) || !fs.existsSync(target)) return sendJson(res, 404, { error: 'No existe la carpeta' });
    openFolder(target);
    return sendJson(res, 200, { ok: true });
  }
  if (route === '/') return serveFile(res, PAGES, 'index.html');
  if (route === '/elegir' || route === '/referencias') return res.writeHead(302, { location: `${route}/` }).end();
  if (route === '/elegir/') return serveFile(res, PAGES, 'elegir.html');
  if (route === '/referencias/') return serveFile(res, PAGES, 'referencias.html');
  if (route.startsWith('/datos/')) return serveFile(res, DATA, route.slice('/datos/'.length));
  if (route.startsWith('/curaduria/')) return serveFile(res, CURATION, route.slice('/curaduria/'.length));
  return res.writeHead(404).end('No existe');
}).listen(PORT, () => {
  const address = `http://localhost:${PORT}/`;
  console.log(`Herramientas de imágenes: ${address}`);
  if (process.argv.includes('--open')) {
    if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', address], { detached: true, stdio: 'ignore' }).unref();
    else openFolder(address);
  }
});
