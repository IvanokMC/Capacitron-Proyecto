// Edge Function «url-comprobante» (CAP-92 · George, DevOps · HU-16). Se ejecuta en Supabase (Deno), no en el navegador.
//
// Entrega un enlace firmado de 60 segundos para ver la captura de un comprobante de pago, solo si la sesión de
// CAPACITRON puede verla (su dueña o la administración). Quién puede lo decide la base de datos
// (public.ruta_comprobante_autorizada, migración 20261122000002_bucket_comprobantes.sql); aquí solo se firma.
// La clave de servicio (SUPABASE_SERVICE_ROLE_KEY) existe solo en el servidor: el navegador nunca la ve.
//
// Teoría de Diseño de Software: encapsulación (diap. 20–24): una sola regla de acceso, en la base de datos;
// SRP (diap. 39–49): esta función solo valida la sesión con esa regla y firma.
//
// Desplegar: supabase functions deploy url-comprobante (SUPABASE_URL, SUPABASE_ANON_KEY y
// SUPABASE_SERVICE_ROLE_KEY ya están disponibles en las Edge Functions de Supabase).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const SEGUNDOS = 60
const json = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  let token: unknown, ruta: unknown
  try { ({ token, ruta } = await req.json()) } catch { return json({ error: 'Pedido inválido.' }, 400) }
  if (typeof token !== 'string' || typeof ruta !== 'string') return json({ error: 'Falta la sesión o la ruta.' }, 400)

  const url = Deno.env.get('SUPABASE_URL')!
  // 1. ¿Puede esta sesión ver la captura? Con la clave pública, como cualquier otra llamada de la app.
  const publico = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } })
  const { data, error } = await publico.rpc('ruta_comprobante_autorizada', { p: { token, ruta } })
  if (error || !data?.ruta) return json({ error: 'No tienes acceso a este comprobante.' }, 403)

  // 2. Firmar con la clave de servicio, solo la ruta que la base de datos autorizó.
  const servicio = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const firmada = await servicio.storage.from('comprobantes').createSignedUrl(data.ruta, SEGUNDOS)
  if (firmada.error || !firmada.data) return json({ error: 'No se pudo preparar el enlace.' }, 500)
  return json({ url: firmada.data.signedUrl })
})
