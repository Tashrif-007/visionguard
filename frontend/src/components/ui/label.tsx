import * as React from 'react'
import { cn } from '@/utils/cn'

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        'text-xs font-semibold uppercase tracking-wide leading-none text-[var(--muted-foreground)]',
        className,
      )}
      {...props}
    />
  )
}
