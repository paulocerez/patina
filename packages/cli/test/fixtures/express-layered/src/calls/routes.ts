import { Router } from "express";
import * as controller from "./controller";

const router = Router();
router.get("/", controller.getCalls);
router.get("/:id", controller.getCall);
export default router;
