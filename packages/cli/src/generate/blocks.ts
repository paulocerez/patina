import type { ScanResult } from "../scan/types.js";

/**
 * Renders patina/blocks.tsx: the three data blocks (PatinaTable, PatinaChart, PatinaStat)
 * written with the app's own UI kit, components, classes and CSS variables, so new views
 * look native. The output is ordinary code the developer owns and can edit.
 */

interface Kit {
  name: string;
  imports: string[];
  /** JSX for a titled container around `{children}`. */
  frame: string;
  /** JSX for a table of `columns` / `rows`. */
  table: string;
  /** JSX for one big number `value` with label `label`. */
  stat: string;
  /** JSX for muted status text `{text}`. */
  muted: string;
  /** CSS color expression for chart marks. */
  color: string;
}

function pickVar(vars: Record<string, string>, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const name = Object.keys(vars).find((v) => re.test(v));
    if (name) return name;
  }
  return null;
}

/** `var(--x)`, or `hsl(var(--x))` for shadcn-style bare HSL triplets. */
function cssColor(vars: Record<string, string>, name: string): string {
  const v = vars[name] ?? "";
  return /^\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/.test(v.trim())
    ? `hsl(var(--${name}))`
    : `var(--${name})`;
}

function kitFor(scan: ScanResult): Kit {
  const { ui } = scan.stack;
  const { cssVariables: vars, classes, components } = scan.design;
  const comp = (name: string) => components.find((c) => c.name === name);
  const accentVar = pickVar(vars, [
    /^chart-1$/,
    /^primary$/,
    /^accent$/,
    /^brand/,
    /primary/,
    /accent/,
  ]);
  const color = accentVar ? cssColor(vars, accentVar) : "currentColor";

  if (ui === "mui") {
    return {
      name: "MUI",
      imports: [
        `import { Card, CardContent, Skeleton, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";`,
      ],
      frame: `<Card variant="outlined"><CardContent><Typography variant="subtitle2" gutterBottom>{title}</Typography>{children}</CardContent></Card>`,
      table: `<Table size="small"><TableHead><TableRow>{columns.map((c) => <TableCell key={c.field}>{c.label}</TableCell>)}</TableRow></TableHead><TableBody>{rows.map((r, i) => <TableRow key={rowKey(r, i)}>{columns.map((c) => <TableCell key={c.field}>{formatField(c.def, r[c.field], locale)}</TableCell>)}</TableRow>)}</TableBody></Table>`,
      stat: `<Typography variant="h4" component="p">{value}</Typography>`,
      muted: `<Typography variant="body2" color="text.secondary">{text}</Typography>`,
      color: "var(--mui-palette-primary-main, #1976d2)",
    };
  }
  if (ui === "chakra") {
    return {
      name: "Chakra UI",
      imports: [`import { Box, Heading, Text } from "@chakra-ui/react";`],
      frame: `<Box borderWidth="1px" borderRadius="lg" p={4}><Heading size="sm" mb={3}>{title}</Heading>{children}</Box>`,
      table: `<Box as="table" width="100%" fontSize="sm"><thead><tr>{columns.map((c) => <Box as="th" key={c.field} textAlign="left" py={2}>{c.label}</Box>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={rowKey(r, i)}>{columns.map((c) => <Box as="td" key={c.field} py={2} borderTopWidth="1px">{formatField(c.def, r[c.field], locale)}</Box>)}</tr>)}</tbody></Box>`,
      stat: `<Text fontSize="3xl" fontWeight="semibold">{value}</Text>`,
      muted: `<Text fontSize="sm" color="gray.500">{text}</Text>`,
      color: "var(--chakra-colors-blue-500, #3182ce)",
    };
  }
  if (ui === "antd") {
    return {
      name: "Ant Design",
      imports: [`import { Card, Statistic, Table, Typography } from "antd";`],
      frame: `<Card size="small" title={title}>{children}</Card>`,
      table: `<Table size="small" pagination={false} rowKey={(r) => String(rowKey(r, 0))} dataSource={rows} columns={columns.map((c) => ({ key: c.field, dataIndex: c.field, title: c.label, render: (v: unknown) => formatField(c.def, v, locale) }))} />`,
      stat: `<Statistic value={value} />`,
      muted: `<Typography.Text type="secondary">{text}</Typography.Text>`,
      color: "var(--ant-color-primary, #1677ff)",
    };
  }
  if (ui === "mantine") {
    return {
      name: "Mantine",
      imports: [`import { Card, Table, Text, Title } from "@mantine/core";`],
      frame: `<Card withBorder radius="md" padding="md"><Title order={5} mb="sm">{title}</Title>{children}</Card>`,
      table: `<Table><thead><tr>{columns.map((c) => <th key={c.field}>{c.label}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={rowKey(r, i)}>{columns.map((c) => <td key={c.field}>{formatField(c.def, r[c.field], locale)}</td>)}</tr>)}</tbody></Table>`,
      stat: `<Text size="xl" fw={700}>{value}</Text>`,
      muted: `<Text size="sm" c="dimmed">{text}</Text>`,
      color: "var(--mantine-color-blue-filled, #228be6)",
    };
  }
  if (ui === "shadcn" || ui === "tailwind") {
    const card = comp("Card");
    const title = comp("CardTitle");
    const content = comp("CardContent");
    const header = comp("CardHeader");
    const table = ["Table", "TableHeader", "TableBody", "TableRow", "TableHead", "TableCell"].map(
      comp,
    );
    const imports: string[] = [];
    let frame: string;
    if (card && title && content && header) {
      const names = ["Card", "CardContent", "CardHeader", "CardTitle"].filter(
        (n) => comp(n)?.importPath === card.importPath,
      );
      imports.push(`import { ${names.join(", ")} } from ${JSON.stringify(card.importPath)};`);
      frame = `<Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>`;
    } else {
      frame =
        ui === "shadcn" || "card" in vars
          ? `<div className="rounded-xl border bg-card text-card-foreground p-6 shadow-sm"><h3 className="mb-4 text-sm font-semibold">{title}</h3>{children}</div>`
          : `<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"><h3 className="mb-4 text-sm font-semibold text-gray-900">{title}</h3>{children}</div>`;
    }
    let tableJsx: string;
    if (table.every(Boolean)) {
      imports.push(
        `import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from ${JSON.stringify((table[0] as { importPath: string }).importPath)};`,
      );
      tableJsx = `<Table><TableHeader><TableRow>{columns.map((c) => <TableHead key={c.field}>{c.label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((r, i) => <TableRow key={rowKey(r, i)}>{columns.map((c) => <TableCell key={c.field}>{formatField(c.def, r[c.field], locale)}</TableCell>)}</TableRow>)}</TableBody></Table>`;
    } else {
      tableJsx = `<table className="w-full text-sm"><thead><tr className="border-b">{columns.map((c) => <th key={c.field} className="py-2 text-left font-medium text-muted-foreground">{c.label}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={rowKey(r, i)} className="border-b last:border-0">{columns.map((c) => <td key={c.field} className="py-2">{formatField(c.def, r[c.field], locale)}</td>)}</tr>)}</tbody></table>`;
    }
    return {
      name: ui === "shadcn" ? "shadcn/ui" : "Tailwind",
      imports,
      frame,
      table: tableJsx,
      stat: `<p className="text-3xl font-semibold tracking-tight">{value}</p>`,
      muted: `<p className="text-sm text-muted-foreground">{text}</p>`,
      color,
    };
  }

  // Plain CSS: reuse the app's own classes and variables where they exist.
  const v = (patterns: RegExp[], fallback: string) => {
    const name = pickVar(vars, patterns);
    return name ? `var(--${name})` : fallback;
  };
  const border = v([/^line$/, /^border$/, /border/], "#e5e5e5");
  const muted = v([/^muted$/, /muted/, /secondary-text|text-secondary/], "#71717a");
  const cardStyle = classes.includes("card")
    ? `className="card"`
    : `style={{ border: "1px solid ${border}", borderRadius: 12, padding: 16, background: "${v([/^card$/, /^surface$/, /^panel$/, /^bg$/, /background/], "#fff")}" }}`;
  const mutedAttr = classes.includes("muted")
    ? `className="muted"`
    : `style={{ color: "${muted}", fontSize: 13 }}`;
  const statLabel = classes.includes("stat-label");
  return {
    name: "your CSS",
    imports: [],
    frame: `<section ${cardStyle}><h2${statLabel ? "" : ` style={{ fontSize: 14, margin: "0 0 12px" }}`}>{title}</h2>{children}</section>`,
    table: `<table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{columns.map((c) => <th key={c.field} style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid ${border}", color: "${muted}", fontSize: 12 }}>{c.label}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={rowKey(r, i)}>{columns.map((c) => <td key={c.field} style={{ padding: "8px 10px", borderBottom: "1px solid ${border}" }}>{formatField(c.def, r[c.field], locale)}</td>)}</tr>)}</tbody></table>`,
    stat: classes.includes("stat-value")
      ? `<div className="stat-value">{value}</div>`
      : `<div style={{ fontSize: 28, fontWeight: 650 }}>{value}</div>`,
    muted: `<p ${mutedAttr}>{text}</p>`,
    color,
  };
}

