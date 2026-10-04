# Migración local

IndexedDB versión 2. indexeddb.ts crea stores ausentes en onupgradeneeded sin borrar existentes. V2 incorpora syncConflicts; V1 no lo tenía. Conexiones se cierran ante versionchange y una actualización bloqueada solicita cerrar pestañas.

Entidades compatibles sin transformación en esta etapa. Migraciones futuras deben probar datos previos, sin borrar bases para actualizar.
