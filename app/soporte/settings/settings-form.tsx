'use client'

import { useState, useTransition } from 'react'
import type { GuildDetails } from '@/lib/support-types'
import type { ButtonColor, Campeonato, GuildConfigDTO, TicketType } from '@/lib/support-config'
import type { CreatedChannel } from '@/lib/support-bot-client'
import { CreateChannelInline } from './create-channel-inline'
import { PanelPreview } from './panel-preview'
import { saveTicketSettingsAction, publishTicketPanelAction } from '../actions'

const card = 'rounded-2xl border border-white/10 bg-[#0a0a0c] p-4 md:p-5 space-y-4'
const heading = 'border-b border-shell-line pb-3 font-display-condensed text-sm font-bold uppercase tracking-wide text-white'
const label = 'mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300'
const input =
  'w-full rounded-lg border border-shell-line bg-black/40 px-3 py-2.5 text-xs text-white outline-none transition-colors focus:border-[#4ea1ff]'
const hint = 'mt-1.5 text-[10px] text-slate-500'
const COLORS: ButtonColor[] = ['blue', 'gray', 'green', 'red']
const COLOR_SWATCH: Record<ButtonColor, string> = { blue: '#5865F2', gray: '#6d7178', green: '#2dbd6e', red: '#ed4245' }

