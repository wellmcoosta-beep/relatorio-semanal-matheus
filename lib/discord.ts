export function buildDiscordForm(pdf: Buffer, filename: string, semanaLabel: string): FormData {
  const fd = new FormData()
  fd.set('payload_json', JSON.stringify({ content: `📊 **Relatório Semanal da Operação** — semana ${semanaLabel}` }))
  fd.set('files[0]', new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), filename)
  return fd
}

export async function postToDiscord(pdf: Buffer, semanaLabel: string): Promise<void> {
  const filename = `relatorio-semanal-${semanaLabel.replace(/[^\dA-Za-z]+/g, '-')}.pdf`
  const fd = buildDiscordForm(pdf, filename, semanaLabel)
  const res = await fetch(process.env.DISCORD_WEBHOOK_URL!, { method: 'POST', body: fd })
  if (!res.ok) throw new Error(`Discord ${res.status}: ${await res.text()}`)
}
