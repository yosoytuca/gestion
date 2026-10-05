import {npmCommand,prerequisites} from './comandos.mjs';
try {
  prerequisites();
  console.log('Instalando dependencias del proyecto según package-lock.json…');
  await npmCommand(['ci']);
  console.log('Dependencias instaladas. Ejecuta 03-arrancar.cmd (Windows) o node inicializacion/03-arrancar.mjs.');
} catch(error) {console.error(error.message); console.error('Si Windows indica EPERM/esbuild.exe, detén el arranque anterior con Ctrl+C antes de reinstalar.'); process.exitCode=1;}
