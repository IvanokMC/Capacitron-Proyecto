# CAPACITRON

Plataforma web para gestionar eventos académicos: creación y publicación de eventos, inscripciones, pagos (Yape, Plin, PayPal), control de cupos con lista de espera, recordatorios, asistencia con código QR, certificados digitales verificables, reportes en tiempo real, administración de planes y encuestas de satisfacción.

Proyecto del curso Ingeniería de Software (UNSAAC, 2026), construido a partir de la **Guía 2 (Agile inception)** y el **Laboratorio 3 (14 historias de usuario)** que están en esta carpeta.

> - Evidencias del sprint (qué subir en cada tarea de Jira y dónde encontrarlo): [docs/GUIA_EVIDENCIAS.md](docs/GUIA_EVIDENCIAS.md)
> - Diagramas entidad-relación y de secuencia: [docs/diagramas.md](docs/diagramas.md)
> - Lo que falta para producción: [PENDIENTES.md](PENDIENTES.md)

## Tecnologías

- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS 4.
- **Backend:** Supabase (Postgres). Toda la lógica de negocio está en funciones SQL (RPC) en [supabase/migrations](supabase/migrations).
- **Modo local:** sin credenciales de Supabase, la app corre el mismo SQL dentro del navegador con PGlite (Postgres en WebAssembly) y carga datos de demostración.
- **Pagos y correos simulados:** pasarela con resultado elegible (aprobar, rechazar o no responder) y bandeja de correo dentro de la app.

## Desplegar en Vercel

### Opción rápida: subir la carpeta `dist`

`dist/` ya está compilada, apunta al Supabase del proyecto e incluye su propio `vercel.json` (para que las rutas como `/eventos/...` funcionen al recargar). Desde esta carpeta:

```bash
npx vercel deploy dist --prod
```

La primera vez pide iniciar sesión y crear el proyecto: acepta los valores por defecto. Si cambias el código, vuelve a generar `dist` con `npm run build`.

### Opción con repositorio (se compila en Vercel)

La carpeta ya está lista: `vercel.json` define la compilación y las rutas, y `.env.production` contiene la URL y la clave publicable del proyecto Supabase (es pública por diseño: va dentro del JavaScript del navegador).

1. **Sube el repositorio a GitHub.** La carpeta ya es un repositorio git con su historial. Crea un repositorio vacío en GitHub (sin README) y ejecuta:
   ```bash
   git remote add origin https://github.com/<usuario>/<repositorio>.git
   git push -u origin main
   ```
2. En Vercel: **Add New → Project →** importa el repositorio. Vercel detecta Vite; no cambies nada.
3. **Deploy.** Si prefieres la terminal: `npx vercel --prod` desde esta carpeta.

