/**
 * Tipos que describe la API del bot de soporte (carpeta `rsx ticket`, proceso aparte) — sin
 * lógica, solo las formas que necesita el Hub para tipar lo que le llega por HTTP.
 */

export type GuildSummary = { id: string; name: string; icon: string | null; memberCount: number }

export type GuildDetails = GuildSummary & {
  categories: Array<{ id: string; name: string }>
  textChannels: Array<{ id: string; name: string; parentId: string | null }>
  roles: Array<{ id: string; name: string; color: string }>
}
