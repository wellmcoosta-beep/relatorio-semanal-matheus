import { describe, it, expect } from 'vitest'
import { buildFiscalData } from './fiscal'

describe('buildFiscalData', () => {
  it('agrega contagens, prejuízo e motivos', () => {
    const out = buildFiscalData({
      ctesEmitidos: 312,
      cancelados: [{ impacto_financeiro: 4120, guia_paga: true }, { impacto_financeiro: 0, guia_paga: false }],
      denegados: [
        { motivo_categoria: 'Serviço não prestado', impacto_financeiro: 880, guia_paga: true },
        { motivo_categoria: 'Serviço não prestado', impacto_financeiro: 0, guia_paga: false },
        { motivo_categoria: null, impacto_financeiro: null, guia_paga: null },
      ],
      slaCicloMs: 32 * 3600 * 1000,
      faseMaisLenta: 'Averbação · 9h',
    })
    expect(out.ctesEmitidos).toBe(312)
    expect(out.cancelados).toBe(2)
    expect(out.denegados).toBe(3)
    expect(out.prejuizoIcms).toBe(5000)
    expect(out.motivosDenegacao).toEqual([
      { motivo: 'Serviço não prestado', qtd: 2 },
      { motivo: 'Outro', qtd: 1 },
    ])
    expect(out.slaCicloLabel).toBe('1d 8h')
  })
})
