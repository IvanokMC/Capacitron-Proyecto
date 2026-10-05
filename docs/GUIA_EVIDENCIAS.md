# Guía de evidencias · CAP Sprint 1

Qué subir en cada tarea de Jira (CAP-28 a CAP-74), dónde se encuentra en la aplicación o en el repositorio y cómo obtenerlo. Sigue las reglas de evidencia del equipo: capturas PNG con la URL y la fecha visibles, nombradas `CAP-XX_descripcion.png`; código con enlace al commit; SQL como archivo `.sql` más la captura del resultado; pruebas en tabla. **No subas contraseñas, claves de API ni datos reales.**

## Antes de empezar

- **Dónde tomar las capturas:** en la app desplegada en Vercel (conectada a Supabase), o en local con `npm run dev`. Toma las capturas con la ventana completa del navegador para que se vean la URL y la fecha del sistema.
- **Cuentas:** las de demostración del [README](../README.md#cuentas-de-demostración) (estudiante, organizadoras, ponente, administración). La contraseña está en el README: no la copies en Jira.
- **Correos:** son simulados. Se leen en la campana (Bandeja) de cada cuenta o en el pie de página → «Buzón de demostración».
- **Reloj de demostración:** Administración → «Sistema» permite adelantar la hora para ver recordatorios, vencimientos, certificados y encuestas. Vuelve a la hora real al terminar.
- **Reiniciar los datos:** ejecuta [`supabase/reiniciar_demo.sql`](../supabase/reiniciar_demo.sql) en el SQL Editor de Supabase si una prueba dejó datos que estorban.
- **API (capturas «de Postman»):** importa [`docs/postman/CAPACITRON.postman_collection.json`](postman/CAPACITRON.postman_collection.json), completa las variables `url` y `apikey` (Supabase → Project Settings → API) y ejecuta las carpetas en orden. La API responde 200 en éxito y 400 en errores de validación (convención de Supabase), con el código del error en `hint`.
- **Enlaces a código:** después de subir el repositorio a GitHub, el enlace a un archivo es `https://github.com/<usuario>/<repositorio>/blob/main/<ruta>` y el de un commit, `https://github.com/<usuario>/<repositorio>/commit/<hash>` (`git log --oneline` muestra el hash).
- **Diagramas:** [`docs/diagramas.md`](diagramas.md) (entidad-relación y secuencia del pago). Para el PNG, pega el bloque en <https://mermaid.live> y descárgalo.
- **Pruebas automáticas:** `npm test` ejecuta 82 pruebas de los criterios de aceptación. Los resultados de las tablas salen de esa ejecución.

## Índice

- **HU-01 Registro de usuarios (CAP-1):** [CAP-28](#cap-28--diseñar-pantallas-de-registro-y-confirmación-de-cuenta), [CAP-29](#cap-29--api-de-registro-validaciones-y-correo-de-confirmación), [CAP-30](#cap-30--pruebas-de-los-criterios-de-aceptación)
- **HU-02 Crear evento (CAP-2):** [CAP-31](#cap-31--modelo-de-datos-de-eventos), [CAP-32](#cap-32--formulario-de-creación-y-edición-de-evento), [CAP-33](#cap-33--api-para-guardar-borrador-publicar-y-validar-fechas), [CAP-34](#cap-34--catálogo-de-eventos-publicados), [CAP-35](#cap-35--pruebas-de-los-criterios-de-aceptación)
- **HU-03 Inscripción a evento (CAP-3):** [CAP-36](#cap-36--modelo-de-datos-de-inscripciones-y-cupos), [CAP-37](#cap-37--api-de-inscripción-y-descuento-de-cupos), [CAP-38](#cap-38--pantalla-de-inscripción-y-confirmación), [CAP-39](#cap-39--correo-de-confirmación-de-inscripción), [CAP-40](#cap-40--pruebas-de-los-criterios-de-aceptación)
- **HU-05 Control de cupos (CAP-4):** [CAP-41](#cap-41--api-de-límite-de-cupo-y-bloqueo-de-inscripciones), [CAP-42](#cap-42--lista-de-espera-y-notificación-de-cupo-liberado), [CAP-43](#cap-43--pruebas-de-los-criterios-de-aceptación)
- **HU-04 Pago en línea (CAP-5):** [CAP-44](#cap-44--integración-con-yape-plin-y-paypal), [CAP-45](#cap-45--pantalla-de-pago-y-comprobante), [CAP-46](#cap-46--pruebas-de-los-criterios-de-aceptación)
- **HU-07 Registro de asistencia con QR (CAP-6):** [CAP-47](#cap-47--generación-de-código-qr-por-inscripción), [CAP-48](#cap-48--pantalla-de-escaneo-y-registro-de-asistencia), [CAP-49](#cap-49--pruebas-de-los-criterios-de-aceptación)
- **HU-08 Emisión de certificados digitales (CAP-7):** [CAP-50](#cap-50--generación-del-certificado-en-pdf), [CAP-51](#cap-51--regla-de-asistencia-mínima-y-revocación), [CAP-52](#cap-52--pruebas-de-los-criterios-de-aceptación)
- **HU-09 Verificación de certificados (CAP-8):** [CAP-53](#cap-53--página-pública-de-verificación-de-certificados), [CAP-54](#cap-54--api-de-verificación-y-límite-de-intentos), [CAP-55](#cap-55--pruebas-de-los-criterios-de-aceptación)
- **HU-06 Recordatorios automáticos (CAP-9):** [CAP-56](#cap-56--programación-de-recordatorios-automáticos), [CAP-57](#cap-57--plantilla-del-mensaje-y-opción-de-desactivar), [CAP-58](#cap-58--pruebas-de-los-criterios-de-aceptación)
- **HU-10 Reportes de participación (CAP-10):** [CAP-59](#cap-59--consultas-de-métricas-de-participación), [CAP-60](#cap-60--panel-de-métricas-en-tiempo-real-y-filtros), [CAP-61](#cap-61--exportación-de-reportes-a-excel-y-pdf)
- **HU-12 Eventos virtuales (CAP-11):** [CAP-62](#cap-62--campo-de-enlace-y-validación-de-plataformas), [CAP-63](#cap-63--visibilidad-del-enlace-solo-para-inscritos-confirmados), [CAP-64](#cap-64--pruebas-de-los-criterios-de-aceptación)
- **HU-11 Gestión de ponentes y programa (CAP-12):** [CAP-65](#cap-65--registro-de-ponentes-y-asignación-a-sesiones), [CAP-66](#cap-66--cronograma-del-evento-y-aviso-de-cambios), [CAP-67](#cap-67--pruebas-de-los-criterios-de-aceptación)
- **HU-13 Panel de administración (CAP-13):** [CAP-68](#cap-68--gestión-de-instituciones-y-usuarios), [CAP-69](#cap-69--planes-con-límites-de-eventos-y-usuarios), [CAP-70](#cap-70--historial-de-acciones-del-administrador), [CAP-71](#cap-71--pruebas-de-los-criterios-de-aceptación)
- **HU-14 Encuesta de satisfacción (CAP-14):** [CAP-72](#cap-72--envío-automático-de-la-encuesta-al-finalizar-el-evento), [CAP-73](#cap-73--resultados-de-la-encuesta-y-modo-anónimo), [CAP-74](#cap-74--pruebas-de-los-criterios-de-aceptación)
- [Tablas de casos de prueba](#tablas-de-casos-de-prueba)

## HU-01 · Registro de usuarios (CAP-1)

### CAP-28 · Diseñar pantallas de registro y confirmación de cuenta

**Responsable:** Medaly

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Captura del formulario de registro | App → `/registro` (sin iniciar sesión) | Abre la página y captura el formulario completo. |
| Captura del mensaje de error de validación | App → `/registro` | Pulsa «Crear cuenta» con el formulario vacío: los campos se resaltan con su mensaje. |
| Captura de la pantalla de cuenta confirmada | App → `/registro` → «Abrir el buzón de demostración» → correo «Confirma tu cuenta» → «Confirmar mi cuenta» | Regístrate con un correo nuevo y abre el enlace del correo: aparece «Cuenta activada». |
| Enlace al prototipo | No hay Figma: las pantallas están construidas en la app | Pega el enlace de la app desplegada (Vercel) apuntando a `/registro`. |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-28
- Qué hice: Pantallas de registro (rol, datos, contraseña con requisitos en vivo y política de privacidad), confirmación de cuenta y mensajes de error.
- Archivos / rama / commit: src/pages/Cuenta.tsx (componentes Registro y Confirmar); src/components/ui.tsx (campos, botones y avisos) (rama main, commit <hash>)
- Evidencia: Captura del formulario de registro; Captura del mensaje de error de validación; Captura de la pantalla de cuenta confirmada; Enlace al prototipo.
- Cómo probarlo: Registrar una cuenta nueva, abrir el buzón de demostración y confirmarla.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-29 · API de registro, validaciones y correo de confirmación

**Responsable:** Carlos

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Código del endpoint y de las validaciones | [`supabase/migrations/20261005000002_funciones_base.sql`](../supabase/migrations/20261005000002_funciones_base.sql), función `public.registrar_usuario` | Enlace al archivo en GitHub y fragmento de las validaciones (bloque `if v_correo !~ ...`, `capa.password_valida`, `CORREO_EXISTE`). |
| Captura de Postman: registro exitoso | [`docs/postman/CAPACITRON.postman_collection.json`](../docs/postman/CAPACITRON.postman_collection.json), carpeta «CAP-29 · Registro» → «Registro exitoso» | Importa la colección en Postman, completa `url` y `apikey` y envía. Respuesta 200 `{"ok": true}`. La API devuelve 200/400 (convención de Supabase), no 201/409. |
| Captura de Postman: correo duplicado | Misma carpeta → «Correo duplicado» | Respuesta 400 con `"hint": "CORREO_EXISTE"`. |
| Captura del correo de confirmación recibido | App → `/correo-demo?para=<correo>` (pie de página → «Buzón de demostración») | Abre el correo «Confirma tu cuenta en CAPACITRON». |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-29
- Qué hice: Funciones `registrar_usuario` (correo único, contraseña de 8+ caracteres con letras y números, aceptación de privacidad, contraseña cifrada con bcrypt), `confirmar_cuenta` (enlace de 24 h) e `iniciar_sesion` (bloqueo de 15 min tras 5 intentos).
- Archivos / rama / commit: supabase/migrations/20261005000002_funciones_base.sql (funciones public.registrar_usuario, public.confirmar_cuenta, public.iniciar_sesion); supabase/migrations/20261005000001_esquema.sql (tablas usuarios y tokens_confirmacion) (rama main, commit <hash>)
- Evidencia: Código del endpoint y de las validaciones; Captura de Postman: registro exitoso; Captura de Postman: correo duplicado; Captura del correo de confirmación recibido.
- Cómo probarlo: Postman, carpeta CAP-29, o `npm test` (pruebas de HU-01).
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-30 · Pruebas de los criterios de aceptación

**Responsable:** Sin asignar

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Tabla de casos de prueba de HU-01 | Esta guía, sección «Tablas de casos de prueba» → HU-01 | Copia la tabla al comentario de Jira. |
| Captura de un caso exitoso | App → cuenta confirmada (ver CAP-28) | Nombre sugerido `CAP-30_exito-cuenta-confirmada.png`. |
| Captura de un caso fallido | App → `/registro` con un correo ya registrado, o `/ingresar` con 5 contraseñas incorrectas | `CAP-30_fallo-correo-duplicado.png` o `CAP-30_bloqueo-5-intentos.png`. |

Tabla lista: [Tablas de casos de prueba → HU-01](#hu-01-registro-de-usuarios).

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-30
- Qué hice: ejecuté y documenté las pruebas de los 5 criterios de aceptación de HU-01 (Registro de usuarios).
- Archivos / rama / commit: tests/hu01-02-cuentas-eventos.test.ts (rama main, commit <hash>)
- Evidencia: tabla de casos adjunta; capturas de un caso exitoso y uno fallido.
- Cómo probarlo: npm test, o seguir los pasos de cada caso en la app.
- Pendiente / bloqueos: ninguno.
```

</details>

## HU-02 · Crear evento (CAP-2)

### CAP-31 · Modelo de datos de eventos

**Responsable:** George

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Script SQL de creación de las tablas de eventos | [`supabase/migrations/20261005000001_esquema.sql`](../supabase/migrations/20261005000001_esquema.sql), bloque `create table capa.eventos` | Adjunta el archivo o pega el bloque. |
| Diagrama entidad-relación (PNG) | [`docs/diagramas.md`](../docs/diagramas.md), sección 1 | Pega el bloque Mermaid en mermaid.live y exporta el PNG. |
| Captura de las tablas creadas en el gestor de BD | Supabase → Table Editor → esquema `capa` (o SQL Editor: `select * from capa.eventos`) | Captura la tabla `eventos` con sus columnas. |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-31
- Qué hice: Tabla `capa.eventos` con claves, restricciones (fecha_fin > fecha_inicio, cupo > 0, costo ≥ 0, porcentaje 1–100, modalidad y estado con CHECK) y relaciones con usuarios e instituciones.
- Archivos / rama / commit: supabase/migrations/20261005000001_esquema.sql (sección «Eventos, ponentes y programa»); docs/diagramas.md (diagrama entidad-relación) (rama main, commit <hash>)
- Evidencia: Script SQL de creación de las tablas de eventos; Diagrama entidad-relación (PNG); Captura de las tablas creadas en el gestor de BD.
- Cómo probarlo: Ejecutar la migración en el SQL Editor de Supabase.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-32 · Formulario de creación y edición de evento

**Responsable:** Medaly

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Captura del formulario vacío | App → ingresar como `coordinacion@capacitron.demo` → «Mis eventos» → «Crear evento» (`/organizador/eventos/nuevo`) | Captura la página completa. |
| Captura con errores de validación | Mismo formulario | Pulsa «Publicar evento» vacío: se resaltan los campos obligatorios. |
| Captura con el evento guardado | Mismo formulario | Completa los datos y pulsa «Guardar borrador»: se abre la gestión del evento. |
| Código del componente | [`src/pages/organizador/EditorEvento.tsx`](../src/pages/organizador/EditorEvento.tsx) | Enlace al commit. |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-32
- Qué hice: Formulario de evento con modalidad, lugar, fechas en hora de Perú, cupos, costo, horas y datos del certificado; validación en el navegador y en el servidor; borrador o publicación.
- Archivos / rama / commit: src/pages/organizador/EditorEvento.tsx (rama main, commit <hash>)
- Evidencia: Captura del formulario vacío; Captura con errores de validación; Captura con el evento guardado; Código del componente.
- Cómo probarlo: Crear un evento como organizador.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-33 · API para guardar borrador, publicar y validar fechas

**Responsable:** George

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Código de los endpoints (borrador, publicar, editar) | [`supabase/migrations/20261005000002_funciones_base.sql`](../supabase/migrations/20261005000002_funciones_base.sql), funciones `public.guardar_evento` y `public.publicar_evento` | Enlace al archivo y fragmento de la validación de fechas. |
| Captura de Postman: borrador guardado | [`docs/postman/CAPACITRON.postman_collection.json`](../docs/postman/CAPACITRON.postman_collection.json), carpeta «CAP-33» → «Guardar borrador» | Antes ejecuta «0. Sesiones → Ingresar como organizador». |
| Captura de Postman: evento publicado | Misma carpeta → «Publicar» | `evento.estado = "publicado"`. |
| Captura de Postman: fin anterior al inicio | Misma carpeta → «Error: fin anterior al inicio» | Respuesta 400 con `campos: ["fecha_fin"]`. |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-33
- Qué hice: Funciones `guardar_evento` (crear o editar, validaciones, límites del plan, aviso a inscritos si cambia fecha o lugar), `publicar_evento` (impide fechas pasadas) y `cancelar_evento` / `eliminar_evento`.
- Archivos / rama / commit: supabase/migrations/20261005000002_funciones_base.sql (public.guardar_evento, capa.publicar, public.publicar_evento, public.cancelar_evento) (rama main, commit <hash>)
- Evidencia: Código de los endpoints (borrador, publicar, editar); Captura de Postman: borrador guardado; Captura de Postman: evento publicado; Captura de Postman: fin anterior al inicio.
- Cómo probarlo: Postman, carpeta CAP-33.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-34 · Catálogo de eventos publicados

**Responsable:** Sin asignar

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Captura del listado de eventos publicados | App → `/` (Eventos) | Página completa. |
| Captura del filtro o la búsqueda | App → `/` | Escribe «agua» en el buscador o elige «Virtual». |
| Captura: un borrador no aparece en el catálogo | App → `/`, buscar «Metodologías» | El borrador «Jornada de Metodologías Ágiles» no aparece. Complementa con «Mis eventos → Borradores» de `coordinacion@capacitron.demo`. |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-34
- Qué hice: Catálogo público agrupado en «En curso», «Próximos» y «Finalizados», con búsqueda, filtros de modalidad y precio, y banda de cupos por evento.
- Archivos / rama / commit: src/pages/Catalogo.tsx; supabase/migrations/20261005000002_funciones_base.sql (public.catalogo_eventos) (rama main, commit <hash>)
- Evidencia: Captura del listado de eventos publicados; Captura del filtro o la búsqueda; Captura: un borrador no aparece en el catálogo.
- Cómo probarlo: Abrir la portada sin iniciar sesión.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-35 · Pruebas de los criterios de aceptación

**Responsable:** Sin asignar

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Tabla de casos de prueba de HU-02 | Esta guía → «Tablas de casos de prueba» → HU-02 |  |
| Capturas | App → `/organizador/eventos/nuevo` | Éxito: evento publicado en el catálogo. Fallo: fecha de fin anterior al inicio, o publicar un borrador con fecha pasada. |

Tabla lista: [Tablas de casos de prueba → HU-02](#hu-02-crear-evento).

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-35
- Qué hice: ejecuté y documenté las pruebas de los 5 criterios de aceptación de HU-02 (Crear evento).
- Archivos / rama / commit: tests/hu01-02-cuentas-eventos.test.ts (rama main, commit <hash>)
- Evidencia: tabla de casos adjunta; capturas de un caso exitoso y uno fallido.
- Cómo probarlo: npm test, o seguir los pasos de cada caso en la app.
- Pendiente / bloqueos: ninguno.
```

</details>

## HU-03 · Inscripción a evento (CAP-3)

### CAP-36 · Modelo de datos de inscripciones y cupos

**Responsable:** Carlos

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Script SQL de las tablas de inscripciones y cupos | [`supabase/migrations/20261005000001_esquema.sql`](../supabase/migrations/20261005000001_esquema.sql), `create table capa.inscripciones` y `capa.lista_espera` |  |
| Diagrama entidad-relación actualizado | [`docs/diagramas.md`](../docs/diagramas.md), sección 1 | Exporta el PNG desde mermaid.live. |
| Captura de un SELECT con datos de prueba | Supabase → SQL Editor | Ejecuta: `select e.nombre, e.cupo_maximo, capa.cupos_ocupados(e.id) as ocupados, count(i.*) filter (where i.estado = 'confirmada') as confirmadas from capa.eventos e left join capa.inscripciones i on i.evento_id = e.id group by e.id;` |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-36
- Qué hice: Tablas `capa.inscripciones` (estado, código QR único, reserva de 30 min; índice único que impide dos inscripciones vigentes al mismo evento) y `capa.lista_espera`; función `capa.cupos_ocupados`.
- Archivos / rama / commit: supabase/migrations/20261005000001_esquema.sql (sección «Inscripciones, lista de espera y pagos»); supabase/migrations/20261005000002_funciones_base.sql (capa.cupos_ocupados); docs/diagramas.md (rama main, commit <hash>)
- Evidencia: Script SQL de las tablas de inscripciones y cupos; Diagrama entidad-relación actualizado; Captura de un SELECT con datos de prueba.
- Cómo probarlo: Consulta en el SQL Editor.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-37 · API de inscripción y descuento de cupos

**Responsable:** George

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Código del endpoint y del descuento de cupo | [`supabase/migrations/20261005000002_funciones_base.sql`](../supabase/migrations/20261005000002_funciones_base.sql), `public.inscribirse` y `capa.cupos_ocupados` | Fragmento clave: `select ... for update` y la comparación con `cupo_maximo`. |
| Captura de Postman: inscripción exitosa | [`docs/postman/CAPACITRON.postman_collection.json`](../docs/postman/CAPACITRON.postman_collection.json), carpeta «CAP-37 / CAP-41» → «Inscripción exitosa» | Requiere ejecutar antes la carpeta CAP-33 (crea un evento con cupo 1). |
| Captura de Postman: doble inscripción rechazada | Misma carpeta → «Doble inscripción rechazada» | `motivo: "ya_inscrito"`. |
| Captura de Postman: evento sin cupo | Misma carpeta → «Evento sin cupo: bloqueado» | `motivo: "sin_cupos"`. |
| Captura del cupo antes y después en la BD | Supabase → SQL Editor | Ejecuta `select capa.cupos_ocupados('<evento_id>')` antes y después de la inscripción. |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-37
- Qué hice: Función `inscribirse`: bloquea la fila del evento (evita sobrecupo con solicitudes simultáneas), rechaza la doble inscripción, confirma (gratis) o reserva 30 min (de pago), envía el correo y descuenta el cupo.
- Archivos / rama / commit: supabase/migrations/20261005000002_funciones_base.sql (public.inscribirse, capa.crear_inscripcion, capa.cupos_ocupados) (rama main, commit <hash>)
- Evidencia: Código del endpoint y del descuento de cupo; Captura de Postman: inscripción exitosa; Captura de Postman: doble inscripción rechazada; Captura de Postman: evento sin cupo; Captura del cupo antes y después en la BD.
- Cómo probarlo: Postman, carpetas CAP-33 y CAP-37 en orden.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-38 · Pantalla de inscripción y confirmación

**Responsable:** Sin asignar

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Captura del botón de inscripción | App → ingresar como `estudiante@capacitron.demo` → «Curso: Desarrollo web con React y Supabase» |  |
| Captura de la confirmación | Mismo evento → «Inscribirme» → «Reservar mi cupo» | Aparece «Cupo reservado: falta el pago». En un evento gratis: «Inscripción confirmada». |
| Captura del mensaje de error | App → «Conversatorio: Gestión del agua…» (lleno) | Muestra «Sin cupos libres» y el botón de lista de espera. |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-38
- Qué hice: Panel lateral del evento con la acción principal según el estado de la persona (inscribirse, pagar, lista de espera, ver QR), diálogo para confirmar los datos y confirmación en pantalla.
- Archivos / rama / commit: src/pages/EventoDetalle.tsx (componente PanelAccion) (rama main, commit <hash>)
- Evidencia: Captura del botón de inscripción; Captura de la confirmación; Captura del mensaje de error.
- Cómo probarlo: Inscribirse con la cuenta de la estudiante.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-39 · Correo de confirmación de inscripción

**Responsable:** Carlos

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Captura del correo recibido | App → ingresar como `estudiante@capacitron.demo` → campana (Bandeja, `/bandeja`) | Abre «Inscripción confirmada: …». |
| Plantilla | [`supabase/migrations/20261005000002_funciones_base.sql`](../supabase/migrations/20261005000002_funciones_base.sql), función `capa.crear_inscripcion` | Fragmento del texto del correo. |
| Código del envío | [`supabase/migrations/20261005000002_funciones_base.sql`](../supabase/migrations/20261005000002_funciones_base.sql), `capa.enviar_correo` | Los correos son simulados: se guardan en `capa.correos` y se leen en la Bandeja. |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-39
- Qué hice: Correo automático con nombre, fechas, modalidad y lugar del evento al registrar la inscripción (y aviso de pago pendiente en eventos de pago).
- Archivos / rama / commit: supabase/migrations/20261005000002_funciones_base.sql (capa.crear_inscripcion, capa.datos_evento_texto, capa.enviar_correo); src/components/Buzon.tsx (rama main, commit <hash>)
- Evidencia: Captura del correo recibido; Plantilla; Código del envío.
- Cómo probarlo: Inscribirse en un evento y abrir la Bandeja.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-40 · Pruebas de los criterios de aceptación

**Responsable:** Medaly

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Tabla de casos de prueba de HU-03 | Esta guía → «Tablas de casos de prueba» → HU-03 |  |
| Capturas | App, ver CAP-38 | Éxito: inscripción registrada. Fallo: evento lleno, o volver a inscribirse. |

Tabla lista: [Tablas de casos de prueba → HU-03](#hu-03-inscripción-a-evento).

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-40
- Qué hice: ejecuté y documenté las pruebas de los 5 criterios de aceptación de HU-03 (Inscripción a evento).
- Archivos / rama / commit: tests/hu03-05-inscripcion-pagos-cupos.test.ts (rama main, commit <hash>)
- Evidencia: tabla de casos adjunta; capturas de un caso exitoso y uno fallido.
- Cómo probarlo: npm test, o seguir los pasos de cada caso en la app.
- Pendiente / bloqueos: ninguno.
```

</details>

## HU-05 · Control de cupos (CAP-4)

### CAP-41 · API de límite de cupo y bloqueo de inscripciones

**Responsable:** Carlos

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Código de la validación de cupo | [`supabase/migrations/20261005000002_funciones_base.sql`](../supabase/migrations/20261005000002_funciones_base.sql), `public.inscribirse` (bloque `if capa.cupos_ocupados(e.id) >= e.cupo_maximo`) |  |
| Captura de Postman: inscripción rechazada con el cupo lleno | [`docs/postman/CAPACITRON.postman_collection.json`](../docs/postman/CAPACITRON.postman_collection.json), carpeta «CAP-37 / CAP-41» → «Evento sin cupo: bloqueado» |  |
| Script SQL (si se modificó la BD) | No se modificó: el cupo se calcula con `capa.cupos_ocupados` | Indícalo en el comentario. |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-41
- Qué hice: Validación de cupo dentro de `inscribirse` con bloqueo de fila; con el cupo lleno se ofrece la lista de espera (o se agrega automáticamente si la pantalla mostraba cupo libre).
- Archivos / rama / commit: supabase/migrations/20261005000002_funciones_base.sql (public.inscribirse, public.unirse_lista_espera) (rama main, commit <hash>)
- Evidencia: Código de la validación de cupo; Captura de Postman: inscripción rechazada con el cupo lleno; Script SQL (si se modificó la BD).
- Cómo probarlo: Postman o `npm test` (HU-05).
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-42 · Lista de espera y notificación de cupo liberado

**Responsable:** George

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Script SQL de la tabla de lista de espera | [`supabase/migrations/20261005000001_esquema.sql`](../supabase/migrations/20261005000001_esquema.sql), `create table capa.lista_espera` |  |
| Código de la promoción al liberarse un cupo | [`supabase/migrations/20261005000002_funciones_base.sql`](../supabase/migrations/20261005000002_funciones_base.sql), `capa.procesar_lista_espera` |  |
| Captura del correo de notificación | App → ingresar como `diego.mamani@capacitron.demo` → Mis inscripciones → «Conversatorio…» → «Cancelar inscripción»; luego ingresar como `bruno.vargas@capacitron.demo` → Bandeja | Correo «Se liberó un cupo en Conversatorio…». |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-42
- Qué hice: Tabla `capa.lista_espera` ordenada por fecha de solicitud; al liberarse un cupo se ofrece al primero (24 h para confirmar) y, si no confirma, pasa al siguiente.
- Archivos / rama / commit: supabase/migrations/20261005000001_esquema.sql (create table capa.lista_espera); supabase/migrations/20261005000002_funciones_base.sql (capa.procesar_lista_espera, public.aceptar_oferta_espera); supabase/migrations/20261005000003_funciones_operacion.sql (capa.procesar_tareas_internas, paso 2) (rama main, commit <hash>)
- Evidencia: Script SQL de la tabla de lista de espera; Código de la promoción al liberarse un cupo; Captura del correo de notificación.
- Cómo probarlo: Cancelar una inscripción en un evento lleno.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-43 · Pruebas de los criterios de aceptación

**Responsable:** Medaly

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Tabla de casos de prueba de HU-05 | Esta guía → «Tablas de casos de prueba» → HU-05 |  |
| Capturas | App | Cupo lleno: «Conversatorio…». Cupo liberado: correo de CAP-42. Lista de espera: gestión del «Conversatorio» como `coordinacion@capacitron.demo` (cupos, ocupados, disponibles y en espera). |

Tabla lista: [Tablas de casos de prueba → HU-05](#hu-05-control-de-cupos).

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-43
- Qué hice: ejecuté y documenté las pruebas de los 5 criterios de aceptación de HU-05 (Control de cupos).
- Archivos / rama / commit: tests/hu03-05-inscripcion-pagos-cupos.test.ts (rama main, commit <hash>)
- Evidencia: tabla de casos adjunta; capturas de un caso exitoso y uno fallido.
- Cómo probarlo: npm test, o seguir los pasos de cada caso en la app.
- Pendiente / bloqueos: ninguno.
```

</details>

## HU-04 · Pago en línea (CAP-5)

### CAP-44 · Integración con Yape, Plin y PayPal

**Responsable:** George

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Código de la integración o simulación | [`supabase/migrations/20261005000002_funciones_base.sql`](../supabase/migrations/20261005000002_funciones_base.sql) (`public.iniciar_pago`, `public.respuesta_pasarela`) y [`supabase/migrations/20261005000006_endurecimiento.sql`](../supabase/migrations/20261005000006_endurecimiento.sql) |  |
| Captura de una transacción aprobada y otra rechazada | [`docs/postman/CAPACITRON.postman_collection.json`](../docs/postman/CAPACITRON.postman_collection.json), carpeta «CAP-44 · Pago» | O en la app: Mis inscripciones → Pagar → simulador «Rechazar» y luego «Aprobar». |
| Diagrama de secuencia del pago | [`docs/diagramas.md`](../docs/diagramas.md), sección 2 | Exporta el PNG desde mermaid.live. |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-44
- Qué hice: Flujo de pago con reserva de 30 minutos, intento por medio de pago, respuesta de la pasarela (aprobado, rechazado, sin respuesta), comprobante numerado y registro de cada transacción. La pasarela es simulada y solo funciona en modo demostración.
- Archivos / rama / commit: supabase/migrations/20261005000002_funciones_base.sql (public.iniciar_pago, respuesta de pasarela, public.comprobante_pago); supabase/migrations/20261005000006_endurecimiento.sql (protección de la pasarela simulada); docs/diagramas.md (diagrama de secuencia) (rama main, commit <hash>)
- Evidencia: Código de la integración o simulación; Captura de una transacción aprobada y otra rechazada; Diagrama de secuencia del pago.
- Cómo probarlo: Postman, carpeta CAP-44, o la pasarela de la app.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-45 · Pantalla de pago y comprobante

**Responsable:** Medaly

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Captura de la selección de método de pago | App → ingresar como `estudiante@capacitron.demo` → inscribirse en el «Curso: Desarrollo web…» → Mis inscripciones → «Pagar S/ 80.00» |  |
| Captura del pago exitoso | Mismo diálogo, simulador «Aprobar» |  |
| Captura del error de pago | Mismo diálogo, simulador «Rechazar» o «No responder» |  |
| PDF del comprobante | Tras el pago → «Descargar comprobante» | Adjunta el PDF. |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-45
- Qué hice: Diálogo de pago con selección de Yape, Plin o PayPal, tiempo restante de la reserva, resultado del cobro con opción de reintentar y comprobante PDF descargable.
- Archivos / rama / commit: src/pages/MisInscripciones.tsx (componente Pasarela); src/lib/pdf.ts (pdfComprobante) (rama main, commit <hash>)
- Evidencia: Captura de la selección de método de pago; Captura del pago exitoso; Captura del error de pago; PDF del comprobante.
- Cómo probarlo: Pagar una inscripción con el simulador.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-46 · Pruebas de los criterios de aceptación

**Responsable:** Sin asignar (propuesto: José)

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Tabla de casos de prueba de HU-04 | Esta guía → «Tablas de casos de prueba» → HU-04 |  |
| Capturas | App, ver CAP-45 | Pago exitoso, pago fallido y comprobante. |

Tabla lista: [Tablas de casos de prueba → HU-04](#hu-04-pago-en-línea).

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-46
- Qué hice: ejecuté y documenté las pruebas de los 5 criterios de aceptación de HU-04 (Pago en línea).
- Archivos / rama / commit: tests/hu03-05-inscripcion-pagos-cupos.test.ts (rama main, commit <hash>)
- Evidencia: tabla de casos adjunta; capturas de un caso exitoso y uno fallido.
- Cómo probarlo: npm test, o seguir los pasos de cada caso en la app.
- Pendiente / bloqueos: ninguno.
```

</details>

## HU-07 · Registro de asistencia con QR (CAP-6)

### CAP-47 · Generación de código QR por inscripción

**Responsable:** Carlos

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Código del generador de QR | [`src/components/qr.tsx`](../src/components/qr.tsx), componente `ImagenQr` |  |
| Captura del QR generado | App → ingresar como `estudiante@capacitron.demo` → Mis inscripciones → «Seminario…» → «Ver código QR» |  |
| Captura del QR dentro de la confirmación | Mis inscripciones (tarjeta de la inscripción confirmada con el botón «Ver código QR») |  |
| Script SQL del token del QR | [`supabase/migrations/20261005000001_esquema.sql`](../supabase/migrations/20261005000001_esquema.sql), `codigo_qr text not null unique default encode(extensions.gen_random_bytes(16), 'hex')` |  |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-47
- Qué hice: Cada inscripción tiene un código aleatorio de 128 bits (sin datos personales) que se muestra como QR al confirmarse; el código también se puede dictar si falla la cámara.
- Archivos / rama / commit: supabase/migrations/20261005000001_esquema.sql (columna capa.inscripciones.codigo_qr); src/components/qr.tsx (ImagenQr); src/pages/MisInscripciones.tsx (DialogoQr) (rama main, commit <hash>)
- Evidencia: Código del generador de QR; Captura del QR generado; Captura del QR dentro de la confirmación; Script SQL del token del QR.
- Cómo probarlo: Abrir el QR de una inscripción confirmada.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-48 · Pantalla de escaneo y registro de asistencia

**Responsable:** Medaly

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Captura de la pantalla de escaneo | App → ingresar como `coordinacion@capacitron.demo` → Mis eventos → «Seminario…» (en curso) → pestaña «Asistencia» | La cámara funciona en HTTPS (Vercel) o en localhost. |
| Captura de la asistencia registrada | Misma pestaña | Escanea el QR de `estudiante@capacitron.demo` o escribe su código (lo muestra el diálogo del QR). |
| Captura del QR inválido o repetido | Misma pestaña | Registra el mismo código otra vez («Ya había ingresado») o uno inventado («Código rechazado»). |
| Captura de la tabla de asistencias en la BD | Supabase → SQL Editor | `select * from capa.asistencias order by registrado_en desc limit 20;` |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-48
- Qué hice: Pestaña de asistencia con lector de QR por cámara, ingreso manual del código, resultado del escaneo y lista en vivo de ingresos por jornada.
- Archivos / rama / commit: src/pages/organizador/gestion/Asistencia.tsx; src/components/qr.tsx (EscanerQr); supabase/migrations/20261005000003_funciones_operacion.sql (public.registrar_asistencia, public.asistencia_evento) (rama main, commit <hash>)
- Evidencia: Captura de la pantalla de escaneo; Captura de la asistencia registrada; Captura del QR inválido o repetido; Captura de la tabla de asistencias en la BD.
- Cómo probarlo: Registrar la asistencia de la estudiante en el seminario en curso.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-49 · Pruebas de los criterios de aceptación

**Responsable:** Sin asignar (propuesto: Andree)

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Tabla de casos de prueba de HU-07 | Esta guía → «Tablas de casos de prueba» → HU-07 |  |
| Capturas | App, ver CAP-48 | Éxito: asistencia registrada. Fallo: QR repetido o inválido. |

Tabla lista: [Tablas de casos de prueba → HU-07](#hu-07-registro-de-asistencia-con-qr).

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-49
- Qué hice: ejecuté y documenté las pruebas de los 5 criterios de aceptación de HU-07 (Registro de asistencia con QR).
- Archivos / rama / commit: tests/hu06-09-recordatorios-qr-certificados.test.ts (rama main, commit <hash>)
- Evidencia: tabla de casos adjunta; capturas de un caso exitoso y uno fallido.
- Cómo probarlo: npm test, o seguir los pasos de cada caso en la app.
- Pendiente / bloqueos: ninguno.
```

</details>

## HU-08 · Emisión de certificados digitales (CAP-7)

### CAP-50 · Generación del certificado en PDF

**Responsable:** George

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Código del generador de PDF | [`src/lib/pdf.ts`](../src/lib/pdf.ts), función `pdfCertificado` |  |
| PDF de ejemplo | App → ingresar como `estudiante@capacitron.demo` → Mis inscripciones → pestaña «Historial» → «Taller de Ingeniería de Requisitos…» → «Descargar certificado» | Adjunta el PDF: nombre, evento, fecha y código de verificación. |
| Captura del botón de descarga | Misma pantalla |  |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-50
- Qué hice: Certificado PDF horizontal con titular, evento, fechas, horas, asistencia, firma del organizador y QR de verificación con código único.
- Archivos / rama / commit: src/lib/pdf.ts (pdfCertificado); supabase/migrations/20261005000003_funciones_operacion.sql (capa.emitir_certificados, public.mi_certificado) (rama main, commit <hash>)
- Evidencia: Código del generador de PDF; PDF de ejemplo; Captura del botón de descarga.
- Cómo probarlo: Descargar el certificado del taller terminado.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-51 · Regla de asistencia mínima y revocación

**Responsable:** Carlos

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Código de la regla de asistencia mínima | [`supabase/migrations/20261005000003_funciones_operacion.sql`](../supabase/migrations/20261005000003_funciones_operacion.sql), `capa.emitir_certificados` (`if v_pct >= e.porcentaje_minimo`) |  |
| Captura: usuario con asistencia suficiente obtiene el certificado | App → `estudiante@capacitron.demo` → Mis inscripciones → Historial | Botón «Descargar certificado». |
| Captura: usuario sin asistencia suficiente es rechazado | App → `daniela.huarca@capacitron.demo` → Mis inscripciones → Historial → «Ver mi certificado» | «No eres elegible: asististe a 1 de 2 jornadas (50 %)…». |
| Captura de un certificado revocado | App → `coordinacion@capacitron.demo` → Mis eventos → «Finalizados» → «Taller…» → pestaña «Certificados» | El certificado de Renzo Apaza figura «Revocado» con su motivo. |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-51
- Qué hice: Al terminar el evento se emite el certificado solo a quien alcanzó el porcentaje mínimo de jornadas; quien no lo alcanzó ve el motivo. El organizador puede revocar con motivo registrado en el historial.
- Archivos / rama / commit: supabase/migrations/20261005000003_funciones_operacion.sql (capa.emitir_certificados, capa.porcentaje_asistencia, public.mi_certificado, public.revocar_certificado); src/pages/organizador/gestion/Certificados.tsx (rama main, commit <hash>)
- Evidencia: Código de la regla de asistencia mínima; Captura: usuario con asistencia suficiente obtiene el certificado; Captura: usuario sin asistencia suficiente es rechazado; Captura de un certificado revocado.
- Cómo probarlo: Postman, carpeta CAP-51, o las cuentas indicadas.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-52 · Pruebas de los criterios de aceptación

**Responsable:** Sin asignar (propuesto: José)

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Tabla de casos de prueba de HU-08 | Esta guía → «Tablas de casos de prueba» → HU-08 |  |
| Capturas | App, ver CAP-51 | Éxito: certificado descargado. Fallo: usuario no elegible. |

Tabla lista: [Tablas de casos de prueba → HU-08](#hu-08-emisión-de-certificados-digitales).

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-52
- Qué hice: ejecuté y documenté las pruebas de los 5 criterios de aceptación de HU-08 (Emisión de certificados digitales).
- Archivos / rama / commit: tests/hu06-09-recordatorios-qr-certificados.test.ts (rama main, commit <hash>)
- Evidencia: tabla de casos adjunta; capturas de un caso exitoso y uno fallido.
- Cómo probarlo: npm test, o seguir los pasos de cada caso en la app.
- Pendiente / bloqueos: ninguno.
```

</details>

## HU-09 · Verificación de certificados (CAP-8)

### CAP-53 · Página pública de verificación de certificados

**Responsable:** Medaly

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Captura: certificado válido | App → «Verificar certificado» (`/verificar`) con un código válido | Copia el código desde la pestaña «Certificados» del taller (CAP-51). |
| Captura: certificado inválido | `/verificar/CAP-ZZZZ-ZZZZ-ZZZZ` | «Certificado no encontrado». |
| Captura: certificado revocado | `/verificar/<código de Renzo Apaza>` | «Certificado inválido · revocado el …». |
| Enlace a la página en el entorno de pruebas | URL de Vercel + `/verificar` |  |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-53
- Qué hice: Página pública (sin cuenta) para verificar por código o escaneando el QR; muestra válido, inválido (revocado, con fecha) o no encontrado, con datos mínimos del titular.
- Archivos / rama / commit: src/pages/Verificar.tsx (rama main, commit <hash>)
- Evidencia: Captura: certificado válido; Captura: certificado inválido; Captura: certificado revocado; Enlace a la página en el entorno de pruebas.
- Cómo probarlo: Abrir /verificar sin iniciar sesión.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-54 · API de verificación y límite de intentos

**Responsable:** Carlos

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Código del endpoint y del límite de intentos | [`supabase/migrations/20261005000003_funciones_operacion.sql`](../supabase/migrations/20261005000003_funciones_operacion.sql), `public.verificar_certificado` |  |
| Captura de Postman: código válido | [`docs/postman/CAPACITRON.postman_collection.json`](../docs/postman/CAPACITRON.postman_collection.json), carpeta «CAP-54» → «Código válido» | Usa el código guardado por la carpeta CAP-51. |
| Captura de Postman: código inexistente | Misma carpeta → «Código inexistente» |  |
| Captura de Postman: bloqueo | Misma carpeta → «Bloqueo tras exceder intentos» | Después de enviar 5 veces el código inexistente. |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-54
- Qué hice: Función `verificar_certificado`: sin sesión, registra cada consulta y bloquea 15 minutos a quien acumula 5 códigos inexistentes en 10 minutos (por IP en Supabase).
- Archivos / rama / commit: supabase/migrations/20261005000003_funciones_operacion.sql (public.verificar_certificado); supabase/migrations/20261005000001_esquema.sql (tablas verificaciones y bloqueos_verificacion) (rama main, commit <hash>)
- Evidencia: Código del endpoint y del límite de intentos; Captura de Postman: código válido; Captura de Postman: código inexistente; Captura de Postman: bloqueo.
- Cómo probarlo: Postman, carpeta CAP-54.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-55 · Pruebas de los criterios de aceptación

**Responsable:** Sin asignar (propuesto: Andree)

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Tabla de casos de prueba de HU-09 | Esta guía → «Tablas de casos de prueba» → HU-09 |  |
| Capturas | App → `/verificar` | Éxito: válido. Fallo: no encontrado, o bloqueo tras 5 códigos inventados. |

Tabla lista: [Tablas de casos de prueba → HU-09](#hu-09-verificación-de-certificados).

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-55
- Qué hice: ejecuté y documenté las pruebas de los 5 criterios de aceptación de HU-09 (Verificación de certificados).
- Archivos / rama / commit: tests/hu06-09-recordatorios-qr-certificados.test.ts (rama main, commit <hash>)
- Evidencia: tabla de casos adjunta; capturas de un caso exitoso y uno fallido.
- Cómo probarlo: npm test, o seguir los pasos de cada caso en la app.
- Pendiente / bloqueos: ninguno.
```

</details>

## HU-06 · Recordatorios automáticos (CAP-9)

### CAP-56 · Programación de recordatorios automáticos

**Responsable:** George

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Código del job | [`supabase/migrations/20261005000003_funciones_operacion.sql`](../supabase/migrations/20261005000003_funciones_operacion.sql), `capa.procesar_tareas_internas` (paso 4) |  |
| Captura del log de ejecución | App → `admin@capacitron.demo` → Administración → pestaña «Sistema» | En modo demostración pulsa «+2 horas»: el aviso indica cuántos recordatorios se enviaron. En Supabase también: Database → Cron jobs → «capacitron-tareas» → historial. |
| Captura de un recordatorio recibido | Después de adelantar el reloj, ingresar como `estudiante@capacitron.demo` → Bandeja | Correo «Mañana: Webinar: Ciberseguridad…». |
| Configuración de la frecuencia | [`supabase/migrations/20261005000005_supabase.sql`](../supabase/migrations/20261005000005_supabase.sql): `cron.schedule('capacitron-tareas', '* * * * *', ...)` | Cada minuto. |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-56
- Qué hice: Tarea programada cada minuto (pg_cron en Supabase) que envía recordatorios 24 h y 1 h antes a inscripciones confirmadas con recordatorios activos; si cambia la fecha, se reprograman.
- Archivos / rama / commit: supabase/migrations/20261005000003_funciones_operacion.sql (capa.procesar_tareas_internas, paso 4); supabase/migrations/20261005000005_supabase.sql (cron.schedule); supabase/migrations/20261005000006_endurecimiento.sql (registro de la última ejecución); supabase/migrations/20261005000001_esquema.sql (tabla recordatorios_enviados) (rama main, commit <hash>)
- Evidencia: Código del job; Captura del log de ejecución; Captura de un recordatorio recibido; Configuración de la frecuencia.
- Cómo probarlo: Adelantar el reloj de demostración 2 horas y revisar la Bandeja.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-57 · Plantilla del mensaje y opción de desactivar

**Responsable:** Sin asignar (propuesto: José)

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Captura de la plantilla del recordatorio | Bandeja de la estudiante tras adelantar el reloj (ver CAP-56) |  |
| Captura de la opción de desactivar | App → menú de usuario → «Mi perfil» → «Recordatorios de eventos» |  |
| Captura del efecto | Desactiva los recordatorios de `diego.mamani@capacitron.demo`, adelanta el reloj y abre su Bandeja | No recibe el recordatorio; los demás inscritos sí. |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-57
- Qué hice: Plantilla del recordatorio con nombre, fecha, hora, modalidad, lugar o enlace y código QR; interruptor «Recordatorios de eventos» en Mi perfil.
- Archivos / rama / commit: supabase/migrations/20261005000003_funciones_operacion.sql (capa.procesar_tareas_internas, paso 4); supabase/migrations/20261005000002_funciones_base.sql (capa.datos_evento_texto); src/pages/Perfil.tsx (rama main, commit <hash>)
- Evidencia: Captura de la plantilla del recordatorio; Captura de la opción de desactivar; Captura del efecto.
- Cómo probarlo: Comparar la Bandeja de dos inscritos al webinar.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-58 · Pruebas de los criterios de aceptación

**Responsable:** Carlos

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Tabla de casos de prueba de HU-06 | Esta guía → «Tablas de casos de prueba» → HU-06 |  |
| Capturas | App, ver CAP-56 y CAP-57 | Éxito: recordatorio recibido. Fallo esperado: usuario con recordatorios desactivados no recibe nada. |

Tabla lista: [Tablas de casos de prueba → HU-06](#hu-06-recordatorios-automáticos).

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-58
- Qué hice: ejecuté y documenté las pruebas de los 5 criterios de aceptación de HU-06 (Recordatorios automáticos).
- Archivos / rama / commit: tests/hu06-09-recordatorios-qr-certificados.test.ts (rama main, commit <hash>)
- Evidencia: tabla de casos adjunta; capturas de un caso exitoso y uno fallido.
- Cómo probarlo: npm test, o seguir los pasos de cada caso en la app.
- Pendiente / bloqueos: ninguno.
```

</details>

## HU-10 · Reportes de participación (CAP-10)

### CAP-59 · Consultas de métricas de participación

**Responsable:** Sin asignar (propuesto: José)

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Archivo .sql con las consultas | [`supabase/consultas/metricas_participacion.sql`](../supabase/consultas/metricas_participacion.sql) | Adjunta el archivo. |
| Captura de los resultados | Supabase → SQL Editor | Ejecuta la consulta 1 sobre los datos de demostración. |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-59
- Qué hice: Consultas de inscritos, asistentes, porcentaje de asistencia, ingresos por medio de pago, asistencia por jornada y satisfacción.
- Archivos / rama / commit: supabase/consultas/metricas_participacion.sql; supabase/migrations/20261005000003_funciones_operacion.sql (public.reporte_participacion) (rama main, commit <hash>)
- Evidencia: Archivo .sql con las consultas; Captura de los resultados.
- Cómo probarlo: Ejecutar el archivo en el SQL Editor.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-60 · Panel de métricas en tiempo real y filtros

**Responsable:** Medaly

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Captura del panel sin filtros | App → `coordinacion@capacitron.demo` → «Reportes» (`/organizador/reportes`) |  |
| Captura con filtros por evento y por fecha | Mismo panel | Elige un evento y luego un rango de fechas. |
| Código del componente | [`src/pages/organizador/Reportes.tsx`](../src/pages/organizador/Reportes.tsx) |  |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-60
- Qué hice: Panel con inscritos, asistentes, porcentaje de asistencia, ingresos, certificados y lista de espera; gráficos por evento y por medio de pago; filtros por fechas, modalidad y evento; se actualiza solo (Supabase Realtime).
- Archivos / rama / commit: src/pages/organizador/Reportes.tsx; src/components/graficos.tsx; src/lib/backend/index.ts (suscribirActividad) (rama main, commit <hash>)
- Evidencia: Captura del panel sin filtros; Captura con filtros por evento y por fecha; Código del componente.
- Cómo probarlo: Abrir el panel en dos pestañas y registrar una asistencia: las cifras cambian sin recargar.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-61 · Exportación de reportes a Excel y PDF

**Responsable:** George

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Archivos de ejemplo (.xlsx y .pdf) | App → `coordinacion@capacitron.demo` → Reportes → botones «Excel» y «PDF» | Adjunta ambos archivos. |
| Código de la exportación | [`src/pages/organizador/Reportes.tsx`](../src/pages/organizador/Reportes.tsx) y [`src/lib/pdf.ts`](../src/lib/pdf.ts) |  |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-61
- Qué hice: Exportación del reporte filtrado a .xlsx y .pdf; requiere un plan que incluya exportación (Pro o Enterprise).
- Archivos / rama / commit: src/pages/organizador/Reportes.tsx (función excel); src/lib/pdf.ts (pdfReporte); supabase/migrations/20261005000003_funciones_operacion.sql (public.registrar_exportacion) (rama main, commit <hash>)
- Evidencia: Archivos de ejemplo (.xlsx y .pdf); Código de la exportación.
- Cómo probarlo: Descargar ambos formatos.
- Pendiente / bloqueos: ninguno.
```

</details>

## HU-12 · Eventos virtuales (CAP-11)

### CAP-62 · Campo de enlace y validación de plataformas

**Responsable:** Sin asignar (propuesto: José)

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Captura del campo de enlace | App → `coordinacion@capacitron.demo` → Mis eventos → «Webinar…» → pestaña «Enlace virtual» | El ponente lo ve en «Mis charlas» (`ponente@capacitron.demo`). |
| Captura de un enlace válido | Misma pestaña | Por ejemplo `https://meet.google.com/abc-defg-hij`. |
| Captura de un enlace rechazado | Misma pestaña | Por ejemplo `https://youtube.com/live/x`. |
| Código de la validación | [`supabase/migrations/20261005000002_funciones_base.sql`](../supabase/migrations/20261005000002_funciones_base.sql), función `capa.plataforma_enlace` |  |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-62
- Qué hice: Campo de enlace para eventos virtuales o mixtos que solo acepta salas de Zoom, Google Meet o Microsoft Teams con HTTPS.
- Archivos / rama / commit: src/pages/organizador/gestion/EnlaceVirtual.tsx; supabase/migrations/20261005000002_funciones_base.sql (capa.plataforma_enlace); supabase/migrations/20261005000003_funciones_operacion.sql (public.guardar_enlace_virtual) (rama main, commit <hash>)
- Evidencia: Captura del campo de enlace; Captura de un enlace válido; Captura de un enlace rechazado; Código de la validación.
- Cómo probarlo: Guardar un enlace válido y otro no admitido.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-63 · Visibilidad del enlace solo para inscritos confirmados

**Responsable:** George

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Captura: inscrito confirmado ve el enlace | App → `estudiante@capacitron.demo` → «Seminario…» (mixto) | «Entrar a la sala de Zoom». |
| Captura: usuario no inscrito sin acceso | App → `paola.nina@capacitron.demo` (o sin sesión) → «Seminario…» | «El enlace se muestra al confirmar tu inscripción». |
| Código de la restricción | [`supabase/migrations/20261005000002_funciones_base.sql`](../supabase/migrations/20261005000002_funciones_base.sql), `public.detalle_evento` | Línea `ve_enlace := es_org or es_ponente or ...`. |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-63
- Qué hice: El enlace solo se entrega a inscritos confirmados, al organizador y a los ponentes del evento; nunca a quien no está inscrito o tiene el pago pendiente.
- Archivos / rama / commit: supabase/migrations/20261005000002_funciones_base.sql (public.detalle_evento (variable ve_enlace)); supabase/migrations/20261005000003_funciones_operacion.sql (public.mis_inscripciones) (rama main, commit <hash>)
- Evidencia: Captura: inscrito confirmado ve el enlace; Captura: usuario no inscrito sin acceso; Código de la restricción.
- Cómo probarlo: Abrir el mismo evento con dos cuentas.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-64 · Pruebas de los criterios de aceptación

**Responsable:** Sin asignar (propuesto: Andree)

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Tabla de casos de prueba de HU-12 | Esta guía → «Tablas de casos de prueba» → HU-12 |  |
| Capturas | App, ver CAP-62 y CAP-63 | Éxito: enlace válido guardado. Fallo: enlace rechazado. |

Tabla lista: [Tablas de casos de prueba → HU-12](#hu-12-eventos-virtuales).

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-64
- Qué hice: ejecuté y documenté las pruebas de los 5 criterios de aceptación de HU-12 (Eventos virtuales).
- Archivos / rama / commit: tests/hu10-14-reportes-programa-admin-encuesta.test.ts (rama main, commit <hash>)
- Evidencia: tabla de casos adjunta; capturas de un caso exitoso y uno fallido.
- Cómo probarlo: npm test, o seguir los pasos de cada caso en la app.
- Pendiente / bloqueos: ninguno.
```

</details>

## HU-11 · Gestión de ponentes y programa (CAP-12)

### CAP-65 · Registro de ponentes y asignación a sesiones

**Responsable:** Medaly

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Captura del formulario de ponente | App → `coordinacion@capacitron.demo` → Mis eventos → un evento → pestaña «Programa» → «Agregar ponente» |  |
| Captura de la asignación a una sesión | Misma pestaña → «Agregar sesión» → marcar el ponente |  |
| Script SQL de las tablas de ponentes y sesiones | [`supabase/migrations/20261005000001_esquema.sql`](../supabase/migrations/20261005000001_esquema.sql), `capa.ponentes`, `capa.sesiones_programa`, `capa.sesion_ponentes` |  |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-65
- Qué hice: Registro de ponentes con foto (JPG, PNG o WebP de hasta 1 MB), biografía y consentimiento; sesiones con horario y uno o más ponentes.
- Archivos / rama / commit: src/pages/organizador/gestion/Programa.tsx; supabase/migrations/20261005000003_funciones_operacion.sql (public.guardar_ponente, public.guardar_sesion_programa); supabase/migrations/20261005000001_esquema.sql (tablas ponentes, sesiones_programa, sesion_ponentes) (rama main, commit <hash>)
- Evidencia: Captura del formulario de ponente; Captura de la asignación a una sesión; Script SQL de las tablas de ponentes y sesiones.
- Cómo probarlo: Agregar un ponente y una sesión.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-66 · Cronograma del evento y aviso de cambios

**Responsable:** George

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Captura del cronograma visible para el inscrito | App → `estudiante@capacitron.demo` → «Seminario…» → sección «Programa» |  |
| Captura del aviso por cambio de sesión | Como `coordinacion@capacitron.demo` agrega una sesión al «Webinar…»; luego `estudiante@capacitron.demo` → Bandeja | Correo «Se actualizó el programa de …». |
| Código del cronograma y del aviso | [`src/pages/EventoDetalle.tsx`](../src/pages/EventoDetalle.tsx) y [`supabase/migrations/20261005000003_funciones_operacion.sql`](../supabase/migrations/20261005000003_funciones_operacion.sql) (`capa.notificar_cambio_programa`) |  |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-66
- Qué hice: Cronograma ordenado por hora y agrupado por jornada en la página del evento; cada cambio del programa se avisa por correo a los inscritos.
- Archivos / rama / commit: src/pages/EventoDetalle.tsx (componente Programa); supabase/migrations/20261005000003_funciones_operacion.sql (capa.notificar_cambio_programa) (rama main, commit <hash>)
- Evidencia: Captura del cronograma visible para el inscrito; Captura del aviso por cambio de sesión; Código del cronograma y del aviso.
- Cómo probarlo: Modificar el programa de un evento con inscritos.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-67 · Pruebas de los criterios de aceptación

**Responsable:** Sin asignar (propuesto: José)

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Tabla de casos de prueba de HU-11 | Esta guía → «Tablas de casos de prueba» → HU-11 |  |
| Capturas | App → pestaña «Programa» | Éxito: cronograma ordenado. Fallo: aviso de cruce al asignar dos sesiones superpuestas al mismo ponente, o foto de más de 1 MB. |

Tabla lista: [Tablas de casos de prueba → HU-11](#hu-11-gestión-de-ponentes-y-programa).

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-67
- Qué hice: ejecuté y documenté las pruebas de los 5 criterios de aceptación de HU-11 (Gestión de ponentes y programa).
- Archivos / rama / commit: tests/hu10-14-reportes-programa-admin-encuesta.test.ts (rama main, commit <hash>)
- Evidencia: tabla de casos adjunta; capturas de un caso exitoso y uno fallido.
- Cómo probarlo: npm test, o seguir los pasos de cada caso en la app.
- Pendiente / bloqueos: ninguno.
```

</details>

## HU-13 · Panel de administración (CAP-13)

### CAP-68 · Gestión de instituciones y usuarios

**Responsable:** Carlos

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Capturas del listado, creación, edición y desactivación | App → `admin@capacitron.demo` → Administración → pestañas «Instituciones» y «Usuarios» | Usa «Nueva institución», «Editar» y «Suspender» (pide motivo). |
| Código del módulo | [`src/pages/admin/Admin.tsx`](../src/pages/admin/Admin.tsx) y [`supabase/migrations/20261005000003_funciones_operacion.sql`](../supabase/migrations/20261005000003_funciones_operacion.sql) |  |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-68
- Qué hice: Panel de administración: crear, editar, activar y suspender instituciones y usuarios (con motivo), cambiar roles; la suspensión cierra las sesiones al instante.
- Archivos / rama / commit: src/pages/admin/Admin.tsx; supabase/migrations/20261005000003_funciones_operacion.sql (public.admin_* (instituciones, usuarios)) (rama main, commit <hash>)
- Evidencia: Capturas del listado, creación, edición y desactivación; Código del módulo.
- Cómo probarlo: Suspender un usuario e intentar ingresar con él.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-69 · Planes con límites de eventos y usuarios

**Responsable:** George

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Script SQL de planes y relación con instituciones | [`supabase/migrations/20261005000001_esquema.sql`](../supabase/migrations/20261005000001_esquema.sql), `capa.planes` e `capa.instituciones.plan_codigo` |  |
| Captura de una institución bloqueada por su límite | App → `cursos.qhapaq@capacitron.demo` (plan Básico) → Crear evento con cupo 300 o con costo | «Función fuera de tu plan: el plan Básico permite hasta 100 cupos…». |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-69
- Qué hice: Tabla de planes (Básico, Pro, Enterprise) con precio, eventos publicados a la vez, cupo por evento y funciones (pagos, virtual, exportar, encuestas); cada institución tiene un plan y el sistema bloquea lo que excede.
- Archivos / rama / commit: supabase/migrations/20261005000001_esquema.sql (tablas planes e instituciones); supabase/migrations/20261005000002_funciones_base.sql (capa.exigir_plan, capa.publicar, public.guardar_evento) (rama main, commit <hash>)
- Evidencia: Script SQL de planes y relación con instituciones; Captura de una institución bloqueada por su límite.
- Cómo probarlo: Crear un evento que exceda el plan Básico.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-70 · Historial de acciones del administrador

**Responsable:** Medaly

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Captura del historial (quién, qué, cuándo) | App → `admin@capacitron.demo` → Administración → pestaña «Historial» |  |
| Script SQL de la tabla de auditoría | [`supabase/migrations/20261005000001_esquema.sql`](../supabase/migrations/20261005000001_esquema.sql), `create table capa.auditoria` y `create trigger auditoria_sin_cambios` |  |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-70
- Qué hice: Historial con autor, fecha y detalle de cada acción administrativa; un trigger impide modificarlo o borrarlo.
- Archivos / rama / commit: supabase/migrations/20261005000001_esquema.sql (tabla capa.auditoria y trigger auditoria_sin_cambios); supabase/migrations/20261005000002_funciones_base.sql (capa.auditar) (rama main, commit <hash>)
- Evidencia: Captura del historial (quién, qué, cuándo); Script SQL de la tabla de auditoría.
- Cómo probarlo: Hacer un cambio administrativo y revisar el historial.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-71 · Pruebas de los criterios de aceptación

**Responsable:** Sin asignar (propuesto: Andree)

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Tabla de casos de prueba de HU-13 | Esta guía → «Tablas de casos de prueba» → HU-13 |  |
| Capturas | App | Incluye que solo un administrador accede: ingresa como `estudiante@capacitron.demo` y abre `/admin` → «No tienes acceso a esta sección». |

Tabla lista: [Tablas de casos de prueba → HU-13](#hu-13-panel-de-administración).

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-71
- Qué hice: ejecuté y documenté las pruebas de los 5 criterios de aceptación de HU-13 (Panel de administración).
- Archivos / rama / commit: tests/hu10-14-reportes-programa-admin-encuesta.test.ts (rama main, commit <hash>)
- Evidencia: tabla de casos adjunta; capturas de un caso exitoso y uno fallido.
- Cómo probarlo: npm test, o seguir los pasos de cada caso en la app.
- Pendiente / bloqueos: ninguno.
```

</details>

## HU-14 · Encuesta de satisfacción (CAP-14)

### CAP-72 · Envío automático de la encuesta al finalizar el evento

**Responsable:** Sin asignar (propuesto: José)

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Código del disparador de envío | [`supabase/migrations/20261005000003_funciones_operacion.sql`](../supabase/migrations/20261005000003_funciones_operacion.sql), `capa.procesar_tareas_internas` (paso 6) |  |
| Captura del correo con la encuesta | App → `estudiante@capacitron.demo` → Bandeja → «¿Qué te pareció Taller…?» |  |
| Captura del registro del envío | Supabase → SQL Editor | `select evento_id, enviada_en, cierra_en from capa.encuestas;` |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-72
- Qué hice: Al terminar el evento, la tarea programada crea la encuesta (o usa la configurada), la envía solo a quienes registraron asistencia y la cierra a los 7 días.
- Archivos / rama / commit: supabase/migrations/20261005000003_funciones_operacion.sql (capa.procesar_tareas_internas, paso 6); supabase/migrations/20261005000001_esquema.sql (tabla capa.encuestas) (rama main, commit <hash>)
- Evidencia: Código del disparador de envío; Captura del correo con la encuesta; Captura del registro del envío.
- Cómo probarlo: Esperar el cierre de un evento (o adelantar el reloj) y revisar la Bandeja.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-73 · Resultados de la encuesta y modo anónimo

**Responsable:** Carlos

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Captura de la encuesta respondida | App → `estudiante@capacitron.demo` → Mis inscripciones → Historial → «Responder encuesta» |  |
| Captura de los resultados agregados | App → `coordinacion@capacitron.demo` → Mis eventos → «Finalizados» → «Taller…» → pestaña «Encuesta» |  |
| Captura del modo anónimo | Misma pestaña (comentarios marcados «Anónimo»); configuración en la pestaña «Encuesta» de un evento próximo |  |
| Script SQL de las tablas de respuestas | [`supabase/migrations/20261005000001_esquema.sql`](../supabase/migrations/20261005000001_esquema.sql), `capa.encuestas` y `capa.encuesta_respuestas` |  |

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-73
- Qué hice: Formulario de 1 a 10 preguntas (escala 1–5) con comentario opcional; una respuesta por persona; resultados con promedios y distribución por pregunta; en modo anónimo nunca se muestra quién respondió.
- Archivos / rama / commit: src/pages/Encuesta.tsx; src/pages/organizador/gestion/EncuestaGestion.tsx; supabase/migrations/20261005000003_funciones_operacion.sql (public.responder_encuesta, public.resultados_encuesta); supabase/migrations/20261005000001_esquema.sql (tabla encuesta_respuestas) (rama main, commit <hash>)
- Evidencia: Captura de la encuesta respondida; Captura de los resultados agregados; Captura del modo anónimo; Script SQL de las tablas de respuestas.
- Cómo probarlo: Responder la encuesta del taller y ver los resultados como organizadora.
- Pendiente / bloqueos: ninguno.
```

</details>

### CAP-74 · Pruebas de los criterios de aceptación

**Responsable:** Sin asignar (propuesto: Andree)

| Qué subir | Dónde se encuentra | Cómo obtenerlo |
|---|---|---|
| Tabla de casos de prueba de HU-14 | Esta guía → «Tablas de casos de prueba» → HU-14 |  |
| Capturas | App, ver CAP-73 | Éxito: encuesta enviada. Fallo: intentar responder dos veces («Ya respondiste esta encuesta»). |

Tabla lista: [Tablas de casos de prueba → HU-14](#hu-14-encuesta-de-satisfacción).

<details><summary>Comentario para Jira</summary>

```
## Avance – CAP-74
- Qué hice: ejecuté y documenté las pruebas de los 5 criterios de aceptación de HU-14 (Encuesta de satisfacción).
- Archivos / rama / commit: tests/hu10-14-reportes-programa-admin-encuesta.test.ts (rama main, commit <hash>)
- Evidencia: tabla de casos adjunta; capturas de un caso exitoso y uno fallido.
- Cómo probarlo: npm test, o seguir los pasos de cada caso en la app.
- Pendiente / bloqueos: ninguno.
```

</details>

## Tablas de casos de prueba

Formato de la sección 4 de la guía del equipo. «Resultado obtenido» viene de la ejecución de `npm test` (82 pruebas, todas pasan). La columna «Evidencia» propone el nombre de la captura y el archivo de prueba.

### HU-01 Registro de usuarios

| ID | Criterio de aceptación | Entrada / pasos | Resultado esperado | Resultado obtenido | Estado | Evidencia |
|----|------------------------|-----------------|--------------------|--------------------|--------|-----------|
| CP-01 | CA-01 | Dado que el correo no está registrado, cuando el usuario completa nombres, correo y una contraseña válida y envía el formulario | El sistema crea la cuenta en estado «pendiente de confirmación». | Igual al esperado. Prueba automática: «Crea la cuenta en estado «pendiente de confirmación» y guarda la contraseña cifrada». | Pasó | `CAP-28_registro-enviado.png` + `tests/hu01-02-cuentas-eventos.test.ts` |
| CP-02 | CA-02 | Dado que el correo ya existe, cuando el usuario intenta registrarse con él | El sistema muestra un mensaje de error y no crea otra cuenta. | Igual al esperado. Prueba automática: «Rechaza un correo ya registrado (sin distinguir mayúsculas) y no crea otra cuenta». | Pasó | `CAP-30_fallo-correo-duplicado.png` + `tests/hu01-02-cuentas-eventos.test.ts` |
| CP-03 | CA-03 | Dado que la cuenta fue creada, cuando termina el registro | El sistema envía un correo con un enlace de confirmación válido por 24 horas. | Igual al esperado. Prueba automática: «Envía un correo con enlace de confirmación válido por 24 horas». | Pasó | `CAP-29_correo-confirmacion.png` + `tests/hu01-02-cuentas-eventos.test.ts` |
| CP-04 | CA-04 | Dado que la contraseña tiene menos de 8 caracteres o no combina letras y números, cuando el usuario envía el formulario | El sistema la rechaza e indica los requisitos. | Igual al esperado. Prueba automática: «Rechaza contraseñas de menos de 8 caracteres o sin letras y números». | Pasó | `CAP-30_fallo-contrasena-debil.png` + `tests/hu01-02-cuentas-eventos.test.ts` |
| CP-05 | CA-05 | Dado que el usuario abre el enlace de confirmación vigente, cuando la página carga | La cuenta pasa a «activa» y puede iniciar sesión. | Igual al esperado. Prueba automática: «El enlace vigente activa la cuenta y permite iniciar sesión; uno vencido no». | Pasó | `CAP-28_cuenta-confirmada.png` + `tests/hu01-02-cuentas-eventos.test.ts` |
| CP-06 | Regla de negocio | Exige aceptar la política de privacidad | Se cumple la regla. | Igual al esperado (prueba automática). | Pasó | `tests/hu01-02-cuentas-eventos.test.ts` |
| CP-07 | Regla de negocio | Tras 5 intentos fallidos la cuenta se bloquea 15 minutos | Se cumple la regla. | Igual al esperado (prueba automática). | Pasó | `tests/hu01-02-cuentas-eventos.test.ts` |
| CP-08 | Regla de negocio | Un organizador debe elegir una institución activa | Se cumple la regla. | Igual al esperado (prueba automática). | Pasó | `tests/hu01-02-cuentas-eventos.test.ts` |

### HU-02 Crear evento

| ID | Criterio de aceptación | Entrada / pasos | Resultado esperado | Resultado obtenido | Estado | Evidencia |
|----|------------------------|-----------------|--------------------|--------------------|--------|-----------|
| CP-01 | CA-01 | Dado que faltan campos obligatorios, cuando el organizador intenta guardar | El sistema resalta los campos faltantes y no guarda el evento. | Igual al esperado. Prueba automática: «Si faltan campos obligatorios indica cuáles y no guarda». | Pasó | `CAP-32_errores-validacion.png` + `tests/hu01-02-cuentas-eventos.test.ts` |
| CP-02 | CA-02 | Dado que los datos son válidos, cuando el organizador elige «Guardar borrador» | El evento se guarda y no es visible para el público. | Igual al esperado. Prueba automática: «Un borrador se guarda pero no aparece en el catálogo». | Pasó | `CAP-34_borrador-no-aparece.png` + `tests/hu01-02-cuentas-eventos.test.ts` |
| CP-03 | CA-03 | Dado que el evento está en borrador, cuando el organizador lo publica | Aparece en el catálogo con su fecha, modalidad, cupos y costo. | Igual al esperado. Prueba automática: «Al publicarlo aparece en el catálogo con fecha, modalidad, cupos y costo». | Pasó | `CAP-34_catalogo-publicados.png` + `tests/hu01-02-cuentas-eventos.test.ts` |
| CP-04 | CA-04 | Dado que la fecha de inicio es anterior a la fecha actual, cuando el organizador intenta publicar | El sistema lo impide y muestra el motivo. | Igual al esperado. Prueba automática: «Impide publicar si la fecha de inicio ya pasó». | Pasó | `CAP-35_fallo-fecha-pasada.png` + `tests/hu01-02-cuentas-eventos.test.ts` |
| CP-05 | CA-05 | Dado que el evento no tiene inscritos, cuando el organizador edita sus datos | Los cambios se guardan y se reflejan en el catálogo. | Igual al esperado. Prueba automática: «Sin inscritos, la edición se guarda y se refleja en el catálogo». | Pasó | `CAP-35_edicion-reflejada.png` + `tests/hu01-02-cuentas-eventos.test.ts` |
| CP-06 | Regla de negocio | Con inscritos no se cambia el costo y el evento no se elimina, solo se cancela | Se cumple la regla. | Igual al esperado (prueba automática). | Pasó | `tests/hu01-02-cuentas-eventos.test.ts` |
| CP-07 | Regla de negocio | El costo puede ser cero (evento gratuito) | Se cumple la regla. | Igual al esperado (prueba automática). | Pasó | `tests/hu01-02-cuentas-eventos.test.ts` |
| CP-08 | Regla de negocio | Un organizador no edita eventos de otro | Se cumple la regla. | Igual al esperado (prueba automática). | Pasó | `tests/hu01-02-cuentas-eventos.test.ts` |

### HU-03 Inscripción a evento

| ID | Criterio de aceptación | Entrada / pasos | Resultado esperado | Resultado obtenido | Estado | Evidencia |
|----|------------------------|-----------------|--------------------|--------------------|--------|-----------|
| CP-01 | CA-01 | Dado que hay cupos y el usuario no está inscrito, cuando pulsa «Inscribirme» y confirma sus datos | El sistema registra la inscripción. | Igual al esperado. Prueba automática: «Registra la inscripción si hay cupos». | Pasó | `CAP-38_inscripcion-registrada.png` + `tests/hu03-05-inscripcion-pagos-cupos.test.ts` |
| CP-02 | CA-02 | Dado que el usuario ya está inscrito, cuando intenta inscribirse otra vez en el mismo evento | El sistema se lo impide y le muestra su inscripción existente. | Igual al esperado. Prueba automática: «Si ya está inscrito lo impide y devuelve la inscripción existente». | Pasó | `CAP-40_fallo-doble-inscripcion.png` + `tests/hu03-05-inscripcion-pagos-cupos.test.ts` |
| CP-03 | CA-03 | Dado que la inscripción fue registrada, cuando termina el proceso | Se muestra una confirmación en pantalla y se envía un correo con los datos del evento. | Igual al esperado. Prueba automática: «Envía un correo con los datos del evento». | Pasó | `CAP-39_correo-inscripcion.png` + `tests/hu03-05-inscripcion-pagos-cupos.test.ts` |
| CP-04 | CA-04 | Dado que la inscripción fue registrada, cuando se consulta el evento | Los cupos disponibles disminuyen en uno. | Igual al esperado. Prueba automática: «Los cupos disponibles disminuyen en uno». | Pasó | `CAP-40_cupos-antes-despues.png` + `tests/hu03-05-inscripcion-pagos-cupos.test.ts` |
| CP-05 | CA-05 | Dado que el evento tiene costo, cuando el usuario se inscribe | La inscripción queda «pendiente de pago» hasta completar la HU-04. | Igual al esperado. Prueba automática: «En un evento con costo queda «pendiente de pago»». | Pasó | `CAP-40_pendiente-de-pago.png` + `tests/hu03-05-inscripcion-pagos-cupos.test.ts` |
| CP-06 | Regla de negocio | Se puede cancelar hasta 24 horas antes y el cupo se libera | Se cumple la regla. | Igual al esperado (prueba automática). | Pasó | `tests/hu03-05-inscripcion-pagos-cupos.test.ts` |

### HU-05 Control de cupos

| ID | Criterio de aceptación | Entrada / pasos | Resultado esperado | Resultado obtenido | Estado | Evidencia |
|----|------------------------|-----------------|--------------------|--------------------|--------|-----------|
| CP-01 | CA-01 | Dado que los cupos se agotaron, cuando un usuario intenta inscribirse | El sistema bloquea la inscripción y le ofrece unirse a la lista de espera. | Igual al esperado. Prueba automática: «Con los cupos agotados bloquea la inscripción y ofrece la lista de espera». | Pasó | `CAP-43_cupo-lleno.png` + `tests/hu03-05-inscripcion-pagos-cupos.test.ts` |
| CP-02 | CA-02 | Dado que el usuario está en la lista de espera, cuando se libera un cupo | El sistema notifica por correo al primero de la lista. | Igual al esperado. Prueba automática: «Al liberarse un cupo se notifica por correo al primero de la lista». | Pasó | `CAP-42_correo-cupo-liberado.png` + `tests/hu03-05-inscripcion-pagos-cupos.test.ts` |
| CP-03 | CA-03 | Dado que se notificó a un usuario de la lista, cuando pasan 24 horas sin que confirme | El cupo pasa al siguiente de la lista. | Igual al esperado. Prueba automática: «Si no confirma en 24 horas el cupo pasa al siguiente de la lista». | Pasó | `CAP-43_oferta-vencida.png` + `tests/hu03-05-inscripcion-pagos-cupos.test.ts` |
| CP-04 | CA-04 | Dado que dos usuarios intentan tomar el último cupo a la vez, cuando ambos envían la inscripción | Solo uno la completa y el otro pasa a la lista de espera. | Igual al esperado. Prueba automática: «Si dos personas piden el último cupo, solo una lo obtiene y la otra pasa a la lista de espera». | Pasó | `CAP-43_concurrencia.png` + `tests/hu03-05-inscripcion-pagos-cupos.test.ts` |
| CP-05 | CA-05 | Dado que el organizador consulta el evento, cuando abre el panel | Ve los cupos totales, ocupados y disponibles, y la cantidad de personas en espera. | Igual al esperado. Prueba automática: «El organizador ve cupos totales, ocupados, disponibles y personas en espera». | Pasó | `CAP-43_panel-cupos-espera.png` + `tests/hu03-05-inscripcion-pagos-cupos.test.ts` |
| CP-06 | Regla de negocio | Si el organizador amplía el cupo se notifica a quienes esperan | Se cumple la regla. | Igual al esperado (prueba automática). | Pasó | `tests/hu03-05-inscripcion-pagos-cupos.test.ts` |

### HU-04 Pago en línea

| ID | Criterio de aceptación | Entrada / pasos | Resultado esperado | Resultado obtenido | Estado | Evidencia |
|----|------------------------|-----------------|--------------------|--------------------|--------|-----------|
| CP-01 | CA-01 | Dado que la inscripción está pendiente, cuando el usuario elige un medio de pago y la plataforma confirma el cobro | La inscripción pasa a «confirmada». | Igual al esperado. Prueba automática: «Un pago aprobado confirma la inscripción y genera un comprobante enviado por correo». | Pasó | `CAP-45_pago-exitoso.png` + `tests/hu03-05-inscripcion-pagos-cupos.test.ts` |
| CP-02 | CA-02 | Dado que el pago fue confirmado, cuando termina la transacción | El sistema genera un comprobante descargable y lo envía por correo. | Igual al esperado. Prueba automática: «Un pago aprobado confirma la inscripción y genera un comprobante enviado por correo». | Pasó | `CAP-45_comprobante.pdf` + `tests/hu03-05-inscripcion-pagos-cupos.test.ts` |
| CP-03 | CA-03 | Dado que la plataforma de pago rechaza el cobro o no responde, cuando ocurre el error | La inscripción sigue pendiente y el usuario ve un mensaje claro con la opción de reintentar. | Igual al esperado. Prueba automática: «Si la plataforma rechaza o no responde, la inscripción sigue pendiente y se puede reintentar». | Pasó | `CAP-45_error-pago.png` + `tests/hu03-05-inscripcion-pagos-cupos.test.ts` |
| CP-04 | CA-04 | Dado que el pago quedó sin confirmar durante 30 minutos, cuando vence ese plazo | El sistema libera el cupo reservado. | Igual al esperado. Prueba automática: «Sin pago confirmado en 30 minutos se libera el cupo reservado». | Pasó | `CAP-46_reserva-vencida.png` + `tests/hu03-05-inscripcion-pagos-cupos.test.ts` |
| CP-05 | CA-05 | Dado que se registró un pago, cuando el organizador revisa los reportes | El monto aparece asociado a la inscripción y al evento. | Igual al esperado. Prueba automática: «El monto aparece en los reportes del organizador asociado al evento». | Pasó | `CAP-46_monto-en-reportes.png` + `tests/hu03-05-inscripcion-pagos-cupos.test.ts` |
| CP-06 | Regla de negocio | No se guardan datos de tarjeta, solo una referencia de la plataforma | Se cumple la regla. | Igual al esperado (prueba automática). | Pasó | `tests/hu03-05-inscripcion-pagos-cupos.test.ts` |

### HU-07 Registro de asistencia con QR

| ID | Criterio de aceptación | Entrada / pasos | Resultado esperado | Resultado obtenido | Estado | Evidencia |
|----|------------------------|-----------------|--------------------|--------------------|--------|-----------|
| CP-01 | CA-01 | Dado que la inscripción está confirmada, cuando el usuario accede a su inscripción | Puede ver y descargar su código QR único. | Igual al esperado. Prueba automática: «La inscripción confirmada muestra un QR único que no contiene datos personales». | Pasó | `CAP-47_qr-generado.png` + `tests/hu06-09-recordatorios-qr-certificados.test.ts` |
| CP-02 | CA-02 | Dado que el QR es válido y no se ha usado, cuando el organizador lo escanea | El sistema registra la asistencia con fecha y hora y muestra el nombre del asistente. | Igual al esperado. Prueba automática: «Un QR válido registra la asistencia con fecha, hora y nombre». | Pasó | `CAP-48_asistencia-registrada.png` + `tests/hu06-09-recordatorios-qr-certificados.test.ts` |
| CP-03 | CA-03 | Dado que el QR ya fue registrado, cuando se escanea otra vez | El sistema avisa que la persona ya ingresó y no duplica el registro. | Igual al esperado. Prueba automática: «Un QR ya registrado avisa y no duplica». | Pasó | `CAP-48_qr-repetido.png` + `tests/hu06-09-recordatorios-qr-certificados.test.ts` |
| CP-04 | CA-04 | Dado que el QR no corresponde al evento o a una inscripción confirmada, cuando se escanea | El sistema lo rechaza con un mensaje claro. | Igual al esperado. Prueba automática: «Rechaza un QR de otro evento o de una inscripción no confirmada». | Pasó | `CAP-48_qr-invalido.png` + `tests/hu06-09-recordatorios-qr-certificados.test.ts` |
| CP-05 | CA-05 | Dado que el organizador consulta la asistencia, cuando abre la lista del evento | Ve en tiempo real quiénes ingresaron y a qué hora. | Igual al esperado. Prueba automática: «La lista muestra quién ingresó y a qué hora». | Pasó | `CAP-48_lista-en-vivo.png` + `tests/hu06-09-recordatorios-qr-certificados.test.ts` |
| CP-06 | Regla de negocio | Solo los organizadores del evento registran asistencia | Se cumple la regla. | Igual al esperado (prueba automática). | Pasó | `tests/hu06-09-recordatorios-qr-certificados.test.ts` |

### HU-08 Emisión de certificados digitales

| ID | Criterio de aceptación | Entrada / pasos | Resultado esperado | Resultado obtenido | Estado | Evidencia |
|----|------------------------|-----------------|--------------------|--------------------|--------|-----------|
| CP-01 | CA-01 | Dado que el asistente cumplió el porcentaje mínimo de asistencia definido por el organizador, cuando el evento finaliza | El certificado queda disponible para descargar. | Igual al esperado. Prueba automática: «Emite el certificado al finalizar a quien cumplió el porcentaje, con sus datos y código único». | Pasó | `CAP-51_elegible.png` + `tests/hu06-09-recordatorios-qr-certificados.test.ts` |
| CP-02 | CA-02 | Dado que el asistente no cumplió ese porcentaje, cuando intenta descargar | El sistema le indica que no es elegible y explica el motivo. | Igual al esperado. Prueba automática: «Emite el certificado al finalizar a quien cumplió el porcentaje, con sus datos y código único»; «Quien no cumplió el porcentaje recibe el motivo». | Pasó | `CAP-51_no-elegible.png` + `tests/hu06-09-recordatorios-qr-certificados.test.ts` |
| CP-03 | CA-03 | Dado que se genera el certificado, cuando se visualiza | Incluye el nombre del titular, el nombre del evento, la fecha, la duración, la firma del organizador y un código QR de verificación. | Igual al esperado. Prueba automática: «Emite el certificado al finalizar a quien cumplió el porcentaje, con sus datos y código único». | Pasó | `CAP-50_certificado-ejemplo.pdf` + `tests/hu06-09-recordatorios-qr-certificados.test.ts` |
| CP-04 | CA-04 | Dado que el certificado está disponible, cuando el usuario lo descarga | Obtiene un archivo PDF con un código único. | Igual al esperado. Prueba automática: «Emite el certificado al finalizar a quien cumplió el porcentaje, con sus datos y código único». | Pasó | `CAP-50_boton-descarga.png` + `tests/hu06-09-recordatorios-qr-certificados.test.ts` |
| CP-05 | CA-05 | Dado que se emitió un certificado, cuando el organizador lo consulta | Puede ver su estado y revocarlo indicando un motivo que queda registrado. | Igual al esperado. Prueba automática: «El organizador revoca con motivo y la verificación lo muestra inválido con fecha». | Pasó | `CAP-51_revocado.png` + `tests/hu06-09-recordatorios-qr-certificados.test.ts` |

### HU-09 Verificación de certificados

| ID | Criterio de aceptación | Entrada / pasos | Resultado esperado | Resultado obtenido | Estado | Evidencia |
|----|------------------------|-----------------|--------------------|--------------------|--------|-----------|
| CP-01 | CA-01 | Dado que el visitante tiene el código o el QR, cuando lo ingresa o lo escanea en la página de verificación | El sistema muestra el titular, el evento, la fecha y el estado «válido». | Igual al esperado. Prueba automática: «Cualquiera, sin sesión, verifica un certificado válido y ve solo datos mínimos». | Pasó | `CAP-53_valido.png` + `tests/hu06-09-recordatorios-qr-certificados.test.ts` |
| CP-02 | CA-02 | Dado que el código no existe, cuando se consulta | El sistema muestra «certificado no encontrado» sin revelar datos de otros certificados. | Igual al esperado. Prueba automática: «Un código inexistente devuelve «no encontrado» sin datos de otros certificados». | Pasó | `CAP-53_no-encontrado.png` + `tests/hu06-09-recordatorios-qr-certificados.test.ts` |
| CP-03 | CA-03 | Dado que el certificado fue revocado, cuando se consulta | El estado mostrado es «inválido» y se indica la fecha de revocación. | Igual al esperado. Prueba automática: «El organizador revoca con motivo y la verificación lo muestra inválido con fecha». | Pasó | `CAP-53_revocado.png` + `tests/hu06-09-recordatorios-qr-certificados.test.ts` |
| CP-04 | CA-04 | Dado que el visitante no tiene cuenta, cuando usa la verificación | Puede hacerlo sin iniciar sesión. | Igual al esperado. Prueba automática: «Cualquiera, sin sesión, verifica un certificado válido y ve solo datos mínimos». | Pasó | `CAP-53_valido-sin-sesion.png` + `tests/hu06-09-recordatorios-qr-certificados.test.ts` |
| CP-05 | CA-05 | Dado que se hacen consultas repetidas con códigos inventados, cuando se supera un límite de intentos | El sistema bloquea temporalmente al solicitante. | Igual al esperado. Prueba automática: «Bloquea temporalmente a quien prueba códigos inventados». | Pasó | `CAP-55_bloqueo-intentos.png` + `tests/hu06-09-recordatorios-qr-certificados.test.ts` |

### HU-06 Recordatorios automáticos

| ID | Criterio de aceptación | Entrada / pasos | Resultado esperado | Resultado obtenido | Estado | Evidencia |
|----|------------------------|-----------------|--------------------|--------------------|--------|-----------|
| CP-01 | CA-01 | Dado que faltan 24 horas para el evento, cuando se cumple ese plazo | El sistema envía un recordatorio al inscrito. | Igual al esperado. Prueba automática: «Envía un recordatorio 24 h antes y otro 1 h antes». | Pasó | `CAP-56_recordatorio-24h.png` + `tests/hu06-09-recordatorios-qr-certificados.test.ts` |
| CP-02 | CA-02 | Dado que falta 1 hora para el evento, cuando se cumple ese plazo | El sistema envía un segundo recordatorio. | Igual al esperado. Prueba automática: «Envía un recordatorio 24 h antes y otro 1 h antes». | Pasó | `CAP-58_recordatorio-1h.png` + `tests/hu06-09-recordatorios-qr-certificados.test.ts` |
| CP-03 | CA-03 | Dado que se envía un recordatorio, cuando el usuario lo abre | Ve el nombre, la fecha, la hora, la modalidad y el lugar o enlace del evento. | Igual al esperado. Prueba automática: «El recordatorio incluye nombre, fecha, hora, modalidad y lugar». | Pasó | `CAP-57_plantilla.png` + `tests/hu06-09-recordatorios-qr-certificados.test.ts` |
| CP-04 | CA-04 | Dado que el usuario desactivó los recordatorios, cuando se cumple el plazo | El sistema no le envía mensajes. | Igual al esperado. Prueba automática: «No envía recordatorios a quien los desactivó». | Pasó | `CAP-57_efecto-desactivado.png` + `tests/hu06-09-recordatorios-qr-certificados.test.ts` |
| CP-05 | CA-05 | Dado que el organizador cambia la fecha, la hora o el enlace del evento, cuando guarda el cambio | Los recordatorios pendientes se reprograman con los datos nuevos. | Igual al esperado. Prueba automática: «Si cambia la fecha, los recordatorios se reprograman con los datos nuevos». | Pasó | `CAP-58_reprogramado.png` + `tests/hu06-09-recordatorios-qr-certificados.test.ts` |
| CP-06 | Regla de negocio | No se recuerda a inscripciones canceladas ni a la lista de espera | Se cumple la regla. | Igual al esperado (prueba automática). | Pasó | `tests/hu06-09-recordatorios-qr-certificados.test.ts` |

### HU-10 Reportes de participación

| ID | Criterio de aceptación | Entrada / pasos | Resultado esperado | Resultado obtenido | Estado | Evidencia |
|----|------------------------|-----------------|--------------------|--------------------|--------|-----------|
| CP-01 | CA-01 | Dado que el organizador abre el panel, cuando este carga | Ve los inscritos, los asistentes, el porcentaje de asistencia y el ingreso total. | Igual al esperado. Prueba automática: «Muestra inscritos, asistentes, porcentaje de asistencia e ingreso total». | Pasó | `CAP-60_panel-sin-filtros.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-02 | CA-02 | Dado que llega una nueva inscripción, pago o asistencia, cuando ocurre | Las cifras se actualizan sin recargar la página. | Igual al esperado. Prueba automática: «Cada inscripción, pago o asistencia actualiza la señal de tiempo real del evento». | Pasó | `CAP-60_actualizacion-en-vivo.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-03 | CA-03 | Dado que el organizador necesita un respaldo, cuando elige exportar | Obtiene el reporte en Excel o PDF. | Igual al esperado. Prueba automática: «Exportar exige un plan que lo incluya». | Pasó | `CAP-61_reporte.xlsx / .pdf` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-04 | CA-04 | Dado que el organizador filtra por fechas, modalidad o evento, cuando aplica el filtro | El panel muestra solo esos datos. | Igual al esperado. Prueba automática: «Filtra por fechas, modalidad y evento». | Pasó | `CAP-60_panel-con-filtros.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-05 | CA-05 | Dado que un usuario sin rol de organizador intenta ver el panel, cuando accede | El sistema le niega el acceso. | Igual al esperado. Prueba automática: «Niega el acceso a quien no es organizador y cada organizador ve solo sus eventos». | Pasó | `CAP-60_acceso-denegado.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |

### HU-12 Eventos virtuales

| ID | Criterio de aceptación | Entrada / pasos | Resultado esperado | Resultado obtenido | Estado | Evidencia |
|----|------------------------|-----------------|--------------------|--------------------|--------|-----------|
| CP-01 | CA-01 | Dado que el ponente o el organizador pega un enlace válido de Zoom, Meet o Teams, cuando guarda | El enlace queda asociado al evento. | Igual al esperado. Prueba automática: «El ponente o el organizador asocian un enlace válido de Zoom, Meet o Teams». | Pasó | `CAP-62_enlace-valido.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-02 | CA-02 | Dado que el enlace no pertenece a una plataforma admitida, cuando se intenta guardar | El sistema lo rechaza. | Igual al esperado. Prueba automática: «Rechaza enlaces de plataformas no admitidas». | Pasó | `CAP-62_enlace-rechazado.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-03 | CA-03 | Dado que el usuario tiene inscripción confirmada, cuando abre el evento | Puede ver el enlace. | Igual al esperado. Prueba automática: «Solo lo ve quien tiene la inscripción confirmada». | Pasó | `CAP-63_confirmado-ve-enlace.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-04 | CA-04 | Dado que el usuario no está inscrito o su pago está pendiente, cuando abre el evento | No ve el enlace. | Igual al esperado. Prueba automática: «Solo lo ve quien tiene la inscripción confirmada». | Pasó | `CAP-63_no-inscrito-sin-enlace.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-05 | CA-05 | Dado que el evento tiene enlace, cuando se envían los recordatorios | Estos lo incluyen. | Igual al esperado. Prueba automática: «Los recordatorios incluyen el enlace y un reemplazo se envía por correo». | Pasó | `CAP-64_recordatorio-con-enlace.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |

### HU-11 Gestión de ponentes y programa

| ID | Criterio de aceptación | Entrada / pasos | Resultado esperado | Resultado obtenido | Estado | Evidencia |
|----|------------------------|-----------------|--------------------|--------------------|--------|-----------|
| CP-01 | CA-01 | Dado que el organizador agrega un ponente, cuando guarda su nombre, foto y biografía | El ponente aparece en la página del evento. | Igual al esperado. Prueba automática: «El ponente aparece en la página y el cronograma se ordena por hora». | Pasó | `CAP-65_ponente-en-pagina.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-02 | CA-02 | Dado que el organizador define sesiones con hora, título y ponente, cuando las guarda | El cronograma se muestra ordenado por hora. | Igual al esperado. Prueba automática: «El ponente aparece en la página y el cronograma se ordena por hora». | Pasó | `CAP-66_cronograma.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-03 | CA-03 | Dado que dos sesiones del mismo ponente se superponen en horario, cuando se intenta guardar | El sistema advierte el cruce. | Igual al esperado. Prueba automática: «Advierte si dos sesiones del mismo ponente se cruzan». | Pasó | `CAP-67_aviso-cruce.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-04 | CA-04 | Dado que el organizador modifica el programa, cuando guarda el cambio | Se notifica por correo a los inscritos. | Igual al esperado. Prueba automática: «Al modificar el programa se notifica a los inscritos». | Pasó | `CAP-66_correo-cambio.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-05 | CA-05 | Dado que la foto supera el tamaño permitido o no es una imagen, cuando se sube | El sistema la rechaza e indica el límite. | Igual al esperado. Prueba automática: «Rechaza fotos que no son imagen o que superan 1 MB». | Pasó | `CAP-67_foto-rechazada.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-06 | Regla de negocio | Los datos del ponente se publican solo con su consentimiento | Se cumple la regla. | Igual al esperado (prueba automática). | Pasó | `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |

### HU-13 Panel de administración

| ID | Criterio de aceptación | Entrada / pasos | Resultado esperado | Resultado obtenido | Estado | Evidencia |
|----|------------------------|-----------------|--------------------|--------------------|--------|-----------|
| CP-01 | CA-01 | Dado que el administrador abre una institución o un usuario, cuando elige activar, suspender o editar | El cambio se aplica de inmediato. | Igual al esperado. Prueba automática: «Suspender aplica de inmediato y el usuario ve el motivo al ingresar». | Pasó | `CAP-68_institucion-suspendida.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-02 | CA-02 | Dado que una cuenta está suspendida, cuando el usuario intenta iniciar sesión | El sistema le niega el acceso y muestra el motivo. | Igual al esperado. Prueba automática: «Suspender aplica de inmediato y el usuario ve el motivo al ingresar». | Pasó | `CAP-71_login-suspendido.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-03 | CA-03 | Dado que una institución tiene un plan, cuando intenta usar una función fuera de ese plan | El sistema se lo impide y le sugiere mejorar de plan. | Igual al esperado. Prueba automática: «Una institución no usa funciones fuera de su plan y se le sugiere mejorarlo». | Pasó | `CAP-69_limite-plan.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-04 | CA-04 | Dado que el administrador cambia un plan, cuando guarda | Los nuevos límites rigen desde ese momento. | Igual al esperado. Prueba automática: «Los nuevos límites de un plan rigen desde que se guardan». | Pasó | `CAP-71_nuevo-limite.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-05 | CA-05 | Dado que se realiza una acción administrativa, cuando termina | Se registra en un historial con autor, fecha y detalle. | Igual al esperado. Prueba automática: «Cada acción queda en un historial con autor, fecha y detalle que no se puede borrar». | Pasó | `CAP-70_historial.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-06 | Regla de negocio | Solo el administrador cambia roles | Se cumple la regla. | Igual al esperado (prueba automática). | Pasó | `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-07 | Regla de negocio | Una institución suspendida no puede ingresar | Se cumple la regla. | Igual al esperado (prueba automática). | Pasó | `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |

### HU-14 Encuesta de satisfacción

| ID | Criterio de aceptación | Entrada / pasos | Resultado esperado | Resultado obtenido | Estado | Evidencia |
|----|------------------------|-----------------|--------------------|--------------------|--------|-----------|
| CP-01 | CA-01 | Dado que el evento finalizó, cuando se cumple el cierre | El sistema envía la encuesta a los asistentes registrados. | Igual al esperado. Prueba automática: «Al cerrar el evento se envía la encuesta solo a los asistentes registrados». | Pasó | `CAP-72_correo-encuesta.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-02 | CA-02 | Dado que el asistente responde, cuando envía la encuesta | Su respuesta se guarda y no puede responder dos veces. | Igual al esperado. Prueba automática: «La respuesta se guarda una sola vez». | Pasó | `CAP-74_no-responder-dos-veces.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-03 | CA-03 | Dado que el organizador activó el modo anónimo, cuando consulta los resultados | No ve quién dio cada respuesta. | Igual al esperado. Prueba automática: «Con modo anónimo no se ve quién respondió; se muestran promedios y distribución por pregunta». | Pasó | `CAP-73_modo-anonimo.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-04 | CA-04 | Dado que hay respuestas, cuando el organizador abre el panel de reportes | Ve promedios y gráficos por pregunta. | Igual al esperado. Prueba automática: «Con modo anónimo no se ve quién respondió; se muestran promedios y distribución por pregunta». | Pasó | `CAP-73_resultados.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-05 | CA-05 | Dado que pasaron 7 días desde el envío, cuando vence ese plazo | La encuesta se cierra. | Igual al esperado. Prueba automática: «La encuesta se cierra a los 7 días». | Pasó | `CAP-74_encuesta-cerrada.png` + `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |
| CP-06 | Regla de negocio | Máximo 10 preguntas con escala de 1 a 5 | Se cumple la regla. | Igual al esperado (prueba automática). | Pasó | `tests/hu10-14-reportes-programa-admin-encuesta.test.ts` |

