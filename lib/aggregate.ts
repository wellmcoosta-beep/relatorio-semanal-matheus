import { previousWeekWindow } from './dateWindow'
import { buildFiscalData, fetchFiscalRaw } from './sources/fiscal'
import { buildSuporteData, fetchSuporteRows } from './sources/suporte'
import { buildCloserData, fetchCloserRaw } from './sources/closer'
import { buildSlaData, fetchSlaRaw } from './sources/sla'
import type { RelatorioSemanal } from './types'

interface Injected {
  fiscalRaw: Awaited<ReturnType<typeof fetchFiscalRaw>>
  suporteRows: string[][]
  closerRaw: Awaited<ReturnType<typeof fetchCloserRaw>>
  slaRaw: Awaited<ReturnType<typeof fetchSlaRaw>>
}

/** Se `injected` vier, usa os dados (testes). Senão, puxa tudo das fontes. */
export async function buildRelatorio(ref: Date, injected?: Injected): Promise<RelatorioSemanal> {
  const w = previousWeekWindow(ref)
  const data = injected ?? await pullAll(w.fromISO, w.toISO)
  const sla = buildSlaData(data.slaRaw)
  return {
    semanaLabel: w.label,
    fiscal: buildFiscalData({ ...data.fiscalRaw, slaCicloMs: sla.slaCicloMs, faseMaisLenta: sla.faseMaisLenta }),
    suporte: buildSuporteData(data.suporteRows, w),
    closer: buildCloserData(data.closerRaw),
  }
}

async function pullAll(fromISO: string, toISO: string): Promise<Injected> {
  const [fiscalRaw, suporteRows, closerRaw, slaRaw] = await Promise.all([
    fetchFiscalRaw(fromISO, toISO), fetchSuporteRows(), fetchCloserRaw(fromISO, toISO), fetchSlaRaw(fromISO, toISO),
  ])
  return { fiscalRaw, suporteRows, closerRaw, slaRaw }
}
