import { createClient } from '@supabase/supabase-js'
import { mediaMs, msToLabel } from '../metrics'
import type { CloserData } from '../types'

interface RawCarga {
  frete_motorista_closer: number | null
  cc_gerada: number | null
  // baseElegivel: frete_motorista_comercial for non-excluded cargas (mirrors cotações dashboard denominator), 0 for excluded ones.
  baseElegivel: number
  created_at: string
  postada_em: string | null
  motorista_registrado_em: string | null
}

const deltaMs = (a: string | null, b: string | null): number | null =>
  a && b ? Date.parse(a) - Date.parse(b) : null

export function buildCloserData(raw: { cargas: RawCarga[] }): CloserData {
  const cargas = raw.cargas
  const totalContratado = cargas.reduce((s, c) => s + (c.frete_motorista_closer || 0), 0)
  const economizadoValor = cargas.reduce((s, c) => s + (c.cc_gerada || 0), 0)
  const base = cargas.reduce((s, c) => s + (c.baseElegivel || 0), 0)
  const economizadoPct = base > 0 ? Math.round((economizadoValor / base) * 100) : 0
  const slaPostagem = mediaMs(cargas.map((c) => deltaMs(c.postada_em, c.created_at)))
  const slaFechamento = mediaMs(cargas.map((c) => deltaMs(c.motorista_registrado_em, c.created_at)))
  return {
    totalContratado, economizadoValor, economizadoPct,
    slaPostagemLabel: msToLabel(slaPostagem),
    slaFechamentoLabel: msToLabel(slaFechamento),
  }
}

// ── eligibility: mirrors isFreteFixoExcluido from transfast-cotacoes/lib/closer-calc.ts ──
// From jun/2026 onward the gestor flag (pago_antt_minimo) is the sole "piso" signal;
// before jun/2026 the heuristic (piso > 85% of comercial, or margem < gatePct) also excluded.
// Because this relatorio fetches the current week (always >= jun/2026) the heuristic branch
// is unreachable in practice — only the "hard exclusions" apply:
//   • motorista_nome === 'NO-SHOW'
//   • pago_antt_minimo === true
//   • cliente Selbetti + frete_empresa === 1700
// Cargas excluded from the denominator still contribute their cc_gerada to the numerator
// (by design in the cotações dashboard). We reflect this by setting baseElegivel=0 for them.
const GATE_PCT = 5.25
const VIGENCIA_PISO_GESTOR = '2026-06'

function isMargemRestrita(c: {
  frete_motorista_comercial: number | null
  antt_piso_total: number | null
  qualp_pedagio: number | null
}): boolean {
  const piso = Number(c.antt_piso_total)
  if (!piso) return false
  const comercial = Number(c.frete_motorista_comercial || 0)
  if (!comercial) return false
  if (c.qualp_pedagio != null) {
    const pisoReal = piso + Number(c.qualp_pedagio)
    return (comercial - pisoReal) < comercial * (GATE_PCT / 100)
  }
  return (piso / comercial) > 0.85
}

function isEligivel(c: {
  motorista_nome: string | null
  pago_antt_minimo: boolean | null
  cliente: string | null
  frete_empresa: number | null
  frete_motorista_comercial: number | null
  antt_piso_total: number | null
  qualp_pedagio: number | null
  mes: string | null
}): boolean {
  // Hard exclusions — always apply
  if (c.motorista_nome === 'NO-SHOW') return false
  if (c.pago_antt_minimo === true) return false
  if (
    String(c.cliente || '').toLowerCase().includes('selbetti') &&
    Number(c.frete_empresa) === 1700
  ) return false
  // Historical: before jun/2026 the margin heuristic also excludes.
  // Weeks in this report are always >= jun/2026, but handle gracefully.
  const mes = c.mes
  if (mes && mes < VIGENCIA_PISO_GESTOR) {
    if (isMargemRestrita(c)) return false
  }
  return true
}

