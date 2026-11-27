import { createPatinaHandler, type ModelAdapter, memoryStorage } from "@patina-ui/server";
import { anthropicModel } from "@patina-ui/server/anthropic";
import { toExpress } from "@patina-ui/server/express";
import { scriptedModel } from "@patina-ui/server/testing";
import express from "express";
import { orders } from "./surfaces/orders.js";

// No key in this sandbox: fall back to a scripted model that hides "total".
const model: ModelAdapter = process.env.ANTHROPIC_API_KEY
  ? anthropicModel()
  : scriptedModel(() => ({
      kind: "patch",
      message: "Hid total",
      ops: [
        {
          op: "setItem",
          node: "table",
          prop: "columns",
          key: "total",
          field: "hidden",
          value: true,
        },
      ],
    }));

const patina = createPatinaHandler({
  surfaces: [orders],
  storage: memoryStorage(),
  model,
  basePath: "/api/patina",
  getContext: async () => ({ userId: "demo-user" }),
});

const app = express();
app.use("/api/patina", toExpress(patina));
app.listen(3002, () => console.log("Patina quick start API on http://localhost:3002"));
