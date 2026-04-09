'use client'

import { useEffect, useState } from 'react'
import { Settings, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store/authStore'
import toast from 'react-hot-toast'

// Singleton — defined outside component to avoid creating a new instance on every render
const supabase = createClient()

interface Contact {
  id:       string
  name:     string
  phone:    string
  relation: string
}

const RELATIONS = ['Doctor', 'Family', 'Friend', 'Caregiver', 'Colleague', 'Other']

export default function SafetyPage() {
  const user     = useAppStore(s => s.user)

  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading,  setLoading]  = useState(true)
  const [adding,   setAdding]   = useState(false)
  const [saving,   setSaving]   = useState(false)

  const [name,     setName]     = useState('')
  const [phone,    setPhone]    = useState('')
  const [relation, setRelation] = useState('Family')

  useEffect(() => {
    if (!user?.id) return
    loadContacts()
  }, [user?.id])

  const loadContacts = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: true })

    if (!error && data) setContacts(data)
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!name.trim() || !phone.trim()) {
      toast.error('Name and phone are required')
      return
    }
    setSaving(true)
    const { data, error } = await supabase
      .from('emergency_contacts')
      .insert({ user_id: user!.id, name: name.trim(), phone: phone.trim(), relation })
      .select()
      .single()

    if (error) {
      toast.error('Could not save contact')
    } else {
      setContacts(p => [...p, data])
      setName(''); setPhone(''); setRelation('Family')
      setAdding(false)
      toast.success('Contact added')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('emergency_contacts')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error('Could not delete contact')
    } else {
      setContacts(p => p.filter(c => c.id !== id))
      toast.success('Contact removed')
    }
  }

  return (
    <div className="px-5 pb-28 space-y-5" style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>
      <div>
        <h2 className="font-sora font-bold text-xl" style={{ color: 'var(--text)' }}>Safety & SOS</h2>
        <p className="text-sm font-dm mt-0.5" style={{ color: 'var(--subtle)' }}>
          Manage your emergency contacts
        </p>
      </div>

      {/* SOS info banner */}
      <div className="rounded-2xl p-4 flex items-center gap-3"
           style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <Settings size={20} style={{ color: '#f87171' }} />
        <div>
          <p className="text-sm font-dm font-semibold" style={{ color: 'var(--text)' }}>SOS Alerts</p>
          <p className="text-xs font-dm mt-0.5" style={{ color: 'var(--muted)' }}>
            In an emergency, your contacts below will be notified
          </p>
        </div>
      </div>

      {/* Contacts list */}
      <div>
        <p className="text-xs font-sora font-semibold uppercase tracking-widest mb-3"
           style={{ color: 'var(--subtle)' }}>Emergency Contacts</p>

        {loading ? (
          <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            {[1, 2].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 py-4 animate-pulse"
                   style={{ borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                <div className="w-9 h-9 rounded-full" style={{ background: 'var(--border)' }} />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 rounded-full w-1/2" style={{ background: 'var(--border)' }} />
                  <div className="h-2.5 rounded-full w-1/3" style={{ background: 'var(--border)' }} />
                </div>
              </div>
            ))}
          </div>
        ) : contacts.length === 0 && !adding ? (
          <div className="rounded-3xl p-6 flex flex-col items-center gap-3 text-center"
               style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                 style={{ background: 'rgba(239,68,68,0.08)' }}>
              <Settings size={20} style={{ color: '#f87171' }} />
            </div>
            <div>
              <p className="font-sora font-semibold text-sm" style={{ color: 'var(--text)' }}>No contacts yet</p>
              <p className="font-dm text-xs mt-1" style={{ color: 'var(--muted)' }}>
                Add someone who should be alerted in an emergency
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            {contacts.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-4"
                   style={{ borderBottom: i < contacts.length - 1 || adding ? '1px solid var(--border)' : 'none' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-sora font-bold text-sm text-white flex-shrink-0"
                     style={{ background: 'linear-gradient(135deg,#0b9488,#14b8a6)' }}>
                  {c.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-dm font-medium" style={{ color: 'var(--text)' }}>{c.name}</p>
                  <p className="text-xs font-dm" style={{ color: 'var(--muted)' }}>
                    {c.phone} · {c.relation}
                  </p>
                </div>
                <button onClick={() => handleDelete(c.id)}
                        className="p-2 rounded-xl hover:bg-red-500/10 transition-colors flex-shrink-0"
                        style={{ color: 'var(--muted)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {adding && (
              <div className="px-4 py-4 space-y-3">
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-xl px-3 py-2.5 text-sm font-dm"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                />
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="Phone number e.g. +256 700 000 000"
                  type="tel"
                  className="w-full rounded-xl px-3 py-2.5 text-sm font-dm"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
                />
                <select
                  value={relation}
                  onChange={e => setRelation(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm font-dm"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}>
                  {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <div className="flex gap-2">
                  <button onClick={handleAdd} disabled={saving}
                          className="flex-1 py-2.5 rounded-xl text-sm font-sora font-semibold text-white transition-all"
                          style={{ background: 'linear-gradient(135deg,#0b9488,#14b8a6)' }}>
                    {saving ? 'Saving...' : 'Save Contact'}
                  </button>
                  <button onClick={() => { setAdding(false); setName(''); setPhone('') }}
                          className="px-4 py-2.5 rounded-xl text-sm font-dm transition-all"
                          style={{ background: 'var(--border)', color: 'var(--subtle)' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!adding && (
          <button onClick={() => setAdding(true)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl mt-3 font-dm text-sm font-medium transition-all active:scale-95"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--teal2)' }}>
            <span>+</span> Add Emergency Contact
          </button>
        )}
      </div>
    </div>
  )
}