# Relatório Semanal da Operação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App Next.js dedicado que, toda segunda 08:00 BRT, puxa métricas de 5 fontes (Fiscal/Suporte/Closer), monta um PDF "Executivo Claro" e posta no Discord.

**Architecture:** Uma rota (`/api/relatorio-semanal`) orquestra: adapters de fonte (pure transforms testáveis + I/O fino) → `aggregate` monta o modelo `RelatorioSemanal` → `render` gera HTML/React → `pdf` converte via puppeteer-core+chromium → `discord` posta. Cron da Vercel dispara a rota protegida por secret.

**Tech Stack:** Next.js 14 (App Router) + TypeScript · `@supabase/supabase-js` (2 projetos) · `googleapis` (Sheets) · `luxon` (timezone BRT) · `puppeteer-core` + `@sparticuz/chromium` (PDF) · `vitest` (testes) · Vercel (deploy + cron).

**Pré-requisitos (planos próprios, fora deste):** (1) `transfast-fiscal` — dropdown de motivos de denegação; (2) `transfast-cotacoes` — coluna `closer_cargas.motorista_registrado_em` + carimbo no trigger. O app trata a ausência: denegação agrupa pelo campo disponível ("Outro"), SLA fechamento exibe "—" quando a coluna não existe.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `lib/dateWindow.ts` | Janela da semana anterior (seg 00:00 → dom 23:59:59 BRT) como bounds UTC ISO |
| `lib/categorizeMotivo.ts` | Mapeia texto livre de atraso → categoria |
| `lib/types.ts` | Modelo `RelatorioSemanal` e sub-tipos por setor |
| `lib/metrics.ts` | Cálculos puros: pontualidade, médias de SLA, economizado |
| `lib/sources/fiscal.ts` | Supabase fiscal + SIIMP → `FiscalData` |
| `lib/sources/suporte.ts` | Google Sheets → parse → `SuporteData` |
| `lib/sources/closer.ts` | Supabase cotações → `CloserData` |
| `lib/sources/sla.ts` | Webhook n8n do dash SLA → `SlaData` |
| `lib/aggregate.ts` | Junta as 4 fontes + a janela no modelo final |
| `lib/render.tsx` | Template HTML/React "Executivo Claro" |
| `lib/pdf.ts` | HTML → PDF (puppeteer-core + @sparticuz/chromium) |
| `lib/discord.ts` | Posta o PDF no webhook do Discord |
| `app/api/relatorio-semanal/route.ts` | Orquestra; protegida por `CRON_SECRET` |
| `app/preview/page.tsx` | Renderiza o HTML no navegador (iterar layout) |
| `vercel.json` | Cron `0 11 * * 1` |
| `.env.example` | Template de todas as envs |

---

## Task 1: Scaffold do projeto

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `vitest.config.ts`, `.env.example`, `.gitignore`, `app/layout.tsx`, `app/page.tsx`

- [ ] **Step 1: Init e dependências**

Run (na pasta do projeto):
```bash
git init
npm init -y
npm i next@14 react react-dom @supabase/supabase-js googleapis luxon puppeteer-core @sparticuz/chromium
npm i -D typescript @types/node @types/react @types/luxon vitest
```

- [ ] **Step 2: Configs**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2021", "lib": ["dom","dom.iterable","esnext"], "module": "esnext",
    "moduleResolution": "bundler", "jsx": "preserve", "strict": true, "noEmit": true,
    "esModuleInterop": true, "skipLibCheck": true, "resolveJsonModule": true,
    "incremental": true, "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"], "exclude": ["node_modules"]
}
```

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'node', include: ['**/*.test.ts'] } })
```

Create `next.config.js`:
```js
/** @type {import('next').NextConfig} */
module.exports = { experimental: { serverComponentsExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'] } }
```

Add to `package.json` "scripts":
```json
"scripts": { "dev": "next dev", "build": "next build", "start": "next start", "test": "vitest run", "typecheck": "tsc --noEmit" }
```

- [ ] **Step 3: `.gitignore` e `.env.example`**

Create `.gitignore`:
```
node_modules/
.next/
.env
.env.local
.superpowers/
```

Create `.env.example`:
```
CRON_SECRET=
FISCAL_SUPABASE_URL=
FISCAL_SUPABASE_SERVICE_KEY=
COTACOES_SUPABASE_URL=
COTACOES_SUPABASE_SERVICE_KEY=
SIIMP_BASE_URL=
SIIMP_TOKEN=
SIIMP_STATUS_AUTORIZADO=1
GOOGLE_SHEET_ID=1kGotRwF6ODwguFEQ-fvw50OjaH-Ztw2IjKFtDOIPC4s
GOOGLE_SERVICE_ACCOUNT_JSON=
SLA_WEBHOOK_URL=
SLA_WEBHOOK_TOKEN=
DISCORD_WEBHOOK_URL=
```

- [ ] **Step 4: App shell mínimo**

Create `app/layout.tsx`:
```tsx
export const metadata = { title: 'Relatório Semanal' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>
}
```

Create `app/page.tsx`:
```tsx
export default function Home() { return <main>Relatório Semanal da Operação — serviço ativo.</main> }
```

- [ ] **Step 5: Verificar build/typecheck e commit**

Run: `npm run typecheck`
Expected: sem erros.
```bash
git add -A && git commit -m "chore: scaffold next app + tooling"
```

---

## Task 2: Janela da semana (BRT)

**Files:**
- Create: `lib/dateWindow.ts`, `lib/dateWindow.test.ts`

