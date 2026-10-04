import {readdir, writeFile} from 'node:fs/promises';
const excluded = new Set(['node_modules', '.npm-cache', '.test-build', 'dist', '.git']);
await writeFile('docs/arbol-real.txt', '', 'utf8');
const lines = ['gestor_actividades/'];
async function walk(directory, prefix) {
  const entries = (await readdir(directory, {withFileTypes: true})).filter(e => !excluded.has(e.name))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index], last = index === entries.length - 1;
    lines.push(`${prefix}${last ? '└── ' : '├── '}${entry.name}${entry.isDirectory() ? '/' : ''}`);
    if (entry.isDirectory()) await walk(`${directory}/${entry.name}`, prefix + (last ? '    ' : '│   '));
  }
}
await walk('.', '');
await writeFile('docs/arbol-real.txt', lines.join('\n') + '\n', 'utf8');
console.log('Árbol de fuentes actualizado en docs/arbol-real.txt (excluye dependencias y artefactos de build).');
