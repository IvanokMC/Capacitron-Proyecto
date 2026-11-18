# CAP-92 · Comprobantes privados, revisión de diseño e integración de la HU-16

**Rol:** DevOps (George) · **Historia:** CAP-83 · HU-16 Pago real con verificación manual

## 1. Qué se agregó

| Pieza | Archivo | Qué hace |
|---|---|---|
| Bucket privado | `supabase/migrations/20261122000002_bucket_comprobantes.sql` | Bucket «comprobantes» con `public = false`, 3 MB, JPG/PNG/WEBP. Solo se puede subir un archivo nuevo a una carpeta `<id de inscripción>/`. No hay políticas de lectura, cambio ni borrado. |
| Regla de acceso | Misma migración: `public.ruta_comprobante_autorizada` | La captura la ven solo la persona que pagó y la administración. También corre en PGlite y tiene pruebas. |
| Edge Function | `supabase/functions/url-comprobante/index.ts` | Con el token de sesión y la ruta, pregunta a la regla y, si autoriza, firma un enlace de 60 segundos con la clave de servicio, que solo existe en el servidor. |
| Módulo de almacenamiento | `contrato.ts` (`privado`), `supabase.ts` (`FirmarPrivado`), `index.ts` | Un bucket privado nunca se pide con la dirección pública; `url()` usa el enlace firmado. Las pantallas no cambian. |
| Sesión | `src/lib/sesion.ts` | El token salió de `app.tsx` a un módulo propio, para que el almacenamiento lo use sin depender de toda la app. |
| CI | `.github/workflows/ci.yml` | En cada PR hacia `main` corre `tsc` y toda la suite, sin secretos. |

**Por qué una Edge Function:** CAPACITRON usa sus propias sesiones (`capa.sesiones`), no Supabase Auth, así que las políticas de Storage no saben quién pide un archivo. Con la clave pública cualquiera podría leer un bucket que tenga política de lectura. La única forma de que solo vean la captura su dueña y la administración es que el servidor compruebe la sesión y firme. No se agregó Supabase Auth ni un servidor propio (evitar sobreingeniería, diap. 135–139).

## 2. Revisión de diseño de la HU-16

| Punto de la tarea | Resultado | Evidencia |
|---|---|---|
| Medios de pago definidos en un solo lugar (code smells, diap. 33) | Cumple. En la base: `capa.medios_disponibles` y el check de `metodo` (CAP-89). En la pantalla: `MEDIOS_PAGO` (CAP-88) y `PANELES` (CAP-90). Una prueba comprueba que los tres coinciden. | `tests/cap92-comprobantes.test.ts` |
| Pasarela simulada desactivada en producción | Cumple. La API responde solo en modo demostración (Sprint 1) y la pantalla de pago solo la ofrece ahí (CAP-90). | `endurecimiento.sql`, `PagarInscripcion.tsx`, prueba de CAP-91 |
| Punto listo para una pasarela externa (Adapter, diap. 126–132) | Cumple. La simulada vive solo en `PasarelaSimulada.tsx` y llama a `iniciar_pago` y `respuesta_pasarela`. Una pasarela real reemplazaría ese componente y `respuesta_pasarela` por un webhook firmado. No se escribió la interfaz por adelantado (diap. 135–139). | `PasarelaSimulada.tsx` |
| La captura solo la ven la dueña y la administración | En la API cumple desde CAP-89. En Supabase, con esta tarea, falta desplegar (sección 4). | Pruebas de CAP-89, CAP-91 y CAP-92 |
| SRP y encapsulación en las piezas de los compañeros | Sin observaciones: una función por operación en la base (CAP-89); la lógica sin pantalla en `pagoManual.ts` (CAP-90). | QUE_SE_HIZO de cada tarea |

**Decisiones de esta revisión:**
- **QR de Yape (de CAP-90):** se queda en el bucket público «fotos», en la carpeta de la cuenta de administración. Es una imagen pública y un QR exportado de Yape pesa decenas de KB.
- **H-02 (la ayuda dice 3 MB y «fotos» admite 2 MB):** se acepta por ahora. El texto viene fijo de `CampoImagen` (CAP-108) y un QR real no se acerca a 2 MB. Si molesta, `CampoImagen` puede recibir el texto de formatos.
- **WhatsApp de la organización:** **pendiente de definir con el equipo** en la reunión del sprint. No está en el código: la administración lo carga en Pagos → Configuración (`guardar_config_pagos`).

## 3. Plan de integración (27/11, después de que suban los compañeros)

Orden de los PR de la HU-16 hacia `main`, cada uno con el CI en verde:

1. CAP-88 (Medaly, diseño)
2. CAP-89 (Carlos, base de datos, con la corrección D-02)
3. CAP-90 (José, pantallas, con la corrección D-02)
4. CAP-91 (Andree, pruebas de aceptación)
5. CAP-92 (George, esta tarea)

La rama de esta tarea se arma después de que CAP-90 esté en `main`, porque usa el bucket «comprobantes» del módulo y las columnas de CAP-89.

## 4. Pasos en Supabase (George los ejecuta, con aviso)

1. En el SQL Editor, en este orden:
   - `20261122000001_pagos_manuales.sql`
   - `20261122000002_bucket_comprobantes.sql`
2. Desplegar la función: `supabase functions deploy url-comprobante`. `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` ya están disponibles en las Edge Functions.
3. Probar el caso M-10 de CAP-91: una captura no se abre con su dirección pública ni sin sesión; desde la bandeja sí, con el enlace firmado.

## 5. Rendimiento

| Medición | Resultado |
|---|---|
| `ruta_comprobante_autorizada` con 200 pagos | 0,86 ms de mediana; además se agregó un índice por ruta |
| Carga inicial del navegador | +0,1 KB |
| Código del modo local | +5,7 KB (el SQL de la migración que corre en PGlite) |

El resto sin cambios. Detalle en `CAPACITRON_registro/tareas/CAP-92/rendimiento.json`.
