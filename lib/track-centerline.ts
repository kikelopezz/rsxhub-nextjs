/**
 * Línea central de un circuito a partir de su mapa oficial (map.png del Server Manager).
 *
 * En el mapa la pista es una cinta blanca opaca con un borde oscuro muy fino, y la calle de boxes va en gris.
 * Se queda solo con la cinta (opaca y clara), se reduce a una línea de 1 píxel (adelgazado de Zhang-Suen),
 * se poda y se ordena en un recorrido. Con él los coches se pueden "pegar" a la pista y moverse siguiendo sus
 * curvas en vez de cortar en línea recta entre dos actualizaciones.
 */

export type CenterPoint = { x: number; y: number }
export type Centerline = {
  /** Puntos en píxeles del mapa original, ordenados a lo largo de la pista */
  points: CenterPoint[]
  /** Longitud acumulada hasta cada punto (mismo orden), en píxeles del mapa original */
  cumulative: number[]
  length: number
  /** true si el recorrido se cierra sobre sí mismo (circuito), false si es punto a punto */
  closed: boolean
}

const NEIGHBORS: Array<[number, number]> = [
  [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1],
]

/** Zhang-Suen: deja la máscara en una línea de 1 píxel de grosor sin romper su forma. */
function thin(mask: Uint8Array, w: number, h: number) {
  const idx = (x: number, y: number) => y * w + x
  let changed = true
  const toClear: number[] = []
  while (changed) {
    changed = false
    for (let step = 0; step < 2; step++) {
      toClear.length = 0
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (!mask[idx(x, y)]) continue
          const p2 = mask[idx(x, y - 1)]
          const p3 = mask[idx(x + 1, y - 1)]
          const p4 = mask[idx(x + 1, y)]
          const p5 = mask[idx(x + 1, y + 1)]
          const p6 = mask[idx(x, y + 1)]
          const p7 = mask[idx(x - 1, y + 1)]
          const p8 = mask[idx(x - 1, y)]
          const p9 = mask[idx(x - 1, y - 1)]
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
          if (b < 2 || b > 6) continue
          const a =
            (!p2 && p3 ? 1 : 0) + (!p3 && p4 ? 1 : 0) + (!p4 && p5 ? 1 : 0) + (!p5 && p6 ? 1 : 0) +
            (!p6 && p7 ? 1 : 0) + (!p7 && p8 ? 1 : 0) + (!p8 && p9 ? 1 : 0) + (!p9 && p2 ? 1 : 0)
          if (a !== 1) continue
          if (step === 0) {
            if (p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0) continue
          } else if (p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue
          toClear.push(idx(x, y))
        }
      }
      if (toClear.length > 0) changed = true
      for (const i of toClear) mask[i] = 0
    }
  }
}

/**
 * @param rgba   Píxeles RGBA del mapa (como los da getImageData)
 * @param width  Ancho del mapa original
 * @param height Alto del mapa original
 * @param factor Reducción antes de procesar (p. ej. 4 → un cuarto de resolución); la salida vuelve a escala original
 */
