import {
  type Capabilities as CapabilityList,
  type Change,
  capabilityExamples,
  capabilityLines,
  type Notice,
} from "@patina-ui/core";
import { type ButtonHTMLAttributes, type FormEvent, type ReactNode, useId, useState } from "react";
import { usePatinaText, useSurface } from "./context.js";
import type { SurfaceMessageData } from "./store.js";

/* All primitives are unstyled. Pass className/style, or use the render-prop form for full control. */

export interface PromptInputRenderProps {
  value: string;
  setValue(value: string): void;
  submit(): void;
  busy: boolean;
  formProps: { onSubmit(e: FormEvent): void; "aria-busy": boolean };
  inputProps: {
    id: string;
    value: string;
    onChange(e: { target: { value: string } }): void;
    disabled: boolean;
    maxLength: number;
    "aria-label": string;
  };
}

export interface PromptInputProps {
  surfaceId: string;
  placeholder?: string;
  label?: string;
  submitLabel?: ReactNode;
  className?: string;
  maxLength?: number;
  children?: (props: PromptInputRenderProps) => ReactNode;
}

/** A text box that sends the user's request. Clears itself when a preview arrives. */
export function PromptInput({
  surfaceId,
  placeholder,
  label,
  submitLabel,
  className,
  maxLength = 500,
  children,
}: PromptInputProps) {
  const s = useSurface(surfaceId);
  const { t } = usePatinaText();
  const [value, setValue] = useState("");
  const id = useId();
  const submit = () => {
    const prompt = value.trim();
    if (!prompt || s.busy) return;
    void s.propose(prompt).then(() => setValue((v) => (v.trim() === prompt ? "" : v)));
  };
  const props: PromptInputRenderProps = {
    value,
    setValue,
    submit,
    busy: s.busy,
    formProps: {
      onSubmit: (e) => {
        e.preventDefault();
        submit();
      },
      "aria-busy": s.status === "proposing",
    },
    inputProps: {
      id,
      value,
      onChange: (e) => setValue(e.target.value),
      disabled: s.busy,
      maxLength,
      "aria-label": label ?? t("promptLabel"),
    },
  };
  if (!s.availability.customize) return null;
  if (children) return <>{children(props)}</>;
  return (
    <form className={className} data-patina="prompt" {...props.formProps}>
      <input
        type="text"
        placeholder={placeholder ?? t("promptPlaceholder")}
        {...props.inputProps}
      />
      <button type="submit" disabled={s.busy || !value.trim()}>
        {s.status === "proposing" ? t("thinking") : (submitLabel ?? t("preview"))}
      </button>
    </form>
  );
}

export interface ProposalPreviewRenderProps {
  changes: Change[];
  summary: string;
  commit(): void;
  discard(): void;
  busy: boolean;
}

export interface ProposalPreviewProps {
  surfaceId: string;
  className?: string;
  applyLabel?: ReactNode;
  discardLabel?: ReactNode;
  children?: (props: ProposalPreviewRenderProps) => ReactNode;
}

/**
 * Lists the pending changes (generated from the patch itself, not from the model) with
 * Apply and Discard. The surface already renders the preview while this is shown.
 */
export function ProposalPreview({
  surfaceId,
  className,
  applyLabel,
  discardLabel,
  children,
}: ProposalPreviewProps) {
  const s = useSurface(surfaceId);
  const { t } = usePatinaText();
  if (!s.proposal) return null;
  const props: ProposalPreviewRenderProps = {
    changes: s.proposal.changes,
    summary: s.proposal.summary,
    commit: () => void s.commit(),
    discard: s.discard,
    busy: s.busy,
  };
  if (children) return <>{children(props)}</>;
  return (
    <section
      className={className}
      data-patina="preview"
      aria-label={t("proposedChanges")}
      aria-live="polite"
    >
      <ul>
        {props.changes.map((c) => (
          <li key={c.opIndex}>{c.text}</li>
        ))}
      </ul>
      <button type="button" onClick={props.commit} disabled={props.busy}>
        {applyLabel ?? t("apply")}
      </button>
      <button type="button" onClick={props.discard} disabled={props.busy}>
        {discardLabel ?? t("discard")}
      </button>
    </section>
  );
}

