# Buenas prácticas aplicadas al gestor

3 de octubre de 2026. Se aplicaron los criterios apropiados a una PWA local sin incorporar backend, auth, IA o STT reales, ni túneles o publicación. No se añadieron dependencias.

## Cambios

- frontend/src/app/initialization: configuración, almacenamiento, composición de servicios, coordinador, pantalla de arranque y actualización PWA. main.tsx solo inicia la app. Se comprueba lectura inicial antes de mostrar App; si falla se cierra conexión, se informa y permite reintentar, sin restablecer datos.
- demo-data.ts: carga en una transacción, conserva aislamiento e idempotencia. Fallo de escritura revierte grupos, actividades, historia y outbox; reintento no duplica. No repara automáticamente bases demo parciales de versiones anteriores; pueden restablecerse desde configuración.
- app.tsx: exclusión de operaciones inmediata mediante ref y estado visual; un error de refresco posterior a un guardado confirmado se comunica como guardado, no como fallo de escritura. Regresa a lista sin invitar a crear nuevamente.
- backup.ts/UiPort/UiController/configuración: exportación JSON de las diez colecciones y restauración validada/atómica en destino vacío del mismo espacio. Conserva datos originales, tombstones, auditoría, intervalos, conflictos, lotes y outbox. Validación de versión/identidad/entidades/referencias; límite de archivo 20 MB. Rechaza sobrescritura. Restauración confirma en página y recarga con identidad del dispositivo original.
- Configuración: solicitud opcional de almacenamiento persistente y explicación del respaldo. No se promete permanencia ni respaldo remoto.
- Service worker/updates.ts: shell de versión activa, caché hash de todos los recursos/código, actualización esperando decisión explícita, posponer y confirmación web antes de recarga. No recarga automáticamente un formulario abierto. Con otras pestañas abiertas hay que guardar sus cambios antes de confirmar; no se implementó aún coordinación de borradores entre pestañas.
- IndexedDB: cierra conexión si una apertura bloqueada termina después de haberse comunicado el fallo. No cambia versión/schema ni reglas de migración.
- .node-version/.nvmrc: Node de referencia 24.20.0. npm ci/lockfile siguen siendo la instalación reproducible. dev carga .env opcional y comunica puerto inválido/ocupado; build:production minifica y excluye mapas. El servidor sigue siendo solo de desarrollo.

## Verificación

Baseline: 56/56 antes de modificar código. Final: **67/67**, 0 fallos/omitidas; tipos, límites de 50 archivos sin ciclos y build correctos. [Salida íntegra](practicas-check.txt). [Build de producción](practicas-production.txt): minificado, sin archivos .map.

Once pruebas adicionales: cinco de atomicidad demo, respaldo/validación/rollback y preparación/reintento; cuatro de UI para guardado con lectura fallida, arranque/reintento, confirmación/restauración y actualización; dos de service worker para esperar decisión y servir shell activo offline. Las pruebas anteriores permanecen intactas, salvo imports aditivos en la suite visual.

Navegador interno Chromium: configuración a 390 px sin desbordamiento; descarga de respaldo preparada desde UI; transición entre builds de desarrollo/producción con detección, posponer, segunda confirmación dentro de la página y recarga tras activación. Recarga de /settings con servidor de prueba detenido continuó funcionando; consulta de consola sin errores/warnings en ese flujo. Se usó origen separado 127.0.0.1:5174 para la prueba limpia de actualización y se detuvo ese servidor; el origen principal sigue siendo 127.0.0.1:5173. No se importaron ni borraron datos personales durante la prueba manual.

Capturas: [configuración](practicas-settings-390.png) y [confirmación de actualización](practicas-update-390.png). Una confirmación nativa bloqueó inicialmente la automatización del navegador integrado; se sustituyó por confirmación web y se comprobó el flujo completo en un origen limpio. La restauración completa/rollback se acredita con pruebas automáticas, no con importación manual de datos del usuario.

## Trabajo que corresponde después

Auth y permisos de servidor, PostgreSQL/API/sync real y resolución de conflictos visible mantienen sus etapas previstas. Deshacer, pruebas físicas y navegadores adicionales, cuota real, actualización con varias pestañas y borradores, y publicación/observabilidad de producción requieren trabajo posterior. La guía [operación web](operacion-web.md) explica preparación, recuperación y despliegue estático, sin declarar producción publicada.
