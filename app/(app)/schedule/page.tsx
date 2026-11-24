'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useStore } from '@/lib/store'
import { sortedLocations, useLookups } from '@/lib/queries'
import type { Night } from '@/lib/types'
import { NIGHT_KIND_LABEL, addDays, cn, fmt12, fmtDate, pad, todayKey, toDateKey } from '@/lib/utils'
import { Empty, LocationChip, PageHeader } from '@/components/ui'
import { NightForm, SeasonForm, blankNight } from '@/components/NightForm'

const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function Schedule() {
  const { db, inScope, scope } = useStore()
  const L = useLookups()
  const today = todayKey()
  const [cursor, setCursor] = useState(() => today.slice(0, 7)) // YYYY-MM
  const [form, setForm] = useState<Night | null>(null)
  const [season, setSeason] = useState(false)

  const [y, m] = cursor.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const gridStart = toDateKey(new Date(y, m - 1, 1 - first.getDay()))
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const lastRowNeeded = cells.slice(35).some((d) => d.startsWith(cursor))
  const visible = lastRowNeeded ? cells : cells.slice(0, 35)

  const nights = useMemo(() => db.nights.filter(inScope), [db.nights, inScope])
  const byDate = useMemo(() => {
    const map = new Map<string, Night[]>()
    for (const n of nights) map.set(n.date, [...(map.get(n.date) ?? []), n])
    return map
  }, [nights])
  const staffed = useMemo(() => {
    const c = new Map<string, number>()
    for (const s of db.shifts) c.set(s.night_id, (c.get(s.night_id) ?? 0) + 1)
    return c
  }, [db.shifts])

  const monthNights = nights.filter((n) => n.date.startsWith(cursor)).sort((a, b) => a.date.localeCompare(b.date) || a.location_id.localeCompare(b.location_id))
  const shiftMonth = (d: number) => {
    const t = new Date(y, m - 1 + d, 1)
    setCursor(`${t.getFullYear()}-${pad(t.getMonth() + 1)}`)
  }
  const defaultLoc = scope === 'all' ? sortedLocations(db)[0]?.id ?? '' : scope

  // Jump straight to months that have nights
  const months = [...new Set(nights.map((n) => n.date.slice(0, 7)))].sort()

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle="Show nights, rehearsals, trainings and build days. Click a night to staff it."
        actions={
          <>
            <button className="btn-secondary" onClick={() => setSeason(true)}>
              <CalendarPlus size={16} /> Add season dates
            </button>
            <button className="btn-primary" onClick={() => setForm(blankNight(defaultLoc, today))}>
              <Plus size={16} /> Add night
            </button>
          </>
        }
      />

      <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-1">
          <button className="btn-ghost p-2" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            <ChevronLeft size={18} />
          </button>
          <h2 className="min-w-[170px] text-center font-display text-xl uppercase tracking-wide">
            {first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <button className="btn-ghost p-2" onClick={() => shiftMonth(1)} aria-label="Next month">
            <ChevronRight size={18} />
          </button>
          <button className="btn-ghost btn-sm" onClick={() => setCursor(today.slice(0, 7))}>
            Today
          </button>
        </div>
        <select className="input w-auto py-1.5 text-xs" value={months.includes(cursor) ? cursor : ''} onChange={(e) => e.target.value && setCursor(e.target.value)}>
          <option value="">Jump to month…</option>
          {months.map((mo) => {
            const [yy, mm] = mo.split('-').map(Number)
            return (
              <option key={mo} value={mo}>
                {new Date(yy, mm - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} ({nights.filter((n) => n.date.startsWith(mo)).length})
              </option>
            )
          })}
        </select>
      </div>

      {/* Calendar grid (tablet & up) */}
      <div className="card hidden overflow-hidden md:block">
        <div className="grid grid-cols-7 border-b border-white/[0.06] bg-white/[0.02]">
          {WEEK.map((d) => (
            <div key={d} className="table-head text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {visible.map((d) => {
            const inMonth = d.startsWith(cursor)
            const list = byDate.get(d) ?? []
            return (
              <div
                key={d}
                className={cn(
                  'group relative min-h-[108px] border-b border-r border-white/[0.04] p-1.5 [&:nth-child(7n)]:border-r-0',
                  !inMonth && 'bg-black/20 opacity-50',
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                      d === today ? 'bg-blood text-white' : 'text-bone-muted',
                    )}
                  >
                    {Number(d.slice(8))}
                  </span>
                  <button
                    className="rounded p-0.5 text-bone-dim opacity-0 transition hover:bg-white/10 hover:text-bone group-hover:opacity-100"
                    onClick={() => setForm(blankNight(defaultLoc, d))}
                    aria-label={`Add night on ${d}`}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  {list.map((n) => {
                    const loc = L.locations.get(n.location_id)
                    const c = staffed.get(n.id) ?? 0
                    return (
                      <Link
                        key={n.id}
                        href={`/schedule/${n.id}`}
                        className={cn(
                          'block rounded-md px-1.5 py-1 text-[11px] leading-tight ring-1 transition hover:brightness-125',
                          n.status === 'cancelled' && 'line-through opacity-50',
                        )}
                        style={{ background: `${loc?.color}18`, boxShadow: `inset 0 0 0 1px ${loc?.color}40`, color: loc?.color }}
                      >
                        <div className="truncate font-semibold">
                          {scope === 'all' ? `${loc?.name} · ` : ''}
                          {n.label || NIGHT_KIND_LABEL[n.kind]}
                        </div>
                        <div className="text-bone-muted">{c ? `${c} staff` : 'Unstaffed'}</div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* List (phones) */}
      <div className="card md:hidden">
        {monthNights.length === 0 ? (
          <Empty icon={<CalendarDays size={28} />} title="No nights this month" />
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {monthNights.map((n) => (
              <li key={n.id}>
                <Link href={`/schedule/${n.id}`} className={cn('flex items-center gap-3 px-4 py-3', n.status === 'cancelled' && 'opacity-50')}>
                  <div className="w-11 text-center">
                    <div className="text-[10px] font-semibold uppercase text-bone-dim">{fmtDate(n.date, { weekday: 'short' })}</div>
                    <div className={cn('font-display text-xl leading-none', n.date === today && 'text-blood')}>{Number(n.date.slice(8))}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{n.label || NIGHT_KIND_LABEL[n.kind]}</div>
                    <div className="text-xs text-bone-muted">
                      Call {fmt12(n.call_time)} · {staffed.get(n.id) ?? 0} staff
                    </div>
                  </div>
                  <LocationChip location={L.locations.get(n.location_id)} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {form && <NightForm initial={form} onClose={() => setForm(null)} />}
      {season && <SeasonForm defaultLocation={scope} onClose={() => setSeason(false)} />}
    </>
  )
}
