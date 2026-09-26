'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Mapa del circuito con los coches en directo.
 *
 * El servidor de carrera no manda el trazado, pero sí la posición (X, Z) de cada coche y su posición
 * normalizada sobre la pista (0 a 1 a lo largo de la vuelta). Con eso el trazado se dibuja solo: la pista
 * se divide en BINS tramos y en cada uno se promedia la posición de los coches que han pasado por ahí.
 * El resultado se guarda en el navegador por circuito, así la próxima vez el mapa ya sale completo.
 */

const BINS = 720
const VIEW_W = 800
const VIEW_H = 460
const PAD = 44
// Un punto que se aleja tanto de la media del tramo (metros) se descarta: es un coche fuera de la pista
const OUTLIER_METERS = 80
const STORAGE_PREFIX = 'rsx_track_outline_v1_'

type Bin = { x: number; z: number; n: number }

export type MapSample = {
  key: string
  x: number
  z: number
  spline: number
  inPits: boolean
  number: string
  color: string
  position: number
  label: string
  dim: boolean
}

function emptyBins(): Bin[] {
  return Array.from({ length: BINS }, () => ({ x: 0, z: 0, n: 0 }))
}

function loadBins(trackKey: string): Bin[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + trackKey)
    if (!raw) return emptyBins()
    const parsed = JSON.parse(raw) as Array<[number, number, number]>
    if (!Array.isArray(parsed) || parsed.length !== BINS) return emptyBins()
    return parsed.map(([x, z, n]) => ({ x, z, n }))
  } catch {
    return emptyBins()
  }
}

function saveBins(trackKey: string, bins: Bin[]) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + trackKey, JSON.stringify(bins.map((b) => [Math.round(b.x * 10) / 10, Math.round(b.z * 10) / 10, b.n])))
  } catch {
    // Sin almacenamiento el mapa se sigue dibujando, solo que hay que volver a recorrerlo
  }
}

