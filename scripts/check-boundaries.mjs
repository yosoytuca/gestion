import ts from 'typescript';
import {readdir, readFile} from 'node:fs/promises';
import {resolve, relative, dirname} from 'node:path';
async function files(path) {
  const entries = await readdir(path, {withFileTypes: true});
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(`${path}/${e.name}`) : [`${path}/${e.name}`]))).flat();
}
const sources = (await Promise.all(['frontend', 'backend', 'datos'].map(files))).flat().filter(p => /\.tsx?$/.test(p));
const graph = new Map(); const errors = [];
for (const file of sources) {
  const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const imports = source.statements.filter(s => ts.isImportDeclaration(s) || ts.isExportDeclaration(s))
    .map(s => s.moduleSpecifier?.text).filter(Boolean);
  const edges = [];
  for (const specifier of imports) {
    if (!specifier.startsWith('.')) continue;
    const target = relative(process.cwd(), resolve(dirname(file), specifier)).replaceAll('\\', '/');
    const origin = file.replaceAll('\\', '/');
    if (origin.startsWith('datos/') && /^(frontend|backend)\//.test(target)) errors.push(`${file}: datos depende de aplicación`);
    if (origin.startsWith('frontend/') && (target.startsWith('backend/') || target.startsWith('datos/database/'))) errors.push(`${file}: dependencia privada de backend`);
    if (origin.includes('/modules/') && (target.includes('/infrastructure/') || target.includes('/app/'))) errors.push(`${file}: módulo depende de composición/infraestructura`);
    const moduleOf = path => path.match(/^(.*\/modules\/[^/]+)\//)?.[1];
    if (target.includes('/modules/') && !target.endsWith('/public') && moduleOf(target) !== moduleOf(origin)) errors.push(`${file}: deep import ${specifier}`);
    if (origin.startsWith('datos/domain/') && !target.startsWith('datos/domain/') && !target.startsWith('datos/contracts/')) errors.push(`${file}: dominio con infraestructura`);
    for (const extension of ['.ts', '.tsx']) {
      const full = resolve(dirname(file), `${specifier}${extension}`);
      if (sources.some(p => resolve(p) === full)) edges.push(full);
    }
  }
  graph.set(resolve(file), edges);
}
const visiting = new Set(), visited = new Set();
function visit(node) {
  if (visiting.has(node)) {errors.push(`Ciclo: ${relative(process.cwd(), node)}`); return;}
  if (visited.has(node)) return;
  visiting.add(node); for (const edge of graph.get(node) ?? []) visit(edge);
  visiting.delete(node); visited.add(node);
}
for (const node of graph.keys()) visit(node);
if (errors.length) {console.error(errors.join('\n')); process.exitCode = 1;}
else console.log(`Límites e imports sin ciclos: ${sources.length} archivos TypeScript.`);
