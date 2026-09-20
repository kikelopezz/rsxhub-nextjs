'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { ButtonColor, CreatedChannel, GuildConfig, GuildDetails, TicketType } from '@/lib/tickets-api'
import { CreateChannelInline } from './create-channel-inline'
import { PanelPreview } from './panel-preview'
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
    panel_style: (config.panel_style === 'buttons' ? 'buttons' : 'menu') as 'menu' | 'buttons',
    ping_role_id: config.ping_role_id || '',
    reminder_minutes: config.reminder_minutes ?? 0,
  })
  // Listas locales: los canales/categorías que se crean desde aquí aparecen al momento sin recargar.
  const [textChannels, setTextChannels] = useState(guild.textChannels)
  const [categories, setCategories] = useState(guild.categories)
  const [staffRoles, setStaffRoles] = useState<string[]>(config.staff_role_ids)
  const [types, setTypes] = useState<TicketType[]>(config.ticket_types)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  const created = (field: 'panel_channel_id' | 'category_id' | 'transcript_channel_id' | 'log_channel_id') => (ch: CreatedChannel) => {
    if (ch.kind === 'category') setCategories((l) => [...l, { id: ch.id, name: ch.name }])
    else setTextChannels((l) => [...l, { id: ch.id, name: ch.name, parentId: ch.parentId }])
    set(field, ch.id)
  }

  const payload = (): Partial<GuildConfig> => ({
    ...form,
    panel_channel_id: form.panel_channel_id || null,
    category_id: form.category_id || null,
    transcript_channel_id: form.transcript_channel_id || null,
    log_channel_id: form.log_channel_id || null,
    ping_role_id: form.ping_role_id || null,
    reminder_minutes: Math.max(0, Math.min(1440, Math.round(Number(form.reminder_minutes) || 0))),
    staff_role_ids: staffRoles,
    ticket_types: types.filter((t) => t.label && t.label.trim()).map((t) => ({ ...t, ping_role_id: t.ping_role_id || null })),
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
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px] xl:items-start">
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit(false)
      }}
      className="min-w-0 space-y-5"
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
              {textChannels.map((c) => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </select>
            <CreateChannelInline guildId={guild.id} kind="text" defaultName="soporte" label="Crear canal para el panel" onCreated={created('panel_channel_id')} />
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
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <CreateChannelInline guildId={guild.id} kind="category" defaultName="TICKETS" label="Crear categoría de Discord" onCreated={created('category_id')} />
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
        <p className="text-xs text-slate-400">
          Cada categoría es una opción del panel. Cada ticket se nombra con su categoría y su propio número (por ejemplo «Incidente de carrera 001»,
          «Incidente de carrera 002») y puede llevar su propio mensaje de bienvenida.
        </p>

        <div>
          <span className={label}>Cómo eligen la categoría en Discord</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              { value: 'buttons', title: 'Botones', text: 'Un botón por categoría, de colores (5 por fila).' },
              { value: 'menu', title: 'Menú desplegable', text: 'Una lista para elegir; cabe más y ocupa menos.' },
            ] as const).map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors ${
                  form.panel_style === option.value ? 'border-[#4ea1ff]/60 bg-[rgba(78,161,255,.10)]' : 'border-white/10 bg-black/20 hover:border-white/25'
                }`}
              >
                <input
                  type="radio"
                  name="panel_style"
                  className="mt-0.5 accent-[#1274de]"
                  checked={form.panel_style === option.value}
                  onChange={() => set('panel_style', option.value)}
                />
                <span>
                  <span className="block text-xs font-bold text-white">{option.title}</span>
                  <span className="block text-[11px] text-slate-400">{option.text}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {types.length === 0 && <p className={hint}>Sin categorías: el panel mostrará un único botón &quot;Crear ticket&quot;.</p>}
          {types.map((t, i) => (
            <div key={t.id} className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="grid grid-cols-[3.5rem_1fr_1fr_auto] gap-2">
                <input className={input} maxLength={4} placeholder="🎫" value={t.emoji || ''} onChange={(e) => updateType(i, { emoji: e.target.value })} />
                <input className={input} maxLength={60} placeholder="Nombre de la categoría" value={t.label} onChange={(e) => updateType(i, { label: e.target.value })} />
                <input className={input} maxLength={100} placeholder="Descripción en el menú (opcional)" value={t.description || ''} onChange={(e) => updateType(i, { description: e.target.value })} />
                <button type="button" onClick={() => setTypes((l) => l.filter((_, idx) => idx !== i))} className="rounded-lg border border-white/10 px-3 text-[10px] font-bold uppercase text-slate-400 hover:bg-white/5">
                  Quitar
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <textarea
                  className={input}
                  rows={2}
                  maxLength={500}
                  placeholder="Mensaje dentro del ticket para esta categoría (opcional; si lo dejas vacío se usa el mensaje de bienvenida general)"
                  value={t.welcome || ''}
                  onChange={(e) => updateType(i, { welcome: e.target.value })}
                />
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Color del botón</span>
                  <select
                    className={input}
                    value={t.color || 'blue'}
                    disabled={form.panel_style !== 'buttons'}
                    title={form.panel_style !== 'buttons' ? 'Solo se usa en modo botones' : undefined}
                    onChange={(e) => updateType(i, { color: e.target.value as ButtonColor })}
                  >
                    <option value="blue">Azul</option>
                    <option value="gray">Gris</option>
                    <option value="green">Verde</option>
                    <option value="red">Rojo</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Avisar a este rol al abrirse un ticket de esta categoría</span>
                <select className={input} value={t.ping_role_id || ''} onChange={(e) => updateType(i, { ping_role_id: e.target.value || null })}>
                  <option value="">— Usar el rol general del servidor —</option>
                  {guild.roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </label>
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

        <div>
          <label className={label}>Avisar (mención) a un rol al abrirse un ticket</label>
          <select className={input} value={form.ping_role_id} onChange={(e) => set('ping_role_id', e.target.value)}>
            <option value="">— No avisar a nadie —</option>
            {guild.roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <p className={hint}>Ese rol recibe la notificación de Discord solo mientras el ticket está sin reclamar. Cada categoría puede tener su propio rol (más arriba); este es el que se usa si no lo tiene. Solo se listan roles que existen ahora mismo en el servidor.</p>
        </div>

        <div>
          <label className={label}>Recordar al staff si nadie reclama un ticket (minutos)</label>
          <input
            type="number"
            min={0}
            max={1440}
            step={5}
            className={`${input} max-w-[10rem]`}
            value={form.reminder_minutes}
            onChange={(e) => set('reminder_minutes', Number(e.target.value))}
          />
          <p className={hint}>
            Si pasan estos minutos y el ticket sigue sin reclamar, el bot vuelve a mencionar al rol de aviso en el canal, y repite cada tanto hasta que alguien lo reclame. No cierra nada. 0 = no recordar. Necesita un rol de aviso (general o de la categoría).
          </p>
        </div>
      </section>

      <section className={card}>
        <h2 className={heading}>Registro y transcripciones</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={label}>Canal de transcripciones</label>
            <select className={input} value={form.transcript_channel_id} onChange={(e) => set('transcript_channel_id', e.target.value)}>
              <option value="">— Ninguno —</option>
              {textChannels.map((c) => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </select>
            <CreateChannelInline guildId={guild.id} kind="text" staffOnly defaultName="transcripciones" label="Crear canal privado" onCreated={created('transcript_channel_id')} />
            <p className={hint}>Ahí se sube el HTML de cada ticket cerrado.</p>
          </div>
          <div>
            <label className={label}>Canal de logs del bot</label>
            <select className={input} value={form.log_channel_id} onChange={(e) => set('log_channel_id', e.target.value)}>
              <option value="">— Ninguno —</option>
              {textChannels.map((c) => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </select>
            <CreateChannelInline guildId={guild.id} kind="text" staffOnly defaultName="logs-tickets" label="Crear canal privado" onCreated={created('log_channel_id')} />
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

    <aside className="min-w-0 xl:sticky xl:top-24">
      <PanelPreview
        title={form.panel_title}
        description={form.panel_description}
        color={form.embed_color}
        style={form.panel_style}
        welcome={form.welcome_message}
        types={types}
        roles={guild.roles}
        pingRoleId={form.ping_role_id}
      />
    </aside>
    </div>
  )
}
