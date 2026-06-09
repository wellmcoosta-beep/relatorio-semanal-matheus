// Seta as env vars de produção via API REST da Vercel (upsert).
// Lê os segredos dos .env.local dos repos. Uso:
//   VERCEL_TOKEN=... DISCORD_DM_USER_ID=... node scripts/set-env.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const TOKEN = process.env.VERCEL_TOKEN
const DM = process.env.DISCORD_DM_USER_ID
const PROJECT = 'prj_6d4GQ7xgN7RNR0hU78QTx7N7Vcsr'
const TEAM = 'team_BZdcPfrzRhp8r4NghskjSxjx'
if (!TOKEN || !DM) { console.error('faltou VERCEL_TOKEN ou DISCORD_DM_USER_ID'); process.exit(1) }

const envOf = (p) => {
  const o = {}
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^=#]+)=(.*)$/)
    if (m) o[m[1].trim()] = m[2]
  }
  return o
}
const cot = envOf('C:/Workspace/Projects/Site cotacoes transfast/transfast-cotacoes/.env.local')
const fis = envOf('C:/Workspace/Projects/transfast-fiscal/.env.local')
const CRON = 'tf-relsem-' + randomUUID()

const vars = {
  CRON_SECRET: CRON,
  COTACOES_SUPABASE_URL: cot.NEXT_PUBLIC_SUPABASE_URL,
  COTACOES_SUPABASE_SERVICE_KEY: cot.SUPABASE_SERVICE_ROLE_KEY,
  DISCORD_BOT_TOKEN: cot.DISCORD_BOT_TOKEN,
  FISCAL_SUPABASE_URL: fis.SUPABASE_URL,
  FISCAL_SUPABASE_SERVICE_KEY: fis.SUPABASE_SERVICE_KEY,
  SIIMP_URL: fis.SIIMP_URL,
  SIIMP_API_KEY: fis.SIIMP_API_KEY,
  SIIMP_STATUS_AUTORIZADO: '1',
  GOOGLE_SHEET_ID: '1kGotRwF6ODwguFEQ-fvw50OjaH-Ztw2IjKFtDOIPC4s',
  GOOGLE_SHEET_GID: '0',
  SLA_WEBHOOK_URL: 'https://managern8neditor01.vamooai.cloud/webhook/goalfy-sla-dashboard-json',
  DISCORD_DM_USER_ID: DM,
}

let fail = 0
for (const [key, raw] of Object.entries(vars)) {
  const value = String(raw ?? '')
  const res = await fetch(`https://api.vercel.com/v10/projects/${PROJECT}/env?teamId=${TEAM}&upsert=true`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value, type: 'encrypted', target: ['production'] }),
  })
  const ok = res.ok
  if (!ok) { fail++; console.log(`${key}: FAIL ${res.status} ${await res.text()}`) }
  else console.log(`${key}: OK (len=${value.length})`)
}
writeFileSync('.cronsecret', CRON)
console.log(fail ? `FALHARAM ${fail}` : 'TODAS OK')
