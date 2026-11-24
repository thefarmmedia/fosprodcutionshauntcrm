'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { sortedLocations } from '@/lib/queries'
import { NIGHT_KINDS, type Night } from '@/lib/types'
import { NIGHT_KIND_LABEL, addDays, fmtDate, nowISO, uid, weekdayOf } from '@/lib/utils'
import { Field, Modal } from './ui'

export const blankNight = (location_id: string, date: string): Night => ({
  id: uid(),
  location_id,
  date,
  kind: 'show',
  label: '',
  call_time: '18:00',
  open_time: '19:30',
  close_time: '00:00',
  status: 'scheduled',
  notes: '',
  created_at: nowISO(),
})

export function NightForm({ initial, onClose }: { initial: Night; onClose: () => void }) {
  const { db, insert, update, toast } = useStore()
  const [n, setN] = useState(initial)
  const isNew = !db.nights.some((x) => x.id === initial.id)
  const set = <K extends keyof Night>(k: K, v: Night[K]) => setN((p) => ({ ...p, [k]: v }))

  const save = () => {
    if (!n.date) return toast('Pick a date', 'error')
    if (isNew) insert('nights', n)
    else {
      const { id, created_at, ...patch } = n
      void created_at
      update('nights', id, patch)
    }
    toast(isNew ? 'Night added' : 'Night updated')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Add a night' : 'Edit night'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save}>
            {isNew ? 'Add night' : 'Save'}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Location">
          <select className="input" value={n.location_id} onChange={(e) => set('location_id', e.target.value)}>
            {sortedLocations(db).map((l) => (
              <option key={l.id} value={l.id}>
                {l.full_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input className="input" type="date" value={n.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Type">
          <select className="input" value={n.kind} onChange={(e) => set('kind', e.target.value as Night['kind'])}>
            {NIGHT_KINDS.map((k) => (
              <option key={k} value={k}>
                {NIGHT_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Label (optional)">
          <input className="input" value={n.label} onChange={(e) => set('label', e.target.value)} placeholder="Opening night, Halloween…" />
        </Field>
        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          <Field label="Call time">
            <input className="input" type="time" value={n.call_time} onChange={(e) => set('call_time', e.target.value)} />
          </Field>
          <Field label="Gates open">
            <input className="input" type="time" value={n.open_time} onChange={(e) => set('open_time', e.target.value)} />
          </Field>
          <Field label="Close">
            <input className="input" type="time" value={n.close_time} onChange={(e) => set('close_time', e.target.value)} />
          </Field>
        </div>
        <Field label="Notes" className="sm:col-span-2">
          <textarea className="input min-h-[70px]" value={n.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Weather plan, special instructions…" />
        </Field>
      </div>
    </Modal>
  )
}

export function SeasonForm({ defaultLocation, onClose }: { defaultLocation: string; onClose: () => void }) {
  const { db, insert, toast } = useStore()
  const locs = sortedLocations(db)
  const [locIds, setLocIds] = useState<string[]>(defaultLocation === 'all' ? locs.map((l) => l.id) : [defaultLocation])
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [days, setDays] = useState<string[]>(['Fri', 'Sat'])
  const [tpl, setTpl] = useState(blankNight('', ''))

  const dates: string[] = []
  if (start && end && start <= end) {
    for (let d = start; d <= end && dates.length < 200; d = addDays(d, 1)) if (days.includes(weekdayOf(d))) dates.push(d)
  }
  const existing = new Set(db.nights.map((n) => `${n.location_id}:${n.date}`))
  const toCreate = locIds.flatMap((l) => dates.filter((d) => !existing.has(`${l}:${d}`)).map((d) => ({ l, d })))

  const save = () => {
    if (!toCreate.length) return toast('No new dates to add', 'error')
    insert(
      'nights',
      toCreate.map(({ l, d }) => ({ ...tpl, id: uid(), location_id: l, date: d, created_at: nowISO() })),
    )
    toast(`Added ${toCreate.length} nights`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add season dates"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={!toCreate.length}>
            Add {toCreate.length || ''} nights
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <div>
          <span className="label">Locations</span>
          <div className="flex flex-wrap gap-2">
            {locs.map((l) => (
              <button
                key={l.id}
                className="pill-toggle"
                data-on={locIds.includes(l.id)}
                onClick={() => setLocIds((p) => (p.includes(l.id) ? p.filter((x) => x !== l.id) : [...p, l.id]))}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First night">
            <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Last night">
            <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <div>
          <span className="label">Open on</span>
          <div className="flex flex-wrap gap-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <button key={d} className="pill-toggle" data-on={days.includes(d)} onClick={() => setDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]))}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Call time">
            <input className="input" type="time" value={tpl.call_time} onChange={(e) => setTpl({ ...tpl, call_time: e.target.value })} />
          </Field>
          <Field label="Gates open">
            <input className="input" type="time" value={tpl.open_time} onChange={(e) => setTpl({ ...tpl, open_time: e.target.value })} />
          </Field>
          <Field label="Close">
            <input className="input" type="time" value={tpl.close_time} onChange={(e) => setTpl({ ...tpl, close_time: e.target.value })} />
          </Field>
        </div>
        {dates.length > 0 && (
          <p className="rounded-xl bg-white/[0.03] p-3 text-xs text-bone-muted ring-1 ring-white/[0.06]">
            {dates.length} dates from {fmtDate(dates[0])} to {fmtDate(dates[dates.length - 1])}
            {toCreate.length < dates.length * locIds.length && ` · ${dates.length * locIds.length - toCreate.length} already on the calendar will be skipped`}
          </p>
        )}
      </div>
    </Modal>
  )
}
