'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { Download, MessageSquare, Plus, Search, Users } from 'lucide-react'
import { useStore } from '@/lib/store'
import { attractionsFor, requiredDocs, sortedGroups, sortedLocations, useLookups } from '@/lib/queries'
import { DAYS, STAFF_STATUSES, type Staff, type StaffStatus } from '@/lib/types'
import { STATUS_META, byName, cn, downloadFile, fmtPhone, fullName, toCSV } from '@/lib/utils'
import { Avatar, ColorChip, Empty, LocationChip, PageHeader, StatusBadge } from '@/components/ui'
import StaffForm, { blankStaff } from '@/components/StaffForm'

const VIEWS: { id: string; label: string; statuses: StaffStatus[] }[] = [
  { id: 'active', label: 'Active', statuses: ['active'] },
  { id: 'applicants', label: 'Applicants', statuses: ['applied', 'interview', 'offered'] },
  { id: 'inactive', label: 'Former', statuses: ['inactive', 'declined', 'dnr'] },
  { id: 'all', label: 'Everyone', statuses: [...STAFF_STATUSES] },
]

function Roster() {
  const { db, inScope, scope, update, toast } = useStore()
  const L = useLookups()
  const router = useRouter()
  const params = useSearchParams()
  const [view, setView] = useState('active')
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('')
  const [attraction, setAttraction] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<Staff | null>(null)

  useEffect(() => {
    if (params.get('new') === '1') {
      setAdding(blankStaff(scope === 'all' ? sortedLocations(db)[0]?.id ?? '' : scope))
      router.replace('/staff')
    }
    const v = params.get('view')
    if (v) setView(v)
  }, [params]) // eslint-disable-line react-hooks/exhaustive-deps

  const statuses = VIEWS.find((v) => v.id === view)!.statuses
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return db.staff
      .filter(inScope)
      .filter((s) => statuses.includes(s.status))
      .filter((s) => !group || s.group_id === group)
      .filter((s) => !attraction || (attraction === 'none' ? !s.attraction_id : s.attraction_id === attraction))
      .filter(
        (s) =>
          !term ||
          fullName(s).toLowerCase().includes(term) ||
          s.phone.replace(/\D/g, '').includes(term.replace(/\D/g, '') || '~') ||
          s.email.includes(term) ||
          s.position.toLowerCase().includes(term) ||
          s.tags.some((t) => t.toLowerCase().includes(term)),
      )
      .sort(byName)
  }, [db.staff, inScope, statuses, group, attraction, q])

  const counts = Object.fromEntries(VIEWS.map((v) => [v.id, db.staff.filter((s) => inScope(s) && v.statuses.includes(s.status)).length]))
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const sel = [...selected].filter((id) => rows.some((r) => r.id === id))

  const bulk = (patch: Partial<Staff>, label: string) => {
    update('staff', sel, patch)
    toast(`${label} for ${sel.length} ${sel.length === 1 ? 'person' : 'people'}`)
    setSelected(new Set())
  }

  const exportCSV = () => {
    const list = sel.length ? rows.filter((r) => selected.has(r.id)) : rows
    const csv = toCSV([
      ['First', 'Last', 'Status', 'Location', 'Department', 'Attraction', 'Position', 'Phone', 'Email', 'City', 'Availability', 'Minor', 'Pay rate', 'Seasons', 'Paperwork done', 'Tags'],
      ...list.map((s) => [
        s.first_name,
        s.last_name,
        STATUS_META[s.status].label,
        L.locations.get(s.location_id)?.name,
        s.group_id ? L.groups.get(s.group_id)?.name : '',
        s.attraction_id ? L.attractions.get(s.attraction_id)?.name : '',
        s.position,
        s.phone,
        s.email,
        s.city,
        s.availability.join(' '),
        s.is_minor ? 'Yes' : 'No',
        s.pay_rate ?? '',
        s.seasons,
        s.docs.join(' / '),
        s.tags.join(' / '),
      ]),
    ])
    downloadFile(`fos-staff-${view}.csv`, csv)
  }

  const atts = attractionsFor(db, scope)

  return (
    <>
      <PageHeader
        title="Staff roster"
        subtitle={`${counts.active} active · ${counts.applicants} applicants`}
        actions={
          <>
            <button className="btn-secondary" onClick={exportCSV}>
              <Download size={16} /> Export
            </button>
            <button className="btn-primary" onClick={() => setAdding(blankStaff(scope === 'all' ? sortedLocations(db)[0]?.id ?? '' : scope))}>
              <Plus size={16} /> Add staff
            </button>
          </>
        }
      />

      <div className="card mb-4 flex flex-col gap-3 p-3 sm:p-4">
        <div className="flex flex-wrap justify-center gap-2 md:justify-start">
          {VIEWS.map((v) => (
            <button key={v.id} className="pill-toggle" data-on={view === v.id} onClick={() => setView(v.id)}>
              {v.label} <span className="tabular-nums text-bone-dim">{counts[v.id]}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-bone-dim" />
            <input className="input pl-9" placeholder="Search name, phone, email, tag…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input sm:w-48" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Department">
            <option value="">All departments</option>
            {sortedGroups(db).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select className="input sm:w-52" value={attraction} onChange={(e) => setAttraction(e.target.value)} aria-label="Attraction">
            <option value="">All attractions</option>
            {atts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            <option value="none">Support / floating</option>
          </select>
        </div>
      </div>

      {sel.length > 0 && (
        <div className="animate-in sticky top-14 z-30 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-blood/30 bg-ink-850/95 p-2.5 shadow-glow backdrop-blur lg:top-3">
          <span className="px-1 text-sm font-semibold">{sel.length} selected</span>
          <select className="input w-auto py-1.5 text-xs" value="" onChange={(e) => e.target.value && bulk({ status: e.target.value as StaffStatus }, `Status → ${STATUS_META[e.target.value as StaffStatus].label}`)}>
            <option value="">Set status…</option>
            {STAFF_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
          <select className="input w-auto py-1.5 text-xs" value="" onChange={(e) => e.target.value && bulk({ group_id: e.target.value }, 'Department updated')}>
            <option value="">Set department…</option>
            {sortedGroups(db).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select
            className="input w-auto py-1.5 text-xs"
            value=""
            onChange={(e) => e.target.value && bulk({ attraction_id: e.target.value === 'none' ? null : e.target.value }, 'Attraction updated')}
          >
            <option value="">Set attraction…</option>
            {atts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({L.locations.get(a.location_id)?.name})
              </option>
            ))}
            <option value="none">Support / floating</option>
          </select>
          <Link href={`/messages?ids=${sel.join(',')}`} className="btn-primary btn-sm">
            <MessageSquare size={14} /> Message
          </Link>
          <button className="btn-ghost btn-sm ml-auto" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <Empty icon={<Users size={28} />} title="Nobody here">
            Try a different filter, or add someone to the roster.
          </Empty>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b border-white/[0.06] bg-white/[0.02]">
                <tr>
                  <th className="table-head w-10">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#ff5a1f]"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="table-head">Name</th>
                  <th className="table-head">Status</th>
                  {scope === 'all' && <th className="table-head">Location</th>}
                  <th className="table-head">Department / attraction</th>
                  <th className="table-head hidden xl:table-cell">Phone</th>
                  <th className="table-head">Nights</th>
                  <th className="table-head">Paperwork</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {rows.map((s) => {
                  const g = s.group_id ? L.groups.get(s.group_id) : undefined
                  const a = s.attraction_id ? L.attractions.get(s.attraction_id) : undefined
                  const req = requiredDocs(s)
                  const done = req.filter((d) => s.docs.includes(d)).length
                  return (
                    <tr
                      key={s.id}
                      className={cn('cursor-pointer transition hover:bg-white/[0.025]', selected.has(s.id) && 'bg-blood/[0.05]')}
                      onClick={() => router.push(`/staff/${s.id}`)}
                    >
                      <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className="h-4 w-4 accent-[#ff5a1f]" checked={selected.has(s.id)} onChange={() => toggle(s.id)} aria-label={`Select ${fullName(s)}`} />
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <Avatar name={fullName(s)} color={L.locations.get(s.location_id)?.color} size={34} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-semibold">
                              {fullName(s)}
                              {s.is_minor && <span className="chip bg-sky-500/10 text-sky-300 ring-sky-400/20">Minor</span>}
                            </div>
                            <div className="truncate text-xs text-bone-muted">
                              {s.position}
                              {s.seasons > 1 && ` · ${s.seasons} seasons`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <StatusBadge status={s.status} />
                      </td>
                      {scope === 'all' && (
                        <td className="table-cell">
                          <LocationChip location={L.locations.get(s.location_id)} />
                        </td>
                      )}
                      <td className="table-cell">
                        <div className="flex flex-wrap gap-1">
                          {g && <ColorChip color={g.color}>{g.name}</ColorChip>}
                          {a && <ColorChip color={a.color}>{a.name}</ColorChip>}
                        </div>
                      </td>
                      <td className="table-cell hidden whitespace-nowrap text-bone-muted xl:table-cell">{fmtPhone(s.phone)}</td>
                      <td className="table-cell">
                        <div className="flex gap-0.5">
                          {DAYS.map((d) => (
                            <span
                              key={d}
                              title={d}
                              className={cn(
                                'flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold',
                                s.availability.includes(d) ? 'bg-blood/20 text-blood-soft' : 'bg-white/[0.03] text-bone-dim/50',
                              )}
                            >
                              {d[0]}
                              {d === 'Thu' || d === 'Sun' ? d[1] : ''}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className={cn('text-xs font-semibold tabular-nums', done === req.length ? 'text-emerald-300' : 'text-amber-300')}>
                          {done}/{req.length}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Mobile cards */}
            <ul className="divide-y divide-white/[0.05] md:hidden">
              {rows.map((s) => {
                const g = s.group_id ? L.groups.get(s.group_id) : undefined
                return (
                  <li key={s.id} className={cn('flex items-center gap-3 px-3 py-3', selected.has(s.id) && 'bg-blood/[0.05]')}>
                    <input type="checkbox" className="h-4 w-4 shrink-0 accent-[#ff5a1f]" checked={selected.has(s.id)} onChange={() => toggle(s.id)} aria-label={`Select ${fullName(s)}`} />
                    <Link href={`/staff/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar name={fullName(s)} color={L.locations.get(s.location_id)?.color} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{fullName(s)}</div>
                        <div className="truncate text-xs text-bone-muted">
                          {g?.name ?? s.position}
                          {scope === 'all' && ` · ${L.locations.get(s.location_id)?.name}`}
                        </div>
                      </div>
                      <StatusBadge status={s.status} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      {adding && <StaffForm open initial={adding} onClose={() => setAdding(null)} />}
    </>
  )
}

export default function StaffPage() {
  return (
    <Suspense>
      <Roster />
    </Suspense>
  )
}
