/**
 * Spec, manifest and patch engine. No framework or LLM dependencies.
 * @packageDocumentation
 * @module @patina-ui/core
 */

export {
  BLOCK_COMPONENTS,
  dataBlocks,
  dataPresetIds,
  removeNodes,
  withoutDataViews,
} from "./blocks.js";
export type {
  ArrangeCapability,
  Capabilities,
  DataCapability,
  SettingCapability,
} from "./capabilities.js";
export {
  answerText,
  capabilities,
  capabilityExamples,
  capabilityHint,
  capabilityLines,
  isCapabilityQuestion,
  scopeCapabilities,
} from "./capabilities.js";
export type {
  Catalog,
  Derive,
  FieldDef,
  FieldKind,
  ParamBinding,
  PublicCatalog,
  SourceDef,
} from "./catalog.js";
export {
  choiceParams,
  defineCatalog,
  f,
  fieldLabel,
  fieldPrivacy,
  offerableFields,
  publicCatalog,
  queryableFields,
  restrictCatalog,
  WEEKDAYS,
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
export type { ClarifyOption, RefusalInfo, Rescue } from "./guard.js";
export { mentionedNodes, relevantOptions, rescueRefusal } from "./guard.js";
export type { HistoryEntry, Layer, Resolved } from "./history.js";
export { effectivePatches, headSeq, redoTarget, resolve, undoTarget } from "./history.js";
export type { Locale, MessageKey, Text } from "./i18n.js";
export {
  DEFAULT_LOCALE,
  listAnd,
  listOr,
  msg,
  msgText,
  pickLocale,
  RELATIVE_RANGE_TEXT,
  SUPPORTED_LOCALES,
  tx,
} from "./i18n.js";
export type {
  ComponentDef,
  Manifest,
  PresetDef,
  Restriction,
  SurfaceDefinition,
} from "./manifest.js";
export {
  defineSurface,
  localizeManifest,
  nodeLabel,
  restrictManifest,
  restrictSpec,
} from "./manifest.js";
export type { Migration } from "./migrate.js";
export { migratePatch, migrations } from "./migrate.js";
export type {
  ClarifyThread,
  ModelRefusalDetail,
  ModelRequest,
  ModelResult,
  RefusalCategory,
  SchemaOptions,
} from "./model.js";
export {
  buildCompactSchema,
  buildModelRequest,
  buildOutputSchema,
  describeSources,
  describeType,
  describeView,
  fromModelOutput,
  REFUSAL_CATEGORIES,
  randomUserKey,
} from "./model.js";
export type {
  ErrorBody,
  HistoryRequest,
  Notice,
  ProposeRequest,
  ProposeResponse,
  SurfaceState,
} from "./protocol.js";
export type { AggOp, Bucket, Query, QueryDef, QueryResult, QueryShape } from "./query.js";
export {
  aggregate,
  checkQuery,
  cleanQuery,
  describeQuery,
  runQuery,
  withDerived,
} from "./query.js";
export { identifierWords, mentions, mentionsAny, normalizeText, stem } from "./text.js";
export * from "./types.js";
export { checkValue, formatValue } from "./values.js";
