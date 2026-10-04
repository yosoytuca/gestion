import './build.mjs';
import {startServer} from './web-server.mjs';
const {createInterpreterHandler} = await import('../server-dist/interpreter-http.mjs');
startServer({port: Number(process.env.DEV_PORT ?? 3000), host: process.env.DEV_HOST ?? '127.0.0.1', mode: 'desarrollo',requestHandler:createInterpreterHandler()});
