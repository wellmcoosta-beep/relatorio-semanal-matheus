# Relatório Semanal da Operação (Matheus) — Design

*Data: 2026-06-08 · Autor: Wellington + Claude*

## Objetivo

Matheus (liderança) pediu um relatório semanal dos 3 setores do Wellington — **Fiscal, Suporte e Closer** — pra apresentar toda **segunda-feira 09:00** na reunião de alinhamento da liderança. Hoje seria feito à mão; este projeto **automatiza**: puxa os números das fontes que já existem, monta um **PDF** e posta no **Discord** toda **segunda 08:00** (1h antes da reunião).

## Saída e entrega

- **Formato:** PDF de página única, pegada visual **"Executivo Claro"** (fundo branco, faixa e acentos no vermelho Transfast `#DC2626`, números em fonte mono). Imprime e projeta bem em sala.
- **Canal:** Discord (webhook/canal de liderança).
- **Gatilho:** cron **segunda 08:00 BRT** (= `0 11 * * 1` em UTC na Vercel).
- **Período do relatório:** semana anterior fechada — **segunda 00:00 a domingo 23:59 (BRT)**. Todo filtro de data em BRT, não UTC (ver memória `project-timezone-mes-brt`).

## Arquitetura

**App Next.js dedicado**, deployado na Vercel, na pasta `C:\Workspace\Projects\relatorio semanal matheus`. Uma rota orquestra tudo:

```
SIIMP ─────────────┐
transfast-fiscal ──┤   app/api/relatorio-semanal/route.ts
(Supabase)         │        │ 1. puxa as 5 fontes (lib/sources/*)
dash SLA (n8n) ────┼──────▶ │ 2. agrega no modelo semanal (lib/report/aggregate)
planilha Google ───┤        │ 3. renderiza HTML/React (lib/report/render)
cotações (Supabase)┘        │ 4. HTML → PDF (lib/report/pdf)
                            │ 5. posta no Discord (lib/discord)
                       cron Vercel seg 08h BRT
```

Reusa como **referência** o encanamento PDF+Discord da edge function `gerar-relatorio-mensal` já existente no `transfast-cotacoes`.

### Módulos

| Arquivo | Responsabilidade |
|---|---|
| `lib/sources/fiscal.ts` | CT-es emitidos (SIIMP) + cancelados/denegados/prejuízo/motivos (`transfast-fiscal` Supabase) |
| `lib/sources/suporte.ts` | Lê a planilha Google, parseia status e **categoriza** motivos de atraso |
| `lib/sources/closer.ts` | Total contratado, economizado, SLA postagem, SLA fechamento (`transfast-cotacoes` Supabase) |
| `lib/sources/sla.ts` | SLA operacional (ciclo completo) via webhook JSON do dash SLA (n8n) |
| `lib/report/aggregate.ts` | Junta as fontes no modelo `RelatorioSemanal` |
| `lib/report/render.tsx` | Template HTML/React — Executivo Claro, tokens Transfast |
| `lib/report/pdf.ts` | HTML → PDF (`puppeteer-core` + `@sparticuz/chromium` na Vercel) |
| `lib/discord.ts` | Posta o PDF no Discord |
| `app/api/relatorio-semanal/route.ts` | Orquestra; protegida por secret; alvo do cron |
| `app/preview/page.tsx` | Renderiza o HTML no navegador (iterar layout sem gerar PDF) |
| `vercel.json` | Cron `0 11 * * 1` |

### Credenciais (env)

Service keys dos **2 Supabase** (fiscal + cotações), credenciais **SIIMP**, acesso à **planilha Google** (mesmo método que o `transfast-dashboard` já usa pra ler essa planilha), token do **webhook do dash SLA**, **webhook do Discord**, e um `CRON_SECRET` pra proteger a rota. Valores vêm de `C:\Workspace\CREDENCIAIS.md` — nunca commitar.

## Métricas — definições exatas

### 🧾 Fiscal
- **CT-es emitidos:** total emitido na semana via **SIIMP** (status autorizado). Precedente de query existe.
- **Cancelados:** count em `ctes_cancelados` com `data_cancelamento` na semana.
- **Denegados:** count em `ctes_denegados` com `data_denegacao` na semana.
- **Prejuízo ICMS:** soma de `impacto_financeiro` (cancelados/denegados com `guia_paga`) na semana.
- **Motivos de denegação:** agrupados pelo **campo de lista fechada** (ver Mudança Estrutural 1). Lista proposta:
  1. Serviço não prestado / não realizado
  2. Valor do frete divergente do acordado
  3. Dados do CT-e incorretos (CNPJ / endereço / NF)
  4. NF-e divergente, cancelada ou não vinculada
  5. Mercadoria não entregue / entrega parcial
  6. CT-e em duplicidade
  7. Tomador / destinatário incorreto
  8. Emissão fora do prazo (extemporânea)
  9. Outro (texto livre — fallback)