export interface SurfaceMessageProps {
  surfaceId: string;
  className?: string;
  /**
   * Custom rendering. `message.options` (clarify) are the choices to offer; call `pick(label)`
   * to send one. `message.capabilities` (answer) is what the user can change.
   */
  children?: (message: SurfaceMessageData, actions: { pick(label: string): void }) => ReactNode;
}

/**
 * Shows what the last request said back: a refusal, a clarifying question (with its options as
 * buttons), an answer to "what can I …?" (as a list), or an error. Unstyled.
 */
export function SurfaceMessage({ surfaceId, className, children }: SurfaceMessageProps) {
  const { message, propose, busy } = useSurface(surfaceId);
  if (!message) return null;
  const pick = (label: string) => void propose(label);
  if (children) return <>{children(message, { pick })}</>;
  const [lead, ...rest] = message.text.split("\n");
  const items = rest.map((l) => l.replace(/^- /, "")).filter(Boolean);
  const role = message.kind === "error" ? "alert" : "status";
  // A plain message stays a single paragraph (as before 0.7).
  if (!items.length && !message.options?.length)
    return (
      <p className={className} data-patina="message" data-kind={message.kind} role={role}>
        {message.text}
      </p>
    );
  return (
    <div className={className} data-patina="message" data-kind={message.kind} role={role}>
      <p>{lead}</p>
      {items.length > 0 && (
        <ul>
          {items.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {message.options && message.options.length > 0 && (
        <div data-patina="options">
          {message.options.map((o) => (
            <button
              key={o.label}
              type="button"
              data-patina="option"
              disabled={busy}
              onClick={() => pick(o.label)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & { surfaceId: string };

/** Undoes the last saved change (or the last reset). */
export function UndoButton({ surfaceId, children, disabled, ...rest }: ButtonProps) {
  const s = useSurface(surfaceId);
  const { t } = usePatinaText();
  if (!s.availability.customize) return null;
  return (
    <button
      type="button"
      {...rest}
      data-patina="undo"
      disabled={disabled || s.busy || !s.canUndo}
      onClick={() => void s.undo()}
    >
      {children ?? t("undo")}
    </button>
  );
}

/** Takes back the last undo (e.g. after an accidental click). Hidden while there is nothing to redo. */
export function RedoButton({ surfaceId, children, disabled, ...rest }: ButtonProps) {
  const s = useSurface(surfaceId);
  const { t } = usePatinaText();
  if (!s.availability.customize || !s.canRedo) return null;
  return (
    <button
      type="button"
      {...rest}
      data-patina="redo"
      disabled={disabled || s.busy}
      onClick={() => void s.redo()}
    >
      {children ?? t("redo")}
    </button>
  );
}

/** Returns the view to its default. Can itself be undone. */
export function ResetButton({ surfaceId, children, disabled, ...rest }: ButtonProps) {
  const s = useSurface(surfaceId);
  const { t } = usePatinaText();
  if (!s.availability.customize) return null;
  return (
    <button
      type="button"
      {...rest}
      data-patina="reset"
      disabled={disabled || s.busy || !s.isCustomized}
      onClick={() => void s.reset()}
    >
      {children ?? t("reset")}
    </button>
  );
}

export interface SkippedNoticeProps {
  surfaceId: string;
  className?: string;
  children?: (skipped: { message: string }[]) => ReactNode;
}

/** Tells the user when some of their earlier changes no longer apply (after a base view update). */
export function SkippedNotice({ surfaceId, className, children }: SkippedNoticeProps) {
  const skipped = useSurface(surfaceId).state?.skipped ?? [];
  const { t } = usePatinaText();
  if (skipped.length === 0) return null;
  if (children) return <>{children(skipped)}</>;
  return (
    <details className={className} data-patina="skipped">
      <summary>
        {skipped.length === 1 ? t("skippedOne") : t("skippedMany", { count: skipped.length })}
      </summary>
      <ul>
        {skipped.map((s, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static list
          <li key={i}>{s.message}</li>
        ))}
      </ul>
    </details>
  );
}

export interface ShippedNoticeProps {
  surfaceId: string;
  className?: string;
  /** Render each notice yourself; `text` is the host's message or Patina's localized default. */
  children?: (notices: (Notice & { text: string; dismiss(): void })[]) => ReactNode;
}

/**
 * "You asked for … That's now possible.": shown to users whose earlier request (one Patina
 * couldn't do) has since shipped. See docs/guides/follow-ups.md.
 */
export function ShippedNotice({ surfaceId, className, children }: ShippedNoticeProps) {
  const { notices, dismissNotice } = useSurface(surfaceId);
  const { t } = usePatinaText();
  if (notices.length === 0) return null;
  const items = notices.map((n) => ({
    ...n,
    text: n.message ?? t("shipped", { title: n.title }),
    dismiss: () => void dismissNotice(n.key),
  }));
  if (children) return <>{children(items)}</>;
  return (
    <ul className={className} data-patina="shipped">
      {items.map((n) => (
        <li key={n.key} role="status">
          <span>{n.text}</span>{" "}
          <button type="button" onClick={n.dismiss}>
            {t("dismiss")}
          </button>
        </li>
      ))}
    </ul>
  );
}

export interface AvailabilityNoticeProps {
  surfaceId: string;
  className?: string;
  children?: (availability: {
    customize: boolean;
    dataViews: boolean;
    message: string;
  }) => ReactNode;
}

/**
 * Shows the host's message when customizing (or creating data views) isn't available to this
 * user, e.g. "Upgrade to Pro to customize this dashboard". Renders nothing otherwise.
 */
export function AvailabilityNotice({ surfaceId, className, children }: AvailabilityNoticeProps) {
  const { availability } = useSurface(surfaceId);
  if (!availability.message || (availability.customize && availability.dataViews)) return null;
  const a = { ...availability, message: availability.message };
  if (children) return <>{children(a)}</>;
  return (
    <p className={className} data-patina="availability" role="note">
      {a.message}
    </p>
  );
}

/**
 * What this user can ask for on a surface (from the server, in their language): the lists
 * they can rearrange, the settings and their values, and the data they can add as views.
 * Null until the surface has loaded, or when customizing is off.
 */
export function useCapabilities(surfaceId: string): CapabilityList | null {
  const { state, availability } = useSurface(surfaceId);
  if (!availability.customize) return null;
  return state?.capabilities ?? null;
}

export interface CapabilitiesRenderProps {
  capabilities: CapabilityList;
  /** One readable line per capability ("Sections (…): reorder, hide"). */
  lines: string[];
  /** A few example prompts for this surface, e.g. for chips in the prompt box. */
  examples: string[];
  /** Sends a prompt, e.g. when a chip is clicked. */
  propose(prompt: string): Promise<void>;
  /** The localized heading ("What you can ask for"). */
  title: string;
}

export interface CapabilitiesProps {
  surfaceId: string;
  className?: string;
  /** How many example prompts to offer. Default 4. */
  maxExamples?: number;
  children?: (props: CapabilitiesRenderProps) => ReactNode;
}

/**
 * "What you can ask for": a list of the customizable parts and data, or (with the
 * render-prop form) example chips for the prompt box. Unstyled.
 */
export function Capabilities({
  surfaceId,
  className,
  maxExamples = 4,
  children,
}: CapabilitiesProps) {
  const caps = useCapabilities(surfaceId);
  const { propose } = useSurface(surfaceId);
  const { locale, t } = usePatinaText();
  if (!caps) return null;
  const lines = capabilityLines(caps, locale);
  if (lines.length === 0) return null;
  const props: CapabilitiesRenderProps = {
    capabilities: caps,
    lines,
    examples: capabilityExamples(caps, locale, maxExamples),
    propose,
    title: t("capTitle"),
  };
  if (children) return <>{children(props)}</>;
  return (
    <details className={className} data-patina="capabilities">
      <summary>{props.title}</summary>
      <ul>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </details>
  );
}
