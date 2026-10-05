import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Clock, List, SignOut, UserCircle, X, CaretDown, Tray } from '@phosphor-icons/react'
import { useApp } from '../lib/app'
import { ROL } from '../lib/formato'
import { Marca } from './tejido'
import { cx } from './ui'

interface ItemNav { to: string; texto: string; fin?: boolean }

function itemsPara(rol: string | undefined): ItemNav[] {
  const base: ItemNav[] = [{ to: '/', texto: 'Eventos', fin: true }]
  switch (rol) {
    case 'organizador':
      return [...base, { to: '/organizador', texto: 'Mis eventos', fin: true }, { to: '/organizador/reportes', texto: 'Reportes' },
              { to: '/mis-inscripciones', texto: 'Mis inscripciones' }]
    case 'ponente':
      return [...base, { to: '/ponente', texto: 'Mis charlas' }, { to: '/mis-inscripciones', texto: 'Mis inscripciones' }]
    case 'admin':
      return [...base, { to: '/admin', texto: 'Administración' }]
    case 'asistente':
      return [...base, { to: '/mis-inscripciones', texto: 'Mis inscripciones' }]
    default:
      return base
  }
}

export function Shell({ children }: { children: ReactNode }) {
  const { usuario, noLeidos, sistema, modo } = useApp()
  const [menuMovil, setMenuMovil] = useState(false)
  const loc = useLocation()
  const items = [...itemsPara(usuario?.rol), { to: '/verificar', texto: 'Verificar certificado' }]

  useEffect(() => {
    setMenuMovil(false)
  }, [loc.pathname])

  const desfase = sistema?.reloj_desfase_min ?? 0

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-superficie focus:px-3 focus:py-2">
        Saltar al contenido
      </a>
      <header className="no-imprimir sticky top-0 z-40 bg-grana-oscura text-white">
        <div className="mx-auto flex h-[60px] max-w-[1240px] items-center gap-2 px-4 sm:px-6">
          <Link to="/" className="mr-3 flex items-center gap-2.5 rounded-lg no-underline" aria-label="CAPACITRON, inicio">
            <Marca className="size-7" />
            <span className="text-[15px] font-semibold tracking-[0.06em]">CAPACITRON</span>
          </Link>

          <nav aria-label="Principal" className="hidden flex-1 items-center gap-0.5 lg:flex">
            {items.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.fin}
                className={({ isActive }) => cx('rounded-lg px-3 py-2 text-sm no-underline transition-colors',
                  isActive ? 'bg-white/14 font-medium text-white' : 'text-white/78 hover:bg-white/8 hover:text-white')}>
                {i.texto}
              </NavLink>
            ))}
          </nav>
          <div className="flex-1 lg:hidden" />

          {desfase !== 0 && (
            <span title="El reloj de demostración está adelantado" className="hidden items-center gap-1.5 rounded-full bg-qolle px-2.5 py-1 text-xs font-semibold text-tinta sm:inline-flex">
              <Clock weight="bold" className="size-3.5" />
              Reloj demo {desfase > 0 ? '+' : '−'}{formatearDesfase(Math.abs(desfase))}
            </span>
          )}

          {usuario ? (
            <>
              <Link to="/bandeja" aria-label={`Bandeja de correo${noLeidos ? `, ${noLeidos} sin leer` : ''}`}
                className="relative rounded-lg p-2 text-white/85 transition-colors hover:bg-white/10 hover:text-white">
                <Bell className="size-[22px]" />
                {noLeidos > 0 && (
                  <span className="num absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-qolle px-1 text-[11px] font-bold text-tinta">
                    {noLeidos > 99 ? '99+' : noLeidos}
                  </span>
                )}
              </Link>
              <MenuUsuario />
            </>
          ) : (
            <div className="hidden items-center gap-1 sm:flex">
              <Link to="/ingresar" className="rounded-lg px-3 py-2 text-sm text-white/85 no-underline hover:bg-white/10 hover:text-white">Ingresar</Link>
              <Link to="/registro" className="pulsable rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-grana-oscura no-underline hover:bg-white/90">Crear cuenta</Link>
            </div>
          )}

          <button className="rounded-lg p-2 text-white/85 hover:bg-white/10 lg:hidden" aria-label="Abrir menú"
            aria-expanded={menuMovil} onClick={() => setMenuMovil((v) => !v)}>
            {menuMovil ? <X className="size-6" /> : <List className="size-6" />}
          </button>
        </div>
        <div className="franja-tejida" aria-hidden />

        {menuMovil && (
          <nav aria-label="Principal" className="aparece border-t border-white/10 bg-grana-oscura px-4 pb-4 pt-2 lg:hidden">
            {items.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.fin}
                className={({ isActive }) => cx('block rounded-lg px-3 py-3 text-[15px] no-underline',
                  isActive ? 'bg-white/14 font-medium text-white' : 'text-white/85')}>
                {i.texto}
              </NavLink>
            ))}
            {!usuario && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link to="/ingresar" className="rounded-lg border border-white/30 py-2.5 text-center text-sm text-white no-underline">Ingresar</Link>
                <Link to="/registro" className="rounded-lg bg-white py-2.5 text-center text-sm font-medium text-grana-oscura no-underline">Crear cuenta</Link>
              </div>
            )}
          </nav>
        )}
      </header>

      <main id="contenido" className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-7 sm:px-6 sm:py-9">{children}</main>

      <footer className="no-imprimir border-t border-linea bg-superficie">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-2 px-4 py-5 text-[13px] text-tinta-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>CAPACITRON · Ingeniería de Software, UNSAAC 2026</p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {modo === 'local' && <span>Modo local con datos de demostración ficticios</span>}
            {modo === 'supabase' && <span>Conectado a Supabase</span>}
            {sistema?.modo_demo && (
              <Link to="/correo-demo" className="inline-flex items-center gap-1 text-tinta-2 underline-offset-2 hover:underline">
                <Tray className="size-4" /> Buzón de demostración
              </Link>
            )}
          </p>
        </div>
      </footer>
    </div>
  )
}