- **SLA operacional (ciclo completo):** do webhook JSON do dash SLA — **soma das durações médias de todas as fases monitoradas** (workflow operacional inteiro), para ciclos fechados na semana. Mostra tempo médio do ciclo + fase mais lenta. (Renomeado de "SLA de emissão" pra refletir que cobre todas as fases.)

### 📦 Suporte (planilha Google de performance do Suporte)
Fonte: planilha `1kGotRwF6ODwguFEQ-fvw50OjaH-Ztw2IjKFtDOIPC4s`, aba de registro (Data Coleta · CTE · Cliente · Previsão · Data entrega · Status · Motivo do Atraso).
- **Viagens na semana (cargas monitoradas):** count de entregas com `Data entrega` na semana.
- **Pontualidade %:** `(NO PRAZO + ANTECIPADA) / total entregas` da semana. Card mostra a composição ("131 no prazo ou adiantadas").
- **Antecipadas:** count status `ANTECIPADA`.
- **Atrasadas:** count status `ATRASADA`.
- **Principais ocorrências de atraso:** texto livre da coluna `Motivo do Atraso` **agrupado em categorias** por palavras-chave, ranqueado por qtd + %. Apresentação: **barras por categoria**. Mapa inicial (refinável):
  - 🔧 **Mecânico / veículo** — "mecânic", "quebr", "bateria", "estragad", "pneu", "veículo"
  - ⏱️ **Prazo curto / trânsito** — "prazo curt", "trânsito", "tempo curto", "demora", "distan"
  - 🏭 **Cliente / agendamento** — "cliente", "agenda", "receber", "espera", "descarreg"
  - 🔁 **Transbordo** — "transbordo", "transbord"
  - 📋 **Outros** — sem match
  - Texto sem motivo preenchido em carga ATRASADA → conta em "Outros / sem motivo".

### 💼 Closer (`transfast-cotacoes` Supabase)
- **Total contratado:** `SUM(closer_cargas.frete_motorista_closer)` das cargas contratadas na semana (motorista registrado na semana — `motorista_registrado_em`, ver Mudança Estrutural 2).
- **Economizado (% + R$):** R$ = `SUM(cc_gerada)` da semana; % sobre a base elegível, reusando a lógica de `lib/closer-calc.ts` (`isFreteFixoExcluido` / elegibilidade). Mostra os dois.
- **SLA postagem:** média de `postada_em − created_at` das cargas da semana. Já em produção.
- **SLA fechamento:** média de `motorista_registrado_em − created_at` (carga recebida → motorista registrado), cargas registradas na semana. Depende da Mudança Estrutural 2.

## Mudanças estruturais (em repos existentes — pré-requisitos)

**1. Dropdown de motivos de denegação no `transfast-fiscal`**
Hoje `ctes_denegados.motivo` é texto livre. Virar **lista fechada** (a lista acima) na UI (`PreencherDrawer.tsx`), gravando uma categoria estruturada (nova coluna `motivo_categoria` ou enum, preservando `motivo`/`obs_desacordo` legados). Linhas antigas sem categoria entram como "Outro" até reclassificação.

**2. Carimbo de tempo do registro de motorista no `transfast-cotacoes`**
Adicionar `closer_cargas.motorista_registrado_em timestamptz` e carimbar `now()` quando `motorista_registrado` passa de false/null → true (estender o trigger `auto_situacao_operacional` ou BEFORE UPDATE dedicado). Migration idempotente, **forward-only** (SLA de fechamento só mede daqui pra frente).

Ambas são independentes do app de relatório. O relatório pode entrar no ar antes delas: motivos de denegação caem em "Outro/legado" e SLA de fechamento aparece vazio até a coluna existir.

## Layout (Executivo Claro)

Página única, faixa superior vermelha com logo "TRANSFAST" + intervalo da semana. Três blocos (Fiscal / Suporte / Closer), cada um com fileira de 4 tiles de KPI (fundo `#f5f5f7`, borda hairline, número mono, label minúsculo uppercase, descrição curta). Card de destaque (pontualidade, total contratado) com borda vermelha. Ocorrências de atraso como barras horizontais vermelhas com qtd + %. Referência de cores: tokens `--tf-` do `transfast-cotacoes/app/globals.css`.

## Fora de escopo (v1)

- Comparativo semana-a-semana / tendências (possível v2).
- Backfill histórico do SLA de fechamento.
- Dashboard web interativo (a entrega é o PDF; `app/preview` é só pra iterar layout).
- Personalização por destinatário.

## Itens em aberto (resolver na implementação)

- Confirmar a query SIIMP exata de CT-es emitidos (precedente existe; localizar no build).
- Validar com Matheus a lista final de motivos de denegação após uso real.
- Definição de "viagens" por `Data entrega` vs `Data Coleta` — assumido `Data entrega`; ajustar se Matheus quiser por coleta.
