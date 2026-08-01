import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/cn'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide',
  {
    variants: {
      variant: {
        default: 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]',
        outline: 'border-[var(--border)] bg-transparent text-[var(--foreground)]',
        muted: 'border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]',
        destructive: 'border-[var(--destructive)] bg-[var(--destructive)] text-[var(--destructive-foreground)]',
        success: 'border-[var(--success)] bg-transparent text-[var(--success)]',
        warning: 'border-[var(--warning)] bg-transparent text-[var(--warning)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
