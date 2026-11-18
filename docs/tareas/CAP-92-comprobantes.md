# CAP-92 · Comprobantes privados, revisión de diseño e integración de la HU-16

**Documentación de la tarea** · Rol: DevOps (George) · Historia: HU-16 Pago real con verificación manual (CAP-83) · Sprint 2

El CI de esta tarea (`.github/workflows/ci.yml`) ya entró a `main` con el PR #5. Esta rama trae el resto: el bucket privado de comprobantes, la Edge Function que firma enlaces, el ajuste del módulo de almacenamiento y la revisión de diseño. El detalle completo de la revisión está en `docs/devops/CAP-92-HU-16.md`.

## 1. Qué se hizo

| Pieza | Archivo | Qué hace |
|---|---|---|
| Bucket privado | `supabase/migrations/20261122000002_bucket_comprobantes.sql` | Bucket «comprobantes» con `public = false`, 3 MB, JPG/PNG/WEBP. Solo se puede subir un archivo nuevo a la carpeta `<id de inscripción>/`. No hay políticas de lectura, cambio ni borrado. |
| Regla de acceso | La misma migración: `public.ruta_comprobante_autorizada` | Solo la persona que pagó y la administración pueden ver la captura. También corre en PGlite (modo local y pruebas). |
| Edge Function | `supabase/functions/url-comprobante/index.ts` | Recibe el token de sesión y la ruta, consulta la regla y, si la autoriza, firma un enlace de 60 segundos con la clave de servicio (solo existe en el servidor). |
| Módulo de almacenamiento | `src/lib/almacenamiento/contrato.ts`, `supabase.ts`, `index.ts` | Un bucket marcado `privado` nunca se pide con su dirección pública: `url()` usa el enlace firmado. Las pantallas no cambian. |
| Sesión | `src/lib/sesion.ts` y `src/lib/app.tsx` | El token salió de `app.tsx` a un módulo propio, para que el almacenamiento lo lea sin depender de toda la app. |
| Migraciones locales | `src/lib/backend/migraciones.ts` y `tests/bd.ts` | Registran la migración nueva para el modo local y las pruebas. |

**Por qué una Edge Function:** CAPACITRON usa sus propias sesiones (`capa.sesiones`), no Supabase Auth, así que las políticas de Storage no saben quién pide un archivo. La única forma de que solo vean la captura su dueña y la administración es que el servidor compruebe la sesión y firme el enlace. No se agregó Supabase Auth ni un servidor propio.

## 2. Revisión de diseño de la HU-16 (resumen)

| Punto | Resultado |
|---|---|
| Medios de pago definidos en un solo lugar | Cumple: base (`capa.medios_disponibles`, CAP-89) y pantalla (`MEDIOS_PAGO`, CAP-88; `PANELES`, CAP-90). Una prueba comprueba que coinciden. |
| Pasarela simulada desactivada en producción | Cumple: solo responde en modo demostración (CAP-90 y CAP-91). |
| Punto listo para una pasarela externa | Cumple: la simulada vive solo en `PasarelaSimulada.tsx`; una real la reemplazaría con un webhook firmado. |
| La captura solo la ven la dueña y la administración | Cumple en la API (CAP-89) y, con esta tarea, en Supabase. |

**Pendiente con el equipo:** el número de WhatsApp de la organización. No va en el código: la administración lo carga en Pagos → Configuración.

## Teoría de Diseño de Software

| Principio | Dónde |
|---|---|
| Encapsulación (diap. 20–24) | Una sola regla decide quién ve un comprobante, en la base de datos; la Edge Function solo firma |
| SRP (diap. 39–49) | `sesion.ts` solo guarda el token; la Edge Function solo valida y firma |
| Bajo acoplamiento (diap. 29–35) | El almacenamiento lee el token sin importar `app.tsx` |
| DIP (diap. 92–106) | Las pantallas piden `url()` al contrato del almacenamiento; si el bucket es privado, el adaptador de Supabase firma |
| Adapter (diap. 126–132) | La pasarela simulada queda aislada en un componente reemplazable |
| Evitar sobreingeniería (diap. 135–139) | No se agregó Supabase Auth, servidor propio ni interfaz de pasarela por adelantado |

## Pruebas

`tests/cap92-comprobantes.test.ts`, 16 pruebas:
- **Regla de acceso:** la dueña y la administración pueden ver la captura. El organizador del evento, otra asistente y un visitante sin sesión no pueden. Una ruta que no es de ningún pago no se autoriza.
- **Bucket:** es privado y coincide con el módulo. Los otros buckets siguen públicos.
- **Enlace firmado:** en Supabase se pide firmado y nunca con la dirección pública. En modo local se ve igual que los demás archivos.
- **Edge Function:** consulta la regla antes de firmar, y la clave de servicio nunca aparece en el código del navegador.
- **Revisión de diseño:** medios de pago en un solo lugar, la pasarela simulada solo en modo demostración y el Adapter aislado.

## Integración

- **Se integra al final, después del n.º 25 (CAP-91, Andree) y antes de CAP-102.** Necesita en `main` las tareas de la HU-16 (CAP-88, CAP-89, CAP-90 y CAP-91) y las anteriores, cuyas migraciones registran `migraciones.ts` y `tests/bd.ts`. Hasta entonces el CI de este PR sale en rojo, y es lo esperado.
- Si al integrar hay conflicto en `migraciones.ts` o `tests/bd.ts`, se queda la versión de esta rama, que ya incluye todas las anteriores.
- **En Supabase (George, después de integrar):** ejecutar `20261122000001_pagos_manuales.sql` (CAP-89) y `20261122000002_bucket_comprobantes.sql`, y desplegar la función con `supabase functions deploy url-comprobante`. Probar el caso M-10 de CAP-91: la captura no se abre con su dirección pública ni sin sesión, y desde la bandeja sí.
