import { constants } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const project = path.resolve(import.meta.dirname, '..');
const source = path.join(project, 'output', 'study-room-cinema');
const destination = path.join(project, 'output', 'study-room-curation');
const dryRun = process.argv.includes('--dry-run');
try {
  const existing = JSON.parse(await readFile(path.join(destination, 'INDICE.json'), 'utf8'));
  if (existing.layout === 'editorialJourney') {
    throw new Error('La colección ya está organizada según la web; este importador inicial no debe sobrescribirla.');
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const chapterFolders = {
  intro: '00-introduccion',
  habitats: '01-habitats-espaciales',
  infrastructure: '02-industria-espacial',
  planetary: '03-ingenieria-planetaria',
  energy: '04-energia-estelar',
  propulsion: '05-viaje-interestelar',
  stellar: '06-ingenieria-estelar',
  civilizations: '07-civilizaciones-cosmicas',
  search: '08-inteligencia-extraterrestre',
};

const inventory = await readFile(path.join(source, 'INVENTORY.md'), 'utf8');
const editorial = await readFile(path.join(project, 'src', 'data', 'editorialJourney.ts'), 'utf8');
const inventoryRows = [...inventory.matchAll(/^\|\s*(\d{3})\s*\|[^|]*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*$/gm)];
const sourceFile = ts.createSourceFile('editorialJourney.ts', editorial, ts.ScriptTarget.Latest, true);
const property = (object, name) => object.properties.find((item) =>
  ts.isPropertyAssignment(item) && item.name.getText(sourceFile).replaceAll("'", '') === name,
)?.initializer;
let journey;
sourceFile.forEachChild((node) => {
  if (!ts.isVariableStatement(node)) return;
  for (const declaration of node.declarationList.declarations) {
    if (declaration.name.getText(sourceFile) === 'editorialJourney') journey = declaration.initializer;
  }
});
if (!journey || !ts.isArrayLiteralExpression(journey)) throw new Error('No se encontró editorialJourney');
const chaptersById = new Map();
let editorialNumber = 0;
for (const chapter of journey.elements) {
  const chapterId = property(chapter, 'id')?.text;
  const groups = property(chapter, 'groups');
  if (!chapterFolders[chapterId] || !groups || !ts.isArrayLiteralExpression(groups)) throw new Error('Capítulo editorial inesperado');
  for (const group of groups.elements) {
    const ids = property(group, 'conceptIds');
    if (!ids || !ts.isArrayLiteralExpression(ids)) throw new Error('Grupo editorial inesperado');
    for (const id of ids.elements) {
      editorialNumber++;
      chaptersById.set(id.text, { chapter: chapterId, number: String(editorialNumber).padStart(3, '0') });
    }
  }
}
const rooms = new Map();
for (const [, number, id, title] of inventoryRows) {
  if (rooms.has(number)) throw new Error(`Número de sala repetido: ${number}`);
  const editorialRoom = chaptersById.get(id);
  const chapter = editorialRoom?.chapter;
  if (!chapterFolders[chapter]) throw new Error(`Sin tema para ${number}-${id}`);
  if (number !== editorialRoom.number) throw new Error(`Numeración antigua para ${id}: ${number} != ${editorialRoom.number}`);
  rooms.set(number, {
    number,
    id,
    title: title.trim(),
    chapter,
    folder: path.posix.join(chapterFolders[chapter], `${number}-${id}`),
    images: [],
    promptsWithoutImage: [],
  });
}
if (rooms.size !== 106) throw new Error(`Se esperaban 106 salas; se encontraron ${rooms.size}`);
rooms.set('000', {
  number: '000',
  id: 'recursos-del-sitio',
  title: 'Recursos generales de la página',
  chapter: 'site',
  folder: 'recursos-del-sitio/000-recursos-generales',
  images: [],
  promptsWithoutImage: [],
});

const originals = (await readdir(path.join(source, 'originals')))
  .filter((name) => name.toLowerCase().endsWith('.png')).sort();
const prompts = (await readdir(path.join(source, 'prompts')))
  .filter((name) => /\.(md|txt)$/i.test(name)).sort();
const promptNamesByStem = new Map();
for (const name of prompts) {
  const stem = path.parse(name).name;
  const current = promptNamesByStem.get(stem) ?? [];
  current.push(name);
  promptNamesByStem.set(stem, current);
}
const imageStems = new Set(originals.map((name) => path.parse(name).name));
const recoveredPrompts = new Map();
const conflictingPrompts = new Set();
const manifestNames = (await readdir(source)).filter((name) => name.endsWith('.json')).sort();
for (const manifest of manifestNames) {
  let data;
  try {
    data = JSON.parse(await readFile(path.join(source, manifest), 'utf8'));
  } catch {
    continue;
  }
  const entries = Array.isArray(data.images) ? data.images : Array.isArray(data.assets) ? data.assets : [];
  for (const entry of entries) {
    if (typeof entry.original !== 'string' || typeof entry.generationPrompt !== 'string') continue;
    const stem = path.parse(entry.original).name;
    if (!imageStems.has(stem) || promptNamesByStem.has(stem) || conflictingPrompts.has(stem)) continue;
    const previous = recoveredPrompts.get(stem);
    if (previous && previous.text !== entry.generationPrompt) {
      recoveredPrompts.delete(stem);
      conflictingPrompts.add(stem);
      continue;
    }
    recoveredPrompts.set(stem, { text: entry.generationPrompt, manifest });
  }
}
const promptCollections = (await readdir(source))
  .filter((name) => /^PROMPTS-.*\.md$/.test(name)).sort();
for (const collection of promptCollections) {
  const markdown = await readFile(path.join(source, collection), 'utf8');
  const headings = [...markdown.matchAll(/^##\s+(\d{3}-[a-z0-9-]+)/gm)];
  for (let i = 0; i < headings.length; i++) {
    const stem = headings[i][1];
    if (!imageStems.has(stem) || promptNamesByStem.has(stem) || conflictingPrompts.has(stem)) continue;
    const section = markdown.slice(
      headings[i].index,
      headings[i + 1]?.index ?? markdown.length,
    );
    const match = section.match(/```text\r?\n([\s\S]*?)\r?\n```/);
    if (!match) continue;
    const text = match[1].trim();
    const previous = recoveredPrompts.get(stem);
    if (previous && previous.text.trim() !== text) {
      recoveredPrompts.delete(stem);
      conflictingPrompts.add(stem);
      continue;
    }
    if (!previous) recoveredPrompts.set(stem, { text, manifest: collection });
  }
}
for (const stem of recoveredPrompts.keys()) promptNamesByStem.set(stem, [`${stem}.md`]);
const getRoom = (name) => {
  const match = name.match(/^(\d{3})-/);
  if (!match || !rooms.has(match[1])) throw new Error(`Archivo sin sala conocida: ${name}`);
  const room = rooms.get(match[1]);
  return room;
};

for (const name of originals) {
  const room = getRoom(name);
  room.images.push({
    image: name,
    prompts: promptNamesByStem.get(path.parse(name).name) ?? [],
  });
}
for (const name of prompts) {
  const room = getRoom(name);
  if (!imageStems.has(path.parse(name).name)) room.promptsWithoutImage.push(name);
}

const allRooms = [...rooms.values()].sort((a, b) => a.number.localeCompare(b.number));
const unmatchedImages = allRooms.reduce(
  (sum, room) => sum + room.images.filter((image) => image.prompts.length === 0).length, 0,
);
const unmatchedPrompts = allRooms.reduce(
  (sum, room) => sum + room.promptsWithoutImage.length, 0,
);
console.log(
  `${allRooms.length} carpetas, ${originals.length} imágenes, ${prompts.length} archivos de prompt; ` +
  `${recoveredPrompts.size} prompts recuperables de registros, ` +
  `${unmatchedImages} imágenes sin prompt individual y ${unmatchedPrompts} prompts sin imagen homónima.`,
);
if (dryRun) process.exit(0);

let copied = 0;
let present = 0;
let recoveredWritten = 0;
async function alreadyClassified(base, name) {
  for (const folder of ['elegida', 'basura']) {
    try {
      await stat(path.join(base, folder, name));
      return true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return false;
}
async function safeCopy(from, to) {
  try {
    await copyFile(from, to, constants.COPYFILE_EXCL);
    copied++;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const [src, dst] = await Promise.all([stat(from), stat(to)]);
    if (src.size !== dst.size) throw new Error(`Archivo distinto ya presente: ${to}`, { cause: error });
    present++;
  }
}

for (const room of allRooms) {
  const base = path.join(destination, room.folder);
  for (const folder of ['elegida', 'basura']) {
    await mkdir(path.join(base, folder), { recursive: true });
  }
  for (const { image } of room.images) {
    if (await alreadyClassified(base, image)) continue;
    await safeCopy(
      path.join(source, 'originals', image),
      path.join(base, image),
    );
  }
  const roomPrompts = prompts.filter((name) => name.startsWith(`${room.number}-`));
  for (const prompt of roomPrompts) {
    if (await alreadyClassified(base, prompt)) continue;
    await safeCopy(
      path.join(source, 'prompts', prompt),
      path.join(base, prompt),
    );
  }
  for (const { image } of room.images) {
    const stem = path.parse(image).name;
    const recovered = recoveredPrompts.get(stem);
    if (!recovered) continue;
    const name = `${stem}.md`;
    if (await alreadyClassified(base, name)) continue;
    const target = path.join(base, name);
    const content =
      `# Prompt recuperado · ${stem}\n\n` +
      `Fuente: ${recovered.manifest}\n\n` +
      `~~~text\n${recovered.text}\n~~~\n`;
    try {
      await writeFile(target, content, { encoding: 'utf8', flag: 'wx' });
      recoveredWritten++;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if ((await readFile(target, 'utf8')) !== content) {
        throw new Error(`Prompt recuperado diferente ya presente: ${target}`, { cause: error });
      }
    }
  }
}

const index = {
  layout: 'editorialJourney',
  source: path.relative(destination, source).replaceAll('\\', '/'),
  copiedImages: originals.length,
  copiedPromptFiles: prompts.length,
  recoveredPromptFiles: recoveredPrompts.size,
  recoveredFromRecords: [...recoveredPrompts.entries()].map(([stem, value]) => ({
    image: `${stem}.png`,
    prompt: `${stem}.md`,
    manifest: value.manifest,
  })),
  conflictingRecordPrompts: [...conflictingPrompts],
  imagesWithoutIndividualPrompt: unmatchedImages,
  promptsWithoutMatchingImage: unmatchedPrompts,
  rooms: allRooms,
};
await writeFile(path.join(destination, 'INDICE.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
await writeFile(
  path.join(destination, 'LEEME.md'),
  `# Colección para elegir imágenes de las salas

Esta carpeta es una **copia de trabajo**. Los archivos originales siguen en
../study-room-cinema/originals/ y ../study-room-cinema/prompts/.

Cada tema contiene una carpeta por sala. Dentro de cada sala:

- En la raíz de la sala: todas las imágenes y los prompts aún por clasificar.
- elegida/: mueve aquí la imagen seleccionada y su prompt con el mismo nombre base.
- basura/: mueve aquí las alternativas descartadas y sus prompts antes de borrarlas definitivamente.

La carpeta recursos-del-sitio/000-recursos-generales/ reúne las imágenes que
no corresponden a una sala numerada.

INDICE.json relaciona las imágenes con los prompts de igual nombre. Hay
**${unmatchedImages} imágenes sin archivo de prompt individual** y
**${unmatchedPrompts} archivos de prompt sin imagen del mismo nombre** en
la colección organizada. Se recuperaron **${recoveredPrompts.size} prompts exactos**
desde los manifiestos y compilaciones de prompts originales; cada archivo recuperado indica su fuente.
No se inventó contenido para completar los que faltan.

Las carpetas elegida/ y basura/ empiezan vacías. Esta organización no
cambia las imágenes que usa la página.
`,
  'utf8',
);
console.log(
  `Copia terminada: ${copied} archivos nuevos, ${present} ya presentes, ` +
  `${recoveredWritten} prompts recuperados escritos. Destino: ${destination}`,
);
