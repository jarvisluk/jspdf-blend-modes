---
"jspdf-blend-modes": patch
---

Release workflow no longer references the `NPM_TOKEN` secret. The first
OIDC publish (v0.2.2) is verified to have generated a sigstore attestation
(`predicateType: publish/v0.1`), so the legacy token fallback is no longer
needed. The repository's `NPM_TOKEN` secret has been deleted and the
classic token revoked on npmjs.com.
