'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Mapa del circuito estilo "pit wall", con los coches en directo.
 *
 * Usa el mapa oficial del circuito que tiene el servidor de carrera (map.png) y sus parámetros (map.ini) para pasar
 * la posición de cada coche (X, Z del juego) a un punto del mapa, con la misma fórmula que el propio Server Manager:
 *   px = (x + X_OFFSET) / SCALE_FACTOR + PADDING
 *   py = (z + Z_OFFSET) / SCALE_FACTOR + PADDING
 * Si el mapa es apaisado en vertical se gira 90° para aprovechar el ancho de la pantalla, como hace el Server Manager.
 */

// Relación alto/ancho a partir de la cual el Server Manager gira el mapa
const ROTATE_RATIO = 1.07

type MapMeta = { width: number; height: number; scale: number; offsetX: number; offsetZ: number; padding: number }

export type MapSample = {
  key: string
  x: number
  z: number
  inPits: boolean
  number: string
  initials: string
  color: string
  position: number
  label: string
  dim: boolean
}

export function TrackMap({
  source,
  track,
  config,
  samples,
  labels,
}: {
  source: string
  track: string
  config: string
  samples: MapSample[]
  labels: { loading: string; unavailable: string }
}) {
  const [meta, setMeta] = useState<MapMeta | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  // Rumbo (en grados sobre el mapa) de cada coche, deducido de su movimiento entre dos actualizaciones
  const headings = useRef<Map<string, { x: number; z: number; angle: number }>>(new Map())

  const query = `source=${encodeURIComponent(source)}&track=${encodeURIComponent(track)}&config=${encodeURIComponent(config)}`
  const imageUrl = `/api/live-timing/track-map?${query}&kind=image`

  useEffect(() => {
    if (!track) {
      setMeta(null)
      setState('loading')
      return
    }
    let alive = true
    setState('loading')
    fetch(`/api/live-timing/track-map?${query}&kind=meta`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('no map'))))
      .then((json: MapMeta) => {
        if (!alive) return
        setMeta(json)
        setState('ready')
      })
      .catch(() => {
        if (!alive) return
        setMeta(null)
        setState('unavailable')
      })
    return () => {
      alive = false
    }
  }, [query, track])

  if (state !== 'ready' || !meta) {
    return (
      <div className="flex h-[240px] items-center justify-center px-6 text-center text-xs text-slate-600">
        {state === 'unavailable' ? labels.unavailable : labels.loading}
      </div>
    )
  }

  const rotated = meta.height / meta.width > ROTATE_RATIO
  const viewW = rotated ? meta.height : meta.width
  const viewH = rotated ? meta.width : meta.height
  // Tamaño de los coches en unidades del mapa: se calcula para que midan lo mismo en pantalla sea cual sea la resolución del mapa
  const unit = viewW / 900

  const project = (x: number, z: number) => {
    const px = (x + meta.offsetX) / meta.scale + meta.padding
    const py = (z + meta.offsetZ) / meta.scale + meta.padding
    return rotated ? { x: meta.height - py, y: px } : { x: px, y: py }
  }

  // Los coches se pintan de atrás hacia delante para que el líder quede por encima
  const ordered = [...samples].sort((a, b) => b.position - a.position)

  // Rumbo: se recalcula solo si el coche se ha movido lo suficiente (más de 3 m); parado, conserva el último
  const angleFor = (car: MapSample) => {
    const prev = headings.current.get(car.key)
    const from = prev ? project(prev.x, prev.z) : null
    const to = project(car.x, car.z)
    let angle = prev?.angle ?? 0
    if (prev && from && Math.hypot(car.x - prev.x, car.z - prev.z) > 3) {
      angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
      headings.current.set(car.key, { x: car.x, z: car.z, angle })
    } else if (!prev) {
      headings.current.set(car.key, { x: car.x, z: car.z, angle })
    }
    return angle
  }

  return (
    <div className="relative bg-[radial-gradient(ellipse_at_center,#0a1030_0%,#02030f_78%)]">
      <svg viewBox={`0 0 ${viewW} ${viewH}`} className="mx-auto block max-h-[520px] w-full" preserveAspectRatio="xMidYMid meet">
        {/* Mapa oficial del servidor: la pista es blanca con el borde fino, así que sobre el fondo oscuro se lee tal cual */}
        <g transform={rotated ? `translate(${meta.height} 0) rotate(90)` : undefined}>
          <image href={imageUrl} width={meta.width} height={meta.height} style={{ filter: 'drop-shadow(0 0 2px #000)' }} />
        </g>

        {ordered.map((car) => {
          const p = project(car.x, car.z)
          const r = (car.position === 1 ? 12 : 10) * unit
          const angle = angleFor(car)
          const labelW = (car.initials.length * 7 + 8) * unit
          return (
            <g
              key={car.key}
              style={{ transform: `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`, transition: 'transform 6s linear', opacity: car.dim ? 0.28 : 1 }}
            >
              <title>{car.label}</title>
              {/* Flecha de rumbo */}
              <g transform={`rotate(${angle.toFixed(0)})`}>
                <path d={`M ${r + 9 * unit} 0 L ${r - 1 * unit} ${-6 * unit} L ${r - 1 * unit} ${6 * unit} Z`} fill={car.color} stroke="#04070d" strokeWidth={1 * unit} />
              </g>
              {car.position === 1 && <circle r={r + 4 * unit} fill="none" stroke="#f5c518" strokeWidth={2 * unit} />}
              <circle r={r} fill={car.color} stroke={car.inPits ? '#f59e0b' : '#04070d'} strokeWidth={(car.inPits ? 3 : 2) * unit} />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={(car.number.length > 2 ? 8 : 10) * unit}
                fontWeight={800}
                fill="#fff"
                style={{ pointerEvents: 'none' }}
              >
                {car.number}
              </text>
              {/* Etiqueta con las iniciales del piloto, como en el live map del servidor */}
              <g transform={`translate(${(r + 4 * unit).toFixed(1)} ${(r + 3 * unit).toFixed(1)})`}>
                <rect width={labelW} height={15 * unit} rx={3 * unit} fill="rgba(0,0,0,0.72)" />
                <text x={labelW / 2} y={7.8 * unit} textAnchor="middle" dominantBaseline="central" fontSize={9 * unit} fontWeight={800} fill="#fff" style={{ pointerEvents: 'none' }}>
                  {car.initials}
                </text>
              </g>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
