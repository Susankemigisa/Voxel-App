import { HTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'

type BadgeVariant = 'teal' | 'orange' | 'red' | 'purple' | 'muted'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  icon?: ReactNode
}

const styles: Record<BadgeVariant, { background: string; color: string }> = {
  teal:   { background: 'rgba(11,148,136,0.15)',  color: '#14b8a6' },
  orange: { background: 'rgba(249,115,22,0.15)',  color: '#fb923c' },
  red:    { background: 'rgba(239,68,68,0.15)',   color: '#f87171' },
  purple: { background: 'rgba(124,58,237,0.15)',  color: '#a78bfa' },
  muted:  { background: 'rgba(255,255,255,0.05)', color: 'var(--subtle)' },
}

export function Badge({ variant = 'teal', icon, children, className, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-dm font-medium',
        className
      )}
      style={styles[variant]}
      {...props}
    >
      {icon}
      {children}
    </span>
  )
}
