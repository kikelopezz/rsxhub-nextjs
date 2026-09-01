'use client'

import { useState, useEffect } from 'react'
import { Cpu, X, User, Trophy, ShieldAlert } from 'lucide-react'

export function DevRoleSimulator() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeRole, setActiveRole] = useState<string>('driver')

  useEffect(() => {
    // Read the current mock_role cookie value
    const match = document.cookie.match(/(?:^|; )mock_role=([^;]*)/)
    if (match) {
      setActiveRole(match[1])
    } else {
      setActiveRole('driver')
    }
  }, [])

  const handleRoleChange = (role: string) => {
    // Set cookie
    document.cookie = `mock_role=${role}; path=/; max-age=${60 * 60 * 24 * 30}` // 30 days
    setActiveRole(role)
    setIsOpen(false)
    window.location.reload()
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          title="Developer Role Simulator"
          className="flex h-12 w-12 items-center justify-center border border-cyan-500/40 bg-zinc-950/90 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:border-cyan-400 hover:text-cyan-300 transition-all rounded-lg"
        >
          <Cpu className="h-6 w-6 animate-pulse" />
        </button>
      )}

      {/* Expanded Simulator Drawer Panel */}
      {isOpen && (
        <div className="w-80 border border-shell-line bg-zinc-950 p-5 text-white shadow-[0_0_40px_rgba(0,0,0,0.8)] rounded-lg animate-fade-in relative">
          {/* Close button */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 mb-3">
            <Cpu className="h-5 w-5 text-cyan-400" />
            <h3 className="text-sm font-black uppercase tracking-wider text-white">
              Role Simulator
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
            Select a role to preview and test different layout states and platform access rules.
          </p>

          <div className="space-y-2">
            {/* Driver Role */}
            <button
              onClick={() => handleRoleChange('driver')}
              className={`w-full flex items-center gap-3 p-3 border text-left transition-all rounded-lg ${
                activeRole === 'driver'
                  ? 'border-cyan-400 bg-cyan-950/20 text-cyan-300 font-bold shadow-[0_0_8px_rgba(34,211,238,0.15)]'
                  : 'border-shell-line bg-black/20 text-slate-300 hover:border-slate-500 hover:text-white'
              }`}
            >
              <User className={`h-4.5 w-4.5 ${activeRole === 'driver' ? 'text-cyan-300' : 'text-slate-400'}`} />
              <div className="flex-1">
                <span className="block text-xs uppercase tracking-wider font-bold">Driver / Pilot</span>
                <span className="block text-[10px] text-slate-400 font-normal mt-0.5">Normal racer dashboard & profile</span>
              </div>
            </button>

            {/* Team Owner / Steward Role */}
            <button
              onClick={() => handleRoleChange('leader')}
              className={`w-full flex items-center gap-3 p-3 border text-left transition-all rounded-lg ${
                activeRole === 'leader'
                  ? 'border-cyan-400 bg-cyan-950/20 text-cyan-300 font-bold shadow-[0_0_8px_rgba(34,211,238,0.15)]'
                  : 'border-shell-line bg-black/20 text-slate-300 hover:border-slate-500 hover:text-white'
              }`}
            >
              <Trophy className={`h-4.5 w-4.5 ${activeRole === 'leader' ? 'text-cyan-300' : 'text-slate-400'}`} />
              <div className="flex-1">
                <span className="block text-xs uppercase tracking-wider font-bold">Team Boss & Steward</span>
                <span className="block text-[10px] text-slate-400 font-normal mt-0.5">Edit all teams, manage skins & steward races</span>
              </div>
            </button>

            {/* Admin Role */}
            <button
              onClick={() => handleRoleChange('admin')}
              className={`w-full flex items-center gap-3 p-3 border text-left transition-all rounded-lg ${
                activeRole === 'admin'
                  ? 'border-cyan-400 bg-cyan-950/20 text-cyan-300 font-bold shadow-[0_0_8px_rgba(34,211,238,0.15)]'
                  : 'border-shell-line bg-black/20 text-slate-300 hover:border-slate-500 hover:text-white'
              }`}
            >
              <ShieldAlert className={`h-4.5 w-4.5 ${activeRole === 'admin' ? 'text-cyan-300' : 'text-slate-400'}`} />
              <div className="flex-1">
                <span className="block text-xs uppercase tracking-wider font-bold">Platform Admin</span>
                <span className="block text-[10px] text-slate-400 font-normal mt-0.5">Full league configurations & admin panel</span>
              </div>
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-shell-line/50 text-[10px] text-center text-slate-400 font-semibold uppercase tracking-wider">
            Page will reload automatically
          </div>
        </div>
      )}
    </div>
  )
}
