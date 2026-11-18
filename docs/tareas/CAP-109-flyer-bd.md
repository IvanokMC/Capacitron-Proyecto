# CAP-109 · HU-20 Flyer e imagen del lugar en el evento

**Documentación de la tarea** · Rol: Backend y base de datos (Carlos) · Sprint 2 · Cronograma: n.° 19

**Tarea:** HU-20 · Backend: flyer e imagen del lugar en el evento · **Responsable:** Carlos (Backend y base de datos) · **Historia:** CAP-87 (HU-20), criterios **CA-01 a CA-03 y CA-05**.

## Qué se entrega

**Migración `20261121000001_imagenes_evento.sql`:**

1. **Columnas en `capa.eventos`:** `flyer_url`, `flyer_alt`, `imagen_lugar_url` e `imagen_lugar_alt`.
   - Se guarda la **ruta** dentro del bucket de imágenes de eventos (`<id del evento>/<archivo>.webp`), no la URL. Así la base no depende de Supabase (DIP), como la foto de perfil de CAP-94.
   - Un `check` impide rutas mal formadas aunque alguien escriba directo en la tabla.
   - La descripción (texto alternativo, que pide el diseño de Medaly) tiene hasta 200 caracteres.
2. **`guardar_imagenes_evento`**, separada de `guardar_evento` (SRP: subir un flyer no obliga a reenviar fechas, cupos ni coordenadas):
   - Solo el **organizador del evento** (CA-05): a otro organizador le responde `PROHIBIDO`, sin sesión `NO_AUTH`, y un asistente no puede.
   - El archivo debe estar en la carpeta **de ese evento**: no sirve uno de otro evento, aunque sea del mismo organizador.
   - Una clave ausente no se toca. Vacía, quita la imagen **y su descripción**, para que no quede una descripción suelta.
   - Un evento cancelado ya no se edita.
3. **`evento_json`** devuelve las cuatro columnas. Así las tienen el catálogo y la página del evento, también sin sesión (CA-01 a CA-03).
4. **`tipos.ts`:** los campos nuevos en `Evento`, para CAP-110.

**No incluye:**
- El bucket de imágenes de eventos, sus políticas y el registro en el módulo de almacenamiento: CAP-112 (George), que debe usar la misma forma de ruta.
- El tipo y el tamaño del archivo (3 MB): los controlan el módulo de almacenamiento y el bucket.
- Las pantallas: CAP-110 (José).

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20261121000001_imagenes_evento.sql` | Nuevo: columnas del flyer y la imagen del lugar, guardar_imagenes_evento y datos públicos |
| `src/lib/backend/migraciones.ts` | Modificado: migración de CAP-109 en el modo local |
| `src/lib/tipos.ts` | Modificado: `flyer_url`, `flyer_alt`, `imagen_lugar_url` e `imagen_lugar_alt` en `Evento` |
| `tests/bd.ts` | Modificado: migración nueva en la base de pruebas |
| `tests/cap109-imagenes-evento.test.ts` | Nuevo: 20 pruebas |

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **Encapsulación** (diap. 20–24) | Las imágenes solo cambian por `guardar_imagenes_evento`, que exige ser el dueño y que el archivo esté en la carpeta del evento. |
| **SRP** (diap. 39–49) | Guardar las imágenes no se mezcla con guardar los demás datos del evento. Es lo que pide la tarea. |
| **Code smells: duplicación** (diap. 33) | La forma de la ruta vive en `capa.ruta_imagen_evento_valida`, que usan el `check` y la función. El tipo y el tamaño no se repiten aquí: los valida el módulo común. |
| **DIP** (diap. 92–106) | Se guarda una ruta, no una URL del proveedor. Una prueba rechaza una URL completa de Supabase. |
| **Refactorizar con pruebas** (diap. 140) | 20 pruebas fijan cada criterio. |

## Resultado de las pruebas

- Pruebas de esta tarea: **20 aprobadas**.
- En la etapa de la tarea (después de CAP-105): **286 aprobadas**, y `tsc` sin errores.
- Con todo lo preparado del Sprint 2: 411 aprobadas y 3 pendientes. Ver `pruebas.txt`.

## Rendimiento (`rendimiento.json`)

- **Build:** 8,1 KB más de JS, por el SQL de la migración en el modo local.
- **Consultas:** no se pudo medir con precisión. La máquina estaba cargada y tres mediciones, una tras otra, dieron resultados mezclados, incluso en funciones que esta tarea no toca. El cambio solo agrega 4 campos a la respuesta del evento, así que el costo esperado es muy pequeño. Conviene repetir la medición con la máquina libre; los datos están en el archivo.
