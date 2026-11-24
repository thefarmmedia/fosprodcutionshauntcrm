'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { attractionsFor, sortedGroups, sortedLocations } from '@/lib/queries'
import { DAYS, STAFF_STATUSES, type Day, type Staff } from '@/lib/types'
import { STATUS_META, nowISO, uid } from '@/lib/utils'
import { Field, Modal } from './ui'

export const blankStaff = (location_id: string): Staff => ({
  id: uid(),
  location_id,
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  city: '',
  status: 'active',
  position: 'Scare actor',
  group_id: 'grp-actors',
  attraction_id: null,
  is_minor: false,
  guardian_name: '',
  guardian_phone: '',
  emergency_name: '',
  emergency_phone: '',
  availability: ['Fri', 'Sat'],
  shirt_size: '',
  pay_rate: null,
  seasons: 1,
  docs: [],
  application: null,
  source: 'Added by manager',
  tags: [],
  hired_at: null,
  created_at: nowISO(),
  updated_at: nowISO(),
})

export default function StaffForm({ open, onClose, initial }: { open: boolean; onClose: () => void; initial: Staff }) {
  const { db, insert, update, toast } = useStore()
  const [s, setS] = useState<Staff>(initial)
  const [tags, setTags] = useState(initial.tags.join(', '))
  const isNew = !db.staff.some((x) => x.id === initial.id)
  const set = <K extends keyof Staff>(k: K, v: Staff[K]) => setS((p) => ({ ...p, [k]: v }))
  const atts = attractionsFor(db, s.location_id)

  const save = () => {
    if (!s.first_name.trim() || !s.last_name.trim()) return toast('First and last name are required', 'error')
    const row: Staff = {
      ...s,
      first_name: s.first_name.trim(),
      last_name: s.last_name.trim(),
      email: s.email.trim().toLowerCase(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      hired_at: s.status === 'active' && !s.hired_at ? nowISO() : s.hired_at,
    }
    if (isNew) insert('staff', row)
    else {
      const { id, created_at, ...patch } = row
      void created_at
      update('staff', id, patch)
    }
    toast(isNew ? `${row.first_name} added` : 'Saved')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? 'Add staff member' : 'Edit details'}
      wide
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save}>
            {isNew ? 'Add to roster' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name">
          <input className="input" value={s.first_name} onChange={(e) => set('first_name', e.target.value)} autoFocus />
        </Field>
        <Field label="Last name">
          <input className="input" value={s.last_name} onChange={(e) => set('last_name', e.target.value)} />
        </Field>
        <Field label="Mobile phone">
          <input className="input" type="tel" value={s.phone} onChange={(e) => set('phone', e.target.value)} placeholder="417-555-0123" />
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={s.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Location">
          <select
            className="input"
            value={s.location_id}
            onChange={(e) => setS((p) => ({ ...p, location_id: e.target.value, attraction_id: null }))}
          >
            {sortedLocations(db).map((l) => (
              <option key={l.id} value={l.id}>
                {l.full_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select className="input" value={s.status} onChange={(e) => set('status', e.target.value as Staff['status'])}>
            {STAFF_STATUSES.map((st) => (
              <option key={st} value={st}>
                {STATUS_META[st].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Department">
          <select className="input" value={s.group_id ?? ''} onChange={(e) => set('group_id', e.target.value || null)}>
            <option value="">— None —</option>
            {sortedGroups(db).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Attraction">
          <select className="input" value={s.attraction_id ?? ''} onChange={(e) => set('attraction_id', e.target.value || null)}>
            <option value="">— Support / floating —</option>
            {atts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Position / role">
          <input className="input" value={s.position} onChange={(e) => set('position', e.target.value)} placeholder="Scare actor, makeup, parking…" />
        </Field>
        <Field label="City">
          <input className="input" value={s.city} onChange={(e) => set('city', e.target.value)} />
        </Field>

        <div className="sm:col-span-2">
          <span className="label">Nights available</span>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => {
              const on = s.availability.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  data-on={on}
                  className="pill-toggle"
                  onClick={() => set('availability', (on ? s.availability.filter((x) => x !== d) : [...s.availability, d]) as Day[])}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </div>

        <Field label="Pay rate ($/hr)">
          <input
            className="input"
            type="number"
            step="0.25"
            min="0"
            value={s.pay_rate ?? ''}
            onChange={(e) => set('pay_rate', e.target.value === '' ? null : Number(e.target.value))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Shirt size">
            <select className="input" value={s.shirt_size} onChange={(e) => set('shirt_size', e.target.value)}>
              {['', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'].map((z) => (
                <option key={z} value={z}>
                  {z || '—'}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Seasons at FoS">
            <input className="input" type="number" min="1" value={s.seasons} onChange={(e) => set('seasons', Math.max(1, Number(e.target.value) || 1))} />
          </Field>
        </div>

        <Field label="Emergency contact">
          <input className="input" value={s.emergency_name} onChange={(e) => set('emergency_name', e.target.value)} placeholder="Name" />
        </Field>
        <Field label="Emergency phone">
          <input className="input" type="tel" value={s.emergency_phone} onChange={(e) => set('emergency_phone', e.target.value)} />
        </Field>

        <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
          <input type="checkbox" className="h-4 w-4 accent-[#ff5a1f]" checked={s.is_minor} onChange={(e) => set('is_minor', e.target.checked)} />
          Under 18 (needs parent / guardian consent)
        </label>
        {s.is_minor && (
          <>
            <Field label="Parent / guardian">
              <input className="input" value={s.guardian_name} onChange={(e) => set('guardian_name', e.target.value)} />
            </Field>
            <Field label="Guardian phone">
              <input className="input" type="tel" value={s.guardian_phone} onChange={(e) => set('guardian_phone', e.target.value)} />
            </Field>
          </>
        )}

        <Field label="Tags" hint="Comma separated — e.g. Stilts, Slider, Veteran, CPR" className="sm:col-span-2">
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
