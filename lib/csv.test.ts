import { describe, it, expect } from 'vitest'
import { parseCsv } from './csv'

describe('parseCsv', () => {
  it('parseia campos simples', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([['a','b','c'],['1','2','3']])
  })
  it('respeita aspas com vírgula dentro', () => {
    expect(parseCsv('x,"vírgula, aqui",z')).toEqual([['x','vírgula, aqui','z']])
  })
  it('aspas escapadas ("") e quebra de linha dentro de aspas', () => {
    expect(parseCsv('"linha\n2","ele disse ""oi"""')).toEqual([['linha\n2','ele disse "oi"']])
  })
  it('ignora \\r e linha final vazia', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a','b'],['1','2']])
  })
})
