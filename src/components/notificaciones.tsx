import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { CheckCircle, Info, WarningCircle, X } from '@phosphor-icons/react'
import { ErrorApi } from '../lib/backend'
import { cx } from './ui'

type Tipo = 'exito' | 'error' | 'info'
interface Nota { id: number; tipo: Tipo; texto: string; saliendo?: boolean }

interface Ctx {
  exito: (t: string) => void
  error: (t: string | unknown) => void
  info: (t: string) => void
}

const NotaCtx = createContext<Ctx | null>(null)
let siguiente = 1

export function ProveedorNotificaciones({ children }: { children: ReactNode }) {
  const [notas, setNotas] = useState<Nota[]>([])

  const cerrar = useCallback((id: number) => {
    setNotas((n) => n.map((x) => (x.id === id ? { ...x, saliendo: true } : x)))
    window.setTimeout(() => setNotas((n) => n.filter((x) => x.id !== id)), 160)
  }, [])

  const agregar = useCallback((tipo: Tipo, texto: string) => {
    const id = siguiente++
    setNotas((n) => [...n.slice(-2), { id, tipo, texto }])
  }, [])

  const valor: Ctx = {
    exito: (t) => agregar('exito', t),
    info: (t) => agregar('info', t),
    error: (e) => agregar('error', e instanceof ErrorApi || e instanceof Error ? e.message : String(e)),
  }

  return (
    <NotaCtx.Provider value={valor}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-5 sm:items-end">
        {notas.map((n) => <Tostada key={n.id} nota={n} onCerrar={() => cerrar(n.id)} />)}
      </div>
    </NotaCtx.Provider>
  )
}

function Tostada({ nota, onCerrar }: { nota: Nota; onCerrar: () => void }) {
  const restante = useRef(nota.tipo === 'error' ? 7000 : 4500)
  useEffect(() => {
    // El temporizador se detiene mientras la pestaña está oculta.
    let inicio = Date.now()
    let id = window.setTimeout(onCerrar, restante.current)
    const vis = () => {
      if (document.hidden) {
        window.clearTimeout(id)
        restante.current -= Date.now() - inicio
      } else {
        inicio = Date.now()
        id = window.setTimeout(onCerrar, Math.max(restante.current, 1200))
      }
    }
    document.addEventListener('visibilitychange', vis)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [onCerrar])

  const Icono = nota.tipo === 'exito' ? CheckCircle : nota.tipo === 'error' ? WarningCircle : Info
  return (
    <div
      role={nota.tipo === 'error' ? 'alert' : 'status'}
      className={cx(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-tinta px-4 py-3 text-sm text-white shadow-flotante',
        'transition-[opacity,transform] duration-150 ease-out',
        nota.saliendo ? 'translate-y-1 opacity-0' : 'aparece',
      )}
    >
      <Icono weight="fill" className={cx('mt-px size-5 shrink-0',
        nota.tipo === 'exito' ? 'text-[#7fc98b]' : nota.tipo === 'error' ? 'text-[#ff8a80]' : 'text-[#a9b7f0]')} />
      <p className="flex-1 leading-relaxed">{nota.texto}</p>
      <button onClick={onCerrar} aria-label="Cerrar aviso" className="-mr-1 rounded p-0.5 text-white/60 hover:text-white">
        <X className="size-4" />
      </button>
    </div>
  )
}

export function useNotas() {
  const c = useContext(NotaCtx)
  if (!c) throw new Error('useNotas fuera del proveedor')
  return c
}
