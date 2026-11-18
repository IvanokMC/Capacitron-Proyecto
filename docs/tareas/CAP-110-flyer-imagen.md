# CAP-110 · HU-20 Subir y mostrar el flyer y la imagen

**Documentación de la tarea** · Rol: Frontend (José) · Sprint 2 · Cronograma: n.° 21

> Las capturas que se mencionan están en el pull request de esta tarea; no se guardan en el repositorio para no agrandarlo.

**Tarea:** HU-20 · Frontend: subir el flyer y la imagen del lugar y mostrarlos · **Responsable:** José (Frontend) · **Historia:** CAP-87 (HU-20 Flyer e imagen del lugar del evento), criterios **CA-01 a CA-05**.

## Qué se entrega

1. **Formulario del evento (`EditorEvento.tsx`)**, con los componentes de Medaly (`CampoImagen`, CAP-108):
   - «Flyer del evento» va después de la descripción. «Imagen del lugar» va debajo del mapa y solo aparece en eventos presenciales o mixtos, porque en los virtuales no hay bloque de ubicación.
   - Cada campo tiene vista previa, «Cambiar», «Quitar» y la descripción para quien no puede ver la imagen.
   - Un archivo de otro tipo o de más de 3 MB se rechaza con el motivo, por ejemplo «El flyer pesa 4,9 MB y el límite es 3 MB.» (CA-04). El rechazo no borra lo que ya estaba elegido.
2. **Qué pasa al guardar**, en este orden:
   1. `guardar_evento` guarda los datos. En un evento nuevo, recién ahí existe su id y, con él, su carpeta.
   2. Cada imagen nueva se comprime a WEBP (CAP-112) y se sube a `eventos/<id del evento>/` con el módulo común de almacenamiento (CAP-97).
   3. `guardar_imagenes_evento` (CAP-109) guarda las rutas y las descripciones. Solo el organizador del evento puede hacerlo (CA-05).
   - Si nada cambió, no se llama a la API.
   - Si la subida falla, el evento ya quedó guardado. Se avisa «El evento se guardó, pero no las imágenes: …» y queda abierta la edición para reintentar.
3. **Catálogo (`Catalogo.tsx`):** la fila muestra la miniatura del flyer con el día encima (`PortadaTarjeta`). Sin flyer, queda el bloque de fecha de siempre (CA-01).
4. **Página del evento (`EventoDetalle.tsx`):**
   - El flyer es lo primero de la columna, antes del panel con el botón de inscripción (CA-01 y CA-03), con «Ver flyer completo».
   - La imagen del lugar va debajo del mapa (CA-02).
   - Un visitante sin sesión las ve, porque `detalle_evento` devuelve las rutas a cualquiera y el bucket es público.
5. **`imagenElegida.ts` (nuevo)** guarda los estados de una imagen elegida: vista previa, rechazo con motivo, quitar y guardada.
   - Antes estaban dentro de `fotoPerfil.ts` (CAP-95). Se sacaron para no repetirlos en el flyer, como pide la tarea en Jira.
   - `fotoPerfil.ts` lo usa con sus reglas de 2 MB y hace exactamente lo mismo. Las pruebas de CAP-95 y CAP-96 pasan sin cambios.
   - Los comprobantes de pago (HU-16) podrán usarlo igual.
6. **`imagenesEvento.ts` (nuevo):**
   - las reglas de cada imagen: las del bucket `eventos`, con el nombre «El flyer» o «La imagen del lugar» en los mensajes;
   - `cambiosImagenes`, que comprime, sube y arma lo que se manda a la API;
   - `altImagen`: la descripción nunca queda vacía; si no hay una, se usa «Flyer de <nombre del evento>».

## Una decisión que debe confirmar Andree (Product Owner)

George propuso en CAP-112 comprimir **antes** de validar, para aceptar fotos de celular de más de 3 MB. Eso contradice el CA-04 tal como está escrito: «los archivos más pesados se rechazan indicando el motivo».

Aquí se respetó el CA-04: se valida el archivo tal como lo eligió la persona y se comprime **después**, solo para que pese menos al guardarlo y al mostrarlo en el catálogo. Si Andree prefiere aceptar fotos más pesadas, hay que cambiar el CA-04 y una línea de `imagenesEvento.ts`.

## Hallazgo encontrado al revisar las capturas

**H-01 (baja, diseño CAP-108 de Medaly):** en la fila del catálogo, la celda de la grilla se estira al alto de la fila (escritorio) y al ancho (celular). La etiqueta del día de `PortadaTarjeta` quedaba debajo de la miniatura, o en el celular a lo ancho de la fila.
- Corregido en `Catalogo.tsx`, envolviendo la portada en `w-fit self-start`.
- Se propone a Medaly poner esas clases dentro de `PortadaTarjeta` para que funcione en cualquier lugar.

## Capturas (`capturas/`, en la app real, modo local)

