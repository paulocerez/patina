import type { Repo } from "./files.js";
import type { ScanResult, UiKit } from "./types.js";

export function readDeps(repo: Repo): Record<string, string> {
  const deps: Record<string, string> = {};
  for (const file of repo.find(/(^|\/)package\.json$/).slice(0, 50)) {
    try {
      const pkg = JSON.parse(repo.read(file) ?? "{}") as Record<
        string,
        Record<string, string> | undefined
      >;
      Object.assign(
        deps,
        pkg.dependencies ?? {},
        pkg.devDependencies ?? {},
        pkg.peerDependencies ?? {},
      );
    } catch {
      // ignore malformed package.json
    }
  }
  return deps;
}

export function detectStack(repo: Repo): ScanResult["stack"] {
  const deps = readDeps(repo);
  const has = (name: string | RegExp) =>
    Object.keys(deps).some((d) => (typeof name === "string" ? d === name : name.test(d)));
  const frameworks = [
    ["next", "next"],
    ["remix", /^@remix-run\//],
    ["react-router", "react-router"],
    ["express", "express"],
    ["hono", "hono"],
    ["fastify", "fastify"],
    ["vite", "vite"],
    ["nestjs", /^@nestjs\//],
    ["trpc", /^@trpc\//],
    ["prisma", /^(prisma|@prisma\/client)$/],
    ["drizzle", "drizzle-orm"],
    ["graphql", "graphql"],
  ]
    .filter(([, d]) => has(d as string | RegExp))
    .map(([n]) => n as string);
  const tailwind =
    has("tailwindcss") || repo.find(/(^|\/)tailwind\.config\.(js|cjs|mjs|ts)$/).length > 0;
  const shadcn =
    repo.find(/(^|\/)components\.json$/).length > 0 || (has(/^@radix-ui\//) && tailwind);
  const ui: UiKit = shadcn
    ? "shadcn"
    : has("@mui/material")
      ? "mui"
      : has("@chakra-ui/react")
        ? "chakra"
        : has("@mantine/core")
          ? "mantine"
          : has("antd")
            ? "antd"
            : tailwind
              ? "tailwind"
              : "css";
  const charts =
    [
      "recharts",
      "react-chartjs-2",
      "@nivo/core",
      "@visx/visx",
      "echarts-for-react",
      "victory",
    ].find((d) => has(d)) ?? null;
  const tables =
    ["@tanstack/react-table", "ag-grid-react", "@mui/x-data-grid"].find((d) => has(d)) ?? null;
  return { frameworks, ui, tailwind, charts, tables };
}
