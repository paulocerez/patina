import { Router } from "express";
import { getAppointments } from "./controller";

const router = Router({ mergeParams: true });
router.get("/", getAppointments);
export default router;
