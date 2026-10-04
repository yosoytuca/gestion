import {build} from 'esbuild';
import {readdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const files = (await readdir('tests')).filter(file => /\.test\.tsx?$/.test(file));
await build({entryPoints: files.map(file => `tests/${file}`), bundle: true, packages: 'external', platform: 'node',
  format: 'esm', outdir: '.test-build', outExtension: {'.js': '.mjs'}, target: 'node22'});
const child = spawn(process.execPath, ['--test', ...files.map(file => `.test-build/${file.replace(/\.tsx?$/, '.mjs')}`)], {stdio: 'inherit'});
child.on('exit', code => {process.exitCode = code ?? 1;});
child.on('error', error => {console.error(error); process.exitCode = 1;});
