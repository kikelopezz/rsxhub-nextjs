import type { Message, TextBasedChannel } from 'discord.js'
import { hasR2, uploadBufferToR2 } from '@/lib/r2'

const MAX_MESSAGES = 500

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Recorre el canal hacia atrás hasta MAX_MESSAGES mensajes, y los deja en orden cronológico. */
async function fetchAllMessages(channel: TextBasedChannel): Promise<Message[]> {
  const collected: Message[] = []
  let before: string | undefined
  while (collected.length < MAX_MESSAGES) {
    const batch = await channel.messages.fetch({ limit: 100, before })
    if (batch.size === 0) break
    collected.push(...batch.values())
    before = batch.last()?.id
    if (batch.size < 100) break
  }
  return collected.reverse()
}

/** Transcripción en HTML sencillo (sin dependencias externas): autor, hora, texto y adjuntos. */
export async function buildTranscriptHtml(channel: TextBasedChannel, title: string): Promise<string> {
  const messages = await fetchAllMessages(channel)
  const rows = messages
    .map((m) => {
      const author = escapeHtml(m.author?.tag || m.author?.username || 'Desconocido')
      const time = new Date(m.createdTimestamp).toLocaleString('es-ES')
      const body = m.content ? `<p>${escapeHtml(m.content).replace(/\n/g, '<br>')}</p>` : ''
      const attachments = [...m.attachments.values()]
        .map((a) => `<p><a href="${escapeHtml(a.url)}" target="_blank" rel="noopener">📎 ${escapeHtml(a.name || 'archivo')}</a></p>`)
        .join('')
      const embeds = m.embeds
        .map((e) => `<blockquote>${escapeHtml(e.title || '')}${e.description ? `<br>${escapeHtml(e.description)}` : ''}</blockquote>`)
        .join('')
      return `<div class="msg"><div class="meta"><b>${author}</b><span>${time}</span></div>${body}${attachments}${embeds}</div>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body{background:#0a0a0c;color:#e5e7eb;font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:24px;max-width:820px;margin-inline:auto}
  h1{font-size:16px;text-transform:uppercase;letter-spacing:.05em;color:#4ea1ff;border-bottom:1px solid #ffffff1a;padding-bottom:12px}
  .msg{padding:10px 0;border-bottom:1px solid #ffffff0d}
  .meta{display:flex;gap:10px;align-items:baseline;font-size:12px;color:#94a3b8;margin-bottom:4px}
  .meta b{color:#fff;font-size:13px}
  p{margin:0 0 4px;white-space:pre-wrap;word-break:break-word;font-size:14px}
  blockquote{margin:4px 0;padding:6px 10px;border-left:2px solid #4ea1ff66;background:#ffffff08;font-size:13px}
  a{color:#4ea1ff}
</style></head>
<body><h1>${escapeHtml(title)}</h1>${rows || '<p>Sin mensajes.</p>'}</body></html>`
}

/** Genera y sube la transcripción a R2; si R2 no está configurado, no falla, simplemente no hay enlace. */
export async function saveTranscript(guildId: string, ticketId: string, code: string, channel: TextBasedChannel): Promise<string | null> {
  if (!hasR2) return null
  const html = await buildTranscriptHtml(channel, code)
  const key = `transcripts/${guildId}/${ticketId}.html`
  return uploadBufferToR2(key, Buffer.from(html, 'utf-8'), 'text/html; charset=utf-8')
}
