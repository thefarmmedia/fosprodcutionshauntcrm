'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { Mail, MessageSquare, Send, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { getSupabase } from '@/lib/adapters/supabase'
import { attractionsFor, sortedGroups, sortedLocations, useLookups } from '@/lib/queries'
import { STAFF_STATUSES, type Message, type StaffStatus } from '@/lib/types'
import { STATUS_META, byName, cn, fmt12, fmtDate, fmtDateTime, fullName, mergeTags, nowISO, uid } from '@/lib/utils'
import { Avatar, Empty, Field, Modal, PageHeader, Segmented } from '@/components/ui'

type Channel = Message['channel']

const TEMPLATES = [
  { name: 'We’re open tonight', subject: 'We are OPEN tonight', body: 'Hey {first_name}! Weather check: we are OPEN tonight. Call time is {call_time}. See you there!' },
  { name: 'Call time reminder', subject: 'Reminder: you’re on tonight', body: 'Reminder {first_name}: you’re scheduled {night_date}. Call time {call_time}. Reply if you can’t make it.' },
  { name: 'Closed — weather', subject: 'Closed tonight', body: 'Hi {first_name}, we are CLOSED tonight due to weather. Stay safe and we’ll see you next shift.' },
  { name: 'Schedule posted', subject: 'New schedule is up', body: 'Hey {first_name}, the new schedule is posted. Check with your scene lead for your nights.' },
  { name: 'Interview invite', subject: 'Field of Screams — audition', body: 'Hi {first_name}! Thanks for applying to Field of Screams. We’d love to meet you — reply with a good time for a quick audition.' },
]

function smsSegments(text: string) {
  // eslint-disable-next-line no-control-regex
  const unicode = /[^\x00-\x7F]/.test(text)
  const single = unicode ? 70 : 160
  const multi = unicode ? 67 : 153
  return text.length <= single ? 1 : Math.ceil(text.length / multi)
}

