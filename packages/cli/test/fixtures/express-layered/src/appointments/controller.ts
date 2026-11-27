import type { Request, Response } from "express";
import type { Appointment } from "./types";

export const getAppointments = async (req: Request, res: Response) => {
  const from = req.query.from;
  const to = req.query.to;
  const appointments: Appointment[] = [];
  res.json({ appointments });
};
