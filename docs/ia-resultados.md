# Verificación de la etapa 5

Fecha: 4 de octubre de 2026. Proveedor preparado: OpenAI / gpt-5.4-mini.

| Comprobación | Resultado |
|---|---|
| Baseline anterior | 67 pruebas aprobadas |
| npm run check final | 77 pruebas aprobadas, 0 fallos, typecheck/límites/build correctos |
| Límites/imports/ciclos | 58 archivos TypeScript de aplicación verificados |
| Build de producción / arranque 03 | Correcto, puerto 3000, build 1ebff859fbf6 |
| GET configuración IA en servidor producción | 200, configured false |
| POST interpretación sin clave | 503 NOT_CONFIGURED, mensaje humano, sin llamada al proveedor |
| /capture/write, manifest, SW | 200 en servidor de producción |
| /.env y /server-dist/interpreter-http.mjs | 404; no se publican |
| Código PWA | Sin URL api.openai.com ni header Bearer del adaptador servidor |
| Evaluación semántica real | NOT_RUN_NO_KEY, 0 casos ejecutados/aprobados; 28 preparados |

Las pruebas del adaptador usan transporte/AIProvider simulado, nunca se atribuyen al modelo. La integración HTTP local atraviesa proveedor cliente, CaptureService, workflow y IndexedDB; preparar no crea registros y reintentar aplicar no duplica. La prueba de pantalla Escribir crea dos tareas, mueve una y la completa; comprueba fecha, estado, versión y 4 operaciones en outbox. Luego simula endpoint apagado y crea manualmente. El mock y todos los tests previos siguen pasando.

Errores detectados durante implementación: la composición asumía localStorage disponible en pruebas de inicialización sin navegador; se hizo opcional. El nuevo recorrido de captura exponía la vista del borrador antes de refrescar snapshot; ahora navega después del refresco. El generador del schema se corrigió para tratar los mapas de propiedades como mapas y conservar campos llamados title. El diario local tolera JSON corrupto y falta de cuota sin bloquear operaciones.

En el arranque de comprobación se encontró un proceso anterior de este mismo proyecto en 3000; se identificó por la ruta del ejecutable y se reinició, sin cambiar de puerto ni tocar datos locales.

No se declara terminada la validación funcional del modelo: falta configurar `.env`, ejecutar `npm run evaluate:ai`, revisar discrepancias y probar frases con IA real. No existen ejemplos reales observados ni coste medido todavía. Configuración, archivos, privacidad, coste estimado y limitaciones: [guía](interprete-ia.md).

Evidencia: [check](ia-check.txt), [baseline](ia-baseline.txt), [evaluación real](ia-evaluacion-real.json). El log ia-tests.txt corresponde al control intermedio de 75 pruebas; ia-check.txt es la verificación final de 77.
