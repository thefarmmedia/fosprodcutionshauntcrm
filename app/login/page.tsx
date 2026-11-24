'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Skull } from 'lucide-react'
import { getSupabase, supabaseConfigured } from '@/lib/adapters/supabase'
import { useStore } from '@/lib/store'
import { Field } from '@/components/ui'

export default function Login() {
  const router = useRouter()
  const { session } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!supabaseConfigured || session) router.replace('/')
  }, [session, router])

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await getSupabase()!.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setError(error.message)
  }

  const reset = async () => {
    if (!email) return setError('Enter your email first')
    const { error } = await getSupabase()!.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    if (error) setError(error.message)
    else setNotice('Check your email for a reset link.')
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={signIn} className="card card-pad w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blood/15 text-blood ring-1 ring-blood/40">
            <Skull size={24} />
          </span>
          <h1 className="font-display text-2xl uppercase tracking-wide">FoS Productions</h1>
          <p className="text-xs uppercase tracking-[0.2em] text-bone-dim">Manager sign in</p>
        </div>
        <div className="grid gap-4">
          <Field label="Email">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </Field>
          <Field label="Password">
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </Field>
          {error && <p className="text-sm text-rose-300">{error}</p>}
          {notice && <p className="text-sm text-emerald-300">{notice}</p>}
          <button className="btn-primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={reset}>
            Forgot password?
          </button>
        </div>
      </form>
    </main>
  )
}
