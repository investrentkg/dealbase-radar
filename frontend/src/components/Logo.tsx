export function Logo() {
  return (
    <div className="inline-flex items-center gap-2.5">
      <svg width="32" height="32" viewBox="0 0 120 120" className="flex-shrink-0">
        <circle cx="60" cy="60" r="14" fill="none" stroke="#185FA5" strokeWidth="6" />
        <circle cx="60" cy="60" r="30" fill="none" stroke="#378ADD" strokeWidth="5" opacity="0.6" />
        <circle cx="60" cy="60" r="46" fill="none" stroke="#378ADD" strokeWidth="5" opacity="0.3" />
        <circle cx="60" cy="60" r="6" fill="#185FA5" />
      </svg>
      <div className="flex flex-col justify-center whitespace-nowrap">
        <span className="font-serif text-xl text-ink leading-none">DealBase</span>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="w-3 h-0.5 bg-blue" />
          <span className="text-[10px] tracking-widest text-ink-soft font-medium">RADAR</span>
        </div>
      </div>
    </div>
  )
}
