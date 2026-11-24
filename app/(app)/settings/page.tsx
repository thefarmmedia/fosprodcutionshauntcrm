'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, CircleSlash, Copy, Download, Plus, Trash2, Upload } from 'lucide-react'
import { useStore } from '@/lib/store'
import { resetLocal } from '@/lib/adapters/local'
import { mapHeaders, parseCSV, rowsToStaff } from '@/lib/csv'
import { sortedGroups, sortedLocations } from '@/lib/queries'
import { TABLES, type DB, type Staff, type StaffStatus } from '@/lib/types'
import { STATUS_META, downloadFile, uid } from '@/lib/utils'
import { Field, Modal, PageHeader } from '@/components/ui'

type Status = { database: boolean; sms: boolean; email: boolean; inbound: boolean }

function Section({ id, title, desc, children }: { id?: string; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card card-pad scroll-mt-20">
      <h2 className="text-center font-display text-xl uppercase tracking-wide md:text-left">{title}</h2>
      {desc && <p className="mt-1 text-center text-sm text-bone-muted md:text-left">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

const ColorInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent p-1" aria-label="Color" />
)

export default function Settings() {
  const { db, mode, update, insert, remove, toast } = useStore()
  const [status, setStatus] = useState<Status | null>(null)
  const [origin, setOrigin] = useState('')
  const [importing, setImporting] = useState<Staff[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const csvRef = useRef<HTMLInputElement>(null)
  const [csvDefaults, setCsvDefaults] = useState<{ loc: string; status: StaffStatus }>({ loc: sortedLocations(db)[0]?.id ?? '', status: 'active' })
  const [csvRows, setCsvRows] = useState<string[][] | null>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
    fetch('/api/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [])

  useEffect(() => {
    if (csvRows) setImporting(rowsToStaff(csvRows, { defaultLocation: csvDefaults.loc, defaultStatus: csvDefaults.status, locations: db.locations }))
  }, [csvRows, csvDefaults, db.locations])

  const locs = sortedLocations(db)
  const groups = sortedGroups(db)

  const exportBackup = () => downloadFile(`fos-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db, null, 1), 'application/json')

  const importBackup = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Partial<DB>
      if (!data.staff || !data.locations) throw new Error('That file is not a FoS backup')
      if (!window.confirm(`Import ${data.staff.length} staff and everything else in this backup? Matching records are overwritten.`)) return
      for (const t of TABLES) if (Array.isArray(data[t]) && data[t]!.length) insert(t, data[t] as never)
      toast('Backup imported')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Import failed', 'error')
    }
  }

  const onCSV = async (file: File) => {
    const rows = parseCSV(await file.text())
    if (rows.length < 2) return toast('That CSV looks empty', 'error')
    const m = mapHeaders(rows[0])
    if (m.first_name === undefined && m.full_name === undefined) return toast('Need a "First name" or "Name" column', 'error')
    setCsvRows(rows)
  }

  const webhook = `${origin}/api/inbound/application?key=YOUR_INBOUND_APPLICATION_KEY`

  return (
    <>
      <PageHeader title="Settings" subtitle="Locations, attractions, departments, integrations and data." />
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Locations" desc="Both haunts share one app. Colors tag everything by location.">
          <div className="space-y-2">
            {locs.map((l) => (
              <div key={l.id} className="flex items-center gap-2">
                <ColorInput value={l.color} onChange={(v) => update('locations', l.id, { color: v })} />
                <input className="input" value={l.name} onChange={(e) => update('locations', l.id, { name: e.target.value })} aria-label="Short name" />
                <input className="input" value={l.full_name} onChange={(e) => update('locations', l.id, { full_name: e.target.value })} aria-label="Full name" />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Attractions" desc="“Actors wanted” sets the staffing target shown on each night.">
          <div className="space-y-4">
            {locs.map((l) => (
              <div key={l.id}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: l.color }}>
                  {l.name}
                </div>
                <div className="space-y-2">
                  {db.attractions
                    .filter((a) => a.location_id === l.id)
                    .sort((a, b) => a.sort - b.sort)
                    .map((a) => (
                      <div key={a.id} className="flex items-center gap-2">
                        <ColorInput value={a.color} onChange={(v) => update('attractions', a.id, { color: v })} />
                        <input className="input" value={a.name} onChange={(e) => update('attractions', a.id, { name: e.target.value })} aria-label="Attraction name" />
                        <input
                          className="input w-20 shrink-0"
                          type="number"
                          min={0}
                          value={a.target}
                          onChange={(e) => update('attractions', a.id, { target: Number(e.target.value) || 0 })}
                          aria-label="Actors wanted"
                          title="Actors wanted per night"
                        />
                        <button
                          className="btn-ghost p-2"
                          aria-label={`Delete ${a.name}`}
                          onClick={() => {
                            const used = db.staff.some((s) => s.attraction_id === a.id) || db.shifts.some((s) => s.attraction_id === a.id)
                            if (!window.confirm(used ? `${a.name} has staff and shifts attached. Delete it anyway? They'll become “Support”.` : `Delete ${a.name}?`)) return
                            update('staff', db.staff.filter((s) => s.attraction_id === a.id).map((s) => s.id), { attraction_id: null })
                            update('shifts', db.shifts.filter((s) => s.attraction_id === a.id).map((s) => s.id), { attraction_id: null })
                            update('costumes', db.costumes.filter((c) => c.attraction_id === a.id).map((c) => c.id), { attraction_id: null })
                            remove('attractions', a.id)
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() =>
                      insert('attractions', { id: uid(), location_id: l.id, name: 'New attraction', color: '#ff5a1f', target: 12, sort: db.attractions.length + 1 })
                    }
                  >
                    <Plus size={14} /> Add attraction
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Departments" desc="Used for filtering, scheduling and group texts. Shared by both locations.">
          <div className="grid gap-2 sm:grid-cols-2">
            {groups.map((g) => (
              <div key={g.id} className="flex items-center gap-2">
                <ColorInput value={g.color} onChange={(v) => update('groups', g.id, { color: v })} />
                <input className="input" value={g.name} onChange={(e) => update('groups', g.id, { name: e.target.value })} aria-label="Department name" />
                <button
                  className="btn-ghost p-2"
                  aria-label={`Delete ${g.name}`}
                  onClick={() => {
                    if (!window.confirm(`Delete ${g.name}? People in it will have no department.`)) return
                    update('staff', db.staff.filter((s) => s.group_id === g.id).map((s) => s.id), { group_id: null })
                    remove('groups', g.id)
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <button className="btn-ghost btn-sm mt-2" onClick={() => insert('groups', { id: uid(), name: 'New department', color: '#94a3b8', sort: groups.length + 1 })}>
            <Plus size={14} /> Add department
          </button>
        </Section>

        <Section title="Connections" desc="What's hooked up right now.">
          <ul className="space-y-2 text-sm">
            {[
              ['Shared database (Supabase)', status?.database, 'Both locations see the same live data, with logins'],
              ['Text messages (Twilio)', status?.sms, 'Group texts actually send'],
              ['Email (Resend)', status?.email, 'Group emails actually send'],
              ['Website applications', status?.inbound, 'Branson & Nixa Apply pages drop people into Recruiting'],
            ].map(([label, on, desc]) => (
              <li key={label as string} className="flex items-start gap-3 rounded-xl bg-white/[0.02] p-3 ring-1 ring-white/[0.06]">
                {on ? <CheckCircle2 size={18} className="mt-0.5 text-emerald-400" /> : <CircleSlash size={18} className="mt-0.5 text-bone-dim" />}
                <div>
                  <div className="font-semibold">{label}</div>
                  <div className="text-xs text-bone-muted">{on ? 'Connected' : 'Not connected'} — {desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="website-applications" title="Website applications" desc="Point the websites' Apply forms here so applicants land in Recruiting automatically.">
          <div className="space-y-3 text-sm">
            <p className="text-bone-muted">
              The Nixa site already forwards applications to a webhook (currently your old CRM). Once this app is live, set <code className="rounded bg-white/5 px-1">APPLY_WEBHOOK_URL</code> in that site&apos;s
              Netlify environment to:
            </p>
            <div className="flex items-center gap-2">
              <code className="block flex-1 truncate rounded-xl bg-ink-950/70 px-3 py-2 text-xs ring-1 ring-white/10">{webhook}</code>
              <button
                className="btn-secondary btn-sm"
                onClick={() => {
                  navigator.clipboard?.writeText(webhook)
                  toast('Copied')
                }}
              >
                <Copy size={14} />
              </button>
            </div>
            <p className="text-xs text-bone-dim">
              It accepts the same fields the Nixa form sends today (first_name, last_name, email, phone, position_desired, availability, applying_for_location…). Or just link people to{' '}
              <a href="/apply" target="_blank" className="text-blood hover:underline">
                {origin}/apply
              </a>
              .
            </p>
          </div>
        </Section>

        <Section title="Data" desc="Back up, restore, or bring in an existing staff list.">
          <div className="grid gap-2 sm:grid-cols-2">
            <button className="btn-secondary" onClick={exportBackup}>
              <Download size={16} /> Download full backup
            </button>
            <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Restore from backup
            </button>
            <button className="btn-secondary sm:col-span-2" onClick={() => csvRef.current?.click()}>
              <Upload size={16} /> Import staff from a spreadsheet (CSV)
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} />
            <input ref={csvRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && onCSV(e.target.files[0])} />
          </div>
          {mode === 'demo' && (
            <div className="mt-4 grid gap-2 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
              <button
                className="btn-ghost"
                onClick={() => {
                  if (!window.confirm('Reset to fresh demo data? Everything you changed in this browser is lost.')) return
                  resetLocal(true)
                  window.location.reload()
                }}
              >
                Reset demo data
              </button>
              <button
                className="btn-ghost text-rose-300"
                onClick={() => {
                  if (!window.confirm('Clear all staff, nights, costumes and messages from this browser? Locations, attractions and departments are kept.')) return
                  resetLocal(false)
                  window.location.reload()
                }}
              >
                Clear demo data &amp; start fresh
              </button>
            </div>
          )}
        </Section>

        <Section id="go-live" title="Going live" desc={mode === 'live' ? 'You are live — data is shared and synced.' : 'Right now everything is saved only in this browser. To share it between both locations:'}>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-bone-muted marker:text-blood">
            <li>
              Create a free project at <b className="text-bone">supabase.com</b>, open its SQL editor, and run <code className="rounded bg-white/5 px-1">supabase/schema.sql</code> from the repo.
            </li>
            <li>
              In Netlify → Site settings → Environment variables, add <code className="rounded bg-white/5 px-1">NEXT_PUBLIC_SUPABASE_URL</code>,{' '}
              <code className="rounded bg-white/5 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and <code className="rounded bg-white/5 px-1">SUPABASE_SERVICE_ROLE_KEY</code>.
            </li>
            <li>In Supabase → Authentication → Users, add a login for each manager. They sign in with email + password.</li>
            <li>
              Optional: add Twilio keys for texting and a Resend key for email (see <code className="rounded bg-white/5 px-1">.env.example</code>).
            </li>
            <li>Use “Download full backup” here, then “Restore from backup” after signing in live, to carry over anything you set up in demo mode.</li>
          </ol>
        </Section>
      </div>

      {importing && (
        <Modal
          open
          onClose={() => (setImporting(null), setCsvRows(null))}
          title="Import staff"
          wide
          footer={
            <>
              <button className="btn-ghost" onClick={() => (setImporting(null), setCsvRows(null))}>
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={!importing.length}
                onClick={() => {
                  insert('staff', importing)
                  toast(`Imported ${importing.length} people`)
                  setImporting(null)
                  setCsvRows(null)
                }}
              >
                Import {importing.length}
              </button>
            </>
          }
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Field label="If no location column, put them in">
              <select className="input" value={csvDefaults.loc} onChange={(e) => setCsvDefaults({ ...csvDefaults, loc: e.target.value })}>
                {locs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.full_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="If no status column, mark them">
              <select className="input" value={csvDefaults.status} onChange={(e) => setCsvDefaults({ ...csvDefaults, status: e.target.value as StaffStatus })}>
                {(['active', 'applied', 'inactive'] as StaffStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="mb-2 text-xs text-bone-dim">First 8 of {importing.length}:</p>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-white/[0.05]">
              {importing.slice(0, 8).map((s) => (
                <tr key={s.id}>
                  <td className="py-1.5 font-semibold">
                    {s.first_name} {s.last_name}
                  </td>
                  <td className="py-1.5 text-bone-muted">{s.phone}</td>
                  <td className="py-1.5 text-bone-muted">{s.email}</td>
                  <td className="py-1.5">{STATUS_META[s.status].label}</td>
                  <td className="py-1.5 text-bone-muted">{db.locations.find((l) => l.id === s.location_id)?.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </>
  )
}
