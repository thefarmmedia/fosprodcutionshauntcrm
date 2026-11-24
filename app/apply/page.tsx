'use client'

import { useState } from 'react'
import { Skull } from 'lucide-react'
import { useStore } from '@/lib/store'
import { sortedLocations } from '@/lib/queries'
import { DAYS, type Day } from '@/lib/types'
import { nowISO, uid } from '@/lib/utils'
import { Field } from '@/components/ui'

const POSITIONS = ['Scare actor', 'Makeup artist', 'Wardrobe', 'Build crew', 'Admissions / box office', 'Concessions', 'Parking', 'Security']

export default function ApplyPage() {
  const { db, mode, insert, ready } = useStore()
  const locs = sortedLocations(db)
  const [loc, setLoc] = useState('')
  const [days, setDays] = useState<Day[]>([])
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const f = new FormData(e.currentTarget)
    const get = (k: string) => String(f.get(k) ?? '').trim()
    const location = locs.find((l) => l.id === loc)
    if (!location) return setError('Pick which haunt you want to work at.')
    if (!days.length) return setError('Pick at least one night you can work.')
    const payload = {
      first_name: get('first'),
      last_name: get('last'),
      email: get('email'),
      phone: get('phone'),
      city: get('city'),
      age_bracket: get('age'),
      guardian_name: get('guardian'),
      guardian_phone: get('guardianPhone'),
      position_desired: get('position'),
      availability: days.join(', '),
      prior_haunt_experience: get('experience'),
      worked_at_field_of_screams_before: get('returning'),
      background_check_consent: get('bg'),
      legally_eligible_to_work_us: get('eligible'),
      about_you: get('about'),
      applying_for_location: location.name,
      source: 'FoS Productions apply page',
      _hp: get('_hp'),
    }
    setState('sending')
    try {
      if (mode === 'demo') {
        if (payload._hp) return setState('done')
        insert('staff', {
          id: uid(),
          location_id: location.id,
          first_name: payload.first_name,
          last_name: payload.last_name,
          email: payload.email.toLowerCase(),
          phone: payload.phone,
          city: payload.city,
          status: 'applied',
          position: payload.position_desired,
          group_id: null,
          attraction_id: null,
          is_minor: payload.age_bracket === 'Under 18',
          guardian_name: payload.guardian_name,
          guardian_phone: payload.guardian_phone,
          emergency_name: '',
          emergency_phone: '',
          availability: days,
          shirt_size: '',
          pay_rate: null,
          seasons: payload.worked_at_field_of_screams_before === 'Yes' ? 2 : 1,
          docs: [],
          application: {
            'Position desired': payload.position_desired,
            'Age bracket': payload.age_bracket,
            'Background check consent': payload.background_check_consent,
            'Legally eligible to work in US': payload.legally_eligible_to_work_us,
            'Prior haunt experience': payload.prior_haunt_experience,
            'Worked at Field of Screams before': payload.worked_at_field_of_screams_before,
            'About you': payload.about_you,
          },
          source: 'Apply page',
          tags: [],
          hired_at: null,
          created_at: nowISO(),
          updated_at: nowISO(),
        })
      } else {
        const res = await fetch('/api/inbound/application', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-fos-form': 'apply' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not submit')
      }
      setState('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setState('idle')
    }
  }

  const radio = (name: string, opts: string[]) => (
    <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
      {opts.map((o) => (
        <label key={o} className="pill-toggle cursor-pointer has-[:checked]:border-blood/50 has-[:checked]:bg-blood/15 has-[:checked]:text-bone">
          <input type="radio" name={name} value={o} required className="sr-only" />
          {o}
        </label>
      ))}
    </div>
  )

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blood/15 text-blood ring-1 ring-blood/40">
          <Skull size={28} />
        </span>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blood">Now hiring</p>
        <h1 className="mt-2 font-display text-4xl font-semibold uppercase tracking-wide sm:text-5xl">Join the cast &amp; crew</h1>
        <p className="mt-3 max-w-md text-sm text-bone-muted">
          Field of Screams is hiring scare actors, makeup artists, build crew, admissions, concessions, parking and security in Branson and Nixa. No experience needed — we train everyone.
        </p>
      </div>

      {state === 'done' ? (
        <div className="card card-pad animate-in py-12 text-center">
          <h2 className="font-display text-3xl uppercase tracking-wide text-blood">You’re in the queue</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-bone-muted">Thanks for applying! A manager will reach out by text or email about an audition.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="card card-pad grid gap-5">
          <div>
            <span className="label text-center sm:text-left">Which haunt?</span>
            <div className="grid grid-cols-2 gap-2">
              {(ready ? locs : []).map((l) => (
                <button
                  type="button"
                  key={l.id}
                  onClick={() => setLoc(l.id)}
                  className="rounded-xl px-3 py-3 text-sm font-semibold ring-1 transition"
                  style={
                    loc === l.id
                      ? { color: l.color, background: `${l.color}1a`, boxShadow: `inset 0 0 0 1px ${l.color}` }
                      : { boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.1)' }
                  }
                >
                  {l.full_name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name">
              <input className="input" name="first" required maxLength={80} autoComplete="given-name" />
            </Field>
            <Field label="Last name">
              <input className="input" name="last" required maxLength={80} autoComplete="family-name" />
            </Field>
            <Field label="Email">
              <input className="input" name="email" type="email" required maxLength={160} autoComplete="email" />
            </Field>
            <Field label="Mobile phone">
              <input className="input" name="phone" type="tel" required maxLength={40} autoComplete="tel" />
            </Field>
            <Field label="City">
              <input className="input" name="city" required maxLength={80} autoComplete="address-level2" />
            </Field>
            <Field label="Position">
              <select className="input" name="position" required defaultValue="Scare actor">
                {POSITIONS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
          </div>
          <div>
            <span className="label text-center sm:text-left">Nights you can work</span>
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              {DAYS.map((d) => (
                <button type="button" key={d} className="pill-toggle" data-on={days.includes(d)} onClick={() => setDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]))}>
                  {d === 'Thu' ? 'Thursdays' : d === 'Fri' ? 'Fridays' : d === 'Sat' ? 'Saturdays' : 'Sundays'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="label text-center sm:text-left">Age</span>
              {radio('age', ['Over 18', 'Under 18'])}
            </div>
            <div>
              <span className="label text-center sm:text-left">Worked at Field of Screams before?</span>
              {radio('returning', ['Yes', 'No'])}
            </div>
            <div>
              <span className="label text-center sm:text-left">OK with a background check?</span>
              {radio('bg', ['Yes', 'No'])}
            </div>
            <div>
              <span className="label text-center sm:text-left">Legally eligible to work in the US?</span>
              {radio('eligible', ['Yes', 'No'])}
            </div>
            <Field label="Parent / guardian (if under 18)">
              <input className="input" name="guardian" maxLength={120} />
            </Field>
            <Field label="Guardian phone">
              <input className="input" name="guardianPhone" type="tel" maxLength={40} />
            </Field>
          </div>
          <Field label="Any haunt, theater or seasonal experience?">
            <textarea className="input min-h-[80px]" name="experience" maxLength={2000} />
          </Field>
          <Field label="Tell us about yourself">
            <textarea className="input min-h-[110px]" name="about" required maxLength={4000} />
          </Field>
          <input name="_hp" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          {error && (
            <p className="text-center text-sm text-rose-300" role="alert">
              {error}
            </p>
          )}
          <button className="btn-primary py-3 text-base" disabled={state === 'sending'}>
            {state === 'sending' ? 'Sending…' : 'Submit application'}
          </button>
        </form>
      )}
    </main>
  )
}
