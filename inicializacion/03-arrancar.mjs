import {createInterface} from 'node:readline/promises';
import {access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {npmCommand,prerequisites,projectRoot} from './comandos.mjs';
import {startServer} from '../scripts/web-server.mjs';
try {
  prerequisites();
  process.chdir(projectRoot);
  try {process.loadEnvFile(resolve('.env'));} catch(error) {if (error.code !== 'ENOENT') throw error;}
  try {await access(resolve('node_modules/esbuild/package.json')); await access(resolve('node_modules/preact/package.json'));}
  catch {throw new Error('Faltan dependencias. Ejecuta primero 01-instalar-dependencias.cmd.');}
  let mode = process.argv.find(arg=>arg.startsWith('--modo='))?.slice(7);
  if (!mode) {
    const input = createInterface({input:process.stdin,output:process.stdout});
    console.log('\nGESTOR DE ACTIVIDADES — ARRANQUE EN PUERTO 3000\n1. Desarrollo para túnel de Visual Studio Code\n2. Producción local (build optimizado + PWA/offline)\n0. Salir');
    const answer = (await input.question('Selecciona 1 o 2: ')).trim(); input.close();
    if (answer === '0') process.exit(0);
    mode = answer === '1' ? 'tunel' : answer === '2' ? 'produccion' : '';
  }
  if (!['tunel','produccion'].includes(mode)) throw new Error('Modo inválido: usa --modo=tunel o --modo=produccion.');
  await npmCommand(['run',mode === 'produccion' ? 'build:production' : 'build']);
  if (mode === 'tunel') console.log('En VS Code: panel Puertos → Reenviar puerto → 3000. Abre la dirección HTTPS que proporciona VS Code. El túnel lo gestiona VS Code; este ejecutable sirve la PWA y el endpoint de IA.');
  else console.log('Build de producción local. No publica un dominio ni configura HTTPS externo.');
  const {createInterpreterHandler} = await import('../server-dist/interpreter-http.mjs');
  const server = startServer({port:3000,host:'127.0.0.1',requestHandler:createInterpreterHandler(),mode:mode === 'tunel' ? 'desarrollo para túnel VS Code' : 'producción local'});
  const stop = () => {server.close(() => process.exit(0)); server.closeIdleConnections();};
  process.on('SIGINT',stop); process.on('SIGTERM',stop);
  if (process.stdin.isTTY) {
    const controls = createInterface({input:process.stdin,output:process.stdout});
    console.log('También puedes escribir Q + Enter para detener.');
    controls.on('line',line=> {if (line.trim().toLowerCase() === 'q') {controls.close(); stop();}});
    server.on('error',()=>controls.close());
  }
} catch(error) {console.error(error.message);process.exitCode=1;}
