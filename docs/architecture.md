# Local architecture

TrustLayer is a single-user desktop-local web application. It has no hosted control plane and no external database.

```text
Browser on this device
        |
        v
Next.js UI (127.0.0.1:3000)
        |
        v
Fastify API (127.0.0.1:4000) ---> SQLite (.trustlayer/trustlayer.db)
        |
        | only when the optional scanner is running
        v
local worker process <----> AIG server + agent (Docker, 127.0.0.1:8088)
```

## Product boundary

TrustLayer owns asset inventory, explicit scan authorization, target safety validation, business context, normalized findings, deterministic scoring, and local history. Tencent AI-Infra-Guard owns only low-level technical scan execution and is reached through `packages/scanner-sdk`.

Removing or stopping AIG does not remove the inventory or scoring workflow. TrustLayer falls back to context-only assessments and marks their technical coverage as incomplete.

## Assessment lifecycle

1. The local user registers an AI service or endpoint and its business context.
2. Target validation allows public HTTPS and local/private HTTP or HTTPS targets, but rejects credentials in URLs, cloud metadata, link-local, multicast, reserved, and mixed public/private DNS destinations.
3. The user records the exact targets they are authorized to test.
4. Without AIG, TrustLayer calculates permission findings immediately and stores a partial result.
5. With AIG available, the API starts a local worker process. The worker exchanges one-time credentials over loopback, revalidates targets, calls AIG, redacts raw evidence, and returns normalized findings.
6. TrustLayer combines technical and permission findings, calculates Trust Score v1, and persists the result in SQLite.

## Local data and process model

- The API and UI bind only to loopback addresses.
- SQLite uses WAL mode and persists all user-created records under `.trustlayer/` by default.
- There is one fixed local owner identity; there are no accounts, organizations, tenant boundaries, or login setup.
- The optional worker is launched per scan and receives its job through process-local environment state.
- Active scan coordination is in memory. Completed data survives restarts, but an in-flight technical scan should be rerun if TrustLayer is stopped before it completes.

## Why AIG is optional

AIG needs Docker and its agent requires elevated container permissions. Making it optional keeps first use to Node.js plus one script while preserving deeper technical scanning for users who choose to enable it. Its API is never exposed by TrustLayer and the Compose port is bound to `127.0.0.1` only.
