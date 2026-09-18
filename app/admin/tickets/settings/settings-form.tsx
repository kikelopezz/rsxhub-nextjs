'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { GuildConfig, GuildDetails, TicketType } from '@/lib/tickets-api'
import { saveTicketSettingsAction, publishTicketPanelAction } from '../actions'

const card = 'rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5 space-y-4'
const heading = 'border-b border-shell-line pb-3 font-display-condensed text-sm font-bold uppercase tracking-wide text-white'
const label = 'mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300'
const input = 'w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2.5 text-xs text-white outline-none transition-colors focus:border-[#4ea1ff]'
const hint = 'mt-1.5 text-[10px] text-slate-500'

export function TicketSettingsForm({ guild, config }: { guild: GuildDetails; config: GuildConfig }) {
  const [form, setForm] = useState({
    panel_title: config.panel_title,
    panel_description: config.panel_description,
    panel_channel_id: config.panel_channel_id || '',
    embed_color: config.embed_color,
    category_id: config.category_id || '',
    max_open_tickets: config.max_open_tickets,
    welcome_message: config.welcome_message,
    transcript_channel_id: config.transcript_channel_id || '',
    log_channel_id: config.log_channel_id || '',
  })
  const [staffRoles, setStaffRoles] = useState<string[]>(config.staff_role_ids)
  const [types, setTypes] = useState<TicketType[]>(config.ticket_types)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  const payload = (): Partial<GuildConfig> => ({
    ...form,
    panel_channel_id: form.panel_channel_id || null,
    category_id: form.category_id || null,
    transcript_channel_id: form.transcript_channel_id || null,
    log_channel_id: form.log_channel_id || null,
    staff_role_ids: staffRoles,
    ticket_types: types.filter((t) => t.label && t.label.trim()),
  })

  const submit = (publish: boolean) =>
    startTransition(async () => {
      setResult(null)
      const saved = await saveTicketSettingsAction(guild.id, payload())
      if (!saved.ok || !publish) return setResult(saved)
      setResult(await publishTicketPanelAction(guild.id))
    })

  const updateType = (i: number, patch: Partial<TicketType>) =>
    setTypes((list) => list.map((t, idx) => (idx === i ? { ...t, ...patch } : t)))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit(false)
      }}
      className="space-y-5"
    >
      <section className={card}>
        <h2 className={heading}>Panel de tickets</h2>
        <div>
          <label className={label}>Título del panel</label>
          <input className={input} maxLength={100} value={form.panel_title} onChange={(e) => set('panel_title', e.target.value)} />
        </div>
        <div>
          <label className={label}>Descripción</label>
          <textarea className={input} rows={3} maxLength={500} value={form.panel_description} onChange={(e) => set('panel_description', e.target.value)} />
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div>
            <label className={label}>Canal donde se publica el panel</label>
            <select className={input} value={form.panel_channel_id} onChange={(e) => set('panel_channel_id', e.target.value)}>
              <option value="">— Selecciona un canal —</option>
              {guild.textChannels.map((c) => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Color</label>
            <input type="color" className="h-[42px] w-20 cursor-pointer rounded-lg border border-shell-line bg-black/40 p-1" value={form.embed_color} onChange={(e) => set('embed_color', e.target.value)} />
          </div>
        </div>
      </section>

      <section className={card}>
        <h2 className={heading}>Creación de tickets</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={label}>Categoría donde se crean los canales</label>
            <select className={input} value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
              <option value="">— Sin categoría —</option>
              {guild.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Máximo de tickets abiertos por usuario</label>
            <input type="number" min={1} max={10} className={input} value={form.max_open_tickets} onChange={(e) => set('max_open_tickets', Number(e.target.value))} />
          </div>
        </div>
        <div>
          <label className={label}>Mensaje de bienvenida dentro del ticket</label>
          <textarea className={input} rows={3} maxLength={500} value={form.welcome_message} onChange={(e) => set('welcome_message', e.target.value)} />
          <p className={hint}>Usa {'{user}'} para mencionar a quien abrió el ticket.</p>
        </div>
      </section>

      <section className={card}>
        <h2 className={heading}>Categorías de ticket (opcional)</h2>
        <p className="text-xs text-slate-400">Si añades categorías, el panel mostrará un menú desplegable en vez de un solo botón.</p>
        <div className="space-y-2">
          {types.length === 0 && <p className={hint}>Sin categorías: el panel mostrará un único botón &quot;Crear ticket&quot;.</p>}
          {types.map((t, i) => (
            <div key={t.id} className="grid grid-cols-[3.5rem_1fr_1fr_auto] gap-2">
              <input className={input} maxLength={4} placeholder="🎫" value={t.emoji || ''} onChange={(e) => updateType(i, { emoji: e.target.value })} />
              <input className={input} maxLength={60} placeholder="Nombre de la categoría" value={t.label} onChange={(e) => updateType(i, { label: e.target.value })} />
              <input className={input} maxLength={100} placeholder="Descripción (opcional)" value={t.description || ''} onChange={(e) => updateType(i, { description: e.target.value })} />
              <button type="button" onClick={() => setTypes((l) => l.filter((_, idx) => idx !== i))} className="rounded-lg border border-white/10 px-3 text-[10px] font-bold uppercase text-slate-400 hover:bg-white/5">
                Quitar
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setTypes((l) => [...l, { id: `t-${Math.random().toString(36).slice(2, 9)}`, emoji: '🎫', label: '', description: '' }])}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:bg-white/5"
        >
          + Añadir categoría
        </button>
      </section>

      <section className={card}>
        <h2 className={heading}>Staff</h2>
        <p className="text-xs text-slate-400">Los roles marcados pueden reclamar, cerrar y eliminar tickets dentro de Discord. Quien tenga &quot;Gestionar servidor&quot; siempre puede.</p>
        <div className="flex flex-wrap gap-2">
          {guild.roles.map((r) => {
            const checked = staffRoles.includes(r.id)
            return (
              <label key={r.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${checked ? 'border-[#4ea1ff]/60 bg-[rgba(78,161,255,.12)] text-white' : 'border-white/10 text-slate-400'}`}>
                <input
                  type="checkbox"
                  className="accent-[#1274de]"
                  checked={checked}
                  onChange={(e) => setStaffRoles((l) => (e.target.checked ? [...l, r.id] : l.filter((id) => id !== r.id)))}
                />
                <span style={{ color: r.color !== '#000000' ? r.color : undefined }}>● {r.name}</span>
              </label>
            )
          })}
        </div>
      </section>

      <section className={card}>
        <h2 className={heading}>Registro y transcripciones</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={label}>Canal de transcripciones</label>
            <select className={input} value={form.transcript_channel_id} onChange={(e) => set('transcript_channel_id', e.target.value)}>
              <option value="">— Ninguno —</option>
              {guild.textChannels.map((c) => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </select>
            <p className={hint}>Ahí se sube el HTML de cada ticket cerrado.</p>
          </div>
          <div>
            <label className={label}>Canal de logs del bot</label>
            <select className={input} value={form.log_channel_id} onChange={(e) => set('log_channel_id', e.target.value)}>
              <option value="">— Ninguno —</option>
              {guild.textChannels.map((c) => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </select>
            <p className={hint}>Registra cada apertura, reclamo, cierre y borrado de ticket.</p>
          </div>
        </div>
      </section>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#0a0a0c]/95 p-3 backdrop-blur">
        <button type="submit" disabled={pending} className="rounded-lg bg-[#1274de] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#1f82ee] disabled:opacity-60">
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <button type="button" disabled={pending} onClick={() => submit(true)} className="rounded-lg border border-[#4ea1ff]/50 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#4ea1ff] transition-colors hover:bg-[rgba(78,161,255,.12)] disabled:opacity-60">
          Guardar y publicar panel
        </button>
        {result && (
          <span className={`flex items-center gap-1.5 text-xs font-semibold ${result.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
            {result.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {result.message}
          </span>
        )}
      </div>
    </form>
  )
}
