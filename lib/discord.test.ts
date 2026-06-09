import { describe, it, expect } from 'vitest'
import { buildDiscordForm } from './discord'

describe('buildDiscordForm', () => {
  it('monta multipart com arquivo e mensagem', () => {
    const fd = buildDiscordForm(Buffer.from('pdf'), 'relatorio.pdf', '01–07 jun 2026')
    expect(fd.get('payload_json')).toContain('Relatório Semanal')
    expect(fd.has('files[0]')).toBe(true)
  })
})
