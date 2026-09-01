'use client'

import { useEffect, useState, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

function TopLoadingBarContent() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    setProgress(100)
    const timer = setTimeout(() => {
      setLoading(false)
      setProgress(0)
    }, 250)
    return () => clearTimeout(timer)
  }, [pathname, searchParams])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const anchor = target.closest('a')
      if (anchor && anchor.href && anchor.href.startsWith(window.location.origin) && !anchor.target) {
        try {
          const url = new URL(anchor.href)
          if (url.pathname !== window.location.pathname || url.search !== window.location.search) {
            startLoading()
          }
        } catch {}
      }
    }

    const handleNavStart = () => startLoading()

    window.addEventListener('click', handleClick)
    window.addEventListener('rsx:navigation-start', handleNavStart)
    return () => {
      window.removeEventListener('click', handleClick)
      window.removeEventListener('rsx:navigation-start', handleNavStart)
    }
  }, [])

  const startLoading = () => {
    setLoading(true)
    setProgress(20)
    setTimeout(() => setProgress((p) => (p > 0 && p < 100 ? 50 : p)), 100)
    setTimeout(() => setProgress((p) => (p > 0 && p < 100 ? 80 : p)), 350)
    setTimeout(() => setProgress((p) => (p > 0 && p < 100 ? 92 : p)), 800)
  }

  if (!loading && progress === 0) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none h-[3px] bg-black/40">
      <div
        className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-red-500 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(18,116,222,0.9)]"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  )
}

export function TopLoadingBar() {
  return (
    <Suspense fallback={null}>
      <TopLoadingBarContent />
    </Suspense>
  )
}
