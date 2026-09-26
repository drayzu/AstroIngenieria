import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const workspace = await realpath(path.resolve(import.meta.dirname, '..'));
const root = await realpath(path.join(workspace, 'output', 'study-room-curation'));
const indexPath = path.join(root, 'INDICE.json');
const index = JSON.parse(await readFile(indexPath, 'utf8'));
const chapterFolders = [
  '00-introduccion', '01-habitats-espaciales', '02-industria-espacial',
  '03-ingenieria-planetaria', '04-energia-estelar', '05-viaje-interestelar',
  '06-ingenieria-estelar', '07-civilizaciones-cosmicas',
  '08-inteligencia-extraterrestre',
];

const property = (object, name) => object.properties.find((item) =>
  ts.isPropertyAssignment(item) && item.name.getText(sourceFile).replaceAll("'", '') === name,
)?.initializer;
const literal = (node) => {
  if (!node || !ts.isStringLiteral(node)) throw new Error('Recorrido editorial inesperado');
  return node.text;
};
const sourceText = await readFile(path.join(workspace, 'src', 'data', 'editorialJourney.ts'), 'utf8');
const sourceFile = ts.createSourceFile('editorialJourney.ts', sourceText, ts.ScriptTarget.Latest, true);
let journey;
sourceFile.forEachChild((node) => {
  if (!ts.isVariableStatement(node)) return;
  for (const declaration of node.declarationList.declarations) {
    if (declaration.name.getText(sourceFile) === 'editorialJourney') journey = declaration.initializer;
  }
});
if (!journey || !ts.isArrayLiteralExpression(journey)) throw new Error('No se encontró editorialJourney');

const ordered = journey.elements.flatMap((chapter, chapterIndex) => {
  if (!ts.isObjectLiteralExpression(chapter)) throw new Error('Capítulo editorial inesperado');
  const groups = property(chapter, 'groups');
  if (!groups || !ts.isArrayLiteralExpression(groups)) throw new Error('Grupos editoriales inesperados');
  const chapterId = literal(property(chapter, 'id'));
  return groups.elements.flatMap((group) => {
    if (!ts.isObjectLiteralExpression(group)) throw new Error('Grupo editorial inesperado');
    const ids = property(group, 'conceptIds');
    if (!ids || !ts.isArrayLiteralExpression(ids)) throw new Error('Obras editoriales inesperadas');
    return ids.elements.map((id) => ({ id: literal(id), chapterId, chapterIndex }));
  });
});
const oldRooms = new Map(index.rooms.filter((room) => room.id !== 'recursos-del-sitio').map((room) => [room.id, room]));
if (ordered.length !== oldRooms.size || new Set(ordered.map((item) => item.id)).size !== ordered.length) {
  throw new Error(`No coinciden las ${ordered.length} obras de la web con las ${oldRooms.size} carpetas`);
}
const plan = ordered.map((entry, indexInJourney) => {
  const room = oldRooms.get(entry.id);
  if (!room) throw new Error(`No existe carpeta para ${entry.id}`);
  const newNumber = String(indexInJourney + 1).padStart(3, '0');
  const newFolder = `${chapterFolders[entry.chapterIndex]}/${newNumber}-${entry.id}`;
  return { ...entry, room, oldNumber: room.number, newNumber, newFolder };
});
if (plan.every((item) => item.room.folder === item.newFolder && item.room.number === item.newNumber && item.room.chapter === item.chapterId)) {
  console.log(process.argv.includes('--plan') ? '[]' : 'La colección ya sigue el recorrido editorial.');
  process.exit(0);
}
if (process.argv.includes('--plan')) {
  console.log(JSON.stringify(plan.map(({ id, chapterId, oldNumber, newNumber, newFolder, room }) => ({
    id, chapterId, oldNumber, newNumber, oldFolder: room.folder, newFolder,
  }))));
  process.exit(0);
}

console.log(`${plan.length} obras; ${plan.filter((item) => item.room.folder !== item.newFolder).length} carpetas por mover.`);
console.log(plan.filter((item) => item.room.folder !== item.newFolder).slice(0, 16)
  .map((item) => `${item.room.folder} -> ${item.newFolder}`).join('\n'));
