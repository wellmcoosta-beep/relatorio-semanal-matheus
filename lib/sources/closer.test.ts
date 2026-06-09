import { describe, it, expect } from 'vitest'
import { buildCloserData } from './closer'

describe('buildCloserData', () => {
  it('soma contratado, economizado %/R$ e formata SLAs', () => {
    const out = buildCloserData({
      cargas: [
        { frete_motorista_closer: 300000, cc_gerada: 30000, baseElegivel: 270000, created_at: '2026-06-02T12:00:00Z', postada_em: '2026-06-02T12:09:00Z', motorista_registrado_em: '2026-06-02T15:42:00Z' },
        { frete_motorista_closer: 187000, cc_gerada: 23000, baseElegivel: 210000, created_at: '2026-06-03T10:00:00Z', postada_em: '2026-06-03T10:09:00Z', motorista_registrado_em: null },
      ],
    })
    expect(out.totalContratado).toBe(487000)
    expect(out.economizadoValor).toBe(53000)
    expect(out.economizadoPct).toBe(11) // 53000 / (270000+210000) = 11%
    expect(out.slaPostagemLabel).toBe('9min')
    expect(out.slaFechamentoLabel).toBe('3h42') // só a carga com timestamp
  })
  it('SLA fechamento vira "—" quando ninguém tem timestamp', () => {
    const out = buildCloserData({ cargas: [{ frete_motorista_closer: 1000, cc_gerada: 0, baseElegivel: 0, created_at: '2026-06-02T12:00:00Z', postada_em: null, motorista_registrado_em: null }] })
    expect(out.slaFechamentoLabel).toBe('—')
  })
})
