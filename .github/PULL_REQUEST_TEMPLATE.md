## Summary

<!-- What changed, and why? Link any issue this closes. -->

-

## Type of change

<!-- Mark the most accurate option(s). -->

- [ ] Bug fix
- [ ] New feature
- [ ] Performance improvement
- [ ] Refactor / internal cleanup
- [ ] Documentation
- [ ] Tests only
- [ ] Build / CI / tooling

## Risk and compatibility

<!-- Describe any API, rendering, browser, Node, jsPDF, or svg2pdf.js compatibility risk. -->

- Public API change: <!-- yes/no; explain if yes -->
- Runtime dependency change: <!-- yes/no; explain if yes -->
- Affects `jspdf-blend-modes/gstate` DOM-free subpath: <!-- yes/no -->
- Touches `src/internal-api.ts` or jsPDF internals: <!-- yes/no -->

## Verification

<!-- Paste commands run locally. If a command was not relevant, say why. -->

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Manual PDF/demo verification, if rendering changed:

## Checklist

- [ ] I have read and followed `CONTRIBUTING.md`.
- [ ] New public APIs have TSDoc and README examples.
- [ ] User-visible changes are documented in `CHANGELOG.md`.
- [ ] New behaviour is covered by tests.
- [ ] No new direct access to `(pdf as any).internal` outside `src/internal-api.ts`.
- [ ] `jspdf-blend-modes/gstate` still imports without DOM globals.
