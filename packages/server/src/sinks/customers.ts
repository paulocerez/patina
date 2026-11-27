/**
 * Per-customer follow-up sinks: tell account managers what their customer asked for.
 * @module @patina-ui/server/followups
 */
import type { Delivery, FollowUp, FollowUpSink } from "../followups.js";
import { apiError } from "./github.js";

export interface PerCustomerSinkOptions {
  name: string;
  /**
   * Called once per customer (tenant) with the follow-ups that customer asked for. The tenant
   * id stays on your server; map it to your CRM yourself. Return false if this customer was
   * skipped (e.g. not in your CRM): no delivery is reported for it.
   */
  notify(
    tenantId: string,
    followUps: FollowUp[],
  ): Promise<{ url?: string; ref?: string } | false | undefined>;
}

/** A sink that runs once per customer instead of once per follow-up. */
export function perCustomerSink(options: PerCustomerSinkOptions): FollowUpSink {
  return {
    name: options.name,
    async deliver(items) {
      const byTenant = new Map<string, FollowUp[]>();
      for (const f of items)
        for (const tenantId of new Set(f.requesters.map((r) => r.tenantId))) {
          if (tenantId === null) continue;
          byTenant.set(tenantId, [...(byTenant.get(tenantId) ?? []), f]);
        }
      const out: Delivery[] = [];
      for (const [tenantId, followUps] of byTenant) {
        const result = await options.notify(tenantId, followUps);
        if (result === false) continue;
        for (const f of followUps)
          out.push({
            sink: options.name,
            key: f.key,
            action: "posted",
            ...(result?.url ? { url: result.url } : {}),
            ...(result?.ref ? { ref: result.ref } : {}),
            note: "customer",
          });
      }
      return out;
    },
  };
}

export interface HubSpotSinkOptions {
  /** A private app token with crm.objects.notes.write and crm.objects.companies.read. */
  token: string;
  /** The HubSpot company id for a tenant, or null to skip that customer. */
  companyId(tenantId: string): string | null | undefined | Promise<string | null | undefined>;
  /** Shown in the note ("… in Vetpal"). */
  appName?: string;
  /** Default https://api.hubapi.com. */
  apiUrl?: string;
  fetch?: typeof fetch;
}

const html = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** The note body for one customer (HTML, all user text escaped). Exported for tests and custom CRMs. */
export function renderCustomerNoteHtml(
  tenantId: string,
  followUps: FollowUp[],
  opts: { appName?: string } = {},
): string {
  const items = followUps.map((f) => {
    const theirs = f.requesters
      .filter((r) => r.tenantId === tenantId)
      .reduce((n, r) => n + r.count, 0);
    const example = f.examples[0] ? `<br><em>“${html(f.examples[0])}”</em>` : "";
    return `<li><strong>${html(f.title)}</strong> (${theirs}×)${example}</li>`;
  });
  return `<p><strong>Requests this customer couldn't do${opts.appName ? ` in ${html(opts.appName)}` : ""}</strong></p><ul>${items.join("")}</ul><p>From Patina follow-ups.</p>`;
}

/** Adds a note to the customer's HubSpot company with what they asked for. */
export function hubspotSink(options: HubSpotSinkOptions): FollowUpSink {
  const doFetch = options.fetch ?? fetch;
  const api = (options.apiUrl ?? "https://api.hubapi.com").replace(/\/+$/, "");
  const sink = perCustomerSink({
    name: "hubspot",
    async notify(tenantId, followUps) {
      const companyId = await options.companyId(tenantId);
      if (!companyId) return false;
      const res = await doFetch(`${api}/crm/v3/objects/notes`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            hs_timestamp: new Date().toISOString(),
            hs_note_body: renderCustomerNoteHtml(tenantId, followUps, options),
          },
          associations: [
            {
              to: { id: companyId },
              types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 190 }],
            },
          ],
        }),
      });
      if (!res.ok) throw await apiError(res, "HubSpot");
      const note = (await res.json()) as { id?: string };
      return note.id ? { ref: `note ${note.id}` } : undefined;
    },
  });
  return sink;
}
