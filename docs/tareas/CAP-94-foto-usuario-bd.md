# CAP-94 · HU-17 Foto del usuario en la base de datos

**Documentación de la tarea** · Rol: Backend y base de datos (Carlos) · Sprint 2 · Cronograma: n.° 02

**Tarea:** HU-17 · Foto del usuario en la base de datos y permisos · **Responsable:** Carlos (Backend y base de datos) · **Historia:** CAP-84 (HU-17 Perfil con foto), criterios **CA-01 a CA-05**.

## Qué cambia

- La tabla `capa.usuarios` tiene la columna nueva **`foto_url`**. Guarda la **ruta** del archivo dentro del bucket de fotos (`<id del usuario>/<archivo>.jpg`), no la URL completa. La URL la arma el módulo común de almacenamiento (CAP-97, de George).
- **`actualizar_perfil`** puede guardar o quitar la foto:
  - si viene `foto_url` con una ruta, la guarda;
  - si viene vacía (`null`), la quita y el perfil vuelve a mostrar las iniciales (CA-03);
  - si no viene, no la toca (editar el nombre no borra la foto).
- **Validaciones** (respuesta `CAMPOS` con el campo `foto_url`):
  - solo JPG, PNG o WEBP (CA-02);
  - solo archivos de la carpeta del propio usuario: nadie puede poner como suya la foto de otro (CA-05).
- **`sesion_actual`**, el registro y el perfil devuelven `foto_url`, porque todos usan `capa.usuario_json`.
- **`evento_gestion`** devuelve la foto de cada inscrito, para la lista de inscritos del organizador.
- Si alguien escribe directo en la tabla una ruta mal formada (por ejemplo, una URL de otro sitio), la base la rechaza por la restricción de la columna.

**No incluye:** subir el archivo ni el límite de 2 MB. Eso lo hace el módulo de almacenamiento de George (CAP-97) junto con la pantalla de José (CAP-95). Las políticas del bucket en Supabase Storage dependen de cómo George arme ese módulo; esta tarea deja la regla de «solo tu carpeta» en la base de datos.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20261116000002_foto_usuario.sql` | **Nuevo.** Hace cuatro cosas:<br>• `capa.foto_valida`: el formato, en un solo lugar.<br>• La columna `foto_url` con su restricción.<br>• `usuario_json` con la foto.<br>• `actualizar_perfil` con las validaciones, y `evento_gestion` con la foto de los inscritos. |
| `tests/cap94-foto-usuario.test.ts` | **Nuevo.** 9 pruebas de CA-01 a CA-05. |
| `tests/bd.ts` | Registra la migración nueva en la base de pruebas. |
| `src/lib/backend/migraciones.ts` | Registra la migración en el modo local de la app. |
| `src/lib/tipos.ts` | El tipo `Usuario` del frontend tiene `foto_url`. |

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **Encapsulación** (diap. 20–24) | La foto solo cambia por `actualizar_perfil`, que trabaja sobre el usuario de la sesión y exige que el archivo esté en su carpeta. |
| **DIP y bajo acoplamiento** (diap. 29–35 y 92–106) | Se guarda una ruta, no una URL de Supabase. Si cambia el proveedor de archivos, no hay que migrar los datos. |
| **SRP** (diap. 39–49) | Subir el archivo es responsabilidad del módulo de almacenamiento (CAP-97); esta tarea solo guarda y valida la referencia. |
| **Code smells: duplicación** (diap. 33) | El formato válido está en una sola función, `capa.foto_valida`, que usan la restricción de la columna y `actualizar_perfil`. |
| **Refactorizar con pruebas** (diap. 140) | Las 9 pruebas nuevas fijan CA-01 a CA-05 y las 98 anteriores confirman que nada más cambió. |

## Resultado de las pruebas

- `npm test`: **107 pruebas aprobadas** (98 anteriores y 9 nuevas). Ver `pruebas.txt`.
- `npx tsc --noEmit`: sin errores.
- **Rendimiento** (`rendimiento.json`): las funciones medidas tardan lo mismo que antes, con diferencias menores a 0,3 ms.

## Para la revisión del PR

- **Va encima de CAP-77**, porque tocan los mismos archivos de migraciones. Súbela después de que José suba CAP-77 ese mismo día.
- **Supabase:** al desplegar se ejecuta esta migración después de la de CAP-77. Lo hace George al integrar.
