# CAP-93 · Diseño del perfil con foto (HU-17)

**Rol:** Diseño UI/UX (Medaly) · **Historia:** CAP-84 · HU-17 Perfil con foto · **Criterios:** CA-01 a CA-04

Ficha del diseño que usará José en CAP-95 («Mi perfil», menú superior y lista de inscritos). Todo se arma con los componentes de `src/components/ui.tsx`: `Avatar` (mejorado) y `SelectorFoto` (nuevo).

## Dónde va en «Mi perfil»

Arriba del panel de datos, como primer bloque:

1. El `SelectorFoto` a la izquierda, con el avatar de 80 px (`size-20`).
2. Debajo, los campos que ya existen: nombres, apellidos, correo y recordatorios.

El botón «Guardar cambios» guarda la foto junto con los datos. La foto elegida se ve como **vista previa** hasta guardar.

## Estados

| # | Estado | Qué ve la persona | Imagen |
|---|---|---|---|
| 1 | Sin foto | Iniciales sobre fondo añil claro y botón «Subir foto». Ayuda: «JPG, PNG o WEBP de hasta 2 MB.» | `1_sin_foto.png` |
| 2 | Con foto guardada | La foto, botón «Cambiar foto» y enlace «Quitar foto». | `2_con_foto.png` |
| 3 | Vista previa | La foto elegida con la insignia amarilla «Vista previa» y el texto «Así se verá. Guarda los cambios para usarla.» (CA-01). | `3_vista_previa.png` |
| 4 | Subiendo | Capa oscura con el ícono girando sobre la foto, botones desactivados y «Subiendo la foto…». | `4_subiendo.png` |
| 5 | Archivo rechazado | El motivo en rojo, con ícono, por ejemplo «La foto pesa 3,1 MB y el límite es 2 MB.» (CA-02). | `5_archivo_rechazado.png` |
| 6 | Error al subir | Se mantiene la foto anterior y aparece en rojo «No se pudo subir la foto. Revisa tu conexión e inténtalo otra vez.» | `6_error_al_subir.png` |
| 7 | Menú superior | Avatar de 32 px (`size-8`) con `tono="oscuro"` sobre el fondo granate. Si no hay foto, iniciales en blanco. | `7_menu_superior.png` |
| 8 | Lista de inscritos | Avatar de 32 px a la izquierda de cada nombre, igual para todos los que no tienen foto. | `8_lista_inscritos.png` |

Al **quitar** la foto se vuelve al estado 1, con las iniciales (CA-03).

## Textos

| Situación | Texto |
|---|---|
| Ayuda | JPG, PNG o WEBP de hasta 2 MB. |
| Tipo no permitido | La foto debe ser una imagen JPG, PNG o WEBP. |
| Muy pesada | La foto pesa {X,X} MB y el límite es 2 MB. |
| Falló la subida | No se pudo subir la foto. Revisa tu conexión e inténtalo otra vez. |
| Guardado | Perfil actualizado (aviso que ya existe). |

## Accesibilidad

- El campo de archivo está oculto, pero se usa con el teclado: al enfocarlo, el botón muestra el contorno de foco.
- La ayuda y los errores están unidos al campo con `aria-describedby`. El error se anuncia con `role="alert"` y marca el campo con `aria-invalid`.
- Mientras sube, el bloque tiene `aria-busy` y los botones se desactivan.
- La foto lleva texto alternativo («Foto de perfil de …»). Las iniciales sin foto son decorativas (`aria-hidden`), porque el nombre ya aparece al lado.
- Si la foto no carga, el avatar vuelve a mostrar las iniciales: nunca queda un cuadro vacío.

## Qué no incluye

Leer el archivo, validar su tipo y tamaño, subirlo y guardar la ruta corresponde a CAP-95 (José) y CAP-97 (George). La ruta en la base de datos es de CAP-94 (Carlos). Este diseño solo recibe el estado y el mensaje de error para mostrarlos.
