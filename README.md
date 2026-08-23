# TrustLayer AI

TrustLayer AI is an open-source, local-first workspace for inventorying AI systems, recording what they can access, running authorized security assessments, and calculating deterministic Trust Scores.

It is not a hosted service. There are no accounts, subscriptions, cloud databases, telemetry, or required API keys. The application binds to your own device, stores data in a local SQLite file, and works without Docker in context-only mode.

## Quick start

Requirements: [Node.js 22.16 or newer](https://nodejs.org/) and npm.

On Windows:

```powershell
.\run.ps1
```

On macOS or Linux:

```sh
sh ./run.sh
```

The first run installs dependencies if needed, builds the project, opens `http://localhost:3000`, and creates `.trustlayer/trustlayer.db`. Later starts reuse that build until source files change.

## Optional technical scanner

TrustLayer can evaluate business context and permissions without additional software. For live technical scans, install Docker Desktop or Docker Engine and start the bundled local Tencent AI-Infra-Guard integration:

```sh
npm run scanner:start
npm start
```

The scanner is optional and stays on `127.0.0.1:8088`. Use `npm run scanner:status` to inspect it and `npm run scanner:stop` to stop it. If TrustLayer is already running when you start the scanner, restart TrustLayer so it can connect.

Only scan systems you own or are explicitly authorized to test.

## What runs locally

- `apps/web` provides the browser interface on `127.0.0.1:3000`.
- `apps/api` provides a loopback-only API on `127.0.0.1:4000`.
- SQLite persists assets, authorizations, assessments, findings, and scores under `.trustlayer/`.
- `packages/risk-engine` calculates deterministic Trust Scores.
- `packages/scanner-sdk` isolates scanner-specific behavior behind a stable adapter.
- `workers/aig-worker` runs only when the optional AIG scanner is available.

Tencent AI-Infra-Guard is not the application backend. It is an optional local scanning engine. TrustLayer owns the workflow, safety validation, normalized findings, and score; AIG performs the low-level technical scan.

## Developer workflow

```sh
npm install
npm test
npm run typecheck
npm run build
npm start -- --no-open
```

Maintainers can inspect the exact reviewed AIG source revision without vendoring it into this repository:

```sh
npm run aig:sync
npm run aig:verify
```

Architecture and scanner-boundary details are in [docs/architecture.md](docs/architecture.md). Current verification evidence is in [docs/verification.md](docs/verification.md).

## License

TrustLayer AI is licensed under the Apache License 2.0. Tencent AI-Infra-Guard is a separate Apache-2.0 project and retains its own copyright and license.
