# Instalación, arranque y operación de la PWA web

El arranque operativo está en la carpeta raíz [inicializacion](../inicializacion/LEEME.md): 01 instala dependencias, 03 ofrece túnel VS Code o producción local y ambos sirven en puerto 3000. No hay paso 02 de compartir API. Esta carpeta de ejecutables es independiente de la preparación interna del frontend. Detener arranques anteriores antes de ejecutar npm ci en Windows para evitar bloqueo de esbuild.exe.

## Desarrollo local

Versión de referencia Node 24.20.0, registrada en .node-version y .nvmrc. No se instala ni cambia Node automáticamente. package.json conserva compatibilidad >=22; la versión verificada es la de referencia.

Desde la raíz:

```sh
npm ci
npm run check
npm run dev
```

npm ci utiliza package-lock.json y falla si no coincide con package.json. No hace falta instalar dependencias cada vez que se abre la app; repetir al cambiar el lockfile. Se requieren las dependencias de desarrollo para compilar y probar; el navegador recibe el bundle, no node_modules.

`npm run dev` carga .env si existe, recompila y sirve archivos locales. .env.example documenta DEV_HOST/DEV_PORT; copiarlo a .env es opcional. No guardar secretos del servidor en frontend ni subir .env. El servidor informa puerto ocupado/puerto inválido. Reiniciar para recompilar; no hay hot reload.

La app tiene inicialización/configuración/almacenamiento/servicios separados en frontend/src/app/initialization. El coordinador espera datos y lectura inicial antes de mostrar App, cierra conexiones al fallar y permite reintentar sin borrar registros. La preparación inicial es independiente de las migraciones versionadas del adaptador. Los ejemplos demo se crean en una transacción y solo en su base aislada.

## Datos y recuperación

Configuración → Descargar respaldo genera JSON versionado con todas las colecciones del espacio actual, incluyendo historia, sesiones, tombstones, lotes y outbox. Conserva el archivo fuera del almacenamiento del navegador. No hay respaldo remoto automático.

Restaurar exige archivo válido, misma versión de formato/base y mismo tipo de espacio (personal/demo), y destino completamente vacío. Rechaza datos existentes, referencias inválidas y duplicados; escribe todo en una transacción. No fusiona ni reemplaza datos. Conserva la identificación del dispositivo original para reabrir sus sesiones, y recarga la app. Un fallo no autoriza borrar el destino. No restaurar la misma identidad simultáneamente en varios dispositivos al implementar sincronización real futura.

Puede solicitarse almacenamiento persistente desde configuración; el navegador decide y aun concedido el usuario puede borrar el sitio. El respaldo contiene información de pendientes e historial: conservarlo como información personal.

## Actualizaciones PWA

Build versiona caché usando JS/CSS, shell, manifest, iconos y código del service worker. Navegaciones controladas sirven shell de la versión activa para evitar mezclar HTML nuevo con JS viejo. La nueva versión espera; el usuario puede posponerla o elegir Actualizar y confirmar que guardó sus cambios antes de recargar. La primera instalación no requiere esa confirmación.

No instalar la PWA es una forma de uso plenamente válida. Offline requiere una carga inicial con caché completada. No vaciar IndexedDB para resolver una actualización; conservar respaldos y probar migraciones previamente.

## Preparación de producción

```sh
npm ci
npm run check
npm run build:production
```

El último comando produce dist/ minificado sin source maps. Publicar únicamente ese directorio en hosting estático HTTPS con raíz / (manifest y rutas actuales usan esa raíz). Configurar fallback a index.html para rutas de la app; un futuro /api debe permanecer separado del fallback. MIME correctos para JS/CSS/manifest/PNG/SVG; servir sw.js sin caché prolongada, y revalidar index.html/app.js/app.css al usar nombres fijos. No publicar node_modules, .env ni archivos privados.

Desplegar el conjunto completo de archivos como una versión, evitando copias parciales. Antes de publicar: comprobar desde el navegador raíz/ruta profunda, recarga, arranque sin red, persistencia, actualización entre dos versiones, formularios pendientes y respaldo/restauración. Probar Chrome/Chromium, Edge cuando corresponda y navegadores compatibles; teléfonos, tablets y escritorio. Conservar el artefacto anterior para revertir recursos; revertir recursos no revierte migraciones de datos.

Esto prepara el frontend para hosting; no configura un proveedor, dominio, backend o publicación real. El servidor dev no se presenta como servidor de producción. La autorización, permisos, PostgreSQL, observabilidad de servidor y API/sync real corresponden a etapas futuras.

## Túneles

No hay túnel instalado ni activado. Un túnel HTTPS puede usarse para una prueba temporal desde otro dispositivo y debe cerrarse al terminar; no reemplaza hosting ni producción. Elegirlo y exponer el servidor es una acción separada. Las bases del navegador se aíslan por origen: cambiar de localhost a dominio/túnel no mueve los datos automáticamente; usar respaldo/restauración cuando corresponda.
