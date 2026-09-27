/** Utilidades puras de nombres, sin dependencias de Discord ni de la base de datos (fáciles de testear). */

/** "Incidente de carrera" + 1 -> "Incidente de carrera 001". */
export function ticketCode(typeLabel: string, seq: number): string {
  return `${typeLabel} ${String(seq).padStart(3, '0')}`
}

/** Nombre de canal de Discord válido a partir del código del ticket: minúsculas, sin acentos ni símbolos. */
export function channelNameFor(code: string): string {
  const clean = code
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
  return (clean || 'ticket').slice(0, 90)
}