export function TicketSettingsForm({ guild, config }: { guild: GuildDetails; config: GuildConfigDTO }) {
  const [form, setForm] = useState({
    panelTitle: config.panelTitle,
    panelDescription: config.panelDescription,
    panelChannelId: config.panelChannelId || '',
    embedColor: config.embedColor,
    categoryId: config.categoryId || '',
    maxOpenTickets: config.maxOpenTickets,
    welcomeMessage: config.welcomeMessage,
    transcriptChannelId: config.transcriptChannelId || '',
    logChannelId: config.logChannelId || '',
    panelStyle: config.panelStyle === 'buttons' ? ('buttons' as const) : ('menu' as const),
    pingRoleId: config.pingRoleId || '',
    reminderMinutes: config.reminderMinutes,
  })
  const [textChannels, setTextChannels] = useState(guild.textChannels)
  const [categories, setCategories] = useState(guild.categories)
  const [staffRoles, setStaffRoles] = useState<string[]>(config.staffRoleIds)
  const [types, setTypes] = useState<TicketType[]>(config.ticketTypes)
  const [campeonatos, setCampeonatos] = useState<Campeonato[]>(config.campeonatos)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  const created = (field: 'panelChannelId' | 'categoryId' | 'transcriptChannelId' | 'logChannelId') => (ch: CreatedChannel) => {
    if (ch.kind === 'category') setCategories((l) => [...l, { id: ch.id, name: ch.name }])
    else setTextChannels((l) => [...l, { id: ch.id, name: ch.name, parentId: ch.parentId }])
    set(field, ch.id)
  }

  const payload = () => ({
    ...form,
    panelChannelId: form.panelChannelId || null,
    categoryId: form.categoryId || null,
    transcriptChannelId: form.transcriptChannelId || null,
    logChannelId: form.logChannelId || null,
    pingRoleId: form.pingRoleId || null,
    staffRoleIds: staffRoles,
    ticketTypes: types.filter((t) => t.label.trim()),
    campeonatos: campeonatos.filter((c) => c.label.trim()),
  })

  const submit = (publish: boolean) =>
    startTransition(async () => {
      setResult(null)
      const saved = await saveTicketSettingsAction(guild.id, payload())
      if (!saved.ok || !publish) return setResult(saved)
      setResult(await publishTicketPanelAction(guild.id))
    })

  const updateType = (i: number, patch: Partial<TicketType>) => setTypes((list) => list.map((t, idx) => (idx === i ? { ...t, ...patch } : t)))
  const updateCampeonato = (i: number, patch: Partial<Campeonato>) => setCampeonatos((list) => list.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
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
            <input className={input} maxLength={100} value={form.panelTitle} onChange={(e) => set('panelTitle', e.target.value)} />
          </div>
          <div>
            <label className={label}>Descripción</label>
            <textarea className={input} rows={3} maxLength={500} value={form.panelDescription} onChange={(e) => set('panelDescription', e.target.value)} />
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div>
              <label className={label}>Canal donde se publica el panel</label>
              <select className={input} value={form.panelChannelId} onChange={(e) => set('panelChannelId', e.target.value)}>
                <option value="">— Selecciona un canal —</option>
                {textChannels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
              <CreateChannelInline guildId={guild.id} kind="text" defaultName="soporte" label="Crear canal para el panel" onCreated={created('panelChannelId')} />
            </div>
            <div>
              <label className={label}>Color</label>
              <input
                type="color"
                className="h-[42px] w-20 cursor-pointer rounded-lg border border-shell-line bg-black/40 p-1"
                value={form.embedColor}
                onChange={(e) => set('embedColor', e.target.value)}
              />
            </div>
          </div>
          <div>
            <span className={label}>Cómo se ven las categorías en el panel</span>
            <div className="flex gap-2">
              {(['menu', 'buttons'] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => set('panelStyle', style)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold uppercase ${
                    form.panelStyle === style ? 'border-[#4ea1ff] bg-[#4ea1ff]/10 text-[#4ea1ff]' : 'border-white/10 text-slate-400'
                  }`}
                >
                  {style === 'menu' ? 'Menú desplegable' : 'Botones'}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className={card}>
          <h2 className={heading}>Creación de tickets</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={label}>Categoría general donde se crean los canales</label>
              <select className={input} value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                <option value="">— Sin categoría —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className={hint}>Se usa cuando el ticket no es de ningún campeonato con categoría propia (más abajo).</p>
              <CreateChannelInline guildId={guild.id} kind="category" defaultName="TICKETS" label="Crear categoría de Discord" onCreated={created('categoryId')} />
            </div>
            <div>
              <label className={label}>Máximo de tickets abiertos por usuario</label>
              <input type="number" min={1} max={10} className={input} value={form.maxOpenTickets} onChange={(e) => set('maxOpenTickets', Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label className={label}>Mensaje de bienvenida dentro del ticket</label>
            <textarea className={input} rows={3} maxLength={500} value={form.welcomeMessage} onChange={(e) => set('welcomeMessage', e.target.value)} />
            <p className={hint}>Usa {'{user}'} para mencionar a quien abrió el ticket.</p>
          </div>
        </section>

        <section className={card}>
          <h2 className={heading}>Categorías de ticket</h2>
          <p className="text-xs text-slate-400">
            Cada una es una opción del panel. Cada ticket se nombra con su categoría y un número propio (p. ej. «Incidente de carrera 001»).
          </p>
          {types.map((t, i) => (
            <div key={t.id} className="space-y-2 rounded-lg border border-white/10 bg-black/30 p-3">
              <div className="flex items-center gap-2">
                <input value={t.emoji} onChange={(e) => updateType(i, { emoji: e.target.value })} placeholder="🎫" maxLength={8} className={`${input} w-16 text-center`} />
                <input value={t.label} onChange={(e) => updateType(i, { label: e.target.value })} placeholder="Nombre de la categoría" maxLength={60} className={input} />
                <button type="button" onClick={() => setTypes((list) => list.filter((_, idx) => idx !== i))} className="shrink-0 text-[10px] font-bold uppercase text-rose-400 hover:underline">
                  Quitar
                </button>
              </div>
              <input
                value={t.description}
                onChange={(e) => updateType(i, { description: e.target.value })}
                placeholder="Descripción corta (opcional, solo en el menú desplegable)"
                maxLength={100}
                className={input}
              />
              <textarea
                value={t.welcome}
                onChange={(e) => updateType(i, { welcome: e.target.value })}
                placeholder="Mensaje de bienvenida propio de esta categoría (si lo dejas vacío se usa el general)"
                rows={2}
                maxLength={500}
                className={input}
              />
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1.5">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateType(i, { color: c })}
                      title={c}
                      className={`h-6 w-6 rounded-lg border transition-transform ${t.color === c ? 'scale-110 border-white ring-2 ring-[#4ea1ff]' : 'border-white/20'}`}
                      style={{ backgroundColor: COLOR_SWATCH[c] }}
                    />
                  ))}
                </div>
                <div className="flex-1 min-w-[180px]">
                  <select className={input} value={t.pingRoleId || ''} onChange={(e) => updateType(i, { pingRoleId: e.target.value || null })}>
                    <option value="">Avisar al rol general de Discord</option>
                    {guild.roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        @{r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
          {types.length === 0 && <p className={hint}>Sin categorías: el panel mostrará solo el título y la descripción, sin opciones.</p>}
          <button
            type="button"
            onClick={() => setTypes((list) => [...list, { id: `t-${Math.random().toString(36).slice(2, 9)}`, emoji: '', label: '', description: '', welcome: '', color: 'blue', pingRoleId: null }])}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold uppercase text-slate-300 hover:bg-white/5"
          >
            + Añadir categoría
          </button>
        </section>

        <section className={card}>
          <h2 className={heading}>Campeonatos (opcional)</h2>
          <p className="text-xs text-slate-400">
            Con al menos un campeonato, elegirlo pasa a ser obligatorio al abrir cualquier ticket (se añade automáticamente la opción «General»
            para lo que no sea de un campeonato). Si le pones una categoría de Discord a uno, sus tickets se crean ahí en vez de en la categoría
            general.
          </p>
          {campeonatos.map((c, i) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-black/30 p-3">
              <input value={c.emoji} onChange={(e) => updateCampeonato(i, { emoji: e.target.value })} placeholder="🏁" maxLength={8} className={`${input} w-16 text-center`} />
              <input value={c.label} onChange={(e) => updateCampeonato(i, { label: e.target.value })} placeholder="Nombre del campeonato" maxLength={60} className={`${input} flex-1 min-w-[140px]`} />
              <select className={`${input} flex-1 min-w-[160px]`} value={c.categoryId || ''} onChange={(e) => updateCampeonato(i, { categoryId: e.target.value || null })}>
                <option value="">— Categoría general —</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setCampeonatos((list) => list.filter((_, idx) => idx !== i))} className="text-[10px] font-bold uppercase text-rose-400 hover:underline">
                Quitar
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setCampeonatos((list) => [...list, { id: `c-${Math.random().toString(36).slice(2, 9)}`, emoji: '', label: '', categoryId: null }])}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold uppercase text-slate-300 hover:bg-white/5"
          >
            + Añadir campeonato
          </button>
        </section>

        <section className={card}>
          <h2 className={heading}>Staff</h2>
          <div>
            <span className={label}>Roles que pueden ver y gestionar los tickets</span>
            <div className="flex flex-wrap gap-2">
              {guild.roles.map((r) => {
                const active = staffRoles.includes(r.id)
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setStaffRoles((list) => (active ? list.filter((id) => id !== r.id) : [...list, r.id]))}
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${active ? 'border-[#4ea1ff] bg-[#4ea1ff]/10 text-[#4ea1ff]' : 'border-white/10 text-slate-400'}`}
                  >
                    @{r.name}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={label}>Avisar a este rol al abrirse un ticket (general)</label>
              <select className={input} value={form.pingRoleId} onChange={(e) => set('pingRoleId', e.target.value)}>
                <option value="">Sin aviso</option>
                {guild.roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    @{r.name}
                  </option>
                ))}
              </select>
              <p className={hint}>Cada categoría puede tener su propio rol (más arriba); este es el que se usa si no lo tiene.</p>
            </div>
            <div>
              <label className={label}>Recordatorio si nadie reclama (minutos, 0 = no recordar)</label>
              <input type="number" min={0} max={1440} className={input} value={form.reminderMinutes} onChange={(e) => set('reminderMinutes', Number(e.target.value))} />
            </div>
          </div>
        </section>

        <section className={card}>
          <h2 className={heading}>Transcripciones y registro</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={label}>Canal de registro (avisos de cierre)</label>
              <select className={input} value={form.logChannelId} onChange={(e) => set('logChannelId', e.target.value)}>
                <option value="">— Ninguno —</option>
                {textChannels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
              <CreateChannelInline guildId={guild.id} kind="text" defaultName="logs" staffOnly label="Crear canal de registro" onCreated={created('logChannelId')} />
            </div>
            <div>
              <label className={label}>Canal de transcripciones (solo enlace, opcional)</label>
              <select className={input} value={form.transcriptChannelId} onChange={(e) => set('transcriptChannelId', e.target.value)}>
                <option value="">— Ninguno —</option>
                {textChannels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
              <p className={hint}>Las transcripciones se guardan igualmente aunque no elijas canal (se ven desde el propio ticket en la web).</p>
            </div>
          </div>
        </section>

        {result && (
          <div className={`rounded-lg border px-4 py-2.5 text-xs font-bold ${result.ok ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-400/30 bg-rose-500/10 text-rose-200'}`}>
            {result.message}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending} className="rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-xs font-black uppercase text-white hover:bg-white/10 disabled:opacity-50">
            {pending ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => submit(true)}
            className="rounded-lg bg-[#1274de] px-5 py-2.5 text-xs font-black uppercase text-white hover:bg-[#1f82ee] disabled:opacity-50"
          >
            {pending ? '…' : 'Guardar y publicar panel'}
          </button>
        </div>
      </form>

      <div className="xl:sticky xl:top-4">
        <PanelPreview title={form.panelTitle} description={form.panelDescription} color={form.embedColor} panelStyle={form.panelStyle} types={types} />
      </div>
    </div>
  )
}
