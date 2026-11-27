# A prompt for coding agents

[`skills/patina-ui/SKILL.md`](../skills/patina-ui/SKILL.md) tells a coding agent how to
integrate Patina UI into an app properly. It covers:

- the non-negotiable rules (no generated code, identity from the session, permissions in the
  data layer, a base spec that reproduces the current UI, permanent keys);
- the steps with working code;
- a verification checklist;
- the common mistakes.

A test keeps it accurate (`packages/react/test/skill.test.ts`). Every import, `t.*` helper,
`f.*` helper and CLI command it mentions must exist.

## Use it

**Claude Code.** Install it as a skill in the app's repo. Claude Code then loads it whenever
the work touches Patina:

```sh
npx patina init-agent              # writes .claude/skills/patina-ui/SKILL.md
npx patina init-agent --agents-md  # also adds a pointer to AGENTS.md for other agents
```

**Codex, Cursor and other agents that read `AGENTS.md`.** Use `--agents-md`, or add this to
your own instructions file:

```md
## Patina UI

This app uses Patina UI (@patina-ui/*). Before changing anything Patina-related, read and follow
.claude/skills/patina-ui/SKILL.md (or https://raw.githubusercontent.com/paulocerez/patina/main/skills/patina-ui/SKILL.md).
```

**Any chat or agent, as a one-off prompt.** Paste the file's content, or its raw URL, followed
by the task:

```text
Follow https://raw.githubusercontent.com/paulocerez/patina/main/skills/patina-ui/SKILL.md.
Task: make the orders table on /orders customizable (column order, visibility, rows per page)
for signed-in users. Our auth is NextAuth, the API is Next.js App Router, storage is Postgres via
Drizzle. Use scriptedModel until I add the API key, and run the verification checklist.
```

For agents that browse documentation, [`llms.txt`](../llms.txt) at the repo root indexes all
the docs.

## Good tasks to give an agent

- "Make `<view>` customizable: which columns, their order, and the default filters."
- "Run `npx patina scan`, review the draft catalog with me, and register the data blocks."
- "Gate Patina behind our `patina` feature flag; free plans get no data views."
- "Add 20 eval cases for `<surface>` from these real customer requests: …"
- "We renamed the `vet` column to `doctor`: add the migration so saved customizations keep
  working."
