# CAPACITRON

Plataforma web para gestionar eventos académicos: creación y publicación de eventos, inscripciones, pagos con verificación manual (QR de Yape, transferencia o WhatsApp), control de cupos con lista de espera, recordatorios, asistencia con código QR, certificados digitales verificables, reportes en tiempo real, administración de planes y encuestas de satisfacción. Desde el Sprint 2 también tiene búsqueda y filtros en el catálogo, foto de perfil, celular del asistente con consentimiento, mapa con la ubicación del evento, y flyer e imagen del lugar.

Proyecto del curso Ingeniería de Software (UNSAAC, 2026). El Sprint 1 se construyó a partir de la **Guía 2 (Agile inception)** y el **Laboratorio 3 (14 historias de usuario)**. El Sprint 2 se planificó en Jira por roles (diseño UI/UX, backend, frontend, QA y DevOps), y cada tarea se entregó como un pull request con su código comentado y su documentación en `docs/tareas/`.

> - Aplicación publicada: https://capacitron.vercel.app
> - Tareas del sprint en Jira: proyecto **CAP** en https://unsaacivanok.atlassian.net/jira/software/projects/CAP
> - Evidencias del sprint (qué subir en cada tarea de Jira y dónde encontrarlo): [docs/GUIA_EVIDENCIAS.md](docs/GUIA_EVIDENCIAS.md)
> - Diagramas entidad-relación y de secuencia: [docs/diagramas.md](docs/diagramas.md)
> - Lo que falta para producción: [PENDIENTES.md](PENDIENTES.md)

## Tecnologías

- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS 4.
- **Backend:** Supabase (Postgres). Toda la lógica de negocio está en funciones SQL (RPC) en [supabase/migrations](supabase/migrations).
- **Archivos:** Supabase Storage con tres buckets: `fotos` (fotos de perfil y QR de Yape), `eventos` (flyer e imagen del lugar, públicos) y `comprobantes` (capturas de pago, privados). Todo pasa por un módulo común, [src/lib/almacenamiento](src/lib/almacenamiento), que en modo local guarda los archivos en el navegador.
- **Comprobantes privados:** la Edge Function [`url-comprobante`](supabase/functions/url-comprobante/index.ts) entrega un enlace firmado de 60 segundos, solo a la dueña del pago o a la administración.
- **Mapas:** Leaflet con mapas de OpenStreetMap; la búsqueda de direcciones usa Nominatim, sin clave.
- **Modo local:** sin credenciales de Supabase, la app corre el mismo SQL dentro del navegador con PGlite (Postgres en WebAssembly) y carga datos de demostración.
- **Correos simulados:** bandeja de correo dentro de la app. La pasarela de pago simulada (Sprint 1) sigue disponible solo en modo demostración.

## Integración continua

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) corre en cada push y en cada pull request hacia `main`: revisa los tipos (`npx tsc --noEmit`) y ejecuta todas las pruebas (`npm test`) con PGlite, sin servicios externos ni secretos. Un pull request solo se integra a `main` si el CI está en verde; después Vercel publica la nueva versión.

## Desplegar en Vercel

### Opción rápida: subir la carpeta `dist`

`dist/` ya está compilada, apunta al Supabase del proyecto e incluye su propio `vercel.json` (para que las rutas como `/eventos/...` funcionen al recargar). Desde esta carpeta:

```bash
npx vercel deploy dist --prod
```

La primera vez pide iniciar sesión y crear el proyecto: acepta los valores por defecto. Si cambias el código, vuelve a generar `dist` con `npm run build`.

### Opción con repositorio (se compila en Vercel)

El repositorio está conectado a Vercel: cada cambio en `main` se publica en https://capacitron.vercel.app. `vercel.json` define la compilación y las rutas, y `.env.production` contiene la URL y la clave publicable del proyecto Supabase (es pública por diseño: va dentro del JavaScript del navegador).

Para conectarlo en otra cuenta: en Vercel, **Add New → Project →** importa el repositorio. Vercel detecta Vite; no cambies nada. Si prefieres la terminal: `npx vercel --prod` desde esta carpeta.

