# Arquitectura de V1: monolito modular

## Plataforma objetivo

La composición del arranque vive en frontend/src/app/initialization con responsabilidades separadas y coordinador. Incluye estado de preparación, error/reintento y cierre de conexiones tras fallo. Los datos demo se cargan transaccionalmente; respaldo/restauración es un caso de uso de aplicación con puerto de UI, no escritura desde componentes. Ver docs/practicas-aplicadas.md.

El producto es una aplicación web PWA offline-first para navegadores modernos. Se utiliza sin instalar; la instalación es una capacidad opcional del navegador/plataforma. Mobile-first describe el diseño responsive para teléfonos, tablets y escritorio, sin imponer una plataforma móvil concreta. No se incorporarán aplicaciones nativas, wrappers, empaquetado móvil ni APIs o permisos nativos.

Arquitectura objetivo: frontend web PWA → Service Worker/caché → servicios locales → IndexedDB → Outbox/Sync Engine → API REST → backend modular → PostgreSQL. Las rutas y Atrás se resuelven mediante History API e historial del navegador. La revisión de plataforma no cambia estos módulos.

Las pruebas se centran en Chrome/Chromium, Edge cuando corresponda y otros navegadores compatibles: responsive, navegación, refresh, persistencia, IndexedDB, Service Worker, funcionamiento offline y actualización de la PWA. La instalación se valida como capacidad opcional; las pruebas en dispositivos físicos verifican comportamiento web/PWA.

Estado: arquitectura aprobada; núcleo local implementado. Alcance y diferencias de esta etapa en implementacion-local.md. Backend HTTP y proveedores reales siguen pendientes.

La separación modular es un requisito aprobado. V1 desplegará un backend único con módulos por dominio, una PWA y una base de datos compartida. No requiere microservicios. El árbol siguiente es la estructura objetivo; el árbol real se registra en arbol-real.txt. .gitkeep identifica carpetas reservadas, no funcionalidad implementada.

## Árbol del proyecto

```text
gestor_actividades/
├── frontend/
│   └── src/
│       ├── app/                  # composición, router y arranque PWA
│       ├── modules/
│       │   ├── auth/
│       │   ├── activities/
│       │   ├── activity-groups/
│       │   ├── capture/          # escritura, audio, borradores y aclaraciones
│       │   ├── timer/
│       │   ├── history/
│       │   ├── statistics/
│       │   ├── settings/
│       │   └── sync/
│       ├── components/          # elementos visuales realmente reutilizados
│       ├── infrastructure/
│       │   ├── http/            # transporte, errores y cookies
│       │   ├── storage/         # conexión IndexedDB y adaptadores locales
│       │   └── pwa/             # registro y ciclo de vida service worker
│       └── shared/              # primitivas de UI, no lógica de negocio
├── backend/
│   └── src/
│       ├── app/                  # composición, servidor y application workflows
│       ├── modules/
│       │   ├── auth/
│       │   ├── activities/
│       │   ├── groups/
│       │   ├── interpreter/
│       │   ├── voice/
│       │   ├── sessions/
│       │   ├── history/
│       │   ├── statistics/
│       │   └── sync/
│       ├── infrastructure/
│       │   ├── database/        # pool, transacciones y adaptadores SQL
│       │   └── providers/       # adaptadores IA y STT
│       ├── middleware/
│       ├── config/
│       └── shared/              # errores, reloj y primitivas técnicas
├── datos/
│   ├── domain/                  # reglas puras compartidas, sin IO
│   ├── contracts/               # DTO, schemas y puertos de repositorios
│   │   ├── api/
│   │   ├── interpreter/
│   │   ├── voice/
│   │   ├── sync/
│   │   └── repositories/
│   ├── database/
│   │   ├── schema/              # definición física servidor
│   │   ├── migrations/          # migraciones SQL versionadas
│   │   └── seeds/               # datos explícitos sin secretos
│   └── local/
│       ├── schema/              # stores e índices IndexedDB
│       └── migrations/          # evolución del almacenamiento local
├── docs/
├── tests/                       # integración, contratos, IA y E2E
├── scripts/                     # herramientas de desarrollo y validación
└── README.md
```