- [ ] **Step 1: Teste que falha**

Create `lib/dateWindow.test.ts`:
```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- dateWindow`
Expected: FAIL (`previousWeekWindow` não existe).

- [ ] **Step 3: Implementar**

Create `lib/dateWindow.ts`:
```ts
import { DateTime } from 'luxon'

export interface Window { fromISO: string; toISO: string; label: string }
const ZONE = 'America/Sao_Paulo'
const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

/** Semana anterior fechada (seg 00:00 → dom 23:59:59.999 BRT), bounds em UTC ISO. */
export function previousWeekWindow(ref: Date): Window {
  const now = DateTime.fromJSDate(ref, { zone: ZONE })
  const thisMonday = now.startOf('week') // luxon: semana começa segunda
  const lastMonday = thisMonday.minus({ weeks: 1 })
  const lastSundayEnd = thisMonday.minus({ milliseconds: 1 })
  const from = lastMonday
  const to = lastSundayEnd
  const label = `${pad(from.day)}–${pad(to.day)} ${MESES[to.month - 1]} ${to.year}`
  return { fromISO: from.toUTC().toISO()!, toISO: to.toUTC().toISO()!, label }
}
const pad = (n: number) => String(n).padStart(2, '0')
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- dateWindow`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add lib/dateWindow.ts lib/dateWindow.test.ts && git commit -m "feat: janela da semana anterior em BRT"
```

---

## Task 3: Categorização de motivos de atraso

**Files:**
- Create: `lib/categorizeMotivo.ts`, `lib/categorizeMotivo.test.ts`

- [ ] **Step 1: Teste que falha**

Create `lib/categorizeMotivo.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { categorizeMotivo, CATEGORIAS } from './categorizeMotivo'

