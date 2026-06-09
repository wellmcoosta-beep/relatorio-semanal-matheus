import type { RelatorioSemanal } from './types'

const brl = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)

export function renderRelatorioHTML(rel: RelatorioSemanal): string {
  const barras = rel.suporte.ocorrencias
    .map(
      (o) =>
        `<div class="bar"><span>${o.categoria}</span><b>${o.qtd} · ${o.pct}%</b></div>` +
        `<div class="track"><div class="fill" style="width:${o.pct}%"></div></div>`,
    )
    .join('')

  const motivos = rel.fiscal.motivosDenegacao
    .map((m) => `<span class="chip">${m.motivo} · ${m.qtd}</span>`)
    .join('')

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><style>
  .pg{background:#fff;border:1px solid #e6e6ea;border-radius:8px;overflow:hidden;font-family:'Segoe UI',system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.18);max-width:680px;margin:0 auto;}
  .pg .top{background:#DC2626;color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:flex-end;}
  .pg .top .t1{font-size:18px;font-weight:800;letter-spacing:.3px;} .pg .top .t1 span{color:#0a0a0a;}
  .pg .top .t2{font-size:11px;opacity:.9;margin-top:2px;}
  .pg .top .wk{font-size:11px;text-align:right;opacity:.95;}
  .pg .blk{padding:14px 20px;border-bottom:1px solid #ececef;}
  .pg .bt{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#DC2626;margin-bottom:10px;display:flex;align-items:center;gap:6px;}
  .row{display:grid;gap:8px;} .r4{grid-template-columns:repeat(4,1fr);}
  .t{background:#f5f5f7;border:1px solid #e6e6ea;border-radius:8px;padding:9px 11px;}
  .t .v{font-size:19px;font-weight:800;color:#18181b;font-family:'Consolas',monospace;line-height:1;} .t .v small{font-size:10px;font-weight:600;}
  .t .l{font-size:8px;text-transform:uppercase;letter-spacing:.3px;color:#71717a;margin-top:4px;font-weight:600;}
  .t .d{font-size:8.5px;color:#52525b;margin-top:3px;}
  .t.hl{background:#fff;border:1.5px solid #DC2626;}
  .g{color:#16a34a!important;} .a{color:#d97706!important;}
  .sub{font-size:9px;color:#71717a;margin:9px 0 5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;}
  .bar{display:flex;justify-content:space-between;font-size:10px;color:#18181b;margin-bottom:2px;}
  .track{height:6px;background:#f0f0f2;border-radius:3px;overflow:hidden;margin-bottom:6px;} .fill{height:100%;background:#DC2626;}
  .mini{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;}
  .chip{font-size:9px;background:#f5f5f7;border:1px solid #e6e6ea;border-radius:20px;padding:2px 8px;color:#52525b;}
</style></head><body>
  <div class="pg">
    <div class="top">
      <div>
        <div class="t1">TRANS<span>FAST</span></div>
        <div class="t2">Relatório Semanal da Operação · Fiscal · Suporte · Closer</div>
      </div>
      <div class="wk">Semana<br><b>${rel.semanaLabel}</b></div>
    </div>

    <div class="blk">
      <div class="bt">🧾 Fiscal</div>
      <div class="row r4">
        <div class="t"><div class="v">${rel.fiscal.ctesEmitidos}</div><div class="l">CT-es emitidos</div></div>
        <div class="t"><div class="v a">${rel.fiscal.cancelados}</div><div class="l">Cancelados</div></div>
        <div class="t"><div class="v a">${rel.fiscal.denegados}</div><div class="l">Denegados</div></div>
        <div class="t"><div class="v a">${brl(rel.fiscal.prejuizoIcms)}</div><div class="l">Prejuízo ICMS</div><div class="d">guia paga + doc cancelado</div></div>
      </div>
      <div class="sub">Motivos de denegação</div>
      <div class="mini">${motivos}</div>
      <div class="sub" style="margin-top:10px;">SLA operacional · ciclo completo</div>
      <div class="mini"><span class="chip">Tempo médio: <b>${rel.fiscal.slaCicloLabel}</b></span><span class="chip">Fase mais lenta: ${rel.fiscal.faseMaisLenta}</span></div>
    </div>

    <div class="blk">
      <div class="bt">📦 Suporte</div>
      <div class="row r4">
        <div class="t"><div class="v">${rel.suporte.viagens}</div><div class="l">Viagens na semana</div><div class="d">cargas monitoradas</div></div>
        <div class="t hl"><div class="v g">${rel.suporte.pontualidadePct}%</div><div class="l">Pontualidade</div><div class="d">${rel.suporte.noPrazo + rel.suporte.antecipadas} no prazo ou adiantadas</div></div>
        <div class="t"><div class="v g">${rel.suporte.antecipadas}</div><div class="l">Antecipadas</div></div>
        <div class="t"><div class="v a">${rel.suporte.atrasadas}</div><div class="l">Atrasadas</div></div>
      </div>
      <div class="sub">Principais ocorrências de atraso</div>
      ${barras}
    </div>

    <div class="blk" style="border-bottom:none">
      <div class="bt">💼 Closer</div>
      <div class="row r4">
        <div class="t hl"><div class="v">${brl(rel.closer.totalContratado)}</div><div class="l">Total contratado</div><div class="d">frete pago ao motorista</div></div>
        <div class="t"><div class="v g">${brl(rel.closer.economizadoValor)}</div><div class="l">Economizado</div><div class="d">${rel.closer.economizadoPct}% sobre a base</div></div>
        <div class="t"><div class="v">${rel.closer.slaPostagemLabel}</div><div class="l">SLA postagem</div><div class="d">carga → postada</div></div>
        <div class="t"><div class="v">${rel.closer.slaFechamentoLabel}</div><div class="l">SLA fechamento</div><div class="d">recebida → motorista registrado</div></div>
      </div>
    </div>
  </div>
</body></html>`
}
