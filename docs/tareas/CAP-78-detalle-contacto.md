# CAP-78 · HU-02 Mostrar los campos y el contacto en el catálogo

**Documentación de la tarea** · Rol: Frontend (José) · Sprint 2 · Cronograma: n.° 04

> Las capturas que se mencionan están en el pull request de esta tarea; no se guardan en el repositorio para no agrandarlo.

**Tarea:** HU-02 · Mostrar los campos nuevos y el contacto con consentimiento en el catálogo · **Responsable:** José (Frontend) · **Historia:** CAP-2 (HU-02), criterios **CA-06 y CA-08**.

## Qué se entrega

1. **Catálogo** (`Catalogo.tsx`): cada tarjeta muestra el tipo del evento (Seminario, Congreso, Taller o Curso) como insignia. La línea del organizador usa el nombre público que eligió en CAP-77 y, si hay, la institución.
2. **Página del evento** (`EventoDetalle.tsx`): el tipo va junto a la modalidad y las horas, y «Organiza …» usa el nombre público.
3. **Contacto del organizador** (`ContactoOrganizador.tsx`, nuevo), debajo del panel de inscripción:
   - **Con consentimiento (CA-06):** el correo o teléfono como enlace (`mailto:` o `tel:`).
   - **Sin consentimiento (CA-08):** el texto «El organizador prefirió no publicar su correo ni su teléfono» y el botón «Escribir al organizador», que abre un formulario con nombre, correo y mensaje. Si la persona inició sesión, su nombre y correo ya vienen llenos.
   - El organizador no ve este bloque en su propio evento.
4. **Base de datos** (`20261117000001_campos_publicos_evento.sql`):
   - `capa.evento_json`, que alimenta el catálogo y el detalle, ahora entrega `tipo`, `organizador_nombre`, `contacto_publico` y `contacto`. El contacto solo se incluye si hay consentimiento.
   - Nueva función `contactar_organizador`: el evento debe estar publicado; valida nombre, correo y mensaje (10 a 1000 caracteres); permite hasta 10 mensajes por evento en una hora, y envía el mensaje al correo de la cuenta del organizador. El visitante nunca recibe el dato privado.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20261117000001_campos_publicos_evento.sql` | Nuevo: datos públicos del evento y función `contactar_organizador` |
| `src/components/ContactoOrganizador.tsx` | Nuevo: bloque «Contacto del organizador» y formulario |
| `src/lib/tipos.ts` | Modificado: campos `tipo`, `organizador_nombre`, `contacto_publico` y `contacto` en `Evento` |
| `src/lib/validacionEvento.ts` | Modificado: `etiquetaTipo` y `textoOrganiza` |
| `src/pages/Catalogo.tsx` | Modificado: insignia del tipo y organizador en cada tarjeta |
| `src/pages/EventoDetalle.tsx` | Modificado: tipo, organizador y bloque de contacto |
| `src/lib/backend/migraciones.ts` | Modificado: migración de CAP-78 en el modo local |
| `tests/bd.ts` | Modificado: migración nueva en la base de pruebas |
| `tests/cap78-campos-publicos.test.ts` | Nuevo: 13 pruebas |

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **Encapsulación y ocultamiento de información** (diap. 20–24) | `evento_json` decide en un solo lugar si el contacto sale. Sin consentimiento, el dato no viaja al navegador, así ninguna pantalla puede mostrarlo por error. |
| **SRP** (diap. 39–49) | `ContactoOrganizador` solo se ocupa del contacto; la página del evento lo incluye sin conocer el formulario. `contactar_organizador` solo entrega un mensaje y no modifica el evento. |
| **Bajo acoplamiento** (diap. 29–35) | El formulario habla con la API por `api('contactar_organizador')`, sin saber si detrás está Supabase o la base local. |
| **Evitar duplicación** (diap. 33) | `etiquetaTipo` usa la misma lista `TIPOS_EVENTO` del formulario de CAP-77, y `textoOrganiza` arma la línea del organizador igual en el catálogo y en el detalle. |
| **Evitar sobreingeniería** (diap. 135–139) | El mensaje se envía con el mismo `capa.enviar_correo` de las notificaciones, sin una tabla nueva de mensajes. |
| **Refactorizar con pruebas** (diap. 140) | 13 pruebas nuevas fijan qué ve el público. Las de CAP-76 y CAP-77 siguen pasando, así la privacidad del contacto no cambió. |

## Resultado de las pruebas

- Pruebas de CAP-78: **13 aprobadas**:
  - el catálogo y el detalle muestran el tipo y el organizador;
  - el contacto aparece solo con consentimiento;
  - sin consentimiento, no viaja ni en el detalle ni en el catálogo;
  - el mensaje llega al organizador y no al visitante;
  - se rechazan los campos vacíos, un mensaje de más de 1000 caracteres y los borradores;
  - el límite por hora funciona;
  - el enlace es `mailto:` o `tel:` según el contacto.
- Todas las pruebas: **130 aprobadas** (con CAP-77, CAP-94 y CAP-93 incluidas). Ver `pruebas.txt`.
- `npx tsc --noEmit`: sin errores.
- **Rendimiento** (`rendimiento.json`, 30 repeticiones): `catalogo_eventos` 1,83 ms y `detalle_evento` 0,80 ms de mediana, iguales o menores que en CAP-93 (2,03 y 1,26 ms). Agregar los campos no hizo más lentas las consultas.

## Capturas (`capturas/`)

| Imagen | Qué muestra |
|---|---|
| `1_catalogo_tipo.png` | Insignias «Seminario» y «Curso» en el catálogo |
| `2_detalle_sin_consentimiento.png` | Página del evento con «Escribir al organizador» |
| `3_formulario_contacto.png` | Formulario con el aviso de mensaje muy corto |
| `4_detalle_con_consentimiento.png` | Página del evento con el correo del organizador como enlace |

En las capturas, el tipo y el contacto de los eventos de demostración se llenaron solo para tomarlas. Los datos de demostración del proyecto no cambian.

## Ajuste del 17/11/2026: tres pruebas del Sprint 1 (por la corrección D-01)

CAP-77 se corrigió el 17/11 (defecto D-01, hallado por CAP-79): un evento publicado ya no puede quedarse sin contacto al editarlo.

Con CAP-78, la vista pública (`evento_json`) trae `contacto: null` cuando el organizador no dio su permiso. Tres pruebas antiguas editaban el evento reenviando esa vista pública, y con eso le pedían a la API borrar el contacto, que ahora se rechaza. Se cambiaron para editar con `evento_gestion`, que es lo que hace el editor real (`EditorEvento.tsx`):

- `tests/hu01-02-cuentas-eventos.test.ts` (HU-02 CA-05);
- `tests/hu03-05-inscripcion-pagos-cupos.test.ts` (ampliar el cupo);
- `tests/hu06-09-recordatorios-qr-certificados.test.ts` (cambio de fecha).

Lo que cada prueba comprueba no cambia. Siguen siendo 130 pruebas, todas en verde, y `tsc` sin errores (verificado en la etapa de la tarea con CAP-77 corregida).


- Andree (QA): revisar que, sin consentimiento, el contacto no aparezca en ninguna parte de la página pública.
- Al desplegar en Supabase, la función nueva ya trae su permiso para visitantes sin sesión (`anon`).
