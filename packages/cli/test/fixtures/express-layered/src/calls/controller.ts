import type { Request, Response } from "express";
import { callService } from "./service";

export async function getCalls(req: Request, res: Response) {
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);
  const fromDate = req.query.fromDate;
  const toDate = req.query.toDate;
  const accountId = req.query.accountId as string;
  const { items, total } = await callService.listCalls(accountId, { limit, offset, fromDate, toDate });
  res.json({ items, total });
}

export async function getCall(req: Request, res: Response) {
  res.json(await callService.findCall(req.params.id));
}
