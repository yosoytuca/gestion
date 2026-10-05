# Contrato del intérprete v1.1

## Límite del módulo

Interpreter es independiente de Voice, Activities y drivers de base de datos. Recibe DTO validados y un puerto LanguageModel; devuelve propuesta. El workflow de application reúne contexto/candidatos autorizados y, posteriormente, llama a servicios públicos de dominio para ejecutar. Sustituir el adaptador IA no modifica la API pública ni frontend.

Voice recibe audio y produce TranscriptionResult (inputId, text, language y captureContext) mediante SpeechToTextPort. No llama a Activities ni interpreta fechas. Capture/application conecta transcripción y texto escrito con exactamente el mismo contrato del intérprete; Crear manualmente omite ambos proveedores.

POST /api/v1/interpreter/interpret no escribe actividades. Los ids de candidatos enviados por cliente se autorizan antes de interpretar; las versiones se vuelven a comprobar al ejecutar y sincronizar. La salida de IA, DTO HTTP y datos de proveedores se validan runtime, aunque existan tipos TypeScript.

CLARIFICATION_REQUIRED describe un resultado, no una operación de dominio. Para compatibilidad con el JSON Schema actual, clarifications no vacío representa ese resultado; no se agrega una acción nueva al enum. NEEDS_CLARIFICATION es el estado del borrador consumidor. CREATE_GROUP sigue siendo operación interna de relación.

Schema canónico: ../datos/contracts/interpreter/interpreter-response.schema.json respecto de la raíz docs. Única copia editable en datos/contracts/interpreter; versión 1.1 usa categorías en mayúsculas. La documentación histórica v1 no es el contrato de runtime.

## Política propuesta del consumidor

Regla aprobada: representar operaciones claras y ambiguas por separado conservando la entrada común. prepare valida y conserva el lote sin ejecutar; applyPrepared aplica solo preparedOpIds, nunca blockedOpIds, en una transacción con outbox. Los opId aplicados se mantienen inmutables al revisar el lote; la resolución agrega o completa operaciones pendientes sin recrear las aplicadas. Cada aplicación usa batchId nuevo; inputId conserva la relación total. La UX de IA propuesta está en implementacion-local.md y debe revisarse antes de conectar proveedor real.

El archivo datos/contracts/interpreter/interpreter-response.schema.json describe la respuesta vigente. Es JSON Schema estándar; el adaptador de un proveedor puede necesitar adaptar su subconjunto admitido sin debilitar la validación de dominio.

## Entrada

El puerto vigente recibe inputId UUID, text, capturedAt UTC, localDate YYYY-MM-DD, localTime HH:mm:ss, timeZone IANA y candidates con id/version. En la etapa 5 el DTO HTTP envuelve esa entrada en input y agrega candidateDetails, recentIds y clarification opcional, sin modificar InterpreterInput. Los detalles incluyen id, version, title, category, type, dueDate, dueTime, status, reservedDurationMinutes y groupId. El idioma es español en las instrucciones; no se agregan locale o contextActivityId al puerto. Nunca enviar contraseñas, cookies ni claves. candidates proviene de búsqueda local del espacio del usuario; existencia, propiedad y versión se comprueban nuevamente al ejecutar.

Una aclaración se reinterpreta junto al texto original y las respuestas anteriores bajo el mismo inputId y contexto temporal, no como una nueva orden aislada.

## Respuesta

schemaVersion, inputId, operations, clarifications. Identificadores opId/grupo temporal solo relacionan elementos dentro de la propuesta; UUID de entidades y mutationId los asigna el ejecutor.

- CREATE_GROUP crea relación lógica mediante tempId y title.
- CREATE crea una actividad con campos completos y groupRef opcional a tempId. Es operación interna complementaria al conjunto de cinco intenciones de usuario.
- UPDATE lleva targetId, expectedVersion y patch con solo campos solicitados. null borra fecha/hora/grupo cuando se solicita explícitamente; ausencia conserva el valor.
- COMPLETE/CANCEL/DELETE llevan targetId y expectedVersion.
- evidence conserva un fragmento del texto que fundamenta cada operación.
- clarifications describe una pregunta concreta, operaciones afectadas, candidatos u opciones y expresión original. Un rango temporal contiene inicio/fin inclusivos sin inventar fecha puntual.

clarifications no vacío mantiene asuntos pendientes. affectedOpIds bloquea esas operaciones y sus dependientes (hijos de grupo bloqueado); una aclaración sin opId representa un asunto todavía no convertido en operación. Las demás operaciones quedan preparadas y requieren applyPrepared en el demostrador mock. STALE_TARGET o validación fallida revierte el subconjunto completo; nunca aplicar una modificación ambigua. Errores del proveedor no crean tareas de fallback con el párrafo completo.

## Validaciones posteriores al schema

Fechas reales (rechazar 2026-02-30), zona válida, coherencia hora/fecha, duración positiva, id de candidato autorizado, versión actual, referencias temporales de grupo válidas, opId únicos, patch no vacío, coherencia del estado y sesión, ausencia de operaciones contradictorias sobre el mismo registro. Limitar tamaño de entrada y cantidad de operaciones.

No usar coincidencia textual como idempotencia. No inventar entidades para resolver referencias ausentes. Instrucciones dentro del texto se tratan como contenido de usuario del gestor y no pueden saltarse el contrato, permisos o validaciones.
