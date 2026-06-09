import { DateTime } from 'luxon'
import type { RelatorioSemanal } from './types'

const brl = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)

export function renderRelatorioHTML(rel: RelatorioSemanal): string {
  const now = DateTime.now().setZone('America/Sao_Paulo').toFormat('dd/MM/yyyy HH:mm')

  // Donut for pontualidade
  const CIRCUM = 144.5 // 2π × 23
  const pct = rel.suporte.pontualidadePct
  const viagens = rel.suporte.viagens
  const donutOffset = viagens === 0 ? CIRCUM : CIRCUM * (1 - pct / 100)
  const donutLabel = viagens === 0 ? '—' : `${pct}%`
  const donutColor = '#15803d'

  const donutSvg = `<svg width="56" height="56" viewBox="0 0 56 56">
    <circle cx="28" cy="28" r="23" fill="none" stroke="#eee" stroke-width="6"/>
    <circle cx="28" cy="28" r="23" fill="none" stroke="${donutColor}" stroke-width="6"
      stroke-dasharray="${CIRCUM}" stroke-dashoffset="${donutOffset.toFixed(1)}"
      stroke-linecap="round" transform="rotate(-90 28 28)"/>
    <text x="28" y="32" text-anchor="middle" font-size="14" font-weight="700" fill="${donutColor}">${donutLabel}</text>
  </svg>`

  // Ocorrências barlines
  const totalOcorr = rel.suporte.ocorrencias.reduce((s, o) => s + o.qtd, 0)
  const barlines =
    rel.suporte.ocorrencias.length === 0
      ? `<div class="muted">Sem atrasos no per&#237;odo</div>`
      : rel.suporte.ocorrencias
          .map((o) => {
            const w = totalOcorr > 0 ? Math.round((o.qtd / totalOcorr) * 100) : 0
            return (
              `<div class="barline"><span>${o.categoria}</span><span>${o.qtd}</span></div>` +
              `<div class="track"><div class="fill" style="width:${w}%"></div></div>`
            )
          })
          .join('')

  // Motivos de denegação — compact line
  const motivosLine =
    rel.fiscal.motivosDenegacao.length === 0
      ? ''
      : `<div class="motivos">Motivos de denega&#231;&#227;o: ${rel.fiscal.motivosDenegacao.map((m) => `${m.motivo} (${m.qtd})`).join(' &middot; ')}</div>`

  // Destaques band
  const destaquesBase = `<b>Destaques:</b> pontualidade de entregas em <b>${pct}%</b>, <b>${brl(rel.closer.economizadoValor)}</b> economizados pelo closer e <b>${rel.fiscal.denegados}</b> denega&#231;&#245;es no per&#237;odo.`
  const destaquesOcorr =
    rel.suporte.ocorrencias.length > 0
      ? ` Principal ofensor de atraso: ${rel.suporte.ocorrencias[0].categoria}.`
      : ''
  const destaques = destaquesBase + destaquesOcorr

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relat&#243;rio Semanal</title><style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#fff;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;padding:36px;}
  .hd{padding:30px 0 22px;border-bottom:3px solid #C20E1A;}
  .kicker{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#C20E1A;font-weight:700;}
  .h1{font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:700;letter-spacing:-.5px;margin:8px 0 2px;}
  .sub{font-size:12px;color:#6b6b6b;}
  .summary{padding:16px 0;background:#faf7f7;font-size:13px;color:#333;border-bottom:1px solid #eee;line-height:1.5;padding-left:0;padding-right:0;}
  .summary-inner{padding:16px 0;}
  .summary b{color:#111;}
  .sec{padding:20px 0;border-bottom:1px solid #efefef;display:grid;grid-template-columns:120px 1fr;gap:18px;}
  .secname{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#C20E1A;font-weight:700;padding-top:4px;}
  .kpis{display:flex;gap:34px;flex-wrap:wrap;align-items:flex-start;}
  .kpi .n{font-size:25px;font-weight:700;letter-spacing:-.5px;font-variant-numeric:tabular-nums;}
  .kpi .l{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.4px;margin-top:1px;}
  .kpi .n.g{color:#15803d;}
  .kpi .n.r{color:#C20E1A;}
  .barline{font-size:11px;color:#444;display:flex;justify-content:space-between;margin:0 0 3px;}
  .track{height:5px;background:#f0eaea;border-radius:3px;overflow:hidden;margin-bottom:7px;width:220px;}
  .fill{height:100%;background:#C20E1A;}
  .motivos{font-size:10px;color:#999;margin-top:8px;}
  .muted{font-size:11px;color:#aaa;margin-top:4px;}
  .ft{padding:14px 0 0;display:flex;justify-content:space-between;font-size:10px;color:#999;letter-spacing:.3px;border-top:1px solid #efefef;margin-top:4px;}
  .oc-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;}
  .no-border{border-bottom:none;}
  svg text{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;}
</style></head><body>
  <div class="hd">
    <div class="kicker">TRANSFAST &middot; RELAT&#211;RIO SEMANAL DA OPERA&#199;&#195;O</div>
    <div class="h1">Semana ${rel.semanaLabel}</div>
    <div class="sub">Fiscal &middot; Suporte &middot; Closer &#8212; vis&#227;o consolidada da lideran&#231;a</div>
  </div>

  <div class="summary-inner">
    <div class="summary">${destaques}</div>
  </div>

  <div class="sec">
    <div class="secname">Fiscal</div>
    <div class="kpis">
      <div class="kpi"><div class="n">${rel.fiscal.ctesEmitidos}</div><div class="l">CT-es emitidos</div></div>
      <div class="kpi"><div class="n r">${rel.fiscal.cancelados}</div><div class="l">Cancelados</div></div>
      <div class="kpi"><div class="n r">${rel.fiscal.denegados}</div><div class="l">Denegados</div></div>
      <div class="kpi"><div class="n">${brl(rel.fiscal.prejuizoIcms)}</div><div class="l">Prej&#250;izo ICMS</div></div>
      <div class="kpi"><div class="n">${rel.fiscal.slaCicloLabel}</div><div class="l">SLA ciclo &middot; gargalo ${rel.fiscal.faseMaisLenta}</div></div>
      ${motivosLine}
    </div>
  </div>

  <div class="sec">
    <div class="secname">Suporte</div>
    <div class="kpis">
      <div class="kpi">
        ${donutSvg}
        <div class="l" style="text-align:center;margin-top:2px">Pontualidade</div>
        ${viagens === 0 ? '<div class="muted" style="text-align:center;font-size:10px">sem viagens</div>' : ''}
      </div>
      <div class="kpi"><div class="n">${rel.suporte.viagens}</div><div class="l">Viagens</div></div>
      <div class="kpi"><div class="n g">${rel.suporte.antecipadas}</div><div class="l">Antecipadas</div></div>
      <div class="kpi"><div class="n r">${rel.suporte.atrasadas}</div><div class="l">Atrasadas</div></div>
      <div class="kpi" style="min-width:240px">
        <div class="oc-label">Ocorr&#234;ncias de atraso</div>
        ${barlines}
      </div>
    </div>
  </div>

  <div class="sec no-border">
    <div class="secname">Closer</div>
    <div class="kpis">
      <div class="kpi"><div class="n">${brl(rel.closer.totalContratado)}</div><div class="l">Total contratado</div></div>
      <div class="kpi"><div class="n g">${brl(rel.closer.economizadoValor)}</div><div class="l">Economizado &middot; ${rel.closer.economizadoPct}%</div></div>
      <div class="kpi"><div class="n">${rel.closer.slaPostagemLabel}</div><div class="l">SLA postagem</div></div>
      <div class="kpi"><div class="n">${rel.closer.slaFechamentoLabel}</div><div class="l">SLA fechamento</div></div>
    </div>
  </div>

  <div class="ft">
    <span>TRANSFAST LOG&#205;STICA &middot; Documento confidencial</span>
    <span>Gerado em ${now}</span>
  </div>
</body></html>`
}
