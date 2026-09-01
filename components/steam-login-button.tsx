'use client'

import { useEffect, useState } from 'react'

interface SteamLoginButtonProps {
  className?: string
  children?: React.ReactNode
  redirectUrl?: string
}

export function SteamLoginButton({ className, children, redirectUrl = '/perfil' }: SteamLoginButtonProps) {
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin
      if (
        origin !== window.location.origin &&
        !origin.endsWith('.run.app') &&
        !origin.endsWith('.vercel.app') &&
        !origin.includes('localhost') &&
        !origin.includes('127.0.0.1')
      ) {
        return
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        if (event.data.isNew) {
          window.location.href = '/onboarding'
        } else {
          window.location.href = redirectUrl
        }
      } else if (event.data?.type === 'OAUTH_AUTH_FAILURE') {
        const errType = event.data?.error || 'error'
        window.location.href = `/?login=${errType}`
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [redirectUrl])

  const handleLogin = () => {
    const width = 650
    const height = 700
    const left = window.screen.width / 2 - width / 2
    const top = window.screen.height / 2 - height / 2
    const origin = window.location.origin
    const popup = window.open(
      `/api/auth/steam?origin=${encodeURIComponent(origin)}`,
      'Steam Login',
      `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
    )
    if (!popup) {
      alert('Por favor, permite las ventanas emergentes (popups) para iniciar sesión con Steam.')
    }
  }

  return (
    <button onClick={handleLogin} className={className} type="button">
      {children}
    </button>
  )
}