datos no es un tercer servidor ni una API que el navegador consulte. Contiene definiciones y reglas independientes del almacenamiento; los adaptadores ejecutables se alojan en cada aplicación. El frontend solo puede importar domain, contracts y definiciones locales aptas para navegador, nunca SQL, seeds o configuración privada.

## Organización dentro de un módulo

Frontend: public.ts como API pública, ui/, application/, ports/ y tests/ cuando sean necesarios. Hooks y tipos específicos permanecen dentro de su módulo; no crear carpetas globales utils/services que acumulen negocio.

Backend: public.ts, api/ (rutas/controladores), application/ (casos de uso), ports/ (dependencias) y tests/. Las reglas puras reutilizadas viven por dominio en datos/domain. Un módulo pequeño no necesita archivos vacíos por cada capa. Los adaptadores SQL por dominio viven en backend/src/infrastructure/database/repositories/<dominio>; los puertos correspondientes en datos/contracts/repositories. Los controladores validan DTO y delegan; no contienen SQL ni reglas del producto.

## Módulos y responsabilidades

| Dominio | Frontend | Backend |
| --- | --- | --- |
| auth | Login, estado de sesión y desbloqueo de sincronización | Credenciales, sesiones y autorización |
| activities | Lista, filtros, detalle y comandos locales manuales | Crear/editar/completar/cancelar/eliminar, validar invariantes |
| activity-groups / groups | Relación y progreso de hijos | Gestionar grupos y pertenencia sin imponer fecha común |
| capture | Hablar/Escribir/Crear manualmente; contexto de captura, borradores y ejecución local validada de propuestas | Workflows en app/application para construir contexto autorizado y coordinar interpretación |
| interpreter | Consume contrato mediante capture, sin módulo IA propio | Texto → propuesta; ningún repositorio de escritura |
| voice | Grabación y blobs a través de capture | Audio → texto mediante puerto STT; no ejecuta actividades |
| timer / sessions | Controles, intervalos y exclusión local | Validar sesiones y detectar solapamientos recibidos |
| history | Búsqueda y lectura local de finalizadas/canceladas | Consultas autorizadas de historial/auditoría |
| statistics | Resúmenes locales disponibles | Lecturas agregadas, sin depender de IA |
| settings | Preferencias e instalación | Sin módulo dedicado en V1 hasta requerir preferencias remotas |
| sync | Outbox, push/pull, conflictos, cursor y estado de red | Idempotencia, versiones, feed y despacho de comandos |

## Dependencias permitidas

1. datos/domain y datos/contracts no importan frontend ni backend, frameworks, drivers o proveedores. Contratos solo dependen de primitivas compartidas y schemas; dominio puede usar sus tipos.
2. UI → application de su módulo → reglas puras y puertos. IndexedDB y HTTP implementan puertos; app compone e inyecta adaptadores.
3. Rutas/controladores → application de su módulo → dominio/puertos. Infraestructura implementa puertos; backend/app es la raíz de composición.
4. Módulos consumen solo public.ts o contratos de otro módulo, nunca archivos internos. Cuando una acción combina actividades, grupos y sesiones, el workflow superior coordina sus APIs en una unidad de trabajo; no introducir imports recíprocos.
5. Interpreter depende del contrato semántico y del puerto LanguageModel, no de Activities, Sync ni del driver SQL. Voice depende del puerto SpeechToText y DTO de transcripción, no de Interpreter ni Activities. El workflow conecta ambos.
6. Sync valida el sobre de transporte y llama a handlers públicos de dominio mediante un registro inyectado. No replica reglas de negocio. Sessions no importa Sync; devuelve resultados/conflictos que Sync transporta.
7. History y Statistics usan puertos de lectura/proyecciones, sin importar servicios internos de escritura ni Interpreter.
8. Infrastructure y app pueden conocer implementaciones para componerlas; el dominio no conoce infraestructura. Prohibir ciclos y deep imports con reglas estáticas al crear el código.

Compartir una base física no permite que un módulo escriba tablas de otro sin su caso de uso público. La atomicidad entre dominios se obtiene mediante UnitOfWork, sin sacar SQL a los workflows.

## APIs principales

Rutas bajo /api/v1. API REST de dominio disponible para clientes autorizados; la PWA usa principalmente sync/push para sus escrituras locales. Ambas entradas llaman a los mismos handlers y mecanismos de idempotencia, auditoría y feed.

