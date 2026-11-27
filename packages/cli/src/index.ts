/**
 * `patina scan`, `patina check` and the GitHub Action, as a library.
 * @packageDocumentation
 * @module @patina-ui/cli
 */

export { parseCatalogSource } from "./catalog-parse.js";
export type { CheckReport, Finding, Severity } from "./check.js";
export { COMMENT_MARKER, checkRepo, renderMarkdown } from "./check.js";
export { main } from "./cli.js";
export { renderBlocks } from "./generate/blocks.js";
export { renderCatalog } from "./generate/catalog.js";
export { renderFetch } from "./generate/fetch.js";
export { upsertPrComment } from "./github.js";
export type {
  ScannedComponent,
  ScannedField,
  ScannedSource,
  ScanResult,
  UiKit,
} from "./scan/index.js";
export { scanRepo } from "./scan/index.js";
