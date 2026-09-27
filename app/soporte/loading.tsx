export default function SoporteLoading() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-2xl border border-white/10 bg-white/[0.02]" />
      ))}
    </div>
  )
}
