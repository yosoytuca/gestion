# Netlify + Groq

La configuración local usa Groq: `AI_PROVIDER=groq`, `AI_MODEL=openai/gpt-oss-20b` y `AI_VOICE_MODEL=whisper-large-v3-turbo`. La clave permanece en `AI_API_KEY`, exclusivamente en el servidor.

Para probar: ejecuta `inicializacion/03-arrancar.cmd`, elige producción y abre http://localhost:3000. En el espacio personal, pulsa + → Voz, concede el permiso, habla y termina la grabación. Se transcribe y después se interpreta; revisa la propuesta antes de guardarla.

Para publicar en Netlify, utiliza `netlify.toml` del proyecto. Configura las mismas cuatro variables en las variables de entorno de Netlify, disponibles para Functions. No subas el archivo `.env`. El build es `npm run build:production`, la carpeta publicada es `dist` y las funciones están en `netlify/functions`. Publicada por HTTPS, la PWA puede acceder al micrófono sin instalarse.

La función adapta los endpoints existentes y conserva la validación del contrato y del contexto. El navegador no recibe la clave. Netlify y Groq tienen cuotas de uso; al agotarse la cuota de Groq se muestra un error y se puede reintentar posteriormente. No hay cambio automático a un proveedor de pago.

La transcripción/texto se conserva localmente aunque falle la interpretación o salgas de captura. Interpretar reintenta solo el texto, sin reenviar audio; requiere una llamada nueva a IA. No hay reintentos automáticos de Groq. Si prefieres evitar otra llamada, Preparar manualmente sin IA crea una propuesta individual editable desde el texto, con nombre limitado a 300 caracteres. No simula una interpretación ni separa tareas automáticamente.

Cada propuesta nueva permite editar nombre, categoría, tipo, grupo, fecha y hora sin IA. Pulsa Aplicar edición sin IA antes de guardar. Fecha y hora pueden quedar vacías; AMBIGUOUS_TIME e IMPRECISE_DATE sobre CREATE son observaciones opcionales. Ambigüedad sobre objetivos existentes sigue bloqueada para evitar modificar la actividad equivocada. Los campos y el contrato siguen validándose. Los borradores previos a esta actualización conservan su estado hasta editar o aclarar la propuesta.

Verificación realizada: interpretación real de una tarea ficticia para mañana y transcripción real de audio sintético, ambas exitosas con la clave local. Queda comprobar tu micrófono físico y el despliegue en tu cuenta Netlify. No se ha publicado el sitio.

Sin conexión siguen disponibles los datos locales y la creación manual. La transcripción e interpretación con Groq requieren conexión. Esta integración no incorpora cuentas, PostgreSQL ni sincronización remota completa.
