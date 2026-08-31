# TrustLayer hardening plan

This plan records the invariants for the August 2026 reliability pass. Each numbered item is intended to land as an independently reviewable commit with its own tests.

## Trust boundaries

- TrustLayer owns tenant authorization, target authorization, orchestration, normalized findings, scoring, and history.
- AI-Infra-Guard remains an optional private scanner behind the scanner adapter.
- Worker credentials are one-time, callback authentication remains required for retries, and scanner payloads are bounded before persistence.
- A submitted scanner request may never widen the targets explicitly authorized on its job.

## Delivery slices

1. Document the hardening invariants and commit sequence.
2. Reject duplicate set-like contract values.
3. Enforce least-privilege questionnaire consistency.
4. Bound worker job and outcome contracts.
5. Reject non-routable IPv4 target ranges.
6. Reject unsafe IPv6 transition and reserved ranges.
7. Compare authorized targets by canonical URL identity.
8. Keep the highest-risk duplicate finding.
9. Represent incomplete evidence honestly.
10. Make scanner fingerprints independent of result ordering.
11. Bound normalization traversal.
12. Normalize common CVSS representations.
13. Redact credentials embedded in URLs and JWT-like values.
14. Validate the configured scanner origin.
15. Bound scanner HTTP calls with timeouts.
16. Normalize malformed scanner responses into protocol errors.
17. Reject scanner session mismatches.
18. Restrict brokered requests to assigned targets.
19. Retry coordinator callbacks safely.
20. Preserve idempotency request identity in every store.
21. Persist and expose assessment history in memory.
22. Persist and expose findings in memory.
23. Preserve assessment history and findings in SQLite.
24. Prevent stale assessment completion from replacing a newer score.
25. Prepare orchestration atomically before dispatch.
26. Authenticate duplicate callbacks and make finalization retryable.
27. Recover cleanly from dispatch failures.
28. Return explicit API conflicts for idempotency misuse.
29. Expose assessment history and findings through tenant-scoped APIs.
30. Validate server configuration before startup.
31. Make the web workflow scanner-capability aware and resilient.
32. Add assessment polling, history, findings, and regression coverage to the UI.

## Completion gates

The pass is complete only when workspace tests, typechecking, the production build, dependency audit, AIG contract verification, a packaged local runtime smoke test, commit-history review, and the pushed GitHub branch have all been checked independently.
