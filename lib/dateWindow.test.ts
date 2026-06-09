import { describe, it, expect } from 'vitest'
import { previousWeekWindow } from './dateWindow'

describe('previousWeekWindow', () => {
  it('numa segunda, retorna seg→dom da semana anterior em BRT', () => {
    // ref: segunda 2026-06-08 08:00 BRT
    const w = previousWeekWindow(new Date('2026-06-08T11:00:00Z'))
    // semana anterior = 01/06 (seg) 00:00 BRT até 07/06 (dom) 23:59:59.999 BRT
    expect(w.fromISO).toBe('2026-06-01T03:00:00.000Z') // 00:00 BRT = 03:00 UTC
    expect(w.toISO).toBe('2026-06-08T02:59:59.999Z')   // 23:59:59.999 BRT do dia 07
    expect(w.label).toBe('01–07 jun 2026')
  })
})
