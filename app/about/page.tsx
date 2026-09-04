import Link from 'next/link'
import {
  Flag,
  Users,
  Server,
  Globe,
  Megaphone,
  Radio,
  Trophy,
  Code,
  Shield
} from 'lucide-react'
import { getLocale } from '@/lib/i18n/get-locale'

export async function generateMetadata() {
  const locale = await getLocale()
  return locale === 'en'
    ? { title: 'About - Real Sim Experience', description: 'Learn about RSX sim racing community, our history, services, partners and how to compete in our competitive leagues.' }
    : { title: 'Sobre nosotros - Real Sim Experience', description: 'Conoce la comunidad de sim racing RSX, nuestra historia, servicios, colaboradores y cómo competir en nuestros campeonatos.' }
}

export default async function AboutPage() {
  const locale = await getLocale()
  return <div className="space-y-10 text-white pb-16">{locale === 'en' ? <ContentEn /> : <ContentEs />}</div>
}

function ContentEs() {
  return (
    <>
      {/* 1. Hero Section with Daytona background */}
      <section className="relative w-full overflow-hidden border border-shell-line bg-black/60 rounded-lg h-[420px] flex items-center">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 z-0"
          style={{ backgroundImage: "url('/about/daytona.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#060910] via-[#060910]/80 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060910] via-transparent to-transparent z-10" />

        <div className="relative z-20 max-w-3xl px-6 md:px-12 space-y-4">
          <span className="inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 font-mono-data text-xs font-bold uppercase tracking-widest text-accent">
            <Flag className="h-3.5 w-3.5" />
            Quiénes somos
          </span>
          <h1 className="font-display-league text-4xl uppercase text-white md:text-5xl">
            Sobre <span className="text-accent">Real Sim Experience</span>
          </h1>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed max-w-2xl">
            RSX es una comunidad de sim racing fundada por apasionados del motorsport virtual. Organizamos
            ligas competitivas, ofrecemos servicios profesionales y reunimos a los mejores pilotos de la
            escena de sim racing española e internacional.
          </p>
        </div>
      </section>

      {/* 2. Our Story Section */}
      <section className="grid gap-8 lg:grid-cols-[1.2fr_1fr] items-start">
        <div className="space-y-6 rounded-lg border border-shell-line bg-gradient-to-br from-[#0d1420] via-[#0a0f18] to-[#070a10] p-6 md:p-8">
          <div className="space-y-2">
            <span className="font-mono-data text-xs font-bold uppercase tracking-widest text-accent">Nuestra historia</span>
            <h2 className="font-display-league text-2xl uppercase text-white md:text-3xl">
              Sim Racing <span className="text-accent">de verdad</span>
            </h2>
          </div>

          <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
            <p>
              RSX nació de la necesidad de una plataforma de sim racing donde la competición sea justa,
              organizada y con el nivel de seriedad que los pilotos merecen. Lo que empezó como un grupo de
              amigos se ha convertido en una de las comunidades de motorsport virtual más importantes del
              mundo hispanohablante.
            </p>
            <p>
              Organizamos ligas en los simuladores más exigentes disponibles: <strong className="text-white">Assetto Corsa</strong>, y otros títulos punteros. Cada campeonato cuenta con dirección de carrera, sala de comisarios y un reglamento detallado.
            </p>
            <p>
              Nuestra plataforma de gestión es completamente propia: inscripciones, resultados, sanciones,
              equipos y comunicaciones, todo en un mismo lugar.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="flex items-start gap-3 rounded-lg border border-shell-line bg-black/30 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <Flag className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">Competición seria</h3>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                Campeonatos con reglamento claro, dirección de carrera y sala de comisarios en directo.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-shell-line bg-black/30 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <Users className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">La comunidad primero</h3>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                Somos apasionados del motorsport virtual. El respeto dentro y fuera de la pista es innegociable.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-shell-line bg-black/30 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <Server className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">Infraestructura propia</h3>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                Hemos construido nuestra propia plataforma: ligas, equipos, resultados y sanciones en un mismo sitio.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-shell-line bg-black/30 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <Globe className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">Alcance internacional</h3>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                Pilotos de toda Europa y América compiten en nuestras ligas sobre servidores dedicados.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Our Services Section */}
      <section className="space-y-6">
        <div className="space-y-2">
          <span className="font-mono-data text-xs font-bold uppercase tracking-widest text-accent">Qué ofrecemos</span>
          <h2 className="font-display-league text-2xl uppercase text-white md:text-3xl">
            Nuestros <span className="text-accent">Servicios</span>
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
            Más allá de nuestras propias ligas, RSX ofrece servicios profesionales para marcas, comunidades y
            organizaciones deportivas que quieran llevar su proyecto al mundo del sim racing.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-shell-line bg-black/30 p-6 space-y-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <Megaphone className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-bold text-white">Marketing</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Diseñamos y ejecutamos campañas de comunicación para marcas dentro del ecosistema del motorsport
              virtual: redes sociales, contenido patrocinado, branded content y estrategia digital.
            </p>
          </div>

          <div className="rounded-lg border border-shell-line bg-black/30 p-6 space-y-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <Radio className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-bold text-white">Retransmisión</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Producción y retransmisión de carreras en directo con comentaristas, gráficos en pantalla y
              dirección multicámara. Calidad de emisión adaptada a cualquier presupuesto.
            </p>
          </div>

          <div className="rounded-lg border border-shell-line bg-black/30 p-6 space-y-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <Trophy className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-bold text-white">Competiciones virtuales</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Creamos campeonatos virtuales basados en competiciones reales, para clientes de Fórmula, GT,
              Resistencia o Rally que quieran llevar su serie al sim racing.
            </p>
          </div>

          <div className="rounded-lg border border-shell-line bg-black/30 p-6 space-y-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <Code className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-bold text-white">Desarrollo web</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Diseño y desarrollo de plataformas y webs a medida para comunidades, organizaciones deportivas y
              marcas: webs de campeonatos, paneles de gestión, resultados en tiempo real.
            </p>
          </div>

          <div className="rounded-lg border border-shell-line bg-black/30 p-6 space-y-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <Shield className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-bold text-white">Dirección de carrera</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Servicio externo de dirección de carrera para otras comunidades y ligas: gestión de incidentes,
              aplicación del reglamento, decisiones de comisarios y comunicaciones oficiales.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Our Partners Section */}
      <section className="space-y-6">
        <div className="space-y-2">
          <span className="font-mono-data text-xs font-bold uppercase tracking-widest text-accent">Colaboradores</span>
          <h2 className="font-display-league text-2xl uppercase text-white md:text-3xl">
            Nuestros <span className="text-accent">Partners</span>
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
            Empresas y organizaciones que confían en RSX. Cada colaboración se construye sobre valores
            compartidos y el compromiso de hacer crecer el ecosistema del motorsport virtual.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-shell-line bg-transparent py-16 px-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-shell-line bg-white/5 text-slate-500">
            <Users className="h-5 w-5" />
          </span>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Próximamente</h3>
          <p className="text-xs text-slate-500">Los partners se anunciarán en breve.</p>
        </div>
      </section>

      {/* 5. Call To Action Banner */}
      <section className="border border-shell-line bg-gradient-to-r from-[#0c1626] to-[#060a12] p-8 md:p-12 text-center space-y-6 rounded-lg shadow-xl max-w-5xl mx-auto">
        <h2 className="font-display-league text-3xl uppercase text-white md:text-4xl">
          ¿Listo para <span className="text-accent">competir?</span>
        </h2>
        <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
          Únete a nuestra comunidad, inscríbete en una liga y demuestra tu ritmo en pista.
        </p>
        <div className="flex flex-wrap justify-center gap-4 pt-2">
          <Link
            href="/ligas"
            className="bg-[#1274de] hover:bg-[#0f62c0] text-white px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
          >
            Ver ligas
          </Link>
          <Link
            href="/equipos"
            className="border border-shell-line bg-transparent hover:bg-white/5 text-white px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
          >
            Crear equipo
          </Link>
        </div>
      </section>
    </>
  )
}

function ContentEn() {
  return (
    <>
      {/* 1. Hero Section with Daytona background */}
      <section className="relative w-full overflow-hidden border border-shell-line bg-black/60 rounded-lg h-[420px] flex items-center">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 z-0"
          style={{ backgroundImage: "url('/about/daytona.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#060910] via-[#060910]/80 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060910] via-transparent to-transparent z-10" />

        <div className="relative z-20 max-w-3xl px-6 md:px-12 space-y-4">
          <span className="inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 font-mono-data text-xs font-bold uppercase tracking-widest text-accent">
            <Flag className="h-3.5 w-3.5" />
            Who We Are
          </span>
          <h1 className="font-display-league text-4xl uppercase text-white md:text-5xl">
            About <span className="text-accent">Real Sim Experience</span>
          </h1>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed max-w-2xl">
            RSX is a sim racing community founded by virtual motorsport enthusiasts.
            We run competitive leagues, provide professional services, and bring
            together the best drivers from the Spanish and international sim racing
            scene.
          </p>
        </div>
      </section>

      {/* 2. Our Story Section */}
      <section className="grid gap-8 lg:grid-cols-[1.2fr_1fr] items-start">
        <div className="space-y-6 rounded-lg border border-shell-line bg-gradient-to-br from-[#0d1420] via-[#0a0f18] to-[#070a10] p-6 md:p-8">
          <div className="space-y-2">
            <span className="font-mono-data text-xs font-bold uppercase tracking-widest text-accent">Our Story</span>
            <h2 className="font-display-league text-2xl uppercase text-white md:text-3xl">
              Sim Racing <span className="text-accent">For Real</span>
            </h2>
          </div>

          <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
            <p>
              RSX was born out of the need for a sim racing platform where competition is fair,
              organised and at the level of seriousness that drivers deserve. What started as
              a group of friends has grown into one of the leading virtual motorsport
              communities in the Spanish-speaking world.
            </p>
            <p>
              We run leagues on the most demanding simulators available: <strong className="text-white">Assetto Corsa</strong>, and other top titles. Every championship features race direction, a stewards room and a detailed rulebook.
            </p>
            <p>
              Our management platform is entirely our own: registrations, results, penalties,
              teams and communications — all in one place.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="flex items-start gap-3 rounded-lg border border-shell-line bg-black/30 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <Flag className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">Serious Competition</h3>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                Championships with clear regulations, race direction and a live stewards room.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-shell-line bg-black/30 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <Users className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">Community First</h3>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                We are passionate about virtual motorsport. Respect on and off track is non-negotiable.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-shell-line bg-black/30 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <Server className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">Own Infrastructure</h3>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                We have built our own platform: leagues, teams, results and penalties all in one place.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-shell-line bg-black/30 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <Globe className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">International Reach</h3>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                Drivers from across Europe and the Americas compete in our leagues on dedicated servers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Our Services Section */}
      <section className="space-y-6">
        <div className="space-y-2">
          <span className="font-mono-data text-xs font-bold uppercase tracking-widest text-accent">What We Offer</span>
          <h2 className="font-display-league text-2xl uppercase text-white md:text-3xl">
            Our <span className="text-accent">Services</span>
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
            Beyond our own leagues, RSX offers professional services for brands, communities and sports
            organisations looking to bring their project into the sim racing world.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-shell-line bg-black/30 p-6 space-y-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <Megaphone className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-bold text-white">Marketing</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              We design and execute communication campaigns for brands within the virtual motorsport
              ecosystem: social media, sponsored content, branded content and digital strategy.
            </p>
          </div>

          <div className="rounded-lg border border-shell-line bg-black/30 p-6 space-y-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <Radio className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-bold text-white">Broadcasting</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Live race production and broadcast with commentators, on-screen graphics and
              multi-camera direction. Broadcast quality adapted to every budget.
            </p>
          </div>

          <div className="rounded-lg border border-shell-line bg-black/30 p-6 space-y-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <Trophy className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-bold text-white">Virtual Competitions</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              We create virtual championships based on real-world competitions — for Formula, GT,
              Endurance or Rally clients looking to bring their series into sim racing.
            </p>
          </div>

          <div className="rounded-lg border border-shell-line bg-black/30 p-6 space-y-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <Code className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-bold text-white">Web Development</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Design and development of custom platforms and websites for communities, sports
              organisations and brands: championship sites, management panels, real-time results.
            </p>
          </div>

          <div className="rounded-lg border border-shell-line bg-black/30 p-6 space-y-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <Shield className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-bold text-white">Race Direction</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              External race direction service for other communities and leagues: incident management,
              regulation enforcement, stewards decisions and official communications.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Our Partners Section */}
      <section className="space-y-6">
        <div className="space-y-2">
          <span className="font-mono-data text-xs font-bold uppercase tracking-widest text-accent">Collaborators</span>
          <h2 className="font-display-league text-2xl uppercase text-white md:text-3xl">
            Our <span className="text-accent">Partners</span>
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
            Companies and organisations that trust RSX. Every partnership is built on shared values
            and a commitment to growing the virtual motorsport ecosystem.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-shell-line bg-transparent py-16 px-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-shell-line bg-white/5 text-slate-500">
            <Users className="h-5 w-5" />
          </span>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Coming Soon</h3>
          <p className="text-xs text-slate-500">Partners will be announced shortly.</p>
        </div>
      </section>

      {/* 5. Call To Action Banner */}
      <section className="border border-shell-line bg-gradient-to-r from-[#0c1626] to-[#060a12] p-8 md:p-12 text-center space-y-6 rounded-lg shadow-xl max-w-5xl mx-auto">
        <h2 className="font-display-league text-3xl uppercase text-white md:text-4xl">
          Ready to <span className="text-accent">Compete?</span>
        </h2>
        <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
          Join our community, sign up for a league and prove your pace on track.
        </p>
        <div className="flex flex-wrap justify-center gap-4 pt-2">
          <Link
            href="/ligas"
            className="bg-[#1274de] hover:bg-[#0f62c0] text-white px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
          >
            View Leagues
          </Link>
          <Link
            href="/equipos"
            className="border border-shell-line bg-transparent hover:bg-white/5 text-white px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
          >
            Create Team
          </Link>
        </div>
      </section>
    </>
  )
}
