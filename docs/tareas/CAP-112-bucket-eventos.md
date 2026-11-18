# CAP-112 · Bucket público de imágenes de eventos y compresión

**Documentación de la tarea** · Rol: DevOps (George) · Historia: HU-20 Flyer e imagen del lugar (CAP-87) · Sprint 2 · PR #4

## Qué hace

| Archivo | Qué es |
|---|---|
| `src/lib/almacenamiento/contrato.ts` | Bucket `eventos` en `Bucket` y `REGLAS` (JPG, PNG o WEBP de hasta 3 MB). `rutaNueva` y `subirArchivo` llaman `carpeta` a su parámetro: la persona en `fotos`, el evento en `eventos` |
| `src/lib/almacenamiento/comprimir.ts` | `comprimirImagen`: lado mayor de 1600 px y WEBP con calidad 0,82; si el navegador no puede o el resultado pesa más, devuelve el original |
| `supabase/migrations/20261121000002_bucket_eventos.sql` | Bucket público, subida solo de archivos nuevos en carpetas con forma de id de evento, sin actualizar ni borrar. En PGlite no hace nada |
| `tests/cap112-bucket-eventos.test.ts` | Reglas, ruta, las dos implementaciones (LSP), coherencia con la migración y compresión |

## Decisiones

- Quién es el organizador lo decide `guardar_imagenes_evento` (CAP-109): CAPACITRON no usa Supabase Auth.
- **Compresión medida en Chrome** (imágenes de prueba): una foto de 4871 KB queda en 133 KB; un flyer PNG de 883 KB, en 120 KB. Un catálogo con 10 flyers baja de unos 8,2 MB a unos 1,2 MB.
- Las pantallas (CAP-110) validan el archivo original (CA-04: más de 3 MB se rechaza) y comprimen después.

## Teoría de Diseño de Software

| Principio | Dónde |
|---|---|
| DIP y code smells (diap. 92–106 y 33) | Una sola forma de subir archivos en todo el sistema |
| LSP (diap. 64–79) | Las dos implementaciones cumplen lo mismo también con el bucket nuevo |
| Mantenibilidad (diap. 137) | Rendimiento medido antes y después |
| Evitar sobreingeniería (diap. 135–139) | Solo canvas del navegador; sin librerías ni servidores de imágenes |

## Integración y pendiente

- Va después de CAP-97 (PR #2).
- Ejecutar `20261121000002_bucket_eventos.sql` en Supabase al integrar.
