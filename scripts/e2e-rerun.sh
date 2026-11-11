#!/usr/bin/env bash
# Reinicia a stack E2E (banco limpo, reaproveitando o build) e roda o Playwright.
# E2E_SKIP_BUILD= (vazio) força um build novo.
cd "$(dirname "$0")/.."

ports_busy() {
	powershell -NoProfile -Command "if (Get-NetTCPConnection -State Listen -LocalPort 3100,5433 -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
}

for attempt in 1 2 3 4 5; do
	powershell -NoProfile -ExecutionPolicy Bypass -File scripts/e2e-kill.ps1 >/dev/null 2>&1
	sleep 2
	ports_busy || break
done
if ports_busy; then
	echo "[e2e] portas 3100/5433 continuam ocupadas; abortando" >&2
	exit 1
fi

rm -f .data/e2e-stack.log
E2E_SKIP_BUILD=${E2E_SKIP_BUILD-1} bun scripts/e2e-stack.ts > .data/e2e-stack.log 2>&1 &
for i in $(seq 1 400); do
	grep -qE "stack pronta|saiu com código|EBUSY" .data/e2e-stack.log 2>/dev/null && break
	sleep 1
done
if ! grep -q "stack pronta" .data/e2e-stack.log; then
	echo "[e2e] a stack não subiu:" >&2
	tail -30 .data/e2e-stack.log >&2
	exit 1
fi
sleep 2
bun x playwright test --reporter=list "$@"
