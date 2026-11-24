'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Copy, ExternalLink, UserCheck, UserX } from 'lucide-react'
import { useStore } from '@/lib/store'
import { useLookups } from '@/lib/queries'
import type { Staff, StaffStatus } from '@/lib/types'
import { cn, fullName, nowISO, relTime, uid, STATUS_META } from '@/lib/utils'
import { Avatar, LocationChip, PageHeader } from '@/components/ui'

type Col = { id: string; title: string; status: StaffStatus; color: string; hint: string }
const COLS: Col[] = [
  { id: 'applied', title: 'New', status: 'applied', color: '#38bdf8', hint: 'Fresh applications to review' },
  { id: 'interview', title: 'Interview', status: 'interview', color: '#a78bfa', hint: 'Audition or interview booked' },
  { id: 'offered', title: 'Offered', status: 'offered', color: '#fbbf24', hint: 'Waiting on them to accept' },
  { id: 'hired', title: 'Hired', status: 'active', color: '#34d399', hint: 'Hired in the last 60 days' },
  { id: 'declined', title: 'Declined', status: 'declined', color: '#fb7185', hint: 'Passed or withdrew' },
]
const NEXT: Partial<Record<StaffStatus, StaffStatus>> = { applied: 'interview', interview: 'offered', offered: 'active' }

export default function Recruiting() {
  const { db, inScope, update, insert, toast, userLabel } = useStore()
  const L = useLookups()
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])

  const recentCutoff = Date.now() - 60 * 86400000
  const cards = (c: Col) =>
    db.staff
      .filter(inScope)
      .filter((s) =>
        c.id === 'hired' ? s.status === 'active' && s.hired_at && new Date(s.hired_at).getTime() > recentCutoff && s.source !== 'Returning cast' : s.status === c.status,
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))

  const move = (s: Staff, status: StaffStatus) => {
    if (s.status === status) return
    update('staff', s.id, { status, ...(status === 'active' ? { hired_at: nowISO() } : {}) })
    insert('notes', {
      id: uid(),
      staff_id: s.id,
      kind: 'status',
      body: `Status changed from ${STATUS_META[s.status].label} to ${STATUS_META[status].label}`,
      author: userLabel,
      created_at: nowISO(),
    })
    toast(status === 'active' ? `${s.first_name} hired! 🎃` : `${s.first_name} → ${STATUS_META[status].label}`)
  }

  const applyUrl = `${origin}/apply`

  return (
    <>
      <PageHeader
        title="Recruiting"
        subtitle="Drag applicants between columns, or use the buttons on each card."
        actions={
          <>
            <button
              className="btn-secondary"
              onClick={() => {
                navigator.clipboard?.writeText(applyUrl)
                toast('Application link copied')
              }}
            >
              <Copy size={15} /> Copy apply link
            </button>
            <Link href="/apply" target="_blank" className="btn-primary">
              <ExternalLink size={15} /> Open form
            </Link>
          </>
        }
      />

      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0 xl:grid xl:grid-cols-5 xl:overflow-visible">
        {COLS.map((c) => {
          const list = cards(c)
          return (
            <section
              key={c.id}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(c.id)
              }}
              onDragLeave={() => setOver((o) => (o === c.id ? null : o))}
              onDrop={() => {
                const s = dragId ? L.staff.get(dragId) : undefined
                if (s) move(s, c.status)
                setDragId(null)
                setOver(null)
              }}
              className={cn(
                'card flex w-[82vw] max-w-[320px] shrink-0 snap-center flex-col transition xl:w-auto xl:max-w-none',
                over === c.id && 'ring-2 ring-blood/50',
              )}
            >
              <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                    <h2 className="font-display text-base uppercase tracking-wide">{c.title}</h2>
                  </div>
                  <p className="text-[11px] text-bone-dim">{c.hint}</p>
                </div>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-bold tabular-nums">{list.length}</span>
              </header>
              <div className="flex min-h-[180px] flex-col gap-2 p-2.5">
                {list.map((s) => (
                  <article
                    key={s.id}
                    draggable
                    onDragStart={() => setDragId(s.id)}
                    onDragEnd={() => setDragId(null)}
                    className={cn(
                      'group cursor-grab rounded-xl bg-ink-850 p-3 ring-1 ring-white/[0.07] transition hover:ring-white/15 active:cursor-grabbing',
                      dragId === s.id && 'opacity-40',
                    )}
                  >
                    <Link href={`/staff/${s.id}`} className="flex items-start gap-2.5">
                      <Avatar name={fullName(s)} color={L.locations.get(s.location_id)?.color} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold group-hover:text-blood-soft">{fullName(s)}</div>
                        <div className="truncate text-xs text-bone-muted">{s.position}</div>
                      </div>
                    </Link>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <LocationChip location={L.locations.get(s.location_id)} />
                      {s.is_minor && <span className="chip bg-sky-500/10 text-sky-300 ring-sky-400/20">Minor</span>}
                      {s.seasons > 1 && <span className="chip bg-emerald-500/10 text-emerald-300 ring-emerald-400/20">Returning</span>}
                      <span className="ml-auto text-[10px] text-bone-dim">{relTime(s.created_at)}</span>
                    </div>
                    <div className="mt-1.5 text-[11px] text-bone-dim">Nights: {s.availability.join(', ') || '—'}</div>
                    {(NEXT[s.status] || s.status === 'applied' || s.status === 'interview' || s.status === 'offered') && c.id !== 'hired' && (
                      <div className="mt-2.5 flex gap-1.5">
                        {NEXT[s.status] && (
                          <button className="btn-secondary btn-sm flex-1" onClick={() => move(s, NEXT[s.status]!)}>
                            {NEXT[s.status] === 'active' ? <UserCheck size={13} /> : <ArrowRight size={13} />}
                            {NEXT[s.status] === 'active' ? 'Hire' : STATUS_META[NEXT[s.status]!].label}
                          </button>
                        )}
                        <button className="btn-ghost btn-sm" onClick={() => move(s, 'declined')} title="Decline" aria-label={`Decline ${fullName(s)}`}>
                          <UserX size={14} />
                        </button>
                      </div>
                    )}
                    {c.id === 'declined' && (
                      <button className="btn-ghost btn-sm mt-2 w-full" onClick={() => move(s, 'applied')}>
                        Reconsider
                      </button>
                    )}
                  </article>
                ))}
                {list.length === 0 && <p className="py-8 text-center text-xs text-bone-dim">Drop here</p>}
              </div>
            </section>
          )
        })}
      </div>

      <div className="card card-pad mt-2 text-center text-sm text-bone-muted md:text-left">
        <p>
          <b className="text-bone">Where applicants come from:</b> anyone who fills out the{' '}
          <Link href="/apply" target="_blank" className="text-blood hover:underline">
            application form
          </Link>{' '}
          lands in <b className="text-bone">New</b>. Once the app is live, the Branson and Nixa websites&apos; own Apply pages can send straight here too. See Settings → Website applications.
        </p>
      </div>
    </>
  )
}
