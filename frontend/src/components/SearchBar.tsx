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
}: {
  value: string
  onChange: (value: string) => void
  parsedFilters?: ParsedFilters
}) {
  const [draft, setDraft] = useState(value)

  const chips: string[] = []
  if (parsedFilters?.from_ts) chips.push(`from ${formatTimestamp(parsedFilters.from_ts)}`)
  if (parsedFilters?.to_ts) chips.push(`to ${formatTimestamp(parsedFilters.to_ts)}`)
  if (parsedFilters?.event_type) chips.push(parsedFilters.event_type)

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onChange(draft)
          }}
          onBlur={() => onChange(draft)}
          placeholder='Try "any motion last night" or "events this morning"'
          className="pl-9"
        />
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <Badge key={chip} variant="muted">
              {chip}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
