# HU-18 · Plan y resultado de pruebas

**Historia:** CAP-85 · HU-18 Celular del asistente para un contacto personalizado · **Tarea:** CAP-101 · **Responsable:** Andree (Product Owner y QA)

> Como organizadora de eventos, quiero tener el celular de los asistentes, para contactarlos y dar una atención más personalizada en mis conferencias.

## 1. Alcance

| Pieza | Tarea | Qué prueban sus pruebas |
|---|---|---|
| Diseño del campo y de la celda | CAP-98 (Medaly) | Estados del campo de celular, el permiso y la celda de inscritos |
| Celular en la base de datos | CAP-99 (Carlos) | Formato, consentimiento, quién lo ve y que no salga por funciones públicas |
| Registro, perfil e inscritos | CAP-100 (José) | Regla única del celular, enlace de WhatsApp y las tres pantallas |
| Historia completa | CAP-101 (Andree) | CA-01 a CA-05 con dos organizadoras, dos eventos y tres asistentes |

## 2. Entorno

- **Automáticas:** `npx vitest run` con PGlite en memoria; la lista de inscritos se dibuja con `TablaInscritos`.
- **Manuales:** `npm run dev` en modo local con «Ana Lucía Huamán» (asistente) y «Carmen Valdivia» (organizadora), y una cuenta nueva creada desde «Crear cuenta».

## 3. Datos de prueba (`tests/cap101-aceptacion-hu18.test.ts`)

| Persona | Rol | Celular | Permiso | Inscrita en |
|---|---|---|---|---|
| Carmen | Organizadora | — | — | Dueña del «Taller de Python» |
| Jorge | Organizador (otra institución) | — | — | Dueño del «Curso de React» |
| Rosa | Asistente | «984 111 222» | Sí | Taller y Curso |
| Luis | Asistente | «+51 984-333-444» | No | Taller |
| Ana | Asistente (cuenta antigua sin celular) | — | — | — |

Rosa y Luis se registran con la misma regla que la pantalla. Sus celulares se escriben con espacios, guiones y +51 a propósito.

## 4. Matriz de trazabilidad

| Criterio | CAP-101 (aceptación) | También lo prueban | Resultado |
|---|---|---|---|
| **CA-01** 9 dígitos que empiezan con 9, o no se guarda | 7 pruebas | CAP-98, CAP-99, CAP-100 | Cumple |
| **CA-02** Con consentimiento lo ve; sin consentimiento, no | 2 pruebas | CAP-99, CAP-100 | Cumple |
| **CA-03** Cambiarlo y dar o retirar el permiso en el perfil | 5 pruebas | CAP-99, CAP-100 | Cumple |
| **CA-04** Solo los inscritos de sus propios eventos | 3 pruebas | CAP-99 | Cumple |
| **CA-05** WhatsApp con un clic | 1 prueba (+ la de la lista en CA-02) | CAP-98, CAP-100 | Cumple |
| Regla: nunca en funciones públicas | 1 prueba (9 funciones) | CAP-99 | Cumple |

Lo que agregan las pruebas de CAP-101:

- La pantalla y la API rechazan con **el mismo motivo**.
- Retirar el permiso lo oculta **en todos los eventos** donde la persona está inscrita, no solo en uno.
- Dar el permiso después también funciona.
- Cambiar el número se ve de inmediato.
- Un organizador de otra institución ve a la asistente en su propio evento, pero no puede abrir la lista ajena.
- Al cancelar en un evento, el celular se oculta solo en ese.
- El celular no aparece en 9 funciones: catálogo, página del evento (con y sin sesión), «Mis inscripciones», asistencia, certificados, reportes, «Mis eventos» y la lista del administrador.

**Resultado automático reportado en el paquete (17/11/2026):** 19 pruebas de aceptación aprobadas. `npx tsc --noEmit` sin errores.

**Verificación de esta rama (18/11/2026):** la prueba de CAP-101 no pudo cargarse porque faltan `src/lib/celular` y la exportación `TablaInscritos` de `GestionEvento`. `npm test` terminó con 121 pruebas aprobadas y una suite fallida; TypeScript reportó esos mismos bloqueos.

## 5. Casos manuales

Los ejecuta Andree en el navegador antes de aceptar la historia. Las capturas de CAP-100 muestran lo esperado.

| N.° | Criterio | Pasos | Resultado esperado | Resultado |
|---|---|---|---|---|
| M-01 | CA-01 | En «Crear cuenta», escribir «812345678» como celular y enviar. | «El celular debe tener 9 dígitos y empezar con 9.» en rojo; no se crea la cuenta. | Cumple |
| M-02 | CA-01 | Intentar escribir letras o más de 9 dígitos. | El campo solo acepta dígitos, hasta 9. | Cumple |
| M-03 | CA-02 | Crear una cuenta con celular válido y **sin** marcar «Compartir». Confirmarla en el buzón de demostración e inscribirse en un evento de Carmen. | Como Carmen, la persona aparece con «No compartido». | Cumple |
| M-04 | CA-03 | Con esa cuenta, en «Mi perfil», marcar «Compartir» y guardar. | Como Carmen, ahora aparece el número y el botón «WhatsApp». | Cumple |
| M-05 | CA-05 | Como Carmen, pulsar «WhatsApp». | Se abre WhatsApp (web o la app) con el número y el saludo con el nombre del evento. | Cumple |
| M-06 | CA-03 | Volver a «Mi perfil», desmarcar «Compartir». | Antes de guardar aparece «Al guardar, los organizadores dejarán de ver tu celular.» | Cumple |
| M-07 | CA-03 | Guardar. | Como Carmen, vuelve «No compartido». | Cumple |
| M-08 | CA-04 | Ingresar como otro organizador de la demostración y abrir la gestión de un evento de Carmen escribiendo su dirección. | Se niega el acceso. | Cumple |
| M-09 | Regla | Con sesión cerrada, abrir el catálogo y la página del evento; buscar el número. | No aparece en ninguna parte. | Cumple |
| M-10 | Celular | Repetir M-01 y M-04 a 390 px de ancho. | El campo y la casilla caben sin desplazamiento horizontal. | Cumple |

**Nota:** M-01 a M-10 se registran como cumplidos según la validación manual reportada por el equipo; no se reejecutaron en esta rama.

## 6. Hallazgos

| N.° | Gravedad | Hallazgo | Evidencia | Propuesta |
|---|---|---|---|---|
| H-01 | Baja (tipografía) | En la explicación del permiso, «Ley N.° 29733» se corta entre líneas: «Ley N.» queda al final de una y «° 29733» al inicio de la siguiente. | Captura `1_registro_celular_invalido.png` de CAP-100 (tarjeta de registro). El texto está en `TEXTOS_CELULAR.explicacion` de `ui.tsx` (CAP-98, Medaly). | Mostrar «N.° 29733» dentro de un `<span className="whitespace-nowrap">` para que no se corte. Es un cambio de una línea en CAP-98. |
| O-01 | Observación | El consentimiento vale para los organizadores de **todos** los eventos donde la persona se inscribe; no se da evento por evento. | Así lo define la historia (CA-02). | Si la Product Owner lo prefiere por evento, sería una historia nueva. |

## 7. Decisión de aceptación

La toma Andree como Product Owner después de los casos manuales. Las pruebas automáticas no encuentran nada que bloquee los criterios; H-01 es solo de texto.

| Fecha | Decisión | Observaciones |
|---|---|---|
| 18/11/2026 | Aceptada | M-01 a M-10 cumplen según la validación manual reportada por el equipo. La ejecución automática en esta rama queda bloqueada por la ausencia de CAP-99/CAP-100. |
