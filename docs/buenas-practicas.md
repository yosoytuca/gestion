# Revisión de buenas prácticas del gestor de actividades

Revisión de código y configuración: 3 de octubre de 2026. Producto web PWA offline-first, etapa local. Esta evaluación no añade funciones ni declara implementados los servicios futuros. «Cubierto» se limita al alcance actual; «Parcial» identifica un mecanismo existente con trabajo pendiente.

## Mejoras aplicadas después de la revisión

La tabla siguiente conserva los hallazgos de la revisión inicial. A petición del usuario se aplicaron mejoras locales: carpeta initialization (configuración, almacenamiento, servicios, coordinador, pantalla de arranque y actualizaciones); error/reintento sin resetear datos; seed demo transaccional; exclusión inmediata de operaciones UI y guardado confirmado aunque falle refresh; respaldo completo validado y restauración atómica solo a espacio vacío; solicitud opcional de persistencia; actualización PWA posponible y confirmada; versión Node de referencia, carga opcional de .env, errores de servidor y build de producción minificado.

Los puntos 3–5 y 12 quedan implementados para el alcance local. Los puntos 8–10, 15–16 y 18–20 se reforzaron; pruebas en navegadores/dispositivos adicionales, despliegue real, deshacer y mantenimiento operativo continuo siguen pendientes. Auth/permisos remotos y sync real permanecen en sus etapas futuras. No se añadieron dependencias ni túneles. La arquitectura sigue siendo web/PWA.

Ver [operación web](operacion-web.md) y [verificación de las mejoras](practicas-aplicadas.md). Esta sección reemplaza el estado temporal de las prioridades de la revisión inicial.

| # | Criterio | Estado y evidencia | Qué falta / riesgo que resuelve |
|---|---|---|---|
| 1 | Modularidad | Cubierto: frontend/modules, backend/modules, datos; scripts/check-boundaries.mjs controla imports y ciclos. | Mantener límites al conectar servicios; evita acoplamiento entre funciones. |
| 2 | Interfaz, lógica y datos | Cubierto: UiPort → UiController → LocalKernel/casos de uso → UnitOfWork/IndexedDB. | Conservar puertos al añadir API; evita reescribir dominio por cambios visuales. |
| 3 | Carpeta dedicada a la inicialización | Parcial: main.tsx coordina base, servicios y demo; demo-data.ts separa ejemplos. | Centralizar preparación en una carpeta dedicada, con módulos de configuración, almacenamiento, servicios y datos iniciales y un punto coordinador. Asprobo es la referencia organizativa indicada por el usuario, no un proyecto inspeccionado en esta revisión. Evita mezclar responsabilidades de arranque. |
| 4 | Arranque ordenado y controlado | Parcial: main.tsx espera base y demo antes de render; App carga snapshot. | Declarar dependencias de pasos y estado listo; mostrar errores y permitir reintento de apertura antes de montar UI. Evita una pantalla sin explicación si falla el arranque. |
| 5 | Inicialización segura y repetible | Parcial: stores solo se crean si faltan; demo exige espacio demo vacío y separado de personales. | Separar preparación inicial de migraciones; reiniciar sin duplicar, sobrescribir ni borrar datos. Recuperar seed demo parcial: hoy usa varias transacciones y no se rellena automáticamente tras un fallo a mitad. |
| 6 | Fuente de datos | Cubierto local: IndexedDB persistente; snapshot y formularios son proyecciones/borradores; outbox registra cambios. | Definir reconciliación con servidor real cuando exista; evita copias divergentes. |
| 7 | Validación/consistencia | Cubierto local: validación de dominio, schema intérprete, versiones y transacciones con auditoría/outbox. | Validación y restricciones del servidor en próxima etapa; evita aceptar cambios inválidos o incompletos. |
| 8 | Errores útiles | Parcial: App.run muestra errores, conserva formulario y espera guardado; rollback probado. | Error de arranque con reintento; distinguir fallo de guardado de fallo de refresco posterior (puede haberse guardado); evita reintentos confusos. |
| 9 | Duplicados | Parcial: controles busy, opId/lotes aplicados e idempotencia de sync mock; tests de reintento. | No hay garantía general de idempotencia de creación manual con mutationId reutilizado desde UI; revisar guardado exitoso seguido de error de refresh. |
| 10 | Entornos/configuración | Parcial: .env.example sin secretos, configuración de dev, bases demo/personales aisladas. | Configuración, build y despliegue de pruebas/producción al publicar; evita conectar entornos equivocados o exponer secretos. |
| 11 | Seguridad/permisos | Etapa futura: auth no implementada, logout deshabilitado; aislamiento local por userId no equivale a autorización de servidor. | Comprobar permisos en cada endpoint cuando haya usuarios; evita acceso no autorizado. |
| 12 | Respaldo/recuperación | Pendiente y aplicable antes de confiar datos importantes: sin exportación/restauración ni servidor real de respaldo. | Exportar/importar con versión, validación y prueba de restauración; evita pérdida al borrar datos del navegador. |
| 13 | Reutilización visual | Cubierto: Sheet, CategoryIcon, DatePicker/TimePicker, editor y estilos compartidos. | Mantener componentes pequeños y coherentes; evita variaciones y correcciones repetidas. |
| 14 | UX completa | Parcial: responsive móvil, etiquetas, foco/hojas, estados vacíos, carga, errores y confirmación de cancelar/eliminar. | Deshacer pendiente; ampliar teclado/lectores de pantalla y tablets/escritorio; evita acciones accidentales y barreras de uso. |
| 15 | Offline definido | Cubierto para manual/timer/historial: shell cacheado, servicios locales, indicador de conectividad sin afirmar sync remoto. | Exponer cambios pendientes y estados reales cuando se conecte sync; mock de captura no acredita IA/voz offline real. |
| 16 | Caché/actualizaciones | Parcial: hash por build, shell y fallback offline; skipWaiting/claim automáticos. | Política de actualización que preserve formularios y compatibilidad shell/schema; prueba entre versiones. Evita mezcla de versiones e interrupciones. |
| 17 | Sync/conflictos | Parcial: outbox, transporte mock, versiones, tombstones, idempotencia y conflictos probados. | API/transporte real, recuperación de red y resolución visible de conflictos; evita sobrescritura o duplicados entre dispositivos. |
| 18 | Límites locales | Parcial: errores de transacción/cuota simulados, documentación de límites y demo aislada. | Persistencia solicitada cuando aplique, cuota real, recuperación y política de limpieza al incorporar auth; evita prometer conservación permanente. |
| 19 | Pruebas relevantes | Parcial: último check 56/56; pruebas de dominio/UI/rollback/migración/mock sync y navegador offline/Back/refresh documentadas. | Actualizaciones PWA, respaldo/restauración, permisos futuros y matriz de navegadores/dispositivos; evita regresiones de procesos críticos. |
| 20 | Documentación/mantenimiento | Parcial: README, arquitectura, contratos, informes y lockfile; control de imports/tipos/tests/build. | Procedimiento de publicación, actualización de dependencias y observabilidad sin datos sensibles al operar servicios reales. |