| Imagen | Qué muestra |
|---|---|
| `1_form_sin_flyer.png` | Campo del flyer vacío, con la ayuda y «JPG, PNG o WEBP de hasta 3 MB.» |
| `2_form_flyer_rechazado.png` | Archivo de 4,9 MB rechazado: «El flyer pesa 4,9 MB y el límite es 3 MB.» |
| `3_form_flyer_vista_previa.png` | Vista previa del flyer, «Cambiar», «Quitar» y la descripción escrita |
| `4_form_imagen_lugar.png` | Imagen del lugar elegida, en 16:9, con su descripción |
| `5_evento_flyer_y_lugar.png` | Página pública vista sin sesión: el flyer arriba de «Ingresa para inscribirte» y la imagen del lugar debajo del mapa |
| `6_catalogo_con_flyer.png` | Catálogo: el curso con la miniatura y «22 nov»; los demás, con el bloque de fecha |
| `7_movil_catalogo.png` | Catálogo en celular (390 px), sin desplazamiento horizontal |
| `8_movil_evento.png` | Página del evento en celular: el flyer antes del panel de inscripción |

- **El flyer y la foto del lugar son imágenes de ejemplo** dibujadas para las capturas, y lo dicen en la propia imagen. No son un afiche ni una foto reales.
- Se usó la cuenta de demostración «Jorge Paredes», solo en localhost.
- Las imágenes se subieron de verdad por el formulario y se guardaron comprimidas: el flyer PNG de 68,6 KB quedó en WEBP de 32,3 KB y 1131×1600, y la imagen del lugar de 62,5 KB quedó en 14,1 KB.

## Archivos

| Archivo | Cambio |
|---|---|
| `src/lib/imagenElegida.ts` | Nuevo: estados de una imagen elegida, compartidos por la foto de perfil y el flyer |
| `src/lib/imagenesEvento.ts` | Nuevo: reglas del flyer y de la imagen del lugar, subida comprimida y datos para `guardar_imagenes_evento` |
| `src/lib/fotoPerfil.ts` | Modificado: usa `imagenElegida.ts`, sin cambiar lo que hace |
| `src/pages/organizador/EditorEvento.tsx` | Modificado: campos del flyer y de la imagen del lugar; los sube al guardar |
| `src/pages/Catalogo.tsx` | Modificado: miniatura del flyer en la fila del evento |
| `src/pages/EventoDetalle.tsx` | Modificado: flyer antes del panel de inscripción e imagen del lugar debajo del mapa |
| `tests/cap110-flyer-pantallas.test.ts` | Nuevo: 15 pruebas |

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **Code smells / duplicación** (diap. 33) | La validación de imágenes y sus estados se escriben una sola vez (`imagenElegida.ts` y `validarArchivo` del módulo común). El flyer solo cambia sus reglas. |
| **DIP** (diap. 92–106) | `cambiosImagenes` recibe el almacenamiento y la compresión como contratos: no sabe si es Supabase o el modo local. Las pantallas no importan Supabase. Por eso se prueba sin navegador. |
| **OCP** (diap. 50–63) | Una imagen nueva es un juego de reglas nuevo (`ReglasArchivo`), no otro reductor. |
| **SRP** (diap. 39–49) | Guardar las imágenes va aparte de guardar los datos del evento, igual que en la base de datos (CAP-109). Los componentes de Medaly solo dibujan; la lógica está en `lib/`. |
| **Encapsulación** (diap. 20–24) | Quién puede cambiar las imágenes lo decide la base de datos (`guardar_imagenes_evento`), no la pantalla. |
| **Refactorizar con pruebas** (diap. 140) | Antes de sacar los estados de `fotoPerfil.ts`, las pruebas de CAP-95 y CAP-96 ya existían. Siguen pasando sin tocarlas. |

## Pruebas (15 nuevas)

- **Elegir la imagen:**
  - acepta JPG, PNG y WEBP de hasta 3 MB;
  - rechaza otro tipo o más de 3 MB, con el nombre de la imagen en el mensaje;
  - un rechazo no borra lo elegido;
  - «Quitar» se comporta igual que en la foto de perfil;
  - la foto de perfil mantiene su límite de 2 MB.
- **Qué se sube:**
  - el flyer se comprime después de validar y va a la carpeta del evento;
  - quitar manda la ruta en null;
  - cambiar solo la descripción manda solo la descripción;
  - sin cambios no se llama a la API.
- **De punta a punta con la base de datos (PGlite):**
  - lo subido llega al catálogo y a la página sin sesión;
  - otro organizador no puede poner imágenes en el evento.
- **Pantallas:**
  - el catálogo con y sin flyer;
  - la página del evento con el flyer antes del botón y la imagen del lugar;
  - el formulario con los dos campos.

## Rendimiento (`rendimiento.json`)

- **Consultas:** sin cambios; no hay SQL nuevo.
- **Build:** lo que la página descarga al entrar crece 12,4 KB (0,3 KB con gzip). El JS total crece 13,8 KB (0,8 KB con gzip).
  - El empaquetador juntó el archivo «ui», que ya se cargaba siempre, con el principal. Por eso el principal parece crecer 96 KB, pero no se descarga más.
  - El formulario del evento crece 1,7 KB. La pantalla del perfil baja 0,7 KB porque su lógica ahora es compartida.
- **En el celular (390 px)** no hay desplazamiento horizontal ni en el catálogo ni en la página del evento.

## Lo que queda pendiente

- **Andree (CAP-111):** pruebas de aceptación de la HU-20 y la decisión sobre el CA-04.
- **Medaly:** decidir si mueve `w-fit self-start` dentro de `PortadaTarjeta` (H-01).
- **George:** ejecutar en Supabase la migración del bucket `eventos` (CAP-112) y la de CAP-109.
