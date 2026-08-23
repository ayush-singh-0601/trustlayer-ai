# Verification status

Verified locally on 2026-08-23:

- `npm test`: 32 tests passed across contracts, risk scoring, scanner adaptation and target safety, API behavior, embedded SQLite persistence, and the AIG worker. The web workspace currently has no component test files and exits successfully with `--passWithNoTests`.
- `npm run typecheck`: all six active workspaces passed.
- `npm run build`: the shared packages, local API, worker, and optimized Next.js application built successfully.
- `npm audit`: zero known dependency vulnerabilities across production and development dependencies.
- `npm run aig:sync` checked out AIG `v4.1.15` at immutable commit `31b2184b0b5656f44b3cb2eb5164775dc750c46f`.
- `npm run aig:verify` matched the pinned task submission, status, and result routes plus agent, infrastructure, MCP, and model red-team task types.
- First-run smoke test: `npm start -- --no-open` automatically rebuilt changed source, started the API and UI on loopback, reported the local data directory, and a second invocation detected the running instance cleanly.
- Browser smoke test: the dashboard reported context-only mode, accepted an authorized local HTTP endpoint, created a partial assessment with explicit coverage, rendered without browser warnings or errors, and reloaded the same asset and assessment from SQLite after a complete application restart.

Environment-specific gates not claimed as complete:

- Docker is unavailable in this environment, so the pinned AIG server and privileged agent images were not pulled or executed. `npm run scanner:status` was verified to fail with a concise optional-Docker explanation.
- `run.sh` was not executed on macOS or Linux; its behavior is covered by the cross-platform Node launcher and the GitHub Actions Linux job once CI runs.
- The web workspace has browser smoke coverage but does not yet have automated component tests.
