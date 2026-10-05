# Gemini configurado

Configuración local del servidor: AI_PROVIDER=gemini, AI_MODEL=gemini-3.8-flash, AI_VOICE_MODEL=gemini-3.8-flash. AI_API_KEY está únicamente en `.env`, ignorado por el repositorio y excluido de dist/. No aparece en frontend, informes ni logs.

Gemini usa el mismo puerto del intérprete y la validación canónica. El adaptador envía JSON Schema con el formato REST actual APPLICATION_JSON y adapta el patch de vuelta al contrato existente. Voz usa audio inline temporal y devuelve transcripción antes de llamar al intérprete. OpenAI y mock siguen disponibles.

Verificación real 4 octubre 2026:

- Listado de modelos: HTTP 200, clave reconocida.
- gemini-2.5-flash: HTTP 404; Google indica que ya no está disponible para nuevos usuarios y recomienda gemini-3.8-flash. Configuración actualizada.
- Una tarea ficticia sin información personal con gemini-3.8-flash: HTTP 403 PERMISSION_DENIED. Mensaje del proveedor: acceso al proyecto denegado; contactar soporte.
- No hay interpretación real aprobada ni transcripción real comprobada. El listado exitoso no demuestra autorización de generación.
- Una prueba con una referencia médica fue rechazada por revisión automática antes de enviarse; se usó una tarea ficticia sin datos personales como alternativa. No se ejecutó la suite amplia para evitar consumir llamadas mientras el proyecto está bloqueado.

Acción necesaria: revisar acceso del proyecto en Google AI Studio / soporte, o configurar en `.env` una clave de otro proyecto con generación habilitada, y reiniciar el servidor. No asumir que el problema se resuelve activando facturación: el proveedor no especificó la causa del bloqueo.

Fuentes oficiales: [formato REST](https://ai.google.dev/api/generate-content), [audio](https://ai.google.dev/gemini-api/docs/audio), [Structured Outputs](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).
