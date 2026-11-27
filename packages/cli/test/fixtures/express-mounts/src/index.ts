import express, { Router } from "express";
import callRoutes from "./calls/routes";
import { internalCallsRouter } from "./calls/routes";
import v1Routes from "./v1";
const legacy = require("./legacy/routes");

const app = express();
app.use(express.json());
app.use("/api/calls", requireAuth, callRoutes);
app.use("/internal/calls", internalCallsRouter);
app.use("/v1", v1Routes);
app.use("/old", legacy);
app.use("/api/accounts/:accountId/assistants", callRoutes); // path params: skipped

const health = Router();
health.get("/status", (_req, res) => res.json({ ok: true }));
app.use("/health", health);

function requireAuth() {}
