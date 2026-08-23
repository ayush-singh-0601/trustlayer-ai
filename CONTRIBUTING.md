# Contributing to TrustLayer AI

Thanks for helping build a practical, local-first way to understand AI access risk. Contributions of code, tests, documentation, threat research, UX improvements, and reproducible bug reports are welcome.

## Before you start

- Search [existing issues](https://github.com/ayush-singh-0601/trustlayer-ai/issues) and [discussions](https://github.com/ayush-singh-0601/trustlayer-ai/discussions).
- Use a [feature request](https://github.com/ayush-singh-0601/trustlayer-ai/issues/new?template=feature_request.yml) for a concrete change or a discussion for an early idea.
- Never post secrets, private targets, unredacted scan evidence, or attack transcripts.
- Read [SECURITY.md](SECURITY.md) for vulnerabilities that should be reported privately.

## Local setup

Requirements: Node.js 22.16 or newer and npm. No database server, cloud account, or API key is required.

```sh
npm ci
npm test
npm run typecheck
npm run build
npm audit
npm start -- --no-open
```

Open `http://localhost:3000` for the final smoke test. Docker is optional unless you are working on the AIG integration.

## Good first contributions

- Reproduce and fix an issue labeled `good first issue`.
- Improve accessibility, empty states, onboarding, or documentation.
- Add deterministic tests for authorization, scoring, redaction, or target validation.
- Propose a scanner adapter that fits the neutral `packages/scanner-sdk` boundary.

## Engineering expectations

- Keep the API and scanner ports loopback-only by default.
- Preserve the no-account, no-telemetry, SQLite-first experience.
- Include migrations or compatible initialization logic when the embedded schema changes.
- Add or update tests for behavior changes.
- Scanner changes need sanitized fixtures, target-validation coverage, evidence-redaction tests, and deterministic normalized output.
- Never commit credentials, private endpoint details, attack transcripts, local `.trustlayer` data, or unredacted scanner results.
- Do not weaken the explicit-authorization gate for active scans.

Changes to the AIG contract must update `infrastructure/aig/upstream.lock.json`, keep the source tag and Compose image tags aligned, and pass `npm run aig:verify`.

## Pull requests

Keep pull requests focused and explain the user-facing outcome. Before opening one:

1. Run the local validation commands above.
2. Update documentation when behavior or setup changes.
3. Confirm no sensitive data or generated local state is included.
4. Link the issue the change addresses.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
