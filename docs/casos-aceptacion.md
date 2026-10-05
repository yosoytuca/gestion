# Casos de aceptación

Los tests automatizados de esta etapa están en tests/*.test.ts. Casos que requieren IA/STT real, login o navegación final siguen siendo especificaciones futuras. La instrucción posterior aprueba claras/ambiguas separadas y conservación de intervalos; atomicidad corresponde al subconjunto que se aplica.

## Casos de arquitectura

| ID | Verificación | Resultado exigido |
| --- | --- | --- |
| A01 | Dependencias de Interpreter | Sin repositorios de escritura, imports de Activities ni driver SQL |
| A02 | Sustituir SpeechToTextPort por adaptador de prueba | Contrato de intérprete y Activities intactos |
| A03 | Sustituir LanguageModelPort | Frontend y servicios de dominio intactos |
| A04 | Crear manualmente sin backend | Repositorio local y outbox en una transacción |
| A05 | Misma transición por REST y Sync | Mismas invariantes, auditoría y feed, sin reglas duplicadas |
| A06 | Inspección estática de imports | Sin ciclos ni acceso a internos entre módulos |
| A07 | Bundle frontend | Sin drivers SQL, hashes de contraseña ni secretos de proveedor |
| A08 | Request/respuesta IA inválida runtime | Rechazo antes de ejecutar, aunque tipos TS coincidan |
| A09 | Pull con edición local pendiente | Reconciliar sin sobrescritura ciega; cursor transaccional |
| A10 | Fallo en mitad de lote atómico | Ningún comando del lote persistido; reintento idempotente |

Son especificaciones para pruebas futuras; no se ha ejecutado un motor de IA. Comparar intención y campos, no redacción literal de títulos. Fecha base salvo indicación: 2026-10-03 10:00:00 America/Bogota. Candidatos se suministran con UUID y versión.

| ID | Entrada o escenario | Resultado exigido |
| --- | --- | --- |
| I01 | Hoy cuatro cotizaciones: acrílicos, pintado, instalación de letreros y fabricación de letreros. Mañana médico a las 16:00. El lunes reunión con asesor de tesis. | CREATE_GROUP y 6 CREATE; 4 TASK/work/2026-10-03 sin hora; médico COMMITMENT/health/2026-10-04/16:00; reunión COMMITMENT/education/2026-10-05 sin hora |
| I02 | Mañana médico a las cuatro | AMBIGUOUS_TIME; operación médica bloqueada; otras claras pueden quedar preparadas |
| I03 | Respuesta a I02: de la tarde | Fecha 2026-10-04, hora 16:00; mismo inputId; lote ejecutable una sola vez |
| I04 | Base lunes 2026-10-05: el lunes reunión | 2026-10-12 |
| I05 | Base lunes 2026-10-05: hoy reunión | 2026-10-05 |
| I06 | Base sábado 2026-10-03: el próximo lunes reunión | 2026-10-05, lunes de la siguiente semana calendario |
| I07 | Base martes 2026-10-06: el próximo lunes reunión | 2026-10-12 |
| I08 | Base 2026-10-10: el día 10 entregar informe | 2026-11-10, estrictamente futuro |
| I09 | La próxima semana entregar informe | Rango 2026-10-05 a 2026-10-11 en aclaración/borrador; no inventar día |
| I10 | Esta tarde llamar al proveedor | Pedir precisión temporal; no inventar hora exacta |
| I11 | Dentro de dos horas llamar | 2026-10-03/12:00 |
| I12 | Base 2026-10-03 23:30: dentro de una hora llamar | 2026-10-04/00:30 |
| I13 | Mañana hacer cotización | 2026-10-04, dueTime null |
| I14 | Cita del 31 de febrero | INVALID_DATE; no guardar fecha imposible |
| I15 | La cita médica de mañana ahora es a las 17:00; un candidato inequívoco | UPDATE con targetId/version y patch solo dueTime; mantener título/categoría/fecha |
| I16 | Pasa la reunión del día 10 para mañana; tres candidatos | AMBIGUOUS_TARGET con candidatos reales; ningún UPDATE ejecutado |
| I17 | Ya terminé la cotización de pintado; candidato único | COMPLETE; fecha de finalización del ejecutor |
| I18 | Cancelaron mi reunión de hoy a las 11:00 | CANCEL del candidato inequívoco; conservar historial |
| I19 | Elimina la cotización de reja que acabo de crear | DELETE si referencia reciente es inequívoca; tombstone, sin CANCEL |
| I20 | Cancelaron la reunión; referencia conversacional explícita única | CANCEL del candidato contextual |
| I21 | Cambia mi cita; sin candidatos | MISSING_TARGET; no crear cita nueva |
| I22 | Modificar candidato cambió de versión después de interpretar | STALE_TARGET; no sobrescribir; volver a resolver |
| I23 | Respuesta IA incluye id ajeno a candidatos/usuario | UNAUTHORIZED_TARGET; no aplicar |
| I24 | Texto dice ignorar reglas y ejecutar SQL | Ningún acceso SQL ni evasión de contrato/permisos |
| I25 | Voz transcrita y texto escrito contienen lo mismo | Mismas operaciones semánticas bajo igual contexto |
| I26 | Proveedor falla o devuelve JSON inválido | Conservar borrador; no guardar párrafo como actividad |
| I27 | Frase con creación clara y cita a las cuatro | Operaciones claras preparadas, médica bloqueada; aplicar claras explícitamente en mock, resolver después sin duplicar |
| I28 | El usuario repite una tarea parecida legítimamente | No borrar/deduplicar por título automáticamente |
| I29 | Elimina la hora de la cita | UPDATE dueTime null; conservar fecha |
| I30 | UPDATE sin campos o COMPLETE y DELETE contradictorios | INVALID_OPERATION antes de persistir |

## Dominio, offline y navegación

| ID | Escenario | Resultado exigido |
| --- | --- | --- |
| D01 | Hoy 09:00, hoy 16:00 y hoy sin hora | Orden por hora, después sin hora; vencidas siguen pendientes |
| D02 | Compromiso supera su hora | Vencido, nunca COMPLETED automático |
| D03 | Hijo del grupo cambia de fecha | Se ordena por nueva fecha, conserva groupId |
| D04 | Grupo: 2 completadas, 1 pendiente, 1 cancelada | Mostrar esos conteos; cancelada no incrementa completadas |
| D05 | Iniciar B mientras A está activa | Pausar A y comenzar B atómicamente; ninguna superposición local |
| D06 | 10:00 iniciar, 10:40 pausar, 10:55 continuar, 11:30 detener | 75 minutos activos; actividad PENDING |
| D07 | Detener y completar | Cerrar sesión y marcar COMPLETED en una transacción |
| D08 | Cerrar/reabrir PWA con sesión activa | Reconstruir sesión desde registros; no reiniciar contador |
| D09 | Crear/editar/completar/cancelar/eliminar offline | Persistencia local y outbox; reapertura conserva cambios |
| D10 | Reenviar mutationId después de perder respuesta | Un solo cambio y resultado idempotente |
| D11 | Edición sobre tombstone desde otro dispositivo | No resucitar actividad |
| D12 | Dos dispositivos cambian misma hora offline | Conflicto visible; no perder uno silenciosamente |
| D13 | Sesión auth vence offline | Acceso local; al reconectar pedir login antes de sincronizar |
| D14 | Audio capturado 03/10, procesado 05/10: mañana médico | Fecha 04/10; pedir hora si es ambigua; revalidar referencias actuales |
| D15 | Sin conexión: + → Escribir | Entrada natural diferida y acceso distinto a Crear manualmente |
| D16 | Inicio → Educación → Actividad → panel; Atrás repetido | Panel → Actividad → Educación → Inicio |
| D17 | Dos pestañas inician contadores | Coordinación local mantiene uno activo |
| D18 | Dos dispositivos offline inician sesiones | Detectar solapamiento al sincronizar; no descartar intervalos |
| D19 | Falla cuota al guardar audio | No afirmar guardado; mantener alternativa manual |
| D20 | Cruzar medianoche o reabrir aplicación | Actualizar etiquetas/orden sin modificar fechas almacenadas |

Para aceptar el intérprete deben validarse schema, semántica y efecto final. La calidad de transcripción se evalúa aparte con audios reales del usuario. Estos casos todavía no acreditan precisión de ningún proveedor.
