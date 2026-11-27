import { createPatinaHandler, memoryStorage } from "@patina/server";
import { toExpress } from "@patina/server/express";
import express from "express";
import { appointments, metrics } from "./data.js";
import { offlineModel } from "./offlineModel.js";
import { dashboard } from "./surface.js";
import { USERS, userFromCookie } from "./users.js";

async function pickModel() {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.PATINA_USE_ANTHROPIC) {
    console.log("[demo] No ANTHROPIC_API_KEY set: using the offline keyword model.");
    return offlineModel();
  }
  const { anthropicModel } = await import("@patina/server/anthropic");
  const model = process.env.PATINA_MODEL ?? "claude-opus-5-5";
  console.log(`[demo] Using Anthropic model ${model}.`);
  return anthropicModel({ model });
}

const patina = createPatinaHandler({
  surfaces: [dashboard],
  storage: memoryStorage(),
  model: await pickModel(),
  basePath: "/api/patina",
  // Identity comes from the host's session. Here: a demo cookie.
  getContext: (req) => userFromCookie(req.headers.get("cookie")),
  onError: (e) => console.error("[patina]", e),
});

const app = express();
app.use("/api/patina", toExpress(patina));
app.use(express.json());

app.get("/api/me", (req, res) => {
  res.json({ user: userFromCookie(req.headers.cookie), users: Object.values(USERS) });
});
app.post("/api/me", (req, res) => {
  const id = String(req.body?.userId ?? "");
  if (!USERS[id]) return void res.status(400).json({ error: { message: "Unknown user" } });
  res.setHeader("set-cookie", `demo_user=${id}; Path=/; SameSite=Lax; HttpOnly`);
  res.json({ user: USERS[id] });
});
app.get("/api/data/appointments", (req, res) => {
  const ctx = userFromCookie(req.headers.cookie);
  res.json(
    appointments(ctx, String(req.query.range ?? "last30Days"), String(req.query.status ?? "all")),
  );
});
app.get("/api/data/metrics", (req, res) => {
  const ctx = userFromCookie(req.headers.cookie);
  res.json(
    metrics(
      ctx,
      String(req.query.range ?? "last30Days"),
      String(req.query.status ?? "all"),
      String(req.query.groupBy ?? "week"),
    ),
  );
});

const port = Number(process.env.DEMO_API_PORT ?? 3001);
app.listen(port, () => console.log(`[demo] API on http://localhost:${port}`));
