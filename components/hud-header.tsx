'use client'

import { useEffect, useState } from 'react'

export function HudHeader({ children }: { children: React.ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-40 transition-colors duration-300 ${
        isScrolled ? 'bg-black/95 backdrop-blur-sm shadow-[0_4px_24px_rgba(0,0,0,0.5)]' : 'bg-transparent'
      }`}
    >
      {children}
    </header>
  )
}
