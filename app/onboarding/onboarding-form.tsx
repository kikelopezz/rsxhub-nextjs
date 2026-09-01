'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Check, ShieldAlert } from 'lucide-react'
import { COUNTRIES } from '@/lib/countries'
import { saveOnboarding } from './actions'
import { useDictionary } from '@/lib/i18n/locale-provider'

interface DefaultOnboardingData {
  displayName: string
  avatarUrl: string | null
  countryCode: string
  mainSim: 'ac' | 'lmu'
  preferredCategories: string[]
}

interface OnboardingFormProps {
  defaultData: DefaultOnboardingData
  userId: string
}

const CATEGORY_OPTIONS = ['GT3', 'HYPERCAR', 'FORMULA', 'LMP2']

export default function OnboardingForm({ defaultData, userId }: OnboardingFormProps) {
  const dict = useDictionary()
  const [mainSim, setMainSim] = useState<'ac' | 'lmu'>(defaultData.mainSim)
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    defaultData.preferredCategories.map((c) => c.toUpperCase())
  )
  const [pending, setPending] = useState(false)

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    )
  }

  const handleSubmit = () => {
    setPending(true)
  }

  return (
    <form action={saveOnboarding} onSubmit={handleSubmit} className="space-y-6 text-white">
      {/* Steam Account Sync Indicator */}
      <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-lg">
        {defaultData.avatarUrl ? (
          <Image
            src={defaultData.avatarUrl}
            alt="Steam Avatar"
            width={64}
            height={64}
            referrerPolicy="no-referrer"
            className="w-16 h-16 rounded-full object-cover ring-2 ring-[#1274de]/50 flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xl ring-2 ring-white/10 flex-shrink-0">
            {defaultData.displayName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-[#1274de] font-bold">{dict.onboarding.form.syncedAccount}</p>
          <p className="text-sm font-semibold truncate text-white">{defaultData.displayName}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {dict.onboarding.form.privacyNote}
          </p>
        </div>
      </div>

      {/* Driver Name Input */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
          {dict.onboarding.form.driverName}
        </label>
        <input
          type="text"
          name="displayName"
          defaultValue={defaultData.displayName}
          required
          placeholder={dict.onboarding.form.driverNamePlaceholder}
          className="w-full border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none rounded-lg focus:border-[#1274de] transition-colors"
        />
        <p className="text-[10px] text-slate-500 mt-1">{dict.onboarding.form.driverNameHint}</p>
      </div>

      {/* Country Selection Dropdown */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
          {dict.onboarding.form.country}
        </label>
        <select
          name="countryCode"
          defaultValue={defaultData.countryCode}
          required
          className="w-full border border-white/15 bg-black px-3 py-2.5 text-sm text-white outline-none rounded-lg focus:border-[#1274de] transition-colors cursor-pointer"
        >
          {COUNTRIES.map((country) => (
            <option key={country.code} value={country.code} className="bg-[#111622] text-white">
              {country.name} ({country.code})
            </option>
          ))}
        </select>
        <p className="text-[10px] text-slate-500 mt-1">
          {dict.onboarding.form.countryHint}
        </p>
      </div>

      {/* Main Simulator Card Selector */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2.5">
          {dict.onboarding.form.primarySimulator}
        </label>
        <input type="hidden" name="mainSim" value={mainSim} />
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMainSim('ac')}
            className={`flex flex-col items-center justify-center p-4 border text-center transition-all rounded-lg ${
              mainSim === 'ac'
                ? 'border-[#1274de] bg-[#1274de]/10 text-white shadow-[0_0_15px_rgba(18,116,222,0.15)]'
                : 'border-white/10 bg-black/20 text-slate-400 hover:text-white hover:border-white/20'
            }`}
          >
            <span className="text-sm font-bold tracking-wide uppercase">{dict.onboarding.form.assettoCorsa}</span>
            <span className="mt-1 text-[11px] text-slate-400">{dict.onboarding.form.assettoCorsaSubtitle}</span>
          </button>

          <button
            type="button"
            onClick={() => setMainSim('lmu')}
            className={`flex flex-col items-center justify-center p-4 border text-center transition-all rounded-lg ${
              mainSim === 'lmu'
                ? 'border-[#1274de] bg-[#1274de]/10 text-white shadow-[0_0_15px_rgba(18,116,222,0.15)]'
                : 'border-white/10 bg-black/20 text-slate-400 hover:text-white hover:border-white/20'
            }`}
          >
            <span className="text-sm font-bold tracking-wide uppercase">{dict.onboarding.form.leMansUltimate}</span>
            <span className="mt-1 text-[11px] text-slate-400">{dict.onboarding.form.leMansUltimateSubtitle}</span>
          </button>
        </div>
      </div>

      {/* Category Selection Checklist */}
      <div className="border border-white/10 bg-black/20 p-4 rounded-lg">
        <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold">
          {dict.onboarding.form.preferredCategories}
        </label>
        <p className="text-[11px] text-slate-400 mt-0.5">{dict.onboarding.form.preferredCategoriesHint}</p>
        
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {CATEGORY_OPTIONS.map((category) => {
            const isSelected = selectedCategories.includes(category)
            return (
              <label
                key={category}
                className={`flex items-center justify-between p-3 border cursor-pointer select-none transition-all rounded-lg ${
                  isSelected
                    ? 'border-[#1274de] bg-[#1274de]/5 text-white font-bold'
                    : 'border-white/10 bg-black/20 text-slate-400 hover:border-white/20 hover:text-slate-300'
                }`}
              >
                <span className="text-xs tracking-wider">{category}</span>
                <input
                  type="checkbox"
                  name="preferredCategories"
                  value={category}
                  checked={isSelected}
                  onChange={() => handleCategoryToggle(category)}
                  className="hidden"
                />
                <span
                  className={`w-3.5 h-3.5 border flex items-center justify-center text-[9px] ${
                    isSelected ? 'border-[#1274de] bg-[#1274de] text-white' : 'border-slate-500 bg-transparent'
                  }`}
                >
                  {isSelected && '✓'}
                </span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Submission Button */}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[#1274de] hover:bg-blue-600 disabled:opacity-50 py-3.5 text-sm font-bold text-white transition-colors tracking-widest uppercase rounded-lg cursor-pointer flex items-center justify-center gap-2"
      >
        {pending ? dict.onboarding.form.submitProcessing : dict.onboarding.form.submit}
      </button>
    </form>
  )
}
