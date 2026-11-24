import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Booleans only — never echo secret values.
export function GET() {
  const e = process.env
  return NextResponse.json({
    database: Boolean(e.NEXT_PUBLIC_SUPABASE_URL && e.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    sms: Boolean(e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN && e.TWILIO_FROM_NUMBER),
    email: Boolean(e.RESEND_API_KEY && e.MAIL_FROM),
    inbound: Boolean(e.SUPABASE_SERVICE_ROLE_KEY && e.INBOUND_APPLICATION_KEY),
  })
}
