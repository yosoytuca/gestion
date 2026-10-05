# Entrega: núcleo local

Arquitectura modular aprobada. Esta etapa implementa dominio y persistencia local; no es una aplicación final ni un backend HTTP funcional.

## Incompatibilidades encontradas y resolución explícita

| Problema | Solución aplicada | Archivos |
| --- | --- | --- |
| Categorías/schema previo en minúsculas; nueva instrucción exige mayúsculas | WORK/EDUCATION/HEALTH/PERSONAL y schema v1.1; rechazar v1.0 explícitamente | datos/contracts/entities.ts, datos/contracts/interpreter/interpreter-response.schema.json |
| ActivityStatus exige IN_PROGRESS, pero diseño lo deriva de sesión | ActivityStatus con cuatro estados; persistir tres y calcular IN_PROGRESS mediante effectiveStatus | datos/contracts/entities.ts, datos/domain/activities/public.ts |
| Propuesta anterior bloqueaba toda entrada; nueva regla conserva claras aparte | BatchRecord con operaciones preparadas/bloqueadas/aplicadas; opId aplicados inmutables | frontend/src/app/application/interpreter-workflow.ts |
| Exclusión global no puede garantizarse desconectado | Pausar anterior local, bloquear ante remota conocida y conservar/registrar solapamientos | frontend/src/modules/timer/public.ts, frontend/src/modules/sync/public.ts |
| Schema en docs | Mover fuente única canónica a datos/contracts/interpreter | docs/contrato-interprete.md |
| React propuesto pero esta etapa requiere núcleo, no diseño final | Demostrador DOM sin React; núcleo compatible con UI React posterior | frontend/src/app/demo.ts |

## UX propuesta antes de integrar IA real

1. Mostrar resumen compacto: «2 listas para guardar · 2 por aclarar», títulos y preguntas específicas; evitar formulario completo.
2. Sin dudas, futura UX podrá guardar directamente con resumen. En mock siempre separar Preparar y Aplicar claras.
3. En lote mixto proponer «Guardar claras» y «Aclarar pendientes». Guardar claras ejecuta solo el subconjunto preparado; nunca elegir arbitrariamente un objetivo ambiguo.
4. Conservar inputId de entrada, opId estables y batchId nuevo por aplicación. Resolver vuelve a validar candidatos/versiones y aplica solo pendientes.
5. Bloquear dependientes de grupos ambiguos. Operación aplicada no puede cambiar ni desaparecer en una revisión. Proveedor futuro deberá conservar identidad o application reconciliarla explícitamente.
6. Asunto sin operación queda en clarifications; lote sigue PARTIAL aun con claras guardadas.
7. Fallo revierte el subconjunto aplicado, no borra borrador. Deshacer/descartar pendientes son futuros; no implementados todavía.

Propuesta para revisar antes de IA; mecanismo probado con JSON manual. «Médico a las cuatro» también necesita AM/PM salvo contexto suficiente.

## Implementado

Contratos TypeScript y schema runtime; reglas puras de calendario/orden/tiempo/estado; repositorios IndexedDB y UnitOfWork; CREATE/UPDATE/COMPLETE/CANCEL/DELETE con auditoría, versiones y outbox; creación de grupos y progreso; START/PAUSE/RESUME/STOP; historial por estado/categoría/periodo local/búsqueda; lotes simulados con aplicación de claras; SyncEngine contra mock con push/pull, idempotencia, ack, cursor y conflictos conservados.

Demostrador permite crear/editar offline, acciones, timer, historial, JSON y contador de outbox. Manifest/service worker proporcionan shell cacheado tras primera carga. resolveCalendar recibe intención temporal normalizada; no es parser de frases.

## Conflictos de sesiones

Conservar intervalos completos y pares en SessionConflict. Tiempo definitivo de una actividad afectada = null hasta resolver; cálculo bruto no decide qué registro es correcto. No hay UI/comando de resolución ni recorte automático.

Sesión remota activa conocida bloquea START/RESUME con REMOTE_SESSION_ACTIVE. Dos dispositivos offline desconocidos conservan sesiones; Sync registra conflicto al intercambiar datos. Backend real deberá distinguir evidencia offline de autorización de inicios online.

## Herramientas

Runtime: ajv (JSON Schema 2020-12) y ajv-formats (UUID/fecha). Desarrollo: typescript, @types/node, esbuild y fake-indexeddb. Runner nativo node:test. Sin ORM, framework HTTP, React, SDK externo o wrapper IndexedDB.

npm run lint verifica límites/ciclos, no es ESLint/formateador. TypeScript estricto verifica tipos/símbolos sin uso; .editorconfig define estilo básico. .env.example documenta DEV_HOST/DEV_PORT, leídos del proceso; no cargar .env automáticamente ni configurar secretos.

tsx se retiró tras error uv_os_get_passwd de Windows. Esbuild + node:test funcionan. Instalación mostró advertencia de lifecycle scripts esbuild sin aprobación; ejecutables funcionan y build/test pasan. No habilitar scripts adicionales para esta entrega.

## Pendiente y alcance real

- Backend HTTP, login, PostgreSQL/migraciones SQL, APIs REST y transporte sync real.
- IA/STT reales, parser semántico, grabación/audio diferido y procesamiento al reconectar.
- UI web final, iconografía, filtros y navegación mediante rutas/History API completos; UX real de aclaraciones. (La etapa 4 implementó la UI Preact; este informe conserva el alcance histórico de etapa 3.)
- Resolución de conflictos, merge de campos disjuntos, deshacer, retención/limpieza de registros.
- Edición/disolución de grupos como comando propio (sí se edita groupId en actividad).
- Estadísticas, configuración completa, notificaciones, despliegue y validación web/PWA en navegadores y dispositivos reales.
- Sync automático/background y sesión auth vencida sin conexión.

Carpetas .gitkeep son reservadas, no módulos funcionales. Activación de service worker simplificada para desarrollo; política de actualizaciones de producción pendiente. Tests usan fake-indexeddb, no acreditan cuotas reales ni instalación opcional de la PWA. Evidencia y resultados en resultados-verificacion.md.
