import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, sep, extname} from 'node:path';
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
export function startServer({port = 3000, host = '127.0.0.1', mode = 'producción local', root = resolve('dist'), requestHandler} = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('El puerto debe estar entre 1 y 65535.');
  root = resolve(root);
  const server = createServer(async (req, res) => {
    if (requestHandler && await requestHandler(req,res)) return;
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405, {Allow:'GET, HEAD'}); res.end(); return;}
    let pathname, path;
    try {pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname); path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);}
    catch {res.writeHead(400); res.end(); return;}
    if (!path.startsWith(`${root}${sep}`)) {res.writeHead(403); res.end(); return;}
    try {
      let body;
      try {body = await readFile(path);} catch {
        if (!/^\/(?:category\/[A-Z]+|activity\/[^/]+|new|capture\/(?:write|voice|result\/[^/]+)|history|settings|statistics)\/?$/.test(pathname)) {res.writeHead(404); res.end('No encontrado'); return;}
        path = resolve(root,'index.html'); body = await readFile(path);
      }
      res.writeHead(200, {'Content-Type':types[extname(path)] ?? 'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {res.writeHead(503); res.end('No se pudo leer el build. Vuelve a compilar.');}
  });
  server.requestTimeout = 45000;
  server.headersTimeout = 15000;
  server.on('error', error => {console.error(error.code === 'EADDRINUSE' ? `El puerto ${port} ya está ocupado. Cierra el arranque anterior; no se cambiará de puerto automáticamente.` : `No se pudo arrancar: ${error.message}`); process.exitCode = 1;});
  server.listen(port,host,()=>console.log(`PWA (${mode}): http://localhost:${port}\nCtrl+C para detener. Offline disponible después de completar la primera carga.`));
  return server;
}
