# Product


## Platform

web

## Stack

React + Vite + TypeScript en el frontend y Supabase (Postgres) como backend, elegido por el equipo. Toda la lógica de negocio vive en funciones SQL (RPC) que corren igual en Supabase y en PGlite (Postgres en el navegador), de modo que la demo funciona sin credenciales. Pagos (Yape, Plin, PayPal) y correos son simulados dentro del sistema.

## Users

- **Asistentes**: estudiantes de pre y posgrado y público general que buscan capacitarse. Se inscriben desde el celular o la computadora, pagan, muestran su QR en la puerta y descargan su certificado.
- **Organizadores / coordinadores académicos** de universidades, institutos y centros de capacitación. Crean eventos, controlan cupos, escanean QR en el ingreso, emiten y revocan certificados y miden la participación.
- **Ponentes y docentes invitados**: figuran en el programa y gestionan el enlace de videoconferencia de eventos virtuales.
- **Verificadores**: empleadores, entidades certificadoras y colegios profesionales que comprueban la autenticidad de un certificado sin crear cuenta.
- **Administración de la plataforma**: gestiona instituciones, usuarios y planes (Básico, Pro, Enterprise).

## Product Purpose

CAPACITRON centraliza en una sola plataforma web la creación de eventos académicos, las inscripciones, los pagos, la asistencia con QR, los certificados digitales verificables y las métricas de participación. Reemplaza formularios dispersos, listas en papel y certificados manuales, que causan duplicidad, pérdida de datos y sobrecarga administrativa. Éxito: un organizador lleva un evento de la publicación al certificado sin hojas de cálculo, y un tercero confirma un certificado en segundos.

## Positioning

Frente a Eventbrite o Zoom Events, CAPACITRON está hecho para el ciclo académico completo: asistencia por jornadas que decide la elegibilidad al certificado, certificados con código y QR verificables públicamente (con revocación registrada) y planes por institución.

## Operating Context

- Proyecto académico del curso Ingeniería de Software (UNSAAC, 2026), basado en la Guía 2 (Agile inception) y el Laboratorio 3 (14 historias de usuario con criterios de aceptación). Se presenta en clase con datos de demostración.
- El ingreso a un evento presencial ocurre en una puerta o mesa de registro: el organizador escanea QR con el celular, muchas veces de pie y con prisa.
- Hora de negocio en Perú (UTC-5). Moneda: soles (S/).
- Un reloj de demostración permite adelantar el tiempo para mostrar recordatorios, vencimientos, certificados y encuestas.

## Capabilities and Constraints

- Las 14 historias (HU-01 a HU-14) están implementadas en SQL y cubiertas por pruebas automáticas de sus criterios de aceptación.
- Pagos y correos son simulados; Yape y Plin no tienen API pública. Los correos llegan a una bandeja dentro de la app y a un buzón de demostración público.
- Sin Supabase configurado, la app corre en modo local (PGlite en IndexedDB, compartido entre pestañas).
- Interfaz en español (Perú).

## Brand Commitments

Nombre del producto: CAPACITRON. No hay logo, paleta ni tipografía definidos por el equipo.

## Evidence on Hand

- Guia 2.pdf (visión, interesados, Lean Canvas, riesgos) y Laboratorio_3_CAPACITRON_APA (1).docx (historias y backlog), en la raíz del proyecto.
- No hay testimonios, clientes ni métricas reales: no se deben inventar. Los datos de la demo son ficticios y se rotulan como tales.

## Product Principles

1. Cada regla de negocio se aplica en el servidor (SQL), nunca solo en la interfaz.
2. El estado de cada persona frente a un evento (inscrita, pendiente de pago, en espera, asistió, certificada) debe leerse de un vistazo.
3. Los errores dicen qué pasó y qué hacer después, en español claro.
4. Funciona igual de bien en el celular de quien se inscribe o escanea que en la computadora de quien coordina.
5. La confianza del certificado es el producto: verificación pública, mínima exposición de datos personales.

## Accessibility & Inclusion

Público universitario y general, uso frecuente en celular y con luz variable (auditorios, exteriores). Contraste WCAG AA, objetivos táctiles amplios en el flujo de escaneo e inscripción, y respeto de prefers-reduced-motion.
