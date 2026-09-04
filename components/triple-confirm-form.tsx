'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { unstable_rethrow } from 'next/navigation'

type Props = {
  action: () => Promise<void>
  label: string
  pendingLabel: string
  confirmStep1Label: string
  typePromptLabel: string
  requiredPhrase: string
  className?: string
}

// Three gates instead of one for the full-database-wipe button: a misclick (or a fast
// double-click blowing through a single window.confirm) can't get past step 1 or 2 alone,
// and step 3 requires actually typing the exact phrase — no dialog to reflexively dismiss.
export function TripleConfirmForm({
  action,
  label,
  pendingLabel,
  confirmStep1Label,
  typePromptLabel,
  requiredPhrase,
  className,
}: Props) {
  const [step, setStep] = useState<'idle' | 'confirm1' | 'confirm2' | 'running'>('idle')
  const [typedPhrase, setTypedPhrase] = useState('')

  useEffect(() => {
    if (step === 'confirm1' || step === 'confirm2') {
      const timer = setTimeout(() => {
        setStep('idle')
        setTypedPhrase('')
      }, 10_000)
      return () => clearTimeout(timer)
    }
  }, [step])

  const handleRun = async () => {
    setStep('running')
    try {
      await action()
    } catch (err) {
      unstable_rethrow(err)
      alert('Error running data cleanup.')
      setStep('idle')
      setTypedPhrase('')
    }
  }

  if (step === 'running') {
    return (
      <button
        disabled
        className="cursor-wait rounded-lg border border-rose-800 bg-rose-950/60 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-rose-300"
      >
        {pendingLabel}
      </button>
    )
  }

  if (step === 'confirm2') {
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          {typePromptLabel.replace('{phrase}', requiredPhrase)}
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={typedPhrase}
            onChange={(e) => setTypedPhrase(e.target.value)}
            placeholder={requiredPhrase}
            autoFocus
            className="rounded-lg border border-rose-500/40 bg-black/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white outline-none focus:border-rose-400"
          />
          <button
            type="button"
            disabled={typedPhrase !== requiredPhrase}
            onClick={handleRun}
            className={`rounded-lg border px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
              typedPhrase === requiredPhrase
                ? 'cursor-pointer border-rose-500 bg-rose-600 text-white hover:bg-rose-700'
                : 'cursor-not-allowed border-white/10 bg-white/5 text-slate-500'
            }`}
          >
            {label}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'confirm1') {
    return (
      <button
        type="button"
        onClick={() => setStep('confirm2')}
        className="flex animate-pulse cursor-pointer items-center gap-1.5 rounded-lg border border-rose-500 bg-rose-600 px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white transition-all hover:bg-rose-700"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        {confirmStep1Label}
      </button>
    )
  }

  return (
    <button type="button" onClick={() => setStep('confirm1')} className={className}>
      {label}
    </button>
  )
}
