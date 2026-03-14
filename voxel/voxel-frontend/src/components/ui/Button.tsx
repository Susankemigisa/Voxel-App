import { forwardRef, ButtonHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  className,
  ...props
}, ref) => {
  const base = 'inline-flex items-center justify-center gap-2 font-sora font-semibold rounded-2xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none'

  const variants = {
    primary:   'text-white',
    secondary: 'border border-voxel-border text-voxel-text hover:border-voxel-teal hover:text-teal-400',
    ghost:     'text-voxel-subtle hover:text-voxel-text hover:bg-white/5',
    danger:    'text-red-400 border border-red-500/20 hover:bg-red-500/10',
  }

  const sizes = {
    sm: 'text-xs px-3 py-2',
    md: 'text-sm px-5 py-3',
    lg: 'text-base px-6 py-4',
  }

  const primaryStyle = variant === 'primary' ? {
    background: 'linear-gradient(135deg, #0b9488, #14b8a6)',
    boxShadow: '0 4px 20px rgba(11,148,136,0.35)',
  } : {}

  const secondaryStyle = variant === 'secondary' ? {
    background: 'var(--card)',
  } : {}

  const dangerStyle = variant === 'danger' ? {
    background: 'rgba(239,68,68,0.08)',
  } : {}

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      style={{ ...primaryStyle, ...secondaryStyle, ...dangerStyle }}
      {...props}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
})

Button.displayName = 'Button'
