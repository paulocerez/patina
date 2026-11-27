import { Router } from "express";
export interface Call { id: string; startedAt: string; durationSeconds: number; status: "done" | "missed" }
function listCalls(): Call[] { return []; }
const router = Router();
router.get("/", (req, res) => { const q = req.query.status; res.json(listCalls()); });
router.get("/dashboard-metrics", (_req, res) => res.json({}));
router.get("/:id", (_req, res) => res.json({}));
export const internalCallsRouter = Router();
internalCallsRouter.get("/queue", (_req, res) => res.json([]));
export default router;
