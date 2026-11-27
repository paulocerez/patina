# Changesets

Every PR that changes a published package (`@patina-ui/core`, `react`, `server`, `cli`) adds a changeset:

```sh
pnpm changeset        # pick the bump (patch / minor / major) and describe the change for the changelog
```

The four packages are versioned together (`fixed`), so they always share one version number.
On `main`, the Release workflow opens a "Version Packages" PR that collects pending changesets;
merging it publishes to npm and moves the GitHub Action's `v0` tag. See `docs/releasing.md`.
