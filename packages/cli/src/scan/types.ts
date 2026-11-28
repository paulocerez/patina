import type { FieldKind } from "@patina-ui/core";

export type UiKit = "shadcn" | "mui" | "chakra" | "mantine" | "antd" | "tailwind" | "css";

export interface ScannedField {
  kind: FieldKind;
  values?: string[];
  optional?: boolean;
  /** Guessed from the name (phone, email, address…). Never offered to the model. */
  sensitive?: boolean;
}

export interface ScannedSource {
  endpoint: { path: string; method: "GET" };
  /** Query parameters seen on the endpoint. */
  params: string[];
  /** Empty when the response type couldn't be determined (a TODO in the catalog draft). */
  fields: Record<string, ScannedField>;
  /** Where the evidence came from, e.g. "openapi.yaml#/paths/~1api~1orders", "src/types.ts#Order". */
  evidence: string[];
  /** Tenant placeholders in the path (`/api/accounts/:accountId/…`), filled by the fetch layer. */
  pathParams?: string[];
  /** How the endpoint pages, guessed from its query params. */
  paging?:
    | { style: "offset"; limit: string; offset: string }
    | { style: "page"; page: string; pageSize: string }
    | { style: "cursor"; cursor: string };
  /** Query params that look like a date range's start and end. */
  dateRange?: { from: string; to: string };
  /** Where the rows are in the response when it wraps them (`res.json({ items, total })`). */
  rows?: string;
}

export interface ScannedComponent {
  name: string;
  file: string;
  /** How blocks.tsx should import it. */
  importPath: string;
}

export interface ScanResult {
  version: 1;
  stack: {
    frameworks: string[];
    ui: UiKit;
    tailwind: boolean;
    charts: string | null;
    tables: string | null;
  };
  design: {
    /** CSS custom properties from :root and `@theme` (name → value). */
    cssVariables: Record<string, string>;
    /** Utility classes defined in the app's CSS that blocks can reuse (card, badge, muted…). */
    classes: string[];
    components: ScannedComponent[];
  };
  sources: Record<string, ScannedSource>;
}
