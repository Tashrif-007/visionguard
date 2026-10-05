import { useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { ParsedFilters } from '@/types'
import { formatTimestamp } from '@/utils/format'

export function SearchBar({
  value,
  onChange,
  parsedFilters,
  resultLabel,
}: {
  value: string
  onChange: (value: string) => void
  parsedFilters?: ParsedFilters
  resultLabel?: string
}) {
  const [draft, setDraft] = useState(value)

  const chips: { label: string; text: string }[] = []
  if (parsedFilters?.from_ts) chips.push({ label: 'From', text: formatTimestamp(parsedFilters.from_ts) })
  if (parsedFilters?.to_ts) chips.push({ label: 'To', text: formatTimestamp(parsedFilters.to_ts) })
  if (parsedFilters?.event_type) chips.push({ label: 'Type', text: parsedFilters.event_type })

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onChange(draft)
          }}
          onBlur={() => onChange(draft)}
          placeholder='Try "any motion last night" or "events this morning"'
          className="h-10 pl-9"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.length > 0 && <span className="label-mono text-muted-foreground">Interpreted:</span>}
          {chips.map((chip) => (
            <Badge key={chip.label} variant="muted" className="h-6 gap-1.5">
              <span className="text-muted-foreground">{chip.label}</span>
              <span className="text-foreground">{chip.text}</span>
            </Badge>
          ))}
        </div>
        {resultLabel && <span className="label-mono text-primary">{resultLabel}</span>}
      </div>
    </div>
  )
}
