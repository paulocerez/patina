import {
  PatinaProvider,
  PromptInput,
  ProposalPreview,
  ResetButton,
  Surface,
  SurfaceMessage,
  UndoButton,
} from "@patina/react";

const ROWS = [
  { date: "2026-11-01", customer: "Ada", total: "€120", status: "Paid" },
  { date: "2026-11-02", customer: "Linus", total: "€80", status: "Open" },
];

function OrdersTable({ columns, pageSize }: { columns: { key: string }[]; pageSize: number }) {
  return (
    <table data-page-size={pageSize}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key}>{c.key}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ROWS.map((r) => (
          <tr key={r.date}>
            {columns.map((c) => (
              <td key={c.key}>{r[c.key as keyof typeof r]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function App() {
  return (
    <PatinaProvider endpoint="/api/patina">
      <PromptInput surfaceId="orders" />
      <SurfaceMessage surfaceId="orders" />
      <ProposalPreview surfaceId="orders" />
      <UndoButton surfaceId="orders" />
      <ResetButton surfaceId="orders" />
      <Surface id="orders" components={{ OrdersTable }} />
    </PatinaProvider>
  );
}
