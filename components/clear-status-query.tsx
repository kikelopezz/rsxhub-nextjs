'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const STATUS_KEYS = ['updated', 'invite', 'memberRemoved', 'roleUpdated', 'error']

export function ClearStatusQuery() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const hasStatus = STATUS_KEYS.some((key) => searchParams.has(key))
    if (!hasStatus) return

    const cleaned = new URLSearchParams(searchParams.toString())
    for (const key of STATUS_KEYS) cleaned.delete(key)

    const qs = cleaned.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [router, pathname, searchParams])

  return null
}

