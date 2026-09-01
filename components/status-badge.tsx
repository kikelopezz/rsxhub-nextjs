import { cn } from '@/lib/utils'

export function StatusBadge({ label, variant = 'default' }: { label: string; variant?: 'default' | 'success' | 'warning' | 'muted' }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide',
        variant === 'success' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
        variant === 'warning' && 'border-orange-500/30 bg-orange-500/10 text-orange-300',
        variant === 'muted' && 'border-white/10 bg-white/5 text-slate-300',
        variant === 'default' && 'border-accent/30 bg-accent/10 text-accentSoft'
      )}
    >
      {label}
    </span>
  )
}
