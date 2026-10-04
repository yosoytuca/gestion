import {build} from 'esbuild';
import {mkdir, copyFile, readFile, writeFile, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import './generate-icons.mjs';
await mkdir('dist', {recursive: true});
const production = process.argv.includes('--production');
await mkdir('server-dist',{recursive:true});
await build({entryPoints:['backend/src/interpreter-http.ts'],bundle:true,format:'esm',platform:'node',target:'node22',packages:'external',outfile:'server-dist/interpreter-http.mjs'});
if (production) for (const name of ['app.js.map', 'app.css.map']) await rm(`dist/${name}`, {force: true});
await build({entryPoints: ['frontend/src/app/main.tsx'], bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
  outfile: 'dist/app.js', sourcemap: !production, minify: production});
for (const name of ['index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png']) await copyFile(`frontend/public/${name}`, `dist/${name}`);
const digest = createHash('sha256');
for (const name of ['app.js', 'app.css', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png']) digest.update(await readFile(`dist/${name}`));
digest.update(await readFile('frontend/public/sw.js'));
const hash = digest.digest('hex').slice(0, 12);
await writeFile('dist/sw.js', (await readFile('frontend/public/sw.js', 'utf8')).replace('__BUILD_ID__', hash));
console.log(`Build móvil/PWA: dist/ (${hash}).`);