describe('categorizeMotivo', () => {
  it('mapeia mecânico', () => {
    expect(categorizeMotivo('veiculo quebrou e teve transbordo')).toBe('Transbordo') // transbordo tem prioridade
    expect(categorizeMotivo('Problema Mecanico')).toBe('Mecânico / veículo')
    expect(categorizeMotivo('Teve problema com Bateria')).toBe('Mecânico / veículo')
  })
  it('mapeia prazo/trânsito', () => {
    expect(categorizeMotivo('prazo muit curto, motorista tinha 4 entregas distantes')).toBe('Prazo curto / trânsito')
    expect(categorizeMotivo('Tempo Curto Para Entrega - Pegou Muito Transito')).toBe('Prazo curto / trânsito')
  })
  it('mapeia cliente/agendamento', () => {
    expect(categorizeMotivo('cliente não tinha como receber e motorista ficou esperando')).toBe('Cliente / agendamento')
  })
  it('vazio ou desconhecido vira Outros', () => {
    expect(categorizeMotivo('')).toBe('Outros')
    expect(categorizeMotivo('xyz aleatório')).toBe('Outros')
  })
  it('CATEGORIAS expõe a ordem de exibição', () => {
    expect(CATEGORIAS[0]).toBe('Mecânico / veículo')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- categorizeMotivo`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Create `lib/categorizeMotivo.ts`:
```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- categorizeMotivo`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add lib/categorizeMotivo.ts lib/categorizeMotivo.test.ts && git commit -m "feat: categorização de motivos de atraso"
```

---

## Task 4: Tipos do modelo

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Definir os tipos**

Create `lib/types.ts`:
```ts
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
```

- [ ] **Step 2: Typecheck e commit**

Run: `npm run typecheck`
Expected: sem erros.
```bash
git add lib/types.ts && git commit -m "feat: modelo RelatorioSemanal"
```

---

## Task 5: Cálculos puros de métrica

**Files:**
- Create: `lib/metrics.ts`, `lib/metrics.test.ts`

- [ ] **Step 1: Teste que falha**

Create `lib/metrics.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { pontualidade, mediaMs, msToLabel, rankOcorrencias } from './metrics'

describe('metrics', () => {
  it('pontualidade = (noPrazo+antecipadas)/total arredondado', () => {
    expect(pontualidade({ total: 142, noPrazo: 107, antecipadas: 24 })).toBe(92)
    expect(pontualidade({ total: 0, noPrazo: 0, antecipadas: 0 })).toBe(0)
  })
  it('mediaMs ignora nulos', () => {
    expect(mediaMs([1000, 3000, null])).toBe(2000)
    expect(mediaMs([null])).toBeNull()
  })
  it('msToLabel formata', () => {
    expect(msToLabel(9 * 60000)).toBe('9min')
    expect(msToLabel((3 * 3600 + 42 * 60) * 1000)).toBe('3h42')
    expect(msToLabel((32 * 3600) * 1000)).toBe('1d 8h')
    expect(msToLabel(null)).toBe('—')
  })
  it('rankOcorrencias conta e calcula %', () => {
    const r = rankOcorrencias(['Mecânico / veículo', 'Mecânico / veículo', 'Transbordo'])
    expect(r[0]).toEqual({ categoria: 'Mecânico / veículo', qtd: 2, pct: 67 })
    expect(r[1]).toEqual({ categoria: 'Transbordo', qtd: 1, pct: 33 })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- metrics`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Create `lib/metrics.ts`:
```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- metrics`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add lib/metrics.ts lib/metrics.test.ts && git commit -m "feat: cálculos puros de métrica"
```

---

## Task 6: Fonte Fiscal (Supabase fiscal + SIIMP)

**Files:**
- Create: `lib/sources/fiscal.ts`, `lib/sources/fiscal.test.ts`

- [ ] **Step 1: Teste do transform puro**

Create `lib/sources/fiscal.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildFiscalData } from './fiscal'

describe('buildFiscalData', () => {
  it('agrega contagens, prejuízo e motivos', () => {
    const out = buildFiscalData({
      ctesEmitidos: 312,
      cancelados: [{ impacto_financeiro: 4120, guia_paga: true }, { impacto_financeiro: 0, guia_paga: false }],
      denegados: [{ motivo_categoria: 'Serviço não prestado' }, { motivo_categoria: 'Serviço não prestado' }, { motivo_categoria: null }],
      slaCicloMs: 32 * 3600 * 1000,
      faseMaisLenta: 'Averbação · 9h',
    })
    expect(out.ctesEmitidos).toBe(312)
    expect(out.cancelados).toBe(2)
    expect(out.denegados).toBe(3)
    expect(out.prejuizoIcms).toBe(4120)
    expect(out.motivosDenegacao).toEqual([
      { motivo: 'Serviço não prestado', qtd: 2 },
      { motivo: 'Outro', qtd: 1 },
    ])
    expect(out.slaCicloLabel).toBe('1d 8h')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- fiscal`
Expected: FAIL.

- [ ] **Step 3: Implementar transform + I/O**

Create `lib/sources/fiscal.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
import { msToLabel } from '../metrics'
import type { FiscalData } from '../types'

interface RawCancelado { impacto_financeiro: number | null; guia_paga: boolean | null }
interface RawDenegado { motivo_categoria: string | null }
interface FiscalRaw {
  ctesEmitidos: number
  cancelados: RawCancelado[]
  denegados: RawDenegado[]
  slaCicloMs: number | null
  faseMaisLenta: string
}

export function buildFiscalData(raw: FiscalRaw): FiscalData {
  const prejuizoIcms = raw.cancelados.reduce((s, c) => s + (c.guia_paga ? (c.impacto_financeiro || 0) : 0), 0)
  const counts = new Map<string, number>()
  for (const d of raw.denegados) {
    const k = d.motivo_categoria || 'Outro'
    counts.set(k, (counts.get(k) || 0) + 1)
  }
  const motivosDenegacao = [...counts.entries()]
    .map(([motivo, qtd]) => ({ motivo, qtd })).sort((a, b) => b.qtd - a.qtd)
  return {
    ctesEmitidos: raw.ctesEmitidos,
    cancelados: raw.cancelados.length,
    denegados: raw.denegados.length,
    prejuizoIcms,
    motivosDenegacao,
    slaCicloLabel: msToLabel(raw.slaCicloMs),
    faseMaisLenta: raw.faseMaisLenta,
  }
}

// I/O: puxa o raw das fontes. `slaCicloMs`/`faseMaisLenta` vêm de lib/sources/sla.ts (passados pelo aggregate).
export async function fetchFiscalRaw(fromISO: string, toISO: string): Promise<Omit<FiscalRaw, 'slaCicloMs' | 'faseMaisLenta'>> {
  const sb = createClient(process.env.FISCAL_SUPABASE_URL!, process.env.FISCAL_SUPABASE_SERVICE_KEY!)
  const [{ data: cancelados }, { data: denegados }] = await Promise.all([
    sb.from('ctes_cancelados').select('impacto_financeiro, guia_paga').gte('data_cancelamento', fromISO).lte('data_cancelamento', toISO),
    sb.from('ctes_denegados').select('motivo_categoria').gte('data_denegacao', fromISO).lte('data_denegacao', toISO),
  ])
  const ctesEmitidos = await fetchEmitidosCount(fromISO, toISO)
  return { ctesEmitidos, cancelados: cancelados || [], denegados: denegados || [] }
}

// SIIMP: conta CT-es emitidos (autorizados) no período. Espelha o padrão de
// transfast-fiscal/lib/siimp.ts (fetchAllCancelledCtes), trocando status e datas.
async function fetchEmitidosCount(fromISO: string, toISO: string): Promise<number> {
  const status = process.env.SIIMP_STATUS_AUTORIZADO || '1'
  const url = new URL('/ctes/search', process.env.SIIMP_BASE_URL!)
  url.searchParams.set('status', status)
  url.searchParams.set('issued_from', fromISO.slice(0, 10))
  url.searchParams.set('issued_to', toISO.slice(0, 10))
  url.searchParams.set('limit', '1')
  const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.SIIMP_TOKEN}` } })
  if (!res.ok) throw new Error(`SIIMP emitidos ${res.status}`)
  const json: any = await res.json()
  return json.total ?? json.count ?? (Array.isArray(json.data) ? json.data.length : 0)
}
```

- [ ] **Step 4: Rodar transform e ver passar**

Run: `npm test -- fiscal`
Expected: PASS.

- [ ] **Step 5: Verificar SIIMP de verdade (manual)**

Abra `transfast-fiscal/lib/siimp.ts` e confirme o endpoint/params reais de `/ctes/search` e qual `status` significa "autorizado/emitido". Ajuste `fetchEmitidosCount` (campo de total e nome do status) pra bater com a resposta real. Rode um teste manual:
```bash
node -e "process.env.SIIMP_BASE_URL='...';process.env.SIIMP_TOKEN='...';import('./lib/sources/fiscal.ts')"
```
(ou um script temporário). Confirme que retorna um número plausível.

- [ ] **Step 6: Commit**
```bash
git add lib/sources/fiscal.ts lib/sources/fiscal.test.ts && git commit -m "feat: fonte fiscal (supabase + siimp)"
```

---

## Task 7: Fonte Suporte (Google Sheets)

**Files:**
- Create: `lib/sources/suporte.ts`, `lib/sources/suporte.test.ts`

- [ ] **Step 1: Teste do parse/transform**

Create `lib/sources/suporte.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildSuporteData } from './suporte'

const rows = [
  // [Data Coleta, CTE, Cliente, Previsão, Data entrega, Status, Motivo do Atraso]
  ['03/06/2026', '7361', 'BIOMA', '04/06/2026', '04/06/2026', 'NO PRAZO', ''],
  ['03/06/2026', '7362', 'BIOMA', '05/06/2026', '04/06/2026', 'ANTECIPADA', ''],
  ['03/06/2026', '7364', 'BIOMA', '04/06/2026', '06/06/2026', 'ATRASADA', 'Teve problema com Bateria'],
  ['03/06/2026', '7222', 'MANUF', '04/06/2026', '06/06/2026', 'ATRASADA', 'veiculo quebrou e teve transbordo'],
  // fora da janela:
  ['20/05/2026', '7000', 'X', '21/05/2026', '21/05/2026', 'NO PRAZO', ''],
]

describe('buildSuporteData', () => {
  it('conta só entregas na janela e ranqueia ocorrências', () => {
    const out = buildSuporteData(rows, { fromISO: '2026-06-01T03:00:00.000Z', toISO: '2026-06-08T02:59:59.999Z' })
    expect(out.viagens).toBe(4)
    expect(out.noPrazo).toBe(1)
    expect(out.antecipadas).toBe(1)
    expect(out.atrasadas).toBe(2)
    expect(out.pontualidadePct).toBe(50) // (1+1)/4
    expect(out.ocorrencias[0].categoria).toBe('Mecânico / veículo')
    expect(out.ocorrencias.map(o => o.categoria)).toContain('Transbordo')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- suporte`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Create `lib/sources/suporte.ts`:
```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- suporte`
Expected: PASS.

- [ ] **Step 5: Verificar a aba/range real (manual)**

Confirme com a planilha real que a aba de registro é a primeira (range `A2:H`) e que os índices de coluna batem (`Data entrega` = col E / índice 4, `Status` = F/5, `Motivo do Atraso` = G/6). Se a aba de registro não for a primeira, ajuste o range pra `'<NomeDaAba>!A2:H'`. Compartilhe a planilha com o e-mail do service account (acesso leitor).

- [ ] **Step 6: Commit**
```bash
git add lib/sources/suporte.ts lib/sources/suporte.test.ts && git commit -m "feat: fonte suporte (google sheets)"
```

---

## Task 8: Fonte Closer (Supabase cotações)

**Files:**
- Create: `lib/sources/closer.ts`, `lib/sources/closer.test.ts`

- [ ] **Step 1: Teste do transform**

Create `lib/sources/closer.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildCloserData } from './closer'

describe('buildCloserData', () => {
  it('soma contratado, economizado %/R$ e formata SLAs', () => {
    const out = buildCloserData({
      cargas: [
        { frete_motorista_closer: 300000, cc_gerada: 30000, baseElegivel: 270000, created_at: '2026-06-02T12:00:00Z', postada_em: '2026-06-02T12:09:00Z', motorista_registrado_em: '2026-06-02T15:42:00Z' },
        { frete_motorista_closer: 187000, cc_gerada: 23000, baseElegivel: 210000, created_at: '2026-06-03T10:00:00Z', postada_em: '2026-06-03T10:09:00Z', motorista_registrado_em: null },
      ],
    })
    expect(out.totalContratado).toBe(487000)
    expect(out.economizadoValor).toBe(53000)
    expect(out.economizadoPct).toBe(11) // 53000 / (270000+210000) = 11%
    expect(out.slaPostagemLabel).toBe('9min')
    expect(out.slaFechamentoLabel).toBe('3h42') // só a carga com timestamp
  })
  it('SLA fechamento vira "—" quando ninguém tem timestamp', () => {
    const out = buildCloserData({ cargas: [{ frete_motorista_closer: 1000, cc_gerada: 0, baseElegivel: 0, created_at: '2026-06-02T12:00:00Z', postada_em: null, motorista_registrado_em: null }] })
    expect(out.slaFechamentoLabel).toBe('—')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- closer`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Create `lib/sources/closer.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
import { mediaMs, msToLabel } from '../metrics'
import type { CloserData } from '../types'

interface RawCarga {
  frete_motorista_closer: number | null
  cc_gerada: number | null
  baseElegivel: number          // base p/ % de economia (ver Step 5)
  created_at: string
  postada_em: string | null
  motorista_registrado_em: string | null
}

const deltaMs = (a: string | null, b: string | null): number | null =>
  a && b ? Date.parse(a) - Date.parse(b) : null

export function buildCloserData(raw: { cargas: RawCarga[] }): CloserData {
  const cargas = raw.cargas
  const totalContratado = cargas.reduce((s, c) => s + (c.frete_motorista_closer || 0), 0)
  const economizadoValor = cargas.reduce((s, c) => s + (c.cc_gerada || 0), 0)
  const base = cargas.reduce((s, c) => s + (c.baseElegivel || 0), 0)
  const economizadoPct = base > 0 ? Math.round((economizadoValor / base) * 100) : 0
  const slaPostagem = mediaMs(cargas.map((c) => deltaMs(c.postada_em, c.created_at)))
  const slaFechamento = mediaMs(cargas.map((c) => deltaMs(c.motorista_registrado_em, c.created_at)))
  return {
    totalContratado, economizadoValor, economizadoPct,
    slaPostagemLabel: msToLabel(slaPostagem),
    slaFechamentoLabel: msToLabel(slaFechamento),
  }
}

// I/O: cargas contratadas na semana (motorista registrado no período).
// Se a coluna motorista_registrado_em ainda não existir (pré-requisito 2),
// cai pra created_at na janela e motorista_registrado_em = null (SLA fechamento = "—").
export async function fetchCloserRaw(fromISO: string, toISO: string): Promise<{ cargas: RawCarga[] }> {
  const sb = createClient(process.env.COTACOES_SUPABASE_URL!, process.env.COTACOES_SUPABASE_SERVICE_KEY!)
  const { data, error } = await sb
    .from('closer_cargas')
    .select('frete_motorista_closer, cc_gerada, frete_motorista_comercial, antt_piso_total, created_at, postada_em, motorista_registrado_em')
    .eq('motorista_registrado', true)
    .gte('created_at', fromISO).lte('created_at', toISO)
  if (error && /motorista_registrado_em/.test(error.message)) {
    // coluna ainda não existe: refaz sem ela
    const { data: d2 } = await sb.from('closer_cargas')
      .select('frete_motorista_closer, cc_gerada, frete_motorista_comercial, antt_piso_total, created_at, postada_em')
      .eq('motorista_registrado', true).gte('created_at', fromISO).lte('created_at', toISO)
    return { cargas: (d2 || []).map((c: any) => ({ ...mapBase(c), motorista_registrado_em: null })) }
  }
  return { cargas: (data || []).map(mapBase) }
}

function mapBase(c: any): RawCarga {
  // baseElegivel: aproximação do denominador de economia. Confirmar contra
  // transfast-cotacoes/lib/closer-calc.ts no Step 5; aqui usa comercial - piso.
  const baseElegivel = Math.max(0, (c.frete_motorista_comercial || 0) - (c.antt_piso_total || 0))
  return {
    frete_motorista_closer: c.frete_motorista_closer,
    cc_gerada: c.cc_gerada,
    baseElegivel,
    created_at: c.created_at,
    postada_em: c.postada_em ?? null,
    motorista_registrado_em: c.motorista_registrado_em ?? null,
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- closer`
Expected: PASS.

- [ ] **Step 5: Alinhar a base de economia (manual)**

Abra `transfast-cotacoes/lib/closer-calc.ts` e confirme o denominador real do % de economia (`isFreteFixoExcluido`, exclusões de elegibilidade — ver memória `project-closer-bonus-executadas`). Ajuste `mapBase.baseElegivel` e, se preciso, filtre cargas inelegíveis antes de somar a base. O objetivo é o % bater com o que o dashboard de cotações já mostra.

- [ ] **Step 6: Commit**
```bash
git add lib/sources/closer.ts lib/sources/closer.test.ts && git commit -m "feat: fonte closer (supabase cotações)"
```

---

## Task 9: Fonte SLA (webhook n8n)

**Files:**
- Create: `lib/sources/sla.ts`, `lib/sources/sla.test.ts`

- [ ] **Step 1: Teste do transform**

Create `lib/sources/sla.test.ts`:
```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- sla`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Create `lib/sources/sla.ts`:
```ts
import { msToLabel } from '../metrics'

interface Phase { phaseName: string; averageDurationMs: number }
export interface SlaData { slaCicloMs: number | null; faseMaisLenta: string }

export function buildSlaData(raw: { phases: Phase[] }): SlaData {
  if (!raw.phases?.length) return { slaCicloMs: null, faseMaisLenta: '—' }
  const slaCicloMs = raw.phases.reduce((s, p) => s + (p.averageDurationMs || 0), 0)
  const lenta = [...raw.phases].sort((a, b) => b.averageDurationMs - a.averageDurationMs)[0]
  return { slaCicloMs, faseMaisLenta: `${lenta.phaseName} · ${msToLabel(lenta.averageDurationMs)}` }
}

// I/O: chama o mesmo endpoint JSON que o dash externo de SLA consome,
// filtrando pela janela da semana (params from/to em data BR).
export async function fetchSlaRaw(fromISO: string, toISO: string): Promise<{ phases: Phase[] }> {
  const url = new URL(process.env.SLA_WEBHOOK_URL!)
  if (process.env.SLA_WEBHOOK_TOKEN) url.searchParams.set('token', process.env.SLA_WEBHOOK_TOKEN)
  url.searchParams.set('from', fromISO.slice(0, 10))
  url.searchParams.set('to', toISO.slice(0, 10))
  const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
  if (!res.ok) throw new Error(`SLA webhook ${res.status}`)
  const json: any = await res.json()
  // Normaliza: o payload usa `averageDurationLabel` no front; aqui precisamos de ms.
  const phases: Phase[] = (json.phases || []).map((p: any) => ({
    phaseName: p.phaseName,
    averageDurationMs: p.averageDurationMs ?? p.averageDurationMinutes * 60000 ?? 0,
  }))
  return { phases }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- sla`
Expected: PASS.

- [ ] **Step 5: Verificar o payload real (manual)**

Pegue a `SLA_WEBHOOK_URL` + token em `CREDENCIAIS.md` (ou no `index.html` do `dashboard_externo_sla`). Faça um `curl` e inspecione o JSON: confirme o nome do campo numérico de duração média por fase (`averageDurationMs`? minutos? segundos?) e ajuste o mapeamento em `fetchSlaRaw`. Se o endpoint não numérico só tiver label, peça pro workflow n8n expor o ms (ou parseie o label).

- [ ] **Step 6: Commit**
```bash
git add lib/sources/sla.ts lib/sources/sla.test.ts && git commit -m "feat: fonte sla (webhook n8n)"
```

---

## Task 10: Aggregate

**Files:**
- Create: `lib/aggregate.ts`, `lib/aggregate.test.ts`

- [ ] **Step 1: Teste com fontes mockadas**

Create `lib/aggregate.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('./sources/fiscal', () => ({
  fetchFiscalRaw: vi.fn(async () => ({ ctesEmitidos: 312, cancelados: [], denegados: [] })),
  buildFiscalData: (await vi.importActual<any>('./sources/fiscal')).buildFiscalData,
}))

describe('buildRelatorio', () => {
  it('monta o modelo a partir das fontes e da janela', async () => {
    const { buildRelatorio } = await import('./aggregate')
    const rel = await buildRelatorio(new Date('2026-06-08T11:00:00Z'), {
      fiscalRaw: { ctesEmitidos: 312, cancelados: [], denegados: [] },
      suporteRows: [],
      closerRaw: { cargas: [] },
      slaRaw: { phases: [{ phaseName: 'Entrega', averageDurationMs: 3600000 }] },
    })
    expect(rel.semanaLabel).toBe('01–07 jun 2026')
    expect(rel.fiscal.ctesEmitidos).toBe(312)
    expect(rel.fiscal.faseMaisLenta).toBe('Entrega · 1h')
    expect(rel.suporte.viagens).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- aggregate`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Create `lib/aggregate.ts`:
```ts
import { previousWeekWindow } from './dateWindow'
import { buildFiscalData, fetchFiscalRaw } from './sources/fiscal'
import { buildSuporteData, fetchSuporteRows } from './sources/suporte'
import { buildCloserData, fetchCloserRaw } from './sources/closer'
import { buildSlaData, fetchSlaRaw } from './sources/sla'
import type { RelatorioSemanal } from './types'

interface Injected {
  fiscalRaw: Awaited<ReturnType<typeof fetchFiscalRaw>>
  suporteRows: string[][]
  closerRaw: Awaited<ReturnType<typeof fetchCloserRaw>>
  slaRaw: Awaited<ReturnType<typeof fetchSlaRaw>>
}

/** Se `injected` vier, usa os dados (testes). Senão, puxa tudo das fontes. */
export async function buildRelatorio(ref: Date, injected?: Injected): Promise<RelatorioSemanal> {
  const w = previousWeekWindow(ref)
  const data = injected ?? await pullAll(w.fromISO, w.toISO)
  const sla = buildSlaData(data.slaRaw)
  return {
    semanaLabel: w.label,
    fiscal: buildFiscalData({ ...data.fiscalRaw, slaCicloMs: sla.slaCicloMs, faseMaisLenta: sla.faseMaisLenta }),
    suporte: buildSuporteData(data.suporteRows, w),
    closer: buildCloserData(data.closerRaw),
  }
}

async function pullAll(fromISO: string, toISO: string): Promise<Injected> {
  const [fiscalRaw, suporteRows, closerRaw, slaRaw] = await Promise.all([
    fetchFiscalRaw(fromISO, toISO), fetchSuporteRows(), fetchCloserRaw(fromISO, toISO), fetchSlaRaw(fromISO, toISO),
  ])
  return { fiscalRaw, suporteRows, closerRaw, slaRaw }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- aggregate`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add lib/aggregate.ts lib/aggregate.test.ts && git commit -m "feat: aggregate do relatório"
```

---

## Task 11: Template HTML (Executivo Claro)

**Files:**
- Create: `lib/render.tsx`, `app/preview/page.tsx`

- [ ] **Step 1: Template a partir do modelo**

Create `lib/render.tsx` — function `renderRelatorioHTML(rel: RelatorioSemanal): string`. Reproduz o mockup aprovado `final.html` (`.superpowers/brainstorm/.../content/final.html`): faixa vermelha `#DC2626` com "TRANSFAST" + `rel.semanaLabel`; 3 blocos (Fiscal/Suporte/Closer) com tiles; ocorrências em barras; valores via `Intl.NumberFormat('pt-BR')` pra R$. Retorna um documento HTML completo (`<!DOCTYPE html>…`) com o CSS inline copiado do mockup. Use as cores: bg `#fff`, vermelho `#DC2626`, texto `#18181b`, muted `#71717a`, card `#f5f5f7`, verde `#16a34a`, âmbar `#d97706`.

```tsx
import type { RelatorioSemanal } from './types'
const brl = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)

export function renderRelatorioHTML(rel: RelatorioSemanal): string {
  const barras = rel.suporte.ocorrencias.map((o) =>
    `<div class="bar"><span>${o.categoria}</span><b>${o.qtd} · ${o.pct}%</b></div><div class="track"><div class="fill" style="width:${o.pct}%"></div></div>`).join('')
  const motivos = rel.fiscal.motivosDenegacao.map((m) => `<span class="chip">${m.motivo} · ${m.qtd}</span>`).join('')
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><style>
    /* CSS copiado de final.html: .pg .top .blk .bt .row .t .v .l .d .bar .track .fill .chip .g .a */
  </style></head><body>
    <div class="pg">
      <div class="top"><div><div class="t1">TRANS<span>FAST</span></div><div class="t2">Relatório Semanal da Operação</div></div><div class="wk">Semana<br><b>${rel.semanaLabel}</b></div></div>
      <div class="blk"><div class="bt">🧾 Fiscal</div>
        <div class="row r4">
          <div class="t"><div class="v">${rel.fiscal.ctesEmitidos}</div><div class="l">CT-es emitidos</div></div>
          <div class="t"><div class="v a">${rel.fiscal.cancelados}</div><div class="l">Cancelados</div></div>
          <div class="t"><div class="v a">${rel.fiscal.denegados}</div><div class="l">Denegados</div></div>
          <div class="t"><div class="v a">${brl(rel.fiscal.prejuizoIcms)}</div><div class="l">Prejuízo ICMS</div></div>
        </div>
        <div class="sub">Motivos de denegação</div><div class="mini">${motivos}</div>
        <div class="sub">SLA operacional · ciclo completo</div><div class="mini"><span class="chip">Tempo médio: <b>${rel.fiscal.slaCicloLabel}</b></span><span class="chip">Fase mais lenta: ${rel.fiscal.faseMaisLenta}</span></div>
      </div>
      <div class="blk"><div class="bt">📦 Suporte</div>
        <div class="row r4">
          <div class="t"><div class="v">${rel.suporte.viagens}</div><div class="l">Viagens na semana</div></div>
          <div class="t hl"><div class="v g">${rel.suporte.pontualidadePct}%</div><div class="l">Pontualidade</div><div class="d">${rel.suporte.noPrazo + rel.suporte.antecipadas} no prazo ou adiantadas</div></div>
          <div class="t"><div class="v g">${rel.suporte.antecipadas}</div><div class="l">Antecipadas</div></div>
          <div class="t"><div class="v a">${rel.suporte.atrasadas}</div><div class="l">Atrasadas</div></div>
        </div>
        <div class="sub">Principais ocorrências de atraso</div>${barras}
      </div>
      <div class="blk" style="border-bottom:none"><div class="bt">💼 Closer</div>
        <div class="row r4">
          <div class="t hl"><div class="v">${brl(rel.closer.totalContratado)}</div><div class="l">Total contratado</div><div class="d">frete pago ao motorista</div></div>
          <div class="t"><div class="v g">${brl(rel.closer.economizadoValor)}</div><div class="l">Economizado</div><div class="d">${rel.closer.economizadoPct}% sobre a base</div></div>
          <div class="t"><div class="v">${rel.closer.slaPostagemLabel}</div><div class="l">SLA postagem</div></div>
          <div class="t"><div class="v">${rel.closer.slaFechamentoLabel}</div><div class="l">SLA fechamento</div></div>
        </div>
      </div>
    </div>
  </body></html>`
}
```

Cole no `<style>` o CSS das classes do `final.html` (`.pg`, `.top`, `.blk`, `.bt`, `.row.r4`, `.t`, `.v`, `.l`, `.d`, `.sub`, `.mini`, `.chip`, `.bar`, `.track`, `.fill`, `.g`, `.a`).

- [ ] **Step 2: Página de preview com dados fake**

Create `app/preview/page.tsx`:
```tsx
import { renderRelatorioHTML } from '@/lib/render'
import type { RelatorioSemanal } from '@/lib/types'

const fake: RelatorioSemanal = {
  semanaLabel: '01–07 jun 2026',
  fiscal: { ctesEmitidos: 312, cancelados: 8, denegados: 3, prejuizoIcms: 4120, motivosDenegacao: [{ motivo: 'Serviço não prestado', qtd: 1 }, { motivo: 'Valor divergente', qtd: 1 }], slaCicloLabel: '1d 8h', faseMaisLenta: 'Averbação · 9h' },
  suporte: { viagens: 142, noPrazo: 107, antecipadas: 24, atrasadas: 11, pontualidadePct: 92, ocorrencias: [{ categoria: 'Mecânico / veículo', qtd: 4, pct: 36 }, { categoria: 'Prazo curto / trânsito', qtd: 3, pct: 27 }] },
  closer: { totalContratado: 487000, economizadoValor: 53000, economizadoPct: 11, slaPostagemLabel: '9min', slaFechamentoLabel: '3h42' },
}
export default function Preview() {
  return <div dangerouslySetInnerHTML={{ __html: renderRelatorioHTML(fake) }} />
}
```

- [ ] **Step 3: Verificar no navegador (manual)**

Run: `npm run dev` → abrir `http://localhost:3000/preview`.
Expected: bate visualmente com o mockup `final.html` aprovado (faixa vermelha, 3 blocos, barras). Ajuste o CSS até bater.

- [ ] **Step 4: Commit**
```bash
git add lib/render.tsx app/preview/page.tsx && git commit -m "feat: template HTML executivo claro + preview"
```

---

## Task 12: HTML → PDF

**Files:**
- Create: `lib/pdf.ts`

- [ ] **Step 1: Implementar**

Create `lib/pdf.ts`:
```ts
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
```

- [ ] **Step 2: Verificar local (manual)**

Crie um script temporário `scripts/try-pdf.mjs` que importa `renderRelatorioHTML` com os dados fake + `htmlToPdf` e grava `out.pdf`. Local, o `@sparticuz/chromium` precisa de um Chrome; defina `executablePath` pro Chrome instalado se necessário, OU confie no caminho da Vercel e valide o PDF só no deploy (Task 15). Abra `out.pdf` e confira o layout.

- [ ] **Step 3: Commit**
```bash
git add lib/pdf.ts && git commit -m "feat: html para pdf via puppeteer/chromium"
```

---

## Task 13: Post no Discord

**Files:**
- Create: `lib/discord.ts`, `lib/discord.test.ts`

- [ ] **Step 1: Teste do builder de payload**

Create `lib/discord.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildDiscordForm } from './discord'

describe('buildDiscordForm', () => {
  it('monta multipart com arquivo e mensagem', () => {
    const fd = buildDiscordForm(Buffer.from('pdf'), 'relatorio.pdf', '01–07 jun 2026')
    expect(fd.get('payload_json')).toContain('Relatório Semanal')
    expect(fd.has('files[0]')).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- discord`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Create `lib/discord.ts`:
```ts
export function buildDiscordForm(pdf: Buffer, filename: string, semanaLabel: string): FormData {
  const fd = new FormData()
  fd.set('payload_json', JSON.stringify({ content: `📊 **Relatório Semanal da Operação** — semana ${semanaLabel}` }))
  fd.set('files[0]', new Blob([pdf], { type: 'application/pdf' }), filename)
  return fd
}

export async function postToDiscord(pdf: Buffer, semanaLabel: string): Promise<void> {
  const filename = `relatorio-semanal-${semanaLabel.replace(/[^\dA-Za-z]+/g, '-')}.pdf`
  const fd = buildDiscordForm(pdf, filename, semanaLabel)
  const res = await fetch(process.env.DISCORD_WEBHOOK_URL!, { method: 'POST', body: fd })
  if (!res.ok) throw new Error(`Discord ${res.status}: ${await res.text()}`)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- discord`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add lib/discord.ts lib/discord.test.ts && git commit -m "feat: post do pdf no discord"
```

---

## Task 14: Rota orquestradora

**Files:**
- Create: `app/api/relatorio-semanal/route.ts`

- [ ] **Step 1: Implementar**

Create `app/api/relatorio-semanal/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { buildRelatorio } from '@/lib/aggregate'
import { renderRelatorioHTML } from '@/lib/render'
import { htmlToPdf } from '@/lib/pdf'
import { postToDiscord } from '@/lib/discord'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '') || req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const rel = await buildRelatorio(new Date())
    const pdf = await htmlToPdf(renderRelatorioHTML(rel))
    const dry = req.nextUrl.searchParams.get('dry') === '1'
    if (!dry) await postToDiscord(pdf, rel.semanaLabel)
    return NextResponse.json({ ok: true, semana: rel.semanaLabel, posted: !dry })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verificar typecheck e dry-run local (manual)**

Run: `npm run typecheck` (sem erros).
Com `.env.local` preenchido: `npm run dev`, então `curl "http://localhost:3000/api/relatorio-semanal?secret=...&dry=1"`.
Expected: `{ ok: true, semana: "...", posted: false }` e nenhum erro de fonte. Investigue qualquer fonte que falhar.

- [ ] **Step 3: Commit**
```bash
git add app/api/relatorio-semanal/route.ts && git commit -m "feat: rota orquestradora protegida por secret"
```

---

## Task 15: Cron + deploy Vercel

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Cron config**

Create `vercel.json`:
```json
{
  "crons": [{ "path": "/api/relatorio-semanal", "schedule": "0 11 * * 1" }]
}
```
(`0 11 * * 1` UTC = segunda 08:00 BRT. A Vercel injeta o header de cron; a rota também aceita `?secret=` pra teste manual.)

- [ ] **Step 2: Deploy + envs**

Run:
```bash
vercel link
vercel env add CRON_SECRET production   # repetir pra cada env do .env.example
vercel deploy --prod
```
(ou configurar as envs no painel da Vercel; valores em `CREDENCIAIS.md`.)

- [ ] **Step 3: Smoke test em produção (manual)**

`curl "https://<deploy>.vercel.app/api/relatorio-semanal?secret=...&dry=1"` → confirma que puxa as 5 fontes e gera o PDF sem postar. Depois rode sem `dry=1` uma vez e confirme o PDF chegando no canal do Discord, com layout correto.

- [ ] **Step 4: Commit**
```bash
git add vercel.json && git commit -m "chore: cron segunda 08h + deploy"
```

---

## Self-Review (cobertura da spec)

- ✅ PDF Executivo Claro + cores Transfast — Task 11
- ✅ Discord seg 08h BRT — Tasks 13, 15
- ✅ Período semana anterior BRT — Task 2
- ✅ Fiscal: emitidos/cancelados/denegados/prejuízo/motivos/SLA ciclo — Tasks 6, 9, 10
- ✅ Suporte: viagens/pontualidade/antecipadas/atrasadas/ocorrências por categoria — Tasks 3, 7
- ✅ Closer: total contratado (frete motorista)/economizado %+R$/SLA postagem/SLA fechamento — Task 8
- ✅ App Vercel dedicado, 5 fontes, HTML→PDF — Tasks 1–15
- ⚠️ Pré-requisitos (denegação dropdown; coluna `motorista_registrado_em`) — fora deste plano; o app degrada graciosamente (Tasks 6 e 8 tratam ausência).

## Itens que exigem confirmação durante a execução (já com fallback no código)
- SIIMP: endpoint/status real de "emitidos" — Task 6 Step 5.
- Google Sheets: aba/range e índices de coluna — Task 7 Step 5.
- closer-calc: denominador do % de economia — Task 8 Step 5.
- SLA webhook: nome do campo numérico de duração — Task 9 Step 5.
