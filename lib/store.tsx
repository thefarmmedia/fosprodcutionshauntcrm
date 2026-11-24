'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { createLocalAdapter } from './adapters/local'
import { createSupabaseAdapter, getSupabase, supabaseConfigured } from './adapters/supabase'
import type { Adapter, ChangeEvent } from './adapters/types'
import { emptyDB, type DB, type ID, type Row, type TableName } from './types'
import { cn, nowISO, uid } from './utils'

export type Scope = 'all' | ID
type Toast = { id: string; text: string; kind: 'ok' | 'error' }

interface Store {
  db: DB
  ready: boolean
  error: string | null
  mode: 'demo' | 'live'
  session: Session | null
  userLabel: string
  scope: Scope
  setScope: (s: Scope) => void
  inScope: (row: { location_id: ID | null }) => boolean
  insert: <T extends TableName>(table: T, rows: Row<T> | Row<T>[]) => void
  update: <T extends TableName>(table: T, ids: ID | ID[], patch: Partial<Row<T>>) => void
  remove: (table: TableName, ids: ID | ID[]) => void
  toast: (text: string, kind?: Toast['kind']) => void
  signOut: () => Promise<void>
  reload: () => Promise<void>
}

const Ctx = createContext<Store | null>(null)
const SCOPE_KEY = 'fos-scope'

const withTimestamps = (table: TableName, patch: Record<string, unknown>) =>
  table === 'staff' || table === 'costumes' ? { ...patch, updated_at: nowISO() } : patch

export function DataProvider({ children }: { children: ReactNode }) {
  const adapterRef = useRef<Adapter | null>(null)
  const [db, setDb] = useState<DB>(emptyDB)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [authChecked, setAuthChecked] = useState(!supabaseConfigured)
  const [scope, setScopeState] = useState<Scope>('all')
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const id = uid()
    setToasts((t) => [...t, { id, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 2800)
  }, [])

  useEffect(() => {
    try {
      const s = localStorage.getItem(SCOPE_KEY)
      if (s) setScopeState(s)
    } catch {}
  }, [])

  const setScope = useCallback((s: Scope) => {
    setScopeState(s)
    try {
      localStorage.setItem(SCOPE_KEY, s)
    } catch {}
  }, [])

  // Auth (live mode only)
  useEffect(() => {
    const sb = getSupabase()
    if (!sb) return
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthChecked(true)
    })
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const apply = useCallback((e: ChangeEvent) => {
    if (e.type === 'reload') return setDb(e.db)
    setDb((prev) => {
      const list = prev[e.table] as { id: string }[]
      if (e.type === 'delete') return { ...prev, [e.table]: list.filter((r) => r.id !== e.id) }
      const i = list.findIndex((r) => r.id === e.row.id)
      const next = i >= 0 ? list.map((r, j) => (j === i ? (e.row as typeof r) : r)) : [...list, e.row]
      return { ...prev, [e.table]: next }
    })
  }, [])

  const load = useCallback(async () => {
    const adapter = adapterRef.current
    if (!adapter) return
    try {
      setDb(await adapter.load())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load data')
    } finally {
      setReady(true)
    }
  }, [])

  // Load data once we know who's signed in
  useEffect(() => {
    if (!authChecked) return
    if (supabaseConfigured && !session) {
      setReady(true)
      return
    }
    const adapter = supabaseConfigured ? createSupabaseAdapter() : createLocalAdapter()
    adapterRef.current = adapter
    setReady(false)
    load()
    return adapter.subscribe(apply)
  }, [authChecked, session?.user?.id, apply, load]) // eslint-disable-line react-hooks/exhaustive-deps

  const fail = useCallback(
    (err: unknown) => {
      toast(err instanceof Error ? err.message : 'Save failed', 'error')
      load()
    },
    [load, toast],
  )

  const insert = useCallback(
    <T extends TableName>(table: T, rows: Row<T> | Row<T>[]) => {
      const list = Array.isArray(rows) ? rows : [rows]
      if (!list.length) return
      setDb((prev) => {
        const ids = new Set(list.map((r) => r.id))
        return { ...prev, [table]: [...(prev[table] as Row<T>[]).filter((r) => !ids.has(r.id)), ...list] }
      })
      adapterRef.current?.insert(table, list).catch(fail)
    },
    [fail],
  )

  const update = useCallback(
    <T extends TableName>(table: T, ids: ID | ID[], patch: Partial<Row<T>>) => {
      const list = Array.isArray(ids) ? ids : [ids]
      if (!list.length) return
      const full = withTimestamps(table, patch as Record<string, unknown>) as Partial<Row<T>>
      const set = new Set(list)
      setDb((prev) => ({ ...prev, [table]: (prev[table] as Row<T>[]).map((r) => (set.has(r.id) ? { ...r, ...full } : r)) }))
      adapterRef.current?.update(table, list, full).catch(fail)
    },
    [fail],
  )

  const remove = useCallback(
    (table: TableName, ids: ID | ID[]) => {
      const list = Array.isArray(ids) ? ids : [ids]
      if (!list.length) return
      const set = new Set(list)
      setDb((prev) => ({ ...prev, [table]: (prev[table] as { id: string }[]).filter((r) => !set.has(r.id)) }))
      adapterRef.current?.remove(table, list).catch(fail)
    },
    [fail],
  )

  const inScope = useCallback((row: { location_id: ID | null }) => scope === 'all' || !row.location_id || row.location_id === scope, [scope])

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut()
  }, [])

  const value = useMemo<Store>(
    () => ({
      db,
      ready: ready && authChecked,
      error,
      mode: supabaseConfigured ? 'live' : 'demo',
      session,
      userLabel: session?.user?.email ?? 'Demo manager',
      scope,
      setScope,
      inScope,
      insert,
      update,
      remove,
      toast,
      signOut,
      reload: load,
    }),
    [db, ready, authChecked, error, session, scope, setScope, inScope, insert, update, remove, toast, signOut, load],
  )

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto max-w-md rounded-xl px-4 py-2.5 text-sm font-medium shadow-2xl ring-1 backdrop-blur animate-in',
              t.kind === 'error' ? 'bg-rose-950/95 text-rose-100 ring-rose-500/40' : 'bg-ink-800/95 text-bone ring-white/10',
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used inside <DataProvider>')
  return ctx
}
