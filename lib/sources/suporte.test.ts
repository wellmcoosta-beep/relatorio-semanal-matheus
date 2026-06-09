import { describe, it, expect } from 'vitest'
import { buildSuporteData } from './suporte'

const rows = [
  // [Data Coleta, CTE, Cliente, Previsão, Data entrega, Status, Motivo do Atraso]
  ['03/06/2026', '7361', 'BIOMA', '04/06/2026', '04/06/2026', 'NO PRAZO', ''],
  ['03/06/2026', '7362', 'BIOMA', '05/06/2026', '04/06/2026', 'ANTECIPADA', ''],
  ['03/06/2026', '7364', 'BIOMA', '04/06/2026', '06/06/2026', 'ATRASADA', 'Teve problema com Bateria'],
  ['03/06/2026', '7222', 'MANUF', '04/06/2026', '06/06/2026', 'ATRASADA', 'veiculo quebrou e teve transbordo'],
  // fora da janela:
  ['20/05/2026', '7000', 'X', '21/05/2026', '21/05/2026', 'NO PRAZO', ''],
]

describe('buildSuporteData', () => {
  it('conta só entregas na janela e ranqueia ocorrências', () => {
    const out = buildSuporteData(rows, { fromISO: '2026-06-01T03:00:00.000Z', toISO: '2026-06-08T02:59:59.999Z' })
    expect(out.viagens).toBe(4)
    expect(out.noPrazo).toBe(1)
    expect(out.antecipadas).toBe(1)
    expect(out.atrasadas).toBe(2)
    expect(out.pontualidadePct).toBe(50) // (1+1)/4
    expect(out.ocorrencias[0].categoria).toBe('Mecânico / veículo')
    expect(out.ocorrencias.map(o => o.categoria)).toContain('Transbordo')
    expect(out.ocorrencias.find(o => o.categoria === 'Mecânico / veículo')?.qtd).toBe(1)
    expect(out.ocorrencias.find(o => o.categoria === 'Transbordo')?.qtd).toBe(1)
    expect(out.ocorrencias).toHaveLength(2)
  })
})
