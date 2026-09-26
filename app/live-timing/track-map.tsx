'use client'

import { useEffect, useRef, useState } from 'react'
import { extractCenterline, pointAt, shortestDelta, snapToCenterline, type Centerline } from '@/lib/track-centerline'

/**
 * Mapa del circuito estilo "pit wall", con los coches en directo.
 *
 * Usa el mapa oficial del circuito que tiene el servidor de carrera (map.png) y sus parámetros (map.ini) para pasar
 * la posición de cada coche (X, Z del juego) a un punto del mapa, con la misma fórmula que el propio Server Manager:
 *   px = (x + X_OFFSET) / SCALE_FACTOR + PADDING
 *   py = (z + Z_OFFSET) / SCALE_FACTOR + PADDING
 * Si el mapa es vertical se gira 90° para aprovechar el ancho de la pantalla, como hace el Server Manager.
 *
 * El servidor solo da la posición de cada coche cada pocos segundos, y en línea recta entre dos posiciones un coche
 * cortaría las curvas. Por eso de la propia imagen del mapa se saca la línea central de la pista: cada coche se pega a
 * ella y se mueve a lo largo de la pista, siguiendo sus curvas. La calle de boxes y los coches fuera de pista no se
 * pegan, van en línea recta a su posición real.
 */

// Relación alto/ancho a partir de la cual el Server Manager gira el mapa
const ROTATE_RATIO = 1.07
// Distancia máxima (en píxeles del mapa) a la que un coche se considera "en pista" y se pega a la línea central
const SNAP_MAX_DISTANCE = 45

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

type Anim = {
  onLine: boolean
  s0: number
  s1: number
  from: { x: number; y: number }
  to: { x: number; y: number }
  t0: number
  dur: number
}

const centerlineCache = new Map<string, Promise<Centerline | null>>()

