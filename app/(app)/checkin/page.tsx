'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, Clock, DoorOpen, LogIn, LogOut, PhoneOff, Search, Undo2, UserPlus, UserX } from 'lucide-react'
import { useStore } from '@/lib/store'
import { attractionsFor, defaultNight, useLookups } from '@/lib/queries'
import type { Attendance, AttendanceStatus, Night, Staff } from '@/lib/types'
import { ATTENDANCE_META, NIGHT_KIND_LABEL, atTime, byName, cn, fmt12, fmtDate, fmtHours, fmtTime, fullName, hoursBetween, nowISO, todayKey, uid } from '@/lib/utils'
import { Avatar, ColorChip, Empty, Field, LocationChip, Modal, PageHeader } from '@/components/ui'

type Filter = 'pending' | 'in' | 'out' | 'absent' | 'all'

function CheckIn() {
  const { db, inScope, insert, update, remove, toast } = useStore()
  const L = useLookups()
  const params = useSearchParams()
  const nights = useMemo(() => db.nights.filter(inScope).sort((a, b) => b.date.localeCompare(a.date)), [db.nights, inScope])
  const [nightId, setNightId] = useState<string>('')
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [att, setAtt] = useState('')
  const [walkIn, setWalkIn] = useState(false)
  const [editing, setEditing] = useState<{ p: Staff; a?: Attendance } | null>(null)

  useEffect(() => {
    const fromUrl = params.get('night')
    if (fromUrl && db.nights.some((n) => n.id === fromUrl)) setNightId(fromUrl)
    else if (!nightId || !nights.some((n) => n.id === nightId)) setNightId(defaultNight(nights)?.id ?? '')
  }, [params, nights]) // eslint-disable-line react-hooks/exhaustive-deps

  const night = L.nights.get(nightId)

  const roster = useMemo(() => {
    if (!night) return []
    return db.shifts
      .filter((s) => s.night_id === night.id && s.status !== 'declined')
      .map((sh) => ({ sh, p: L.staff.get(sh.staff_id), a: L.attendanceByKey.get(`${night.id}:${sh.staff_id}`) }))
      .filter((x): x is typeof x & { p: Staff } => !!x.p)
  }, [db.shifts, night, L])

  if (!night) {
    return (
      <>
        <PageHeader title="Check-in" />
        <div className="card">
          <Empty icon={<ClipboardCheck size={28} />} title="No nights yet" action={<Link href="/schedule" className="btn-primary">Go to schedule</Link>}>
            Add a show night, rehearsal or build day on the schedule, then check your crew in here.
          </Empty>
        </div>
      </>
    )
  }

  const isToday = night.date === todayKey()
  // When fixing up a past night, default times to the night's call/close instead of "now".
  const inTime = () => (isToday ? nowISO() : atTime(night.date, night.call_time))
  const outTime = () => (isToday ? nowISO() : atTime(night.date, night.close_time))
  const lateCutoff = new Date(atTime(night.date, night.call_time, 5)).getTime()

  const setStatus = (p: Staff, status: AttendanceStatus, existing?: Attendance, note = '') => {
    const now = inTime()
    if (existing) {
      const patch: Partial<Attendance> = { status }
      if (status === 'in') Object.assign(patch, { check_in: existing.check_in ?? now, check_out: null, late: new Date(existing.check_in ?? now).getTime() > lateCutoff })
      if (status === 'out' || status === 'sent_home') patch.check_out = outTime()
      if (status === 'called_in' || status === 'no_show') Object.assign(patch, { check_in: null, check_out: null, late: false })
      if (note) patch.note = note
      update('attendance', existing.id, patch)
    } else {
      insert('attendance', {
        id: uid(),
        night_id: night.id,
        staff_id: p.id,
        location_id: night.location_id,
        status,
        check_in: status === 'in' ? now : null,
        check_out: null,
        late: status === 'in' && new Date(now).getTime() > lateCutoff,
        note,
        created_at: nowISO(),
      })
    }
    const verb: Record<AttendanceStatus, string> = { in: 'checked in', out: 'checked out', called_in: 'called in', no_show: 'marked no-show', sent_home: 'sent home' }
    toast(`${p.first_name} ${verb[status]}`)
  }

  const undo = (a: Attendance) => remove('attendance', a.id)

  const counts = {
    total: roster.length,
    pending: roster.filter((r) => !r.a).length,
    in: roster.filter((r) => r.a?.status === 'in').length,
    out: roster.filter((r) => r.a?.status === 'out' || r.a?.status === 'sent_home').length,
    called: roster.filter((r) => r.a?.status === 'called_in').length,
    noShow: roster.filter((r) => r.a?.status === 'no_show').length,
  }

  const term = q.trim().toLowerCase()
  const visible = roster
    .filter((r) => {
      const st = r.a?.status
      if (filter === 'pending') return !st
      if (filter === 'in') return st === 'in'
      if (filter === 'out') return st === 'out' || st === 'sent_home'
      if (filter === 'absent') return st === 'called_in' || st === 'no_show'
      return true
    })
    .filter((r) => !att || (att === 'support' ? !r.sh.attraction_id : r.sh.attraction_id === att))
    .filter((r) => !term || fullName(r.p).toLowerCase().includes(term))
    .sort((a, b) => byName(a.p, b.p))

  const checkOutAll = () => {
    const ids = roster.filter((r) => r.a?.status === 'in').map((r) => r.a!.id)
    if (!ids.length) return
    if (!window.confirm(`Check out all ${ids.length} people still here?`)) return
    update('attendance', ids, { status: 'out', check_out: outTime() })
    toast(`Checked out ${ids.length}`)
  }
  const markNoShows = () => {
    const pending = roster.filter((r) => !r.a)
    if (!pending.length) return
    if (!window.confirm(`Mark the ${pending.length} people who never showed as no-shows?`)) return
    insert(
      'attendance',
      pending.map((r) => ({
        id: uid(),
        night_id: night.id,
        staff_id: r.p.id,
        location_id: night.location_id,
        status: 'no_show' as const,
        check_in: null,
        check_out: null,
        late: false,
        note: '',
        created_at: nowISO(),
      })),
    )
    toast(`${pending.length} marked no-show`)
  }

  const scheduledIds = new Set(roster.map((r) => r.p.id))
  const walkInPool = db.staff.filter((s) => s.location_id === night.location_id && s.status === 'active' && !scheduledIds.has(s.id)).sort(byName)

  return (
    <>
      <PageHeader
        title="Check-in"
        subtitle={isToday ? 'Tap people in as they arrive. Works great on a phone at the gate.' : 'Viewing a night that isn’t today — times default to the night’s call and close times.'}
        actions={
          <button className="btn-secondary" onClick={() => setWalkIn(true)}>
            <UserPlus size={16} /> Walk-in
          </button>
        }
      />

      <div className="card mb-4 flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center">
        <select className="input lg:max-w-md" value={night.id} onChange={(e) => setNightId(e.target.value)} aria-label="Night">
          {nights.map((n) => (
            <option key={n.id} value={n.id}>
              {fmtDate(n.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} — {L.locations.get(n.location_id)?.name} · {n.label || NIGHT_KIND_LABEL[n.kind]}
              {n.date === todayKey() ? '  (today)' : ''}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-bone-muted lg:justify-start">
          <LocationChip location={L.locations.get(night.location_id)} />
          <span className="inline-flex items-center gap-1">
            <Clock size={13} /> Call {fmt12(night.call_time)}
          </span>
          <span>· Gates {fmt12(night.open_time)}</span>
          <span>· Close {fmt12(night.close_time)}</span>
          {night.status === 'cancelled' && <span className="chip bg-rose-500/15 text-rose-300 ring-rose-400/30">Cancelled</span>}
        </div>
        <Link href={`/schedule/${night.id}`} className="btn-ghost btn-sm lg:ml-auto">
          Edit roster →
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {[
          { k: 'all', label: 'Scheduled', v: counts.total, c: '#ece9e2' },
          { k: 'pending', label: 'Not here', v: counts.pending, c: '#a3a1ab' },
          { k: 'in', label: 'Here', v: counts.in, c: '#34d399' },
          { k: 'out', label: 'Out', v: counts.out, c: '#7dd3fc' },
          { k: 'absent', label: 'Called in', v: counts.called, c: '#fbbf24' },
          { k: 'absent', label: 'No show', v: counts.noShow, c: '#fb7185' },
        ].map((x) => (
          <button
            key={x.label}
            onClick={() => setFilter(x.k as Filter)}
            className={cn('card px-2 py-3 text-center transition hover:ring-1 hover:ring-white/15', filter === x.k && x.k !== 'all' && 'ring-1 ring-blood/50')}
          >
            <div className="font-display text-3xl tabular-nums" style={{ color: x.c }}>
              {x.v}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-bone-dim">{x.label}</div>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex flex-wrap justify-center gap-1.5">
          {(
            [
              ['all', 'All'],
              ['pending', 'Not here yet'],
              ['in', 'Here'],
              ['out', 'Checked out'],
              ['absent', 'Absent'],
            ] as [Filter, string][]
          ).map(([k, l]) => (
            <button key={k} className="pill-toggle" data-on={filter === k} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-bone-dim" />
            <input className="input pl-9" placeholder="Find someone…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input w-auto" value={att} onChange={(e) => setAtt(e.target.value)} aria-label="Attraction">
            <option value="">All areas</option>
            {attractionsFor(db, night.location_id).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            <option value="support">Support crew</option>
          </select>
        </div>
      </div>

      {roster.length === 0 ? (
        <div className="card">
          <Empty title="Nobody scheduled" action={<Link href={`/schedule/${night.id}`} className="btn-primary">Build the roster</Link>}>
            Add people to this night first, or use Walk-in for anyone who just shows up.
          </Empty>
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map(({ sh, p, a }) => {
            const area = sh.attraction_id ? L.attractions.get(sh.attraction_id) : undefined
            const g = p.group_id ? L.groups.get(p.group_id) : undefined
            const meta = ATTENDANCE_META[a?.status ?? 'pending']
            return (
              <div
                key={sh.id}
                className={cn(
                  'card flex flex-col gap-3 p-3 transition',
                  a?.status === 'in' && 'ring-1 ring-emerald-400/30',
                  (a?.status === 'called_in' || a?.status === 'no_show') && 'opacity-70',
                )}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={fullName(p)} color={area?.color ?? g?.color} size={40} />
                  <button className="min-w-0 flex-1 text-left" onClick={() => setEditing({ p, a })}>
                    <div className="truncate font-semibold">{fullName(p)}</div>
                    <div className="flex items-center gap-1.5 truncate text-xs text-bone-muted">
                      {area ? <ColorChip color={area.color}>{area.name}</ColorChip> : <span>{g?.name ?? 'Support'}</span>}
                      {p.is_minor && <span className="chip bg-sky-500/10 text-sky-300 ring-sky-400/20">Minor</span>}
                    </div>
                  </button>
                  <span className={cn('chip', meta.cls)}>{meta.label}</span>
                </div>

                {a && (a.check_in || a.note) && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-bone-muted">
                    {a.check_in && (
                      <span>
                        In <b className="text-bone">{fmtTime(a.check_in)}</b>
                        {a.late && <span className="ml-1 text-amber-300">late</span>}
                      </span>
                    )}
                    {a.check_out && (
                      <span>
                        Out <b className="text-bone">{fmtTime(a.check_out)}</b> · {fmtHours(hoursBetween(a.check_in, a.check_out))} h
                      </span>
                    )}
                    {a.note && <span className="italic">“{a.note}”</span>}
                  </div>
                )}

                <div className="flex gap-1.5">
                  {!a && (
                    <>
                      <button className="btn flex-1 bg-emerald-500 text-ink-950 hover:bg-emerald-400" onClick={() => setStatus(p, 'in')}>
                        <LogIn size={16} /> Check in
                      </button>
                      <button className="btn-secondary px-3" title="Called in" aria-label="Called in" onClick={() => setStatus(p, 'called_in', undefined, window.prompt(`Why did ${p.first_name} call in? (optional)`) ?? '')}>
                        <PhoneOff size={16} />
                      </button>
                      <button className="btn-secondary px-3" title="No show" aria-label="No show" onClick={() => setStatus(p, 'no_show')}>
                        <UserX size={16} />
                      </button>
                    </>
                  )}
                  {a?.status === 'in' && (
                    <>
                      <button className="btn flex-1 bg-sky-500 text-ink-950 hover:bg-sky-400" onClick={() => setStatus(p, 'out', a)}>
                        <LogOut size={16} /> Check out
                      </button>
                      <button className="btn-secondary px-3" title="Sent home" aria-label="Sent home" onClick={() => setStatus(p, 'sent_home', a, window.prompt('Reason sent home? (optional)') ?? '')}>
                        <DoorOpen size={16} />
                      </button>
                      <button className="btn-ghost px-3" title="Undo" aria-label="Undo check-in" onClick={() => undo(a)}>
                        <Undo2 size={16} />
                      </button>
                    </>
                  )}
                  {(a?.status === 'out' || a?.status === 'sent_home') && (
                    <>
                      <button className="btn-secondary flex-1" onClick={() => setStatus(p, 'in', a)}>
                        Back in
                      </button>
                      <button className="btn-ghost px-3" title="Edit times" onClick={() => setEditing({ p, a })}>
                        <Clock size={16} />
                      </button>
                    </>
                  )}
                  {(a?.status === 'called_in' || a?.status === 'no_show') && (
                    <>
                      <button className="btn-secondary flex-1" onClick={() => setStatus(p, 'in', a)}>
                        <LogIn size={16} /> Showed up after all
                      </button>
                      <button className="btn-ghost px-3" title="Undo" aria-label="Undo" onClick={() => undo(a)}>
                        <Undo2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
          {visible.length === 0 && <p className="col-span-full py-10 text-center text-sm text-bone-muted">Nobody matches this filter.</p>}
        </div>
      )}

      {roster.length > 0 && (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row sm:justify-end">
          <button className="btn-secondary" onClick={markNoShows} disabled={!counts.pending}>
            Mark {counts.pending} remaining as no-show
          </button>
          <button className="btn-secondary" onClick={checkOutAll} disabled={!counts.in}>
            <LogOut size={16} /> Check out everyone ({counts.in})
          </button>
        </div>
      )}

      {walkIn && (
        <WalkIn
          night={night}
          pool={walkInPool}
          onClose={() => setWalkIn(false)}
          onPick={(p) => {
            insert('shifts', { id: uid(), night_id: night.id, staff_id: p.id, attraction_id: p.attraction_id, status: 'confirmed', created_at: nowISO() })
            setStatus(p, 'in')
            setWalkIn(false)
          }}
        />
      )}
      {editing && <EditTimes night={night} {...editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function WalkIn({ night, pool, onClose, onPick }: { night: Night; pool: Staff[]; onClose: () => void; onPick: (p: Staff) => void }) {
  const [q, setQ] = useState('')
  const list = pool.filter((p) => !q || fullName(p).toLowerCase().includes(q.toLowerCase()))
  return (
    <Modal open onClose={onClose} title={`Walk-in · ${fmtDate(night.date)}`}>
      <input className="input mb-3" placeholder="Search active staff…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
        {list.map((p) => (
          <li key={p.id}>
            <button onClick={() => onPick(p)} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-white/[0.04]">
              <Avatar name={fullName(p)} size={30} />
              <span className="flex-1 text-sm font-semibold">{fullName(p)}</span>
              <span className="text-xs text-bone-dim">{p.position}</span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="py-6 text-center text-sm text-bone-muted">No one found. Add new people from the Staff page.</li>}
      </ul>
    </Modal>
  )
}

const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function EditTimes({ night, p, a, onClose }: { night: Night; p: Staff; a?: Attendance; onClose: () => void }) {
  const { update, insert, toast } = useStore()
  const [inT, setIn] = useState(toLocalInput(a?.check_in ?? null))
  const [outT, setOut] = useState(toLocalInput(a?.check_out ?? null))
  const [note, setNote] = useState(a?.note ?? '')
  const save = () => {
    const check_in = inT ? atTime(night.date, inT) : null
    const check_out = outT ? atTime(night.date, outT) : null
    const status: AttendanceStatus = check_out ? (a?.status === 'sent_home' ? 'sent_home' : 'out') : check_in ? 'in' : a?.status ?? 'in'
    const late = !!check_in && new Date(check_in).getTime() > new Date(atTime(night.date, night.call_time, 5)).getTime()
    if (a) update('attendance', a.id, { check_in, check_out, note, status, late })
    else if (check_in)
      insert('attendance', { id: uid(), night_id: night.id, staff_id: p.id, location_id: night.location_id, status, check_in, check_out, late, note, created_at: nowISO() })
    toast('Times saved')
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`${fullName(p)} · ${fmtDate(night.date)}`}
      footer={
        <>
          <Link href={`/staff/${p.id}`} className="btn-ghost mr-auto">
            View profile
          </Link>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save}>
            Save
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Checked in">
            <input className="input" type="time" value={inT} onChange={(e) => setIn(e.target.value)} />
          </Field>
          <Field label="Checked out">
            <input className="input" type="time" value={outT} onChange={(e) => setOut(e.target.value)} />
          </Field>
        </div>
        <Field label="Note">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </Field>
        <p className="text-xs text-bone-dim">Times before 6 AM count as after midnight on the same night.</p>
      </div>
    </Modal>
  )
}

export default function CheckInPage() {
  return (
    <Suspense>
      <CheckIn />
    </Suspense>
  )
}
