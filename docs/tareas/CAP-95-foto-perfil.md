# CAP-95 · HU-17 Subir, cambiar y quitar la foto de perfil

**Documentación de la tarea** · Rol: Frontend (José) · Sprint 2 · Cronograma: n.° 07

> Las capturas que se mencionan están en el pull request de esta tarea; no se guardan en el repositorio para no agrandarlo.

**Tarea:** HU-17 · Subir, cambiar y quitar la foto de perfil · **Responsable:** José (Frontend) · **Historia:** CAP-84 (HU-17 Perfil con foto), criterios **CA-01 a CA-04**.

## Qué se entrega

1. **Mi perfil** (`Perfil.tsx`):
   - Arriba, el `SelectorFoto` diseñado por Medaly en CAP-93.
   - **Vista previa (CA-01):** la foto elegida se ve con la insignia «Vista previa» hasta pulsar **Guardar cambios**. Al guardar, primero se sube la foto y luego se guardan los datos y la ruta juntos.
   - **Archivo rechazado (CA-02):** si no es JPG, PNG o WEBP, o pesa más de 2 MB, aparece el motivo en rojo («La foto pesa 3,2 MB y el límite es 2 MB.») y la foto actual no cambia.
   - **Error al subir:** si falla la conexión, no se guarda nada, se mantiene la foto anterior y aparece «No se pudo subir la foto…».
   - **Quitar (CA-03):** con una vista previa, la descarta; con la foto guardada, la marca para quitarla y al guardar se vuelven a ver las iniciales.
   - **Datos (CA-04):** se agregaron el rol y la institución, de solo lectura, junto al correo.
2. **Menú superior** (`Shell.tsx`): la foto o las iniciales sobre el fondo granate.
3. **Lista de inscritos** (`GestionEvento.tsx`): la foto de cada inscrito a la izquierda de su nombre.
4. **`AvatarUsuario.tsx`** (nuevo): convierte la ruta guardada en la base (CAP-94) en la dirección de la imagen, con el módulo de almacenamiento (CAP-97). Lo usan las tres pantallas.
5. **`lib/fotoPerfil.ts`** (nuevo): la lógica de la foto separada de la pantalla:
   - `reducirFoto`: los estados;
   - `fotoVisible`: qué foto se ve;
   - `guardarFoto`: sube y dice qué mandar a `actualizar_perfil`;
   - `useFotoPerfil`: el hook que usa la pantalla.

**No incluye:** el celular en el perfil, que llega con CAP-99 y CAP-100 (HU-18), y las pruebas de aceptación de Andree (CAP-96).

## Archivos

| Archivo | Cambio |
|---|---|
| `src/lib/fotoPerfil.ts` | Nuevo: estados de la foto (elegir, vista previa, quitar) y qué mandar a la API |
| `src/components/AvatarUsuario.tsx` | Nuevo: avatar a partir de la ruta guardada, con el módulo de almacenamiento |
| `src/pages/Perfil.tsx` | Modificado: foto de perfil, rol e institución |
| `src/components/Shell.tsx` | Modificado: foto en el menú superior |
| `src/pages/organizador/GestionEvento.tsx` | Modificado: foto de cada inscrito |
| `tests/cap95-foto-perfil.test.ts` | Nuevo: 13 pruebas |

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **DIP** (diap. 92–106) | La pantalla sube la foto con el contrato `Almacenamiento` de CAP-97 y no importa Supabase. `guardarFoto` recibe el almacenamiento como parámetro, por eso se prueba con el local. |
| **SRP** (diap. 39–49) | `fotoPerfil.ts` decide los estados y qué mandar a la API; `Perfil.tsx` solo los dibuja con `SelectorFoto`. |
| **Bajo acoplamiento** (diap. 29–35) | `Avatar` (CAP-93) solo sabe mostrar una dirección; `AvatarUsuario` hace de adaptador entre la ruta de la base y esa dirección. |
| **Cohesión** (diap. 26–28) | Un solo `AvatarUsuario` para el perfil, el menú y los inscritos. |
| **Evitar duplicación** (diap. 33) | La validación de tipo y tamaño es la del módulo común, con los textos de la ficha de diseño. |
| **Refactorizar con pruebas** (diap. 140) | 13 pruebas cubren los estados, la subida real con el almacenamiento local y lo que guarda la base. |

## Resultado de las pruebas

- Pruebas de CAP-95: **13 aprobadas**:
  - vista previa al elegir;
  - rechazo por tipo y por tamaño;
  - un rechazo no borra la vista previa elegida;
  - «Quitar» con y sin vista previa;
  - subir y guardar la ruta en el perfil;
  - quitar deja la foto en `null`;
  - no tocar la foto la conserva;
  - no se puede usar un archivo de la carpeta de otra persona (CA-05);
  - la lista de inscritos trae la foto;
  - el avatar sin foto muestra las iniciales;
  - el menú y los inscritos usan el mismo componente.
- Todas las pruebas: **183 aprobadas** (con CAP-77, 94, 93, 78, 80, 98 y 97 incluidas). Ver `pruebas.txt`.
- `npx tsc --noEmit`: sin errores.

## Rendimiento (`rendimiento.json`)

- **Build:** 10.9 KB más de JS que en CAP-98, por el módulo de almacenamiento (CAP-97) y la lógica de la foto.
- **Consultas:** no cambian, porque esta tarea no toca la base de datos. En una primera medición todas salieron algo más lentas, también las que no tienen nada que ver. Para descartar la carga del equipo se midieron CAP-98 y CAP-95 uno tras otro: CAP-95 quedó igual o más rápido en todas (`comparacion_misma_hora`).

## Capturas (`capturas/`, tomadas en la app real, modo local)

| Imagen | Qué muestra |
|---|---|
| `1_perfil_sin_foto.png` | Mi perfil con las iniciales, el rol y la institución |
| `2_archivo_rechazado.png` | Aviso de foto de más de 2 MB |
| `3_vista_previa.png` | Foto elegida con «Vista previa» |
| `4_foto_guardada_y_menu.png` | Foto guardada; también aparece en el menú |
| `5_menu_con_foto.png` | Detalle del menú superior |
| `6_inscritos_con_foto.png` | Lista de inscritos del organizador con la foto de la asistente |

La imagen usada es una figura generada para la prueba, no la foto de una persona.

## Para la revisión del PR

- Andree (QA): CAP-96 prueba estos criterios. Las capturas muestran cada estado.
- En Supabase hace falta haber ejecutado la migración del bucket de fotos de CAP-97.
