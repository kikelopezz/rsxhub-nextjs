import { describe, expect, it } from 'vitest'
import { extractCenterline, pointAt, shortestDelta, snapToCenterline } from '@/lib/track-centerline'

// Mapa de mentira: una cinta blanca circular (radio 100, ancho 24) partida por dos marcas oscuras, como las marcas
// de sector del mapa oficial, sobre fondo transparente.
function ringMap(width = 400, height = 400) {
  const rgba = new Uint8ClampedArray(width * height * 4)
  const cx = width / 2
  const cy = height / 2
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = Math.hypot(x - cx, y - cy)
      if (Math.abs(d - 100) > 12) continue
      // Dos marcas oscuras que cruzan la cinta (arriba y a la derecha)
      const angle = Math.atan2(y - cy, x - cx)
      const dark = Math.abs(angle + Math.PI / 2) < 0.05 || Math.abs(angle) < 0.05
      const o = (y * width + x) * 4
      rgba[o] = rgba[o + 1] = rgba[o + 2] = dark ? 40 : 255
      rgba[o + 3] = 255
    }
  }
  return { rgba, width, height, cx, cy }
}

describe('línea central del circuito', () => {
  const { rgba, width, height, cx, cy } = ringMap()
  const line = extractCenterline(rgba, width, height, 4)

  it('recompone el circuito entero aunque las marcas lo partan en tramos', () => {
    expect(line).not.toBeNull()
    expect(line!.closed).toBe(true)
    // Perímetro de la circunferencia central: 2π · 100 ≈ 628
    expect(line!.length).toBeGreaterThan(628 * 0.92)
    expect(line!.length).toBeLessThan(628 * 1.08)
  })

  it('pega un coche a la pista y avisa si está lejos', () => {
    const onTrack = snapToCenterline(line!, cx + 100 * Math.cos(Math.PI / 4), cy + 100 * Math.sin(Math.PI / 4))
    expect(onTrack.distance).toBeLessThan(8)
    const farAway = snapToCenterline(line!, cx, cy)
    expect(farAway.distance).toBeGreaterThan(80)
  })

  it('avanza por la pista y da la vuelta al llegar al final', () => {
    const a = pointAt(line!, 10)
    const b = pointAt(line!, 10 + line!.length)
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1)
  })

  it('elige el camino corto entre dos posiciones, también al cruzar la meta', () => {
    const len = line!.length
    expect(shortestDelta(line!, len - 10, 10)).toBeCloseTo(20)
    expect(shortestDelta(line!, 10, len - 10)).toBeCloseTo(-20)
    expect(shortestDelta(line!, 100, 160)).toBeCloseTo(60)
  })
})
