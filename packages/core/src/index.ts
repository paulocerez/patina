/**
 * Spec, manifest and patch engine. No framework or LLM dependencies.
 * @packageDocumentation
 * @module @patina/core
 */

export { BLOCK_COMPONENTS, dataBlocks } from "./blocks.js";
export type {
  Catalog,
  FieldDef,
  FieldKind,
  ParamBinding,
  PublicCatalog,
  SourceDef,
} from "./catalog.js";
export {
  defineCatalog,
  f,
  fieldLabel,
  offerableFields,
  publicCatalog,
  restrictCatalog,
} from "./catalog.js";
export type {
  CollectionDef,
  RelativeRange,
  ScalarTypeDef,
  SlotDef,
  TypeDef,
  TypeMeta,
} from "./dsl.js";
export { humanize, RELATIVE_RANGE_LABELS, RELATIVE_RANGES, t } from "./dsl.js";
export type { ApplyMode, ApplyResult } from "./engine.js";
export {
  apply,
  compose,
  deepEqual,
  describe,
  diffProps,
  invert,
  parseOp,
  USER_KEY_PREFIX,
  validate,
} from "./engine.js";
export type { HistoryEntry, Layer, Resolved } from "./history.js";
export { effectivePatches, headSeq, resolve, undoTarget } from "./history.js";
export type {
  ComponentDef,
  Manifest,
  PresetDef,
  Restriction,
  SurfaceDefinition,
} from "./manifest.js";
export { defineSurface, nodeLabel, restrictManifest, restrictSpec } from "./manifest.js";
export type { Migration } from "./migrate.js";
export { migratePatch, migrations } from "./migrate.js";
export type { ModelRequest, ModelResult } from "./model.js";
export {
  buildModelRequest,
  buildOutputSchema,
  describeSources,
  describeView,
  fromModelOutput,
  randomUserKey,
} from "./model.js";
export type { ErrorBody, ProposeResponse, SurfaceState } from "./protocol.js";
export type { AggOp, Bucket, Query, QueryDef, QueryResult, QueryShape } from "./query.js";
export { aggregate, checkQuery, cleanQuery, describeQuery, runQuery } from "./query.js";
export * from "./types.js";
export { checkValue, formatValue } from "./values.js";
