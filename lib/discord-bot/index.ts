import { discordClient, ensureDiscordLogin } from './client'
import { ensureGuildConfig } from './config'
import { handleCampeonatoInteraction, handlePanelInteraction, isCampeonatoInteraction, isPanelInteraction } from './create-ticket'

// Evita enganchar los listeners dos veces (hot-reload de `next dev`, o si algo llama a
// startDiscordBot() más de una vez): discordClient ya está guardado en globalThis (ver client.ts).
declare global {
  // eslint-disable-next-line no-var
  var __rsxDiscordWired: boolean | undefined
  // eslint-disable-next-line no-var
  var __rsxDiscordLastAttempt: number | undefined
}

/**
 * Arranca el bot de soporte dentro del propio proceso del Hub. Se llama una vez al arrancar el
 * servidor (ver instrumentation.ts) y también cada vez que se guarda un token nuevo desde
 * /soporte/settings. Sin ningún token configurado (ni por entorno ni guardado) no falla: el resto
 * del Hub sigue funcionando igual, solo que sin panel de tickets, hasta que se configure uno.
 */
export async function startDiscordBot(): Promise<void> {
  if (!globalThis.__rsxDiscordWired) {
    globalThis.__rsxDiscordWired = true

    discordClient.once('ready', (client) => {
      console.log(`[support] Bot conectado como ${client.user.tag} (${client.guilds.cache.size} servidor/es)`)
      for (const guild of client.guilds.cache.values()) {
        ensureGuildConfig(guild.id, guild.name).catch((err) => console.error(`[support] no se pudo preparar la configuración de ${guild.id}:`, err))
      }
    })

    // El bot entra en un servidor nuevo: se le crea su fila de configuración con los valores por defecto.
    discordClient.on('guildCreate', (guild) => {
      ensureGuildConfig(guild.id, guild.name).catch((err) => console.error(`[support] no se pudo preparar la configuración de ${guild.id}:`, err))
    })

    discordClient.on('interactionCreate', async (interaction) => {
      try {
        if (interaction.isButton() && isPanelInteraction(interaction.customId)) {
          await handlePanelInteraction(interaction)
        } else if (interaction.isStringSelectMenu()) {
          if (isPanelInteraction(interaction.customId)) await handlePanelInteraction(interaction)
          else if (isCampeonatoInteraction(interaction.customId)) await handleCampeonatoInteraction(interaction)
        }
      } catch (err) {
        console.error('[support] error gestionando una interacción del panel:', err)
        const message = 'Ha ocurrido un error al procesar esto. Inténtalo de nuevo.'
        if (!interaction.isRepliable()) return
        if (interaction.deferred || interaction.replied) await interaction.editReply(message).catch(() => {})
        else await interaction.reply({ content: message, ephemeral: true }).catch(() => {})
      }
    })
  }

  try {
    await ensureDiscordLogin()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('no tiene un token configurado')) {
      console.warn('[support] Bot de soporte sin configurar todavía (ponle un token en /soporte/settings).')
    } else {
      console.error('[support] no se pudo conectar el bot de soporte a Discord:', err)
    }
  }
}

const RETRY_COOLDOWN_MS = 30_000

/**
 * Como startDiscordBot(), pero pensado para llamarse en cada carga de /soporte: si ya está listo
 * no hace nada, y si el último intento fue hace menos de 30s tampoco (evita machacar el login de
 * Discord si alguien recarga la página varias veces seguidas con un token que no funciona).
 * Esto es lo que hace que guardar el token desde otra pestaña, o que el proceso se haya
 * reiniciado, se note solo con volver a entrar en /soporte — sin esto solo se conectaría en el
 * arranque del servidor (instrumentation.ts) o justo al guardar el token.
 */
export async function ensureBotStarted(): Promise<void> {
  if (discordClient.isReady()) return
  const now = Date.now()
  if (globalThis.__rsxDiscordLastAttempt && now - globalThis.__rsxDiscordLastAttempt < RETRY_COOLDOWN_MS) return
  globalThis.__rsxDiscordLastAttempt = now
  await startDiscordBot()
}
