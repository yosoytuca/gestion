# Etapa 5 — intérprete con IA

Implementación conectada con pruebas sin consumo de API. **La evaluación semántica del modelo real está pendiente de una API key**. No se presenta ninguna respuesta simulada como resultado real de IA.

## Configuración

Copiar `.env.example` a `.env` en la raíz y configurar únicamente en el servidor:

```dotenv
AI_PROVIDER=openai
AI_MODEL=gpt-5.4-mini
AI_API_KEY=tu_clave_local
AI_DEBUG=false
```

No pegar la clave en el chat. `.env` está ignorado y no se copia al build del navegador. Abrir `inicializacion/03-arrancar.cmd`, elegir túnel o producción local: ambos cargan `.env` y usan puerto 3000. Reiniciar tras cambiar configuración. `npm run dev` también carga `.env`. No se necesitan credenciales de usuario para probar los datos locales; la clave corresponde al proveedor de IA.

Espacio personal: **+ → Escribir → Interpretar → revisar → Guardar claras**. En Configuración → Abrir demostración se conserva el mock explícito, sin consumo de API. Hablar conserva transcripción simulada y pasa ese texto al intérprete correspondiente; todavía no usa micrófono/STT real.

Sin clave, sin conexión o con endpoint apagado se muestra un error humano y se conserva el texto en pantalla. Crear manualmente, editar, completar, cancelar, eliminar, timer e historial conservan servicios locales y offline. La instalación PWA sigue siendo opcional.

## Arquitectura

```text
Texto / VoiceProvider
 → recuperación local de candidatos
 → CaptureService → RealInterpreterProvider HTTP
 → POST /api/v1/interpreter/interpret
 → validación de entrada → RealInterpreterProvider backend
 → AIProvider → OpenAI Responses / Structured Outputs
 → schema canónico + validación de dominio/candidatos
 → validación cliente → InterpreterWorkflow.prepare → preview
 → Guardar claras → applyPrepared → servicios existentes → IndexedDB + outbox
```

Puerto `interpret(InterpreterInput): Promise<unknown>`, schema v1.1, núcleo y estructura IndexedDB permanecen iguales. El enriquecimiento HTTP es un DTO separado. No se añaden PostgreSQL, sync remoto ni STT. El backend no importa repositories ni modifica actividades; el workflow no depende del proveedor empresarial. Se usa fetch nativo, sin nuevas dependencias.

Structured Outputs exige propiedades obligatorias: el schema se deriva de la copia canónica y solamente el PATCH enviado al proveedor se representa como lista tipada `{field,value}`. El adaptador lo convierte al objeto parcial original **antes** de validar v1.1. Ausencia conserva valores, null los borra explícitamente. Se rechazan cambios repetidos, schema inválido, fechas imposibles, duración incompatible, ID ajeno al conjunto y versión incorrecta. La aplicación comprueba además existencia, usuario y versión en IndexedDB antes de ejecutar.

Las instrucciones separan cotizaciones y acciones independientes semánticamente, conservan compras como una sola tarea, infieren categorías/tipos y mantienen las reglas temporales aprobadas. Su corrección real se comprobará con evaluación, no solamente con JSON válido. Captura usa timestamp, fecha/hora local y timezone del dispositivo; no el reloj del modelo.

Aclaraciones usan texto/contexto originales y mismo inputId. Los opIds aplicados son inmutables: no se permite modificarlos u omitirlos. Horas usan opciones locales validadas; otras dudas admiten respuesta escrita y otra propuesta, conservando operaciones ya guardadas. Los campos modificados y el nombre de la actividad aparecen en el preview sin rehacer el diseño.

## Privacidad y contexto

La recuperación ocurre en el dispositivo: palabras/títulos normalizados, raíces cortas, fechas, categoría, estado y referencias recientes. Transmite hasta **8** candidatos y puede fallar ante sinónimos difíciles; la ausencia o múltiples coincidencias debe provocar aclaración. La relevancia heurística no demuestra identidad.

Salen del dispositivo: texto, inputId, timestamp, fecha/hora, timezone, id/version y detalles de candidatos (título, categoría, tipo, fecha/hora, estado, duración reservada, groupId). También hasta 8 IDs de la última aplicación para pronombres y, al aclarar, propuesta anterior, opIds aplicados y respuesta. No se envían toda la base, historial completo, sesiones, timers, outbox, cookies, contraseñas ni claves. Texto y títulos pueden contener información personal o médica que recibirá el proveedor.

Un diario independiente en localStorage, separado por espacio personal/demo, conserva **20** entradas para continuar aclaraciones después de refrescar. No cambia IndexedDB, no es cola de sincronización y no se incluye en respaldo. Borradores antiguos pueden necesitar revisión manual si su captura ya fue descartada. Borrar almacenamiento elimina ese contexto. Las referencias recientes son de la última aplicación, no todo el historial.

Responses usa `store:false`; esto no equivale a ausencia de toda retención del proveedor. Consultar su política de datos antes de enviar información sensible. La clave está solo en el proceso servidor y en Authorization hacia la URL fija de OpenAI.

