/**
 * React bindings and headless UX primitives.
 * @packageDocumentation
 * @module @patina-ui/react
 */

export type { FieldDef, Notice, PublicCatalog, Query, QueryResult } from "@patina-ui/core";
export type { ClientOptions, PatinaClient } from "./client.js";
export { createPatinaClient, PatinaRequestError } from "./client.js";
export type { PatinaProviderProps, UseSurface } from "./context.js";
export { PatinaProvider, usePatinaText, useSurface } from "./context.js";
export type { FetchSource, QueryState } from "./data.js";
export { bindParams, defaultFetchSource, formatField, useQuery } from "./data.js";
export type {
  PromptInputProps,
  PromptInputRenderProps,
  ProposalPreviewProps,
  ProposalPreviewRenderProps,
  ShippedNoticeProps,
} from "./primitives.js";
export {
  AvailabilityNotice,
  PromptInput,
  ProposalPreview,
  ResetButton,
  ShippedNotice,
  SkippedNotice,
  SurfaceMessage,
  UndoButton,
} from "./primitives.js";
export type { ComponentMap, SurfaceProps } from "./Surface.js";
export { Surface } from "./Surface.js";
export type { Proposal, SurfaceSnapshot, SurfaceStatus } from "./store.js";
export { SurfaceStore } from "./store.js";
