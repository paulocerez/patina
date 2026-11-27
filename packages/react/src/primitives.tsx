import type { Change } from "@patina-ui/core";
import { type ButtonHTMLAttributes, type FormEvent, type ReactNode, useId, useState } from "react";
import { useSurface } from "./context.js";

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
  placeholder = "Describe a change, e.g. “hide the revenue column”",
  label = "Customize this view",
  submitLabel = "Preview",
  className,
  maxLength = 500,
  children,
}: PromptInputProps) {
  const s = useSurface(surfaceId);
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
      "aria-label": label,
    },
  };
  if (!s.availability.customize) return null;
  if (children) return <>{children(props)}</>;
  return (
    <form className={className} data-patina="prompt" {...props.formProps}>
      <input type="text" placeholder={placeholder} {...props.inputProps} />
      <button type="submit" disabled={s.busy || !value.trim()}>
        {s.status === "proposing" ? "Thinking…" : submitLabel}
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
  applyLabel = "Apply",
  discardLabel = "Discard",
  children,
}: ProposalPreviewProps) {
  const s = useSurface(surfaceId);
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
      aria-label="Proposed changes"
      aria-live="polite"
    >
      <ul>
        {props.changes.map((c) => (
          <li key={c.opIndex}>{c.text}</li>
        ))}
      </ul>
      <button type="button" onClick={props.commit} disabled={props.busy}>
        {applyLabel}
      </button>
      <button type="button" onClick={props.discard} disabled={props.busy}>
        {discardLabel}
      </button>
    </section>
  );
}

export interface SurfaceMessageProps {
  surfaceId: string;
  className?: string;
  children?: (message: { kind: "refusal" | "clarify" | "error"; text: string }) => ReactNode;
}

/** Shows a refusal, a clarifying question or an error from the last request. */
export function SurfaceMessage({ surfaceId, className, children }: SurfaceMessageProps) {
  const { message } = useSurface(surfaceId);
  if (!message) return null;
  if (children) return <>{children(message)}</>;
  return (
    <p
      className={className}
      data-patina="message"
      data-kind={message.kind}
      role={message.kind === "error" ? "alert" : "status"}
    >
      {message.text}
    </p>
  );
}

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & { surfaceId: string };

/** Undoes the last saved change (or the last reset). */
export function UndoButton({ surfaceId, children = "Undo", disabled, ...rest }: ButtonProps) {
  const s = useSurface(surfaceId);
  if (!s.availability.customize) return null;
  return (
    <button
      type="button"
      {...rest}
      data-patina="undo"
      disabled={disabled || s.busy || !s.canUndo}
      onClick={() => void s.undo()}
    >
      {children}
    </button>
  );
}

/** Returns the view to its default. Can itself be undone. */
export function ResetButton({
  surfaceId,
  children = "Reset to default",
  disabled,
  ...rest
}: ButtonProps) {
  const s = useSurface(surfaceId);
  if (!s.availability.customize) return null;
  return (
    <button
      type="button"
      {...rest}
      data-patina="reset"
      disabled={disabled || s.busy || !s.isCustomized}
      onClick={() => void s.reset()}
    >
      {children}
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
  if (skipped.length === 0) return null;
  if (children) return <>{children(skipped)}</>;
  return (
    <details className={className} data-patina="skipped">
      <summary>
        {skipped.length === 1
          ? "1 of your earlier changes no longer applies"
          : `${skipped.length} of your earlier changes no longer apply`}
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