El endpoint limita cuerpo a 128 KiB, texto a 20.000 caracteres, candidatos a 8, 20 peticiones/minuto por dirección y 2 llamadas simultáneas. Sin CORS abierto; se comprueba Origin cuando existe. `AI_ALLOWED_ORIGIN` permite una URL exacta si el proxy modifica Host. **Estas medidas no son autenticación**: antes de publicar un endpoint de pago abierto se requiere acceso autenticado y cuotas por usuario. El arranque actual sigue siendo producción local o túnel controlado.

## Observabilidad y errores

`AI_DEBUG=true`: backend muestra entrada/contexto/candidatos/propuesta y validación OK; navegador muestra preparación y opIds aplicados. Los errores registran códigos, nunca cuerpos brutos del proveedor, clave o stacktraces. Los diagnósticos contienen texto personal; desactivar después de revisar. La bandera pública se consulta sin bloquear el arranque local. Service Worker no almacena API.

Errores: configuración ausente, conexión, timeout (30 s proveedor / 45 s cliente), rate limit, rechazo/truncamiento, JSON/schema inválido e incoherencia de dominio. Un error no genera tareas de fallback ni aplica propuestas automáticamente.

## Pruebas y evaluación

Pruebas ordinarias usan transporte/AIProvider simulado y no consumen API: Structured Outputs, PATCH mínimo, allowlist, candidatos/versiones, ID desconocido, dominio, errores, HTTP local real, prepare sin efectos, aplicación/idempotencia en IndexedDB, pantalla Escribir (crear, mover, completar), endpoint apagado y creación manual. Archivos: `tests/real-interpreter.test.ts` y el nuevo recorrido en `tests/mobile-ui.test.tsx`.

```sh
npm run check
npm run build:production
npm run evaluate:ai
```

La suite real requiere build previo y clave, consume API deliberadamente y está fuera de npm test. Sus **28 frases** comprueban cantidad, categoría, tipo, fecha/hora, agrupación/hijas, acción/ID, patch exacto, motivos/opciones de aclaración y rangos. Guarda propuestas y discrepancias en `docs/ia-evaluacion-real.json`. Sin clave registra `NOT_RUN_NO_KEY`: cero casos reales aprobados. Revisar fallos semánticos antes de considerar terminada la etapa.

Ejemplos **esperados, no salidas reales observadas**, con captura 4 oct 2026, 07:30 America/Bogota:

| Texto | Propuesta esperada |
|---|---|
| Hoy cotizar pintura, acrílicos y fabricación de letreros | 3 CREATE WORK/TASK, 2026-10-04 |
| Mañana médico a las cuatro | CREATE HEALTH/COMMITMENT 2026-10-05, hora null + AMBIGUOUS_TIME 04:00/16:00 |
| Comprar arroz, pollo y verduras | 1 CREATE PERSONAL/TASK |
| Dentro de dos horas llamar al ingeniero | CREATE WORK/TASK 2026-10-04 09:30 |
| Ya terminé la cotización de pintura | COMPLETE sobre candidato único |
| Cambia reunión de tesis del día 10, con dos candidatos plausibles | AMBIGUOUS_TARGET sin seleccionar arbitrariamente |

## Modelo y coste

Inicial: **OpenAI gpt-5.4-mini**, configurable mediante AI_MODEL. [Modelo y precios](https://developers.openai.com/api/docs/models/gpt-5.4-mini); [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Responses, strict JSON Schema, reasoning low y máximo 6.000 tokens de salida. Otro modelo necesita admitir esas capacidades; cambiar la variable no garantiza compatibilidad.

La página consultada indica USD 0,75/millón de entrada y USD 4,50/millón de salida. Ejemplo: 4.000 tokens de entrada + 1.500 de salida → **USD 0,00975** por interpretación. Schema/instrucciones/candidatos y razonamiento consumen tokens; aclarar requiere otra llamada. Es estimación, no medición real; precios pueden cambiar. Las pruebas sin clave no realizan llamadas de pago.

## Archivos creados/modificados

- `datos/contracts/interpreter/transport.ts`: DTO HTTP sin cambio del puerto.
- `backend/src/modules/interpreter/{public,real,prompt,structured-output}.ts`: adaptador, seguridad, instrucciones y schema.
- `backend/src/interpreter-http.ts`: endpoint mínimo.
- `frontend/src/infrastructure/providers/{real-interpreter,capture-context-store}.ts`: HTTP y diario.
- `frontend/src/app/application/{interpreter-context,ui-controller}.ts`: candidatos, referencias y aclaraciones.
- `frontend/src/app/initialization/services.ts`, `frontend/src/shared/ui-contract.ts`, `frontend/src/modules/capture/ui.tsx`, `frontend/src/app/app.tsx`: conexión con interfaz existente.
- `scripts/{build,dev,web-server}.mjs`, `inicializacion/03-arrancar.mjs`: servidor privado en server-dist, puerto 3000.
- `scripts/{evaluate-ai,ai-evaluation-cases}.mjs`, pruebas anteriores: evaluación separada y verificación.
- `.env.example`, `.gitignore`, `package.json`, README y esta guía: configuración/documentación.

VoiceProvider queda listo para sustitución por STT: una transcripción conserva el contexto temporal original y alimenta CaptureService sin cambiar intérprete ni dominio.
