import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string) {
  if (!dateString) return '-'
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return dateString
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function formatDateTime(dateString: string) {
  if (!dateString) return '-'
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return dateString
  const dateFormatted = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${dateFormatted}, ${hours}:${minutes}`
}

export function simulatorLabel(sim: string) {
  if (sim === 'ac') return 'Assetto Corsa'
  if (sim === 'lmu') return 'Le Mans Ultimate'
  return sim
}

export function formatLabel(format: string) {
  const labels: Record<string, string> = {
    sprint: 'Sprint',
    endurance: 'Endurance',
    gt3: 'GT3',
    prototype: 'Prototypes',
    formula: 'Formula',
    multiclass: 'Multiclass',
  }
  return labels[format] ?? format
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    open: 'Open',
    ongoing: 'Ongoing',
    finished: 'Finished',
    draft: 'Draft',
  }
  return labels[status] ?? status
}
