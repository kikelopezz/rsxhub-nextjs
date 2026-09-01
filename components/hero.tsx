import Link from 'next/link'

export function Hero() {
  return (
    <section className="shell-panel relative overflow-hidden px-5 py-8 md:px-7 md:py-10">
      <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '26px 26px' }} />
      <div className="absolute -right-16 top-0 h-44 w-44 rounded-full bg-sky-300/20 blur-3xl" />

      <div className="relative max-w-4xl">
        <span className="inline-flex rounded-md border border-sky-300/35 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-200">
          Assetto Corsa - Le Mans Ultimate
        </span>

        <h1 className="mt-4 text-3xl font-bold leading-tight text-white md:text-5xl">
          Race control interface for modern simracing leagues.
        </h1>

        <p className="mt-3 max-w-3xl text-base text-slate-300">
          Organize championships, publish events, manage registrations and run your entire competitive workflow from one cockpit-like dashboard.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/ligas" className="inline-flex rounded-md bg-shell-accent px-4 py-2 text-sm font-bold text-white">Browse Races</Link>
          <a href="/api/auth/steam" className="inline-flex rounded-md border border-shell-line bg-white/5 px-4 py-2 text-sm font-semibold text-white">Sign in Steam</a>
        </div>
      </div>
    </section>
  )
}

