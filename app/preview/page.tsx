import { renderRelatorioHTML } from '@/lib/render'
import type { RelatorioSemanal } from '@/lib/types'

const fake: RelatorioSemanal = {
  semanaLabel: '01–07 jun 2026',
  fiscal: {
    ctesEmitidos: 312,
    cancelados: 8,
    denegados: 3,
    prejuizoIcms: 4120,
    motivosDenegacao: [
      { motivo: 'Serviço não prestado', qtd: 1 },
      { motivo: 'Valor divergente', qtd: 1 },
    ],
    slaCicloLabel: '1d 8h',
    faseMaisLenta: 'Averbação · 9h',
  },
  suporte: {
    viagens: 142,
    noPrazo: 107,
    antecipadas: 24,
    atrasadas: 11,
    pontualidadePct: 92,
    ocorrencias: [
      { categoria: 'Mecânico / veículo', qtd: 4, pct: 36 },
      { categoria: 'Prazo curto / trânsito', qtd: 3, pct: 27 },
    ],
  },
  closer: {
    totalContratado: 487000,
    economizadoValor: 53000,
    economizadoPct: 11,
    slaPostagemLabel: '9min',
    slaFechamentoLabel: '3h42',
  },
}

export default function Preview() {
  return <div dangerouslySetInnerHTML={{ __html: renderRelatorioHTML(fake) }} />
}
