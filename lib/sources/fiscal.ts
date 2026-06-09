import { createClient } from '@supabase/supabase-js'
import { msToLabel } from '../metrics'
import type { FiscalData } from '../types'

interface RawCancelado { impacto_financeiro: number | null; guia_paga: boolean | null }
interface RawDenegado { motivo_categoria: string | null; impacto_financeiro: number | null; guia_paga: boolean | null }
interface FiscalRaw {
  ctesEmitidos: number
  cancelados: RawCancelado[]
  denegados: RawDenegado[]
  slaCicloMs: number | null
  faseMaisLenta: string
}

export function buildFiscalData(raw: FiscalRaw): FiscalData {
  const somaGuia = (arr: { impacto_financeiro: number | null; guia_paga: boolean | null }[]) =>
    arr.reduce((s, c) => s + (c.guia_paga ? (c.impacto_financeiro || 0) : 0), 0)
  const prejuizoIcms = somaGuia(raw.cancelados) + somaGuia(raw.denegados)
  const counts = new Map<string, number>()
  for (const d of raw.denegados) {
    const k = d.motivo_categoria || 'Outro'
    counts.set(k, (counts.get(k) || 0) + 1)
  }
  const motivosDenegacao = [...counts.entries()]
    .map(([motivo, qtd]) => ({ motivo, qtd })).sort((a, b) => b.qtd - a.qtd)
  return {
    ctesEmitidos: raw.ctesEmitidos,
    cancelados: raw.cancelados.length,
    denegados: raw.denegados.length,
    prejuizoIcms,
    motivosDenegacao,
    slaCicloLabel: msToLabel(raw.slaCicloMs),
    faseMaisLenta: raw.faseMaisLenta,
  }
}

// I/O: puxa o raw das fontes. slaCicloMs/faseMaisLenta vêm de lib/sources/sla.ts (passados pelo aggregate).
export async function fetchFiscalRaw(fromISO: string, toISO: string): Promise<Omit<FiscalRaw, 'slaCicloMs' | 'faseMaisLenta'>> {
  const sb = createClient(process.env.FISCAL_SUPABASE_URL!, process.env.FISCAL_SUPABASE_SERVICE_KEY!)
  const [{ data: cancelados }, { data: denegados }] = await Promise.all([
    sb.from('ctes_cancelados').select('impacto_financeiro, guia_paga').gte('data_cancelamento', fromISO).lte('data_cancelamento', toISO),
    sb.from('ctes_denegados').select('motivo_categoria, impacto_financeiro, guia_paga').gte('data_denegacao', fromISO).lte('data_denegacao', toISO),
  ])
  const ctesEmitidos = await fetchEmitidosCount(fromISO, toISO)
  return { ctesEmitidos, cancelados: cancelados || [], denegados: denegados || [] }
}

// SIIMP: conta CT-es emitidos (autorizados) no período. Alinhado com
// transfast-fiscal/lib/siimp.ts (siimpGet): auth via x-api-key header,
// env vars SIIMP_URL + SIIMP_API_KEY, path /ctes/search, resposta json.total.
// Status autorizado não confirmado no cliente real — mantido via SIIMP_STATUS_AUTORIZADO (default '1').
// Datas: cancelled usa updated_from/updated_to; emitidos usa issued_from/issued_to
// (issued_at é o campo de emissão em SimpiCteRaw) — ajustar se a API usar outro nome.
async function fetchEmitidosCount(fromISO: string, toISO: string): Promise<number> {
  const status = process.env.SIIMP_STATUS_AUTORIZADO || '1'
  const baseUrl = (process.env.SIIMP_URL || '').replace(/\/$/, '')
  const q = new URLSearchParams({
    status,
    issued_from: fromISO.slice(0, 10),
    issued_to: toISO.slice(0, 10),
    limit: '1',
  })
  const url = `${baseUrl}/ctes/search?${q}`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-api-key': process.env.SIIMP_API_KEY!,
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`SIIMP emitidos ${res.status}: ${body.slice(0, 300)}`)
  }
  const json: any = await res.json()
  return Number(json?.total ?? 0)
}
