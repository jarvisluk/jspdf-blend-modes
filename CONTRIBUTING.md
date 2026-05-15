# Contributing to jspdf-blend-modes

Thanks for helping improve `jspdf-blend-modes`. This guide explains how to set
up the project, make changes, and submit reviewable pull requests.

## Code of Conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). By
participating, you agree to uphold it.

## Development setup

Requirements:

- Node.js 18, 20, or 22.
- npm 9+.

```bash
git clone https://github.com/<your-user>/jspdf-blend-modes.git
cd jspdf-blend-modes
npm install

npm run typecheck
npm run lint
npm test
npm run build
```

To run the browser demo:

```bash
cd demo/browser
npm install
npm run dev
```

## Useful scripts

| Script                   | Purpose                                             |
| ------------------------ | --------------------------------------------------- |
| `npm run dev`            | Rebuild with `tsup --watch`.                        |
| `npm run build`          | Build ESM, CJS, and declaration files into `dist/`. |
| `npm run typecheck`      | Run TypeScript without emitting files.              |
| `npm run lint`           | Run ESLint over `src/**/*.ts` and `test/**/*.ts`.   |
| `npm run format`         | Format `src/` and `test/` with Prettier.            |
| `npm test`               | Run the Vitest suite once.                          |
| `npm run test:watch`     | Run Vitest in watch mode.                           |
| `npm run prepublishOnly` | Run the release gate: typecheck, tests, and build.  |

## Repository layout

```text
src/
  index.ts          # high-level browser/DOM entry
  gstate.ts         # low-level DOM-free entry
  modes.ts          # PDF 1.4 blend modes and CSS mapping
  internal-api.ts   # the only allowed jsPDF internal API boundary
  isolate.ts        # isolated SVG cloning helpers
  prepare.ts        # DOM preparation and restoration helpers
  render-svg.ts     # two-pass SVG renderer
  types.ts          # shared public/internal types
test/
  *.test.ts         # Vitest unit and integration tests
  helpers/          # shared test helpers
demo/browser/       # Vite demo for manual PDF checks
```

The public package surface is defined by `package.json#exports`: `.` and
`./gstate`. Other files are internal implementation details.

## Architectural rules

Please preserve these invariants:

1. **All jsPDF internals stay in `src/internal-api.ts`.** Do not access
   `(pdf as any).internal` from other files. Add or extend typed wrappers in
   `src/internal-api.ts` instead.
2. **`jspdf-blend-modes/gstate` must stay DOM-free and SSR-safe.** It must not
   import `window`, `document`, `getComputedStyle`, `svg2pdf.js`, or other
   browser-only code.
3. **DOM mutations must be reversible.** `renderSvgWithBlendModes` and helpers
   must restore hidden elements, baseline changes, and temporary mounts in
   `finally` blocks.
4. **Prefer PDF byte assertions.** For blend-mode behaviour, tests should check
   PDF bytes such as `/Type /ExtGState`, `/BM /Multiply`, and page resource
   references rather than relying only on visual output.
5. **Avoid runtime dependencies.** `jspdf` and `svg2pdf.js` are peer
   dependencies. New runtime dependencies require clear justification in the PR.

## Coding style

- Use Prettier with the project config: semicolons, double quotes, no trailing
  commas, 100-character print width, and 2-space indentation.
- Use relative imports with `.js` extensions in TypeScript source, for example
  `import { isBlendMode } from "./modes.js"`.
- Prefer `unknown` plus narrowing over `any`. If `any` is unavoidable, keep it
  local and explain the constraint.
- Public APIs should have TSDoc. Non-trivial exported functions should include
  an `@example`.
- Comments should explain non-obvious constraints and trade-offs, not narrate
  the code.
- Error messages should be actionable and start with `[jspdf-blend-modes]`.

## Testing expectations

- Add or update tests for every behaviour change.
- Mirror source filenames in `test/` where possible
  (`src/gstate.ts` → `test/gstate.test.ts`).
- Use `compress: false` when generating `jsPDF` instances for byte-stream
  assertions so operators such as `q`, `Q`, `gs`, and `/BM` are visible.
- If you touch `src/gstate.ts`, `src/modes.ts`, or `src/internal-api.ts`, verify
  that the low-level subpath still imports without DOM globals after building:

```bash
npm run build
node --input-type=module -e "import('./dist/gstate.js').then(m => console.log(Object.keys(m)))"
```

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```text
<type>(<scope>)?: <summary>
```

Recommended types:

- `feat` — new user-visible capability.
- `fix` — bug fix.
- `perf` — performance improvement.
- `refactor` — internal restructuring without behaviour change.
- `docs` — documentation only.
- `test` — tests only.
- `build` — build, package, or TypeScript config.
- `ci` — continuous integration.
- `chore` — repository maintenance.

Suggested scopes include `gstate`, `render-svg`, `internal-api`, `prepare`,
`isolate`, `demo`, and `deps`.

Keep the summary imperative and under 72 characters. For breaking changes, use
`!` and include a `BREAKING CHANGE:` footer.

## Pull request workflow

1. Open an issue first for large changes or public API proposals.
2. Branch from `main` with a focused name such as `fix/gstate-name-collision`.
3. Keep each PR to one conceptual change.
4. Update README/TSDoc when public behaviour changes.
5. Add an `## [Unreleased]` entry in `CHANGELOG.md` for user-visible changes.
6. Run the local gate before requesting review:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

7. Fill in the PR template, including risk and manual verification notes.

## PR checklist

- [ ] Typecheck, lint, tests, and build pass locally.
- [ ] User-visible changes are documented.
- [ ] Public APIs have TSDoc and examples where useful.
- [ ] New behaviour is covered by tests.
- [ ] No new direct jsPDF internal access outside `src/internal-api.ts`.
- [ ] `jspdf-blend-modes/gstate` remains DOM-free.
- [ ] New runtime dependencies are justified, if any.

## Security reports

Do not open public issues for vulnerabilities. Follow [SECURITY.md](./SECURITY.md)
instead.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](./LICENSE).