export function TrackMap({
  trackKey,
  samples,
  labels,
}: {
  trackKey: string
  samples: MapSample[]
  labels: { building: string; coverage: string; empty: string }
}) {
  const bins = useRef<Bin[]>(emptyBins())
  const dirty = useRef(false)
  const [version, setVersion] = useState(0)

  // Al cambiar de circuito se carga el trazado guardado (o se empieza de cero)
  useEffect(() => {
    bins.current = trackKey ? loadBins(trackKey) : emptyBins()
    dirty.current = false
    setVersion((v) => v + 1)
  }, [trackKey])

  // Cada actualización de coches afina el trazado
  useEffect(() => {
    let changed = false
    for (const s of samples) {
      if (s.inPits || !(s.spline >= 0 && s.spline < 1)) continue
      const bin = bins.current[Math.floor(s.spline * BINS)]
      if (!bin) continue
      if (bin.n === 0) {
        bin.x = s.x
        bin.z = s.z
        bin.n = 1
        changed = true
      } else if (Math.hypot(s.x - bin.x, s.z - bin.z) <= OUTLIER_METERS) {
        const w = Math.min(bin.n, 30)
        bin.x = (bin.x * w + s.x) / (w + 1)
        bin.z = (bin.z * w + s.z) / (w + 1)
        bin.n = Math.min(bin.n + 1, 1000)
        changed = true
      }
    }
    if (changed) {
      dirty.current = true
      setVersion((v) => v + 1)
    }
  }, [samples])

  // Guardado en el navegador cada pocos segundos, no en cada actualización
  useEffect(() => {
    const id = setInterval(() => {
      if (dirty.current && trackKey) {
        saveBins(trackKey, bins.current)
        dirty.current = false
      }
    }, 15_000)
    return () => clearInterval(id)
  }, [trackKey])

  const geometry = useMemo(() => {
    const filled = bins.current.filter((b) => b.n > 0)
    if (filled.length < 12) return null
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (const b of filled) {
      minX = Math.min(minX, b.x)
      maxX = Math.max(maxX, b.x)
      minZ = Math.min(minZ, b.z)
      maxZ = Math.max(maxZ, b.z)
    }
    const spanX = Math.max(maxX - minX, 1)
    const spanZ = Math.max(maxZ - minZ, 1)
    const scale = Math.min((VIEW_W - PAD * 2) / spanX, (VIEW_H - PAD * 2) / spanZ)
    const offsetX = (VIEW_W - spanX * scale) / 2
    const offsetY = (VIEW_H - spanZ * scale) / 2
    // Norte arriba: la Z del mundo crece hacia arriba en pantalla
    const project = (x: number, z: number) => ({ x: offsetX + (x - minX) * scale, y: offsetY + (maxZ - z) * scale })

    let d = ''
    let last = -1
    bins.current.forEach((b, i) => {
      if (b.n === 0) return
      const p = project(b.x, b.z)
      d += `${last >= 0 && i - last <= 6 ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)} `
      last = i
    })
    const coverage = filled.length / BINS
    const closed = coverage > 0.92 && bins.current[0].n > 0 && bins.current[BINS - 1].n > 0
    if (closed) d += 'Z'

    // Línea de meta: pequeña marca perpendicular al sentido de la pista en el tramo 0
    let finish: { x1: number; y1: number; x2: number; y2: number } | null = null
    const a = bins.current[0]
    const b = bins.current[3]
    if (a.n > 0 && b.n > 0) {
      const pa = project(a.x, a.z)
      const pb = project(b.x, b.z)
      const dx = pb.x - pa.x
      const dy = pb.y - pa.y
      const len = Math.hypot(dx, dy) || 1
      const nx = (-dy / len) * 9
      const ny = (dx / len) * 9
      finish = { x1: pa.x - nx, y1: pa.y - ny, x2: pa.x + nx, y2: pa.y + ny }
    }

    return { d, coverage, project, finish }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  if (!geometry) {
    return (
      <div className="flex h-[260px] items-center justify-center px-6 text-center text-xs text-slate-600">
        {samples.length > 0 ? labels.building : labels.empty}
      </div>
    )
  }

  // Los coches se pintan de atrás hacia delante para que el líder quede por encima
  const ordered = [...samples].sort((a, b) => b.position - a.position)

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-[340px] w-full md:h-[400px]" preserveAspectRatio="xMidYMid meet">
        {/* Asfalto: borde oscuro, pista y línea central fina */}
        <path d={geometry.d} fill="none" stroke="#0b1424" strokeWidth={17} strokeLinecap="round" strokeLinejoin="round" />
        <path d={geometry.d} fill="none" stroke="#1d2a40" strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
        <path d={geometry.d} fill="none" stroke="#33445f" strokeWidth={1} strokeDasharray="3 7" strokeLinecap="round" strokeLinejoin="round" />
        {geometry.finish && <line x1={geometry.finish.x1} y1={geometry.finish.y1} x2={geometry.finish.x2} y2={geometry.finish.y2} stroke="#fff" strokeWidth={3} strokeDasharray="2 2" />}

        {ordered.map((car) => {
          const p = geometry.project(car.x, car.z)
          return (
            <g
              key={car.key}
              style={{ transform: `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`, transition: 'transform 6s linear', opacity: car.dim ? 0.3 : 1 }}
            >
              <title>{car.label}</title>
              <circle r={car.position === 1 ? 12 : 10.5} fill={car.color} stroke={car.inPits ? '#f59e0b' : '#04070d'} strokeWidth={car.inPits ? 2.5 : 2} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={car.number.length > 2 ? 8 : 10} fontWeight={800} fill="#fff" style={{ pointerEvents: 'none' }}>
                {car.number}
              </text>
            </g>
          )
        })}
      </svg>
      {geometry.coverage < 0.92 && (
        <p className="absolute bottom-2 left-3 text-[9px] font-bold uppercase tracking-wider text-slate-600">
          {labels.coverage.replace('{pct}', String(Math.round(geometry.coverage * 100)))}
        </p>
      )}
    </div>
  )
}
