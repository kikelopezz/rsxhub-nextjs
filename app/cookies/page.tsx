import { getLocale } from '@/lib/i18n/get-locale'

export async function generateMetadata() {
  const locale = await getLocale()
  return locale === 'en'
    ? { title: 'Cookie Policy - RSX', description: 'Cookie Policy and cookie usage information for realsimexperience.com.' }
    : { title: 'Política de Cookies - RSX', description: 'Política de cookies e información de uso de cookies de realsimexperience.com.' }
}

export default async function CookiesPage() {
  const locale = await getLocale()
  return (
    <div className="mx-auto max-w-4xl px-6 py-12 md:py-20 text-slate-350 space-y-12">
      {locale === 'en' ? <ContentEn /> : <ContentEs />}
    </div>
  )
}

function ContentEs() {
  return (
    <>
      <div className="border-b border-white/10 pb-6 space-y-2">
        <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tight text-white">Política de Cookies</h1>
        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Última actualización: abril de 2025</p>
      </div>

      <div className="space-y-10 text-xs md:text-sm leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">1. ¿Qué son las cookies?</h2>
          <p>
            Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo cuando visitas un sitio web. Permiten que el sitio recuerde información sobre tu visita, como tu sesión de usuario o tus preferencias.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">2. Cookies que utilizamos</h2>
          <p>
            RSX utiliza únicamente <strong className="text-white">cookies técnicas estrictamente necesarias</strong> para el funcionamiento de la plataforma. No utilizamos cookies publicitarias, de seguimiento ni de análisis de terceros.
          </p>
          <div className="overflow-x-auto mt-4 border border-white/10 rounded-lg">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-slate-300 font-bold uppercase tracking-wider">
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Finalidad</th>
                  <th className="p-3">Duración</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-400">
                <tr>
                  <td className="p-3 font-semibold text-slate-200">rsx_session</td>
                  <td className="p-3">Técnica / Sesión</td>
                  <td className="p-3">Mantiene la sesión del usuario autenticado</td>
                  <td className="p-3">Sesión / 7 días</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-200">__session</td>
                  <td className="p-3">Técnica / Sesión</td>
                  <td className="p-3">Token de autenticación cifrado (JWT)</td>
                  <td className="p-3">7 días</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">3. Cookies de terceros</h2>
          <p>
            Durante el proceso de autenticación, Steam (Valve Corporation) puede establecer sus propias cookies en tu dispositivo conforme a su propia política de privacidad. RSX no tiene control sobre estas cookies. Puedes consultar la política de privacidad de Steam en <a href="https://store.steampowered.com" className="text-[#1274de] hover:underline" target="_blank" rel="noopener noreferrer">store.steampowered.com</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">4. ¿Cómo gestionar las cookies?</h2>
          <p>
            Puedes configurar tu navegador para rechazar o eliminar cookies. Ten en cuenta que desactivar las cookies técnicas puede impedir el correcto funcionamiento de la plataforma, en particular el inicio de sesión.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
            <li>
              <a href="https://support.google.com/chrome/answer/95647" className="text-[#1274de] hover:underline" target="_blank" rel="noopener noreferrer">Google Chrome</a>
            </li>
            <li>
              <a href="https://support.mozilla.org/es/kb/habilitar-y-deshabilitar-cookies-informacion-que-los-sitios-web-guardan" className="text-[#1274de] hover:underline" target="_blank" rel="noopener noreferrer">Mozilla Firefox</a>
            </li>
            <li>
              <a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" className="text-[#1274de] hover:underline" target="_blank" rel="noopener noreferrer">Safari</a>
            </li>
            <li>
              <a href="https://support.microsoft.com/es-es/microsoft-edge/eliminar-las-cookies-en-microsoft-edge-63fdfe0b-6d3c-4872-87c8-0de0d10b1393" className="text-[#1274de] hover:underline" target="_blank" rel="noopener noreferrer">Microsoft Edge</a>
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">5. Más información</h2>
          <p>
            Para cualquier duda sobre el uso de cookies, puedes contactarnos en <a href="mailto:realsimxperience@gmail.com" className="text-[#1274de] hover:underline">realsimxperience@gmail.com</a>. También puedes consultar nuestra <a href="/privacidad" className="text-[#1274de] hover:underline">Política de Privacidad</a>.
          </p>
        </section>
      </div>
    </>
  )
}

function ContentEn() {
  return (
    <>
      <div className="border-b border-white/10 pb-6 space-y-2">
        <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tight text-white">Cookie Policy</h1>
        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Latest update: April 2025</p>
      </div>

      <div className="space-y-10 text-xs md:text-sm leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">1. What are cookies?</h2>
          <p>
            Cookies are small text files that are stored on your device when you visit a website. They allow the site to remember information about your visit, such as your user session or preferences.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">2. Cookies We Use</h2>
          <p>
            RSX uses only <strong className="text-white">strictly necessary technical cookies</strong> for the operation of the platform. We do not use advertising, tracking, or third-party cookies for analysis purposes.
          </p>
          <div className="overflow-x-auto mt-4 border border-white/10 rounded-lg">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-slate-300 font-bold uppercase tracking-wider">
                  <th className="p-3">Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Purpose</th>
                  <th className="p-3">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-400">
                <tr>
                  <td className="p-3 font-semibold text-slate-200">rsx_session</td>
                  <td className="p-3">Technical / Session</td>
                  <td className="p-3">Maintains the authenticated user session</td>
                  <td className="p-3">Session / 7 days</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-200">__session</td>
                  <td className="p-3">Technical / Session</td>
                  <td className="p-3">Encrypted authentication token (JWT)</td>
                  <td className="p-3">7 days</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">3. Third-Party Cookies</h2>
          <p>
            During the authentication process, Steam (Valve Corporation) may set its own cookies on your device in accordance with its own privacy policy. RSX has no control over these cookies. You can consult Steam's privacy policy at <a href="https://store.steampowered.com" className="text-[#1274de] hover:underline" target="_blank" rel="noopener noreferrer">store.steampowered.com</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">4. How to manage cookies?</h2>
          <p>
            You can configure your browser to reject or delete cookies. Please note that disabling technical cookies may prevent the proper functioning of the platform, particularly log in.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
            <li>
              <a href="https://support.google.com/chrome/answer/95647" className="text-[#1274de] hover:underline" target="_blank" rel="noopener noreferrer">Google Chrome</a>
            </li>
            <li>
              <a href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop" className="text-[#1274de] hover:underline" target="_blank" rel="noopener noreferrer">Mozilla Firefox</a>
            </li>
            <li>
              <a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" className="text-[#1274de] hover:underline" target="_blank" rel="noopener noreferrer">Safari</a>
            </li>
            <li>
              <a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63fdfe0b-6d3c-4872-87c8-0de0d10b1393" className="text-[#1274de] hover:underline" target="_blank" rel="noopener noreferrer">Microsoft Edge</a>
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">5. More Information</h2>
          <p>
            For any questions regarding the use of cookies, you can contact us at <a href="mailto:realsimxperience@gmail.com" className="text-[#1274de] hover:underline">realsimxperience@gmail.com</a>. You can also consult our <a href="/privacidad" className="text-[#1274de] hover:underline">Privacy Policy</a>.
          </p>
        </section>
      </div>
    </>
  )
}
