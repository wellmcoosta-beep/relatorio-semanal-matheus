export function buildDiscordForm(pdf: Buffer, filename: string, semanaLabel: string): FormData {
  const fd = new FormData()
  fd.set('payload_json', JSON.stringify({ content: `📊 **Relatório Semanal da Operação** — semana ${semanaLabel}` }))
  fd.set('files[0]', new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), filename)
  return fd
}

export async function postToDiscord(pdf: Buffer, semanaLabel: string): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN!
  const userId = process.env.DISCORD_DM_USER_ID!
  // 1) abre (ou recupera) o canal de DM com o usuário
  const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
    method: 'POST',
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient_id: userId }),
  })
  if (!dmRes.ok) throw new Error(`Discord DM channel ${dmRes.status}: ${await dmRes.text()}`)
  const channel: any = await dmRes.json()
  // 2) posta o PDF nesse canal
  const filename = `relatorio-semanal-${semanaLabel.replace(/[^\dA-Za-z]+/g, '-')}.pdf`
  const fd = buildDiscordForm(pdf, filename, semanaLabel)
  const msgRes = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${token}` },
    body: fd,
  })
  if (!msgRes.ok) throw new Error(`Discord message ${msgRes.status}: ${await msgRes.text()}`)
}
