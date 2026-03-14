import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
  glow?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(({
  hoverable = false,
  glow = false,
  padding = 'md',
  className,
  children,
  ...props
}, ref) => {
  const paddings = {
    none: '',
    sm:   'p-3',
    md:   'p-5',
    lg:   'p-7',
  }

  return (
    <div
      ref={ref}
      className={clsx(
        'rounded-3xl transition-all duration-200',
        paddings[padding],
        hoverable && 'cursor-pointer hover:-translate-y-0.5',
        className
      )}
      style={{
        background:  'var(--card)',
        border:      `1px solid ${glow ? 'rgba(11,148,136,0.3)' : 'var(--border)'}`,
        boxShadow:   glow ? '0 0 20px rgba(11,148,136,0.1)' : undefined,
      }}
      {...props}
    >
      {children}
    </div>
  )
})

Card.displayName = 'Card'
