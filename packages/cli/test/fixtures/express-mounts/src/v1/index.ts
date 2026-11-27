import { Router } from "express";
import callsRouter from "../calls/routes";
import contactsRouter from "../contacts/routes";
const router = Router();
router.use("/calls", callsRouter);
router.use("/contacts", contactsRouter);
export default router;
