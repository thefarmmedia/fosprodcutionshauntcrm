import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { emptyDB, TABLES, type Row, type TableName } from '../types'
import type { Adapter, ChangeEvent } from './types'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(URL && KEY)

let client: SupabaseClient | null = null
export function getSupabase() {
  if (!supabaseConfigured) return null
  if (!client) client = createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true } })
  return client
}

const PAGE = 1000

/** Live backend: Postgres via Supabase, with realtime so both locations stay in sync. */
export function createSupabaseAdapter(): Adapter {
  const sb = getSupabase()!

  const fail = (what: string, error: { message: string } | null) => {
    if (error) throw new Error(`${what}: ${error.message}`)
  }

  return {
    mode: 'live',
    async load() {
      const db = emptyDB()
      await Promise.all(
        TABLES.map(async (t) => {
          const rows: unknown[] = []
          for (let from = 0; ; from += PAGE) {
            const { data, error } = await sb.from(t).select('*').range(from, from + PAGE - 1)
            fail(`Loading ${t}`, error)
            rows.push(...(data ?? []))
            if (!data || data.length < PAGE) break
          }
          ;(db[t] as unknown[]) = rows
        }),
      )
      return db
    },
    async insert<T extends TableName>(table: T, rows: Row<T>[]) {
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await sb.from(table).upsert(rows.slice(i, i + 500) as never[])
        fail(`Saving ${table}`, error)
      }
    },
    async update<T extends TableName>(table: T, ids: string[], patch: Partial<Row<T>>) {
      const { error } = await sb.from(table).update(patch as never).in('id', ids)
      fail(`Updating ${table}`, error)
    },
    async remove(table: TableName, ids: string[]) {
      const { error } = await sb.from(table).delete().in('id', ids)
      fail(`Deleting from ${table}`, error)
    },
    subscribe(cb: (e: ChangeEvent) => void) {
      const channel = sb
        .channel('fos-db')
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          const table = payload.table as TableName
          if (!TABLES.includes(table)) return
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id?: string }).id
            if (id) cb({ type: 'delete', table, id })
          } else {
            cb({ type: 'upsert', table, row: payload.new as { id: string } })
          }
        })
        .subscribe()
      return () => {
        sb.removeChannel(channel)
      }
    },
  }
}
