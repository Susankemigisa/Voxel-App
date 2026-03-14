'use client'

import { useState } from 'react'
import { LogOut, Languages, Bell, ChevronRight, Shield, HelpCircle, Moon, Sun, Edit2, Check, X, User } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store/authStore'
import { useTheme } from '@/components/shared/ThemeProvider'
import toast from 'react-hot-toast'
import { PageHeader } from '@/components/layout/PageHeader'

function Toggle({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <button onClick={() => setOn(p => !p)}
            className="relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0"
            style={{ background: on ? '#0b9488' : 'var(--border)' }}>
      <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300"
            style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }} />
    </button>
  )
}

export default function ProfilePage() {
  const router          = useRouter()
  const supabase        = createClient()
  const { theme, toggle } = useTheme()
  const user            = useAppStore(s => s.user)
  const updateUser      = useAppStore(s => s.updateUser)
  const logoutStore     = useAppStore(s => s.logout)

  const [loggingOut,  setLoggingOut]  = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput,   setNameInput]   = useState(user?.displayName || '')
  const [savingName,  setSavingName]  = useState(false)

  const joined = user?.joinedAt
    ? new Date(user.joinedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : ''

  const saveDisplayName = async () => {
    if (!nameInput.trim() || !user?.id) return
    setSavingName(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: nameInput.trim() })
        .eq('id', user.id)

      if (error) throw error

      // Update global store immediately — persists across all pages
      updateUser({ displayName: nameInput.trim() })
      toast.success('Name updated!')
      setEditingName(false)
    } catch {
      toast.error('Could not save name')
    } finally {
      setSavingName(false)
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await supabase.auth.signOut()
      logoutStore()
      toast.success('Signed out')
      router.push('/')
    } catch {
      toast.error('Could not sign out')
    } finally {
      setLoggingOut(false)
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-5 pb-28 space-y-5" style={{ animation: 'fadeIn 0.4s ease-out forwards' }}>
      <PageHeader title="My Profile" subtitle="Account and preferences" back="/home" />

      {/* Avatar card */}
      <div className="rounded-3xl p-px" style={{ background: 'linear-gradient(135deg,#0b9488,#14b8a6)' }}>
        <div className="rounded-3xl p-6 flex flex-col items-center" style={{ background: 'var(--card)' }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-3 font-sora font-bold text-2xl text-white"
               style={{ background: 'linear-gradient(135deg,#0b9488,#14b8a6)', boxShadow: '0 0 24px rgba(11,148,136,0.35)' }}>
            {user.initials || <User size={28} />}
          </div>

          {/* Editable display name */}
          {editingName ? (
            <div className="flex items-center gap-2 mb-1">
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                className="rounded-xl px-3 py-1.5 text-sm font-sora font-bold text-center"
                style={{ background: 'var(--surface)', border: '1px solid var(--teal)', color: 'var(--text)', outline: 'none', width: 160 }}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') saveDisplayName(); if (e.key === 'Escape') setEditingName(false) }}
              />
              <button onClick={saveDisplayName} disabled={savingName}
                      className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: '#0b9488' }}>
                {savingName
                  ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                  : <Check size={13} className="text-white" />}
              </button>
              <button onClick={() => setEditingName(false)}
                      className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--border)' }}>
                <X size={13} style={{ color: 'var(--subtle)' }} />
              </button>
            </div>
          ) : (
            <button onClick={() => { setEditingName(true); setNameInput(user.displayName) }}
                    className="flex items-center gap-2 mb-1 group">
              <h2 className="font-sora font-bold text-xl" style={{ color: 'var(--text)' }}>{user.displayName}</h2>
              <Edit2 size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--teal2)' }} />
            </button>
          )}

          <p className="text-xs font-dm mb-1" style={{ color: 'var(--muted)' }}>Tap name to change what Voxel calls you</p>
          <p className="text-sm font-dm" style={{ color: 'var(--muted)' }}>{user.email}</p>
          {joined && <p className="text-xs font-dm mt-0.5" style={{ color: 'var(--muted)' }}>Member since {joined}</p>}
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-dm font-medium mt-3"
                style={{ background: 'rgba(11,148,136,0.15)', color: '#14b8a6' }}>
            {user.plan === 'pro' ? '⚡ Pro Plan' : '✦ Free Plan'}
          </span>
        </div>
      </div>

      {/* Theme */}
      <div className="rounded-3xl p-4 flex items-center justify-between"
           style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(11,148,136,0.1)' }}>
            {theme === 'dark' ? <Moon size={16} style={{ color: '#14b8a6' }} /> : <Sun size={16} style={{ color: '#14b8a6' }} />}
          </div>
          <div>
            <p className="text-sm font-dm font-medium" style={{ color: 'var(--text)' }}>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</p>
            <p className="text-xs font-dm" style={{ color: 'var(--muted)' }}>Switch app appearance</p>
          </div>
        </div>
        <button onClick={toggle} className="relative w-11 h-6 rounded-full transition-all duration-300"
                style={{ background: '#0b9488' }}>
          <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300"
                style={{ left: theme === 'dark' ? '2px' : '22px' }} />
        </button>
      </div>

      {/* Communication toggles */}
      <div>
        <p className="text-xs font-sora font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--subtle)' }}>Communication</p>
        <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {[
            { label: 'Speech Assistance',  sub: 'Real-time voice-to-text',    on: true  },
            { label: 'Text to Speech',     sub: 'Convert typed text to voice', on: false },
            { label: 'Noise Cancellation', sub: 'Remove background noise',     on: true  },
          ].map((item, i, arr) => (
            <div key={item.label} className="flex items-center justify-between px-4 py-4"
                 style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div>
                <p className="text-sm font-dm font-medium" style={{ color: 'var(--text)' }}>{item.label}</p>
                <p className="text-xs font-dm mt-0.5" style={{ color: 'var(--muted)' }}>{item.sub}</p>
              </div>
              <Toggle defaultOn={item.on} />
            </div>
          ))}
        </div>
      </div>

      {/* Account links */}
      <div>
        <p className="text-xs font-sora font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--subtle)' }}>Account</p>
        <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {[
            { icon: Languages,  label: 'Language Preferences', href: '/settings/language'      },
            { icon: Bell,       label: 'Notifications',         href: '/settings/notifications' },
            { icon: Shield,     label: 'Privacy & Security',    href: '/settings/privacy'       },
            { icon: HelpCircle, label: 'Help & Support',        href: '/settings/help'          },
          ].map(({ icon: Icon, label, href }, i, arr) => (
            <Link key={label} href={href}
                  className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-white/5"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: 'rgba(11,148,136,0.1)' }}>
                <Icon size={15} style={{ color: '#14b8a6' }} />
              </div>
              <span className="flex-1 text-sm font-dm font-medium" style={{ color: 'var(--text)' }}>{label}</span>
              <ChevronRight size={16} style={{ color: 'var(--muted)' }} />
            </Link>
          ))}
        </div>
      </div>

      {/* Logout */}
      <button onClick={handleLogout} disabled={loggingOut}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-sora font-semibold text-base transition-all active:scale-95 disabled:opacity-50"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
        {loggingOut
          ? <span className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
          : <LogOut size={18} />}
        {loggingOut ? 'Signing out...' : 'Sign Out'}
      </button>

    </div>
  )
}
