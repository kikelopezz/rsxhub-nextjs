'use client'

interface ClassBadgeProps {
  className?: string
  classTag: string
}

export function getCategoryStyles(classTag: string, isSelected: boolean = true) {
  const tag = String(classTag || '').trim().toUpperCase()

  if (tag.includes('GT3') || tag === 'GT' || tag.includes('GTE') || tag.includes('GT4') || tag.includes('GT2')) {
    return isSelected
      ? 'bg-[#009f00] text-white border-green-400 font-black italic shadow-[0_0_14px_rgba(0,159,0,0.45)]'
      : 'bg-[#009f00]/15 text-emerald-400 border border-[#009f00]/40 hover:bg-[#009f00]/30 hover:border-emerald-400 font-extrabold italic'
  }
  if (tag.includes('LMP2') || tag === 'P2' || tag.includes('PROT') || tag.includes('LMP1') || tag.includes('LMP3') || tag === 'LMP') {
    return isSelected
      ? 'bg-[#0072f0] text-white border-blue-400 font-black italic shadow-[0_0_14px_rgba(0,114,240,0.45)]'
      : 'bg-[#0072f0]/15 text-blue-400 border border-[#0072f0]/40 hover:bg-[#0072f0]/30 hover:border-blue-400 font-extrabold italic'
  }
  if (tag.includes('HYPERCAR') || tag === 'HC' || tag.includes('LMH') || tag.includes('LMDH') || tag.includes('HYPER')) {
    return isSelected
      ? 'bg-[#e10600] text-white border-red-500 font-black italic shadow-[0_0_14px_rgba(225,6,0,0.45)]'
      : 'bg-[#e10600]/15 text-red-400 border border-[#e10600]/40 hover:bg-[#e10600]/30 hover:border-red-400 font-extrabold italic'
  }
  if (tag.includes('FORMULA') || tag.includes('F1') || tag.includes('F2') || tag.includes('F3') || tag === 'FORM') {
    return isSelected
      ? 'bg-[#9333ea] text-white border-purple-400 font-black italic shadow-[0_0_14px_rgba(147,51,234,0.45)]'
      : 'bg-[#9333ea]/15 text-purple-400 border border-[#9333ea]/40 hover:bg-[#9333ea]/30 hover:border-purple-400 font-extrabold italic'
  }
  if (tag.includes('TCR')) {
    return isSelected
      ? 'bg-[#f59e0b] text-black border-amber-400 font-black italic shadow-[0_0_14px_rgba(245,158,11,0.45)]'
      : 'bg-[#f59e0b]/15 text-amber-400 border border-[#f59e0b]/40 hover:bg-[#f59e0b]/30 hover:border-amber-400 font-extrabold italic'
  }

  return isSelected
    ? 'bg-cyan-600 text-white border-cyan-400 font-black italic shadow-[0_0_14px_rgba(8,145,178,0.45)]'
    : 'bg-cyan-950/40 text-cyan-400 border border-cyan-700/40 hover:bg-cyan-900/40 hover:border-cyan-400 font-extrabold italic'
}

export function ClassBadge({ classTag, className = '' }: ClassBadgeProps) {
  const tag = String(classTag || '').trim().toUpperCase()
  
  let bgClass = 'bg-slate-800 text-slate-350 border border-white/10'
  
  if (tag.includes('GT3') || tag === 'GT' || tag.includes('GTE') || tag.includes('GT4') || tag.includes('GT2')) {
    bgClass = 'bg-[#009f00] text-white font-black italic border border-green-400/20'
  } else if (tag.includes('LMP2') || tag === 'P2' || tag.includes('PROT') || tag.includes('LMP1') || tag.includes('LMP3') || tag === 'LMP') {
    bgClass = 'bg-[#0072f0] text-white font-black italic border border-blue-400/20'
  } else if (tag.includes('HYPERCAR') || tag === 'HC' || tag.includes('LMH') || tag.includes('LMDH') || tag.includes('HYPER')) {
    bgClass = 'bg-[#e10600] text-white font-black italic border border-red-500/20'
  } else if (tag.includes('FORMULA') || tag.includes('F1') || tag.includes('F2') || tag.includes('F3') || tag === 'FORM') {
    bgClass = 'bg-[#9333ea] text-white font-black italic border border-purple-400/20'
  } else if (tag.includes('TCR')) {
    bgClass = 'bg-[#f59e0b] text-black font-black italic border border-amber-400/20'
  }

  return (
    <span className={`inline-block px-2 py-0.5 text-[9px] tracking-wider uppercase rounded-lg select-none ${bgClass} ${className}`}>
      {tag}
    </span>
  )
}

