import { buildSeed } from '../seed'
import { emptyDB, TABLES, type DB, type Row, type TableName } from '../types'
import type { Adapter, ChangeEvent } from './types'

export const LOCAL_KEY = 'fos-productions-db-v1'

/** Demo-mode backend: the whole database lives in localStorage on this device. */
export function createLocalAdapter(): Adapter {
  let db: DB = emptyDB()
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  const save = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(db))
      } catch (err) {
        console.error('Could not save demo data', err)
      }
    }, 150)
  }

  const read = (): DB | null => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<DB>
      const out = emptyDB()
      for (const t of TABLES) (out[t] as unknown[]) = Array.isArray(parsed[t]) ? (parsed[t] as unknown[]) : []
      return out
    } catch {
      return null
    }
  }

  return {
    mode: 'demo',
    async load() {
      db = read() ?? buildSeed()
      save()
      return structuredClone(db)
    },
    async insert<T extends TableName>(table: T, rows: Row<T>[]) {
      const list = db[table] as Row<T>[]
      for (const r of rows) {
        const i = list.findIndex((x) => x.id === r.id)
        if (i >= 0) list[i] = r
        else list.push(r)
      }
      save()
    },
    async update<T extends TableName>(table: T, ids: string[], patch: Partial<Row<T>>) {
      const set = new Set(ids)
      ;(db[table] as Row<T>[]) = (db[table] as Row<T>[]).map((r) => (set.has(r.id) ? { ...r, ...patch } : r))
      save()
    },
    async remove(table: TableName, ids: string[]) {
      const set = new Set(ids)
      ;(db[table] as { id: string }[]) = (db[table] as { id: string }[]).filter((r) => !set.has(r.id))
      save()
    },
    subscribe(cb: (e: ChangeEvent) => void) {
      // Keep two tabs on the same computer in sync (e.g. check-in on one, dashboard on the other).
      const onStorage = (e: StorageEvent) => {
        if (e.key !== LOCAL_KEY) return
        const next = read()
        if (next) {
          db = next
          cb({ type: 'reload', db: structuredClone(next) })
        }
      }
      window.addEventListener('storage', onStorage)
      return () => window.removeEventListener('storage', onStorage)
    },
  }
}

export function resetLocal(withDemo: boolean) {
  const db = withDemo ? buildSeed() : { ...emptyDB(), ...pickSetup(buildSeed()) }
  localStorage.setItem(LOCAL_KEY, JSON.stringify(db))
}

/** Keep locations, attractions and groups; drop everything else. */
function pickSetup(db: DB): Partial<DB> {
  return { locations: db.locations, attractions: db.attractions, groups: db.groups }
}
