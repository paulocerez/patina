/**
 * Reads the *shape* of a catalog.ts without executing it (no dependencies needed, so it runs
 * in CI before `npm install`). Understands the format `patina scan` generates and the usual
 * hand edits; anything it can't read is reported, not guessed.
 */

export interface ParsedField {
  kind: string;
  values?: string[];
  sensitive?: boolean;
}
export interface ParsedSource {
  path: string | null;
  fields: Record<string, ParsedField>;
}

function stripComments(src: string): string {
  let out = "";
  let i = 0;
  let quote: string | null = null;
  while (i < src.length) {
    const c = src[i] as string;
    const next = src[i + 1];
    if (quote) {
      out += c;
      if (c === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
    } else if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i++;
    } else if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (c === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Index of the bracket that closes the one at `open`. */
function matching(src: string, open: number): number {
  const pairs: Record<string, string> = { "{": "}", "(": ")", "[": "]" };
  const stack: string[] = [];
  let quote: string | null = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i] as string;
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (pairs[c]) stack.push(pairs[c] as string);
    else if (c === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) return i;
    }
  }
  return -1;
}

/** Top-level `key: value` entries of an object literal body. */
function entries(body: string): [string, string][] {
  const out: [string, string][] = [];
  let i = 0;
  while (i < body.length) {
    const m = /^[\s,]*(?:["']?([A-Za-z_$][\w$]*)["']?)\s*:\s*/.exec(body.slice(i));
    if (!m) break;
    i += m[0].length;
    const start = i;
    let depth = 0;
    let quote: string | null = null;
    for (; i < body.length; i++) {
      const c = body[i] as string;
      if (quote) {
        if (c === "\\") i++;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") quote = c;
      else if ("{([".includes(c)) depth++;
      else if ("})]".includes(c)) depth--;
      else if (c === "," && depth === 0) break;
    }
    out.push([m[1] as string, body.slice(start, i).trim()]);
    i++;
  }
  return out;
}

function objectBody(value: string): string | null {
  const open = value.indexOf("{");
  if (open !== 0) return null;
  const close = matching(value, open);
  return close > 0 ? value.slice(open + 1, close) : null;
}

export function parseCatalogSource(text: string): Record<string, ParsedSource> | null {
  const src = stripComments(text);
  const call = src.indexOf("defineCatalog(");
  if (call < 0) return null;
  const open = src.indexOf("{", call);
  const close = matching(src, open);
  if (open < 0 || close < 0) return null;
  const sources: Record<string, ParsedSource> = {};
  for (const [id, value] of entries(src.slice(open + 1, close))) {
    const body = objectBody(value);
    if (body === null) continue;
    const parts = Object.fromEntries(entries(body));
    const path = /path\s*:\s*["'`]([^"'`]+)["'`]/.exec(parts.endpoint ?? "")?.[1] ?? null;
    const fields: Record<string, ParsedField> = {};
    const fieldsBody = objectBody(parts.fields ?? "");
    for (const [name, def] of fieldsBody ? entries(fieldsBody) : []) {
      const m = /^f\.(\w+)\(/.exec(def);
      if (!m) {
        fields[name] = { kind: "unknown" };
        continue;
      }
      const f: ParsedField = { kind: m[1] as string };
      if (f.kind === "enum") {
        const arr = /^f\.enum\(\s*\[([^\]]*)\]/.exec(def);
        f.values = arr
          ? [...(arr[1] as string).matchAll(/["'`]([^"'`]*)["'`]/g)].map((v) => v[1] as string)
          : [];
      }
      if (/sensitive\s*:\s*true/.test(def)) f.sensitive = true;
      fields[name] = f;
    }
    sources[id] = { path, fields };
  }
  return sources;
}
