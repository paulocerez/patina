[Patina API reference](../../../README.md) / @patina-ui/server/drizzle

# @patina-ui/server/drizzle

Patina's tables as Drizzle definitions, for apps that manage their schema with Drizzle.
Re-export the ones you use from your schema file and `drizzle-kit generate` writes the
migration:

  // db/schema.ts
  export { patinaHistory } from "@patina-ui/server/drizzle";

They match `postgresSchema()` column for column, including the constraint names Postgres
gives that SQL, so a database created either way shows no drift. Which tables you need
depends on the features you use (`postgresTables`): with
`postgresStorage({ query, previews: "memory", requestLog: false, usage: false, followUps: false })`
only `patinaHistory`.

## Variables

- [patinaFollowups](variables/patinaFollowups.md)
- [patinaHistory](variables/patinaHistory.md)
- [patinaProposals](variables/patinaProposals.md)
- [patinaRequests](variables/patinaRequests.md)
- [patinaUsage](variables/patinaUsage.md)
