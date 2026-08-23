# Contributing

TrustLayer is an Apache-2.0 open-source project. Contributions that improve the zero-hosting, local-first experience are welcome.

## Setup

```sh
npm install
npm test
npm run typecheck
npm run build
npm audit
```

Use `npm start -- --no-open` for a release-mode local smoke test. No database server or cloud account is required.

## Engineering expectations

- Keep the API and scanner ports loopback-only by default.
- Preserve the no-account, no-telemetry, SQLite-first experience.
- Include migrations or compatible initialization logic when the embedded schema changes.
- Scanner changes need sanitized fixtures, target-validation coverage, evidence-redaction tests, and deterministic normalized output.
- Never commit credentials, private endpoint details, attack transcripts, local `.trustlayer` data, or unredacted scanner results.
- Do not weaken the explicit-authorization gate for active scans.

Changes to the AIG contract must update `infrastructure/aig/upstream.lock.json`, keep the source tag and Compose image tags aligned, and pass `npm run aig:verify`.
