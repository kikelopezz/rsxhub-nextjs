'use client'

import { useTransition } from 'react'

interface DeleteLeagueButtonProps {
  leagueId: string
  leagueTitle: string
  deleteAction: (formData: FormData) => Promise<void>
}

export function DeleteLeagueButton({ leagueId, leagueTitle, deleteAction }: DeleteLeagueButtonProps) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (confirm(`¿Estás seguro de que deseas eliminar la liga "${leagueTitle}" y todos sus eventos/resultados asociados?`)) {
      startTransition(async () => {
        try {
          const formData = new FormData()
          formData.append('leagueId', leagueId)
          await deleteAction(formData)
        } catch (err: any) {
          alert(err.message || 'Failed to delete league.')
        }
      })
    }
  }

  return (
    <form onSubmit={handleDelete}>
      <button
        type="submit"
        disabled={isPending}
        className="border border-red-500/30 bg-red-500/5 hover:bg-red-700 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-red-200 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
      >
        {isPending ? 'Deleting...' : 'Delete'}
      </button>
    </form>
  )
}
