import express from "express";
import callRoutes from "./calls/routes";
import appointmentRoutes from "./appointments/routes";

const app = express();
app.use("/api/calls", callRoutes);
app.use("/api/accounts/:accountId/appointments", appointmentRoutes);
app.listen(3000);
