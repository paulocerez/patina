# GitHub Action: check every pull request

The Patina Action runs `patina check` on each pull request. It looks for API and design
changes that affect your data catalog or data blocks, keeps **one** comment on the PR up to
date, and can fail the check.

It catches things like:

| Severity        | Example                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------- |
| ❌ **breaking** | `orders.total` is no longer returned by `/api/orders`. Saved charts that sum it will show nothing |
| ❌ **breaking** | `orders.status` lost the value `REFUNDED`, so filters on it match nothing                         |
| ❌ **breaking** | `customers.name` changed type (string → number)                                                   |
| ❌ **breaking** | `/api/orders` is gone or was renamed, while the catalog still uses it                             |
| ⚠️ to review    | `/api/orders` now returns `discount`, which the catalog doesn't offer                             |
| ⚠️ to review    | a new endpoint `/api/refunds`                                                                     |
| ⚠️ to review    | the UI kit changed (MUI → shadcn), or components the blocks import moved                          |
| ⚠️ to review    | `patina/scan.json` is out of date                                                                 |
| ℹ️ note         | design tokens changed, or a new field looks personal                                              |

It works from the repo's source alone, so there's no `npm install`, no build and no API key.
A typical run takes a few seconds.

## Register it

Generate the workflow:

```sh
npx patina init-action            # writes .github/workflows/patina.yml
```

Or add it by hand:

```yaml
# .github/workflows/patina.yml
name: Patina

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write # to comment

jobs:
  patina:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: paulocerez/patina/packages/action@v0
        with:
          fail-on: breaking # breaking | changed | info | never
```

Commit `patina/scan.json` and `patina/catalog.ts` (from `npx patina scan`), and you're done.

To run it only when relevant files change, add a `paths` filter:

```yaml
on:
  pull_request:
    paths: ["src/**", "prisma/**", "openapi.*", "patina/**", "package.json"]
```

## Inputs

| Input               | Default               |                                                                         |
| ------------------- | --------------------- | ----------------------------------------------------------------------- |
| `working-directory` | `.`                   | where the app lives (for monorepos, e.g. `apps/web`)                    |
| `patina-dir`        | `patina`              | where `scan.json` and `catalog.ts` are, relative to `working-directory` |
| `fail-on`           | `breaking`            | fail the check at this severity or above. `never` only reports          |
| `comment`           | `true`                | keep a PR comment up to date                                            |
| `github-token`      | `${{ github.token }}` | needs `pull-requests: write` to comment                                 |

**Outputs:** `breaking`, `changed` and `info` (counts), for use in later steps.

## How it behaves

- **One comment per PR**, found by a hidden marker and edited in place on every push. When
  nothing affects Patina, no comment is created. If one already exists, it's updated to say
  everything is fine.
- **The job summary** always contains the full report.
- **Forks:** PRs from forks get a read-only token. The Action then skips the comment with a
  warning and still runs the check.
- It **never modifies your repo**. Fixing things is up to you: run `npx patina scan`, compare
  `catalog.draft.ts` with `catalog.ts`, update the catalog, and commit `scan.json`.

## Locally and in other CI systems

```sh
npx patina check                      # markdown report; exit code 1 on breaking findings
npx patina check --fail-on changed    # stricter
npx patina check --format json        # for scripts
```

## Notes

- **Private repo.** If the Patina repository is private, other repositories can only use the
  Action once it's shared. On the Patina repo, go to _Settings → Actions → General → Access_
  and allow access from your organization's repositories. Or copy `packages/action` (with its
  committed `dist/`) into the consuming repo and use `uses: ./path/to/action`.
- **How it reads `catalog.ts`.** It parses the file without running it, so it needs no
  dependencies. It understands the format `patina scan` writes and the usual hand edits.
  Fields defined through variables or spreads are reported as `unknown` and not
  type-checked.
- **What it checks.** Detection is heuristic. It verifies catalog fields only for endpoints
  whose row type it could determine. Everything else shows up as a note, never as a false
  "breaking".
