# CAP-97 · Módulo común de almacenamiento y bucket de fotos

**Documentación de la tarea** · Rol: DevOps (George) · Historia: HU-17 Perfil con foto (CAP-84) · Sprint 2 · PR #2

## Qué hace

Una sola forma de subir y mostrar archivos en todo CAPACITRON. La usan la foto de perfil (HU-17) y, después, el flyer (HU-20) y los comprobantes de pago (HU-16).

| Archivo | Qué es |
|---|---|
| `src/lib/almacenamiento/contrato.ts` | Interfaz `Almacenamiento` (`subir`, `url`), reglas por bucket, `validarArchivo`, `rutaNueva` y `subirArchivo` |
| `src/lib/almacenamiento/supabase.ts` | Implementación con Supabase Storage; recibe el cliente ya creado y sube con `upsert: false` (nunca reemplaza) |
| `src/lib/almacenamiento/local.ts` | Implementación local: IndexedDB en el navegador y memoria en las pruebas |
| `src/lib/almacenamiento/index.ts` | Elige la implementación con la misma regla que el backend (Supabase si hay credenciales) y trae el hook `useUrlArchivo` |
| `supabase/migrations/20261117000002_bucket_fotos.sql` | Bucket `fotos` público, JPG/PNG/WEBP de hasta 2 MB, subida solo a carpetas con forma de id; sin actualizar ni borrar. En PGlite no hace nada. |
| `tests/cap97-almacenamiento.test.ts` | Pruebas del contrato sobre las dos implementaciones |

## Decisiones

- **Seguridad:** CAPACITRON usa sus propias sesiones, no Supabase Auth, así que Storage no sabe quién sube. Quién puede usar una foto como suya lo decide `actualizar_perfil` (CAP-94). Riesgo que queda: se pueden subir archivos sueltos a una carpeta ajena; no se muestran en ninguna parte y los limitan el tipo y el tamaño.
- **Build:** las variables de Supabase se leen en línea en `index.ts`. Una versión que las leía dentro de una función hacía crecer el build 225 KB, porque Vite ya no descartaba el modo local al compilar.
- **Hallazgo H-01 de CAP-96 (corregido):** el peso de un archivo rechazado se redondea hacia arriba. Con 2 MB + 1 byte, el mensaje dice «2,1 MB» y no «2,0 MB», que parecía cumplir el límite.

## Teoría de Diseño de Software

| Principio | Dónde |
|---|---|
| DIP (diap. 92–106) | Las pantallas dependen de la interfaz `Almacenamiento`, no de Supabase |
| LSP (diap. 64–79) | Las mismas pruebas corren sobre la implementación local y la de Supabase |
| Code smells / duplicación (diap. 33) | Validar el archivo y armar la ruta se escribe una sola vez (`subirArchivo`) |
| OCP (diap. 50–63) | Un bucket nuevo es una entrada en `Bucket` y `REGLAS`; las implementaciones no cambian |
| Evitar sobreingeniería (diap. 135–139) | El contrato solo tiene lo que hoy se usa: subir y leer |

## Pruebas y rendimiento

- 16 pruebas propias; en la rama, `tsc` sin errores y toda la suite en verde.
- Build igual que `main` (2540,7 KB de JS). Consultas sin cambios.

## Pendiente

- Ejecutar `20261117000002_bucket_fotos.sql` en el SQL Editor de Supabase al integrar.
