# TrustLayer local product specification

Status: active

## Goal

Give an individual developer or security practitioner a useful AI-system trust assessment on their own device with minimal setup and no hosted service.

## Core promises

- Open source under Apache-2.0.
- One local start script after installing Node.js.
- No sign-up, subscription, cloud database, telemetry, or required API key.
- Persistent local SQLite history.
- Useful context and permission analysis without Docker.
- Optional deeper technical scanning through a pinned local AIG integration.
- Explicit authorization before every active scan target is accepted.

## Primary workflow

1. Start TrustLayer and open the local dashboard.
2. Register an AI service, self-hosted endpoint, model gateway, or other supported system.
3. Describe data sensitivity, business criticality, autonomy, and permissions.
4. Confirm authorization for the registered target.
5. Run an assessment.
6. Review deterministic Trust Score, findings, coverage, and remediation guidance.

## Non-goals

- Multi-tenant SaaS, billing, hosted accounts, enterprise SSO, or cloud deployment infrastructure.
- Exposing TrustLayer or AIG as an internet-facing service.
- Requiring Docker for inventory and context-only scoring.
- Replacing human authorization, legal review, or security judgment.

## Release acceptance

- `run.ps1` and `run.sh` bootstrap missing dependencies and start on loopback.
- The first source run builds automatically and opens the UI.
- Assets and completed assessments survive an application restart.
- The dashboard clearly distinguishes context-only and AIG-connected modes.
- Local HTTP endpoints work; metadata and unsafe destinations remain blocked.
- Unit tests, type checking, production build, dependency audit, and a browser smoke test pass.
