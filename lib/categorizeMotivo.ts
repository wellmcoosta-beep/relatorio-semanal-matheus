export type Categoria =
  | 'Mecânico / veículo' | 'Prazo curto / trânsito' | 'Cliente / agendamento'
  | 'Transbordo' | 'Outros'

export const CATEGORIAS: Categoria[] = [
  'Mecânico / veículo', 'Prazo curto / trânsito', 'Cliente / agendamento', 'Transbordo', 'Outros',
]

// Ordem importa: a primeira regra que casar vence. Transbordo antes de Mecânico
// porque "veículo quebrou e teve transbordo" deve cair em Transbordo.
const REGRAS: { cat: Categoria; kws: string[] }[] = [
  { cat: 'Transbordo', kws: ['transbord'] },
  { cat: 'Mecânico / veículo', kws: ['mecanic', 'mecânic', 'quebr', 'bateria', 'estragad', 'pneu', 'veiculo', 'veículo'] },
  { cat: 'Prazo curto / trânsito', kws: ['prazo curt', 'prazo muit curt', 'transito', 'trânsito', 'tempo curto', 'distan'] },
  { cat: 'Cliente / agendamento', kws: ['cliente', 'agenda', 'receber', 'espera', 'descarreg'] },
]

export function categorizeMotivo(texto: string): Categoria {
  const t = (texto || '').toLowerCase().trim()
  if (!t) return 'Outros'
  for (const r of REGRAS) if (r.kws.some((k) => t.includes(k))) return r.cat
  return 'Outros'
}
