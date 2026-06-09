import type { Categoria } from './categorizeMotivo'

export interface FiscalData {
  ctesEmitidos: number
  cancelados: number
  denegados: number
  prejuizoIcms: number
  motivosDenegacao: { motivo: string; qtd: number }[]
  slaCicloLabel: string        // ex: "1d 8h"
  faseMaisLenta: string        // ex: "Averbação · 9h"
}

export interface SuporteData {
  viagens: number
  noPrazo: number
  antecipadas: number
  atrasadas: number
  pontualidadePct: number      // 0–100, inteiro
  ocorrencias: { categoria: Categoria; qtd: number; pct: number }[]
}

export interface CloserData {
  totalContratado: number      // R$ (frete pago ao motorista)
  economizadoValor: number     // R$
  economizadoPct: number       // 0–100
  slaPostagemLabel: string     // ex: "9min"
  slaFechamentoLabel: string   // ex: "3h42" ou "—"
}

export interface RelatorioSemanal {
  semanaLabel: string
  fiscal: FiscalData
  suporte: SuporteData
  closer: CloserData
}
