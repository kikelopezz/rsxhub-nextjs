'use client'

import { useTransition } from 'react'
import { unstable_rethrow } from 'next/navigation'

interface DeleteTeamButtonProps {
  teamId: string
  teamName: string
  deleteAction: (teamId: string) => Promise<void>
}

export function DeleteTeamButton({ teamId, teamName, deleteAction }: DeleteTeamButtonProps) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (confirm(`Are you sure you want to delete the team "${teamName}" and all its members entirely?`)) {
      startTransition(async () => {
        try {
          await deleteAction(teamId)
        } catch (err: any) {
          unstable_rethrow(err)
          alert(err.message || 'Failed to delete team.')
        }
      })
    }
  }

  return (
    <form onSubmit={handleDelete}>
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-1.5 border border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/15 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-rose-400 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
      >
        {isPending ? 'Deleting...' : 'Delete Team'}
      </button>
    </form>
  )
}
