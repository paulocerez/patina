import { defineSurface, t } from "@patina/core";

export const orders = defineSurface({
  id: "orders",
  version: 1,
  description: "List of customer orders.",
  base: {
    schemaVersion: 1,
    surfaceId: "orders",
    baseVersion: 1,
    root: "table",
    nodes: {
      table: {
        component: "OrdersTable",
        props: {
          columns: [{ key: "date" }, { key: "customer" }, { key: "total" }, { key: "status" }],
          pageSize: 25,
        },
      },
    },
  },
  labels: { table: "Orders table" },
  components: {
    OrdersTable: {
      description: "One row per order.",
      props: {
        columns: t.collection({
          keys: ["date", "customer", "total", "status"],
          labels: { date: "Date", customer: "Customer", total: "Total", status: "Status" },
          reorder: true,
          hide: true,
        }),
        pageSize: t.int({ min: 10, max: 100 }, { label: "Rows per page" }),
      },
    },
  },
});
