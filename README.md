Configuración actual: Groq para voz e interpretación. Ver [publicación en Netlify](docs/netlify-groq.md).

# Gestor de actividades — interfaz móvil local

Configuración actual: Gemini para voz e interpretación. La clave se reconoce, pero Google deniega generación al proyecto (403). Ver [estado y configuración Gemini](docs/gemini.md).

PWA web offline-first sobre el núcleo modular aprobado: IndexedDB, actividades, grupos, sesiones, historial, auditoría y outbox. UI en Preact y TypeScript. Hablar graba audio real, transcribe e interpreta automáticamente; Escribir usa el mismo intérprete. El modo demo conserva el mock. Ver [uso del micrófono](docs/voz-real.md) y [configuración de IA](docs/interprete-ia.md). Los servicios reales necesitan AI_API_KEY en `.env`; aún falta esa configuración para comprobarlos con el proveedor.

## Ejecutar

En Windows, abrir la carpeta **inicializacion**: primero `01-instalar-dependencias.cmd`, después `03-arrancar.cmd`. El segundo muestra opciones de desarrollo para túnel VS Code o producción local, ambas en puerto **3000**. Ver [guía de ejecutables](inicializacion/LEEME.md).

Node 22 o superior (verificado con 24.20.0):

```sh
npm ci
npm run check
npm run dev
```

Abrir http://localhost:3000. En Menú → Configuración → Abrir demostración se carga un espacio separado y restablecible. Los datos personales empiezan vacíos. Crear/editar funcionan sin servidor después de preparar la caché en una primera visita.

DEV_HOST/DEV_PORT se leen del entorno; ver .env.example. Reiniciar dev para recompilar; sin hot reload. La aplicación se usa directamente en un navegador web moderno; instalarla es opcional cuando el navegador lo permita. Para probar desde otros dispositivos se necesita HTTPS accesible; este servidor local no publica la aplicación.

## Verificación y documentación

- [Revisión de las 20 buenas prácticas y prioridades](docs/buenas-practicas.md)
- [Instalación, arranque, respaldo y preparación de producción](docs/operacion-web.md)

`npm run check`: tipos, límites/imports/ciclos, pruebas y build. Permanecen las 45 pruebas del núcleo; UI, arranque, respaldo y PWA amplían la cobertura. La interfaz consume servicios locales, sin escribir IndexedDB desde componentes. `npm run build:production` genera dist/ minificado sin source maps.

- [Interfaz móvil, dependencias y verificación actual](docs/interfaz-movil.md)
- [Árbol real](docs/arbol-real.txt)
- [Archivos de esta etapa](docs/archivos-interfaz.txt)
- [Arquitectura](docs/arquitectura.md)
- [Modelo](docs/modelo-datos.md)
- [Contrato del intérprete](docs/contrato-interprete.md)
- [Schema v1.1](datos/contracts/interpreter/interpreter-response.schema.json)
- [Casos de aceptación](docs/casos-aceptacion.md)
- [Informe histórico del núcleo](docs/implementacion-local.md)
- [Verificación](docs/resultados-verificacion.md)

Interpretar prepara propuestas; guardar aplica solo operaciones validadas. Los escenarios de demostración no interpretan libremente el texto. Estadísticas y cierre de sesión están preparados visualmente. Las siguientes etapas conectarán auth/sync y voz real. La IA requiere conexión; las operaciones manuales conservan su funcionamiento offline.
