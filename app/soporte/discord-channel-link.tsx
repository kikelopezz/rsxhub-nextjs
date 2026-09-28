'use client'

import { ExternalLink } from 'lucide-react'

/** Enlace para abrir el canal del ticket en Discord, sin que el clic también abra/cierre el <details> que lo envuelve. */
export function DiscordChannelLink({ guildId, channelId }: { guildId: string; channelId: string }) {
  return (
    <a
      href={`discord://discord.com/channels/${guildId}/${channelId}`}
      onClick={(e) => e.stopPropagation()}
      className="flex items-center gap-1 text-slate-500 hover:text-[#4ea1ff]"
      title="Abrir el canal en Discord"
    >
      <ExternalLink className="h-3 w-3" />
    </a>
  )
}
