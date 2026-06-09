import { google } from 'googleapis'
import { DateTime } from 'luxon'
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

// I/O: lê a aba de registro via Google Sheets API (service account).
export async function fetchSuporteRows(): Promise<Row[]> {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!)
  const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] })
  const sheets = google.sheets({ version: 'v4', auth })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: 'A2:H', // pula o cabeçalho da aba de registro
  })
  return (res.data.values as Row[]) || []
}
