import { DatabaseSync } from 'node:sqlite'

// Minimal Cloudflare D1 on node:sqlite for tests: prepare/bind/first/all/run + batch.
export function d1() {
  const db = new DatabaseSync(':memory:')
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } } }
  })
  return { prepare: sql => stmt(sql), batch: async list => Promise.all(list.map(s => s.run())) }
}
