import Image from 'next/image'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { getLocale } from '@/lib/i18n/get-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'

const socials = [
  {
    name: 'Instagram',
    handle: '@rsx_liga',
    href: 'https://www.instagram.com/rsx_liga',
    color: 'text-pink-400 bg-pink-500/10 border-pink-500/20 group-hover:border-pink-500/40',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
      </svg>
    ),
  },
  {
    name: 'TikTok',
    handle: '@rsx_liga',
    href: 'https://www.tiktok.com/@rsx_liga',
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20 group-hover:border-cyan-500/40',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.86-.74-3.94-1.74-.22-.21-.42-.45-.6-.71-.11-.15-.22-.32-.33-.49V14.5c.02 2.13-.6 4.31-2.02 5.92-1.6 1.83-4.07 2.73-6.49 2.45-2.54-.3-4.88-2-5.91-4.39-1.21-2.82-.6-6.31 1.51-8.52 1.67-1.75 4.2-2.43 6.5-1.87V12.3c-1.2-.42-2.61-.1-3.52.82-.94.94-1.12 2.47-.46 3.56.66 1.1 2.06 1.66 3.28 1.34 1-.26 1.72-1.18 1.74-2.22-.01-3.66-.02-7.31-.02-10.97.08-1.53.63-3.09 1.75-4.17.2-.2.43-.37.66-.53z" />
      </svg>
    ),
  },
  {
    name: 'YouTube',
    handle: '@RealSimXperience',
    href: 'https://www.youtube.com/@RSXliga',
    color: 'text-red-500 bg-red-500/10 border-red-500/20 group-hover:border-red-500/40',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    name: 'Twitch',
    handle: 'realsimxperience',
    href: 'https://www.twitch.tv/realsimxperience',
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20 group-hover:border-purple-500/40',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
      </svg>
    ),
  },
  {
    name: 'Discord',
    handle: 'RSX Community',
    href: 'https://discord.com/servers/real-sim-experience-1165762490584530944',
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 group-hover:border-indigo-500/40',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0c-.172-.393-.412-.882-.63-1.25a.074.074 0 0 0-.078-.037 19.736 19.736 0 0 0-4.885 1.515.069.069 0 0 0-.032.027C.533 9.048-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z" />
      </svg>
    ),
  },
]

export async function Footer() {
  const dict = getDictionary(await getLocale())
  return (
    <footer className="relative border-t border-shell-line bg-[#040711] pt-7 pb-5 text-slate-400">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
      <div className="mx-auto max-w-[1400px] px-6 md:px-10 space-y-6">
        <div className="grid gap-6 md:grid-cols-[1.3fr_0.8fr_0.8fr_1.3fr]">
          {/* Marca + descripción + contacto */}
          <div className="space-y-2.5">
            <Image src="/branding/rsx-logo.png" alt="RSX" width={110} height={30} className="h-auto w-[84px]" />
            <p className="max-w-sm text-xs leading-relaxed text-slate-400">
              {dict.footer.description}
            </p>
            <a
              href="mailto:realsimxperience@gmail.com"
              className="inline-flex items-center gap-2 rounded-lg border border-shell-line bg-black/30 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:border-accent/40 hover:bg-accent/10"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-accent/30 bg-accent/10 text-accent">
                <Mail className="h-2.5 w-2.5" />
              </span>
              realsimxperience@gmail.com
            </a>
          </div>

          {/* Plataforma */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">{dict.footer.platform}</h4>
            <ul className="space-y-1.5 text-xs">
              <li><Link href="/" className="transition-colors hover:text-accent">{dict.footer.links.home}</Link></li>
              <li><Link href="/calendario" className="transition-colors hover:text-accent">{dict.footer.links.calendar}</Link></li>
              <li><Link href="/ligas" className="transition-colors hover:text-accent">{dict.footer.links.leagues}</Link></li>
              <li><Link href="/equipos" className="transition-colors hover:text-accent">{dict.footer.links.teams}</Link></li>
              <li><Link href="/perfil" className="transition-colors hover:text-accent">{dict.footer.links.drivers}</Link></li>
              <li><Link href="/about" className="transition-colors hover:text-accent">{dict.footer.links.about}</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">{dict.footer.legal}</h4>
            <ul className="space-y-1.5 text-xs">
              <li><Link href="/privacidad" className="transition-colors hover:text-accent">{dict.footer.legalLinks.privacy}</Link></li>
              <li><Link href="/aviso-legal" className="transition-colors hover:text-accent">{dict.footer.legalLinks.legalNotice}</Link></li>
              <li><Link href="/terminos" className="transition-colors hover:text-accent">{dict.footer.legalLinks.terms}</Link></li>
              <li><Link href="/cookies" className="transition-colors hover:text-accent">{dict.footer.legalLinks.cookies}</Link></li>
            </ul>
          </div>

          {/* Comunidad */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">{dict.footer.community}</h4>
            <div className="grid grid-cols-2 gap-1.5">
              {socials.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2 rounded-lg border border-shell-line bg-black/20 px-2.5 py-1.5 transition-colors hover:bg-black/40"
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${social.color}`}>
                    {social.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold leading-none text-white">{social.name}</div>
                    <div className="mt-0.5 truncate text-[9px] text-slate-500">{social.handle}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Barra inferior */}
        <div className="border-t border-shell-line pt-3 text-center text-xs font-medium text-slate-500">
          {dict.footer.rightsReserved}
        </div>
      </div>
    </footer>
  )
}
