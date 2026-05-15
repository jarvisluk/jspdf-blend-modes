# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).

Each user-visible change should ship with a small markdown file in this folder.
Use `npx changeset` to create one interactively, then commit it together with
your code change.

## Quick reference

`@changesets/cli` is intentionally **not** a `devDependency` — it would only
be useful when you actually create or release a changeset, and pinning it
adds noise to every other contributor's `npm ci`. The npm scripts call it
through `npx`, which transparently fetches and caches the right version.

```bash
npm run changeset           # add a changeset for the current change
npm run version-packages    # consume changesets, bump version, update CHANGELOG
npm run release             # build then publish to npm
```

The [`release` GitHub workflow](../.github/workflows/release.yml) runs
`version-packages` and `release` automatically when changesets land on `main`.
You typically only need `npm run changeset` locally.

## Bump levels

- `patch` — bug fixes, internal refactors, doc-only updates that affect
  semantics (e.g. clarifying a peer-dep range).
- `minor` — new public API surface, new options, additive behaviour.
- `major` — any breaking change to a public export, including the low-level
  `gstate` subpath. Major bumps must include a migration note in the
  changeset body.

The `gstate` subpath is part of the public API; treat changes to it the same
as changes to the main entry point.
