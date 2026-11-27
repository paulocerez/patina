import { createPatinaHandler, memoryStorage } from "@patina-ui/server";
import { toExpress } from "@patina-ui/server/express";
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
  const { anthropicModel } = await import("@patina-ui/server/anthropic");
  // Default: Claude Haiku 5.5 answers, Sonnet 5.5 is the backup. PATINA_MODEL picks a single model.
  const model = process.env.PATINA_MODEL;
  const adapter = anthropicModel(model ? { model, backupModel: null } : {});
  console.log(`[demo] Using ${adapter.id}.`);
  return adapter;
}

const patina = createPatinaHandler({
  surfaces: [dashboard],
  storage: memoryStorage(),
  model: await pickModel(),
  basePath: "/api/patina",
  // Identity comes from the host's session. Here: a demo cookie.
  getContext: (req) => userFromCookie(req.headers.get("cookie")),
  // Who may customize: a feature flag for the whole feature, the plan for data views.
  // Users who lose access keep their saved customizations (whenOff defaults to "keep").
  availability: (ctx) => ({
    customize: ctx.flags.patina,
    dataViews: ctx.plan === "pro",
    message: !ctx.flags.patina
      ? "Customizing dashboards isn't enabled for your account yet."
      : ctx.plan === "free"
        ? "New charts, tables and cards are part of the Pro plan. You can still rearrange and hide things."
        : undefined,
  }),
  limits: {
    // A monthly budget of model calls: per user on Pro, per clinic on Free.
    monthlyProposals: (ctx) => (ctx.plan === "pro" ? { user: 500 } : { tenant: 50 }),
  },
  onError: (e) => console.error("[patina]", e),
  // Every request is logged with its outcome (memoryStorage keeps the log in memory). Forward
  // events to your analytics here; the demo just prints the ones that couldn't be done.
  onEvent: (e) => {
    if (e.outcome === "refused" || e.outcome === "unavailable")
      console.log(
        `[patina] ${e.tenantId}/${e.userId} asked "${e.prompt}" → ${e.outcome} (${e.source}: ${e.reason})`,
      );
  },
  // GET /api/patina/insights: what customers asked for and what couldn't be done. Staff only.
  insights: { allow: (ctx) => ctx.userId === "alice" },
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
