/**
 * Hook de arranque de Next.js: se ejecuta una vez al iniciar el servidor, antes de servir la
 * primera petición. Aquí se conecta el bot de soporte de Discord — vive en el mismo proceso que
 * el Hub, así que no depende de otro programa aparte ni de que alguien se acuerde de arrancarlo.
 *
 * Guardado tras `NEXT_RUNTIME === 'nodejs'`: este archivo también se carga en el runtime Edge, que
 * no tiene las APIs de Node que discord.js necesita (sockets, etc.).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startDiscordBot } = await import('@/lib/discord-bot')
    await startDiscordBot()
  }
}
