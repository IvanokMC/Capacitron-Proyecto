import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:4173'
const OUT = process.argv[2] ?? './capturas-e2e'
mkdirSync(OUT, { recursive: true })
const errores = []
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
page.on('console', (m) => { if (m.type() === 'error') errores.push(`[console] ${m.text()}`) })
page.on('pageerror', (e) => errores.push(`[pageerror] ${e.message}`))
await page.setViewport({ width: 1440, height: 900 })

const esperarTexto = (t, ms = 60000) => page.waitForFunction((x) => document.body.innerText.includes(x), { timeout: ms }, t)
const foto = (n, full = true) => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: full })
async function paso(nombre, fn) {
  const t = Date.now()
  try { await fn(); console.log(`OK   ${nombre} (${Date.now() - t} ms)`) }
  catch (e) { console.log(`FAIL ${nombre}: ${e.message.split('\n')[0]}`); await foto(`fallo-${nombre}`).catch(() => {}) }
}
async function ingresar(correo) {
  await page.goto(`${BASE}/ingresar`)
  await page.waitForSelector('#correo')
  await page.$eval('#correo', (el, v) => { el.value = '' }, '')
  await page.type('#correo', correo)
  await page.type('#clave', 'Capacitron2026')
  await page.click('button[type=submit]')
  await page.waitForFunction(() => !location.pathname.startsWith('/ingresar'), { timeout: 20000 })
}

await paso('catalogo', async () => {
  await page.goto(BASE)
  await esperarTexto('Seminario: Inteligencia artificial', 90000)
  await new Promise((r) => setTimeout(r, 600))
  await foto('catalogo')
})
await paso('detalle', async () => {
  await page.click('a[href^="/eventos/"]')
  await esperarTexto('Programa')
  await new Promise((r) => setTimeout(r, 900))
  await foto('detalle')
})
await paso('verificar-invalido', async () => {
  await page.goto(`${BASE}/verificar/CAP-AAAA-BBBB-CCCC`)
  await esperarTexto('Certificado no encontrado')
})
await paso('asistente', async () => {
  await ingresar('estudiante@capacitron.demo')
  await page.goto(`${BASE}/mis-inscripciones`)
  await esperarTexto('Ver código QR')
  await foto('mis-inscripciones')
  await page.click('[role=tab]:nth-child(2)')
  await esperarTexto('Descargar certificado')
  await foto('historial')
})
await paso('inscripcion-pago', async () => {
  await page.goto(BASE)
  await esperarTexto('Curso: Desarrollo web')
  const enlaces = await page.$$('a[href^="/eventos/"]')
  for (const a of enlaces) if ((await a.evaluate((x) => x.textContent)).includes('Curso: Desarrollo web')) { await a.click(); break }
  await esperarTexto('Inscribirme')
  const b = await page.waitForSelector('xpath/.//button[normalize-space()="Inscribirme"]')
  await b.click()
  await esperarTexto('Reservar mi cupo')
  await (await page.waitForSelector('xpath/.//button[normalize-space()="Reservar mi cupo"]')).click()
  await esperarTexto('Cupo reservado')
  await (await page.waitForSelector('xpath/.//a[starts-with(normalize-space(),"Pagar")]')).click()
  await page.waitForSelector('#cel')
  await page.type('#cel', '987654321')
  await page.type('#cod', '123456')
  await foto('pasarela', false)
  await (await page.waitForSelector('xpath/.//dialog//button[starts-with(normalize-space(),"Pagar S/")]')).click()
  await esperarTexto('Pago confirmado', 20000)
})
await paso('bandeja', async () => {
  await page.goto(`${BASE}/bandeja`)
  await esperarTexto('Pago confirmado')
  await foto('bandeja')
})
await paso('organizador', async () => {
  await page.evaluate(() => localStorage.removeItem('capacitron.token'))
  await ingresar('coordinacion@capacitron.demo')
  await page.goto(`${BASE}/organizador`)
  await esperarTexto('Mis eventos')
  await foto('mis-eventos')
  await page.goto(`${BASE}/organizador/reportes`)
  await esperarTexto('Porcentaje de asistencia por evento')
  await new Promise((r) => setTimeout(r, 800))
  await foto('reportes')
})
await paso('gestion', async () => {
  await page.goto(`${BASE}/organizador`)
  await esperarTexto('Seminario: Inteligencia')
  const a = await page.waitForSelector('xpath/.//a[contains(., "Seminario: Inteligencia")]')
  await a.click()
  await esperarTexto('Cupos totales')
  await new Promise((r) => setTimeout(r, 900))
  await foto('gestion')
  await page.goto(page.url().split('?')[0] + '?pestana=asistencia')
  await esperarTexto('Ingresos registrados')
  await foto('asistencia')
})
await paso('encuesta-resultados', async () => {
  await page.goto(`${BASE}/organizador`)
  await (await page.waitForSelector('[role=tab]:nth-child(3)')).click()
  const a = await page.waitForSelector('xpath/.//a[contains(., "Taller de Ingeniería")]')
  await a.click()
  await esperarTexto('Cupos totales')
  await page.goto(page.url().split('?')[0] + '?pestana=encuesta')
  await esperarTexto('Resultados por pregunta')
  await foto('encuesta')
})
await paso('admin', async () => {
  await page.evaluate(() => localStorage.removeItem('capacitron.token'))
  await ingresar('admin@capacitron.demo')
  await page.goto(`${BASE}/admin?pestana=historial`)
  await esperarTexto('Revocó certificado')
  await page.goto(`${BASE}/admin?pestana=sistema`)
  await esperarTexto('Reloj de demostración')
  await foto('admin')
})
await paso('movil', async () => {
  await page.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 })
  await page.goto(BASE)
  await esperarTexto('Seminario: Inteligencia')
  await foto('movil-catalogo')
  await page.goto(`${BASE}/verificar`)
  await esperarTexto('Verificar un certificado')
  await foto('movil-verificar', false)
})

console.log('\nERRORES:\n' + (errores.join('\n') || '(ninguno)'))
await browser.close()