Opcional: en lugar de `.env.production`, puedes definir `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en *Settings → Environment Variables* de Vercel. Si quitas ambas, la app publicada funciona en modo local (cada navegador con su propia base de demostración).

La cámara para escanear QR requiere HTTPS: funciona en el dominio de Vercel y en `localhost`.

## Base de datos en Supabase

Tu proyecto (`bdjftrlubrnterncjuft`) ya tiene instaladas las migraciones y los datos de demostración (lo comprobé llamando a las funciones RPC).

Para instalarlo en otro proyecto, ejecuta en el **SQL Editor** de Supabase, en este orden:

| Archivo | Contenido |
|---|---|
| `20261005000001_esquema.sql` | Tablas (esquema privado `capa`), reloj de demostración, historial inmutable |
| `20261005000002_funciones_base.sql` | Cuentas, eventos, inscripciones, lista de espera, pagos |
| `20261005000003_funciones_operacion.sql` | Asistencia QR, certificados, verificación, reportes, programa, enlaces, administración, encuestas, tareas programadas |
| `20261005000004_demo.sql` | Función que siembra los datos de demostración |
| `20261005000005_supabase.sql` | Solo Supabase: permisos, Realtime, `pg_cron` y siembra de la demo |
| `20261005000006_endurecimiento.sql` | Pasarela simulada solo en modo demostración, interruptor del modo demostración y diagnóstico para la administración |

Antes del archivo 0005, activa la extensión **pg_cron** en *Database → Extensions*.

**Tu proyecto ya tiene de la 0001 a la 0005. Falta ejecutar la `20261005000006_endurecimiento.sql`** en el SQL Editor; hasta entonces, la pestaña Administración → «Sistema» muestra un aviso.

Otros archivos SQL:

- [`supabase/reiniciar_demo.sql`](supabase/reiniciar_demo.sql): borra los datos y vuelve a sembrar la demostración.
- [`supabase/consultas/metricas_participacion.sql`](supabase/consultas/metricas_participacion.sql): consultas de métricas de participación (HU-10).

Seguridad: las tablas están en el esquema `capa`, que la API REST no expone. El navegador solo puede llamar a las funciones del esquema `public`, que validan la sesión y el rol en el servidor.

## Ejecutar en local

```bash
npm install
npm run dev        # http://localhost:5173
```

Con `.env.local` se conecta a Supabase. Bórralo (o vacía sus variables) para usar el modo local con PGlite.

```bash
npm test                     # 82 pruebas de los criterios de aceptación contra el SQL real (PGlite)
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

La demo trae un evento terminado (con certificados, uno revocado, y encuesta abierta), uno en curso (para escanear QR), uno lleno con lista de espera, un curso de pago, un webinar virtual que empieza en unas 26 horas y un borrador.

**Reloj de demostración:** en *Administración → Demostración* puedes adelantar la hora del sistema para ver recordatorios (24 h y 1 h antes), el vencimiento de pagos (30 min) y de cupos ofrecidos (24 h), la emisión de certificados y el cierre de encuestas (7 días). En Supabase este reloj afecta a todos los usuarios.

**Buzón de demostración** (enlace en el pie de página): muestra los correos enviados a cualquier dirección, por ejemplo para abrir el enlace de confirmación de una cuenta nueva.

## Historias de usuario implementadas

| HU | Dónde se ve | Pruebas |
|---|---|---|
| HU-01 Registro | `/registro`, `/confirmar/:token`, `/ingresar` (bloqueo tras 5 intentos) | `tests/hu01-02…` |
| HU-02 Crear evento | Organizador → Crear evento (borrador / publicar) | `tests/hu01-02…` |
| HU-03 Inscripción | Detalle del evento → Inscribirme | `tests/hu03-05…` |
| HU-04 Pago en línea | Mis inscripciones → Pagar (Yape, Plin, PayPal), comprobante PDF | `tests/hu03-05…` |
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

## Estructura

```
supabase/migrations/   SQL: esquema, funciones RPC, demo, configuración de Supabase
supabase/consultas/    Consultas de métricas
docs/                  Guía de evidencias, diagramas y colección de Postman
src/lib/backend/       Cliente RPC: Supabase o PGlite (worker compartido entre pestañas)
src/lib/               Sesión, formato de fechas (hora de Perú), PDF
src/components/        Interfaz base, banda de cupos «tejida», QR, gráficos, bandeja
src/pages/             Páginas públicas, asistente, organizador, ponente, administración
tests/                 Pruebas de criterios de aceptación y recorrido en navegador
```

Diseño: dirección visual «Tintes del tejido cusqueño» (grana cochinilla, chilca, q'olle y añil). El contexto del producto está en [PRODUCT.md](PRODUCT.md).

## Equipo

Ingeniería de Software I · UNSAAC 2026 · Docente: Lisha Sabah Diaz Caceres

George Ivanok Muñoz Castillo · Medaly Lozano Llactahuaman · Carlos Rodrigo Rivera Solórzano · Andree Achahuanco Valenza · José Ramiro Palomino Auquitayasi
