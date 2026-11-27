// biome-ignore-all lint/suspicious/noAssignInExpressions: regex matching chain in a throwaway demo model
/**
 * A keyword-matching stand-in for a real model, so the demo runs without an API key.
 * It understands a handful of phrasings only. Set ANTHROPIC_API_KEY to use Claude.
 */
import type { ModelRequest } from "@patina/core";
import type { ModelAdapter } from "@patina/server";

interface ViewItem {
  key: string;
  name: string;
  hidden?: boolean;
}
interface ViewNode {
  component: string;
  name: string;
  settings: Record<string, unknown>;
}
interface View {
  nodes: Record<string, ViewNode>;
}

const RANGES: [RegExp, string][] = [
  [/\btoday\b/, "today"],
  [/\bthis week\b/, "thisWeek"],
  [/\blast week\b/, "lastWeek"],
  [/\bthis month\b/, "thisMonth"],
  [/\b(last|past) 30 days\b/, "last30Days"],
  [/\b(last|past) 90 days\b|\bquarter\b/, "last90Days"],
];
const REFUSE =
  /\b(other users?|everyone'?s|all users|delete|remove (the )?(patient|record|appointment)s?|export|password|permission|admin|script|html|css|url|link)\b/;

export function offlineModel(): ModelAdapter {
  return {
    id: "offline-demo",
    async propose(request: ModelRequest) {
      const prompt = (
        /<request>\n([\s\S]*?)\n<\/request>/.exec(request.user)?.[1] ?? ""
      ).toLowerCase();
      const view = JSON.parse(
        /<current_view>\n([\s\S]*?)\n<\/current_view>/.exec(request.user)?.[1] ?? "{}",
      ) as View;
      if (REFUSE.test(prompt))
        return {
          kind: "refusal",
          message:
            "I can only change how this dashboard is laid out and filtered: order, visibility, default filters, sorting and a few display settings.",
          ops: [],
        };

      const items: { node: string; prop: string; item: ViewItem }[] = [];
      for (const [node, n] of Object.entries(view.nodes ?? {}))
        for (const [prop, v] of Object.entries(n.settings))
          if (Array.isArray(v))
            for (const item of v as ViewItem[]) items.push({ node, prop, item });
      const find = (text: string) => {
        const t = text
          .trim()
          .replace(/^(the|a|an)\s+/, "")
          .replace(/\s+(column|card|section|table|chart)s?$/, "");
        return items
          .filter(
            ({ item }) =>
              item.name.toLowerCase().includes(t) ||
              item.key.toLowerCase() === t ||
              t.includes(item.name.toLowerCase().replace(/ (card|chart|table)$/, "")),
          )
          .sort((a, b) => a.item.name.length - b.item.name.length)[0];
      };

      const ops: Record<string, unknown>[] = [];
      for (const clause of prompt
        .split(/,|;|\band\b|\bthen\b/)
        .map((c) => c.trim())
        .filter(Boolean)) {
        let m: RegExpExecArray | null;
        if ((m = /^(hide|show|unhide)\s+(.+)$/.exec(clause))) {
          const hit = find(m[2] as string);
          if (hit)
            ops.push({
              op: "setItem",
              node: hit.node,
              prop: hit.prop,
              key: hit.item.key,
              field: "hidden",
              value: m[1] === "hide",
            });
        } else if (
          (m =
            /^(?:move|put|place)\s+(.+?)\s+(?:right\s+)?(after|before|above|below|next to|first|last|to the top|to the bottom|at the top|at the end)\s*(.*)$/.exec(
              clause,
            ))
        ) {
          const hit = find(m[1] as string);
          const where = m[2] as string;
          if (!hit) continue;
          if (/first|top/.test(where))
            ops.push({
              op: "move",
              node: hit.node,
              prop: hit.prop,
              key: hit.item.key,
              position: "start",
              anchor: "",
            });
          else if (/last|bottom|end/.test(where))
            ops.push({
              op: "move",
              node: hit.node,
              prop: hit.prop,
              key: hit.item.key,
              position: "end",
              anchor: "",
            });
          else {
            const anchor = items.find(
              (i) =>
                i.node === hit.node &&
                i.prop === hit.prop &&
                i !== hit &&
                (i.item.name
                  .toLowerCase()
                  .includes(
                    (m?.[3] ?? "").replace(/^the\s+/, "").replace(/\s+(column|table|chart)$/, ""),
                  ) ||
                  i.item.key === m?.[3]),
            );
            if (anchor)
              ops.push({
                op: "move",
                node: hit.node,
                prop: hit.prop,
                key: hit.item.key,
                position: /before|above/.test(where) ? "before" : "after",
                anchor: anchor.item.key,
              });
          }
        } else if (
          (m = /\b(bar|line)?\s*(?:chart|graph) of (?:the )?(\w+)(?: per| by) (\w+)/.exec(clause))
        ) {
          // "a bar chart of revenue by vet" → a data block over the appointments source
          const metric = /revenue|income|sales/.test(m[2] as string)
            ? { op: "sum", field: "revenue" }
            : { op: "count", field: null };
          const by = (m[3] as string).replace(/s$/, "");
          const groupBy = ["day", "week", "month"].includes(by)
            ? { field: "date", bucket: by }
            : { field: by, bucket: null };
          ops.push({
            op: "insert",
            node: "page",
            prop: "main",
            preset: "block.chart",
            position: "end",
            anchor: "",
            props: {
              kind: m[1] === "line" ? "line" : "bar",
              query: { source: "appointments", groupBy, metric, where: null },
            },
          });
        } else if ((m = /(\d+)\s+rows/.exec(clause))) {
          ops.push({ op: "set", node: "appointments", prop: "pageSize", value: Number(m[1]) });
        } else if (/\b(compact|comfortable|denser|tighter)\b/.test(clause)) {
          ops.push({
            op: "set",
            node: "appointments",
            prop: "density",
            value: /comfortable/.test(clause) ? "comfortable" : "compact",
          });
        } else if (/\bbar\b/.test(clause) || /\bline\b/.test(clause)) {
          ops.push({
            op: "set",
            node: "revenue-chart",
            prop: "kind",
            value: /\bbar\b/.test(clause) ? "bar" : "line",
          });
        } else if (
          (m = /\bby (day|week|month)\b/.exec(clause)) &&
          /chart|group|revenue/.test(clause)
        ) {
          ops.push({ op: "set", node: "revenue-chart", prop: "groupBy", value: m[1] });
        } else if (
          (m = /\bsort(?:ed)? by (\w+)(?:.*\b(asc|ascending|oldest|desc|descending|newest))?/.exec(
            clause,
          ))
        ) {
          const hit = find(m[1] as string);
          if (hit)
            ops.push({
              op: "set",
              node: "appointments",
              prop: "sort",
              value: { key: hit.item.key, dir: /asc|oldest/.test(m[2] ?? "") ? "asc" : "desc" },
            });
        } else if (/no.?show/.test(clause) && /\b(add|show|include)\b/.test(clause)) {
          ops.push({
            op: "insert",
            node: "kpis",
            prop: "cards",
            preset: "stat.noShows",
            position: "end",
            anchor: "",
          });
        } else if (/average revenue/.test(clause) && /\badd\b/.test(clause)) {
          ops.push({
            op: "insert",
            node: "kpis",
            prop: "cards",
            preset: "stat.avgRevenue",
            position: "end",
            anchor: "",
          });
        } else {
          const range = RANGES.find(([re]) => re.test(clause));
          if (range)
            ops.push({
              op: "set",
              node: "filters",
              prop: "dateRange",
              value: { relative: range[1] },
            });
          const status = /\b(scheduled|completed|cancelled|no-?shows?)\b/.exec(clause)?.[1];
          if (status && /filter|only|status/.test(clause))
            ops.push({
              op: "set",
              node: "filters",
              prop: "status",
              value: status.startsWith("no") ? "noShow" : status,
            });
        }
      }
      if (ops.length === 0)
        return {
          kind: "clarify",
          message:
            "The offline demo model only understands simple requests like “hide the revenue column”, “move status after date” or “default to this week”. Set ANTHROPIC_API_KEY to use Claude.",
          ops: [],
        };
      return { kind: "patch", message: "Done.", ops };
    },
  };
}
