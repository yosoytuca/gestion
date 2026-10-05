# Verificación del núcleo local

Actualización tras aplicar buenas prácticas: **67/67** pruebas, tipos, límites/imports y builds correctos. Ver [mejoras aplicadas](practicas-aplicadas.md) y [salida actual](practicas-check.txt). Los informes de etapas anteriores se conservan a continuación.

Este informe conserva la etapa 3. La verificación actual de etapa 4 es **56/56 pruebas**, tipos, límites e imports y build correctos; ver [interfaz-movil.md](interfaz-movil.md) y [salida completa](mobile-check-output.txt). La entrada actual es la UI móvil Preact.

Fecha: 3 de octubre de 2026, America/Bogota. Entorno Node 24.20.0 / npm 11.19.0 en Windows.

## Comandos

npm run check ejecuta typecheck, lint de límites, tests y build. Resultado: 45 tests, 45 aprobados, 0 fallidos, 0 omitidos. TypeScript y límites sin errores; build dist/ completado. Salida íntegra en check-output.txt.

| Archivo de tests | Cantidad | Cobertura |
| --- | --- | --- |
| calendar.test.ts | 4 | Lunes futuro, próxima semana, día de mes, cambios de día/año y validación |
| local-core.test.ts | 16 | CRUD, estados, orden, grupos, historia, intervalos, reapertura, dos conexiones y rollback |
| interpreter.test.ts | 10 | Schema, aplicación, ambigüedad, dependencia grupo, reintentos, versiones y mocks |
| sync.test.ts | 6 | Push/pull, idempotencia, tombstones, versiones, intervalos, errores y aislamiento |
| edge-cases.test.ts | 5 | Periodo local, semántica, revisión ya aplicada, sesión remota y no resurrección |
| reliability.test.ts | 4 | Fallo de outbox, migración v1/v2, atomicidad remota simulada y contexto capture |

Las pruebas usan fake-indexeddb para el adaptador IndexedDB real; MockSyncTransport es memoria, no HTTP/PostgreSQL. Casos de IA real, autenticación, micrófono y validación PWA en dispositivos físicos no se declaran probados.

## Navegador

Demostrador en http://127.0.0.1:5173, navegador interno Codex:

- Crear tarea: aparece PENDING y outbox crece.
- Iniciar: IN_PROGRESS; pausar: PENDING; continuar: IN_PROGRESS; detener: PENDING, conserva tiempo.
- Completar: aparece en historial, conserva tiempo; recargar conserva actividad y outbox.
- Apagar servidor dev y recargar: shell abre desde caché; crear «Creada sin servidor» guarda en IndexedDB sin backend.
- Reiniciar con IndexedDB v2: registros anteriores conservados; sin errores/warnings en consola consultada.
- Pegar interpreter-mixed.json, preparar: nada creado; aplicar claras: solo cotización, médico permanece bloqueado en lote PARTIAL.

Captura: evidencia-local.png. Estos datos son exclusivamente ejemplos de prueba; permanecen en el demostrador para inspección.

## Advertencias y pendientes

Sin errores pendientes en typecheck/tests/lint/build. npm mostró advertencia de scripts de instalación esbuild sin aprobación; el ejecutable funciona y las comprobaciones pasan. No habilitar scripts adicionales ni declarar audit de vulnerabilidades ejecutado.

Lint es control arquitectónico de imports, no un linter general de estilo. El servidor de desarrollo no tiene hot reload; reiniciar recompila. No se ha probado instalación opcional de la PWA en navegadores compatibles, cuota real ni cierre del proceso del navegador; reapertura de conexión se verifica automáticamente y recarga del navegador manualmente.

La resolución de conflictos, el backend HTTP/autenticación y proveedores reales están fuera de esta etapa; consultar implementacion-local.md.