| Módulo | Endpoints propuestos |
| --- | --- |
| auth | POST /auth/login, POST /auth/logout, GET /auth/session |
| activities | GET/POST /activities, GET/PATCH/DELETE /activities/:id, POST /activities/:id/complete, POST /activities/:id/cancel |
| groups | GET/POST /groups, GET/PATCH/DELETE /groups/:id |
| interpreter | POST /interpreter/interpret |
| voice | POST /voice/transcriptions (multipart audio + contexto) |
| sessions | POST /sessions, GET /sessions/:id, POST /sessions/:id/pause, POST /sessions/:id/resume, POST /sessions/:id/stop |
| history | GET /history, GET /activities/:id/changes |
| statistics | GET /statistics/summary |
| sync | POST /sync/push, GET /sync/pull?cursor=...&limit=... |

Las acciones complete/cancel/pause son transiciones explícitas; PATCH es para campos editables, no para saltarse estados. POST /sessions crea/inicia una sesión, evitando una ruta start redundante. DELETE /groups/:id disuelve la relación y conserva sus actividades; DELETE de actividad genera tombstone.

Contratos de API: schemas de request/response y errores tipados; validación runtime también de respuestas recibidas. Lecturas paginadas con filtros explícitos. Escrituras incluyen mutationId y baseVersion cuando corresponda; creación conserva el UUID del cliente. userId se obtiene de sesión autenticada. Transporte inválido: 400; no autenticado: 401; no autorizado: 403; conflicto de versión: 409; semántica inválida: 422.

Interpreter devuelve propuesta y no implica ejecución. El workflow filtra/reconstruye candidatos autorizados aunque el cliente envíe ids; ningún id aportado por cliente/IA concede autorización.

## Contratos entre capas

- Frontend/backend: DTO serializables y schemas en datos/contracts/api; tipos generados o derivados del schema, sin duplicaciones manuales.
- Interpreter/application: input y response versionados en datos/contracts/interpreter; interpreter-response.schema.json es la única fuente canónica.
- Voice/workflow: TranscriptionRequest y TranscriptionResult con inputId, texto, idioma y contexto de captura; SpeechToTextPort reemplazable. Voice no resuelve «mañana».
- IA/interpreter: LanguageModelPort; prompts y normalización dentro del módulo, adaptador de proveedor en infrastructure/providers.
- Repository/database: interfaces por dominio, QueryPort para lectura y UnitOfWork para atomicidad. DTO de API no es una fila SQL ni un objeto IndexedDB.
- Sync/backend: envelope versionado con batchId, deviceId y comandos ordenados, cada uno con mutationId, baseVersion y payload validado; respuesta con accepted/conflict/rejected y versiones. Pull entrega páginas y nextCursor.

## IndexedDB y ejecución local

La UI siempre opera contra servicios locales. activities y timer reciben repositorios y LocalUnitOfWork; infrastructure/storage implementa IndexedDB. Los stores contienen entidades, intervalos, borradores, outbox, metadatos y cursor por usuario. La transacción local confirma entidades y outbox juntas; las pantallas no deciden si hay red.

Capture interpreta online mediante API o conserva texto/audio offline. Al recibir una propuesta, su application workflow valida el contrato y coordina comandos de activities/groups/timer; guarda el lote local y su outbox atómicamente. Sync transporta operaciones concretas, nunca audio ni instrucciones para reinterpretar. El procesamiento de audio pendiente pertenece a Capture, no a Sync.

Pull aplica cambios mediante un reconciliador que conserva ediciones locales pendientes y sus bases; no sustituye a ciegas registros sucios. Validar estados/payloads remotos antes de incorporarlos. Actualizar cursor en la misma transacción que aplica la página. Reintentar páginas no duplica entidades.

Un lote semántico resuelto se envía como unidad atómica identificada por batchId: servidor acepta todos sus comandos o ninguno. Otros lotes independientes pueden tener resultados distintos. REST y Sync alimentan el mismo ChangeFeed transaccional.

## Propuestas pendientes encapsuladas

Ambigüedad: Interpreter devuelve clarifications; Capture/Application conserva operaciones preparadas, bloqueadas y aplicadas con un mismo inputId. La regla aprobada permite conservar claras y pendientes por separado. En el mock, preparar no ejecuta; una acción explícita aplica solo las claras, atómicamente. La UX futura propuesta y la relación de revisiones/opId están en implementacion-local.md. Cancelar borrador no cancela actividades. No implementar aún la experiencia de IA real sin revisar esa propuesta.

