'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { GitMerge, Search, ArrowRight, AlertTriangle } from 'lucide-react'
import { searchUsersForMergeAction, mergeUserAccountsAction, type MergeCandidateUser } from '../actions/admin-user-merge'

function UserPicker({
  label,
  hint,
  selected,
  onSelect,
}: {
  label: string
  hint: string
  selected: MergeCandidateUser | null
  onSelect: (user: MergeCandidateUser | null) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MergeCandidateUser[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = async (value: string) => {
    setQuery(value)
    if (value.trim().length < 2) {
      setResults([])
      return
    }
    setIsSearching(true)
    try {
      const rows = await searchUsersForMergeAction(value)
      setResults(rows)
    } catch (err) {
      console.error('Failed to search users:', err)
    } finally {
      setIsSearching(false)
    }
  }

  if (selected) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/30 p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <div className="flex items-center gap-3">
          {selected.avatarUrl ? (
            <Image src={selected.avatarUrl} alt={selected.displayName} width={36} height={36} className="h-9 w-9 rounded-full object-cover" unoptimized />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">
              {selected.displayName.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{selected.displayName}</p>
            <p className="font-mono-data text-[10px] text-slate-500">{selected.steamId}</p>
          </div>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-[10px] font-bold uppercase text-slate-400 hover:border-rose-500 hover:text-rose-400"
          >
            Cambiar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mb-2 text-[11px] text-slate-500">{hint}</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar por SteamID o nombre..."
          className="w-full rounded-lg border border-white/10 bg-black/40 py-2 pl-8 pr-3 text-xs text-white outline-none focus:border-[#4ea1ff]"
        />
      </div>
      {isSearching && <p className="mt-2 text-[11px] text-slate-500">Buscando...</p>}
      {results.length > 0 && (
        <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
          {results.map((u) => (
            <button
              key={u.userId}
              type="button"
              onClick={() => {
                onSelect(u)
                setResults([])
                setQuery('')
              }}
              className="flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-white/10 hover:bg-white/5"
            >
              {u.avatarUrl ? (
                <Image src={u.avatarUrl} alt={u.displayName} width={28} height={28} className="h-7 w-7 rounded-full object-cover" unoptimized />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-300">
                  {u.displayName.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">{u.displayName}</p>
                <p className="font-mono-data text-[9px] text-slate-500">{u.steamId}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function AdminUserMergeTab() {
  const router = useRouter()
  const [primary, setPrimary] = useState<MergeCandidateUser | null>(null)
  const [duplicate, setDuplicate] = useState<MergeCandidateUser | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [isMerging, setIsMerging] = useState(false)

  const canMerge = Boolean(primary && duplicate && primary.userId !== duplicate.userId)
  const requiredPhrase = 'FUSIONAR'

  const handleMerge = async () => {
    if (!primary || !duplicate) return
    setIsMerging(true)
    try {
      const fd = new FormData()
      fd.set('toUserId', primary.userId)
      fd.set('fromUserId', duplicate.userId)
      await mergeUserAccountsAction(fd)
      toast.success(`Cuentas fusionadas — ${duplicate.displayName} ahora forma parte de ${primary.displayName}`)
      setPrimary(null)
      setDuplicate(null)
      setConfirmText('')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'No se pudo fusionar las cuentas.')
    } finally {
      setIsMerging(false)
    }
  }

  return (
    <div className="space-y-5 rounded-xl border border-white/10 bg-[#0d1420] p-5">
      <div className="flex items-center gap-2.5">
        <GitMerge className="h-5 w-5 text-[#4ea1ff]" />
        <h2 className="font-display-league text-xl uppercase text-white">Fusionar perfiles duplicados</h2>
      </div>
      <p className="max-w-2xl text-xs leading-relaxed text-slate-400">
        Cuando un piloto tiene dos cuentas (dos SteamID distintos) porque inició sesión con perfiles distintos de
        Steam, esta herramienta traslada todo lo de la cuenta duplicada — equipos, alineaciones, inscripciones,
        resultados, anuncios de mercado y notificaciones — a la cuenta principal, y elimina la duplicada.
        <strong className="text-rose-300"> Esta acción no se puede deshacer.</strong>
      </p>

      <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <UserPicker
          label="Cuenta principal (se mantiene)"
          hint="Todo se traslada a esta cuenta."
          selected={primary}
          onSelect={setPrimary}
        />
        <ArrowRight className="hidden h-5 w-5 shrink-0 text-slate-600 md:block" />
        <UserPicker
          label="Cuenta duplicada (se elimina)"
          hint="Esta cuenta desaparece al fusionar."
          selected={duplicate}
          onSelect={setDuplicate}
        />
      </div>

      {canMerge && (
        <div className="space-y-3 rounded-lg border border-rose-500/30 bg-rose-500/5 p-4">
          <p className="flex items-center gap-2 text-xs font-bold text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Escribe {requiredPhrase} para confirmar que quieres fusionar y borrar “{duplicate!.displayName}”.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder={requiredPhrase}
              className="w-40 rounded-lg border border-rose-500/30 bg-black/40 px-3 py-2 text-xs font-bold uppercase text-white outline-none focus:border-rose-400"
            />
            <button
              type="button"
              disabled={confirmText !== requiredPhrase || isMerging}
              onClick={handleMerge}
              className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isMerging ? 'Fusionando...' : 'Fusionar y eliminar duplicada'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
