'use client'

import { Fragment, useState } from 'react'
import { ChevronDown, Hash } from 'lucide-react'
import type { TicketType } from '@/lib/tickets-api'

/**
 * Vista previa en directo de lo que verán los usuarios en Discord: el panel (menú o botones) y
 * la tarjeta del ticket que se abre. Se redibuja con cada cambio del formulario; imita el aspecto
 * de Discord (colores propios, no los del Hub) para que sea fiel.
 */

type PreviewProps = {
  title: string
  description: string
  color: string
  style: 'menu' | 'buttons'
  welcome: string
  types: TicketType[]
}

const DISCORD = {
  chat: '#313338',
  container: '#2b2d31',
  text: '#dbdee1',
  muted: '#949ba4',
  input: '#1e1f22',
  divider: 'rgba(255,255,255,0.08)',
}

const BUTTON_COLORS: Record<string, string> = {
  blue: '#5865f2',
  gray: '#4e5058',
  green: '#248046',
  red: '#da373c',
}

const pad = (n: number) => String(n).padStart(3, '0')

// Mismo criterio que el bot para el nombre del canal: sin tildes, en minúsculas y con guiones.
function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** **negrita** y {user} (la mención de quien abre el ticket), como los renderiza Discord. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\{user\})/g).filter(Boolean)
  return (
    <>
      {parts.map((part, i) => {
        if (part === '{user}') {
          return (
            <span key={i} className="rounded px-1" style={{ background: 'rgba(88,101,242,0.3)', color: '#c9cdfb' }}>
              @Piloto
            </span>
          )
        }
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} style={{ color: '#fff' }}>{part.slice(2, -2)}</strong>
        return <Fragment key={i}>{part}</Fragment>
      })}
    </>
  )
}

function DiscordButton({ label, emoji, color = 'blue' }: { label: string; emoji?: string; color?: string }) {
  return (
    <span
      className="inline-flex h-8 max-w-full items-center gap-1.5 rounded px-4 text-sm font-medium text-white"
      style={{ background: BUTTON_COLORS[color] || BUTTON_COLORS.blue }}
    >
      {emoji ? <span>{emoji}</span> : null}
      <span className="truncate">{label}</span>
    </span>
  )
}

