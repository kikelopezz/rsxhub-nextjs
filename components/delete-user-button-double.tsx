'use client'

import { useState, useEffect } from 'react'
import { Trash2, AlertTriangle } from 'lucide-react'

type Props = {
  userId: string
  userName: string
  deleteAction: (userId: string) => Promise<void>
}

export function DeleteUserButtonDouble({ userId, userName, deleteAction }: Props) {
  const [step, setStep] = useState<'idle' | 'confirming' | 'deleting'>('idle')

  useEffect(() => {
    if (step === 'confirming') {
      const timer = setTimeout(() => {
        setStep('idle')
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [step])

  const handleClick = async () => {
    if (step === 'idle') {
      setStep('confirming')
      return
    }

    if (step === 'confirming') {
      setStep('deleting')
      try {
        await deleteAction(userId)
      } catch (err) {
        alert('Error deleting user account.')
        setStep('idle')
      }
    }
  }

  if (step === 'deleting') {
    return (
      <button
        disabled
        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-rose-950/60 border border-rose-800 text-rose-300 cursor-wait rounded-lg"
      >
        Deleting...
      </button>
    )
  }

  if (step === 'confirming') {
    return (
      <button
        onClick={handleClick}
        className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider bg-rose-600 hover:bg-rose-700 border border-rose-500 text-white rounded-lg transition-all animate-pulse flex items-center gap-1.5 cursor-pointer"
        title={`Click again to confirm account deletion for ${userName}`}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Confirm Delete?
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border border-rose-500/30 bg-rose-500/10 hover:bg-rose-700 text-rose-200 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
    >
      <Trash2 className="h-3.5 w-3.5 text-rose-400" />
      Delete
    </button>
  )
}
