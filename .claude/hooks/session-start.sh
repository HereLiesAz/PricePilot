#!/bin/bash
# SessionStart hook for Sail (pnpm monorepo).
# Installs workspace dependencies and generates the Prisma client so web
# sessions land ready to lint, typecheck, build, and test.
set -euo pipefail

# Only run inside the remote (Claude Code on the web) environment.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Ensure pnpm is available (matches packageManager in package.json).
if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
  corepack prepare pnpm@10.33.0 --activate >/dev/null 2>&1 || true
fi

# Install workspace deps. `install` (not `--frozen-lockfile`) so the container
# cache is populated and the hook stays idempotent across runs.
pnpm install

# Generate the Prisma client so typecheck/build/tests resolve @sail/db.
pnpm db:generate

echo "Sail dependencies installed; run 'pnpm test' / 'pnpm lint' / 'pnpm build'."
