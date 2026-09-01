'use client'

import { useFormStatus } from 'react-dom'

interface Props {
  className?: string
  label?: string
  pendingLabel?: string
}

export function SubmitButton({ 
  className = "rounded-lg bg-shell-accent hover:bg-red-700 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors cursor-pointer",
  label = "Submit",
  pendingLabel = "Processing..."
}: Props) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className} ${pending ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      {pending ? (
        <span className="flex items-center justify-center gap-2">
          {/* Subtle spinning indicator */}
          <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {pendingLabel}
        </span>
      ) : (
        label
      )}
    </button>
  )
}
