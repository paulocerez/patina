# Releasing

Four packages are published to npm under the `@patina-ui` scope. They are versioned together
and always share one version number:

| Package             | Contents                                                    |
| ------------------- | ----------------------------------------------------------- |
| `@patina-ui/core`   | spec, manifest, patch engine, catalog (no dependencies)     |
| `@patina-ui/react`  | renderer, hooks, headless primitives                        |
| `@patina-ui/server` | handler, Anthropic adapter, storage, Express adapter, evals |
| `@patina-ui/cli`    | `patina scan` / `check` / `init-action`                     |

The GitHub Action (`packages/action`) isn't on npm. It's used straight from this repo through
the `v0` tag, which every release moves forward. The demo, the quick start, the evals and the
docs tooling are private workspace packages and are never published.

## One-time setup

1. **Create the npm organization `patina-ui`** at npmjs.com/org/create. The free plan is
   enough for public packages. Turn on two-factor auth for your account.
2. **Create a token for CI.** Go to npmjs.com → Access Tokens → _Generate New Token →
   Granular_:
   - permissions: _Read and write_;
   - packages: all packages in `@patina-ui` (for the very first publish, the whole `patina-ui`
     organization);
   - expiry: as short as you're comfortable renewing.
3. **Store it on GitHub** as an Actions secret named `NPM_TOKEN`, under repository _Settings →
   Secrets and variables → Actions_.
4. **Let Actions open PRs.** Under _Settings → Actions → General → Workflow permissions_, turn
   on _Allow GitHub Actions to create and approve pull requests_. The release workflow needs
   it for the "Version Packages" PR.
5. **Optional, once the repo is public.** Releases then get npm provenance automatically. You
   can also switch from the token to npm trusted publishing: on each package's npm page,
   _Settings → Trusted publishing → GitHub Actions_, with repo `paulocerez/patina` and
   workflow `release.yml`.

## Every change

```sh
pnpm changeset
```

Pick patch, minor or major, and write one or two sentences for the changelog. Commit the
generated `.changeset/*.md` file with your PR. PRs that only touch docs, the demo or tests
don't need one.

## Shipping a release

1. When changesets reach `main`, the **Release** workflow opens or updates a **"Version
   Packages"** PR. It bumps the versions and writes the `CHANGELOG.md` files.
2. Review that PR and merge it.
3. The workflow then:
   - builds the packages;
   - runs `changeset publish`, which uses `pnpm publish` so `workspace:^` dependencies become
     real version ranges;
   - pushes the git tags;
   - moves the Action's `v0` tag and adds `action-v<version>`.

## The first release (0.1.0)

The packages already have version `0.1.0` and none of them is on npm yet. After the one-time
setup, the next push to `main` publishes 0.1.0 as is, or re-run the latest **Release**
workflow run. Until `NPM_TOKEN` exists, the workflow skips with a notice instead of failing. To run the release yourself instead,
check it locally first:

```sh
pnpm build
pnpm -r --filter "./packages/*" publish --dry-run   # inspect what would be published
npm login                                           # an account in the patina-ui org
pnpm release                                        # build + changeset publish
```

## Checking a release

```sh
npm view @patina-ui/core version
mkdir /tmp/try && cd /tmp/try && npm init -y && npm i @patina-ui/core @patina-ui/react @patina-ui/server @patina-ui/cli
npx patina --help
```

## Breaking changes and the Action's major tag

While on `0.x`, a minor bump may contain breaking changes (semver for 0.x). The Action is
pinned by major tag (`@v0`). At `1.0.0` the workflow starts a `v1` tag and leaves `v0` where it
was, so existing users aren't moved onto breaking changes.
