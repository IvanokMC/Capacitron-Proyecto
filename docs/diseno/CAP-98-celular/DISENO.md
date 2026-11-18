# CAP-98 · Diseño del celular con consentimiento (HU-18)

**Rol:** Diseño UI/UX (Medaly) · **Historia:** CAP-85 · HU-18 Celular del asistente · **Criterios:** CA-01 a CA-03 y CA-05

Ficha del diseño que usará José en CAP-100 (registro, «Mi perfil» y la pestaña Inscritos). Todo se arma con los componentes de `src/components/ui.tsx`: `CampoCelular` y `CeldaCelular` (nuevos). Los textos están en `TEXTOS_CELULAR`, para que el registro y el perfil digan exactamente lo mismo.

## Dónde va cada cosa

| Pantalla | Ubicación |
|---|---|
| Registro (`Cuenta.tsx`) | Después del correo y antes de la contraseña. Es obligatorio en las cuentas nuevas. |
| Mi perfil (`Perfil.tsx`) | Debajo del correo. Las cuentas antiguas lo completan aquí. Se pasa `comparteAntes` con el valor guardado. |
| Gestión del evento → Inscritos | Columna «Celular» entre «Persona» y «Estado». |

## Estados

| # | Estado | Qué ve la persona | Imagen |
|---|---|---|---|
| 1 | Registro sin llenar | Prefijo +51, ejemplo «984 123 456» y la ayuda del formato. Casilla sin marcar. | `1_registro_vacio.png` |
| 2 | Celular inválido | Borde rojo, ícono y el motivo en rojo (CA-01). | `2_celular_invalido.png` |
| 3 | Válido y con permiso | Casilla marcada; la explicación sigue visible. | `3_valido_con_permiso.png` |
| 4 | Mi perfil con permiso | Igual que el 3, con el número guardado. | `4_perfil_con_permiso.png` |
| 5 | Mi perfil retirando el permiso | Al desmarcar, la explicación cambia por «Al guardar, los organizadores dejarán de ver tu celular.» (CA-03). | `5_perfil_retirar_permiso.png` |
| 6 | Lista de inscritos | Con permiso: número en grupos de tres y botón verde «WhatsApp» (CA-05). Sin permiso: candado y «No compartido» (CA-02). | `6_lista_inscritos.png` |
| 7 | Celular (375 px) | El bloque se adapta al ancho; el texto pasa a varias líneas. | `7_movil_celular_invalido.png` |

En la lista de inscritos, los nombres y correos son cuentas de los datos de demostración; los números son de ejemplo.

## Textos

| Situación | Texto |
|---|---|
| Ayuda | 9 dígitos, empieza con 9. Por ejemplo: 984 123 456. |
| Formato inválido (lo muestra CAP-100) | El celular debe tener 9 dígitos y empezar con 9. |
| Casilla | Compartir mi celular con los organizadores de los eventos en los que me inscriba. |
| Explicación | Lo usan solo para avisos o consultas del evento, por llamada o WhatsApp. Nunca se publica y puedes retirar el permiso cuando quieras desde «Mi perfil» (Ley N.° 29733). |
| Al retirar el permiso | Al guardar, los organizadores dejarán de ver tu celular. |
| Lista sin permiso | No compartido |

## Decisiones

- **El permiso va junto al dato** (separación de responsabilidades, diap. 6 y 19). La casilla está en el mismo grupo (`fieldset`) que el celular, no al final del formulario, para que quede claro qué se comparte.
- **La casilla empieza sin marcar**: el permiso es explícito, como pide la Ley N.° 29733.
- **«No compartido» no da pistas**: no distingue entre «no dio permiso» y «no tiene celular», porque la API (CAP-99) solo entrega el número cuando hay permiso.
- **WhatsApp en verde suave**, con el color de éxito del sistema y no el verde de la marca, para no competir con las acciones principales de la pantalla.

## Accesibilidad

- El campo es `type="tel"` con `inputMode="numeric"`: en el celular abre el teclado numérico. Solo acepta dígitos, hasta 9.
- La ayuda y el error están unidos al campo con `aria-describedby`; el error se anuncia con `role="alert"` y marca el campo con `aria-invalid`.
- La explicación del permiso está unida a la casilla con `aria-describedby`.
- El grupo tiene una leyenda oculta: «Celular y permiso para compartirlo».
- El botón de WhatsApp dice a quién se escribe («Escribir por WhatsApp a …») y abre en otra pestaña con `rel="noreferrer"`.

## Qué no incluye

Validar el formato y armar el enlace `wa.me` es de CAP-100 (José). Guardar el celular y decidir quién lo ve es de CAP-99 (Carlos). Estos componentes solo reciben el error, el número ya filtrado y el enlace, y los muestran.
