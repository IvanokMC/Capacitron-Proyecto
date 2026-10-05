# Pendientes de CAPACITRON

Estado al 5 de octubre de 2026. El alcance es el de las 14 historias de usuario del Laboratorio 3: todas están implementadas y sus 70 criterios de aceptación pasan las pruebas automáticas (`npm test`, 82 pruebas). Las evidencias de cada tarea de Jira se describen en [docs/GUIA_EVIDENCIAS.md](docs/GUIA_EVIDENCIAS.md).

## Hecho y verificado

- [x] Recorrido completo en Chrome (catálogo, registro, inscripción y pago, QR, certificados, verificación, reportes, programa, administración, móvil) sin errores de consola.
- [x] **Concurrencia real por el último cupo (HU-05 CA-04) en Supabase:** dos inscripciones simultáneas por conexiones distintas; una se inscribe y la otra pasa a la lista de espera (`npm run verificar:supabase`).
- [x] **Tiempo real en Supabase (HU-10 CA-02):** la tabla `actividad_eventos` publica sus cambios por Realtime.
- [x] Corregido: el enlace de confirmación de cuenta no funcionaba desde la interfaz (el token de sesión pisaba el de confirmación).
- [x] Corregido: en modo local se perdían el código y los campos de los errores de validación, y un cambio podía perderse si la pestaña se recargaba de inmediato.
- [x] La pasarela simulada solo responde con el modo demostración activo (migración 0006).

## 1. Acción necesaria en Supabase

- [ ] **Ejecutar [`supabase/migrations/20261005000006_endurecimiento.sql`](supabase/migrations/20261005000006_endurecimiento.sql)** en el SQL Editor. Activa la protección de la pasarela simulada, el interruptor del modo demostración y el diagnóstico de Administración → «Sistema».
- [ ] **Verificar pg_cron:** después de la 0006, abre Administración → «Sistema» y revisa que «Tareas programadas» figure activo y con una ejecución reciente. Sin cron, recordatorios, vencimientos, certificados y encuestas solo se procesan mientras alguien tiene la app abierta.
- [ ] **Limpiar los datos de prueba** que dejaron las verificaciones (un evento cancelado «Prueba de concurrencia» y cuentas `*@prueba.capacitron.demo`): ejecuta [`supabase/reiniciar_demo.sql`](supabase/reiniciar_demo.sql) antes de la presentación.

## 2. Antes de usarlo con personas reales (fuera del alcance del sprint)

- [ ] **Pagos reales.** El pago se confirma con un simulador. Para producción, la plataforma de pago (PayPal; Yape y Plin mediante un agregador como Niubiz, Izipay o Culqi) debe confirmar por un webhook firmado, recibido en una Edge Function de Supabase.
- [ ] **Correo real.** Los correos se guardan en `capa.correos` y se leen en la Bandeja de la app. Falta un proveedor (Resend, SendGrid o SMTP) que los envíe.
- [ ] **Desactivar el modo demostración** (Administración → «Sistema»). Cierra el buzón público, el reloj de demostración y la pasarela simulada.
- [ ] **Base sin datos de demostración:** proyecto Supabase limpio sin ejecutar `select capa.sembrar_demo()`.

## 3. Simplificaciones conocidas

- Autenticación propia (bcrypt y sesiones con token en tablas propias) en lugar de Supabase Auth, para cumplir HU-01 tal como está escrita (enlace de 24 horas, bloqueo tras 5 intentos).
- Las fotos de ponentes se guardan dentro de la base (máximo 1 MB), no en Supabase Storage.
- La firma del certificado es el nombre del firmante, no una firma digital certificada. El PDF se genera en el navegador.
- Un evento de varios días tiene una jornada de asistencia por día, y el porcentaje mínimo se calcula sobre las jornadas.
- Al cancelar un pago confirmado se marca «reembolsado», pero no se ejecuta ninguna devolución.
- Hora de Perú (UTC-5) fija en fechas, recordatorios y jornadas.
- El escaneo con cámara funciona en HTTPS (Vercel) o en localhost; conviene probarlo en un celular real antes de la presentación.
