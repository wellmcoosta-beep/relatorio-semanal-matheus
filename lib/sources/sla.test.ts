import { describe, it, expect } from 'vitest'
import { buildSlaData } from './sla'

describe('buildSlaData', () => {
  it('soma a duração média de todas as fases e acha a mais lenta', () => {
    const out = buildSlaData({
      phases: [
        { phaseName: 'Averbação', averageDurationMs: 9 * 3600 * 1000 },
        { phaseName: 'Embarque', averageDurationMs: 5 * 3600 * 1000 },
        { phaseName: 'Entrega', averageDurationMs: 18 * 3600 * 1000 },
      ],
    })
    expect(out.slaCicloMs).toBe(32 * 3600 * 1000)
    expect(out.faseMaisLenta).toBe('Entrega · 18h')
  })
})
