'use client'

import { useState } from 'react'

interface ToggleProps {
  defaultChecked?: boolean
  checked?: boolean
  onChange?: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
}

export function Toggle({
  defaultChecked = false,
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: ToggleProps) {
  const [internal, setInternal] = useState(defaultChecked)
  const isOn = checked !== undefined ? checked : internal

  const handleToggle = () => {
    if (disabled) return
    const next = !isOn
    if (checked === undefined) setInternal(next)
    onChange?.(next)
  }

  return (
    <div className="flex items-center justify-between gap-4">
      {(label || description) && (
        <div className="flex-1">
          {label && (
            <p className="text-sm font-dm font-medium text-white">{label}</p>
          )}
          {description && (
            <p className="text-xs font-dm mt-0.5" style={{ color: 'var(--muted)' }}>
              {description}
            </p>
          )}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        onClick={handleToggle}
        disabled={disabled}
        className="relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0 disabled:opacity-40"
        style={{ background: isOn ? '#0b9488' : 'var(--border)' }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300"
          style={{ transform: isOn ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  )
}
