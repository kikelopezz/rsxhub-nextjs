import { ReactNode } from 'react'

export function SectionTitle({
  title,
  subtitle,
  icon,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
}) {
  return (
    <div className="mb-2">
      <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white italic flex items-center gap-3">
        {icon ? (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-[#1274de]/30 bg-[#1274de]/10 [text-shadow:0_0_16px_rgba(18,116,222,0.4)]">
            {icon}
          </span>
        ) : null}
        <span className="[text-shadow:0_2px_12px_rgba(0,0,0,0.5)]">{title}</span>
      </h2>
      {subtitle ? (
        <p className={`text-xs md:text-sm text-slate-400 mt-1.5 ${icon ? 'ml-[calc(2.75rem+0.75rem)]' : ''}`}>{subtitle}</p>
      ) : null}
      <div className="mt-3 h-[2px] w-16 bg-gradient-to-r from-[#1274de] to-transparent" />
    </div>
  )
}
