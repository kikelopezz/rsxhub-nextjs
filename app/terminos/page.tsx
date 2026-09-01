import { getLocale } from '@/lib/i18n/get-locale'

export async function generateMetadata() {
  const locale = await getLocale()
  return locale === 'en'
    ? { title: 'Terms & Conditions - RSX', description: 'Terms and Conditions of use for realsimexperience.com.' }
    : { title: 'Términos y Condiciones - RSX', description: 'Términos y condiciones de uso de realsimexperience.com.' }
}

export default async function TermsPage() {
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
          Términos y Condiciones
        </h1>
        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
          Última actualización: abril de 2025
        </p>
      </div>

      <div className="space-y-10 text-xs md:text-sm leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">1. Aceptación de los términos</h2>
          <p>
            Al registrarte y usar la plataforma RSX Real Sim Experience (en adelante, "RSX" o "la Plataforma"), aceptas quedar vinculado por estos Términos y Condiciones, la Política de Privacidad y la Política de Cookies. Si no estás de acuerdo con alguno de estos términos, no debes usar la Plataforma.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">2. Descripción del servicio</h2>
          <p>RSX es una plataforma digital para la organización, gestión y seguimiento de ligas de sim racing. Los servicios incluyen, entre otros:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li>Registro e inscripción en ligas y eventos de sim racing.</li>
            <li>Publicación de resultados, clasificaciones y estadísticas.</li>
            <li>Sistema de reporte de incidentes de carrera.</li>
            <li>Gestión de equipos y pilotos.</li>
            <li>Herramientas de administración para los organizadores de ligas.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">3. Registro de usuario y cuenta</h2>
          <p>El acceso a determinadas funciones requiere registro a través de tu cuenta de Steam. Al registrarte:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li>Debes tener al menos 16 años o contar con autorización parental.</li>
            <li>Eres responsable de mantener la seguridad de tu cuenta.</li>
            <li>Debes proporcionar información veraz y actualizada.</li>
            <li>No puedes crear cuentas con identidades falsas ni suplantar a otras personas.</li>
            <li>Una persona física = una cuenta. Se prohíben las cuentas múltiples.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">4. Normas de conducta</h2>
          <p>El uso de RSX está sujeto a las siguientes normas de conducta. Está prohibido:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li>Acosar, insultar, amenazar o discriminar a otros usuarios.</li>
            <li>Publicar contenido ilegal, ofensivo, obsceno o que vulnere derechos de terceros.</li>
            <li>Intentar acceder sin autorización a sistemas, cuentas o datos.</li>
            <li>Manipular fraudulentamente resultados, clasificaciones o sistemas de puntuación.</li>
            <li>Usar trucos o hacks en las competiciones.</li>
            <li>Enviar spam, publicitar servicios de terceros sin autorización o realizar actividades comerciales no autorizadas.</li>
            <li>Interferir con el funcionamiento técnico de la Plataforma.</li>
          </ul>
          <p>El incumplimiento de estas normas puede conllevar la suspensión temporal o permanente de la cuenta.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">5. Participación en ligas y eventos</h2>
          <p>
            Cada liga puede tener su propio reglamento específico, que prevalecerá sobre estos términos en lo relativo a la competición. Al inscribirte en una liga:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li>Aceptas el reglamento específico de esa liga.</li>
            <li>Reconoces que las decisiones de los comisarios son firmes en materia de incidentes de carrera.</li>
            <li>Entiendes que tu participación puede ser revocada por los organizadores por conducta antideportiva.</li>
            <li>Los resultados publicados pueden modificarse como consecuencia de sanciones o correcciones.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">6. Contenido generado por el usuario</h2>
          <p>
            Al publicar contenido en la Plataforma (nombre de piloto, imágenes, reportes, etc.), concedes a RSX una licencia no exclusiva, gratuita y mundial para usar, mostrar y distribuir ese contenido en el contexto de los servicios de la Plataforma. Eres el único responsable del contenido que publiques y garantizas que dispones de los derechos necesarios para hacerlo.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">7. Suspensión y cancelación de cuenta</h2>
          <p>
            RSX se reserva el derecho de suspender o cancelar cuentas de usuario que incumplan estos términos, sin aviso previo en caso de infracciones graves. Puedes solicitar la cancelación de tu cuenta en cualquier momento escribiendo a <a href="mailto:realsimxperience@gmail.com" className="text-[#1274de] hover:underline">realsimxperience@gmail.com</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">8. Limitación de responsabilidad</h2>
          <p>
            RSX ofrece la Plataforma "tal cual" y no garantiza que el servicio sea ininterrumpido, esté libre de errores o cumpla todas las expectativas del usuario. En la máxima medida permitida por la ley, RSX no será responsable de daños indirectos, incidentales o consecuentes derivados del uso o la imposibilidad de uso de la Plataforma.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">9. Servicios de terceros</h2>
          <p>
            La Plataforma utiliza servicios de terceros como Steam (autenticación), Supabase (base de datos) y Netlify (alojamiento). El uso de estos servicios está sujeto a sus propias condiciones. RSX no se hace responsable de la disponibilidad o el funcionamiento de estos servicios externos.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">10. Modificaciones del servicio y de los términos</h2>
          <p>
            RSX puede modificar, suspender o interrumpir cualquier aspecto del servicio en cualquier momento. Asimismo, puede actualizar estos Términos y Condiciones, notificándolo mediante publicación en la Plataforma. El uso continuado del servicio tras la publicación de los cambios implica su aceptación.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">11. Legislación aplicable</h2>
          <p>
            Estos Términos y Condiciones se rigen por la legislación española. Cualquier controversia se someterá a los tribunales competentes de España.
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
        <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tight text-white">Terms & Conditions</h1>
        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Latest update: April 2025</p>
      </div>

      <div className="space-y-10 text-xs md:text-sm leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">1. Acceptance of Terms</h2>
          <p>
            By registering and using the RSX Real Sim Experience platform (hereinafter, "RSX" or "the Platform"), you agree to be bound by these Terms and Conditions, the Privacy Policy, and the Cookie Policy. If you do not agree with any of these terms, you must not use the Platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">2. Service Description</h2>
          <p>RSX is a digital platform for the organization, management, and tracking of sim racing leagues. Services include, but are not limited to:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li>Registration and enrollment in sim racing leagues and events.</li>
            <li>Publication of results, standings, and statistics.</li>
            <li>Race incident reporting system.</li>
            <li>Team and driver management.</li>
            <li>Administration tools for league organizers.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">3. User Registration and Account</h2>
          <p>Access to certain features requires registration through your Steam account. By registering:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li>You must be at least 16 years old or have parental authorization.</li>
            <li>You are responsible for maintaining the security of your account.</li>
            <li>You must provide truthful and up-to-date information.</li>
            <li>You may not create accounts with false identities or impersonate others.</li>
            <li>One natural person = one account. Multiple accounts are prohibited.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">4. Rules of Conduct</h2>
          <p>The use of RSX is subject to the following rules of conduct. It is prohibited to:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li>Engage in harassment, insults, threats, or discrimination against other users.</li>
            <li>Publish illegal, offensive, obscene content, or content that violates third-party rights.</li>
            <li>Attempt unauthorized access to systems, accounts, or data.</li>
            <li>Fraudulently manipulate results, standings, or scoring systems.</li>
            <li>Use cheats or hacks in competitions.</li>
            <li>Spam, advertise third-party services without authorization, or conduct unauthorized commercial activities.</li>
            <li>Interfere with the technical operation of the Platform.</li>
          </ul>
          <p>Failure to comply with these rules may result in the temporary or permanent suspension of the account.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">5. Participation in Leagues and Events</h2>
          <p>
            Each league may have its own specific regulations, which will prevail over these terms regarding the competition. By signing up for a league:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li>You accept the specific regulations of that league.</li>
            <li>You acknowledge that the decisions of the stewards are final in matters of race incidents.</li>
            <li>You understand that participation may be revoked by the organizers for unsportsmanlike conduct.</li>
            <li>Published results may be modified as a consequence of penalties or corrections.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">6. User-Generated Content</h2>
          <p>
            By publishing content on the Platform (driver name, images, reports, etc.), you grant RSX a non-exclusive, royalty-free, worldwide license to use, display, and distribute that content in the context of the Platform's services. You are solely responsible for the content you publish and guarantee that you have the necessary rights to do so.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">7. Suspension and Cancellation of Account</h2>
          <p>
            RSX reserves the right to suspend or cancel user accounts that violate these terms, without prior notice in case of serious infractions. You may request the cancellation of your account at any time by writing to <a href="mailto:realsimxperience@gmail.com" className="text-[#1274de] hover:underline">realsimxperience@gmail.com</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">8. Limitation of Liability</h2>
          <p>
            RSX provides the Platform "as is" and does not guarantee that the service will be uninterrupted, error-free, or meet all user expectations. To the maximum extent permitted by law, RSX will not be liable for indirect, incidental, or consequential damages arising from the use or inability to use the Platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">9. Third-Party Services</h2>
          <p>
            The Platform uses third-party services such as Steam (authentication), Supabase (database), and Netlify (hosting). The use of these services is subject to their own conditions. RSX is not responsible for the availability or operation of these external services.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">10. Modifications of the Service and Terms</h2>
          <p>
            RSX may modify, suspend, or discontinue any aspect of the service at any time. Likewise, it may update these Terms and Conditions, notifying you by posting on the Platform. Continued use of the service after the publication of changes implies acceptance thereof.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white uppercase tracking-wide">11. Applicable Legislation</h2>
          <p>
            These Terms and Conditions are governed by Spanish legislation. Any dispute will be submitted to the competent courts of Spain.
          </p>
        </section>
      </div>
    </>
  )
}
