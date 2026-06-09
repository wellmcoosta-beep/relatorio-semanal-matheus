import { describe, it, expect } from 'vitest'
import { buildRelatorio } from './aggregate'

describe('buildRelatorio', () => {
  it('monta o modelo a partir das fontes injetadas e da janela', async () => {
    const rel = await buildRelatorio(new Date('2026-06-08T11:00:00Z'), {
      fiscalRaw: { ctesEmitidos: 312, cancelados: [], denegados: [] },
      suporteRows: [],
      closerRaw: { cargas: [] },
      slaRaw: { phases: [{ phaseName: 'Entrega', averageDurationMs: 3600000 }] },
    })
    expect(rel.semanaLabel).toBe('01–07 jun 2026')
    expect(rel.fiscal.ctesEmitidos).toBe(312)
    expect(rel.fiscal.faseMaisLenta).toBe('Entrega · 1h')
    expect(rel.suporte.viagens).toBe(0)
  })
})
