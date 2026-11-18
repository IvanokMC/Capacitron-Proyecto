# CAP-96 · HU-17 Pruebas del perfil con foto

**Documentación de la tarea** · Rol: QA y pruebas (Andree) · Sprint 2 · Cronograma: n.° 12

**Tarea:** HU-17 · QA: pruebas del perfil con foto · **Responsable:** Andree (Product Owner y QA) · **Historia:** CAP-84 (HU-17 Perfil del usuario con foto y datos), criterios **CA-01 a CA-05**.

## Qué se entrega

1. **Pruebas de aceptación** (`tests/cap96-aceptacion-hu17.test.ts`): 23 pruebas escritas como «Dado… cuando… entonces…».
   - Hacen lo mismo que «Guardar cambios» en Mi perfil:
     1. elegir el archivo (`reducirFoto`);
     2. subirlo con el módulo común de almacenamiento (CAP-97);
     3. guardar la ruta con `actualizar_perfil` (CAP-94);
     4. verla en la sesión, el avatar y la lista de inscritos.
   - Casos que no cubrían las pruebas de cada pieza:
     - el borde exacto de 2 MB;
     - SVG (puede llevar código), HEIC (fotos de iPhone) y archivos sin tipo;
     - cambiar una foto por otra sin pisar la anterior;
     - quitar la foto también la quita de la lista de inscritos;
     - Mi perfil dibujado con correo, rol e institución de solo lectura;
     - que la API ignore `rol`, `correo` e `institucion_id`;
     - que el almacenamiento no reemplace un archivo ya subido;
     - sin sesión no se cambia nada.
2. **Plan de pruebas** (`docs/pruebas/HU-17/PLAN_DE_PRUEBAS.md`; también suelto en esta carpeta): alcance, matriz de trazabilidad, **10 casos manuales** (M-10 requiere Supabase), hallazgos y la tabla para tu decisión.

**No incluye** la ejecución de los casos manuales ni la decisión de aceptación: eso lo haces tú.

## Hallazgos

| N.° | Hallazgo | Propuesta |
|---|---|---|
| **H-01** | Un archivo apenas mayor a 2 MB se rechaza con «La foto pesa **2,0 MB** y el límite es **2 MB**», que se lee como si cumpliera. El peso se redondea a un decimal. | **Corregido el 17/11** por George en CAP-97 (PR #2): ahora dice «2,1 MB». La prueba de CAP-96 ya está activa. |
| **O-01** | Al cambiar o quitar la foto, el archivo anterior queda guardado en el bucket. | Ya está documentado en CAP-97 como mejora futura. |
| **O-02** | CA-04 pide el celular en Mi perfil. La sesión ya lo trae (CAP-99), pero la pantalla lo muestra recién con CAP-100 (José, 22/11). | Revisar CA-04 de nuevo después de CAP-100. Queda como prueba pendiente. |

## Archivos

| Archivo | Cambio |
|---|---|
| `tests/cap96-aceptacion-hu17.test.ts` | Nuevo: 23 pruebas de aceptación de CA-01 a CA-05 y 1 pendiente (el celular de CAP-100) |
| `docs/pruebas/HU-17/PLAN_DE_PRUEBAS.md` | Nuevo: plan, matriz, 10 casos manuales, hallazgos y decisión de aceptación |

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **Refactorizar con pruebas** (diap. 140) | Si alguien cambia el módulo de almacenamiento, la API o Mi perfil, estas pruebas dicen qué criterio se rompió. |
| **Mantenibilidad** (diap. 137) | Las pruebas usan las mismas funciones que la pantalla (`reducirFoto`, `guardarFoto`, `Avatar`). Si cambia cómo está hecho por dentro, siguen sirviendo. |
| **DIP** (diap. 92–106) | Se prueban con el almacenamiento local, que cumple la misma interfaz que Supabase Storage (CAP-97). Por eso no hace falta Supabase para correrlas. |

## Resultado de las pruebas

- Pruebas de aceptación: **23 aprobadas y 1 pendiente**.
- En la etapa de la tarea (después de CAP-95, con la corrección de CAP-97): **207 aprobadas y 1 pendiente**, y `tsc` sin errores.
- Con todo lo preparado del Sprint 2 (incluida CAP-100, preparada después): 312 aprobadas y 2 pendientes. Ver `pruebas.txt`.

## Rendimiento (`rendimiento.json`)

- **Build:** no cambia: solo se agregan pruebas y documentación.
- **Consultas:** iguales a CAP-103. La primera medición salió más lenta en algunas funciones por la carga del equipo; se repitió y quedó igual. Las dos mediciones están en el archivo.
