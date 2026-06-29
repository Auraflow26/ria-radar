// [KKR-RIA] Supabase persistence — auraflow-style structured-result upsert.
//
// Zero new dependency: talks to the Supabase REST (PostgREST) endpoint via fetch,
// matching ria-radar's minimal-stack intent. Persistence is OPT-IN — if the env
// is unset the helpers no-op, so the pipeline still runs file-only (graceful
// degradation, same as the no-API-key skeleton path).
//
// Writes use the SERVICE ROLE key (server-side pipeline only); RLS restricts
// writes to service_role. Never ship the service key to a client.

const URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

/** True when persistence is configured. Callers no-op when false. */
export function hasSupabase(): boolean {
  return Boolean(URL && SERVICE_KEY)
}

/**
 * Read all rows of selected columns from a table (PostgREST GET). Returns []
 * when persistence is unconfigured. Read path uses the service key too (the
 * pipeline is server-side); RLS would also allow anon, but we stay consistent.
 */
export async function selectAll<T>(table: string, columns: string): Promise<T[]> {
  if (!hasSupabase()) return []
  const endpoint = `${URL}/rest/v1/${table}?select=${encodeURIComponent(columns)}`
  const res = await fetch(endpoint, {
    headers: { apikey: SERVICE_KEY as string, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Supabase select ${table} → HTTP ${res.status}: ${detail.slice(0, 300)}`)
  }
  return (await res.json()) as T[]
}

/**
 * Upsert rows into a table on the natural-key conflict target (PostgREST
 * `on_conflict`). Resolves silently when persistence is unconfigured; throws
 * only on an actual HTTP error so the caller can log-and-continue.
 */
export async function upsert(table: string, rows: unknown[], onConflict: string): Promise<void> {
  if (!hasSupabase()) return
  if (rows.length === 0) return
  const endpoint = `${URL}/rest/v1/${table}?on_conflict=${onConflict}`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY as string,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      // merge-duplicates = upsert; return=minimal keeps the response small
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Supabase upsert ${table} → HTTP ${res.status}: ${detail.slice(0, 300)}`)
  }
}

/** Plain insert (no conflict target) — for append-only tables like alerts. */
export async function insertRows(table: string, rows: unknown[]): Promise<void> {
  if (!hasSupabase() || rows.length === 0) return
  const res = await fetch(`${URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY as string,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Supabase insert ${table} → HTTP ${res.status}: ${detail.slice(0, 300)}`)
  }
}
