'use client'

import { usePathname } from 'next/navigation'

export function HeaderBottomLine() {
  const pathname = usePathname()
  if (pathname === '/') return null

  return (
    <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#1274de]/60 to-transparent" />
  )
}