export function extractCenterline(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, factor = 4): Centerline | null {
  const w = Math.floor(width / factor)
  const h = Math.floor(height / factor)
  if (w < 20 || h < 20) return null

  // Máscara de la cinta: un bloque cuenta como pista si la mayoría de sus píxeles son opacos y claros
  let mask = new Uint8Array(w * h)
  const need = (factor * factor) / 2
  for (let by = 0; by < h; by++) {
    for (let bx = 0; bx < w; bx++) {
      let hits = 0
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const o = ((by * factor + dy) * width + (bx * factor + dx)) * 4
          if (rgba[o + 3] > 200 && rgba[o] > 190 && rgba[o + 1] > 190 && rgba[o + 2] > 190) hits++
        }
      }
      if (hits >= need) mask[by * w + bx] = 1
    }
  }

  // Las cintas de 1-2 píxeles reducidos se pierden al adelgazar: se cierran huecos con una dilatación mínima
  const dilated = new Uint8Array(mask)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (mask[y * w + x]) continue
      if (mask[y * w + x - 1] && mask[y * w + x + 1]) dilated[y * w + x] = 1
      else if (mask[(y - 1) * w + x] && mask[(y + 1) * w + x]) dilated[y * w + x] = 1
    }
  }
  mask = dilated

  thin(mask, w, h)

  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? mask[y * w + x] : 0)
  const neighborsOf = (x: number, y: number) =>
    NEIGHBORS.filter(([dx, dy]) => at(x + dx, y + dy)).map(([dx, dy]) => [x + dx, y + dy] as [number, number])

  // Las marcas de sector y la línea de meta cruzan la cinta y la parten en varios tramos: se separan en componentes
  // conexas, cada una se reduce a su camino más largo (así las rebabas del adelgazado no cuentan) y luego se vuelven a unir.
  const label = new Int32Array(w * h).fill(-1)
  const arcs: Array<Array<[number, number]>> = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x] || label[y * w + x] !== -1) continue
      // Componente por relleno
      const cells: Array<[number, number]> = []
      const stack: Array<[number, number]> = [[x, y]]
      label[y * w + x] = arcs.length
      while (stack.length) {
        const [cx, cy] = stack.pop()!
        cells.push([cx, cy])
        for (const [nx, ny] of neighborsOf(cx, cy)) {
          if (label[ny * w + nx] === -1) {
            label[ny * w + nx] = arcs.length
            stack.push([nx, ny])
          }
        }
      }
      if (cells.length < 12) {
        arcs.push([])
        continue
      }
      // Camino más largo de la componente: dos barridos en anchura (del extremo más lejano al otro extremo)
      const bfs = (from: [number, number]) => {
        const dist = new Map<number, number>()
        const parent = new Map<number, number>()
        const key = (p: [number, number]) => p[1] * w + p[0]
        dist.set(key(from), 0)
        const queue: Array<[number, number]> = [from]
        let last = from
        for (let qi = 0; qi < queue.length; qi++) {
          const cur = queue[qi]
          last = cur
          for (const nb of neighborsOf(cur[0], cur[1])) {
            if (!dist.has(key(nb))) {
              dist.set(key(nb), dist.get(key(cur))! + 1)
              parent.set(key(nb), key(cur))
              queue.push(nb)
            }
          }
        }
        return { last, parent }
      }
      const firstSweep = bfs(cells[0])
      const secondSweep = bfs(firstSweep.last)
      const path: Array<[number, number]> = []
      let k = secondSweep.last[1] * w + secondSweep.last[0]
      const startKey = firstSweep.last[1] * w + firstSweep.last[0]
      path.push(secondSweep.last)
      while (k !== startKey && secondSweep.parent.has(k)) {
        k = secondSweep.parent.get(k)!
        path.push([k % w, Math.floor(k / w)])
      }
      arcs.push(path)
    }
  }

  const usable = arcs.filter((p) => p.length >= 15).sort((p, q) => q.length - p.length)
  if (usable.length === 0) return null

  // Se encadenan los tramos: desde el más largo se añade siempre el tramo cuyo extremo esté más cerca del final de la cadena
  const maxGap = 40
  const dist2 = (p: [number, number], q: [number, number]) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2
  let chain: Array<[number, number]> = [...usable[0]]
  const remaining = usable.slice(1)
  for (const end of ['tail', 'head'] as const) {
    for (;;) {
      const tip = end === 'tail' ? chain[chain.length - 1] : chain[0]
      let bestIndex = -1
      let bestFlip = false
      let bestD = maxGap * maxGap
      remaining.forEach((arc, i) => {
        const dFirst = dist2(tip, arc[0])
        const dLast = dist2(tip, arc[arc.length - 1])
        if (dFirst < bestD) {
          bestD = dFirst
          bestIndex = i
          bestFlip = false
        }
        if (dLast < bestD) {
          bestD = dLast
          bestIndex = i
          bestFlip = true
        }
      })
      if (bestIndex < 0) break
      const [arc] = remaining.splice(bestIndex, 1)
      // Se orienta el tramo para que su extremo más cercano quede pegado a la cadena
      const oriented = end === 'tail' ? (bestFlip ? [...arc].reverse() : arc) : bestFlip ? arc : [...arc].reverse()
      chain = end === 'tail' ? [...chain, ...oriented] : [...oriented, ...chain]
    }
  }
  if (chain.length < 30) return null

  const points: CenterPoint[] = chain.map(([x, y]) => ({ x: (x + 0.5) * factor, y: (y + 0.5) * factor }))
  const cumulative: number[] = [0]
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y))
  }
  const gap = Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y)
  const closed = gap <= maxGap * factor
  const length = cumulative[cumulative.length - 1] + (closed ? gap : 0)
  return { points, cumulative, length, closed }
}

/** Punto de la línea central más cercano a (x, y): devuelve su distancia a lo largo del recorrido y lo lejos que está. */
export function snapToCenterline(line: Centerline, x: number, y: number): { s: number; distance: number } {
  let best = Infinity
  let bestIndex = 0
  // Búsqueda directa: son unos pocos miles de puntos y solo se hace una vez por coche y actualización
  for (let i = 0; i < line.points.length; i++) {
    const d = (line.points[i].x - x) ** 2 + (line.points[i].y - y) ** 2
    if (d < best) {
      best = d
      bestIndex = i
    }
  }
  return { s: line.cumulative[bestIndex], distance: Math.sqrt(best) }
}

/** Coordenadas y rumbo (grados) en la distancia s a lo largo del recorrido; s se envuelve si el circuito es cerrado. */
export function pointAt(line: Centerline, s: number): { x: number; y: number; angle: number } {
  const total = line.length
  let d = line.closed ? ((s % total) + total) % total : Math.max(0, Math.min(s, line.cumulative[line.cumulative.length - 1]))
  const n = line.points.length
  // Búsqueda binaria del tramo
  let lo = 0
  let hi = n - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (line.cumulative[mid] <= d) lo = mid
    else hi = mid - 1
  }
  const a = line.points[lo]
  const b = line.points[(lo + 1) % n]
  const segLen = lo + 1 < n ? line.cumulative[lo + 1] - line.cumulative[lo] : total - line.cumulative[lo]
  const t = segLen > 0 ? (d - line.cumulative[lo]) / segLen : 0
  // El rumbo se toma sobre un tramo más largo para que no tiemble con la cuadrícula de píxeles
  const ahead = line.closed ? d + 25 : Math.min(d + 25, line.cumulative[n - 1])
  const c = ahead === d ? b : (() => {
    const dd = line.closed ? ahead % total : ahead
    let l = 0
    let h = n - 1
    while (l < h) {
      const mid = (l + h + 1) >> 1
      if (line.cumulative[mid] <= dd) l = mid
      else h = mid - 1
    }
    return line.points[l]
  })()
  const x = a.x + (b.x - a.x) * t
  const y = a.y + (b.y - a.y) * t
  return { x, y, angle: (Math.atan2(c.y - y, c.x - x) * 180) / Math.PI }
}

/** Distancia con signo del camino más corto de s0 a s1 (positivo = hacia delante); en circuitos cerrados nunca pasa de media vuelta. */
export function shortestDelta(line: Centerline, s0: number, s1: number): number {
  const raw = s1 - s0
  if (!line.closed) return raw
  const half = line.length / 2
  if (raw > half) return raw - line.length
  if (raw < -half) return raw + line.length
  return raw
}
