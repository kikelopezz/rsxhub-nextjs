'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useDictionary } from '@/lib/i18n/locale-provider'

const SLIDE_IMAGES = ['/carousel/slide1.png', '/carousel/slide2.png', '/carousel/slide3.png', '/carousel/slide4.png', '/carousel/slide5.png']

interface HeroSectionProps {
  driversCount: number
  leaguesCount: number
  simulatorsCount: number
  racesCount: number
  teamsCount: number
}

export function HeroSection({ driversCount, leaguesCount, simulatorsCount, racesCount, teamsCount }: HeroSectionProps) {
  const [current, setCurrent] = useState(0)
  const dict = useDictionary()
  const slides = SLIDE_IMAGES.map((image, i) => ({ image, subtitle: dict.home.hero.slides[i] }))

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [slides.length])

  return (
    <div className="-mx-10 -mt-[76px] md:-mx-20 w-auto overflow-hidden">
      {/* Banner de Hero Carousel - Altura completa y ancho de pantalla, por detrás del header */}
      <section className="relative h-screen min-h-[600px] w-full overflow-hidden">
        {/* Contenedor de las Slides (Cross-fade) */}
        <div className="absolute inset-0">
          {slides.map((slide, index) => (
            <div
              key={index}
              className="absolute inset-0 overflow-hidden transition-opacity duration-1000 ease-in-out"
              style={{ opacity: index === current ? 1 : 0, zIndex: index === current ? 1 : 0 }}
            >
              <Image
                src={slide.image}
                alt="Simracing Backdrop"
                fill
                priority={index === 0}
                sizes="100vw"
                quality={90}
                className={`object-cover object-center transition-transform duration-[6000ms] ease-out ${index === current ? 'scale-105' : 'scale-100'}`}
              />
            </div>
          ))}
        </div>

        {/* Gradiente Oscuro continuo que se funde arriba, centro y base */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-[#030508]" style={{ zIndex: 2 }} />

        {/* Contenido Superpuesto */}
        <div className="relative mx-auto flex flex-col justify-between h-full max-w-[1400px] px-6 md:px-12 pt-24 pb-12 md:pb-16" style={{ zIndex: 5 }}>
          {/* Sección de Textos y CTA */}
          <div className="my-auto max-w-2xl text-left space-y-6 md:space-y-8">
            <div className="w-fit">
              <Image src="/branding/rsx-logo.png" alt="RSX Logo" width={440} height={130} priority className="h-auto w-[260px] md:w-[360px]" />
            </div>

            <p className="text-lg md:text-xl text-slate-150 leading-relaxed font-semibold transition-all duration-500 max-w-xl">
              {slides[current].subtitle}
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link href="/ligas" className="inline-flex bg-[#1274de] hover:bg-[#1f82ee] px-7 py-3 text-xs md:text-sm font-bold uppercase tracking-wider text-white transition-colors rounded-lg shadow-[0_0_15px_rgba(18,116,222,0.4)]">
                {dict.home.hero.viewLeagues}
              </Link>
              <Link href="/about" className="inline-flex border border-white/20 bg-black/40 hover:bg-white/10 px-7 py-3 text-xs md:text-sm font-bold uppercase tracking-wider text-white transition-colors rounded-lg">
                {dict.home.hero.aboutRsx}
              </Link>
            </div>
          </div>

          {/* Sección de Indicadores (Dots) y Barra de Estadísticas */}
          <div className="w-full space-y-6">
            {/* Puntos del carrusel */}
            <div className="flex justify-center gap-2">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrent(index)}
                  className={`h-1 transition-all duration-300 rounded-lg ${index === current ? 'w-10 bg-[#1274de]' : 'w-5 bg-slate-650 hover:bg-slate-500'}`}
                  aria-label={`${dict.home.hero.goToSlide} ${index + 1}`}
                />
              ))}
            </div>

            {/* Columnas de Estadísticas */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-center">
              <div className="space-y-1 relative after:hidden md:after:block after:absolute after:right-0 after:top-1/4 after:h-1/2 after:w-[1px] after:bg-white/15">
                <div className="text-4xl font-extrabold tracking-tight text-white md:text-5xl [text-shadow:0_0_24px_rgba(18,116,222,0.5)]">{driversCount}</div>
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-350">{dict.home.hero.stats.drivers}</div>
              </div>
              <div className="space-y-1 relative after:hidden md:after:block after:absolute after:right-0 after:top-1/4 after:h-1/2 after:w-[1px] after:bg-white/15">
                <div className="text-4xl font-extrabold tracking-tight text-white md:text-5xl [text-shadow:0_0_24px_rgba(18,116,222,0.5)]">{teamsCount}</div>
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-350">{dict.home.hero.stats.teams}</div>
              </div>
              <div className="space-y-1 relative after:hidden md:after:block after:absolute after:right-0 after:top-1/4 after:h-1/2 after:w-[1px] after:bg-white/15">
                <div className="text-4xl font-extrabold tracking-tight text-white md:text-5xl [text-shadow:0_0_24px_rgba(18,116,222,0.5)]">{leaguesCount}</div>
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-350">{dict.home.hero.stats.leagues}</div>
              </div>
              <div className="space-y-1 relative after:hidden md:after:block after:absolute after:right-0 after:top-1/4 after:h-1/2 after:w-[1px] after:bg-white/15">
                <div className="text-4xl font-extrabold tracking-tight text-white md:text-5xl [text-shadow:0_0_24px_rgba(18,116,222,0.5)]">{simulatorsCount}</div>
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-350">{dict.home.hero.stats.simulators}</div>
              </div>
              <div className="space-y-1">
                <div className="text-4xl font-extrabold tracking-tight text-white md:text-5xl [text-shadow:0_0_24px_rgba(18,116,222,0.5)]">{racesCount}</div>
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-350">{dict.home.hero.stats.races}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
