import { getLocale } from '@/lib/i18n/get-locale'

export async function generateMetadata() {
  const locale = await getLocale()
  return locale === 'en'
    ? { title: 'Privacy Policy - RSX', description: 'Privacy Policy and data processing terms for realsimexperience.com.' }
    : { title: 'Política de Privacidad - RSX', description: 'Política de privacidad y tratamiento de datos de realsimexperience.com.' }
}

export default async function PrivacyPage() {
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
        <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tight text-white">
          Política de Privacidad
        </h1>
        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
          Última actualización: abril de 2025
        </p>
      </div>

      <div className="space-y-10 text-xs md:text-sm leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">1. Responsable del tratamiento</h2>
          <p>
            El responsable del tratamiento de los datos personales recogidos en <strong className="text-white">realsimexperience.com</strong> es:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-400 font-medium">
            <li><strong className="text-slate-300">Nombre / Denominación social:</strong> RSX Real Sim Experience</li>
            <li><strong className="text-slate-300">Email de contacto:</strong> contacto@realsimexperience.com</li>
            <li><strong className="text-slate-300">Sitio web:</strong> <a href="https://realsimexperience.com" className="text-[#1274de] hover:underline" target="_blank" rel="noopener noreferrer">https://realsimexperience.com</a></li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">2. Datos que recopilamos</h2>
          <p>Al usar la plataforma RSX, podemos recopilar los siguientes datos:</p>
          <ul className="list-disc pl-5 space-y-2 text-slate-400">
            <li>
              <strong className="text-slate-200">Datos de cuenta de Steam:</strong> Steam ID, nombre público de Steam y avatar de perfil, obtenidos mediante autenticación Steam OpenID.
            </li>
            <li>
              <strong className="text-slate-200">Datos de perfil:</strong> nombre visible, nombre y apellidos (opcional), usuario de Discord, nacionalidad e imagen de avatar.
            </li>
            <li>
              <strong className="text-slate-200">Datos de actividad en las ligas:</strong> resultados de carrera, tiempos, posiciones, puntos, vehículo utilizado, categoría y dorsal.
            </li>
            <li>
              <strong className="text-slate-200">Datos técnicos:</strong> dirección IP, tipo de navegador, páginas visitadas y cookies de sesión necesarias para el funcionamiento del servicio.
            </li>
          </ul>
          <p className="text-slate-400 italic">No recopilamos datos de pago ni información bancaria.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">3. Finalidad del tratamiento</h2>
          <p>Tratamos tus datos personales para las siguientes finalidades:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
            <li>Gestionar el acceso y la autenticación de usuarios en la plataforma.</li>
            <li>Mostrar clasificaciones, resultados y estadísticas de las ligas.</li>
            <li>Comunicarnos contigo sobre tu actividad en la plataforma.</li>
            <li>Mejorar el funcionamiento técnico del servicio.</li>
            <li>Cumplir con las obligaciones legales aplicables.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">4. Base legal del tratamiento</h2>
          <p>Las bases legales para el tratamiento de tus datos son:</p>
          <ul className="list-disc pl-5 space-y-2 text-slate-400">
            <li>
              <strong className="text-slate-200">Ejecución de un contrato:</strong> datos necesarios para prestarte el servicio de la plataforma.
            </li>
            <li>
              <strong className="text-slate-200">Consentimiento:</strong> datos de perfil opcionales que aportas voluntariamente.
            </li>
            <li>
              <strong className="text-slate-200">Interés legítimo:</strong> datos técnicos para mantener la seguridad e integridad del servicio.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">5. Conservación de los datos</h2>
          <p>
            Conservamos tus datos mientras mantengas una cuenta activa en la plataforma. Si solicitas la eliminación de tu cuenta, eliminaremos tus datos personales en un plazo máximo de 30 días, salvo que exista una obligación legal de conservarlos.
          </p>
          <p>Los resultados y estadísticas de carrera pueden conservarse de forma anonimizada con fines históricos.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">6. Cesión de datos a terceros</h2>
          <p>
            No cedemos tus datos personales a terceros con fines comerciales. Los datos pueden ser accesibles por los siguientes proveedores de servicios, que actúan como encargados del tratamiento:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-400 font-medium">
            <li><strong className="text-slate-300">Supabase Inc.</strong> — infraestructura de base de datos (servidores en la UE disponibles).</li>
            <li><strong className="text-slate-300">Netlify Inc.</strong> — alojamiento web y distribución de contenido.</li>
            <li><strong className="text-slate-300">Valve Corporation (Steam)</strong> — autenticación OpenID.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">7. Tus derechos</h2>
          <p>De acuerdo con el RGPD (Reglamento UE 2016/679) y la normativa aplicable, tienes derecho a:</p>
          <ul className="list-disc pl-5 space-y-2 text-slate-400">
            <li><strong className="text-slate-200">Acceso:</strong> conocer qué datos tenemos sobre ti.</li>
            <li><strong className="text-slate-200">Rectificación:</strong> corregir datos inexactos.</li>
            <li><strong className="text-slate-200">Supresión:</strong> solicitar la eliminación de tus datos ("derecho al olvido").</li>
            <li><strong className="text-slate-200">Oposición:</strong> oponerte a determinados tratamientos.</li>
            <li><strong className="text-slate-200">Portabilidad:</strong> recibir tus datos en un formato estructurado.</li>
            <li><strong className="text-slate-200">Limitación:</strong> limitar el tratamiento en determinadas circunstancias.</li>
          </ul>
          <p>
            Para ejercer cualquiera de estos derechos, escríbenos a <strong className="text-white">realsimxperience@gmail.com</strong>. Si consideras que el tratamiento no se ajusta a la normativa, puedes presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD) en <a href="https://www.aepd.es" className="text-[#1274de] hover:underline" target="_blank" rel="noopener noreferrer">www.aepd.es</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">8. Cookies</h2>
          <p>
            Solo utilizamos cookies técnicas estrictamente necesarias para el funcionamiento de la sesión y la autenticación. No utilizamos cookies publicitarias ni de seguimiento de terceros.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">9. Seguridad</h2>
          <p>
            Aplicamos medidas técnicas y organizativas adecuadas para proteger tus datos frente a accesos no autorizados, pérdida o destrucción, incluyendo cifrado en tránsito (HTTPS) y acceso restringido a la base de datos.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">10. Modificaciones</h2>
          <p>
            Podemos actualizar esta política en cualquier momento. Te notificaremos los cambios relevantes publicando la nueva versión en esta página junto con la fecha de actualización.
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
        <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tight text-white">Privacy Policy</h1>
        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Latest update: April 2025</p>
      </div>

      <div className="space-y-10 text-xs md:text-sm leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">1. Data Controller</h2>
          <p>
            The controller of the personal data collected on <strong className="text-white">realsimexperience.com</strong> is:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-400 font-medium">
            <li><strong className="text-slate-300">Name / Corporate name:</strong> RSX Real Sim Experience</li>
            <li><strong className="text-slate-300">Contact email:</strong> contacto@realsimexperience.com</li>
            <li><strong className="text-slate-300">Website:</strong> <a href="https://realsimexperience.com" className="text-[#1274de] hover:underline" target="_blank" rel="noopener noreferrer">https://realsimexperience.com</a></li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">2. Data We Collect</h2>
          <p>By using the RSX platform, we may collect the following data:</p>
          <ul className="list-disc pl-5 space-y-2 text-slate-400">
            <li>
              <strong className="text-slate-200">Steam account data:</strong> Steam ID, Steam display name, and profile avatar, obtained through Steam OpenID authentication.
            </li>
            <li>
              <strong className="text-slate-200">Profile data:</strong> display name, first and last name (optional), Discord username, nationality, and avatar image.
            </li>
            <li>
              <strong className="text-slate-200">League activity data:</strong> race results, times, positions, points, vehicle used, class, and driver number.
            </li>
            <li>
              <strong className="text-slate-200">Technical data:</strong> IP address, browser type, pages visited, and session cookies necessary for the operation of the service.
            </li>
          </ul>
          <p className="text-slate-400 italic">We do not collect payment data or banking information.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">3. Purpose of Processing</h2>
          <p>We process your personal data for the following purposes:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
            <li>Manage user access and authentication on the platform.</li>
            <li>Display standings, results, and league statistics.</li>
            <li>Communicate with you regarding activity on the platform.</li>
            <li>Improve the technical operation of the service.</li>
            <li>Comply with applicable legal obligations.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">4. Legal Basis for Processing</h2>
          <p>The legal bases for processing your data are:</p>
          <ul className="list-disc pl-5 space-y-2 text-slate-400">
            <li>
              <strong className="text-slate-200">Performance of a contract:</strong> data required to provide you with the platform service.
            </li>
            <li>
              <strong className="text-slate-200">Consent:</strong> optional profile data that you voluntarily provide yourself.
            </li>
            <li>
              <strong className="text-slate-200">Legitimate interest:</strong> technical data for maintaining the safety or integrity of the service.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">5. Data Retention</h2>
          <p>
            We retain your data as long as you maintain an active account on the platform. If you request the deletion of your account, we will delete your personal data within a maximum period of 30 days, unless a legal obligation to retain them exists.
          </p>
          <p>Race results and statistics may be kept in an anonymized form for historical purposes.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">6. Data Sharing with Third Parties</h2>
          <p>
            We do not transfer your personal data to third parties for commercial purposes. The data may be accessible by the following service providers, acting as data processors:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-400 font-medium">
            <li><strong className="text-slate-300">Supabase Inc.</strong> — database infrastructure (EU servers available).</li>
            <li><strong className="text-slate-300">Netlify Inc.</strong> — web hosting and content distribution.</li>
            <li><strong className="text-slate-300">Valve Corporation (Steam)</strong> — OpenID authentication.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">7. Your Rights</h2>
          <p>In accordance with the GDPR (Regulation EU 2016/679) and applicable regulations, you have the right to:</p>
          <ul className="list-disc pl-5 space-y-2 text-slate-400">
            <li><strong className="text-slate-200">Access:</strong> know what data we hold about you.</li>
            <li><strong className="text-slate-200">Rectification:</strong> correct inaccurate data.</li>
            <li><strong className="text-slate-200">Erasure:</strong> request the deletion of your data ("right to be forgotten").</li>
            <li><strong className="text-slate-200">Objection:</strong> object to certain processing operations.</li>
            <li><strong className="text-slate-200">Portability:</strong> receive your data in a structured format.</li>
            <li><strong className="text-slate-200">Restriction:</strong> restrict processing under certain circumstances.</li>
          </ul>
          <p>
            To exercise any of these rights, write to us at <strong className="text-white">realsimxperience@gmail.com</strong>. If you believe that the processing does not comply with regulations, you can file a complaint with the Spanish Agency for Data Protection (AEPD) at <a href="https://www.aepd.es" className="text-[#1274de] hover:underline" target="_blank" rel="noopener noreferrer">www.aepd.es</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">8. Cookies</h2>
          <p>
            We only use technical cookies strictly necessary for session operation and authentication. We do not use advertising or third-party tracking cookies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">9. Security</h2>
          <p>
            We apply appropriate technical and organizational measures to protect your data against unauthorized access, loss, or destruction, including encryption in transit (HTTPS) and restricted access to the database.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">10. Amendments</h2>
          <p>
            We may update this policy at any time. We will notify you of relevant changes by publishing the new version on this page along with the update date.
          </p>
        </section>
      </div>
    </>
  )
}