function formatearDesfase(min: number) {
  if (min < 60) return `${min} min`
  if (min < 60 * 48) return `${Math.round(min / 6) / 10} h`.replace('.', ',')
  return `${Math.round(min / 144) / 10} días`.replace('.', ',')
}

function MenuUsuario() {
  const { usuario, salir } = useApp()
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navegar = useNavigate()

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', esc)
    }
  }, [abierto])

  if (!usuario) return null
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-2 text-white/90 hover:bg-white/10">
        <span className="grid size-8 place-items-center rounded-lg bg-white/15 text-[13px] font-semibold">
          {usuario.nombres[0]}{usuario.apellidos[0]}
        </span>
        <CaretDown className="hidden size-3.5 sm:block" weight="bold" />
      </button>
      {abierto && (
        <div role="menu" className="aparece absolute right-0 top-[calc(100%+6px)] w-64 origin-top-right rounded-xl border border-linea bg-superficie p-1.5 text-tinta shadow-flotante">
          <div className="px-3 pb-2.5 pt-2">
            <p className="truncate text-sm font-semibold">{usuario.nombre_completo}</p>
            <p className="truncate text-[13px] text-tinta-3">{usuario.correo}</p>
            <p className="mt-1 text-xs text-tinta-3">
              {ROL[usuario.rol]}{usuario.institucion ? ` · ${usuario.institucion.siglas ?? usuario.institucion.nombre}` : ''}
            </p>
          </div>
          <div className="my-1 h-px bg-linea" />
          <button role="menuitem" onClick={() => { setAbierto(false); navegar('/perfil') }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-hundido">
            <UserCircle className="size-[18px] text-tinta-3" /> Mi perfil
          </button>
          <button role="menuitem" onClick={() => { setAbierto(false); navegar('/bandeja') }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-hundido">
            <Bell className="size-[18px] text-tinta-3" /> Bandeja de correo
          </button>
          <div className="my-1 h-px bg-linea" />
          <button role="menuitem" onClick={async () => { setAbierto(false); await salir(); navegar('/') }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-hundido">
            <SignOut className="size-[18px] text-tinta-3" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}