function BotMessage({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: '#5865f2' }}>
        R
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[15px] font-semibold text-white">RSX SUPPORT</span>
          <span className="rounded px-1 text-[10px] font-bold leading-4 text-white" style={{ background: '#5865f2' }}>APP</span>
          <span className="text-xs" style={{ color: DISCORD.muted }}>Hoy a las 12:00</span>
        </div>
        <div
          className="mt-2 space-y-3 rounded-lg p-4"
          style={{ background: DISCORD.container, borderLeft: `4px solid ${accent}`, color: DISCORD.text }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

const Divider = () => <hr className="border-0 border-t" style={{ borderColor: DISCORD.divider }} />

function PanelView({ title, description, color, style, types }: PreviewProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const shown = types.filter((t) => t.label.trim()).slice(0, 25)
  const described = shown.filter((t) => t.description?.trim())
  const rows: TicketType[][] = []
  for (let i = 0; i < shown.length; i += 5) rows.push(shown.slice(i, i + 5))

  return (
    <BotMessage accent={color}>
      <div>
        <p className="text-xl font-bold leading-tight text-white">{title || 'Soporte'}</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm">{description}</p>
      </div>
      <Divider />

      {shown.length === 0 && <DiscordButton label="Crear ticket" emoji="🎫" />}

      {shown.length > 0 && style === 'buttons' && (
        <div className="space-y-3">
          {described.length > 0 && (
            <div className="space-y-0.5 text-sm">
              {described.map((t) => (
                <p key={t.id}>
                  {t.emoji ? `${t.emoji} ` : ''}
                  <strong style={{ color: '#fff' }}>{t.label}</strong> — {t.description}
                </p>
              ))}
            </div>
          )}
          {rows.map((row, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              {row.map((t) => (
                <DiscordButton key={t.id} label={t.label} emoji={t.emoji} color={t.color} />
              ))}
            </div>
          ))}
        </div>
      )}

      {shown.length > 0 && style === 'menu' && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm"
            style={{ background: DISCORD.input, color: DISCORD.muted }}
          >
            <span className="truncate">Selecciona una categoria para abrir un ticket</span>
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
          {menuOpen && (
            <div className="mt-1 max-h-64 overflow-y-auto rounded p-1 shadow-lg" style={{ background: DISCORD.input }}>
              {shown.map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 rounded px-2.5 py-2 hover:bg-white/5">
                  {t.emoji ? <span className="text-lg">{t.emoji}</span> : null}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" style={{ color: DISCORD.text }}>{t.label}</p>
                    {t.description?.trim() && <p className="truncate text-xs" style={{ color: DISCORD.muted }}>{t.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </BotMessage>
  )
}

function TicketView({ color, welcome, types }: PreviewProps) {
  const options = types.filter((t) => t.label.trim())
  const [selected, setSelected] = useState<string>('')
  const type = options.find((t) => t.id === selected) || options[0]

  const label = type ? type.label : 'Ticket'
  const code = `${label} ${pad(1)}`
  const channelName = `${slugify(label) || 'ticket'}-${pad(1)}`
  const text = type?.welcome?.trim() || welcome

  return (
    <div className="space-y-3">
      {options.length > 1 && (
        <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Categoría a previsualizar
          <select
            value={type?.id || ''}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-lg border border-shell-line bg-black/40 px-2 py-1 text-xs normal-case tracking-normal text-white outline-none focus:border-[#4ea1ff]"
          >
            {options.map((t) => (
              <option key={t.id} value={t.id}>
                {t.emoji} {t.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex items-center gap-1.5 border-b pb-2 text-sm font-semibold text-white" style={{ borderColor: DISCORD.divider }}>
        <Hash className="h-4 w-4" style={{ color: DISCORD.muted }} />
        <span className="truncate">{channelName}</span>
      </div>

      <BotMessage accent={color}>
        <div>
          <p className="text-base font-bold text-white">🎫 {code}</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm">
            <Inline text={text} />
          </p>
        </div>
        <p className="text-sm">🔵 Nuevo ──── ⚪ Reclamado ──── ⚪ Cerrado</p>
        <Divider />
        <div className="space-y-0.5 text-sm">
          <p><Inline text="**Abierto por:** {user}" /></p>
          {type && <p><Inline text={`**Categoria:** ${type.label}`} /></p>}
          <p><Inline text="**Estado:** 🟢 Abierto — sin reclamar" /></p>
        </div>
        <Divider />
        <div className="flex flex-wrap gap-2">
          <DiscordButton label="Reclamar" emoji="🙋" color="green" />
          <DiscordButton label="Renombrar" emoji="✏️" color="gray" />
          <DiscordButton label="Cerrar ticket" emoji="🔒" color="red" />
        </div>
      </BotMessage>

      <p className="text-[11px] text-slate-500">
        El siguiente ticket de esta categoría sería <strong className="text-slate-300">{pad(2)}</strong>: cada categoría lleva su propia cuenta.
      </p>
    </div>
  )
}

export function PanelPreview(props: PreviewProps) {
  const [tab, setTab] = useState<'panel' | 'ticket'>('panel')

  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-[#0a0a0c] p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display-condensed text-sm font-bold uppercase tracking-wide text-white">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
          </span>
          Vista previa en directo
        </h2>
        <div className="flex rounded-lg border border-shell-line bg-black/40 p-0.5">
          {(['panel', 'ticket'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-md px-3 py-1 text-[10px] font-black uppercase tracking-wide transition-colors ${
                tab === key ? 'bg-[#1274de] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {key === 'panel' ? 'Panel' : 'Ticket abierto'}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl p-3" style={{ background: DISCORD.chat }}>
        {tab === 'panel' ? <PanelView {...props} /> : <TicketView {...props} />}
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Así lo verán en Discord. Los cambios se ven al momento; recuerda pulsar «Guardar y publicar panel» para aplicarlos en el servidor.
      </p>
    </section>
  )
}