Solapamientos: Sessions detecta intersecciones de intervalos de diferentes dispositivos; Sync registra el conflicto y conserva intervalos originales. El núcleo devuelve tiempo definitivo null cuando hay conflictos sin resolver; no recorta ni completa actividades. La regla aprobada es una sesión activa por usuario. Offline se asegura exclusión local; si se conoce una sesión remota activa, se bloquea una nueva. La resolución posterior sigue pendiente y no altera los registros automáticamente.

## Alcance de esta entrega

Entrega actual: estructura real, contratos/dominio, IndexedDB, servicios locales, mocks, pruebas e interfaz móvil funcional PWA. No incluye backend HTTP, proveedores reales ni despliegue. Ver docs/interfaz-movil.md para la etapa 4.

## Componentes

- PWA móvil: Preact y TypeScript implementados. Router propio con History API para filtros, detalles y paneles; Atrás cierra primero el panel superior. El framework permanece en la capa visual.
- Dominio independiente de UI: actividades, estados, orden temporal, grupos y sesiones.
- Repositorio local: IndexedDB; transacción que guarda cambio y operación de outbox conjuntamente.
- Sincronizador: push idempotente y pull por cursor; reintentos al abrir, reconectar y volver a primer plano. Background Sync opcional, sin garantía con la aplicación cerrada.
- Backend: TypeScript y PostgreSQL como propuesta; autenticación, validación, sincronización y adaptadores de transcripción/interpretación.
- Intérprete: texto a propuesta estructurada. Nunca ejecuta SQL ni escribe actividades.
- Ejecutor: valida propuesta, referencia, versión y autorización; aplica operaciones y auditoría en una transacción.

Voz → transcripción → intérprete. Escribir → intérprete. Crear manualmente → dominio, sin intérprete. Los tres caminos comparten validación y persistencia.

## Captura y ejecución

Cada entrada tiene inputId, texto y capturedAt, zona IANA y fecha/hora locales de captura. Se congela ese contexto para resolver expresiones relativas aunque el procesamiento sea posterior. El servidor valida coherencia del contexto y puede detectar un reloj evidentemente incorrecto.

El intérprete recibe candidatos acotados, sus versiones y contexto conversacional explícito. Devuelve operaciones y aclaraciones. Sus identificadores se contrastan con los candidatos autorizados. Confianza autodeclarada por el modelo no autoriza cambios.

Una interpretación con dudas conserva cada operación bajo el mismo lote. El núcleo mock permite aplicar claras y retener ambiguas, con opId estables para evitar duplicados al aclarar. La propuesta UX futura se documenta antes de conectar IA. Deshacer mediante comandos compensatorios sigue pendiente.

Una propuesta interpretada no equivale a una operación de sincronización: el dispositivo genera mutationId y guarda valores concretos, sin volver a llamar a IA al reintentar.

## Reglas temporales aprobadas

- Hora de 1 a 12 sin AM/PM ni contexto suficiente: preguntar; no asumir tarde. Formato explícito 16:00 no requiere pregunta.
- «El lunes»: siguiente lunes estrictamente futuro. «Hoy» conserva el día de captura.
- «El próximo lunes»: lunes de la semana calendario siguiente, con semana iniciada en lunes. Puede coincidir con «el lunes» si se habla el sábado; nunca significa automáticamente sumar una semana al próximo lunes encontrado.
- «El día 10»: siguiente día 10 estrictamente futuro, salvo mes explícito o contexto inequívoco.
- «La próxima semana»: conservar rango semanal sin elegir día; pedir precisión para convertirlo en una fecha concreta.
- Solo fecha: dueTime null. «Esta tarde/noche» no genera una hora exacta sin precisión.
- V1 usa zona del dispositivo; no añade interfaz de viajes. Guardar la zona de captura permite auditar la resolución. Propuesta pendiente: conservar fechas/horas locales de actividades ante cambios de zona del dispositivo.

## Orden y presentación

Propuesta: vencidos → hoy → fechas futuras → sin fecha concreta. Dentro de cada día: actividades con hora ascendente y luego sin hora; desempate por createdAt e id. Una fecha sin hora vence al terminar ese día local. No completar compromisos por haber pasado su hora.

