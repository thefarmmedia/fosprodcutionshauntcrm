'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ArrowLeft, Check, Mail, MessageSquare, Pencil, Phone, Shirt, Trash2 } from 'lucide-react'
import { useStore } from '@/lib/store'
import { requiredDocs, statsFor, useLookups } from '@/lib/queries'
import { STAFF_STATUSES, type Note, type StaffStatus } from '@/lib/types'
import {
  ATTENDANCE_META,
  STATUS_META,
  cn,
  fmtDate,
  fmtHours,
  fmtMoney,
  fmtPhone,
  fmtTime,
  fullName,
  hoursBetween,
  nowISO,
  relTime,
  todayKey,
  uid,
} from '@/lib/utils'
import { Avatar, ColorChip, CostumeBadge, Empty, LocationChip, StatusBadge } from '@/components/ui'
import StaffForm from '@/components/StaffForm'

const NOTE_META: Record<Note['kind'], { label: string; cls: string }> = {
  note: { label: 'Note', cls: 'bg-zinc-500/15 text-zinc-300 ring-zinc-400/25' },
  praise: { label: 'Kudos', cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30' },
  writeup: { label: 'Write-up', cls: 'bg-rose-500/15 text-rose-300 ring-rose-400/30' },
  status: { label: 'Status', cls: 'bg-violet-500/15 text-violet-300 ring-violet-400/30' },
}

export default function StaffProfile() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { db, update, insert, remove, toast, userLabel } = useStore()
  const L = useLookups()
  const s = L.staff.get(id)
  const [editing, setEditing] = useState(false)
  const [noteKind, setNoteKind] = useState<Note['kind']>('note')
  const [noteBody, setNoteBody] = useState('')

  const history = useMemo(() => {
    if (!s) return []
    return db.attendance
      .filter((a) => a.staff_id === s.id)
      .map((a) => ({ a, n: L.nights.get(a.night_id) }))
      .filter((x) => x.n)
      .sort((x, y) => y.n!.date.localeCompare(x.n!.date))
  }, [db.attendance, s, L.nights])

  if (!s) {
    return (
      <Empty title="Not found" action={<Link href="/staff" className="btn-secondary">Back to roster</Link>}>
        This person may have been removed.
      </Empty>
    )
  }

  const loc = L.locations.get(s.location_id)
  const group = s.group_id ? L.groups.get(s.group_id) : undefined
  const attraction = s.attraction_id ? L.attractions.get(s.attraction_id) : undefined
  const today = todayKey()
  const shifts = db.shifts.filter((x) => x.staff_id === s.id)
  const upcoming = shifts
    .map((x) => ({ x, n: L.nights.get(x.night_id) }))
    .filter((v) => v.n && v.n.date >= today)
    .sort((a, b) => a.n!.date.localeCompare(b.n!.date))
  const pastShiftCount = shifts.filter((x) => (L.nights.get(x.night_id)?.date ?? '') < today).length
  const stats = statsFor(history.map((h) => h.a), pastShiftCount)
  const notes = db.notes.filter((n) => n.staff_id === s.id).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const costumes = db.costumes.filter((c) => c.staff_id === s.id)
  const spareCostumes = db.costumes.filter((c) => c.location_id === s.location_id && !c.staff_id && c.status !== 'retired')
  const req = requiredDocs(s)

  const setStatus = (status: StaffStatus) => {
    if (status === s.status) return
    update('staff', s.id, { status, ...(status === 'active' && !s.hired_at ? { hired_at: nowISO() } : {}) })
    insert('notes', { id: uid(), staff_id: s.id, kind: 'status', body: `Status changed from ${STATUS_META[s.status].label} to ${STATUS_META[status].label}`, author: userLabel, created_at: nowISO() })
    toast(`${s.first_name} → ${STATUS_META[status].label}`)
  }

  const toggleDoc = (d: (typeof req)[number]) =>
    update('staff', s.id, { docs: s.docs.includes(d) ? s.docs.filter((x) => x !== d) : [...s.docs, d] })

  const addNote = () => {
    if (!noteBody.trim()) return
    insert('notes', { id: uid(), staff_id: s.id, kind: noteKind, body: noteBody.trim(), author: userLabel, created_at: nowISO() })
    setNoteBody('')
    toast('Note added')
  }

  const del = () => {
    if (!window.confirm(`Permanently delete ${fullName(s)} and their attendance history? This can't be undone. (Tip: set them to Inactive instead to keep their history.)`)) return
    remove('attendance', db.attendance.filter((a) => a.staff_id === s.id).map((a) => a.id))
    remove('shifts', shifts.map((x) => x.id))
    remove('notes', notes.map((n) => n.id))
    if (costumes.length) update('costumes', costumes.map((c) => c.id), { staff_id: null })
    remove('staff', s.id)
    toast(`${fullName(s)} deleted`)
    router.push('/staff')
  }

  const payTotal = s.pay_rate ? stats.hours * s.pay_rate : 0

  return (
    <>
      <Link href="/staff" className="mb-4 inline-flex items-center gap-1.5 text-sm text-bone-muted hover:text-bone">
        <ArrowLeft size={16} /> Roster
      </Link>

      <div className="card card-pad mb-5 flex flex-col items-center gap-4 text-center md:flex-row md:text-left">
        <Avatar name={fullName(s)} color={loc?.color} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{fullName(s)}</h1>
          <p className="text-sm text-bone-muted">
            {s.position}
            {s.city && ` · ${s.city}`}
            {s.seasons > 0 && ` · ${s.seasons === 1 ? 'First season' : `${s.seasons} seasons`}`}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5 md:justify-start">
            <StatusBadge status={s.status} />
            <LocationChip location={loc} />
            {group && <ColorChip color={group.color}>{group.name}</ColorChip>}
            {attraction && <ColorChip color={attraction.color}>{attraction.name}</ColorChip>}
            {s.is_minor && <span className="chip bg-sky-500/10 text-sky-300 ring-sky-400/20">Minor</span>}
            {s.tags.map((t) => (
              <span key={t} className="chip bg-white/5 text-bone-muted ring-white/10">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {s.phone && (
            <>
              <a href={`tel:${s.phone}`} className="btn-secondary btn-sm">
                <Phone size={14} /> Call
              </a>
              <a href={`sms:${s.phone}`} className="btn-secondary btn-sm">
                <MessageSquare size={14} /> Text
              </a>
            </>
          )}
          {s.email && (
            <a href={`mailto:${s.email}`} className="btn-secondary btn-sm">
              <Mail size={14} /> Email
            </a>
          )}
          <button className="btn-primary btn-sm" onClick={() => setEditing(true)}>
            <Pencil size={14} /> Edit
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <div className="flex flex-col gap-5">
          <div className="card card-pad">
            <span className="label">Hiring status</span>
            <div className="flex flex-wrap gap-1.5">
              {STAFF_STATUSES.map((st) => (
                <button key={st} className="pill-toggle" data-on={s.status === st} onClick={() => setStatus(st)}>
                  {STATUS_META[st].label}
                </button>
              ))}
            </div>
          </div>

          <div className="card card-pad">
            <h2 className="mb-3 font-display text-lg uppercase tracking-wide">Details</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {[
                ['Phone', s.phone ? fmtPhone(s.phone) : '—'],
                ['Email', s.email || '—'],
                ['Nights', s.availability.join(', ') || '—'],
                ['Emergency', s.emergency_name ? `${s.emergency_name} · ${fmtPhone(s.emergency_phone)}` : '—'],
                ...(s.is_minor ? [['Guardian', s.guardian_name ? `${s.guardian_name} · ${fmtPhone(s.guardian_phone)}` : 'Missing!']] : []),
                ['Shirt', s.shirt_size || '—'],
                ['Pay rate', s.pay_rate ? `${fmtMoney(s.pay_rate)}/hr` : '—'],
                ['Source', s.source || '—'],
                ['Added', relTime(s.created_at)],
                ...(s.hired_at ? [['Hired', relTime(s.hired_at)]] : []),
              ].map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-bone-dim">{k}</dt>
                  <dd className={cn('min-w-0 break-words', v === 'Missing!' && 'font-semibold text-rose-300')}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="card card-pad">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg uppercase tracking-wide">Paperwork</h2>
              <span className="text-xs text-bone-muted">
                {req.filter((d) => s.docs.includes(d)).length}/{req.length} done
              </span>
            </div>
            <div className="grid gap-1.5">
              {req.map((d) => {
                const on = s.docs.includes(d)
                return (
                  <button
                    key={d}
                    onClick={() => toggleDoc(d)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ring-1 transition',
                      on ? 'bg-emerald-500/[0.07] ring-emerald-400/25' : 'bg-white/[0.02] ring-white/[0.06] hover:ring-white/15',
                    )}
                  >
                    <span className={cn('flex h-5 w-5 items-center justify-center rounded-md', on ? 'bg-emerald-400 text-ink-950' : 'ring-1 ring-white/20')}>
                      {on && <Check size={14} strokeWidth={3} />}
                    </span>
                    {d}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="card card-pad">
            <h2 className="mb-3 font-display text-lg uppercase tracking-wide">Costume</h2>
            {costumes.length === 0 && <p className="mb-3 text-sm text-bone-muted">No costume assigned.</p>}
            <ul className="mb-3 space-y-2">
              {costumes.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-xl bg-white/[0.02] p-2.5 ring-1 ring-white/[0.06]">
                  <Shirt size={18} className="text-bone-dim" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{c.name}</div>
                    <div className="text-xs text-bone-muted">
                      {c.code} · size {c.size}
                    </div>
                  </div>
                  <CostumeBadge status={c.status} />
                  <button className="btn-ghost btn-sm" onClick={() => update('costumes', c.id, { staff_id: null })}>
                    Unassign
                  </button>
                </li>
              ))}
            </ul>
            <select
              className="input"
              value=""
              onChange={(e) => {
                if (!e.target.value) return
                update('costumes', e.target.value, { staff_id: s.id })
                toast('Costume assigned')
              }}
            >
              <option value="">Assign a costume…</option>
              {spareCostumes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name} ({c.size})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {[
              ['Nights', stats.worked],
              ['Hours', fmtHours(stats.hours)],
              ['Show rate', stats.showRate == null ? '—' : `${Math.round(stats.showRate * 100)}%`],
              ['Late', stats.late],
              ['Call-ins', stats.calledIn],
              ['No-shows', stats.noShow],
            ].map(([l, v]) => (
              <div key={l as string} className="card px-2 py-3 text-center">
                <div className="font-display text-xl tabular-nums">{v}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-bone-dim">{l}</div>
              </div>
            ))}
          </div>
          {payTotal > 0 && <p className="-mt-3 text-center text-xs text-bone-muted sm:text-right">Estimated gross pay to date: {fmtMoney(payTotal)}</p>}

          {s.application && (
            <div className="card card-pad">
              <h2 className="mb-3 font-display text-lg uppercase tracking-wide">Application</h2>
              <dl className="space-y-3 text-sm">
                {Object.entries(s.application).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-bone-dim">{k}</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap">{v || '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="card card-pad">
            <h2 className="mb-3 font-display text-lg uppercase tracking-wide">Notes</h2>
            <div className="mb-4 flex flex-col gap-2">
              <textarea
                className="input min-h-[72px]"
                placeholder={`Add a note about ${s.first_name}…`}
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2">
                {(['note', 'praise', 'writeup'] as const).map((k) => (
                  <button key={k} className="pill-toggle" data-on={noteKind === k} onClick={() => setNoteKind(k)}>
                    {NOTE_META[k].label}
                  </button>
                ))}
                <button className="btn-primary btn-sm ml-auto" onClick={addNote} disabled={!noteBody.trim()}>
                  Add note
                </button>
              </div>
            </div>
            {notes.length === 0 && <p className="text-sm text-bone-muted">No notes yet.</p>}
            <ol className="space-y-3">
              {notes.map((n) => (
                <li key={n.id} className="group flex gap-3">
                  <span className={cn('chip h-fit', NOTE_META[n.kind].cls)}>{NOTE_META[n.kind].label}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{n.body}</p>
                    <p className="text-xs text-bone-dim">
                      {n.author} · {relTime(n.created_at)}
                    </p>
                  </div>
                  <button className="btn-ghost p-1 opacity-0 transition group-hover:opacity-100" onClick={() => remove('notes', n.id)} aria-label="Delete note">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ol>
          </div>

          {upcoming.length > 0 && (
            <div className="card card-pad">
              <h2 className="mb-3 font-display text-lg uppercase tracking-wide">Upcoming shifts</h2>
              <ul className="space-y-1">
                {upcoming.map(({ x, n }) => (
                  <li key={x.id}>
                    <Link href={`/schedule/${n!.id}`} className="-mx-2 flex justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.03]">
                      <span>{fmtDate(n!.date)}</span>
                      <span className="text-bone-muted">{x.attraction_id ? L.attractions.get(x.attraction_id)?.name : 'Support'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card overflow-hidden">
            <h2 className="card-pad pb-0 font-display text-lg uppercase tracking-wide">Attendance history</h2>
            {history.length === 0 ? (
              <p className="card-pad text-sm text-bone-muted">No attendance yet.</p>
            ) : (
              <div className="mt-3 max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-ink-900">
                    <tr className="border-b border-white/[0.06]">
                      <th className="table-head">Night</th>
                      <th className="table-head">Status</th>
                      <th className="table-head">In</th>
                      <th className="table-head">Out</th>
                      <th className="table-head text-right">Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {history.map(({ a, n }) => (
                      <tr key={a.id}>
                        <td className="table-cell whitespace-nowrap">{fmtDate(n!.date)}</td>
                        <td className="table-cell">
                          <span className={cn('chip', ATTENDANCE_META[a.status].cls)}>{ATTENDANCE_META[a.status].label}</span>
                          {a.late && <span className="chip ml-1 bg-amber-500/10 text-amber-300 ring-amber-400/20">Late</span>}
                        </td>
                        <td className="table-cell whitespace-nowrap text-bone-muted">{fmtTime(a.check_in)}</td>
                        <td className="table-cell whitespace-nowrap text-bone-muted">{fmtTime(a.check_out)}</td>
                        <td className="table-cell text-right tabular-nums">{fmtHours(hoursBetween(a.check_in, a.check_out))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-center md:justify-end">
            <button className="btn-ghost text-rose-300 hover:bg-rose-500/10 hover:text-rose-200" onClick={del}>
              <Trash2 size={15} /> Delete permanently
            </button>
          </div>
        </div>
      </div>

      {editing && <StaffForm open initial={s} onClose={() => setEditing(false)} />}
    </>
  )
}
