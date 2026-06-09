import type { Categoria } from './categorizeMotivo'

export function pontualidade(x: { total: number; noPrazo: number; antecipadas: number }): number {
  if (x.total <= 0) return 0
  return Math.round(((x.noPrazo + x.antecipadas) / x.total) * 100)
}

export function mediaMs(vals: (number | null)[]): number | null {
  const ok = vals.filter((v): v is number => v != null)
  if (!ok.length) return null
  return Math.round(ok.reduce((a, b) => a + b, 0) / ok.length)
}

export function msToLabel(ms: number | null): string {
  if (ms == null) return '—'
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60), m = min % 60
  if (h < 24) return m ? `${h}h${pad(m)}` : `${h}h`
  const d = Math.floor(h / 24), hr = h % 24
  return `${d}d ${hr}h`
}
const pad = (n: number) => String(n).padStart(2, '0')

export function rankOcorrencias(cats: Categoria[]): { categoria: Categoria; qtd: number; pct: number }[] {
  const total = cats.length || 1
  const counts = new Map<Categoria, number>()
  for (const c of cats) counts.set(c, (counts.get(c) || 0) + 1)
  return [...counts.entries()]
    .map(([categoria, qtd]) => ({ categoria, qtd, pct: Math.round((qtd / total) * 100) }))
    .sort((a, b) => b.qtd - a.qtd)
}
