import { describe, it, expect } from 'vitest'
import { pontualidade, mediaMs, msToLabel, rankOcorrencias } from './metrics'

describe('metrics', () => {
  it('pontualidade = (noPrazo+antecipadas)/total arredondado', () => {
    expect(pontualidade({ total: 142, noPrazo: 107, antecipadas: 24 })).toBe(92)
    expect(pontualidade({ total: 0, noPrazo: 0, antecipadas: 0 })).toBe(0)
  })
  it('mediaMs ignora nulos', () => {
    expect(mediaMs([1000, 3000, null])).toBe(2000)
    expect(mediaMs([null])).toBeNull()
  })
  it('msToLabel formata', () => {
    expect(msToLabel(9 * 60000)).toBe('9min')
    expect(msToLabel((3 * 3600 + 42 * 60) * 1000)).toBe('3h42')
    expect(msToLabel((32 * 3600) * 1000)).toBe('1d 8h')
    expect(msToLabel(null)).toBe('—')
  })
  it('rankOcorrencias conta e calcula %', () => {
    const r = rankOcorrencias(['Mecânico / veículo', 'Mecânico / veículo', 'Transbordo'])
    expect(r[0]).toEqual({ categoria: 'Mecânico / veículo', qtd: 2, pct: 67 })
    expect(r[1]).toEqual({ categoria: 'Transbordo', qtd: 1, pct: 33 })
  })
})
