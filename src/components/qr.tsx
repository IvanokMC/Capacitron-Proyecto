import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { CameraSlash } from '@phosphor-icons/react'
import { cx } from './ui'

export function ImagenQr({ texto, tamano = 220, className, alt }: { texto: string; tamano?: number; className?: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    QRCode.toDataURL(texto, { width: tamano * 2, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#161a2e', light: '#ffffff' } })
      .then((u) => vivo && setSrc(u))
    return () => {
      vivo = false
    }
  }, [texto, tamano])
  return src
    ? <img src={src} alt={alt} width={tamano} height={tamano} className={cx('rounded-lg', className)} />
    : <div style={{ width: tamano, height: tamano }} className="esqueleto" aria-hidden />
}

export const qrDataUrl = (texto: string, ancho = 600) =>
  QRCode.toDataURL(texto, { width: ancho, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#161a2e', light: '#ffffff' } })

/**
 * Lector de QR con la cámara (trasera por defecto). Ignora lecturas repetidas
 * del mismo código durante 2,5 s para no registrar dos veces al mismo asistente.
 */
export function EscanerQr({ onLeer, pausado }: { onLeer: (texto: string) => void; pausado?: boolean }) {
  const video = useRef<HTMLVideoElement>(null)
  const ultimo = useRef<{ t: string; en: number } | null>(null)
  const cb = useRef(onLeer)
  cb.current = onLeer
  const pausadoRef = useRef(pausado)
  pausadoRef.current = pausado
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    let escaner: import('qr-scanner').default | null = null
    let vivo = true
    ;(async () => {
      try {
        const { default: QrScanner } = await import('qr-scanner')
        if (!vivo || !video.current) return
        if (!(await QrScanner.hasCamera())) {
          setError('No encontramos una cámara en este dispositivo. Escribe el código manualmente.')
          return
        }
        escaner = new QrScanner(video.current, (r) => {
          if (pausadoRef.current) return
          const ahora = Date.now()
          if (ultimo.current && ultimo.current.t === r.data && ahora - ultimo.current.en < 2500) return
          ultimo.current = { t: r.data, en: ahora }
          cb.current(r.data)
        }, { returnDetailedScanResult: true, highlightScanRegion: true, highlightCodeOutline: true, preferredCamera: 'environment', maxScansPerSecond: 6 })
        await escaner.start()
        if (vivo) setListo(true)
      } catch (e: any) {
        const msg = String(e?.name ?? e ?? '')
        setError(msg.includes('NotAllowed') || msg.includes('Permission')
          ? 'No tenemos permiso para usar la cámara. Actívalo en la configuración del navegador o escribe el código.'
          : 'No pudimos abrir la cámara. Escribe el código manualmente.')
      }
    })()
    return () => {
      vivo = false
      escaner?.stop()
      escaner?.destroy()
    }
  }, [])

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-tinta">
      <video ref={video} className="size-full object-cover" muted playsInline />
      {!listo && !error && <p className="absolute inset-0 grid place-items-center text-sm text-white/70">Abriendo la cámara…</p>}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-white/85">
          <CameraSlash className="size-8" />
          {error}
        </div>
      )}
    </div>
  )
}

/** Identificador anónimo del navegador (límite de consultas en modo local). */
export function idNavegador() {
  try {
    let id = localStorage.getItem('capacitron.navegador')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('capacitron.navegador', id)
    }
    return id
  } catch {
    return 'sin-almacenamiento'
  }
}
