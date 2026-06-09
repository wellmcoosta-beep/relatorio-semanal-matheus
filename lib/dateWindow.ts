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
