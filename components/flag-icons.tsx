/** Small inline SVG flags — real vector flags instead of emoji, which several
 *  Windows font builds render as plain "ES"/"GB" letter boxes instead of flags. */

export function FlagES({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 3 2" className={className} aria-hidden="true">
      <rect width="3" height="2" fill="#AA151B" />
      <rect y="0.5" width="3" height="1" fill="#F1BF00" />
    </svg>
  )
}

export function FlagGB({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 40" className={className} aria-hidden="true">
      <rect width="60" height="40" fill="#012169" />
      <path d="M0,0 60,40M60,0 0,40" stroke="#fff" strokeWidth="8" />
      <path d="M0,0 60,40M60,0 0,40" stroke="#C8102E" strokeWidth="3.2" />
      <path d="M30,0V40M0,20H60" stroke="#fff" strokeWidth="14" />
      <path d="M30,0V40M0,20H60" stroke="#C8102E" strokeWidth="8" />
    </svg>
  )
}
