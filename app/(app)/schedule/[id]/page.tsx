'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ArrowLeft, Ban, ClipboardCheck, MessageSquare, Pencil, Search, Trash2, UserPlus, Wand2, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { attractionsFor, useLookups } from '@/lib/queries'
import type { Day, Shift, Staff } from '@/lib/types'
import { ATTENDANCE_META, NIGHT_KIND_LABEL, byName, cn, fmt12, fmtDate, fmtLongDate, fullName, nowISO, uid, weekdayOf } from '@/lib/utils'
import { Avatar, ColorChip, Empty, LocationChip, Modal } from '@/components/ui'
import { NightForm } from '@/components/NightForm'

export default function NightPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { db, insert, update, remove, toast } = useStore()
  const L = useLookups()
  const night = L.nights.get(id)
  const [editing, setEditing] = useState(false)
  const [picker, setPicker] = useState(false)

  const shifts = useMemo(() => db.shifts.filter((s) => s.night_id === id), [db.shifts, id])
  if (!night) {
    return (
      <Empty title="Night not found" action={<Link href="/schedule" className="btn-secondary">Back to schedule</Link>}>
        It may have been deleted.
      </Empty>
    )
  }

  const loc = L.locations.get(night.location_id)
  const atts = attractionsFor(db, night.location_id)
  const weekday = weekdayOf(night.date) as Day
  const scheduledIds = new Set(shifts.map((s) => s.staff_id))
  const available = db.staff
    .filter((s) => s.location_id === night.location_id && s.status === 'active' && !scheduledIds.has(s.id))
    .sort(byName)
  const availableTonight = available.filter((s) => night.kind !== 'show' || s.availability.includes(weekday))

  const addStaff = (people: Staff[], attraction?: string | null) => {
    insert(
      'shifts',
      people.map((p) => ({
        id: uid(),
        night_id: night.id,
        staff_id: p.id,
        attraction_id: attraction === undefined ? p.attraction_id : attraction,
        status: 'scheduled' as const,
        created_at: nowISO(),
      })),
    )
    toast(`Scheduled ${people.length} ${people.length === 1 ? 'person' : 'people'}`)
  }

  const autoFill = () => {
    if (!availableTonight.length) return toast('Everyone available is already scheduled')
    addStaff(availableTonight)
  }

  const priorNights = db.nights
    .filter((n) => n.location_id === night.location_id && n.id !== night.id && db.shifts.some((s) => s.night_id === n.id))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12)

  const copyFrom = (nightId: string) => {
    const src = db.shifts.filter((s) => s.night_id === nightId && !scheduledIds.has(s.staff_id))
    const people = src.map((s) => L.staff.get(s.staff_id)).filter((s): s is Staff => !!s && s.status === 'active')
    if (!people.length) return toast('Nobody new to copy')
    insert(
      'shifts',
      src
        .filter((s) => people.some((p) => p.id === s.staff_id))
        .map((s) => ({ ...s, id: uid(), night_id: night.id, status: 'scheduled' as const, created_at: nowISO() })),
    )
    toast(`Copied ${people.length} from ${fmtDate(L.nights.get(nightId)!.date)}`)
  }

  const columns: { id: string | null; name: string; color: string; target?: number }[] = [
    ...atts.map((a) => ({ id: a.id, name: a.name, color: a.color, target: a.target })),
    { id: null, name: 'Support crew', color: '#94a3b8' },
  ]

  const moveShift = (sh: Shift, attraction_id: string | null) => update('shifts', sh.id, { attraction_id })

  const del = () => {
    if (!window.confirm(`Delete this night and its ${shifts.length} shifts and attendance records? This can't be undone.`)) return
    remove('attendance', db.attendance.filter((a) => a.night_id === night.id).map((a) => a.id))
    remove('shifts', shifts.map((s) => s.id))
    remove('nights', night.id)
    toast('Night deleted')
    router.push('/schedule')
  }

  return (
    <>
      <Link href="/schedule" className="mb-4 inline-flex items-center gap-1.5 text-sm text-bone-muted hover:text-bone">
        <ArrowLeft size={16} /> Schedule
      </Link>

      <div className="card card-pad mb-5 flex flex-col items-center gap-4 text-center lg:flex-row lg:items-center lg:text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            <LocationChip location={loc} />
            <span className="chip bg-white/5 text-bone-muted ring-white/10">{NIGHT_KIND_LABEL[night.kind]}</span>
            {night.status === 'cancelled' && <span className="chip bg-rose-500/15 text-rose-300 ring-rose-400/30">Cancelled</span>}
          </div>
          <h1 className="page-title mt-1.5">{night.label || fmtLongDate(night.date)}</h1>
          <p className="text-sm text-bone-muted">
            {night.label && `${fmtLongDate(night.date)} · `}Call {fmt12(night.call_time)} · Gates {fmt12(night.open_time)} · Close {fmt12(night.close_time)}
          </p>
          {night.notes && <p className="mt-2 text-sm text-amber-200/90">{night.notes}</p>}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href={`/checkin?night=${night.id}`} className="btn-primary btn-sm">
            <ClipboardCheck size={14} /> Check-in
          </Link>
          <Link href={`/messages?night=${night.id}`} className="btn-secondary btn-sm">
            <MessageSquare size={14} /> Message crew
          </Link>
          <button className="btn-secondary btn-sm" onClick={() => setEditing(true)}>
            <Pencil size={14} /> Edit
          </button>
          <button
            className="btn-secondary btn-sm"
            onClick={() => {
              update('nights', night.id, { status: night.status === 'cancelled' ? 'scheduled' : 'cancelled' })
              toast(night.status === 'cancelled' ? 'Night restored' : 'Night cancelled')
            }}
          >
            <Ban size={14} /> {night.status === 'cancelled' ? 'Restore' : 'Cancel night'}
          </button>
          <button className="btn-ghost btn-sm text-rose-300" onClick={del} aria-label="Delete night">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
        <h2 className="font-display text-xl uppercase tracking-wide">
          Roster <span className="text-bone-dim">· {shifts.length}</span>
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn-secondary btn-sm" onClick={autoFill} title={`Adds every active ${loc?.name} staffer who lists ${weekday} as available`}>
            <Wand2 size={14} /> Auto-fill ({availableTonight.length} available)
          </button>
          {priorNights.length > 0 && (
            <select className="input w-auto py-1.5 text-xs" value="" onChange={(e) => e.target.value && copyFrom(e.target.value)}>
              <option value="">Copy roster from…</option>
              {priorNights.map((n) => (
                <option key={n.id} value={n.id}>
                  {fmtDate(n.date)} {n.label && `— ${n.label}`}
                </option>
              ))}
            </select>
          )}
          <button className="btn-primary btn-sm" onClick={() => setPicker(true)}>
            <UserPlus size={14} /> Add people
          </button>
          {shifts.length > 0 && (
            <button
              className="btn-ghost btn-sm"
              onClick={() => window.confirm('Remove everyone from this night?') && remove('shifts', shifts.map((s) => s.id))}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className={cn('grid gap-4', columns.length >= 3 ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2')}>
        {columns.map((col) => {
          const list = shifts
            .filter((s) => s.attraction_id === col.id)
            .map((sh) => ({ sh, p: L.staff.get(sh.staff_id) }))
            .filter((x): x is { sh: Shift; p: Staff } => !!x.p)
            .sort((a, b) => byName(a.p, b.p))
          const short = col.target && list.length < col.target
          return (
            <section key={col.id ?? 'support'} className="card overflow-hidden">
              <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3" style={{ boxShadow: `inset 3px 0 0 ${col.color}` }}>
                <h3 className="font-display text-base uppercase tracking-wide" style={{ color: col.color }}>
                  {col.name}
                </h3>
                <span className={cn('text-xs font-semibold tabular-nums', short ? 'text-amber-300' : 'text-bone-muted')}>
                  {list.length}
                  {col.target ? ` / ${col.target}` : ''}
                </span>
              </header>
              <ul className="divide-y divide-white/[0.04]">
                {list.map(({ sh, p }) => {
                  const att = L.attendanceByKey.get(`${night.id}:${p.id}`)
                  const g = p.group_id ? L.groups.get(p.group_id) : undefined
                  return (
                    <li key={sh.id} className="group flex items-center gap-2.5 px-3 py-2">
                      <Avatar name={fullName(p)} color={g?.color} size={30} />
                      <Link href={`/staff/${p.id}`} className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold hover:text-blood-soft">{fullName(p)}</div>
                        <div className="truncate text-[11px] text-bone-dim">{g?.name ?? p.position}</div>
                      </Link>
                      {att && <span className={cn('chip', ATTENDANCE_META[att.status].cls)}>{ATTENDANCE_META[att.status].label}</span>}
                      <select
                        className="w-[26px] cursor-pointer appearance-none rounded bg-transparent text-center text-xs text-bone-dim opacity-60 hover:bg-white/10 hover:opacity-100"
                        value=""
                        title="Move to…"
                        aria-label={`Move ${fullName(p)}`}
                        onChange={(e) => e.target.value && moveShift(sh, e.target.value === 'support' ? null : e.target.value)}
                      >
                        <option value="">⇄</option>
                        {columns
                          .filter((c) => c.id !== col.id)
                          .map((c) => (
                            <option key={c.id ?? 'support'} value={c.id ?? 'support'}>
                              Move to {c.name}
                            </option>
                          ))}
                      </select>
                      <button className="rounded p-1 text-bone-dim hover:bg-white/10 hover:text-rose-300" onClick={() => remove('shifts', sh.id)} aria-label={`Remove ${fullName(p)}`}>
                        <X size={14} />
                      </button>
                    </li>
                  )
                })}
                {list.length === 0 && <li className="px-4 py-6 text-center text-xs text-bone-dim">Nobody scheduled</li>}
              </ul>
            </section>
          )
        })}
      </div>

      {picker && (
        <StaffPicker
          title={`Add to ${fmtDate(night.date)}`}
          people={available}
          highlight={new Set(availableTonight.map((s) => s.id))}
          highlightLabel={`Available ${weekday}`}
          attractions={columns}
          onClose={() => setPicker(false)}
          onAdd={(people, attraction) => {
            addStaff(people, attraction)
            setPicker(false)
          }}
        />
      )}
      {editing && <NightForm initial={night} onClose={() => setEditing(false)} />}
    </>
  )
}

function StaffPicker({
  title,
  people,
  highlight,
  highlightLabel,
  attractions,
  onClose,
  onAdd,
}: {
  title: string
  people: Staff[]
  highlight: Set<string>
  highlightLabel: string
  attractions: { id: string | null; name: string }[]
  onClose: () => void
  onAdd: (people: Staff[], attraction?: string | null) => void
}) {
  const L = useLookups()
  const [q, setQ] = useState('')
  const [onlyAvail, setOnlyAvail] = useState(true)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [attraction, setAttraction] = useState<string>('default')
  const list = people
    .filter((p) => !onlyAvail || highlight.has(p.id))
    .filter((p) => !q || fullName(p).toLowerCase().includes(q.toLowerCase()))

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={title}
      footer={
        <>
          <select className="input mr-auto w-auto" value={attraction} onChange={(e) => setAttraction(e.target.value)}>
            <option value="default">Their usual attraction</option>
            {attractions.map((a) => (
              <option key={a.id ?? 'support'} value={a.id ?? 'support'}>
                {a.name}
              </option>
            ))}
          </select>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!picked.size}
            onClick={() =>
              onAdd(
                people.filter((p) => picked.has(p.id)),
                attraction === 'default' ? undefined : attraction === 'support' ? null : attraction,
              )
            }
          >
            Add {picked.size || ''}
          </button>
        </>
      }
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-bone-dim" />
          <input className="input pl-9" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        <button className="pill-toggle" data-on={onlyAvail} onClick={() => setOnlyAvail(!onlyAvail)}>
          {highlightLabel} only
        </button>
        <button className="pill-toggle" onClick={() => setPicked(new Set(list.map((p) => p.id)))}>
          Select all ({list.length})
        </button>
      </div>
      {list.length === 0 && <p className="py-8 text-center text-sm text-bone-muted">Nobody left to add.</p>}
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {list.map((p) => {
          const on = picked.has(p.id)
          const g = p.group_id ? L.groups.get(p.group_id) : undefined
          const a = p.attraction_id ? L.attractions.get(p.attraction_id) : undefined
          return (
            <li key={p.id}>
              <button
                onClick={() =>
                  setPicked((prev) => {
                    const n = new Set(prev)
                    if (n.has(p.id)) n.delete(p.id)
                    else n.add(p.id)
                    return n
                  })
                }
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left ring-1 transition',
                  on ? 'bg-blood/10 ring-blood/40' : 'bg-white/[0.02] ring-white/[0.06] hover:ring-white/15',
                )}
              >
                <Avatar name={fullName(p)} color={g?.color} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{fullName(p)}</div>
                  <div className="truncate text-[11px] text-bone-dim">
                    {g?.name ?? p.position} · {p.availability.join(' ')}
                  </div>
                </div>
                {a && <ColorChip color={a.color}>{a.name.split(' ')[0]}</ColorChip>}
              </button>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
