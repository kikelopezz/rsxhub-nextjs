'use client'

import { memo, useEffect, useRef, useState } from 'react'

/**
 * Mapa del circuito con los coches en directo.
 *
 * La posición de cada coche (X, Z del juego) se pasa al mapa oficial con la misma fórmula que el Server Manager:
 *   px = (x + X_OFFSET) / SCALE_FACTOR + PADDING
 *   py = (z + Z_OFFSET) / SCALE_FACTOR + PADDING
 *
 * El trazado no se saca de la imagen (un esqueleto del dibujo se equivoca en cuanto dos tramos se cruzan). Se aprende
 * de la propia carrera: cada coche informa de su progreso en la vuelta (NormalisedSplinePos, de 0 a 1) junto con su
 * posición. Con eso se construye una tabla progreso → posición, y cada coche avanza a lo largo de esa tabla. Así el
 * movimiento siempre va hacia delante y sigue las curvas reales de la pista. Mientras la tabla no tiene datos de un
 * tramo, el coche se mueve en línea recta entre sus dos últimas posiciones. Los coches en boxes van en línea recta.
 */

// Relación alto/ancho a partir de la cual el Server Manager gira el mapa
const ROTATE_RATIO = 1.07
// Número de tramos de la tabla progreso → posición (cada uno cubre 1/BINS de la vuelta)
const BINS = 480
// Peso de cada nueva observación en su tramo (media móvil): se adapta si cambia la trazada
const ADAPT = 0.25
// Parte de la vuelta que se dibuja como estela detrás del coche seleccionado
const TRAIL = 0.04
const TRAIL_POINTS = 28

type MapMeta = { width: number; height: number; scale: number; offsetX: number; offsetZ: number; padding: number }

export type MapSample = {
  key: string
  x: number
  z: number
  /** Progreso del coche en la vuelta (0-1), null si no lo informa el servidor */
  progress: number | null
  inPits: boolean
  number: string
  initials: string
  color: string
  position: number
  label: string
  dim: boolean
}

type Bin = { x: number; z: number }

type CarAnim = {
  /** true: avanza por la tabla progreso → posición; false: va en línea recta entre dos posiciones */
  onTrack: boolean
  p0: number
  dp: number
  x0: number
  z0: number
  x1: number
  z1: number
  t0: number
  dur: number
}

const wrap01 = (v: number) => v - Math.floor(v)
const wrapDelta = (d: number) => d - Math.round(d)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Posición del juego en el tramo de progreso `p`, interpolando con los tramos vecinos (si no hay ninguno, null). */
function worldAt(bins: Array<Bin | undefined>, p: number): Bin | null {
  const f = wrap01(p) * BINS
  const i0 = Math.floor(f) % BINS
  const t = f - Math.floor(f)
  const a = bins[i0]
  const b = bins[(i0 + 1) % BINS]
  if (a && b) return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }
  return a ?? b ?? null
}

function learn(bins: Array<Bin | undefined>, progress: number, x: number, z: number) {
  const i = Math.floor(wrap01(progress) * BINS) % BINS
  const b = bins[i]
  if (!b) bins[i] = { x, z }
  else {
    b.x += (x - b.x) * ADAPT
    b.z += (z - b.z) * ADAPT
  }
}

