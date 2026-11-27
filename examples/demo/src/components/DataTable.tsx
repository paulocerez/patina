import {
  type ColumnOrderState,
  type ColumnVisibilityState,
  columnOrderingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  type PaginationState,
  rowPaginationFeature,
  rowSortingFeature,
  type SortingState,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { euro, useFilters, useJson } from "../data.js";

interface Row {
  id: string;
  date: string;
  time: string;
  patient: string;
  species: string;
  vet: string;
  owner: string;
  status: string;
  revenue?: number;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  noShow: "No-show",
};

const features = tableFeatures({
  columnOrderingFeature,
  columnVisibilityFeature,
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
});
const helper = createColumnHelper<typeof features, Row>();

/** Default headings. Users can rename columns through Patina (`label`). */
const HEADINGS: Record<string, string> = {
  date: "Date",
  time: "Time",
  patient: "Patient",
  species: "Species",
  vet: "Vet",
  status: "Status",
  revenue: "Revenue",
  owner: "Owner",
};

function buildColumns(labels: Record<string, string | undefined>) {
  const h = (key: string) => labels[key] || HEADINGS[key] || key;
  return helper.columns([
    helper.accessor("date", { id: "date", header: h("date") }),
    helper.accessor("time", { id: "time", header: h("time") }),
    helper.accessor("patient", { id: "patient", header: h("patient") }),
    helper.accessor("species", { id: "species", header: h("species") }),
    helper.accessor("vet", { id: "vet", header: h("vet") }),
    helper.accessor("owner", { id: "owner", header: h("owner") }),
    helper.accessor("status", {
      id: "status",
      header: h("status"),
      cell: (info) => (
        <span className={`badge badge-${info.getValue()}`}>
          {STATUS_LABELS[info.getValue()] ?? info.getValue()}
        </span>
      ),
    }),
    helper.accessor((r) => r.revenue ?? 0, {
      id: "revenue",
      header: h("revenue"),
      cell: (info) => (info.getValue() ? euro(info.getValue()) : "—"),
    }),
  ]);
}

const EMPTY: Row[] = [];

interface DataTableProps {
  /** From Patina: visible columns in the user's order, with optional custom headings. */
  columns: { key: string; label?: string }[];
  sort?: { key: string; dir: "asc" | "desc" };
  pageSize?: number;
  density?: "compact" | "comfortable";
}

/**
 * A plain TanStack Table. Patina's resolved `columns` collection maps directly onto
 * TanStack's `columnOrder` and `columnVisibility` state; nothing here knows about Patina.
 */
export function DataTable({
  columns,
  sort = { key: "date", dir: "desc" },
  pageSize = 10,
  density = "comfortable",
}: DataTableProps) {
  const { filters } = useFilters();
  const data =
    useJson<Row[]>(`/api/data/appointments?range=${filters.range}&status=${filters.status}`) ??
    EMPTY;

  const labelKey = columns.map((c) => `${c.key}:${c.label ?? ""}`).join("|");
  // biome-ignore lint/correctness/useExhaustiveDependencies: labelKey captures the labels
  const columnDefs = useMemo(
    () => buildColumns(Object.fromEntries(columns.map((c) => [c.key, c.label]))),
    [labelKey],
  );

  const columnOrder: ColumnOrderState = useMemo(() => columns.map((c) => c.key), [columns]);
  const columnVisibility: ColumnVisibilityState = useMemo(
    () => Object.fromEntries(Object.keys(HEADINGS).map((k) => [k, columnOrder.includes(k)])),
    [columnOrder],
  );

  const [sorting, setSorting] = useState<SortingState>([
    { id: sort.key, desc: sort.dir === "desc" },
  ]);
  useEffect(() => setSorting([{ id: sort.key, desc: sort.dir === "desc" }]), [sort.key, sort.dir]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });
  useEffect(() => setPagination({ pageIndex: 0, pageSize }), [pageSize]);

  const table = useTable({
    features,
    columns: columnDefs,
    data,
    state: { columnOrder, columnVisibility, sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  });

  return (
    <section className={`card table-card density-${density}`}>
      <h2>Appointments</h2>
      <div className="table-scroll">
        <table>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const dir = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      aria-sort={
                        dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"
                      }
                    >
                      <button
                        type="button"
                        className="th-button"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <table.FlexRender header={header} />
                        <span className="sort-indicator">
                          {dir === "asc" ? "↑" : dir === "desc" ? "↓" : ""}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="empty">
                  No appointments in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <span>
          Page {table.state.pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())} ·{" "}
          {data.length} appointments
        </span>
        <button
          type="button"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </button>
        <button type="button" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Next
        </button>
      </div>
    </section>
  );
}
