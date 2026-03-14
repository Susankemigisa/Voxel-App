import { MessageCircle, Book, Mail, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'

const FAQS = [
  { q: 'How do I improve recognition accuracy?', a: 'Speak clearly, reduce background noise, and enable noise cancellation in Audio settings.' },
  { q: 'Does Voxel work offline?',               a: 'Basic speech synthesis works offline. ASR and AI cleanup require an internet connection.' },
  { q: 'How do I add Luganda support?',          a: 'Go to Settings → Language Hub and toggle Luganda as your active language.' },
  { q: 'Is my voice data stored?',               a: 'Only if you enable transcription history in Privacy settings. You can delete it anytime.' },
]

export default function HelpPage() {
  return (
    <div className="px-5 pb-28 space-y-5" style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>
      <PageHeader title="Help & Support" subtitle="Guides and contact" back="/settings" />
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Book,          label: 'User Guide', sub: 'Documentation'    },
          { icon: MessageCircle, label: 'Live Chat',  sub: 'Talk to support'  },
          { icon: Mail,          label: 'Email',      sub: 'support@voxel.app'},
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="card flex flex-col items-center gap-2 py-5 cursor-pointer">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(11,148,136,0.12)' }}>
              <Icon size={18} style={{ color: '#14b8a6' }} />
            </div>
            <p className="font-dm font-semibold text-sm text-white">{label}</p>
            <p className="font-dm text-xs text-center" style={{ color: 'var(--muted)' }}>{sub}</p>
          </div>
        ))}
      </div>
      <div>
        <p className="text-xs font-sora font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--subtle)' }}>FAQs</p>
        <div className="card p-0 overflow-hidden">
          {FAQS.map((faq, i) => (
            <details key={i} style={{ borderBottom: i < FAQS.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <summary className="flex items-center justify-between px-4 py-4 cursor-pointer list-none">
                <span className="text-sm font-dm font-medium text-white pr-4">{faq.q}</span>
                <ChevronRight size={14} className="flex-shrink-0" style={{ color: 'var(--muted)' }} />
              </summary>
              <p className="px-4 pb-4 text-sm font-dm" style={{ color: 'var(--muted)' }}>{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  )
}
