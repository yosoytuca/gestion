# Ejecutables de preparación y arranque

1. **01-instalar-dependencias.cmd**: doble clic en Windows. Instala todas las dependencias del proyecto con npm ci/lockfile. Requiere Node.js LTS y npm previamente instalados; no instala software del sistema, PostgreSQL ni servicios que esta etapa no usa.
2. No existe ejecutable 02 ni un proceso independiente para compartir API. El endpoint mínimo de IA funciona dentro del mismo arranque web.
3. **03-arrancar.cmd**: doble clic. Menú: 1 desarrollo para túnel VS Code; 2 producción local; 0 salir. Ambos usan **puerto 3000**, sin cambiarlo silenciosamente si está ocupado. Ctrl+C detiene el servidor; en terminal interactiva también Q + Enter.

En otros servidores con Node/npm: `node inicializacion/01-instalar-dependencias.mjs` y `node inicializacion/03-arrancar.mjs`. Funcionan desde otra carpeta: resuelven la raíz del proyecto a partir del ejecutable. Modos sin menú: `--modo=tunel` y `--modo=produccion`.

El modo túnel prepara el servidor. En Visual Studio Code, panel Puertos → Reenviar puerto → 3000 y abrir el enlace HTTPS generado. El túnel y su acceso los gestiona VS Code; no se publica automáticamente. [Documentación oficial](https://code.visualstudio.com/docs/debugtest/port-forwarding).

Producción local compila minificado sin source maps y sirve dist/. Permite probar manifest, service worker, caché, IndexedDB, refresh y offline en http://localhost:3000 después de la primera carga. Offline también existe en modo desarrollo; no depende de instalar la PWA. Para un dominio/dispositivo remoto se necesita HTTPS. El backend se limita al intérprete IA: no incorpora auth/sync ni sustituye el despliegue definitivo con HTTPS.

Para IA: copiar `.env.example` a `.env`, configurar AI_API_KEY solo en el servidor y reiniciar. Ambos modos cargan ese archivo. [Guía y evaluación](../docs/interprete-ia.md). Sin clave se conserva el uso manual y la demostración con mock.

Los datos son por origen: localhost:3000, 127.0.0.1:3000 y el puerto anterior tienen almacenamientos diferentes. Para trasladar pendientes, descargar respaldo desde el origen anterior y restaurar en el nuevo espacio vacío. No se eliminan datos al instalar dependencias, compilar o arrancar.