function Composer() {
  const { db, scope, insert, toast, userLabel, mode } = useStore()
  const L = useLookups()
  const params = useSearchParams()

  const [channel, setChannel] = useState<Channel>('sms')
  const [loc, setLoc] = useState<string>(scope)
  const [statuses, setStatuses] = useState<StaffStatus[]>(['active'])
  const [groups, setGroups] = useState<string[]>([])
  const [atts, setAtts] = useState<string[]>([])
  const [nightId, setNightId] = useState('')
  const [explicit, setExplicit] = useState<string[] | null>(null)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [sending, setSending] = useState(false)
  const [openMsg, setOpenMsg] = useState<Message | null>(null)

  useEffect(() => setLoc(scope), [scope])
  useEffect(() => {
    const ids = params.get('ids')
    if (ids) setExplicit(ids.split(',').filter(Boolean))
    const n = params.get('night')
    if (n) setNightId(n)
  }, [params])

  const night = nightId ? L.nights.get(nightId) : undefined
  const recipients = useMemo(() => {
    let list = explicit ? explicit.map((id) => L.staff.get(id)).filter((s): s is NonNullable<typeof s> => !!s) : db.staff
    if (!explicit) {
      list = list
        .filter((s) => loc === 'all' || s.location_id === loc)
        .filter((s) => statuses.includes(s.status))
        .filter((s) => !groups.length || (s.group_id && groups.includes(s.group_id)))
        .filter((s) => !atts.length || (s.attraction_id && atts.includes(s.attraction_id)))
      if (night) {
        const on = new Set(db.shifts.filter((x) => x.night_id === night.id).map((x) => x.staff_id))
        list = list.filter((s) => on.has(s.id))
      }
    }
    return list.filter((s) => !excluded.has(s.id)).sort(byName)
  }, [explicit, db.staff, db.shifts, L.staff, loc, statuses, groups, atts, night, excluded])

  const withPhone = recipients.filter((s) => s.phone.replace(/\D/g, '').length >= 10)
  const withEmail = recipients.filter((s) => /@/.test(s.email))
  const reach = channel === 'sms' ? withPhone.length : channel === 'email' ? withEmail.length : new Set([...withPhone, ...withEmail]).size

  const extra: Record<string, string> = night
    ? { night_date: fmtDate(night.date, { weekday: 'long', month: 'short', day: 'numeric' }), call_time: fmt12(night.call_time) }
    : {}
  const sample = recipients[0]
  const preview = sample ? mergeTags(body, sample, extra) : body

  const audienceLabel = explicit
    ? `${recipients.length} hand-picked`
    : [
        loc === 'all' ? 'Both locations' : L.locations.get(loc)?.name,
        statuses.map((s) => STATUS_META[s].label).join(', '),
        groups.length ? groups.map((g) => L.groups.get(g)?.name).join(', ') : '',
        atts.length ? atts.map((a) => L.attractions.get(a)?.name).join(', ') : '',
        night ? `on ${fmtDate(night.date)}` : '',
      ]
        .filter(Boolean)
        .join(' · ')

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const send = async () => {
    setSending(true)
    try {
      const token = (await getSupabase()?.auth.getSession())?.data.session?.access_token
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          channel,
          messages: recipients.map((s) => ({
            id: s.id,
            phone: s.phone,
            email: s.email,
            subject: mergeTags(subject || 'Field of Screams', s, extra),
            body: mergeTags(body, s, extra),
          })),
        }),
      })
      const data = (await res.json()) as { simulated?: boolean; sms?: number; email?: number; failed?: number; error?: string }
      if (!res.ok) throw new Error(data.error || 'Send failed')
      const stats = { sms: data.sms ?? 0, email: data.email ?? 0, failed: data.failed ?? 0 }
      insert('messages', {
        id: uid(),
        location_id: loc === 'all' ? null : loc,
        channel,
        subject,
        body,
        recipient_ids: recipients.map((s) => s.id),
        audience: audienceLabel,
        sent_by: userLabel,
        result: data.simulated ? 'simulated' : stats.failed ? (stats.sms + stats.email ? 'partial' : 'failed') : 'sent',
        stats,
        created_at: nowISO(),
      })
      toast(data.simulated ? `Logged (not actually sent — ${mode === 'demo' ? 'demo mode' : 'texting/email not connected yet'})` : `Sent to ${reach} people${stats.failed ? ` · ${stats.failed} failed` : ''}`)
      setBody('')
      setSubject('')
      setConfirm(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Send failed', 'error')
    } finally {
      setSending(false)
    }
  }

  const history = [...db.messages].filter((m) => scope === 'all' || !m.location_id || m.location_id === scope).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const upcomingNights = db.nights
    .filter((n) => (loc === 'all' || n.location_id === loc) && n.status !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((n) => n.date >= new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10) || n.id === nightId)
    .slice(0, 40)

  return (
    <>
      <PageHeader title="Messages" subtitle="Text or email your cast and crew — everyone, a department, an attraction, or just tonight's roster." />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="card card-pad flex flex-col gap-5">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide">New message</h2>
            <Segmented
              value={channel}
              onChange={setChannel}
              options={[
                { value: 'sms', label: 'Text' },
                { value: 'email', label: 'Email' },
                { value: 'both', label: 'Both' },
              ]}
            />
          </div>

          {explicit ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-blood/[0.07] p-3 text-sm ring-1 ring-blood/25">
              <span>
                Sending to <b>{recipients.length}</b> people you picked on the roster.
              </span>
              <button className="btn-ghost btn-sm" onClick={() => setExplicit(null)}>
                Use filters instead
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              <div>
                <span className="label">Location</span>
                <div className="flex flex-wrap gap-1.5">
                  {[{ id: 'all', name: 'Both' }, ...sortedLocations(db)].map((l) => (
                    <button key={l.id} className="pill-toggle" data-on={loc === l.id} onClick={() => setLoc(l.id)}>
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="label">Who</span>
                <div className="flex flex-wrap gap-1.5">
                  {STAFF_STATUSES.filter((s) => s !== 'dnr').map((s) => (
                    <button key={s} className="pill-toggle" data-on={statuses.includes(s)} onClick={() => setStatuses(toggle(statuses, s))}>
                      {STATUS_META[s].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="label">Departments {groups.length === 0 && <span className="normal-case tracking-normal text-bone-dim">(all)</span>}</span>
                <div className="flex flex-wrap gap-1.5">
                  {sortedGroups(db).map((g) => (
                    <button key={g.id} className="pill-toggle" data-on={groups.includes(g.id)} onClick={() => setGroups(toggle(groups, g.id))}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: g.color }} />
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="label">Attractions {atts.length === 0 && <span className="normal-case tracking-normal text-bone-dim">(all)</span>}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {attractionsFor(db, loc).map((a) => (
                      <button key={a.id} className="pill-toggle" data-on={atts.includes(a.id)} onClick={() => setAtts(toggle(atts, a.id))}>
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>
                <Field label="Only people scheduled on">
                  <select className="input" value={nightId} onChange={(e) => setNightId(e.target.value)}>
                    <option value="">Any night</option>
                    {upcomingNights.map((n) => (
                      <option key={n.id} value={n.id}>
                        {fmtDate(n.date)} — {L.locations.get(n.location_id)?.name}
                        {n.label && ` · ${n.label}`}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            <span className="label w-full">Templates</span>
            {TEMPLATES.map((t) => (
              <button
                key={t.name}
                className="pill-toggle"
                onClick={() => {
                  setBody(t.body)
                  setSubject(t.subject)
                }}
              >
                {t.name}
              </button>
            ))}
          </div>

          {channel !== 'sms' && (
            <Field label="Email subject">
              <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Field of Screams update" />
            </Field>
          )}
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="label mb-0">Message</span>
              <div className="flex flex-wrap gap-1">
                {['first_name', ...(night ? ['night_date', 'call_time'] : [])].map((t) => (
                  <button key={t} className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-bone-muted hover:bg-white/10 hover:text-bone" onClick={() => setBody((b) => `${b}{${t}}`)}>
                    {`{${t}}`}
                  </button>
                ))}
              </div>
            </div>
            <textarea className="input min-h-[130px]" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Hey {first_name}! …" />
            {channel !== 'email' && (
              <p className="mt-1 text-right text-[11px] text-bone-dim">
                {preview.length} chars · {smsSegments(preview)} text segment{smsSegments(preview) > 1 ? 's' : ''}
              </p>
            )}
          </div>

          {body && sample && (
            <div className="rounded-xl bg-ink-950/70 p-3 ring-1 ring-white/[0.06]">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-bone-dim">Preview for {sample.first_name}</div>
              <p className="whitespace-pre-wrap text-sm">{preview}</p>
            </div>
          )}

          <div className="flex flex-col items-center gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:justify-between">
            <p className="text-center text-sm text-bone-muted sm:text-left">
              <b className="text-bone">{recipients.length}</b> recipients · {withPhone.length} with a mobile · {withEmail.length} with email
            </p>
            <button className="btn-primary" disabled={!body.trim() || reach === 0} onClick={() => setConfirm(true)}>
              <Send size={16} /> Review &amp; send
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <h2 className="font-display text-lg uppercase tracking-wide">Recipients</h2>
              {excluded.size > 0 && (
                <button className="btn-ghost btn-sm" onClick={() => setExcluded(new Set())}>
                  Restore {excluded.size} removed
                </button>
              )}
            </div>
            <ul className="max-h-[300px] divide-y divide-white/[0.04] overflow-y-auto">
              {recipients.map((s) => (
                <li key={s.id} className="flex items-center gap-2.5 px-4 py-2">
                  <Avatar name={fullName(s)} color={L.locations.get(s.location_id)?.color} size={26} />
                  <span className="flex-1 truncate text-sm">{fullName(s)}</span>
                  {channel !== 'email' && !s.phone && <span className="text-[10px] text-rose-300">no phone</span>}
                  {channel !== 'sms' && !s.email && <span className="text-[10px] text-rose-300">no email</span>}
                  <button className="rounded p-1 text-bone-dim hover:bg-white/10 hover:text-bone" onClick={() => setExcluded((p) => new Set(p).add(s.id))} aria-label={`Remove ${fullName(s)}`}>
                    <X size={13} />
                  </button>
                </li>
              ))}
              {recipients.length === 0 && <li className="px-4 py-8 text-center text-sm text-bone-muted">Nobody matches.</li>}
            </ul>
          </div>

          <div className="card overflow-hidden">
            <h2 className="border-b border-white/[0.06] px-4 py-3 font-display text-lg uppercase tracking-wide">Sent</h2>
            {history.length === 0 ? (
              <Empty title="Nothing sent yet" />
            ) : (
              <ul className="max-h-[420px] divide-y divide-white/[0.04] overflow-y-auto">
                {history.map((m) => (
                  <li key={m.id}>
                    <button className="flex w-full gap-3 px-4 py-3 text-left hover:bg-white/[0.02]" onClick={() => setOpenMsg(m)}>
                      <span className="mt-0.5 text-bone-dim">{m.channel === 'email' ? <Mail size={16} /> : <MessageSquare size={16} />}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{m.subject || m.body}</div>
                        <div className="truncate text-xs text-bone-muted">
                          {m.recipient_ids.length} people · {m.audience}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="whitespace-nowrap text-[11px] text-bone-dim">{fmtDateTime(m.created_at)}</div>
                        <div className={cn('text-[10px] font-semibold uppercase', m.result === 'sent' ? 'text-emerald-300' : m.result === 'simulated' ? 'text-amber-300' : 'text-rose-300')}>
                          {m.result === 'simulated' ? 'Not sent (demo)' : m.result}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {confirm && (
        <Modal
          open
          onClose={() => setConfirm(false)}
          title="Send this message?"
          footer={
            <>
              <button className="btn-ghost" onClick={() => setConfirm(false)} disabled={sending}>
                Cancel
              </button>
              <button className="btn-primary" onClick={send} disabled={sending}>
                <Send size={16} /> {sending ? 'Sending…' : `Send to ${reach}`}
              </button>
            </>
          }
        >
          <div className="space-y-3 text-sm">
            <p>
              {channel === 'sms' ? 'Text' : channel === 'email' ? 'Email' : 'Text + email'} to <b>{reach}</b> people ({audienceLabel}).
            </p>
            <div className="rounded-xl bg-ink-950/70 p-3 ring-1 ring-white/[0.06]">
              {channel !== 'sms' && <p className="mb-1 font-semibold">{subject || 'Field of Screams'}</p>}
              <p className="whitespace-pre-wrap">{preview}</p>
            </div>
            {mode === 'demo' && <p className="text-xs text-amber-200/80">Demo mode: this is logged but nothing is actually sent.</p>}
          </div>
        </Modal>
      )}

      {openMsg && (
        <Modal open onClose={() => setOpenMsg(null)} title={openMsg.subject || 'Text message'}>
          <div className="space-y-3 text-sm">
            <p className="text-bone-muted">
              {fmtDateTime(openMsg.created_at)} · by {openMsg.sent_by} · {openMsg.audience}
            </p>
            <p className="whitespace-pre-wrap rounded-xl bg-ink-950/70 p-3 ring-1 ring-white/[0.06]">{openMsg.body}</p>
            <p className="text-xs text-bone-dim">
              {openMsg.stats.sms} texts · {openMsg.stats.email} emails · {openMsg.stats.failed} failed
            </p>
            <div className="flex flex-wrap gap-1">
              {openMsg.recipient_ids.map((id) => {
                const s = L.staff.get(id)
                return s ? (
                  <span key={id} className="chip bg-white/5 text-bone-muted ring-white/10">
                    {fullName(s)}
                  </span>
                ) : null
              })}
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

export default function MessagesPage() {
  return (
    <Suspense>
      <Composer />
    </Suspense>
  )
}