## Prioridad según el producto actual

Las migraciones conservan su criterio propio, adicional a los puntos de inicialización: versionar cambios de estructura/datos y probar actualización desde versiones anteriores sin pérdida. El caso actual v1→v2 está probado y onversionchange cierra conexiones; esa evidencia no acredita todas las migraciones futuras.

1. Antes de guardar información importante: exportación/restauración probada. Hoy los datos dependen del almacenamiento de este navegador, sin respaldo remoto.
2. Robustez inmediata: error/reintento al abrir IndexedDB; distinguir guardado confirmado de error al refrescar; recuperación del seed demo parcial.
3. Antes de distribuir actualizaciones: política y pruebas de actualización del service worker y compatibilidad de datos, preservando borradores.
4. Antes de publicar: matriz web (Chrome/Chromium, Edge y navegadores compatibles), accesibilidad, responsive amplio y operación/deploy documentados.
5. Al conectar backend/auth/sync: autorización en servidor, entornos, idempotencia completa, conflictos y recuperación de red. No anticipar microservicios ni wrappers móviles.

En la revisión documental inicial no se ejecutó una nueva suite. Tras aplicar las mejoras se verificaron 67/67 pruebas; resultados en practicas-check.txt. El check 56/56 de mobile-check-output.txt conserva la etapa anterior.

## Uso como referencia para otras apps

Preferencia de organización acordada para nuevos proyectos: carpeta dedicada a inicialización, responsabilidades separadas y un coordinador; arranque según dependencias con error/reintento; preparación segura y repetible, separada de migraciones. Esa organización ya está aplicada a este gestor en frontend/src/app/initialization.

Reutilizar principios y contratos apropiados al dominio, no copiar toda la infraestructura. Una app sin cambios offline no necesita outbox; una app sin usuarios remotos no necesita auth de servidor. La PWA sigue siendo web y su instalación es opcional. Para cada proyecto clasificar estos criterios como cubierto, parcial, pendiente o no aplicable, con evidencia, riesgo y prioridad.
