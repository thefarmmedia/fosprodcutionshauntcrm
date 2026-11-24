import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

export const dynamic = 'force-dynamic'

// Receives job applications from the Branson / Nixa websites (and the /apply page in live mode).
// Accepts the flat snake_case payload the Nixa site already sends to its webhook, so switching
// is just changing APPLY_WEBHOOK_URL there to: https://<this app>/api/inbound/application?key=...

const env = process.env
const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

const LABELS: Record<string, string> = {
  position_desired: 'Position desired',
  age_bracket: 'Age bracket',
  drivers_license: "Driver's license",
  background_check_consent: 'Background check consent',
  legally_eligible_to_work_us: 'Legally eligible to work in US',
  prior_haunt_experience: 'Prior haunt experience',
  worked_at_field_of_screams_before: 'Worked at Field of Screams before',
  about_you: 'About you',
  city: 'City',
  availability: 'Availability',
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const fromOwnForm = req.headers.get('x-fos-form') === 'apply' && req.headers.get('origin') === url.origin
  if (!fromOwnForm && (!env.INBOUND_APPLICATION_KEY || url.searchParams.get('key') !== env.INBOUND_APPLICATION_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Database not connected yet' }, { status: 503 })
  }

  let b: Record<string, unknown>
  try {
    b = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (str(b._hp)) return NextResponse.json({ ok: true }) // honeypot

  let first = str(b.first_name ?? b.firstName, 80)
  let last = str(b.last_name ?? b.lastName, 80)
  if (!first && !last && str(b.full_name)) {
    const parts = str(b.full_name, 160).split(/\s+/)
    first = parts.shift() ?? ''
    last = parts.join(' ')
  }
  const email = str(b.email, 160).toLowerCase()
  const phone = str(b.phone, 40)
  if (!first || (!email && !phone)) return NextResponse.json({ error: 'Name and email or phone are required' }, { status: 400 })

  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  const locText = str(b.applying_for_location ?? b.location).toLowerCase()
  const { data: locs } = await sb.from('locations').select('id,name').order('sort')
  const loc = locs?.find((l) => locText.includes(String(l.name).toLowerCase())) ?? locs?.[0]
  if (!loc) return NextResponse.json({ error: 'No locations set up' }, { status: 500 })

  const avText = (Array.isArray(b.availability) ? b.availability.join(' ') : str(b.availability)).toLowerCase()
  const availability = ['Thu', 'Fri', 'Sat', 'Sun'].filter((d) => avText.includes(d.toLowerCase()))
  const application: Record<string, string> = {}
  for (const [k, label] of Object.entries(LABELS)) if (str(b[k], 4000)) application[label] = str(b[k], 4000)

  const now = new Date().toISOString()
  const { error } = await sb.from('staff').insert({
    id: randomUUID(),
    location_id: loc.id,
    first_name: first,
    last_name: last,
    email,
    phone,
    city: str(b.city, 80),
    status: 'applied',
    position: str(b.position_desired ?? b.position, 120) || 'Scare actor',
    group_id: null,
    attraction_id: null,
    is_minor: /under/i.test(str(b.age_bracket)),
    guardian_name: str(b.guardian_name, 120),
    guardian_phone: str(b.guardian_phone, 40),
    emergency_name: '',
    emergency_phone: '',
    availability: availability.length ? availability : ['Fri', 'Sat'],
    shirt_size: '',
    pay_rate: null,
    seasons: /yes/i.test(str(b.worked_at_field_of_screams_before)) ? 2 : 1,
    docs: [],
    application,
    source: str(b.source, 120) || 'Website',
    tags: [],
    hired_at: null,
    created_at: now,
    updated_at: now,
  })
  if (error) {
    console.error('Inbound application insert failed:', error.message)
    return NextResponse.json({ error: 'Could not save application' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
