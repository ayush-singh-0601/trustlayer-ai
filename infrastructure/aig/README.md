# Tencent AI-Infra-Guard integration

TrustLayer uses Tencent AI-Infra-Guard (AIG) as an optional local scanning engine. AIG is not TrustLayer's database, user interface, or hosted backend.

## User commands

```sh
npm run scanner:start
npm run scanner:status
npm run scanner:stop
```

`scanner:start` pulls and starts the pinned `aig-server` and `aig-agent` images from `compose.yaml`, then waits for the local API to become healthy. Port 8088 is bound to `127.0.0.1`; the agent has no host port.

The AIG agent requires privileged container access, unconfined seccomp, and 2 GB shared memory. Docker is therefore optional: users who do not want that boundary can run TrustLayer in context-only mode.

## Maintainer pin and contract review

The reviewed source and runtime images are aligned to AIG `v4.1.15`. `upstream.lock.json` records its immutable commit.

```sh
npm run aig:sync
npm run aig:verify
```

`aig:sync` checks out that exact source revision into ignored `.upstream/AI-Infra-Guard`. `aig:verify` confirms that its Swagger routes and supported task types still match the TrustLayer adapter. TrustLayer imports no AIG source at runtime.

The upstream repository contains paths that differ only by letter case. Git may warn about collisions on Windows; contract verification is still supported, while upstream image builds should use a case-sensitive filesystem.

When upgrading, update the full source commit, both Compose image tags, adapter fixtures, and documentation together. Never switch the local runtime to mutable `latest` tags.
