import { msToLabel } from '../metrics'

interface Phase { phaseName: string; averageDurationMs: number }
export interface SlaData { slaCicloMs: number | null; faseMaisLenta: string }

export function buildSlaData(raw: { phases: Phase[] }): SlaData {
  if (!raw.phases?.length) return { slaCicloMs: null, faseMaisLenta: '—' }
  const slaCicloMs = raw.phases.reduce((s, p) => s + (p.averageDurationMs || 0), 0)
  const lenta = [...raw.phases].sort((a, b) => b.averageDurationMs - a.averageDurationMs)[0]
  return { slaCicloMs, faseMaisLenta: `${lenta.phaseName} · ${msToLabel(lenta.averageDurationMs)}` }
}

// I/O: chama o mesmo endpoint JSON que o dash externo de SLA consome,
// filtrando pela janela da semana (params from/to em data BR).
export async function fetchSlaRaw(fromISO: string, toISO: string): Promise<{ phases: Phase[] }> {
  const url = new URL(process.env.SLA_WEBHOOK_URL!)
  if (process.env.SLA_WEBHOOK_TOKEN) url.searchParams.set('token', process.env.SLA_WEBHOOK_TOKEN)
  url.searchParams.set('from', fromISO.slice(0, 10))
  url.searchParams.set('to', toISO.slice(0, 10))
  const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
  if (!res.ok) throw new Error(`SLA webhook ${res.status}`)
  const json: any = await res.json()
  // Normaliza: o payload usa `averageDurationLabel` no front; aqui precisamos de ms.
  const phases: Phase[] = (json.phases || []).map((p: any) => ({
    phaseName: p.phaseName,
    averageDurationMs: p.averageDurationMs ?? (p.averageDurationMinutes != null ? p.averageDurationMinutes * 60000 : 0),
  }))
  return { phases }
}
