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
