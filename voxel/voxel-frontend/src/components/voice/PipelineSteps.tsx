import { CheckCircle } from 'lucide-react'
import type { PipelineStepStatus } from '@/types'

interface PipelineStepsProps {
  steps: PipelineStepStatus[]
}

export function PipelineSteps({ steps }: PipelineStepsProps) {
  return (
    <div className="w-full max-w-xs space-y-2 mx-auto">
      {steps.map((step) => (
        <div
          key={step.id}
          className="flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-300"
          style={{
            background: step.state === 'active'
              ? 'rgba(11,148,136,0.1)'
              : step.state === 'done'
              ? 'rgba(11,148,136,0.05)'
              : 'transparent',
            border: `1px solid ${step.state === 'active' ? 'rgba(11,148,136,0.3)' : 'transparent'}`,
          }}
        >
          {/* Icon */}
          {step.state === 'done' && (
            <CheckCircle size={15} style={{ color: 'var(--teal2)' }} />
          )}
          {step.state === 'active' && (
            <span
              className="w-4 h-4 border-2 rounded-full animate-spin flex-shrink-0"
              style={{ borderColor: 'rgba(11,148,136,0.3)', borderTopColor: '#14b8a6' }}
            />
          )}
          {step.state === 'pending' && (
            <span
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ border: '2px solid var(--border)' }}
            />
          )}
          {step.state === 'error' && (
            <span
              className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-xs"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}
            >
              !
            </span>
          )}

          {/* Label */}
          <span
            className="text-sm font-dm"
            style={{
              color: step.state === 'active'
                ? 'var(--text)'
                : step.state === 'done'
                ? 'var(--teal2)'
                : step.state === 'error'
                ? '#f87171'
                : 'var(--muted)',
            }}
          >
            {step.label}
          </span>
        </div>
      ))}
    </div>
  )
}
