import { discordClient, ensureDiscordLogin, hasDiscordBot } from './client'
import { ensureGuildConfig } from './config'
import { handleCampeonatoInteraction, handlePanelInteraction, isCampeonatoInteraction, isPanelInteraction } from './create-ticket'

// Evita enganchar los listeners dos veces (hot-reload de `next dev`, o si algo llama a
// startDiscordBot() más de una vez): discordClient ya está guardado en globalThis (ver client.ts).
declare global {
  // eslint-disable-next-line no-var
  var __rsxDiscordWired: boolean | undefined
}

/**
 * Arranca el bot de soporte dentro del propio proceso del Hub. Se llama una vez al arrancar el
 * servidor (ver instrumentation.ts). Sin DISCORD_BOT_TOKEN no hace nada — el resto del Hub sigue
 * funcionando igual, solo que sin panel de tickets.
 */
export async function startDiscordBot(): Promise<void> {
  if (!hasDiscordBot) {
    console.warn('[support] DISCORD_BOT_TOKEN no configurado: el bot de soporte no se conecta.')
    return
  }

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
    console.error('[support] no se pudo conectar el bot de soporte a Discord:', err)
  }
}
