# Modelo de datos propuesto

## Separación y propiedad modular

datos/domain define reglas puras; datos/contracts define DTO, schemas y puertos. datos/database conserva schema/migraciones del servidor; datos/local conserva schema/migraciones IndexedDB. No contiene un servicio desplegable. Los adaptadores SQL e IndexedDB viven en infraestructura de backend/frontend respectivamente.

| Propietario | Entidades / responsabilidad |
| --- | --- |
| Auth | User, AuthSession; no se replican hashes ni tokens al almacén de actividades |
| Activities | Activity y sus transiciones |
| Groups | ActivityGroup; referencias de hijos se cambian mediante workflow con Activities |
| Sessions | WorkSession, WorkInterval y detección de solapamientos |
| Capture frontend | InputDraft y audio local; no se sincroniza como actividad |
| History | Puerto de consulta ActivityChange; escritura de auditoría coordinada con cada mutación |
| Statistics | Proyecciones de lectura, sin propietario de actividades |
| Sync | LocalOutbox, AppliedMutation, ChangeFeed y metadatos/cursor |

Repository por dominio expone operaciones tipadas, no SQL arbitrario. UnitOfWork garantiza cambios entre actividades, sesiones, auditoría e idempotencia en una transacción. History/Statistics consultan proyecciones autorizadas. Migraciones centralizadas respetan propiedad de tablas; compartir PostgreSQL no permite escritura cruzada sin caso de uso público.

## Evolución de metadatos

LocalOutbox incorpora batchId y sequence para lotes atómicos resueltos, además de baseSnapshot o referencia a base local para reconciliar cambios. AppliedMutation conserva batchId para reintentos del lote. Cursor del servidor se guarda por usuario y dispositivo; actualizarlo junto a la aplicación de la página recibida.

InputDraft y audio diferido siguen pendientes. El núcleo implementa BatchRecord con response, revision, appliedOpIds/preparedOpIds/blockedOpIds, groupMap y estado PREPARED/PARTIAL/APPLIED. inputId agrupa la entrada; cada subconjunto aplicado genera batchId de sincronización independiente y atómico.

Propuesta para sesiones solapadas: registro de conflicto propiedad Sessions con id, intervalIds, detectedAt y resolution nullable. Sync transporta el resultado; no cambia intervalos por su cuenta. No calcular un total definitivo ignorando la intersección sin una regla aprobada.

UUID para entidades; instantes técnicos en UTC; fechas de calendario YYYY-MM-DD y horas HH:mm separadas. userId siempre verificado por el servidor, nunca confiado desde IA.

| Entidad | Campos principales |
| --- | --- |
| User | id, username único, passwordHash, createdAt |
| AuthSession | id, userId, tokenHash, createdAt, lastUsedAt, expiresAt, revokedAt |
| Activity | id, userId, groupId nullable, title, category, type, dueDate nullable, dueTime nullable, timeZone, reservedDurationMinutes nullable, status, createdAt, updatedAt, completedAt nullable, cancelledAt nullable, deletedAt nullable, version |
| ActivityGroup | id, userId, title, createdAt, updatedAt, deletedAt nullable, version |
| WorkSession | id, userId, activityId, deviceId, state RUNNING/PAUSED/STOPPED, startedAt, stoppedAt nullable, version |
| WorkInterval | id, sessionId, startedAt, endedAt nullable, version |
| ActivityChange | id, userId, activityId, mutationId, origin manual/interpreter/session/sync-resolution, patch, previousValues, occurredAt, recordedAt |
| InputDraft | id=inputId, userId, text nullable, audioBlobKey nullable, capturedAt, timeZone, localDate, localTime, state, interpretation nullable |
| LocalOutbox | mutationId, userId, deviceId, entityId, operation, baseVersion nullable, payload, createdAt, attempts, state, lastError nullable |
| AppliedMutation | userId, mutationId, result, serverRecordedAt |
| ChangeFeed | cursor ordenado del servidor, userId, entityType, entityId, version, snapshot o tombstone |

category: WORK/EDUCATION/HEALTH/PERSONAL según instrucción aprobada de implementación. type: TASK/COMMITMENT. ActivityStatus admite PENDING/IN_PROGRESS/COMPLETED/CANCELLED; status persistido utiliza PENDING/COMPLETED/CANCELLED e IN_PROGRESS se deriva de WorkSession RUNNING. Pausada/detenida conserva PENDING. La incompatibilidad con categorías previas y el schema v1.1 se explica en implementacion-local.md.

SyncConflict conserva snapshot local/remoto de conflictos de entidades; SessionConflict conserva ids de intervalos solapados. Se almacenan por separado en IndexedDB. Los intervalos y la outbox no se eliminan automáticamente.

## Restricciones

- dueTime requiere dueDate. Fecha ausente es válida; hora ausente no equivale a 00:00.
- reservedDurationMinutes representa ocupación de compromiso, no estimación de trabajo.
- Grupo e hijos pertenecen al mismo usuario. El grupo no es una actividad y no duplica contadores.
- Solo TASK admite contador en V1; COMMITMENT se completa manualmente.
- COMPLETED exige completedAt; CANCELLED exige cancelledAt. No pasar entre estados terminales sin operación explícita futura de reapertura.
- Registro deletedAt no admite cambios ordinarios. DELETE es distinto de CANCEL.
- Un intervalo abierto por sesión como máximo; una sesión activa por dispositivo mediante transacción y coordinación entre pestañas.
- Auditoría aceptada e idempotencia son responsabilidad del servidor; occurredAt del cliente no decide conflictos.
- syncStatus pertenece al repositorio local, no al objeto de negocio compartido.

## Rangos imprecisos

Una expresión como «la próxima semana» se conserva en InputDraft/interpretación como evidencia y rango. La Activity de V1 sigue teniendo fecha concreta nullable. No convertir rango en lunes automáticamente; aclarar o conservar borrador. Aceptar un rango como vencimiento de actividad exigiría ampliar el modelo y sus reglas de orden, por lo que no se introduce todavía.

## Índices previstos

Activities por userId/status/dueDate/dueTime, groupId y updatedAt; búsqueda por título; sesiones por activityId; ChangeFeed por userId/cursor; unicidad AppliedMutation(userId, mutationId). Los índices finales se revisarán con consultas reales.
