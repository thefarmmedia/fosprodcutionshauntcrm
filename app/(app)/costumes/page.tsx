'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Plus, Search, Shirt, Sparkles, Trash2 } from 'lucide-react'
import { useStore } from '@/lib/store'
import { attractionsFor, sortedLocations, useLookups } from '@/lib/queries'
import { COSTUME_STATUSES, type Costume, type CostumeStatus } from '@/lib/types'
import { COSTUME_META, byName, cn, fullName, nowISO, uid } from '@/lib/utils'
import { ColorChip, CostumeBadge, Empty, Field, LocationChip, Modal, PageHeader } from '@/components/ui'

const blank = (location_id: string): Costume => ({
  id: uid(),
  location_id,
  code: '',
  name: '',
  category: '',
  size: 'M',
  status: 'ready',
  attraction_id: null,
  staff_id: null,
  notes: '',
  created_at: nowISO(),
  updated_at: nowISO(),
})

export default function Costumes() {
  const { db, inScope, scope, update, toast } = useStore()
  const L = useLookups()
  const [status, setStatus] = useState<CostumeStatus | 'all' | 'attention'>('all')
  const [att, setAtt] = useState('')
  const [q, setQ] = useState('')
  const [form, setForm] = useState<Costume | null>(null)

  const all = useMemo(() => db.costumes.filter(inScope), [db.costumes, inScope])
  const list = all
    .filter((c) => (status === 'all' ? c.status !== 'retired' : status === 'attention' ? c.status === 'repair' || c.status === 'cleaning' : c.status === status))
    .filter((c) => !att || (att === 'none' ? !c.attraction_id : c.attraction_id === att))
    .filter((c) => {
      const t = q.trim().toLowerCase()
      if (!t) return true
      const who = c.staff_id ? L.staff.get(c.staff_id) : undefined
      return [c.name, c.code, c.category, c.notes, who ? fullName(who) : ''].some((x) => x.toLowerCase().includes(t))
    })
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))

  const count = (s: CostumeStatus) => all.filter((c) => c.status === s).length
  const inUse = all.filter((c) => c.status === 'in_use')

  return (
    <>
      <PageHeader
        title="Costumes"
        subtitle={`${count('ready')} ready · ${count('in_use')} in use · ${count('cleaning')} cleaning · ${count('repair')} need repair`}
        actions={
          <>
            {inUse.length > 0 && (
              <button
                className="btn-secondary"
                onClick={() => {
                  update('costumes', inUse.map((c) => c.id), { status: 'cleaning' })
                  toast(`${inUse.length} costumes sent to cleaning`)
                }}
                title="End of night: everything that was worn goes to cleaning"
              >
                <Sparkles size={16} /> End of night → cleaning ({inUse.length})
              </button>
            )}
            <button className="btn-primary" onClick={() => setForm(blank(scope === 'all' ? sortedLocations(db)[0]?.id ?? '' : scope))}>
              <Plus size={16} /> Add costume
            </button>
          </>
        }
      />

      <div className="card mb-4 flex flex-col gap-3 p-3 sm:p-4">
        <div className="flex flex-wrap justify-center gap-2 md:justify-start">
          <button className="pill-toggle" data-on={status === 'all'} onClick={() => setStatus('all')}>
            All in service <span className="text-bone-dim">{all.filter((c) => c.status !== 'retired').length}</span>
          </button>
          <button className="pill-toggle" data-on={status === 'attention'} onClick={() => setStatus('attention')}>
            Needs attention <span className="text-bone-dim">{count('repair') + count('cleaning')}</span>
          </button>
          {COSTUME_STATUSES.map((s) => (
            <button key={s} className="pill-toggle" data-on={status === s} onClick={() => setStatus(s)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', COSTUME_META[s].dot)} />
              {COSTUME_META[s].label} <span className="text-bone-dim">{count(s)}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-bone-dim" />
            <input className="input pl-9" placeholder="Search costume, code, or who wears it…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input sm:w-56" value={att} onChange={(e) => setAtt(e.target.value)} aria-label="Attraction">
            <option value="">All attractions</option>
            {attractionsFor(db, scope).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            <option value="none">Spares / unassigned</option>
          </select>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card">
          <Empty icon={<Shirt size={28} />} title="No costumes here" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.map((c) => {
            const a = c.attraction_id ? L.attractions.get(c.attraction_id) : undefined
            const who = c.staff_id ? L.staff.get(c.staff_id) : undefined
            const actors = db.staff.filter((s) => s.location_id === c.location_id && s.status === 'active').sort(byName)
            return (
              <div key={c.id} className="card flex flex-col gap-3 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <button className="min-w-0 text-left" onClick={() => setForm(c)}>
                    <div className="font-mono text-[11px] text-bone-dim">{c.code || '—'}</div>
                    <div className="truncate font-semibold hover:text-blood-soft">{c.name}</div>
                    <div className="text-xs text-bone-muted">
                      {c.category || 'Costume'} · size {c.size}
                    </div>
                  </button>
                  <CostumeBadge status={c.status} />
                </div>
                <div className="flex flex-wrap gap-1">
                  {scope === 'all' && <LocationChip location={L.locations.get(c.location_id)} />}
                  {a ? <ColorChip color={a.color}>{a.name}</ColorChip> : <span className="chip bg-white/5 text-bone-muted ring-white/10">Spare</span>}
                </div>
                {c.notes && <p className="text-xs italic text-amber-200/80">{c.notes}</p>}
                <div className="mt-auto grid grid-cols-2 gap-2">
                  <select
                    className="input py-1.5 text-xs"
                    value={c.status}
                    onChange={(e) => update('costumes', c.id, { status: e.target.value as CostumeStatus })}
                    aria-label="Status"
                  >
                    {COSTUME_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {COSTUME_META[s].label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input py-1.5 text-xs"
                    value={c.staff_id ?? ''}
                    onChange={(e) => update('costumes', c.id, { staff_id: e.target.value || null })}
                    aria-label="Assigned to"
                  >
                    <option value="">Unassigned</option>
                    {actors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {fullName(s)}
                      </option>
                    ))}
                  </select>
                </div>
                {who && (
                  <Link href={`/staff/${who.id}`} className="-mt-1 text-xs text-bone-muted hover:text-bone">
                    Worn by <b className="text-bone">{fullName(who)}</b>
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}

      {form && <CostumeForm initial={form} onClose={() => setForm(null)} />}
    </>
  )
}

function CostumeForm({ initial, onClose }: { initial: Costume; onClose: () => void }) {
  const { db, insert, update, remove, toast } = useStore()
  const [c, setC] = useState(initial)
  const isNew = !db.costumes.some((x) => x.id === initial.id)
  const set = <K extends keyof Costume>(k: K, v: Costume[K]) => setC((p) => ({ ...p, [k]: v }))
  const save = () => {
    if (!c.name.trim()) return toast('Give the costume a name', 'error')
    if (isNew) insert('costumes', c)
    else {
      const { id, created_at, ...patch } = c
      void created_at
      update('costumes', id, patch)
    }
    toast(isNew ? 'Costume added' : 'Saved')
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Add costume' : 'Edit costume'}
      footer={
        <>
          {!isNew && (
            <button
              className="btn-ghost mr-auto text-rose-300"
              onClick={() => {
                if (!window.confirm(`Delete ${c.name}? This can't be undone — use "Retired" to keep its record.`)) return
                remove('costumes', c.id)
                toast('Costume deleted')
                onClose()
              }}
            >
              <Trash2 size={15} /> Delete
            </button>
          )}
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save}>
            Save
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          <input className="input" value={c.name} onChange={(e) => set('name', e.target.value)} placeholder="Tattered clown jumpsuit" autoFocus />
        </Field>
        <Field label="Tag / code">
          <input className="input font-mono" value={c.code} onChange={(e) => set('code', e.target.value)} placeholder="BR-CAR-12" />
        </Field>
        <Field label="Category">
          <input className="input" value={c.category} onChange={(e) => set('category', e.target.value)} placeholder="Mask, jumpsuit, robe…" />
        </Field>
        <Field label="Location">
          <select className="input" value={c.location_id} onChange={(e) => setC({ ...c, location_id: e.target.value, attraction_id: null, staff_id: null })}>
            {sortedLocations(db).map((l) => (
              <option key={l.id} value={l.id}>
                {l.full_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Attraction">
          <select className="input" value={c.attraction_id ?? ''} onChange={(e) => set('attraction_id', e.target.value || null)}>
            <option value="">Spare / any</option>
            {attractionsFor(db, c.location_id).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Size">
          <select className="input" value={c.size} onChange={(e) => set('size', e.target.value)}>
            {['XS', 'S', 'M', 'L', 'XL', '2XL', 'One size'].map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select className="input" value={c.status} onChange={(e) => set('status', e.target.value as CostumeStatus)}>
            {COSTUME_STATUSES.map((s) => (
              <option key={s} value={s}>
                {COSTUME_META[s].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea className="input min-h-[70px]" value={c.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Repairs needed, special care…" />
        </Field>
      </div>
    </Modal>
  )
}
