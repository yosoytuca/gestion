import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const projectRoot = fileURLToPath(new URL('../',import.meta.url));
export function prerequisites() {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Instala Node.js 24 LTS (referencia 24.20.0) con npm antes de continuar.');
}
export function npmCommand(args) {
  return new Promise((resolve,reject)=> {
    const allowed = new Set(['ci','run build','run build:production']);
    if (!allowed.has(args.join(' '))) {reject(new Error('Comando npm no permitido por el inicializador.')); return;}
    const windows = process.platform === 'win32';
    const child = spawn(windows ? 'cmd.exe' : 'npm',windows ? ['/d','/s','/c',`npm.cmd ${args.join(' ')}`] : args,{cwd:projectRoot,stdio:'inherit',windowsHide:true});
    child.on('error',error=>reject(new Error(`No se pudo ejecutar npm: ${error.message}`)));
    child.on('exit',code=>code === 0 ? resolve() : reject(new Error(`npm terminó con código ${code}. Revisa el error anterior.`)));
  });
}
