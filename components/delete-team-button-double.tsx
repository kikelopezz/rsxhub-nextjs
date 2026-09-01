'use client'

import { useState, useEffect } from 'react'
import { Trash2, AlertTriangle } from 'lucide-react'
import { unstable_rethrow } from 'next/navigation'

type Props = {
  teamId: string
  teamName: string
  deleteAction: (teamId: string) => Promise<void>
}

export function DeleteTeamButtonDouble({ teamId, teamName, deleteAction }: Props) {
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
        await deleteAction(teamId)
      } catch (err) {
        unstable_rethrow(err)
        alert('Error deleting team.')
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
        title="Click again to confirm team deletion"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Confirm Deletion?
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 hover:bg-rose-600/20 border border-rose-500/30 text-rose-300 hover:text-rose-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
      title="Delete team"
    >
      <Trash2 className="h-3.5 w-3.5" />
      Delete
    </button>
  )
}
