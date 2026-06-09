import { DateTime } from 'luxon'
import { parseCsv } from '../csv'
import { categorizeMotivo } from '../categorizeMotivo'
import { pontualidade, rankOcorrencias } from '../metrics'
import type { SuporteData } from '../types'

type Row = string[]
const ZONE = 'America/Sao_Paulo'

// Índices das colunas na aba de registro
const C = { dataEntrega: 4, status: 5, motivo: 6 }

function dentroDaJanela(dataEntregaBR: string, fromISO: string, toISO: string): boolean {
  const d = DateTime.fromFormat(dataEntregaBR.trim(), 'dd/MM/yyyy', { zone: ZONE })
  if (!d.isValid) return false
  const ms = d.toUTC().toMillis()
  return ms >= Date.parse(fromISO) && ms <= Date.parse(toISO)
}

export function buildSuporteData(rows: Row[], w: { fromISO: string; toISO: string }): SuporteData {
  const naJanela = rows.filter((r) => dentroDaJanela(r[C.dataEntrega] || '', w.fromISO, w.toISO))
  const status = (r: Row) => (r[C.status] || '').trim().toUpperCase()
  const noPrazo = naJanela.filter((r) => status(r) === 'NO PRAZO').length
  const antecipadas = naJanela.filter((r) => status(r) === 'ANTECIPADA').length
  const atrasadas = naJanela.filter((r) => status(r) === 'ATRASADA').length
  const viagens = naJanela.length
  const cats = naJanela.filter((r) => status(r) === 'ATRASADA').map((r) => categorizeMotivo(r[C.motivo] || ''))
  const ocorrencias = rankOcorrencias(cats)
  return { viagens, noPrazo, antecipadas, atrasadas, pontualidadePct: pontualidade({ total: viagens, noPrazo, antecipadas }), ocorrencias }
}

// I/O: lê a aba de registro como CSV público (planilha compartilhada como link-viewable).
export async function fetchSuporteRows(): Promise<Row[]> {
  const id = process.env.GOOGLE_SHEET_ID!
  const gid = process.env.GOOGLE_SHEET_GID || '0'
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Sheet CSV ${res.status}`)
  const csv = await res.text()
  const rows = parseCsv(csv)
  return rows.slice(1) // remove a linha de cabeçalho (gviz inclui o header)
}
