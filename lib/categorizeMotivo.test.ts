import { describe, it, expect } from 'vitest'
import { categorizeMotivo, CATEGORIAS } from './categorizeMotivo'

describe('categorizeMotivo', () => {
  it('mapeia mecânico', () => {
    expect(categorizeMotivo('veiculo quebrou e teve transbordo')).toBe('Transbordo') // transbordo tem prioridade
    expect(categorizeMotivo('Problema Mecanico')).toBe('Mecânico / veículo')
    expect(categorizeMotivo('Teve problema com Bateria')).toBe('Mecânico / veículo')
  })
  it('mapeia prazo/trânsito', () => {
    expect(categorizeMotivo('prazo muit curto, motorista tinha 4 entregas distantes')).toBe('Prazo curto / trânsito')
    expect(categorizeMotivo('Tempo Curto Para Entrega - Pegou Muito Transito')).toBe('Prazo curto / trânsito')
  })
  it('mapeia cliente/agendamento', () => {
    expect(categorizeMotivo('cliente não tinha como receber e motorista ficou esperando')).toBe('Cliente / agendamento')
  })
  it('vazio ou desconhecido vira Outros', () => {
    expect(categorizeMotivo('')).toBe('Outros')
    expect(categorizeMotivo('xyz aleatório')).toBe('Outros')
  })
  it('CATEGORIAS expõe a ordem de exibição', () => {
    expect(CATEGORIAS[0]).toBe('Mecânico / veículo')
  })
})
