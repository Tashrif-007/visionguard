import { cn } from 'cn'

export function BrandLogo({ className }: { className?: string }) {
  return <img src="/logo.png" alt="VisionGuard AI" className={cn('h-8 w-8 shrink-0 rounded-md', className)} />
}
