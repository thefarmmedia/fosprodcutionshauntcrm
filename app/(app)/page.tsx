'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { ArrowRight, CalendarDays, ClipboardCheck, Shirt, SquareKanban, Users } from 'lucide-react'
import { useStore } from '@/lib/store'
import { attractionsFor, defaultNight, isApplicant, sortedGroups, sortedLocations, statsFor, useLookups } from '@/lib/queries'
import type { Night } from '@/lib/types'
import { NIGHT_KIND_LABEL, fmt12, fmtDate, fmtHours, fullName, relTime, todayKey } from '@/lib/utils'
import { Avatar, ColorChip, LocationChip, PageHeader, Progress, Stat, StatusBadge } from '@/components/ui'

function NightPanel({ night }: { night: Night }) {
  const { db } = useStore()
  const L = useLookups()
  const loc = L.locations.get(night.location_id)
  const shifts = db.shifts.filter((s) => s.night_id === night.id && s.status !== 'declined')
  const att = db.attendance.filter((a) => a.night_id === night.id)
  const inCount = att.filter((a) => a.status === 'in').length
  const outCount = att.filter((a) => a.status === 'out' || a.status === 'sent_home').length
  const calledIn = att.filter((a) => a.status === 'called_in')
  const isToday = night.date === todayKey()
  const atts = attractionsFor(db, night.location_id)

  return (
    <div className="card card-pad flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            {isToday && <span className="live-dot h-2 w-2 rounded-full bg-blood" />}
            <span className="text-[11px] font-semibold uppercase tracking-wider text-bone-muted">{isToday ? 'Tonight' : night.date > todayKey() ? 'Next up' : 'Last night'}</span>
            <LocationChip location={loc} />
          </div>
          <div className="mt-1 font-display text-xl uppercase tracking-wide">
            {fmtDate(night.date, { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          <div className="text-xs text-bone-muted">
            {night.label || NIGHT_KIND_LABEL[night.kind]} · Call {fmt12(night.call_time)} · Open {fmt12(night.open_time)}
          </div>
        </div>
        <Link href={`/checkin?night=${night.id}`} className="btn-primary btn-sm">
          <ClipboardCheck size={15} /> Check-in
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          ['Scheduled', shifts.length, '#ece9e2'],
          ['Here', inCount, '#34d399'],
          ['Out', outCount, '#7dd3fc'],
          ['Called in', calledIn.length, '#fbbf24'],
        ].map(([l, v, c]) => (
          <div key={l as string} className="rounded-xl bg-white/[0.03] px-1 py-2 ring-1 ring-white/[0.05]">
            <div className="font-display text-2xl tabular-nums" style={{ color: c as string }}>
              {v}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-bone-dim">{l}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {atts.map((a) => {
          const n = shifts.filter((s) => s.attraction_id === a.id).length
          return (
            <div key={a.id}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-semibold" style={{ color: a.color }}>
                  {a.name}
                </span>
                <span className={n < a.target ? 'text-amber-300' : 'text-bone-muted'}>
                  {n} / {a.target} actors
                </span>
              </div>
              <Progress value={n} max={a.target} color={a.color} />
            </div>
          )
        })}
        <div className="flex justify-between text-xs text-bone-muted">
          <span>Support crew (makeup, admissions, parking…)</span>
          <span>{shifts.filter((s) => !s.attraction_id).length}</span>
        </div>
      </div>

      {calledIn.length > 0 && (
        <div className="rounded-xl bg-amber-400/[0.06] p-3 ring-1 ring-amber-400/20">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300">Called in</div>
          <ul className="space-y-1 text-sm">
            {calledIn.map((a) => {
              const s = L.staff.get(a.staff_id)
              return (
                <li key={a.id} className="flex justify-between gap-2">
                  <span>{s ? fullName(s) : 'Unknown'}</span>
                  <span className="truncate text-xs text-bone-muted">{a.note}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { db, inScope, scope } = useStore()
  const L = useLookups()
  const today = todayKey()

  const staff = useMemo(() => db.staff.filter(inScope), [db.staff, inScope])
  const active = staff.filter((s) => s.status === 'active')
  const applicants = staff.filter(isApplicant).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const newThisWeek = applicants.filter((s) => Date.now() - new Date(s.created_at).getTime() < 7 * 86400000).length
  const costumes = db.costumes.filter(inScope)
  const ready = costumes.filter((c) => c.status === 'ready').length
  const repair = costumes.filter((c) => c.status === 'repair').length
  const cleaning = costumes.filter((c) => c.status === 'cleaning').length

  const nights = db.nights.filter(inScope)
  const locs = sortedLocations(db).filter((l) => scope === 'all' || l.id === scope)
  const focusNights = locs.map((l) => defaultNight(nights.filter((n) => n.location_id === l.id))).filter(Boolean) as Night[]
  const upcoming = nights
    .filter((n) => n.date >= today && n.status !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 7)
  const nextNight = upcoming[0]

  // Season at a glance — the most recent season that has attendance
  const pastNightIds = new Set(nights.filter((n) => n.date < today).map((n) => n.id))
  const seasonAtt = db.attendance.filter((a) => pastNightIds.has(a.night_id))
  const season = statsFor(seasonAtt, seasonAtt.length)

  const groups = sortedGroups(db)
    .map((g) => ({ g, n: active.filter((s) => s.group_id === g.id).length }))
    .filter((x) => x.n > 0)
  const maxGroup = Math.max(1, ...groups.map((x) => x.n))

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <>
      <PageHeader
        title={greeting}
        subtitle={`${scope === 'all' ? 'Both locations' : L.locations.get(scope)?.full_name} · ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
        actions={
          <>
            <Link href="/staff?new=1" className="btn-secondary">
              <Users size={16} /> Add staff
            </Link>
            <Link href="/messages" className="btn-primary">
              Message crew
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active cast & crew" value={active.length} icon={<Users size={16} />} hint={`${staff.filter((s) => s.status === 'active' && s.seasons === 1).length} first-season`} />
        <Stat
          label="Applicants"
          value={applicants.length}
          icon={<SquareKanban size={16} />}
          accent={applicants.length ? '#ff7a45' : undefined}
          hint={`${newThisWeek} new this week`}
        />
        <Stat
          label="Next night"
          value={nextNight ? fmtDate(nextNight.date, { month: 'short', day: 'numeric' }) : '—'}
          icon={<CalendarDays size={16} />}
          hint={nextNight ? `${L.locations.get(nextNight.location_id)?.name} · ${db.shifts.filter((s) => s.night_id === nextNight.id).length} scheduled` : 'Nothing scheduled'}
        />
        <Stat label="Costumes ready" value={`${ready}/${costumes.filter((c) => c.status !== 'retired').length}`} icon={<Shirt size={16} />} hint={`${repair} need repair · ${cleaning} cleaning`} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <div className={`grid gap-5 xl:col-span-2 ${focusNights.length > 1 ? 'md:grid-cols-2' : ''}`}>
          {focusNights.map((n) => (
            <NightPanel key={n.id} night={n} />
          ))}
          {!focusNights.length && (
            <div className="card card-pad text-center text-sm text-bone-muted">
              No nights scheduled yet. <Link href="/schedule" className="text-blood hover:underline">Add your season dates →</Link>
            </div>
          )}
        </div>

        <div className="card card-pad">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide">New applicants</h2>
            <Link href="/recruiting" className="text-xs font-semibold text-blood hover:underline">
              Recruiting →
            </Link>
          </div>
          {applicants.length === 0 && <p className="py-6 text-center text-sm text-bone-muted">No open applications.</p>}
          <ul className="divide-y divide-white/[0.05]">
            {applicants.slice(0, 7).map((s) => (
              <li key={s.id}>
                <Link href={`/staff/${s.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-white/[0.03]">
                  <Avatar name={fullName(s)} color={L.locations.get(s.location_id)?.color} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{fullName(s)}</div>
                    <div className="truncate text-xs text-bone-muted">
                      {s.position} · {L.locations.get(s.location_id)?.name} · {relTime(s.created_at)}
                    </div>
                  </div>
                  <StatusBadge status={s.status} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="card card-pad">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide">Upcoming nights</h2>
            <Link href="/schedule" className="text-xs font-semibold text-blood hover:underline">
              Schedule →
            </Link>
          </div>
          {upcoming.length === 0 && <p className="py-6 text-center text-sm text-bone-muted">Nothing on the calendar.</p>}
          <ul className="space-y-1">
            {upcoming.map((n) => {
              const loc = L.locations.get(n.location_id)
              const count = db.shifts.filter((s) => s.night_id === n.id).length
              return (
                <li key={n.id}>
                  <Link href={`/schedule/${n.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.03]">
                    <div className="w-12 shrink-0 text-center">
                      <div className="text-[10px] font-semibold uppercase text-bone-dim">{fmtDate(n.date, { weekday: 'short' })}</div>
                      <div className="font-display text-lg leading-none">{fmtDate(n.date, { day: 'numeric' })}</div>
                      <div className="text-[10px] uppercase text-bone-dim">{fmtDate(n.date, { month: 'short' })}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{n.label || NIGHT_KIND_LABEL[n.kind]}</div>
                      <div className="text-xs text-bone-muted">{count ? `${count} scheduled` : 'Not staffed yet'}</div>
                    </div>
                    <LocationChip location={loc} />
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="card card-pad">
          <h2 className="mb-3 font-display text-lg uppercase tracking-wide">Crew by department</h2>
          <div className="space-y-2.5">
            {groups.map(({ g, n }) => (
              <div key={g.id}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-semibold">{g.name}</span>
                  <span className="tabular-nums text-bone-muted">{n}</span>
                </div>
                <Progress value={n} max={maxGroup} color={g.color} />
              </div>
            ))}
            {!groups.length && <p className="py-6 text-center text-sm text-bone-muted">No active staff yet.</p>}
          </div>
        </div>

        <div className="card card-pad">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide">Season so far</h2>
            <Link href="/timesheets" className="text-xs font-semibold text-blood hover:underline">
              Timesheets →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Shifts worked', season.worked.toLocaleString()],
              ['Hours logged', fmtHours(season.hours).replace(/\.\d+$/, '')],
              ['Show-up rate', season.showRate == null ? '—' : `${Math.round(season.showRate * 100)}%`],
              ['Call-ins', season.calledIn],
              ['No-shows', season.noShow],
              ['Late arrivals', season.late],
            ].map(([l, v]) => (
              <div key={l as string} className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/[0.05]">
                <div className="font-display text-2xl tabular-nums">{v}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-bone-dim">{l}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {locs.map((l) => (
              <ColorChip key={l.id} color={l.color}>
                {l.name}: {active.filter((s) => s.location_id === l.id).length} active
              </ColorChip>
            ))}
          </div>
          <Link href="/checkin" className="btn-secondary mt-4 w-full">
            Open check-in <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </>
  )
}
