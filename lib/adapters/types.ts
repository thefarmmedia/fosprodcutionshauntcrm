import type { DB, Row, TableName } from '../types'

export type ChangeEvent =
  | { type: 'reload'; db: DB }
  | { type: 'upsert'; table: TableName; row: { id: string } & Record<string, unknown> }
  | { type: 'delete'; table: TableName; id: string }

/**
 * Storage backend. "demo" keeps everything in this browser's localStorage;
 * "live" talks to Supabase so every manager at both locations sees the same data.
 */
export interface Adapter {
  mode: 'demo' | 'live'
  load(): Promise<DB>
  insert<T extends TableName>(table: T, rows: Row<T>[]): Promise<void>
  update<T extends TableName>(table: T, ids: string[], patch: Partial<Row<T>>): Promise<void>
  remove(table: TableName, ids: string[]): Promise<void>
  subscribe(cb: (e: ChangeEvent) => void): () => void
}
