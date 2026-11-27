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

1. **Create the npm organization `patina-ui`** at npmjs.com/org/create (the free plan is
   enough for public packages). Publishing fails with `404 Scope not found` until it exists.
2. **Create a token for CI.** On npmjs.com, go to your avatar → Access Tokens → Generate New
   Token → **Granular Access Token**:
   - **packages and scopes:** read and write on the `@patina-ui` scope (create the
     organization first, or the scope can't be selected);
   - **"Bypass two-factor authentication":** tick it. With 2FA on your account, publishing
     otherwise fails with `403 … granular access token with bypass 2fa enabled is required`,
     because CI can't type a one-time code;
   - **expiry:** as long as it allows. Note when it runs out.
3. **Store it on GitHub** as the Actions secret `NPM_TOKEN`, under _Settings → Secrets and
   variables → Actions_.
4. **Let Actions open pull requests.** Under _Settings → Actions → General → Workflow
   permissions_, tick _Allow GitHub Actions to create and approve pull requests_.
5. **Optional: switch to trusted publishing.** Since the repo is public and the packages
   exist, you can replace the token with npm trusted publishing: on each package's npm page,
   _Settings → Trusted publishing → GitHub Actions_, repo `paulocerez/patina`, workflow
   `release.yml`. Then delete the `NPM_TOKEN` secret.

Status: all of the above except step 5 is done, and 0.1.0 is published.

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

New versions can take a few minutes to show up on npm, because the registry's public
metadata lags behind the publish. `npm access get status @patina-ui/core` confirms a package
exists sooner.

```sh
npm view @patina-ui/core version
mkdir /tmp/try && cd /tmp/try && npm init -y && npm i @patina-ui/core @patina-ui/react @patina-ui/server @patina-ui/cli
npx patina --help
```

## Breaking changes and the Action's major tag

While on `0.x`, a minor bump may contain breaking changes (semver for 0.x). The Action is
pinned by major tag (`@v0`). At `1.0.0` the workflow starts a `v1` tag and leaves `v0` where it
was, so existing users aren't moved onto breaking changes.

## Provenance

Releases built by the workflow from this public repo get npm provenance: a signed link from
each package version to the commit and workflow run that built it. The workflow turns it on
by writing `provenance=true` to the runner's user-level npm config (never to the repository). pnpm doesn't read the `NPM_CONFIG_PROVENANCE`
variable, which is why 0.1.0 shipped without provenance. Later versions will have it. Local
`pnpm release` runs don't get provenance.
