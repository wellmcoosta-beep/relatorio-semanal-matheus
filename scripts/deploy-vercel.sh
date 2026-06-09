#!/usr/bin/env bash
# Deploy do relatório semanal na Vercel (team transfast).
# Lê os segredos direto dos .env.local dos repos existentes — nada é digitado aqui.
# Uso: VERCEL_TOKEN=... DISCORD_DM_USER_ID=... bash scripts/deploy-vercel.sh
set -euo pipefail

: "${VERCEL_TOKEN:?defina VERCEL_TOKEN}"
: "${DISCORD_DM_USER_ID:?defina DISCORD_DM_USER_ID}"
SCOPE=transfast
PROJECT=relatorio-semanal-matheus
ROOT="/c/Workspace/Projects/relatorio semanal matheus"
COT="/c/Workspace/Projects/Site cotacoes transfast/transfast-cotacoes/.env.local"
FIS="/c/Workspace/Projects/transfast-fiscal/.env.local"

cd "$ROOT"
val() { grep -E "^$2=" "$1" | head -1 | cut -d= -f2-; }

CRON_SECRET="${CRON_SECRET:-tf-relsem-$(date +%s)-$RANDOM}"

# valores
COTACOES_SUPABASE_URL="$(val "$COT" NEXT_PUBLIC_SUPABASE_URL)"
COTACOES_SUPABASE_SERVICE_KEY="$(val "$COT" SUPABASE_SERVICE_ROLE_KEY)"
DISCORD_BOT_TOKEN="$(val "$COT" DISCORD_BOT_TOKEN)"
FISCAL_SUPABASE_URL="$(val "$FIS" SUPABASE_URL)"
FISCAL_SUPABASE_SERVICE_KEY="$(val "$FIS" SUPABASE_SERVICE_KEY)"
SIIMP_URL="$(val "$FIS" SIIMP_URL)"
SIIMP_API_KEY="$(val "$FIS" SIIMP_API_KEY)"
SLA_WEBHOOK_URL="https://managern8neditor01.vamooai.cloud/webhook/goalfy-sla-dashboard-json"
GOOGLE_SHEET_ID="1kGotRwF6ODwguFEQ-fvw50OjaH-Ztw2IjKFtDOIPC4s"

VC() { npx --yes vercel@latest "$@" --scope "$SCOPE" --token "$VERCEL_TOKEN"; }

echo "==> criando projeto $PROJECT (ignora se já existe)"
VC project add "$PROJECT" 2>/dev/null || true

echo "==> linkando projeto $PROJECT"
VC link --yes --project "$PROJECT"

addenv() {
  local name="$1" value="$2"
  # remove se já existir (ignora erro) e adiciona em todos os ambientes
  printf 'y\n' | VC env rm "$name" production >/dev/null 2>&1 || true
  printf '%s' "$value" | VC env add "$name" production >/dev/null 2>&1 && echo "   set $name"
}

echo "==> configurando env vars (production)"
addenv CRON_SECRET                   "$CRON_SECRET"
addenv COTACOES_SUPABASE_URL         "$COTACOES_SUPABASE_URL"
addenv COTACOES_SUPABASE_SERVICE_KEY "$COTACOES_SUPABASE_SERVICE_KEY"
addenv FISCAL_SUPABASE_URL           "$FISCAL_SUPABASE_URL"
addenv FISCAL_SUPABASE_SERVICE_KEY   "$FISCAL_SUPABASE_SERVICE_KEY"
addenv SIIMP_URL                     "$SIIMP_URL"
addenv SIIMP_API_KEY                 "$SIIMP_API_KEY"
addenv SIIMP_STATUS_AUTORIZADO       "1"
addenv GOOGLE_SHEET_ID               "$GOOGLE_SHEET_ID"
addenv GOOGLE_SHEET_GID              "0"
addenv SLA_WEBHOOK_URL               "$SLA_WEBHOOK_URL"
addenv DISCORD_BOT_TOKEN             "$DISCORD_BOT_TOKEN"
addenv DISCORD_DM_USER_ID            "$DISCORD_DM_USER_ID"

echo "==> deploy de produção"
VC deploy --prod --yes
echo "==> CRON_SECRET usado: $CRON_SECRET"
echo "OK"
