# HU-15 · Plan y resultado de pruebas

**Historia:** CAP-75 · HU-15 Búsqueda y filtro de eventos · **Tarea:** CAP-82 · **Responsable:** Andree (Product Owner y QA)

> Como persona interesada en eventos académicos, quiero filtrar el catálogo por tema, tipo, fecha o ubicación, para encontrar en un solo lugar actividades formativas.

## 1. Alcance

| Pieza | Tarea | Qué se prueba |
|---|---|---|
| Búsqueda en la base de datos (`catalogo_eventos`) | CAP-80 (Carlos) | Cada filtro, el rango de fechas en hora de Lima, el rechazo de valores inválidos y el índice |
| Panel del catálogo | CAP-81 (Medaly) | Parámetros que manda la pantalla, fichas, rango al revés, dirección de la página y estado vacío |
| Historia completa | CAP-82 (Andree) | Los cinco criterios, como los vive la persona: panel → búsqueda real → lo que se muestra |

Fuera de alcance: el detalle del evento y el contacto con el organizador (HU-02, CAP-78 y CAP-79).

## 2. Entorno

- **Automáticas:** `npx vitest run` con PGlite en memoria y las mismas migraciones que Supabase (`tests/bd.ts`).
- **Manuales:** `npm run dev` en modo local, navegador sin iniciar sesión, en computadora y en celular (o con el modo de dispositivo del navegador a 390 px).

## 3. Datos de prueba (`tests/cap82-aceptacion-hu15.test.ts`)

D es un día de Lima dentro de 10 días. Las horas están en hora de Lima (UTC−5).

| Evento | Tipo | Modalidad y lugar | Precio | Inicio | Para qué está |
|---|---|---|---|---|---|
| Taller de Robótica educativa | taller | Presencial, Pabellón Perayoc | Gratis | D 09:00 | Caso base; «Arduino» solo en la descripción |
| Seminario de Inteligencia Artificial | seminario | Mixta, Auditorio Perayoc | S/ 20 | D−5 15:00 | Otro día, de pago |
| Curso virtual de Python | curso | Virtual | S/ 50 | D 23:30 | Borde: 23:30 de Lima ya es el día siguiente en UTC |
| Congreso de Ingeniería de Software | congreso | Presencial, Cusco | Gratis | D+1 00:30 | Borde: primer minuto del día siguiente |
| Taller de robótica de diez días | taller | Presencial, Pabellón de Educación | Gratis | D−8, dura 10 días | Empieza antes del rango y sigue durante él |
| Taller de robótica en borrador | taller | Pabellón Perayoc | — | D 10:00 | No publicado: nunca debe salir |
| Taller de robótica cancelado | taller | Pabellón Perayoc | — | D 10:00 | Cancelado: nunca debe salir |

La institución organizadora se llama «Instituto Kallpa de Formación Continua», para probar la búsqueda por institución.

## 4. Matriz de trazabilidad

| Criterio | CAP-82 (aceptación) | CAP-80 (búsqueda) | CAP-81 (panel) | Resultado |
|---|---|---|---|---|
| **CA-01** Tema en nombre o descripción | 4 pruebas + 1 pendiente (H-01) | 3 | — | Cumple, con la observación H-01 |
| **CA-02** Rango de fechas | 5 | 4 | 3 | Cumple |
| **CA-03** Tipo, ubicación o «Virtual», combinados | 5 | 5 | 2 | Cumple |
| **CA-04** «No se encontraron eventos» y limpiar | 2 | — | 3 | Cumple |
| **CA-05** Sin sesión y sin guardar datos | 4 | 1 | 5 | Cumple |
| Regla: solo eventos publicados | 1 | 1 | — | Cumple |

**Resultado automático (17/11/2026):** 21 pruebas de aceptación aprobadas y 1 pendiente (H-01); 223 en total en el proyecto, sin fallos. `npx tsc --noEmit` sin errores. Detalle en `pruebas.txt` del paquete.

## 5. Casos manuales

Los ejecuta Andree en el navegador antes de aceptar la historia. Las capturas de CAP-81 (`docs/diseno/CAP-81-filtros-catalogo/`) muestran lo esperado.

| N.° | Criterio | Pasos | Resultado esperado | Resultado |
|---|---|---|---|---|
| M-01 | CA-05 | Abrir `/` en una ventana privada, sin iniciar sesión. | Se ve el catálogo con el panel de filtros. | Pendiente |
| M-02 | CA-01 | Escribir «inteligencia» en el buscador. | Tras un instante queda solo el seminario de IA y la ficha «inteligencia». | Pendiente |
| M-03 | CA-03 | Con lo anterior, elegir Tipo «Seminario» y luego Modalidad «Virtual». | Con Seminario sigue el evento; con Virtual sale «No se encontraron eventos». | Pendiente |
| M-04 | CA-04 | En ese estado vacío, pulsar «Limpiar filtros». | Vuelven todos los eventos, desaparecen las fichas y la dirección queda en `/`. | Pendiente |
| M-05 | CA-02 | Poner «Desde» después de «Hasta». | «Hasta» en rojo con «La fecha final no puede ser anterior a la inicial.»; la lista no se vacía ni aparece un error general. | Pendiente |
| M-06 | CA-02 | Poner un rango que incluya el día de un evento conocido. | Aparece ese evento y los de fuera del rango no. | Pendiente |
| M-07 | CA-03 | Escribir «Perayoc» en Ubicación. | Quedan los eventos de Perayoc, con la ficha «En Perayoc». | Pendiente |
| M-08 | CA-03 | Filtrar, entrar a un evento y volver con «Atrás». | El catálogo sigue con los mismos filtros. | Pendiente |
| M-09 | CA-05 | Con filtros puestos, abrir las herramientas del navegador → Aplicación → Almacenamiento local y Cookies. | No hay nada guardado de la búsqueda; los filtros solo están en la dirección. | Pendiente |
| M-10 | Uso en celular | Repetir M-02 a M-04 a 390 px de ancho. | Todo cabe sin desplazamiento horizontal. | Pendiente |

## 6. Hallazgos

| N.° | Gravedad | Hallazgo | Evidencia | Propuesta |
|---|---|---|---|---|
| H-01 | Media (no bloquea los criterios) | La búsqueda distingue tildes: «robotica» no encuentra «Robótica» y «pabellon» no encuentra «Pabellón». Mucha gente escribe sin tildes en el celular. | Sonda del 17/11/2026: `q: 'robotica'` → 0 eventos, `q: 'robótica'` → 1; lo mismo en la ubicación. Queda como `it.todo` en CAP-82. | Nueva tarea de backend para el Sprint 3 (decide el Product Owner): comparar sin tildes en `catalogo_eventos`. PGlite no trae la extensión `unaccent`, así que conviene una función propia con `translate()` que funcione igual en local y en Supabase. |
| H-02 | Baja (solo modo local) | Los eventos de demostración no tienen tipo, así que en modo local el filtro «Tipo» siempre da «No se encontraron eventos». | Visto al tomar las capturas de CAP-81. | Dar tipo a los eventos en `capa.sembrar_demo()`. |

## 7. Decisión de aceptación

La toma Andree como Product Owner después de ejecutar los casos manuales. Las pruebas automáticas no encuentran nada que bloquee los criterios; H-01 y H-02 pueden ir al backlog sin frenar la historia.

| Fecha | Decisión | Observaciones |
|---|---|---|
| | Pendiente | |
