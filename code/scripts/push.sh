#!/usr/bin/env bash
set -euo pipefail

# Push changes to the client's repo (enterdevsas/dromedario_pedidos).
# Forces commits to be authored as the client's GitHub account instead of
# your personal one, so Vercel's Hobby-plan collaborator check keeps passing.
#
# Usage: ./scripts/push.sh "commit message"

cd "$(dirname "$0")/.."

git config user.name "Enterdev SAS"
git config user.email "130387196+enterdevsas@users.noreply.github.com"

if [ -z "${1:-}" ]; then
  echo "Uso: ./scripts/push.sh \"mensaje del commit\"" >&2
  exit 1
fi

git status --short

git add -A
git commit -m "$1"
git push origin main
