import clsx, { type ClassValue } from 'clsx'
import type { AttendanceStatus, CostumeStatus, Day, NightKind, Staff, StaffStatus } from './types'

export const cn = (...v: ClassValue[]) => clsx(v)

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export const nowISO = () => new Date().toISOString()

// ── Dates ──────────────────────────────────────────────────────────────
// Nights are stored as plain YYYY-MM-DD strings (the haunt's local date),
// so all date math here works on local calendar days, never UTC.

export const pad = (n: number) => String(n).padStart(2, '0')

export const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayKey = () => toDateKey(new Date())

export const parseDateKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const addDays = (key: string, n: number) => {
  const d = parseDateKey(key)
  d.setDate(d.getDate() + n)
  return toDateKey(d)
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const weekdayOf = (key: string) => WEEKDAY[parseDateKey(key).getDay()]
export const isWorkDay = (w: string): w is Day => ['Thu', 'Fri', 'Sat', 'Sun'].includes(w)

export const fmtDate = (key: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  parseDateKey(key).toLocaleDateString('en-US', opts)

export const fmtLongDate = (key: string) =>
  fmtDate(key, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

export const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'

export const fmt12 = (hhmm: string) => {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const ap = h >= 12 ? 'PM' : 'AM'
  return `${((h + 11) % 12) + 1}:${pad(m)} ${ap}`
}

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export const relTime = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** ISO timestamp for a night's date + HH:MM (local time). */
export const atTime = (dateKey: string, hhmm: string, plusMinutes = 0) => {
  const d = parseDateKey(dateKey)
  const [h, m] = hhmm.split(':').map(Number)
  d.setHours(h, m + plusMinutes, 0, 0)
  // Close times after midnight (e.g. 00:30) belong to the next calendar day.
  if (h < 6) d.setDate(d.getDate() + 1)
  return d.toISOString()
}

export const hoursBetween = (a: string | null, b: string | null) =>
  a && b ? Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000) : 0

export const fmtHours = (h: number) => (h ? h.toFixed(h < 10 ? 2 : 1) : '0')

// ── People ─────────────────────────────────────────────────────────────

export const fullName = (s: Pick<Staff, 'first_name' | 'last_name'>) => `${s.first_name} ${s.last_name}`.trim()
export const initials = (s: Pick<Staff, 'first_name' | 'last_name'>) =>
  `${s.first_name[0] ?? ''}${s.last_name[0] ?? ''}`.toUpperCase()

export const fmtPhone = (p: string) => {
  const d = p.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p
}

export const fmtMoney = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

/** Fill {first_name}-style merge tags. */
export const mergeTags = (text: string, s: Staff, extra: Record<string, string> = {}) =>
  text.replace(/\{(\w+)\}/g, (m, k: string) => {
    if (k in extra) return extra[k]
    if (k === 'first_name') return s.first_name
    if (k === 'last_name') return s.last_name
    if (k === 'full_name') return fullName(s)
    if (k === 'position') return s.position
    return m
  })

// ── Labels & colors ────────────────────────────────────────────────────

export const STATUS_META: Record<StaffStatus, { label: string; cls: string }> = {
  applied: { label: 'Applied', cls: 'bg-sky-500/15 text-sky-300 ring-sky-400/30' },
  interview: { label: 'Interview', cls: 'bg-violet-500/15 text-violet-300 ring-violet-400/30' },
  offered: { label: 'Offered', cls: 'bg-amber-500/15 text-amber-300 ring-amber-400/30' },
  active: { label: 'Active', cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30' },
  inactive: { label: 'Inactive', cls: 'bg-zinc-500/15 text-zinc-300 ring-zinc-400/30' },
  declined: { label: 'Declined', cls: 'bg-rose-500/10 text-rose-300/80 ring-rose-400/20' },
  dnr: { label: 'Do not rehire', cls: 'bg-red-600/20 text-red-300 ring-red-500/40' },
}

export const COSTUME_META: Record<CostumeStatus, { label: string; cls: string; dot: string }> = {
  ready: { label: 'Ready', cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30', dot: 'bg-emerald-400' },
  in_use: { label: 'In use', cls: 'bg-sky-500/15 text-sky-300 ring-sky-400/30', dot: 'bg-sky-400' },
  cleaning: { label: 'Being cleaned', cls: 'bg-amber-500/15 text-amber-300 ring-amber-400/30', dot: 'bg-amber-400' },
  repair: { label: 'Needs repair', cls: 'bg-rose-500/15 text-rose-300 ring-rose-400/30', dot: 'bg-rose-400' },
  retired: { label: 'Retired', cls: 'bg-zinc-500/15 text-zinc-400 ring-zinc-400/20', dot: 'bg-zinc-500' },
}

export const ATTENDANCE_META: Record<AttendanceStatus | 'pending', { label: string; cls: string }> = {
  pending: { label: 'Not here yet', cls: 'bg-zinc-500/15 text-zinc-300 ring-zinc-400/25' },
  in: { label: 'Checked in', cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30' },
  out: { label: 'Checked out', cls: 'bg-sky-500/15 text-sky-300 ring-sky-400/30' },
  called_in: { label: 'Called in', cls: 'bg-amber-500/15 text-amber-300 ring-amber-400/30' },
  no_show: { label: 'No show', cls: 'bg-rose-500/15 text-rose-300 ring-rose-400/30' },
  sent_home: { label: 'Sent home', cls: 'bg-orange-500/15 text-orange-300 ring-orange-400/30' },
}

export const NIGHT_KIND_LABEL: Record<NightKind, string> = {
  show: 'Show night',
  rehearsal: 'Rehearsal',
  training: 'Training',
  build: 'Build day',
  event: 'Special event',
}

// ── CSV / files ────────────────────────────────────────────────────────

export const toCSV = (rows: (string | number | null | undefined)[][]) =>
  rows
    .map((r) =>
      r
        .map((v) => {
          const s = v == null ? '' : String(v)
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(','),
    )
    .join('\n')

export const downloadFile = (name: string, content: string, type = 'text/csv') => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const byName = (a: Staff, b: Staff) =>
  a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name)
