'use client'

import { useState, useEffect } from 'react'
import { formatDate, formatDateTime } from '@/lib/utils'

interface FormattedDateProps {
  date: string
  mode?: 'date' | 'datetime'
  className?: string
}

export function FormattedDate({ date, mode = 'datetime', className = '' }: FormattedDateProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Return a stable fallback that is identical on server and initial client-side hydration.
    // We format in UTC on the server and initial client render to avoid any timezone mismatches.
    try {
      const d = new Date(date)
      if (isNaN(d.getTime())) {
        return <span className={className}>-</span>
      }

      const day = d.getUTCDate().toString().padStart(2, '0')
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const month = monthNames[d.getUTCMonth()]
      const year = d.getUTCFullYear()

      if (mode === 'date') {
        return (
          <span className={className} suppressHydrationWarning>
            {day} {month} {year}
          </span>
        )
      } else {
        const hours = d.getUTCHours().toString().padStart(2, '0')
        const minutes = d.getUTCMinutes().toString().padStart(2, '0')
        return (
          <span className={className} suppressHydrationWarning>
            {day} {month} {year} {hours}:{minutes} UTC
          </span>
        )
      }
    } catch {
      return <span className={className}>-</span>
    }
  }

  // Once mounted on the client, render the fully formatted date/time in the client's locale and timezone
  try {
    const formattedStr = mode === 'date' ? formatDate(date) : formatDateTime(date)
    return <span className={className}>{formattedStr}</span>
  } catch {
    return <span className={className}>-</span>
  }
}
