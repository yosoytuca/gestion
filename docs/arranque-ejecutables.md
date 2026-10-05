# Ejecutables de inicialización y puerto 3000

La carpeta operacional ahora está en la raíz: inicializacion/. La carpeta frontend/src/app/initialization sigue preparando el código de la PWA; no era un reemplazo de estos ejecutables.

01-instalar-dependencias.cmd/mjs usa npm ci según lockfile; requiere Node/npm y funciona desde otra carpeta. No borra IndexedDB. 02 no existe: no se comparte API. 03-arrancar.cmd/mjs ofrece menú: túnel VS Code o producción local; ambos usan 3000 y no sustituyen el puerto si está ocupado. También admite --modo=tunel/produccion.

Modo túnel compila desarrollo y prepara localhost:3000. El reenvío lo realiza VS Code desde Puertos → Reenviar puerto → 3000; no se activó un túnel ni se inició sesión Microsoft en esta verificación. [Documentación oficial](https://code.visualstudio.com/docs/debugtest/port-forwarding). Producción local compila minificado sin mapas y sirve dist/, sin desplegar HTTPS externo ni conectar backend.

El servidor estático común scripts/web-server.mjs atiende GET/HEAD, MIME, fallback SPA, rutas profundas y errores de lectura/puerto. scripts/dev.mjs también usa 3000 por defecto. .env.example se actualizó; los ejecutables de menú fijan 3000 independientemente de DEV_PORT.

## Verificación

- Instalador real: npm ci completado, 52 paquetes, sin vulnerabilidades reportadas por esa ejecución. Log instalacion-output.txt. Hubo inicialmente EPERM por esbuild abierto desde el arranque anterior; se detuvo y la reinstalación completó. No se habilitaron scripts de instalación adicionales; npm mantiene advertencia de esbuild.
- npm run check: 67/67, tipos, límites y build correctos después de reinstalar. Log arranque-check.txt.
- Menú interactivo: selección 1 compiló y respondió HTTP 200 en localhost:3000; imprimió instrucciones de reenvío VS Code.
- Modo producción desde carpeta externa: resolvió la raíz, compiló producción y arrancó en 3000. Puerto ocupado se detectó sin elegir otro.
- Navegador Chromium: producción en localhost:3000, arranque y demo aislada; servidor detenido (sin listener 3000) y recarga de /settings funcionó desde caché conservando demo. Después se volvió a arrancar producción.

El cambio de origen/puerto no migra IndexedDB automáticamente. Datos anteriores conservados en su origen; exportar/restaurar respaldo si se necesitan en localhost:3000. No se configura una aplicación móvil nativa ni un servicio API nuevo.
