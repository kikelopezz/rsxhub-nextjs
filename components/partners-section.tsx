import Image from 'next/image'
import Link from 'next/link'
import { getDictionary } from '@/lib/i18n/get-dictionary'
import { getLocale } from '@/lib/i18n/get-locale'

const PARTNERS = [
  { name: 'Gravity Technologies', logo: '/partners/gravity-technologies.png', url: null },
  { name: 'AC Server Hosting', logo: '/partners/ac-server-hosting.png', url: null },
]

export async function PartnersSection() {
  const dict = getDictionary(await getLocale())
  const t = dict.home.partners

  return (
    <section className="mx-auto max-w-[1400px] px-6 py-16 md:px-12 md:py-20">
      <div className="mb-8 border-b border-white/10 pb-4 text-center">
        <h2 className="font-display-league text-3xl uppercase text-white">{t.title}</h2>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16">
        {PARTNERS.map((partner) => {
          const logo = (
            <Image
              src={partner.logo}
              alt={partner.name}
              width={220}
              height={110}
              className="h-20 w-auto object-contain opacity-90 transition-opacity hover:opacity-100 md:h-24"
            />
          )
          return partner.url ? (
            <Link key={partner.name} href={partner.url} target="_blank" rel="noopener noreferrer">
              {logo}
            </Link>
          ) : (
            <div key={partner.name}>{logo}</div>
          )
        })}
      </div>
    </section>
  )
}
