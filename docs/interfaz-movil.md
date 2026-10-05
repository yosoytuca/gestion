# Etapa 4: interfaz móvil y PWA

Plataforma: web PWA offline-first. Uso directo en navegador; instalación opcional. El diseño mobile-first incluye teléfonos, tablets y escritorio y no implica una plataforma móvil específica.

Implementada el 3 de octubre de 2026. Se conservan los servicios, repositorios, reglas de fechas, orden, timer y aplicación del intérprete del núcleo aprobado. Las 45 pruebas anteriores no se modificaron para hacerlas pasar.

## Decisión técnica

Preact 11 con TypeScript aporta componentes y hooks mantenibles, integración directa con esbuild y una capa visual independiente del núcleo. No se añadió router externo, biblioteca de iconos ni sistema de componentes. SVG propios de pico, libro, manzana y brújula; sin assets ni fuentes externos.

Dependencias nuevas: preact 11.0.0 (runtime); jsdom 30.1.1 y @types/jsdom 30.0.0 (pruebas). package-lock fija versiones. No se habilitaron scripts adicionales de instalación.

App compone pantallas y UiController adapta UiPort a LocalKernel, CaptureService e InterpreterWorkflow. Los componentes no abren IndexedDB. Los módulos se consumen mediante sus exports públicos. HistoryFilter se trasladó a contratos compartidos conservando su exportación y semántica; no cambió el schema del intérprete.

## Pantallas y comportamiento

Mis pendientes respeta el orden del núcleo, con bloques temporales, contadores activos y categorías. Los grupos muestran progreso consultado al servicio; pueden repetirse visualmente en distintas fechas y sus hijos siguen independientes. Categoría y urgencia tienen señales separadas.

Detalle: edición, calendario, hora de 24 horas, grupo y acciones. Una hora sin fecha impide guardar. El timer deriva intervalos/timestamps; los ticks solo pintan. Iniciar otra actividad pausa la anterior mediante dominio. Detener conserva el pendiente; detener y completar invoca la operación terminal existente. Cancelar conserva historial y eliminar usa tombstone.

Historial consulta COMPLETED/CANCELLED con búsqueda, categoría y periodos locales. Estadísticas está pendiente y Cerrar sesión deshabilitado. Las hojas manejan foco, Escape y fondo inerte.

Hablar simula transcripción sin permiso al micrófono; Escribir admite texto natural. Los mocks usan escenarios seleccionados, claramente indicados. Resultados: guardar claras, resolver ejemplo AM/PM sin duplicar operaciones, reabrir lotes pendientes. Los proveedores reales podrán sustituir los mocks a través de los puertos existentes.

## Rutas, PWA y demo

Rutas: /, /category/:category, /activity/:id, /new, /capture/write, /capture/voice, /capture/result/:id, /history, /settings, /statistics. Las hojas usan ?sheet=... con entrada de historial. Atrás cierra la hoja antes de volver por detalle/categoría/inicio. Entrada directa profunda prepara regreso a inicio. Servidor de desarrollo con fallback para rutas reconocidas; service worker con app shell para navegación offline.

Manifest standalone, PNG propios maskable 192/512 y SVG. Caché versionada por hash del build. Offline startup requiere primera visita exitosa. Indicador basado en navigator.onLine: detener solo el servidor no altera conectividad del navegador y sigue diciendo «En este dispositivo». No afirma sincronización remota.

Bases separadas gestor-ui-personal y gestor-ui-demo. Configuración abre/restablece demo y vuelve a personales; solo demo se reinicia. La base técnica anterior gestor-local-demo se conserva. demo.ts queda como demostrador histórico y no es entrada del build. No se migran esos ejemplos a datos personales.

## Verificación

Antes: 45/45. Después: **56/56**, cero fallos/omitidas; tipos, límites de 43 archivos TypeScript sin ciclos y build correctos. [Salida completa](mobile-check-output.txt).

Las 11 pruebas nuevas montan Preact/jsdom con servicios reales y adaptador IndexedDB mediante fake-indexeddb: creación/outbox, edición/completar/historial, fecha/hora, rutas/hojas/recarga, timer/pausa automática, grupos/aislamiento demo, captura parcial/aclaración/idempotencia, voz mock, filtros/contadores/periodos, cancelar/eliminar/logout, hijos de grupo con fechas distintas.

Navegador interno: 360×800, 390×844, 430×900; sin desbordamiento horizontal a 360/430. Inicio, detalle, calendario e historial revisados. Atrás: calendario → detalle → Educación → inicio. Refresh profundo conservó detalle. Con servidor detenido se recargó detalle desde caché, editó una actividad y creó «Prueba creada sin servidor»; ambos cambios persistieron al recargar. Se probó iniciar/pausar/continuar/detener y completar por separado, con aparición en historial. Consulta de consola sin errores ni warnings en estos flujos.

Capturas reales de demo: [inicio](mobile-home-390.png), [detalle](mobile-detail-390.png), [calendario](mobile-calendar-390.png), [historial](mobile-history-390.png). Historial incluye la actividad completada durante la prueba.

## Pendientes y alcance

Falta ampliar la validación web/PWA: Chrome/Chromium, Edge y otros navegadores compatibles cuando sea razonable; teléfonos, tablets y escritorio; Atrás del navegador o mecanismo equivalente; teclado virtual y lectores de pantalla; cierre/reapertura del navegador, orientación, cuota/almacenamiento y actualización entre versiones del service worker. La instalación desde HTTPS se comprobará como capacidad opcional. Los viewports comprobados no equivalen a pruebas en dispositivos físicos.

No hay IA/STT/PostgreSQL/backend/sync real ni estadísticas avanzadas. Hora usa controles nativos separados para hora/minutos; captura inteligente usa escenarios fijos. No hay publicación ni permisos de audio. Sin desviaciones del alcance solicitado.

La cercanía se representa mediante una bolita independiente en cada tarjeta: gris sin fecha, blanca a más de 7 días, verde a 4–7 días, amarilla a 2–3 días, roja mañana/hoy y roja oscura si venció fecha u hora. Usa días calendario de la zona del dispositivo. Se recalcula con la actualización local cada minuto y al volver a primer plano, también offline y sin IA. La fecha textual sigue visible y la bolita tiene descripción accesible.
