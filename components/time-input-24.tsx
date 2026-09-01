'use client'

import React from 'react'

interface TimeInput24Props {
  value: string // e.g. "19:30" or "08:00"
  onChange: (newValue: string) => void
  label?: string
  className?: string
}

export function TimeInput24({ value, onChange, label, className = '' }: TimeInput24Props) {
  const parts = (value || '20:00').split(':')
  const currentHour = parts[0] ? parts[0].padStart(2, '0') : '20'
  const currentMinute = parts[1] ? parts[1].padStart(2, '0') : '00'

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

  // If currentMinute is not in the 5-minute step list (e.g., '12'), add it dynamically so it displays correctly
  const minutesList = minutes.includes(currentMinute) ? minutes : [...minutes, currentMinute].sort()

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(`${e.target.value}:${currentMinute}`)
  }

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(`${currentHour}:${e.target.value}`)
  }

  return (
    <div className={className}>
      {label && <label className="block text-[10px] text-slate-400 uppercase font-mono mb-1">{label}</label>}
      <div className="flex items-center gap-1 border border-shell-line bg-black/50 px-2.5 py-1.5 text-xs text-white rounded-lg focus-within:border-cyan-400 font-mono transition-colors">
        <select
          value={currentHour}
          onChange={handleHourChange}
          className="bg-transparent text-white text-xs outline-none cursor-pointer font-bold font-mono focus:bg-[#090d16]"
        >
          {hours.map((h) => (
            <option key={h} value={h} className="bg-[#090d16] text-white font-mono">
              {h}
            </option>
          ))}
        </select>
        <span className="text-cyan-400 font-black">:</span>
        <select
          value={currentMinute}
          onChange={handleMinuteChange}
          className="bg-transparent text-white text-xs outline-none cursor-pointer font-bold font-mono focus:bg-[#090d16]"
        >
          {minutesList.map((m) => (
            <option key={m} value={m} className="bg-[#090d16] text-white font-mono">
              {m}
            </option>
          ))}
        </select>
        <span className="text-[9px] text-slate-500 font-mono ml-auto font-black tracking-wider bg-white/5 px-1 py-0.5 border border-white/10">
          24H
        </span>
      </div>
    </div>
  )
}