function chartJsx(scan: ScanResult): { imports: string[]; body: string } {
  if (scan.stack.charts === "recharts") {
    return {
      imports: [
        `import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";`,
      ],
      body: `<div style={{ height: 240 }}>
        <ResponsiveContainer>
          {kind === "line" ? (
            <LineChart data={points}>
              <CartesianGrid vertical={false} strokeOpacity={0.3} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickFormatter={(v: number) => fmt(v)} tickLine={false} axisLine={false} fontSize={12} width={72} />
              <Tooltip formatter={(v) => fmt(Number(v))} />
              <Line dataKey="value" stroke={COLOR} strokeWidth={2} dot={false} />
            </LineChart>
          ) : (
            <BarChart data={points}>
              <CartesianGrid vertical={false} strokeOpacity={0.3} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickFormatter={(v: number) => fmt(v)} tickLine={false} axisLine={false} fontSize={12} width={72} />
              <Tooltip formatter={(v) => fmt(Number(v))} />
              <Bar dataKey="value" fill={COLOR} radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>`,
    };
  }
  // No chart library: small dependency-free SVG.
  return {
    imports: [],
    body: `<svg viewBox={\`0 0 \${W} \${H + 24}\`} width="100%" role="img" aria-label={title}>
        {kind === "line" ? (
          <polyline fill="none" stroke={COLOR} strokeWidth={2} points={points.map((p, i) => \`\${x(i) + bw / 2},\${H - (p.value / max) * H}\`).join(" ")} />
        ) : (
          points.map((p, i) => <rect key={p.key} x={x(i) + 4} y={H - (p.value / max) * H} width={Math.max(bw - 8, 2)} height={(p.value / max) * H} rx={3} fill={COLOR}><title>{\`\${p.label}: \${fmt(p.value)}\`}</title></rect>)
        )}
        {points.map((p, i) => <text key={p.key} x={x(i) + bw / 2} y={H + 16} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.6}>{p.label}</text>)}
      </svg>`,
  };
}

