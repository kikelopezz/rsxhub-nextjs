import { getLocale } from '@/lib/i18n/get-locale'

export async function generateMetadata() {
  const locale = await getLocale()
  return locale === 'en'
    ? { title: 'Legal Notice - RSX', description: 'Legal Notice and ownership terms for realsimexperience.com.' }
    : { title: 'Aviso Legal - RSX', description: 'Aviso legal y condiciones de titularidad de realsimexperience.com.' }
}

export default async function LegalNoticePage() {
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
        <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tight text-white">Aviso Legal</h1>
        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Última actualización: abril de 2025</p>
      </div>

      <div className="space-y-10 text-xs md:text-sm leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">1. Datos identificativos</h2>
          <p>
            En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSICE), se facilitan a continuación los datos identificativos del titular del sitio web:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-400 font-medium">
            <li><strong className="text-slate-300">Nombre:</strong> RSX Real Sim Experience</li>
            <li><strong className="text-slate-300">Sitio web:</strong> <a href="https://realsimexperience.com" className="text-[#1274de] hover:underline" target="_blank" rel="noopener noreferrer">https://realsimexperience.com</a></li>
            <li><strong className="text-slate-300">Email:</strong> realsimxperience@gmail.com</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">2. Objeto y ámbito de aplicación</h2>
          <p>
            Este Aviso Legal regula el acceso y el uso del sitio web <strong className="text-white">realsimexperience.com</strong> y de la plataforma RSX, entendida como el conjunto de servicios digitales relacionados con la organización y gestión de ligas de sim racing.
          </p>
          <p>
            El acceso y/o uso del sitio web atribuye la condición de <strong className="text-slate-200">Usuario</strong> al visitante e implica la aceptación plena y sin reservas de estas condiciones.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">3. Propiedad intelectual e industrial</h2>
          <p>
            Todo el contenido del sitio web (textos, imágenes, logotipos, diseño, código fuente y demás elementos) es propiedad de RSX Real Sim Experience o de sus licenciantes y está protegido por las leyes españolas e internacionales de propiedad intelectual e industrial.
          </p>
          <p>
            Queda prohibida cualquier reproducción, distribución, comunicación pública o transformación de este contenido sin la autorización expresa y por escrito del titular, salvo para uso personal y no comercial.
          </p>
          <p className="text-slate-400">
            Los nombres de videojuegos, marcas y logotipos de terceros mencionados en la plataforma (Assetto Corsa, Le Mans Ultimate, Steam, etc.) son propiedad de sus respectivos titulares. RSX no mantiene afiliación oficial alguna con estas marcas.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">4. Exención de garantías y responsabilidad</h2>
          <p>
            RSX no garantiza la disponibilidad continua e ininterrumpida del sitio web ni de sus servicios. El acceso puede verse interrumpido por motivos técnicos, de mantenimiento u otras causas ajenas al control de RSX.
          </p>
          <p>
            RSX no se hace responsable de los daños que puedan derivarse del uso del sitio web, de errores u omisiones en el contenido, o de la conducta de usuarios terceros.
          </p>
          <p className="text-slate-400 italic">
            Los resultados, clasificaciones y estadísticas publicados en la plataforma tienen carácter meramente informativo y pueden ser modificados por los organizadores de cada liga.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">5. Contenido generado por el usuario</h2>
          <p>
            Los usuarios que publiquen contenido en la plataforma (nombres, imágenes, comentarios, reportes de incidentes, etc.) son los únicos responsables de dicho contenido. RSX se reserva el derecho a eliminar cualquier contenido que vulnere derechos de terceros, la legislación vigente o las normas de la comunidad.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">6. Menores de edad</h2>
          <p>
            La plataforma está dirigida a usuarios mayores de 16 años. Los menores de esta edad deberán contar con el consentimiento de sus padres o tutores legales para registrarse y utilizar los servicios.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">7. Legislación aplicable y jurisdicción</h2>
          <p>
            Estas condiciones se rigen por la legislación española. Para la resolución de cualquier controversia derivada del uso del sitio web, las partes se someten a los Juzgados y Tribunales competentes conforme a la normativa española vigente.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">8. Modificaciones del Aviso Legal</h2>
          <p>
            RSX se reserva el derecho a modificar este Aviso Legal en cualquier momento. Las modificaciones surtirán efecto desde su publicación en el sitio web.
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
        <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tight text-white">Legal Notice</h1>
        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Latest update: April 2025</p>
      </div>

      <div className="space-y-10 text-xs md:text-sm leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">1. Identifying Data</h2>
          <p>
            In compliance with Article 10 of Law 34/2002 of July 11 on Information Society Services and Electronic Commerce (LSSICE), the website owner's identifying data is provided below:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-400 font-medium">
            <li><strong className="text-slate-300">Name:</strong> RSX Real Sim Experience</li>
            <li><strong className="text-slate-300">Website:</strong> <a href="https://realsimexperience.com" className="text-[#1274de] hover:underline" target="_blank" rel="noopener noreferrer">https://realsimexperience.com</a></li>
            <li><strong className="text-slate-300">Email:</strong> realsimxperience@gmail.com</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">2. Object and Scope of Application</h2>
          <p>
            This Legal Notice regulates the access and use of the website <strong className="text-white">realsimexperience.com</strong> and the RSX platform, understood as the set of digital services related to the organization and management of sim racing leagues.
          </p>
          <p>
            Accessing and/or using the website attributes the status of <strong className="text-slate-200">User</strong> to the visitor and implies full and unreserved acceptance of these conditions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">3. Intellectual and Industrial Property</h2>
          <p>
            All website content (texts, images, logos, design, source code, and any other elements) is the property of RSX Real Sim Experience or its licensors and is protected by Spanish and international intellectual and industrial property laws.
          </p>
          <p>
            Any reproduction, distribution, public communication, or transformation of this content is prohibited without the express written authorization of the owner, except for personal and non-commercial use.
          </p>
          <p className="text-slate-400">
            Video game names, trademarks, and third-party logos mentioned on the platform (Assetto Corsa, Le Mans Ultimate, Steam, etc.) are the property of their respective owners. RSX has no official affiliation with these brands.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">4. Disclaimer of Warranties and Liability</h2>
          <p>
            RSX does not guarantee the continuous and uninterrupted availability of the website or its services. Access may be interrupted for technical reasons, maintenance, or other causes beyond RSX's control.
          </p>
          <p>
            RSX is not responsible for any damages that may arise from using the website, from errors or omissions in the content, or from the conduct of third-party users.
          </p>
          <p className="text-slate-400 italic">
            Results, standings, and statistics published on the platform are for informational purposes only and may be subject to modification by the organizers of each league.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">5. User-Generated Content</h2>
          <p>
            Users who publish content on the platform (names, images, comments, incident reports, etc.) are solely responsible for that content. RSX reserves the right to remove any content that violates third-party rights, current legislation, or community guidelines.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">6. Minors</h2>
          <p>
            The platform is aimed at users over 16 years of age. Minors under this age must have the consent of their parents or legal guardians to register and use the services.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">7. Applicable Law and Jurisdiction</h2>
          <p>
            These conditions are governed by Spanish law. For the resolution of any dispute arising from the use of the website, the parties submit to the competent Courts and Tribunals in accordance with current Spanish regulations.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">8. Amendments to the Legal Notice</h2>
          <p>
            RSX reserves the right to modify this Legal Notice at any time. Any modifications will take effect upon their publication on the website.
          </p>
        </section>
      </div>
    </>
  )
}