No hay prioridad manual ni agenda automática. Calcular etiquetas y orden al modificar datos, cruzar límites temporales y volver a primer plano. El paso del tiempo no necesariamente invierte el orden de dos fechas futuras fijas.

Cada hijo se ordena por su fecha; el grupo es relación lógica, no bloque indivisible. Contadores principales cuentan actividades activas, nunca padres de grupo. Progreso: completadas, pendientes y canceladas por separado; canceladas no suman a completadas. Identidad de categoría y señal de urgencia independientes.

## Offline y autenticación

Service worker para recursos; IndexedDB para datos, historial disponible, sesiones, borradores y outbox. No prometer permanencia absoluta si se borran datos del navegador. Proponer solicitud de almacenamiento persistente y recuperación desde servidor.

Sin red: todas las acciones manuales y temporizadores siguen disponibles. Escribir es entrada inteligente; se puede conservar el texto pendiente de interpretación. Crear manualmente es opción separada y siempre accesible. Audio offline se almacena localmente con contexto exacto de captura y estado de procesamiento, sujeto a cuota; fallo de almacenamiento se comunica antes de afirmar que se guardó.

Al volver la red, interpretar audios pendientes con su contexto original y comprobar referencias contra datos actuales antes de ejecutar. La captura de micrófono puede interrumpirse al bloquear el móvil; no prometer grabación continua en segundo plano.

Sesión vencida offline: acceso local permitido; autenticación requerida antes de sincronizar. Propuesta: 30 días de inactividad de sesión de servidor, cookies HttpOnly/Secure/SameSite, hash Argon2id, límites de intentos y protección CSRF. Sin usuario de registro público. Las claves de IA viven en servidor. El acceso local permitido no representa verificación online de identidad.

## Sincronización

UUID generados localmente. mutationId único por usuario; el servidor conserva resultado de operaciones aceptadas para reconocer reintentos. baseVersion evita sobrescritura silenciosa. El cursor es del servidor, no un timestamp del dispositivo.

Ediciones de campos distintos pueden combinarse si la base permite comprobarlo; conflictos sobre el mismo campo se conservan para resolución. Estados terminales frente a sesiones/ediciones requieren validación de dominio. DELETE produce tombstone que se distribuye a otros dispositivos. Una edición antigua no resucita registros eliminados.

El cambio, la auditoría y la versión se confirman conjuntamente. Lotes de interpretación se aplican atómicamente; el protocolo distingue rechazo por versión de error temporal. La UI refleja pending/syncing/synced/conflict/auth-required discretamente.

## Sesiones de trabajo

Una única actividad activa en el dispositivo. Iniciar otra cierra el intervalo anterior y pausa esa sesión en la misma transacción. Pausar cierra intervalo; continuar abre uno; detener cierra sesión sin completar actividad. Completar o cancelar cierra el intervalo activo.

Tiempo activo = suma de intervalos cerrados + intervalo abierto. No depende de setInterval ni de un service worker permanente. Usar reloj monotónico durante ejecución y marcas persistidas para reabrir; detectar duraciones negativas o saltos de reloj en vez de contabilizarlos silenciosamente.

Dos dispositivos desconectados no pueden garantizar exclusión global inmediata. Regla aprobada: conservar ambos intervalos, detectar/marcar conflicto al sincronizar y reservar resolución posterior, sin sumar tiempo duplicado como correcto.

## Próximas etapas

1. Revisar contrato y decisiones pendientes; convertir casos en evaluación del intérprete.
2. Prototipo aislado del intérprete con adaptador de proveedor y validador, sin UI completa.
3. Dominio y repositorio local; interfaz manual móvil y PWA.
4. Integrar escritura inteligente y voz.
5. Backend, autenticación y sincronización con pruebas de conflictos.
6. Sesiones, historial, estadísticas básicas y verificación web/PWA en navegadores y dispositivos reales.

## Decisiones aún abiertas

Proveedor, presupuesto y alojamiento; retención de audio/tombstones/auditoría; reglas de cerrar sesión con cambios pendientes; tratamiento de cambios de zona; UX futura de aclaraciones y herramienta de resolución de conflictos. Las reglas de conservación de lotes y de intervalos están aprobadas y no bloquean el núcleo local.
