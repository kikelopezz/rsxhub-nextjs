'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Refresca los datos del servidor cada pocos segundos (solo con la pestaña visible),
// para ver tickets nuevos o cambios de otros compañeros sin recargar a mano.
export function AutoRefresh({ intervalMs = 10000 }: { intervalMs?: number }) {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, intervalMs)
    return () => clearInterval(id)
  }, [router, intervalMs])

  return null
}
