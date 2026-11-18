# CAP-100 · HU-18 Celular en registro, perfil e inscritos

**Documentación de la tarea** · Rol: Frontend (José) · Sprint 2 · Cronograma: n.° 13

> Las capturas que se mencionan están en el pull request de esta tarea; no se guardan en el repositorio para no agrandarlo.

**Tarea:** HU-18 · Frontend: celular en el registro, el perfil y la lista de inscritos · **Responsable:** José (Frontend) · **Historia:** CAP-85 (HU-18 Celular del asistente), criterios **CA-01 a CA-03 y CA-05**.

## Qué se entrega

1. **`src/lib/celular.ts`** (nuevo):
   - `validarCelular` y `validarCelularPerfil`: una sola regla para el registro y el perfil. Son 9 dígitos que empiezan con 9, y el mensaje es el mismo que da la API («El celular debe tener 9 dígitos y empezar con 9.»).
   - En el registro el celular es obligatorio. En el perfil, una cuenta antigua puede seguir sin él, salvo que marque «Compartir»; quien ya lo tiene puede cambiarlo, pero no borrarlo.
   - `limpiarCelular`: quita espacios, guiones y el +51.
   - `enlaceWhatsapp`: `https://wa.me/51…` con el saludo «Hola Ana, te escribo por el evento «…» de CAPACITRON.».
2. **Registro (`Cuenta.tsx`):**
   - El celular va después del correo y antes de la contraseña, como pide la ficha de Medaly (CAP-98).
   - La casilla de permiso empieza sin marcar (CA-01 y CA-02).
   - **La política de privacidad ahora menciona el celular** y que el permiso se puede retirar (Ley N.° 29733).
3. **Mi perfil (`Perfil.tsx`):**
   - Celular y permiso debajo del correo (CA-03, y también el CA-04 de la HU-17).
   - Al desmarcar, avisa «Al guardar, los organizadores dejarán de ver tu celular.».
   - Si la API rechaza el celular, el mensaje aparece en el campo.
4. **Lista de inscritos (`GestionEvento.tsx`):** columna «Celular» entre «Persona» y «Estado».
   - Con permiso: el número y el botón «WhatsApp» (CA-02 y CA-05).
   - Sin permiso: candado y «No compartido».
   - `TablaInscritos` se exporta para probarla.

## Capturas (`capturas/`, en la app real, modo local)

| Imagen | Qué muestra |
|---|---|
| `1_registro_celular_invalido.png` | Registro con un celular que empieza con 8: campo en rojo y el motivo |
| `2_perfil_sin_celular.png` | Mi perfil de una cuenta de demostración sin celular (opcional) |
| `3_perfil_celular_compartido.png` | Celular guardado con el permiso marcado |
| `4_perfil_retirar_permiso.png` | Al desmarcar: «Al guardar, los organizadores dejarán de ver tu celular.» |
| `5_inscritos_celular_whatsapp.png` | Lista de inscritos de Carmen: Ana con número y WhatsApp; los demás «No compartido» |
| `6_movil_registro.png` | Registro en celular (390 px), sin desplazamiento horizontal |

Se usaron las cuentas de demostración «Ana Lucía Huamán» y «Carmen Valdivia», solo en localhost. El número 984 111 222 es de ejemplo.

## Archivos

| Archivo | Cambio |
|---|---|
| `src/lib/celular.ts` | Nuevo: regla del celular (registro y perfil) y enlace de WhatsApp |
| `src/pages/Cuenta.tsx` | Modificado: celular y permiso en el registro; la política de privacidad menciona el celular |
| `src/pages/Perfil.tsx` | Modificado: celular y permiso en Mi perfil |
| `src/pages/organizador/GestionEvento.tsx` | Modificado: columna «Celular» con WhatsApp en la lista de inscritos |
| `tests/cap100-celular-pantallas.test.ts` | Nuevo: 11 pruebas |

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **Code smells: duplicación** (diap. 33) | La regla del celular está en un solo módulo y la usan el registro y el perfil. El mensaje es el mismo de la API; una prueba lo compara con `capa.mensaje_celular()`. |
| **ISP** (diap. 80–91) | La tabla de inscritos recibe solo el celular que la API ya filtró. El enlace de WhatsApp se arma solo si llegó el número, y no hay otra lógica de permisos en la pantalla. |
| **SRP** (diap. 39–49) | `celular.ts` valida y arma el enlace; los componentes de CAP-98 solo muestran; las páginas solo conectan. |
| **Refactorizar con pruebas** (diap. 140) | 11 pruebas, entre ellas una que recorre registro → inscripción → lista del organizador con la API real. |

## Resultado de las pruebas

- Pruebas de esta tarea: **11 aprobadas**.
- En la etapa de la tarea (CAP-95 + CAP-99): **222 aprobadas**, y `tsc` sin errores.
- Con todo lo preparado del Sprint 2: 312 aprobadas y 2 pendientes. Ver `pruebas.txt`.

## Rendimiento (`rendimiento.json`)

- **Build:** 11,5 KB más de JS que en CAP-103: el campo del celular y la columna.
- **Consultas:** sin cambios; esta tarea no toca la base de datos.

## Nota

Las pruebas importan las páginas al inicio del archivo, no dentro de cada prueba. Con toda la suite en paralelo, un import dinámico de `Cuenta.tsx` pasó el tiempo límite de 30 s. Lo mismo se ajustó en la prueba de CAP-96 (Andree).