// I/O: cargas contratadas na semana (motorista registrado no período).
// Joins cotacoes for eligibility fields: pago_antt_minimo, motorista_nome,
// antt_piso_total, qualp_pedagio, data_coleta, cliente, frete_empresa.
// If motorista_registrado_em column does not yet exist the fallback path handles it.
export async function fetchCloserRaw(fromISO: string, toISO: string): Promise<{ cargas: RawCarga[] }> {
  const sb = createClient(
    process.env.COTACOES_SUPABASE_URL!,
    process.env.COTACOES_SUPABASE_SERVICE_KEY!
  )

  const baseSelect = [
    'frete_motorista_closer',
    'cc_gerada',
    'frete_motorista_comercial',
    'pago_antt_minimo',
    'motorista_nome',
    'mes',
    'created_at',
    'postada_em',
    'cotacoes(antt_piso_total, qualp_pedagio, data_coleta, cliente, frete_empresa)',
  ].join(', ')

  type Row = {
    frete_motorista_closer: number | null
    cc_gerada: number | null
    frete_motorista_comercial: number | null
    pago_antt_minimo: boolean | null
    motorista_nome: string | null
    mes: string | null
    created_at: string
    postada_em: string | null
    motorista_registrado_em?: string | null
    cotacoes: {
      antt_piso_total: number | null
      qualp_pedagio: number | null
      data_coleta: string | null
      cliente: string | null
      frete_empresa: number | null
    } | null
  }

  const run = async (withTimestamp: boolean): Promise<Row[]> => {
    const select = withTimestamp ? baseSelect + ', motorista_registrado_em' : baseSelect
    const q = sb
      .from('closer_cargas')
      .select(select)
      .eq('motorista_registrado', true)
    const { data, error } = withTimestamp
      ? await q.gte('motorista_registrado_em', fromISO).lte('motorista_registrado_em', toISO)
      : await q.gte('created_at', fromISO).lte('created_at', toISO)
    if (error) throw error
    return (data || []) as unknown as Row[]
  }

  let rows: Row[]
  let hasTimestamp = true
  try {
    rows = await run(true)
  } catch (err: any) {
    if (/motorista_registrado_em/.test(String(err?.message))) {
      rows = await run(false)
      hasTimestamp = false
    } else {
      throw err
    }
  }

  return {
    cargas: rows.map((c) => mapBase(c, hasTimestamp)),
  }
}

function mapBase(c: {
  frete_motorista_closer: number | null
  cc_gerada: number | null
  frete_motorista_comercial: number | null
  pago_antt_minimo: boolean | null
  motorista_nome: string | null
  mes: string | null
  created_at: string
  postada_em: string | null
  motorista_registrado_em?: string | null
  cotacoes: {
    antt_piso_total: number | null
    qualp_pedagio: number | null
    data_coleta: string | null
    cliente: string | null
    frete_empresa: number | null
  } | null
}, hasTimestamp: boolean): RawCarga {
  const cot = c.cotacoes
  const eligible = isEligivel({
    motorista_nome: c.motorista_nome,
    pago_antt_minimo: c.pago_antt_minimo,
    cliente: cot?.cliente ?? null,
    frete_empresa: cot?.frete_empresa ?? null,
    frete_motorista_comercial: c.frete_motorista_comercial,
    antt_piso_total: cot?.antt_piso_total ?? null,
    qualp_pedagio: cot?.qualp_pedagio ?? null,
    mes: c.mes,
  })
  // baseElegivel = frete_motorista_comercial for eligible cargas, 0 for excluded ones.
  // This mirrors the dashboard denominator: totalContratado = sum(frete_motorista_comercial) over !isFreteFixoExcluido.
  const baseElegivel = eligible ? Number(c.frete_motorista_comercial || 0) : 0
  return {
    frete_motorista_closer: c.frete_motorista_closer,
    cc_gerada: c.cc_gerada,
    baseElegivel,
    created_at: c.created_at,
    postada_em: c.postada_em ?? null,
    motorista_registrado_em: hasTimestamp ? (c.motorista_registrado_em ?? null) : null,
  }
}