/** Carga el mapa en un canvas una sola vez por circuito y saca su línea central. */
function loadCenterline(url: string): Promise<Centerline | null> {
  let cached = centerlineCache.get(url)
  if (!cached) {
    cached = new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (!ctx) return resolve(null)
          ctx.drawImage(img, 0, 0)
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
          resolve(extractCenterline(data, canvas.width, canvas.height, 4))
        } catch {
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = url
    })
    centerlineCache.set(url, cached)
  }
  return cached
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
  const [line, setLine] = useState<Centerline | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading')

  const anims = useRef<Map<string, Anim>>(new Map())
  const nodes = useRef<Map<string, { g: SVGGElement | null; arrow: SVGGElement | null }>>(new Map())
  const lastUpdate = useRef(0)
  // Sentido de marcha respecto al recorrido de la línea central: +1 / -1, se deduce de cómo avanzan los coches
  const dirVotes = useRef(0)

  const query = `source=${encodeURIComponent(source)}&track=${encodeURIComponent(track)}&config=${encodeURIComponent(config)}`
  const imageUrl = `/api/live-timing/track-map?${query}&kind=image`

  useEffect(() => {
    anims.current = new Map()
    dirVotes.current = 0
    lastUpdate.current = 0
    setLine(null)
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
        loadCenterline(`/api/live-timing/track-map?${query}&kind=image`).then((found) => {
          if (alive) setLine(found)
        })
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

  // Cada actualización de posiciones prepara el movimiento de cada coche hasta su nueva posición
  useEffect(() => {
    if (!meta) return
    const now = performance.now()
    const interval = lastUpdate.current ? Math.min(Math.max(now - lastUpdate.current, 2000), 8000) : 6000
    lastUpdate.current = now
    const seen = new Set<string>()

    // Posición mostrada ahora mismo (para que el nuevo movimiento parta de ahí y no dé saltos)
    const displayed = (anim: Anim) => {
      const t = Math.min(1, Math.max(0, (now - anim.t0) / anim.dur))
      if (anim.onLine && line) return { s: anim.s0 + (anim.s1 - anim.s0) * t, ...pointAt(line, anim.s0 + (anim.s1 - anim.s0) * t) }
      return { s: anim.s1, x: anim.from.x + (anim.to.x - anim.from.x) * t, y: anim.from.y + (anim.to.y - anim.from.y) * t }
    }

    for (const car of samples) {
      seen.add(car.key)
      const raw = { x: (car.x + meta.offsetX) / meta.scale + meta.padding, y: (car.z + meta.offsetZ) / meta.scale + meta.padding }
      const snap = line && !car.inPits ? snapToCenterline(line, raw.x, raw.y) : null
      const onLine = Boolean(snap && snap.distance <= SNAP_MAX_DISTANCE)
      const prev = anims.current.get(car.key)

      if (!prev) {
        anims.current.set(car.key, { onLine, s0: snap?.s ?? 0, s1: snap?.s ?? 0, from: raw, to: raw, t0: now, dur: interval })
        continue
      }
      const cur = displayed(prev)
      if (onLine && prev.onLine && line && snap) {
        const delta = shortestDelta(line, cur.s, snap.s)
        if (Math.abs(delta) > 6) dirVotes.current += Math.sign(delta) * Math.min(Math.abs(delta), 200)
        anims.current.set(car.key, { onLine: true, s0: cur.s, s1: cur.s + delta, from: raw, to: raw, t0: now, dur: interval })
      } else {
        anims.current.set(car.key, { onLine, s0: snap?.s ?? 0, s1: snap?.s ?? 0, from: { x: cur.x, y: cur.y }, to: raw, t0: now, dur: interval })
      }
    }
    for (const key of Array.from(anims.current.keys())) if (!seen.has(key)) anims.current.delete(key)
  }, [samples, meta, line])

  // Bucle de animación: mueve cada marcador directamente en el DOM, sin repintar React en cada fotograma
  useEffect(() => {
    if (!meta) return
    let raf = 0
    const tick = () => {
      const now = performance.now()
      const travelDir = dirVotes.current === 0 ? 0 : Math.sign(dirVotes.current)
      anims.current.forEach((anim, key) => {
        const node = nodes.current.get(key)
        if (!node?.g) return
        const t = Math.min(1, Math.max(0, (now - anim.t0) / anim.dur))
        let x: number
        let y: number
        let angle: number | null = null
        if (anim.onLine && line) {
          const p = pointAt(line, anim.s0 + (anim.s1 - anim.s0) * t)
          x = p.x
          y = p.y
          angle = p.angle
        } else {
          x = anim.from.x + (anim.to.x - anim.from.x) * t
          y = anim.from.y + (anim.to.y - anim.from.y) * t
        }
        const view = rotated ? { x: meta.height - y, y: x } : { x, y }
        node.g.setAttribute('transform', `translate(${view.x.toFixed(1)} ${view.y.toFixed(1)})`)
        if (node.arrow) {
          if (angle == null || travelDir === 0) {
            node.arrow.setAttribute('visibility', 'hidden')
          } else {
            node.arrow.setAttribute('visibility', 'visible')
            node.arrow.setAttribute('transform', `rotate(${(angle + (travelDir < 0 ? 180 : 0) + (rotated ? 90 : 0)).toFixed(0)})`)
          }
        }
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [meta, line, rotated])

  if (state !== 'ready' || !meta) {
    return (
      <div className="flex h-[240px] items-center justify-center px-6 text-center text-xs text-slate-600">
        {state === 'unavailable' ? labels.unavailable : labels.loading}
      </div>
    )
  }

  const viewW = rotated ? meta.height : meta.width
  const viewH = rotated ? meta.width : meta.height
  // Tamaño de los coches en unidades del mapa: se calcula para que midan lo mismo en pantalla sea cual sea la resolución del mapa
  const unit = viewW / 900

  const setNode = (key: string, part: 'g' | 'arrow', el: SVGGElement | null) => {
    const node = nodes.current.get(key) || { g: null, arrow: null }
    node[part] = el
    nodes.current.set(key, node)
  }

  // Los coches se pintan de atrás hacia delante para que el líder quede por encima
  const ordered = [...samples].sort((a, b) => b.position - a.position)

  return (
    <div className="relative bg-[radial-gradient(ellipse_at_center,#0a1030_0%,#02030f_78%)]">
      <svg viewBox={`0 0 ${viewW} ${viewH}`} className="mx-auto block max-h-[520px] w-full" preserveAspectRatio="xMidYMid meet">
        {/* Mapa oficial del servidor: la pista es blanca con el borde fino, así que sobre el fondo oscuro se lee tal cual */}
        <g transform={rotated ? `translate(${meta.height} 0) rotate(90)` : undefined}>
          <image href={imageUrl} width={meta.width} height={meta.height} style={{ filter: 'drop-shadow(0 0 2px #000)' }} />
        </g>

        {ordered.map((car) => {
          const r = (car.position === 1 ? 12 : 10) * unit
          const labelW = (car.initials.length * 7 + 8) * unit
          return (
            <g key={car.key} ref={(el) => setNode(car.key, 'g', el)} style={{ opacity: car.dim ? 0.28 : 1 }}>
              <title>{car.label}</title>
              {/* Flecha de rumbo: gira con la pista */}
              <g ref={(el) => setNode(car.key, 'arrow', el)} visibility="hidden">
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
