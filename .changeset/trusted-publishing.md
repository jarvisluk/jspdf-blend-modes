---
"jspdf-blend-modes": patch
---

Switch the release pipeline to use npm Trusted Publishing (OIDC).

- `package.json` repository/homepage/bugs URLs use the canonical lowercase
  GitHub login (`jarvisluk`) so npm's trusted-publisher validation of
  `repository.url` matches exactly.
- Release workflow upgraded to Node 22.14 and forces an `npm install -g
  npm@latest` step so the runner has `npm` >= 11.5.1, the minimum that
  understands OIDC trusted publishing.
- `NPM_TOKEN` env is kept as a temporary fallback; it should be removed
  and revoked once the first OIDC publish succeeds.

No user-facing API changes.
