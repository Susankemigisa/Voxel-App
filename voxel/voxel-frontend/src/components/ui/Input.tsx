import { InputHTMLAttributes, forwardRef, ReactNode } from 'react'
import { clsx } from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  className,
  id,
  ...props
}, ref) => {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-dm font-medium mb-1.5"
               style={{ color: 'var(--subtle)' }}>
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--muted)' }}>
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx('input-base', leftIcon && 'pl-10', rightIcon && 'pr-10', className)}
          style={{ borderColor: error ? '#ef4444' : undefined }}
          {...props}
        />
        {rightIcon && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--muted)' }}>
            {rightIcon}
          </span>
        )}
      </div>
      {error && (
        <p className="mt-1.5 text-xs font-dm text-red-400">{error}</p>
      )}
      {hint && !error && (
        <p className="mt-1.5 text-xs font-dm" style={{ color: 'var(--muted)' }}>{hint}</p>
      )}
    </div>
  )
})

Input.displayName = 'Input'