export const TrackMap = memo(function TrackMap({
  source,
  track,
  config,
  samples,
  selectedKey,
  onSelect,
  labels,
}: {
  source: string
  track: string
  config: string
  samples: MapSample[]
  selectedKey: string | null
  onSelect: (key: string) => void
  labels: { loading: string; unavailable: string }
}) {
  const [meta, setMeta] = useState<MapMeta | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading')

  const bins = useRef<Array<Bin | undefined>>([])
  const anims = useRef<Map<string, CarAnim>>(new Map())
  const nodes = useRef<Map<string, { g: SVGGElement | null; arrow: SVGGElement | null }>>(new Map())
  const trailEl = useRef<SVGPathElement | null>(null)
  const selectedRef = useRef<string | null>(selectedKey)
  const lastUpdate = useRef(0)

  const query = `source=${encodeURIComponent(source)}&track=${encodeURIComponent(track)}&config=${encodeURIComponent(config)}`
  const imageUrl = `/api/live-timing/track-map?${query}&kind=image`

  useEffect(() => {
    selectedRef.current = selectedKey
  }, [selectedKey])

  // Mapa nuevo: el trazado aprendido y las animaciones de la pista anterior ya no valen
  useEffect(() => {
    bins.current = []
    anims.current = new Map()
    lastUpdate.current = 0
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

  const rotated = meta ? meta.height / meta.width > ROTATE_RATIO : false

  // Cada actualización del leaderboard: aprende el trazado y prepara el avance de cada coche desde donde se ve ahora
  useEffect(() => {
    if (!meta) return
    const now = performance.now()
    const interval = lastUpdate.current ? Math.min(Math.max(now - lastUpdate.current, 2000), 8000) : 6000
    lastUpdate.current = now
    const seen = new Set<string>()

    for (const car of samples) {
      if (car.progress != null && !car.inPits) learn(bins.current, car.progress, car.x, car.z)
    }

    for (const car of samples) {
      seen.add(car.key)
      const prev = anims.current.get(car.key)
      const onTrack = car.progress != null && !car.inPits

      if (onTrack) {
        // Progreso que se está mostrando ahora mismo, para que el nuevo avance parta de ahí sin saltos
        const shown = prev ? (prev.onTrack ? prev.p0 + prev.dp * clamp01((now - prev.t0) / prev.dur) : null) : null
        const target = car.progress as number
        const p0 = shown ?? target
        const dp = shown == null ? 0 : wrapDelta(target - shown)
        anims.current.set(car.key, { onTrack: true, p0, dp, x0: car.x, z0: car.z, x1: car.x, z1: car.z, t0: now, dur: interval })
      } else {
        const from = prev ? currentRaw(prev, now) : { x: car.x, z: car.z }
        anims.current.set(car.key, { onTrack: false, p0: 0, dp: 0, x0: from.x, z0: from.z, x1: car.x, z1: car.z, t0: now, dur: interval })
      }
    }
    for (const key of Array.from(anims.current.keys())) if (!seen.has(key)) anims.current.delete(key)
  }, [samples, meta])

  // Bucle de animación: mueve los marcadores en el DOM, sin repintar React en cada fotograma
  useEffect(() => {
    if (!meta) return
    let raf = 0
    const toView = (x: number, z: number) => {
      const px = (x + meta.offsetX) / meta.scale + meta.padding
      const py = (z + meta.offsetZ) / meta.scale + meta.padding
      return rotated ? { x: meta.height - py, y: px } : { x: px, y: py }
    }
    const tick = () => {
      const now = performance.now()
      anims.current.forEach((anim, key) => {
        const node = nodes.current.get(key)
        if (!node?.g) return
        const t = clamp01((now - anim.t0) / anim.dur)
        let world: { x: number; z: number } | null = null
        if (anim.onTrack) world = worldAt(bins.current, anim.p0 + anim.dp * t)
        if (!world) world = { x: anim.x0 + (anim.x1 - anim.x0) * t, z: anim.z0 + (anim.z1 - anim.z0) * t }
        const v = toView(world.x, world.z)
        node.g.setAttribute('transform', `translate(${v.x.toFixed(1)} ${v.y.toFixed(1)})`)
        if (node.arrow) {
          const ahead = anim.onTrack ? worldAt(bins.current, anim.p0 + anim.dp * t + 0.002) : null
          if (!ahead) {
            node.arrow.setAttribute('visibility', 'hidden')
          } else {
            const a = toView(ahead.x, ahead.z)
            const angle = (Math.atan2(a.y - v.y, a.x - v.x) * 180) / Math.PI
            node.arrow.setAttribute('visibility', 'visible')
            node.arrow.setAttribute('transform', `rotate(${angle.toFixed(0)})`)
          }
        }
      })

      // Estela del coche seleccionado: el tramo de trazada que acaba de recorrer
      const trail = trailEl.current
      const sel = selectedRef.current ? anims.current.get(selectedRef.current) : undefined
      if (trail) {
        if (sel && sel.onTrack) {
          const p = sel.p0 + sel.dp * clamp01((now - sel.t0) / sel.dur)
          const pts: string[] = []
          for (let i = 0; i <= TRAIL_POINTS; i++) {
            const w = worldAt(bins.current, p - TRAIL + (TRAIL * i) / TRAIL_POINTS)
            if (!w) continue
            const v = toView(w.x, w.z)
            pts.push(`${i === 0 ? 'M' : 'L'}${v.x.toFixed(1)} ${v.y.toFixed(1)}`)
          }
          trail.setAttribute('d', pts.join(' '))
          trail.setAttribute('visibility', pts.length > 1 ? 'visible' : 'hidden')
        } else {
          trail.setAttribute('visibility', 'hidden')
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [meta, rotated])

  if (state !== 'ready' || !meta) {
    return (
      <div className="flex h-[240px] items-center justify-center px-6 text-center text-xs text-[#4b5563]">
        {state === 'unavailable' ? labels.unavailable : labels.loading}
      </div>
    )
  }

  const viewW = rotated ? meta.height : meta.width
  const viewH = rotated ? meta.width : meta.height
  const unit = viewW / 900

  const setNode = (key: string, part: 'g' | 'arrow', el: SVGGElement | null) => {
    const node = nodes.current.get(key) || { g: null, arrow: null }
    node[part] = el
    nodes.current.set(key, node)
  }

  // Los coches se pintan de atrás hacia delante para que el líder y el seleccionado queden por encima
  const ordered = [...samples].sort((a, b) => (b.key === selectedKey ? -1 : 0) - (a.key === selectedKey ? -1 : 0) || b.position - a.position)
  const selectedSample = samples.find((s) => s.key === selectedKey)

  return (
    <div className="relative bg-[#070a0f]">
      <svg viewBox={`0 0 ${viewW} ${viewH}`} className="mx-auto block max-h-[560px] w-full" preserveAspectRatio="xMidYMid meet">
        <g transform={rotated ? `translate(${meta.height} 0) rotate(90)` : undefined}>
          <image href={imageUrl} width={meta.width} height={meta.height} opacity={0.55} />
        </g>

        {/* Estela del coche seleccionado, sobre el trazado de la pista */}
        {selectedSample && (
          <path
            ref={(el) => {
              trailEl.current = el
            }}
            fill="none"
            stroke={selectedSample.color}
            strokeWidth={6 * unit}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
            visibility="hidden"
          />
        )}

        {ordered.map((car) => {
          const isSelected = car.key === selectedKey
          const r = (isSelected ? 15 : car.position === 1 ? 12 : 10) * unit
          const labelW = (car.initials.length * 7 + 8) * unit
          return (
            <g
              key={car.key}
              ref={(el) => setNode(car.key, 'g', el)}
              style={{ opacity: car.dim ? 0.28 : 1, cursor: 'pointer' }}
              onClick={() => onSelect(car.key)}
            >
              <title>{car.label}</title>
              <g ref={(el) => setNode(car.key, 'arrow', el)} visibility="hidden">
                <path d={`M ${r + 9 * unit} 0 L ${r - 1 * unit} ${-6 * unit} L ${r - 1 * unit} ${6 * unit} Z`} fill={car.color} stroke="#04070d" strokeWidth={1 * unit} />
              </g>
              {isSelected && (
                <>
                  <circle r={r + 9 * unit} fill="none" stroke="#ffffff" strokeWidth={2.5 * unit} opacity={0.9} />
                  <circle r={r + 16 * unit} fill="none" stroke={car.color} strokeWidth={1.5 * unit} opacity={0.45} />
                </>
              )}
              {car.position === 1 && !isSelected && <circle r={r + 4 * unit} fill="none" stroke="#f5c518" strokeWidth={2 * unit} />}
              <circle r={r} fill={car.color} stroke={car.inPits ? '#f59e0b' : isSelected ? '#ffffff' : '#04070d'} strokeWidth={(car.inPits || isSelected ? 3 : 2) * unit} />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={(car.number.length > 2 ? 8 : 10) * unit * (isSelected ? 1.2 : 1)}
                fontWeight={800}
                fill="#fff"
                style={{ pointerEvents: 'none' }}
              >
                {car.number}
              </text>
              <g transform={`translate(${(r + 5 * unit).toFixed(1)} ${(r + 4 * unit).toFixed(1)})`}>
                <rect width={labelW * (isSelected ? 1.3 : 1)} height={(isSelected ? 19 : 15) * unit} rx={3 * unit} fill={isSelected ? car.color : 'rgba(0,0,0,0.72)'} />
                <text
                  x={(labelW * (isSelected ? 1.3 : 1)) / 2}
                  y={(isSelected ? 9.5 : 7.8) * unit}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={(isSelected ? 11 : 9) * unit}
                  fontWeight={800}
                  fill="#fff"
                  style={{ pointerEvents: 'none' }}
                >
                  {car.initials}
                </text>
              </g>
            </g>
          )
        })}
      </svg>
    </div>
  )
})

function currentRaw(anim: CarAnim, now: number) {
  const t = clamp01((now - anim.t0) / anim.dur)
  return { x: anim.x0 + (anim.x1 - anim.x0) * t, z: anim.z0 + (anim.z1 - anim.z0) * t }
}
