import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

type Outgoing = { id: string; phone: string; email: string; subject: string; body: string }

const env = process.env
const smsReady = Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER)
const emailReady = Boolean(env.RESEND_API_KEY && env.MAIL_FROM)
const dbReady = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const toE164 = (p: string) => {
  const d = p.replace(/\D/g, '')
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return null
}

async function sendSMS(to: string, body: string) {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: env.TWILIO_FROM_NUMBER!, Body: body }),
  })
  return res.ok
}

async function sendEmail(to: string, subject: string, body: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to, subject, text: body }),
  })
  return res.ok
}

export async function POST(req: Request) {
  let payload: { channel: 'sms' | 'email' | 'both'; messages: Outgoing[] }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  const { channel, messages } = payload
  if (!Array.isArray(messages) || messages.length > 2000) return NextResponse.json({ error: 'Bad recipient list' }, { status: 400 })

  const wantSMS = channel !== 'email'
  const wantEmail = channel !== 'sms'

  // Real sending only happens for signed-in managers in live mode. Demo mode just logs.
  if (!dbReady || (wantSMS && !smsReady) || (wantEmail && !emailReady)) {
    return NextResponse.json({
      simulated: true,
      sms: wantSMS ? messages.filter((m) => toE164(m.phone)).length : 0,
      email: wantEmail ? messages.filter((m) => m.email.includes('@')).length : 0,
      failed: 0,
    })
  }

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Sign in again to send messages.' }, { status: 401 })
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data.user) return NextResponse.json({ error: 'Sign in again to send messages.' }, { status: 401 })

  let sms = 0,
    email = 0,
    failed = 0
  // Small batches keep us under Twilio/Resend rate limits.
  for (let i = 0; i < messages.length; i += 8) {
    await Promise.all(
      messages.slice(i, i + 8).map(async (m) => {
        const body = String(m.body).slice(0, 1600)
        if (wantSMS) {
          const to = toE164(m.phone)
          if (to) (await sendSMS(to, body).catch(() => false)) ? sms++ : failed++
        }
        if (wantEmail && m.email?.includes('@')) {
          ;(await sendEmail(m.email, String(m.subject).slice(0, 200), body).catch(() => false)) ? email++ : failed++
        }
      }),
    )
  }
  console.log(`Group message by ${data.user.email}: ${sms} sms, ${email} email, ${failed} failed`)
  return NextResponse.json({ simulated: false, sms, email, failed })
}
