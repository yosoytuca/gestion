# Usar el micrófono real

Configuración posterior: también admite Gemini; el servidor actual lo utiliza. Ver [estado de acceso y configuración](gemini.md). Las referencias a OpenAI más abajo describen la implementación inicial.

Se amplió el alcance a petición del usuario: el espacio personal ya usa grabación real del navegador y STT; la demostración conserva el mock.

1. Copiar `.env.example` a `.env` y colocar `AI_API_KEY` únicamente allí, en el servidor. Esa misma clave permite transcribir e interpretar. Modelo de voz predeterminado: `AI_VOICE_MODEL=gpt-4o-mini-transcribe`.
2. Arrancar con `inicializacion/03-arrancar.cmd`, en puerto 3000. Para teléfono usar el enlace **HTTPS** del túnel; para escritorio sirve localhost. El navegador necesita un contexto seguro para pedir micrófono.
3. En el espacio personal: **+ → Hablar → tocar micrófono → permitir acceso → hablar → tocar para terminar**.
4. La app muestra «Transcribiendo audio…», obtiene texto y llama automáticamente al intérprete. Si falla la interpretación, el texto queda disponible para corregir/reintentar.
5. Revisar la propuesta y pulsar **Guardar claras**. Las ambigüedades mantienen el mecanismo existente. No se necesita pulsar Interpretar después de cada grabación correcta.

Se graba hasta terminar o 120 segundos. La transcripción es posterior a la grabación, no subtítulos en directo mientras se habla. Al terminar/cancelar/salir se liberan las pistas del micrófono. El audio permanece temporalmente en memoria; no se guarda como archivo ni en IndexedDB. Se admite WebM, MP4 u Ogg según navegador. El límite es 10 MiB.

Flujo: getUserMedia → MediaRecorder → VoiceRecorder → HTTP VoiceProvider → POST /api/v1/voice/transcribe → OpenAI STT → texto/contexto → intérprete existente → preview → servicios locales. La captura conserva inputId, timestamp y zona durante transcripción e interpretación. No se utiliza Android, permisos nativos ni wrapper.

El audio sale del dispositivo hacia el servidor y el proveedor. La clave permanece en backend, sin incluirse en PWA. El endpoint verifica origen, tipo/tamaño, contexto temporal y limita llamadas. Las condiciones de acceso del intérprete siguen aplicando; el endpoint local no añade autenticación pública. Configurar clave y conexión es necesario para STT e interpretación; las operaciones manuales siguen offline.

Implementación: `frontend/src/infrastructure/providers/browser-voice.ts`, `backend/src/voice-http.ts`; conexión en composition, UiController, UiPort y CaptureScreen. Protocolo OpenAI según [documentación oficial](https://developers.openai.com/api/docs/guides/speech-to-text).

Verificación: **81 pruebas aprobadas**, tipos/imports/build correctos. Nuevas pruebas: permisos, pistas liberadas, audio/contexto, subida HTTP y STT mediante transporte simulado, formato/origen inválidos, clave ausente, respuesta inválida y secuencia de pantalla micrófono → texto → interpretación automática. Evidencia: `docs/voz-check.txt`. No se probó voz física ni se consumió API real porque aún falta la clave; no se afirma lo contrario.

La guía `interprete-ia.md` describe la etapa anterior; sus referencias a voz simulada quedan sustituidas por este recorrido en el espacio personal. El modo demo permanece simulado.
