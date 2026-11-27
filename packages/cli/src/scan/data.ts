import { parse as parseYaml } from "yaml";
import type { Repo } from "./files.js";
import type { ScannedField, ScannedSource } from "./types.js";

const CODE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const NOT_CODE = /\.(test|spec|stories|d)\.[jt]sx?$|(^|\/)(__tests__|__mocks__|fixtures?)\//;
const SENSITIVE =
  /phone|e-?mail|address|street|zip|postal|ssn|social|passport|password|secret|token|iban|account.?number|card.?number|birth|dob|salary|diagnos/i;
const MONEY = /price|amount|revenue|total|cost|fee|balance|salary|income|spend|paid/i;
const DATEISH = /(^|_)(date|day)$|Date$|At$|_at$|^date|Day$/;

type Fields = Record<string, ScannedField>;
interface TypeInfo {
  fields: Fields;
  evidence: string;
}

function field(
  name: string,
  kind: ScannedField["kind"],
  extra: Partial<ScannedField> = {},
): ScannedField {
  const f: ScannedField = { kind, ...extra };
  if (SENSITIVE.test(name)) f.sensitive = true;
  return f;
}

/** Maps a TS type expression to a field, or null if it isn't a plain displayable value. */
function fromTsType(name: string, type: string, optional: boolean): ScannedField | null {
  const t = type
    .trim()
    .replace(/\s*\|\s*(null|undefined)\b/g, "")
    .replace(/;$/, "")
    .trim();
  const opt = optional ? { optional: true } : {};
  if (t === "string") return field(name, DATEISH.test(name) ? "date" : "string", opt);
  if (t === "number" || t === "bigint")
    return field(name, MONEY.test(name) ? "currency" : "number", opt);
  if (t === "boolean") return field(name, "bool", opt);
  if (t === "Date") return field(name, "date", opt);
  const literals = t.split("|").map((p) => p.trim());
  if (literals.length > 1 && literals.every((p) => /^(['"]).*\1$/.test(p)))
    return field(name, "enum", { values: literals.map((p) => p.slice(1, -1)), ...opt });
  return null;
}

function parseTsBody(body: string): Fields {
  const fields: Fields = {};
  // Only top-level members: drop nested object literals first.
  let flat = body;
  for (let i = 0; i < 5; i++) flat = flat.replace(/\{[^{}]*\}/g, "object");
  for (const m of flat.matchAll(
    /(?:^|[;\n,])\s*(?:readonly\s+)?([A-Za-z_]\w*)(\?)?\s*:\s*([^;\n,]+(?:\|[^;\n,]+)*)/g,
  )) {
    const f = fromTsType(m[1] as string, m[3] as string, !!m[2]);
    if (f) fields[m[1] as string] = f;
  }
  return fields;
}

/** Exported interfaces / object type aliases with at least two plain fields. */
function scanTsTypes(repo: Repo, files: string[], types: Map<string, TypeInfo>) {
  for (const file of files) {
    const src = repo.read(file);
    if (!src || !/interface|type\s/.test(src)) continue;
    for (const m of src.matchAll(
      /export\s+(?:interface\s+(\w+)(?:\s+extends\s+[\w<>,\s]+)?|type\s+(\w+)\s*=)\s*\{/g,
    )) {
      const name = (m[1] ?? m[2]) as string;
      // The body up to the matching brace (works for one-line and multi-line declarations).
      const open = (m.index ?? 0) + m[0].length - 1;
      let depth = 0;
      let end = -1;
      for (let i = open; i < src.length && i < open + 20_000; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}" && --depth === 0) {
          end = i;
          break;
        }
      }
      if (end < 0) continue;
      const fields = parseTsBody(src.slice(open + 1, end));
      if (Object.keys(fields).length >= 2 && !types.has(name))
        types.set(name, { fields, evidence: `${file}#${name}` });
    }
  }
}

function scanZod(repo: Repo, files: string[], types: Map<string, TypeInfo>) {
  for (const file of files) {
    const src = repo.read(file);
    if (!src?.includes("z.object")) continue;
    for (const m of src.matchAll(
      /export\s+const\s+(\w+?)(?:Schema)?\s*=\s*z\.object\(\{([\s\S]*?)\n\}\)/g,
    )) {
      const name = m[1] as string;
      const fields: Fields = {};
      for (const fm of (m[2] as string).matchAll(
        /^\s*(\w+)\s*:\s*z\.([\w.]+)\(([^)]*)\)([^,\n]*)/gm,
      )) {
        const [, fname, kindRaw, args, rest] = fm as unknown as [
          string,
          string,
          string,
          string,
          string,
        ];
        const optional = /\.(optional|nullable|nullish)\(/.test(rest);
        const opt = optional ? { optional: true } : {};
        const kind = kindRaw.replace(/^coerce\./, "");
        if (kind === "string")
          fields[fname] = field(
            fname,
            /\.(datetime|date)\(/.test(rest) || DATEISH.test(fname) ? "date" : "string",
            opt,
          );
        else if (kind === "number" || kind === "bigint")
          fields[fname] = field(fname, MONEY.test(fname) ? "currency" : "number", opt);
        else if (kind === "boolean") fields[fname] = field(fname, "bool", opt);
        else if (kind === "date") fields[fname] = field(fname, "date", opt);
        else if (kind === "enum") {
          const values = [...args.matchAll(/["'`]([^"'`]+)["'`]/g)].map((v) => v[1] as string);
          if (values.length) fields[fname] = field(fname, "enum", { values, ...opt });
        }
      }
      if (Object.keys(fields).length >= 2 && !types.has(name))
        types.set(name, { fields, evidence: `${file}#${m[1]}` });
    }
  }
}

function scanPrisma(repo: Repo, types: Map<string, TypeInfo>) {
  for (const file of repo.find(/\.prisma$/)) {
    const src = repo.read(file) ?? "";
    const enums = new Map<string, string[]>();
    for (const m of src.matchAll(/enum\s+(\w+)\s*\{([^}]*)\}/g))
      enums.set(
        m[1] as string,
        (m[2] as string).split(/\s+/).filter((v) => /^\w+$/.test(v)),
      );
    for (const m of src.matchAll(/model\s+(\w+)\s*\{([^}]*)\}/g)) {
      const fields: Fields = {};
      for (const line of (m[2] as string).split("\n")) {
        const fm = /^\s*(\w+)\s+(\w+)(\?|\[\])?/.exec(line);
        if (!fm || line.trim().startsWith("@@") || fm[3] === "[]") continue;
        const [, fname, type, mod] = fm as unknown as [string, string, string, string | undefined];
        const opt = mod === "?" ? { optional: true } : {};
        if (type === "String") fields[fname] = field(fname, "string", opt);
        else if (["Int", "BigInt", "Float", "Decimal"].includes(type))
          fields[fname] = field(fname, MONEY.test(fname) ? "currency" : "number", opt);
        else if (type === "Boolean") fields[fname] = field(fname, "bool", opt);
        else if (type === "DateTime") fields[fname] = field(fname, "date", opt);
        else if (enums.has(type))
          fields[fname] = field(fname, "enum", { values: enums.get(type), ...opt });
      }
      if (Object.keys(fields).length >= 2)
        types.set(m[1] as string, { fields, evidence: `${file}#${m[1]}` });
    }
  }
}

// ─────────────────────────────── routes ───────────────────────────────

interface Route {
  path: string;
  params: string[];
  evidence: string;
  /** Type names seen near the handler (annotations, or functions with a declared return type). */
  typeHints: string[];
}

function hintsIn(snippet: string, returnTypes: Map<string, string>): string[] {
  const hints: string[] = [];
  for (const m of snippet.matchAll(/(?::|as|<)\s*(?:Array<)?([A-Z]\w*)(?:\[\]|>)/g))
    hints.push(m[1] as string);
  for (const m of snippet.matchAll(/\b([a-z]\w*)\s*\(/g)) {
    const t = returnTypes.get(m[1] as string);
    if (t) hints.push(t);
  }
  return hints;
}

function paramsIn(snippet: string): string[] {
  const out = new Set<string>();
  for (const m of snippet.matchAll(
    /req\.query\.(\w+)|req\.query\[["'](\w+)["']\]|searchParams\.get\(["'](\w+)["']\)|\.req\.query\(["'](\w+)["']\)/g,
  ))
    out.add((m[1] ?? m[2] ?? m[3] ?? m[4]) as string);
  return [...out];
}

function scanRoutes(repo: Repo, files: string[]): Route[] {
  // Functions that declare an array return type: `function orders(...): Order[]`.
  const returnTypes = new Map<string, string>();
  for (const file of files) {
    const src = repo.read(file) ?? "";
    for (const m of src.matchAll(
      /function\s+(\w+)\s*(?:<[^>]*>)?\([^)]*\)\s*:\s*(?:Promise<)?(?:Array<)?([A-Z]\w*)(?:\[\]|>)/g,
    ))
      returnTypes.set(m[1] as string, m[2] as string);
  }
  const mounts = scanMounts(repo, files);
  const routes: Route[] = [];
  for (const file of files) {
    const src = repo.read(file);
    if (!src) continue;
    // Express / Hono / Fastify / routers: router.get("/orders", …), resolved against the
    // prefixes the router is mounted under (app.use("/api/orders", router)).
    for (const m of src.matchAll(/\b(\w+)\.get\(\s*["'`](\/[^"'`]*)["'`]/g)) {
      const receiver = m[1] as string;
      const local = m[2] as string;
      const start = m.index ?? 0;
      const after = start + m[0].length;
      // The handler's code: up to the next route registration (or 1200 chars).
      const nextRoute = src
        .slice(after, start + 1200)
        .search(/\b\w+\.(get|post|put|patch|delete|use|all|route|listen)\(/);
      const snippet = src.slice(start, nextRoute >= 0 ? after + nextRoute : start + 1200);
      for (const prefix of mounts.prefixesFor(file, receiver)) {
        const path = joinPath(prefix, local);
        if (/[:*]|\{/.test(path) || path === "/") continue;
        routes.push({
          path,
          params: paramsIn(snippet),
          evidence: file,
          typeHints: hintsIn(snippet, returnTypes),
        });
      }
    }
    // Next.js App Router: app/**/route.ts exporting GET
    const next = /(?:^|\/)app\/(.*)\/route\.[jt]sx?$/.exec(file);
    if (next && /export\s+(?:async\s+)?(?:function\s+GET|const\s+GET)/.test(src)) {
      const segs = (next[1] as string).split("/").filter((s) => !/^\(.*\)$/.test(s));
      if (!segs.some((s) => s.startsWith("["))) {
        const at = src.search(/export\s+(?:async\s+)?(?:function\s+GET|const\s+GET)/);
        routes.push({
          path: `/${segs.join("/")}`,
          params: paramsIn(src),
          evidence: file,
          typeHints: hintsIn(src.slice(at), returnTypes),
        });
      }
    }
    // Next.js Pages Router: pages/api/**.ts
    const pages = /(?:^|\/)pages\/(api\/.*)\.[jt]sx?$/.exec(file);
    if (pages && !(pages[1] as string).includes("[")) {
      routes.push({
        path: `/${(pages[1] as string).replace(/\/index$/, "")}`,
        params: paramsIn(src),
        evidence: file,
        typeHints: hintsIn(src, returnTypes),
      });
    }
  }
  return routes;
}

// ─────────────────────────────── router mounts ───────────────────────────────

function joinPath(prefix: string, path: string): string {
  const joined = `${prefix.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`.replace(/\/+/g, "/");
  return joined.length > 1 ? joined.replace(/\/$/, "") : joined;
}

/** Resolves a relative import ("./calls/routes", "../x.js") to a repo file. */
function resolveImport(
  repo: Repo,
  fromFile: string,
  spec: string,
  known: Set<string>,
): string | null {
  if (!spec.startsWith(".")) return null;
  const dir = fromFile.split("/").slice(0, -1);
  const parts = [...dir];
  for (const seg of spec.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  const base = parts.join("/");
  const noJs = base.replace(/\.(c|m)?js$/, "");
  for (const c of [
    base,
    `${noJs}.ts`,
    `${noJs}.tsx`,
    `${noJs}.js`,
    `${noJs}.mjs`,
    `${noJs}/index.ts`,
    `${noJs}/index.js`,
  ])
    if (known.has(c)) return c;
  void repo;
  return null;
}

/** The text of a call's arguments, from just after "(" to the matching ")". */
function callArgs(src: string, openParen: number): string {
  let depth = 0;
  for (let i = openParen; i < src.length && i < openParen + 2000; i++) {
    const c = src[i];
    if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return src.slice(openParen + 1, i);
  }
  return "";
}

interface Mount {
  parentFile: string;
  parentVar: string;
  prefix: string;
  childFile: string;
  childVar: string;
}

/**
 * Finds `x.use("/prefix", router)` / `x.route("/prefix", router)` and resolves `router` to the
 * file and variable it comes from, so routes defined on it get their full path.
 */
function scanMounts(repo: Repo, files: string[]) {
  const known = new Set(repo.files);
  const defaultExport = new Map<string, string>();
  const mounts: Mount[] = [];
  for (const file of files) {
    const src = repo.read(file) ?? "";
    const def =
      /export\s+default\s+(\w+)\s*;?/.exec(src) ?? /module\.exports\s*=\s*(\w+)\s*;?/.exec(src);
    if (def) defaultExport.set(file, def[1] as string);
  }
  for (const file of files) {
    const src = repo.read(file);
    if (!src || !/\.(use|route)\(/.test(src)) continue;
    // local name → [file, exported variable or "default"]
    const imports = new Map<string, [string, string]>();
    for (const m of src.matchAll(
      /import\s+(\w+)\s*(?:,\s*\{([^}]*)\})?\s*from\s*["'`]([^"'`]+)["'`]/g,
    )) {
      const target = resolveImport(repo, file, m[3] as string, known);
      if (target) imports.set(m[1] as string, [target, "default"]);
      for (const part of (m[2] ?? "").split(",")) addNamed(part, target);
    }
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'`]([^"'`]+)["'`]/g)) {
      const target = resolveImport(repo, file, m[2] as string, known);
      for (const part of (m[1] ?? "").split(",")) addNamed(part, target);
    }
    for (const m of src.matchAll(
      /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
    )) {
      const target = resolveImport(repo, file, m[2] as string, known);
      if (target) imports.set(m[1] as string, [target, "default"]);
    }
    function addNamed(part: string, target: string | null) {
      const [orig, alias] = part.trim().split(/\s+as\s+/);
      if (target && orig && /^\w+$/.test(orig))
        imports.set((alias ?? orig).trim(), [target, orig.trim()]);
    }
    for (const m of src.matchAll(/\b(\w+)\.(?:use|route)\(\s*["'`](\/[^"'`]*)["'`]\s*,/g)) {
      const args = callArgs(src, (m.index ?? 0) + m[0].indexOf("("));
      const last = /(\w+)\s*,?\s*$/.exec(args.trim())?.[1];
      if (!last) continue;
      const imported = imports.get(last);
      const [childFile, childVarRaw] = imported ?? [file, last];
      const childVar =
        childVarRaw === "default" ? (defaultExport.get(childFile) ?? "default") : childVarRaw;
      mounts.push({
        parentFile: file,
        parentVar: m[1] as string,
        prefix: m[2] as string,
        childFile,
        childVar,
      });
    }
  }
  const memo = new Map<string, string[]>();
  function prefixesFor(file: string, variable: string, depth = 0): string[] {
    const key = `${file}#${variable}`;
    const cached = memo.get(key);
    if (cached) return cached;
    const own = mounts.filter((m) => m.childFile === file && m.childVar === variable);
    if (own.length === 0 || depth > 6) return [""];
    const out = new Set<string>();
    for (const m of own)
      for (const parent of prefixesFor(m.parentFile, m.parentVar, depth + 1))
        out.add(joinPath(parent, m.prefix));
    const list = [...out];
    memo.set(key, list);
    return list;
  }
  return { prefixesFor, mounts };
}

// ─────────────────────────────── OpenAPI ───────────────────────────────

type Json = Record<string, unknown>;

function scanOpenApi(repo: Repo): Map<string, ScannedSource> {
  const out = new Map<string, ScannedSource>();
  for (const file of repo.find(
    /(^|\/)(openapi|swagger)[^/]*\.(json|ya?ml)$|\.openapi\.(json|ya?ml)$/,
  )) {
    let doc: Json;
    try {
      const text = repo.read(file) ?? "";
      doc = (file.endsWith(".json") ? JSON.parse(text) : parseYaml(text)) as Json;
    } catch {
      continue;
    }
    const resolve = (s: unknown, depth = 0): Json | null => {
      if (!s || typeof s !== "object" || depth > 8) return null;
      const ref = (s as Json).$ref;
      if (typeof ref === "string" && ref.startsWith("#/")) {
        let cur: unknown = doc;
        for (const part of ref.slice(2).split("/"))
          cur = (cur as Json | undefined)?.[part.replace(/~1/g, "/").replace(/~0/g, "~")];
        return resolve(cur, depth + 1);
      }
      return s as Json;
    };
    for (const [path, item] of Object.entries((doc.paths as Json) ?? {})) {
      const get = (item as Json)?.get as Json | undefined;
      if (!get || path.includes("{")) continue;
      const params = ((get.parameters as Json[] | undefined) ?? [])
        .map((p) => resolve(p))
        .filter((p): p is Json => !!p && p.in === "query" && typeof p.name === "string")
        .map((p) => p.name as string);
      const responses = (get.responses as Json | undefined) ?? {};
      const ok = resolve(responses["200"] ?? responses["2XX"] ?? responses.default);
      const content = (ok?.content as Json | undefined)?.["application/json"] as Json | undefined;
      let schema = resolve(content?.schema ?? ok?.schema);
      if (schema?.type === "object" && schema.properties) {
        const listProp = Object.values(schema.properties as Json)
          .map((p) => resolve(p))
          .find((p) => p?.type === "array");
        if (listProp) schema = listProp;
      }
      const itemSchema = schema?.type === "array" ? resolve(schema.items) : null;
      const fields: Fields = {};
      for (const [name, raw] of Object.entries(
        (itemSchema?.properties as Json | undefined) ?? {},
      )) {
        const p = resolve(raw);
        if (!p) continue;
        const required = ((itemSchema?.required as string[] | undefined) ?? []).includes(name);
        const opt = required ? {} : { optional: true };
        if (Array.isArray(p.enum) && p.enum.every((v) => typeof v === "string"))
          fields[name] = field(name, "enum", { values: p.enum as string[], ...opt });
        else if (p.type === "string")
          fields[name] = field(
            name,
            p.format === "date" || p.format === "date-time" || DATEISH.test(name)
              ? "date"
              : "string",
            opt,
          );
        else if (p.type === "integer" || p.type === "number")
          fields[name] = field(name, MONEY.test(name) ? "currency" : "number", opt);
        else if (p.type === "boolean") fields[name] = field(name, "bool", opt);
      }
      out.set(path, {
        endpoint: { path, method: "GET" },
        params,
        fields,
        evidence: [`${file}#/paths/${path.replace(/\//g, "~1")}`],
      });
    }
  }
  return out;
}

// ─────────────────────────────── merge ───────────────────────────────

function singular(word: string): string {
  if (/ies$/.test(word)) return word.replace(/ies$/, "y");
  if (/(ss|us|is)$/.test(word)) return word;
  if (/(sh|ch|x|ses|zes)$/.test(word)) return word.replace(/es$/, "");
  return word.replace(/s$/, "");
}

const SUFFIXES = /(Row|Dto|DTO|Item|Record|Schema|Response|Model|Entity|Data)$/;

function sourceId(path: string): string {
  const segs = path.split("/").filter((s) => s && !/^(api|v\d+)$/.test(s));
  const last = segs[segs.length - 1] ?? "data";
  return (
    last.replace(/[-_.](\w)/g, (_, c: string) => c.toUpperCase()).replace(/[^\w]/g, "") || "data"
  );
}

/** Finds the data sources the app exposes: GET endpoints and the shape of their rows. */
export function detectSources(repo: Repo): Record<string, ScannedSource> {
  const code = repo.files.filter((f) => CODE.test(f) && !NOT_CODE.test(f));
  const types = new Map<string, TypeInfo>();
  scanPrisma(repo, types);
  scanZod(repo, code, types);
  scanTsTypes(repo, code, types);

  const byPath = scanOpenApi(repo);
  for (const route of scanRoutes(repo, code)) {
    const existing = byPath.get(route.path);
    if (existing) {
      existing.evidence.push(route.evidence);
      existing.params = [...new Set([...existing.params, ...route.params])];
      continue;
    }
    const seg = (route.path.split("/").filter(Boolean).pop() ?? "")
      .toLowerCase()
      .replace(/[-_]/g, "");
    const byHint = route.typeHints.map((h) => types.get(h)).find(Boolean);
    const byName = [...types.entries()].find(([name]) => {
      const n = name.replace(SUFFIXES, "").toLowerCase();
      return n === seg || n === singular(seg);
    })?.[1];
    const t = byHint ?? byName;
    byPath.set(route.path, {
      endpoint: { path: route.path, method: "GET" },
      params: route.params,
      fields: t ? structuredClone(t.fields) : {},
      evidence: t ? [route.evidence, t.evidence] : [route.evidence],
    });
  }

  const out: Record<string, ScannedSource> = {};
  for (const [path, source] of [...byPath.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    let id = sourceId(path);
    for (let i = 2; out[id]; i++) id = `${sourceId(path)}${i}`;
    out[id] = {
      ...source,
      params: [...source.params].sort(),
      evidence: [...new Set(source.evidence)].sort(),
    };
  }
  return out;
}

export const _test = { parseTsBody, singular, sourceId, fromTsType };
