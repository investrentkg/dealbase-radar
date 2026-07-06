import { useState, useEffect, useRef } from 'react'
import * as api from '../lib/api'

interface Props {
  value: string
  onChange: (value: string) => void
  onSelectPlace?: (placeId: string, description: string) => void
}

export function CityAutocomplete({ value, onChange, onSelectPlace }: Props) {
  const [predictions, setPredictions] = useState<api.PlacePrediction[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length < 2) {
      setPredictions([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.autocompleteCity(value)
        setPredictions(res.predictions || [])
        setOpen(true)
      } catch {
        setPredictions([])
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [value])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <input
        required
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => predictions.length > 0 && setOpen(true)}
        placeholder="np. Kołobrzeg"
        autoComplete="off"
        className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue/40"
      />
      {open && predictions.length > 0 && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-line rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {predictions.map(p => (
            <button
              key={p.place_id}
              type="button"
              onClick={() => {
                onChange(p.description)
                onSelectPlace?.(p.place_id, p.description)
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-cream-2 transition-colors"
            >
              {p.description}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