Opcional: en lugar de `.env.production`, puedes definir `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en *Settings → Environment Variables* de Vercel. Si quitas ambas, la app publicada funciona en modo local (cada navegador con su propia base de demostración).

La cámara para escanear QR requiere HTTPS: funciona en el dominio de Vercel y en `localhost`.

## Base de datos en Supabase

Para instalarlo en un proyecto nuevo, ejecuta en el **SQL Editor** de Supabase, en este orden:

| Archivo | Contenido |
|---|---|
| `20261005000001_esquema.sql` | Tablas (esquema privado `capa`), reloj de demostración, historial inmutable |
| `20261005000002_funciones_base.sql` | Cuentas, eventos, inscripciones, lista de espera, pagos |
| `20261005000003_funciones_operacion.sql` | Asistencia QR, certificados, verificación, reportes, programa, enlaces, administración, encuestas, tareas programadas |
| `20261005000004_demo.sql` | Función que siembra los datos de demostración |
| `20261005000005_supabase.sql` | Solo Supabase: permisos, Realtime, `pg_cron` y siembra de la demo |
| `20261005000006_endurecimiento.sql` | Pasarela simulada solo en modo demostración, interruptor del modo demostración y diagnóstico para la administración |

Antes del archivo 0005, activa la extensión **pg_cron** en *Database → Extensions*.

**Sprint 2**, también en este orden:

| Archivo | Tarea · historia | Contenido |
|---|---|---|
| `20261109000001_campos_evento.sql` | CAP-76 · HU-02 | Tipo de evento, organizador, contacto y consentimiento |
| `20261116000001_validaciones_evento.sql` | CAP-77 · HU-02 | Campos que exige publicar un evento |
| `20261116000002_foto_usuario.sql` | CAP-94 · HU-17 | Foto del usuario |
| `20261117000001_campos_publicos_evento.sql` | CAP-78 · HU-02 | Campos públicos del evento y formulario de contacto |
| `20261117000002_bucket_fotos.sql` | CAP-97 · HU-17 | Bucket `fotos` en Supabase Storage |
| `20261118000001_busqueda_catalogo.sql` | CAP-80 · HU-15 | Búsqueda por tema, tipo, fechas y ubicación |
| `20261119000001_celular_usuario.sql` | CAP-99 · HU-18 | Celular con consentimiento revocable |
| `20261120000001_coordenadas_evento.sql` | CAP-104 · HU-19 | Latitud y longitud del evento |
| `20261121000001_imagenes_evento.sql` | CAP-109 · HU-20 | Flyer e imagen del lugar |
| `20261121000002_bucket_eventos.sql` | CAP-112 · HU-20 | Bucket público `eventos` |
| `20261122000001_pagos_manuales.sql` | CAP-89 · HU-16 | Pagos con verificación de la administración y datos de pago de la organización |
| `20261122000002_bucket_comprobantes.sql` | CAP-92 · HU-16 | Bucket privado `comprobantes` y regla de acceso a cada captura |
| `20261123000001_demo_celulares.sql` | CAP-102 · HU-18 | Celulares de ejemplo en la demostración |
| `20261124000001_ejemplos_sprint2.sql` | CAP-114 · HU-02 a HU-20 | Un ejemplo de cada función del Sprint 2 (`capa.sembrar_ejemplos()`) |

Después, despliega la Edge Function de los comprobantes: `supabase functions deploy url-comprobante`.

**Estado del proyecto `bdjftrlubrnterncjuft` (18/11/2026):** tiene todas las migraciones del Sprint 1 y del Sprint 2, la Edge Function `url-comprobante` y los ejemplos con sus imágenes en Supabase Storage.

Otros archivos SQL:

- [`supabase/reiniciar_demo.sql`](supabase/reiniciar_demo.sql): borra los datos y vuelve a sembrar la demostración.
- [`supabase/consultas/metricas_participacion.sql`](supabase/consultas/metricas_participacion.sql): consultas de métricas de participación (HU-10).

Seguridad: las tablas están en el esquema `capa`, que la API REST no expone. El navegador solo puede llamar a las funciones del esquema `public`, que validan la sesión y el rol en el servidor. Las capturas de los comprobantes y el celular son datos personales (Ley N.° 29733): la captura solo la ve la administración, y el celular solo lo ven los organizadores si la persona dio su consentimiento.

## Ejecutar en local

```bash
npm install
npm run dev        # http://localhost:5173
```

Con `.env.local` se conecta a Supabase. Bórralo (o vacía sus variables) para usar el modo local con PGlite.

```bash
npm test                     # 561 pruebas de los criterios de aceptación contra el SQL real (PGlite)
npx tsc --noEmit             # revisión de tipos (la misma que corre el CI)
npm run build                # compila a dist/
npm run e2e                  # recorrido en Chrome (requiere `npx vite preview --port 4173` y Chrome instalado)
npm run verificar:supabase   # Realtime y concurrencia por el último cupo contra el Supabase de .env.local
```

La API se puede probar con la colección de Postman [`docs/postman/CAPACITRON.postman_collection.json`](docs/postman/CAPACITRON.postman_collection.json).

## Cuentas de demostración

Contraseña de todas: `Capacitron2026`. Todos los datos son ficticios.

| Correo | Rol |
|---|---|
| `estudiante@capacitron.demo` | Asistente |
| `coordinacion@capacitron.demo` | Organizadora · UNSAAC (plan Enterprise) |
| `capacitacion.iac@capacitron.demo` | Organizador · Instituto Andino (plan Pro) |
| `cursos.qhapaq@capacitron.demo` | Organizadora · Centro Qhapaq (plan Básico) |
| `ponente@capacitron.demo` | Ponente |
| `admin@capacitron.demo` | Administración |

La demo trae un evento terminado (con certificados, uno revocado, y encuesta abierta), uno en curso (para escanear QR), uno lleno con lista de espera, un curso de pago, un webinar virtual que empieza en unas 26 horas y un borrador. Desde CAP-102, cinco cuentas de ejemplo tienen celular (ficticio) para ver la HU-18 en la lista de inscritos.

**Ejemplos del Sprint 2 (CAP-114):** 4 eventos próximos de ejemplo (congreso y taller de pago, seminario mixto y curso virtual) con flyer, imagen del lugar y punto en el mapa; fotos de perfil ilustradas; datos de pago de ejemplo (QR de Yape que no recibe pagos, banco y WhatsApp); 2 pagos por verificar y 1 aprobado. Para probarlos: entra como `admin@capacitron.demo` → Administración → Pagos, o como `estudiante@capacitron.demo` → Mis inscripciones. Todo está marcado como ejemplo; el detalle está en [docs/tareas/CAP-114-ejemplos-sprint2.md](docs/tareas/CAP-114-ejemplos-sprint2.md).

**Reloj de demostración:** en *Administración → Demostración* puedes adelantar la hora del sistema para ver recordatorios (24 h y 1 h antes), el vencimiento de pagos (30 min) y de cupos ofrecidos (24 h), la emisión de certificados y el cierre de encuestas (7 días). En Supabase este reloj afecta a todos los usuarios.

**Buzón de demostración** (enlace en el pie de página): muestra los correos enviados a cualquier dirección, por ejemplo para abrir el enlace de confirmación de una cuenta nueva.

## Historias de usuario implementadas

### Sprint 1

| HU | Dónde se ve | Pruebas |
|---|---|---|
| HU-01 Registro | `/registro`, `/confirmar/:token`, `/ingresar` (bloqueo tras 5 intentos) | `tests/hu01-02…` |
| HU-02 Crear evento | Organizador → Crear evento (borrador / publicar) | `tests/hu01-02…` |
| HU-03 Inscripción | Detalle del evento → Inscribirme | `tests/hu03-05…` |
| HU-04 Pago en línea | Mis inscripciones → Pagar, comprobante PDF (en el Sprint 2 pasa a verificación manual, HU-16) | `tests/hu03-05…` |
| HU-05 Control de cupos | Banda de cupos, lista de espera, oferta de cupo | `tests/hu03-05…` |
| HU-06 Recordatorios | Correos 24 h y 1 h antes; preferencia en Mi perfil | `tests/hu06-09…` |
| HU-07 Asistencia QR | Mis inscripciones → Ver código QR; Organizador → Asistencia (cámara) | `tests/hu06-09…` |
| HU-08 Certificados | Descargar certificado PDF con QR; revocar con motivo | `tests/hu06-09…` |
| HU-09 Verificación | `/verificar` sin cuenta; límite de consultas | `tests/hu06-09…` |
| HU-10 Reportes | Organizador → Reportes (en vivo, filtros, Excel y PDF) | `tests/hu10-14…` |
| HU-11 Ponentes y programa | Gestión del evento → Programa | `tests/hu10-14…` |
| HU-12 Eventos virtuales | Gestión → Enlace virtual; Ponente → Mis charlas | `tests/hu10-14…` |
| HU-13 Administración | `/admin`: instituciones, usuarios, planes, historial | `tests/hu10-14…` |
| HU-14 Encuesta | `/encuestas/:id`; Gestión → Encuesta (resultados) | `tests/hu10-14…` |

### Sprint 2

| HU | Dónde se ve | Pruebas |
|---|---|---|
| HU-02 Campos y validaciones del evento | Organizador → Crear evento (tipo, organizador, contacto; avisos de lo que falta para publicar); detalle con formulario de contacto | `tests/cap76…` a `tests/cap79…` |
| HU-15 Búsqueda y filtros | Catálogo: buscar por tema y filtrar por tipo, fechas, ubicación y precio | `tests/cap80…` a `tests/cap82…` |
| HU-16 Pago real con verificación manual | Mis inscripciones → Pagar (QR de Yape, transferencia o WhatsApp, con número de operación y captura); Administración → Pagos (aprobar o rechazar) | `tests/cap88…` a `tests/cap92…` |
| HU-17 Perfil con foto | Mi perfil → subir, cambiar o quitar la foto; avatar en el menú y en la lista de inscritos | `tests/cap93…` a `tests/cap97…` |
| HU-18 Celular del asistente | Registro y Mi perfil (con permiso para compartirlo); lista de inscritos con botón de WhatsApp | `tests/cap98…` a `tests/cap102…` |
| HU-19 Mapa con la ubicación | Editor del evento (buscar la dirección o tocar el mapa); detalle con mapa y «Cómo llegar» | `tests/cap103…` a `tests/cap107…` |
| HU-20 Flyer e imagen del lugar | Editor del evento (subir flyer e imagen); catálogo y detalle | `tests/cap108…` a `tests/cap112…` |

Cada tarea tiene su documento en [docs/tareas](docs/tareas) (qué se hizo, cómo y con qué teoría de Diseño de Software), los diseños con capturas en [docs/diseno](docs/diseno) y los planes de prueba por historia en [docs/pruebas](docs/pruebas).

## Estructura

```
.github/workflows/     CI: tipos y pruebas en cada pull request
supabase/migrations/   SQL: esquema, funciones RPC, demo, configuración de Supabase
supabase/functions/    Edge Function url-comprobante (enlaces firmados de comprobantes)
supabase/consultas/    Consultas de métricas
docs/                  Guía de evidencias, diagramas, colección de Postman
docs/tareas/           Un documento por tarea del Sprint 2
docs/diseno/           Diseños UI/UX con capturas
docs/pruebas/          Planes de prueba por historia
src/lib/backend/       Cliente RPC: Supabase o PGlite (worker compartido entre pestañas)
src/lib/almacenamiento/ Contrato de archivos con dos implementaciones (Supabase Storage y local)
src/lib/               Sesión, formato de fechas (hora de Perú), PDF, validaciones, pago, mapa, celular
src/components/        Interfaz base, banda de cupos «tejida», QR, gráficos, bandeja, mapa, imágenes
src/pages/             Páginas públicas, asistente, organizador, ponente, administración
tests/                 Pruebas de criterios de aceptación y recorrido en navegador
```

Diseño: dirección visual «Tintes del tejido cusqueño» (grana cochinilla, chilca, q'olle y añil). El contexto del producto está en [PRODUCT.md](PRODUCT.md).

## Equipo

Ingeniería de Software I · UNSAAC 2026 · Docente: Lisha Sabah Diaz Caceres

| Integrante | Rol en el Sprint 2 |
|---|---|
| George Ivanok Muñoz Castillo | Scrum Master · DevOps, integración y calidad de diseño |
| Andree Achahuanco Valenza | Product Owner · QA y pruebas |
| Carlos Rodrigo Rivera Solórzano | Backend y base de datos |
| José Ramiro Palomino Auquitayasi | Frontend |
| Medaly Lozano Llactahuaman | Diseño UI/UX |
