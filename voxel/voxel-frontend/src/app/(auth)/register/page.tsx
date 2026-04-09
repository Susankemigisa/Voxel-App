'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, User, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'

// Singleton — defined outside component to avoid creating a new instance on every render
const supabase = createClient()

export default function RegisterPage() {
  const router   = useRouter()
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email:    form.email,
        password: form.password,
        options:  { data: { full_name: form.name } },
      })
      if (error) throw error
      toast.success('Account created! Check your email to confirm.')
      router.push('/home')
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not create account')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options:  { redirectTo: `${window.location.origin}/home` },
    })
  }

  return (
    <div className="flex-1 flex flex-col justify-center px-6 py-4">
      <div style={{ animation: 'slideUp 0.4s ease-out forwards' }}>
        <h1 className="font-sora font-bold text-2xl text-white mb-1">Create an Account</h1>
        <p className="text-sm font-dm mb-8" style={{ color: 'var(--subtle)' }}>
          Join Voxel and find your voice
        </p>
      </div>

      {/* Tabs */}
      <div className="flex mb-6 p-1 rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <button className="flex-1 text-center py-2.5 rounded-xl text-sm font-sora font-semibold"
                style={{ background: 'linear-gradient(135deg,#0b9488,#14b8a6)', color: '#fff' }}>
          Sign Up
        </button>
        <Link href="/login"
              className="flex-1 text-center py-2.5 rounded-xl text-sm font-sora font-medium transition-all"
              style={{ color: 'var(--subtle)' }}>
          Sign In
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" style={{ animation: 'fadeIn 0.5s ease-out 0.1s both' }}>
        <div>
          <label className="label">Full Name</label>
          <div className="relative">
            <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
            <input
              type="text"
              placeholder="Jane Doe"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="input-base pl-10"
              required
            />
          </div>
        </div>

        <div>
          <label className="label">Email Address</label>
          <div className="relative">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
            <input
              type="email"
              placeholder="name@example.com"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="input-base pl-10"
              required
            />
          </div>
        </div>

        <div>
          <label className="label">Password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              className="input-base pl-10 pr-12"
              required
              minLength={6}
            />
            <button type="button" onClick={() => setShowPass(p => !p)}
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--muted)' }}>
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-xs font-dm mt-1.5" style={{ color: 'var(--muted)' }}>
            Contains at least 6 characters
          </p>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-base mt-2">
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating account...
            </span>
          ) : (
            <>Create Free Account <ArrowRight size={18} /></>
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        <span className="text-xs font-dm" style={{ color: 'var(--muted)' }}>OR CONTINUE WITH</span>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      </div>

      <button onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl text-sm font-dm font-medium transition-all"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--subtle)' }}>
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
          <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
        </svg>
        Continue with Google
      </button>

      <p className="text-xs font-dm text-center mt-5" style={{ color: 'var(--muted)' }}>
        By continuing, you agree to Voxel's{' '}
        <Link href="/terms" style={{ color: 'var(--teal2)' }}>Terms of Service</Link>
        {' '}&amp;{' '}
        <Link href="/privacy" style={{ color: 'var(--teal2)' }}>Privacy Policy</Link>
      </p>

      <p className="text-sm font-dm text-center mt-3" style={{ color: 'var(--muted)' }}>
        Already have an account?{' '}
        <Link href="/login" className="font-medium" style={{ color: 'var(--teal2)' }}>Sign in</Link>
      </p>
    </div>
  )
}