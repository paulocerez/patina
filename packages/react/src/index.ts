/**
 * React bindings and headless UX primitives.
 * @packageDocumentation
 * @module @patina-ui/react
 */

export type { FieldDef, Notice, PublicCatalog, Query, QueryResult } from "@patina-ui/core";
export type { ClarifyThread, ClientOptions, PatinaClient } from "./client.js";
export { createPatinaClient, PatinaRequestError } from "./client.js";
export type { PatinaProviderProps, UseSurface } from "./context.js";
export { PatinaProvider, usePatinaText, useSurface } from "./context.js";
export type { FetchSource, QueryState } from "./data.js";
export { bindParams, defaultFetchSource, formatField, useQuery } from "./data.js";
export type { DateRangeMapping, FetchSourceOptions, Paging, SourceOptions } from "./fetch.js";
export { createFetchSource } from "./fetch.js";
export type { HookOptions, SlotItem } from "./hooks.js";
export { useCollection, useSlot, useSlotItems, useSurfaceProp } from "./hooks.js";
export type {
  CapabilitiesProps,
  CapabilitiesRenderProps,
  PromptInputProps,
  PromptInputRenderProps,
  ProposalPreviewProps,
  ProposalPreviewRenderProps,
  ShippedNoticeProps,
  SurfaceMessageProps,
} from "./primitives.js";
export {
  AvailabilityNotice,
  Capabilities,
  PromptInput,
  ProposalPreview,
  RedoButton,
  ResetButton,
  ShippedNotice,
  SkippedNotice,
  SurfaceMessage,
  UndoButton,
  useCapabilities,
} from "./primitives.js";
export type {
  ComponentMap,
  PatinaBlockProps,
  SurfaceProps,
  SurfaceScopeProps,
} from "./Surface.js";
export { PatinaBlock, Surface, SurfaceScope } from "./Surface.js";
export type { Proposal, SurfaceMessageData, SurfaceSnapshot, SurfaceStatus } from "./store.js";
export { SurfaceStore } from "./store.js";
