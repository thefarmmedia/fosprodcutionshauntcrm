'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import { useStore } from '@/lib/store'
import { sortedGroups, statsFor, useLookups } from '@/lib/queries'
import type { Attendance, Staff } from '@/lib/types'
import { addDays, byName, cn, downloadFile, fmtDate, fmtHours, fmtMoney, fmtTime, fullName, hoursBetween, toCSV, todayKey } from '@/lib/utils'
import { Empty, LocationChip, PageHeader, Stat } from '@/components/ui'

type SortKey = 'name' | 'hours' | 'nights' | 'rate'

export default function Timesheets() {
  const { db, inScope, scope } = useStore()
  const L = useLookups()
  const today = todayKey()
  const datedNights = db.nights.filter(inScope)
  const firstNight = datedNights.reduce((m, n) => (n.date < m ? n.date : m), today)

  // Haunt season runs roughly Aug–Nov; before August, "this season" means last year's.
  const seasonYear = Number(today.slice(5, 7)) >= 8 ? Number(today.slice(0, 4)) : Number(today.slice(0, 4)) - 1
  const presets: [string, string, string][] = [
    ['This week', addDays(today, -6), today],
    ['Last 2 weeks', addDays(today, -13), today],
    ['Last 30 days', addDays(today, -29), today],
    [`${seasonYear} season`, `${seasonYear}-08-01`, `${seasonYear}-11-30` < today ? `${seasonYear}-11-30` : today],
    ['All time', firstNight, today],
  ]

  const [from, setFrom] = useState(presets[3][1])
  const [to, setTo] = useState(presets[3][2])
  const [group, setGroup] = useState('')
  const [sort, setSort] = useState<SortKey>('name')

  const nightIds = useMemo(() => new Set(datedNights.filter((n) => n.date >= from && n.date <= to).map((n) => n.id)), [datedNights, from, to])

  const rows = useMemo(() => {
    const byStaff = new Map<string, Attendance[]>()
    for (const a of db.attendance) {
      if (!nightIds.has(a.night_id)) continue
      byStaff.set(a.staff_id, [...(byStaff.get(a.staff_id) ?? []), a])
    }
    const scheduled = new Map<string, number>()
    for (const s of db.shifts) if (nightIds.has(s.night_id)) scheduled.set(s.staff_id, (scheduled.get(s.staff_id) ?? 0) + 1)
    return [...byStaff.entries()]
      .map(([id, list]) => ({ s: L.staff.get(id), list, st: statsFor(list, scheduled.get(id) ?? 0) }))
      .filter((r): r is { s: Staff; list: Attendance[]; st: ReturnType<typeof statsFor> } => !!r.s)
      .filter((r) => !group || r.s.group_id === group)
      .sort((a, b) =>
        sort === 'hours' ? b.st.hours - a.st.hours : sort === 'nights' ? b.st.worked - a.st.worked : sort === 'rate' ? (a.st.showRate ?? 1) - (b.st.showRate ?? 1) : byName(a.s, b.s),
      )
  }, [db.attendance, db.shifts, nightIds, L.staff, group, sort])

  const totals = rows.reduce(
    (t, r) => ({ hours: t.hours + r.st.hours, pay: t.pay + r.st.hours * (r.s.pay_rate ?? 0), worked: t.worked + r.st.worked, called: t.called + r.st.calledIn, noShow: t.noShow + r.st.noShow }),
    { hours: 0, pay: 0, worked: 0, called: 0, noShow: 0 },
  )
  const openIns = rows.flatMap((r) => r.list.filter((a) => a.status === 'in').map((a) => ({ a, s: r.s })))

  const exportSummary = () =>
    downloadFile(
      `fos-payroll-${from}-to-${to}.csv`,
      toCSV([
        ['Last', 'First', 'Location', 'Department', 'Nights worked', 'Hours', 'Pay rate', 'Gross pay', 'Late', 'Call-ins', 'No-shows'],
        ...rows.map((r) => [
          r.s.last_name,
          r.s.first_name,
          L.locations.get(r.s.location_id)?.name,
          r.s.group_id ? L.groups.get(r.s.group_id)?.name : '',
          r.st.worked,
          r.st.hours.toFixed(2),
          r.s.pay_rate ?? '',
          r.s.pay_rate ? (r.st.hours * r.s.pay_rate).toFixed(2) : '',
          r.st.late,
          r.st.calledIn,
          r.st.noShow,
        ]),
      ]),
    )

  const exportDetail = () =>
    downloadFile(
      `fos-timeclock-${from}-to-${to}.csv`,
      toCSV([
        ['Date', 'Location', 'Last', 'First', 'Status', 'In', 'Out', 'Hours', 'Late', 'Note'],
        ...rows
          .flatMap((r) => r.list.map((a) => ({ a, s: r.s, n: L.nights.get(a.night_id)! })))
          .sort((x, y) => x.n.date.localeCompare(y.n.date) || byName(x.s, y.s))
          .map(({ a, s, n }) => [
            n.date,
            L.locations.get(n.location_id)?.name,
            s.last_name,
            s.first_name,
            a.status,
            fmtTime(a.check_in),
            fmtTime(a.check_out),
            hoursBetween(a.check_in, a.check_out).toFixed(2),
            a.late ? 'Yes' : '',
            a.note,
          ]),
      ]),
    )

  const th = (k: SortKey, label: string, cls = '') => (
    <th className={cn('table-head cursor-pointer select-none hover:text-bone', sort === k && 'text-blood-soft', cls)} onClick={() => setSort(k)}>
      {label}
    </th>
  )

  return (
    <>
      <PageHeader
        title="Timesheets"
        subtitle="Hours from check-in / check-out, ready for payroll."
        actions={
          <>
            <button className="btn-secondary" onClick={exportDetail} disabled={!rows.length}>
              <FileSpreadsheet size={16} /> Time clock detail
            </button>
            <button className="btn-primary" onClick={exportSummary} disabled={!rows.length}>
              <Download size={16} /> Payroll CSV
            </button>
          </>
        }
      />

      <div className="card mb-4 flex flex-col gap-3 p-3 sm:p-4">
        <div className="flex flex-wrap justify-center gap-1.5 md:justify-start">
          {presets.map(([l, f, t]) => (
            <button key={l} className="pill-toggle" data-on={from === f && to === t} onClick={() => (setFrom(f), setTo(t))}>
              {l}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[auto_auto_1fr]">
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
          <select className="input col-span-2 sm:col-span-1 sm:max-w-xs" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Department">
            <option value="">All departments</option>
            {sortedGroups(db).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="People paid" value={rows.filter((r) => r.st.worked).length} hint={`${nightIds.size} nights in range`} />
        <Stat label="Hours" value={fmtHours(totals.hours)} hint={`${totals.worked} shifts worked`} />
        <Stat label="Est. gross pay" value={fmtMoney(totals.pay)} hint="Hours × each person’s rate" />
        <Stat label="Absences" value={totals.called + totals.noShow} hint={`${totals.called} call-ins · ${totals.noShow} no-shows`} />
      </div>

      {openIns.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-3 text-center text-sm text-amber-100 md:text-left">
          <b>{openIns.length} still checked in</b> with no check-out — their hours count as 0 until fixed:{' '}
          {openIns.slice(0, 6).map(({ a, s }, i) => (
            <span key={a.id}>
              {i > 0 && ', '}
              <Link href={`/checkin?night=${a.night_id}`} className="underline underline-offset-2">
                {fullName(s)} ({fmtDate(L.nights.get(a.night_id)!.date, { month: 'short', day: 'numeric' })})
              </Link>
            </span>
          ))}
          {openIns.length > 6 && ` +${openIns.length - 6} more`}
        </div>
      )}

      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <Empty title="No hours in this range">Pick a different date range — attendance shows up here once people are checked in and out.</Empty>
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-white/[0.06] bg-white/[0.02]">
              <tr>
                {th('name', 'Name')}
                {scope === 'all' && <th className="table-head">Location</th>}
                {th('nights', 'Nights', 'text-right')}
                {th('hours', 'Hours', 'text-right')}
                <th className="table-head text-right">Rate</th>
                <th className="table-head text-right">Gross</th>
                <th className="table-head text-right">Late</th>
                <th className="table-head text-right">Call-ins</th>
                <th className="table-head text-right">No-shows</th>
                {th('rate', 'Show rate', 'text-right')}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {rows.map(({ s, st }) => (
                <tr key={s.id} className="hover:bg-white/[0.02]">
                  <td className="table-cell">
                    <Link href={`/staff/${s.id}`} className="font-semibold hover:text-blood-soft">
                      {s.last_name}, {s.first_name}
                    </Link>
                    <div className="text-xs text-bone-dim">{s.group_id ? L.groups.get(s.group_id)?.name : s.position}</div>
                  </td>
                  {scope === 'all' && (
                    <td className="table-cell">
                      <LocationChip location={L.locations.get(s.location_id)} />
                    </td>
                  )}
                  <td className="table-cell text-right tabular-nums">{st.worked}</td>
                  <td className="table-cell text-right font-semibold tabular-nums">{fmtHours(st.hours)}</td>
                  <td className="table-cell text-right tabular-nums text-bone-muted">{s.pay_rate ? fmtMoney(s.pay_rate) : '—'}</td>
                  <td className="table-cell text-right tabular-nums">{s.pay_rate ? fmtMoney(st.hours * s.pay_rate) : '—'}</td>
                  <td className={cn('table-cell text-right tabular-nums', st.late && 'text-amber-300')}>{st.late || ''}</td>
                  <td className={cn('table-cell text-right tabular-nums', st.calledIn && 'text-amber-300')}>{st.calledIn || ''}</td>
                  <td className={cn('table-cell text-right tabular-nums', st.noShow && 'text-rose-300')}>{st.noShow || ''}</td>
                  <td className={cn('table-cell text-right tabular-nums', st.showRate != null && st.showRate < 0.85 && 'text-rose-300')}>
                    {st.showRate == null ? '—' : `${Math.round(st.showRate * 100)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-white/10 bg-white/[0.02] font-semibold">
              <tr>
                <td className="table-cell">Total</td>
                {scope === 'all' && <td />}
                <td className="table-cell text-right tabular-nums">{totals.worked}</td>
                <td className="table-cell text-right tabular-nums">{fmtHours(totals.hours)}</td>
                <td />
                <td className="table-cell text-right tabular-nums">{fmtMoney(totals.pay)}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </>
  )
}
