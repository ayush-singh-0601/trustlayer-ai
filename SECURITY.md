# Security policy

TrustLayer performs active security testing. Run it only on systems you own or are explicitly authorized to assess.

## Local security model

- The web application, API, and optional AIG endpoint bind to loopback by default.
- Application data is stored locally in `.trustlayer/trustlayer.db`; protect it with your operating-system account and disk encryption.
- TrustLayer accepts public HTTPS targets and local/private HTTP or HTTPS targets for lab and self-hosted use.
- Cloud metadata, link-local, multicast, reserved, credential-bearing, and mixed public/private DNS targets are rejected.
- There is no remote login or multi-user access control. Do not expose ports 3000, 4000, or 8088 to another network.

## Scanner boundary

Tencent AI-Infra-Guard is an optional local dependency. Its agent container requires elevated permissions, so review `compose.yaml`, use trusted images, keep Docker current, and stop the scanner when it is not needed. TrustLayer exchanges short-lived scan data with its worker over loopback and redacts evidence before persistence.

## Reporting vulnerabilities

Until a public security address is established, report vulnerabilities privately to the repository owner. Include the affected component, safe reproduction conditions, and impact. Do not include live third-party data or reusable credentials.
