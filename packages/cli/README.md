# @patina-ui/cli

`patina` sets up and maintains [Patina UI](https://github.com/paulocerez/patina)'s data views.

```sh
npm i -D @patina-ui/cli

npx patina scan          # find your GET endpoints, row types and design system (offline, < 1 s)
npx patina scan --ai     # optional: Claude refines the drafts (needs ANTHROPIC_API_KEY)
npx patina check         # report API/design changes that affect the catalog
npx patina init-action   # add the GitHub Action that checks every PR
npx patina init-agent    # install the Patina UI skill for coding agents (Claude Code; --agents-md for others)
npx patina insights --database-url $DATABASE_URL   # what customers asked for (needs pg)
```

`scan` reads OpenAPI, Prisma, zod, TypeScript types and Express/Hono/Next.js routes, plus your UI kit (shadcn, MUI, Chakra, Mantine, Ant, Tailwind or plain CSS), CSS variables and components. It writes `patina/scan.json`, a draft `patina/catalog.ts`, and `patina/blocks.tsx` with table/chart/number blocks in your own style. Docs: [data views](https://github.com/paulocerez/patina/blob/main/docs/guides/data-views.md), [GitHub Action](https://github.com/paulocerez/patina/blob/main/docs/guides/github-action.md).