export function renderBlocks(scan: ScanResult): string {
  const kit = kitFor(scan);
  const chart = chartJsx(scan);
  const usesSvg = chart.imports.length === 0;
  const imports = [
    `import { formatField, type Query, type QueryState, usePatinaText, useQuery } from "@patina-ui/react";`,
    `import type { ReactNode } from "react";`,
    ...kit.imports,
    ...chart.imports,
  ];
  return `// Generated by \`patina scan\` for ${kit.name}. These are ordinary components: edit them freely.
// Register them with \`dataBlocks(catalog)\` from @patina-ui/core (see docs/guides/data-views.md).
// Re-running \`patina scan\` won't overwrite this file (it writes blocks.draft.tsx instead).
${imports.join("\n")}

const COLOR = ${JSON.stringify(kit.color)};

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return ${kit.frame};
}

function Muted({ text }: { text: string }) {
  return ${kit.muted};
}

type T = ReturnType<typeof usePatinaText>["t"];

function placeholder(state: QueryState, t: T): string {
  if (state.status === "loading") return t("loading");
  if (state.status === "error") return state.error;
  return t("unavailable");
}

function rowKey(row: Record<string, unknown>, index: number): string | number {
  const id = row.id;
  return typeof id === "string" || typeof id === "number" ? id : index;
}

/** A table of rows from one data source. */
export function PatinaTable({ query }: { query?: Query }) {
  const state = useQuery(query);
  const { t, locale } = usePatinaText();
  if (state.status !== "ready" || state.result.shape !== "rows")
    return (
      <Frame title={t("blockTable")}>
        <Muted text={placeholder(state, t)} />
      </Frame>
    );
  const { label: title, columns, rows } = state.result;
  return (
    <Frame title={title}>
      {rows.length === 0 ? <Muted text={t("nothingToShow")} /> : ${kit.table}}
    </Frame>
  );
}

/** One number per group, as bars or a line. */
export function PatinaChart({ kind = "bar", query }: { kind?: "bar" | "line"; query?: Query }) {
  const state = useQuery(query);
  const { t, locale } = usePatinaText();
  if (state.status !== "ready" || state.result.shape !== "series")
    return (
      <Frame title={t("blockChart")}>
        <Muted text={placeholder(state, t)} />
      </Frame>
    );
  const { label: title, points, valueDef } = state.result;
  const fmt = (v: number) => formatField(valueDef, v, locale);
${usesSvg ? "  const W = 600;\n  const H = 180;\n  const bw = W / Math.max(points.length, 1);\n  const x = (i: number) => i * bw;\n  const max = Math.max(1, ...points.map((p) => p.value));\n" : ""}  return (
    <Frame title={title}>
      {points.length === 0 ? <Muted text={t("nothingToShow")} /> : (
      ${chart.body}
      )}
    </Frame>
  );
}

/** A single number. */
export function PatinaStat({ query }: { query?: Query }) {
  const state = useQuery(query);
  const { t, locale } = usePatinaText();
  if (state.status !== "ready" || state.result.shape !== "single")
    return (
      <Frame title={t("blockStat")}>
        <Muted text={placeholder(state, t)} />
      </Frame>
    );
  const { label: title } = state.result;
  const value = formatField(state.result.valueDef, state.result.value, locale);
  return <Frame title={title}>{${kit.stat}}</Frame>;
}
`;
}
